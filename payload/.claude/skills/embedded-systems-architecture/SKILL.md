---
name: embedded-systems-architecture
description: Microcontroller (MCU) and microprocessor (MPU) architecture, memory management, RTOS vs bare-metal design, bootloaders, device peripherals, interrupt handling, security, and IoT connectivity for resource-constrained systems.
origin: Lacamera & Oliverio, "Embedded Systems Architecture" (2nd ed.)
---

# Embedded Systems Architecture

Design patterns and pragmatic approaches for embedded systems development,
from silicon selection through boot, memory, peripherals, security, and IoT.

## When to Activate

- Designing firmware for an MCU/MPU platform (ARM Cortex-M/A, RISC-V, etc.)
- Making MCU vs MPU trade-off decisions (memory, cost, real-time requirements)
- Evaluating RTOS vs bare-metal architecture for a project
- Writing/reviewing a linker script, boot stage, or firmware update mechanism
- Implementing device drivers, interrupt handlers, or power-management logic
- Securing embedded systems (cryptography, memory isolation, secure/trusted boot)
- Integrating IoT connectivity or distributed system patterns
- Debugging multi-stage boot, memory corruption, or interrupt-latency issues

## Core Concepts

### MCU vs MPU Trade-offs

**Microcontroller (MCU):** single-chip system integrating CPU, RAM, flash,
and peripherals. Resources measured in KB-MB, deterministic execution, low
power, no MMU (uses an optional memory protection unit instead — see below).
Runs bare-metal or a small RTOS. Use for: real-time control, sensor
acquisition, battery-powered devices, safety-critical loops.

**Microprocessor (MPU):** CPU core only; requires external RAM, external
storage, and typically a full OS (Linux) with an MMU for virtual memory and
process isolation. Higher performance and richer software stack, at higher
power/cost. Use for: gateways, vision/ML workloads, systems needing a full
network stack, filesystem, or multi-process user space.

**Decision factors:** power budget, worst-case latency, cost per unit at
volume, certification requirements, software complexity, team expertise, and
time-to-market. A hybrid is common: an MPU-class SoC paired with MCU-class
co-processors for real-time I/O, isolated from the "rich" OS side.

### Boot-Up Procedure & Multi-Stage Boot

Reset behavior is defined by the vector table: on Cortex-M, address 0 holds
the initial stack pointer, address 4 holds the reset vector. Boot proceeds in
stages, each one narrowing trust and expanding capability:

1. **ROM bootloader (mask ROM, immutable):** minimal clock/memory setup; may
   support a recovery/DFU mode over a fixed peripheral (USB, UART).
2. **Stage-1 bootloader (in flash):** configures clocks and memory
   controller, initializes a minimal driver set, verifies stage-2 or the
   application image (checksum, then cryptographic signature).
3. **Stage-2 bootloader (optional):** more sophisticated update logic
   (A/B slots, rollback protection, delta updates).
4. **Application:** copies `.data` from flash to RAM, zeroes `.bss`, calls
   C runtime init (`__libc_init_array` or equivalent), then `main()`.

**Key rule:** never trust a lower stage's verification blindly — a
compromised bootloader can be bypassed by re-flashing; the chain of trust
must be anchored in immutable ROM or a hardware root of trust (fused public
key, OTP fuses), and each stage must verify the next before the jump.

**Firmware update patterns:** A/B images with a boot counter and automatic
rollback on repeated boot failure; single-slot with a swap/staging area when
flash size is constrained; always verify signature *before* marking an
image bootable, not after first boot.

### Memory Management & Layout

**Typical MCU memory regions:** Flash (code, `.rodata`) is non-volatile,
execute-in-place (XIP — the CPU fetches instructions directly from the
mapped address, no load step); writable only in erase-then-program blocks,
never byte-granular. RAM (`.data`, `.bss`, stack, heap) is volatile, fast,
and the scarcest resource; `.data` is copied from flash at boot, `.bss` is
zeroed. Peripheral-mapped I/O uses special addresses whose reads/writes
trigger hardware side effects — always access through `volatile` pointers.

**Layout rules (linker script):**
- Bootloader occupies the lowest flash addresses; the application's vector
  table sits at a fixed, documented offset so the bootloader can jump to it
  deterministically.
