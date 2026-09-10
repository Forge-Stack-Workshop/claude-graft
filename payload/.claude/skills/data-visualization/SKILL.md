---
name: data-visualization
description: Chart type selection by data shape, visual encoding hierarchy, accessible color palettes (colorblind-safe, light/dark), axes/legends/annotations, dashboard composition (KPI tiles, sparklines, hierarchy), interactivity (tooltips, filters), library choice (Chart.js, D3, Recharts, matplotlib/Plotly), and common pitfalls.
origin: authored
---

# Data Visualization

Turn raw data into charts and dashboards that communicate one clear message, read
correctly by everyone, in any theme.

## Prerequisites (preflight)

Before using this skill, ensure you have the required packages installed.

**Python packages (matplotlib/plotly):**
```bash
# Check for matplotlib and plotly
python -c "import matplotlib" || echo "WARN: pip install matplotlib plotly"
```

**Or npm packages (Chart.js):**
```bash
# Check for chart.js
npm list chart.js || echo "WARN: npm install chart.js"
```

## When to Activate

- Choosing a chart type for a dataset or a report
- Building a dashboard with multiple metrics
- Picking or building a color palette for series/categories
- Reviewing a chart for misleading or cluttered design
- Choosing a charting library for a stack

## Step 1 — Match Chart Type to Data Shape

Ask "what question does this chart answer?" first. Chart type follows the answer,
not the other way round.

| Data shape | Question | Chart type |
| --- | --- | --- |
| Comparison (categories) | Which is bigger? | Bar chart (horizontal if labels are long) |
| Comparison (few items, over time) | How did each change? | Grouped/line small multiples |
| Trend (continuous, over time) | Is it going up or down? | Line chart, area chart |
| Distribution (single variable) | What's the spread/shape? | Histogram, box plot, violin plot |
| Distribution (two variables) | How do they correlate? | Scatter plot, heatmap |
| Relation (network/hierarchy) | How do parts connect? | Node-link graph, tree, sankey |
| Part-to-whole (few categories, one snapshot) | What share does each have? | Stacked bar, single donut (max 5-6 slices) |
| Part-to-whole (over time) | How do shares evolve? | Stacked area (100%) or small multiples |
| Geospatial | Where? | Choropleth, point map |

Default to bar/line for anything ambiguous — they are the most accurately read
forms and work at any screen size.

## Step 2 — Visual Encoding Hierarchy

Rank encodings by how accurately humans judge them (Cleveland & McGill). Prefer the
top of this list; fall back only when the data or layout forces it.

1. **Position** on a common scale (bar height, dot position on shared axis) — most accurate
2. **Length** (bar length from zero)
3. **Angle / slope**
4. **Area** (bubble size) — use for one extra dimension only, never as the primary encoding
5. **Color intensity / saturation** — good for a single ordered value (heatmaps)
6. **Color hue** — categorical only, never for ordered/quantitative data
7. **Volume / 3D** — avoid entirely (see Pitfalls)

Consequence: don't encode a quantitative value in hue when position or length is
available. Reserve color for identifying a series, not for reading its magnitude.

## Step 3 — Accessible Color Palettes

