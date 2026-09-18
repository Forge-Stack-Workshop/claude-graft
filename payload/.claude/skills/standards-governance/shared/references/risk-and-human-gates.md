# Risk levels & human-validation gates

The shared contract every skill uses to decide **what it may do automatically**
vs **what requires explicit human validation**. Extend the manual-required list
with environment specifics via `config.yaml` → `human_validation.manual_required_extra`.

## Risk scale R0–R5

Classify every action before doing it. Confirmation is **proportionate** to the
level; prefer a **dry-run** whenever one is possible.

- **R0** — pure read / inspection, no state change. Auto.
- **R1** — local, reversible change inside the working tree (edit a file, write
  a scratch artefact). Auto, with a summary.
- **R2** — reversible change to shared local state (create a branch, a draft PR,
  a local commit on a non-protected branch). Auto, reported; reversible.
- **R3** — change with outside-visible effect that is still recoverable (push to
  a non-protected branch, open/update a PR, create an issue, non-destructive
  write to a tracked tool). **Confirmation required.**
- **R4** — change that is hard to reverse or has real impact (merge, tag a
  release, infra apply, schema/data migration, destructive-capable tool call).
  **Strong confirmation required**, with the R3–R5 protocol below.
- **R5** — irreversible or high-blast-radius (delete outside a test sandbox,
  real external send, payment, production deploy, destructive/structural change
  to a knowledge base or tracker). **`manual-required` always.**

## `manual-required` — never automatic, whatever the prior authorization

- Real external send (message/email to real recipients), payment, or any
  deletion outside a test sandbox.
- **Merge to the protected branch** — *no automatic merge by an agent*, ever.
- **Manual deploy from a workstation** — forbidden; production is triggered by a
  release, not by hand.
- Destructive or structural changes to a knowledge base / tracker: deletions,
  merges, structural edits, and business decisions.
- Marking a **task, gate, or project as done** on the agent's own unvalidated
  output. An agent may *propose* missing framing; it must not invent a business
  decision.
- Physical / access-control actions without a business policy, strong
  confirmation and an immutable audit trail.
- Anything listed in `config.yaml` → `human_validation.manual_required_extra`.

## R3–R5 approval protocol

- The action is **prepared in one exchange and executed in a strictly later
  one** — the approval counter does not belong to the agent.
- The approval carries a **fingerprint of the exact content shown** to the
  human; if the content changes, the approval is void.
- Authorization is **single-use**, bound to an `action_id` + the task, with a
  **short validity window**.
- Destructive capabilities stay `manual-required` regardless of any standing
  authorization.

## Git / SCM gate (from `config.yaml` → `scm`)

- The protected branch (default `main`) = deployed production code: no direct
  push, no force-push, no deletion.
- The working branch (default `develop`) is the default. The only way onto the
  protected branch is a PR from the working branch. A release triggers
  production.
- Hotfix branches merge to the protected branch via PR **and** back to the
  working branch.
- One PR per issue; link the issue; Conventional Commits (when enabled).

## Destructive operations (default posture)

- Prefer **logical deletion, trash, or quarantine** over hard destruction.
- Destructive operations must be transactional, compensable, or protected by a
  documented rollback strategy.
- Execution of generated code / dependency installs / system commands runs in
  the configured sandbox (`tooling.sandbox`), network off by default, deps
  pinned, provenance recorded.

## What a skill does at an R≥3 boundary

1. Stop before acting.
2. Show exactly what will happen (diff, command, target, blast radius) and its
   risk level.
3. State it needs explicit human validation, and why.
4. Wait for approval in a later exchange (R3–R5 protocol). Never self-approve.
