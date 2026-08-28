---
description: Method ordering convention for Python classes. Use when writing or reviewing a Python class or dataclass.
paths:
  - "**/*.py"
---

# Class design — method order

**Documentation, not enforced.** No linter checks method ordering. This is a
review convention.

Methods appear in this order, alphabetically within each group:

1. dunder (`__init__`, `__repr__`, `__eq__`, …)
2. properties (`@property`, `@<name>.setter`)
3. abstract methods (`@abstractmethod`)
4. class methods (`@classmethod`)
5. static methods (`@staticmethod`)
6. public instance methods
7. private instance methods (`_`, `__`)

Public contract first, private implementation last — so a class's structure is
predictable to read, and it stays easier to keep within the limits in
`.claude/thresholds.json`.

One class per file, file named after the class.
