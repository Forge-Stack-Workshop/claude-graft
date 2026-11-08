---
name: mcp-server-authoring
description: Build a Model Context Protocol (MCP) server — tools, resources, prompts, transports (stdio, HTTP/SSE), input/output schemas, error handling, auth, security, pagination/streaming, testing, packaging, and .mcp.json registration.
origin: authored
---

# MCP Server Authoring

Design and build Model Context Protocol servers that expose tools, resources, and
prompts to LLM clients safely and predictably.

## Prerequisites (preflight)

Before using this skill, ensure you have the required packages installed.

**Python packages:**
```bash
# Check for MCP SDK (Python)
python -c "import mcp" || echo "WARN: pip install mcp"
```

**Or npm packages (Node.js):**
```bash
# Check for MCP SDK (JavaScript)
command -v npm && npm list @modelcontextprotocol/sdk || echo "WARN: npm install @modelcontextprotocol/sdk"
```

## When to Activate

- Building a new MCP server from scratch
- Adding a tool, resource, or prompt to an existing MCP server
- Choosing a transport (stdio vs HTTP/SSE) for an MCP server
- Reviewing an MCP server for security or reliability gaps
- Registering a server in `.mcp.json`
- Debugging an MCP client that can't see or call a tool correctly

## Core Primitives

MCP exposes three primitive types to clients. Pick the right one — most bugs
come from using a tool where a resource fits better, or vice versa.

| Primitive | Purpose | Client analogy |
| --- | --- | --- |
| **Tool** | Performs an action, may have side effects, model decides when to call it | Function call |
| **Resource** | Exposes read-only data by URI, client decides when to fetch it | GET endpoint |
| **Prompt** | Reusable, parameterized prompt template surfaced to the user | Slash command / snippet |

```text
# Decision guide
Does it change state or call an external system?      → Tool
Is it read-only data the model/user browses on demand? → Resource
Is it a reusable instruction template for the user?    → Prompt
```

## Tool Definition

Every tool needs: a unique name, a clear description, a strict input schema,
and a documented output shape.

```python
# Python (mcp SDK)
from mcp.server import Server
from mcp.types import Tool, TextContent

server = Server("padam-fleet-mcp")

@server.list_tools()
async def list_tools() -> list[Tool]:
    return [
        Tool(
            name="get_vehicle_status",
            description=(
                "Return the current status of one vehicle by its fleet ID. "
                "Read-only, idempotent. Use before dispatching a mission."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "vehicle_id": {
                        "type": "string",
                        "description": "Fleet-internal vehicle identifier, e.g. 'AV-042'",
                    },
                },
                "required": ["vehicle_id"],
                "additionalProperties": False,
            },
        ),
    ]

@server.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    if name != "get_vehicle_status":
        raise ValueError(f"Unknown tool: {name}")
    vehicle_id = arguments["vehicle_id"]
    status = await fetch_vehicle_status(vehicle_id)
    return [TextContent(type="text", text=status.to_json())]
```

### Tool Naming and Description

- Name: `snake_case`, verb-first, unambiguous (`create_mission`, not `mission_handler`).
- Description: state what it does, side effects (or lack of), and when to call it —
  the model reads this to decide, so vague descriptions cause misuse or non-use.
- One tool = one responsibility. A tool that both reads and writes, or that
  branches into unrelated behaviors based on a flag, is two tools wearing a trench coat.

## Resources

```python
@server.list_resources()
async def list_resources() -> list[Resource]:
    return [
        Resource(
            uri="fleet://territories/{territory_id}/vehicles",
            name="Territory vehicle list",
            description="Read-only list of vehicles assigned to a territory.",
            mimeType="application/json",
        ),
    ]

@server.read_resource()
async def read_resource(uri: str) -> str:
    territory_id = parse_territory_id(uri)
    vehicles = await list_vehicles_for_territory(territory_id)
    return vehicles.to_json()
```

- Resources are addressed by URI — use a stable, documented scheme (`fleet://...`),
  never leak internal DB identifiers that could change.
- Keep resources read-only. If a client needs to mutate the data, expose a tool instead.

## Prompts

```python
@server.list_prompts()
async def list_prompts() -> list[Prompt]:
    return [
        Prompt(
            name="triage_provider_incident",
            description="Guide a structured triage of a provider integration failure.",
            arguments=[
                PromptArgument(name="provider_name", required=True),
                PromptArgument(name="error_summary", required=True),
            ],
        ),
    ]
```

