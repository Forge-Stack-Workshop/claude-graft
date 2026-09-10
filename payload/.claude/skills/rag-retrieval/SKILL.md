---
name: rag-retrieval
description: Retrieval-Augmented Generation pipeline design — chunking strategies, embedding model choice, vector stores (pgvector, FAISS, Qdrant, Chroma), hybrid search, reranking, context window management, citations/grounding, and evaluation (recall@k, faithfulness) for any stack.
origin: authored
---

# RAG Retrieval

Design and debug retrieval-augmented generation pipelines: from raw documents to grounded, cited answers.

## Prerequisites (preflight)

Before using this skill, ensure you have the required packages installed.

**Python packages:**
```bash
# Check for sentence-transformers
python -c "import sentence_transformers" || echo "WARN: pip install sentence-transformers"

# Install a vector store (choose one or more)
# pip install pgvector  # for PostgreSQL
# pip install faiss-cpu  # for FAISS
# pip install qdrant-client  # for Qdrant
```

## When to Activate

- Building a RAG pipeline from scratch
- Debugging poor retrieval quality (irrelevant chunks, missed answers)
- Choosing an embedding model or vector store
- Adding hybrid search or reranking to an existing pipeline
- Reducing hallucination in generated answers
- Setting up retrieval evaluation (recall@k, faithfulness)
- Handling index updates for changing source documents

## Pipeline Overview

```text
Ingestion → Chunking → Embedding → Vector Store → Retrieval → Rerank → Generation
    │            │           │            │             │          │         │
 parse docs   split into  vectorize    index +       top-k      reorder   LLM answers
 (PDF, HTML,   sized      chunks      metadata      similarity   by cross-  with cited
  DB rows)     units      (batch)     store          search      encoder    context
```

Each stage compounds errors from the previous one. A perfect reranker cannot
fix chunks that never entered the candidate set; a perfect retriever cannot
fix a generation prompt with no citation instructions. Debug in pipeline
order, not from the LLM output backward.

## Chunking Strategies

| Strategy | Chunk boundary | Use when |
| --- | --- | --- |
| Fixed-size (token/char) | N tokens, with overlap | Quick baseline, homogeneous text |
| Recursive character split | Paragraph → sentence → word fallback | General prose, markdown, code comments |
| Semantic chunking | Embedding-similarity breakpoints | Long-form docs where topic shifts matter |
| Structure-aware | Headings, sections, table boundaries | Structured docs (manuals, contracts, API specs) |
| Document-as-chunk | Whole short document | FAQs, product cards, small structured records |

Defaults that work broadly: 300–800 tokens per chunk, 10–20% overlap,
split on structure first (headings/sections) and fall back to recursive
character splitting inside oversized sections. Always store chunk
provenance (source doc id, section, page, offsets) as metadata — retrieval
without provenance cannot support citations later.

```python
chunk = {
    "text": "...",
    "source_id": "doc-42",
    "section": "3.2 Refund Policy",
    "char_range": (1200, 1950),
    "chunk_index": 7,
}
```

**Naive chunking pitfall:** splitting purely on a fixed character count
mid-sentence or mid-table breaks semantic units — the embedding then
represents a fragment, not a concept, and retrieval quality drops even
when the underlying document contains the answer.

## Embedding Choice

| Factor | Guidance |
| --- | --- |
| Domain match | General-purpose models (e.g. `text-embedding-3-*`, `bge`, `e5`) work for most text; fine-tune or pick a domain model for legal/medical/code |
| Dimensionality | Higher dims = better recall, more storage/compute cost — 768–1536 is a common sweet spot |
| Query vs. passage asymmetry | Use models trained for asymmetric search (`e5`, `bge`) when queries are short and passages long; prepend the required `query:`/`passage:` prefix if the model expects it |
| Multilingual | Verify the model was trained on the target languages — do not assume English-trained embeddings generalize |
| Latency/cost | Batch embedding calls; cache embeddings by content hash to avoid re-embedding unchanged chunks |

Never mix embeddings from two different models in one index — similarity
scores are not comparable across model families.

## Vector Stores

| Store | Fit | Trade-off |
| --- | --- | --- |
| pgvector | Already running Postgres; want ACID + joins with relational metadata | Slower at very large scale (10M+ vectors) without tuning (IVFFlat/HNSW indexes) |
| FAISS | In-process, no server, research/prototyping, full control over index type | No built-in persistence/metadata filtering — you build that layer |
| Qdrant | Production vector search with rich metadata filtering, payload storage | Extra service to operate/scale |
| Chroma | Fast local prototyping, small-to-medium datasets | Less battle-tested at high write throughput |

Decision shortcut: if the data already lives in Postgres and scale is
under a few million vectors, use pgvector — one less moving part. Reach
for Qdrant when filtering (tenant, date range, ACL) must be fast and
first-class at production scale.

```sql
-- pgvector: HNSW index for approximate nearest neighbor search
CREATE INDEX ON chunks USING hnsw (embedding vector_cosine_ops);

SELECT text, source_id, 1 - (embedding <=> $1) AS similarity
FROM chunks
ORDER BY embedding <=> $1
LIMIT 20;
```

## Hybrid Search (BM25 + Dense)

Dense embeddings miss exact-match signals (IDs, error codes, rare proper
nouns); keyword search (BM25) misses paraphrase and semantic similarity.
Combine both and fuse rankings — do not rely on dense retrieval alone for
technical or code-heavy corpora.

