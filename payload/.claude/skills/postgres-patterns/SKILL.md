---
name: postgres-patterns
description: PostgreSQL indexing strategy, query optimization via B-tree indexes, join algorithms, execution plan analysis (EXPLAIN), pagination patterns (offset vs keyset), window functions, VACUUM/bloat control, and replication for production databases.
origin: "SQL Performance Explained, A Curious Moon"
---

# PostgreSQL Performance Patterns

Query performance depends on index design, join strategy selection, and execution
plan understanding. PostgreSQL's cost-based optimizer picks the wrong plan when
statistics are stale or when no usable index exists — the result is an expensive
full table scan, a bloated table, or an unbounded pagination query. These patterns
target modern PostgreSQL (13+); assume no EOL-version quirks unless noted.

Use this skill when:

- Designing indexes for a new table or query pattern
- Diagnosing a slow query via `EXPLAIN (ANALYZE, BUFFERS)`
- Choosing between offset and keyset pagination
- Reviewing a JOIN that might be an N+1 in disguise
- Investigating table/index bloat or replication lag

## B-Tree Indexes and Structure

PostgreSQL's default index type is B-tree — a balanced search tree combined with
doubly linked leaf nodes so range scans don't need to re-traverse the tree.

**Structure:**

- Branch nodes navigate the tree logarithmically (O(log n) search depth).
- Leaf nodes hold the indexed value plus a pointer (TID) back to the heap row.
- Each node is stored in a database page (8 KB by default).

**Implications:**

- An index on 1 million rows needs ~3-4 tree levels; logarithmic scalability
  keeps lookups cheap even as the table grows.
- Every index adds write cost: INSERT/UPDATE/DELETE must maintain every index
  on the table, not just the primary key.
- An `UPDATE` that changes an indexed column relocates the entry (delete + insert)
  — same cost class as a delete followed by an insert, not a cheap in-place edit.
- Don't index columns nobody filters or sorts on — each unused index is pure
  write overhead and vacuum cost.

```sql
CREATE INDEX idx_sales_date_customer ON sales (sale_date, customer_id);
```

## Composite Index Column Order

A multi-column ("concatenated") index is usable **only via its leftmost
columns** — this is the single highest-leverage indexing decision.

- An index on `(a, b, c)` serves queries filtering on `a`, on `a AND b`, or on
  `a AND b AND c` — never on `b` alone or `c` alone.
- Put **equality** columns before **range** columns. An index on
  `(status, created_at)` serves `WHERE status = 'active' AND created_at > X`
  efficiently; the reverse order `(created_at, status)` forces PostgreSQL to
  scan every row in the date range and filter `status` afterward.
- Column order affects the size of the scanned leaf-node range, not just
  whether the index is used — the most selective equality column first
  minimizes the range walked before filtering.
- One well-ordered composite index usually beats several single-column
  indexes combined via bitmap AND — measure with `EXPLAIN` before assuming.

```sql
-- Serves: WHERE tenant_id = ? AND status = 'open'
-- Also serves: WHERE tenant_id = ?  (leftmost prefix)
-- Does NOT serve: WHERE status = 'open' alone
CREATE INDEX idx_orders_tenant_status ON orders (tenant_id, status);
```

**Pitfall:** reordering an existing composite index to help one query can
silently degrade others relying on the original order — check
`pg_stat_user_indexes` usage before changing it.

## Index Scan Strategies

PostgreSQL's optimizer chooses among scan strategies based on cost estimates,
not fixed rules:

| Strategy | Behavior | Typical trigger |
|---|---|---|
| **Index Scan** | Traverse the B-tree to the first match, walk the leaf-node chain, fetch each row from the heap | Selective predicate, `WHERE col = X` or a narrow range |
| **Index Only Scan** | Traverse the B-tree and return values directly from the index — no heap fetch | All selected columns are present in the index and the visibility map marks the page all-visible |
| **Bitmap Index Scan** | Build a bitmap of matching heap pages from one or more indexes, then fetch in physical order | Moderate selectivity, or combining multiple indexes with AND/OR |
| **Seq Scan** | Read the entire table, filter in memory | Low selectivity (large fraction of rows match), or no usable index |

