# Product surfaces

What an operated product owes its users and its operators. Each surface is held
to the product's own standards — design system, dark mode, WCAG 2.1 AA, i18n,
tests, error handling.

- **Setup wizard & config panel** (deployable apps/services — not libs, CLIs,
  utilities). A first-run setup wizard (CLI or web) covers DB, admin user,
  integrations, secrets and locale; it is idempotent, detects missing
  prerequisites with explicit fixes, and offers a non-interactive skip for CI. On
  missing/invalid config, the app redirects to a setup route rather than crashing
  or showing a generic error. An auth-gated admin config panel manages runtime
  config with a versioned audit trail, hot-reload where possible, and
  export/import for backup and cross-env cloning.
- **Every operated product ships a management backoffice.** As soon as a product
  has users, content, or work someone has to *run* — accounts to unlock, a failed
  import, a stuck job, a flag to flip — it ships an authenticated admin
  backoffice covering that work. The test is blunt: if operating the product in
  practice means SSH, `psql`, or a hand-written script, the backoffice is
  missing.
  1. It covers the operations the product actually needs, not a generic table
     browser: accounts, the domain entities support is asked about, moderation
     where content is user-supplied, runtime config and flags, background
     jobs/queues with a retry and a visible failure reason.
  2. Admin power is a role behind the identity system, never a shared login,
     "the first account created", or an env var holding a master password.
     Sensitive operations (impersonation, export, deletion) are separately
     granted; impersonation is announced and explicitly ended.
  3. Every admin action is audited — who, what, when, on which record, before and
     after — written by the same path that performs the action.
  4. Destructive actions are confirmed, scoped and reversible — typed
     confirmation for the irreversible ones, soft delete over hard delete, bulk
     operations previewed before they run.
  5. It shows the least data that answers the question; secrets are never
     displayed, only rotated.
- **If a user can supply a file, the product accepts an upload.** Wherever the
  workflow involves a file the user already has (an import, an avatar, an
  attachment, a log for support), the surface ships a real upload path — telling
  the user to paste contents into a textarea or send it by mail is a defect.
  1. A real control (native `<input type="file">`), keyboard-operable, with
     accepted formats and size limit stated before the user picks; drag-and-drop
     is an addition for pointer users, never the only way in.
  2. Feedback while it travels — progress, cancel, a per-file result; a failed
     upload never silently loses the selection.
  3. **The server trusts nothing the client says** — type is determined by
     inspecting content (not extension nor client MIME), size is capped
     server-side, the filename is sanitised and never used as a path, archives
     are bounded against decompression bombs.
  4. Files go to an object store or a dedicated volume through a `BlobStore`-style
     adapter — never into the repo, the web root, or a traversable path. Served
     through the app's authorization or a signed, expiring URL.
  5. What comes in must be able to come out — every uploaded file is listable,
     replaceable, downloadable and deletable by its owner, and included in the
     data export.
- **A floating assistant only where it earns its place — never as decoration.**
  A product whose users face a non-obvious surface (a dense cockpit, a multi-step
  wizard, an admin panel with domain jargon) may ship an in-app assistant that
  answers "what am I looking at / what next" in context. The value test comes
  first — a two-screen product with no jargon does not get one. Where warranted:
  context-aware (not a generic chat box), opt-in and reversible, governed like
  any agent the moment it acts (see `agents.md`), provider-independent, and
  accessible (keyboard, `Esc` closes, announced, honours `prefers-reduced-motion`).

## Games

- **A game is DRM-free and fully playable solo offline.** The single-player
  experience is complete without a network, an account, or a licence check — no
  licence server, no phone-home activation, no always-on requirement. A copy
  someone owns keeps working when the servers are gone. Saves are local, open and
  portable (JSON/SQLite in the platform's user directory, not encrypted against
  their owner). Online features are additive layers over a complete offline game.
  The offline path is tested with the network disabled, on a machine that never
  signed in.
