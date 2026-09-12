---
name: architecture-patterns
description: Decentralized software architecture decision-making — the architecture advice process, lightweight ADRs, cross-functional requirements (CFRs), technology radars, and minimal viable governance for socio-technical systems.
origin: biblio (Andrew Harmel-Law, "Facilitating Software Architecture", O'Reilly)
---

# Architecture Patterns

Practices for making architectural decisions at scale without a central
architecture authority becoming a bottleneck. Architecture is treated as an
ongoing, distributed decision-making activity, not a document or a role.

## When to Activate

- Deciding who gets to make an architectural decision, and how.
- Designing or reviewing an ADR (Architecture Decision Record) process.
- A central architecture team/review board is slowing delivery.
- Defining cross-functional requirements (performance, security, scalability…)
  that decisions must respect.
- Introducing or maintaining a technology radar.
- Diagnosing conflict between decision speed and decision quality/consistency.
- Discussing "governance" for a platform, monorepo, or multi-team system.

Not for: implementation-level design patterns (see language/framework-specific
skills), or single-team decisions with no cross-team blast radius.

## Core Idea: Architecture Is a Decision-Making Activity

To practice architecture is to decide. A decision is *architectural* when it
is hard to reverse and/or its blast radius crosses team boundaries — it
affects other teams' ability to meet a cross-functional requirement (CFR).
Everything else is a local, reversible decision that a team should make
without escalation.

The traditional centralized model (architects/review boards approve or
reject decisions before teams can proceed) creates a queue: the more the
organization grows, the slower and more disconnected from delivery reality
the central group becomes. Decentralizing decision-making removes that
queue — but decentralization without structure produces chaos. The
architecture advice process is the structure that makes decentralization
safe.

## The Architecture Advice Process

One rule: **anyone can make any architectural decision**, but before making
it (or while finalizing it) they must seek advice from:

1. People who will be materially affected by the decision.
2. People with useful expertise or experience in the decision's domain.

Advice must be genuinely sought and considered — not rubber-stamped, not
vetoed. The decider remains free to disagree with advice received, but must
be prepared to explain why. This is the process's social contract: it trades
top-down approval for transparent, informed autonomy.

Why it works:

- **Fast** — no queue behind a central authority; the decider moves as soon
  as advice is gathered, not as soon as it is granted.
- **Decentralized** — decision-making capability scales with the number of
  people/teams, not with the throughput of one group.
- **Better decisions** — advice pulls in context the decider doesn't have,
  without diluting ownership.
- **Builds trust and skill** — decision-makers develop judgement by
  practicing, not by having decisions made for them.

### Accountability Shift

Responsibility and accountability move to whoever initiates and takes the
decision. This is the biggest cultural change when rolling out the process:
former decision-approvers must consciously let go of their gatekeeping role,
and new deciders must consciously accept ownership of outcomes, including
bad ones. Roll-out failure modes: not explaining the process to everyone
involved, and not explicitly naming the accountability shift out loud.

## Architecture Decision Records (ADRs)

ADRs are the artifact that makes advice-seeking tractable and durable. A
lightweight ADR should capture, at minimum:

- **Context** — the problem/forces driving the need for a decision.
- **Options considered** — the realistic alternatives, with trade-offs.
- **Decision** — what was chosen and why.
- **Advice received** — who was consulted, what they said, whether/why it
  changed the decision.
- **Status** — proposed → accepted (or superseded/deprecated).

Keep ADRs short and numbered; store them close to the code/system they
affect, not in a separate document silo people forget to check. An ADR is a
record of a decision made through the advice process, not a request for
permission — publishing it *is* the advice-seeking step, or documents advice
already gathered synchronously (e.g. in an advice forum).

"Spiked" or exploratory ADRs (opened to explore an option before committing)
still go through the same advice process as any other ADR — spiking doesn't
exempt a decision from being informed.

## Cross-Functional Requirements (CFRs)

CFRs (the book's preferred term over "non-functional requirements") are the
shared, cross-cutting needs a system must satisfy: latency, availability,
security posture, compliance, cost ceilings, etc. State CFRs explicitly and
concretely, the same way you'd state a functional requirement — vague CFRs
("be fast", "be secure") make it impossible to judge whether a decision is
architecturally significant.

A decision is significant with respect to a CFR when it materially affects
the system's ability to meet that CFR. Explicit CFRs are what let a
distributed set of deciders converge on consistent outcomes without a
central approver: the CFR is the shared reference, not a person's opinion.

CFRs are collectively sourced (see `architectural-principles` topic below),
tested where possible, and revisited — new or updated CFRs/principles can
emerge *from* decisions made through the advice process, not only from
governance top-down.

## Architectural Principles

Principles are shared, lightweight commitments that nudge decisions in a
consistent direction without dictating them — a constraint, but a soft one.
They complement (not replace) the advice process and ADRs: principles reduce
the advice-gathering burden for well-trodden decision categories, freeing
the advice process for genuinely novel or high-stakes decisions.

## Technology Radar

A technology radar records the organization's collective experience with
technologies/techniques (adopt/trial/assess/hold-style quadrants). It gives
deciders and advisers a shared, living reference for "what do we already
know works here" — reducing repeated re-litigation of the same technology
choice across independent decisions, and surfacing where the org's technical
strategy should evolve.

## Architecture Advice Forums

A recurring, open forum where proposed ADRs get discussed synchronously is
an effective way to kick off the advice process in an organization new to
it. It socializes the practice, demonstrates what "genuinely seeking advice"
looks like, and surfaces cross-team advisers who wouldn't otherwise
self-select. It is a bootstrapping mechanism, not a required permanent
gate — the goal is for advice-seeking to become routine and often
asynchronous, not perpetually forum-bound.

## Minimal Viable Governance

Governance under this model is the minimum structure needed to keep
decentralized decisions coherent: the one rule (seek advice from affected +
expert parties), explicit CFRs, lightweight ADRs, and (optionally) an advice
forum and radar. It deliberately avoids: mandatory approval gates, a
standing review board with veto power, and heavyweight document processes.
Governance exists to make good decisions *easier to make quickly*, not to
slow decisions down for the sake of oversight.

## Socio-Technical Framing

Architecture decisions are inseparable from the organization making them —
Conway's Law in reverse: decision-making structure shapes system structure
as much as the other way around. Treat rollout of any advice process as an
organizational change, not a tooling change: it requires explaining the
model, naming the accountability shift, and giving people practice making
and being accountable for decisions before trusting the process fully.

## Common Pitfalls

- **Turning "seek advice" into "get approval."** The moment advice becomes a
  required sign-off, the process reverts to centralized gatekeeping with
  extra paperwork.
- **Vague CFRs.** Without concrete, testable CFRs, nobody — decider or
  adviser — can tell whether a decision is architecturally significant.
- **ADRs as bureaucracy.** Long, templated ADRs nobody reads defeat the
  purpose; keep them short and close to the decision's context.
- **Skipping the accountability conversation.** Rolling out decentralized
  decision rights without explicitly renaming who owns outcomes leaves
  former approvers still acting as gatekeepers, and new deciders unwilling
  to commit.
- **Confusing decentralization with anarchy.** The process still has one
  rule (seek advice) and shared references (CFRs, principles, radar) —
  it is structured autonomy, not absence of structure.
- **Central radar/forum becoming a new bottleneck.** These are supporting,
  optional elements; if the forum becomes a mandatory approval gate, it has
  quietly re-centralized the process it was meant to bootstrap.
- **One-size decision process for all decisions.** Not every decision is
  architectural — forcing local, reversible, single-team decisions through
  the advice process wastes the mechanism's value on low-stakes calls.
