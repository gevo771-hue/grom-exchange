/**
 * AI Portfolio Coach — thin proxy to Anthropic's Claude API with the
 * authenticated user's portfolio context auto-injected into every message.
 *
 * POST /api/ai/coach { message, history }
 *   • Fetches the caller's balances + recent transfers from postgres.
 *   • Adds a system prompt with the portfolio snapshot.
 *   • Forwards to Claude (claude-haiku-4-5 by default, configurable).
 *   • Returns { reply, usage }.
 *
 * Env:
 *   ANTHROPIC_API_KEY   — required
 *   GROM_AI_MODEL       — default 'claude-haiku-4-5-20251001'
 *   GROM_AI_MAX_TOKENS  — default 900
 *
 * Rate-limited (10 req/min/user) to protect our Anthropic quota.
 * Never leaves the wallet address or transaction hashes in the model context —
 * only aggregated amounts and asset symbols.
 */
import express from 'express';
import rateLimit from 'express-rate-limit';
import { query } from '../db/pool.js';
import config from '../config/index.js';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

function systemPrompt(snapshot, lang) {
  const langLine = lang && lang !== 'en'
    ? `Respond in the user's language (${lang}). Be concise and friendly.`
    : 'Be concise and friendly.';
  return [
    `You are GROM AI Coach — a personal crypto trading assistant embedded in the GROM Exchange dashboard.`,
    `You have READ-ONLY visibility into the current user's portfolio (below). You may NOT execute trades, transfer funds, or read other users' data.`,
    ``,
    `# Portfolio snapshot`,
    JSON.stringify(snapshot, null, 2),
    ``,
    `# Rules`,
    `- Do not invent balances or trades. Only reference what's in the snapshot above.`,
    `- If asked to move funds or place a trade, explain how to do it via GROM's Swap / Send / Spot UI. Never claim to have executed anything.`,
    `- Give concrete actionable insight: sizing, hedge ideas, DCA cadence, risk observations.`,
    `- Flag risks proactively (leverage exposure, single-asset concentration, stale positions).`,
    `- Never provide financial advice as instruction — frame as observations and "you might consider…".`,
    `- If the user asks something outside crypto/trading, briefly redirect.`,
    langLine,
  ].join('\n');
}

async function loadPortfolioSnapshot(userId) {
  const bal = await query(
    `SELECT asset, mode, amount, locked FROM balances WHERE user_id=$1`,
    [userId]
  );
  const transfers = await query(
    `SELECT direction, asset, amount, status, note, created_at
       FROM wallet_transfers
      WHERE user_id=$1
      ORDER BY created_at DESC
      LIMIT 15`,
    [userId]
  );
  const settings = await query(
    `SELECT email FROM user_settings WHERE user_id=$1 LIMIT 1`,
    [userId]
  );
  return {
    balances: bal.rows.map((r) => ({ asset: r.asset, mode: r.mode, amount: Number(r.amount), locked: Number(r.locked) })),
    recentTransfers: transfers.rows.map((r) => ({ direction: r.direction, asset: r.asset, amount: Number(r.amount), status: r.status, note: r.note, at: r.created_at })),
    hasEmail: settings.rowCount > 0 && !!settings.rows[0].email,
    generatedAt: new Date().toISOString(),
  };
}

export function createAiRouter({ requireAuth }) {
  const r = express.Router();

  const chatLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'too_many_requests', retryAfterSec: 60 },
  });

  r.post('/coach', requireAuth, chatLimiter, async (req, res, next) => {
    try {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) return res.status(503).json({ error: 'ai_unavailable', detail: 'ANTHROPIC_API_KEY missing on server' });

      const { message, history, lang } = req.body || {};
      if (!message || typeof message !== 'string' || message.length > 4000) {
        return res.status(400).json({ error: 'message required (<= 4000 chars)' });
      }
      const historyArr = Array.isArray(history) ? history.slice(-8) : [];

      const snapshot = await loadPortfolioSnapshot(req.user.sub);
      const messages = [
        ...historyArr
          .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
          .map((m) => ({ role: m.role, content: String(m.content).slice(0, 4000) })),
        { role: 'user', content: message },
      ];

      const model = process.env.GROM_AI_MODEL || 'claude-haiku-4-5-20251001';
      const maxTokens = Number(process.env.GROM_AI_MAX_TOKENS || 900);

      const resp = await fetch(ANTHROPIC_URL, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          system: systemPrompt(snapshot, String(lang || '').slice(0, 8)),
          messages,
        }),
      });

      const text = await resp.text();
      let body;
      try { body = JSON.parse(text); } catch (_) { body = { raw: text }; }
      if (!resp.ok) {
        return res.status(502).json({ error: 'ai_upstream', status: resp.status, detail: body?.error?.message || 'anthropic failed' });
      }

      const reply = (body?.content || [])
        .filter((c) => c.type === 'text')
        .map((c) => c.text)
        .join('\n')
        .trim();

      res.json({
        reply,
        usage: body?.usage || null,
        model: body?.model || model,
        snapshotAt: snapshot.generatedAt,
      });
    } catch (err) {
      next(err);
    }
  });

  return r;
}

export default createAiRouter;
