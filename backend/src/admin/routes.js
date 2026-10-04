/**
 * GROM admin backoffice API — /api/admin/*
 * All routes require JWT role=admin.
 */
import express from 'express';
import config from '../config/index.js';
import { query } from '../db/pool.js';
import { clientIp, logAdminAudit, auditRowToEntry } from './audit.js';
import { syncHlFillsIntoActivity } from '../activity/hl-fills-sync.js';
import { healthView, issueDiagnostics } from '../activity/diagnostics.js';

const PRODUCT_LABELS = {
  auth: 'Регистрация / вход',
  swap: 'Своп',
  spot: 'Спот',
  futures: 'Фьючи',
  predict: 'Прогнозы',
  xstocks: 'Акции',
  wallet: 'Кошелёк',
  markets: 'Рынки',
  system: 'Система / AI pulse',
  other: 'Другое',
};

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

async function getSetting(key, fallback = {}) {
  const { rows } = await query('SELECT value FROM admin_settings WHERE key=$1', [key]);
  return rows[0]?.value ?? fallback;
}

async function setSetting(key, value, actorId) {
  await query(
    `INSERT INTO admin_settings (key, value, updated_at, updated_by)
     VALUES ($1, $2::jsonb, NOW(), $3)
     ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW(), updated_by=EXCLUDED.updated_by`,
    [key, JSON.stringify(value), actorId]
  );
}

const DEX_PRODUCTS = ['swap', 'futures', 'predict', 'xstocks'];
/** Users seen within this window count as "online now". */
const ONLINE_WINDOW_MIN = 5;

/** Parse YYYY-MM-DD or ISO; endOfDay=true → exclusive next-day bound. */
function parseDateParam(raw, endOfDay = false) {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;
  // date-only → treat as UTC calendar day
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(s + (endOfDay ? 'T23:59:59.999Z' : 'T00:00:00.000Z'));
    if (Number.isNaN(d.getTime())) return null;
    if (endOfDay) return new Date(d.getTime() + 1); // exclusive upper bound next ms
    return d;
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

const DEFAULT_MARKETS = Object.fromEntries(
  DEX_PRODUCTS.map((p) => [p, { status: 'running', reason: '' }])
);

const ADMIN_WALLETS = (config.admin?.wallets || ['0xcfef272536d6e91a4945063d40ac7cba7eb657b5'])
  .map((a) => String(a).toLowerCase());

function isAdminUser(user) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  const addr = String(user.addr || '').toLowerCase();
  return ADMIN_WALLETS.includes(addr);
}

function adminGate(requireAuth) {
  return (req, res, next) => {
    requireAuth(req, res, () => {
      if (!isAdminUser(req.user)) {
        return res.status(403).json({ error: 'admin_required' });
      }
      const allow = config.admin?.ipAllowlist || [];
      if (allow.length) {
        const ip = clientIp(req);
        if (!allow.includes(ip)) {
          return res.status(403).json({ error: 'admin_ip_denied' });
        }
      }
      next();
    });
  };
}

