/**
 * Strict action validation — never invent ETH/$50/leverage defaults.
 * Missing critical fields → null (+ optional reason for logging/tests).
 */

export const ACTION_TYPES = new Set([
  'task',
  'navigate',
  'futures.open',
  'futures.close',
  'swap.buy',
  'xstocks.buy',
  'xstocks.sell',
  'predict.bet',
  'advise',
  'trade.plan',
]);

export const PAGES = new Set([
  'wallet', 'futures', 'predict', 'xstocks', 'dashboard', 'history', 'settings', 'markets', 'spot', 'help', 'swap',
]);

export const LIMITS = {
  maxNotionalUsd: 25000,
  maxLeverage: 100,
  maxStakeUsd: 25000,
};

function finitePos(n) {
  const v = Number(n);
  return Number.isFinite(v) && v > 0 ? v : null;
}

function clampPresent(n, min, max) {
  const v = finitePos(n);
  if (v == null) return null;
  if (v < min || v > max) return null;
  return v;
}

function cleanAsset(s, max = 16) {
  const t = String(s || '').toUpperCase().replace(/[^A-Z0-9.]/g, '').slice(0, max);
  return t || null;
}

/**
 * @returns {{ action: object|null, error?: string }}
 */
export function sanitizeAction(raw, { maxLeverageForMarket = LIMITS.maxLeverage } = {}) {
  if (raw == null) return { action: null };
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    return { action: null, error: 'action_not_object' };
  }
  const type = String(raw.type || '').trim();
  if (!ACTION_TYPES.has(type)) return { action: null, error: 'unknown_action_type' };
  const paramsIn = (raw.params && typeof raw.params === 'object') ? raw.params : {};
  const params = {};

  if (type === 'task') {
    params.goal = String(paramsIn.goal || paramsIn.text || paramsIn.query || '').trim().slice(0, 400);
    if (!params.goal) return { action: null, error: 'task_goal_required' };
    const amt = clampPresent(paramsIn.amountUsd ?? paramsIn.usd ?? paramsIn.stakeUsd, 1, LIMITS.maxStakeUsd);
    if (amt != null) params.amountUsd = amt;
    if (paramsIn.query) params.query = String(paramsIn.query).trim().slice(0, 240);
    if (paramsIn.page && PAGES.has(String(paramsIn.page))) params.page = String(paramsIn.page);
  } else if (type === 'navigate') {
    let page = String(paramsIn.page || paramsIn.to || '').toLowerCase();
    if (page === 'swap') page = 'swap';
    if (!PAGES.has(page)) return { action: null, error: 'navigate_page_required' };
    params.page = page === 'swap' ? 'swap' : page;
  } else if (type === 'futures.open') {
    const market = cleanAsset(paramsIn.market || paramsIn.asset, 12);
    if (!market) return { action: null, error: 'futures_market_required' };
    const sideRaw = String(paramsIn.side || '').toLowerCase();
    if (sideRaw !== 'long' && sideRaw !== 'short' && sideRaw !== 'buy' && sideRaw !== 'sell') {
      return { action: null, error: 'futures_side_required' };
    }
    const notionalUsd = clampPresent(paramsIn.notionalUsd ?? paramsIn.usd ?? paramsIn.sizeUsd, 1, LIMITS.maxNotionalUsd);
    if (notionalUsd == null) return { action: null, error: 'futures_notional_required' };
    const levCap = Math.min(LIMITS.maxLeverage, Number(maxLeverageForMarket) || LIMITS.maxLeverage);
    const leverage = clampPresent(paramsIn.leverage ?? paramsIn.lev, 1, levCap);
    if (leverage == null) return { action: null, error: 'futures_leverage_required' };
    params.market = market;
    params.side = (sideRaw === 'short' || sideRaw === 'sell') ? 'short' : 'long';
    params.notionalUsd = notionalUsd;
    params.leverage = leverage;
    params.marginMode = String(paramsIn.marginMode || 'cross').toLowerCase() === 'isolated' ? 'isolated' : 'cross';
  } else if (type === 'futures.close') {
    const market = cleanAsset(paramsIn.market || paramsIn.asset, 12);
    if (!market) return { action: null, error: 'futures_market_required' };
    params.market = market;
  } else if (type === 'swap.buy') {
    const asset = cleanAsset(paramsIn.asset || paramsIn.to || paramsIn.symbol, 16);
    const fromAsset = cleanAsset(paramsIn.fromAsset || paramsIn.from || 'USDT', 16);
    const notionalUsd = clampPresent(paramsIn.notionalUsd ?? paramsIn.usd, 1, LIMITS.maxNotionalUsd);
    if (!asset) return { action: null, error: 'swap_asset_required' };
    if (notionalUsd == null) return { action: null, error: 'swap_notional_required' };
    params.asset = asset;
    params.fromAsset = fromAsset || 'USDT';
    params.notionalUsd = notionalUsd;
  } else if (type === 'xstocks.buy' || type === 'xstocks.sell') {
    const symbol = cleanAsset(paramsIn.symbol || paramsIn.asset || paramsIn.ticker, 16);
    const notionalUsd = clampPresent(paramsIn.notionalUsd ?? paramsIn.usd, 1, LIMITS.maxNotionalUsd);
    if (!symbol) return { action: null, error: 'xstocks_symbol_required' };
    if (notionalUsd == null) return { action: null, error: 'xstocks_notional_required' };
    params.symbol = symbol;
    params.notionalUsd = notionalUsd;
  } else if (type === 'predict.bet') {
    const query = String(paramsIn.query || paramsIn.event || paramsIn.market || paramsIn.goal || '').trim().slice(0, 240);
    if (!query) return { action: null, error: 'predict_query_required' };
    const sideRaw = String(paramsIn.side || paramsIn.outcome || '').toLowerCase();
    if (sideRaw !== 'yes' && sideRaw !== 'no') return { action: null, error: 'predict_side_required' };
    const stakeUsd = clampPresent(paramsIn.stakeUsd ?? paramsIn.notionalUsd ?? paramsIn.usd ?? paramsIn.amountUsd, 1, LIMITS.maxStakeUsd);
    if (stakeUsd == null) return { action: null, error: 'predict_stake_required' };
    params.query = query;
    params.side = sideRaw;
    params.stakeUsd = stakeUsd;
  } else if (type === 'advise') {
    const topic = String(paramsIn.topic || '').toLowerCase();
    if (!['coin', 'predict', 'stocks', 'futures'].includes(topic)) {
      return { action: null, error: 'advise_topic_required' };
    }
    params.topic = topic;
  } else if (type === 'trade.plan') {
    params.goal = String(paramsIn.goal || paramsIn.text || paramsIn.query || '').trim().slice(0, 400);
    if (!params.goal) return { action: null, error: 'trade_plan_goal_required' };
    const amt = clampPresent(paramsIn.amountUsd ?? paramsIn.usd ?? paramsIn.notionalUsd, 1, LIMITS.maxStakeUsd);
    if (amt != null) params.amountUsd = amt;
    if (paramsIn.horizon) params.horizon = String(paramsIn.horizon).slice(0, 40);
    if (paramsIn.risk) params.risk = String(paramsIn.risk).slice(0, 40);
  }

  const risk = (raw.risk && typeof raw.risk === 'object' && raw.risk.maxLossHint)
    ? { maxLossHint: String(raw.risk.maxLossHint).slice(0, 120) }
    : undefined;

  return {
    action: {
      type,
      params,
      confirmRequired: true,
      risk,
    },
  };
}

export function extractCoachPayload(text) {
  const raw = String(text || '').trim();
  if (!raw) return { reply: '', action: null, sanitizeError: null };

  const tryParse = (s) => {
    try {
      const j = JSON.parse(s);
      if (j && typeof j === 'object' && (typeof j.reply === 'string' || j.action !== undefined)) {
        const { action, error } = sanitizeAction(j.action);
        return {
          reply: String(j.reply || '').trim(),
          action,
          sanitizeError: error || null,
        };
      }
    } catch (_) {}
    return null;
  };

  let hit = tryParse(raw);
  if (hit) return hit;

  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) {
    hit = tryParse(fence[1].trim());
    if (hit) return hit;
  }

  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start >= 0 && end > start) {
    hit = tryParse(raw.slice(start, end + 1));
    if (hit) return hit;
  }

  return { reply: raw, action: null, sanitizeError: null };
}

export default sanitizeAction;
