---
name: market-research
description: >-
  Structured market study for a project — a game concept or a dev-tool —
  covering comparables/competitors, target segments, differentiation,
  monetization landscape, market size and timing, and go/pivot risks. Pulls
  real evidence via web search/fetch and checks for overlap with your own
  existing projects. TRIGGER whenever the user asks for a market study, market
  analysis, competitive landscape, "who else does this", TAM/positioning, "is
  there an audience for X", or wants to validate demand before committing to a
  concept — even if phrased casually like "does this already exist?" or "is
  there a market for this?".
---

# Market Research

Produce a decision-grade market study for a project **before** heavy investment.
The goal is not a glossy report — it is a verdict a go/no-go decision can consume:
is there a real, reachable audience, and can this concept win?

Two project natures, one method:
- **Game** — audience, comparable titles, genre saturation, platform fit,
  monetization norms of the niche.
- **Dev-tool** — users, existing OSS/SaaS alternatives, integration friction,
  and the independence angle (self-hostable beats lock-in).

## When to Use

- "Do a market study for <concept>"
- "Does this already exist? / who does this? / is there a market?"
- Before a go/no-go decision, to feed it with external evidence
- Positioning a new game in a crowded genre, or a tool vs OSS incumbents

## Do NOT Use For

- Internal prioritization of an already-validated idea → `idea-validation`
- Pure financial budgeting → a budget/estimation workflow
- Feature-level UX decisions

## Research Protocol

### Step 1 — Frame the question

Pin down, in one line each: the concept, the assumed audience, and the **deadly
hypothesis** (what would make this market not exist). The study exists to test
that hypothesis, not to cheerlead the concept.

### Step 2 — Gather evidence (cite everything)

Use `WebSearch` / `WebFetch` for real, current data — do not answer from memory
for market facts. For each claim, keep the source. Cover:

1. **Comparables / competitors** — 3-8 closest existing products. For games:
   titles, genre, rough reception/scale. For tools: OSS + SaaS incumbents.
2. **Segments** — who actually buys/plays this, and how reachable they are
   (be realistic about your distribution reach and marketing budget).
3. **Monetization landscape** — how the niche makes money and at what price
   points; what players/users expect to pay.
4. **Timing / saturation** — is the genre/category rising, saturated, or dead?

### Step 3 — Check for internal overlap

Before positioning externally, check internally: does this overlap an existing
project of yours, or duplicate a shared library or tool you already maintain?
Cannibalizing your own work is a real risk. Flag it.

### Step 4 — Differentiate

Prove the wedge:
- **Identity** — what makes it unmistakably itself vs the comparables?
- **Innovation** — the one thing no comparable does. If you can't name it, that
  is the finding.
- **Retention** — is there a durable reason players/users stay?

### Step 5 — Verdict

Translate evidence into a Go / Pivot / Drop leaning with confidence, so it drops
straight into the go/no-go decision.

## Output Format

ALWAYS use this template:

```
## Market Study — <concept>

**Nature**: Game | Dev-tool
**Deadly hypothesis tested**: <one line>

### Comparables
| Product | What it is | Scale/reception | Gap it leaves |
|---------|-----------|-----------------|---------------|
| ...     | ...       | ...             | ...           | [source]

### Segments & reachability
- <segment> — size signal, how you reach them

### Monetization landscape
- Norms, price points, expectations [sources]

### Timing
- Rising / saturated / declining — evidence [sources]

### Internal overlap
- <none / overlaps <project>>

### Differentiation
- Identity: <wedge>
- Innovation: <the one thing>
- Retention: <retention driver>

### Risks
- <deadly-hypothesis verdict + top 2 risks>

---
## Verdict: GO / PIVOT / DROP  (confidence: low/med/high)
**Reason**: <2-3 sentences grounded in the evidence above>
```

## Notes

- Evidence or it did not happen: unsourced market claims are the main failure
  mode of this skill. If a fact can't be sourced, label it an assumption.
- Be honest about your distribution limits — a great concept in an
  unreachable market is still a Drop/Pivot.
- Related: `idea-validation` (internal scoring).
