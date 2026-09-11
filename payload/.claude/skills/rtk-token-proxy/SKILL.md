---
name: rtk-token-proxy
description: Use `rtk` to filter and summarize large command outputs before they reach the model context — token-optimized wrappers around ls, tree, read, git, gh, glab, aws, psql, pnpm and more. Reach for it when a command would otherwise dump a large file, directory, log, diff, or query result into context. Requires the `rtk` binary.
origin: authored
---

# rtk — token-optimized output proxy

`rtk` is a CLI proxy that filters and compresses noisy system output **before** it reaches
the model, cutting context spend without losing signal. Prefer it over the raw command
whenever the output is large (big directory, long file, verbose git/gh, wide SQL result).

## Prerequisites (preflight)

Requires the **rtk** binary. Verify before use; warn if missing:

```bash
command -v rtk >/dev/null 2>&1 || echo "WARN: rtk not installed — see https://github.com/(rtk repo) or your team's install; without it, fall back to the raw command"
```

If `rtk` is absent, fall back to the native command — never block the task on it.

## When to use

- Listing a large directory or tree → `rtk ls`, `rtk tree` instead of `ls -R`.
- Reading a big/generated file → `rtk read <file>` (intelligent filtering).
- Verbose VCS output → `rtk git <args>`, `rtk gh <args>`, `rtk glab <args>`.
- Wide cloud/DB output → `rtk aws <args>`, `rtk psql <args>` (compact tables).
- A quick 2-line orientation on a file → `rtk smart <file>`.

Skip it for small outputs where the raw command is already cheap — the wrapper adds no value there.

## Core commands

```bash
rtk ls [path]            # token-optimized directory listing
rtk tree [path]          # compact directory tree
rtk read <file>          # read with intelligent filtering (large/binary-aware)
rtk smart <file>         # heuristic 2-line technical summary
rtk git <args>           # git with compact output
rtk gh <args>            # gh (GitHub CLI) with token-optimized output
rtk glab <args>          # glab (GitLab CLI) compact output
rtk aws <args>           # AWS CLI, forced JSON + compression
rtk psql <args>          # PostgreSQL, borderless compact tables
rtk pnpm <args>          # pnpm, ultra-compact output
```

## Wiring (optional, per project)

Allow the read-only verbs in `.claude/settings.json` so they run without prompting:

```json
{
  "permissions": {
    "allow": [
      "Bash(rtk ls:*)", "Bash(rtk tree:*)", "Bash(rtk read:*)",
      "Bash(rtk smart:*)", "Bash(rtk git:*)", "Bash(rtk gh:*)"
    ]
  }
}
```

Keep write/side-effecting proxies (`rtk aws`, `rtk psql` mutations) out of the allow-list.

## Guidance

- Treat `rtk` as a lens, not a source of truth: if a filtered read hides a detail you need,
  re-read the raw file for that span.
- Don't pipe `rtk` output back through another summarizer — it's already compressed.
- Related: this is a tooling companion to the broader token-budget discipline; combine with
  scoped searches (graphify) rather than raw greps on large trees.
