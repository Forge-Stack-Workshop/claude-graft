#!/usr/bin/env node
"use strict";
/**
 * session-start — SessionStart hook (non-blocking, fail-open).
 *
 * Injects a short orientation into the session's opening context: repo name,
 * current branch, dirty state, and which .claude/rules files exist. The first
 * prompt then lands with the project's shape already in view, instead of the
 * model rediscovering it.
 *
 * Emits `additionalContext` on stdout. NEVER blocks: any error → exit 0, no output.
 * The hook contract is unstable — unknown payload fields are ignored.
 *
 * Wire it in .claude/settings.json:
 *   "SessionStart": [{
 *     "hooks": [{ "type": "command", "name": "session-start",
 *       "command": "sh -c 'f=\"$CLAUDE_PROJECT_DIR/.claude/hooks/session-start.cjs\"; [ ! -f \"$f\" ] || node \"$f\"'",
 *       "timeout": 5000 }]
 *   }]
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

function readStdin() {
	try {
		return fs.readFileSync(0, "utf8");
	} catch {
		return "";
	}
}

function git(cwd, args) {
	try {
		return execSync(`git ${args}`, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
	} catch {
		return "";
	}
}

function main() {
	let cwd = process.cwd();
	try {
		const evt = JSON.parse(readStdin() || "{}");
		cwd = evt.cwd || (evt.workspace && evt.workspace.current_dir) || cwd;
	} catch {
		/* fall back to process.cwd() */
	}

	const lines = [];
	const repo = path.basename(git(cwd, "rev-parse --show-toplevel") || cwd);
	const branch = git(cwd, "branch --show-current");
	const dirty = git(cwd, "status --porcelain");
	if (repo) {
		lines.push(`Repo: ${repo}${branch ? ` · branch: ${branch}` : ""}${dirty ? " · uncommitted changes present" : " · clean"}`);
	}

	const rulesDir = path.join(cwd, ".claude", "rules");
	try {
		const rules = fs.readdirSync(rulesDir).filter((f) => f.endsWith(".md")).sort();
		if (rules.length) {
			lines.push(`Active rule files (.claude/rules): ${rules.join(", ")}`);
		}
	} catch {
		/* no rules dir */
	}

	if (!lines.length) {
		process.exit(0);
	}

	const out = { hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: lines.join("\n") } };
	process.stdout.write(JSON.stringify(out));
	process.exit(0);
}

try {
	main();
} catch {
	process.exit(0);
}
