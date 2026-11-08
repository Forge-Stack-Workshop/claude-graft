---
name: rgpd-compliance
description: >-
  Audit, verify and document RGPD/GDPR compliance of software projects across
  code (Python/React), database schemas (PostgreSQL) and project sheets, with
  bilingual FR/EN deliverables. Use this skill whenever the user mentions RGPD,
  GDPR, data protection / protection des données, compliance / conformité,
  personal data / données personnelles, PII, records of processing / registre
  des traitements, Article 30, DPO / data protection officer, consent /
  consentement, right to erasure / droit à l'effacement, right to be forgotten,
  data subject rights, privacy / vie privée, privacy policy / politique de
  confidentialité, DPA / accord de sous-traitance, cookie banner, or asks
  whether an app/database/feature is lawful to process user data — even if they
  don't say the word "RGPD" explicitly. Four activatable modules: PII detection,
  Article 30 records generation, compliance audit, and legal-document drafting.
---

# RGPD / GDPR Compliance

Help teams **inventory, assess and document** how a software project handles
personal data, and produce the artefacts a controller needs to demonstrate
accountability (RGPD Art. 5.2). This skill covers the technical layers most audit
templates ignore: the **actual code** (Python/React), the **PostgreSQL schema**,
and the **project sheets** describing what a feature does.

Deliverables are **bilingual FR/EN** because most French teams operate under the
CNIL yet report to non-French stakeholders.

> ⚠️ **This is not legal advice.** The skill produces evidence, drafts and gap
> analyses to accelerate the work of a DPO or lawyer. A qualified person must
> validate every classification and sign off any published document. See
> [Limits](#limits).

---

## The four modules

Each module is independently useful and can be run alone or chained. A typical
full engagement runs them in order: 1 → 2 → 3 → 4.

| # | Module | Output | Reference / tool |
|---|--------|--------|------------------|
| 1 | **PII detection** | Localised inventory of personal-data touch-points | `scripts/pii_scanner.py` + `references/pii-taxonomy.md` |
| 2 | **Records of processing** | Article 30 register (per processing activity) | `references/art30-guide.md` + `assets/registre-traitements-template.md` |
| 3 | **Compliance audit** | Prioritised gap report over 9 domains | `references/audit-checklist.md` |
| 4 | **Document drafting** | Privacy policy, DPA, legal notice, consent clauses | `assets/*-template.md` |

---

## General workflow

The order matters. **Inventory before you analyse**: you cannot assess a
processing activity you haven't found, and you cannot write an accurate privacy
policy from imagination. Ground every claim in something you actually read.

1. **Scope.** Ask what to cover (repo path, DB schema file, project sheets) and
   the legal context: who is the controller, is there a DPO, EU/EEA users,
   transfers outside the EU. Note any known processors (analytics, hosting, mail).

2. **Inventory (module 1).** Run the scanner over the real code and schema — do
   not guess field names. Then **open the flagged files** and read the
   surrounding code: a scanner hit is a *lead*, not a verdict. Confirm whether the
   field truly stores personal data, for whom, and why.

3. **Derive processings (module 2).** Group data touch-points into *processing
   activities* (e.g. "user account management", "marketing emails", "audit log").
   Map each to a legal basis (Art. 6) and, for special categories, an Art. 9
   condition. Derive retention and recipients from the code/DB, not assumptions.

4. **Assess (module 3).** Score each of the 9 domains, cite the concrete evidence
   (file:line, table, config), and rank remediations P0/P1/P2.

5. **Document (module 4).** Fill the templates from what you found. Every unknown
   stays as `[À COMPLÉTER : ...]` — never invent a retention period, a controller
   name, or a processor's location.

**Cardinal rule — validate manually.** The scanner is heuristic (high recall, not
precision). Field names lie, sample data looks real, and real data hides behind
generic names like `data` or `payload`. Read the code before you classify.

---

## Module 1 — PII detection

Locate personal data in the codebase, SQL and docs.

```bash
# Text report (default), scans code + SQL + docs under ./src
python scripts/pii_scanner.py --path ./src --format text

# JSON for further processing, only Python + SQL + TSX
python scripts/pii_scanner.py --path . --format json --ext .py .sql .tsx
```

The scanner combines **value patterns** (emails, FR phone numbers, IBAN, IPv4,
credit cards, French NIR/social-security numbers, dates of birth) with
**field-name patterns** across five categories (identity, contact, national id,
financial, connection). It flags **Art. 9 special categories** (health, racial/
ethnic origin, political opinion, religion, sexual orientation, biometrics) and
**minors' data** distinctly, and damps obvious false positives (`example`,
`test`, loopback IPs, Luhn-invalid card numbers). Output is `file:line` with a
confidence level (high/medium/low).

