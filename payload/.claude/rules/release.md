---
description: Release and versioning rules. Use when cutting a release, editing a changelog, or configuring release automation.
paths:
  - "**/CHANGELOG*"
  - "**/VERSION"
  - "**/*.releaserc*"
  - "**/release-please*"
  - "**/cliff.toml"
  - "**/.github/workflows/release*"
---

# Release — the invariants

- **`CHANGELOG.md` is generated from the commit history**, never hand-edited.
  Conventional Commits (`git.md`) exist to be consumed; a hand-written changelog
  makes the commit format a cost paid for nothing, and the edit is lost at the
  next generation anyway.
- Therefore the commit subject **is** the changelog entry. Write it for the
  person reading the release notes. A change that should not appear is typed
  `chore` — that is what the type is for.
- **Semantic version derived from the commits** since the last tag: `fix` →
  patch, `feat` → minor, `BREAKING CHANGE` → major. Not chosen by hand.
- The version exists in **one** place; everything else reads it. Two files
  holding a version number disagree eventually.
- Tags are annotated and immutable. Never move a released tag.
- A release is a tagged commit that passed every CI gate, and the released
  artefact is **the image CI built, promoted — not rebuilt**. A rebuild is a
  different artefact wearing the same version.
- Every release states how to roll back.
