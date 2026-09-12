---
name: mobile-architecture
description: Cross-cutting mobile app architecture for iOS, Android, KMP, Flutter, and React Native — layering (presentation/domain/data), unidirectional data flow, feature modularization, dependency inversion, offline-first data, and choosing a pattern (MVVM/MVI/Clean/TCA). Use when starting a new mobile app, deciding module boundaries or state-management approach, reviewing whether an app's structure is sound, or untangling a "everything talks to everything" mobile codebase — before dropping into a stack-specific patterns skill.
origin: chrysa
---

# Mobile Architecture (platform-agnostic)

The layering and boundaries that hold on every mobile stack. Apply these first, then use
the stack-specific skill (`swift-ios-patterns`, `kotlin-android-patterns`, `kmp-patterns`,
`crossplatform-mobile-patterns`) for the idioms.

## The three layers (never skip the direction of dependencies)

```
Presentation  (UI + state holders)      depends on ↓  Domain
Domain        (entities, use-cases)      depends on nothing framework-specific
Data          (repositories, sources)    implements Domain interfaces ↑
```

- **Domain is pure.** No UIKit/SwiftUI, no Android SDK, no React, no Flutter. Just the
  business rules and the *interfaces* the data layer implements. This is what makes an app
  testable and portable (and shareable in KMP).
- **Dependency inversion.** Presentation and data both depend on domain abstractions, not
  on each other. The data layer plugs in at the composition root (DI container / app entry).
- **One source of truth per data type.** A repository owns it; the network and DB are
  details behind it. UI never talks to the network directly.

## Unidirectional data flow

State flows down, events flow up. The screen renders one immutable state object; user
actions emit events that a state holder turns into the next state. This is MVVM (iOS/Android/
Flutter), MVI (explicit intents), or TCA/Redux (reducer). Pick per stack:

| Stack | Default state holder |
| --- | --- |
| SwiftUI | `@Observable` model (MV) or TCA for complex flows |
| Android Compose | ViewModel + `StateFlow<UiState>` (MVI-flavored UDF) |
| Flutter | Riverpod / Bloc |
| React Native | hooks + TanStack Query + Zustand |
| KMP | shared ViewModel (lifecycle KMP / Molecule) |

The principle is identical everywhere; only the library changes.

## Modularization

- **Feature-first** module/folder layout (`feature/checkout`, not `viewmodels/`,
  `models/`). Features are independently buildable/testable and don't import each other —
  they meet only through domain contracts or a navigation layer.
- Shared foundations go in `core/` modules: `core:domain`, `core:data`, `core:ui`,
  `core:designsystem`. Enforce that features depend on core, never the reverse.
- Keep the dependency graph acyclic. If two features must share, extract to core.

## Offline-first & data

- Treat the network as unreliable: cache in a local DB (Room/SwiftData/SQLDelight/
  Drift/WatermelonDB), read from the DB, sync in the background, reconcile conflicts
  explicitly. UI reads a `Flow`/publisher off the store.
- Model loading/empty/error/content as explicit states — never a bare spinner that can
  hang forever.

## Navigation

Centralize it (type-safe routes, deep-link aware). Features expose routes, not concrete
screens, so the graph stays decoupled.

## Reviewing an existing app

Ask: Does domain import a UI framework? Does UI hit the network directly? Is there a God
object / singleton everything mutates? Are features cyclically dependent? Each "yes" is the
refactor to prioritize — surface them plainly rather than rewriting wholesale.

## Then go stack-specific

Once the boundaries are set, use the matching patterns skill for concrete code, and
`mobile-testing` / `mobile-audit` / `mobile-release-ops` for the other axes.
