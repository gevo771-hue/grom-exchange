/**
 * Swap / bridge / «alternative to …» pages (owner, 24.11): /swap/eth-to-sol, /bridge/usdc-ethereum-to-base,
 * /alternatives/uniswap and the same under /es, /pt-BR, /tr, /ru, /vi, /id.
 *
 * Same model as the coin pages (token-pages.js): browsers get the app (frontend nginx → app.html) and
 * the swap opens with the pair picked (`GET /api/market/route-page`); crawlers get HTML rendered here
 * from the build's token templates (the slim /swap page per language) with their own title,
 * description, canonical, hreflang, a collapsed «Details» block and JSON-LD. `/sitemap-routes.xml`
 * lists every page in every language.
 *
 * Swap pages carry an indicative CoinGecko rate (cached 10 min) — never a quote: the swap shows the real
 * amount after fees before signing (same rule as «Модель, не котировка»).
 */
import axios from 'axios';
import { TOKEN_LOCALES, tokenLocale } from './token-pages-i18n.js';
import { ROUTE_COPY } from './route-pages-i18n.js';
import { RP_ROUTES, RP_ALTS, RP_ALL, RP_ASSETS, RP_SEGMENT, RP_KIND_BY_SEGMENT, rpFind, rpSide, rpLabel } from './route-pages-data.js';

export { RP_ROUTES, RP_ALTS, RP_ALL, RP_SEGMENT, RP_KIND_BY_SEGMENT, rpFind, rpLabel };

const SITE = 'https://grom.exchange';
const CG_FREE = 'https://api.coingecko.com/api/v3';
const CG_PRO = 'https://pro-api.coingecko.com/api/v3';
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const locOf = (code) => tokenLocale(code) || TOKEN_LOCALES[0];
const copyOf = (code) => ROUTE_COPY[locOf(code).code] || ROUTE_COPY.en;

/** /swap/eth-to-sol, /ru/bridge/usdc-ethereum-to-base … */
export function routePath(r, code = 'en') {
  return `${locOf(code).prefix}/${RP_SEGMENT[r.kind]}/${r.slug}`;
}
const pageUrl = (r, code) => `${SITE}${routePath(r, code)}`;

/* Rate formatting: 24.15 SOL, 3,345.67 USDT, 0.04141 ETH. */
function fmtRate(v, num) {
  if (!(v > 0) || !Number.isFinite(v)) return null;
  if (v >= 1000) return v.toLocaleString(num, { maximumFractionDigits: 2 });
  if (v >= 1) return v.toLocaleString(num, { maximumFractionDigits: 4 });
  return v.toLocaleString(num, { maximumSignificantDigits: 4 });
}

/** Template parameters for one route in one language. prices: { cgId: usd }, at: ms. */
export function routeParams(r, code = 'en', { prices = null, at = Date.now() } = {}) {
  const loc = locOf(code);
  const c = copyOf(loc.code);
  if (r.kind === 'alt') return { name: r.name, type: r.type };
  const A = rpSide(r.from);
  const B = rpSide(r.to);
  const pa = prices?.[RP_ASSETS[A.sym]?.cg];
  const pb = prices?.[RP_ASSETS[B.sym]?.cg];
  const sameAsset = RP_ASSETS[A.sym]?.cg === RP_ASSETS[B.sym]?.cg;
  return {
    a: r.a || A.sym,
    b: r.b || B.sym,
    aSym: A.sym,
    bSym: B.sym,
    t: A.sym,
    tOut: B.sym,
    from: A.chainName,
    to: B.chainName,
    fromGas: A.gas,
    toGas: B.gas,
    same: A.chain === B.chain,
    xvm: A.chainKind !== B.chainKind || B.chainKind !== 'evm',
    fromL1: A.l1,
    wallet: c.wallets[A.chainKind],
    toAddr: c.addr[B.chainKind],
    sameAsset,
    rate: !sameAsset && pa > 0 && pb > 0 ? fmtRate(pa / pb, loc.num) : null,
    time: new Date(at).toISOString().slice(11, 16),
    A,
    B,
  };
}

