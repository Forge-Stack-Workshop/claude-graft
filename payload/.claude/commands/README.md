# Claude Code Commands

Slash commands available in this repository. Each is a structured, step-by-step
instruction set — invoke with `/command-name [args]`. The `description` /
`argument-hint` shown in the `/` menu are the source of truth (this list mirrors
them).

## Setup

- `/init` — bootstrap the local environment (token proxy, knowledge graphs, MCP, agents/skills).

## Plan → execute (multi-PR work)

- `/plan-start <objective>` — turn an objective into a step-by-step, PR-sized construction plan.
- `/plan-validate <plan-file>` — adversarially review a plan before execution.
- `/plan-execute <plan-file> <step-number>` — execute a single validated step.

## Commit & PR

- `/commit` — create well-formatted Conventional Commits with atomic-commit analysis.
- `/pr-description` — generate a PR description from the current diff using the matching repo template.
- `/reviewpr <pr-number>` — thoroughly review a GitHub pull request and submit structured feedback.

## Quality, compliance & audit

- `/quality-day` — create a dated `quality/YYYY/MM/DD` branch and run the full format/lint/test workflow (runs `/quality-security-report`).
- `/quality-security-report` — full quality & security report (lint, coverage, mypy, secrets, architecture).
- `/project-analysis [path]` — codebase health check: security, standards, architecture, dependencies, tests.
- `/guidelines-compliance <file_path>` — bring a file into full compliance with coding, architecture, and secrets standards (runs `/typing-review`).
- `/typing-review <path>` — enforce exhaustive, modern Python 3.14+ type annotations.
- `/security-api-review <path>` — audit a REST API endpoint for authN/authZ, input validation, rate limiting, data protection.

## Tests

- `/test <file-or-directory | feature | all>` — run and improve the test suite for a scope (Docker / Makefile only).
- `/tests-generate <path>` — generate unit and integration tests (happy path, error cases, boundaries).
- `/test-review <path>` — review test files against the dual unit/integration testing strategy.

## Migrations

- `/migration-check` — audit new or modified Django migrations in the current diff (runs `/migration-review` per file).
- `/migration-review <path>` — review one Django migration for safety, performance, zero-downtime deployment.

## Providers

- `/provider-scaffold <provider_name> <dispatch|shuttle>` — generate the skeleton of a new provider under `apps/provider/`.
- `/provider-integration <type> <name> <spec-path>` — integrate a new fleet provider from a local spec (offline; runs `/provider-scaffold` first).

## Documentation

- `/visual-docs [product | all]` — generate or update the bilingual (FR/EN) landscape-A4 PDF documentation suite for Padam products (spec in `CLAUDE.md`).

## Command file format

Each command is a Markdown file with YAML frontmatter:

```yaml
---
description: One-line summary shown in the `/` menu (required).
argument-hint: "<required-arg>" or "[optional-arg]"   # only when the command takes an argument
---
```

- `description` — required; the `/` menu source of truth.
- `argument-hint` — optional; add it **only** when the command consumes
  `$ARGUMENTS`. Use `<...>` for required, `[...]` for optional. Commands that
  operate on the current diff/env (no argument) omit it deliberately.
