import config from '../config/index.js';
import logger from '../utils/logger.js';
import { query, withTx } from '../db/pool.js';
import { binance } from '../integrations/binance/client.js';

function depositId(deposit) {
  return String(deposit.id || deposit.tranId || deposit.txId || `${deposit.coin}:${deposit.network}:${deposit.address}:${deposit.amount}:${deposit.insertTime}`);
}

async function matchUserForDeposit(tx, deposit) {
  const byAddress = await tx.query(
    `SELECT user_id
       FROM binance_deposit_addresses
      WHERE address=$1
      ORDER BY fetched_at DESC
      LIMIT 1`,
    [deposit.address]
  );
  if (byAddress.rows[0]) return byAddress.rows[0].user_id;
  const memo = deposit.addressTag || deposit.memo || deposit.tag || null;
  if (memo) {
    const byMemo = await tx.query(
      `SELECT user_id
         FROM binance_deposit_addresses
        WHERE memo=$1
        ORDER BY fetched_at DESC
        LIMIT 1`,
      [memo]
    );
    if (byMemo.rows[0]) return byMemo.rows[0].user_id;
  }
  if (deposit.subAccountEmail) {
    const bySub = await tx.query(
      `SELECT user_id
         FROM binance_subaccounts
        WHERE binance_email=$1
        LIMIT 1`,
      [deposit.subAccountEmail]
    );
    if (bySub.rows[0]) return bySub.rows[0].user_id;
  }
  return null;
}

export async function reconcileBinanceDeposits({ client = binance, wsBroadcaster = null } = {}) {
  const lookback = Date.now() - 24 * 3600 * 1000;
  const deposits = await client.getDepositHistory({ startTime: lookback });
  const credited = [];

  for (const deposit of deposits || []) {
    const externalId = depositId(deposit);
    const existing = await query(
      `SELECT id FROM wallet_transfers WHERE binance_deposit_id=$1 LIMIT 1`,
      [externalId]
    );
    if (existing.rows[0]) continue;

    const result = await withTx(async (tx) => {
      const userId = await matchUserForDeposit(tx, deposit);
      if (!userId) return null;
      const amount = Number(deposit.amount || 0);
      if (amount <= 0) return null;
      const asset = String(deposit.coin || deposit.asset || '').toUpperCase();
      const network = String(deposit.network || '').toUpperCase();
      const inserted = await tx.query(
        `INSERT INTO wallet_transfers
           (user_id, direction, asset, network, address, tx_hash, amount, fee, status, confirmations, required_confirmations, note, provider, binance_deposit_id, settled_at, created_at, updated_at)
         VALUES
           ($1, 'deposit', $2, $3, $4, $5, $6, 0, 'completed', $7, $8, 'Binance deposit reconciled', 'binance', $9, NOW(), COALESCE(to_timestamp($10 / 1000.0), NOW()), NOW())
         RETURNING id, user_id, asset, network, amount, tx_hash, status`,
        [
          userId,
          asset,
          network,
          deposit.address || '',
          deposit.txId || null,
          amount,
          Number(deposit.confirmTimes || deposit.confirmations || 1),
          Number(deposit.confirmTimes || deposit.confirmations || 1),
          externalId,
          Number(deposit.insertTime || Date.now()),
        ]
      );
      await tx.query(
        `INSERT INTO balances (user_id, asset, mode, amount, locked, updated_at)
         VALUES ($1,$2,'live',$3,0,NOW())
         ON CONFLICT(user_id, asset, mode)
         DO UPDATE SET amount=balances.amount + EXCLUDED.amount, updated_at=NOW()`,
        [userId, asset, amount]
      );
      await tx.query(
        `INSERT INTO notifications_outbox (user_id, channel, template, payload)
         VALUES ($1, 'email', 'deposit_confirmed', $2::jsonb)`,
        [userId, JSON.stringify({ asset, amount, network, tx_hash: deposit.txId || null })]
      );
      return inserted.rows[0];
    });
    if (result) {
      credited.push(result);
      wsBroadcaster?.broadcast(`balances.user.${result.user_id}`, {
        event: 'deposit_confirmed',
        transfer: result,
      });
    }
  }
  return credited;
}

export function startBinanceDepositReconciler({ intervalMs = config.binance.depositReconcileMs, client = binance, wsBroadcaster = null } = {}) {
  const tick = async () => {
    try {
      await reconcileBinanceDeposits({ client, wsBroadcaster });
    } catch (err) {
      logger.warn({ err: err.message }, 'binance deposit reconciler failed');
    }
  };
  const timer = setInterval(tick, intervalMs);
  timer.unref?.();
  setTimeout(tick, 2500).unref?.();
  return { async stop() { clearInterval(timer); } };
}

export default startBinanceDepositReconciler;
