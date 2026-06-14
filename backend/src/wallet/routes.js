import crypto from 'node:crypto';
import express from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import config from '../config/index.js';
import { query, withTx } from '../db/pool.js';
import idempotencyMiddleware from '../middleware/idempotency.js';
import { verifyTotp } from '../utils/totp.js';
import { ensureDepositAddress as ensureBinanceDepositAddress } from './binance-onboarding.js';
import { ensureWelcomeWalletSeed } from './welcome-seed.js';

const STABLE_ASSETS = new Set(['USD', 'USDT', 'USDC']);
const DEMO_BALANCES = [
  { asset: 'BTC', amount: 0.09842, locked: 0 },
  { asset: 'ETH', amount: 0.482, locked: 0 },
  { asset: 'USDT', amount: 564.33, locked: 0 },
  { asset: 'SOL', amount: 1.36, locked: 0 },
];
const DEMO_TRANSFERS = [
  {
    direction: 'deposit',
    asset: 'USDT',
    network: 'Tron (TRC-20)',
    address: 'TKz8H4p2WqD3F9Y1R5k6N8mP4j7L2sV3bX',
    amount: 250,
    fee: 0,
    status: 'completed',
    confirmations: 20,
    required_confirmations: 20,
    note: 'Seeded demo deposit',
    tx_hash: '0xa28f71ce',
    created_at: 'NOW() - INTERVAL \'14 minutes\'',
  },
  {
    direction: 'withdrawal',
    asset: 'BTC',
    network: 'Bitcoin',
    address: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
    amount: 0.012,
    fee: 0.00008,
    status: 'pending',
    confirmations: 0,
    required_confirmations: 3,
    note: 'Batching with fee optimizer · ETA 3 min',
    tx_hash: null,
    created_at: 'NOW() - INTERVAL \'8 minutes\'',
  },
  {
    direction: 'deposit',
    asset: 'USDC',
    network: 'Arbitrum One',
    address: '0x9e2f4a8c1b5d7e3f6a9c2b4d8e1f5a7c9b2d4e6f',
    amount: 800,
    fee: 0,
    status: 'completed',
    confirmations: 10,
    required_confirmations: 10,
    note: 'Internal credit mirrored to trading balance',
    tx_hash: '0xbridgein',
    created_at: 'NOW() - INTERVAL \'2 hours\'',
  },
];

function toNum(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function verifyWebhookSignature(secret, rawBody, provided) {
  if (!secret) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody || '').digest('hex');
  return expected === String(provided || '');
}

function webhookReplayKey(provider, input) {
  const externalId = input.externalRef || input.transferId || input.txHash || null;
  return externalId ? { provider: String(provider || 'generic'), externalId: String(externalId) } : null;
}

function roundMoney(value) {
  return Math.round(toNum(value) * 100) / 100;
}

function formatMoney(value) {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatAssetAmount(asset, value) {
  const digits = STABLE_ASSETS.has(asset) ? 2 : value >= 1 ? 4 : 6;
  return `${value.toFixed(digits)} ${asset}`;
}

function formatHistoryTime(value) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));
}

async function getAssetUsdPrice(priceAggregator, asset) {
  if (STABLE_ASSETS.has(asset)) return 1;
  const price = await priceAggregator.getPrice(`${asset}/USDT`);
  return toNum(price);
}

async function creditTransferIfNeeded(tx, transferRow) {
  if (!transferRow || transferRow.direction !== 'deposit') return;
  if (transferRow.status === 'completed' || transferRow.settled_at) return;
  await tx.query(
    `INSERT INTO balances (user_id, asset, mode, amount, locked, updated_at)
     VALUES ($1, $2, 'live', $3, 0, NOW())
     ON CONFLICT (user_id, asset, mode)
     DO UPDATE SET amount = balances.amount + EXCLUDED.amount, updated_at = NOW()`,
    [transferRow.user_id, transferRow.asset, transferRow.amount]
  );
}

async function applySettlementUpdate(tx, input, payload) {
  const lookupValue = input.transferId || input.externalRef;
  const lookupField = input.transferId ? 'id' : 'external_ref';
  if (!lookupValue) {
    const err = new Error('transfer identifier required');
    err.status = 400;
    throw err;
  }
  const { rows } = await tx.query(
    `SELECT *
       FROM wallet_transfers
      WHERE ${lookupField}=$1
      FOR UPDATE`,
    [lookupValue]
  );
  const current = rows[0];
  if (!current) {
    const err = new Error('transfer not found');
    err.status = 404;
    throw err;
  }
  if (input.status === 'completed') {
    await creditTransferIfNeeded(tx, current);
  }
  const updated = await tx.query(
    `UPDATE wallet_transfers
       SET status=$2,
           tx_hash=COALESCE($3, tx_hash),
           confirmations=COALESCE($4, confirmations),
           required_confirmations=COALESCE($5, required_confirmations),
           note=COALESCE($6, note),
           provider=COALESCE($7, provider),
           webhook_payload=$8,
           updated_at=NOW(),
           settled_at=CASE WHEN $2='completed' THEN NOW() ELSE settled_at END
     WHERE id=$1
     RETURNING id, user_id, direction, asset, network, address, amount, fee, status, confirmations, required_confirmations, note, provider, external_ref, tx_hash, settled_at, created_at`,
    [
      current.id,
      input.status,
      input.txHash || null,
      input.confirmations ?? null,
      input.requiredConfirmations ?? null,
      input.note || null,
      input.provider || null,
      JSON.stringify(payload || {}),
    ]
  );
  return updated.rows[0];
}

