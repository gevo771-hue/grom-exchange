/**
 * Coin pages /token/<coingecko-id> (owner, 22.11: GROM should show up in Google next to searches for
 * meme tokens and popular platforms).
 *
 * Browsers get the full app (frontend nginx → app.html) and the swap opens with the coin selected
 * (`GET /api/market/token-page`). Crawlers get a per-coin HTML page rendered here from the build's
 * `token-template.html` (the slim /swap page): own title, description, canonical, a collapsed
 * «About» block in the same style as the other routes, and JSON-LD. `/sitemap-tokens.xml` lists them.
 * Languages (22.11): /es, /pt-BR, /tr, /ru, /vi, /id prefixes — copy in token-pages-i18n.js, one template
 * per language from the build, mutual hreflang on every page and in the sitemap.
 *
 * Coins: CoinGecko top meme tokens + top coins by market cap + a pinned list (the landing links to
 * those) + NEW listings — only coins with a contract on a GROM swap network (NL_PLATFORMS).
 * Brand policy: no Hyperliquid / Polymarket / Kalshi / Backed / xStocks in the copy.
 */
import axios from 'axios';
import { swapPlatforms } from './new-listings.js';
import { TOKEN_LOCALES, TOKEN_COPY, tokenLocale, tokenPath } from './token-pages-i18n.js';

export { TOKEN_LOCALES, tokenLocale, tokenPath };

const CG_FREE = 'https://api.coingecko.com/api/v3';
const CG_PRO = 'https://pro-api.coingecko.com/api/v3';
const LIFI = 'https://li.quest/v1';
const SITE = 'https://grom.exchange';
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** Linked from the landing (scripts/seo-landing-extra.mjs → LANDING_MEME_TOKENS): always have a page. */
export const PINNED_TOKENS = [
  'pepe', 'dogwifcoin', 'bonk', 'shiba-inu', 'floki', 'based-brett', 'popcat', 'pudgy-penguins',
  'official-trump', 'fartcoin', 'mog-coin', 'spx6900', 'toshi',
];

export const CHAIN_NAMES = {
  eth: 'Ethereum', bsc: 'BNB Chain', base: 'Base', arbitrum: 'Arbitrum', polygon: 'Polygon',
  optimism: 'Optimism', avax: 'Avalanche', linea: 'Linea', robinhood: 'Robinhood Chain',
  hyperevm: 'HyperEVM', monad: 'Monad', arc: 'Arc', plasma: 'Plasma', xlayer: 'X Layer',
  solana: 'Solana', tron: 'TRON',
};

/* Pegged, bridged, wrapped or tokenized copies — not the coin people search for. Tokenized funds and
   securities (BUIDL, USTB, USYC, CLO funds…) are permissioned: a «buy without KYC» page would be untrue. */
const SKIP = /binance-peg|bridged|wrapped|tokenized|xstock|ondo|-wormhole|\bpeg\b|\bfund\b|treasur|securities|blackrock|hashnote|superstate|spiko|janus-henderson|anemoy|eutbl|\busyc\b|\bustb\b/i;
const ID_RE = /^[a-z0-9][a-z0-9-]{0,79}$/;

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function validTokenId(id) {
  return ID_RE.test(String(id || ''));
}

/** CoinGecko markets row + its swap networks → page entry, or null when GROM cannot swap it. */
export function buildEntry(m, platforms, kinds) {
  const id = String(m?.id || '');
  if (!validTokenId(id) || SKIP.test(id) || SKIP.test(String(m?.name || ''))) return null;
  const chains = swapPlatforms(platforms).map(({ chain, chainId, address }) => ({ chain, chainId, address }));
  if (!chains.length) return null;
  const num = (v) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
  return {
    id,
    sym: String(m.symbol || '').toUpperCase().slice(0, 20),
    name: String(m.name || m.symbol || id).slice(0, 80),
    logo: String(m.image || ''),
    price: num(m.current_price),
    chg: num(m.price_change_percentage_24h),
    mcap: num(m.market_cap),
    rank: num(m.market_cap_rank),
    vol: num(m.total_volume),
    chains,
    kinds: [...new Set(kinds)].sort(),
  };
}

