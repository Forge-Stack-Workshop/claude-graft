---
name: best-practices-review
description: Engineering practices for code review, test sizing, style guides, deprecation, monorepo-scale changes, and CI/CD at scale — grounded in decades of large-organization software engineering experience, not just tooling.
origin: biblio
---

# Best Practices Review

Software engineering, as distinct from programming, is "programming integrated
over time." A single script only needs to work once; a codebase maintained by
many people over years needs processes that keep it correct, comprehensible,
and changeable as it scales. This skill collects the process-level practices
that make that possible: code review, test sizing, style guides, deprecation,
large-scale change management, and CI/CD at organizational scale.

## When to Activate

- Reviewing or designing a code review process (what reviewers should check,
  how fast reviews should happen, who owns the "looks good to me").
- Deciding how to size and structure a test suite (unit vs. integration vs.
  end-to-end, and where flakiness comes from).
- Writing or auditing a style guide, or resolving a "the linter says X but I
  prefer Y" argument.
- Planning to deprecate or remove a system, API, or dependency.
- Making a change that touches many files or many repositories at once
  (large-scale change / codebase-wide refactor).
- Setting up or debugging CI/CD: build cop rotations, flaky test triage,
  green-vs-true head, canary rollouts.
- Diagnosing "tech debt" complaints or deciding what belongs in a monorepo
  vs. a separate repository.
- Building or improving a team's knowledge-sharing mechanisms (docs, wikis,
  mentoring, onboarding).

## Core Techniques

### 1. Code review: optimize for the next reader, not the author

- The goal of a review is not just "consent to merge" — it is to check
  correctness, ensure the change is comprehensible to *other* engineers,
  enforce consistency across the codebase, and create a historical record of
  why the change was made.
- A typical review flow: author writes a self-contained change → uploads a
  snapshot with a description → reviewer comments on the diff → author
  revises → reviewer approves once satisfied. Only one approval should be
  required by default; requiring more slows every change down for marginal
  gain.
- Reviewers evaluate more than "does this work" — they check design,
  functionality, complexity, tests, naming, comments, and consistency with
  existing style. Nitpicks are optional polish, not blockers.
- Keep changes small and self-contained. A large, multi-purpose change is
  harder to review carefully, so reviewers either rubber-stamp it or the
  review stalls — both outcomes defeat the purpose of review.
- Consistency sometimes conflicts with local "better" code. When it does,
  prefer the less clever, more consistent option — the codebase is read far
  more often than it is written.

### 2. Size tests by constraints, not by "unit vs. integration" labels

Classify tests by what they are *allowed to do*, because that is what
determines their speed and determinism — the two properties that matter most
at scale:

| Size | Runs in | Allowed I/O | Typical use |
|---|---|---|---|
| Small | Single process | None — no network, disk, sleep, or blocking calls | Pure logic, fast feedback in seconds |
| Medium | Single machine | Localhost only (multiple processes, threads) | Component interaction, local service calls |
| Large | Anywhere | Full network, other machines, real dependencies | End-to-end, deployment validation |

- Default to writing the smallest test that can exercise the behavior. A
  suite of hundreds of small tests only stays useful if it stays fast and
  deterministic — even a small fraction of flaky tests erodes trust in the
  whole suite.
- Flaky tests are not a minor annoyance; at scale, a handful of tests each
  with a tiny nondeterminism rate guarantees *something* fails every run.
  Track root cause instead of auto-retrying indefinitely — retries hide the
  signal.
- Reserve large/end-to-end tests for what only they can catch (real
  cross-system integration); they are expensive and their failures are
  slower and harder to diagnose.

### 3. Style guides are rules; everything else is guidance

- A rule is enforceable and requires justification to break. Guidance is a
  recommendation with room for judgment. Conflating the two either makes the
  style guide toothless or makes it needlessly rigid.
- Every rule must earn its place by these principles: it must pull its
  weight (the benefit outweighs the cost of enforcing it), optimize for the
  reader over the author, stay consistent, avoid error-prone or surprising
  constructs, and concede to practicalities when a rule is not worth a fight.
- Rules can and should change when the argument for changing them is
  stronger than the cost of losing consistency with existing code — but that
  bar is intentionally high, and the change should be made deliberately by
  whoever owns the guide, not by individual override.
- Prefer automated enforcement (formatters, linters) over manual policing in
  review — it removes the debate and the personal friction entirely.

### 4. Deprecate deliberately — a warning alone is not a plan

- Deprecation is the orderly migration away from, and eventual removal of,
  an obsolete system. Done well it reduces long-term cost; done poorly
  (warning-and-abandon) it just accumulates ignored noise.
- "Hope is not a strategy." Marking something deprecated and walking away
  rarely produces migration — warnings on their own mostly prevent *new*
  usage, not remove *existing* usage.
