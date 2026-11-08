#!/usr/bin/env bash
# pdf2md.sh — Convert a PDF (file, directory, or URL) to Markdown using Docling.
#
# Runs Docling through `uvx` in an isolated, pinned-Python environment so it never
# touches the local (polluted, 3.14) pyenv. Uses the system `tesseract` binary for
# OCR to avoid pulling EasyOCR/torchvision on top of Docling's already-heavy deps.
#
# OCR strategy:
#   - auto  (default): Docling OCRs detected bitmap regions. If the produced
#                      Markdown comes back nearly empty (a scanned PDF whose text
#                      layer is missing or unusable), we automatically retry with
#                      --force-ocr, which re-OCRs the whole page.
#   - force          : skip detection, --force-ocr from the start (best for PDFs
#                      with a known-bad/garbled hidden text layer).
#   - off            : --no-ocr (fastest; born-digital PDFs with a clean text layer).
#
# Usage:
#   pdf2md.sh <input> [--out DIR] [--ocr auto|force|off] [--lang eng+fra] [--images referenced|placeholder|embedded]
#
# Examples:
#   pdf2md.sh report.pdf
#   pdf2md.sh scan.pdf --ocr force --lang fra
#   pdf2md.sh ./pdfs --out ./markdown
#   pdf2md.sh https://arxiv.org/pdf/2206.01062

set -euo pipefail

PY_VERSION="3.12"          # Docling/torch lack 3.14 wheels; pin a known-good Python.
OCR_MODE="auto"
LANG_OPT="eng+fra"
IMAGES="referenced"
OUT_DIR="./markdown"
INPUT=""

err() { printf '\033[31m%s\033[0m\n' "$*" >&2; }
info() { printf '\033[36m%s\033[0m\n' "$*" >&2; }

# --- parse args ---
while [[ $# -gt 0 ]]; do
  case "$1" in
    --out)    OUT_DIR="$2"; shift 2 ;;
    --ocr)    OCR_MODE="$2"; shift 2 ;;
    --lang)   LANG_OPT="$2"; shift 2 ;;
    --images) IMAGES="$2"; shift 2 ;;
    -h|--help) sed -n '2,30p' "$0"; exit 0 ;;
    -*)       err "Unknown option: $1"; exit 2 ;;
    *)        INPUT="$1"; shift ;;
  esac
done

[[ -n "$INPUT" ]] || { err "No input given. Pass a PDF file, directory, or URL."; exit 2; }
command -v uv >/dev/null 2>&1 || { err "uv is required (https://docs.astral.sh/uv/). Install it, then retry."; exit 1; }

case "$OCR_MODE" in auto|force|off) ;; *) err "--ocr must be auto|force|off"; exit 2 ;; esac

mkdir -p "$OUT_DIR"

# Common Docling flags. The `tesseract` engine shells out to the system binary.
COMMON=( --to md --output "$OUT_DIR" --image-export-mode "$IMAGES" )
[[ "$OCR_MODE" != "off" ]] && COMMON+=( --ocr-engine tesseract --ocr-lang "$LANG_OPT" )

run_docling() {
  # $@ = extra flags. uvx caches the env after the first (heavy) run.
  uvx --python "$PY_VERSION" --from docling docling "${COMMON[@]}" "$@" "$INPUT"
}

# Average embedded-text chars per page for a local PDF, via pypdf. Echoes -1 if the
# input isn't a single readable local PDF (directory/URL/unreadable) so callers can
# fall back to the output-based safety net instead.
embedded_text_per_page() {
  [[ -f "$INPUT" ]] || { echo -1; return; }
  uvx --python "$PY_VERSION" --from pypdf python - "$INPUT" 2>/dev/null <<'PY' || echo -1
import sys
from pypdf import PdfReader
r = PdfReader(sys.argv[1])
pages = max(1, len(r.pages))
chars = sum(len((p.extract_text() or "").strip()) for p in r.pages)
print(chars // pages)
PY
}

# Total non-whitespace chars across Markdown files in OUT_DIR — a last-resort "did we
# get literally nothing?" probe for inputs we couldn't pre-inspect (dirs, URLs).
md_char_count() {
  local total=0 c
  shopt -s nullglob
  for f in "$OUT_DIR"/*.md; do
    c=$(tr -d '[:space:]' < "$f" | wc -c)
    total=$((total + c))
  done
  shopt -u nullglob
  echo "$total"
}

case "$OCR_MODE" in
  off)
    info "Converting without OCR…"
    run_docling --no-ocr
    ;;
  force)
    info "Converting with forced full-page OCR (lang: $LANG_OPT)…"
    run_docling --force-ocr
    ;;
  auto)
    # Decide up front from the PDF's own text layer. A real text layer means the doc is
    # born-digital — forcing OCR there only *degrades* clean text, so we must not. A
    # missing text layer means it's a scan that needs full-page OCR. This is one pass,
    # and it avoids the trap of misreading a legitimately short document as "empty".
    perpage=$(embedded_text_per_page)
    if [[ "$perpage" -ge 0 && "$perpage" -lt 50 ]]; then
      info "No usable text layer (${perpage} chars/page) — treating as a scan, forcing OCR…"
      run_docling --force-ocr
    elif [[ "$perpage" -ge 50 ]]; then
      info "Text layer present (${perpage} chars/page) — born-digital, OCR-ing only figures…"
      run_docling
    else
      # Directory or URL: can't pre-inspect. Run normally, then force-OCR only if the
      # result is essentially empty (nothing extracted at all).
      info "Converting (auto OCR of bitmap regions)…"
      run_docling
      if [[ "$(md_char_count)" -lt 30 ]]; then
        info "Result is essentially empty — retrying with --force-ocr…"
        run_docling --force-ocr
      fi
    fi
    ;;
esac

info "Done. Markdown written to: $OUT_DIR"
ls -1 "$OUT_DIR"/*.md 2>/dev/null || true
