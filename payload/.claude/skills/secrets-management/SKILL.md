---
name: secrets-management
description: Secrets management patterns — zero secrets in code/VCS, layered loading (file > env var > default > error), dev/prod storage, env var naming conventions, generation, rotation schedules, detection tooling, and compromise response.
origin: authored
---

# Secrets Management

Patterns for keeping credentials, API keys, and tokens out of source control while
staying operable across dev, staging, and production.

## When to Activate

- Adding a new API key, password, token, or certificate to a project
- Reviewing a diff that touches config, settings, or `docker-compose*.yml`
- Setting up secret storage for a new environment
- Writing a secret loader or centralizing scattered `os.environ` reads
- Responding to a suspected or confirmed secret leak
- Auditing pre-commit/CI for secret-scanning coverage

## Core Principles

- Zero secrets in source code or version control — no exceptions, no "temporary" hardcoding.
- Configuration is environment-based; secrets are read at runtime, never baked into images or committed files.
- Least privilege: a service or CI job only gets the secrets it actually needs.
- Defense in depth: pre-commit scanning + CI scanning + code review, not any single layer alone.
- Rotate on a schedule, not only after an incident.

If a secret appears as plaintext in code, a log, or a commit — even in a private repo,
even in a squashed/rebased branch — treat it as compromised and rotate immediately.
`git history` is not a safe place to "clean up later."

## Storage

| Environment | Mechanism                              | Format                     |
| ----------- | --------------------------------------- | -------------------------- |
| Dev         | Files in a git-ignored secrets directory (e.g. `docker/secrets/`) | Plain text, one secret per file |
| CI          | Platform secret store (masked in logs) | Injected as env vars       |
| Prod        | Kubernetes Secrets (encrypted at rest) | Sealed Secrets / external secrets operator for GitOps |

- One secret per file — never a JSON/YAML blob bundling multiple secrets.
- File name matches the env var name, lowercase (`padam_db_password` for `PADAM_DB_PASSWORD`).
- File permissions `600` — owner read/write only, no group/world access.
- The secrets directory is `.gitignore`d at the repo root, not per-subfolder.
- Never commit a "real-looking" placeholder secret, even in a `.env.example` — use an
  obviously fake value (`changeme`, `xxx-replace-me`) or omit the value entirely.

## Loading: File > Env Var > Default > Error

Centralize secret resolution in one loader function. Precedence, in order:

1. Secret file, if it exists (dev/prod file-mounted secrets).
2. Environment variable (CI, container env, Kubernetes Secret mounted as env).
3. Explicit default, only for genuinely non-sensitive values.
4. Raise — never silently fall back to `None` or an empty string for a required secret.

```python
from pathlib import Path
import os


def get_secret(name: str, default: str | None = None) -> str:
    """Resolve a secret: file first, then env var, then default, else raise.

    Args:
        name: Logical secret name (e.g. "PADAM_DB_PASSWORD").
        default: Value to use if neither file nor env var is set. Only
            appropriate for non-sensitive defaults.

    Returns:
        The resolved secret value.

    Raises:
        ValueError: If no source provides a value and no default is given.
    """
    secret_file = Path(f"docker/secrets/{name.lower()}")
    if secret_file.exists():
        return secret_file.read_text().strip()
    env_value = os.environ.get(name.upper())
    if env_value:
        return env_value
    if default is not None:
        return default
    raise ValueError(f"Secret {name} not found")
```

- Fail fast at startup — validate all required secrets before the app accepts traffic,
  not lazily on first use deep in a request handler.
- Never log the resolved value, not even at debug level. Log the secret *name* and
  which source resolved it (`"loaded PADAM_DB_PASSWORD from file"`), never the value.
- Strip whitespace/newlines from file-based secrets — a trailing `\n` from `echo >`
  silently breaks auth and is hard to spot in logs.

## Naming Convention

Prefix env vars with the organization/service namespace, then the config name, all
uppercase, underscore-separated:

```text
<ORG>_<SERVICE>_<CONFIG_NAME>
```

Examples: `PADAM_DB_PASSWORD`, `PADAM_REDIS_URL`, `PADAM_OIDC_CLIENT_SECRET`.

- Always uppercase, underscores only — no dashes, no mixed case.
- Document every required env var (type, default if any, example) in the project README
  or `.env.example`.
- `.env.example` variable blocks sorted alphabetically within each logical section —
  makes diffs reviewable and missing vars easy to spot.
