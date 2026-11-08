---
name: development-conventions
description: Use when writing or changing code under a standards canon — implementing a feature, refactoring, designing architecture, adding tests, writing docstrings/docs, or managing dependencies and the dev environment. Applies the development conventions (architecture, code quality, testing, documentation, dependencies) proportionate to the project's profile and architecture level.
---

# development-conventions

> Inherits `governance-core`. Consumes the canon by reference. All thresholds,
> tool names and rule text come from the canon / `config.yaml`, never hard-coded.

## Role
Apply the development conventions while building or changing code: architecture
(proportionate to the domain), code quality, tests, documentation, and
dependency/environment hygiene — so the change is conformant before it ever
reaches a gate.

## Triggers
- Implementing/modifying a feature; refactoring; designing a module or
  architecture; adding or changing tests; writing docstrings/README/ADR;
  adding/upgrading/removing dependencies; setting up the dev workflow.

## Rules it applies (resolve from the canon by ID)
- Architecture: domain independent of frameworks/infra; aggregates with a single
  root; one transaction per aggregate; immutable value objects; depth
  proportionate to the architecture level (`profiles-and-maturity.md`).
- API & contracts, and decoupling — cross-repo only via published versioned
  contracts.
- Code-quality invariants: no hardcoded constants/secrets; size/complexity
  limits (function / file / cyclomatic); lint-clean; typing-clean — resolve
  exact thresholds from the canon, do not assume.
- Testing: risk-based; the canon's test runner and strict markers; resolve the
  coverage threshold from the canon.
- Docs: docstrings where required; per-folder README; ADRs for the *why*.
- Dependencies/env: pinned versions + lockfile; centralized project config;
  prefer a shared brick over duplication; avoid local installs where the canon
  mandates container/remote-first.
- AI features: no vendor LLM SDK in a feature — use the configured LLM
  abstraction layer (`tooling.llm_abstraction`).

## Inputs it must gather before acting
1. Project profile + architecture level + bounded context (sets architecture
   depth).
2. The resolved standards for this profile and the current gate thresholds.
3. Existing module structure and public contracts it must not break.

## Execution steps
1. **Frame the design** at the right architecture level; keep the domain
   framework/infra-independent; reuse transverse libraries instead of
   duplicating (without multiplying libraries).
2. **Implement** with no hardcoded constants/secrets, within size/complexity
   limits, typed, lint-clean as you go.
3. **Test** risk-first; add/adjust tests and fixtures with strict markers; cover
   error paths.
4. **Document** docstrings + per-folder README; write an ADR for any non-obvious
   decision or deviation (owner + expiry).
5. **Manage deps** with pinning + lockfile; justify each new dependency; prefer
   an existing shared brick.
6. **Pre-gate self-check**: run the language gate locally before handing to
   quality (`../../shared/references/conformity-and-gates.md`).

## Validation criteria (exit criteria)
- Language gate passes locally (the canon's set for the stack).
- Error DoD met: expected errors documented, tested, surfaced, correlated,
  recoverable.
- No hardcoded constants/secrets; size/complexity within limits; docs present.
- No broken public contract; no cross-repo coupling introduced.

## Interactions with other skills
- Defers the final mechanical verdict to `quality-validation`.
- Defers container/run/deploy concerns to `infrastructure-execution`.
- Defers logging/metrics/traces design to `observability-diagnostics`.
- Defers user-facing UI behaviour to `ui-ux-interaction`.
- Routes commits/pushes/PRs through `external-actions`.

## Limits
- Does not merge, push to protected branches, or deploy.
- Does not decide undecided (to-arbitrate) conventions — it flags and follows
  the current canon default.
- Does not install/run generated code outside the configured sandbox.

## Actions requiring human validation
- Introducing a new external dependency with real supply-chain impact (review).
- Any deviation from an architecture/quality invariant (ADR + owner + expiry).
- All SCM effects (commit on protected branch, push, PR) → via `external-actions`.
