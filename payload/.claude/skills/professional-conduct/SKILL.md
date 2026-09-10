---
name: professional-conduct
description: Professional attitudes, disciplines, and craft practices — saying yes/no with commitment, realistic estimation, test-driven development discipline, pressure handling, collaboration patterns, mentoring, and time management.
origin: "The Clean Coder: A Code of Conduct for Professional Programmers — Robert C. Martin (Pearson, 2011)"
---

# Professional Conduct in Software Development

**Professional software development is about accountability, discipline, and craft.** Professionalism is not a badge of honor — it is a marker of responsibility. A professional owns mistakes and fixes them. A professional means it when they commit. A professional estimates with uncertainty stated, not hidden. When pressure rises, a professional stays calm and disciplined rather than cutting corners.

The core paradox: professionals have more, not less, freedom than amateurs — because trust earns autonomy. Every shortcut spends trust; every kept commitment banks it.

## When to Activate

Use this skill when you:
- Face pressure to commit to a deadline or deliverable you're unsure about
- Must estimate a complex task or a sprint-planning session
- Manage your own code quality, test coverage, or technical discipline
- Mentor a less experienced developer or lead a team
- Navigate disagreement between technical excellence and business urgency
- Feel the pull to ship untested code, skip review, or cut corners
- Are asked to change a number, a test, or a report to look better than reality

---

## Core Principles

### 1. First, Do No Harm

The first responsibility of a professional is not to harm the function or the structure of the code.

- **Function**: don't ship bugs. Bugs are cheap to talk about, expensive to live with — they erode stakeholder trust faster than missed deadlines.
- **Structure**: don't let the code rot as features accumulate. A design that resists change is a slow-motion harm; refactor continuously, don't schedule a "cleanup sprint" that never comes.
- QA should find nothing. Treat every QA-caught bug as a professional failure to investigate, not a normal part of the process.

### 2. Language of Commitment

Words reveal true commitment. Watch for **telltale signs of non-commitment**:

- **"Need/should"** — "We need to get this done." "Someone should fix that." Signal: someone else is responsible.
- **"Hope/wish"** — "I hope to finish by Friday." Signal: you don't believe it will happen.
- **"Let's"** (not followed by "I") — "Let's ship it." Signal: collective vagueness, no personal accountability.

When you truly commit, say:
- **"I will"** — "I will have this done by Friday at 5 PM."
- **"We will"** — only after real team consensus, never assumed on someone else's behalf.
- **"I won't"** — "I won't ship code without tests."

A commitment has three parts: you don't know for sure you can do it, you say it anyway with full intent, and you do whatever it takes — including asking for help — before admitting failure. Silence until the deadline is not professionalism; visibility into risk, early, is.

### 3. Saying "No" Professionally

Saying "no" is part of professionalism, especially when the stakes are highest — that's precisely when pressure to say yes is strongest. Professionals speak truth to power; slaves and hesitant laborers don't get to say no, but professionals are expected to.

The cost of saying "yes" to an unrealistic commitment: shipped defects, broken production code, missed deadlines anyway, burnout, and a team that stops trusting your estimates.

**How to say no:**
1. State the constraint clearly, with a number: "This will take 6 days, not 2. Cutting it introduces defect risk."
2. Offer alternatives: "We can ship A by Friday, or A and B by next Wednesday."
3. Take responsibility, don't soften: "I won't commit to something I can't deliver."
4. Don't fight the fight for your manager — a manager who hears "no" needs you to hold that position with data, not fold at the next meeting.

"No" is not the end of the conversation. It's an invitation to negotiate the real trade-off (scope, time, or resources) instead of pretending the trade-off doesn't exist.

### 4. Saying "Yes" Meaningfully

Saying yes is equally disciplined. A meaningful yes requires:
- You understand what is being asked.
- You (or your team) have a plan to achieve it.
- You have no evidence it's impossible.
- You commit to make every reasonable effort, and to communicate early if the plan changes.

A yes given to make an uncomfortable meeting end is not a commitment — it's a debt you will default on later, at a worse time.

### 5. Estimation with Uncertainty (PERT)

Realistic estimation states three numbers per task, never one:

- **O (Optimistic):** best case if everything goes right, <1% probability. Example: 1 day.
- **N (Nominal):** most likely outcome, highest probability. Example: 3 days.
- **P (Pessimistic):** everything reasonable that could go wrong, <1% probability. Example: 12 days.

```
Expected    = (O + 4N + P) / 6
Uncertainty = (P - O) / 6
```

Example: (1 + 4×3 + 12) / 6 = 4.2 days ± 1.8 days.

This tells stakeholders the task will likely land around 4 days but could reasonably run 6–9. An estimate is a probability distribution, not a promise — professionals report the tail, they don't pretend the optimistic scenario is the only one. A single-number estimate presented as fact is a lie dressed as diligence.

### 6. Estimation as a Team (Wideband Delphi / Planning Poker)

Accurate estimates come from the team, not one person.

1. Discuss the task: scope, dependencies, risks.
2. Each member votes simultaneously (cards or fingers) — no anchoring on the first spoken number.
3. Close votes (e.g., all 3s and 4s) → move forward.
4. Wide variance (e.g., 2 and 8) → discuss the gap explicitly: what does the low estimator know that the high one doesn't, and vice versa?
5. Re-vote until consensus, or until the disagreement itself becomes a documented risk.

Collective wisdom catches risks any single estimator misses — this is not bureaucracy, it's error-correction.

### 7. Test-Driven Development as Discipline

TDD is a professional practice, not an optional style preference.

