#!/usr/bin/env python3
"""Derive the workspace plugin from payload/.

    python3 build-plugin.py <workspace-root> --devkit <path> [--name <plugin>]

The devkit is **a repository of the project**, versioned with it — not a folder
this script invents at the workspace root. Point `--devkit` at that repository;
the Claude configuration takes one subdirectory of it (`claude/`), because such
a repository usually carries other things too: its own Makefile, docs, CI.

The plugin is DERIVED, never maintained in parallel — the same reason the dev
Dockerfile derives from the production one. `payload/` is the single source.

What goes where, and why:

Claude is launched at the WORKSPACE ROOT, never inside a member repository.
That single decision is what keeps the business repositories clean: the root is
the starting directory, so its `.claude/settings.json` applies, and every repo
below is simply a subdirectory of one session. Nothing is distributed.

  path-scoped rule  -> plugin skill with the same `paths:`   (documented as
                       "uses the same format as path-specific rules", so the
                       activation behaviour is unchanged)
  always-loaded rule-> devkit/doctrine.md, symlinked from the
                       workspace root as CLAUDE.md — one home for the doctrine,
                       versioned in the devkit, edited without a rebuild
  skills/agents/
  commands/hooks    -> the devkit, which is itself the plugin
  thresholds, guard
  configs, tools    -> the devkit, beside the doctrine they serve; the hooks
                       resolve them through CLAUDE_PLUGIN_ROOT

The workspace root holds exactly two things: the CLAUDE.md symlink, and a
.claude/settings.json that does nothing but enable the plugin — unavoidable,
because project settings are not inherited from parent directories.

Member repositories receive nothing. No CLAUDE.md, no .claude/, no marker.
"""
from __future__ import annotations
import json, os, re, shutil, subprocess, sys
from pathlib import Path

TEMPLATE = Path(__file__).resolve().parent
PAYLOAD = TEMPLATE / "payload" / ".claude"


def frontmatter(text: str) -> tuple[dict | None, str]:
    if not text.startswith("---\n"):
        return None, text
    end = text.find("\n---", 4)
    if end == -1:
        return None, text
    raw, body = text[4:end], text[end + 4:].lstrip("\n")
    fm: dict = {}
    key = None
    for line in raw.splitlines():
        if m := re.match(r"^(\w[\w-]*):\s*(.*)$", line):
            key = m.group(1)
            fm[key] = m.group(2).strip() or []
        elif m := re.match(r"^\s+-\s*(.+)$", line):
            if isinstance(fm.get(key), list):
                fm[key].append(m.group(1).strip())
    return fm, body


def template_version() -> str:
    """The plugin version, read from this repository's latest tag.

    The version exists in one place — the tag — and everything else reads it.
    A number written into a second file disagrees with the first eventually.
    """
    try:
        out = subprocess.run(["git", "describe", "--tags", "--abbrev=0"],
                             cwd=TEMPLATE, capture_output=True, text=True,
                             check=True).stdout.strip()
        return out.lstrip("v") or "0.0.0"
    except (subprocess.CalledProcessError, FileNotFoundError):
        return "0.0.0-dev"


def git_root(path: Path) -> Path | None:
    for candidate in [path, *path.parents]:
        if (candidate / ".git").exists():
            return candidate
    return None


