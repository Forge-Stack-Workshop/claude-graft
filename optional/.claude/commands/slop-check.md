---
description: Detect generic "AI-slop" design tics on a frontend, then optionally fix the non-cosmetic ones
---

Run an external, deterministic design-slop detector on the requested frontend(s)
and report only real, actionable tics. No API key, no LLM — offline-friendly.

Config: `.claude/workflow-commands.config.json` → `slop_check.detector_command`
(default `impeccable`). **If that binary is not on PATH, this command is a no-op:
say so plainly and stop — do not fabricate findings.**

## Target

`$ARGUMENTS` = path(s) to a frontend `src` folder. If empty, auto-detect `.../src`
folders containing `.tsx` in the current repo.

## Procedure

1. Run the configured detector on the target(s).
2. Interpret the output for the user:
   - **overused-font** (Inter/Roboto/Space Grotesk…): cosmetic — flag, do not fix without consent.
   - **grid-background**: real generic tic — fix.
   - **bounce-easing**: dated easing → replace with ease-out-quart/expo.
   - **layout-transition**: animates width/height/margin → switch to transform/opacity (perf).
   - Known semantic false-positives (e.g. `border-left` side-tabs): do not surface unless the user asks for raw detail.
3. Do NOT propose CI integration or a new skill — this is a deliberate manual,
   occasional pass. If there is no real tic, say so plainly.

## Fix (optional)

If the user agrees, fix only the non-cosmetic items (grid-background, bounce,
layout-transition) via Edit, one file at a time, without touching intentional style.
