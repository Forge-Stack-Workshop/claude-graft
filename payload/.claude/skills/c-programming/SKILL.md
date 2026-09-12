---
name: c-programming
description: Modern C (C11/C17/C23) programming patterns — object/type model, pointers and arrays, undefined behavior avoidance, C11 threads/atomics, and idiomatic safe-C practices.
origin: biblio
---

# C Programming

Idiomatic, modern C. Covers the object/type model, pointers, undefined
behavior (UB), and C11-era concurrency, favoring safety and clarity over
legacy K&R habits.

## Prerequisites (preflight)

```bash
command -v gcc || command -v clang || echo "WARN: install a C compiler"
```

## When to Activate

- Writing or reviewing C source (`.c`/`.h`) targeting C11, C17, or C23.
- Diagnosing crashes, memory corruption, or "works on my machine" bugs
  traceable to undefined behavior.
- Designing pointer/array-based APIs, or deciding between stack, heap, and
  variable-length array (VLA) allocation.
- Adding multithreading with `<threads.h>` or lock-free code with `<stdatomic.h>`.
- Migrating legacy C code (implicit int, K&R declarations, `gets`) to a
  modern, standards-compliant style.
- Choosing between `_Generic`, macros, and function overload emulation.

## Core Mental Model

C has two parallel worlds: **values/objects** (what memory holds) and
**expressions/types** (how the compiler interprets that memory). Most C bugs
come from confusing them — e.g. treating an array as a pointer, or assuming
a type's representation matches its mathematical value.

- An *object* is a region of storage; a *value* is its interpretation under
  a type. The same bits mean different things under different types.
- Undefined behavior (UB) is not "probably a bug" — the standard makes zero
  guarantees. Never write code whose correctness depends on how a specific
  compiler happens to render UB today.
- Prefer newer, explicit constructs (`constexpr`, `nullptr`, `_Bool`/`bool`)
  over legacy implicit ones (macros for constants, `NULL`, `int`-as-bool).

## Techniques

### 1. Modern declarations and constants

- Use `constexpr` (C23) for named constants checked at compile time instead
  of `#define` or plain `const` where the value must be a true compile-time
  constant. The initializer must fit the declared type exactly — no silent
  narrowing.
  ```c
  constexpr double pi = 3.141592653589793;
  constexpr unsigned max_retry = 5;
  ```
- Use `nullptr` (C23) instead of `NULL` or `0` for pointer values — it has
  a distinct type and cannot silently convert to an integer.
- Use `bool`/`true`/`false` from `<stdbool.h>` (or the C23 built-in `bool`)
  instead of `int` flags — states intent and blocks accidental arithmetic
  on booleans.
