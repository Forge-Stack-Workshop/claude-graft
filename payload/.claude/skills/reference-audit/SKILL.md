---
name: reference-audit
description: Use when a chrysa project needs its external references (from the shared Notion "Corpus Chrysa") mined for reusable ideas — reads the project's corpus, audits each reference (clone OSS / research SaaS), extracts concepts mapped to the repo's own modules, and generates reality-checked spec+plan pairs. Read-only on Notion; works for any chrysa repo.
---

# reference-audit

Turn a project's **Notion reference corpus** into concrete engineering artifacts:
`corpus → per-reference audit → concept map → spec/plan pairs`. Repeatable for any chrysa
repo — the corpus is the shared `📚 Références externes` / `🔗 Projet × Référence` databases;
only the `project` name changes.

The audit→concept→spec middle is judgment-heavy: this skill orchestrates the calling agent
plus a sub-agent fan-out. Only step 0 (corpus fetch), step 1a (git clone) and step 4
(tracking) are mechanical.

**Non-negotiable guardrails**
- **Notion is READ-ONLY.** Never create/update a Notion page or property here. A write-back
  (fill `À reprendre`/`À éviter`, link generated specs) is a separate V2 behind its own class
  following the `notion-recon` REST/validation discipline.
- **Concepts, never vendored code.** Verify each reference's license; reimplement to chrysa
  standards. GPL/copyleft sources → clean-room, no code copy. For any AI concept, restate LLM
  provider-independence (port + ≥2 adapters incl. a local model).
- **Reality-check before every spec.** Probe the repo, scope the true gap, never fabricate —
  a spec that duplicates shipped code is a defect. State the real gap in each doc.

## Inputs
- `project` — the name as used in the Notion join-row titles (e.g. the repo name).
- Optional `--only <ref[,ref]>` — restrict to named references (pilot runs).
- `NOTION_TOKEN` in env, with access to the Corpus Chrysa data sources (a Notion integration
  token, not the interactive MCP session).

## Step 0 — Resolve the corpus (mechanical)
Run the tested helper; do not query Notion by hand:
```bash
cd scripts
NOTION_TOKEN=$NOTION_TOKEN python fetch_corpus.py --project <project>
```
Output = JSON array, each `{name, url, type_label, audit_method, proximity, roles, take,
avoid, why}`. `audit_method` is `clone` (OSS) or `product-research` (closed SaaS), derived
from the Notion `Type`. On 429 the helper retries with bounded backoff; if it still fails,
wait and rerun — do NOT bypass the tested path with ad-hoc MCP calls.
The corpus data-source ids live in `scripts/corpus_settings.py` (`CorpusSettings`, env-overridable).

## Step 1 — Audit each reference (sub-agent fan-out, ≤5 parallel)
Dispatch **by `audit_method` (lookup, not if/elif)**:

| audit_method | Agent brief |
| ------------ | ----------- |
| `clone` | `git clone --depth 1 <url>` into the scratchpad, audit the code: stack, architecture, reusable modules (file:concept), license, anti-patterns to drop. |
| `product-research` | No clone (closed product). Research via WebSearch + WebFetch + `firecrawl`: features, UX, public API/docs, data model. Seed with the corpus `take`/`avoid`. Extract reusable *concepts*, not code. |

Each agent returns ONE normalized concept block:
```
### <concept name> — <reference>
- What it is: …
- Adopt → <target module path in THIS repo, chosen from its own architecture>
- Sub-patterns: …
- Drop: <anti-patterns to reject>
- License / source: <license/closed> · <url>
- Provenance: corpus take="…" avoid="…"
```
Give each agent: the reference row, **this repo's own layout** (discover it — do not assume
another project's paths), and the block format. Use `proximity`/`roles` to weight effort.

## Step 2 — Aggregate → concept map
Upsert the blocks into `docs/external-repo-concepts.md` (create if absent), keyed by
reference name — replace, don't duplicate. Keep: a license table, `### N. <concept> — <ref>`
sections with **Adopt →**/**Drop:**, an "LLM provider independence" section for AI concepts,
a priority order, and a convergences note (references that map to the same feature).

## Step 3 — Generate spec + plan pairs
For each concept worth a feature (high proximity / clear module target / net-new capability):
1. **Reality-check first** — read the target modules; if the capability partly ships, scope
   to the real gap, never fabricate.
2. Write the pair to the repo's spec/plan convention (mirror an existing pair's frontmatter
   and section set — typically `docs/specs/<slug>.md` + `docs/plans/<slug>.md`):
   - spec: `name / status: draft / author / created`; Context/problem · Goals · Non-goals ·
     Functional requirements · Acceptance criteria (unchecked) · Constraints & dependencies ·
     Risks / open questions.
   - plan: `name / status: draft / spec: <spec path> / created`; Summary · Files to touch
     (table) · Steps · Tests · Risks & rollback · Standards checklist.
   - Slug = shared basename join key; keep spec and plan in sync.
   Converging references produce ONE pair; a concept that folds into an existing spec updates
   that spec rather than creating a parallel one.

## Step 4 — Track (mechanical)
Refresh the spec/plan inventory so new pairs surface (uses the `spec-dashboard` skill):
```bash
python <chrysa-skills>/functional/spec-dashboard/scripts/scan.py --json inventory.json .
```

## Verification
- `fetch_corpus.py --project <p>` returns the expected reference count with correct
  `audit_method` per row.
- Dry-run on 2 refs (1 `clone`, 1 `product-research`) → one concept block each, zero Notion
  writes.
- Full run → `docs/external-repo-concepts.md` updated + N spec/plan pairs, slugs paired,
  frontmatter valid, each spec reality-checked (no duplication of shipped code).
- `ruff check scripts/` clean; the helper's own tests pass (see `scripts/README.md`).

## Notes
- Corpus coordinates + the read-only client live in `scripts/` (`CorpusSettings`); the corpus
  is shared across all chrysa projects, so only `--project` changes between repos.
- The corpus `Type` decides `clone` vs `product-research`: a reference whose Notion URL points
  at a product site (not its repo) is treated as `product-research` even if OSS — fix the
  corpus `Type`/`URL` in Notion if you want it cloned.
