---
description: Create a dated quality/YYYY/MM/DD branch and run the full format/lint/test workflow
---

# Quality Day — Branch Setup & Execution

Create a dated quality branch and run all code quality/compliance checks for the day.
Usable as a Claude Code slash command: `/quality-day`

______________________________________________________________________

## Instructions for Claude Code

Run every morning (fresh branch `quality/YYYY/MM/DD`), before release cycles, or during a code sprint. Related files: `.github/makefiles/`, `pyproject.toml`, `.pre-commit-config.yaml`.

**Key Principle**: Quality is not an afterthought—it's the start of every work day.

Automate the complete "Quality Day" workflow:

1. **Create Quality Branch** (dated, from develop, reused if already existing)
1. **Update Pre-Commit Hooks** (latest versions)
1. **Format Code** (Ruff auto-fix)
1. **Run Linters** (Ruff, import layering)
1. **Type Check** (mypy)
1. **Detect Dead Code** (vulture)
1. **Security Scans** (gitleaks, pip-audit)
1. **Execute Tests** (pytest with coverage reports)
1. **Generate Reports** (`/quality-security-report`, `/security-review`)
1. **Cross-Reference Shortcut Tickets** (optional, if `SHORTCUT_API_TOKEN` set)
1. **Commit, Push, Open PR** (atomic commits, explicit confirmation, `quality.md` template)

______________________________________________________________________

## Branch Naming Pattern

```
quality/YYYY/MM/DD

Examples:
- quality/2025/01/15  (January 15, 2025)
- quality/2025/12/31  (December 31, 2025)
```

______________________________________________________________________

## Workflow Steps (In Order)

```bash
# 0. Refuse to start on top of uncommitted work
if [ -n "$(git status --porcelain)" ]; then
  echo "⚠️  Uncommitted changes detected — commit or stash them before running quality day."
  exit 1
fi

# 1. Update develop branch
git checkout develop
git pull origin develop

# 2. Create (or reuse) today's quality branch
BRANCH="quality/$(date +%Y/%m/%d)"
if git rev-parse --verify "$BRANCH" >/dev/null 2>&1 || git ls-remote --exit-code --heads origin "$BRANCH" >/dev/null 2>&1; then
  echo "Branch $BRANCH already exists — reusing it."
  git checkout "$BRANCH"
else
  git checkout -b "$BRANCH"
fi

# 3. Update pre-commit hooks
make update-pre-commit-repos

# 4. Format code
make format-code

# 5. Run linters
make ruff-check
make lint-imports

# 6. Type check
make mypy

# 7. Dead code detection
make vulture

# 8. Security scans
make gitleaks
make pip-audit

# 9. Run tests
make tests

# 10. Review results in terminal output
```

Then run `/quality-security-report` to produce the consolidated lint / coverage /
mypy / secrets / architecture report for the day — do not re-implement those
sections inline here.

Then run `/security-review` on the diff before committing (required by the
global CLAUDE.md security policy for any code change).

**Pause here.** Show the `/quality-security-report` summary to the user and get
explicit confirmation that there is no 🔴 blocking finding before committing —
do not chain straight into the commit steps below.

______________________________________________________________________

## Shortcut Ticket Integration (optional)

Cross-referencing quality findings with Shortcut tickets (e.g. `SC-154956`
commit prefixes) requires a personal API token — not committed, not shared.

```bash
# Check for a token before attempting any Shortcut API call
if [ -z "$SHORTCUT_API_TOKEN" ]; then
  echo "⚠️  SHORTCUT_API_TOKEN not set — skipping Shortcut ticket cross-reference."
  echo "    To enable it: add 'export SHORTCUT_API_TOKEN=<your-token>' to your"
  echo "    personal secrets file (e.g. ~/.secrets, sourced by your shell rc)."
  echo "    Get a token at: https://app.shortcut.com/settings/account/api-tokens"
else
  # List open tech-debt/quality/security tickets and link them in the report
  curl -sf -H "Shortcut-Token: $SHORTCUT_API_TOKEN" \
    "https://api.app.shortcut.com/api/v3/search/stories?query=label:tech-debt,quality,security+is:unstarted"
fi
```

If the token is present, list matching open tickets in the `/quality-security-report`
output and note which findings from today's run correspond to an existing ticket
vs. a new one (avoid duplicate ticket creation).

For any 🔴/🟡 finding with no matching ticket, ask the user for confirmation before
creating one (`POST /api/v3/stories`, label matching the finding type: `tech-debt`,
`quality`, or `security`) — do not create tickets silently.

