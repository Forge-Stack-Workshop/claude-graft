#!/usr/bin/env node
"use strict";
/**
 * Graphify Hint — PreToolUse hook (Bash).
 *
 * When the agent is about to run a raw text search (grep/rg/find/fd/ack/ag)
 * and a knowledge graph exists at graphify-out/graph.json, inject a hint to
 * prefer `graphify query "<question>"` (a scoped subgraph, usually much
 * smaller than raw grep output) instead.
 *
 * Non-blocking: only emits `additionalContext`, never denies. Exit 0 always.
 * Extracted from an inline settings.json command for consistency + testability.
 *
 * @tag @[claude-sonnet-4-6]
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "../../");
const GRAPH_FILE = path.join(ROOT, "graphify-out", "graph.json");
const SEARCH_TOOLS = /\b(grep|rg|ripgrep|find|fd|ack|ag)\b/;

const HINT =
	"graphify: knowledge graph at graphify-out/. For focused questions, run " +
	'`graphify query "<question>"` (scoped subgraph, usually much smaller than ' +
	"GRAPH_REPORT.md) instead of grepping raw files. Read GRAPH_REPORT.md only " +
	"for broad architecture context.";

function main() {
	let raw = "";
	process.stdin.setEncoding("utf8");
	process.stdin.on("data", (chunk) => {
		raw += chunk;
	});
	process.stdin.on("end", () => {
		let payload = {};
		try {
			payload = JSON.parse(raw);
		} catch {
			process.exit(0);
		}

		const command = payload?.tool_input?.command ?? payload?.command ?? "";
		if (!SEARCH_TOOLS.test(command)) process.exit(0);
		if (!fs.existsSync(GRAPH_FILE)) process.exit(0);

		process.stdout.write(
			JSON.stringify({
				hookSpecificOutput: {
					hookEventName: "PreToolUse",
					additionalContext: HINT,
				},
			}),
		);
		process.exit(0);
	});
}

main();