/** Which «Before you start» notes a route gets. */
export function routeTips(r) {
  if (r.kind === 'alt') return [];
  const A = rpSide(r.from);
  const B = rpSide(r.to);
  const tips = [];
  if (A.chain === B.chain) tips.push('same');
  if (A.chainKind !== B.chainKind || B.chainKind !== 'evm') tips.push('addr');
  if (A.sym === 'USDT' && B.sym === 'USDT' && (A.chain === 'tron' || B.chain === 'tron')) tips.push('usdtNets');
  if (A.chain === 'tron') tips.push('tronGas');
  if (B.key === 'USDT0@plasma') tips.push('usdt0');
  if (B.fresh) tips.push('fresh');
  if (A.chain !== B.chain) tips.push(B.sym === B.gas ? 'gasReady' : 'destGas');
  return tips;
}

export function routePageMeta(r, code = 'en', opts = {}) {
  const c = copyOf(code);
  const p = routeParams(r, code, opts);
  if (r.kind === 'alt') return { title: c.altTitle(p), description: c.altDesc(p) };
  if (r.kind === 'bridge') return { title: c.bridgeTitle(p), description: c.bridgeDesc(p) };
  return { title: c.swapTitle(p), description: c.swapDesc(p) };
}

function faqFor(r, code, opts) {
  const c = copyOf(code);
  const p = routeParams(r, code, opts);
  if (r.kind === 'alt') return c.altFaq(p);
  return r.kind === 'bridge' ? c.bridgeFaq(p) : c.swapFaq(p);
}

/** Up to n other pages: same kind first, then the other route kind, then alternatives. */
export function relatedRoutes(r, n = 10) {
  const others = RP_ALL.filter((x) => !(x.kind === r.kind && x.slug === r.slug));
  const order = { swap: 0, bridge: 1, alt: 2 };
  const rank = (x) => (x.kind === r.kind ? -1 : order[x.kind]);
  const touches = (x) => {
    if (r.kind === 'alt' || x.kind === 'alt') return 0;
    const chains = new Set([rpSide(r.from).chain, rpSide(r.to).chain]);
    return chains.has(rpSide(x.from).chain) || chains.has(rpSide(x.to).chain) ? -1 : 0;
  };
  return others
    .map((x, i) => ({ x, k: [rank(x), touches(x), i] }))
    .sort((u, v) => u.k[0] - v.k[0] || u.k[1] - v.k[1] || u.k[2] - v.k[2])
    .slice(0, n)
    .map((u) => u.x);
}

/** Link text in a language: «ETH → SOL», «USDC: Ethereum → Base», «Alternativa a Uniswap». */
export function routeLinkLabel(r, code = 'en') {
  return r.kind === 'alt' ? copyOf(code).altLabel(r.name) : rpLabel(r);
}

function linksNav(list, code, label) {
  return `<nav class="grom-seo-nav" aria-label="${esc(label)}">${list.map((x) => `<a href="${esc(routePath(x, code))}">${esc(routeLinkLabel(x, code))}</a>`).join('\n')}</nav>`;
}

