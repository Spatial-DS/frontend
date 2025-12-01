import numba
import numpy as np
import pandas as pd
from numba import types as numba_types
from numba.typed import List as NumbaTypedList

from floorplan.data_models import DiscretizedGraph, Individual, RoomData


@numba.jit(nopython=True, fastmath=True)
def _propagate_numba(
    initial_centroids: np.ndarray,
    target_counts: np.ndarray,
    adj_indices: np.ndarray,
    adj_indptr: np.ndarray,
    n_nodes: int,
    n_types: int,
) -> np.ndarray:
    """
    Expands from initial centroids to assign a type to every node in the graph.
    (Moved from original polygon_graph.py)
    """
    node_assignments = np.full(n_nodes, -1, dtype=np.int32)
    current_counts = np.zeros(n_types, dtype=np.int32)
    MIN_PRIORITY_FLOOR = 1e-6
    wavefront = NumbaTypedList.empty_list(numba_types.int32)

    for i in range(initial_centroids.shape[0]):
        node_idx, type_idx = initial_centroids[i, 0], initial_centroids[i, 1]
        if node_assignments[node_idx] == -1:
            node_assignments[node_idx] = type_idx
            current_counts[type_idx] += 1
            wavefront.append(node_idx)

    next_wavefront = NumbaTypedList.empty_list(numba_types.int32)
    while len(wavefront) > 0:
        best_cost_for_target = np.full(n_nodes, np.inf, dtype=np.float32)
        winner_type_for_target = np.full(n_nodes, -1, dtype=np.int32)
        for source_node in wavefront:
            source_type = node_assignments[source_node]
            target_count = target_counts[source_type]
            if current_counts[source_type] >= target_count:
                priority = MIN_PRIORITY_FLOOR
            else:
                rem_pct = (target_count - current_counts[source_type]) / target_count
                priority = rem_pct + MIN_PRIORITY_FLOOR

            cost = 1.0 - priority
            start, end = adj_indptr[source_node], adj_indptr[source_node + 1]
            for i in range(start, end):
                target_node = adj_indices[i]
                if node_assignments[target_node] == -1:
                    if cost < best_cost_for_target[target_node]:
                        best_cost_for_target[target_node] = cost
                        winner_type_for_target[target_node] = source_type

        next_wavefront.clear()
        for i in range(n_nodes):
            target_node = np.int32(i)
            winner_type = winner_type_for_target[target_node]
            if winner_type != -1:
                node_assignments[target_node] = winner_type
                current_counts[winner_type] += 1
                next_wavefront.append(target_node)
        wavefront, next_wavefront = next_wavefront, wavefront
    return node_assignments


