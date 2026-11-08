---
name: project-memory
description: Use when a fact about this project is worth carrying across sessions — a decision and its reason, a non-obvious constraint, a gotcha that cost time, a pointer to an external resource. Also use at the start of work to recall what past sessions already learned. Writes one fact per file under a namespace and keeps an index; it never stores what the code, git history, or CLAUDE.md already records.
---

# Durable project memory

A session ends and its context is gone. The decision you reasoned through, the
constraint that was not written down anywhere, the trap that took an hour to
find — the next session rediscovers all of it from zero. This skill is the file
where such a thing survives, so the fourth session on a project does not repeat
the first.

It is a **file-based** memory on purpose: plain Markdown in the repository,
versioned with the code, readable by a human and greppable by any tool. No
daemon, no database, no network — it works offline and it works in five years.
The idea is grafted from agent-orchestration memory stores (namespaced,
key-addressed, persisted), stripped of the runtime they depend on.

## What earns a memory, and what does not

Write a memory only for what is **true across sessions and not derivable from
the repository**:

- a decision and the reason behind it — especially the option that was rejected;
- a constraint the code cannot state (an external system's quirk, a business
  rule that lives in someone's head, a deadline);
- a gotcha: the thing that looked broken and was not, with the resolution;
- a pointer to an external resource — a dashboard, a ticket, a runbook URL.

Do **not** write what the repository already holds. Code structure, a past bug's
fix, the git log, anything in `CLAUDE.md` or the rules — the source is the truth
for those, and a stale copy is worse than no copy. If asked to remember one of
those, ask what was *non-obvious* about it and store that instead.

A memory is a liability the day it goes wrong. When a fact turns out false,
**delete its file** — do not leave a corrected-in-place lie. When a memory names
a file, symbol, or flag, it is only as good as that name still existing; verify
before you rely on it.

## Layout

```
.claude/memory/
├── INDEX.md                  one line per memory, loaded first
├── decision/
│   └── async-over-threads.md
├── constraint/
│   └── vendor-rate-limit.md
├── gotcha/
│   └── ipv6-localhost-trap.md
└── reference/
    └── grafana-dashboards.md
```

The **namespace** is the top folder — `decision`, `constraint`, `gotcha`,
`reference` are the defaults; add one when a project genuinely needs it, do not
invent a taxonomy up front. The **key** is the filename, a short kebab-case slug
that reads as the fact. One fact per file: a file you cannot summarise in one
line is two memories.

## Writing a memory

````markdown
---
key: async-over-threads
namespace: decision
description: why the workers are asyncio, not a thread pool — used to decide relevance on recall
created: 2026-09-11
---

Workers run on asyncio, not a thread pool. The vendor SDK is async-only below
the surface and blocks the loop if driven from threads.

**Why:** a thread-pool spike in load tests serialised on the SDK's internal
lock; asyncio held throughput.
**Supersedes:** nothing. **Verify against:** `workers/runtime.py`.

Related: [[vendor-rate-limit]]
````

`description` is what a future reader scans to decide if the memory is relevant
— write it for that job, not as a title. Convert relative dates to absolute the
moment you write them: "next week" is meaningless to the session that reads it.
Link related memories with `[[key]]`; a link to a memory that does not exist yet
is a fine note that one is worth writing.

## The index

`INDEX.md` is the one file a session reads before starting work — it is the map,
never the content.

```markdown
# Project memory index

## decision
- [async-over-threads](decision/async-over-threads.md) — workers are asyncio, SDK blocks on threads

## constraint
- [vendor-rate-limit](constraint/vendor-rate-limit.md) — 100 req/min hard cap, 429s are unrecoverable for 60s

## gotcha
- [ipv6-localhost-trap](gotcha/ipv6-localhost-trap.md) — `localhost` resolves v6 first, dev server binds v4 only
```

Every new memory adds exactly one line here; every deleted memory removes its
line. An index that disagrees with the folder is the first thing to fix.

## Recall

Before non-trivial work, read `INDEX.md` and open the memories whose
`description` touches the task. Treat what you read as **background written when
it was written** — it states what was true then, not a standing instruction, and
a fact that names code you can check is a claim to verify, not a fact to trust.

## Report

When you write, delete, or correct a memory, say which and why in one line. The
memory that changes silently is the one that misleads the next session.
