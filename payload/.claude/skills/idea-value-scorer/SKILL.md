---
name: idea-value-scorer
description: |
  Score standalone valeur/effort/risque sur une idée, un ticket ou une
  feature. Logique réutilisable hors DEV Nexus (chrysa-lib utilise pour
  prioriser un Sprint, briefing-agent pour proposer des actions). Format
  de sortie : score `A1-A5 / B1-B5 / C1-C5` (lettre = valeur, chiffre =
  effort) + risque modificateur + justification 3 lignes max. Triggers FR :
  "score cette idée", "vaut le coup ?", "valeur effort risque", "priorise
  cette feature", "tâche prioritaire ?", "impact estimé".
version: 0.1.0
category: functional
adrs: []
status: scaffolded
---

## Quand utiliser

- Triage d'un nouveau ticket Notion (avant ajout au Sprint Board)
- Décision de continuer/arrêter une feature en cours
- Ranking d'un backlog (consommé par `sprint-orchestrator`)
- Évaluation d'une idée brute (briefing-agent matin)
- Avant de promouvoir Opportuniste → Actif (cf. `portfolio-triage`)

## Quand NE PAS utiliser

- Pour scorer une décision technique (utiliser ADR à la place)
- Pour des tâches < 30 min (overhead trop grand · juste les faire)
- Pour des bugs critiques bloquants (P0 par essence, pas besoin de scorer)

## Workflow

1. **Charger l'input**
   - Texte libre (idée brute) OU ticket Notion fetché OU feature description
2. **Évaluer 3 dimensions**

   ### Valeur (A · B · C)

   | Lettre | Définition | Exemples |
   |--------|------------|----------|
   | **A** | Débloque ≥ 2 projets downstream OU livrable user-facing critique | chrysa-lib auth · doc-gen PR fix |
   | **B** | Améliore 1 projet significativement OU réduit dette > 5h | live-plateform charts · pre-commit propagate |
   | **C** | Nice-to-have OU expérimentation | Borne arcade décor · skin Discordium |

   ### Effort (1 · 2 · 3 · 4 · 5)

   | Chiffre | Heures | Confiance estimation |
   |---------|--------|----------------------|
   | **1** | < 1h | 95% |
   | **2** | 1-3h | 85% |
   | **3** | 3-8h (1 sprint) | 70% |
   | **4** | 8-20h (2-3 sprints) | 50% |
   | **5** | > 20h (4+ sprints) | 30% |

   ### Risque (modificateur ±0/-1/-2)

   | Modificateur | Définition | Exemples |
   |--------------|------------|----------|
   | **0** | Stack maîtrisée, dépendances stables, scope clair | FastAPI endpoint standard |
   | **-1** | Stack partiellement nouvelle OU dépendance externe non éprouvée | Nouveau MCP, nouvelle lib npm |
   | **-2** | Stack inconnue OU dépendance critique externe OU scope flou | Tauri, Phaser 3, Bedrock + tools mode |

3. **Output structuré**

   ```text
   Score : A2 (-1) · effort 1-3h · risque dépendance externe
   Justification :
   - Débloque @chrysa/auth qui bloque 4 projets downstream
   - Effort réel observé sur features auth similaires (1h auth/provider)
   - Risque -1 car aucun OAuth Google précédent dans le portfolio
   ```

4. **Cas particuliers**
   - **Bloquant P0** (overdue 7+ jours) : score forcé `A1` quel que soit l'effort
   - **Tech debt isolée** : minimum `B3`, pas en dessous (sinon jamais fait)
   - **Vision long terme** (Auberges High-Tech) : score `C5 (-2)` toujours, hors compétition sprint

## Format de sortie

```text
SCORE: <Letter><Digit> [(<RiskModifier>)]

JUSTIFICATION (3 lignes max):
  - <bullet 1>
  - <bullet 2>
  - <bullet 3 si nécessaire>

NEXT-ACTION (1 ligne):
  <ce qu'il faut faire concrètement, ou "ranger en backlog si effort > sprint dispo">
```

## Inputs

- `idea` (str) — description libre de l'idée / ticket
- `context` (dict, optional) — `{repo, projects_blocked, sprint_capacity_hours}` pour pondérer
- `notion_page_id` (str, optional) — fetcher l'idée depuis Notion

## Outputs

- Score formaté (parsable par `sprint-orchestrator`)
- Justification 3 bullets max
- Next-action 1 ligne

## Exemples

### Exemple 1 · "Faut-il cabler Sentry sur live-plateform ?"

```text
SCORE: B3 (-1)

JUSTIFICATION:
  - Améliore observabilité 1 projet (live-plateform), pas downstream impact direct
  - Effort 3-8h (Sentry SDK + config DSN + test events)
  - Risque -1 : Sentry pas déjà installé sur d'autres projets chrysa, premier plug

NEXT-ACTION:
  Si Sentry déjà cablé sur ≥ 1 autre repo chrysa → faire ce sprint. Sinon
  reporter post-MVP live-plateform.
```

### Exemple 2 · "Migrer doc-gen de python-jose vers joserfc"

```text
SCORE: A1

JUSTIFICATION:
  - PR #1 overdue 19j car python-jose unmaintained → débloquer Actif urgent
  - Effort < 1h (drop-in replacement, signatures API similaires)
  - Risque 0 : joserfc activement maintenu, recommandation officielle

NEXT-ACTION:
  Faire MAINTENANT. Ouvrir PR de fix dans doc-gen, merger même solo.
```

### Exemple 3 · "Borne arcade refresh design custom"

```text
SCORE: C5 (-2)

JUSTIFICATION:
  - Cosmétique, aucun blocage downstream, projet Opportuniste figé
  - Effort > 20h (3D modeling + plexi cut + assemblage)
  - Risque -2 : skill 3D non maîtrisé, dépendance fournisseur plexi

NEXT-ACTION:
  Backlog Vision long terme. Pas de sprint dédié avant 6 mois.
```

## Related skills

- `sprint-orchestrator` (consomme les scores pour ranker le sprint)
- `portfolio-triage` (utilise les scores pour proposer dégradations)
- `notion-github-bridge` (peut créer issue GH après score validé)

## References (à venir post-promotion)

- `references/scoring-rubric.md` · grille détaillée par lettre/chiffre
- `references/historical-scores.md` · 30 derniers scores + résultat réel (calibration)
- `scripts/score.py` · CLI : `idea-score "<idea>"` ou `idea-score --notion <page-id>`
