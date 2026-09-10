---
name: drupal
description: Drupal architecture and administration concepts — content modeling with nodes and fields, module system, hooks, taxonomy, and theming. Distilled from a Drupal 7 manual; explicitly flags what changed in modern (10+) Drupal.
origin: biblio
---

# Drupal

Content-management architecture built on a small set of composable primitives: **nodes** (content), **fields** (structured data attached to any entity), **modules** (functionality), **hooks** (extension points), **taxonomy** (classification), and **themes** (presentation). The concepts below are grounded in *Atelier Drupal 7* (Cyprien Roudet, Framabook, CC-BY) but are written to apply to any Drupal version — version-specific deltas are called out explicitly.

## Prerequisites (preflight)

Check that `composer` and `drush` are available:
```bash
command -v composer || echo "WARN: install composer"
command -v drush || echo "WARN: composer require drush/drush"
```

If missing, install Composer first, then install Drush via Composer.

## ⚠️ Version guard-rail

The source material documents **Drupal 7**, which reached end-of-life in January 2025. Do not deploy new work on Drupal 7.

- Target **Drupal 10 or 11** for any new project.
- Concepts that survive unchanged: nodes, fields, taxonomy, modules, hooks-as-a-pattern, themes/regions/blocks.
- Concepts that changed structurally since D7 (see "What changed since Drupal 7" below): CCK is now core Field API, procedural hooks are increasingly replaced by OOP services/plugins/events, Drush syntax, theme engine (Twig replaces PHPTemplate), configuration management (CMI) replaces DB-only config.
- If a task references `.info` files, `hook_menu()`, PHPTemplate `.tpl.php`, or Drush 5/6 syntax, translate to the modern equivalent before acting — do not copy D7 syntax into a D10+ codebase.

## When to Activate

- Modeling content types and fields for a Drupal site (blog, catalog, recipe site, etc.)
- Deciding whether functionality belongs in a custom module vs. a contributed module vs. configuration
- Writing or reviewing a custom module's hook implementations
- Designing taxonomy vocabularies for classification/filtering
- Debugging why a block, page, or field doesn't appear (permissions, module not enabled, hook not implemented)
- Explaining Drupal's extension model (hooks/plugins) to someone unfamiliar with it
- Planning a theme override (region, template, or CSS) for existing content

## Core Concepts

### Nodes — the content unit

A **node** is any piece of content: an article, a page, a recipe, a poll. Every node has a **content type** that determines which fields it carries (title, body, image, custom fields) and default behavior (promoted to front page, sticky, comments enabled, author/date display).

- One node = one content type instance. Content types are schemas; nodes are rows.
- Built-in types (`Article`, `Basic page`) are starting points, not the whole system — define custom content types for anything the site is really about (e.g. `Recipe`, `Product`).
- Node settings (default publish state, comment settings, author display) are **per content type**, applied to new nodes at creation — changing them later does not retroactively update existing nodes.

### Fields — structured data on any entity

Fields (formerly "CCK" in D6/early D7, now core **Field API**) attach typed, reusable data to any "fieldable" entity — not just nodes: users, taxonomy terms, comments can all carry fields.

- A field has a **storage type** (text, number, image, entity reference, …) and a **widget** (how it's edited) plus a **formatter** (how it's displayed) — storage is shared, widget/formatter are per-view-mode.
- Prefer fields over free-text body content whenever data needs to be queried, filtered, or displayed conditionally (e.g. a "prep time" field vs. burying it in body text).
- Fields can be reused across content types — define once, attach to multiple types, avoids duplicated schema.

### Modules — units of functionality

A module is a package of PHP (+ optional templates/config) that extends Drupal. Three tiers:

1. **Core modules** — shipped with Drupal, some enabled by default, some not (enable only what's needed).
2. **Contributed modules** — downloaded from the module ecosystem (drupal.org for D7-10; Drupal.org's project browser in D10+), reviewed for maintenance status and version compatibility before installing.
3. **Custom modules** — written for site-specific logic that no contributed module covers.

Rule of thumb: check for a well-maintained contributed module before writing custom code — most "I need X feature" problems are already solved. Only build custom when the requirement is genuinely site-specific.

Enabling a module can introduce new content types, blocks, permissions, and menu items — always review a new module's permissions page after activation, since new capabilities default to restrictive but must be explicitly granted per role.

### Hooks — the extension mechanism

Hooks are Drupal's plugin/event system: a module declares a function named `<module_name>_<hook_name>()`, and Drupal core (or another module) calls every implementation of that hook at the appropriate point.

- `hook_menu()` (D7) registers a URL path and the callback that renders it — this is how modules add pages. In D8+, this is replaced by **routing YAML + controller classes**, not a procedural hook (see version deltas below).
- `hook_block_info()` / `hook_block_view()` (D7) declare a block and render its content — in D8+, replaced by **Block plugins** (PHP classes implementing `BlockPluginInterface`).
- `hook_theme()` declares theme functions/templates a module provides, so Drupal knows how to render its output — this pattern is largely preserved through D10+ (`hook_theme()` still exists), though Twig has replaced the template engine underneath.
- The naming convention (`mymodule_hook_name`) is how Drupal *discovers* implementations — no explicit registration needed beyond that name match. This "convention over configuration" discovery pattern is the one constant across all Drupal versions.

Practical implication: when debugging "why doesn't my module's page/block appear," check (in order): is the module enabled → does the hook implementation follow the exact naming convention → does the returned array/structure match what Drupal expects for that hook → are permissions granted to the relevant role.

### Taxonomy — classification

Taxonomy organizes content via **vocabularies** (e.g. "Categories", "Tags") containing **terms** (e.g. "Dessert", "Vegetarian"). A taxonomy field on a content type lets editors tag nodes with terms from one or more vocabularies.

- Use taxonomy for cross-cutting classification (filtering, related-content, faceted search) — not for structured data that belongs in a dedicated field (a "prep time" is a field, not a taxonomy term).
- Vocabularies can be flat (tags) or hierarchical (parent/child categories) — pick hierarchy only when the domain genuinely nests (e.g. Cuisine > Regional > French), otherwise flat tags are simpler to maintain.
- Menus can be generated from taxonomy vocabularies (contributed functionality in D7 via a dedicated module; in D10+, taxonomy-driven menus are typically built via Views + menu link content, or a maintained contributed module) — don't hand-maintain a menu that duplicates a vocabulary's structure.

### Themes — presentation layer

A theme controls page layout and rendering: **regions** (named layout slots like header, sidebar, footer) into which **blocks** are placed, plus template files that render content within those regions.

- Themes are configured via the admin UI first (block placement into regions, color scheme, logo) before touching template code — most presentation needs don't require custom theming.
- Custom template files override the default rendering for a specific entity type/bundle (e.g. a node template dedicated to the `Recipe` content type) — Drupal resolves the most specific matching template name first (naming-convention-based override, same discovery philosophy as hooks).
- Building a theme from an existing HTML/CSS design means mapping static markup onto Drupal's region/block/template structure, not writing markup from scratch inside Drupal.

## What changed since Drupal 7 (apply when targeting D10/11)

| D7 concept (book) | D10/11 equivalent |
|---|---|
| CCK / core Field UI | Core Field API (unchanged conceptually, same admin UI family) |
| `hook_menu()` for pages | Routing YAML (`*.routing.yml`) + Controller class |
| `hook_block_info()` / `hook_block_view()` | Block plugin (PHP class, `@Block` annotation or attribute) |
| PHPTemplate `.tpl.php` | Twig `.html.twig` |
| DB-only site configuration | Configuration Management (CMI) — YAML config, exportable/importable, sync across environments |
| Drush 5/6 command syntax | Drush 10+ / Drupal Console command syntax |
| Overlay module (admin UX) | Removed from core; not a modern concern |

When a task or a source (like this book) shows D7 code, translate the pattern (hook discovery, region/block model, field/content-type separation) — do not port the literal syntax.

## Common Pitfalls

- Copying `hook_menu()` or `.tpl.php` examples verbatim into a modern Drupal codebase — these do not work past Drupal 7/8.
- Storing structured, queryable data as free-text in the body field instead of a dedicated field — makes filtering/sorting impossible without post-processing.
- Enabling a contributed module without checking its maintenance status/version compatibility — abandoned D7-era modules are a common source of unmaintained, insecure code.
- Forgetting that new modules and new fields default to restrictive permissions — a feature can appear "broken" when it's actually a missing permission grant.
- Hand-building a menu that duplicates a taxonomy vocabulary's structure instead of deriving the menu from the vocabulary.
- Confusing content type settings (defaults applied at node creation) with per-node overrides — editing a content type does not retroactively change existing nodes.
