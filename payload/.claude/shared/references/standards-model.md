# Standards model (the shapes the skills assume)

The skills enforce a **model**; your canon provides the **content**. This file
describes the shapes a skill reasons about so it knows *what to resolve* from
the canon — it is **not** the rule text and carries no specific rules. When it
drifts from the canon, the canon wins.

## Standard identifiers

The skills address standards **by ID** and resolve the text from the canon.
Two common shapes (either or both may exist in a canon):

- **Domain IDs** — one per subject area (API & contracts, data & migrations,
  governance & lifecycle, observability & readiness, supply-chain security,
  configuration, deployment, privacy, testing, UI states, eventing,
  performance, SCM, …). Each domain typically carries: ID, title, home
  (document/annex), a rule prefix, a priority, a status/owner.
- **Rule IDs** — individual rules inside a domain, usually prefixed per area.

A standard worth enforcing is expected to be publishable in a structured,
stable form with at least: **identifier, version, status, owner, scope,
profiles, automated controls, provenance, checksum**. A rule that cannot be
indexed or tied to a profile is incomplete — treat it as advisory until it is.

## Priority tiers (`config.yaml` → `model.priority_tiers`)

Highest first (e.g. `P0 > P1 > P2`). A top-tier invariant is never traded away
for a lower-priority convenience.

## Maturity / adoption markers (`model.maturity_markers`)

Strongest first (e.g. `adopted > derived > suggestion > to-arbitrate`):

- **enforceable** (`model.enforceable_marker`): blocking **only if** it has a
  stable ID, an owner and an automated gate.
- **derived**: validated from real repos — strong guidance, not a hard gate.
- **suggestion**: advisory; propose, do not enforce.
- **to-arbitrate**: undecided — surface it, propose an ADR/decision task, never
  enforce or invent a decision.

## Profiles & architecture levels

See `profiles-and-maturity.md`. The profile selects the applicable / not
applicable standards; the architecture level scales the implementation depth.

## Invariants (`model.invariants`)

The few non-negotiables that hold across every profile, technology and maturity
level. Resolve the full set from the canon; optionally pin the always-on ones in
`config.yaml` so they still apply when the canon is unreachable.

## How a skill uses this model

1. Read the repo's declaration (profile, architecture level, lifecycle,
   standards version).
2. Resolve the applicable standards for that profile from the canon
   (`consuming-the-canon.md`).
3. Rank them by priority tier and maturity marker.
4. Enforce only the enforceable ones; surface the rest as guidance or open
   questions.
