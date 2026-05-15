import crypto from 'node:crypto';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import { query, withTx } from '../db/pool.js';
import { signAndBroadcastWithdrawal } from './signers/index.js';
import startConfirmationWatcher from './confirmation-watcher.js';

function randomTxHash() {
  return `0x${crypto.randomBytes(32).toString('hex')}`;
}

export async function triggerSweepNow(actor = null, opts = {}) {
  const dryRun = Boolean(opts.dryRun);
  const allow = opts.assets?.length ? new Set(opts.assets.map((a) => String(a).toUpperCase())) : null;
  const plan = [];
  const { rows } = await query(
    `SELECT asset, COALESCE(SUM(amount),0) AS total_amount
       FROM balances
      WHERE mode='live'
      GROUP BY asset`
  );
  for (const row of rows) {
    const asset = String(row.asset || '').toUpperCase();
    if (allow && !allow.has(asset)) continue;
    const threshold = Number(config.wallet.hotWalletMaxBalance[asset] || 0);
    if (!threshold) continue;
    const hotBalance = Number(row.total_amount || 0);
    const excess = Number((hotBalance - threshold).toFixed(8));
    if (excess <= 0) continue;
    const coldAddress = config.wallet.coldAddresses[asset] || `cold-vault-${asset.toLowerCase()}`;
    const hotAddress = `hot-wallet-${asset.toLowerCase()}`;
    plan.push({ asset, hot_balance: hotBalance, threshold, excess, hot_address: hotAddress, cold_address: coldAddress });
  }

  if (!dryRun && plan.length) {
    await withTx(async (tx) => {
      for (const item of plan) {
        const exists = await tx.query(
          `SELECT id FROM sweep_transfers
            WHERE asset=$1 AND status IN ('queued','signing','broadcast')
            LIMIT 1`,
          [item.asset]
        );
        if (exists.rows[0]) continue;
        await tx.query(
          `INSERT INTO sweep_transfers (asset, amount, hot_address, cold_address, status, created_by)
           VALUES ($1, $2, $3, $4, 'queued', $5)`,
          [item.asset, item.excess, item.hot_address, item.cold_address, actor]
        );
        await tx.query(
          `INSERT INTO wallet_audit
             (type, asset, amount, actor, reason, metadata)
           VALUES ('sweep_to_cold_queued', $1, $2, $3, 'hot_balance_excess', $4::jsonb)`,
          [item.asset, item.excess, actor || 'system', JSON.stringify({ hot_balance: item.hot_balance, threshold: item.threshold, hot_address: item.hot_address, cold_address: item.cold_address })]
        );
      }
    });
  }

  return plan;
}

