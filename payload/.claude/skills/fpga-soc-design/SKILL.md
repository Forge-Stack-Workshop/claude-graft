---
name: fpga-soc-design
description: FPGA and SoC design fundamentals covering HDL languages (VHDL, Verilog, SystemVerilog), synthesis workflows, timing closure, simulation and testbenches, IP core integration, High-Level Synthesis (HLS), and system-on-chip architecture patterns for hardware acceleration and embedded systems.
origin: FPGA Programming Handbook, 2nd Edition
---

# FPGA & SoC Design

Hardware design patterns for FPGA-based systems and System-on-Chip (SoC)
implementations. Vendor-agnostic: applies to AMD/Xilinx, Intel/Altera,
Lattice, and Microchip toolchains alike.

## When to Use This Skill

- Designing digital hardware in VHDL, Verilog, or SystemVerilog
- Planning synthesis workflows and timing closure strategies
- Writing and structuring simulation testbenches
- Integrating IP cores (memory controllers, bus bridges, protocol engines) into a larger design
- Evaluating High-Level Synthesis (HLS) for algorithmic acceleration
- Building embedded SoC architectures (CPU + accelerators + peripherals)
- Debugging timing violations, clock-domain-crossing bugs, or simulation/hardware mismatches
- Interfacing external memories (DDR/SDRAM), sensors, displays, or serial protocols (UART, SPI, I2C)

## FPGA Fabric Primer

An FPGA is a grid of reconfigurable logic, not a fixed ASIC:

- **LUTs (Look-Up Tables)** implement arbitrary combinational functions of a few inputs.
- **CLBs / Logic Slices** group LUTs with flip-flops and carry chains for arithmetic.
- **BRAM (Block RAM)** provides dedicated on-chip memory — use for FIFOs, buffers, lookup tables.
- **DSP slices** provide hardened multiply-accumulate units — infer them instead of building MACs from LUTs.
- **Clock networks / PLLs / MMCMs** generate and distribute derived clocks; never gate a clock with combinational logic (use clock enables instead).

Design decisions should map intent to fabric resources explicitly: a hand-written
multiplier that doesn't infer a DSP slice silently burns hundreds of LUTs.

## HDL Languages

### VHDL (VHSIC Hardware Description Language)

Strongly typed, verbose, suitable for large team projects and formal verification.

```vhdl
architecture rtl of counter is
  signal count : unsigned(7 downto 0) := (others => '0');
begin
  process(clk)
  begin
    if rising_edge(clk) then
      if reset = '1' then
        count <= (others => '0');
      elsif enable = '1' then
        count <= count + 1;
      end if;
    end if;
  end process;
end architecture;
```

### Verilog / SystemVerilog

Concise C-like syntax; SystemVerilog adds classes, interfaces, assertions, and coverage.

```systemverilog
module counter #(parameter WIDTH = 8) (
  input  logic clk, reset, enable,
  output logic [WIDTH-1:0] count
);
  always_ff @(posedge clk) begin
    if (reset)      count <= '0;
    else if (enable) count <= count + 1'b1;
  end
endmodule
```

**Recommendation:** SystemVerilog for new projects (better typing, `always_ff`/`always_comb`
disambiguate intent); VHDL for legacy codebases, safety-critical flows, or teams with strong
formal-verification requirements. Mixed-language projects are common — most synthesis tools
accept both in the same project.

### Coding rules that prevent synthesis surprises

- One clock edge per `always_ff`/process — never mix `posedge`/`negedge` of different signals.
- Non-blocking (`<=`) in sequential blocks, blocking (`=`) in combinational blocks — mixing
  them causes simulation/synthesis mismatches.
- Avoid latches: every branch of a combinational block must assign every output, including
  a default `else` — an unintentional latch is the most common first-time RTL bug.
- Pick synchronous or asynchronous reset per clock domain and stay consistent.

## Design Flow

```
RTL Code (Verilog/VHDL/SystemVerilog)
        │
Synthesis — translate RTL into a gate-level netlist, map to fabric primitives
        │
Place & Route (P&R) — arrange logic on die, route signals between elements
        │
Timing Analysis (STA) — verify setup/hold constraints are met
        │
Bitstream Generation — package the configuration for FPGA load
```

