---
name: provenance-guard
description: Use when generating knowledge, research syntheses, audits, or any claim-bearing document from sources — enforces epistemic tagging (FACT/HYPOTHESIS/DEDUCTION/OPINION) and per-claim source markers, forbidding invented content and ungrounded assertions.
---

# Provenance guard

Every statement you emit in a knowledge or research artifact carries an epistemic
label and, when it rests on a source, a source marker. Nothing is asserted bare.

## The rule

Tag each claim with exactly one of:

- `[FACT]` — directly supported by a cited source.
- `[HYPOTHESIS]` — plausible, not yet verified. This is the **default** when unsure.
- `[DEDUCTION]` — inferred from other tagged claims (name which ones).
- `[OPINION]` — a judgement call, explicitly owned as such.

Attach a source marker `[[SOURCE:<id>]]` to every `[FACT]` and to any `[DEDUCTION]`
whose premises are sourced. `<id>` refers to an entry in the artifact's source index
(a URL, file path + hash, or dataset id).

Mark anything you could not ground as `À RECHERCHER` / `TO RESEARCH` rather than
guessing. Never invent a source, a quote, a number, or a lineage.

## Why

Knowledge-compiler, daedalus-document-factory, and genealogy-validator each
re-invented the same discipline independently: hypothesis-by-default, grounded-only
answers, no invented content. Codifying it once means every downstream artifact is
auditable — a reader can see, per line, how much to trust it and where to check.

## Checklist

- [ ] Every claim has one epistemic tag.
- [ ] Every FACT has a `[[SOURCE:id]]`.
- [ ] A source index maps each id to a resolvable source (URL / path+hash / dataset).
- [ ] Unknowns are `À RECHERCHER`, never filled with a guess.
- [ ] Deductions name their premises.
