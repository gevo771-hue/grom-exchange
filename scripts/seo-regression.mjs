#!/usr/bin/env node
/**
 * SEO regression — EN + Stage-1 (es, pt-BR) + Stage-2 (tr, ru) + Stage-3 (vi, id).
 * Run after: node scripts/build-frontend.mjs
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SEO_COPY, wordCount, buildRouteArticleHtml } from './seo-route-content.mjs';
import {
  ROUTE_KEEP_PAGES,
  ALL_PAGE_IDS,
  crawlableBodyText,
  ADMIN_MARKERS,
  DEMO_CLAIM_PATTERNS,
} from './seo-public-html.mjs';
import { allLocalizedPages, SEO_LOCALES } from './seo-locales.mjs';

const OUT = 'frontend/dist';
const CYRILLIC = /[А-Яа-яЁё]/;
const FORBIDDEN_META = /Polymarket|Kalshi|Hyperliquid|xStocks|акции/i;
let failed = 0;

function fail(msg) {
  console.error('✗', msg);
  failed += 1;
}
function ok(msg) {
  console.log('✓', msg);
}

function metaContent(html, name) {
  const m = html.match(new RegExp(`<meta\\s+name="${name}"\\s+content="([^"]*)"`, 'i'))
    || html.match(new RegExp(`<meta\\s+content="([^"]*)"\\s+name="${name}"`, 'i'));
  return m ? m[1] : '';
}
function titleOf(html) {
  const m = html.match(/<title>([^<]*)<\/title>/i);
  return m ? m[1].trim() : '';
}
function canonicalOf(html) {
  const m = html.match(/<link\s+rel="canonical"\s+href="([^"]*)"/i);
  return m ? m[1] : '';
}

if (!existsSync(OUT)) {
  console.error('Run build-frontend.mjs first — missing', OUT);
  process.exit(1);
}

const titles = new Set();
const descs = new Set();
const PAGES = allLocalizedPages();

for (const page of PAGES) {
  const file = page.dir ? `${page.dir}/index.html` : 'index.html';
  const fp = join(OUT, file);
  const label = page.path;
  const loc = page.locale;

  if (!existsSync(fp)) {
    fail(`${label}: missing ${file}`);
    continue;
  }
  const html = readFileSync(fp, 'utf8');
  const htmlNoScripts = html.replace(/<(?:script|style)\b[^>]*>[\s\S]*?<\/(?:script|style)>/gi, '');
  const bodyText = crawlableBodyText(html);

  if (!new RegExp(`<html[^>]*\\blang="${loc.htmlLang}"`, 'i').test(html)) {
    fail(`${label}: html lang is not ${loc.htmlLang}`);
  } else ok(`${label}: lang=${loc.htmlLang}`);

  if (/noindex/i.test(metaContent(html, 'robots'))) fail(`${label}: robots contains noindex`);

  const canon = canonicalOf(html);
  const expectCanon = 'https://grom.exchange' + (page.path === '/' ? '/' : page.path);
  if (canon !== expectCanon) fail(`${label}: canonical ${canon} ≠ ${expectCanon}`);
  else ok(`${label}: canonical`);

  const title = titleOf(html);
  const desc = metaContent(html, 'description');
  if (!title || !desc) fail(`${label}: missing title/description`);
  if (titles.has(title)) fail(`${label}: duplicate title`);
  if (descs.has(desc)) fail(`${label}: duplicate description`);
  titles.add(title);
  descs.add(desc);
  if (title) ok(`${label}: unique title`);

  const h1s = [...htmlNoScripts.matchAll(/<h1(\s[^>]*)?>/gi)];
  if (h1s.length !== 1) fail(`${label}: expected 1 H1, found ${h1s.length}`);
  else ok(`${label}: one H1`);

  if (!html.includes('id="gromSeoRouteCopy"')) fail(`${label}: missing SEO article`);
  if (!html.includes('gromSeoWebAppLd') || !html.includes('gromSeoFaqLd')) {
    fail(`${label}: missing JSON-LD`);
  }
  if (!html.includes('grom-seo-details') || !html.includes('grom-seo-summary')) {
    fail(`${label}: SEO must be visible <details>`);
  }
  if (/clip-path:inset\(50%\)|clip:rect\(0,\s*0,\s*0,\s*0\)/.test(html)) {
    fail(`${label}: SEO copy must not use hidden-text clip CSS`);
  }
  if (html.indexOf('id="gromSeoRouteCopy"') > html.lastIndexOf('</main>')) {
    fail(`${label}: SEO copy must live inside <main>`);
  }

  for (const l of SEO_LOCALES) {
    if (!html.includes(`hreflang="${l.hreflang}"`)) fail(`${label}: missing hreflang ${l.hreflang}`);
  }
  if (!html.includes('hreflang="x-default"')) fail(`${label}: missing x-default`);
  else ok(`${label}: hreflang set`);

  if (!html.includes('grom-seo-langs')) fail(`${label}: missing crawlable language switcher`);

  const article = html.match(/<section id="gromSeoRouteCopy"[\s\S]*?<\/section>/i)?.[0] || '';
  const words = wordCount(article);
  if (words < 250) fail(`${label}: SEO copy too short (${words} words)`);
  else ok(`${label}: ${words} words`);

  // Language switcher always includes the "Русский" label; allow that everywhere.
  // Full Cyrillic body copy is only expected on `ru`.
  const bodySansRuLabel = bodyText.replace(/Русский/g, '');
  if (loc.code !== 'ru' && CYRILLIC.test(bodySansRuLabel)) {
    fail(`${label}: Cyrillic in crawlable body`);
  } else if (loc.code === 'ru' && !CYRILLIC.test(bodyText)) {
    fail(`${label}: expected Cyrillic copy on ru`);
  } else {
    ok(`${label}: Cyrillic policy ok`);
  }
  if (loc.code === 'en' && FORBIDDEN_META.test(title + ' ' + desc)) {
    fail(`${label}: forbidden brand/Cyrillic in title/description`);
  }

  for (const marker of ADMIN_MARKERS) {
    if (htmlNoScripts.includes(marker)) fail(`${label}: admin marker ${marker}`);
  }
  for (const re of DEMO_CLAIM_PATTERNS) {
    re.lastIndex = 0;
    if (re.test(htmlNoScripts)) fail(`${label}: demo claim ${re}`);
  }

  const keep = new Set(ROUTE_KEEP_PAGES[page.route] || []);
  for (const id of ALL_PAGE_IDS) {
    const present = htmlNoScripts.includes(`id="${id}"`);
    if (keep.has(id) && !present) fail(`${label}: missing ${id}`);
    if (!keep.has(id) && present) fail(`${label}: inactive page ${id}`);
  }
  if (/\bbinary options?\b/i.test(bodyText)) fail(`${label}: retired binary product in crawlable body`);
  ok(`${label}: slim route body`);
}

/* app.html */
{
  const appPath = join(OUT, 'app.html');
  if (!existsSync(appPath)) fail('app.html missing');
  else {
    const app = readFileSync(appPath, 'utf8');
    const appBody = app.replace(/<(?:script|style)\b[^>]*>[\s\S]*?<\/(?:script|style)>/gi, '');
    const appText = crawlableBodyText(app);
    if (/GROM-G7K3Q9|prize pool[\s\S]{0,40}\$25,000/i.test(appBody)) fail('app.html: demo claims');
    if (appBody.includes('id="page-backoffice"')) {
      fail('app.html: admin page present (must load via /pages/backoffice.html)');
    } else ok('app.html: admin page absent');
    if (!appBody.includes('id="navBackoffice"')) {
      fail('app.html: missing #navBackoffice hook');
    } else ok('app.html: admin nav hook present');
    if (appBody.includes('id="page-binary"')) fail('app.html: binary present');
    if (!appBody.includes('id="page-wallet"')) fail('app.html: wallet missing');
    const bad = [...new Set([...(appText.match(/[А-Яа-яЁё]{2,}/g) || [])])].filter((w) => w !== 'Русский');
    if (bad.length) fail(`app.html: Cyrillic defaults — ${bad.slice(0, 8).join(', ')}`);
    else ok('app.html: English defaults (no Cyrillic UI)');
  }
}