export function createTokenPages({
  get = axios.get,
  now = Date.now,
  apiKey = String(process.env.COINGECKO_API_KEY || process.env.GROM_COINGECKO_API_KEY || '').trim(),
  lifiKey = String(process.env.LIFI_API_KEY || '').trim(),
  pinned = PINNED_TOKENS,
  memeLimit = 150,
  topLimit = 150,
  ttl = 30 * 60_000,
  /* { get(key), set(key, value) } — app_state in production: pages exist right after a restart. */
  store = null,
  /* () => Promise<rows> — NEW listings ({ id, sym, name, logo, price, chg, chainId, chain, address }). */
  newRows = null,
} = {}) {
  const cgBase = apiKey ? CG_PRO : CG_FREE;
  const cgHeaders = { Accept: 'application/json', 'User-Agent': 'grom-exchange/1.0', ...(apiKey ? { 'x-cg-pro-api-key': apiKey } : {}) };
  let entries = new Map();
  let at = 0;
  let platforms = null; // { at, map: Map(id → platforms) }
  let refreshing = null;
  const decimals = new Map(); // `${chainId}:${address}` → number | null (LI.FI does not know it)

  let readyP = null;
  const ready = () => readyP || (readyP = !store ? Promise.resolve() : (async () => {
    try {
      const snap = await store.get('token_pages');
      if (snap && Array.isArray(snap.entries) && !entries.size) {
        entries = new Map(snap.entries.filter((e) => e && validTokenId(e.id)).map((e) => [e.id, e]));
        at = Number(snap.at) || 0;
      }
    } catch (_) { /* refresh from CoinGecko */ }
  })());

  async function cg(path, params) {
    const { data } = await get(`${cgBase}${path}`, { params, timeout: 30000, headers: cgHeaders });
    return data;
  }

  async function loadPlatforms() {
    if (platforms && now() - platforms.at < DAY) return platforms.map;
    const list = await cg('/coins/list', { include_platform: true });
    if (!Array.isArray(list) || list.length < 1000) throw new Error('coin list unavailable');
    const map = new Map();
    for (const c of list) {
      if (c && c.id && c.platforms && Object.keys(c.platforms).length) map.set(c.id, c.platforms);
    }
    platforms = { at: now(), map };
    return map;
  }

  async function refresh() {
    if (refreshing) return refreshing;
    refreshing = (async () => {
      const map = await loadPlatforms();
      const markets = (params) => cg('/coins/markets', { vs_currency: 'usd', order: 'market_cap_desc', page: 1, price_change_percentage: '24h', ...params })
        .then((d) => (Array.isArray(d) ? d : []));
      const [memes, top, pins] = await Promise.all([
        markets({ category: 'meme-token', per_page: memeLimit }),
        markets({ per_page: topLimit }),
        pinned.length ? markets({ ids: pinned.join(','), per_page: pinned.length }) : Promise.resolve([]),
      ]);
      if (!memes.length && !top.length) throw new Error('markets unavailable');
      const kinds = new Map();
      const rows = new Map();
      const add = (list, kind) => {
        for (const m of list) {
          if (!m || !m.id) continue;
          rows.set(m.id, m);
          if (!kinds.has(m.id)) kinds.set(m.id, []);
          kinds.get(m.id).push(kind);
        }
      };
      add(memes, 'meme');
      add(top, 'top');
      add(pins, 'pinned');
      const next = new Map();
      for (const [id, m] of rows) {
        const e = buildEntry(m, map.get(id), kinds.get(id));
        if (e) next.set(id, e);
      }
      /* NEW listings: brand-new coins, the searches with the least competition. */
      if (newRows) {
        try {
          for (const r of (await newRows()) || []) {
            const id = String(r?.id || '');
            if (!validTokenId(id) || next.has(id) || !r.address || !r.chainId) continue;
            const plats = map.get(id) || { [r.platform || '']: r.address };
            const e = buildEntry({ id, symbol: r.sym, name: r.name, image: r.logo, current_price: r.price, price_change_percentage_24h: r.chg }, plats, ['new']);
            if (e) next.set(id, e);
            else if (CHAIN_NAMES[r.chain]) {
              next.set(id, { id, sym: String(r.sym || '').toUpperCase(), name: String(r.name || r.sym || id), logo: String(r.logo || ''),
                price: r.price ?? null, chg: r.chg ?? null, mcap: null, rank: null, vol: null,
                chains: [{ chain: r.chain, chainId: Number(r.chainId), address: String(r.address) }], kinds: ['new'] });
            }
          }
        } catch (_) { /* NEW is optional */ }
      }
      entries = next;
      at = now();
      if (store) Promise.resolve().then(() => store.set('token_pages', { at, entries: [...next.values()] })).catch(() => {});
      return entries;
    })().finally(() => { refreshing = null; });
    return refreshing;
  }

  async function ensure() {
    await ready();
    if (!entries.size) {
      try { await refresh(); } catch (_) { /* empty until CoinGecko answers */ }
    } else if (now() - at > ttl) {
      refresh().catch(() => {});
    }
  }

  async function lookupDecimals(chainId, address) {
    const key = `${chainId}:${address}`;
    if (decimals.has(key)) return decimals.get(key);
    let dec = null;
    let known = true;
    try {
      const headers = { Accept: 'application/json', ...(lifiKey ? { 'x-lifi-api-key': lifiKey } : {}) };
      const { data } = await get(`${LIFI}/token`, { params: { chain: chainId, token: address }, timeout: 10000, headers });
      const d = Number(data?.decimals);
      dec = Number.isInteger(d) && d >= 0 && d <= 36 ? d : null;
    } catch (e) {
      const st = Number(e?.response?.status);
      if (!(st === 400 || st === 404)) known = false; // network trouble: ask again next time
    }
    if (known) decimals.set(key, dec);
    return dec;
  }

  return {
    ready,
    refresh,
    async get(id) {
      if (!validTokenId(id)) return null;
      await ensure();
      return entries.get(id) || null;
    },
    async list() {
      await ensure();
      return [...entries.values()];
    },
    /** For the browser swap: the coin's main network with LI.FI decimals (null → no preselect); title in the page's language. */
    async swapInfo(id, locale = 'en') {
      const e = await this.get(id);
      if (!e) return null;
      const main = e.chains[0];
      const dec = await lookupDecimals(main.chainId, main.address);
      const { title, description } = tokenPageMeta(e, locale);
      return {
        id: e.id, sym: e.sym, name: e.name, logo: e.logo, price: e.price, chg: e.chg, title, description,
        chainId: main.chainId, chain: main.chain, address: main.address, decimals: dec,
        chains: e.chains,
      };
    },
  };
}

