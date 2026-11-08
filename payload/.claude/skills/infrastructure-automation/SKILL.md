---
name: infrastructure-automation
description: Infrastructure as Code (IaC) using declarative configuration management. Covers resource models, idempotent manifests, module-based abstractions, agent/master and standalone architectures, hierarchical data lookup, secrets management, and cloud provisioning patterns. Tool-agnostic framework applicable to Puppet, Ansible, Terraform, and similar tools.
origin: Puppet 5 Beginner's Guide (3rd Edition), Packt Publishing
---

# Infrastructure Automation

Declarative infrastructure management, idempotent configuration, and reproducible deployments.

## Prerequisites (preflight)

Requires **ansible** (bin: ansible-playbook). Verify before use; warn if missing:

```bash
command -v ansible-playbook >/dev/null 2>&1 || echo "WARN: ansible not installed — install: pipx install ansible"
```

## When to Activate

- Configuring multiple servers with identical or templated state
- Automating cloud resource provisioning (instances, networking, storage)
- Managing secrets and configuration data across environments
- Building reusable infrastructure components (modules/playbooks/stacks)
- Enforcing desired state rather than imperative step-by-step scripts
- Reducing drift and manual configuration errors
- Onboarding a new environment (staging, DR site) that must match production exactly

## Why Declarative, Not Shell Scripts

Ad-hoc shell scripts describe a *sequence of actions*; IaC manifests describe a *desired end
state*. The difference matters at scale:

- **Repeatability:** a script that installs a package fails the second time if it does not
  check whether the package already exists. A declarative resource states `package: ensure
  => installed` and the tool figures out whether anything needs to happen.
- **Documentation as a side effect:** the manifest itself is the up-to-date description of
  what a server should look like — no separate wiki page to fall out of sync.
- **History:** manifests live in Git, so every change to infrastructure has an author, a
  timestamp, and a diff — the same discipline as application code.
- **Cross-platform abstraction:** "the curl package should be installed" compiles down to
  `apt`, `yum`, or `dnf` depending on the target OS; you do not write OS-specific branches
  by hand.

Rule of thumb: if you find yourself writing `if [ -f /etc/foo ]; then ... fi` to avoid
re-running a step, you are reimplementing idempotence badly — reach for a declarative tool
instead.

## Declarative vs. Procedural

IaC tools operate in **declarative** mode: you specify *what* the desired state should be,
and the tool compares current state to desired state, making only the necessary changes.
Unlike procedural scripts (bash, Python), declarative manifests are:

- **Idempotent:** applying the same manifest repeatedly produces identical results, with no
  side effect on a second or third run.
- **Self-documenting:** the manifest reads as a specification of system requirements.
- **Portable:** a manifest for package X works across operating systems without hand-written
  OS-specific logic.
- **Testable:** you can validate configurations before applying them (dry-run / plan mode).

Example mindset: instead of "run this series of shell commands," you declare "the curl
package should be installed; the www-data user should exist with home directory /var/www."

## Resources & Attributes

Configurations are built from **resources** (entities like packages, files, users, services,
cloud instances) and their **attributes** (properties like file ownership, package version,
port number).

- **Resource types:** package, file, user, group, service, cron job, cloud instance, network
  interface, firewall rule.
- **Attributes/properties:** each resource type has specific attributes (e.g., file: owner,
  mode, content, source).
- **Ensure/present/absent:** the common state pattern (install package → `ensure: installed`;
  delete user → `ensure: absent`; open port → `ensure: present`).
- **Dependency ordering:** resources can declare relationships (`require`, `before`,
  `notify`) so the tool applies them in the right order and restarts dependent services
  when a config file changes.

A resource declaration specifies the type, name, and desired attributes. The tool handles
platform-specific implementation details (APT vs. YUM, systemd vs. init.d, security-group
API calls, etc.) — you never write that logic yourself.

```puppet
# Puppet — declare a package, a config file, and a service, wired together
package { 'nginx':
  ensure => installed,
}

file { '/etc/nginx/nginx.conf':
  ensure  => file,
  source  => 'puppet:///modules/webserver/nginx.conf',
  require => Package['nginx'],
  notify  => Service['nginx'],
}

service { 'nginx':
  ensure => running,
  enable => true,
}
```

