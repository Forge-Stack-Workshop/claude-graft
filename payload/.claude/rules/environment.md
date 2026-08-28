# Environment — iso-prod, reproducible anywhere

**"It works on my machine" must never happen.** The project runs on any machine
that has a container runtime, with no undocumented local step.

## Nothing runs on the host

Build, tests, lint, type-check, migrations, the application, **and the
documentation — its generation and its serving** — all run inside a container.
A command in the README that must be run on the host is a defect.

The host installs one thing: a container runtime. No language runtime, no
package manager, no toolchain is a prerequisite for working on this project.
When proposing a command, propose the one that runs in the container.

**Including when you are only checking.** A version check, a one-off script
"just to see", a quick import to confirm something — in the container like
everything else. Interpreters leave artefacts owned by the host user
(`generated-artifacts.md`), and they answer with the host's versions, which are
not the project's. A verification that runs somewhere else verifies nothing,
and litters the tree on its way out.

## Parity and pinning

- **The production Dockerfile stays pure**, and the dev/test image **derives**
  from it rather than repeating it. Never two parallel build definitions that
  must be kept in sync by hand. Details in `docker.md`.
- Same base image family and same major versions of runtime, database, and
  services in dev and prod. A database that is SQLite locally and Postgres in
  production is a bug waiting for its first migration.
- Versions pinned, lockfiles committed, no floating `latest` tag.
- **Configuration comes from the environment**, never from a committed file.
  Ship a `.env.example` listing every variable; ship no `.env` — writing one
  is blocked by the `convention-guard` hook.

## One command

`make up` works from a fresh clone with no manual preparation. The Makefile is
the only human interface: it drives compose, which runs the image built from
the Dockerfile — see `makefile.md`. Every routine task is a target, `make docs`
included. Nothing required to run this project lives only in someone's shell
history.
