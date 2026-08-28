# Observability

- **Structured logs only** — JSON, one event per line, never a formatted
  sentence. A log line is queryable data, not prose.
- Every log carries the correlation id of its request/task, the actor, and the
  operation. A log you cannot trace back to a request is noise.
- **Levels mean something**: `error` = someone must act; `warning` = a
  degradation that resolved; `info` = a business event worth counting;
  `debug` = off in production.
- Instrument the boundaries: incoming requests, outgoing calls, database access,
  queue consumption. Spans over the slow paths, with the operation as the name.
- Never log a secret or full personal data. Identify by id, not by content.
