---
name: cpp-patterns
description: Modern C++ concurrency patterns — threads, mutexes, condition variables, atomics and the memory model, futures/async, lock-free data structures, and thread pools. RAII-first resource and thread-safety discipline.
origin: biblio
---

# C++ Patterns

Concurrency and resource-management patterns for modern C++ (C++11 through C++20),
distilled from *C++ Concurrency in Action* (2nd ed., Anthony Williams). Use RAII to
own every resource — a thread, a lock, a heap node — and let scope-exit destructors
do the cleanup, even on exceptions.

## Prerequisites (preflight)

```bash
command -v g++ || command -v clang++ || echo "WARN: install a C++ compiler"
```

## When to Activate

- Writing or reviewing multithreaded C++ code (`std::thread`, `std::async`, thread pools)
- Protecting shared, mutable state with mutexes or atomics
- Diagnosing a race condition, deadlock, or data race
- Choosing between locking and lock-free designs for a shared data structure
- Designing producer/consumer or task-queue systems
- Picking a `std::memory_order` for an atomic operation
- Reviewing exception safety around threads and locks

## Core Principle: RAII Everywhere

Every resource acquisition is wrapped in an object whose destructor releases it —
this is the single idea threading through every pattern below. A `std::thread` must
be joined or detached before its destructor runs, or the program terminates. A mutex
must be unlocked exactly once per lock, even when an exception unwinds the stack.
Never manage a resource with raw `lock()`/`unlock()` calls or a bare `thread` left
to fall out of scope unjoined.

```cpp
// RAII thread guard — join in the destructor, unconditionally
class thread_guard {
    std::thread& t;
public:
    explicit thread_guard(std::thread& t_) : t(t_) {}
    ~thread_guard() {
        if (t.joinable())
            t.join();
    }
    thread_guard(const thread_guard&) = delete;
    thread_guard& operator=(const thread_guard&) = delete;
};
```

## Threads: Launch, Join, Detach

- `std::thread` starts running immediately on construction — there is no separate "start".
- A joinable thread whose destructor runs calls `std::terminate()`. Always `join()` or
  `detach()` before it goes out of scope, including on the exception path.
- Prefer RAII wrappers (`thread_guard` above, or `std::jthread` in C++20, which
  auto-joins and supports cooperative cancellation via `std::stop_token`).
- Pass arguments to `std::thread` by value by default — a reference to a local that
  outlives the calling scope requires explicit `std::ref()`, and is a classic
  dangling-reference bug when the launching function returns before the thread runs.

```cpp
void f(int i, const std::string& s);
std::string local = "hello";
std::thread t(f, 3, local);   // copies local into the new thread's storage
t.join();
```

## Mutexes and Locking

- `std::lock_guard<std::mutex>` is the default RAII lock: locks on construction,
  unlocks on destruction, no manual unlock path to forget. Prefer `std::scoped_lock`
  (C++17) — it also handles locking multiple mutexes atomically without deadlock.
- `std::unique_lock` trades a little overhead for flexibility: deferred locking,
  timed locking, and manual unlock/relock — required by `std::condition_variable::wait()`.
- Never expose a pointer or reference to protected data outside the lock's scope —
  a "thread-safe" interface with a `get_data()` accessor that returns a raw reference
  is a race condition waiting to happen.

```cpp
std::mutex some_mutex;
void add_to_list(int value) {
    std::scoped_lock guard(some_mutex);   // C++17, locks all args atomically
    some_list.push_front(value);
}
```

### Deadlock avoidance

Deadlock's root guideline: **don't wait for another thread while holding a lock it
might need**. Concretely:

- Always acquire multiple mutexes together via `std::lock()` / `std::scoped_lock` —
  never lock them one at a time in code paths that might run in a different order.
- Avoid nested locks; if unavoidable, always acquire locks in the same global order
  across every code path.
- Avoid calling unknown/user-supplied code while holding a lock — it might try to
  acquire the same lock.
- Prefer locking one mutex at a time when the design allows it — the simplest way to
  avoid a deadlock is not needing more than one lock live at once.

## Condition Variables: Waiting for a Condition

Use `std::condition_variable` (paired with `std::mutex`/`std::unique_lock`) to make a
thread sleep until another thread signals a state change — never busy-wait/poll.

```cpp
std::mutex mut;
std::queue<data_chunk> data_queue;
std::condition_variable data_cond;

void data_preparation_thread() {
    while (more_data_to_prepare()) {
        data_chunk const data = prepare_data();
        {
            std::lock_guard lk(mut);
            data_queue.push(data);
        }
        data_cond.notify_one();
    }
}

void data_processing_thread() {
    while (true) {
        std::unique_lock lk(mut);
        data_cond.wait(lk, [] { return !data_queue.empty(); });  // predicate guards spurious wakeups
        data_chunk data = data_queue.front();
        data_queue.pop();
        lk.unlock();
        process(data);
    }
}
```

- Always pass a predicate to `wait()` — it protects against spurious wakeups and
  against the notification arriving before the wait starts.
- `notify_one()` wakes one waiter; `notify_all()` wakes every waiter — use `notify_all`
  when multiple threads may need to react to the same state change.

