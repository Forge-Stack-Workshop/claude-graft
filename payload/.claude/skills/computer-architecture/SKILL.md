---
name: computer-architecture
description: CPU/ISA fundamentals, pipelining, cache and memory hierarchy, instruction-level and data-level parallelism (superscalar, SIMD), GPU compute, RISC-V/ARM/x86 architecture differences, performance-critical low-level design, and hardware security (speculative execution, confidential computing). Use when reasoning about why code is slow at the hardware level, choosing data structures/algorithms for cache friendliness, designing for a target ISA, or evaluating hardware-level security exposure.
origin: biblio
---

# Computer Architecture

Reasoning about software performance and security from the hardware up: how
instructions actually execute, why memory access patterns dominate real-world
speed, and where modern CPUs/GPUs trade complexity for throughput.

## When to Activate

- Diagnosing performance that profiling attributes to "memory-bound" or
  "cache-unfriendly" code, not algorithmic complexity.
- Explaining why a benchmark result differs across CPU generations, ISAs
  (x86 vs ARM vs RISC-V), or core counts.
- Designing data layouts, loops, or numeric kernels for throughput
  (vectorization/SIMD candidates, cache-line-sized structures).
- Evaluating hardware-level security exposure: speculative-execution
  side channels, confidential computing needs, secure boot/attestation.
- Choosing between scalar, multi-threaded, SIMD, and GPU implementations
  for a compute-heavy workload.
- Reviewing low-level or embedded code where instruction count, branch
  behavior, or memory footprint materially matter.

## Core Model: Why the Hardware Shapes Software Speed

A processor's apparent speed comes from three largely independent levers:
clock frequency, instructions-per-cycle (via pipelining/superscalar/SIMD),
and reduced memory stalls (via caching). Software can only exploit levers
the hardware exposes — a change that ignores cache locality or defeats
branch prediction can dominate an algorithmic improvement.

## Instruction Pipelining

A pipeline overlaps fetch/decode/execute/writeback stages across
consecutive instructions instead of running them serially, so a new
instruction can complete roughly every cycle after the pipeline fills.

**Hazards break this overlap:**
- **Data hazards** — an instruction needs a result not yet produced by an
  earlier one still in flight. Mitigated by forwarding/bypassing, or
  resolved by stalling.
- **Control hazards** — a branch's target isn't known until it resolves,
  so the pipeline doesn't know what to fetch next. Mitigated by branch
  prediction (tracking branch history to guess the target speculatively)
  and speculative execution (executing predicted instructions before the
  branch resolves, discarding them on misprediction).
- **Structural hazards** — two instructions need the same hardware
  resource simultaneously.

**Practical implication:** unpredictable branches (data-dependent, not
loop-bound) cost real cycles on misprediction. Tight loops with a
consistent, predictable branch pattern pipeline far better than code full
of unpredictable conditionals in the hot path.

## Superscalar and Superpipelined Design

- **Superscalar**: multiple execution units let more than one instruction
  issue per cycle — this is instruction-level parallelism (ILP) realized
  in hardware. Benefits shrink when the instruction stream lacks a mix of
  independent operations to issue in parallel (e.g., a long dependency
  chain).
- **Superpipelined**: more, shorter pipeline stages, raising achievable
  clock frequency at the cost of a larger misprediction penalty (more
  stages to flush).
- **Out-of-order (OoO) execution**: instructions execute as operands
  become ready rather than strictly in program order, then retire in
  order — recovers ILP that in-order issue would otherwise stall on.
- Compilers/programmers can help superscalar utilization by
  interleaving independent operations so the hardware has real
  parallelism to exploit, rather than one long dependent chain.

## SIMD (Data-Level Parallelism)

SIMD instructions apply one operation to an array of values in a single
instruction — the natural fit for numeric kernels that apply the same
math to many elements (signal processing, image/video, linear algebra).
Contrast with scalar instructions, which operate on one value at a time.

**Practical implication:** loops over homogeneous numeric arrays with no
data-dependent branching and no cross-iteration dependency are SIMD
(auto-)vectorization candidates. Data-dependent branches or irregular
memory access inside the loop body block vectorization.

## Memory Hierarchy and Cache Behavior

Memory is layered (registers → L1/L2/L3 cache → main memory → secondary
storage) because fast memory is expensive and small; each layer trades
capacity for latency. A cache line is the fixed-size block moved between
levels — accessing one byte pulls in the whole line.

**Two locality principles drive cache effectiveness:**
- **Spatial locality**: accessing memory near recently accessed
  addresses (sequential array traversal) — benefits from cache-line
  fetches.
- **Temporal locality**: re-accessing the same memory soon (a
  hot loop variable, a small working set) — benefits from data staying
  resident in cache across accesses.

**Practical implications:**
- Iterate arrays/matrices in memory order (row-major for row-major
  layout) to exploit spatial locality; a naive column-major traversal of
  a row-major array can be an order of magnitude slower purely from cache
  misses, with no algorithmic change.
- Pack frequently-accessed-together fields into the same cache line
  (structure-of-arrays vs array-of-structures) when the access pattern is
  known.
