#!/usr/bin/env python3
"""Structural check of a .claude/ setup.

    python3 .claude/tools/check-template.py [project-dir]

Catches what review misses: dead cross-references, malformed frontmatter, and
rules that are procedures wearing a rule's clothes. Exit 1 on an error, 0 when
only warnings remain.
"""
from __future__ import annotations
import sys, re
from pathlib import Path

errors: list[str] = []
warnings: list[str] = []


def frontmatter(text: str) -> tuple[str | None, str]:
    if not text.startswith("---\n"):
        return None, text
    end = text.find("\n---", 4)
    if end == -1:
        return None, text
    return text[4:end], text[end + 4:]


def check_rules(rules: Path) -> None:
    names = {p.name for p in rules.glob("*.md")}
    permanent = 0
    for rf in sorted(rules.glob("*.md")):
        text = rf.read_text()
        fm, body = frontmatter(text)
        lines = len(text.splitlines())

        if fm is not None:
            if not re.search(r"^paths:\s*$", fm, re.M):
                errors.append(f"{rf.name}: frontmatter without a `paths:` key")
            elif not re.search(r'^\s*-\s*"', fm, re.M):
                errors.append(f"{rf.name}: `paths:` entries must be quoted strings")
            for pat in re.findall(r'^\s*-\s*"([^"]+)"', fm, re.M):
                if pat.count("{") != pat.count("}"):
                    errors.append(f"{rf.name}: unbalanced braces in glob {pat!r}")
        else:
            permanent += lines

        # dead cross-references
        for ref in set(re.findall(r"`([a-z][a-z0-9-]*\.md)`", text)):
            if ref not in names:
                errors.append(f"{rf.name}: references `{ref}`, which does not exist")

        # procedure smell: many code blocks, few constraints
        fences = text.count("\n```") // 2
        constraints = len(re.findall(
            r"\b(never|must|always|is a defect|is a bug)\b", text, re.I))
        if fences >= 2 and constraints <= 2:
            warnings.append(
                f"{rf.name}: {fences} code blocks for {constraints} constraint(s) — "
                "reads like a procedure; consider a skill")
        if lines > 60 and fm is None:
            warnings.append(
                f"{rf.name}: {lines} lines loaded every session — consider "
                "scoping it with `paths:` or splitting it")

    if permanent > 300:
        warnings.append(f"permanent context is {permanent} lines across all rules")
    print(f"  rules: {len(names)}, {permanent} lines always loaded")


def check_named(directory: Path, kind: str, subdir_style: bool,
                require_name: bool = True) -> None:
    if not directory.is_dir():
        return
    items = sorted(directory.glob("*/SKILL.md")) if subdir_style else sorted(directory.glob("*.md"))
    for f in items:
        fm, _ = frontmatter(f.read_text())
        label = f.parent.name if subdir_style else f.name
        if fm is None:
            errors.append(f"{kind}/{label}: missing YAML frontmatter")
            continue
        keys = ("name", "description") if require_name else ("description",)
        for key in keys:
            if not re.search(rf"^{key}:\s*\S", fm, re.M):
                errors.append(f"{kind}/{label}: frontmatter has no `{key}`")
        name = re.search(r"^name:\s*(\S+)", fm, re.M) if require_name else None
        expected = f.parent.name if subdir_style else f.stem
        if name and name.group(1) != expected:
            errors.append(f"{kind}/{label}: name `{name.group(1)}` != `{expected}`")
    print(f"  {kind}: {len(items)}")


def check_settings(claude: Path) -> None:
    import json
    for jf in claude.glob("*.json"):
        try:
            json.loads(jf.read_text())
        except json.JSONDecodeError as e:
            errors.append(f"{jf.name}: invalid JSON — {e}")
    settings = claude / "settings.json"
    if settings.is_file():
        cfg = json.loads(settings.read_text())
        for event, entries in (cfg.get("hooks") or {}).items():
            for entry in entries:
                for hook in entry.get("hooks", []):
                    for script in re.findall(r"\$CLAUDE_PROJECT_DIR/(\S+?\.(?:cjs|sh|py))",
                                             hook.get("command", "")):
                        if not (claude.parent / script).is_file():
                            errors.append(f"settings.json: {event} hook points at "
                                          f"missing {script}")


def check_plugin(plugin: Path) -> None:
    """A workspace devkit: the rules are skills, so check those instead."""
    print(f"  plugin {plugin.name}")
    check_named(plugin / "skills", "skills", subdir_style=True)
    check_named(plugin / "agents", "agents", subdir_style=False)
    check_named(plugin / "commands", "commands", subdir_style=False,
                require_name=False)
    hooks = plugin / "hooks" / "hooks.json"
    if hooks.is_file():
        import json
        try:
            cfg = json.loads(hooks.read_text())
        except json.JSONDecodeError as e:
            errors.append(f"hooks/hooks.json: invalid JSON — {e}")
            return
        for event, entries in (cfg.get("hooks") or {}).items():
            for entry in entries:
                if not entry.get("_why"):
                    warnings.append(f"hooks.json: {event} entry has no `_why`")
                for hook in entry.get("hooks", []):
                    for script in re.findall(
                            r"\$\{CLAUDE_PLUGIN_ROOT\}/(\S+?\.(?:cjs|sh|py))",
                            hook.get("command", "")):
                        if not (plugin / script).is_file():
                            errors.append(f"hooks.json: {event} hook points at "
                                          f"missing {script}")


def main() -> int:
    root = Path(sys.argv[1] if len(sys.argv) > 1 else ".").resolve()

    # A devkit given directly, or found in a workspace.
    plugin = root if (root / ".claude-plugin" / "plugin.json").is_file() else None
    if plugin is None:
        # The devkit lives in one of the project's repositories, so the
        # plugin can sit a level or two below the workspace root.
        found = sorted(root.glob("*/.claude-plugin/plugin.json")) \
             or sorted(root.glob("*/*/.claude-plugin/plugin.json"))
        plugin = found[0].parent.parent if found else None

    claude = root / ".claude"
    if not claude.is_dir() and plugin is None:
        print(f"no .claude/ and no plugin in {root}", file=sys.stderr)
        return 1

    if claude.is_dir():
        print(f"checking {claude}")
        if (claude / "rules").is_dir():
            check_rules(claude / "rules")
        elif plugin is not None:
            print("  rules: none here — this is a workspace, "
                  "the conventions are skills in the devkit")
        else:
            errors.append(".claude/ has no rules/ and no devkit was found")
    if plugin is not None:
        check_plugin(plugin)
    if not claude.is_dir():
        print()
        for w in warnings: print(f"  WARN   {w}")
        for e in errors: print(f"  ERROR  {e}")
        print(f"\n{len(errors)} error(s), {len(warnings)} warning(s)")
        return 1 if errors else 0
    if claude.is_dir():
        check_named(claude / "skills", "skills", subdir_style=True)
        check_named(claude / "agents", "agents", subdir_style=False)
        # A slash command takes its name from the filename; no `name:` key.
        check_named(claude / "commands", "commands", subdir_style=False,
                    require_name=False)
        check_settings(claude)

    print()
    for w in warnings:
        print(f"  WARN   {w}")
    for e in errors:
        print(f"  ERROR  {e}")
    if not errors and not warnings:
        print("  clean")
    print(f"\n{len(errors)} error(s), {len(warnings)} warning(s)")
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
