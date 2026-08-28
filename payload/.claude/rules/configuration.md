# Configuration

- **Validate the whole configuration at startup**, before serving anything. A
  missing or malformed variable fails the boot with a message naming it — never
  at the first request that happens to need it, in production, at 3am.
- Configuration is read **once**, into a typed object. No `getenv` scattered
  through the code: a value read in three places has three defaults and two
  bugs.
- **No default for a secret, and no default that is only correct in
  development.** A silent fallback to `localhost` or `debug=true` is how a
  wrong value reaches production unnoticed.
- Names are namespaced and explicit: `DATABASE_URL`, `OTEL_EXPORTER_ENDPOINT`.
  Every variable appears in `.env.example` with a safe placeholder and a
  one-line comment — that file is the contract (`environment.md`).
- Behaviour differences between environments are **values**, not branches.
  `if ENV == "prod"` in business code is configuration that leaked.
- A feature flag is temporary and carries its removal condition. A flag with no
  owner and no date is permanent complexity.
