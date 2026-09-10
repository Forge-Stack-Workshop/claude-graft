---
name: game-design-doc
description: Structuring game concept documents — core gameplay pillars, mechanic loops, scope estimation, market positioning, and team alignment for early-stage game projects.
origin: "Game Concept Guide — Professional video game production frameworks"
---

# Game Design Document — Concept Phase

Crystallize a game's core vision before production: idea capture, pitch, gameplay
loop, pillars, scope, market fit, and prototype path. This is a concept document,
not a full design bible — hours to days of work, not weeks.

## When to Activate

- **At project inception** — an idea exists but direction, scope, or feasibility is unclear.
- **Before seeking funding/publishers** — investors and studios expect a documented
  concept, not a full bible.
- **To align a team** — programmers, artists, writers, and sound designers each read
  the same idea differently; the document is the single source of truth.
- **To validate market fit** — check audience demand and competitive landscape before
  committing resources.
- **When scope creep threatens** — use the concept as an anchor against uncontrolled
  feature growth.
- **Before prototyping** — a written concept turns a vague itch into a testable plan.

## Audiences (write for the reader)

| Reader | What to emphasize |
| --- | --- |
| Internal dev team | Full gameplay + technical feasibility detail |
| Publisher / investor | Market fit, revenue model, timeline, competitive edge; light on technical minutiae |
| Casual pitch / elevator | 1–2 pages: core idea, core loop, pillars, one visual |
| Yourself | Fixes ideas on paper before memory drifts; the cheapest, most-skipped step |

Tailor the same source content per audience rather than writing from scratch each time.

## Idea Capture (before writing the doc)

- Capture ideas the moment they occur — notebook, phone note, voice memo, sketch.
  A few words or a rough sketch is enough; polish comes later.
- Keep a running backlog of concepts; most will be shelved, some abandoned outright.
  That is normal and healthy — it is cheaper to kill an idea on paper than after months
  of production.
- Periodically triage the backlog: compare ideas, keep the strongest, park the rest.
  Concentrate effort on the concept most likely to succeed, not the newest one.

## Core Techniques

### 1. The Elevator Pitch

Before the full document, force the idea into one paragraph, as if explaining it to
someone in an elevator. If it takes longer than 30 seconds to say aloud, it is not
distilled enough. This becomes the opening line of the concept document.

### 2. Define the Core Gameplay Loop

Summarize what the player actually does, in 3–5 sentences. Answer:
- **Who** — the player character / avatar.
- **What** — primary objective and player actions (jump, shoot, solve, build…).
- **Constraints** — obstacles, enemies, rules, environmental hazards.
- **Reward** — what winning/progressing feels like.

Example: *"Player pilots a small spacecraft defending territory. Each wave spawns
harder enemies. Use limited energy to dodge, shield, or attack. Surviving 10 waves
unlocks the next level."*

Do not describe story or lore here — gameplay loop and narrative are separate sections.

### 3. Establish Unbreakable Pillars

Identify 3–4 core design pillars that define the game and must never change once
agreed by the team:
- Gameplay style (e.g., "tight platforming physics").
- Emotional intent (e.g., "meditative exploration, not combat").
- Art/audio aesthetic (e.g., "retro 16-bit pixel art with live orchestral score").
- Target audience (e.g., "casual players on mobile, under 30 minutes per session").

Pillars are the north star: every design decision either strengthens or violates them.
A feature that contradicts a pillar is rejected, no matter how appealing.

Reference examples: *The Last of Us* — crafting, story, AI partners, stealth.
*Fortnite* — construction, survival, gunfight, loot.

### 4. Define Unique Selling Points (USPs)

List 2–3 concrete reasons a player would choose this game over alternatives. Not
necessarily core mechanics — can be a visual style, a setting, a content volume, or a
single standout system. Examples: bullet-time (Max Payne), dismemberment (Dead Space),
open-world frontier setting (Red Dead Redemption). Vague claims don't count as USPs.

### 5. Scope Reality-Check

List core features (must-have) vs. nice-to-have (can cut). Estimate:
- **Development time** — gather a low/high estimate honestly, **then multiply the high
  end by 2** (unknown unknowns — health, team changes, unforeseen technical debt —
  always exceed optimism).
- **Team size & cost** — how many people, for how long, at what rate; time is not free,
  even on a solo project.
- **Milestone roadmap** — prototype → vertical slice → alpha → beta → gold master →
  release.
- **Technology/engine choice** — pick the engine fit for the target platform, team
  skills, and budget, not "the best" engine in the abstract. Building a custom engine
  multiplies total dev time roughly ×10 — budget accordingly.

A scope that looks "totally unrealizable" signals a concept too ambitious; cut ruthlessly.