/* ───────────── HTML for crawlers ───────────── */

const decSep = (num) => (1.5).toLocaleString(num).charAt(1) || '.';
const fmtUsd = (v, num = 'en-US') => {
  if (v == null) return null;
  if (v >= 1) return v.toLocaleString(num, { maximumFractionDigits: 2 });
  if (v === 0) return '0';
  const digits = Math.min(12, Math.max(2, 2 - Math.floor(Math.log10(v)) + 2));
  return v.toFixed(digits).replace(/0+$/, '').replace(/\.$/, '').replace('.', decSep(num));
};
const fmtBig = (v, num = 'en-US') => (v == null ? null : v.toLocaleString(num, { maximumFractionDigits: 0 }));
const fmtPct = (v, num = 'en-US') => Math.abs(v).toFixed(2).replace('.', decSep(num));

const locOf = (code) => tokenLocale(code) || TOKEN_LOCALES[0];
const copyOf = (code) => TOKEN_COPY[locOf(code).code] || TOKEN_COPY.en;
const pageUrl = (id, code) => `${SITE}${tokenPath(id, locOf(code).code)}`;

/** Other coins of the same kind, by market cap — internal links between coin pages. */
export function relatedTokens(entry, all, n = 8) {
  const meme = entry.kinds.includes('meme');
  return all
    .filter((x) => x.id !== entry.id && (meme ? x.kinds.includes('meme') : !x.kinds.includes('meme') || x.kinds.includes('top')))
    .sort((a, b) => (a.rank ?? 1e9) - (b.rank ?? 1e9))
    .slice(0, n);
}

function params(e, code, { updatedAt = Date.now() } = {}) {
  const loc = locOf(code);
  const chains = [...new Set(e.chains.map((c) => CHAIN_NAMES[c.chain] || c.chain))];
  return {
    sym: e.sym,
    name: e.name,
    nm: e.name.toUpperCase() === e.sym ? e.sym : `${e.name} (${e.sym})`,
    chains,
    main: CHAIN_NAMES[e.chains[0].chain] || e.chains[0].chain,
    addr: e.chains[0].address,
    price: fmtUsd(e.price, loc.num),
    pct: e.chg != null ? fmtPct(e.chg, loc.num) : null,
    up: e.chg != null && e.chg >= 0,
    time: new Date(updatedAt).toISOString().slice(11, 16),
    rank: e.rank || null,
    vol: e.vol ? fmtBig(e.vol, loc.num) : null,
  };
}

export function tokenPageMeta(e, code = 'en') {
  const c = copyOf(code);
  const p = params(e, code);
  return { title: c.title(p), description: c.desc(p, c.where(p.chains)), chains: p.chains };
}

