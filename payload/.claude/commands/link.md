---
description: Link a Shortcut story, GitHub PR and Sentry issue together (create missing ones on confirm), in the standardized Padam-AV way
argument-hint: "[sc-<id> | #<pr> | <sentry-url>]"
---

# Link — Sentry ⇄ Shortcut ⇄ PR orchestrator

Takes any one entry point (Shortcut story, GitHub PR, or Sentry issue — or
nothing, auto-detected) and produces a fully linked, standardized triplet
`{sentry, shortcut, pr}`. Idempotent, dry-run by default, never writes before
an explicit confirmation.

**TL;DR:** `input → hydrate state → print numbered plan → wait for y → apply
links`. Nothing is written until you confirm.

Slash command usage:

```
/link sc-3512
/link #3506                                   (or full PR URL)
/link https://sentry.io/.../issues/456789
/link                                         (auto-detect from current branch)
```

### Flags

| Flag | Effect |
|---|---|
| *(none)* | Diagnose + print plan, then wait for `y` (default, safe). |
| `--yes` / `-y` | Skip the confirmation prompt and apply the plan directly. |
| `--dry-run` | Print the plan and exit without writing, even after `--yes`. |
| `--no-rename` | Never rename the branch; standardize metadata only. |

Flags are additive; `--dry-run` always wins over `--yes`.

## Golden rules

- **Never write before confirmation.** Always print the diagnosis + numbered
  plan, then STOP and wait for the user's `y` (or edits). Dry-run is default.
- **Idempotent.** Re-running must not duplicate links, comments or fields —
  hydrate current state first and skip already-present links.
- **`gh` account.** Resolve the account that has Optiways org access (see
  "Multiple accounts" below), then export
  `GH_TOKEN=$(gh auth token -u <org-authorized account>)` before any
  `gh`/GitHub API call — a personal account without org access will 403.
- **Secrets.** Read tokens from env, never hardcode, never echo them into logs
  or the transcript:
  - Shortcut: `PADAM_SHORTCUT_API_TOKEN`, header `Shortcut-Token`,
    base `https://api.app.shortcut.com/api/v3`.
  - Sentry: try `SENTRY_AUTH_TOKEN` (bearer). If unset, detect at runtime and
    ask the user for the token/org/project slug rather than guessing.
- **No `repo:*` labels.** Classify via custom fields. Only **Skill Set** has a
  known `field_id`; **Product Area** must be discovered at runtime via
  `GET /custom-fields` — if not found, skip it and warn (never guess an id).
- Respect `.claude/rules/pull-requests.md` and `.claude/rules/secrets-config.md`.

## First launch — setup & per-project token scoping

On the **first run**, before anything else, check that the three tokens resolve.
If any is missing, run this guided setup instead of the normal flow.

### What each token is and how to get it

| Service | Env var | Where to create it | Minimal scope |
|---|---|---|---|
| Shortcut | `PADAM_SHORTCUT_API_TOKEN` | Shortcut → Settings → **API Tokens** → Generate. Header sent as `Shortcut-Token`. | Workspace-wide (Shortcut tokens are not scopable per resource) |
| GitHub | *(via `gh`)* | Handled by `gh auth login` with the account that has Optiways org access. No PAT needed — the command uses `gh auth token -u <org-authorized account>`. | `repo` (read/write PRs) |
| Sentry | `SENTRY_AUTH_TOKEN` (+ `SENTRY_ORG`, `SENTRY_PROJECT`) | Sentry → Settings → **Auth Tokens** → Create. | `event:read`, `project:read`, `event:write` (for comments) |

### Multiple accounts on the same PC

This machine may run **1 or 2 identities** (e.g. a work account and a personal one),
each with its own Claude config dir and possibly a **renamed settings file**
(the project has been seen under `~/.claude` and `~/.claude-pro/...`). Tokens
differ per account, so setup must resolve the *active* identity and never
clobber the other account's file.

Resolve the active identity + settings target, in order:

1. **Active gh account:** `gh auth status --active` (or the account matching the
   git user `git config user.email`). Shortcut/Sentry tokens are personal — use
   the ones belonging to that account.
2. **Settings file to read/write:** prefer `$CLAUDE_CONFIG_DIR` if set; else the
   dir Claude launched from. The per-project settings file is
   `.claude/settings.local.json` by default, but accept an **alternate/renamed**
   file — detect any `.claude/settings.local*.json` and, if several exist, ask
   which one maps to the active account (never assume). Store the chosen path so
   re-runs reuse it.
