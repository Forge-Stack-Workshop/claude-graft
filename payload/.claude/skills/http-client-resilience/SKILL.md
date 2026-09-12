---
name: http-client-resilience
description: Building resilient HTTP clients — modern sync/async clients (httpx), mandatory timeouts, retries with exponential backoff and jitter, circuit breakers, idempotency, connection pooling, client-side rate limiting, error classification, pagination, streaming, and testing with mocked transports.
origin: authored
---

# HTTP Client Resilience

Patterns for HTTP clients that stay correct and stable under latency, partial
failures, and load — not just the happy path.

## Prerequisites (preflight)

Requires **httpx**. Verify; warn if missing:

```bash
python -c "import httpx" 2>/dev/null || echo "WARN: httpx missing — pip install httpx"
```

## When to Activate

- Writing or reviewing code that calls an external HTTP API
- A service has no timeout, retry, or backoff strategy
- Debugging cascading failures, hung requests, or thread/connection exhaustion
- Designing calls to a flaky or rate-limited third-party API
- Reviewing PRs that add `requests`/`httpx`/`fetch` calls

## Modern HTTP Client

Prefer `httpx` over `requests` — native async support, HTTP/2, typed timeouts.

```python
import httpx

# Sync
with httpx.Client(base_url="https://api.example.com", timeout=DEFAULT_TIMEOUT) as client:
    response = client.get("/resource/123")

# Async
async with httpx.AsyncClient(base_url="https://api.example.com", timeout=DEFAULT_TIMEOUT) as client:
    response = await client.get("/resource/123")
```

Reuse one client instance per process/worker (connection pooling, keep-alive) —
never instantiate a new client per request.

## Timeouts — Always Explicit, Never Default

A client with no timeout can hang forever. Set all four dimensions:

```python
import httpx

DEFAULT_TIMEOUT = httpx.Timeout(
    connect=3.0,   # time to establish TCP/TLS connection
    read=10.0,     # time between bytes on the response
    write=10.0,    # time to send the request body
    pool=5.0,      # time waiting for a free connection in the pool
)
```

- Never rely on a library default — defaults vary by version and are often
  `None` (no timeout) for at least one dimension.
- Read timeout should reflect the slowest acceptable response for that
  specific endpoint — do not reuse one blanket value for every API.
- Pool timeout must be set when the connection pool is bounded (see below) —
  otherwise threads/tasks block indefinitely waiting for a free connection.

## Retries, Backoff, and Jitter

Retry only on transient failures — network errors, timeouts, and 5xx/429 —
never blindly on any exception.

```python
import random
import time

MAX_RETRIES = 3
BASE_DELAY_SECONDS = 0.5
MAX_DELAY_SECONDS = 8.0

def retry_delay(attempt: int) -> float:
    """Exponential backoff with full jitter (AWS-recommended)."""
    capped = min(MAX_DELAY_SECONDS, BASE_DELAY_SECONDS * (2**attempt))
    return random.uniform(0, capped)
```

- **Exponential backoff**: delay doubles each attempt, capped at a max.
- **Jitter is mandatory**: without it, retrying clients synchronize and
  produce a "thundering herd" against the recovering server. Full jitter
  (`random.uniform(0, capped)`) beats fixed or equal jitter for spreading load.
- Respect `Retry-After` on 429/503 when the server sends it — it overrides
  computed backoff.
- Cap total retry attempts and total elapsed time — a runaway retry loop is
  worse than a fast failure.
