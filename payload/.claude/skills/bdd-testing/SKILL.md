---
name: bdd-testing
description: Behavior-Driven Development — Gherkin scenarios, specification by example, feature injection, example mapping, and living documentation. Use when writing acceptance criteria collaboratively, converting user stories into executable specifications, or setting up Cucumber/Behave/pytest-bdd test suites.
origin: biblio
---

# BDD Testing

Behavior-Driven Development (BDD) uses concrete examples and structured natural
language (Gherkin) to turn requirements discovery into executable specifications
that double as living documentation.

## When to Activate

- Writing or reviewing Gherkin `.feature` files (Given/When/Then scenarios)
- Running a requirements discovery session with business + dev + test (Three
  Amigos, Example Mapping, Feature Mapping)
- Turning a user story into acceptance criteria before implementation starts
- Setting up or reviewing a Cucumber, Behave, pytest-bdd, or SpecFlow test suite
- Deciding whether a scenario belongs in the feature file or in step definitions
- Producing living documentation from executable specifications

## Core Idea

BDD is not a testing framework choice — it is a requirements-discovery and
collaboration practice. The tooling (Cucumber, Behave, pytest-bdd, SpecFlow,
JBehave) is a mechanism to make specifications executable, not the goal itself.
The value chain:

```
Business goal → Features → Examples → Executable specifications
                                              ↓
                          Automated tests + Living documentation
```

