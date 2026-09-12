---
name: problem-solving
description: Systematic problem-solving strategies, decomposition, pattern recognition, analogies, and constraint analysis to approach unfamiliar problems with confidence.
origin: "Think Like a Programmer — V. Anton Spraul"
---

# Problem-Solving Strategies

Master systematic approaches to break complex problems into manageable pieces. These
strategies are domain-agnostic: they apply to code, writing, debugging, design,
negotiation, or any task with a goal and constraints.

## When to Activate

- Facing an unfamiliar problem with no clear entry point
- Overwhelmed by problem scope or constraints
- Stuck after initial attempts, needing a fresh strategy
- Recognizing a similarity to a previously-solved problem
- Need to plan before diving into implementation
- Reducing frustration by building incremental progress

## What Problem Solving Actually Means

A problem is not "something unpleasant" — it is a goal plus a set of constraints
that make the obvious path unavailable. "Trade in the broken car for a new one"
solves nothing if the constraint is "fix this car." Naming the constraints turns
a vague discomfort into a solvable structure: what is fixed, what can move, and
what tools are permitted.

A solution is not the first thing that works — it is the first thing that works
**and** respects every stated constraint. A fast answer that quietly breaks a
constraint (skips a rule, ignores an edge case, uses a forbidden shortcut) is not
a solution; it is a deferred failure.

## Core Principles

**Always Have a Plan** — A plan may change, but thinking through your approach
exposes your capabilities and reveals intermediate goals. Without a plan, you're
hoping for luck rather than executing strategy. A one-paragraph plan written
before starting is worth more than an hour of undirected effort.

**Restate the Problem** — Changing terminology, formality level, or perspective
often reveals solutions hidden by the original framing. What seems impossible in
one form may be trivial in another. Try three restatements: in your own words,
as a formal input/output spec, and as if explaining it to someone outside the
domain.

**Constraints Are Clarity** — Constraints eliminate choices. Identify what is
fixed and what is changeable. A problem missing constraints is often
underspecified and needs clarification before solving; a problem highlighting
the most constrained variable is often where you should start.

**List Available Operations** — Before designing a solution, enumerate the
moves you're actually allowed to make (the verbs of the domain: API calls,
data structures, physical actions, negotiation levers). A solution is a
sequence of permitted operations — you cannot compose a path from moves you
haven't identified.

## Decomposition Techniques

### Divide the Problem

Break a problem into phases or subproblems. Solving four smaller problems is
often easier than one large one — the difficulty drops superlinearly because
each subproblem's complexity shrinks, and each phase can be independently
verified before moving to the next.

*Example:* "Build a tool that imports a CSV, validates rows, and emails a
summary" splits into: parse CSV → validate row → aggregate results → format
email → send email. Each piece is independently testable; none of them alone
is hard.

### Reduce the Problem

Temporarily add or remove constraints to create a simplified version you can
solve. A 2D version of a 3D problem, three items instead of ten, one user
instead of a thousand — the reduced version reveals the underlying pattern.
Once you solve the reduced version, scale back up and check what breaks.

*Example:* Designing a scheduler for N resources with overlapping windows?
Solve it first for 2 resources and 2 windows by hand. The rule you discover
("the resource with the earlier deadline wins ties") usually generalizes.

### Work Backwards

Start from the desired end state and ask what must be true immediately before
it, then repeat until you reach the current state. This is the mirror image
of forward decomposition and is often faster when the goal is precise but the
starting conditions are messy (proofs, maze-solving, negotiation endgames,
release checklists).

*Example:* "The deploy must be green by Friday 5pm" → before that, staging
must pass 24h of soak testing → before that, the migration must run on a
prod-like dataset → before that, the migration must be written and reviewed.
Each backward step becomes a forward-ordered task list.

### Start With What You Know

Solve the parts you already understand first. Working code, even partial,
builds confidence and often sparks insight into remaining pieces. Never hunt
for tools you lack before exhausting the ones you have. Momentum from an easy
win frequently unlocks the hard part, because the "unknown" shrinks once
surrounding structure is in place.

## Pattern Recognition & Analogies

**Recognize Analogies** — An analogy is an exploitable similarity between a
solved and unsolved problem. The structure may be identical (fox/goose/corn →
any three-item mutual-exclusion constraint), or only part of the problem
shares structure (both involve handling precision, ordering, or state
transitions). A partial analogy is still useful: borrow the piece that maps,
discard the rest.

