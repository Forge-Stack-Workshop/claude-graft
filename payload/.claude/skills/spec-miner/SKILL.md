---
name: spec-miner
description: Use when a codebase has no written spec and you need one — inheriting undocumented code, before a rewrite or migration, or when asked "what does this actually do?". Reads the code as the source of truth and reconstructs the specification it implements — the behaviours, rules and contracts — flagging where the code is ambiguous or self-contradictory, without changing the code.
---

# Recovering the spec from the code

When there is no spec, the code is the spec — including its bugs. This
reconstructs the specification the code actually implements, so the next change
is made against a stated contract instead of a guess. It reads; it does not fix.
Where behaviour looks wrong, that is a finding for the doc, not a change to make.

Adapted from Jeffallan/claude-skills `spec-miner` (MIT). Tool-scoped to reading:
Read, Grep, Glob, Bash for inspection only.

## 1. Find the seams

Start where behaviour enters and leaves: entry points (routes, CLI, handlers,
jobs), the data model, and the external calls. Map them before reading bodies —
the shape of the system is in its boundaries, not its helpers.

```
# entry points and contracts, by ecosystem
grep -rEn '@(app|router)\.(get|post|put|patch|delete)|def handle|class .*View' --include='*.py'
grep -rEn 'export (async )?function|router\.(get|post)' --include='*.ts'
```

## 2. Extract the behaviours

For each entry point, state as a spec line: **given** what input/state, **when**
this is called, **then** what it returns or changes, and **on what error** it
does what. Read the code, not the names — a function called `validate` that
silently returns on failure does not validate, and that gap is the spec.

Group into capabilities, not files. One capability may span several modules; one
module may hold several.

## 3. Recover the rules and invariants

The business rules are in the conditionals, the constraints, the guards. For
each: what it enforces, where (DB constraint, code check, or nowhere), and what
happens when violated. A rule enforced in one path and not another is a
contradiction — record both and mark it unresolved.

## 4. Write the spec, marked by confidence

Produce `docs/spec/` with, per capability: the behaviours (§2), the rules (§3),
the data touched, and the contracts (request/response/error shapes). Mark every
line:

- **stated** — the code is unambiguous about this.
- **inferred** — the behaviour is consistent but no comment or test confirms
  intent; it may be incidental.
- **contradictory** — two code paths disagree; needs a human decision.

The inferred and contradictory lines are the valuable ones: they are where the
next reader would otherwise guess.

## 5. Report the ambiguities, do not resolve them

End with the list of contradictions and silent behaviours (swallowed errors,
undocumented defaults, dead branches). Propose what each *could* mean; let the
owner decide which is the intended spec. **Never change the code to match a
guessed spec** — the code is the evidence; edit it only once the intent is
confirmed.
