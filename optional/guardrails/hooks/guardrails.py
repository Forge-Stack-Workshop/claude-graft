#!/usr/bin/env python3
"""PreToolUse guardrails (matcher: Bash) — config-driven, fails open.

Two cheap, early-exiting checks driven by the Bash command string, both
configured in `.claude/guardrails.config.json` so the same code is agnostic:

1. gh-account guardrail — block a MUTATING `gh` command when the cwd's origin
   belongs to one of your configured orgs but the ACTIVE gh account is not the
   required one. Prevents pushing/merging as the wrong account. Inert unless
   `gh_account.required_account` is set and `gh_account.orgs` is non-empty.

2. pytest reminder — non-blocking. When a `pytest` invocation is missing any of
   your configured flags, inject a reminder (e.g. `-p no:query_optimizer`,
   `--no-cov`). Purely advisory.

Reads the hook JSON on stdin, writes a PreToolUse decision on stdout.
Fails open: any internal error, or a missing/placeholder config -> allow.
Never wedge the session.
"""
import json
import os
import re
import subprocess
import sys
from pathlib import Path


def _emit(obj: dict) -> None:
    print(json.dumps({"hookSpecificOutput": {"hookEventName": "PreToolUse", **obj}}))


def _run(args: list[str]) -> str:
    try:
        return subprocess.run(
            args, capture_output=True, text=True, timeout=4
        ).stdout.strip()
    except Exception:
        return ""


def _load_config() -> dict:
    # Look beside the project first, then next to this script (plugin root).
    candidates = []
    proj = os.environ.get("CLAUDE_PROJECT_DIR")
    if proj:
        candidates.append(Path(proj) / ".claude" / "guardrails.config.json")
    candidates.append(Path(__file__).resolve().parent.parent / "guardrails.config.json")
    candidates.append(Path(__file__).resolve().parent / "guardrails.config.json")
    for c in candidates:
        try:
            if c.is_file():
                return json.loads(c.read_text())
        except Exception:
            continue
    return {}


def main() -> None:
    try:
        data = json.load(sys.stdin)
    except Exception:
        return
    cmd = (data.get("tool_input") or data).get("command", "") or ""
    cfg = _load_config()

    # --- Check 1: gh-account guardrail ---
    gh = cfg.get("gh_account") or {}
    required = gh.get("required_account")
    orgs = [o for o in (gh.get("orgs") or []) if o and not o.startswith("<")]
    if required and not required.startswith("<") and orgs:
        mutating = re.search(
            r"\bgh\s+(pr|issue|repo|release|api|run|workflow|secret|label)\b", cmd
        ) and re.search(
            r"\b(merge|create|edit|close|delete|comment|ready|rerun|dispatch|"
            r"cancel|set|put|post|patch|--admin|-X\s+(POST|PUT|PATCH|DELETE))\b",
            cmd,
        )
        if mutating:
            origin = _run(["git", "remote", "get-url", "origin"])
            org_re = "|".join(re.escape(o) for o in orgs)
            if re.search(rf"[:/]({org_re})/", origin):
                status = _run(["gh", "auth", "status"])
                # gh auth status lists every account; pick the one whose block
                # carries "Active account: true", not merely the first listed.
                acct = None
                for line in status.splitlines():
                    m = re.search(r"account\s+(\S+)\s+\(", line)
                    if m:
                        candidate = m.group(1)
                    elif re.search(r"Active account:\s+true", line):
                        acct = candidate
                if acct and acct != required:
                    _emit({
                        "permissionDecision": "deny",
                        "permissionDecisionReason": (
                            f"guardrail: active gh account is '{acct}' but this "
                            f"repo belongs to a configured org ({origin}). "
                            f"Switch first: `gh auth switch --user {required}`."
                        ),
                    })
                    return

    # --- Check 2: pytest reminder (non-blocking) ---
    pr = cfg.get("pytest_reminder") or {}
    flags = [f for f in (pr.get("flags") or []) if f]
    if pr.get("enabled") and flags and re.search(r"\bpytest\b", cmd):
        missing = [f for f in flags if f not in cmd]
        if missing:
            _emit({
                "permissionDecision": "allow",
                "permissionDecisionReason": (
                    "pytest reminder: this project may need "
                    + ", ".join(f"`{f}`" for f in missing)
                    + ". Add if required; ignore otherwise."
                ),
            })
            return


if __name__ == "__main__":
    main()
