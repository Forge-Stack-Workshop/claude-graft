---
name: spec-dashboard
description: |
  Détecte les docs spec / plan / ADR / PRD / roadmap markdown éparpillés n'importe où
  dans un workspace multi-repos (n'importe quelle convention de dossier : docs/specs,
  docs/plans, docs/superpowers, plans/, adr/, racine repo) et les agrège dans un seul
  dashboard HTML navigable pour le suivi, groupé par repo avec filtres statut/type/date.
  Détection agnostique-dossier (match segment de chemin OU nom de fichier), statut
  bucketé depuis frontmatter YAML ou prose inline (`Status:` / `**Statut** :`).
  Triggers FR : "visualise mes specs", "dashboard des specs/plans", "suivi des specs",
  "où en sont mes plans", "agrège les specs du workspace".
version: 0.1.0
category: functional
adrs: []
status: scaffolded
---

# spec-dashboard

Aggregate scattered spec/plan/ADR/PRD/roadmap markdown docs across a multi-repo
workspace into one self-contained HTML dashboard for browser-based tracking.

## When to use

- "visualise / suis mes specs et plans", "dashboard des specs", "où en sont mes plans"
- Any time specs live in different folders per project and need a single aggregated view.

## How it works

`scripts/scan.py` walks every `*.md`, keeps files whose **path segment** (`specs?`,
`plans?`, `adr`, `prd`, `superpowers`, `roadmaps?`) or **filename** matches, and extracts
light metadata from YAML frontmatter or inline prose:

- `repo` (top dir, or `chrysa/<name>`), `type` (spec/plan/adr/prd/roadmap), `title`
- `status` — bucketed (done / approved / in_progress / overdue / draft / stub / unknown)
  from `status:` frontmatter or `Status:` / `**Statut** :` prose
- `created` / `updated` dates (frontmatter or dated filename), `linked_spec`

Output: `inventory.json` (data) + `dashboard.html` (self-contained, filter by
title/repo/type/status, grouped collapsible per repo, theme-aware).

## Steps

1. Run the scanner from the workspace root you want to index:
   `python3 <skill>/scripts/scan.py "$WORKSPACE_ROOT" --json inventory.json --html dashboard.html`
   Prints counts by type and status; writes `inventory.json` + `dashboard.html`.
2. Report the counts and give the local path
   (`file://.../dashboard.html`) to open in a browser.
3. If the user wants a **shareable web URL** (not just a local file), publish via the
   `Artifact` tool: first load the `artifact-design` skill, then run
   `python3 <skill>/scripts/build_artifact.py inventory.json artifact.html` to render a
   body-only page (no `<!doctype>/<html>/<head>/<body>` — Artifact wraps it), and call
   `Artifact` with favicon 📐.
4. For recurring tracking, re-run step 1 anytime; suggest `/loop` for a cadence.

## Files

| Path                     | Purpose                                                    |
| ------------------------ | ---------------------------------------------------------- |
| `scripts/scan.py`        | Scanner → `inventory.json` + standalone `dashboard.html`   |
| `scripts/build_artifact.py` | Render body-only `artifact.html` from `inventory.json` for publishing |

## Notes

- Detection is location-agnostic by design — no repo needs a fixed folder layout.
- Many docs have no machine-readable status; that is expected. Encourage adding
  `status:` frontmatter to key specs to light up the status columns.
- Excludes: `.git`, `node_modules`, `.venv`, `notion-export`, `.claude`, build/cache dirs.
- Tune detection in `scan.py`: `DIR_HINTS`, `NAME_HINTS`, `STATUS_BUCKETS`, `EXCLUDE_DIRS`.
