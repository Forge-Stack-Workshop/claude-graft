---
name: rtos-patterns
description: Real-time OS task scheduling, synchronization primitives, inter-task communication, interrupt handling, and timing requirements for embedded systems.
origin: Hands-On RTOS with Microcontrollers (Jim Yuill, Packt Publishing)
---

# RTOS Patterns

Production patterns for real-time embedded systems using an RTOS (examples in FreeRTOS API; concepts apply equally to Zephyr, ThreadX, or any preemptive-priority kernel).

Use this skill when:

- Building multi-tasking firmware on a microcontroller
- Coordinating timing-sensitive operations (ADC sampling, motor control, sensor polling)
- Sharing hardware peripherals among multiple concurrent tasks
- Designing ISR-to-task handoff for interrupt-driven drivers
- Managing data safely between tasks without race conditions, deadlock, or priority inversion
- Deciding whether a bare-metal loop actually needs an RTOS at all

## Do You Need an RTOS?

Start bare-metal. Add an RTOS only when the firmware must juggle multiple independent,
timing-sensitive activities that cannot be expressed as one linear loop or a simple
interrupt handler. Signs an RTOS earns its complexity:

- Several concurrent responsibilities with different timing/priority needs (e.g., motor
  control loop + USB command handling + sensor logging).
- Blocking operations (waiting on I/O) that must not stall unrelated work.
- A growing set of ad-hoc flags/state machines emulating "tasks" by hand.

An RTOS adds cost: RAM/flash footprint, context-switch overhead, and new failure modes
(deadlock, priority inversion, stack overflow per task). A toaster that turns on a
heating element for a fixed time needs no scheduler — keep it simple.

## Task Scheduling

### Task Basics

Divide firmware into independent tasks, each with a priority (0 to `configMAX_PRIORITIES - 1`
in FreeRTOS). The scheduler always runs the highest-priority task that is in the Ready
state, preempting lower-priority tasks the instant a higher-priority one becomes ready.

```c
// Create a task with FreeRTOS
xTaskCreate(
    task_function,          // task code
    "TaskName",             // human-readable name (for debuggers/RTOS-aware tools)
    STACK_SIZE_WORDS,       // stack depth — size per task, not shared
    NULL,                   // parameter passed into task_function
    tskIDLE_PRIORITY + 1,   // priority
    &task_handle            // optional handle, for later reference/deletion
);
vTaskStartScheduler();      // hands control to the RTOS — never returns
```

**Golden rule:** keep tasks focused. A task that blocks waiting for one event should
not delay unrelated work. Let the scheduler enforce concurrency — don't hand-roll
cooperative loops inside a single task to fake multitasking.

Each task needs its own stack, sized to its actual call depth plus interrupt nesting
margin — undersized stacks are a leading cause of silent corruption in RTOS firmware
(see Pitfalls).

### Task States

- **Running:** currently executing on the CPU (exactly one task, or one per core).
- **Ready:** eligible to run, waiting only for the scheduler to pick it.
- **Blocked:** waiting on an event (queue receive, semaphore take, delay, notification).
- **Suspended:** explicitly removed from scheduling (`vTaskSuspend()`) until resumed.

Blocked and suspended tasks consume no CPU. The scheduler only considers Ready tasks,
so a design with many tasks mostly Blocked on events is normal and efficient — it is
not "wasting" cores by existing.

### Scheduling Policy

Most RTOS kernels (FreeRTOS included) use **fixed-priority preemptive scheduling** with
**round-robin time-slicing among tasks of equal priority**. Two tasks at the same
priority share CPU time in slices (`configTICK_RATE_HZ` sets the tick, hence the slice
granularity); a higher-priority task always wins immediately, with no aging or fairness
mechanism for lower-priority tasks. Design priorities accordingly — a continuously
runnable high-priority task will starve everything below it (see Pitfalls).

## Synchronization: Semaphores and Mutexes

### Binary/Counting Semaphores

Signal one-time or repeated events between tasks, or between an ISR and a task. A task
blocks (with a timeout) until the semaphore is given.

```c
SemaphoreHandle_t data_ready_sem = xSemaphoreCreateBinary();

// Producer (task or ISR) signals the event
xSemaphoreGive(data_ready_sem);

// Consumer task waits, with a bounded timeout — never portMAX_DELAY blindly
if (xSemaphoreTake(data_ready_sem, pdMS_TO_TICKS(100)) == pdTRUE) {
    process_data();
}
```

