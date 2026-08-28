# Documentation

## Documentation ships with the change

A change is not finished until the documentation describing it is true again.
Stale documentation is worse than none: it lies with authority.

In the **same commit** as the code, update whatever the change invalidated:
the repo `README.md`, the touched folder's `README.md`, the command table, the
environment variables, the architecture notes. Never "later", and never only
when asked.

## Every meaningful folder carries a README

When creating a folder — or doing substantial work in one that has no
`README.md` — add one. It says what the folder is for, what belongs in it, what
must never land there and where that goes instead, and the conventions that
govern it. `/folder-readme` carries the full structure.

Skip: the repo root, generated or vendored directories, empty placeholders.
Do not churn — only document a folder you are already working in. Never open a
mass-README change unless asked. Use `/folder-readme` to scaffold one.

**This one is enforced.** The `folder-readme-guard` hook refuses to create a
file in a folder that has no `README.md`. Editing a file that is already there
only warns — that debt predates your change. Configure it in
`.claude/folder-readme.json`.

## The documentation site

Prose documentation lives in a MkDocs site under `docs/` — see `mkdocs.md` for
its structure and `code-flow.md` for what a feature must leave behind there.
The folder READMEs above and the site are complementary: a README says what a
directory is, the site says what the system does.

## Comments

Document what the reader cannot deduce from the signature. Restating the type
in prose is noise. Every non-obvious constraint, unit, or invariant gets said.
