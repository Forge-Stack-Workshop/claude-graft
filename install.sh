#!/usr/bin/env bash
# Install the Claude template into a project.
#
# Mono-repo — the repository carries everything, self-contained and auditable:
#   ./install.sh /path/to/repo
#   ./install.sh /path/to/repo --dry             show what would happen
#   ./install.sh /path/to/repo --with-recording  also install the session recorder
#
# Multi-repo workspace — the doctrine is central to THIS project, never to the
# machine, so changing one project's Claude never touches another's:
#   ./install.sh --workspace /path/to/workspace --devkit /path/to/workspace/my-devkit
#
# The devkit is a REPOSITORY OF THE PROJECT, versioned with it. Point --devkit
# at it; the Claude configuration takes one subdirectory (claude/), because such
# a repository usually carries its own Makefile, docs and CI too.
#
# Claude is launched at the WORKSPACE ROOT. Member repositories receive nothing
# — no CLAUDE.md, no .claude/ — and stay clean.
#
# Flags combine, in any order. Re-running with --with-recording on an already
# configured project adds the recorder without touching anything else.
#
# Never overwrites an existing file. Anything already present is reported and
# skipped, so re-running on a configured project is safe.
set -euo pipefail

TEMPLATE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PAYLOAD="$TEMPLATE_DIR/payload"

target=""
dry=false
recording=false
mode=mono
next_is_name=false
next_is_devkit=false
plugin_name=""
devkit_path=claude-devkit
for arg in "$@"; do
  if $next_is_name; then plugin_name="$arg"; next_is_name=false; continue; fi
  if $next_is_devkit; then devkit_path="$arg"; next_is_devkit=false; continue; fi
  case "$arg" in
    --dry)            dry=true ;;
    --with-recording) recording=true ;;
    --workspace)      mode=workspace ;;
    --devkit)         next_is_devkit=true ;;
    --name)           next_is_name=true ;;
    -*)               echo "error: unknown flag '$arg'" >&2; exit 64 ;;
    *)                [ -z "$target" ] && target="$arg" || { echo "error: two targets given" >&2; exit 64; } ;;
  esac
done

if [ -z "$target" ]; then
  echo "usage: $0 <repo> [--dry] [--with-recording]" >&2
  echo "       $0 --workspace <root> --devkit <repo-in-the-workspace> [--name <plugin>] [--with-recording]" >&2
  exit 64
fi

# --- workspace mode: build the shared devkit, once, for this project ---------
if [ "$mode" = workspace ]; then
  mkdir -p "$target"
  target="$(cd "$target" && pwd)"
  echo "Workspace : $target"
  $dry && { echo "dry run: would build the devkit at '$devkit_path' and link $target/CLAUDE.md"; exit 0; }
  name_arg=""; [ -n "$plugin_name" ] && name_arg="--name $plugin_name"
  if $recording; then
    python3 "$TEMPLATE_DIR/build-plugin.py" "$target" --devkit "$devkit_path" $name_arg --with-recording
    echo
    echo "Session recording is enabled for the workspace"
    echo "(.claude/session-recording.json). Control it with /recording."
  else
    python3 "$TEMPLATE_DIR/build-plugin.py" "$target" --devkit "$devkit_path" $name_arg
  fi
  cat <<NEXT

The devkit is a repository of its own — commit it, tag it, review changes to the
doctrine like any other change. The workspace CLAUDE.md is a symlink into it, so
editing doctrine.md takes effect immediately, with no rebuild.

Member repositories receive nothing and stay clean.

  cd $target && claude          # launch at the ROOT, not inside a repo
  /context                      # confirm CLAUDE.md and the plugin loaded
  /project-init

NEXT
  exit 0
fi
if [ ! -d "$target" ]; then
  echo "error: '$target' is not a directory" >&2
  exit 66
fi
target="$(cd "$target" && pwd)"

# --- workspace mode: build the shared devkit, once, for this project ---------
if [ "$mode" = workspace ]; then
  mkdir -p "$target"
  target="$(cd "$target" && pwd)"
  echo "Workspace : $target"
  $dry && { echo "dry run: would build the devkit at '$devkit_path' and link $target/CLAUDE.md"; exit 0; }
  name_arg=""; [ -n "$plugin_name" ] && name_arg="--name $plugin_name"
  if $recording; then
    python3 "$TEMPLATE_DIR/build-plugin.py" "$target" --devkit "$devkit_path" $name_arg --with-recording
    echo
    echo "Session recording is enabled for the workspace"
    echo "(.claude/session-recording.json). Control it with /recording."
  else
    python3 "$TEMPLATE_DIR/build-plugin.py" "$target" --devkit "$devkit_path" $name_arg
  fi
  cat <<NEXT

