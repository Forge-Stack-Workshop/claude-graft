---
name: microservices-patterns
description: Design, decompose, communicate between, and operate microservices using the patterns and trade-offs from Sam Newman's "Building Microservices, 2nd Edition" — bounded contexts, sync/async communication, sagas, decomposition, stability, and team topology.
origin: biblio
---

# Microservices Patterns (Sam Newman)

Distilled from *Building Microservices, 2nd Edition* (Sam Newman, O'Reilly). Every
pattern below is named and framed the way Newman frames it, with his stated
trade-offs — not generic microservices folklore.

## When to Activate

- Deciding whether/how to split a monolith into services
- Choosing a communication style between two services (sync vs async, request-response
  vs event-driven)
- Designing a multi-service business transaction (the "how do I do a transaction
  across services" question)
- Reviewing service boundaries that keep leaking into each other (shared DB, chatty
  calls, coordinated deploys)
- Adding resilience (circuit breakers, bulkheads, retries, time-outs) to service calls
- Debugging or designing observability for a distributed system
- Team/org design questions that keep resurfacing as architecture problems (Conway's
  Law)
- Planning an incremental migration off a monolith

## Core Definition (don't skip this)

A microservice is an independently deployable service, modeled around a business
domain. The **only two hard requirements** Newman insists on:

1. **Independent deployability** — you can change and deploy one service without
   having to change or deploy any other service. This is the yardstick for every
   other decision below; if a "microservice" can't be deployed alone, it isn't one.
2. **Modeled around a business domain**, not a technical layer (not "the database
   tier", "the validation tier").

Independent deployability requires: loose coupling (change one thing without
changing another) and strong cohesion (related behavior stays together) — plus
information hiding to get both.

## Information Hiding & Service Boundaries

Information hiding: hide as much internal detail (code, data) as possible behind a
service's interface; expose only the bare minimum consumers need. Smaller public
interface = fewer things that break consumers when you change internals = easier to
keep backward compatible.

**Key application: hide the database.** A microservice's database must never be
directly accessed by another service's code. Shared/exposed databases are the
single most common way teams accidentally rebuild a distributed monolith — internal
schema changes now require coordinated multi-service deploys, destroying independent
deployability.

**Boundary discovery: model around bounded contexts** (from Domain-Driven Design).
A bounded context is an explicit boundary within which a domain model has consistent
meaning — the same word ("Customer", "Order") can mean different things in different
contexts, and that's fine as long as each context owns its own model. Use bounded
contexts, not database tables or technical layers, as the unit of service
decomposition. Pitfall: decomposing by technical layer (a "UI service", a
"business-logic service", a "data service") reproduces the three-tier architecture's
coupling problems inside a distributed system — worse of both worlds.

## Communication Styles

Newman's framing: pick communication style along two independent axes —
**synchronous vs asynchronous**, and **request-response vs event-driven**.

| Style | Description | Trade-off |
| --- | --- | --- |
| Synchronous request-response | Caller blocks waiting for a reply (HTTP, gRPC) | Simple to reason about; but couples caller's availability to callee's — a slow/down downstream degrades or breaks the caller |
| Asynchronous request-response | Caller sends request, gets reply later (via callback/polling/message) | Decouples timing, but adds complexity (correlation, timeouts, retries) |
| Event-driven (choreography) | Service emits a fact ("OrderPlaced") without knowing who consumes it; consumers react independently | Loosely coupled, "smarts" distributed across the system; but overall business process becomes implicit — hard to see "the flow" anywhere, hard to track/monitor an end-to-end process |
| Orchestration | A central coordinator calls each service in sequence and manages the process explicitly | Business process is explicit and easy to trace, but the orchestrator becomes a hub of logic/coupling and a potential single point of failure/bottleneck |

**Events vs messages** — Newman is precise about the vocabulary: an **event** is a
fact ("something happened"); a **message** is the transport envelope sent over an
asynchronous mechanism (e.g. a broker). "The message is the medium; the event is
the payload." You can also send a request as a message payload — that's async
request-response, not event-driven collaboration. Don't conflate the two when
designing a system: choosing a message broker is an implementation detail, not a
style decision.

**Choreography vs orchestration is a real trade-off, not "choreography is always
better."** Choreography scales better organizationally (no central bottleneck team)
but a business process spread across N services with no single place to see the
flow is a genuine operability cost. Newman's guidance: for complex, long-running,
multi-step business processes, lean toward an explicit state-managing coordinator
(orchestration or a saga orchestrator) — reserve pure choreography for cases where
each service's reaction is genuinely independent and the overall flow doesn't need
central visibility.

## Distributed Transactions & Sagas

Microservices break the ability to wrap a business operation in a single ACID
database transaction, because the operation now spans multiple services with
separate databases. Two-phase commit exists but Newman treats it as generally a bad
fit for microservices (locking, coordinator single point of failure, poor
fit with unreliable networks/partitions).

**Saga pattern**: model a business operation as a sequence of local transactions,
each in one service, with **compensating transactions** defined for each step to
undo its effect if a later step fails. There is no atomic rollback — a saga
"rollback" means *explicitly executing compensating actions* for every step that
already committed, not un-doing history as if it never happened.

Two saga coordination styles map directly onto the choreography/orchestration axis:

- **Choreographed saga** — each service, on completing its step, emits an event; the
  next service reacts. No central coordinator; harder to see overall saga state.
- **Orchestrated saga** — a saga orchestrator explicitly calls each participant in
  order and issues compensating calls on failure. Easier to reason about and debug,
  but the orchestrator is now a piece of business logic with its own lifecycle and
  a potential coupling point.

**Known limitation Newman flags explicitly** (citing Uwe Friedrichsen, "The Limits
of the Saga Pattern"): sagas assume the underlying technical components
(network, services) are reliable enough that compensating actions can actually run.
Sagas are not a substitute for making the individual components themselves reliable
— pair sagas with the stability patterns below, not instead of them.

Practical corollary: **idempotency is mandatory** for every step and every
compensating action in a saga — retries after partial failure or duplicate delivery
must be safe to run twice.

## Stability Patterns (Resilience)

Newman's premise: in a distributed system, "machines might die, and bad things
happen to good network packets" — assume failure, don't just hope it doesn't
happen. The named stability patterns:

- **Circuit breaker** — after repeated failures calling a downstream service, stop
  calling it for a cooldown period and fail fast instead, giving the downstream
  service room to recover and preventing the caller from wasting resources on calls
  likely to fail.
- **Bulkhead** — isolate resources (thread pools, connection pools) per downstream
  dependency, so one misbehaving downstream call can't exhaust resources needed by
  calls to healthy dependencies (named after ship bulkheads containing flooding to
  one compartment).
- **Time-outs** — every synchronous call must have an explicit, sane time-out; an
  unbounded wait on one call can cascade resource exhaustion upstream.
- **Retries** — combine carefully with idempotency and time-outs; a naive retry
  storm during an outage makes things worse, not better.

Apply these at every synchronous service-to-service call boundary, especially ones
crossing team ownership boundaries where you don't control the downstream's
reliability.

## Observability

Newman explicitly reframes "monitoring" as an *activity* versus **observability**
as an *outcome/property*: observability is the extent to which you can understand
what a system is doing purely from its external outputs. A distributed system can
fail in ways you never anticipated, so you cannot pre-enumerate every failure mode
to "monitor for" — you instead invest in making the system's outputs rich enough to
diagnose failures you didn't predict.

Practical requirements this implies:
- **Correlation IDs** propagated through every call chain, so a single business
  request can be traced across service boundaries.
- **Distributed tracing** to reconstruct the path and timing of a request across
  services.
- Structured, queryable logs and metrics designed in from the start, not bolted on
  after an incident.

## Testing Trade-off: Reduce Reliance on End-to-End Tests

Newman's explicit recommendation: don't lean on end-to-end tests as the primary
safety net for a distributed system — they are slow, flaky, and don't scale with
service count. Replace much of that effort with:
- **Consumer-driven contracts** — a consumer defines the contract it expects, the
  provider verifies it in CI, catching breaking changes before they reach
  production integration.
- **Schema compatibility checking** for asynchronous/event contracts.
- **Testing in production** (canary releases, synthetic monitoring) as a legitimate,
  faster feedback loop than an ever-growing end-to-end suite.

## Decomposing a Monolith

For migrations, Newman defers to his companion book *Monolith to Microservices* but
names the headline pattern here:

**Strangler Fig Pattern** (coined by Martin Fowler): wrap the existing system with
the new system and incrementally take over functionality, rather than a big-bang
rewrite. Mechanically: intercept calls to the existing monolith (e.g. via a proxy/
gateway), redirect specific capabilities to new services one at a time, and let the
new system gradually "strangle" the old one until it can be retired. Advantage over
big-bang rewrite: continuous incremental value delivery and continuous risk
reduction, instead of a long-running rewrite that risks never shipping.

**Backward compatibility discipline** during migration: track who calls old
interfaces (via a user-agent/client-identifier header or requiring API gateway
keys per consumer) before retiring anything. If a consumer won't migrate off an old
interface even after being asked, some organizations set a hard retirement date and
communicate it — but track consumers first; don't guess.

## Team Topology & Conway's Law

Conway's Law (quoted directly): "Organizations which design systems... are
constrained to produce designs which are copies of the communication structures of
these organizations." Newman's application: a layered/tiered architecture is often
the direct result of organizing teams by technical competency (DB team, Java team,
frontend team) rather than by business domain — the software architecture mirrors
the org chart, for better or worse.

Implication for microservices adoption: if you want service boundaries aligned to
business domains, **team boundaries should also align to business domains**
(stream-aligned teams owning end-to-end capability), not to technology layers.
Splitting services along domain lines while keeping teams organized by technology
layer fights Conway's Law and tends to regress toward coupled, layered designs
regardless of the deployed topology.

## Scaling Axes (four, in order of effort)

Newman lists four axes, recommending you exhaust the cheap ones before reaching for
the expensive ones:

1. **Vertical scaling** — bigger machine. Cheapest, try first.
2. **Horizontal duplication** — more instances doing the same work.
3. **Data partitioning** — split work by an attribute of the data (e.g. customer
   group / shard key).
4. **Functional decomposition** — split by type of work (this is what microservice
   decomposition itself is). Most expensive/complex; reach for it only after the
   others are exhausted or don't fit the actual bottleneck.

It's common and expected to mix axes (e.g. partition by customer *and* duplicate
horizontally within a partition).

## Containers & Kubernetes — Sequencing Advice

Newman is deliberately conservative here: don't rush to adopt Kubernetes or even
containers just because "microservices." Container orchestration platforms solve a
real problem (distributing many container instances across many machines reliably),
but that problem doesn't exist yet with only a handful of services. Adopt
containerization/Kubernetes once the operational overhead of deployment becomes a
genuine, felt pain point — and prefer a managed Kubernetes offering over running
your own cluster, since cluster operations is itself a significant ongoing burden.

## Quick Decision Checklist

- New service boundary candidate → does it map to one bounded context, or does it
  split a technical layer? If the latter, redraw it.
- Two services need to share data → is one exposing its DB directly? If yes, that's
  the coupling bug — put an API/event in front of it instead.
- Multi-service business operation needs atomicity → design a saga with explicit
  compensating transactions and idempotent steps; don't reach for 2PC.
- Choosing choreography vs orchestration → is the end-to-end flow something a human
  needs to see/debug as one entity? Orchestrate. Is each reaction genuinely
  independent with no need for central visibility? Choreograph.
- Every synchronous call → does it have a time-out, and is it behind a bulkhead and
  circuit breaker if it can fail independently of the caller?
- Planning a monolith split → strangler fig incrementally, track old-interface
  consumers before retiring anything, replace end-to-end test reliance with
  consumer-driven contracts.
- Service boundaries keep drifting back together → check team boundaries first;
  it's probably Conway's Law, not a technical design flaw.
