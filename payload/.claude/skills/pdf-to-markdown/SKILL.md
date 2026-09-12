---
name: pdf-to-markdown
description: Convert one or more PDFs into clean, saved Markdown (.md) files using Docling, with automatic OCR fallback for scanned or image-only PDFs (any language). Use whenever the user wants a persisted Markdown artifact they keep and reuse — converting a report, paper, contract, or invoice; extracting a PDF's text or tables into .md; batch-converting a whole folder of PDFs; OCR-ing scanned or photographed documents (e.g. French invoices) into editable Markdown; or building a Markdown corpus to chunk and embed for RAG. Triggers on phrasings like "convert this PDF to markdown", "turn these PDFs into .md", "extract the text into files", "récupérer le texte dans des fichiers markdown", or "version markdown", whether the user names a file, points at a folder, or just gestures at "these PDFs" — in English or French. Do NOT use it for answering or summarizing a PDF in chat (read it directly instead), filling PDF forms, compressing or merging PDFs, OCR of standalone image files, or converting non-PDF sources like .docx.
---

# PDF → Markdown (Docling)

Convert PDFs to high-quality Markdown with layout, tables, and figures preserved.
Docling uses ML layout/table models and OCR, so it handles born-digital PDFs **and**
scanned/image-only PDFs far better than naive text extraction.

## First, decide if you even need this

If the user just wants you to **understand or answer questions about** a PDF in this
conversation, don't convert — read it directly with the `Read` tool (`pages` parameter).
That's faster, needs no dependencies, and preserves layout/images visually.

Use this skill when the goal is a **persisted `.md` file** the user will reuse:
documentation, a RAG/ingestion corpus, archiving, diffing, or batch conversion.

## How to run it

A bundled script wraps everything. It runs Docling through `uvx` in an isolated,
pinned-Python environment (the local pyenv is 3.14, which lacks torch/Docling wheels),
and uses the system `tesseract` binary for OCR.

```bash
bash ~/.claude/skills/pdf-to-markdown/scripts/pdf2md.sh <input> [options]
```

`<input>` can be a single PDF, a directory of PDFs, or a URL.

| Option | Default | Meaning |
|---|---|---|
| `--out DIR` | `./markdown` | Output directory for the `.md` (and referenced images) |
| `--ocr auto\|force\|off` | `auto` | OCR strategy (see below) |
| `--lang eng+fra` | `eng+fra` | Tesseract languages (`+`-joined) |
| `--images referenced\|placeholder\|embedded` | `referenced` | How figures appear in the Markdown |

### OCR modes

- **`auto`** (default) — Docling OCRs detected bitmap regions. If the result comes back
  nearly empty (a scan with no usable text layer), the script automatically retries with
  full-page OCR. This is the right choice for mixed/unknown inputs.
- **`force`** — re-OCR the whole page from the start. Use when a PDF *has* a hidden text
  layer but it's garbled (auto won't detect "garbled", only "empty"), or for a known scan.
- **`off`** — fastest; only for clean born-digital PDFs where you trust the text layer.

### Image modes

`referenced` (default) saves figures next to the Markdown and links them — clean output.
Use `placeholder` for text-only Markdown (smallest, best for pure-text RAG). Avoid
`embedded` unless the user needs a single self-contained file; it base64-inlines images
and bloats the Markdown.

## Examples

```bash
# Born-digital report → ./markdown/report.md
bash ~/.claude/skills/pdf-to-markdown/scripts/pdf2md.sh report.pdf

# A French scanned document, forcing OCR
bash ~/.claude/skills/pdf-to-markdown/scripts/pdf2md.sh scan.pdf --ocr force --lang fra

# Batch-convert a folder into a corpus, text only
bash ~/.claude/skills/pdf-to-markdown/scripts/pdf2md.sh ./pdfs --out ./corpus --images placeholder

# Convert straight from a URL
bash ~/.claude/skills/pdf-to-markdown/scripts/pdf2md.sh https://arxiv.org/pdf/2206.01062
```

After running, report where the `.md` landed and skim it to confirm the conversion looks
sane (tables intact, no large empty sections). If a born-digital PDF produced garbled
text, rerun with `--ocr force`.

## Notes & troubleshooting

- **First run is slow.** `uvx` downloads Docling and its model weights (layout/table
  models, ~hundreds of MB) and a managed Python 3.12 once, then caches them. Subsequent
  runs are fast. Mention this to the user if they're waiting.
- **Requires `uv`** (already used as the runner) and, for OCR, the `tesseract` binary.
  Both are expected on this machine; if `uv` is missing the script says so.
- **Languages**: pass extra tesseract language packs via `--lang`, e.g. `eng+fra+deu`.
  Missing language data → install the corresponding `tesseract-ocr-<lang>` data files.
- **Math-heavy / scientific PDFs**: Docling handles equations reasonably, but for very
  formula-dense academic papers MinerU may extract LaTeX better — worth flagging to the
  user rather than silently producing imperfect output.
