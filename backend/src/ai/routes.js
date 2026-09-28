/**
 * AI Exchange Assistant — proxy to Anthropic Claude (v2).
 *
 * POST /api/ai/coach { message, history, lang, address?, memory?, uiContext? }
 * GET  /api/ai/capabilities
 * GET  /api/ai/fees
 * GET/POST memory (auth)
 * POST /api/ai/feedback (auth)
 */
import express from 'express';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { query } from '../db/pool.js';
import config from '../config/index.js';
import { CAPABILITIES, AI_PROMPT_VERSION } from './capabilities.js';
import { buildSystemPrompt } from './prompt.js';
import { extractCoachPayload, sanitizeAction } from './sanitize.js';
import { getFeeSnapshot, redactSnapshotForModel } from './tools.js';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

const AI_MEMORY_READY = { ok: false, promise: null };
const AI_FEEDBACK_READY = { ok: false, promise: null };

async function ensureAiMemoryTable() {
  if (AI_MEMORY_READY.ok) return true;
  if (!AI_MEMORY_READY.promise) {
    AI_MEMORY_READY.promise = query(`
      CREATE TABLE IF NOT EXISTS ai_user_memory (
        user_id     UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        events      JSONB NOT NULL DEFAULT '[]'::jsonb,
        top_types   JSONB NOT NULL DEFAULT '[]'::jsonb,
        notes       JSONB NOT NULL DEFAULT '[]'::jsonb,
        preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
        memory_enabled BOOLEAN NOT NULL DEFAULT TRUE,
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `).then(async () => {
      try {
        await query(`ALTER TABLE ai_user_memory ADD COLUMN IF NOT EXISTS preferences JSONB NOT NULL DEFAULT '{}'::jsonb`);
        await query(`ALTER TABLE ai_user_memory ADD COLUMN IF NOT EXISTS memory_enabled BOOLEAN NOT NULL DEFAULT TRUE`);
      } catch (_) {}
      AI_MEMORY_READY.ok = true;
      return true;
    }).catch((e) => {
      AI_MEMORY_READY.promise = null;
      throw e;
    });
  }
  await AI_MEMORY_READY.promise;
  return true;
}

async function ensureAiFeedbackTable() {
  if (AI_FEEDBACK_READY.ok) return true;
  if (!AI_FEEDBACK_READY.promise) {
    AI_FEEDBACK_READY.promise = query(`
      CREATE TABLE IF NOT EXISTS ai_response_feedback (
        id           UUID PRIMARY KEY,
        user_id      UUID REFERENCES users(id) ON DELETE SET NULL,
        response_id  TEXT NOT NULL,
        rating       SMALLINT NOT NULL CHECK (rating IN (-1, 1)),
        reason       TEXT,
        prompt_version TEXT,
        model        TEXT,
        latency_ms   INTEGER,
        task_type    TEXT,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (user_id, response_id)
      )
    `).then(() => {
      AI_FEEDBACK_READY.ok = true;
      return true;
    }).catch((e) => {
      AI_FEEDBACK_READY.promise = null;
      throw e;
    });
  }
  await AI_FEEDBACK_READY.promise;
  return true;
}

function normalizePreferences(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const out = {};
  if (src.lang) out.lang = String(src.lang).slice(0, 8);
  if (src.explainLevel) out.explainLevel = String(src.explainLevel).slice(0, 24);
  if (Array.isArray(src.favoriteProducts)) {
    out.favoriteProducts = src.favoriteProducts.map((x) => String(x).slice(0, 24)).slice(0, 6);
  }
  if (Array.isArray(src.favoriteChains)) {
    out.favoriteChains = src.favoriteChains.map((x) => String(x).slice(0, 24)).slice(0, 8);
  }
  if (src.source) out.source = String(src.source).slice(0, 40);
  if (src.updatedAt) out.updatedAt = String(src.updatedAt).slice(0, 40);
  return out;
}