The devkit is a repository of its own — commit it, tag it, review changes to the
doctrine like any other change. The workspace CLAUDE.md is a symlink into it, so
editing doctrine.md takes effect immediately, with no rebuild.

Member repositories receive nothing and stay clean.

  cd $target && claude          # launch at the ROOT, not inside a repo
  /context                      # confirm CLAUDE.md and the plugin loaded
  /project-init

NEXT
  exit 0
fi
if [ ! -d "$target" ]; then
  echo "error: '$target' is not a directory" >&2
  exit 66
fi
target="$(cd "$target" && pwd)"

# --- repo mode: wire one repository to its workspace devkit ------------------
if [ "$mode" = repo ]; then
  ws=""; dir="$(dirname "$target")"
  while [ "$dir" != "/" ]; do
    if [ -f "$dir/$plugin_name/.claude-plugin/plugin.json" ]; then ws="$dir"; break; fi
    dir="$(dirname "$dir")"
  done
  if [ -z "$ws" ]; then
    echo "error: no '$plugin_name' devkit found above '$target'." >&2
    echo "       Build it first: $0 --workspace <workspace-root>" >&2
    exit 66
  fi
  rel="$(python3 -c 'import os,sys;print(os.path.relpath(sys.argv[1],sys.argv[2]))' "$ws/$plugin_name" "$target")"
  echo "Workspace : $ws"
  echo "Devkit    : $plugin_name  (referenced as $rel)"
  echo "Repository: $target"
  echo
  $dry && { echo "dry run: would write $target/.claude/settings.json and per-repo config"; exit 0; }

  mkdir -p "$target/.claude"
  # Per-repo config the shared hooks read: the code is central, the numbers are local.
  for f in thresholds.json folder-readme.json convention-guard.json; do
    if [ -e "$target/.claude/$f" ]; then echo "  skip (exists)  .claude/$f"
    else echo "  install        .claude/$f"; cp "$PAYLOAD/.claude/$f" "$target/.claude/$f"; fi
  done
  if $recording; then
    if [ ! -f "$ws/$plugin_name/hooks/session-recorder.py" ]; then
      echo "error: this devkit was built without the session recorder." >&2
      echo "       Rebuild it: $0 --workspace $ws --with-recording" >&2
      exit 66
    fi
    if [ -e "$target/.claude/session-recording.json" ]; then
      echo "  skip (exists)  .claude/session-recording.json"
    else
      echo "  install        .claude/session-recording.json (recording enabled)"
      cp "$TEMPLATE_DIR/optional/.claude/session-recording.json" "$target/.claude/"
    fi
    if [ -f "$target/.gitignore" ] && grep -q "docs/sessions" "$target/.gitignore"; then :; else
      echo "  append         .gitignore  (docs/sessions/)"
      printf '\n# --- Session transcripts (remove this line to commit them) ---\ndocs/sessions/\n' >> "$target/.gitignore"
    fi
  fi
  echo "  wire           .claude/settings.json -> $plugin_name"
  python3 - "$target" "$rel" "$plugin_name" <<'WIRE'
import json, sys
from pathlib import Path

repo, rel, name = Path(sys.argv[1]), sys.argv[2], sys.argv[3]
f = repo / ".claude" / "settings.json"
cfg = json.loads(f.read_text()) if f.is_file() else {}
cfg["$schema"] = "https://json.schemastore.org/claude-code-settings.json"
cfg["_why"] = (
    "Project settings are NOT inherited from parent directories, so this file "
    "must exist in every repository. It enables the workspace devkit for THIS "
    "repository only — another project's Claude setup is unaffected. The "
    "always-loaded doctrine comes from the workspace root CLAUDE.md, which IS "
    "inherited. Hooks and path-scoped conventions come from the plugin; the "
    "numbers they read stay in this repo's thresholds.json.")
cfg.setdefault("extraKnownMarketplaces", {})[name] = {
    "source": {"source": "local", "path": rel}}
cfg.setdefault("enabledPlugins", {})[f"{name}@{name}"] = True
f.write_text(json.dumps(cfg, indent=2) + chr(10))
WIRE
  echo
  echo "Done. Start Claude in the repository and run /context to confirm the"
  echo "workspace CLAUDE.md and the plugin both loaded, then /project-init."
  exit 0