async function processWithdrawalQueue() {
  const { rows } = await query(
    `SELECT id
       FROM withdrawal_queue
      WHERE status='queued'
      ORDER BY created_at ASC
      LIMIT 10`
  );
  for (const row of rows) {
    await withTx(async (tx) => {
      const locked = await tx.query(
        `UPDATE withdrawal_queue
            SET status='signing', attempts=attempts+1, updated_at=NOW()
          WHERE id=$1 AND status='queued'
        RETURNING *`,
        [row.id]
      );
      const q = locked.rows[0];
      if (!q) return;
      const wallet = await tx.query(
        `SELECT *
           FROM hot_wallets
          WHERE asset=$1 AND network=$2 AND enabled=TRUE
          ORDER BY created_at ASC
          LIMIT 1`,
        [q.asset, q.network]
      );
      const hotWallet = wallet.rows[0] || { address: `hot-wallet-${String(q.asset).toLowerCase()}-${String(q.network).toLowerCase()}` };
      const reserves = config.binance.useAsHotWallet ? [] : await getReserveSnapshot();
      const reserve = reserves.find((item) => item.asset === q.asset);
      if (!config.binance.useAsHotWallet && reserve && Number(reserve.hot || 0) < Number(q.amount) * 2) {
        await tx.query(
          `UPDATE withdrawal_queue
              SET status='awaiting_topup', provider_error='hot_wallet_topup_required', updated_at=NOW()
            WHERE id=$1`,
          [q.id]
        );
        await tx.query(
          `INSERT INTO wallet_audit
             (user_id, transfer_id, type, asset, amount, actor, reason, metadata)
           VALUES ($1, $2, 'withdrawal_awaiting_topup', $3, $4, 'system', 'hot_wallet_below_2x_withdrawal', $5::jsonb)`,
          [q.user_id, q.transfer_id, q.asset, q.amount, JSON.stringify({ network: q.network, hot: reserve.hot, amount: q.amount })]
        );
        return;
      }
      let signed;
      try {
        signed = await signAndBroadcastWithdrawal({
          asset: q.asset,
          network: q.network,
          to: q.address,
          amount: q.amount,
          memo: q.memo || null,
          transferId: q.transfer_id,
          hotWallet,
        });
      } catch (err) {
        await tx.query(
          `UPDATE withdrawal_queue
              SET status='failed', provider_error=$2, last_error=$2, updated_at=NOW()
            WHERE id=$1`,
          [q.id, err.message]
        );
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
          [q.transfer_id, err.message]
        );
        await tx.query(
          `INSERT INTO notifications_outbox (user_id, channel, template, payload)
           VALUES ($1, 'email', 'withdraw_failed', $2::jsonb)`,
          [q.user_id, JSON.stringify({ asset: q.asset, amount: q.amount, network: q.network, reason: err.message })]
        );
        await tx.query(
          `INSERT INTO wallet_audit
             (user_id, transfer_id, type, asset, amount, actor, reason, metadata)
           VALUES ($1, $2, 'withdrawal_failed_refunded', $3, $4, 'system', $5, $6::jsonb)`,
          [q.user_id, q.transfer_id, q.asset, q.amount, err.message, JSON.stringify({ network: q.network, address: q.address })]
        );
        return;
      }
      const txHash = signed.txHash || null;
      await tx.query(
        `UPDATE withdrawal_queue
            SET status='broadcast', tx_hash=$2, broadcast_at=NOW(), updated_at=NOW(), provider_error=NULL
          WHERE id=$1`,
        [q.id, txHash]
      );
      await tx.query(
        `UPDATE wallet_transfers
            SET status='broadcast',
                tx_hash=$2,
                binance_withdraw_id=COALESCE($3, binance_withdraw_id),
                provider=CASE WHEN $3 IS NULL THEN provider ELSE 'binance' END,
                updated_at=NOW(),
                note=$4
          WHERE id=$1`,
        [
          q.transfer_id,
          txHash,
          signed.binanceWithdrawId || null,
          signed.binanceWithdrawId ? 'Submitted to Binance withdrawal pipeline' : 'Broadcast to signer/RPC pipeline',
        ]
      );
      await tx.query(
        `INSERT INTO wallet_audit
           (user_id, transfer_id, type, asset, amount, actor, reason, metadata)
         VALUES ($1, $2, 'withdrawal_broadcast', $3, $4, 'system', 'mock_signer_confirmed', $5::jsonb)`,
        [q.user_id, q.transfer_id, q.asset, q.amount, JSON.stringify({ network: q.network, address: q.address, tx_hash: txHash, binance_withdraw_id: signed.binanceWithdrawId || null, dry_run: Boolean(signed.dryRun) })]
      );
    });
  }
}

