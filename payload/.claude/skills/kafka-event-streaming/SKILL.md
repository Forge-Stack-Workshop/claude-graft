---
name: kafka-event-streaming
description: Event streaming with Apache Kafka — topics, partitions, producers/consumers, consumer groups, offsets, brokers, replication, Kafka Connect, Streams API, schema registry, and exactly-once semantics for distributed real-time data pipelines.
origin: Apache Kafka in Action (Zelenin & Kropp, Manning 2025)
---

# Kafka Event Streaming

Build and scale real-time data pipelines using Apache Kafka as a distributed, replicated, append-only event log.

## Prerequisites (preflight)

Requires **confluent-kafka**. Verify; warn if missing:

```bash
python -c "import confluent_kafka" 2>/dev/null || echo "WARN: confluent-kafka missing — pip install confluent-kafka"
```

## When to Activate

- Building real-time analytics, fraud detection, or monitoring pipelines
- Ingesting high-volume event streams (thousands to millions of messages/sec)
- Decoupling producers from consumers across services (async, buffered handoff)
- Replicating data between systems, services, or data centers
- Implementing event sourcing or log-based architectures
- Processing unbounded streams with complex stateful logic (joins, windows, aggregates)
- Migrating from monolithic request-response to event-driven architecture
- Creating an audit trail or immutable log of business events

## Core Architecture

### Topics & Partitions

A **topic** organizes related messages into a named channel (like a database table). Topics are divided into **partitions** — independent, ordered logs distributed across brokers. Each partition is replicated across multiple brokers: the **leader** handles all reads/writes; **followers** replicate passively for fault tolerance and never serve clients directly (unless follower-fetching is enabled for rack-aware reads).

Partitions enable parallel consumption and scale-out throughput. Partition count is effectively immutable once set (increasing it later breaks key-to-partition affinity and existing ordering); choose carefully based on target throughput (aim for 1-10 MB/sec per partition, per benchmarking). Messages within a partition are strictly ordered by offset; messages across partitions have no ordering guarantee.

Use **keys** to ensure messages for the same logical entity (e.g., a customer ID or order ID) land in the same partition, preserving causal order. Messages without a key are distributed round-robin (or via the sticky partitioner in modern clients, which batches better). Keys are also the unit of retention in log compaction (only the latest value per key survives).

### Producers

Producers send key-value messages to a topic. A **partitioner** selects the target partition, by default hashing the key (`murmur2(key) % num_partitions`); a custom partitioner can implement domain-specific routing. Producers send asynchronously by default, with a callback per record; `.get()`/`.sync()` blocks for the ack when strict ordering per call matters.

**Delivery semantics (`acks`):**
- `acks=0`: fire-and-forget, no wait for any broker response (zero durability, highest throughput, silent data loss on broker failure)
- `acks=1`: leader acknowledges after writing to its own log (partial durability; a leader crash before replication loses unflushed data)
- `acks=all` (`acks=-1`): leader **and** all in-sync replicas (ISR) acknowledge (strongest guarantee, higher latency; pair with `min.insync.replicas`)

**Key configuration:**

| Setting | Purpose | Notes |
| --- | --- | --- |
| `batch.size` | bytes accumulated per partition before a send | default 16 KB; raise for throughput |
| `linger.ms` | wait time before flushing a batch | default 0; a few ms improves batching under load |
| `compression.type` | `gzip`/`snappy`/`lz4`/`zstd` | trades CPU for network/disk I/O |
| `retries` + `retry.backoff.ms` | resend failed sends | combine with `max.in.flight.requests.per.connection=5` and idempotence to avoid reordering |
| `enable.idempotence` | dedupes retried sends per producer session | prerequisite for exactly-once |

```python
producer = KafkaProducer(
    bootstrap_servers="broker1:9092,broker2:9092",
    acks="all",
    enable_idempotence=True,
    compression_type="lz4",
    linger_ms=5,
    key_serializer=str.encode,
    value_serializer=lambda v: json.dumps(v).encode(),
)
producer.send("orders.events", key=order_id, value=payload)
producer.flush()
```

### Consumers & Consumer Groups

A **consumer** is an application reading messages. A **consumer group** distributes a topic's partitions among its member consumers — each partition is assigned to exactly one consumer within the group at a time, enabling parallel processing. Multiple groups can independently read the same topic at their own pace (fan-out). Adding/removing consumers, or a consumer crash, triggers a **rebalance** that reassigns partitions.

Each consumer tracks its position via an **offset** (the index of the next message to read within a partition). Committed offsets are stored in Kafka's internal `__consumer_offsets` topic, allowing the group to resume from the last committed position after a restart or rebalance.

**Offset commit strategies:**
- Auto-commit (default, `enable.auto.commit=true`): committed periodically in the background — simple, but a crash between processing and the next auto-commit can reprocess or (worse) skip messages
- Manual sync/async commit (`commitSync`/`commitAsync`): explicit commit after successful processing — full control, more code
- Transactional (`read_committed` isolation + transactional producer): commits offsets atomically with downstream writes — required for exactly-once

