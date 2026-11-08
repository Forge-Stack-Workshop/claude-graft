---
name: fastapi-tdd
description: FastAPI testing strategies with pytest, pytest-asyncio and pytest-mock, TDD methodology, async fixtures, httpx AsyncClient, coverage, and testing FastAPI routers, services and SQLAlchemy repositories.
---

# FastAPI Testing with TDD

Test-driven development for FastAPI applications using pytest, pytest-asyncio,
pytest-mock and httpx.

> **Mocking convention:** use the `mocker` fixture from **pytest-mock**
> (`mocker.patch`, `mocker.AsyncMock`) rather than `unittest.mock`. Mock all DB
> access in unit tests; reserve real-DB tests for `@pytest.mark.integration`.

## When to Activate

- Writing new FastAPI services
- Implementing REST routers, services and repositories
- Testing SQLAlchemy models and async data access
- Setting up testing infrastructure for FastAPI projects

## TDD Workflow

### Red-Green-Refactor Cycle

```python
# Step 1: RED — write a failing test
def test_hash_password_roundtrip():
    hashed = hash_password("s3cret-pass")
    assert verify_password("s3cret-pass", hashed)

# Step 2: GREEN — implement the minimum to pass
# Step 3: REFACTOR — improve while keeping tests green
```

## Setup

### pytest Configuration

```ini
# pyproject.toml -> [tool.pytest.ini_options]  (or pytest.ini)
[pytest]
testpaths = tests
python_files = test_*.py
python_functions = test_*
asyncio_mode = auto
addopts =
    --cov=app
    --cov-report=html
    --cov-report=term-missing
    --strict-markers
markers =
    slow: marks tests as slow
    integration: marks tests as integration tests (real DB)
```

### conftest.py — async session & client

```python
# tests/conftest.py
from collections.abc import AsyncIterator

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.api.deps import get_session
from app.main import app
from app.models.base import Base

TEST_DATABASE_URL = "postgresql+asyncpg://test:test@localhost:5432/test"  # pragma: allowlist secret


@pytest.fixture
async def session() -> AsyncIterator[AsyncSession]:
    """Provide an AsyncSession bound to a rolled-back transaction."""
    engine = create_async_engine(TEST_DATABASE_URL)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as db:
        yield db
    await engine.dispose()


@pytest.fixture
async def client(session: AsyncSession) -> AsyncIterator[AsyncClient]:
    """HTTP client with the DB dependency overridden by the test session."""
    app.dependency_overrides[get_session] = lambda: session
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()
```

## Data Builders

Prefer small typed builders / fixtures over raw dicts for complex models.

```python
# tests/factories.py
from decimal import Decimal

from app.models.product import Product


def build_product(**overrides) -> Product:
    """Construct an unsaved Product with sensible defaults."""
    defaults = {
        "name": "Test Product",
        "slug": "test-product",
        "price": Decimal("99.99"),
        "stock": 10,
        "is_active": True,
        "category_id": 1,
    }
    return Product(**{**defaults, **overrides})
```

## Unit Testing (services / repositories)

Mock the repository so the service is tested in isolation — no DB.

```python
# tests/test_order_service.py
import pytest

from app.services.order import OrderService


@pytest.mark.asyncio
async def test_create_order_persists_items(mocker):
    repo = mocker.Mock()
    repo.add = mocker.AsyncMock(side_effect=lambda order: order)
    service = OrderService(repository=repo)

    order = await service.create_order(user_id=1, cart=build_cart(item_count=3))

    assert len(order.items) == 3
    repo.add.assert_awaited_once()
```

## Model / Repository Testing (integration)

```python
# tests/test_product_repository.py
import pytest

from app.repositories.product import ProductRepository
from tests.factories import build_product


@pytest.mark.integration
@pytest.mark.asyncio
async def test_list_active_excludes_inactive(session):
    session.add_all([build_product(slug="a"), build_product(slug="b", is_active=False)])
    await session.flush()

    products = await ProductRepository(session).list_active(limit=50, offset=0)

    assert {p.slug for p in products} == {"a"}
```

## API Endpoint Testing

```python
# tests/test_products_api.py
import pytest
from fastapi import status


@pytest.mark.asyncio
async def test_list_products_empty(client):
    response = await client.get("/api/v1/products")
    assert response.status_code == status.HTTP_200_OK
    assert response.json() == []


@pytest.mark.asyncio
async def test_create_product_unauthorized(client):
    response = await client.post("/api/v1/products", json={"name": "X", "price": "9.99"})
    assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.asyncio
async def test_create_product_negative_price(auth_client):
    payload = {"name": "X", "price": "-1", "stock": 1, "category_id": 1}
    response = await auth_client.post("/api/v1/products", json=payload)
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
```

## Mocking External Services

Mock outbound HTTP (`httpx`) and other I/O — never the code under test.

```python
# tests/test_payments.py
import httpx
import pytest


@pytest.mark.asyncio
async def test_successful_charge(mocker):
    mock_post = mocker.patch("httpx.AsyncClient.post", new_callable=mocker.AsyncMock)
    mock_post.return_value = httpx.Response(200, json={"status": "succeeded"})

    result = await charge_card(amount=9999, token="tok_visa")

    assert result.succeeded
    mock_post.assert_awaited_once()
```

## Testing Best Practices

### DO

- **Use `mocker.AsyncMock`** for coroutines and async dependencies
- **Override dependencies** with `app.dependency_overrides` instead of monkeypatching internals
- **One behaviour per test**; descriptive names (`test_user_cannot_delete_others_product`)
- **Test edge cases**: empty inputs, None, boundary values
- **At least one negative test per endpoint** (401/403/422)
- **Keep tests deterministic**: no `time.sleep`, no unmocked network

### DON'T

- **Don't import `unittest` / `unittest.mock`** — pytest-mock only
- **Don't block the event loop** in async tests
- **Don't over-mock**: mock only external dependencies and the DB in unit tests
- **Don't test framework internals**: trust FastAPI / SQLAlchemy / Pydantic
- **Don't leave `dependency_overrides` set** across tests — clear them

## Coverage

```bash
pytest --cov=app --cov-report=term-missing
```

| Component | Target Coverage |
| --- | --- |
| Services | 90%+ |
| Repositories | 85%+ |
| Routers | 80%+ |
| Schemas | 85%+ |
| Overall | 85%+ (hard gate) |

## Quick Reference

| Pattern | Usage |
| --- | --- |
| `@pytest.mark.asyncio` | Run an async test (or `asyncio_mode = auto`) |
| `AsyncClient(transport=ASGITransport(app=app))` | In-process HTTP client |
| `app.dependency_overrides[dep] = ...` | Swap a dependency (DB session, auth) |
| `mocker.AsyncMock` | Mock a coroutine / async call |
| `mocker.patch("module.attr")` | Patch an external dependency |
| `@pytest.mark.integration` | Mark tests that hit a real DB |
| `session.flush()` | Persist within the rolled-back test transaction |

Remember: tests are documentation. Good tests explain how your code should work.
Keep them simple, readable and maintainable.
