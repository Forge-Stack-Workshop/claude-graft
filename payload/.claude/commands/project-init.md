---
description: Finalize the Claude setup for this project — discover the code, interview the developer layer by layer, then write the project-specific configuration
argument-hint: [optional hint about the project]
---

You are finalizing the Claude Code setup for this project. The shared doctrine
is already installed in `.claude/rules/`. Your job is everything that is
specific to **this** project.

Optional hint from the developer: $ARGUMENTS

This is an **interview**, not a form. Go layer by layer, and do not move to the
next layer until the current one is settled. Never invent an answer the
developer should give — a plausible guess written into `CLAUDE.md` is worse
than an open question, because it will be trusted later.

---

## Layer 0 — Discover before asking

Read the repository first. Never ask what the code can tell you. Establish:

- **Stack**: languages, frameworks, versions. Read the manifests
  (`pyproject.toml`, `package.json`, `go.mod`, `Cargo.toml`, …), not the
  imports.
- **Layout**: top-level directories, where the domain lives, whether the
  hexagonal layering in `rules/architecture.md` is already respected or
  violated.
- **Commands**: how it builds, tests, lints, runs. Read the `Makefile`, the
  npm scripts, the CI workflow. Prefer what CI actually runs.
- **Environment**: how many Dockerfiles, and do they share a base? Is there a
  compose file, a committed `.env`, a `.venv` or `node_modules` used as the
  real workflow? **Which commands only work on the host?** Check the README and
  the CI workflow: a task documented as a bare host command is a gap. Note
  every one against `rules/environment.md` — this is the developer's stated
  hard line, and the most likely place an existing project fails it.
- **Database**: engine, migration tool, where the schema lives.
- **Tests**: framework, where they live, whether coverage is measured.
- **Documentation**: is there a `mkdocs.yml`? A `docs/` tree? Do `docs/flows/`
  and `docs/coverage.md` exist, and are they current or abandoned? An
  out-of-date flow document is worse than none — flag it as debt, loudly.
  Is the site built and served in the container, or does it assume a host
  toolchain?
- **Git**: default branch, commit message style already in use.

Then state what you found in a short table, and **name what you could not
determine**. Only then start asking.

---

## Layer 1 — Product and intent

The code cannot tell you this. Ask, one focused round at a time:

- What is this product, in one sentence? Who uses it?
- What is the current objective — the thing being built right now?
- What is explicitly **out of scope**?
- What is the failure that would hurt most? (data loss, downtime, wrong
  numbers, leaked data — this drives where rigour goes)
- What stage is it at: prototype, in production, legacy under repair?

## Layer 2 — Rules and points of attention

- Walk through the gaps found in Layer 0 against the shared doctrine. For each,
  ask whether it is a debt to record or a deliberate exception.
- If the project has more than one Dockerfile, check whether they share a base.
  If they do not, say what has already drifted between them — concretely, by
  diffing the versions — rather than raising it as a principle.
- Ask what recurring mistakes the developer wants prevented on this project
  specifically.
- Ask for any project rule not covered by `.claude/rules/`. Offer to write it as
  a new rule, and ask whether it should load always or only under a path glob.
- Confirm the numeric thresholds in `.claude/thresholds.json` against this
  codebase. If most existing files already violate one, say so — a threshold
  that is violated everywhere trains everyone to ignore the warnings.
- **The gold book** (`code-flow.md`): ask which existing features already
  deserve a flow document, and in what order. On an existing codebase this is a
  backlog, not a one-shot — propose the two or three flows that would pay off
  first, chosen by where production incidents actually happen. Offer to write
  the first one with `/code-flow` before the setup is declared finished, and
  seed `docs/coverage.md` with what the code demonstrably does not handle.

## Layer 3 — Tools and workflow

- Which path-scoped rules match nothing in this project? A rule whose globs
  never fire costs nothing, but say which ones are inert so the developer knows
  what is actually governing the code. Remove one only if asked.
- **Run `python3 .claude/tools/which-rules.py`** and show the developer what
  actually loads. A rule listed as inert whose subject the project *should*
  have — no Dockerfile, no CI workflow — is a gap to fix, not a rule to delete.
  If the container chain is missing, offer the `project-scaffold` skill now.
- **Recommend skills.** Beyond the two shipped (`project-scaffold`,
  `feature-flow`), propose skills for repeatable multi-step procedures this
  project actually has — a release flow, a migration procedure, a review
  checklist. The test: a *procedure* is a skill, a *constraint* is a rule. Say
  which it is and why. Ask before creating any.
- **Recommend subagents.** Two ship with the template: `flow-tracer` (fan-out
  reading, small output) and `conformance-reviewer` (independent of the
  implementation reasoning). Propose more only where a genuinely separate
  context pays. Be conservative: ten agents nobody invokes is worse than none.
- **Session recording.** If `.claude/session-recording.json` exists, ask
  whether transcripts should be committed — yes for an interview or an audit,
  gitignored when the point is only continuity — and reflect the answer in
  `.gitignore`. If it does not exist, mention that `--with-recording` adds it.
- **MCP servers.** The template ships none on purpose: an MCP server connects
  *this project's* external systems, so there is nothing generic to install.
  Ask what Claude would need live access to — the database, the issue tracker,
  monitoring, a browser — and whether the value beats the context and
  permission cost. Write `.mcp.json` only for what the developer confirms.
- Ask what the developer wants Claude to do without asking, and what must
  always require confirmation. Translate the answer into `permissions` in
  `.claude/settings.json` — allow/deny/ask — and say plainly which of their
  answers became an enforced rule and which stayed advisory.

## Layer 4 — How the developer wants to work

- How should Claude deliver work: plan first, or act then report?
- What does "done" mean here — tests green, CI green, deployed?
- Which parts of the codebase are sensitive enough to always warrant a plan
  before touching them?

---

## Then write

Only once the layers are settled:

1. **`CLAUDE.md`** at the project root. Under 200 lines. It contains what is
   true of this project and nothing that `.claude/rules/` already says. Stack,
   architecture as it actually is, commands, product scope, known debt, points
   of attention. Concrete and verifiable — "run `make test`", not "test your
   changes".
2. **New project rules** in `.claude/rules/`, path-scoped where possible.
3. **`.claude/thresholds.json`** and **`.claude/quality-gate.json`** filled with
   this project's real commands, including the docs build and serve commands.
   Every command recorded there must be the one that runs in the container, not
   a host equivalent that happens to work on this machine today.
4. **`.claude/settings.json`** permissions, from Layer 3.
5. **`.claude/SETUP-REPORT.md`** — what you discovered, what the developer
   answered, what you wrote, and every question left open.

Then run `python3 .claude/tools/check-template.py` and fix what it reports.
Do not present the setup with errors outstanding.

## Then present the paradigm

Finish by presenting, in the conversation, your model of this project:

- What the setup now **covers** — each rule, and what it prevents.
- What it **does not cover**, explicitly. Gaps you saw and did not configure,
  conventions you inferred but could not confirm, risks nobody enforced.
- Which features have a flow document and which do not — the current reach of
  the gold book, stated as a fact rather than left implicit.
- Where a rule is **advisory** versus **enforced by a hook**, since only the
  second survives a model that decides otherwise.
- What you would add next, and what you deliberately left out.

Then ask whether it matches how the developer sees the project. **Iterate on
this presentation until they say it is right**, adjusting the written files at
each round. Do not treat the setup as finished because you produced files — it
is finished when the developer confirms the paradigm.
