# AI agents & features

- **Agent actions are governed.** Any feature where an agent *acts* (writes,
  calls, runs, changes state) needs a versioned manifest with typed I/O and a
  business owner, least privilege, a declared risk level with proportionate
  confirmation and a dry-run, and a documented
  idempotency/timeout/limits/circuit-breaker/rollback envelope. Untrusted
  execution is sandboxed with the network off by default. No agent auto-merges to
  the default branch.
- **An AI feature is evaluated, not just shipped.** Prompts, models, parameters
  and tools are versioned. Every critical AI task carries an evaluation dataset
  and non-regression tests measuring quality, hallucinations, refusals, latency
  and cost. Each answer records the model, its version, the prompt and the
  sources it used, so it can be reproduced and audited. The product degrades to a
  fallback model or a no-AI mode, with human validation proportionate to the
  risk and an explicit policy for what data is sent to a model. Quality asserted
  by feel rather than measured is a defect.
- **An agent writes only where the owner owns.** An agent may open issues, pull
  requests, comments, branches and releases **only on repositories the owner
  controls**. On any third-party repository (an upstream project, a dependency, a
  client's repo) an agent does not file an issue, does not comment, does not open
  a PR: it drafts the content locally and hands it to the owner, who decides
  whether and how to send it. An issue is a public act under a human's name, and
  a wrong or noisy one costs reputation. The same limit applies to any outward
  channel (email, chat, social, package registries): drafting is free, publishing
  outside the owner's own perimeter is the owner's call.
- **Inference goes through a provider-independent port.** No vendor SDK in
  business code; the port has at least two tested adapters, and a feature that
  works on only one vendor is a bug (see `pillars.md`).
