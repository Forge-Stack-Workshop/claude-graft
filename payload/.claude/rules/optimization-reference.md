# Claude Code Optimization Reference

**Applies to:** `.claude/**`, `CLAUDE.md`, `settings.json` (meta — configuration doctrine)

A curated catalogue of Claude Code optimizations, hooks, and tooling worth knowing when
tuning this template or a project that consumes it. Split into **embeddable** (agnostic,
already or safely shippable here) and **reference** (useful but depends on an external
binary/service — invoke, don't vendor). Nothing project-specific is hardcoded; hooks read a
versioned config, values stay configurable.

______________________________________________________________________

## Configuration optimizations (embeddable)

- **Scope = starting directory.** Launch `claude` at the level whose files and `CLAUDE.md`
  you actually need; project settings are not inherited from parent directories.
- **Tiered `CLAUDE.md`** — root (global rules), per-package, per critical feature. Children
  inherit parents.
- **Path-scoped rules** — a `.claude/rules/*.md` file with a glob `Applies to:` when the same
  rule governs scattered paths.
- **`permissions.deny`** — hard stop on secret reads (`.env*`, `secrets/**`, `*.pem`, `*.key`,
  `id_rsa*`, `.ssh`, `.aws`, `.kube`, `.netrc`, `.npmrc`, `*credentials*`) and on vendored /
  generated reads (`dist/`, `build/`, `vendor/`, `*.generated.*`). Shipped in `settings.json`.
- **`permissions.ask`** — a human beat before outward/irreversible commands: `git push
  --force`, `git reset --hard`, `git clean`, `sudo`, `npm publish`, `docker push`,
  `gh release create`. Shipped in `settings.json`.
- **`includeCoAuthoredBy: false`** — history stays human-authored (no AI trailer). Shipped.
- **`statusLine`** — agnostic `statusline.sh` (dir · branch · model · style), degrades if
  `jq`/`git` absent. Shipped.
- **`claudeMdExcludes`** (globs) — skip `CLAUDE.md` of packages never touched; put in
  `settings.local.json` (gitignored), values project-specific.
- **Worktrees** — `worktree.sparsePaths` (include `.claude` to keep root settings),
  `worktree.symlinkDirectories` (symlink `node_modules`/deps instead of copying).
- **`additionalDirectories` / `--add-dir`** — reach a neighbour package; set
  `CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD=1` to also load its `CLAUDE.md`.
- **No hardcoded home paths** — always `~/`, never a literal username, in any shipped config.

## Hooks (embeddable patterns)

- **SessionStart** — recommend the zone's plugin / inject orientation on stdout before the
  first prompt.
- **Stop → `CLAUDE.md` update** — after a response, re-read the transcript and propose
  `CLAUDE.md` edits while the gap is fresh.
- **PreCompact** — preserve context before a compaction.
- **PostToolUse(Bash) error tracker** — record command failures for later triage.
- **Contract is unstable** — hooks must **fail open** and `log_and_continue` on an unknown
  payload field. Never let a hook error block the session.
- Already shipped here: `secret-scanner`, `verifiable-thresholds`, `graphify-sync`,
  `graphify-hint`, `enforce-spec-plan` (opt-in), `frustration-detection`, `git-safety-guard`,
  `convention-guard`, `folder-readme-guard`, `memory-consolidation`, `model-debt-inventory`.

## Tooling (reference — external dependency, invoke don't vendor)

- **rtk** — token-optimizing output proxy (`rtk ls/tree/read/git/gh/psql…`). See the
  `rtk-token-proxy` skill. Needs the `rtk` binary.
- **AgentShield** (`npx ecc-agentshield scan`) — security scan of Claude configs (CLAUDE.md,
  hooks, MCP, settings): rule set + secret patterns + hook-injection + MCP risk. No install.
- **Native OpenTelemetry** — Claude Code emits usage, tool spans, and provider cost via OTLP
  env vars. Prefer this to a home-grown collector.
- **claude-code-prompt-optimizer** — rewrites a raw prompt into Task/Context/Output sections
  with IMPORTANT/MUST/NEVER markers. Third-party; validate before adopting.
- **mirador** (`mirador setup --hooks`) — opt-in machine-level hook collector (tool execution
  + context-window occupancy) to an SSE stream. Observability, not template content.
- **Language LSP plugins** (`pyright-lsp`, `typescript-lsp`) — jump-to-def/refs via a language
  server instead of scanning the repo. Per-language, install as a plugin.

## Meta-skills worth adopting (agnostic)

- **skill authoring / evaluation** — `writing-skills`, `skill-creator`, `eval-skills`,
  `eval-rules`; sharpen a skill's `description` (the usual cause of under-triggering).
- **`skill-observer`** (shipped) — turn a session into reviewable skill improvements.
- **`update-config` / `fewer-permission-prompts`** — tune `settings.json`; cut permission
  prompts safely.
- **Auto-trigger discipline** — check for a relevant skill *before* a task, as a gate rather
  than a suggestion.

## Explicitly out of scope for an agnostic template

- Stack-specific skills (django/fastapi/postgres/game engines, per-language LSP).
- Personal daemons or endpoints (localhost relays, org-specific agents).
- Heavy external memory/governance systems bundled wholesale — cherry-pick the pattern
  (e.g. 3-layer memory recall: index → context → detail), don't vendor the system.

______________________________________________________________________

Source: consolidated from the workspace's Claude Code optimization notes. Treat entries as
pointers; verify a binary/plugin still exists before recommending it in a session.
