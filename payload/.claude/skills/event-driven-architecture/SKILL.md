---
name: event-driven-architecture
description: Event stream design, event sourcing, choreography, schema management, and stateful/stateless processing patterns for distributed systems handling real-time data at scale.
origin: Building Event-Driven Microservices (2nd Edition)
---

# Event-Driven Architecture

Asynchronous communication patterns using event streams to decouple services and enable real-time data propagation across systems. Events are data, not signals: a consumer reconstructs meaning from the event itself, never by calling back to the producer's API.

## When to Use

- Handling high-volume, time-sensitive data flows (IoT, transactions, user behavior)
- Implementing audit trails and system state history (event sourcing)
- Distributing data ownership across teams without direct API coupling
- Building stateful workflows that span multiple services
- Requiring guaranteed event delivery and ordering guarantees
- Replacing batch ETL/exports with a continuous, subscribable stream

Do not reach for it when a synchronous call is genuinely simpler: a single client waiting on a single, fast, always-available answer (e.g. login) rarely benefits from the added latency and eventual consistency of an event round-trip.

## Synchronous vs Asynchronous Communication

### Synchronous (Request-Response)

Service A waits for Service B to complete before continuing. Blocking, tightly coupled, simpler failure detection.

**Pros:** Immediate feedback, simple mental model, straightforward error propagation
**Cons:** Tight coupling, cascade failures, scaling bottlenecks, latency amplification, API definitions and service versions must be kept compatible across every caller

### Asynchronous (Event-Driven)

Service A publishes an event; Service B reacts independently. Non-blocking, loosely coupled, eventual consistency.

**Pros:** Loose coupling, independent scaling, resilience to delays, natural fit for streaming/real-time data, consumers form a canonical replayable record instead of depending on a querying API
**Cons:** Eventual consistency, harder end-to-end tracing, requires idempotent consumers, ordering only guaranteed within a partition

A microservice is rarely purely one or the other: it commonly produces events for other services to consume while also consuming events itself, and may still expose a synchronous API for external/UI-facing calls.

## Event Stream Infrastructure

### Topics and Partitioning

Events are published to **topics** (named, append-only streams). Topics are split into **partitions** for parallel consumption; ordering is guaranteed only *within* a partition, never across the whole topic.

```
Topic: orders
 ├─ Partition 0 → Consumer Group A reads sequentially: [order-1, order-3, order-5]
 ├─ Partition 1 → Consumer Group B reads sequentially: [order-2, order-4, order-6]
 └─ Partition 2 → Consumer Group C reads sequentially: [order-7, order-8, order-9]
```

- Choose a **partition key** that groups events needing relative order (e.g. `order_id`, `device_id`) — never a random/round-robin key if downstream logic depends on sequence.
- More partitions = more parallelism, but also more open file handles/replicas and a harder rebalance story; size for expected consumer-group scale, not just current throughput.
- Retention policy per topic: time-based (delete after N days) or **log compaction** (keep only the latest value per key — used for changelog/compacted state topics, e.g. "current customer address").

### Delivery guarantees, from weakest to strongest

| Guarantee | Behavior | Example |
| --- | --- | --- |
| At-most-once | No retry; message lost on failure | Ephemeral pub/sub without durable storage (e.g. NATS Core) — a message with no active subscriber is simply discarded |
| At-least-once | Retries until acked; may duplicate | Default for most durable brokers; requires idempotent consumers |
| Exactly-once | No loss, no duplication | Requires transactional producer + idempotent consumer + offset committed atomically with processing (see below) |

**Pitfall:** assuming "durable broker" implies exactly-once. Durability only prevents loss; duplication is still possible unless the producer/consumer pair is explicitly built for it.

### Schema Registry

A schema registry validates event structure before publication and governs compatibility as schemas evolve.