- **Use registered outputs** on module boundaries — improves timing margins and predictability.
- **Constrain clock domains** — mark unrelated clocks as asynchronous groups so the timing
  tool doesn't analyze false paths between them.
- **Iterate, don't guess**: read the post-synthesis and post-P&R timing/utilization reports
  before touching RTL again; most closure problems are visible in the critical-path report.

## Timing & Constraints

Constraints (SDC-style, or vendor XDC/QSF equivalents) tell the tool what "correct timing"
means — without them, the tool assumes an unconstrained, unrealistic design.

```tcl
# Vendor-neutral SDC-style constraints
create_clock -name sys_clk -period 10.000 [get_ports clk]      ;# 100 MHz
set_input_delay  -clock sys_clk 2.0 [get_ports data_in]
set_output_delay -clock sys_clk 2.0 [get_ports data_out]
set_clock_groups -asynchronous -group sys_clk -group ext_clk
set_false_path -from [get_ports reset_async]
```

### Timing Closure Checklist

- [ ] Every clock domain has an explicit `create_clock` (or equivalent) constraint.
- [ ] Input/output delays declared for every I/O interface with external timing requirements.
- [ ] Asynchronous clock domains grouped to suppress false paths.
- [ ] Critical paths reviewed in the post-P&R timing report, not just the pass/fail summary.
- [ ] P&R effort raised (or floorplanning applied) if timing fails after the first pass.

### Common Timing Pitfalls

- **Missing constraints** → tool assumes unrealistic timing, bitstream loads but design misbehaves.
- **Clock domain crossings (CDC) unsynchronized** → metastability, intermittent data corruption
  that is nearly impossible to reproduce in simulation.
- **Combinational datapaths too long** → fails setup timing; break with pipeline registers.
- **False paths left unconstrained** → tool wastes P&R effort trying to close timing on paths
  that never matter functionally (e.g. quasi-static configuration registers).
- **Multicycle paths treated as single-cycle** → tool over-constrains and may report false failures.

### Clock-Domain Crossing (CDC) Patterns

- **Single-bit control**: two-flop synchronizer in the destination domain.
- **Multi-bit data**: Gray-code pointers or a full asynchronous FIFO with independent
  read/write clocks — never sample a multi-bit bus directly across domains.
- **Handshake (req/ack)** for infrequent multi-bit transfers where a FIFO is overkill.
- Run CDC-aware static verification if available; simulation alone rarely catches
  metastability since RTL simulators model registers as ideal.

## Simulation & Testbenches

### Testbench Structure (SystemVerilog)

```systemverilog
module tb_counter;
  logic clk = 0, reset, enable;
  logic [7:0] count;

  counter dut (.clk, .reset, .enable, .count);

  always #5 clk = ~clk;  // 10 ns period → 100 MHz

  initial begin
    reset = 1; enable = 0;
    #20 reset = 0;
    #10 enable = 1;
    repeat (256) @(posedge clk);
    assert (count == 8'd0) else $error("counter did not wrap at 256: count=%0d", count);
    $finish;
  end
endmodule
```

**Best practices:**

- Use `assert`/`assume` to check invariants inline; add functional coverage (`covergroup`)
  to confirm corner cases were actually exercised, not just "the test ran without errors".
- Cover nominal, boundary (overflow/underflow/wraparound), and error-injection cases.
- Prefer self-checking testbenches (assertions, scoreboards) over "eyeball the waveform" —
  waveform inspection does not scale and does not run in CI.
- Separate the testbench (clock/reset generation, stimulus, checking) from the DUT
  instantiation so the same bench can target multiple variants or a gate-level netlist.
- Gate-level (post-synthesis) simulation with SDF back-annotation catches timing bugs
  RTL simulation cannot see — run it before first hardware bring-up on new boards.

## IP Core Integration

Vendor IP catalogs (memory controllers, Ethernet MACs, PCIe endpoints, DSP cores) trade
implementation effort for licensing and portability constraints.

1. Generate the IP core from the vendor GUI or a scripted flow, targeting the exact
   part number and speed grade in use.
2. Export the generated wrapper/netlist and instantiate it in the top-level design,
   connecting via a standard bus (AXI, AHB, Avalon, or a vendor-specific interface).
3. Run P&R; the tool places and routes the IP core's internals alongside custom RTL.
4. Re-verify timing after every IP core regeneration — a version bump can change internal
   pipelining and shift the critical path.

