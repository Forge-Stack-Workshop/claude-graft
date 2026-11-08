#!/usr/bin/env bash
# Claude Code status line — agnostic, dependency-light.
# Renders: <dir> · <git branch><dirty> · <model> · <output style>
# Wire it in .claude/settings.json:
#   "statusLine": { "type": "command", "command": "$CLAUDE_PROJECT_DIR/.claude/statusline.sh", "padding": 0 }
# Claude Code feeds a JSON payload on stdin (session, model, workspace, cost…).
# See https://code.claude.com/docs/en/statusline and https://statuslin.es/ for variants.
set -euo pipefail

input="$(cat)"

# jq is optional; degrade gracefully to a minimal line if absent.
if ! command -v jq >/dev/null 2>&1; then
	printf '%s' "${PWD##*/}"
	exit 0
fi

cwd="$(printf '%s' "$input" | jq -r '.workspace.current_dir // .cwd // empty')"
[ -n "$cwd" ] || cwd="$PWD"
model="$(printf '%s' "$input" | jq -r '.model.display_name // .model.id // empty')"
style="$(printf '%s' "$input" | jq -r '.output_style.name // empty')"

dir_name="${cwd##*/}"

branch=""
dirty=""
if git -C "$cwd" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
	branch="$(git -C "$cwd" branch --show-current 2>/dev/null)"
	[ -n "$branch" ] || branch="$(git -C "$cwd" rev-parse --short HEAD 2>/dev/null)"
	[ -z "$(git -C "$cwd" status --porcelain 2>/dev/null)" ] || dirty="*"
fi

# ANSI colors (dim separators keep it readable on light/dark themes).
c_dir='\033[36m'; c_git='\033[32m'; c_model='\033[35m'; c_style='\033[33m'
c_sep='\033[2m'; c_off='\033[0m'
sep=" ${c_sep}·${c_off} "

line="${c_dir}${dir_name}${c_off}"
[ -n "$branch" ] && line="${line}${sep}${c_git}${branch}${dirty}${c_off}"
[ -n "$model" ] && line="${line}${sep}${c_model}${model}${c_off}"
[ -n "$style" ] && line="${line}${sep}${c_style}${style}${c_off}"

printf '%b' "$line"
