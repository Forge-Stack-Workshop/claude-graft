---
name: idea-validation
description: >-
  Validates a raw idea before any dev commitment — RICE scoring, effort/value
  matrix, constraint check, size estimate, and a GO/DEFER/REJECT verdict.
  TRIGGER when: user pitches a new feature, asks "should I build this?", or
  before creating any GitHub issue. DO NOT TRIGGER for bug fixes or chores
  (these skip validation and go straight to the backlog).
---

# Idea Validation

Validate a raw idea before committing engineering time. Output a GO / DEFER / REJECT verdict with full justification.

## When to Use

- User pitches a new feature idea
- User asks "is this worth building?"
- Before turning an idea into a tracked backlog item
- During backlog grooming when reprioritizing

## Do NOT Use For

- Bug fixes (always GO, skip to backlog)
- Chores (skip validation)
- Tasks already in the backlog (re-validate only if scope changed)

## Validation Protocol

### Step 1 — RICE Score

```
RICE = (Reach × Impact × Confidence%) / Effort
```

| Dimension | Scale |
|---|---|
| **Reach** | users/week affected: 1 (just me) → 10 (all users) |
| **Impact** | 0.25 (minimal) / 0.5 (low) / 1 (medium) / 2 (high) / 3 (massive) |
| **Confidence** | % certainty in estimates: 50% / 80% / 100% |
| **Effort** | person-weeks: 0.1 (2h) / 0.5 (1d) / 1 (1w) / 2 (2w) / 4 (1mo) |

Priority tier from RICE:
- P0: RICE ≥ 40
- P1: RICE 20-39
- P2: RICE 5-19
- P3: RICE < 5

### Step 2 — Effort/Value Matrix

Position on matrix using RICE dimensions:

```
         LOW EFFORT          HIGH EFFORT
HIGH  │  Quick Win ✅        Strategic 🎯
VALUE │  (do now)            (plan carefully)
──────┤──────────────────────────────────────
LOW   │  Fill-In 📋          Avoid ❌
VALUE │  (backlog)           (never build)
```

### Step 3 — Constraint Check

Before recommending GO, verify:

1. **Work-in-progress limit**: does adding this exceed the number of items you
   can actively work on? If so, ask the user to close an active item first.
2. **Shared dependency**: does this require a new export or change in a shared
   library/module? → add a sub-issue for it.
3. **Duplicate check**: search existing issues for similar title/scope
   - `gh issue list --search "<keywords>"`
4. **Design required?**: touches UI → flag, needs a design pass first
5. **Scope creep risk**: does it expand an existing feature? → flag clearly

### Step 4 — Size Estimate

```
S: ≤ 1h   — trivial change, 1 file
M: 1-4h   — feature slice, 2-5 files
L: 4-16h  — full feature, tests + docs
XL: >16h  — epic, requires decomposition into sub-issues
```

XL ideas must be decomposed before creating a single issue.

### Step 5 — Verdict

| Verdict | Condition |
|---|---|
| **GO** | P0-P1 RICE + Quick Win or Strategic quadrant + no blocker |
| **DEFER** | P2 RICE OR Fill-In quadrant OR WIP-limit blocked |
| **REJECT** | AVOID quadrant OR duplicate OR scope creep not justified |

## Output Format

```
## Idea Validation Report

**Idea**: <one-line summary>
**Repo**: <owner>/<repo>

### RICE Score
- Reach: X/10 — <justification>
- Impact: X.X — <justification>
- Confidence: X% — <justification>
- Effort: X person-weeks — <justification>
- **RICE: XX (PX)**

### Effort/Value Matrix
Position: **<Quick Win / Strategic / Fill-In / Avoid>**

### Constraint Check
- WIP limit: <OK / BLOCKED — N items active>
- Duplicate: <none found / similar: #N>
- Design needed: <yes / no>
- Scope creep risk: <none / <description>>

### Size Estimate: <S/M/L/XL>
<Brief justification>

---
## Verdict: GO / DEFER / REJECT

**Reason**: <1-2 sentences>
**Next step**: <create issue / defer to backlog / reject with note>
```