- **Backward compatible**: new schema can read old data (add optional fields with defaults, never required-without-default).
- **Forward compatible**: old schema can read new data (consumers ignore unknown fields).
- **Full compatible**: both directions hold — required when producers and consumers deploy independently, which is the common case in event-driven systems.
- Enforce compatibility checks in CI before a producer can publish a new version; reject breaking changes (renamed/removed required fields, type changes) at registration time, not at consumer runtime.

**Pitfall:** treating schema registry as optional. Schema drift leads to silent data corruption — a consumer deserializes garbage into default/zero values instead of failing loudly.

## Choreography vs Orchestration

### Choreography

Services react autonomously to events without a central coordinator. Event → Action → New Event chain; each service only knows the events it produces and consumes.

**Pros:** No single point of control/failure, services stay decoupled, easy to add new reactive services without touching existing ones
**Cons:** Hidden dependencies, harder to answer "what happens when X occurs" without tracing the whole chain, risk of circular event chains (A triggers B, B triggers C, C re-triggers A)

**Pitfall:** hidden dependencies and circular event chains; difficult to trace root cause of failures without distributed tracing/correlation IDs threaded through every event.

### Orchestration

A central coordinator (saga orchestrator, workflow engine) issues commands to each service and tracks the overall process state explicitly.

**Pros:** Explicit, inspectable process state; easier to reason about compensating actions on failure; single place to change the workflow
**Cons:** Coordinator becomes a bottleneck/single point of failure if not itself made resilient; reintroduces some coupling (services must expose commands the orchestrator can call)

**Rule of thumb:** choreography for simple, stable reaction chains (2-3 hops); orchestration once a business process has explicit steps, compensations, or needs a visible status ("this order is in step 3 of 5").

## Event Sourcing

Store every state change as an immutable event in an append-only log; current state is a fold/replay of all events, not a mutable row.

- The event log is the source of truth; a materialized "current state" table/view is a derived, disposable projection that can always be rebuilt by replaying.
- Enables full audit trail, point-in-time reconstruction, and new read models built later from historical events without touching producers.
- Combine with **CQRS** (Command Query Responsibility Segregation) when read and write access patterns diverge significantly: writes append events, reads query purpose-built projections.

**Pitfall:** treating the event log as an afterthought log file instead of the durable, replayable system of record — if a projection can be rebuilt from events, but the events themselves are ever deleted/mutated, the guarantee is broken.

## Stateless vs Stateful Processing

**Stateless processing**: each event is handled independently, with no memory of prior events (filter, map, simple validation, routing). Trivially scalable — any instance can process any event.

**Stateful processing**: the processor needs to remember something across events to produce a result (aggregation, windowed counts, joins across two streams, deduplication). Requires:

- A local state store (co-located with the processing instance) backed by a **changelog topic** for durability/recovery — on instance failure, a new instance rebuilds state by replaying the changelog.
- Careful partitioning so that all events needing to be combined land in the same partition/instance (e.g. partition both input streams by the same join key).

**Pitfall:** stateful processors are harder to scale (state must be repartitioned/migrated) and harder to test (must set up and tear down state stores); prefer stateless whenever the logic allows it, and push aggregation as close to the read/query side as possible.

## Exactly-Once Semantics

Guarantee: each event is processed exactly once, even across producer/consumer failures — this is a spectrum of engineering effort, not a switch to flip.

**Core challenge:** idempotency + offset tracking. If a consumer crashes after processing an event but before committing its offset, it will reprocess that same event on recovery — the processing side effect must tolerate replay.

**Building blocks:**

- **Idempotent producers**: broker deduplicates retried writes from the same producer session (sequence numbers per partition).
- **Transactional writes**: bundle "process input + write output + commit offset" into one atomic unit so a crash mid-way rolls back cleanly instead of leaving a half-applied state.
- **Idempotent consumers**: design the side effect itself to be safe on replay (upsert by natural key, not insert; check-then-act guarded by a unique constraint) — this is required regardless of broker guarantees, because downstream systems (a database, a third-party API) may not be transactional with the consumer offset.

### Outbox Pattern (avoiding dual writes)

