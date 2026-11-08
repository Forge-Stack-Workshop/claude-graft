---
name: skill-creator
description: Author a new Claude Code skill correctly — a tight SKILL.md with a trigger-precise description, the right scope, and a preflight for any tool it needs. Use when adding a skill to a library, or when an existing skill under-triggers and needs a sharper description.
origin: authored
---

# Skill Creator

A skill is only as good as its `description`: that string is what the model matches against
to decide whether to load the skill. Most "the skill didn't fire" problems are description
problems, not content problems. This skill is the procedure for authoring one that triggers
when it should and stays quiet when it shouldn't.

## When to use

- Adding a new skill to a library.
- A skill exists but under-triggers (never loads when it should) or over-triggers (loads for
  unrelated tasks) — rewrite its `description`.
- Splitting an overloaded skill that tries to cover two unrelated jobs.

## Anatomy of a good SKILL.md

```markdown
---
name: <kebab-case, matches the folder>
description: <what it does> + <when to reach for it> + <any required tool>. One or two sentences.
origin: authored
---

# <Title>

<One-paragraph "why this exists" — the problem, not a feature list.>

## Prerequisites (preflight)   <!-- only if it needs an external tool -->
## When to use / When NOT to use
## Procedure or Core commands
## Guidance / pitfalls
```

## Rules for the `description` (the load-bearing line)

- Lead with **what it does**, then **when to use it** — include the concrete trigger words a
  user would actually type ("architecture diagram", "flaky test", "rate limit").
- Name the **required tool** if any ("Requires the `rtk` binary") so the model knows the cost.
- State the **negative boundary** when a skill is easily over-triggered ("Use only when the
  user explicitly mentions X; not merely because a task could benefit from Y").
- Keep it to one or two sentences. A vague description is the #1 cause of under-triggering.

## Scope — one job per skill

- If the SKILL.md needs the word "also" to describe a second unrelated job, split it.
- Prefer sharpening one skill over creating a near-duplicate that competes for the same trigger.

## Preflight (mandatory when a tool is required)

Any skill that depends on an external binary/library must verify it and warn if missing —
never assume it is installed:

```bash
command -v <tool> >/dev/null 2>&1 || echo "WARN: <tool> not installed — install: <cmd>"
```

Fall back to a native path when the tool is absent; don't block the task on it.

## Procedure

1. State the job in one sentence. If you can't, the scope is wrong.
2. Draft the `description` with what + when + required-tool + boundary.
3. Write the body: why → preflight → when to use / not → procedure → guidance.
4. Dry-run the trigger: would this description match the user phrasings you expect, and NOT
   match three unrelated tasks? Adjust.
5. Keep it short — a skill the model can read in full beats an exhaustive one it skims.

## Pitfalls (reject in review)

- Description that lists features but never says *when* to use the skill.
- A required tool with no preflight.
- Two jobs in one skill.
- Restating general good practice the model already knows, instead of the specific procedure.
