---
name: kubernetes-patterns
description: Kubernetes container orchestration patterns — pod design, workload controllers (Deployments, StatefulSets, DaemonSets, Jobs), service discovery, RBAC security, storage (PV/PVC), networking (CNI, Ingress), horizontal/vertical autoscaling, health probes, operators/CRDs, rolling updates, and resource limits for production readiness.
origin: "Mastering Kubernetes by Gigi Sayfan, Packt Publishing 2017"
tags: ["kubernetes", "orchestration", "containers", "devops", "infrastructure"]
---

# Kubernetes Patterns

Kubernetes is a declarative, distributed orchestration platform for containerized
workloads. Master Pod design, controllers, networking, storage, and security to
build resilient, scalable production systems. Applies to any Kubernetes distribution
(vanilla, EKS, GKE, AKS, k3s) and any language/runtime running inside containers.

## Prerequisites (preflight)

Requires **kubectl** (and optionally helm). Verify before use; warn if missing:

```bash
command -v kubectl >/dev/null 2>&1 || echo "WARN: kubectl not installed — install: https://kubernetes.io/docs/tasks/tools/"
```

## When to Activate

Use this skill when:

- **Designing workload deployments** — Deployments, StatefulSets, DaemonSets, or
  Jobs/CronJobs based on application statefulness and lifecycle
- **Setting up multi-tier services** — discovery, load balancing, inter-pod networking
- **Implementing security** — RBAC, network policies, secret management, pod security
  contexts
- **Planning storage** — PV/PVC, storage classes, stateful data
- **Scaling and observability** — HPA/VPA, resource requests/limits, health probes
- **Upgrading safely** — rolling updates, blue-green, canary deployments, rollback
- **Extending Kubernetes** — CRDs, operators, webhooks, API aggregation

---

## Core Concepts

### Pod Basics

- **Pod**: smallest deployable unit, one or more containers sharing a network
  namespace (`localhost` communication) and optionally volumes
- Ephemeral by nature — never manage bare Pods directly in production; use a
  controller (Deployment, StatefulSet, DaemonSet, Job) so Kubernetes recreates
  Pods on failure
- **Init containers**: run to completion before app containers start (schema
  migration, config fetch, wait-for-dependency)
- **Sidecar pattern**: co-located container for cross-cutting concerns (log
  shipping, service-mesh proxy, metrics exporter) — shares the Pod's network
  and lifecycle with the main container

### Controllers & Workload Types

| Controller | Identity | Storage | Use for |
| --- | --- | --- | --- |
| **Deployment** | Interchangeable replicas | Ephemeral or shared | Stateless web apps, APIs |
| **StatefulSet** | Stable, ordered (`app-0`, `app-1`, …) | One PVC per replica | Databases, brokers, clustered stores |
| **DaemonSet** | One pod per (matching) node | Node-local | Log/metrics agents, CNI/CSI plugins |
| **Job** | Run-to-completion | N/A | One-off batch tasks |
| **CronJob** | Scheduled Job | N/A | Periodic maintenance, backups |

```yaml
apiVersion: apps/v1
kind: Deployment
metadata: {name: web-app}
spec:
  replicas: 3
  selector: {matchLabels: {app: web-app}}
  strategy: {type: RollingUpdate, rollingUpdate: {maxSurge: 1, maxUnavailable: 0}}
  template:
    metadata: {labels: {app: web-app}}
    spec:
      containers:
        - name: web-app
          image: registry.example.com/web-app:1.4.2
          resources:
            requests: {cpu: "250m", memory: "256Mi"}
            limits: {cpu: "500m", memory: "512Mi"}
```

### Services & Discovery

- **Service**: stable virtual IP + DNS name, load-balanced across Pods matching
  a label selector; types:
  - `ClusterIP` (default, internal-only)
  - `NodePort` (exposes a static port on every node)
  - `LoadBalancer` (provisions a cloud load balancer)
  - `ExternalName` (CNAME to an external DNS name, no proxying)
- Endpoints/EndpointSlices automatically track healthy Pods matching the selector
- DNS convention: `<service>.<namespace>.svc.cluster.local`

### RBAC & Security

