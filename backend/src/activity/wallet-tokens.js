import { query } from '../db/pool.js';

const EVM_ADDR = /^0x[0-9a-fA-F]{40}$/;
const SYM_OK = /^[A-Za-z0-9.$_+-]{1,16}$/;

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

export async function listWalletTokens(wallet, { q = query } = {}) {
  const w = String(wallet || '').toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(w)) return [];
  const r = await q(
    `SELECT detail->>'toChainId' AS cid, detail->>'chain' AS chain, detail->>'toToken' AS addr,
            detail->>'toDec' AS dec, detail->>'to' AS sym
       FROM user_activity
      WHERE wallet_address = $1 AND product = 'swap' AND detail ? 'toToken'
        AND created_at > NOW() - INTERVAL '180 days'
      ORDER BY created_at DESC
      LIMIT 200`,
    [w]
  );
  return normalizeWalletTokens(r.rows);
}
