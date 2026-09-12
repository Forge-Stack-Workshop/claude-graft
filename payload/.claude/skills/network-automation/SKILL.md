---
name: network-automation
description: Software-defined networking (SDN), network device automation via Ansible/Nornir, netmiko and NAPALM driver-based automation, Infrastructure as Code for network configuration, CI/CD pipelines for network changes, REST/NETCONF-driven network orchestration, and network testing strategies.
origin: "DevOps for Networking (Steven Armstrong, Packt Publishing)"
---

# Network Automation

Automate and orchestrate network infrastructure using SDN controllers, configuration management tools, driver libraries, and CI/CD workflows — treating network config as code, not tribal knowledge on a device.

## When to Activate

**Use when:**

- Managing network devices or SDN controllers programmatically (Cisco ACI, Nuage VSP, Juniper Contrail, VMware NSX, Arista CVX)
- Rolling out network configuration changes across multiple devices or vendors
- Choosing or wiring up an automation library (Ansible, Nornir, netmiko, NAPALM)
- Integrating network provisioning into application deployment pipelines
- Adopting Infrastructure as Code (IaC) principles for network configuration
- Testing network changes before production deployment (unit, integration, staging)
- Implementing Continuous Delivery / NetDevOps for network operations
- Building self-service network provisioning for development teams

## Key Concepts

**Software-Defined Networking (SDN)**: Centralized controllers abstract network functions via REST/NETCONF APIs and GUIs, enabling programmatic control of policies, routing, and ACLs. Controllers hold centralized state (e.g. OVSDB) and distribute it to switches (e.g. via OpenFlow). SDN turns network provisioning into an API call instead of a change-ticket-and-CLI exercise.

**NetDevOps**: The practice of applying DevOps principles — version control, code review, automated testing, CI/CD, immutable/declarative state — to network engineering. The network config lives in Git next to application code, not only in a device's running-config.

**Configuration Management with Ansible**: Push-based, agentless (SSH) automation. Playbooks orchestrate multi-step workflows; roles encapsulate reusable vendor logic; Jinja2 templates parametrize configs. Vendor modules (`cisco.ios`, `junipernetworks.junos`, `arista.eos`) issue commands or fetch state through a common declarative interface.

**Driver-based automation (netmiko / NAPALM)**: Below the playbook layer, Python libraries give direct programmatic device access:
- **netmiko** — SSH abstraction over many vendor CLIs (Cisco IOS/NX-OS/ASA, Juniper, Arista, HP, etc.). One connection API (`send_command`, `send_config_set`) instead of hand-rolled `paramiko`/pexpect per vendor.
- **NAPALM** — a *multi-vendor* driver exposing a unified API (`get_facts`, `get_interfaces`, `load_merge_candidate`, `compare_config`, `commit_config`) across IOS, IOS-XR, EOS, Junos, NX-OS. Its candidate-config + diff + commit workflow is what makes NAPALM the natural engine behind CI-driven, testable config pushes.
- Use netmiko for raw CLI scraping/automation tasks; use NAPALM when you need a config diff, a dry-run, or a rollback primitive; use **Nornir** as the Python orchestration framework (inventory + task runner) that wraps netmiko/NAPALM the way Ansible wraps its own modules — pick Nornir over Ansible when you want native Python control flow, faster execution, and unit-testable automation code.

**Infrastructure as Code (IaC) for Networks**: Network configs and desired-state models live in version control. Immutable deployments (A/B subnets, blue/green segments, cleanup pipelines) replace old configuration atomically instead of patching in place, which removes drift and makes rollback a routing decision rather than a reverse-engineering exercise.

**CI/CD Pipelines**: Network changes flow through the same pipeline discipline as application code: lint/syntax validation → render + diff against target devices → test in staging (unit + integration) → deploy to production with an automated rollback path. This removes manual "change advisory board as a bottleneck" patterns and enables continuous delivery of network features alongside app releases.

**API-Driven Orchestration**: Network devices and controllers expose REST, NETCONF/YANG, or gRPC APIs plus SDKs (Python, Java, Go). Modern switches, load balancers, and SDN controllers can be driven entirely by HTTP/RPC calls, which is what lets orchestration platforms (Kubernetes CNIs, Terraform providers) provision network segments on demand.

## Techniques

**netmiko Quickstart**: For CLI-only devices with no NETCONF/API support, netmiko is the fastest path to reliable automation.

