/**
 * Continuous exchange health pulse (leader only).
 * Probes DB / Redis / prices / HL / event-loop lag and writes real issues
 * into user_activity so they show up in admin «AI монитор».
 */
import axios from 'axios';
import { pool } from '../db/pool.js';
import { getRedis } from '../utils/redis.js';
import logger from '../utils/logger.js';
import { logUserActivity } from './log.js';
import { classifyIssue } from './classify.js';

const INTERVAL_MS = 90_000;
const REMIND_MS = 45 * 60_1000;
const HL_API = 'https://api.hyperliquid.xyz';

/** @type {null | { at: string, ok: boolean, checks: object[], open: number }} */
let lastSnapshot = null;
/** @type {Map<string, { at: number, severity: string }>} */
const lastLogged = new Map();

export function getHealthSnapshot() {
  return lastSnapshot;
}

function timed(fn) {
  const t0 = Date.now();
  return Promise.resolve()
    .then(fn)
    .then((value) => ({ ok: true, ms: Date.now() - t0, value }))
    .catch((err) => ({ ok: false, ms: Date.now() - t0, error: String(err?.message || err) }));
}

async function probeDb() {
  const r = await timed(() => pool.query('SELECT 1'));
  if (!r.ok) return { id: 'db', ok: false, severity: 'error', message: `PostgreSQL недоступен: ${r.error}`, ms: r.ms };
  // Occasional 1–2.5s cold queries under load — pulse yellow only, no AI spam.
  if (r.ms > 2500) {
    return {
      id: 'db',
      ok: false,
      severity: 'warn',
      message: `PostgreSQL медленный (${r.ms}ms)`,
      ms: r.ms,
      skipIssueLog: r.ms < 4000,
    };
  }
  return { id: 'db', ok: true, severity: 'ok', message: `DB ok (${r.ms}ms)`, ms: r.ms };
}

async function probeRedis() {
  const r = await timed(async () => {
    const redis = getRedis();
    const pong = await redis.ping();
    if (pong !== 'PONG') throw new Error('unexpected ping: ' + pong);
    return true;
  });
  if (!r.ok) return { id: 'redis', ok: false, severity: 'warn', message: `Redis недоступен: ${r.error}`, ms: r.ms };
  if (r.ms > 900) return { id: 'redis', ok: false, severity: 'warn', message: `Redis медленный (${r.ms}ms)`, ms: r.ms };
  return { id: 'redis', ok: true, severity: 'ok', message: `Redis ok (${r.ms}ms)`, ms: r.ms };
}

async function probePrices(priceAggregator) {
  if (!priceAggregator || typeof priceAggregator.health !== 'function') {
    return { id: 'prices', ok: true, severity: 'ok', message: 'Price feed n/a (worker)', ms: 0 };
  }
  const h = priceAggregator.health();
  const raw = Array.isArray(h) ? h : Object.entries(h || {}).map(([name, v]) => ({
    name,
    healthy: !!(v && (v.healthy ?? v.isHealthy)),
  }));
  const sources = raw.filter(Boolean);
  if (!sources.length) {
    return { id: 'prices', ok: false, severity: 'warn', message: 'Нет данных по источникам цен', ms: 0 };
  }
  const unhealthy = sources.filter((s) => s && s.healthy === false);
  if (unhealthy.length >= sources.length) {
    return {
      id: 'prices',
      ok: false,
      severity: 'error',
      message: `Все источники цен down: ${unhealthy.map((s) => s.name).join(', ')}`,
      ms: 0,
    };
  }
  if (unhealthy.length) {
    // Any single secondary source flap while others still tick — pulse yellow, no AI spam.
    const onlyOne = unhealthy.length === 1;
    return {
      id: 'prices',
      ok: false,
      severity: 'warn',
      message: `Часть источников цен down: ${unhealthy.map((s) => s.name).join(', ')}`,
      ms: 0,
      skipIssueLog: onlyOne,
    };
  }
  return { id: 'prices', ok: true, severity: 'ok', message: `Цены ok (${sources.length} sources)`, ms: 0 };
}

