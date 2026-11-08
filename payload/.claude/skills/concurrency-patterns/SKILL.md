---
name: concurrency-patterns
description: Async/await models, background task orchestration, cancellation, thread/task synchronization, thread-safe collections, and classic concurrency pitfalls (partial updates, memory reordering, deadlocks, race conditions, starvation), transposed from C# concurrency practice into language-agnostic patterns.
origin: biblio
---

# Concurrency Patterns

Patterns for writing correct, non-blocking, cancellable concurrent code, and
for avoiding the failure modes that make concurrency hard to get right.
Grounded in "Concurrency in C# Cookbook"-style practice but written for any
runtime with an async/await model, a thread/worker pool, and shared mutable
state (Python asyncio, Node.js, Go, Java, Kotlin coroutines, JS Promises).

## When to Activate

- Adding `async`/`await` (or a Promise/Future/goroutine equivalent) to code
  that does I/O, network calls, or blocking work.
- Running a batch of items in parallel or in a background queue.
- Adding cancellation/timeout support to a long-running or background
  operation.
- Sharing mutable state across threads, tasks, or coroutines.
- Debugging a hang, a deadlock, an intermittent/flaky failure, or a value
  that's "sometimes wrong" under load — all textbook race-condition symptoms.
- Choosing a collection type for concurrent producers/consumers.
- Reviewing code that mixes synchronous locking with asynchronous code.

## Core Model: async/await Is Not Multithreading

Treat these as two independent axes, not one concept:

- **Asynchronous programming** (`async`/`await`, Promises, coroutines) frees
  the *calling* thread while waiting on an I/O-bound operation (network,
  disk, timer). It does not by itself use more CPU cores.
- **Multithreading/parallelism** (thread pools, worker pools, `Task.Run`-style
  primitives, goroutines scheduled across OS threads) uses more CPU cores for
  CPU-bound work.
- The two compose: an async function can internally dispatch CPU-bound chunks
  to a worker pool and `await`/join the result. Don't reach for extra threads
  to solve an I/O-wait problem, and don't reach for `async` to solve a
  CPU-bound problem — pick the axis that matches the bottleneck.

### Where does continuation code run after a suspend point?

After an `await` (or equivalent), execution resumes on whatever the runtime's
scheduling context dictates — not necessarily the thread that started the
call:

- UI/single-threaded event-loop runtimes typically resume on the same
  logical thread/loop (a "synchronization context") so it's safe to touch
  UI/shared state directly after `await`.
- Server/worker runtimes generally resume on any available pool thread/task
  — do not assume thread affinity, and do not rely on thread-local state
  surviving an `await`.