```python
from netmiko import ConnectHandler

device = {
    "device_type": "cisco_ios",
    "host": "switch01",
    "username": "automation",
    "password": get_secret("device"),
}
with ConnectHandler(**device) as conn:
    conn.enable()
    output = conn.send_config_set([
        "interface Vlan100",
        "description app-tier",
    ])
    conn.save_config()
```

Always capture and log `output`/diff — netmiko does not compute a semantic diff for you, unlike NAPALM.

**Nornir for Python-native orchestration**: Nornir replaces the Ansible inventory+runner model with plain Python, which makes automation code unit-testable and lets it use real control flow (loops, exceptions, type hints) instead of YAML DSL workarounds. A typical stack is Nornir (inventory + task scheduling) + `nornir_netmiko` or `nornir_napalm` (execution plugin) + `nornir_utils` (result rendering). Reach for Nornir when the team is Python-first and the automation logic is complex (conditional branching, cross-device correlation); reach for Ansible when the team is ops-first and the value is in reusing a large module ecosystem with minimal custom code.

**Playbook / Task Organization**: Inventory files (or Nornir inventory) define device groups (routers, switches, firewalls) with host variables. Roles/tasks encapsulate vendor-specific logic (`roles/cisco_ios/`, `roles/juniper_junos/`) so it's reusable across projects. Keep task files simple and readable; push complex conditionals into roles or variables, not inline `when:` chains.

**Configuration Templating**: Jinja2 templates render device configs from variables (hostname, IP ranges, VLANs, ACLs). One `interfaces.j2` template plus per-device variables replaces manual copy-paste across 100 switches. Store templates in Git, lint them pre-deployment, and render-diff against the running config before applying.

**Idempotent, Diff-First Modules**: Prefer modules/APIs that declare desired state and compute a delta — Ansible's `state: present/absent` with `cisco_ios_config: match: line`, or NAPALM's `load_merge_candidate()` + `compare_config()` + `commit_config()`. Avoid raw `shell`/`raw` modules or bare netmiko `send_config_set` calls with no diff step — they apply blindly and can't guarantee idempotency or give you a dry-run.

```python
# NAPALM: dry-run a config change before committing
from napalm import get_network_driver

driver = get_network_driver("ios")
device = driver(hostname="switch01", username="automation", password=get_secret("device"))
device.open()
device.load_merge_candidate(config="interface Vlan100\n description app-tier\n")
diff = device.compare_config()
if diff:
    device.commit_config()  # or device.discard_config() to abort
device.close()
```

**Multi-Layer Testing Strategy**: Unit tests validate Jinja2 rendering and YAML syntax without touching hardware. Integration tests run playbooks/Nornir tasks against simulators (containerlab, GNS3, EVE-NG, vendor sandboxes) or NAPALM's mock driver. Staging mirrors production topology; test ACL changes, policy rollouts, and failover before production. Automated rollback tests confirm the "undo" path actually works, not just the "do" path.

**Health Checks & Monitoring**: Automate health-monitor attachment to network objects (load balancer pool members need ping/HTTP/DNS probes). SDN controllers should track policy compliance and detect drift (e.g. unauthorized ACL additions). Feed network state into the same observability stack (Prometheus/Grafana) as application metrics so network changes correlate with behavior changes.

**Immutable Infrastructure Pattern**: Replace whole network segments (subnets, security zones, LB pools) instead of patching. Bring up the new segment, cut traffic over, delete the old one. Cleanup pipelines remove orphaned ACL rules and unused objects. This removes tech-debt accumulation and makes rollback trivial: delete new, restore old.

**CI/CD Integration**: On merge request — syntax/lint checks (`yamllint`, `ansible-lint`), policy validation (no hardcoded IPs), config diff render, staging deploy, smoke tests. Production deploy requires explicit approval; post-deploy smoke tests and monitoring trigger automated rollback on anomaly.

**CI Pipeline Example**: A minimal network-config CI stage validates before it deploys.

```yaml
stages: [lint, render, test, deploy]

lint:
  script:
    - yamllint inventory/ group_vars/
    - ansible-lint playbooks/

render_and_diff:
  script:
    - ansible-playbook playbooks/site.yml --check --diff -i inventory/staging

test_staging:
  script:
    - ansible-playbook playbooks/site.yml -i inventory/staging
    - pytest tests/test_reachability.py --target staging

deploy_prod:
  script:
    - ansible-playbook playbooks/site.yml -i inventory/production
  when: manual
  environment: production
```

