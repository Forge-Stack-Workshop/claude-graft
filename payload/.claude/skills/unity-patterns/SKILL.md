---
name: unity-patterns
description: C# scripting patterns, GameObjects and component architecture, physics simulation, UI systems, animation controllers, prefab design, ScriptableObjects, debugging techniques, and build/deployment optimization for Unity game development.
origin: Unity Certified Programmer Exam Guide (Second Edition) — Packt Publishing
---

# Unity Engine Programming Patterns

Professional Unity development rests on component-based architecture, a handful of
well-chosen design patterns, and disciplined performance practice across scripting,
physics, UI, and animation. This skill condenses the patterns and pitfalls validated
by the Unity Certified Programmer exam into an engine-agnostic-style reference: apply
it to any Unity project regardless of genre, render pipeline, or target platform.

## When to Activate

**Use when:**

- Architecting a game project with reusable systems (managers, spawners, controllers).
- Building interactive systems that couple GameObjects, physics, and UI.
- Scaling game logic without duplicating code via prefabs, ScriptableObjects, and
  design patterns.
- Choosing between MonoBehaviour lifecycle callbacks, coroutines, and events for
  timing-sensitive logic.
- Optimizing performance in scenes with hundreds of objects, colliders, or UI elements.
- Debugging runtime failures via Console, interfaces, and Script Execution Order.
- Preparing standalone builds across platforms (PC, mobile, WebGL, VR).

**Not applicable:** Static analysis outside Unity, visual/art asset creation, shader
authoring, or non-Unity engines (Unreal, Godot, custom engines).

---

## SOLID and Design-Pattern Foundations

Unity code degrades fast without discipline, since MonoBehaviours make it easy to pile
unrelated logic into one class. Apply SOLID pragmatically:

- **Single Responsibility:** one MonoBehaviour = one concern (movement, health, input).
  Split "God" manager classes before they reach 4+ unrelated responsibilities.
- **Open/Closed:** extend behavior via interfaces and ScriptableObject configs, not by
  editing existing classes with new `if` branches per game feature.
- **Liskov/Interface Segregation:** prefer small, focused interfaces (`IDamageable`,
  `IInteractable`) over one bloated `IActor` that forces empty method stubs.
- **Dependency Inversion:** depend on interfaces, not concrete MonoBehaviour types, so
  systems can be tested or swapped (e.g., `IInputProvider` instead of a hard `Input.*` call).

**Structural vs. behavioral vs. creational patterns** all show up in Unity code:
Abstract Factory and Object Pool (creational), Observer/events (behavioral),
Decorator via component composition (structural — "prefer composition over inheritance"
is the core Unity design idiom: build behavior by attaching components, not by
deepening a class hierarchy).

## Core Scripting Patterns

**Singleton:** convenient for a small number of global managers (Game, Audio, UI) but
argued against by SOLID — it hides dependencies and complicates testing. Cap it at
2–3 managers; anything more indicates missing separation of concerns. Guard against
duplicate instances in `Awake()` and consider `DontDestroyOnLoad` only for objects
that must survive scene loads.

**Abstract Factory:** shared interface and properties across object families. Define
a base template (e.g., `IActorTemplate`) that Enemies, Player, and Bosses implement.
Reduces duplication when objects share common stat systems (health, damage, rigidbody
setup).

**Prototype / Object Pool:** clone or reuse objects instead of destroying and
instantiating. Pre-allocate a fixed-size array of pooled instances, fetch an inactive
one, reset its state, re-enable it. Cuts garbage-collection overhead by 70–90% on
high-frequency spawners (bullets, particles, enemies).

**MonoBehaviour Lifecycle:** know the execution order precisely.

| Callback | When |
| --- | --- |
| `Awake()` | Object created, before any `Start()`; use for self-contained init and caching component references (`GetComponent<T>()`) |
| `OnEnable()` | Every time the object is enabled; pair with `OnDisable()` for event subscribe/unsubscribe |
| `Start()` | Once, before the first frame update, after all `Awake()` calls in the scene |
| `Update()` | Every frame; input polling, non-physics logic |
| `FixedUpdate()` | Fixed timestep; **all physics code** (`Rigidbody.AddForce`, `MovePosition`) belongs here, never in `Update()` |
| `LateUpdate()` | After all `Update()` calls; camera follow, UI sync |

Use `[ExecuteInEditMode]` and `[RequireComponent]` for editor safety and to prevent
missing-dependency bugs. When multiple `Awake()` calls initialize shared state, resolve
ordering conflicts via **Script Execution Order** (Edit → Project Settings → Script
Execution Order) rather than relying on scene-object ordering, which is undefined.

**Coroutines vs. async:** `StartCoroutine` with `yield return new WaitForSeconds(...)`
handles frame-spread logic (fades, delayed spawns, sequenced dialogue) without blocking
the main thread. Always cache and `StopCoroutine` on disable/destroy to avoid
null-reference callbacks on destroyed objects.