- When a library function doesn't need to resume on the original context
  (most library/leaf code doesn't), explicitly opt out of capturing that
  context (`ConfigureAwait(false)` in C#, avoiding `asyncio.get_event_loop()`
  coupling in Python, etc.) to avoid deadlocks and unnecessary context
  hops — see "async + locking deadlock" below.

## Background & Parallel Processing

- **Parallel** (unordered, independent items): dispatch each item to the
  worker/task pool and gather results — use a bounded-concurrency
  parallel-map primitive (`Parallel.ForEach`, `asyncio.gather` with a
  semaphore, worker pool with a fixed size) rather than spawning one
  thread/task per item unbounded. Unbounded fan-out exhausts memory/handles
  under real load even though it works fine in a demo with 10 items.
- **Sequential background work**: a single background worker draining a
  queue. Use a **work-queue pattern**: a thread-safe/blocking queue
  (`BlockingCollection<T>`, `asyncio.Queue`, channel) feeding one consumer
  loop. This guarantees ordering and bounds memory (bounded queue = natural
  backpressure).
- **Priority/durable queues**: when some items must survive a crash or must
  jump the line, back the queue with a persistent store (DB table, durable
  message broker) instead of an in-memory collection — an in-memory queue
  loses everything on process restart.
- Prefer the built-in bulk/parallel primitive of your runtime
  (`Parallel.ForEach`, `asyncio.gather`, `Promise.all` with concurrency
  limiting, a `sync.WaitGroup` + worker pool in Go) over hand-rolled
  thread-spawn loops — they handle pool sizing and exception aggregation for
  you.

## Cancellation

- Treat cancellation as a **first-class parameter**, threaded through every
  layer of a call chain (a cancellation token / context / signal), not a
  side flag checked ad hoc.
- Cancellation should be **cooperative**: the operation observes the
  cancellation signal at safe points (before/after each unit of work, at
  `await` boundaries) and exits cleanly — it does not forcibly kill a thread
  mid-operation, which can corrupt shared state.
- Distinguish two cancellation-observation styles:
  - **Poll**: check "is cancellation requested?" between units of work
    (loops over items, chunks of a stream) and return/break early.
  - **Callback/exception**: register a callback that fires on cancellation,
    or let the awaited primitive itself throw/reject when cancelled — use
    this for a single long-running `await` you can't poll inside.
- **Timeouts are cancellation**: implement a timeout by triggering
  cancellation after a duration elapses, not by inventing a separate
  timeout mechanism — this lets timeout and manual/parent cancellation
  compose through the same signal.
- **Combine cancellation sources**: when an operation must stop if *either*
  a caller-provided cancellation *or* an internal timeout fires, link the
  two signals into one (`CancellationTokenSource.CreateLinkedTokenSource`,
  `asyncio.wait(..., timeout=...)` racing a cancel event, `context.WithCancel`
  wrapping a parent context in Go) rather than checking both separately at
  every point.
- Propagate cancellation **downward only** through a call tree — a child
  operation should never be able to cancel its caller's unrelated work.

## Waiting on Your Own Events (Bridging Callback APIs to async)

- When wrapping an old-style callback/event API in an async interface, use a
  **deferred-completion primitive** (`TaskCompletionSource`, a `Future`/
  `Deferred`, a Python `asyncio.Future`, a Go channel used once): create it,
  return the awaitable to the caller immediately, and resolve/reject it from
  the callback when the event fires. This is the standard adapter between
  "push" callback APIs and "pull" async/await code.
- Choose deliberately where the *continuation* (the code after `await`) runs
  when you resolve a deferred-completion object — resolving it synchronously
  inside a callback can force awaiting code to run on a thread you don't
  control (e.g. a UI thread or an I/O callback thread) unless you explicitly
  schedule the continuation elsewhere.
- Use the same pattern to build a "wait for initialization" gate: an async
  operation an arbitrary number of callers can `await`, all of which resume
  once a one-time setup step completes.

## Synchronization & Shared State

- **Rule 1 — avoid shared mutable state.** The cheapest fix for most
  concurrency bugs is giving each concurrent unit of work its own copy of
  the data instead of sharing one instance.
- **Rule 2 — prefer immutable data.** If several concurrent readers only
  ever read, an immutable/frozen value needs no locking at all. Convert
  "shared and mutable" into "shared and immutable" wherever the workload
  allows it (e.g. build-then-freeze a collection, or swap a reference
  instead of mutating in place).
- **Rule 3 — when state must be shared and mutable, guard every access**,
  reads included. A getter that returns a struct/composite value without
  locking, while a setter locks, is not thread-safe — every reader and every
  writer must go through the same guard.
- **Rule 4 — one private lock per protected unit of data**, never expose the
  lock object outside the class/module and never lock on a publicly
  reachable object (e.g. `lock(this)`-style anti-patterns) — external code
  taking the same lock accidentally is a classic deadlock source.
- **Rule 5 — synchronization kills parallelism speedup.** Two threads doing
  five million increments each under one shared lock run no faster than one
  thread doing ten million — the lock serializes them. If you find yourself
  needing wall-to-wall locking around a "parallel" loop, you've turned it
  back into sequential code with thread overhead added. Reduce the lock's
  scope, shard the data, or use a lock-free/concurrent collection instead.
- **Partial updates**: never assume a single assignment is atomic. Composite
  values (structs, wide numeric types wider than a machine word, multi-field
  records) can be torn — one thread can observe a half-old/half-new value.
  Guard the whole read-or-write of the value, not just "the obvious" fields.
- **Memory access reordering**: compilers and CPUs reorder and cache
  operations for performance; code that "looks" sequentially consistent on
  paper is not guaranteed to execute in that order across threads without an
  explicit memory barrier/lock/atomic — never rely on manual ordering of
  unguarded assignments to establish happens-before relationships between
  threads.

## Deadlocks

- Classic pattern: thread A holds resource 1 and waits for resource 2 while
  thread B holds resource 2 and waits for resource 1 — neither can proceed.
  Generalizes to a cycle of any length (A→B→C→A) and even to a single thread
  waiting on itself.
- **Always acquire multiple locks in a fixed, global order** across the
  whole codebase — this is the single most effective deadlock prevention
  rule. If two code paths ever lock A-then-B and B-then-A, you have a
  deadlock waiting to happen under load.
- Know whether your lock primitive is **reentrant** (same thread can
  re-acquire it, common for `lock`/`Mutex`-style primitives) or **not**
  (e.g. semaphores, exclusive file handles) — treating a non-reentrant
  primitive as reentrant deadlocks the very thread that holds it.
- **async + blocking-lock deadlock**: blocking synchronously on an async
  operation's result from a context that captures a synchronization context
  (e.g. calling `.Result`/`.Wait()`-style blocking-get on a UI thread, or
  calling a blocking join from inside an event loop) deadlocks if that
  operation's continuation needs to resume on the very thread you just
  blocked. Fix: await asynchronously all the way up the call stack, or make
  the low-level async call not depend on the calling context in the first
  place.

## Race Conditions

- A race condition is any outcome that depends on the unpredictable relative
  timing of concurrent operations — the code isn't "sometimes buggy," it's
  correct only under an implicit and unenforced ordering assumption.
- Splitting one logical operation (e.g. "read then write" or "check then
  act") across multiple lock acquisitions reintroduces the race even though
  each individual step is itself guarded — the whole logical operation needs
  one lock held for its full duration, not one lock per sub-step.
- Symptoms to recognize as races: values reverting to a previous/default
  state under concurrent load, results that differ between runs with
  identical input, a bug that vanishes when you add a debugger breakpoint or
  a log line (timing-sensitive by definition).

## Starvation

- Starvation is when a thread/task never gets to run or never acquires a
  resource because other work monopolizes it — distinct from deadlock (no
  one is stuck; that thread is just never served).
- Common causes: a lock held far longer than necessary (e.g. doing I/O
  inside a lock instead of just the shared-state mutation), a thread pool
  whose all workers are occupied by long-running work so short tasks never
  get scheduled, or unfair scheduling that always favors the same
  contenders.
- Fix by shrinking the critical section to the minimum necessary work,
  moving I/O/expensive work outside locks, and using fair/bounded scheduling
  primitives (bounded queues, fair semaphores) instead of unbounded
  contention.

## Thread-Safe / Concurrent Collections

- Regular (non-thread-safe) collections corrupt internal state or throw
  under concurrent read+write — wrapping every access in your own lock works
  but reintroduces all the lock-discipline risk above.
- Prefer purpose-built **concurrent collections** (concurrent
  dictionary/queue/stack/bag equivalents) for producer/consumer and shared
  lookup use cases — they use fine-grained or lock-free internal
  synchronization tuned for the access pattern, which a hand-rolled
  `lock`-around-a-plain-dict cannot match under contention.
- Prefer **immutable/frozen** collections when a collection is built once
  and then only read concurrently — no synchronization needed for readers,
  and a new version is produced (not mutated) for any update, making
  "current snapshot" semantics automatic for readers.
- Use a **bounded blocking collection/channel** as the queue in a
  producer/consumer pipeline — bounding gives you backpressure for free
  instead of unbounded memory growth when consumers fall behind producers.
- Don't reach for a concurrent collection when the workload is single-writer
  or already externally synchronized — the extra internal synchronization is
  pure overhead there.

## Exceptions in Concurrent/Async Code

- An exception raised inside a background task/thread that nobody awaits or
  joins can be silently lost — always await/join (or explicitly attach an
  error handler to) every fire-and-forget concurrent operation, or
  deliberately document why it's safe to ignore.
- When multiple concurrent operations are joined together (e.g. "wait for
  all of these"), the failure surface is an *aggregate* of possibly several
  exceptions, not just the first one — unwrap/iterate all of them rather
  than assuming a single cause; some await/join constructs unwrap only the
  first failure by default, which can hide a second, unrelated failure.
- Fire-and-forget async entry points (an async event handler with no return
  value the caller can await) cannot propagate exceptions to a caller at
  all — they must catch and handle/log internally, because an unhandled
  exception there can crash the process instead of failing the one
  operation.

## Iterating Async/Streamed Data

- When a producer yields items over time from an asynchronous source
  (paginated API, streaming query, sensor feed), prefer a native
  async-iterable/async-generator construct over manually buffering into a
  list and returning it once — it starts yielding the first item before the
  whole sequence is available, and composes with cancellation and
  backpressure naturally.
- Cancellation of an async iteration should stop pulling from the underlying
  source promptly (close the connection, stop the generator) rather than
  draining it to completion and discarding the rest.

## Common Pitfalls Checklist

- [ ] No blocking/synchronous wait on an async result from a thread whose
      context that operation needs to resume on.
- [ ] Every shared mutable value's reads *and* writes go through the same
      guard — not just the writes.
- [ ] Multi-lock acquisition order is consistent everywhere in the codebase.
- [ ] No lock is held across an I/O call or another blocking wait.
- [ ] Every fire-and-forget async/background operation has explicit error
      handling — no silently swallowed exceptions.
- [ ] Cancellation is threaded through the whole call chain, checked at
      loop/`await` boundaries, and combines caller-cancel + timeout through
      one linked signal.
- [ ] Unbounded thread/task spawn loops are replaced with a bounded
      worker/parallelism primitive.
- [ ] No "check-then-act" split across two separate lock acquisitions on the
      same logical operation.
- [ ] Composite/multi-field values are never assigned without a guard, even
      when "it's just one line."
- [ ] A concurrent or immutable collection replaces a hand-locked plain
      collection on any hot producer/consumer or shared-read path.