async function ensureWebhookNotReplayed(tx, provider, input, payload) {
  const key = webhookReplayKey(provider, input);
  if (!key) return false;
  const payloadHash = sha256(JSON.stringify(payload || {}));
  const { rows } = await tx.query(
    `INSERT INTO webhook_events (provider, external_id, payload_hash)
     VALUES ($1, $2, $3)
     ON CONFLICT (provider, external_id) DO NOTHING
     RETURNING provider`,
    [key.provider, key.externalId, payloadHash]
  );
  return rows.length === 0;
}

export function summariseBalances(balances, priceMap) {
  let totalUsd = 0;
  let availableUsd = 0;
  const assets = balances.map((row) => {
    const amount = toNum(row.amount);
    const locked = toNum(row.locked);
    const priceUsd = toNum(priceMap[row.asset]);
    const valueUsd = amount * priceUsd;
    const available = Math.max(amount - locked, 0);
    totalUsd += valueUsd;
    availableUsd += available * priceUsd;
    return {
      asset: row.asset,
      amount,
      locked,
      priceUsd,
      valueUsd,
      displayBalance: formatAssetAmount(row.asset, amount),
      displayPrice: `$${formatMoney(priceUsd)}`,
      displayValue: `$${formatMoney(valueUsd)}`,
    };
  });

  assets.sort((a, b) => b.valueUsd - a.valueUsd);

  const totalBasis = totalUsd || 1;
  const allocation = assets.map((row) => ({
    asset: row.asset,
    sharePct: Number(((row.valueUsd / totalBasis) * 100).toFixed(1)),
  }));

  return {
    totalUsd: roundMoney(totalUsd),
    availableUsd: roundMoney(availableUsd),
    assets,
    allocation,
  };
}

export function buildHistoryItems({ transfers, binaryPositions, spotOrders }) {
  const items = [];

  for (const row of transfers) {
    const direction = row.direction === 'deposit' ? 'deposits' : 'withdrawals';
    items.push({
      kind: direction,
      occurredAt: row.created_at,
      assetLabel: `${row.direction === 'deposit' ? 'Deposit' : 'Withdraw'} · ${row.asset}${row.direction === 'withdrawal' ? ` → ${String(row.address).slice(0, 6)}…${String(row.address).slice(-4)}` : ''}`,
      stakeLabel: formatAssetAmount(row.asset, toNum(row.amount)),
      resultLabel: row.status,
      pnl: null,
      statusTone: row.status === 'completed' ? 'win' : row.status === 'failed' ? 'loss' : 'neutral',
      directionTone: row.direction === 'deposit' ? 'up' : 'down',
      timeLabel: formatHistoryTime(row.created_at),
    });
  }

  for (const row of binaryPositions) {
    const payout = toNum(row.payout);
    items.push({
      kind: 'binary',
      occurredAt: row.placed_at,
      assetLabel: `${row.asset} binary · ${row.duration_sec}s`,
      stakeLabel: `$${formatMoney(toNum(row.stake))}`,
      resultLabel: `${payout >= 0 ? '+' : '-'}$${formatMoney(Math.abs(payout))}`,
      pnl: payout,
      statusTone: payout >= 0 ? 'win' : 'loss',
      directionTone: row.direction === 'up' ? 'up' : 'down',
      timeLabel: formatHistoryTime(row.placed_at),
    });
  }

  for (const row of spotOrders) {
    const amount = toNum(row.amount);
    const filled = toNum(row.filled || row.amount);
    const price = toNum(row.price);
    const notional = filled * price;
    items.push({
      kind: 'spot',
      occurredAt: row.created_at,
      assetLabel: `Spot ${row.side === 'buy' ? 'Buy' : 'Sell'} · ${filled.toFixed(4)} ${String(row.pair).split('/')[0]}`,
      stakeLabel: `$${formatMoney(notional)}`,
      resultLabel: row.status || 'filled',
      pnl: null,
      statusTone: 'win',
      directionTone: row.side === 'buy' ? 'up' : 'down',
      timeLabel: formatHistoryTime(row.created_at),
    });
  }

  return items.sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt));
}

async function ensureDevWalletSeed(userId) {
  await ensureWelcomeWalletSeed(userId);
  if (config.env === 'production') return;

  const seededOrders = await query('SELECT 1 FROM spot_orders WHERE user_id=$1 LIMIT 1', [userId]);
  if (seededOrders.rowCount === 0) {
    await query(
      `INSERT INTO spot_orders (user_id, pair, side, type, price, amount, filled, status, created_at)
       VALUES
         ($1, 'BTC/USDT', 'buy', 'limit', 104218.40, 0.005, 0.005, 'filled', NOW() - INTERVAL '15 hours'),
         ($1, 'ETH/USDT', 'sell', 'market', 3684.15, 0.012, 0.012, 'filled', NOW() - INTERVAL '20 hours')`,
      [userId]
    );
  }
}

