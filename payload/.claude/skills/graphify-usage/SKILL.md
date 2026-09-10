---
name: graphify-usage
description: Query and maintain a codebase/docs knowledge graph with graphify — scoped queries, entity paths, focused concept explanations, and graph updates. Use for any codebase or documentation question when graphify-out/ exists, before falling back to raw grep.
origin: authored
---

# Graphify Usage

Turn codebase/docs questions into scoped graph lookups instead of raw grep.

## Prerequisites (preflight)

Requires **graphify**. Verify before use; warn if missing:

```bash
command -v graphify >/dev/null 2>&1 || echo "WARN: graphify not installed — install: pipx install graphify (adapt to actual package)"
```

## When to Activate

- Any question about a codebase, its architecture, or its documentation.
- `graphify-out/graph.json` exists in the repo.
- Before grepping broadly for "where is X used" / "how does Y relate to Z".
- After finishing code changes, to keep the graph current for the next question.
- When asked for a broad architecture review of a large repo.

## Commands

### `graphify query "<question>"`

Returns a scoped subgraph answering a specific question. This is the default
entry point for any codebase question — cheaper and more precise than grep or
reading whole files.

```bash
graphify query "what calls the dispatch service?"
graphify query "which modules import the provider client?"
```

### `graphify path "<A>" "<B>"`

Returns the relationship path between two named entities (classes, modules,
functions, docs). Use when the question is explicitly about how two things
connect.

```bash
graphify path "MissionDispatcher" "ProviderClient"
graphify path "apps/mission" "apps/provider"
```

### `graphify explain "<concept>"`

Returns a focused subgraph around one concept — its definitions, callers,
and immediate neighbors. Use for "what is X" / "how does X work" questions
scoped to a single node, not a relationship between two nodes.

```bash
graphify explain "ConnectionDisableable"
graphify explain "FSM state transitions"
```

### `graphify update .`

Rebuilds the graph from the current AST — no API cost, no LLM call. Run
after any code change so the graph reflects reality before the next query.

```bash
graphify update .
```

## Query vs Path vs Explain vs Wiki vs Report

| Need | Tool |
| --- | --- |
| Answer a specific, scoped question | `graphify query` |
| Understand how two named entities relate | `graphify path` |
| Understand one concept in depth | `graphify explain` |
| Browse the codebase broadly, no specific question yet | `graphify-out/wiki/index.md` |
| Full architecture review, community structure, god nodes | `graphify-out/GRAPH_REPORT.md` |

Default to `query`/`path`/`explain` — they return a small, scoped subgraph.
Reach for `wiki/index.md` or `GRAPH_REPORT.md` only when the scoped tools
don't surface enough context, or the ask is explicitly "give me the big
picture."

## MCP Integration

Graphify can run as an MCP server so an agent queries the graph as a tool
instead of shelling out:

```bash
graphify.serve graph.json
```

Once running, prefer the MCP tool calls over CLI invocations inside an
agent session — same underlying queries, no subprocess overhead, and the
results compose naturally with the rest of the agent's tool loop.

## Workflow

1. **Before coding** — run `graphify query "<what I'm about to touch>"` to
   understand existing callers, dependents, and patterns before editing.
2. **While investigating** — use `path`/`explain` to pin down a specific
   relationship or concept instead of opening files speculatively.
3. **After coding** — run `graphify update .` immediately. A stale graph is
   worse than no graph: it returns confident, wrong answers.
4. **Before a large architecture discussion** — read `GRAPH_REPORT.md` once,
   then switch back to scoped `query` calls for follow-ups.

## Pitfalls

- **Stale graph** — editing files without running `graphify update .`
  produces subgraphs that reference removed code or miss new code. Update
  is AST-only and cheap; run it after every batch of changes, not just at
  session end.
- **Grepping instead of querying** — raw grep finds string matches, not
  relationships (callers, dependents, data flow). Default to `graphify
  query` first; fall back to grep only if graphify has no answer or
  `graphify-out/` doesn't exist yet.
- **Reading GRAPH_REPORT.md for a narrow question** — it's built for broad
  architecture review and is large; a scoped `query`/`path`/`explain` call
  answers a specific question faster and with less noise.
- **Ignoring the wiki for onboarding-style browsing** — when there's no
  specific question yet, `wiki/index.md` is faster to navigate than
  wandering through source files.
- **Treating `graph.json` as documentation** — it's a generated artifact,
  not a source of truth to hand-edit; regenerate via `update .` instead.

## Checklist

- [ ] `graphify-out/graph.json` exists before relying on graphify for this repo.
- [ ] Used `query`/`path`/`explain` before grepping raw source.
- [ ] Picked `path` for two-entity relationships, `explain` for one concept.
- [ ] Consulted `GRAPH_REPORT.md`/`wiki/index.md` only for broad review or navigation, not narrow questions.
- [ ] Ran `graphify update .` after modifying code, before trusting the next query.
- [ ] Considered the MCP server (`graphify.serve graph.json`) when running inside a longer agent session.
