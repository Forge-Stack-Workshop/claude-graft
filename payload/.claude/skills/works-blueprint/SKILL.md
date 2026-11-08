---
name: works-blueprint
description: >-
  Generate architect-grade plans and layout studies for real-world building /
  renovation ("travaux") projects — extensions, room reconfigurations, load
  path changes, wet rooms, openings — while explicitly reasoning about the
  physical constraints (structure, dimensions, utilities, code, envelope).
  Use when the user asks to design, lay out, or plan physical construction or
  renovation work, produce floor plans, or check feasibility of a works idea.
domain: specialty
version: 1.0.0
tags: [construction, renovation, architecture, floor-plan, travaux, structural, dtu, re2020]
triggers:
  keywords:
    primary: [travaux, renovation, extension, floor plan, plan architecte, works, remodel, layout]
    secondary: [load-bearing, mur porteur, opening, ouverture, wet room, ventilation, insulation, permit, permis]
  context_boost: [house, apartment, building, room, wall, foundation, roof]
  context_penalty: [software, code, api, database]
---

# Works Blueprint — Architect Plans for Physical Construction Projects

Produce clear, decision-ready architectural layout studies for renovation and
construction ("travaux") projects, and make every physical constraint explicit
before proposing a layout. This is a **design-assist and pre-study** tool, not a
substitute for a licensed architect or structural engineer.

## ⚠️ Safety & legal boundary (read first, state to user)

- **Structural changes are life-safety.** Any removal/piercing of a load-bearing
  wall, beam sizing, foundation, or roof-structure change **must** be validated
  and signed off by a qualified structural engineer (bureau d'études structure /
  BET) before execution. This skill produces hypotheses, not stamped calcs.
- **Permits.** In France, works over ~5–20 m² of new floor area, facade changes,
  or changes of use typically need a `déclaration préalable` or `permis de
  construire`; > 150 m² total requires an architect by law. State the likely
  regime; do not assert legal compliance.
- Always end deliverables with: *"To be verified on site and validated by a
  qualified professional before any work."*

## When to use

Trigger when the user wants to: lay out or redesign a space, evaluate whether a
works idea is feasible, open/move/remove a wall, add an extension or level,
convert a room (e.g. bedroom → bathroom), or produce a floor-plan sketch or a
works program. Do **not** use for software architecture (see
`architecture-patterns`).

## Workflow

### 1. Gather the givens (ask only what's missing)
Collect, then restate as an assumptions table:
- **Existing geometry**: overall dimensions, ceiling height, wall positions,
  openings, floor levels. Ask for a rough sketch, measurements, or existing plans.
- **Structure**: which walls are load-bearing vs partition, floor type (slab,
  joists, beam-and-block), material (stone, brick, breeze block, timber,
  concrete), age of building, visible cracks/settlement.
- **Utilities**: locations of water supply/waste stacks, electrical panel, gas,
  heating emitters, ventilation, existing drainage falls.
- **Envelope & site**: exterior walls, insulation state, orientation/sun, damp,
  access constraints, neighbours/party walls, plot limits.
- **Program**: what the user wants (rooms, uses, flow, budget band, must-keep).

If a critical given is unknown, list it as a **flagged assumption** and continue
— do not stall.

### 2. Reason about physical constraints explicitly
Before drawing anything, run the constraint checklist below and record each as
PASS / RISK / BLOCKER with a one-line reason. A BLOCKER means the layout idea
must change or requires professional study first.

### 3. Propose 1–3 layout options
For each option give: a described floor-plan (room-by-room with dimensions and
clear widths), the structural moves it requires, the utility reroutes, an
effort/risk rating, and the main trade-off. Recommend one and say why.

### 4. Produce the deliverable
Default output = a Markdown study (sections in Output Format). If the user wants
a drawn plan, generate scaled 2D SVG (see `references/svg-floorplan.md`) or ASCII
schematic; label dimensions, note the scale, mark load-bearing walls, doors
(swing), windows, and fixtures.

## Physical-constraint checklist

**Structure**
- Load path: does the change interrupt a wall/beam carrying floor or roof? If
  yes → beam + support needed; flag for BET structure.
- Span & deflection: new openings need a lintel/beam sized for span + load; note
  bearing length each side.
- Floor loads: wet rooms, heavy partitions, libraries → check floor capacity.
- Foundations: extensions/new walls need footings appropriate to soil.

**Dimensions & usability**
- Minimum clear circulation ~90 cm; doorways ≥ 80 cm (accessibility ≥ 90 cm).
- Ceiling height: habitable comfort ≥ 2.30–2.50 m; stairs need headroom ≥ 1.90 m.
- Stairs geometry (Blondel: 2R + G ≈ 60–64 cm); landing lengths.
- Fixture clearances (WC, shower, kitchen work triangle, appliance swings).

**Utilities & servicing**
- Drainage falls (~1–3 cm/m for waste); can the new WC/shower reach a stack?
- Water/electrical reroute feasibility; panel capacity; wet-room electrical zones.
- Heating emitter / duct relocation.

**Envelope, comfort, code (France context)**
- Ventilation: wet rooms need extract (VMC); avoid trapped moisture.
- Thermal / regulatory: renovation thermal rules, RE2020 for new build; thermal
  bridges at junctions.
- Damp/condensation, acoustic (party walls), fire (escape, protected stairs),
  natural light (habitable rooms need glazing ~1/6 floor area rule of thumb).
- Relevant French norms to name where applicable: **DTU** (e.g. DTU 20.1 masonry,
  DTU 60.11 plumbing sizing), **Eurocodes** for structure, **RE2020**, local PLU.

## Output format

```
# Works Study — <project>

## Assumptions & givens        (table; flag unknowns)
## Constraint analysis          (checklist → PASS / RISK / BLOCKER + reason)
## Option A / B / C             (plan description, structural moves, utilities,
                                 effort, risk, trade-off)
## Recommendation               (chosen option + why)
## Plan                         (SVG/ASCII, scaled, labelled)
## Next professional steps      (what needs BET / architect / permit)

> To be verified on site and validated by a qualified professional before any work.
```

## Anti-patterns
- Drawing a layout before checking the load path.
- Treating a wall as a partition without evidence — assume load-bearing until proven.
- Silently omitting utilities/drainage feasibility.
- Claiming code/permit compliance instead of flagging the likely regime.
