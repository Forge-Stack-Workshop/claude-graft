---
description: Scaffold or update the README.md of a folder, per the documentation rule
argument-hint: <path/to/folder>
---

Write or update `README.md` for: $ARGUMENTS

Read the folder's actual contents first — describe what is there, never a
template filled with plausible guesses. Follow the structure in
`.claude/rules/documentation.md`:

1. **Role** — why this folder exists, one or two sentences.
2. **Structure** — a table of subfolders and key files, and what each is.
3. **Should contain** — what belongs here.
4. **Should NOT contain** — what must never land here, and where it goes instead.
5. **Rules** — conventions governing this folder. Link to the rule files rather
   than restating them.

Keep it scannable. If you cannot state what a file is for, say so explicitly
rather than inventing a purpose.
