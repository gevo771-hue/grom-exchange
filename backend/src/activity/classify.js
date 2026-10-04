/**
 * Heuristic "AI" classifier for client-reported exchange failures.
 * Maps raw error text / codes / detail → cause + Russian admin summary (no LLM).
 */

const RULES = [
  { cause: 'runtime_error', re: /runtime_error|unhandled_rejection/i, summary: 'Необработанная ошибка JavaScript в приложении' },
  { cause: 'health_api_slow', re: /health_api_slow/i, summary: 'Медленный ответ health API — это время запроса, не зависание UI' },
  {
    cause: 'user_rejected',
    re: /user rejected|denied|declined|4001|user cancelled|user canceled|connection cancelled|отклон|tx_rejected|siwe_rejected|you cancelled/i,
    summary: 'Пользователь отклонил подпись / транзакцию в кошельке',
  },
  {
    cause: 'wallet_no_confirm',
    re: /no.?confirm|awaiting_signature|did.?not.?confirm|never.?confirmed|pending.?wallet|tx_unknown|result unknown|check Activity|wallet.?timeout|timed out.*wallet/i,
    summary: 'Ответ кошелька не получен в срок — результат неизвестен, отказ не установлен',
  },
  {
    cause: 'siwe_wc_remote',
    re: /WalletConnect с телефона|не возвращает подпись|remote.?wc|session.*restore/i,
    summary: 'WalletConnect с телефона не отдал SIWE-подпись — нужен Trust Browser / QR-вход',
  },
  {
    cause: 'wallet_request_timeout',
    re: /Wallet request timed out|open Trust Wallet → Activity|connection timed out — approve|Trust Wallet connection timed out/i,
    summary: 'Таймаут запроса в кошельке (tx / WC approve) — не SIWE',
  },
  {
    cause: 'siwe_timeout',
    re: /siwe|подпись входа|sign.?in|login.*timeout|подпись не пришла|signature.*timeout|не пришла из кошелька/i,
    summary: 'Таймаут ожидания подписи входа (SIWE)',
  },
  {
    cause: 'siwe_verify',
    re: /signature verification|verify failed|invalid signature|nonce/i,
    summary: 'Сервер не принял SIWE-подпись (verify / nonce)',
  },
  {
    cause: 'rate_limit',
    re: /429|rate.?limit|lifi rate|too many requests|quote_rate_limit/i,
    summary: 'Лимит внешнего API (часто LiFi / quote) — при нагрузке копятся 429',
  },
  {
    cause: 'fee_unavailable',
    re: /fee not configured|lifi_fee_unavailable|lifi-fee-unavailable|1011|collecting fees/i,
    summary: 'Комиссия GROM недоступна на маршруте LiFi (fee wallet / 1011)',
  },
  {
    cause: 'quote_not_ready',
    re: /quote_not_ready|Route preview only|no wallet-ready|Waiting for on-chain route|exec.?ready.?false/i,
    summary: 'Нажал Start без исполняемого маршрута (preview / нет fee-verified quote)',
  },
  {
    cause: 'quote_fail',
    re: /no route|no quote|quote failed|aggregator|lifi.*fail|oc-quote/i,
    summary: 'Не удалось получить котировку свопа (нет маршрута или ошибка агрегатора)',
  },
  {
    cause: 'insufficient_funds',
    re: /insufficient|недостаточно|balance too low|exceeds balance|gas.*required|HL_NO_MARGIN|not enough/i,
    summary: 'Недостаточно баланса или газа для операции',
  },
  {
    cause: 'wrong_network',
    re: /wrong network|chain mismatch|switch.?network|unsupported chain|chainId|Switch your wallet to/i,
    summary: 'Неверная сеть в кошельке / нужен switch network',
  },
  {
    cause: 'tx_reverted',
    re: /revert|execution reverted|CALL_EXCEPTION|intrinsic gas/i,
    summary: 'Транзакция упала on-chain (revert)',
  },
  {
    cause: 'i18n_drift',
    re: /i18n|язык|lang.?mismatch|grom_lang|shell lang=|html lang=/i,
    summary: 'Расхождение языка UI (раздел не переключился вместе с глобальным)',
  },
  {
    cause: 'predict_poly',
    re: /polymarket|clob|polygon.*usdc|allowance|predict|order_failed.*predict/i,
    summary: 'Сбой ставки на прогнозах (Polymarket / Polygon USDC / allowance)',
  },
  {
    cause: 'hl_order',
    re: /hyperliquid|hl_|perps|futures.*order|margin|spot.?sell|spot.?buy|chain 1337|hl_order|order_failed/i,
    summary: 'Сбой ордера Hyperliquid (Spot / Perps / подпись Trust)',
  },
  {
    cause: 'spot_order',
    re: /spot_buy|spot_sell|hl-spot|product.?spot/i,
    summary: 'Сбой спот-ордера (Hyperliquid Spot)',
  },
  {
    cause: 'ui_lag',
    re: /long.?task|ui.?lag|подтормаж|main.?thread/i,
    summary: 'Зафиксирована длительная задача UI — источник задержки требует проверки',
  },
  {
    cause: 'xstocks',
    re: /xstock|ostium|rwa|stock|xstocks_soon|xstocks_catalog|«Скоро»/i,
    summary: 'Сбой покупки/продажи токенизированных акций / каталог «Скоро»',
  },
  {
    cause: 'markets_stale',
    re: /markets.?stale|markets_hip3|__hlMarkets|каталог рынков|нет рынков|HIP-3\/TradFi|still loading/i,
    summary: 'Каталог Markets/HL пустой или HIP-3/TradFi не загрузился',
  },
  {
    cause: 'network',
    re: /failed to fetch|networkerror|ECONN|ETIMEDOUT|offline|502|503|504/i,
    summary: 'Сетевая ошибка / недоступность API',
  },
  {
    cause: 'health_db',
    re: /postgresql|health_db|\bdb\b.*(?:медлен|недоступ)/i,
    summary: 'Проблема с базой данных (latency / downtime)',
  },
  {
    cause: 'health_redis',
    re: /redis|health_redis/i,
    summary: 'Проблема с Redis (кэш котировок / pub-sub)',
  },
  {
    cause: 'health_prices',
    re: /источник(?:ов)? цен|price.?feed|health_prices/i,
    summary: 'Сбой источников цен — котировки могут врать или устареть',
  },
  {
    cause: 'health_hl',
    re: /hyperliquid meta|health_hl|HL HTTP/i,
    summary: 'Hyperliquid недоступен / медленный — Markets и Trade под нагрузкой',
  },
  {
    cause: 'health_eventloop',
    re: /event-?loop|перегружен|health_eventloop/i,
    summary: 'Бэкенд перегружен (event-loop lag) — при росте юзеров биржа будет тупить',
  },
  {
    cause: 'health_memory',
    re: /RSS|память|health_memory|scale-out/i,
    summary: 'Высокое потребление памяти — нужен мониторинг / scale-out',
  },
];

