---
name: user-feedback-triage
description: >-
  Transforms raw user feedback from any source (Sentry, Discord, Notion,
  GitHub comments, direct messages) into structured, triaged backlog items
  with impact classification and routing. TRIGGER when: user shares feedback
  to process, asks to triage a batch of reports, or runs /triage-feedback.
  DO NOT TRIGGER for internal technical issues found during dev (use review
  or hunt skill instead).
origin: chrysa
model: claude-sonnet-4-5
---

# User Feedback Triage

Convert raw feedback from any channel into structured, actionable backlog items.

## When to Use

- Processing Sentry error reports after a deploy
- Triaging Discord feedback from users
- Converting Notion comment threads into issues
- Batch-processing GitHub issue comments
- Weekly feedback review (part of `sunday-personal-recap`)

## Sources & Ingestion

### Sentry Reports

```bash
# Get recent errors for a project
gh run view <sentry-webhook-run-id>  # if automated
# Or: read Sentry dashboard URL from user
```text

Capture: `error_type`, `frequency`, `first_seen`, `affected_users`, stack trace snippet.

### Discord Messages

User provides text dump or URL. Extract: user handle, timestamp, message text.

### Notion Comments

```text
mcp_notion_API-retrieve-a-block  # on the page with comments
```text

### GitHub Issue Comments

```bash
gh issue view <N> --repo chrysa/<repo> --comments
```text

## Triage Protocol

### Step 1 — Classify Each Feedback Item

| Type | Description | Example |
|---|---|---|
| `bug` | Something broken, unexpected behavior | "button doesn't work" |
| `ux` | Confusing, slow, frustrating (not broken) | "this is hard to find" |
| `feature` | Request for new capability | "I wish it could do X" |
| `perf` | Speed/resource complaint | "it takes 10s to load" |
| `question` | Needs docs, not a code fix | "how do I set up X?" |
| `noise` | Out of scope, already fixed, duplicate | — |

Discard `noise`. Route `question` to docs backlog.

### Step 2 — Impact Score

For each non-noise item:

```text
Impact = Severity × Frequency × User Reach
```text

| Dimension | Low (1) | Medium (3) | High (5) |
|---|---|---|---|
| **Severity** | Annoyance | Workflow blocked | Data loss / crash |
| **Frequency** | Rare (1-2 reports) | Occasional (3-10) | Common (10+) |
| **User Reach** | Power user only | Subset of users | All users |

Priority from Impact score:

- P0: ≥ 50 — immediate fix
- P1: 25-49 — next sprint
- P2: 10-24 — backlog
- P3: < 10 — icebox

### Step 3 — Deduplication

Before creating issues:

```bash
gh issue list --repo chrysa/<repo> --search "<keywords>" --state open
```text

If duplicate found: add a comment linking the new report, increment frequency count in issue body.

### Step 4 — Route Each Item

| Type | Destination |
|---|---|
| P0 bug | Immediate issue + `@post-deploy-observer` if post-deploy |
| P1/P2 bug | GitHub issue, `bug` label, milestone: next sprint |
| ux / perf | GitHub issue, `improvement` label, invoke `@ux` or `@arch` |
| feature | Invoke `@idea-to-backlog` for full RICE validation |
| question | Update README/docs, close without issue |

### Step 5 — Feedback Loop Log

After triage, log summary to Notion (Ops Tasks DB or project page):

```text
Date: YYYY-MM-DD
Source: <Sentry / Discord / Notion / GitHub>
Items: N total (N bug, N ux, N feature, N noise)
Issues created: #N1, #N2, ...
```text

## Output Format

```text
## Feedback Triage Report

**Source**: <Sentry / Discord / Notion / GitHub comments>
**Batch**: N items processed | Date: YYYY-MM-DD

### Summary
| Type | Count | Created | Deduped | Discarded |
|---|---|---|---|---|
| bug | N | N | N | N |
| ux | N | N | N | N |
| feature | N | N | N | N |
| noise | N | — | — | N |

### Issues Created
- [#N](<url>) **<title>** — P0/P1/P2 | <type> | Impact: XX
- ...

### Deduped (added to existing)
- [#N](<url>) — +1 report (now N total)

### Noise / Discarded
- "<quote>" — reason: already fixed / out of scope / spam

### Next Actions
- <any P0 requiring immediate escalation>
- <patterns noticed across multiple items>
```text