const withdrawSchema = z.object({
  asset: z.string().min(2).max(12),
  network: z.string().min(2).max(64),
  address: z.string().min(10).max(128),
  amount: z.number().positive().max(1_000_000),
});

const depositConfirmationSchema = z.object({
  asset: z.string().min(2).max(12),
  network: z.string().min(2).max(64),
  address: z.string().min(10).max(128),
  amount: z.number().positive().max(1_000_000).default(10),
});

const onrampConfirmationSchema = z.object({
  provider: z.string().min(2).max(32),
  fiatAmount: z.number().positive().max(1_000_000),
  fiatCurrency: z.string().min(3).max(8),
  asset: z.string().min(2).max(12),
  receiveAmount: z.number().positive().max(1_000_000),
});

const settlementWebhookSchema = z.object({
  transferId: z.string().uuid().optional(),
  externalRef: z.string().max(128).optional(),
  status: z.enum(['confirming', 'completed', 'failed', 'cancelled', 'review']),
  txHash: z.string().max(191).optional(),
  confirmations: z.number().int().min(0).optional(),
  requiredConfirmations: z.number().int().min(0).optional(),
  note: z.string().max(500).optional(),
  provider: z.string().max(64).optional(),
});

const whitelistSchema = z.object({
  asset: z.string().min(2).max(12).optional(),
  network: z.string().min(2).max(64),
  address: z.string().min(10).max(128),
  label: z.string().max(120).optional(),
});

const withdrawConfirmSchema = z.object({
  otp: z.string().regex(/^\d{6}$/),
  totpToken: z.string().regex(/^\d{6,8}$/).optional(),
});

const depositAddressSchema = z.object({
  asset: z.string().min(2).max(12),
  network: z.string().min(2).max(32),
});

function sha256(input) {
  return crypto.createHash('sha256').update(String(input || '')).digest('hex');
}

function generateEmailOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function riskFlagsForWithdrawal({ usdValue, whitelistAgeHours }) {
  const flags = [];
  if (usdValue >= config.wallet.withdrawManualApprovalUsdt) flags.push('manual_approval');
  if (usdValue >= config.wallet.withdrawDailyLimitUsdt) flags.push('daily_limit_threshold');
  if (whitelistAgeHours < config.wallet.withdrawAddressCooldownHours) flags.push('cooldown_active');
  return flags;
}

