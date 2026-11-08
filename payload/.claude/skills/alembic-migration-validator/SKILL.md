---
name: alembic-migration-validator
description: |
  Valide les migrations Alembic d'un repo chrysa : (1) chaîne `down_revision`
  linéaire sans branches sauvages, (2) `downgrade()` testé ou marqué
  `# noqa: downgrade-untested` avec raison, (3) pas de `DROP TABLE/COLUMN`
  destructif sans confirmation explicite, (4) pas de `ALTER` lourd sur
  table > 1M lignes sans `op.batch_alter_table` ni stratégie batched.
  Triggers FR : "valide migration", "audit alembic", "PR migration sûre",
  "downgrade OK", "migration destructive", "vérifie alembic".
version: 0.1.0
category: functional
adrs: []
status: scaffolded
---

## Quand utiliser

- PR qui ajoute / modifie un fichier dans `alembic/versions/`
- Avant `alembic upgrade head` en environnement de prod
- Audit d'un repo qui n'a jamais validé ses migrations (ex: lifeos legacy)
- Avant un dump/restore Postgres (s'assurer que les migrations sont propres)

## Quand NE PAS utiliser

- Pour des projets sans Alembic (Prisma, raw SQL, NoSQL)
- Pour exécuter les migrations (juste validation, pas application)
- Pour de la perf tuning de queries (out of scope · `senior-python-reviewer` couvre)

## Workflow

1. **Charger toutes les migrations**
   - `alembic/versions/*.py`
   - Parser AST chaque fichier · extraire `revision`, `down_revision`, `upgrade()`, `downgrade()`

2. **Check 1 · Chaîne linéaire**
   - Construire le DAG `down_revision` → `revision`
   - Détecter :
     - Branches non-mergées (`alembic merge` jamais lancé)
     - Cycles (impossible normalement, mais corruption possible)
     - Heads multiples non-volontaires
   - **FAIL** si > 1 head sans merge migration explicite

3. **Check 2 · Downgrade testé**
   - Pour chaque migration : la fonction `downgrade()` n'est pas vide ni `pass`
   - Si `downgrade()` est vide ou `pass` :
     - Doit avoir un commentaire `# noqa: downgrade-untested` avec raison (ex: "data loss intentionnel sur DROP CASCADE")
     - Sinon **WARN** (audit-like, pas block en non-prod)
   - Run optionnel : `alembic downgrade -1` puis `alembic upgrade +1` sur DB de test → vraie validation

4. **Check 3 · DROP destructifs**
   - Scanner `upgrade()` pour `op.drop_table`, `op.drop_column`, `op.drop_index`, `DROP CASCADE`, `op.execute("DROP ...")`
   - **BLOCK** si DROP sans :
     - Comment explicit `# DESTRUCTIVE: <reason>`
     - OU label PR `migration:destructive`
     - OU env var `ALEMBIC_ALLOW_DESTRUCTIVE=1` (non-prod uniquement)

5. **Check 4 · ALTER lourd**
   - Scanner `op.alter_column`, `op.add_column NOT NULL`, `op.create_index` sur tables connues > 1M lignes
   - Tables critiques connues (à configurer par repo) : `events`, `sessions`, `audit_log`, etc.
   - **BLOCK** si ALTER lourd sans `op.batch_alter_table` ou stratégie batched (pgcli `ALTER TABLE ... ALGORITHM=COPY` ou `pt-online-schema-change`)

6. **Check 5 · Bonus** (warns)
   - Migration > 200 lignes → suggest split
   - Migration mélange schema + data ops → suggest split (schema first, data après en migration séparée)
   - `op.execute(<raw SQL>)` non parametrisé → SQL injection check
   - Pas de comment de description en haut de la migration

## Inputs

- `repo_path` (str)
- `large_tables` (list[str], optional) — tables > 1M lignes à surveiller (override repo-level config)
- `allow_destructive` (bool, default false) — autorise les DROP avec confirmation
- `db_url_test` (str, optional) — si fourni, tente downgrade/upgrade sur DB de test

## Outputs

- Rapport `alembic-validation-<repo>-<date>.md`
- Sections : `🔴 BLOCK`, `🟠 WARN`, `🟡 INFO`
- Exit code 0/1/2 (CI-friendly)

## Exemples

### Exemple 1 · DEV Nexus migration users → user_profiles

Migration : `op.rename_table("users", "user_profiles")` + `op.alter_column("user_profiles", "email", nullable=False)`.

Findings :

- 🔴 BLOCK · `email NOT NULL` sur table user_profiles : si déjà des rows, fail. Backfill manquant.
  Fix : ajouter `op.execute("UPDATE user_profiles SET email='unknown@chrysa.dev' WHERE email IS NULL")` AVANT `alter_column`.
- 🟠 WARN · `downgrade()` vide. Si on rename `users` ↔ `user_profiles`, `downgrade()` devrait inverser.
  Fix : `op.rename_table("user_profiles", "users")` dans downgrade.
- 🟡 INFO · pas de description en haut de la migration. Ajouter docstring.

Verdict : `BLOCK` (1 critique).

### Exemple 2 · doc-gen ajout column nullable

Migration : `op.add_column("documents", sa.Column("tag", sa.String(), nullable=True))`.

Findings :

- 🟢 OK · ajout colonne nullable, downgrade `op.drop_column` correct, pas destructif.

Verdict : `LGTM`.

## Related skills

- `senior-python-reviewer` (chaîne ce skill quand PR touche `alembic/versions/`)
- `dependency-audit` (vérifie que `alembic` lui-même est à jour · sécurité)
- `release-ritual` (pré-release : run validations avant tag)

## References (à venir post-promotion)

- `references/destructive-patterns.md` · catalogue patterns à toujours flagger
- `references/large-tables-config.md` · tables critiques par repo
- `scripts/validate.py` · CLI : `alembic-validate <repo>`
- `scripts/test-down-up.sh` · helper pour run downgrade/upgrade sur DB test