- Plan for deprecation while designing the system, not after: know who
  depends on it, how you'll detect usage, and how you'll force or assist
  migration.
- Transitive deprecation warnings compound: if A depends on B depends on C,
  and C warns, the warning surfaces everywhere A is built, overwhelming
  consumers who have no direct relationship to C. Budget for this before
  flipping a warning on broadly.
- Give dependents a real, incremental migration path and a schedule, and be
  willing to adjust the timeline — but reserve the right to break
  non-compliant users once they've been sufficiently warned. A deprecation
  with no eventual enforcement mechanism never finishes.

### 5. Large-scale / codebase-wide changes: expect them to be non-atomic

- As a codebase and its number of contributors grow, the largest change you
  can safely land *shrinks*, not grows — running every affected check and
  keeping every file current before submission gets harder, not easier.
- A large-scale change (LSC) is any set of logically related changes that
  cannot practically be submitted as a single atomic unit — sometimes for
  technical reasons (federated repositories), sometimes for practical ones
  (blast radius, review bandwidth).
- Generate LSCs with automated tooling (codemods, structured search-and-
  replace) rather than hand-editing every call site — manual sweeps do not
  scale and introduce inconsistency.
- Split an LSC into independently-reviewable, independently-revertible
  shards. A single reviewer approving one giant diff cannot meaningfully
  vouch for correctness across hundreds of files.

### 6. CI/CD at scale: separate "true head" from "verified head"

- Continuous Integration at scale means continuously assembling and testing
  the whole evolving system, not just running one team's tests. Track two
  notions of head: *true head* (the latest committed change) and *green
  head* (the latest change CI has verified passing).
- Sync work against green head for a stable coding environment, but require
  a sync to true head before submission — this keeps development fast
  without letting broken commits silently become the baseline everyone
  builds on.
- Continuous Delivery's core bet is "faster is safer": smaller, more
  frequent batches of change reduce risk more than infrequent big-bang
  releases, provided they're backed by CI, automatic rollback, and fast
  culprit-finding when something breaks.
- A canary alone is not validation — it tells you whether a change is
  crashing or unstable, not whether it is actually *better* than what it
  replaces. Pair canaries with real before/after comparison, not just error
  rates.

### 7. Monorepo / dependency management: treat "someone else's problem" as your own

- Upstream dependencies you don't control can't coordinate with your
  release schedule, so they are more likely to unexpectedly break your build
  or tests. Managing one outside dependency casually doesn't scale to
  managing a network of them.
- A monorepo makes atomic cross-cutting changes technically possible but
  does not make them free — the review, test, and rollout cost still scales
  with the size of the change, which is exactly why LSC tooling (technique
  5) exists even inside a single repository.

### 8. Knowledge sharing prevents "all-or-nothing expertise"

- The failure mode to watch for: a team splits into people who know
  "everything" and novices with no middle ground. It self-reinforces —
  experts keep doing everything themselves instead of documenting or
  mentoring, so novices ramp up slowly and the bus factor stays at one.
- Growing expertise requires psychological safety: an environment where
  admitting "I don't know this" doesn't carry a penalty. Without it, people
  hide gaps instead of closing them.
- One-to-one mentoring is high-value but doesn't scale and evaporates when
  the expert leaves or switches teams. Written documentation (wikis, design
  docs, READMEs) scales further but costs ongoing maintenance to stay
  accurate — budget for that cost explicitly rather than letting docs rot.

## Common Pitfalls

- **Rubber-stamp reviews on oversized changes.** If a diff is too large to
  read carefully, the reviewer either blocks progress or approves without
  real scrutiny — split the change instead of accepting either outcome.
- **Confusing "unit test" with "small test."** A test that runs in one
  process but hits a real database is not small — it will be slow and
  occasionally flaky, and mislabeling it hides that cost from the team.
- **Auto-retrying flaky tests instead of fixing them.** Retries restore a
  green build but leave the nondeterminism in place, and it compounds as the
  suite grows.
- **Treating style-guide exceptions as personal preference.** An
  unenforced, individually-negotiated rule is not a rule — it is the start
  of an inconsistent codebase.
- **Deprecating without a forcing function.** A warning that can be ignored
  forever will be ignored forever; plan the actual removal date and the
  mechanism that enforces it.
- **Hand-editing an organization-wide refactor.** Manual large-scale
  changes drift out of sync with the codebase before they land; use
  tooling and shard the rollout.
- **Building on true head instead of green head.** Coding against an
  unverified baseline means inheriting other people's breakages before you
  even start.
- **Letting one expert be the only source of knowledge.** If a system's
  correctness lives entirely in one person's head, it is a single point of
  failure for the whole team, not just for that system.
