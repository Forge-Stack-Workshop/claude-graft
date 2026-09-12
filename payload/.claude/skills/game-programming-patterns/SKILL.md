---
name: game-programming-patterns
description: Architectural and optimization patterns for interactive, real-time systems—Command, Flyweight, Observer, State, Component, Event Queue, Service Locator, Game Loop, Object Pool, Spatial Partition, Dirty Flag, Double Buffer, Update Method, Subclass Sandbox, Type Object, and Bytecode—that separate concerns, minimize memory overhead, and manage complexity in performance-critical, frame-based codebases.
origin: biblio:Game Programming Patterns by Robert Nystrom
---

# Game Programming Patterns

Proven patterns for maintainable, performant interactive systems. Written for games,
but applicable to any software with a real-time loop, a large population of similar
objects, or a need for replayable/reversible actions: simulations, control loops,
trading engines, animation tools, device fleets.

## When to Activate

- Decoupling input/trigger handling from the logic it invokes (Command)
- Managing thousands of similar objects without memory bloat (Flyweight, Object Pool)
- Broadcasting state changes across loosely coupled systems (Observer, Event Queue)
- Handling complex, mode-dependent actor behavior (State)
- Reducing indirection and cache misses (Data Locality, Dirty Flag, Spatial Partition)
- Centralizing service access without hard-coded globals (Service Locator)
- Driving a continuous simulation at a controlled rate (Game Loop, Update Method)
- Avoiding tearing/inconsistent reads on state mutated mid-frame (Double Buffer)
- Letting content authors define new behavior without a new subclass per case
  (Subclass Sandbox, Type Object, Bytecode)

## Design Patterns Revisited

### Command: Reified Method Calls

**Intent:** Encapsulate a request as an object so the code that *issues* it (input,
AI, UI) is decoupled from the code that *executes* it (actor).

**Usage:** input binding maps buttons to command objects, rebindable at runtime; AI
returns a `Command` the same way player input does, so actor code is identical for
both. Undo/redo: each command implements `execute()`/`undo()` and stores its own
pre-state (e.g. `xBefore_`); push executed commands onto a history stack. Replay/
netcode: serialize the command stream instead of full state.

**Pitfalls:** binding a command to one specific actor at construction defeats reuse —
parameterize `execute(actor)` instead. Forgetting to capture pre-state breaks undo.
One subclass per action explodes the class count; in languages with closures, a plain
function object is often enough.


### Flyweight: Share Intrinsic State

**Intent:** Split object state into *intrinsic* (shared, immutable, expensive) and
*extrinsic* (unique, cheap, per-instance); store one intrinsic copy and reuse it.

**Usage:** forest rendering shares one `TreeModel` (mesh/texture) while position/tint
are extrinsic, passed per-instance at draw time (GPU instancing). A terrain grid
stores per-tile *pointers* to shared `Terrain` objects (grass, river, hill) instead of
duplicating movement-cost/texture data per cell.

**Pitfalls:** mutating shared flyweight state corrupts every referencing instance —
make flyweights immutable, accessors `const`. Don't assume pointer indirection beats a
plain enum; profile. Centralize creation so duplicate shared instances aren't
accidentally allocated.


### Observer: Decoupled Event Broadcasting

**Intent:** Let objects subscribe to notifications without the subject knowing who —
or how many — listeners exist.

**Usage:** subject holds a list of observers, calls `onNotify(subject, event)` on
each; observers register only with subjects they care about. A zero-allocation
variant embeds an intrusive `next_` pointer so the subject keeps a linked list without
a dynamic collection (trade-off: one subject per observer at a time).

**Pitfalls:** **lapsed listener** — an observer never unregisters, leaving a
dangling/zombie reference (or, in GC languages, preventing collection); always
unregister on teardown. **Synchronous blocking** — a slow observer stalls the
subject's frame; push heavy work to an Event Queue. **Hidden coupling** — the link
isn't visible from either class alone; document it. **Ordering dependencies** — never
assume notification order; if it matters, the observers are actually coupled.


### State: Encapsulate Mode-Dependent Behavior

**Intent:** When behavior depends on an object's mode, delegate to a swappable state
object instead of branching on a mode enum in every method.

**Usage:** a `Heroine` holds `HeroineState* state_`; input/update calls go through
`state_->handleInput(...)`. Adding a mode means adding one state subclass, not editing
every existing method. `enter()`/`exit()` hooks keep mode-specific setup (swap sprite,
reset timer) with the state. Independent modes (stance vs. held item) can use two
separate state pointers instead of cross-producting into one enum.

**Pitfalls:** State (one object *changes* which behavior-object it delegates to) is
often confused with Type Object (*many* objects *share* one behavior-object
simultaneously) — different problems, similar shape. Allocating a new state object
per transition churns the allocator — pool or reuse stateless states as singletons.
Hierarchical "superstates" don't fall out of plain State for free; need an explicit
fallback chain.


### Component: Compose Instead of Inherit

