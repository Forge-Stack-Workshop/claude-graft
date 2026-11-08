---
description: Integrate a new fleet provider from a local spec (OpenAPI/Swagger/Postman/HAR), offline only
argument-hint: <type> <name> <spec-path>
---

<!-- markdownlint-disable MD013 MD060 -->

# Provider Integration

Integrate a new fleet provider (shuttle/dispatch/security) from a local spec file (OpenAPI/Swagger/Postman/HAR).
Usable as a Claude Code slash command: `/provider-integration <type> <name> <spec-path>`

______________________________________________________________________

## Instructions for Claude Code

Use when adding or debugging a shuttle, dispatch, or security provider. Provide: provider type, provider name (snake_case), path(s) to local spec file(s). Example: `/provider-integration shuttle acme ./specs/acme-openapi.json`

> **OFFLINE ONLY — NO DATA EXFILTRATION**
>
> - No outbound network access during this analysis phase, and no shell command execution during Steps 0–1 (inspection and spec parsing only).
> - Do not send, paste, upload, or transmit any source code, traceback, log, secret, token, email, path, or business data to any external service.
> - Do not fetch external documentation, changelogs, or resources.
> - Work exclusively from the local codebase and the instructions provided here.
> - If a step cannot be completed locally, stop and report the blocker.

**Related Instructions** (read first):

- `.claude/rules/python-guidelines.md`
- `.claude/rules/typing.md`
- `.claude/rules/django-models.md`
- `.claude/rules/secrets-config.md`
- `.claude/rules/tests.md`
- `.claude/rules/drf-performance.md`

______________________________________________________________________

## Required inputs

Before running this command, the developer must provide **all three**:

| Input             | Where to provide it                                      | Example                             |
| ----------------- | -------------------------------------------------------- | ----------------------------------- |
| **Provider type** | As the first argument                                    | `shuttle` / `dispatch` / `security` |
| **Provider name** | As the second argument (snake_case)                      | `acme`                              |
| **Spec file(s)**  | Path(s) to local file(s), attached or referenced in chat | `./specs/acme-openapi.json`         |

**Accepted spec formats** (all parsed locally, never uploaded):

- OpenAPI 3.x (`.yaml` / `.json`)
- Swagger 2.0 (`.yaml` / `.json`)
- Postman Collection v2.1 (`.json`)
- HAR archive (`.har`)
- Raw JSON schema describing endpoints
- Plain text / Markdown listing endpoints and payloads

If no spec file is provided, stop and ask for it. **Do not guess endpoints.**

______________________________________________________________________

## Step 0 — Inspect the existing architecture

Before writing any code:

1. Search the codebase for `ProviderTools.get_provider_type_list()` to confirm the current allowed types — do not assume they are always `shuttle`, `dispatch`, `security` (new types may have been added or renamed).
1. Read `apps/provider/common/api_abstract.py` — all API classes extend `ApiAbstract`.
1. Read `apps/provider/common/proxy_provider.py` — all proxy classes extend `ProxyProvider`.
1. Read `apps/provider/common/configuration.py` — config loaded from `config.yaml` via `Configuration`.
1. **Pick the most recently modified provider as reference** — search `apps/provider/shuttle/` and `apps/provider/dispatch/` for the newest `api.py` modification date, then read its `api.py`, `api_path.py`, `proxy_provider.py`, `constants.py`, `config.yaml`. Do not assume `easy_mile` is the canonical reference — it may have drifted from current conventions.

Only after this inspection should you propose or generate code.

______________________________________________________________________

## Step 0.5 — Parse the spec file(s)

Read every provided spec file locally. Extract and produce a structured summary:

### 0.5.1 — Endpoint inventory

For each endpoint in the spec, fill this table:

| Constant name (SCREAMING_SNAKE) | HTTP method | Relative path            | Purpose (1 sentence)    | Auth required? | Input schema | Output schema          |
| ------------------------------- | ----------- | ------------------------ | ----------------------- | -------------- | ------------ | ---------------------- |
| `VEHICLE_STATE`                 | GET         | `/api/v1/vehicles/state` | Fetch vehicle telemetry | Bearer         | —            | `VehicleStateResponse` |

Rules:

- Constant names go to `api_path.py` verbatim.
- Relative paths only — strip the base URL.
- If the spec defines a `servers[0].url`, that base URL must be fetched at runtime via `SecretConfigManagementTool`, **never hardcoded**.

### 0.5.2 — Authentication scheme

Extract from `securitySchemes` (OpenAPI) or collection auth (Postman):

| Field               | Value from spec                          |
| ------------------- | ---------------------------------------- |
| Type                | bearer / apiKey / basic / OAuth2 / none  |
| Header / param name | e.g. `Authorization`, `X-API-Key`        |
| Token lifecycle     | static / per-session / short-lived (TTL) |
| Token endpoint      | path if applicable                       |

If the token is short-lived → store it in `ProviderToken` model and implement a refresh method in `api.py`.

### 0.5.3 — Secrets inventory

List every credential implied by the spec:

| Secret name (SecretConfigManagementTool key) | Type     | Encrypted? |
| -------------------------------------------- | -------- | ---------- |
| `acme-base-url`                              | Base URL | false      |
| `acme-api-key`                               | API key  | true       |

These keys will be used in `api.py` — never hardcode values.

### 0.5.4 — Payload schemas

For each endpoint that has a request body or a structured response, describe:

- Field names and types (from `schema` / `$ref` in OpenAPI, or example payloads in Postman/HAR)
- Required vs optional fields
- Fields that are sensitive (tokens, emails, IDs) → must be redacted in logs

This drives the `_process_response()` method and any `TypedDict` / dataclass needed.

### 0.5.5 — WebSocket / webhook detection

If the spec contains WebSocket upgrade paths or webhook callback definitions:

- Flag them explicitly.
- Add a `websocket_client.py` (follow `apps/provider/shuttle/easy_mile/websocket_client.py` as reference).
- Do **not** implement a polling fallback silently.

______________________________________________________________________

## Step 1 — Analyse the project and summarise

Combine inspection of the existing codebase (Step 0) and the parsed spec (Step 0.5), then fill:

| Question                     | Answer (derived from spec + codebase)                       |
| ---------------------------- | ----------------------------------------------------------- |
| Provider type?               | shuttle / dispatch / security                               |
| Provider name?               | snake_case (from argument)                                  |
| Connection model used?       | `ShuttleProvider` / `DispatchProvider` / `SecurityProvider` |
| Existing reference provider? | closest analogue already implemented                        |
| Endpoints to implement?      | list from Step 0.5.1                                        |
| Auth scheme?                 | from Step 0.5.2                                             |
| Secrets needed?              | list from Step 0.5.3                                        |
| WebSocket/webhook?           | from Step 0.5.5                                             |
| Fields to redact in logs?    | from Step 0.5.4                                             |

______________________________________________________________________

## Step 2 — Propose a minimal integration plan

Present a checklist before writing any file:

```text
[ ] 1. Scaffold directory: apps/provider/<type>/<name>/
[ ] 2. constants.py       — provider identifier constant
[ ] 3. api_path.py        — URL path constants (no base URL here)
[ ] 4. config.yaml        — provider configuration (no secrets in plain text)
[ ] 5. api.py             — API class(es) extending ApiAbstract
[ ] 6. proxy_provider.py  — ProxyProvider subclass
[ ] 7. apps.py            — AppConfig
[ ] 8. migrations/        — if a new DB model is needed
[ ] 9. tests/             — unit tests for api.py and proxy_provider.py
[ ] 10. Register in INSTALLED_APPS and urls.py if needed
```

Get explicit confirmation before starting.

______________________________________________________________________

## Step 3 — Scaffold the directory structure