**Look for Extraneous Detail** — Unfamiliar names, elaborate setup, or
distracting mechanics often mask a simpler underlying problem. Strip away the
flavor text (business jargon, story framing, tool-specific terminology) to
see the bare structure: inputs, outputs, and rules connecting them.

**Build a Personal Library** — Every problem you solve is a future reference.
You cannot recognize analogies without solved examples to draw from. Solve
problems deeply rather than copying solutions — a copied solution you don't
understand can't be adapted to the next problem that's 80% similar.

**Beware False Analogies** — Surface similarity (same keywords, same domain,
same shape of input) does not guarantee the same solving structure. Before
committing to an analogy, verify that the constraints and operations actually
match, not just the vocabulary.

## Tactical Moves

**Most Constrained Variable First** — Start with the part of the problem that
has the fewest options or degrees of freedom. If one variable can take only
one value, assign it first — it prunes the search space for everything else.
This is the same principle behind solving a sudoku's most-constrained cell
first, or scheduling the least-flexible participant's slot before the others.

**Simplify, Then Generalize** — Solve the easiest version of the problem that
still captures its essence (fewer inputs, no edge cases, happy path only).
Verify the simple solution, then add back complexity one dimension at a time,
re-verifying after each addition.

**Experiment With Intent** — Form a hypothesis, test it, observe the result.
This is controlled exploration, not guessing. Write down the hypothesis
*before* running the experiment — it forces precision and makes the result
interpretable even when it's not what you expected. Especially valuable for
unfamiliar libraries, APIs, or behavioral edge cases you can't reason about
from documentation alone.

**Draw the Problem** — Diagrams, tables, or written traces of state
externalize working memory. A state-transition table, a flowchart, or a
sketch of the data shape often reveals a missed case or a redundant path that
pure mental modeling hides.

**Break on Frustration** — Frustration clouds judgment and slows progress.
When stuck, take a break. Work on a different part of the same problem or
shift to a different task entirely. The pause often yields fresh perspective
(the well-documented "incubation effect") — returning with a rested mind
frequently surfaces the missed assumption immediately.

## Worked Example

**Problem:** "Deduplicate a list of customer records where names may be
typo'd or formatted differently."

1. *Restate:* group records that likely refer to the same real customer,
   under an approximate-match rule.
2. *Constraints:* no ground truth for "same customer" exists; false merges
   are worse than missed merges (business rule).
3. *Reduce:* solve for two records first — what makes a human say "same
   person"? Same normalized email, or same normalized name + same postal code.
4. *Most constrained variable:* email is the strongest signal and cheapest to
   normalize — start there, only fall back to fuzzy name matching for
   records without email.
5. *Divide:* normalize → group by strong key → fuzzy-match within groups →
   merge → report ambiguous cases for human review (never auto-merge on weak
   signal alone, per constraint in step 2).

Each step is independently checkable before writing the merge logic.

## Common Pitfalls

- **Skipping the restatement** — Jumping straight to implementation without
  formally restating or analyzing the problem.
- **Ignoring constraints** — Removing constraints to make the problem easier
  (the "trade in the broken car" trap), delivering a solution that breaks
  stated rules.
- **Random trial-and-error** — No plan, no checkpoints, no hypothesis. Just
  trying things and hoping.
- **False analogy** — Forcing a superficial similarity instead of checking if
  the underlying structure actually maps.
- **Monolithic approach** — Attempting to solve the entire problem at once
  instead of building incrementally.
- **Premature implementation** — Acting before you understand what you're
  solving or how the pieces fit together.
- **Solving the wrong reduction** — Simplifying away the exact part that made
  the problem hard, then being surprised the full version doesn't generalize.
- **Never zooming back out** — Getting a subproblem working and forgetting to
  verify it still serves the original goal once reassembled.

## Validation Checklist

- [ ] Problem formally restated; no ambiguities remain
- [ ] Constraints listed explicitly; nothing taken for granted
- [ ] Possible operations enumerated (even generic ones)
- [ ] Problem divided into phases or subproblems (if applicable)
- [ ] A reduced or simplified version solved and verified first
- [ ] Part of the problem solved or prototyped to spark insight
- [ ] Analogies identified to previous problems, and checked for false matches
- [ ] Plan in writing with measurable intermediate milestones
- [ ] Experimentation done deliberately with recorded observations
- [ ] Final solution re-checked against every constraint from the restatement

---

**Remember:** The goal is not the first solution you write, but a solution that
meets all stated constraints. Take time to understand the landscape before
climbing the hill.