function normalizeMemoryShape(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const topSrc = src.topTypes || src.top_types;
  const recentSrc = src.recent || src.events;
  return {
    topTypes: Array.isArray(topSrc)
      ? topSrc.slice(0, 6).map((x) => String(x).slice(0, 40))
      : [],
    notes: Array.isArray(src.notes)
      ? src.notes.slice(0, 8).map((x) => String(x).slice(0, 120))
      : [],
    recent: Array.isArray(recentSrc)
      ? recentSrc.slice(-12).map((e) => ({
          t: Number(e?.t || e?.at) || Date.now(),
          kind: String(e?.kind || '').slice(0, 24),
          type: e?.type != null ? String(e.type).slice(0, 40) : undefined,
          ok: e?.ok != null ? !!e.ok : undefined,
          q: e?.q != null ? String(e.q).slice(0, 160) : undefined,
        }))
      : [],
    preferences: normalizePreferences(src.preferences),
    memoryEnabled: src.memoryEnabled !== false && src.memory_enabled !== false,
  };
}

function mergeMemories(a, b) {
  const A = normalizeMemoryShape(a);
  const B = normalizeMemoryShape(b);
  if (A.memoryEnabled === false || B.memoryEnabled === false) {
    return {
      topTypes: [],
      notes: [],
      recent: [],
      preferences: { ...A.preferences, ...B.preferences },
      memoryEnabled: false,
    };
  }
  const typeScore = new Map();
  for (const t of [...A.topTypes, ...B.topTypes]) typeScore.set(t, (typeScore.get(t) || 0) + 2);
  for (const e of [...A.recent, ...B.recent]) {
    if (e.type) typeScore.set(e.type, (typeScore.get(e.type) || 0) + (e.ok === false ? 1 : 2));
  }
  return {
    topTypes: [...typeScore.entries()].sort((x, y) => y[1] - x[1]).map(([t]) => t).slice(0, 6),
    notes: [...new Set([...A.notes, ...B.notes].filter(Boolean))].slice(0, 8),
    recent: [...A.recent, ...B.recent].sort((x, y) => (x.t || 0) - (y.t || 0)).slice(-12),
    preferences: { ...A.preferences, ...B.preferences },
    memoryEnabled: true,
  };
}

function recomputeFromEvents(events) {
  const list = Array.isArray(events) ? events.slice(-80) : [];
  const score = new Map();
  const notes = [];
  for (const e of list) {
    const type = String(e?.type || '');
    if (type) score.set(type, (score.get(type) || 0) + (e.kind === 'confirm' || e.ok ? 2 : 1));
    if ((e.kind === 'confirm' || e.ok) && type === 'futures.open') notes.push('User often opens futures');
    else if ((e.kind === 'confirm' || e.ok) && type === 'swap.buy') notes.push('User often swaps tokens');
    else if ((e.kind === 'confirm' || e.ok) && type === 'predict.bet') notes.push('User often uses prediction markets');
    else if ((e.kind === 'confirm' || e.ok) && type === 'xstocks.buy') notes.push('User looks at tokenized stocks');
    else if (e.kind === 'cancel') notes.push(`Often cancels ${type || 'actions'} — keep confirmations short`);
  }
  return {
    events: list,
    topTypes: [...score.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t).slice(0, 6),
    notes: [...new Set(notes.filter(Boolean))].slice(-8),
  };
}

async function loadServerMemory(userId) {
  await ensureAiMemoryTable();
  const { rows } = await query(
    `SELECT events, top_types, notes, preferences, memory_enabled FROM ai_user_memory WHERE user_id=$1 LIMIT 1`,
    [userId]
  );
  const row = rows[0];
  if (!row) return normalizeMemoryShape(null);
  return normalizeMemoryShape({
    topTypes: row.top_types,
    notes: row.notes,
    recent: row.events,
    preferences: row.preferences,
    memoryEnabled: row.memory_enabled,
  });
}

