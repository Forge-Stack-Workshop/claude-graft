# Consuming the canon (single source of truth)

> **These skills are a rendering, never a source of truth.** The executable
> canon is whatever `config.yaml` points at (`canon.source`). If a skill and
> the canon diverge, the **canon wins** and the skill is stale (see
> `rule-hierarchy.md`). This is deliberate: standards evolve in the canon, and
> the skills keep working unchanged.

Every skill that needs a rule MUST resolve it from the canon at use time instead
of hard-coding rule text. This is what keeps the skill set valid when standards
change, and why a new standard becomes usable with no skill edit
(`../../GOVERNANCE.md` §7, Extension).

## Where the canon lives

Read it from `config.yaml`:

- `canon.source` — the repo / API / local artefact holding the executable
  standards.
- `canon.baseline_file`, `canon.annexes_dir`, `canon.domains_file` — the
  baseline text, the normative annexes, and the machine-readable ID index
  (when present).
- `canon.managed_block_marker` — the marker of the managed block that mirrors
  the canon into a target repo's agent file (e.g. `CLAUDE.md` / `AGENTS.md`).
  This is the copy the agent usually sees first when working inside a repo.

## Resolution order (use the first that is available)

1. **The standards CLI** (`tooling.standards_cli`, default `standards`) against
   the live API or a signed local artefact:
   - `<cli> list`
   - `<cli> show <STANDARD-ID>`
   - `<cli> search "<topic>"`
   - `<cli> profiles list`
   - `<cli> profiles resolve --language <l> --role <r> --target <t>`
   - `<cli> diff <STANDARD-ID> --from <v> --to <v>`
   - `<cli> export --profile <p> --format json`
   - `<cli> doctor`
   - Expected contract: `--json`, `--offline`, stable exit codes; stdout =
     result, stderr = diagnostics.
2. **The conformity checker** (`tooling.conformity_checker`) for a deterministic
   pass/fail of a repo against its resolved profile (read-only; it is the
   authority on conformity, not the skill).
3. **The managed block** (`canon.managed_block_marker`) in the target repo's
   agent file, plus `canon.domains_file` and the relevant annex, read directly
   from the checked-out canon or its release artefact.
4. **The release artefact / local export** when offline.

## When none of the above is reachable

Do **not** invent rule text and do **not** silently relax a rule. Instead:

- State explicitly that the canon could not be resolved and which path failed.
- Proceed only on the **invariants** that hold regardless of profile
  (`model.invariants` in `config.yaml`, or the strongest-tier rules resolved
  earlier), and mark every other decision as *unverified against canon*.
- Ask the human to make the canon reachable (point `canon.source`, run the CLI)
  before any exit-criteria / "done" claim.

## Rules for referencing in a skill

- Reference a standard by **ID**, never by pasted prose.
- When you need the current text, resolve it (steps 1–4) at that moment.
- If you must quote a rule to the human, quote what you resolved *now* and cite
  its ID + version, so the quote is traceable and falsifiable.
- Treat the canon's **priority tiers** (`model.priority_tiers`) and **maturity
  markers** (`model.maturity_markers`) as first-class: only a rule at the
  enforceable marker (`model.enforceable_marker`) with a stable ID, an owner and
  an automated gate is **blocking**; everything else is advisory and must be
  surfaced as such, never enforced as a gate.