const PRODUCT_HINT = {
  wallet: 'Кошелёк / вход',
  auth: 'Авторизация',
  swap: 'Своп',
  futures: 'Фьючи',
  predict: 'Прогнозы',
  xstocks: 'Акции',
  spot: 'Спот',
  markets: 'Рынки',
  system: 'Система',
  other: 'Другое',
};

const ACTION_FORCE = {
  runtime_error: 'runtime_error',
  unhandled_rejection: 'runtime_error',
  health_api_slow: 'health_api_slow',
  tx_rejected: 'user_rejected',
  siwe_rejected: 'user_rejected',
  swap_user_cancel: 'user_rejected',
  wallet_no_confirm: 'wallet_no_confirm',
  tx_unknown: 'wallet_no_confirm',
  quote_not_ready: 'quote_not_ready',
  swap_blocked_preview: 'quote_not_ready',
  lifi_fee_unavailable: 'fee_unavailable',
  quote_rate_limit: 'rate_limit',
  i18n_drift: 'i18n_drift',
  ui_lag: 'ui_lag',
  markets_stale: 'markets_stale',
  markets_hip3_empty: 'markets_stale',
  markets_hip3_ui_empty: 'markets_stale',
};

function pickStr(...vals) {
  for (const v of vals) {
    const s = String(v == null ? '' : v).trim();
    if (s) return s;
  }
  return '';
}

/** Compact route / product context for admin one-liner. */
export function formatIssueContext(detail = {}, product = '') {
  const d = detail && typeof detail === 'object' ? detail : {};
  const bits = [];
  const walletLbl = pickStr(d.walletLabel, d.wallet_label, d.walletName);
  if (walletLbl) bits.push(walletLbl);
  const mobile = d.mobile === true || d.isMobile === true;
  if (mobile) bits.push('mobile');
  if (d.wcRemote === true) bits.push('WC→phone');

  const fromChain = pickStr(d.fromChainLabel, d.fromChain, d.chainLabel, d.chain);
  const toChain = pickStr(d.toChainLabel, d.toChain);
  if (fromChain && toChain && String(fromChain) !== String(toChain)) {
    bits.push(`${fromChain}→${toChain}`);
  } else if (fromChain) {
    bits.push(String(fromChain));
  } else if (d.chainId != null && d.chainId !== '') {
    bits.push(`chain ${d.chainId}`);
  }

  const from = pickStr(d.from, d.fromSym, d.asset);
  const to = pickStr(d.to, d.toSym);
  if (from && to) bits.push(`${from}→${to}`);
  else if (from) bits.push(from);

  if (d.amt != null && d.amt !== '' && Number(d.amt) > 0) bits.push(String(d.amt));
  else if (d.size != null && d.size !== '') bits.push(`sz ${d.size}`);

  if (d.side) bits.push(String(d.side));
  if (d.contract || d.coin) bits.push(String(d.contract || d.coin));
  if (d.aggregator) bits.push(String(d.aggregator));
  if (d.stage) bits.push(`stage:${d.stage}`);
  if (d.kind) bits.push(String(d.kind));
  if (d.quoteReady === false) bits.push('quote≠ready');
  if (d.bridgeErr) bits.push(String(d.bridgeErr));

  if (product === 'predict' && d.slug) bits.push(String(d.slug).slice(0, 40));
  if (product === 'xstocks' && d.sym) bits.push(String(d.sym));

  return bits.filter(Boolean).slice(0, 10).join(' · ');
}

