---
name: mobile-testing
description: Testing mobile apps across iOS, Android, KMP, Flutter, and React Native — the test pyramid (unit/integration/UI/E2E), TDD, deterministic async tests, test doubles, and coverage targets. Covers XCTest/Swift Testing/XCUITest, JUnit/Turbine/Compose UI test/Espresso, Flutter widget/integration tests, and Jest/Detox/Maestro. Use whenever writing or reviewing mobile tests, setting up a test suite or CI test stage, stabilizing flaky UI tests, or practicing TDD on a mobile feature — read the reference file for the target stack.
origin: chrysa
---

# Mobile Testing

Fast confidence, minimal flake. Same shape on every stack: a wide base of pure-logic unit
tests, fewer integration tests, a thin top of end-to-end tests on critical journeys only.

## The pyramid (proportions, not dogma)

- **Unit (most)** — domain/use-cases/state holders in isolation, no device, milliseconds.
  This is where UDF pays off: a state holder is a pure `(state, event) → state` you can
  hammer with cases.
- **Integration (some)** — repository + real DB, serializer round-trips, a ViewModel with
  fake data sources. Verifies wiring, not just units.
- **UI/E2E (few)** — only the money paths (onboarding, login, checkout). They're slow and
  the flakiest, so keep them scarce and rock-solid.

## Rules that keep suites trustworthy

- **Determinism** — inject clock, dispatchers/schedulers, randomness, and the network.
  Await async explicitly; no `sleep`. Control coroutine/async time (test dispatchers,
  `await fulfillment`, `pump`/`fakeAsync`).
- **Test doubles at the boundary** — fake the repository interface, not the HTTP client's
  internals. Prefer hand-written fakes over heavy mocking frameworks for readability.
- **One reason to fail per test**; arrange-act-assert; name tests by behavior
  (`load_setsErrorState_whenApiFails`).
- **Isolate state** — fresh in-memory DB per test, no shared mutable globals, no test
  ordering dependence.
- **Coverage is a floor, not a goal** — target the chrysa bar (>=85%, see
  `.claude/rules/thresholds.md`) on domain/data; don't chase 100% on generated UI glue.

## TDD loop

Red → green → refactor, on the state holder / use-case level where feedback is fastest.
Write the failing behavior test, make it pass minimally, then refactor with the test as a
net. UI tests come after the logic is proven, for the few journeys that warrant them.

## Stack specifics

Read the matching reference before writing tests:

- iOS → `references/ios.md` (Swift Testing / XCTest, async, XCUITest, snapshot).
- Android → `references/android.md` (JUnit5, Turbine for Flow, Compose UI test, Espresso,
  Robolectric, MockK).
- Flutter → `references/flutter.md` (unit, `flutter_test` widget tests, `integration_test`,
  golden tests, mocktail).
- React Native → `references/react-native.md` (Jest + RTL-native, MSW, Detox/Maestro).
- KMP → test in `commonTest` (kotlin.test + coroutines-test), run on every target.

## CI

Run unit+integration on every PR (fast, blocking). Run device/E2E on a smaller cadence or
a device farm — gate merges on the fast tiers, monitor the slow ones. See
`mobile-release-ops` for pipeline wiring.
