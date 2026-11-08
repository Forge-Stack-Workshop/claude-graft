---
name: skill-observer
description: Turn a work session into skill improvements. Use when reviewing how a session went to capture recurring corrections, manual workarounds, and coverage gaps, then propose concrete edits to existing skills and candidates for new ones. Best run periodically over a growing skill library, not after every trivial task.
origin: authored
---

# Skill Observer — self-improving skills

A skill library only improves if someone notices where it fell short. This skill turns a
finished (or in-progress) session into **reviewable proposals**: edits to existing skills and
candidates for new ones — derived from what actually happened, not from guesswork.

Inspired by the "Task Observer" pattern (observe sessions → log patterns → propose skill
updates for human review).

## When to use

- Reviewing a session where you repeatedly corrected the model, or it repeated a manual workaround.
- Periodic hygiene over a **large** skill library (the value compounds with library size).
- After a task hit a gap no existing skill covered.

Skip it for small setups or one-off tasks — directly editing a skill is faster than the loop.

## What to look for (signals)

1. **Corrections** — the user overrode an approach or output; the delta is a candidate rule.
2. **Repeated workarounds** — the same manual step done more than once; a candidate for automation or a skill note.
3. **Coverage gaps** — a task with no matching skill, or a skill that under-triggered (its `description` didn't match the need).
4. **Cross-cutting principles** — a preference that showed up across unrelated tasks; belongs in a broad rule, not one skill.

## Procedure

1. **Collect**: from the session, list concrete moments matching the signals above — each with a one-line evidence quote or file:line.
2. **Attribute**: map each observation to the affected skill (or "new skill" if none fits).
3. **Aggregate**: fold repeated observations into a small set of principles; drop one-offs that won't recur.
4. **Propose, don't apply**: emit a review list —
   - `EDIT <skill>` — the precise change (a sentence, a checklist item, a sharper `description`).
   - `NEW <name>` — one-line purpose + why existing skills don't cover it.
   - `PRINCIPLE <text>` — a cross-cutting rule and where it belongs.
5. **Persist** (optional): append the review list to `.claude/skill-observations/<date>.md` so improvements survive across sessions and can be actioned in a dedicated review.

Never silently rewrite skills from an observation — surface the proposal for human approval first.

## Output format

```
## Skill observations — <date>

EDIT api-design: add "return RFC 7807 problem+json for errors" — user corrected 2 ad-hoc error shapes.
NEW rate-limit-testing: no skill covers load/throttle testing; came up when validating the throttle config.
PRINCIPLE Prefer explicit over implicit config — surfaced in 3 unrelated tasks; put in rules/configuration.
```

## Guidance

- Proposals must cite evidence from the session — no speculative skills.
- Prefer sharpening an existing skill's `description` (the usual cause of under-triggering) over creating a near-duplicate.
- One review list per session; keep it short enough to action in one sitting.
