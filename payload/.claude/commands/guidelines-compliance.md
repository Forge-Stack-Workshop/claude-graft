---
description: Bring a file into full compliance with Padam-AV coding, architecture, and secrets standards
argument-hint: <file_path>
---

# Guidelines Compliance & Maintenance

Bring code into full compliance with Padam-AV's project standards.
Usable as a Claude Code slash command: `/guidelines-compliance <file_path>`

______________________________________________________________________

## Instructions for Claude Code

Run during code review, PR preparation, or refactoring existing code to meet quality gates. Related files: `.claude/rules/` (all files), `CLAUDE.md`, `.github/docs/PROJECT_CONTEXT.md`.

**Key Principle**: This is not optional code formatting—it's architectural enforcement.

Activate Padam-AV's comprehensive compliance framework:

1. **Audit Code** against all project guidelines (PEP 8, typing, imports, architecture).
   For the typing dimension, delegate to `/typing-review <file_path>` rather than
   re-checking annotations here.
1. **Refactor Systematically** (services > views, constants > hardcoding, English > other languages)
1. **Document Changes** (update docstrings, README, changelogs)
1. **Remove Debt** (deprecated code, obsolete tests, dead imports)
1. **Validate Output** (run ruff, pytest, type checkers)

______________________________________________________________________

## Instruction Sources (Read These First)

- `.claude/rules/python-guidelines.md` (import org, naming, comments)
- `.claude/rules/typing.md` (type hints required, no `Any`)
- `.claude/rules/django-models.md` (one model per file, DDD)
- `.claude/rules/django-migrations-review.md` (zero-downtime migrations)
- `.claude/rules/drf-performance.md` (QuerySet optimization)
- `.claude/rules/python-django-performance.md` (profiling, caching)
- `.claude/rules/secrets-config.md` (no hardcoded secrets)
- `.claude/rules/ruff-compliance.md` (Ruff as source of truth)
- `.claude/rules/tests.md` (pytest, factories, dual testing strategy)

______________________________________________________________________

## Compliance Rules (Non-Negotiable)

```
✅ ALL imports at file top (no mid-file imports)
✅ Exhaustive type hints on ALL public functions
✅ PEP 8 compliant (enforced by Ruff)
✅ Business logic in services, NOT views/serializers
✅ One class per file (except nested classes in tests)
✅ English-only code comments and docstrings
✅ No hardcoded secrets (use docker/secrets/ or env vars)
✅ Constants instead of magic numbers
✅ Alphabetically sorted methods/properties/variables
✅ Backwards compatible migrations (< 10 seconds, reversible)
```

______________________________________________________________________

## Expected Output

After running this review:

- ✅ Code passes `make ruff-check`
- ✅ Code passes `make format-code` (ruff check+fix)
- ✅ All imports organized and type-hinted
- ✅ All docstrings in English and compliant with Google style
- ✅ No security warnings (no hardcoded secrets, no SQL injection vectors)
- ✅ Architecture validated (services > views, managers > models)
- ✅ Ready for code review and merge

Report:

- List of non-compliant files/modules
- Example of a compliant refactor
- Summary of compliance and next steps

______________________________________________________________________

## Compliance Checker Script Considerations

When touching the compliance checker script itself:

- Each rule must be factored into a dedicated class (inheriting from `Check`)
- Reporting must be clear, categorized, and CI-compatible
- Violations must be explicit and traceable (file, line, message, category)
- The script should be split into modules if it grows too large
- Pre-commit hooks must target the correct files and be synchronized with the instructions

______________________________________________________________________

## Pre-commit YAML Maintenance

- One hook per control category (structure, imports, typing, tests, complexity, etc.)
- Each hook must point to the script with the corresponding flag or class
- File patterns must be adapted to each control
- Document each hook in the README and this command

______________________________________________________________________

## Extension

- For any new rule, add a class in the script and a hook in the YAML
- Update this command file with each major evolution
- Synchronize with project instructions

This command must be consulted before any modification of the compliance script or pre-commit configuration to ensure consistency and compliance of the Padam-AV project.

## Usage

```bash
# Invoke on a specific file:
# /guidelines-compliance {file_path}

# Manual verification:
make ruff-check  # Ruff will highlight violations
```
