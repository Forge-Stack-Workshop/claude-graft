---
description: Generate unit and integration tests (happy path, error cases, boundaries) for a module
argument-hint: <path>
---

# Test Generation & Coverage

Generate comprehensive, isolated, and maintainable tests following Padam-AV's dual-testing strategy.
Usable as a Claude Code slash command: `/tests-generate <path>`

______________________________________________________________________

## Instructions for Claude Code

Run when adding new features, writing coverage for untested modules, or improving test quality. Related files: `.claude/rules/tests.md`, `.claude/rules/decorator-optimization.md`.

Generate tests that meet Padam-AV's quality standards:

1. **Unit Tests** (Fast, mocked, isolated)

   - Mock all external dependencies (DB, Redis, APIs)
   - Test pure logic (no I/O)
   - Execute in \<100ms per test
   - Marked with `@pytest.mark.unit`

1. **Integration Tests** (Slow, real services)

   - Use real database (PostgreSQL)
   - Use real Redis cache
   - Use real MQTT connections
   - Marked with `@pytest.mark.integration`
   - Execute in \<1 second per test

1. **Edge Case Coverage**

   - Normal cases (happy path)
   - Error cases (exceptions, invalid input)
   - Boundary cases (null, empty, max values)
   - Race conditions (if applicable)

1. **Test Structure**

   - Single main @pytest.mark.{type} class per file
   - Nested sub-classes for grouped tests
   - Fixtures for shared setup
   - Factories for test data

1. **Documentation**

   - Every test has a docstring explaining *why* it exists
   - Setup/teardown logic is documented
   - Complex assertions explained

______________________________________________________________________

## Test Coverage Checklist

```
✅ Normal cases (happy path tested)
✅ Error cases (exceptions caught)
✅ Boundary cases (null, empty, max)
✅ Permission checks (who can access)
✅ Type validation (input types checked)
✅ Return types verified (assert return type)
✅ Side effects verified (DB written, cache updated)
✅ Isolated tests (no shared state)
✅ Readable assertions (use pytest.raises, assert ... in ...)
✅ Performance tests (assert execution time < threshold)
```

______________________________________________________________________

## Example Test Structure (CORRECT)

```python
import pytest
from {app}.services import MyService
from {app}.tests.factories import MyFactory

@pytest.mark.unit
class TestMyService:
    """Test MyService business logic."""

    def test_returns_expected_value_when_conditions_met(self, mocker):
        """Test normal operation with expected inputs."""
        # Arrange: Set up test data
        obj = MyFactory(active=True)
        service = MyService(obj)

        # Act: Call function under test
        result = service.get_status()

        # Assert: Verify result
        assert result == "expected_value"

    class TestWithCaching:
        """Nested tests for caching behavior."""

        def test_caches_result(self, mocker):
            """Test that result is cached."""
            pass
```

______________________________________________________________________

## Expected Output

After running this generation, you should have:

- ✅ **Unit Test Suite** (mocked, fast, 100+ tests)
- ✅ **Integration Test Suite** (real services, slower, 50+ tests)
- ✅ **Coverage Report** (>80% coverage, 100% for critical paths)
- ✅ **Documented Tests** (every test has a docstring)
- ✅ **Test Data** (factories for consistent test objects)
- ✅ **Performance Tests** (assertions on execution time)
- ✅ **Ready for CI/CD** (tests pass locally and in CI)

______________________________________________________________________

## Coverage Goals

- **Minimum**: 80% code coverage
- **Target**: 90% code coverage
- **Critical Paths**: 100% (security, data integrity, etc.)

______________________________________________________________________

## After generating

1. Run `/test-review <path>` on the generated files to check compliance with the
   dual unit/integration strategy — do not re-audit those rules inline here.
2. Run `/test <path>` to execute the new tests and confirm they pass with coverage.

______________________________________________________________________

## Usage

```bash
# Generate tests for a module:
# /tests-generate {app}/services.py

# Check coverage:
make tests-reports  # Runs pytest with coverage and reports generation
```
