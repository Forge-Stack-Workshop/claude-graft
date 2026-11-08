---
name: ci-cd-pipelines
description: Principles for building CI/CD pipelines — staged commit/acceptance/staging/production flow, quality gates, artifact promotion, and release strategies. Tool-agnostic; applies to any CI server or hosted CI/CD platform.
origin: biblio
---

# CI/CD Pipelines

A pipeline is a sequence of automated stages that turns a code change into a
release candidate and, eventually, into a production release. It replaces the
traditional handoff chain (development → QA → operations, each taking days or
weeks) with an automated, fast, repeatable flow. The goal, per Jez Humble's
definition, is "the ability to get changes of all types — features,
configuration changes, bug fixes, experiments — into production, or into the
hands of users, safely and quickly in a sustainable way."

This skill covers the underlying pipeline model: stages, gates, artifacts,
promotion, and release strategy. Any CI engine (Jenkins, GitHub Actions,
GitLab CI, CircleCI, Buildkite, …) can implement it — none of them is the
point.

## When to Activate

- Designing a pipeline from scratch (new project or legacy system onboarding)
- Deciding what stages a pipeline should have and in what order
- Introducing or reviewing quality gates (coverage, static analysis, security)
- Setting up an artifact repository and versioning scheme
- Choosing between staging/QA environments and how release candidates flow
  through them
- Picking a release strategy (rolling, blue-green, canary) and its rollback plan
- Diagnosing a slow, flaky, or unclear pipeline

## Core Concepts

### Pipeline = stages + steps

- A **step** is a single operation (checkout, compile, run tests, build image).
- A **stage** is a logical group of steps (e.g. Build, Test, Deploy) used to
  visualize and reason about the pipeline as a whole.
- Stages run in sequence; a failing step stops the pipeline immediately and no
  further steps run. This is the entire point of staging: fail fast, and make
  the failure point visible without digging through a giant log.
- Visibility is a first-class requirement — every stage's pass/fail state
  should be visible to the whole team, not just to whoever triggered it.

### Quality gates

- A gate is a pass/fail checkpoint between stages: tests, coverage threshold,
  static analysis, security scan. A release candidate does not advance past a
  gate it fails.
- Gates give the pipeline its structure and let a human answer, at a glance,
  "is this build good enough to progress?" without re-reading its logs.
- Put cheap, fast gates first (lint, unit tests) and expensive, slow gates
  later (integration tests, performance tests) — this is the same principle
  as the commit-stage speed budget below, applied to gate ordering.

### The commit pipeline (first stage)

- Triggered by every commit/push to the main line.
- Minimum shape: checkout → compile/build → unit tests → static analysis /
  coverage → package the release candidate.
- Must run in a bounded, short time (a commonly cited budget is under ~5
  minutes) so developers get fast feedback and keep committing frequently —
  a slow commit stage kills the practice of continuous integration.
- Output of the commit stage is a **release candidate**: a single built
  artifact, uniquely versioned, that every later stage tests unchanged.

### Build once, promote the same artifact

- The artifact produced by the commit stage is stored in an **artifact
  repository** (binary/package/container registry) and never rebuilt.
- Every later stage — acceptance testing, staging, production — deploys the
  *exact same* artifact, only reconfigured per environment. Rebuilding per
  environment reintroduces the "works on my machine" risk the pipeline exists
  to eliminate.
- Every artifact carries a unique, traceable version so any deployed instance
  can be mapped back to the exact commit and build that produced it.
- Restrict who can push/promote artifacts; the repository is part of the
  trust boundary between "code someone wrote" and "binary someone will run in
  production."

### Automated acceptance testing stage

- Runs the release candidate (not a rebuild) against a suite that verifies
  the software works from the user's perspective: functional acceptance
  tests plus non-functional tests (performance, security, recoverability).
- This stage replaces the manual QA/UAT phase of the traditional process — it
  is what makes "safely and quickly" possible together, instead of trading
  one for the other.

