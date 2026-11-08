---
name: notion-github-bridge
description: |
  Synchronisation bidirectionnelle Sprint Board Notion ↔ GitHub issues/PRs.
  Documente et contourne 2 limitations connues du MCP Notion :
  (1) `update_content` ne peut pas insérer de mention-page de façon fiable,
  (2) workaround = `update_properties` par page ID + `notion-create-pages`
  pour les nouvelles entrées. Synchro pull (GH→Notion) et push (Notion→GH)
  à la demande. Triggers FR : "sync notion github", "ramène les issues",
  "pousse les tâches sur github", "réconcilie sprint board", "synchronise
  les statuts", "issue manquante notion".
version: 0.1.0
category: functional
adrs: []
status: scaffolded
---

## Quand utiliser

- Début de sprint : importer les tâches Notion non-encore-issues GitHub
- Fin de sprint : push les statuts Done depuis GH (PRs mergées) vers Notion
- Quand on remarque une désynchro (issue close GH mais Notion en cours)
- Avant `sprint-orchestrator` (s'assurer que la source est cohérente)
- Avant `release-ritual` (inclure toutes les issues du sprint dans le changelog)

## Quand NE PAS utiliser

- Pour synchroniser autre chose que Sprint Board ↔ issues (ex: Travaux,
  pages Wiki) — out of scope
- Pour des projets externes / non-chrysa
- Pour piloter le contenu (skill = sync, pas décision)

## Workflow

### Pull · GH → Notion (statuts, mergedAt, fermetures)

1. **Lister issues/PRs récemment modifiées par repo**
   - `gh issue list --state all --json number,title,state,closedAt,labels --limit 100 --search "updated:>2026-04-25"`
2. **Mapper issue ↔ page Notion**
   - Convention : titre Notion contient `#<num>` ou un field `URL GitHub`
   - Cache local de la table de correspondance pour éviter scans répétés
3. **Update Notion `update_properties` par page ID**
   - **Ne jamais utiliser `update_content` pour ajouter des mention-pages** (limitation MCP)
   - Champs synchronisés : Status, MergedAt, ClosedAt, labels
4. Si page Notion n'existe pas → ne **PAS** la créer en mode pull (pull = sync, pas import)

### Push · Notion → GH (création d'issues à partir de tâches Spec)

1. **Lister les tâches Notion sans `URL GitHub`** dans le Sprint courant
2. **Créer issue GH** avec `gh issue create --repo chrysa/<repo> --title "<title>" --body "<body>" --label sprint-S<N>`
3. **Update `URL GitHub` dans Notion** via `update_properties`
4. Skip les tâches sans `Repo` field défini (pas de cible)

## Workaround MCP Notion · `update_content` mention-page

Le MCP Notion a une limite connue (avril 2026) : `update_content` ne peut pas
insérer de mention-page de façon fiable. Symptômes :

- La mention apparaît comme texte brut au lieu d'un lien cliquable
- L'opération réussit mais le rendu Notion n'a pas le block mention

**Workaround éprouvé** :

1. Si on a besoin d'insérer une référence vers une autre page :
   - Utiliser un **lien Markdown standard** : `[Title](https://www.notion.so/<page-id-without-dashes>)`
   - C'est rendu comme un lien cliquable dans Notion (pas un mention-block, mais ça marche)
2. Si on a besoin d'une vraie mention-page (avec icon + sync title) :
   - **Ne pas utiliser `update_content`**
   - Utiliser `update_properties` sur un champ de type `relation` (DB only)
   - OU `notion-create-pages` pour créer une nouvelle page avec la mention dans son content initial

3. Si on a besoin de modifier un block mention existant : actuellement
   pas faisable via MCP, à faire à la main dans l'UI Notion.

## Inputs

- `direction` (enum) — `pull | push | both` (default `both`)
- `repos` (list[str], optional) — sous-set de repos à synchroniser
- `sprint_id` (str, optional) — sprint courant si absent
- `dry_run` (bool, default true)

## Outputs

- Rapport sync : `<N>` updates Notion, `<M>` issues créées GH
- Liste des conflits non résolus (page Notion sans repo cible, issue close mais Notion bloquée, etc.)

## Exemples

### Exemple 1 · Sync début de sprint S22

Tâches Notion sprint S22 sans URL GitHub :

- `chrysa-lib · @chrysa/auth bootstrap` (Repo=chrysa-lib)
- `doc-gen PR #1 fix` (Repo=doc-gen)
- `live-plateform v0.2 lot E` (Repo=live-plateform)

Output :

```text
Pull GH → Notion :
  - 12 issues mises à jour (statuts récents)
Push Notion → GH :
  - chrysa/chrysa-lib · issue #2 créée · "@chrysa/auth bootstrap"
  - chrysa/doc-gen · issue #5 créée · "PR #1 fix overdue"
  - chrysa/live-plateform · issue #41 créée · "v0.2 lot E"
URLs GitHub écrites dans Notion (3 pages updated_properties).
```

### Exemple 2 · Conflict non résolu

Tâche Notion `Discordium V3 · stack decision` sans Repo défini.

Output :

```text
🟡 Skip · "Discordium V3 · stack decision" : Repo field vide.
Action : définir Repo=discordium-v3 dans Notion (créer le repo si absent
via repo-bootstrap), puis re-sync.
```

## Related skills

- `sprint-orchestrator` (consomme le Sprint Board · besoin de cohérence avant)
- `release-ritual` (génère le changelog depuis issues fermées · pull en amont)
- `repo-bootstrap` (peut créer un nouveau repo si Notion référence un repo absent)

## References (à venir post-promotion)

- `references/notion-mcp-limits.md` · catalogue des limitations Notion MCP avril 2026 + workarounds
- `references/sync-mapping.md` · table de correspondance Notion fields ↔ GitHub
- `scripts/sync.py` · CLI : `notion-github-bridge --pull --push`
