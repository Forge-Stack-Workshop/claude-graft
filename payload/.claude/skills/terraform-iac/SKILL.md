---
name: terraform-iac
description: Terraform infrastructure-as-code patterns — HCL structure, providers, remote state and locking, reusable modules, workspaces/environments, plan/apply/destroy workflow, drift detection, dependencies, secrets handling, and CI plan-in-PR pipelines.
origin: authored
---

# Terraform IaC

Infrastructure-as-code patterns for provisioning and managing cloud resources with Terraform.

## Prerequisites (preflight)

Requires **terraform**. Verify before use; warn if missing:

```bash
command -v terraform >/dev/null 2>&1 || echo "WARN: terraform not installed — install: https://developer.hashicorp.com/terraform/install"
```

## When to Activate

- Writing or reviewing Terraform HCL (resources, variables, modules)
- Setting up or migrating a remote state backend
- Designing multi-environment (dev/staging/prod) Terraform layouts
- Reviewing a `terraform plan` before apply
- Investigating drift between state and real infrastructure
- Wiring Terraform into a CI/CD pipeline

## HCL Fundamentals

### File Layout

```text
environments/
  prod/
    main.tf
    variables.tf
    outputs.tf
    backend.tf
    terraform.tfvars      # non-secret values only, committed
  staging/
    ...
modules/
  network/
    main.tf
    variables.tf
    outputs.tf
  app-service/
    main.tf
    variables.tf
    outputs.tf
```

- One root module per environment; shared logic lives in `modules/`.
- Never hand-edit files under `.terraform/` — regenerate with `terraform init`.

### Resources, Variables, Outputs, Locals

```hcl
# variables.tf — typed, documented, no secrets as defaults
variable "environment" {
  type        = string
  description = "Deployment environment name (dev, staging, prod)"
}

variable "instance_count" {
  type        = number
  description = "Number of application instances"
  default     = 2
}

# locals.tf — computed values, naming conventions
locals {
  name_prefix = "padam-${var.environment}"
  common_tags = {
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# main.tf — resources reference variables/locals, never hardcoded literals
resource "aws_instance" "app" {
  count         = var.instance_count
  ami           = data.aws_ami.app.id
  instance_type = "t3.medium"
  tags          = merge(local.common_tags, { Name = "${local.name_prefix}-app-${count.index}" })
}

# outputs.tf — expose values other modules/environments consume
output "instance_ids" {
  value       = aws_instance.app[*].id
  description = "IDs of the provisioned app instances"
}
```

## Providers

```hcl
terraform {
  required_version = ">= 1.9.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.60"
    }
  }
}

provider "aws" {
  region = var.aws_region
  default_tags {
    tags = local.common_tags
  }
}
```

- Pin provider versions with `~>` — never leave `required_providers` unversioned.
- Commit `.terraform.lock.hcl` — it locks provider checksums for reproducible plans.
- One provider block per alias; use `alias` for multi-region/multi-account setups.

## Remote State

### Backend Configuration

```hcl
# backend.tf
terraform {
  backend "s3" {
    bucket         = "padam-terraform-state-prod"
    key            = "app-service/terraform.tfstate"
    region         = "eu-west-1"
    dynamodb_table = "terraform-state-lock"
    encrypt        = true
  }
}
```

- **Never commit `terraform.tfstate` or `.tfstate.backup`** — add to `.gitignore` unconditionally.
- Use a remote backend (S3+DynamoDB, Terraform Cloud, Azure Storage, GCS) for every
  team-shared environment — local state is single-user only.
- Enable **state locking** (DynamoDB table, GCS object lock, or backend-native
  locking) so two `apply` runs cannot corrupt the same state concurrently.
- Enable encryption at rest on the state backend (`encrypt = true`, KMS key).
- Restrict IAM/RBAC access to the state bucket — state contains resource
  attributes and can include secrets in plaintext (see Secrets below).

## Modules

```hcl
# root main.tf — consume a reusable module
module "network" {
  source = "../../modules/network"

  environment = var.environment
  cidr_block  = "10.0.0.0/16"
}

module "app_service" {
  source = "../../modules/app-service"

  environment = var.environment
  vpc_id      = module.network.vpc_id
  subnet_ids  = module.network.private_subnet_ids
}
```

