---
name: java-patterns
description: Modern Java idioms—lambdas, streams, Optional, CompletableFuture, default methods, records, sealed types, pattern matching, reactive patterns, and functional composition for cleaner, more expressive code.
origin: Modern Java in Action (Manning)
---

# Modern Java Patterns

Functional programming techniques and modern Java idioms for writing cleaner, more maintainable code, from Java 8 lambdas/streams through Java 17+ records, sealed types, and pattern matching.

## Prerequisites (preflight)

```bash
command -v javac || echo "WARN: install a JDK"
command -v mvn || echo "WARN: install Maven"
```

## When to Activate

- Refactoring imperative loops into declarative stream pipelines
- Handling null safely with Optional instead of null checks
- Composing asynchronous operations with CompletableFuture
- Designing APIs with functional interfaces, method references, and lambdas
- Migrating to functional composition over inheritance
- Modeling data with records and closed hierarchies with sealed types
- Replacing instanceof/cast chains with pattern matching
- Working with Java modules and default methods in interfaces
- Reviewing code for parallel-stream misuse or blocking async chains

## Lambda Expressions & Functional Interfaces

Lambdas allow you to pass behavior as code without boilerplate anonymous classes.

**Core pattern:** `(parameters) -> body`

```java
// Before: anonymous class (verbose)
button.setOnClickListener(new ActionListener() {
    public void actionPerformed(ActionEvent e) { System.out.println("clicked"); }
});

// After: lambda (concise)
button.setOnClickListener(e -> System.out.println("clicked"));
```

**Functional interfaces:** any interface with a single abstract method (`@FunctionalInterface`); the compiler treats it as a lambda target — `Function<T, R>` (transform), `Predicate<T>` (test), `Consumer<T>` (side effect), `Supplier<T>` (supply), `Comparator<T>` (order), `BiFunction`/`UnaryOperator`/`BinaryOperator` (extra arity/typing).

**Composition:** chain behaviors via `andThen`, `compose`, `and`/`or`/`negate` (Predicate).

```java
Function<Integer, Integer> doubleThenAdd = f.andThen(x -> x + 2);
Predicate<String> shortOrEmpty = p1.or(p2);
```

## Method References

Method references (`::`) are shorthand for lambdas that call one existing method — prefer them over a lambda that only forwards its arguments.

```java
// Lambda that just forwards arguments
inventory.sort((a1, a2) -> a1.getWeight().compareTo(a2.getWeight()));

// Method reference — clearer intent, no argument juggling
inventory.sort(comparing(Apple::getWeight));
```

**Four kinds:** static (`Integer::parseInt`), bound instance method (`expensiveTransaction::getValue`), unbound instance method where the receiver becomes the first parameter (`String::length`), constructor (`Apple::new`).

**Pitfall:** don't force a method reference where a short, self-explanatory lambda reads better — readability drives the choice, not "always use `::`".

## Streams: Declarative Data Processing

Streams replace loops with a functional pipeline: **source → intermediate operations → terminal operation**.

```java
// Imperative (nested loops, temporary variables)
int sum = 0;
for (Dish dish : menu) {
    if (dish.getCalories() < 400) sum += dish.getCalories();
}

// Declarative (stream pipeline)
int sum = menu.stream()
    .filter(dish -> dish.getCalories() < 400)
    .mapToInt(Dish::getCalories)
    .sum();
```

**Key operations:** `filter(predicate)` selects, `map(function)` transforms, `flatMap(function)` flattens nested streams, `collect(collector)` aggregates, `reduce(identity, op)` combines, `sorted()`/`distinct()`/`limit(n)`/`skip(n)` shape the stream, `mapToInt`/`mapToLong`/`mapToDouble` avoid boxing in numeric pipelines.

**Pitfall:** streams are **lazy** — terminal operations trigger evaluation; intermediate operations alone do nothing. A stream is also **single-use**: reusing a consumed stream throws `IllegalStateException`.

### Collectors

`Collectors` aggregate data: `toList()`, `toSet()`, `groupingBy()`, `partitioningBy()`, `averaging()`, `summarizing*()`, `joining()`, `toMap()`, `reducing()`, `teeing()` (Java 12+, combine two downstream collectors into one result).