3. **Per-account keying:** if both accounts share the same
   `.claude/settings.local.json`, do NOT overwrite a sibling account's tokens.
   Key them by account under `env`, e.g.
   `PADAM_SHORTCUT_API_TOKEN__<account>`, and at runtime read the var
   matching the active account (falling back to the unsuffixed name). Prefer,
   though, one settings file per account so plain env var names work.

Whatever the filename, the same gitignore check applies: confirm the target is
gitignored before writing (`git check-ignore <path>`), and never assume a
renamed file is ignored — verify it.

### How to scope them PER PROJECT (not globally)

Prefer project-local, gitignored config so tokens never leak into the repo and
stay bound to `padam-av` only. Two supported options:

1. **Claude Code project settings (recommended)** — put the vars in
   `.claude/settings.local.json` (already gitignored) under an `env` block.
   They apply only to Claude sessions opened in this project:

   ```json
   {
     "env": {
       "PADAM_SHORTCUT_API_TOKEN": "<token>",
       "SENTRY_AUTH_TOKEN": "<token>",
       "SENTRY_ORG": "padam",
       "SENTRY_PROJECT": "padam-av"
     }
   }
   ```

2. **direnv (`.envrc`)** — for use outside Claude too. First add `.envrc` to
   `.gitignore` (it is NOT ignored by default in this repo — verify with
   `git check-ignore .envrc`), then `export PADAM_SHORTCUT_API_TOKEN=...` and
   run `direnv allow`. Scoped to this directory tree.

Never place these in the committed `.env` / `.env.example`, in shell rc files
(that makes them global), or anywhere tracked by git.

### Setup procedure (when a token is missing)

0. Resolve the active identity + settings target (see "Multiple accounts"
   above) before probing tokens, so the right account's vars are checked.
1. Detect which of the three resolve (probe env; for GitHub run
   `gh auth status -a`). List exactly what is missing.
2. For each missing one, print the creation URL + minimal scope from the table
   above and ask the user to paste the token (or run the `gh auth login`
   suggestion via `! gh auth login`).
3. Offer to write the values into `.claude/settings.local.json` (option 1).
   Confirm the file is gitignored before writing. Never echo the token back.
4. Verify each token with a cheap read call (`GET /member` for Shortcut,
   `gh api user`, `GET /api/0/` for Sentry) and report ✓/✗ per service.
5. Once all three verify, continue to the normal flow below.

## Instructions for Claude Code

### 1. Normalize the entry point

Type the argument, or auto-detect when empty:

- `sc-\d+` or `app.shortcut.com/padamav/story/<id>` → Shortcut id.
- `#\d+` or `github.com/.../pull/<n>` → PR number.
- `sentry.io/.../issues/<id>` → Sentry issue id.
- Empty → auto-detect: current branch (`git branch --show-current`, extract
  `sc-\d+`), then the open PR (`gh pr view --json number,body,headRefName`),
  then any Sentry link found in the PR body / last commit.
  - **Limitation:** with no Shortcut id in the branch and no Sentry link in the
    PR body/commit, Sentry cannot be auto-detected — pass its URL explicitly.

### 2. Hydrate every known link (read-only)

- **Shortcut:** `GET /stories/{id}` → `external_links`, `branches`,
  `custom_fields`, `iteration_id`, `workflow_state_id`, `owner_ids`.
- **PR:** `gh pr view <n> --json number,title,body,headRefName,url,state`.
- **Sentry:** `GET /api/0/issues/{id}/` (bearer) → `title`, `culprit`,
  `permalink`, `shortId`, `tags`.

### 3. Diagnose and print the plan (then STOP)

Show which links are `✓ present`, `✗ missing`, `⚠ desynced`, then a numbered,
confirmable plan. Example:

```
État : Sentry ✓  Shortcut ✗  PR ✓ (#3506, branch feature/foo)
Plan :
 1. Créer story Shortcut (workflow Av development, iteration courante,
    Skill Set déduit, description = résumé Sentry + PR)
 2. Rename branche → feature/sc-XXXX-foo   [voir règle rename ci-dessous]
 3. PR body : bloc Related → "Shortcut: sc-XXXX" + lien Sentry
 4. Story : external_links += [PR, Sentry] ; state → in review ; iteration ; owner
 5. Sentry : commentaire renvoyant vers sc-XXXX
Confirmer ? (y / éditer)
```

Do nothing until the user answers `y` (or `--yes` was passed; `--dry-run`
stops here regardless).

### 4. Branch rename rule (standardize to `type/sc-ID-slug`)

- **No PR yet:** rename local + push (`git branch -m`, `git push -u origin
  <new> :<old>`) — safe.
