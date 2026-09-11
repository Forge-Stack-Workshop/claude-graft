---
description: Enforce exhaustive, modern Python 3.14+ type annotations across a file
argument-hint: <path>
---

# Python 3.14+ Type Annotations Enforcement

Ensure all Python code uses exhaustive, PEP 484-compliant type hints.
Usable as a Claude Code slash command: `/typing-review <path>`

______________________________________________________________________

## Instructions for Claude Code

Run during code review, when adding new functions, or during compliance audits. Related files: `.claude/rules/typing.md`, `.claude/rules/python-guidelines.md`.

Enforce Padam-AV's zero-tolerance typing policy:

1. **Function Signatures** (All functions must have types)

   - Function arguments: `def get_user(user_id: int) -> User:`
   - Return types: Explicit for all public functions
   - Use `| None` instead of `Optional` (Python 3.10+ syntax)

1. **Class Attributes** (All attributes must be typed)

   - Instance variables: `self.name: str = ""`
   - Class variables: `MAX_RETRIES: int = 3`
   - Properties: `@property def status(self) -> str:`

1. **Modern Syntax** (Python 3.14+ only)

   - Use `from __future__ import annotations` at file top
   - Use `|` instead of `Union[A, B]`
   - Use `list[str]` instead of `List[str]` (built-in generics)
   - Use `dict[str, Any]` instead of `Dict[str, Any]`

1. **TYPE_CHECKING Block** (Avoid circular imports)

   ```python
   from __future__ import annotations

   import logging
   from typing import TYPE_CHECKING

   if TYPE_CHECKING:
       from apps.automata.models import Automata

   logger = logging.getLogger(__name__)

   class AutomataService:
       def get_automata(self, id: int) -> Automata:  # Type available at runtime
           pass
   ```

1. **No `Any` Without Justification** (Strongly prefer specific types)

   - ❌ Bad: `def process(data: Any) -> Any:`
   - ✅ Good: `def process(data: dict[str, str]) -> list[str]:`

______________________________________________________________________

## Typing Compliance Checklist

```
✅ `from __future__ import annotations` at top of file
✅ All function arguments have type hints
✅ All function return types specified (no implicit None)
✅ All class attributes typed (instance and class vars)
✅ Use `| None` instead of `Optional`
✅ Use `|` instead of `Union`
✅ Use `from typing import TYPE_CHECKING` for circular imports
✅ Use built-in generics (`list`, `dict`, `tuple`, not `List`, `Dict`, `Tuple`)
✅ No `Any` without comment explaining why
✅ No `type:` comments (use inline hints only)
✅ Dataclasses have type hints on all fields
✅ All imports used only in TYPE_CHECKING block
```

______________________________________________________________________

## Common Type Patterns

**Union Types**:

```python
# Python 3.10+ (Padam-AV uses this)
status: str | None = None
result: list[str] | dict[str, int] = []

# NOT (old style, avoid)
from typing import Union, Optional, List, Dict
status: Optional[str] = None
result: Union[List[str], Dict[str, int]] = []
```

**Generics**:

```python
# ✅ GOOD (modern syntax)
def filter_active(items: list[dict[str, Any]]) -> list[str]:
    return [item["name"] for item in items if item.get("active")]

# ❌ BAD (old syntax)
from typing import List, Dict
def filter_active(items: List[Dict[str, Any]]) -> List[str]:
    pass
```

**TYPE_CHECKING**:

```python
# ✅ GOOD (avoid circular imports)
from __future__ import annotations
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from apps.automata.models import Automata

class AutomataService:
    def get(self, id: int) -> Automata:  # Type available at annotation time
        # At runtime, no circular import
        from apps.automata.models import Automata
        return Automata.objects.get(id=id)
```

______________________________________________________________________

## Expected Output

After enforcing typing, confirm:

- ✅ All functions have argument and return type hints
- ✅ All class attributes are typed
- ✅ No `Any` types (or justified with comments)
- ✅ Modern Python 3.14+ syntax throughout
- ✅ No circular import issues
- ✅ Code passes Pyright/Ruff type checking
- ✅ IDE autocomplete and refactoring work perfectly

______________________________________________________________________

## Usage

```bash
# Add exhaustive type hints to a file:
# /typing-review padam_av/apps/automata/services.py

# Check type compliance via Ruff:
make ruff-check  # Includes ANN (annotations) rules

# Manual type checking:
pyright padam_av/  # Optional, for additional validation
```
