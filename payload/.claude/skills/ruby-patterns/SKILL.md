---
name: ruby-patterns
description: Ruby idioms and conventions — blocks, procs, lambdas, duck typing, metaprogramming, DSLs, modules, mixins, singleton/class methods, and open classes. Writing expressive, maintainable, idiomatic Ruby code.
origin: Eloquent Ruby (Russ Olsen)
---

# Ruby Patterns

Idiomatic Ruby design and language conventions. Ruby rewards code that reads
like the language itself — favor clarity and convention over cleverness.

## Prerequisites (preflight)

```bash
command -v ruby || echo "WARN: install Ruby"
```

## When to Activate

- Writing Ruby classes, methods, or APIs
- Choosing between a block, a `Proc`, and a `lambda`
- Designing APIs around duck typing instead of class checks
- Implementing metaprogramming (`method_missing`, hooks, `define_method`)
- Using modules as mixins or namespaces
- Building an internal DSL
- Dynamically modifying or extending classes (monkey patching, singleton methods)
- Reviewing Ruby code for un-idiomatic patterns

## Core Idioms

### Write Code That Looks Like Ruby

Follow conventions the standard library already established instead of
inventing new ones — idiomatic code reads faster because readers
pattern-match against what they already know.

```ruby
def is_valid(item)                    # un-idiomatic — ported style
  if item.get_status() == "active" then return true else return false end
end

def valid?(item) = item.status == "active"   # idiomatic
```

### Smart Collections

Prefer `Enumerable` methods over hand-rolled loops: `map`, `select`, `reduce`,
`sort_by`, `group_by` express *what* the code does, not *how* it iterates.

```ruby
totals = orders.select(&:paid?).map(&:total)   # not a manual each + array push
```

### Blocks, Procs, and Lambdas

Blocks are closures. Use them for iteration, callbacks, and the
execute-around pattern (guaranteed cleanup regardless of what the block does).

```ruby
def with_file(filename)
  file = File.open(filename)
  yield file
ensure
  file.close
end
```

`Proc.new`/`&block` are lenient: wrong arity is tolerated, and a bare `return`
inside a `Proc` returns from the *enclosing method*, not just the block — a
common source of surprising control flow. `lambda` (or `->`) is stricter: it
enforces arity, and `return` only exits the lambda. Default to `lambda` when
storing a callable as an object; use a plain block when a method yields
inline, once, to its caller.

```ruby
adder = ->(a, b) { a + b }
adder.call(1, 2)   # => 3
```

### Duck Typing and Dynamic Typing

Design objects around the messages they respond to, not their class. Avoid
`is_a?`/`kind_of?` checks — they couple callers to concrete types the method
doesn't actually need. Don't fight the type system with manual type checks
and casts; let tests catch mismatches. A `NoMethodError` at the exact call
site is usually a better failure signal than a defensive check buried
upstream.

```ruby
# Idiomatic — caller only needs #each, not a specific ancestry
def print_items(collection)
  collection.each { |item| puts item }
end
```

Prefer trusting the contract over guarding it; when a guard is unavoidable,
check `respond_to?` rather than class identity.

### Symbols

Symbols are immutable, interned identifiers. Use them for hash keys, method
names passed to `send`, and fixed concepts — not for user-supplied or
unbounded strings.

```ruby
{ name: "Alice", role: :admin }
send(:calculate_total)
```

### Equality

Ruby has four equality concepts — implement the ones the domain needs, kept
consistent with each other: `==` (value equality — override this first),
`.eql?` (used by `Hash` key comparison — usually delegate to `==`), `.equal?`
(object identity — never override), and `hash` (override alongside
`==`/`eql?` so equal objects hash equally).

```ruby
class Money
  attr_reader :cents, :currency

  def initialize(cents, currency) = (@cents, @currency = cents, currency)
  def ==(other) = other.is_a?(Money) && cents == other.cents && currency == other.currency
  alias eql? ==
  def hash = [cents, currency].hash
end
```

### Singleton and Class Methods

A class method is an instance method on the class's singleton class. Use
`class << self` when defining several together.

```ruby
class Report
  class << self
    def generate(data) = new(data).render
    def default = generate([])
  end
end
```

Class instance variables (`@count` in the class body) belong to the class
object and are *not* shared with subclasses — unlike class variables
(`@@count`), shared and mutated unexpectedly across the hierarchy. Prefer
class instance variables with a class-level accessor over `@@` state.

### Metaprogramming

**`method_missing`** intercepts calls to undefined methods — legitimate for
flexible error handling, delegation, and dynamic-name APIs. Always call
`super` in the fallback branch, and always pair it with `respond_to_missing?`
— otherwise `respond_to?` and duck-typing checks silently lie.