```python
def hybrid_search(query, k=20):
    dense_hits = vector_store.search(embed(query), top_k=k)
    sparse_hits = bm25_index.search(query, top_k=k)
    return reciprocal_rank_fusion(dense_hits, sparse_hits, k=60)

def reciprocal_rank_fusion(*ranked_lists, k=60):
    scores = {}
    for ranked in ranked_lists:
        for rank, doc in enumerate(ranked):
            scores[doc.id] = scores.get(doc.id, 0) + 1 / (k + rank + 1)
    return sorted(scores.items(), key=lambda item: item[1], reverse=True)
```

## Reranking

Retrieve a wide candidate set (e.g. top 20–50) cheaply, then rerank with a
cross-encoder that scores query-passage pairs jointly — cross-encoders are
far more accurate than bi-encoder cosine similarity but too slow to run
over the whole corpus, so use them only on the shortlist.

```python
candidates = hybrid_search(query, k=30)
reranked = cross_encoder.rank(query, [c.text for c in candidates])
top_context = reranked[:5]
```

## Context Window Management

- Rank first, truncate last — never truncate the candidate list before
  reranking; truncate only the final context sent to the LLM.
- Order matters: place the most relevant chunk first and last in the
  prompt (recency/primacy effects), not buried in the middle.
- Budget tokens explicitly: reserve headroom for the system prompt,
  question, and expected answer length; do not fill 100% of the context
  window with retrieved chunks.
- Deduplicate near-identical chunks (same source, overlapping ranges)
  before insertion — duplicates waste budget without adding information.

**Pitfall — context stuffing:** feeding 20+ chunks "to be safe" degrades
answer quality (the "lost in the middle" effect) and raises cost/latency
without improving recall. Fewer, higher-precision chunks beat more,
noisier ones.

## Citations & Grounding

- Require the generation prompt to cite `source_id`/section per claim, not
  just at the end of the answer.
- Reject or flag answers referencing content outside the provided context
  — this is a computable check, not just a prompt instruction.
- Return the retrieved chunks alongside the answer so callers/UI can show
  provenance and let users verify claims against the source.

```text
System prompt fragment:
"Answer using ONLY the provided context. After each claim, cite the
source as [source_id:section]. If the context does not contain the
answer, say so explicitly — do not guess."
```

## Hallucination Mitigation

- Ground every claim in retrieved context; instruct explicit "I don't
  know" behavior when context is insufficient.
- Run a faithfulness check (LLM-as-judge or NLI model) comparing the
  generated answer against the cited chunks before returning it to users
  in high-stakes flows.
- Lower generation temperature for factual/citation-heavy tasks.
- Surface retrieval confidence (top similarity score) to gate answer
  presentation — low-confidence retrievals should trigger a fallback
  ("no reliable source found") rather than a confident-sounding guess.

## Evaluation

| Metric | Measures | How |
| --- | --- | --- |
| Recall@k | Fraction of queries where the correct chunk is in the top-k | Labeled query→chunk pairs, check membership |
| Precision@k | Fraction of top-k chunks that are actually relevant | Labeled relevance judgments |
| MRR | Rank position of the first relevant result | 1 / rank of first correct hit, averaged |
| Faithfulness | Does the generated answer only assert what the context supports | LLM-as-judge or NLI entailment check |
| Answer relevance | Does the answer address the actual question | LLM-as-judge scoring |

Build a fixed evaluation set (50–200 real or representative queries with
labeled correct sources) before tuning chunking/embeddings/reranking —
without it, every change is a guess. Re-run the eval set after any
pipeline change; a chunking or embedding-model swap can silently regress
recall even when demo queries still look fine.

```python
def recall_at_k(eval_set, retriever, k=5):
    hits = sum(
        1 for query, expected_id in eval_set
        if expected_id in {c.source_id for c in retriever.search(query, top_k=k)}
    )
    return hits / len(eval_set)
```

## Index Updates

- Re-embed and re-index only changed/added documents — key chunks by a
  content hash of `(source_id, chunk_text)` so unchanged content is
  skipped on re-runs.
- Handle deletions explicitly: removing a source document must remove its
  chunks from the vector store, not just stop re-adding them.
- For frequently changing sources, prefer incremental upsert over full
  reindex; schedule full reindex periodically to catch drift (e.g.
  changed chunking logic, upgraded embedding model).
- Version the embedding model in chunk metadata — a model upgrade requires
  a full re-embed, and mixed-version indexes silently corrupt similarity
  rankings.

## Common Pitfalls (reject in review)

- Naive fixed-size chunking that splits mid-sentence or mid-table.
- No chunk provenance/metadata — citations become impossible later.
- Mixing embeddings from different models in one index.
- Dense-only retrieval on a corpus with exact-match-sensitive content
  (IDs, codes, names) — add BM25/hybrid search.
- Stuffing the context window with too many low-relevance chunks.
- No evaluation set — chunking/model changes shipped on vibes.
- No faithfulness check — hallucinated claims presented as grounded.
- Reindexing the entire corpus on every document change instead of
  incremental upsert.
- Silent index drift after an embedding-model upgrade (no re-embed, mixed
  vector versions coexisting).

## Production Readiness Checklist

- [ ] Chunking respects document structure, stores provenance metadata
- [ ] Embedding model documented, versioned, consistent across the index
- [ ] Vector store choice matches scale/filtering needs (pgvector vs. Qdrant vs. FAISS vs. Chroma)
- [ ] Hybrid search (BM25 + dense) evaluated, not assumed unnecessary
- [ ] Reranking applied on a wide candidate set before context selection
- [ ] Context window budget explicit, deduplicated, ranked before truncation
- [ ] Citations required per claim, verifiable against retrieved chunks
- [ ] Faithfulness/grounding check in place for high-stakes answers
- [ ] Fixed evaluation set (recall@k, faithfulness) run before and after pipeline changes
- [ ] Incremental index update strategy defined, including deletions and model-version upgrades
