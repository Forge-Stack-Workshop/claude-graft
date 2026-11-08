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

- **Everything runs in a container** — application code, tooling, dependencies,
  tests, and the services the project talks to. The container *is* the
  environment (see `environment.md`). The only exception is the slice of a repo
  genuinely bound to the host OS (desktop apps, hardware/OS agents, editor
  extensions), and even then its portable pieces — deps, tests, tooling, CI —
  still containerise. "It is simpler on the host" is not a reason; a real host
  binding (a syscall, a device, a GUI toolkit) is.
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
- **No secret in an image, and none in a build argument** — build args are
  visible in image history.
- Layers ordered by rate of change; a real `.dockerignore`; healthchecks with
  `depends_on` waiting on health, not on start.
- **The `dev` stage hot-reloads and runs debug-on.** It launches the framework's
  own autoreloading dev server (backend hot-reload, frontend HMR) with the
  sources bind-mounted or `develop.watch`-synced, so an edit takes effect with no
  rebuild. A production application server (multi-worker, no reload) belongs in
  the `production` target, never in `dev`. Debug is a per-environment flag read
  from config — on in dev, off in production by contract.
- **Default to dev mode when starting an app locally.** Running the app on a
  developer machine (you, an agent, a `make` target, a README's first step)
  starts the dev stage — dev server, autoreload, debug on — by default. A
  production-like local run happens **only when explicitly requested**
  (reproducing a prod-only bug, a perf measurement, a release smoke-test) and is
  stated as such. Never launch the production server locally to "just run it".
