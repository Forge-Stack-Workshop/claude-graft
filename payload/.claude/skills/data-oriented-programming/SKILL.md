---
name: data-oriented-programming
description: Data-Oriented Programming (DOP) — a paradigm that treats data as a first-class citizen, separate from behavior. Covers the four DOP principles (separate code from data, represent data with generic structures, keep data immutable, separate schema from representation), structural sharing for cheap immutable updates, and when this paradigm fits better than OOP or classic FP.
origin: biblio (Data-Oriented Programming, Yehonathan Sharvit, Manning, 2022)
---

# Data-Oriented Programming

Data-Oriented Programming (DOP) is one paradigm among several — alongside
object-oriented programming (OOP) and functional programming (FP) — for organizing
a system's code and data. It is not tied to a specific language: it can be practiced
in JavaScript, Java, Python, Clojure, or any language that supports generic
associative structures (maps/dictionaries) and functions. DOP borrows immutability
from FP and can coexist with either OOP or FP code as long as the four principles
below are honored.

Use this skill as one lens to evaluate a design, not as a mandate to rewrite
everything. Many codebases mix paradigms deliberately (e.g., OOP for framework
integration, DOP for the data layer). State clearly which paradigm you are applying
and why.

## When to Activate

- Designing a data model that must stay flexible (new fields/shapes added often)
  without touching many class definitions.
- A system suffers from an explosion of narrow, single-purpose data classes/DTOs
  that each need bespoke getters, serializers, and mappers.
- Debugging state-related bugs caused by mutable objects shared across components
  (aliasing bugs, "who changed this field").
- Building features that need cheap versioning/history of data (undo, time-travel
  debugging, optimistic concurrency, audit trail).
- Serializing/deserializing data across process or network boundaries (the data
  already looks like maps/arrays — JSON, protobuf-decoded structures).
- Comparing OOP vs FP vs DOP trade-offs before committing to an architecture, or
  explaining why a proposed design combines code and data in a way that will hurt
  reuse and testability later.