**After scanning:** open the high-confidence and every Art. 9 / minor hit, read
the code, and build a validated inventory. Use `references/pii-taxonomy.md` to
classify each confirmed item (direct vs indirect identifier, special category,
Art. 10 offence data, minors). Discard confirmed false positives with a one-line
reason so the audit trail shows they were reviewed, not missed.

---

## Module 2 — Records of processing (Article 30)

Build the register the controller must keep. Read `references/art30-guide.md` for
the mandatory fields, the six Art. 6 legal bases, and how to derive each field
from the code and DB (e.g. retention from a cron/cleanup job, recipients from API
integrations, security measures from the deployment config).

Fill `assets/registre-traitements-template.md` — one block per processing
activity. Leave `[À COMPLÉTER : ...]` wherever the code doesn't tell you the
answer (it usually won't tell you the *purpose* or *legal basis* — those are
business decisions to confirm with the team).

---

## Module 3 — Compliance audit

Assess the project against `references/audit-checklist.md`, which covers **9
domains**: legal bases, data minimisation, privacy by design (Art. 25), security
(Art. 32), breach handling (Art. 33/34), data-subject rights (Art. 15–22),
records of processing, sub-processing & transfers, and transparency.

Each control gets a status: ✅ compliant · 🟡 partial · 🔴 non-compliant · ⚫ not
assessed / N/A. Produce the prioritised report format from the checklist, with
remediations tagged **P0** (unlawful now / high risk), **P1** (required, plan it),
**P2** (hardening). Cite evidence for every status.

---

## Module 4 — Document drafting

Draft the legal/operational documents from the templates in `assets/`:

- `politique-confidentialite-template.md` — privacy policy, **bilingual FR/EN
  side by side**.
- `dpa-template.md` — data processing agreement (Art. 28).
- `mentions-legales-template.md` — legal notice.
- `consentement-clauses.md` — cookie banner, opt-in wording, minors' clause.

Populate only what the inventory and audit established. Every gap stays as
`[À COMPLÉTER : ...]` with a hint of what's needed. Flag anything that must be
lawyer-reviewed before publication.

---

## Chrysa security conventions

When assessing **Art. 32 security** for chrysa/Forge-Stack projects, align the
checklist to the house conventions rather than generic advice:

- **Secrets in a vault.** Credentials, API keys and DB passwords must live in a
  secrets manager/vault, never in code, `.env` committed to git, or CI logs. A
  hard-coded secret or a plaintext `.env` in the repo is a **P0** finding.
- **External identity sources.** Auth is expected to support LDAP / external
  identity providers; verify group/role mapping and that external accounts follow
  the same deprovisioning path as local ones.
- **Encryption at rest.** Personal data at rest (PostgreSQL volumes, backups,
  object storage) must be encrypted; unencrypted backups of PII are a **P0/P1**
  finding depending on exposure.

Treat these as concrete acceptance criteria for the security domain and cite the
config/manifest that proves (or disproves) each.

---

## Limits

- **Not legal advice.** Output is decision-support for a DPO/lawyer, not a
  compliance certificate. Classifications, legal bases and published documents
  must be validated by a qualified person.
- **Heuristic detection.** The scanner favours recall; it produces false
  positives and can miss data behind generic names, in binaries, or in external
  systems. Manual review is mandatory.
- **Snapshot in time.** An audit reflects the code/DB at one commit. Re-run it
  when data flows change.
- **Jurisdiction.** Templates are RGPD/CNIL-oriented (France/EU). Other regimes
  (UK GDPR, CCPA, etc.) need adaptation.
