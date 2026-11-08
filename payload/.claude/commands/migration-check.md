---
description: Audit new or modified Django migrations in the current diff for zero-downtime safety
---

# Migration Check — Padam-AV

Audits Django migrations that are new or modified in the current diff.
Usable as a Claude Code slash command: `/migration-check`

______________________________________________________________________

## Instructions for Claude Code

______________________________________________________________________

## STEP 1 — Identify the affected migrations

```bash
git diff --name-only --diff-filter=ACMR HEAD -- '*/migrations/*.py' | grep -v '__init__.py'
```

If no migration is found, say so and stop here.

______________________________________________________________________

## STEP 2 — For each migration, check

> For a deep single-file audit, delegate to `/migration-review <path>` on each
> affected file instead of duplicating its checklist here. The checks below are
> the fast triage applied across the whole diff.

- **Non-nullable fields added without `default`**: blocking on an already-populated table
  (`AddField` without `null=True` nor `default=`).
- **Missing index on a ForeignKey** added on a high-volume table.
- **`RunPython`**: is a `reverse_code` function provided? If not,
  the migration is not reversible (acceptable only if intentional).
- **Field/table renaming** (`RenameField`, `RenameModel`): check for absence
  of data loss and compatibility with application code already deployed
  (rolling deploy = old code + new migration may briefly coexist).
- **Dependencies (`dependencies`)**: does the migration reference the correct
  previous migration of the app (no accidental fork of the history)?
- **Squashed migration**: consistency with `replaces` if present.

______________________________________________________________________

## STEP 3 — Report format

```text
═══════════════════════════════════════════════
  MIGRATION CHECK — [app name]/[file]
═══════════════════════════════════════════════

🔴 BLOCKING   : [precise description, line concerned]
🟡 WARNING    : [acceptable risk but should be documented in the PR]
🟢 OK         : [nothing to report]

Reversible : yes/no
Rolling-deploy compatible : yes/no/to verify manually
```

______________________________________________________________________

## Behavior rules

- **Do not propose an automatic fix** — this is an audit, not an implementation.
- **Be factual**: cite the exact file name and Django operation (`AddField`, `RunPython`, …).
- If a migration is already merged on `develop` (visible via `git log develop -- <file>`),
  flag it: it must no longer be modified, only a new corrective migration.