/**
 * @param {{ product?: string, action?: string, message?: string, code?: string|number, detail?: object }} input
 */
export function classifyIssue(input = {}) {
  const product = String(input.product || 'other');
  const action = String(input.action || 'error');
  const msg = String(input.message || input.detail?.message || input.detail?.error || '');
  const code = input.code != null ? String(input.code) : String(input.detail?.code || '');
  const detail = input.detail && typeof input.detail === 'object' ? input.detail : {};
  const blob = `${action} ${msg} ${code} ${JSON.stringify(detail).slice(0, 600)}`;

  let hit = null;

  if (code === '4001' || detail.kind === 'cancelled') {
    hit = RULES.find((r) => r.cause === 'user_rejected');
  }
  if (!hit && ACTION_FORCE[action]) {
    const cause = ACTION_FORCE[action];
    hit = RULES.find((r) => r.cause === cause) || { cause, summary: cause };
  }
  if (!hit && detail.kind === 'cancelled') {
    hit = RULES.find((r) => r.cause === 'user_rejected');
  }
  if (!hit && (detail.kind === 'no_confirm' || detail.kind === 'unknown' || detail.abandoned === true)) {
    hit = RULES.find((r) => r.cause === 'wallet_no_confirm');
  }

  if (!hit && (action === 'i18n_drift' || /shell lang=|html lang=.*grom_lang/i.test(msg))) {
    hit = RULES.find((r) => r.cause === 'i18n_drift');
  }
  if (!hit && (action === 'ui_lag' || /long\s*task|ui[_\s-]?lag|подтормаж/i.test(msg))) {
    hit = RULES.find((r) => r.cause === 'ui_lag');
  }
  if (!hit && (action === 'markets_stale' || action === 'markets_hip3_empty' || action === 'markets_hip3_ui_empty'
    || /HIP-3|каталог.*HL|__hlMarkets|still loading/i.test(msg))) {
    hit = RULES.find((r) => r.cause === 'markets_stale');
  }
  if (!hit && (/^xstocks_/.test(action) || /xstocks_soon|xstocks_catalog|«Скоро»/i.test(action + msg))) {
    hit = RULES.find((r) => r.cause === 'xstocks');
  }
  if (!hit && /^health_/.test(action)) {
    hit = RULES.find((r) => r.cause === action) || null;
  }
  if (!hit) hit = RULES.find((r) => r.re.test(blob));
  if (!hit && /siwe|sign.?in|login|connect/i.test(action + product)) {
    hit = { cause: 'siwe_other', summary: 'Сбой входа / подключения кошелька' };
  }
  if (!hit && product === 'swap') {
    hit = { cause: 'swap_other', summary: 'Сбой свопа (причина не распознана по тексту)' };
  }
  if (!hit && product === 'futures') {
    hit = { cause: 'hl_order', summary: 'Сбой фьючерсного / HL ордера' };
  }
  if (!hit && product === 'predict') {
    hit = { cause: 'predict_poly', summary: 'Сбой прогнозов' };
  }
  if (!hit && product === 'xstocks') {
    hit = { cause: 'xstocks', summary: 'Сбой токенизированных акций' };
  }
  if (!hit) {
    hit = { cause: 'unknown', summary: 'Неизвестная ошибка — смотрите сырой текст' };
  }

  const productLabel = PRODUCT_HINT[product] || product;
  const ctx = formatIssueContext(detail, product);
  const brief = pickStr(detail.admin_brief, detail.brief);
  let ai_summary = `${productLabel}: ${hit.summary}`;
  if (ctx) ai_summary += ` · ${ctx}`;
  if (brief) ai_summary += ` · ${brief.slice(0, 160)}`;
  else if (msg) ai_summary += ` · «${msg.slice(0, 140)}»`;
  ai_summary = ai_summary.slice(0, 480);

  let severity = hit.cause === 'user_rejected' || hit.cause === 'i18n_drift' || hit.cause === 'wallet_no_confirm'
    ? 'info'
    : (hit.cause === 'rate_limit' || hit.cause === 'network' || hit.cause === 'ui_lag' || hit.cause === 'quote_not_ready'
      ? 'warn' : 'error');
  if (hit.cause === 'ui_lag') {
    const ms = Number(detail.ms);
    if (Number.isFinite(ms) && ms < 800) severity = 'info';
  }
  if (hit.cause === 'fee_unavailable') severity = 'error';

  return {
    cause: hit.cause,
    ai_summary,
    severity,
  };
}

export default classifyIssue;