**Events over polling:** C# `event`/`delegate` (or `UnityEvent` for inspector wiring)
decouples systems — a `Health` component raises `OnDeath`, and UI/audio/analytics
subscribe independently instead of `Health` calling into each of them directly.

## GameObjects, Components, and Physics

**Component Hierarchy:** every GameObject is a container of components (Transform,
Mesh Renderer, Collider, Rigidbody, Script). Enforce required components with
`[RequireComponent(typeof(Rigidbody))]` to prevent accidental removal and downstream
null references.

**Colliders & Triggers:** `SphereCollider` is cheapest for physics queries, followed
by `CapsuleCollider`, then `BoxCollider`; avoid `MeshCollider` on moving objects.
`isTrigger = true` reports contact without applying physical force — use it for
detection zones. `Rigidbody` with `Kinematic` body type moves via script
(`transform.position` or `Rigidbody.MovePosition`), unaffected by physics forces;
`Dynamic` responds to gravity and applied forces.

**Physics Queries:** `Rigidbody.AddForce()` applies impulse/force. `OnCollisionEnter`
fires for physical (non-trigger) contact; `OnTriggerEnter` fires for trigger volumes.
`Physics.OverlapSphere()` is a one-shot spatial query — expensive if called every
frame; cache results or throttle the call rate. `Camera.WorldToViewportPoint()`
converts world 3D coordinates to normalized screen space (0–1) for UI/camera-bounds
checks.

## UI, Canvas, and Interaction

**Canvas System:** the UI root container renders on top of (or in) the camera view.
`RectTransform` replaces `Transform` for UI elements; anchor and pivot define layout
origin and how elements respond to resolution changes.

**UI Prefabs:** store panels, buttons, sliders as prefabs. Drive their content (title,
description, icon) from a ScriptableObject instead of hardcoding strings, so designers
can author shop items, upgrades, or menu options via the Inspector.

**Event Binding:** wire callbacks with `Button.onClick.AddListener(OnButtonClick)` or
`Toggle.onValueChanged.AddListener()`. Always `RemoveListener`/unsubscribe in
`OnDisable()` to avoid duplicate bindings on object reuse (pooled UI) or leaked
references. Batch UI text/graphic updates instead of writing every frame — use
TextMeshPro for text-heavy UI and only update when the underlying value changes.

## Animation and State Machines

**Animator Controller:** a finite state machine for animation clips. States represent
poses/cycles; transitions connect states via boolean/int/float/trigger parameters
exposed to script (`Animator.SetFloat`, `Animator.SetTrigger`). The Animator advances
on its own update loop, decoupled from arbitrary game logic — read state via
parameters, not by inspecting clip names in code.

**Animation Events:** place event markers on the timeline in the Animation window to
call a method on a specific frame (e.g., play a footstep sound, spawn a particle,
apply damage at the exact moment a weapon connects). Prefer this over hardcoded
`Invoke(...)` delays that drift when clip length or playback speed changes.

**Blend Trees / Layers:** use blend trees for continuous motion blending (walk↔run by
speed) and animation layers with avatar masks to combine upper/lower body animations
independently (e.g., aim while running).

## Prefabs, Instantiation, and Reusability

**Prefab Workflow:** drag a configured GameObject from Scene into `Assets/Prefabs` to
create the master asset; scene objects become instances. Editing the prefab propagates
to all instances; per-instance overrides in the Scene hold local variation without
breaking the link. Use **nested prefabs** to compose complex objects (a `Weapon`
prefab nested inside a `Character` prefab) so a change to the weapon propagates
everywhere it's used.

**ScriptableObjects:** serializable data containers with no MonoBehaviour overhead and
no scene/GameObject dependency. Create via `Create > ScriptableObject > MyType`.
Use them for shared configuration (enemy stats, item definitions, level data,
audio-event channels) so designers populate data via the Inspector without touching
code, and so the same asset can be referenced by multiple objects without duplicating
memory. Combine with a factory/template interface (e.g., `IActorTemplate`) to spawn
consistent object families from data.

## Debugging Techniques

**Console Window:** use `Debug.Log()`, `Debug.LogWarning()`, `Debug.LogError()` with
string interpolation or concatenation for context (`Debug.Log($"health: {health}")`).
Double-click an error/warning to jump to the offending line. Pink materials in the
Scene/Game view indicate a missing material or an incompatible shader (common after a
render-pipeline switch).

**Error Patterns:**

- `NullReferenceException` on a public/serialized field → check the Inspector; public
  fields must be manually dragged in, they are never auto-wired.
- Missing `Rigidbody` when code calls `.velocity`/`.AddForce()` → add
  `[RequireComponent(typeof(Rigidbody))]`.
- Missing `Collider` when `OnCollisionEnter`/`OnTriggerEnter` never fires → verify both
  objects have a collider and at least one has a `Rigidbody`.
