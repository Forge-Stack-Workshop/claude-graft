#!/usr/bin/env python3
"""Validate skill payloads before they land in the plugin.

Checks every payload/.claude/skills/<slug>/SKILL.md for:
  - presence of a `---` YAML frontmatter block
  - required keys: name, description (both non-empty)
  - name matches the enclosing directory slug
  - description length within sane bounds (>= 20 chars)
  - no duplicate skill names across the tree

Exit non-zero on any failure. Pure stdlib so it runs in a bare CI image.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

SKILLS_DIR = Path("payload/.claude/skills")
REQUIRED = ("name", "description")
MIN_DESC = 20
SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def parse_frontmatter(text: str) -> tuple[dict[str, str] | None, str | None]:
    """Return (fields, error). Minimal YAML: top-level `key: value` pairs only."""
    if not text.startswith("---"):
        return None, "missing opening '---' frontmatter fence"
    lines = text.splitlines()
    end = None
    for i in range(1, len(lines)):
        if lines[i].strip() == "---":
            end = i
            break
    if end is None:
        return None, "missing closing '---' frontmatter fence"
    fields: dict[str, str] = {}
    key = None
    for raw in lines[1:end]:
        if not raw.strip():
            continue
        m = re.match(r"^([A-Za-z0-9_-]+):\s?(.*)$", raw)
        if m:
            key = m.group(1)
            fields[key] = m.group(2).strip()
        elif key is not None and (raw.startswith(" ") or raw.startswith("\t")):
            # folded continuation line
            fields[key] = (fields[key] + " " + raw.strip()).strip()
    return fields, None


def validate_skill(skill_md: Path) -> list[str]:
    slug = skill_md.parent.name
    errs: list[str] = []
    text = skill_md.read_text(encoding="utf-8")
    fields, err = parse_frontmatter(text)
    if err:
        return [f"{slug}: {err}"]
    assert fields is not None
    for req in REQUIRED:
        if req not in fields or not fields[req]:
            errs.append(f"{slug}: missing or empty required key '{req}'")
    name = fields.get("name", "")
    if name and name != slug:
        errs.append(f"{slug}: frontmatter name '{name}' != directory slug '{slug}'")
    if slug and not SLUG_RE.match(slug):
        errs.append(f"{slug}: slug is not kebab-case")
    desc = fields.get("description", "")
    if desc and len(desc) < MIN_DESC:
        errs.append(f"{slug}: description too short ({len(desc)} < {MIN_DESC} chars)")
    return errs


def main(argv: list[str]) -> int:
    root = Path(argv[1]) if len(argv) > 1 else Path(".")
    skills_dir = root / SKILLS_DIR
    if not skills_dir.is_dir():
        print(f"no skills directory at {skills_dir}", file=sys.stderr)
        return 0
    all_errs: list[str] = []
    names: dict[str, str] = {}
    skill_files = sorted(skills_dir.glob("*/SKILL.md"))
    for skill_md in skill_files:
        errs = validate_skill(skill_md)
        all_errs.extend(errs)
        text = skill_md.read_text(encoding="utf-8")
        fields, _ = parse_frontmatter(text)
        if fields and (n := fields.get("name")):
            if n in names:
                all_errs.append(f"{skill_md.parent.name}: duplicate skill name '{n}' (also in {names[n]})")
            else:
                names[n] = skill_md.parent.name
    print(f"validated {len(skill_files)} skill(s)")
    if all_errs:
        print(f"\n{len(all_errs)} problem(s):", file=sys.stderr)
        for e in all_errs:
            print(f"  - {e}", file=sys.stderr)
        return 1
    print("all skills valid")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
