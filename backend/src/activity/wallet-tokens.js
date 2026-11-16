import axios from 'axios';
import { query } from '../db/pool.js';
import logger from '../utils/logger.js';

const EVM_ADDR = /^0x[0-9a-fA-F]{40}$/;
const SYM_OK = /^[A-Za-z0-9.$_+-]{1,16}$/;
const LIFI = 'https://li.quest/v1';
const LIFI_API_KEY = String(process.env.LIFI_API_KEY || '').trim();
const ZERO = /^0x0{40}$/i;
const TRANSFER = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
/* Destination-chain RPCs for reading what a delivery tx actually sent to the wallet. */
const RPC = {
  1: 'https://ethereum-rpc.publicnode.com',
  10: 'https://optimism-rpc.publicnode.com',
  56: 'https://bsc-rpc.publicnode.com',
  137: 'https://polygon-bor-rpc.publicnode.com',
  143: 'https://rpc.monad.xyz',
  999: 'https://rpc.hyperliquid.xyz/evm',
  4663: 'https://rpc.mainnet.chain.robinhood.com',
  8453: 'https://base-rpc.publicnode.com',
  42161: 'https://arbitrum-one-rpc.publicnode.com',
  43114: 'https://avalanche-c-chain-rpc.publicnode.com',
  59144: 'https://linea-rpc.publicnode.com',
};

function abiString(hex) {
  try {
    const h = String(hex || '').replace(/^0x/, '');
    if (h.length === 64) return Buffer.from(h, 'hex').toString('utf8').replace(/\u0000+$/g, '');
    const off = parseInt(h.slice(0, 64), 16) * 2;
    const len = parseInt(h.slice(off, off + 64), 16);
    return Buffer.from(h.slice(off + 64, off + 64 + len * 2), 'hex').toString('utf8');
  } catch (_) { return ''; }
}

/**
 * Bridge + swap routes (Relay) report the bridged asset (ETH) in LI.FI's status, not the coin
 * the user bought (MACCA, 15.11). The delivery tx's ERC-20 transfers to the wallet say what arrived.
 */
export async function tokenFromDeliveryTx(cid, txHash, wallet, { post = axios.post } = {}) {
  const url = RPC[Number(cid)];
  if (!url || !/^0x[0-9a-fA-F]{64}$/.test(String(txHash || '')) || !EVM_ADDR.test(String(wallet || ''))) return null;
  const call = async (method, params) => {
    const { data } = await post(url, { jsonrpc: '2.0', id: 1, method, params }, { timeout: 4000, headers: { 'content-type': 'application/json' } });
    return data && data.result;
  };
  try {
    const rcpt = await call('eth_getTransactionReceipt', [txHash]);
    const me = '0x' + String(wallet).toLowerCase().replace(/^0x/, '').padStart(64, '0');
    const logs = ((rcpt && rcpt.logs) || []).filter((l) => Array.isArray(l.topics) && String(l.topics[0]).toLowerCase() === TRANSFER
      && String(l.topics[2] || '').toLowerCase() === me && l.topics.length === 3);
    const last = logs[logs.length - 1];
    if (!last || !EVM_ADDR.test(String(last.address || ''))) return null;
    const addr = String(last.address);
    const [decHex, symHex] = await Promise.all([
      call('eth_call', [{ to: addr, data: '0x313ce567' }, 'latest']),
      call('eth_call', [{ to: addr, data: '0x95d89b41' }, 'latest']),
    ]);
    const dec = parseInt(String(decHex || '').slice(2, 66), 16);
    const sym = abiString(symHex).trim();
    if (!Number.isInteger(dec) || dec > 36 || !sym) return null;
    return { cid: Number(cid), addr, dec, sym };
  } catch (_) {
    return null;
  }
}

/**
 * Tokens a wallet bought through GROM, so its wallet page can show them on any device
 * (the on-device «my tokens» list lives in one browser only). Rows come from user_activity
 * swap entries that carry the destination contract (detail.toToken).
 * Returns [[chainId, address, decimals, symbol], …], newest first, one entry per contract.
 */
