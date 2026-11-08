---
name: python-automation
description: Practical Python scripting for automating repetitive tasks—file operations, regex, web scraping, document processing, email, time scheduling, and GUI automation using production-ready libraries.
origin: Automate the Boring Stuff with Python (2nd ed.)
---

# Python Task Automation

Scripting patterns for eliminating manual, repetitive work via Python's standard
library and a small set of production-ready third-party libraries.

## When to use this skill

- Renaming, moving, or reorganizing large batches of files
- Extracting or validating data from web pages, PDFs, or spreadsheets
- Automating GUI workflows or form submissions (data entry, testing)
- Generating reports pulled from Excel, PDF, CSV, or email sources
- Transforming document formats (CSV↔Excel, image resizing, PDF merging)
- Scheduling or triggering scripts on a time-based or event-based cadence

## Core principles

- Prefer the standard library first; add a third-party dependency only when
  the stdlib genuinely lacks the capability (HTML parsing, Excel I/O, browser
  automation).
- Every automation script must handle failure explicitly — network, file, and
  parsing operations fail eventually in production, never "eventually never."
- Dry-run destructive operations (delete, overwrite, bulk-rename) before
  committing to them: log the planned action first, execute after review.
- Idempotency matters — a script re-run after a partial failure should not
  duplicate work or corrupt state.

## File system operations

Use `pathlib.Path` for all paths — never string concatenation. Forward
slashes in `Path()` work cross-platform.

```python
from pathlib import Path

src = Path("documents") / "report.pdf"
for path in Path("data").rglob("*.csv"):          # recursive glob
    if path.stat().st_size == 0:
        path.unlink()                              # delete empty files

Path("archive").mkdir(parents=True, exist_ok=True)  # safe, no-op if exists
```

- `shutil.copy()` / `shutil.move()` for cross-filesystem-safe operations
  (`os.rename` fails across drives).
- `send2trash` instead of `Path.unlink()` for user-facing "delete" — recoverable.
- Walk directory trees with `Path.rglob(pattern)`, not manual `os.walk` string
  joining.

## Regular expressions

Compile once, reuse — recompiling inside a loop is wasted work and, at scale,
measurable overhead.

```python
import re

NAME_PATTERN = re.compile(r"\b[A-Z][a-z]+\s[A-Z][a-z]+\b")
matches = NAME_PATTERN.findall(text)
```

Reference:

| Token | Meaning |
| --- | --- |
| `\d`, `\w`, `\s` | digit, word char, whitespace (negate: `\D`, `\W`, `\S`) |
| `+`, `*`, `?` | one-or-more, zero-or-more, zero-or-one |
| `{n,m}` | between n and m repetitions |
| `[a-z0-9]` / `[^abc]` | character class / negated class |
| `(...)` | capture group; `(?:...)` non-capturing |
| `^`, `$` | start / end anchors |

- `.` never matches `\n` unless `re.DOTALL` is set.
- Use raw strings (`r"..."`) for every pattern — avoids double-escaping backslashes.
- Prefer named groups (`(?P<year>\d{4})`) over positional indices for
  multi-group patterns — self-documenting, resilient to reordering.

## Web scraping

```python
import httpx
from bs4 import BeautifulSoup

response = httpx.get(url, timeout=10, follow_redirects=True)
response.raise_for_status()
soup = BeautifulSoup(response.text, "html.parser")
titles = [tag.get_text(strip=True) for tag in soup.select("h2.title")]
```

- Always set an explicit timeout — an unbounded request hangs the whole
  pipeline on a single unresponsive host.
- Dynamic/JavaScript-rendered content requires browser automation (Playwright
  or Selenium), not `BeautifulSoup` alone — static HTML fetchers never see
  content injected by client-side JS.
- Respect `robots.txt` and rate limits; add jittered delay between requests.
- Set a realistic `User-Agent` header — many sites block the default
  library one; browser-automation tools set this automatically.
- CSS selectors (`.select()`) over manual tree traversal for readability and
  resilience to markup reordering.

## Excel and PDF processing

**Libraries:** `openpyxl` (Excel), `pypdf` (PDF), `python-docx` (Word).

```python
from openpyxl import Workbook, load_workbook

wb = load_workbook("input.xlsx")
ws = wb.active
for row in ws.iter_rows(min_row=2, values_only=True):   # skip header
    process(row)

wb_out = Workbook()
wb_out.active["A1"] = "Header"
wb_out.save("output.xlsx")
```

```python
from pypdf import PdfReader, PdfWriter

writer = PdfWriter()
for filename in ("file1.pdf", "file2.pdf"):
    writer.append(PdfReader(filename))
writer.write("merged.pdf")
```

