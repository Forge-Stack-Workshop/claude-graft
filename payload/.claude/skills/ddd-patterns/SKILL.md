---
name: ddd-patterns
description: Domain-Driven Design patterns — ubiquitous language, subdomains, bounded contexts, context mapping, aggregates, value objects, domain events, event sourcing, and CQRS. Use when modeling a business domain, splitting a monolith, defining service boundaries, or designing the write/read model of a complex component.
origin: biblio
---

# DDD Patterns

Techniques for aligning software structure with business domain structure, from
strategic design (what to build, where the boundaries are) down to tactical
design (how to model business logic inside a boundary).

## When to Activate

- Modeling a new business domain or onboarding onto an unfamiliar one
- Deciding how to split a monolith or design microservice boundaries
- Two teams keep stepping on each other's models, or a shared model has become
  a bottleneck
- A "God model" tries to serve every use case and satisfies none well
- Choosing how to implement business logic for a component (simple CRUD vs.
  rich domain model vs. event-sourced model)
- Designing integration between two components with different, conflicting models
- A read side is bloated with reporting/query concerns that don't belong in the
  transactional model

## Strategic Design

### Ubiquitous Language

A language structured around the domain model, used by all team members
(domain experts and engineers) to connect all activities of the team with the
software. Terms come from domain experts, not from engineers guessing.

- The same word can mean different things in different parts of the business
  — that's a signal a boundary is needed, not a naming conflict to "fix".
  Example: "lead" means something different to Sales than to Marketing.
- The language is not global. A term is only meaningfully defined *within*
  a boundary; forcing one meaning across the whole system erodes precision.
- Symptom of a missing ubiquitous language: engineers translate business
  requirements into a different technical vocabulary, and domain experts
  can't read the resulting model.

### Subdomains

Decompose the business domain into subdomains — each a piece of business
functionality, discovered by analyzing the business, not the org chart.

| Type | Trait | Investment |
|---|---|---|
| Core | Complex, differentiates the company competitively | High — best engineers, most iteration, buy is wrong |
| Supporting | Needed to support the core, not competitively differentiating, not that complex | Moderate — straightforward implementation |
| Generic | Complex but solved and available off the shelf (auth, payments, email) | Low — buy or use an existing solution, don't reinvent |

Don't confuse "Core Subdomain" with "Core Domain" — the core domain is the
company's overall strategic differentiator; core *subdomains* are the pieces
of it. Misclassifying a generic subdomain as core (over-engineering solved
problems) or a core subdomain as generic (under-investing in the
differentiator) are both expensive mistakes.

### Bounded Context

The applicability boundary of a ubiquitous language and its model. Inside a
bounded context, terms, principles, and business rules are consistent; a term
has no meaning without an explicit context.

- A bounded context is a boundary, not a subdomain — the two are related but
  distinct decompositions; a single subdomain can be implemented by one or
  more bounded contexts, and boundaries are refined iteratively as
  understanding deepens (they are rarely right on the first attempt).
- Team boundaries and bounded-context boundaries should align: one team owns
  one bounded context's model end to end. A model owned by multiple teams
  invites conflicting changes and synchronization overhead.
- A bounded context is the unit at which an implementation pattern (CRUD,
  active record, domain model, event-sourced model, CQRS) is chosen — the
  choice is local to the context, not a system-wide decision.

## Context Mapping

Patterns for the *integration contract* between two bounded contexts —
capturing not just "who calls whom" but the power dynamic and model-translation
responsibility between them. Maintain the map as a living artifact (as code
when possible), not a one-time diagram.

| Pattern | When | Effect |
|---|---|---|
| Shared Kernel | Two teams accept the coordination cost of a shared, overlapping model | Any change requires both teams' agreement — high sync cost, avoid across distributed/loosely-coordinated teams |
| Customer–Supplier | Downstream depends on upstream, upstream accommodates downstream's needs | Formal, negotiated contract; upstream plans downstream's requirements into its roadmap |
| Conformist | Downstream accepts the upstream model as-is | No translation layer — cheap, but downstream absorbs upstream's design decisions and volatility directly |
| Anticorruption Layer (ACL) | Downstream refuses to let an upstream model leak into its own | Translation layer isolates the downstream model — protects the ubiquitous language at the cost of translation logic |
| Open-Host Service | Upstream serves many consumers | Publishes a stable, versioned protocol independent of upstream's internal model, instead of one integration per consumer |
| Published Language | Formalized, well-documented exchange format (e.g. an industry standard) | Decouples both sides from each other's internal model via a shared, external contract |
| Separate Ways | Integration cost outweighs the benefit | Each side duplicates the needed functionality rather than integrating |

