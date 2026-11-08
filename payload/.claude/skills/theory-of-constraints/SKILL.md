---
name: theory-of-constraints
description: Theory of Constraints (TOC) — identify and exploit system bottlenecks, optimize throughput vs. local efficiency, drum-buffer-rope scheduling, and continuous improvement through the five focusing steps.
origin: "The Goal: A Process of Ongoing Improvement (Goldratt & Cox, 1984)"
---

# Theory of Constraints

System optimization by focusing improvement effort on the one constraint that
limits overall output, not on local efficiency anywhere else.

## When to Activate

- System performance stalls despite optimizing individual components.
- Local efficiency improvements (per-team velocity, per-server utilization)
  yield no measurable system-level gain.
- Throughput targets are consistently missed; work queues build up in front of
  one specific step, team, or resource.
- Cost-cutting (headcount, infra spend) fails to improve delivery speed.
- Teams optimize different, uncoordinated priorities (cost vs. speed vs.
  quality) instead of the overall goal.
- Work-in-progress grows while delivered value or customer satisfaction
  declines.
- Need to balance throughput, inventory, and operating expense holistically
  instead of chasing isolated metrics.
- A software delivery pipeline (code review, CI, deploy, ops) has one stage
  that consistently backs everything up.

## Core Concepts

### The Goal

Every system has a goal (for a business: making money now and in the future;
for a delivery organization: shipping validated value continuously). Any
local action that does not serve that goal is, at best, neutral and often
harmful — even if it looks efficient in isolation.

### Three System Measures

Optimize the entire system by balancing three interdependent metrics instead
of any one of them in isolation:

- **Throughput**: the rate at which the system generates value toward the
  goal (units shipped, revenue booked, features delivered to users) — never
  units merely *produced* or *started*.
- **Inventory** (or Work-in-Progress): capital or effort tied up in things not
  yet converted into throughput — unsold stock, half-built features, open
  pull requests, backlog items in progress, unreleased code.
- **Operating Expense**: money and effort spent turning inventory into
  throughput — salaries, infrastructure cost, tooling, meetings, context
  switching.

Goal: maximize throughput while minimizing inventory and operating expense.
Optimizing any one of the three at the expense of the other two is a trap
(e.g., cutting operating expense by understaffing the one team that is
already the bottleneck reduces throughput more than it saves).

### Bottleneck (Constraint)

The constraint is the single resource, process, step, or policy that limits
how much the whole system can produce. Improving anything else does not
increase system output — it only shifts idle time and waste elsewhere.

A constraint is not always a machine, a server, or a person. It can be a
**policy constraint**: a rule, an approval process, a batch-size convention,
an org chart, or a shared assumption nobody questions. Policy constraints are
often the hardest to see and the cheapest to fix once identified — no capital
investment, just permission to change the rule.

Lesson: the system runs only as fast as its constraint. Find it before
optimizing anything else.

## Techniques

### 1. Five Focusing Steps

A repeatable cycle for continuous, targeted improvement.

**Step 1 — Identify the constraint.**
Find the bottleneck through observation, flow metrics, and queue analysis:
look for where work piles up waiting, not where people look busiest. In
software delivery: cycle-time-per-stage analysis, queue depth on a Kanban
board, CI queue wait time, review turnaround time. The busiest-looking
resource is not always the constraint — the one with the longest queue in
front of it usually is.

**Step 2 — Exploit the constraint.**
Get the maximum output from the constraint using resources already in hand,
before spending money on more capacity. Eliminate idle time on it, remove
low-value work from its plate, never let it wait on anything avoidable, never
let it rework something it already finished. In software: never let senior
reviewers review low-risk trivial PRs; never let the one engineer who
understands legacy billing code get pulled into unrelated meetings; keep the
CI runner that gates deploys warm and prioritized.

**Step 3 — Subordinate everything else to the constraint.**
Align every non-constraint resource, process, and team to serve the pace of
the constraint. Feeding the constraint faster than it can absorb work does
not raise throughput — it only grows inventory in front of it. In software:
if code review is the constraint, upstream work (feature branches opened,
tickets started) should be paced to review capacity, not to the speed at
which developers can write code.

**Step 4 — Elevate the constraint.**
Only after steps 2–3 are exhausted, add real capacity: hire, automate,
parallelize, buy more infrastructure, redesign the constrained process
itself. Elevating before exploiting wastes money solving a problem that free
capacity could have solved.

**Step 5 — Repeat, and do not let inertia become the new constraint.**
Once elevated, the constraint moves elsewhere in the system. Return to Step
1. A common failure: policies and habits put in place to protect the old
constraint (extra approval gates, buffers, batch sizes) outlive it and become
the new limiting factor. Actively look for and remove stale process built
around a bottleneck that no longer exists.

