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
- **No tool signature, anywhere.** No co-author trailer naming an assistant, no
  "generated with" footer, no session link, no mention of an assistant — not in
  commit messages, not in pull request bodies, not in the project's files. The
  history is the team's, not that of the tooling that helped write it. A commit
  message ends at its last line of substance.
- Never commit generated files, secrets, or local configuration.
