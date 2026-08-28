---
name: session-recording
description: Use when asked to record, pause, resume, or read back Claude sessions — or when returning to a project and needing to know what the last session did. Covers the transcript recorder, its controls, and how to use the transcripts.
---

# Session recording

Renders the real session transcript to readable Markdown under
`docs/sessions/`, one file per session, plus an `INDEX.md`. Optional: it exists
only if the template was installed with `--with-recording`.

Two situations justify it.

**Transparency.** A technical interview, an audit, a client engagement — where
what the AI did must be inspectable rather than asserted. The transcript is the
evidence: every prompt, every answer, every tool call, in order. Nothing is
summarised away, so nothing can be quietly omitted.

**Continuity.** A developer who comes and goes. On the next `SessionStart` the
recorder replays the tail of the previous session as context, so returning
after two weeks does not start with re-reading your own code to remember what
you were doing.

## Controls

| Command | Effect |
| --- | --- |
| `/recording status` | current state, output directory, sessions on disk |
| `/recording on` | start recording from the next turn |
| `/recording pause` | stop writing, keep the setting |
| `/recording resume` | resume after a pause |
| `/recording off` | disable entirely |

State lives in `.claude/session-recording.json`. Editing that file by hand does
the same thing; the command exists so it can be done mid-conversation.

Pausing is the honest tool for a passage that should not be recorded — a
credential typed by mistake, an unrelated tangent. Pause, then resume. Deleting
a passage from a rendered transcript afterwards is not: a transcript that has
been edited proves nothing, which defeats the reason it exists.

## Reading one back

- `docs/sessions/INDEX.md` — every session, newest first.
- The digest injected at `SessionStart` is the tail of the previous session.
  For anything older, read the file.
- Asked what happened last time: read the most recent transcript rather than
  guessing from the code. That is what it is for.

## What it is not

- **Not a backup of Claude's own transcripts** — it renders them; the source
  stays where Claude Code keeps it.
- **Not an audit log.** It is written by a hook in the project, so anyone who
  can edit the project can edit it. It documents; it does not attest.
- **Not a secret filter.** Known key shapes are redacted — Anthropic, AWS,
  GitHub, Slack, JWT, private-key headers — and that is a net, not a guarantee.
  A password typed as prose passes straight through.

## Before committing transcripts

They contain everything that was said. **Read one before sharing it**, and
decide deliberately whether they belong in version control: committed for an
interview or an audit, gitignored when the project is private and the point is
only continuity. `/project-init` asks; the installer leaves them ignored by
default.
