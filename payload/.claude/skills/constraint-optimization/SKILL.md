---
name: constraint-optimization
description: Model and solve constraint satisfaction and optimization problems — variables, constraints, objective functions, CSP with backtracking and AC-3 propagation, linear/integer programming, CP-SAT, and metaheuristics (simulated annealing, genetic algorithms, tabu search) for scheduling, routing/VRP, bin packing, and assignment problems.
origin: authored
---

# Constraint Optimization

Formulate real-world decision problems as constraint satisfaction or
mathematical optimization models, then pick the right solving technique —
exact solvers when the problem scales, metaheuristics when it doesn't.

## Prerequisites (preflight)

Before using this skill, ensure you have the required packages installed.

**Python packages:**
```bash
# Check for OR-Tools, PuLP, and Z3
python -c "import ortools" || echo "WARN: pip install ortools pulp z3-solver"
```

## When to Activate

- Building a scheduler, rota, or timetable under hard constraints
- Assigning resources (staff, vehicles, tasks) to slots or agents
- Routing vehicles under capacity/time-window constraints (VRP)
- Packing items into bins/containers with size/weight limits
- A problem is described as "find the best combination of X subject to Y"
- Existing greedy/manual logic produces feasible but poor solutions
- Choosing between exact solvers and heuristics for a combinatorial problem

## Modeling First

Every problem in this space reduces to three explicit artifacts. Write them
down before touching a solver.

1. **Variables** — the unknowns to decide, with their domains.
   `assign[worker][shift] ∈ {0, 1}`, `start_time[task] ∈ [0, horizon]`.
2. **Constraints** — rules the solution must satisfy (hard) or should
   satisfy (soft, penalized in the objective).
   `sum(assign[w][s] for s in shifts) <= max_shifts_per_worker`.
3. **Objective** — the function to minimize/maximize.
   `minimize(total_cost)`, `maximize(coverage - overtime_penalty)`.

```text
Model = (Variables, Domains, Constraints, Objective)
```

A vague requirement ("schedule fairly") is not a model. Push for a testable
predicate ("no worker has more than 5 shifts/week") before writing code.

### Hard vs. soft constraints

- **Hard**: must hold in any accepted solution (legal capacity, no double-booking).
- **Soft**: violations are penalized, not forbidden (preferences, "avoid" rules).
  Model soft constraints as objective penalty terms, not `if` filters — filtering
  a soft rule as hard makes the model infeasible when trade-offs are unavoidable.

```python
# Soft constraint as penalty, not a filter
objective = total_cost + PENALTY_WEIGHT * unmet_preferences
```

## Constraint Satisfaction (CSP)

A CSP asks "does a feasible assignment exist / what is it", with no objective
to optimize — pure feasibility (Sudoku, map coloring, simple scheduling).

### Backtracking search

Depth-first assignment with pruning: assign a variable, check consistency,
recurse; undo and try the next value on failure.

```python
def backtrack(assignment: dict, variables: list, domains: dict, constraints) -> dict | None:
    if len(assignment) == len(variables):
        return assignment
    var = select_unassigned_variable(variables, assignment, domains)
    for value in order_domain_values(var, domains):
        if is_consistent(var, value, assignment, constraints):
            assignment[var] = value
            result = backtrack(assignment, variables, domains, constraints)
            if result is not None:
                return result
            del assignment[var]
    return None
```

Speed it up with:

- **MRV** (minimum remaining values) — pick the most constrained variable next.
- **Degree heuristic** — break MRV ties by picking the variable in the most
  constraints with unassigned neighbors.
- **LCV** (least constraining value) — try the value that rules out the
  fewest options for neighbors first.
- **Forward checking** — after each assignment, remove now-invalid values
  from neighbors' domains; fail early if a domain empties.

### Constraint propagation: AC-3

Arc consistency trims domains before/during search — for every constraint
between X and Y, every value in X's domain must have a supporting value in Y's
domain, or it's removed.

```python
def ac3(arcs: list, domains: dict, constraints) -> bool:
    queue = list(arcs)
    while queue:
        xi, xj = queue.pop(0)
        if revise(domains, xi, xj, constraints):
            if not domains[xi]:
                return False  # domain wiped out — no solution
            queue.extend((xk, xi) for xk in neighbors(xi) if xk != xj)
    return True

def revise(domains: dict, xi: str, xj: str, constraints) -> bool:
    revised = False
    for x in list(domains[xi]):
        if not any(satisfies(constraints, xi, x, xj, y) for y in domains[xj]):
            domains[xi].remove(x)
            revised = True
    return revised
```

