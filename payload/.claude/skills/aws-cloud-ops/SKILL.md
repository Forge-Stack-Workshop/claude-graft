---
name: aws-cloud-ops
description: Cloud infrastructure operations patterns — infrastructure as code, CI/CD pipelines, container orchestration, autoscaling, and monitoring. Concepts illustrated with AWS services (CloudFormation, CodePipeline, ECS, CloudWatch) but transposable to any cloud provider with an equivalent service.
origin: biblio
---

# Cloud Infrastructure Operations

Patterns for treating infrastructure as code, automating delivery pipelines, running
containers at scale, and closing the loop with monitoring and autoscaling. AWS service
names anchor each example because they are concrete and well-documented, but every
pattern maps onto an equivalent service on another provider (see the mapping table).
No single vendor is a prerequisite for the underlying practice.

## When to Activate

- Defining infrastructure with a template/config language instead of clicking a console
- Designing a CI/CD pipeline (build → test → deploy) with a canary, staged, or
  approval-gated rollout
- Choosing between EC2-class instances, a container orchestrator, or serverless
  functions for a given workload
- Setting up autoscaling driven by a real metric (CPU, queue depth, request rate)
- Building alerting/monitoring so a rollback decision can be made in minutes, not hours
- Reviewing a deployment strategy: fail-fast, canary, or feature-flagged dark launch

## Cross-provider concept map

| Concept | AWS | Transposable to |
|---|---|---|
| IaC templates | CloudFormation | Terraform, Pulumi, Azure ARM/Bicep, GCP Deployment Manager |
| Config management | Ansible (pull/push mode) | Chef, Puppet, Salt |
| Managed CI/CD pipeline | CodePipeline + CodeBuild + CodeDeploy | GitHub Actions, GitLab CI, Azure DevOps, Cloud Build |
| Container orchestration | ECS (or EKS for Kubernetes) | GKE, AKS, any Kubernetes distribution |
| Container registry | ECR | GCR/Artifact Registry, ACR, Docker Hub |
| Managed load balancer | ELB / ALB | Google Cloud Load Balancing, Azure Load Balancer |
| Managed cache | ElastiCache | Memorystore, Azure Cache for Redis |
| CDN | CloudFront | Cloud CDN, Azure CDN, Fastly, Cloudflare |
| Message queue / stream | SQS / Kinesis | Pub/Sub, Azure Service Bus / Event Hubs, Kafka |
| Serverless functions | Lambda + API Gateway | Cloud Functions/Run, Azure Functions |
| Metrics/alarms | CloudWatch (metrics + alarms + events) | Cloud Monitoring, Azure Monitor, Prometheus + Alertmanager |

Use the AWS column to reason concretely; port the row, not the column, to your actual
provider.

## Infrastructure as Code

**Principle:** describe the target architecture in a text file (JSON/YAML for
CloudFormation, HCL for Terraform), commit it, and let the tool reconcile reality to
that description — never hand-edit resources in a console.

A minimal template has: a description, a resource section (the actual AWS
objects and their configuration), a parameters section (values supplied at launch
time — e.g. which SSH keypair to use), and optionally a mappings section (values
that vary by region, e.g. which AMI ID to use per region) so the same template is
reusable across environments.

```bash
# Launch a stack from a template, passing a parameter
aws cloudformation create-stack \
  --capabilities CAPABILITY_IAM \
  --stack-name helloworld-staging \
  --template-body file://nodeserver-cf.template \
  --parameters ParameterKey=KeyPair,ParameterValue=EffectiveDevOpsAWS
```

**Golden rule:** architect every service so it can be torn down and recreated on
demand. Being able to troubleshoot a broken host is good; being able to kill it and
stand up a clean replacement in minutes is what actually stops user impact.

**Generating templates from code, not by hand.** Writing raw CloudFormation/Terraform
JSON/YAML by hand is error-prone at scale. A generator library (e.g. `troposphere` for
CloudFormation) lets you build the template with a real programming language — loops,
functions, parameters — and emit the final template as a build step:

```bash
$ python nodeserver-cf-template.py > nodeserver-cf.template
```

Treat the generator script as the source of truth, and the emitted template as a
build artifact.

## CI/CD Pipeline Stages

A pipeline is a sequence of independently retriable stages, each gating the next:

```text
Source → Build (CodeBuild) → Test → Deploy staging (CodeDeploy) → Manual approval → Deploy production
```

- **Manual approval gate**: insert an explicit human sign-off stage before production —
  route the approval request through a notification channel (email/chat via a pub/sub
  topic) so the reviewer doesn't have to poll the pipeline UI.
- **The end goal is to remove the human from the loop.** A manual approval stage is a
  stepping stone, not the destination — once monitoring is trustworthy enough to catch
  regressions within minutes, replace the approval gate with an automated strategy below.

### Deployment strategies (in order of increasing sophistication)