let lastHlOk = null; // { at, n, ms }

async function probeHyperliquid() {
  // Prefer in-process proxy (has 45s cache + stale-on-429) so pulse doesn't
  // burn Hyperliquid's shared droplet IP quota alongside user Trade/Markets.
  const localUrl = `http://127.0.0.1:${Number(process.env.PORT || process.env.GROM_BACKEND_PORT || 4000)}/api/futures/hl/info`;

  if (lastHlOk && (Date.now() - lastHlOk.at) < 5 * 60_000) {
    return {
      id: 'hl',
      ok: true,
      severity: 'ok',
      message: `HL ok (кэш ${Math.round((Date.now() - lastHlOk.at) / 1000)}с) · ${lastHlOk.n} mids`,
      ms: lastHlOk.ms,
      product: 'futures',
    };
  }

  const r = await timed(async () => {
    let status;
    let data;
    try {
      const res = await axios.post(
        localUrl,
        { type: 'allMids' },
        { timeout: 8000, headers: { 'Content-Type': 'application/json' }, validateStatus: () => true }
      );
      status = res.status;
      data = res.data;
    } catch (_) {
      // Fallback to upstream only if local proxy is down
      const res = await axios.post(
        `${HL_API}/info`,
        { type: 'allMids' },
        { timeout: 8000, headers: { 'Content-Type': 'application/json' }, validateStatus: () => true }
      );
      status = res.status;
      data = res.data;
    }
    if (status === 429) {
      const err = new Error('HL HTTP 429');
      err.code = 429;
      throw err;
    }
    if (status >= 400) throw new Error('HL HTTP ' + status);
    const n = data && typeof data === 'object' ? Object.keys(data).length : 0;
    if (n < 10) throw new Error('HL allMids empty');
    return n;
  });

  if (!r.ok) {
    const is429 = /429/.test(String(r.error || ''));
    // Rate-limit is expected under load — keep pulse green if we had a recent ok.
    if (is429) {
      if (lastHlOk) {
        return {
          id: 'hl',
          ok: true,
          severity: 'ok',
          message: `HL ok · proxy/cache (rate-limit сглажен) · ${lastHlOk.n} mids`,
          ms: r.ms,
          product: 'futures',
        };
      }
      // No cache yet: soft warn in pulse card only — do NOT write to issues feed
      return {
        id: 'hl',
        ok: true,
        severity: 'ok',
        message: 'HL краткий rate-limit (429) — кэш ещё пуст, Trade сам восстановится',
        ms: r.ms,
        product: 'futures',
        skipIssueLog: true,
      };
    }
    return {
      id: 'hl',
      ok: false,
      severity: 'error',
      message: `Hyperliquid fail: ${r.error}`,
      ms: r.ms,
      product: 'futures',
    };
  }

  lastHlOk = { at: Date.now(), n: r.value, ms: r.ms };
  if (r.ms > 3000) {
    return { id: 'hl', ok: false, severity: 'warn', message: `Hyperliquid медленный (${r.ms}ms)`, ms: r.ms, product: 'futures' };
  }
  return { id: 'hl', ok: true, severity: 'ok', message: `HL ok · ${r.value} mids (${r.ms}ms)`, ms: r.ms, product: 'futures' };
}

let lastHipOk = null; // { at, n, ms }

