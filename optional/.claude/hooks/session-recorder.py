#!/usr/bin/env python3
"""Session recorder — renders the live transcript to a readable Markdown file.

Wired to three events in settings.json:

  SessionStart  emits a digest of the previous session as additional context,
                so a developer returning to the project is back in context
                without re-reading anything.
  PostToolUse   re-renders while a turn is still running, at most once every
                `min_interval_seconds`. A long turn would otherwise write
                nothing for its whole duration.
  Stop          re-renders after every assistant turn, unthrottled.
  SessionEnd    final render.

Reads the real transcript JSONL rather than reconstructing from hook payloads:
assistant prose appears in neither UserPromptSubmit nor PostToolUse, so a
reconstruction would silently lose half the exchange.

What comes out is the **conversation**: what the human typed and what Claude put
on the screen, in order. Reasoning, tool calls and their results are left out —
they are how the answer was produced, not the answer, and they bury the exchange
a reader came for.

Configuration: .claude/session-recording.json
  { "enabled": true, "paused": false, "output_dir": "docs/sessions",
    "redact": ["extra regex"], "digest_lines": 60 }
"""
from __future__ import annotations
import json, os, re, sys, time
from datetime import datetime, timezone
from pathlib import Path

DEFAULTS = {
    "enabled": False,
    "paused": False,
    "output_dir": "docs/sessions",
    "redact": [],
    "digest_lines": 60,
    "min_interval_seconds": 120,
}

