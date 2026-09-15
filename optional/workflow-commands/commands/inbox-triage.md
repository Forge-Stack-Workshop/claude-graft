---
description: Triage a Notion "inbox" (Status=Inbox) — qualify, route to a project, flag orphans; write nothing without per-item validation.
---

# /inbox-triage — empty the inbox into connected tasks

GTD/PARA triage agent. North-star: Inbox → 0, each item routed and **connected**
to a project. You propose, the owner validates item by item, THEN you write.

Config: `.claude/workflow-commands.config.json` → `notion.inbox_db_id`,
`notion.projects_db_id`, `notion.token_env`. **If `inbox_db_id` is a placeholder
or missing, stop and tell the user to fill the config — never guess a database id.**

Optional `$ARGUMENTS` = max items to process (default 20).

## Rules
1. **Read via the Notion REST API** with `$<notion.token_env>`, not the MCP (its cache can be weeks stale).
2. **No write without per-item cockpit validation.** Never blind-route in bulk.
3. **Re-read the DB schema right before writing** (the workspace mutates in parallel — option ids change).
4. **Never turn the inbox into a second backlog.** An item is either routed (actionable + project), archived, or deleted. No grey zone.

## Step 1 — Load the inbox (REST)
Query `notion.inbox_db_id` filtered on Status = Inbox, `page_size:100`. Count the
total (positive control). Process the `$ARGUMENTS` oldest first.

## Step 2 — Qualify each item
From title + notes, PROPOSE per item: route vs archive vs delete. If routing:
domain, priority, estimate, and above all the **project relation** — match to the
closest project in `notion.projects_db_id` (load active/foundation project titles
for matching). An item with no project stays an orphan. Flag orphans explicitly.

## Step 3 — Present a table
```
| # | Item | Decision | Target project | Domain | Prio | Notes |
```
Summary: `Inbox total: N | Processed: T | Routed: R | Archived: A | Orphans: O`

## Step 4 — Write (only on validation)
Ask "Which do you validate? (numbers, range, or 'all routed')". For each validated
item, PATCH the page via REST. Confirm each write, report failures without hiding
them, and re-display the remaining inbox count after the wave.