export function normalizeWalletTokens(rows, { limit = 60 } = {}) {
  const out = [];
  const seen = new Set();
  for (const r of Array.isArray(rows) ? rows : []) {
    const cid = Number(r && (r.cid || r.chain));
    const addr = String((r && r.addr) || '');
    const dec = Number(r && r.dec);
    const sym = String((r && r.sym) || '').trim().toUpperCase();
    if (!(Number.isInteger(cid) && cid > 0 && cid < 1e8)) continue;
    if (!EVM_ADDR.test(addr) || /^0x0{40}$/i.test(addr)) continue;
    if (!Number.isInteger(dec) || dec < 0 || dec > 36) continue;
    if (!SYM_OK.test(sym)) continue;
    const key = cid + ':' + addr.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push([cid, addr, dec, sym]);
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * What a swap delivered, from LI.FI's status by source tx hash.
 * → { cid, addr, dec, sym } when known; null when LI.FI will never know (not its tx, failed);
 *   undefined when it is too early to say (pending, just sent, network error) — ask again later.
 */
export async function resolveDeliveredToken(txHash, { createdAt = 0, now = Date.now(), get = axios.get, want = '', wallet = '', fromTx = tokenFromDeliveryTx } = {}) {
  try {
    const { data, status } = await get(`${LIFI}/status`, {
      params: { txHash },
      timeout: 4000,
      validateStatus: () => true,
      headers: { accept: 'application/json', ...(LIFI_API_KEY ? { 'x-lifi-api-key': LIFI_API_KEY } : {}) },
    });
    const old = now - new Date(createdAt || 0).getTime() > 30 * 60_000;
    if (status === 429 || status >= 500) return undefined;
    const st = String((data && data.status) || '').toUpperCase();
    if (status === 404 || status === 400 || st === 'NOT_FOUND' || st === 'INVALID') return old ? null : undefined;
    if (st === 'FAILED') return null;
    if (st !== 'DONE') return undefined;
    const rc = (data && data.receiving) || {};
    const t = rc.token || {};
    const cid = Number(rc.chainId || t.chainId);
    if (!EVM_ADDR.test(String(t.address || '')) || !(cid > 0)) return null;
    const sym = String(t.symbol || '');
    const quoted = String(want || '').trim().toUpperCase();
    if ((ZERO.test(String(t.address)) || (quoted && sym.toUpperCase() !== quoted)) && rc.txHash) {
      const real = await fromTx(cid, rc.txHash, wallet);
      if (real && (!quoted || real.sym.toUpperCase() === quoted)) return real;
    }
    return { cid, addr: String(t.address), dec: Number(t.decimals), sym };
  } catch (_) {
    return undefined;
  }
}

const inflight = new Map();

/**
 * Swaps logged before the bought contract was recorded (or by older clients) get it filled
 * in once from LI.FI and saved on the row, so later reads are plain SQL.
 */
async function backfill(wallet, { q, resolve, now, max = 8 }) {
  const r = await q(
    `SELECT tx_hash, created_at, detail->>'to' AS want
       FROM user_activity
      WHERE wallet_address = $1 AND product = 'swap' AND NOT (detail ? 'toToken')
        AND tx_hash ~ '^0x[0-9a-fA-F]{64}$'
        AND created_at > NOW() - INTERVAL '180 days'
      ORDER BY created_at DESC
      LIMIT $2`,
    [wallet, max]
  );
  await Promise.all((r.rows || []).map(async (row) => {
    const got = await resolve(row.tx_hash, { createdAt: row.created_at, now, want: row.want, wallet });
    if (got === undefined) return;
    const patch = got
      ? { toToken: got.addr, toDec: got.dec, toChainId: got.cid, toSym: got.sym }
      : { toToken: null };
    try {
      await q(`UPDATE user_activity SET detail = detail || $2::jsonb WHERE tx_hash = $1`, [row.tx_hash, JSON.stringify(patch)]);
    } catch (err) {
      logger.warn({ err: err.message }, 'wallet-tokens backfill update failed');
    }
  }));
}

export async function listWalletTokens(wallet, { q = query, resolve = resolveDeliveredToken, now = Date.now() } = {}) {
  const w = String(wallet || '').toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(w)) return [];
  if (!inflight.has(w)) {
    inflight.set(w, backfill(w, { q, resolve, now }).catch((err) => {
      logger.warn({ err: err.message }, 'wallet-tokens backfill failed');
    }).finally(() => inflight.delete(w)));
  }
  await inflight.get(w);
  const r = await q(
    `SELECT detail->>'toChainId' AS cid, detail->>'chain' AS chain, detail->>'toToken' AS addr,
            detail->>'toDec' AS dec, COALESCE(detail->>'toSym', detail->>'to') AS sym
       FROM user_activity
      WHERE wallet_address = $1 AND product = 'swap' AND detail ? 'toToken'
        AND created_at > NOW() - INTERVAL '180 days'
      ORDER BY created_at DESC
      LIMIT 200`,
    [w]
  );
  return normalizeWalletTokens(r.rows);
}
