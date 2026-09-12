---
name: web-scraping-extraction
description: Web scraping and structured data extraction — HTTP requests (httpx/requests), HTML parsing (BeautifulSoup/lxml, CSS/XPath selectors), JS rendering (Playwright), pagination/crawling, rate limiting and politeness, retries, deduplication, and legal/ethical constraints.
origin: authored
---

# Web Scraping & Extraction

Fetching and extracting structured data from web pages, reliably and lawfully.

## Prerequisites (preflight)

Before using this skill, ensure you have the required packages installed.

**Python packages:**
```bash
# Check for BeautifulSoup4 and lxml
python -c "import bs4, lxml" || echo "WARN: pip install beautifulsoup4 lxml"

# Check for Playwright
command -v playwright || echo "WARN: pip install playwright && playwright install"
```

## When to Activate

- Pulling structured data from a website with no public API
- Rendering JS-heavy pages before extraction
- Building a crawler that follows pagination or links
- Designing rate limiting, retries, or proxy rotation for a scraper
- Reviewing an existing scraper for fragility or ban risk
- Checking legal/ethical constraints before scraping a target site

## Legal & Ethical Baseline (read first)

Non-negotiable, before writing any code:

- **Respect `robots.txt`** — parse it (`urllib.robotparser` or `reppy`) and skip disallowed
  paths. A `robots.txt` allowance is not legal permission; it is a minimum courtesy check.
- **Respect Terms of Service** — scraping in violation of a site's ToS can create legal
  exposure (contract, CFAA-style computer-abuse claims depending on jurisdiction). Read
  the ToS for commercial/high-volume use.
- **Never bypass authentication or paywalls** — scraping behind a login only with valid,
  authorized credentials for that account, never shared/stolen credentials, never
  session-token theft.
- **No CAPTCHA/anti-bot circumvention** — solving or bypassing CAPTCHAs, or spoofing
  browser fingerprints specifically to defeat bot detection, crosses from scraping into
  unauthorized access. Stop and use an official API or licensed data feed instead.
- **PII handling** — do not collect personal data (names, emails, phone numbers, faces)
  beyond what the task requires; do not build individual profiles by aggregating across
  sources without a lawful basis (GDPR/CCPA apply if the subject or operator is in scope).
  Anonymize/hash identifiers as early as possible in the pipeline.
- **Prefer official APIs / RSS / sitemaps first** — scraping HTML is the last resort,
  not the default.
- **Identify yourself** — a real `User-Agent` with contact info, not a spoofed browser
  string, unless the site explicitly expects browser-like traffic.

If any of the above cannot be satisfied, do not build the scraper — flag it to the user.

## Choosing the Fetch Method

| Situation | Tool |
| --- | --- |
| Static HTML, no JS rendering needed | `httpx` / `requests` |
| Need async concurrency at scale | `httpx.AsyncClient` |
| Content rendered client-side (SPA, infinite scroll) | Playwright |
| Site exposes JSON/XML feed or API | Use that directly — skip HTML parsing entirely |

### Static Fetch (httpx)

```python
import httpx

HEADERS = {"User-Agent": "MyCompanyBot/1.0 (+https://example.com/bot; contact@example.com)"}

def fetch(url: str, client: httpx.Client) -> httpx.Response:
    response = client.get(url, headers=HEADERS, timeout=10.0, follow_redirects=True)
    response.raise_for_status()
    return response

with httpx.Client() as client:
    response = fetch("https://example.com/page", client)
```

### JS-Rendered Fetch (Playwright)

Use only when static fetch returns incomplete/empty content.

```python
from playwright.sync_api import sync_playwright

def fetch_rendered(url: str) -> str:
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page(user_agent="MyCompanyBot/1.0 (+contact@example.com)")
        page.goto(url, wait_until="networkidle", timeout=15000)
        content = page.content()
        browser.close()
    return content
```

**Cost note:** Playwright is 10-50x heavier than a plain HTTP request. Only reach for it
when content genuinely requires JS execution; verify first with `httpx` + view-source.

## Parsing

### CSS Selectors (BeautifulSoup)

```python
from bs4 import BeautifulSoup

soup = BeautifulSoup(response.text, "lxml")
titles = [element.get_text(strip=True) for element in soup.select("article h2.title")]
```

### XPath (lxml)

```python
from lxml import html

tree = html.fromstring(response.text)
prices = tree.xpath("//span[@class='price']/text()")
```

### Resilient Selectors

Selectors built on presentation classes (`div.col-md-6.mt-2`) break on every redesign.
Prefer, in order of stability:

1. Semantic attributes: `data-testid`, `itemprop`, `id` on stable elements.
2. Structured data embedded in the page: JSON-LD (`<script type="application/ld+json">`),
   OpenGraph/microdata meta tags — parse these before falling back to visual HTML.
3. Text/label-anchored traversal (`//label[text()='Price']/following-sibling::span`).
4. Presentation CSS classes — last resort, expect frequent breakage.

```python
import json

def extract_json_ld(soup: BeautifulSoup) -> list[dict]:
    scripts = soup.find_all("script", type="application/ld+json")
    return [json.loads(script.string) for script in scripts if script.string]
```

## Structured Feeds Over HTML

Always check for these before parsing raw HTML — they are stable contracts, not
presentation details:

- RSS/Atom feeds (`/feed`, `/rss.xml`) — parse with `feedparser`.
- Sitemaps (`/sitemap.xml`) — enumerate URLs without crawling links.
- JSON endpoints backing the page (inspect network tab; often the same data, cleaner).
- `robots.txt` `Sitemap:` directive points to the canonical sitemap location.

