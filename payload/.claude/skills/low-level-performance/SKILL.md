---
name: low-level-performance
description: Understand how compilers translate high-level code to machine instructions. Choose high-level constructs that generate efficient low-level code—cache-friendly access patterns, register usage, addressing modes, and minimal operation costs.
origin: Write Great Code Volume 2 - Thinking Low-Level, Writing High-Level (Randall Hyde)
---

# Low-Level Performance

Understanding compiler translation and choosing efficient high-level constructs. The
recurring theme: a high-level language (HLL) statement is not a fixed cost — the same
statement can compile to a 1-cycle register operation or a 200-cycle cache miss depending
on the surrounding code. Writing great code means picking the HLL construct that the
compiler can turn into the cheapest instruction sequence, without abandoning readability.

## When to Activate

- Analyzing why a function is slower than expected
- Choosing between equivalent high-level algorithms (e.g. nested loops vs flattened array)
- Optimizing hot paths without rewriting in assembly
- Deciding data structure layout (array dimension order, record/struct packing)
- Tuning cache locality and memory access patterns
- Choosing between arithmetic, boolean, or control-flow constructs in a hot path
- Reviewing compiler-generated machine code to validate expected efficiency
- Comparing CISC vs RISC assumptions when code must run on multiple architectures

## Core Concepts

### Compiler Translation Pipeline

High-level code becomes machine instructions through multiple stages:
1. **Parsing** — source code parsed into an abstract syntax tree (AST)
2. **Intermediate code generation** — platform-independent intermediate representation
3. **Optimization passes** — common subexpression elimination, dead code removal,
   strength reduction, register allocation
4. **Code generation** — translation to the target CPU instruction set
5. **Assembly and linking** — final binary (or intermediate assembly/object file,
   further processed by an assembler/linker)

Your choice of HLL construct directly influences which machine instructions the compiler
emits at step 4. A seemingly small difference in source code (loop order, data type,
addressing pattern, boolean expression order) can produce dramatically different machine
code efficiency, even though the HLL statement "looks" equivalent.

Compilers differ in what they emit: some produce an object file directly (fast, harder to
inspect), others emit human-readable assembly (easiest to analyze — this is what `-S` /
`objdump` gives you). When optimizing, prefer toolchains that let you inspect assembly
output directly.

### CISC vs RISC — Why "Cost per Instruction" Isn't Universal

- **CISC** (e.g. x86): fewer, denser instructions, each doing more work; instructions can
  operate directly on memory.
- **RISC** (e.g. PowerPC, ARM, MIPS): more, simpler, fixed-length instructions; almost all
  work happens in registers; memory access only through explicit load/store instructions.
- A single HLL statement (e.g. `a[i] += b[i] * c`) may become one instruction on a CISC
  target and several on a RISC target. Never port an operation-cost table from one
  architecture to another unchanged — validate on the actual target when tuning
  cross-platform hot paths.

### Memory Addressing Modes

Modern CPUs support multiple addressing modes, each with a different cost profile:

- **Register addressing** (fastest) — operand is already in a CPU register
- **Immediate addressing** — small constant encoded directly in the instruction
- **Direct/displacement addressing** — fixed memory address, good for global/static variables
- **Register indirect** — a register holds the memory address to access
- **Indexed addressing** — address = base + (index × scale), enables efficient array access
- **Scaled-indexed** — address = base + (index1 × scale) + index2, critical for
  multidimensional array access

The addressing mode a compiler generates for `array[i]` depends on declaration and access
pattern. Multiplying by an arbitrary constant is expensive; prefer power-of-2 element
sizes/dimensions so the compiler can substitute a shift instruction for a multiply.

### Array Storage and Cache Locality

Multidimensional arrays are stored in one of two orders:

- **Row-major** (C, C++, Java, Python/NumPy default): rightmost index varies fastest —
  `A[i][j]` then `A[i][j+1]` are adjacent in memory.
- **Column-major** (Fortran, MATLAB, R): leftmost index varies fastest — the opposite
  access pattern is the cache-friendly one.

Accessing memory in storage order is cache-friendly (sequential prefetch, few cache
misses); accessing against storage order is cache-hostile (each access risks a full cache
miss). **Outcome**: for row-major languages, always vary the rightmost index in the
innermost loop; for column-major languages, do the opposite.

- **Spatial locality**: accessing nearby memory locations keeps data resident in L1/L2 cache.
- **Temporal locality**: reusing recently-accessed data avoids re-fetching it.
- Random/non-sequential access patterns defeat both and cause cache misses + memory stalls.

### Data Structure Alignment and Packing

- Compilers align records/structs to word or cache-line boundaries by default, inserting
  padding automatically — struct size is not simply the sum of field sizes.
