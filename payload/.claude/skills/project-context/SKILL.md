---
name: project-context
description: Use at the start of work in an unfamiliar repository, or whenever you are unsure which project you are in, which stack it uses, or which standards and optional modules apply — identifies the repo from its git remote and on-disk markers, names the family it belongs to, and states which profile, skills and rules to load, without changing anything.
---

# Knowing which project this is

Before the first edit, know three things: **which project** this is, **which
stack** it runs, and **which standards** apply. Guessing any of them is how the
wrong convention gets applied to the right code. This skill reads the repository
and states the answer; it never writes.

Read in this order — each step only runs if the previous one left the question
open.

## 1. Identify the repository

```
git remote get-url origin   # the org and repo name are the identity
git branch --show-current
```

The **org** in the remote is the family key. If there is no remote (a scaffold,
a scratch clone), fall back to the directory name and say the identity is
provisional.

## 2. Map to a family and profile

| Git org | Family | Graft profile | Notes |
| ------- | ------ | ------------- | ----- |
| `chrysa` | chrysa fleet (~110 repos) | `chrysa-fleet` | Hub = chrysa-lib. Standards in `shared-standards`. |
| `Easter-Eggs-Farm` | Easter-Eggs-Farm | `easter-eggs` | Config lives in `egg-manager/dev-kit/` (symlinked). |
| `frogscollective` | frogscollective | `frogs` | Spec-driven; no `.claude` yet — bootstrap needs care. |
| `Rural-Assistant-Integration-Nature` | RAIN | `rain` | **Read-only for config: do not modify RAIN's Claude setup or its `rain-devkit`.** |
| `Optiways` | padam-av (employer) | — | **Separate. Never distribute the perso ecosystem here.** It has its own `padam/.claude` + `padam-claude-skills`. |

If the org matches none of these, say so and treat it as an unknown project:
detect the stack (step 3), apply only the CORE payload, and ask before assuming
a standard.

## 3. Detect the stack

Read markers, do not infer from the family:

- `manage.py` → Django · `pyproject.toml` with fastapi dep → FastAPI ·
  `pyproject.toml` alone → Python package/CLI
- `package.json` → read it: React 19 / Vite / Tailwind, or a plain node tool
- `*.uproject` / `ProjectVersion.txt` → Unreal / Unity
- `strawberry` in deps → GraphQL · `psycopg`/`asyncpg` + `alembic/` → Postgres +
  Alembic · `PostGIS`/`geoalchemy` → spatial
- `Dockerfile` / `docker-compose*.yml` → containerised · `*.tf` / `helm/` /
  `k8s/` → infra

State the stack as what the markers show, and name the disagreements (a model
that a migration contradicts, a dep declared but unused) — those are findings,
not noise.

## 4. State which modules apply

From family + stack, name the optional graft modules to load:

- Django or FastAPI → `tech-python` (django-*, fastapi-patterns,
  python-testing, senior-python-reviewer, django-migration-forensics)
- React/Vite/Tailwind → `tech-frontend` (react-patterns, frontend-design,
  one design-system)
- Dockerfile / k8s / tf → `tech-infra`
- Any user-facing input, auth, DB, upload, or network change → `security`
  (non-negotiable per the global CLAUDE.md security mandate)
- A review or a PR → `review` (one code-review, one simplify)

Do not load a module the markers do not justify. CORE stays minimal; the point
is to load the rest on demand, not up front.

## 5. Announce, then stop

Report one short block and take no other action:

```
Project:  <repo>  (org: <org>)  — family: <family>
Branch:   <branch>   Stack: <stack, one line>
Profile:  <profile>   Modules: <the ones from step 4>
Standards: <shared-standards | dev-kit STANDARDS | none — bootstrap needed>
Watch:    <the one gotcha that matters here, from memory if known>
```

Then do the task the person actually asked for, with those modules in mind. If
any of the five lines is a guess, mark it as a guess — a provisional identity
stated honestly is useful; a confident wrong one is not.
