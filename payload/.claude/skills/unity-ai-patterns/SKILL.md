---
name: unity-ai-patterns
description: Game AI implementation patterns — Finite State Machines, A* pathfinding, Navigation Meshes, steering behaviors, flocking, sensory/perception systems, and hierarchical behavior trees for decision-making and character movement. Engine-agnostic (examples use Unity/C# where concrete code helps, but every pattern ports directly to Unreal, Godot, or a custom engine).
origin: "Unity Artificial Intelligence Programming, 5th Edition (Dr. Davide Aversa, Packt Publishing)"
---

# Game AI Patterns

Believable game characters need three loops running together: **perception**
(what does the agent know), **decision-making** (what should it do), and
**movement** (how does it get there). This skill consolidates the core
patterns for all three, in the order you typically layer them onto a project.

Use when building NPC behavior, character pathfinding, swarm/crowd behavior,
sensory/perception systems, or multi-layer decision systems. Applies to 2D/3D
games, enemy AI, allied NPCs, or any interactive agent — the patterns are
engine-agnostic; only the code snippets lean on Unity APIs (`NavMeshAgent`,
`MonoBehaviour`) as one concrete implementation.

## Decision tree: which pattern first

| Project shape | Start with |
| --- | --- |
| Simple game (1–2 enemy types, few behaviors) | FSM + NavMesh |
| Tactical/squad behavior | FSM or BT + Sensory System + A* |
| Complex layered decisions (multiple concurrent goals) | Behavior Trees + Sensory System |
| Crowd/swarm/school of fish | Flocking + Steering |
| Open world with dynamic obstacles | NavMesh + Steering (local avoidance) |
| Procedural/emergent agents | Behavior Trees + weighted randomness |

## 1. Finite State Machines (FSM)

A set of discrete states (`Idle`, `Patrol`, `Chase`, `Attack`, `Flee`) with
explicit transitions triggered by conditions (health, distance to target,
line of sight, timers).

```csharp
public enum State { Idle, Patrol, Chase, Attack, Flee }

State current = State.Idle;

void Update() {
    switch (current) {
        case State.Idle:   if (PlayerVisible()) current = State.Chase; break;
        case State.Chase:  if (InAttackRange()) current = State.Attack;
                           else if (!PlayerVisible()) current = State.Patrol; break;
        case State.Attack: if (!InAttackRange()) current = State.Chase; break;
    }
}
```

- Each state should have `Enter()`, `Update()`, `Exit()` hooks — avoid one
  giant `switch` mixing transition logic with per-frame behavior.
- Transitions belong in a table/graph you can reason about, not scattered
  `if` checks inside every state.
- **Gotcha — state explosion.** Independent axes multiply combinatorially:
  3 health states × 3 mana states × 3 ammo states = 27 states for one
  character. Symptom: a state machine that keeps growing every sprint and
  duplicates transition logic across states. Fix: extract independent axes
  into flags/blackboard values checked by a smaller set of states, or
  graduate to a Behavior Tree once you're past ~5–7 states.

## 2. A* Pathfinding

Finds the optimal path on a grid or graph. Core loop: maintain an **open
list** (candidates to explore, ordered by `f(n) = g(n) + h(n)`) and a
**closed list** (already-expanded nodes).

- `g(n)` — actual cost from start to node `n`.
- `h(n)` — heuristic estimate from `n` to the goal (Manhattan distance for
  4-directional grids, Euclidean/diagonal distance for 8-directional or free
  movement).
- `f(n) = g(n) + h(n)` — priority used to pick the next node to expand.

```csharp
NodePriorityQueue openList = new();
openList.Enqueue(start);
start.gScore = 0;
start.fScore = HeuristicEstimateCost(start, goal);

HashSet<Node> closedList = new();

while (openList.Length != 0) {
    Node node = openList.Dequeue();
    if (node == goal) return ReconstructPath(node);
    closedList.Add(node);

    foreach (Node neighbor in node.Neighbors) {
        if (closedList.Contains(neighbor)) continue;
        float tentativeG = node.gScore + Cost(node, neighbor);
        if (tentativeG < neighbor.gScore || !openList.Contains(neighbor)) {
            neighbor.parent = node;
            neighbor.gScore = tentativeG;
            neighbor.fScore = tentativeG + HeuristicEstimateCost(neighbor, goal);
            openList.EnqueueOrUpdate(neighbor);
        }
    }
}
```

- **Heuristic must be admissible** — it must never overestimate the true
  remaining cost, or A* stops guaranteeing the optimal path. An
  overly-aggressive heuristic produces paths that look "almost right" but
  cut corners through higher-cost terrain.
- Works well on static grids/graphs; recompute (or use a dynamic variant like
  D* Lite) when obstacles move or terrain changes at runtime.
- **Gotcha:** A* is grid/graph-native. For open terrain, slopes, or freeform
  3D navigation, a baked Navigation Mesh is cheaper and handles agent radius
  correctly — don't force a grid onto continuous terrain.

## 3. Navigation Mesh (NavMesh)

A baked walkable-surface mesh with built-in pathfinding and local avoidance.
Preferred over manual A* for most production games — it handles agent
radius/height, slopes, dynamic obstacle carving, and off-mesh links.

```csharp
// Agent handles pathfinding + local steering automatically
navMeshAgent.destination = target.position;
```

**Setup checklist:**
1. Bake the scene's static geometry into a NavMesh.
2. Tag walkable surfaces (e.g., "Walkable"), mark non-walkable areas as
   obstacles.
3. Add a NavMesh Agent component per character; set radius/height to match
   the character's collider.
4. Configure the avoidance layer/priority for crowds sharing the same mesh.
5. Use NavMesh Obstacles (carving) for dynamic geometry (doors, destructible
   walls) instead of re-baking at runtime.

- **Gotcha:** re-baking a NavMesh at runtime is expensive — reserve it for
  rare, large terrain changes. For frequent small changes (a door opening),
  use a carved `NavMeshObstacle` instead.

## 4. Steering Behaviors

Apply acceleration/velocity toward a target instead of snapping position —
this is what makes NavMesh or A* movement look smooth instead of robotic.

- **Seek/Arrive:** accelerate toward the target, decelerate on approach to
  avoid overshoot.
- **Path following:** compute the desired direction to the next waypoint;
  lerp velocity toward it — the lerp factor controls how "heavy"/inertial the
  character feels.
- **Obstacle avoidance:** raycast forward (and slightly off-axis); on hit,
  steer away locally. This is a *reactive* correction layered on top of
  *global* pathfinding — it doesn't replace A*/NavMesh, it smooths the
  agent's immediate surroundings.
- **Pursuit/evade:** like seek/flee, but aim at the target's *predicted*
  future position (`target.position + target.velocity * predictionTime`)
  instead of its current position.

Combines naturally with NavMesh: let the NavMesh handle global routing, use
steering for character-level polish (banking into turns, avoiding a
last-second dynamic obstacle).

## 5. Flocking

Emergent group movement from three local rules applied per agent, evaluated
against nearby neighbors only:

- **Separation:** steer away from neighbors that are too close.
- **Alignment:** match average heading/velocity of nearby neighbors.
- **Cohesion:** steer toward the average position of nearby neighbors.

```csharp
Vector3 separation = ComputeSeparation(neighbors);
Vector3 alignment  = ComputeAlignment(neighbors);
Vector3 cohesion   = ComputeCohesion(neighbors);
Vector3 steering   = separation * wSep + alignment * wAlign + cohesion * wCoh;
```

Scales to hundreds of agents *if* you cache/limit neighbor searches (spatial
hashing, grid buckets, or a fixed-radius neighbor query) — a naive
all-pairs check is O(n²) and falls over well before 200 agents. Useful for
crowds, birds, fish, or squad-level unit movement.

- **Gotcha:** flocking without spatial partitioning. Symptom: frame time
  degrades quadratically as agent count grows. Fix: bucket agents into a
  grid (or use a k-d tree) and only query the local cells/radius each frame.

## 6. Behavior Trees (BT)

A hierarchical tree of nodes that fixes FSM's scaling problem through
composability instead of an exploding state graph.

- **Composite nodes:**
  - `Sequence` — runs children in order, fails/stops on the first `Failure`.
  - `Selector` (fallback) — runs children in order, succeeds/stops on the
    first `Success`.
- **Decorator nodes:** wrap a single child to modify its result or repeat it
  (`Inverter`, `Repeater`, `Cooldown`, `UntilFail`).
- **Leaf/task nodes:** the actual actions and conditions (`IsPlayerVisible`,
  `MoveTo`, `Attack`).
- **Return states:** every node returns `Success`, `Failure`, or `Running`
  (still executing — re-evaluated next tick without restarting).

```
Selector "Combat Root"
├── Sequence "Attack if possible"
│   ├── Condition: IsPlayerInRange
│   └── Action: Attack
├── Sequence "Chase if visible"
│   ├── Condition: IsPlayerVisible
│   └── Action: MoveToPlayer
└── Action: Patrol
```

- Behavior Trees compose naturally: reuse a `CombatSubtree` across multiple
  enemy types instead of copy-pasting states.
- **Gotcha:** deep, ad-hoc nesting recreates FSM-style spaghetti one level
  down. Fix: extract shared subtrees, and use decorators (`Cooldown`,
  `Inverter`) instead of duplicating condition logic across branches.

## 7. Sensory/Perception Systems

Decouple "what the agent can perceive" from "what the agent decides." A
sensory system exposes a filtered, prioritized view of the world (visible
targets, heard sounds, remembered last-known positions) that feeds into the
FSM/BT decision layer.

- **Vision:** cone/angle check + raycast for line-of-sight + max range.
  Cache results per tick, not per query — multiple decision nodes asking
  "can I see the player" shouldn't each fire a raycast.
- **Hearing:** radius-based event propagation (footsteps, gunfire) with
  intensity falloff; louder/closer events override quieter ones.
- **Memory:** store last-known position + timestamp when perception is lost,
  so the agent can "investigate" instead of instantly losing all target
  awareness.
- **Gotcha — N+1 perception.** Polling every agent's full sensory suite every
  frame is the single most common Game-AI perf bug. Symptom: frame time
  scales linearly (or worse) with agent count even when most agents are
  idle. Fix: stagger polling by priority/distance (e.g., only check
  raycasts every N frames for agents beyond mid-range, every frame for
  agents already in combat).

## 8. Decision-Making Under Uncertainty

Avoid predictable, "solved" AI by injecting controlled randomness into
decisions, not into fairness-critical resolution (a boss's damage roll
still needs to feel fair).

- Weight decisions instead of pure branching: `Random.Range()` (or your
  engine's RNG) over a weighted table of viable actions, not a coin flip
  between "attack" and "do nothing."
- Combine with the sensory system's confidence level — an agent that just
  glimpsed the player should have lower decision confidence than one with
  full line of sight.
- **Caution:** intentional predictability is a *feature* in stealth and
  puzzle games — the player needs to learn and exploit guard patterns.
  Before adding randomness, ask: does unpredictability make this more fun,
  or does it just make the AI feel unfair/inconsistent?

## Common pitfalls (check before shipping)

1. **FSM explosion** — more than 5–7 states, or duplicated transition checks
   → migrate to a Behavior Tree.
2. **N+1 perception** — polling every agent's senses every frame → stagger
   by priority/distance, cache raycast results per tick.
3. **A* on the wrong terrain** — grids work for tile-based levels; for open
   terrain, slopes, or 3D navigation, use a NavMesh instead.
4. **Non-admissible heuristic** — an A* heuristic that overestimates cost
   produces suboptimal, visibly wrong paths.
5. **Flocking without spatial hashing** — O(n²) neighbor queries collapse
   past a few hundred agents → bucket/grid neighbor lookups.
6. **BT without composability** — deep, one-off nesting → extract shared
   subtrees and use decorators to stay DRY.
7. **Runtime NavMesh rebakes** — expensive; use `NavMeshObstacle` carving
   for frequent small changes instead of re-baking.
8. **Steering fighting pathfinding** — avoidance steering that overrides the
   NavMesh's global route leads to agents wandering off-path; keep steering
   as a local correction layered on the global path.

## Pattern combinations by project shape

- **Simple game (1–2 enemy types):** FSM + NavMesh.
- **Tactical/squad behavior:** FSM or BT + Sensory System + A*.
- **Complex layered decisions:** Behavior Trees + Flocking + NavMesh.
- **Crowd/swarm:** Flocking + Steering.
- **Procedural/emergent agents:** Behavior Trees + weighted randomness.
