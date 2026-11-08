---
name: arm-cortex-dev
description: Arm Cortex-M microcontroller development — hardware selection, CMSIS, NVIC/interrupts, boot/startup code, toolchains, SWD/JTAG debugging, RTOS integration, low-power modes, and fault handling.
origin: biblio
---

# Arm Cortex-M Development

Practices for building, debugging, and shipping software on Arm Cortex-M
microcontrollers — from selecting a core to bringing up boot code, wiring
interrupts, integrating an RTOS, and minimizing power draw.

## Prerequisites (preflight)

```bash
command -v arm-none-eabi-gcc || echo "WARN: install the ARM GNU toolchain"
```

## When to Activate

- Choosing a Cortex-M variant (M0/M0+/M3/M4/M23/M33/M55…) for a new product
- Writing or reviewing startup code, vector tables, or linker/scatter files
- Configuring the NVIC, interrupt priorities, or exception handlers
- Setting up a toolchain (compiler, debugger, build system) for a Cortex-M target
- Debugging over SWD/JTAG, or diagnosing a HardFault/bus fault
- Integrating CMSIS-CORE, CMSIS-DSP, or CMSIS-NN
- Deciding between bare-metal and RTOS, or configuring an RTOS (FreeRTOS, RTX, Zephyr…)
- Reducing power consumption (sleep modes, WFI/WFE, ultra-low-power design)
- Setting up CI for embedded targets (hardware-in-the-loop or virtual platforms)

## Hardware Selection

Match the core to the workload, not the other way around — over-speccing wastes
power and cost, under-speccing forces a late re-spin.

| Axis | Guidance |
| --- | --- |
| Performance | Cortex-M0/M0+ for simple control loops; M3/M4 for signal processing; M55 for ML/DSP-heavy workloads |
| Power | M0+ is the go-to smallest-area/lowest-power core; ultra-low-power designs restrict software capability (fewer wakeups, smaller RAM footprint) |
| Security | M23/M33 add TrustZone for secure/non-secure world separation |
| DSP/ML | M4/M33/M55 add DSP extensions; M55 adds Helium (MVE) for ML acceleration via CMSIS-NN |
| Ecosystem | Verify RTOS, connectivity stack, and SDK availability for the chosen core *before* committing — a great core with no software ecosystem stalls the project |

Prototype and validate architecture decisions on a **virtual platform** (Fixed
Virtual Platform / Arm Virtual Hardware) before hardware is available — it
runs the exact target ISA and catches boot/memory-map issues early.

## Boot and Startup Code

Every Cortex-M program needs startup code executed on reset, regardless of
target platform. Core elements:

1. **Exception vector table** — the first data placed in flash/ROM. Contains
   the initial stack pointer value and a handler address for every exception
   type (reset, NMI, HardFault, and peripheral interrupts). Must be linked at
   the CPU's expected base address (commonly `0x0` or a vendor-specific offset).
2. **Reset handler** — runs immediately after reset; initializes system state
   (clocks, FPU, caches if present) then calls the C runtime entry point
   (`__main` or equivalent) before jumping to `main()`.
3. **Fault handlers** — illegal or bad memory accesses, and other unrecoverable
   errors, are lumped under a category called **HardFault**. Always implement a
   distinct HardFault handler (even if it just captures the stacked registers
   and halts) — a default/empty handler makes field failures undebuggable.
4. **Linker/scatter file** — defines memory regions (flash, RAM, boot section)
   and tells the linker where each section (vector table, code, data) must be
   placed. The vector table section must be pinned first in the boot region.

Prefer generating startup code from CMSIS-CORE device templates rather than
hand-rolling — it keeps the vector table and system init code consistent with
vendor CMSIS device headers.

## CMSIS

The Cortex Microcontroller Software Interface Standard (CMSIS) is a
vendor-neutral collection of API definitions, tools, and reference
implementations that keep code portable across Cortex-M silicon vendors.
Key components:

- **CMSIS-CORE** — startup code templates, system configuration files, and a
  hardware abstraction layer for the core (NVIC access, SysTick, core
  registers). Start here for any new bare-metal or RTOS project.
- **CMSIS-DSP** — 60+ optimized DSP algorithm implementations (filters, FFT,
  matrix math). Use instead of hand-writing signal-processing primitives —
  they are tuned per Cortex-M variant.
- **CMSIS-NN** — optimized low-level neural network kernels for on-device ML
  inference. Pairs with CMSIS-DSP for feature extraction pipelines (e.g.
  audio → MFCC → NN classifier).
- **CMSIS-RTOS2** — a common RTOS API abstraction (backed by RTX or another
  compliant RTOS) so application code isn't locked to one RTOS's native API.

Pull CMSIS from the upstream repository rather than vendoring a stale copy —
device headers and DSP/NN kernels are updated frequently for new cores.

## NVIC and Interrupts