______________________________________________________________________

## Expected Output (After completion)

```
✅ Branch: quality/2025/01/15 (created from develop, or reused)
✅ Pre-commit: Hooks updated to latest versions
✅ Code format: All Python files formatted
✅ Linting: Ruff + import layering compliant
✅ Types: mypy clean
✅ Dead code: vulture clean
✅ Security: gitleaks + pip-audit clean
✅ Tests: All tests passing
✅ Coverage: 80%+ (or 100% for critical modules)
✅ Reports: Generated in reports/ directory
✅ Shortcut: findings cross-referenced (if token set) or explicitly skipped
✅ PR: opened against develop using the quality PR template
```

______________________________________________________________________

## Reports Generated

After running `make tests`, check:

- `reports/` directory for generated test and coverage reports
- Coverage metrics displayed in terminal output
- Any failing tests displayed with error details

______________________________________________________________________

## Error Handling

If any step fails:

```bash
# If linting fails: Fix files manually or use Ruff auto-fix
make format-code

# If mypy fails: inspect errors, add/fix type hints
make mypy

# If vulture flags dead code: confirm it's truly unused, then remove it
# (false positives happen — check callers before deleting)

# If gitleaks finds a secret: rotate/revoke it first, then remove it from
# history if needed — do not just delete the line and commit over it
make gitleaks

# If pip-audit finds a CVE: bump the affected dependency
make pip-audit

# If tests fail: Debug with verbose output
pytest -vvv padam_av/ --tb=short

# If coverage is low: Identify gaps
pytest --cov=padam_av --cov-report=term-missing padam_av/

# If pre-commit fails: Update manually
pre-commit run --all-files
```

______________________________________________________________________

## Post-Quality-Day Steps

After all checks pass, commit in atomic, reviewable steps — one commit per
category, only for categories that produced a diff:

```bash
# 1. Review changes
git status

# 2. Commit each category separately (skip any with no diff)
git add -u -- '*.py' && git diff --cached --quiet || git commit -m "quality: format code (ruff)"
git add -u && git diff --cached --quiet || git commit -m "quality: fix lint/import violations"
git add -u && git diff --cached --quiet || git commit -m "quality: fix type errors and remove dead code"
git add -u && git diff --cached --quiet || git commit -m "quality: address security findings (gitleaks/pip-audit)"
```

Then **ask the user to confirm** before pushing — do not push automatically:

```bash
# 3. Push to remote (only after explicit user confirmation)
git push -u origin "$BRANCH"

# 4. Create Pull Request (targeting develop) using the quality PR template
if ! command -v gh >/dev/null 2>&1 || ! gh auth status >/dev/null 2>&1; then
  echo "⚠️  gh CLI not installed/authenticated — open the PR manually using"
  echo "    .github/PULL_REQUEST_TEMPLATE/quality.md as the body."
else
  gh pr create --base develop --head "$BRANCH" \
    --title "Quality Day $(date +%Y-%m-%d)" \
    --body-file .github/PULL_REQUEST_TEMPLATE/quality.md
fi
```

Fill in the `quality.md` template with the actual checks/results before creating
the PR — `gh pr create` opens it for editing; do not submit the raw placeholders.

______________________________________________________________________

## Make Targets Reference

- `make update-pre-commit-repos` - Update pre-commit hooks to latest versions
- `make format-code` - Format all Python files with Ruff
- `make ruff-check` - Run Ruff linting (auto-fix)
- `make lint-imports` - Check import layering contracts
- `make mypy` - Run mypy type checker
- `make vulture` - Detect dead code
- `make gitleaks` - Run gitleaks secret scanner
- `make pip-audit` - Run pip-audit dependency CVE scan
- `make tests` - Run full test suite
- `make tests-reports` - Generate coverage and test reports
- `make tests-failfast` - Run tests, stop on first failure
- `make tests-parallel` - Run tests in parallel for speed

______________________________________________________________________

## Next Steps

1. Open coverage report: `open reports/coverage/index.html`
1. Review quality metrics in `reports/quality/`
1. Address any failing tests or low coverage areas
1. Commit improvements and push to remote

______________________________________________________________________

## Housekeeping

After the PR is merged, clean up old merged `quality/*` branches:

```bash
git fetch --prune
for b in $(git branch --merged develop | grep 'quality/'); do
  git branch -d "$b"
done
```
