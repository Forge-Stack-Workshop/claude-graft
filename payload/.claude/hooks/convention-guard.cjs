#!/usr/bin/env node
/**
 * Convention guard — PreToolUse (Write|Edit|MultiEdit).
 *
 * Checks the invariants whose moment of enforcement is identifiable at write
 * time. Everything here WARNS on stderr and lets the write through, except the
 * checks marked `block`, which are invariants whose violation is never
 * intentional.
 *
 * Config: .claude/convention-guard.json  { "disabled": ["check-id"] }
 */
"use strict";
const fs = require("fs");
const path = require("path");

const CHECKS = [
  {
    id: "dev-dockerfile-derives",
    block: true,
    match: (p) => /(^|[\/\\])Dockerfile\.(dev|test|ci)$/.test(p),
    run: (text) => {
      const m = text.match(/^\s*FROM\s+(?!base\b)(?!\$\{?BASE)([^\s]+:[^\s]+)/mi);
      return m && `Dockerfile.dev repeats a pinned base image (\`FROM ${m[1]}\`).\n` +
        `It must derive from the production Dockerfile — \`FROM base\`, with 'base' ` +
        `supplied as a named build context. Repeating the FROM line IS the drift ` +
        `the split exists to prevent: bump one, forget the other, and dev stops ` +
        `mirroring prod silently. See .claude/rules/docker.md.`;
    },
  },
  {
    id: "ci-is-a-thin-caller",
    block: false,
    match: (p) => /\.github[\/\\]workflows[\/\\].*\.ya?ml$/.test(p) && !/release/.test(p),
    run: (text) => {
      if (/\bmake\s+ci\b/.test(text)) return null;
      return `This workflow does not call \`make ci\`.\n` +
        `A workflow that lists its own steps is a second definition of "green", ` +
        `and it drifts from the local one exactly the way two Dockerfiles drift. ` +
        `Make it a thin caller. See .claude/rules/ci.md.`;
    },
  },
  {
    id: "makefile-delegates",
    block: false,
    match: (p) => /(^|[\/\\])(Makefile|.*\.mk)$/.test(p),
    run: (text) => {
      const offenders = [];
      for (const line of text.split("\n")) {
        if (!/^\t/.test(line)) continue;                       // recipe lines only
        if (/\$\(|docker|compose|@?echo|grep|sed|mkdir|rm\b/.test(line)) continue;
        const m = line.match(/^\t@?\s*(pytest|ruff|black|mypy|npm|npx|pnpm|yarn|pip|poetry|uv|mkdocs|go|cargo)\b/);
        if (m) offenders.push(m[1]);
      }
      if (!offenders.length) return null;
      return `Recipe invokes ${[...new Set(offenders)].join(", ")} directly.\n` +
        `A target never does the work itself — it delegates to compose, which runs ` +
        `it in the image. Running it here runs it on the host. ` +
        `See .claude/rules/makefile.md.`;
    },
  },
  {
    id: "no-committed-env",
    block: true,
    match: (p) => /(^|[\/\\])\.env(\.[A-Za-z0-9_-]+)?$/.test(p) && !/\.example$/.test(p),
    run: () => `Writing a \`.env\` file.\n` +
      `Configuration comes from the environment, never from a committed file. ` +
      `Put the variable in \`.env.example\` with a safe placeholder instead. ` +
      `See .claude/rules/environment.md.`,
  },
  {
    id: "generated-api-docs",
    block: true,
    match: (p) => /(^|[\/\\])docs[\/\\]api[\/\\]/.test(p),
    run: () => `\`docs/api/\` is generated from docstrings and never hand-edited.\n` +
      `Fix the docstring instead; the next build would overwrite this anyway. ` +
      `See .claude/rules/mkdocs.md.`,
  },
];


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

function written(input) {
  const parts = [];
  if (typeof input?.content === "string") parts.push(input.content);
  if (typeof input?.new_string === "string") parts.push(input.new_string);
  for (const e of input?.edits ?? []) {
    if (typeof e?.new_string === "string") parts.push(e.new_string);
  }
  return parts.join("\n");
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
  let disabled = [];
  try {
    disabled = JSON.parse(fs.readFileSync(
      resolveConfig("convention-guard.json", projectDir), "utf8")).disabled ?? [];
  } catch { /* no config */ }

  const rel = path.relative(projectDir, path.resolve(projectDir, filePath));
  let text = null;
  const warnings = [];

  for (const check of CHECKS) {
    if (disabled.includes(check.id) || !check.match(rel)) continue;
    if (text === null) {
      text = written(event.tool_input);
      // An Edit sees only its fragment; read the file for whole-file checks.
      if (!text && fs.existsSync(filePath)) text = fs.readFileSync(filePath, "utf8");
    }
    const problem = check.run(text ?? "");
    if (!problem) continue;
    if (check.block) {
      process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "deny",
          permissionDecisionReason: `🚧 ${check.id}: ${problem}`,
        },
      }) + "\n");
      process.exit(0);
    }
    warnings.push(`⚠️  ${check.id}: ${problem}`);
  }
  if (warnings.length) process.stderr.write(warnings.join("\n\n") + "\n");
  process.exit(0);
});