- Modules should be self-contained: own `variables.tf`/`outputs.tf`, no
  assumptions about caller-defined locals.
- Version pinned modules from a registry with `version = "~> 2.0"`.
- Keep a module focused on one concern (network, database, app-service) —
  avoid one giant "everything" module.

## Workspaces & Environments

Two valid patterns — pick one per repo, do not mix:

1. **Directory-per-environment** (recommended for divergent configs): each
   environment is its own root module with its own backend key/state file.
   Clear blast-radius isolation; explicit `tfvars` per environment.
2. **Terraform workspaces** (`terraform workspace new staging`): same root
   module, state partitioned by workspace name. Suits near-identical
   environments; riskier if a `plan` runs against the wrong workspace —
   always run `terraform workspace show` before `apply`.

```bash
terraform workspace new staging
terraform workspace select staging
terraform workspace show   # verify before any apply
```

## Standard Workflow

```bash
terraform init                          # download providers/modules, configure backend
terraform validate                      # syntax + internal consistency check
terraform plan -out=tfplan               # compute diff, save it
terraform apply tfplan                   # apply the exact saved plan (no re-diff)
terraform destroy                        # tear down — never run against prod without confirmation
```

- Always `plan` before `apply`; in CI, apply only the **saved plan file** from
  the reviewed `plan` step — never re-plan implicitly at apply time (avoids
  TOCTOU drift between review and execution).
- `terraform destroy` on a shared/prod state requires explicit human
  confirmation outside of automation — never wire `destroy` into an
  unattended pipeline for production.

## Drift Detection

```bash
terraform plan -refresh-only            # show what changed out-of-band, no resource changes
terraform apply -refresh-only            # sync state to match real infra (after review)
```

- Schedule a periodic (e.g. nightly) `plan -refresh-only` in CI to detect
  manual console changes before they cause a surprising `apply`.
- Investigate every drift before accepting it — it usually means someone
  bypassed Terraform (console click-ops) or an external process mutated the
  resource.

## Data Sources

```hcl
data "aws_ami" "app" {
  most_recent = true
  owners      = ["self"]

  filter {
    name   = "name"
    values = ["app-*"]
  }
}
```

- Use `data` blocks to reference resources Terraform does not manage
  (shared VPCs, existing AMIs, pre-provisioned secrets) instead of
  hardcoding IDs.

## Dependencies

### Implicit vs Explicit

```hcl
# Implicit — Terraform infers order from the reference
resource "aws_instance" "app" {
  subnet_id = aws_subnet.private.id   # dependency inferred automatically
}

# Explicit — use depends_on only when there is no attribute reference
resource "aws_instance" "app" {
  depends_on = [aws_iam_role_policy_attachment.app_policy]
}
```

- Prefer implicit dependencies (attribute references) — they are what
  Terraform's graph understands natively.
- Use `depends_on` only for side-effect ordering with no direct attribute
  link (e.g. an IAM policy attachment that must complete first).

### `for_each` vs `count`

| Use `count` when | Use `for_each` when |
| --- | --- |
| Identical resources, index-based | Resources keyed by a stable identifier (name, map key) |
| List has no natural key | Set/map of distinct values |
| Order/identity of instances doesn't matter | Adding/removing a middle item must not reshuffle others |

```hcl
# count — reshuffles state indices if an item is removed from the middle
resource "aws_iam_user" "team" {
  count = length(var.usernames)
  name  = var.usernames[count.index]
}

# for_each — stable per-key state address, safe to add/remove any element
resource "aws_iam_user" "team" {
  for_each = toset(var.usernames)
  name     = each.value
}
```

`count` on a list causes resource recreation/renumbering when an item is
removed from anywhere but the end — this is the single most common
`terraform plan` surprise in review. Default to `for_each` for any collection
that changes over time.

## Import

```bash
terraform import aws_s3_bucket.existing my-existing-bucket-name
```

- Write the matching `resource` block first (even minimal), then import —
  Terraform does not generate HCL from `import` automatically pre-1.5.
- Terraform ≥ 1.5: prefer the declarative `import` block, reviewable in a plan:

