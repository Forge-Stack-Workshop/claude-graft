---
name: reverse-engineering
description: Reverse engineering ARMv8-A systems, ISA fundamentals, firmware analysis, disassembly techniques, exception handling, memory management, and secure boot chains for authorized security research and vulnerability discovery.
origin: Reverse Engineering Armv8-A Systems (Packt Publishing)
---

# Reverse Engineering ARMv8-A Systems

Firmware analysis, binary disassembly, and system-level debugging on ARM processors.

**Legal scope — defensive use only:** Authorized security research, vulnerability
assessment, hardening, and debugging on systems you own or have explicit written
permission to analyze. This skill is for understanding and closing weaknesses in
authorized targets — not for producing exploits, bypassing protections on
third-party or unauthorized systems, or any offensive how-to. Analysis of
firmware without authorization is prohibited. If a request implies attacking a
system you do not own or lack permission for, decline and redirect to authorized
scope only.

## When to Activate

- Analyzing firmware or kernel binaries to identify security vulnerabilities
- Debugging system-level crashes or unexpected behavior
- Reverse-engineering proprietary boot sequences or initialization code
- Hardening embedded systems against attack surface discovery
- Investigating CVEs or security incidents in ARM-based devices
- Understanding exception handling chains and privilege escalation paths
- Verifying hardware security feature coverage (PAN, PAC, BTI, MTE, TrustZone)

## ARMv8-A Instruction Set Architecture (ISA)

ARMv8-A uses a 64-bit register set (AArch64). Key registers:
- **X0–X30**: General-purpose registers (64-bit) / W0–W30 (32-bit views)
- **SP**: Stack pointer (exception-level specific: SP_EL0, SP_EL1, SP_EL2, SP_EL3)
- **PC**: Program counter (not directly readable/writable as a GPR)
- **PSTATE**: Processor state flags (condition codes N/Z/C/V, exception masks DAIF)
- **LR (X30)**: Link register, holds return address for `bl`/`blr`

### Instruction Categories

- **Data processing**: `add`, `sub`, `mul`, `and`, `orr`, `eor` (XOR), `bic`
  (bit clear), `orn` — arithmetic/logic used to manipulate control registers,
  MMU flags, and privilege bits
- **Memory access**: `ldr`/`str` (load/store), `ldp`/`stp` (pair, common in
  function prologue/epilogue for saving FP/LR), addressing modes (offset,
  pre/post-indexed, PC-relative via `adr`/`adrp`)
- **Flow control**: `b`/`bl` (branch/branch-with-link), `br`/`blr` (indirect
  branch via register — CFI-relevant), `cbz`/`cbnz`, `b.cond`, `ret`
  (pseudo-op for `br lr`), `svc` (supervisor call, triggers EL0→EL1 exception)

Reconstructing these sequences into equivalent C is the core reverse-engineering
skill: recognize prologue/epilogue patterns, loop constructs (compare + branch),
and switch-style jump tables (indirect branch through a register-indexed table).

## ELF Binary Format

- **File header**: `e_entry` (entry point address), `e_type` (EXEC/DYN/REL),
  target machine (`EM_AARCH64`)
- **Program headers**: `PT_LOAD` segments describe what the loader maps into
  memory; check `p_flags` (R/W/X) for writable+executable segments (attack
  surface signal)
- **Section headers**: `.text`, `.data`, `.bss`, `.symtab`/`.dynsym`,
  `.rela.dyn`/`.rela.plt` (relocations — relevant to ASLR/PIE analysis)
- Inspect with `readelf -h/-S/-l/-r`, `objdump -d`, `nm` — cross-reference
  symbol tables against disassembly before trusting a name.

## Exception Levels & Privilege Hierarchy

ARMv8-A defines four exception levels:
- **EL0**: User mode (applications, restricted privileged access)
- **EL1**: Kernel mode (Linux kernel, primary OS layer)
- **EL2**: Hypervisor (virtualization, guest OS isolation)
- **EL3**: Secure Monitor (TrustZone, firmware, boot)

Higher EL = higher privilege. System registers are accessible only from a
minimum EL (e.g., `TTBR0_EL1` = MMU page table base, accessible from EL1+).

## Exception Handling Flow

When an exception occurs:
1. **Cause captured**: `ESR_ELx` (Exception Syndrome Register) records exception class
2. **Context saved**: `ELR_ELx` (Exception Link Register) stores return address; `SPSR_ELx` saves processor state
3. **Level switch**: exception level may escalate (EL0→EL1, EL1→EL2, etc.)
4. **Vector dispatch**: PC branches to exception vector base (`VBAR_ELx`) + offset (0x0/0x200/0x400/0x600 depending on source)
5. **Handler execution**: CPU runs exception handler (synchronous, IRQ, FIQ, SError)

