---
name: system-design
description: System design principles for scalable, reliable distributed systems. Load balancing, caching strategies, database sharding, message queues, rate limiting, CAP theorem, consistency models, CDN architecture, graceful degradation, and notification services.
origin: "Zhiyong Tan. *Acing the System Design Interview*. Manning Publications, 2024."
---

# System Design — Scalability & Reliability

Design systems that scale horizontally, tolerate failure, and maintain consistency under load. Core patterns: **load balancing**, **caching tiers**, **database sharding/replication**, **message queues**, **rate limiting**, **CDN edge distribution**, and **graceful degradation**.

## When to Activate

- Designing distributed systems for traffic peaks or geographic distribution
- Evaluating system reliability under failure scenarios (node crashes, network partitions)
- Optimizing latency with caching and edge delivery
- Implementing multi-tenant platforms with resource isolation
- Planning database growth beyond single-machine capacity
- Building notification systems, search backends, or real-time services
- Reviewing production incident runbooks and rollback strategies
- Preparing for or conducting a system design interview

## Method: How to Approach Any System Design Problem

1. **Clarify requirements.** Functional (what the system does) vs. non-functional
   (scale, latency, availability, consistency). Ask for numbers: DAU, QPS, read/write
   ratio, payload size, growth rate. Silence on these means guessing later — pin them
   down first.
2. **Estimate scale.** Back-of-envelope math: storage/year, peak QPS (avg × 2–5 for
   spikes), bandwidth. Round generously; the goal is choosing the right order of
   magnitude of architecture (single DB vs. sharded, single region vs. multi-region).
3. **Define the API / data model first.** Endpoints or events, request/response
   shapes, core entities and relationships. This anchors every later component.
4. **Sketch the high-level architecture.** Client → load balancer → stateless
   service tier → cache → database → async workers. Add only the components the
   requirements justify.
5. **Deep-dive the 1–2 hardest components.** Pick what's most novel or riskiest
   (e.g., the sharding key, the fanout strategy, the consistency model) and go deep;
   don't spread shallow detail evenly across everything.
6. **Identify bottlenecks and single points of failure.** For each component, ask:
   what happens at 10x load? What happens if this node dies?
7. **State trade-offs explicitly.** Every choice (consistency vs. availability,
   normalization vs. join cost, push vs. pull) has a cost — name it, don't hide it.

## Core Techniques

### Horizontal Scaling & Load Balancing

- **Stateless services** enable replicas behind load balancers (round-robin, least-connections, weighted).
- **Layer 4 vs. Layer 7 LB**: L4 (TCP/IP) is fast, protocol-agnostic; L7 (HTTP-aware) enables path-based routing, header inspection, and richer health checks — pick per need, not by default.
- **Session affinity** ("sticky sessions") needed when state must pin to one replica — adds coupling; prefer externalizing session state (Redis) so any replica can serve any request.
- **Consistent hashing** for cache/shard layer scaling: new nodes adopt proportional, minimal data shuffle instead of a full rehash.
- **Service discovery** (DNS, Consul, Kubernetes DNS/Service) decouples client from replica IPs; combine with health checks so the LB routes only to live instances.
- **Auto-scaling** triggers on CPU/queue-depth/custom metrics; set both scale-up and scale-down thresholds to avoid flapping.

### Caching Layers

- **HTTP caching headers** (`Cache-Control`, `ETag`, `Last-Modified`) cache at browser/CDN, reduce origin load without a dedicated cache service.
- **In-process/remote cache** (Redis, Memcached) for hot data — trade memory for latency, expire aggressively.
- **Cache placement patterns**:
  - *Cache-aside* (lazy load): app reads cache, falls back to DB on miss, then populates cache. Simple, but first request after eviction pays full latency.
  - *Write-through*: every write updates cache and DB synchronously. Reads always fresh; writes slower.
  - *Write-behind*: write to cache, flush to DB asynchronously. Fast writes; risk of data loss on cache crash before flush.
