---
name: local-first-optional-llm
description: Use when designing or reviewing a feature that could call an LLM — enforces a deterministic core that works fully offline with AI as an optional enrichment layer, so the product degrades gracefully with no cloud dependency, no arbitrary shell, and every decision explainable and reversible.
---

# Local-first, optional LLM

The product must work with the model turned off. AI is a layer on top of a
deterministic core, never the core itself.

## The contract

1. **Deterministic core (L1).** The primary decision/plan is computed by pure,
   testable rules. It runs with zero network and zero model. Its output is
   explainable (you can point at the rule) and reversible (dry-run first, apply
   is a separate, explicit step).
2. **Optional enrichment (L2+).** An LLM (local Ollama first, hosted only if
   configured) may re-rank, summarize, or annotate — never gate the L1 result.
   If the model is absent, slow, or errors, the feature still produces a correct
   L1 answer. This is the **degraded mode**, and it is a first-class path, tested.
3. **No arbitrary power.** No arbitrary shell execution, no unbounded write access.
   File/Git access is read-only unless an explicit apply step is invoked.

## Why

dev-focus, content-organizer, clean-video-experience, semantic-feed-filter and
genealogy-validator each independently landed on "deterministic first, AI optional,
offline-capable, explainable, reversible". Encoding it once keeps every new feature
honest: the AI is never a single point of failure and never an unaccountable oracle.

## Checklist

- [ ] The L1 result is produced without any model call.
- [ ] Degraded mode (model unavailable) is tested and returns a correct L1 answer.
- [ ] LLM output only enriches/annotates; it cannot silently override L1.
- [ ] Local model (Ollama) is the default; hosted is opt-in via config.
- [ ] No arbitrary shell; writes are dry-run-then-apply, reversible.
