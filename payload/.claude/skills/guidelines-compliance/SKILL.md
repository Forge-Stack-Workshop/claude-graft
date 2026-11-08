---
name: guidelines-compliance
description: Pragmatic programming principles for maintainable, decoupled, and adaptable systems. DRY, orthogonality, Design by Contract, tracer bullets, prototypes, decoupling, estimation, refactoring, testing, and pragmatic team practices.
origin: "The Pragmatic Programmer: From Journeyman to Master (Hunt & Thomas, 1999)"
---

# Guidelines Compliance

Pragmatic developers apply timeless principles to write code that evolves with
requirements, rather than code that merely works today. This skill is
technology-agnostic: apply the principles below regardless of language,
framework, or architecture style.

## When to Activate

- Designing a new module, API, or feature to minimize coupling and duplication
- Refactoring existing code that violates DRY, orthogonality, or Design by Contract
- Estimating timeline and resource needs for a task or release
- Building tracer bullets, prototypes, or spikes to test architecture or algorithm decisions
- Reviewing code for architectural orthogonality and single-source knowledge
- Writing tests to specify behavior, catch regressions, and validate contracts
- Building shared frameworks, tooling, or a team's domain language
- Deciding how to split work across a team, or how to escalate a schedule slip

## Core Principles

### DRY: Don't Repeat Yourself

Every piece of knowledge must have a single, unambiguous, authoritative
representation within a system. DRY is broader than "don't copy-paste code" —
it covers duplicated business rules, duplicated documentation, duplicated
data (a value cached in two places), and duplicated intent expressed through
parallel data structures that must be kept in sync by hand.

**Pitfall:** copy-pasting code to "save time" creates maintenance debt — every
bug fix and feature change must now be found and applied everywhere the code
was copied, and inevitably one copy is missed.

**Fix:** extract duplicated logic into a shared function, module, or
configuration value. Generate repetitive boilerplate from a single source
(schema, template, code generator) instead of hand-copying it. When two teams
solve the same problem independently, that is DRY violated organizationally,
not just in one repo.

### Orthogonality

Two components are orthogonal when a change in one has no effect on the
other. Aim for designs where unrelated things stay unrelated: a change to
storage should not force a change to validation; a change to logging should
not force a change to business rules.

**Bad:** a `UserRepository` that parses JSON, validates email formats, and
formats output. A change to the JSON library ripples into unrelated
validation logic.

**Good:** `UserRepository` handles persistence only. JSON parsing, email
validation, and formatting are separate, focused components it depends on
but does not embed.

**Benefit:** orthogonal systems are easier to test in isolation, easier to
extend without side effects, and easier to reuse in a different context.
Orthogonality also reduces risk: a bug in one component is contained, and a
team can work on one component without stepping on another team's code.

### Design by Contract

Treat every function, method, or API boundary as a contract with three parts:

- **Precondition** — what the caller must guarantee before calling (valid
  inputs, required state).
- **Postcondition** — what the routine guarantees on return, if the
  precondition held.
- **Invariant** — what must remain true across the routine's execution (or
  for a class, across the lifetime of the object).

Document contracts explicitly at module and API boundaries — don't leave
callers to infer them from reading the implementation. Related to
orthogonality: a routine with a narrow, well-specified contract ("shy" code)
depends on less and exposes less, which is exactly what keeps modules
decoupled.

**Enforcement:** if a precondition is violated, fail fast — raise an
exception or assert — rather than attempting to compensate or silently
continuing with corrupted state. A dead program normally does a lot less
damage than a crippled one.

**Design to test:** when designing a module or routine, design its contract
and the code that tests that contract at the same time — the contract *is*
the test specification.

### Tracer Bullets

Build a thin, end-to-end slice of the system first — one that touches every
architectural layer (UI/API, business logic, storage, integration) with
minimal functionality, but that actually runs. A tracer bullet is not a demo:
it gathers real requirements feedback, proves the architecture holds
together, and becomes part of the production system, growing incrementally
from there.

**Example:** for a new reporting feature, ship "click button → empty report
renders end-to-end" before building any of the real aggregation logic. This
surfaces integration issues (auth, routing, deployment) early, while they are
still cheap to fix.

**Not to confuse with prototypes:** tracer bullets are kept and extended;
prototypes are thrown away.

### Prototypes and Spikes

When a tracer bullet doesn't fit — a risky algorithm, an unfamiliar library,
an uncertain UI interaction — build a throwaway prototype to test that one
assumption before committing to a full design.

