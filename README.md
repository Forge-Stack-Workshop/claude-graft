# claude-graft

Claude template to be installed as a plugin and fit a new project. Packages all
the rules that could be found across any project.

A pre-packaged Claude Code setup: the engineering doctrine that holds across
every project, plus a command that finishes the job inside the project.

The point is not to save typing. It is to **stop losing a rule along the way** —
the convention you meant to apply and forgot to state, on the fourth project in
a row.

The template ships **half** a setup on purpose.

| Half | What it is | Where it comes from |
| --- | --- | --- |
| **Shared doctrine** | conventions, guards, skills, agents | installed as-is, identical everywhere |
| **Project specifics** | `CLAUDE.md`, real commands, permissions, thresholds | written by `/project-init`, in the project |

`/project-init` reads the codebase first, then interviews you layer by layer —
product and intent, rules and points of attention, tools and workflow, how you
want to work — recommending skills and subagents where they earn their place.
It finishes by presenting what the setup covers, what it does **not** cover, and
which rules are merely advisory versus enforced by a hook. It iterates on that
presentation until you confirm it. Producing files is not the end condition;
your agreement is.

---

## Two topologies

Both keep everything inside the project's own tree. Nothing is installed on the
machine, nothing at the user level — so one project's Claude setup can never
affect another's.

### Mono-repo — the repository carries everything

```bash
./install.sh /path/to/repo --dry              # see what would happen
./install.sh /path/to/repo                    # install
./install.sh /path/to/repo --with-recording   # + session transcripts
cd /path/to/repo && claude
/project-init
```

```
repo/
├── CLAUDE.md                 placeholder, replaced by /project-init
├── .env.example
└── .claude/
    ├── settings.json         hook wiring, each hook with its `_why`
    ├── thresholds.json       numeric limits, confirmed per project
    ├── rules/                the conventions
    ├── skills/               project-scaffold · feature-flow
    ├── agents/               flow-tracer · conformance-reviewer
    ├── commands/             /project-init /code-flow /commit /folder-readme
    ├── tools/                which-rules.py · check-template.py
    └── hooks/                the guards
```

Self-contained and auditable: the whole configuration is readable in the
repository, which is what an interview or an audit needs.

### Workspace — one Claude for a family of repositories

```bash
./install.sh --workspace /path/to/PROJECT --devkit /path/to/PROJECT/project-devkit
cd /path/to/PROJECT && claude        # launch at the ROOT
/project-init
```

**Claude lives in a repository.** The devkit is one of the project's
repositories, versioned with it — not a folder the installer invents. Point
`--devkit` at it; the Claude configuration takes one subdirectory, because such
a repository usually carries its own Makefile, docs and CI as well. If the path
is not inside a git repository the installer says so loudly: an unversioned
doctrine is what this design exists to prevent.

```
PROJECT/
├── CLAUDE.md  ->  project-devkit/claude/doctrine.md      a symlink, nothing more
├── .claude/settings.json                                 15 lines, see below
├── project-devkit/            a repository of the project — its own history
│   ├── README.md  Makefile  .github/    whatever it already carries
│   └── claude/                          the Claude slice of it, and the plugin
│       ├── doctrine.md                  the always-loaded conventions
│       ├── skills/  agents/  commands/  hooks/
│       ├── thresholds.json  folder-readme.json  convention-guard.json
│       ├── tools/                       which-rules · check-template
│       └── .claude-plugin/              plugin.json + a local marketplace
├── project-A/                 nothing. no CLAUDE.md, no .claude/
└── project-B/                 nothing
```

**The workspace root holds exactly two things**, and neither duplicates the
devkit:

- `CLAUDE.md`, a **symlink** into the devkit. The conventions have one home,
  versioned with the devkit repository and reviewed like any other change — and
  editing `doctrine.md` takes effect immediately, with no rebuild. Where
  symlinks are unavailable the installer writes an `@import` to the same file.
- `.claude/settings.json`, which does nothing but enable the plugin. It exists
  only because project settings are **not** inherited from parent directories,
  so the launch directory must carry that one fact. Its `_why` says so, and says
  not to add anything else there.

Everything the hooks read — thresholds, guard configuration, the validators —
lives in the devkit beside the doctrine it serves. The hooks resolve it through
`CLAUDE_PLUGIN_ROOT`, falling back to a repository's own `.claude/` so the same
hook code serves both topologies, and so a single repository can still override
a number if it must.

The plugin takes its name from the devkit repository, so its skills namespace as
`project-devkit:project-scaffold`. Override with `--name`.

**Claude is launched at the workspace root, never inside a member repository.**
That single decision is what keeps the repositories clean: the root is the
session's starting directory, so its `.claude/settings.json` applies and every
repository below is simply a subdirectory of one session. Nothing is
distributed, nothing to keep in sync.

The corollary is a real constraint, so it is written into `doctrine.md` itself
rather than only here: a session started deeper keeps the inherited `CLAUDE.md`
but **loses the hooks and the plugin**. Start at the root.

**Why the devkit is a plugin.** A plugin cannot carry `rules/`. But a skill
accepts the same `paths:` globs — the documentation states it "uses the same
format as path-specific rules" — so each path-scoped rule becomes a skill with
identical activation, and skills do live in plugins. The always-loaded rules go
into `doctrine.md`, which the symlink exposes.

The devkit's Claude subdirectory is **derived** from `payload/` by
`build-plugin.py`, never maintained alongside it — the same reason the dev
Dockerfile derives from the production one. Edit `payload/.claude/rules/`,
re-run `--workspace`, commit the devkit.

---

## The doctrine

