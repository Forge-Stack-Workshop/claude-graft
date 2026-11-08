---
description: Generate the skeleton of a new provider under apps/provider/ following the DDD structure
argument-hint: <provider_name> <dispatch|shuttle>
---

# Provider Scaffold — Padam-AV

Generates the skeleton of a new provider under `apps/provider/`, following the
existing DDD structure (Padam, Wetaxi, Easy Mile, Navya, Milla, Ohmio, Palomata).
Usable as a Claude Code slash command: `/provider-scaffold <provider_name> <dispatch|shuttle>`

______________________________________________________________________

## Instructions for Claude Code

`$ARGUMENTS` contains `<provider_name> <family>` where `<family>` is `dispatch`
(e.g. padam, wetaxi) or `shuttle` (e.g. easy_mile, navya, milla, ohmio, palomata).
If `<family>` is missing or ambiguous, ask the user before creating anything.

______________________________________________________________________

## STEP 1 — Study an existing provider of the same family

Before generating anything, read the structure of an existing provider of the
same family (`padam_av/apps/provider/dispatch/padam/` or
`padam_av/apps/provider/shuttle/easy_mile/`) to copy the repo's actual pattern,
not a generic structure.

______________________________________________________________________

## STEP 2 — Create the skeleton

Under `padam_av/apps/provider/<family>/<provider_name>/`:

```text
<provider_name>/
├── __init__.py
├── apps.py                 # AppConfig, if the provider is a Django sub-app
├── api.py                  # HTTP client (httpx) to the provider's API
├── constants.py            # Provider-specific constants
├── mission.py              # Mission mapping Padam-AV <-> provider format
├── migrations/
│   └── __init__.py
└── tests/
    └── __init__.py
```

- **One class per file**, named after the class (CLAUDE.md convention).
- Business logic in service classes, not scattered functions.
- Method order: see `.claude/rules/class-design.md`.
- All API calls via `httpx` (never `requests`).
- Complete type hints — see `.claude/rules/typing.md`.

______________________________________________________________________

## STEP 3 — Register the provider

- Add the provider entry to the central registry/dispatcher if such a
  registry already exists for the family (`dispatch` or `shuttle`) — look for it
  before reinventing it.
- Add the `AppConfig` to `INSTALLED_APPS` in `settings/base/` if necessary.

______________________________________________________________________

## STEP 4 — Tests

Create at minimum one negative test (API error case) and one nominal test in
`tests/`, mocking all network/DB dependencies (except when marked `@pytest.mark.integration`).

______________________________________________________________________

## Behavior rules

- **Do not duplicate** logic already present in `apps/provider/common/`.
- **Do not create** files beyond what is needed for the skeleton —
  no business implementation until the user has specified it.
- Confirm the list of files to create with the user before writing them.
