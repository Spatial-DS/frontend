# floorplan/geometry.py
import numpy as np
import shapely
from scipy.spatial import cKDTree
from shapely import MultiPolygon, Polygon, prepare, unary_union

from floorplan.data_models import FloorPlan, ScalingInfo, DiscretizationResult

class GeometryProcessor:
    """
    Handles the conversion of continuous FloorPlan geometry into a
    discretized grid representation.
    """

    @staticmethod
    def _create_combined_polygon(plan: FloorPlan) -> Polygon:
        """
        Creates a single Shapely Polygon for the floor by subtracting
        wall polygons from the main boundary.
        """
        boundary_poly = Polygon(plan.boundary)
        if not plan.walls:
            return boundary_poly.buffer(0)

        wall_polys = [Polygon(w) for w in plan.walls]
        walls_union = unary_union(wall_polys)

        if isinstance(walls_union, (Polygon, MultiPolygon)):
            final_polygon = boundary_poly.difference(walls_union)
        else:
            final_polygon = boundary_poly

        return final_polygon.buffer(0)

    @staticmethod
    def discretize(plan: FloorPlan, n: int) -> DiscretizationResult:
        """
        Main method to perform the entire geometry processing and
        discretization pipeline for a single floor.
        """
        original_polygon = GeometryProcessor._create_combined_polygon(plan)

        # 1. Calculate scaling info
        coords = np.array(original_polygon.exterior.coords, dtype=float)
        min_xy, max_xy = coords.min(axis=0), coords.max(axis=0)
        scale = max((max_xy - min_xy).max(), 1e-6)
        scaling_info = ScalingInfo(min_xy=min_xy, scale=scale, n=n)

        # 2. Scale polygon to grid dimensions
        scaled_exterior = scaling_info.to_grid(
            np.array(original_polygon.exterior.coords)
        )
        scaled_interiors = [
            scaling_info.to_grid(np.array(interior.coords))
            for interior in original_polygon.interiors
        ]
        scaled_polygon = Polygon(scaled_exterior, holes=scaled_interiors)

        # 3. Generate grid positions from scaled polygon
        grid_positions = GeometryProcessor._generate_grid_positions(scaled_polygon, n)
        
        # Handle empty grid case gracefully
        if grid_positions.shape[0] == 0:
            print(f"WARNING: No grid points for {plan.name} at n={n}. Using empty grid.")
            grid_positions = np.empty((0, 2))

        tree = cKDTree(grid_positions) if grid_positions.shape[0] > 0 else None

        # 4. Map fixed elements to grid nodes
        fixed_nodes: dict[str, list[int]] = {}
        if tree:
            for type_name, coords_list in plan.fixed_elements.items():
                if coords_list:
                    norm_coords = scaling_info.to_grid(np.array(coords_list))
                    _, indices = tree.query(norm_coords)
                    indices_list = (
                        indices.tolist() if isinstance(indices, np.ndarray) else [indices]
                    )
                    fixed_nodes.setdefault(type_name, []).extend(indices_list)

        # 5. Map connections to grid nodes
        connection_nodes: dict[str, int] = {}
        if tree:
            for conn in plan.connections:
                norm_coord = scaling_info.to_grid(np.array([conn.coord]))
                _, idx = tree.query(norm_coord)
                node_idx = int(idx[0] if isinstance(idx, np.ndarray) else idx)
                connection_nodes[conn.connection_id] = node_idx
                fixed_nodes.setdefault(conn.type_name, []).append(node_idx)

        return DiscretizationResult(
            grid_positions=grid_positions,
            scaled_polygon=scaled_polygon,
            original_polygon=original_polygon,
            fixed_nodes=fixed_nodes,
            connection_nodes=connection_nodes,
            scaling_info=scaling_info,
        )

    @staticmethod
    def _generate_grid_positions(scaled_polygon: Polygon, n: int) -> np.ndarray:
        min_x, min_y, max_x, max_y = [int(np.floor(b)) for b in scaled_polygon.bounds]
        min_x, max_x = max(0, min_x), min(n - 1, int(np.ceil(max_x)))
        min_y, max_y = max(0, min_y), min(n - 1, int(np.ceil(max_y)))
        
        if max_x < min_x or max_y < min_y:
             return np.empty((0, 2))

        x_coords, y_coords = np.arange(min_x, max_x + 1), np.arange(min_y, max_y + 1)
        if len(x_coords) == 0 or len(y_coords) == 0:
            return np.empty((0, 2))
            
        xv, yv = np.meshgrid(x_coords, y_coords)
        candidate_points_centered = np.vstack([xv.ravel() + 0.5, yv.ravel() + 0.5]).T

        prepare(scaled_polygon)
        point_geometries = shapely.points(candidate_points_centered)
        mask = scaled_polygon.contains(point_geometries)

        return candidate_points_centered[mask]
