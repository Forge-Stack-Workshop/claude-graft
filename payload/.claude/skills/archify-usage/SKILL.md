---
name: archify-usage
description: Extract and diagram a codebase's ARCHITECTURE with archify — modules, dependency layers, bounded contexts, C4 diagrams, coupling/cycle detection, and architecture fitness functions. Complements graphify (knowledge graph / semantic queries): archify answers "how is this built", graphify answers "what does this mean".
origin: authored
---

# Archify Usage

> Note: adapt every command shown below to archify's real CLI. No exact flag
> here is verified — treat this file as a workflow guide, not a command
> reference. Run `archify --help` (or equivalent) to confirm actual syntax
> before use.

Architecture extraction and diagramming tool. Where graphify builds a
knowledge graph for semantic/relationship queries over a codebase, archify
builds a structural view: modules, layers, dependencies, and how they should
(or shouldn't) talk to each other.

## Prerequisites (preflight)

Requires **archify**. Verify before use; warn if missing:

```bash
command -v archify >/dev/null 2>&1 || echo "WARN: archify not installed — install: install per your archify distribution (CLI name to confirm)"
```

## When to Activate

- Onboarding onto an unfamiliar codebase and need the big picture fast.
- Before a large refactor, to see current module boundaries and blast radius.
- Reviewing a PR that touches multiple modules/apps — check for new illegal
  dependencies or layer violations.
- Investigating a dependency cycle, tangled import graph, or "everything
  imports everything" smell.
- Producing architecture documentation (C4 diagrams) for a design review or
  onboarding doc.
- Auditing architectural drift: does the code still match the intended
  layering/bounded contexts from six months ago?
- Setting up or checking architecture fitness functions in CI.

Do not activate for: semantic/content questions ("what does this function
do", "find all usages of X") — that's graphify. Do not activate for a single
file's code quality — that's a code reviewer skill.

## What Archify Produces

- **Module/dependency map** — which modules exist, which import which,
  direction of dependencies.
- **Layered view** — inferred or configured layers (e.g. presentation →
  service → domain → infrastructure) with violations flagged (lower layer
  importing from a higher one).
- **Bounded-context view** — clusters of modules that change together / share
  a domain vocabulary, useful for spotting hidden coupling across supposed
  boundaries (e.g. two Django apps that should be independent but share
  internals).
- **C4 diagrams** — Context (system + external actors), Container (deployable
  units: API, worker, DB, cache), Component (modules inside one container),
  and optionally Code-level for a single component.
- **Dependency/cycle report** — cyclic imports, god modules (high fan-in),
  unstable modules (high fan-out with low stability).
- **Sequence diagrams** — call flow for a chosen entry point (e.g. an API
  endpoint or a dispatch job), when archify supports flow tracing.
- **Fitness function results** — pass/fail checks encoding architecture
  rules ("domain must not import infrastructure", "app X must not depend on
  app Y"), runnable in CI.
- **Export formats** — Mermaid, PlantUML, and/or SVG, for embedding in docs,
  PRs, or wikis.

## Workflow

1. **Scope the extraction.** Point archify at the repo root or a specific
   app/package. For a monorepo with multiple Django apps (see `apps/` in
   padam-av), scope per-app first, then a cross-app pass.
2. **Run the extraction.** Generate the underlying model (modules, imports,
   layers) before asking for any diagram — the diagram is a rendering of
   this model, not a separate analysis.
3. **Pick the diagram level.** Start at Container level for a new codebase
   (what are the deployable pieces), then Component level for the app under
   change. Avoid jumping straight to Code-level — it's rarely useful and
   goes stale fast.
4. **Check the dependency/cycle report.** Any cycle or layer violation is a
   finding, not noise — triage before moving on.
5. **Run fitness functions if configured**, or propose a first set of rules
   from the layers/bounded contexts just extracted (e.g. "no app imports
   from another app's `models/` directly, only through its public API").
6. **Export** the diagram(s) needed (Mermaid for PR descriptions/markdown
   docs, SVG for slides, PlantUML if the doc pipeline expects it).
7. **Re-run after material changes** — a new app, a new cross-app
   dependency, or a refactor that moves modules. Treat the diagram as a
   build artifact, not a one-off drawing.

## Reading the Diagrams

- **Arrow direction = dependency direction**, not data flow or control
  flow — an arrow from A to B means "A imports/depends on B", regardless of
  which side initiates a request at runtime.
- **A layer violation is a broken arrow**, typically drawn in a different
  color or flagged in the report — a lower layer (e.g. `domain/`) importing
  from a higher one (e.g. `views/`) is the classic case to look for first.
- **A cycle between two modules** means they cannot be deployed, tested, or
  reasoned about independently — treat as a defect even if the code "works".
- **A container with many incoming arrows and few outgoing ones** is a
  shared dependency (e.g. `tools/` in padam-av) — check it stays free of
  business logic, per repo convention.
- **A bounded-context boundary crossed by many arrows** signals the split is
  probably wrong, or the two contexts are actually one and should be merged
  in the model (not necessarily in code, but at least in understanding).
- Diagram scope matters: a Component diagram only makes sense next to the
  Container diagram that contains it — read top-down, not diagram-in-isolation.

## Pitfalls

- **Stale diagram treated as truth.** A diagram not regenerated since the
  last major refactor is actively misleading — always check generation
  timestamp/commit before trusting it in a review or onboarding doc.
- **Over-abstraction.** Rendering every module down to file level produces
  an unreadable diagram nobody re-derives value from — prefer fewer, higher
  boxes (Container/Component) over an exhaustive Code-level dump.
- **Confusing archify's structural view with graphify's semantic graph.**
  Don't ask archify "where is X used" (that's a graphify query) and don't
  ask graphify "does this violate our layering" (that's an archify fitness
  function).
- **Fitness functions copied from another project verbatim.** Rules must
  match this repo's actual intended boundaries (e.g. padam-av's
  `apps/provider/` per-provider subpackages, `tools/` as logic-free shared
  layer) — a generic rule set produces false positives that get ignored.
- **Diagramming before the extraction model is scoped correctly.** Running
  a full-repo extraction when only one app changed wastes time and buries
  the relevant signal in noise.
- **Treating a detected cycle as low priority because "it still runs".**
  Cycles are architecture debt regardless of current runtime behavior — they
  block safe extraction/splitting later.

## Complementarity with Graphify

| | archify | graphify |
|---|---|---|
| Answers | "How is this built? What depends on what?" | "What does this mean? Where is X used/defined?" |
| Unit of output | Structural diagram (C4, dependency graph) | Knowledge graph, scoped subgraph query |
| Use for | Architecture review, refactor planning, layering rules | Semantic/relationship questions, code navigation |
| Freshness need | Re-run after structural changes (new module/app/dependency) | Re-run (`graphify update .`) after any code change |

Use both together on a large task: archify to see where a change fits
architecturally, graphify to find every place that needs touching.

## Checklist

- [ ] Extraction scoped to the right level (repo, app, or component) before
      diagramming.
- [ ] Diagram level matches the question (Context/Container for onboarding,
      Component for a change, avoid Code-level by default).
- [ ] Dependency/cycle report checked — no unaddressed cycle or unexplained
      layer violation.
- [ ] Fitness functions, if present, reflect this repo's actual intended
      boundaries — not a generic template.
- [ ] Diagram regenerated after any structural change before being reused in
      a review or doc.
- [ ] Export format matches the destination (Mermaid for markdown/PRs, SVG
      for slides, PlantUML if the doc pipeline requires it).
- [ ] Not used as a substitute for graphify on semantic/content questions.