```python
consumer = KafkaConsumer(
    "orders.events",
    bootstrap_servers="broker1:9092",
    group_id="fraud-detector",
    enable_auto_commit=False,
    auto_offset_reset="earliest",
)
for record in consumer:
    process(record.value)
    consumer.commit()  # commit only after successful processing
```

### Brokers & Cluster Coordination

A **broker** is a Kafka server storing partition replicas and serving read/write requests. A production cluster runs 3+ brokers for fault tolerance. The **controller** broker (elected among the cluster) manages metadata: partition leadership, ISR membership, and reaction to broker failures.

**KRaft** (Kafka Raft) is the modern self-managed consensus protocol that replaced ZooKeeper for metadata coordination. It removes an external dependency, simplifies operations, and scales to far more partitions. ZooKeeper mode is removed as of Kafka 4.0 — all new deployments must use KRaft, and existing ZooKeeper clusters need a migration plan.

## Enterprise Patterns

### Replication & Durability

Each partition replica maintains its own log segment on disk. The **in-sync replica (ISR)** set is the leader plus every follower that has fetched up to the leader's log end offset within `replica.lag.time.max.ms` (default 30s). A follower that falls behind is dropped from the ISR until it catches up — this shrinks the effective durability guarantee even if the nominal replication factor is unchanged.

Configure `min.insync.replicas` (default 1) to enforce a write quorum:
- `min.insync.replicas=2` + `acks=all` guarantees ≥2 copies exist before the producer sees success; if the ISR shrinks below this, produces fail fast (`NotEnoughReplicasException`) rather than silently under-replicating
- Replication factor ≥ 3 is the standard production baseline, tolerating one broker failure while keeping `min.insync.replicas=2`

### Exactly-Once Semantics (EOS)

Kafka's three delivery guarantees, from weakest to strongest:
- **At-most-once**: no retries — a failure drops the message
- **At-least-once** (default with `acks=all` and retries): safe, but reprocessing on retry can duplicate
- **Exactly-once**: combine an **idempotent producer** (`enable.idempotence=true`, deduplicates retried sends within a producer session via sequence numbers) with **transactions** (`transactional.id` set, records and offset commits wrapped in `beginTransaction`/`commitTransaction`) for atomic read-process-write across topics.

Consumers must set `isolation.level=read_committed` to only see committed transactional writes, hiding aborted/in-flight ones. EOS adds coordination latency (transaction markers, two-phase commit) — reserve it for financial transactions, deduplication-critical pipelines, or Streams topologies with exactly-once configured (`processing.guarantee=exactly_once_v2`), not for every pipeline.

### Log Cleanup Strategies

- **Retention policy** (`cleanup.policy=delete`): purge messages older than `retention.ms` or beyond `retention.bytes`; default 7 days — the standard choice for event/fact topics
- **Log compaction** (`cleanup.policy=compact`): retain only the latest value per key, tombstoning deleted keys (`null` value); ideal for changelog/state topics (latest account balance, latest entity snapshot)
- **Compact+delete**: combine both for topics needing bounded retention *and* per-key latest-value semantics

### Kafka Connect

Integrates Kafka with external systems (databases, object stores, search indexes, data warehouses) without custom producer/consumer code. **Distributed mode** runs workers across a cluster, sharing connector tasks for fault tolerance and horizontal scale; **standalone mode** suits single-node dev/test. Connectors are **source** (pull external data into Kafka) or **sink** (push Kafka data to an external system).

Use **SMTs** (Single Message Transforms) for lightweight per-record mapping (renaming fields, masking, routing) before/after the connector boundary. Push complex, stateful, or multi-topic transformations downstream into Kafka Streams instead. Change Data Capture (CDC) connectors (e.g., Debezium) tail a database's write-ahead log and emit row-level changes as Kafka events — a common way to bridge an OLTP database into an event-driven architecture.

### Kafka Streams

A client library for building stream-processing topologies directly against Kafka — no separate processing cluster required. It exposes a DSL over the low-level Processor API.

```java
StreamsBuilder builder = new StreamsBuilder();
KStream<String, Order> orders = builder.stream("orders.events");

orders
    .filter((key, order) -> order.getAmount() > 0)
    .groupByKey()
    .windowedBy(TimeWindows.ofSizeWithNoGrace(Duration.ofMinutes(5)))
    .aggregate(OrderStats::new, (key, order, stats) -> stats.add(order),
               Materialized.as("order-stats-store"))
    .toStream()
    .to("orders.stats.5m");
```

- **Stateless**: `map`, `filter`, `flatMap`, `branch` — no state store, minimal latency
- **Stateful**: `aggregate`, `reduce`, `count`, windowed and stream-table joins — backed by a local **state store** (RocksDB by default), itself backed by a compacted changelog topic for fault-tolerant recovery, and queryable via interactive queries

### Schema Registry

