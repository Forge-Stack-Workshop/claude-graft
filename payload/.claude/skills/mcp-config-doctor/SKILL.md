---
name: mcp-config-doctor
description: |
  Diagnostic des MCP Servers configurés (claude.ai · Claude Desktop · Claude
  Code). Lit `agent-config/mcp/config-reference.md` (source de vérité chrysa)
  + `claude_desktop_config.json` local, ping chaque endpoint, flagge les
  expirations de tokens, suggère MAJ depuis le registre MCP officiel.
  Triggers FR : "audit MCP", "diagnostic MCP", "MCP en panne", "tokens MCP
  expirés", "ajouter MCP", "config MCP cohérente", "scanner MCPs".
version: 0.1.0
category: functional
adrs: []
status: scaffolded
---

## Quand utiliser

- Démarrage de session quand un MCP "not found" ou "auth failed"
- Avant `chrysa-bootstrap.sh` `--tokens-wizard` (vérifier ce qui manque)
- Audit mensuel des tokens (rotation pré-expiration)
- Quand on ajoute un nouveau MCP (vérifier qu'il ne duplique pas un existant)
- Quand le briefing-agent flag un MCP indisponible

## Quand NE PAS utiliser

- Pour configurer un MCP nouveau (utiliser `mcp-builder` skill Anthropic à la place)
- Pour debug un MCP custom en cours de dev (utiliser ses logs natifs)
- Pour gérer les credentials des connecteurs Claude.ai (UI uniquement)

## Workflow

1. **Charger les sources de vérité**
   - `chrysa/agent-config/mcp/config-reference.md` · catalogue chrysa officiel des MCPs souhaités
   - `~/.config/Claude/claude_desktop_config.json` · config locale Claude Desktop
   - (optionnel) Variables d'env actuelles pour chaque token attendu

2. **Pour chaque MCP attendu (ref) vs configuré (local)**

   | État | Détection | Action |
   |------|-----------|--------|
   | **OK** | Configuré + ping réussi + token valide | INFO |
   | **Manquant** | Dans ref mais pas dans local | WARN · suggérer ajout |
   | **Configuré mais down** | Présent local mais ping fail | WARN · re-auth ou logs |
   | **Token expirant** | Token valide mais < 30j d'expiration | WARN · suggérer rotation |
   | **Token expiré** | Token rejeté (401/403) | BLOCK · re-auth obligatoire |
   | **Configuré non documenté** | Présent local mais pas dans ref | INFO · documenter ou retirer |

3. **Ping endpoint MCP**
   - HTTP-streamable : `curl -sf <url>/health` ou `<url>/_meta`
   - stdio : `command -v <bin>` + `--version`
   - WebSocket : `wscat -c <url> -x ping`

4. **Détection token expiration**
   - GitHub PAT : `gh api user --jq .login` (échec si expiré)
   - Notion : `curl -H "Authorization: Bearer $NOTION_TOKEN" https://api.notion.com/v1/users/me`
   - Anthropic : `curl https://api.anthropic.com/v1/messages -H "x-api-key: $ANTHROPIC_API_KEY"`
   - Stocker la `created_at` de chaque token dans `~/.config/chrysa/tokens.meta.json` pour calcul d'âge

5. **Cross-ref avec registre MCP**
   - Repo officiel `modelcontextprotocol/servers`
   - Listing claude.ai connectors
   - Suggérer MCP qui matche un besoin récurrent flaggé dans briefing-agent

6. **Output rapport**
   - Sections par sévérité (BLOCK / WARN / INFO)
   - Pour chaque finding : commande exacte de fix copiable

## MCPs chrysa attendus (référence)

Cf. `agent-config/mcp/config-reference.md` (à maintenir en parallèle).
Snapshot 26/04/2026 :

| MCP | Statut attendu | Source |
|-----|---------------|--------|
| Notion | ✅ Actif | claude.ai natif |
| Google Calendar | ✅ Actif | claude.ai natif |
| Gmail | ✅ Actif | claude.ai natif |
| Google Drive | ✅ Actif | claude.ai natif |
| Supabase | ✅ Actif | claude.ai natif |
| Figma | ✅ Actif | claude.ai natif |
| Mermaid | ✅ Actif | claude.ai natif |
| Sentry | ✅ Actif | claude.ai natif |
| incident.io | ✅ Actif | claude.ai natif |
| Spotify | ✅ Actif | claude.ai natif |
| Canva | ✅ Actif | claude.ai natif |
| Booking | ✅ Actif | claude.ai natif |
| GitHub | 🔴 P1 à ajouter Desktop | `npx @modelcontextprotocol/server-github` |
| Filesystem | 🟠 P2 à ajouter Desktop | `npx @modelcontextprotocol/server-filesystem` |
| Docker | 🟠 P3 à ajouter Desktop | `uvx mcp-server-docker` |
| SonarCloud | 🟡 P4 à ajouter Desktop | `github.com/SonarSource/sonar-mcp-server` |
| claude-prompts | 🟡 P5 à ajouter Desktop | `npx claude-prompts@latest --client=claude-code` |
| chrysa-skills (filesystem mount) | 🟡 P6 dès chrysa-skills mergé Phase 1 | `npx @modelcontextprotocol/server-filesystem /path/to/chrysa-skills` |

## Inputs

- `config_path` (str, default `~/.config/Claude/claude_desktop_config.json`)
- `ref_path` (str, default `chrysa/agent-config/mcp/config-reference.md`)
- `dry_run` (bool, default true)
- `severity_threshold` (enum) — `block | warn | info`

## Outputs

- Rapport `mcp-doctor-<date>.md`
- Liste de commandes `npx ...` ou `gh auth ...` à lancer manuellement
- (optionnel) Patch `claude_desktop_config.json` proposé en diff (pas appliqué auto)

## Exemples

### Exemple 1 · Audit complet

```text
🔴 BLOCK · GitHub MCP non configuré
  ref: P1 à ajouter (config-reference.md)
  fix: gh auth login -p https -w -s repo,workflow,read:org
       Ajouter au claude_desktop_config.json :
       "github": { "command": "npx", "args": ["-y", "@modelcontextprotocol/server-github"], "env": {"GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_TOKEN}"} }

🟠 WARN · Notion token expire dans 18 jours
  fix: générer nouveau token https://www.notion.so/my-integrations
       puis: chrysa-bootstrap.sh --tokens-wizard

🟢 INFO · 11/12 MCPs claude.ai actifs
  Sentry, incident.io, Notion, GCal, Gmail, Drive, Supabase, Figma,
  Mermaid, Spotify, Canva, Booking → tous OK
```

### Exemple 2 · MCP custom non documenté

```text
🟡 INFO · MCP "n8n" présent dans claude_desktop_config.json mais pas dans
  agent-config/mcp/config-reference.md.
  Action : (a) ajouter à la ref si voulu, (b) retirer du local si test abandonné.
```

## Related skills

- `chrysa-bootstrap.sh --tokens-wizard` (skill `repo-bootstrap` chaîné · pour ajouter tokens manquants)
- `dependency-audit` (audit complémentaire des MCPs custom-coded)

## References (à venir post-promotion)

- `references/mcp-catalogue.md` · catalogue MCP chrysa avec criticité
- `references/known-tokens.md` · format expected pour chaque token (regex validation)
- `scripts/doctor.py` · CLI : `mcp-doctor [--config <path>]`
- `scripts/refresh-token.sh` · helper rotation token
