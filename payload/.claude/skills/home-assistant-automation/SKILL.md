---
name: home-assistant-automation
description: Home Assistant architecture, entities/domains, YAML configuration (configuration.yaml, packages, includes), automations (trigger/condition/action), Jinja templates, scripts/scenes, helpers, integrations/devices, MQTT/Zigbee, secrets.yaml, blueprints, HACS, and testing/reload workflows.
origin: authored
---

# Home Assistant Automation

Configuring, automating, and maintaining a Home Assistant installation.

## Prerequisites (preflight)

Before using this skill, ensure you have Home Assistant installed and configured.

**Home Assistant and CLI:**
```bash
# Check for Home Assistant CLI
command -v hass || echo "WARN: Home Assistant not found — see https://www.home-assistant.io/installation/"
```

## When to Activate

- Writing or refactoring `configuration.yaml` and its includes/packages
- Creating automations, scripts, or scenes
- Writing Jinja2 templates for sensors or automation logic
- Adding integrations, devices, or helpers (input_boolean, input_number, timers)
- Working with MQTT or Zigbee (Zigbee2MQTT, ZHA) entities
- Managing secrets, blueprints, or HACS custom components
- Debugging a misfiring or looping automation

## Architecture

```text
Core            state machine + event bus (all entities, all events)
Integrations    connect devices/services to Core (MQTT, Zigbee, cloud APIs)
Entities        addressable objects: domain.object_id (light.kitchen)
Automations     trigger -> condition -> action rule engine
Scripts         reusable action sequences, callable from automations/UI
Scenes          named snapshot of entity states, applied atomically
Helpers         input_*, timer, template entities for state/UI glue
Frontend        Lovelace dashboards (display only, not config source)
```

Entities are grouped by **domain** (`light`, `switch`, `sensor`, `binary_sensor`,
`climate`, `cover`, `person`, `zone`…). Domain dictates available services
(`light.turn_on`, `cover.close_cover`) and expected state values.

## Configuration Structure

```text
config/
├── configuration.yaml       # entry point, includes only
├── secrets.yaml             # gitignored, referenced via !secret
├── automations.yaml         # UI-managed automations (avoid hand-editing)
├── scripts.yaml
├── scenes.yaml
└── packages/
    ├── kitchen.yaml         # one package per room/domain concern
    ├── presence.yaml
    └── notifications.yaml
```

`configuration.yaml` stays thin — includes only:

```yaml
homeassistant:
  packages: !include_dir_named packages

automation: !include automations.yaml
script: !include scripts.yaml
scene: !include scenes.yaml
```

### Packages over scattered top-level keys

A package bundles everything for one concern (automation, sensor, input_boolean,
script) in a single file — easier to review, move, or delete as a unit than
hunting across `automations.yaml`, `sensors.yaml`, `scripts.yaml` for related config.

```yaml
# packages/presence.yaml
input_boolean:
  guest_mode:
    name: Guest Mode

automation:
  - alias: "Presence: disable guest mode at night"
    trigger:
      - platform: time
        at: "23:00:00"
    action:
      - service: input_boolean.turn_off
        target:
          entity_id: input_boolean.guest_mode
```

## Automations

Three-part structure: **trigger** (what fires it) -> **condition** (gate,
optional) -> **action** (what runs).

```yaml
automation:
  - alias: "Lights: kitchen on at sunset when someone home"
    id: kitchen_lights_sunset
    trigger:
      - platform: sun
        event: sunset
        offset: "-00:30:00"
    condition:
      - condition: state
        entity_id: group.family
        state: "home"
    action:
      - service: light.turn_on
        target:
          entity_id: light.kitchen
        data:
          brightness_pct: 60
    mode: single
```

- Always set `alias` and a stable `id` — required for UI editing and traceability.
- `mode: single` (default) drops re-triggers while running; use `restart` for
  "latest wins" automations, `queued`/`parallel` only when genuinely needed —
  each adds complexity and potential race conditions.
- Prefer multiple triggers with `trigger.platform` checks over duplicating an
  automation per trigger source.

## Templates (Jinja2)

Used in template sensors, conditions, and action data. Keep templates short;
push complex logic into a template sensor with a clear name rather than
inlining a 10-line expression inside an automation action.

```yaml
sensor:
  - platform: template
    sensors:
      average_temperature:
        friendly_name: "Average Temperature"
        unit_of_measurement: "°C"
        value_template: >
          {{ (states('sensor.living_room_temp') | float(0) +
              states('sensor.bedroom_temp') | float(0)) / 2 }}
```

- Always use `| float(default)` / `| int(default)` filters — a missing/unavailable
  sensor returns `unknown`, which breaks unfiltered arithmetic.
- Use `is_state()` / `is_state_attr()` over raw `states.x.state ==` comparisons.
- Test templates in **Developer Tools > Template** before committing them.

## Scripts & Scenes

Scripts are named, reusable action sequences — call them from multiple
automations instead of duplicating an action list.

