---
name: algorithms-datastructures
description: Analyze algorithm correctness and complexity, choose the right data structure, and apply proven design paradigms (divide-and-conquer, DP, greedy, graph algorithms) with rigorous asymptotic reasoning.
origin: biblio
---

# Algorithms & Data Structures

Reference for reasoning about algorithm correctness, complexity, and design choice
independent of any specific codebase or language. Source: *Introduction to
Algorithms* (Cormen, Leiserson, Rivest, Stein), 3rd edition. **A newer edition
exists (4th ed., 2022) — prefer it when available**; the concepts below are
edition-stable fundamentals.

This skill is technology-agnostic: it does not assume Python, Django, SQL, or
any particular runtime. Apply the reasoning, translate the pseudocode to
whatever language the task is in.

## When to Activate

- Choosing a data structure for a performance-sensitive path (lookup, ordering,
  membership, priority, adjacency).
- An algorithm's running time is unclear or suspected to scale badly.
- Deciding between divide-and-conquer, dynamic programming, and greedy for a
  given optimization problem.
- Implementing or reviewing a graph traversal, shortest-path, spanning-tree, or
  max-flow routine.
- A problem "smells" NP-hard (exponential brute force, combinatorial explosion)
  and needs classification or an approximation/heuristic strategy.
- Reviewing code for correctness of loop invariants or recursive base cases.

## Complexity Analysis (Big-O)

Always analyze **worst-case**, **average-case**, and note when **amortized**
analysis applies (e.g., dynamic array growth, disjoint-set union).

- Define running time as a function of input size `n`; drop lower-order terms
  and constant factors — `Θ`, `O`, `Ω` bound tightly, loosely from above, loosely
  from below respectively.
- Establish a **loop invariant** for every non-trivial loop: state it, prove
  initialization / maintenance / termination — this is the standard correctness
  proof technique (used for insertion sort, etc.).
- For recursive algorithms, solve the recurrence:
  - **Substitution method**: guess the bound, prove by induction.
  - **Recursion-tree method**: expand the recursion visually, sum per-level costs.
  - **Master method**: for `T(n) = aT(n/b) + f(n)`, compare `f(n)` against
    `n^(log_b a)` to pick the dominant term (three cases, plus a regularity
    condition for case 3).
- Common complexity classes, cheapest to costliest: `O(1) < O(log n) < O(n) <
  O(n log n) < O(n²) < O(n³) < O(2^n) < O(n!)`. An `O(n²)` algorithm on
  `n=10,000` is already ~100M ops — profile before assuming it's fine.

**Pitfall**: benchmarking only on small/typical inputs hides quadratic or worse
blowups. Always reason about the asymptotic bound, not just measured latency at
current scale.

## Sorting

- **Comparison sorts** have a proven lower bound of `Ω(n log n)` (decision-tree
  argument) — no comparison-based sort beats this asymptotically.
- **Insertion sort**: `O(n²)` worst case, but `O(n)` on nearly-sorted input and
  simple/low-overhead — good for small `n` or as a base case inside a hybrid sort.
- **Merge sort**: `Θ(n log n)` guaranteed, stable, divide-and-conquer; needs
  `Θ(n)` auxiliary space. Prefer when worst-case guarantees matter (e.g.,
  external sorting, linked lists).
- **Heapsort**: `O(n log n)` worst case, **in-place**, not stable. Builds a
  binary heap (`BUILD-MAX-HEAP` is `O(n)`, not `O(n log n)` — a classic
  amortized-analysis surprise), then repeatedly extracts the max.
- **Quicksort**: `Θ(n log n)` expected, `Θ(n²)` worst case (already-sorted input
  with naive pivot). Randomized pivot selection makes worst case
  overwhelmingly unlikely — always randomize the pivot in practice.
- **Linear-time (non-comparison) sorts** — only valid under extra assumptions:
  - **Counting sort**: `Θ(n + k)` when keys are integers in a known range `[0, k]`.
  - **Radix sort**: `Θ(d(n + k))` sorting digit-by-digit least-significant-first,
    using a stable sort (usually counting sort) per digit.
  - **Bucket sort**: `Θ(n)` expected when input is uniformly distributed over a
    known range.
- **Order statistics** (finding the k-th smallest element) don't require full
  sorting: randomized `SELECT` runs in `Θ(n)` expected time; the deterministic
  median-of-medians algorithm guarantees `Θ(n)` worst case.

**Pitfall**: reaching for a comparison sort when the domain constraint
(bounded integer keys, fixed-width strings) allows a genuinely linear-time
sort.

## Data Structures