The `--check --diff` step is the network equivalent of `terraform plan`: it must run, and be reviewed, before any production stage is unlocked.

**SDK & REST/NETCONF Calls**: Modern controllers (Nuage VSP, Cisco ACI) expose Python/Java SDKs wrapping REST APIs; NETCONF/YANG-capable devices (IOS-XR, Junos) support model-driven config via `ncclient`. Call these directly from Ansible custom modules or Nornir tasks instead of scripting GUI clicks — this is what makes the change reproducible and reviewable.

## Pitfalls

**Versioning and Drift**: Config must live in Git with atomic commits and clear history. Manual CLI/GUI changes bypass automation and create hidden drift. Enforce drift detection (re-run playbooks/Nornir tasks in check-mode on a schedule, diff against Git), require approval workflows for urgent manual fixes, and reconcile drift in maintenance windows.

**Insufficient Testing**: Network changes interact with existing routing/ACL/QoS policy and legacy integrations. Testing only the happy path causes surprise outages (a new ACL silently blocks critical app traffic). Test policy conflicts, failover scenarios, convergence latency, and edge cases (invalid IPs, duplicate routes). Consider chaos/fault-injection testing to surface fragile assumptions.

**Vendor Lock-in**: Each SDN controller/device family has different APIs and module coverage. Coupling playbooks tightly to one vendor's quirks makes migration painful. Mitigation: abstract vendor logic behind roles/tasks with a common interface (this is exactly what NAPALM does at the driver level); design topology to stay vendor-agnostic where feasible.

**Rollback Complexity**: Network changes can block application traffic immediately. Immutable/blue-green infrastructure simplifies rollback (switch traffic back to the old subnet). Mutable in-place configs require careful reverse logic and can miss interdependencies. Always test the rollback path in staging — don't assume it works the first time it's needed in production.

**Convergence and Consistency**: Overlay networks propagate policy changes through a control plane that takes seconds to minutes. IaC tooling often assumes immediate consistency; distributed control planes lag. Wait for convergence before declaring success, and throttle rapid successive deployments — controllers can choke on high churn.

**Blind CLI Automation**: Wrapping netmiko `send_config_set()` around a raw command list with no diff/verification step reproduces manual CLI risk at automation speed — a typo now breaks every device in the batch, fast. Always pair CLI-level automation with a verification step (NAPALM `compare_config`, `get_config` before/after diff, or a post-change `get_facts`/health check).

**Organizational Resistance**: Network teams fear automation reduces headcount or introduces instability. Top-down mandates fail; bottom-up evangelism works — start with low-risk automation (backups, compliance checks, dry-run playbooks), prove value, earn trust, and turn network engineers into automation champions.

**Over-Automation**: Automating everything can hide critical infrastructure decisions. Document *why* each automation choice was made, and keep some high-blast-radius changes on manual/phased review even when automation could go faster.

## Integration Points

Network automation ties closely to infrastructure provisioning: SDN enables dynamic subnet provisioning for microservices (Kubernetes CNIs request network zones via API); IaC tools (Terraform, Ansible) trigger network provisioning alongside compute/storage; deployment pipelines chain provision-VM → create-network-segment → configure-firewall → deploy-app as one orchestrated flow.

Cross-team training matters: network engineers need Ansible/Nornir, Python, and API/NETCONF fundamentals. Pair network and platform engineers to transfer knowledge; document runbooks for on-call; budget time for the mindset shift from manual control to declarative, continuously-verified configuration.

## Vendor & Tooling Landscape

- **Cisco ACI** — fabric SDN, centralized APIC controller, REST API + Python SDK, declarative object model (Tenant/VRF/BD/EPG), Ansible modules available.
- **Nuage VSP** — overlay SDN on OpenStack, VSD controller, REST API + VSPK Python SDK, subnet-based policy model well suited to microservice isolation and dynamic provisioning.
- **Juniper Contrail** — OpenStack-integrated SDN, REST API + Python SDK, strong Heat/IaC integration.
- **Arista EOS / CloudVision (CVX)** — API-first (eAPI), Python SDK, Ansible modules; common in leaf-spine data-center fabrics.
- **Load balancers** (Citrix NetScaler, F5 BIG-IP, HAProxy) — REST APIs + Python SDKs; automate pool management, VIP provisioning, health monitors, cert rotation.
- **netmiko / NAPALM / Nornir** — Python driver and orchestration layer described above; the lightweight, code-first alternative or complement to Ansible.
- **Simulators**: containerlab, GNS3, EVE-NG, vendor sandboxes (Cisco DevNet) for integration testing without physical hardware.

