---
name: update-config
description: Safely tune Claude Code configuration — settings.json, permissions (allow/ask/deny), hooks wiring, statusLine, and .mcp.json. Use when adjusting how Claude behaves in a project, cutting permission prompts, or wiring a new hook, without leaking secrets or over-granting.
origin: authored
---

# Update Config

Claude Code configuration is small but easy to get subtly wrong: an over-broad `allow` opens a
hole, a committed real path leaks layout, a mis-wired hook silently never runs. This skill is
the safe procedure for changing it.

## When to use

- Adjusting `settings.json`: permissions, statusLine, `includeCoAuthoredBy`, `cleanupPeriodDays`.
- Cutting repeated permission prompts (widen `allow` for genuinely safe read-only commands).
- Wiring a hook (Pre/PostToolUse, SessionStart, Stop, PreCompact).
- Declaring an MCP server in `.mcp.json`.

## Layering — commit vs local

- **`settings.json`** (committed): team defaults, safe everywhere. No real secret paths.
- **`settings.local.json`** (gitignored): personal/project-specific — `claudeMdExcludes`,
  machine paths, extra allows. Never commit it.
- **`.mcp.json`** (repo root): project MCP servers. Never commit tokens; read from env.

## Permissions — the three lists

| List | Meaning | Use for |
| ---- | ------- | ------- |
| `deny` | Hard stop, cannot be overridden | Secret reads (`.env*`, `*.pem`, `*.key`, `secrets/**`), vendored/generated reads |
| `ask`  | Human beat before running | Outward/irreversible commands: `git push --force`, `sudo`, `npm publish`, `docker push`, release |
| `allow`| Run without prompting | Genuinely safe, read-only, high-frequency commands |

Rules:
- Widen `allow` only for read-only verbs (`ls`, `cat`, `git status`, `rtk read`). Never
  `allow` a command that writes, deletes, pushes, or publishes.
- Prefer narrow matchers: `Bash(git status:*)` over `Bash(git:*)`.
- Put anything sensitive or layout-revealing in `settings.local.json`, not the committed file.

## Wiring a hook

- Add under the correct event; use the guarded command form so a missing file never errors:
  `sh -c 'f="$CLAUDE_PROJECT_DIR/.claude/hooks/<name>.cjs"; [ ! -f "$f" ] || node "$f"'`
- A hook must **fail open**: any error → exit 0. A blocking hook uses exit 2 / a `decision`
  only when the block is intentional and never-a-false-positive.
- Set a real `timeout`; keep PostToolUse/Stop hooks fast and non-blocking.

## Procedure

1. Read the current `settings.json`; identify the minimal change.
2. Make it in the right layer (committed vs local).
3. Validate JSON: `python3 -c "import json;json.load(open('.claude/settings.json'))"`.
4. For a hook, dry-run it: `echo '{}' | node .claude/hooks/<name>.cjs` — it must exit 0.
5. Confirm no secret, token, or real private path landed in a committed file.

## Pitfalls (reject in review)

- A broad `allow` on a side-effecting command.
- Secrets or machine paths committed in `settings.json` / `.mcp.json`.
- A hook wired without the file-exists guard (errors when absent).
- A blocking hook that can false-positive (turns friction into a wall).
