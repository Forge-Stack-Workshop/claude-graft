---
name: erlang-otp
description: Actor model concurrency, lightweight processes, message passing, fault tolerance ("let it crash"), supervision trees, OTP behaviors (gen_server/gen_statem/gen_event), hot code reloading, and distributed-systems resilience patterns.
origin: Learn You Some Erlang for Great Good
---

# Erlang & OTP

Fault-tolerant concurrent programming with the actor model and the OTP
framework. Applies to any actor-model or supervision-tree design, not only
literal Erlang/Elixir code — the same reasoning transfers to Akka, Orleans,
or a hand-rolled supervisor in another language.

## Prerequisites (preflight)

```bash
command -v erl || echo "WARN: install Erlang/OTP"
command -v rebar3 || echo "WARN: install rebar3"
```

## When to Activate

- Building fault-tolerant, high-availability distributed systems
- Designing systems that must survive process/node crashes without downtime
- Handling thousands to millions of concurrent lightweight connections
- Requiring live code deployment without stopping the running system
- Designing or debugging supervision hierarchies (workers, restart policies)
- Implementing pub/sub, event processing, or message-broker patterns

## Core Concepts

### The Actor Model

Every unit of concurrency is a **process**: an isolated actor with its own
private heap, its own mailbox, and no shared memory with any other process.
Processes communicate exclusively by sending messages — no lock, no mutex,
no shared mutable state, so no deadlock and no data race.

Erlang processes are not OS threads. They are lightweight, scheduled by the
BEAM VM, cheap enough that a single node runs millions concurrently, and
garbage-collected independently — one process's GC pause never stalls
another.

```erlang
% Spawn a process running Fun; returns a Pid immediately (non-blocking)
Pid = spawn(fun() -> loop() end).

% Send message: always non-blocking, always returns the message itself
Pid ! {hello, self()}.

% Receive: pattern-match against the mailbox, in send order
receive
    {hello, From} -> From ! {reply, ok};
    Other -> io:format("Unknown: ~w~n", [Other])
after 5000 ->
    io:format("Timeout~n")
end.
```

**Key principle: "let it crash."** Erlang does not encourage defensive
coding to prevent every possible failure. Instead, write the happy path,
let unexpected input crash the process, and rely on a supervisor to restart
it into a known-good state. A crash is a signal, not a disaster — trying to
anticipate and handle every error inline produces more bugs than it fixes.

### Message Passing

- Sending (`!`) is asynchronous and never blocks, even if the mailbox is full.
- Each process has its own mailbox; messages from a given sender arrive in
  the order they were sent (no cross-process ordering guarantee).
- `receive` pattern-matches against the mailbox top-down, skipping messages
  that don't match any clause — they stay queued, not discarded.
- `after Timeout -> ...` fires if no matching message arrives in time;
  `after 0` polls the mailbox without blocking.
- Synchronous "call" semantics (e.g. `gen_server:call/2`) are not a
  primitive — they're built on async send + receive-with-reference.

### Links and Monitors

**Links** (`link/1`, `spawn_link/1`) create a bidirectional relationship: if
either linked process terminates abnormally, the other receives an exit
signal too — by default this kills it, propagating the crash.

**Monitors** (`monitor/2`) are unidirectional: the monitoring process
receives a `{'DOWN', Ref, process, Pid, Reason}` message when the monitored
process dies, but is not itself killed.

```erlang
% Link: both processes die together on abnormal exit
spawn_link(fun worker/0).

% Monitor: observe without propagating the crash
Ref = monitor(process, Pid),
receive
    {'DOWN', Ref, process, Pid, Reason} ->
        io:format("Process died: ~w~n", [Reason])
end.
```

Use links for tightly-coupled supervisor↔worker relationships (this is what
supervisors use internally). Use monitors for loose coupling — e.g. a client
watching a server it doesn't own.

### Exit Signals & Trap Exits

An exit signal normally kills the receiving process, and — because links are
bidirectional — cascades to everything linked to it. Calling
`process_flag(trap_exit, true)` converts incoming exit signals into ordinary
`{'EXIT', Pid, Reason}` messages, letting the process decide how to react
(cleanup, ignore, re-propagate) instead of dying immediately.

```erlang
process_flag(trap_exit, true),
receive
    {'EXIT', Pid, killed} -> io:format("Worker ~w was killed~n", [Pid]);
    {'EXIT', Pid, normal} -> io:format("Worker ~w exited normally~n", [Pid])
end.
```

Trapping exits is how supervisors survive their children's crashes long
enough to restart them — without it, a supervisor would die along with any
linked worker.

### Supervision Trees

A **supervisor** is a specialized OTP process whose only job is to start,
monitor, and restart a set of **child** processes (workers or other
supervisors), forming a tree: leaves do real work, internal nodes do nothing
but restart management. Fault tolerance emerges from the tree structure, not
from any single process being bug-free.

Restart strategies (chosen per supervisor):

- `one_for_one`: a child dies → restart only that child.
- `one_for_all`: a child dies → terminate and restart every child under this
  supervisor (use when children share state and must reset together).
- `rest_for_one`: a child dies → restart it and every child started after it,
  in startup order (use when later children depend on earlier ones).
- `simple_one_for_one`: a dynamic pool of homogeneous, on-demand children,
  each started via `supervisor:start_child/2`.

