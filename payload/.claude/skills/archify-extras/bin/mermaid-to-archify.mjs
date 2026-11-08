#!/usr/bin/env node
// mermaid-to-archify — convert a Mermaid diagram into an Archify JSON *scaffold*.
// Aligns with the rule "Mermaid is the source of truth": you keep the Mermaid,
// this emits valid Archify JSON topology you then validate/repair with the upstream CLI.
//
// Supported: flowchart/graph -> architecture ; sequenceDiagram -> sequence.
// Output is topology-correct and schema-valid at `standard` quality; run
//   node <archify>/bin/archify.mjs validate <type> <out.json> --quality showcase
// then apply the diagnosed geometry repairs for a showcase-grade result.
//
// Usage: mermaid-to-archify <input.mmd> [output.json] [--title "..."]

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';

function fail(m) { console.error('mermaid-to-archify: ' + m); process.exit(1); }

function parseArgs(argv) {
  const a = { rest: [], quality: 'standard', repair: 8 };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === '--title') a.title = argv[++i];
    else if (t === '--render') a.render = true;                 // also deliver an HTML
    else if (t === '--export') a.export = argv[++i];            // png,pdf,svg -> implies --render
    else if (t === '--themes') a.themes = argv[++i];
    else if (t === '--archify') a.archify = argv[++i];
    else if (t === '--quality') a.quality = argv[++i];
    else if (t === '--no-repair') a.repair = 0;
    else a.rest.push(t);
  }
  if (a.export) a.render = true;
  if (a.rest.length < 1) fail('usage: mermaid-to-archify <input.mmd> [output.json] [--title ...] [--render] [--export png,pdf,svg] [--themes light,dark] [--quality standard|showcase] [--archify DIR]');
  a.input = resolve(a.rest[0]);
  a.output = a.rest[1] ? resolve(a.rest[1]) : null;
  return a;
}

function findArchify(dir) {
  const cand = [dir, join(process.env.HOME || '', '.claude/skills/archify')].filter(Boolean);
  for (const c of cand) if (existsSync(join(c, 'bin/archify.mjs'))) return c;
  fail('upstream archify not found — pass --archify <dir>');
}

// Run upstream validate and return its human-readable diagnostics text.
function validateText(cli, type, jsonPath, quality, cwd) {
  const r = spawnSync('node', [cli, 'validate', type, jsonPath, '--quality', quality], { cwd, encoding: 'utf8' });
  return { ok: r.status === 0, text: (r.stdout || '') + (r.stderr || '') };
}

// Apply the validator's own "Suggested fix: labelAt [x, y]" hints. Handles both the
// `connections[N] ... labelAt [x, y]` form and the `Label "text" ... labelAt [x, y]` form.
function applyLabelRepairs(doc, text) {
  const conns = doc.connections || doc.messages || doc.transitions || [];
  let applied = 0;
  // form A: explicit connection index
  for (const m of text.matchAll(/connections\[(\d+)\][\s\S]*?labelAt \[(\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?)\]/g)) {
    const c = conns[Number(m[1])];
    if (c) { c.labelAt = [Math.round(+m[2]), Math.round(+m[3])]; applied++; }
  }
  // form B: label text + first suggested labelAt following it
  for (const m of text.matchAll(/Label "([^"]+)" overlaps[\s\S]*?labelAt \[(\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?)\]/g)) {
    const c = conns.find(x => x.label === m[1]);
    if (c && !c.labelAt) { c.labelAt = [Math.round(+m[2]), Math.round(+m[3])]; applied++; }
  }
  return applied;
}

// Apply the validator's "edge-through-node" crossings automatically. Architecture:
// detour the crossing edge through a clear horizontal channel below every node.
// Lifecycle: drop the edge out the bottom and into the top (the cross-lane pattern
// the upstream examples use). Each edge is routed at most once (guarded), so the
// repair loop makes monotone progress instead of thrashing.
function applyRoutingRepairs(doc, type, text) {
  let applied = 0;
  const idxs = new Set(
    [...text.matchAll(/(?:connections|transitions)\[(\d+)\][^\n]*crosses/g)].map(m => Number(m[1])),
  );
  if (idxs.size === 0) return 0;
  if (type === 'architecture') {
    const comps = doc.components;
    const rect = new Map(comps.map(c => [c.id, { x: c.pos[0], y: c.pos[1], w: c.size[0], h: c.size[1] }]));
    const channelY = Math.max(...comps.map(c => c.pos[1] + c.size[1])) + 40;
    for (const i of idxs) {
      const c = doc.connections[i];
      if (!c || c.via) continue;
      const f = rect.get(c.from), t = rect.get(c.to);
      if (!f || !t) continue;
      c.fromSide = 'bottom'; c.toSide = 'bottom';
      c.via = [[Math.round(f.x + f.w / 2), channelY], [Math.round(t.x + t.w / 2), channelY]];
      applied++;
    }
  } else if (type === 'lifecycle') {
    for (const i of idxs) {
      const c = doc.transitions[i];
      if (!c || c.fromSide) continue;
      c.fromSide = 'bottom'; c.toSide = 'top'; c.route = 'straight';
      applied++;
    }
  }
  return applied;
}

