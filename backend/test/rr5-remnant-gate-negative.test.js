/**
 * RR5-05 — Remnant gate negative fixtures.
 * Each forbidden spelling/case must make assert-frontend-clean exit non-zero.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync, copyFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '../..');
const gateScript = join(repoRoot, 'scripts/assert-frontend-clean.mjs');

function writeMinimalValidTree(dir) {
  mkdirSync(join(dir, 'frontend/public/pages'), { recursive: true });
  mkdirSync(join(dir, 'frontend/public/assets'), { recursive: true });
  mkdirSync(join(dir, 'frontend/public/share'), { recursive: true });
  mkdirSync(join(dir, 'scripts'), { recursive: true });
  mkdirSync(join(dir, 'backend/src'), { recursive: true });
  writeFileSync(join(dir, 'frontend/public/index.html'), `<!doctype html><html><head>
    <meta property="og:image" content="/assets/og-share-grom-20260930.png">
    <meta name="twitter:image" content="/assets/og-share-grom-20260930.png">
    <style>html.grom-js-ready:not([data-grom-route="landing"]) #gromSeoRouteCopy{display:none}</style>
    <script>window.gromReferralShareUrl=function(){return 'https://grom.exchange/share/' + (code ? '?ref=' : '')};window.refShareX=function(){window.gromReferralShareUrl()};window.refShareTelegram=function(){window.gromReferralShareUrl()};</script>
    </head><body><div id="page-futures"></div><span class="trade-mode-spot"></span>
    <script>/* ALWAYS hard-load the full SPA */</script></body></html>`);
  writeFileSync(join(dir, 'frontend/public/pages/backoffice.html'), '<div>ok</div>');
  writeFileSync(join(dir, 'frontend/nginx.conf'), 'location @spa { rewrite ^ /app.html last; }\nlocation @crawler_seo_route {}\n');
  writeFileSync(join(dir, 'frontend/public/assets/og-share-nord.png'), 'fixture');
  writeFileSync(join(dir, 'frontend/public/assets/og-share-grom-20260930.png'), 'fixture');
  writeFileSync(join(dir, 'frontend/public/share/index.html'), `<!doctype html>
    <meta property="og:image" content="/assets/og-share-grom-20260930.png">
    <meta name="twitter:card" content="summary_large_image">
    <a href="/?ref=" + encodeURIComponent(ref) + "#landing">Open</a>`);
  writeFileSync(join(dir, 'scripts/assert-product-health.mjs'), "console.log('ok');\n");
  copyFileSync(gateScript, join(dir, 'scripts/assert-frontend-clean.mjs'));
}

const NEGATIVE_FIXTURES = [
  { name: 'fiat-on-ramp-spaced', body: 'Try our fiat on-ramp today' },
  { name: 'fiat-onramp-hyphen', body: 'See Fiat-On-Ramp docs' },
  { name: 'binary-options-case', body: '<!-- BINARY OPTIONS -->' },
  { name: 'binary-options-spaced', body: 'binary options are retired' },
  { name: 'hasEmail', body: 'const x = { hasEmail: true }' },
  { name: 'set_email', body: 'i18n.set_email = "Email"' },
  { name: 'email-outbox', body: 'load email-outbox panel' },
  { name: 'email_outbox', body: 'email_outbox queue' },
  { name: 'cn-email', body: '.cn-email { display:none }' },
  { name: 'user_settings.email', body: 'SELECT email FROM user_settings' },
];

function runGateInSandbox(poisonRelPath, poisonContent) {
  const dir = mkdtempSync(join(tmpdir(), 'grom-gate-'));
  try {
    writeMinimalValidTree(dir);

    writeFileSync(join(dir, poisonRelPath), poisonContent);
    const r = spawnSync(process.execPath, ['scripts/assert-frontend-clean.mjs'], {
      cwd: dir,
      encoding: 'utf8',
    });
    return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe('RR5 remnant gate negative fixtures', () => {
  it('clean sandbox passes', () => {
    const dir = mkdtempSync(join(tmpdir(), 'grom-gate-ok-'));
    try {
      writeMinimalValidTree(dir);
      const r = spawnSync(process.execPath, ['scripts/assert-frontend-clean.mjs'], {
        cwd: dir,
        encoding: 'utf8',
      });
      assert.equal(r.status, 0, r.stderr || r.stdout);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  for (const fx of NEGATIVE_FIXTURES) {
    it(`rejects ${fx.name}`, () => {
      const r = runGateInSandbox(`frontend/public/poison-${fx.name}.js`, `// ${fx.body}\n`);
      assert.notEqual(r.status, 0, `expected non-zero for ${fx.name}; got stdout=${r.stdout} stderr=${r.stderr}`);
    });
  }

  it('FORBIDDEN_PATTERNS cover required semantics', () => {
    const src = readFileSync(gateScript, 'utf8');
    assert.ok(src.includes('fiat[\\s-]*on[\\s-]*ramp'));
    assert.ok(src.includes('binary[\\s-]*options'));
    assert.ok(src.includes('\\bhasEmail\\b'));
    assert.ok(src.includes('\\bset_email\\b'));
    assert.ok(src.includes('email[\\s_-]*outbox'));
  });
});
