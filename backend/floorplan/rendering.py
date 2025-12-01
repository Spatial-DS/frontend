import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from scipy.interpolate import griddata
from scipy.ndimage import gaussian_filter
from shapely.geometry import MultiPolygon, Point, Polygon, box
from shapely.ops import unary_union

from floorplan.data_models import Individual, DiscretizationResult, FloorPlan
from floorplan.geometry import GeometryProcessor

# --- PRIVATE HELPER FUNCTIONS ---


def _plot_shapely_geom(ax: plt.Axes, geom, color: str):
    """Helper to fill a Shapely Polygon or MultiPolygon on a Matplotlib axis."""
    if hasattr(geom, "geoms"):
        for poly in geom.geoms:
            x, y = poly.exterior.xy
            # Alpha=1.0 (Opaque) prevents ugly overlap bands
            # linewidth=1 adds a stroke to seal micro-gaps
            ax.fill(
                x, y, color=color, alpha=1.0, zorder=2, edgecolor=color, linewidth=1
            )
    elif not geom.is_empty:
        x, y = geom.exterior.xy
        ax.fill(x, y, color=color, alpha=1.0, zorder=2, edgecolor=color, linewidth=1)


def _transform_poly_coords_manual(poly, disc_result):
    """Transforms grid coordinates (0..N) back to real-world coordinates."""
    if poly.is_empty:
        return poly

    ext_coords = np.array(poly.exterior.coords)
    ext_real = disc_result.scaling_info.to_real(ext_coords)

    holes = []
    for interior in poly.interiors:
        int_coords = np.array(interior.coords)
        int_real = disc_result.scaling_info.to_real(int_coords)
        holes.append(int_real)

    return Polygon(ext_real, holes=holes)


def _rasterize_and_smooth(disc_result, node_assignment, type_map, smoothness):
    """
    Converts discrete node points into a high-res smoothed label map.
    """
    n = disc_result.scaling_info.n
    upscale = 8
    res = int(n * upscale)

    gx = np.linspace(0, n, res)
    gy = np.linspace(0, n, res)
    grid_x_mesh, grid_y_mesh = np.meshgrid(gx, gy)

    # 1. Base Grid
    try:
        label_map = griddata(
            points=disc_result.grid_positions,
            values=node_assignment,
            xi=(grid_x_mesh, grid_y_mesh),
            method="nearest",
        )
    except Exception as e:
        print(f"[DEBUG ERROR] Grid interpolation failed: {e}")
        return np.zeros((res, res)), gx, gy

    # 2. Gaussian Smoothing
    unique_types = np.unique(node_assignment)
    smoothed_labels = np.zeros_like(label_map)
    max_probs = -np.ones_like(label_map, dtype=float)

    # FIX: Reduce sigma scaling.
    # Previous: smoothness * upscale / 2.0  (1.5 * 8 / 2 = 6.0 pixels) -> Too blurry
    # New:      smoothness * upscale / 4.0  (1.5 * 8 / 4 = 3.0 pixels) -> Tighter
    sigma = max(1.0, smoothness * upscale / 4.0)

    for t_idx in unique_types:
        if t_idx == -1:
            continue

        mask = (label_map == t_idx).astype(float)
        prob = gaussian_filter(mask, sigma=sigma, mode="nearest")

        winner_mask = prob > max_probs
        smoothed_labels[winner_mask] = t_idx
        max_probs[winner_mask] = prob[winner_mask]

    return smoothed_labels, gx, gy


