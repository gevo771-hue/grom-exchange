/**
 * Admin / back-office actions.
 *
 * Auth: requires JWT with `role=admin` on the user record.
 * Endpoints:
 *   POST /api/admin/kyc/:userId                  — approve | limit | block
 *   GET  /api/admin/kyc/queue
 *   GET  /api/admin/audit/recent
 *   GET  /api/admin/withdrawals?status=awaiting_review
 *   POST /api/admin/withdrawals/:id/approve
 *   POST /api/admin/withdrawals/:id/reject
 *   GET  /api/admin/wallet/reserves
 *   POST /api/admin/wallet/sweep-now
 *   GET  /api/admin/notifications/dead-letters
 */
import express from 'express';
import { z } from 'zod';
import { query, withTx } from '../db/pool.js';
import { getReserveSnapshot, triggerSweepNow } from '../wallet/queue-worker.js';
import { clearTemplateCache } from '../notifications/template-renderer.js';
import { signAndBroadcastWithdrawal } from '../wallet/signers/index.js';
import { getMarketMakerService } from '../services/market-maker/registry.js';
import { binance } from '../integrations/binance/client.js';
import config from '../config/index.js';
import { sendEmail } from '../notifications/sendgrid.js';

async function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') return res.status(403).json({ error: 'admin_required' });
  try {
    const twoFa = await query(`SELECT enabled FROM two_fa_secrets WHERE user_id=$1`, [req.user.sub]);
    if (config.env === 'production' && !twoFa.rows[0]?.enabled) return res.status(403).json({ error: 'admin_2fa_required' });
  } catch (err) {
    if (err.code !== '42P01') return next(err);
  }
  return next();
}

function ipAllowed(req) {
  if (!config.admin.ipAllowlist.length) return true;
  const ip = String(req.ip || req.headers['x-forwarded-for'] || '').replace(/^::ffff:/, '');
  return config.admin.ipAllowlist.includes(ip);
}

function requireAdminIp(req, res, next) {
  if (!ipAllowed(req)) return res.status(403).json({ error: 'admin_ip_not_allowed' });
  next();
}

function auditAdminAction(req, res, next) {
  res.on('finish', () => {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return;
    query(
      `INSERT INTO admin_audit_log(actor_id, action, target_id, target_type, payload, ip, ua)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7)`,
      [
        req.user?.sub || null,
        `${req.method} ${req.path}`,
        req.params?.id || req.params?.userId || req.params?.pair || req.params?.product || null,
        req.path.split('/')[1] || 'admin',
        JSON.stringify({ body: req.body || {}, status: res.statusCode }),
        req.ip || null,
        req.headers['user-agent'] || null,
      ]
    ).catch(() => {});
  });
  next();
}

function requireReason(input) {
  if (!String(input.reason || '').trim()) {
    const err = new Error('reason_required');
    err.status = 400;
    throw err;
  }
}

const kycSchema = z.object({
  action: z.enum(['approve', 'limit', 'block']),
  reason: z.string().max(500).optional(),
  metadata: z.record(z.any()).optional(),
}).strict();

const VALID_STATUS = { approve: 'verified', limit: 'pending', block: 'rejected' };
const withdrawalReviewSchema = z.object({
  action: z.enum(['approve', 'reject']),
  reason: z.string().max(500).optional(),
}).strict();
const sweepSchema = z.object({
  assets: z.array(z.string().min(2).max(12)).max(20).optional(),
  dryRun: z.boolean().optional().default(false),
}).strict();
const testBroadcastSchema = z.object({
  asset: z.string().min(2).max(12),
  network: z.string().min(2).max(20),
  to: z.string().min(8).max(160),
  amount: z.number().positive(),
}).strict();
const emailTemplateSchema = z.object({
  subject_tpl: z.string().min(1).max(500),
  html_tpl: z.string().min(1).max(20_000),
  text_tpl: z.string().min(1).max(10_000),
}).strict();
const marketMakerToggleSchema = z.object({
  enabled: z.boolean(),
  reason: z.string().max(500).optional(),
}).strict();
const marketMakerPairSchema = z.object({
  spreadBps: z.number().positive().max(500).optional(),
  sizeBase: z.number().positive().max(1_000_000).optional(),
  maxPositionBase: z.number().positive().max(1_000_000).optional(),
}).strict();
const binanceTestCallSchema = z.object({
  method: z.enum(['getAccountStatus', 'getWithdrawHistory']),
  params: z.record(z.any()).optional().default({}),
}).strict();
const reasonSchema = z.object({ reason: z.string().min(3).max(1000) }).strict();
const balanceAdjustSchema = z.object({
  asset: z.string().min(2).max(12),
  amount: z.number().refine((v) => v !== 0, 'amount_must_not_be_zero'),
  reason: z.string().min(3).max(1000),
}).strict();
const limitsSchema = z.object({
  dailyWithdrawalUsd: z.number().positive().optional(),
  weeklyWithdrawalUsd: z.number().positive().optional(),
}).strict();
const symbolSchema = z.object({
  takerFeeBps: z.number().nonnegative().max(1000).optional(),
  makerFeeBps: z.number().nonnegative().max(1000).optional(),
  minOrderSize: z.number().positive().optional(),
  maxLeverage: z.number().int().positive().max(1000).optional(),
  enabled: z.boolean().optional(),
}).strict();
const maintenanceSchema = z.object({
  enabled: z.boolean(),
  reason: z.string().min(3).max(1000),
}).strict();
const alertResolveSchema = z.object({ reason: z.string().min(3).max(1000) }).strict();
const emailTestSchema = z.object({ to: z.string().email().optional() }).strict();

