---
description: Bootstrap the local environment (token proxy, knowledge graphs, MCP, agents/skills) for Claude Code
---

# Init — Set up padam-av for Claude Code

Bootstraps the local environment so Claude Code works with this repo at full
capability: token proxy (RTK), knowledge graphs (graphify + CodeGraph), MCP
servers, and the project agents/skills. Usable as a slash command: `/init`

All tokens are read from environment variables — **never** commit or paste a
token into a tracked file.

______________________________________________________________________

## Instructions for Claude Code

Run each step, report what is already present vs. what you set up, and stop with
a short checklist. Do not fail the whole command if one optional tool is missing —
mark it and continue.

______________________________________________________________________

## STEP 1 — Environment variables (tokens)

The following tokens are consumed from the environment. They must live in your
shell profile or a local, git-ignored `.env` — never in a committed file.

| Variable         | Used by                        | Required |
| ---------------- | ------------------------------ | -------- |
| `WORKSPACE_ROOT` | projects root dir              | yes      |
| `GITHUB_TOKEN`   | GitHub MCP / `gh` CLI          | yes      |
| `NOTION_API_KEY` | Notion MCP                     | optional |

Check presence without printing values:

```bash
for v in WORKSPACE_ROOT GITHUB_TOKEN NOTION_API_KEY; do
  if [ -n "${!v}" ]; then echo "$v: set"; else echo "$v: MISSING"; fi
done
```

Copy `.env.example` to `.env` (git-ignored) for any project-level variables and
report which ones are still unset. Never echo a secret's value.

______________________________________________________________________

## STEP 2 — RTK (token proxy)

RTK transparently wraps dev commands to cut output tokens. Verify it:

```bash
rtk --version   # must succeed
rtk gain        # shows token savings; if this fails you have the wrong `rtk` binary
```

If `rtk` is absent, note it as optional and continue — commands still run
un-proxied.

______________________________________________________________________

## STEP 3 — Graphify (knowledge graph)

Build/refresh the AST graph used for structural code questions. This is
AST-only (no model cost).

```bash
graphify --version || echo "graphify not installed (pip install graphify)"
# Build if missing, else incremental update:
if [ -f graphify-out/graph.json ]; then graphify update .; else graphify update .; fi
```

- Config: `.graphifyignore` (repo root) controls excluded paths.
- Reference: `docs/GRAPHIFY.md`.
- Output `graphify-out/` is git-ignored.
- This repo is large (~11k nodes); if HTML export is needed, raise
  `GRAPHIFY_VIZ_NODE_LIMIT` (default 5000).

The `graphify-sync` PostToolUse hook keeps the graph current after `.py` edits
once `graphify-out/graph.json` exists.

______________________________________________________________________

## STEP 4 — CodeGraph MCP (optional)

CodeGraph is a separate tree-sitter MCP index exposing `codegraph_*` tools.

```bash
codegraph status || echo "codegraph not initialized"
```

If `.codegraph/` is missing and the user wants it, run `codegraph init -i`.

______________________________________________________________________

## STEP 5 — MCP servers

This repo relies on MCP servers configured at the user/global level (no
committed `.mcp.json`). Confirm the ones this project uses:

- **GitHub** — via `gh` CLI or MCP; needs `GITHUB_TOKEN`.
- **Notion** — MCP; needs `NOTION_API_KEY` (optional).

List what Claude Code currently sees:

```bash
claude mcp list 2>/dev/null || echo "run inside Claude Code to inspect MCP servers"
```

Report any server that is configured but unauthenticated.

______________________________________________________________________

## STEP 6 — Agents & skills

The project ships domain agents (`.claude/agents/`) and skills
(`.claude/skills/`). Enumerate what is available so the user knows what to reach
for:

```bash
ls .claude/agents/ 2>/dev/null
ls .claude/skills/ 2>/dev/null
```

Highlight the spec→plan→implementation workflow skills (`spec`, `plan`,
`implement`) and the review/debug skills (`check`, `hunt`, `verification-loop`).

______________________________________________________________________

## STEP 7 — Hooks & validation

Confirm the committed hooks are wired and the config parses:

```bash
node -e "JSON.parse(require('fs').readFileSync('.claude/settings.json','utf8')); console.log('settings.json OK')"
node -e "JSON.parse(require('fs').readFileSync('.claude/config/hooks-config.json','utf8')); console.log('hooks-config.json OK')"
```

Then print a final checklist: for each of RTK, graphify, CodeGraph, GitHub MCP,
Notion MCP, agents, skills, hooks — `ready` / `missing (optional)` /
`action needed`.