Run AC-3 once as preprocessing, and again after each assignment during
backtracking (maintaining arc consistency, "MAC") — it prunes the search tree
far more than forward checking alone, at higher per-node cost.

## Linear & Integer Programming (LP/MILP)

Use when the objective and constraints are linear and variables are
continuous (LP) or integer/binary (MILP, ILP). Solvers use simplex/interior-point
(LP) and branch-and-bound/cut (MILP) — exact, provably optimal, with an
optimality gap you can inspect.

```python
import pulp

problem = pulp.LpProblem("staff_scheduling", pulp.LpMinimize)

assign = {
    (worker, shift): pulp.LpVariable(f"assign_{worker}_{shift}", cat="Binary")
    for worker in workers
    for shift in shifts
}

problem += pulp.lpSum(cost[worker][shift] * assign[worker, shift]
                       for worker in workers for shift in shifts)

for shift in shifts:
    problem += pulp.lpSum(assign[worker, shift] for worker in workers) >= required_staff[shift]

for worker in workers:
    problem += pulp.lpSum(assign[worker, shift] for shift in shifts) <= max_shifts[worker]

problem.solve(pulp.PULP_CBC_CMD(msg=False))
```

- **PuLP**: pure-Python modeling, CBC solver bundled — good default for MILP.
- **OR-Tools (`linear_solver`)**: same modeling style, swap in SCIP/GLOP/CBC/Gurobi backends.
- **Z3 / SMT**: use when constraints mix booleans, integers, and non-linear or
  logical structure (implications, disjunctions) that LP/MILP can't express
  directly — decision procedure, not a numeric optimizer by default (though
  `z3.Optimize()` supports objectives).

```python
from z3 import Bool, Implies, Optimize, Sum, If

opt = Optimize()
x = [Bool(f"x{i}") for i in range(len(items))]
opt.add(Implies(x[0], x[1]))  # logical constraint LP can't express directly
opt.maximize(Sum([If(v, value[i], 0) for i, v in enumerate(x)]))
opt.check()
```

## CP-SAT (Constraint Programming)

OR-Tools' CP-SAT solver bridges CSP and MILP: models arbitrary constraints
(`AllDifferent`, interval/no-overlap, element, table constraints) natively,
without linearizing them, and searches with both propagation and
branch-and-bound. Preferred default for scheduling, routing, and packing
problems with rich combinatorial structure and an objective.

```python
from ortools.sat.python import cp_model

model = cp_model.CpModel()
tasks = {t: model.new_interval_var(
    model.new_int_var(0, horizon, f"start_{t}"), duration[t],
    model.new_int_var(0, horizon, f"end_{t}"), f"task_{t}",
) for t in task_ids}

model.add_no_overlap(list(tasks.values()))
model.minimize(sum(model.new_int_var(0, horizon, f"end_{t}") for t in task_ids))

solver = cp_model.CpSolver()
solver.parameters.max_time_in_seconds = 30
status = solver.solve(model)
```

Set `max_time_in_seconds` deliberately — CP-SAT proves optimality when it can,
but returns the best feasible solution found (with a gap) on timeout.
Always check `status in (OPTIMAL, FEASIBLE)` before trusting the result.

## Metaheuristics — when exact doesn't scale

Exact methods (CP-SAT, MILP) can stall on large, tightly-constrained
instances — hundreds of vehicles, thousands of tasks. Metaheuristics trade
optimality guarantees for solutions in bounded time.

| Method | Idea | Good fit |
| --- | --- | --- |
| Simulated annealing | Accept worsening moves with a probability that cools over time, escaping local optima | Continuous/large discrete landscapes, single good neighborhood move |
| Genetic algorithm | Maintain a population, crossover + mutate, select the fittest | Problems with a natural solution encoding (permutations, assignment vectors) |
| Tabu search | Local search that forbids recently-visited moves to escape cycles | VRP, job-shop scheduling, strong local-search neighborhoods |

