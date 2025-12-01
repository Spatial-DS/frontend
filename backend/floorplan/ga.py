import random
import numpy as np
from deap import base, tools
from scipy.spatial.distance import cdist

from floorplan.data_models import Individual, DiscretizedGraph, creator
from floorplan.evaluation import FitnessEvaluator


class GeneticOptimizer:
    """
    Manages the evolutionary algorithm for finding optimal centroid layouts.
    Includes a memetic local search for solution refinement.
    """

    def __init__(
        self,
        pop_size: int = 50,
        generations: int = 100,
        cxpb: float = 0.5,
        mutpb: float = 0.5,
        swap_pb: float = 0.0,
        dup_pb: float = 0.0,
        prune_pb: float = 0.0,
        tournsize: int = 3,
        stagnation_limit: int | None = 15,
        min_improvement: float = 1e-6,
        random_walk_decay: float = 0.05,
        random_walk_scale: float = 10.0,
    ):
        self.POP_SIZE = pop_size
        self.GENERATIONS = generations
        self.CXPB = cxpb
        self.MUTPB = mutpb
        self.SWAP_PB = swap_pb
        self.DUP_PB = dup_pb
        self.PRUNE_PB = prune_pb
        self.TOUR_SIZE = tournsize
        self.STAGNATION_LIMIT = stagnation_limit
        self.MIN_IMPROVEMENT = min_improvement
        self.RW_DECAY = random_walk_decay
        self.RW_SCALE = random_walk_scale

        self.toolbox = base.Toolbox()
        self.fitness_cache: dict[tuple, tuple] = {}

    def _register_deap_tools(
        self, graph: DiscretizedGraph, evaluator: FitnessEvaluator
    ) -> None:
        """Sets up the DEAP toolbox with problem-specific functions."""
        def _rand_dict() -> dict[str, list[int]]:
            d = {}
            for t in evaluator.type_names:
                if t in evaluator.fixed_nodes:
                    d[t] = list(evaluator.fixed_nodes[t])
                else:
                    d[t] = [random.randrange(graph.n_nodes)]
            return d

        self.toolbox.register("individual", tools.initIterate, creator.Individual, _rand_dict)
        self.toolbox.register("population", tools.initRepeat, list, self.toolbox.individual)
        self.toolbox.register("evaluate", evaluator.evaluate)
        self.toolbox.register("mate", self._crossover_individuals)
        self.toolbox.register("mutate", self._mutate_individual, graph=graph, evaluator=evaluator)
        self.toolbox.register("select", tools.selTournament, tournsize=self.TOUR_SIZE)

    @staticmethod
    def _crossover_individuals(ind1: Individual, ind2: Individual) -> tuple[Individual, Individual]:
        child1_data, child2_data = {}, {}
        all_types = ind1.keys() | ind2.keys()
        for t in all_types:
            nodes1 = list(ind1.get(t, []))
            nodes2 = list(ind2.get(t, []))
            split = len(nodes1) // 2
            child1_data[t] = nodes1[:split] + nodes2[split:]
            child2_data[t] = nodes2[:split] + nodes1[split:]
        return creator.Individual(child1_data), creator.Individual(child2_data)

    def _mutate_individual(self, individual: Individual, graph: DiscretizedGraph, evaluator: FitnessEvaluator) -> tuple[Individual]:
        new_ind_data = {t: list(nodes) for t, nodes in individual.items()}
        movable_types = [t for t in evaluator.type_names if t not in evaluator.fixed_nodes]

        # --- Re-implemented Advanced Random Walk ---
        for t in movable_types:
            if t not in new_ind_data: continue
            for i, c_node in enumerate(new_ind_data[t]):
                steps = int(np.random.exponential(scale=self.RW_DECAY * self.RW_SCALE))
                current = c_node
                for _ in range(steps):
                    neighbors = graph.adjacency_list.get(current, [])
                    if not neighbors: break
                    current = random.choice(neighbors)
                new_ind_data[t][i] = current
        
        # Other mutations
        if len(movable_types) >= 2 and random.random() < self.SWAP_PB:
            t1, t2 = random.sample(movable_types, 2)
            new_ind_data[t1], new_ind_data[t2] = new_ind_data.get(t2, []), new_ind_data.get(t1, [])
        if movable_types and random.random() < self.DUP_PB:
            t_to_dup = random.choice(movable_types)
            if new_ind_data.get(t_to_dup):
                new_ind_data[t_to_dup].append(random.choice(new_ind_data[t_to_dup]))
        prunable = [t for t in movable_types if len(new_ind_data.get(t, [])) > 1]
        if prunable and random.random() < self.PRUNE_PB:
            t_to_prune = random.choice(prunable)
            idx_to_remove = random.randrange(len(new_ind_data[t_to_prune]))
            new_ind_data[t_to_prune].pop(idx_to_remove)

        return (creator.Individual(new_ind_data),)

    def _local_search(self, individual: Individual, graph: DiscretizedGraph, evaluator: FitnessEvaluator) -> Individual:
        """
        Performs a fast, stochastic hill-climbing search on an individual.
        """
        current_ind = self.toolbox.clone(individual)
        current_fitness = self._evaluate_with_cache(current_ind)[0]
        num_trials = 2 * len(evaluator.type_names)

        movable_types = [
            t for t in evaluator.type_names if t not in evaluator.fixed_nodes and current_ind.get(t)
        ]
        if not movable_types:
            return current_ind

        for _ in range(num_trials):
            type_to_move = random.choice(movable_types)
            if not current_ind[type_to_move]: continue
            
            centroid_idx_in_list = random.randrange(len(current_ind[type_to_move]))
            original_node = current_ind[type_to_move][centroid_idx_in_list]
            
            neighbors = graph.adjacency_list.get(original_node, [])
            if not neighbors: continue
            neighbor_node = random.choice(neighbors)
            
            current_ind[type_to_move][centroid_idx_in_list] = neighbor_node
            trial_fitness = self._evaluate_with_cache(current_ind)[0]

            if trial_fitness < current_fitness:
                current_fitness = trial_fitness
            else:
                current_ind[type_to_move][centroid_idx_in_list] = original_node
        
        del current_ind.fitness.values
        return current_ind

    def _evaluate_with_cache(self, individual: Individual) -> tuple:
        h = tuple(sorted((t, tuple(sorted(nodes))) for t, nodes in individual.items()))
        if h not in self.fitness_cache:
            self.fitness_cache[h] = self.toolbox.evaluate(individual)
        return self.fitness_cache[h]

    def _select_distinct_hof(self, population: list[Individual], graph: DiscretizedGraph, k: int) -> list[Individual]:
        # ... (This method is unchanged) ...
        if not population: return []
        population.sort(key=lambda x: x.fitness.values[0])
        hall_of_fame = [population[0]]
        dist_threshold = 2.0
        for cand in population[1:]:
            if len(hall_of_fame) >= k: break
            min_dist = float('inf')
            for hof_member in hall_of_fame:
                dist = self._calculate_individual_distance(cand, hof_member, graph)
                if dist < min_dist: min_dist = dist
            if min_dist > dist_threshold: hall_of_fame.append(cand)
        return hall_of_fame

    @staticmethod
    def _calculate_individual_distance(ind1: Individual, ind2: Individual, graph: DiscretizedGraph) -> float:
        # ... (This method is unchanged) ...
        all_types = set(ind1.keys()) | set(ind2.keys())
        total_dist = 0
        for type_name in all_types:
            nodes1, nodes2 = ind1.get(type_name, []), ind2.get(type_name, [])
            if not nodes1 or not nodes2:
                total_dist += 10 * abs(len(nodes1) - len(nodes2))
                continue
            coords1, coords2 = graph.grid_positions[nodes1], graph.grid_positions[nodes2]
            A, B = (coords1, coords2) if len(coords1) < len(coords2) else (coords2, coords1)
            distances = cdist(A, B)
            total_dist += np.mean(np.min(distances, axis=1))
        return total_dist / len(all_types) if all_types else 0

    def run(
        self,
        graph: DiscretizedGraph,
        evaluator: FitnessEvaluator,
        num_layouts: int = 3,
        progress_callback: callable = None,
        initial_population: list[Individual] | None = None,
        use_local_search: bool = True,
    ) -> list[Individual]:
        
        self.fitness_cache.clear()
        self._register_deap_tools(graph, evaluator)

        if initial_population:
            pop = initial_population
            if len(pop) < self.POP_SIZE: pop.extend(self.toolbox.population(n=self.POP_SIZE - len(pop)))
            elif len(pop) > self.POP_SIZE: pop = pop[:self.POP_SIZE]
        else:
            pop = self.toolbox.population(n=self.POP_SIZE)

        for ind in pop:
            if not ind.fitness.valid:
                 ind.fitness.values = self._evaluate_with_cache(ind)

        last_best_fitness = float("inf")
        stagnation_counter = 0

        for gen in range(self.GENERATIONS):
            parents = self.toolbox.select(pop, len(pop))
            offspring = [self.toolbox.clone(ind) for ind in parents]

            for i in range(1, len(offspring), 2):
                if random.random() < self.CXPB:
                    offspring[i-1], offspring[i] = self.toolbox.mate(offspring[i-1], offspring[i])
                    del offspring[i-1].fitness.values, offspring[i].fitness.values
            
            for i in range(len(offspring)):
                if random.random() < self.MUTPB:
                    (offspring[i],) = self.toolbox.mutate(offspring[i])
                    del offspring[i].fitness.values

            # --- Re-implemented Memetic Step ---
            if use_local_search:
                for i in range(len(offspring)):
                    if not offspring[i].fitness.valid:
                        offspring[i] = self._local_search(offspring[i], graph, evaluator)
                        # Fitness is already deleted by local search
            
            invalid_ind = [ind for ind in offspring if not ind.fitness.valid]
            for ind in invalid_ind:
                ind.fitness.values = self._evaluate_with_cache(ind)

            combined = pop + offspring
            combined.sort(key=lambda x: x.fitness.values[0])
            pop = combined[:self.POP_SIZE]

            best_fitness = pop[0].fitness.values[0]
            if last_best_fitness - best_fitness < self.MIN_IMPROVEMENT:
                stagnation_counter += 1
            else:
                stagnation_counter = 0
            last_best_fitness = best_fitness
            
            if progress_callback:
                progress_callback(gen, self.GENERATIONS, best_fitness, pop[0])

            if self.STAGNATION_LIMIT is not None and stagnation_counter >= self.STAGNATION_LIMIT:
                print(f"\nStopping early at generation {gen} due to stagnation.")
                break

        return self._select_distinct_hof(pop, graph, k=num_layouts)
