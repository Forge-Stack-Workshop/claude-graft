# Git

- **Never commit, stage, push, or rewrite history unless explicitly asked.**
  Finishing the work is not permission to commit it. Prepare, then wait.
- **Always on a branch.** Never a direct commit on the default branch.
  Naming: `feat/<slug>`, `fix/<slug>`, `docs/<slug>`, `refactor/<slug>`.
- **Conventional Commits**: `type(scope): imperative subject`, no trailing
  period. Types: `feat` `fix` `docs` `refactor` `test` `chore` `perf` `build`
  `ci`. Breaking change: `!` after the scope plus a `BREAKING CHANGE:` footer.
  The body says *why* — the diff already says *what*.
- **One commit = code + its tests + its documentation.** A commit that changes
  behaviour while touching neither is incomplete.
- **One PR per issue, and every PR references its issue.** A pull request closes
  exactly one tracked problem and names it; a PR that fixes three unrelated
  things is three reviews wearing one hat. The issue link is a blocking check
  where the forge supports one.
- **Squash-merge by default.** A branch's commits collapse to one Conventional
  Commit on the default branch, so the history reads as one change per merge and
  the changelog (`release.md`) stays legible. The commit subject is the one that
  survives — write it for the release notes.
- **Work starts from a spec and a plan.** A non-trivial change is specified and
  planned before it is implemented — what it must do and how, agreed first — so
  the diff is reviewed against an intent, not reverse-engineered from it. A
  behaviour-preserving fix or a one-line correction needs neither.
- **No tool signature, anywhere.** No co-author trailer naming an assistant, no
  "generated with" footer, no session link, no mention of an assistant — not in
  commit messages, not in pull request bodies, not in the project's files. The
  history is the team's, not that of the tooling that helped write it. A commit
  message ends at its last line of substance.
- Never commit generated files, secrets, or local configuration.