> Generate the base skeleton with `/provider-scaffold <name> <type>` first — it
> owns the canonical DDD layout. This step only fills the scaffolded files with
> spec-derived content; do not hand-recreate the directory tree.

Create files in this order, one by one, showing each diff.

### 3.1 `constants.py`

```python
SHUTTLE_PROVIDER_<NAME> = "<name>"
```

No logic — only the provider identifier string used throughout the module.

### 3.2 `api_path.py`

Generate **one constant per endpoint** from the Step 0.5.1 table. Relative paths only.

```python
# Generated from <spec-filename> — relative paths only, base URL via SecretConfigManagementTool
VEHICLE_STATE  = "api/v1/vehicles/state"   # GET  — from spec operationId: getVehicleState
MISSION_POST   = "api/v1/missions"          # POST — from spec operationId: createMission
```

Every constant must have an inline comment stating the HTTP method and the spec `operationId` (or equivalent) it was derived from.

### 3.3 `config.yaml`

Generate from the spec's `servers` block and territory-related config fields identified in Step 0.5.4.

```yaml
# Generated from <spec-filename>
# Base URL is NOT stored here — use SecretConfigManagementTool key: <name>-base-url
# Auth credentials are NOT stored here — use SecretConfigManagementTool
territories:
  - name: <territory_identifier>
    enabled: true
```

### 3.4 `api.py`

Generate **one method per endpoint** from the Step 0.5.1 table. Rules:

- Inherit from `ApiAbstract` (or directly use `httpx.AsyncClient` wrapped in `ConnectionDisableable`).
- **Never** hardcode credentials — always call `SecretConfigManagementTool(name="<secret-name>", encrypted=<bool>).get()`.
- Base URL construction belongs in a dedicated `get_api_base_url()` function.
- Timeout: use `ASYNC_CLIENT_TIMEOUT_EXTENDED` from `apps.provider.common.constants`.
- All external HTTP calls must use `async with ConnectionDisableable(connections=connections)`.
- Log every outbound call with `logger.info(...)` including `url` in extras.
- On HTTP error: catch `httpx.HTTPError`, log, and re-raise or return `None` explicitly.
- Token / session state: store on the provider's `ProviderToken` model if persistent (Step 0.5.2).
- Sensitive response fields listed in Step 0.5.4 must **never** appear in log extras.

Method naming: `_perform_<operation>()` derived from spec `operationId` or path+method.

```python
# Minimal skeleton — one method per spec endpoint
async def _perform_query(self) -> None:
    async with httpx.AsyncClient(timeout=ASYNC_CLIENT_TIMEOUT_EXTENDED) as client:
        self.response = await client.get(self.url, headers=self._build_headers())
```

### 3.5 `proxy_provider.py`

```python
@dataclass
class <Name>ProviderProxy(ProxyProvider):
    provider_name: str
    provider_type: str = "<type>"

    def __post_init__(self):
        super().__post_init__()
```

______________________________________________________________________

## Step 4 — Security checklist (mandatory before any merge)

```text
[ ] No credentials in source code (grep: password|token|key|secret in new files)
[ ] All secrets fetched via SecretConfigManagementTool
[ ] All HTTP calls wrapped in ConnectionDisableable
[ ] ConnectionDisableable disables outbound calls when `access` is False
[ ] config.yaml contains no plaintext secrets
[ ] Sentry tags set via SentryTools.set_tag() in __post_init__
[ ] Logs never contain raw credentials, tokens, or PII
[ ] Network calls are not executed at import time or in __init__
[ ] Timeout is always set on httpx clients
[ ] All credentials validated before use (not assumed non-None)
[ ] No source code, traceback, log, or business data sent to any external service
[ ] No telemetry, analytics, or crash-reporting enabled by default
[ ] All sensitive fields redacted before any structured log output
```

______________________________________________________________________

## Step 5 — Debugging (traceback & Sentry triage)

