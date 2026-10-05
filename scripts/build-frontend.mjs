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
import { execSync } from 'node:child_process';
import {
  cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync,
} from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import {
  SEO_COPY,
  SEO_ROUTE_STYLE,
  ORG_JSON_LD,
  buildRouteArticleHtml,
  buildRouteJsonLd,
  wordCount,
} from './seo-route-content.mjs';
import {
  preparePublicRouteHtml,
  prepareAppShellHtml,
  extractSectionInnerHtml,
} from './seo-public-html.mjs';
import {
  allLocalizedPages,
  hreflangBlock,
  SEO_LOCALES,
} from './seo-locales.mjs';
import { getSeoMeta } from './seo-copy-localized.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = 'frontend/public';
const OUT = 'frontend/dist';
const SEO_STAMP = join(__dirname, '.seo-content-stamp.json');

// Fail before touching dist. Missing markers previously made the build silently
// publish the raw SPA for every localized URL while still exiting successfully.
const sourceIndexHtml = readFileSync(join(SRC, 'index.html'), 'utf8');
const SEO_BEGIN = '<!-- SEO:BEGIN -->';
const SEO_END = '<!-- SEO:END -->';
const seoBeginIndex = sourceIndexHtml.indexOf(SEO_BEGIN);
const seoEndIndex = sourceIndexHtml.indexOf(SEO_END);
if (seoBeginIndex < 0 || seoEndIndex <= seoBeginIndex) {
  console.error('❌ build aborted — frontend/public/index.html has invalid SEO markers');
  process.exit(1);
}