```yaml
script:
  goodnight:
    alias: "Goodnight routine"
    sequence:
      - service: light.turn_off
        target:
          entity_id: all
      - service: lock.lock
        target:
          entity_id: lock.front_door
      - delay: "00:00:05"
      - service: climate.set_temperature
        target:
          entity_id: climate.house
        data:
          temperature: 18
```

Scenes capture a snapshot of entity states, applied atomically with
`scene.turn_on` — better than an automation with 10 parallel `service` calls
when the goal is "restore this exact state."

## Helpers

- `input_boolean` — manual flags/toggles used as automation conditions.
- `input_number` / `input_select` — user-adjustable thresholds or modes.
- `input_datetime` — user-configurable schedule times (avoid hardcoding times
  automations should let the user tune).
- `timer` — countdown state machine (start/pause/finish events), better than a
  manual `delay` when the timer must be cancellable or visible in the UI.
- Template entities — read-only derived state, not for user input.

## Integrations, MQTT & Zigbee

- Native integrations (config-flow-based) are preferred over YAML-only
  integrations — configure via UI when available; YAML is reserved for what
  the UI cannot express (packages, complex templates).
- MQTT entities are defined by discovery (auto) or explicit YAML
  (`mqtt: light: ...`) with `state_topic`/`command_topic` pairs — verify topics
  with an MQTT client (e.g. `mosquitto_sub -t 'zigbee2mqtt/#' -v`) before wiring
  an entity.
- Zigbee2MQTT vs ZHA: Zigbee2MQTT exposes devices as MQTT topics (more
  device-driver coverage, external process); ZHA is a native HA integration
  (no MQTT broker dependency, tighter HA integration). Pick one per Zigbee
  radio — don't mix both against the same coordinator.
- Group same-domain entities (`light.turn_on` on a `light.group`) at the
  integration/helper level rather than an automation firing `entity_id: [a,b,c]`
  every time — a group is reusable and shows a single card in the UI.

## Secrets

```yaml
# secrets.yaml (gitignored)
mqtt_password: "REPLACE_ME"       # pragma: allowlist secret
lat_home: 48.8566
lon_home: 2.3522
```

```yaml
# configuration.yaml
mqtt:
  password: !secret mqtt_password
```

- Never commit `secrets.yaml`; ship `secrets.yaml.example` with placeholder
  keys instead.
- No credentials, tokens, or precise home coordinates hardcoded inline in any
  tracked YAML file.

## Blueprints & HACS

- Blueprints package a reusable automation/script with declared `input:`
  fields — prefer a blueprint over copy-pasting the same automation across
  multiple rooms/entities with only the target changed.
- HACS (Home Assistant Community Store) manages third-party integrations,
  cards, and blueprints outside HA core — pin versions, review the
  repository's stars/maintenance status, and re-check after every HA core
  upgrade for breaking changes.

## Testing & Reload

- **Configuration > Settings > Check Configuration** (or `ha core check` on
  Supervisor/OS installs) before every restart — a YAML syntax error can leave
  automations silently disabled.
- Reload targeted domains instead of a full restart: **Developer Tools >
  YAML** offers per-domain reload (Automations, Scripts, Scenes, Templates) —
  much faster feedback than a full HA restart.
- Use **Developer Tools > Template** to dry-run any template change.
- Watch **Settings > System > Logs** after a reload for deprecation warnings
  and integration errors.

## Common Pitfalls

- **YAML indentation** — mixed tabs/spaces or a misaligned list item silently
  drops keys; use a YAML-aware editor and validate before restart.
- **Heavy templates on every state change** — a template sensor recalculating
  over many entities on every tick adds real CPU load; scope
  triggers/entities tightly or move to a `trigger`-based template sensor.
- **Automation loops** — automation A changes an entity that triggers
  automation B, which changes it back, re-triggering A; break the cycle with a
  `condition` guard checking the target isn't already in the desired state.
- **Duplicated logic across automations** — the same condition or action list
  copy-pasted per room; extract to a script, blueprint, or template sensor.
- **`all` in `entity_id` targets** — turning off `entity_id: all` for a domain
  is broad and error-prone; target explicit groups instead.
- **Editing UI-managed files by hand** — hand-editing `automations.yaml` while
  the UI editor is also in use causes conflicting saves; pick one authority
  per file (YAML packages or the UI, not both) for the same automation.

## Checklist

- [ ] `configuration.yaml` stays thin; logic lives in `packages/`
- [ ] Every automation has `alias` + stable `id`
- [ ] Templates use `| float(default)` / `| int(default)` guards
- [ ] No secrets or precise coordinates hardcoded outside `secrets.yaml`
- [ ] Repeated automation/action logic extracted to a script or blueprint
- [ ] Automation `mode` chosen deliberately (not left ambiguous for
      re-triggering automations)
- [ ] Config validated (Check Configuration) before restart
- [ ] Domain reload used instead of full restart where possible
- [ ] MQTT/Zigbee topics verified against a live client, not assumed
- [ ] HACS components pinned and reviewed after HA core upgrades
