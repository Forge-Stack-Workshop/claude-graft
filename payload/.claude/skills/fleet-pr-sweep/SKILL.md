---
name: fleet-pr-sweep
description: Use for recurring fleet-wide PR merge/audit campaigns across chrysa org repos (dependabot waves, standards-sync waves, WIP-to-PR cleanup). Packages the proven triage-merge-resync recipe and its known gotchas so each wave is not re-discovered from scratch.
disable-model-invocation: true
---

# fleet-pr-sweep

Run a controlled merge/audit pass over open PRs across chrysa-org repos.
This is a repeatable OPS workflow, not a one-off. Invoke with `/fleet-pr-sweep`.

## Preconditions

- Active gh account MUST be `chrysa` (`gh auth switch --user chrysa`). The
  chrysa-guardrails PreToolUse hook blocks mutating gh on org repos otherwise.
- NEVER switch gh account mid-run while a background gh job is in flight.
- Work repo-by-repo; do not spin a blind loop (the classifier blocks looping
  destructive gh-merge, and it is the correct instinct — stay deliberate).

## Recipe

1. **Inventory.** `gh pr list --state open` per repo (or fleet script). Group by
   author: dependabot vs feature/WIP vs standards-sync.
2. **Classify CI red.** A red check is EITHER:
   - **billing-blocked** (Actions job fails in ~2s on an account billing issue)
     → not a real failure, safe to `--admin` merge after a local build check.
   - **real red** → do NOT merge; fix or leave. Verify by reading the job log,
     not the summary dot.
   - **phantom "expected" quality-gate check** → blocks even `--admin`; this is a
     stuck reusable-workflow check, not a real UNSTABLE. Re-run or bypass per repo.
3. **Merge.** `gh pr merge <n> --admin --squash` (admin bypasses billing-red).
4. **Dirty / conflicting locally.** Many GitHub-CONFLICTING PRs are clean locally.
   Resolve with the union recipe: `git switch develop && git reset --hard
   origin/develop && git merge origin/main -X ours` (adjust base per repo);
   for stacked PRs reset local develop first.
5. **Dependabot** cannot rebase against the private registry — regenerate
   lockfiles locally, commit, then admin-merge.
6. **Resync Notion.** Append a dated `🐙 État repo` section to each touched repo's
   fiche (append-only; mark prior section PÉRIMÉ). Never overwrite history.

## Gotchas (memory-derived)

- Bash tool runs zsh: no word-splitting on unquoted vars — use `mapfile`/arrays
  in a script, not bare `for x in $list`.
- `gh --fill` uses cwd, not `-R` target — cd into the repo.
- Review rule is OFF on container-webview / chrysa-lib develop.
- SonarCloud org is at the 50k LOC free cap: pviz/SFM/sport can't be analyzed
  server-side; a red Sonar there is the cap, not the code.

## Output

A short per-repo table: repo | PRs merged | left-red (real) | Notion resynced.
Stop and report; do not chase tangents.
