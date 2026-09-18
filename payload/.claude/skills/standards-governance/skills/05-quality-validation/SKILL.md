---
name: quality-validation
description: Use to verify conformity before calling anything done — run lint, formatting, type checks, static analysis, tests, and the conformity checker against the project's resolved standards, and decide pass/fail per gate. The authority for exit criteria. Triggers on "is this ready?", "run the gates", "check conformity", pre-commit/pre-PR verification.
---

# quality-validation

> Inherits `governance-core`. Consumes the canon by reference. This is the skill
> that says whether exit criteria are met — on evidence, not opinion.

## Role
Run the mechanical verification that a change conforms to the standards resolved
for the project, interpret the results against the gates, and produce a per-gate
verdict with evidence. Automation-first: prefer a repeatable check over a manual
read wherever the canon provides one.

## Triggers
- "Is this done / ready / conformant?"; before a commit, PR, or release; after a
  development or infrastructure change; fleet conformity spot-checks.

## Rules it applies (resolve from the canon by ID)
- Governance of gates: automated vs manual; severity ramp `info → warning →
  error`; anti-regression baseline.
- Quality/testing/supply-chain/performance domains and profile-specific gates.
- Exit criteria & named controls:
  `../../shared/references/conformity-and-gates.md`.

## Inputs it must gather before acting
1. Resolved standards + current thresholds for the profile
   (`gates.thresholds_files` / the canon).
2. The change under test and its scope.
3. Availability of the conformity checker and the language-gate tooling.

## Execution steps
1. **Resolve the gate set** for the profile (do not assume tools the canon does
   not name).
2. **Run the language gate** for the stack(s), as resolved from the canon /
   `config.yaml` → `gates.language_gates`.
3. **Run static analysis / security**: the code-quality service + the canon's
   linters/scanners (container, workflow, YAML/Markdown/spelling, secret
   scanning, docstring coverage, …) as resolved.
4. **Run the conformity checker** for the deterministic verdict.
5. **Interpret against gates**: pass, warn, or fail; map failures to IDs.
6. **Handle findings**: propose fixes; a pre-existing failure may be baselined
   only with an ADR + owner + expiry; never widen a baseline to mask a new
   regression; never auto-apply a destructive fix.
7. **Report per gate** with evidence (command + output location).

## Validation criteria (exit criteria)
- Every applicable gate has an explicit pass/fail with evidence.
- Failures are either fixed or baselined with ADR+owner+expiry.
- The full exit-criteria checklist in `conformity-and-gates.md` is satisfied
  before signalling "done".

## Interactions with other skills
- Consumes outputs of `development-conventions`, `infrastructure-execution`,
  `ui-ux-interaction`, `observability-diagnostics`.
- Feeds `standards-audit` for fleet/existing-repo evaluation.
- Blocks `external-actions` from merging/releasing until gates pass.

## Limits
- Is not the source of the rules — the conformity checker + canon are
  authoritative on pass/fail; the skill orchestrates and interprets.
- Does not fix code by deleting/rewriting destructively to make a gate green.
- Does not mark a task/gate/project done on unvalidated output.

## Actions requiring human validation
- Creating or widening a baseline / accepting a gate exception (ADR + owner +
  expiry, human-approved).
- Promoting a severity from `warning` to `error` fleet-wide (human-approved,
  after canary).