```java
Map<Dish.Type, List<Dish>> byType = menu.stream()
    .collect(groupingBy(Dish::getType));

// Multi-level grouping: type, then calorie band
Map<Dish.Type, Map<CaloricLevel, List<Dish>>> byTypeAndLevel = menu.stream()
    .collect(groupingBy(Dish::getType, groupingBy(Dish::getCaloricLevel)));

// teeing: compute two aggregates in a single pass
var stats = menu.stream()
    .collect(teeing(counting(), summingInt(Dish::getCalories), Stats::new));
```

**Pitfall:** `toMap()` throws `IllegalStateException` on duplicate keys unless you pass a merge function — always supply one (`toMap(keyFn, valueFn, (a, b) -> a)`) when key uniqueness isn't guaranteed.

### Parallel streams

`.parallelStream()` splits work across the common `ForkJoinPool`, but it isn't free speed.

**Pitfalls:** costly for small datasets or cheap-per-element work (splitting/merging overhead dominates); `ArrayList`/arrays split cheaply, `LinkedList`/I/O sources split poorly; never share mutable state across parallel lambdas (a shared counter becomes racy); measure with a profiler before parallelizing — "looks CPU-bound" is not evidence.

## Optional: Null Safety

`Optional<T>` wraps a value that may or may not exist. Replace null checks with `Optional` methods.

```java
// Before: null checks everywhere
String name = person.getCompany().getName();  // NPE risk

// After: Optional chain
Optional<String> name = person.getCompany()
    .flatMap(Company::getName)
    .map(String::toUpperCase);

String display = person.getName().orElse("unknown");
person.getName().ifPresentOrElse(System.out::println, () -> log.warn("no name"));
```

**Key methods:** `map()`, `flatMap()`, `filter()`, `or()`, `orElse()`, `orElseGet()`, `orElseThrow()`, `ifPresent()`, `ifPresentOrElse()`.

**Pitfalls:**
- `Optional` is a return-value wrapper, not a "Maybe monad replacement" for fields — don't declare a field or a method parameter as `Optional<T>`.
- Never call `.get()` without checking `.isPresent()` first — that reintroduces the exact NPE-style crash `Optional` exists to prevent.
- `orElse(expensiveCall())` always evaluates the argument eagerly, even when the value is present — use `orElseGet(() -> expensiveCall())` to defer it.

## CompletableFuture: Async Composition

`CompletableFuture` models a value that will be computed asynchronously. Compose multiple async operations without callback hell.

```java
CompletableFuture<User> user = fetchUser(id);

// Chain a synchronous transform, then compose a dependent async call
user.thenApply(User::getName)
    .thenAccept(System.out::println);
user.thenCompose(u -> fetchOrders(u.getId())).thenAccept(orders -> {...});

// Combine independent futures / race the first to complete
priceFuture.thenCombine(discountFuture, (price, discount) -> price * discount);
CompletableFuture.allOf(f1, f2, f3).thenRun(() -> {...});
CompletableFuture.anyOf(f1, f2).thenApply(result -> {...});
```

**Key methods:** `thenApply()`, `thenAccept()`, `thenCompose()`, `thenCombine()`, `allOf()`, `anyOf()`, `exceptionally()`, `handle()`, `whenComplete()`.

**Pitfalls:**
- Always add error handling with `exceptionally()` or `handle()` — an unhandled exception in a chain fails silently until you call `.get()`/`.join()`.
- Prefer the `*Async` variants (`thenApplyAsync`, with an explicit `Executor`) for CPU-bound or blocking steps — chaining everything on the caller's thread (or the shared `ForkJoinPool.commonPool()`) can starve other tasks.
- Calling `.get()`/`.join()` immediately after creating a future defeats the purpose — kick off all independent futures first, then join.

## Default Methods & Interface Evolution

Default methods allow interfaces to evolve without breaking implementations.

```java
public interface Collection<T> {
    default boolean isEmpty() { return size() == 0; }  // subclasses inherit, can override
}
```

**Use for:** backward compatibility, bulk operations, helper methods.

**Multiple inheritance of type:** if a class implements two interfaces with conflicting defaults, it **must override** and disambiguate with `A.super.foo()`.

