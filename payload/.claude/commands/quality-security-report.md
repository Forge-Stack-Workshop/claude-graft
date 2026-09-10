---
description: Generate a full quality & security report (lint, coverage, mypy, dead code, secrets, CVEs, architecture)
---

# Quality & Security Report — Padam-AV

Generates a complete quality and security report for the current repo.
Usable as a Claude Code slash command: `/quality-security-report`

______________________________________________________________________

## Instructions for Claude Code

Follow the steps below exactly. Provide a report structured into sections.
Do not skip any section. If a command fails, note the error and continue.

______________________________________________________________________

## STEP 1 — Collect raw data

Run the following commands and collect the outputs:

```bash
# 1a. Ruff lint (current violations)
make ruff-check 2>&1 | tail -50

# 1b. Test coverage (summary)
make tests 2>&1 | grep -E "PASSED|FAILED|ERROR|coverage|warning" | tail -30

# 1c. Mypy (typing errors)
make mypy 2>&1 | tail -30

# 1d. Secrets exposed in tracked files
make gitleaks 2>&1 | tail -30

# 1e. Dead code
make vulture 2>&1 | tail -30

# 1f. Dependency CVEs
make pip-audit 2>&1 | tail -30

# 1g. Files modified since the last commit
git diff --name-only HEAD 2>/dev/null | head -30

# 1h. Current project thresholds
cat .claude/config/hooks-config.json | python3 -m json.tool 2>/dev/null | grep -A20 '"thresholds"'

# 1i. Model debt
node .claude/hooks/model-debt-scan.cjs --current 2>/dev/null
```

______________________________________________________________________

## STEP 2 — Analysis of modified files

For each `.py` file returned by `git diff --name-only HEAD`, check:

- Function length (threshold: max 40 lines)
- Number of arguments per function (threshold: max 5)
- Presence of type hints on public functions
- Imports organized at the top of the file
- No hardcoded secret (patterns: `sk-`, `AKIA`, `ghp_`, `-----BEGIN`)

______________________________________________________________________

## STEP 3 — Report format

Produce a structured report using this exact template:

```text
═══════════════════════════════════════════════════════
  QUALITY & SECURITY REPORT — PADAM-AV
  Date: [today's date]
  Branch: [current git branch]
  Commit  : [short SHA of HEAD]
═══════════════════════════════════════════════════════

## 🔴 BLOCKING (fix before any commit)

[List critical violations: exposed secrets, fatal mypy errors,
 broken tests. Format: ▸ file:line — short description]

## 🟡 WARNINGS (to handle within the sprint)

[Ruff violations, functions too long, missing type hints.
 Group by file. Max 15 entries, sorted by severity.]

## 🟢 OVERALL STATUS

| Metric            | Value      | Threshold| Status |
|-------------------|------------|----------|--------|
| Tests             | X/Y pass   | 100%     | ✅/❌  |
| Coverage          | XX%        | ≥ 85%    | ✅/❌  |
| Ruff violations   | N          | 0        | ✅/❌  |
| Mypy errors       | N          | 0        | ✅/❌  |
| Secrets detected  | N          | 0        | ✅/❌  |
| Dead code (vulture)| N         | 0        | ✅/❌  |
| CVEs (pip-audit)  | N          | 0        | ✅/❌  |
| Functions >40L    | N          | 0        | ✅/❌  |

## 🔐 SECURITY

### Secrets & credentials
[gitleaks result. If OK: "No secret detected in tracked files."]

### Dependency CVEs
[pip-audit result. If OK: "No known CVE in dependencies."]

### Dead code
[vulture result. List unused code flagged, or "None."]

### Modified API endpoints
[List modified views/serializers. For each, check:
 - permission_classes present
 - authentication_classes present
 - input validation (serializer.is_valid())
 - no sensitive data exposed in responses]

### Dependencies
[Note if external package imports were added in this diff.
 Flag if a package is unknown or unusual.]

## 📐 ARCHITECTURE & STANDARDS

### Structural violations
[Business logic in views (should be in services/),
 missing manager/queryset, potential circular imports.]

### Migrations
[List new migrations. Check: backward compatibility,
 missing indexes on FK, correct nullable/default fields.]

## 🧪 TESTS

### Coverage of modified files
[For each modified .py file, check if it has a corresponding test file.
 Flag files without a test.]

### Broken tests / errors
[List FAILED/ERROR with the short error message.]

## 📦 TECHNICAL DEBT

### Model-dependent rules (@[MODEL_NAME])
[Output of model-debt-scan.cjs --current]

### Recommended next actions
[3 to 5 priority actions, ordered by impact/effort. Format:
 1. [PRIORITY] action — affected file(s)]
```

______________________________________________________________________

## Behavior rules

- **Be factual**: cite exact file names and line numbers
- **Be concise**: max 3 sentences of analysis per section
- **Do not propose code** in this report — this is an audit, not an implementation
- **If a command fails**: note "command unavailable" and continue
- **Reference thresholds**: `.claude/config/hooks-config.json` → `thresholds`
- **Standards**: `.claude/rules/python-guidelines.md`
