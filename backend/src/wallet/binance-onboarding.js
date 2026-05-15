import crypto from 'node:crypto';
import { query, withTx } from '../db/pool.js';
import config from '../config/index.js';
import { binance } from '../integrations/binance/client.js';
import { toBinanceNetwork } from '../integrations/binance/network-map.js';

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function subAccountEmail(userId) {
  return `grom-${String(userId).replace(/-/g, '').slice(0, 12)}@grom.exchange`;
}

function memoForUser(userId) {
  return `grom${String(userId).replace(/-/g, '').slice(0, 12)}`;
}

export async function ensureSubAccount(userId, client = binance) {
  const existing = await query(
    `SELECT * FROM binance_subaccounts WHERE user_id=$1`,
    [userId]
  );
  if (existing.rows[0]) return existing.rows[0];

  const email = subAccountEmail(userId);
  const res = await client.createVirtualSubAccount(email);
  const { rows } = await query(
    `INSERT INTO binance_subaccounts (user_id, binance_email, binance_subaccount_id)
     VALUES ($1,$2,$3)
     ON CONFLICT(user_id) DO UPDATE
       SET binance_email=EXCLUDED.binance_email,
           binance_subaccount_id=EXCLUDED.binance_subaccount_id
     RETURNING *`,
    [userId, res.email || email, res.subaccountId || res.subAccountId || null]
  );
  return rows[0];
}

export async function ensureDepositAddress(userId, asset, network, client = binance) {
  const coin = String(asset || '').toUpperCase();
  const mappedNetwork = toBinanceNetwork(network);
  if (!mappedNetwork) throw new Error(`binance_network_unsupported:${network}`);
  if (config.binance.dryRun || config.binance.useTestnet) {
    return {
      asset: coin,
      network: String(network).toUpperCase(),
      address: `dryrun_${sha256(userId + coin + network).slice(0, 30)}`,
      memo: null,
    };
  }
  const existing = await query(
    `SELECT asset, network, address, memo, fetched_at
       FROM binance_deposit_addresses
      WHERE user_id=$1 AND asset=$2 AND network=$3`,
    [userId, coin, String(network).toUpperCase()]
  );
  if (existing.rows[0]) return existing.rows[0];

  return withTx(async (tx) => {
    let res;
    let memo = null;
    try {
      const sub = await ensureSubAccount(userId, client);
      res = await client.getSubAccountDepositAddress({
        email: sub.binance_email,
        coin,
        network: mappedNetwork,
      });
      memo = res.tag || res.memo || null;
    } catch (err) {
      if (![403, 404].includes(Number(err.status))) throw err;
      res = await client.getDepositAddress({ coin, network: mappedNetwork });
      memo = memoForUser(userId);
    }
    const { rows } = await tx.query(
      `INSERT INTO binance_deposit_addresses (user_id, asset, network, address, memo)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT(user_id, asset, network)
       DO UPDATE SET address=EXCLUDED.address, memo=EXCLUDED.memo, fetched_at=NOW()
       RETURNING asset, network, address, memo, fetched_at`,
      [userId, coin, String(network).toUpperCase(), res.address, memo]
    );
    return rows[0];
  });
}

export default { ensureSubAccount, ensureDepositAddress };