**Intent:** Build an entity from swappable components (graphics, physics, audio, AI)
behind a standard interface, instead of a monolithic class or a fragile inheritance
tree trying to express every behavior combination.

**Usage:** a `GameObject` holds optional `PhysicsComponent`/`GraphicsComponent`/
`InputComponent` references; the update step delegates to whichever components an
entity has, instead of one method juggling every concern inline.

**Pitfalls:** cross-component communication (physics needing the position graphics
just wrote) can reintroduce tight coupling — pass data explicitly rather than direct
component-to-component references. Splitting entities that never vary independently
into components adds indirection with no benefit.


### Event Queue: Decouple Producer From Consumer

**Intent:** Queue events instead of invoking handlers synchronously, so the raiser
doesn't block on — or know about — every reactor.

**Usage:** an audio system posts a `PlaySoundEvent`; a later step drains the queue and
starts playback. Smooths frame pacing, allows batching/reordering, avoids deep
synchronous call stacks (observer notifying an observer...).

**Pitfalls:** unbounded queues under event bursts risk unbounded memory — cap size,
define a drop/backpressure policy. Don't assume FIFO order alone satisfies every
cross-event-type ordering requirement.


### Service Locator: Centralized, Swappable Global Access

**Intent:** Provide global access to a service (renderer, audio, save store) through
a queried registry, instead of a hard singleton reference baked into every call site.

**Usage:** `Locator::getAudio()->playSound(...)`; tests register a null/mock service —
call sites stay unchanged.

**Pitfalls:** still a global in disguise — prefer explicit passing where cheap. A
missing registration should fail loudly (explicit error or null-object), not silently
no-op until a bug report surfaces it.


## Sequencing Patterns

### Game Loop: Decouple Time From Input and Processor Speed

**Intent:** Run gameplay at a rate decoupled from CPU speed and user input, so the
same code behaves identically on fast and slow hardware.

**Usage:** minimal shape is a non-blocking `processInput(); update(); render();`
cycle. Real loops add a **fixed time step**: accumulate elapsed wall-clock time and
call `update()` a fixed number of times per second regardless of render rate.

**Pitfalls:** blocking on input freezes rendering between inputs. A variable step
passed into `update()` makes physics non-deterministic across machines — a classic
desync source in networked/replayed systems. If a platform/engine already owns the
loop, hook into its update callback instead of nesting a second loop.


### Update Method: Simulate a Collection of Independent Objects

**Intent:** Give the loop one uniform way to advance every object by a frame, instead
of each object's behavior hand-inlined into the loop body.

**Usage:** each entity implements `update()`; the loop walks the collection and calls
it once per frame. Adding/removing a timed behavior means adding/removing one object —
the loop itself never changes.

**Pitfalls:** inlining per-entity logic into the loop makes it grow without bound as
content is added. Mutating the entity collection *during* iteration (spawn/destroy
inside `update()`) needs a deferred add/remove list. A blocking `update()` stalls
every other entity sharing the frame.


### Double Buffer: Avoid Reading Inconsistent Mid-Update State

**Intent:** Prevent code from reading a "next" state that's only half-written, by
maintaining two buffers — one read, one written — swapped atomically once an update
pass completes.

**Usage:** the renderer always reads last frame's complete buffer while simulation
writes into the other; they swap after the pass finishes.

**Pitfalls:** doubles memory for large buffers — apply only where real
tearing/inconsistency is observed. A missed or mistimed swap reintroduces the exact
bug the pattern exists to prevent.


## Optimization Patterns

### Object Pool: Reuse Fixed-Size Allocations

**Intent:** Pre-allocate a fixed pool of same-type, same-size objects and hand
them out/reclaim them instead of hitting the allocator on every create/destroy —
critical for high-frequency objects like particles and bullets.

**Usage:** a `ParticlePool` scans for a free slot on "spawn" and reinitializes it in
place; "die" just marks the slot inactive — no allocation calls after start-up.

**Pitfalls:** iterating a sparse pool still costs time — track a live count or
free-list instead of a full linear scan. A raw pointer/index held externally risks
dangling once its slot is recycled — use a generation counter or handle indirection.
Design an explicit "pool exhausted" behavior (drop, recycle oldest, grow).


### Spatial Partition: Query by Proximity Without O(n) Scans

**Intent:** Divide the world into a grid/quadtree and track which objects live in
which cell, so proximity queries avoid comparing every object against every other.

**Usage:** a uniform grid keyed by `(x/cellSize, y/cellSize)` maps to a bucket;
collision checks only test object pairs sharing (or adjacent to) a bucket.

**Pitfalls:** the partition must stay in sync as objects move — a stale bucket
silently misses real collisions. Wrong cell size (too small: overhead; too large:
back toward O(n²)) needs tuning against real object density. Highly clustered
distributions defeat a uniform grid — an adaptive quadtree/BVH may be needed instead.


### Dirty Flag: Defer Expensive Recalculation

**Intent:** Mark derived state stale on input change and only pay the recompute cost
the next time it's actually read, instead of recomputing eagerly on every write.

