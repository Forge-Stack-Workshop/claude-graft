---
name: archify-extras
description: Companion CLI helpers around the pinned upstream `archify` skill — headless export of a delivered Archify HTML to full-resolution PNG / PDF / SVG in both light and dark themes, batch validate+deliver+export of many specs, a Mermaid→Archify JSON scaffolder, and read-only repo stack detection to propose Archify component parameters. Use when the user wants image/vector/PDF output of an Archify diagram from the command line, wants to process several diagrams at once, wants to start an Archify spec from existing Mermaid, or wants Archify component types/labels auto-detected from a real repository instead of guessed by hand. Does not modify the frozen upstream skill.
license: MIT
metadata:
  version: "0.2.0"
  companion_to: archify@2.16.0
---

# archify-extras

Thin, dependency-free wrappers around the **pinned** `~/.claude/skills/archify`
(v2.16.0). They add what the upstream CLI lacks: scriptable multi-format export,
batch processing, and Mermaid import. The upstream skill is never edited.

Requires Node ≥18, a Chrome/Chromium (`$ARCHIFY_CHROME` or auto-probed), and
ImageMagick for PNG margin-trim (optional).

## Rule alignment

Mermaid stays the source of truth (see the `archify-usage-rule` memory). These
helpers render/convert — they do not become the diagram of record.

## Tools

### 1. Export — `bin/archify-export.mjs`
Full-resolution PNG / PDF / SVG of a **delivered** Archify HTML, light and/or dark.

```bash
ARCHIFY_CHROME=/path/to/chrome \
node bin/archify-export.mjs diagram.html \
  --out-dir ./out --themes light,dark --formats png,pdf,svg \
  --scale 2 --width 1600 --height 2000
```

- Theme is forced by rewriting the root `data-theme` **and** re-asserting it after
  the viewer's own JS init (the viewer otherwise overrides a static attribute).
- PNG margins auto-trimmed (`magick -trim`) unless `--keep-margins`.
- Output: `<stem>.<theme>.<fmt>` beside `--out-dir`.

### 2. Batch — `bin/archify-batch.mjs`
Validate → deliver → (optional) export a list of specs.

```bash
node bin/archify-batch.mjs a.architecture.json b.sequence.json \
  --archify ~/.claude/skills/archify --out-dir ./out \
  --quality showcase --export png --themes light,dark
```

Type comes from each spec's `diagram_type` (fallback `*.<type>.json`). Non-zero
exit if any spec fails validation/delivery; failures are reported per spec.

### 3. Mermaid import — `bin/mermaid-to-archify.mjs`
Scaffold **and optionally render** an Archify diagram from Mermaid.

```bash
# JSON scaffold only:
node bin/mermaid-to-archify.mjs flow.mmd --title "…"        # -> flow.architecture.json

# Full graph: JSON -> auto-repair -> interactive HTML -> PNG light+dark:
node bin/mermaid-to-archify.mjs flow.mmd --title "…" \
  --render --export png --themes light,dark
```

Supported: `flowchart`/`graph`→architecture, `sequenceDiagram`→sequence,
`stateDiagram(-v2)`→lifecycle. Flowcharts use a **layered (longest-path) layout**
so children sit one column right of their parent — this avoids the skip-crossings a
flat row produces. `--render` then runs the upstream validate/deliver and an
**auto-repair loop** that applies the validator's own `labelAt` suggestions **and
auto-routes edge crossings** (architecture: a `via` detour through a clear channel
below every node; lifecycle: a bottom→top drop, the upstream cross-lane pattern).

`stateDiagram`→lifecycle: `[*]`-start and `-->[*]`-terminals detected; state types
inferred (start / decision on branch / waiting on wait-words / success|failure on
terminal). Maps to lifecycle's fixed geometry (main rail cols 0..4, outcome band
cols 0..2). A machine with **>5 main-rail states doesn't fit** lifecycle — the
command errors and tells you to use a flowchart instead.

Edge crossings (a mid-flow branch to a terminal, siblings skipping a node) are now
auto-routed. Anything the router still cannot resolve makes the command exit
non-zero and list the remaining diagnostics instead of shipping a broken graph —
apply a manual `route`/`via`/`channel` pass in that rare case.

Flags: `--render`, `--export png,pdf,svg` (implies `--render`), `--themes`,
`--quality standard|showcase` (default `standard`), `--archify DIR`, `--no-repair`.

### 4. Stack detection — `bin/detect-stack.mjs`
Read-only, no-network scan of a repository's manifest files, proposing the
`componentType` (architecture schema enum: `frontend|backend|database|cloud|
security|messagebus|external`), label, and sublabel Archify parameters instead
of guessing them by hand.

```bash
node bin/detect-stack.mjs /path/to/repo --json > stack.json
node bin/detect-stack.mjs /path/to/repo               # human-readable summary
node bin/detect-stack.mjs /path/to/repo --depth 4     # deeper walk (monorepos, nested Helm charts)
```

Detects, from real files only (no inference from names/proximity):
- **Python**: `requirements*.txt`, `pyproject.toml`, `Pipfile`, `manage.py` →
  Django/DRF/FastAPI/Flask/Celery, Postgres/PostGIS, Redis, uWSGI, Sentry,
  ScoutAPM, Stripe.
- **Node/JS/TS**: every `package.json` found → React/Vue/Angular/Next/Express/
  NestJS, Webpack/Vite, Redux/RTK, React Query, Radix/MUI/Tailwind, i18n,
  Sentry, Stripe/PayPal, Axios.
- **Swift/iOS**: `.xcodeproj`, `Package.swift`, `*.swift` → SwiftUI vs UIKit,
  SPM remote dependencies.
- **Infra**: `Chart.yaml` (Helm), `*.tf` (Terraform), `Dockerfile`/
  `docker-compose.yml`, ArgoCD `Application` manifests (`argoproj.io` marker).
- **Data stores / messaging / auth** (keyword scan across compose + YAML
  manifests, capped to 60 files): Postgres, Redis/KeyDB, MySQL, MongoDB,
  RabbitMQ, Kafka, Elasticsearch/OpenSearch, SSO/OIDC/Keycloak/Gravitee.

`--json` output includes `evidence[]` (which file triggered each Python/Swift/
Helm signal) and a ready-to-paste `suggested_components[]` fragment — naive
left-to-right positions that still need repositioning to clear Archify's
layout validator (crossings, label-overlap; see upstream `SKILL.md`). This
tool proposes parameters; it does not replace reading the code before
authoring evidence-backed nodes (`sources[]` + `meta.repository`).

Validated against 6 real repositories (Django+DRF+Celery monolith, 2 React/
Webpack SPAs, a Swift/SwiftUI app, a Django+Celery async service, and a
Helm+ArgoCD+Terraform infra repo) — output matched manual code-reading in
every case.

## Limits (honest)

- Light-theme force depends on the viewer's theme JS shape (works on 2.16.0):
  the copy rewrites root `data-theme`, sets `localStorage.archify-theme`, and
  re-asserts the attribute after the viewer's own init.
- SVG is lifted from the rendered DOM with document `<style>` inlined as CDATA and
  the XML namespace injected — verified to render standalone (valid XML + browser
  render). Theme fidelity follows the forced theme of the source copy.
- Mermaid auto-layout does not solve edge routing; branchy graphs expect a
  validate/repair pass. Linear flows render cleanly end-to-end.

## Uninstall

```bash
rm -rf ~/.claude/skills/archify-extras
```
