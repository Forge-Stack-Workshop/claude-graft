---
name: data-architecture
description: Medallion (bronze/silver/gold) lakehouse architecture patterns, Delta-style table format mechanics (ACID transactions, time travel, schema evolution, merge/upsert), data quality and validation techniques, ETL vs ELT patterns, and data governance (lineage, cataloging, PII/access control) for building analytical data platforms.
origin: biblio
---

# Data Architecture

Patterns for organizing raw, cleansed, and business-ready data on a lakehouse
platform, and for keeping that data trustworthy, governed, and query-efficient
as it moves through the pipeline.

## When to Activate

- Designing or reviewing a bronze/silver/gold (medallion) data pipeline
- Choosing between a data warehouse, data lake, and lakehouse for a new platform
- Deciding where data quality checks, deduplication, or PII masking should live
- Modeling curated data (star schema vs one-big-table vs data vault)
- Configuring table-format features: schema evolution, time travel, merge/upsert,
  change data capture/feed, file compaction, partitioning/clustering
- Setting up data governance: cataloging, lineage, access control, data products
- Reviewing an ETL/ELT pipeline for idempotence, coupling, or ownership issues

## Layer Responsibilities (Bronze / Silver / Gold)

Layers are **logical**, not physical — there is no universally correct number
of sublayers. Design sublayers to the organization's needs, not to a diagram.

### Bronze — raw, immutable, technically valid

- Stores data in its original structure: a queryable reservoir for raw data,
  the single source of truth and historical record.
- Append-only / merge-by-business-key only — never update rows in place.
  Historization here is folder/partition-based (e.g. `YYYY/MM/DD`), not SCD2.
- Validation is **technical only**: format, schema, completeness — not business
  rules. Two philosophies:
  - **Intrusive**: halt the pipeline or route bad records to a quarantine area
    *before* they reach bronze.
  - **Nonintrusive**: let both good and bad records land in bronze and fix
    issues downstream in silver.
- Classify/mask/encrypt PII as data lands — governance starts at ingestion,
  not later.
- Not meant for direct business/ad hoc use — it's too tightly coupled to the
  source system's own structure and quirks.

### Silver — cleansed, standardized, still per-source

- Cleanses, standardizes, and deduplicates data while staying granular and,
  by default, **aligned with the source system** — defer cross-source
  integration to gold.
- **Do not prematurely cross-join data from different source domains here.**
  It creates coupling between application domains that outlives the pipeline
  that introduced it. If the organization deliberately wants silver to be a
  classic integration layer, use 3NF or data vault modeling there instead of
  drifting into it by accident.
- Typical work: rename columns to consistent names + document with column
  comments, standardize formats/units/casing, fix types/ranges/uniqueness,
  correct errors, trim whitespace, deduplicate, mask PII, apply master data
  management, and add *lightweight* enrichments (geocoding, unit conversion,
  simple aggregation). Complex business logic stays out of silver.
- Failed/rejected rows go to a sibling **quarantine table**, never to `/dev/null`.
- Surrogate keys and full slowly-changing-dimension (SCD2) historization
  belong more naturally in gold, built when sources are merged into a
  dimensional model — unless silver itself needs authentic per-source history
  for ML or operational reporting.
- Data vault modeling (hubs = business keys, links = relationships,
  satellites = descriptive attributes) suits high-integration, fast-changing
  schemas, but costs more to build and maintain than denormalized tables.

### Gold — curated, business-ready, optimized for consumption

- Business-ready data for reporting, analytics, decisioning: aggregated,
  enriched, with complex business logic applied. Optimized for performance,
  usability, and scale.
- **Star schema** (Kimball) is the default pattern: build dimensions before
  facts (facts need dimension surrogate keys); handle "early arriving facts"
  with a placeholder dimension row created on demand. Speed up dimension
  loads with change-detection hash columns (e.g. one hash per SCD1 field set,
  one per SCD2 field set) plus creation/update timestamps.
- **One-Big-Table (OBT)**: a single denormalized table, simpler and often
  faster for specific access patterns and favored by data science/ML
  workloads — but nested-field aggregation gets awkward, duplication grows,
  and schema changes usually mean a full table rebuild.
