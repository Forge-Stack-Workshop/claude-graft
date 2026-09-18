---
name: harness-diet
description: Use when the session's always-loaded context feels heavy, when a memory index or CLAUDE.md is reported over its size limit, or when asked to measure and shrink what Claude loads every turn — measures the always-on budget, names the biggest consumers, and proposes cuts, never deleting anything without confirmation.
---

# Trimming what loads every turn

Everything loaded at the start of every turn is paid on every turn. A memory
index, a CLAUDE.md, always-on rules, an over-stuffed skill roster — none of it
is free, and past a limit the harness silently truncates it, so the last
entries stop being read at all. This measures that budget and proposes the
smallest cut that fixes it. It measures and proposes; it does not delete.

## 1. Measure

Report actual bytes, largest first — never estimate:

```
wc -c CLAUDE.md ~/.claude*/CLAUDE.md \
      <memory-index> \
      .claude/rules/*.md 2>/dev/null | sort -rn
```

Add the always-on skill/agent count (`ls .claude/skills | wc -l`,
`ls .claude/agents | wc -l`) and any file a hook injects on every
`UserPromptSubmit`. Name each consumer with its size and whether it is **over a
stated limit** — an index that truncates is the urgent line, because its tail is
already invisible.

## 2. Find the fat

The consumers worth cutting, in order:

- **A memory/index over its read limit** — the tail is dropped every load.
  Rule: one line per entry, ≤ ~200 chars; detail belongs in the topic file, not
  the index.
- **Duplicated guidance** — the same rule stated in CLAUDE.md *and* a rule file
  *and* a skill. Keep one home; the others link to it.
- **Stale entries** — a memory whose facts are resolved, superseded, or name a
  file that no longer exists. Merge into its successor or drop.
- **Always-on that should be on-demand** — a rule loaded every turn that only
  matters for one task belongs in a skill, which loads when triggered.

## 3. Propose, with the diff visible

Present the cut as a table before touching anything:

| File | Now | After | How |
| ---- | --: | ----: | --- |

For a memory index specifically: show which entries merge, which shorten, which
drop — and **for every drop, one line of why** (resolved / superseded by X /
file gone). The reader approves the list, not a summary of it.

## 4. Cut only what was approved

Then apply, and only that. Two hard rules:

- **Never delete a memory or an index entry on your own initiative.** A dropped
  fact is unrecoverable from here; the person decides.
- **If another session may be writing the same file** (a memory index often has
  concurrent writers), say so and re-read immediately before each edit — a blind
  edit races the other writer and loses one of the two changes.

## 5. Verify

Re-measure. State the new size against the limit, and confirm no entry was lost
beyond those on the approved list. If the file is still over, say so — a diet
that half-works and claims success is worse than one that reports the shortfall.
