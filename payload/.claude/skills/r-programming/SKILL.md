---
name: r-programming
description: Vector-based statistical computing, functional programming with apply family, matrix operations, data frame manipulation, type coercion, performance optimization through vectorization, and R's approach to scalars, subsetting, and scope management.
origin: The Art of R Programming, Norman Matloff
---

# R Programming

Data analysis and statistical computing through R's functional, vector-oriented paradigm.

## Prerequisites (preflight)

```bash
command -v Rscript || echo "WARN: install R"
```

## Use this skill when

- Writing or reviewing R code that manipulates vectors, matrices, lists, or data frames
- Applying functions across matrix rows/columns or list elements (apply family)
- Subsetting and filtering data frames or matrices with logical indexing
- Building statistical summaries, distributions, or simple regressions
- Producing base-R graphics (plots, histograms, bar/box plots)
- Optimizing R code for performance (vectorization, memory allocation, profiling)
- Managing scope, default arguments, closures, and functional-programming patterns

## Core Paradigm: Everything Is a Vector

**Scalars don't exist in R** — a single number is a one-element vector. Matrices are
vectors with a `dim` attribute; data frames are lists of equal-length vectors. This
uniformity is what makes vectorization possible.

- Element-wise arithmetic: `x + c(5,0,-1)` applies `+` pairwise.
- **Recycling** — the shorter operand is silently repeated to match the longer one's
  length: `c(1,2,3,4) + c(1,2)` → `c(2,4,4,8)`. Recycling with a non-multiple length
  produces a warning, not an error — a common silent-bug source.
- **Vectorization** — most built-in functions (`sqrt()`, `round()`, `+`, comparisons)
  apply element-wise automatically; write your own functions the same way whenever
  possible instead of looping.

**Never use a loop when a vectorized operation exists.** Loops in R are interpreted
and substantially slower than the vectorized alternative, and idiomatic R strongly
prefers vector expressions over explicit iteration.

```r
x <- c(1,2,3,4,5)
x[x > 2]                 # filtering: Boolean vector as index
x[x > 2 & x < 5]         # combine conditions with &, never &&, in subsetting
which(x > 2)             # indices where the condition holds, not the values
ifelse(x %% 2 == 0, "even", "odd")   # vectorized conditional, avoids sapply(x, function(...))
```

## Vectors, Subsetting, Matrices

```r
x <- c(1,2,3,4,5)
x[2]          # single element (1-based indexing)
x[c(1,3)]     # elements 1 and 3 (duplicates allowed, order preserved)
x[-1]         # all but the first element (negative index = exclusion)
x[c(-1,-2)]   # all but the first two

length(x) <- 3            # truncates/extends in place, new slots become NA
x[6] <- 10                 # extends the vector, gaps filled with NA
```

For matrices, use `matrix[rows, cols]`:

```r
m <- matrix(1:6, nrow=2, ncol=3)   # stored in column-major order internally
m[1,]          # first row — returns a vector, dimension is dropped
m[,2]          # second column — also drops to a vector
m[1,,drop=FALSE]   # keep it a 1-row matrix instead of dropping to a vector
t(m)           # transpose
m %*% t(m)     # matrix multiplication (never use `*`, which is element-wise)
solve(a)       # matrix inverse; solve(a,b) solves a %*% x = b
```

**Avoid negative indices with matrices used alongside logical/positive indices** —
mixing index types produces confusing results; stick to one indexing style per call.
**Unintended dimension reduction** is the most common matrix bug: subsetting a
matrix down to one row/column silently becomes a plain vector unless you pass
`drop=FALSE`.

## The Apply Family

The `apply()` family eliminates explicit loops over data structures and is the
idiomatic replacement for "for each row/column/element, do X":

| Function | Applies `f` to | Returns |
| --- | --- | --- |
| `apply(m, dimcode, f)` | matrix rows (`dimcode=1`) or columns (`dimcode=2`) | vector, matrix, or list depending on `f`'s output |
| `lapply(x, f)` | each element of a list (or vector) | a list, always |
| `sapply(x, f)` | each element, like `lapply()` | simplified to a vector/matrix when possible |
| `vapply(x, f, FUN.VALUE)` | each element | same as `sapply`, but with an explicit, checked return type — safer in production code |
| `tapply(x, group, f)` | subsets of `x` grouped by a factor | a vector/array indexed by group levels |
| `mapply(f, x, y, ...)` | `f` element-wise across multiple parallel vectors/lists | vector or list |