- Silent no-op event → check `RemoveListener` was called somewhere, unsubscribing the
  handler before it should fire.

**Interface Contracts:** implement an interface (`IActorTemplate`, `IDamageable`) with
required methods — Unity/the compiler flags missing implementations immediately,
forcing every actor type to define `Health`, `TakeDamage()`, etc. consistently, which
turns a runtime bug into a compile-time error.

## Performance Optimization

- **Collider efficiency:** `SphereCollider` < `CapsuleCollider` < `BoxCollider` <
  `MeshCollider` (increasing cost). Use trigger colliders (no physics resolution) for
  pure detection layers.
- **Object pooling:** pre-allocate enemy/bullet/particle pools at scene start; reuse
  instead of `Instantiate` + `Destroy`. Typical gain: 50–80% reduction in frame time
  on high-spawn-rate scenarios.
- **UI Canvas optimization:** batch UI updates; avoid setting text/image every frame.
  Split static and dynamic canvases so a dynamic-element rebuild doesn't force a full
  canvas rebuild. Use `canvas.worldCamera = null` for Screen Space – Overlay UI.
- **Avoid per-frame allocation:** cache `GetComponent<T>()` results in `Awake()`
  instead of calling it in `Update()`; avoid `new` inside hot loops (boxing, LINQ,
  string concatenation) — each allocation adds GC pressure.
- **Spatial partitioning:** for frequent proximity checks, replace repeated
  `Physics.OverlapSphere()` calls with a grid/quadtree or Unity's `NavMesh`/spatial
  query APIs, and throttle checks to a fixed interval rather than every frame.

## Build and Deployment

- Add every playable scene to **Scenes In Build** (File → Build Settings) — a missing
  scene reference fails silently at runtime (`SceneManager.LoadScene` throws).
- Build for the target platform explicitly (PC, Android, iOS, WebGL, consoles); switch
  platform before tweaking platform-specific Player Settings (resolution, orientation,
  API level).
- Enable **IL2CPP** for release builds on supported platforms — better performance and
  smaller builds than Mono, at the cost of longer build times.
- **Managed code stripping / link.xml:** aggressive stripping can remove
  reflection-only-referenced types (e.g., classes only instantiated via
  `Activator.CreateInstance` or JSON deserialization). Add a `link.xml` to preserve
  them explicitly rather than disabling stripping project-wide.
- Verify platform-specific input/permission requirements (Android manifest
  permissions, iOS capability entitlements) before the first store submission.

---

## Common Pitfalls & Anti-Patterns

- **Multiple Singletons:** the Singleton pattern scales poorly; limit to 2–3 global
  managers (Game, Audio, UI). More indicates missing separation of concerns.
- **Circular Dependencies:** Manager A references Manager B; B references A. Break the
  cycle with events or a third Coordinator/mediator.
- **Missing Component References:** public fields left unwired in the Inspector.
  Enforce with `[SerializeField]` + `[RequireComponent]`, and fail fast with a null
  check in `Awake()` rather than a downstream `NullReferenceException`.
- **Physics in `Update()`:** applying forces or moving a `Rigidbody` outside
  `FixedUpdate()` produces frame-rate-dependent, jittery physics.
- **Physics Queries Every Frame:** `Physics.OverlapSphere()`/raycasts every frame are
  expensive; cache results or throttle to an interval.
- **Unoptimized Canvas:** dynamic UI rebuilt every frame (text/sorting changes).
  Batch updates; use TextMeshPro for text-heavy UI.
- **No Script Execution Order:** multiple `Awake()` functions initializing shared
  state in undefined order → race conditions on scene load.
- **Deep inheritance instead of composition:** subclassing a base `Character` for
  every variant instead of attaching/removing components — leads to rigid,
  hard-to-extend hierarchies. Prefer composition.

## Checklist

- [ ] Singleton managers have single responsibility (no 4+ unrelated features in one class).
- [ ] Physics code (`AddForce`, `MovePosition`) lives in `FixedUpdate()`, not `Update()`.
- [ ] Prefabs stored in `Assets/Prefabs`; scene instances use prefab overrides for variation.
- [ ] Colliders sized appropriately; triggers for detection, dynamic bodies for movement.
- [ ] UI Canvas uses `RectTransform`; buttons bound via `OnClick()` listeners and unbound on disable.
- [ ] Animation states defined in an Animator Controller; parameters (not clip names) drive transitions from script.
- [ ] ScriptableObject templates used for shared data (upgrades, enemies, levels) instead of duplicated MonoBehaviour fields.
- [ ] Console errors resolved; no pink objects or missing components.
- [ ] Object pooling applied to high-frequency spawners (bullets, particles, enemies).
- [ ] Build Settings includes all playable scenes; IL2CPP/link.xml configured for the release build.
- [ ] Script Execution Order configured if multiple managers depend on initialization order.
