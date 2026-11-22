/**
 * Coin pages /token/<coingecko-id> (owner, 22.11: GROM should show up in Google next to searches for
 * meme tokens and popular platforms).
 *
 * Browsers get the full app (frontend nginx → app.html) and the swap opens with the coin selected
 * (`GET /api/market/token-page`). Crawlers get a per-coin HTML page rendered here from the build's
 * `token-template.html` (the slim /swap page): own title, description, canonical, a collapsed
 * «About» block in the same style as the other routes, and JSON-LD. `/sitemap-tokens.xml` lists them.
 *
 * Coins: CoinGecko top meme tokens + top coins by market cap + a pinned list (the landing links to
 * those) + NEW listings — only coins with a contract on a GROM swap network (NL_PLATFORMS).
 * Brand policy: no Hyperliquid / Polymarket / Kalshi / Backed / xStocks in the copy.
 */
import axios from 'axios';
import { swapPlatforms } from './new-listings.js';

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
    /** For the browser swap: the coin's main network with LI.FI decimals (null → no preselect). */
    async swapInfo(id) {
      const e = await this.get(id);
      if (!e) return null;
      const main = e.chains[0];
      const dec = await lookupDecimals(main.chainId, main.address);
      const { title, description } = tokenPageMeta(e);
      return {
        id: e.id, sym: e.sym, name: e.name, logo: e.logo, price: e.price, chg: e.chg, title, description,
        chainId: main.chainId, chain: main.chain, address: main.address, decimals: dec,
        chains: e.chains,
      };
    },
  };
}

/* ───────────── HTML for crawlers ───────────── */

const fmtUsd = (v) => {
  if (v == null) return null;
  if (v >= 1) return v.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (v === 0) return '0';
  const digits = Math.min(12, Math.max(2, 2 - Math.floor(Math.log10(v)) + 2));
  return v.toFixed(digits).replace(/0+$/, '').replace(/\.$/, '');
};
const fmtBig = (v) => (v == null ? null : v.toLocaleString('en-US', { maximumFractionDigits: 0 }));

/** Other coins of the same kind, by market cap — internal links between coin pages. */
export function relatedTokens(entry, all, n = 8) {
  const meme = entry.kinds.includes('meme');
  return all
    .filter((x) => x.id !== entry.id && (meme ? x.kinds.includes('meme') : !x.kinds.includes('meme') || x.kinds.includes('top')))
    .sort((a, b) => (a.rank ?? 1e9) - (b.rank ?? 1e9))
    .slice(0, n);
}

export function tokenPageMeta(e) {
  const chains = [...new Set(e.chains.map((c) => CHAIN_NAMES[c.chain] || c.chain))];
  const where = chains.slice(0, 3).join(', ') + (chains.length > 3 ? ' and more' : '');
  const nm = e.name.toUpperCase() === e.sym ? e.sym : `${e.name} (${e.sym})`;
  return {
    title: `Buy ${e.sym} — ${e.name} Price & Cross-Chain Swap | GROM`,
    description: `Swap or buy ${nm} on ${where} from your own wallet. Live ${e.sym} price, 24h change and contract addresses. No sign-up, no deposit.`,
    chains,
  };
}

function faqFor(e, chains) {
  const main = CHAIN_NAMES[e.chains[0].chain] || e.chains[0].chain;
  return [
    { q: `How do I buy ${e.sym} without KYC?`, a: `Connect a self-custody wallet on GROM, choose the token you pay with and confirm the swap to ${e.sym} in your wallet. GROM has no account and no deposit; third-party services and some regions may apply their own checks.` },
    { q: `Which networks is ${e.sym} on?`, a: `GROM can swap ${e.sym} on ${chains.join(', ')}. Pay with tokens on the same network or on another one — the route bridges for you.` },
    { q: `What is the ${e.sym} contract address on ${main}?`, a: `${e.chains[0].address}. Always check the address before you swap: tokens with the same ticker exist on many networks.` },
  ];
}

