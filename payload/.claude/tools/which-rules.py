#!/usr/bin/env python3
"""Report which .claude/rules would actually load for a given project.

    python3 .claude/tools/which-rules.py [project-dir]

Rules without `paths:` load every session. Rules with `paths:` load only when
Claude reads a matching file — so a rule whose globs match nothing in the
project is inert, and one whose target files do not exist yet never fires at
the moment you would need it.
"""
from __future__ import annotations
import sys, os, fnmatch, re
from pathlib import Path

SKIP = {".git", "node_modules", ".venv", "__pycache__", "dist", "build", "site", ".mypy_cache"}


def expand_braces(pat: str) -> list[str]:
    m = re.search(r"\{([^{}]*)\}", pat)
    if not m:
        return [pat]
    out = []
    for alt in m.group(1).split(","):
        out += expand_braces(pat[: m.start()] + alt + pat[m.end():])
    return out


def frontmatter_paths(text: str) -> list[str] | None:
    if not text.startswith("---\n"):
        return None
    end = text.find("\n---", 4)
    if end == -1:
        return None
    block = text[4:end]
    if not re.search(r"^paths:\s*$", block, re.M):
        return None
    return re.findall(r'^\s*-\s*"?([^"\n]+)"?\s*$', block, re.M)


def project_files(root: Path) -> list[str]:
    files = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP]
        for f in filenames:
            rel = os.path.relpath(os.path.join(dirpath, f), root)
            files.append(rel.replace(os.sep, "/"))
    return files


def matches(pattern: str, files: list[str]) -> list[str]:
    hits = []
    for pat in expand_braces(pattern):
        # "**/x" should also match "x" at the root, as Claude Code does.
        variants = {pat}
        if pat.startswith("**/"):
            variants.add(pat[3:])
        for f in files:
            if any(fnmatch.fnmatch(f, v) for v in variants):
                hits.append(f)
    return sorted(set(hits))


def main() -> int:
    root = Path(sys.argv[1] if len(sys.argv) > 1 else ".").resolve()
    rules_dir = root / ".claude" / "rules"
    if not rules_dir.is_dir():
        print(f"no .claude/rules in {root}", file=sys.stderr)
        return 1

    files = project_files(root)
    always, scoped, inert = [], [], []

    for rf in sorted(rules_dir.glob("*.md")):
        text = rf.read_text()
        lines = len(text.splitlines())
        pats = frontmatter_paths(text)
        if pats is None:
            always.append((rf.name, lines))
            continue
        hits = [h for p in pats for h in matches(p, files)]
        (scoped if hits else inert).append((rf.name, lines, sorted(set(hits))))

    print(f"project: {root}\n")
    total = sum(l for _, l in always)
    print(f"ALWAYS LOADED — {len(always)} rules, {total} lines in every session")
    for n, l in always:
        print(f"  {n:<24} {l:>4} lines")

    print(f"\nSCOPED, WILL FIRE — {len(scoped)} rules")
    for n, l, hits in scoped:
        print(f"  {n:<24} {l:>4} lines   {len(hits)} matching file(s), e.g. {hits[0]}")

    print(f"\nINERT — {len(inert)} rules match nothing here")
    for n, l, _ in inert:
        print(f"  {n:<24} {l:>4} lines")
    if inert:
        print("\n  An inert rule costs no context. But if it governs a file the")
        print("  project should have and does not, it will not fire when that file")
        print("  is created either — that content belongs in a skill.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