- **Categorical series**: use a colorblind-safe qualitative palette (e.g. Okabe-Ito,
  Color Brewer `Set2`/`Dark2`, Tol's "bright"). Cap at 6-8 distinct hues — beyond
  that, use small multiples or a "highlight one, gray the rest" pattern instead of
  adding more colors.
- **Sequential data** (single ordered value: revenue, density): one hue, increasing
  lightness/saturation (e.g. Viridis, Blues). Never rainbow — rainbow scales imply
  false discontinuities and fail for red-green colorblind readers.
- **Diverging data** (value around a meaningful midpoint: profit/loss, delta from
  target): two hues meeting at a neutral midpoint (e.g. RdBu, PRGn) — pick hues
  that stay distinguishable under deuteranopia/protanopia, never pure red/green.
- **Contrast**: every foreground color (data marks, text, gridlines) meets WCAG AA
  (4.5:1 for text, 3:1 for graphical objects) against its background.
- **Light/dark themes**: don't just invert lightness — re-check every color pair for
  contrast in both themes; desaturate slightly in dark mode to avoid vibration
  against a dark background; keep gridlines low-contrast in both (they support
  reading, they aren't data).
- **Never encode meaning in color alone**: pair color with a second channel (shape,
  pattern, direct label, or position) so colorblind readers and grayscale printouts
  still get the message.
- **Validate**: run the palette through a colorblind simulator (Coblis, or the
  `colorblind` library) before shipping; check contrast with a WCAG contrast checker.

## Step 4 — Axes, Legends, Annotations

- **Start bar-chart axes at zero.** Truncating a bar axis exaggerates differences —
  see Pitfalls. Line charts *may* start above zero to show trend detail, labeled clearly.
- **Label axes with units** (`Revenue (€k)`, not just `Revenue`). Avoid unlabeled
  dual axes — they invite spurious correlation reading; prefer two small multiples.
- **Legends**: place them where the eye naturally lands after reading the data (top
  or right), order entries to match the visual order of the data (top-to-bottom
  matches largest-to-smallest), and prefer direct labeling on the mark itself over a
  legend when there are ≤5 series.
- **Gridlines**: light, few, and only on the axis that needs precise reading —
  they're a ruler, not decoration.
- **Annotations**: call out the one or two points that matter (an outlier, a policy
  change, a target line) directly on the chart instead of forcing the reader to
  cross-reference a caption.
- **Title states the finding**, not the metric name: "Churn dropped 30% after Q3
  pricing change" beats "Monthly Churn Rate".

## Step 5 — Dashboard Composition

- **Hierarchy**: most important KPI top-left (reading order), supporting detail
  below/right, raw/exploratory tables last. One dashboard answers one class of
  question — split unrelated concerns into separate views instead of one crowded
  screen.
- **KPI tiles**: one number, one label, one trend indicator (arrow/sparkline/delta
  vs. previous period). Avoid decorative icons that don't carry information.
- **Sparklines**: use inside tiles/tables to show trend shape without a full axis —
  no ticks, no legend, just the line and maybe a highlighted last point.
- **Consistency**: same color = same series across every chart on the dashboard;
  same time range and granularity unless a chart is explicitly comparing periods.
- **Whitespace over borders**: separate sections with spacing, not boxes/dividers
  on every tile — reduces chartjunk (see Pitfalls).
- **Responsive**: define a mobile/narrow breakpoint that stacks tiles vertically and
  simplifies charts (fewer gridlines, larger touch targets) rather than shrinking
  everything proportionally.

## Step 6 — Interactivity

- **Tooltips**: show exact values on hover/tap for any chart with more than ~10 data
  points — precision the eye can't extract from the shape alone. Keep tooltip
  content short: label, value, unit; comparison to previous period if relevant.
- **Filters**: expose the 1-3 dimensions users actually slice by (date range,
  category, region) as visible controls, not hidden in a menu; reflect the active
  filter state in the chart title or a visible chip.
- **Zoom/brush**: for dense time series, allow brushing on an overview strip to zoom
  a detail chart, rather than one over-cluttered chart trying to do both.
- **Cross-filtering** across dashboard tiles (click a bar to filter the rest) is
  powerful but must be visibly discoverable (cursor affordance, "click to filter"
  hint) — silent interactivity gets missed.
- **Loading/empty states**: always design the empty-data and loading skeleton for
  every chart — a blank chart reads as broken.

## Step 7 — Library Choice

| Need | Library | Why |
| --- | --- | --- |
| Standard charts, fast setup, canvas perf at scale | Chart.js | Batteries-included, good defaults, easy tooltips/legends |
| React app, declarative composition with standard chart types | Recharts | SVG, React-idiomatic, easy theming via props |
| Custom/novel visualization, full control over encoding | D3.js | Low-level, steep learning curve, unmatched flexibility |
| Python data science / notebooks, static reports | matplotlib | Ubiquitous, precise control, publication-quality static output |
| Python, interactive/web-embeddable, exploratory analysis | Plotly | Interactivity out of the box, good 3D/geo support when truly needed |
| Very large datasets (100k+ points) | Canvas/WebGL-backed (Chart.js canvas mode, deck.gl, ECharts) | SVG DOM cost becomes the bottleneck past a few thousand marks |

Pick the library that matches the team's stack first (React → Recharts/Visx,
Python backend → matplotlib/Plotly) — a "better" library nobody on the team can
maintain is a net loss.

## Pitfalls (reject in review)

- **3D charts** (3D bars, 3D pie) — perspective distorts area/length judgment;
  always flatten to 2D.
- **Multiple pie/donut charts side by side** to compare categories — angle
  comparison across charts is one of the least accurate judgments; use a single
  bar chart instead.
- **Truncated/non-zero bar axes** — exaggerates differences and misleads; if the
  meaningful variation is small, say so in the annotation instead of stretching
  the axis.
- **Chartjunk** — 3D bevels, drop shadows, decorative background images, redundant
  gridlines/borders on every tile; every pixel should carry data or aid reading.
- **Rainbow/unordered hue for ordered data** — implies false categorical breaks in
  continuous data.
- **Excess color cardinality** — more than ~8 categorical colors on one chart;
  readers can't hold that many hue-to-label mappings; group the tail into "Other"
  or split into small multiples.
- **Dual axes without a strong justification and clear labeling** — invites
  spurious correlation between two unrelated scales.
- **Pie chart with >5-6 slices** — switch to a sorted bar chart; bars scale to any
  category count, pies don't.
- **Color as the only differentiator** — fails colorblind readers and grayscale
  print; always add a second channel (label, pattern, position).
- **Auto-scaled y-axis on a KPI trend tile** — a flat-looking trend can hide a real
  change if the axis silently rescales; fix the axis range when trend shape must
  be compared across time.

## Review Checklist

- [ ] Chart type matches the question (comparison/trend/distribution/relation/part)
- [ ] Encoding uses position/length before color/area for quantitative values
- [ ] Palette is colorblind-safe and validated (simulator or contrast checker)
- [ ] Palette works in both light and dark themes with WCAG AA contrast
- [ ] Bar axes start at zero; any exception is explicitly annotated
- [ ] No 3D, no multi-pie comparison, no dual axes without justification
- [ ] ≤8 categorical colors; overflow grouped into "Other" or split into small multiples
- [ ] Color is never the only channel carrying meaning
- [ ] Title states the finding, not just the metric name
- [ ] Tooltips present for charts with >~10 data points
- [ ] Dashboard has one clear hierarchy: KPI → supporting detail → raw data
- [ ] Empty and loading states designed for every chart
- [ ] Library choice matches team stack and data scale