const clean = (s) => (s || '').replace(/^["'`]|["'`]$/g, '').trim();
const slug = (s) => s.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase() || 'n';

function detectType(src) {
  const head = src.split('\n').map(l => l.trim()).find(l => l && !l.startsWith('%%')) || '';
  if (/^sequenceDiagram/i.test(head)) return 'sequence';
  if (/^(flowchart|graph)\b/i.test(head)) return 'flowchart';
  if (/^stateDiagram/i.test(head)) return 'state';
  return 'flowchart';
}

// ---- flowchart / graph -> architecture -----------------------------------
function convertFlowchart(src, title) {
  const nodeLabels = new Map();  // id -> label
  const edges = [];
  const NODE = /([A-Za-z0-9_]+)\s*(?:\[([^\]]+)\]|\(([^)]+)\)|\{([^}]+)\})?/;
  const EDGE = /([A-Za-z0-9_]+)\s*(?:\[[^\]]+\]|\([^)]+\)|\{[^}]+\})?\s*(?:--|==|-\.)+\s*(?:\|([^|]*)\|)?\s*>?\s*([A-Za-z0-9_]+)/;
  const order = [];
  const see = (id, label) => {
    if (!nodeLabels.has(id)) { nodeLabels.set(id, label || id); order.push(id); }
    else if (label && nodeLabels.get(id) === id) nodeLabels.set(id, label);
  };
  for (let raw of src.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('%%') || /^(flowchart|graph|subgraph|end|classDef|class|style|linkStyle)\b/i.test(line)) continue;
    const e = line.match(/([A-Za-z0-9_]+)\s*(\[[^\]]+\]|\([^)]+\)|\{[^}]+\})?\s*(--[->.]*|==+>?|-\.->|-->)\s*(?:\|([^|]*)\|)?\s*([A-Za-z0-9_]+)\s*(\[[^\]]+\]|\([^)]+\)|\{[^}]+\})?/);
    if (e) {
      const from = e[1], fLab = e[2] ? clean(e[2].slice(1, -1)) : null;
      const to = e[5], tLab = e[6] ? clean(e[6].slice(1, -1)) : null;
      see(from, fLab); see(to, tLab);
      edges.push({ from, to, label: clean(e[4] || '') || undefined });
      continue;
    }
    const n = line.match(/^([A-Za-z0-9_]+)\s*(\[[^\]]+\]|\([^)]+\)|\{[^}]+\})/);
    if (n) see(n[1], clean(n[2].slice(1, -1)));
  }
  // Layered layout (longest-path rank = column) so a child sits one column right
  // of its parent — siblings stack in rows. This avoids the "skip" crossings a
  // flat single row produces (e.g. B->D jumping over C).
  const adj = new Map(order.map(id => [id, []]));
  const indeg = new Map(order.map(id => [id, 0]));
  for (const e of edges) { if (adj.has(e.from) && adj.has(e.to)) { adj.get(e.from).push(e.to); indeg.set(e.to, indeg.get(e.to) + 1); } }
  const rank = new Map(order.map(id => [id, 0]));
  // Kahn topological pass; ranks propagate as longest path. Cycles: leftover nodes
  // keep rank 0 order, still valid (just less tidy).
  const queue = order.filter(id => indeg.get(id) === 0);
  const seen = new Set();
  while (queue.length) {
    const u = queue.shift(); if (seen.has(u)) continue; seen.add(u);
    for (const v of adj.get(u)) {
      rank.set(v, Math.max(rank.get(v), rank.get(u) + 1));
      indeg.set(v, indeg.get(v) - 1);
      if (indeg.get(v) === 0) queue.push(v);
    }
  }
  const colW = 300, rowH = 150, w = 160, h = 62;
  const rowInRank = new Map();
  const components = order.map((id) => {
    const r = rank.get(id);
    const row = rowInRank.get(r) || 0; rowInRank.set(r, row + 1);
    return { id: slug(id), type: 'backend', label: nodeLabels.get(id), pos: [60 + r * colW, 90 + row * rowH], size: [w, h] };
  });
  const idmap = new Map(order.map(id => [id, slug(id)]));
  const connections = edges.map(e => ({ from: idmap.get(e.from), to: idmap.get(e.to), ...(e.label ? { label: e.label } : {}) }));
  return {
    schema_version: 1, diagram_type: 'architecture',
    meta: { title: title || 'Imported from Mermaid', quality_profile: 'standard' },
    components, connections
  };
}

