---
description: Design-system rules. Use when building UI, defining tokens, or reviewing styles and human-facing formatting.
paths:
  - "**/*.{tsx,jsx,vue,svelte}"
  - "**/*.css"
  - "**/*.scss"
  - "**/tokens/**"
---

# Design system

Every human-facing surface is built from a shared design system — no ad-hoc
style values in components. Complements `accessibility.md` (dark mode + WCAG).

- **Design tokens are the single source of style** — colours, typography,
  spacing, radii, shadows, z-index live as tokens (JSON / CSS vars) consumed by
  code. No hardcoded style literals in components (mirrors *no hardcoded
  constants* in `code-quality.md`).
- **Versioned brand kit** — primary/secondary/semantic palette, ≤ 2 type
  families, logo variants with clear space, one icon set. Defined and versioned,
  not reinvented per repo.
- **Living component library** — reusable components with documented states and
  variants (Storybook or equivalent); one canonical implementation per
  component.
- **Systematic spacing scale & grid** — spacing on a fixed scale (4/8 px base),
  shared grid and breakpoints; no arbitrary margins.
- **Defined type hierarchy** — an explicit type scale with named roles
  (`display/title/body/caption`), never ad-hoc sizes.
- **Systematic interaction states & feedback** — every interactive element
  exposes hover/focus/active/disabled; every action gives visible feedback
  (< 100 ms); visible keyboard focus is mandatory.
- **Consistent UX writing** — a voice-and-tone guide; error messages say what to
  do (no raw codes); action-oriented labels aligned to the domain glossary.
- **Numbers are displayed with a space thousands separator.** Every human-facing
  number (`1 234 567`, `12 500 €`) groups thousands with a space, on every
  surface — frontend, backoffice, generated documents, reports, CLI output. The
  separator is a **non-breaking space** (`U+202F` narrow, or `U+00A0`) so the
  number never wraps mid-value; the decimal mark stays the locale's own. This is
  a **display** rule only: stored, serialised, logged, and API-transported
  numbers stay raw, and formatting happens at the view boundary through a shared
  formatter, never by hand per component. Identifiers, years, ports, and version
  numbers are not quantities and are never separated.
- **Standardised motion** — tokenised durations and easing; animation is
  functional, never gratuitous; honours `prefers-reduced-motion`.
- **Mobile-first responsive** — breakpoints from tokens, touch targets ≥ 44 px,
  no fixed widths.
- **Design ↔ dev handoff contract** — design ships exported tokens and component
  specs; dev consumes the tokens, never redefines the values.