def _extract_contours_to_polygons(label_map, gx, gy, disc_result):
    """
    Converts raster labels to Vector Polygons.
    """
    unique_types = np.unique(label_map)
    polys_by_type = {}

    temp_fig = plt.figure(figsize=(1, 1))

    def pad_grid(mask, x, y):
        padded_mask = np.pad(mask, 1, mode="constant", constant_values=0)
        dx = x[1] - x[0]
        dy = y[1] - y[0]
        x_new = np.r_[x[0] - dx, x, x[-1] + dx]
        y_new = np.r_[y[0] - dy, y, y[-1] + dy]
        return padded_mask, x_new, y_new

    # Antialias sigma
    antialias_sigma = 2.0

    for t_idx in unique_types:
        if t_idx == -1:
            continue

        mask = (label_map == t_idx).astype(float)
        mask = gaussian_filter(mask, sigma=antialias_sigma, mode="nearest")

        p_mask, p_gx, p_gy = pad_grid(mask, gx, gy)

        contours = plt.contour(p_gx, p_gy, p_mask, levels=[0.3])

        polys_for_this_type = []

        if contours.allsegs:
            for coord_array in contours.allsegs[0]:
                if len(coord_array) < 3:
                    continue
                p = Polygon(coord_array)
                if not p.is_valid:
                    p = p.buffer(0)

                # Simplify to clean up vertices
                p = p.simplify(0.05, preserve_topology=True)

                # Tiny buffer to force physical overlap
                p = p.buffer(0.05, join_style=1)

                polys_for_this_type.append(p)

        if polys_for_this_type:
            merged = unary_union(polys_for_this_type)

            if isinstance(merged, Polygon):
                real_p = _transform_poly_coords_manual(merged, disc_result)
                polys_by_type[int(t_idx)] = real_p
            elif hasattr(merged, "geoms"):
                real_parts = [
                    _transform_poly_coords_manual(g, disc_result) for g in merged.geoms
                ]
                polys_by_type[int(t_idx)] = MultiPolygon(real_parts)

    plt.close(temp_fig)
    return polys_by_type


def _clean_and_clip_zones(polys_by_type, floor_poly):
    """Clips polygons to floor plan."""
    final_list = []
    floor_safe = floor_poly.buffer(0)

    for t_idx, geom in polys_by_type.items():
        try:
            clipped = geom.intersection(floor_safe)
        except:
            clipped = geom.buffer(0).intersection(floor_safe)

        if clipped.is_empty:
            continue

        if isinstance(clipped, Polygon):
            if clipped.area > 0.1:
                final_list.append({"poly": clipped, "type": t_idx})
        elif hasattr(clipped, "geoms"):
            for p in clipped.geoms:
                if isinstance(p, Polygon) and p.area > 0.1:
                    final_list.append({"poly": p, "type": t_idx})

    return final_list