export function createAdminRouter({ requireAuth }) {
  const r = express.Router();

  r.use(requireAuth, requireAdminIp, requireAdmin, auditAdminAction);

  r.get('/kyc/queue', async (_req, res, next) => {
    try {
      const { rows } = await query(
        `SELECT id, wallet_address AS address, kyc_status, created_at
           FROM users
           WHERE kyc_status IN ('pending')
           ORDER BY created_at ASC
           LIMIT 50`
      );
      res.json({ queue: rows });
    } catch (err) { next(err); }
  });

  r.post('/kyc/:userId', async (req, res, next) => {
    try {
      const input = kycSchema.parse(req.body || {});
      const { rows } = await query(
        `UPDATE users SET kyc_status=$2 WHERE id=$1 RETURNING id, kyc_status`,
        [req.params.userId, VALID_STATUS[input.action]]
      );
      if (!rows.length) return res.status(404).json({ error: 'user_not_found' });
      await query(
        `INSERT INTO kyc_events (user_id, actor_id, action, reason, metadata)
         VALUES ($1, $2, $3, $4, $5::jsonb)`,
        [req.params.userId, req.user.sub, input.action, input.reason || null, JSON.stringify(input.metadata || {})]
      );
      res.json({ user: rows[0] });
    } catch (err) {
      if (err.name === 'ZodError') return res.status(400).json({ error: 'validation', details: err.issues });
      next(err);
    }
  });

  r.get('/audit/recent', async (_req, res, next) => {
    try {
      const { rows } = await query(
        `SELECT user_id, actor_id, action, reason, created_at
           FROM kyc_events
           ORDER BY created_at DESC
           LIMIT 100`
      );
      res.json({ events: rows });
    } catch (err) { next(err); }
  });

  r.get('/withdrawals', async (req, res, next) => {
    try {
      const status = String(req.query.status || 'awaiting_review');
      const { rows } = await query(
        `SELECT id, user_id, asset, network, address, amount, status, note, risk_flags, created_at, otp_confirmed_at
           FROM wallet_transfers
          WHERE direction='withdrawal'
            AND approval_required=TRUE
            AND status=$1
          ORDER BY otp_confirmed_at ASC NULLS LAST, created_at ASC
          LIMIT 100`,
        [status]
      );
      res.json({ queue: rows });
    } catch (err) { next(err); }
  });

  async function reviewWithdrawal(req, res, next, action) {
    try {
      const input = withdrawalReviewSchema.parse({ ...(req.body || {}), action });
      const result = await withTx(async (tx) => {
        const { rows } = await tx.query(
          `SELECT *
             FROM wallet_transfers
            WHERE id=$1
              AND direction='withdrawal'
              AND approval_required=TRUE
            FOR UPDATE`,
          [req.params.id]
        );
        const current = rows[0];
        if (!current) return null;
        if (current.status !== 'awaiting_review') {
          const err = new Error('withdrawal_not_in_review');
          err.status = 409;
          throw err;
        }
        if (input.action === 'approve') {
          const updated = await tx.query(
            `UPDATE wallet_transfers
                SET status='approved', approved_at=NOW(), note=$2, updated_at=NOW()
              WHERE id=$1
            RETURNING id, user_id, asset, network, address, amount, status, approved_at, note`,
            [current.id, input.reason || 'Approved by admin']
          );
          await tx.query(
            `INSERT INTO withdrawal_queue (transfer_id, user_id, asset, network, address, amount, idempotency_key, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'queued')
             ON CONFLICT (transfer_id) DO NOTHING`,
            [current.id, current.user_id, current.asset, current.network, current.address, current.amount, current.idempotency_key || null]
          );
          await tx.query(
            `INSERT INTO wallet_audit
               (user_id, transfer_id, type, asset, amount, actor, reason, metadata)
             VALUES ($1, $2, 'withdrawal_manual_approved', $3, $4, $5, $6, $7::jsonb)`,
            [current.user_id, current.id, current.asset, current.amount, req.user.sub, input.reason || 'manual_approval', JSON.stringify({ network: current.network, address: current.address })]
          );
          await tx.query(
            `INSERT INTO notifications_outbox (user_id, channel, template, payload)
             VALUES ($1, 'email', 'withdraw_approved', $2::jsonb)`,
            [current.user_id, JSON.stringify({ transfer_id: current.id, asset: current.asset, amount: current.amount, network: current.network, address: current.address })]
          );
          return updated.rows[0];
        }

        const bal = await tx.query(
          `SELECT amount
             FROM balances
            WHERE user_id=$1 AND asset=$2 AND mode='live'
            FOR UPDATE`,
          [current.user_id, current.asset]
        );
        const before = Number(bal.rows[0]?.amount || 0);
        await tx.query(
          `UPDATE balances
              SET amount = amount + $3, updated_at=NOW()
            WHERE user_id=$1 AND asset=$2 AND mode='live'`,
          [current.user_id, current.asset, current.amount]
        );
        const updated = await tx.query(
          `UPDATE wallet_transfers
              SET status='rejected', note=$2, updated_at=NOW()
            WHERE id=$1
            RETURNING id, user_id, asset, network, address, amount, status, note`,
          [current.id, input.reason || 'Rejected by admin']
        );
        await tx.query(
          `INSERT INTO wallet_audit
             (user_id, transfer_id, type, asset, amount, before_balance, after_balance, actor, reason, metadata)
           VALUES ($1, $2, 'withdrawal_manual_rejected', $3, $4, $5, $6, $7, $8, $9::jsonb)`,
          [current.user_id, current.id, current.asset, current.amount, before, before + Number(current.amount || 0), req.user.sub, input.reason || 'manual_rejection', JSON.stringify({ network: current.network, address: current.address })]
        );
        await tx.query(
          `INSERT INTO notifications_outbox (user_id, channel, template, payload)
           VALUES ($1, 'email', 'withdraw_rejected', $2::jsonb)`,
          [current.user_id, JSON.stringify({ transfer_id: current.id, asset: current.asset, amount: current.amount, network: current.network, address: current.address, reason: input.reason || 'Rejected by admin' })]
        );
        return updated.rows[0];
      });
      if (!result) return res.status(404).json({ error: 'withdrawal_not_found' });
      res.json({ transfer: result });
    } catch (err) {
      if (err.name === 'ZodError') return res.status(400).json({ error: 'validation', details: err.issues });
      if (err.status) return res.status(err.status).json({ error: err.message });
      next(err);
    }
  }

  r.post('/withdrawals/:id/approve', (req, res, next) => reviewWithdrawal(req, res, next, 'approve'));
  r.post('/withdrawals/:id/reject', (req, res, next) => reviewWithdrawal(req, res, next, 'reject'));

  r.get('/wallet/reserves', async (_req, res, next) => {
    try {
      const reserves = await getReserveSnapshot();
      res.json({ reserves });
    } catch (err) {
      next(err);
    }
  });

  r.post('/wallet/sweep-now', async (req, res, next) => {
    try {
      const input = sweepSchema.parse(req.body || {});
      const sweeps = await triggerSweepNow(req.user.sub, input);
      const reserves = await getReserveSnapshot();
      res.json({ ok: true, dry_run: input.dryRun, sweeps, reserves });
    } catch (err) {
      if (err.name === 'ZodError') return res.status(400).json({ error: 'validation', details: err.issues });
      next(err);
    }
  });

  r.post('/wallet/test-broadcast', async (req, res, next) => {
    try {
      const input = testBroadcastSchema.parse(req.body || {});
      const hotWalletRes = await query(
        `SELECT *
           FROM hot_wallets
          WHERE asset=$1 AND network=$2 AND enabled=TRUE
          ORDER BY created_at ASC
          LIMIT 1`,
        [input.asset, input.network]
      );
      const result = await signAndBroadcastWithdrawal({
        asset: input.asset,
        network: input.network,
        to: input.to,
        amount: input.amount,
        hotWallet: hotWalletRes.rows[0] || null,
      });
      res.json({ ok: true, result });
    } catch (err) {
      if (err.name === 'ZodError') return res.status(400).json({ error: 'validation', details: err.issues });
      next(err);
    }
  });

  r.get('/notifications/dead-letters', async (req, res, next) => {
    try {
      const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
      const { rows } = await query(
        `SELECT id, user_id, channel, template, payload, attempts, last_error, created_at, sent_at
           FROM notifications_outbox
          WHERE status='dead_letter'
          ORDER BY created_at DESC
          LIMIT $1`,
        [limit]
      );
      res.json({ notifications: rows });
    } catch (err) {
      next(err);
    }
  });

  r.get('/notifications/recent', async (req, res, next) => {
    try {
      const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
      const channel = req.query.channel ? String(req.query.channel) : null;
      const params = [limit];
      let where = '';
      if (channel) {
        params.push(channel);
        where = 'WHERE channel=$2';
      }
      const { rows } = await query(
        `SELECT id, user_id, channel, template, status, provider, provider_message_id, provider_error, attempts, last_error, created_at, sent_at
           FROM notifications_outbox
          ${where}
          ORDER BY created_at DESC
          LIMIT $1`,
        params
      );
      res.json({ notifications: rows });
    } catch (err) {
      next(err);
    }
  });

  r.get('/email-templates', async (_req, res, next) => {
    try {
      const { rows } = await query(
        `SELECT template_key, subject_tpl, html_tpl, text_tpl, updated_at
           FROM email_templates
          ORDER BY template_key ASC`
      );
      res.json({ templates: rows });
    } catch (err) { next(err); }
  });

  r.put('/email-templates/:key', async (req, res, next) => {
    try {
      const input = emailTemplateSchema.parse(req.body || {});
      const { rows } = await query(
        `INSERT INTO email_templates (template_key, subject_tpl, html_tpl, text_tpl, updated_at)
         VALUES ($1,$2,$3,$4,NOW())
         ON CONFLICT (template_key)
         DO UPDATE SET subject_tpl=EXCLUDED.subject_tpl, html_tpl=EXCLUDED.html_tpl, text_tpl=EXCLUDED.text_tpl, updated_at=NOW()
         RETURNING template_key, subject_tpl, html_tpl, text_tpl, updated_at`,
        [req.params.key, input.subject_tpl, input.html_tpl, input.text_tpl]
      );
      clearTemplateCache();
      res.json({ template: rows[0] });
    } catch (err) {
      if (err.name === 'ZodError') return res.status(400).json({ error: 'validation', details: err.issues });
      next(err);
    }
  });

  r.get('/market-maker/status', async (_req, res) => {
    const service = getMarketMakerService();
    if (!service) return res.json({ enabled: false, configured: false, status: 'not_started' });
    res.json(service.status());
  });

  r.post('/market-maker/toggle', async (req, res, next) => {
    try {
      const input = marketMakerToggleSchema.parse(req.body || {});
      const service = getMarketMakerService();
      if (!service) return res.status(503).json({ error: 'market_maker_not_started' });
      const status = input.enabled
        ? await service.enable(input.reason || `enabled_by_${req.user.sub}`)
        : await service.disable(input.reason || `disabled_by_${req.user.sub}`);
      res.json(status);
    } catch (err) {
      if (err.name === 'ZodError') return res.status(400).json({ error: 'validation', details: err.issues });
      next(err);
    }
  });

  r.post('/market-maker/pair/:pair', async (req, res, next) => {
    try {
      const input = marketMakerPairSchema.parse(req.body || {});
      const service = getMarketMakerService();
      if (!service) return res.status(503).json({ error: 'market_maker_not_started' });
      const pair = decodeURIComponent(req.params.pair).toUpperCase();
      const updated = await service.updatePair(pair, input);
      if (!updated) return res.status(404).json({ error: 'pair_not_configured' });
      res.json({ pair: updated });
    } catch (err) {
      if (err.name === 'ZodError') return res.status(400).json({ error: 'validation', details: err.issues });
      next(err);
    }
  });

  r.get('/market-maker/recent-hedges', async (req, res, next) => {
    try {
      const service = getMarketMakerService();
      if (!service) return res.json({ hedges: [] });
      const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
      res.json({ hedges: await service.recentHedges(limit) });
    } catch (err) {
      next(err);
    }
  });

  r.get('/binance/status', async (_req, res, next) => {
    try {
      let accountStatus = null;
      try {
        accountStatus = await binance.getAccountStatus();
      } catch (err) {
        accountStatus = { error: err.message };
      }
      const [withdrawals, deposits] = await Promise.all([
        query(
          `SELECT COALESCE(SUM(amount),0) AS total, COUNT(*)::int AS count
             FROM wallet_transfers
            WHERE direction='withdrawal' AND provider='binance' AND created_at >= NOW() - INTERVAL '24 hours'`
        ),
        query(
          `SELECT COUNT(*)::int AS count
             FROM wallet_transfers
            WHERE direction='deposit' AND provider='binance' AND created_at >= NOW() - INTERVAL '1 hour'`
        ),
      ]);
      res.json({
        ...binance.status(),
        accountStatus,
        dailyWithdrawTotal: Number(withdrawals.rows[0]?.total || 0),
        withdrawalsLast24h: Number(withdrawals.rows[0]?.count || 0),
        depositsLastHour: Number(deposits.rows[0]?.count || 0),
      });
    } catch (err) {
      next(err);
    }
  });

  r.post('/binance/test-call', async (req, res, next) => {
    try {
      const input = binanceTestCallSchema.parse(req.body || {});
      const result = await binance[input.method](input.params || {});
      res.json({ ok: true, result });
    } catch (err) {
      if (err.name === 'ZodError') return res.status(400).json({ error: 'validation', details: err.issues });
      next(err);
    }
  });

  r.get('/binance/withdrawals', async (req, res, next) => {
    try {
      const status = String(req.query.status || 'pending');
      const { rows } = await query(
        `SELECT t.id, t.user_id, t.asset, t.network, t.address, t.amount, t.status, t.tx_hash,
                t.binance_withdraw_id, w.binance_status, w.polled_at, t.created_at
           FROM wallet_transfers t
           LEFT JOIN binance_withdrawal_log w ON w.transfer_id=t.id
          WHERE t.direction='withdrawal'
            AND t.binance_withdraw_id IS NOT NULL
            AND ($1='' OR t.status=$1 OR w.binance_status=$1)
          ORDER BY t.created_at DESC
          LIMIT 100`,
        [status === 'all' ? '' : status]
      );
      res.json({ withdrawals: rows });
    } catch (err) {
      next(err);
    }
  });

  r.get('/email/check-domain', async (_req, res) => {
    res.json({
      domain: config.email.domain,
      dkim: { status: 'manual_check_required', hint: 'Verify DKIM CNAME records in SendGrid dashboard.' },
      spf: { status: 'manual_check_required', hint: `TXT ${config.email.domain} should include SendGrid SPF include.` },
      dmarc: { status: 'manual_check_required', hint: `_dmarc.${config.email.domain} TXT policy should exist.` },
    });
  });

  r.post('/email/test', async (req, res, next) => {
    try {
      const input = emailTestSchema.parse(req.body || {});
      const result = await sendEmail({
        to: input.to || config.email.adminTo,
        subject: 'GROM SendGrid test',
        html: '<p>GROM SendGrid test email.</p>',
        text: 'GROM SendGrid test email.',
      });
      res.json(result);
    } catch (err) {
      if (err.name === 'ZodError') return res.status(400).json({ error: 'validation', details: err.issues });
      next(err);
    }
  });

  r.post('/maintenance/toggle', async (req, res, next) => {
    try {
      const input = maintenanceSchema.parse(req.body || {});
      const { rows } = await query(
        `INSERT INTO settings(key, value, updated_at)
         VALUES ('maintenance_mode', $1::jsonb, NOW())
         ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW()
         RETURNING key, value, updated_at`,
        [JSON.stringify(input.enabled)]
      );
      res.json({ maintenance: rows[0], reason: input.reason });
    } catch (err) {
      if (err.name === 'ZodError') return res.status(400).json({ error: 'validation', details: err.issues });
      next(err);
    }
  });

  r.get('/treasury/summary', async (_req, res, next) => {
    try {
      const [spot, futures, binary, insurance, mm] = await Promise.all([
        query(`SELECT COALESCE(SUM(fee_taker + fee_maker),0) AS revenue FROM spot_trades`),
        query(`SELECT COALESCE(SUM(funding_paid),0) AS revenue FROM futures_positions`),
        query(`SELECT COALESCE(SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END),0) AS revenue FROM bo_ledger WHERE kind='payout_loss'`),
        query(`SELECT COALESCE(SUM(balance),0) AS balance FROM futures_insurance`).catch(() => ({ rows: [{ balance: 0 }] })),
        query(`SELECT COALESCE(SUM(realised_pnl_usdt),0) AS pnl FROM mm_positions`).catch(() => ({ rows: [{ pnl: 0 }] })),
      ]);
      const byProduct = {
        spot: Number(spot.rows[0]?.revenue || 0),
        futures: Number(futures.rows[0]?.revenue || 0),
        binary: Number(binary.rows[0]?.revenue || 0),
      };
      res.json({
        totalRevenueUsd: byProduct.spot + byProduct.futures + byProduct.binary,
        byProduct,
        last24h: byProduct,
        last7d: byProduct,
        last30d: byProduct,
        housePnL: byProduct.binary,
        mmHedgeSlippage: Number(mm.rows[0]?.pnl || 0),
        insuranceFundUsdt: Number(insurance.rows[0]?.balance || 0),
      });
    } catch (err) { next(err); }
  });

  r.get('/treasury/timeseries', async (req, res, next) => {
    try {
      const from = req.query.from || '1970-01-01';
      const to = req.query.to || new Date().toISOString();
      const { rows } = await query(
        `SELECT day, SUM(revenue) AS revenue
           FROM (
             SELECT date_trunc('day', created_at) AS day, (fee_taker + fee_maker) AS revenue FROM spot_trades
             UNION ALL
             SELECT date_trunc('day', created_at) AS day, CASE WHEN amount < 0 THEN -amount ELSE 0 END AS revenue FROM bo_ledger WHERE kind='payout_loss'
           ) x
          WHERE day BETWEEN $1::timestamptz AND $2::timestamptz
          GROUP BY day
          ORDER BY day ASC`,
        [from, to]
      );
      res.json({ points: rows });
    } catch (err) { next(err); }
  });

  r.get('/users', async (req, res, next) => {
    try {
      const page = Math.max(parseInt(req.query.page || '1', 10), 1);
      const limit = 50;
      const search = `%${String(req.query.search || '').toLowerCase()}%`;
      const kyc = req.query.kyc ? String(req.query.kyc) : null;
      const status = req.query.status ? String(req.query.status) : null;
      const { rows } = await query(
        `SELECT id, wallet_address, kyc_status, risk_level, role, status, created_at, last_seen_at
           FROM users
          WHERE ($1='%%' OR LOWER(wallet_address) LIKE $1 OR id::text LIKE $1)
            AND ($2::text IS NULL OR kyc_status=$2)
            AND ($3::text IS NULL OR status=$3)
          ORDER BY created_at DESC
          LIMIT $4 OFFSET $5`,
        [search, kyc, status, limit, (page - 1) * limit]
      );
      res.json({ users: rows, page, limit });
    } catch (err) { next(err); }
  });

  r.get('/users/:id', async (req, res, next) => {
    try {
      const [user, balances, orders, audit] = await Promise.all([
        query(`SELECT id, wallet_address, chain_id, kyc_status, risk_level, role, status, created_at, last_seen_at FROM users WHERE id=$1`, [req.params.id]),
        query(`SELECT asset, mode, amount, locked, updated_at FROM balances WHERE user_id=$1 ORDER BY asset`, [req.params.id]),
        query(`SELECT id, pair, side, type, price, amount, filled, status, created_at FROM spot_orders WHERE user_id=$1 ORDER BY created_at DESC LIMIT 25`, [req.params.id]),
        query(`SELECT type, asset, amount, actor, reason, created_at FROM wallet_audit WHERE user_id=$1 ORDER BY created_at DESC LIMIT 25`, [req.params.id]),
      ]);
      if (!user.rows[0]) return res.status(404).json({ error: 'user_not_found' });
      res.json({ user: user.rows[0], balances: balances.rows, recentOrders: orders.rows, audit: audit.rows });
    } catch (err) { next(err); }
  });

  r.post('/users/:id/suspend', async (req, res, next) => {
    try {
      const input = reasonSchema.parse(req.body || {});
      const { rows } = await query(
        `UPDATE users SET status='suspended', suspended_at=NOW(), suspended_reason=$2 WHERE id=$1 RETURNING id, status, suspended_reason`,
        [req.params.id, input.reason]
      );
      await query(`DELETE FROM user_sessions WHERE user_id=$1`, [req.params.id]).catch(() => {});
      res.json({ user: rows[0] || null });
    } catch (err) {
      if (err.name === 'ZodError') return res.status(400).json({ error: 'validation', details: err.issues });
      next(err);
    }
  });

  r.post('/users/:id/unsuspend', async (req, res, next) => {
    try {
      const input = reasonSchema.parse(req.body || {});
      const { rows } = await query(
        `UPDATE users SET status='active', suspended_at=NULL, suspended_reason=NULL WHERE id=$1 RETURNING id, status`,
        [req.params.id]
      );
      res.json({ user: rows[0] || null, reason: input.reason });
    } catch (err) {
      if (err.name === 'ZodError') return res.status(400).json({ error: 'validation', details: err.issues });
      next(err);
    }
  });

  r.post('/users/:id/balance-adjust', async (req, res, next) => {
    try {
      const input = balanceAdjustSchema.parse(req.body || {});
      const result = await withTx(async (tx) => {
        const before = await tx.query(`SELECT amount FROM balances WHERE user_id=$1 AND asset=$2 AND mode='live' FOR UPDATE`, [req.params.id, input.asset]);
        const beforeAmount = Number(before.rows[0]?.amount || 0);
        const updated = await tx.query(
          `INSERT INTO balances(user_id, asset, mode, amount, locked, updated_at)
           VALUES ($1,$2,'live',$3,0,NOW())
           ON CONFLICT(user_id, asset, mode)
           DO UPDATE SET amount=balances.amount + EXCLUDED.amount, updated_at=NOW()
           RETURNING asset, amount`,
          [req.params.id, input.asset, input.amount]
        );
        await tx.query(
          `INSERT INTO wallet_audit(user_id, type, asset, amount, before_balance, after_balance, actor, reason)
           VALUES ($1,'admin_balance_adjust',$2,$3,$4,$5,$6,$7)`,
          [req.params.id, input.asset, input.amount, beforeAmount, Number(updated.rows[0].amount), req.user.sub, input.reason]
        );
        return updated.rows[0];
      });
      res.json({ balance: result });
    } catch (err) {
      if (err.name === 'ZodError') return res.status(400).json({ error: 'validation', details: err.issues });
      next(err);
    }
  });

  r.post('/users/:id/limits', async (req, res, next) => {
    try {
      const input = limitsSchema.parse(req.body || {});
      const { rows } = await query(
        `UPDATE users SET daily_withdrawal_usd=$2, weekly_withdrawal_usd=$3 WHERE id=$1 RETURNING id, daily_withdrawal_usd, weekly_withdrawal_usd`,
        [req.params.id, input.dailyWithdrawalUsd || null, input.weeklyWithdrawalUsd || null]
      );
      res.json({ user: rows[0] || null });
    } catch (err) {
      if (err.name === 'ZodError') return res.status(400).json({ error: 'validation', details: err.issues });
      next(err);
    }
  });

  r.post('/users/:id/force-logout', async (req, res, next) => {
    try {
      const input = reasonSchema.parse(req.body || {});
      const result = await query(`DELETE FROM user_sessions WHERE user_id=$1`, [req.params.id]).catch(() => ({ rowCount: 0 }));
      res.json({ ok: true, revoked: result.rowCount || 0, reason: input.reason });
    } catch (err) {
      if (err.name === 'ZodError') return res.status(400).json({ error: 'validation', details: err.issues });
      next(err);
    }
  });

  r.get('/markets/status', async (_req, res, next) => {
    try {
      const { rows } = await query(`SELECT product, paused, killed, reason, updated_at FROM product_status ORDER BY product`);
      res.json({ markets: rows });
    } catch (err) { next(err); }
  });

  async function setMarketStatus(req, res, next, state) {
    try {
      const input = reasonSchema.parse(req.body || {});
      const product = String(req.params.product || '').toLowerCase();
      if (!['spot', 'futures', 'binary'].includes(product)) return res.status(400).json({ error: 'invalid_product' });
      if (state === 'kill') {
        if (product === 'spot') await query(`UPDATE spot_orders SET status='cancelled', cancelled_at=NOW(), updated_at=NOW() WHERE status IN ('open','partial','pending_trigger')`);
        if (product === 'futures') await query(`UPDATE futures_orders SET status='cancelled', cancelled_at=NOW(), updated_at=NOW() WHERE status='open'`);
      }
      const { rows } = await query(
        `INSERT INTO product_status(product, paused, killed, reason, updated_by, updated_at)
         VALUES ($1,$2,$3,$4,$5,NOW())
         ON CONFLICT(product)
         DO UPDATE SET paused=EXCLUDED.paused, killed=EXCLUDED.killed, reason=EXCLUDED.reason, updated_by=EXCLUDED.updated_by, updated_at=NOW()
         RETURNING *`,
        [product, state !== 'resume', state === 'kill', input.reason, req.user.sub]
      );
      res.json({ market: rows[0] });
    } catch (err) {
      if (err.name === 'ZodError') return res.status(400).json({ error: 'validation', details: err.issues });
      next(err);
    }
  }
  r.post('/markets/:product/pause', (req, res, next) => setMarketStatus(req, res, next, 'pause'));
  r.post('/markets/:product/resume', (req, res, next) => setMarketStatus(req, res, next, 'resume'));
  r.post('/markets/:product/kill', (req, res, next) => setMarketStatus(req, res, next, 'kill'));

  r.get('/symbols', async (_req, res, next) => {
    try {
      const { rows } = await query(`SELECT * FROM symbols ORDER BY pair ASC`);
      res.json({ symbols: rows });
    } catch (err) { next(err); }
  });

  r.put('/symbols/:pair', async (req, res, next) => {
    try {
      const input = symbolSchema.parse(req.body || {});
      const pair = decodeURIComponent(req.params.pair).toUpperCase();
      const { rows } = await query(
        `INSERT INTO symbols(pair, taker_fee_bps, maker_fee_bps, min_order_size, max_leverage, enabled, updated_at)
         VALUES ($1,$2,$3,$4,$5,COALESCE($6, TRUE),NOW())
         ON CONFLICT(pair)
         DO UPDATE SET taker_fee_bps=COALESCE(EXCLUDED.taker_fee_bps, symbols.taker_fee_bps),
                       maker_fee_bps=COALESCE(EXCLUDED.maker_fee_bps, symbols.maker_fee_bps),
                       min_order_size=COALESCE(EXCLUDED.min_order_size, symbols.min_order_size),
                       max_leverage=COALESCE(EXCLUDED.max_leverage, symbols.max_leverage),
                       enabled=COALESCE(EXCLUDED.enabled, symbols.enabled),
                       updated_at=NOW()
         RETURNING *`,
        [pair, input.takerFeeBps ?? null, input.makerFeeBps ?? null, input.minOrderSize ?? null, input.maxLeverage ?? null, input.enabled ?? null]
      );
      res.json({ symbol: rows[0] });
    } catch (err) {
      if (err.name === 'ZodError') return res.status(400).json({ error: 'validation', details: err.issues });
      next(err);
    }
  });

  r.get('/audit', async (req, res, next) => {
    try {
      const { rows } = await query(
        `SELECT * FROM admin_audit_log
          WHERE ($1::uuid IS NULL OR actor_id=$1)
            AND ($2::text IS NULL OR action ILIKE '%' || $2 || '%')
            AND ($3::timestamptz IS NULL OR ts >= $3)
            AND ($4::timestamptz IS NULL OR ts <= $4)
          ORDER BY ts DESC
          LIMIT 100`,
        [req.query.actor || null, req.query.action || null, req.query.from || null, req.query.to || null]
      );
      res.json({ events: rows });
    } catch (err) { next(err); }
  });

  r.get('/alerts', async (req, res, next) => {
    try {
      const { rows } = await query(
        `SELECT * FROM alerts
          WHERE ($1::text IS NULL OR status=$1)
            AND ($2::text IS NULL OR severity=$2)
          ORDER BY ts DESC
          LIMIT 100`,
        [req.query.status || null, req.query.severity || null]
      );
      res.json({ alerts: rows });
    } catch (err) { next(err); }
  });

  r.post('/alerts/:id/resolve', async (req, res, next) => {
    try {
      const input = alertResolveSchema.parse(req.body || {});
      const { rows } = await query(
        `UPDATE alerts SET status='resolved', resolved_at=NOW(), resolved_by=$2, resolution=$3 WHERE id=$1 RETURNING *`,
        [req.params.id, req.user.sub, input.reason]
      );
      res.json({ alert: rows[0] || null });
    } catch (err) {
      if (err.name === 'ZodError') return res.status(400).json({ error: 'validation', details: err.issues });
      next(err);
    }
  });

  async function report(req, res, next, range) {
    try {
      const { rows } = await query(
        `SELECT direction, asset, status, COUNT(*)::int AS count, COALESCE(SUM(amount),0) AS amount
           FROM wallet_transfers
          WHERE created_at >= $1::timestamptz AND created_at < $2::timestamptz
          GROUP BY direction, asset, status
          ORDER BY direction, asset`,
        [range.from, range.to]
      );
      res.json({ from: range.from, to: range.to, transfers: rows });
    } catch (err) { next(err); }
  }

  r.get('/reports/daily', (req, res, next) => {
    const date = String(req.query.date || new Date().toISOString().slice(0, 10));
    report(req, res, next, { from: `${date}T00:00:00Z`, to: `${date}T23:59:59Z` });
  });

  r.get('/reports/monthly', (req, res, next) => {
    const month = String(req.query.month || new Date().toISOString().slice(0, 7));
    const from = `${month}-01T00:00:00Z`;
    const to = new Date(new Date(from).getTime() + 32 * 86400_000).toISOString().slice(0, 7) + '-01T00:00:00Z';
    report(req, res, next, { from, to });
  });

  return r;
}

export default createAdminRouter;
