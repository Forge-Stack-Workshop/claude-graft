---
name: ux-flows
description: >-
  Design and audit user journeys / parcours BEFORE visual and code — surface-
  agnostic (web, mobile, desktop, 2D/3D game). Maps the flow (entry → states →
  transitions → exit), builds the information architecture, spots friction and
  dead-ends, and pressure-tests against Nielsen heuristics + the right per-surface
  conventions. TRIGGER whenever the user works on a user journey, parcours,
  onboarding, navigation/IA, screen flow, funnel, "the UX of X", first-run
  experience, or asks why a flow feels confusing / where users drop off — for a
  website, a mobile/desktop app, or a game. Use even when phrased as "revois le
  parcours", "comment on enchaîne les écrans", or "l'onboarding est confus".
---

# UX Flows — parcours & architecture

Design the *shape* of an experience before anyone picks colours or writes a
component. This is the layer above visual design: what steps the user takes, in
what order, through what states, and where they stumble. It is **surface-
agnostic** — the same flow discipline applies to a web funnel, a mobile
onboarding, a desktop cockpit, or a game's first session.

This skill stops at the flow/IA/heuristic layer. Hand off downstream:
- **Visual & component build (web)** → visual/UI design and frontend work.
- **2D game spatial flow** → level design (this skill handles the
  *menu/meta/onboarding* flow; level design handles *in-world* spatial pacing).

## When to Use

- Designing or reviewing a user journey / parcours / onboarding / funnel
- Navigation & information architecture (what lives where, how you move between)
- "Where do users drop off / why is this confusing?"
- First-run / empty-state / error-recovery experience

## Do NOT Use For

- Pure visual polish, tokens, component code → visual/UI design work
- In-world level layout of a 2D game → level design
- Copywriting / marketing funnels for acquisition → that's growth, not UX

## Method

### Step 1 — Frame the journey

State the **actor**, their **goal**, and the **trigger** that starts the flow, in
one line each. A flow without a named goal can't be evaluated — you'd be decorating
steps no one needs.

### Step 2 — Map the flow

Lay out the path as **states and transitions**, not just screens:

- **Entry points** (how they arrive — cold, deep-link, returning)
- **Happy path** — the minimal steps to the goal
- **Branches** — decisions, optional paths
- **States per step** — loading, empty, error, success, permission-denied,
  offline. Missing states are the #1 source of "it feels broken."
- **Exits** — completion, abandon, and *where abandon leaves them*.

Represent it as a compact step list or a Mermaid `flowchart` when a diagram reads
clearer than prose.

### Step 3 — Information architecture

What content/actions exist, grouped and prioritised. One primary action per
screen; everything else subordinate. If a step carries two co-equal primary
actions, that's a fork to split or a decision to surface.

### Step 4 — Heuristic pressure-test (Nielsen + friction)

Walk every step against:
1. **Visibility of system status** — does the user always know what's happening?
2. **Match to the real world** — language/flow mirrors the user's mental model
3. **User control & freedom** — undo, back, escape hatches at every step
4. **Consistency & standards** — within the app AND with platform convention
5. **Error prevention** — kill the error before it happens
6. **Recognition over recall** — don't make them remember across steps
7. **Flexibility** — novice path + expert shortcut
8. **Minimalist** — every element earns its place; count the taps/clicks to goal
9. **Error recovery** — plain-language, actionable, non-dead-end
10. **Help** — contextual, just-in-time, not a manual

Flag each friction point with **severity** (blocker / major / minor) and the step
it lives on.

### Step 5 — Per-surface conventions

The flow is agnostic; the *conventions* are not. Apply the right ones:

| Surface | Watch for |
|---|---|
| **Web** | responsive breakpoints, back-button/URL state, tab/focus order, load perf as UX (LCP) |
| **Mobile** | touch targets ≥44px, thumb reach, native nav (tab bar/back), safe areas, offline/interrupt, permission priming |
| **Desktop** | keyboard-first, window/multi-pane state, menus & shortcuts, resize, tray/background (Tauri context) |
| **Game (2D/3D)** | first-session teaching by doing, feedback juice, no dead time, readable state, controller/input mapping; 3D adds camera & spatial legibility |

### Step 6 — Verdict & next step

Rank fixes by severity, name the single highest-impact change, and hand off to
visual/UI design or frontend work for the build.

## Output Format

ALWAYS use this template:

```
## UX Flow — <journey name>
**Actor / Goal / Trigger** : <one line each>
**Surface** : web | mobile | desktop | game(2D/3D)

### Flow
<step list or Mermaid — with states per step: loading/empty/error/success>

### Information architecture
- <grouping, primary action per step>

### Friction (heuristic pressure-test)
| Sev | Step | Heuristic | Issue | Fix |
|-----|------|-----------|-------|-----|
| blocker | ... | #9 recovery | ... | ... |

### Per-surface conventions checked
- <the ones relevant to this surface, pass/flag>

### Verdict
- Highest-impact change: <one thing>
- Hand off to: <visual/UI design | frontend | level design>
```

## Notes

- Flow before pixels: fixing a parcours after the UI is built is 10× the work.
- Name the states. "It feels broken" is almost always a missing empty/error state.
- Count the steps to goal — the cheapest UX win is usually deletion.
- Related work: visual/UI design and frontend (build), web UI review,
  level design (2D in-world), and idea validation (is the flow even worth
  building).
