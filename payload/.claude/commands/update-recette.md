---
description: Met à jour le livre de recette de non-régression suite à une PR validée, régénère les .docx et republie FR+EN sur Confluence
argument-hint: "[pr-number | url | branch]"
---

Périmètre de ce dépôt dans le livre de recette : sections **REC-ADM** (Admin Django) et **REC-BACK** (domaines techniques backend : dispatch/providers, sécurité, résilience, scheduling).

Source de vérité : la page Confluence *Non-regression tests book* (`https://padam.atlassian.net/wiki/spaces/EX/pages/3096444950`). Tu travailles depuis un export Markdown local `~/Documents/padam/livre-de-recette-non-regression.md` (FR), `.en.md` (EN), `.ko.md` (KO) — s'ils sont absents, exporte-les d'abord depuis Confluence.
Structure : `## N. Recettes — ...` > `#### Page/Domaine : ...` > `##### Fonctionnalité : ...` > `### REC-XXX-NN — Titre` (tableau Action/Résultat attendu, `**Criticité**`, `> Source : ...`).
Outils : `~/Documents/padam/tools/md_to_docx.py`, `~/Documents/padam/tools/push_confluence.py` (auth via `CONFLUENCE_EMAIL` + `CONFLUENCE_API_TOKEN` ou `PADAM_CONFLUENCE`).

Référence de PR à traiter : $ARGUMENTS (numéro, URL, ou branche — si vide, demander).

Étapes :
1. Récupère le diff de la PR (`gh pr diff <ref>` ou `gh pr view <ref> --json ...`). Identifie les changements visibles/testables par un humain (nouvel écran, libellé modifié, message d'erreur, endpoint, règle de validation, comportement d'action) — ignore le pur refactor sans impact fonctionnel.
2. Pour chaque changement pertinent :
   - S'il modifie un scénario existant (REC-ADM-XX ou REC-BACK-XX) : mets à jour les lignes concernées (libellés exacts entre guillemets, `> Source :` si le fichier cité a changé).
   - S'il introduit une fonctionnalité/écran non couvert : crée un nouveau `### REC-ADM-NN` ou `### REC-BACK-NN` (numérotation suivante), classé sous la `#### Page`/`##### Fonctionnalité` la plus pertinente (ou crée-la si aucune ne convient).
3. Répercute exactement le même changement structurel dans `.en.md` (traduction anglaise naturelle, mêmes IDs) et `.ko.md` (traduction coréenne, mêmes IDs). Les libellés d'UI réels cités entre guillemets restent inchangés, avec glose traduite entre parenthèses italique comme dans le reste du document.
4. Si un nouveau REC-XXX est **Bloquant**, propose de l'ajouter à la section « Critères de Go/No-Go » (section 7).
5. Régénère les trois `.docx` :
   ```
   python3 ~/Documents/padam/tools/md_to_docx.py ~/Documents/padam/livre-de-recette-non-regression.md ~/Documents/padam/livre-de-recette-non-regression.docx
   python3 ~/Documents/padam/tools/md_to_docx.py ~/Documents/padam/livre-de-recette-non-regression.en.md ~/Documents/padam/livre-de-recette-non-regression.en.docx
   python3 ~/Documents/padam/tools/md_to_docx.py ~/Documents/padam/livre-de-recette-non-regression.ko.md ~/Documents/padam/livre-de-recette-non-regression.ko.docx "Malgun Gothic" "Malgun Gothic"
   ```
6. Affiche un résumé clair des scénarios ajoutés/modifiés et **demande confirmation explicite** avant de publier sur Confluence (action visible par toute l'équipe).
7. Après confirmation, publie FR+EN :
   ```
   python3 ~/Documents/padam/tools/push_confluence.py ~/Documents/padam/livre-de-recette-non-regression.md ~/Documents/padam/livre-de-recette-non-regression.en.md 3096444950
   ```
   Rapporte le nouveau numéro de version Confluence et le lien.

Ne jamais afficher ni logger la valeur du token Confluence.
