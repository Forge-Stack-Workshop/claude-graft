# Security

- **No secret in the repository.** Ever. Not in code, config, fixtures, tests,
  or commit history. Secrets come from the environment or a secret manager. The
  `secret-scanner` hook blocks the obvious cases; it is a net, not a permit.
- **Every mutating endpoint is authorized explicitly.** An identified caller is
  not an authorized caller: check the role or the ownership, in the endpoint,
  and cover it with a test asserting the denial (403), not only the success.
- **Validate at the boundary.** Every external input — HTTP body, query param,
  header, file, queue message, third-party response — is parsed and validated
  before it reaches the domain. Never trust a shape you did not verify.
- Parameterized queries only. String-built SQL is a defect, not a style.
- Never log a secret, a token, a password, or full personal data.
- An error returned to a client says what to fix, never how the system is built.
