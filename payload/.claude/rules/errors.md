# Errors and failure

## Two families, never mixed

- **Domain errors** are expected outcomes: the rule refused. They are part of
  the contract, named in the domain's vocabulary (`InsufficientStock`, not
  `ValueError`), and the caller is expected to handle them.
- **Infrastructure errors** are the world misbehaving: timeout, connection
  reset, disk full. They are not the domain's business and never cross into it
  wearing a domain type.

An adapter translates the second into the first, or lets it rise. It never
returns `None` to mean "it failed".

## Rules

- **Never swallow an exception.** A bare `except:` or an empty `catch` is a bug,
  including when the comment says "should never happen".
- Catch the narrowest type you can act on. Catching broadly to log and re-raise
  is fine; catching broadly to continue is not.
- **Fail loudly at the boundary, degrade gracefully in the core** — not the
  reverse. A malformed request is rejected; a slow optional enrichment is
  skipped.
- An error message names what failed, with what input, and what the caller can
  do about it. Preserve the cause when re-raising (`raise ... from`).
- What reaches a client says what to fix, never how the system is built — see
  `security.md`.

## Calling out

- **Every outbound call has a timeout.** No exception, no default of "infinite".
  An untimed call is how one slow dependency takes down everything upstream.
- Retry only what is safe to repeat, with exponential backoff and a cap. A
  retry on a non-idempotent write is data corruption with extra steps.
- A mutation that can be retried carries an idempotency key, and repeating it
  yields the same result rather than a second effect.
- Decide what happens when a dependency stays down: fail fast, serve degraded,
  or queue. Write the choice in the feature's flow document — an undocumented
  failure mode is the one that pages you (`code-flow.md`).
