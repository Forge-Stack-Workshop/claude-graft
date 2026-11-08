---
name: release-ritual
description: Semantic versioning, release automation, tag hygiene, changelog and release notes, feature flags, rollback, and go-to-market gates for production releases.
origin: "Codeship — Best Practices when Versioning a Release (Matthew Setter); Semantic Versioning 2.0.0 (semver.org)"
---

# Release Ritual

A structured release strategy — versioning, tagging, branching, automation,
communication, and rollback — that removes ambiguity about what changed, who
is affected, and how to undo it. Works for any product: library, API,
container image, mobile app, or internal service.

## When to Activate

- Planning a release cycle (alpha → beta → stable).
- Deciding when to bump MAJOR, MINOR, or PATCH.
- Integrating CI/CD for automated tagging, changelog, and deployment.
- Writing release notes or a changelog entry for stakeholders.
- Introducing or graduating a feature flag.
- Implementing or rehearsing a rollback strategy.
- Managing multi-environment promotion (dev → staging → canary → production).
- Auditing a project that uses date-based versions, marketing names, or
  inconsistent tags.

## Semantic Versioning (SemVer)

Use `MAJOR.MINOR.PATCH` (e.g. `1.5.3`). Never date-based (`2024.09.09`),
marketing names ("Thunderbird"), or ad hoc ordinals ("v9.1").

Given `MAJOR.MINOR.PATCH`, increment:

- **MAJOR** — incompatible changes. Consumers must adapt.
  Example: `1.0.0` → `2.0.0` when dropping a deprecated endpoint.
- **MINOR** — backward-compatible feature additions. Old clients keep working.
  Example: `1.0.0` → `1.1.0` when adding a new API method.
- **PATCH** — backward-compatible bug fixes.
  Example: `1.5.2` → `1.5.3` for a critical fix.

Prerelease and build metadata extend the format: `2.0.0-beta.1`,
`2.0.0-rc.1`, `1.5.3+build.20260909`.

### Initial development (0.y.z)

Start at `0.1.0` and increment MINOR for each subsequent pre-stable release.
Anything in `0.y.z` may change at any time — the public contract is not
yet guaranteed.

### When to release 1.0.0

Never wait for perfection. Release `1.0.0` when:

- The software runs in production.
- Users depend on a stable, documented API contract.
- The team commits to backward compatibility for the `1.x` line.

Real-world examples of SemVer in the wild: Firefox `57.0.4` (4th patch of
major 57), Chrome `63.0.3239` (3239th patch of major 63), Mac Mail `11.2`
(2nd minor of major 11).

## Core Release Practices

### 1. Automated tagging

Tag every release in git with an annotated tag carrying release metadata:

```bash
git tag -a v1.5.0 -m "Release 1.5.0 — new dashboard UI, performance improvements"
git push origin v1.5.0
```

CI/CD should:

- Trigger builds only on tag creation (`git push origin v*`), never on
  ordinary branch commits.
- Build and push artifacts (container image, package, wheel) tagged with the
  exact version, plus `latest` only for stable releases.
- Auto-generate release notes from commit history (`gh release create --generate-notes`,
  Conventional Commits changelog tooling, etc.).
- Sign or checksum release artifacts if the ecosystem supports it (Sigstore,
  GPG, SLSA provenance).

### 2. Release branches

For releases needing stabilization, cut a short-lived branch:

```bash
git checkout -b release/1.5.0
# final tests, backport hotfixes only — no new features
git push origin release/1.5.0
```

Merge back to the trunk/integration branch after verification. Avoid
long-lived release branches — they fragment history and cause painful merges.
For most teams shipping continuously, tagging trunk commits directly is
simpler and preferable; reserve release branches for genuinely long
stabilization windows (e.g. mobile app store review, hardware firmware).

### 3. Changelog & release notes

Keep a `CHANGELOG.md` (e.g. Keep a Changelog format) updated per PR/merge, not
retrofitted at release time. Release notes are a curated, narrative
presentation of that changelog — not a raw commit dump.

Structure:

- **New Features** — use cases and user benefit, not internal names.
- **Bug Fixes** — impact and workaround if one exists, with issue/ticket links.
- **Breaking Changes** — explicit migration path for consumers.
- **Deprecations** — what's deprecated and the removal timeline (commonly
  MINOR + 2 releases).
- **Security** — severity, CVE ID if applicable, upgrade urgency.

```
## 1.5.0 (2026-09-09)

### New Features
- Dashboard now shows real-time metrics (beta)
- API rate limits increased to 10k/min for authenticated clients

### Bug Fixes
- Fixed memory leak in WebSocket reconnection (#1234)
- Corrected timezone conversion for Europe/London (#1235)

### Deprecations
- `GET /v1/users/{id}/settings` deprecated, use `GET /v2/users/{id}/profile`.
  Removal planned for 2.0.0.

### Security
- CVE-2026-1234: SQL injection in search — upgrade immediately
```

Publish release notes alongside the tag (GitHub/GitLab Releases, in-app
changelog, mailing list). For breaking or security releases, push the
notification proactively (email, blog, chat) — do not wait for users to find
it themselves.

### 4. Feature flags

Feature flags decouple deployment from release, letting risky or incomplete
work ship dark and roll out gradually.

- Gate incomplete or risky code behind a flag so it merges to trunk
  continuously without exposure.
