---
description: Control the session transcript recorder — status, on, off, pause, resume
argument-hint: status | on | off | pause | resume
---

Act on the session recorder: $ARGUMENTS

State lives in `.claude/session-recording.json`. If that file does not exist,
the recorder is not installed — say so, and that installing it means running
`./install.sh <project> --with-recording` from the template.

- **status** — read the config and report: enabled, paused, output directory,
  how many transcripts exist and the date of the most recent. Say plainly
  whether the current session is being recorded.
- **on** — set `enabled: true`, `paused: false`.
- **off** — set `enabled: false`.
- **pause** — set `paused: true`, keeping `enabled` as it is.
- **resume** — set `paused: false`.

Change only the keys involved; leave the rest of the file untouched.

After any change, confirm the new state in one line and say when it takes
effect — the recorder writes at the end of each assistant turn, so a change
applies from the next turn on.

If asked to remove a passage from an existing transcript, do not do it silently:
say that an edited transcript no longer proves anything, and that pausing
before a sensitive passage is the tool for that. Delete a whole transcript if
the developer asks; never quietly alter one.