### 6. Market & Competitive Analysis

- **Existing games** — play and analyze 3–5 titles in the same genre or theme, whether
  well executed or poorly exploited; each is a source of inspiration or a cautionary tale.
  Note strengths/weaknesses in gameplay, controls, feel, sound, monetization, story.
- **Announced competitors** — anticipate the market, not just the past; check what's
  coming that could crowd the same niche at the same time.
- **Available market** — find the underserved audience/platform/age bracket combination;
  search player communities and forums for real signal, not assumption.
- **Differentiation** — never pitch as "Game X but better." Name the one specific
  innovation (mechanic, visual approach, narrative angle) instead.

### 7. Business Model & Revenue Estimate

Choose the monetization model early: premium, free-to-play, subscription, DLC/season
pass, ads, sponsorship. Match it to platform and audience. Estimate revenue from market
data (platform player counts × realistic conversion rate) — stay credible, don't inflate
numbers; revenue should exceed budget on paper or the pitch collapses immediately.

### 8. Visual & Audio Reference

Attach mood images and audio samples (or describe them precisely):
- **Art style** — screenshots, paintings, or concept art exemplifying the aesthetic.
- **UI/HUD mockup** — annotated screenshot or sketch of menus and world view.
- **Audio direction** — reference tracks for tone (synth-pop, orchestral, ambient…).

A reference image saves a hundred words of explanation — the brain anchors ideas to
images faster than to prose.

## Document Discipline

Keep it concise: 10–20 pages, a few hours to a few days of writing. Suggested sections:

1. Game title & elevator pitch (1 paragraph)
2. Core gameplay loop
3. Player objectives (short + medium term)
4. Pillars
5. Unique selling points
6. Setting/story (if relevant)
7. Art/audio direction (with references)
8. Scope & platform & technology choice
9. Team & timeline estimate (with 2x buffer)
10. Budget & monetization model
11. Competitive analysis & differentiation
12. Revenue estimate

### Format checklist

- One title page: author, email, date, version.
- Page numbers, black text on white/light background, readable body font (max 2 typefaces).
- Short paragraphs, lists/tables over dense prose, bold for key terms.
- Export as a single PDF; explicit filename, e.g. `Studio_GameTitle_GameConcept_v1.pdf`.
- Never split into multiple files; never ship an oversized export.

### Writing tone checklist

- Present tense, active voice, third person (avoid "I will..." or "you will...").
- No hedging/conditional phrasing ("could", "might") in the pitch sections.
- Proofread — or have someone else proofread — before sharing.
- Say only what's essential; cut anything not load-bearing for the pitch.

## Common Pitfalls

- **Over-engineering** — treating the concept as a full design bible. Omit feature
  trees, UI flow diagrams, and balance sheets; save that detail for later phases.
- **Vague uniqueness claims** — "It's like Game X but better" kills credibility.
  Name the specific innovation instead.
- **Underestimating dev time** — first-time developers routinely miss 30–50% of
  effort. Always apply the 2x buffer on the high estimate.
- **Ignoring market saturation** — launching yet another crowded-genre entry needs
  exceptional differentiation; plan for it explicitly.
- **No visual reference** — words fail where a single screenshot or art sample
  conveys mood instantly.
- **Scope creep inside the document itself** — a 1-page core loop ballooning into
  15 features mid-write. Prune ruthlessly; let pillars keep it honest.
- **Treating it as a solo exercise** — share early with trusted peers; fresh eyes
  catch contradictions and unfeasible assumptions before production starts.
- **One-size-fits-all document** — sending the internal full-detail version to a
  publisher (or vice versa) misses what that reader actually needs.
- **No update discipline** — writing it once and never revisiting it as the project
  evolves defeats its purpose as a living reference.

## Validation Checklist

- [ ] Elevator pitch fits in 30 seconds?
- [ ] Core gameplay loop clear and answers who/what/constraints/reward?
- [ ] Pillars identified (3–4) and agreed by the lead team?
- [ ] Unique selling points named (2–3), specific, not generic?
- [ ] Scope map separates must-have from nice-to-have?
- [ ] Dev time estimate includes the 2x buffer for unknowns?
- [ ] Engine/technology choice justified against platform, skills, budget?
- [ ] Budget reflects team size, duration, and tool/license costs?
- [ ] Monetization model fits the target platform and genre?
- [ ] Competitive analysis shows real differentiation, not just hype?
- [ ] Visual/audio references attached or described in detail?
- [ ] Document tailored to its intended reader (team / publisher / pitch)?
- [ ] Document length ≤ 20 pages, single PDF, explicit filename?
- [ ] Signed off by lead stakeholders (designer, producer, art lead)?
- [ ] Next step defined — prototype scope and target milestone?