**Fail fast.** Deploy optimistically on every change; rely on strong log/metric
monitoring to detect a bad release within minutes, then roll back to the previous,
known-good artifact fast. This trades pre-deploy caution for post-deploy detection
speed — it only works if rollback truly is fast and monitoring truly is immediate.
Rolling back after a mistake is normal operating procedure, not a failure to
manage — treating every rollback as a crisis just adds anxiety and produces more
mistakes, not fewer.

**Canary deployment.** Route a small slice of traffic (a common starting point:
10% of traffic for ~10 minutes) to the new release while the rest keeps serving the
old one. Compare error rate and latency between the two cohorts. If the canary looks
healthy, shift 100% of traffic over — then keep watching closely for a while, because
slow-building issues (e.g. memory leaks) only show up after full rollout, not during
the canary window.

**Feature flags / dark launch.** The most work to implement, but the finest-grained
control: ship the new code with the feature switched off behind a flag, deploy to
production inert, then flip the flag on for a small percentage of users and ramp up
independently of any code deploy. Decouples "deploy" from "release" entirely.

## Compute Choice: instances vs. containers vs. serverless

| Option | AWS | Fit |
|---|---|---|
| VM per app | EC2 (+ Auto Scaling Group) | Simple monoliths, full OS control needed |
| Containers | ECS/EKS + a registry (ECR) | Consistent env across dev/staging/prod, faster startup than a VM, easier to break a monolith into services |
| Functions | Lambda + API Gateway | Event-driven, spiky, low-ops workloads; runs on a container system under the hood even though the API hides it |

Containers solve a concrete pain that VM-based config management (Ansible/Chef/Puppet)
doesn't fully close: "works on the developer's laptop but not in production" is usually
a symptom of environment drift between local dev and the CI/CD-managed staging/prod
environments. A container packages the app, its dependencies, and the relevant slice of
the OS together, so the same artifact runs identically everywhere — including on a
developer's machine.

## Autoscaling

An autoscaling group needs three pieces, wired together:

1. **A launch template/configuration** — what to boot (AMI/image, instance type, user
   data) every time the group decides to add capacity.
2. **Min/max/desired capacity** — hard bounds on the group size (e.g. `MinSize=2,
   MaxSize=5`) so scaling can never run away or shrink to zero unintentionally.
3. **A scaling policy driven by a real metric alarm** — e.g. a CPU-utilization alarm
   from the monitoring system, with the alarm scoped to only the instances in this
   group (not the whole account), evaluated over a window (e.g. average over 1 minute)
   and a clear threshold (e.g. trigger scale-up above 60%).

Attach the group to a load balancer so instances are automatically registered/
deregistered from the pool as the group scales — otherwise autoscaling changes
capacity without changing what actually receives traffic.

```bash
# Inspect what an Auto Scaling Group actually did and why
$ aws autoscaling describe-scaling-activities
```

Scale down as aggressively as you scale up — an asymmetric policy (fast scale-up,
slow/absent scale-down) quietly turns autoscaling into a one-way cost increase.

## Monitoring & Alerting

Monitoring exists to make the "fail fast" and "canary" deployment strategies safe —
without it, both strategies degrade into shipping blind. At minimum, instrument and
alert on:

- Compute layer (instance/container health, CPU/memory)
- Container orchestrator layer (cluster, host, service, and per-container metrics —
  each is a distinct failure domain and needs its own visibility)
- Load balancer layer (request rate, latency, error rate at the ALB/ELB)
- Custom application/business metrics, not just infrastructure metrics — wire these
  into the same alarm/event system so an alert can trigger an automated action (e.g. a
  function invoked from a monitoring event), not just a page to a human.

Treat an alarm as the trigger for an autoscaling policy AND as the trigger for a
deployment rollback decision — the same metric pipeline should feed both.

## Common Pitfalls

- Hand-editing infrastructure in a provider console after it was created from a
  template — the next template deploy silently reverts (or conflicts with) the
  manual change. Change the template, not the resource.
- Writing a monolithic, hand-authored template with no parameters/mappings —
  it can't be reused across regions or environments, so every environment drifts.
  Design the template to be regenerable and environment-agnostic from day one.
- No min/max bounds on an autoscaling group, or bounds set once and never revisited
  as real traffic patterns become known.
- A canary or fail-fast strategy adopted without the monitoring to back it —
  the strategy only works if a bad release is detected in minutes, not hours.
- Treating a manual approval pipeline stage as a permanent safety net instead of a
  temporary bridge to an automated, metric-driven deployment strategy.
- Choosing serverless functions for a workload that needs long-lived state or tight
  latency control on cold start, purely because it looked simpler to set up.
- Selecting a compute/orchestration/CI service because it is the vendor's flagship
  offering rather than because it fits the workload — evaluate the pattern (IaC,
  pipeline stage, orchestrator, autoscaling loop, monitoring loop) against the actual
  requirement, on whichever provider is already in use.
