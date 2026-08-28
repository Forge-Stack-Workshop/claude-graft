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
