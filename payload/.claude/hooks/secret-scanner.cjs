#!/usr/bin/env node
/**
 * Secret Scanner — PreToolUse hook.
 *
 * Two nets:
 *   1. Write/Edit/MultiEdit — scans the content about to be written.
 *   2. Bash `git commit`    — scans staged files via `git diff --cached`.
 *
 * Hook type: PreToolUse — target: Write|Edit|MultiEdit|Bash
 * Exit code 2 blocks the action with the message on stdout.
 *
 * @tag @[claude-sonnet-4-6]
 *
 * Configuration:
 *   SS_ALLOWLIST_FILE  - path to JSON allowlist (default: .claude/secret-scanner-allowlist.json)
 *   SS_EXTRA_PATTERNS  - JSON array of additional regex strings to check
 *
 * Allowlist format:
 *   { "patterns": ["regex1", "regex2"], "files": ["path/to/file"] }
 *
 * Pragma to skip a line:
 *   # nosecret
 *   // nosecret
 */

"use strict";

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// ── Secret patterns ───────────────────────────────────────────────────────────
const BUILTIN_PATTERNS = [
  // Anthropic
  { name: "Anthropic API key", pattern: /sk-ant-[a-zA-Z0-9\-_]{20,}/ },
  // OpenAI
  { name: "OpenAI API key", pattern: /sk-[a-zA-Z0-9]{20,}(?!ant-)/ },
  // AWS
  { name: "AWS Access Key ID", pattern: /AKIA[0-9A-Z]{16}/ },
  {
    name: "AWS Secret Access Key",
    pattern:
      /(?i:aws.{0,20}secret.{0,20})['"=:\s]+([A-Za-z0-9\/+=]{40})\b/,
  },
  // GitHub
  {
    name: "GitHub token",
    pattern: /gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{82}/,
  },
  // Slack
  { name: "Slack token", pattern: /xox[baprs]-[0-9A-Za-z\-]{10,}/ },
  // Stripe
  { name: "Stripe secret key", pattern: /sk_live_[0-9a-zA-Z]{24,}/ },
  {
    name: "Stripe restricted key",
    pattern: /rk_live_[0-9a-zA-Z]{24,}/,
  },
  // JWT (with real payload — skip short test tokens)
  {
    name: "JWT token",
    pattern: /eyJ[A-Za-z0-9\-_]{10,}\.eyJ[A-Za-z0-9\-_]{10,}\.[A-Za-z0-9\-_]{10,}/,
  },
  // PEM / RSA private key
  { name: "PEM private key", pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY/ },
  // Generic high-entropy secrets (loose heuristic, last resort)
  {
    name: "Generic secret assignment",
    pattern:
      /(?:password|passwd|secret|token|api_?key|auth_?key)\s*[:=]\s*['"][A-Za-z0-9\/+=\-_.]{16,}['"]/i,
  },
];

// ── Configuration ──────────────────────────────────────────────────────────────
function loadAllowlist() {
  const allowlistPath =
    process.env.SS_ALLOWLIST_FILE ??
    (function () {
      const dir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
      const local = path.join(dir, ".claude", "secret-scanner-allowlist.json");
      if (fs.existsSync(local)) return local;
      return process.env.CLAUDE_PLUGIN_ROOT
        ? path.join(process.env.CLAUDE_PLUGIN_ROOT, "secret-scanner-allowlist.json")
        : local;
    })();
  try {
    const raw = fs.readFileSync(allowlistPath, "utf8");
    return JSON.parse(raw);
  } catch {
    return { patterns: [], files: [] };
  }
}

function loadExtraPatterns() {
  try {
    const extra = JSON.parse(process.env.SS_EXTRA_PATTERNS ?? "[]");
    return extra.map((p, i) => ({
      name: `extra-pattern-${i}`,
      pattern: new RegExp(p),
    }));
  } catch {
    return [];
  }
}

// ── Scanning logic ─────────────────────────────────────────────────────────────
function getStagedDiff() {
  try {
    return execSync("git diff --cached --unified=0", {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch {
    return "";
  }
}

function scanDiff(diff, allPatterns, allowlist) {
  const findings = [];
  const allowedPatternRegexes = (allowlist.patterns ?? []).map(
    (p) => new RegExp(p)
  );

  const lines = diff.split("\n");
  let currentFile = "";

  for (const line of lines) {
    // Track current file
    if (line.startsWith("+++ b/")) {
      currentFile = line.slice(6).trim();
      continue;
    }
    // Only scan added lines
    if (!line.startsWith("+") || line.startsWith("+++")) continue;

    // Skip pragma
    if (/nosecret/i.test(line)) continue;

    // Skip allowlisted files
    if ((allowlist.files ?? []).some((f) => currentFile.includes(f))) continue;

    const content = line.slice(1); // remove leading +

    for (const { name, pattern } of allPatterns) {
      if (pattern.test(content)) {
        // Check allowlist patterns
        if (allowedPatternRegexes.some((ap) => ap.test(content))) continue;

        findings.push({
          file: currentFile,
          rule: name,
          line: content.trim().slice(0, 120),
        });
        break; // one finding per line is enough
      }
    }
  }
  return findings;
}

// ── Write-time scanning ───────────────────────────────────────────────────────
/**
 * Extract the text a Write/Edit/MultiEdit call is about to put on disk.
 */
function extractWrittenContent(toolInput) {
  const parts = [];
  if (typeof toolInput?.content === "string") parts.push(toolInput.content);
  if (typeof toolInput?.new_string === "string") parts.push(toolInput.new_string);
  for (const e of toolInput?.edits ?? []) {
    if (typeof e?.new_string === "string") parts.push(e.new_string);
  }
  return parts.join("\n");
}

/**
 * Scan raw content (not a diff) for secrets. Same allowlist and pragma rules.
 */
function scanContent(content, filePath, allPatterns, allowlist) {
  const findings = [];
  if ((allowlist.files ?? []).some((f) => filePath.includes(f))) return findings;
  const allowedPatternRegexes = (allowlist.patterns ?? []).map((p) => new RegExp(p));

  for (const line of content.split("\n")) {
    if (/nosecret/i.test(line)) continue;
    for (const { name, pattern } of allPatterns) {
      if (pattern.test(line)) {
        if (allowedPatternRegexes.some((ap) => ap.test(line))) continue;
        findings.push({ file: filePath, rule: name, line: line.trim().slice(0, 120) });
        break;
      }
    }
  }
  return findings;
}

/**
 * Emit findings and block the tool call.
 */
function blockWith(findings, headline) {
  const out = [
    headline,
    "Remove the secret, or mark the line with a 'nosecret' comment (test",
    "fixtures only), or allowlist it in .claude/secret-scanner-allowlist.json.",
    "",
  ];
  for (const f of findings) {
    out.push(`  [${f.rule}] in ${f.file}`);
    out.push(`    \u2192 ${f.line}`);
  }
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: out.join("\n"),
      },
    }) + "\n"
  );
  process.exit(0);
}

// ── Hook entry point ──────────────────────────────────────────────────────────
let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => (raw += chunk));
process.stdin.on("end", () => {
  let event = {};
  try {
    event = JSON.parse(raw);
  } catch {
    process.exit(0);
  }

  const toolName = event?.tool_name ?? "";
  const toolInput = event?.tool_input ?? {};
  const cmd = toolInput?.command ?? toolInput?.input ?? "";

  const isWrite = /^(Write|Edit|MultiEdit|NotebookEdit)$/.test(toolName);
  const isCommit = toolName === "Bash" && /\bgit\s+commit\b/.test(cmd);

  if (!isWrite && !isCommit) {
    process.exit(0);
  }

  const allowlist = loadAllowlist();
  const allPatterns = [...BUILTIN_PATTERNS, ...loadExtraPatterns()];

  // Net 1: content about to be written.
  if (isWrite) {
    const content = extractWrittenContent(toolInput);
    if (!content) process.exit(0);
    const filePath = toolInput?.file_path ?? toolInput?.notebook_path ?? "(unknown)";
    const findings = scanContent(content, filePath, allPatterns, allowlist);
    if (findings.length === 0) process.exit(0);
    blockWith(findings, "\uD83D\uDD10 SECRET SCANNER: refusing to write a secret to disk.");
  }

  // Net 2: staged diff at commit time.
  const diff = getStagedDiff();

  if (!diff) {
    process.exit(0);
  }

  const findings = scanDiff(diff, allPatterns, allowlist);

  if (findings.length === 0) {
    process.exit(0);
  }

  // Build a readable report
  const lines = [
    "🔐 SECRET SCANNER: Potential secrets detected in staged files.",
    "Commit blocked. Review the findings below and either:",
    "  1. Remove the secret from the file",
    "  2. Add 'nosecret' comment on the line (for test fixtures only)",
    "  3. Add the file/pattern to .claude/secret-scanner-allowlist.json",
    "",
  ];
  for (const f of findings) {
    lines.push(`  [${f.rule}] in ${f.file}`);
    lines.push(`    → ${f.line}`);
  }
  lines.push("");

  process.stdout.write(
    JSON.stringify({ type: "result", output: lines.join("\n") }) + "\n"
  );
  process.exit(2);
});