export function tokenArticleHtml(e, related, { updatedAt = Date.now() } = {}) {
  const { chains } = tokenPageMeta(e);
  const main = CHAIN_NAMES[e.chains[0].chain] || e.chains[0].chain;
  const price = fmtUsd(e.price);
  const time = new Date(updatedAt).toISOString().slice(11, 16);
  const priceLine = price
    ? `${esc(e.name)} (${esc(e.sym)}) trades at $${esc(price)}${e.chg != null ? `, ${e.chg >= 0 ? 'up' : 'down'} ${esc(Math.abs(e.chg).toFixed(2))}% over the last 24 hours` : ''} (CoinGecko data, ${esc(time)} UTC).`
      + (e.rank ? ` Market cap rank #${esc(e.rank)}.` : '') + (e.vol ? ` 24h trading volume: $${esc(fmtBig(e.vol))}.` : '')
    : `${esc(e.name)} (${esc(e.sym)}) price and 24h change load live in the swap.`;
  const meme = e.kinds.includes('meme') || e.kinds.includes('new');
  const risk = meme
    ? 'Meme coins are highly volatile and can lose most of their value quickly. Quotes depend on available liquidity and can change before you sign. This page is information, not investment advice.'
    : 'Crypto prices are volatile. Quotes depend on available liquidity and can change before you sign. This page is information, not investment advice.';
  const rel = related.length
    ? `<h2>More tokens</h2>\n<nav class="grom-seo-nav" aria-label="More tokens">${related.map((r) => `<a href="/token/${esc(r.id)}">${esc(r.sym)}</a>`).join('\n')}</nav>`
    : '';
  const faq = faqFor(e, chains);
  return `
<section id="gromSeoRouteCopy" class="grom-seo-route" data-seo-route="token" lang="en">
  <details class="grom-seo-details">
    <summary class="grom-seo-summary">About · ${esc(e.name)} (${esc(e.sym)})</summary>
    <article class="grom-seo-article">
      <h1>${esc(e.name)} (${esc(e.sym)}) price and swap</h1>
      <p class="grom-seo-lead">Live ${esc(e.sym)} price, networks and contract addresses. Buy or swap ${esc(e.sym)} on ${esc(chains.join(', '))} straight from your self-custody wallet with GROM — no sign-up and no deposit.</p>
      <h2>${esc(e.sym)} price today</h2>
      <p>${priceLine}</p>
      <h2>Networks and contract addresses</h2>
      <ul>${e.chains.map((c) => `<li>${esc(CHAIN_NAMES[c.chain] || c.chain)}: <code>${esc(c.address)}</code></li>`).join('')}</ul>
      <p>Always check the contract address before you swap — tokens with the same ticker exist on many networks.</p>
      <h2>How to buy ${esc(e.sym)} on GROM</h2>
      <ol>
        <li>Connect a self-custody wallet (browser extension or WalletConnect).</li>
        <li>Open the swap with ${esc(e.sym)} selected and choose the token you pay with — on any supported network.</li>
        <li>Review the route, fees and the amount you receive.</li>
        <li>Confirm the transaction in your wallet. ${esc(e.sym)} arrives at your address on ${esc(main)}.</li>
      </ol>
      <h2>Risks</h2>
      <p>${esc(risk)}</p>
      ${rel}
      <h2>Explore GROM</h2>
      <nav class="grom-seo-nav" aria-label="Product links"><a href="/">Home</a> <a href="/swap">Swap</a> <a href="/futures">Trade</a> <a href="/predict">Predictions</a> <a href="/stocks">Stocks</a> <a href="/markets">Markets</a></nav>
      <h2>FAQ</h2>
      <div class="grom-seo-faq">${faq.map((x) => `<details class="grom-seo-faq-item"><summary>${esc(x.q)}</summary><p>${esc(x.a)}</p></details>`).join('\n')}</div>
    </article>
  </details>
</section>`.trim();
}

export function tokenJsonLd(e) {
  const { title, description, chains } = tokenPageMeta(e);
  const url = `${SITE}/token/${e.id}`;
  const page = {
    '@context': 'https://schema.org', '@type': 'WebPage', name: title, url, description, inLanguage: 'en',
    about: { '@type': 'Thing', name: e.name, alternateName: e.sym },
    publisher: { '@type': 'Organization', name: 'GROM Exchange', url: `${SITE}/` },
  };
  const crumbs = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'GROM', item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: 'Swap', item: `${SITE}/swap` },
      { '@type': 'ListItem', position: 3, name: e.sym, item: url },
    ],
  };
  const faq = {
    '@context': 'https://schema.org', '@type': 'FAQPage', inLanguage: 'en',
    mainEntity: faqFor(e, chains).map((x) => ({ '@type': 'Question', name: x.q, acceptedAnswer: { '@type': 'Answer', text: x.a } })),
  };
  const json = (o) => JSON.stringify(o).replace(/</g, '\\u003c');
  return [page, crumbs, faq].map((o) => `<script type="application/ld+json">${json(o)}</script>`).join('\n');
}

/** Fill the build's token-template.html (placeholders from scripts/build-frontend.mjs). */
export function renderTokenPage(template, e, related, opts = {}) {
  const { title, description } = tokenPageMeta(e);
  return String(template)
    .split('__GROM_TOKEN_TITLE__').join(esc(title))
    .split('__GROM_TOKEN_DESC__').join(esc(description))
    .split('__GROM_TOKEN_ID__').join(esc(e.id))
    .replace('<!--GROM_TOKEN_ARTICLE-->', () => tokenArticleHtml(e, related, opts))
    .replace('<!--GROM_TOKEN_JSONLD-->', () => tokenJsonLd(e));
}

export function tokenSitemapXml(list, { lastmod = new Date().toISOString().slice(0, 10) } = {}) {
  const urls = list
    .filter((e) => validTokenId(e.id))
    .map((e) => `  <url>\n    <loc>${SITE}/token/${e.id}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
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

/* Template from the frontend container (built with the same deploy); cached a minute, last good copy kept. */
const tpl = { html: '', at: 0, pending: null };
export async function tokenTemplate({ get = axios.get, now = Date.now, url = process.env.GROM_TOKEN_TEMPLATE_URL || 'http://frontend/token-template.html' } = {}) {
  if (tpl.html && now() - tpl.at < 60_000) return tpl.html;
  if (!tpl.pending) {
    tpl.pending = get(url, { timeout: 5000, responseType: 'text', transformResponse: (x) => x })
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
