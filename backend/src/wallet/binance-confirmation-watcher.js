import config from '../config/index.js';
import logger from '../utils/logger.js';
import { query, withTx } from '../db/pool.js';
import { binance } from '../integrations/binance/client.js';

async function refundWithdrawal(tx, row, reason) {
  await tx.query(
    `UPDATE balances
        SET amount = amount + $3, updated_at=NOW()
      WHERE user_id=$1 AND asset=$2 AND mode='live'`,
    [row.user_id, row.asset, row.amount]
  );
  await tx.query(
    `UPDATE wallet_transfers
        SET status='failed', note=$2, updated_at=NOW()
      WHERE id=$1`,
    [row.transfer_id, reason]
  );
  await tx.query(
    `INSERT INTO notifications_outbox (user_id, channel, template, payload)
     VALUES ($1, 'email', 'withdraw_failed', $2::jsonb)`,
    [row.user_id, JSON.stringify({ asset: row.asset, amount: row.amount, network: row.network, reason })]
  );
}

function isCompletedStatus(status) {
  return Number(status) === 6 || String(status).toLowerCase() === 'completed';
}

function isFailedStatus(status) {
  return [1, 3].includes(Number(status)) || ['cancelled', 'canceled', 'rejected', 'failure', 'failed'].includes(String(status).toLowerCase());
}

export async function checkBinanceWithdrawals({ client = binance } = {}) {
  const { rows } = await query(
    `SELECT q.id AS queue_id, q.transfer_id, q.user_id, q.asset, q.network, q.amount,
            t.binance_withdraw_id, t.tx_hash
       FROM withdrawal_queue q
       JOIN wallet_transfers t ON t.id=q.transfer_id
      WHERE q.status='broadcast'
        AND t.binance_withdraw_id IS NOT NULL
      ORDER BY q.broadcast_at ASC NULLS FIRST
      LIMIT 50`
  );
  const byAsset = new Map();
  for (const row of rows) {
    if (!byAsset.has(row.asset)) byAsset.set(row.asset, []);
    byAsset.get(row.asset).push(row);
  }

  for (const [asset, items] of byAsset) {
    const history = await client.getWithdrawHistory({ coin: asset });
    for (const item of items) {
      const found = (history || []).find((row) => String(row.id || row.withdrawOrderId) === String(item.binance_withdraw_id));
      if (!found) continue;
      await query(
        `UPDATE binance_withdrawal_log
            SET binance_status=$2, binance_response=$3::jsonb, polled_at=NOW()
          WHERE transfer_id=$1`,
        [item.transfer_id, String(found.status ?? 'unknown'), JSON.stringify(found)]
      );
      if (isCompletedStatus(found.status)) {
        await withTx(async (tx) => {
          await tx.query(
            `UPDATE withdrawal_queue
                SET status='confirmed', tx_hash=$2, confirmations=$3, confirmed_at=NOW(), updated_at=NOW()
              WHERE id=$1 AND status='broadcast'`,
            [item.queue_id, found.txId || item.tx_hash || null, config.signers.confirmations[item.network] || 1]
          );
          await tx.query(
            `UPDATE wallet_transfers
                SET status='completed', tx_hash=$2, confirmations=required_confirmations, settled_at=NOW(), updated_at=NOW(), note='Withdrawal completed by Binance'
              WHERE id=$1`,
            [item.transfer_id, found.txId || item.tx_hash || null]
          );
          await tx.query(
            `INSERT INTO notifications_outbox (user_id, channel, template, payload)
             VALUES ($1, 'email', 'withdraw_completed', $2::jsonb)`,
            [item.user_id, JSON.stringify({ asset: item.asset, amount: item.amount, network: item.network, tx_hash: found.txId || null })]
          );
        });
      } else if (isFailedStatus(found.status)) {
        await withTx((tx) => refundWithdrawal(tx, item, `binance_withdrawal_${found.status}`));
      }
    }
  }
}

export function startBinanceConfirmWatcher({ intervalMs = config.binance.confirmWatcherMs, client = binance } = {}) {
  const tick = async () => {
    try {
      await checkBinanceWithdrawals({ client });
    } catch (err) {
      logger.warn({ err: err.message }, 'binance withdrawal watcher failed');
    }
  };
  const timer = setInterval(tick, intervalMs);
  timer.unref?.();
  setTimeout(tick, 2000).unref?.();
  return { async stop() { clearInterval(timer); } };
}

export default startBinanceConfirmWatcher;