- Field order affects which fields end up sharing a cache line.
- Grouping frequently-accessed ("hot") fields together improves cache hit rate; placing
  rarely-used ("cold") fields together avoids polluting the hot cache line.
- Careless field ordering (e.g. alternating `char`/`int64`) wastes cache space on
  unavoidable padding and can silently double a struct's footprint.

### Assignment and Operation Cost

Representative relative costs (exact cycle counts vary by CPU generation — treat these as
ordering, not absolute numbers):

- **Addition/subtraction**: ~1 cycle
- **Bitwise shift by a constant**: ~1 cycle
- **Multiplication**: ~3–10 cycles (varies by CPU and operand width)
- **Division**: ~10–30+ cycles — the most expensive common arithmetic operation, avoid in
  hot loops
- **Memory access**: 1 cycle (L1 cache hit) up to 200+ cycles (cache miss / main memory)
- **Function call** (non-inlined): overhead for argument passing, stack frame setup, and
  return, on top of the callee's own work — magnified when called from a tight loop
- **Virtual/indirect call**: extra indirection through a table lookup, and defeats
  inlining and branch prediction

Compilers routinely trade an expensive operation for cheaper ones when the result is
identical: `x * 9` becomes `(x << 3) + x` (shift + add instead of multiply); this is
**strength reduction**, and it's why hand-replacing multiplies with shifts rarely helps on
a modern optimizing compiler — but it does help when the compiler *can't* prove the
transformation is safe (e.g. multiplying by a run-time, non-constant value).

### Register Allocation

CPUs have a limited set of general-purpose registers. The compiler decides which
variables live in registers versus memory (the stack) for a function's lifetime.
Variables used inside a tight loop benefit most from staying in a register across
iterations. Too many live local variables force **register spills** to the stack — each
spill turns a 1-cycle register operation into a multi-cycle memory operation. Fewer,
tightly-scoped variables in hot functions make full register residency easier to achieve.

### Boolean and Control-Flow Constructs

- Short-circuit evaluation (`&&`, `||`) skips the second operand once the first already
  determines the result — order conditions so the cheap/likely-to-short-circuit test
  comes first: `if (cache.has(key) && cache.get(key).is_valid())` skips the expensive
  validity check entirely on a cache miss.
- `switch`/`match` over a dense range of integer constants often compiles to a **jump
  table** (one indexed, indirect jump — O(1)) instead of a comparison chain (O(n)); a
  sparse or non-constant case set falls back to sequential comparisons. Prefer dense,
  contiguous case values in a hot dispatch path.
- Branchy code inside a tight loop defeats branch prediction; where the logic allows it,
  prefer a branchless form (arithmetic mask, `min`/`max`, conditional move) over an
  unpredictable `if` in the innermost loop.

## Techniques

### 1. Prefer Single-Dimensional Arrays, or Match Loop Order to Storage Order

Use 1D arrays when possible. If you must use multidimensional arrays, order loops so the
innermost loop varies the index that is contiguous in memory for your language.

**Before** (cache-hostile for row-major arrays):
```java
for (int col = 0; col < COLS; col++) {
  for (int row = 0; row < ROWS; row++) {
    process(matrix[row][col]);  // strides across rows — one cache line per element
  }
}
```

**After** (sequential access):
```java
for (int row = 0; row < ROWS; row++) {
  for (int col = 0; col < COLS; col++) {
    process(matrix[row][col]);  // sequential, cache-friendly
  }
}
```

### 2. Choose Power-of-2 Array Dimensions and Element Sizes

The compiler converts `array[i]` into `base + i * element_size`. If `element_size` (or a
dimension multiplier in a multidimensional index computation) is a power of 2, the
compiler emits a shift (1 cycle); otherwise it emits a multiply (3–10 cycles).

Declare `arr[1024][256]`, not `arr[1000][250]`, when the dimension is otherwise free to
choose.

### 3. Batch Locality-Unfriendly Operations

Operations that access memory in random order thrash the cache. If unavoidable, group
them into a separate phase instead of interleaving with cache-friendly work, so the
processor isn't repeatedly evicting the working set.

```python
# Bad: alternate between a sequential stream and random-access lookups
for i in range(n):
    sequential_array[i] += 1
    random_array[random_index(i)] -= 1

# Good: separate phases — each phase keeps a coherent working set
for i in range(n):
    sequential_array[i] += 1
for i in range(n):
    random_array[random_lookup[i]] -= 1
```

### 4. Minimize Loop Overhead

Loop control (increment, bounds check, branch) costs accumulate in tight, high-iteration
loops. Let the compiler unroll where it can (`-O2`/`-O3`, `#pragma unroll`), or unroll a
few iterations manually only after profiling shows loop overhead is the bottleneck.

Avoid division inside a hot loop; precompute `1.0 / divisor` once outside the loop and
multiply inside it.

