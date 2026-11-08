---
name: ui-ux-interaction
description: Use only when a project has a user-facing interface — building or reviewing UI, component behaviour, user feedback, loading/empty/error states, responsiveness, theming, i18n and accessibility. Applies the behavioural-UI-states and frontend standards and the by-design interaction requirements from the canon.
---

# ui-ux-interaction

> Inherits `governance-core`. Consumes the canon by reference. Applies **only
> when the project is user-facing** — skip for libraries/workers/CLIs with no UI.

## Role
Make interfaces reactive, legible and conformant: complete behavioural states,
clear user feedback, responsive + themable + multilingual where the canon
requires, accessible, and consistent with the configured design language —
proportionate to the product.

## Triggers
- Building/reviewing a screen, component, or flow; loading/empty/stale/offline/
  error/forbidden states; global page loading + local loaders; responsiveness;
  theming; i18n; accessibility; a default profile-management space.

## Rules it applies (resolve from the canon by ID)
- Behavioural UI states: handle empty, partial, stale, offline, error,
  access-denied states; global page loading + local loaders; stable deep-links;
  an omnibar beyond a navigable-entity threshold.
- Frontend architecture & robustness; UI consumes published versioned contracts
  only (decoupling).
- By-design interaction requirements the canon sets (e.g. multilingual,
  multi-theme, phone-responsive, a default profile-management space).
- Accessibility to the canon's minimum (e.g. WCAG AA).

## Inputs it must gather before acting
1. Whether the project actually has a UI (else skip).
2. The configured design language / shared component library availability.
3. The contracts the UI consumes (must be published, versioned).

## Execution steps
1. **Confirm UI applicability**; otherwise defer out.
2. **Cover all behavioural states** for each view (empty/partial/stale/offline/
   error/forbidden), plus global + local loading feedback.
3. **Responsive + theme + i18n by design** where the canon requires, not
   retrofit.
4. **Accessibility** to the canon's minimum; stable deep-links; omnibar when the
   catalog is large.
5. **Consume contracts**, never reach into another project's internals.
6. **Default profile-management space** where the canon requires it.

## Validation criteria (exit criteria)
- Every view has its full state set and loading feedback.
- Responsive, themed, and localized by design where required; accessibility
  checks pass.
- UI depends only on published versioned contracts.
- Frontend gates pass via `quality-validation`.

## Interactions with other skills
- Consumes contracts designed with `development-conventions`.
- Feeds frontend gates to `quality-validation`.
- Surfaces error states consistently with `observability-diagnostics`'s error
  model.
- Routes any external effect (deploying the frontend) through `external-actions`.

## Limits
- Does not apply to non-UI projects.
- Does not decide undecided (to-arbitrate) frontend items — it flags and follows
  the current canon default.

## Actions requiring human validation
- Shipping/deploying the interface (via `infrastructure-execution` +
  `external-actions`).
- Any change that would drop an accessibility or by-design invariant (ADR +
  owner + expiry).
