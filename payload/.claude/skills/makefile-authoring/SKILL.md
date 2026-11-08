---
name: makefile-authoring
description: Write clean, self-documenting GNU Makefiles as the single command interface — modular includes, `##` help targets, required-var checks, .PHONY hygiene, and safe recipe patterns.
origin: authored
---

# Makefile Authoring

Make is a project's single, user-facing command interface. Golden rule: if a developer needs
a special shell command, wrap it in a Make target. A Makefile should be **self-documenting**,
**modular**, and **safe** — never a dumping ground of ad-hoc recipes.

## Prerequisites (preflight)

Requires **make**. Verify before use; warn if missing:

```bash
command -v make >/dev/null 2>&1 || echo "WARN: make not installed — install: apt install make (or Xcode CLT / build-essential)"
```

## When to Activate

- Creating or restructuring a project's `Makefile`.
- Adding a developer/CI command (tests, lint, build, migrations, docker, deploy).
- A README documents a raw shell command instead of a `make <target>`.
- Reviewing a Makefile for help coverage, `.PHONY`, variable safety, or portability.

## Structure — one entry point, modular includes

Keep a thin root `Makefile` that includes domain files. Never point users at a sub-Makefile.

```
Makefile                     # only entry point, includes everything
makefiles/
  variables.Makefile         # global vars (paths, docker, colors)
  functions.Makefile         # reusable macros
  tests.Makefile
  quality.Makefile
  docker.Makefile
  database.Makefile
```

```makefile
include makefiles/variables.Makefile
include makefiles/functions.Makefile
include makefiles/tests.Makefile
include makefiles/quality.Makefile

.DEFAULT_GOAL := help
```

## Self-documenting help (mandatory)

Every user-facing target carries a `##` comment on the same line. A single `help` target parses
them. Put expected input variables in brackets after the description.

```makefile
help:  ## List all targets with descriptions
	@grep -E '^[a-zA-Z0-9._-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort \
	  | awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2}'

tests: ## Run the test suite => [target_test={pytest args}]
	@$(PYTEST) $(target_test)
```

- Parser pattern: `^[a-zA-Z0-9._-]+:.*?## (.*)$`. One line, concise, per target.
- Targets without `##` are intentionally hidden from `make help`.

## .PHONY and target hygiene

- Declare every non-file target `.PHONY` (targets that don't produce a file of their name).
- Prefer one `.PHONY` per target next to it, or a grouped block — stay consistent.
- Real file targets (artifacts) should list their prerequisites so Make can skip rebuilds.

```makefile
.PHONY: tests lint build clean
```

## Variables — safety and overrides

- Global vars in `makefiles/variables.Makefile`; domain vars at the top of their file.
- Use `?=` for user-overridable defaults, `:=` for immediate (non-recursive) assignment.
- Pass inputs as `make <target> var=value` — never a path to a sub-Makefile.
- Guard mandatory variables with a macro; fail fast with a clear message.

```makefile
define check_required_vars
$(foreach var,$(1),$(if $($(var)),,$(error Variable $(var) is required)))
endef
# usage inside a recipe target:
migrate: ## Apply migrations => [app={app_label}]
	$(call check_required_vars,app)
	$(MANAGE) migrate $(app)
```

- Export env vars explicitly when a sub-process needs them: `export VAR := ...`.

## Recipe rules that avoid foot-guns

- **Tabs, not spaces**, indent recipe lines (a classic `missing separator` error otherwise).
- Prefix commands with `@` to silence echo; keep it for noisy or trivial commands only.
- Each recipe line runs in its own shell — chain with `&&` or set `.ONESHELL:` when you need
  shared state across lines.
- Fail loudly: rely on Make's default (`-e`); for pipes add `set -euo pipefail` in `.ONESHELL`.
- Quote variables that may contain spaces/paths: `"$(BUILD_DIR)"`.
- Use `$$` to emit a literal `$` (shell variables, awk): `$$1`, `$${HOME}`.

## Reusable macros / functions

Factor shared shell logic into `makefiles/functions.Makefile` instead of duplicating:

```makefile
define docker_run
	$(DOCKER_COMPOSE) run --rm $(1) $(2)
endef

shell: ## Open an app shell
	$(call docker_run,app,bash)
```

## Docker logs / long-running targets

- Use long flags for clarity in shared targets: `--follow` (not `-f`).
- Suppress container-name prefixes with `--no-log-prefix`.
- Never leave a stray positional arg between `logs` and its flags.

```makefile
logs: ## Tail service logs => [service={name}]
	@$(DOCKER_COMPOSE) logs --no-log-prefix $(service)

logs-f: ## Follow service logs => [service={name}]
	@$(DOCKER_COMPOSE) logs --no-log-prefix --follow $(service)
```

## Portability

- Target GNU Make; document it if you rely on GNU-only features (`$(shell ...)`, `$(foreach)`,
  pattern rules). BSD make differs.
- Prefer POSIX shell in recipes; set `SHELL := /bin/bash` only when you need bash features.
- Don't hardcode absolute paths or report locations — put them in variables at the top.

## Common pitfalls (reject in review)

- A README/script documents a raw command instead of a `make` target.
- Target missing its `##` help comment (invisible in `make help`).
- Spaces instead of a tab before a recipe line (`missing separator`).
- Hardcoded path/artifact location instead of a variable.
- `docker compose logs -f` instead of `--follow`, or missing `--no-log-prefix`.
- Referencing a sub-Makefile path directly in a user-facing command.
- Non-file target not declared `.PHONY` (breaks when a same-named file exists).

## Checklist

- [ ] Single root `Makefile`, `.DEFAULT_GOAL := help`, domain files under `makefiles/`.
- [ ] Every user target has a `##` description; `make help` renders cleanly.
- [ ] `.PHONY` on all non-file targets.
- [ ] Mandatory vars guarded (`check_required_vars`); overridable defaults use `?=`.
- [ ] Recipes use tabs, quote paths, `$$` for literal `$`, chain with `&&`.
- [ ] Shared logic factored into macros; no duplicated shell blocks.
- [ ] Long flags (`--follow`, `--no-log-prefix`) in docker log targets.

## Verification

```bash
make help            # every target documented, sorted, aligned
make -n <target>     # dry-run: inspect the expanded recipe
make --warn-undefined-variables <target>   # catch typos in var names
```