// ---- sequenceDiagram -> sequence ------------------------------------------
function convertSequence(src, title) {
  const parts = new Map(); const order = [];
  const messages = []; let y = 170;
  const see = (id, label) => { const s = slug(id); if (!parts.has(s)) { parts.set(s, label || id); order.push(s); } return s; };
  for (let raw of src.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('%%') || /^sequenceDiagram/i.test(line)) continue;
    let m = line.match(/^(participant|actor)\s+([A-Za-z0-9_]+)(?:\s+as\s+(.+))?$/i);
    if (m) { const s = see(m[2], clean(m[3]) || m[2]); parts.set(s, clean(m[3]) || m[2]); continue; }
    m = line.match(/^([A-Za-z0-9_]+)\s*(-?-(?:>>|>|x|\)))\s*([A-Za-z0-9_]+)\s*:\s*(.+)$/);
    if (m) {
      const from = see(m[1]), to = see(m[3]);
      const dashed = m[2].startsWith('--');
      messages.push({ id: 'm' + (messages.length + 1), from, to, y, label: clean(m[4]), ...(dashed ? { variant: 'return' } : {}) });
      y += 55;
    }
  }
  const participants = order.map(id => ({ id, type: 'backend', label: parts.get(id) }));
  return {
    schema_version: 1, diagram_type: 'sequence',
    meta: { title: title || 'Imported from Mermaid', viewBox: [Math.max(700, order.length * 170), y + 80], quality_profile: 'standard' },
    participants, messages
  };
}

// ---- stateDiagram -> lifecycle --------------------------------------------
function convertState(src, title) {
  const labels = new Map(); const order = [];
  const edges = []; const out = new Map();
  let startId = null; const terminals = new Set();
  const see = (id) => { if (id !== '[*]' && !labels.has(id)) { labels.set(id, id); order.push(id); } return id; };
  for (let raw of src.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('%%') || /^(stateDiagram(-v2)?|classDef|class |note |direction)\b/i.test(line)) continue;
    let m = line.match(/^state\s+"([^"]+)"\s+as\s+([A-Za-z0-9_]+)/i);
    if (m) { see(m[2]); labels.set(m[2], clean(m[1])); continue; }
    m = line.match(/^(\[\*\]|[A-Za-z0-9_]+)\s*-->\s*(\[\*\]|[A-Za-z0-9_]+)\s*(?::\s*(.+))?$/);
    if (m) {
      const from = m[1], to = m[2];
      if (from === '[*]') { see(to); if (startId === null) startId = to; }
      else if (to === '[*]') { see(from); terminals.add(from); }
      else {
        see(from); see(to);
        edges.push({ from, to, label: clean(m[3] || '') || undefined });
        out.set(from, (out.get(from) || 0) + 1);
      }
      continue;
    }
    const s = line.match(/^([A-Za-z0-9_]+)\s*:\s*(.+)$/);
    if (s) { see(s[1]); labels.set(s[1], clean(s[2])); }
  }
  const isFail = (id) => /fail|error|cancel|reject|abort|denied/i.test(id + ' ' + labels.get(id));
  const isWait = (id) => id !== startId && /wait|pending|approv|review|hold|pause/i.test(id + ' ' + labels.get(id));
  const stType = (id) => {
    if (id === startId) return 'start';
    if (terminals.has(id)) return isFail(id) ? 'failure' : 'success';
    if ((out.get(id) || 0) > 1) return 'decision';
    if (isWait(id)) return 'waiting';
    return 'active';
  };
  // col = longest-path rank from the start, over the transition graph — aligns
  // every state (including terminals) under its logical position in the flow.
  const adj = new Map(order.map(id => [id, []]));
  const indeg = new Map(order.map(id => [id, 0]));
  for (const e of edges) { adj.get(e.from).push(e.to); indeg.set(e.to, indeg.get(e.to) + 1); }
  const rank = new Map(order.map(id => [id, 0]));
  const q = order.filter(id => indeg.get(id) === 0); const seen = new Set();
  while (q.length) {
    const u = q.shift(); if (seen.has(u)) continue; seen.add(u);
    for (const v of adj.get(u)) {
      rank.set(v, Math.max(rank.get(v), rank.get(u) + 1));
      indeg.set(v, indeg.get(v) - 1);
      if (indeg.get(v) === 0) q.push(v);
    }
  }
  // lifecycle geometry contract: main rail has integer cols 0..4; the outcome band
  // (waiting/terminal lanes) has cols 0..2 and aligns beneath main col N+2. So a
  // non-main state maps to col = clamp(rank-2, 0, 2). Main rail caps at 5 phases —
  // longer state machines don't fit lifecycle's model; steer them to flowchart.
  const laneOf = (id) => id === startId ? 'main' : terminals.has(id) ? 'terminal' : isWait(id) ? 'waiting' : 'main';
  const mainIds = order.filter(id => laneOf(id) === 'main');
  if (mainIds.length > 5) {
    fail(`stateDiagram has ${mainIds.length} main-rail states but lifecycle allows at most 5 (cols 0..4). ` +
      `Split the machine or import it as a flowchart instead.`);
  }
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const taken = new Set();
  const states = order.map((id) => {
    const lane = laneOf(id);
    const max = lane === 'main' ? 4 : 2;
    let col = lane === 'main' ? clamp(rank.get(id), 0, 4) : clamp(rank.get(id) - 2, 0, 2);
    while (taken.has(lane + ':' + col) && col < max) col++;
    taken.add(lane + ':' + col);
    const st = { id: slug(id), type: stType(id), label: labels.get(id), lane, col };
    if (lane === 'main') st.step = String(col + 1).padStart(2, '0');
    return st;
  });
  const idmap = new Map(order.map(id => [id, slug(id)]));
  const lanes = [
    { id: 'main', label: 'Lifecycle' },
    { id: 'waiting', label: 'Wait states' },
    { id: 'terminal', label: 'Terminal' },
  ].filter(l => states.some(s => s.lane === l.id));
  const transitions = edges.map(e => ({
    from: idmap.get(e.from), to: idmap.get(e.to), ...(e.label ? { label: e.label } : {}),
  }));
  return { schema_version: 1, diagram_type: 'lifecycle',
    meta: { title: title || 'Imported from Mermaid', quality_profile: 'standard' },
    lanes, states, transitions };
}

