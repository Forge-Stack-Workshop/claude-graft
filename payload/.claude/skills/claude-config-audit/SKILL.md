---
name: claude-config-audit
description: Use when asked to audit the Claude setup, when skills/agents/MCP feel duplicated or sprawling across repos, or before a cleanup of the Claude ecosystem — enumerates every tooling source, counts and diffs what each ships, names the duplicates and the drift, and proposes what to consolidate, without changing any config.
---

# Auditing the Claude setup

Tooling sprawls the way dependencies do: each repo grows its own agents, skills
and hooks, and the same capability ends up defined five times with five small
differences. This finds the sources, measures the overlap, and names what to
merge — it reads config, it never rewrites it.

## 1. Enumerate the sources

Claude tooling lives in more than one place. Find them all before counting:

```
ls -d ~/.claude/skills ~/.claude/agents ~/.claude/hooks 2>/dev/null
find ~/Documents -maxdepth 4 \( -name '.claude' -o -name '.claude-plugin' \
     -o -name 'marketplace.json' \) 2>/dev/null
```

List each source with its kind: **live** (`~/.claude`, a symlink to trace),
**distribution** (claude-graft payload/optional), **per-family devkit** (a
`.claude-plugin/marketplace.json`), **hub** (a repo holding many agents/skills).
State which one is the source of truth; the rest should derive from it.

## 2. Count what each ships

Per source, tabulate: skills, agents, commands, hooks, MCP servers, rule files.

```
for d in <each source>; do
  echo "$d  skills=$(ls "$d"/skills 2>/dev/null|wc -l)" \
       "agents=$(ls "$d"/agents 2>/dev/null|wc -l)" \
       "hooks=$(ls "$d"/hooks 2>/dev/null|wc -l)"
done
```

A live roster far larger than the distribution's is the headline number: it
means things were installed outside the channel and will not survive a
reinstall.

## 3. Find the duplicates

Two kinds, both by name and by purpose:

- **Same name, many homes** — a `code-review` in the live roster, in
  pr-review-toolkit, as an agent, as a devkit command. Group them; decide one
  keeper and mark the rest reference-only.
- **Same purpose, different names** — collect skill descriptions and cluster by
  what they do (all the design/UI skills, all the debug skills). Fifteen skills
  that style a frontend are fourteen too many.

Report each cluster as: the members, the one to keep, and the action for the
others (MERGE / USE-AS-REFERENCE / DO-NOT-USE), never a score.

## 4. Name the off-domain weight

Count what is loaded but has no project that uses it — agents and MCP servers
for domains absent from every repo (marketing, sales, unrelated platforms).
These cost context and permission surface for nothing. List them as **park**
candidates: disable, do not delete, so a later need can re-enable.

## 5. Flag the drift and the risk

- **Drift**: a devkit that redefines a standard instead of pointing at the
  shared one; a pinned version behind the source.
- **Risk**: any MCP server or hook with filesystem/shell/network/secret reach —
  list its scope so the permission surface is visible before, not after, an
  incident.

## 6. Propose, do not apply

End with a consolidation table — source, keep, park, merge — and stop. Changing
config is a separate, approved step: this audit is what that step reads. Note
explicitly any source that is **off-limits** (an employer's, or one the user
asked not to touch) so the later cleanup never reaches it.
