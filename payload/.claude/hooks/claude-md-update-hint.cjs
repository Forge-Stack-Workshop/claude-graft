#!/usr/bin/env node
"use strict";
/**
 * claude-md-update-hint — Stop hook (non-blocking, fail-open).
 *
 * When a response ends, nudge the model to capture durable learnings into
 * CLAUDE.md while the session is still fresh — but only when the session likely
 * changed something worth recording: it counts touched files in this git repo's
 * working tree and only hints when there are some. The moment right after work
 * is the cheapest time to write down a convention; later it is archaeology.
 *
 * Emits `additionalContext` on stdout. NEVER blocks (exit 0 always). Idempotent:
 * writes nothing, only suggests.
 *
 * Wire it in .claude/settings.json:
 *   "Stop": [{
 *     "hooks": [{ "type": "command", "name": "claude-md-update-hint",
 *       "command": "sh -c 'f=\"$CLAUDE_PROJECT_DIR/.claude/hooks/claude-md-update-hint.cjs\"; [ ! -f \"$f\" ] || node \"$f\"'",
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
	let stopHookActive = false;
	try {
		const evt = JSON.parse(fs.readFileSync(0, "utf8") || "{}");
		cwd = evt.cwd || (evt.workspace && evt.workspace.current_dir) || cwd;
		stopHookActive = Boolean(evt.stop_hook_active);
	} catch {
		/* default cwd */
	}

	// Avoid re-entrancy: if this Stop was itself triggered by a hook, do nothing.
	if (stopHookActive) {
		process.exit(0);
	}

	const changed = git(cwd, "status --porcelain").split("\n").filter(Boolean).length;
	if (!changed) {
		process.exit(0);
	}

	const hasClaudeMd = fs.existsSync(path.join(cwd, "CLAUDE.md"));
	const target = hasClaudeMd ? "CLAUDE.md" : "a new CLAUDE.md";
	const msg =
		`This session touched ${changed} file(s). If it surfaced a durable convention, ` +
		`gotcha, or decision, consider recording it in ${target} now while it is fresh — ` +
		`only if it will matter next time, not routine edits.`;

	const out = { hookSpecificOutput: { hookEventName: "Stop", additionalContext: msg } };
	process.stdout.write(JSON.stringify(out));
	process.exit(0);
}

try {
	main();
} catch {
	process.exit(0);
}
