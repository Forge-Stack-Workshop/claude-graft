---
name: csharp-dotnet-patterns
description: C# and .NET language patterns — generics with constraints, nullable value types, LINQ query/method syntax, async/await composition, iterator blocks, delegates, and variance. Grounded in C# 1 through 5 evolution; flag when a task needs a newer feature (records, pattern matching, nullable reference types) not covered here.
origin: biblio
---

# C# / .NET Patterns

Language patterns for idiomatic C#: generics, nullable types, LINQ, async/await,
iterators, delegates, and variance — as the language evolved from C# 1 to C# 5.

## When to Activate

- Designing a generic type or method and choosing constraints (`where T : ...`)
- Modeling optional/absent data with value types (`Nullable<T>`, `decimal?`)
- Writing or reviewing LINQ queries (query syntax vs. method syntax, deferred execution)
- Writing `async`/`await` code, especially around `ConfigureAwait`, composition, or deadlocks
- Reviewing use of delegates, lambda expressions, or iterator blocks (`yield return`)
- Reasoning about array/interface covariance and contravariance

## GUARDRAIL — This skill is grounded in an older edition

Source: *C# in Depth*, 3rd edition (Jon Skeet), covering C# 1 through C# 5
(async/await). It does **not** cover C# 6 through the current language version —
notably **records, non-nullable reference types, pattern matching (`is`/`switch`
expressions), init-only setters, top-level statements, or file-scoped namespaces**.

Before applying this skill to production code on a recent .NET target:

1. Check the target C# language version (`<LangVersion>` in the `.csproj`, or
   `dotnet --version`).
2. If C# 8+ is available, prefer modern idioms where they supersede a pattern
   below (e.g., `record` instead of a hand-rolled immutable class; nullable
   reference types instead of defensive null checks everywhere; switch
   expressions instead of long `if`/`else if` chains).
3. Treat this skill as a foundation for *why* the language works the way it
   does (generics, async internals, LINQ deferred execution) — not as an
   exhaustive list of current-best-practice syntax.

## Generics: type parameters and constraints

A type parameter (`T` in `List<T>`) is a placeholder; a type argument (`string` in
`List<string>`) provides the real type. Constraints (`where T : ...`) restrict what
`T` can be, and unlock operations the compiler otherwise can't verify:

```csharp
struct RefSample<T> where T : class            // T must be a reference type
class ValSample<T> where T : struct             // T must be a value type
public T CreateInstance<T>() where T : new()    // T must have a public parameterless ctor
class Sample<T> where T : Stream                // T must derive from Stream
class Sample<T> where T : IDisposable           // T must implement IDisposable
class Sample<T> where T : IComparable<T>        // T must be comparable to itself
class Sample<T, U> where T : U                  // T must derive from/implement U
class Sample<T> where T : class, IDisposable, new()  // combined constraints
```

Rules worth knowing:

- At most one class constraint, and it must come first when combined with
  interface constraints.
- `new()` must be the last constraint listed.
- `class` and `struct` constraints are mutually exclusive on the same parameter.
- Without a constraint, the compiler only allows operations valid for
  `object` — no arithmetic, no method calls beyond `Equals`/`GetHashCode`/`ToString`.

**Pitfall:** over-constraining a generic type parameter (e.g. requiring a concrete
base class when an interface would do) needlessly narrows what callers can pass.
Constrain to the *minimum* capability the method body actually needs.

## Nullable value types

Value types (`decimal`, `int`, `struct`s) can't natively represent "no value" — a
common problem in database-backed code. C# 1 alternatives were all unsatisfying:

- A reference-type wrapper around the value type (extra allocation, loses
  value semantics).
- A separate boolean flag alongside the value (easy to get out of sync).
- A magic value like `decimal.MinValue` (ambiguous, silently wrong on overlap).