Pick based on the operations actually needed, not habit.

| Structure | Search | Insert | Delete | Min/Max | Notes |
|---|---|---|---|---|---|
| Unsorted array/list | O(n) | O(1) | O(n) | O(n) | cheap append only |
| Sorted array | O(log n) | O(n) | O(n) | O(1) | binary search, costly mutation |
| Linked list (doubly) | O(n) | O(1) | O(1) | O(n) | O(1) insert/delete given a pointer |
| Binary search tree (unbalanced) | O(h) | O(h) | O(h) | O(h) | `h` degrades to `n` on adversarial input |
| Red-black tree | O(log n) | O(log n) | O(log n) | O(log n) | height ≤ `2 log(n+1)`, self-balancing via rotations + recoloring |
| Hash table | O(1) expected | O(1) expected | O(1) expected | O(n) | needs good hash function + collision handling (chaining or open addressing); worst case O(n) |
| Binary heap | O(n) | O(log n) | O(log n) | O(1) | ideal for priority queues |
| Disjoint-set (union-find) | — | — | — | — | union by rank + path compression → nearly `O(1)` amortized per op (inverse Ackermann) |

- Stacks (LIFO) and queues (FIFO) are array- or list-backed with `O(1)`
  push/pop/enqueue/dequeue — the right choice when only insertion/removal order
  matters, not arbitrary access.
- Augment a base structure (e.g., order-statistics trees: red-black tree +
  subtree-size field) instead of building a bespoke structure from scratch —
  cheaper to prove correct and to maintain.
- Advanced structures worth knowing exist: B-trees (disk-backed, minimize I/O
  by maximizing branching factor), Fibonacci heaps (better amortized
  `decrease-key` for graph algorithms like Dijkstra/Prim), van Emde Boas trees
  (`O(log log n)` for bounded universes).

**Pitfall**: using an unbalanced BST when input arrives sorted or adversarially
ordered — it degenerates to a linked list (`O(n)` per operation). Use a
self-balancing variant whenever the insertion order isn't guaranteed random.

## Dynamic Programming

Applies when a problem has:
1. **Optimal substructure** — an optimal solution is built from optimal
   solutions to subproblems.
2. **Overlapping subproblems** — a naive recursion revisits the same
   subproblem exponentially many times.

Two implementation strategies:
- **Top-down with memoization**: write the natural recursion, cache each
  subproblem's result the first time it's computed.
- **Bottom-up**: identify the dependency order of subproblems, fill a table
  iteratively from smallest to largest — usually faster in practice (no
  recursion overhead) and easier to bound in space.

Canonical worked patterns:
- **Rod cutting / matrix-chain multiplication**: optimal split point search
  over `O(n²)` or `O(n³)` subproblems — the template for "where do I cut this
  sequence" problems.
- **Longest common subsequence**: `O(mn)` table, each cell depends only on its
  top/left/diagonal neighbor — the template for sequence-alignment problems.
- **Optimal BST**: DP over subtree ranges, minimizing expected search cost.

**Procedure**: (1) characterize the structure of an optimal solution, (2)
define the recurrence, (3) compute bottom-up (or memoized top-down), (4)
reconstruct the solution from the table if needed (not just the optimal
value).

**Pitfall**: applying DP to a problem without overlapping subproblems —
memoization then just adds overhead over plain divide-and-conquer. Also:
forgetting to reconstruct the actual solution (path/choice), not just its cost.

## Greedy Algorithms

Applies when a problem exhibits:
1. **Greedy-choice property** — a locally optimal choice leads to a globally
   optimal solution (must be proven, not assumed — usually via an exchange
   argument).
2. **Optimal substructure** (shared with DP).

- Greedy is strictly weaker than DP: it never reconsiders past choices.
  A greedy algorithm exists only if the local-choice property is provably
  true for the specific problem — verify it, don't assume "greedy feels right."
- Canonical example: **activity selection** (interval scheduling) — sort by
  finish time, greedily pick the next compatible activity; provably optimal.
- **Huffman coding** builds an optimal prefix-free code by repeatedly merging
  the two lowest-frequency nodes — greedy at the merge-cost level.