## Pagination & Crawling

```python
def crawl_paginated(base_url: str, client: httpx.Client, max_pages: int = 50) -> list[dict]:
    results = []
    page_number = 1
    while page_number <= max_pages:
        response = fetch(f"{base_url}?page={page_number}", client)
        items = parse_page(response.text)
        if not items:
            break
        results.extend(items)
        page_number += 1
        time.sleep(RATE_LIMIT_DELAY_SECONDS)
    return results
```

- Cap `max_pages` explicitly — never crawl unbounded.
- Detect end-of-pagination by empty result set or a `next` link absence, not a hardcoded
  page count guess.
- For link-following crawls, track visited URLs in a `set` to avoid cycles.

## Rate Limiting & Politeness

- Add a delay between requests (`time.sleep`), tuned to the target's `Crawl-delay` in
  `robots.txt` if present, else a conservative default (1-2s for unknown sites).
- Limit concurrency (semaphore/connection pool cap) — never fire unbounded parallel
  requests at one host.
- Respect `Retry-After` headers on 429/503 responses.
- Cache responses locally during development to avoid re-hitting the target while
  iterating on the parser.

```python
import asyncio

class RateLimiter:
    def __init__(self, requests_per_second: float) -> None:
        self._min_interval = 1.0 / requests_per_second
        self._last_call = 0.0

    async def wait(self) -> None:
        elapsed = asyncio.get_event_loop().time() - self._last_call
        if elapsed < self._min_interval:
            await asyncio.sleep(self._min_interval - elapsed)
        self._last_call = asyncio.get_event_loop().time()
```

## User-Agent & Proxy Rotation

- Rotate user-agents only to distribute load across a legitimate multi-worker crawl —
  not to disguise bot traffic from a site that has blocked you (that is circumvention).
- Proxy rotation is legitimate for distributing legitimate request volume across IPs
  you control or lease; it is not a workaround for a site that has explicitly denied
  access to your bot.
- If a site returns 403/429 consistently, treat that as a signal to slow down or stop,
  not to route around the block.

## Robustness

### Retries with Backoff

```python
import httpx
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

@retry(
    retry=retry_if_exception_type(httpx.HTTPStatusError),
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=30),
)
def fetch_with_retry(url: str, client: httpx.Client) -> httpx.Response:
    response = client.get(url, timeout=10.0)
    response.raise_for_status()
    return response
```

- Retry only on transient errors (429, 500-504, timeouts) — never retry 4xx client
  errors that indicate a genuine block or missing resource.
- Set a request timeout always; an unbounded scraper hangs the whole pipeline on one
  slow host.

### Deduplication

```python
def deduplicate_by_key(items: list[dict], key: str) -> list[dict]:
    seen: set[str] = set()
    unique_items = []
    for item in items:
        if item[key] not in seen:
            seen.add(item[key])
            unique_items.append(item)
    return unique_items
```

- Dedupe on a stable natural key (URL, SKU, canonical ID), not on full-row equality —
  fields like timestamps or ad content vary between crawls of the same entity.
- For large-scale crawls, use a persistent seen-set (Redis set, DB unique constraint)
  instead of an in-memory `set` that resets per run.

## Storage

- Store raw fetched HTML/JSON alongside parsed output during development — lets you
  re-parse without re-fetching when the parser has a bug.
- Persist structured output to a schema (DB table, Parquet, JSON Lines) with explicit
  field types, not loose dicts — validate with Pydantic before storage.
- Record extraction metadata: `source_url`, `fetched_at`, `parser_version` — needed to
  debug drift when a site changes its markup.

```python
from pydantic import BaseModel, HttpUrl
from datetime import datetime

class ExtractedItem(BaseModel):
    source_url: HttpUrl
    fetched_at: datetime
    title: str
    price: float | None = None
```

## Common Pitfalls (reject in review)

- Selectors tied to auto-generated CSS classes (`.css-1a2b3c`) — brittle, breaks on
  every frontend rebuild.
- No timeout on requests — one slow/hanging host stalls the entire crawl.
- No rate limiting — triggers IP bans and degrades the target site for others.
- Ignoring `robots.txt` or scraping behind auth without authorization.
- Retrying 4xx errors indefinitely instead of treating them as terminal.
- Collecting more PII than the task requires, or storing it unhashed/unencrypted.
- Silent failures — a selector returning `[]` treated as "no data" instead of a raised
  parsing alert; sites change markup without notice.
- Single point-in-time scraper with no monitoring for structural drift.
- Hardcoded pagination page counts instead of detecting end-of-results.
- Spoofing a full browser fingerprint to defeat bot detection instead of stopping and
  seeking an official API.

## Pre-Build Checklist

- [ ] Checked for an official API, RSS feed, or sitemap before planning HTML parsing
- [ ] Read and will respect `robots.txt` (`Disallow`, `Crawl-delay`, `Sitemap`)
- [ ] Reviewed ToS for the target site (especially for commercial/high-volume use)
- [ ] Identifies itself with a real, non-spoofed `User-Agent` including contact info
- [ ] No authentication bypass, paywall circumvention, or CAPTCHA solving involved
- [ ] Rate limiting and concurrency caps defined before first run
- [ ] Retries limited to transient errors, with exponential backoff and a max attempt cap
- [ ] Selectors prefer JSON-LD/structured data/semantic attributes over CSS classes
- [ ] Deduplication key defined and stable across crawls
- [ ] PII minimized, and any collected PII has a documented lawful basis
- [ ] Output validated against a typed schema before storage
- [ ] Extraction metadata (`source_url`, `fetched_at`) recorded for traceability