```sql
-- Efficient: index scan returns few rows
SELECT * FROM users WHERE user_id = 1;

-- Low selectivity: planner correctly prefers a seq scan
-- (returning 40% of a table via an index costs more random I/O
--  than one sequential read)
SELECT * FROM users WHERE country_code = 'FR';
```

**Pitfall:** an index existing doesn't guarantee it gets used — Seq Scan over
an available index usually means the predicate isn't selective enough, or
statistics are stale (`ANALYZE table_name;`).

Use `EXPLAIN (ANALYZE, BUFFERS)` to see rows scanned vs. rows returned, and
whether the plan matches estimated vs. actual row counts.

## JOIN Algorithms and N+1 Prevention

PostgreSQL picks among three join strategies per join node, based on table
size, selectivity, and available indexes:

| Join type | Mechanism | Favored when |
|---|---|---|
| **Nested Loop** | For each outer row, probe the inner table (often via an index) | Outer side is small, or inner side has a usable index |
| **Hash Join** | Build an in-memory hash table from the smaller side, probe with the larger side | No usable index, both sides fit comfortably in `work_mem` |
| **Merge Join** | Sort both sides (or use an existing sorted index) and merge in one pass | Both sides already sorted, or the join drives a downstream `ORDER BY` |

A missing index on a foreign-key join column forces a Hash Join to load an
entire table into memory instead of a targeted Nested Loop lookup.

```python
# ORM N+1 anti-pattern: one query per outer row (nested loop, but in
# application code instead of the database)
for employee in Employee.objects.all():
    print(employee.sales.count())  # one query per employee

# Fixed: single query with an aggregate, or prefetch_related to batch
# the related-table fetch into one extra query total
employees = Employee.objects.prefetch_related("sales")
```

Review generated SQL (Django `connection.queries`, `django-debug-toolbar`) —
repeated identical queries differing only by a bound parameter is the N+1
signature.

## Pagination: OFFSET vs Keyset vs Window Functions

```sql
-- OFFSET pagination: cost grows with the offset — PostgreSQL must
-- still scan and discard the first 1000 rows on every request
SELECT * FROM sales ORDER BY sale_id LIMIT 20 OFFSET 1000;
```

```sql
-- Keyset ("seek") pagination: constant cost regardless of page depth —
-- an index on sale_id makes this an O(log n) lookup, not a scan-and-discard
SELECT * FROM sales WHERE sale_id > :last_seen_id ORDER BY sale_id LIMIT 20;
```

- OFFSET degrades linearly with page depth; deep pagination (page 500 of a
  feed) can dominate query time even with a perfect index.
- Keyset pagination requires a stable, indexed, strictly-ordered cursor column
  (or tuple, e.g. `(created_at, id)` to break ties) — it does not support
  jumping to an arbitrary page number, only "next"/"previous".
- Window functions solve a different problem: ranking or running aggregates
  within a page, not the pagination boundary itself.

```sql
-- Ranking within partitions — not a pagination mechanism by itself
SELECT
    employee_id,
    sale_amount,
    RANK() OVER (PARTITION BY department ORDER BY sale_amount DESC) AS rank
FROM sales;
```

**Pitfall:** combining `OFFSET` with an unindexed `ORDER BY` forces a full
sort of the entire result set before discarding the offset rows — always back
the `ORDER BY` column with an index that matches the sort direction.

## Reading EXPLAIN Plans

Read plans bottom-up, right-to-left: the innermost/rightmost node executes
first, and its output feeds the node above it.

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT e.name, s.amount
FROM employees e
LEFT JOIN sales s ON e.id = s.employee_id
WHERE e.department = 'sales';