### 2. Drum-Buffer-Rope Scheduling

Plan the whole system's pace around the constraint, not around the start of
the pipeline.

- **Drum**: the constraint sets the rhythm — the schedule for the entire
  system is derived from its capacity, not from how fast work can be
  originated upstream.
- **Buffer**: a time or work cushion placed just before the constraint so it
  is never starved by upstream variability (a sick reviewer, a flaky
  dependency, a slow upstream team). Sized to absorb normal variation, not to
  hide a badly managed process.
- **Rope**: a signal that ties the release of new work at the front of the
  system to the actual consumption rate at the constraint — preventing
  upstream stages from overproducing and flooding the pipeline with
  half-finished work.

Result: the constraint is never idle (starvation) and the system never drowns
in half-done work (suffocation). In software delivery this looks like WIP
limits tied to the true bottleneck stage (e.g., "no more than N PRs open
pending review") rather than to arbitrary per-team ceilings.

### 3. Throughput vs. Local Efficiency (Cost of Local Optimization)

Maximizing utilization or output at a non-constraint step does not improve
system throughput — it only creates inventory (queued, unfinished work)
somewhere downstream, or upstream of the real constraint.

Every local decision must answer: *does this increase throughput of the
whole system, or does it just move (or hide) inventory?* A team that ships
code fast but stacks up unreviewed PRs is not more productive: the extra
"output" is inventory, not throughput, until it merges and reaches users.

### 4. Batch Size vs. Lead Time

Large batches reduce per-batch setup/overhead cost at one step but increase
inventory and lead time everywhere downstream — the classic large-release,
long-feedback-loop trap.

Small batches (small PRs, frequent deploys, single-piece flow) improve flow
and shorten feedback loops but raise per-unit overhead (more code reviews, more
deploy pipelines run). The right batch size is set by what serves the
constraint's throughput, not by what is most convenient at any other step.

## Application to Software / IT Flow

- Treat the delivery pipeline (idea → code → review → CI → deploy → operate)
  as one system with one goal: validated value reaching users. Local team
  velocity, commit counts, or individual "story points closed" are vanity
  metrics unless they translate into throughput at the pipeline's exit.
- Identify the true constraint with flow metrics: cycle time per stage,
  queue length before each stage, and time work sits idle vs. time actively
  worked. The stage with the largest queue and longest wait — not the busiest
  team — is usually the constraint.
- Common IT/software constraints: a single reviewer or approver, a shared
  staging environment, a manual QA step, a slow or flaky CI pipeline, a
  release-approval policy, a single subject-matter expert on legacy code, a
  shared database migration gate.
- Apply the five steps directly: exploit (protect the constrained
  reviewer/CI slot from noise and low-value work) before elevating (adding
  more reviewers, parallelizing CI, buying more runners).
- Use WIP limits (Kanban-style) as the practical Drum-Buffer-Rope
  implementation: cap in-flight work at the pace the constraint can absorb;
  stop pulling new tickets when the buffer in front of the constraint is
  full.
- Watch for policy constraints unique to software orgs: mandatory
  multi-approver sign-off, freeze windows, ticket-before-code processes, or
  architecture review boards that were sized for a different scale.

## Common Pitfalls

- **Optimizing the wrong step**: improving capacity upstream or downstream of
  the constraint wastes effort and often makes queues worse elsewhere.
- **Ignoring policy constraints**: the bottleneck may be a rule or an
  approval process, not a resource; fixing it requires organizational
  permission and courage, not more headcount.
- **Complacency after elevation**: once the constraint moves, old habits,
  buffers, and gates built for it persist and quietly become the next
  bottleneck. Re-identify regularly.
- **Mixing metrics**: pursuing local cost reduction (headcount, tool spend)
  while ignoring system throughput leads to cuts that slow delivery overall.
- **Overproduction**: without rope discipline, feeding more work into the
  system than the constraint can absorb creates inventory chaos — a backlog
  of half-finished work, not more delivered value.
- **Assuming one constraint forever**: as systems, teams, and codebases
  evolve, the constraint migrates; treat re-assessment as routine, not a
  one-time exercise.
- **Confusing activity with throughput**: high utilization, many open PRs, or
  a busy-looking team are not evidence of high throughput — only completed,
  delivered work counts.

## Why It Works

Most organizations measure and reward local efficiency: utilization rate,
cost per team, story points per sprint, lines of code shipped. Theory of
Constraints redirects attention to system outcome — throughput toward the
actual goal, per dollar and per unit of time spent. This produces
counterintuitive but correct moves: running the constraint at full capacity
even if it means deliberate idle time elsewhere, protecting a single
resource from "efficiency" pressure, or refusing to speed up steps that are
not the limiting factor.

Continuous improvement becomes a disciplined, repeatable cycle instead of
scattered local optimization and random firefighting.