- Prompts are user-invoked (e.g. via a slash command in the client) — write them as
  instructions to the model, not as documentation for a human.

## Transports

| Transport | Use when | Notes |
| --- | --- | --- |
| **stdio** | Local process, single client, CLI tools, desktop app integration | Simplest, no auth needed — process boundary is the trust boundary |
| **HTTP/SSE** | Remote server, multiple clients, needs auth | Requires TLS, auth headers, session management |

```python
# stdio entrypoint
import asyncio
from mcp.server.stdio import stdio_server

async def main() -> None:
    async with stdio_server() as (read_stream, write_stream):
        await server.run(read_stream, write_stream, server.create_initialization_options())

if __name__ == "__main__":
    asyncio.run(main())
```

```python
# HTTP/SSE entrypoint (behind a reverse proxy terminating TLS)
from mcp.server.sse import SseServerTransport
from starlette.applications import Starlette
from starlette.routing import Route

transport = SseServerTransport("/messages")

async def handle_sse(request):
    async with transport.connect_sse(request.scope, request.receive, request._send) as (read, write):
        await server.run(read, write, server.create_initialization_options())

app = Starlette(routes=[Route("/sse", endpoint=handle_sse)])
```

- Never expose stdio-only servers over a network socket without adding auth —
  stdio has no built-in identity check.

## Input/Output Schemas

- Every tool input is a strict JSON Schema: `additionalProperties: false`, explicit
  `required`, and constrained types (`enum`, `minLength`, `pattern`) over free-form strings.
- Validate inputs server-side even if the schema is enforced client-side — a
  malicious or buggy client can send anything.
- Output: return structured, minimal data. Truncate large payloads rather than
  dumping full objects; the model pays token cost for every returned field.

```python
def validate_vehicle_id(vehicle_id: str) -> str:
    if not re.fullmatch(r"AV-\d{3,5}", vehicle_id):
        raise ValueError(f"Invalid vehicle_id format: {vehicle_id!r}")
    return vehicle_id
```

## Error Handling

- Return errors as structured tool results (`isError: True` + a clear message),
  not as protocol-level exceptions, unless the failure is truly unrecoverable
  (e.g. malformed request).
- Error messages must be actionable to the model: state what failed and what
  input would fix it — never a bare stack trace.
- Never leak internal exception details, file paths, or secrets in an error message.

```python
try:
    result = await call_upstream_api(vehicle_id)
except UpstreamTimeoutError:
    return [TextContent(type="text", text="Upstream fleet API timed out after 5s. Retry once, then escalate.")]
except UpstreamNotFoundError:
    return [TextContent(type="text", text=f"No vehicle found for id={vehicle_id!r}. Check the id format (AV-###).")]
```

## Auth and Headers

- stdio: trust boundary is the process launcher — the client that spawns the
  server is implicitly authorized; do not add a second auth layer on top.
- HTTP/SSE: require a bearer token or signed header on every request; validate it
  before dispatching to any tool handler, not inside individual tools.
- Pass per-user identity through request context, not through tool arguments —
  never let the model choose which user/tenant it is acting as.
- Scope tokens narrowly: a token for this MCP server should not also grant
  access to unrelated internal systems.

## Security — Least Privilege and Secrets

- Load secrets from environment variables or a secrets manager — never hardcode,
  never echo them back in a tool result or log line.
- Each tool gets the minimum backend permission it needs (e.g. read-only DB user
  for read tools; a separate, audited credential for write tools).
- Sanitize any data that flows from tool output back into a prompt context —
  treat upstream API responses as untrusted input (prompt injection surface).
- Set a timeout on every outbound call a tool makes; an MCP tool that hangs
  blocks the whole client session.
- Rate-limit expensive tools server-side, independent of client behavior.

## Pagination and Streaming

- For list-returning tools/resources, paginate with an opaque cursor, not an
  offset the model has to compute — return `next_cursor: str | None`.
- Cap page size server-side regardless of what the client requests.
- For long-running operations, prefer returning progress via MCP's built-in
  progress notifications over blocking the tool call until completion.

