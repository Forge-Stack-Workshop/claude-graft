# MCP agnostique & mises à jour du plugin

Comment les serveurs MCP sont stockés, et comment un projet installé récupère
les nouvelles versions de la doctrine (skills, agents, MCP, hooks).

## 1. Stockage agnostique

Skills, agents et MCP suivent le même chemin : une source de vérité dans
`payload/.claude/`, dérivée dans le plugin par `build-plugin.py`.

| Artefact | Source | Dérivé dans |
| --- | --- | --- |
| skills | `payload/.claude/skills/` (+ rules path-scopées) | `<plugin>/skills/` |
| agents | `payload/.claude/agents/` | `<plugin>/agents/` |
| **mcp** | `payload/.claude/mcp.json` | `plugin.json` → clé `mcpServers` |
| hooks | `payload/.claude/hooks/` | `<plugin>/hooks/` |

`mcp.json` :

```json
{
  "mcpServers": {
    "context7": { "type": "http", "url": "https://mcp.context7.com/mcp" },
    "local": {
      "command": "python3",
      "args": ["$CLAUDE_PROJECT_DIR/.claude/tools/server.py"]
    }
  }
}
```

Au build : les chemins locaux sous `$CLAUDE_PROJECT_DIR/.claude/` sont réécrits
en `${CLAUDE_PLUGIN_ROOT}/…` (même relocation que les hooks). Un `mcp.json` vide
ou absent n'ajoute aucune clé `mcpServers` — la fonctionnalité reste inerte
jusqu'à ce qu'un serveur soit déclaré.

**Secrets : jamais en dur.** Un serveur référence `${ENV_VAR}` ; la variable est
documentée dans `.env.example`. Le scan de secrets s'applique avant tout commit.

## 2. Versioning

La version existe **en un seul endroit : le tag git**, lue par
`template_version()` et écrite dans `plugin.json`. Aucun numéro dupliqué
ailleurs. Skills, agents et MCP partagent donc la même version : ils sont
publiés ensemble, atomiquement.

## 3. Mises à jour automatiques

Point important sur la topologie : le plugin buildé vit **dans le repo du
devkit** (`project-devkit/claude/`), lui-même versionné et poussé avec le
projet. Le marketplace généré utilise `source: "./"`, ce qui est **correct** :
`./` se résout à l'intérieur du checkout du devkit.

L'auto-update ne demande donc **aucune URL git codée en dur** — ce qui violerait
le principe « rien au niveau machine/user, tout dans l'arbre du projet ».

### Flux de publication (côté devkit)

```
edit payload/  →  build  →  git commit  →  git tag vX.Y.Z  →  git push --tags
```

### Flux de récupération (côté projet installé)

```
git pull            # dans le repo du devkit — récupère le nouveau plugin buildé
# Claude relit le marketplace ; la version (tag) supérieure est prise en compte
```

En mono-repo (tout dans `.claude/` du repo), un simple `git pull` suffit : il n'y
a pas de plugin séparé, la doctrine est lue directement depuis l'arbre.

## 4. Correction d'une idée reçue

Une première ébauche affirmait qu'il fallait changer `source: "./"` vers une URL
remote pour permettre l'auto-update. C'est **faux pour ce design** : le devkit
est déjà un repo versionné et poussé ; `./` s'y résout et l'update passe par
`git pull`. Coder une URL en dur casserait la topologie auto-contenue.
