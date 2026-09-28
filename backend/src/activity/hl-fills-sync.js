/**
 * Pull Hyperliquid userFills for recent users into user_activity so admin
 * «Спот / Фьючи» show real CLOB fills (client EIP-712 often never logged).
 */
import { query } from '../db/pool.js';
import { logUserActivity } from './log.js';
import logger from '../utils/logger.js';

const HL_API = 'https://api.hyperliquid.xyz';
const SYNC_TTL_MS = 25_000;
const MAX_USERS = 48;
const MAX_FILLS = 50;
const CONCURRENCY = 6;

let _lastSyncAt = 0;
let _inflight = null;
let _spotNameByIdx = null;
let _spotNameAt = 0;

async function hlInfo(body) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12_000);
  try {
    const r = await fetch(HL_API + '/info', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!r.ok) throw new Error('HL HTTP ' + r.status);
    return r.json();
  } finally {
    clearTimeout(t);
  }
}

async function spotNameMap() {
  if (_spotNameByIdx && Date.now() - _spotNameAt < 10 * 60_000) return _spotNameByIdx;
  try {
    const meta = await hlInfo({ type: 'spotMeta' });
    const map = Object.create(null);
    const tokens = meta?.tokens || [];
    const byTokIndex = Object.create(null);
    tokens.forEach((t) => {
      if (t && t.index != null) byTokIndex[Number(t.index)] = t;
    });
    const universe = meta?.universe || [];
    universe.forEach((u, i) => {
      const idx = u?.index != null ? Number(u.index) : i;
      const tokRef = Array.isArray(u?.tokens) ? u.tokens[0] : null;
      const tok = tokRef != null
        ? (byTokIndex[Number(tokRef)] || tokens[tokRef] || null)
        : null;
      let name = String(tok?.name || '').toUpperCase();
      if (!name || name.startsWith('@')) {
        const raw = String(u?.name || '').toUpperCase();
        name = raw.includes('/') ? raw.split('/')[0] : raw;
      }
      if (!name || name.startsWith('@')) name = '@' + idx;
      /* Unit wrapped majors → display ticker */
      if (name === 'UBTC') name = 'BTC';
      if (name === 'UETH') name = 'ETH';
      if (name === 'USOL') name = 'SOL';
      map[idx] = name;
      map['@' + idx] = name;
    });
    _spotNameByIdx = map;
    _spotNameAt = Date.now();
    return map;
  } catch (err) {
    logger.warn({ err: err.message }, 'hl spotMeta for admin fills');
    return _spotNameByIdx || Object.create(null);
  }
}

function isSpotCoin(coin) {
  const c = String(coin || '');
  return c.startsWith('@') || c.includes('/');
}

function resolveAsset(coin, names) {
  const c = String(coin || '');
  if (c.startsWith('@')) {
    const idx = Number(c.slice(1));
    return names[idx] || names[c] || c;
  }
  return c.includes('/') ? c.split('/')[0] : c;
}

async function mapPool(items, limit, fn) {
  const out = [];
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return out;
}

/**
 * Upsert recent HL fills into user_activity. Safe to call on every admin feed load
 * (TTL + single-flight). Returns { ok, users, wrote } or { skipped }.
 */
export async function syncHlFillsIntoActivity(opts = {}) {
  const now = Date.now();
  if (_inflight) return _inflight;
  if (!opts.force && now - _lastSyncAt < SYNC_TTL_MS) {
    return { skipped: true, ageMs: now - _lastSyncAt };
  }

  _inflight = (async () => {
    try {
      const maxUsers = Math.min(80, Number(opts.maxUsers) || MAX_USERS);
      const maxFills = Math.min(100, Number(opts.maxFills) || MAX_FILLS);
      const { rows: users } = await query(
        `SELECT id, lower(wallet_address) AS wallet
           FROM users
          WHERE wallet_address IS NOT NULL
            AND wallet_address ~* '^0x[a-f0-9]{40}$'
            AND COALESCE(last_seen_at, created_at) > NOW() - INTERVAL '21 days'
          ORDER BY last_seen_at DESC NULLS LAST
          LIMIT $1`,
        [maxUsers]
      );
      if (!users.length) {
        _lastSyncAt = Date.now();
        return { ok: true, users: 0, wrote: 0 };
      }

      const names = await spotNameMap();
      let wrote = 0;

      await mapPool(users, CONCURRENCY, async (u) => {
        let fills;
        try {
          fills = await hlInfo({ type: 'userFills', user: u.wallet });
        } catch (_) {
          return;
        }
        if (!Array.isArray(fills) || !fills.length) return;

        for (const f of fills.slice(0, maxFills)) {
          const coin = String(f.coin || '');
          const tid = f.tid != null ? String(f.tid) : String(f.hash || f.oid || '');
          if (!tid) continue;
          const spot = isSpotCoin(coin);
          const sideBuy = String(f.side || '').toUpperCase() === 'B'
            || /buy/i.test(String(f.dir || ''));
          const asset = resolveAsset(coin, names);
          const sz = Number(f.sz || 0);
          const px = Number(f.px || 0);
          const ntl = sz * px;
          const atMs = Number(f.time || 0) || null;

          /* logUserActivity dedupes on tx_hash — safe to retry. */
          const inserted = await logUserActivity({
              userId: u.id,
              wallet: u.wallet,
              product: spot ? 'spot' : 'futures',
              action: spot
                ? (sideBuy ? 'spot_buy' : 'spot_sell')
                : (sideBuy ? 'long' : 'short'),
              detail: {
                from: spot ? (sideBuy ? 'USDC' : asset) : asset,
                to: spot ? (sideBuy ? asset : 'USDC') : 'USDC',
                coin,
                px,
                sz,
                dir: f.dir || null,
                fee: f.fee != null ? Number(f.fee) : null,
                source: 'hl_userFills',
                hl_time: atMs,
              },
              txHash: 'hl:' + tid,
              amount: ntl > 0 ? Number(ntl.toFixed(4)) : sz,
              asset,
              status: 'filled',
              createdAt: atMs || undefined,
            });
            if (inserted) wrote += 1;
        }
      });

      _lastSyncAt = Date.now();
      return { ok: true, users: users.length, wrote };
    } catch (err) {
      logger.warn({ err: err.message }, 'syncHlFillsIntoActivity failed');
      return { ok: false, error: err.message };
    } finally {
      _inflight = null;
    }
  })();

  return _inflight;
}

export default syncHlFillsIntoActivity;
