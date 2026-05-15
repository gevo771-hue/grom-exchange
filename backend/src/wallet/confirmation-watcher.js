import config from '../config/index.js';
import logger from '../utils/logger.js';
import { query, withTx } from '../db/pool.js';
import { getWithdrawalConfirmations } from './signers/index.js';

export function requiredConfirmations(network) {
  const key = String(network || '').toUpperCase();
  if (key === 'TRC20' || key === 'TRC-20') return config.signers.confirmations.TRON;
  if (key === 'BITCOIN') return config.signers.confirmations.BTC;
  return config.signers.confirmations[key] || 12;
}

async function refundWithdrawal(tx, q, reason) {
  await tx.query(
    `UPDATE balances
        SET amount = amount + $3, updated_at=NOW()
      WHERE user_id=$1 AND asset=$2 AND mode='live'`,
    [q.user_id, q.asset, q.amount]
  );
  await tx.query(
    `UPDATE wallet_transfers
        SET status='failed', note=$2, updated_at=NOW()
      WHERE id=$1`,
    [q.transfer_id, reason]
  );
  await tx.query(
    `INSERT INTO notifications_outbox (user_id, channel, template, payload)
     VALUES ($1, 'email', 'withdraw_failed', $2::jsonb)`,
    [q.user_id, JSON.stringify({ asset: q.asset, amount: q.amount, network: q.network, tx_hash: q.tx_hash, reason })]
  );
}

export async function checkBroadcastWithdrawals() {
  const { rows } = await query(
    `SELECT *
       FROM withdrawal_queue
      WHERE status='broadcast'
      ORDER BY broadcast_at ASC NULLS FIRST
      LIMIT 25`
  );
  for (const row of rows) {
    try {
      const confirmations = await getWithdrawalConfirmations({ network: row.network, txHash: row.tx_hash });
      const required = requiredConfirmations(row.network);
      if (confirmations < required) {
        await query(
          `UPDATE withdrawal_queue
              SET confirmations=$2, updated_at=NOW()
            WHERE id=$1`,
          [row.id, confirmations]
        );
        continue;
      }
      await withTx(async (tx) => {
        await tx.query(
          `UPDATE withdrawal_queue
              SET status='confirmed', confirmations=$2, confirmed_at=NOW(), updated_at=NOW()
            WHERE id=$1 AND status='broadcast'`,
          [row.id, confirmations]
        );
        await tx.query(
          `UPDATE wallet_transfers
              SET status='completed', tx_hash=$2, confirmations=$3, required_confirmations=$4, settled_at=NOW(), updated_at=NOW(), note='Withdrawal confirmed on-chain'
            WHERE id=$1`,
          [row.transfer_id, row.tx_hash, confirmations, required]
        );
        await tx.query(
          `INSERT INTO wallet_audit
             (user_id, transfer_id, type, asset, amount, actor, reason, metadata)
           VALUES ($1, $2, 'withdrawal_confirmed', $3, $4, 'system', 'chain_confirmations_reached', $5::jsonb)`,
          [row.user_id, row.transfer_id, row.asset, row.amount, JSON.stringify({ network: row.network, tx_hash: row.tx_hash, confirmations })]
        );
        await tx.query(
          `INSERT INTO notifications_outbox (user_id, channel, template, payload)
           VALUES ($1, 'email', 'withdraw_completed', $2::jsonb)`,
          [row.user_id, JSON.stringify({ asset: row.asset, amount: row.amount, network: row.network, tx_hash: row.tx_hash })]
        );
      });
    } catch (err) {
      if (err.reverted) {
        await withTx(async (tx) => {
          await tx.query(
            `UPDATE withdrawal_queue
                SET status='failed', provider_error=$2, updated_at=NOW()
              WHERE id=$1`,
            [row.id, err.message]
          );
          await refundWithdrawal(tx, row, err.message);
        });
      } else {
        logger.warn({ err: err.message, id: row.id }, 'withdrawal confirmation check failed');
      }
    }
  }
}

export function startConfirmationWatcher({ intervalMs = 30_000 } = {}) {
  const timer = setInterval(checkBroadcastWithdrawals, intervalMs);
  timer.unref?.();
  setTimeout(checkBroadcastWithdrawals, 2_000).unref?.();
  return {
    async stop() {
      clearInterval(timer);
    },
  };
}

export default startConfirmationWatcher;
