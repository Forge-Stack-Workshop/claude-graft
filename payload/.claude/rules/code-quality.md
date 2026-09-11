# Code quality — anti-patterns rejected by default

Correctness first, then obvious. These are defects to fix, not warnings to
carry. Typed errors and failure behaviour live in `errors.md`.

## Constants and magic values

- **No hardcoded constants.** Thresholds, business rules, labels, URLs, magic
  numbers do not live as inline literals — they come from external config
  (YAML/env) read through a typed loader. Only language-level enums are exempt.
- **No literal HTTP status codes.** A bare `200`, `404`, `422`, `500` in code or
  in a test is forbidden — use the constant the framework ships
  (`status.HTTP_404_NOT_FOUND`, `HTTPStatus.NOT_FOUND`, a typed status enum).
  The same generalises: when the standard library publishes the constant for a
  protocol value (HTTP methods, MIME types, headers, exit codes), import it —
  never retype the literal.

## Structure

- **No code duplication — the second occurrence is an extraction order.** The
  first occurrence is code, the second is a factoring order: the logic moves to
  a shared module and both call sites consume it. A near-duplicate diverges
  silently. The one exception is a deliberate copy that decouples two projects
  on purpose, documented as such.
- **Prefer a lookup table to a state machine.** Branching on a value — dispatch,
  routing, handler selection, enum → behaviour — is a hash table (`dict`/`Map`)
  from key to handler, not an `if/elif` ladder or a `switch` cascade. The
  mapping is data: declared once, typed, exhaustive, extended by adding a row.
  An explicit state machine is legitimate only when transitions carry
  state-dependent semantics no table can express — and even then the transitions
  live in a table, not nested conditionals.
- **Decompose into small, independently unit-testable methods.** A function does
  one thing at one level of abstraction. Pure business rules are separated from
  orchestration and from I/O, so a test exercises the rule with no DB, HTTP, or
  filesystem. A helper that is hard to test in isolation means the seam is in
  the wrong place.

## Named functions over anonymous ones

- A named function is the default. A `lambda`/arrow is only ever a short inline
  key or predicate (`sorted(items, key=lambda i: i.rank)`, a one-to-three-line
  `map`/`filter` callback). Assigning a lambda to a name is a `def` written
  badly.
- Forbidden: an anonymous function longer than ~3 lines, a nested named function
  over 5 lines (extract it to the top level), and clever one-liners that trade a
  reader's minute for a writer's second. If you cannot name the expression in
  three words, it is doing too much to stay anonymous.

## Basic optimisations (algorithmic, not clever)

No speculative micro-optimisation and no premature caching — but the basic wins
are non-negotiable because they are algorithmic:

- Right data structure — membership test on a `set`/`Map` (O(1)), not a linear
  scan; a dict lookup instead of a nested loop.
- No loop-invariant work in a loop — hoist the constant computation, the
  compiled regex, the config read.
- **No N+1.** A query inside a `for` over rows is a defect: batch or eager-load.
  An existence check uses an exists-query, not a full fetch then a length.
- Bounded resources — no unpaginated list endpoint, explicit timeouts on every
  outbound call, indexes on columns used to filter or sort a large table.
- Named and rejected: god object/function, boolean-trap parameters, primitive
  obsession over a value object, deep nesting (guard clauses instead), mutable
  default arguments, shared mutable global state, stringly-typed domains, and
  dead code kept "just in case" (version control is the archive).

## A cache is a correctness contract

The moment a value is cached, three questions must have answers or the cache is
a bug: **how it expires**, **how it is invalidated**, and **what it may not
hold**. Caching is read-through behind the data-access layer, never scattered
`get`/`set` in business code; every entry has a TTL from config (a literal
`3600` in a decorator is the defect) and the store is bounded. A write
invalidates the entries it affects. An authorization decision is never cached
across principals, and personal/secret data only within its classification.
