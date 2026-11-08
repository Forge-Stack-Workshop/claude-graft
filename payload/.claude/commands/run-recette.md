---
description: Démarre l'environnement local de padam-av et guide pas-à-pas l'exécution des scénarios de recette REC-ADM/REC-BACK
---

Périmètre de ce dépôt : sections **REC-ADM** (Admin Django) et **REC-BACK** (domaines techniques backend) du livre de recette. **Source de vérité** : la page Confluence *Non-regression tests book* (`https://padam.atlassian.net/wiki/spaces/EX/pages/3096444950`) ; travaille depuis l'export Markdown local `~/Documents/padam/livre-de-recette-non-regression.md` (exporte-le depuis Confluence s'il est absent).

Étapes :
1. Démarre l'environnement local de ce dépôt (utilise le skill `run` s'il est disponible ; sinon suis les instructions de démarrage du `README.md`/`Makefile` de ce dépôt — ne suppose rien, vérifie). Attends confirmation que les services sont prêts (backend up, `/admin/` accessible).
2. Lis `~/Documents/padam/livre-de-recette-non-regression.md` et extrais uniquement les scénarios `REC-ADM-*` et `REC-BACK-*`, dans leur ordre d'apparition (regroupés par Page/Domaine puis Fonctionnalité).
3. Pour chaque scénario, dans l'ordre :
   - Affiche son titre, ses **Prérequis**, sa **Criticité**, et le tableau Action / Résultat attendu.
   - Demande à l'utilisateur d'exécuter les actions dans l'environnement local et de rapporter le résultat par étape (OK / KO / Non applicable), avec un commentaire libre si KO.
   - N'avance au scénario suivant qu'après réponse.
4. Certains REC-BACK nécessitent des canaux de vérification non-UI (logs conteneur, `/django-rq/`, `curl` direct, coupure Redis) : rappelle le "Canal de vérification" indiqué et propose les commandes `docker compose logs ...` / `curl ...` correspondantes si utile.
5. À la fin, résume : nombre de OK/KO/Non applicable, liste des échecs avec leur criticité, et rappelle si des scénarios **Bloquant** ont échoué (bloque la mise en production selon la section 7 du livre de recette).
6. Propose de cocher les cases `Résultat : ☐ OK ☐ KO ☐ Non applicable` correspondantes dans le fichier `.md` — ne le fait que si l'utilisateur confirme. Ne republie pas sur Confluence depuis cette commande (utiliser `/update-recette` pour cela si nécessaire).