```erlang
init([]) ->
    {ok, {
        {one_for_one, 5, 10},  % max 5 restarts within any 10-second window
        [
            {worker_1, {worker_module, start_link, []}, permanent, 5000, worker, [worker_module]},
            {worker_2, {worker_module, start_link, []}, transient, infinity, worker, [worker_module]}
        ]
    }}.
```

Child spec fields worth knowing: restart type (`permanent` always restarts,
`transient` restarts only on abnormal exit, `temporary` never restarts),
shutdown timeout, and child type (`worker` vs `supervisor`).

### OTP Behaviors

OTP behaviors factor out the boilerplate of common process patterns so the
developer only writes the callback logic — the framework handles the
message loop, error propagation, and lifecycle.

**`gen_server`** — generic stateful server, synchronous (`call`) and
asynchronous (`cast`) requests:

```erlang
% Client side
gen_server:call(ServerPid, {get_state}),     % synchronous, blocks for a reply
gen_server:cast(ServerPid, {set_value, 42}). % asynchronous, returns immediately

% Server callback module
init(State) -> {ok, State}.
handle_call({get_state}, _From, State) -> {reply, State, State}.
handle_cast({set_value, V}, _State) -> {noreply, V}.
handle_info(Msg, State) -> {noreply, State}.       % non-OTP messages (timeouts, monitors)
terminate(Reason, State) -> ok.
code_change(OldVsn, State, Extra) -> {ok, State}.  % hot upgrade hook
```

**`gen_statem`** (successor to `gen_fsm`) — explicit finite state machine;
each state declares which events it accepts and which state/actions follow.
Use it when a process's valid messages genuinely depend on its current phase
(e.g. handshake → authenticated → streaming).

**`gen_event`** — event manager: one process, many pluggable handler
modules, each reacting independently to broadcast events. Good for decoupled
logging/alerting/metrics fan-out.

### Hot Code Reloading

The BEAM VM can load a new module version while old processes still run the
previous one — up to two versions coexist at once. A running process only
switches to the new code the next time it makes a *fully-qualified* call to
itself (`Module:Fun(...)`); an unqualified call keeps running old code until
the process loops back through a qualified call. `code_change/3` runs at
that switch point to migrate in-memory state to the new code's expectations —
this is what lets production systems be patched without downtime, but only if
it correctly transforms every prior state shape it might encounter.

## Common Patterns

### Worker Pool

`simple_one_for_one` supervisor + on-demand `start_child` gives a pool that
grows/shrinks with load, with each worker restarted independently on crash:

```erlang
{simple_one_for_one, 10, 60,
    [{worker, {worker_module, start_link, []}, temporary, 5000, worker, [worker_module]}]
}

% Supervisor spawns a new worker per incoming request
supervisor:start_child(SupervisorPid, []).
```

### Graceful Shutdown

Trap exits and clean up in `terminate/2` so linked resources (file handles,
sockets, ETS tables) are released deterministically instead of abandoned:

```erlang
terminate(normal, State) -> cleanup(State), ok;
terminate(shutdown, State) -> cleanup(State), ok;
terminate(Reason, State) ->
    error_logger:format("Server terminating: ~w~n", [Reason]),
    cleanup(State).
```

### Selective Receive / Draining a Mailbox

Handle or explicitly discard every message class a process might see — never
leave a message shape unmatched, or it queues forever and grows memory
unboundedly:

```erlang
receive
    {work, Task} -> do_work(Task);
    {_Ignored, _} -> receive_and_discard()  % explicitly drop, don't ignore
after 1000 -> io:format("No work~n")
end.
```

## Antipatterns & Gotchas

- **Shared mutable state:** forbidden by design — route it through message
  passing or a dedicated owning process instead of faking a mutex.
- **Unguarded receive:** a message shape with no matching clause sits in the
  mailbox forever, unseen, growing memory. Add a catch-all that logs and
  discards.
- **Runaway restarts:** a worker restarted instantly into the same failure
  spins a supervisor forever if it has no restart cap. Always set sane
  `MaxRestart`/`MaxTime` limits.
- **Blocking `handle_call`:** a long-running synchronous callback blocks
  every other caller queued on that `gen_server`. Offload to `handle_cast`
  or a spawned worker instead.
- **Trapping exits and never reading them:** `trap_exit` without a matching
  `{'EXIT', ...}` clause accumulates messages until memory runs out — trap
  only when you also handle it.
- **Deep supervisor hierarchies:** every extra level adds restart latency
  and makes `observer` trees hard to reason about. Keep trees shallow
  (~3 levels); prefer monitors for cross-branch, loosely-coupled watching.
- **`code_change/3` state mismatch:** a migration that doesn't handle every
  prior `OldVsn` shape crashes the process on the very upgrade meant to fix
  it. Test hot-upgrade paths, not just cold starts.
- **Confusing "let it crash" with "ignore all errors":** crashing on bad
  input is fine only if a supervisor actually watches the process with a
  sane restart strategy — an unsupervised crash loop is just a bug.

## Verification

```bash
erlc module.erl   # compile a module
erl               # start an interactive shell
```

```erlang
erlang:process_info(Pid, links).            % inspect a process's links
observer:start().                           % visualize the supervision tree
erlang:process_info(Pid, message_queue_len). % growing count = unguarded receive
code:is_loaded(module_name).                % confirm loaded code version
```

## References

- *Learn You Some Erlang for Great Good* — comprehensive guide to Erlang
  concurrency, error handling, and OTP design
- Erlang/OTP official docs: `http://erlang.org/doc/`
- OTP Design Principles: supervision trees, `gen_server`, `gen_statem`,
  `gen_event` behaviors