- **Invalidation patterns**: TTL (simple, bounded staleness), event-driven (message queue on write triggers invalidation), version/ETag-based (client revalidates cheaply).
- **Cold-start penalty**: prefill cache on deploy or accept initial slowness; avoid the **thundering herd** (cache stampede) — many concurrent misses hammer the DB on the same key. Mitigate with request coalescing (single in-flight fetch per key) or jittered TTLs.

### Database Sharding & Replication

- **Range-based sharding** (user ID 1–1M on shard-1, 1M–2M on shard-2) — simple routing, but uneven load if activity skews to recent ranges ("hot shard").
- **Hash-based / consistent-hash sharding** — even distribution, redistributes data on shard failure/addition, but requires rebalancing tooling.
- **Directory-based sharding** — a lookup service maps keys to shards; flexible rebalancing, but the directory itself is a new SPoF/bottleneck unless replicated.
- **Vertical sharding / functional partitioning** (split by feature: users DB, orders DB) — isolates blast radius per domain, but cross-shard joins become expensive app-level fan-out.
- **Query routing layer** must know the shard key; a centralized "shard oracle" that every query hits is an anti-pattern — push the key resolution to the client/service layer instead.
- **Replication** for read scaling and durability:
  - *Leader-follower (primary-replica)*: writes to leader, reads can go to followers (replication lag risk — "read your own write" problem after an update).
  - *Multi-leader*: writes accepted in multiple regions, needs conflict resolution (last-write-wins, CRDTs, application merge).
  - *Leaderless (quorum-based, e.g. Dynamo-style)*: write/read quorums (W + R > N) trade latency for consistency tunably.
- **Resharding is the expensive event** — design the shard key up front (avoid keys that need to change), and build a live-migration path (dual-write + backfill + cutover) rather than a stop-the-world migration.

### Message Queues & Async Processing

- **Publish-subscribe** decouples producers from consumers — tolerates consumer downtime, enables independent scaling of each side.
- **Point-to-point queues** (single consumer group) for work distribution; pub-sub (topics/fanout) for broadcast to multiple independent consumers.
- **At-least-once delivery** requires idempotent processing (dedup key, state machine on consumer) since retries can redeliver.
- **Exactly-once** is achievable only with transactional outbox / idempotency keys at the consumer — the queue itself rarely guarantees it end-to-end.
- **Dead-letter queues** quarantine poison messages after N failed retries; enable inspection and replay after a fix, instead of blocking the whole queue.
- **Backpressure**: when the consumer is slow, the queue fills. Use bounded queues + circuit breaker to shed load at the producer rather than let memory grow unbounded or crash the producer.
- **Ordering guarantees** are per-partition/per-key only in most systems (Kafka, SQS FIFO) — don't assume global ordering across partitions.

### Rate Limiting & Admission Control

- **Token bucket** (refill N tokens/sec, request costs 1+ tokens) — smooths bursts, allows short spikes, fair sharing.
- **Leaky bucket** (constant drain rate) — stricter, prevents burstiness entirely; good for protecting a fixed-capacity downstream.
- **Fixed window counter** — simple, but allows 2x burst at window boundaries.
- **Sliding window (log or counter)** — precise, avoids boundary bursts, requires more state (timestamps or weighted counts).
- **Distributed rate limiting** (shared state via Redis, `INCR` + `EXPIRE` or Lua script) — single source of truth across replicas, but adds a network hop and a potential SPoF; mitigate with Redis replication.
- **Where to enforce**: at the edge/API gateway (protects the whole backend) vs. per-service (protects a specific expensive resource) — often both, at different granularities.

### CAP Theorem & Consistency Models

- **Consistency (C)**: all replicas agree on the latest value. **Availability (A)**: every request gets a (non-error) response. **Partition-tolerance (P)**: system keeps operating when the network splits nodes into groups.
- **P is not optional** in any real distributed system (networks partition) — the real choice is **C vs. A during a partition**.
- **CP systems** (strong consistency, sacrifice availability during a partition): abort/block writes on the minority side (ZooKeeper, etcd, PostgreSQL synchronous replication).
- **AP systems** (eventual consistency): accept stale reads on all sides, converge after the partition heals (Cassandra, DynamoDB, S3).
- **PACELC extension**: even absent a partition (`E`lse), systems trade **L**atency vs. **C**onsistency — e.g. DynamoDB is PA/EL (favors latency), spanner-like systems are PC/EC.
- **Consistency spectrum**: strong (linearizable) → sequential → causal → eventual. Pick the weakest model that still satisfies the product requirement — stronger costs latency/availability.
- **Choose per data type, not globally**: account balance / inventory count = CP (correctness critical); product catalog / view counts / social feed = AP (stale-OK, availability critical).