```hcl
import {
  to = aws_s3_bucket.existing
  id = "my-existing-bucket-name"
}
```

- Always run `terraform plan` immediately after an import — it must show
  **no changes**; any diff means the HCL does not yet match real config.

## Secrets

- **Never** hardcode secrets in `.tf`/`.tfvars` files — use a secrets manager
  (Vault, AWS Secrets Manager, SSM Parameter Store) via a `data` source, or
  inject through `TF_VAR_*` environment variables from CI secrets.
- State files **store all resource attributes in plaintext, including
  secrets** passed as resource arguments (e.g. a DB password set via a
  Terraform variable). This is unavoidable with local attribute values —
  mitigate by:
  - Generating secrets out-of-band (secrets manager) and referencing them by
    ARN/path rather than passing raw values through Terraform.
  - Enabling state encryption at rest and strict access control on the
    backend (see Remote State).
  - Never printing sensitive outputs — mark them `sensitive = true`.

```hcl
output "db_password" {
  value     = random_password.db.result
  sensitive = true    # redacted from CLI output, still present in state
}
```

- `sensitive = true` hides a value from CLI/log output — it does **not**
  encrypt or omit it from the state file itself.

## CI Integration

```yaml
# .github/workflows/terraform.yml
name: Terraform

on:
  pull_request:
  push:
    branches: [main]

jobs:
  plan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: hashicorp/setup-terraform@v3
      - run: terraform init
      - run: terraform validate
      - run: terraform plan -out=tfplan
      - uses: actions/upload-artifact@v4
        with:
          name: tfplan
          path: tfplan

  apply:
    needs: plan
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment: production   # require manual approval gate
    steps:
      - uses: actions/checkout@v4
      - uses: hashicorp/setup-terraform@v3
      - run: terraform init
      - uses: actions/download-artifact@v4
        with:
          name: tfplan
      - run: terraform apply tfplan
```

- Run `plan` on every PR and post the diff as a PR comment (`terraform plan`
  output, or a tool like `tfcmt`/`atlantis`) — reviewers approve
  infrastructure changes the same way they approve code.
- Gate `apply` behind a manual approval environment for production.
- Never let CI apply against an unreviewed, freshly re-computed plan — always
  apply the artifact produced by the reviewed `plan` step.

## Common Pitfalls

```text
# WRONG — shared state, no locking: two engineers running apply
# simultaneously can corrupt state or race-overwrite each other's changes
terraform {
  backend "local" {}   # fine for solo experiments only, never for a team
}

# WRONG — secret passed as a plain variable, ends up in plaintext state
variable "db_password" {
  type    = string
  default = "hunter2"        # never do this
}

# WRONG — count on a list that changes: removing "bob" reshuffles
# alice(0)/carol(2) into alice(0)/carol(1), forcing unwanted recreation
variable "usernames" {
  default = ["alice", "bob", "carol"]
}
resource "aws_iam_user" "team" {
  count = length(var.usernames)
  name  = var.usernames[count.index]
}
```

- State partially committed to git history (even once) — treat every secret
  it ever contained as compromised; rotate.
- Missing lock table/backend locking on a team-shared backend.
- `terraform apply` without a preceding reviewed `plan` in CI.
- `count` used on a collection whose membership changes — use `for_each`.
- Provider/module versions left unpinned — breaks reproducibility on the
  next `init`.

## Checklist

- [ ] Remote backend configured with locking and encryption at rest
- [ ] `.gitignore` excludes `*.tfstate`, `*.tfstate.backup`, `.terraform/`
- [ ] Provider and module versions pinned; `.terraform.lock.hcl` committed
- [ ] No secrets in `.tf`/`.tfvars`; sensitive outputs marked `sensitive = true`
- [ ] `for_each` used instead of `count` for any mutable collection
- [ ] `depends_on` used only where no implicit attribute dependency exists
- [ ] CI runs `plan` on every PR; `apply` applies the reviewed plan artifact
- [ ] `apply`/`destroy` against production gated behind manual approval
- [ ] Periodic `plan -refresh-only` scheduled to catch drift
- [ ] `terraform import` followed by a no-diff `plan` to confirm HCL match
