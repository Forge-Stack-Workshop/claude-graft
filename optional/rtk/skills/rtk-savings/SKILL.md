---
name: rtk-savings
description: Use when running shell commands whose output is verbose — builds, tests, git, gh, docker, package managers, file reads and searches — or when asked how many tokens RTK has saved. Covers RTK (Rust Token Killer), the prefix rule, and how to read the savings.
---

# RTK token savings

[RTK](https://github.com/dhamidi/rtk) (Rust Token Killer) is a local CLI proxy
that filters and summarises a command's output **before it reaches the context
window** — test runs collapse to their failures, `git diff` to its changed
lines, `ls`/`tree`/`read`/`grep` to a compact form. Typical reduction is
60–90% on common development commands, and the output still says what the raw
command said.

It exists only if the template was installed with `--with-rtk`, and only works
where the `rtk` binary is on `PATH`. Everything here is a no-op otherwise.

## The rule

**Prefix a verbose command with `rtk`.** If RTK has a filter for it, it uses it;
if not, the command passes through unchanged — so `rtk` is always safe to reach
for. This holds inside `&&` chains too:

```bash
# instead of
git status && git log --oneline -5 && git diff

# run
rtk git status && rtk git log --oneline -5 && rtk git diff
```

Highest-value proxies, by how much they save:

| Command | Proxy | Why |
| --- | --- | --- |
| tests | `rtk pytest`, `rtk jest`, `rtk vitest`, `rtk cargo test` | failures only (90–99%) |
| build/lint | `rtk tsc`, `rtk lint`, `rtk next build`, `rtk cargo build` | grouped by file (70–87%) |
| git | `rtk git status\|log\|diff\|show` | compact (59–80%) |
| gh | `rtk gh pr view\|checks`, `rtk gh run list` | compact (26–87%) |
| files | `rtk ls`, `rtk read`, `rtk grep`, `rtk find` | compact (60–75%) |
| infra | `rtk docker …`, `rtk kubectl …` | deduplicated (~85%) |

Passthrough covers subcommands not listed — `rtk git worktree`, `rtk gh api`.
Use `rtk proxy <cmd>` to run one command tracked but **unfiltered** when you
need the raw output to debug.

## Where it does NOT change the doctrine

RTK filters output; it does not change *how* a command is allowed to run. When
the project's rule is that tests, lint and builds go through Docker or
pre-commit and never the host (see `.claude/rules/testing.md`, the
`warn-host-test-lint` guard), that still holds — `rtk pytest` on the host is a
host invocation like `pytest` is. Reach for RTK on the read-and-inspect
commands (`rtk git`, `rtk ls`, `rtk read`, `rtk grep`, `rtk gh`) and on the
test/lint output *inside* the sanctioned wrapper, e.g. `docker compose run --rm
app rtk pytest`.

RTK is offline by design: a local binary, a local SQLite history, no network
and no telemetry ping in normal use — it fits the offline-first standard rather
than fighting it.

## Reading the savings

```bash
rtk gain -p            # savings for this project (rate, tokens saved, count)
rtk gain --history     # recent commands with their individual savings
rtk cc-economics       # Claude Code spend (ccusage) vs RTK savings
rtk discover           # commands in past sessions that missed an RTK filter
```

`/rtk` runs the project summary for you. `rtk gain --failures` lists commands
that fell back to raw execution — a parse failure to report upstream, not a
reason to stop prefixing.