- Use a library (`tenacity`, `httpx`'s transport-level `Retry`) instead of
  hand-rolling this in more than one place.

```python
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential_jitter

@retry(
    retry=retry_if_exception_type((httpx.TransportError, httpx.TimeoutException)),
    wait=wait_exponential_jitter(initial=0.5, max=8.0),
    stop=stop_after_attempt(3),
)
def fetch_resource(client: httpx.Client, resource_id: str) -> httpx.Response:
    response = client.get(f"/resource/{resource_id}")
    response.raise_for_status()
    return response
```

## Circuit Breaker

Stop calling a dependency that is clearly down — fail fast instead of piling
up timeouts and retries.

```text
CLOSED  --failure_threshold exceeded-->  OPEN
OPEN    --after recovery_timeout-->      HALF_OPEN
HALF_OPEN --trial call succeeds-->       CLOSED
HALF_OPEN --trial call fails-->          OPEN
```

- **Closed**: requests pass through normally, failures are counted.
- **Open**: requests fail immediately (no network call) until a cooldown
  elapses — protects both the caller and the struggling dependency.
- **Half-open**: after cooldown, allow one trial request through; success
  closes the circuit, failure reopens it.
- Combine with retries at a lower layer: circuit breaker wraps the
  retry-decorated call, not the other way around.
- Libraries: `pybreaker`, `circuitbreaker`; or a shared in-house wrapper if the
  team already standardized on one.

## Idempotency

Retries are only safe when the operation is idempotent. Classify every call:

| Method | Naturally idempotent | Retry default |
| --- | --- | --- |
| GET, HEAD, PUT, DELETE | Yes | Safe to retry |
| POST | No | Retry only with an idempotency key |
| PATCH | Depends on semantics | Verify per endpoint |

- For non-idempotent POST/PATCH calls that must be retried (payments, mission
  dispatch, order creation), generate a client-side idempotency key and send
  it on every attempt of the same logical request:

```python
import uuid

idempotency_key = str(uuid.uuid4())  # generated once per logical operation

for attempt in range(MAX_RETRIES):
    response = client.post(
        "/missions",
        json=payload,
        headers={"Idempotency-Key": idempotency_key},
    )
```

- The key must be stable across retries of the *same* operation and unique
  per *new* operation — never regenerate it inside the retry loop.
- Confirm the provider actually supports and deduplicates on the header before
  relying on it; document the assumption if unconfirmed.

## Connection Pooling and Keep-Alive

```python
limits = httpx.Limits(
    max_connections=100,
    max_keepalive_connections=20,
    keepalive_expiry=30.0,
)
client = httpx.Client(limits=limits, timeout=DEFAULT_TIMEOUT)
```

- Size the pool to the expected concurrency, not arbitrarily large — an
  unbounded pool can exhaust the target server or local file descriptors.
- One client per destination service, shared across the process/worker
  lifetime; close it on shutdown (`client.close()` / `async with`).
- Keep-alive avoids TCP/TLS handshake cost on every call — significant for
  high-frequency integrations.

## Client-Side Rate Limiting

Throttle outgoing calls to stay under a provider's documented quota, rather
than reacting to 429s after the fact.

```python
from asyncio import Semaphore

# Cap concurrent in-flight requests to this provider
provider_semaphore = Semaphore(5)

async def call_provider(client: httpx.AsyncClient, path: str) -> httpx.Response:
    async with provider_semaphore:
        return await client.get(path)
```

- Token-bucket (`aiolimiter`, `pyrate-limiter`) for a rate expressed as
  requests/second rather than raw concurrency.
- Rate limiting and the circuit breaker are complementary, not substitutes:
  limiting prevents self-inflicted 429s, the breaker reacts to real outages.

## Error Classification

```python
def is_retriable(response: httpx.Response) -> bool:
    """4xx (except 429) are client errors — retrying will not help."""
    if response.status_code == 429:
        return True
    if 500 <= response.status_code < 600:
        return True
    return False
```

- 4xx (400, 401, 403, 404, 422): the request itself is wrong — retrying
  unchanged is pointless; surface the error, do not loop.
- 429: rate limited — retriable, respect `Retry-After`.
- 5xx: server-side, transient — retriable with backoff.
- Network errors (`ConnectError`, `ConnectTimeout`, `ReadTimeout`): retriable.
- Always call `response.raise_for_status()` (or explicit status checks) —
  never assume 200 without checking.

## Pagination

```python
def iter_all_pages(client: httpx.Client, path: str) -> Iterator[dict]:
    """Follow cursor-based pagination until the API signals completion."""
    cursor = None
    while True:
        params = {"cursor": cursor} if cursor else {}
        response = client.get(path, params=params)
        response.raise_for_status()
        payload = response.json()
        yield from payload["items"]
        cursor = payload.get("next_cursor")
        if cursor is None:
            break
```

- Prefer cursor/token pagination over offset-based when the API offers it —
  offset pagination drifts under concurrent writes.
- Stream pages lazily (generator) — never accumulate the full dataset in
  memory unless the caller explicitly needs it materialized.
- Apply the same timeout/retry policy to each page request individually.

## Streaming

```python
with client.stream("GET", "/large-export") as response:
    response.raise_for_status()
    for chunk in response.iter_bytes():
        process(chunk)
```

- Use `client.stream()` for large responses — avoids buffering the entire
  body in memory.
- Streamed responses still need a read timeout per chunk, not just an overall
  deadline — a stalled stream should not hang forever.

## Testing (respx / mocks)

Never hit a real network in unit tests — mock the transport layer.

```python
import httpx
import respx

@respx.mock
def test_fetch_resource_retries_on_server_error():
    """Given a transient 503 then a 200, fetch_resource returns the successful payload."""
    route = respx.get("https://api.example.com/resource/123").mock(
        side_effect=[
            httpx.Response(503),
            httpx.Response(200, json={"id": "123"}),
        ]
    )
    with httpx.Client(base_url="https://api.example.com") as client:
        response = fetch_resource(client, "123")
    assert response.status_code == 200, f"{response.status_code=}"
    assert route.call_count == 2, f"{route.call_count=}"
```

- `respx` for `httpx` (route-based mocking, assert call counts/history).
- Test each failure mode separately: timeout, connection error, 4xx, 5xx,
  429 with `Retry-After`.
- Assert on retry *count* and *backoff behavior* (via a mocked clock/sleep),
  not just the final outcome — a test that only checks the final response
  can hide a broken retry loop.
- Integration tests (real network) go behind an explicit marker, never in the
  default unit run.

## Pitfalls

- No timeout set — a single hung connection can exhaust a worker pool.
- Retrying non-idempotent POST/PATCH calls without an idempotency key —
  causes duplicate side effects (double charges, duplicate missions).
- Retrying on every exception, including 4xx client errors that will never
  succeed unchanged.
- No jitter — synchronized retries create a thundering herd on recovery.
- Unbounded retry loops with no max attempts or max elapsed time.
- New client instance per request instead of a shared, pooled client —
  defeats keep-alive, adds handshake latency.
- Circuit breaker missing — a dead dependency gets hammered by every caller
  until its own timeout, instead of failing fast.
- Tests that hit the real network, or that only assert the final response
  without checking retry/backoff behavior.
- Accumulating a paginated dataset fully in memory when a generator would do.

## Checklist

- [ ] Client instance reused (pooled, keep-alive), not recreated per call
- [ ] Timeout set explicitly on all four dimensions (connect/read/write/pool)
- [ ] Retries limited to transient errors (network, timeout, 429, 5xx)
- [ ] Backoff is exponential with full jitter, capped, bounded attempts
- [ ] Non-idempotent calls (POST/PATCH) use a stable idempotency key when retried
- [ ] Circuit breaker (or equivalent) protects against a fully-down dependency
- [ ] Client-side rate limiting matches the provider's documented quota
- [ ] Pagination streams lazily; cursor-based preferred over offset
- [ ] Large responses use streaming, not full-body buffering
- [ ] Unit tests mock the transport (`respx`); no real network in default runs
- [ ] Tests assert retry count / backoff behavior, not just the final response
