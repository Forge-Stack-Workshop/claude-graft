---
name: python-patterns
description: Python data model, sequences, collections, functions as objects, closures, decorators, OOP design, iterables, generators, coroutines, concurrency patterns, and metaprogramming techniques for idiomatic, fluent code.
origin: "Fluent Python (2015 edition) — Ramalho"
---

# Python Patterns

Idiomatic Python techniques for expressive, performant, maintainable code.
Applies to any Python codebase, regardless of framework.

## When to Activate

- Designing classes with rich behavior (dunders, protocols)
- Building efficient sequences, mappings, or custom collections
- Creating reusable function abstractions (closures, decorators, callbacks)
- Implementing iteration and lazy evaluation (generators, iterables)
- Writing concurrent or async workflows (coroutines, threads, processes)
- Metaprogramming (descriptors, metaclasses, dynamic type creation)
- Reviewing code for non-idiomatic or unsafe Python constructs

## Data Model & Dunder Methods

The data model is a set of protocols the interpreter invokes for operators and
built-in syntax — implement the right dunder and a type gets `for`, `+`,
`len()`, `with`, `[]`, hashing, and comparisons "for free."

**Core dunders:**
- `__init__`, `__repr__`, `__str__` — lifecycle and representation.
  `__repr__` must be unambiguous (debugger/log-friendly); `__str__` falls
  back to it if absent.
- `__len__`, `__getitem__`, `__setitem__`, `__delitem__` — sequence protocol
- `__iter__`, `__next__` — iteration protocol
- `__enter__`, `__exit__` — context managers (`with`)
- `__call__` — callable objects
- `__eq__`, `__lt__`, `__hash__` — comparison/hashing. Defining `__eq__` sets
  `__hash__` to `None` unless declared explicitly — decide if the type
  should be hashable (immutable value objects: yes; mutable: no).
- `__add__`/`__radd__`, `__mul__`, `__truediv__` — operator overloading;
  implement the reflected `__r*__` to support the operand on the left.
- `__bool__` — falls back to `__len__` if absent, else `True`.

Avoid dunders with surprising side effects — behavior should match what the
operator/syntax implies elsewhere in the language.

## Sequences, Mappings & Sets

**Sequence protocol:** `__len__` + `__getitem__` (accepting slices) gets
iteration, slicing, and `in` for free — no `__iter__` needed.

**Dict/set performance:** membership and lookup are O(1) average (hash
table) vs O(n) for `list.count()`/`x in list`/manual loop — always use
`set`/`dict` for repeated membership tests.
- `dict.get(key, default)` / `setdefault(key, default)` — avoids a
  redundant lookup vs. `d[key]` + `KeyError` handling.
- `collections.defaultdict(list)` — removes "init key if missing"
  boilerplate.
- `collections.Counter` — purpose-built tallying, supports arithmetic.

**Ordering:** `dict` preserves insertion order (3.7+ guaranteed).

**Tuples as records:** prefer `collections.namedtuple` or
`@dataclass(frozen=True)` over an unnamed tuple once fields need names or
reuse.

**Unpacking:** `a, *rest = seq`, `*head, tail = seq`, and nested unpacking
(`lat, (lo1, lo2) = point`) avoid manual slicing.

**Custom collections:** inherit `collections.abc.MutableMapping` /
`Sequence` / `MutableSequence` — implement only the abstract methods, get
`.get()`, `.items()`, `__contains__`, etc. for free. Prefer composition
(wrap a `list`/`dict`) over subclassing the built-in directly — built-ins
don't consistently call overridden dunders.

## Functions as Objects

Functions are first-class: pass them around, store in collections, return
them, inspect their attributes.

```python
def apply_twice(func, arg):
    return func(func(arg))

apply_twice(lambda x: x + 1, 5)  # 7
```

Prefer a named function or comprehension over `map()`/`filter()`/`reduce()`
for readability. Use `operator.itemgetter`/`attrgetter`/`methodcaller` for
sort/extract keys — clearer and faster than an equivalent `lambda`.
`functools.partial` freezes some arguments of a callable into a new one —
cleaner than a wrapping `lambda` for callbacks.

**Callable objects:** implement `__call__` for a function-like object that
retains state across calls (configurable strategies, memoizing wrappers).

## Closures & Decorators

**Closures:** an inner function captures free variables from its enclosing
scope by reference (via closure cells), not by value — they stay live even
after the enclosing call returns. Use `nonlocal` to rebind (not just read)
a captured variable.

```python
def make_multiplier(n):
    def multiplier(x):
        return x * n
    return multiplier

times3 = make_multiplier(3)  # 15 = times3(5)
```

**Decorators:** wrap a callable to alter its behavior — sugar for
`func = decorator(func)` at definition time.

```python
import functools

def timing(func):
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        start = time.perf_counter()
        try:
            return func(*args, **kwargs)
        finally:
            print(f"{func.__name__} took {time.perf_counter() - start:.3f}s")
    return wrapper
```

Always apply `functools.wraps` — otherwise the wrapper loses `__name__`,
`__doc__`, and introspection metadata. A parameterized decorator is a
decorator *factory*: three nested calls,
`decorator_factory(config)(func)(*args)`. `functools.lru_cache` memoizes a
pure function keyed on its (hashable) arguments.

## OOP Design

**Composition over inheritance:** favor delegating to a collaborator over
deep inheritance chains — inheritance couples a subclass to a superclass's
implementation, not just its interface.

**Protocols over inheritance:** duck typing / `typing.Protocol` — a class
satisfies an interface by having the right methods, no base class required.

**ABCs:** use `abc.ABC` + `@abstractmethod` when subclasses must implement
specific methods, so incomplete subclasses can't be instantiated.

