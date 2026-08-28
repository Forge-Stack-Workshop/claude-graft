---
description: Invariants for CI pipelines. Use when writing or reviewing a GitHub Actions workflow, GitLab CI config, or any pipeline definition.
paths:
  - "**/.github/workflows/**"
  - "**/.gitlab-ci.y*ml"
  - "**/.circleci/**"
  - "**/Jenkinsfile"
---

# CI — the invariants

Creating the pipeline? Use the `project-scaffold` skill.

- **What runs in CI locally is a mirror of what runs on the forge, and neither
  exists without the other.** There is exactly one definition of "green":
  `make ci`, running in the dev image. The workflow is a **thin caller** —
  checkout, `make ci`, nothing more.
- A workflow that lists its own steps is a second definition of green. It
  drifts exactly the way two Dockerfiles drift, and "it passes locally" becomes
  true and meaningless at the same time.
- **A check that cannot be run locally does not exist.** If a CI failure is not
  reproducible with one command on your machine, the pipeline is broken.
- No gate is skippable by an environment variable. A flag that turns off a
  check exists to be left on by accident.
- Deterministic: no undeclared network, no wall-clock dependence, no shared
  mutable state between jobs. A flaky pipeline teaches people to re-run instead
  of to read.
- Runs on every pull request **and** on the default branch. A gate that only
  runs after merge reports failures too late.
- Cache by lockfile hash, never by branch. Secrets from the forge's store,
  never echoed, never exposed to a fork's pull request.

**The split:** most write-time hooks in `.claude/hooks/` warn; a few block, and
each says which in its `_why` in `settings.json`. CI blocks everything.

So a rule that matters is a gate in `make ci`. A rule that lives only in
`.claude/rules/` is advice, and advice is followed until it is inconvenient.