- Never reuse the same env var name for different secrets across services — namespace
  collisions cause silent misconfiguration when services share a deployment environment.

## Generation

| Secret type | Minimum length | Command |
| ----------- | --------------- | ------- |
| Password    | 32 chars        | `openssl rand -base64 32` |
| API key     | 64 chars (hex)  | `openssl rand -hex 64` |
| Framework signing key | Framework-specific | Use the framework's own generator (e.g. Django's `get_random_secret_key()`) — do not hand-roll |

- Always use a cryptographically secure random generator (`openssl rand`, `secrets`
  module) — never `random`, timestamps, or predictable seeds.
- Every secret is unique per environment. The same DB password in staging and
  production means one leak compromises both.
- Regenerate, don't reuse, when rotating — a "rotated" secret that's just the old one
  Base64-re-encoded is not rotated.

## Rotation Schedule

| Secret type        | Max age  |
| ------------------- | -------- |
| API keys            | 30 days  |
| Database passwords  | 90 days  |
| JWT / signing secrets | 180 days |

- Automate rotation where the provider supports it (managed DB password rotation,
  API key rotation endpoints); manual rotation is a fallback, not the default plan.
- Rotating a secret used by multiple services requires a coordinated rollout — update
  the secret store first, then redeploy consumers, then revoke the old value. Rotating
  before all consumers are updated causes an outage; revoking too early causes the same.

## Detection & Scanning

- Pre-commit: a secrets scanner (e.g. `detect-secrets`) with a versioned baseline file,
  run on every commit, blocking on new findings.
- CI/lint: language-level secret rules as part of the standard lint pass (e.g. Python
  `bandit`/Ruff `S`-series: `S105`/`S106` hardcoded passwords, `S107` hardcoded
  function default). Zero tolerance — a lint pass with secret findings is a failing
  build, not a warning.
- Allowlist known false positives (test fixtures using obviously fake values, example
  hashes) in a single, reviewed allowlist file — never by disabling the rule or adding
  an inline suppression comment next to the finding.
- Never add a suppression comment that exists only to silence the scanner without
  fixing the underlying issue — that comment itself is a signal something is wrong and
  should be rejected in review.
- Container images: scan for embedded secrets and known CVEs as part of the build
  pipeline; minimal base image, non-root user, read-only filesystem where possible.

## Common Pitfalls (reject in review)

- Secret value hardcoded as a string literal, even "temporarily" or in a comment.
- Secret interpolated into a log statement, exception message, or Sentry breadcrumb.
- Secret committed inside a fixture, seed script, or `docker-compose.override.yml`.
- `.env` file (real values) missing from `.gitignore`, or committed once and only
  removed from HEAD (still in history).
- Same secret value reused across dev/staging/prod "to keep things simple."
- Secret file permissions wider than `600`.
- A scanner finding suppressed with an inline comment instead of fixed or allowlisted.
- Required secret defaulting to `None`/empty string instead of raising at startup.

## Compromise Response

On suspected or confirmed compromise, in order:

1. **Isolate** — identify every system/service using the compromised secret.
2. **Assess** — scope of exposure (public repo? internal log? which environments?).
3. **Rotate** — generate and deploy a new value for every affected secret, not just
   the one that leaked (adjacent secrets sharing a store or provisioning path may also
   be exposed).
4. **Revoke** — explicitly invalidate the old credential at the provider, don't rely on
   rotation alone if the provider supports separate revocation.
5. **Patch** — fix the root cause (remove from code/history, correct the loader,
   tighten file permissions, fix the scanner gap).
6. **Monitor** — increase log/alert scrutiny on the affected systems for anomalous
   access following rotation.

Rotation without revocation leaves the old secret valid until it expires on its own —
treat both steps as mandatory, not either/or.

## Pre-Merge Checklist

- [ ] No secret literal anywhere in the diff (code, tests, fixtures, config, docs)
- [ ] New required secrets documented in `.env.example` / README, alphabetically placed
- [ ] Secret loader used (file > env var > default > error) — no ad-hoc `os.environ` read
- [ ] No secret value appears in a log statement or exception message
- [ ] Dev secret files use `600` permissions and live under a `.gitignore`d directory
- [ ] Secret scanner (pre-commit + CI) passes with no new suppressions/allowlist entries
- [ ] Prod secrets stored as Kubernetes Secrets / Sealed Secrets, not env vars in a manifest
- [ ] Rotation age tracked against the schedule for any long-lived secret touched
