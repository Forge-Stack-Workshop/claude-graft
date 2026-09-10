---
name: check
description: Constructive code review practice — preparing reviewable pull requests, writing effective comments, automating low-value checks, and handling review dilemmas (delays, loopholes, bias, emergencies).
origin: biblio — "Looks Good To Me: Constructive Code Reviews" (Manning)
---

# Check — Constructive Code Reviews

Code review is a team practice, not a gate one person operates alone. Its job
is to catch defects, spread knowledge, and keep a codebase coherent — not to
perform authority or enforce personal taste. A review culture is judged by
whether it produces trust and better code, not by how many comments it
generates.

## When to Activate

- Preparing a pull request (PR) for review.
- Reviewing someone else's PR, at any stage from first pass to final approval.
- Writing or reading review comments and deciding whether to act on them.
- Setting up or revising a team's review process, automation, or working agreement.
- Diagnosing why reviews are slow, contentious, or being rubber-stamped.
- Handling an emergency change that needs to bypass the normal review path.
- Deciding how AI-assisted review fits into a human review process.

## Author's obligations before requesting review

A PR is a request for someone else's time and attention. The author owns two
obligations before it is ready:

1. **Manageable size.** Keep PRs under roughly 500 total lines of code, and
   aim well below that. Research on real PR data (Stepanović) found that
   larger PRs get measurably fewer comments per 100 lines of code — engagement
   drops as size grows, which means large PRs are reviewed *less* carefully,
   not more. File count degrades review quality the same way size does: more
   files in one PR lowers the rate of useful feedback. If a change can't fit
   in one focused review, split it (by layer, by feature flag, by migration
   step) rather than asking one reviewer to hold the whole thing in their head.
2. **Understandable intent.** Before marking a PR ready, self-review it as if
   you were the reviewer: read every diff, anticipate the questions a
   reviewer would ask, and answer them proactively in the PR description or
   inline comments. If you can't confidently say "yes" to "can the code and
   my stated intent be clearly understood," it isn't ready.

A PR left in a half-finished, constantly force-pushed state without being
marked as a draft wastes a reviewer's first pass and erodes trust in the
"ready for review" signal — use the draft state explicitly instead.

## Composing effective comments

- **Be objective, not just opinionated.** A comment that says "I would have
  loved to see X" about functionality nobody asked for is subjective noise,
  not review feedback — it stalls a PR over the reviewer's private ideal
  rather than a real flaw the implementation missed. If an idea is a genuine
  improvement outside current scope, capture it as a separate feature
  request instead of blocking the PR in front of you.
- **Distinguish "must fix" from "nice to have."** State clearly whether a
  comment blocks approval or is an optional suggestion — conflating the two
  forces authors to guess your intent and breeds resentment when a
  non-blocking preference is treated as a hard requirement.
- **Explain the why, not just the what.** A comment that only says "change
  this" without reasoning reads as a command, not collaboration; give the
  reasoning so the author can evaluate it, push back with information you
  might be missing, or apply the same reasoning next time unprompted.
- **Scope comments to the diff.** Highlight only the applicable lines when
  possible — pointing at unrelated code invites scope creep into an
  unrelated PR.
- **Watch for ego.** Both sides can dig in when each believes their solution
  is objectively better; that dynamic is a discussion to have out loud (or
  escalate to the team), not something to resolve by review-comment attrition.

## Automating the low-value work

Style debates and mechanical checks (brace style, unused variables, import
order, naming case) are solved problems — enforce them with linters and
formatters so reviewers never have to comment on them. What to automate:

- **PR prechecks** — run linters, tests, and formatting checks automatically
  before a human ever opens the diff; a PR that fails prechecks shouldn't
  consume a reviewer's attention.
- **PR size labeling** — flag PRs by lines-changed and files-changed
  thresholds so oversized PRs are visibly called out before someone commits
  to reviewing them, instead of discovered mid-review.
- **Reviewer assignment** — assign reviewers by rotation or ownership rules
  rather than always defaulting to the same "buddy," which both overloads
  that person and introduces a bias toward reviews that rubber-stamp a
  trusted colleague's work ("Looks Good To Me" without real engagement).
- **Title/label conventions and review-metric tracking** — automate the
  bookkeeping so the team can see review health (turnaround time, comment
  density, PR size trend) without manual reporting.

Automation should remove tedium, not judgment — it clears the board so
reviewer attention goes to design, correctness, and edge cases instead of
brace placement.

## The Team Working Agreement

Write down, as a team, what "reasonable" means for your review process
instead of relitigating it PR by PR:

- What counts as a reasonable PR size (lines of code, file count) — a
  documented number turns "no, that's too big" from a personal opinion into
  a shared standard everyone agreed to.
- What review turnaround time is expected.
- What blocks a merge vs. what is a suggestion.
- How disagreements between author and reviewer get resolved and escalated.

The agreement is a living document — revisit it as the team and codebase
change, not a one-time onboarding artifact.

## Handling dilemmas

- **Review delays** — the biggest lever is PR size; the second is making
  review a scheduled, protected part of everyone's day rather than an
  interrupt-driven afterthought that keeps losing to "real work."
- **Process loopholes** — informal workarounds (self-approving, merging
  without review "just this once") tend to start as an exception under
  pressure and calcify into the norm if the team doesn't name and close the
  loophole explicitly.
- **The buddy system bias** — always routing review to the same trusted
  person produces faster approvals but weaker scrutiny; the fix is
  automated, rotated assignment, not asking people to "try to be more
  critical" of friends.
- **Emergency Playbook** — for 3 a.m.-incident-class changes, define in
  advance what bypassing normal review looks like (who can approve, what
  gets retroactively reviewed, how the bypass is logged) so an emergency
  shortcut stays a documented exception instead of quietly becoming the new
  normal.

## AI in code review

AI review tools are useful for the mechanical layer — catching the same
class of issues linters catch, plus some pattern-based bug detection — but
they inherit the same objectivity risk as a human reviewer: they can be
confidently wrong, and confident-but-wrong feedback is more dangerous than
obviously-wrong feedback because it's more persuasive. Treat AI review
output as a first pass or a second opinion that still needs a human to judge
context, intent, and tradeoffs — not as a replacement for the human
judgment call on whether a change is actually good.

## Common pitfalls

- Approving with "LGTM" on a PR too large to have actually been read —
  defeats the purpose of review while looking like it happened.
- Leaving subjective, scope-creeping comments that block merge instead of
  becoming a separate feature request.
- Blocking a PR on a style question a linter should have caught.
- Defaulting every review to the same one or two trusted reviewers.
- Letting an emergency bypass become a routine path because it was never
  written down as an exception.
- Treating AI review output as authoritative instead of as input to a human
  decision.
- Commenting on unrelated lines outside the diff's scope.
