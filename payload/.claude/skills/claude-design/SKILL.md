---
name: claude-design
description: UI and visual-identity design direction. Use when creating or refactoring UI, defining visual identity, building landing pages, creating design tokens, or improving usability and conversion.
---

# Skill: Claude Design

## When to invoke
Auto-invoke when: creating or refactoring UI, defining visual identity, building landing pages, creating design tokens, or improving usability and conversion.

## Core rules

### Design direction first
- Define the intent before implementation: target user, primary action, and visual tone.
- Keep one clear visual hierarchy per screen.
- Avoid generic layouts when a stronger composition improves clarity.

### Design tokens (mandatory)
Create and reuse tokens for:
- color palette (brand, surface, text, state)
- spacing scale
- typography scale
- radius, shadows, motion durations

Use variables (CSS variables or theme object) instead of hardcoded values.

### Accessibility baseline (WCAG 2.1 AA)
- Ensure readable contrast in all themes.
- Full keyboard navigation for interactive components.
- Correct labels, ARIA usage, and visible focus states.
- Target touch size: 44x44px minimum for controls.

### Responsive strategy
- Mobile-first layout decisions.
- Validate breakpoints for small phones, tablets, and desktop.
- Avoid fixed widths for primary content blocks.

### Motion and feedback
- Use motion to explain transitions, not as decoration.
- Prefer short, meaningful animations.
- Provide clear loading, empty, success, and error states.

### Implementation handoff
For every design-driven change, provide:
1. Token updates
2. Component structure and naming
3. States (default/hover/focus/disabled/error)
4. Accessibility notes
5. Test checklist (visual + interaction)

## Forbidden
- Hardcoded colors scattered across components
- Unlabeled icon-only buttons
- Animations that block interaction
- Accessibility deferred to "later"
