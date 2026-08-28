---
description: Dependency policy. Use when adding, pinning, updating, or auditing a dependency, or editing a manifest or lockfile.
paths:
  - "**/pyproject.toml"
  - "**/requirements*.txt"
  - "**/package.json"
  - "**/go.mod"
  - "**/Cargo.toml"
  - "**/*.lock"
  - "**/lock.json"
  - "**/package-lock.json"
  - "**/renovate.json*"
  - "**/dependabot.y*ml"
---

# Dependencies

## Adding one

A dependency is a decision, not a reflex. Before adding it, answer: is it
maintained (last release, open issue age), what is its own dependency tree, what
is its licence, and what would replacing it cost. A package pulled in for one
helper function is a supply-chain surface bought for a convenience.

It goes behind an adapter, never imported by the domain — see
`architecture.md`.

## Pinning

- **The lockfile is the source of truth**, committed, and never hand-edited.
  The manifest states intent; the lockfile states reality.
- **One manifest per project.** In Python that is `pyproject.toml` and nothing
  else — no `requirements.txt`, no `setup.py`. Two manifests give two answers
  to the same question. See `python.md`.
- Application dependencies are pinned exactly. A library's are ranged — an
  application that floats reproduces nothing.
- Install from the lockfile in CI and in images (`--frozen`, `npm ci`,
  `--locked`). An install that resolves at build time makes the image
  non-reproducible, which breaks `environment.md`.
- Regenerating a lockfile is its own commit, never folded into a feature.

## Keeping them

- Updates are **scheduled and automated** (Renovate, Dependabot), grouped, and
  reviewed like any change. Updating only when something breaks means updating
  everything at once, under pressure.
- A vulnerability scan runs as a CI gate. A known CVE with a released fix is a
  bug in the current sprint, not a backlog item.
- Licences are checked automatically against an allowlist. Discovering a
  copyleft transitive dependency at release time is discovering it too late.
- A dependency nothing imports is removed. Dead dependencies are attack surface
  that nobody reviews.
