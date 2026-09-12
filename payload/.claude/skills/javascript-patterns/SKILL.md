---
name: javascript-patterns
description: Core language patterns—functions, closures, higher-order functions, prototypes/classes, async/await and promises, ES modules, and iterators/generators for idiomatic, maintainable modern JavaScript.
origin: Eloquent JavaScript (2nd ed.), modern JavaScript practices (ES2015+)
---

# JavaScript Patterns

Functional, object-oriented, and asynchronous patterns for idiomatic, maintainable JavaScript.

## Prerequisites (preflight)

Check that Node.js is installed:
```bash
command -v node || echo "WARN: install Node.js"
```

If missing, install Node.js from https://nodejs.org/ or your package manager.

## When to Activate

- Writing reusable functions or designing function signatures
- Managing state and scope with closures
- Composing functions or applying higher-order patterns
- Designing object hierarchies with classes/prototypes
- Handling asynchronous operations (promises, async/await)
- Organizing code into modules (ES modules)
- Building custom iterables or lazy sequences (iterators, generators)

## Functions & Closures

Functions are first-class values: assign them, pass them, return them. Every function call creates a scope (lexical environment) binding its local variables. A closure is a function bundled with the scope it was defined in — it keeps that scope alive, so inner functions can read and update outer variables even after the outer function has returned.

```javascript
function makeCounter() {
  let count = 0;
  return {
    increment: () => ++count,
    value: () => count,
  };
}
const counter = makeCounter();
counter.increment();
counter.increment();
console.log(counter.value()); // 2 — `count` survives between calls
```

**Modern practice:** declare with `const` by default, `let` when reassignment is needed; never `var` — `var` is function-scoped and hoisted, which causes bugs in loops and conditionals. Use arrow functions for short callbacks and to inherit `this` lexically; use named `function` declarations for top-level, self-documenting APIs (they show up better in stack traces).

**Pitfall — closure-over-loop-variable:** with `var` every iteration shares one binding; with `let` each iteration gets its own.

```javascript
for (var i = 0; i < 3; i++) setTimeout(() => console.log(i), 0); // 3 3 3
for (let j = 0; j < 3; j++) setTimeout(() => console.log(j), 0); // 0 1 2
```

## Higher-Order Functions

A higher-order function takes a function as an argument, returns one, or both. This is how JavaScript expresses "do this operation, but let the caller decide the details" — the basis of `map`/`filter`/`reduce`, event handlers, and middleware chains.

```javascript
const numbers = [1, 2, 3, 4];
const doubled = numbers.map((n) => n * 2); // transform
const evens = numbers.filter((n) => n % 2 === 0); // select
const sum = numbers.reduce((total, n) => total + n, 0); // accumulate
```

**Pattern — composition:** build a pipeline out of small, single-purpose functions instead of one large one.

```javascript
const pipe =
  (...fns) =>
  (input) =>
    fns.reduce((value, fn) => fn(value), input);

const process = pipe(
  (s) => s.trim(),
  (s) => s.toLowerCase(),
  (s) => s.replace(/\s+/g, "-"),
);
process("  Hello World  "); // "hello-world"
```

**Pattern — currying / partial application:** fix some arguments ahead of time to specialize a general function.

```javascript
const multiply = (a) => (b) => a * b;
const double = multiply(2);
double(21); // 42
```

Prefer `map`/`filter`/`reduce`/`flatMap` over manual `for` loops for transformations — they name the intent and avoid off-by-one/mutation bugs. Reach for a plain loop only when short-circuiting early or when profiling shows the array methods are a measured bottleneck.

## Prototypes & Classes

Every JavaScript object (except the "prototype root") has an internal link to another object, its prototype. Property lookup walks this chain: if `obj` lacks a property, JavaScript checks `obj`'s prototype, then that object's prototype, and so on. `class` syntax (ES2015+) is sugar over this same prototype mechanism — it doesn't add a new inheritance model, it makes the existing one readable.

```javascript
class Vehicle {
  #fuelLevel; // private field

  constructor(type, fuelLevel = 100) {
    this.type = type;
    this.#fuelLevel = fuelLevel;
  }

  start() {
    return `${this.type} starting with ${this.#fuelLevel}% fuel`;
  }
}

class ElectricVehicle extends Vehicle {
  start() {
    return `${super.start()} (silent motor)`;
  }
}

new ElectricVehicle("scooter", 80).start();
```

**Modern practice:** prefer `class` over hand-written constructor functions and manual `prototype` assignment; use `#field` private fields instead of the old underscore-prefix convention. Use `Object.create(proto)` only when you need prototype delegation without a constructor (rare, e.g. building a dictionary with no inherited `Object.prototype` noise: `Object.create(null)`).

