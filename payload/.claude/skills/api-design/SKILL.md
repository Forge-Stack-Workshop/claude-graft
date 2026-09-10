---
name: api-design
description: Resource-oriented API design patterns — resource naming and hierarchy, standard and custom methods, pagination, filtering, versioning, long-running operations, batch operations, import/export, idempotency, and soft delete. Applies to REST, gRPC, and GraphQL APIs.
origin: biblio (API Design Patterns, JJ Geewax)
---

# API Design

Design patterns for building consistent, evolvable APIs, independent of transport
(REST, gRPC, GraphQL). Focus on resource modeling and the recurring shapes that
handle scale, partial failure, and long-term compatibility.

## When to Activate

- Designing a new resource/entity model for an API
- Choosing between a standard CRUD method and a custom action
- Adding pagination, filtering, or bulk operations to a list endpoint
- Planning an API version bump or evaluating whether a change is breaking
- Handling operations that don't complete synchronously (jobs, exports)
- Making a mutating endpoint safe to retry
- Deciding how to delete a resource (hard vs recoverable)

## Resource Design

Standardize the "things" an API manages (resources) and limit actions on them to a
small, predictable method set, instead of inventing arbitrary RPC names per feature.

- Resource names are singular (`Book`, `Publisher`); collections are plural in the
  path — a single `Book` lives at `/books/1234`.
- IDs are self-describing and namespaced by collection:
  `books/abcde-12345-ghjkm-67890`, fetched via `GET books/abcde-12345-ghjkm-67890`.
- Use hierarchy (`books/1/pages/2`) only for true ownership, where the child cannot
  exist without the parent and inherits its security/cascading delete. A `Page`
  never exists bare at `pages/2`.
- Prepositions in a resource or field name (`...With...`, `...For...`) are a code
  smell: they usually signal a missing field mask or view, not a genuine new
  resource.

**Pitfall — encoding association as hierarchy.** `shelves/1/books/1` for "book
currently on a shelf" is wrong: books move between shelves, and the identifier
must stay permanent. Model the association as a mutable property instead:
`Book.shelfId`, with `Book` living at the top-level `books/1`.

**Pitfall — irregular pluralization.** `Person` → `people`, not `persons`. Pick and
document one pluralization convention (e.g. American English) so client codegen
stays predictable.

## Standard Methods

List, Get, Create, Update, Delete cover the vast majority of API surface. List, Get,
and Update (as PATCH) are idempotent; Create and Delete are imperative and are not
guaranteed idempotent by default.

**Partial update via field mask** — decouple "what changed" from "what was sent":

```
PATCH /chatRooms/1?fieldMask=title
{ "title": "New name" }              # only title changes

PATCH /chatRooms/1
{ "title": "New name" }              # full replace, everything else reset
```

Masks address nested/repeated fields too: `fieldMask=administrators.*.name`. To
delete a key, put it in the mask without a value (`fieldMask=settings.test`) rather
than setting it to `null` — `null` in the body means "set this to null," not
"remove it."

**Pitfall — side effects in standard methods.** A `create` that also sends an email,
or a `get` that increments a hit counter, breaks the idempotency guarantee clients
rely on for retries. Keep standard methods pure with respect to their stated
purpose; put side effects behind an explicit custom method instead.

## Custom Methods

For actions that don't map to CRUD. Use one HTTP verb consistently (commonly POST),
name as `<Verb><Noun>` (`LaunchRocket`, `ArchiveDocument`), and separate the action
from the resource explicitly:

```
POST /rockets/1234567:launch          # correct: ':' separates resource from action
POST /rockets/1234567/launch          # wrong: looks like a nested resource
```

Stateful custom methods can anchor to a parent collection:
`POST /projects/42/text:translate`.

**Pitfall.** Don't disguise a Create behind a custom-method name
(`CreateRocketForMars` instead of `CreateRocket` with a `destination` field) —
custom methods are for genuinely non-CRUD actions, not a way to avoid designing a
proper field.

## Pagination

Consume large collections in bounded chunks via an opaque cursor, never a page
number (page numbers break under concurrent inserts/deletes).

```
Request:  { maxPageSize: 10 }
Response: { results: [...], nextPageToken: "cGFnZTE=" }

Request:  { maxPageSize: 10, pageToken: "cGFnZTE=" }
Response: { results: [...], nextPageToken: null }   # no more pages
```

- `maxPageSize` is a ceiling, not an exact count — the server may return fewer
  items than requested even mid-collection.
- Completion is signaled by an absent/null `nextPageToken`, **not** by an empty
  `results` array — a page can legitimately return zero items due to a time/cost
  budget while more pages remain.

**Pitfall.** Never let the token be a parseable structure (e.g. a raw offset
integer). If clients can decode it, the token's internal shape becomes part of the
API contract and can't evolve. Treat it as an opaque, server-owned string.

## Filtering

Push filtering to the server via a single `filter` field carrying an unstructured,
SQL-like expression string — not a structured filter object.

```
title = "New Chat!" AND admin = "1234"
title = "New Chat!" OR title = "Old Chat!"
```

A structured equivalent (`{ "$or": [...] }`, Mongo-style) locks the shape of every
possible query into the wire format; a string grammar can grow new operators
without a breaking change. Reuse an existing filter language (CEL, AIP-160, RQL)
rather than inventing one.

**Constraint.** A filter expression must be evaluable using only the fields of a
single resource instance — no joins across unrelated resources, no scanning
external state. This keeps filter cost bounded and prevents the language from
drifting toward arbitrary server-side code execution.

## Long-Running Operations (LRO)

