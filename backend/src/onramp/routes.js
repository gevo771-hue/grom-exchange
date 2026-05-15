import express from 'express';
import { query, withTx } from '../db/pool.js';
import { generateSignedUrl, parseWebhookEvent, verifyWebhook } from './moonpay.js';

export default function createOnrampRouter({ requireAuth, wsBroadcaster } = {}) {
  const r = express.Router();

  r.get('/url', requireAuth, async (req, res, next) => {
    try {
      const asset = String(req.query.asset || 'USDT').toUpperCase();
      const amount = Number(req.query.amount || 100);
      const fiat = String(req.query.fiat || 'EUR').toUpperCase();
      const { rows } = await query('SELECT wallet_address FROM users WHERE id=$1', [req.user.sub]);
      const walletAddress = rows[0]?.wallet_address || req.user.addr || '';
      res.json({
        provider: 'moonpay',
        url: generateSignedUrl({ userId: req.user.sub, walletAddress, currency: asset, defaultAmount: amount, fiatCurrency: fiat }),
      });
    } catch (err) { next(err); }
  });

  r.get('/orders', requireAuth, async (req, res, next) => {
    try {
      const { rows } = await query(
        `SELECT id, provider, external_order_id, asset, fiat_currency, fiat_amount,
                crypto_amount, status, wallet_address, created_at, updated_at
           FROM onramp_orders
          WHERE user_id=$1
          ORDER BY created_at DESC
          LIMIT 100`,
        [req.user.sub]
      );
      res.json({ orders: rows });
    } catch (err) { next(err); }
  });

  r.post('/webhook', async (req, res, next) => {
    try {
      const rawBody = req.rawBody || JSON.stringify(req.body || {});
      if (!verifyWebhook({ headers: req.headers, body: rawBody })) {
        return res.status(401).json({ error: 'invalid_signature' });
      }
      const payload = req.body || {};
      const event = parseWebhookEvent(payload);
      if (!event.externalOrderId) return res.status(400).json({ error: 'missing_external_order_id' });

      await withTx(async (tx) => {
        const userId = payload.data?.externalCustomerId || payload.externalCustomerId || payload.userId || null;
        await tx.query(
          `INSERT INTO onramp_orders(
             user_id, provider, external_order_id, asset, fiat_currency, fiat_amount,
             crypto_amount, status, wallet_address, payload, updated_at
           )
           VALUES ($1, 'moonpay', $2, $3, $4, $5, $6, $7, $8, $9::jsonb, NOW())
           ON CONFLICT (external_order_id) DO UPDATE SET
             status=EXCLUDED.status,
             crypto_amount=EXCLUDED.crypto_amount,
             payload=EXCLUDED.payload,
             updated_at=NOW()`,
          [
            userId,
            event.externalOrderId,
            event.asset,
            event.fiatCurrency,
            event.fiatAmount,
            event.cryptoAmount,
            event.status,
            event.walletAddress,
            JSON.stringify(payload),
          ]
        );

        if (event.status === 'completed' && userId && event.cryptoAmount > 0) {
          const existing = await tx.query(
            `SELECT id FROM wallet_transfers WHERE provider='moonpay' AND external_ref=$1 LIMIT 1`,
            [event.externalOrderId]
          );
          if (!existing.rows.length) {
            await tx.query(
              `INSERT INTO wallet_transfers(
                 user_id, direction, asset, network, address, tx_hash, amount, status,
                 confirmations, required_confirmations, provider, external_ref, settled_at, webhook_payload
               )
               VALUES ($1, 'deposit', $2, 'moonpay', $3, $4, $5, 'completed',
                       1, 1, 'moonpay', $6, NOW(), $7::jsonb)`,
              [userId, event.asset, event.walletAddress || 'moonpay', event.externalOrderId, event.cryptoAmount, event.externalOrderId, JSON.stringify(payload)]
            );
            await tx.query(
              `INSERT INTO balances(user_id, asset, mode, amount, locked)
               VALUES ($1, $2, 'live', $3, 0)
               ON CONFLICT (user_id, asset, mode)
               DO UPDATE SET amount=balances.amount + EXCLUDED.amount, updated_at=NOW()`,
              [userId, event.asset, event.cryptoAmount]
            );
            await tx.query(
              `INSERT INTO notifications_outbox(user_id, channel, template, payload, status)
               VALUES ($1, 'email', 'deposit_confirmed', $2::jsonb, 'queued')`,
              [userId, JSON.stringify({ asset: event.asset, amount: event.cryptoAmount, provider: 'moonpay' })]
            );
            wsBroadcaster?.broadcast?.(`balances.user.${userId}`, { event: 'deposit_confirmed', asset: event.asset, amount: event.cryptoAmount });
          }
        }
      });

      res.json({ ok: true });
    } catch (err) { next(err); }
  });

  return r;
}