- **Red-Green-Refactor** forces design decisions upfront and prevents silent regression.
- **A failing test preserves context** — interrupted mid-task, the test tells you exactly where you were.
- **High coverage buys the right to refactor** without fear of unseen breakage.
- **The Three Laws of TDD:**
  1. Write no production code until you have a failing unit test.
  2. Write no more of a test than is sufficient to fail (and failing to compile counts as failing).
  3. Write no more production code than is sufficient to pass the currently failing test.

Debugging time is coding time, and it is the most controllable cost in software — professionals treat every debugging session as evidence a test was missing, then write that test before moving on. TDD is the single largest lever for reducing debugging time to near zero.

**Acceptance tests** are a separate, complementary discipline: written with stakeholders/QA, in business language, automated, and run continuously alongside unit tests. Unit tests prove the programmer built the thing right; acceptance tests prove the team built the right thing. Neither replaces the other.

### 8. Handling Pressure

Pressure will come. Professionals respond with calm, discipline, and honesty — never with panic.

- **Avoid panic coding**: rushing under stress produces more bugs, which cost more time than the rush saved. Slower is faster.
- **Stick to your practices under pressure, especially then**: TDD, review, pairing are the safety net, not overhead to shed when things get tight.
- **Communicate early**: raise a slipping deadline the day you know it, not the day before it's due.
- **Say no to shortcuts explicitly**: "We can't skip testing" is a sentence you say out loud in the meeting, not a private hope.
- **Own mistakes**: when a bug reaches production due to your error, fix it, disclose it, and add the missing test or process guard that prevents its class from recurring.
- **Guard the flow zone deliberately, and know its risk**: deep focus produces great code, but flow can also mask the discipline that catches mistakes — never let flow become an excuse to skip the failing test first.

Professionals get more done under pressure by staying disciplined, not by abandoning discipline.

### 9. Collaboration & Pair Programming

Professional development is not solitary.

- **Pair programming** catches errors in real time, transfers knowledge continuously, and lets one partner hold context while the other fields an interruption.
- **Code review** ensures no single person's judgment is the last word on a change.
- **Estimation consensus** prevents individual blind spots from becoming team commitments.
- **Disagreement is welcome, silence is not**: say your objection out loud, argue it with evidence — then, once the team decides, commit fully to the outcome. Undermining a decision you didn't openly contest is unprofessional.

### 10. Mentoring & Apprenticeship

Senior developers grow the craft, not just the codebase.

- **Mentor explicitly**: teach practices (TDD, design, debugging technique), not only how to read this specific codebase.
- **Create safe space for mistakes**: a junior's failure is the training data, not a performance problem — unless it repeats after being taught.
- **Lead by example**: never ask a mentee to follow a discipline you skip yourself. Hypocrisy destroys mentoring credibility instantly.
- **Invest real time**: mentoring that becomes real takes years of proximity, not a single onboarding week.
- Career stages roughly map to master → journeyman → apprentice: apprentices need close supervision and simple tasks; journeymen work independently on ordinary tasks and pair on hard ones; masters take the hardest problems and are responsible for the apprentices around them. Match task difficulty to stage — assigning apprentice-level developers senior-level ambiguity sets them up to fail, not to grow.

### 11. Time Management

Professionalism is more about discipline than hours worked.

- **Protect meetings, don't drown in them**: attend only what you can influence or must be informed by; decline the rest, politely and explicitly.
- **Guard focus time**: batch interruptions, and negotiate quiet blocks the same way you'd negotiate a deadline — as a resource, not a favor.
- **Manage energy, not just hours**: sleep, exercise, and diet are professional inputs, not personal indulgences — a tired professional makes the same mistakes a rushed one does.
- **Avoid the sunk-cost death march**: overtime as a rare emergency measure is fine; overtime as the default plan for hitting an estimate means the estimate was wrong and should be renegotiated, not absorbed silently.

---

## Common Pitfalls

| Pitfall | Fix |
|---|---|
| Committing without saying "will" | Use precise language: "I will deliver X by Y." |
| Estimating alone | Bring the team into the room; run Planning Poker. |
| Giving a single-number estimate | State O/N/P and the computed uncertainty band. |
| Skipping tests under pressure | Tests save time long-term; pressure is exactly when you need them most. |
| Overpromising in a meeting | Pause, think, then commit — "I'll confirm by EOD" beats a rushed yes. |
| Hiding a mistake | Disclose, fix, and add the missing guard. Trust is built on visible honesty. |
| Silently overriding a team decision | Argue before the decision, commit fully after it. |
| Treating debugging as unavoidable overhead | Treat each bug as a missing-test signal; write the test that would have caught it. |
| Mentoring by osmosis only | Schedule explicit teaching moments; don't assume proximity is instruction. |
| Absorbing an unrealistic deadline via overtime | Renegotiate scope/time openly instead of quietly working nights. |

---

## Validation Checklist

- [ ] **Commitment:** Do your promises use "I will," "we will," or "I won't" — no softening language?
- [ ] **No:** When a request is unrealistic, did you state the real constraint and offer an alternative, rather than agreeing under pressure?
- [ ] **Estimation:** Did you provide O/N/P numbers or run Planning Poker with the team, instead of a single guessed figure?
- [ ] **TDD:** Did you write the failing test before the production code, for every change?
- [ ] **Pressure response:** When rushed, did you keep TDD and review, or cut corners?
- [ ] **Collaboration:** Did you raise disagreement openly before the decision, and commit fully after it?
- [ ] **Mentoring:** Are you actively growing less experienced teammates, or leaving them to figure it out alone?
- [ ] **Time:** Is overtime an emergency exception this cycle, or has it become the plan?

---

**Professional conduct is a choice made every day.** It starts with honest commitment, holds discipline under pressure, and builds trust through reliability — one kept promise at a time.
