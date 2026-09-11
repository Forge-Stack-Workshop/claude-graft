---
name: deploy
description: Use when deploying {{PROJECT_NAME}} to {{DEPLOY_TARGET}}, promoting a release, rolling back a bad deploy, or diagnosing a failed rollout. Covers the GitOps path, the pre-flight checklist, migration ordering, and rollback. Not for local dev (`make dev`).
---

<!--
  NATIVE Claude Code FEATURE — .claude/skills/<name>/SKILL.md.
  Loaded ON DEMAND: the model only sees the frontmatter (name + description)
  until the description matches the task. The body is read only after that.
  => The `description` is the only trigger. It must say WHEN, not WHAT.
-->

# Deploy {{PROJECT_NAME}} → {{DEPLOY_TARGET}}

## Golden rule: GitOps

The normal path is **git**, not `kubectl`. Edit `deploy/k8s/`, merge,
let the controller sync.

A manual `kubectl apply` creates **drift**: the cluster no longer matches the
repo. If you must do it, reconcile it back to the repo state promptly or open an
issue to track the divergence.

## Pre-flight — in order, without skipping

```bash
git rev-parse --abbrev-ref HEAD          # on main, up to date, nothing local
make lint && make test                   # green. In the container, WITHOUT a pipe.
kubectl diff -k deploy/k8s/overlays/<env>   # what will ACTUALLY change
```

`kubectl diff` is not optional. It is the only step that shows the real gap
between the intent and the cluster. A diff that surprises you = stop.

Also check:

- [ ] No secret in the manifests (`ExternalSecret`/SOPS reference, no value).
- [ ] The image tag actually exists in the registry.
- [ ] Any included migration is **reversible** and its `down` has been tested.
- [ ] ADR present if the deployment changes an API contract or the data model.

## Migration ordering — the rule that breaks everything if ignored

**Old code and new schema coexist during the rollout.** Always.

A breaking change is done in **two deployments**, never in one:

1. Deployment N: add the column (nullable) → backfill → the code writes to
   both, reads the old one.
2. Deployment N+1: the code reads the new one → drop the old column.

`ALTER ... DROP` in the same deployment as the code change = guaranteed incident
during the rolling update. Heavy migration (lock > a few seconds) →
procedure in `@.claude/context/runbook.md` **before** running it.

## Deploy

```bash
git push origin main                     # the controller takes over
kubectl rollout status deploy/{{PROJECT_SLUG}} -n {{PROJECT_SLUG}} --timeout=5m
kubectl get pods -n {{PROJECT_SLUG}} -w
```

## Rollback

```bash
kubectl rollout undo deploy/{{PROJECT_SLUG}} -n {{PROJECT_SLUG}}
kubectl rollout status deploy/{{PROJECT_SLUG}} -n {{PROJECT_SLUG}}
```

⚠️ **An application rollback does not undo a database migration.** If the deployment
contained a breaking migration, rolling back the image leaves the old
code facing the new schema — a second incident on top of the first. This is
exactly what the two-deployments rule prevents.

Git rollback (the real one, the one that reconciles the cluster): `git revert` + push.
`kubectl rollout undo` is only a band-aid — the controller will re-sync
the repo's state.

## Failed rollout — diagnosis

| Symptom                       | Cause                                    | Where to look                            |
| ----------------------------- | ---------------------------------------- | ---------------------------------------- |
| `ImagePullBackOff`            | Nonexistent tag / unreachable registry   | `kubectl describe pod` → `Events`        |
| `CrashLoopBackOff`            | The container dies at startup            | `kubectl logs --previous <pod>`          |
| `CreateContainerConfigError`  | Referenced Secret/ConfigMap absent       | `kubectl describe pod` → `Events`        |
| Lasting `Pending`             | Insufficient resources / nodeSelector    | `kubectl describe pod` → `Events`        |
| Readiness that never passes   | The probe tests an external dependency   | The probe, not the code                  |

`kubectl logs` on a pod in CrashLoop is **empty** — the current container was
just born. You need `--previous`.

## Forbidden

- `kubectl delete` — blocked by `.claude/settings.json` and by the hook. Go through
  the manifest.
- Editing a live resource (`kubectl edit`) — invisible drift, lost on the next sync.
- Deploying with a dirty working tree or a red CI.
- Deploying a non-reversible migration without a prior snapshot.

## After deployment

- [ ] `kubectl rollout status` finished without a timeout
- [ ] Critical journey checked by hand (not just "the pods are Running")
- [ ] Clean logs over 5 minutes
- [ ] The cluster matches the repo: `kubectl diff -k ...` returns **nothing**

The last point is the one that gets forgotten. A non-empty diff after deployment = drift
already installed.
