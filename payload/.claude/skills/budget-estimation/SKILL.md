---
name: budget-estimation
description: >-
  Budget & effort estimate for a solo-dev project — solo-dev reality, long
  cycles. Breaks a concept into effort (person-weeks on an S/M/L/XL + RICE
  scale), recurring vs one-off costs (tools, assets, infra — minimized by
  preferring self-host/OSS), time-to-market, and a scope-vs-solo capacity
  check, then outputs a ranged budget with explicit assumptions.
  TRIGGER whenever the user asks to "estimer le budget", "combien ça coûte /
  prend de temps", scope a project, size an effort, plan a runway, or decide if a
  concept fits solo capacity — including casual forms like "j'en ai pour
  combien ?" or "c'est jouable en 6 mois ?".
---

# Budget Estimation

Estimate what a project will actually cost — in **time** and in **money** — for
a solo developer running long cycles. Output ranges with stated assumptions, not
false-precision single numbers, so the estimate survives contact with reality
and feeds the kill-test and roadmap.

Two cost axes, always both:
- **Effort** (the dominant cost for a solo-dev): person-weeks of your own time.
- **Cash**: one-off + recurring spend. Provider independence is a budgeting
  lever here — self-hostable/OSS choices trade cash for effort and kill
  recurring SaaS bleed.

## When to Use

- "Estime le budget / le coût / le temps de <projet>"
- "J'en ai pour combien ?" / "c'est faisable en X mois ?"
- Scoping a game or tool before committing a cycle
- Runway planning, or comparing the cost of two approaches

## Do NOT Use For

- Whether the idea is worth building at all → idea validation
- Whether a market exists → market research
- Fine-grained sprint task breakdown of an already-scoped project

## Estimation Protocol

### Step 1 — Decompose scope

Break the project into deliverable chunks (systems, content, tooling, polish,
release). An estimate on the whole blob is always wrong; an estimate on 5-10
chunks is defensible. For games, separate **systemic** work (mechanics, economy,
the Python sim/balance loop) from **content** work (levels, art, narrative) —
content scales differently and is where solo scope explodes.

### Step 2 — Effort per chunk (sizing scale)

Size each chunk on a shared S/M/L/XL scale so it lines up with idea validation:

| Size | Effort | Meaning |
|------|--------|---------|
| S  | ≤ 1h        | trivial, 1 file |
| M  | 1-4h        | feature slice |
| L  | 4-16h       | full feature, tests + docs |
| XL | > 16h       | epic — decompose before estimating |

Convert to **person-weeks** for the total (1 pw ≈ 30-35 focused solo hours — be
honest about real focus time, not calendar hours). Give a **range** per chunk
(optimistic → likely → pessimistic) and carry the range through; do not collapse
to one number early.

### Step 3 — Apply solo-dev multipliers

Raw estimates lie. Adjust for the things that always bite:

- **Unknowns/R&D** (new engine feature, unproven mechanic): ×1.5–2 on that chunk.
- **Content volume**: multiply by the real asset count, not one exemplar.
- **Integration & polish**: add 20-40% — the last 10% of "done" is expensive.
- **Context-switching tax**: long cycles + multiple parallel projects → re-ramp cost.

### Step 4 — Cash costs

List one-off vs recurring, and apply the independence lever:

- **One-off**: assets/licenses, store fees, hardware.
- **Recurring**: hosting, SaaS, domains — flag each as "self-hostable?" and
  prefer the OSS path unless the effort cost outweighs the bill. Recurring cost
  is the silent runway killer for a solo-dev.

### Step 5 — Time-to-market & capacity check

Turn person-weeks into a calendar estimate at a realistic weekly capacity, then
sanity-check against solo capacity and the concept's own scope claim ("indé 6
mois"). If the math busts the target, say so and name what to cut.

## Output Format

ALWAYS use this template:

```
## Budget Estimate — <project>

**Assumptions**: <weekly capacity, hourly focus, scope frozen at …>

### Effort by chunk (person-weeks)
| Chunk | Size | Optimistic | Likely | Pessimistic | Notes / multipliers |
|-------|------|-----------|--------|-------------|---------------------|
| ...   | L    | 0.4       | 0.6    | 1.0         | ×1.5 R&D on X       |

**Total effort**: <opt> – <likely> – <pess> person-weeks

### Cash
| Item | Type | Cost | Self-hostable? |
|------|------|------|----------------|
| ...  | recurring | €X/mo | yes → OSS alt |

**One-off**: €X  ·  **Recurring**: €X/mo

### Time-to-market
- At <N h/week>: ~<months> (range). Target was <X> → <fits / busts by Y>

### Verdict
- Fits solo capacity: <yes / no — cut A, B to fit>
- Biggest cost driver: <chunk/item>
- Biggest uncertainty: <what would move the estimate most>
```

## Notes

- Ranges over points. A single number invites false confidence and will be wrong.
- The honest failure mode is under-counting content and polish — weight them.
- Prefer self-host/OSS to kill recurring bleed, but price the effort trade-off.
- Related work: idea validation (same S/M/L/XL scale + RICE effort),
  market research (demand side of the same decision).
