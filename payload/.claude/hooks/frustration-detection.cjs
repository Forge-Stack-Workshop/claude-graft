#!/usr/bin/env node
/**
 * Frustration Detection — UserPromptSubmit hook.
 *
 * Detects frustration/debug markers or continuation requests in prompts
 * and injects context that adjusts Claude's response style.
 *
 * Hook type: UserPromptSubmit
 * Does NOT block (exit 0 always). Injects context via stdout JSON using the
 * current schema: { hookSpecificOutput: { hookEventName, additionalContext } }.
 *
 * @tag @[claude-opus-4-8]
 *
 * Config: reads frustrationKeywords / continuationKeywords / frustrationInjection /
 * continuationInjection from .claude/config/hooks-config.json → frustrationDetection
 * (bilingual FR/EN). Configured keywords are matched IN ADDITION to the built-in
 * English regex fallback, so French prompts ("ça marche pas", "reprends") trigger too.
 */

"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "../../");
const CONFIG_PATH = path.join(ROOT, ".claude", "config", "hooks-config.json");

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8")).frustrationDetection ?? {};
  } catch {
    return {};
  }
}

// ── Built-in English fallback patterns (used alongside configured keywords) ─────
const FRUSTRATION_PATTERNS = [
  /\bwhy (?:isn'?t|doesn'?t|won'?t|can'?t|don'?t)\b/i,
  /\bstill (?:not|broken|failing|wrong)\b/i,
  /\b(?:again|still|yet again|once more)\b.*(?:wrong|broken|fail)/i,
  /\b(?:ugh|argh|wtf|ffs|come on|seriously)\b/i,
  /\bnothing works?\b/i,
  /\bi(?:'ve)? (?:tried|already tried)\b/i,
  /\bplease just\b/i,
  /[!]{2,}/,
];

const CONTINUATION_PATTERNS = [
  /^\s*(?:continue|keep going|go on|proceed|finish(?:ing)?|next step|and then[?]?)\s*[.!?]*\s*$/i,
  /\bfinish (?:this|it|the (?:task|work|implementation))\b/i,
  /\bdon['']?t (?:stop|summarize|repeat|recap)\b/i,
];

const DEBUG_PATTERNS = [
  /\b(?:debug|traceback|stacktrace|stack trace|error:|exception:|error message)\b/i,
  /\b(?:why is |what is causing |what caused |root cause)\b/i,
  /\b(?:failing|crashes|broken pipeline)\b/i,
];

// ── Matching helpers ──────────────────────────────────────────────────────────
function matchesPatterns(text, patterns) {
  return patterns.some((p) => p.test(text));
}

function matchesKeywords(text, keywords) {
  if (!Array.isArray(keywords)) return false;
  const lower = text.toLowerCase();
  return keywords.some((k) => k && lower.includes(String(k).toLowerCase()));
}

// ── Context injection builders (config text wins, English fallback otherwise) ───
function frustrationContext(prompt, cfg) {
  if (cfg.frustrationInjection) return cfg.frustrationInjection;
  return [
    "The user seems frustrated or stuck. Adjust your response accordingly:",
    "- Be extremely direct and concise. No preamble, no recap.",
    "- Go straight to the root cause and the minimal fix.",
    "- Do not suggest alternatives unless directly asked.",
    "- Maximum 5 sentences unless code is necessary.",
    "- If you are uncertain, say so in one sentence and give the most likely answer.",
    `Original prompt: ${prompt}`,
  ].join("\n");
}

function continuationContext(prompt, cfg) {
  if (cfg.continuationInjection) return cfg.continuationInjection;
  return [
    "The user wants you to continue without restarting or summarizing.",
    "- Pick up exactly where you left off.",
    "- Do not recap what was already done.",
    "- Do not re-introduce the task.",
    "- Continue directly with the next action.",
    `Original prompt: ${prompt}`,
  ].join("\n");
}

function debugContext(prompt) {
  return [
    "The user is sharing a debug signal (error, traceback, failure).",
    "- Lead with the root cause in one sentence.",
    "- Then provide the minimal fix or next diagnostic step.",
    "- Do not restate the error text back to the user.",
    "- Keep the response focused and actionable.",
    `Original prompt: ${prompt}`,
  ].join("\n");
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

  const cfg = loadConfig();
  if (cfg.enabled === false) {
    process.exit(0);
  }

  const prompt = event?.prompt ?? event?.user_prompt ?? "";
  if (!prompt) {
    process.exit(0);
  }

  let injected = null;

  if (
    matchesKeywords(prompt, cfg.continuationKeywords) ||
    matchesPatterns(prompt, CONTINUATION_PATTERNS)
  ) {
    injected = continuationContext(prompt, cfg);
  } else if (
    matchesKeywords(prompt, cfg.frustrationKeywords) ||
    matchesPatterns(prompt, FRUSTRATION_PATTERNS)
  ) {
    injected = frustrationContext(prompt, cfg);
  } else if (matchesPatterns(prompt, DEBUG_PATTERNS)) {
    injected = debugContext(prompt);
  }

  if (injected) {
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "UserPromptSubmit",
          additionalContext: injected,
        },
      }) + "\n"
    );
    process.stderr.write(`[frustration-detection] Context injected\n`);
  }

  process.exit(0);
});
