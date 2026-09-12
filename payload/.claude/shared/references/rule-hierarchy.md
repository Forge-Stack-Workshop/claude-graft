# Rule hierarchy & precedence

When two rules, sources, or instructions disagree, resolve the conflict with
this order. Never silently pick one side — name the conflict, state which rule
wins and why (`../../GOVERNANCE.md` §3, Conflict detection).

## A. Source of truth (authority over *what the rule is*)

1. **The canon** (`config.yaml` → `canon.source`): the executable standards.
   *In case of divergence, the canon wins.*
2. **Code, published contracts, runtime state** — authority over *technical
   facts* (what the system actually does). Docs and knowledge bases must be
   realigned to these, not the reverse.
3. **Recent explicit human decisions** — outrank older generated content,
   snapshots, or these skills.
4. **Knowledge base / tracker views** — a governance & decision view. It
   governs no repo and is not distributed. Useful for intent and history, not
   for enforcement.
5. **These skills** — the agent-facing rendering of governance. If a skill
   diverges from the canon, the canon wins and the skill is stale: flag it,
   follow the canon.

## B. Strength of a standard (authority over *whether it binds*)

1. **Priority**: the canon's tiers, highest first (`model.priority_tiers`, e.g.
   `P0 > P1 > P2`). A top-tier invariant is never traded away for a
   lower-priority convenience.
2. **Maturity / adoption marker** (`model.maturity_markers`, strongest first):
   - **enforceable** (`model.enforceable_marker`, e.g. `adopted`) — blocking
     *only if* it has a stable ID, an owner and an automated gate.
   - **derived** — validated from real repos; strong guidance, not a hard gate,
     until promoted.
   - **suggestion** — advisory; propose, do not enforce.
   - **to-arbitrate** — **undecided**. Do not enforce and do not invent a
     decision; surface it and propose an ADR / decision task.
3. **Invariants** (`model.invariants`) are non-negotiable: they hold across
   every profile, technology and maturity level.

## C. General rule vs project-specific constraint

- A project may narrow or extend a rule via its declared profile and its ADRs.
  A project-specific constraint does **not** silently override a top-tier
  invariant.
- Legitimate deviation requires an **ADR** with an owner and an expiry date.
  No ADR ⇒ the general rule stands.
- When a project constraint and a non-invariant standard genuinely conflict,
  apply the hierarchy above, record the resolution, and flag it for human
  confirmation if it touches a gate.

## D. Prose vs machine-readable

- When human-readable prose and a machine file (the ID index, a lockfile, a
  gate config, an API spec) disagree, the **machine file / canon wins**; the
  prose is to be realigned. (Prose and machine copies drifting apart is a common
  root cause of divergence.)

## E. Identifier collisions

- Any ID collision (two standards sharing a key) is a **blocking error**. Stop,
  report it, do not guess which one is intended.
