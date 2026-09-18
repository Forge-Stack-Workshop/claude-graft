# standards-governance skills

A reusable, **project-agnostic** governance layer of agent skills. It lets an
agent (Claude and any compatible agent) apply a **standards canon**
systematically across projects, developments, audits and technical tasks —
adapting to each project's nature and maturity without weakening the core rules.

This repo is **not** a source of truth and names no project or vendor. The
executable canon is whatever you configure in `config.yaml` (`canon.source`).
The skills **consume** that canon by reference (the standards CLI, the conformity
checker, the managed standards block in each repo). If a skill and the canon ever
disagree, **the canon wins**. That is deliberate: standards evolve in the canon,
and the skills keep working unchanged.

## What's inside

- `config.example.yaml` — copy to `config.yaml`; it holds **all** specifics (the
  canon location, the CLI/checker/bootstrap commands, the standards model
  vocabulary, gates, SCM policy, human-validation extras). The skills stay
  generic.
- `GOVERNANCE.md` — the governance spec: rule hierarchy, conflict detection,
  conformity/validation, external-action rules, maturity adaptation, and the
  extension mechanism for adding standards later without rebuilding the set.
- `skills/` — nine composable skills, one per governance level:

  | # | Skill | Level | Triggers on |
  |---|-------|-------|-------------|
  | 01 | `governance-core` | Core / Governance | always — the spine consulted by every other skill |
  | 02 | `project-bootstrap` | Project Bootstrap | new project, init, "set up this repo" |
  | 03 | `development-conventions` | Development | writing/changing code, architecture, tests, docs, deps |
  | 04 | `infrastructure-execution` | Infrastructure / Execution | containers, orchestration, run/deploy, reproducible env |
  | 05 | `quality-validation` | Quality / Validation | lint, static analysis, gates, "is this done?" |
  | 06 | `observability-diagnostics` | Observability / Diagnostics | logs, metrics, traces, diagnosing anomalies |
  | 07 | `standards-audit` | Audit / Compliance | audit an existing repo vs standards, remediation plan |
  | 08 | `ui-ux-interaction` | UI / UX / Interaction | user-facing UI, states, feedback, accessibility |
  | 09 | `external-actions` | External Actions | Git, CI/CD, deploy, any out-of-sandbox effect |

- `shared/references/` — shared reference docs the skills cite instead of
  duplicating rules: `consuming-the-canon.md`, `rule-hierarchy.md`,
  `risk-and-human-gates.md`, `profiles-and-maturity.md`, `standards-model.md`,
  `conformity-and-gates.md`.
- `skills.index.yaml` — machine-readable index of the skill set.
- `install.sh` — auto-installable bundle: drops the skills into a target
  `.claude/skills/` (and prints how to wire other agents).

## How the skills compose

`governance-core` is the spine: it sets the rule hierarchy, conflict handling and
human-validation posture that all other skills inherit. Each other skill is
focused on one level, declares its triggers, and calls out to `external-actions`
whenever it reaches an action with effects outside the local sandbox. Skills
never duplicate rule text; they resolve standards from the canon and cite shared
references. They can all be active at once without contradiction — conflicts are
resolved by the documented hierarchy, not by whichever skill ran last.

## Conventions

- **On-disk language is English**: skills, references, rule text, commit
  messages. Conversations with the human stay in the human's language.
- **Project-agnostic**: no project, repo, or vendor names in the skills — all
  specifics live in `config.yaml` and the canon.
- **No agent lock-in**: skills are plain Markdown with YAML frontmatter and
  reference portable standards (IDs, CLIs, contracts), not agent internals.

## Install

```bash
cp config.example.yaml config.yaml        # then fill it in
./install.sh /path/to/target-repo         # installs into <repo>/.claude/skills/
./install.sh --global                     # installs into ~/.claude/skills/
./install.sh --help
```

## How it relates to a standards pipeline

```
canon (source of truth)  ──►  standards CLI / conformity checker / managed block
        ▲                                   │  consumed by reference
        │ new standards appended here       ▼
   (edit the ID index + annex)     standards-governance skills (this repo, the agent-facing rendering)
                                            │
                                            ▼
                         applied to:  bootstrap · development · audits · releases
```
