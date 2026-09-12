---
name: mqtt-messaging
description: MQTT broker and client patterns — topic design, QoS levels, retained messages, last will, keepalive, persistent sessions, TLS/auth/ACL security, bridging, and request/response patterns for IoT and real-time messaging systems.
origin: authored
---

# MQTT Messaging

Broker and client patterns for building reliable MQTT-based messaging systems.

## Prerequisites (preflight)

Requires **paho-mqtt**. Verify; warn if missing:

```bash
python -c "import paho.mqtt" 2>/dev/null || echo "WARN: paho-mqtt missing — pip install paho-mqtt"
```

## When to Activate

- Designing an MQTT topic hierarchy for a new integration
- Choosing QoS levels for a publisher or subscriber
- Debugging duplicate, lost, or stale messages
- Implementing device presence / last will and testament (LWT)
- Configuring broker security (TLS, auth, ACL)
- Bridging brokers or building request/response over MQTT
- Reviewing a client's reconnection or session-persistence logic

## Core Concepts

### Broker & Clients

MQTT is a publish/subscribe protocol over a central broker (Mosquitto, EMQX, HiveMQ,
AWS IoT Core). Clients never talk directly to each other — they publish to topics and
subscribe to topics; the broker routes matching messages.

Python client libraries:

- **paho-mqtt** — synchronous, callback-based, the reference client. Use for scripts,
  simple daemons, Django management commands.
- **asyncio-mqtt** (or `aiomqtt`, its maintained fork) — async context-manager API,
  integrates with `asyncio`/`asyncio.gather`. Use inside async services (FastAPI,
  asyncio-based workers) to avoid blocking the event loop.

```python
# paho-mqtt: minimal subscriber
import paho.mqtt.client as mqtt

def on_connect(client, userdata, flags, rc, properties=None):
    client.subscribe("fleet/+/telemetry", qos=1)

def on_message(client, userdata, msg):
    print(msg.topic, msg.payload.decode())

client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="dispatcher-01")
client.on_connect = on_connect
client.on_message = on_message
client.connect("broker.internal", 8883, keepalive=60)
client.loop_forever()
```

```python
# aiomqtt: minimal async subscriber
import asyncio
import aiomqtt

async def main() -> None:
    async with aiomqtt.Client("broker.internal", port=8883) as client:
        await client.subscribe("fleet/+/telemetry", qos=1)
        async for message in client.messages:
            print(message.topic, message.payload)

asyncio.run(main())
```

### Topics & Wildcards

Topics are `/`-separated UTF-8 strings, case-sensitive, no leading `/` by convention.
Design them hierarchically, general to specific:

```text
<domain>/<entity-id>/<category>/<attribute>

fleet/vehicle-042/telemetry/gps
fleet/vehicle-042/telemetry/battery
fleet/vehicle-042/command/dispatch
fleet/vehicle-042/status/connection
```

Wildcards (subscribe-only, never valid in a publish topic):

- `+` — single-level wildcard: `fleet/+/telemetry/gps` matches any vehicle.
- `#` — multi-level wildcard, must be the last segment: `fleet/vehicle-042/#`
  matches everything under that vehicle.

Reserved: topics starting with `$` (e.g. `$SYS/#`) are broker-internal metrics —
do not use as an application namespace.

### QoS Levels

| QoS | Guarantee | Cost | Use for |
|---|---|---|---|
| 0 | At most once — fire and forget | Cheapest, no ack | High-frequency telemetry where losing a sample is fine (GPS ping every second) |
| 1 | At least once — acked, may duplicate | One ack round-trip, broker queues until acked | Commands, alerts, state changes where duplicates are tolerable (idempotent handlers) |
| 2 | Exactly once — four-way handshake | Highest latency + broker storage, 2x the round trips of QoS 1 | Billing events, one-shot triggers where a duplicate is a bug (rare in practice) |

Rule of thumb: default to QoS 0 for streaming telemetry, QoS 1 for commands/events,
reserve QoS 2 for genuinely non-idempotent side effects. QoS 2 on a busy broker is a
common unexplained-latency root cause — profile before defaulting to it everywhere.

### Retained Messages

A retained message is stored by the broker and delivered immediately to any new
subscriber, even if published before the subscription existed. Use for "last known
state" topics (device status, current configuration) — never for one-shot commands
or events, since a late subscriber would replay a stale action.

```python
client.publish("fleet/vehicle-042/status/connection", "online", qos=1, retain=True)

# Clear a retained message: publish empty payload with retain=True
client.publish("fleet/vehicle-042/status/connection", payload=None, retain=True)
```

### Last Will and Testament (LWT)

Set before connecting. The broker publishes the will message automatically if the
client disconnects ungracefully (crash, network loss, keepalive timeout) — this is
the standard way to detect device/service presence.

```python
client.will_set(
    "fleet/vehicle-042/status/connection",
    payload="offline",
    qos=1,
    retain=True,
)
client.connect("broker.internal", 8883, keepalive=60)
# On graceful shutdown, publish "online" -> "offline" explicitly and disconnect(),
# which cancels the will -- avoids a spurious offline blip on planned restarts.
```

### Keepalive & Reconnection