- A working set that fits in L2/L3 stays fast; one that doesn't will
  stall on main-memory latency regardless of clock speed.

## Virtual Memory and the TLB

Paged virtual memory gives each process an isolated address space; the
OS and hardware translate virtual addresses to physical ones per page.
A translation lookaside buffer (TLB) caches recent virtual-to-physical
translations in the processor so most accesses skip the full page-table
walk. A TLB miss adds real latency — workloads that touch memory in
patterns spanning many distinct pages (large sparse working sets,
excessive `mmap` regions) generate more TLB misses than dense,
localized access patterns.

## Multiprocessing and Cache Coherence

In multicore/multiprocessor systems, each core typically has its own
private cache. Cache coherence protocols (commonly snooping-based) keep
those private caches consistent when one core writes data another core
has cached — this is why shared-memory concurrency has a hardware cost:
cross-core writes to shared cache lines trigger coherence traffic (a
source of "false sharing" bugs/slowdowns when unrelated variables share a
cache line across threads).

## GPU Compute

GPUs trade single-thread speed for massive thread-level parallelism:
thousands of simple cores execute the same instruction stream across many
data elements (SIMT — single-instruction, multiple-thread), suited to
workloads that are both highly parallel and largely branch-free per
thread group. Use a GPU when the workload is data-parallel at scale
(graphics, large matrix/tensor math); a CPU wins on workloads dominated
by sequential logic, unpredictable branching, or low parallelism.

## ISA Differences: x86, ARM, RISC-V

- **x86 (CISC-heritage)**: variable-length, complex instructions;
  internally decoded into micro-ops (µops) and executed on an
  out-of-order superscalar core — externally CISC, internally RISC-like.
  Dominant in desktop/server, backward compatibility is a first-class
  constraint.
- **ARM**: simpler, more uniform fixed-length instruction encoding;
  optional SIMD/floating-point extensions; dominant in mobile/embedded
  and increasingly server, generally more power-efficient per operation.
- **RISC-V**: open, modular ISA — a small mandatory base integer
  instruction set plus optional standard extensions (e.g., a compressed
  encoding, vector/SIMD-for-floating-point extension), letting
  implementers include only what a target device needs. No licensing
  fee, growing adoption in embedded, and increasingly in higher-
  performance designs.

**Practical implication:** the same algorithm can perform very
differently across ISAs due to instruction density, available SIMD
width, and micro-architectural depth — never assume portability of
performance characteristics across architectures without measuring on
the target.

## Amdahl's Law (Bounding Parallel Speedup)

The speedup from parallelizing part of a workload is capped by the
fraction that remains serial: if a fraction *s* of the work is
inherently sequential, no amount of added parallelism can push total
speedup past `1/s`. Before adding threads/cores/SIMD lanes to a
workload, identify the serial portion — it sets the ceiling on any
gain, independent of hardware.

## Hardware Security

- **Speculative-execution side channels** (Spectre/Meltdown-class):
  branch prediction and speculative execution can transiently access
  or compute on data that should be inaccessible, leaving observable
  timing side effects (e.g., via cache state) even though the
  speculated instructions are architecturally discarded. Relevant when
  evaluating code that crosses trust/privilege boundaries (sandboxes,
  hypervisors, JIT-compiled untrusted code).
- **Confidential computing** (e.g., Intel TDX-class technology):
  hardware-enforced isolation that protects data in use (in memory,
  during execution), not just at rest or in transit, against a
  compromised hypervisor/OS or physical access — relevant for
  multi-tenant cloud workloads handling sensitive data.
- Hardware security features are a complement to, not a substitute for,
  software-level input validation and access control.

## Pitfalls

- **Assuming algorithmic Big-O predicts wall-clock time.** A
  lower-complexity algorithm with poor cache locality routinely loses to
  a higher-complexity one that stays cache-resident, especially at
  moderate data sizes.
- **Ignoring branch predictability.** Replacing a predictable loop-bound
  branch with a data-dependent one (e.g., sorting-dependent branches in
  a hot loop) can silently cost more than the "optimization" saves.
- **False sharing.** Two threads writing to independent variables that
  happen to share a cache line thrash coherence traffic — looks like a
  concurrency bug but is a layout problem.
- **Expecting SIMD/vectorization "for free."** Data-dependent branching,
  pointer aliasing, or irregular strides inside a loop block
  auto-vectorization even when the algorithm is conceptually
  parallel.
- **Parallelizing without checking the serial fraction first**
  (Amdahl's Law) — throwing more cores at a workload whose bottleneck is
  a serial section yields diminishing or zero returns.
- **Porting performance assumptions across ISAs unchanged.** SIMD width,
  micro-op decoding cost, and pipeline depth differ enough between x86,
  ARM, and RISC-V that a "hot path" tuned on one can be average or worse
  on another — remeasure on the actual target.
- **Treating speculative-execution mitigations as optional in
  multi-tenant/sandboxed contexts.** Where untrusted code shares a core
  or hypervisor with sensitive data, side-channel exposure is a real
  attack surface, not a theoretical one.