- Stack grows downward (high → low); heap grows upward (low → high) from
  the end of `.bss`. Leave an explicit guard region between them, sized and
  monitored (via MPU or a canary pattern), not just "enough space by
  convention."
- Always cross-check the linker script against the generated `.map` file —
  a silently misplaced section (e.g., a DMA buffer landing in a
  non-DMA-capable RAM bank) fails at runtime with no compile-time error.

### RTOS vs Bare-Metal

**Bare-metal:** a single `main()` super-loop polling flags set by ISRs, or a
simple cooperative scheduler. Fully predictable, minimal RAM/flash footprint,
straightforward to debug with a JTAG/SWD probe.

**RTOS (e.g., FreeRTOS, Zephyr, ThreadX):** provides preemptive scheduling,
mutexes/semaphores, message queues, and optionally MPU-backed task isolation
(separate stacks, restricted memory regions per task). Adds RAM overhead and
scheduling jitter, but is the right choice once the system needs true
concurrency, priority-based scheduling, or isolation between subsystems of
differing trust/criticality.

**Decision:** prefer bare-metal for a small, fixed set of
periodic/interrupt-driven tasks with hard timing guarantees and a tiny
memory budget. Move to an RTOS once task count, priority-inversion risk, or
the need for memory/fault isolation outgrows what a super-loop can manage.

**Cortex-M dual-stack pattern:** separate Main Stack Pointer (exception
context) and Process Stack Pointer (task context) let an RTOS give each
task its own stack while exceptions run on MSP — the basis for per-task
stack overflow detection via MPU.

### Interrupt Handling & Peripherals

**Interrupt-driven I/O:** the ISR handles the immediate hardware event (clear
the pending flag, read/write a FIFO register) and defers everything else —
parsing, computation, notification — to the main loop or an RTOS task via a
queue/flag. Keep ISR bodies short and bounded; an ISR that blocks or spins
delays every lower-priority interrupt and the scheduler tick.

**Peripheral access:** memory-mapped registers, each device on its own
address range from the datasheet. Drivers must respect device-specific
timing (setup/hold times, state machines) and use atomic read-modify-write
for registers shared with an ISR (or disable that interrupt during the
critical section).

**Common peripherals:** GPIO (debouncing, edge/level trigger config),
UART/SPI/I2C local bus interfaces (pick per throughput, wiring cost,
multi-drop needs), timers (PWM, input capture, periodic interrupt source),
and the watchdog timer (WDT) — feed it only from a point that proves forward
progress of the *whole* system, never from an ISR alone, or a hung main loop
goes undetected.

**Anti-patterns:** ISRs doing heap allocation or logging over a slow UART;
missing `volatile` on hardware register pointers; multiple weakly linked
interrupt handlers silently overriding each other — route through one
explicit dispatcher per vector.

### Power Management

Power state selection is a first-class architecture decision, not an
afterthought: run/sleep/stop/standby modes trade wake latency for static
current draw. Peripheral clock gating is usually the single biggest,
lowest-risk power win; dynamic voltage/frequency scaling trades performance
for power on MPU-class parts. Always measure with a real current probe under
representative workload — datasheet numbers are best case.

### Memory Protection Unit (MPU) & Isolation

Cortex-M4 and above (and equivalent RISC-V PMP) provide a small number of
configurable memory regions with per-region access attributes (read, write,
execute, privileged/unprivileged, cacheable). Use it to enforce
privileged/unprivileged separation, mark stack guard regions as no-access
(turns stack overflow into an immediate hard fault instead of silent
corruption), and isolate a driver or untrusted component so a fault in it
can be caught and recovered instead of corrupting the whole system.

This is distinct from an MMU: no virtual memory or address translation, only
access control over fixed physical regions — plan region count and size at
design time, since most MPUs support only 8-16 regions.

### Security Essentials

**Cryptography:** always use a vetted, maintained library (wolfSSL, mbedTLS,
or a certified hardware crypto engine) — never a custom cipher. Encrypt
sensitive data at rest (flash) and in transit (TLS/DTLS).

**Secure boot:** anchor the chain of trust in immutable ROM or a fused public
key; each stage verifies the signature of the next before jumping; treat a
verification failure as fatal, never a warning. Also consider side-channel
leakage (timing, power analysis), tamper detection, and secure erasure of
key material on tamper/decommission.