**Pitfall — prototype pollution:** never mutate a built-in prototype (`Array.prototype`, `Object.prototype`). It leaks into every object in the program, including third-party code.

## Async & Promises

A `Promise` represents a value that will exist later — pending, then fulfilled or rejected exactly once. `async`/`await` is syntax for consuming promises as if they were synchronous code, without blocking the event loop.

```javascript
// Promise chaining
fetch("/api/data")
  .then((response) => response.json())
  .then((data) => console.log(data))
  .catch((error) => console.error("fetch failed:", error));

// Equivalent, more readable async/await
async function fetchData() {
  try {
    const response = await fetch("/api/data");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error("fetch failed:", error);
    throw error; // let the caller decide how to react
  }
}
```

**Pattern — concurrency:** run independent async operations in parallel instead of awaiting them one by one.

```javascript
const [user, orders] = await Promise.all([fetchUser(id), fetchOrders(id)]);

// Promise.allSettled when partial failure is acceptable
const results = await Promise.allSettled([fetchA(), fetchB(), fetchC()]);
```

Use `Promise.race()` to implement timeouts, `Promise.any()` to take the first success among several sources. Every promise chain needs a `.catch()` or an enclosing `try/catch` — an unhandled rejection crashes Node processes and silently swallows errors in the browser.

## ES Modules

Each file is its own module with its own scope; explicit `export`/`import` statements are the only way to share bindings between files. Prefer ES modules over CommonJS (`require`/`module.exports`) in new code — they're statically analyzable (better tree-shaking, tooling, circular-dependency detection) and now standard in both browsers and Node.

```javascript
// math.js
export function add(a, b) {
  return a + b;
}
export const PI = 3.14159;
export default class Calculator {
  /* ... */
}

// app.js
import Calculator, { add, PI } from "./math.js";
console.log(add(2, 3)); // 5
```

**Modern practice:** organize modules by domain (`orders/`, `users/`) rather than by technical layer (`models/`, `controllers/`); name a file after its main export; keep one primary export per file. Use dynamic `import()` for code-splitting/lazy loading (`const module = await import("./heavy-feature.js")`).

## Iterators & Generators

The iterator protocol standardizes "give me the next value": an iterable exposes `[Symbol.iterator]()`, which returns an object with a `next()` method producing `{ value, done }`. `for...of`, spread (`...`), and destructuring all consume this protocol — that's why arrays, strings, `Map`, and `Set` all work with `for...of`.

```javascript
class Range {
  constructor(start, end) {
    this.start = start;
    this.end = end;
  }

  [Symbol.iterator]() {
    let current = this.start;
    const last = this.end;
    return {
      next() {
        return current <= last ? { value: current++, done: false } : { value: undefined, done: true };
      },
    };
  }
}

for (const n of new Range(1, 3)) console.log(n); // 1, 2, 3
```

A generator function (`function*`) writes that same protocol without the manual state machine: each `yield` pauses execution and hands back a value; calling `.next()` resumes it.

```javascript
function* range(start, end) {
  for (let n = start; n <= end; n++) yield n;
}
[...range(1, 3)]; // [1, 2, 3]

// Lazy, infinite sequences — only computed as consumed
function* naturals() {
  let n = 1;
  while (true) yield n++;
}
function take(iterable, count) {
  const result = [];
  for (const value of iterable) {
    if (result.length >= count) break;
    result.push(value);
  }
  return result;
}
take(naturals(), 5); // [1, 2, 3, 4, 5]
```

**Pattern:** generators pair naturally with `async` as `async function*` for streaming asynchronous data (paginated API results, file reads) consumed with `for await...of`.

## Pitfalls

- **Scope & `this` confusion:** arrow functions inherit `this` lexically from the enclosing scope; regular functions get `this` from how they're called. Mixing the two in callbacks (e.g. a regular method passed as an event handler) silently rebinds `this`.
- **Closure memory retention:** a closure keeps its whole enclosing scope alive, not just the variables it uses. Large objects captured incidentally in a long-lived closure (e.g. an event listener) prevent garbage collection.
- **Prototype chain mutation:** don't patch `Object.prototype` or a library's prototype — it silently changes behavior for every object in the program.
- **Unhandled promise rejections:** a `.then()` chain without a trailing `.catch()`, or an `await` outside `try/catch`, swallows or crashes on errors. Always terminate a chain with error handling.
- **Blocking on sequential awaits:** `await` the first, `await` the second, `await` the third — when the three are independent, this triples the wall-clock time versus `Promise.all()`.
- **`var` in loops:** `var` is function-scoped, so closures created in a loop all share the same final value; use `let` for per-iteration bindings (see Functions & Closures pitfall above).

---

**Activation trigger:** use this skill when writing functions, managing async flow, structuring modules, designing object hierarchies, or building custom iterables. Reference it during code review for idiomatic, modern-JavaScript patterns.
