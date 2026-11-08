# Profiles, architecture levels & maturity adaptation

Standards are **not** applied identically to every project. Adaptation is done
along real axes — **profile × architecture level × lifecycle state × standards
version** — not along vague labels. Invariants hold regardless; only
*implementation depth* scales. (Vocabulary is configurable in `config.yaml` →
`model`.)

## 1. Read the project's declaration first

Every repo declares what it is, via the keys in `model.declaration_keys`.
Canonical shape (adjust to your canon):

```yaml
project_profile: service
architecture_style: layered-hexagonal
architecture_level: level-2
bounded_context: <context>
standards_version: "1"
```

If the declaration is missing, that is itself a finding (bootstrap/audit must
add it). Do not guess the profile silently.

## 2. Profile (what the repo *is*)

Default set (`model.profiles`):

- `library` — published package; minimal public API; semantic versioning.
- `service` — autonomous network API/service.
- `frontend` — UI consuming published contracts.
- `worker` — async / scheduler / consumer.
- `cli` — command-line tool.
- `game` — game/engine project; domain/runtime separation.
- `infrastructure` — chart / manifests / operator / platform.

The profile selects which standards are **mandatory / recommended / not
applicable**. Resolve it: `<standards_cli> profiles resolve --language <l>
--role <r> --target <t>` (or read the resolved set from the managed block).

## 3. Architecture level (how much design the domain *earns*)

Proportionate to business-domain complexity — **do not over-architect small
tools** (`model.architecture_levels`):

- **level-0** — scripts / migrations / tiny tools. Simple structure, no
  ceremony.
- **level-1** — CRUD with limited rules. Separate domain/application/adapters
  only where it clarifies.
- **level-2** — significant domain. Entities, value objects, aggregates,
  invariants, domain events.
- **level-3** — complex/distributed domain. Bounded contexts, anti-corruption
  layers, integration events, targeted CQRS.

The domain stays independent of frameworks and infrastructure at every level.

## 4. Lifecycle state (how much upkeep the repo *owes*)

Drives maintenance cadence and how strict the exit gates are *for changes now*
(`model.lifecycle_states`):

- **active** — update on each significant advance; review regularly.
- **maintenance** — update on each real change.
- **blocked** — update whenever blocker / owner / exit condition / deadline
  changes.
- **frozen** (or archived) — no regular upkeep, **but** reason, date and
  reactivation condition stay explicit.

## 5. How adaptation actually works (the rule)

- **Keep the intent and the invariants.** A lower architecture level or an
  experimental/incubator posture lowers *ceremony*, never the invariants
  (`model.invariants`): no secrets in VCS, containers-by-default where the canon
  requires them, no auto-merge to the protected branch, no vendor lock-in in a
  feature, identity through the common SSO when deployed, ADR for every
  exception.
- **Scale the implementation**, not the rule. Example: an error-handling DoD
  still applies, but a level-0 tool satisfies it with far less machinery than a
  level-3 service.
- **Every deviation is explicit**: a profile override or a lower gate requires
  an ADR with owner + expiry. Never relax a gate silently.
- **A non-standard distribution/topology** may need a different shape — deliver
  it as a separate profile/artefact with an explicit ADR, not as an
  undocumented exception.

## 6. Progressive rollout

When introducing or tightening a gate across several repos, ramp severity
`info → warning → error` only after existing debt is cleared; validate on a
canary set (one repo per major stack) before making it blocking fleet-wide.
