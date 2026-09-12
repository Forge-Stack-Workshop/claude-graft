---
name: governance-core
description: The spine of the standards-governance skill set — consult it at the start of ANY project, development, audit or technical task governed by a standards canon, and whenever rules conflict, a standard is ambiguous, an action has external/irreversible impact, or you must decide whether a task is "done". It sets the rule hierarchy, conflict handling, human-validation posture and maturity adaptation that every other governance skill inherits.
---

# governance-core

> The spine. Every other governance skill inherits this one. It does not do the
> work of a level; it sets the posture all levels follow and routes to them.
> All specifics come from `config.yaml` and the standards canon, never from a
> hard-coded project.

## Role
Establish and enforce the operating posture for technical work under a standards
canon: which source of truth wins, how standards bind, how to adapt to a
project's nature and maturity, how to detect and resolve conflicts/ambiguities,
when to stop for human validation, and what "done" means. It is the dispatcher
that hands a task to the right level skill while keeping the invariants intact.

## Triggers
- The start of any governed task: new project, feature work, refactor, audit,
  infra change, release, investigation.
- Any time two rules, sources, or instructions disagree.
- Any time a standard is marked undecided (to-arbitrate) or is missing.
- Any time an action may have effects outside the local sandbox, be
  irreversible, or carry significant impact.
- Any time you are about to call a task, gate, or project "done".

## Rules it applies (resolve from the canon by ID)
- The governance/lifecycle domain of the canon, plus the configured invariants
  (`../../shared/references/standards-model.md`).
- Source-of-truth and precedence: `../../shared/references/rule-hierarchy.md`
  (*in case of divergence, the canon wins*).
- It does **not** itself carry domain rules; it points each level skill at the
  standard domains it owns.

## Inputs it must gather before acting
1. The task's intent and blast radius.
2. The target repo's declaration (`../../shared/references/profiles-and-maturity.md`).
   If absent, flag it.
3. The reachable canon path (CLI / conformity checker / managed block / local
   artefact) per `../../shared/references/consuming-the-canon.md`.

## Execution steps
1. **Orient.** Identify the governance level(s) the task touches and hand off to
   the matching skill(s): bootstrap, development, infrastructure, quality,
   observability, audit, ui-ux, external-actions. Several may apply at once.
2. **Resolve authority.** Establish the reachable canon source. If none is
   reachable, announce it and restrict yourself to invariants.
3. **Set the maturity frame.** Read the project's profile / architecture level /
   lifecycle state; decide the implementation depth, keeping all invariants.
4. **Carry the hierarchy.** For every decision, apply `rule-hierarchy.md`. When
   sources disagree, run the conflict procedure (`../../GOVERNANCE.md` §3): name
   it, state which wins and why, resolve or escalate.
5. **Guard the boundary.** Before any action, classify its risk R0–R5
   (`../../shared/references/risk-and-human-gates.md`). Route anything R≥3 or
   `manual-required` through `external-actions` and obtain explicit human
   validation.
6. **Gate "done".** Do not let any skill declare completion until the
   exit-criteria in `../../shared/references/conformity-and-gates.md` are
   verified.

## Validation criteria (exit criteria)
- The correct level skill(s) were engaged and their validation criteria met.
- Every conflict/ambiguity encountered was named and resolved by the hierarchy,
  or escalated — none silently simplified.
- No invariant was weakened to fit the project's maturity.
- Every R≥3 action was human-validated before execution.
- Conformity was verified (not asserted) before "done".

## Interactions with other skills
- **Parent of all**: every other skill inherits this posture.
- **Dispatches to**: `project-bootstrap`, `development-conventions`,
  `infrastructure-execution`, `quality-validation`,
  `observability-diagnostics`, `standards-audit`, `ui-ux-interaction`.
- **Always funnels effects through**: `external-actions`.

## Limits
- Does not implement domain work itself; it governs and routes.
- Does not override the canon — it applies it. If it seems to contradict the
  canon, it is stale and the canon wins.
- Does not decide undecided (to-arbitrate) items; it surfaces them.

## Actions requiring human validation
- Any decision that would weaken an invariant or a top-tier standard "for this
  project" — requires an ADR with owner + expiry, approved by the human.
- Any R≥3 / `manual-required` action (delegated to `external-actions`).
- Declaring a task/gate/project "done" when conformity could not be verified.
