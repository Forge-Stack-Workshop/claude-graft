#!/usr/bin/env node
"use strict";
/**
 * Graphify Sync — PostToolUse hook (file writes).
 *
 * CLAUDE.md asks to run `graphify update .` after modifying code so the
 * knowledge graph stays current. This hook does it automatically instead
 * of relying on the agent to remember — fire-and-forget, AST-only, no API
 * cost per the graphify skill instructions.
 *
 * Hook type: PostToolUse — target: Write, Edit, MultiEdit
 * Does NOT block and does NOT wait for graphify to finish (detached, exit 0
 * immediately). Best-effort: skips silently if graphify or graphify-out/
 * are absent.
 *
 * @tag @[claude-opus-4-8]
 */

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const ROOT = path.resolve(__dirname, "../../");
const CONFIG_PATH = path.join(ROOT, ".claude", "config", "hooks-config.json");
const GRAPH_FILE = path.join(ROOT, "graphify-out", "graph.json");

function loadConfig() {
	try {
		return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8")).graphifySync;
	} catch {
		return { enabled: true, logFile: ".claude/state/graphify-sync.log" };
	}
}

function main() {
	let raw = "";
	process.stdin.setEncoding("utf8");
	process.stdin.on("data", (chunk) => {
		raw += chunk;
	});
	process.stdin.on("end", () => {
		const cfg = loadConfig() ?? {};
		if (cfg.enabled === false) process.exit(0);

		let event = {};
		try {
			event = JSON.parse(raw);
		} catch {
			process.exit(0);
		}

		if (!["Write", "Edit", "MultiEdit"].includes(event?.tool_name ?? "")) process.exit(0);

		const filePath = event?.tool_input?.file_path ?? event?.tool_input?.path ?? "";
		if (!filePath || path.extname(filePath) !== ".py") process.exit(0);

		const relPath = path.relative(ROOT, filePath);
		if (relPath.startsWith(`.claude${path.sep}`) || relPath.startsWith("..")) process.exit(0);

		if (!fs.existsSync(GRAPH_FILE)) process.exit(0);

		const logPath = path.resolve(ROOT, cfg.logFile ?? ".claude/state/graphify-sync.log");
		fs.mkdirSync(path.dirname(logPath), { recursive: true });
		const logFd = fs.openSync(logPath, "a");

		try {
			const child = spawn("graphify", ["update", "."], {
				cwd: ROOT,
				detached: true,
				stdio: ["ignore", logFd, logFd],
			});
			child.unref();
		} catch {
			// graphify binary unavailable — skip silently
		} finally {
			fs.closeSync(logFd);
		}

		process.exit(0);
	});
}

main();
