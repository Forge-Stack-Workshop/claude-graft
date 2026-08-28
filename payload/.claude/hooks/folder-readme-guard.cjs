#!/usr/bin/env node
/**
 * Folder README guard — PreToolUse (Write|Edit|MultiEdit).
 *
 * Every meaningful folder carries a README.md: role, structure, what belongs
 * there and what does NOT, and the rules that govern it. This hook BLOCKS
 * writing a file into an undocumented folder.
 *
 * The moment a folder is born is the only moment anyone still knows what it
 * was for. Written later, the README is archaeology; written then, it is a
 * decision. That is why this blocks instead of warning.
 *
 * Config: .claude/folder-readme.json
 *   { "enforce": true,          // false => warn without blocking
 *     "roots": [],              // only guard under these paths ([] = all)
 *     "skip": ["extra/dir"] }   // additional folders to ignore
 */
"use strict";
const fs = require("fs");
const path = require("path");

const SKIP_SEGMENTS = new Set([
  ".git", ".github", ".claude", "node_modules", ".venv", "venv", "__pycache__",
  "dist", "build", "site", ".mypy_cache", ".pytest_cache", ".ruff_cache",
  "coverage", "htmlcov", "target", "vendor", ".next", ".idea", ".vscode",
]);

// Files that may land in an undocumented folder: the README itself, and the
// scaffolding that has no folder of its own.
const ALWAYS_ALLOWED = new Set([
  "README.md", "readme.md", "__init__.py", ".gitkeep", ".gitignore",
]);


/**
 * Where a hook's configuration lives.
 *
 * Mono-repo: the project's own .claude/. Workspace: the devkit repository,
 * reached through CLAUDE_PLUGIN_ROOT — the doctrine lives in one repository, so
 * its numbers do too, and nothing is duplicated at the workspace root.
 * The project copy wins when both exist, so a single repository can override.
 */
function resolveConfig(fileName, projectDir) {
  const candidates = [
    path.join(projectDir, ".claude", fileName),
    process.env.CLAUDE_PLUGIN_ROOT
      ? path.join(process.env.CLAUDE_PLUGIN_ROOT, fileName)
      : null,
  ].filter(Boolean);
  return candidates.find((p) => fs.existsSync(p)) ?? candidates[0];
}

function loadConfig(projectDir) {
  const f = resolveConfig("folder-readme.json", projectDir);
  const base = { enforce: true, roots: [], skip: [] };
  try {
    return Object.assign(base, JSON.parse(fs.readFileSync(f, "utf8")));
  } catch {
    return base;
  }
}

function deny(reason) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: reason,
    },
  }) + "\n");
  process.exit(0);
}

let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (c) => (raw += c));
process.stdin.on("end", () => {
  let event;
  try { event = JSON.parse(raw); } catch { process.exit(0); }

  if (!/^(Write|Edit|MultiEdit)$/.test(event.tool_name ?? "")) process.exit(0);

  const filePath = event.tool_input?.file_path;
  if (!filePath) process.exit(0);

  const projectDir = process.env.CLAUDE_PROJECT_DIR || event.cwd || process.cwd();
  const cfg = loadConfig(projectDir);

  const abs = path.resolve(projectDir, filePath);
  const rel = path.relative(projectDir, abs);
  // Outside the project, or the project root itself: not our business.
  if (rel.startsWith("..") || path.isAbsolute(rel)) process.exit(0);

  const dir = path.dirname(abs);
  const dirRel = path.relative(projectDir, dir);
  if (dirRel === "" || dirRel === ".") process.exit(0);   // repo root

  const segments = dirRel.split(path.sep);
  if (segments.some((s) => SKIP_SEGMENTS.has(s) || s.startsWith("."))) process.exit(0);
  if (cfg.skip.some((s) => dirRel === s || dirRel.startsWith(s + path.sep))) process.exit(0);
  if (cfg.roots.length &&
      !cfg.roots.some((r) => dirRel === r || dirRel.startsWith(r + path.sep))) {
    process.exit(0);
  }

  if (ALWAYS_ALLOWED.has(path.basename(abs))) process.exit(0);
  if (fs.existsSync(path.join(dir, "README.md"))) process.exit(0);

  // Editing a file that already exists in an undocumented folder is pre-existing
  // debt, not something this change introduced. Warn, never block.
  const isNewFile = !fs.existsSync(abs);
  const message =
    `Folder '${dirRel}/' has no README.md.\n\n` +
    `Write '${dirRel}/README.md' first — role, structure, what belongs here, ` +
    `what must NOT, and the rules that govern it. Use /folder-readme to scaffold it.\n\n` +
    `The moment a folder is born is the only moment anyone still knows what it ` +
    `was for. Written later it is archaeology.`;

  if (!isNewFile || !cfg.enforce) {
    process.stderr.write("⚠️  " + message + "\n");
    process.exit(0);
  }
  deny("📁 FOLDER README GUARD: " + message);
});
