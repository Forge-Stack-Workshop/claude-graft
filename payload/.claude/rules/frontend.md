---
description: Component, state and accessibility rules. Use when writing or reviewing UI components, styles, or frontend state.
paths:
  - "**/*.{tsx,jsx,vue,svelte}"
  - "**/*.css"
  - "**/*.scss"
---

# Frontend

## Components

- A component renders. Fetching, transforming, and business decisions live
  outside it — the same boundary discipline as `architecture.md`, applied to
  the UI.
- Props describe the data, never the styling. A `variant` is a name, not a
  colour: `variant="danger"`, never `color="red"`.
- Composition over configuration. A component with eight booleans is several
  components that have not been separated yet.
- Presentational and connected components are distinct files. The first is
  testable without a provider, and that is the point.

## State

- The narrowest scope that works: local, then lifted, then shared. A global
  store is a decision, not a starting point.
- **Server state is not client state.** Data owned by the backend is cached,
  invalidated, and refetched by a query layer — never copied into a store where
  it silently goes stale.
- Derive rather than duplicate. Two pieces of state that must agree will
  eventually disagree.
- Every asynchronous view handles four states: loading, empty, error, loaded.
  A missing empty state is a bug reported as "the page is blank".

## Accessibility

- Semantic HTML first. A `<div onClick>` is a button that keyboards cannot
  reach and screen readers cannot name.
- Every interactive element is reachable by keyboard, in a sensible order, with
  a visible focus style. Never remove the focus ring without replacing it.
- Every input has a label; every image has `alt` (empty when decorative); every
  icon-only control has an accessible name.
- Colour is never the only carrier of meaning, and text meets contrast — 4.5:1
  for body, 3:1 for large.
- Errors are announced, not only coloured, and focus moves to the problem.

## Rendering

- Keys are stable identity, never the array index.
- Measure before optimizing: memoization added on a guess costs more than it
  saves. Fix the render cause, not its symptom.
- Images have explicit dimensions, and the layout does not shift as things
  load.
- No user-facing string is hardcoded — see `i18n.md`.
