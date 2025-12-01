from collections import deque

import numpy as np
from scipy.spatial import cKDTree

from floorplan.data_models import DiscretizationResult, DiscretizedGraph


class GraphBuilder:
    """
    Constructs and connects DiscretizedGraph objects from discretized
    geometric data.
    """

    @staticmethod
    def build_for_single_floor(
        discretization_result: DiscretizationResult,
    ) -> DiscretizedGraph:
        grid_positions = discretization_result.grid_positions
        n_nodes = len(grid_positions)

        if n_nodes == 0:
            return DiscretizedGraph(
                grid_positions=np.empty((0, 2)),
                adj_indices=np.empty(0, dtype=np.int32),
                adj_indptr=np.zeros(1, dtype=np.int32),
                adjacency_list={},
                adjacency_edges_np=np.empty((2, 0), dtype=int),
                n_nodes=0,
                floor_node_ranges=np.array([[0, 0]], dtype=int),
            )

        tree = cKDTree(grid_positions)
        adj_list_of_lists = tree.query_ball_point(grid_positions, r=1.01)

        adj_dict: dict[int, list[int]] = {}
        indices = []
        adj_indptr = np.zeros(n_nodes + 1, dtype=np.int32)

        for i, neighbors_with_self in enumerate(adj_list_of_lists):
            neighbors = [n for n in neighbors_with_self if n != i]
            adj_dict[i] = neighbors
            adj_indptr[i + 1] = adj_indptr[i] + len(neighbors)
            indices.extend(neighbors)

        adj_indices_np = np.array(indices, dtype=np.int32)

        adjacency_edges = [
            (u, v) for u, nbrs in adj_dict.items() for v in nbrs if u < v
        ]
        if adjacency_edges:
            adjacency_edges_np = np.array(adjacency_edges).T
        else:
            adjacency_edges_np = np.empty((2, 0), dtype=int)

        return DiscretizedGraph(
            grid_positions=grid_positions,
            adj_indices=adj_indices_np,
            adj_indptr=adj_indptr,
            adjacency_list=adj_dict,
            adjacency_edges_np=adjacency_edges_np,
            n_nodes=n_nodes,
            floor_node_ranges=np.array([[0, n_nodes - 1]], dtype=int),
        )

    @staticmethod
    def stitch_graphs(
        floor_graphs: list[DiscretizedGraph],
        floor_connections: list[dict[str, int]],
    ) -> DiscretizedGraph:
        if not floor_graphs:
            raise ValueError("Cannot stitch an empty list of graphs.")
        if len(floor_graphs) == 1:
            return floor_graphs[0]

        node_offsets = np.cumsum(
            [0] + [g.n_nodes for g in floor_graphs[:-1]], dtype=int
        )
        total_nodes = sum(g.n_nodes for g in floor_graphs)

        all_grid_positions = np.vstack([g.grid_positions for g in floor_graphs])

        all_adj_indices_list = []
        for i, graph in enumerate(floor_graphs):
            all_adj_indices_list.append(graph.adj_indices + node_offsets[i])
        new_adj_indices = np.concatenate(all_adj_indices_list, dtype=np.int32)

        all_neighbor_counts = []
        for graph in floor_graphs:
            all_neighbor_counts.append(np.diff(graph.adj_indptr))

        new_adj_indptr = np.concatenate(
            ([0], np.cumsum(np.concatenate(all_neighbor_counts), dtype=np.int32))
        )

        global_connections: dict[str, list[int]] = {}
        for i, conn_dict in enumerate(floor_connections):
            offset = node_offsets[i]
            for conn_id, node_idx in conn_dict.items():
                global_connections.setdefault(conn_id, []).append(node_idx + offset)

        temp_adj_list: dict[int, list[int]] = {}
        for i in range(total_nodes):
            start, end = new_adj_indptr[i], new_adj_indptr[i + 1]
            temp_adj_list[i] = new_adj_indices[start:end].tolist()

        for conn_id, nodes in global_connections.items():
            if len(nodes) > 1:
                for i in range(len(nodes) - 1):
                    u, v = nodes[i], nodes[i + 1]
                    temp_adj_list[u].append(v)
                    temp_adj_list[v].append(u)

        final_indices = []
        final_indptr = np.zeros(total_nodes + 1, dtype=np.int32)
        for i in range(total_nodes):
            neighbors = sorted(list(set(temp_adj_list.get(i, []))))
            final_indptr[i + 1] = final_indptr[i] + len(neighbors)
            final_indices.extend(neighbors)

        final_adj_indices_np = np.array(final_indices, dtype=np.int32)

        final_adj_list = {
            i: final_adj_indices_np[final_indptr[i] : final_indptr[i + 1]].tolist()
            for i in range(total_nodes)
        }
        final_edges = [
            (u, v) for u, nbrs in final_adj_list.items() for v in nbrs if u < v
        ]
        final_edges_np = (
            np.array(final_edges, dtype=int).T
            if final_edges
            else np.empty((2, 0), dtype=int)
        )

        GraphBuilder.validate_connectivity(total_nodes, final_adj_list)

        floor_ranges = []
        for i, graph in enumerate(floor_graphs):
            offset = node_offsets[i]
            floor_ranges.append([offset, offset + graph.n_nodes - 1])

        return DiscretizedGraph(
            grid_positions=all_grid_positions,
            adj_indices=final_adj_indices_np,
            adj_indptr=final_indptr,
            adjacency_list=final_adj_list,
            adjacency_edges_np=final_edges_np,
            n_nodes=total_nodes,
            floor_node_ranges=np.array(floor_ranges, dtype=int),
        )

    @staticmethod
    def validate_connectivity(n_nodes: int, adj_list: dict[int, list[int]]):
        if n_nodes == 0:
            return

        q = deque([next(iter(adj_list.keys()))])
        visited = {q[0]}

        while q:
            u = q.popleft()
            for v in adj_list.get(u, []):
                if v not in visited:
                    visited.add(v)
                    q.append(v)

        if len(visited) != n_nodes:
            raise ValueError(
                "The stitched multi-floor graph is not fully connected. "
                "Check that all floors have geometry and that connections "
                "form a continuous path."
            )
