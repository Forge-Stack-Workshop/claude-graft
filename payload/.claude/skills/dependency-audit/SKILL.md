---
name: dependency-audit
description: |
  Audit dépendances Python (pip-audit) + Node (npm audit) d'un repo. Enrichit
  avec : (1) flag des packages non-maintenus > 12 mois (last commit upstream),
  (2) cross-référence CVE × reachability (la fonction vulnérable est-elle
  réellement appelée dans ton code ?), (3) tri par CVSS × exploitability
  contextuelle. Triggers FR : "audit dépendances", "vérifie les CVE",
  "deps obsolètes", "pip-audit", "npm audit", "scan sécurité libs",
  "lib non maintenue".
version: 0.1.0
category: functional
adrs: []
status: scaffolded
---

## Quand utiliser

- Avant chaque `release-ritual` (rituel pré-release)
- Hebdomadaire en scheduled task (cf. `agent-config/scheduled-tasks/dep-audit.yaml`)
- Quand on remarque un projet avec dépendances figées depuis longtemps (chrysa-lib, doc-gen)
- Avant de promouvoir un projet Opportuniste → Actif (santé deps obligatoire)

## Quand NE PAS utiliser

- Pour scanner du code applicatif (utiliser `senior-python-reviewer` ou Bandit/Semgrep)
- Pour des projets sans gestionnaire de paquets standard (Bash scripts, etc.)
- Pour scanner des images Docker base (utiliser Trivy à la place)

## Workflow

1. **Détecter les sources de deps**
   - Python : `pyproject.toml`, `requirements.txt`, `requirements-*.txt`, `Pipfile.lock`, `poetry.lock`
   - Node : `package.json`, `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`
   - GHA : `.github/workflows/*.yml` (versions Action pinned vs latest)

2. **Scan vulnérabilités (CVE)**
   - Python : `pip-audit --format=json`
   - Node : `npm audit --json` ou `pnpm audit --json`
   - GHA : check `actions/<name>@<sha>` à pinné via SHA et pas tag (sécurité)

3. **Scan maintenance**
   - Pour chaque dep : last release date depuis registry (PyPI / npm)
   - Last commit date upstream depuis GitHub repo (si lien dispo)
   - **Stale** si :
     - Last release > 12 mois ET pas de commits upstream depuis 6 mois
     - OU repo upstream archivé / GitHub flag `archived: true`

4. **Reachability check**
   - Pour chaque CVE découverte : la fonction vulnérable est-elle dans le code ?
   - Heuristique simple : grep + AST scan de la fonction CVE dans `src/`
   - Si non-reachable : `SEV: NONE` (CVE existe mais pas exploitée localement)
   - Si reachable : conserver CVSS d'origine

5. **Scoring final**
   - `priority = CVSS × reachability_factor × maintenance_factor`
   - `reachability_factor` : 1.0 si reachable, 0.1 sinon
   - `maintenance_factor` : 1.0 si dep maintenue, 1.5 si stale (urgence migration)

6. **Output rapport**
   - Section `🔴 P0 (CVSS ≥ 7 · reachable)` — fix immédiat
   - Section `🟠 P1 (CVSS 4-7 OU stale critique)` — fix prochain sprint
   - Section `🟡 P2 (CVSS < 4 · non-reachable)` — backlog
   - Section `🔵 INFO (deps OK)` — récap version/dates

## Inputs

- `repo_path` (str)
- `severity_threshold` (enum) — `P0 | P1 | P2` (default `P1` : exit code != 0 si trouve)
- `skip_reachability` (bool, default false) — skip si gros repo, accélère

## Outputs

- Rapport `dependency-audit-<repo>-<date>.md`
- Exit code 0 si rien ≥ threshold, 1 sinon (CI-friendly)
- (optionnel) Issues GitHub auto-créées pour les P0 (`gh issue create --label security`)

## Cas réels chrysa connus

### Exemple 1 · doc-gen `python-jose`

Connu HOME chrysa § 🔴 Maintenant : "Fix 2h (python-jose→joserfc)".

Findings attendus :

```text
🔴 P0 · python-jose@3.3.0
  - CVE-2024-XXXX · CVSS 7.5 · JWS algorithm confusion (reachable: oui)
  - Maintenance · last release > 18 mois · upstream archived
  - Fix · migrer vers joserfc==1.x (drop-in API)
  - Effort · ~1-2h (signatures similaires)
```

### Exemple 2 · live-plateform deps fraîches

Findings attendus :

```text
🟢 INFO · 16/16 deps Python OK (PyPI < 6 mois, 0 CVE).
🟢 INFO · 22/22 deps Node OK.
🟡 P2 · `mermaid@10.9.0` peut bumper vers 11.x (cosmetic, non-breaking).
```

### Exemple 3 · Action GitHub non-pinned

Findings :

```text
🟠 P1 · .github/workflows/ci.yml utilise `actions/checkout@v4` (tag) au lieu de SHA.
  Risque : supply chain attack (release v4 modifiable par mainteneur).
  Fix : pin SHA · `actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1`
```

## Related skills

- `release-ritual` (pré-release : audit obligatoire)
- `senior-python-reviewer` (peut référencer ce skill si PR touche pyproject)
- `mcp-config-doctor` (audit des MCPs ≈ deps externes critiques)

## References (à venir post-promotion)

- `references/cve-databases.md` · sources (NVD, GitHub Advisory, PyPI Advisory)
- `references/stale-rules.md` · règles "stale" calibrées par écosystème
- `references/known-fix-paths.md` · catalogue des migrations connues (python-jose→joserfc, etc.)
- `scripts/audit.py` · CLI : `dep-audit <repo> [--severity P0|P1|P2]`
- `scripts/auto-issue.sh` · `gh issue create` pour les P0
