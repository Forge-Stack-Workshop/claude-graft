---
name: django-tdd
description: Test-first development methodology combining TDD (unit-level, red-green-refactor) and BDD (specification by example, outside-in, Gherkin) — framework-agnostic, applicable to any language or stack.
origin: biblio — "BDD in Action", John Ferguson Smart, Manning, 1st edition
---

# Test-First Development (TDD + BDD)

Write the specification before the code, at every level. TDD and BDD are not
two rival techniques — BDD is TDD extended: the same failing-test-first
discipline applied first to acceptance criteria (outside), then to units
(inside). Nothing in this skill is tied to a specific test runner, language,
or web framework — apply it with any stack.

## When to Activate

- Starting a new feature and unsure where to begin coding
- Writing acceptance criteria or user stories that keep getting misread by
  developers or QA
- A codebase has good unit-test coverage but still ships wrong behavior
- Onboarding a team onto test-first practice for the first time
- Refactoring legacy code that has no tests and unclear intended behavior
- Reviewing whether "unit tests" are actually testing behavior or just
  implementation details

## Core Distinction: TDD vs BDD

TDD is a two-rule discipline:

1. Don't write any code until you've written a failing test that demonstrates
   why you need this code.
2. Refactor regularly to avoid duplication and keep code quality high.

TDD's real value isn't "have tests" — it's forcing the developer to
understand the functionality in concrete, unambiguous terms *before* writing
it. A better name for it would be "Test-Driven Design."

BDD builds on TDD rather than replacing it. It formalizes what experienced
TDD practitioners already did well, applied consistently at **every** level:

- Outside-in development: start from business-visible acceptance criteria,
  work inward to the code that satisfies them.
- A shared ("ubiquitous") domain language between business and developers,
  so the same words describe the requirement, the test, and the code.
- Examples, not abstractions, to describe behavior — a concrete scenario is
  harder to misunderstand than a rule.
- Specifications, not tests: a low-level test should read as "when X, the
  system should do Y," not as a description of method calls.

Only the audience changes between levels: high-level specifications target
the whole team (including non-developers); low-level specifications target
the developers who will maintain the code.

## Technique 1: Specification by Example / Feature Injection

Before any test is written, discover *what* to build and *why* it matters to
the business. Feature Injection (Chris Matts) frames every feature as a
answer to: what does this feature do, and what business value does the
stakeholder get from it?

Two standard templates for framing a feature:

```
In order to <business goal>
As a <stakeholder>
I want <capability>
```

```
As a <stakeholder>
I want <capability>
So that <business goal>
```

Both are conventions, not laws — the only non-negotiable part is that the
business value is stated explicitly, not implied. Break large features into
smaller stories when a feature is too big to build (and to verify) in one
iteration.

## Technique 2: Given-When-Then Scenarios (Gherkin)

Once a feature/story is understood, express its acceptance criteria as
concrete scenarios using a small structured vocabulary:

- **Given** — preconditions; sets up the test environment/state.
- **When** — the single action under test.
- **Then** — the expected, observable outcome.
- **And** / **But** — chain multiple Given/When/Then steps for readability.

```gherkin
Given a customer has a current account
When the customer transfers funds from this account to an overseas account
Then the funds should be deposited in the overseas account
And the transaction fee should be deducted from the current account
```

Use a **Scenario Outline** with an **Examples** table when the same steps
repeat with different data — this turns several near-duplicate scenarios
into one parameterized one:

```gherkin
Scenario Outline: Earning interest
  Given I have an account of type <account-type> with a balance of <initial-balance>
  When the monthly interest is calculated
  Then I should have earned at an annual interest rate of <interest-rate>
  And I should have a new balance of <new-balance>

  Examples:
    | account-type | initial-balance | interest-rate | new-balance |
    | current      | 10000            | 1              | 10008.33    |
```

A scenario written this way is understandable by a non-developer stakeholder
and unambiguous enough to automate. If it isn't both, it's not done.

## Technique 3: Outside-In Development (Red-Green-Refactor at Every Level)

Outside-in means starting from the outcome the business expects and working
inward to determine what code is actually needed — never the reverse. The
process, applied iteratively per acceptance criterion:

1. Start with one high-level acceptance criterion you want to implement.
2. Automate it as a pending (failing/not-yet-implemented) scenario, broken
   into steps.
3. Implement the step definitions — while doing so, imagine the API/code
   you *wish* you had to make each step trivial to write.
4. Use those step definitions to drive low-level unit tests (specifications)
   that describe how the underlying code should behave.
5. Implement the minimal application code to make the unit test pass, then
   refactor.

Steps 4–5, repeated, are classic red-green-refactor TDD: red (failing unit
test expressing a low-level behavior), green (minimal code to pass it),
refactor (remove duplication, improve design without changing behavior).
The outer loop (steps 1–3) is the same discipline one level up, using
acceptance scenarios instead of unit tests as the "failing test."

No feature is implemented unless it serves an identified business goal; no
code is written unless it exists to make an acceptance test — and therefore
a feature — pass. This constraint is what keeps outside-in from turning into
speculative, unused code.

## Technique 4: Low-Level Specifications, Not "Just Unit Tests"

At the unit level, don't think "write a unit test for this class." Think
"write a specification of how this component should behave, in this
situation, given this input." The difference matters in naming and
structure:

- Name the spec after the behavior under a scenario, not the method under
  test: `WhenCreatingANewAccount` / "account should have a type and an
  initial balance" — not `test_account_constructor`.
- Structure the body as when/then (or given/when/then), mirroring the
  acceptance-level vocabulary, so intent is legible without reading the
  implementation.
- One behavior per test. A test that verifies multiple unrelated behaviors
  hides which one actually broke.

This is the same content as a conventional unit test — the value is
entirely in how it reads six months later, to someone who wasn't in the room
when it was written.

## Pitfalls

- **Writing tests after the code.** Confirms the code does what it does,
  not what it should do — defeats TDD's core value of forcing understanding
  before implementation.
- **Confusing BDD with "acceptance testing only."** BDD's outside-in loop
  reaches all the way to unit-level specifications; stopping at Gherkin
  scenarios and writing implementation-first unit tests underneath is not
  BDD.
- **Scenarios that read like a UI script.** If a Given/When/Then session
  starts to feel like a list of button clicks, the scenario is specifying
  *how*, not *what* — push it back toward business-observable outcomes.
- **Skipping the business-value line.** A feature/story without an explicit
  "so that / in order to" clause tends to drift into speculative scope no
  one asked for.
- **One test class covering many unrelated behaviors.** Fragments failure
  diagnosis — one behavior, one test.
- **Treating TDD as "have coverage."** Coverage is a side effect. The
  discipline is: no code without a preceding failing test that justifies it.
- **Underestimating the ramp-up cost.** Teams new to TDD/BDD measurably slow
  down at first (documented 15–35% initial slowdown alongside 40–90% fewer
  defects in industrial case studies) — expect and plan for this, don't
  abandon the practice at the first friction.
- **Big-bang scenario writing without conversation.** Scenarios discovered
  solo by one role (only QA, or only a developer) tend to encode
  assumptions the other roles would have caught — involve business,
  development, and test perspectives before automating.