async function appendServerMemoryEvent(userId, event) {
  await ensureAiMemoryTable();
  const { rows } = await query(
    `SELECT events, memory_enabled, preferences FROM ai_user_memory WHERE user_id=$1 LIMIT 1`,
    [userId]
  );
  if (rows[0] && rows[0].memory_enabled === false) {
    return normalizeMemoryShape({ memoryEnabled: false, preferences: rows[0].preferences });
  }
  const prev = Array.isArray(rows[0]?.events) ? rows[0].events : [];
  const nextEvent = {
    t: Number(event?.t || event?.at) || Date.now(),
    kind: String(event?.kind || '').slice(0, 24),
    type: event?.type != null ? String(event.type).slice(0, 40) : undefined,
    ok: event?.ok != null ? !!event.ok : undefined,
    q: event?.q != null ? String(event.q).slice(0, 160) : undefined,
  };
  if (!nextEvent.kind) {
    const err = new Error('kind required');
    err.status = 400;
    throw err;
  }
  const recomputed = recomputeFromEvents([...prev, nextEvent].slice(-80));
  await query(
    `INSERT INTO ai_user_memory (user_id, events, top_types, notes, updated_at)
     VALUES ($1, $2::jsonb, $3::jsonb, $4::jsonb, NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       events = EXCLUDED.events,
       top_types = EXCLUDED.top_types,
       notes = EXCLUDED.notes,
       updated_at = NOW()`,
    [userId, JSON.stringify(recomputed.events), JSON.stringify(recomputed.topTypes), JSON.stringify(recomputed.notes)]
  );
  return normalizeMemoryShape({
    topTypes: recomputed.topTypes,
    notes: recomputed.notes,
    recent: recomputed.events,
  });
}

async function setMemoryPreferences(userId, { preferences, memoryEnabled } = {}) {
  await ensureAiMemoryTable();
  const prefs = normalizePreferences({
    ...preferences,
    source: preferences?.source || 'user',
    updatedAt: new Date().toISOString(),
  });
  const enabled = memoryEnabled !== false;
  await query(
    `INSERT INTO ai_user_memory (user_id, preferences, memory_enabled, updated_at)
     VALUES ($1, $2::jsonb, $3, NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       preferences = EXCLUDED.preferences,
       memory_enabled = EXCLUDED.memory_enabled,
       updated_at = NOW()`,
    [userId, JSON.stringify(prefs), enabled]
  );
  if (!enabled) {
    await query(
      `UPDATE ai_user_memory SET events='[]'::jsonb, top_types='[]'::jsonb, notes='[]'::jsonb, updated_at=NOW() WHERE user_id=$1`,
      [userId]
    );
  }
  return loadServerMemory(userId);
}

async function loadPortfolioSnapshot(userId) {
  /* AI portfolio reads public wallet data only. */
  void userId;
  return {
    balances: [],
    recentTransfers: [],
    generatedAt: new Date().toISOString(),
  };
}

function emptySnapshot(address) {
  const addr = typeof address === 'string' ? address.trim() : '';
  const short = /^0x[a-fA-F0-9]{40}$/.test(addr)
    ? (addr.slice(0, 6) + '…' + addr.slice(-4))
    : (addr && addr.length > 8 ? (addr.slice(0, 4) + '…' + addr.slice(-4)) : null);
  return {
    mode: 'guest_or_wallet_hint_only',
    walletHint: short,
    balances: [],
    recentTransfers: [],
    generatedAt: new Date().toISOString(),
  };
}

function optionalAuth(req, _res, next) {
  const hdr = req.headers.authorization || '';
  const m = /^Bearer (.+)$/.exec(hdr);
  if (!m) return next();
  try {
    const payload = jwt.verify(m[1], config.auth.jwtSecret);
    query(`SELECT status, risk_level FROM users WHERE id=$1 LIMIT 1`, [payload.sub])
      .then(({ rows }) => {
        const row = rows[0];
        if (!row) return next();
        if (row.status === 'suspended' || row.risk_level === 'blocked') {
          return _res.status(403).json({ error: 'account_suspended' });
        }
        req.user = payload;
        next();
      })
      .catch(() => next());
  } catch (_) {
    next();
  }
}

