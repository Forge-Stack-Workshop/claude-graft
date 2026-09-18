---
name: infrastructure-execution
description: Use for containers, images, Kubernetes manifests, reproducible environments, build files, running a project in one command, and local-to-cluster execution. Applies the container/runtime posture, port-exposure and reverse-proxy rules, and the in-project infra-config requirements from the standards canon — proportionate to the project profile.
---

# infrastructure-execution

> Inherits `governance-core`. Consumes the canon by reference. Specific tools
> (orchestrator, reverse proxy, build-base) come from `config.yaml` / the canon.

## Role
Make a project reproducible, isolated and runnable the standard way: containers
by default where the canon requires, single-responsibility images, in-project
infra config, the cluster's common reverse proxy, minimal published surface, and
a modular build file — so "run it" and "deploy it" are one command and one
contract.

## Triggers
- Writing/adjusting Dockerfiles, compose, Helm/Kubernetes manifests; "how do I
  run this"; single-command run/build; build-file (Makefile) work; env
  reproducibility; exposing a service; promoting an artefact.

## Rules it applies (resolve from the canon by ID)
- Containers & orchestration: containerization by default (system-need exemption
  only); multi-stage images per environment; one responsibility per container;
  **no reverse proxy inside an app container**; **cluster-exposed apps use the
  cluster's common reverse proxy** (configured).
- Port exposure: **published by default: nothing**; only a publicly useful port
  is exposed. Direct-Internet / node-level / load-balancer exposure needs an ADR.
- In-project infra config; centralized project config.
- Build secrets: never persisted in a layer — build-time secret mechanism or
  pipeline injection; runtime secrets from the cluster's secret management.
- Build file: derived from the shared build base; size-bounded, split by domain,
  no duplicated target, no local install inside a container.
- Deployment & promotion; supply-chain security (resolve the domains).

## Inputs it must gather before acting
1. Profile + deployment target (cluster vs standalone) + standards version.
2. What the service legitimately needs to expose (default: nothing).
3. Existing build-file/container/manifest state and the cluster conventions.

## Execution steps
1. **Containerize** with multi-stage, single-responsibility images; no embedded
   reverse proxy; no local install inside the container.
2. **One-command run/build** via a modular build file derived from the shared
   base; size-bounded; split by domain.
3. **Infra config in-project**; expose only via the cluster's common reverse
   proxy; publish the minimal useful port, nothing by default.
4. **Secrets** via build-time mechanism / pipeline at build and cluster secret
   management at runtime — never in VCS, never baked in a layer.
5. **Standalone exceptions** delivered as a separate profile/artefact with an
   explicit ADR.
6. **Hand the exposure/deploy action** to `external-actions`.

## Validation criteria (exit criteria)
- Image builds reproducibly; single responsibility; no embedded reverse proxy;
  no build secret in any layer.
- One-command run/build works; build file within size bound, no duplicated
  targets.
- Only the intended port is published; exposure goes through the common reverse
  proxy; any deviation carries an ADR.
- Container / manifest linters (as the canon names them) pass.

## Interactions with other skills
- Consumes code structure from `development-conventions`.
- Hands production-readiness signals to `observability-diagnostics`.
- Routes cluster apply / deploy / exposure through `external-actions`.
- Feeds `quality-validation` the infra gates.

## Limits
- Does not perform a production deploy or a manual cluster apply itself.
- Does not embed a reverse proxy or publish ports "just in case".

## Actions requiring human validation
- Any cluster apply, deploy, or new public exposure (R4–R5, via
  `external-actions`).
- Direct-Internet / node-level / load-balancer exposure or standalone topology
  (ADR + human approval).
