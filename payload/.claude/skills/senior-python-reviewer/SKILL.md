---
name: senior-python-reviewer
description: Review code for naming clarity, function cohesion, proper error handling, test quality, and architectural smells. Applies Clean Code principles (Martin) to assess readability, maintainability, and adherence to single-responsibility. Detects complexity, duplication, boundary violations, and suggests concrete refactors.
origin: Clean Code — A Handbook of Agile Software Craftsmanship, Robert C. Martin
---

# Senior Code Reviewer (Clean Code)

Assess code submissions using Clean Code principles, language-agnostic: naming
precision, function cohesion (one thing), comment necessity, formatting
consistency, object/data-structure boundaries, error handling strategy, test
structure, and class design. Flag code smells and propose concrete, minimal
refactors — not rewrites. Output is a review, not a lecture: every finding
names the exact line/symbol and gives the fix.

## When to Activate

- **Code review submission**: PR/diff ready for merge, requires senior-level critique.
- **Architectural inconsistency**: suspected SRP violation, layer mixing, unclear boundaries.
- **Complexity flag**: function/method > ~20-40 lines, deep nesting (> 2-3 levels),
  cyclomatic complexity creeping, long parameter lists, callback pyramids.
- **Error handling review**: exception strategy unclear, error codes/sentinels
  returned instead of exceptions, catch-all blocks, swallowed errors.
- **Test quality concern**: cryptic test names, bloated setup, vague or multiple
  assertions per test, flaky/order-dependent tests.
- **Naming debt**: cryptic identifiers (`d`, `tmp`, `mgr`, `flag`), over-generic
  function names (`process`, `handle`, `doStuff`), inconsistent vocabulary for
  the same concept.
- **Duplication or dead weight**: copy-pasted blocks, commented-out code, unused
  parameters/imports, speculative generality nobody uses yet.

## Review Method

1. Read the diff/file once for intent before critiquing form — understand what
   problem the code solves.
2. Scan top-to-bottom: each function should read like a paragraph, calling
   functions below it at one level of abstraction lower (the "stepdown rule").
3. Apply the techniques below, in order of impact: correctness-adjacent issues
   (error handling, boundaries) before style (naming, formatting).
4. For every finding: cite the exact location, name the smell, give a minimal
   before/after fix. No vague "consider improving readability."
5. Close with LGTM or CHANGES NEEDED plus a short list of blocking items only —
   nits go in a separate non-blocking section.

## Techniques

### 1. Naming Precision (Reveal Intent)
- Reject abbreviations and single letters, except loop counters in a tight,
  short scope (`for i in range(3)`).
- A name states *what* it is/does, not *how* it's implemented or *when* it's used.
  - Bad: `d = get_data()` — data of what? for what?
  - Good: `active_users = fetch_active_users()`
- Method/function names are searchable and unambiguous verbs: avoid `process()`,
  `handle()`, `manage()`, `doThing()`. One word per concept — don't alternate
  `fetch`/`retrieve`/`get` for the same operation across the codebase.
- Class names are nouns/noun phrases (`InvoiceMailer`), not verbs.
- Avoid encodings/prefixes that repeat the type or scope (Hungarian notation,
  `m_`, `str_`) — the type system and the name should already say enough.

### 2. Function/Method Cohesion (Do One Thing)
- Flag any function mixing unrelated concerns at different abstraction levels
  (e.g., parsing input, hitting the network, and logging, all inline).
- Small: a handful of lines is normal; past ~20-40 lines, question it. Few
  parameters (ideally ≤3, flag >5) — a long parameter list is itself a smell,
  often masking a missing object.
- No side effects hidden in a function whose name doesn't advertise them
  (a `isValid()` that also mutates state is a lie).
- Extract till it hurts, then stop: one level of extraction that clarifies is
  good; extracting a single-use one-liner into a same-file helper with no
  reuse and no naming gain is noise.
- Test: can this function's purpose fit in one clear sentence, with no "and"?
  If not, split it along that "and".

### 3. Comments: Prefer Self-Explanatory Code
- Comments explain *why* (business rule, non-obvious constraint, workaround),
  never *what* the next line does — that's the code's job.
- Flag comments that restate code (`x += 1  # increment x`) → delete.
- Flag commented-out code → delete (version control remembers it).
- Good comment: `# retry: this endpoint is flaky under load, confirmed with ops`.
- A comment explaining confusing code is a signal to rewrite the code, not to
  keep the comment.

### 4. Error Handling Over Control-Flow Codes
- Flag functions returning sentinel/error codes (`-1`, `None` meaning "failed",
  `False` meaning "invalid") that the caller must remember to check.
- Prefer raising/throwing exceptions close to the source, catching them at
  system boundaries (API handlers, job entrypoints, CLI commands).
- Define exception types around what the *caller* needs to do about them, not
  around the internal cause.
- Error handling is itself "one thing" — a `try` block's body should not also
  carry unrelated happy-path logic; extract the operation being guarded.
- Never let a caller receive `null`/`None`/`nil` silently where an empty
  collection or an explicit exception was intended — this pushes null-checks
  onto every caller.

### 5. Objects vs. Data Structures — Don't Blur the Boundary
- A class with only getters/setters and no behavior is a data container —
  make it a plain data class/struct/record, not an "object" with fake methods.
