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

function finiteNumber(value) {
  if (value == null || value === '') return null;
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

function moverScore(r) {
  const chg = Math.abs(Number(r.change24h) || 0);
  const vol = Math.max(0, Number(r.volumeUsd) || 0);
  return chg * Math.sqrt(vol + 1);
}

export function parseGtNetwork(gtNet, json, chainId, chainLabel) {
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
      priceUsd: Number(p.attributes?.base_token_price_usd) > 0 ? finiteNumber(p.attributes.base_token_price_usd) : null,
      change24h: finiteNumber(p.attributes?.price_change_percentage?.h24),
      poolAddress: p.attributes?.address || '',
      poolCreatedAt: p.attributes?.pool_created_at || null,
      volumeUsd: Number(p.attributes?.volume_usd?.h24) || 0,
      img: attrs.image_url || '',
      tokenAddress: attrs.address || '',
      decimals: attrs.decimals != null ? Number(attrs.decimals) : null,
    });
  }
  rows.sort((a, b) => moverScore(b) - moverScore(a));
  return rows.slice(0, 20);
}

// Keep timestamps from the actual provider fetch; cache reads must not renew them.
export function createTrendingService({ get = axios.get, now = Date.now,
  pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms)), nets = TRENDING_NETS } = {}) {
  const cache = new Map();
  const inflight = new Map();
  const usable = (hit) => hit && now() - hit.at < STALE_TTL;

  function refresh(net) {
    if (inflight.has(net.key)) return inflight.get(net.key);
    const hit = cache.get(net.key);
    if (hit && now() - hit.at < TTL) return Promise.resolve(hit);
    const request = (async () => {
      try {
        let entry;
        if (net.key === 'all') {
          const entries = [];
          let partial = false;
          for (const child of nets.filter((n) => n.gt)) {
            if (entries.length) await pause(FETCH_GAP_MS);
            try { entries.push(await refresh(child)); } catch (_) { partial = true; }
          }
          const rows = entries.flatMap((e) => e.rows)
            .filter((r) => now() - r.observedAt < STALE_TTL)
            .sort((a, b) => moverScore(b) - moverScore(a)).slice(0, 20);
          if (!rows.length) throw new Error('Trending data unavailable');
          entry = { at: Math.min(...rows.map((r) => r.observedAt)), rows, partial };
        } else {
          const url = `${GT}/networks/${encodeURIComponent(net.gt)}/trending_pools?page=1&include=base_token`;
          const { data } = await get(url, { timeout: 12000, headers: UA });
          const at = now();
          const rows = parseGtNetwork(net.gt, data, net.chainId, net.label)
            .map((row) => ({ ...row, observedAt: at }));
          if (!rows.length) throw new Error('Trending data unavailable');
          entry = { at, rows };
        }
        cache.set(net.key, entry);
        return entry;
      } catch (error) {
        if (usable(hit)) return hit;
        throw error;
      }
    })().finally(() => inflight.delete(net.key));
    inflight.set(net.key, request);
    return request;
  }

  return async function getTrending(netKey) {
    const net = nets.find((n) => n.key === String(netKey || 'all').toLowerCase()) || nets[0];
    const before = cache.get(net.key);
    const entry = await refresh(net);
    const rows = entry.rows.filter((r) => now() - r.observedAt < STALE_TTL);
    if (!rows.length) throw new Error('Trending data expired');
    return { net: net.key, rows, cached: entry === before, updatedAt: entry.at,
      stale: now() - entry.at >= TTL, partial: !!entry.partial, source: 'GeckoTerminal' };
  };
}

export const getTrending = createTrendingService();
