# Conformity & exit criteria

A task is **done** only when conformity is **verified, not asserted**. The
authority on pass/fail is the configured conformity checker
(`config.yaml` → `tooling.conformity_checker`) plus the repo's resolved gates —
never a skill's opinion. Skills run the checks, read the verdict, and report.

## The exit-criteria checklist (generic; resolve specifics from the canon)

Before calling any non-trivial task complete:

1. **Profile resolved.** The repo's declaration is known and the applicable
   standards have been resolved (`<standards_cli> profiles resolve` / managed
   block).
2. **Automated gates pass** for that profile. The conformity checker is clean,
   or any failure is covered by a baseline exception that has an ADR + owner +
   expiry. Never widen a baseline to hide a new regression.
3. **Language gate** passes for the stack(s) involved — resolve the exact
   command set from `config.yaml` → `gates.language_gates` or the canon. Do not
   assume tools the canon does not name. (A typical Python set, as an example:
   `ruff format --check`, `ruff check`, `mypy`/`pyright`, import-linter,
   dependency check, test run, lockfile check.)
4. **Error DoD.** Expected errors are documented, tested, surfaced correctly to
   the user, correlated in observability, and have a recovery / fallback /
   clean-failure behaviour proportionate to their impact.
5. **Docs updated.** Docstrings present where required; a short README in each
   non-trivial folder; ADRs for the *why*.
6. **Observability present** for anything deployed (structured logs, no
   secret/PII in logs, error→issue correlation) per the canon.
7. **No new ID collisions**, no new prose/machine divergence introduced.
8. **Human gates cleared** for any R≥3 action the task performed or requires
   (`risk-and-human-gates.md`).

## Named automated controls (examples)

Common industry controls a canon may require: a code-quality/static-analysis
service (rating + hotspots), a linter/formatter, a type checker, an
import-boundary linter, a dependency checker, a test runner with strict
markers, container linting, CI/workflow linting, YAML/Markdown/spelling linting,
secret scanning, docstring coverage, and a deterministic conformity checker.
Resolve the **authoritative, current** gate list and thresholds from the canon
(`gates.thresholds_files` / the annex). Pin tool versions; pin CI actions by
digest.

## Reporting a verdict

- Report pass/fail **per gate**, with the evidence (command + output location),
  not a blanket "looks good".
- A gap that is real but out of this task's scope is recorded as a finding (see
  the audit skill), not silently left or silently fixed.
- Never flip a task/gate/project to "done" on unvalidated agent output.
