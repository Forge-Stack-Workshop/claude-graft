---
name: django-migration-forensics
description: Use when a Django migration is missing, unclear, risky to deploy, or diverged from the models — when `makemigrations` wants changes nobody wrote, when a migration touches a large table, or when reviewing a migration before it ships. Reads models, migration graph and schema, reports what the migration really does and what it will lock or lose, and never runs a migration on its own initiative.
---

# Reading a Django migration for what it actually does

A migration is the one change that runs against real data with a lock held. The
file says what the developer intended; the schema and the graph say what will
happen. Where they disagree is the finding. This reads all three and reports —
it never runs `migrate` or writes a migration unless the developer asks.

## 1. Is the graph consistent with the models?

```
python manage.py makemigrations --check --dry-run
```

If it wants changes, something is undeclared: a model edited without a
migration, or a field default/`choices` change Django tracks. Name the app and
the model. A missing migration merged to a shared branch is the highest-value
find — it breaks the next person's `migrate`.

Then check the graph itself:

```
python manage.py showmigrations --plan | tail -30
```

Look for multiple leaf nodes on one app (two heads → a merge migration is
needed) and cross-app dependencies that force an order.

## 2. What will this migration lock or lose?

Read the operation list. Classify each against what it costs on a large table:

- **Data loss** — `RemoveField`, `DeleteModel`, `AlterField` narrowing a type or
  length. Irreversible in practice even with a reverse op. Flag every one.
- **Table lock / rewrite** — adding a non-nullable column with a default on a
  large table, changing a column type, adding an index without
  `AddIndexConcurrently`. Name the table's rough size if known; a lock on a hot
  table is an outage.
- **Non-reversible** — a `RunPython` with no reverse, or a `RunSQL` without the
  reverse SQL. Say so; a deploy that cannot roll back is a decision, not a
  default.
- **Data + schema in one migration** — a `RunPython` data backfill in the same
  file as the schema change. These often need to be separate deploys (add
  column → backfill → enforce not-null). Propose the split.

## 3. Does the migration match the model it claims to?

Read the model and the migration side by side. A field that is `null=True` in
the model but the migration makes `NOT NULL`, a default that differs, a
constraint in one and not the other — that gap ships a schema the application
does not expect.

## 4. Report, then let the developer decide

For each finding: **what the operation is**, **what it costs** (the lock, the
lost column, the failed rollback — concrete, not the principle), and **the safer
shape** if there is one (concurrent index, split deploy, explicit reverse).

Then stop. **Never run `migrate`, never edit or squash a migration on your own
initiative** — order, timing, lock and rollback are a deploy decision the person
owns. Propose the fix as a diff; they run it.

## 5. If asked to fix

Only then: write the migration or the reverse op, keep data and schema changes
in separate migrations when the table is large, and prefer the concurrent /
non-locking form. Re-run `makemigrations --check` after, and say whether the
graph is clean.