function faqFor(e, code) {
  return copyOf(code).faq(params(e, code));
}

export function tokenArticleHtml(e, related, { updatedAt = Date.now(), locale = 'en' } = {}) {
  const loc = locOf(locale);
  const c = copyOf(loc.code);
  const p = params(e, loc.code, { updatedAt });
  const meme = e.kinds.includes('meme') || e.kinds.includes('new');
  const rel = related.length
    ? `<h2>${esc(c.moreH2)}</h2>\n<nav class="grom-seo-nav" aria-label="${esc(c.moreH2)}">${related.map((r) => `<a href="${esc(tokenPath(r.id, loc.code))}">${esc(r.sym)}</a>`).join('\n')}</nav>`
    : '';
  const navPaths = ['/', '/swap', '/futures', '/predict', '/stocks', '/markets'];
  const nav = navPaths.map((path, i) => `<a href="${esc(loc.prefix ? (path === '/' ? `${loc.prefix}/` : loc.prefix + path) : path)}">${esc(loc.nav[i])}</a>`).join(' ');
  return `
<section id="gromSeoRouteCopy" class="grom-seo-route" data-seo-route="token" lang="${esc(loc.htmlLang)}">
  <details class="grom-seo-details">
    <summary class="grom-seo-summary">${esc(loc.about)} · ${esc(e.name)} (${esc(e.sym)})</summary>
    <article class="grom-seo-article">
      <h1>${esc(c.h1(p))}</h1>
      <p class="grom-seo-lead">${esc(c.lead(p))}</p>
      <h2>${esc(c.priceH2(p))}</h2>
      <p>${esc(p.price ? c.price(p) : c.priceNone(p))}</p>
      <h2>${esc(c.netH2)}</h2>
      <ul>${e.chains.map((x) => `<li>${esc(CHAIN_NAMES[x.chain] || x.chain)}: <code>${esc(x.address)}</code></li>`).join('')}</ul>
      <p>${esc(c.check)}</p>
      <h2>${esc(c.howH2(p))}</h2>
      <ol>
        ${c.steps(p).map((t) => `<li>${esc(t)}</li>`).join('\n        ')}
      </ol>
      <h2>${esc(c.riskH2)}</h2>
      <p>${esc(meme ? c.riskMeme : c.riskOther)}</p>
      ${rel}
      <h2>${esc(loc.explore)}</h2>
      <nav class="grom-seo-nav" aria-label="Product links">${nav}</nav>
      <h2>${esc(c.faqH2)}</h2>
      <div class="grom-seo-faq">${faqFor(e, loc.code).map((x) => `<details class="grom-seo-faq-item"><summary>${esc(x.q)}</summary><p>${esc(x.a)}</p></details>`).join('\n')}</div>
    </article>
  </details>
</section>`.trim();
}

export function tokenJsonLd(e, code = 'en') {
  const loc = locOf(code);
  const { title, description } = tokenPageMeta(e, loc.code);
  const url = pageUrl(e.id, loc.code);
  const home = loc.prefix ? `${SITE}${loc.prefix}/` : `${SITE}/`;
  const page = {
    '@context': 'https://schema.org', '@type': 'WebPage', name: title, url, description, inLanguage: loc.htmlLang,
    about: { '@type': 'Thing', name: e.name, alternateName: e.sym },
    publisher: { '@type': 'Organization', name: 'GROM Exchange', url: `${SITE}/` },
  };
  const crumbs = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'GROM', item: home },
      { '@type': 'ListItem', position: 2, name: 'Swap', item: `${SITE}${loc.prefix}/swap` },
      { '@type': 'ListItem', position: 3, name: e.sym, item: url },
    ],
  };
  const faq = {
    '@context': 'https://schema.org', '@type': 'FAQPage', inLanguage: loc.htmlLang,
    mainEntity: faqFor(e, loc.code).map((x) => ({ '@type': 'Question', name: x.q, acceptedAnswer: { '@type': 'Answer', text: x.a } })),
  };
  const json = (o) => JSON.stringify(o).replace(/</g, '\\u003c');
  return [page, crumbs, faq].map((o) => `<script type="application/ld+json">${json(o)}</script>`).join('\n');
}

/** Mutual hreflang set for one coin (all languages + x-default → English). */
export function tokenHreflang(id) {
  const links = TOKEN_LOCALES.map((l) => `<link rel="alternate" hreflang="${l.hreflang}" href="${esc(pageUrl(id, l.code))}" />`);
  links.push(`<link rel="alternate" hreflang="x-default" href="${esc(pageUrl(id, 'en'))}" />`);
  return links.join('\n');
}