def _plot_zones_and_annotations(ax, polygons_data, original_polygon, room_df, type_map):
    """
    Handles drawing with edge-snapped leader lines to prevent crossing.
    """
    type_names = {i: name for name, i in type_map.items()}
    type_info = room_df.set_index("short")

    # Sort large to small
    polygons_data.sort(key=lambda x: x["poly"].area, reverse=True)

    for data in polygons_data:
        name_key = type_names[data["type"]]
        color = type_info.loc[name_key]["color"]
        _plot_shapely_geom(ax, data["poly"], color)

    # --- Labels ---
    placed_bboxes = []
    renderer = ax.get_figure().canvas.get_renderer()
    min_label_area = original_polygon.area * 0.005

    for data in polygons_data:
        poly = data["poly"]
        if poly.area < min_label_area:
            continue

        name_key = type_names[data["type"]]
        full_name = type_info.loc[name_key]["full"]

        # Center point for internal check
        try:
            center_point = poly.pole_of_inaccessibility(precision=0.5)
        except:
            center_point = poly.representative_point()

        # --- 1. Internal Placement Check ---
        txt = ax.text(
            center_point.x,
            center_point.y,
            full_name,
            ha="center",
            va="center",
            fontsize=8,
            zorder=10,
            bbox=dict(boxstyle="round,pad=0.2", fc="white", alpha=0.6, ec="none"),
        )

        bb_disp = txt.get_window_extent(renderer)
        inv_trans = ax.transData.inverted()
        bbox_points = bb_disp.get_points()
        data_bbox = inv_trans.transform(bbox_points)

        text_box_poly = Polygon(
            [
                (data_bbox[0, 0], data_bbox[0, 1]),
                (data_bbox[1, 0], data_bbox[0, 1]),
                (data_bbox[1, 0], data_bbox[1, 1]),
                (data_bbox[0, 0], data_bbox[1, 1]),
            ]
        )

        bb_padded = bb_disp.expanded(1.1, 1.1)

        # Strict internal check
        is_internal_viable = True
        if text_box_poly.area > (poly.area * 0.15):
            is_internal_viable = False

        if is_internal_viable:
            safe_zone = poly.buffer(-1.5)
            if safe_zone.is_empty or not safe_zone.contains(text_box_poly):
                is_internal_viable = False

        if is_internal_viable and not any(
            bb_padded.overlaps(ex) for ex in placed_bboxes
        ):
            placed_bboxes.append(bb_padded)
            continue  # Keep internal

        txt.remove()

        # --- 2. External Placement with Edge Snapping ---
        # Find nearest point on the BUILDING boundary to the room center
        # This gives us a direction to push the label out
        nearest_ext = original_polygon.exterior.interpolate(
            original_polygon.exterior.project(center_point)
        )

        dx, dy = center_point.x - nearest_ext.x, center_point.y - nearest_ext.y
        dist = np.linalg.norm([dx, dy]) or 1.0
        dx, dy = dx / dist, dy / dist

        success = False
        base_dist = (ax.get_xlim()[1] - ax.get_xlim()[0]) * 0.05

        for r_mult in [3.0, 6.0, 10.0, 15.0, 20.0]:
            if success:
                break
            for ang in [0, 15, -15, 30, -30, 45, -45, 90, -90, 135, -135, 180]:
                rad = np.radians(ang)
                rx = dx * np.cos(rad) - dy * np.sin(rad)
                ry = dx * np.sin(rad) + dy * np.cos(rad)

                tx = nearest_ext.x + rx * base_dist * r_mult
                ty = nearest_ext.y + ry * base_dist * r_mult

                # Check if outside floor
                if original_polygon.contains(Point(tx, ty)):
                    continue

                # --- FIX: Calculate Anchor Point on the Zone Edge ---
                # Instead of pointing to 'center_point', point to the edge of 'poly'
                # that is closest to the text position (tx, ty).
                text_pt = Point(tx, ty)

                # Project text point onto the room polygon's boundary
                # This finds the closest spot on the room wall to attach the leader line
                room_boundary = poly.exterior
                anchor_dist = room_boundary.project(text_pt)
                anchor_pt = room_boundary.interpolate(anchor_dist)

                anno = ax.annotate(
                    full_name,
                    xy=(anchor_pt.x, anchor_pt.y),  # Point to edge!
                    xytext=(tx, ty),
                    fontsize=8,
                    zorder=10,
                    ha="center",
                    va="center",
                    arrowprops=dict(
                        arrowstyle="-",
                        color="black",
                        lw=0.7,
                        shrinkA=0,
                        shrinkB=0,
                        patchA=None,
                        patchB=None,
                    ),
                    bbox=dict(
                        boxstyle="round,pad=0.2",
                        fc="white",
                        alpha=0.9,
                        ec="gray",
                        lw=0.5,
                    ),
                )

                bb_new = anno.get_window_extent(renderer)
                bb_new_padded = bb_new.expanded(1.1, 1.1)

                # Collision check
                center_data = inv_trans.transform(
                    [(bb_new.x0 + bb_new.x1) / 2, (bb_new.y0 + bb_new.y1) / 2]
                )
                overlaps_floor = original_polygon.contains(
                    Point(center_data[0], center_data[1])
                )

                if not overlaps_floor and not any(
                    bb_new_padded.overlaps(ex) for ex in placed_bboxes
                ):
                    placed_bboxes.append(bb_new_padded)
                    success = True
                    break
                else:
                    anno.remove()


def _plot_centroids(ax, individual, disc_result, room_df, type_map):
    """Renders the final centroid points."""
    type_info = room_df.set_index("short")
    for type_name, nodes in individual.items():
        if not nodes or type_name not in type_map:
            continue
        grid_coords = disc_result.grid_positions[nodes]
        real_coords = disc_result.scaling_info.to_real(grid_coords)
        color = type_info.loc[type_name]["color"]

        fixed_nodes = disc_result.fixed_nodes.get(type_name, [])
        is_fixed = np.isin(nodes, fixed_nodes)

        ax.scatter(
            real_coords[:, 0],
            real_coords[:, 1],
            s=40,
            c=[color],
            edgecolor="white",
            lw=1,
            zorder=5,
        )
        if np.any(is_fixed):
            ax.scatter(
                real_coords[is_fixed, 0],
                real_coords[is_fixed, 1],
                s=80,
                c=[color],
                edgecolor="black",
                lw=2,
                zorder=6,
            )


# --- PUBLIC API ---


