---
name: sqlalchemy-patterns
description: SQLAlchemy architecture patterns, engine/connection lifecycle, session management, ORM vs Core, lazy/eager loading, relationships, query optimization, and Alembic migrations for production relational databases.
origin: Essential SQLAlchemy (O'Reilly), SQLAlchemy 2.0 docs
---

# SQLAlchemy Patterns

Master both layers of SQLAlchemy: the Core (SQL expression language, engine,
connections) and the ORM (declarative mapping, sessions, relationships).
Drop into Core or raw SQL when the ORM adds no value; use the ORM's unit-of-work
for object-graph persistence. This skill targets **SQLAlchemy 2.0-style** APIs —
prefer them over legacy 1.x idioms even in mixed codebases.

## Prerequisites (preflight)

Requires **sqlalchemy** and **alembic**. Verify; warn if missing:

```bash
python -c "import sqlalchemy; import alembic" 2>/dev/null || echo "WARN: sqlalchemy or alembic missing — pip install sqlalchemy alembic"
```

## When to use

- Mapping Python classes to relational schemas (ORM) or writing SQL expressions
  directly (Core) without an intermediate ORM layer.
- Managing engine/connection pooling and transaction boundaries in production.
- Designing relationships and loading strategies that avoid N+1 queries.
- Versioning schema changes with Alembic, including zero-downtime migrations.
- Diagnosing session-scope bugs, stale-object errors, or connection leaks.

## When NOT to use

- Non-relational stores (NoSQL, document DBs, key-value) — use driver-specific
  tools instead.
- Simple scripts that never need transactions, pooling, or a schema — a bare
  `sqlite3`/driver call may be simpler.
- Analytical/OLAP workloads where a dedicated query engine (DuckDB, Polars) is
  a better fit than row-oriented ORM access.

## Core vs ORM — pick the right layer

| Layer | Use for | Style |
| --- | --- | --- |
| **Core** | Bulk operations, reporting queries, cross-table joins without object identity, raw performance-critical paths | `select()`, `insert()`, `update()`, `Table` metadata |
| **ORM** | Object-graph persistence, unit-of-work semantics, business logic operating on domain objects | `Session`, declarative classes, `relationship()` |

Both share the same `select()`/`insert()`/`update()`/`delete()` constructs in
2.0 style — the ORM is a persistence layer *on top of* Core, not a separate
query language. A `Session.execute(select(User))` call goes through the exact
same expression compiler as a Core-only `select(users_table)`.

```python
from sqlalchemy import select

# Core: operates on Table objects, returns rows
stmt = select(users_table.c.id, users_table.c.name).where(users_table.c.active.is_(True))
result = connection.execute(stmt)

# ORM: operates on mapped classes, returns entities
stmt = select(User).where(User.active.is_(True))
result = session.execute(stmt).scalars().all()
```

**Pitfall**: don't reach for the ORM to run a one-off aggregate report over
millions of rows — instantiating ORM objects for read-only aggregation wastes
memory and CPU. Use Core (`select(func.count()).select_from(...)`) or
`session.execute(stmt).mappings()` to get lightweight dict-like rows without
hydrating full entities.

## Engine & connections (foundation)

**Engine**: factory for DB connections; thread-safe; owns a connection pool.
Create exactly one `Engine` per database per process — never per-request.

```python
from sqlalchemy import create_engine

engine = create_engine(
    "postgresql+psycopg://user:pass@host/dbname",
    pool_pre_ping=True,   # validate connection before checkout — avoids stale-connection errors
    pool_recycle=1800,    # recycle connections older than 30 min (avoids DB-side idle timeouts)
    pool_size=10,
    max_overflow=20,
    echo=False,           # True only for local debugging — logs every statement
)
```

Use a `Connection` (via `engine.connect()`) for Core-level, explicit
transaction control; the engine checks a pooled connection back in when the
context manager exits.

```python
with engine.connect() as connection:
    result = connection.execute(select(users_table))
    connection.commit()  # explicit commit required in 2.0 "future" style
```

**Pitfall**: creating a new `Engine` per request/task exhausts DB connection
slots — pools are never shared across engines. Keep the engine as a
module-level singleton or injected dependency, not a per-call construct.

## Session (ORM transaction scope)

**Session**: unit-of-work + identity map. It is NOT a connection — it acquires
one from the engine's pool only when needed, and returns it at transaction end.

```python
from sqlalchemy.orm import Session, sessionmaker

SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)

with SessionLocal() as session:
    session.add(User(name="ada"))
    session.commit()   # flush + commit; auto-rollback on unhandled exception
```

Rules of thumb:

- One `Session` per logical unit of work (one request, one background job) —
  never a long-lived, shared, or global session.
- Always use the context manager (`with Session(...) as session:`) so the
  session closes and its connection returns to the pool even on error.
- `session.add()` stages an object; nothing hits the DB until `flush()`
  (implicit before queries/commit) or explicit `commit()`.
- `expire_on_commit=False` avoids re-querying attributes after commit when the
  caller needs to keep using the object past the transaction — evaluate the
  trade-off (staleness) case by case.

**Pitfall — session scope leakage**: binding a session to a global variable or
a long-lived request context and reusing it across unrelated transactions.
Symptoms: `DetachedInstanceError`, objects reflecting stale state, hard-to-
reproduce cross-request bugs. Fix: dependency-inject a fresh session per unit
of work (e.g., FastAPI `Depends`, Django request middleware scoping one
session per request).

## Declarative mapping (2.0 style)

Use `DeclarativeBase` + `Mapped[...]`/`mapped_column()` — not the legacy
`Column()`-only style, which loses static type inference.

```python
from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    email: Mapped[str | None] = mapped_column(String(255), unique=True)
    posts: Mapped[list["Post"]] = relationship(back_populates="author")


class Post(Base):
    __tablename__ = "posts"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    author: Mapped[User] = relationship(back_populates="posts")
```

`Mapped[X | None]` communicates nullability directly in the type; `mapped_column`
carries only DB-level concerns (length, index, default). Keep both in sync —
a nullable Python type with a non-nullable column (or vice versa) is a common
review-time bug.

## Relationships — lazy vs eager loading

**Lazy (default)**: related objects fetch on first attribute access, inside
whatever session is still open. Convenient, but the classic N+1 source.

```python
users = session.execute(select(User)).scalars().all()
for user in users:
    print(user.posts)  # 1 query per user — N+1 if there are N users
```

**Eager loading**: fetch related rows in the same or a follow-up batched
query, chosen per-relationship via loader options on the `select()`.

| Strategy | SQL shape | Use when |
| --- | --- | --- |
| `selectinload()` | Separate `IN (...)` query per relationship | One-to-many, avoids row duplication, usually the best default |
| `joinedload()` | Single `LEFT OUTER JOIN` | Many-to-one / one-to-one, small result sets |
| `contains_eager()` | You wrote the join yourself | Custom filtered joins where the ORM should reuse your `JOIN` |
| `subqueryload()` | Correlated subquery | Legacy — prefer `selectinload()` in 2.0 |

```python
from sqlalchemy.orm import selectinload

stmt = select(User).options(selectinload(User.posts))
users = session.execute(stmt).scalars().unique().all()
for user in users:
    print(user.posts)  # already loaded — no extra query
```

**Pitfall**: `joinedload()` on a one-to-many relationship duplicates the
parent row per child — always pair with `.unique()` on the result, or prefer
`selectinload()` to sidestep the duplication entirely.

Set a relationship's default loader with `lazy="selectin"` in the mapping
itself when that access pattern is the common case app-wide — but always
allow overriding per-query with `.options()` for exceptions.

## Querying patterns (2.0 style)

Always build queries with `select()`, executed via `session.execute()` — the
old `Session.query()` API is legacy and should not appear in new code.

```python
from sqlalchemy import select, func

# Filter + order + limit
stmt = (
    select(User)
    .where(User.active.is_(True))
    .order_by(User.name)
    .limit(20)
)
users = session.execute(stmt).scalars().all()

# Aggregate without hydrating entities
stmt = select(func.count()).select_from(User).where(User.active.is_(True))
active_count = session.execute(stmt).scalar_one()

# Join with explicit ON clause
stmt = (
    select(User.name, Post.title)
    .join(Post, Post.author_id == User.id)
    .where(Post.published.is_(True))
)
rows = session.execute(stmt).all()
```

- `.scalars()` unwraps single-entity rows; `.all()` / `.one()` / `.one_or_none()`
  / `.first()` control cardinality expectations — pick the one matching your
  invariant instead of manually checking list length.
- Prefer parameterized filters (`.where(User.id == user_id)`) — never
  string-format SQL. Use `text("... WHERE id = :id").bindparams(id=user_id)`
  only when a raw fragment is unavoidable.
- Use `.execution_options(yield_per=1000)` (or `Session.stream()`) for
  large result sets instead of loading everything into memory.

## Bulk operations

Per-object `.add()` + `.commit()` loops do not scale. Use bulk constructs for
batch writes:

```python
from sqlalchemy import insert, update

session.execute(insert(User), [{"name": "a"}, {"name": "b"}, {"name": "c"}])
session.execute(update(User).where(User.active.is_(False)).values(archived=True))
session.commit()
```

These bypass per-row ORM unit-of-work overhead (no individual `INSERT`/`UPDATE`
statements, no identity-map churn) while still going through the same engine
and transaction.

## Alembic migrations (schema versioning)

```bash
alembic init migrations
alembic revision --autogenerate -m "add users.email"
alembic upgrade head
alembic downgrade -1
```

- **Never trust autogenerate blindly** — it misses renames (sees them as
  drop+add), default-value changes on some backends, and check constraints.
  Review every generated migration before applying it.
- **Reversibility**: every migration should implement both `upgrade()` and a
  working `downgrade()` — test the downgrade path, not just upgrade.
- **Zero-downtime pattern** for adding a required column on a live system:
  1. Add the column nullable (or with a server default).
  2. Deploy application code that writes the new column.
  3. Backfill existing rows in batches (not a single giant `UPDATE`).
  4. Add the `NOT NULL` constraint in a follow-up migration once backfill
     is confirmed complete.
- Keep one logical schema change per migration file — squash exploratory
  migrations before merging, never after they've run in production.

## Common pitfalls

1. **N+1 queries** — missing `selectinload()`/`joinedload()` on a relationship
   accessed in a loop. Detect with `echo=True` or a query-count assertion in
   tests; fix with an explicit loader option matching the access pattern.

2. **Session scope leakage** — a session bound to a global/module or reused
   across unrelated transactions. Fix: one session per unit of work, always
   via context manager.

3. **Mutable/shared column defaults** — `mapped_column(default=[])` shares one
   list instance across all rows. Fix: pass a callable (`default=list`) or use
   a mutable-tracking type (`MutableList.as_mutable(ARRAY(...))`) if in-place
   mutation must be detected by the unit of work.

4. **SQL injection via string formatting** — building filters with f-strings
   or `%`-formatting instead of bound parameters. Fix: ORM filter expressions
   or `text(...).bindparams(...)`.

5. **`joinedload()` row duplication** — forgetting `.unique()` after a
   `joinedload()` on a collection relationship, producing duplicate parent
   entities in the result.

6. **Detached instance access** — reading a lazy-loaded attribute on an object
   after its session closed. Fix: eager-load what the caller needs before the
   session closes, or re-attach with `session.merge()`.

7. **Engine-per-request** — instantiating `create_engine()` inside a request
   handler instead of once at startup, exhausting DB connections under load.

8. **Blind autogenerate migrations** — applying Alembic-generated DDL without
   reviewing for missed renames or backend-specific quirks.

## Review checklist

- [ ] Query layer uses 2.0-style `select()`/`session.execute()`, not legacy `Session.query()`
- [ ] One `Engine` per process/database, created at startup, not per-request
- [ ] One `Session` per unit of work, always via context manager
- [ ] Relationships accessed in loops have an explicit eager-load strategy
- [ ] `joinedload()` on collections is paired with `.unique()`
- [ ] Bulk writes use `insert()`/`update()` constructs, not per-object `.add()` loops
- [ ] `pool_pre_ping=True` and a sane `pool_recycle` are set
- [ ] All filters are parameterized — no string-built SQL
- [ ] Every Alembic migration has a working, tested `downgrade()`
- [ ] Non-nullable column additions follow the nullable→backfill→NOT NULL sequence
- [ ] Autogenerated migrations were reviewed by hand before merge
