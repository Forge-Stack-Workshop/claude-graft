---
name: websocket-realtime
description: WebSocket protocol fundamentals, ASGI/Django Channels consumers, channel layers (Redis groups, pub/sub, fan-out), authentication, heartbeats, reconnection/backoff, backpressure, horizontal scaling, SSE alternative, testing, origin-check security, and common connection-leak/ordering pitfalls for real-time features.
origin: authored
---

# WebSocket Realtime

Patterns for building and operating real-time bidirectional connections: protocol
mechanics, server-side consumers, scaling across processes, and client resilience.

## When to Activate

- Designing a real-time feature (live tracking, chat, notifications, dashboards)
- Implementing or reviewing Django Channels consumers
- Choosing between WebSocket, SSE, and polling
- Debugging dropped connections, duplicate/out-of-order messages, or memory leaks
- Scaling WebSocket servers horizontally (multiple workers/pods)
- Auditing WebSocket authentication or origin validation

## Protocol Fundamentals

WebSocket upgrades an HTTP connection via `Upgrade: websocket`. After the handshake,
both sides exchange framed messages over one long-lived TCP connection — no
per-message HTTP overhead, full duplex.

```text
Client                          Server
  | --- GET /ws/ HTTP/1.1 ----->  |
  |     Upgrade: websocket        |
  |     Sec-WebSocket-Key: ...    |
  | <--- 101 Switching Protocols- |
  |                                |
  | <====== data frames =======>  |  (persistent, full-duplex)
```

Key properties to design around:

- **Stateful**: the connection itself is state — server must track it per-process.
- **No built-in retry/ack**: delivery is at-most-once per frame; app-level acks needed
  for at-least-once semantics.
- **One TCP connection per client**: does not multiplex across processes — this is
  why channel layers exist (see below).

## ASGI / Django Channels Consumers

Django Channels runs WebSocket handling on ASGI, alongside WSGI/HTTP views.

```python
# consumers.py
from channels.generic.websocket import AsyncJsonWebsocketConsumer


class VehicleTrackingConsumer(AsyncJsonWebsocketConsumer):
    """Streams live vehicle position updates to authenticated dispatchers."""

    async def connect(self) -> None:
        if not self.scope["user"].is_authenticated:
            await self.close(code=4401)
            return
        self.territory_group = f"territory_{self.scope['url_route']['kwargs']['territory_id']}"
        await self.channel_layer.group_add(self.territory_group, self.channel_name)
        await self.accept()

    async def disconnect(self, code: int) -> None:
        await self.channel_layer.group_discard(self.territory_group, self.channel_name)

    async def vehicle_position(self, event: dict) -> None:
        """Handler name must match the `type` key sent via group_send."""
        await self.send_json(event["payload"])
```

```python
# routing.py
from django.urls import re_path

from apps.vehicle.consumers import VehicleTrackingConsumer

websocket_urlpatterns = [
    re_path(r"ws/territory/(?P<territory_id>\d+)/$", VehicleTrackingConsumer.as_asgi()),
]
```

- Use `Async*Consumer` over sync consumers — sync consumers block a worker thread
  per connection and do not scale past a few hundred sockets.
- One consumer class per real-time concern (tracking, chat, alerts) — do not build a
  single god-consumer that branches on message type.

## Channel Layers: Groups, Pub/Sub, Fan-Out

A channel layer (Redis-backed) lets consumers on **different processes/pods**
exchange messages — required because a WebSocket connection lives on exactly one
process.

```python
# settings
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {"hosts": [("redis-av", 6379)]},
    },
}
```

```python
# publishing from anywhere (view, service, RQ task) — fan-out to every
# subscriber of a group, regardless of which process holds their socket
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

channel_layer = get_channel_layer()
async_to_sync(channel_layer.group_send)(
    f"territory_{territory.id}",
    {"type": "vehicle_position", "payload": {"vehicle_id": vehicle.id, "lat": lat, "lng": lng}},
)
```

- Groups model topics: one group per territory/mission/room, not one group for all
  clients — avoids fanning every message to every socket.
- Channel layer capacity is bounded (`capacity`, default 100 messages per channel) —
  a slow consumer causes `ChannelFull` and dropped messages; monitor group size.
