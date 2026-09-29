/**
 * GeckoTerminal trending pools — server proxy with cache + rate-limit guard.
 * Browser must not hammer api.geckoterminal.com (429 on parallel bursts).
 */
import axios from 'axios';

const GT = 'https://api.geckoterminal.com/api/v2';
const UA = { Accept: 'application/json', 'User-Agent': 'grom-exchange/1.0' };

export const TRENDING_NETS = [
  { key: 'all', gt: null, label: 'ALL', chainId: 0 },
  { key: 'eth', gt: 'eth', label: 'ETH', chainId: 1 },
  { key: 'bsc', gt: 'bsc', label: 'BSC', chainId: 56 },
  { key: 'arbitrum', gt: 'arbitrum', label: 'ARB', chainId: 42161 },
  { key: 'base', gt: 'base', label: 'BASE', chainId: 8453 },
  { key: 'polygon', gt: 'polygon_pos', label: 'POL', chainId: 137 },
  { key: 'optimism', gt: 'optimism', label: 'OP', chainId: 10 },
  { key: 'avax', gt: 'avax', label: 'AVAX', chainId: 43114 },
  { key: 'linea', gt: 'linea', label: 'LINEA', chainId: 59144 },
];

const TTL = 90_000;
const STALE_TTL = 10 * 60_000;
const FETCH_GAP_MS = 420;

/** @type {Map<string, { at: number, rows: object[], refreshing?: boolean }>} */
const cache = new Map();

function moverScore(r) {
  const chg = Math.abs(Number(r.change24h) || 0);
  const vol = Math.max(0, Number(r.volumeUsd) || 0);
  return chg * Math.sqrt(vol + 1);
}

function parseGtNetwork(gtNet, json, chainId, chainLabel) {
  const included = json?.included || [];
  const byId = new Map(included.map((x) => [x.id, x]));
  const rows = [];
  const seen = new Set();
  for (const p of (json?.data || [])) {
    const bid = p.relationships?.base_token?.data?.id;
    const tok = bid ? byId.get(bid) : null;
    const attrs = tok?.attributes || {};
    let sym = String(attrs.symbol || '').toUpperCase();
    if (!sym) {
      const nm = String(p.attributes?.name || '');
      sym = (nm.split('/')[0] || '').trim().toUpperCase() || '?';
    }
    const addr = String(attrs.address || '').toLowerCase();
    const key = (addr || sym) + ':' + chainId;
    if (seen.has(key)) continue;
    seen.add(key);
    if (['WETH', 'WBNB', 'WAVAX', 'WMATIC', 'WPOL'].includes(sym) && rows.length > 3) continue;
    rows.push({
      sym,
      name: attrs.name || sym,
      chain: gtNet,
      chainId,
      chainLabel,
      priceUsd: Number(p.attributes?.base_token_price_usd) || 0,
      change24h: Number(p.attributes?.price_change_percentage?.h24) || 0,
      volumeUsd: Number(p.attributes?.volume_usd?.h24) || 0,
      img: attrs.image_url || '',
      tokenAddress: attrs.address || '',
      decimals: attrs.decimals != null ? Number(attrs.decimals) : null,
    });
  }
  rows.sort((a, b) => moverScore(b) - moverScore(a));
  return rows.slice(0, 20);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchGtNetwork(net) {
  const url = `${GT}/networks/${encodeURIComponent(net.gt)}/trending_pools?page=1&include=base_token`;
  const { data } = await axios.get(url, { timeout: 12000, headers: UA });
  return parseGtNetwork(net.gt, data, net.chainId, net.label);
}

async function refreshNetwork(net) {
  const key = net.key;
  const hit = cache.get(key);
  if (hit?.refreshing) {
    while (hit.refreshing) await sleep(80);
    return cache.get(key)?.rows || hit.rows || [];
  }
  if (hit && Date.now() - hit.at < TTL) return hit.rows;

  const stale = hit?.rows?.length ? hit.rows : null;
  if (hit) hit.refreshing = true;
  else cache.set(key, { at: 0, rows: stale || [], refreshing: true });

  try {
    const rows = await fetchGtNetwork(net);
    cache.set(key, { at: Date.now(), rows, refreshing: false });
    return rows;
  } catch (e) {
    if (stale) {
      cache.set(key, { at: hit?.at || 0, rows: stale, refreshing: false });
      return stale;
    }
    cache.set(key, { at: hit?.at || 0, rows: [], refreshing: false });
    throw e;
  }
}

async function refreshAll() {
  const key = 'all';
  const hit = cache.get(key);
  if (hit?.refreshing) {
    while (hit.refreshing) await sleep(80);
    return cache.get(key)?.rows || hit.rows || [];
  }
  if (hit && Date.now() - hit.at < TTL) return hit.rows;

  const stale = hit?.rows?.length ? hit.rows : null;
  if (hit) hit.refreshing = true;
  else cache.set(key, { at: 0, rows: stale || [], refreshing: true });

  try {
    const nets = TRENDING_NETS.filter((n) => n.gt);
    const merged = [];
    const seen = new Set();
    for (let i = 0; i < nets.length; i++) {
      if (i > 0) await sleep(FETCH_GAP_MS);
      let rows = [];
      try {
        rows = await refreshNetwork(nets[i]);
      } catch (_) {
        rows = cache.get(nets[i].key)?.rows || [];
      }
      for (const r of rows) {
        const k = (r.tokenAddress || r.sym).toLowerCase() + ':' + r.chainId;
        if (seen.has(k)) continue;
        seen.add(k);
        merged.push(r);
      }
    }
    merged.sort((a, b) => moverScore(b) - moverScore(a));
    const out = merged.slice(0, 20);
    cache.set(key, { at: Date.now(), rows: out, refreshing: false });
    return out;
  } catch (e) {
    if (stale) {
      cache.set(key, { at: hit?.at || 0, rows: stale, refreshing: false });
      return stale;
    }
    cache.set(key, { at: hit?.at || 0, rows: [], refreshing: false });
    throw e;
  }
}

export async function getTrending(netKey) {
  const key = String(netKey || 'all').toLowerCase();
  const net = TRENDING_NETS.find((n) => n.key === key) || TRENDING_NETS[0];
  const hit = cache.get(net.key);
  const fresh = hit && Date.now() - hit.at < TTL;
  const staleOk = hit && Date.now() - hit.at < STALE_TTL;

  if (fresh && hit.rows?.length) {
    return { net: net.key, rows: hit.rows, cached: true };
  }

  if (net.key === 'all') {
    const rows = await refreshAll();
    return { net: net.key, rows, cached: false, stale: !!(hit && !fresh && staleOk) };
  }

  const rows = await refreshNetwork(net);
  return { net: net.key, rows, cached: false, stale: !!(hit && !fresh && staleOk) };
}