```yaml
# Ansible — same intent, imperative-looking syntax but idempotent execution
- name: install nginx
  apt:
    name: nginx
    state: present

- name: deploy nginx config
  copy:
    src: nginx.conf
    dest: /etc/nginx/nginx.conf
  notify: restart nginx

- name: ensure nginx is running
  service:
    name: nginx
    state: started
    enabled: true
```

```hcl
# Terraform — cloud resource, same declarative contract at a higher altitude
resource "aws_instance" "web" {
  ami           = "ami-0abcdef1234567890"
  instance_type = "t3.micro"
  tags = {
    Name = "web-server"
  }
}
```

All three snippets express the same idea: *this is the desired state; make it so.* The
syntax and target (host config vs. cloud resource) differ; the contract does not.

## Modules & Reusability

Production infrastructure uses **modules** (Puppet), **roles/playbooks** (Ansible), or
**modules/stacks** (Terraform) — packaged, reusable collections of resources, templates,
and metadata. Benefits:

- Encapsulate best practices and complex logic behind a simple interface (parameters in,
  configured system out).
- Reduce duplication across environments (dev/staging/prod use the same module with
  different parameter values).
- Enable dependency management and version pinning (r10k/Puppetfile, Ansible Galaxy
  requirements.yml, Terraform Registry + `required_providers`).
- Simplify testing — a module can be unit-tested in isolation before being composed into a
  full environment.

Modules can be single-purpose (manage Nginx, configure SSH, provision a database) or
domain-specific (an entire web stack). Publicly maintained module repositories exist for
most common tools: Puppet Forge, Ansible Galaxy, Terraform Registry. Prefer a
well-maintained public module over writing one from scratch, but pin its version — an
unpinned dependency is a silent breaking change waiting to happen.

## Agent/Master vs. Standalone

Two deployment models, present under different names in every major tool:

**Agent/Master** (Puppet agent + Puppet server, Chef client + Chef server): a central
server stores all configurations and compiles the desired state per node. Agents on each
node check in periodically (e.g. every 30 minutes), fetch their compiled catalog, and apply
it. Pros: centralized control, audit trail, enforced convergence even without a human
triggering a run. Cons: single point of failure, network dependency, more infrastructure
to operate.

**Standalone/Masterless** (`puppet apply`, Ansible without AWX/Tower, Terraform run from
CI): each node (or a CI runner) applies configuration locally, pulling manifests via Git or
another versioning system, with no central server required. Pros: decentralized, resilient
to a single outage, simpler to reason about. Cons: manual or CI-driven synchronization
across nodes; no built-in periodic drift-correction unless you add one (cron + `apply`,
a scheduled pipeline).

Both are equally valid. Ansible is push-based and agentless by default (SSH from a
control node) but can adopt the pull model via `ansible-pull`. Terraform is inherently
standalone/CI-driven — there is no long-running "Terraform agent" on managed cloud
resources, only optional remote state locking. Choose based on team size, network
topology, and how much you are willing to operate versus consume as a managed service.

## Hierarchical Data Lookup

Manifests should not hardcode environment-specific values (a hostname in staging vs.
production, a package version, a feature flag). Most mature IaC tools separate **code**
(the module logic) from **data** (the values that vary per node/environment/role), looked
up through a hierarchy:

- **Hiera** (Puppet): a YAML-based hierarchy — e.g. `nodes/<hostname>.yaml` →
  `environment/<env>.yaml` → `common.yaml` — where the most specific file wins, and
  modules call `lookup('key')` instead of hardcoding a value.
- **`group_vars/` / `host_vars/`** (Ansible): the same hierarchy concept — variables scoped
  by group or by individual host, merged with defined precedence rules.
- **`.tfvars` files + workspaces** (Terraform): per-environment variable files
  (`prod.tfvars`, `staging.tfvars`) selected at plan/apply time.

The principle is universal: **write the module once, parameterize it through data**. A
module that only works for one environment is not reusable — that is a code smell,
regardless of tool.

