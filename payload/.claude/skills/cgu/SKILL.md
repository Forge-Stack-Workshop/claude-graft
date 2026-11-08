---
name: cgu
description: "Génère des CGU (Conditions Générales d'Utilisation) et des Mentions légales conformes au droit français, adaptées à un projet (web/app/SaaS/jeu/API). Use when the user asks for CGU, mentions légales, conditions d'utilisation, or legal docs for a project."
trigger: /cgu
---

# /cgu — Générateur CGU + Mentions légales (droit français)

Produit un dossier `legal/` avec **`cgu.md`** et **`mentions-legales.md`** adaptés à un projet.
Sortie en **français**, structurée en Markdown, prête à relire puis publier.

> ⚖️ **Non-juridique.** Le rendu est un **brouillon de départ**, pas un conseil juridique.
> Les champs d'identité légale ne sont **jamais inventés** : ils restent en `[À COMPLÉTER : …]`.
> Recommande une relecture par un professionnel avant mise en ligne.

## Usage

```
/cgu                       # infère le projet depuis le dossier courant (README, package.json, repo)
/cgu <nom-projet>          # projet nommé (fiche cockpit / Notion / repo chrysa)
/cgu --type saas           # force le profil : web | app | saas | game | api | marketplace
/cgu --out <dir>           # dossier de sortie (défaut : ./legal)
/cgu --lang fr             # fr (défaut). en = version anglaise miroir
```

## Périmètre

| Produit | Ce skill | Délégué |
|---|---|---|
| CGU (utilisation du service) | ✅ | |
| Mentions légales (LCEN art. 6-III) | ✅ | |
| Politique de confidentialité / RGPD | ➡️ | skill **`rgpd-compliance`** |
| CGV (vente / paiement) | ❌ hors périmètre | — |

Si le projet vend ou traite des données perso, **renvoie** vers `rgpd-compliance` (privacy) et signale qu'une CGV est nécessaire — ne la génère pas ici.

## Procédure

1. **Rassembler les faits du projet** (dans cet ordre, s'arrêter dès que suffisant) :
   - dossier courant : `README*`, `package.json`, `pyproject.toml`, `docker-compose*`, une page d'accueil ;
   - si `<nom-projet>` donné : fiche cockpit / Notion Projets V2 (Nom, Description, Nature, URL GitHub), repo `$WORKSPACE_ROOT/<repo>` ;
   - ce qui manque et ne peut se déduire → **demander en une seule salve** (voir « Champs requis »).
2. **Choisir le profil** (`--type` ou inféré) : `web` (site vitrine/contenu), `app` (mobile), `saas` (compte + abonnement), `game` (jeu, UGC, achats in-app), `api` (service développeur), `marketplace` (mise en relation). Le profil active des clauses conditionnelles (cf. templates).
3. **Remplir les templates** `templates/cgu.template.md` et `templates/mentions-legales.template.md`.
   - Remplacer chaque `{{VAR}}` par une valeur connue, sinon laisser `[À COMPLÉTER : description]`.
   - **Ne jamais fabriquer** : dénomination sociale, SIREN/SIRET, adresse, capital, nom du directeur de publication, coordonnées de l'hébergeur, numéro TVA. Ces champs restent des placeholders explicites.
   - Activer/retirer les blocs `<!-- IF:profil -->…<!-- ENDIF -->` selon le profil.
   - Vérifier chaque item de `references/checklist-fr.md`.
4. **Écrire** `<out>/cgu.md` et `<out>/mentions-legales.md`. Ajouter en tête de chaque fichier le bloc d'avertissement non-juridique + la date de version (`Version {{DATE}}`).
5. **Restituer** : lister les fichiers écrits + la **liste des `[À COMPLÉTER]`** que l'utilisateur doit renseigner, et le rappel privacy/CGV si applicable.

## Champs requis (demander seulement ce qui manque)

- **Éditeur** : nom/dénomination, statut (particulier · auto-entrepreneur · EI · SASU · SAS · association), adresse, SIREN/SIRET si pro, capital si société.
- **Directeur de publication** (souvent le gérant / la personne physique).
- **Contact** : email (et éventuellement formulaire/URL).
- **Hébergeur** : nom, adresse, téléphone (ex. OVH, Scaleway, Vercel, Netlify, GitHub Pages…).
- **Service** : nom commercial, URL/domaine, une phrase de description, profil.
- **Comptes utilisateurs ?** oui/non · **contenu généré par l'utilisateur (UGC) ?** oui/non · **paiement/abonnement ?** oui/non · **public mineur visé ?** oui/non.

Si l'utilisateur ne sait pas un champ non-identitaire (ex. hébergeur), proposer une valeur par défaut plausible **marquée à confirmer**. Pour les champs identitaires, toujours placeholder.

## Règles de rédaction (droit FR)

- Base légale : **LCEN 2004-575** (mentions légales, responsabilité hébergeur/éditeur), **Code de la consommation** (médiation conso si B2C), **Code civil** (responsabilité), **Code de la propriété intellectuelle**.
- Mentions légales obligatoires : identité de l'éditeur, directeur de publication, **identité + coordonnées de l'hébergeur** (obligation LCEN), contact.
- CGU B2C : clause **médiation de la consommation** + **droit de rétractation** si vente (renvoi CGV).
- Données perso : une clause courte qui **renvoie** à la Politique de confidentialité (ne pas dupliquer le RGPD ici).
- Ton : clauses numérotées, phrases courtes, présent. Pas de latin inutile. Placeholders visibles en MAJUSCULES entre crochets.
- Toujours : « Droit applicable : droit français » + juridiction compétente + clause de modification des CGU avec information des utilisateurs.

## Intégration cockpit chrysa

Le cockpit (fiche projet) peut appeler ce skill via l'action « Générer CGU » : elle produit un prompt review-gated reprenant Nom/Description/Nature/URL de la fiche, à coller dans une session `/cgu`. Rien n'est écrit dans Notion sans validation (règle projet).