async function ensureIdempotency({ tx, userId, routeKey, requestHash, responseCode = null, responseBody = null }) {
  const existing = await tx.query(
    `SELECT response_code, response_body, request_hash
       FROM idempotency_keys
      WHERE user_id=$1 AND route_key=$2 AND expires_at > NOW()`,
    [userId, routeKey]
  );
  if (existing.rows[0]) {
    if (existing.rows[0].request_hash !== requestHash) {
      const err = new Error('idempotency_key_reused_with_different_payload');
      err.status = 409;
      throw err;
    }
    return existing.rows[0];
  }
  await tx.query(
    `INSERT INTO idempotency_keys (user_id, route_key, request_hash, response_code, response_body)
     VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [userId, routeKey, requestHash, responseCode, responseBody ? JSON.stringify(responseBody) : null]
  );
  return null;
}

async function saveIdempotencyResponse({ tx, userId, routeKey, responseCode, responseBody }) {
  await tx.query(
    `UPDATE idempotency_keys
        SET response_code=$3, response_body=$4::jsonb
      WHERE user_id=$1 AND route_key=$2`,
    [userId, routeKey, responseCode, JSON.stringify(responseBody)]
  );
}

async function appendWalletAudit(tx, {
  userId,
  transferId = null,
  type,
  asset = null,
  amount = null,
  beforeBalance = null,
  afterBalance = null,
  actor = 'system',
  reason = null,
  metadata = {},
}) {
  await tx.query(
    `INSERT INTO wallet_audit
       (user_id, transfer_id, type, asset, amount, before_balance, after_balance, actor, reason, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)`,
    [userId, transferId, type, asset, amount, beforeBalance, afterBalance, actor, reason, JSON.stringify(metadata || {})]
  );
}

function deriveMockDepositAddress({ userId, asset, network, index }) {
  const seed = sha256(`${userId}:${asset}:${network}:${index}`);
  const net = String(network || '').toUpperCase();
  if (net.includes('TRON') || net === 'TRX') return `T${seed.slice(0, 33)}`;
  if (net.includes('BTC')) return `bc1q${seed.slice(0, 38)}`;
  return `0x${seed.slice(0, 40)}`;
}

export function createWalletRouter({ requireAuth, priceAggregator, wsBroadcaster = null }) {
  const r = express.Router();
  const withdrawLimiter = rateLimit({
    windowMs: 60_000,
    max: 8,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.user?.sub || req.ip,
  });

  r.get('/wallet/deposit-address', requireAuth, async (req, res, next) => {
    try {
      const input = depositAddressSchema.parse(req.query);
      if (config.binance.useAsHotWallet) {
        const address = await ensureBinanceDepositAddress(req.user.sub, input.asset, input.network);
        return res.json({ depositAddress: address });
      }
      // SECURITY: when Binance hot-wallet is OFF, the fallback code below derives
      // a deterministic seed-based "mock" address (e.g. 0xbb67ec2a…) that GROM
      // has NO private key for. Sending real funds to it loses them. The legacy
      // wallet UI relied on this for screenshots, but the new web3-native UI
      // surfaces it to live users — so refuse to serve it in production unless
      // the operator explicitly opts in via GROM_ALLOW_MOCK_DEPOSIT_ADDRESS=true.
      const allowMock = ['1', 'true', 'TRUE'].includes(process.env.GROM_ALLOW_MOCK_DEPOSIT_ADDRESS || '');
      if (config.env === 'production' && !allowMock) {
        return res.status(503).json({
          error: 'custodial_deposit_unavailable',
          detail: 'GROM custodial deposits require BINANCE_HOT_WALLET=true (currently disabled). Use the non-custodial deposit flow instead.',
        });
      }
      const existing = await query(
        `SELECT asset, network, address, derivation_index, created_at
           FROM deposit_addresses
          WHERE user_id=$1 AND asset=$2 AND network=$3`,
        [req.user.sub, input.asset, input.network]
      );
      if (existing.rows[0]) return res.json({ depositAddress: existing.rows[0] });
      const created = await withTx(async (tx) => {
        const seq = await tx.query(
          `SELECT COALESCE(MAX(derivation_index), 0) + 1 AS next_idx
             FROM deposit_addresses
            WHERE user_id=$1`,
          [req.user.sub]
        );
        const derivationIndex = Number(seq.rows[0]?.next_idx || 1);
        const address = deriveMockDepositAddress({
          userId: req.user.sub,
          asset: input.asset,
          network: input.network,
          index: derivationIndex,
        });
        const { rows } = await tx.query(
          `INSERT INTO deposit_addresses (user_id, asset, network, address, derivation_index)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING asset, network, address, derivation_index, created_at`,
          [req.user.sub, input.asset, input.network, address, derivationIndex]
        );
        await appendWalletAudit(tx, {
          userId: req.user.sub,
          type: 'deposit_address_created',
          asset: input.asset,
          actor: 'user',
          reason: input.network,
          metadata: { address, derivation_index: derivationIndex },
        });
        return rows[0];
      });
      res.status(201).json({ depositAddress: created });
    } catch (err) {
      if (err.name === 'ZodError') return res.status(400).json({ error: 'validation', details: err.issues });
      next(err);
    }
  });

  r.get('/wallet/whitelist', requireAuth, async (req, res, next) => {
    try {
      const { rows } = await query(
        `SELECT id, asset, network, address, label, created_at, revoked_at
           FROM address_whitelist
          WHERE user_id=$1
          ORDER BY revoked_at NULLS FIRST, created_at DESC`,
        [req.user.sub]
      );
      res.json({ items: rows });
    } catch (err) { next(err); }
  });

  r.post('/wallet/whitelist', requireAuth, async (req, res, next) => {
    try {
      const input = whitelistSchema.parse(req.body);
      const row = await withTx(async (tx) => {
        const { rows } = await tx.query(
          `INSERT INTO address_whitelist (user_id, asset, network, address, label)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (user_id, network, address)
           DO UPDATE SET asset=COALESCE(EXCLUDED.asset, address_whitelist.asset),
                         label=COALESCE(EXCLUDED.label, address_whitelist.label),
                         revoked_at=NULL
           RETURNING id, asset, network, address, label, created_at, revoked_at`,
          [req.user.sub, input.asset || null, input.network, input.address, input.label || null]
        );
        await appendWalletAudit(tx, {
          userId: req.user.sub,
          type: 'withdraw_whitelist_add',
          asset: input.asset || null,
          actor: 'user',
          reason: input.network,
          metadata: { address: input.address, label: input.label || null },
        });
        return rows[0];
      });
      res.status(201).json({ item: row });
    } catch (err) {
      if (err.name === 'ZodError') return res.status(400).json({ error: 'validation', details: err.issues });
      next(err);
    }
  });

  r.delete('/wallet/whitelist/:id', requireAuth, async (req, res, next) => {
    try {
      const result = await withTx(async (tx) => {
        const { rows } = await tx.query(
          `UPDATE address_whitelist
              SET revoked_at=NOW()
            WHERE id=$1 AND user_id=$2 AND revoked_at IS NULL
          RETURNING id, asset, network, address, label`,
          [req.params.id, req.user.sub]
        );
        if (!rows[0]) return null;
        await appendWalletAudit(tx, {
          userId: req.user.sub,
          type: 'withdraw_whitelist_remove',
          asset: rows[0].asset,
          actor: 'user',
          reason: rows[0].network,
          metadata: { address: rows[0].address, label: rows[0].label || null },
        });
        return rows[0];
      });
      if (!result) return res.status(404).json({ error: 'not_found' });
      res.json({ ok: true, removed: result.id });
    } catch (err) { next(err); }
  });

  r.get('/wallet/overview', requireAuth, async (req, res, next) => {
    try {
      await ensureDevWalletSeed(req.user.sub);
      const [{ rows: balances }, { rows: transfers }] = await Promise.all([
        query(
          `SELECT asset, amount, locked, updated_at
           FROM balances
           WHERE user_id=$1 AND mode='live'
           ORDER BY updated_at DESC`,
          [req.user.sub]
        ),
        query(
          `SELECT id, direction, asset, network, address, tx_hash, amount, fee, status, confirmations, required_confirmations, note, created_at
           FROM wallet_transfers
           WHERE user_id=$1
           ORDER BY created_at DESC
           LIMIT 10`,
          [req.user.sub]
        ),
      ]);

      const priceMap = {};
      for (const row of balances) {
        priceMap[row.asset] = await getAssetUsdPrice(priceAggregator, row.asset);
      }

      const summary = summariseBalances(balances, priceMap);
      const pendingTransfers = transfers.filter((row) =>
        row.status === 'pending'
        || row.status === 'confirming'
        || row.status === 'review'
        || row.status === 'awaiting_otp'
        || row.status === 'awaiting_review'
        || row.status === 'approved'
        || row.status === 'queued'
        || row.status === 'signing'
        || row.status === 'broadcast'
      ).length;

      res.json({
        summary: {
          totalUsd: summary.totalUsd,
          totalUsdLabel: `$${formatMoney(summary.totalUsd)}`,
          availableUsd: summary.availableUsd,
          availableUsdLabel: `$${formatMoney(summary.availableUsd)}`,
          assetCount: summary.assets.length,
          pendingTransfers,
          bridgeRoutes: 6,
          deltaPct: 0,
          deltaUsd: 0,
          allocation: summary.allocation,
        },
        assets: summary.assets,
        transfers: transfers.map((row) => ({
          id: row.id,
          direction: row.direction,
          asset: row.asset,
          network: row.network,
          address: row.address,
          txHash: row.tx_hash,
          amount: toNum(row.amount),
          amountLabel: formatAssetAmount(row.asset, toNum(row.amount)),
          status: row.status,
          confirmations: row.confirmations,
          requiredConfirmations: row.required_confirmations,
          note: row.note,
          createdAt: row.created_at,
          createdAtLabel: formatHistoryTime(row.created_at),
        })),
      });
    } catch (err) { next(err); }
  });

  r.post('/wallet/withdrawals', requireAuth, withdrawLimiter, idempotencyMiddleware('wallet_withdrawals'), async (req, res, next) => {
    try {
      const input = withdrawSchema.parse(req.body);
      const idempotencyKey = String(req.headers['idempotency-key'] || '').trim() || null;
      const routeKey = idempotencyKey ? `withdrawal:create:${idempotencyKey}` : null;
      const requestHash = idempotencyKey ? sha256(JSON.stringify(input)) : null;
      const transfer = await withTx(async (tx) => {
        if (routeKey) {
          const cached = await ensureIdempotency({
            tx,
            userId: req.user.sub,
            routeKey,
            requestHash,
          });
          if (cached?.response_body) return cached.response_body.transfer;
        }
        const [balanceRes, whitelistRes] = await Promise.all([
          tx.query(
            `SELECT amount, locked
               FROM balances
              WHERE user_id=$1 AND asset=$2 AND mode='live'
              FOR UPDATE`,
            [req.user.sub, input.asset]
          ),
          tx.query(
            `SELECT id, created_at, revoked_at
               FROM address_whitelist
              WHERE user_id=$1 AND network=$2 AND address=$3 AND revoked_at IS NULL
              LIMIT 1`,
            [req.user.sub, input.network, input.address]
          ),
        ]);
        const balance = balanceRes.rows[0];
        if (!balance) {
          const err = new Error('asset balance not found');
          err.status = 404;
          throw err;
        }
        const wl = whitelistRes.rows[0];
        if (!wl) {
          const err = new Error('address_not_whitelisted');
          err.status = 400;
          throw err;
        }
        const amount = toNum(balance.amount);
        const locked = toNum(balance.locked);
        const available = Math.max(amount - locked, 0);
        if (input.amount > available) {
          const err = new Error('insufficient available balance');
          err.status = 400;
          throw err;
        }
        const usdPrice = await getAssetUsdPrice(priceAggregator, input.asset);
        const usdValue = input.amount * usdPrice;
        const daily = await tx.query(
          `SELECT COALESCE(SUM(amount * $2), 0) AS total
             FROM wallet_transfers
            WHERE user_id=$1
              AND direction='withdrawal'
              AND status IN ('approved','queued','signing','broadcast','completed','review','awaiting_review')
              AND created_at >= NOW() - INTERVAL '24 hours'`,
          [req.user.sub, usdPrice]
        );
        if (toNum(daily.rows[0]?.total) + usdValue > config.wallet.withdrawDailyLimitUsdt) {
          const err = new Error('daily_withdrawal_limit_exceeded');
          err.status = 409;
          throw err;
        }
        const whitelistAgeHours = Math.max(0, (Date.now() - new Date(wl.created_at).getTime()) / 36e5);
        if (whitelistAgeHours < config.wallet.withdrawAddressCooldownHours) {
          const err = new Error('withdraw_address_cooldown_active');
          err.status = 409;
          throw err;
        }
        const otp = generateEmailOtp();
        const otpHash = sha256(`${req.user.sub}:${otp}`);
        const approvalRequired = usdValue >= config.wallet.withdrawManualApprovalUsdt;
        const riskFlags = riskFlagsForWithdrawal({ usdValue, whitelistAgeHours });
        const { rows } = await tx.query(
          `INSERT INTO wallet_transfers
             (user_id, direction, asset, network, address, amount, fee, status, confirmations, required_confirmations, note, otp_code_hash, otp_expires_at, approval_required, risk_flags, idempotency_key)
           VALUES
             ($1, 'withdrawal', $2, $3, $4, $5, 0, 'awaiting_otp', 0, 1, $6, $7, NOW() + $8::interval, $9, $10::jsonb, $11)
           RETURNING id, direction, asset, network, address, amount, fee, status, confirmations, required_confirmations, note, created_at, approval_required, risk_flags`,
          [
            req.user.sub,
            input.asset,
            input.network,
            input.address,
            input.amount,
            approvalRequired ? 'Awaiting OTP, then admin review' : 'Awaiting email OTP confirmation',
            otpHash,
            `${config.wallet.withdrawOtpTtlMin} minutes`,
            approvalRequired,
            JSON.stringify(riskFlags),
            idempotencyKey,
          ]
        );
        await tx.query(
          `INSERT INTO notifications_outbox (user_id, channel, template, payload)
           VALUES ($1, 'email', 'withdraw_otp', $2::jsonb)`,
          [req.user.sub, JSON.stringify({
            asset: input.asset,
            amount: input.amount,
            network: input.network,
            address: input.address,
            otp,
            expires_min: config.wallet.withdrawOtpTtlMin,
          })]
        );
        await appendWalletAudit(tx, {
          userId: req.user.sub,
          transferId: rows[0].id,
          type: 'withdrawal_requested',
          asset: input.asset,
          amount: input.amount,
          beforeBalance: amount,
          afterBalance: amount,
          actor: 'user',
          reason: approvalRequired ? 'awaiting_otp_and_admin_review' : 'awaiting_otp',
          metadata: { network: input.network, address: input.address, usd_value: usdValue, risk_flags: riskFlags },
        });
        const payload = {
          transfer: {
            ...rows[0],
            amount: toNum(rows[0].amount),
            amountLabel: formatAssetAmount(rows[0].asset, toNum(rows[0].amount)),
            createdAtLabel: formatHistoryTime(rows[0].created_at),
          },
        };
        if (routeKey) {
          await saveIdempotencyResponse({
            tx,
            userId: req.user.sub,
            routeKey,
            responseCode: 201,
            responseBody: payload,
          });
        }
        return payload.transfer;
      });

      wsBroadcaster?.broadcast(`balances.user.${req.user.sub}`, {
        event: 'withdrawal_requested',
        transfer,
      });
      res.status(201).json({ transfer });
    } catch (err) {
      if (err.name === 'ZodError') return res.status(400).json({ error: 'validation', details: err.issues });
      if (err.status) return res.status(err.status).json({ error: err.message });
      next(err);
    }
  });

  r.post('/wallet/withdrawals/:id/confirm-otp', requireAuth, withdrawLimiter, idempotencyMiddleware('wallet_withdrawal_confirm_otp'), async (req, res, next) => {
    try {
      const input = withdrawConfirmSchema.parse(req.body || {});
      const transfer = await withTx(async (tx) => {
        const { rows } = await tx.query(
          `SELECT *
             FROM wallet_transfers
            WHERE id=$1 AND user_id=$2 AND direction='withdrawal'
            FOR UPDATE`,
          [req.params.id, req.user.sub]
        );
        const current = rows[0];
        if (!current) {
          const err = new Error('transfer_not_found');
          err.status = 404;
          throw err;
        }
        if (current.status !== 'awaiting_otp') {
          const err = new Error('withdrawal_not_awaiting_otp');
          err.status = 409;
          throw err;
        }
        if (current.otp_expires_at && new Date(current.otp_expires_at).getTime() < Date.now()) {
          const err = new Error('otp_expired');
          err.status = 410;
          throw err;
        }
        const otpHash = sha256(`${req.user.sub}:${input.otp}`);
        if (otpHash !== current.otp_code_hash) {
          const err = new Error('invalid_otp');
          err.status = 400;
          throw err;
        }
        const twoFa = await tx.query(
          `SELECT secret_base32, enabled, last_used_step
             FROM two_fa_secrets
            WHERE user_id=$1`,
          [req.user.sub]
        );
        const tf = twoFa.rows[0];
        if (tf?.enabled) {
          if (!input.totpToken) {
            const err = new Error('totp_required');
            err.status = 400;
            throw err;
          }
          const result = verifyTotp(tf.secret_base32, input.totpToken);
          if (!result.ok) {
            const err = new Error('invalid_totp');
            err.status = 400;
            throw err;
          }
          if (tf.last_used_step != null && Number(tf.last_used_step) === Number(result.step)) {
            const err = new Error('totp_replay');
            err.status = 409;
            throw err;
          }
          await tx.query(
            `UPDATE two_fa_secrets SET last_used_step=$2, updated_at=NOW() WHERE user_id=$1`,
            [req.user.sub, result.step]
          );
        }
        const balanceRes = await tx.query(
          `SELECT amount, locked
             FROM balances
            WHERE user_id=$1 AND asset=$2 AND mode='live'
            FOR UPDATE`,
          [req.user.sub, current.asset]
        );
        const balance = balanceRes.rows[0];
        if (!balance) {
          const err = new Error('asset balance not found');
          err.status = 404;
          throw err;
        }
        const beforeAmount = toNum(balance.amount);
        const available = Math.max(beforeAmount - toNum(balance.locked), 0);
        if (toNum(current.amount) > available) {
          const err = new Error('insufficient_available_balance');
          err.status = 409;
          throw err;
        }
        await tx.query(
          `UPDATE balances
              SET amount = amount - $3, updated_at = NOW()
            WHERE user_id=$1 AND asset=$2 AND mode='live'`,
          [req.user.sub, current.asset, current.amount]
        );
        const nextStatus = current.approval_required ? 'awaiting_review' : 'queued';
        const updated = await tx.query(
          `UPDATE wallet_transfers
              SET status=$2,
                  otp_confirmed_at=NOW(),
                  note=$3,
                  updated_at=NOW()
            WHERE id=$1
          RETURNING id, direction, asset, network, address, amount, fee, status, confirmations, required_confirmations, note, created_at, approval_required, risk_flags`,
          [
            current.id,
            nextStatus,
            current.approval_required ? 'Flagged for admin review' : 'Queued for signer broadcast',
          ]
        );
        if (!current.approval_required) {
          await tx.query(
            `INSERT INTO withdrawal_queue (transfer_id, user_id, asset, network, address, amount, idempotency_key, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'queued')
             ON CONFLICT (transfer_id) DO NOTHING`,
            [current.id, req.user.sub, current.asset, current.network, current.address, current.amount, current.idempotency_key || null]
          );
        }
        await appendWalletAudit(tx, {
          userId: req.user.sub,
          transferId: current.id,
          type: 'withdrawal_otp_confirmed',
          asset: current.asset,
          amount: current.amount,
          beforeBalance: beforeAmount,
          afterBalance: beforeAmount - toNum(current.amount),
          actor: 'user',
          reason: current.approval_required ? 'review_required' : 'queued_for_signer',
          metadata: { network: current.network, address: current.address },
        });
        return updated.rows[0];
      });
      const payload = {
        transfer: {
          ...transfer,
          amount: toNum(transfer.amount),
          amountLabel: formatAssetAmount(transfer.asset, toNum(transfer.amount)),
          createdAtLabel: formatHistoryTime(transfer.created_at),
        },
      };
      wsBroadcaster?.broadcast(`balances.user.${req.user.sub}`, {
        event: 'withdrawal_otp_confirmed',
        transfer: payload.transfer,
      });
      res.json(payload);
    } catch (err) {
      if (err.name === 'ZodError') return res.status(400).json({ error: 'validation', details: err.issues });
      if (err.status) return res.status(err.status).json({ error: err.message });
      next(err);
    }
  });

  r.post('/wallet/deposits/confirmations', requireAuth, async (req, res, next) => {
    try {
      const input = depositConfirmationSchema.parse(req.body);
      const { rows } = await query(
        `INSERT INTO wallet_transfers
           (user_id, direction, asset, network, address, amount, fee, status, confirmations, required_confirmations, note)
         VALUES
           ($1, 'deposit', $2, $3, $4, $5, 0, 'confirming', 0, 1, 'Awaiting on-chain confirmations')
         RETURNING id, direction, asset, network, address, amount, status, confirmations, required_confirmations, note, created_at`,
        [req.user.sub, input.asset, input.network, input.address, input.amount]
      );
      wsBroadcaster?.broadcast(`balances.user.${req.user.sub}`, {
        event: 'deposit_confirmation_created',
        transfer: rows[0],
      });
      res.status(201).json({ transfer: rows[0] });
    } catch (err) {
      if (err.name === 'ZodError') return res.status(400).json({ error: 'validation', details: err.issues });
      next(err);
    }
  });

  r.post('/wallet/onramp/confirmations', requireAuth, async (req, res, next) => {
    try {
      const input = onrampConfirmationSchema.parse(req.body);
      const extRef = crypto.randomUUID();
      const { rows } = await query(
        `INSERT INTO wallet_transfers
           (user_id, direction, asset, network, address, amount, fee, status, confirmations, required_confirmations, note, provider, external_ref)
         VALUES
           ($1, 'deposit', $2, $3, 'embedded-wallet', $4, 0, 'confirming', 0, 1, $5, $6, $7)
         RETURNING id, direction, asset, network, address, amount, status, confirmations, required_confirmations, note, provider, external_ref, created_at`,
        [
          req.user.sub,
          input.asset,
          `${input.provider} on-ramp`,
          input.receiveAmount,
          `${input.fiatAmount} ${input.fiatCurrency} purchase initiated`,
          input.provider,
          extRef,
        ]
      );
      res.status(201).json({ transfer: rows[0] });
    } catch (err) {
      if (err.name === 'ZodError') return res.status(400).json({ error: 'validation', details: err.issues });
      next(err);
    }
  });

  r.post('/webhooks/wallet-settlement', async (req, res, next) => {
    try {
      const sig = req.headers['x-grom-signature'];
      if (!verifyWebhookSignature(config.webhooks.secret, req.rawBody, sig)) {
        return res.status(401).json({ error: 'bad signature' });
      }
      const input = settlementWebhookSchema.parse(req.body);
      const transfer = await withTx(async (tx) => {
        const replayed = await ensureWebhookNotReplayed(tx, input.provider || 'generic', input, req.body || {});
        if (replayed) return { replayed: true };
        return applySettlementUpdate(tx, input, req.body || {});
      });
      if (transfer?.replayed) return res.json({ ok: true, replayed: true });
      res.json({ transfer });
    } catch (err) {
      if (err.name === 'ZodError') return res.status(400).json({ error: 'validation', details: err.issues });
      if (err.status) return res.status(err.status).json({ error: err.message });
      next(err);
    }
  });

  r.post('/webhooks/moonpay', async (req, res, next) => {
    try {
      const sig = req.headers['x-moonpay-signature'] || req.headers['x-signature'];
      if (!verifyWebhookSignature(config.webhooks.moonpaySecret, req.rawBody, sig)) {
        return res.status(401).json({ error: 'bad signature' });
      }
      const input = settlementWebhookSchema.parse({
        transferId: req.body?.transferId,
        externalRef: req.body?.externalRef || req.body?.externalTransactionId || req.body?.id,
        status: req.body?.status,
        txHash: req.body?.txHash || req.body?.cryptoTransactionId,
        confirmations: req.body?.confirmations,
        requiredConfirmations: req.body?.requiredConfirmations,
        note: req.body?.note,
        provider: 'moonpay',
      });
      const transfer = await withTx(async (tx) => {
        const replayed = await ensureWebhookNotReplayed(tx, 'moonpay', input, req.body || {});
        if (replayed) return { replayed: true };
        return applySettlementUpdate(tx, input, req.body || {});
      });
      if (transfer?.replayed) return res.json({ ok: true, replayed: true });
      res.json({ ok: true, transfer });
    } catch (err) {
      if (err.name === 'ZodError') return res.status(400).json({ error: 'validation', details: err.issues });
      if (err.status) return res.status(err.status).json({ error: err.message });
      next(err);
    }
  });

  r.post('/webhooks/transak', async (req, res, next) => {
    try {
      const sig = req.headers['x-transak-signature'] || req.headers['x-signature'];
      if (!verifyWebhookSignature(config.webhooks.transakSecret, req.rawBody, sig)) {
        return res.status(401).json({ error: 'bad signature' });
      }
      const input = settlementWebhookSchema.parse({
        transferId: req.body?.transferId,
        externalRef: req.body?.externalRef || req.body?.widgetOrderId || req.body?.id,
        status: req.body?.status,
        txHash: req.body?.txHash || req.body?.transactionHash,
        confirmations: req.body?.confirmations,
        requiredConfirmations: req.body?.requiredConfirmations,
        note: req.body?.note,
        provider: 'transak',
      });
      const transfer = await withTx(async (tx) => {
        const replayed = await ensureWebhookNotReplayed(tx, 'transak', input, req.body || {});
        if (replayed) return { replayed: true };
        return applySettlementUpdate(tx, input, req.body || {});
      });
      if (transfer?.replayed) return res.json({ ok: true, replayed: true });
      res.json({ ok: true, transfer });
    } catch (err) {
      if (err.name === 'ZodError') return res.status(400).json({ error: 'validation', details: err.issues });
      if (err.status) return res.status(err.status).json({ error: err.message });
      next(err);
    }
  });

  r.get('/history', requireAuth, async (req, res, next) => {
    try {
      await ensureDevWalletSeed(req.user.sub);
      const limit = Math.min(parseInt(req.query.limit || '100', 10), 250);
      const [transfersRes, binaryRes, spotRes] = await Promise.all([
        query(
          `SELECT direction, asset, address, amount, status, created_at
           FROM wallet_transfers
           WHERE user_id=$1
           ORDER BY created_at DESC
           LIMIT $2`,
          [req.user.sub, limit]
        ),
        query(
          `SELECT p.direction, p.stake, p.payout, p.placed_at, r.asset, r.duration_sec
           FROM bo_positions p
           JOIN bo_rounds r ON r.id = p.round_id
           WHERE p.user_id=$1
           ORDER BY p.placed_at DESC
           LIMIT $2`,
          [req.user.sub, limit]
        ),
        query(
          `SELECT pair, side, price, amount, filled, status, created_at
           FROM spot_orders
           WHERE user_id=$1
           ORDER BY created_at DESC
           LIMIT $2`,
          [req.user.sub, limit]
        ),
      ]);

      const items = buildHistoryItems({
        transfers: transfersRes.rows,
        binaryPositions: binaryRes.rows,
        spotOrders: spotRes.rows,
      }).slice(0, limit);

      res.json({ items });
    } catch (err) { next(err); }
  });

  return r;
}

export default createWalletRouter;
