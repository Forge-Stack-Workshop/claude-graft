---
description: Querying and schema rules. Use when writing SQL, migrations, ORM models, repositories, or anything touching the database.
paths:
  - "**/*.sql"
  - "**/migrations/**"
  - "**/alembic/**"
  - "**/models/**"
  - "**/model/**"
  - "**/repositories/**"
  - "**/repository/**"
  - "**/entities/**"
---

# Database

## Querying

- **N+1 is a defect, not a performance detail.** Any loop that triggers a query
  per iteration gets rewritten: eager loading (`selectinload` / `joinedload`),
  a single join, or one batched `IN` query. Assume every `for` over a relation
  is an N+1 until proven otherwise.
- Fetch the columns you use, not the row. No `SELECT *` in application code.
- Every query that can return an unbounded set is paginated. No exception.
- **Read the plan before optimizing.** `EXPLAIN ANALYZE` first, index second.
  An index added on a guess is dead weight that slows every write.
- Index what you filter, join, and sort on. A foreign key without an index is
  a lock contention waiting to happen.
- Aggregate in the database, not in the application, when the database can.

## Structure

- The schema is normalized until a measured read path proves otherwise; a
  denormalization is a decision with a written reason.
- Constraints live in the database: `NOT NULL`, `FOREIGN KEY`, `UNIQUE`, `CHECK`.
  Application-level validation complements them, never replaces them.
- Explicit types: `timestamptz` never naive datetime, `numeric` for money never
  float, an enum or a lookup table never a free string.
- **Migrations are versioned, reversible, and reviewed.** No manual change to a
  running database. A migration that cannot be rolled back says so and why.
- A migration touching a large table states its locking behaviour before merge.

## The schema is documented, and its map is generated

A schema is the one part of a system where a mistake outlives every refactor:
code is rewritten, data is migrated. It gets the same treatment as the call
chains in `code-flow.md`, with the same split of natures:

| | Source | Answers |
| --- | --- | --- |
| `docs/data-model/erd.md` | **generated** from the models | which tables exist and how they relate |
| `docs/data-model/README.md` | **hand-written** | what each table means, which context owns it |
| `docs/data-model/invariants.md` | **hand-written** | which business rules the schema enforces, and which it only hopes the application enforces |

The generated diagram says what *is*; only the hand-written pages say what it
is *for* and where it stops. A relation nobody can explain is a relation nobody
should trust.

**A migration that changes the shape updates the map in the same commit** —
`documentation.md` applies here without exception. Use the `data-model-map`
skill to regenerate and to reconcile.

## Modelling smells — name them, never fix them silently

When reading models or a migration, say so when you see these. They are
judgement calls, not defects: report the candidate with its reasoning and let
the developer decide. Changing a schema on your own initiative is not a
refactor, it is a data migration.

- **Two entities that are one.** Always created, updated and deleted together,
  joined 1:1, and never queried apart. That is one table with more columns.
- **A 1:1 table that is an attribute group.** Optional profile-style fields
  split into their own table buy a join on every read and guarantee nothing.
- **Tables that differ only by a type column.** Two near-identical tables where
  one plus an enum would do — or the reverse, one table whose rows mean three
  different things depending on a discriminator, half its columns always null.
- **A nullable foreign key used as a discriminator** — polymorphic association
  by hand. The database can enforce nothing about it.
- **A foreign key that crosses a bounded context.** Ownership belongs to one
  context; the other holds an id, without a constraint. A constraint across
  contexts couples their deployments and their migrations.
- **A denormalised parent id** that duplicates a path already reachable by
  join. Keep it only where a measured read path justifies it, and say where.
- **A join table with no extra column** for a relation that is really 1:N.
- **A foreign key to a lookup table with a single natural key** and no rows
  that ever change: an enum or a check constraint says the same thing without
  the join.
- **Foreign keys everywhere, defensively** — a constraint added because it felt
  safe, coupling deletion paths nobody has thought through. Every FK implies a
  delete rule; if nobody chose it, it is not a decision.
- **The reverse: integrity enforced only in the application.** A rule the
  database could hold as a constraint but does not is a rule that will be
  broken by the next script, import or console session.
- **An index per column, added defensively.** Dead weight that slows every
  write. See the querying rules above.

## Boundaries

- SQL and ORM live in the infrastructure layer only. The domain speaks
  repositories, never sessions, queries, or connections.
- Parameterized queries only — see `security.md`.
