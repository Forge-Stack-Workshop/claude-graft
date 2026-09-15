#!/usr/bin/env python3
"""Optional-module registry for claude-graft.

Each optional capability is a self-describing directory under `optional/<id>/`
with a `module.json` manifest (files to copy, hooks to wire, gitignore lines,
a post-install note). Both entry points read this one registry:

  - build-plugin.py (workspace mode) copies a module's files into the plugin and
    merges its hooks into the plugin hooks.json.
  - install.sh (mono mode) calls this file's `apply-project` CLI to copy files
    into the repo's .claude/, merge hooks into its settings.json, and append
    gitignore lines.

Adding a capability means adding one `optional/<id>/` directory — no edit to
install.sh or build-plugin.py. That is the whole point.

Manifest schema (optional/<id>/module.json):
  id, title, description        strings
  default                       bool  (selected when the user picks the defaults)
  files: [{src, dst, chmod?}]   src relative to the module dir, dst relative to
                                the target .claude root
  hooks: [{event, matcher?, name, command, timeout, why}]
                                command uses the literal token ${ROOT}, replaced
                                with the runtime plugin/project root by the caller
  gitignore: [lines]            optional
  order: int                    optional hook-append order (default 50; higher = later)
  notes: string                 optional post-install message

The ${ROOT} token keeps a hook command identical in both topologies; the caller
substitutes ${CLAUDE_PLUGIN_ROOT} (workspace) or $CLAUDE_PROJECT_DIR/.claude (repo).
"""
from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path

TEMPLATE = Path(__file__).resolve().parent
OPTIONAL = TEMPLATE / "optional"


def load_registry() -> list[dict]:
    mods = []
    if OPTIONAL.is_dir():
        for mf in sorted(OPTIONAL.glob("*/module.json")):
            data = json.loads(mf.read_text())
            data["_dir"] = mf.parent
            mods.append(data)
    return mods


def _by_id(registry: list[dict]) -> dict[str, dict]:
    return {m["id"]: m for m in registry}


def resolve_selection(with_arg: str | None, interactive: bool) -> list[str]:
    """Turn a --with value (and/or an interactive menu) into a list of ids."""
    registry = load_registry()
    ids = [m["id"] for m in registry]
    by_id = _by_id(registry)

    if with_arg is not None:
        token = with_arg.strip().lower()
        if token in ("all", "*"):
            return ids
        if token in ("none", ""):
            return []
        chosen, unknown = [], []
        for part in (p.strip() for p in with_arg.split(",")):
            if not part:
                continue
            if part in by_id:
                if part not in chosen:
                    chosen.append(part)
            else:
                unknown.append(part)
        if unknown:
            sys.stderr.write(
                f"error: unknown module(s): {', '.join(unknown)}. "
                f"Available: {', '.join(ids)}\n")
            raise SystemExit(64)
        return chosen

    if interactive and registry:
        return _interactive_menu(registry)

    # no --with, non-interactive: the defaults
    return [m["id"] for m in registry if m.get("default")]


def _interactive_menu(registry: list[dict]) -> list[str]:
    """A tiny checkbox menu on the controlling terminal (/dev/tty)."""
    try:
        tty_in = open("/dev/tty")
        tty_out = open("/dev/tty", "w")
    except OSError:
        # No terminal (CI): fall back to defaults.
        return [m["id"] for m in registry if m.get("default")]

    def w(s=""):
        tty_out.write(s + "\n"); tty_out.flush()

    w("\nOptional modules — choose what to install:")
    for i, m in enumerate(registry, 1):
        mark = "*" if m.get("default") else " "
        w(f"  {i}) [{mark}] {m['id']:<20} {m['title']}")
        w(f"        {m['description']}")
    w("\nEnter numbers separated by space/comma (e.g. '1 3 4'),")
    w("'all', 'none', or empty for the defaults (marked *):")
    tty_out.write("> "); tty_out.flush()
    raw = tty_in.readline().strip()
    tty_in.close(); tty_out.close()

    token = raw.lower()
    if token in ("all", "*"):
        return [m["id"] for m in registry]
    if token in ("none",):
        return []
    if not raw:
        return [m["id"] for m in registry if m.get("default")]
    chosen = []
    for part in raw.replace(",", " ").split():
        if part.isdigit() and 1 <= int(part) <= len(registry):
            mid = registry[int(part) - 1]["id"]
            if mid not in chosen:
                chosen.append(mid)
    return chosen