// Self-hosted WalletConnect bundles (Safari-safe). SEO-only/offline builds can
// explicitly reuse the checked-in bundle instead of waiting on npm/network.
const cachedWcBundle = join(SRC, 'wc/ethereum-provider.bundle.js');
if (process.env.GROM_SKIP_WC_BUNDLE === '1') {
  if (!existsSync(cachedWcBundle)) {
    console.error('❌ GROM_SKIP_WC_BUNDLE=1 but no cached WalletConnect bundle exists');
    process.exit(1);
  }
  console.warn('⚠️  WalletConnect rebuild skipped — using cached frontend/public/wc bundle');
} else {
  try {
    execSync('node scripts/bundle-wc.mjs', { stdio: 'inherit', timeout: 60_000 });
  } catch (e) {
    if (!existsSync(cachedWcBundle)) {
      console.error('❌ WC bundle failed and no cached bundle in frontend/public/wc/');
      process.exit(1);
    }
    console.warn('⚠️  WalletConnect bundle failed/timed out — using cached frontend/public/wc bundle');
  }
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
cpSync(SRC, OUT, { recursive: true });
// The app loads this fragment after the public shell removes the admin section.
// Derive it from the same source so controls and event handlers cannot drift.
writeFileSync(join(OUT, 'pages/backoffice.html'), extractSectionInnerHtml(sourceIndexHtml, 'page-backoffice'));

// Guard: critical wallet symbols must survive CSS/code-split transforms.
// Catches critical wallet symbols being lost between inject stubs.
{
  const walletSrc = readFileSync(join(SRC, 'grom-wallet.js'), 'utf8');
  let dashSrc = '';
  try { dashSrc = readFileSync(join(SRC, 'grom-wallet-dash.js'), 'utf8'); } catch {}
  const both = walletSrc + '\n' + dashSrc;
  const critical = [
    ['const|let|var', 'GW_AI_TR'],
    ['(?:async )?function', 'gwSetupAiCoach'],
    ['(?:async )?function', 'gwAiOpen'],
    ['(?:async )?function', 'gwDsSimSetup'],
    ['(?:async )?function', 'gwDsSetQuoteExecReady'],
  ];
  const missing = [];
  for (const [kind, name] of critical) {
    const re = new RegExp(String.raw`(?:^|\n)(?:${kind}) ${name}\b`);
    if (!re.test(both)) missing.push(name);
  }
  if (missing.length) {
    console.error('❌ build aborted — missing critical wallet symbols:', missing.join(', '));
    process.exit(1);
  }
}


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

// Build version = hash of asset hashes + index.html (inline CSS/JS lives there;
// without it, index-only fixes keep the same APP_VER and Safari won't self-heal).
const indexHtml = readFileSync(join(SRC, 'index.html'));
const buildVer = createHash('sha256')
  .update(Object.entries(map).sort().map(([k, v]) => `${k}:${v}`).join('|'))
  .update('|index:')
  .update(indexHtml)
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

/** SEO section pages + sitemap (path URLs for crawlers). */
const SEO_PAGES = allLocalizedPages().map((p) => {
  const meta = getSeoMeta(p.locale.code, p.route);
  return {
    path: p.path,
    dir: p.dir || null,
    route: p.route,
    productPath: p.productPath,
    locale: p.locale,
    title: meta.title,
    description: meta.description,
  };
});

function seoMetaBlock(page) {
  const url = 'https://grom.exchange' + (page.path === '/' ? '/' : page.path);
  const t = page.title;
  const d = page.description;
  const loc = page.locale || SEO_LOCALES[0];
  const ogLocale =
    loc.code === 'es'
      ? 'es_ES'
      : loc.code === 'pt-BR'
        ? 'pt_BR'
        : loc.code === 'tr'
          ? 'tr_TR'
          : loc.code === 'ru'
            ? 'ru_RU'
            : loc.code === 'vi'
              ? 'vi_VN'
              : loc.code === 'id'
                ? 'id_ID'
                : 'en_US';
  return [
    `<link rel="canonical" href="${url}" />`,
    hreflangBlock(page.productPath || page.path),
    `<title>${t}</title>`,
    `<meta name="description" content="${d}" />`,
    `<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1" />`,
    `<meta name="googlebot" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1" />`,
    `<meta name="author" content="GROM" />`,
    `<meta name="keywords" content="crypto exchange, DEX, swap crypto, cross-chain swap, non-custodial, perpetual futures, prediction markets, tokenized stocks, live crypto prices" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="GROM" />`,
    `<meta property="og:title" content="${t}" />`,
    `<meta property="og:description" content="${d}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="https://grom.exchange/assets/og-share-nord.png?v=20260922i" />`,
    `<meta property="og:image:secure_url" content="https://grom.exchange/assets/og-share-nord.png?v=20260922i" />`,
    `<meta property="og:image:type" content="image/png" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="GROM — Spot Perps Prediction Stocks" />`,
    `<meta property="og:locale" content="${ogLocale}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${t}" />`,
    `<meta name="twitter:description" content="${d}" />`,
    `<meta name="twitter:image" content="https://grom.exchange/assets/og-share-nord.png?v=20260922i" />`,
    `<meta name="twitter:image:alt" content="GROM — Spot Perps Prediction Stocks" />`,
    `<meta name="twitter:site" content="@GromExchange" />`,
    `<meta name="twitter:creator" content="@GromExchange" />`,
  ].join('\n');
}

function demoteExtraH1(html) {
  /* Keep a single H1 inside #gromSeoRouteCopy; demote SPA H1s for crawlers.
     Never touch <script>/<style> — index.html embeds JS strings with <h1>/<body>. */
  const protect = /(<(?:script|style)\b[^>]*>[\s\S]*?<\/(?:script|style)>|<section id="gromSeoRouteCopy"[\s\S]*?<\/section>)/gi;
  const parts = html.split(protect);
  return parts.map((chunk) => {
    if (/^<(?:script|style)\b/i.test(chunk) || /^<section id="gromSeoRouteCopy"/i.test(chunk)) {
      return chunk;
    }
    return chunk
      .replace(/<h1(\s|>)/gi, '<h2 data-seo-demoted="1"$1')
      .replace(/<\/h1>/gi, '</h2>');
  }).join('');
}

function injectBeforeBodyClose(html, inject) {
  /* Use the document's real </body> — first match can be inside a JS string. */
  const idx = html.toLowerCase().lastIndexOf('</body>');
  if (idx < 0) return html;
  return html.slice(0, idx) + inject + '\n' + html.slice(idx);
}

function injectBeforeMainClose(html, inject) {
  /* Put crawlable copy inside <main> so mobile (main is the scroller) only
     shows it after scrolling to the end of the active page — not pinned under the viewport. */
  const idx = html.lastIndexOf('</main>');
  if (idx < 0) return injectBeforeBodyClose(html, inject);
  return html.slice(0, idx) + inject + '\n' + html.slice(idx);
}

function applySeoToHtml(html, page) {
  const begin = SEO_BEGIN;
  const end = SEO_END;
  const i = html.indexOf(begin);
  const j = html.indexOf(end);
  if (i < 0 || j < 0 || j <= i) {
    throw new Error(`SEO markers missing while generating ${page.path}`);
  }
  html = html.slice(0, i + begin.length) + '\n' + seoMetaBlock(page) + '\n' + html.slice(j);
  const loc = page.locale || SEO_LOCALES[0];
  html = html.replace(/<html\b([^>]*)>/i, (m, attrs) => {
    let a = attrs.replace(/\sdata-grom-route="[^"]*"/i, '');
    a = a.replace(/\slang="[^"]*"/i, '');
    a = a.replace(/\sdata-grom-locale="[^"]*"/i, '');
    return `<html lang="${loc.htmlLang}"${a} data-grom-route="${page.route}" data-grom-locale="${loc.code}">`;
  });

  /* Organization sameAs — verified profiles only. */
  html = html.replace(
    /<script type="application\/ld\+json">\s*\{\s*"@context":\s*"https:\/\/schema\.org",\s*"@type":\s*"Organization"[\s\S]*?<\/script>/,
    `<script type="application/ld+json">\n${ORG_JSON_LD}\n</script>`
  );

  /* Drop static homepage FAQ JSON-LD — replaced by route-specific FAQPage. */
  html = html.replace(
    /<script type="application\/ld\+json">\s*\{\s*"@context":\s*"https:\/\/schema\.org",\s*"@type":\s*"FAQPage"[\s\S]*?<\/script>/,
    ''
  );

  const localeCode = loc.code || 'en';
  const article = buildRouteArticleHtml(page.route, localeCode, page.productPath || page.path);
  const jsonLd = buildRouteJsonLd(page, localeCode);
  if (article) {
    html = html.replace(/<style id="gromSeoRouteCss">[\s\S]*?<\/style>/i, '');
    html = html.replace(/<section id="gromSeoRouteCopy"[\s\S]*?<\/section>/i, '');
    html = html.replace(/<script type="application\/ld\+json" id="gromSeoWebAppLd">[\s\S]*?<\/script>/i, '');
    html = html.replace(/<script type="application\/ld\+json" id="gromSeoFaqLd">[\s\S]*?<\/script>/i, '');
    /* Visible copy scrolls with main; JSON-LD stays at end of body. */
    html = injectBeforeMainClose(html, `${SEO_ROUTE_STYLE}\n${article}`);
    html = injectBeforeBodyClose(html, `${jsonLd}`);
  }

  html = demoteExtraH1(html);
  /* Strip inactive SPA panels / admin / demo claims for this public URL. */
  html = preparePublicRouteHtml(html, page.route);
  return html;
}

function stableSitemapLastmod() {
  const today = new Date().toISOString().slice(0, 10);
  const hash = createHash('sha256')
    .update(JSON.stringify(SEO_COPY))
    .update(SEO_PAGES.map((p) => `${p.path}|${p.title}|${p.description}`).join('\n'))
    .digest('hex')
    .slice(0, 16);
  let lastmod = today;
  try {
    if (existsSync(SEO_STAMP)) {
      const prev = JSON.parse(readFileSync(SEO_STAMP, 'utf8'));
      if (prev && prev.hash === hash && prev.lastmod) lastmod = prev.lastmod;
      else writeFileSync(SEO_STAMP, JSON.stringify({ hash, lastmod: today }, null, 2) + '\n');
    } else {
      writeFileSync(SEO_STAMP, JSON.stringify({ hash, lastmod: today }, null, 2) + '\n');
    }
  } catch {
    lastmod = today;
  }
  return lastmod;
}

{
  const baseHtml = readFileSync(join(OUT, 'index.html'), 'utf8');
  /* SPA fallback for /wallet|/history|… — full desk minus admin + demo claims. */
  writeFileSync(join(OUT, 'app.html'), prepareAppShellHtml(baseHtml));
  for (const page of SEO_PAGES) {
    const localeCode = (page.locale && page.locale.code) || 'en';
    const html = applySeoToHtml(baseHtml, page);
    const words = wordCount(buildRouteArticleHtml(page.route, localeCode, page.productPath || page.path));
    if (words < 250) {
      console.warn(`⚠️  SEO copy short for ${page.path}: ${words} words`);
    }
    if (page.dir) {
      const dir = join(OUT, page.dir);
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, 'index.html'), html);
    } else {
      writeFileSync(join(OUT, 'index.html'), html);
    }
  }
  const lastmod = stableSitemapLastmod();
  const urls = SEO_PAGES.map((p) => {
    const loc = 'https://grom.exchange' + (p.path === '/' ? '/' : p.path);
    const productPath = p.productPath || p.path;
    const alts = SEO_LOCALES.map((l) => {
      const href = 'https://grom.exchange' + (l.prefix
        ? (productPath === '/' ? `${l.prefix}/` : `${l.prefix}${productPath}`)
        : (productPath === '/' ? '/' : productPath));
      return `    <xhtml:link rel="alternate" hreflang="${l.hreflang}" href="${href}" />`;
    }).join('\n');
    const xdef = 'https://grom.exchange' + (productPath === '/' ? '/' : productPath);
    return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n${alts}\n    <xhtml:link rel="alternate" hreflang="x-default" href="${xdef}" />\n  </url>`;
  }).join('\n');
  writeFileSync(join(OUT, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n` +
    `        xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls}\n</urlset>\n`);
}

// Tiny version beacon — stale tabs poll this and self-reload when it changes.
writeFileSync(join(OUT, 'version.json'), JSON.stringify({ v: buildVer }));

// Pre-compress every .html/.js/.css/.mjs → .gz twin for nginx `gzip_static on`
let gzCount = 0;
function gzTree(dir) {
  if (!existsSync(dir)) return;
  for (const f of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, f.name);
    if (f.isDirectory()) gzTree(p);
    else if (/\.(html|js|css|mjs)$/.test(f.name)) {
      writeFileSync(p + '.gz', gzipSync(readFileSync(p), { level: 9 }));
      gzCount++;
    }
  }
}
gzTree(OUT);

console.log(JSON.stringify({ buildVer, files: map, seoPages: SEO_PAGES.map((p) => p.path) }, null, 2));
console.log(`✅ Built ${OUT} · APP_VER=${buildVer} · ${gzCount} gz twins`);

function await_import_fs() { return {}; }
