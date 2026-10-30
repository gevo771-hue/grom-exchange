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
const FETCH_GAP_MS = 2100;

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

// Keep provider timestamps: serving cached rows must never make quotes look newer.
export function createTrendingService({ get = axios.get, now = Date.now,
  pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms)), nets = TRENDING_NETS } = {}) {
  const cache = new Map();
  const inflight = new Map();
  const failures = new Map();
  const networks = nets.filter((net) => net.gt);
  const usable = (hit) => hit?.rows?.length && now() - hit.at < STALE_TTL;
  const queue = [];
  let draining = false;
  let lastStart = null;
  let providerRetryAt = 0;
  async function drain() {
    if (draining) return;
    draining = true;
    try {
      while (queue.length) {
        if (lastStart != null) await pause(Math.max(0, lastStart + FETCH_GAP_MS - now()));
        lastStart = now();
        queue.shift().start();
      }
    } finally { draining = false; }
  }

  function refresh(net, priority = false) {
    if (inflight.has(net.key)) {
      // A clicked network takes the next slot ahead of background "All" warming.
      const i = priority ? queue.findIndex((job) => job.key === net.key) : -1;
      if (i > 0) queue.unshift(queue.splice(i, 1)[0]);
      return inflight.get(net.key);
    }
    const hit = cache.get(net.key);
    if (usable(hit) && now() - hit.at < TTL) return Promise.resolve(hit);
    const failure = failures.get(net.key);
    if (failure && now() < failure.retryAt) {
      return usable(hit) ? Promise.resolve(hit) : Promise.reject(failure.error);
    }
    // At most one provider request starts every 2.1s, including concurrent users.
    // Do not hold the queue while awaiting the provider's response.
    const turn = new Promise((start) => {
      const job = { key: net.key, start };
      if (priority) queue.unshift(job); else queue.push(job);
    });
    void drain();
    const request = turn.then(async () => {
      try {
        if (now() < providerRetryAt) throw new Error('Trending provider cooling down');
        const url = `${GT}/networks/${encodeURIComponent(net.gt)}/trending_pools?page=1&include=base_token`;
        const { data } = await get(url, { timeout: 6000, headers: UA });
        const at = now();
        const rows = parseGtNetwork(net.gt, data, net.chainId, net.label)
          .map((row) => ({ ...row, observedAt: at }));
        if (!rows.length) throw new Error('Trending data unavailable');
        const entry = { at, rows };
        cache.set(net.key, entry);
        failures.delete(net.key);
        return entry;
      } catch (error) {
        const retryHeader = error.response?.headers?.['retry-after'];
        const seconds = Number(retryHeader);
        const retryDelay = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(retryHeader) - now();
        const retryAt = Math.max(providerRetryAt, now() + Math.max(60_000, retryDelay || 0));
        if (error.response?.status === 429) providerRetryAt = retryAt;
        failures.set(net.key, { error, retryAt });
        if (usable(hit)) return hit;
        throw error;
      }
    }).finally(() => inflight.delete(net.key));
    inflight.set(net.key, request);
    return request;
  }

  function snapshot(selected, cached) {
    const entries = selected.map((net) => cache.get(net.key)).filter(usable);
    const rows = entries.flatMap((entry) => entry.rows)
      .filter((row) => now() - row.observedAt < STALE_TTL)
      .sort((a, b) => moverScore(b) - moverScore(a)).slice(0, 20);
    if (!rows.length) throw new Error('Trending data unavailable');
    const updatedAt = Math.min(...rows.map((row) => row.observedAt));
    return { rows, cached, updatedAt, stale: now() - updatedAt >= TTL,
      partial: entries.length < selected.length,
      refreshing: selected.some((net) => inflight.has(net.key)), source: 'GeckoTerminal' };
  }

  return async function getTrending(netKey) {
    const net = nets.find((n) => n.key === String(netKey || 'all').toLowerCase()) || nets[0];
    const selected = net.key === 'all' ? networks : [net];
    const hasRows = selected.some((child) => usable(cache.get(child.key)));
    const requests = selected.map((child) => refresh(child, net.key !== 'all'));
    // Attach handlers immediately, including requests that finish after the response.
    const first = Promise.any(requests);
    first.catch(() => {});
    if (!hasRows) {
      try { await first; } catch (_) { throw new Error('Trending data unavailable'); }
    }
    // Cold "All" paints the first available network; subsequent reads include all
    // completed networks. Warm responses never wait for provider revalidation.
    return { net: net.key, ...snapshot(selected, hasRows) };
  };
}

export const getTrending = createTrendingService();