**Research focus:** analyze exception handlers in kernel/firmware to discover
memory abort handling gaps, privilege escalation, or SError masking issues —
to fix them, not to weaponize them.

## Memory Management Unit (MMU) & Address Translation

- **TTBR0_EL1**: first-level translation table base for user space (EL0)
- **TTBR1_EL1**: kernel space page tables
- **VTTBR_EL2**: Stage-2 page table base (hypervisor guest memory mapping)
- Multi-level page table walk (typically 4 levels for a 48-bit VA); page table
  entry attributes control read/write/execute and cacheability per page

Reverse engineering MMU configuration reveals address space layout, isolation
boundaries, and translation-related weaknesses (TLB inconsistency, side-channel
surface) that hardening work should close.

## Practice Environment & Linux Fundamentals

- Set up an isolated Arm target: a real Arm device (Raspberry Pi class) or
  QEMU `aarch64` emulation — never analyze production or third-party hardware
  without authorization.
- Understand user space vs. kernel space separation, syscall entry (`svc`),
  process memory layout (stack, heap, mmap regions, VDSO), and how the kernel
  image (`vmlinux`/`Image`) and modules (`.ko`) are structured.
- Kernel debug symbols and `/proc/kallsyms` are essential for mapping
  addresses back to source during authorized analysis.

## Static Analysis Workflow

### Tools & Frameworks
- **objdump / llvm-objdump**: disassemble ELF binaries (kernel, modules)
- **IDA Pro / Ghidra**: interactive reverse engineering (control flow, data flow, cross-references, decompilation)
- **radare2 / Cutter**: open-source binary framework (scriptable analysis, pattern matching)
- **readelf / elfdump**: parse ELF headers, sections, relocation records, symbol tables
- **strings / nm**: extract string literals, symbol names from binaries

### Analysis Process
1. **Load binary** (kernel, firmware image, `.ko` kernel module)
2. **Identify entry point** (ELF header `e_entry`, or `VBAR` base + 0x0 for exception handlers)
3. **Map exception vectors** (offsets 0x0/0x200/0x400/0x600 per privilege level/source)
4. **Trace function prologues** (stack frame setup via `stp fp, lr`, saved registers, AAPCS64 ABI compliance)
5. **Identify system call dispatch** (`svc #N` transitions EL0→EL1, argument passing in X0–X7)
6. **Build call graphs** (function cross-references, indirect branches via register/table lookups)
7. **Correlate with source** (kernel version, debug symbols, test coverage) for validation
8. **Document findings** (privilege escalation paths, memory safety issues, exception handling gaps)

## Dynamic Analysis

- **GDB + GEF** (GDB Enhanced Features): live register/memory inspection,
  breakpoints on exception vectors or syscall handlers, watchpoints on
  suspect memory regions.
- **QEMU with `-s -S`**: expose a GDB stub for remote kernel/firmware
  debugging in an isolated, disposable VM.
- **ltrace / strace**: trace library and system calls at runtime for
  authorized live analysis; correlate with static call graph.
- **uftrace**: function-level execution tracing (entry/exit, timing,
  argument capture where symbols allow) — useful to validate that static
  call-graph hypotheses match actual runtime behavior.

Always run dynamic analysis inside an isolated VM/emulator or an owned lab
device, never against a shared or production system.

## Threat Modeling & Attack Surface (Defensive Framing)

Weaknesses to identify and remediate, not exploit:
- **Use-after-free in exception handlers** → privilege escalation risk (EL0→EL1)
- **Missing bounds checking in memory abort handler** → information leak risk
- **Improper SError masking** → denial-of-service risk
- **TrustZone SMC dispatching faults** → secure-world isolation break risk
- **Pointer Authentication (PAC) bypass** → control-flow hijack risk (EL1+)
- **MMU misconfiguration** → address-space isolation break risk

Reverse engineering reveals these by examining handler code paths, register
manipulation, and exception chaining — the deliverable is a remediation plan
and/or a coordinated vulnerability disclosure, not a working exploit chain.

## Firmware & Boot Analysis