`Nullable<T>` (.NET 2.0) plus the `T?` syntax (C# 2) solves this with a single
character:

```csharp
decimal? price;
public decimal? Price
{
    get { return price; }
    set { price = value; }
}
```

`T?` exposes `.HasValue` and `.Value`, supports `??` (null-coalescing) for
defaults, and lifts most operators (`+`, `<`, `==`) so `decimal? a, b; a + b`
works and propagates `null` correctly. Prefer `??` over manual `HasValue`
checks for default-substitution:

```csharp
decimal actualPrice = price ?? 0m;   // preferred
```

**Pitfall:** don't reach for a magic value or a paired boolean flag when `T?`
already solves the problem — it existed from C# 2 onward for exactly this case.

## LINQ: lambdas and query composition

Lambda expressions (C# 3) let you inline the *condition* right where it's used,
instead of coupling it to a hardcoded action:

```csharp
foreach (Product product in products.Where(p => p.Price > 10))
{
    Console.WriteLine(product);
}
```

Compared to C# 1 (hardcoded loop body) and C# 2 (anonymous methods extracted
into a delegate), this keeps the filter condition and the consuming code
readable side by side, while still letting the predicate come from a variable
or be passed to another method (e.g. an `Action<Product>` instead of a fixed
`Console.WriteLine`).

Query expressions (`from ... where ... select ...`) compile down to the same
method calls (`Where`, `Select`, `GroupBy`, ...) — use query syntax when a
query has multiple clauses (joins, grouping, multiple `from`s) and reads more
naturally as a sentence; use method syntax for single-operator chains.

**Pitfall:** LINQ queries are lazily evaluated (deferred execution) — a query
variable is a *description* of the query, not its result. Iterating the same
query twice re-executes it (re-hits the database, re-enumerates the source).
Materialize with `.ToList()`/`.ToArray()` once if you need a stable snapshot
or plan to enumerate more than once.

## Iterator blocks (`yield return`)

`yield return` (C# 2) lets a method produce a sequence lazily, one element at a
time, without building an intermediate collection:

```csharp
IEnumerable<int> RotateFrom(int startingPoint)
{
    for (int index = 0; index < values.Length; index++)
    {
        yield return values[(index + startingPoint) % values.Length];
    }
}
```

Constraints: every `yield return` in a block must produce a value assignable
to the method's declared yield type; `yield return`/`yield break` are not
allowed inside a `try` block that has any `catch` clauses (only `finally` is
permitted, for cleanup on early enumeration termination).

**Pitfall:** an iterator method's body doesn't run until the caller starts
enumerating (`foreach`, `.MoveNext()`) — exceptions thrown in setup code
inside the iterator surface on the *first* enumeration step, not on the call
that returned the `IEnumerable<T>`. Validate arguments in a separate
non-iterator wrapper method if you want fail-fast behavior.

## async/await composition

Asynchronous methods compose naturally: an `async` method that awaits other
`Task`-returning methods forms a chain, and the compiler handles wrapping/
unwrapping `Task<T>` results. Use `ConfigureAwait(false)` on library/backend
code that doesn't need to resume on the original synchronization context:

```csharp
public async Task<int> ProcessRecordsAsync()
{
    var records = await FetchRecordsAsync()
        .ConfigureAwait(continueOnCapturedContext: false);
    // ... record handling here ...
    await SaveResultsAsync(records)
        .ConfigureAwait(continueOnCapturedContext: false);
    return records.Count;
}
```

Launching independent async operations in parallel, then awaiting all of them:

```csharp
var tasks = urls.Select(async url =>
{
    using (var client = new HttpClient())
    {
        return await client.GetStringAsync(url);
    }
}).ToList();

var results = await Task.WhenAll(tasks);
```

**Pitfall — deadlocks:** blocking on an async call synchronously (`.Result`,
`.Wait()`) from a context that has a synchronization context (UI thread,
classic ASP.NET request context) can deadlock: the awaited task's
continuation wants to resume on that same captured context, which is blocked
waiting for the task to finish. Two mitigations, use both where applicable:

1. `ConfigureAwait(false)` in the library code being awaited, so its
   continuation doesn't need the original context.
2. Prefer `await` all the way up the call stack ("async all the way") instead
   of blocking on a task with `.Result`/`.Wait()`.

**Pitfall — `async void`:** only use `async void` for top-level event handlers
(e.g. UI `Click` handlers) where the signature is fixed by the framework.
Everywhere else, return `Task`/`Task<T>` — `async void` methods can't be
awaited by the caller, and any exception thrown inside one crashes the
process instead of propagating through a `Task`.

## Delegates and variance

Delegates evolved from verbose named-method references (C# 1) to anonymous
methods (C# 2) to lambda expressions (C# 3) without changing their underlying
purpose: decoupling *what to do* from *when/whether to do it*.

Array covariance lets a `string[]` be treated as an `object[]`, but this is
checked at runtime, not compile time — storing a non-`string` into that
`object[]`-typed reference throws `ArrayTypeMismatchException` at the write,
not at compile time:

```csharp
object[] items = new string[3];
items[0] = "ok";
items[1] = 42;   // compiles, throws ArrayTypeMismatchException at runtime
```

Return-type covariance and parameter-type contravariance are *not* supported
for method overriding/interface implementation in this era of C# — plan
signatures accordingly (e.g. via generic interfaces `IEnumerable<out T>`
instead of relying on override covariance).

## Common pitfalls (cross-cutting)

- Treating `T?` handling as optional — always decide explicitly whether
  `null` is a valid business state or a bug before dereferencing `.Value`.
- Re-enumerating a LINQ query expecting cached results (deferred execution).
- Blocking on async code (`.Result`/`.Wait()`) instead of awaiting — deadlock
  risk plus wasted thread-pool threads.
- Forgetting `ConfigureAwait(false)` in reusable/library async code that has
  no UI/request-context dependency.
- Applying `yield return` validation logic inside a `try`/`catch` block
  (unsupported) instead of a `try`/`finally`.
- Assuming this skill's syntax is exhaustive for a modern .NET codebase —
  re-check against the current C# language version (see Guardrail above).
