---
name: docker-patterns
description: Docker and Docker Compose patterns for local development, container security, networking, volume strategies, and multi-service orchestration.
origin: biblio
---

# Docker Patterns

Practical patterns for building, running, and hardening containers — grounded in how
Docker actually isolates processes (namespaces, cgroups, union filesystems), not just
in Dockerfile syntax.

## Prerequisites (preflight)

Requires **docker** (+docker compose). Verify before use; warn if missing:

```bash
command -v docker >/dev/null 2>&1 || echo "WARN: docker not installed — install: https://docs.docker.com/get-docker/"
```

## When to Activate

- Writing or reviewing a Dockerfile
- Deciding how to structure image layers for cache efficiency
- Debugging why a container sees "different" processes, hostnames, or filesystems
  than the host
- Setting memory/CPU limits or investigating a container OOM-kill
- Choosing between a bind mount and a named volume
- Designing container-to-container networking (user-defined bridge networks)
- Reducing image size or attack surface (multi-stage builds, non-root user)
- Pushing/pulling from a registry (Docker Hub or private)

## Isolation: Namespaces and Cgroups

Containers are not VMs. Docker isolates a process using Linux kernel primitives that
have existed since 2007 — Docker did not invent them, it orchestrates them.

**Namespaces** (what a process can *see*):

