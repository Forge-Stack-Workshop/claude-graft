---
name: observability-logging
description: Observability fundamentals for web applications — structured JSON logging, log/trace correlation, OpenTelemetry traces and spans, RED/USE metrics, error tracking (Sentry-style), health/readiness checks, SLOs and alerting, and pitfalls around PII, cardinality, and noisy logs.
origin: authored
---

# Observability & Logging

Practical patterns for making a running service explainable: what happened, why,
and how fast — through logs, metrics, and traces working together.

## Prerequisites (preflight)

Requires **opentelemetry-sdk** and **sentry-sdk**. Verify; warn if missing:

```bash
python -c "import opentelemetry; import sentry_sdk" 2>/dev/null || echo "WARN: opentelemetry-sdk or sentry-sdk missing — pip install opentelemetry-sdk sentry-sdk"
```

## When to Activate

- Adding or reviewing logging in a service or library
- Instrumenting a request/job path with tracing
- Defining metrics for a new endpoint or background worker
- Wiring up error tracking (Sentry or equivalent)
- Designing health/readiness checks for orchestration
- Setting SLOs and alert thresholds before a release
- Reviewing a diff for PII/secret leakage in logs or events

## The Three Pillars

| Pillar  | Answers                          | Typical backend            | Cardinality |
| ------- | --------------------------------- | --------------------------- | ----------- |
| Logs    | What happened, in detail?         | ELK, Loki, CloudWatch        | High, per-event |
| Metrics | How much / how often / how fast?  | Prometheus, Datadog          | Low, aggregated |
| Traces  | Where did time go across services?| Jaeger, Tempo, OpenTelemetry | Medium, per-request |

None of the three replaces the others. Logs give detail but don't aggregate well;
metrics aggregate but drop detail; traces show causality across service boundaries
but are sampled. Correlate all three via a shared identifier (see below).

## Structured Logging (JSON)

Never emit free-text logs in a service meant to run in production — they cannot
be filtered, aggregated, or joined reliably.

```python
import logging
import pythonjsonlogger.jsonlogger as jsonlogger

handler = logging.StreamHandler()
handler.setFormatter(jsonlogger.JsonFormatter(
    "%(asctime)s %(levelname)s %(name)s %(message)s"
))
logger = logging.getLogger("orders")
logger.addHandler(handler)
logger.setLevel(logging.INFO)

logger.info(
    "order created",
    extra={"order_id": order.id, "amount_cents": order.amount, "user_id": user.id},
)
```

```json
{"asctime": "2026-09-10T09:12:03Z", "levelname": "INFO", "name": "orders",
 "message": "order created", "order_id": 4821, "amount_cents": 3200, "user_id": 991}
```

Rules:

- One event per log line (no multi-line stack-trace-in-message blobs unless the
  backend parses them explicitly).
- Fields, not sentence fragments: `extra={"order_id": ...}`, never string-formatted
  values baked into the message.
- Lazy/parameterized formatting only — **never f-strings in log calls**
  (`logger.info(f"order {order_id}")` defeats structured parsing and runs the
  format even when the log level is disabled). Use `logger.info("order %s", order_id)`
  or the `extra=` dict.
- Log the event, not the narrative: `"payment failed"` + fields, not
  `"Uh oh, payment failed for this poor user"`.

## Correlation: trace_id / request_id

Every log line, metric exemplar, and span must be joinable through a shared
identifier propagated across the whole request lifecycle, including across
service boundaries (HTTP headers, message queue metadata).

```python
import contextvars

request_id_var = contextvars.ContextVar("request_id", default=None)

class RequestIdMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request_id = request.headers.get("X-Request-Id", str(uuid.uuid4()))
        request_id_var.set(request_id)
        response = self.get_response(request)
        response["X-Request-Id"] = request_id
        return response

class RequestIdLogFilter(logging.Filter):
    def filter(self, record):
        record.request_id = request_id_var.get()
        return True
```

- Generate the ID at the edge (load balancer or first service) if the caller
  doesn't supply one; always echo it back in the response header.
