---
name: discord-bot
description: Building and operating Discord bots — gateway vs REST, intents and permissions, slash commands, interactions (buttons, selects, modals), event handling in discord.py and discord.js, rate limits, sharding, webhooks, embeds, state management, deployment, and token security.
origin: authored
---

# Discord Bot

Building and running production Discord bots on the gateway + REST API.

## Prerequisites (preflight)

Before using this skill, ensure you have the required packages installed.

**Python packages (discord.py):**
```bash
# Check for discord.py
python -c "import discord" || echo "WARN: pip install discord.py"
```

**Or npm packages (discord.js):**
```bash
# Check for discord.js
npm list discord.js || echo "WARN: npm install discord.js"
```

## When to Activate

- Building a new Discord bot or adding commands to an existing one
- Implementing slash commands, buttons, selects, or modals
- Debugging rate limits (429), disconnects, or missing events
- Reviewing intents, permissions, or token handling
- Deploying or scaling a bot (sharding, webhooks)

## Gateway vs REST

Discord bots use two channels, each for a different purpose.

```text
Gateway (WebSocket, persistent)
  - Receives real-time events: messages, reactions, presence, voice state
  - Bot must stay connected and heartbeat on schedule
  - Used for: event-driven bots, message listeners, presence tracking

REST API (HTTP, request/response)
  - Sends actions: post messages, edit, create commands, manage roles
  - Stateless, rate-limited per route
  - Used for: any action the bot initiates
```

Most bots use both: gateway to receive events, REST to respond. A pure
slash-command bot with no message content access can run on interactions
only (HTTP-based, via an Interactions Endpoint URL) without a gateway
connection at all — cheaper to host, no persistent socket.

## Intents & Permissions

Two separate layers — both must allow an action, or the bot silently
misses events or gets a 403.

### Gateway Intents

Declare only what the bot needs. Over-requesting privileged intents
delays verification and increases attack surface.

```python
# discord.py
import discord

intents = discord.Intents.default()
intents.message_content = True   # PRIVILEGED — must enable in Dev Portal too
intents.members = True           # PRIVILEGED — needed for member cache/join events

client = discord.Client(intents=intents)
```

```javascript
// discord.js
const { Client, GatewayIntentBits } = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, // PRIVILEGED
  ],
});
```

Privileged intents (`MESSAGE_CONTENT`, `GUILD_MEMBERS`,
`GUILD_PRESENCES`) must be toggled on in the Developer Portal. Bots in
100+ guilds need Discord approval to keep them — request only what the
bot's real functionality requires, not "just in case."

### Permissions

- Set the minimum required permission bits on the bot's invite/OAuth2 URL
  — never `ADMINISTRATOR` unless the bot genuinely manages the whole server.
- Check `permissions.has()` (discord.js) / `channel.permissions_for()`
  (discord.py) before acting — a missing permission raises a 403, don't
  let it bubble as an unhandled exception.
- Role hierarchy matters: a bot cannot moderate (kick, ban, manage roles
  on) a member with a role equal to or higher than its own top role.

```python
# discord.py — guard before acting
if not interaction.channel.permissions_for(interaction.guild.me).manage_messages:
    await interaction.response.send_message("Missing Manage Messages permission.", ephemeral=True)
    return
```

## Slash Commands (Application Commands)

Registered via REST, dispatched as interactions over the gateway (or the
HTTP interactions endpoint).

```python
# discord.py (app_commands)
from discord import app_commands

@tree.command(name="ping", description="Check bot latency")
async def ping(interaction: discord.Interaction) -> None:
    await interaction.response.send_message(f"Pong! {round(client.latency * 1000)}ms")

# Sync scope matters:
await tree.sync()                       # global — propagates in ~1 hour, cache widely
await tree.sync(guild=discord.Object(id=GUILD_ID))  # guild — instant, use in dev
```

```javascript
// discord.js
const command = new SlashCommandBuilder()
  .setName("ping")
  .setDescription("Check bot latency");

await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
  body: [command.toJSON()],
});
```

- Register commands globally only once stable — global registration is
  cached client-side and slow to propagate; guild-scoped registration is
  instant and best for iteration.
- Always respond or defer within 3 seconds — Discord invalidates the
  interaction token otherwise.

```python
await interaction.response.defer(ephemeral=True)  # buys up to 15 min
# ... slow work ...
await interaction.followup.send("Done.")
```

## Interactions: Buttons, Selects, Modals

