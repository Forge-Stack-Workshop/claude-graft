# `.claude/hooks/`

## Role

Executable hooks (Node `.cjs`) that Claude Code runs on lifecycle events, plus a
few standalone CLI maintenance tools. They are the mechanical backstops for the
doctrine in `.claude/rules/` — enforced at the moment an action happens, not left
to the agent to remember.

## Structure

Event hooks (wired in `../settings.json`):

| File | Event | Effect |
| ---- | ----- | ------ |
| `secret-scanner.cjs` | PreToolUse (Write/Edit/MultiEdit/Bash) | **Blocks** writing or committing a known secret shape |
| `folder-readme-guard.cjs` | PreToolUse (Write/Edit/MultiEdit) | **Blocks** creating a file in a folder with no `README.md`; warns on edits |
| `convention-guard.cjs` | PreToolUse (Write/Edit/MultiEdit) | Blocks never-intentional writes; warns on maybe-deliberate ones |
| `git-safety-guard.cjs` | PreToolUse (Bash) | **Denies** destructive git (force push, `+`refspec, hard reset, branch `-D`, remote-branch delete, `clean -f`, `checkout -f`) |
| `circuit-breaker.cjs` | PreToolUse (Bash) | Denies an external API call whose per-endpoint circuit is OPEN |
| `frustration-detection.cjs` | UserPromptSubmit | Injects a style adjustment on frustration/continuation markers (FR/EN); never blocks |
| `graphify-sync.cjs` | PostToolUse (Write/Edit/MultiEdit) | Fire-and-forget `graphify update .` to keep the code graph current |
| `verifiable-thresholds.cjs` | PostToolUse (Write/Edit/MultiEdit) | Warns on size/complexity drift vs `../thresholds.json` |

Standalone CLI tools (run manually, **not** wired as event hooks):

| File | Invocation |
| ---- | ---------- |
| `memory-consolidation.cjs` | `node memory-consolidation.cjs [--dry-run] [--dir <path>]` |
| `model-debt-inventory.cjs` | `node model-debt-inventory.cjs [--dir <path>] [--json]` |

Configuration precedence for all of them: env var > `../config/hooks-config.json`
> built-in default. The config file is optional; every hook degrades to a safe
default when it is absent.

## Should contain

Small, dependency-free `.cjs` hooks and CLI tools that enforce or maintain the
`.claude/` doctrine. Each reads stdin (event hooks) or argv (CLI tools), writes a
recognized hook payload to stdout, and exits 0 unless it deliberately blocks.

## Should NOT contain

Application code (belongs in the project's own source tree), anything importing a
third-party package (hooks stay dependency-free so they run on a bare Node), or a
tool signature / assistant name in the file body — see `../rules/git.md`.

## Rules

- `../rules/git.md` — no tool signature anywhere, including in these files.
- `../rules/documentation.md` — this README exists because of it.
- `../rules/security.md` — no secret in the repo; `secret-scanner.cjs` is a net, not a permit.

## Known gaps

- `circuit-breaker.cjs` only reads the circuit state as a PreToolUse hook; nothing
  records call outcomes yet, so a circuit never transitions to OPEN on its own. A
  PostToolUse companion calling `recordSuccess`/`recordFailure` is required for the
  breaker to actually trip. Its state file is also rewritten without locking, so
  concurrent Bash calls can clobber each other's counts.
- `memory-consolidation.cjs` deduplication rewrites files in place with no backup;
  run it with `--dry-run` first.