Keepalive is the max interval (seconds) between control packets before the broker
assumes the client is dead and fires its LWT. Set it to the shortest interval your
network/battery budget allows for timely presence detection — typically 30-60s for
always-on services, 60-300s for battery-constrained devices.

Reconnection must be explicit — clients do not auto-resubscribe unless the library
handles it:

```python
client.reconnect_delay_set(min_delay=1, max_delay=60)  # paho: exponential backoff
client.on_connect = lambda c, u, f, rc, p=None: c.subscribe("fleet/+/telemetry", qos=1)
# Re-subscribing in on_connect makes reconnects self-healing, including after a
# clean-session reconnect that wiped prior subscriptions.
```

### Persistent Sessions

`clean_session=False` (MQTT 3.1.1) or `Session Expiry Interval` (MQTT 5) tells the
broker to remember subscriptions and queue QoS 1/2 messages while the client is
offline, replaying them on reconnect. Requires a **stable, unique `client_id`** —
reusing a persistent session's client_id from two processes causes each to steal
the other's connection and message queue.

```python
client = mqtt.Client(client_id="dispatcher-01", clean_session=False)
```

Trade-off: persistent sessions grow broker memory/disk while the client is offline
for long periods — set a session/message expiry interval so an abandoned client_id
doesn't accumulate an unbounded backlog.

## Security

- **TLS**: always in production, port 8883. Verify broker certificate; use mutual
  TLS (client certs) for device fleets instead of shared passwords where feasible.
- **Auth**: username/password minimum, backed by a broker-side auth plugin (not a
  hardcoded broker.conf entry) — per-device credentials, not one shared login.
- **ACL**: restrict each client to publish/subscribe only its own topic subtree
  (`fleet/vehicle-042/#` for that vehicle's client, never `fleet/#`). Prevents a
  compromised device from spoofing or eavesdropping on the whole fleet.
- Never embed credentials in a QoS 0 payload or a topic string — topics and QoS
  are visible to broker-side logging/tracing.

```python
client.tls_set(ca_certs="/etc/mqtt/ca.pem")
client.username_pw_set(username="vehicle-042", password=secret_config.get("mqtt_password"))
```

## Bridging

A bridge connects two brokers, forwarding topics between them (e.g. edge broker in a
vehicle depot ↔ cloud broker). Configure explicit topic filters per direction — a
bidirectional bridge on `#` risks a publish loop across the two brokers.

```text
# mosquitto bridge config
connection depot-to-cloud
address cloud-broker.internal:8883
topic fleet/+/telemetry/# out 1
topic fleet/+/command/# in 1
```

## Request/Response Pattern

MQTT is pub/sub, not RPC — implement request/response with a correlation ID and a
per-client (or per-request) response topic, mirroring AMQP's reply-to convention
(MQTT 5 has native `Response Topic` / `Correlation Data` properties for this).

```text
Request:  fleet/vehicle-042/command/request       { "correlation_id": "abc", "action": "unlock" }
Response: fleet/vehicle-042/command/response/abc  { "correlation_id": "abc", "status": "ok" }
```

Subscribe to the response topic (or pattern) *before* publishing the request to avoid
a race where the response arrives before the subscription is active.

## Pitfalls

- **QoS 2 everywhere** — treating it as "the safe default" quietly doubles broker
  load and latency versus QoS 1; reserve it for genuinely non-idempotent actions.
- **Retained message on a command/event topic** — a new subscriber replays a stale
  "unlock" command on connect. Retain only true state topics.
- **Forgetting to clear a retained message** — a decommissioned device's last
  "online" retained message misleads every future subscriber; publish an empty
  retained payload to clear it.
- **Reusing `client_id` across processes** with persistent sessions — each steals
  the other's session, causing silent message loss for one side.
- **Not re-subscribing in `on_connect`** — a clean-session reconnect silently drops
  all subscriptions; the client looks connected but stops receiving anything.
- **Wildcard ACLs (`#` for everyone)** — turns a single compromised credential into
  a fleet-wide eavesdropping/spoofing vector.
- **No keepalive tuning** — too long delays LWT-based presence detection; too short
  causes false "offline" flaps on flaky networks.
- **Blocking work in `on_message`** — paho's network loop thread stalls, causing
  broker-side backpressure and eventual disconnects; hand off to a queue/executor.
- **Bidirectional bridge without topic scoping** — creates publish loops that can
  saturate both brokers.

## Checklist

- [ ] Topic hierarchy is domain/entity/category/attribute, documented, versionable
- [ ] QoS chosen per topic based on idempotency and volume, not blanket QoS 2
- [ ] Retained flag used only on true "current state" topics, cleared on teardown
- [ ] LWT configured with QoS 1+ and `retain=True` on a status topic
- [ ] Keepalive interval matches network/battery constraints; reconnect logic
      re-subscribes on every `on_connect`
- [ ] `client_id` stable and unique per client when using persistent sessions
- [ ] TLS enabled (port 8883), per-client credentials, ACL scoped to that
      client's own topic subtree
- [ ] Bridges configured with explicit, directional topic filters — no open `#`
- [ ] Request/response uses correlation IDs; subscriber active before publish
- [ ] `on_message` handlers are non-blocking; heavy work offloaded to a queue