Components carry a `custom_id` used to route the interaction back to
handler code — treat it as untrusted input from the client.

```python
# discord.py — persistent view (survives restarts if registered on client.add_view)
class ConfirmView(discord.ui.View):
    def __init__(self) -> None:
        super().__init__(timeout=None)

    @discord.ui.button(label="Confirm", style=discord.ButtonStyle.danger, custom_id="confirm_action")
    async def confirm(self, interaction: discord.Interaction, button: discord.ui.Button) -> None:
        await interaction.response.edit_message(content="Confirmed.", view=None)
```

```python
# Modal — for structured text input
class FeedbackModal(discord.ui.Modal, title="Send Feedback"):
    message = discord.ui.TextInput(label="Message", style=discord.TextStyle.paragraph)

    async def on_submit(self, interaction: discord.Interaction) -> None:
        await interaction.response.send_message(f"Received: {self.message.value}", ephemeral=True)
```

- Persistent views need `timeout=None` and must be re-registered with
  `client.add_view()` on startup, or buttons stop working after a restart.
- Validate/authorize on every component interaction — a `custom_id`
  encoding a user ID or resource ID must be re-checked against the
  interacting user, never trusted at face value (anyone can click a
  public button).
- Encode state in `custom_id` sparingly (Discord caps it at 100 chars);
  for anything larger, store state server-side keyed by a short token.

## Events (discord.py / discord.js)

```python
# discord.py
@client.event
async def on_ready() -> None:
    logger.info("Logged in as %s", client.user)

@client.event
async def on_message(message: discord.Message) -> None:
    if message.author.bot:
        return  # avoid bot-to-bot loops
    await process_commands(message)
```

```javascript
// discord.js v14
client.once(Events.ClientReady, (readyClient) => {
  console.log(`Ready as ${readyClient.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  // route to command handler
});
```

- Never run blocking/synchronous work inside an event handler — it stalls
  the single event loop and delays heartbeats, risking a gateway
  disconnect. Offload CPU-bound work to a thread/process pool
  (`asyncio.to_thread`, worker_threads) and await it.
- Guard every handler against unexpected payloads (missing guild,
  partial member) — gateway events fire for edge cases like uncached
  messages.

## Rate Limits

- REST rate limits are per-route, returned in response headers
  (`X-RateLimit-Remaining`, `X-RateLimit-Reset-After`). Both discord.py
  and discord.js handle standard bucket queuing automatically — do not
  bypass the library's HTTP client with raw requests.
- A `429` response includes `retry_after` and, rarely, a `global` flag
  meaning the whole bot is limited, not just one route — back off
  globally when that flag is set.
- Bulk operations (mass DM, mass role edit) must be throttled explicitly;
  looping tight REST calls across thousands of members will trip global
  limits and can flag the bot for abuse.
- Gateway has a separate limit: max 120 non-heartbeat payloads per 60s,
  and an identify rate limit (1 per 5s per shard, capped daily) — relevant
  mainly at scale/sharding.

```python
# Let the library queue/retry; never wrap calls in raw httpx bypassing discord.py's http layer
await channel.send("message")  # discord.py queues internally on 429
```

## Sharding

Required once a bot serves ~2,500+ guilds (Discord enforces this at
2,500).

```python
# discord.py — AutoShardedClient handles shard count automatically
client = discord.AutoShardedClient(intents=intents)
```

```javascript
// discord.js — ShardingManager spawns one process per shard
const manager = new ShardingManager("./bot.js", { totalShards: "auto" });
manager.spawn();
```

- Each shard holds a subset of guilds; a guild's events always route to
  the same shard (`guild_id >> 22 % num_shards`).
- State that must be shared across shards (leaderboards, global cooldowns)
  cannot live in per-shard memory — use Redis or a DB.

## Webhooks

Webhooks post messages without a bot session — no gateway, no bot token
needed, good for one-way integrations (CI notifications, logging).

```python
from discord import Webhook
import httpx

async with httpx.AsyncClient() as client:
    webhook = Webhook.from_url(WEBHOOK_URL, client=client)
    await webhook.send("Deployment finished.", username="CI Bot")