- A "serving layer" downstream of gold (a separate store optimized for one
  consumer's access pattern or security boundary) is a normal, not a smell.

## Lakehouse vs Warehouse vs Data Lake

- **Data warehouse** era: normalized (Inmon, top-down, single enterprise
  model) or dimensional (Kimball, bottom-up, conformed dimensions as the
  integration mechanism) — great for BI, poor for cheap large-scale/unstructured
  storage.
- **Data lake** era: schema-on-read, cheap object storage, but no ACID
  transactions, a severe small-files problem (metadata overhead scales with
  file count, not data volume — a directory of 1KB files can cost orders of
  magnitude more storage-system metadata than the same volume in
  larger files), and slow disk-bound batch compute.
- **Lakehouse** = open table format (transaction log over columnar files) +
  in-memory/distributed compute + cheap object storage. Gets ACID,
  time travel, and schema enforcement on top of lake economics.
- Medallion architecture is a **logical design pattern for organizing data
  inside a lakehouse** — not a new architecture family. It reuses warehouse
  modeling lessons; schema-on-read does **not** remove the need for data
  modeling — treating it as if it does is a common and costly misconception.

## Table Format Mechanics (ACID, Time Travel, Schema Evolution)

- **ACID via a transaction log**: every mutation (insert/update/delete/
  optimize/schema change) is an ordered, atomic commit recorded in a log
  directory as sequential entries. The table's current state is derived by
  replaying the log, not by mutating files in place.
- **Time travel**: query a prior version of the table by version number or
  timestamp, bounded by a configurable log-retention window. This is for
  **recovery, audit, and reproducing an experiment** — not a substitute for a
  real historical model. Diffing two versions typically requires a full scan
  of both, so use SCD2 for genuine "what did this look like on date X" query
  patterns.
- **Restore/rollback**: revert a table to a prior version after a bad load —
  cheaper and safer than manual backfill.
- **Compaction (`OPTIMIZE`-style operations)**: merge many small files into
  fewer larger ones. Skipping this reintroduces the data-lake small-files
  problem inside a lakehouse table.
- **Data-skipping clustering** (Z-order or equivalent): physically co-locates
  rows by one or more columns so predicates on those columns skip files
  entirely. Most valuable on large tables (100GB+); can't combine with
  partitioning on the *same* column. Newer "liquid"/dynamic clustering
  variants avoid committing to a fixed layout up front and re-cluster
  incrementally as query patterns and cardinality change.
- **Partitioning**: physical directory-level splitting (commonly by date) for
  very large tables; complements, doesn't replace, clustering.
- **Schema evolution**: an explicit "merge schema" write option adds new
  columns (existing rows get null) and tolerates missing columns on new rows;
  incompatible type changes fail loudly and require a full-table rewrite with
  an explicit "overwrite schema" flag — never a silent one.
- **Merge/upsert**: a single atomic `MERGE`-style statement combines insert +
  update + status-flag logic (e.g. flip an `is_current` flag while inserting
  the new current row) instead of separate delete+insert steps.
- **Append mode**: pure inserts, no update/delete handling — appropriate for
  logs, streaming, and other naturally immutable event data. Never use append
  without a prior truncate or dedup step when the source can redeliver rows —
  that's how duplicates silently accumulate.
- **Change data feed vs change data capture**: a table-level *change feed*
  exposes row-level changes made *inside* the lakehouse table for downstream
  incremental consumers; *change data capture* reads a source database's own
  transaction log to replicate changes into the lakehouse. Don't conflate them.
- **Idempotence** is a first-class design goal for every pipeline step: a
  merge or append-with-truncate should be safely re-runnable with the same
  result. Re-running should never double-count.

## Data Quality Techniques

- Split validation by layer: **technical** (format/schema/completeness) at
  bronze, **functional/business** (accuracy, consistency, business rules) at
  silver. Don't ask bronze to enforce business rules or silver to skip
  technical ones.
- **Quarantine, don't drop.** Route rows failing validation to a sibling
  quarantine table rather than deleting them — auditability matters as much
  as correctness.
- **Threshold-based pipeline halting**: count validation failures and stop
  the pipeline (rather than silently propagating bad data downstream) when
  an error-rate threshold is breached.
- Cleaning taxonomy to check systematically: noise/inauthentic-data removal,
  missing-value handling (drop/default/impute), deduplication, whitespace
  trimming, typo/outlier correction, unit/terminology consistency, date/format
  standardization, type correction, range and uniqueness validation,
  referential/orphan-record checks, PII masking, anomaly detection, and
  master-data conformance.
- **Fix data quality at the source system when possible.** Patching the same
  issue downstream release after release is a symptom, not a fix.
- Run an explicit anomaly/consistency check after any non-deterministic
  enrichment step (e.g. an LLM-based enrichment) — never trust it blind.
- Choose the validation tool by what you need: a declarative expectations
  library to validate/document data quality without owning transformation; a
  SQL-templated transform tool with built-in testing/lineage for tests
  co-located with models; a fully declarative managed pipeline tool for
  bundled orchestration/DQ/error-handling (at the cost of lock-in); or plain
  dataframe/SQL code for flexibility at the cost of building lineage/testing
  yourself.

## ETL vs ELT

- Classic warehouse ETL: stage → transform (cleanse, enrich, apply master
  data, assign keys) → load into the integration/presentation layer.
- Lakehouse/medallion pipelines lean ELT: land raw data with a permissive
  schema, then progressively transform it in place across the layers,
  leaning on cheap storage and schema evolution to defer strict schema
  commitments.
- Combine a change feed with merge/upsert to process only what changed since
  the last run instead of reprocessing full extracts.
- Two ingestion patterns: **full load** (replace or accumulate the entire
  extract each run — simple, wasteful at scale) and **incremental/delta
  load** (only new/changed records, needs a reliable "last modified" or
  incrementing key, or change data capture when the source can update old
  records out of order).
- Not all pipeline stages automate equally well: the source→bronze step is
  hard to templatize because sources are heterogeneous, and the
  silver→gold step is hard to templatize because business logic is bespoke.
  The bronze→silver step (renaming, filtering, lookups, defaulting) is the
  one that benefits most from a metadata-driven/parameterized framework —
  don't force the other two into the same mold just for consistency.

## Data Governance

- Governance sits as a layer across the whole pipeline, not as a gate at the
  end: classify and encrypt at ingestion (bronze), keep ownership aligned and
  audited at silver, sign off on stable interfaces at gold.
- **PII handling**: encrypt/classify before data lands in bronze; mask in
  silver; define sensitivity classification schemas org-wide up front, not
  per pipeline; use row/column-level masking (e.g. secure views) and
  role- or attribute-based access control.
- **Ownership model**: an application owner (handles collection issues) and a
  data owner (handles quality/sharing decisions) per source system; group
  sources into domains with a domain owner (can be the same person).
- **Data products**: catalog entities that package tables/files/reports with
  metadata describing structure, lineage, and ownership — the mechanism that
  connects a governance domain to its underlying technical assets. Without
  clear ownership guidelines, a catalog fills up with duplicate or
  conflicting data products describing the same underlying table.
- **Cataloging**: prefer a centralized, multi-workspace-aware catalog with a
  three-level namespace (catalog → schema → table) over a per-workspace
  metastore that can't be shared cleanly across teams.
- **Lineage** is not optional tooling sugar — it's what lets you trace a
  dependency chain across silver sublayers (cleansing → feature engineering →
  master data) during an incident, and what auditors/compliance actually ask
  for.
- **Data contracts** have no standardized industry definition — define the
  term explicitly for your organization before using it, or producer and
  consumer teams will silently disagree about what it means.
- Treat governance maturity as **incremental**: it is a progression, not a
  one-time completeness bar to hit before shipping.

## Common Pitfalls

- Treating schema-on-read as removing the need for data modeling.
- Cross-joining data from different source domains inside silver "just
  because it's convenient" — creates lasting coupling between domains.
- Letting bronze accumulate SCD2/full historization logic — it should stay
  immutable and append-only, not become a pseudo-warehouse.
- Using append without a prior truncate or dedup check, breaking idempotence.
- Ignoring file compaction and letting the small-files problem creep back
  into a lakehouse table.
- Treating time travel/transaction-log diffing as a historical query
  substitute for SCD2 — it doesn't scale and isn't the tool for that job.
- Defaulting to normalized/data-vault modeling in silver without weighing the
  real join costs at cloud scale — denormalized wide tables are often the
  more practical choice despite redundancy.
- Skipping data modeling discipline in a decentralized ownership model —
  distributed teams left to define their own models converge on slightly
  incompatible schemas that become entrenched across pipelines and products.
- Letting every team stand up its own duplicate medallion platform instead of
  consolidating overlapping consumer needs into a shared providing domain.
- Ambiguous data-product ownership in the catalog, producing duplicate or
  conflicting entries for the same underlying asset.
- Hardcoding credentials in pipeline code/notebooks instead of using a
  secret store.
- Defining medallion layer responsibilities too theoretically or copying a
  vendor's default zone names without codifying explicit, org-wide standards
  for what belongs in each layer.