-- Hash Left Join (cost=1.05..8.15 rows=6 width=40) (actual time=0.03..0.05 rows=6 loops=1)
--   Hash Cond: (s.employee_id = e.id)
--   ->  Seq Scan on sales s (cost=0..6 rows=100 width=12) (actual time=0.01..0.02 rows=100 loops=1)
--   ->  Hash (cost=1..1 rows=6 width=36)
--         ->  Seq Scan on employees e (cost=0..1 rows=6 width=36) (actual time=0..0.01 rows=6 loops=1)
```

Checklist when reading a plan:

1. Does the scan use the intended index (`Index Scan`/`Index Only Scan`), or
   fall back to `Seq Scan`?
2. Is `actual rows` wildly different from `estimated rows`? A large gap means
   stale statistics — run `ANALYZE`.
3. Are `Sort` nodes present that an index could eliminate (matching
   `ORDER BY`/index order avoids an explicit sort)?
4. Is a JOIN using Hash/Merge where an indexed Nested Loop would be cheaper
   (missing FK index)?
5. With `BUFFERS`, check `shared hit` vs. `shared read` — a high `read` count
   means data isn't cached and each execution pays real disk I/O.

## VACUUM and Bloat

PostgreSQL uses MVCC: an `UPDATE` or `DELETE` doesn't erase the old row
version in place — it marks it dead and leaves it for `VACUUM` to reclaim.
Until vacuumed, dead tuples still occupy heap and index pages ("bloat"),
inflating scan cost and disk usage.

- Autovacuum runs by default — verify it isn't disabled or starved via
  `pg_stat_user_tables.n_dead_tup` and `last_autovacuum`.
- Tables with heavy UPDATE/DELETE churn (queues, session tables, counters)
  need more aggressive autovacuum thresholds than the global default —
  tune per-table with `ALTER TABLE ... SET (autovacuum_vacuum_scale_factor = ...)`.
- `VACUUM` reclaims space for reuse by PostgreSQL; it does **not** shrink the
  file on disk. `VACUUM FULL` does, but takes an `ACCESS EXCLUSIVE` lock and
  rewrites the whole table — never run it on a live table without a
  maintenance window.
- Index bloat compounds heap bloat: a B-tree with many dead entries has
  deeper, sparser leaf chains. `REINDEX CONCURRENTLY` rebuilds without
  blocking reads/writes (PostgreSQL 12+).
- Long-running transactions (including idle-in-transaction sessions) block
  vacuum from reclaiming anything newer than their snapshot — check
  `pg_stat_activity` for stuck transactions before debugging.

```sql
-- Dead tuple ratio per table — a rising trend signals autovacuum is losing
SELECT relname, n_dead_tup, n_live_tup, last_autovacuum
FROM pg_stat_user_tables
ORDER BY n_dead_tup DESC
LIMIT 10;
```

## Replication and High Availability

- Streaming (physical) replication ships WAL records to standby servers;
  standbys apply them continuously and can serve read-only queries
  (hot standby).
- Logical replication ships row-level changes per table/publication — usable
  for selective replication, cross-version upgrades, or feeding a separate
  read-optimized schema, at higher overhead than physical replication.
- Replication lag is a real consistency risk: a client that writes then
  immediately reads from a standby can observe stale data. Route
  read-your-writes paths to the primary, or use synchronous replication
  (`synchronous_commit`, `synchronous_standby_names`) for writes that
  require it — trading latency for durability guarantees.
- Failover requires either a coordinator (Patroni, pg_auto_failover) or
  manual promotion (`pg_ctl promote` / `pg_promote()`) — plan the failover
  path before an incident, not during one.
- Monitor `pg_stat_replication` (primary side) and `pg_last_wal_receive_lsn()`
  / `pg_last_wal_replay_lsn()` (standby side) to quantify lag in bytes, not
  just "seems slow."

## Common Pitfalls Checklist

- [ ] Composite index leads with equality-filtered columns, range columns last
- [ ] `EXPLAIN` shows Index Scan for selective filters; Seq Scan only for low selectivity
- [ ] No N+1 pattern in ORM-generated queries (check `prefetch_related`/`select_related`)
- [ ] Large or deep result sets use keyset pagination, not `OFFSET`
- [ ] `ORDER BY` columns are indexed in the queried sort direction
- [ ] Table statistics are current (`ANALYZE`) before trusting a plan
- [ ] Dead-tuple ratio and autovacuum lag monitored on high-churn tables
- [ ] Index bloat rebuilt via `REINDEX CONCURRENTLY` when scans degrade
- [ ] Replication lag measured in bytes/LSN, not assumed negligible
- [ ] No long-running or idle-in-transaction sessions blocking vacuum