export function routeArticleHtml(r, { locale = 'en', prices = null, at = Date.now() } = {}) {
  const loc = locOf(locale);
  const c = copyOf(loc.code);
  const p = routeParams(r, loc.code, { prices, at });
  const li = (arr) => arr.map((t) => `<li>${esc(t)}</li>`).join('\n        ');
  const navPaths = ['/', '/swap', '/futures', '/predict', '/stocks', '/markets'];
  const nav = navPaths.map((path, i) => `<a href="${esc(loc.prefix ? (path === '/' ? `${loc.prefix}/` : loc.prefix + path) : path)}">${esc(loc.nav[i])}</a>`).join(' ');
  let h1;
  let body;
  if (r.kind === 'alt') {
    h1 = c.altH1(p);
    const routes = RP_ROUTES.slice(0, 14);
    body = `
      <p class="grom-seo-lead">${esc(c.altLead(p))}</p>
      <h2>${esc(c.altWhatH2(p))}</h2>
      <p>${esc(c.altWhat[r.type](p))}</p>
      <p>${esc(c.altGromWhat)}</p>
      <h2>${esc(c.altWhyH2)}</h2>
      <ul>
        ${li(c.altWhy(p))}
      </ul>
      <h2>${esc(c.altBetterH2(p))}</h2>
      <p>${esc(c.altBetter[r.type](p))}</p>
      <h2>${esc(c.routesH2)}</h2>
      ${linksNav(routes, loc.code, c.routesH2)}
      <h2>${esc(c.moreH2)}</h2>
      ${linksNav(RP_ALTS.filter((x) => x.slug !== r.slug), loc.code, c.moreH2)}`;
  } else {
    const isBridge = r.kind === 'bridge';
    h1 = isBridge ? c.bridgeH1(p) : c.swapH1(p);
    const rate = !isBridge && !p.sameAsset
      ? `
      <h2>${esc(c.rateH2(p))}</h2>
      <p>${esc(p.rate ? c.rate(p) : c.rateNone(p))}</p>`
      : '';
    body = `
      <p class="grom-seo-lead">${esc(isBridge ? c.bridgeLead(p) : c.swapLead(p))}</p>${rate}
      <h2>${esc(isBridge ? c.bridgeHowH2(p) : c.howH2(p))}</h2>
      <ol>
        ${li(isBridge ? c.bridgeSteps(p) : c.swapSteps(p))}
      </ol>
      <h2>${esc(c.feesH2)}</h2>
      <p>${esc(isBridge ? c.bridgeFees(p) : c.swapFees(p))}</p>
      <h2>${esc(c.tipsH2)}</h2>
      <ul>
        ${li(routeTips(r).map((k) => c.tips[k](p)))}
      </ul>
      <h2>${esc(c.moreH2)}</h2>
      ${linksNav(relatedRoutes(r), loc.code, c.moreH2)}`;
  }
  return `
<section id="gromSeoRouteCopy" class="grom-seo-route" data-seo-route="${esc(r.kind)}" lang="${esc(loc.htmlLang)}">
  <details class="grom-seo-details">
    <summary class="grom-seo-summary">${esc(c.about)} · ${esc(h1)}</summary>
    <article class="grom-seo-article">
      <h1>${esc(h1)}</h1>${body}
      <h2>${esc(loc.explore)}</h2>
      <nav class="grom-seo-nav" aria-label="Product links">${nav}</nav>
      <h2>${esc(c.faqH2)}</h2>
      <div class="grom-seo-faq">${faqFor(r, loc.code, { prices, at }).map((x) => `<details class="grom-seo-faq-item"><summary>${esc(x.q)}</summary><p>${esc(x.a)}</p></details>`).join('\n')}</div>
    </article>
  </details>
</section>`.trim();
}

export function routeJsonLd(r, code = 'en', opts = {}) {
  const loc = locOf(code);
  const { title, description } = routePageMeta(r, loc.code, opts);
  const url = pageUrl(r, loc.code);
  const home = loc.prefix ? `${SITE}${loc.prefix}/` : `${SITE}/`;
  const page = {
    '@context': 'https://schema.org', '@type': 'WebPage', name: title, url, description, inLanguage: loc.htmlLang,
    publisher: { '@type': 'Organization', name: 'GROM Exchange', url: `${SITE}/` },
  };
  const crumbs = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'GROM', item: home },
      { '@type': 'ListItem', position: 2, name: 'Swap', item: `${SITE}${loc.prefix}/swap` },
      { '@type': 'ListItem', position: 3, name: routeLinkLabel(r, loc.code), item: url },
    ],
  };
  const faq = {
    '@context': 'https://schema.org', '@type': 'FAQPage', inLanguage: loc.htmlLang,
    mainEntity: faqFor(r, loc.code, opts).map((x) => ({ '@type': 'Question', name: x.q, acceptedAnswer: { '@type': 'Answer', text: x.a } })),
  };
  const json = (o) => JSON.stringify(o).replace(/</g, '\\u003c');
  return [page, crumbs, faq].map((o) => `<script type="application/ld+json">${json(o)}</script>`).join('\n');
}

/** Mutual hreflang set (all languages + x-default → English). */
export function routeHreflang(r) {
  const links = TOKEN_LOCALES.map((l) => `<link rel="alternate" hreflang="${l.hreflang}" href="${esc(pageUrl(r, l.code))}" />`);
  links.push(`<link rel="alternate" hreflang="x-default" href="${esc(pageUrl(r, 'en'))}" />`);
  return links.join('\n');
}