When prototyping, decide up front what you can safely ignore: correctness of
edge cases, complete error handling, adherence to standards, eventual
performance. A prototype answers one question ("does this approach work at
all?") — anything not needed to answer that question is waste.

**Discipline:** throw the prototype away once it has answered its question.
Do not evolve prototype code into production code — rewrite the real thing
with the lessons learned, this time with the contracts, tests, and error
handling the prototype skipped.

### Decoupling

Minimize the number of things one module must know about another. Hide
implementation details behind an interface; expose only what callers
genuinely need.

**Law of Demeter:** an object should not reach through another object to
manipulate a third. Call methods on your immediate collaborators only —
`order.customer().address().city()` chains couple you to the entire object
graph; ask the immediate collaborator to do the work instead
(`order.billingCity()`).

**Techniques:** dependency injection instead of hardcoded references, events
or callbacks instead of direct calls, abstractions in code with variable
details pushed into external metadata/configuration (this also decouples
*when* something changes from *when code must be redeployed*).

### Estimation

Break large tasks into small, independently estimable units before
estimating the whole. Use units that match the actual precision you have:
hours for a task you've done ten times, days or story points for something
new. An estimate without an uncertainty band ("3 days") is really a guess
dressed as a number — state it as a range ("3 days ± 1 day") so stakeholders
understand the confidence level.

For algorithmic work specifically, estimate the *order of growth*
(O(n), O(n log n), O(n²)) before writing the implementation, and validate
that estimate against real timings once the code exists — profile and plot
runtime against input size rather than assuming the analysis was correct.

**Practice:** track estimate vs. actual after each task. The gap is
information — it recalibrates the next estimate, and over time it is the
only reliable way to answer "how long will X take?" for your team.

### Refactoring

Improve a system's internal structure without changing its observable
behavior. Refactor early and often — the longer a design has decayed, the
more code depends on the decay, and the more expensive it becomes to fix.
Keep a running list of things that need refactoring so nagging small issues
don't get lost.

**Discipline:**
- Refactor only when you have passing tests to refactor against.
- Change one thing at a time; re-run tests after each change.
- Never refactor and add a feature in the same commit — mixing the two makes
  it impossible to tell whether a later regression came from the behavior
  change or the restructuring.

### Testing

Tests specify behavior; treat "coding" as unfinished until its tests pass —
finishing the implementation and finishing the feature are not the same
event. Write tests before or alongside the code they verify, not as an
afterthought once everything "seems to work."

**Test state coverage, not just code coverage.** Executing every line once
proves little if it's always executed with the same data and in the same
order — the state the system is in, and the order operations happen in,
affects behavior at least as much as which lines ran. Vary both.

**Find bugs once.** Once a human finds a bug, turn it into an automated
regression test immediately — a human should never need to find the same bug
twice. Consider a "saboteur" role in code review specifically hunting for
gaps in the test suite itself, not just gaps in the code.

**Pragmatic approach:** not every line needs a dedicated unit test, but every
public interface, every documented contract, and every known edge case does.
Layer in integration and performance tests to catch what unit tests, by
construction, cannot see.

### Pragmatic Teams

- **Organize around functionality, not job function** — a team built around
  a feature/domain keeps ownership orthogonal to the org chart, the same way
  modules stay orthogonal to each other.
- **Share knowledge:** pairing, code review, and documentation prevent single
  points of failure (bus factor).
- **Collective ownership:** anyone can improve any module — this is what
  makes orthogonality and DRY enforceable across a whole codebase, not just
  within one person's files.
- **Automated checks:** CI/CD gates (lint, tests, security scans) are the
  team's enforcement mechanism for every principle in this file — a review
  comment is advice, a failing pipeline is a contract.
- **Reversibility:** prefer decisions and designs that can be undone. Fear of
  an irreversible choice is a bigger risk to a project than the choice itself.
- **Don't repeat organizationally:** two teams silently building the same
  utility is DRY violated at the org level — communicate and reuse.

## Techniques

1. **Extract to variable/function** — once a concept appears a second or
   third time, name it and define it once (DRY).
2. **Spike or prototype** — when uncertain about one specific risk, build a
   throwaway experiment to answer that one question, then delete it.
3. **Interface-first design** — write the contract (precondition,
   postcondition, invariant) before the implementation.
4. **Dependency injection** — pass collaborators in; never hardcode a
   reference to a concrete dependency inside a routine.
5. **Code generator / templates** — for repetitive boilerplate (schemas,
   config, migrations), generate from one authoritative source.
6. **Breakdown for estimation** — slice a task until each piece is estimable
   with confidence; track actuals against every estimate.
7. **Tracer bullet MVP** — for a new feature, wire the thinnest possible
   end-to-end path first, then thicken it incrementally.
8. **Automated tests as spec** — write the test that encodes the contract
   before, or alongside, the code that must satisfy it.
9. **Order-of-growth check** — estimate algorithmic complexity before coding,
   confirm it with profiling data afterward.
## Common Pitfalls

- **Premature DRY** — extracting an abstraction before the pattern is
  understood. Wait until you see the duplication two or three times, then
  refactor; a wrong abstraction is worse than a little duplication.
- **Coupling through global/shared mutable state** — a shared global couples
  every consumer to every other consumer, defeating orthogonality even when
  the code looks modular on the surface.
- **Over-isolating components** — orthogonality taken so far that components
  can no longer collaborate without excessive indirection; balance
  independence with actual usability.
- **Contracts too loose** — preconditions/postconditions so weak they let bad
  inputs or bad outputs pass silently, defeating the point of the contract.
- **Prototype code shipped as production** — a prototype "already works," so
  it quietly becomes permanent, along with all the correctness and error
  handling it was designed to skip.
- **Estimates without uncertainty** — stating false precision ("exactly 5
  days") when the honest answer is a range; this destroys stakeholder trust
  once reality diverges from the number.
- **Refactoring without a safety net** — restructuring code with no passing
  tests to catch regressions, or mixing refactor and new behavior in one
  change so a broken test can't be attributed to either.
- **Tests that don't test** — overly permissive assertions
  (`assert result is not None` instead of `assert result == expected_value`)
  that pass regardless of whether the behavior is actually correct.
- **Testing code coverage instead of state coverage** — treating 100% line
  coverage as proof of correctness while never varying input state or
  operation order.
- **Bugs found twice** — fixing a reported bug without adding a regression
  test, so the same bug resurfaces after the next refactor.
