# Architecture — hexagonal, always

Non-negotiable, whatever the size of the project.

- **The domain depends on nothing.** No framework, no ORM, no HTTP client, no
  vendor SDK is imported by business logic. If the domain layer imports it, it
  is a defect.
- **Layers:** `domain` (pure) → `application` (ports + use cases) →
  `infrastructure` (adapters: DB, HTTP, queues) and `presentation` (API, UI).
  Dependencies point inward only. Enforce it mechanically when the language
  allows (`import-linter`, ESLint boundaries) — a contract nobody checks drifts.
- **Every external dependency sits behind an adapter.** The port is written in
  the domain's vocabulary, not the vendor's: if renaming the vendor changes the
  port signature, the port is wrong.
- **One responsibility per file.** One class per file, file named after it.
- Adding a dependency is a decision, not a reflex — see `dependencies.md`.

Error handling and failure behaviour are governed by `errors.md`.