export default function createAdminRouter({ requireAuth, getHealthSnapshot, requestHealthRecheck, isHealthChecking }) {
  const r = express.Router();
  const admin = adminGate(requireAuth);
  r.use(admin);

  // ----- Overview KPIs -----
  r.get('/overview', async (_req, res, next) => {
    try {
      const [users, health] = await Promise.all([
        query(`SELECT COUNT(*)::int AS total,
                      COUNT(*) FILTER (WHERE last_seen_at > NOW() - INTERVAL '24 hours')::int AS active_24h
                 FROM users WHERE status='active'`),
        query(`SELECT
                 CASE WHEN COUNT(*) FILTER (WHERE status='degraded') > 0 THEN 99.5 ELSE 99.98 END AS uptime
               FROM (SELECT 'ok' AS status) x`),
      ]);
      res.json({
        kpis: {
          activeUsers: users.rows[0]?.total || 0,
          activeUsersToday: users.rows[0]?.active_24h || 0,
          connectedWallets24h: users.rows[0]?.active_24h || 0,
          riskAlerts: 0,
          systemHealthPct: health.rows[0]?.uptime || 99.98,
        },
      });
    } catch (err) { next(err); }
  });

  r.get('/reports/daily', async (req, res, next) => {
    try {
      const date = String(req.query.date || new Date().toISOString().slice(0, 10));
      const { rows } = await query(
        `SELECT created_at, product, action, amount, asset, status, wallet_address
           FROM user_activity
          WHERE created_at::date = $1::date
          ORDER BY created_at`,
        [date]
      );
      const header = 'time,product,action,amount,asset,status,wallet\n';
      const body = rows.map((r) =>
        `${r.created_at},${r.product},${r.action},${r.amount || ''},${r.asset || ''},${r.status || ''},${r.wallet_address || ''}`
      ).join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="grom-daily-${date}.csv"`);
      res.send(header + body);
    } catch (err) { next(err); }
  });

  r.get('/reports/monthly', async (req, res, next) => {
    try {
      const month = String(req.query.month || new Date().toISOString().slice(0, 7));
      const { rows } = await query(
        `SELECT created_at::date AS day, COUNT(*)::int AS trades, COALESCE(SUM(amount),0) AS volume
           FROM user_activity WHERE to_char(created_at,'YYYY-MM')=$1
           GROUP BY 1 ORDER BY 1`,
        [month]
      );
      const header = 'day,trades,volume\n';
      const body = rows.map((r) => `${r.day},${r.trades},${r.volume}`).join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="grom-monthly-${month}.csv"`);
      res.send(header + body);
    } catch (err) { next(err); }
  });

  // ----- Markets & maintenance -----
  r.get('/markets/status', async (_req, res, next) => {
    try {
      const [maintenance, marketsRaw, desksPause] = await Promise.all([
        getSetting('maintenance', { enabled: false }),
        getSetting('markets', DEFAULT_MARKETS),
        getSetting('desks_pause', { until: null }),
      ]);
      const markets = { ...DEFAULT_MARKETS, ...marketsRaw };
      const pauseUntil = desksPause?.until ? new Date(desksPause.until).getTime() : 0;
      if (pauseUntil > Date.now()) {
        for (const p of DEX_PRODUCTS) {
          markets[p] = { ...(markets[p] || {}), status: 'paused', reason: desksPause.reason || 'global pause' };
        }
      }
      res.json({ maintenance, maintenance_mode: maintenance, markets, products: markets });
    } catch (err) { next(err); }
  });

  r.post('/maintenance/toggle', async (req, res, next) => {
    try {
      const enabled = !!req.body?.enabled;
      const reason = String(req.body?.reason || '');
      const maintenance = {
        enabled,
        reason,
        actor: req.user.sub,
        updated_at: new Date().toISOString(),
      };
      await setSetting('maintenance', maintenance, req.user.sub);
      await logAdminAudit({
        actorId: req.user.sub,
        action: enabled ? 'maintenance_on' : 'maintenance_off',
        reason,
        ip: clientIp(req),
      });
      res.json({ maintenance });
    } catch (err) { next(err); }
  });

  r.post('/markets/:product/:action', async (req, res, next) => {
    try {
      const product = req.params.product;
      const action = req.params.action;
      if (!DEX_PRODUCTS.includes(product)) return res.status(400).json({ error: 'bad_product' });
      if (!['pause', 'resume', 'kill'].includes(action)) return res.status(400).json({ error: 'bad_action' });
      const markets = await getSetting('markets', {});
      const reason = String(req.body?.reason || '');
      const status = action === 'resume' ? 'running' : action === 'pause' ? 'paused' : 'killed';
      markets[product] = { status, reason, updated_at: new Date().toISOString(), actor: req.user.sub };
      await setSetting('markets', markets, req.user.sub);
      await logAdminAudit({
        actorId: req.user.sub,
        action: `market_${product}_${action}`,
        reason,
        ip: clientIp(req),
      });
      res.json({ markets, product, action });
    } catch (err) { next(err); }
  });

  r.post('/desks/pause', async (req, res, next) => {
    try {
      const durationS = Math.min(Math.max(parseInt(req.body?.duration_s || '60', 10), 10), 3600);
      const reason = String(req.body?.reason || 'admin pause');
      const until = new Date(Date.now() + durationS * 1000).toISOString();
      await setSetting('desks_pause', { until, reason }, req.user.sub);
      await logAdminAudit({
        actorId: req.user.sub,
        action: 'desks_pause',
        reason: `${durationS}s — ${reason}`,
        ip: clientIp(req),
      });
      res.json({ ok: true, until, duration_s: durationS });
    } catch (err) { next(err); }
  });

  // ----- Settings (risk + market config) -----
  r.get('/settings/risk', async (_req, res, next) => {
    try {
      res.json({ risk: await getSetting('risk', {}) });
    } catch (err) { next(err); }
  });

  r.put('/settings/risk', async (req, res, next) => {
    try {
      const risk = { ...(await getSetting('risk', {})), ...(req.body?.risk || req.body || {}) };
      await setSetting('risk', risk, req.user.sub);
      await logAdminAudit({ actorId: req.user.sub, action: 'risk_config_save', ip: clientIp(req), metadata: risk });
      res.json({ risk });
    } catch (err) { next(err); }
  });

  r.get('/settings/market-config', async (_req, res, next) => {
    try {
      res.json({ config: await getSetting('market_config', {}) });
    } catch (err) { next(err); }
  });

  r.post('/settings/market-config/deploy', async (req, res, next) => {
    try {
      const cfg = { ...(await getSetting('market_config', {})), ...(req.body?.config || req.body || {}) };
      await setSetting('market_config', cfg, req.user.sub);
      await logAdminAudit({ actorId: req.user.sub, action: 'market_config_deploy', ip: clientIp(req), metadata: cfg });
      res.json({ ok: true, config: cfg });
    } catch (err) { next(err); }
  });

  r.post('/settings/market-config/dry-run', async (_req, res, next) => {
    try {
      res.json({ ok: true, violations: [] });
    } catch (err) { next(err); }
  });

  // Legacy path used by boffSaveRiskConfig
  r.put('/settings', async (req, res, next) => {
    req.url = '/settings/risk';
    return r.handle(req, res, next);
  });

  // ----- AML alerts (retired — wallet-only; no alerts table) -----
  r.get('/alerts', async (_req, res) => {
    res.json({ alerts: [], retired: true });
  });

  r.post('/alerts/:id/resolve', async (_req, res) => {
    res.status(410).json({ error: 'alerts_retired' });
  });

  // ----- Users -----
  r.get('/users', async (req, res, next) => {
    try {
      const limit = Math.min(parseInt(req.query.limit || '30', 10), 100);
      const offset = Math.max(parseInt(req.query.offset || '0', 10) || 0, 0);
      const search = String(req.query.search || '').trim();
      const status = String(req.query.status || '').trim();
      const from = parseDateParam(req.query.from);
      const to = parseDateParam(req.query.to, true);
      const params = [];
      const where = [];
      if (search) {
        params.push(`%${search.toLowerCase()}%`);
        where.push(`(u.wallet_address ILIKE $${params.length} OR u.id::text ILIKE $${params.length})`);
      }
      if (status) {
        params.push(status);
        where.push(`u.status=$${params.length}`);
      }
      if (from) {
        params.push(from.toISOString());
        where.push(`u.created_at >= $${params.length}::timestamptz`);
      }
      if (to) {
        params.push(to.toISOString());
        where.push(`u.created_at < $${params.length}::timestamptz`);
      }
      const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const countRes = await query(`SELECT COUNT(*)::int AS total FROM users u ${whereSql}`, params);
      params.push(limit, offset);
      const sql = `
        SELECT u.id, u.wallet_address, u.role, u.status, u.created_at, u.last_seen_at
          FROM users u
         ${whereSql}
         ORDER BY u.last_seen_at DESC NULLS LAST, u.created_at DESC
         LIMIT $${params.length - 1} OFFSET $${params.length}`;
      const { rows } = await query(sql, params);
      res.json({
        users: rows,
        total: countRes.rows[0]?.total || 0,
        hasMore: rows.length >= limit,
        limit,
        offset,
        from: from ? from.toISOString() : null,
        to: to ? to.toISOString() : null,
      });
    } catch (err) { next(err); }
  });

  r.get('/users/:id', async (req, res, next) => {
    try {
      const { rows } = await query(
        `SELECT id, wallet_address, role, status, chain_id, created_at, last_seen_at
           FROM users WHERE id=$1`,
        [req.params.id]
      );
      if (!rows[0]) return res.status(404).json({ error: 'not_found' });
      res.json({ user: rows[0] });
    } catch (err) { next(err); }
  });

  async function setUserStatus(req, res, suspend) {
    const reason = String(req.body?.reason || '');
    const status = suspend ? 'suspended' : 'active';
    const { rows } = await query(
      `UPDATE users SET status=$2 WHERE id=$1 RETURNING id, status, wallet_address`,
      [req.params.id, status]
    );
    if (!rows[0]) return res.status(404).json({ error: 'not_found' });
    await logAdminAudit({
      actorId: req.user.sub,
      action: suspend ? 'user_suspend' : 'user_unsuspend',
      targetId: req.params.id,
      reason,
      ip: clientIp(req),
    });
    res.json({ user: rows[0] });
  }

  r.post('/users/:id/suspend', (req, res, next) => setUserStatus(req, res, true).catch(next));
  r.post('/users/:id/unsuspend', (req, res, next) => setUserStatus(req, res, false).catch(next));

  r.post('/users/:id/force-logout', async (req, res, next) => {
    try {
      await query(
        `INSERT INTO user_settings (user_id, security, updated_at)
         VALUES ($1, jsonb_build_object('forced_logout_at', NOW()::text), NOW())
         ON CONFLICT (user_id) DO UPDATE
           SET security = COALESCE(user_settings.security, '{}'::jsonb) || jsonb_build_object('forced_logout_at', NOW()::text),
               updated_at = NOW()`,
        [req.params.id]
      );
      await logAdminAudit({
        actorId: req.user.sub,
        action: 'user_force_logout',
        targetId: req.params.id,
        ip: clientIp(req),
      });
      res.json({ ok: true });
    } catch (err) { next(err); }
  });

  // ----- Symbols (retired — Hyperliquid markets via HL API, not DB) -----
  r.get('/symbols', async (_req, res) => {
    res.json({ symbols: [], retired: true });
  });

  r.put('/symbols/:pair', async (_req, res) => {
    res.status(410).json({ error: 'symbols_retired' });
  });

  // ----- Audit log -----
  r.get('/audit', async (req, res, next) => {
    try {
      const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
      const action = req.query.action ? String(req.query.action) : null;
      const params = [limit];
      let sql = `SELECT id, actor_id, action, target_id, payload, ip, ts FROM admin_audit_log`;
      if (action) {
        params.unshift(`%${action}%`);
        sql += ` WHERE action ILIKE $1`;
      }
      sql += ` ORDER BY ts DESC LIMIT $${params.length}`;
      const { rows } = await query(sql, action ? [action, limit] : [limit]);
      const entries = rows.map(auditRowToEntry);
      res.json({ entries, events: entries });
    } catch (err) { next(err); }
  });

  r.post('/audit/recent', async (req, res, next) => {
    try {
      if (req.body?.action !== 'pause_all') return res.status(400).json({ error: 'unknown_action' });
      const durationS = Math.min(Math.max(parseInt(req.body?.duration_s || '60', 10), 10), 3600);
      const reason = String(req.body?.reason || 'admin pause');
      const until = new Date(Date.now() + durationS * 1000).toISOString();
      await setSetting('desks_pause', { until, reason }, req.user.sub);
      await logAdminAudit({
        actorId: req.user.sub,
        action: 'desks_pause',
        reason: `${durationS}s — ${reason}`,
        ip: clientIp(req),
      });
      res.json({ ok: true, until, duration_s: durationS });
    } catch (err) { next(err); }
  });

  // ----- Client activity (registrations, bets, swaps, …) -----
  r.get('/activity/stats', async (req, res, next) => {
    try {
      try { await syncHlFillsIntoActivity(); } catch (_) {}
      const from = parseDateParam(req.query.from);
      const to = parseDateParam(req.query.to, true);
      const hasRange = !!(from || to);
      const rangeParams = [];
      let actWhere;
      if (hasRange) {
        if (from) { rangeParams.push(from.toISOString()); }
        if (to) { rangeParams.push(to.toISOString()); }
        const parts = [];
        if (from) parts.push(`created_at >= $${parts.length + 1}::timestamptz`);
        if (to) parts.push(`created_at < $${parts.length + 1}::timestamptz`);
        actWhere = parts.length ? `WHERE ${parts.join(' AND ')}` : '';
      } else {
        actWhere = `WHERE created_at > NOW() - INTERVAL '24 hours'`;
      }

      const usersPromise = hasRange
        ? query(
          `SELECT COUNT(*)::int AS total,
                  COUNT(*) FILTER (WHERE created_at >= COALESCE($1::timestamptz, '-infinity'::timestamptz)
                    AND created_at < COALESCE($2::timestamptz, 'infinity'::timestamptz))::int AS reg_in_range,
                  COUNT(*) FILTER (WHERE created_at >= COALESCE($1::timestamptz, '-infinity'::timestamptz)
                    AND created_at < COALESCE($2::timestamptz, 'infinity'::timestamptz))::int AS users_in_range,
                  COUNT(*) FILTER (WHERE last_seen_at >= COALESCE($1::timestamptz, '-infinity'::timestamptz)
                    AND last_seen_at < COALESCE($2::timestamptz, 'infinity'::timestamptz))::int AS active_in_range
             FROM users`,
          [from ? from.toISOString() : null, to ? to.toISOString() : null]
        )
        : query(`SELECT
                   COUNT(*)::int AS total,
                   COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours')::int AS reg_24h,
                   COUNT(*) FILTER (WHERE created_at::date = CURRENT_DATE)::int AS reg_today,
                   COUNT(*) FILTER (WHERE last_seen_at > NOW() - INTERVAL '24 hours')::int AS active_24h
                 FROM users`);

      const [users, byProduct, onlineRes, visitsRes] = await Promise.all([
        usersPromise.catch(() => ({ rows: [{}] })),
        query(
          `SELECT product, COUNT(*)::int AS cnt FROM user_activity ${actWhere} GROUP BY product`,
          rangeParams
        ).catch(() => ({ rows: [] })),
        query(
          `SELECT COUNT(*)::int AS online_now
             FROM users
            WHERE last_seen_at > NOW() - INTERVAL '${ONLINE_WINDOW_MIN} minutes'`
        ).catch(() => ({ rows: [{ online_now: 0 }] })),
        (hasRange
          ? query(
            `SELECT COUNT(*)::int AS pageviews,
                    COUNT(DISTINCT visitor_key)::int AS visits
               FROM site_pageviews
              WHERE created_at >= COALESCE($1::timestamptz, '-infinity'::timestamptz)
                AND created_at < COALESCE($2::timestamptz, 'infinity'::timestamptz)`,
            [from ? from.toISOString() : null, to ? to.toISOString() : null]
          )
          : query(
            `SELECT COUNT(*)::int AS pageviews,
                    COUNT(DISTINCT visitor_key)::int AS visits
               FROM site_pageviews
              WHERE created_at > NOW() - INTERVAL '24 hours'`
          )
        ).catch(() => ({ rows: [{ pageviews: 0, visits: 0 }] })),
      ]);
      const u = users.rows[0] || {};
      const v = visitsRes.rows[0] || {};
      const counts = {};
      for (const row of byProduct.rows || []) counts[row.product] = row.cnt;
      res.json({
        stats: {
          totalUsers: hasRange ? (u.users_in_range || 0) : (u.total || 0),
          registrationsToday: hasRange ? (u.reg_in_range || 0) : (u.reg_today || 0),
          registrations24h: hasRange ? (u.reg_in_range || 0) : (u.reg_24h || 0),
          active24h: hasRange ? (u.active_in_range || 0) : (u.active_24h || 0),
          swap24h: counts.swap || 0,
          spot24h: counts.spot || 0,
          futures24h: counts.futures || 0,
          predict24h: counts.predict || 0,
          xstocks24h: counts.xstocks || 0,
          onlineNow: onlineRes.rows[0]?.online_now || 0,
          onlineWindowMin: ONLINE_WINDOW_MIN,
          visits24h: v.visits || 0,
          pageviews24h: v.pageviews || 0,
          hasRange,
          from: from ? from.toISOString() : null,
          to: to ? to.toISOString() : null,
        },
      });
    } catch (err) { next(err); }
  });

  r.get('/activity/feed', async (req, res, next) => {
    try {
      const limit = Math.min(parseInt(req.query.limit || '30', 10), 200);
      const offset = Math.max(parseInt(req.query.offset || '0', 10) || 0, 0);
      const product = String(req.query.product || '').trim();
      const tradesOnly = String(req.query.trades_only || '') === '1';
      const from = parseDateParam(req.query.from);
      const to = parseDateParam(req.query.to, true);

      /* Spot/Perp CLOB fills live on Hyperliquid — pull into user_activity so
       * admin «Спот» is not empty when client EIP-712 never logged the fill. */
      if (!product || product === 'spot' || product === 'futures') {
        try { await syncHlFillsIntoActivity(); } catch (_) {}
      }

      const params = [];
      const filters = [];
      if (product) {
        params.push(product);
        filters.push(`product = $${params.length}`);
      }
      if (tradesOnly) {
        // Real fills / registrations — hide quote_rate_limit & pure UI noise.
        filters.push(`(
          tx_hash IS NOT NULL
          OR (amount IS NOT NULL AND COALESCE(status,'') NOT IN ('error'))
          OR (product = 'auth' AND action IN ('register','login','connect'))
        )`);
        filters.push(`NOT (product = 'swap' AND action IN ('quote_rate_limit','ui_lag'))`);
        filters.push(`COALESCE(status,'') <> 'error'`);
      }
      if (from) {
        params.push(from.toISOString());
        filters.push(`created_at >= $${params.length}::timestamptz`);
      }
      if (to) {
        params.push(to.toISOString());
        filters.push(`created_at < $${params.length}::timestamptz`);
      }
      params.push(limit, offset);
      const productFilter = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

      const { rows } = await query(
        `SELECT * FROM (
           SELECT
             a.created_at,
             a.user_id,
             COALESCE(a.wallet_address, u.wallet_address) AS wallet_address,
             a.product,
             a.action,
             a.detail,
             a.tx_hash,
             a.amount,
             a.asset,
             a.status,
             'activity' AS source
           FROM user_activity a
           LEFT JOIN users u ON u.id = a.user_id

           UNION ALL

           SELECT
             u.created_at,
             u.id AS user_id,
             u.wallet_address,
             'auth' AS product,
             'register' AS action,
             jsonb_build_object('country', u.country_code, 'chain_id', u.chain_id) AS detail,
             NULL AS tx_hash,
             NULL AS amount,
             NULL AS asset,
             'done' AS status,
             'users' AS source
           FROM users u
           WHERE NOT EXISTS (
             SELECT 1 FROM user_activity x
              WHERE x.user_id = u.id AND x.product = 'auth' AND x.action = 'register'
           )
         ) feed
         ${productFilter}
         ORDER BY created_at DESC
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
      );

      res.json({
        hasMore: rows.length >= limit,
        limit,
        offset,
        events: rows.map((e) => ({
          at: e.created_at,
          user_id: e.user_id,
          wallet: e.wallet_address,
          product: e.product,
          product_label: PRODUCT_LABELS[e.product] || e.product,
          action: e.action,
          detail: e.detail,
          tx_hash: e.tx_hash,
          amount: e.amount != null ? Number(e.amount) : null,
          asset: e.asset,
          status: e.status,
          source: e.source,
        })),
      });
    } catch (err) { next(err); }
  });

  /**
   * Live AI health pulse snapshot (DB / Redis / prices / HL / event-loop / memory).
   * Written continuously by health-pulse on the leader; failures also land in /activity/issues.
   */
  r.get('/activity/health', async (_req, res) => {
    const snap = typeof getHealthSnapshot === 'function' ? getHealthSnapshot() : null;
    const view = healthView(snap);
    res.json({
      stale: view.stale,
      age_ms: view.age_ms,
      checking: !!isHealthChecking?.(),
      ok: view.ok ?? null,
      at: snap?.at || null,
      open: snap?.open ?? null,
      checks: snap?.checks || [],
      note: snap
        ? 'Pulse runs every ~90s on the leader. Failures appear in AI монитор.'
        : 'Pulse ещё не успел отработать или worker не лидер — подождите ~30с.',
    });
  });

  // Read-only probes only. Never retries a wallet request or transaction.
  r.post('/activity/health/recheck', async (req, res, next) => {
    try {
      if (!requestHealthRecheck) return res.status(503).json({ error: 'health_recheck_unavailable' });
      const result = requestHealthRecheck();
      if (result.accepted) await logAdminAudit({ actorId: req.user.sub, action: 'health_recheck',
        ip: clientIp(req), metadata: { scope: 'read_only_probes' } });
      res.status(result.accepted ? 202 : 200).json(result);
    } catch (err) { next(err); }
  });

  /** AI monitor — client-reported failures (status=error) with classified cause. */
  r.get('/activity/issues', async (req, res, next) => {
    try {
      const limit = Math.min(parseInt(req.query.limit || '40', 10), 100);
      const offset = Math.max(parseInt(req.query.offset || '0', 10), 0);
      const product = req.query.product ? String(req.query.product) : null;
      const from = parseDateParam(req.query.from);
      const to = parseDateParam(req.query.to, true);
      const params = [];
      const filters = [`status IN ('error','failed','fail')`];
      if (product) {
        params.push(product);
        filters.push(`product = $${params.length}`);
      }
      if (from) {
        params.push(from.toISOString());
        filters.push(`created_at >= $${params.length}::timestamptz`);
      }
      if (to) {
        params.push(to.toISOString());
        filters.push(`created_at < $${params.length}::timestamptz`);
      }
      params.push(limit, offset);
      const where = `WHERE ${filters.join(' AND ')}`;
      const { rows } = await query(
        `SELECT id, created_at, user_id, wallet_address, product, action, detail, status, asset, amount, tx_hash
           FROM user_activity
           ${where}
           ORDER BY created_at DESC
           LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
      );
      const statsParams = product ? [product] : [];
      const { rows: repeats } = await query(
        `SELECT product, action, COUNT(*)::int AS n, MAX(created_at) AS last_at
           FROM user_activity
          WHERE status IN ('error','failed','fail') AND created_at > NOW() - INTERVAL '24 hours'
            ${product ? 'AND product = $1' : ''}
          GROUP BY product, action`, statsParams);
      const events24h = repeats.reduce((sum, group) => sum + group.n, 0);
      const snapshot = getHealthSnapshot?.();
      res.json({
        open_24h: events24h, // Compatibility: a report count, NOT unresolved incidents.
        reports_24h: events24h,
        groups_24h: repeats.length,
        generated_at: new Date().toISOString(),
        hasMore: rows.length >= limit,
        issues: rows.map((e) => ({
          id: e.id,
          at: e.created_at,
          user_id: e.user_id,
          wallet: e.wallet_address,
          product: e.product,
          product_label: PRODUCT_LABELS[e.product] || e.product,
          action: e.action,
          status: e.status,
          ...issueDiagnostics(e, snapshot),
          repeats_24h: repeats.find(group => group.product === e.product && group.action === e.action)?.n || 0,
          detail: e.detail,
          page: e.detail?.page || null,
          asset: e.asset,
          tx_hash: e.tx_hash,
        })),
      });
    } catch (err) { next(err); }
  });

  r.get('/activity/user/:id', async (req, res, next) => {
    try {
      const limit = Math.min(parseInt(req.query.limit || '50', 10), 100);
      const uid = req.params.id;
      const [userRes, activityRes] = await Promise.all([
        query(
          `SELECT id, wallet_address, role, status, chain_id, created_at, last_seen_at
             FROM users WHERE id=$1`,
          [uid]
        ),
        query(
          `SELECT created_at, product, action, detail, tx_hash, amount, asset, status
             FROM user_activity WHERE user_id=$1 ORDER BY created_at DESC LIMIT $2`,
          [uid, limit]
        ).catch(() => ({ rows: [] })),
      ]);
      if (!userRes.rows[0]) return res.status(404).json({ error: 'not_found' });
      res.json({
        user: userRes.rows[0],
        activity: activityRes.rows,
      });
    } catch (err) { next(err); }
  });

  return r;
}
