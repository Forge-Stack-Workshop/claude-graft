---
name: parsing-compilers
description: Syntactic analysis techniques, grammar design, parser construction methods (LL/LR, recursive descent, PEG), Abstract Syntax Trees (AST), lexing, and error recovery.
origin: Analyseurs syntaxiques — Leur fonctionnement par l'exemple
---

# Parsing & Compiler Construction

Transform unstructured text into structured Abstract Syntax Trees using formal grammars and deterministic parsing strategies.

## When to Activate

- Designing a domain-specific language (DSL), query language, or config format
- Building a configuration parser, template engine, or schema validator
- Analyzing source code, markup, or structured data formats
- Implementing a code generator, transpiler, or compiler frontend
- Disambiguating user input or command syntax

## Compiler Pipeline Overview

A compiler's front end has three analysis stages, each producing input for the next and each capable of raising its own class of error:

1. **Lexical analysis** (lexer/scanner) — raises **lexical errors**: illegal characters, malformed literals.
2. **Syntactic analysis** (parser) — raises **syntax errors**: token sequences that don't match the grammar.
3. **Semantic analysis** — raises **semantic errors**: type mismatches, undeclared identifiers.

Any other module failing is a compiler bug or a system error (I/O, out of memory), not a language-level error. Traditionally, diagnostics fall into four severities: *warnings* (likely runtime issue, compilation continues), *errors* (must be fixed, compilation continues to find more), *fatal errors* (compilation stops immediately), *internal errors* (compiler bug).

## Lexical Analysis (Lexing)

The lexer converts a raw character stream into a stream of **tokens** (lexemes tagged with a type: `NUMBER`, `IDENTIFIER`, `KEYWORD`, `OPERATOR`, …). It applies the "maximal munch" rule: at each position, consume the longest sequence of characters that forms a valid token.

Track line/column position per token — this is the only cheap moment to capture it, and it's what makes later error messages point at the right place. Attach it once; don't try to reconstruct position from AST nodes downstream.

```
token   = keyword | identifier | number | string | operator | punctuation
digit   = "0".."9"
letter  = "a".."z" | "A".."Z" | "_"
number  = digit+ ("." digit+)?
ident   = letter (letter | digit)*
```

Lexer and parser are tightly coupled by contract, not by implementation: token types, position tracking, and error reporting conventions must be agreed before either is built, then built together.

## Grammar Fundamentals (BNF / EBNF)

**Terminals** are concrete tokens emitted by the lexer (identifiers, numbers, keywords, punctuation). **Non-terminals** are abstract symbols that expand into sequences of terminals and non-terminals via **productions** (rewrite rules). A **grammar** is the full set of productions plus a start symbol.

BNF (Backus-Naur Form):

```
<expression> ::= <term> "+" <expression> | <term>
<term>       ::= <factor> "*" <term> | <factor>
<factor>     ::= <number> | "(" <expression> ")"
```

EBNF adds repetition (`*`, `+`), optionality (`?`), and grouping — closer to how you'd hand-write a recursive-descent parser:

```
Expression := Term (('+' | '-') Term)*
Term       := Factor (('*' | '/') Factor)*
Factor     := Number | '(' Expression ')'
```

**Left recursion** (`N := N α ...`) — a non-terminal that, through some derivation, produces a phrase starting with itself — causes infinite loops in top-down parsers. It can be direct (`N := N α`) or indirect (`A` produces something starting with `B`, which produces something starting with `A`). Rewrite left recursion as right-associative iteration, or eliminate it via standard grammar transformation, before writing a top-down parser.

**Ambiguity**: a grammar is ambiguous if some input string has more than one valid parse tree. Resolve via explicit precedence and associativity rules, or by restructuring the grammar into precedence levels (as `Expression`/`Term`/`Factor` do above).

## Two Parsing Strategies: Top-Down vs Bottom-Up

| | Top-down (LL) | Bottom-up (LR) |
|---|---|---|
| Builds tree | root → leaves | leaves → root |
| Natural fit | recursive descent, PEG | table-driven parser generators |
| Left recursion | forbidden, must eliminate | handled naturally |
| Grammar class | more restrictive | more expressive |
| Hand-coding | straightforward | error-prone — use a generator |
| Error messages | easy to make precise | harder, need custom recovery |