REDACT = [
    (re.compile(r"sk-ant-[A-Za-z0-9\-_]{20,}"), "[redacted:anthropic-key]"),
    (re.compile(r"\bAKIA[0-9A-Z]{16}\b"), "[redacted:aws-key-id]"),
    (re.compile(r"gh[pousr]_[A-Za-z0-9]{36,}"), "[redacted:github-token]"),
    (re.compile(r"xox[baprs]-[0-9A-Za-z\-]{10,}"), "[redacted:slack-token]"),
    (re.compile(r"eyJ[A-Za-z0-9\-_]{10,}\.eyJ[A-Za-z0-9\-_]{10,}\.[A-Za-z0-9\-_]{10,}"),
     "[redacted:jwt]"),
    (re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----"), "[redacted:private-key]"),
]


def load_config(project: Path) -> dict:
    """Project config first, then the devkit reached via CLAUDE_PLUGIN_ROOT.

    In a workspace the doctrine lives in one repository, so its settings do
    too — nothing is duplicated at the workspace root.
    """
    cfg = dict(DEFAULTS)
    candidates = [project / ".claude" / "session-recording.json"]
    if root := os.environ.get("CLAUDE_PLUGIN_ROOT"):
        candidates.append(Path(root) / "session-recording.json")
    for f in candidates:
        if f.is_file():
            try:
                cfg.update(json.loads(f.read_text()))
            except json.JSONDecodeError:
                pass
            break
    return cfg


def scrub(text: str, extra: list[str]) -> str:
    for pattern, repl in REDACT:
        text = pattern.sub(repl, text)
    for raw in extra:
        try:
            text = re.sub(raw, "[redacted]", text)
        except re.error:
            pass
    return text


def blocks(content) -> list[dict]:
    return content if isinstance(content, list) else []


SYSTEM_NOISE = re.compile(
    r"<(system-reminder|command-name|command-message|command-args|"
    r"local-command-stdout|local-command-stderr)>.*?</\1>",
    re.S)


def spoken(row: dict) -> tuple[str, str] | None:
    """What was actually said, or None for anything that was not speech.

    A transcript is the conversation: what the human typed and what Claude put
    on the screen. Not the reasoning, not the tool calls, not the results they
    returned — those are how the answer was produced, not the answer.
    """
    if row.get("type") not in ("user", "assistant"):
        return None
    if row.get("isSidechain"):          # a subagent's conversation, not this one
        return None

    message = row.get("message") or {}
    role = message.get("role")
    content = message.get("content")

    if role == "user":
        if not isinstance(content, str):
            # A list here is tool results being handed back, not the human.
            texts = [b.get("text", "") for b in blocks(content)
                     if b.get("type") == "text"]
            if not texts:
                return None
            content = "\n".join(texts)
        text = SYSTEM_NOISE.sub("", content).strip()
        return ("Human", text) if text else None

    if role == "assistant":
        # `thinking` is reasoning and `tool_use` is machinery; neither reached
        # the screen.
        texts = [b["text"] for b in blocks(content)
                 if b.get("type") == "text" and b.get("text", "").strip()]
        return ("Claude", "\n\n".join(t.strip() for t in texts)) if texts else None

    return None


def render(transcript: Path, cfg: dict) -> str:
    turns: list[tuple[str, str]] = []
    started = None

    for line in transcript.read_text(errors="replace").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            row = json.loads(line)
        except json.JSONDecodeError:
            continue
        if started is None and row.get("timestamp"):
            started = row["timestamp"]
        said = spoken(row)
        if said is None:
            continue
        # One speaker may produce several blocks in a turn; read as one.
        if turns and turns[-1][0] == said[0]:
            turns[-1] = (said[0], turns[-1][1] + "\n\n" + said[1])
        else:
            turns.append(said)

    body = []
    for speaker, text in turns:
        icon = "\U0001F9D1" if speaker == "Human" else "\U0001F916"
        body.append(f"\n### {icon} {speaker} says\n\n{text}\n")

    header = [
        "<!-- Generated by the session recorder — do not hand-edit. -->",
        f"# Session — {started or 'unknown start'}",
        "",
        f"{len(turns)} turns. What was said, in order: the prompts and the",
        "replies as they appeared on screen. The steps taken to produce them —",
        "reasoning, tool calls, their results — are deliberately absent.",
        "",
        "Secrets matching the recorder's patterns are redacted; that is a net,",
        "not a guarantee. Read before sharing.",
        "",
    ]
    return scrub("\n".join(header) + "".join(body) + "\n", cfg["redact"])


def digest(out_dir: Path, current: Path, cfg: dict) -> str | None:
    files = sorted((p for p in out_dir.glob("*.md")
                    if p.name != "INDEX.md" and p != current),
                   key=lambda p: p.stat().st_mtime, reverse=True)
    if not files:
        return None
    tail = files[0].read_text(errors="replace").splitlines()[-cfg["digest_lines"]:]
    return (f"Previous session transcript: `{files[0]}`.\n"
            "Tail of that session, for context:\n\n" + "\n".join(tail))


def write_index(out_dir: Path) -> None:
    rows = sorted((p for p in out_dir.glob("*.md") if p.name != "INDEX.md"),
                  key=lambda p: p.name, reverse=True)
    lines = ["# Session transcripts", "",
             "Generated by the session recorder. Newest first.", ""]
    lines += [f"- [{p.stem}]({p.name})" for p in rows]
    (out_dir / "INDEX.md").write_text("\n".join(lines) + "\n")


def main() -> int:
    try:
        event = json.load(sys.stdin)
    except Exception:
        return 0

    project = Path(os.environ.get("CLAUDE_PROJECT_DIR") or event.get("cwd") or ".")
    cfg = load_config(project)
    if not cfg["enabled"] or cfg["paused"]:
        return 0

    event_name = event.get("hook_event_name")
    transcript = event.get("transcript_path")
    session = (event.get("session_id") or "unknown")[:8]
    out_dir = project / cfg["output_dir"]
    out_dir.mkdir(parents=True, exist_ok=True)
    target = out_dir / f"{datetime.now().strftime('%Y-%m-%d')}-{session}.md"

    if event_name == "SessionStart":
        text = digest(out_dir, target, cfg)
        if text:
            print(json.dumps({"hookSpecificOutput": {
                "hookEventName": "SessionStart", "additionalContext": text}}))
        return 0

    if not transcript or not Path(transcript).is_file():
        return 0

    # Mid-turn renders are throttled; the end of a turn always writes, so the
    # file is never more than one turn behind whatever the throttle skipped.
    if event_name == "PostToolUse" and target.is_file():
        age = time.time() - target.stat().st_mtime
        if age < cfg["min_interval_seconds"]:
            return 0

    target.write_text(render(Path(transcript), cfg))
    write_index(out_dir)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
