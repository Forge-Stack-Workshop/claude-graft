---
name: eval-skills
description: Evaluate the quality of a skill or a skill library against a rubric — trigger precision, scope, actionability, preflight coverage, and duplication. Use before shipping a skill, during a library audit, or to decide which of two overlapping skills to keep.
origin: authored
---

# Eval Skills

A growing skill library rots quietly: descriptions drift, two skills come to compete for the
same trigger, a required tool loses its preflight. This skill scores a skill (or a whole
library) so the weak ones are found and fixed, not just accumulated. The evaluator is not the
author — judge against the rubric, not intent.

## When to use

- Before shipping a new skill (self-review against the bar).
- Auditing a library (many skills, unclear which earn their place).
- Choosing between two overlapping skills.

## Rubric (score each 0–2; a skill should reach ≥ 8 / 12)

| Dimension | 0 | 1 | 2 |
| --------- | - | - | - |
| **Trigger precision** | Vague; won't reliably match | Matches but over/under-fires | Names concrete triggers + boundary |
| **Scope** | Two+ unrelated jobs | One job, some bleed | Exactly one job |
| **Actionability** | Restates known good practice | Mixed advice + procedure | Concrete steps/commands |
| **Preflight** | Needs a tool, no check | Mentions tool, weak check | Preflight + fallback, or no tool needed |
| **Concision** | Long, skimmed not read | Somewhat padded | Tight; readable in full |
| **Non-duplication** | Near-duplicate of another | Overlaps at edges | Distinct niche |

## Procedure

1. Read the SKILL.md in full (front-matter + body).
2. Score each rubric dimension with a one-line justification citing the text.
3. Total the score; flag any dimension at 0 as a blocker regardless of total.
4. **Verdict**: `SHIP` (≥ 8, no 0s) · `REVISE` (name the 1–2 fixes) · `MERGE/DROP` (duplicate).
5. For a library: rank skills by score; the bottom of the list is your fix/merge queue.

## What good looks like

- The `description` alone tells you when the skill fires and when it won't.
- The body is a procedure, not a lecture.
- A tool dependency always has a preflight and a fallback.
- No two skills in the library compete for the same trigger phrasing.

## Output format

```
skill: <name>   score: 9/12   verdict: REVISE
- trigger 2: names "flaky test", "quarantine"
- scope 2: single job
- actionability 1: step 3 is advice, make it a command
- preflight 2 / concision 1 / non-duplication 1 (overlaps `python-testing` at edges)
fix: sharpen step 3; add a boundary line vs python-testing.
```

## Pitfalls

- Scoring intent instead of the text on the page.
- Passing a skill with a 0 in preflight or trigger just because the total looks fine.
- Auditing content while ignoring duplication across the library.