/** HIP-3 / TradFi: xyz dex must stay populated (Chrome used to empty it via 429). */
async function probeHip3() {
  if (lastHipOk && (Date.now() - lastHipOk.at) < 8 * 60_000) {
    return {
      id: 'hip3',
      ok: true,
      severity: 'ok',
      message: `HIP-3 ok (кэш) · ${lastHipOk.n} xyz`,
      ms: lastHipOk.ms,
      product: 'markets',
    };
  }
  const localUrl = `http://127.0.0.1:${Number(process.env.PORT || process.env.GROM_BACKEND_PORT || 4000)}/api/futures/hl/info`;
  const r = await timed(async () => {
    const res = await axios.post(
      localUrl,
      { type: 'metaAndAssetCtxs', dex: 'xyz' },
      { timeout: 12000, headers: { 'Content-Type': 'application/json' }, validateStatus: () => true },
    );
    if (res.status === 429) {
      const err = new Error('HL HIP-3 429');
      err.code = 429;
      throw err;
    }
    if (res.status >= 400) throw new Error('HL HIP-3 HTTP ' + res.status);
    const uni = Array.isArray(res.data) ? res.data[0]?.universe : null;
    const n = Array.isArray(uni) ? uni.length : 0;
    if (n < 20) throw new Error('HIP-3 xyz universe thin (' + n + ')');
    return n;
  });
  if (!r.ok) {
    if (/429/.test(String(r.error || ''))) {
      if (lastHipOk) {
        return {
          id: 'hip3', ok: true, severity: 'ok', product: 'markets',
          message: `HIP-3 ok · stale cache (${lastHipOk.n}) · rate-limit`,
          ms: r.ms, skipIssueLog: true,
        };
      }
      return {
        id: 'hip3', ok: true, severity: 'ok', product: 'markets',
        message: 'HIP-3 rate-limit — клиентский backfill подхватит',
        ms: r.ms, skipIssueLog: true,
      };
    }
    return {
      id: 'hip3', ok: false, severity: 'warn', product: 'markets',
      message: `HIP-3/TradFi fail: ${r.error}`,
      ms: r.ms,
    };
  }
  lastHipOk = { at: Date.now(), n: r.value, ms: r.ms };
  return {
    id: 'hip3', ok: true, severity: 'ok', product: 'markets',
    message: `HIP-3 ok · ${r.value} xyz (${r.ms}ms)`,
    ms: r.ms,
  };
}

let lastXstocksOk = null;

async function probeXstocks() {
  if (lastXstocksOk && (Date.now() - lastXstocksOk.at) < 10 * 60_000) {
    return {
      id: 'xstocks', ok: true, severity: 'ok', product: 'xstocks',
      message: `xStocks ok (кэш) · ${lastXstocksOk.n}`,
      ms: lastXstocksOk.ms,
    };
  }
  const localUrl = `http://127.0.0.1:${Number(process.env.PORT || process.env.GROM_BACKEND_PORT || 4000)}/api/market/xstocks`;
  const r = await timed(async () => {
    const res = await axios.get(localUrl, { timeout: 15000, validateStatus: () => true });
    if (res.status >= 400) throw new Error('xstocks HTTP ' + res.status);
    const n = Array.isArray(res.data?.items) ? res.data.items.length : 0;
    if (n < 40) throw new Error('xstocks catalog thin (' + n + ')');
    const sample = res.data.items[0] || {};
    if (!sample.solMint && !(sample.addrs && Object.keys(sample.addrs).length)) {
      throw new Error('xstocks items missing routes (Soon stuck)');
    }
    return n;
  });
  if (!r.ok) {
    return {
      id: 'xstocks', ok: false, severity: 'warn', product: 'xstocks',
      message: `Каталог акций fail: ${r.error}`,
      ms: r.ms,
    };
  }
  lastXstocksOk = { at: Date.now(), n: r.value, ms: r.ms };
  return {
    id: 'xstocks', ok: true, severity: 'ok', product: 'xstocks',
    message: `xStocks ok · ${r.value} tickers (${r.ms}ms)`,
    ms: r.ms,
  };
}

