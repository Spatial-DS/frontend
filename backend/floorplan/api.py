# floorplan/api.py
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

# New import for headless geometry generation
from floorplan.geoemetry_postprocessing import process_layout_to_json
from scipy.spatial import cKDTree

from floorplan.data_models import (
    FloorPlan,
    Individual,
    OptimizationResult,
    RoomData,
)
from floorplan.evaluation import FitnessEvaluator, _propagate_numba
from floorplan.ga import GeneticOptimizer
from floorplan.geometry import DiscretizationResult, GeometryProcessor
from floorplan.graph import GraphBuilder
from floorplan.rules import RuleEngine

# Conditional import for rendering to avoid hard dependency if strictly headless
try:
    from rendering import render_all_floors_contour, render_grid_to_axis

    HAS_RENDERING = True
except ImportError:
    HAS_RENDERING = False


def _normalize_zone_areas(
    selected_zones_df: pd.DataFrame, total_gfa: float
) -> pd.DataFrame:
    """Normalizes area constraints relative to Total GFA."""
    normalized_df = selected_zones_df.copy()
    normalized_df["area"] = pd.to_numeric(normalized_df["area"], errors="coerce")

    if "unit" not in normalized_df.columns:
        normalized_df["area"] = normalized_df["area"] / 100.0
        return normalized_df

    raw_area_mask = normalized_df["unit"] != "percent"
    if total_gfa > 0:
        normalized_df.loc[raw_area_mask, "area"] = (
            normalized_df.loc[raw_area_mask, "area"] / total_gfa
        )
    else:
        normalized_df.loc[raw_area_mask, "area"] = 0

    percent_mask = normalized_df["unit"] == "percent"
    normalized_df.loc[percent_mask, "area"] = (
        normalized_df.loc[percent_mask, "area"] / 100.0
    )
    return normalized_df


def upsample_individual(
    coarse_ind: Individual,
    coarse_disc_results: list[DiscretizationResult],
    fine_disc_results: list[DiscretizationResult],
) -> Individual:
    """Maps an individual from a coarse grid to the equivalent on a fine grid."""
    fine_individual = Individual()

    for type_name, coarse_nodes in coarse_ind.items():
        if not coarse_nodes:
            fine_individual[type_name] = []
            continue

        fine_nodes = []
        for coarse_node_idx in coarse_nodes:
            # Determine floor index
            floor_idx = 0
            offset = 0
            for i, disc in enumerate(coarse_disc_results):
                if coarse_node_idx < offset + len(disc.grid_positions):
                    floor_idx = i
                    break
                offset += len(disc.grid_positions)

            local_coarse_node_idx = coarse_node_idx - offset
            coarse_disc = coarse_disc_results[floor_idx]
            fine_disc = fine_disc_results[floor_idx]

            # Coordinate mapping
            coarse_coord = coarse_disc.grid_positions[local_coarse_node_idx]
            real_coord = coarse_disc.scaling_info.to_real(coarse_coord)
            target_fine_coord = fine_disc.scaling_info.to_grid(real_coord)

            fine_tree = cKDTree(fine_disc.grid_positions)
            _, fine_node_idx = fine_tree.query(target_fine_coord)

            # Add global offset
            fine_offset = sum(
                len(fd.grid_positions) for fd in fine_disc_results[:floor_idx]
            )
            fine_nodes.append(int(fine_node_idx) + fine_offset)

        fine_individual[type_name] = fine_nodes

    return fine_individual