**TEE / TrustZone-M:** hardware-enforced split between a Secure and a
Non-secure world on the same core, each with its own memory map and (on
Cortex-M) stack-pointer banking. Secrets live only in Secure-world memory;
the Non-secure side calls Secure services through a well-defined,
address-checked gateway — never a raw function pointer.

**Anti-patterns:** security by obscurity, hardcoded credentials or keys in
firmware images, unauthenticated/unencrypted firmware updates, treating a
signature check as optional in "trusted" environments, disabling the debug
port in production without an equally strong secure-boot chain to compensate.

### IoT & Distributed Systems

**Connectivity choices:** Wi-Fi/Bluetooth for short-range, higher-throughput,
mains- or frequently-charged devices; LoRaWAN/NB-IoT/cellular-IoT for
wide-area, multi-year battery deployments with small payloads; wired
Ethernet/RS-485/CAN where determinism and RF immunity matter.

**Single point of failure:** a cloud-dependent architecture fails entirely
when connectivity drops. Design offline-first: buffer and replay locally,
degrade gracefully to local control loops, and consider local mesh
networking when the gateway/cloud link is down. Separately, split distinct
concerns (comms stack, control loop, telemetry) into separately schedulable,
separately privileged components (RTOS tasks with MPU isolation, or separate
cores/TrustZone worlds) so a fault in one — e.g., a parsing bug in the
network stack — cannot corrupt or halt the real-time control path.

## Common Pitfalls

- **Fixed-size heaps:** `malloc()` fails unpredictably under memory pressure;
  prefer pooled/slab allocation or forbid dynamic allocation after init.
- **XIP performance blind spots:** flash execution is slower than RAM;
  profile before relocating hot code/ISRs into RAM — don't guess.
- **Flash writes treated as instantaneous:** block erase takes milliseconds
  and can stall an ISR if not handled asynchronously.
- **Conflicting weakly linked interrupt handlers:** route each vector
  through one explicit dispatcher instead of driver-level overrides.
- **Unvalidated linker scripts:** a misplaced section fails silently at
  runtime; always cross-check against the generated map file.
- **Silent memory corruption:** missing guard regions between stack and heap,
  or between isolated components — configure the MPU, don't rely on convention.
- **Watchdog fed from the wrong place:** feeding the WDT from an ISR that
  keeps firing even when the main application is hung defeats its purpose.
- **Firmware updates without rollback:** a single-slot update with no
  fallback bricks the fleet on a bad image; use A/B slots with boot counters.
- **Power modes as an afterthought:** bolting on low-power modes late forces
  a rework of peripheral init order and wake-source config.

## Checklist

- [ ] MCU vs MPU decision documented with power/latency/cost/certification trade-offs
- [ ] Memory layout (linker script) validated against the final `.map` file
- [ ] Chain of trust defined (ROM → bootloader → app), each stage verifying the next
- [ ] Firmware update mechanism supports rollback (A/B slots or equivalent)
- [ ] RTOS vs bare-metal trade-off evaluated and justified in writing
- [ ] ISRs kept short (target < 50 μs); heavy work deferred to main loop/task
- [ ] Peripheral drivers use `volatile`; atomic RMW where shared with an ISR
- [ ] Watchdog fed only from a point proving whole-system forward progress
- [ ] Cryptographic operations use a maintained library; secure/trusted boot
      chain anchored in immutable ROM or fused key material
- [ ] MPU (or PMP) configured for stack guard regions and untrusted-code isolation
- [ ] Power modes/wake sources designed in from the start, measured with a current probe
- [ ] IoT connectivity has a tested offline-first fallback path

## Resources

- ARMv7-M / ARMv8-M (TrustZone-M) architecture reference manuals
- Your MCU/MPU manufacturer datasheet (memory map, peripherals, interrupt
  vector table, power-mode current figures)
- wolfSSL or mbedTLS documentation for cryptography and TLS/DTLS
- RTOS kernel docs (FreeRTOS, Zephyr, ThreadX) for scheduling and MPU-backed
  task isolation
- Bootloader/secure-update references (MCUboot, manufacturer ROM bootloader
  application notes)
- Lacamera & Oliverio, *Embedded Systems Architecture*, 2nd ed.