async function probeEventLoop() {
  const r = await timed(() => new Promise((resolve) => {
    const a = Date.now();
    setImmediate(() => resolve(Date.now() - a));
  }));
  const lag = r.ok ? Number(r.value) : 9999;
  if (!r.ok || lag > 350) {
    return {
      id: 'eventloop',
      ok: false,
      severity: lag > 700 ? 'error' : 'warn',
      message: `Event-loop lag ${lag}ms — бэкенд перегружен (риск «тупит» при масштабе)`,
      ms: lag,
    };
  }
  return { id: 'eventloop', ok: true, severity: 'ok', message: `Event-loop ok (${lag}ms)`, ms: lag };
}

async function probeMem() {
  const used = process.memoryUsage();
  const rssMb = Math.round((used.rss || 0) / (1024 * 1024));
  const heapMb = Math.round((used.heapUsed || 0) / (1024 * 1024));
  if (rssMb > 1400) {
    return { id: 'memory', ok: false, severity: 'error', message: `RSS ${rssMb}MB — память на пределе, нужен scale-out`, ms: 0 };
  }
  if (rssMb > 900) {
    return { id: 'memory', ok: false, severity: 'warn', message: `RSS ${rssMb}MB · heap ${heapMb}MB — следить при росте юзеров`, ms: 0 };
  }
  return { id: 'memory', ok: true, severity: 'ok', message: `Memory ok · RSS ${rssMb}MB`, ms: 0 };
}

async function maybeLogIssue(check) {
  if (check.ok || check.skipIssueLog) {
    if (check.ok) lastLogged.delete(check.id);
    return;
  }
  // Never spam the issues feed with HL rate-limits — proxy cache handles UX.
  if (check.id === 'hl' && /429|rate-?limit/i.test(String(check.message || ''))) return;
  const prev = lastLogged.get(check.id);
  const now = Date.now();
  if (prev && prev.severity === check.severity && (now - prev.at) < REMIND_MS) return;

  const product = check.product || 'system';
  const action = `health_${check.id}`;
  const classified = classifyIssue({
    product,
    action,
    message: check.message,
    detail: { source: 'health_pulse', probe: check.id, ms: check.ms },
  });
  // Prefer probe-specific summary over generic classifier when we already know it.
  const ai_summary = check.message
    ? `Система · ${check.message}`
    : classified.ai_summary;
  const severity = check.severity === 'warn' ? 'warn' : (classified.severity || 'error');

  await logUserActivity({
    userId: null,
    wallet: null,
    product,
    action,
    detail: {
      cause: `health_${check.id}`,
      ai_summary,
      severity,
      source: 'health_pulse',
      probe: check.id,
      ms: check.ms,
      reported_at: new Date().toISOString(),
    },
    status: 'error',
  });
  lastLogged.set(check.id, { at: now, severity: check.severity });
}

export async function runHealthPulse({ priceAggregator } = {}) {
  const checks = await Promise.all([
    probeDb(),
    probeRedis(),
    probePrices(priceAggregator),
    probeHyperliquid(),
    probeHip3(),
    probeXstocks(),
    probeEventLoop(),
    probeMem(),
  ]);

  const open = checks.filter((c) => !c.ok).length;
  lastSnapshot = {
    at: new Date().toISOString(),
    ok: open === 0,
    open,
    checks,
  };

  for (const c of checks) {
    try { await maybeLogIssue(c); } catch (e) {
      logger.warn({ err: e?.message || e, probe: c.id }, 'health pulse log failed');
    }
  }
  return lastSnapshot;
}

export function startHealthPulse({ priceAggregator, isLeader }) {
  if (!isLeader) return () => {};
  let timer = null;
  const tick = () => {
    runHealthPulse({ priceAggregator }).catch((e) => {
      logger.warn({ err: e?.message || e }, 'health pulse failed');
    });
  };
  // First pass shortly after boot, then every 90s.
  const boot = setTimeout(tick, 25_000);
  timer = setInterval(tick, INTERVAL_MS);
  logger.info({ intervalMs: INTERVAL_MS }, 'health pulse started');
  return () => {
    clearTimeout(boot);
    if (timer) clearInterval(timer);
  };
}

export default startHealthPulse;
