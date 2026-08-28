---
description: Python conventions. Use when writing or reviewing Python code.
paths:
  - "**/*.py"
---

# Python

- The runtime version is the one pinned in the Dockerfile — never assume, read
  it. Every public signature is type-annotated; `mypy`/`pyright` clean.
- Docstrings are **Google style**: one imperative summary line, then `Args`,
  `Returns`/`Yields`, `Raises`, `Example` — omitting empty sections. Document
  what the signature does not say; restating the type is noise. A generator uses
  `Yields`, never `Returns`. Private helpers get a summary line only.
- `pathlib` over `os.path`. `dataclasses`/`pydantic` over ad-hoc dicts.
- `ruff` is the formatter and the linter. Zero warnings.
- Tests with `pytest`. Fixtures over setup methods. One assertion concept per test.

## Packaging — the standards, and nothing else

**`pyproject.toml` is the only manifest.** No `requirements.txt`, no
`setup.py`, no `setup.cfg`. A project that carries two manifests has two
answers to "what does this need", and they diverge.

- **`[project]`** holds the metadata and the runtime dependencies (PEP 621).
  `requires-python` is set and matches the version pinned in the Dockerfile.
- **`[dependency-groups]`** holds everything that is not runtime — `dev`,
  `docs`, `test` (PEP 735). Not extras: extras are part of the published
  package's public surface, development tooling is not.
- **`[build-system]`** declares a PEP 517 backend. **`hatchling`** by default.
  Not `setuptools`: it carries decades of implicit behaviour, and nothing here
  needs it.
- **`src/` layout.** The package is not importable from the repository root, so
  the tests exercise the installed package rather than the working copy — which
  is what CI and production actually run.

## Resolving and installing

- **`uv`**, with `uv.lock` committed. The lock is the source of truth; the
  manifest states intent. Never hand-edit either.
- Install from the lock, always frozen: `uv sync --frozen` in images and in CI.
  An install that re-resolves at build time makes the image non-reproducible.
- `uv export --format pylock.toml` when another tool needs the lock: PEP 751 is
  the interchange format, not a second source.
- Everything runs in the container — `uv` on the host is not the workflow. See
  `environment.md`.