```ruby
def method_missing(name, *args, &block)
  return dynamic_finder(name, *args) if name.to_s.start_with?("find_by_")
  super
end

def respond_to_missing?(name, include_private = false)
  name.to_s.start_with?("find_by_") || super
end
```

**Hooks** (`inherited`, `included`, `extended`) respond to class lifecycle
events — common for frameworks registering subclasses or injecting class
methods when a module is mixed in (`def self.included(base) = base.extend(ClassMethods)`).

**`define_method`** generates methods programmatically instead of writing
near-identical ones by hand: `%i[name age].each { |a| define_method(a) { instance_variable_get("@#{a}") } }`.

A class can also rewrite its own behavior at runtime, or reach into a
subclass via `inherited` to auto-configure it. Use sparingly — this trades a
little duplication for a lot of "spooky action at a distance"; reserve it for
framework code, not everyday application logic.

### Modules as Mixins and Namespaces

Define shared instance methods in a module, then `include` it in a class to
mix in behavior without inheritance. Prefer a mixin over inheritance when the
shared behavior is a capability ("can be logged", "can be compared") rather
than an is-a relationship.

```ruby
module Loggable
  def log(message) = puts("[#{Time.now.iso8601}] #{message}")
end

class Worker
  include Loggable
end
```

`Comparable` (define `<=>`, get `<`, `>`, `between?` for free) and
`Enumerable` (define `each`, get `map`, `select`, `sort_by` for free) are the
canonical examples: implement one method, inherit a whole protocol. Group
related classes under a module to avoid polluting the global namespace and to
make ownership explicit: `module Billing; class Invoice; end; end`.

### Open Classes and Monkey Patching

Ruby lets any file reopen and modify any class, including core classes. This
is dangerous at scale: two patches to the same method silently overwrite each
other, with no compiler to catch the collision. Prefer a scoped refinement
(`using StringExtensions`) or a wrapper/decorator object over patching a
built-in class globally; if a patch is unavoidable, keep it in one file, name
it after the method it adds, and comment who owns it and why.

### DSLs (Domain-Specific Languages)

Combine blocks and `instance_eval` to build an API that reads like
configuration rather than imperative code. `instance_eval` re-binds `self`
inside the block to the receiver, which is what makes DSL statements look
like top-level declarations rather than method calls on an exposed object.

```ruby
class RouteSet
  def initialize(&block) = (@routes = []).tap { instance_eval(&block) }
  def get(path, to:) = @routes << { path:, to: }
end

RouteSet.new { get "/users", to: "users#index" }
```

Keep the DSL-evaluation context small and documented — it's the entire
public surface of the DSL.

## Antipatterns

- **Bare exception catches** — never `rescue Exception` or bare `rescue`;
  catch specific classes so `SystemExit`/`Interrupt` still propagate.
- **Unchecked monkey patching** without namespacing, a comment explaining
  why, and awareness of load order.
- **Overusing `method_missing`** — prefer explicit methods; it breaks
  introspection and stack traces, and needs `respond_to_missing?` alongside it.
- **Ignoring arity** — a `Proc` where strict `lambda` checking is needed, or
  a `Proc`'s bare `return` unexpectedly escaping the enclosing method.
- **Mixing concerns in one module** — a mixin should express a single
  capability, not several.
- **Relying on global/class-variable state** — `$global` and `@@class_var`
  leak across instances and subclasses; prefer instance variables and
  dependency injection.
- **Comparing by class instead of by contract** — `obj.class == Foo` where
  `obj.respond_to?(:behavior)` would do.
- **Deep, rigid inheritance hierarchies** where a mixin or composition would
  express "can do X" more directly than "is a subtype of X".

## Conventions

- **Naming** — `PascalCase` classes/modules, `snake_case` methods/variables/
  files, `SCREAMING_SNAKE_CASE` constants.
- **Predicates** end with `?` (`empty?`, `valid?`) and return boolean-ish,
  never raise as normal behavior.
- **Bang methods** end with `!` (`sort!`, `map!`); always provide the
  non-mutating counterpart too.
- **Setters** end with `=`, called via `obj.attr = value`.
- **Visibility** — `private` for internal details, `protected` when
  subclasses or sibling instances of the same class need access (e.g.
  comparison operators reading another instance's internals).
- **Short, focused methods** — one thing per method; extract a private
  method rather than commenting mid-method about a shift in concern.
- **Specs over comments** — express behavior as executable specs
  (RSpec/Minitest), not comments that drift out of sync.