/** Fill the build's token template for one language (placeholders from scripts/build-frontend.mjs). */
export function renderTokenPage(template, e, related, opts = {}) {
  const code = locOf(opts.locale).code;
  const { title, description } = tokenPageMeta(e, code);
  return String(template)
    .split('__GROM_TOKEN_TITLE__').join(esc(title))
    .split('__GROM_TOKEN_DESC__').join(esc(description))
    .split('__GROM_TOKEN_ID__').join(esc(e.id))
    .replace('<!--GROM_TOKEN_HREFLANG-->', () => tokenHreflang(e.id))
    .replace('<!--GROM_TOKEN_ARTICLE-->', () => tokenArticleHtml(e, related, { ...opts, locale: code }))
    .replace('<!--GROM_TOKEN_JSONLD-->', () => tokenJsonLd(e, code));
}

/** 404 for an unknown coin, in the page's language. */
export function tokenNotFoundHtml(code = 'en') {
  const loc = locOf(code);
  const c = copyOf(loc.code);
  return `<!doctype html><html lang="${esc(loc.htmlLang)}"><head><meta charset="utf-8"><title>${esc(c.notFound.replace(/\.$/, ''))} — GROM</title><meta name="robots" content="noindex"></head><body><p>${esc(c.notFound)} <a href="${esc(loc.prefix)}/swap">${esc(c.openSwap)}</a></p></body></html>`;
}

/** Every coin in every language, each with its full hreflang set. */
export function tokenSitemapXml(list, { lastmod = new Date().toISOString().slice(0, 10) } = {}) {
  const urls = [];
  for (const e of list) {
    if (!validTokenId(e.id)) continue;
    const alts = TOKEN_LOCALES.map((l) => `    <xhtml:link rel="alternate" hreflang="${l.hreflang}" href="${pageUrl(e.id, l.code)}" />`)
      .concat(`    <xhtml:link rel="alternate" hreflang="x-default" href="${pageUrl(e.id, 'en')}" />`)
      .join('\n');
    for (const l of TOKEN_LOCALES) {
      urls.push(`  <url>\n    <loc>${pageUrl(e.id, l.code)}</loc>\n    <lastmod>${lastmod}</lastmod>\n${alts}\n  </url>`);
    }
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n        xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join('\n')}\n</urlset>\n`;
}

/* ───────────── production singletons ───────────── */

const kv = { mod: null };
const appStateStore = {
  get: async (k) => { if (!kv.mod) kv.mod = (await import('../db/app-state.js')).appState(); return kv.mod.get(k); },
  set: async (k, v) => { if (!kv.mod) kv.mod = (await import('../db/app-state.js')).appState(); return kv.mod.set(k, v); },
};

let service = null;
export function tokenPagesService() {
  if (!service) {
    service = createTokenPages({
      store: appStateStore,
      newRows: async () => {
        const { newListingsService } = await import('./new-listings.js');
        const p = await newListingsService().get();
        return Array.isArray(p?.rows) ? p.rows : [];
      },
    });
  }
  return service;
}

/* Templates from the frontend container (built with the same deploy), one per language:
   token-template.html (English) and token-template-<code>.html. Cached a minute, last good copy kept. */
const tpls = new Map(); // code → { html, at, pending }
export function tokenTemplateUrl(code = 'en', base = process.env.GROM_TOKEN_TEMPLATE_URL || 'http://frontend/token-template.html') {
  const c = locOf(code).code;
  return c === 'en' ? base : base.replace(/\.html$/, `-${c}.html`);
}
export async function tokenTemplate({ get = axios.get, now = Date.now, locale = 'en', url } = {}) {
  const code = locOf(locale).code;
  const src = url || tokenTemplateUrl(code);
  const tpl = tpls.get(code) || { html: '', at: 0, pending: null };
  tpls.set(code, tpl);
  if (tpl.html && now() - tpl.at < 60_000) return tpl.html;
  if (!tpl.pending) {
    tpl.pending = get(src, { timeout: 5000, responseType: 'text', transformResponse: (x) => x })
      .then(({ data }) => {
        const html = String(data || '');
        if (html.includes('<!--GROM_TOKEN_ARTICLE-->') && html.includes('__GROM_TOKEN_TITLE__')) { tpl.html = html; tpl.at = now(); }
      })
      .catch(() => {})
      .finally(() => { tpl.pending = null; });
  }
  await tpl.pending;
  return tpl.html || null;
}