async function processSweepQueue() {
  const { rows } = await query(
    `SELECT id
       FROM sweep_transfers
      WHERE status='queued'
      ORDER BY created_at ASC
      LIMIT 10`
  );
  for (const row of rows) {
    await withTx(async (tx) => {
      const locked = await tx.query(
        `UPDATE sweep_transfers
            SET status='signing', attempts=attempts+1, updated_at=NOW()
          WHERE id=$1 AND status='queued'
        RETURNING *`,
        [row.id]
      );
      const q = locked.rows[0];
      if (!q) return;
      const txHash = randomTxHash();
      if (config.env === 'production') {
        await tx.query(
          `UPDATE sweep_transfers
              SET status='broadcast', tx_hash=$2, broadcast_at=NOW(), updated_at=NOW()
            WHERE id=$1`,
          [q.id, txHash]
        );
        return;
      }
      await tx.query(
        `UPDATE sweep_transfers
            SET status='confirmed', tx_hash=$2, broadcast_at=NOW(), confirmed_at=NOW(), updated_at=NOW()
          WHERE id=$1`,
        [q.id, txHash]
      );
      await tx.query(
        `INSERT INTO wallet_audit
           (type, asset, amount, actor, reason, metadata)
         VALUES ('sweep_to_cold_confirmed', $1, $2, 'system', 'mock_signer_confirmed', $3::jsonb)`,
        [q.asset, q.amount, JSON.stringify({ hot_address: q.hot_address, cold_address: q.cold_address, tx_hash: txHash })]
      );
    });
  }
}

export async function getReserveSnapshot() {
  const [hotRes, coldRes, queueRes] = await Promise.all([
    query(`SELECT asset, COALESCE(SUM(amount),0) AS amount FROM balances WHERE mode='live' GROUP BY asset`),
    query(`SELECT asset, COALESCE(SUM(amount),0) AS amount FROM sweep_transfers WHERE status='confirmed' GROUP BY asset`),
    query(`SELECT asset, COALESCE(SUM(amount),0) AS amount FROM sweep_transfers WHERE status IN ('queued','signing','broadcast') GROUP BY asset`),
  ]);
  const byAsset = new Map();
  for (const row of hotRes.rows) byAsset.set(row.asset, { asset: row.asset, hot: Number(row.amount || 0), cold: 0, in_queue: 0, threshold: Number(config.wallet.hotWalletMaxBalance[row.asset] || 0) });
  for (const row of coldRes.rows) {
    const cur = byAsset.get(row.asset) || { asset: row.asset, hot: 0, cold: 0, in_queue: 0, threshold: Number(config.wallet.hotWalletMaxBalance[row.asset] || 0) };
    cur.cold = Number(row.amount || 0);
    byAsset.set(row.asset, cur);
  }
  for (const row of queueRes.rows) {
    const cur = byAsset.get(row.asset) || { asset: row.asset, hot: 0, cold: 0, in_queue: 0, threshold: Number(config.wallet.hotWalletMaxBalance[row.asset] || 0) };
    cur.in_queue = Number(row.amount || 0);
    byAsset.set(row.asset, cur);
  }
  return Array.from(byAsset.values()).sort((a, b) => a.asset.localeCompare(b.asset));
}

export function startWithdrawalQueueWorker() {
  let queueTimer = null;
  let sweepTimer = null;
  let running = false;
  const confirmationWatcher = config.binance.useAsHotWallet ? null : startConfirmationWatcher();

  async function tickQueues() {
    if (running) return;
    running = true;
    try {
      await processWithdrawalQueue();
      await processSweepQueue();
    } catch (err) {
      logger.error({ err: err.stack || err.message }, 'wallet queue worker tick failed');
    } finally {
      running = false;
    }
  }

  async function tickSweepScan() {
    try {
      await triggerSweepNow(null, { dryRun: false });
    } catch (err) {
      logger.error({ err: err.stack || err.message }, 'hot/cold sweep scan failed');
    }
  }

  queueTimer = setInterval(tickQueues, config.wallet.queuePollMs);
  sweepTimer = setInterval(tickSweepScan, config.wallet.sweepPollMs);
  queueTimer.unref?.();
  sweepTimer.unref?.();
  setTimeout(tickQueues, 1200).unref?.();
  setTimeout(tickSweepScan, 2500).unref?.();

  return {
    async stop() {
      if (queueTimer) clearInterval(queueTimer);
      if (sweepTimer) clearInterval(sweepTimer);
      await confirmationWatcher?.stop();
      queueTimer = null;
      sweepTimer = null;
    },
  };
}

export default startWithdrawalQueueWorker;
