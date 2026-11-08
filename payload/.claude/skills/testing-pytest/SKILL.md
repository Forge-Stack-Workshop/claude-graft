---
name: testing-pytest
description: Pytest framework essentials — no-boilerplate test functions, fixtures, parametrization, markers, plugins, mocking, coverage measurement, and conftest configuration for scalable Python testing.
origin: Python Testing with unittest, nose, pytest (PythonTesting.net)
---

# Testing with Pytest

The run-anything, no-boilerplate test framework for Python. pytest is the
default choice for new Python test suites — plain functions, plain
`assert`, powerful fixtures, and a large plugin ecosystem.

## Prerequisites (preflight)

Check that `pytest` is installed:
```bash
python -c "import pytest" || echo "WARN: pip install pytest"
```

If missing, install via `pip install pytest`.

## When to Activate

- Writing a new test suite from scratch
- Migrating a legacy `unittest`-style or `nose`-style suite to pytest
- Setting up fixtures (reusable or parametrized test data/state)
- Measuring code coverage
- Building custom markers, hooks, or a shared `conftest.py`
- Speeding up or parallelizing a slow suite
- Mocking external dependencies (HTTP, filesystem, time, randomness)

## Simple Test Structure (No Boilerplate)

pytest uses plain functions and plain `assert` — no test-case classes, no
`self.assertEqual(...)` API to memorize:

```python
def test_multiply_numbers():
    assert multiply(3, 4) == 12

def test_multiply_strings():
    assert multiply("a", 3) == "aaa"
```

Run with `pytest test_file.py` or bare `pytest` (auto-discovers `test_*.py`
/ `*_test.py` files and `Test*` classes without an `__init__`).

pytest's assertion rewriting gives rich failure diffs on plain `assert` —
no need for `assertEqual`/`assertTrue`/`assertIn` style APIs at all.

## Fixtures

Fixtures are reusable setup/teardown units injected into tests as
parameters, declared with `@pytest.fixture`:

```python
@pytest.fixture
def sample_list():
    return [1, 2, 3, 4]

def test_length(sample_list):
    assert len(sample_list) == 4

def test_contains(sample_list):
    assert 1 in sample_list
```

**Scopes** (broadest to narrowest lifetime): `session` (once per run),
`package`, `module` (once per file), `class`, `function` (default, once
per test). Pick the broadest scope that stays correct — a narrower scope
recreates state unnecessarily.

```python
@pytest.fixture(scope="session")
def database_connection():
    conn = connect_db()   # setup, once
    yield conn
    conn.close()          # teardown, once, after the whole session
```

**Fixture composition**: fixtures can depend on other fixtures, and a
fixture can request `request` for introspection or parametrize itself:

```python
@pytest.fixture(params=["sqlite", "postgres"])
def backend(request):
    return build_backend(request.param)   # test runs once per param
```

Use `autouse=True` sparingly — only for setup every test in scope truly
needs (e.g. resetting a global cache); it hides the dependency from the
test signature.

## Parametrization

Run the same test body against multiple inputs with
`@pytest.mark.parametrize`, instead of a loop inside the test (a loop
hides which case failed and stops at the first failure):

```python
@pytest.mark.parametrize(
    ("first", "second", "expected"),
    [
        (3, 4, 12),
        ("a", 3, "aaa"),
        (2, 0, 0),
    ],
)
def test_multiply(first, second, expected):
    assert multiply(first, second) == expected
```

Each parameter set is reported as its own test — one failing case never
hides another. Stack multiple `@pytest.mark.parametrize` decorators to get
the cartesian product of two independent axes.

## Markers

Tag tests for selective running or to encode expected status:

```python
@pytest.mark.slow
def test_expensive_computation():
    ...

@pytest.mark.skip(reason="Not implemented yet")
def test_future_feature():
    ...

@pytest.mark.skipif(sys.platform == "win32", reason="POSIX only")
def test_posix_permissions():
    ...

@pytest.mark.xfail(reason="Known upstream bug #123")
def test_known_bug():
    ...
```

Run only slow tests: `pytest -m slow`. Skip slow tests: `pytest -m "not slow"`.
Register custom markers in `pyproject.toml`/`pytest.ini` (or via
`pytest_configure`) so `--strict-markers` catches typos instead of
silently ignoring them.

## conftest.py

`conftest.py` centralizes fixtures, hooks, and plugin configuration for a
directory tree. pytest auto-discovers it — no import needed — and shares
its fixtures with every test file at or below that level:

```python
# conftest.py
import pytest


@pytest.fixture
def api_client():
    return Client(base_url="http://localhost:8000")


def pytest_configure(config):
    config.addinivalue_line(
        "markers", "slow: marks tests as slow (deselect with -m 'not slow')"
    )
```

Nest `conftest.py` files per package to scope fixtures/hooks to a subtree;
avoid one giant root-level file mixing unrelated concerns.

## Mocking & External Dependencies

Use `pytest-mock` (the `mocker` fixture) rather than raw `unittest.mock` —
it auto-undoes patches at teardown, removing a common source of state
leaking between tests:

