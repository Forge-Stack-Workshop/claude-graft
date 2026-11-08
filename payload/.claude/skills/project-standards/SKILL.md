---
name: project-standards
description: Frame, audit or bring a project up to the engineering baseline — container-only execution, one-command startup, quality and observability, reactive interfaces where relevant, compatibility with the shared standards, and human approval before external actions. Use when bootstrapping a project, auditing a repository, or reviewing before a deployment.
---

# Project standards — framing, audit, conformance

Applies a single recurring method to three situations: bootstrapping a new project, auditing an existing repository, and reviewing readiness before a deployment.

## Source of truth

This skill carries the **method**, never the values. Every concrete rule — registry names, domains, secret backend, coverage threshold, identifier taxonomy, required files — is read from the project's own canon (the shared standards repository, its CLI, its config or manifest). Never restate a rule here; resolve it from the canon and cite where it came from. If the canon is unreachable, say so and fall back to the checks below without inventing values.

Anything written to disk (identifiers, file names, commits, docstrings, rules) is in English regardless of the conversation language.

## Step 0 — frame before auditing (mandatory)

Never apply the full grid blind. Establish first:

1. **Nature** — service, library, CLI, game, data pipeline, infrastructure module, documentation hub, physical or non-software work.
2. **Maturity** — idea / incubating, active, foundational (other projects depend on it), watched, parked.
3. **Horizon** — now, next, later, blocked, needs framing, archive review.

If that information is missing, ask for it in one question before producing anything.

### Scope by maturity

| Maturity | What is required |
|---|---|
| Idea, incubating, needs framing | Framing only: problem, kill criteria, reusable pieces already available. **No** infrastructure requirement. |
| Active (now / next) | Full grid below; gaps ranked P0 / P1 / P2. |
| Foundational | Full grid **plus** a decision record for every structural choice, and a stability contract for consumers. |
| Watched, parked, later | Documentation audit only — what exists, what blocks. Industrialize nothing. |
| Non-software or design-stage | Axes 1–4 do not apply. Keep documentation, decisions and acceptance criteria. |

An axis that does not apply is marked **N/A with the reason**, never silently dropped and never faked.

## The six axes

### 1. Container-first, containers only
- Everything runs in a container. No host-level dependency, no "works on my machine" step.
- Multi-stage build, non-root image, pinned versions, build context excluded properly.
- A compose file (or equivalent) for local development; deployment manifests live **in the project repository** so it is plug-and-play for the delivery pipeline.
- Secrets come from the secret store the canon designates — never in the repository, never baked into the image.
- Exposure goes through the canonical ingress and naming scheme; no ad-hoc hostnames.

### 2. One-command startup
- A single documented command at the top of the README brings up a working environment. Use the same verb across every project.
- It covers build, dependencies, migrations, seed data, health check, and prints the URL at the end.
- Symmetry is required: stop, test and lint have equally short commands.
- If the command does not succeed on a clean machine, that is a **P0** gap.
- Preserve a project's historical CLI name when it has one.

### 3. Quality and observability
- Automated tests with a stated coverage threshold, lint and static analysis green, all executed in CI defined inside the repository.
- Validation gates on every exposed surface: end-to-end checks for UI, schema-driven fuzzing for APIs, contract diffing to catch breaking changes.
- Health endpoint, structured logs, metrics exposed in the canonical format, and a minimal dashboard for anything deployed.
- **Anything exposed to a user must offer a path to file a bug as a tracked ticket.** End users see simple product-level statuses — never internal discussion, never Git state.
- Ship small and early: minimal deployable version, canary, user feedback — do not wait for the foundation to be finished.

### 4. Reactive interfaces — where relevant
Applies only when the project has a UI whose state changes server-side (jobs, streams, dashboards, notifications).
- Push state rather than relying on manual refresh; loading, error and empty states are explicit.
- Optimistic updates must reconcile; never silently diverge from the server.
- Each project keeps its own visual identity — not one shared base recolored by an accent.
- CLI tools, batch jobs and libraries: mark the axis **N/A** and move on. Do not invent an interface.

### 5. Compatibility with the shared standards
- The standards repository is the authority on rules; the shared development kit is what projects **consume** — never copy its pieces into the project.
- The canon's required files must all be present and current (readme, architecture, data model, routes or public surface, component inventory, ignore rules, CI workflows).
- Agent and assistant instruction files are **generated renders** of a neutral doctrine source — never hand-edited, and never vendor-specific, which would be hidden lock-in.
- Identifier taxonomy, cross-cutting architecture patterns and authentication follow the canon; verify with the conformance checker when one exists.
- Tool split stays as the canon defines it: one system for vision and decisions, one for atomic tasks and execution order, one for code and releases, and chat tools for notifications only — never a source of truth.

### 6. Human approval before external actions
No action with an effect outside the sandbox proceeds without explicit approval: writes to the project tracker or knowledge base, push / PR / merge / release, deployment, DNS or registrar changes, secret writes, sending mail or messages, deleting files.

Procedure: present the plan or the diff → wait for the go-ahead → execute → report back. Reads and analysis are exempt. Batch approval requests instead of asking one at a time.

## Deliverables

**Audit** — one row per axis:

| Axis | Verdict | Finding | Gap | Priority |
|---|---|---|---|---|

Verdicts: conforming, partial, absent, or N/A with its justification. Then convert gaps into **atomic tasks**, each independently shippable, flagging those that are shared across projects — those belong in the development kit or the standards repository, not in this project.

**Bootstrap** — the same grid read backwards: what must exist at the first commit given the target maturity, plus the decision records to write.

**Structural choice** — a decision record (context, options, decision, consequences) committed to the repository.

## Anti-patterns to flag

- Host installation, or a "run this after installing X" step.
- Hand-edited generated instruction files, or configuration specific to a single assistant vendor.
- A shared-kit component duplicated inside the project.
- Tracker entries, tasks or deployments created without explicit approval.
- The full grid forced onto an unframed idea, or infrastructure requirements pinned on non-software work.
- A schedule or tracking surface living in an isolated HTML file instead of the system of record.
- Rules restated inside this skill or inside a project instead of resolved from the canon.