/** Fill the build's per-language token template (scripts/build-frontend.mjs) for one route. */
export function renderRoutePage(template, r, opts = {}) {
  const code = locOf(opts.locale).code;
  const loc = locOf(code);
  const { title, description } = routePageMeta(r, code, opts);
  return String(template)
    .split(`${SITE}${loc.prefix}/token/__GROM_TOKEN_ID__`).join(esc(pageUrl(r, code)))
    .split('__GROM_TOKEN_ID__').join(esc(r.slug))
    .split('__GROM_TOKEN_TITLE__').join(esc(title))
    .split('__GROM_TOKEN_DESC__').join(esc(description))
    .replace('<!--GROM_TOKEN_HREFLANG-->', () => routeHreflang(r))
    .replace('<!--GROM_TOKEN_ARTICLE-->', () => routeArticleHtml(r, { ...opts, locale: code }))
    .replace('<!--GROM_TOKEN_JSONLD-->', () => routeJsonLd(r, code, opts));
}

export function routeNotFoundHtml(code = 'en') {
  const loc = locOf(code);
  const c = copyOf(loc.code);
  return `<!doctype html><html lang="${esc(loc.htmlLang)}"><head><meta charset="utf-8"><title>${esc(c.notFound.replace(/\.$/, ''))} — GROM</title><meta name="robots" content="noindex"></head><body><p>${esc(c.notFound)} <a href="${esc(loc.prefix)}/swap">${esc(c.openSwap)}</a></p></body></html>`;
}

/** Every page in every language, each with its full hreflang set. */
export function routeSitemapXml({ lastmod = new Date().toISOString().slice(0, 10) } = {}) {
  const urls = [];
  for (const r of RP_ALL) {
    const alts = TOKEN_LOCALES.map((l) => `    <xhtml:link rel="alternate" hreflang="${l.hreflang}" href="${pageUrl(r, l.code)}" />`)
      .concat(`    <xhtml:link rel="alternate" hreflang="x-default" href="${pageUrl(r, 'en')}" />`)
      .join('\n');
    for (const l of TOKEN_LOCALES) {
      urls.push(`  <url>\n    <loc>${pageUrl(r, l.code)}</loc>\n    <lastmod>${lastmod}</lastmod>\n${alts}\n  </url>`);
    }
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n        xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join('\n')}\n</urlset>\n`;
}

/** What the browser needs to pick the pair: title/description in the page language + both sides. */
export function routeSwapInfo(r, code = 'en') {
  const loc = locOf(code);
  const meta = routePageMeta(r, loc.code);
  const info = { kind: r.kind, slug: r.slug, path: routePath(r, loc.code), title: meta.title, description: meta.description };
  if (r.kind === 'alt') return info;
  const side = (s) => ({ sym: s.sym, name: s.assetName, chainId: s.chainId, chain: s.chain, address: s.address, decimals: s.decimals, kind: s.chainKind });
  return { ...info, from: side(rpSide(r.from)), to: side(rpSide(r.to)) };
}

/* ───────────── indicative prices (CoinGecko, 10 min) ───────────── */

export function createRoutePrices({
  get = axios.get,
  now = Date.now,
  apiKey = String(process.env.COINGECKO_API_KEY || process.env.GROM_COINGECKO_API_KEY || '').trim(),
  ttl = 10 * 60_000,
} = {}) {
  const ids = [...new Set(Object.values(RP_ASSETS).map((a) => a.cg))];
  const base = apiKey ? CG_PRO : CG_FREE;
  const headers = { Accept: 'application/json', 'User-Agent': 'grom-exchange/1.0', ...(apiKey ? { 'x-cg-pro-api-key': apiKey } : {}) };
  let last = { prices: null, at: 0 };
  let pending = null;
  return async function prices() {
    if (last.prices && now() - last.at < ttl) return last;
    if (!pending) {
      pending = get(`${base}/simple/price`, { params: { ids: ids.join(','), vs_currencies: 'usd' }, headers, timeout: 6000 })
        .then(({ data }) => {
          const out = {};
          for (const id of ids) {
            const v = Number(data?.[id]?.usd);
            if (v > 0) out[id] = v;
          }
          if (Object.keys(out).length) last = { prices: out, at: now() };
        })
        .catch(() => {})
        .finally(() => { pending = null; });
    }
    await pending;
    /* Rates older than a day are not shown: the page falls back to «the live rate loads in the swap». */
    return last.prices && now() - last.at < 24 * 3_600_000 ? last : { prices: null, at: now() };
  };
}

let pricesSingleton = null;
export function routePrices() {
  if (!pricesSingleton) pricesSingleton = createRoutePrices();
  return pricesSingleton();
}
