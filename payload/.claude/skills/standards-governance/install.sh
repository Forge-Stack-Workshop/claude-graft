#!/usr/bin/env bash
# standards-governance skills — auto-installable bundle.
# Installs the project-agnostic governance skill set into a target agent's
# skills directory. Skills consume a standards canon (configured in config.yaml)
# by reference; they do not embed rule text. On-disk language is English.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

usage() {
  cat <<'EOF'
Usage:
  ./install.sh <target-repo>     Install into <target-repo>/.claude/skills/
  ./install.sh --global          Install into ~/.claude/skills/
  ./install.sh --dir <path>      Install into <path>/ (a skills root)
  ./install.sh --help

What it does:
  Copies each skills/NN-*/SKILL.md as <dest>/<name>/SKILL.md and the shared
  references, GOVERNANCE.md, skills.index.yaml and config (config.yaml if
  present, else config.example.yaml) alongside, so relative links resolve.
  Idempotent: re-running overwrites these skills and leaves your other skills
  untouched. Makes NO git or network changes.
EOF
}

[ $# -ge 1 ] || { usage; exit 2; }

case "${1:-}" in
  --help|-h) usage; exit 0 ;;
  --global)  DEST="${HOME}/.claude/skills" ;;
  --dir)     DEST="${2:?--dir needs a path}" ;;
  *)         DEST="${1%/}/.claude/skills" ;;
esac

PARENT="$(dirname "${DEST}")"
echo "Installing standards-governance skills into: ${DEST}"
mkdir -p "${DEST}" "${PARENT}"

# Shared references + governance live under the skills' parent so SKILL relative
# links (../../shared/..., ../../GOVERNANCE.md) resolve from <dest>/<name>/.
cp -R "${HERE}/shared" "${PARENT}/shared"
cp "${HERE}/GOVERNANCE.md" "${PARENT}/GOVERNANCE.md"
cp "${HERE}/skills.index.yaml" "${PARENT}/skills.index.yaml"
if [ -f "${HERE}/config.yaml" ]; then
  cp "${HERE}/config.yaml" "${PARENT}/config.yaml"
else
  cp "${HERE}/config.example.yaml" "${PARENT}/config.example.yaml"
  echo "  note: no config.yaml found — copied config.example.yaml; copy it to config.yaml and fill it in."
fi

count=0
for d in "${HERE}"/skills/*/; do
  [ -f "${d}SKILL.md" ] || continue
  name="$(awk -F': ' '/^name:/{print $2; exit}' "${d}SKILL.md")"
  [ -n "${name}" ] || name="$(basename "${d}")"
  install -d "${DEST}/${name}"
  cp "${d}SKILL.md" "${DEST}/${name}/SKILL.md"
  count=$((count+1))
  echo "  + ${name}"
done

echo "Installed ${count} skills."
cat <<EOF

Next:
  - Fill in config.yaml (canon location + tooling command names).
  - Ensure one canon path is reachable where the agent runs: the standards CLI,
    the conformity checker, or the target repo's managed standards block / a
    local export.
  - For non-Claude agents, point the agent at ${DEST} (skills are plain Markdown
    with YAML frontmatter) — no agent-specific wiring required.
EOF