## Secrets & Encrypted Data

Secrets (API keys, passwords, SSH keys, database credentials) must never appear as
plaintext in code, manifests, or version control. IaC tools provide mechanisms for this:

- **Encrypted data in the hierarchy:** `hiera-eyaml` (Puppet) encrypts individual YAML
  values in place so the encrypted file can still be committed to Git.
- **Vault integration:** `ansible-vault` encrypts whole files or variables; Terraform and
  Puppet both integrate with HashiCorp Vault or a cloud KMS (AWS Secrets Manager, GCP
  Secret Manager) for dynamic secret retrieval at apply time.
- **Environment variables at runtime:** injected by the CI/CD pipeline or the orchestrator,
  never written to disk in the repo.
- **Per-node secret injection during provisioning:** cloud-init user-data, instance
  metadata services, or a bootstrap step that fetches secrets from a vault before the main
  configuration run.

Best practice: store secrets **encrypted** in your version-controlled data files, and
decrypt them only at runtime when applying configuration — never decrypt to a
plaintext file left on disk. Rotate the encryption/vault key on the same schedule as the
underlying secrets policy.

## Cloud Provisioning

IaC tools can provision cloud resources directly — instances, VPCs, security groups, load
balancers, managed databases, storage buckets. This enables:

- Infrastructure defined in code, version-controlled alongside application code.
- Reproducible environment setups across development, staging, and production — a new
  environment is `terraform apply` (or equivalent), not a runbook followed by hand.
- Rapid cluster scaling and disaster recovery — rebuild the entire stack from the manifest
  in a new region if the primary region fails.
- Integration of infrastructure and application deployment workflows in the same pipeline
  (provision the VM, then configure it, then deploy the app — often three tools chained:
  Terraform → Ansible/Puppet → application deploy step).

Define resource templates, iterate over data (a list of node names, a count parameter) to
spawn multiple instances, and manage the full infrastructure lifecycle declaratively —
including safe teardown (`terraform destroy`, decommissioning a Puppet node) as a
first-class, tested operation, not an afterthought.

## Common Pitfalls

- **Confusing declarative with imperative:** writing manifests as if they were scripts,
  with order-dependent steps and implicit sequencing that breaks when resources are
  reordered or run in parallel.
- **Ignoring idempotence:** custom scripts (`exec`/`shell` resources) that recreate a
  resource unconditionally every run instead of checking current state first.
- **Hardcoding secrets:** plaintext credentials committed to manifests or `.tfvars` files.
- **Monolithic manifests:** one giant file instead of modules/roles, leading to duplicated
  logic and merge conflicts across teams.
- **Skipping validation:** applying configuration directly to production without a
  dry-run/plan step (`puppet parser validate`, `ansible --check`, `terraform plan`).
- **Not versioning infrastructure:** treating IaC as throwaway or ad-hoc, losing the audit
  trail that is the entire point of the practice.
- **Unpinned module/provider versions:** a module update upstream silently changes behavior
  on the next run.
- **Manual drift:** an engineer SSHes in and hand-edits a file "just this once" — the next
  automated run either reverts it silently or, worse, the drift is never noticed.
- **Overthinking the tool choice:** Puppet, Ansible, Terraform, Chef, SaltStack all solve
  IaC; pick one that fits the team's existing skills and target (host config vs. cloud
  resource), learn it well, and stay consistent.

## Checklist

- [ ] Manifests express *desired* state, not *procedural* steps
- [ ] All manual configuration removed from production nodes; managed declaratively only
- [ ] Environment-specific values externalized to a data hierarchy (Hiera / group_vars /
      tfvars), not hardcoded in module logic
- [ ] Secrets encrypted at rest and never stored plaintext in code or CI logs
- [ ] Modules/roles pinned to a specific version and tested locally before deployment
- [ ] Every apply preceded by a dry-run/plan step in the pipeline
- [ ] Infrastructure changes versioned in Git, reviewed like application code
- [ ] Teardown/decommissioning path is defined and tested, not improvised
- [ ] Team trained on the chosen IaC tool and architecture (agent/master, standalone, or
      CI-driven)