- Propagate downstream: forward the same ID to any service-to-service call.
- Under OpenTelemetry, the `trace_id`/`span_id` pair already gives you this —
  inject them into log records via the OTel logging integration instead of a
  second, parallel ID scheme when both are available.

## Levels & Sampling

| Level    | Use for                                             | Production volume |
| -------- | ---------------------------------------------------- | ------------------ |
| DEBUG    | Local development detail                              | Off in prod |
| INFO     | Normal business events (order created, job started)   | Sampled if hot path |
| WARNING  | Recoverable anomaly, degraded behavior                | Always on |
| ERROR    | Failed operation, needs attention                     | Always on |
| CRITICAL | Service-threatening condition                         | Always on, paged |

- Sample high-volume INFO logs (e.g. one health-check ping every few seconds)
  rather than disabling the whole logger — otherwise a real incident loses signal.
- Never sample ERROR/CRITICAL — losing the one log line that explains an incident
  defeats the purpose of the log.
- Dynamic log level per request (e.g. force DEBUG for a specific `request_id`
  via a feature flag) beats blanket DEBUG in production.

## OpenTelemetry: Traces & Spans

A trace is the end-to-end journey of one request; a span is one unit of work
inside it (a DB query, an HTTP call, a function). Spans nest to form a tree.

```python
from opentelemetry import trace
from opentelemetry.trace import Status, StatusCode

tracer = trace.get_tracer(__name__)

def dispatch_mission(mission_id: int) -> None:
    with tracer.start_as_current_span("dispatch_mission") as span:
        span.set_attribute("mission.id", mission_id)
        try:
            provider.send(mission_id)
        except ProviderError as dispatch_error:
            span.set_status(Status(StatusCode.ERROR, str(dispatch_error)))
            span.record_exception(dispatch_error)
            raise
```

- Name spans after the operation, not the function (`dispatch_mission`, not
  `def_1234`).
- Attach low-cardinality attributes (`mission.id` is fine; a raw user-typed
  free-text field is not — see cardinality pitfalls below).
- Auto-instrument frameworks/libraries (`opentelemetry-instrumentation-django`,
  `-requests`, `-psycopg2`) before hand-rolling spans — hand-write spans only
  for business-meaningful boundaries.
- Sample at the head (fixed percentage) or tail (keep all traces with an error
  or high latency) depending on volume; tail sampling needs a collector that
  buffers spans until the trace completes.

## Metrics: RED and USE

Two complementary models depending on what you're instrumenting.

**RED — request-driven services (APIs, queues consumers):**

- **R**ate — requests per second
- **E**rrors — failed requests per second
- **D**uration — latency distribution (p50/p95/p99, not just average)

**USE — resources (CPU, DB connections, queues, disk):**

- **U**tilization — % time the resource is busy
- **S**aturation — how much work is queued waiting for the resource
- **E**rrors — resource-level error count

```python
from prometheus_client import Counter, Histogram

http_requests_total = Counter(
    "http_requests_total", "Total HTTP requests", ["method", "path", "status"]
)
http_request_duration_seconds = Histogram(
    "http_request_duration_seconds", "Request latency", ["method", "path"]
)

http_requests_total.labels(method="POST", path="/missions", status="201").inc()
```

- Use a `Histogram`/summary for durations, never a gauge sampled once — you need
  the distribution to see tail latency, not just the last value.
- Average latency hides outliers; always alert on p95/p99, not the mean.

## Error Tracking (Sentry-style)

Error trackers complement logs: they deduplicate, group by stack signature,
and preserve full context at the moment of failure.

```python
import sentry_sdk

sentry_sdk.set_tag("provider_name", provider.name)
sentry_sdk.set_tag("provider_type", provider.type)

sentry_sdk.add_breadcrumb(
    category="dispatch", message="mission sent to provider", level="info",
    data={"mission_id": mission.id},
)

try:
    provider.send(mission)
except ProviderError:
    sentry_sdk.capture_exception()  # captures exc_info automatically in an except block
    raise
```

- **Tags**: low-cardinality, filterable dimensions (`provider_name`, `environment`,
  `release`) — used to slice the issue list, not to store free-form detail.
