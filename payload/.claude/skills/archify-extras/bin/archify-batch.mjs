#!/usr/bin/env node
// archify-batch — validate + deliver (+ optional export) many Archify specs at once.
// Wraps the upstream CLI; does not modify it.
//
// Usage:
//   archify-batch <spec1.json> [spec2.json ...] [--archify DIR] [--out-dir DIR]
//        [--quality showcase|standard] [--export png,pdf,svg] [--themes light,dark]
//
// Type per spec comes from its `diagram_type` field (fallback: *.<type>.json name).

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import { basename, join, resolve, dirname } from 'node:path';

function fail(m) { console.error('archify-batch: ' + m); process.exit(1); }

function parseArgs(argv) {
  const a = { specs: [], quality: 'showcase' };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === '--archify') a.archify = argv[++i];
    else if (t === '--out-dir') a.outDir = argv[++i];
    else if (t === '--quality') a.quality = argv[++i];
    else if (t === '--export') a.export = argv[++i];
    else if (t === '--themes') a.themes = argv[++i];
    else if (t.startsWith('--')) fail('unknown flag ' + t);
    else a.specs.push(resolve(t));
  }
  if (!a.specs.length) fail('at least one spec is required');
  return a;
}

function resolveArchify(dir) {
  const cand = [dir, join(process.env.HOME || '', '.claude/skills/archify')].filter(Boolean);
  for (const c of cand) if (existsSync(join(c, 'bin/archify.mjs'))) return c;
  fail('upstream archify not found — pass --archify <dir>');
}

function typeOf(spec) {
  try { const d = JSON.parse(readFileSync(spec, 'utf8')); if (d.diagram_type) return d.diagram_type; } catch { /* */ }
  const m = basename(spec).match(/\.(architecture|workflow|sequence|dataflow|lifecycle)\.json$/i);
  if (m) return m[1].toLowerCase();
  fail('cannot determine type for ' + spec + ' (no diagram_type, no .<type>.json suffix)');
}

function run(cmd, args, cwd) {
  return spawnSync('node', [cmd, ...args], { cwd, encoding: 'utf8' });
}

function main() {
  const a = parseArgs(process.argv.slice(2));
  const archify = resolveArchify(a.archify);
  const cli = join(archify, 'bin/archify.mjs');
  const exporter = join(dirname(new URL(import.meta.url).pathname), 'archify-export.mjs');
  const results = [];
  let failures = 0;
  for (const spec of a.specs) {
    const type = typeOf(spec);
    const outDir = a.outDir ? resolve(a.outDir) : dirname(spec);
    mkdirSync(outDir, { recursive: true });
    const html = join(outDir, basename(spec).replace(/\.json$/i, '.html'));
    const v = run(cli, ['validate', type, spec, `--quality`, a.quality], archify);
    if (v.status !== 0) { failures++; results.push({ spec, type, stage: 'validate', ok: false, detail: (v.stdout + v.stderr).trim().split('\n').slice(-3) }); continue; }
    const d = run(cli, ['deliver', type, spec, html, `--quality`, a.quality, '--json'], archify);
    if (d.status !== 0) { failures++; results.push({ spec, type, stage: 'deliver', ok: false }); continue; }
    const entry = { spec, type, ok: true, html };
    if (a.export) {
      const ex = run(exporter, [html, '--out-dir', outDir, '--formats', a.export, ...(a.themes ? ['--themes', a.themes] : [])]);
      entry.exported = ex.status === 0;
      if (ex.status !== 0) entry.exportError = (ex.stderr || '').trim().split('\n').slice(-2);
    }
    results.push(entry);
  }
  console.log(JSON.stringify({ ok: failures === 0, archify, count: a.specs.length, failures, results }, null, 2));
  process.exit(failures === 0 ? 0 : 1);
}

main();