@numba.jit(nopython=True, fastmath=True)
def _calculate_penalties_numba(
    node_assignment: np.ndarray,
    edges_u: np.ndarray,
    edges_v: np.ndarray,
    rules_matrix: np.ndarray,
    target_counts: np.ndarray,
    compactness_rules: np.ndarray,
    per_floor_rules: np.ndarray,
    floor_node_ranges: np.ndarray,
    w_area: float,
    w_adj: float,
) -> float:
    """Calculates all penalties in a single, fast Numba loop."""
    n_types = target_counts.shape[0]

    counts = np.zeros(n_types, dtype=np.int32)
    for i in range(node_assignment.shape[0]):
        type_idx = node_assignment[i]
        if type_idx != -1:
            counts[type_idx] += 1
    area_penalty = 0.0
    for i in range(n_types):
        area_penalty += (counts[i] - target_counts[i]) ** 2

    adj_penalty = 0.0
    compactness_reward = 0.0
    for i in range(edges_u.shape[0]):
        u, v = edges_u[i], edges_v[i]
        type_u, type_v = node_assignment[u], node_assignment[v]
        if type_u != -1 and type_v != -1:
            if type_u == type_v:
                for j in range(compactness_rules.shape[0]):
                    if type_u == compactness_rules[j, 0]:
                        compactness_reward += compactness_rules[j, 1]
                        break
            else:
                adj_penalty += rules_matrix[type_u, type_v]

    count_penalty = 0.0
    if per_floor_rules.shape[0] > 0:
        num_floors = floor_node_ranges.shape[0]
        counts_per_floor = np.zeros((num_floors, n_types), dtype=np.int32)
        for i in range(node_assignment.shape[0]):
            node_type = node_assignment[i]
            if node_type != -1:
                for floor_idx in range(num_floors):
                    if (
                        floor_node_ranges[floor_idx, 0]
                        <= i
                        <= floor_node_ranges[floor_idx, 1]
                    ):
                        counts_per_floor[floor_idx, node_type] += 1
                        break
        for i in range(per_floor_rules.shape[0]):
            type_idx = np.int32(per_floor_rules[i, 0])
            target = np.int32(per_floor_rules[i, 1])
            weight = per_floor_rules[i, 2]
            for floor_idx in range(num_floors):
                actual = counts_per_floor[floor_idx, type_idx]
                zone_exists = 1 if actual > 0 else 0
                count_penalty += weight * (zone_exists - target) ** 2

    return (
        (w_area * area_penalty)
        + (w_adj * adj_penalty)
        - compactness_reward
        + count_penalty
    )