## Top-Down Parsing: Recursive Descent

Each non-terminal becomes a function that tries to match the current input against its productions, consuming tokens as it recognizes them and calling into other non-terminal functions for nested structure.

```python
def parse_expression():
    result = parse_term()
    while current_token in ("+", "-"):
        op = current_token
        advance()
        right = parse_term()
        result = BinaryOp(result, op, right)
    return result
```

**Naive recursive descent** tries each alternative production in order until one matches (backtracking on failure) — simple to write, but exponential in the worst case, and error reporting is weak: on failure you can only say "expected one of these tokens, got that one."

## Predictive Parsing: LL(1)

**LL(1)** parsers decide which production to apply using only **one token of lookahead** — no backtracking, no exponential blowup. "LL" = read Left to right, produce a Leftmost derivation; "(1)" = one token of lookahead.

Two lookahead sets make this decision possible:

- **FIRST(N)** — the set of terminals that can appear as the first token of any string derived from `N`.
- **FOLLOW(N)** — the set of terminals that can appear immediately after `N` in some derivation from the start symbol.

A grammar has an **LL(1) conflict** at non-terminal `N` if two alternative productions `α` and `β` of `N` have overlapping FIRST sets, or if one alternative is nullable and its FIRST set overlaps the other alternative's FOLLOW set. A grammar with no such conflict, for any non-terminal, is an **LL(1) grammar** — only these admit a genuine LL(1) parser. Most naturally written grammars are not LL(1) on the first pass; removing conflicts (left factoring, precedence restructuring) is a required step, not an edge case.

**Predictive recursive descent** is recursive descent driven by FIRST/FOLLOW sets instead of trial-and-error: each function uses a single `switch`/`case`-style dispatch on the lookahead token to pick the right production directly, no backtracking. This is strictly better than naive recursive descent whenever the grammar permits it.

A **non-recursive (table-driven) LL(1) parser** replaces the call stack with an explicit stack of grammar symbols and a 2D parsing table indexed by `(non-terminal, lookahead token)`. More mechanical and more efficient, but the tables are usually generated, not hand-built.

## Bottom-Up Parsing: LR

LR parsers shift tokens onto a stack and reduce by matching right-hand sides of productions once a full production is recognized on top of the stack. This handles left-recursive grammars naturally and accepts a strictly larger class of grammars than LL(1).

Parser tables (action/goto) are generated automatically from the grammar — variants include SLR (Simple LR), canonical LR(1), and LALR(1) (a practical compromise: nearly LR(1) power, tables the size of SLR). Parser generators (yacc, Bison, Menhir, ANTLR in LR mode) build these tables; hand-coding an LR table by hand is error-prone and rarely done.

## Parsing Expression Grammars (PEG)

PEG is a top-down formalism where alternatives (`/`, ordered choice) are tried in order and the **first match wins** — unlike context-free grammar alternation, PEG has no ambiguity by construction. This maps directly onto recursive-descent-with-backtracking implementations (e.g. `packrat` parsing).

```
Expr   <- Term (('+' / '-') Term)*
Term   <- Factor (('*' / '/') Factor)*
Factor <- Number / '(' Expr ')'
```

Trade-offs versus LL/LR:

- No grammar-conflict analysis needed — ordering resolves ambiguity implicitly, which can silently hide grammar bugs (an unreachable alternative just never fires).
- Naive backtracking is exponential; **packrat parsing** (memoize each `(rule, position)` result) makes it linear at the cost of memory.
- Left recursion is still forbidden, same as LL.
- Popular for hand-rolled parsers and libraries (PEG.js, pest, Parsimmon) because the grammar reads like the recursive-descent code it compiles to.

## Abstract Syntax Trees (AST)

The AST is the bridge between parsing and everything downstream (semantic analysis, interpretation, code generation). Each internal node corresponds to a meaningful grammar rule; leaves correspond to terminals with real semantic value (identifiers, literals).

Design rules:

