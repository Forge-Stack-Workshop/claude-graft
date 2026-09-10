---
description: Generate a PR description from the current diff using the matching repo template
---

# PR Description — Padam-AV

Generates the description of a Pull Request from the current diff, in the format
expected by the repo (Conventional Commits, 1 PR per issue, squash merge).
Usable as a Claude Code slash command: `/pr-description`

______________________________________________________________________

## Instructions for Claude Code

______________________________________________________________________

## STEP 1 — Collect context

```bash
git rev-parse --abbrev-ref HEAD
git merge-base develop HEAD
git log --oneline develop..HEAD
git diff develop...HEAD --stat
```

Look at **all** commits on the branch since it diverged from `develop`,
not just the latest commit.

______________________________________________________________________

## STEP 2 — Infer the type and scope

- Dominant Conventional Commits type (`feat`, `fix`, `chore`, `docs`, `refactor`,
  `test`, `ci`) from the commits and diff.
- Django app(s) concerned (e.g. `provider`, `mission`, `territory`).
- Issue number if the branch name or a commit references it.

______________________________________________________________________

## STEP 3 — Generate the description

```text
## Summary

- [1 to 3 factual bullets about the "why", not just the "what"]

## Changes

- [key files/modules changed, grouped by app]

## Test plan

- [ ] `make ruff-check` with no new violation
- [ ] `make tests` — all tests pass
- [ ] [specific case to test manually if relevant]

Closes #[issue number if applicable]
```

______________________________________________________________________

## Behavior rules

- **PR title**: under 70 characters, format `type(scope): short summary`.
- **English only** (repo convention).
- Do not mention Claude/Claude Code in the description.
- If the diff touches Django migrations, point to `/migration-check`
  rather than duplicating that analysis here.
- Do not push or create the PR yourself — display the generated text and
  let the user validate before `gh pr create`.