- **Role / ClusterRole**: permission rules — API groups, resources, verbs
  (`get`, `list`, `watch`, `create`, `update`, `patch`, `delete`)
- **RoleBinding / ClusterRoleBinding**: attach a Role to users, groups, or
  ServiceAccounts
- **NetworkPolicy**: microsegmentation — deny-by-default, then allow specific
  ingress/egress between Pods/namespaces
- **Pod Security Context**: `runAsNonRoot: true`, `readOnlyRootFilesystem: true`,
  drop all Linux capabilities except the ones required
- **Secrets** (opaque, TLS, docker-registry) and **ConfigMaps** for runtime
  configuration — never bake secrets into images

### Storage (PV/PVC)

- **PersistentVolume (PV)**: cluster-wide storage resource (block/file storage
  such as EBS, Persistent Disk, NFS, Ceph)
- **PersistentVolumeClaim (PVC)**: a Pod's request for storage, bound to a PV
  (directly, or dynamically via a StorageClass)
- **StorageClass**: defines the provisioner, reclaim policy (`Delete`/`Retain`),
  and `volumeBindingMode`
- Reference the PVC from the Pod spec via `volumeMounts` + `volumes`

### Networking (CNI)

- **Container Network Interface (CNI)** plugins (Cilium, Calico, Flannel,
  Weave) provide flat pod-to-pod routing across nodes — don't assume it works
  "out of the box" without checking cluster-specific limits (pod CIDR size,
  IP exhaustion on cloud-managed CNIs)
- **Ingress controller** (NGINX, Traefik, cloud-native ALB) routes external
  HTTP/HTTPS traffic to Services by host/path rules, usually terminating TLS
- **Gateway API** is the newer, more expressive successor to Ingress for
  complex routing
- **Service mesh** (Istio, Linkerd) adds mTLS, retries, circuit-breaking, and
  observability at layer 7 — added operational complexity, adopt only when the
  traffic-management/security need justifies it

### Autoscaling

- **HPA (Horizontal Pod Autoscaler)**: scales `replicas` based on CPU/memory
  or custom/external metrics (via the Metrics Server or a metrics adapter)
- **VPA (Vertical Pod Autoscaler)**: recommends or auto-adjusts container
  resource requests/limits — do not run HPA on CPU/memory and VPA on the same
  container simultaneously (conflicting signals)
- Accurate scaling decisions require realistic `resources.requests`

### Health Checks & Probes

- **Liveness probe**: restarts the container when it fails — use only for
  genuinely unrecoverable states (deadlock), never as a proxy for readiness
- **Readiness probe**: gates traffic — Pod is removed from Service endpoints
  until it passes, added back once healthy
- **Startup probe**: protects slow-starting containers from being killed by
  liveness checks before they've finished booting
- Mechanisms: `exec` (shell command), `httpGet` (path + port, success on
  2xx/3xx), `tcpSocket`; tune with `initialDelaySeconds`, `periodSeconds`,
  `failureThreshold`

```yaml
livenessProbe:
  httpGet: {path: /healthz, port: 8080}
  initialDelaySeconds: 15
  failureThreshold: 3
readinessProbe:
  httpGet: {path: /ready, port: 8080}
  periodSeconds: 5
startupProbe:
  httpGet: {path: /healthz, port: 8080}
  failureThreshold: 30
```

### StatefulSets

Use a StatefulSet when the workload needs any of:

- Stable, unique network identity per replica (`<name>-0`, `<name>-1`, …)
- Stable, persistent storage per replica, reattached on rescheduling
- Ordered, graceful deployment and scaling (sequential start/stop)
- Ordered, automated rolling updates

Requires a **headless Service** (`clusterIP: None`) for direct per-Pod DNS
records, and a `volumeClaimTemplates` block so each replica gets its own PVC.

