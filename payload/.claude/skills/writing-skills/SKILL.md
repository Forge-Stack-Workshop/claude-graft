---
name: writing-skills
description: "Author, edit, and verify Claude Code skills so they trigger at the right time and change behaviour under pressure. TRIGGER when: creating a new skill, editing an existing skill's SKILL.md, or reviewing whether a skill actually works. DO NOT TRIGGER for: ordinary code/docs, or invoking an existing skill to do its job."
when_to_use: "write a skill, new skill, edit skill, fix skill trigger, skill not firing, author skill, 写技能, 改技能"
metadata:
  version: "1.0.0"
---

# Writing Skills: Make It Fire, Make It Bite

A skill is a behavioural contract, not documentation. It earns its place only
if it (1) **fires** at the right moment and (2) **changes what the agent does**
even when the agent is tired, confident, or rationalizing. A skill that reads
well but never triggers — or triggers and gets ignored — is dead weight that
costs context on every session.

## The Two Failure Modes

| Failure | Cause | Fix |
|---|---|---|
| Never fires | Vague `description`, no trigger phrases | Front-load TRIGGER / DO NOT TRIGGER + `when_to_use` synonyms |
| Fires, ignored | Descriptive prose, soft verbs ("consider", "try to") | Imperative rules, Iron Law, anti-rationalization table |

Optimize for both. Most weak skills fail the second one.

## Frontmatter Contract

```yaml
---
name: kebab-case-matching-the-directory
description: "One sentence on what it does. TRIGGER when: <concrete situations>. DO NOT TRIGGER for: <near-misses that belong to another skill>."
when_to_use: "comma-separated trigger phrases, include EN + FR/中文 synonyms"
metadata:
  version: "MAJOR.MINOR.PATCH"
---
```

- `description` is the ONLY text the dispatcher sees when deciding to load the
  skill. If a trigger situation is not named there, the skill will not fire.
- Always include **DO NOT TRIGGER** and point to the sibling skill that owns the
  near-miss (e.g. the debugging skill, the review skill, or the single
  run-and-look skill). Overlapping triggers cause the wrong skill to load.
- Bump `version` on every behavioural edit.

## Body Rules

1. **Imperative, not descriptive.** "Run the build" — not "you may want to run
   the build". Soft verbs get skipped under pressure.
2. **State an Iron Law** for any skill with a hard gate, and add:
   *"Violating the letter of the rule is violating the spirit of the rule."*
   This closes the "technically I didn't break it" loophole.
3. **Add a Rationalization Watch table** whenever the skill must hold under
   pressure — list the excuse the agent will invent and the one-line rebuttal.
4. **Show Good/Bad pairs** for anything subtle; one concrete example beats a
   paragraph of rules.
5. **Keep it short.** Every line is loaded into context. Cut anything that does
   not change behaviour. Move long reference material to sibling `.md` files in
   the skill directory and link to them.
6. **Respect your project's conventions.** Keep committed files in the project's
   working language, reference the project's sanctioned execution path (e.g. a
   Makefile target or container runner) rather than inlining bare host commands,
   and link related skills by name so they compose.

## Verify Before Deploying

A skill is not done because it reads well. Prove it fires and bites.

```
1. TRIGGER TEST — give a fresh subagent a prompt that SHOULD fire the skill
   (and one near-miss that should NOT). Confirm it loads on the first, stays
   silent on the second.
2. PRESSURE TEST — give the subagent the trigger scenario plus an excuse to
   skip ("we're in a hurry", "it probably works"). Confirm the skill's rules
   override the shortcut.
3. READ-BACK — ask the subagent to state, in its own words, what the skill
   requires of it. Gaps in its answer are gaps in the skill.
```

If a test fails, the fix is in the SKILL.md (sharper triggers, harder rules),
not in the test prompt.

## Checklist Before Commit

- [ ] `name` matches the directory, kebab-case
- [ ] `description` names concrete TRIGGER and DO NOT TRIGGER situations
- [ ] `when_to_use` carries synonyms in the languages you actually type
- [ ] Hard gates have an Iron Law + spirit-over-letter line
- [ ] Pressure-bearing rules have a Rationalization Watch table
- [ ] Uses the project's sanctioned execution path, not bare host commands
- [ ] Follows the project's committed-file conventions; sibling skills linked by name
- [ ] Trigger + pressure + read-back tests passed with a fresh subagent
- [ ] `version` bumped

---

> Trigger-first framing, pressure-testing with subagents, and the
> spirit-over-letter rule are adapted from obra/superpowers (`writing-skills`,
> MIT).
