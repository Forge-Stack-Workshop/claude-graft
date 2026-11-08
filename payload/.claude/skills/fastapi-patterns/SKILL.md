---
name: fastapi-patterns
description: FastAPI architecture patterns — async endpoints, dependency injection, Pydantic v2, SQLAlchemy async, JWT auth, background tasks, middleware, production-grade FastAPI apps.
origin: chrysa
---

# FastAPI Development Patterns

Production-grade FastAPI patterns for the chrysa ecosystem.

## When to Activate

- Building FastAPI REST APIs
- Setting up async SQLAlchemy with FastAPI
- Implementing auth (JWT, OAuth2)
- Designing dependency injection hierarchies
- Adding background tasks, middleware, rate limiting

## Project Structure

```text
api/
├── main.py              # App factory (create_app())
├── config.py            # Settings (pydantic-settings BaseSettings)
├── dependencies.py      # Shared DI: get_db, get_current_user
├── routers/
│   ├── __init__.py
│   ├── auth.py
│   └── items.py
├── models/              # SQLAlchemy ORM models
├── schemas/             # Pydantic v2 request/response schemas
├── services/            # Business logic (no DB access directly)
├── repositories/        # DB access layer
└── middleware/
    ├── logging.py
    └── rate_limit.py
```

## App Factory

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI

@asynccontextmanager
async def lifespan(app: FastAPI):
    # startup
    await init_db()
    yield
    # shutdown
    await close_db()

def create_app() -> FastAPI:
    app = FastAPI(
        title="API",
        lifespan=lifespan,
        docs_url="/docs" if settings.debug else None,  # disable in prod
    )
    app.include_router(auth_router, prefix="/auth", tags=["auth"])
    app.include_router(items_router, prefix="/items", tags=["items"])
    app.add_middleware(LoggingMiddleware)
    return app
```

## Async SQLAlchemy

```python
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

engine = create_async_engine(settings.database_url, pool_size=10, max_overflow=5)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)

async def get_db() -> AsyncIterator[AsyncSession]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
```

## Dependency Injection

```python
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    payload = decode_jwt(token)  # raises on invalid
    user = await user_repo.get_by_id(db, payload["sub"])
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    return user
```

## Pydantic v2 Schemas

```python
from pydantic import BaseModel, ConfigDict, field_validator

class UserCreate(BaseModel):
    email: EmailStr
    password: str

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be >= 8 characters")
        return v

class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)  # replaces orm_mode

    id: int
    email: str
    created_at: datetime
```

## Background Tasks

```python
from fastapi import BackgroundTasks

@router.post("/send-notification")
async def send_notification(
    user_id: int,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    # return immediately, process in background
    background_tasks.add_task(send_email_task, user_id, db)
    return {"status": "queued"}
```

## Middleware

```python
import time
from starlette.middleware.base import BaseHTTPMiddleware

class LoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start = time.perf_counter()
        response = await call_next(request)
        duration = time.perf_counter() - start
        logger.info(f"{request.method} {request.url.path} {response.status_code} {duration:.3f}s")
        return response
```

## Error Handling

```python
from fastapi import Request
from fastapi.responses import JSONResponse

@app.exception_handler(ValueError)
async def value_error_handler(request: Request, exc: ValueError):
    return JSONResponse(status_code=422, content={"detail": str(exc)})

# Custom domain exception
class NotFoundError(Exception):
    def __init__(self, resource: str, id: int):
        self.resource = resource
        self.id = id

@app.exception_handler(NotFoundError)
async def not_found_handler(request: Request, exc: NotFoundError):
    return JSONResponse(status_code=404, content={"detail": f"{exc.resource} {exc.id} not found"})
```

## Security Checklist

- [ ] CORS: explicit origins, no `allow_origins=["*"]` in production
- [ ] Rate limiting: `slowapi` or `redis`-based per IP/user
- [ ] JWT: short expiry (15min access, 7d refresh), `HS256` minimum
- [ ] Input validation: Pydantic v2 strict mode for sensitive endpoints
- [ ] SQL: never f-string in queries, always ORM or `text()` + `bindparams`
- [ ] Secrets: `pydantic-settings` + env vars, never hardcode
