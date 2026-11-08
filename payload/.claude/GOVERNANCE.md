# Standards-governance skill set — Governance specification

A reusable, **project-agnostic** governance layer that sits above your
repositories. It defines how the skill set behaves as a system, independently of
any single repository, technology, or organization. All specifics come from
`config.yaml` and the standards canon; nothing here names a project or vendor.

Detailed, reusable contracts live in `shared/references/` and are cited here
rather than repeated.

---

## 1. Global architecture of the skill set

Nine composable skills, one per governance level, plus one spine:

```
                       ┌─────────────────────────────────────────┐
                       │  01 governance-core (the spine)           │
                       │  hierarchy · conflicts · human validation │
                       │  maturity dispatch · extension            │
                       └───────────────┬───────────────────────────┘
          consulted by every skill     │     inherits posture
   ┌───────────────┬───────────────┬───┴───────────┬───────────────┐
   ▼               ▼               ▼               ▼               ▼
02 bootstrap   03 development  04 infrastructure 05 quality   06 observability
                                                                   │
                   07 standards-audit      08 ui-ux                │
                                                                   ▼
                        09 external-actions  ◄── every skill routes
                        (Git/CI-CD/deploy/external effects)  here at an
                                                             R≥3 boundary
```

- **Source of truth** is always the configured canon (`config.yaml` →
  `canon.source`). Skills render/apply it; they never replace it
  (`shared/references/consuming-the-canon.md`).
- **Composability**: all skills may be active simultaneously. They share one
  hierarchy and one set of references, so they cannot contradict each other by
  construction; where inputs conflict, §3 resolves it.
- **Single choke point for effects**: anything leaving the local sandbox goes
  through `external-actions`, which enforces the human-validation gates.

Each `SKILL.md` follows a fixed contract: **name · role · triggers · rules
(which standards it applies) · inputs · execution steps · validation criteria ·
interactions · limits · actions requiring human validation.**

---

## 2. Rule hierarchy & priorities

Full contract: `shared/references/rule-hierarchy.md`. In short:

- **Authority over *what the rule is*** — canon > code/contracts/runtime >
  recent human decision > knowledge-base view > these skills.
- **Authority over *whether it binds*** — priority tiers (`model.priority_tiers`)
  and maturity markers (`model.maturity_markers`). Only a rule at the enforceable
  marker with a stable ID + owner + automated gate is blocking.
- **Invariants** (`model.invariants`) hold across every profile, technology and
  maturity level.

---

## 3. Conflict & ambiguity detection

A skill must **detect, name and resolve** conflicts — never silently pick a side
or quietly rewrite a rule.

- **Skill vs canon** → canon wins; mark the skill stale; follow the canon.
- **General rule vs project constraint** → apply the hierarchy (§2). A project
  may deviate only via an **ADR with owner + expiry**; without it, the general
  rule stands. Top-tier invariants are never traded away.
- **Prose vs machine file** → the machine file / canon wins; flag the prose for
  realignment.
- **Identifier collision** → **blocking error**; stop and report, do not guess.
- **Undecided (to-arbitrate)** → treat as open. Do **not** enforce and do **not**
  invent a decision; surface the ambiguity, propose an ADR / decision task, and
  ask the human.
- **Impossibility** (canon unreachable, contradictory inputs, missing profile) →
  state it explicitly, proceed only on invariants, and withhold any "done" claim
  until resolved.

Reporting shape for any conflict: *what disagrees*, *which rule wins and why
(cite the hierarchy rung + IDs)*, *what you did or what you need from the human*.

---

## 4. Validation & conformity

Full contract: `shared/references/conformity-and-gates.md`.

- Conformity is **verified, not asserted**; the authority is the conformity
  checker + the repo's resolved gates, not a skill's judgment.
- A task is **done** only when: profile resolved → automated gates pass (or
  failures baselined with ADR+owner+expiry) → language gate passes → error DoD
  met → docs updated → observability present → no new collisions/divergence →
  human gates cleared for any R≥3 action.
- Report **per-gate** with evidence. Never flip a task/gate/project to done on
  unvalidated agent output.
- **Automation-first**: prefer a mechanical, repeatable check over a manual
  eyeball wherever the canon provides one.

---

## 5. External-action rules

Full contract: `shared/references/risk-and-human-gates.md`.

- Classify every action **R0–R5**; confirmation is proportionate; prefer
  dry-run.
- **`manual-required` (never automatic)**: real sends, payments, deletion
  outside a test sandbox, **merge to the protected branch**, manual deploy from a
  workstation, destructive/structural knowledge-base changes, and marking a
  task/gate/project done on unvalidated output.
- **R3–R5 protocol**: prepare in one exchange, execute in a strictly later one;
  approval carries a fingerprint of the exact content shown; single-use, bound to
  `action_id` + task, short window; destructive capability stays
  `manual-required` regardless of standing authorization.
- **Git**: protected branch (no direct/force push, no delete); the only path onto
  it is a PR from the working branch; a release triggers production; no manual
  deploy.
- Propose a correction when a gap is found; **never** auto-apply a destructive or
  external fix.

---

## 6. Maturity adaptation

Full contract: `shared/references/profiles-and-maturity.md`.

- Adapt along **profile × architecture level × lifecycle state × standards
  version** — read the repo's declaration; do not guess.
- **Scale implementation depth, keep the invariants.** A prototype/incubator or a
  level-0 tool carries less ceremony but the invariants still apply.
- Every relaxation is **explicit** (profile override or lower gate ⇒ ADR with
  owner + expiry). Roll out new/tightened gates progressively
  (`info → warning → error`) behind a canary.

---

## 7. Extension mechanism (add/modify standards later, no rebuild)

The skill set is designed so that **adding a standard does not require touching
the skills**:

1. **A new or changed standard** is authored in the canon (its ID index + the
   relevant annex, with ID, version, status, owner, scope, profiles, automated
   controls, provenance, checksum). Because skills resolve rules **by ID via the
   canon/CLI** at use time, the new standard becomes exploitable immediately — no
   skill edit.
2. **A new profile / gate** is added in the canon and picked up through
   `profiles resolve` / the conformity checker. Skills consume it unchanged.
3. **A new organization or project** is onboarded by pointing `config.yaml` at
   its canon and tooling — no skill edit.
4. **Only a genuinely new *class of behaviour or trigger*** (something no existing
   level covers) warrants a skill change. Then: add a new skill under
   `skills/NN-<name>/SKILL.md` following the fixed contract (§1) and
   `skills/SKILL_TEMPLATE.md`; register it in `skills.index.yaml`; have it inherit
   the spine and route effects through `external-actions`; cite shared references
   instead of duplicating rules.
5. **Updating `shared/references/standards-model.md`** is optional navigation
   upkeep — it is metadata only and never the rule text; when it drifts from the
   canon, the canon wins.

Rule of thumb: **standards change in the canon; skills change only when the *way
of working* changes.**

---

## 8. Expected agent behaviour (summary)

- Consult `governance-core` first; inherit its posture everywhere.
- Resolve rules from the canon by ID; quote only what you resolved now.
- Adapt to profile/architecture-level/lifecycle; never weaken invariants.
- Detect and name conflicts and ambiguities; never silently simplify.
- Verify conformity before "done"; report per gate with evidence.
- Stop at every R≥3 boundary and get explicit human validation; never auto-apply
  destructive or external changes.
- Stay compatible with the agent's native rules/mechanisms where they apply.