- Declare variables at first use, in the narrowest scope possible (e.g. the
  `for` loop's own `int i`) rather than hoisting all declarations to the
  top of a block (legacy C89 habit).

### 2. Pointers and arrays are not the same thing

- An array decays to a pointer to its first element in most expression
  contexts, but `sizeof array` still gives the true array size — never the
  pointer size. Do not assume `sizeof` on a function parameter declared
  `T arr[]` gives the array size; it decayed to `T*`.
- Use `restrict` on pointer parameters when the function guarantees no
  aliasing between them — it lets the compiler optimize aggressively, but
  is a promise you must uphold, not a checked property.
  ```c
  void axpy(size_t n, double a, double const restrict *x, double restrict *y);
  ```
- Prefer array types over raw pointers in function signatures when the
  size is known — communicates intent and enables bounds-aware tooling.
- Variable-length arrays (VLA) are a distinct category from constant-length
  arrays; since C23 they may have default-value initializers, but their
  size is a runtime value — never take a VLA's size as a compile-time
  constant, and avoid large VLAs (stack overflow risk).

### 3. Avoiding undefined behavior

- UB is a category, not a bug severity — "having UB" means the standard
  imposes *no* requirement on the program's behavior at all, not merely an
  unspecified one. Treat any UB-triggering code path as an immediate defect.
- Never rely on signed integer overflow, out-of-bounds access, use of
  uninitialized objects, or violating a `restrict` contract — even if a
  specific compiler/optimization level "seems to work."
- Enable and treat compiler warnings as errors (`-Wall -Wextra -Werror` or
  equivalent) — most UB has a detectable static signature.
- Use `_Static_assert` for compile-time invariants (type sizes, enum
  ranges) instead of runtime checks that only fire when exercised.
- Prefer sanitizers (UBSan, ASan) in CI over manual review alone — UB is
  frequently invisible in normal testing but changes under optimization.

### 4. Type-generic and dispatch patterns

- Use `_Generic` for compile-time type dispatch (e.g. a type-safe `MAX`
  macro) instead of unsafe macro tricks or `void*`-based fake generics.
  ```c
  #define max(a, b) _Generic((a), \
      int: max_int, double: max_double)(a, b)
  ```
- Use `typeof` (C23) to avoid re-stating a variable's type in generic
  macros — reduces duplication and drift when types change.
- Reach for function-like macros only when a real function cannot achieve
  the same effect (e.g. type genericity, short-circuit evaluation of
  arguments) — a macro is not a shorthand for a plain function.

### 5. Concurrency (C11 `<threads.h>` / `<stdatomic.h>`)

- Use `thrd_create`/`thrd_join` from `<threads.h>` for portable threading
  instead of platform-specific APIs (pthreads, Win32 threads) when
  portability matters more than platform-specific tuning.
- Protect shared mutable state with `mtx_t` (`mtx_lock`/`mtx_unlock`); never
  access non-atomic shared data from multiple threads without a mutex or
  an atomic type — that is itself UB (a data race).
- Use `_Atomic`-qualified types and `<stdatomic.h>` operations for lock-free
  counters/flags; do not assume a plain `int` read/write is atomic on any
  platform.
- Condition variables (`cnd_t`) pair with a mutex to wait for a state
  change — never busy-poll shared state across threads.

## Common Pitfalls

- **Implicit `int`**: omitting a return type or parameter type is not
  legal modern C — always declare explicit types.
- **`gets`, unchecked `strcpy`/`sprintf`**: unbounded writes into
  fixed-size buffers are classic UB/overflow sources — use bounded
  variants (`fgets`, `snprintf`, `strncpy` with explicit termination).
- **Signed overflow "just wrapping"**: unlike unsigned integers (which wrap
  by well-defined modular arithmetic), signed overflow is UB — never rely
  on wraparound for signed types.
- **Comparing/mixing signed and unsigned** in the same expression silently
  converts the signed value, producing surprising results near zero or at
  the type's bounds — cast explicitly and deliberately.
- **Returning a pointer to a local (automatic-storage) variable**: the
  object's lifetime ends when the function returns; the returned pointer is
  immediately dangling.
- **Assuming struct layout has no padding**: do not `memcpy`/serialize a
  struct byte-for-byte across ABI boundaries without an explicit packed
  layout or an accessor-based (de)serialization.
- **Forgetting `volatile` is not thread synchronization**: `volatile`
  affects compiler reordering/caching for a single thread (e.g. memory-mapped
  I/O); it does not provide atomicity or ordering guarantees across
  threads — use `_Atomic` and/or a mutex instead.
- **Comparing floating-point for exact equality**: representation
  precision means two mathematically equal computations can differ in
  their last bits — compare against an epsilon tolerance instead.
- **Using a VLA with unchecked runtime size**: an attacker- or
  input-controlled VLA size can exhaust the stack — validate and bound the
  size, or switch to heap allocation.

## Quick Reference

| Need | Modern approach |
|---|---|
| Named compile-time constant | `constexpr` |
| Null pointer value | `nullptr` |
| Boolean state | `bool`/`true`/`false` |
| Non-aliasing pointer optimization | `restrict` |
| Type-safe generic macro | `_Generic` + `typeof` |
| Portable thread | `<threads.h>` (`thrd_*`, `mtx_*`, `cnd_*`) |
| Lock-free shared state | `<stdatomic.h>` (`_Atomic`) |
| Compile-time invariant check | `_Static_assert` |
| Catch UB early | compiler warnings-as-errors + UBSan/ASan |
