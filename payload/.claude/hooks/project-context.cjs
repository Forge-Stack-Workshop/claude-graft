#!/usr/bin/env node
// SessionStart hook — nudges Claude to establish project identity before work.
//
// _why: a skill only fires if Claude chooses to invoke it. This hook does a
// cheap identity read (git remote org -> family/profile) and injects it as
// context, then points at the project-context skill for the full detection.
// Never blocks: always exit 0. No secret, no network, no write.

const { execFileSync } = require("node:child_process");

// No shell: fixed argv, so nothing from git output is ever interpreted.
function git(...args) {
  try {
    return execFileSync("git", args, { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "";
  }
}

// org (from remote) -> [family, graft profile]
const FAMILIES = {
  chrysa: ["chrysa fleet", "chrysa-fleet"],
  "Easter-Eggs-Farm": ["Easter-Eggs-Farm", "easter-eggs"],
  frogscollective: ["frogscollective", "frogs"],
  "Rural-Assistant-Integration-Nature": ["RAIN (config read-only)", "rain"],
  Optiways: ["padam-av (employer — separate ecosystem)", "—"],
};

const remote = git("remote", "get-url", "origin");
const branch = git("branch", "--show-current");

let line;
if (!remote) {
  line = "No git remote — provisional identity from directory. Apply CORE only; ask before assuming a standard.";
} else {
  const m = remote.match(/[:/]([^/]+)\/[^/]+?(?:\.git)?$/);
  const org = m ? m[1] : "";
  const fam = FAMILIES[org];
  line = fam
    ? `Family: ${fam[0]} | profile: ${fam[1]} | branch: ${branch || "?"}`
    : `Unknown org '${org}' — treat as unknown project: detect stack, apply CORE, ask before assuming a standard.`;
}

const context =
  `[project-context] ${line}\n` +
  `Invoke the project-context skill to confirm stack, modules and standards before the first edit. ` +
  `Never modify RAIN's or padam-av's Claude config.`;

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: context,
    },
  })
);
process.exit(0);