class FitnessEvaluator:
    """
    Pre-processes optimization data and orchestrates calls to Numba kernels
    to evaluate the fitness of an individual.
    """

    def __init__(
        self,
        graph: DiscretizedGraph,
        room_data: RoomData,
        fixed_nodes: dict[str, list[int]],
        dynamic_rules: dict,
        w_area: float = 1.0,
        w_adj: float = 1.0,
    ):
        self.graph = graph
        self.w_area = w_area
        self.w_adj = w_adj
        self.fixed_nodes = fixed_nodes
        self.last_node_assignment: np.ndarray | None = None

        active_room_df = self._prepare_room_df(
            room_data.room_df, room_data.selected_zones_df
        )
        self.type_names = active_room_df["short"].tolist()
        self.type_map = {name: i for i, name in enumerate(self.type_names)}
        self.n_types = len(self.type_names)

        self.target_counts = self._calculate_target_counts(
            active_room_df, graph.n_nodes
        )

        rules_filled = room_data.rules_df.loc[self.type_names, self.type_names].fillna(
            0
        )
        symmetric_df = rules_filled + rules_filled.T
        np.fill_diagonal(symmetric_df.values, np.diag(rules_filled.values))
        self.rules_matrix = np.ascontiguousarray(symmetric_df.values, dtype=np.float64)

        self.compactness_rules = self._prepare_compactness_rules(
            dynamic_rules.get("compactness", [])
        )
        self.per_floor_rules = self._prepare_per_floor_rules(
            dynamic_rules.get("count_per_floor", [])
        )

    def _prepare_per_floor_rules(self, rules: list[dict]) -> np.ndarray:
        """Converts per-floor count rules to a Numba-compatible NumPy array."""
        if not rules:
            return np.empty((0, 3), dtype=np.float64)
        rule_list = []
        for rule in rules:
            type_name, target, weight = (
                rule.get("zone"),
                rule.get("target"),
                rule.get("weight", 1.0),
            )
            if type_name in self.type_map:
                type_idx = self.type_map[type_name]
                rule_list.append([type_idx, target, weight])
        return np.array(rule_list, dtype=np.float64)

    def _prepare_room_df(
        self,
        base_df: pd.DataFrame,
        selected_df: pd.DataFrame | None,
    ) -> pd.DataFrame:
        """Filters and merges room data based on the selected zones."""
        if selected_df is None or selected_df.empty:
            return base_df.copy()

        # Filter base_df to only include zones in selected_df
        active_df = base_df[base_df["short"].isin(selected_df["short"])].copy()

        # Update area from selected_df
        area_map = selected_df.set_index("short")["area"]
        active_df["area"] = active_df["short"].map(area_map)

        return active_df.reset_index(drop=True)

    def _calculate_target_counts(
        self, room_df: pd.DataFrame, n_nodes: int
    ) -> np.ndarray:
        """
        Calculates the target node count for each room type, ensuring a
        minimum of 1 for every active zone.
        """
        areas = room_df["area"].to_numpy(na_value=np.nan)

        nan_mask = np.isnan(areas)
        if np.any(nan_mask):
            defined_area_sum = np.nansum(areas)
            unassigned_share = max(0.0, 1.0 - defined_area_sum)
            num_unassigned = np.sum(nan_mask)
            areas[nan_mask] = (
                unassigned_share / num_unassigned if num_unassigned > 0 else 0
            )

        total_proportion = np.sum(areas)
        if total_proportion > 1e-6:
            normalized_areas = areas / total_proportion
        else:
            num_types = len(areas)
            normalized_areas = (
                np.full(num_types, 1.0 / num_types) if num_types > 0 else areas
            )

        num_zones = len(normalized_areas)
        if n_nodes < num_zones:
            target_counts = np.zeros(num_zones, dtype=int)
            top_indices = np.argsort(normalized_areas)[-n_nodes:]
            target_counts[top_indices] = 1
            return target_counts

        target_counts = np.ones(num_zones, dtype=int)

        remaining_nodes = n_nodes - num_zones

        if remaining_nodes > 0:
            remainder_proportions = normalized_areas

            additional_nodes_float = remainder_proportions * remaining_nodes

            additional_nodes = np.floor(additional_nodes_float).astype(int)
            remainder_decimals = additional_nodes_float - additional_nodes
            deficit = remaining_nodes - np.sum(additional_nodes)

            if deficit > 0:
                indices_to_increment = np.argsort(remainder_decimals)[-deficit:]
                additional_nodes[indices_to_increment] += 1

            target_counts += additional_nodes

        return target_counts

    def _prepare_compactness_rules(self, rules: list[dict]) -> np.ndarray:
        """Converts a list of rule dicts to a Numba-compatible NumPy array."""
        if not rules:
            return np.empty((0, 2), dtype=np.float64)

        rule_list = []
        for rule in rules:
            type_name = rule.get("zone")
            weight = rule.get("weight", 1.0)
            if type_name in self.type_map:
                type_idx = self.type_map[type_name]
                rule_list.append([type_idx, weight])

        return np.array(rule_list, dtype=np.float64)

    def evaluate(self, individual: Individual) -> tuple[float]:
        """
        The main evaluation function called by the genetic algorithm.
        """

        initial_centroids_list = []
        for type_name, centroids in individual.items():
            if type_name in self.type_map:
                type_idx = self.type_map[type_name]
                for node_idx in centroids:
                    initial_centroids_list.append([node_idx, type_idx])

        initial_centroids = np.array(initial_centroids_list, dtype=np.int32)

        node_assignment = _propagate_numba(
            initial_centroids=initial_centroids,
            target_counts=self.target_counts,
            adj_indices=self.graph.adj_indices,
            adj_indptr=self.graph.adj_indptr,
            n_nodes=self.graph.n_nodes,
            n_types=self.n_types,
        )

        self.last_node_assignment = node_assignment

        penalty = _calculate_penalties_numba(
            node_assignment=node_assignment,
            edges_u=self.graph.adjacency_edges_np[0],
            edges_v=self.graph.adjacency_edges_np[1],
            rules_matrix=self.rules_matrix,
            target_counts=self.target_counts,
            compactness_rules=self.compactness_rules,
            per_floor_rules=self.per_floor_rules,  # Pass new data
            floor_node_ranges=self.graph.floor_node_ranges,  # Pass new data
            w_area=self.w_area,
            w_adj=self.w_adj,
        )
        return (penalty,)