```python
{
    "items": [...],
    "next_cursor": "eyJvZmZzZXQiOjUwfQ==",
    "has_more": True,
}
```

## Testing an MCP Server

- Unit test each tool handler directly (call the Python/TS function, mock
  upstream I/O) — do not require a live client for basic logic coverage.
- Integration test the full protocol round-trip: spin up the server over
  stdio in a subprocess, send `list_tools`/`call_tool` JSON-RPC messages, assert
  on the response shape.
- Test the negative paths explicitly: invalid schema input, upstream timeout,
  upstream 4xx/5xx, empty result set.
- Use the reference MCP Inspector CLI to manually exercise a server during
  development before wiring it into a real client.

```bash
npx @modelcontextprotocol/inspector python server.py
```

## Packaging and `.mcp.json` Registration

```json
{
  "mcpServers": {
    "padam-fleet-mcp": {
      "command": "python",
      "args": ["-m", "padam_fleet_mcp.server"],
      "env": {
        "FLEET_API_BASE_URL": "https://internal.example.com"
      }
    }
  }
}
```

- Pin the runtime/interpreter version used to launch the server (`python3.12`,
  not bare `python`) to avoid environment drift.
- Never put a secret value directly in `.mcp.json` — reference an env var name,
  populate the value outside version control.
- Document required env vars in the server's README, with type and example.

## Versioning

- Version the server package (semver) independently of the protocol version it
  implements — declare the MCP protocol version it targets explicitly at startup.
- Breaking change to a tool's input schema or output shape is a major bump —
  clients pin against a version and will break silently otherwise.
- Prefer adding a new tool over changing an existing tool's contract when
  behavior diverges meaningfully; deprecate the old tool with a clear
  description note before removal.

## Best Practices

- Tools are idempotent by default; document any tool that is not (e.g.
  `create_mission` may double-book on retry — say so in the description).
- Keep tool count per server focused — a server with 40 overlapping tools
  degrades model tool-selection accuracy more than it helps.
- Log every tool call (name, truncated args, duration, outcome) server-side for
  observability, excluding secret values.
- Fail fast on startup if required config/secrets are missing — never let a
  misconfigured server accept connections and fail per-call instead.

## Common Pitfalls

```text
# BAD — tool too broad, unclear side effects
Tool(name="manage_vehicle", description="Do things with a vehicle")

# GOOD — narrow, explicit
Tool(name="get_vehicle_status", description="Read-only status lookup, idempotent")
Tool(name="dispatch_vehicle", description="Assigns a mission; NOT idempotent, may double-dispatch on retry")
```

- Tool descriptions too vague for the model to select correctly.
- Secrets embedded in `.mcp.json`, source code, or echoed in tool output/logs.
- No timeout on outbound HTTP calls inside a tool handler.
- Free-form string inputs where an `enum` or regex `pattern` would constrain misuse.
- Returning full upstream payloads instead of trimming to what the model needs.
- Mixing read and write behavior in a single tool.
- No pagination cap — a "list all" tool that can return unbounded rows.
- stdio server exposed over a raw network port without adding auth.

## Production Readiness Checklist

### Design

- [ ] Each primitive (tool/resource/prompt) matches its intended use (action vs read vs template)
- [ ] Tool names and descriptions are unambiguous and state side effects
- [ ] Input schemas are strict (`additionalProperties: false`, explicit `required`)
- [ ] Idempotency documented per tool

### Security

- [ ] Secrets loaded from env/secrets manager, never hardcoded or logged
- [ ] Least-privilege backend credentials per tool
- [ ] Auth enforced before dispatch on HTTP/SSE transport
- [ ] Timeouts set on every outbound call
- [ ] Untrusted upstream data sanitized before re-entering prompt context

### Reliability

- [ ] Errors returned as structured, actionable tool results
- [ ] Pagination with server-enforced page size cap
- [ ] Long-running operations use progress notifications, not blocking calls
- [ ] Rate limiting on expensive tools

### Testing and Packaging

- [ ] Unit tests per tool handler (mocked I/O), including negative paths
- [ ] Integration test of the full JSON-RPC round-trip over the chosen transport
- [ ] Manually exercised via MCP Inspector before client integration
- [ ] `.mcp.json` entry pins runtime version, references env vars (no literal secrets)
- [ ] Server package versioned; breaking tool-contract changes bump major version
