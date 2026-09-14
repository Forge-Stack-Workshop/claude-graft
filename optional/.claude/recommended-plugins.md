# Recommended plugins & MCP — optional

A curated, **reference-only** shortlist for a high-signal Claude Code setup. It
installs nothing by itself: `install.sh --with-recommendations` drops this file
plus `recommended-mcp.json` into a project's `.claude/` so the setup is
documented and reproducible. Every entry is a **public** plugin or a token-free
MCP server — no secrets are ever shipped.

Install a plugin with:

```bash
claude plugin marketplace add <owner/repo>     # once per marketplace
claude plugin install <name>@<marketplace>
```

## Marketplaces

| Marketplace | Source |
| --- | --- |
| `claude-plugins-official` | `anthropics/claude-plugins-official` |
| `anthropic-cybersecurity-skills` | Anthropic cybersecurity skills |
| `skills-for-architects` | architecture skill pack |
| `ui-ux-pro-max-skill` | `nextlevelbuilder/ui-ux-pro-max-skill` |
| `firecrawl` | Firecrawl web extraction |
| `gitkraken` | GitKraken hooks |
| `caveman` | caveman output style |

## Plugins worth enabling

### Core engineering (recommended everywhere)
- `claude-md-management@claude-plugins-official` — audit & align CLAUDE.md across repos.
- `skill-creator@claude-plugins-official` — author, improve and eval reusable skills.
- `pr-review-toolkit@claude-plugins-official` — test/silent-failure/type/comment reviewers.
- `code-review@claude-plugins-official`, `code-simplifier@claude-plugins-official` — diff review + quality cleanup.
- `pyright-lsp` / `typescript-lsp @claude-plugins-official` — language-server code intelligence (add `csharp-lsp` where relevant).
- `security-guidance@claude-plugins-official` — secure-by-default guidance.
- `superpowers@claude-plugins-official` — brainstorming, planning, TDD, subagent-driven dev.

### Per-domain (enable where it earns its place)
- `frontend-design@claude-plugins-official`, `ui-ux-pro-max@ui-ux-pro-max-skill` — UI/UX.
- `notion@claude-plugins-official`, `sentry@claude-plugins-official` — connectors (provide their own MCP tools).
- `firecrawl@firecrawl` — web scraping/extraction.
- `cybersecurity-skills@anthropic-cybersecurity-skills` — security testing skill pack.
- `as@skills-for-architects` — architecture/site-planning skills.
- `gitkraken-hooks@gitkraken`, `caveman@caveman` — git hooks / output style.

### External agent pack (optional reference, NOT vendored here)
- `msitarzewski/agency-agents` (MIT) — 300+ role subagents. Add as its own
  marketplace if you want them; this repo does not copy them into `payload/` to
  stay agnostic and avoid vendoring a third-party tree.

## MCP servers

Most MCP capability arrives **through plugins** above (Notion, Sentry, Firecrawl
each register their own MCP tools). The token-free standalone servers worth
adding directly live in `recommended-mcp.json`:

- `skillsmith` — skill authoring helper (stdio, npx).
- `claude-code-guide` — Claude Code reference (stdio, npx).

> Servers requiring a credential (Home Assistant, any hosted HTTP endpoint) are
> intentionally omitted. Add them locally with your own token; never commit it.
