# floorplan/api.py
from typing import Callable

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from scipy.spatial import cKDTree

from floorplan.data_models import (
    DiscretizationResult,
    FloorPlan,
    Individual,
    OptimizationResult,
    RoomData,
)
from floorplan.evaluation import FitnessEvaluator, _propagate_numba
from floorplan.ga import GeneticOptimizer

# New import for headless geometry generation
from floorplan.geoemetry_postprocessing import process_layout_to_json
from floorplan.geometry import GeometryProcessor
from floorplan.graph import GraphBuilder

try:
    from floorplan.rendering import (
        render_all_floors_contour,
        render_contour_to_axis,
        render_grid_to_axis,
    )

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
    dynamic_rules: dict | None = None,
    interactive: bool = False,
    show_progress: bool = True,
    render_every: int = 5,
    initial_population: list[Individual] | None = None,
    external_progress_callback: Callable | None = None,
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

        normalized_zones_df = (
            _normalize_zone_areas(room_data.selected_zones_df, total_gfa)
            if room_data.selected_zones_df is not None
            else None
        )

    # Reconstruct room data with normalized areas, keeping the adjacency rules intact
    final_room_data = RoomData(
        room_data.room_df, room_data.rules_df, normalized_zones_df
    )

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
        dynamic_rules=dynamic_rules if dynamic_rules else {},
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

    fig, ax = (None, None)
    if interactive and show_progress and HAS_RENDERING:
        fig, ax = plt.subplots(figsize=(10, 10))
        plt.ion()

    def progress_callback(gen, total_gen, fitness, best_ind):
        # 1. Report to External (Worker/DB)
        if external_progress_callback:
            external_progress_callback(gen)

        # 2. Existing Interactive/Print Logic
        if gen % render_every == 0:
            if interactive and fig and ax:
                # ... rendering logic ...
                pass
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

    if fig:
        plt.close(fig)

    # --- 6. Results Generation ---
    results: list[OptimizationResult] = []

    for i, ind in enumerate(hall_of_fame):
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

        counts = np.bincount(final_assignment, minlength=evaluator.n_types)
        proportions = counts / max(master_graph.n_nodes, 1)
        area_df = pd.DataFrame(
            {
                "Zone": evaluator.type_names,
                "Proportion": proportions,
                "Calculated GFA": proportions * total_gfa,
            }
        )

        floor_layouts = []
        svg_render = None

        if not interactive:
            # HEADLESS MODE
            floor_layouts = process_layout_to_json(
                plans=plans,
                disc_results=floor_disc_results,
                full_node_assignment=final_assignment,
                floor_node_ranges=master_graph.floor_node_ranges,
                type_names=evaluator.type_names,
            )
        elif HAS_RENDERING:
            # INTERACTIVE LEGACY SVG LOGIC
            import io

            floor_individuals = [{} for _ in range(len(plans))]
            for type_name, nodes in ind.items():
                for node_idx in nodes:
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

            svg_renders_per_floor = []
            for floor_idx, plan in enumerate(plans):
                start, end = master_graph.floor_node_ranges[floor_idx]
                floor_assignment = final_assignment[start : end + 1]
                fig_render, ax_render = plt.subplots(figsize=(12, 12))
                render_contour_to_axis(
                    ax_render,
                    plan,
                    floor_disc_results[floor_idx],
                    floor_assignment,
                    floor_individuals[floor_idx],
                    final_room_data.room_df,
                    evaluator.type_map,
                    spline_smoothness=1.5,
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
    num_layouts: int = 3,  # Requested variations
    dynamic_rules: dict | None = None,
    interactive: bool = False,
    show_progress: bool = True,
    progress_callback: Callable = None,
    **kwargs,
) -> list[OptimizationResult] | None:
    """
    Orchestrates the multi-resolution optimization strategy with BRANCHING.
    """

    # --- 0. Calculate Total Work for Progress Bar ---
    # Stage 1 runs once.
    # Subsequent stages run 'num_layouts' times (branching).
    total_generations_expected = generations[0]
    if len(generations) > 1:
        # Sum of remaining generations * number of branches
        remaining_gens = sum(generations[1:])
        total_generations_expected += remaining_gens * num_layouts

    current_global_gen = 0

    def report_stage_progress(gen_in_stage):
        """Helper to normalize progress 0.0 -> 1.0"""
        if progress_callback and total_generations_expected > 0:
            p = (current_global_gen + gen_in_stage) / total_generations_expected
            progress_callback(min(p, 1.0))

    # 1. Run STAGE 1 (Coarse) to find distinct topological starting points
    print(f"\n--- Stage 1: Coarse Topology Search (~{target_node_counts[0]} nodes) ---")

    # Use the first generation setting
    gen_0 = generations[0]
    pop_0 = pop_sizes[0]

    results_stage_1, disc_results_1 = _run_optimization_stage(
        plans=plans,
        room_data=room_data,
        target_node_count=target_node_counts[0],
        generations=gen_0,
        pop_size=pop_0,
        total_gfa=total_gfa,
        num_layouts=num_layouts,  # Get k distinct layouts here
        dynamic_rules=dynamic_rules,
        interactive=interactive,
        show_progress=show_progress,
        external_progress_callback=report_stage_progress,
        **kwargs,
    )

    current_global_gen += generations[0]

    if len(target_node_counts) == 1:
        if progress_callback:
            progress_callback(1.0)
        return results_stage_1

    # 2. Branching
    final_branch_results = []
    print(
        f"\n--- Branching: Refining {len(results_stage_1)} distinct variations independently ---"
    )

    for idx, coarse_result in enumerate(results_stage_1):
        print(f"\n[Variation {idx + 1}] Refinement chain...")

        current_individual = coarse_result.individual
        current_disc = disc_results_1

        for i in range(1, len(target_node_counts)):
            target_nodes = target_node_counts[i]
            # Handle cases where generations list might be shorter than node counts list
            current_gen = generations[i] if i < len(generations) else generations[-1]
            current_pop = pop_sizes[i] if i < len(pop_sizes) else pop_sizes[-1]

            print(f"  - Stage {i + 1}: Upsampling to ~{target_nodes} nodes")

            # Upsample logic (omitted for brevity, same as before)
            fine_disc_dry_run = []  # ... (geometry code) ...
            for plan in plans:
                # ... (geometry creation same as existing code) ...
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

            seed_pop = [
                upsample_individual(current_individual, current_disc, fine_disc_dry_run)
            ]

            results, disc = _run_optimization_stage(
                plans=plans,
                room_data=room_data,
                target_node_count=target_nodes,
                generations=current_gen,
                pop_size=current_pop,
                total_gfa=total_gfa,
                num_layouts=1,
                dynamic_rules=dynamic_rules,
                initial_population=seed_pop,
                interactive=interactive,
                show_progress=False,
                external_progress_callback=report_stage_progress,  # Pass hook
                **kwargs,
            )

            current_individual = results[0].individual
            current_disc = disc

            # Update global counter after this specific stage branch completes
            current_global_gen += current_gen

            if i == len(target_node_counts) - 1:
                final_branch_results.append(results[0])

    if progress_callback:
        progress_callback(1.0)
    return final_branch_results
