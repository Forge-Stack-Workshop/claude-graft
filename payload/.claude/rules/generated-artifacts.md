# Generated artefacts

**No tool writes into the source tree.** A build output, a collected asset
directory, a coverage database, a linter cache: none of them belong beside the
code that produced them.

- **`.gitignore` is not the fix, it is the symptom.** Hiding a directory a tool
  should never have created leaves it on every developer's disk, in every
  editor's search results, and inside every container bind mount. Point the
  tool elsewhere instead.
- **Generated output goes to a path outside the tree** — a directory in the
  container, or an explicit build directory outside the repository. Configure
  it in the tool's own configuration file, so a bare invocation already does
  the right thing, and pass it explicitly in the Makefile target as well.
- **Caches are configured, never inherited.** The cache directory of every
  tool, and the switches that stop interpreters writing beside the source, are
  set in the image. A cache written into a bind mount is owned by the wrong
  uid, and becomes the next person's permission error.
- **A generated file that must be committed** — a generated client, a lock, a
  schema dump — is committed **and** reproducible by one documented command. If
  regenerating it produces a diff, either the command or the committed file is
  wrong; find out which before doing anything else.

**The test:** after a full `make ci` on a clean checkout, `git status` is empty
and no new directory has appeared. If either is false, something wrote where it
should not have — and that is a defect in the configuration, not a line to add
to `.gitignore`.