- Redis pub/sub used by `channels_redis` is fire-and-forget: a message published
  while a pod is mid-restart is lost. Do not use it as the source of truth — persist
  state in the DB and let clients resync on reconnect.

## Authentication

- Authenticate at `connect()`, before `accept()` — never after.
- Token in the query string is common (browsers can't set custom headers during the
  handshake) but leaks into access logs and browser history — prefer a short-lived,
  single-use ticket exchanged right before connecting, or a cookie-based session if
  same-site.
- Close with a distinct 4xxx code (`4401` unauthenticated, `4403` forbidden) so the
  client can distinguish auth failure from a transient network drop and avoid a
  reconnect loop.

```python
async def connect(self) -> None:
    if not self.scope["user"].is_authenticated:
        await self.close(code=4401)
        return
    await self.accept()
```

## Origin Check (Security)

WebSocket handshakes are exempt from the same-origin policy and CORS — the browser
issues the upgrade request regardless of origin. Django Channels validates
`Origin` via `AllowedHostsOriginValidator`; enforce it explicitly.

```python
from channels.auth import AuthMiddlewareStack
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import AllowedHostsOriginValidator

application = ProtocolTypeRouter({
    "websocket": AllowedHostsOriginValidator(
        AuthMiddlewareStack(URLRouter(websocket_urlpatterns)),
    ),
})
```

- Never disable origin validation "temporarily" for a frontend running on another
  domain — add that domain to `ALLOWED_HOSTS` / a dedicated origin allow-list instead.
- Treat a WebSocket endpoint like any other authenticated endpoint for CSRF-adjacent
  risk: a malicious page can open a socket to your server using the victim's cookies.

## Heartbeats / Ping-Pong

Detects half-open connections (client disappeared without a clean close — e.g. phone
sleep, NAT timeout) that neither side otherwise notices.

```python
# server-side application-level ping (protocol-level ping/pong also exists at
# the WebSocket frame layer, but many proxies/load balancers strip it)
async def send_heartbeat(self) -> None:
    while True:
        await asyncio.sleep(30)
        await self.send_json({"type": "ping"})
```

```javascript
// client: reply to ping, and independently detect silence
let lastMessageAt = Date.now();
socket.onmessage = (event) => {
  lastMessageAt = Date.now();
  if (JSON.parse(event.data).type === "ping") socket.send(JSON.stringify({ type: "pong" }));
};
setInterval(() => {
  if (Date.now() - lastMessageAt > 90_000) socket.close(); // force reconnect
}, 15_000);
```

- Pick an interval shorter than any intermediary idle-connection timeout (load
  balancers commonly close idle TCP after 60s).
- A missed heartbeat should trigger an active close, not a silent hang — a hung
  half-open socket holds server resources indefinitely.

## Reconnection & Backoff

- Exponential backoff with jitter — a bare fixed-delay retry causes reconnect storms
  after a server restart or network blip.

```javascript
let attempt = 0;
function connect() {
  const socket = new WebSocket(url);
  socket.onopen = () => { attempt = 0; };
  socket.onclose = (event) => {
    if (event.code === 4401) return; // auth failure — do not retry blindly
    const delay = Math.min(30_000, 1000 * 2 ** attempt) * (0.5 + Math.random());
    attempt += 1;
    setTimeout(connect, delay);
  };
}
```

- On reconnect, resynchronize state explicitly (fetch current snapshot via REST,
  then resume streaming deltas) — do not assume no messages were missed while
  disconnected.

## Backpressure

- A slow client (bad network, busy tab) can't drain messages as fast as the server
  produces them — buffers grow unbounded without a limit.
- Cap the per-connection outbound queue; drop or coalesce (e.g. keep only the latest
  position update per vehicle) rather than buffering indefinitely.
- `channels_redis` group capacity acts as a coarse backpressure valve — a full
  channel raises `ChannelFull`; catch it and drop rather than blocking the publisher.

```python
try:
    await self.channel_layer.group_send(group, event)
except ChannelFull:
    logger.warning("channel_full_dropping_event", extra={"group": group})
```

## Horizontal Scaling

- Each ASGI worker/pod holds its own set of live sockets — scaling out means more
  concurrent connections, not automatically more fan-out capacity.
- All workers must share the same channel layer backend (Redis) so a `group_send`
  from any process reaches sockets held by any other process.