function main() {
  const a = parseArgs(process.argv.slice(2));
  const src = readFileSync(a.input, 'utf8');
  const kind = detectType(src);
  let doc, type;
  if (kind === 'sequence') { doc = convertSequence(src, a.title); type = 'sequence'; }
  else if (kind === 'state') { doc = convertState(src, a.title); type = 'lifecycle'; }
  else { doc = convertFlowchart(src, a.title); type = 'architecture'; }
  const out = a.output || a.input.replace(/\.[^.]+$/, '') + `.${type}.json`;

  const result = { ok: true, kind, type,
    nodes: (doc.components || doc.participants || doc.states).length,
    edges: (doc.connections || doc.messages || doc.transitions).length };

  if (!a.render) {
    writeFileSync(out, JSON.stringify(doc, null, 2) + '\n');
    result.output = out;
    result.next = `node <archify>/bin/archify.mjs validate ${type} ${out} --quality showcase`;
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  // --render: auto-repair label geometry, then deliver an HTML (+ optional export).
  const archify = findArchify(a.archify);
  const cli = join(archify, 'bin/archify.mjs');
  let last = { ok: false, text: '' };
  for (let i = 0; i <= a.repair; i++) {
    writeFileSync(out, JSON.stringify(doc, null, 2) + '\n');
    last = validateText(cli, type, out, a.quality, archify);
    if (last.ok) break;
    const fixes = applyLabelRepairs(doc, last.text) + applyRoutingRepairs(doc, type, last.text);
    if (i === a.repair || fixes === 0) break; // no more auto-fixes available
  }
  result.repaired = last.ok;
  result.output = out;
  if (!last.ok) {
    result.ok = false;
    result.remaining = last.text.split('\n').filter(l => /overlap|crosses|clearance|must|span/i.test(l)).slice(0, 6);
    result.note = 'topology valid but geometry needs manual repair (routing/crossings the auto-fixer cannot resolve)';
    console.log(JSON.stringify(result, null, 2));
    process.exit(1);
  }
  const html = out.replace(/\.json$/i, '.html');
  const d = spawnSync('node', [cli, 'deliver', type, out, html, '--quality', a.quality, '--json'], { cwd: archify, encoding: 'utf8' });
  if (d.status !== 0) { result.ok = false; result.stage = 'deliver'; console.log(JSON.stringify(result, null, 2)); process.exit(1); }
  result.html = html;
  if (a.export) {
    const exporter = join(dirname(new URL(import.meta.url).pathname), 'archify-export.mjs');
    const ex = spawnSync('node', [exporter, html, '--formats', a.export, ...(a.themes ? ['--themes', a.themes] : [])], { encoding: 'utf8' });
    result.exported = ex.status === 0;
    if (ex.status !== 0) result.exportError = (ex.stderr || '').trim().split('\n').slice(-2);
  }
  console.log(JSON.stringify(result, null, 2));
}

main();
