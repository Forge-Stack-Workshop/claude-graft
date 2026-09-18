---
name: <level-name>
description: <One sentence that says WHEN to use this skill — the triggers — so the agent auto-selects it. Mention the level and the concrete situations/phrasings that should activate it. No project or vendor names — keep it generic and configurable.>
---

# <level-name>

> Part of the standards-governance skill set. Inherits `governance-core`.
> Consumes the canon by reference
> (`../../shared/references/consuming-the-canon.md`); never copies rule text.
> All specifics come from `config.yaml` and the canon.

## Role
<What this skill is responsible for, in one short paragraph.>

## Triggers
<Concrete situations, phrasings, file patterns, or task types that activate it.>

## Rules it applies (resolve from the canon by ID)
<Which standard domains are in scope. Reference IDs, not prose. Point to the
shared references for hierarchy, risk, profiles, gates.>

## Inputs it must gather before acting
<Project declaration, profile, resolved standards, existing state, etc.>

## Execution steps
1. <Ordered, concrete steps.>

## Validation criteria (exit criteria)
<How it verifies its own work conforms. Cite `conformity-and-gates.md`.
Nothing is "done" until verified.>

## Interactions with other skills
<Which skills it calls, defers to, or hands off to. Always: inherits
governance-core; routes R≥3 effects through external-actions.>

## Limits
<What this skill explicitly does NOT do.>

## Actions requiring human validation
<The R≥3 / manual-required actions in this skill's domain, per
`risk-and-human-gates.md`.>