- Sticky sessions are **not** required for WebSocket (unlike some long-poll setups)
  as long as the channel layer bridges processes — but the load balancer must support
  long-lived connections and the `Upgrade` header (verify with the actual LB, not
  just the app server).
- Size the Redis channel layer independently from the app's primary Redis — group
  traffic is bursty and orthogonal to cache/queue traffic.

## Alternative: Server-Sent Events (SSE)

Prefer SSE over WebSocket when the data flow is server-to-client only.

| | WebSocket | SSE |
| --- | --- | --- |
| Direction | Full duplex | Server → client only |
| Protocol | Own upgrade, needs ASGI/Channels | Plain HTTP, works with WSGI |
| Reconnect | Manual (see above) | Built into `EventSource` |
| Proxies/LBs | Needs `Upgrade` support | Works through any HTTP infra |
| Use when | Client must also send frequent messages (chat, control commands) | Client only observes (live feed, notifications, progress) |

If the feature is "push updates to a dashboard", SSE is simpler and needs no channel
layer changes to existing HTTP infrastructure — do not default to WebSocket for
read-only streams.

## Testing

```python
# unit test — mock the channel layer, no real Redis
import pytest
from channels.testing import WebsocketCommunicator

from padam_av.asgi import application


@pytest.mark.asyncio
async def test_rejects_unauthenticated_connection(mocker):
    """Given no authenticated user, when connecting, then the socket closes with 4401."""
    mocker.patch("apps.vehicle.consumers.VehicleTrackingConsumer.scope", {"user": mocker.Mock(is_authenticated=False)})
    communicator = WebsocketCommunicator(application, "/ws/territory/1/")
    connected, _ = await communicator.connect()
    assert connected is False, f"expected rejection but {connected=}"
    await communicator.disconnect()
```

- Unit-test consumer logic (`connect`/`receive`/`disconnect`) with
  `WebsocketCommunicator`, mocking the channel layer and DB per repo test rules.
- Integration-test group fan-out with a real (or in-process) channel layer to catch
  serialization and group-naming bugs.
- Load-test with a tool that opens thousands of concurrent connections (not just
  request-per-connection HTTP tools) — WebSocket failure modes only appear under
  sustained concurrent connection count, not request rate.

## Common Pitfalls

- **Connection leaks**: forgetting `group_discard` in `disconnect()` — the group
  keeps a reference to a dead channel, `group_send` silently fails to reach it but
  the group grows unbounded over the process lifetime.
- **Ordering**: Redis pub/sub does not guarantee cross-group or cross-consumer
  ordering — never assume message B sent after message A arrives after it; embed a
  sequence number or timestamp if order matters.
- **At-least-once, not exactly-once**: a reconnect or `ChannelFull` retry can
  duplicate a message — make client-side handlers idempotent (key updates by
  vehicle ID + timestamp, not append-only).
- **Blocking calls in an async consumer**: a synchronous DB call or `requests.get()`
  inside `AsyncJsonWebsocketConsumer` blocks the entire event loop, stalling every
  other connection on that worker — use `database_sync_to_async` or `httpx.AsyncClient`.
- **No origin check**: relying only on `AuthMiddlewareStack` without
  `AllowedHostsOriginValidator` — auth alone does not stop a malicious site from
  opening a socket using the victim's browser session.
- **Unbounded per-connection state**: accumulating history/buffers on `self` in the
  consumer instance without a cap — each open connection is a long-lived object.

## Checklist

- [ ] `connect()` authenticates and closes with a distinct code before `accept()`
- [ ] `AllowedHostsOriginValidator` (or equivalent) wraps the WebSocket router
- [ ] One channel-layer group per topic/room, not one global group
- [ ] `group_discard` called in every `disconnect()` path
- [ ] Heartbeat interval shorter than any proxy/LB idle timeout
- [ ] Client reconnect uses exponential backoff with jitter, and resyncs state
- [ ] Per-connection outbound queue is bounded; `ChannelFull` is caught, not fatal
- [ ] Client-side message handling is idempotent (duplicates tolerated)
- [ ] No blocking (sync DB/HTTP) calls inside async consumer methods
- [ ] SSE considered and rejected (not defaulted past) for one-way streams
- [ ] Channels tested with `WebsocketCommunicator`, channel layer mocked in unit tests