for (const [key] of Object.entries(SEO_COPY)) {
  const w = wordCount(buildRouteArticleHtml(key));
  if (w < 250) fail(`SEO_COPY.${key} only ${w} words`);
}

const sm = join(OUT, 'sitemap.xml');
if (!existsSync(sm)) fail('sitemap.xml missing');
else {
  const sx = readFileSync(sm, 'utf8');
  if (!sx.includes('xmlns:xhtml')) fail('sitemap missing xhtml hreflang');
  for (const p of PAGES) {
    const loc = 'https://grom.exchange' + (p.path === '/' ? '/' : p.path);
    if (!sx.includes(`<loc>${loc}</loc>`)) fail(`sitemap missing ${loc}`);
  }
  ok(`sitemap lists ${PAGES.length} URLs`);
}

const robotsPath = join(OUT, 'robots.txt');
if (!existsSync(robotsPath)) fail('robots.txt missing');
else {
  const robots = readFileSync(robotsPath, 'utf8');
  if (/^\s*Disallow:\s*\/\s*$/mi.test(robots)) fail('robots.txt blocks the whole site');
  if (!/^\s*Sitemap:\s*https:\/\/grom\.exchange\/sitemap\.xml\s*$/mi.test(robots)) {
    fail('robots.txt missing canonical sitemap declaration');
  } else ok('robots.txt allows crawling and declares sitemap');
}

if (failed) {
  console.error(`\n${failed} SEO regression failure(s)`);
  process.exit(1);
}
console.log(`\nAll SEO regression checks passed (${PAGES.length} URLs)`);
