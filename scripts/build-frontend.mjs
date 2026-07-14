#!/usr/bin/env node
/**
 * GROM frontend build — content-hash cache busting (PERF §Update 2026-07-14 A.1).
 *
 * Zero dependencies (fs + crypto only). What it does:
 *   1. frontend/public → frontend/dist (full copy)
 *   2. Every top-level grom-*.js / *.css gets a hashed twin:
 *        grom-wallet.js → grom-wallet.a7b3c9d1.js
 *      Originals stay in dist as a fallback for old HTML cached at the edge.
 *   3. index.html / oauth-callback.html references rewritten to hashed names
 *      (any `?v=...` query strings are dropped — no more manual bumps).
 *   4. `var APP_VER = '...'` in index.html is replaced with the build hash, so
 *      the localStorage guard fires automatically on every content change.
 *
 * Usage: node scripts/build-frontend.mjs   (writes frontend/dist)
 */
import { createHash } from 'node:crypto';
import {
  cpSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

const SRC = 'frontend/public';
const OUT = 'frontend/dist';

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
cpSync(SRC, OUT, { recursive: true });

// Discover hashable top-level assets (JS + CSS only; HTML stays un-hashed).
const hashable = readdirSync(SRC).filter((f) => /^[\w-]+\.(js|css)$/.test(f));

const map = {}; // 'grom-wallet.js' → 'grom-wallet.a7b3c9d1.js'
for (const f of hashable) {
  const content = readFileSync(join(SRC, f));
  const hash = createHash('sha256').update(content).digest('hex').slice(0, 8);
  const hashed = f.replace(/\.(js|css)$/, `.${hash}.$1`);
  writeFileSync(join(OUT, hashed), content);
  map[f] = hashed;
}

// Build version = hash of all file hashes (stable across no-op rebuilds).
const buildVer = createHash('sha256')
  .update(Object.entries(map).sort().map(([k, v]) => `${k}:${v}`).join('|'))
  .digest('hex')
  .slice(0, 10);

function rewriteHtml(file) {
  const p = join(OUT, file);
  let html;
  try { html = readFileSync(p, 'utf8'); } catch { return; }
  for (const [orig, hashed] of Object.entries(map)) {
    // Matches "/grom-wallet.js?v=whatever", "/grom-wallet.js", "grom-wallet.js?v=x"
    // in src/href attributes and inline JS string assignments.
    const re = new RegExp(
      orig.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + String.raw`(\?v=[\w.-]*)?`,
      'g'
    );
    html = html.replace(re, hashed);
  }
  html = html.replace(/var APP_VER = '[^']*'/, `var APP_VER = '${buildVer}'`);
  writeFileSync(p, html);
}

rewriteHtml('index.html');
rewriteHtml('oauth-callback.html');

// Tiny version beacon — stale tabs poll this and self-reload when it changes.
writeFileSync(join(OUT, 'version.json'), JSON.stringify({ v: buildVer }));

console.log(JSON.stringify({ buildVer, files: map }, null, 2));
console.log(`✅ Built ${OUT} · APP_VER=${buildVer}`);