**Caution:** IP core licensing terms, version compatibility across tool releases, and bus
protocol parameter mismatches (e.g. AXI data width, burst length) are common integration
friction points. Pin the exact IP core version alongside the tool version in project docs.

## High-Level Synthesis (HLS)

Convert C/C++ (or, increasingly, a subset of Python) algorithms into RTL without hand-coding
Verilog/VHDL — trades some control over the implementation for development speed.

```c
// C algorithm
void matmul(int A[N][N], int B[N][N], int C[N][N]) {
  for (int i = 0; i < N; i++)
    for (int j = 0; j < N; j++) {
      C[i][j] = 0;
      for (int k = 0; k < N; k++)
        C[i][j] += A[i][k] * B[k][j];
    }
}
```

With HLS pragmas/directives guiding the scheduler:

```c
#pragma HLS pipeline II=1              // 1 new result per cycle (initiation interval)
#pragma HLS unroll factor=4            // parallel loop iterations
#pragma HLS array_partition variable=A cyclic factor=4  // parallel memory access
```

**Trade-off:** rapid prototyping and easier design-space exploration vs. reduced control
over parallelism, memory layout, and pipelining compared to hand-written RTL. Always inspect
the HLS-generated resource and latency report — the same C code can synthesize to wildly
different hardware depending on pragma choices, and the "obvious" pragma is not always the
one that meets the target clock.

## SoC Architecture

### Typical SoC Components

- **CPU** (ARM Cortex-A/M, RISC-V, custom soft core) running an embedded OS or bare-metal code.
- **Memory hierarchy** — L1/L2 cache, external DDR/SDRAM controller, on-chip BRAM scratchpad.
- **Accelerators** — DSP blocks, custom datapaths for FFT, image processing, neural network inference.
- **Interconnect** — AXI, AHB, or Avalon bus matrix routing master/slave transactions.
- **Peripherals** — UART, SPI, I2C, Ethernet, GPIO, display/video output.

### Integration Checkpoints

- [ ] CPU boots and executes a minimal test program (bare-metal or OS) before adding accelerators.
- [ ] Accelerator is accessible via memory-mapped I/O or a bus transaction, verified in isolation.
- [ ] Data transfers between CPU and accelerator verified with known test vectors, not live sensor data.
- [ ] Interrupt handling tested (accelerator signals CPU on completion, CPU services it correctly).
- [ ] Reset sequencing across CPU, accelerators, and peripherals is deterministic (no race on power-up).

## Common Pitfalls & Mitigations

| Issue | Mitigation |
| --- | --- |
| **Setup/hold violations** | Add pipeline stages; relax clock period if the design allows; optimize floorplanning/placement. |
| **CDC data corruption** | Use two-flop synchronizers for single bits, Gray-code or async FIFOs for buses; never sample multi-bit data directly across clock domains. |
| **Unintended latches** | Ensure every combinational branch assigns every output, including default/else cases. |
| **Memory throughput bottleneck** | Use burst transfers; prefetch; verify cache coherency in SoC designs with multiple memory masters. |
| **Simulation diverges from hardware** | Run timing-aware (gate-level, SDF-annotated) simulation; check for undefined/uninitialized states (`X` propagation). |
| **IP core version mismatch** | Pin tool and IP versions together; document the compatibility matrix in the repo. |
| **Synthesis optimizes away intended logic** | Use `keep`/`(* dont_touch *)` (or vendor-equivalent) attributes on signals the tool must not remove. |
| **Multiplier/adder doesn't infer a DSP slice** | Check the synthesis resource report; rewrite the expression or add an inference pragma if it maps to LUTs instead. |

## Production Readiness

- [ ] Timing closure verified post-P&R with margin (not "just barely passing").
- [ ] Comprehensive testbench covers nominal, corner, and error-injection conditions, with
      assertions and coverage, not manual waveform review.
- [ ] Bitstream reproducibly generated (pinned tool versions, locked constraint files).
- [ ] Clock domain crossings reviewed and, if the toolchain supports it, formally verified.
- [ ] Power and thermal budgets confirmed against the target board's specification.
- [ ] Fallback/recovery mechanism defined for field updates on reconfigurable devices
      (golden bitstream, watchdog-triggered reload).