def _run_optimization_stage(
    plans: list[FloorPlan],
    room_data: RoomData,
    target_node_count: int,
    total_gfa: float = 100,
    pop_size: int = 50,
    generations: int = 100,
    cxpb: float = 0.6,
    mutpb: float = 0.4,
    swap_pb: float = 0.1,
    dup_pb: float = 0.05,
    prune_pb: float = 0.05,
    tournsize: int = 3,
    stagnation_limit: int = 15,
    w_area: float = 1.0,
    w_adj: float = 1.0,
    random_walk_decay: float = 0.05,
    random_walk_scale: float = 10.0,
    use_local_search: bool = True,
    num_layouts: int = 3,
    text_prompt: str | None = None,
    # Visualization / Interactive flags
    interactive: bool = False,
    show_progress: bool = True,
    render_every: int = 5,
    initial_population: list[Individual] | None = None,
) -> tuple[list[OptimizationResult], list[DiscretizationResult]]:
    """
    Runs a single stage of the genetic optimization.
    """
    # --- 1. Geometry Discretization ---
    floor_disc_results: list[DiscretizationResult] = []
    for plan in plans:
        temp_poly = GeometryProcessor._create_combined_polygon(plan)
        if temp_poly.is_empty:
            raise ValueError(f"Polygon for floor '{plan.name}' is empty.")

        area_per_node = temp_poly.area / target_node_count
        grid_spacing = np.sqrt(area_per_node)
        minx, miny, maxx, maxy = temp_poly.bounds
        width, height = maxx - minx, maxy - miny
        nx = int(np.ceil(width / grid_spacing))
        ny = int(np.ceil(height / grid_spacing))
        effective_n = max(nx, ny, 1)

        floor_disc_results.append(GeometryProcessor.discretize(plan, n=effective_n))

    # --- 2. Rule Processing ---
    normalized_zones_df = (
        _normalize_zone_areas(room_data.selected_zones_df, total_gfa)
        if room_data.selected_zones_df is not None
        else None
    )

    rule_engine = RuleEngine()
    final_rules_df, dynamic_rules = rule_engine.parse_text(text_prompt or "", room_data)
    final_room_data = RoomData(room_data.room_df, final_rules_df, normalized_zones_df)

    # --- 3. Graph Construction ---
    floor_graphs, floor_connections, all_fixed_nodes = [], [], {}
    node_offset = 0
    for disc_result in floor_disc_results:
        graph = GraphBuilder.build_for_single_floor(disc_result)
        floor_graphs.append(graph)
        floor_connections.append(disc_result.connection_nodes)
        for type_name, nodes in disc_result.fixed_nodes.items():
            all_fixed_nodes.setdefault(type_name, []).extend(
                [n + node_offset for n in nodes]
            )
        node_offset += graph.n_nodes
    master_graph = GraphBuilder.stitch_graphs(floor_graphs, floor_connections)

    # --- 4. Evaluator Setup ---
    evaluator = FitnessEvaluator(
        graph=master_graph,
        room_data=final_room_data,
        fixed_nodes=all_fixed_nodes,
        dynamic_rules=dynamic_rules,
        w_area=w_area,
        w_adj=w_adj,
    )

    # --- 5. Optimization Loop ---
    optimizer = GeneticOptimizer(
        pop_size=pop_size,
        generations=generations,
        cxpb=cxpb,
        mutpb=mutpb,
        swap_pb=swap_pb,
        dup_pb=dup_pb,
        prune_pb=prune_pb,
        tournsize=tournsize,
        stagnation_limit=stagnation_limit,
        random_walk_decay=random_walk_decay,
        random_walk_scale=random_walk_scale,
    )

    # Visualization Setup (Only if interactive)
    fig, ax = (None, None)
    if interactive and show_progress and HAS_RENDERING:
        fig, ax = plt.subplots(figsize=(10, 10))
        plt.ion()

    def progress_callback(gen, total_gen, fitness, best_ind):
        # In headless mode, we might just log or pass
        if gen % render_every == 0:
            if interactive and fig and ax:
                optimizer._evaluate_with_cache(best_ind)
                node_assignment = evaluator.last_node_assignment
                if node_assignment is not None:
                    start, end = master_graph.floor_node_ranges[0]
                    floor_assignment = node_assignment[start : end + 1]
                    render_grid_to_axis(
                        ax,
                        floor_disc_results[0],
                        floor_assignment,
                        final_room_data.room_df,
                        evaluator.type_map,
                    )
                    ax.set_title(f"Gen {gen} | Fitness: {fitness:.2f}")
                    fig.canvas.draw_idle()
                    plt.pause(0.01)
            elif show_progress:
                print(
                    f"  Stage Progress: Gen {gen}/{total_gen} | Fitness {fitness:.2f}"
                )

    hall_of_fame = optimizer.run(
        graph=master_graph,
        evaluator=evaluator,
        num_layouts=num_layouts,
        progress_callback=progress_callback,
        initial_population=initial_population,
        use_local_search=use_local_search,
    )

    # Close interactive plot
    if fig:
        plt.close(fig)

    # --- 6. Results Generation ---
    results: list[OptimizationResult] = []

    for i, ind in enumerate(hall_of_fame):
        # A. Propagate Centroids to Full Grid
        initial_centroids = np.array(
            [
                [node, evaluator.type_map[t]]
                for t, nodes in ind.items()
                for node in nodes
                if t in evaluator.type_map
            ],
            dtype=np.int32,
        )
        final_assignment = _propagate_numba(
            initial_centroids,
            evaluator.target_counts,
            master_graph.adj_indices,
            master_graph.adj_indptr,
            master_graph.n_nodes,
            evaluator.n_types,
        )

        # B. Calculate Area Stats
        counts = np.bincount(final_assignment, minlength=evaluator.n_types)
        proportions = counts / max(master_graph.n_nodes, 1)
        area_df = pd.DataFrame(
            {
                "Zone": evaluator.type_names,
                "Proportion": proportions,
                "Calculated GFA": proportions * total_gfa,
            }
        )

        # C. Generate Output (Polygons vs SVG)
        floor_layouts = []
        svg_render = None

        if not interactive:
            # HEADLESS MODE: Generate JSON Polygons
            floor_layouts = process_layout_to_json(
                plans=plans,
                disc_results=floor_disc_results,
                full_node_assignment=final_assignment,
                floor_node_ranges=master_graph.floor_node_ranges,
                type_names=evaluator.type_names,
            )
        elif HAS_RENDERING:
            # INTERACTIVE MODE: Generate SVG (Legacy support)
            import io

            # 1. Map global nodes back to floor-local indices for rendering centroids
            floor_individuals = [{} for _ in range(len(plans))]
            for type_name, nodes in ind.items():
                for node_idx in nodes:
                    # Find which floor range this node falls into
                    floor_idx = (
                        np.searchsorted(
                            master_graph.floor_node_ranges[:, 0], node_idx, side="right"
                        )
                        - 1
                    )
                    start_node = master_graph.floor_node_ranges[floor_idx, 0]
                    local_node_idx = node_idx - start_node
                    floor_individuals[floor_idx].setdefault(type_name, []).append(
                        local_node_idx
                    )

            # 2. Render each floor to a temporary figure and save to buffer
            svg_renders_per_floor = []
            for floor_idx, plan in enumerate(plans):
                start, end = master_graph.floor_node_ranges[floor_idx]
                floor_assignment = final_assignment[start : end + 1]

                fig_render, ax_render = plt.subplots(figsize=(12, 12))

                # Use default smoothness if variable is not passed in kwargs
                smoothness = locals().get("spline_smoothness", 1.5)

                render_contour_to_axis(
                    ax_render,
                    plan,
                    floor_disc_results[floor_idx],
                    floor_assignment,
                    floor_individuals[floor_idx],
                    final_room_data.room_df,
                    evaluator.type_map,
                    spline_smoothness=smoothness,
                )

                svg_buffer = io.StringIO()
                fig_render.savefig(svg_buffer, format="svg", bbox_inches="tight")
                plt.close(fig_render)
                svg_renders_per_floor.append(svg_buffer.getvalue())

            svg_render = "".join(svg_renders_per_floor)

        results.append(
            OptimizationResult(
                individual=ind,
                svg_render=svg_render,
                floor_layouts=floor_layouts,
                area_distribution=area_df,
                fitness=ind.fitness.values[0],
            )
        )

    return results, floor_disc_results