**Always loaded** — `architecture` (hexagonal, the domain depends on nothing) ·
`errors` (domain versus infrastructure failures, a timeout on every outbound
call) · `configuration` (validated at startup, read once, no development-only
default) · `environment` (nothing runs on the host — build, tests and the docs
site all run in the container) · `testing` (a bug fix starts with a red test; a
feature merges with its tests) · `documentation` (a README per folder, docs ship
in the same commit) · `code-flow` (the gold book, below) · `git` (Conventional
Commits, always a branch, never commit unasked, commit = code + tests + docs) ·
`language` (English everywhere) · `security` (no secret, explicit authorization,
validate at the boundary) · `observability` (structured logs, correlated, levels
that mean something).

**Loaded only on matching files**, so they cost nothing otherwise — `python` ·
`typescript` · `class-design` · `database` (N+1 is a defect, read the plan
before indexing, constraints in the database) · `i18n` · `docker` (the
production Dockerfile stays pure, the dev image derives from it) · `makefile`
(the only human interface, targets delegate to compose) · `ci` (local and remote
are one definition of green) · `dependencies` (the lockfile is truth, scheduled
updates, CVE and licence gates) · `release` (changelog generated from the
commits, version derived, artefact promoted not rebuilt) · `frontend` ·
`mkdocs`.

### The gold book

A function is agnostic: it says what it does, never what problem it answers.
That lives in the chain of calls, and a docstring will never describe a chain —
or a gap. So the documentation site carries three things of different natures:
`docs/flows/` (hand-written: who calls what, in what order, and on failure),
`docs/coverage.md` (hand-written: what is handled, and above all what is not),
`docs/api/` (generated from docstrings: what one function does).

Shipping a behaviour without updating its flow and its coverage is not shipping
it. `/code-flow <feature>` traces the code, writes the flow document, then
reconciles the coverage file — and reports any gap between what the code does
and what coverage claimed.

---

## Rules, skills, agents, hooks — what goes where

| Nature | Goes in | Test |
| --- | --- | --- |
| A constraint to hold while writing code | rules / `doctrine.md` | declarative: "never X" |
| A multi-step procedure | `skills/` | imperative: "first this, then write that" |
| Work needing its own context | `agents/` | large fan-out, or independence from the author |
| Something that must hold regardless | a hook, or a CI gate | it survives a model that decides otherwise |

The trap this template fell into once: a rule scoped on `**/Dockerfile*` does
not load on a project that has no Dockerfile — so the doctrine explaining how to
write one was invisible exactly when it was needed. Scaffolding is a procedure.
It lives in the `project-scaffold` skill; the rule keeps only the invariant.

### What is enforced, and what is only advised

Rules are context: they shape behaviour, they do not guarantee it. Only hooks
and CI enforce. Every hook carries a `_why` saying what it protects and whether
it blocks — a hook whose reason nobody remembers is deleted by the next person
who trips over it.

**Blocked** — a secret reaching disk or a commit · a file created in a folder
with no `README.md` · a `Dockerfile.dev` repeating a pinned `FROM` instead of
deriving · a committed `.env` · a hand-edit of generated `docs/api/`.

**Warned** — size and complexity drift against `thresholds.json` · a CI workflow
that is not a thin caller of `make ci` · a Makefile recipe running a tool on the
host.

Everything else relies on the model reading the rule, and CI is where the rest
becomes a gate. `/project-init` says which is which, per project, rather than
letting you assume the whole file is binding.

**No MCP server ships with the template**, deliberately. An MCP server connects
*this project's* external systems — its database, its tracker, its monitoring —
so there is nothing generic to install. `/project-init` asks instead.

---

## Session recording — optional

`--with-recording` adds a hook that renders the real session transcript to
`docs/sessions/`, one readable file per session plus an index. It reads Claude's
own transcript rather than reconstructing from hook events, because assistant
prose appears in neither `UserPromptSubmit` nor `PostToolUse` — a reconstruction
loses half the exchange.

Two situations justify it. **Transparency**: an interview, an audit, a client
engagement, where what the AI did must be inspectable rather than asserted.
**Continuity**: on the next `SessionStart` the recorder replays the tail of the
previous session, so a developer returning after two weeks is back in context
without re-reading their own code.

Control it mid-session with `/recording status | on | off | pause | resume`.
Pausing is the honest tool for a passage that should not be recorded; editing a
rendered transcript afterwards is not, since an edited transcript proves
nothing.

Transcripts are **gitignored by default** — commit them deliberately, after
reading one. Known key shapes are redacted (Anthropic, AWS, GitHub, Slack, JWT,
private keys); that is a net, not a guarantee, and a password typed as prose
passes straight through.

Not installed at first? Re-run the installer with the flag — it adds only what
is missing and never duplicates the hook wiring.

---

## Validate it yourself

```bash
# mono-repo
python3 .claude/tools/which-rules.py .
python3 .claude/tools/check-template.py .

# workspace — the tools live in the devkit, like everything else
python3 project-devkit/claude/tools/check-template.py .
```

`which-rules` separates rules loaded every session from those whose globs match
real files, and lists the inert ones — a rule that governs a file the project
should have but does not will not fire when that file is created either.

`check-template` works on both topologies: a mono-repo's `.claude/`, or a
workspace and its devkit. It exits non-zero on a dead cross-reference,
malformed frontmatter, an unbalanced glob, a hook pointing at a missing script,
or a skill missing the `description` a plugin requires. It also warns on a rule
that reads like a procedure.

## Change the doctrine

Edit `payload/.claude/rules/`. It is the single source: the devkit is derived
from it, never maintained beside it.

Already-installed **mono-repos** do not update themselves — the template is a
starting point, not a live dependency, and a project's rules should not change
under it without a commit. A **workspace** is different by design: `CLAUDE.md`
is a symlink, so editing `doctrine.md` in the devkit applies at once, and
re-running `--workspace` refreshes the derived skills and hooks.