## Practical Patterns

**Desired State Enforcement**: Define network config as data structures (dicts/lists) in inventory/vars, loop over devices, render/apply once per target. Idempotent modules/drivers detect and apply only the delta — a re-run (intentional or accidental) converges to desired state without re-applying unchanged config.

**Inventory Management**: Structure inventory to mirror topology — group by role (`core_switches`, `access_switches`, `firewalls`) and site (`dc_us_east`, `dc_eu_west`); use group/host variables for role- and site-specific overrides to support multi-site rollout without duplication.

**Error Handling & Logging**: Use `block:`/`rescue:` (Ansible) or try/except around driver calls (Nornir/NAPALM) for structured error handling. Log outputs (timestamps, variable values, diffs) to centralized logging (ELK, Splunk) for post-mortems. Add post-deployment health checks to catch silent failures (policy installed but endpoint unreachable).

**Blue-Green Network Deployments**: For critical changes, stand up a parallel segment (green), run smoke tests (ping, HTTP, throughput), then cut traffic over (DNS or LB). If tests fail, traffic stays on blue and rollback is instant. Especially valuable for SDN upgrades and major policy changes.

**Policy as Code**: Express ACLs/security-groups/routing policy as declarative objects, parametrized by RBAC-style groups (e.g. `admin_users -> database_servers` on port 5432 expands into concrete firewall rules/routes via a policy engine) instead of hand-written per-device rule lists.

**Automated Compliance & Auditing**: Post-deployment, run automated checks (all prod subnets default-deny, no hardcoded IPs, VLANs tagged with cost-center); export reports to security/audit; feed continuous monitoring to alert on drift.

**Disaster Recovery**: Configs in Git enable replaying playbooks/tasks against recovered infrastructure after a site failure. Immutable infra (A/B subnets) simplifies recovery — bring up the new subnet, re-run automation, cut traffic. Practice DR drills; measure and improve RTO/RPO.

## Success Metrics

- **Mean Time to Deploy**: network changes ship in hours, not days or weeks.
- **Policy Drift**: percentage of devices in desired state; target 100% (or near, with automated reconciliation).
- **Testing Coverage**: percentage of config changes validated in staging before production; target 100%.
- **Runbook Automation**: percentage of routine operational tasks automated; target 80%+.
- **Change Failure Rate / MTTR**: track like an application service — failed network changes and time-to-recover.

## Common Failure Modes & Lessons

- **Legacy device support**: older gear lacks APIs; fall back to netmiko/SSH CLI scraping with regex parsing, or manage those devices manually alongside an SDN overlay for modern infrastructure.
- **Policy interdependencies**: layered ACLs/routing/QoS have hidden interactions; one policy change can break an unrelated flow — mitigate with policy simulation, chaos testing, and stakeholder review before production.
- **Scaling test infrastructure**: unit tests are fast, real-device integration tests are slow/risky — lean on containerized simulators and mocked driver responses (NAPALM's mock driver) to keep the fast feedback loop fast.
- **Onboarding complexity**: automation needs networking + Python + API/CI-CD skills at once — mitigate with structured onboarding, hands-on labs, and pairing.

## Getting Started

1. **Assess current state** — audit existing automation, identify pain points (manual changes, slow provisioning, drift); interview teams for real bottlenecks.
2. **Pick a low-risk starting point** — device backups, compliance auditing, read-only monitoring; build credibility and show ROI (time saved, outages prevented) before touching the critical path.
3. **Invest in infrastructure** — Git + CI/CD (GitLab, GitHub Actions, Jenkins), a staging environment or simulator, centralized logging, artifact storage.
4. **Train teams** — Ansible/Nornir/netmiko/NAPALM fundamentals, Python scripting, target SDN platform, Git workflows; pair network and platform engineers to cross-train.
5. **Iterate incrementally** — automate one workflow at a time (interfaces, then ACLs, then LB pools); measure impact (deploy time, drift) before the next workflow; gather feedback often.
6. **Monitor and refine** — track deploy frequency, change failure rate, MTTR; use observability to catch drift or policy violations; keep improving based on operational feedback.
