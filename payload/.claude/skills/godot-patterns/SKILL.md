---
name: godot-patterns
description: Godot 4.x architecture patterns — GDScript typed, scene composition, signals, autoloads, resources, state machines, save systems, export targets (desktop, web, mobile), Godot MCP integration.
origin: chrysa
---

# Godot Development Patterns

Production-grade Godot 4.x patterns for the chrysa game projects.

## When to Activate

- Building Godot 4.x games
- Architecting scene/node hierarchies
- Setting up autoloads and global state
- Implementing save/load systems
- Exporting to web, desktop, or mobile

## Project Structure

```text
project/
├── project.godot
├── scenes/
│   ├── game/
│   │   ├── game.tscn          # Main game scene
│   │   ├── player/
│   │   │   ├── player.tscn
│   │   │   └── player.gd
│   │   └── enemies/
│   ├── ui/
│   │   ├── hud.tscn
│   │   └── main_menu.tscn
│   └── levels/
│       └── level_01.tscn
├── scripts/
│   ├── autoloads/             # Global singletons
│   │   ├── game_manager.gd
│   │   ├── audio_manager.gd
│   │   └── event_bus.gd
│   ├── resources/             # Custom Resource classes
│   └── utils/
├── assets/
│   ├── sprites/
│   ├── audio/
│   └── fonts/
└── addons/
```

## Autoload Architecture

```gdscript
# res://scripts/autoloads/event_bus.gd
# Add to Project > Project Settings > Autoload
extends Node

# All game-wide signals defined here (decoupling)
signal player_died
signal score_changed(new_score: int)
signal level_completed(level_id: int)
signal enemy_spawned(enemy: Node)

# Usage from anywhere:
# EventBus.player_died.emit()
# EventBus.score_changed.connect(_on_score_changed)
```

## Resource-Based Data

```gdscript
# res://scripts/resources/enemy_config.gd
class_name EnemyConfig extends Resource

@export var enemy_name: String = "Goblin"
@export_range(1, 1000) var max_health: int = 100
@export var move_speed: float = 150.0
@export var attack_damage: int = 10
@export var drop_table: Array[ItemConfig] = []

# Create assets: right-click in FileSystem > New Resource > EnemyConfig
```

## Scene Composition Pattern

```gdscript
# res://scenes/game/player/player.gd
class_name Player extends CharacterBody2D

# Direct refs via @onready (not get_node() at runtime)
@onready var sprite: AnimatedSprite2D = $AnimatedSprite2D
@onready var state_machine: StateMachine = $StateMachine
@onready var hitbox: Area2D = $Hitbox
@onready var health_component: HealthComponent = $HealthComponent

# Config injected (not hardcoded)
@export var config: PlayerConfig

func _ready() -> void:
    health_component.died.connect(_on_died)
    health_component.initialize(config.max_health)

func _on_died() -> void:
    EventBus.player_died.emit()
    queue_free()
```

## Typed State Machine

```gdscript
# res://scripts/utils/state_machine.gd
class_name StateMachine extends Node

var current_state: State

func transition_to(new_state: State, msg: Dictionary = {}) -> void:
    if current_state:
        current_state.exit()
    current_state = new_state
    current_state.enter(msg)

func _process(delta: float) -> void:
    if current_state:
        current_state.update(delta)

func _physics_process(delta: float) -> void:
    if current_state:
        current_state.physics_update(delta)

# Base state class
class_name State extends Node
func enter(_msg: Dictionary = {}) -> void: pass
func exit() -> void: pass
func update(_delta: float) -> void: pass
func physics_update(_delta: float) -> void: pass
```

## Save System

```gdscript
# res://scripts/autoloads/save_manager.gd
extends Node

const SAVE_PATH := "user://save_game.dat"

func save_game(data: Dictionary) -> void:
    var file := FileAccess.open(SAVE_PATH, FileAccess.WRITE)
    if file:
        file.store_var(data)  # binary, not JSON (faster, handles Resource types)

func load_game() -> Dictionary:
    if not FileAccess.file_exists(SAVE_PATH):
        return {}
    var file := FileAccess.open(SAVE_PATH, FileAccess.READ)
    return file.get_var() if file else {}

func delete_save() -> void:
    DirAccess.remove_absolute(SAVE_PATH)
```

## Input System (typed actions)

```gdscript
# Define actions in Project > Input Map
# Access via StringName for performance
const ACTION_JUMP := &"jump"   # StringName literal
const ACTION_ATTACK := &"attack"

func _unhandled_input(event: InputEvent) -> void:
    if event.is_action_pressed(ACTION_JUMP):
        _jump()
    elif event.is_action_pressed(ACTION_ATTACK):
        _attack()

# Analog input
var move_dir := Input.get_vector(&"move_left", &"move_right", &"move_up", &"move_down")
```

## Godot MCP Integration

```text
Tool: gdscript-mcp (uvx gdscript-mcp)
Capabilities:
  - GDScript LSP queries (symbols, definitions, completions)
  - Scene file inspection (.tscn parsing)
  - Resource inspection (.tres)
  - Project structure analysis

For full editor control: use GDScript Python bridge
(gdscript-lsp + JSON-RPC socket)
```

## Performance Checklist

- [ ] Cache `@onready` nodes — never `get_node()` in `_process`
- [ ] Use `set_process(false)` / `set_physics_process(false)` when idle
- [ ] `VisibleOnScreenNotifier2D/3D` to disable off-screen nodes
- [ ] `StringName` for all frequently-compared strings (`&"name"`)
- [ ] Avoid dynamic dispatch in hot loops — use typed arrays
- [ ] Shader effects > GDScript for visual-only work
- [ ] `Object.call_deferred()` to avoid cross-frame issues

## Export Targets

| Platform | Renderer | Compression |
|----------|----------|-------------|
| Desktop | Vulkan (Forward+) | BC7 textures |
| Web | Compatibility (WebGL 2) | No BCn (use ASTC) |
| Android | Compatibility | ETC2 / ASTC |
| iOS | Compatibility | ASTC |