- **PR already open:** DO NOT rename — renaming the head ref breaks the PR.
  Warn, keep the branch, standardize only body/ticket/Sentry. Rename would
  require closing/reopening the PR; never do that without explicit request.
- Rename always appears in the confirmable plan, never silent.
- Branch type prefix from Conventional Commit/branch type: `feat*→feature/`,
  `fix*→fix/`, `hotfix*→hotfix/`, else keep existing prefix.

### 5. Create missing links (only after `y`, only what the plan listed)

- **Shortcut story** (`POST /stories`): name from Sentry/PR title,
  description = short summary + Sentry permalink + PR url, `group_id`
  `634d5bb3-3902-4646-8ad1-b08701bc0ec3` (team AV), workflow `Av development`
  (500042975). Before creating, `GET /search/stories?query=...` to avoid
  duplicates; if a close match exists, surface it and ask.
- **PR:** if the plan calls for creating one, defer to the `/pr-description`
  command for the body (matching `.github/PULL_REQUEST_TEMPLATE/`), then
  `gh pr create`. Fill the `Related` block with `Shortcut: sc-ID`.

### 6. Standardized linking (idempotent writes)

| Link | Write |
|---|---|
| PR → Shortcut | `Shortcut: sc-ID` in PR body `Related` block (`gh pr edit --body`) |
| Shortcut → PR | `external_links += [PR url]`; branch `sc-ID` auto-links too |
| Sentry → Shortcut | `external_links += [Sentry permalink]` on the story |
| Shortcut → Sentry | `POST /api/0/issues/{id}/comments/` with story url |
| Shortcut fields | `PUT /stories/{id}`: `iteration_id` (see resolution below), `owner_ids`, custom field **Skill Set** (`field_id 634d5bb3-6753-4010-a519-e77f4c99c90f`; Backend `634d5bb3-a08b-4d3b-b6e5-4e4d4ea67699`, Frontend `634d5bb3-eaf5-4d78-ab31-ad71f58467d5`), **Product Area** (runtime-discovered, skip if absent), workflow state |

Deduce Skill Set from PR paths (`.py`/Django → Backend, front dirs → Frontend).
Before each write, check the target list/field; skip if already set.

**Iteration resolution:** `GET /iterations`, pick the one with
`status == "started"` whose `[start_date, end_date]` contains today. If none is
started today, do NOT write `iteration_id` — warn and leave it unset (never
guess an iteration).

### 7. Report

Print the final linked state with clickable URLs (story, PR, Sentry) and list
any items skipped because they were already present or deferred (e.g. rename
blocked by an open PR).

## Worked example

```
$ /link #3506

Résolution : PR #3506 (branch feature/kpi-recompute) → sc dans body : aucun
Hydrate    : PR ✓  Shortcut ✗  Sentry ✗

État : Sentry ✗  Shortcut ✗  PR ✓ (#3506)
Plan :
 1. Créer story Shortcut « schedule territory KPI recompute cron »
    (group AV, workflow Av development, Skill Set=Backend, iteration courante)
 2. --no-rename absent, mais PR ouverte → rename ignoré (warn)
 3. PR body : bloc Related → "Shortcut: sc-NEW"
 4. Story : external_links += [PR #3506]
Confirmer ? (y / éditer)  y

✓ Story créée : https://app.shortcut.com/padamav/story/3600
✓ PR body mis à jour (Shortcut: sc-3600)
✓ Story external_links += PR #3506
⚠ Rename ignoré : PR déjà ouverte (feature/kpi-recompute conservée)
⚠ Sentry : aucune issue liée fournie — étape sautée
```

## Limits — what this command does NOT do

- Never merges, closes, or reopens a PR.
- Never renames a branch that already has an open PR (would break the head ref).
- Never creates a Shortcut iteration; only assigns an existing started one.
- Never guesses a custom-field id (Product Area) or an iteration.
- Shortcut API tokens are workspace-wide — cannot be scoped per repo.

## Error handling

- **Invalid/expired token** → stop before any write, point to the setup section.
- **Multiple Shortcut duplicates** on `GET /search/stories` → list them, ask
  which to reuse; never auto-create over an ambiguous match.
- **Rate limit / network error** → stop and report; writes are ordered so a
  failure leaves a consistent, resumable state (re-run is idempotent).
- **Partial failure mid-plan** → report which steps succeeded; re-running skips
  the already-applied links.

## See also

- `/pr-description` — build the PR body from the diff + repo template.
- `/reviewpr` — review a PR before merge.
- `.claude/rules/pull-requests.md`, `.claude/rules/secrets-config.md`.