```

- Webhook URLs are bearer credentials — anyone with the URL can post as
  that webhook. Treat them as secrets (see Token Security below).
- Webhooks cannot receive events or read messages — outbound only.

## Embeds

```python
embed = discord.Embed(
    title="Build Status",
    description="All checks passed.",
    color=discord.Color.green(),
)
embed.add_field(name="Duration", value="42s", inline=True)
embed.set_footer(text="CI Pipeline")
await channel.send(embed=embed)
```

- Max 10 embeds per message, 6000 total characters across all embed
  fields — validate before sending user-generated content into an embed.
- Prefer embeds over hand-formatted markdown for structured data
  (status, tables, links) — more reliable rendering across clients.

## State Management

- Do not rely on the in-memory member/guild cache surviving a restart —
  reload persistent state (economy balances, cooldowns, active views)
  from a DB or Redis on `on_ready`.
- Command cooldowns and per-guild config belong in a datastore keyed by
  `guild_id` — never in a plain module-level dict for a bot that will
  ever run more than one process/shard.
- Use a task queue (RQ, Celery, or a simple `asyncio` background task)
  for anything that outlives a single interaction's 15-minute token
  window (scheduled reminders, long scans).

## Deployment

```text
- Single process, single shard: any container host (Docker + systemd/k8s), no ingress needed
  (gateway is an outbound WebSocket connection).
- HTTP-interactions-only bot: needs a public HTTPS endpoint + Ed25519
  signature verification on every incoming request.
- Sharded bot: process manager per shard (PM2, k8s Deployment with
  replica = shard count, or a sharding manager process).
- Health check: expose a liveness endpoint separate from Discord's
  gateway (e.g. plain HTTP port) since the gateway connection itself
  isn't externally probeable.
```

```python
# HTTP interactions endpoint — verify every request before processing
from nacl.signing import VerifyKey

def verify_signature(public_key: str, signature: str, timestamp: str, body: bytes) -> bool:
    verify_key = VerifyKey(bytes.fromhex(public_key))
    try:
        verify_key.verify(timestamp.encode() + body, bytes.fromhex(signature))
    except Exception:
        return False
    return True
```

## Token Security

- The bot token is a full-access credential — anyone with it can control
  the bot in every guild it's in. Never commit it, never log it, never
  send it to a client.
- Load from environment variable or secrets manager only; rotate
  immediately via the Developer Portal if a token leaks (old sessions
  are invalidated on regenerate).
- Separate tokens per environment (dev bot application vs. production
  bot application) — never point a local dev bot at production data.
- Client secret (OAuth2) and public key (interaction signature
  verification) are not the token but deserve the same handling — treat
  the whole Developer Portal credential set as secret.

## Common Pitfalls

- **Privileged intents not enabled in the Dev Portal** — code declares
  the intent but the gateway silently drops those events until the
  portal toggle matches.
- **429 storms from tight loops** — mass-messaging or mass-editing
  without throttling trips rate limits and risks an abuse flag.
- **Blocking the event loop** — synchronous DB calls, `requests` instead
  of an async HTTP client, or CPU-bound parsing inside a handler stalls
  heartbeats and causes gateway disconnects/reconnect loops.
- **Interaction token timeout** — not deferring within 3 seconds on slow
  commands leaves the interaction unusable ("This interaction failed").
- **Unregistered persistent views after restart** — buttons/selects from
  before a restart stop responding because the view wasn't re-added via
  `add_view()`.
- **Trusting `custom_id` content** — routing privileged actions off a
  component's `custom_id` without re-checking the invoking user's
  identity/permissions.
- **Global command registration during development** — using
  `tree.sync()` (no guild) while iterating means waiting up to an hour
  to see changes; use guild-scoped sync in dev.
- **Bot responding to its own or other bots' messages** — missing the
  `message.author.bot` guard causes infinite loops between bots.

## Checklist

- [ ] Only required intents requested; privileged ones enabled in both
      code and Developer Portal
- [ ] Bot invited with minimum permission bits, not `ADMINISTRATOR`
- [ ] Every permission-gated action checked before executing, not just
      caught after a 403
- [ ] Slash commands respond or defer within 3 seconds
- [ ] Persistent views re-registered with `add_view()` on startup
- [ ] Component `custom_id` handlers re-validate the interacting user
- [ ] No blocking/synchronous calls inside event handlers or command
      callbacks
- [ ] Bulk REST operations throttled; library's built-in rate-limit
      queuing not bypassed
- [ ] Sharding in place before approaching 2,500 guilds; shared state
      moved to Redis/DB, not in-process memory
- [ ] Bot token and webhook URLs loaded from secrets, never committed or
      logged
- [ ] HTTP interactions endpoint (if used) verifies Ed25519 signatures
      on every request
- [ ] Separate bot applications/tokens for dev and production
