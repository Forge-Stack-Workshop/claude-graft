#!/usr/bin/env node
/**
 * Enforce Spec + Plan — PreToolUse hook (blocking).
 *
 * Blocks any source-code modification (Write/Edit/MultiEdit) unless the
 * current feature has BOTH an approved spec and an approved plan.
 *
 * Workflow enforced:
 *   1. /spec <feature>       -> reports/specs/<feature>.md   (status: draft)
 *   2. human review          -> set frontmatter status: approved
 *   3. /plan <feature>       -> reports/plans/<feature>.md   (status: draft)
 *   4. human review          -> set frontmatter status: approved
 *   5. /implement <feature>  -> code edits now allowed
 *
 * Feature resolution (in priority order):
 *   1. .claude/.active-feature file (single line: the feature slug)
 *   2. git branch name feature/<slug>|fix/<slug>|chore/<slug> -> <slug>
 *
 * Exit codes:
 *   0 = allow   2 = block (stderr shown to Claude)
 *
 * Paths always allowed (so artefacts and config can be created/edited):
 *   reports/specs/, reports/plans/, .claude/, and non-source files.
 *
 * @tag @[claude-opus-4-8]
 */

"use strict";

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// Only these file roots are treated as "source code" and thus gated.
// Agnostic defaults for a project-neutral template; tune per project.
const GATED_ROOTS = ["src/", "lib/", "app/", "internal/", "pkg/", "cmd/"];

// Extensions considered source code (defensive; combined with GATED_ROOTS).
const SOURCE_EXTS = [
	".py", ".pyi", ".js", ".jsx", ".ts", ".tsx", ".go", ".rs", ".java", ".kt",
	".rb", ".php", ".cs", ".cpp", ".c", ".h", ".hpp", ".swift", ".scala",
];

// Paths that must never be blocked (needed to bootstrap the workflow).
const ALWAYS_ALLOWED_PREFIXES = ["reports/specs/", "reports/plans/", ".claude/"];

function readActiveFeature(cwd) {
	const p = path.join(cwd, ".claude", ".active-feature");
	try {
		const slug = fs.readFileSync(p, "utf8").trim();
		return slug || null;
	} catch {
		return null;
	}
}

function readBranchFeature(cwd) {
	try {
		const branch = execSync("git rev-parse --abbrev-ref HEAD", {
			cwd,
			encoding: "utf8",
			stdio: ["ignore", "pipe", "ignore"],
		}).trim();
		const m = branch.match(/^(?:feature|fix|chore|hotfix|release)\/(.+)$/);
		return m ? m[1].replace(/\//g, "-") : null;
	} catch {
		return null;
	}
}

/** Parse a leading YAML-ish frontmatter block and return its `status` value. */
function frontmatterStatus(filePath) {
	let content;
	try {
		content = fs.readFileSync(filePath, "utf8");
	} catch {
		return null; // missing file
	}
	const m = content.match(/^---\s*\n([\s\S]*?)\n---/);
	if (!m) return "no-frontmatter";
	const statusLine = m[1].split("\n").find((l) => /^status\s*:/.test(l.trim()));
	if (!statusLine) return "no-status";
	return statusLine.split(":")[1].trim().toLowerCase();
}

function toRelative(cwd, filePath) {
	const abs = path.isAbsolute(filePath) ? filePath : path.join(cwd, filePath);
	return path.relative(cwd, abs).split(path.sep).join("/");
}

function isGated(rel) {
	if (ALWAYS_ALLOWED_PREFIXES.some((p) => rel.startsWith(p))) return false;
	const ext = path.extname(rel);
	const underGatedRoot = GATED_ROOTS.some((r) => rel.startsWith(r));
	return underGatedRoot && SOURCE_EXTS.includes(ext);
}

function block(message) {
	process.stderr.write(`[enforce-spec-plan] BLOCKED\n${message}\n`);
	process.exit(2);
}

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
	if (!["Write", "Edit", "MultiEdit"].includes(toolName)) process.exit(0);

	const cwd = event?.cwd ?? process.cwd();
	const filePath = event?.tool_input?.file_path ?? event?.tool_input?.path ?? "";
	if (!filePath) process.exit(0);

	const rel = toRelative(cwd, filePath);
	if (!isGated(rel)) process.exit(0);

	const feature = readActiveFeature(cwd) ?? readBranchFeature(cwd);
	if (!feature) {
		block(
			`No active feature detected.\n` +
				`  Editing "${rel}" requires an approved spec + plan.\n` +
				`  -> Create a branch feature/<slug> (or write .claude/.active-feature),\n` +
				`     then run /spec <slug> and /plan <slug>.`,
		);
	}

	const specPath = path.join(cwd, "reports", "specs", `${feature}.md`);
	const planPath = path.join(cwd, "reports", "plans", `${feature}.md`);
	const specStatus = frontmatterStatus(specPath);
	const planStatus = frontmatterStatus(planPath);

	const problems = [];
	if (specStatus === null) problems.push(`spec missing: reports/specs/${feature}.md — run /spec ${feature}`);
	else if (specStatus !== "approved")
		problems.push(
			`spec not approved (status: ${specStatus}) — review reports/specs/${feature}.md then set 'status: approved'`,
		);

	if (planStatus === null) problems.push(`plan missing: reports/plans/${feature}.md — run /plan ${feature}`);
	else if (planStatus !== "approved")
		problems.push(
			`plan not approved (status: ${planStatus}) — review reports/plans/${feature}.md then set 'status: approved'`,
		);

	if (problems.length > 0) {
		block(
			`Feature "${feature}" is not ready for implementation.\n` +
				problems.map((p) => `  - ${p}`).join("\n") +
				`\n  Editing "${rel}" is blocked until spec AND plan are approved.`,
		);
	}

	process.exit(0);
});
