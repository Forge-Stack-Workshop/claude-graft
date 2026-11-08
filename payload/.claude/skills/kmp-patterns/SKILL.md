---
name: kmp-patterns
description: Kotlin Multiplatform (KMP) shared-code development — expect/actual, source-set layout (commonMain + platform mains), shared business/data logic with coroutines, Ktor, SQLDelight, and koin, plus Compose Multiplatform vs native-UI trade-offs. Use whenever building or reviewing a KMP module, deciding what to share vs keep native, wiring expect/actual, or setting up a shared ViewModel/repository consumed by both iOS and Android — even if the user just says "share this logic between the apps".
origin: chrysa
---

# Kotlin Multiplatform Development Patterns

Share the logic, respect each platform's UI. KMP is for the boring, valuable middle —
models, use-cases, networking, persistence — not necessarily the UI.

## What to share vs keep native

- **Share**: domain models, use-cases, repositories, networking, serialization, caching,
  validation, analytics contracts. This is where duplication actually hurts.
- **Keep native by default**: UI. SwiftUI on iOS, Compose on Android gives the best
  platform feel. Compose Multiplatform is viable when UI parity matters more than
  platform-native polish — make it a deliberate decision, not a default.

## Source-set layout

```
shared/
  src/
    commonMain/   # pure Kotlin: domain, use-cases, repo interfaces, DTOs
    androidMain/  # actual impls using Android APIs
    iosMain/      # actual impls using platform/darwin APIs
    commonTest/   # shared tests run on every target
```

`commonMain` must not reference platform APIs. Bridge platform differences with
`expect`/`actual`, kept small and at the edges:

```kotlin
// commonMain
expect class PlatformClock() { fun nowEpochMs(): Long }

// androidMain
actual class PlatformClock actual constructor() {
    actual fun nowEpochMs() = System.currentTimeMillis()
}
// iosMain
actual class PlatformClock actual constructor() {
    actual fun nowEpochMs() = (NSDate().timeIntervalSince1970 * 1000).toLong()
}
```

Prefer expect/actual on *interfaces/factories*, not big classes — smaller platform
surface, easier to test.

## Canonical shared stack

- **Coroutines/Flow** for async. Expose `Flow`/suspend from shared code; on iOS bridge
  with SKIE (or a `Flow`→callback wrapper) so Swift gets ergonomic async.
- **Ktor client** for networking (engine `actual` per platform: OkHttp / Darwin).
- **kotlinx.serialization** for JSON.
- **SQLDelight** for a typed, multiplatform local DB.
- **Koin** for DI in shared code.
- Shared **ViewModel** via `androidx.lifecycle` KMP ViewModel (or Molecule for
  Compose-style state) so both platforms consume the same state holder.

## Consuming from each platform

- **Android**: depend on `shared` directly; inject the shared ViewModel/repo with Hilt or
  Koin. See `kotlin-android-patterns` for the UI layer.
- **iOS**: the Kotlin framework is imported into Swift. Keep the public API idiomatic —
  suspend/Flow bridged, sealed classes exposed cleanly. See `swift-ios-patterns` for the
  SwiftUI layer wrapping it.

## Rules that avoid KMP pain

- Keep the shared public API small and stable — it's a versioned contract across two apps.
- No platform leakage in `commonMain`; test it in `commonTest` so it stays pure.
- Threading: shared code should not assume a thread — dispatch on the consumer side or via
  injected dispatchers, and keep types `@Immutable`/frozen-safe for the iOS memory model.
- Version the Gradle plugin + Kotlin + KMP libs together via a version catalog.

## When to reach for other skills

- Native UI layers → `swift-ios-patterns`, `kotlin-android-patterns`.
- Multiplatform + platform tests → `mobile-testing`.
- Security/perf/store review of the resulting apps → `mobile-audit`.
- Build/sign/ship both apps → `mobile-release-ops`.
- Deciding module boundaries → `mobile-architecture`.