Writing to the local database and publishing an event are two separate operations; if either fails independently you get inconsistent state (dual-write problem). The outbox pattern fixes this:

1. In the *same local transaction* as the business write, insert a row into an `outbox` table (all fields `NOT NULL`, serialize the event payload before the transaction commits so a serialization failure rolls back cleanly).
2. A separate connector (change-data-capture reader or polling publisher) reads new outbox rows and publishes them to the event stream.
3. Once the connector confirms the broker has durably stored the event, delete (or mark processed) the outbox row.
4. On any failure — database, connector, or broker — the outbox row is retained, so nothing is lost; the connector simply retries.

This gives at-least-once delivery to the stream while keeping the business write and the "intent to publish" atomic — the remaining duplicate risk is pushed onto the (idempotent) consumer.

**Pitfall:** assuming at-most-once; consumer failures plus delayed offset commits silently break an "exactly-once" assumption that was never actually engineered end-to-end.

## Data Liberation

Expose events as a data product for downstream teams. Events become the source of truth, not database exports or API polling.

**Pattern:** an event stream replaces batch extracts. Data consumers subscribe directly to topics instead of polling databases or waiting for nightly exports — this decouples the producing team's schema/implementation from every downstream consumer's release cycle.

- Publish a well-documented, versioned schema per topic (via the schema registry) as the actual contract — treat it with the same rigor as a public API.
- Prefer domain events ("OrderShipped") over raw table-change events ("orders row updated") at the liberation boundary; raw CDC streams are an internal implementation detail, not the public contract.
- Give downstream consumers replay capability (sufficient retention, or a compacted topic) so a new consumer can bootstrap its own state without asking the producing team for a one-off backfill.

## Common Pitfalls

- **Silent deserialization failures**: events with schema mismatches are dropped or coerced to defaults silently instead of raising/alerting.
- **Circular dependencies**: event A triggers B, B triggers C, C re-triggers A — usually a symptom of choreography without a documented event-flow map.
- **Dual writes**: writing to a database and publishing an event as two independent, non-transactional operations (see Outbox Pattern above).
- **Unbounded state growth**: stateful processors accumulating state for keys that will never be seen again (missing TTL/windowing).
- **Partition key mismatches**: joining or aggregating two streams partitioned by different keys, silently breaking correctness instead of failing loudly.
- **Treating the broker as a queue**: consuming and discarding events instead of preserving replayability — breaks event sourcing, data liberation, and disaster recovery all at once.

## Testing Event-Driven Systems

- **Contract tests** against the schema registry: verify producers publish, and consumers accept, the currently registered schema version — catches drift before it reaches a shared environment.
- **Consumer replay tests**: feed the same event twice through the real handler and assert identical end state — the direct test for idempotency, not just a code-review claim.
- **Chaos/failure injection**: kill a consumer mid-batch (after processing, before offset commit) and assert recovery reprocesses correctly rather than skipping or double-applying.
- **End-to-end choreography tests**: for a documented event-flow chain, assert the full sequence fires and terminates (no cycle) under a realistic set of inputs, including the failure branch.
- Avoid testing exclusively against a single monolithic "everything mocked" unit test; stateful/ordering bugs only surface with realistic partitioning and multi-consumer scenarios.

## Pre-Deployment Checklist

- [ ] Schema registered with explicit compatibility mode (backward/forward/full), enforced in CI
- [ ] Partition key chosen deliberately for required ordering guarantees
- [ ] Consumers are idempotent (safe to replay the same event any number of times)
- [ ] Delivery guarantee (at-most/at-least/exactly-once) explicitly chosen and documented, not assumed
- [ ] Choreography dependencies are documented (event-flow map), not implicit
- [ ] Dual-write risk addressed (outbox pattern or equivalent) wherever a DB write and an event publish must stay consistent
- [ ] Retention/compaction policy matches the topic's role (transient signal vs. replayable source of truth)
- [ ] Stateful processors have durable changelog-backed state and a tested recovery path
- [ ] Schema breaking changes caught before production, not at consumer runtime