function publicError(code, detail) {
  const map = {
    ai_unavailable: 'AI is temporarily unavailable.',
    ai_timeout: 'AI timed out — try again in a moment.',
    ai_upstream: 'AI upstream error — try again.',
    too_many_requests: 'Too many requests — wait a minute.',
    message_required: 'Message required (max 4000 characters).',
  };
  return { error: code, detail: map[code] || detail || code };
}

export function createAiRouter({ requireAuth }) {
  const r = express.Router();

  const chatLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 12,
    standardHeaders: true,
    legacyHeaders: false,
    message: publicError('too_many_requests'),
  });

  const guestChatLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 6,
    standardHeaders: true,
    legacyHeaders: false,
    message: publicError('too_many_requests'),
    keyGenerator: (req) => `guest:${req.ip}`,
    skip: (req) => !!req.user?.sub,
  });

  const memLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: publicError('too_many_requests'),
  });

  r.get('/capabilities', (_req, res) => {
    res.json({ ok: true, ...CAPABILITIES, fees: getFeeSnapshot() });
  });

  r.get('/fees', (_req, res) => {
    res.json({ ok: true, ...getFeeSnapshot() });
  });

  r.get('/memory', requireAuth, memLimiter, async (req, res, next) => {
    try {
      res.json(await loadServerMemory(req.user.sub));
    } catch (err) {
      next(err);
    }
  });

  r.post('/memory/event', requireAuth, memLimiter, async (req, res, next) => {
    try {
      const event = req.body?.event || req.body || {};
      res.json(await appendServerMemoryEvent(req.user.sub, event));
    } catch (err) {
      if (err?.status === 400) return res.status(400).json({ error: err.message });
      next(err);
    }
  });

  r.post('/memory/preferences', requireAuth, memLimiter, async (req, res, next) => {
    try {
      const mem = await setMemoryPreferences(req.user.sub, {
        preferences: req.body?.preferences || req.body || {},
        memoryEnabled: req.body?.memoryEnabled,
      });
      res.json(mem);
    } catch (err) {
      next(err);
    }
  });

  r.post('/memory/forget', requireAuth, memLimiter, async (req, res, next) => {
    try {
      const mem = await setMemoryPreferences(req.user.sub, {
        preferences: {},
        memoryEnabled: false,
      });
      res.json(mem);
    } catch (err) {
      next(err);
    }
  });

  r.post('/feedback', requireAuth, memLimiter, async (req, res, next) => {
    try {
      await ensureAiFeedbackTable();
      const responseId = String(req.body?.responseId || '').slice(0, 80);
      const rating = Number(req.body?.rating);
      const reason = req.body?.reason != null ? String(req.body.reason).slice(0, 40) : null;
      if (!responseId || (rating !== 1 && rating !== -1)) {
        return res.status(400).json({ error: 'invalid_feedback' });
      }
      const owned = String(responseId).startsWith(`${req.user.sub}:`);
      if (!owned) {
        return res.status(403).json({ error: 'feedback_forbidden' });
      }
      const id = crypto.randomUUID();
      await query(
        `INSERT INTO ai_response_feedback (id, user_id, response_id, rating, reason, prompt_version, model, latency_ms, task_type)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (user_id, response_id) DO UPDATE SET
           rating = EXCLUDED.rating,
           reason = EXCLUDED.reason,
           created_at = NOW()`,
        [
          id,
          req.user.sub,
          responseId,
          rating,
          reason,
          String(req.body?.promptVersion || AI_PROMPT_VERSION).slice(0, 64),
          req.body?.model != null ? String(req.body.model).slice(0, 80) : null,
          Number.isFinite(Number(req.body?.latencyMs)) ? Math.floor(Number(req.body.latencyMs)) : null,
          req.body?.taskType != null ? String(req.body.taskType).slice(0, 40) : null,
        ]
      );
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  r.post('/coach', optionalAuth, guestChatLimiter, chatLimiter, async (req, res, next) => {
    const started = Date.now();
    try {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) return res.status(503).json(publicError('ai_unavailable', 'ANTHROPIC_API_KEY missing on server'));

      const { message, history, lang, address, memory, uiContext } = req.body || {};
      if (!message || typeof message !== 'string' || message.length > 4000) {
        return res.status(400).json(publicError('message_required'));
      }

      const historyArr = Array.isArray(history) ? history.slice(-8) : [];
      const clientMem = (memory && typeof memory === 'object') ? normalizeMemoryShape(memory) : null;
      let mem = clientMem;
      if (req.user?.sub) {
        try {
          const serverMem = await loadServerMemory(req.user.sub);
          mem = clientMem ? mergeMemories(serverMem, clientMem) : serverMem;
          if (mem.memoryEnabled === false) {
            mem = { topTypes: [], notes: [], recent: [], preferences: mem.preferences || {}, memoryEnabled: false };
          }
        } catch (_) {}
      } else {
        // Guest: ignore client "memory" trade personalization
        mem = { topTypes: [], notes: [], recent: [], preferences: {}, memoryEnabled: false };
      }

      let snapshot;
      if (req.user?.sub) {
        try {
          snapshot = redactSnapshotForModel(await loadPortfolioSnapshot(req.user.sub));
        } catch (_) {
          snapshot = redactSnapshotForModel(emptySnapshot(address));
        }
      } else {
        snapshot = redactSnapshotForModel(emptySnapshot(address));
      }

      const fees = getFeeSnapshot();
      const messages = [
        ...historyArr
          .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
          .map((m) => ({ role: m.role, content: String(m.content).slice(0, 4000) })),
        { role: 'user', content: message },
      ];

      const model = process.env.GROM_AI_MODEL || 'claude-haiku-4-5-20251001';
      const maxTokens = Number(process.env.GROM_AI_MAX_TOKENS || 1200);
      const system = buildSystemPrompt({
        snapshot,
        lang: String(lang || '').slice(0, 8),
        memory: mem,
        fees,
        uiContext: uiContext && typeof uiContext === 'object' ? {
          page: uiContext.page != null ? String(uiContext.page).slice(0, 40) : undefined,
          product: uiContext.product != null ? String(uiContext.product).slice(0, 24) : undefined,
          chainId: uiContext.chainId != null ? Number(uiContext.chainId) || undefined : undefined,
        } : null,
      });

      const upstreamAc = new AbortController();
      const upstreamTimer = setTimeout(() => upstreamAc.abort(), 40000);
      let resp;
      try {
        resp = await fetch(ANTHROPIC_URL, {
          method: 'POST',
          signal: upstreamAc.signal,
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          body: JSON.stringify({ model, max_tokens: maxTokens, system, messages }),
        });
      } catch (e) {
        clearTimeout(upstreamTimer);
        const aborted = e?.name === 'AbortError' || /abort/i.test(String(e?.message || ''));
        return res.status(504).json(publicError(aborted ? 'ai_timeout' : 'ai_upstream', e?.message));
      }
      clearTimeout(upstreamTimer);

      const text = await resp.text();
      let body;
      try { body = JSON.parse(text); } catch (_) { body = { raw: text }; }
      if (!resp.ok) {
        return res.status(502).json(publicError('ai_upstream', body?.error?.message));
      }

      const modelText = (body?.content || [])
        .filter((c) => c.type === 'text')
        .map((c) => c.text)
        .join('\n')
        .trim();

      const parsed = extractCoachPayload(modelText);
      const reply = parsed.reply || modelText || '…';
      const responseId = req.user?.sub
        ? `${req.user.sub}:${crypto.randomUUID()}`
        : `guest:${crypto.randomUUID()}`;

      res.json({
        reply,
        action: parsed.action,
        sanitizeError: parsed.sanitizeError || null,
        usage: body?.usage || null,
        model: body?.model || model,
        promptVersion: AI_PROMPT_VERSION,
        responseId,
        latencyMs: Date.now() - started,
        snapshotAt: snapshot.generatedAt,
        fees,
      });
    } catch (err) {
      next(err);
    }
  });

  return r;
}

export { sanitizeAction, extractCoachPayload, getFeeSnapshot, CAPABILITIES, AI_PROMPT_VERSION };
export default createAiRouter;
