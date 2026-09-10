---
name: functional-programming
description: |
  Functional programming fundamentals: pure functions, immutability, functions as values,
  higher-order functions, functional error handling, IO as values, composition, streams,
  and functional concurrency. Build maintainable, testable applications by treating side
  effects as values and composing pure functions. Language-agnostic patterns applicable
  in any language with first-class functions (Python, JavaScript/TypeScript, Scala,
  Kotlin, Rust, Java, C#, Go, ...). Practical patterns from "Grokking Functional
  Programming" by Michał Płachta.
origin: "Grokking Functional Programming — Michał Płachta, Manning Publications (2022)"
tags:
  - paradigm
  - architecture
  - error-handling
  - concurrency
  - testing
---

# Functional Programming — Core Patterns & Practices

Functional programming (FP) minimizes moving parts through **pure functions**,
**immutable values**, and **functions as values**. It treats side effects — HTTP
calls, database writes, console output, randomness, clock reads — as first-class
values that are described, composed, and only executed at the edge of the program.
This skill teaches practical, language-agnostic FP patterns for building
composable, testable systems.

## When to Activate

Use when building systems that need:

- **High testability**: pure functions test with single-line assertions, no mocks
- **Predictability**: signatures don't lie; no hidden state mutations
- **Concurrent safety**: immutability eliminates data-race hazards by construction
- **Explicit error handling**: typed failure paths (`Option`/`Maybe`, `Either`/`Result`)
  instead of exceptions used for control flow
- **Composability**: small functions combined into larger workflows via `map`,
  `flatMap`/`bind`, and function composition
- **Refactoring confidence**: no cascading side-effect surprises when reordering code

**Avoid or relax when:** performance-critical tight numeric loops (allocation/GC
overhead from immutable structures may exceed the gains — measure first); a
legacy imperative codebase with high resistance to paradigm shift, where a
full rewrite isn't justified — introduce FP incrementally at module boundaries
instead.

## Techniques

### 1. Pure Functions

A pure function returns a value based only on its inputs and produces no
observable effect other than that return value: no I/O, no mutation of
arguments or external state, no hidden reliance on ambient state (clock,
globals, random source).

```python
# Impure: depends on hidden external state (self.cart.discount) and mutates nothing
# visibly, but the result silently changes if cart state changes elsewhere
def apply_discount(items):
    return sum(items) * (1 - self.cart.discount)

# Pure: all inputs passed explicitly, output depends only on arguments
def apply_discount(items: list[float], discount_rate: float) -> float:
    return sum(items) * (1 - discount_rate)
```

**Benefits:**
- Deterministic: same inputs always produce the same output
- Testable: no mocks needed; assert the result directly
- Referentially transparent: a call can be replaced by its result or cached
- Safe to reorder, parallelize, or call repeatedly without side effects piling up

**Detecting impurity — ask three questions:**
1. Does the function take all the information it needs as arguments (no hidden reads)?
2. Does it return a result without modifying anything outside its own scope?
3. Does it avoid throwing exceptions / doing I/O as part of its normal contract?

If any answer is "no", the function is impure — isolate that impurity at the
edges of the system (see Technique 5).

### 2. Immutable Values

Never modify a value in place; create a new value when a change is needed.
Immutability makes state predictable and safe to share across threads.

```javascript
// Mutable (error-prone): callers holding a reference see the change too
items.push("new item");

// Immutable: original untouched, a new array is returned
const withNewItem = [...items, "new item"];
```

```python
# Prefer namedtuple/frozen dataclass over mutable classes for value objects
from dataclasses import dataclass

@dataclass(frozen=True)
class Order:
    items: tuple[str, ...]
    total: float
```

- Structural sharing (persistent data structures) avoids the cost of deep
  copies on every change — most FP-oriented libraries/languages provide this.
- Immutable values are safe to pass across threads/processes without locks.

### 3. Functions as Values

Functions are values: assign them to variables, pass them as arguments, return
them from other functions, and store them in collections.

```python
operations = {
    "double": lambda x: x * 2,
    "square": lambda x: x * x,
}

def apply(op_name: str, value: int) -> int:
    return operations[op_name](value)
```

**Higher-order functions** — functions that take or return other functions —
replace hand-written loops with declarative transformations:

```python
prices = [10.0, 20.0, 30.0]
discounted = [apply_discount([p], 0.1) for p in prices]      # or map(...)
above_ten = [p for p in prices if p > 10.0]                   # filter
total = sum(prices)                                            # fold/reduce
```

`map`, `filter`, and `fold`/`reduce` compose transformations without manual
loop bookkeeping (indices, accumulators declared outside the loop body).

### 4. Functional Error Handling (Not Exceptions for Control Flow)

Encode the possibility of failure directly in the return type instead of
throwing exceptions for expected failure cases:

- `Option`/`Maybe`: value is present or absent (no `null`/`None` checks scattered around).
- `Either`/`Result`: left/`Err` carries an error, right/`Ok` carries a success value.

```python
from typing import Union

# Either encoded as a tagged result — same idea as Result<T, E> / Either[L, R]
def parse_show(raw: str) -> Union["Left", "Right"]:
    if not raw:
        return Left("Can't parse: empty input")
    return Right(raw.strip())
```

```typescript
type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

function parseShow(raw: string): Result<string, string> {
  return raw ? { ok: true, value: raw.trim() } : { ok: false, error: "empty input" };
}
```

**Why this matters:**
- The function signature declares the possibility of failure — callers can't
  forget to handle it (especially with a compiler/type-checker enforcing it).
- Failure paths compose with `map`, `flatMap`/`andThen`, and `orElse`/`unwrapOr`,
  just like success paths — no `try/except` pyramids.
- Reserve real exceptions for truly unexpected, unrecoverable conditions (out
  of memory, programmer bugs) — not for "user typed invalid input".

### 5. IO as Values

Instead of executing a side effect immediately, describe it as a value (an
`IO` action, a `Task`, a `Promise`/`Future` construction without `await`, or an
effect type) and only run it at the outermost layer of the application (the
"end of the world").

```scala
// Description of an effect, not yet executed
val readLine: IO[String] = IO(scala.io.StdIn.readLine())
val greet: IO[Unit] = readLine.map(name => println(s"Hello, $name"))

// Composed pipeline, still just a description
val program: IO[Unit] = greet.flatMap(_ => readLine).map(_ => ())

// Executed exactly once, at the program's entry point
program.unsafeRunSync()
```

```python
# Same idea without a dedicated IO type: keep pure logic separate,
# push all I/O to one thin boundary function
def compute_greeting(name: str) -> str:      # pure
    return f"Hello, {name}"

def run() -> None:                            # impure boundary
    name = input()
    print(compute_greeting(name))
```

**Benefits of describing IO as values:**
- Side effects can be composed, retried, timed out, and tested by substituting
  a fake interpreter — without ever running the real effect.
- Business logic stays pure and unit-testable; only the thin outer shell
  touches the network/filesystem/clock.
- Composing IO values *before* running them preserves retry/timeout/cancellation
  semantics; running each IO action in isolation and gluing results imperatively
  loses that composability (see pitfalls below).

### 6. Composition Over Imperative Sequencing

Build larger behavior from small, single-purpose pure functions rather than
one large procedure. Prefer point-free composition (`f andThen g`, `compose(f, g)`)
or a chain of `map`/`flatMap` calls over a long sequence of intermediate mutable
variables.

```python
def parse(raw: str) -> "Either": ...
def validate(show: "Show") -> "Either": ...
def to_summary(show: "Show") -> str: ...

def pipeline(raw: str) -> "Either":
    return parse(raw).flat_map(validate).map(to_summary)
```

### 7. Streams as Values

A stream is a (possibly infinite) sequence of values built the same way a
list is — as a value, not as an imperative producer/consumer loop with manual
buffering. Streams compose with `map`/`filter`/`zip` just like other FP values,
including streams whose elements are themselves IO actions (e.g. successive
paginated API calls).

```python
# A conceptual pull-based stream: each element is computed/fetched lazily
def api_call_stream(start_page: int):
    page = start_page
    while True:
        yield fetch_page(page)   # fetch_page returns an IO-like description in real FP code
        page += 1
```

Handle failures inside the stream (e.g. `Either`-typed elements) rather than
letting one failed element crash the whole consumer.

### 8. Functional Concurrency

Model concurrent work as composable, immutable descriptions (parallel `IO`/
`Future` combinators) instead of manually spawning threads and sharing mutable
state protected by locks.

```scala
// Two independent IO actions run concurrently, results combined once both finish
val combined: IO[(Weather, Traffic)] =
  (fetchWeather, fetchTraffic).parMapN((w, t) => (w, t))
```

```python
import asyncio

async def combined() -> tuple:
    # concurrent, not sequential — both awaited together
    return await asyncio.gather(fetch_weather(), fetch_traffic())
```

- Immutability removes the need for locks around shared state — there is no
  shared *mutable* state to protect.
- Prefer structured concurrency (bounded, awaited, cancellable as a group)
  over fire-and-forget threads with no join point.
- Compose concurrent effects the same way as sequential ones — `map`,
  `flatMap`, parallel combinators — so retry/timeout/cancellation still apply.

## Algebraic Data Types (ADTs)

Model a domain's possible states explicitly instead of relying on flags,
`null`, or string tags:

```typescript
type PaymentResult =
  | { kind: "approved"; confirmationId: string }
  | { kind: "declined"; reason: string }
  | { kind: "pending" };
```

A type-checker/compiler enforces that all cases are handled at every pattern
match; adding a new case later makes every unhandled `match`/`switch` fail to
compile — a feature, not a nuisance, because it surfaces every call site that
needs updating.

## Common Pitfalls

| Pitfall | Fix |
| --- | --- |
| Exception-based control flow for expected failures | Use `Option`/`Either` (or `Result`); reserve exceptions for truly unexpected errors. |
| Hidden impurity (reading a global, clock, or singleton inside a "pure" function) | Pass all inputs explicitly as arguments; push impurity to the edges. |
| Mutating shared collections in place | Return new immutable values; use persistent/structural-sharing data structures. |
| Over-using higher-order functions for trivial cases | A simple loop is fine when it's clearer; readability beats cleverness. |
| Running IO actions in isolation and gluing results imperatively | Compose IO values *before* executing (`flatMap`/`then`), then run once — preserves retry/timeout/cancellation. |
| Treating `Option`/`Either` as just "another null check" and unwrapping immediately | Chain `map`/`flatMap` through the whole pipeline; unwrap only at the boundary that must produce a final result. |
| Sharing mutable state across concurrent tasks "just this once" | Keep all cross-task communication through immutable values / message passing, no exceptions "just this once". |
| Overusing point-free composition until code becomes unreadable | Fall back to named intermediate functions when a composed chain stops reading like the problem it solves. |

## Testing Pure Code

Pure functions are trivial to test — no setup, no mocks, no teardown:

```python
def test_apply_discount():
    assert apply_discount([100, 50], 0.1) == 135.0
    assert apply_discount([100, 50], 0.5) == 75.0

def test_parse_failure():
    result = parse_show("invalid")
    assert result == Left("Can't parse: invalid")
    # No side effects occurred; the assertion alone proves the behavior
```

For code built on IO-as-values, substitute a fake/test interpreter (a stub
`IO` runner, an in-memory filesystem, a fake clock) so the pure composition
logic is exercised without touching real infrastructure — reserve integration
tests for the thin boundary layer that actually performs I/O.

## Checklist

- [ ] All public functions are pure, or clearly isolated as IO/effect-wrapped
- [ ] No function reads or mutates hidden external/global state
- [ ] Values are immutable by default; mutation is the deliberate exception
- [ ] Functions are passed as parameters wherever behavior needs to vary
- [ ] Error cases are encoded in the return type, not raised as exceptions
- [ ] Side-effectful actions are described as values and composed before being run
- [ ] Domain states are modeled as ADTs with exhaustive pattern matching
- [ ] Unit tests for pure functions need no mocks, no fixtures, no teardown
- [ ] Concurrent code is free of shared mutable state and manual locking
