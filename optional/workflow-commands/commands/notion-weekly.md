---
description: Weekly portfolio digest from Notion — overdue tasks, project lifecycle, what needs attention. Read-only by default.
---

# /notion-weekly — weekly portfolio digest

A read-only weekly review across a Notion tasks DB and projects DB.

Config: `.claude/workflow-commands.config.json` → `notion.tasks_db_id`,
`notion.projects_db_id`, `notion.token_env`. **If ids are placeholders/missing,
stop and ask the user to fill the config.**

## Rules
- **Read via REST** with `$<notion.token_env>` (MCP cache can be stale). Read-only: propose, do not write unless the user explicitly asks.

## Step 1 — Overdue & due-soon tasks
Query `notion.tasks_db_id` on fields like `Status`, `Priority`, `Due date`,
`Blocked by`, project relation. List overdue tasks: name + project + days late,
sorted by lateness descending. Then due-this-week.

## Step 2 — Project lifecycle
Query `notion.projects_db_id` on `Last commit`, `Lifecycle`, `Last review`,
`Engagement`. Flag: projects not reviewed recently, stale-but-active, no recent commit.

## Step 3 — Digest
Concise sections: **Overdue**, **Due this week**, **Projects needing review**,
**Suggested focus**. End with counts. Offer to open follow-ups via `/inbox-triage`
or `/notion-recon` rather than writing here.
