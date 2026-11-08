---
name: autosar-automotive
description: AUTOSAR Classic/Adaptive layered architecture, RTE/VFB, SWC modeling with ARXML, BSW communication stack (COM/PduR/CanIf), OS scheduling (OSEK), and safety/security concepts for automotive ECU software.
origin: biblio
---

# AUTOSAR Automotive

Reference model for designing and reasoning about AUTOSAR-based automotive ECU software:
layered architecture, Software Components (SWCs) and the Runtime Environment (RTE), the
Basic Software (BSW) communication stack, the AUTOSAR OS (OSEK-derived), and the
Classic vs. Adaptive platform split. Based on *AUTOSAR Fundamentals and Applications*
(Packt, 2024).

## When to Activate

- Designing or reviewing an ECU software architecture (layers, SWC decomposition, ports/interfaces)
- Writing or reading ARXML port/interface/component definitions
- Explaining RTE-generated APIs (`Rte_Read`/`Rte_Write`/`Rte_Call`) or VFB communication semantics
- Working on the AUTOSAR communication stack: COM, PduR, CanIf/CanTp, transport protocol segmentation
- Reasoning about AUTOSAR OS task scheduling, alarms, events, or OSEK-style task code
- Comparing Classic Platform (CP) vs Adaptive Platform (AP) for a use case (static ECU vs SOA/Ethernet)
- Discussing AUTOSAR methodology (System/ECU Configuration, code generation) or diagnostics (DCM/DEM/DET)

## Layered Architecture

Three-layer model, from application down to silicon:

1. **Application Layer** — SWCs implementing business logic (e.g., BMS, climate control), hardware-independent.
2. **RTE (Runtime Environment)** — the "glue layer," a per-ECU generated component that implements the
   **Virtual Functional Bus (VFB)** concept: SWCs communicate only through RTE-generated APIs, never
   directly with BSW or each other. This makes SWCs portable across ECUs.
3. **BSW (Basic Software)**, itself split in three sub-layers:
   - **Service Layer** — DCM, DEM, memory services, OS, communication services (COM, PduR).
   - **ECU Abstraction Layer** — hardware-independent-from-application but ECU-specific modules
     (bus interfaces like CanIf/LinIf, memory abstraction, I/O abstraction).
   - **MCAL (Microcontroller Abstraction Layer)** — direct hardware drivers (CAN driver, ADC driver, etc.),
     the only layer allowed to touch the microcontroller registers directly.

Rule of thumb when reviewing a design: application code must never call BSW/MCAL directly — always
through RTE. Complex Device Drivers (CDDs) are the sanctioned exception, bypassing RTE for
low-latency/non-standardized hardware access.

## Classic Platform (CP) vs Adaptive Platform (AP)

Not a replacement relationship — they are complementary, chosen per use case:

| Aspect | Classic (CP) | Adaptive (AP) |
|---|---|---|
| Target | Fixed-function ECUs, resource-constrained | Flexible, upgradable HW/SW (HPC, ADAS, infotainment) |
| Config | Static, design-time | Dynamic, runtime service discovery |
| OS | OSEK/VDX-based RTOS, deterministic | POSIX-compliant (typically Linux) |
| Comms | CAN/LIN/FlexRay/Ethernet, static routing | SOA over Ethernet: Service Discovery (SD), SOME/IP |
| Fit | Powertrain, chassis, hard real-time, safety-critical | Automated driving, connected features |

**Foundation (FO)** provides shared cross-platform artifacts (E2E Protocol Spec, V2X Spec, Secure
Onboard Communication (SecOC) spec, Intrusion Detection System Protocol) so CP and AP ECUs
interoperate on the same vehicle network.

## Software Components (SWCs)

Building blocks of the application layer, containing:

- **Ports** — interaction points. **PPort** (provided, output — like a service desk) and **RPort**
  (required, input — like a customer requesting a service). Compared to electrical outlet/plug:
  standardized, must match to connect.
