---
name: fastapi-security
description: FastAPI security best practices — dependency-based authentication and authorization, JWT validation, Pydantic input validation, SQLAlchemy parameterized queries, CORS, security headers, rate limiting, and secrets via environment.
---

# FastAPI Security Best Practices

Focused security guidelines for FastAPI + SQLAlchemy 2.0 async applications.

## When to Activate

- Wiring authentication / authorization dependencies
- Implementing JWT issuance and validation
- Reviewing a FastAPI service for security issues
- Hardening a deployment configuration

## Secrets & Configuration

Never hardcode secrets. Load them through Pydantic Settings from the environment.

```python
from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    jwt_secret: str = Field(min_length=32)
    jwt_algorithm: str = "RS256"
    cors_allow_origins: list[str] = []
```

```bash
# .env — never committed
JWT_SECRET=...                                                   # pragma: allowlist secret
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/app   # pragma: allowlist secret
```

## Password Hashing

```python
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["argon2", "bcrypt"], deprecated="auto")

def hash_password(raw: str) -> str:
    return pwd_context.hash(raw)

def verify_password(raw: str, hashed: str) -> bool:
    return pwd_context.verify(raw, hashed)
```

Argon2/bcrypt only — never MD5/SHA1.

## Authentication — JWT

Validate the algorithm, expiry and audience explicitly. Never accept `alg: none`,
never mix symmetric and asymmetric algorithms.

```python
import jwt
from fastapi import HTTPException, status


def decode_token(token: str, *, key: str, audience: str) -> dict:
    try:
        return jwt.decode(
            token,
            key,
            algorithms=["RS256"],  # single, pinned algorithm — never "none"
            audience=audience,
            options={"require": ["exp", "iat", "aud", "iss"]},
        )
    except jwt.InvalidTokenError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token") from exc
```

## Authorization — dependencies

Authorization is enforced with FastAPI dependencies, not inline checks. Fail closed.

```python
from collections.abc import Callable

from fastapi import Depends, HTTPException, status

from app.models.user import User


async def get_current_user(token: str = Depends(bearer_scheme)) -> User:
    payload = decode_token(token.credentials, key=..., audience=...)
    return await load_user(payload["sub"])


def require_role(*roles: str) -> Callable[[User], User]:
    async def dependency(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN)
        return user

    return dependency


@router.delete("/products/{product_id}")
async def delete_product(
    product_id: int,
    _: User = Depends(require_role("admin")),
    session: AsyncSession = Depends(get_session),
) -> None: ...
```

**IDOR:** scope every object lookup to the current user/tenant in the repository query —
never trust an ID from the path alone.

## Input Validation — Pydantic v2

All external input crosses a Pydantic schema at the boundary; constrain it there.

```python
from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=12)
    display_name: str = Field(max_length=80)
```

## SQL Injection Prevention

Use SQLAlchemy constructs / bound parameters — never string-format SQL.

```python
from sqlalchemy import select, text

# GOOD — ORM construct, parameters bound automatically
stmt = select(User).where(User.email == email)

# GOOD — raw text with bound parameters
await session.execute(text("SELECT * FROM users WHERE email = :email"), {"email": email})

# BAD — never interpolate user input
await session.execute(text(f"SELECT * FROM users WHERE email = '{email}'"))  # VULNERABLE
```

## CORS

Explicit origins only — never `["*"]` in production.

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allow_origins,  # explicit list from settings
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## Security Headers

```python
from starlette.middleware.base import BaseHTTPMiddleware


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Content-Security-Policy"] = "default-src 'self'"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response
```

## Rate Limiting

Use `slowapi` (or a gateway/proxy) to throttle auth and sensitive endpoints.

```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)


@router.post("/login")
@limiter.limit("5/minute")
async def login(request: Request, payload: LoginRequest): ...
```

## File Upload Validation

```python
from fastapi import HTTPException, UploadFile, status

ALLOWED_TYPES = {"image/jpeg", "image/png", "application/pdf"}
MAX_BYTES = 5 * 1024 * 1024


async def validate_upload(file: UploadFile) -> bytes:
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE)
    data = await file.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE)
    return data
```

## Quick Security Checklist

| Check | Description |
| --- | --- |
| No debug/reload in prod | Never ship `--reload`; disable verbose error pages |
| HTTPS only | Force TLS at the proxy, HSTS header, secure cookies |
| Strong secrets | Env-only, loaded via Pydantic Settings |
| Password hashing | argon2/bcrypt via passlib |
| JWT validation | Pin algorithm, require `exp`/`aud`/`iss`, never `alg: none` |
| Authorization | Enforced via `Depends`, fail closed, IDOR-scoped queries |
| Input validation | Pydantic v2 schemas at every boundary |
| SQL injection | SQLAlchemy bound params, never string-format SQL |
| CORS | Explicit origins, never `["*"]` in prod |
| Security headers | CSP, X-Frame-Options, X-Content-Type-Options, HSTS |
| Rate limiting | Throttle auth and sensitive endpoints |
| File uploads | Validate content type and size |

Remember: security is a process, not a product. Review and update regularly.
