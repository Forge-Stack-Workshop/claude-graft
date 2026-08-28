---
description: Makefile conventions. Use when writing or reviewing a Makefile or any make include.
paths:
  - "**/Makefile"
  - "**/*.mk"
---

# Makefile — the invariants

Creating it? Use the `project-scaffold` skill.

```
make <target>  →  docker compose  →  Dockerfile.dev  →  derives from  →  Dockerfile
```

- **The Makefile is the only human interface**, and a target **never does the
  work itself**. A recipe invoking `pytest`, `ruff`, `mkdocs` or a package
  manager directly is running on the host, which `environment.md` forbids.
- Compose flags live in **one variable**, not repeated per recipe.
- Target names are stable across projects — `up down logs sh build test lint
  format typecheck docs docs-build migrate ci` — so muscle memory transfers and
  CI does not learn a dialect.
- **`help` is the default goal**, generated from `##` comments on the targets.
  Help maintained separately from the targets goes stale in a week.
- **Everything is `.PHONY`.** Without it, `make test` silently stops working
  the day someone adds a `test/` directory.
- Each target is runnable alone and does one thing; `ci` composes them without
  reimplementing them.
