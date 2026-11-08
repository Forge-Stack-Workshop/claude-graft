---
description: API and public-contract rules. Use when designing or reviewing an HTTP/REST/GraphQL API, an SDK, a webhook, or a real-time channel.
paths:
  - "**/openapi*.y*ml"
  - "**/openapi*.json"
  - "**/asyncapi*.y*ml"
  - "**/*.proto"
  - "**/routes/**"
  - "**/routers/**"
  - "**/api/**"
---

# APIs, contracts & real-time

- **The machine-readable contract is the canonical interface.** An API is
  defined by an OpenAPI / AsyncAPI / JSON Schema document, not by whatever the
  handler happens to return. The contract is versioned with the code and is the
  artefact SDKs and consumers are generated from.
- **Public versions are explicit, with a compatibility guarantee.** A breaking
  change is a new version; the old one carries a dated deprecation policy, not a
  silent removal. Additive changes stay backward-compatible.
- **Errors are typed on the wire.** Every error response carries a stable
  machine-readable code and a correlation id, plus a message that says what to
  fix — never how the system is built (see `errors.md`, `security.md`).
- **Collections paginate by cursor.** No endpoint returns an unbounded set;
  offset pagination drifts under writes.
- **Responses are hypermedia-driven where it helps.** A resource carries at
  least a `self` link plus the authorization-aware links for the actions
  reachable next, so a client follows links instead of templating URLs from ids.
- **Critical writes are idempotent** — an idempotency key so a retried request
  does not double-charge or double-create.
- **Guards live in the contract**, not only in the handler: timeouts, size
  limits, and the authorization each operation requires are part of the
  interface.
- **Inter-service contracts are tested on both sides.** A provider test and a
  consumer test, so a change that breaks a consumer fails in CI, not in
  production. SDKs track the public contract, never internal models.
- **Events and webhooks are first-class contracts** — identified, versioned,
  signed, replay-protected, with a bounded retry and a dead-letter sink so a
  poison event neither retries forever nor vanishes.

## Real-time

- **A real-time backend has channel contracts and never blocks.** Every channel
  carries a name and a typed, versioned contract. Subscription is decoupled from
  processing by a **bounded buffer**, so the receiver never blocks on I/O and a
  slow consumer cannot stall the transport (backlog is a metric with an alert).
- Every call to external infrastructure is guarded and degrades safely when the
  dependency is down; health is probed on demand and cached, not hot-polled.
- Delivery semantics are declared, and at-least-once consumers are idempotent.
- The transport (WebSocket / SSE / broker) is an adapter behind the domain's
  port, chosen by config — never wired into business code (see `architecture.md`).
