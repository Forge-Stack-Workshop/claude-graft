---
name: automation-forge
description: Use to turn recurring work into new Claude skills or agents. Analyzes recent transcripts, memory, and the current task, proposes 1-3 candidate skills/agents, and — only after explicit user validation — scaffolds them into the tracked repos with the correct chrysa conventions and wiring. The generation step NEVER runs without validation.
disable-model-invocation: true
---

# automation-forge

Detect what the user does repeatedly and forge a skill or agent for it.
Invoke with `/automation-forge`. Two phases, hard gate between them.

## Phase 1 — Analyse & propose (read-only)

1. **Gather recurrence signals**, in priority order:
   - Current + recent conversation: repeated multi-step manual sequences.
   - Memory index `MEMORY.md` + fiches: recurring campaigns, gotchas, rules
     with no tool behind them (a rule with no enforcer is a strong candidate).
   - Optional: `~/.claude-perso/history*` / transcript files if present, grepped
     for repeated command shapes.
2. **Skill vs agent decision:**
   - **Skill** = a repeatable procedure/expertise the main thread runs inline,
     or a user-triggered action (`/name`). Bundles templates/scripts.
   - **Agent** = specialized worker run in isolation (own context/tools), for
     parallel review/analysis or a scoped tool set. Lives in `claude-config`.
   - **Hook** (not this skill) = if the need is "automatically on every X",
     it is a hook, not a skill — say so and point to `update-config`; do not
     fake automation with a skill.
3. **Propose 1-3 candidates**, each with: name (kebab-case), type, one-line
   description, invocation control, trigger examples, and the 3-6 concrete steps
   its body would contain. Cite the recurrence evidence for each.
4. **Validate** via AskUserQuestion — one option per candidate plus
   "Ajuster" and "Aucun". Do NOT scaffold anything yet.

## Phase 2 — Forge (only on validation)

For each validated candidate:

### Skill
- Write `chrysa-skills/functional/<name>/SKILL.md` (or `identity/` if it defines
  how Claude works rather than a functional task).
- Frontmatter: `name`, `description` (start with "Use when/for…", include
  triggers), and invocation control:
  - side effects (deploy/commit/merge/send) → `disable-model-invocation: true`
  - pure background knowledge → `user-invocable: false`
  - both → omit both.
- Symlink into the active dir:
  `ln -sfn <repo path> ~/.claude-perso/skills/<name>`.

### Agent
- Write `claude-config/claude/agents/<name>.md` with frontmatter
  `name`, `description`, `tools` (least-privilege — list only what it needs).
- Symlink into `~/.claude-perso/agents/<name>.md` if that dir uses symlinks
  (check the existing pattern first).

### Always
- Follow existing conventions: match the tone/structure of a neighbouring
  skill/agent; link related memories with `[[slug]]`.
- Verify it loads (SKILL.md resolves; frontmatter valid).
- Report: files created, symlinks, and that repos are left UNCOMMITTED unless
  the user asks to commit (chrysa account, watch the guardrail hook).

## Guardrails

- Never scaffold without Phase-1 validation.
- Don't duplicate an existing skill/agent — grep the skill list first.
- Keep bodies tight and evidence-based; no generic filler.
- See [[claude-automation-guardrails]] for the layout (source repos + active
  symlinks + settings wiring).
