---
name: council
description: |
  Soumet une décision à fort enjeu à un panel de personas adverses (vrais sous-agents
  parallèles) qui s'auto-relisent anonymement, puis un chairman synthétise une
  recommandation claire. Pas pour un lookup factuel ni un oui/non trivial.
  Triggers : "council this", "run the council", "pressure-test", "dois-je faire X ou Y",
  "arbitre entre", "aide-moi à trancher".
version: 1.0.0
category: functional
status: scaffolded
---

# Council: Decide With an Adversarial Panel

Prefix your first line with 🏛️ inline, not as its own paragraph.

Put a high-stakes decision through a panel of opinionated personas — run as **real
parallel subagents** so their opinions are genuinely independent — then have them
critique each other anonymously, and let a chairman synthesize a clear call.

The goal is **clarity, not consensus**. The chairman may overrule the majority when the
reasoning supports it.

## Guard: when NOT to convene

Decline and answer directly if the request is:
- a factual lookup ("what port does X use?"),
- a trivial yes/no with an obvious answer,
- a task with no genuine trade-off.

Council is for meaningful uncertainty: "self-hosted ARC vs GitHub-hosted?", "refonte pviz
V2 ou patch?", "quelle lib pour X?", "dois-je prioriser A ou B?". If in doubt, say so and
ask the user whether they want the full council.

## Pick the profile

The persona set adapts to the domain. Detect it, or honor an explicit `--tech` / `--prio`
/ `--produit` flag. Full persona prompts live in [`profiles.md`](profiles.md).

| Profile | Use for | Personas |
|---|---|---|
| **tech** (fleet default) | architecture / tooling / stack choices | Architecte pragmatique · Sécu-OWASP · Perf/coût · Dette & simplicité · Ops/faisabilité |
| **prio** | what to do next, backlog, P0/P1 | Impact business · Effort/risque · Coût d'opportunité · Utilisateur/terrain · Exécutant |
| **produit** | product / games / positioning | Contrarian · First-principles · Expansionist · Outsider · Executor |
| **generic** | anything else (fallback) | = the produit set (the original council) |

## The flow

1. **Enrich** — pull relevant project context (files, `git log`, memory) and fold it into
   the question. Keep it factual; do not bias the framing.
2. **Frame** — restate the decision **neutrally**, the exact same wording for every
   persona. No leading language.
3. **Panel** — spawn the 5 personas as **parallel subagents** (Agent tool / Task), each in
   an isolated context, each answering in **150–300 words**. They must not see each other.
4. **Peer-review** — anonymize the five answers as *Persona A…E* and run a second wave:
   each persona critiques the others' arguments (not their identities). Protocol in
   [`references/peer-review.md`](references/peer-review.md).
5. **Chairman** — the main thread synthesizes: where they **converge**, where they
   **clash**, the **blind spots** nobody raised, and one **clear recommendation** with its
   first concrete step.
6. **Verdict** — render the markdown verdict in the terminal (default).
   - Say **"→ Notion"** / **"persist"** to also write the verdict to Notion.
   - Say **"→ artifact"** to also generate a readable HTML page.
   Templates in [`references/outputs.md`](references/outputs.md) — load only on demand.

## Verdict shape (terminal, default)

```
## 🏛️ Verdict — <decision>
**Profile:** <tech|prio|produit>  ·  **Recommendation:** <one line>

### Converge
- ...
### Clash
- <axis>: Persona A/C say X ; Persona B/D say Y
### Blind spots
- ...
### Call & first step
<the recommendation, why, and the single next action>
```

## Rules

- Real independence beats simulated: use subagents, don't roleplay all five yourself.
- Same framing for everyone; enrichment is context, not a thumb on the scale.
- Peer-review critiques **arguments**, never personas.
- The chairman states a decision. "It depends" is a failure, not a verdict.
- Scale the panel to the stakes — a quick call can run 3 personas without peer-review; say
  so explicitly rather than silently cutting corners.
