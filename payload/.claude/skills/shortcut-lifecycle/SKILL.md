---
name: shortcut-lifecycle
description: |
  Gestion complète du cycle de vie des tickets Shortcut (stories, epics, iterations,
  objectives) — de la création à la clôture, avec ou sans intégration GitHub.
  Trois garde-fous : (1) anti-doublon hybride (filtre lexical + jugement sémantique)
  AVANT toute création, (2) formatting maison des titres/descriptions via templates
  Conventional-Commit, (3) transitions d'état gouvernées (R2, confirmation avant écriture).
  Déclencheurs : « crée un ticket Shortcut », « add a story », « bouge la story en review »,
  « formate/template ce ticket », « gère les epics/iterations/objectives Shortcut »,
  « lie cette PR GitHub à la story ».
---

# Shortcut lifecycle — tickets sans doublons, formatés, gouvernés

Pilote un item de travail Shortcut sur toute sa durée de vie. Lecture = R0 (libre),
écriture = R2 (create / update / move / link → confirmation avant chaque écrit, dry-run).

## Quand utiliser

- Créer une story/epic sans en ouvrir un doublon.
- Normaliser titre + description (templates `feat`/`fix`/`chore`…).
- Faire avancer une story dans le workflow (backlog → in progress → review → done).
- Rattacher une branche/PR GitHub à une story, que l'intégration native soit active ou non.
- Gérer epics, iterations, objectives (lister, référencer, créer sans doublon).

## Quand NE PAS utiliser

- Sync de masse Notion ↔ GitHub → `functional/notion-github-bridge`.
- Ordonnancement de sprint / budget d'énergie → `functional/sprint-orchestrator`.
- Scoring go/no-go d'une idée avant ticket → `functional/idea-value-scorer`.

## Setup (une fois)

- Exporter `SHORTCUT_API_TOKEN` (Shortcut → Settings → API Tokens). Jamais en dur.
- Scripts stdlib Python 3, exécutés sur l'hôte (ni conteneur ni venv) :
  - `scripts/shortcut_api.py` — client REST (read : search/workflows/epics/iterations/objectives/members ; write : create/update/move/comment/task/link_github)
  - `scripts/dedup.py` — ranker lexical + classification par seuils
  - `scripts/format_story.py` — normalisation titre + rendu template
  - `templates/*.md` — squelettes de description par type de commit

## Workflow

### 1. Création (anti-doublon → format → create)

1. **Signature** : régler `raw_title`, le type visé (feat/fix/…), l'`epic_id` cible
   (`shortcut_api.py epics` si inconnu).
2. **Search** — au moins une requête titre + une requête mots-clés (les paraphrases doivent
   remonter), puis fusionner par `id` :
   ```bash
   python3 scripts/shortcut_api.py search 'title:"<mots-clés>"'
   python3 scripts/shortcut_api.py search '<3-5 mots-clés saillants>'
   ```
3. **Filtre lexical** :
   ```bash
   echo '{"title":"<titre>","epic_id":<id-ou-null>,"candidates":[...stories fusionnées...]}' \
     | python3 scripts/dedup.py
   ```
   Renvoie `best_score`, `verdict`, top candidats.
4. **Jugement sémantique (étage LLM = toi)** — lire les top candidats et décider si l'un est
   *le même travail*, même à score mi-bande. Un doublon peut sortir à 0.5 (paraphrase totale),
   un non-doublon à 0.8 (mêmes mots, scope différent). Dire lequel et pourquoi.
5. **Gate** : `duplicate` (ou doublon sémantique jugé) → **ne pas créer**, montrer la story
   existante (`app_url`). `ambiguous`/incertain → **demander** create-vs-link. `unique` +
   aucun match sémantique → continuer.
6. **Format** :
   ```bash
   echo '{"raw_title":"<titre brut>","default_type":"feat","values":{"context":"...","goal":"..."}}' \
     | python3 scripts/format_story.py
   ```
   Renvoie `name` normalisé (`feat: ...`) + `description` templatée.
7. **Create** (après confirmation R2, en écho titre + epic) :
   ```bash
   python3 -c 'from scripts.shortcut_api import ShortcutClient; \
     print(ShortcutClient().create_story(name="feat: ...", description="""...""", extra={"epic_id": 42}))'
   ```

### 2. Vie du ticket (transitions d'état — R2)

- Résoudre l'id d'état cible : `shortcut_api.py workflows` (map nom → `workflow_state_id`).
- Avancer : `ShortcutClient().move_state(story_id=..., workflow_state_id=...)`.
- Enrichir sans changer d'état : `update_story` (owner_ids, labels, iteration_id, epic_id),
  `add_comment`, `add_task`.
- Chaque transition = un écrit → confirmer avant, rapporter après (id + nouvel état).

### 3. Intégration GitHub (optionnelle)

- **Intégration native active** : nommer la branche avec `sc-<story_id>` (ex.
  `feat/sc-1234-oauth`) — Shortcut lie et déplace l'état automatiquement. Rien à faire côté skill.
- **Intégration absente** : `ShortcutClient().link_github(story_id=..., url="<url PR/branche>")`
  ajoute le lien externe manuellement. Le cycle de vie reste complet sans GitHub.

### 4. Epics / iterations / objectives

Lister via `shortcut_api.py epics|iterations|objectives`, référencer par `id`. Même discipline
search-first avant de créer un *nouvel* epic/objective (une requête titre + inspection).

## Inputs

- `SHORTCUT_API_TOKEN` (env), le titre brut, le type de commit visé, epic/iteration cible,
  valeurs du template, éventuelle URL GitHub.

## Outputs

- Décision anti-doublon (`unique`/`ambiguous`/`duplicate` + justification sémantique).
- Story créée/mise à jour (id + url + état) ou pointeur vers la story existante.

## Garde-fous

- Search = R0 ; create/update/move/link = R2 → confirmer avant chaque écrit.
- Seuils dans `dedup.py` (`_DUPLICATE_THRESHOLD` 0.85, `_AMBIGUOUS_THRESHOLD` 0.60) — se
  règlent là, pas en dur au call site.
- Ne jamais inventer un `workflow_state_id`/`epic_id` : lister d'abord, utiliser un id réel.
- Types de commit = liste `_KNOWN_TYPES` dans `format_story.py` ; un nouveau template = un
  fichier `templates/<type>.md` (données, pas de code).
- API injoignable / token absent = `ShortcutError` typée → rapporter, ne jamais sauter le
  check anti-doublon et créer quand même.

## Related skills

- `functional/notion-github-bridge` — sync Sprint Board Notion ↔ GitHub.
- `functional/sprint-orchestrator` — séquencement de sprint.
- `functional/idea-value-scorer` — go/no-go avant de créer le ticket.

## References

- `references/api-cheatsheet.md` — endpoints Shortcut v3 utilisés + shape des payloads.
