---
description: Reconcile a Notion "projects" DB against real git remotes (last commit, lifecycle) — owner-validated, then PATCH; never blind bulk-write.
---

# /notion-recon — reconcile the projects DB with reality

Bring a Notion projects database back in sync with the actual repositories.

Config: `.claude/workflow-commands.config.json` → `notion.projects_db_id`,
`notion.token_env`. **If `projects_db_id` is a placeholder/missing, stop and ask
the user to fill the config — do not guess.**

## Rules
1. **Read via REST** with `$<notion.token_env>` (the MCP can serve a cache weeks stale).
2. Measure repo truth with `gh` / `git ls-remote` — a Notion "last commit" field can be hundreds of commits behind.
3. **Owner validates each line, THEN you PATCH.** Never a blind mass write.
4. Use fiches without a GitHub URL (not auditable) and fully-synced fiches as positive controls.

## Step 1 — Load projects (REST)
Query `notion.projects_db_id` (`page_size:100`). Collect: title, GitHub URL,
fields like `Last commit`, `Lifecycle`, `Last review`, `Engagement`.

## Step 2 — Measure reality
For each fiche with a repo URL: get the real default-branch HEAD date/sha via
`git ls-remote` / `gh`. Compute drift (days / commits behind).

## Step 3 — Present drift
```
| # | Project | Notion last-commit | Real HEAD | Drift | Proposed update |
```
Flag: fiches with no URL (unauditable), archived-but-active repos, and the reverse.

## Step 4 — Write (only on validation)
Ask which lines to apply. PATCH each validated page via REST. Confirm each write,
surface failures, re-display remaining drift count.