### Environments: staging, QA, production

- **Staging** mirrors production configuration and is where the release
  candidate is deployed to run acceptance tests continuously — it changes
  after every commit that passes the commit stage, so it does not need to be
  "stable" in the way production does.
- A separate **QA/exploratory environment** may be kept more stable
  (deployed on demand, not on every commit) so humans can do exploratory
  testing or dependent teams can integrate against it — mixing this need
  into staging defeats staging's purpose.
- Never let acceptance tests run only against staging if staging's
  infrastructure diverges from production — divergence is exactly where
  production-only issues hide and slip through the gate.

## Release Strategies

Pick a strategy based on risk tolerance and infrastructure cost — they are
not mutually exclusive with a rollback plan, they require one.

| Strategy | Mechanism | Rollback | Infra cost | Use when |
|---|---|---|---|---|
| Rolling | Replace instances gradually; old and new versions coexist during rollout | Redeploy previous version instance by instance | Low (no duplicate fleet) | Default choice, backward-compatible changes |
| Blue-green | Two identical environments; switch a load balancer atomically from one to the other | Instant — switch the load balancer back | 2x during release | Zero-tolerance for downtime, need instant rollback |
| Canary | Route a small percentage of traffic to the new version, then increase | Simple — route traffic back to the old version | 2x-ish, plus traffic-splitting infra | High-traffic services, risky changes, want to test with real traffic first, A/B testing |

Canary additionally lets acceptance/performance testing happen against real
traffic when staging cannot faithfully reproduce production load or scale.

## Configuration Across Environments

- Configuration (URLs, credentials, feature flags, resource sizing) differs
  per environment; the deployed artifact must not.
- Externalize configuration (env vars, a configuration management tool) so
  the same binary/image is reconfigured, not recompiled, per environment.
- Manually changed configuration on a target environment is a smell — extract
  it into a configuration management tool so environments stay reproducible
  and drift is visible in version control, not tribal knowledge.

## Legacy / Brownfield Adoption

Applying this model to an existing system, not a greenfield project, follows
roughly this order:

1. Automate build and deployment first — turn undocumented, manual, or
   wiki-documented steps into a script/build tool config before anything else.
2. Add the commit pipeline (checkout → build → unit tests) around the
   now-automated build.
3. Extract untracked configuration into a configuration management tool.
4. Layer in acceptance testing and the full staging → production flow once
   the basics are automated and repeatable.

Trying to add acceptance testing or advanced release strategies before build
and deploy are automated produces a fragile pipeline that nobody trusts.

## Common Pitfalls

- **Rebuilding per environment** instead of promoting one versioned artifact
  — reintroduces "it built differently here" risk.
- **Slow commit stage** — if it takes many minutes, developers stop
  committing frequently and the whole practice degrades.
- **No visibility on gate failures** — a red pipeline that nobody sees is as
  bad as no pipeline.
- **Staging that drifts from production** — acceptance tests pass on staging,
  fail in production, because configuration or infrastructure diverged.
- **Skipping non-functional tests** — functional-only acceptance testing
  misses performance and security regressions until they hit production.
- **No rollback plan validated ahead of time** — a release strategy without
  a tested rollback path is not actually safe, regardless of which strategy
  chosen.
- **Manual, undocumented configuration changes on an environment** — breaks
  reproducibility and defeats the point of promoting a single artifact.
- **Treating acceptance testing as a one-time UAT phase** instead of an
  automated stage run on every release candidate — this reintroduces the
  code-freeze bottleneck the pipeline exists to remove.

## Further Reading

Concepts drawn from *Continuous Delivery with Docker and Jenkins* (Leszko).
Jenkins pipelines/stages are one concrete implementation; the same
stage/gate/artifact-promotion model applies directly to GitHub Actions,
GitLab CI, CircleCI, or any other CI/CD engine.