- `PID` — process identifiers; each container gets its own PID namespace, so a
  process inside a container can be PID 1 there while being an ordinary PID on the
  host. This is why `kill 1` inside a container is dangerous (it targets the
  container's init process) and why host tools like `top` show different PIDs than
  `docker exec <container> ps` does.
- `UTS` — hostname and domain name, isolated per container.
- `MNT` — filesystem mount points and structure.
- `IPC` — shared-memory process communication.
- `NET` — network interfaces, routing tables.
- `USR` — user/group IDs; enables UID remapping so root inside a container maps to
  an unprivileged UID on the host.

**Cgroups** (what a process can *use*): memory limits, CPU shares/weight, CPU core
pinning, and block-device/PID access restrictions. Cgroups govern quantity of
resources; namespaces govern visibility. Set both explicitly for anything running
in shared infrastructure — an unbounded container can starve its neighbors even
though it "can't see" them.

```bash
# Cgroup limits at run time
docker run -d --memory=512m --cpus=1.5 --name api myapp:1.4.2

# Run as a specific UID instead of image default (defense in depth)
docker run --user 1001:1001 myapp:1.4.2
```

## Union Filesystem and Layers

Images are built from read-only layers stacked with a union/copy-on-write
filesystem. When a container writes to a file that exists in a lower read-only
layer, the whole file is copied up into the container's writable layer before the
change lands — copy-on-write, not copy-on-change. Two consequences:

1. **Order layers by change frequency, least → most volatile.** Put files that
   rarely change (dependency manifests, then dependencies) before files that change
   on every commit (application source). Docker's build cache invalidates a layer
   and every layer after it as soon as one input changes.
2. **Copy-on-write has a runtime cost.** Writing to a large file that lives in a
   deep, unchanged layer is more expensive than writing to a file already in the
   writable layer. Avoid mutating large pre-baked files at runtime; write new state
   to a mounted volume instead.

```dockerfile
# GOOD — dependency layer cached across rebuilds; only the last COPY invalidates
FROM python:3.12-slim AS base
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .

# BAD — one COPY layer for everything; any source change reinstalls dependencies
FROM python:3.12-slim
WORKDIR /app
COPY . .
RUN pip install --no-cache-dir -r requirements.txt
```

## Multi-Stage Builds

Separate the toolchain needed to *build* the artifact from the runtime needed to
*run* it. The final stage only `COPY --from=<stage>` the compiled/installed
output, so compilers, build caches, and dev dependencies never reach the shipped
image.

```dockerfile
FROM golang:1.22-alpine AS builder
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /server ./cmd/server

FROM alpine:3.19 AS runtime
RUN apk --no-cache add ca-certificates && adduser -D -u 1001 appuser
USER appuser
COPY --from=builder /server /server
EXPOSE 8080
CMD ["/server"]
```

Multi-stage builds are the single highest-leverage pattern for both image size
(no leftover build toolchain) and security (no compiler, no package manager cache,
no dev dependencies to exploit).

## Non-Root by Default

Docker runs container processes as root (UID 0) unless told otherwise, and root
inside a container that escapes isolation is root on the host if UID remapping
isn't configured. Least privilege: purpose-build images to run only what the
application needs, dropping to a non-root user before the entrypoint executes.

```dockerfile
RUN adduser -D -u 1001 appuser
USER appuser
```

- Add the `USER` instruction **after** any step that legitimately needs root
  (installing packages, `chown`ing files) and **before** `CMD`/`ENTRYPOINT`.
- At run time, `--user <uid>[:<gid>]` overrides the image default without editing
  the Dockerfile — useful for verifying an image behaves correctly without root.
- If a process needs elevated access only at startup (e.g. binding to port 80),
  drop privileges inside the entrypoint script after that step, rather than
  running the whole process as root.

## Volumes vs. Bind Mounts

Both attach host-managed storage to a container's mount namespace, but they solve
different problems.

| | Named volume | Bind mount |
| --- | --- | --- |
| Location | Managed by Docker (`docker volume`) | Explicit host path |
| Lifecycle | Independent of any single container | Tied to host filesystem |
| Portability | Works the same across hosts/cloud storage drivers | Host-path dependent |
| Use for | Databases, shared application state, container-independent data | Local dev source-code mounts, host config injection |

- Volumes decouple data lifecycle from container lifecycle — a container can be
  destroyed and recreated without losing the volume's contents. This is what
  makes stateful services (databases, message queues) safe to run in containers.
- `VOLUME` in a Dockerfile only declares a mount point at build time; it does not
  create data. Prefer declaring volumes at `docker run`/Compose time so the
  intent (what storage backs the mount) stays explicit and reviewable.
- `--volumes-from` shares another container's volumes but not the layers under
  them — don't rely on it if the shared path differs between containers.

```yaml
services:
  db:
    image: postgres:17
    volumes:
      - pgdata:/var/lib/postgresql/data   # named volume, survives container recreation
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql:ro   # bind mount, dev-time config
volumes:
  pgdata:
```

## Networking

The default bridge network is legacy: no automatic DNS-based service discovery
between containers, no built-in load balancing. Always create a user-defined
bridge network per application/stack instead.

```bash
docker network create app-network
docker run -d --name db --network app-network postgres:17
docker run -d --name api --network app-network myapp:1.4.2
# `api` can reach `db` by container name — Docker resolves it via embedded DNS
```

- Container-to-container traffic on a user-defined bridge network is
  name-resolved automatically; the legacy `--link` flag and the default bridge
  require manual `/etc/hosts` wiring and are unnecessary once you're on a
  user-defined network.
- Only `--publish`/`-p` the ports that must be reachable from outside the
  network — internal services (databases, caches) should stay unpublished and
  reachable only from sibling containers on the same network.

## Resource Limits

Set both a ceiling and, where the runtime supports it, a soft target — an
unbounded container is a shared-host liability even when its own logic is
correct.

```bash
docker run -d --memory=512m --memory-swap=512m --cpus=1.0 myapp:1.4.2
```

```yaml
services:
  api:
    image: myapp:1.4.2
    deploy:
      resources:
        limits:
          cpus: "1.0"
          memory: 512M
```

A container that exceeds its memory limit is OOM-killed by the kernel cgroup
controller, not gracefully stopped — design health checks and restart policies
expecting a hard kill, not a clean shutdown signal.

## Image Size and Registries

- Prefer minimal, specific base image tags (`python:3.12-slim`, `alpine:3.19`) —
  never `:latest`, which is not reproducible and silently drifts.
- `.dockerignore` excludes build artifacts, `.git`, local secrets, and test
  fixtures from the build context — anything not ignored is sent to the Docker
  daemon and can end up copied into a layer by an over-broad `COPY .`.
- Tag images with the artifact version, not just `latest`, before pushing:
  `docker tag myapp:1.4.2 registry.example.com/team/myapp:1.4.2`.
- Private registries follow the same pull/push model as Docker Hub
  (`docker login`, `docker push <registry-host>/<namespace>/<repo>:<tag>`) — the
  registry host is just the first path segment of the image reference.

## Common Pitfalls

- **`:latest` in production** — non-reproducible builds, silent version drift on
  redeploy.
- **Single `COPY . .` before installing dependencies** — busts the layer cache on
  every source change, slowing every build.
- **Running as root with no `USER` instruction** — the default; must be actively
  overridden.
- **Treating `VOLUME` in a Dockerfile as "the data is safe"** — it declares a
  mount point, not a backup strategy; anonymous volumes left behind by removed
  containers accumulate and need periodic cleanup (`docker volume prune`).
- **Using the default bridge network** — no service discovery, legacy behavior;
  always create a user-defined bridge network.
- **No resource limits** — one runaway container can starve every other
  container on the host; the kernel OOM-killer, not the application, decides
  the shutdown, so don't expect graceful termination.
- **Copying secrets into an image layer** — even if removed in a later
  `RUN rm`, the secret still exists in the earlier layer; use build secrets or
  runtime env injection, never `COPY secret.pem .` followed by deletion.