The API analog of a Promise/Future for work that can't finish within one request
cycle: return a persisted, first-class `Operation` resource instead of blocking.

```
POST /chatRooms
  -> Operation<ChatRoom, CreateChatRoomMetadata> { name: "operations/9", done: false }

GET /operations/9   # poll until done
  -> { done: true, response: ChatRoom{...} }   # or { done: true, error: {...} }
```

- `done` is the source of truth for completion; it does **not** imply success — a
  completed-with-error result also has `done: true`, with an `error` field instead
  of `response`.
- Cancellation, when supported, is itself a custom method: `POST /operations/9:cancel`.

**Pitfall.** Don't nest operations under their triggering resource
(`chatRooms/1/operations/2`). Use one centralized top-level `/operations`
collection so clients can list/query all in-flight work in one place, regardless
of what created it.

## Batch Operations

Extend single-resource atomicity (all-or-nothing) to a group in one round trip.
Four methods exist — `BatchGet`, `BatchCreate`, `BatchUpdate`, `BatchDelete` —
deliberately no batch List (pagination already handles bulk reads).

```
POST /chatRooms/messages:batchDelete   { names: [...] }
POST /chatRooms/-/messages:batchCreate { resources: [msg1, msg2] }   # '-' = any parent
```

- Response item order must match request item order — servers assign IDs, and
  clients need positional correlation without a deep comparison.
- A hoisted, shared field (e.g. one `parent` for the whole batch) that conflicts
  with a per-item value must fail the entire request fast, not silently override it.

**Pitfall.** Defining a separate `parent` field per item instead of using a
wildcard collection path (`chatRooms/-/messages`) for cross-parent batch creation
complicates both validation and client code — prefer the wildcard-parent shape.

## Import / Export

Connect the API directly to external bulk storage, bypassing the client for large
transfers. Anchored to a resource collection, returns an LRO.

```
POST /chatRooms/42/messages:export
  -> Operation<ExportMessagesResponse, ExportMessagesMetadata>
```

Keep structural/output config (format, filenames, compression) in a dedicated
config object separate from filtering, e.g.
`MessageOutputConfig { contentType, filenameTemplate, maxFileSizeMb, compressionFormat }`
— filtering stays on the export request, not inside the output config, so each
type has one responsibility.

**Pitfall — the "smear" problem.** Without a snapshot boundary, an export spanning
a long-running query can capture resources that never actually coexisted (some
created after the export started, some deleted before it finished). **Pitfall —
retried imports.** A retried import call re-creates records unless each imported
record carries a unique `importRequestId` for dedup (same idea as request
idempotency, applied per-record).

## Versioning & Compatibility

The compatibility test: *does this change cause existing client code to break?* If
yes, it's backward-incompatible. Map this onto SemVer:

| Change | Example | Version bump |
|---|---|---|
| Backward-incompatible | rename/remove a field | major (1.0.0 → 2.0.0) |
| Backward-compatible addition | add an optional field | minor (1.0.0 → 1.1.0) |
| Compatible bug fix | fix a rounding error nobody depends on | patch |

**Pitfall — "adding a field is always safe" is false.** A new field in a list
response (especially high-cardinality or repeated) can push a resource-constrained
client (embedded/IoT) past its memory budget even though the schema change is
additive. **Pitfall — new required dependencies.** Introducing a new required
related resource that must be explicitly deleted before its parent (e.g. a policy
object blocking parent deletion) silently breaks the "existing users can stay
ignorant of new functionality" guarantee, even without touching the changed
resource's own schema. SemVer discipline needs a paired deprecation policy — more
versions in flight is a direct cost of strict compatibility guarantees.

## Idempotency

After a network failure, the client cannot tell whether the request was lost or
only the response was. Let the client supply a unique request ID; the server caches
the outcome keyed by that ID and replays it instead of re-executing on a retry.

```
CreateChatRoom({ requestId: "1234", resource: {...} })
# server: cache.get("1234") -> miss -> create -> cache.set("1234", ChatRoom{id:5678})

CreateChatRoom({ requestId: "1234", resource: {...} })   # retry
# server: cache.get("1234") -> hit -> return cached ChatRoom{id:5678}, no new room
```

- An absent `requestId` means "no dedup requested" — not an error.
- An invalid/malformed `requestId` is a `400`.
- Cached responses must expire (idempotency is a time-bounded guarantee, not
  permanent memory).

**Pitfall.** Never derive the request ID by hashing the request body. That silently
blocks legitimate, intentional repeats (e.g. creating two identical chat rooms on
purpose) — by default, distinct requests should not be deduplicated unless the
client explicitly opts in with a shared ID.

## Soft Delete

Repurpose `delete` to be non-destructive: flip a `deleted` flag/state instead of
removing the row. `list` excludes soft-deleted resources by default. Pair it with
`undelete` (restore) and `expunge` (permanent removal), optionally with an
`expireTime` for scheduled auto-purge (recycle-bin model).

```
POST /chatRooms/42:undelete   -> ChatRoom            # error if not currently deleted
POST /chatRooms/42:expunge    -> (empty)              # works regardless of soft-delete state
```

**Pitfall — overloading DELETE with a query flag.** `DELETE /chatRooms/42?expunge=true`
is the wrong shape: DELETE conventionally carries no body/semantic payload, a query
param shouldn't silently change destructiveness, and it makes it impossible to
grant "soft-delete" permission while withholding "permanent-delete" permission.
Model `expunge` as its own custom method instead. Also decide explicitly (don't
leave implicit): what happens when `undelete` targets a resource that isn't
deleted, how referential integrity behaves against soft-deleted resources, and
whether a batch delete defaults to soft or permanent.