def apply(root: Path, module_ids: list[str], root_token: str,
          config_only: bool = False) -> dict:
    """Copy the selected modules' files under `root`; return merged hook/gitignore/notes.

    `root_token` is substituted for the literal ${ROOT} in every hook command
    (e.g. '${CLAUDE_PLUGIN_ROOT}' or '$CLAUDE_PROJECT_DIR/.claude').
    Returns {"hooks_by_event": {event: [entry,...]}, "gitignore": [...], "notes": [...]}.
    Never overwrites an existing destination file (idempotent re-runs).
    """
    by_id = _by_id(load_registry())
    hooks_by_event: dict[str, list] = {}
    gitignore: list[str] = []
    notes: list[str] = []

    ordered = sorted([i for i in module_ids if i in by_id],
                     key=lambda i: (by_id[i].get('order', 50), i))
    for mid in ordered:
        m = by_id[mid]
        mdir: Path = m["_dir"]
        for f in m.get("files", []):
            if config_only and f["dst"].startswith("hooks/"):
                continue
            src = mdir / f["src"]
            dst = root / f["dst"]
            if dst.exists():
                continue
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dst)
            if f.get("chmod"):
                dst.chmod(0o755)
        for h in ([] if config_only else m.get("hooks", [])):
            entry = {
                "_why": h.get("why", ""),
                "hooks": [{
                    "type": "command",
                    "name": h["name"],
                    "command": h["command"].replace("${ROOT}", root_token),
                    "timeout": h.get("timeout", 10000),
                }],
            }
            if h.get("matcher"):
                entry = {"matcher": h["matcher"], **entry}
            hooks_by_event.setdefault(h["event"], []).append(entry)
        gitignore += m.get("gitignore", [])
        if m.get("notes"):
            notes.append(m["notes"])

    return {"hooks_by_event": hooks_by_event, "gitignore": gitignore, "notes": notes}


# --- CLI (used by install.sh; build-plugin.py imports the functions directly) ---

def _cmd_list(_args):
    for m in load_registry():
        print(f"{m['id']}\t{int(bool(m.get('default')))}\t{m['title']}")


def _cmd_resolve(args):
    for mid in resolve_selection(args.with_, args.interactive):
        print(mid)


def _cmd_apply_project(args):
    root = Path(args.root)
    root.mkdir(parents=True, exist_ok=True)
    ids = [i for i in args.modules.split(",") if i]
    result = apply(root, ids, "$CLAUDE_PROJECT_DIR/.claude", config_only=args.config_only)

    # merge hooks into the repo settings.json (dedup by hook name per event)
    settings_path = root / "settings.json"
    cfg = json.loads(settings_path.read_text()) if settings_path.is_file() else {}
    hooks = cfg.setdefault("hooks", {})
    for event, entries in result["hooks_by_event"].items():
        bucket = hooks.setdefault(event, [])
        existing = {h.get("name") for e in bucket for h in e.get("hooks", [])}
        for e in entries:
            if not any(h.get("name") in existing for h in e.get("hooks", [])):
                bucket.append(e)
    if result["hooks_by_event"]:
        settings_path.write_text(json.dumps(cfg, indent=2) + "\n")

    # append gitignore lines
    if result["gitignore"]:
        gi = root.parent / ".gitignore"
        have = gi.read_text() if gi.is_file() else ""
        add = [ln for ln in result["gitignore"] if ln and ln not in have]
        if add:
            with gi.open("a") as fh:
                fh.write("\n" + "\n".join(add) + "\n")

    for n in result["notes"]:
        print(n)


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("list").set_defaults(func=_cmd_list)
    r = sub.add_parser("resolve")
    r.add_argument("--with", dest="with_", default=None)
    r.add_argument("--interactive", action="store_true")
    r.set_defaults(func=_cmd_resolve)
    a = sub.add_parser("apply-project")
    a.add_argument("--root", required=True)
    a.add_argument("--modules", default="")
    a.add_argument("--config-only", action="store_true")
    a.set_defaults(func=_cmd_apply_project)
    args = ap.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
