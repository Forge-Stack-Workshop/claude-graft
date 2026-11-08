---
name: shortcut-sync
description: Use to audit and repair drift between project reality and Shortcut, enforcing the two chrysa tracking rules — every non-abandoned project past the Idée stage must exist in Shortcut, and every Shortcut ticket past "In Progress" must link a GitHub branch/commit/PR. Cross-checks Notion Projets, Shortcut, and GitHub.
disable-model-invocation: true
---

# shortcut-sync

Keep Shortcut consistent with the two governance rules:

1. **project-past-idea-in-shortcut** — any project beyond the *Idée* status
   (and not Abandonné) must be reflected in Shortcut.
2. **shortcut-in-progress-github-link** — any Shortcut ticket beyond
   *In Progress* must link a GitHub branch / commit / PR.

## Prerequisite — Shortcut access is per-folder

The Shortcut MCP is NOT global. It is configured per project, in that repo's
`.mcp.json`, because token/team scope depends on the folder. Before running:

- Confirm a Shortcut MCP (or API token) is available for the current folder.
- If absent and the folder needs it, add it to the folder's `.mcp.json`
  (do NOT put it in the global `~/.claude-perso/settings.json`).
- If no Shortcut access here, run in report-only mode from Notion + GitHub and
  emit the actions the user must take manually.

## Procedure

1. **Pull project truth** from Notion Projets V2 — status + GitHub link per
   project (see [[notion-recon-2026-08-22]], [[notion-projets-v2-restructuration]]).
2. **Pull Shortcut** stories/epics for the scope in question.
3. **Rule 1 audit** — projects status > Idée and ≠ Abandonné with NO Shortcut
   entry → list as "missing in Shortcut".
4. **Rule 2 audit** — Shortcut tickets in a state after *In Progress* (Done,
   Ready for review, etc.) with NO GitHub link → list as "missing GitHub link";
   try to resolve the branch/PR from the repo before flagging.
5. **Report + propose**, do not bulk-mutate silently. Present a table:
   project/ticket | rule violated | proposed fix. Apply only on confirmation.

## Output

Two tables (Rule 1 gaps, Rule 2 gaps) + the concrete create/link actions.
