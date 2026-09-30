#!/usr/bin/env node
/**
 * Fail the build/deploy if stale UI artifacts or forbidden product remnants would ship.
 * Also parses first-party shipped JS (node --check) — vendor/wc excluded.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, sep, relative } from 'node:path';
import { spawnSync } from 'node:child_process';

const roots = ['frontend/public', 'frontend/dist'].filter(existsSync);
const BAD_NAME = /\.(bak|backup|old)($|\.)|\.bak-|index\.html\.may|grom-preview\.html/i;
const BAD_CONTENT = /Users & KYC|12,842|Active users(?![\w-])/;
const FORBIDDEN_PUBLIC = [
  'grom-app.js',
  'grom-app.css',
  'grom-wallet-ui.css',
  'grom-privy.js',
];

/** Semantic remnants that must not appear in first-party runtime (not migrations). */
const FORBIDDEN_PATTERNS = [
  { re: /id=["']page-binary["']|getElementById\(['\"]page-binary['\"]\)|#page-binary/i, label: 'legacy page-binary remnant' },
  { re: /placeBinary\s*\(|gromPlaceBinaryDemo|boState\s*=/i, label: 'Binary Options runtime remnant' },
  { re: /grom-live\.js|__gromLoadLive/i, label: 'grom-live Binary client remnant' },
  { re: /id=["']page-spot["']/i, label: 'legacy #page-spot (use HL trade-mode-spot)' },
  { re: /getElementById\(['"]page-spot['"]\)/i, label: 'getElementById(page-spot) remnant' },
  { re: /#page-spot\b/i, label: '#page-spot selector remnant' },
  { re: /\/api\/spot\//i, label: '/api/spot/ remnant' },
  { re: /\bGW_SP_PAIRS\b/, label: 'GW_SP_PAIRS remnant' },
  { re: /\bgwRenderSpotDex\b/, label: 'gwRenderSpotDex remnant' },
  { re: /\bboChart\b/, label: 'boChart remnant' },
  { re: /\bgrom_bo_/, label: 'grom_bo_ metrics remnant' },
  { re: /\bconnectEmail\b/, label: 'connectEmail remnant' },
  { re: /\bsyncEmailSession\b/, label: 'syncEmailSession remnant' },
  { re: /\bset2fa\b/, label: 'set2fa remnant' },
  { re: /fiat[\s-]*on[\s-]*ramp/i, label: 'Fiat on-ramp marketing remnant' },
  { re: /binary[\s-]*options/i, label: 'Binary Options marketing remnant' },
  { re: /submitSpotOrder\s*\(/, label: 'dead submitSpotOrder handler' },
  { re: /Binance\s*·\s*agg/, label: 'legacy Binance · agg orderbook' },
  { re: /start2faSetup|verify2fa|disable2fa|load2faStatus/, label: '2FA stubs' },
  { re: /\/auth\/email-login|__removed_email_login/i, label: 'email-login remnant' },
  { re: /\/auth\/2fa\//, label: '2FA route remnant' },
  { re: /GROM_FIAT_PROVIDERS|openFiatProvider|MoonPay|Transak/, label: 'fiat on-ramp remnant' },
  { re: /Ramp\s*\/\s*Transak|Ramp\s*&\s*Transak/, label: 'Ramp/Transak marketing' },
  { re: /privy-session|Privy OAuth|grom-privy|Privy\/email/i, label: 'Privy remnant' },
  { re: /inline\s+OTP\s+form|OTP\s+harvesting/i, label: 'OTP remnant' },
  { re: /dexNonCustodial|__removed_withdrawals|__removed_custodial/, label: 'tombstone stub remnant' },
  { re: /GROM_KRAKEN_API_KEY|GROM_COINBASE_API_KEY|GROM_BINANCE_API_KEY/, label: 'CEX API key env' },
  { re: /HOT_WALLET_EVM_KEY|BTC_HOT_WALLET_WIF/, label: 'hot wallet key remnant' },
  { re: /binary_retired|\/api\/binary/i, label: 'Binary Options API remnant' },
  { re: /FROM\s+bo_positions|FROM\s+bo_rounds|FROM\s+spot_orders|FROM\s+balances\b/i, label: 'legacy ledger SQL' },
  { re: /\bhasEmail\b/, label: 'hasEmail remnant' },
  { re: /\bset_email\b/, label: 'set_email remnant' },
  { re: /email[\s_-]*outbox/i, label: 'email-outbox remnant' },
  { re: /user_settings\.email|SELECT\s+email\s+FROM\s+user_settings/i, label: 'user_settings.email remnant' },
  { re: /\.cn-email\b/, label: 'cn-email CSS remnant' },
  { re: /FROM\s+notifications_outbox/i, label: 'notifications_outbox SQL remnant' },
  { re: /FROM\s+symbols\b/i, label: 'legacy symbols SQL remnant' },
  { re: /FROM\s+alerts\b/i, label: 'legacy alerts SQL remnant' },
  { re: /\b(?:TonConnect|Toncoin|STON\.fi|Fantom|WFTM)\b/i, label: 'removed TON/Fantom network remnant' },
  { re: /['"`]\s*(?:TON|FTM)\s*['"`]|key\s*:\s*['"](?:ton|fantom)['"]|data-nonevm\s*=\s*['"]ton['"]/i, label: 'removed TON/Fantom symbol or chip' },
];

export { FORBIDDEN_PATTERNS };

/** Paths excluded from semantic remnant scan (historical SQL, docs, HL Spot). */
function skipRemnantPath(rel) {
  const n = rel.replace(/\\/g, '/');
  if (n.includes('/wc/')) return true;
  if (n.includes('/db/migrations/')) return true;
  if (n.includes('/docs/')) return true;
  if (/grom-hyperliquid\.js$/i.test(n)) return true; // Hyperliquid Spot/Perp allowlist
  if (/remnant-allowlist\.json$/i.test(n)) return true;
  if (/REMOVED-RUNTIME|CURRENT-PRODUCT/i.test(n)) return true;
  return false;
}

function isVendorJs(relPath) {
  const n = relPath.replace(/\\/g, '/');
  if (n.includes('/wc/')) return true;
  if (/(^|\/)(vendor|third.?party|node_modules)\//i.test(n)) return true;
  if (/ethereum-provider\.bundle\.js$/i.test(n)) return true;
  return false;
}

let errors = 0;
function fail(msg) {
  console.error('✗', msg);
  errors++;
}

function walkFiles(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    let st;
    try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === '.git' || name === 'wc') continue;
      walkFiles(p, out);
      continue;
    }
    out.push(p);
  }
  return out;
}

for (const root of roots) {
  for (const p of walkFiles(root)) {
    const name = p.split(sep).pop();
    if (BAD_NAME.test(name)) fail(`stale backup file: ${p}`);
    if (/\.(html|js)$/.test(name) && p.includes(`${sep}pages${sep}backoffice.html`)) {
      try {
        if (BAD_CONTENT.test(readFileSync(p, 'utf8'))) {
          fail(`old English backoffice stub markers in ${p}`);
        }
      } catch { /* */ }
    }
  }
}

if (existsSync('frontend/public')) {
  for (const f of FORBIDDEN_PUBLIC) {
    if (existsSync(join('frontend/public', f))) {
      fail(`orphan source must not exist: frontend/public/${f}`);
    }
  }
  if (!existsSync('frontend/public/pages/backoffice.html')) {
    fail('missing canonical admin fragment: frontend/public/pages/backoffice.html');
  }
  if (!existsSync('frontend/public/index.html')) {
    fail('missing canonical UI: frontend/public/index.html');
  }
  for (const retiredAsset of [
    'frontend/public/assets/wallets/ton.svg',
    'frontend/public/assets/wallets/fantom.svg',
    'frontend/public/assets/wallets/ftm.svg',
  ]) {
    if (existsSync(retiredAsset)) fail(`removed network asset must not exist: ${retiredAsset}`);
  }
  // Hyperliquid Spot must remain
  const idx = readFileSync('frontend/public/index.html', 'utf8');
  if (!/id=["']page-futures["']/.test(idx)) fail('missing #page-futures (Hyperliquid Trade)');
  if (!/trade-mode-spot/.test(idx)) fail('missing trade-mode-spot (Hyperliquid Spot mode)');
  if (/id=["']page-spot["']/.test(idx)) fail('legacy #page-spot must be deleted');
  if (/id=["']page-binary["']/.test(idx)) fail('legacy #page-binary must be deleted');
  /* SPA nav must never fall back to landing when a panel is missing (SEO-shell trap). */
  if (!/ALWAYS hard-load the full SPA/.test(idx)) {
    fail('index.html show() must hard-load /app.html when #page-* is missing (no landing fallback trap)');
  }
  if (!/grom-js-ready:not\(\[data-grom-route="landing"\]\) #gromSeoRouteCopy/.test(idx)) {
    fail('index.html must hide #gromSeoRouteCopy on non-landing SPA routes');
  }
  /* nginx: browsers → app.html on /predict|/swap|…; crawlers only get slim SEO HTML */
  if (existsSync('frontend/nginx.conf')) {
    const ngx = readFileSync('frontend/nginx.conf', 'utf8');
    if (!ngx.includes('@crawler_seo_route')) {
      fail('nginx.conf missing @crawler_seo_route (browsers must not get slim SEO HTML)');
    }
    if (!/rewrite \^ \/app\.html last/.test(ngx)) {
      fail('nginx.conf must rewrite product pretty-URLs to /app.html for browsers');
    }
    /* The old bug: try_files $uri $uri/index.html @spa served /predict/index.html to humans */
    if (/try_files \$uri \$uri\/index\.html @spa/.test(ngx)) {
      fail('nginx.conf must NOT try_files $uri/index.html @spa (serves SEO slim pages to browsers)');
    }
  } else {
    fail('missing frontend/nginx.conf');
  }
  const socialCard = 'frontend/public/assets/og-share-grom-20260930.png';
  if (!existsSync(socialCard)) {
    fail(`missing OG card: ${socialCard}`);
  }
  if (!existsSync('frontend/public/share/index.html')) {
    fail('missing share OG page: frontend/public/share/index.html');
  }
  if (!/og-share-grom-20260930\.png/.test(idx)) {
    fail('index.html must point og:image / twitter:image at the current GROM social card');
  }
  const shareHtml = readFileSync('frontend/public/share/index.html', 'utf8');
  if (!/og-share-grom-20260930\.png/.test(shareHtml)) {
    fail('share/index.html must use the current GROM social card');
  }
  if (!/name="twitter:card" content="summary_large_image"/.test(shareHtml)) {
    fail('share/index.html must advertise a large social preview');
  }
  if (!/\?ref=.{0,120}#landing/.test(shareHtml)) {
    fail('share/index.html must carry referral codes through to the app');
  }
  if (!/window\.gromReferralShareUrl\(\)/.test(idx) || !/share\/.*\?ref=/.test(idx)) {
    fail('X and Telegram referral sharing must use the dedicated share preview URL');
  }
  if (/assets\/(?:og-card|og-share-nord)\.png\?v=/.test(idx)) {
    fail('index.html still points to the retired social card URL');
  }
  // Hard-ban Binary Options text in any shipped OG PNG metadata / embedded strings
  // og-card.png may exist only as a byte-identical twin of og-share-nord.png
  // so Cloudflare/Telegram revalidations of old image URLs cannot resurrect Binary art.
  if (existsSync('frontend/public/assets/og-card.png')) {
    const a = readFileSync('frontend/public/assets/og-card.png');
    const b = readFileSync('frontend/public/assets/og-share-nord.png');
    if (Buffer.compare(a, b) !== 0) {
      fail('og-card.png must be an exact copy of og-share-nord.png (no Binary-era art)');
    }
  }
  for (const ogName of ['og-share-nord.png', 'og-card-v3.png', 'og-card.png', 'og-share-grom-20260930.png']) {
    const ogPath = join('frontend/public/assets', ogName);
    if (!existsSync(ogPath)) continue;
    const buf = readFileSync(ogPath);
    if (/binary[\s_-]*options/i.test(buf.toString('latin1'))) {
      fail(`Binary Options remnant inside ${ogPath}`);
    }
  }

  /* Product-health regression gate (HIP-3 batch, xstocks kick, picker, watchdog). */
  {
    const r = spawnSync(process.execPath, ['scripts/assert-product-health.mjs'], {
      cwd: process.cwd(),
      encoding: 'utf8',
    });
    if (r.stdout) process.stdout.write(r.stdout);
    if (r.stderr) process.stderr.write(r.stderr);
    if (r.status !== 0) fail('assert-product-health.mjs failed');
  }

  for (const p of walkFiles('frontend/public')) {
    if (!/\.(js|html|css|webmanifest)$/.test(p)) continue;
    const rel = relative(process.cwd(), p);
    if (isVendorJs(rel) || skipRemnantPath(rel)) continue;
    let st;
    try { st = statSync(p); } catch { continue; }
    if (st.size > 3_000_000) continue;
    const txt = readFileSync(p, 'utf8');
    for (const { re, label } of FORBIDDEN_PATTERNS) {
      if (re.test(txt)) fail(`${label} in ${rel}`);
    }
    if (p.endsWith('.js') && !isVendorJs(rel)) {
      const r = spawnSync(process.execPath, ['--check', p], { encoding: 'utf8' });
      if (r.status !== 0) {
        fail(`JS syntax error: ${rel}\n${(r.stderr || r.stdout || '').trim()}`);
      }
    }
  }
}

// Backend + env + compose remnant scan
const extraRoots = ['backend/src', '.env.example', 'docker-compose.yml'].filter((p) => existsSync(p));
for (const root of extraRoots) {
  const files = statSync(root).isDirectory() ? walkFiles(root) : [root];
  for (const p of files) {
    if (!/\.(js|mjs|cjs|json|yml|yaml|example|env)$/.test(p) && !p.endsWith('.example')) continue;
    const rel = relative(process.cwd(), p) || p;
    if (skipRemnantPath(rel)) continue;
    if (rel.includes('node_modules')) continue;
    let st;
    try { st = statSync(p); } catch { continue; }
    if (st.size > 2_000_000) continue;
    const txt = readFileSync(p, 'utf8');
    for (const { re, label } of FORBIDDEN_PATTERNS) {
      if (re.test(txt)) fail(`${label} in ${rel}`);
    }
  }
}

if (existsSync('frontend/dist/version.json')) {
  const v = JSON.parse(readFileSync('frontend/dist/version.json', 'utf8'));
  if (!v.v || String(v.v).length < 6) fail('dist/version.json missing build id');
}

if (errors) {
  console.error(`\n${errors} stabilization check(s) failed — refuse to deploy.`);
  process.exit(1);
}
console.log('✓ frontend clean (syntax + remnant gate; HL Spot kept; legacy spot/binary gone)');