- **Interfaces** attached to ports:
  - **Sender-Receiver (SR)**: one-directional data push (e.g., speed sensor → speedometer + ECU).
    Two flavors:
    - *Implicit* — `IRead_<Runnable>_<Port>_<DataItem>()` / `IWrite_...` — RTE snapshots data
      once at runnable start/end; safe against another higher-priority runnable mutating it mid-execution.
    - *Explicit* — `Rte_Read_<Runnable>_<Port>_<DataItem>()` / `Rte_Write_...` — reads/writes the
      RTE shared buffer immediately; can be queued (FIFO of N) or unqueued (latest value only).
  - **Client-Server (CS)**: bidirectional request/response (e.g., a climate-control SWC calling an
    A/C compressor SWC's `RunService` operation). RTE API: `Rte_Call_<Port>_<Operation>()`.
- **Runnables** — the actual executable functions (think: implementation of a C function), triggered by
  data-received events, timing events, or explicit calls. Priority matters: a higher-priority runnable can
  interrupt a lower one and mutate shared implicit/explicit buffers mid-flight — a source of race
  conditions if not analyzed.
- **Internal behavior** — the blueprint tying runnables, ports, and triggering conditions together.
- **Data types**: **Application data types** are platform-independent (portable representation);
  **Implementation data types** bind them to an actual C type/size for a target.

### ARXML port modeling (provided port, sender-receiver)

```xml
<P-PORT-PROTOTYPE SHORT-NAME="Example_SenderPort">
  <PROVIDED-COM-SPECS>
    <NONQUEUED-SENDER-COM-SPEC>
      <DATA-ELEMENT-REF DEST="VARIABLE-DATA-PROTOTYPE">
        /PortInterfaces/If_SR_SenderReceiverTest/VehicleSpeed
      </DATA-ELEMENT-REF>
    </NONQUEUED-SENDER-COM-SPEC>
  </PROVIDED-COM-SPECS>
  <PROVIDED-INTERFACE-TREF DEST="SENDER-RECEIVER-INTERFACE">
    /PortInterfaces/If_SR_SenderReceiverTest/
  </PROVIDED-INTERFACE-TREF>
</P-PORT-PROTOTYPE>
```

Required (R-Port) is the mirror image: `<R-PORT-PROTOTYPE>` + `<NONQUEUED-RECEIVER-COM-SPEC>`
(or `<QUEUED-RECEIVER-COM-SPEC>` for buffered/queued data).

Client-server port (server side) references an operation instead of a data element, under
`PROVIDED-COM-SPECS` → `SERVER-COM-SPEC` → `OPERATION-REF`.

### C-side RTE usage example

```c
Rte_ResultType res = Rte_Call_TempInputPort_GetTemperature(&currentTemperature);
Rte_Write_TempOutputPort_Temperature(&currentTemperature);
```

RTE-generated prototypes look like:

```c
Std_ReturnType Rte_Call_TempInputPort_GetTemperature(float* temperature);
Std_ReturnType Rte_Write_TempOutputPort_Temperature(const float* temperature);
```

Use these exact naming conventions (`Rte_<Read|Write|Call|IRead|IWrite>_<Runnable/Port>_<Port>_<DataItem/Operation>`)
when generating or reviewing RTE-facing code — they are not free-form.

## VFB and RTE Generation

The **Virtual Functional Bus (VFB)** is the abstract concept representing "communication as if all
SWCs were directly wired," independent of whether communication is intra-ECU or inter-ECU. The
RTE is the concrete, per-ECU realization of the VFB: it is generated from the SWC descriptions
(ARXML) plus the system/ECU configuration, mapping VFB connections onto real RTE calls or
BSW communication-stack calls depending on whether the peer SWC lives on the same ECU or not.
**Connectors** in the authoring tool represent the PPort↔RPort data-flow links that the RTE generator
consumes.

Consequence for review: changing an SWC's port mapping or ECU placement never requires touching
the SWC's C code — only re-running RTE generation — as long as the interface contract stays stable.

## Communication (BSW) Stack

Layered PDU pipeline from application data down to the wire, split across Service /
ECU Abstraction / MCAL:

```
COM  →  PduR  →  CanTp (segmentation/reassembly)  →  CanIf  →  CAN Driver  →  bus
```

- **COM**: abstracts protocol/signal packing — the first point where an SDU (raw data, e.g. "1kB from
  the app") gets framed with a PCI (protocol control info: frame type, sequence number, addressing).
- **PduR (PDU Router)**: routes PDUs between modules/buses (e.g., CAN↔Ethernet gatewaying), decoupling
  COM from the specific bus in use.
- **CanTp**: Transport Protocol module — segmentation, flow control, error detection/addressing for
  payloads exceeding a single CAN frame.
- **CanIf**: translates PduR/ComM protocol-agnostic requests into CAN-specific commands, adds the CAN ID.
- **BusSM (e.g. CanSM, EthSM)**: manages bus-specific communication-mode state machines, driven by
  **ComM** (Communication Manager) mode-change requests.
- **CAN Driver (MCAL)**: takes CanIf's output as its own SDU and transmits over the physical bus.

At each layer boundary, "SDU" (payload) becomes "PDU" (payload + that layer's own header/PCI) for
the layer below — the same bytes are reframed repeatedly as they descend the stack. Useful mental
model when debugging a CAN trace against a stack trace.

## AUTOSAR OS (OSEK-derived)

AUTOSAR OS builds on **OSEK/VDX**, adding scalability for AUTOSAR's layered architecture while
keeping OSEK's deterministic, priority-based real-time scheduling.

### Scheduling policies

- **Full preemptive**: a higher-priority task ready for execution immediately preempts the running
  task (context saved, resumed later exactly where interrupted). Meets hard real-time deadlines.
- **Non-preemptive (cooperative)**: a task keeps the CPU until it voluntarily yields, is preempted by
  an ISR, or a rescheduling point is reached — can delay higher-priority tasks if abused.
- **Highest-priority-first with same-priority FIFO**: tasks of equal priority queue FIFO on a shared
  resource; only one runs at a time; no preemption *within* the same priority level. This is the
  mechanism providing "timing protection."

### Events (inter-task synchronization)

`SetEvent` / `ClearEvent` / `WaitEvent` / `GetEvent` — a task blocks in `WaitEvent` until another task
(or ISR) calls `SetEvent` on it.

```c
#define Event1 0x01

TASK(Task1) {
    SetEvent(Task2, Event1);
    TerminateTask();
}

TASK(Task2) {
    WaitEvent(Event1);
    // ... runs once Event1 is set ...
    ClearEvent(Event1);
    TerminateTask();
}
```

### Alarms (time-driven activation)

Counters (system/hardware/software ticks) drive alarms; an alarm expiring can activate a task or
set an event.

```c
#define ALARM_CYCLE 10

void setup(void) {
    SetRelAlarm(Alarm1, ALARM_CYCLE, ALARM_CYCLE); // first expiry + cyclic period
}

// on each tick:
IncrementCounter(Counter1);
if (CheckAlarmExpired(Alarm1)) {
    ActivateTask(Task1);
}
```

Use alarms for periodic polling (e.g., "check sensor every 100 ms"); use events for ad hoc
inter-task handoffs.

## AUTOSAR Methodology & Data Exchange

Development flows through ARXML at three configuration stages:

1. **Virtual System Design** — SWCs, interfaces, ports, defined independent of any ECU.
2. **System Configuration** — SWCs mapped to ECUs, connectors resolved to intra-/inter-ECU
   communication, communication matrix (signals→PDUs→frames) derived.
3. **ECU Configuration** — per-ECU BSW module configuration (COM, OS tasks, CanIf, etc.), feeding
   RTE generation and BSW code generation.

**Conformance classes** scope how much of the standard an ECU must implement (from minimal
CC1 up), driven by ECU resource constraints and whether OS/COM/RTE are all present.

ARXML is validated against the official AUTOSAR XML Schema — treat schema violations as blocking,
not stylistic, since code generators are schema-driven.

## Safety & Security Notes

- **Foundation (FO)** documents shared by CP/AP include the **E2E Protocol Specification** (end-to-end
  data protection against communication corruption/loss), **SecOC** (Secure Onboard Communication —
  authenticates PDUs, typically via truncated MAC + freshness counter), and the **Intrusion Detection
  System Protocol** spec.
- **Diagnostics**: DCM (Diagnostic Communication Manager, UDS-style request/response), DEM
  (Diagnostic Event Manager, fault memory), DET (Default Error Tracer, development-time error
  reporting) — keep these three separate in review: DCM is the transport/session layer, DEM owns
  event/fault state, DET is a debug-only reporting sink.
- Time synchronization across ECUs uses **StbM** (Synchronized Time-Base Manager) with bus-specific
  sync modules like **CanTSyn**.
- Security vs. safety are explicitly distinguished in the source material: safety concerns unintended
  hazards (ISO 26262 domain), security concerns intentional attacks — SecOC and crypto stack
  (Crypto Service Manager) address the latter and must not be conflated with ASIL decomposition work.

## Common Pitfalls (reject in review)

- SWC code calling BSW/MCAL APIs directly instead of RTE-generated APIs (breaks portability) —
  Complex Device Drivers are the only sanctioned exception.
- Using explicit unqueued SR communication where queuing semantics are actually required (data loss
  under high-priority preemption) — check runnable priorities before picking implicit vs explicit,
  queued vs unqueued.
- Treating Adaptive AUTOSAR as a "successor" to Classic in an architecture decision — they solve
  different problems (static/deterministic vs dynamic/SOA); pick per subsystem, not per project.
- Hand-writing ARXML that doesn't validate against the AUTOSAR XML Schema — always validate before
  handing to a code generator.
- Conflating DCM/DEM/DET responsibilities, or SecOC (security) with functional-safety mechanisms.
