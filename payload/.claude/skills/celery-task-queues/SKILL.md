---
name: celery-task-queues
description: Asynchronous task queue patterns with Celery — brokers, exchanges, workers, retries, periodic tasks, result backends, idempotence, and monitoring for distributed background job processing.
origin: biblio
---

# Celery Task Queues

Distributed task queue patterns for offloading slow, unreliable, or
schedulable work off the request/response path — built on message queue
brokers (RabbitMQ, Redis) with independent worker processes.

## Prerequisites (preflight)

Requires **celery**. Verify; warn if missing:

```bash
python -c "import celery" 2>/dev/null || echo "WARN: celery missing — pip install celery"
```

## When to Activate

- Designing or reviewing background job processing (emails, exports, image
  processing, webhooks, batch jobs).
- Choosing a broker or exchange routing strategy (direct / topic / fanout).
- Debugging task failures, retries, duplicate execution, or lost messages.
- Setting up periodic/scheduled tasks (cron-like jobs).
- Deciding whether a task result needs to be persisted and retrieved later.
- Reviewing worker concurrency, scaling, or monitoring setup.

## Core Concepts

### Producer / broker / worker separation

A task queue decouples three roles:

- **Producer** — application code that publishes a task message (does not
  execute the work itself, does not block waiting for it).
- **Broker** — message queue (RabbitMQ, Redis, SQS) that stores and routes
  messages between producers and workers. The broker is the durability
  boundary: if it goes down or a message is lost before ack, the task is gone.
- **Worker** — separate process (often on separate infrastructure) that
  consumes messages from a queue and executes the task function.

Never run task logic inline in the request handler if it can be deferred —
that is the entire point of the pattern. A view/controller should only
enqueue, never execute, non-trivial or unreliable work.

### Defining and running a task

A task is a plain function decorated/registered with the task queue library,
executed out-of-process by a worker pool:

```python
@app.task
def send_welcome_email(user_id: int) -> None:
    ...

# Producer side — never call directly, always enqueue
send_welcome_email.delay(user_id)
```

Keep task payloads small and serializable (IDs, not full objects) — fetch
fresh state inside the task rather than passing large/stale objects through
the broker.

### Exchange / routing strategies

How a broker decides which queue(s) receive a published message:

| Exchange type | Behavior | Use case |
|---|---|---|
| Direct | Message routed to the queue(s) bound with a matching exact routing key | One task type → one dedicated queue |
| Topic | Queue bound by a pattern match on the routing key (`orders.*`) | Selective fan-out by category |
| Fanout | Message delivered to *all* bound queues, routing key ignored | Broadcast to every consumer (e.g. cache invalidation) |

Route CPU-heavy or slow tasks to a dedicated queue/worker pool, separate from
fast, latency-sensitive tasks — a single slow task must never block a queue
that also carries user-facing quick jobs.

### Retry and backoff

Tasks executing over a network or against external services will fail
transiently. Configure explicit retry policy per task, not a blanket default:

```python
@app.task(bind=True, max_retries=5, default_retry_delay=30)
def call_external_api(self, payload: dict) -> None:
    try:
        client.post("/endpoint", json=payload, timeout=10)
    except TransientError as exc:
        raise self.retry(exc=exc, countdown=2**self.request.retries)
```

- Use exponential backoff, not fixed-interval retry, for external calls.
- Cap `max_retries` — an unbounded retry loop against a persistently failing
  dependency wastes worker capacity and can starve other queues.
- Distinguish retryable errors (timeout, 503, connection reset) from
  terminal errors (validation failure, 4xx) — never retry the latter.

### Periodic tasks

Scheduled/recurring tasks (cron-equivalent) are registered separately from
on-demand tasks, with their own scheduler process:

- Define schedule centrally (interval or crontab expression), not scattered
  across call sites.
- A periodic task must be idempotent (see below) — a scheduler restart or
  clock drift can trigger a double-fire.
- Keep periodic task bodies thin: enqueue individual work items rather than
  doing bulk processing inline, so failures are isolated per item.

### Task results

- Only enable a result backend (DB, Redis) if the caller actually needs to
  poll for a return value or status — persisting every result by default
  wastes storage and adds broker/backend load.
- Results have a TTL; do not treat the result backend as long-term storage.
- For "fire and forget" tasks (the majority), disable result storage
  entirely (`ignore_result=True` or equivalent).

### Idempotence

Message brokers give **at-least-once** delivery, not exactly-once. A task
can and will run more than once (worker crash after execution but before
ack, redelivery after visibility timeout, manual retry). Design every task
to be idempotent:

- Use natural keys / upserts instead of blind inserts.
- Check-before-act on external side effects (has this email already been
  sent for this user+campaign?).
- For non-idempotent external calls (charging a card), use an idempotency
  key passed through to the downstream API.

### Monitoring

- Track queue depth (backlog) per queue, not just overall throughput — a
  growing backlog on one queue signals an underprovisioned or stuck worker
  pool before anything else does.
- Track task failure rate and retry rate separately from success latency.
- Alert on tasks stuck in "started" state beyond their expected duration
  (worker crash without requeue, or a task holding a lock/hanging on I/O).
- Log task ID at enqueue and at start/completion to trace a task end-to-end
  across producer and worker logs.

## Pitfalls

- **Blocking the web process on task execution** — calling a task function
  directly instead of `.delay()`/`.apply_async()` defeats the entire
  pattern and reintroduces the latency it was meant to remove.
- **Passing non-serializable or large objects as task arguments** — pass
  IDs, refetch inside the task; large payloads bloat the broker and slow
  every consumer.
- **No retry policy on network-calling tasks** — a single transient failure
  silently drops the task forever.
- **Unbounded retries** — a permanently failing task retried indefinitely
  starves worker capacity from healthy tasks.
- **Assuming exactly-once delivery** — writing non-idempotent side effects
  (send email, charge card, increment counter) without dedup logic causes
  duplicates under redelivery.
- **One giant default queue for everything** — slow/heavy tasks block fast
  ones when they share a queue and worker pool; route by cost/latency
  profile.
- **Treating the result backend as a database** — results expire; do not
  rely on them for anything beyond the immediate polling window.
- **No monitoring on queue depth** — backlog growth is often the first (and
  sometimes only) signal of a stuck or underscaled worker pool; silent
  until it becomes an outage.
- **Fat periodic tasks doing bulk work inline** — one item's failure kills
  the whole batch; fan out into per-item child tasks instead.
