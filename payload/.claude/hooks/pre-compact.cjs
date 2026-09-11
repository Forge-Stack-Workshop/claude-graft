#!/usr/bin/env node
"use strict";
/**
 * pre-compact — PreCompact hook (non-blocking, fail-open).
 *
 * Just before Claude Code compacts the conversation, write a small snapshot to
 * .claude/state/pre-compact.json (cwd, git branch, HEAD, dirty file list, time).
 * Compaction is where fresh detail is most easily lost; a durable marker of
 * "where we were" survives it and can be re-read after.
 *
 * NEVER blocks: any error → exit 0. Writes at most one small file.
 *
 * Wire it in .claude/settings.json:
 *   "PreCompact": [{
 *     "hooks": [{ "type": "command", "name": "pre-compact",
 *       "command": "sh -c 'f=\"$CLAUDE_PROJECT_DIR/.claude/hooks/pre-compact.cjs\"; [ ! -f \"$f\" ] || node \"$f\"'",
 *       "timeout": 5000 }]
 *   }]
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

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
		const evt = JSON.parse(fs.readFileSync(0, "utf8") || "{}");
		cwd = evt.cwd || (evt.workspace && evt.workspace.current_dir) || cwd;
	} catch {
		/* default cwd */
	}

	const dirty = git(cwd, "status --porcelain")
		.split("\n")
		.filter(Boolean)
		.slice(0, 50);

	const snapshot = {
		at: new Date().toISOString(),
		cwd,
		branch: git(cwd, "branch --show-current"),
		head: git(cwd, "rev-parse --short HEAD"),
		dirty,
	};

	const stateDir = path.join(cwd, ".claude", "state");
	try {
		fs.mkdirSync(stateDir, { recursive: true });
		fs.writeFileSync(path.join(stateDir, "pre-compact.json"), JSON.stringify(snapshot, null, 2) + "\n");
	} catch {
		/* best-effort only */
	}
	process.exit(0);
}

try {
	main();
} catch {
	process.exit(0);
}
