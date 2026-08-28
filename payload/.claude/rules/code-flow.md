# Code flow and coverage — the gold book

A function is agnostic by nature. It says what it does, never what problem it
answers: that lives in the **chain of calls**. A docstring will never describe a
sequence, and it will never describe a **gap**. Yet the sequence and the gap are
exactly what cost two developers an afternoon in front of a production incident.

So the documentation site carries three things of different natures, and the
distinction is the whole point:

| | Source | Answers |
| --- | --- | --- |
| `docs/flows/` | **hand-written** | who calls what, in what order, and on failure |
| `docs/coverage.md` | **hand-written** | what is handled, and above all what is not |
| `docs/api/` | **generated** from docstrings | what one precise function does |

The schema gets the same treatment under `docs/data-model/` — see
`database.md` and the `data-model-map` skill.

**Shipping a behaviour without updating its flow and its coverage is not
shipping it.** Like the README, this goes in the same commit, unasked.

- A flow is written **from the code, by reading it**. A flow written from intent
  describes the feature you meant to build.
- An unhandled scenario appears in `docs/coverage.md` **explicitly, with its
  reason**. Silence is the failure mode: a scenario absent from the file is
  indistinguishable from a scenario nobody thought about.
- **No tool will ever tell you a flow diagram lies.** CI checks that the site
  builds and that links resolve; truth is review work. Verify a flow by
  re-reading the code it claims to describe.

Use the `feature-flow` skill to write one, or `/code-flow <feature>`.