```r
m <- matrix(1:6, nrow=2)
apply(m, 1, sum)                # row sums
apply(m, 2, function(col) col / sum(col))   # column-normalize

lapply(list(1:3, 4:6), sum)     # list(6, 15)
sapply(list(1:3, 4:6), sum)     # c(6, 15) — simplified
vapply(list(1:3, 4:6), sum, numeric(1))     # same, with an enforced scalar-double contract

scores <- c(85, 92, 78, 88)
group  <- factor(c("A","B","A","B"))
tapply(scores, group, mean)     # mean score per group

mapply(function(a, b) a + b, 1:3, 4:6)      # c(5,7,9)
```

**Result shape** — if `f` returns k-element vectors, `apply()`/`sapply()` stacks them
as k **rows**, not columns; transpose (`t()`) if you expected columns.

Apply-family calls are not automatically faster than an equivalent `for` loop — the
real win is that the operation inside is usually vectorized. Prefer them anyway for
clarity, but do not assume `sapply()` alone fixes a performance problem; check what
`f` itself does.

## Preallocate — the #1 Loop Anti-Pattern

```r
# WRONG — grows the vector one element at a time; each c() call reallocates
# and copies the whole vector, turning an O(n) task into O(n^2)
runs <- c()
for (i in 1:n) runs <- c(runs, i)

# CORRECT — allocate the final size once, fill by index
runs <- vector(length=n)
for (i in 1:n) runs[i] <- i

# BETTER — no loop at all when a vectorized form exists
runs <- 1:n
```

**Use `cumsum()`/`cumprod()` for running totals** instead of `sum()` inside a loop —
this replaces O(n·k) work with a single O(n) vectorized pass.

## Functional Programming and Scope

Functions create **local variables** invisible outside their body. Global variables
are readable from inside a function but writable only via the superassignment
operator `<<-`:

```r
counter <- 0
increment <- function() counter <<- counter + 1   # modifies the enclosing/global counter
```

**Formal parameters are local** — changes inside the function never affect the
caller's actual argument (R is call-by-value/copy-on-modify, not by reference).

```r
h <- function(x, y=2, z=TRUE) {
  if (z) x + y else x - y
}
h(5)          # uses defaults: y=2, z=TRUE -> 7
h(5, z=FALSE) # named args can be given in any order -> 3
```

Functions are first-class objects: assign them to variables, pass them as arguments
(as `apply()` does), and return them from other functions (closures). A closure
captures its defining environment, which is how `<<-` inside a factory function can
maintain private, persistent state across calls.

## Data Structures

- **Vectors** — same-mode elements, the atomic building block; indexing starts at 1.
- **Matrices/arrays** — vectors with a `dim` attribute; single mode, column-major storage.
- **Lists** — heterogeneous, recursive; `[[ ]]` extracts an element itself, `[ ]`
  extracts a sub-list. `unlist()` flattens a list to an atomic vector when modes allow.
- **Data frames** — a list of equal-length vectors (rows × columns, like a
  spreadsheet); each column can have its own mode, unlike a matrix.
- **Factors** — a vector plus a record of its distinct values (`levels`); the
  representation behind categorical/grouped data and `tapply()`/`table()` grouping.

```r
df <- data.frame(name=c("Jack","Jill"), score=c(85,92), stringsAsFactors=FALSE)
df$score              # column access by name
df[df$score > 88, ]   # row filter, logical indexing — keep all columns
df[, c("name")]        # column selection by name
subset(df, score > 88, select=name)   # equivalent, more readable for scripts

nrow(df); ncol(df); str(df)   # structure inspection — always check after read.table()
merge(df1, df2, by="id")       # SQL-style join on a shared key
aggregate(score ~ name, data=df, FUN=mean)   # group-and-summarize, formula interface
```

## Missing Data and Special Values

- **`NULL`** — absence of a value (empty/undefined); a zero-length object.
- **`NA`** — missing data within an otherwise valid value (statistical uncertainty).
- **`NaN`** — not a number, e.g. `0/0`; **`Inf`/`-Inf`** — arithmetic overflow.

```r
mean(x, na.rm=TRUE)     # skip NAs in the computation
sum(is.na(df$score))    # count missing values per column
complete.cases(df)      # rows with no NA in any column
```

