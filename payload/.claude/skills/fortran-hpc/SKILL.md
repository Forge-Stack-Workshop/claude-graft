---
name: fortran-hpc
description: High-performance computing in Fortran — parallel arrays, coarrays with images and synchronization, teams/events/collectives, C interoperability via iso_c_binding, numerical scientific computing, finite-difference methods, modules, and performance optimization for weather prediction, molecular dynamics, and partial differential equation solvers.
origin: "Modern Fortran: Building Efficient Parallel Applications (Curcic, Manning)"
---

# Fortran HPC & Parallel Programming

Modern Fortran excels at numerical simulation and distributed-memory parallelism. Use when solving nonembarrassingly parallel problems (weather, fluid dynamics, molecular simulation) where communication and synchronization overhead is critical, or when maintaining/extending legacy scientific codebases.

## Prerequisites (preflight)

```bash
command -v gfortran || echo "WARN: install gfortran"
```

## When to Activate

- **Parallel array computing**: distributing large multidimensional arrays across processor images for simulation or analysis
- **Finite-difference solvers**: implementing stencil operations on grids with ghost-cell exchanges between processors
- **C library integration**: calling C libraries from Fortran (or vice versa) via `iso_c_binding` for legacy code, performance libraries (BLAS, LAPACK)
- **Numerical stability**: when you need IEEE floating-point semantics, portable type kinds (`real64`, `int32`), and deterministic results across platforms
- **Distributed-memory HPC**: using coarrays instead of MPI for cleaner, more expressive parallel syntax on supercomputers
- **Modularizing legacy code**: splitting monolithic programs into modules with explicit interfaces and access control
- **Performance tuning**: vectorization hints (`do concurrent`), memory layout, and compiler optimization flags

## Fortran vs. Other HPC Approaches

| Concern | Fortran approach | Notes |
|---|---|---|
| Shared-memory parallelism | OpenMP directives | No external library; limited to a single node |
| Distributed-memory parallelism (legacy) | MPI (Message Passing Interface) | Portable, works across SM/DM systems, but verbose (explicit send/recv) |
| Distributed-memory parallelism (modern) | Coarrays (Fortran 2008+) | Intrinsic to the language, no library dependency, cleaner syntax, performance rivals MPI |
| Vectorization hint | `do concurrent` | Promise to the compiler that iterations are independent — not a guarantee of parallel execution |

Choose coarrays over MPI when the compiler supports them (gfortran 5+, ifort, Cray) for new distributed-memory code; keep MPI for interoperability with existing MPI-based codebases or libraries.

## Modules: Structuring Code

Modules are the unit of encapsulation: they group related derived types, procedures, and parameters, and control what's visible outside.

```fortran
module gaussian_mod
  implicit none
  private                      ! nothing exported by default
  public :: set_gaussian        ! explicit allow-list

  real, parameter :: pi = 3.14159265
contains
  subroutine set_gaussian(x, y, sigma)
    real, intent(in)  :: x(:), sigma
    real, intent(out) :: y(:)
    y = exp(-x**2 / (2 * sigma**2))
  end subroutine set_gaussian
end module gaussian_mod
```

```fortran
program main
  use gaussian_mod, only: set_gaussian   ! import only what's needed
  implicit none
  ...
end program main
```

**Rules of thumb:**
- Always `private` by default, then `public` the minimal API surface.
- `use module, only: name` avoids namespace pollution and documents dependencies.
- Compiling a module generates a `.mod` file consumed by dependents — build order matters (compile modules before their users).
- One module per file, named after the module, mirrors the "one class per file" convention from other languages.

## Core Techniques

### Array Management

**Static vs allocatable arrays:**

```fortran
! Static array — size known at compile time, efficient stack/constant allocation
real :: h(grid_size)

! Allocatable array — size determined at runtime, flexible for unknown datasets
real, allocatable :: h(:)
allocate(h(n))
deallocate(h)
```

Static arrays generate more efficient machine code when size is known; allocatable arrays allow flexibility for data-driven sizing (e.g., CSV file rows). Check allocation status with `allocated(h)` before use.

**Array constructors** initialize on-the-fly:
```fortran
integer :: symbols(10) = ['AAPL', 'AMZN', 'CRAY', 'CSCO', 'HPQ ', &
                           'IBM ', 'INTC', 'MSFT', 'NVDA', 'ORCL']
```

Prefer rank-independent slicing (`h(:)`, `h(:,:)`) over hardcoded bounds for generic code.

### Vectorization with `do concurrent`

`do concurrent` tells the compiler that loop iterations have no dependencies and can be executed out of order or in parallel (SIMD/threading), without any explicit coarray/MPI communication:

```fortran
do concurrent (i = 1:grid_size)
  h_new(i) = h(i) - dt / dx * (u(i+1) - u(i))
end do
```

It is a *promise*, not a guarantee: a compiler may still choose serial execution if it estimates that's faster, or if it cannot prove independence. Use it to mark embarrassingly parallel sections before reaching for coarrays or OpenMP.

### Coarrays: Parallel Images & Synchronization

Fortran coarrays (intrinsic parallelism, no MPI/OpenMP library) distribute data across **images** (independent processes):

```fortran
! Declare a coarray — [*] means "one segment per image"
real, allocatable :: data(:)[*]
allocate(data(local_size)[*])

! Send data to image j; receive from image i
data(:)[j] = local_result(:)
data_received = data(:)[i]

! Synchronization — all images wait here (collective barrier)
sync all

! Conditional sync — image i waits for i+1 and i-1 to finish
sync images(i-1, i+1)
```

**Key patterns:**
- **Ghost cells**: each image allocates halo rows for neighbor data exchange (stencil operations).
- **Distributed reduction**: compute local minimums, then gather/reduce globally via `sync all` + `co_min()` (collective).
- **Neighbor communication**: `sync images(neighbor_list)` replaces `MPI_Isend`/`MPI_Irecv`.

