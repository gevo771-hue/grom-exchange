import crypto from 'node:crypto';
import config from '../config/index.js';
import { query, withTx } from '../db/pool.js';

const WELCOME_BALANCES = [
  { asset: 'BTC', amount: 0.09842, locked: 0 },
  { asset: 'ETH', amount: 0.482, locked: 0 },
  { asset: 'USDT', amount: 564.33, locked: 0 },
  { asset: 'SOL', amount: 1.36, locked: 0 },
];

/** Seed custodial trading balances once per new user (demo / welcome credits). */
export async function ensureWelcomeWalletSeed(userId) {
  if (!config.wallet.welcomeSeed || !userId) return;
  const existing = await query('SELECT 1 FROM balances WHERE user_id=$1 LIMIT 1', [userId]);
  if (existing.rowCount > 0) return;

  await withTx(async (tx) => {
    for (const row of WELCOME_BALANCES) {
      await tx.query(
        `INSERT INTO balances (user_id, asset, mode, amount, locked, updated_at)
         VALUES ($1, $2, 'live', $3, $4, NOW())
         ON CONFLICT (user_id, asset, mode) DO NOTHING`,
        [userId, row.asset, row.amount, row.locked]
      );
    }
    const transfers = await tx.query('SELECT 1 FROM wallet_transfers WHERE user_id=$1 LIMIT 1', [userId]);
    if (transfers.rowCount === 0) {
      await tx.query(
        `INSERT INTO wallet_transfers
           (id, user_id, direction, asset, network, address, tx_hash, amount, fee, status, confirmations, required_confirmations, note, created_at, updated_at)
         VALUES ($1, $2, 'deposit', 'USDT', 'Tron (TRC-20)', 'welcome-credit', $3, 250, 0, 'completed', 20, 20, 'Welcome trading credit', NOW(), NOW())`,
        [crypto.randomUUID(), userId, 'welcome-' + userId.slice(0, 8)]
      );
    }
  });
}
