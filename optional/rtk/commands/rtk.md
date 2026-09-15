---
description: Show RTK token savings for this project (rate, tokens saved, missed opportunities)
argument-hint: [gain | economics | discover | all]
---

Report RTK token savings: $ARGUMENTS (default: `gain`).

RTK exists only if the template was installed with `--with-rtk` and the `rtk`
binary is on `PATH`. If `command -v rtk` finds nothing, say so plainly — and
that enabling it means `./install.sh <project> --with-rtk` from the template,
then `rtk init` once in the repo to write RTK's own instruction block into
`CLAUDE.md`.

Otherwise run the requested view and report it as-is — do not re-summarise
numbers RTK already computed:

- **gain** (default) — `rtk gain -p`: savings rate, tokens saved and command
  count for this project.
- **economics** — `rtk cc-economics`: Claude Code spend (ccusage) set against
  what RTK saved.
- **discover** — `rtk discover`: commands in recent sessions that ran raw when
  an RTK filter existed — where more could be saved.
- **all** — run the three in order under clear headings.

If `rtk gain -p` shows zero for the project, the proxies have not been reached
for yet in this repo — point at the `rtk-savings` skill and the prefix rule
rather than treating it as a fault.