### 5. Group Related Data by Access Frequency

Place frequently-accessed ("hot") struct/record fields adjacent to each other so they
share cache lines; push rarely-used ("cold") fields to the end.

```c
// Better: hot fields together, cold fields (rarely touched) after
struct HotData {
  int count;
  int flag;
  char *name;
  // ... rarely-used fields below, isolated from the hot cache line
  int64_t timestamp_created;
};
```

### 6. Avoid Non-Inlined Calls and Indirection in Tight Loops, Then Verify in Disassembly

Each non-inlined function call pays argument-passing and stack-frame overhead on top of
the callee's own cost; a virtual/indirect call additionally defeats inlining and branch
prediction. In a demonstrably hot loop, prefer a plain function the compiler can inline,
or hoist virtual dispatch outside the loop when the concrete type is loop-invariant.

Then confirm the fix landed: compare before/after disassembly instead of guessing.

```bash
gcc -O2 -S mycode.c    # emit an assembly listing
objdump -S a.out       # disassemble a binary, interleaved with source
```

Look for:
- Unexpected memory access where a register operation was expected (likely cache misses)
- A multiply where a shift was expected (dimension/element size isn't a power of 2)
- A larger-than-expected loop body (optimization didn't fire — check compiler flags)
- A function-call sequence inside a loop that should have been inlined
- A sequential comparison chain where a jump table was expected for a dense `switch`

## Measurement Discipline

- **Never optimize from a cost table alone** — architecture, compiler version, and
  optimization level all change real costs. Use the table above to form a hypothesis,
  then measure.
- Measure wall-clock time *and* a lower-level counter (cache misses, cycles) via
  `perf stat` (Linux), Instruments (macOS), or VTune (Intel) — wall-clock alone can't
  distinguish "fewer cache misses" from "warmed-up OS file cache."
- Compare disassembly before/after a change on the *actual* target architecture and the
  *actual* production optimization flags (`-O0` disassembly is meaningless if the shipped
  binary is `-O2`).
- Re-run each benchmark multiple times and report a distribution, not a single sample.

## Anti-Patterns

| Pattern | Cost | Fix |
|---|---|---|
| Multidimensional array with wrong loop order | 5–50× slower (cache thrashing) | Innermost loop varies the storage-contiguous index |
| Division in an inner loop | 10–30×+ slower than multiply | Precompute the reciprocal once, multiply inside the loop |
| Virtual/indirect function calls in a tight loop | 2–10× overhead per call | Devirtualize (templates, function pointers, hoist dispatch outside the loop) |
| Unbounded pointer chasing (linked structures) | Cache miss on every access | Prefetch, or restructure into a contiguous array |
| Frequent allocation/free inside a loop | Allocator/syscall overhead per iteration | Pre-allocate once; reuse via an object pool |
| Struct fields interleaved by size (`char`, `int64`, `char`, `int64`, …) | Wasted padding, doubled footprint, split cache lines | Group by size/access frequency, let the compiler pad once at the end |
| Non-power-of-2 array dimensions on a hot index path | Multiply instead of shift per access | Choose power-of-2 dimensions where the domain allows it |
| Sparse `switch`/`match` values expected to dispatch in O(1) | Falls back to sequential comparison chain | Use dense/contiguous case values, or an explicit lookup table |

## Validation Checklist

- [ ] Hot loops analyzed for cache-unfriendly access patterns (verified via disassembly
  or a cache-miss profiler, not guessed)
- [ ] Array iteration order matches the language's storage order (row-major → rightmost
  index innermost; column-major → leftmost index innermost)
- [ ] Array dimensions/element sizes are power-of-2 where the domain allows it
- [ ] No division inside a hot inner loop
- [ ] No virtual/indirect calls inside a tight loop where the concrete type is loop-invariant
- [ ] Struct/record layout groups hot fields together, isolates cold fields, and padding
  overhead has been checked (`sizeof`/equivalent)
- [ ] Boolean conditions in hot paths are ordered to short-circuit on the cheap/likely case
- [ ] Compiler-generated code reviewed on the actual target architecture and actual
  production optimization flags
- [ ] Spatial/temporal locality preserved across the full access pattern, not just a
  single loop in isolation
- [ ] Improvement confirmed by repeated measurement (time + cache/cycle counters), not by
  the cost table alone

## References

- Emit/inspect assembly output: `-S` (GCC/Clang), `/Fa` (MSVC), or a debugger's
  disassembly view
- Profile cache misses and cycles: `perf stat`/`perf record` (Linux), Instruments
  (macOS), VTune (Intel)
- When tuning cross-platform code, validate cost assumptions on every target
  architecture (CISC and RISC cost profiles diverge) rather than porting one
  architecture's numbers unchanged
