---
description: From a Sentry issue link — diagnose, fix (TDD), then open the linked ticket + PR.
---

# /sentry-fix — Sentry → diagnose → fix → linked ticket + PR

`$ARGUMENTS` = a Sentry issue URL, e.g. `https://<host>/organizations/<org>/issues/<id>/`.

Config: `.claude/workflow-commands.config.json` → `sentry.host`, `sentry.token_env`,
and `ticketing.system` (`shortcut` | `github-issues` | `none`). **Do not hardcode
hosts/workspaces — read them from config; if required config is missing, stop and say so.**

## Step 0 — Parse & load the issue
Extract host/org/issue_id from `$ARGUMENTS`. Fetch via REST with `$<sentry.token_env>`:
the issue and its latest event. On `401 Invalid token`: stop, tell the user the
token is invalid/expired — never continue with invented data. Extract title, culprit,
message, level, count, first/last seen, project slug, `environment` tags, and the
stacktrace (innermost application frame, excluding third-party libs).

## Step 1 — Diagnose (current repo = cwd)
Use `superpowers:systematic-debugging`. Locate the file/function of the last
application frame. Reconstruct the real root cause (read the code, no unverified
guess). Present bug summary + root cause + intended fix before touching code; wait
for confirmation if the fix touches sensitive logic (auth, payment, migration).

## Step 2 — Fix in TDD
Use `superpowers:test-driven-development`: write a regression test reproducing the
Sentry error (RED), implement the minimal fix (GREEN), run the suite and paste the
raw output (`superpowers:verification-before-completion` — no invented summary).

## Step 3 — Ticket (per `ticketing.system`)
- **shortcut**: resolve workflow/group/project dynamically via the Shortcut REST
  API with `$<shortcut.token_env>` (don't hardcode ids); create a `bug` story
  titled `[<scope>] <error>`; keep the story id.
- **github-issues**: create an issue with the summary + root cause.
- **none**: skip; note it in the PR body only.

## Step 4 — PR
Open a branch + PR. Title `<type>(<scope>): <summary>`. Link per config:
- shortcut → include `sc-<story_id>` in title/body (auto-links when the GitHub
  integration is enabled on the workspace) + `Sentry: <link>`.
- github-issues → `Fixes #<issue>`.
Give the user both links (ticket + PR) and state that linking is automatic via the
convention — no extra manual step.