A centralized service that stores and versions message schemas (Avro, Protobuf, or JSON Schema) referenced by producers and consumers via a compact schema ID embedded in each message. Compatibility rules govern how a schema may evolve without breaking existing readers/writers:

| Compatibility mode | Producers can | Consumers can |
| --- | --- | --- |
| `BACKWARD` | evolve freely | read old + new data with the *new* schema |
| `FORWARD` | evolve freely | read old + new data with the *old* schema |
| `FULL` | evolve freely | either direction works |
| `NONE` | anything | no safety net — avoid in production |

Clients validate against the registry before producing/deserializing, catching incompatible changes before they corrupt downstream consumers.

## Common Pitfalls & Solutions

- **Over-partitioning**: too many partitions increases controller metadata overhead and rebalance time (scales roughly with partitions × brokers). Size partitions for target parallelism × expected growth, not "as many as possible."
- **Consumer lag**: monitor `lag = latest offset − committed consumer offset` per partition. Rising lag signals slow processing or too few consumer instances relative to partition count; a consumer group can never have more *active* consumers than partitions.
- **Ordering assumptions**: order is only guaranteed *within* a partition. Route related events to the same key/partition and document the ordering guarantee (or lack of it) at each topic boundary.
- **Rebalance storms**: frequent consumer crashes or slow processing trigger repeated stop-the-world rebalances. Tune `session.timeout.ms` and `heartbeat.interval.ms` for network conditions, and prefer cooperative sticky rebalancing (`CooperativeStickyAssignor`) over eager rebalancing to avoid pausing unaffected partitions.
- **Schema drift**: without a registry, an incompatible schema change breaks deserialization silently downstream. Enforce compatibility rules and reject non-conformant schemas at produce time.
- **Retention misconfiguration**: too short risks data loss for slow/replaying consumers; too long wastes storage and slows leader failover/startup. Size retention against real recovery-time SLAs; use compaction instead of long retention for state topics.
- **Uneven partition/leader distribution**: skewed assignment creates broker hotspots. Use partition reassignment tooling (e.g., a reassignment plan or a rebalancing tool) after adding/removing brokers or topics.
- **Offset commit timing**: auto-commit plus a crash between commit and processing completion causes message loss (offset advanced before the message was actually handled); auto-commit plus a crash before the commit causes duplicates. Choose manual or transactional commits when correctness matters more than simplicity.
- **Producer reordering under retries**: `retries > 0` with `max.in.flight.requests.per.connection > 1` and idempotence disabled can reorder batches on retry. Enable idempotence, or cap in-flight requests to 1 if idempotence is unavailable.

## Deployment & Infrastructure

### Topic Design

- **Naming convention**: lowercase, dot-separated, mirroring domain boundaries (e.g., `orders.events`, `orders.state.changelog`). Separate immutable event streams from mutable state/changelog topics.
- **Sizing**: start conservative (a handful of partitions) and scale up only when monitoring shows a throughput or consumer-parallelism bottleneck — remember partition count cannot be safely reduced later, and increasing it changes key-to-partition mapping for existing data.

### Cluster Sizing

A production cluster needs ≥3 brokers for fault tolerance. Baseline per broker: substantial RAM with a modest JVM heap (the OS page cache does most of the read-path work), SSD-backed storage for logs, and a dedicated high-bandwidth network path (replication traffic is significant). Estimate storage as `average message size × messages/sec × retention seconds × replication factor`.

### Monitoring & Alerting

Essential metrics:
- **Producer**: messages/sec, error rate, request/response latency (p50/p99)
- **Broker**: disk I/O and free space, network throughput, CPU, GC pause time, under-replicated partition count
- **Consumer**: consumer lag per partition, fetch latency, offset commit rate/failures
- **Cluster**: ISR shrink/expand events, controller elections, broker availability

Typical alert thresholds: consumer lag exceeding a few minutes of expected processing time, replication lag beyond `replica.lag.time.max.ms`, broker disk usage above 80%, or an error-rate spike relative to baseline.

## Operations Checklist

- [ ] Topics created with partition count matching throughput targets and consumer parallelism needs
- [ ] Replication factor ≥ 3 for production, with `min.insync.replicas` set to enforce the durability SLA
- [ ] Producer `acks` and idempotence settings match the durability requirement (`acks=all` + idempotence for exactly-once)
- [ ] Consumer groups sized so partition count ≥ number of active consumer instances
- [ ] Offset commit strategy (auto/manual/transactional) chosen deliberately and tested against crash scenarios
- [ ] Retention and compaction policy documented per topic and validated against recovery-time SLAs
- [ ] Schema registry deployed with compatibility rules enforced for every producing/consuming client
- [ ] Monitoring covers consumer lag, broker resource metrics, replication lag, and error rates, with alerts wired
- [ ] Disaster recovery plan (backups, cross-cluster replication, multi-cluster failover) documented and tested
- [ ] Partition/leader reassignment plan ready for cluster growth or broker removal
- [ ] Cluster runs on KRaft (ZooKeeper mode is removed as of Kafka 4.0)