def render_grid_to_axis(
    ax: plt.Axes,
    disc_result: DiscretizationResult,
    node_assignment: np.ndarray,
    room_df: pd.DataFrame,
    type_map: dict[str, int],
):
    ax.clear()
    x_poly, y_poly = disc_result.scaled_polygon.exterior.xy
    ax.fill(x_poly, y_poly, alpha=0.2, color="lightgray", zorder=1)
    ax.plot(x_poly, y_poly, "k-", zorder=2)

    point_size = max(20, 4000 / (disc_result.scaling_info.n**1.2))
    type_names = list(type_map.keys())
    type_colors = room_df.set_index("short").loc[type_names]["color"].tolist()

    for i, t in enumerate(type_names):
        nodes = np.where(node_assignment == i)[0]
        if len(nodes) > 0:
            ax.scatter(
                disc_result.grid_positions[nodes, 0],
                disc_result.grid_positions[nodes, 1],
                color=type_colors[i],
                label=t,
                s=point_size,
                zorder=3,
            )

    ax.set_aspect("equal", adjustable="box")
    ax.set_xticks([])
    ax.set_yticks([])


def render_contour_to_axis(
    ax: plt.Axes,
    floor_plan: FloorPlan,
    disc_result: DiscretizationResult,
    node_assignment: np.ndarray,
    individual: Individual,
    room_df: pd.DataFrame,
    type_map: dict[str, int],
    spline_smoothness: float = 1.5,
    spline_blend_range: float = 0.2,
    spline_points: int = 100,
):
    ax.clear()
    original_polygon = GeometryProcessor._create_combined_polygon(floor_plan)

    # 1. Rasterize & Smooth
    smoothed_labels, gx, gy = _rasterize_and_smooth(
        disc_result, node_assignment, type_map, spline_smoothness
    )

    # 2. Vectorize
    raw_polys_by_type = _extract_contours_to_polygons(
        smoothed_labels, gx, gy, disc_result
    )

    # 3. Clip & Cleanup
    final_render_list = _clean_and_clip_zones(raw_polys_by_type, original_polygon)

    # 4. Render
    x_ext, y_ext = original_polygon.exterior.xy
    ax.fill(x_ext, y_ext, color="whitesmoke", zorder=1)
    ax.plot(x_ext, y_ext, "k-", lw=2, zorder=4)
    ax.set_aspect("equal", adjustable="box")
    ax.set_xticks([])
    ax.set_yticks([])
    ax.set_title(f"Final Layout: {floor_plan.name}")

    _plot_zones_and_annotations(
        ax, final_render_list, original_polygon, room_df, type_map
    )
    _plot_centroids(ax, individual, disc_result, room_df, type_map)


def render_all_floors_grid(
    fig: plt.Figure,
    disc_results: list[DiscretizationResult],
    full_node_assignment: np.ndarray,
    floor_node_ranges: np.ndarray,
    room_df: pd.DataFrame,
    type_map: dict[str, int],
):
    fig.clear()
    num_floors = len(disc_results)
    axs = fig.subplots(1, num_floors, squeeze=False)[0]
    for i in range(num_floors):
        ax = axs[i]
        start, end = floor_node_ranges[i]
        floor_assignment = full_node_assignment[start : end + 1]
        render_grid_to_axis(ax, disc_results[i], floor_assignment, room_df, type_map)
        ax.set_title(f"Floor {i + 1} (Grid)")
    fig.tight_layout()


def render_all_floors_contour(
    fig: plt.Figure,
    plans: list[FloorPlan],
    disc_results: list[DiscretizationResult],
    full_node_assignment: np.ndarray,
    individual: Individual,
    floor_node_ranges: np.ndarray,
    room_df: pd.DataFrame,
    type_map: dict[str, int],
    spline_smoothness: float,
):
    fig.clear()
    num_floors = len(plans)
    axs = fig.subplots(1, num_floors, squeeze=False)[0]
    floor_individuals = [{} for _ in range(num_floors)]
    for type_name, nodes in individual.items():
        for node_idx in nodes:
            floor_idx = (
                np.searchsorted(floor_node_ranges[:, 0], node_idx, side="right") - 1
            )
            start_node = floor_node_ranges[floor_idx, 0]
            local_node_idx = node_idx - start_node
            floor_individuals[floor_idx].setdefault(type_name, []).append(
                local_node_idx
            )
    for i in range(num_floors):
        ax = axs[i]
        start, end = floor_node_ranges[i]
        floor_assignment = full_node_assignment[start : end + 1]
        render_contour_to_axis(
            ax,
            plans[i],
            disc_results[i],
            floor_assignment,
            floor_individuals[i],
            room_df,
            type_map,
            spline_smoothness=spline_smoothness,
        )
    fig.tight_layout()
