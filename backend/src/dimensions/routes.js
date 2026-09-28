/**
 * Public + authenticated dimensions API for DefiLlama adapters.
 *
 * GET  /api/public/dimensions          — dailyVolume/dailyFees for [start,end)
 * GET  /api/public/dimensions/meta     — parent project + coverage (DB-backed)
 * POST /api/dimensions/report          — auth: report executed fill (untrusted)
 * POST /api/dimensions/confirm         — admin: promote / trusted upsert
 */
import express from 'express';
import {
  queryDailyDimensions,
  upsertFill,
  confirmFill,
  buildMetaPayload,
  PRODUCTS,
  LEDGER_PRODUCTS,
  CHAIN_KEY_BY_ID,
  INDEXED_FROM,
} from './store.js';
import { syncLifiDimensionFills } from './lifi-sync.js';

export default function createDimensionsRouter({ requireAuth }) {
  const router = express.Router();

  router.get('/public/dimensions/meta', async (_req, res) => {
    try {
      const payload = await buildMetaPayload();
      res.json(payload);
    } catch (err) {
      res.status(err.status || 503).json({
        ok: false,
        error: err.message || 'dimensions_store_unavailable',
        code: err.code || 'UPSTREAM_ERROR',
        indexedFrom: INDEXED_FROM.toISOString(),
        products: PRODUCTS,
        ledgerProducts: [...LEDGER_PRODUCTS],
        chains: CHAIN_KEY_BY_ID,
      });
    }
  });

  router.get('/public/dimensions', async (req, res) => {
    try {
      const product = String(req.query.product || 'swap');
      const startTimestamp = req.query.startTimestamp ?? req.query.start;
      const endTimestamp = req.query.endTimestamp ?? req.query.end;
      const chainId = req.query.chainId;
      const chainKey = req.query.chainKey || req.query.chain;

      const result = await queryDailyDimensions({
        product,
        chainId,
        chainKey,
        startTimestamp,
        endTimestamp,
      });
      res.json(result);
    } catch (err) {
      const status = err.status || 500;
      res.status(status).json({
        ok: false,
        error: err.message,
        code: err.code || 'ERROR',
        coverage: err.coverage || undefined,
      });
    }
  });

  /** Authenticated client reports a settlement candidate — never trusted / never auto-confirmed. */
  router.post('/dimensions/report', requireAuth, async (req, res) => {
    try {
      const b = req.body || {};
      const row = await upsertFill({
        product: b.product || 'swap',
        chainId: b.chainId ?? b.chain_id,
        chainKey: b.chainKey || b.chain_key,
        txHash: b.txHash || b.tx_hash || b.hash,
        logIndex: b.logIndex ?? b.log_index,
        fillId: b.fillId || b.fill_id,
        executedAt: b.executedAt || b.executed_at || b.at,
        router: b.router,
        attribution: b.attribution || 'client_report',
        volumeUsd: b.volumeUsd ?? b.volume_usd,
        feeUsd: b.feeUsd ?? b.fee_usd,
        tokenIn: b.tokenIn || b.token_in,
        tokenOut: b.tokenOut || b.token_out,
        amountIn: b.amountIn ?? b.amount_in,
        amountOut: b.amountOut ?? b.amount_out,
        decimalsIn: b.decimalsIn ?? b.decimals_in,
        decimalsOut: b.decimalsOut ?? b.decimals_out,
        status: 'reported',
        evidence: {
          ...(b.evidence || {}),
          source: 'client_report',
          note: 'Unverified — excluded from DefiLlama sums until confirmed.',
        },
        wallet: b.wallet || req.user?.wallet || null,
      }, { trusted: false });
      res.json({ ok: true, fill: row, counted: false });
    } catch (err) {
      res.status(err.status || 500).json({ ok: false, error: err.message });
    }
  });

  /** Admin confirms a fill with historical USD amounts (trusted path). */
  router.post('/dimensions/confirm', requireAuth, async (req, res) => {
    try {
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ ok: false, error: 'admin_required' });
      }
      const b = req.body || {};
      if (b.id) {
        const row = await confirmFill({
          id: b.id,
          volumeUsd: b.volumeUsd ?? b.volume_usd,
          feeUsd: b.feeUsd ?? b.fee_usd,
          evidence: { ...(b.evidence || {}), confirmedBy: req.user.sub },
        });
        if (!row) return res.status(404).json({ ok: false, error: 'not_found' });
        return res.json({ ok: true, fill: row, counted: true });
      }
      const row = await upsertFill({
        ...b,
        product: b.product || 'swap',
        chainId: b.chainId ?? b.chain_id,
        txHash: b.txHash || b.tx_hash || b.hash,
        status: 'confirmed',
        attribution: b.attribution || 'admin_confirm',
        evidence: { ...(b.evidence || {}), confirmedBy: req.user.sub },
        wallet: b.wallet,
      }, { trusted: true });
      res.json({ ok: true, fill: row, counted: true });
    } catch (err) {
      res.status(err.status || 500).json({ ok: false, error: err.message });
    }
  });

  /**
   * Admin: pull LiFi DONE transfers for integrator grom-exchange into confirmed ledger.
   * Requires explicit fromTimestamp so coverage windows are honest (not invented).
   */
  router.post('/dimensions/sync-lifi', requireAuth, async (req, res) => {
    try {
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ ok: false, error: 'admin_required' });
      }
      const fromTimestamp = req.body?.fromTimestamp ?? null;
      const toTimestamp = req.body?.toTimestamp ?? null;
      if (fromTimestamp == null) {
        return res.status(400).json({
          ok: false,
          error: 'fromTimestamp_required',
          note: 'Pass an explicit UTC second window so index coverage can be recorded honestly. toTimestamp must not be in the future and should end at a completed UTC day boundary.',
        });
      }
      const result = await syncLifiDimensionFills({ fromTimestamp, toTimestamp });
      res.json({ ok: true, ...result });
    } catch (err) {
      const incomplete = err.code === 'lifi_sync_incomplete'
        || err.code === 'lifi_coverage_write_incomplete';
      const badWindow = err.code === 'sync_to_in_future'
        || err.code === 'sync_to_beyond_completed_utc_day'
        || err.code === 'invalid_sync_window'
        || err.code === 'sync_window_before_indexed_from'
        || err.code === 'coverage_to_in_future';
      res.status(badWindow ? 400 : (incomplete ? 409 : 502)).json({
        ok: false,
        error: err.message || 'lifi_sync_failed',
        code: err.code || 'UPSTREAM_ERROR',
        details: err.details || undefined,
        results: err.results || undefined,
      });
    }
  });

  return router;
}