### Boot Chain & Trust Anchors
- **Secure Boot Chain**: bootloader → firmware → kernel, each stage verified via cryptographic signature
- **Device Tree Blobs (DTB)**: describe hardware layout, clocks, interrupts (parse via `dtc`, `/sys/firmware/devicetree`)
- **TrustZone Secure Monitor**: EL3 code handles SMC calls from lower ELs, routes to the TEE (Trusted Execution Environment)
- **Crash dumps (vmcore)**: analyze kernel memory images post-mortem (stack traces, `task_struct` pointers, corruption detection)

### Recovery & Forensics
- **Kernel panic handlers (EL1)**: capture crash context (registers, backtrace, memory state)
- **Kexec mechanism**: EL1 syscall loads and boots a new kernel without firmware re-initialization — useful for fast, controlled crash-recovery testing
- **Memory forensics**: reconstruct process memory layouts, locate heap overflows and use-after-free patterns for remediation

## Armv8-A Hardware Security Features (Hardening Reference)

Verify these mitigations are present and correctly configured — this is the
hardening half of reverse engineering:
- **PAN (Privileged Access Never)**: prevents EL1 from directly accessing
  EL0 memory unless explicitly enabled — check it isn't silently disabled
- **PAC (Pointer Authentication Code, ARMv8.3+)**: `PACIA`/`AUTIA` instructions
  sign and verify return addresses/pointers; a missing `AUT*` check before a
  `br`/`ret` is a hardening gap
- **BTI (Branch Target Identification)**: restricts indirect branch targets to
  marked landing pads (`bti` instruction) — mitigates JOP-style control-flow abuse
- **MTE (Memory Tagging Extension)**: tags memory allocations/pointers to
  detect use-after-free and buffer-overflow at runtime

### Related Weakness Classes (Understand to Defend)
- **Control-flow integrity (CFI) gaps**: unvalidated indirect branches (`br X30`, `br X1`)
- **ROP-style gadget density**: short instruction sequences ending in `ret`
  found via linear disassembly — a metric for exploit-mitigation review, not
  a target list to weaponize
- **Stack pivot risk**: unchecked `mov SP, X<n>` when memory content is
  attacker-influenced
- **Timing side-channels**: cache-timing (Spectre/Meltdown class), branch
  predictor state, exception-handler/interrupt latency — assess exposure,
  recommend constant-time patterns or masking mitigations

## Pitfalls & Gotchas

- **Exception level confusion**: EL0 runs user code; EL1 is kernel; EL2/EL3 are rare (VM/firmware only)
- **Register aliasing**: W0 is the lower 32 bits of X0; writing W0 zero-extends the upper bits of X0
- **Stack pointers per level**: SP_EL0 ≠ SP_EL1; exception handlers must restore the correct SP
- **Condition flags in PSTATE**: may be cleared between exceptions — don't assume prior state
- **System register access**: reading a restricted register triggers undefined behavior — verify privilege/EL before assuming access works
- **Trusting symbol names blindly**: stripped or renamed symbols can mislead — cross-check against control-flow and known ABI patterns

## Common Reverse Engineering Scenarios

### Kernel Module Analysis (`.ko` files)
- Parse kernel module ELF header, relocation records
- Identify exported symbols vs. internal functions
- Trace module init/cleanup callbacks (`init_module`, `cleanup_module`)
- Review `ioctl` handlers for missing privilege/bounds checks

### Hypervisor & Virtualization
- Analyze Stage-2 page table walks (`VTTBR_EL2` → guest memory translation)
- Identify VM-exit handlers, interrupt routing logic
- Review isolation boundaries between guest (EL1) and hypervisor (EL2)

### Secure Boot & UEFI
- Verify signature validation in the bootloader (Arm Secure Boot, UEFI SecureBoot)
- Identify rollback-protection mechanisms
- Analyze the Trusted Firmware-A (TF-A) dispatcher at EL3

## Validation Checklist

- [ ] Legal authorization confirmed for the firmware/system under analysis
- [ ] No reverse-engineered code repurposed for commercial systems without licensing review
- [ ] Analysis performed in an isolated lab device or emulator (QEMU), not shared/production hardware
- [ ] Vulnerability disclosure follows responsible disclosure (vendor + CVE process)
- [ ] Analysis respects applicable local law / DMCA §1201 exemption where relevant
- [ ] Disassembled output does not retain original vendor proprietary comments
- [ ] Exception handler traces mapped to real call sites (verify via debug symbols)
- [ ] Crash analysis correlates stack pointers to exception level & context
- [ ] Hardware mitigation coverage checked (PAN/PAC/BTI/MTE) where the target supports them
- [ ] Report documents tested weaknesses, containment boundaries, and remediation — not a reusable exploit chain
