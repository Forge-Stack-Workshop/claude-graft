#!/usr/bin/env node
"use strict";
/**
 * error-tracker — PostToolUse(Bash) hook (non-blocking, fail-open).
 *
 * Records failed Bash commands to .claude/state/command-errors.jsonl so a run of
 * failures is visible for triage instead of scrolling back. Append-only, capped;
 * writes nothing on success.
 *
 * NEVER blocks (exit 0 always). Reads the PostToolUse payload; tolerant of shape
 * drift (unknown fields ignored).
 *
 * Wire it in .claude/settings.json under PostToolUse:
 *   { "matcher": "Bash",
 *     "hooks": [{ "type": "command", "name": "error-tracker",
 *       "command": "sh -c 'f=\"$CLAUDE_PROJECT_DIR/.claude/hooks/error-tracker.cjs\"; [ ! -f \"$f\" ] || node \"$f\"'",
 *       "timeout": 5000 }] }
 */

const fs = require("fs");
const path = require("path");

const MAX_LINES = 500;

function main() {
	let evt = {};
	try {
		evt = JSON.parse(fs.readFileSync(0, "utf8") || "{}");
	} catch {
		process.exit(0);
	}

	const cwd = evt.cwd || (evt.workspace && evt.workspace.current_dir) || process.cwd();
	const resp = evt.tool_response || evt.toolResponse || {};

	// A command "failed" when the payload reports a non-zero exit or an error.
	const exitCode = resp.exitCode ?? resp.exit_code ?? resp.code;
	const errored = resp.error || resp.is_error || (typeof exitCode === "number" && exitCode !== 0);
	if (!errored) {
		process.exit(0);
	}

	const input = evt.tool_input || evt.toolInput || {};
	const record = {
		at: new Date().toISOString(),
		command: (input.command || "").slice(0, 500),
		exitCode: typeof exitCode === "number" ? exitCode : null,
		error: String(resp.error || resp.stderr || "").slice(0, 500),
	};

	const stateDir = path.join(cwd, ".claude", "state");
	const file = path.join(stateDir, "command-errors.jsonl");
	try {
		fs.mkdirSync(stateDir, { recursive: true });
		fs.appendFileSync(file, JSON.stringify(record) + "\n");
		// Trim to the last MAX_LINES to keep the log bounded.
		const lines = fs.readFileSync(file, "utf8").split("\n").filter(Boolean);
		if (lines.length > MAX_LINES) {
			fs.writeFileSync(file, lines.slice(-MAX_LINES).join("\n") + "\n");
		}
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
