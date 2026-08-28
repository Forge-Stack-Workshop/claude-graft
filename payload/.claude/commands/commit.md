---
description: Prepare a Conventional Commit for the current changes — review, stage, and draft the message, without committing
argument-hint: [optional scope or intent]
---

Prepare a commit for the current changes. Intent, if given: $ARGUMENTS

**Do not run `git commit`.** Prepare everything and stop, so the developer
triggers it.

1. Run `git status` and `git diff` (and `git diff --cached`) and read what
   actually changed. Never write a message from the conversation's memory of
   what you did.
2. Check the change against `.claude/rules/git.md`: is the work on a branch and
   not the default one? Does the change carry its tests and its documentation?
   If either is missing, say so before proposing anything — an incomplete
   commit is the thing the rule exists to prevent.
3. If the change covers more than one coherent concern, propose splitting it
   and say where the line falls.
4. Draft the message: `type(scope): imperative subject`, no trailing period,
   under 72 characters. The body explains *why*. Add a `BREAKING CHANGE:` footer
   where it applies. **Never** add a `Co-Authored-By: Claude` trailer, a
   "Generated with…" footer, or any other tool signature — see `git.md`.
5. Report: the files to stage, the proposed message, and the exact command the
   developer can run.
