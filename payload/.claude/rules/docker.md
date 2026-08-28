---
description: Container invariants. Use when writing or reviewing a Dockerfile, compose file, bake file, or .dockerignore.
paths:
  - "**/Dockerfile*"
  - "**/*.dockerfile"
  - "**/compose*.y*ml"
  - "**/docker-compose*.y*ml"
  - "**/docker-bake.*"
  - "**/.dockerignore"
---

# Docker — the invariants

Creating these files? Use the `project-scaffold` skill — they are one system
with the Makefile and the CI workflow, and writing them separately is the drift
this rule exists to prevent.

- **The production Dockerfile stays pure.** It describes a production artefact
  and must not know a development environment exists. No dev stage, no test
  framework, no linter, no docs toolchain.
- **`Dockerfile.dev` derives from it** and must not repeat the
  `FROM <runtime>:<pinned>` line — the `convention-guard` hook blocks it.
  Repeating it *is* the drift, wherever it lives. The derivation is declared
  as a build graph (bake `contexts`, compose `additional_contexts`), not
  resolved through a tag.
- Derive from `runtime` (dev = prod plus tools) or from `deps` (source is
  bind-mounted anyway). **Never from `base`** — that skips the dependency
  layer, so dev and prod can resolve different versions.
- **Services, not images.** Distinct processes share one image with different
  commands. A second image because a second process exists is how a project
  ends up with four bases.
- Non-root user created in `base`, so every derived image inherits it.

## The image serves what it references

The production image is complete on its own: no manual step, no writable
volume, no second service needed to make it serve.

- **Assets are collected, compiled and fingerprinted at build time**, never at
  start-up. An image that prepares itself when it boots fails differently on
  every restart, and twice at once behind a load balancer.
- **A development server's conveniences are not a runtime.** Everything it
  served for free — static files, autoreload, verbose errors — needs an
  explicit answer in the image, or it is missing in production only, which is
  the worst place to find out.
- Values needed only at build time are `ARG`, never `ENV`: an `ENV` persists
  into the running container, and neither carries a secret since build
  arguments stay readable in the image history.
- **Verify by requesting the page**, not by listing the directory that should
  contain it — see `verification.md`.
- **No secret in an image, and none in a build argument** — build args are
  visible in image history.
- Layers ordered by rate of change; a real `.dockerignore`; healthchecks with
  `depends_on` waiting on health, not on start.
