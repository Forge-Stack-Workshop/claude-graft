---
name: observability-diagnostics
description: Use when adding or reviewing logging, metrics, traces, error handling/correlation, health/readiness, and diagnosability — or when investigating an anomaly/incident. Applies the observability & production-readiness standards (structured logs, no secret/PII in logs, error→issue correlation, vendor-neutral telemetry) so failures are contained and observable.
---

# observability-diagnostics

> Inherits `governance-core`. Consumes the canon by reference. Telemetry stack
> names come from `config.yaml` / the canon; the skill stays vendor-neutral.

## Role
Ensure a project is diagnosable and production-ready: structured logs, metrics,
traces, health/readiness, and an error model where expected failures are
documented, surfaced, correlated and recoverable — and support investigation
when something is wrong. Principle: *failures are contained, and observable.*

## Triggers
- Adding/reviewing logging, metrics, tracing, health/readiness probes, error
  handling; wiring error→issue correlation; investigating an anomaly, a failing
  deploy, or an incident; assessing production-readiness.

## Rules it applies (resolve from the canon by ID)
- Observability & production readiness: structured JSON logs; **zero secret/PII
  in logs**; error→issue correlation; monitoring/uptime; vendor-neutral
  telemetry (no business code coupled to one provider — use the adaptation
  layer).
- Error DoD: a feature is not done until its expected errors are documented,
  tested, surfaced correctly, correlated in observability, and carry a
  recovery/fallback/clean-failure behaviour proportionate to impact.
- Privacy in telemetry (resolve the privacy domain).

## Inputs it must gather before acting
1. Profile + deployment target (what readiness level is required).
2. Existing telemetry stack and correlation wiring.
3. The error surface of the change under review.

## Execution steps
1. **Logs**: structured JSON, leveled, correlation IDs; assert no secret/PII is
   logged.
2. **Metrics & traces**: the signals that matter for this profile;
   vendor-neutral collection so the provider is interchangeable.
3. **Health/readiness**: endpoints/probes; degraded-mode behaviour on last-good
   state where relevant.
4. **Error model**: map expected errors; ensure each is documented, tested,
   surfaced to the user, correlated, and recoverable.
5. **Diagnostics/investigation**: when investigating, read logs/metrics/traces
   first; reproduce read-only; isolate; form a falsifiable hypothesis before
   changing anything (hand fixes to `development-conventions`).
6. **Readiness verdict**: feed `quality-validation` the observability gates.

## Validation criteria (exit criteria)
- Structured logs with correlation; verified free of secrets/PII.
- Error DoD satisfied for the change.
- Required health/readiness and degraded-mode behaviour present for the profile.
- Telemetry is vendor-neutral (no business-code lock-in).

## Interactions with other skills
- Hands fixes to `development-conventions`; readiness gates to
  `quality-validation`; deploy-time concerns to `infrastructure-execution`.
- Uses `external-actions` for anything that writes outside the sandbox during an
  investigation (e.g. filing an issue).

## Limits
- Does not couple business code to a specific telemetry vendor.
- Does not log secrets/PII, ever, even temporarily for debugging.
- Does not perform production changes while investigating (read-first; fixes go
  through the normal dev + gates + external-actions path).

## Actions requiring human validation
- Any investigative action with external effect (filing/commenting on issues,
  touching production telemetry config) → via `external-actions`.
- Changes to production monitoring/alerting routing (R4).