When debugging a provider failure or triaging a Sentry issue, follow the runbook
in `.claude/rules/provider-debugging.md` (traceback frame isolation, connection /
secret / response checks, Sentry tag mapping). Do not duplicate that procedure here.

______________________________________________________________________

## Step 6 — Tests

All new providers must include tests. Reference: `.claude/rules/tests.md`.

Minimum required:

```python
# tests/test_api.py
class Test<Name>Api:
    def test_<name>_api_returns_none_when_connection_disabled(self):
        ...

    def test_<name>_api_raises_on_http_error(self):
        ...

# tests/test_proxy_provider.py
class Test<Name>ProxyProvider:
    def test_proxy_provider_loads_configuration(self):
        ...

    def test_proxy_provider_gracefully_handles_missing_secret(self):
        ...
```

Run with:

```bash
# Variable name is target_test, not ARGS
make tests target_test="apps/provider/<type>/<name>/tests/"
```

______________________________________________________________________

## Step 7 — Validation checklist

After implementation, verify:

```text
[ ] make ruff-check passes with 0 errors
[ ] make tests target_test="apps/provider/<type>/<name>/tests/" passes
[ ] No new secrets in source files (git diff --cached scanned)
[ ] Provider appears in ProviderTools.get_<type>_provider_list()
[ ] config.yaml is valid YAML and passes Configuration.validate_configuration()
[ ] Sentry tags are set in __post_init__
[ ] Logger calls use extras dict, not f-strings with sensitive data
[ ] All external calls are async and timeout-protected
```

______________________________________________________________________

## Network isolation policy

**OFFLINE / LOCAL-ONLY is the non-negotiable default.** No provider integration must depend on an external network connection to function.

| Rule                                                  | Implementation                                                                                                                                               |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| No outbound call without explicit connection          | `ConnectionDisableable` context manager                                                                                                                      |
| No credentials in code or config files                | `SecretConfigManagementTool`                                                                                                                                 |
| No PII or secrets in logs                             | Log only IDs, status codes, provider names                                                                                                                   |
| Graceful degradation when not configured              | Return `None` and log `WARNING`, never crash                                                                                                                 |
| No call at module import time                         | All HTTP calls inside methods, never at class level                                                                                                          |
| No telemetry enabled by default                       | Opt-in only, disabled unless explicitly set in env                                                                                                           |
| No external documentation fetched during this command | Use only local files and this command                                                                                                                        |
| **No source code sent to external services**          | Code, tracebacks, logs, secrets and business data must never be transmitted outside the local machine — not to AI APIs, logging services, or any third party |
| Sensitive fields redacted before any output           | Tokens, emails, paths, IDs → replace with `[REDACTED]` before any structured log or report                                                                   |

If a provider requires Internet access that is not yet whitelisted:

- Document it in `config.yaml` as a comment
- Gate it behind an environment variable (`<PROVIDER>_NETWORK_ENABLED=false` by default)
- Ensure the feature degrades silently to `None` / no-op when the variable is absent or `false`
- Never enable it as part of the default scaffold

______________________________________________________________________

## Reference implementation checklist

Use the **most recently modified provider** as the canonical reference (check `git log --oneline -1 apps/provider/shuttle/*/api.py` to find it). The `apps/provider/shuttle/easy_mile/` structure below is indicative — always verify against actual code:

| File                   | Role                                                                       |
| ---------------------- | -------------------------------------------------------------------------- |
| `api.py`               | Async HTTP calls, token management                                         |
| `api_path.py`          | URL path constants                                                         |
| `config.yaml`          | Provider config (no secrets)                                               |
| `constants.py`         | Provider identifier string                                                 |
| `proxy_provider.py`    | ProxyProvider subclass, config loading                                     |
| `message_formatter.py` | Raw response → domain objects (present only if response mapping is needed) |
| `tests/`               | Unit tests for API and proxy                                               |

If the reference provider has additional files (e.g. `geography.py`, `utils.py`) that implement cross-cutting concerns, check whether the new provider needs them too before skipping them.