```python
def test_api_call(mocker):
    mock_get = mocker.patch("requests.get")
    mock_get.return_value.json.return_value = {"status": "ok"}

    result = fetch_data()

    assert result == {"status": "ok"}
    mock_get.assert_called_once()
```

Mock at the boundary: network calls, filesystem access, the system clock
(`freezegun` or `mocker.patch("time.time")`), and randomness
(`mocker.patch("random.randint")`, or seed the RNG) — never internal pure
logic, which should be exercised directly.

## Coverage Measurement

Measure coverage with `pytest-cov`:

```bash
pytest --cov=mypackage --cov-report=term-missing --cov-report=html
```

`--cov-report=term-missing` lists uncovered line numbers directly in the
terminal; `--cov-branch` adds branch coverage, catching an `if` whose
`else` path is never exercised even when every line executes at least
once. Treat coverage as a signal for untested paths, not a target to
game — 100% line coverage with no meaningful assertions is worse than
honest 85%.

## Async Tests

`pytest-asyncio` runs `async def test_*` functions directly:

```python
import pytest


@pytest.mark.asyncio
async def test_fetch_async():
    result = await fetch_data_async()
    assert result == {"status": "ok"}
```

Set `asyncio_mode = "auto"` in `pyproject.toml`/`pytest.ini` to drop the
per-test `@pytest.mark.asyncio` marker project-wide.

## Parallel & Selective Runs

- `pytest-xdist`: `pytest -n auto` distributes tests across CPU cores;
  `--dist=loadscope` keeps tests sharing a class/module fixture on the
  same worker.
- `pytest -x`: stop at the first failure — fast feedback while iterating.
- `pytest --lf`: rerun only the tests that failed last time.
- `pytest -k "expression"`: select tests by name substring/expression.

## Plugins

Extend pytest with pip-installable plugins, activated automatically once
installed (no explicit registration needed in most cases):

- `pytest-cov` — coverage measurement
- `pytest-mock` — the `mocker` fixture over `unittest.mock`
- `pytest-asyncio` — async/await test support
- `pytest-xdist` — parallel test execution
- `pytest-timeout` — kill a test exceeding a time limit
- `pytest-randomly` — randomize test order to surface hidden ordering
  dependencies
- `pytest-django` / `pytest-flask` / framework-specific plugins — app
  fixtures (test client, DB transaction rollback, settings overrides)

Install with the project's dependency manager, then configure via
`[tool.pytest.ini_options]` in `pyproject.toml` (preferred over a separate
`pytest.ini` when the project already uses `pyproject.toml`).

## Common Pitfalls

| Pitfall | Solution |
| --- | --- |
| Fixture not visible to a test | Define in `conftest.py` at or above that test's directory; check scope |
| Test discovery fails | Use `test_*.py`/`*_test.py` naming; ensure packages have `__init__.py` if required by config |
| Hardcoded test data creates brittle tests | Use `parametrize` + factories instead of fixed literals/IDs |
| Suite runs too slow | Mark expensive tests, run a fast subset locally, parallelize with `pytest-xdist` |
| Mocks/state leak between tests | Prefer `mocker` (auto-teardown) over manual `mock.patch()`; keep fixtures function-scoped when mutated |
| Coverage shows 0% for a module executed at import time | Measure with `--cov-branch`; some import-time code needs a dedicated exclusion, not a fake test |
| `@pytest.mark.parametrize` IDs are unreadable in output | Pass `ids=[...]` or use descriptive tuples so failures are traceable to a case |
| Fixture teardown never runs after an error | Use `yield` fixtures, not `return` + manual cleanup calls scattered in tests |
| Flaky tests from real time/randomness | Freeze time (`freezegun`) and seed/mock randomness explicitly |

## Migrating from unittest or nose

Both are legacy status here — not a target style for new code:

- **nose**: unmaintained since 2015; treat any remaining nose-based suite
  as migration debt, not a baseline to imitate.
- **unittest**: still in the standard library and still runnable by
  pytest (it discovers and executes `TestCase` classes), but new tests
  should use plain pytest functions and fixtures, not `TestCase`
  subclasses or `setUp`/`tearDown`.

Migration path: keep existing `TestCase` classes running under pytest
unchanged first (zero-risk), then convert file by file — replace
`setUp`/`tearDown` with fixtures, replace `self.assertX(...)` calls with
plain `assert`, and replace subclass-based test data variants with
`@pytest.mark.parametrize`.

## Checklist

- [ ] Tests are plain functions with plain `assert`, not `TestCase` subclasses
- [ ] Shared setup lives in fixtures (`conftest.py` for cross-file reuse), not `setUp`/duplicated code
- [ ] Fixture scope is the broadest one that stays correct
- [ ] Multi-case tests use `parametrize`, not a loop inside the test body
- [ ] External I/O, time, and randomness are mocked (`mocker`, `freezegun`)
- [ ] Custom markers are registered and used for slow/integration/xfail segmentation
- [ ] Coverage is measured with `--cov-branch` and read as a gap-finder, not a vanity number
- [ ] Slow suites use `pytest-xdist` for parallel execution
- [ ] No remaining `nose` usage; `unittest.TestCase` usage is understood as legacy, not the target style