The Nested Vectored Interrupt Controller (NVIC) is part of the processor core
itself (not a separate peripheral) and is described alongside the rest of the
core in the exception vector table. Practices:

- Configure interrupt priorities explicitly — do not rely on power-on defaults
  for anything safety- or timing-critical.
- Keep interrupt service routines short: do the minimum work to acknowledge
  the event and hand off to a task/queue; avoid blocking calls in an ISR.
- Reserve the highest priority for hard-real-time interrupts only (e.g. motor
  control tick) — an unbounded set of high-priority ISRs defeats determinism.
- Use SysTick (part of CMSIS-CORE) as the standard system tick source for
  RTOS scheduling or software timers — it's present on every Cortex-M core,
  which keeps timing code portable across vendors.

## Toolchain and Build

- A software project is typically Make-based (or CMake-based): source files,
  a linker/scatter file, and a build script producing the final executable
  (`.axf`/`.elf`).
- Pick a toolchain (Arm Compiler for Embedded, GCC-based `arm-none-eabi`,
  IAR…) up front and pin its version — code generation and library behavior
  (e.g. `fputc`/`fgetc` semihosting defaults) differ across toolchains.
- Validate the build on a virtual platform (FVP) in CI before requiring
  physical hardware — it removes hardware availability as a bottleneck for
  every contributor and for automated testing.

## Debugging (SWD/JTAG)

- Connecting a debugger to a Cortex-M target requires wiring the SWD pins
  (SWDIO, SWCLK, GND at minimum) between the debug probe and the target —
  confirm the pin mapping against the target board's documentation before
  first connection.
- Use a debug adapter/OpenOCD-style config matched to the target chip and
  probe; a wrong config connects but produces garbage reads or silent
  failures, not a clear error.
- On a HardFault, first recover the stacked exception frame (PC, LR, stacked
  registers) from the stack pointer at fault time — the faulting instruction
  address in the recovered PC is the fastest path to root cause.
- Semihosting is convenient for early bring-up (`printf` over the debug link)
  but is slow and stalls the CPU on each call — replace with a real UART or
  RTT-based logging path before doing any timing-sensitive work.

## RTOS vs Bare-Metal

The first architectural choice for a microcontroller application: bare-metal
or RTOS.

| | Bare-metal | RTOS |
| --- | --- | --- |
| Determinism | Fully manual, predictable if simple | Scheduler-managed, deterministic response to external events by design |
| Complexity | Grows unmanageable as task count increases | Built-in task/queue/semaphore primitives scale better with complexity |
| Footprint | Minimal | Extra flash/RAM for kernel + task stacks |
| Middleware | Must integrate manually | RTOS ecosystems (FreeRTOS, Azure RTOS, Zephyr, CMSIS-RTOS2/RTX) ship middleware stacks (networking, filesystem) ready to integrate |

Choose an RTOS when the application juggles multiple asynchronous event
sources with real-time response requirements; stay bare-metal for simple,
single-loop control tasks where an RTOS's footprint isn't justified.

When adopting an RTOS, prefer the CMSIS-RTOS2 API surface where available —
it decouples application code from the specific RTOS kernel and eases a
later kernel swap.

## Low-Power Design

- Power is a primary axis for Cortex-M core selection, not an afterthought —
  decide the power budget before picking the core (M0+ for the
  lowest-power/smallest-area class).
- Use the core's sleep instructions (`WFI`/`WFE`) to idle the CPU between
  events instead of busy-polling — this is the single largest power win on
  most designs.
- Ultra-low-power targets (multi-year battery or energy-harvested designs)
  actively restrict software capability: fewer/rarer wakeups, smaller RAM
  working sets, and careful peripheral duty-cycling. Design the wake/sleep
  budget explicitly rather than optimizing an already-written always-on loop.
- Validate power behavior on real hardware — power draw is not something a
  virtual platform models accurately; profile current draw per sleep state
  before committing to a battery-life claim.

## Common Pitfalls

- Empty or default HardFault handler — turns every fault into an unrecoverable,
  undiagnosable field failure. Always capture the stacked frame.
- Vector table not pinned first in the linked memory image — corrupts reset
  behavior in subtle, hard-to-reproduce ways.
- Long-running or blocking work inside an ISR — breaks real-time guarantees
  for every other interrupt at equal or lower priority.
- Leaving semihosting `printf` enabled past early bring-up — silently stalls
  the CPU and skews any timing measurement taken with it active.
- Picking a core on raw performance alone, ignoring RTOS/SDK/connectivity
  ecosystem availability — stalls the project once real integration starts.
- Treating power optimization as a late-stage tuning pass instead of an
  upfront budget — ultra-low-power targets need the constraint designed in
  from the first wake/sleep architecture decision.
- Vendoring a stale CMSIS copy instead of pulling from upstream — misses
  device header fixes and newer DSP/NN kernel optimizations.
