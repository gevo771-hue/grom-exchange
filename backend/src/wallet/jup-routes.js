/**
 * Standalone Jupiter Instant Swap proxy (quote/swap).
 * Mounted at /api so paths are /api/wallet/jup-quote and /api/wallet/jup-swap.
 * Safe to docker-cp onto prod without replacing legacy wallet/routes.js.
 */
import express from 'express';
import config from '../config/index.js';
import {
  JUP_MINT_RE,
  jupFeeBpsFromConfig,
  jupFeeModeFromConfig,
  jupiterEnabled,
  resolveJupFeeAccount,
  assertJupPlatformFee,
  attachJupQuoteMeta,
} from './jup-fee.js';

export function createJupRouter() {
  const r = express.Router();
  const jupQuoteCache = new Map();
  const jupLastGood = new Map();
  const JUP_QUOTE_TTL_MS = 20000;
  const JUP_STALE_MS = 120000;
  const JUP_BASES = ['https://lite-api.jup.ag/swap/v1', 'https://api.jup.ag/swap/v1'];

  async function jupUpstream(pathWithQuery, init = {}) {
    let lastErr = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      for (const base of JUP_BASES) {
        try {
          const upstream = await fetch(base + pathWithQuery, {
            ...init,
            headers: { accept: 'application/json', ...(init.headers || {}) },
            signal: AbortSignal.timeout(14000),
          });
          const text = await upstream.text();
          if (upstream.status === 429) {
            lastErr = Object.assign(new Error('jupiter_429'), { status: 429 });
            continue;
          }
          if (!upstream.ok) {
            lastErr = Object.assign(new Error('jupiter_' + upstream.status), { status: 502 });
            continue;
          }
          return JSON.parse(text);
        } catch (e) {
          lastErr = e;
        }
      }
      if (lastErr?.status === 429 && attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 1200 * (attempt + 1)));
      } else {
        break;
      }
    }
    throw lastErr || new Error('jupiter_upstream');
  }

  function jupFeeBps() {
    return jupFeeBpsFromConfig(config);
  }

  function jupMode() {
    return jupFeeModeFromConfig(config);
  }

  function assertJupiterAvailableOrThrow() {
    if (!jupiterEnabled(config)) {
      throw Object.assign(new Error('fee_config_unavailable'), {
        status: 503,
        code: 'fee_config_unavailable',
      });
    }
  }

  function assertQuotePlatformFeeOrThrow(quote) {
    if (jupMode() !== 'fee') return;
    const check = assertJupPlatformFee(quote, jupFeeBps());
    if (!check.ok) {
      throw Object.assign(new Error('jupiter_platform_fee_missing'), {
        status: 502,
        code: check.reason || 'jupiter_platform_fee_missing',
      });
    }
  }

  function assertSwapQuoteContext(quote, expected = {}) {
    if (!quote || typeof quote !== 'object') {
      throw Object.assign(new Error('invalid_jup_swap'), { status: 400, code: 'invalid_jup_swap' });
    }
    if (expected.inputMint && String(quote.inputMint) !== String(expected.inputMint)) {
      throw Object.assign(new Error('jup_quote_context_mismatch'), { status: 409, code: 'jup_quote_context_mismatch' });
    }
    if (expected.outputMint && String(quote.outputMint) !== String(expected.outputMint)) {
      throw Object.assign(new Error('jup_quote_context_mismatch'), { status: 409, code: 'jup_quote_context_mismatch' });
    }
    if (expected.inAmount != null && String(quote.inAmount) !== String(expected.inAmount)) {
      throw Object.assign(new Error('jup_quote_context_mismatch'), { status: 409, code: 'jup_quote_context_mismatch' });
    }
    if (expected.slippageBps != null && Number(quote.slippageBps) !== Number(expected.slippageBps)) {
      throw Object.assign(new Error('jup_quote_context_mismatch'), { status: 409, code: 'jup_quote_context_mismatch' });
    }
    if (!Array.isArray(quote.routePlan)) {
      throw Object.assign(new Error('jup_quote_context_mismatch'), { status: 409, code: 'jup_quote_missing_route' });
    }
    assertQuotePlatformFeeOrThrow(quote);
  }

  async function requireJupFee(inputMint, outputMint) {
    const selected = await resolveJupFeeAccount(config, inputMint, outputMint);
    if (!selected) {
      throw Object.assign(new Error('fee_config_unavailable'), {
        status: 503,
        code: 'fee_config_unavailable',
      });
    }
    return selected;
  }

  r.get('/wallet/jup-quote', async (req, res) => {
    try {
      const inputMint = String(req.query.inputMint || '');
      const outputMint = String(req.query.outputMint || '');
      const amount = String(req.query.amount || '');
      const slippageBps = String(req.query.slippageBps || '50');
      if (!JUP_MINT_RE.test(inputMint) || !JUP_MINT_RE.test(outputMint) || !/^\d{1,24}$/.test(amount)) {
        return res.status(400).json({ error: 'invalid_jup_quote' });
      }
      if (!/^\d{1,4}$/.test(slippageBps) || Number(slippageBps) > 5000) {
        return res.status(400).json({ error: 'invalid_jup_slippage' });
      }
      try {
        assertJupiterAvailableOrThrow();
      } catch (_) {
        return res.status(503).json({
          error: 'fee_config_unavailable',
          message: 'Jupiter Instant Swap unavailable — set GROM_JUP_FEE_MODE=free|fee (and fee infra when fee)',
        });
      }
      const mode = jupMode();
      let feePick = null;
      if (mode === 'fee') {
        try {
          feePick = await requireJupFee(inputMint, outputMint);
        } catch (_) {
          return res.status(503).json({
            error: 'fee_config_unavailable',
            message: 'Jupiter Instant Swap unavailable — no GROM fee token account for this mint pair',
          });
        }
      }
      const qs = new URLSearchParams({
        inputMint, outputMint, amount, slippageBps,
        swapMode: 'ExactIn',
        onlyDirectRoutes: 'false',
        asLegacyTransaction: 'false',
      });
      if (mode === 'fee') {
        qs.set('platformFeeBps', String(jupFeeBps()));
      }
      const cacheKey = qs.toString() + (feePick ? `|fee:${feePick.feeAccount}` : '|free');
      const hit = jupQuoteCache.get(cacheKey);
      if (hit && (Date.now() - hit.at) < JUP_QUOTE_TTL_MS) {
        return res.json(hit.body);
      }
      try {
        const upstream = await jupUpstream('/quote?' + qs.toString());
        assertQuotePlatformFeeOrThrow(upstream);
        const meta = {
          _gromFeeBps: jupFeeBps(),
          _gromFeeMode: mode,
        };
        if (feePick) {
          meta._gromFeeAccount = feePick.feeAccount;
          meta._gromFeeMint = feePick.matchedMint;
        }
        const body = attachJupQuoteMeta(upstream, meta);
        jupQuoteCache.set(cacheKey, { at: Date.now(), body });
        jupLastGood.set(cacheKey, { at: Date.now(), body });
        if (jupQuoteCache.size > 400) {
          const oldest = jupQuoteCache.keys().next().value;
          jupQuoteCache.delete(oldest);
        }
        return res.json(body);
      } catch (err) {
        if (err?.code === 'missing_platformFee'
          || err?.code === 'jupiter_platform_fee_missing'
          || err?.code === 'platformFee_bps_mismatch'
          || err?.code === 'platformFee_amount_invalid'
          || (err?.code && String(err.code).startsWith('platformFee'))) {
          return res.status(502).json({
            error: 'jupiter_platform_fee_missing',
            message: 'Jupiter quote missing verified platformFee',
            reason: err.code,
          });
        }
        const stale = jupLastGood.get(cacheKey);
        if (stale && (Date.now() - stale.at) < JUP_STALE_MS) {
          return res.json(stale.body);
        }
        throw err;
      }
    } catch (err) {
      if (err?.code === 'fee_config_unavailable' || err?.status === 503) {
        return res.status(503).json({
          error: 'fee_config_unavailable',
          message: 'Jupiter Instant Swap unavailable',
        });
      }
      if (err?.code === 'jupiter_platform_fee_missing'
        || (err?.status === 502 && String(err.message || '').includes('platform'))) {
        return res.status(502).json({
          error: 'jupiter_platform_fee_missing',
          message: 'Jupiter quote missing verified platformFee',
        });
      }
      res.status(err?.status === 429 ? 429 : 502).json({
        error: 'jupiter_upstream',
        message: String(err?.message || err),
      });
    }
  });

  r.post('/wallet/jup-swap', async (req, res) => {
    try {
      const quoteResponse = req.body?.quoteResponse;
      const userPublicKey = String(req.body?.userPublicKey || '');
      if (!quoteResponse || typeof quoteResponse !== 'object' || !JUP_MINT_RE.test(userPublicKey)) {
        return res.status(400).json({ error: 'invalid_jup_swap' });
      }
      try {
        assertJupiterAvailableOrThrow();
      } catch (_) {
        return res.status(503).json({
          error: 'fee_config_unavailable',
          message: 'Jupiter Instant Swap unavailable — set GROM_JUP_FEE_MODE=free|fee (and fee infra when fee)',
        });
      }
      const mode = jupMode();
      const inMint = String(quoteResponse.inputMint || '');
      const outMint = String(quoteResponse.outputMint || '');
      let feePick = null;
      if (mode === 'fee') {
        try {
          feePick = await requireJupFee(inMint, outMint);
        } catch (_) {
          return res.status(503).json({
            error: 'fee_config_unavailable',
            message: 'Jupiter Instant Swap unavailable — no GROM fee token account for this mint pair',
          });
        }
      }
      try {
        assertSwapQuoteContext(quoteResponse, {
          inputMint: inMint,
          outputMint: outMint,
          inAmount: quoteResponse.inAmount,
          slippageBps: quoteResponse.slippageBps,
        });
      } catch (ctxErr) {
        return res.status(ctxErr.status || 409).json({
          error: ctxErr.code || 'jup_quote_context_mismatch',
          message: String(ctxErr.message || ctxErr),
        });
      }
      const {
        _gromFeeAccount,
        _gromFeeMint,
        _gromFeeBps,
        _gromFeeMode,
        ...cleanQuote
      } = quoteResponse;
      void _gromFeeAccount; void _gromFeeMint; void _gromFeeBps; void _gromFeeMode;
      const payload = {
        quoteResponse: cleanQuote,
        userPublicKey,
        wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: 'auto',
      };
      if (feePick) {
        payload.feeAccount = feePick.feeAccount;
      }
      const body = await jupUpstream('/swap', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!body?.swapTransaction) {
        return res.status(502).json({ error: 'jupiter_no_tx' });
      }
      const out = {
        swapTransaction: body.swapTransaction,
        lastValidBlockHeight: body.lastValidBlockHeight,
        _gromFeeBps: jupFeeBps(),
        _gromFeeMode: mode,
      };
      if (feePick) {
        out._gromFeeAccount = feePick.feeAccount;
        out._gromFeeMint = feePick.matchedMint;
      }
      res.json(out);
    } catch (err) {
      if (err?.code === 'fee_config_unavailable' || err?.status === 503) {
        return res.status(503).json({
          error: 'fee_config_unavailable',
          message: 'Jupiter Instant Swap unavailable',
        });
      }
      res.status(err?.status === 429 ? 429 : 502).json({
        error: 'jupiter_upstream',
        message: String(err?.message || err),
      });
    }
  });

  return r;
}

export default createJupRouter;