A counting semaphore tracks multiple pending events (e.g., a pool of N free buffers)
instead of a single flag.

### Mutexes

Protect shared data from concurrent access. Use `xSemaphoreCreateMutex()`, not a binary
semaphore, for mutual exclusion — FreeRTOS mutexes include **priority inheritance** to
avoid priority inversion (a plain binary semaphore does not).

```c
SemaphoreHandle_t data_mutex = xSemaphoreCreateMutex();

xSemaphoreTake(data_mutex, portMAX_DELAY);
shared_struct.value = new_value;   // critical section — keep it short
xSemaphoreGive(data_mutex);
```

**Critical:** never call `xSemaphoreTakeFromISR()` on a mutex — ISRs cannot block, and
mutex semantics (ownership, priority inheritance) only make sense for tasks.

## Inter-Task Communication: Queues

Transfer data between tasks safely without shared memory or manual locking. Queues
decouple producers from consumers — the producer doesn't need to know who (or how many
tasks) consume the data, only the queue's contract.

```c
QueueHandle_t sensor_queue = xQueueCreate(10, sizeof(sensor_reading_t));

// Producer task
sensor_reading_t reading = read_sensor();
xQueueSend(sensor_queue, &reading, pdMS_TO_TICKS(50));

// Consumer task
sensor_reading_t reading;
if (xQueueReceive(sensor_queue, &reading, portMAX_DELAY) == pdTRUE) {
    handle_reading(reading);
}
```

- Prefer **passing by value** (small structs) over by reference — avoids lifetime bugs
  where the sender reuses or frees a buffer the receiver still points to.
- Pass by reference only for large payloads, and only when ownership transfer is
  unambiguous (e.g., a pointer into a pool the receiver is responsible for returning).
- **Task notifications** (`xTaskNotifyGive`/`ulTaskNotifyTake`) are a lighter-weight
  alternative to a single-slot queue or binary semaphore when only one task needs
  signaling — faster and lower RAM overhead, at the cost of losing the multi-waiter
  flexibility of a real queue.

## ISRs and Task Handoff

ISRs must be **fast** and **minimal**: acknowledge the interrupt source, capture the
minimum data needed, signal a task, and return. Defer all non-trivial processing
(parsing, computation, logging) to a task via a semaphore, queue, or notification —
this is the single most important ISR design rule.

```c
// Fast ISR: acknowledge interrupt, signal task, request reschedule if needed
void USART_IRQHandler(void) {
    BaseType_t higher_priority_task_woken = pdFALSE;
    acknowledge_interrupt();
    xSemaphoreGiveFromISR(uart_rx_sem, &higher_priority_task_woken);
    portYIELD_FROM_ISR(higher_priority_task_woken);
}
```

Rules specific to ISR context:

- Use only the `FromISR()` API variants (`xSemaphoreGiveFromISR`, `xQueueSendFromISR`,
  `vTaskNotifyGiveFromISR`) — the plain APIs are not interrupt-safe and may attempt to
  block.
- Always propagate `higher_priority_task_woken` into `portYIELD_FROM_ISR()` (or the
  port-specific equivalent) at the end of the ISR — otherwise a just-unblocked
  high-priority task waits until the next tick instead of running immediately.
- Never call a blocking API, `malloc`/`free` (unless explicitly interrupt-safe), or
  anything with unbounded execution time inside an ISR.
- Keep nested-interrupt and ISR-stack usage in mind — deep ISR call chains still
  consume the interrupt stack, separate from any task's stack.

## Priority Inversion

**Problem:** a high-priority task waits on a mutex held by a low-priority task. A
medium-priority task then preempts the low-priority one (it doesn't need the mutex, so
nothing stops it running). Net effect: the high-priority task is blocked indefinitely by
medium-priority work it has no relationship to — the classic unbounded priority
inversion.

**Solution:** use a **mutex with priority inheritance** (FreeRTOS's
`xSemaphoreCreateMutex()`, not a binary semaphore used as a lock). The low-priority
task temporarily inherits the blocked high-priority task's priority for as long as it
holds the mutex, so the medium-priority task can no longer preempt it.

```c
SemaphoreHandle_t mutex = xSemaphoreCreateMutex();  // priority inheritance enabled
// FreeRTOS automatically boosts the low-priority holder's priority
// while a higher-priority task is waiting on the same mutex.
```