def build(workspace: Path, devkit: Path, name: str,
          recording: bool = False) -> None:
    # The devkit repository holds more than Claude; the configuration takes one
    # subdirectory of it rather than colonising its root.
    repo = git_root(devkit)
    plugin = devkit / "claude" if repo == devkit else devkit
    plugin.mkdir(parents=True, exist_ok=True)
    # Everything under these directories is derived, so the build starts from a
    # clean slate: a rule renamed or deleted in payload/ must disappear here
    # too. Anything else in the plugin directory — .git, a README — is left
    # alone, because the devkit is a repository of its own.
    for sub in ("skills", "agents", "commands", "hooks"):
        shutil.rmtree(plugin / sub, ignore_errors=True)
    for sub in ("skills", "agents", "commands", "hooks", ".claude-plugin"):
        (plugin / sub).mkdir(parents=True, exist_ok=True)

    always: list[tuple[str, str]] = []
    scoped = 0

    for rf in sorted((PAYLOAD / "rules").glob("*.md")):
        fm, body = frontmatter(rf.read_text())
        if fm is None:
            always.append((rf.stem, body.strip()))
            continue
        desc = fm.get("description")
        if not desc:
            raise SystemExit(f"{rf.name}: scoped rule has no `description:` — "
                             f"a plugin skill requires one")
        paths = fm.get("paths") or []
        out = plugin / "skills" / rf.stem
        out.mkdir(parents=True, exist_ok=True)
        head = [f"name: {rf.stem}", f"description: {desc}", "paths:"]
        head += [f"  - {p}" for p in paths]
        (out / "SKILL.md").write_text("---\n" + "\n".join(head) + "\n---\n\n" + body)
        scoped += 1

    for src, dst in (("skills", "skills"), ("agents", "agents"), ("commands", "commands")):
        for item in sorted((PAYLOAD / src).iterdir()) if (PAYLOAD / src).is_dir() else []:
            target = plugin / dst / item.name
            if target.exists():
                raise SystemExit(f"name collision: {dst}/{item.name} already derived from a rule")
            (shutil.copytree if item.is_dir() else shutil.copy2)(item, target)

    # Hooks: scripts verbatim, wiring translated to the plugin's own root.
    for script in sorted((PAYLOAD / "hooks").iterdir()):
        shutil.copy2(script, plugin / "hooks" / script.name)

    # Optional: the session recorder. Its code goes in the plugin so every
    # repository shares one implementation; whether a repository actually
    # records is decided by its own session-recording.json.
    if recording:
        opt = TEMPLATE / "optional" / ".claude"
        shutil.copy2(opt / "hooks" / "session-recorder.py", plugin / "hooks")
        shutil.copytree(opt / "skills" / "session-recording",
                        plugin / "skills" / "session-recording", dirs_exist_ok=True)
        shutil.copy2(opt / "commands" / "recording.md", plugin / "commands")

    settings = json.loads((PAYLOAD / "settings.json").read_text())
    hooks = settings.get("hooks", {})
    if recording:
        cmd = ("sh -c 'f=\"${CLAUDE_PLUGIN_ROOT}/hooks/session-recorder.py\"; "
               "[ ! -f \"$f\" ] || python3 \"$f\"'")
        why = {
            "SessionStart": "Replays the tail of the previous session, so a "
                            "developer returning to the project is back in context.",
            "PostToolUse": "Re-renders mid-turn, throttled to one write per min_interval_seconds.",
            "Stop": "Re-renders after every assistant turn, unthrottled.",
            "SessionEnd": "Final render of the session transcript.",
        }
        for event, reason in why.items():
            hooks.setdefault(event, []).append({
                "_why": "Optional session recording. " + reason +
                        " Inert in a repository whose .claude/session-recording.json "
                        "is absent or disabled. Control with /recording.",
                "hooks": [{"type": "command", "name": "session-recorder",
                           "command": cmd, "timeout": 15000}]})
    for entries in hooks.values():
        for entry in entries:
            for hook in entry.get("hooks", []):
                # The script comes from the plugin; the config it reads stays in
                # the repo, so shared code keeps per-repo thresholds.
                hook["command"] = hook["command"].replace(
                    '$CLAUDE_PROJECT_DIR/.claude/hooks/', '${CLAUDE_PLUGIN_ROOT}/hooks/')
    (plugin / "hooks" / "hooks.json").write_text(
        json.dumps({"hooks": hooks}, indent=2) + "\n")

    (plugin / ".claude-plugin" / "plugin.json").write_text(json.dumps({
        "name": name,
        "description": "Shared engineering doctrine for this workspace: "
                       "path-scoped conventions, scaffolding and flow skills, "
                       "review agents, and the write-time guards.",
        "version": template_version(),
    }, indent=2) + "\n")

    (plugin / ".claude-plugin" / "marketplace.json").write_text(json.dumps({
        "name": name,
        "owner": {"name": "workspace"},
        "plugins": [{"name": name, "source": "./", "description":
                     "Workspace engineering doctrine."}],
    }, indent=2) + "\n")

    # The always-loaded doctrine lives in the devkit and is exposed to the
    # workspace by a symlink. One home, versioned with the devkit, and an edit
    # takes effect without rebuilding anything.
    md = ["# Workspace engineering doctrine",
          "",
          "<!-- Derived by claude-graft/build-plugin.py from payload/.claude/rules/.",
          "     Edit the rules and rebuild, or edit here and port it back. -->",
          "",
          "Launch Claude at the workspace root, not inside a member repository:",
          "project settings are not inherited from parent directories, so a",
          "session started deeper loses the hooks and the plugin.",
          "",
          f"Path-scoped conventions, skills, agents and guards come from the",
          f"`{name}` plugin, enabled once in the workspace `.claude/settings.json`.",
          ""]
    for stem, body in always:
        md.append(body if body.startswith("#") else f"# {stem}\n\n{body}")
        md.append("")
    doctrine = plugin / "doctrine.md"
    doctrine.write_text("\n".join(md))

    link = workspace / "CLAUDE.md"
    rel = os.path.relpath(doctrine, workspace)
    if link.is_symlink() or link.exists():
        if not link.is_symlink():
            raise SystemExit(f"{link} exists and is a real file — move it aside, "
                             f"it must become a symlink to {rel}")
        link.unlink()
    try:
        link.symlink_to(rel)
    except OSError as e:      # Windows without developer mode
        link.write_text(f"@{rel}\n")
        print(f"  note: symlink unavailable ({e}); wrote an @import instead")

    # The workspace settings: generated from a template kept in the devkit, so
    # the wiring is versioned with the doctrine rather than living only on disk.
    template = {
        "$schema": "https://json.schemastore.org/claude-code-settings.json",
        "_why": "Generated from claude-settings.template.json in the devkit. "
                "This file exists only because project settings are NOT "
                "inherited from parent directories, so the launch directory "
                "must carry the plugin enablement. Everything else — doctrine, "
                "skills, hooks, thresholds, tools — lives in the devkit "
                "repository and is versioned with it. Do not add settings here "
                "that belong there.",
        "extraKnownMarketplaces": {
            name: {"source": {"source": "local",
                              "path": "./" + os.path.relpath(plugin, workspace)}}},
        "enabledPlugins": {f"{name}@{name}": True},
    }
    (plugin / "claude-settings.template.json").write_text(
        json.dumps(template, indent=2) + chr(10))

    # Everything the hooks read lives in the devkit, beside the doctrine they
    # enforce. The hooks resolve it through CLAUDE_PLUGIN_ROOT, so nothing is
    # copied to the workspace root.
    shutil.rmtree(plugin / "tools", ignore_errors=True)
    shutil.copytree(PAYLOAD / "tools", plugin / "tools")
    for cfg in ("thresholds.json", "folder-readme.json", "convention-guard.json"):
        if not (plugin / cfg).exists():
            shutil.copy2(PAYLOAD / cfg, plugin / cfg)
    if recording and not (plugin / "session-recording.json").exists():
        shutil.copy2(TEMPLATE / "optional" / ".claude" / "session-recording.json",
                     plugin)

    # The only thing that cannot live in the devkit: project settings are not
    # inherited from parent directories, so the launch directory must carry the
    # file that enables the plugin. It carries nothing else.
    ws_claude = workspace / ".claude"
    ws_claude.mkdir(exist_ok=True)
    settings_path = ws_claude / "settings.json"
    existing = json.loads(settings_path.read_text()) if settings_path.is_file() else {}
    existing.update(template)
    settings_path.write_text(json.dumps(existing, indent=2) + chr(10))

    if repo is None:
        print(f"WARNING     {devkit} is not inside a git repository.")
        print(f"            The doctrine is meant to be versioned with the")
        print(f"            project — run `git init` there, or point --devkit")
        print(f"            at a repository that already exists.")
    else:
        print(f"devkit repo {repo}")
    print(f"plugin      {plugin.relative_to(workspace)}")
    print(f"  skills    {len(list((plugin / 'skills').iterdir()))} "
          f"({scoped} derived from path-scoped rules)")
    print(f"  agents    {len(list((plugin / 'agents').iterdir()))}")
    print(f"  commands  {len(list((plugin / 'commands').iterdir()))}")
    print(f"  hooks     {len(list((plugin / 'hooks').glob('*.cjs'))) + len(list((plugin / 'hooks').glob('*.py')))}")
    print(f"doctrine    {doctrine.relative_to(workspace)} "
          f"({len(always)} always-loaded rules, "
          f"{len(doctrine.read_text().splitlines())} lines)")
    print(f"CLAUDE.md   symlink -> {rel}")
    print(f"root        CLAUDE.md symlink + .claude/settings.json "
          f"(plugin enablement only)")
    print(f"config      {plugin.relative_to(workspace)}/ "
          f"(thresholds, guards, tools — versioned with the devkit)")
    print(f"repos       untouched — no CLAUDE.md, no .claude/, nothing")


def parse(argv: list[str]) -> tuple[Path, Path, str, bool]:
    flags = {"--name", "--devkit"}
    positional, opts, skip = [], {}, False
    for i, a in enumerate(argv):
        if skip:
            skip = False
            continue
        if a in flags:
            opts[a] = argv[i + 1]
            skip = True
        elif not a.startswith("--"):
            positional.append(a)
    if not positional:
        raise SystemExit("usage: build-plugin.py <workspace-root> "
                         "--devkit <path> [--name <plugin>]")
    workspace = Path(positional[0]).resolve()
    workspace.mkdir(parents=True, exist_ok=True)
    devkit = Path(opts.get("--devkit", "claude-devkit"))
    if not devkit.is_absolute():
        devkit = workspace / devkit
    devkit = devkit.resolve()
    if workspace not in devkit.parents and devkit != workspace:
        raise SystemExit(f"--devkit must live inside the workspace ({workspace})")
    name = opts.get("--name") or (git_root(devkit) or devkit).name
    return workspace, devkit, name, "--with-recording" in argv


if __name__ == "__main__":
    build(*parse(sys.argv[1:]))
