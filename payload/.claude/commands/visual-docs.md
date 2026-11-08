---
description: Generate or update the bilingual (FR/EN) landscape-A4 PDF documentation suite for Padam products
argument-hint: "[product | all]"
---

# Visual Documentation (PDF workflows)

Generate or update the visual documentation suite for the Padam products (bilingual
FR/EN, landscape A4 PDFs). Usable as a Claude Code slash command: `/visual-docs [produit|all]`

______________________________________________________________________

## Instructions for Claude Code

Authoritative spec: the **"Commande : documentation visuelle (PDF workflows)"** section
of `CLAUDE.md`. This command is **generic and multi-product** — no product name, page
count, or branch is hard-coded. Use AV as the content-quality model.

Argument `$ARGUMENTS`:

- empty or `all` → regenerate the full suite (global + one PDF per interface product).
- a product/repo name → refresh only that product's document (+ the global if impacted).

### Steps

1. **Recense les produits** : dépôts de l'org GitHub + dépôts locaux ; note ceux non
   clonables. Classe-les (produits UI, apps mobiles/embarquées, backends, libs, infra,
   outillage). Un dépôt = un produit.
1. **Analyse les dernières branches d'intégration** (`master`/`main` ou
   `dev`/`develop`/`beta`/`staging`) via des **worktrees isolés**. Ne **jamais** changer
   la branche du checkout AV courant. Nettoie les worktrees après. Pour la profondeur,
   délègue l'extraction à des sous-agents (un par domaine/produit) rendant des catalogues
   avec `fichier:ligne`.
1. **Contenu par produit** : architecture, graphes de décision des workflows, contrats de
   communication (REST + versions, WS, topics/payloads MQTT, canaux Redis pub/sub,
   connecteurs/providers), modèle de données (ER), catalogue **exhaustif** des règles
   métier (`fichier:ligne`).
1. **Vues transverses** : catalogue produits, carte de consommation inter-produits,
   matrice produit × interface × backend × auth × protocole, page sécurité & dette,
   chapitre infra/déploiement.
1. **Générateurs** dans le scratchpad de session uniquement (`flowlib.py`, `erlib.py`,
   `pdfgen.py`, `drules_full.py`, `content*.py`, `content_products.py`, `d_*.py`,
   `build_docs.py`, `build_products.py`). Ne rien committer d'autre : **footprint repo =
   CLAUDE.md + ce fichier de commande**.
1. **Qualité (bloquant)** : corriger `OUT-OF-FRAME`, `OVERLAP`, `LINE-THRU-BOX`
   (traversée réelle) et `LABEL-COLLISION` avant livraison ; un frôlement de coin qui
   rend proprement est toléré. Faire des schémas grands/séparés au besoin (le PDF les
   redimensionne).
1. **Sortie** : `docs-padam/` (document global multi-parties) + `docs-padam/produits/`
   (un PDF par produit). Régénérer via `build_docs.py` puis `build_products.py`, puis
   `xdg-open docs-padam/` (+ le PDF global).

### Format

Paysage A4 uniforme, bilingue FR/EN, sommaire cliquable + signets, glossaire « sans
jargon », une ligne « En clair » par page. Diagrammes issus du code réel.