Priority inheritance bounds the inversion but does not eliminate the need for careful
design: keep critical sections short, and avoid nesting multiple mutexes where possible
(risk of deadlock, not just inversion).

## Real-Time Timing Requirements

A real-time failure occurs when a deadline is missed, not merely when work is slow.
Classify every timing requirement explicitly:

- **Hard real-time:** missing the deadline causes system failure or is unacceptable
  (e.g., airbag deployment, motor commutation timing).
- **Firm real-time:** an occasional missed deadline degrades quality but the result is
  still useless if late (e.g., a dropped video frame — no point delivering it later).
- **Soft real-time:** a missed deadline degrades quality but late results still have
  value (e.g., a logging timestamp slightly delayed).

Design priorities and worst-case execution time (WCET) budgets around this
classification — a hard-real-time task earns the highest priority and the tightest
scrutiny on everything it can block on (mutexes, queue timeouts, ISR latency).

## FreeRTOS vs. Zephyr

Both are preemptive-priority RTOSes with tasks/threads, mutexes with priority
inheritance, semaphores, and queues — the concepts in this skill map directly between
them, only the API names differ (e.g., `xTaskCreate` vs. `k_thread_create`,
`xQueueSend` vs. `k_msgq_put`).

- **FreeRTOS** — minimal kernel, huge MCU/vendor-port ecosystem, easiest entry point for
  a single-purpose embedded product; add networking/USB/filesystem stacks separately as
  needed.
- **Zephyr** — a fuller Linux-like OS: built-in device-tree hardware description,
  integrated Bluetooth LE/Wi-Fi/networking stacks, and a more structured build system
  (west/CMake). A stronger default for connected IoT MCUs (nRF52, ESP32, STM32H7) or
  projects that need certified security/update infrastructure out of the box.

Choose based on ecosystem fit (vendor SDK support, existing team familiarity,
certification needs), not raw kernel feature count — the scheduling/synchronization
patterns above apply either way.

## Common Pitfalls

- **Priority inversion:** use mutexes with priority inheritance, never a plain binary
  semaphore, for mutual exclusion between tasks of different priorities.
- **Blocking in ISRs:** ISRs cannot wait on semaphores or queues. Use the `FromISR()`
  APIs, and never a timeout other than 0 in that context.
- **Missing `portYIELD_FROM_ISR()`:** signaling a task from an ISR without checking/
  propagating `higher_priority_task_woken` delays the task until the next tick.
- **Starving low-priority tasks:** a high-priority task that runs continuously (busy
  loop, no blocking call) prevents lower-priority tasks from ever running. Give it a
  blocking call, a delay, or a time-slice boundary; monitor with idle-task hooks.
- **No timeout on `xQueueReceive()`/`xSemaphoreTake()`:** a task blocked forever if the
  sender never arrives (crashed, deadlocked, or logic bug). Use `portMAX_DELAY` only
  when a hang there is provably impossible — default to a bounded timeout plus explicit
  error handling.
- **Undersized task stacks:** each task has its own stack; sizing it too small corrupts
  adjacent memory silently rather than faulting cleanly. Use the RTOS's stack
  high-water-mark API (`uxTaskGetStackHighWaterMark()`) to validate margins, not
  guesswork.
- **Long critical sections:** holding a mutex across a blocking call (I/O, another
  mutex) turns a short lock into an unbounded one and defeats priority inheritance's
  guarantees. Keep the locked region to pure memory operations.
- **Deleting a task that owns a resource:** deleting a task while it holds a mutex or
  mid-way through a queue transaction leaves the resource permanently locked. Release
  resources before deletion, or design ownership so deletion cannot occur mid-hold.
- **A task mysteriously stops running:** check whether it was deleted, is blocked
  indefinitely on an event that will never fire, or is starved by a higher-priority
  task — in that order.

## Debugging Checklist

- Task missing from the ready set → check if it was deleted, suspended, or blocked on
  an event that never fires (queue never sent to, semaphore never given).
- CPU pegged at 100% with lower-priority tasks never running → a high-priority task is
  not yielding/blocking; audit for busy-wait loops.
- Data corruption between tasks → verify shared data is behind a mutex, not just a
  volatile flag; check for a missing `FromISR()` variant used from interrupt context.
- Unexpected latency on a high-priority task's response → check for priority inversion
  (mutex without priority inheritance) or a long critical section elsewhere.
- Random crashes / corrupted-looking data → check task stack high-water marks first;
  undersized stacks are the most common source of "impossible" bugs in RTOS firmware.
