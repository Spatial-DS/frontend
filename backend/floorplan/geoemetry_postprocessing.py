# floorplan/geometry_postprocessing.py
import matplotlib.pyplot as plt
import numpy as np
from scipy.interpolate import griddata
from scipy.ndimage import gaussian_filter
from shapely.geometry import MultiPolygon, Polygon
from shapely.ops import unary_union

from floorplan.data_models import (
    DiscretizationResult,
    FloorLayout,
    FloorPlan,
    ZonePolygon,
)
from floorplan.geometry import GeometryProcessor

# --- 1. Coordinate Transformation Helpers ---


def _transform_poly_coords_manual(
    poly: Polygon, disc_result: DiscretizationResult
) -> Polygon:
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


def _shapely_to_nested_list(geom) -> list[list[float]]:
    """Converts a Shapely Polygon (exterior only) to the list-of-lists format."""
    if geom.is_empty:
        return []

    # Handle MultiPolygons by taking the largest component (simplified for frontend)
    # or returning the exterior of the simple Polygon.
    if isinstance(geom, MultiPolygon):
        if not geom.geoms:
            return []
        # Return the largest polygon by area
        largest = max(geom.geoms, key=lambda p: p.area)
        coords = list(largest.exterior.coords)
    else:
        coords = list(geom.exterior.coords)

    # Convert tuples to lists for JSON serialization
    return [[float(x), float(y)] for x, y in coords]


# --- 2. Rasterization & Vectorization Logic ---


def _rasterize_and_smooth(
    disc_result: DiscretizationResult, node_assignment: np.ndarray, smoothness: float
):
    """
    Converts discrete node points into a high-res smoothed label map.
    """
    n = disc_result.scaling_info.n
    upscale = 8
    res = int(n * upscale)

    gx = np.linspace(0, n, res)
    gy = np.linspace(0, n, res)
    grid_x_mesh, grid_y_mesh = np.meshgrid(gx, gy)

    # 1. Base Grid Interpolation
    try:
        label_map = griddata(
            points=disc_result.grid_positions,
            values=node_assignment,
            xi=(grid_x_mesh, grid_y_mesh),
            method="nearest",
        )
    except Exception as e:
        # Fallback for empty or malformed grids
        return np.zeros((res, res)), gx, gy

    # 2. Gaussian Smoothing
    unique_types = np.unique(node_assignment)
    smoothed_labels = np.zeros_like(label_map)
    max_probs = -np.ones_like(label_map, dtype=float)

    # Tuning sigma for tighter boundaries
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


def _extract_contours_to_polygons(
    label_map: np.ndarray,
    gx: np.ndarray,
    gy: np.ndarray,
    disc_result: DiscretizationResult,
) -> dict[int, Polygon | MultiPolygon]:
    """
    Converts raster labels to Vector Polygons using matplotlib's contour engine.
    Does not render to screen.
    """
    unique_types = np.unique(label_map)
    polys_by_type = {}

    # Create a non-interactive figure for contour calculation
    fig = plt.figure(figsize=(1, 1))

    def pad_grid(mask, x, y):
        padded_mask = np.pad(mask, 1, mode="constant", constant_values=0)
        dx = x[1] - x[0]
        dy = y[1] - y[0]
        x_new = np.r_[x[0] - dx, x, x[-1] + dx]
        y_new = np.r_[y[0] - dy, y, y[-1] + dy]
        return padded_mask, x_new, y_new

    antialias_sigma = 2.0

    for t_idx in unique_types:
        if t_idx == -1:
            continue

        mask = (label_map == t_idx).astype(float)
        mask = gaussian_filter(mask, sigma=antialias_sigma, mode="nearest")
        p_mask, p_gx, p_gy = pad_grid(mask, gx, gy)

        # Use contour generation
        contours = plt.contour(p_gx, p_gy, p_mask, levels=[0.3])

        polys_for_this_type = []
        if contours.allsegs:
            for coord_array in contours.allsegs[0]:
                if len(coord_array) < 3:
                    continue
                p = Polygon(coord_array)
                if not p.is_valid:
                    p = p.buffer(0)
                # Simplify and buffer
                p = p.simplify(0.05, preserve_topology=True)
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

    plt.close(fig)  # Clean up memory
    return polys_by_type


def _clean_and_clip_zones(
    polys_by_type: dict[int, Polygon], floor_poly: Polygon
) -> list[dict]:
    """Clips polygons to floor plan boundary."""
    final_list = []
    floor_safe = floor_poly.buffer(0)

    for t_idx, geom in polys_by_type.items():
        try:
            clipped = geom.intersection(floor_safe)
        except:
            clipped = geom.buffer(0).intersection(floor_safe)

        if clipped.is_empty:
            continue

        # Keep only significant areas
        if isinstance(clipped, Polygon):
            if clipped.area > 0.1:
                final_list.append({"poly": clipped, "type_idx": t_idx})
        elif hasattr(clipped, "geoms"):
            for p in clipped.geoms:
                if isinstance(p, Polygon) and p.area > 0.1:
                    final_list.append({"poly": p, "type_idx": t_idx})

    return final_list


# --- 3. Public API for API.py ---


def process_layout_to_json(
    plans: list[FloorPlan],
    disc_results: list[DiscretizationResult],
    full_node_assignment: np.ndarray,
    floor_node_ranges: np.ndarray,
    type_names: list[str],
    spline_smoothness: float = 1.5,
) -> list[FloorLayout]:
    """
    Main entry point to convert optimization results into JSON-ready structures.
    Does NOT use room colors or text labels; purely geometric.
    """
    results_json = []

    for i, plan in enumerate(plans):
        # 1. Setup Data for this floor
        start, end = floor_node_ranges[i]
        floor_assignment = full_node_assignment[start : end + 1]
        disc_result = disc_results[i]
        original_polygon = GeometryProcessor._create_combined_polygon(plan)

        # 2. Rasterize & Vectorize
        smoothed_labels, gx, gy = _rasterize_and_smooth(
            disc_result, floor_assignment, spline_smoothness
        )

        raw_polys_by_type = _extract_contours_to_polygons(
            smoothed_labels, gx, gy, disc_result
        )

        # 3. Clip
        clipped_data = _clean_and_clip_zones(raw_polys_by_type, original_polygon)

        # 4. Format for JSON
        zone_polys = []
        for item in clipped_data:
            t_idx = item["type_idx"]
            poly = item["poly"]

            # Map index back to string short code (e.g., 'ent')
            type_code = type_names[t_idx] if 0 <= t_idx < len(type_names) else "unknown"

            zone_polys.append(
                ZonePolygon(type=type_code, polygon=_shapely_to_nested_list(poly))
            )

        results_json.append(FloorLayout(floor_name=plan.name, zones=zone_polys))

    return results_json
