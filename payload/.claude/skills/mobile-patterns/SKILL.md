---
name: mobile-patterns
description: >-
  Mobile app architecture & UX patterns — React Native / Expo first (reusing
  React + TS knowledge), PWA as the low-cost path, Flutter as the alternative.
  Covers navigation, offline/sync, push, native modules, platform conventions
  (iOS HIG / Android Material), gestures, and mobile performance. TRIGGER
  whenever the work targets a phone/tablet app — "mobile app", React Native,
  Expo, "mobile version", PWA installable, touch/gesture UX, app store
  submission, or making a web app work well on mobile.
---

# Mobile Patterns

Build mobile apps that feel native, not like a shrunk website. This skill owns
the **mobile-specific** architecture and platform conventions; the user journey,
the React idioms, and the visual build belong to their own passes.

## Stack decision (pick before building)

| Path | When | Cost |
|---|---|---|
| **PWA** (Vite + `vite-plugin-pwa`) | reuse an existing React web app, installable, no store | ⭐ lowest |
| **React Native + Expo** | true native feel, native APIs, store presence, reuse React/TS mental model | medium |
| **Flutter** | heavy custom UI / 60fps animation, single codebase, you accept Dart | medium-high |

Default to **PWA** when the app is content-shaped and already web; reach
for **Expo** when you need native modules (camera, biometrics, background, real
push) or a store listing. State the choice and why before scaffolding.

## When to Use

- Any phone/tablet target (native or PWA)
- Making an existing web app installable / mobile-worthy
- Push, offline sync, gestures, native module questions
- App store prep

## Do NOT Use For

- The user journey itself (use a UX-flow pass)
- Desktop apps
- Pure web responsive tweaks

## Architecture

- **Navigation**: React Navigation (Expo) — native stack + tabs; model the nav
  tree explicitly and map it to the user journey. Deep-linking + state
  restoration from day one.
- **State/data**: TanStack Query for server-state (same as your web), with
  **offline-first** cache persistence; a lightweight store (e.g. Zustand) for UI
  state. Assume the network drops mid-flow — every mutation needs an offline
  queue or an honest disabled state.
- **Native modules** (Expo): prefer the Expo SDK; drop to a config plugin only
  when a capability is missing. Keep native code behind a TS interface so the
  business logic stays testable.
- **Auth**: your auth library + secure storage (Expo SecureStore / Keychain /
  Keystore) — never AsyncStorage for tokens.

## Mobile UX conventions (non-negotiable)

- **Touch targets ≥ 44×44 pt**; spacing for fat fingers; primary actions in
  **thumb reach** (bottom third), not top corners.
- **Native navigation**: platform back (Android hardware/gesture back must work),
  bottom tab bar for top-level, never a hamburger for primary nav.
- **Safe areas & notches**: respect insets top and bottom; test on a notched
  device and a small device.
- **Interrupt-resilient**: calls, backgrounding, low battery, rotation — the flow
  survives and restores.
- **Permissions**: prime *before* the OS prompt (explain why), request at point
  of need, degrade gracefully on denial.
- **Feedback**: every tap gives immediate visual/haptic response; no dead time
  without a skeleton/spinner.
- **Platform fit**: iOS HIG vs Android Material — don't ship an iOS clone on
  Android. Respect each platform's typography, motion, and control idioms.

## Performance = UX on mobile

- 60fps lists (FlashList over FlatList for long lists), image caching/downscaling,
  lazy routes, minimal bridge traffic (RN), and a cold-start budget.
- Measure on a **mid-range real device**, not the simulator — the simulator lies
  about jank and battery.

## Output / workflow

1. State stack choice + why. 2. Map nav tree ↔ user journey. 3. Build with
the conventions above. 4. QA on a real mid-range device against the UX checklist.

## Notes

- Offline and interrupt states are where mobile apps actually fail — design them
  first, not last.
