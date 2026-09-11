# Portability & independence — the non-negotiables

Five constraints a project holds whatever its stack. Breaking one is a
documented decision (an ADR), not a shrug.

1. **LLM-provider independence.** No vendor SDK is called from business code.
   All inference goes through a local port with **at least two real, tested
   implementations**. A prompt that only works on one vendor is a bug. A
   vendor-only capability is emulated behind the port or forbidden — and if it is
   truly required, it is a recorded decision.

2. **Managed-cloud independence.** Every managed-cloud dependency has a
   **documented exit path** — a procedure, not "we'll see" — and an identified
   self-hosted equivalent (object storage → S3-compatible server, managed DB →
   the same engine self-run, functions → a container). The cloud SDK stays
   confined to an adapter; the domain speaks `BlobStore`, not a vendor client.

3. **Portable personal data.** All user/personal data is exportable to an open
   format (JSON, SQLite, CSV) by a documented command. A stored-but-unexportable
   field is a recorded decision, not a default. `export → import → export` is
   idempotent, and that is a test, not an intention. (Its precondition — that
   per-person data has an owner — lives in `security.md`.)

4. **Infrastructure lives in the project repo.** Deployment manifests (compose,
   Kubernetes, IaC) are versioned in the project repo, not only inside a running
   cluster and not in a separate hidden infra repo. If the running environment
   shows something absent from the repo, that is drift to fix.

5. **An adapter for every external dependency.** A third-party lib/API/service is
   never imported directly by the domain — it goes through an adapter, and the
   port is written in the domain's language, not the vendor's. If renaming the
   vendor changes the port signature, the port is wrong. (This is the same
   boundary `architecture.md` states for the domain.)

## When one of these forces a decision

Any exception — a new external dependency, an LLM/cloud provider choice, a
data-model change that touches exportability — is recorded as an ADR under
`docs/adr/`: the context, the decision in one sentence, the assumption that
would invalidate it, and how you would know. An ADR is never rewritten after it
is accepted; changing your mind is a new ADR that supersedes the old one.

## What no linter checks — verify in review

- The domain imports no vendor SDK (grep the SDK package in the domain layer).
- The LLM path has ≥ 2 tested adapters behind one shared contract test.
- Every managed-cloud dependency has an exit path written down.
- Personal data has an export command and a round-trip test.
