---
name: security-review
description: Use when reviewing a PR before merge or touching auth, user input, SQL/shell, dependencies, secrets/config, a new endpoint, or a Dockerfile/CI workflow — runs the OWASP Top 10 + secrets + container/CI checklist and reports SECURE or CHANGES NEEDED with severity-ranked findings. Triggers on "security", "OWASP", "vulnerability", "hardening", "audit".
---

## When to invoke

Auto-invoke when: reviewing a PR before merge, touching auth/permissions, handling
user input, writing SQL or shell commands, adding a dependency, wiring secrets/config,
exposing a new endpoint, or shipping a Dockerfile/CI workflow. Also on any request that
mentions "security", "OWASP", "vulnerability", "hardening", or "audit".

## How to run

Work top-down through each checklist below. For every item, either cite the file:line
that satisfies it or open a finding. Report as a binary verdict — `SECURE` or
`CHANGES NEEDED` — followed by findings ranked by severity (Critical > High > Medium >
Low). No praise, no summary. A finding is:

```text
[SEVERITY] path/to/file.py:42 — what is wrong → concrete exploit → fix
```

## OWASP Top 10 checklist

### A01 Broken access control

- Every endpoint declares an explicit authorization dependency — no "authenticated ==
  authorized". Object-level checks (does this user own this row?) live in the service,
  not the router.
- No IDOR: never trust an ID from the request without an ownership/tenant filter.

### A02 Cryptographic failures

- Passwords hashed with bcrypt/argon2 — never MD5/SHA1, never plaintext.
- JWT: `HS256` minimum with a rotated secret, short access expiry, refresh rotation.
- TLS terminates at the infra layer; no secrets or tokens logged.

### A03 Injection

- SQL only via the ORM or `text()` with bound parameters — never f-strings or `%`.
- No `shell=True` with interpolated input; use `subprocess` arg lists.
- Templates/HTML autoescaped; user input never reaches `eval`/`exec`.

### A04 Insecure design

- Rate limiting on auth and expensive endpoints. Fail closed, not open.
- Server-side validation is authoritative — client checks are UX only.

### A05 Security misconfiguration

- Debug off in production; generic error pages (no stack traces to clients).
- CORS allow-list is explicit — never `*` with credentials.
- Default/example credentials removed.

### A06 Vulnerable components

- `pip-audit` / `npm audit` clean, or every exception justified with a ticket.
- Base images pinned by digest; dependencies pinned.

### A07 Auth failures

- Generic login errors (no "user exists" oracle). Lockout/backoff on brute force.
- Session/token invalidation on logout and password change.

### A08 Integrity failures

- CI actions pinned to a commit SHA, not a moving tag.
- No unsigned/unverified artifact pulled at runtime.

### A09 Logging failures

- Security events (login, permission denial, admin action) are logged with a
  correlation ID — but never log secrets, tokens, or full PII.

### A10 SSRF

- Outbound URLs from user input are validated against an allow-list; no fetching
  arbitrary internal hosts.

## Secrets & config

- No hardcoded secret, token, API key, or connection string — `pydantic-settings` +
  env vars only. `detect-secrets` and `gitleaks` pass.
- `.env` / credential files are gitignored; only `.env.example` is committed.
- No secret echoed in CI logs (`::add-mask::` where unavoidable).

## Container & CI

- One process per container; no secrets baked into image layers (`ARG` at build,
  `env_file`/secrets at runtime).
- Workflows use least-privilege `permissions:` and `persist-credentials: false`.

## Definition of done

- [ ] Every OWASP category reviewed with a file:line or a finding.
- [ ] `detect-secrets`, `gitleaks`, dependency audit all green.
- [ ] No Critical or High finding left unresolved before merge.

## Related skills

- `api-design` — endpoint shapes and status codes.
- `error-handling` — safe error surfaces and Sentry capture.
- `best-practices-review` — non-security quality gates.
