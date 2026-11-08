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
 * Blank single/double-quoted spans so a destructive pattern that lives only
 * inside a quoted argument — a commit message, a PR body, a `-m "…"` string —
 * is neither split on a separator it contains nor mistaken for the git
 * operation itself. Applied before splitting, so `;`/`&&`/`|` inside quotes
 * do not fragment the command.
 */
function stripQuoted(command) {
	return command.replace(/"[^"]*"|'[^']*'/g, " ");
}

/**
 * Split a shell command into subcommands on newlines, &&, ||, ; and | so
 * checks don't leak across subcommands — or across quoted text that merely
 * mentions a git invocation (e.g. a PR body, a heredoc, a hook's own test
 * fixture) without actually running one.
 */
function splitSubcommands(command) {
	return stripQuoted(command)
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
	{
		name: "force push via +refspec",
		// `git push origin +main:main` forces the update with a leading `+` on the
		// refspec — no --force/-f flag, so the flag-based check above misses it.
		test: (sub) => /\bpush\b/.test(sub) && /\s\+[^\s:]+:/.test(sub),
		reason:
			"A `+`-prefixed refspec force-updates the remote ref, same as --force. " +
			"Ask the user to confirm explicitly, or run it manually outside Claude.",
	},
	{
		name: "remote branch delete",
		// `git push --delete` and the colon-refspec form `git push origin :branch`
		// both delete a remote branch.
		test: (sub) =>
			/\bpush\b/.test(sub) && (/--delete\b/.test(sub) || /\s:[^\s:]+(\s|$)/.test(sub)),
		reason:
			"This deletes a remote branch. " +
			"Ask the user to confirm explicitly, or run it manually outside Claude.",
	},
	{
		name: "force clean",
		// `git clean -f`/`-fd`/`-fdx` deletes untracked (and ignored) files irreversibly.
		test: (sub) => /\bclean\b/.test(sub) && /(?:^|\s)-[a-eg-z]*f[a-z]*\b|--force\b/.test(sub),
		reason:
			"`git clean -f` permanently deletes untracked files. " +
			"Ask the user to confirm explicitly, or run it manually outside Claude.",
	},
	{
		name: "force checkout",
		// `git checkout -f` / `git checkout --force` discards local modifications.
		test: (sub) => /\bcheckout\b/.test(sub) && /(?:^|\s)-f\b|--force\b/.test(sub),
		reason:
			"`git checkout -f` discards uncommitted changes irreversibly. " +
			"Ask the user to confirm explicitly, or run it manually outside Claude.",
	},
	{
		name: "gate bypass",
		// --no-verify skips pre-commit/pre-push hooks; --no-gpg-sign skips signing;
		// a leading SKIP= escapes specific pre-commit hooks. `-n` is NOT matched:
		// on `git push` it means --dry-run, which is harmless.
		test: (sub) =>
			(/\b(commit|push)\b/.test(sub) && /--no-verify\b/.test(sub)) ||
			/--no-gpg-sign\b/.test(sub) ||
			/(?:^|\s)SKIP=\S+/.test(sub),
		reason:
			"Skipping a commit/push gate (--no-verify, --no-gpg-sign, SKIP=) defeats " +
			"the pre-commit and CI quality/security controls. Never disable a security " +
			"control to make a gate pass without explicit, traced user approval — fix " +
			"the finding instead.",
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
