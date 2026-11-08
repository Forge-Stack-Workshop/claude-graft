#!/usr/bin/env node
// archify-export — headless export of a delivered Archify HTML to PNG / PDF / SVG,
// in light and/or dark theme, at full resolution. Does NOT touch the upstream skill.
//
// Usage:
//   archify-export <input.html> [--out-dir DIR] [--themes light,dark]
//        [--formats png,pdf,svg] [--scale 2] [--width 1600] [--height 2000] [--keep-margins]
//
// Chrome binary: $ARCHIFY_CHROME, else common locations are probed.

import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve, dirname } from 'node:path';

function fail(msg) { console.error('archify-export: ' + msg); process.exit(1); }

function parseArgs(argv) {
  const a = { themes: ['light', 'dark'], formats: ['png'], scale: 2, width: 1600, height: 2000, keepMargins: false };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === '--out-dir') a.outDir = argv[++i];
    else if (t === '--themes') a.themes = argv[++i].split(',').map(s => s.trim()).filter(Boolean);
    else if (t === '--formats') a.formats = argv[++i].split(',').map(s => s.trim()).filter(Boolean);
    else if (t === '--scale') a.scale = Number(argv[++i]);
    else if (t === '--width') a.width = Number(argv[++i]);
    else if (t === '--height') a.height = Number(argv[++i]);
    else if (t === '--keep-margins') a.keepMargins = true;
    else if (t.startsWith('--')) fail('unknown flag ' + t);
    else rest.push(t);
  }
  if (rest.length !== 1) fail('exactly one <input.html> is required');
  a.input = resolve(rest[0]);
  return a;
}

function findChrome() {
  const cand = [process.env.ARCHIFY_CHROME];
  try {
    const g = spawnSync('bash', ['-lc',
      'ls ~/.cache/puppeteer/chrome/*/chrome-linux*/chrome 2>/dev/null | head -1'], { encoding: 'utf8' });
    if (g.stdout) cand.push(g.stdout.trim());
  } catch { /* ignore */ }
  cand.push('/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/brave-browser');
  for (const c of cand) if (c && existsSync(c)) return c;
  fail('no Chrome/Chromium found — set ARCHIFY_CHROME to its path');
}

function hasMagick() {
  return spawnSync('bash', ['-lc', 'command -v magick || command -v convert'], { encoding: 'utf8' }).stdout.trim();
}

// Produce a theme-forced copy. The viewer re-applies its own theme via JS after load,
// so rewriting the root attribute is not enough: we also inject a late script that
// re-forces data-theme (and localStorage) after the viewer's own initialisation.
function themedCopy(html, theme, dir) {
  let forced = html.replace(
    /(<html\b[^>]*\bdata-theme=")(?:dark|light)(")/i,
    `$1${theme}$2`
  );
  const script = `<script>(function(){var t=${JSON.stringify(theme)};` +
    `try{localStorage.setItem('archify-theme',t);}catch(e){}` +
    `function set(){document.documentElement.setAttribute('data-theme',t);}` +
    `set();document.addEventListener('DOMContentLoaded',set);` +
    `[50,200,500,900].forEach(function(d){setTimeout(set,d);});})();</script>`;
  if (/<\/body>/i.test(forced)) forced = forced.replace(/<\/body>/i, script + '</body>');
  else forced += script;
  const p = join(dir, `themed-${theme}.html`);
  writeFileSync(p, forced);
  return p;
}

function chromeRun(chrome, args) {
  return spawnSync(chrome, [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
    '--disable-dev-shm-usage', '--virtual-time-budget=10000',
    '--run-all-compositor-stages-before-draw', ...args
  ], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, timeout: 45000, killSignal: 'SIGKILL' });
}

function exportPng(chrome, magick, themed, out, a) {
  const r = chromeRun(chrome, [
    `--force-device-scale-factor=${a.scale}`,
    `--window-size=${a.width},${a.height}`,
    `--screenshot=${out}`, `file://${themed}`
  ]);
  if (!existsSync(out)) fail('png capture failed\n' + (r.stderr || ''));
  if (!a.keepMargins && magick) {
    const bin = magick.split('\n')[0];
    spawnSync(bin, [out, '-fuzz', '4%', '-trim', '+repage', out]);
  }
}

function exportPdf(chrome, themed, out) {
  chromeRun(chrome, ['--no-pdf-header-footer', `--print-to-pdf=${out}`, `file://${themed}`]);
  if (!existsSync(out)) fail('pdf print failed');
}

// Standalone SVG: dump the post-render DOM, lift the single <svg> plus the document
// <style> blocks so CSS custom properties resolve without the host page.
function exportSvg(chrome, themed, out) {
  const r = chromeRun(chrome, ['--dump-dom', `file://${themed}`]);
  const dom = r.stdout || '';
  const svgMatch = dom.match(/<svg\b[\s\S]*?<\/svg>/i);
  if (!svgMatch) fail('svg not found in rendered DOM');
  const styles = [...dom.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)]
    .map(m => m[1]).join('\n')
    // guard against a literal ]]> ending the CDATA early
    .replace(/]]>/g, ']]]]><![CDATA[>');
  let svg = svgMatch[0];
  // The DOM-lifted <svg> lacks the XML namespace (implicit in HTML, required for a
  // standalone .svg — without it a browser shows the XML tree instead of rendering).
  if (!/\bxmlns=/.test(svg)) {
    svg = svg.replace(/<svg\b/i, '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"');
  }
  // CSS is not XML: `<`, `&`, `>` combinators break the parser. Wrap in CDATA so the
  // standalone .svg is valid XML and renders without the host page.
  svg = svg.replace(/(<svg\b[^>]*>)/i, `$1<style type="text/css"><![CDATA[\n${styles}\n]]></style>`);
  writeFileSync(out, '<?xml version="1.0" encoding="UTF-8"?>\n' + svg);
}

function main() {
  const a = parseArgs(process.argv.slice(2));
  if (!existsSync(a.input)) fail('input not found: ' + a.input);
  const chrome = findChrome();
  const magick = hasMagick();
  const outDir = a.outDir ? resolve(a.outDir) : dirname(a.input);
  mkdirSync(outDir, { recursive: true });
  const stem = basename(a.input).replace(/\.html?$/i, '');
  const html = readFileSync(a.input, 'utf8');
  const work = mkdtempSync(join(tmpdir(), 'archify-export-'));
  const produced = [];
  try {
    for (const theme of a.themes) {
      const themed = themedCopy(html, theme, work);
      for (const fmt of a.formats) {
        const out = join(outDir, `${stem}.${theme}.${fmt}`);
        if (fmt === 'png') exportPng(chrome, magick, themed, out, a);
        else if (fmt === 'pdf') exportPdf(chrome, themed, out);
        else if (fmt === 'svg') exportSvg(chrome, themed, out);
        else fail('unknown format ' + fmt);
        produced.push(out);
      }
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
  console.log(JSON.stringify({ ok: true, input: a.input, chrome, trimmed: !a.keepMargins && !!magick, produced }, null, 2));
}

main();