- **Breadcrumbs**: a timeline of small events leading up to the error — cheap,
  add them at each meaningful step, not just at the failure point.
- Always let `exc_info` be captured (inside an `except` block, or pass
  `exc_info=True` to a logging call) — a message-only capture loses the stack trace.
- Never call `capture_exception()` for expected control-flow (e.g. validation
  errors returned to the caller); reserve it for genuinely unexpected failures.

## Health & Readiness

- **Liveness**: "is the process alive?" — cheap, no dependency checks; a false
  positive here restarts the container unnecessarily.
- **Readiness**: "can this instance serve traffic right now?" — checks DB, cache,
  and required upstream dependencies; failing removes the instance from the load
  balancer without restarting it.

```python
def readiness(request):
    checks = {"database": _check_db(), "cache": _check_cache()}
    healthy = all(check["status"] == "ok" for check in checks.values())
    return JsonResponse(
        {"status": "ok" if healthy else "degraded", "checks": checks},
        status=200 if healthy else 503,
    )
```

Keep liveness and readiness as separate endpoints — conflating them causes
restart storms when a dependency (not the process itself) is unhealthy.

## SLOs & Alerting

- Define an SLO as a target over a window: "99.5% of requests succeed with
  p95 latency < 300ms, over a rolling 30 days."
- Alert on **symptoms** (error rate, latency budget burn) visible to users,
  not on raw internal causes (CPU %) — causes are for debugging, not paging.
- Use error-budget burn rate for paging: alert fast on a fast burn (e.g. budget
  exhausted in < 1 hour), alert slow/ticket on a slow burn (exhausted in days).
- Every page-worthy alert needs a runbook link — an alert without a documented
  next action trains people to ignore it.

## Never Log PII or Secrets

- No raw email, phone number, national ID, full name, address, or free-text
  user input in logs, span attributes, or error-tracker context.
- No API keys, tokens, passwords, or connection strings — mask or omit entirely,
  even in DEBUG level and even in a "temporary" log line.
- Prefer stable internal identifiers (`user_id`, `order_id`) over the underlying
  personal data; join to PII only in a system with proper access controls, not
  in the log pipeline.
- Redact at the logging boundary (formatter/processor), not ad hoc at each call
  site — a central redaction layer is the only version that can't be forgotten.

## Common Pitfalls

- **Noisy logs**: logging every successful health-check ping or every ORM query
  at INFO drowns the signal; drop to DEBUG or sample.
- **Unbounded metric cardinality**: labeling a metric with `user_id`, raw path
  with IDs (`/orders/8421`), or a free-text value creates a new time series per
  value — this can crash or bankrupt a metrics backend. Bucket paths
  (`/orders/{id}`) and keep label sets small and closed.
- **f-strings in log calls**: defeats lazy formatting and structured parsing —
  use `%s`-style or `extra=`.
- **Logging then re-raising without context**: catching an exception, logging
  it, and re-raising loses the "why" for the caller — either handle it fully or
  let it propagate with `raise ... from ...` and log once at the boundary.
- **Average-only latency dashboards**: hides p99 regressions affecting a slice
  of users.
- **One global log level for the whole app**: makes it impossible to get more
  detail on one noisy subsystem without flooding every other one.

## Checklist

- [ ] Logs are structured JSON, one event per line, fields not string blobs
- [ ] No f-strings in logging calls — parameterized or `extra=` only
- [ ] `trace_id`/`request_id` propagated across services and joined to logs
- [ ] Log levels match severity; high-volume INFO sampled, ERROR/CRITICAL never sampled
- [ ] Traces cover cross-service request paths with meaningful span names
- [ ] RED metrics on every request-driven endpoint; USE metrics on shared resources
- [ ] Latency alerts use p95/p99, not average
- [ ] Error tracker captures full `exc_info`, tags are low-cardinality, breadcrumbs trace the path to failure
- [ ] Liveness and readiness are separate endpoints with distinct failure semantics
- [ ] SLOs defined with error-budget-based alerting and a runbook per alert
- [ ] No PII or secrets in logs, span attributes, or error-tracker payloads
- [ ] No unbounded-cardinality labels on metrics (raw IDs, free text, timestamps)