```python
import random

def simulated_annealing(initial_solution, cost_fn, neighbor_fn, initial_temp=100.0, cooling_rate=0.995, min_temp=1e-3):
    current, current_cost = initial_solution, cost_fn(initial_solution)
    best, best_cost = current, current_cost
    temperature = initial_temp
    while temperature > min_temp:
        candidate = neighbor_fn(current)
        candidate_cost = cost_fn(candidate)
        delta = candidate_cost - current_cost
        if delta < 0 or random.random() < pow(2.718281828, -delta / temperature):
            current, current_cost = candidate, candidate_cost
            if current_cost < best_cost:
                best, best_cost = current, current_cost
        temperature *= cooling_rate
    return best
```

Rules of thumb:

- Always keep the exact model as a small-instance validator/benchmark, even
  if production uses a metaheuristic — it tells you the size of the
  optimality gap you're accepting.
- Report the gap or gap estimate alongside any metaheuristic result — a
  "good" solution with unknown distance to optimal is a silent risk.
- Start with a feasible construction heuristic (greedy, nearest-neighbor),
  then improve with local search/annealing — don't anneal from random noise.

## Classic Problem Families

- **Scheduling / timetabling** — tasks with durations, precedence, resource
  capacity; `NoOverlap`/interval variables in CP-SAT are the natural fit.
- **Routing / VRP (Vehicle Routing Problem)** — vehicles, capacities, time
  windows, depots; OR-Tools' `routing` module has a dedicated solver with
  built-in local-search metaheuristics (guided local search, tabu).
- **Bin packing** — items into fixed-capacity bins minimizing bin count;
  CP-SAT or MILP for exact, first-fit-decreasing for a fast heuristic baseline.
- **Assignment** — bipartite matching of agents to tasks minimizing cost;
  the Hungarian algorithm solves this exactly in polynomial time when the
  structure is a pure assignment (no side constraints) — don't reach for a
  general MILP solver if this simpler exact algorithm applies.

## Objective & Trade-offs

- State the objective as a single scalar; combine multiple goals (cost,
  fairness, coverage) via weighted sum or lexicographic ordering — pick one
  explicitly, don't leave weights implicit in code comments.
- Multi-objective problems: solve for a Pareto frontier (vary weights, or use
  `epsilon`-constraint: optimize one objective, bound the others) rather than
  guessing a single weighting.
- Fairness objectives (e.g., minimize max load) need `minimize(max(...))` —
  linearize with an auxiliary variable: `aux >= load[i] for all i; minimize(aux)`.

## Common Pitfalls

- **Model mal posé** — solving a well-specified but wrong model perfectly
  optimally. Validate the model against a few hand-checkable small instances
  before scaling up.
- **Combinatorial explosion** — naive backtracking or MILP without
  propagation/cuts times out past a few dozen variables on hard instances.
  Add propagation (AC-3, CP-SAT global constraints) or switch formulation
  before assuming "more compute" fixes it.
- **Heuristic without a bound** — shipping a metaheuristic result with no
  reference to how far it is from optimal. Compute a lower bound (LP
  relaxation, partial CP-SAT run) even if the final method is heuristic.
- **Over-constraining soft rules** — encoding a preference as a hard
  constraint makes the model infeasible under normal load; always confirm
  which rules are truly non-negotiable with the domain owner before modeling.
- **Ignoring solver status** — treating a `TIMEOUT`/`FEASIBLE` result as
  `OPTIMAL`. Always branch on solver status before trusting or reporting a
  solution.
- **Symmetry** — interchangeable variables (identical workers, identical
  bins) multiply the search space without adding real solutions; break
  symmetry with ordering constraints (`assign[0] <= assign[1] <= ...`).

## Checklist

- [ ] Variables, domains, constraints, and objective written down explicitly
- [ ] Hard constraints separated from soft (penalized) constraints
- [ ] Problem family identified (CSP / LP / MILP / CP / routing / packing / assignment)
- [ ] Solver choice matches problem shape (see table above), not the most familiar tool
- [ ] Small hand-verifiable instance used to validate the model before scaling
- [ ] Timeout set explicitly on any exact solver used in production
- [ ] Solver status checked (`OPTIMAL` vs. `FEASIBLE` vs. `INFEASIBLE` vs. `TIMEOUT`)
- [ ] If a metaheuristic is used, an optimality gap or lower bound is reported alongside it
- [ ] Symmetry-breaking constraints added where interchangeable entities exist
- [ ] Multi-objective trade-offs made explicit (weights or lexicographic order), not implicit
