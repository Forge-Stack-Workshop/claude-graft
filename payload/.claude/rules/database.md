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

## Boundaries

- SQL and ORM live in the infrastructure layer only. The domain speaks
  repositories, never sessions, queries, or connections.
- Parameterized queries only — see `security.md`.