fi
target="$(cd "$target" && pwd)"
if [ "$target" = "$TEMPLATE_DIR" ]; then
  echo "error: refusing to install the template into itself" >&2
  exit 65
fi

say() { $dry && echo "  [dry] $*" || echo "  $*"; }

copy() { # copy <relative-path>
  local rel="$1" src="$PAYLOAD/$rel" dst="$target/$rel"
  if [ -e "$dst" ]; then
    echo "  skip (exists)  $rel"; return
  fi
  say "install        $rel"
  $dry && return
  mkdir -p "$(dirname "$dst")"
  cp "$src" "$dst"
  case "$rel" in *.cjs|*.py|*.sh) chmod +x "$dst" ;; esac
}

echo "Template : $TEMPLATE_DIR"
echo "Target   : $target"
$recording && echo "Options  : session recording"
$dry && echo "Mode     : dry run, nothing will be written"
echo

( cd "$PAYLOAD" && find . -type f ! -name gitignore.append -printf '%P\n' | sort ) \
  | while read -r rel; do copy "$rel"; done

# Optional: the session recorder.
if $recording; then
  OPTIONAL="$TEMPLATE_DIR/optional"
  ( cd "$OPTIONAL" && find . -type f -printf '%P\n' | sort ) \
    | while read -r rel; do
        src="$OPTIONAL/$rel" dst="$target/$rel"
        if [ -e "$dst" ]; then
          echo "  skip (exists)  $rel"
        else
          say "install        $rel"
          if ! $dry; then
            mkdir -p "$(dirname "$dst")"
            cp "$src" "$dst"
            case "$rel" in *.py) chmod +x "$dst" ;; esac
          fi
        fi
      done
  say "wire           session-recorder hooks into .claude/settings.json"
  $dry || python3 - "$target" <<'WIRE'
import json, sys
from pathlib import Path

settings = Path(sys.argv[1]) / ".claude" / "settings.json"
cfg = json.loads(settings.read_text()) if settings.is_file() else {}
hooks = cfg.setdefault("hooks", {})
cmd = ("sh -c 'f=\"$CLAUDE_PROJECT_DIR/.claude/hooks/session-recorder.py\"; "
       "[ ! -f \"$f\" ] || python3 \"$f\"'")

WHY = {
    "SessionStart": "Replays the tail of the previous session, so a developer "
                    "returning to the project is back in context without "
                    "re-reading their own code.",
    "PostToolUse": "Re-renders while a turn is still running, throttled to one "
                   "write per min_interval_seconds. A long turn would otherwise "
                   "leave the transcript empty for its whole duration.",
    "Stop": "Re-renders after every assistant turn, unthrottled, so the file "
            "stays current even if the session is never closed cleanly.",
    "SessionEnd": "Final render of the session transcript.",
}

for event in ("SessionStart", "PostToolUse", "Stop", "SessionEnd"):
    entries = hooks.setdefault(event, [])
    if any(h.get("name") == "session-recorder"
           for e in entries for h in e.get("hooks", [])):
        continue
    entries.append({
        "_why": "Optional session recording. " + WHY[event] +
                " Renders Claude's real transcript rather than reconstructing "
                "from hook events, which would lose the assistant's prose. "
                "Control with /recording.",
        "hooks": [{"type": "command", "name": "session-recorder",
                   "command": cmd, "timeout": 15000}]})

settings.write_text(json.dumps(cfg, indent=2) + "\n")
WIRE
fi

# .gitignore is appended to, not replaced.
if [ -f "$PAYLOAD/gitignore.append" ]; then
  if [ -f "$target/.gitignore" ] && grep -q "Claude Code" "$target/.gitignore" 2>/dev/null; then
    echo "  skip (present) .gitignore entries"
  else
    say "append         .gitignore"
    $dry || cat "$PAYLOAD/gitignore.append" >> "$target/.gitignore"
  fi
fi

echo
if $dry; then
  echo "Dry run complete. Nothing was written."
else
  echo "Done."
fi
cat <<'NEXT'

Next step — this installs shared doctrine only. The project-specific half is
still empty:

  cd <project>
  claude
  /project-init

That command reads the codebase, interviews you layer by layer, writes the
project CLAUDE.md and rules, and presents what it covers until you confirm it.

Not installed with --with-recording and want session transcripts later? Re-run
this installer with the flag; it adds only what is missing.
NEXT
