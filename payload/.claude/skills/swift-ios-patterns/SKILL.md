---
name: swift-ios-patterns
description: Native iOS/Apple-platform development with Swift 6 and SwiftUI — strict concurrency (async/await, actors, Sendable), MV/observation state, Swift Package Manager, Apple Human Interface Guidelines, and API Design Guidelines. Use whenever building, reviewing, or refactoring a native iOS/iPadOS/macOS/watchOS/visionOS app in Swift or SwiftUI, wiring async code, designing SwiftUI views, or aligning code with Apple conventions — even if the user only says "the iPhone app" or names a Swift/SwiftUI file.
origin: chrysa
---

# Swift & SwiftUI Development Patterns

Native Apple-platform code, Swift 6 strict-concurrency mode, SwiftUI-first.

## Non-negotiable standards

- **Swift API Design Guidelines** — clarity at the call site. Methods read as phrases
  (`view.insert(subview, at: index)`), booleans read as assertions (`isEnabled`),
  no Hungarian/type suffixes. UpperCamelCase types, lowerCamelCase members.
- **Swift 6 strict concurrency** — no data races at compile time. Isolate mutable state
  in `actor`s or `@MainActor`; make cross-boundary types `Sendable`. Never `@unchecked
  Sendable` without a comment justifying the manual invariant.
- **Structured concurrency** — `async`/`await` over completion handlers; `async let` and
  `TaskGroup` for concurrent work; cancel via `Task` cancellation, not flags. No
  `DispatchQueue` for new code except where a framework demands it.
- **Value semantics first** — `struct`/`enum` by default; `class` only for identity or
  reference-shared state (usually a `@MainActor` observable model).
- **Errors are typed and thrown** — `throws` + `enum: Error`; reserve optionals for
  "absent", not "failed". No silent `try?` swallowing on the happy path.
- **Apple HIG** — respect Dynamic Type, Dark Mode, safe areas, native navigation. Don't
  reinvent system controls.

## SwiftUI architecture

Prefer the modern **MV / Observation** approach over heavyweight MVVM boilerplate:

```swift
@Observable
final class SessionStore {          // one source of truth, @MainActor by default
    private(set) var user: User?
    private let api: APIClient

    init(api: APIClient) { self.api = api }

    func load() async {
        do { user = try await api.currentUser() }
        catch { user = nil }         // surface via a real error state in prod
    }
}

struct ProfileView: View {
    @Environment(SessionStore.self) private var store
    var body: some View {
        Group {
            if let user = store.user { Text(user.name) }
            else { ProgressView() }
        }
        .task { await store.load() }   // lifecycle-bound, auto-cancels
    }
}
```

Rules that keep SwiftUI code honest:
- Views are pure functions of state. No side effects in `body`; drive work from
  `.task`, `.onChange`, or user actions.
- Keep view state minimal: `@State` for view-local, `@Observable` model injected via
  `.environment` for shared. Avoid passing giant models down; slice what a view needs.
- Extract subviews when `body` grows past ~a screenful or nests 3+ levels — small views
  re-render cheaply and read better.
- Identify list items with stable `Identifiable` IDs, never array indices.

## Dependencies & structure

- **Swift Package Manager** only; pin versions, one feature per target/module for build
  parallelism and clear boundaries.
- Layer the app: `Features` (SwiftUI + models) → `Domain` (pure Swift, no UIKit/SwiftUI)
  → `Data` (networking, persistence). Domain must not import UI frameworks.
- Networking: `URLSession` + `async` + `Codable`; centralize decoding and error mapping
  in one `APIClient`. No secrets in code — read from a config/keychain.

## Persistence

SwiftData for new local storage (`@Model`), Core Data only when you need its maturity.
Keychain for secrets/tokens (never `UserDefaults`). See `mobile-audit` for the security bar.

## When to reach for other skills

- Tests → `mobile-testing` (XCTest / Swift Testing / XCUITest).
- Security, perf, accessibility, App Store review → `mobile-audit`.
- Signing, fastlane, App Store Connect, phased rollout → `mobile-release-ops`.
- Cross-cutting layering/modularization across platforms → `mobile-architecture`.
