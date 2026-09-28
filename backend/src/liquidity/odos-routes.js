/**
 * Odos SOR proxy — production handlers (RR6-06).
 * Server forces referralCode from env; client cannot set fee.
 */
import axios from 'axios';
import express from 'express';

export function createOdosRouter({ config, quoteLimiter }) {
  const r = express.Router();
  const limit = quoteLimiter || ((req, _res, next) => next());

  r.post('/odos/quote', limit, async (req, res) => {
    try {
      const referral = Number(config.liquidity?.odosReferralCode) || 0;
      if (!(referral > 0)) {
        return res.status(503).json({
          error: 'odos_fee_unconfigured',
          message: 'Odos Instant Swap unavailable — GROM referralCode not configured',
        });
      }
      const base = String(config.liquidity?.odosUrl || 'https://api.odos.xyz').replace(/\/$/, '');
      const body = { ...(req.body && typeof req.body === 'object' ? req.body : {}), referralCode: referral };
      delete body.partnerFeeBps;
      delete body.feeAccount;
      const upstream = await axios.post(`${base}/sor/quote/v2`, body, {
        timeout: 8000,
        validateStatus: () => true,
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
          'user-agent': 'grom-exchange/1.0',
        },
      });
      res.status(upstream.status || 502).json(upstream.data);
    } catch (err) {
      res.status(502).json({ error: String(err?.message || err), code: 'odos_upstream' });
    }
  });

  r.post('/odos/assemble', limit, async (req, res) => {
    try {
      const base = String(config.liquidity?.odosUrl || 'https://api.odos.xyz').replace(/\/$/, '');
      const upstream = await axios.post(`${base}/sor/assemble`, req.body || {}, {
        timeout: 10000,
        validateStatus: () => true,
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
          'user-agent': 'grom-exchange/1.0',
        },
      });
      res.status(upstream.status || 502).json(upstream.data);
    } catch (err) {
      res.status(502).json({ error: String(err?.message || err), code: 'odos_assemble' });
    }
  });

  return r;
}

export default createOdosRouter;
