---
name: standards-audit
description: Use to audit an existing repository (or a fleet) against a standards canon — compare current state to the resolved profile, identify violations and ambiguities, produce a conformity report and a prioritized remediation plan. Triggers on "audit this repo", "is it compliant?", "where does this diverge from standards?", "compliance report", "remediation plan".
---

# standards-audit

> Inherits `governance-core`. Consumes the canon by reference. Read-only:
> proposes corrections, never auto-applies destructive or external ones.

## Role
Evaluate an existing project against the standards that apply to it, surface
gaps, violations, ambiguities and ID collisions, and deliver a conformity report
plus a prioritized, profile-aware remediation plan.

## Triggers
- "Audit / review this repo against standards"; onboarding a legacy repo;
  pre-release compliance check; fleet-wide conformity sweep; post-change drift
  check.

## Rules it applies (resolve from the canon by ID)
- The full resolved standard set for the repo's profile (mandatory /
  recommended / not-applicable) via `<standards_cli> profiles resolve` + managed
  block.
- Governance of findings: ID collisions are blocking; prose/machine divergence
  flagged; undecided (to-arbitrate) items surfaced, not enforced.
- Conformity authority: the conformity checker
  (`../../shared/references/conformity-and-gates.md`).

## Inputs it must gather before acting
1. The repo's declaration (profile, architecture level, lifecycle, standards
   version). A missing declaration is finding #0.
2. The reachable canon + conformity checker.
3. Existing baselines/exceptions and their ADRs (owner + expiry).

## Execution steps
1. **Resolve the applicable set** for the profile — and explicitly the
   **not-applicable** set, so the audit does not penalize rules that do not
   apply (no arbitrary over-application).
2. **Evaluate**: run the conformity checker + the gates read-only; inspect
   structure, contracts, containers, observability, SCM policy.
3. **Classify each finding**: the violated ID, severity (by priority tier and
   maturity marker), evidence/location, and whether a valid exception (ADR)
   already covers it. Separate real violations from ambiguities and from
   not-applicable rules.
4. **Flag structural issues**: ID collisions (blocking), prose/machine
   divergence, missing owners/expiries on exceptions, expired baselines.
5. **Write the conformity report**: per-domain status, covered vs violated vs
   not-applicable, with evidence.
6. **Build the remediation plan**: prioritized (top tier first), profile-aware
   (respect maturity — do not demand level-3 ceremony from a level-0 tool), each
   item an atomic, sequenced action with the owning skill; mark which items are
   `manual-required`.

## Validation criteria (exit criteria)
- Every finding cites a standard ID + evidence; not-applicable rules are listed
  as such.
- Ambiguities surfaced with a proposed ADR/decision, not enforced.
- Remediation items are prioritized, atomic, sequenced, and attributed; none is
  a destructive or external action performed during the audit.

## Interactions with other skills
- Read-only; delegates fixes to `development-conventions` /
  `infrastructure-execution` / `observability-diagnostics` /
  `ui-ux-interaction`, gated by `quality-validation` and executed via
  `external-actions`.
- Uses the same maturity model as `project-bootstrap`.

## Limits
- **Audit is read-only.** It does not modify the repo, and never auto-applies a
  remediation — it proposes.
- Does not invent decisions for undecided items or for a missing profile.
- Does not mark the project compliant on its own unvalidated assessment for any
  gate that is `manual-required`.

## Actions requiring human validation
- Applying any remediation (handed to the owning skill + `external-actions`).
- Accepting/renewing an exception or baseline (ADR + owner + expiry).