**Pitfall:** overusing defaults as a trait/mixin pattern keeps classes thin but can obscure where behavior actually lives — document the contract, don't just rely on the default.

## Records, Sealed Types & Pattern Matching

Modern Java (17+) gives concise, data-oriented alternatives to verbose POJOs and `instanceof` chains.

**Records** — immutable data carriers with a generated constructor, accessors, `equals()`, `hashCode()`, `toString()`; a compact constructor adds validation:

```java
record Point(int x, int y) {
    Point {
        if (x < 0 || y < 0) throw new IllegalArgumentException("negative coordinate");
    }
}
```

**Sealed types + pattern matching for `switch`** — a closed hierarchy known at compile time, matched exhaustively with no `default` and no downcasting:

```java
sealed interface Shape permits Circle, Rectangle {}
record Circle(double radius) implements Shape {}
record Rectangle(double width, double height) implements Shape {}

double area(Shape shape) {
    return switch (shape) {
        case Circle c -> Math.PI * c.radius() * c.radius();
        case Rectangle r -> r.width() * r.height();
    };
}
```

**Pattern matching for `instanceof`** — replaces cast-after-check boilerplate:

```java
// Before
if (obj instanceof String) {
    String s = (String) obj;
    System.out.println(s.length());
}

// After
if (obj instanceof String s) {
    System.out.println(s.length());
}
```

**Pitfalls:**
- Adding a case to a `permits` list without updating every `switch` over it will now fail to compile (the switch is exhaustive) — treat that compile error as the intended safety net, not noise to suppress.
- Records are for immutable data, not for entities with identity or mutable lifecycle — don't force a JPA entity or a mutable builder target into a record.
- `var` infers the type at the call site only — don't use it when the right-hand side doesn't make the type obvious to the reader (`var result = process(x);` hides the return type).

## Java Modules & Encapsulation

Java 9+ modules enforce boundaries: `module-info.java` declares exported packages and dependencies.

```java
module com.example.app {
    requires com.example.lib;
    exports com.example.app.api;   // com.example.app.internal stays hidden
}
```

**Benefit:** strong encapsulation, clearer contracts, smaller runtime image (`jlink`).

**Pitfall:** over-modularization adds ceremony for little benefit in small codebases — start coarse-grained, split only along real deployment/team boundaries.

## Reactive Patterns & Backpressure

Reactive streams model async data flow with demand signaling (backpressure), matching `java.util.concurrent.Flow` (`Publisher`, `Subscriber`, `Subscription`, `Processor`).

```java
// Publisher (source) → Subscriber (consumer), demand signaled explicitly
publisher.subscribe(new Subscriber<T>() {
    private Subscription subscription;
    @Override public void onSubscribe(Subscription sub) { subscription = sub; subscription.request(10); }
    @Override public void onNext(T item) { System.out.println(item); subscription.request(1); }
    @Override public void onError(Throwable e) { }
    @Override public void onComplete() { }
});
```

**Pattern:** **source** emits items → **sink** consumes → backpressure slows the source if the sink can't keep up.

**Libraries:** Project Reactor, RxJava, Akka Streams — all build on the same `Publisher`/`Subscriber` contract.

**Pitfall:** backpressure not handled = unbounded buffering = memory leaks or `OutOfMemoryError` under load; never call a blocking operation inside `onNext`.

## Checklist

- [ ] Loops replaced with streams where semantics stay clear (not forced for its own sake)
- [ ] Method references used instead of pass-through lambdas
- [ ] Null references wrapped in Optional for API return values (not fields/parameters)
- [ ] `orElseGet()` used instead of `orElse()` when the default is expensive to compute
- [ ] Async operations composed via CompletableFuture, not nested callbacks
- [ ] Error handling on every CompletableFuture chain (`exceptionally`/`handle`)
- [ ] Lambdas kept short (1–3 statements); extract longer logic to named methods
- [ ] Records used for immutable data carriers; sealed types for closed hierarchies
- [ ] Pattern matching (`switch`/`instanceof`) replacing manual cast chains
- [ ] Parallel streams profiled before use, never sharing mutable state
- [ ] Module boundaries defined if breaking into packages
- [ ] Backpressure handled in reactive code
