---
description: Accessibility and dark-mode rules. Use when building or reviewing any human-facing surface.
paths:
  - "**/*.{tsx,jsx,vue,svelte}"
  - "**/*.css"
  - "**/*.scss"
  - "**/*.html"
---

# Accessibility

The component-level basics (semantic HTML, keyboard reach, labels, contrast,
announced errors) live in `frontend.md`. This file states the product-level bar.

- **Dark mode is mandatory from V1**, not a later theme. Colour is a token (see
  `design.md`), so both modes come from one source and neither drifts.
- **WCAG 2.1 AA is the floor**, on every surface — including a public
  micro-site, an admin backoffice, or an auto-generated page. Accessibility is
  not waived because a surface is small or "just a showcase". Lighthouse
  accessibility ≥ 90, plus manual screen-reader and keyboard-only passes on the
  core flows (sign-up, sign-in, checkout / primary task).

## The obligation is a real person can complete the task

WCAG is the mechanism; the goal is that someone from each major disability
category can actually finish the product's core tasks.

1. **Visual** (blind, low-vision, colour-blind) — screen-reader operable end to
   end (semantic markup, labels, live regions), reflows to 400% zoom and 320 px
   with no loss of content or function, honours `prefers-contrast`, and never
   encodes meaning by colour alone (icon, text, or pattern too).
2. **Motor** (limited dexterity, no pointer, switch/voice) — fully
   keyboard-operable with a visible focus order and no keyboard trap, touch
   targets ≥ 44 px, no action requiring a drag, a precise gesture, or a
   hover-only reveal, and no timeout the user cannot extend.
3. **Auditory** (deaf, hard-of-hearing) — captions on every video, a transcript
   for audio, and a visual equivalent for every audio cue.
4. **Cognitive** (attention, memory, literacy, dyslexia) — plain language,
   consistent and predictable navigation, errors that say what to fix, no
   unavoidable time pressure, and progress that survives reload.
5. **Vestibular / photosensitivity** — honours `prefers-reduced-motion`, no
   auto-playing or looping motion the user cannot stop, nothing that flashes more
   than three times a second.

The Definition of Done for any human-facing surface includes exercising these
five paths.