- Represent only semantically significant structure — drop parentheses, redundant punctuation, and any node that exists purely for grammar disambiguation (e.g. the `Term`/`Factor` split collapses into a single `BinaryOp` node with an operator field).
- **Separate concerns**: parsing produces the tree; a distinct transformation pass simplifies/desugars it. Don't build a "clever" parser that flattens or optimizes structure while parsing — it conflates grammar recognition with tree shape and makes both harder to test.
- Keep source position (line/column) on every node that could produce a later error message (type errors, undefined references) — it's expensive to reconstruct after the fact.

```python
@dataclass
class BinaryOp:
    left: "Expr"
    op: str
    right: "Expr"
    line: int
    column: int
```

Some implementations skip a materialized AST entirely for simple grammars, evaluating directly during parsing ("syntax-directed translation"). This is fine for one-shot interpreters but blocks reuse (formatting, static analysis, multiple backends) — build the AST if the grammar or its consumers might grow.

## Error Handling and Recovery

A parser that stops at the first syntax error is only useful for the smallest inputs. Real parsers implement recovery so a single file reports every error at once:

- **Panic mode**: on error, discard tokens until a reliable synchronization point (e.g. a statement terminator or block delimiter), then resume parsing from there. Simple, robust, but can produce a cascade of spurious follow-on errors.
- **Phrase-level recovery**: attempt a local fix (insert/replace/delete a token) that lets parsing continue as if the input had been well-formed — better messages, more implementation effort, risk of a wrong "fix" masking the real problem.
- **Error productions**: add explicit grammar rules for common mistakes (e.g. missing semicolon) so the parser recognizes and reports them naturally instead of failing generically.

Whatever the recovery strategy, a syntax error should carry: the position (line/column), what was expected (ideally derived from FIRST/FOLLOW, not a hardcoded string), and what was actually found.

## Common Pitfalls

- **Left recursion in top-down grammars** — infinite recursion or infinite loop. Rewrite as right-associative iteration before writing an LL/PEG/recursive-descent parser.
- **Ambiguous grammars** — one input, multiple parse trees. Resolve via precedence/associativity or grammar restructuring, not by picking whichever the implementation happens to produce.
- **Ignoring FIRST/FOLLOW conflicts** — a grammar that "mostly works" with naive backtracking recursive descent will silently mis-parse specific inputs. Compute FIRST/FOLLOW (or run a parser generator's conflict report) before trusting an LL parser.
- **Nullable non-terminals miscomputed** — if a non-terminal can derive the empty string, FOLLOW sets must account for it correctly, or LL(1) conflict detection gives false negatives.
- **No error recovery** — parser dies on the first mistake; acceptable for a prototype, not for a tool developers will actually use.
- **Mixing grammar recognition with tree construction/optimization** — makes both the parser and the transformation harder to test in isolation. Parse first, transform second.
- **Insufficient lookahead treated as a language limitation** — LL(1) is restrictive by design. Left-factor the grammar first; only reach for LL(*), PEG, or LR if the grammar genuinely demands unbounded or ordered-choice lookahead. Profile before assuming you need a more powerful (and more complex) algorithm.
- **Hand-coding an LR table** — LR table construction is mechanical and long; use a generator (yacc, Bison, Menhir, ANTLR) rather than reproducing it by hand.
- **Losing source positions** — reconstructing line/column after parsing is expensive or impossible; attach them at the lexer/parser boundary once, not later.

## Workflow

1. **Write the grammar** in BNF or EBNF, structured into precedence levels if the language has operators.
2. **Validate the grammar**: check for left recursion, ambiguity, nullable non-terminals; compute FIRST/FOLLOW if targeting LL(1).
3. **Choose a strategy**: recursive descent / PEG for simple, hand-maintained grammars; a generated LL(1) or LR(1)/LALR parser for larger or ambiguity-prone languages.
4. **Generate or hand-code the parser** (ANTLR, ordinary yacc/Bison/Menhir for LR; hand-written recursive descent or a PEG library for top-down).
5. **Design the AST** as a separate step from the grammar — one node type per semantically meaningful construct.
6. **Add error recovery**: panic mode at minimum, phrase-level or error productions for a better developer experience.
7. **Test** on edge cases: empty input, deeply nested structures, ambiguous-looking inputs, and deliberately malformed inputs (to exercise error recovery).
8. **Optimize** only after correctness: memoization for PEG/packrat parsing, table compression for LR, if profiling shows it matters.