## Atomics and the Memory Model

- `std::atomic<T>` operations take an optional `std::memory_order` argument.
  Six values exist: `relaxed`, `consume`, `acquire`, `release`, `acq_rel`, `seq_cst`.
  `seq_cst` (sequentially consistent) is the default and the strongest guarantee.
- **Guideline: start with `memory_order_seq_cst` when prototyping.** It's the easiest
  to reason about — total order across all threads — even though it's the most
  expensive on weakly-ordered hardware (ARM). Relax it only after profiling proves a
  bottleneck, and only with a clear justification for the weaker ordering chosen.
- `acquire`/`release` pairs establish a happens-before relationship between a
  release-store in one thread and an acquire-load of the same value in another —
  the backbone of lock-free publish/subscribe patterns (e.g. handing off a
  fully-constructed object via a flag).
- `relaxed` gives no ordering guarantee beyond atomicity of the operation itself —
  correct only for counters/statistics with no cross-thread dependency on other data.

```cpp
std::atomic<bool> data_ready(false);
int data;

void producer() {
    data = 42;
    data_ready.store(true, std::memory_order_release);
}
void consumer() {
    while (!data_ready.load(std::memory_order_acquire))
        std::this_thread::yield();
    assert(data == 42);   // guaranteed visible due to release/acquire pairing
}
```

## Futures, Promises, and `std::async`

- `std::async` starts an asynchronous task and returns a `std::future<T>` — call
  `.get()` once to retrieve the result (blocks until ready) or propagate an exception
  thrown inside the task.
- Pass a launch policy explicitly when it matters: `std::launch::async` forces a new
  thread; `std::launch::deferred` runs lazily on the calling thread at `.get()` time;
  the default lets the implementation choose.
- `std::packaged_task<>` wraps a callable so its result/exception is delivered through
  an associated future — the building block for custom thread pools and task queues.
- `std::promise`/`std::future` decouple the "set a value" side from the "wait for a
  value" side across threads, useful when the producing thread isn't the one that
  scheduled the async call.

```cpp
std::future<int> the_answer = std::async(find_the_answer_to_ltuae);
do_other_stuff();
std::cout << "The answer is " << the_answer.get() << std::endl;
```

## Thread Pools

- The simplest thread pool: a fixed number of worker threads pulling tasks off a
  thread-safe queue until told to stop; avoid spawning one `std::thread` per task
  under high load — unbounded thread creation degrades performance and can exhaust
  OS resources.
- Feed `std::packaged_task<>` (or `std::function<void()>`) instances into the queue so
  callers get a future back for each submitted task.
- Design for two extra concerns beyond basic dispatch: tasks that themselves submit
  and wait on other tasks (risk of pool starvation/deadlock — needs a way to run
  pending tasks while waiting), and interrupting/cancelling queued or running work.

## Lock-Free Data Structures

- "Lock-free" doesn't mean "no atomics" — it means no thread can block another thread
  indefinitely; correctness rests entirely on careful `memory_order` choices, not on
  mutexes.
- Building a lock-free stack/queue is a staged process: get a correct-but-leaky
  version working first (accept memory leaks), then add reclamation (reference
  counting or hazard pointers), then relax memory orders only once correctness is
  proven with `seq_cst`.
- Only reach for lock-free structures after profiling shows lock contention is the
  actual bottleneck — they are dramatically harder to write correctly and to review
  than a mutex-protected structure, and a subtly wrong memory order produces bugs
  that may not reproduce for months.

## Pitfalls

- **Unjoined thread on an exception path** — an exception thrown between launching a
  `std::thread` and calling `.join()` skips the join, and the thread object's
  destructor terminates the program. Wrap in RAII (`thread_guard`, `std::jthread`).
- **Dangling reference into a detached/short-lived thread** — passing a reference to a
  local variable to `std::thread` without confirming the launching scope outlives the
  thread's use of it.
- **Returning a reference/pointer to data still protected by a mutex** — defeats the
  whole point of the lock; any caller can now mutate/read without holding it.
- **Locking two mutexes in different orders across two code paths** — classic ABBA
  deadlock. Use `std::scoped_lock`/`std::lock()` to acquire many mutexes atomically.
  Never call `lock()` on more than one mutex "by hand" one at a time.
  See listing note: "Although `std::lock` (and `std::scoped_lock<>`) can help you
  avoid deadlock in [multi-mutex] cases... it offers no help if they're acquired
  separately."
- **`wait()` without a predicate** — a bare `condition_variable::wait(lk)` is
  vulnerable to spurious wakeups and to a notification that fired before the wait
  began; always pass the predicate overload.
- **Defaulting to `memory_order_relaxed` for perceived speed** — reason from
  `seq_cst` first; only relax with a documented happens-before argument, and only
  after measuring.
- **Spawning unbounded threads for unbounded work** — no backpressure, no bound on
  OS thread count; use a thread pool with a bounded queue instead.
- **Treating a lock-free structure as inherently faster** — atomics with contention
  and retries can be slower than a short critical section under a mutex; measure
  before choosing.
