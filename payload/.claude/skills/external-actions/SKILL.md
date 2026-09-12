---
name: external-actions
description: The single choke point for any action with effects outside the local sandbox — Git pushes, PRs/merges/issues, CI/CD, releases, cluster/infra apply, deploys, external service calls, sends, payments, and destructive or structural changes to a knowledge base or tracker. Every other skill routes such actions here. Enforces the R0–R5 risk scale, the manual-required list, and the R3–R5 human-approval protocol. Never auto-merges to the protected branch, never deploys by hand, never self-approves.
---

# external-actions

> Inherits `governance-core`. The one place out-of-sandbox effects happen, so the
> human-validation gates are enforced consistently. Policy specifics come from
> `config.yaml` → `scm` / `human_validation`.

## Role
Gate and execute actions that reach beyond the local working tree. Classify
risk, obtain proportionate human validation, prefer dry-run, and refuse what is
`manual-required`. Propose corrections; never auto-apply a destructive or
external fix.

## Triggers
- Any Git op beyond local edits (push, branch policy, PR, merge, tag); issues /
  PRs / releases; CI/CD changes or runs with effects; cluster/infra apply;
  deploy/promotion; calling an external service; real send/payment; destructive
  or structural changes to a knowledge base / tracker; deletion outside a test
  sandbox.

## Rules it applies (resolve from the canon by ID)
- The risk scale, `manual-required` list, and R3–R5 protocol:
  `../../shared/references/risk-and-human-gates.md`.
- SCM & branch policy (`config.yaml` → `scm`): protected branch (no direct/force
  push or delete); only a PR from the working branch; release triggers
  production; no manual deploy; one PR per issue + issue link; Conventional
  Commits.
- Agentic safety: minimal permissions, allowlist, clean refusal out of scope;
  idempotence/timeout/limits/circuit breaker/rollback; **no automatic merge to
  the protected branch by an agent**.
- Supply chain / deployment: CI actions pinned by digest; signed/pinned
  artefacts.

## Inputs it must gather before acting
1. The exact action, its target, and its full blast radius.
2. Its risk level R0–R5 and whether it is `manual-required`.
3. Gate status from `quality-validation` (no merge/release on red).
4. For R3–R5: the content fingerprint to bind the approval to.

## Execution steps
1. **Classify** R0–R5; identify `manual-required` actions up front.
2. **Prefer dry-run / plan**; show exactly what will happen (diff, command,
   target, blast radius).
3. **R0–R2**: may proceed, reported and reversible.
4. **R3–R5**: stop. Present the plan + risk, request explicit human validation;
   execute only in a **strictly later exchange**, against a **single-use**
   approval bound to `action_id` + task + a **fingerprint of the exact content
   shown**, within a short window. If the content changed, the approval is void.
5. **`manual-required`**: never execute automatically — hand to the human
   regardless of any standing authorization (real sends, payments, deletion
   outside test sandbox, merge to the protected branch, manual deploy,
   destructive knowledge-base/tracker changes).
6. **Git**: land on the protected branch only via a PR from the working branch;
   never direct/force push; releases trigger production; one PR per issue with
   the issue linked.
7. **On a detected gap**: propose the correction; do not auto-apply a destructive
   or external change.
8. **Record**: idempotent where possible; provenance/audit trail kept.

## Validation criteria (exit criteria)
- Every executed action had the right approval for its risk level, with the
  R3–R5 protocol honoured where required.
- No `manual-required` action was auto-executed; no auto-merge to the protected
  branch; no manual deploy.
- Gates were green before any merge/release.
- Actions are idempotent/reversible or protected by a documented rollback.

## Interactions with other skills
- Invoked by **every** other skill when they reach an out-of-sandbox effect.
- Depends on `quality-validation` for the green-gate precondition.
- Reports destructive-op posture consistent with `governance-core`.

## Limits
- Does not decide business questions; executes validated technical actions.
- Does not widen its own permissions or grant itself elevated access.
- Does not treat a prior approval as reusable or as covering a changed action.

## Actions requiring human validation
- All R3–R5 actions (push to remote, PR, **merge**, tag/release, infra apply,
  **deploy**, external calls).
- All `manual-required` actions (real send, payment, deletion outside test
  sandbox, destructive/structural knowledge-base change, marking work "done" on
  unvalidated output).