Examples are preferred over prose requirements because natural-language specs
are ambiguous, while concrete examples ("Tess has $1000, transfers $500,
ends with $500") are unambiguous and testable.

## Discovery Techniques

### Feature Injection

Work backward from the business goal to the features that deliver it, instead
of collecting a feature wishlist with no questions asked. Standard framing:

```
In order to <business goal/benefit>
As a <role>
I want <feature>
```

For finer-grained stories within a feature, switch to:

```
As a <role>
I want <capability>
So that <benefit>
```

Only build features traceable to a business goal — this is the filter against
scope creep and gold-plating.

### Example Mapping

A lightweight, timeboxed (~25 min) facilitation technique to explore a story
before writing scenarios, using colored cards on a board:

- **Yellow card**: the user story/feature under discussion
- **Blue cards**: business rules that govern the story
- **Green cards**: concrete examples and counter-examples that illustrate
  each rule
- **Pink cards**: open questions with no answer yet — do not block on them,
  surface and park them

If a story generates too many rules/cards to explore in the timebox, it is
too big — split it. This session output feeds directly into Gherkin scenarios
(one green card ≈ one scenario candidate).

### Three Amigos

Bring together a business/domain expert, a developer, and a tester before
implementation starts. Each role catches different gaps: the domain expert
supplies real examples, the developer probes technical edge cases, the tester
asks "what if" and hunts corner cases. Conversations alone — even before
automation — measurably reduce defects.

## Gherkin Structure

A feature file groups a short business-value statement with the scenarios
that illustrate it:

```gherkin
Feature: Transferring money between accounts
  In order to manage my money more efficiently
  As a bank client
  I want to transfer funds between my accounts whenever I need to

  Scenario: Transferring money to a savings account
    Given Tess has a current account with $1000
    And a savings account with $2000
    When she transfers $500 from current to savings
    Then she should have $500 in her current account
    And she should have $2500 in her savings account

  Scenario: Transferring with insufficient funds
    Given Tess has a current account with $1000
    And a savings account with $2000
    When she transfers $1500 from current to savings
    Then she should receive an 'insufficient funds' error
```

Keyword semantics:

- **Given** — sets up preconditions/context, prepares the test environment
- **When** — the single action under test
- **Then** — the expected, observable outcome
- **And / But** — chain multiple Given/When/Then steps for readability

### Scenario Outlines

Collapse related scenarios that differ only by data into one table-driven
scenario:

```gherkin
Scenario Outline: Earning interest
  Given Tess has a <account-type> account with $<initial-balance>
  And the interest rate for <account-type> accounts is <interest>
  When the monthly interest is calculated
  Then she should have earned $<earnings>

  Examples:
    | initial-balance | account-type | interest | earnings |
    | 10000            | Current      | 1.0      | 8.33     |
    | 10000            | Savings      | 3.0      | 25       |
```

### Background

Factor out Given steps repeated across every scenario in a feature:

```gherkin
Background:
  Given the following user accounts exist:
    | Username | Role  |
    | tess     | admin |
```

## Automation (Cucumber / Behave / pytest-bdd / SpecFlow)

All mainstream BDD tools bind Gherkin steps to code via a matcher (regex or
cucumber-expression) and a step-definition function. The pattern is the same
regardless of language:

```python
# pytest-bdd / Behave style
@given("Tess has a current account with ${int}", target_fixture="account")
def account_with_balance(balance):
    return Account(balance=balance)

@when("she transfers ${int} from current to savings")
def transfer(account, savings, amount):
    account.transfer_to(savings, amount)

@then("she should have ${int} in her current account")
def assert_balance(account, expected):
    assert account.balance == expected
```

Practical workflow: write the `Then` step first (the outcome you want to
prove), then the `When` step (which usually reveals the API/service you need
to build), then the `Given` step (test data setup) last. This "outcome
backward" order keeps you focused on behavior rather than implementation
details.

## Writing Good Scenarios

### Declarative, not imperative

Imperative scenarios describe UI mechanics (click, type, select) and break
whenever the UI changes, even if the business rule is untouched. Declarative
scenarios describe intent and stay valid across UI/implementation changes.

```gherkin
# BAD — imperative, coupled to the UI
When I enter "Paris" into the city field
And I set price range to "Any"
And I hit "search" button

# GOOD — declarative, describes the business rule
When I look for a hotel within 10 km of Paris for 2 nights on 04-04-2019
```

A declarative step can be implemented against a web page, a REST API, or the
domain model directly — the scenario's validity does not depend on which.

### One rule per scenario

A scenario that searches, books, pays, and logs out in one flow answers no
question clearly when it fails. Split into focused scenarios that each prove
a single business rule. Reserve one or two full end-to-end scenarios for
high-level user journeys; put the bulk of coverage into narrow, single-rule
scenarios.

### Meaningful actors

Prefer named personas ("Tess", "Bindi the frequent traveler") over generic
first-person ("I") once you move past login/auth flows — a persona anchors
the scenario in a real user context and clarifies why the rule matters.

### Scenario titles

State the outcome being tested, not implementation steps, and never restate
the expected result in the title (that belongs in Then).

## Living Documentation

Executable specifications are a byproduct: every passing/failing scenario
is simultaneously a regression test and an up-to-date functional document.
To get real value from this:

- Organize features/scenarios so a non-technical reader can browse "what the
  system does" without reading code.
- Publish generated reports (HTML from Cucumber/Serenity/Allure, or
  equivalent) as the canonical up-to-date functional reference — not a
  separately maintained wiki page that drifts from reality.
- Treat a broken scenario as broken documentation, not just a broken test —
  fix immediately rather than skip/quarantine, or the documentation becomes
  untrustworthy.

## Common Pitfalls

- **UI-coupled (imperative) scenarios** — break on cosmetic changes; rewrite
  in declarative/business-intent style.
- **Overloaded scenarios testing multiple rules** — hard to debug on
  failure; split by business rule.
- **Scenarios as scripted manual test cases** — cramming an entire user
  journey (search → book → pay → logout) into one scenario is a symptom of
  treating Gherkin as an old-style test script, not a specification.
- **Skipping the conversation, jumping straight to Gherkin** — writing
  scenarios alone at a desk defeats the collaborative-discovery purpose;
  facilitate with Example Mapping / Three Amigos first.
- **Treating Given/When/Then as free text** — most tools bind on these
  keywords; using them loosely (e.g., multiple When steps for unrelated
  actions) breaks the single-action-under-test contract and confuses
  readers.
- **Letting living documentation rot** — if scenario reports aren't
  reviewed/published, the "living" documentation becomes stale prose,
  losing the main BDD payoff.
- **No traceability to a business goal** — a feature with no "In order to…"
  benefit statement is a sign no one asked why it's needed; risk of building
  unused functionality.
