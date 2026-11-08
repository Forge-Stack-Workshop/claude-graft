---
description: "Full codebase health check: security, standards, architecture, dependencies, test coverage"
argument-hint: [path]
---

# Full Project Analysis & Audit

Comprehensive analysis of the Padam-AV codebase for security, compliance, architecture, and test quality.
Usable as a Claude Code slash command: `/project-analysis <path>`

______________________________________________________________________

## Instructions for Claude Code

Run for periodic project audits (monthly), before major releases, or when onboarding new team members. Related files: all `.claude/rules/` files, `.github/docs/PROJECT_CONTEXT.md`.

Perform a complete health check of the target path (or the whole codebase).

> For the security + lint/coverage/mypy/secrets dimensions, run
> `/quality-security-report` and summarise its output rather than re-running those
> tools here. This command adds the architecture, dependency-risk and test-quality
> analysis on top of that report.

1. **Security Audit** (Find vulnerabilities before prod)

   - Authentication/authorization bypass vectors
   - Data leakage (hardcoded secrets, unencrypted storage)
   - Dependency vulnerabilities (via pip-audit)
   - SQL injection, XSS, CSRF attack vectors

1. **Coding Standards** (Ensure consistency)

   - PEP 8 compliance, import organization, type hints
   - Django/DRF best practices (business in services, not views)
   - Naming conventions, constants vs magic numbers
   - English-only code comments and docstrings

1. **Architecture** (Validate domain-driven design)

   - Separation of concerns (views → services → models)
   - Modularity and reusability (one class per file)
   - Domain-driven structure (apps organized by feature, not by layer)
   - Clear boundaries between components

1. **Dependencies** (Manage risk)

   - List core vs extra dependencies
   - Flag deprecated or insecure packages
   - Verify compatibility with Python 3.14+

1. **Test Coverage** (Find gaps)

   - Coverage % by app and file
   - Untested code paths (critical gaps)
   - Test quality (isolation, flakiness, speed)

1. **Reporting** (Actionable insights)

   - Executive summary (overview, critical issues)
   - Compliance scores by category (security, standards, tests)
   - Quick wins (easy fixes first)
   - Long-term improvements (architectural refactoring)

______________________________________________________________________

## Related Instructions (Read These First)

- `.claude/rules/python-guidelines.md` (PEP 8, imports, naming)
- `.claude/rules/typing.md` (type hints required)
- `.claude/rules/django-models.md` (Django architecture)
- `.claude/rules/secrets-config.md` (security, secret management)
- `.claude/rules/tests.md` (test quality, coverage)
- `.claude/rules/ruff-compliance.md` (code quality checks)

______________________________________________________________________

## Expected Output

After running this analysis, produce:

- ✅ **Security Findings**: List of vulnerabilities with remediation steps
- ✅ **Standards Report**: Files not compliant with PEP 8, typing, organization
- ✅ **Architecture Review**: Domain boundaries, service layers, separation of concerns
- ✅ **Dependency Audit**: Outdated/insecure packages, suggested updates
- ✅ **Test Gap Analysis**: Files with \<80% coverage, untested critical paths
- ✅ **Compliance Scores**: Security (0-100%), Standards (0-100%), Tests (0-100%)
- ✅ **Prioritized Action Plan**: Critical → High → Medium → Low priority fixes

______________________________________________________________________

## Usage

```bash
# Full audit:
# /project-analysis padam_av/

# Component-specific analysis:
# /project-analysis padam_av/apps/automata/

# Manual verification:
make ruff-check      # Compliance check
pytest --cov=padam_av      # Coverage report
python manage.py check     # Django system check
```
