---
description: Review test files against Padam-AV's dual unit/integration testing strategy and structure rules
argument-hint: <path>
---

# Test Review & Quality Assurance

Review test files for compliance with Padam-AV's dual-testing strategy and quality standards.
Usable as a Claude Code slash command: `/test-review <path>`

______________________________________________________________________

## Instructions for Claude Code

Run during PR review of test files, when adding new test coverage, or auditing test quality. Related files: `.claude/rules/tests.md`, `.claude/rules/decorator-optimization.md`.

**Key Principle**: A failing test is better than no test. An untested code path is a production bug waiting to happen.

Ensure tests meet Padam-AV's strict quality standards:

1. **Dual Strategy**: Unit tests (mocked deps) + Integration tests (real services)
1. **100% Coverage**: All accessor packages must reach 100% code coverage
1. **Proper Structure**: Single main @pytest.mark.{type} class with nested sub-classes (NOT multiple module-level classes)
1. **Isolation**: Unit tests use fixtures+mocks; integration tests use @pytest.mark.integration
1. **Documentation**: Every test has a docstring explaining *why* it exists

______________________________________________________________________

## Instruction Sources (Read These First)

- `.claude/rules/tests.md` (complete testing framework)
  - Section 5: Test Class Structure (MANDATORY—explains correct vs incorrect patterns)
- `.claude/rules/decorator-optimization.md` (decorator scope rules)

______________________________________________________________________

## Test Compliance Checklist

```
✅ File named test_{module}.py or {module}_test.py
✅ Single main @pytest.mark.{type} class (NOT multiple classes)
✅ Nested test classes inside main class (for sub-features)
✅ All methods use same decorator at class level
✅ English-only docstrings explaining test purpose
✅ No unittest.TestCase (use pytest.mark instead)
✅ No mock.patch (use pytest-mock fixtures)
✅ Factories for test data (not hardcoded dicts)
✅ Isolated tests (no shared state between tests)
✅ Readable assertions (use pytest.raises, assert ...in...)
✅ Marked with @pytest.mark.unit or @pytest.mark.integration
```

______________________________________________________________________

## Test Structure Example (CORRECT)

```python
@pytest.mark.unit
class TestAddPrefixToKey:
    """Test the add_prefix_to_key decorator."""

    def test_adds_prefix_to_string_key(self, mocker):
        # Arrange, Act, Assert
        pass

    def test_handles_none_key(self, mocker):
        # Arrange, Act, Assert
        pass

    class TestWithRedisCache:
        """Test decorator with Redis cache enabled."""

        def test_cache_hit(self, mocker, mock_redis):
            pass
```

______________________________________________________________________

## Expected Output

After reviewing tests, confirm:

- ✅ Passes `make tests` (pytest runs without errors)
- ✅ Coverage > 80% for new code (100% for accessors)
- ✅ All tests are fast (< 100ms for unit tests)
- ✅ All tests are isolated (no setup.py teardown side effects)
- ✅ All tests have clear purpose (docstrings explain *why*)
- ✅ All fixtures and mocks are properly scoped
- ✅ Ready for code review and merge

______________________________________________________________________

## Usage

```bash
# Invoke on a specific test file:
# /test-review {app}/tests/test_{module}.py

# Or manually check:
make tests  # Runs pytest with coverage
```