**Usage:** a scene node's world transform is cached; setting `localTransform` just
sets `dirty_ = true`; `getWorldTransform()` recomputes and clears the flag only if
dirty.

**Pitfalls:** forgetting to propagate dirtiness to dependents (parent dirty must also
dirty cached children) causes hard-to-reproduce stale reads. Applying this without
profiling first adds complexity for no measurable win.


### Data Locality: Cache-Coherent Iteration

**Intent:** Group data accessed together in a hot loop into contiguous memory
(Structure-of-Arrays) instead of scattering it across pointer-chased heap objects
(Array-of-Structures) — cache misses, not instruction count, dominate large per-frame
loops.

**Usage:** a contiguous `Particle[]` array, iterated linearly during update, lets the
CPU prefetcher work, unlike an array of separately heap-allocated `Particle*`.

**Pitfalls:** trades locality for encapsulation — fields split across parallel arrays
are harder to read/refactor; apply only to profiled hot loops. Verify the win with a
profiler; intuitions about cache behavior are frequently wrong.


## Behavioral Patterns

### Subclass Sandbox: Confine Variation to a Protected Base-Class API

**Intent:** Let subclasses define varied behavior purely through protected operations
a base class provides, so each subclass overrides one method and never touches engine
internals directly.

**Usage:** a `Superpower` base exposes protected `move()`/`playSound()`/
`spawnParticles()`; each power subclass implements `activate()` using only those
helpers — no subclass holds a direct renderer/audio/physics reference.

**Pitfalls:** the base class accumulates every helper any subclass might need,
growing large and widely coupled — keep the protected surface as narrow as needed.
Passing dependencies into the base constructor keeps coupling visible; prefer that
over an internal Service Locator lookup where practical.


### Type Object: Share Behavior Across Many Instances of a "Kind"

**Intent:** Avoid a subclass-per-kind explosion by giving each instance a reference to
a shared `Breed`/`Class` *object* holding the data that defines that kind, instead of
encoding the kind in the type system.

**Usage:** every `Monster` holds `Breed* breed_` supplying `attack`/`health`/`name`;
a new monster kind means constructing one `Breed` instance (often from a data file),
not compiling a new class.

**Pitfalls:** confusing this with Flyweight — Type Object shares *behavior/definition*
across a category; Flyweight shares *rendering/physical* state to cut memory; they
compose but solve different problems. In dynamically-typed languages where classes
are already first-class objects, this pattern is often redundant.


### Bytecode: Give Content Authors a Safe, Data-Driven Instruction Set

**Intent:** Let non-programmer content (spell effects, dialogue, AI scripts) be
authored as data — a small instruction set interpreted by a VM — instead of requiring
a recompile-and-ship cycle for every tweak.

**Usage:** a spell compiles to a byte array of opcodes (`INST_SET_HEALTH`,
`INST_PLAY_SOUND`, ...); a small stack-based VM interprets it at runtime. Designers
edit data files; no engineer recompile needed for a balance change.

**Pitfalls:** building a full VM is real engineering effort — justified only when
content genuinely needs post-ship, non-programmer flexibility; for a handful of fixed
effects, Subclass Sandbox or Type Object is far cheaper. A hand-rolled VM needs its
own safety net (bounds-checked stack, opcode validation) or it becomes as
exploitable/crash-prone as arbitrary native code.


## Common Pitfalls Across Patterns

- **Over-patterning:** not every problem needs a pattern; start simple, refactor once
  real pain (duplication, tight coupling, a measured perf problem) appears.
- **Premature optimization:** profile first — a pattern's sharing/queuing/indirection
  overhead can exceed the benefit it was meant to provide.
- **Mismatched abstractions:** Command for one call site is overkill; Observer
  wrapping two classes that will never have a third listener defeats its purpose.
- **Ignoring lifetime management:** GC languages still suffer lapsed listeners;
  manually-managed languages must track ownership for pooled and shared objects alike.
- **Performance guessing:** never assume allocation, cache, or dispatch cost — measure
  with realistic object counts before choosing between competing patterns.


## Activation Checklist

- [ ] Identify core domains (physics, AI, UI, audio) and their communication needs
- [ ] Map tight couplings; consider Command/Observer/Event Queue to break them
- [ ] Count objects; estimate memory impact; consider Flyweight/Object Pool if thousands
- [ ] Profile hot paths; apply Dirty Flag, Data Locality, or Spatial Partition only once
      a cache-miss or O(n²) cost is confirmed, not speculatively
- [ ] Validate undo/replay end-to-end; test Command serialization if networked
- [ ] Document Observer notification order dependencies (or assert they don't exist)
- [ ] Unregister observers on destruction; audit for lapsed listeners in GC systems
- [ ] If content authors need post-ship tuning without a rebuild, evaluate Type Object
      or Bytecode before hand-writing new subclasses per case
- [ ] Confirm who owns the Game Loop (platform vs. engine vs. you) before writing one
