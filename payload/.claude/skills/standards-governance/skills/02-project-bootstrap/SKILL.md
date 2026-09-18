---
name: project-bootstrap
description: Use when starting, initializing, or onboarding a repository under a standards canon — "set up this project", "init a new service/library/frontend", scaffolding a repo, or adapting an existing/legacy repo to the standards. Detects project nature, maturity, architecture and environment, then initializes conformantly without over-architecting.
---

# project-bootstrap

> Inherits `governance-core`. Consumes the canon by reference
> (`../../shared/references/consuming-the-canon.md`). All specifics come from
> `config.yaml` and the canon.

## Role
Bring a repository to a conformant starting state: determine what it is
(profile), how much architecture it earns (architecture level), its environment
and existing ecosystem ties, then initialize the expected structure and its
declared standards — proportionate to the project's nature and maturity.

## Triggers
- New repo / "initialize this project" / "scaffold a service|library|frontend|
  worker|cli|game|infrastructure".
- Adopting an existing or legacy repo into the standards.
- Missing project declaration or missing expected baseline files.

## Rules it applies (resolve from the canon by ID)
- Profiles & architecture levels & declaration:
  `../../shared/references/profiles-and-maturity.md`.
- Expected baseline & managed block: prefer the configured bootstrap tool
  (`tooling.bootstrap_tool`) and generators over hand-rolling, so the managed
  block (`canon.managed_block_marker`) and CI come from the source, not copies.
- Decoupling from day one and public contracts (resolve the relevant domains).
- Invariants from the first commit (`../../shared/references/standards-model.md`).

## Inputs it must gather before acting
1. Intended profile, language, deployment target, bounded context, domain
   complexity (→ architecture level), lifecycle state.
2. Whether the bootstrap tool / generators / shared-brick source
   (`tooling.shared_bricks_source`) are available (prefer them over hand-rolling).
3. For an existing repo: current structure, what already conforms, what
   diverges (hand the divergence inventory to `standards-audit`).

## Execution steps
1. **Detect nature & maturity.** Resolve or propose the declaration keys
   (`model.declaration_keys`); write the declaration. Do not over-architect a
   small tool (level-0/1).
2. **Resolve applicable standards** for that profile (`<standards_cli> profiles
   resolve …` / managed block): mandatory / recommended / not-applicable.
3. **Initialize via the canonical tooling** where possible so baseline files,
   the managed block and CI come from the source, not copies. Generated agent
   files are generated, never hand-edited.
4. **Establish the baseline**: expected per-folder docs, an ADR folder, the
   managed standards block in the agent file, container and build scaffolding by
   reference to the infrastructure skill.
5. **Wire decoupling**: public versioned contracts only; no cross-repo
   imports/paths/DB access.
6. **Record deviations** as ADRs (owner + expiry) rather than silent choices.

## Validation criteria (exit criteria)
- The project declaration exists and matches reality.
- Applicable standards resolved and the mandatory ones are in place or tracked.
- Baseline files present; generated renderings are generated, not hand-written.
- The conformity checker runs on the fresh repo; first gate status recorded
  (`../../shared/references/conformity-and-gates.md`).

## Interactions with other skills
- Hands architecture/code/test setup to `development-conventions`.
- Hands container/run setup to `infrastructure-execution`.
- Hands first conformity run to `quality-validation`.
- Hands existing-repo divergence to `standards-audit`.
- Routes repo creation / first push / remote setup through `external-actions`.

## Limits
- Does not deep-audit an existing codebase (that is `standards-audit`).
- Does not invent a profile or a decision when the human has not chosen one —
  it proposes and asks.

## Actions requiring human validation
- Creating the remote repository, first push, configuring branch protection /
  CI secrets (R3–R4, via `external-actions`).
- Any profile/gate relaxation (ADR + owner + expiry, human-approved).
