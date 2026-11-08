#!/usr/bin/env node
// detect-stack — scan a repository and propose Archify architecture component
// parameters (componentType, label, sublabel, suggested cards) from real
// manifest files. Does NOT touch the upstream skill; read-only, no network.
//
// Usage:
//   detect-stack <repo-path> [--json] [--depth N]
//
// Output: a JSON report of detected signals plus a ready-to-paste
// `components` array fragment (archify architecture schema, componentType
// enum: frontend | backend | database | cloud | security | messagebus | external).

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, basename, resolve } from 'node:path';

function fail(msg) { console.error('detect-stack: ' + msg); process.exit(1); }

function parseArgs(argv) {
  const a = { json: false, depth: 2 };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === '--json') a.json = true;
    else if (t === '--depth') a.depth = Number(argv[++i]);
    else if (t.startsWith('--')) fail('unknown flag ' + t);
    else rest.push(t);
  }
  if (rest.length !== 1) fail('exactly one <repo-path> is required');
  a.root = resolve(rest[0]);
  if (!existsSync(a.root)) fail('path not found: ' + a.root);
  return a;
}

function readJSON(path) {
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return null; }
}
function readText(path) {
  try { return readFileSync(path, 'utf8'); } catch { return null; }
}

// Shallow, bounded directory walk (skip heavy/irrelevant dirs).
const SKIP_DIRS = new Set(['node_modules', '.git', 'vendor', 'dist', 'build', '__pycache__',
  '.venv', 'venv', 'target', '.next', '.cache', 'coverage', 'Pods', 'DerivedData']);