- NOT for: performance-critical numeric/array code where typed structs and static
  layout matter more than flexibility (there DOP's generic maps add overhead); nor
  for domains where the type system's compile-time guarantees are the primary
  safety mechanism and a schema-on-write generic structure would remove them without
  compensating validation.

## The Four Principles of DOP

### Principle #1 — Separate code from data

Code lives in functions (or static methods) whose behavior does not depend on
state hidden in their own lexical scope or instance fields. Data lives in
data-only entities: plain records/maps that carry no behavior.

- This is orthogonal to OOP vs FP. You can break it in FP by closing over mutable
  state in a closure; you can honor it in OOP by using pure "data classes"
  (containers of fields only, no business methods) and separate static classes
  or free functions for logic.
- Breaking it: a class whose methods read/write the object's own fields to decide
  behavior (e.g., `author.isProlific()` reaching into `this.books`).
- Honoring it: a plain `Author` data holder (fields only) plus a
  free function `isProlific(author)` that receives the data as an argument.
- Benefit: functions become reusable across any data shape carrying the fields
  they need — a function operating on `{firstName, lastName}` works for both an
  `Author` and a `User` record without inheritance or duplication.
- Cost: more entities in the system (data entities + function modules), so
  navigating "who does what" requires grepping for functions instead of following
  a single class. Mitigated by Principle #4 (explicit schemas) which documents the
  shape each function expects.

### Principle #2 — Represent data with generic data structures

Prefer generic, language-native structures — maps/dictionaries and
arrays/lists — over bespoke classes for representing data.

- Concretely: an `Author` is `{"firstName": ..., "lastName": ..., "books": ...}`,
  not an instance of a dedicated `Author` class.
- Benefit — generic functions: a small set of built-in map/array operations
  (`get`, `merge`, `keys`, `map`, `filter`, `reduce`) works uniformly on *any*
  data, instead of writing bespoke accessors/mappers per class. "Better to have
  100 functions operate on one data structure than 10 functions on 10
  structures."
- Benefit — flexible data model: adding a `fullName` field to author data is
  just adding a key. In classic OOP without this principle, adding a derived
  field would require a new class (`AuthorDataWithFullName`) or ceremony
  (builder/copy constructor changes) everywhere the original class is used.
- Cost: loses compile-time shape guarantees a class/struct would give you — a
  typo in a key name is a runtime bug, not a compile error. Principle #4
  (separate schema) is the DOP answer to this cost: validate shape at the
  boundary instead of encoding it in the type system.

### Principle #3 — Data is immutable

Data entities are never mutated in place. An "update" produces a new version;
the old version remains valid and unchanged.

- Enables safe sharing: any component holding a reference to a data value can
  trust it will never change under it — no defensive copying, no aliasing bugs.
- Enables cheap history/versioning: keeping every past version is affordable
  because you already produce a new value per change, not throwaway diffs.
- Cost of naive immutability is a full copy per change (O(n) memory per update).
  DOP addresses this with **structural sharing**: an update creates a new root
  structure that shares all unchanged sub-parts (subtrees/sub-arrays) with the
  previous version, and only the path from the root to the changed node is
  copied. This is the same technique persistent data structures use (Clojure's
  persistent vectors/maps, Immutable.js). Net effect: near-O(log n) or O(1)
  amortized cost per update instead of O(n), while every prior version remains
  a valid, complete, immutable snapshot.
- In languages without built-in persistent structures, approximate this with a
  library providing structural sharing, or with disciplined "copy-on-write" only
  at the mutation boundary (never mutate what you did not just construct).

### Principle #4 — Separate data schema from data representation

Keep an explicit schema (e.g., JSON Schema, a validation spec, a Zod/Pydantic
model used only at the boundary) describing the expected shape of data,
separate from the generic maps/arrays that carry the data at runtime.

- The schema is optional metadata, checked where it matters (public API
  boundary, function preconditions, tests) — not baked permanently into every
  value the way a class's field list is.
- This directly compensates the cost introduced by Principle #2: you regain
  shape validation and self-documentation without giving up structural
  flexibility, and different call sites can validate against different partial
  schemas of the same generic data.
- Practical pattern: validate at the edges (deserialization, API input,
  function entry point for library code) and trust the data internally between
  validated boundaries — do not re-validate on every internal function call.

## Applying DOP Deliberately

1. Identify the data entities in the feature (nouns), separately from the
   behaviors (verbs) that operate on them.
2. Represent each entity as a generic map/record; do not create a class per
   entity unless the host language or framework requires it (e.g., an ORM
   model) — in that case, keep the ORM model as thin storage and route business
   logic through separate functions/services.
3. Write behavior as functions taking data as an explicit argument and
   returning new data — never mutating the input.
4. Attach a schema at each data-entry boundary (deserialization, public
   function signature, API endpoint) instead of relying on the data structure
   itself to enforce shape.
5. When an update is needed, construct a new value (or rely on a
   structural-sharing/persistent-data library) rather than mutating in place.

## Pitfalls

- **Cargo-culting "everything is a map."** Not every entity benefits from
  genericity — a value object with fixed, small, stable fields and strong
  invariants (e.g., a `Money` amount+currency pair) may be better served by a
  typed value object with validation in its constructor. Apply DOP where
  flexibility and cross-cutting generic operations pay off, not universally.
- **Losing all compile-time safety.** Skipping Principle #4 (no schema at
  boundaries) turns "generic and flexible" into "untyped and fragile" — typos
  in field names become silent runtime bugs. Always pair generic
  representation with boundary validation.
- **Naive immutability without structural sharing.** Deep-copying an entire
  large structure on every update defeats the performance case for DOP; use a
  persistent-data-structure library or explicit structural sharing, not
  `copy.deepcopy`-per-write.
- **Hidden mutation through the generic structure.** Generic maps/arrays are
  usually mutable by default in most languages (JS objects, Python dicts).
  Immutability (Principle #3) must be enforced deliberately (freezing,
  persistent-structure libraries, or a discipline of "always return a new
  object") — genericity alone does not give you immutability.
- **Reintroducing hidden state via closures.** Principle #1 is broken just as
  easily in FP as in OOP: a function that closes over mutable state in its
  lexical scope has the same coupling problem as a stateful object method.
- **Mixing schema validation into hot paths.** Re-validating the full schema
  on every internal call (instead of only at trust boundaries) adds needless
  overhead and signals that boundaries aren't clearly defined.
- **Treating DOP as strictly superior to OOP/FP.** It solves specific
  problems (data flexibility, safe sharing, cheap versioning) at a specific
  cost (weaker static shape guarantees, more indirection between data and
  behavior). State the trade-off explicitly when recommending it over an
  existing OOP or typed-FP design.