Most statistical functions accept `na.rm=TRUE` to skip `NA`s; without it, a single
`NA` silently propagates and turns the whole result into `NA`.

## Basic Statistics and Simple Modeling

```r
mean(x); median(x); sd(x); var(x); summary(x)   # descriptive stats
quantile(x, probs=c(0.25, 0.75))
cor(df$x, df$y)                                  # correlation
table(df$category)                               # frequency counts over a factor
prop.table(table(df$category))                   # proportions instead of counts

model <- lm(y ~ x1 + x2, data=df)   # linear regression, formula interface
summary(model)                       # coefficients, R², p-values
predict(model, newdata=df_new)
```

`lm()` returns an S3 object; `print()`, `summary()`, and `plot()` on it dispatch to
methods specialized for regression output — this polymorphism is pervasive across R.

## Base Graphics

```r
plot(df$x, df$y, xlab="x", ylab="y", main="Title")   # scatter, the base workhorse
lines(x, y)              # add a line to the current plot
abline(model)             # overlay a fitted regression line
points(x, y, pch=16)       # add points with a chosen character
legend("topright", legend=c("A","B"), col=c("red","blue"), pch=16)

hist(x, breaks=20)
boxplot(score ~ name, data=df)
barplot(table(df$category))
```

`plot()` is generic — calling it on an `lm` object, a data frame, or a time series
each triggers a different method; this is the same S3 dispatch mechanism used by
`print()` and `summary()`.

## Performance and Memory

- Profile before optimizing: `system.time(expr)` for a quick timing, `Rprof()` +
  `summaryRprof()` to find hot functions in larger code.
- Vectorize first — it is almost always the biggest win, larger than any
  micro-optimization inside a loop.
- Preallocate vectors/lists (`vector(length=n)`) instead of growing them in a loop.
- R copies on modify: reassigning part of a large object (`x[1] <- 0`) can trigger a
  full copy. Avoid repeated in-place mutation of large objects inside tight loops.
- Use `matrix`/vectorized linear algebra (`%*%`, `colSums()`, `rowMeans()`) instead of
  nested loops over indices — these call optimized C/BLAS internals.
- For genuinely CPU-bound inner loops that resist vectorization, consider `.C()`/
  `.Call()` to drop into C, or parallel R (`parallel` package) — but only after
  profiling shows the bottleneck is real, not assumed.
- R enforces a hard object-size limit of 2³¹ − 1 bytes per object, even on 64-bit
  systems — very large single vectors/matrices need chunking or specialized packages.

## Common Pitfalls

| Pitfall | Fix |
| --- | --- |
| `&&`/`||` vs. `&`/`|` | scalar for `if`/`while`; vectorized `&`/`|` for subsetting — `&&` in `x[x>2 && x<5]` silently uses only the first element |
| Unintended dimension reduction | matrix subset to one row/column becomes a plain vector; pass `drop=FALSE` |
| Growing a vector with `c()` in a loop | preallocate with `vector(length=n)`, assign by index |
| Recycling mismatches | a non-multiple-length recycling warning usually flags a real bug |
| `NA` silently propagating | pass `na.rm=TRUE` explicitly to statistical functions |
| `stringsAsFactors` version drift | set it explicitly in `data.frame()`/`read.table()` |
| Scalar equality on floats | use `all.equal()`/a tolerance, not `==` |
| Assuming `apply`/`sapply` is inherently fast | the speed comes from vectorizing `f`, not the apply call itself |

## Quick Reference

| Task | Idiom |
| --- | --- |
| Logical AND in subset | `x[x>2 & x<5]`, not `&&` |
| Column means of a matrix | `colMeans(m)` or `apply(m, 2, mean)` |
| Row/column sums | `rowSums(m)` / `colSums(m)` |
| NA-safe mean | `mean(x, na.rm=TRUE)` |
| Group-wise summary | `tapply(x, group, mean)` or `aggregate(x ~ group, data=df, FUN=mean)` |
| Avoid growing vectors | preallocate: `vector(length=n)` |
| Type-checked apply | `vapply(x, f, FUN.VALUE)` instead of `sapply()` |
| Keep matrix dimensions | `m[1,,drop=FALSE]` |
| Linear regression | `lm(y ~ x, data=df)` |
| Frequency table | `table(x)` |