**MRO:** multiple inheritance is linearized (C3 linearization,
`Cls.__mro__`); always call `super()`, never a hardcoded base class name.

**`@property`:** expose computed/validated attributes via attribute syntax;
avoid hidden I/O or heavy computation behind a property without documenting
it. **`@classmethod`** (receives `cls`) for alternative constructors
(`from_json`); **`@staticmethod`** only for a helper with no class/instance
state that's conceptually grouped with the class.

**`__slots__`:** removes per-instance `__dict__` on high-cardinality value
objects — cuts memory, blocks accidental new attributes; skip on classes
needing dynamic attributes or slotted multiple inheritance.

## Iterables & Generators

**Iterable vs iterator:** an iterable implements `__iter__` (returns an
iterator, fresh each call); an iterator implements `__iter__` (returns
self) + `__next__` (raises `StopIteration` when exhausted) — an iterator
is single-use.

**Generators:** a function with `yield` compiles to a generator — a
lightweight, single-use iterator with no hand-rolled iterator class; state
pauses/resumes automatically between `yield`s.

```python
def countdown(n):
    while n > 0:
        yield n
        n -= 1
```

**Generator expressions:** `(x**2 for x in range(1_000_000))` — lazy,
never materializes fully; prefer over a list comprehension when the whole
sequence isn't needed at once (feeding `sum()`, `any()`, another generator).

**`yield from`:** delegates iteration to a sub-generator, flattening nested
chains; in coroutines it also forwards `send()`/`throw()`/`close()`.

**`itertools`:** `chain`, `islice`, `groupby` (input must be pre-sorted on
the key), `tee`, `takewhile`/`dropwhile` — composable lazy building blocks,
prefer them over hand-rolled equivalents.

## Coroutines & Async

Generator-based coroutines (`yield` + `.send()`) are the historical
mechanism; `async def`/`await` is the modern, preferred syntax for
concurrent I/O-bound workflows — not interchangeable with generator-based
coroutines at the syntax level.

```python
async def fetch_all(urls):
    async with httpx.AsyncClient() as client:
        return await asyncio.gather(*(client.get(u) for u in urls))
```

**Concurrency model choice:**
- I/O-bound (network, DB) → `asyncio`, or a thread pool for
  synchronous-only libraries.
- CPU-bound → `multiprocessing` / `ProcessPoolExecutor` — threads don't
  parallelize CPU work under the GIL (pre-3.13 default builds).
- Never call a blocking function inside `async def` without offloading it
  (`asyncio.to_thread`) — it stalls the whole event loop.

Prefer `asyncio.TaskGroup` (3.11+) over bare `gather`/`create_task` — it
cancels sibling tasks on first failure and surfaces errors via
`ExceptionGroup` instead of losing them silently.

## Metaprogramming

**Descriptors:** an object defining `__get__`/`__set__`/`__delete__`,
assigned as a class attribute — underlies `@property`, methods, ORM
fields. A data descriptor (`__set__`) wins over instance `__dict__`; a
non-data descriptor (`__get__` only) can be shadowed by an instance
attribute of the same name.

**Metaclasses:** customize class *creation*; reach for one only after a
class decorator or `__init_subclass__` can't express the requirement —
metaclasses compose poorly and confuse most readers.

**Dynamic type creation:** `type(name, bases, namespace)` builds a class at
runtime — useful for schema-driven frameworks, opaque to static analysis.

**Introspection:** `vars()`, `dir()`, `hasattr()`, `getattr()`, `setattr()`,
`inspect.signature()` — prefer explicit code paths over introspection-driven
dispatch where readability allows it.

## Idiomatic Patterns Worth Reaching For

- **EAFP over LBYL:** `try: d[key] / except KeyError:` is more Pythonic
  (and race-free) than checking `if key in d` first.
- **Context managers for resource lifecycle:** `with` /
  `contextlib.contextmanager` for anything acquired-then-released (files,
  locks, transactions) — guarantees cleanup on exception.
- **`contextlib.suppress`** instead of a bare `try/except: pass`.
- **`match`/`case` (3.10+):** clearer than a long `if/elif` chain when
  branching on a value's shape/type with destructuring.
- **Dataclasses for value objects:** `@dataclass` generates `__init__`,
  `__repr__`, `__eq__`; `frozen=True` for immutability + hashability.

## Common Pitfalls

- **Mutable default arguments:** `def foo(items=[])` — the default is
  created once at definition time and shared across calls. Use
  `items: list | None = None`, initialize inside the body.
- **Shallow copies:** `list(x)`, `dict.copy()`, slicing — copy only the
  top level, nested mutables stay shared. Use `copy.deepcopy()` when
  needed.
- **Late binding in closures/loops:** a closure created inside a loop
  captures the *variable*, not its value — all closures see the final
  value. Fix with a default arg: `lambda x, n=n: x * n`.
- **Unbounded generators:** no terminating condition runs forever when
  fully consumed (`list(gen)`) — pair with `itertools.islice` when the
  source can be infinite.
- **Descriptor shadowing:** a same-named instance attribute can shadow a
  non-data descriptor — store descriptor-managed data under a private name
  (`self._value`).
- **Catching too broadly:** `except Exception:` (or bare `except:`) hides
  programming errors alongside expected failures — catch the narrowest
  recoverable type.
- **`==` vs `is`:** `is`/`is not` only for identity (`None`, sentinels);
  `==` for value equality — small-int/string identity is a CPython
  implementation detail, not a language guarantee.
- **Circular imports from eager `__init__.py`:** re-exporting too much at
  package-init time couples unrelated modules — import lazily inside a
  function when a true cycle is unavoidable.
