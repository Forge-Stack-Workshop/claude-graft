---
name: crossplatform-mobile-patterns
description: Cross-platform mobile development with Flutter (Dart) or React Native/Expo (TypeScript) — one codebase, two platforms. Covers state management, navigation, native-module bridging, and each framework's idioms and performance model. Use whenever building or reviewing a Flutter or React Native/Expo app, choosing between the two, wiring state/navigation, or bridging to native code — even if the user just says "our cross-platform app" or names a .dart/.tsx file. Read the matching reference file for the chosen framework.
origin: chrysa
---

# Cross-Platform Mobile Patterns (Flutter & React Native)

One codebase shipping to iOS and Android. Pick the framework deliberately, then follow
its idioms — the failure mode is writing web/desktop habits into a mobile runtime.

## Choosing the framework

- **Flutter** — own rendering engine (Skia/Impeller), pixel-consistent UI across
  platforms, strong for custom/branded UI and animation. Dart, single toolchain.
- **React Native / Expo** — renders real native views, best when the team is JS/TS-heavy,
  needs deep native-view integration, or shares logic with a web app. Expo for managed
  builds/OTA; bare RN when you need custom native modules.

If the user hasn't chosen and it's greenfield, ask; don't assume.

## Shared discipline (both frameworks)

- **Typed everything** — Dart sound null-safety / TypeScript `strict`. No `dynamic`/`any`
  on the happy path.
- **Unidirectional data flow** — immutable state down, events up. Screens are functions of
  state; side effects live in controllers/hooks, not in build/render.
- **Layer it** — `presentation` (widgets/components) → `domain` (pure logic) → `data`
  (repositories, API, storage). Keep domain framework-agnostic.
- **No secrets in the bundle** — JS/Dart ships to the device and is extractable. Secrets
  go server-side or in native secure storage. See `mobile-audit`.
- **Respect the 16ms frame budget** — keep build/render cheap, move heavy work off the UI
  thread (isolates in Dart, native modules / InteractionManager in RN).

## Framework specifics

Read the reference file for the chosen stack before writing code:

- Flutter → `references/flutter.md` (widget composition, Riverpod/Bloc, Impeller perf).
- React Native → `references/react-native.md` (New Architecture/Fabric/TurboModules,
  Hermes, Expo, navigation).

## When to reach for other skills

- Native modules / bridging deeper than the reference covers → `swift-ios-patterns`,
  `kotlin-android-patterns`.
- Tests (widget test, Detox, Maestro) → `mobile-testing`.
- Security, perf, a11y, store review → `mobile-audit`.
- Signing, fastlane/EAS, OTA, store submission → `mobile-release-ops`.
- Cross-cutting layering → `mobile-architecture`.