- Default new flags **off**; flip on for internal/canary users first, then
  percentage rollout, then 100%.
- Name flags by capability, not by ticket ID (`new-dashboard-metrics`, not
  `SC-4821`).
- Every flag needs an owner and a removal date — a flag left on for months
  becomes permanent hidden branching logic and untested code paths.
- Combine with SemVer deliberately: a flagged feature shipping dark does not
  require a MINOR bump; flipping it on for all users generally does, since it
  changes observable behavior.
- Record flag state changes in the changelog when they affect all users
  ("Feature X now enabled by default").

### 5. Rollback strategy

Plan the rollback before the release ships, not during an incident.

- Keep the previous N release artifacts available and deployable at all
  times (container tags, package versions).
- Prefer flag-based rollback (flip off) over redeploy when the change is
  flag-gated — it's faster and avoids a second risky deploy.
- For deploy-based rollback, `kubectl rollout undo`, redeploy the previous
  tag, or re-point traffic to the last-known-good release — decide the exact
  command per platform ahead of time, not live.
- Data migrations must be backward-compatible with the previous code version
  during the rollback window (expand/contract pattern): add columns/fields
  before removing old ones, never a single destructive migration tied to the
  same release as the code that depends on it.
- Rehearse rollback at least once per major release in a non-prod
  environment; an untested rollback plan is not a rollback plan.
- Document the rollback trigger criteria (error rate threshold, failed health
  check, manual kill switch) so the decision isn't made under panic.

### 6. Five core considerations

1. **API stability** — every MAJOR marks a backward-incompatible break;
   consumers must adapt, and old versions should remain available for a
   transition period.
2. **Deprecation path** — always give users time: deprecate in a MINOR,
   remove in the next MAJOR (e.g. deprecated in `1.5`, removed in `2.0`).
3. **Consistent versioning** — every artifact of a release (container image,
   package, API version header, mobile build number) shares the same
   version number.
4. **Rollback access** — keep previous releases deployable; see above.
5. **User communication** — communicate what changed, why, and what to
   expect; publish a release cadence and stick to it (see Communication
   below).

## Communication & Cadence

- **Explain the scheme.** Tell users you use SemVer and what it means,
  in docs and release announcements — non-technical users won't infer it.
- **Publish a release schedule and honor it.** An erratic cadence (one
  release after 6 months, the next after 3 years) erodes trust regardless of
  version-numbering discipline.
- **Never skip or reuse a version number.** Skipping (`1.4` → `1.6`) signals
  a hidden bad release; reusing one destroys traceability.
- **Communicate every release**, not just majors: what's new, what's fixed,
  what's improved, what's deprecated.
- **Ask for feedback** on the versioning/release process itself periodically
  — it's for the users' benefit, not an internal ritual.

## Release Gates & Automation

### Pre-release checklist

- [ ] All tests pass (unit, integration, E2E).
- [ ] No hardcoded secrets or credentials in the diff or build artifacts.
- [ ] Code review approved.
- [ ] Security scan cleared (dependency audit, SAST).
- [ ] Changelog updated and release notes drafted.
- [ ] Version bump agreed and justified (MAJOR/MINOR/PATCH).
- [ ] Every release artifact tagged with the same version.
- [ ] Rollback path confirmed available (previous artifact deployable, or
      flag flip ready).
- [ ] Feature flags for this release have an owner and removal date.

### Automated release pipeline (example)

```yaml
on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build and push image
        run: docker build -t myapp:${{ github.ref_name }} .
      - name: Push to registry
        run: docker push myapp:${{ github.ref_name }}
      - name: Create release with notes
        run: gh release create ${{ github.ref_name }} --generate-notes
      - name: Deploy to production
        run: kubectl set image deployment/app app=myapp:${{ github.ref_name }}
```

Trigger deployments only on tags, never on arbitrary branch commits. Gate
production deployment behind manual approval for MAJOR releases or any
release touching data migrations.

## Anti-Patterns & Pitfalls

- **Date-based versioning** (`2026.09.09`) — breaks SemVer semantics;
  consumers can't infer compatibility from the number.
- **Marketing names or ordinals** ("Rocket", "v9.1") — don't tell users
  whether they can skip a version or must upgrade immediately.
- **Removing features without deprecation** — breaking changes with zero
  notice destroy trust.
- **Skipping a version number** (`1.4` → `1.6`) — signals instability; users
  assume `1.5` was a bad release hidden from them.
- **Releasing without release notes** — users guess what changed; support
  load spikes.
- **Tagging from the wrong branch/commit** — risks shipping stale or
  unreviewed code to production.
- **No automated rollback plan** — manual rollback improvised during an
  incident means delays and mistakes.
- **Flags left on indefinitely** — untested/unowned flags accumulate into
  permanent hidden branches and dead code paths.
- **Inconsistent artifact versions** — package says `1.5.0`, container image
  still tagged `1.4.2`: users can't trust either number.
- **Destructive migration coupled to the same release as dependent code** —
  breaks rollback; use expand/contract instead.

## Summary

Semantic versioning gives a concise, machine-readable signal of change scope.
Pair it with disciplined tagging, a maintained changelog, feature flags for
safe rollout, a rehearsed rollback plan, and proactive user communication.
Together these reduce surprises, speed adoption, and build confidence in the
release process — for any product, not just one ecosystem.