- Cell references are 1-indexed (`A1`, never `A0`).
- PDF text extraction is fragile — PDFs carry no semantic structure; expect
  layout/formatting loss and validate output rather than trusting it blindly.
- `python-docx` reads/writes `.docx` only, not legacy `.doc` or PDF.
- Stream large workbooks with `read_only=True` / `write_only=True` modes
  instead of loading the full file into memory.

## Time-based scheduling

```python
import time
import schedule

def job() -> None:
    process_daily_report()

schedule.every().day.at("09:00").do(job)
while True:
    schedule.run_pending()
    time.sleep(60)
```

- For anything beyond a single long-running script, prefer OS-level
  scheduling (cron, systemd timers, Task Scheduler) or a job queue — a
  `while True` loop is fragile against crashes and restarts.
- Use `time.monotonic()`, never `time.time()`, when measuring elapsed
  duration — immune to system clock adjustments.
- Log every scheduled run's start/end/outcome; a silent scheduler hides
  missed or failed executions.

## GUI and keyboard/mouse automation

**Libraries:** `pyautogui`, `pynput`.

```python
import pyautogui

pyautogui.FAILSAFE = True   # move mouse to a screen corner to abort
position = pyautogui.locateCenterOnScreen("button.png", confidence=0.9)
if position:
    pyautogui.click(position)
```

- Screen-coordinate automation is inherently brittle — resolution, DPI
  scaling, and window position all break it; prefer image/OCR anchors
  (`locateOnScreen`) over hardcoded pixel coordinates.
- Test on the exact target system/resolution before scheduling unattended;
  never assume dev-machine coordinates transfer.
- Always keep `FAILSAFE` enabled during development for a manual abort path.
- Prefer accessibility APIs or native automation frameworks over pixel-level
  GUI scripting whenever the target application exposes one.

## Email automation

**Libraries:** `smtplib` + `email` (send), `imaplib` + `email` (read).

```python
import smtplib
from email.message import EmailMessage

message = EmailMessage()
message["Subject"] = "Report"
message["From"] = sender_address
message["To"] = recipient_address
message.set_content(body_text)

with smtplib.SMTP_SSL("smtp.example.com", 465, timeout=10) as server:
    server.login(username, password)
    server.send_message(message)
```

- Never hardcode credentials — load from environment variables or a secrets
  manager, not a config file committed to version control.
- Use `SMTP_SSL`/`starttls()` — plaintext SMTP leaks credentials on the wire.
- Set an explicit `timeout` on every SMTP/IMAP connection.
- Batch-send with a single persistent connection rather than reconnecting
  per message.

## Error resilience

```python
import logging

try:
    data = httpx.get(url, timeout=10).raise_for_status().json()
except (httpx.TimeoutException, httpx.HTTPStatusError, ValueError):
    logging.exception("Failed to fetch data from %s", url)
    data = None
```

- Catch specific exception types — a bare `except:` (or `except Exception:`)
  hides bugs and masks `KeyboardInterrupt`/`SystemExit`.
- Log with `exc_info=True` (or `logging.exception()` inside an `except`
  block) to preserve the traceback; a message alone is not enough to debug
  a failure that happened once, unattended, at 3am.
- Include context in every error message — filename, URL, row index, or
  input value — a bare "failed" is unactionable in a log stream.
- Retry transient failures (network, rate limits) with backoff; fail fast
  and loudly on programmer errors (bad arguments, missing files).

## Common pitfalls (reject in review)

- **No error handling.** Network, file, and parsing calls always fail
  eventually — wrap them, don't assume the happy path.
- **Parsing HTML with regex.** Use `BeautifulSoup`/`lxml`; regex breaks on
  any whitespace or markup change.
- **Hardcoded credentials or file paths.** Use env vars/config, and
  `pathlib.Path` for portability.
- **String concatenation for paths.** Breaks cross-platform; use `pathlib`.
- **Mutating a collection while iterating it.** Collect changes, apply after
  the loop.
- **Recompiling a regex pattern inside a loop.** Compile once at module
  scope, reuse.

## Pre-flight checklist

- [ ] Regex patterns compiled once at module scope, reused across calls
- [ ] Every network/file/parse call wrapped in a specific exception handler
- [ ] Destructive operations (delete, overwrite) dry-run or logged before execution
- [ ] Credentials loaded from env vars/secrets manager, never hardcoded
- [ ] Batch operations collect modifications first, apply after (avoid
      iteration-during-modification bugs)
- [ ] Error messages include context (filename, URL, input value) for debugging
- [ ] Explicit timeout set on every network call
