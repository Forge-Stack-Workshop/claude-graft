# Instruction File Generation — Meta-Rule

**Applies to:** `.github/**/*.instructions.md`

Golden rule: if a bug happens repeatedly across multiple PRs, the root cause
is missing or unclear instructions. Fix the instructions, not the individual
bugs.

______________________________________________________________________

## Principles

- Single source of truth: if it's not in an instruction file, it's not a real
  rule.
- Every instruction must be actionable — something an AI can execute or a
  developer can follow, not vague advice.
- Discoverable via `description` + `applyTo` metadata.
- Concise, focused, one topic per file — target ~200 lines max.
- No repetition across files; no contradiction with other instruction files.

## Required header (Copilot-style `.instructions.md` sources)

```markdown
---
description: "Brief description of what these instructions cover"
applyTo: "glob/pattern/**/*.ext"
version: "1.0"
---
```

For Claude rule files under `.claude/rules/`, use instead a top-level H1 +
`**Applies to:** <glob>` line (see `thresholds.md`, `class-design.md`).

## Content structure

1. Title (H1).
2. One-line overview/purpose.
3. Key principles (bullets).
4. Detailed guidelines by subcategory, with at most one short code example
   per rule.
5. Best practices.
6. Common pitfalls to avoid.

## File management

- Location: `.github/instructions/` — no subfolders.
- Naming: `topic.instructions.md` (e.g. `django_models.instructions.md`).
- Cross-reference other instruction files via relative Markdown links; keep
  links correct and up to date.
- `.claude/rules/` mirrors and condenses the Copilot instructions for Claude
  Code consumption — one Claude rule file per source instruction file.

## Repository instruction inventory

```
.github/instructions/
├── tests.instructions.md                          # testing strategy
├── python_guidelines.instructions.md               # Python/PEP standards
├── django_models.instructions.md                   # model patterns
├── django_migrations_review.instructions.md         # migration safety
├── ruff_compliance.instructions.md                  # lint/import order
├── typing.instructions.md                           # type hints (PEP 484)
├── drf_performance.instructions.md                  # DRF API optimization
├── python_django_performance.instructions.md        # general performance
├── secrets_config.instructions.md                   # secret management
├── decorator_optimization.instructions.md           # decorator patterns
├── documentation.instructions.md                    # docstrings & docs
├── makefiles.instructions.md                        # Make targets & CI/CD
└── WORKFLOW.md                                       # how to use instructions
```

Root `CLAUDE.md` is the main entry point for Claude Code.

## AI-assistant workflow when editing instructions or code under them

- Collect full context first: read impacted files, grep all usages, check
  `.github/instructions/` and `.github/PROJECT_CONTEXT.md` before any
  refactor.
- Plan and communicate: summarize impacted files and logic before modifying;
  summarize what was done and what remains after.
- Add explicit imports for any refactored class/function, including in
  inherited, dynamic, or indirect modules.
- Group related corrections into a single pass — avoid unnecessary
  back-and-forth.
- Respect existing project structure (apps, services, managers, tests,
  fixtures).
- Validate with `make tests` (Dockerized) after any major change — never
  assume a local terminal run is sufficient.
- Scan and correct usages in tests, fixtures, and dynamic modules too, not
  only the main files.
- If a request is ambiguous, ask for precise context before acting.

## Common pitfalls (reject in review)

- Overly verbose instructions burying important details.
- Same information repeated across multiple files.
- Vague/general instructions with no concrete action.
- Contradicting project standards or another instruction file.
- Outdated examples no longer matching current practice.
- Missing essential context an AI needs to apply the rule correctly.

## Verification

```bash
find .github/instructions -name "*.instructions.md" | sort
make ruff-check
```
