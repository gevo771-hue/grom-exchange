/**
 * Wallet token discovery list for the Instant Swap "You pay" picker.
 *
 * The browser reads balanceOf for these contracts with one Multicall3 call per
 * chain, so tokens such as ARB, LINK or tokenized stocks show up when a wallet
 * holds them. Only public LI.FI catalog data passes through here; wallet
 * addresses never reach this endpoint.
 */
import axios from 'axios';
import logger from '../utils/logger.js';

const LIFI = 'https://li.quest/v1';
const LIFI_API_KEY = String(process.env.LIFI_API_KEY || '').trim();

/** EVM chains the swap supports (keep in sync with frontend GW_OC_CHAIN_META). */
export const HOLDINGS_CHAINS = [1, 42161, 137, 8453, 56, 10, 43114, 59144, 4663, 999, 143, 5042, 9745, 196];

const TTL_MS = 6 * 3600_000;
const RETRY_AFTER_FAIL_MS = 2 * 60_000;
/** A chain with this many priced tokens or fewer is "small": keep every credible one. */
const SMALL_CHAIN_SIZE = 450;
const SMALL_CHAIN_CAP = 400;
const BIG_CHAIN_CAP = 200;
const SYMBOL_RE = /^[A-Za-z0-9.$_+-]{1,16}$/;
const ADDR_RE = /^0x[0-9a-fA-F]{40}$/;
const NATIVE_MARKERS = new Set([
  '0x0000000000000000000000000000000000000000',
  '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
]);

function sig6(n) {
  return Number(Number(n).toPrecision(6));
}

function isVerified(t) {
  if (String(t?.verificationStatus || '').toLowerCase() === 'verified') return true;
  return Array.isArray(t?.verificationStatusBreakdown)
    && t.verificationStatusBreakdown.some((x) => String(x?.result || '').toLowerCase() === 'verified');
}

/**
 * Pick the contracts worth checking on one chain.
 * Returns { tokens: [[address, decimals, symbol, priceUSD, verified]], logos: Map(addrLc → url) }.
 */
export function pickHoldingsTokens(raw) {
  const rows = [];
  const seen = new Set();
  for (const t of Array.isArray(raw) ? raw : []) {
    const address = String(t?.address || '');
    const addrLc = address.toLowerCase();
    if (!ADDR_RE.test(address) || NATIVE_MARKERS.has(addrLc) || seen.has(addrLc)) continue;
    const decimals = t?.decimals;
    if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) continue;
    const symbol = String(t?.symbol || '').trim();
    if (!SYMBOL_RE.test(symbol)) continue;
    const price = Number(t?.priceUSD);
    if (!(price > 0 && price < 1e7)) continue;
    seen.add(addrLc);
    const vol = Number(t?.volumeUSD24H) || 0;
    const mcap = Number(t?.marketCapUSD) || 0;
    rows.push({
      address, addrLc, decimals, symbol, price, vol, mcap,
      verified: isVerified(t),
      logo: /^https:\/\//i.test(String(t?.logoURI || '')) ? String(t.logoURI) : '',
    });
  }
  const small = rows.length <= SMALL_CHAIN_SIZE;
  const keep = rows.filter((r) => (small
    ? (r.verified || r.vol >= 5000 || r.mcap >= 250_000)
    : (r.vol >= 20_000 || r.mcap >= 1_000_000)));
  const score = (r) => (r.vol > 0 ? r.vol : r.mcap * 0.02);
  keep.sort((a, b) => score(b) - score(a));
  const picked = keep.slice(0, small ? SMALL_CHAIN_CAP : BIG_CHAIN_CAP);
  const logos = new Map();
  for (const r of picked) if (r.logo) logos.set(r.addrLc, r.logo);
  return {
    tokens: picked.map((r) => [r.address, r.decimals, r.symbol, sig6(r.price), r.verified ? 1 : 0]),
    logos,
  };
}

const state = { at: 0, payload: null, logos: new Map(), inflight: null, failAt: 0 };

async function defaultFetch() {
  const { data } = await axios.get(`${LIFI}/tokens`, {
    params: { chains: HOLDINGS_CHAINS.join(','), extended: true },
    timeout: 30_000,
    headers: {
      accept: 'application/json',
      ...(LIFI_API_KEY ? { 'x-lifi-api-key': LIFI_API_KEY } : {}),
    },
    maxContentLength: 64 * 1024 * 1024,
  });
  return data;
}

export function buildHoldingsPayload(data, now = Date.now()) {
  const chains = {};
  const logos = new Map();
  for (const cid of HOLDINGS_CHAINS) {
    const raw = data?.tokens?.[cid] ?? data?.tokens?.[String(cid)];
    if (!Array.isArray(raw)) continue;
    const { tokens, logos: chainLogos } = pickHoldingsTokens(raw);
    if (!tokens.length) continue;
    chains[cid] = tokens;
    for (const [addr, url] of chainLogos) logos.set(`${cid}:${addr}`, url);
  }
  if (!Object.keys(chains).length) throw new Error('empty token catalog');
  return { payload: { v: 1, at: now, chains }, logos };
}

/** Cached discovery list. Serves the last good copy while a refresh runs or fails. */
export async function getHoldingsTokens({ fetcher = defaultFetch, now = Date.now } = {}) {
  const fresh = state.payload && now() - state.at < TTL_MS;
  if (fresh) return state.payload;
  const mayRetry = now() - state.failAt > RETRY_AFTER_FAIL_MS;
  if (!state.inflight && mayRetry) {
    state.inflight = (async () => {
      try {
        const { payload, logos } = buildHoldingsPayload(await fetcher(), now());
        Object.assign(state, { at: payload.at, payload, logos });
      } catch (err) {
        state.failAt = now();
        logger.warn({ err: err.message }, 'holdings token list refresh failed');
      } finally {
        state.inflight = null;
      }
    })();
  }
  if (!state.payload && state.inflight) await state.inflight;
  if (!state.payload) {
    const err = new Error('token list unavailable');
    err.status = 503;
    throw err;
  }
  return state.payload;
}

export function holdingsTokenLogo(chainId, address) {
  const key = `${Number(chainId)}:${String(address || '').toLowerCase()}`;
  return state.logos.get(key) || null;
}

/** Test hook. */
export function resetHoldingsTokensCache() {
  Object.assign(state, { at: 0, payload: null, logos: new Map(), inflight: null, failAt: 0 });
}
