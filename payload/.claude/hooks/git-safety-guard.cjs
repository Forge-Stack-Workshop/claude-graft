#!/usr/bin/env node
"use strict";
/**
 * Hook 1c – Git Safety GUARD (PreToolUse)
 *
 * Mechanical backstop for the Git Safety Protocol: blocks destructive git
 * subcommands (force push, hard reset, branch -D) before they execute,
 * regardless of what instructed the agent to run them.
 *
 * stdin  : Claude Code PreToolUse JSON payload
 * stdout : JSON { hookSpecificOutput: { permissionDecision: "deny", ... } } when blocking
 * exit 0 : always (decision is carried in the JSON payload, not the exit code)
 *
 * @tag @[claude-opus-4-8]
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "../../");
const CONFIG_PATH = path.join(ROOT, ".claude", "config", "hooks-config.json");

function loadConfig() {
	try {
		return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8")).gitSafetyGuard;
	} catch {
		return { enabled: true, blockOnDetection: true };
	}
}

/**
 * Split a shell command into subcommands on newlines, &&, ||, ; and | so
 * checks don't leak across subcommands — or across quoted text that merely
 * mentions a git invocation (e.g. a PR body, a heredoc, a hook's own test
 * fixture) without actually running one.
 */
function splitSubcommands(command) {
	return command
		.split(/\r?\n|&&|\|\||;|\|/)
		.map((s) => s.trim())
		.filter(Boolean);
}

/** True only if `git` is the actual command being invoked, not just present in the text */
function isGitInvocation(sub) {
	const stripped = sub.replace(/^(?:[A-Za-z_][\w]*=\S*\s+)*/, "");
	return /^(?:\S*\/)?git\b/.test(stripped);
}

const CHECKS = [
	{
		name: "force push",
		test: (sub) => /\bpush\b/.test(sub) && /--force(-with-lease)?\b|(?:^|\s)-f(?:\s|$)/.test(sub),
		reason:
			"Force push overwrites remote history and can destroy others' work. " +
			"Ask the user to confirm explicitly, or run it manually outside Claude.",
	},
	{
		name: "hard reset",
		test: (sub) => /\breset\b/.test(sub) && /--hard\b/.test(sub),
		reason:
			"`git reset --hard` discards uncommitted changes irreversibly. " +
			"Ask the user to confirm explicitly, or run it manually outside Claude.",
	},
	{
		name: "force branch delete",
		test: (sub) => /\bbranch\b/.test(sub) && /(-D\b|--delete\s+--force\b)/.test(sub),
		reason:
			"`git branch -D` force-deletes a branch even with unmerged commits. " +
			"Ask the user to confirm explicitly, or run it manually outside Claude.",
	},
];

function main() {
	let raw = "";
	process.stdin.setEncoding("utf8");
	process.stdin.on("data", (chunk) => {
		raw += chunk;
	});
	process.stdin.on("end", () => {
		const cfg = loadConfig() ?? {};
		if (cfg.enabled === false) process.exit(0);

		let payload = {};
		try {
			payload = JSON.parse(raw);
		} catch {
			process.exit(0);
		}

		if (payload.tool_name !== "Bash") process.exit(0);

		const command = payload?.tool_input?.command ?? "";
		if (!command) process.exit(0);

		const subcommands = splitSubcommands(command).filter(isGitInvocation);
		const hit = subcommands.flatMap((sub) => CHECKS.filter((check) => check.test(sub))).at(0);

		if (!hit) process.exit(0);

		if (cfg.blockOnDetection === false) {
			process.stderr.write(`[git-safety-guard] Warning: detected ${hit.name} — ${hit.reason}\n`);
			process.exit(0);
		}

		const permissionDecisionReason = `[git-safety-guard] Blocked (${hit.name}): ${hit.reason}`;
		process.stderr.write(permissionDecisionReason + "\n");
		process.stdout.write(
			JSON.stringify({
				hookSpecificOutput: {
					hookEventName: "PreToolUse",
					permissionDecision: "deny",
					permissionDecisionReason,
				},
			}),
		);
		process.exit(0);
	});
}

main();