Pick the pattern per *relationship*, not per system: the same bounded context
can be a Conformist to one upstream and enforce an ACL against another,
depending on how much trust and stability that specific upstream offers.

## Tactical Design

### Aggregate

A cluster of entities and value objects with a transactional consistency
boundary: invariants inside the aggregate must always hold, and a single
database transaction should touch at most one aggregate instance.

- The aggregate root is the public interface — external code interacts with
  the aggregate only through the root, never by reaching into its internals
  or referencing an inner entity directly.
- Aggregate boundaries define what has to be consistent *right now* versus
  what can be eventually consistent. Cramming unrelated entities into one
  aggregate "to be safe" produces lock contention and complex invariants;
  splitting too aggressively pushes real invariants across a transaction
  boundary where they can't be enforced atomically.
- One aggregate instance can reference another aggregate only by identity
  (an ID), not by holding a direct in-memory reference — this keeps
  transactional boundaries honest.

### Value Objects

Immutable objects defined by their attributes, not an identity — two value
objects with the same data are interchangeable. They can carry both data and
behavior (methods that validate or transform the value, returning a new
instance rather than mutating in place).

- Model concepts as value objects by default; promote to an entity only when
  the domain genuinely needs to track identity/lifecycle over time (e.g.
  "money" is a value object, "an order" is an entity).
- Immutability eliminates a whole class of bugs from shared mutable state and
  makes behavior easy to reason about and test in isolation.

### Domain Events

A record of something that happened in the domain, meaningful to domain
experts, named in the past tense in the ubiquitous language (e.g.
`OrderShipped`). Used to:

- Communicate state changes across aggregates within a bounded context
  without coupling them transactionally.
- Communicate across bounded contexts, decoupling the publisher's model from
  subscribers — subscribers react without the publisher needing to know who
  they are.

### Event Sourcing

Persist an aggregate's state as an append-only sequence of domain events
instead of the current state snapshot; current state is derived by replaying
events.

- Combined with the domain model pattern, this is called the event-sourced
  domain model — full audit trail and temporal query ("what did this look
  like at time T") come for free.
- Limitation: it is only efficient to query events of a *single* aggregate
  instance at a time — cross-aggregate queries need a separate read model
  (this is exactly what motivates CQRS alongside event sourcing).
- This is a heavier pattern; reserve it for core subdomains where the audit
  trail or temporal history has real business value, not as a default choice.

### CQRS (Command-Query Responsibility Segregation)

Segregate the model used to execute commands (the command execution model)
from the model(s) used to answer queries (read models), instead of forcing
one model to serve both.

- The command execution model enforces invariants and processes writes; read
  models are optimized, denormalized projections built for specific query
  needs (reporting, search, list views) and can live in a different storage
  technology (search engine, flat file, in-memory cache) than the write side.
- Read models are typically populated by subscribing to domain events
  published by the command execution model — an asynchronous projection.
- A common misconception: CQRS does not mean the read side must always be
  eventually consistent, nor that it replaces the command execution model —
  it is a segregation pattern, not a consistency mandate.
- CQRS is a good fit alongside the domain model or event-sourced domain model
  pattern for a core subdomain; it is unnecessary overhead for a simple CRUD
  or supporting-subdomain component with no divergent read needs.

## Pitfalls

- Treating "bounded context" and "subdomain" as synonyms — they are two
  different, related decompositions of the same business.
- Confusing the strategic Core Domain with tactical "core subdomains" —
  leads to over- or under-investing in the wrong pieces.
- Choosing Shared Kernel by default for convenience instead of Customer–Supplier
  or an ACL — the coordination tax compounds as teams scale.
- Letting an upstream's model leak into a downstream's ubiquitous language
  without an explicit Conformist decision — this is accidental coupling, not
  a deliberate integration choice.
- Reaching into an aggregate's internals instead of going through the root,
  breaking the transactional/invariant boundary the aggregate exists to enforce.
- Adopting event sourcing or CQRS for a generic or supporting subdomain
  "because it's best practice" — both patterns add real complexity that only
  pays off in a genuinely core, complex subdomain.
- Treating a context map as a one-time diagram instead of a maintained
  artifact that tracks how integration patterns evolve as trust and stability
  between teams change.