- Objects hide their data behind behavior (tell, don't ask); data structures
  expose data and carry no behavior. Mixing both ("hybrid") is worse than
  either pure form — hard to add new types *and* hard to add new operations.
- Don't confuse a domain object (behavior-rich, encapsulated) with a DTO,
  config record, or wire-format payload (data-rich, no behavior).
- Law of Demeter: a method should only talk to its direct collaborators, not
  reach through a chain (`a.getB().getC().doSomething()` — a "train wreck").

### 6. Formatting & Structure
- Consistent indentation, line length, whitespace — delegate to the
  auto-formatter/linter; don't spend review comments on anything a formatter
  would fix.
- File/module reads top-to-bottom like a newspaper: high-level concepts first,
  details below, related concepts kept close together (vertical proximity).
- Guard clauses over deep nesting — return/continue/raise early instead of
  wrapping the rest of the function in an `if`.
- One concept per line/statement; avoid dense one-liners that pack multiple
  operations no one can debug by inspection.

### 7. Boundaries & API Clarity
- Public methods/functions have a clear, minimal contract: what goes in, what
  comes out, what it throws — via signatures, types, or a short docstring for
  anything non-obvious.
- Private/internal members are marked as such (`_prefix`, module-private,
  package-private) and never reached into from outside their owning unit.
- Don't return references to internal mutable state — return a copy or an
  immutable view; a caller mutating your internals is a bug waiting to happen.
- Wrap third-party/external APIs behind a thin adapter owned by the codebase,
  so an upstream change or vendor swap touches one place, not every call site.

### 8. Test Quality
- One behavior verified per test; multiple assertions are fine if they check
  facets of the *same* behavior, not unrelated scenarios bolted together.
- Test names state scenario + expected outcome:
  `test_duplicate_email_raises_validation_error`, not `test_user_2`.
- Setup is minimal and obvious; if setup is elaborate, the code under test is
  probably too coupled or doing too much.
- No unseeded randomness, no real wall-clock time in assertions (freeze/mock
  time), no test order dependency, no shared mutable state between tests.
- Tests are as clean as production code: same naming and cohesion rules apply
  — a bloated test is a maintenance liability, not "just a test."
- Fast, independent, repeatable, self-validating (pass/fail, no manual log
  reading), and written/updated alongside the change (not after, not "later").

### 9. Class Design: Single Responsibility
- One reason to change: a class does one job and knows about it clearly from
  its name and its (short) list of methods.
- Flag "God Objects" mixing unrelated concerns — e.g., a `User` class doing
  validation, persistence, authentication, and notification.
- Refactor along seams: `User` (domain data/rules), `UserRepository`
  (persistence), `UserAuthenticator` (auth), `UserNotifier` (email/SMS).
- High cohesion: methods and fields of a class should be tightly related; low
  cohesion is a sign the class should split.
- Depend on abstractions at the boundary, not on concrete low-level details —
  but don't introduce an interface/abstraction for a single implementation
  with no foreseeable second one (speculative generality).

## Gotchas & Anti-Patterns to Flag

- **"Clean code takes too long"**: sloppy code costs more later, in the same
  sprint. Naming, small functions, and clear error handling are not luxuries.
- **Comment proliferation**: excessive comments signal unclear code — refactor
  instead of documenting the confusion.
- **Fake cohesion**: a function named for one responsibility that quietly does
  three internally (e.g., `validate()` that also persists and emails).
- **Silent failures**: catch-all blocks that swallow the error, log nothing (or
  log and continue), and return a default value — breaks debuggability and
  hides real failures from callers.
- **Mixed layers**: business rules in a view/controller, DB queries in a
  serializer, outbound API calls in a model — impossible to unit test in
  isolation.
- **Flaky/lottery tests**: pass sometimes, fail sometimes — almost always a
  race condition, real-time dependency, or shared/leaked state.
- **Vague assertions**: `assert result` with no message. Should carry the
  actual and expected values in the failure output.
- **Boy Scout violation**: a diff that touches a file and leaves it messier or
  no cleaner than found, when a trivial cleanup was in scope.
- **Speculative generality**: abstract base classes, config flags, or plugin
  hooks built for a future need nobody has asked for yet.
- **Feature envy**: a method more interested in another class's data than its
  own — usually belongs on that other class instead.

## Quick Checklist

- [ ] Public functions/classes have a clear contract (types/docstring where non-obvious).
- [ ] No oversized function (~20-40 line guideline) or excessive parameter count (>5).
- [ ] Exceptions/errors raised and typed meaningfully, not sentinel return codes.
- [ ] No bare/blanket `except`/`catch(Exception)` that swallows the error.
- [ ] Names reveal intent; no abbreviations, no inconsistent vocabulary.
- [ ] Comments explain *why*; none restate the code; no commented-out code left in.
- [ ] Objects (behavior) and data structures (fields) are not blurred into hybrids.
- [ ] Private/internal members are marked and not reached into from outside.
- [ ] Classes have one reason to change (SRP); no God Objects.
- [ ] Tests: one behavior per test, descriptive name, minimal setup, no randomness/timing flakiness.
- [ ] Nothing a formatter/linter should have caught is raised as a manual comment.
- [ ] Diff leaves touched files at least as clean as it found them.