- Matroid theory gives a general sufficient condition: if the problem's
  feasible-solution structure forms a matroid, the greedy algorithm on
  weighted elements is optimal (this is why MST via Kruskal's works).

**Pitfall**: applying greedy to problems like 0/1 knapsack, where local
optimality does *not* imply global optimality — that requires DP instead.

## Graph Algorithms

Represent as adjacency list (`O(V + E)` space, efficient for sparse graphs) or
adjacency matrix (`O(V²)` space, `O(1)` edge lookup — better for dense graphs).

- **BFS**: explores level by level via a queue; finds shortest path by
  **edge count** in unweighted graphs. `O(V + E)`. Produces a BFS tree with
  correct shortest-path distances.
- **DFS**: explores as deep as possible via a stack/recursion; produces
  discovery/finish timestamps used to classify edges (tree, back, forward,
  cross). `O(V + E)`.
  - A **back edge** during DFS implies a cycle — the standard cycle-detection
    technique for directed graphs.
  - **Topological sort** = DFS, output vertices in reverse order of finish
    time; only valid on a DAG.
  - **Strongly connected components**: run DFS, transpose the graph, run DFS
    again in decreasing finish-time order (Kosaraju/Tarjan-style) — `O(V + E)`.
- **Minimum spanning tree** (undirected, weighted, connected):
  - **Kruskal's**: sort edges by weight, add if it doesn't create a cycle
    (via union-find). `O(E log E)`.
  - **Prim's**: grow a tree from one vertex, always add the cheapest crossing
    edge (via a min-priority queue). `O(E log V)` with a binary heap.
- **Single-source shortest paths**:
  - **Dijkstra's**: greedy, requires **non-negative** edge weights. `O((V + E)
    log V)` with a binary heap, better with a Fibonacci heap. Relaxes edges
    from a priority queue ordered by current best distance.
  - **Bellman-Ford**: handles **negative** edge weights, detects negative-weight
    cycles reachable from the source. `O(VE)` — relax every edge `V-1` times,
    then check for further relaxation to detect a negative cycle.
  - **DAG shortest paths**: topologically sort, then relax edges in that
    order — `O(V + E)`, faster than either general algorithm.
- **All-pairs shortest paths**: Floyd-Warshall DP, `O(V³)`, handles negative
  edges (no negative cycles); simple to implement via a `V×V` distance matrix
  updated over each possible intermediate vertex.
- **Maximum flow**: Ford-Fulkerson method — repeatedly find an augmenting path
  in the residual graph, add its bottleneck capacity to the flow, until no
  augmenting path remains (max-flow min-cut theorem guarantees optimality at
  that point). Running time depends on augmenting-path selection; using BFS
  (Edmonds-Karp) bounds it at `O(VE²)`.

**Pitfall**: running Dijkstra's on a graph with negative edge weights — it
produces a silently wrong answer instead of failing loudly. Verify edge-weight
sign before choosing the algorithm.

## NP-Completeness

- **P**: solvable in polynomial time. **NP**: a proposed solution is
  *verifiable* in polynomial time (not necessarily *findable* in polynomial
  time). Whether `P = NP` is open — assume `P ≠ NP` in practice.
- A problem is **NP-complete** if it's in NP and every other NP problem
  reduces to it in polynomial time — it's simultaneously "as hard as" the
  entire class. Proving NP-completeness requires (1) showing membership in NP,
  (2) a polynomial-time reduction *from* a known NP-complete problem.
- Canonical NP-complete problems used as reduction sources: **circuit-SAT →
  3-SAT → clique → vertex cover → Hamiltonian cycle → traveling salesman**.
  Recognize a new problem as NP-hard by finding a reduction from one of these,
  not by failing to find a polynomial algorithm.
- Practical response when a problem is NP-hard: don't try to brute-force
  optimality at scale. Options, in order of preference: (1) find a restricted
  special case that is polynomial (e.g., bipartite matching instead of general
  matching), (2) use a polynomial-time approximation algorithm with a proven
  bound, (3) use a well-tested heuristic (local search, greedy, simulated
  annealing) with no guarantee but acceptable practical results, (4) accept
  exponential search only for genuinely small `n`.

**Pitfall**: spending engineering effort trying to find an exact polynomial
algorithm for a proven NP-complete problem — verify NP-completeness (or search
the literature) before investing in that search.

## General Pitfalls

- Skipping the loop-invariant / induction proof and trusting "it worked on my
  test case" — off-by-one and edge-case bugs hide exactly where the invariant
  would have caught them.
- Choosing a data structure by familiarity rather than by the operations the
  algorithm actually needs (e.g., array when random deletion is frequent).
- Ignoring amortized cost: a single operation looking expensive (e.g., array
  resize) can still be cheap on average across a sequence of operations —
  don't reject a design from one worst-case operation without checking the
  amortized bound.
- Reusing a general algorithm (Dijkstra, Bellman-Ford, Floyd-Warshall) where a
  structural constraint (DAG, bounded integer weights, sparse graph) allows a
  strictly faster specialized one.