### Teams, Events, and Collectives

Advanced coarray features (Fortran 2018) go beyond basic image-to-image sync:

```fortran
! Partition images into teams for independent subtask execution
form team (team_number, my_team)
change team (my_team)
  ! code here runs within the sub-team's image numbering
end team

! Event: lightweight, asynchronous one-way signal between images
event post (finished[destination_image])
event wait (finished)          ! block until posted (optionally count=N)

! Collectives: reduce/broadcast across all images without manual accumulation
call co_sum(local_value, result)
call co_max(local_value, result)
call co_min(local_value, result)
call co_broadcast(value, source_image=1)
```

Use **teams** to decompose a large image set into independent working groups (e.g., one team per simulation ensemble member). Use **events** for producer/consumer signaling that doesn't need a full barrier. Use **collectives** (`co_sum`, `co_max`, `co_min`, `co_broadcast`, `co_reduce`) instead of hand-rolled loops over images — they map to efficient reduction trees on the runtime.

### C Interoperability (iso_c_binding)

Link Fortran to C libraries or embed C functions:

```fortran
use iso_c_binding

! Declare C types and bind to function
interface
  subroutine c_function(ptr, size) bind(c, name="c_function")
    use iso_c_binding
    type(c_ptr), value :: ptr
    integer(c_int), value :: size
  end subroutine
end interface

! Call C from Fortran
real(c_double), allocatable :: array(:)
allocate(array(1000))
call c_function(c_loc(array(1)), int(size(array), c_int))
```

**Portable type matching:**
- Fortran `real(c_double)` ↔ C `double`
- Fortran `integer(c_int)` ↔ C `int`
- Fortran `character(c_char)` ↔ C `char`

Use `c_loc()` to get a C pointer to Fortran data; use `c_f_pointer()` in the reverse direction. Avoid `allocatable` arrays when passing to C — use `contiguous, target` pointer instead.

### Derived Types: Abstract Data

Group related data (and, optionally, bound procedures) into a single unit, similar to a struct/class:

```fortran
type :: grid_t
  real, allocatable :: h(:)
  real :: dx = 1.0            ! default value
contains
  procedure :: total_mass      ! type-bound procedure
end type grid_t

type(grid_t) :: grid
grid = grid_t(h=[1.0, 2.0, 3.0], dx=0.5)   ! positional/keyword constructor
```

Bind procedures to the type (`procedure :: name`) to keep behavior next to data — the closest Fortran equivalent to a method. Use keyword arguments in constructors for readability over long positional lists.

### Numerical Computing Patterns

**Portable data types** ensure reproducibility across platforms:

```fortran
use iso_fortran_env
integer, parameter :: real_kind = selected_real_kind(15, 307)
! equivalent to real(kind=real_kind), portable 64-bit float

real(real_kind) :: x, y, z
```

**Finite-difference stencil** on distributed 2-D grid:

```fortran
! Each image holds a portion; exchanges ghost cells with neighbors
do i = 2, nx-1
  do j = 2, ny-1
    u_new(i,j) = 0.25 * (u(i+1,j)[*] + u(i-1,j)[*] + u(i,j+1)[*] + u(i,j-1)[*])
  end do
end do
sync all  ! Wait for all boundary exchanges
```

Minimize communication/computation ratio; batch updates and defer `sync` until necessary.

## Performance Optimization

- **Compile with optimization flags**: `-O2`/`-O3`, plus architecture flags (`-march=native`) to enable vectorization/SIMD.
- **Prefer `do concurrent`** over manual loop unrolling — let the compiler vectorize once dependencies are provably absent.
- **Minimize coarray communication**: batch multiple values per `sync`/collective call rather than syncing per element.
- **Contiguous memory access**: iterate arrays in column-major (leftmost index fastest) order to match Fortran's storage layout and maximize cache locality.
- **Avoid unnecessary allocation in hot loops**: allocate once outside the loop, reuse buffers.
- **Static arrays for known, small, fixed sizes**: skip heap allocation overhead entirely.
- **Profile before optimizing**: use compiler profiling flags or external tools (gprof, Intel VTune) — Fortran's array-oriented syntax often already compiles to efficient code without manual tuning.

## Common Pitfalls

- **Double-allocation**: calling `allocate()` on an already-allocated array crashes. Check `allocated()` first or use `deallocate()`.
- **Array bounds mismatch**: passing a sliced array `a(1:10)` to a function expecting size 10 requires explicit size argument or assumed-shape `(:)` dummy.
- **Ghost-cell deadlock**: forgetting `sync all` after a coarray write leaves images waiting forever for data that never arrives.
- **Event without matching post/wait**: `event wait` blocks indefinitely if no image ever calls the matching `event post`.
- **C pointer lifetime**: never return a `c_ptr` to a Fortran local array — the memory is freed on function exit.
- **Allocatable in C interop**: C cannot manage Fortran's allocatable semantics; use explicit pointers + `c_loc()` instead.
- **`do concurrent` false promise**: marking a loop `do concurrent` when iterations actually depend on each other (e.g., in-place stencil update without a separate output array) produces silently wrong results — the compiler trusts the programmer's claim.
- **Missing `implicit none`**: without it, undeclared variables default to implicit typing by first letter, hiding typos as silent bugs.
- **Module build order**: forgetting that a `.mod` file must be compiled before dependents that `use` it breaks the build with a cryptic "module not found" error.

## References

Curcic, M. *Modern Fortran: Building Efficient Parallel Applications*. Manning Publications. Covers modules, derived types, coarrays, teams/events/collectives, C interoperability, and performance optimization for scientific/HPC codebases.