### Content Delivery Network (CDN)

- **Edge nodes (PoPs)** cache content near users geographically; origin server handles cache misses and all writes.
- **Cache keys** include URL + user identity for personalized content, or URL alone for public content; TTL balances freshness vs. hit rate.
- **Push vs. pull CDN**: pull (lazy, populate on first miss) suits long-tail content; push (pre-populate) suits known hot content (video release, product launch).
- **Origin failover**: when the CDN cache misses and the origin is down, serve a stale copy (better UX) rather than a hard error, if staleness is tolerable for that content type.
- **Purge mechanism** (manual or event-driven) needed for urgent updates (security patch, recalled content, legal takedown) — cannot wait out the TTL.
- **Static vs. dynamic content**: CDNs excel at static assets (images, JS/CSS, video segments); dynamic/personalized API responses need shorter TTLs or edge compute (edge functions) instead of pure caching.

### Notification & Event Delivery

- **Polling** (client asks "any updates?" every N sec) — simplest, higher latency, wastes requests when nothing changed; fine for low-frequency updates or thin clients.
- **Long polling** — server holds the request open until data is available or timeout; reduces empty round-trips vs. plain polling.
- **WebSockets / persistent connections** — low-latency bidirectional push; costly to hold open at scale (connection state per server), needs sticky routing or a connection-state store.
- **Webhooks** (server pushes to a client-registered URL) — low latency, requires the client to expose a callback endpoint and implement retry/backoff on its side for failures.
- **Message queue fanout** (pub-sub to N subscriber services) — decouples the producer from consumer count, enables batching and dedup per consumer.
- **Delivery guarantees**: exactly-once (hard — requires dedup + idempotency at the receiver); at-least-once (easier, retry on failure, receiver must tolerate duplicates); at-most-once (simplest, silently drops on failure — acceptable only for non-critical, high-frequency updates like live location pings).
- **Fanout strategy**: fanout-on-write (push to every follower's inbox at write time — fast reads, expensive for high-fanout accounts) vs. fanout-on-read (compute feed at read time — cheap writes, slower reads); hybrid (fanout-on-write for normal users, fanout-on-read for celebrities/high-follower accounts) is the common production compromise.

## Component Deep Dives

### Search Backend

- **Inverted index** (term → list of document IDs) is the core data structure; build offline/async from the primary datastore, never query the primary store directly for full-text search.
- **Indexing pipeline**: write to primary DB → emit event → indexer consumes and updates the search index asynchronously. Search results lag writes by design (AP trade-off) — surface this in the UX (e.g., "new items may take a moment to appear").
- **Sharding the index** by document ID or by term, with a query-fanout/scatter-gather layer that merges per-shard results and re-ranks.
- **Relevance vs. freshness**: real-time re-indexing is expensive; batch re-indexing is cheap but stale. Hybrid: near-real-time updates for critical fields (price, availability), batch for less volatile ones (description).

### Notification Service (end-to-end)

- **Ingestion**: producers (order service, chat service, etc.) publish events to a queue rather than calling the notification service synchronously — decouples notification latency/failures from the triggering action.
- **Preference & channel resolution**: a user-preference store decides channel (push, email, SMS, in-app) and throttling (don't spam); look this up once per event, not per delivery attempt.
- **Fanout worker** reads the queue, resolves channel(s), and dispatches to provider-specific senders (APNs/FCM for push, SMTP/SES for email, Twilio for SMS).
- **Retry & dead-letter**: provider failures (rate-limited, transient 5xx) get exponential backoff retry; permanent failures (invalid token, bounced email) go to a dead-letter queue and mark the channel invalid to stop future waste.
- **Idempotency key** per (event, channel, user) avoids duplicate notifications on consumer redelivery.

### Multi-Region & Geographic Distribution

- **Active-active** (all regions serve writes) needs conflict resolution (CRDTs, last-write-wins, vector clocks) — highest availability, hardest consistency.
- **Active-passive** (one region writes, others are read replicas/standby) — simpler, but failover has downtime and potential data loss (replication lag) during promotion.
- **Data residency / locality** constraints (e.g., GDPR) can force region-pinned storage regardless of the availability model chosen.
- **Cross-region latency** (50–200ms) makes synchronous cross-region consensus expensive — prefer async replication with a documented staleness bound over synchronous multi-region writes unless correctness truly requires it.

## Worked Example Sketches

### URL Shortener (illustrates the method end to end)

1. Requirements: create short URL, redirect on GET, ~100:1 read:write ratio, must not collide.
2. Scale estimate: 100M new URLs/day → ~1,200 writes/sec average, redirects ~120K/sec peak → read-heavy, cache almost everything.
3. Data model: `short_code → long_url`, plus an optional analytics event.
4. Architecture: LB → stateless API tier → cache (Redis, cache-aside) → sharded key-value store (shard by hash of `short_code`). Async worker consumes a queue for click analytics.
5. Deep-dive: short-code generation (counter + base62 vs. random + collision-check) — a counter is simpler and collision-free but needs a centralized/sharded counter service; choose based on required write throughput.
6. Bottleneck: hot codes (a viral link) — cache absorbs almost all read traffic; only the cache-miss path touches the DB.
7. Trade-off named: eventual consistency is acceptable for click-count analytics (AP), but the redirect mapping itself must be strongly consistent per key (CP) once created.

### Rate-Limited Public API Gateway

1. Requirements: per-API-key quota (e.g., 1000 req/min), fair enforcement across N gateway replicas.
2. Chosen pattern: sliding-window counter in Redis (`ZADD`/`ZREMRANGEBYSCORE` per key), enforced at the gateway before the request reaches any backend service.
3. Bottleneck named: Redis becomes a shared dependency for every request — replicate Redis and keep the rate-limit check on the hot path as cheap as possible (single round-trip, Lua script for atomicity).
4. Degradation plan: if Redis is unreachable, fail open (allow the request) rather than fail closed (block all traffic) — availability of the product outweighs perfect quota enforcement for a transient outage, and this trade-off should be stated explicitly to stakeholders.

## Pitfalls & Trade-offs

- **Cache coherence**: writes bypass cache → stale reads. Solve: invalidation, write-through, or an explicit eventual-consistency SLA communicated to consumers.
- **Hot shard/hot key** (one shard or one cache key overwhelmed) — range/hash sharding still distributes unevenly over time as access patterns shift. Detect via per-shard metrics; migrate live or re-shard rather than react after an outage.
- **Single point of failure**: all load balancers behind one public IP or one AZ? Use anycast/multiple LBs and multi-AZ (or multi-region) placement.
- **Thundering herd / cache stampede**: TTL expiry on a hot key causes many concurrent DB hits — use request coalescing or staggered (jittered) TTLs.
- **Monitoring debt**: the system scales to 10K req/s but observability doesn't — blind spots become undetected cascading failures. Instrument before scaling, not after an incident.
- **Complexity tax**: every layer (cache, shard, queue, rate limiter) adds ops overhead, testing burden, and debugging cost. Each layer must earn its place with measured need.
- **Premature optimization**: add a layer only when measured data (load test, production metrics) justifies it — not because it "might be needed" at hypothetical future scale.
- **Ignoring failure modes in the happy-path design**: always ask "what if this component is slow/down/partitioned?" for each box in the diagram, not just "what does it do when healthy?"
- **Uniform depth across components**: spending equal detail on every box instead of deep-diving the 1–2 components that are actually hard or novel — signals the design wasn't prioritized.

---

**When designing**, clarify SLOs (latency, availability, data freshness, consistency) first, then choose the fewest patterns that meet them at lowest operational cost. Name every trade-off out loud — a design without stated trade-offs hasn't actually decided anything.
