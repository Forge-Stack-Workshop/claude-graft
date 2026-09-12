---
name: argocd-gitops-patterns
description: Use for continuous delivery of Kubernetes workloads with ArgoCD and GitOps — declaring Applications/ApplicationSets, app-of-apps, sync waves, automated self-heal/prune, drift detection, progressive rollouts, GitOps secret handling, and rollback. For Kubernetes manifest/authoring conventions themselves (pods, probes, RBAC, storage), use the kubernetes-patterns skill; this skill covers the delivery layer on top. Triggers on "argocd", "gitops", "sync wave", "app-of-apps", "applicationset", "deploy to cluster", "why did the sync fail", "roll back the deploy".
---

# ArgoCD / GitOps delivery patterns

The continuous-delivery layer for Kubernetes. For manifest authoring (pods, probes,
resource limits, RBAC, storage) see **kubernetes-patterns**; this skill is only about
how those manifests reach a cluster and stay in sync.

Principle: **git is the single source of truth; the cluster converges to it.** No human
`kubectl apply` / `helm upgrade` against production — that is drift, and drift is an
incident waiting to happen. Apply/sync/rollback are external, cluster-mutating actions:
they are human-approved, never hand-run on prod.

## When to use

- Setting up or changing ArgoCD delivery (Applications, ApplicationSets, projects).
- "Deploy this to the cluster" / "why is the app OutOfSync?" / "roll back".
- Structuring a GitOps repo for many apps / many environments / many clusters.

## Application: the deployable unit

- `source`: repo + `path` (or `chart`) + `targetRevision`.
- `destination`: cluster server + namespace.
- `syncPolicy`: how it converges (below).
- **Pin `targetRevision`** to a tag or commit for prod, never a moving branch. A branch
  is fine for a dev/preview environment.

## Automated sync — deliberately

```yaml
syncPolicy:
  automated:
    prune: true        # delete resources removed from git
    selfHeal: true     # revert manual drift back to git state
  syncOptions:
    - CreateNamespace=true
    - ApplyOutOfSyncOnly=true
```

`selfHeal` + `prune` are what make GitOps real (the cluster cannot silently diverge).
Disable either only with a documented reason — never "so a manual hotfix sticks"; commit
the fix to git instead.

## Ordering: sync waves & hooks

- `argocd.argoproj.io/sync-wave: "N"` orders dependent resources: CRDs and namespaces
  before the workloads that need them; schema migrations before the app that uses them.
- Resource hooks (`PreSync`/`Sync`/`PostSync`) run jobs (e.g. migrations, smoke checks)
  at the right phase. Make hook jobs idempotent.

## Scaling to many apps / clusters

- **App-of-apps**: a root Application whose source is a directory of child Applications.
- **ApplicationSet**: generate Applications from a generator (git directories, clusters,
  lists, pull requests) instead of hand-maintained YAML — the right tool for
  per-environment or per-cluster fan-out and PR preview environments.
- **AppProject** is the authorization boundary: restrict allowed source repos,
  destinations (cluster+namespace), and cluster-scoped resources. Don't run everything in
  the `default` project/namespace.

## Health & sync status = the deploy signal

- A green **sync** with a red **health** check is not "done". Gate on both.
- Add custom health checks (Lua) for CRDs ArgoCD doesn't understand, so a
  not-yet-ready custom resource doesn't report Healthy prematurely.

## Secrets — never plaintext in git

Manifests live in git; secrets must not be readable there.
- **External Secrets Operator** (pull from Vault / cloud secret manager) or
  **Sealed Secrets** (encrypted; only the target cluster can decrypt).
- ArgoCD syncs the *reference / sealed* object; plaintext never exists in the repo.
- A plaintext Secret committed to a synced path is a secret-scan / `.env` violation.

## Progressive delivery & rollback

- For risky changes use **Argo Rollouts** (canary / blue-green) with analysis, rather
  than a bare `RollingUpdate` flip.
- **Rollback = revert the git commit** and let ArgoCD sync, or `argocd app rollback` to a
  previous synced revision. Both are human-approved external actions.

## Suggested GitOps repo layout

```
apps/
  <app>/base/                 # manifests or a chart
  <app>/overlays/{dev,staging,prod}/
argocd/
  projects/<project>.yaml     # AppProject (authorization boundary)
  applicationsets/<set>.yaml  # or app-of-apps root
```

## Anti-patterns (reject in review)

- `:latest` or a floating branch as prod `targetRevision`.
- `selfHeal` / `prune` disabled with no documented reason.
- Manual `kubectl apply` / `helm upgrade` on prod (bypasses GitOps, creates drift).
- Plaintext Secret in a synced path.
- Everything in the `default` AppProject / namespace.
- Treating "Synced" as success while health is degraded.

## Verification checklist

- [ ] Application pins a tag/commit revision (prod), correct AppProject & destination.
- [ ] `automated` sync with `selfHeal` + `prune`; sync options intentional.
- [ ] Sync waves/hooks order CRDs, namespaces, migrations correctly.
- [ ] Secrets via ESO/Sealed Secrets — nothing in plaintext.
- [ ] App is **Synced AND Healthy**; rollback path known and tested.
