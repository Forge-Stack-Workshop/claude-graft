---
name: project-scaffold
description: Use when a project has no container setup, no Makefile, or no CI pipeline — or when creating any of them. Scaffolds the whole chain (Dockerfile, Dockerfile.dev, compose, Makefile, CI workflow, release config) as one coherent system rather than as separate files.
---

# Project scaffold — one chain, not five files

These files are **one system**, and they are wrong when written separately:

```
make <target>  →  docker compose  →  Dockerfile.dev  →  derives from  →  Dockerfile
                                                                             ↑
                        .github/workflows/ci.yml  →  make ci  ────────────────┘
```

Scaffold them together. A Makefile written without knowing the compose service
names, or a workflow written without knowing `make ci` exists, is the drift the
whole design exists to prevent.

Templates sit in `templates/` next to this file. **Read the project first** —
its language, package manager, test runner and service names — and adapt them.
Never copy a template with its placeholders left in.

## Order

1. **`Dockerfile`** — production only, staged `base` → `deps` → `runtime`.
   No dev stage, no test framework, no linter, no docs toolchain.
   `base` creates the non-root user, so everything downstream inherits it.
2. **`Dockerfile.dev`** — starts at `FROM base`, supplied as a named build
   context. It **must not** repeat the `FROM <runtime>:<pinned>` line; that
   repetition is the drift.
3. **The derivation**, declared once — compose `additional_contexts` by
   default, `docker-bake.hcl` when CI needs a build graph. One or the other,
   never both.
4. **`compose.yml`** — services, not images. The app, the docs site and any
   worker share one image with different commands.
5. **`Makefile`** — the only human interface. Every target delegates to
   compose; none invokes a language tool directly.
6. **`.github/workflows/ci.yml`** — a thin caller: checkout, `make ci`.
7. **`.dockerignore`**, **`.env.example`**.

## Language specifics

**Python** — `pyproject.toml` is the only manifest: `[project]` for metadata and
runtime dependencies, `[dependency-groups]` for tooling, `[build-system]` with
`hatchling`. `src/` layout. `uv` with a committed `uv.lock`, installed frozen:

```dockerfile
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev            # deps stage
RUN uv sync --frozen                     # dev stage, tooling included
```

Never scaffold a `requirements.txt` or a `setup.py` — the guard refuses them,
and `python.md` says why.

## The decisions to make, not guess

- **Which stage `Dockerfile.dev` derives from.** `runtime` by default — dev is
  production plus tools, the strongest mirror. `deps` when the source is
  bind-mounted anyway. Never `base`: it skips the dependency layer, so dev and
  prod can resolve different versions.
- **Whether bake or compose carries the derivation.** Start with compose
  `additional_contexts`: it is one file fewer, and the developer path only ever
  builds through `make`. Add `docker-bake.hcl` when CI builds both targets and
  you want the dependency as an explicit build graph with a shared cache —
  which is a reason, not a default. Never keep both: two declarations of the
  same derivation is the drift this whole design avoids.
- **What `make ci` contains**, in cheapest-first order. Every gate below is
  blocking; ask before dropping one:

  | Gate | Fails on |
  | --- | --- |
  | format / lint | a file the formatter would change, any warning |
  | types | any error, strict mode |
  | tests | one failing test |
  | coverage | below `min_test_coverage_floor_pct` in `.claude/thresholds.json` |
  | docs | `mkdocs build --strict` |
  | secrets | any match outside the allowlist |
  | build | the production image does not build |

## The fallback, and its cost

`ARG BASE=app:runtime` + `FROM ${BASE}` works where BuildKit named contexts are
unavailable — but it resolves a **tag**, not a dependency. Build dev against a
stale tag and you silently get last week's base: the drift you were preventing,
arriving by another door. If you must use it, make the build order explicit in
the Makefile and say so in the README.

## Before you finish

**Run what you wrote.** `make help`, `make build`, `make up`, `make ci` — each
of them, as the reader will type it. A Makefile, a compose file and a Dockerfile
are exactly the files that look right and fail on execution: a shell
metacharacter in a recipe, a mount hiding a file, a port already taken. See
`verification.md`.

Then check that nothing wrote into the tree: `git status` clean, no new
directory (`generated-artifacts.md`).

- `make help` lists every target, generated from `##` comments.
- Everything in the Makefile is `.PHONY`.
- A newcomer with only a container runtime can run `make up` from a fresh clone.
- Every gate in `make ci` is runnable alone: a CI failure is reproducible with
  one local command. **A check that cannot be run locally does not exist.**
- No secret in a build argument — build args are visible in image history.
