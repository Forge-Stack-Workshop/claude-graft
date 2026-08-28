---
description: Write or update the flow document for a feature, and reconcile docs/coverage.md
argument-hint: <feature name, entry point, or path>
---

Produce the flow document for: $ARGUMENTS

**Read the code. Never write this from the conversation, from intent, or from
what the feature was supposed to do** — a flow written from intent documents a
system that does not exist, and it will be trusted during an incident.

## 1. Trace it

Start at the entry point and follow the calls. Read each function you land in;
do not infer a chain from names. Note, as you go: the real symbols, the order,
the layer each call belongs to, every branch, and what happens on failure at
each step.

Stop tracing at the process boundary — a database call, an HTTP call to another
service, a queue publish. Name the boundary and what is expected across it.

## 2. Write `docs/flows/<feature>.md`

```markdown
# <Feature>

**Trigger:** <route / command / job / event> — `module.symbol`

## Chain

```mermaid
sequenceDiagram
    ...
```

| # | Call | Layer | Does |
| - | ---- | ----- | ---- |
| 1 | `module.function` | presentation | <one line> |

## Business rules applied

| Rule | Enforced at | Symbol |
| ---- | ----------- | ------ |
| <rule in business language> | step N | `module.symbol` |

## Failure behaviour

| Step | Failure | Raised | Caller sees | Rolled back |
| ---- | ------- | ------ | ----------- | ----------- |

## Boundaries

- Does **not** <what>, that is `flows/<other>.md`.
```

Every symbol is written so it can be grepped. A step you could not fully trace
is marked `<!-- unverified -->` with what blocked you — never quietly smoothed
over.

## 3. Reconcile `docs/coverage.md`

For each business rule in the flow, state how far it is actually enforced, and
where enforcement stops. Add any scenario this flow does **not** handle, with
its reason: deliberate scope, known debt with a ticket, or blocked upstream.

If the flow revealed a rule that is only partially enforced, say so plainly.
That discovery is the point of the exercise, not an inconvenience.

## 4. Report

List: the file written, the business rules mapped, the steps you could not
verify, and any gap between what the code does and what the coverage file
claimed before you started. That last one is the most valuable line — surface
it, do not fix it silently.