function walk(root, depth, files, curDepth = 0) {
  if (curDepth > depth) return;
  let entries;
  try { entries = readdirSync(root, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (e.name.startsWith('.') && !['.github', '.circleci'].includes(e.name)) continue;
    if (SKIP_DIRS.has(e.name)) continue;
    const full = join(root, e.name);
    if (e.isDirectory()) walk(full, depth, files, curDepth + 1);
    else files.push(full);
  }
}

function detect(root, depth) {
  const files = [];
  walk(root, depth, files);
  const byName = (name) => files.filter(f => basename(f) === name);
  const byExt = (ext) => files.filter(f => f.endsWith(ext));
  const has = (name) => byName(name).length > 0;

  const signals = { language: [], frameworks: [], databases: [], messaging: [], infra: [], auth: [], external: [] };
  const evidence = [];

  const addEv = (path, note) => evidence.push({ path: path.replace(root + '/', ''), note });

  // --- Python ---
  const reqFiles = [...byName('requirements.txt'), ...byName('base.txt'), ...byName('production.txt')];
  const pyproject = byName('pyproject.toml')[0];
  const pipfile = byName('Pipfile')[0];
  if (reqFiles.length || pyproject || pipfile || has('manage.py')) {
    signals.language.push('Python');
    // Strip comments (# ...) so tool-config strings (e.g. a pylint/vulture ignore-list
    // entry mentioning "Celery" in a code-quality comment) don't look like a real
    // dependency declaration. requirements.txt and TOML both use '#' for comments.
    const stripComments = (t) => (t || '').split('\n').map(l => l.replace(/#.*$/, '')).join('\n');
    const reqText = stripComments(reqFiles.map(f => readText(f) || '').join('\n'))
      + stripComments(readText(pyproject) || '') + stripComments(readText(pipfile) || '');
    if (/django/i.test(reqText) || has('manage.py')) { signals.frameworks.push('Django'); addEv('manage.py', 'Django project'); }
    if (/djangorestframework|django-rest/i.test(reqText)) signals.frameworks.push('Django REST Framework');
    if (/fastapi/i.test(reqText)) signals.frameworks.push('FastAPI');
    if (/flask/i.test(reqText)) signals.frameworks.push('Flask');
    if (/celery/i.test(reqText)) { signals.frameworks.push('Celery (async tasks)'); signals.messaging.push('Celery worker'); }
    if (/django-rq\b/i.test(reqText) || /\brq-scheduler\b/i.test(reqText)) { signals.frameworks.push('Django RQ (async tasks)'); signals.messaging.push('RQ worker'); }
    if (/psycopg|postgis/i.test(reqText)) signals.databases.push('PostgreSQL' + (/postgis/i.test(reqText) ? '/PostGIS' : ''));
    if (/redis/i.test(reqText)) signals.databases.push('Redis');
    if (/uwsgi/i.test(reqText)) signals.frameworks.push('uWSGI (prod server)');
    if (/sentry-sdk/i.test(reqText)) signals.external.push('Sentry (error tracking)');
    if (/scout-apm/i.test(reqText)) signals.external.push('ScoutAPM (perf monitoring)');
    if (/stripe/i.test(reqText)) signals.external.push('Stripe (payment)');
  }

  // --- Node / JS / TS ---
  const pkgFiles = byName('package.json');
  for (const pkgPath of pkgFiles) {
    const pkg = readJSON(pkgPath);
    if (!pkg) continue;
    const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    const depNames = Object.keys(deps);
    if (depNames.length === 0 && !pkg.name) continue;
    signals.language.push('JavaScript/TypeScript');
    addEv(pkgPath, `package.json (${pkg.name || 'unnamed'})`);
    if (deps.react) signals.frameworks.push(`React ${deps.react.replace(/[^\d.]/g, '') || ''}`.trim());
    if (deps.vue) signals.frameworks.push('Vue');
    if (deps['@angular/core']) signals.frameworks.push('Angular');
    if (deps.next) signals.frameworks.push('Next.js');
    if (deps.express) signals.frameworks.push('Express');
    if (deps['@nestjs/core']) signals.frameworks.push('NestJS');
    if (deps.webpack) signals.frameworks.push('Webpack');
    if (deps.vite) signals.frameworks.push('Vite');
    if (deps.redux || deps['@reduxjs/toolkit']) signals.frameworks.push('Redux' + (deps['@reduxjs/toolkit'] ? '/RTK' : ''));
    if (deps['@tanstack/react-query'] || deps['react-query']) signals.frameworks.push('React Query');
    if (deps['@radix-ui/react-dialog'] || Object.keys(deps).some(d => d.startsWith('@radix-ui/'))) signals.frameworks.push('Radix UI');
    if (deps['@mui/material'] || deps['@material-ui/core']) signals.frameworks.push('Material-UI');
    if (deps.tailwindcss) signals.frameworks.push('Tailwind CSS');
    if (deps['react-intl'] || deps.i18next) signals.frameworks.push('i18n (react-intl/i18next)');
    if (deps['@sentry/react'] || deps['@sentry/node']) signals.external.push('Sentry (error tracking)');
    if (deps['@stripe/react-stripe-js'] || deps.stripe) signals.external.push('Stripe (payment)');
    if (deps['@paypal/react-paypal-js']) signals.external.push('PayPal (payment)');
    if (deps.axios) signals.frameworks.push('Axios (HTTP client)');
  }

  // --- Swift / iOS ---
  if (byExt('.xcodeproj').length || byName('Package.swift').length || files.some(f => f.endsWith('.swift'))) {
    signals.language.push('Swift');
    const swiftFiles = files.filter(f => f.endsWith('.swift'));
    addEv('*.swift', `${swiftFiles.length} fichiers Swift`);
    if (swiftFiles.some(f => (readText(f) || '').includes('import SwiftUI'))) signals.frameworks.push('SwiftUI');
    if (swiftFiles.some(f => (readText(f) || '').includes('import UIKit'))) signals.frameworks.push('UIKit');
    const pkgSwift = readText(byName('Package.swift')[0]);
    if (pkgSwift && /git@|https:\/\//.test(pkgSwift)) {
      const m = pkgSwift.match(/url:\s*"([^"]+)"/g) || [];
      for (const mm of m) signals.external.push('SPM dependency: ' + mm.replace(/url:\s*"|"/g, ''));
    }
  }

  // --- Helm / Kubernetes / Terraform / Docker ---
  if (byName('Chart.yaml').length) {
    signals.infra.push('Helm chart(s)');
    for (const chartPath of byName('Chart.yaml')) {
      const chart = readText(chartPath);
      const depMatches = [...(chart || '').matchAll(/name:\s*(\S+)/g)].map(m => m[1]);
      addEv(chartPath, `Chart.yaml (deps: ${depMatches.slice(1, 6).join(', ') || 'n/a'})`);
    }
  }
  if (files.some(f => /argocd|application.*\.yaml$/i.test(f) && (readText(f) || '').includes('argoproj.io'))) {
    signals.infra.push('ArgoCD (GitOps deployment)');
  }
  if (byExt('.tf').length) { signals.infra.push('Terraform (IaC)'); addEv(byExt('.tf')[0], `${byExt('.tf').length} fichiers .tf`); }
  if (has('Dockerfile') || byName('docker-compose.yml').length || byName('docker-compose.yaml').length) {
    signals.infra.push('Docker' + (byName('docker-compose.yml').length ? ' Compose' : ''));
  }

  // --- Databases / messaging via docker-compose or manifests (heuristic keyword scan) ---
  const composeText = (byName('docker-compose.yml').concat(byName('docker-compose.yaml')))
    .map(f => readText(f) || '').join('\n');
  const allYamlText = files.filter(f => /\.ya?ml$/.test(f)).slice(0, 60)
    .map(f => readText(f) || '').join('\n');
  const scanText = composeText + '\n' + allYamlText;
  const dbHints = [
    [/postgres|postgis/i, 'PostgreSQL'],
    [/redis|keydb/i, 'Redis/KeyDB'],
    [/mysql|mariadb/i, 'MySQL/MariaDB'],
    [/mongo/i, 'MongoDB'],
    [/rabbitmq/i, 'RabbitMQ'],
    [/kafka/i, 'Kafka'],
    [/elasticsearch|opensearch/i, 'Elasticsearch/OpenSearch'],
  ];
  for (const [re, label] of dbHints) {
    if (re.test(scanText)) {
      if (/rabbitmq|kafka/i.test(label)) { if (!signals.messaging.includes(label)) signals.messaging.push(label); }
      else if (!signals.databases.includes(label)) signals.databases.push(label);
    }
  }
  if (/sso|oidc|oauth|keycloak|gravitee/i.test(scanText)) signals.auth.push('SSO/OIDC (detecte dans manifests)');

  // dedupe
  for (const k of Object.keys(signals)) signals[k] = [...new Set(signals[k])];

  return { root, files_scanned: files.length, signals, evidence };
}

function toComponents(signals) {
  // Best-effort mapping to archify architecture componentType + suggested label/sublabel.
  const comps = [];
  let x = 40;
  const nextX = () => { const v = x; x += 220; return v; };

  if (signals.frameworks.some(f => /React|Vue|Angular|SwiftUI|UIKit/.test(f))) {
    comps.push({ id: 'frontend', type: 'frontend', label: 'Frontend', sublabel: signals.frameworks.filter(f => /React|Vue|Angular|SwiftUI|UIKit|Webpack|Vite/.test(f)).join(', ') || 'detected UI framework', pos: [nextX(), 300], size: [160, 64] });
  }
  if (signals.frameworks.some(f => /Django|FastAPI|Flask|Express|NestJS/.test(f))) {
    comps.push({ id: 'backend', type: 'backend', label: 'Backend', sublabel: signals.frameworks.filter(f => /Django|FastAPI|Flask|Express|NestJS|uWSGI|Celery/.test(f)).join(', '), pos: [nextX(), 300], size: [160, 64] });
  }
  for (const db of signals.databases) {
    comps.push({ id: 'db_' + db.toLowerCase().replace(/[^a-z0-9]/g, '_'), type: 'database', label: db, sublabel: 'detected', pos: [nextX(), 300], size: [150, 60] });
  }
  for (const mq of signals.messaging) {
    comps.push({ id: 'mq_' + mq.toLowerCase().replace(/[^a-z0-9]/g, '_'), type: 'messagebus', label: mq, sublabel: 'detected', pos: [nextX(), 300], size: [150, 60] });
  }
  if (signals.auth.length) {
    comps.push({ id: 'auth', type: 'security', label: 'Auth', sublabel: signals.auth.join(', '), pos: [nextX(), 150], size: [150, 60] });
  }
  if (signals.infra.some(i => /Kubernetes|Helm|ArgoCD/i.test(i))) {
    comps.push({ id: 'k8s', type: 'cloud', label: 'Kubernetes cluster', sublabel: signals.infra.filter(i => /Helm|ArgoCD/i.test(i)).join(', '), pos: [nextX(), 300], size: [160, 64] });
  }
  for (const ext of signals.external.slice(0, 4)) {
    comps.push({ id: 'ext_' + ext.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 20), type: 'external', label: ext.split(' (')[0], sublabel: 'detected dependency', pos: [nextX(), 460], size: [150, 60] });
  }
  return comps;
}

function main() {
  const a = parseArgs(process.argv.slice(2));
  const report = detect(a.root, a.depth);
  const components = toComponents(report.signals);
  const out = {
    root: report.root,
    files_scanned: report.files_scanned,
    signals: report.signals,
    evidence: report.evidence,
    suggested_components: components,
    note: 'Heuristic detection from manifest files (package.json, requirements.txt, Chart.yaml, *.tf, docker-compose.yml, Package.swift, *.swift). Verify against real code before authoring — this is a starting point, not ground truth. Positions are a naive left-to-right layout; reposition to avoid Archify layout-validation errors (see SKILL.md).',
  };
  if (a.json) {
    console.log(JSON.stringify(out, null, 2));
  } else {
    console.log(`detect-stack: ${report.root}`);
    console.log(`  files scanned: ${report.files_scanned}`);
    for (const [k, v] of Object.entries(report.signals)) {
      if (v.length) console.log(`  ${k}: ${v.join(', ')}`);
    }
    console.log(`  suggested components: ${components.length} (use --json for the full Archify fragment)`);
  }
}

main();