def run_multi_resolution_optimization(
    plans: list[FloorPlan],
    room_data: RoomData,
    target_node_counts: list[int],
    generations: list[int],
    pop_sizes: list[int],
    total_gfa: float,
    text_prompt: str | None = None,
    interactive: bool = False,
    show_progress: bool = True,
    **kwargs,
) -> list[OptimizationResult] | None:
    """
    Orchestrates the multi-resolution optimization strategy.
    """
    top_individuals = None
    coarse_disc_results = None
    final_results = None

    for i, target_nodes in enumerate(target_node_counts):
        print(f"\n--- Stage {i + 1}: Target Nodes ~{target_nodes} ---")

        # Determine current config
        current_gen = generations[i] if i < len(generations) else generations[-1]
        current_pop = pop_sizes[i] if i < len(pop_sizes) else pop_sizes[-1]

        # Upsampling logic
        seed_population = None
        if top_individuals and coarse_disc_results:
            # Dry run to get fine discretization for upsampling
            fine_disc_dry_run: list[DiscretizationResult] = []
            for plan in plans:
                temp_poly = GeometryProcessor._create_combined_polygon(plan)
                area_per_node = temp_poly.area / target_nodes
                grid_spacing = np.sqrt(area_per_node)
                minx, miny, maxx, maxy = temp_poly.bounds
                width, height = maxx - minx, maxy - miny
                nx = int(np.ceil(width / grid_spacing))
                ny = int(np.ceil(height / grid_spacing))
                effective_n = max(nx, ny, 1)
                fine_disc_dry_run.append(
                    GeometryProcessor.discretize(plan, n=effective_n)
                )

            seed_population = [
                upsample_individual(ind, coarse_disc_results, fine_disc_dry_run)
                for ind in top_individuals
            ]

        results, disc_results = _run_optimization_stage(
            plans=plans,
            room_data=room_data,
            target_node_count=target_nodes,
            generations=current_gen,
            pop_size=current_pop,
            total_gfa=total_gfa,
            text_prompt=text_prompt,
            initial_population=seed_population,
            interactive=interactive,
            show_progress=show_progress,
            **kwargs,
        )

        final_results = results
        top_individuals = [res.individual for res in results]
        coarse_disc_results = disc_results

    if interactive and final_results and HAS_RENDERING:
        print("Rendering final interactive plot...")
        # 1. Rebuild Master Graph
        floor_graphs = []
        floor_connections = []
        all_fixed_nodes = {}
        node_offset = 0

        for disc_result in coarse_disc_results:
            graph = GraphBuilder.build_for_single_floor(disc_result)
            floor_graphs.append(graph)
            floor_connections.append(disc_result.connection_nodes)
            for type_name, nodes in disc_result.fixed_nodes.items():
                all_fixed_nodes.setdefault(type_name, []).extend(
                    [n + node_offset for n in nodes]
                )
            node_offset += graph.n_nodes

        master_graph = GraphBuilder.stitch_graphs(floor_graphs, floor_connections)

        # 2. Rebuild Room Data (Apply normalization and rules)
        normalized_zones_df = (
            _normalize_zone_areas(room_data.selected_zones_df, total_gfa)
            if room_data.selected_zones_df is not None
            else None
        )
        rule_engine = RuleEngine()
        final_rules_df, dynamic_rules = rule_engine.parse_text(
            text_prompt or "", room_data
        )
        final_room_data = RoomData(
            room_data.room_df, final_rules_df, normalized_zones_df
        )

        # 3. Rebuild Evaluator
        evaluator = FitnessEvaluator(
            graph=master_graph,
            room_data=final_room_data,
            fixed_nodes=all_fixed_nodes,
            dynamic_rules=dynamic_rules,
            w_area=kwargs.get("w_area", 1.0),
            w_adj=kwargs.get("w_adj", 1.0),
        )

        # 4. Propagate the Best Individual to get full node assignments
        best_ind = final_results[0].individual
        initial_centroids = np.array(
            [
                [node, evaluator.type_map[t]]
                for t, nodes in best_ind.items()
                for node in nodes
                if t in evaluator.type_map
            ],
            dtype=np.int32,
        )
        final_assignment = _propagate_numba(
            initial_centroids,
            evaluator.target_counts,
            master_graph.adj_indices,
            master_graph.adj_indptr,
            master_graph.n_nodes,
            evaluator.n_types,
        )

        # 5. Render
        fig_final, _ = plt.subplots(figsize=(5 * len(plans), 5))
        render_all_floors_contour(
            fig_final,
            plans,
            coarse_disc_results,
            final_assignment,
            best_ind,
            master_graph.floor_node_ranges,
            final_room_data.room_df,
            evaluator.type_map,
            spline_smoothness=kwargs.get("spline_smoothness", 1.5),
        )
        plt.show()

    return final_results