```yaml
apiVersion: v1
kind: Service
metadata: {name: db}
spec:
  clusterIP: None          # headless — required for stable per-pod DNS
  selector: {app: db}
  ports: [{port: 5432}]
---
apiVersion: apps/v1
kind: StatefulSet
metadata: {name: db}
spec:
  serviceName: db
  replicas: 3
  selector: {matchLabels: {app: db}}
  template:
    metadata: {labels: {app: db}}
    spec:
      containers:
        - name: db
          image: registry.example.com/db:14
          volumeMounts: [{name: data, mountPath: /var/lib/data}]
  volumeClaimTemplates:
    - metadata: {name: data}
      spec:
        accessModes: ["ReadWriteOnce"]
        resources: {requests: {storage: 50Gi}}
```

### Operators & CRDs

- **Custom Resource Definition (CRD)**: extends the Kubernetes API with
  domain-specific object types (e.g. `Kafka`, `PostgresCluster`)
- **Operator**: a control loop (usually itself a Deployment) that watches CRDs
  and reconciles the cluster toward the declared desired state, encoding
  operational knowledge (backup, failover, upgrade) as code
- Decouples infrastructure/platform teams from application-specific lifecycle
  logic — prefer an existing, well-maintained operator over hand-rolled
  automation for complex stateful systems (databases, message queues)

### Rolling Updates & Upgrades

- Deployment `strategy.type`: `RollingUpdate` (default, gradual replacement)
  or `Recreate` (all old Pods terminated before new ones start — needed when
  old/new versions cannot coexist)
- `maxSurge` / `maxUnavailable` tune rollout speed vs. availability risk
- **Blue-green**: deploy the new version fully in parallel, then switch
  traffic atomically at the Service/Ingress level — instant rollback, doubles
  resource usage during the switch
- **Canary**: route a small percentage of traffic (5–10%) to the new version,
  monitor error rate/latency, then progressively shift the rest
- Rollback with `kubectl rollout undo deployment/<name>`; always validate on
  staging first, and confirm old and new versions of the API/schema are
  backward compatible before rolling out

### Resource Limits

- **Requests**: guaranteed minimum CPU/memory; used by the scheduler to place
  the Pod on a node with enough capacity
- **Limits**: hard cap — exceeding a memory limit triggers an OOM kill;
  exceeding a CPU limit throttles the container
- Leaving `requests` unset lets the scheduler overcommit the node, causing
  noisy-neighbor issues and evictions under pressure
- Enforce sane defaults per namespace with `LimitRange`; cap total namespace
  consumption with `ResourceQuota`

---

## Pitfalls

- **Insufficient health probes** — missing liveness/readiness causes zombie Pods or cascading failures
- **Liveness probe too aggressive** — checking downstream dependencies there causes restart loops; that's readiness's job
- **No resource requests** — scheduler overcommits nodes; degradation, throttling, evictions
- **`hostPath` for stateful data** — breaks on reschedule; use PVC/StatefulSet instead
- **Incomplete RBAC** — `cluster-admin` ServiceAccounts "to make it work," or no NetworkPolicies (all pod-to-pod traffic open)
- **Premature autoscaling** — HPA without understanding traffic patterns causes replica flapping
- **HPA and VPA on the same dimension** — both adjusting CPU/memory on one workload creates oscillation
- **Breaking changes during rolling updates** — old/new Pod versions coexist; schema/API must stay compatible
- **Assuming CNI "just works"** — IP quota, MTU mismatches can silently break pod-to-pod networking
- **Secrets in ConfigMaps or Git-committed defaults** — use a Secret object or external secret manager
- **`replicas: 1` labeled "highly available"** — no redundancy; add PodDisruptionBudgets for maintenance safety

---

## Quick Reference

| Need | Pattern |
| --- | --- |
| Scale stateless app | Deployment + HPA on CPU |
| Persistent, identity-sensitive data | StatefulSet + headless Service + `volumeClaimTemplates` |
| Background/scheduled tasks | Job or CronJob |
| External HTTP/HTTPS routing | Ingress (or Gateway API) + Service |
| Node-level agents (logging, CNI, CSI) | DaemonSet |
| Multi-tenant isolation | Namespace + NetworkPolicy + RBAC + ResourceQuota |
| Safe rollout | `RollingUpdate` strategy + readiness/liveness probes |
| Zero-downtime version switch | Blue-green or canary via Service/Ingress traffic shift |
| Complex stateful app lifecycle | Operator + CRD instead of custom scripts |
