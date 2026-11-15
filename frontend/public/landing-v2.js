/**
 * Landing v2 final — Batch 1 fix-pass + diagram.
 * Gate: window.LANDING_V2 !== false
 * Nav untouched. Legacy Instant Swap cards hidden via CSS.
 * Copy: final RU from LANDING-V2-MOCKUP.html (do not rewrite).
 */
(function () {
  'use strict';
  if (window.LANDING_V2 === false) return;
  window.LANDING_V2 = true;
  try { document.documentElement.classList.add('lv2-on'); } catch (_) {}

  var REFRESH_MS = 180_000;
  var _timer = null;
  var _l3Live = null;
  var _cache = Object.create(null);
  var _painted = false;
  var _lang = '';
  var _live = { perps: null, predict: null, stocks: null, eth: null };
  var _faqLocked = false;

  function lv2StableUi() {
    return !!(window.GROM_STABLE_UI || window.GROM_SAFARI
      || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent || ''));
  }

  /* Hero H1 stays English on every locale (owner, 2026-11-15: the four markets read like a trading floor) */
  var H1_LINE1 = 'Stocks. Perps. Predictions.';
  var H1_LINE2 = 'One wallet.';
  var H1_EN = '<span class="lv2-h1-line l3-h1-mk"><span class="l3-w is-stk">Stocks.</span> <span class="l3-w is-prp">Perps.</span> <span class="l3-w is-prd">Predictions.</span></span><br><span class="lv2-h1-line lv2-accent">One wallet.</span>';

  var I18N = {
    ru: {
      quote_example: "Пример расчёта · не котировка",
      compare_estimate: "Расчёт",
      compare_note: "Модель, не котировка: условный результат 1inch на 0,67% ниже. Газ и комиссии не учтены.",
      kicker: 'Non-custodial · Swap · Futures · Прогнозы · Акции',
      kicker_m: 'Non-custodial · Swap · Futures · Predictions · Stocks',
      h1: H1_EN,
      sub: 'Свопай 10 000+ токенов, торгуй Futures, ставь на события, покупай токенизированные акции — всё из твоего кошелька. Без регистрации, без KYC, без депозитов на GROM.',
      sub_m: 'Swap, Futures, прогнозы и акции — из своего кошелька. Без KYC и без депозитов на GROM.',
      cta1: 'Подключить кошелёк →',
      cta2: 'Открыть дашборд',
      trust: ["Non-custodial", "Межсетевой своп", "Доступные маршруты"],
      trust_m: ["Non-custodial", "Межсетевой своп"],
      tab_swap: 'Swap', tab_perps: 'Futures', tab_predict: 'Прогнозы', tab_stocks: 'Акции',
      card_perps: 'GROM Futures', card_predict: 'GROM Прогнозы', card_stocks: 'GROM Акции',
      pay: 'Ты платишь', get: 'Ты получаешь', bal: 'Баланс',
      rate: 'Курс', save: 'Экономия', vs: 'vs 1inch',
      route: 'Маршрут:', route_best: "После запроса котировки",
      connect: 'Подключить кошелёк →',
      funding: 'Фандинг', funding_period: '8ч',
      yes: 'Да', no: 'Нет', chance: 'шанс',
      perps_meta: "До 40× · условия рынка",
      open_trade: 'Открыть сделку →',
      open_predict: 'Открыть прогнозы →',
      pred_hint: '↳ Ставь из своего кошелька — без proxy-фондирования',
      stocks_meta: 'тикер · 24/7 · дробные от $0,01',
      browse_stocks: 'Смотреть акции →',
      diag_eye: 'Почему GROM',
      diag_h: 'Подключился один раз. Торгуешь везде.',
      diag_sub: 'Твой кошелёк — твой аккаунт. Swap, Futures, прогнозы, акции — всё одной подписью. GROM никогда не держит средства.',
      diag_wallet: 'ТВОЙ КОШЕЛЁК',
      diag_swap: 'Swap · 10к токенов',
      diag_perps: 'Futures · до 40×',
      diag_pred: 'Прогнозы',
      diag_stocks: 'Акции 24/7',
      diag_swap_m: 'Swap',
      diag_perps_m: 'Futures',
      diag_pred_m: 'Прогнозы',
      diag_stocks_m: 'Акции',
      diag_cap: '<strong>Никаких депозитов на GROM.</strong> Каждая сделка подписана твоим кошельком и исполнена ончейн.',
      updates: '🚀 <b>Только что:</b> Акции · Прогнозы · Futures · Cross-chain',
      faq_q: 'Как работает GROM DEX?',
      faq_a: "GROM сравнивает доступные маршруты для выбранных токенов, сетей и суммы. Провайдеры, комиссии и итоговая сумма зависят от текущей котировки. Проверь детали и подтверди каждую необходимую операцию в своём кошельке.",
      cmp_eye: 'Сравнение',
      cmp_h: 'Почему ончейн важнее',
      cmp_sub: 'Тот же функционал, что у крупных площадок — без кастодии, KYC и географических ограничений.',
      lp_v2_cmp_cex: 'CEX', lp_v2_cmp_broker: 'Брокер',
      lp_v2_cmp_perps_hook: 'Futures без биржи, без KYC, без риска блокировки',
      lp_v2_cmp_perps_vs: 'vs Binance / Bybit',
      lp_v2_cmp_perps_slogan: 'Ты подписал — блокчейн исполнил. Биржи здесь нет.',
      lp_v2_cmp_perps_r1_k: 'Верификация личности', lp_v2_cmp_perps_r1_a: 'Паспорт + селфи', lp_v2_cmp_perps_r1_b: 'Нет. Никогда.',
      lp_v2_cmp_perps_r2_k: 'Где лежат средства', lp_v2_cmp_perps_r2_a: 'На счёте биржи', lp_v2_cmp_perps_r2_b: 'В твоём кошельке',
      lp_v2_cmp_perps_r3_k: 'Комиссия тейкера', lp_v2_cmp_perps_r3_a: '0,04–0,06%', lp_v2_cmp_perps_r3_b: '0,05% фикс',
      lp_v2_cmp_perps_r4_k: 'Максимальное плечо', lp_v2_cmp_perps_r4_a: '125×', lp_v2_cmp_perps_r4_b: '40×',
      lp_v2_cmp_perps_r5_k: 'Доступ из США', lp_v2_cmp_perps_r5_a: 'Заблокирован', lp_v2_cmp_perps_r5_b: 'Работает',
      lp_v2_cmp_perps_r6_k: 'Заморозка вывода', lp_v2_cmp_perps_r6_a: 'Возможна в любой момент', lp_v2_cmp_perps_r6_b: 'Технически невозможна',
      lp_v2_cmp_pred_hook: 'Ставки на мир без брокера, без лимитов, без границ',
      lp_v2_cmp_pred_vs: 'vs DraftKings / Kalshi / PredictIt',
      lp_v2_cmp_pred_slogan: 'Ставка — это подпись. А не депозит на чужой счёт.',
      lp_v2_cmp_pred_r1_k: 'Выплата', lp_v2_cmp_pred_r1_a: 'Фиат банковским чеком', lp_v2_cmp_pred_r1_b: 'USDC мгновенно, ончейн',
      lp_v2_cmp_pred_r2_k: 'Где работает', lp_v2_cmp_pred_r2_a: 'Только США (и то не везде)', lp_v2_cmp_pred_r2_b: 'Весь мир',
      lp_v2_cmp_pred_r3_k: 'Лимит на позицию', lp_v2_cmp_pred_r3_a: '$850 (PredictIt)', lp_v2_cmp_pred_r3_b: 'Без лимита',
      lp_v2_cmp_pred_r4_k: 'Верификация личности', lp_v2_cmp_pred_r4_a: 'SSN + документы', lp_v2_cmp_pred_r4_b: 'Ничего',
      lp_v2_cmp_pred_r5_k: 'Средства хранит', lp_v2_cmp_pred_r5_a: 'Брокер / оператор', lp_v2_cmp_pred_r5_b: 'Твой кошелёк',
      lp_v2_cmp_pred_r6_k: 'Депозит на proxy-счёт', lp_v2_cmp_pred_r6_a: 'Обязателен', lp_v2_cmp_pred_r6_b: 'Не нужен. Ставишь напрямую.',
      lp_v2_cmp_stk_hook: 'Реальные акции — 24/7, из любой точки мира, в твоём кошельке',
      lp_v2_cmp_stk_vs: 'vs Robinhood / E*TRADE',
      lp_v2_cmp_stk_slogan: 'Ты держишь Apple, а не бумажку от Robinhood.',
      lp_v2_cmp_stk_r1_k: 'Часы торгов', lp_v2_cmp_stk_r1_a: '09:30–16:00 ET, будни', lp_v2_cmp_stk_r1_b: '24/7 без выходных',
      lp_v2_cmp_stk_r2_k: 'Где работает', lp_v2_cmp_stk_r2_a: 'Только США', lp_v2_cmp_stk_r2_b: 'Весь мир',
      lp_v2_cmp_stk_r3_k: 'Минимальная сумма', lp_v2_cmp_stk_r3_a: '$1', lp_v2_cmp_stk_r3_b: '$0,01',
      lp_v2_cmp_stk_r4_k: 'Где хранятся акции', lp_v2_cmp_stk_r4_a: 'На счёте брокера', lp_v2_cmp_stk_r4_b: 'Токены в твоём кошельке',
      lp_v2_cmp_stk_r5_k: 'Дивиденды', lp_v2_cmp_stk_r5_a: 'Начисление до 5 дней', lp_v2_cmp_stk_r5_b: 'Ончейн-выплата в USDC',
      lp_v2_cmp_stk_r6_k: 'Продать в субботу', lp_v2_cmp_stk_r6_a: 'Невозможно', lp_v2_cmp_stk_r6_b: 'Свободно, любой час',
      tip_perps_q: 'Что такое Futures?',
      tip_perps_a: 'Бессрочные фьючерсы (perpetuals): торгуешь BTC/ETH/SOL с плечом до 40×. Маржа на Hyperliquid, PnL и funding — ончейн. GROM не держит твои средства.',
      tip_predict_q: 'Как работают прогнозы?',
      tip_predict_a: 'Ставишь USDC на исход события (Yes/No). Цена = рыночная вероятность. Выплата в USDC на твой кошелёк — без proxy-депозита и без KYC на GROM.',
      tip_stocks_q: 'Это настоящие акции?',
      tip_stocks_a: 'Токенизированные акции (xStocks): ончейн-требования на базовый актив. Торговля 24/7, дробные от $0,01, расчёт в кошелёк — не брокерский счёт.',
    },
    en: {
      quote_example: "Illustration · not a quote",
      compare_estimate: "Estimate",
      compare_note: "Model, not a quote: assumes 1inch returns 0.67% less. Gas and fees excluded.",
      kicker: 'Non-custodial · Swap · Futures · Predictions · Stocks',
      kicker_m: 'Non-custodial · Swap · Futures · Predictions · Stocks',
      h1: H1_EN,
      sub: 'Swap 10,000+ tokens, trade futures, bet on outcomes, own tokenized stocks — all from your own wallet. No sign-up, no KYC, no deposits to GROM.',
      sub_m: 'Swap, futures, predictions and stocks — from your wallet. No KYC, no deposits to GROM.',
      cta1: 'Connect wallet →',
      cta2: 'Open dashboard',
      trust: ["Non-custodial", "Cross-chain swaps", "Available routes"],
      trust_m: ["Non-custodial", "Cross-chain swaps"],
      tab_swap: 'Swap', tab_perps: 'Futures', tab_predict: 'Predictions', tab_stocks: 'Stocks',
      card_perps: 'GROM Futures', card_predict: 'GROM Predictions', card_stocks: 'GROM Stocks',
      pay: 'You pay', get: 'You receive', bal: 'Balance',
      rate: 'Rate', save: 'Saved', vs: 'vs 1inch',
      route: 'Route:', route_best: "After requesting a quote",
      connect: 'Connect wallet →',
      funding: 'Funding', funding_period: '8h',
      yes: 'Yes', no: 'No', chance: 'chance',
      perps_meta: "Up to 40× · market conditions",
      open_trade: 'Open trade →',
      open_predict: 'Open predictions →',
      pred_hint: '↳ Bet from your own wallet — no proxy funding',
      stocks_meta: 'tickers · 24/7 · fractional from $0.01',
      browse_stocks: 'Browse stocks →',
      diag_eye: 'Why GROM',
      diag_h: 'Connect once. Trade everywhere.',
      diag_sub: 'Your wallet is your account. Swap, futures, predictions, stocks — one signature. GROM never holds funds.',
      diag_wallet: 'YOUR WALLET',
      diag_swap: 'Swap · 10k tokens',
      diag_perps: 'Futures · up to 40×',
      diag_pred: 'Predictions',
      diag_stocks: 'Stocks 24/7',
      diag_swap_m: 'Swap',
      diag_perps_m: 'Futures',
      diag_pred_m: 'Predict',
      diag_stocks_m: 'Stocks',
      diag_cap: '<strong>No deposits to GROM.</strong> Every trade is signed by your wallet and settled on-chain.',
      updates: '🚀 <b>Just shipped:</b> Stocks · Predictions · Futures · Cross-chain',
      faq_q: 'How does GROM DEX work?',
      faq_a: "GROM compares available routes for your selected tokens, networks and amount. Providers, fees and output depend on the current quote. Review the details and confirm each required operation in your own wallet.",
      cmp_eye: 'Compare',
      cmp_h: 'Why on-chain wins',
      cmp_sub: 'The same product surface as big venues — without custody, KYC, or geo lockouts.',
      lp_v2_cmp_cex: 'CEX', lp_v2_cmp_broker: 'Broker',
      lp_v2_cmp_perps_hook: 'Futures without an exchange, KYC, or freeze risk',
      lp_v2_cmp_perps_vs: 'vs Binance / Bybit',
      lp_v2_cmp_perps_slogan: 'You signed — the chain filled. No exchange in the middle.',
      lp_v2_cmp_perps_r1_k: 'Identity verification', lp_v2_cmp_perps_r1_a: 'Passport + selfie', lp_v2_cmp_perps_r1_b: 'No. Never.',
      lp_v2_cmp_perps_r2_k: 'Where funds sit', lp_v2_cmp_perps_r2_a: 'On the exchange account', lp_v2_cmp_perps_r2_b: 'In your wallet',
      lp_v2_cmp_perps_r3_k: 'Taker fee', lp_v2_cmp_perps_r3_a: '0.04–0.06%', lp_v2_cmp_perps_r3_b: '0.05% flat',
      lp_v2_cmp_perps_r4_k: 'Max leverage', lp_v2_cmp_perps_r4_a: '125×', lp_v2_cmp_perps_r4_b: '40×',
      lp_v2_cmp_perps_r5_k: 'US access', lp_v2_cmp_perps_r5_a: 'Blocked', lp_v2_cmp_perps_r5_b: 'Works',
      lp_v2_cmp_perps_r6_k: 'Withdrawal freeze', lp_v2_cmp_perps_r6_a: 'Possible anytime', lp_v2_cmp_perps_r6_b: 'Technically impossible',
      lp_v2_cmp_pred_hook: 'Bets on the world — no broker, no caps, no borders',
      lp_v2_cmp_pred_vs: 'vs DraftKings / Kalshi / PredictIt',
      lp_v2_cmp_pred_slogan: 'A bet is a signature. Not a deposit on someone else\'s books.',
      lp_v2_cmp_pred_r1_k: 'Payout', lp_v2_cmp_pred_r1_a: 'Fiat by bank check', lp_v2_cmp_pred_r1_b: 'USDC instantly, on-chain',
      lp_v2_cmp_pred_r2_k: 'Where it works', lp_v2_cmp_pred_r2_a: 'US only (and not everywhere)', lp_v2_cmp_pred_r2_b: 'Worldwide',
      lp_v2_cmp_pred_r3_k: 'Position limit', lp_v2_cmp_pred_r3_a: '$850 (PredictIt)', lp_v2_cmp_pred_r3_b: 'No limit',
      lp_v2_cmp_pred_r4_k: 'Identity verification', lp_v2_cmp_pred_r4_a: 'SSN + documents', lp_v2_cmp_pred_r4_b: 'Nothing',
      lp_v2_cmp_pred_r5_k: 'Who holds funds', lp_v2_cmp_pred_r5_a: 'Broker / operator', lp_v2_cmp_pred_r5_b: 'Your wallet',
      lp_v2_cmp_pred_r6_k: 'Proxy account deposit', lp_v2_cmp_pred_r6_a: 'Required', lp_v2_cmp_pred_r6_b: 'Not needed. Bet directly.',
      lp_v2_cmp_stk_hook: 'Real stocks — 24/7, from anywhere, in your wallet',
      lp_v2_cmp_stk_vs: 'vs Robinhood / E*TRADE',
      lp_v2_cmp_stk_slogan: 'You hold Apple — not a slip from Robinhood.',
      lp_v2_cmp_stk_r1_k: 'Trading hours', lp_v2_cmp_stk_r1_a: '09:30–16:00 ET, weekdays', lp_v2_cmp_stk_r1_b: '24/7, no weekends off',
      lp_v2_cmp_stk_r2_k: 'Where it works', lp_v2_cmp_stk_r2_a: 'US only', lp_v2_cmp_stk_r2_b: 'Worldwide',
      lp_v2_cmp_stk_r3_k: 'Minimum size', lp_v2_cmp_stk_r3_a: '$1', lp_v2_cmp_stk_r3_b: '$0.01',
      lp_v2_cmp_stk_r4_k: 'Where shares sit', lp_v2_cmp_stk_r4_a: 'In a brokerage account', lp_v2_cmp_stk_r4_b: 'Tokens in your wallet',
      lp_v2_cmp_stk_r5_k: 'Dividends', lp_v2_cmp_stk_r5_a: 'Up to 5 days to settle', lp_v2_cmp_stk_r5_b: 'On-chain payout in USDC',
      lp_v2_cmp_stk_r6_k: 'Sell on Saturday', lp_v2_cmp_stk_r6_a: 'Impossible', lp_v2_cmp_stk_r6_b: 'Anytime, any hour',
      tip_perps_q: 'What are futures?',
      tip_perps_a: 'Perpetual futures: trade BTC/ETH/SOL with up to 40×. Margin on Hyperliquid, PnL and funding on-chain. GROM never holds your funds.',
      tip_predict_q: 'How do predictions work?',
      tip_predict_a: 'Stake USDC on an outcome (Yes/No). Price = market probability. Payout lands in your wallet — no proxy deposit, no GROM KYC.',
      tip_stocks_q: 'Are these real stocks?',
      tip_stocks_a: 'Tokenized stocks (xStocks): on-chain claims on the underlying. Trade 24/7, fractionals from $0.01, settle to your wallet — not a brokerage account.',
    },
    ua: {
      quote_example: "Приклад розрахунку · не котирування",
      compare_estimate: "Розрахунок",
      compare_note: "Модель, не котирування: умовний результат 1inch на 0,67% нижчий. Газ і комісії не враховані.",
      kicker: 'Non-custodial · Swap · Ф\'ючерси · Прогнози · Акції',
      kicker_m: 'Non-custodial · Swap · Futures · Predictions · Stocks',
      h1: H1_EN,
      sub: 'Свопай 10 000+ токенів, торгуй ф\'ючерси, став на події, купуй токенізовані акції — усе зі свого гаманця. Без реєстрації, без KYC, без депозитів на GROM.',
      sub_m: 'Swap, ф\'ючерси, прогнози й акції — зі свого гаманця. Без KYC і без депозитів на GROM.',
      cta1: 'Підключити гаманець →',
      cta2: 'Відкрити дашборд',
      trust: ["Non-custodial", "Міжмережевий своп", "Доступні маршрути"],
      trust_m: ["Non-custodial", "Міжмережевий своп"],
      tab_swap: 'Swap', tab_perps: 'Futures', tab_predict: 'Прогнози', tab_stocks: 'Акції',
      card_perps: 'GROM Futures', card_predict: 'GROM Прогнози', card_stocks: 'GROM Акції',
      pay: 'Ти платиш', get: 'Ти отримуєш', bal: 'Баланс',
      rate: 'Курс', save: 'Економія', vs: 'vs 1inch',
      route: 'Маршрут:', route_best: "Після запиту котирування",
      connect: 'Підключити гаманець →',
      funding: 'Фандинг', funding_period: '8г',
      yes: 'Так', no: 'Ні',
      perps_meta: "До 40× · умови ринку",
      open_trade: 'Відкрити угоду →',
      open_predict: 'Відкрити прогнози →',
      pred_hint: '↳ Став зі свого гаманця — без proxy-фондування',
      stocks_meta: 'тикерів · 24/7 · дробові від $0,01',
      browse_stocks: 'Дивитись акції →',
      diag_eye: 'Чому GROM',
      diag_h: 'Підключився один раз. Торгуєш скрізь.',
      diag_sub: 'Твій гаманець — твій акаунт. Swap, Futures, прогнози, акції — одним підписом. GROM ніколи не тримає кошти.',
      diag_wallet: 'ТВІЙ ГАМАНЕЦЬ',
      diag_swap: 'Swap · 10к токенів',
      diag_perps: 'Futures · до 40×',
      diag_pred: 'Прогнози',
      diag_stocks: 'Акції 24/7',
      diag_swap_m: 'Swap',
      diag_perps_m: 'Futures',
      diag_pred_m: 'Прогнози',
      diag_stocks_m: 'Акції',
      diag_cap: '<strong>Жодних депозитів на GROM.</strong> Кожну угоду підписує твій гаманець і виконує ончейн.',
      updates: '🚀 <b>Щойно:</b> Акції · Прогнози · Futures · Cross-chain',
      faq_q: 'Як працює GROM DEX?',
      faq_a: "GROM порівнює доступні маршрути для вибраних токенів, мереж і суми. Провайдери, комісії та результат залежать від поточного котирування. Перевір деталі й підтвердь кожну потрібну операцію у своєму гаманці.",
      cmp_eye: 'Порівняння',
      cmp_h: 'Чому ончейн важливіший',
      cmp_sub: 'Той самий функціонал, що у великих майданчиків — без кастодії, KYC і гео-обмежень.',
      lp_v2_cmp_cex: 'CEX', lp_v2_cmp_broker: 'Брокер',
      lp_v2_cmp_perps_hook: 'Futures без біржі, без KYC, без ризику блокування',
      lp_v2_cmp_perps_vs: 'vs Binance / Bybit',
      lp_v2_cmp_perps_slogan: 'Ти підписав — блокчейн виконав. Біржі тут немає.',
      lp_v2_cmp_perps_r1_k: 'Верифікація особи', lp_v2_cmp_perps_r1_a: 'Паспорт + селфі', lp_v2_cmp_perps_r1_b: 'Ні. Ніколи.',
      lp_v2_cmp_perps_r2_k: 'Де лежать кошти', lp_v2_cmp_perps_r2_a: 'На рахунку біржі', lp_v2_cmp_perps_r2_b: 'У твоєму гаманці',
      lp_v2_cmp_perps_r3_k: 'Комісія тейкера', lp_v2_cmp_perps_r3_a: '0,04–0,06%', lp_v2_cmp_perps_r3_b: '0,05% фікс',
      lp_v2_cmp_perps_r4_k: 'Максимальне плече', lp_v2_cmp_perps_r4_a: '125×', lp_v2_cmp_perps_r4_b: '40×',
      lp_v2_cmp_perps_r5_k: 'Доступ із США', lp_v2_cmp_perps_r5_a: 'Заблоковано', lp_v2_cmp_perps_r5_b: 'Працює',
      lp_v2_cmp_perps_r6_k: 'Заморозка виводу', lp_v2_cmp_perps_r6_a: 'Можлива в будь-який момент', lp_v2_cmp_perps_r6_b: 'Технічно неможлива',
      lp_v2_cmp_pred_hook: 'Ставки на світ без брокера, без лімітів, без кордонів',
      lp_v2_cmp_pred_vs: 'vs DraftKings / Kalshi / PredictIt',
      lp_v2_cmp_pred_slogan: 'Ставка — це підпис. А не депозит на чужий рахунок.',
      lp_v2_cmp_pred_r1_k: 'Виплата', lp_v2_cmp_pred_r1_a: 'Фіат банківським чеком', lp_v2_cmp_pred_r1_b: 'USDC миттєво, ончейн',
      lp_v2_cmp_pred_r2_k: 'Де працює', lp_v2_cmp_pred_r2_a: 'Лише США (і то не всюди)', lp_v2_cmp_pred_r2_b: 'Весь світ',
      lp_v2_cmp_pred_r3_k: 'Ліміт на позицію', lp_v2_cmp_pred_r3_a: '$850 (PredictIt)', lp_v2_cmp_pred_r3_b: 'Без ліміту',
      lp_v2_cmp_pred_r4_k: 'Верифікація особи', lp_v2_cmp_pred_r4_a: 'SSN + документи', lp_v2_cmp_pred_r4_b: 'Нічого',
      lp_v2_cmp_pred_r5_k: 'Кошти тримає', lp_v2_cmp_pred_r5_a: 'Брокер / оператор', lp_v2_cmp_pred_r5_b: 'Твій гаманець',
      lp_v2_cmp_pred_r6_k: 'Депозит на proxy-рахунок', lp_v2_cmp_pred_r6_a: 'Обов\'язковий', lp_v2_cmp_pred_r6_b: 'Не потрібен. Ставиш напряму.',
      lp_v2_cmp_stk_hook: 'Реальні акції — 24/7, з будь-якої точки світу, у твоєму гаманці',
      lp_v2_cmp_stk_vs: 'vs Robinhood / E*TRADE',
      lp_v2_cmp_stk_slogan: 'Ти тримаєш Apple, а не папірець від Robinhood.',
      lp_v2_cmp_stk_r1_k: 'Години торгівлі', lp_v2_cmp_stk_r1_a: '09:30–16:00 ET, будні', lp_v2_cmp_stk_r1_b: '24/7 без вихідних',
      lp_v2_cmp_stk_r2_k: 'Де працює', lp_v2_cmp_stk_r2_a: 'Лише США', lp_v2_cmp_stk_r2_b: 'Весь світ',
      lp_v2_cmp_stk_r3_k: 'Мінімальна сума', lp_v2_cmp_stk_r3_a: '$1', lp_v2_cmp_stk_r3_b: '$0,01',
      lp_v2_cmp_stk_r4_k: 'Де зберігаються акції', lp_v2_cmp_stk_r4_a: 'На рахунку брокера', lp_v2_cmp_stk_r4_b: 'Токени у твоєму гаманці',
      lp_v2_cmp_stk_r5_k: 'Дивіденди', lp_v2_cmp_stk_r5_a: 'Нарахування до 5 днів', lp_v2_cmp_stk_r5_b: 'Ончейн-виплата в USDC',
      lp_v2_cmp_stk_r6_k: 'Продати в суботу', lp_v2_cmp_stk_r6_a: 'Неможливо', lp_v2_cmp_stk_r6_b: 'Вільно, будь-якої години',
      tip_perps_q: 'Що таке ф\'ючерси?',
      tip_perps_a: 'Безстрокові ф\'ючерси: торгуєш BTC/ETH/SOL з плечем до 40×. Маржа на Hyperliquid, PnL і funding — ончейн. GROM не тримає твої кошти.',
      tip_predict_q: 'Як працюють прогнози?',
      tip_predict_a: 'Ставиш USDC на результат події (Yes/No). Ціна = ринкова ймовірність. Виплата в USDC на твій гаманець — без proxy-депозиту і без KYC на GROM.',
      tip_stocks_q: 'Це справжні акції?',
      tip_stocks_a: 'Токенізовані акції (xStocks): ончейн-вимоги на базовий актив. Торгівля 24/7, дробові від $0,01, розрахунок у гаманець — не брокерський рахунок.',
    },
  };

  /* Secondary UI langs: EN body + localized product names (tabs / diagram / cards). */
  (function seedProductLocales() {
    function clone(base, over) {
      var o = {};
      Object.keys(base).forEach(function (k) { o[k] = base[k]; });
      Object.keys(over).forEach(function (k) { o[k] = over[k]; });
      return o;
    }
    var packs = {
      es: {
      quote_example: "Ejemplo · no es una cotización",
      compare_estimate: "Estimación",
      compare_note: "Modelo, no cotización: supone un resultado de 1inch un 0,67% menor. No incluye gas ni comisiones.",
        kicker: 'Non-custodial · Swap · Futures · Predicciones · Acciones',
        kicker_m: 'Non-custodial · Swap · Futures · Predictions · Stocks',
        sub: 'Haz swap de más de 10 000 tokens, opera Futures, apuesta en eventos y compra acciones tokenizadas — todo desde tu billetera. Sin registro, sin KYC, sin depósitos en GROM.',
        sub_m: 'Swap, Futures, predicciones y acciones — desde tu billetera. Sin KYC ni depósitos en GROM.',
        cta1: 'Conectar billetera →', cta2: 'Abrir panel',
        trust: ["Non-custodial", "Swap entre redes", "Rutas disponibles"],
        trust_m: ["Non-custodial", "Swap entre redes"],
        tab_swap: 'Swap', tab_perps: 'Futures', tab_predict: 'Predicciones', tab_stocks: 'Acciones',
        card_perps: 'GROM Futures', card_predict: 'GROM Predicciones', card_stocks: 'GROM Acciones',
        pay: 'Pagas', get: 'Recibes', bal: 'Saldo',
        rate: 'Tipo', save: 'Ahorro', vs: 'vs 1inch',
        route: 'Ruta:', route_best: "Al solicitar cotización",
        connect: 'Conectar billetera →',
        funding: 'Funding', funding_period: '8h',
        yes: 'Sí', no: 'No',
        perps_meta: "Hasta 40× · condiciones del mercado",
        open_trade: 'Abrir operación →',
        open_predict: 'Abrir predicciones →',
        pred_hint: '↳ Apuesta desde tu billetera — sin fondeo proxy',
        stocks_meta: 'ticker · 24/7 · fracciones desde $0,01',
        browse_stocks: 'Ver acciones →',
        diag_eye: 'Por qué GROM',
        diag_h: 'Conéctate una vez. Opera en todas partes.',
        diag_sub: 'Tu billetera es tu cuenta. Swap, Futures, predicciones, acciones — una sola firma. GROM nunca custodia fondos.',
        diag_wallet: 'TU BILLETERA',
        diag_swap: 'Swap · 10k tokens', diag_perps: 'Futures · hasta 40×', diag_pred: 'Predicciones', diag_stocks: 'Acciones 24/7',
        diag_swap_m: 'Swap', diag_perps_m: 'Futures', diag_pred_m: 'Predict', diag_stocks_m: 'Acciones',
        diag_cap: '<strong>Sin depósitos en GROM.</strong> Cada operación la firmas tú y se liquida on-chain.',
        updates: '🚀 <b>Recién:</b> Acciones · Predicciones · Futures · Cross-chain',
        faq_q: '¿Cómo funciona GROM DEX?',
        faq_a: "GROM compara rutas disponibles para los tokens, redes e importe elegidos. Los proveedores, las comisiones y el resultado dependen de la cotización actual. Revisa los detalles y confirma cada operación necesaria en tu monedero.",
        cmp_eye: 'Comparar',
        cmp_h: 'Por qué gana lo on-chain',
        cmp_sub: 'La misma superficie de producto que las grandes plataformas — sin custodia, KYC ni bloqueos geográficos.',
        tip_perps_q: '¿Qué es Futures?', tip_perps_a: 'Futuros perpetuos: opera BTC/ETH/SOL hasta 40×. Margen en Hyperliquid, PnL y funding on-chain. GROM nunca custodia tus fondos.',
        tip_predict_q: '¿Cómo funcionan las predicciones?', tip_predict_a: 'Apuesta USDC a un resultado (Sí/No). El precio = probabilidad del mercado. El pago llega a tu billetera — sin depósito proxy ni KYC de GROM.',
        tip_stocks_q: '¿Son acciones reales?', tip_stocks_a: 'Acciones tokenizadas (xStocks): derechos on-chain sobre el subyacente. Opera 24/7, fracciones desde $0,01, liquidación en tu billetera.',
      },
      ar: {
      quote_example: "مثال توضيحي · ليس عرض سعر",
      compare_estimate: "تقدير",
      compare_note: "نموذج وليس عرض سعر: يفترض عائداً أقل بنسبة 0.67% لدى 1inch. لا يشمل رسوم الشبكة والعمولات.",
        kicker: 'Non-custodial · Swap · Futures · التنبؤات · الأسهم',
        kicker_m: 'Non-custodial · Swap · Futures · Predictions · Stocks',
        sub: 'بادل أكثر من 10 000 رمز، تداول Futures، راهن على الأحداث واشترِ أسهماً مرمّزة — كل ذلك من محفظتك. بلا تسجيل، بلا KYC، بلا إيداع في GROM.',
        sub_m: 'Swap و Futures والتنبؤات والأسهم — من محفظتك. بلا KYC وبلا إيداع في GROM.',
        cta1: 'ربط المحفظة →', cta2: 'فتح لوحة التحكم',
        trust: ["Non-custodial", "مقايضات عبر الشبكات", "المسارات المتاحة"],
        trust_m: ["Non-custodial", "مقايضات عبر الشبكات"],
        tab_swap: 'Swap', tab_perps: 'Futures', tab_predict: 'التنبؤات', tab_stocks: 'الأسهم',
        card_perps: 'GROM Futures', card_predict: 'GROM التنبؤات', card_stocks: 'GROM الأسهم',
        pay: 'تدفع', get: 'تستلم', bal: 'الرصيد',
        rate: 'السعر', save: 'توفير', vs: 'vs 1inch',
        route: 'المسار:', route_best: "بعد طلب عرض السعر",
        connect: 'ربط المحفظة →',
        funding: 'Funding', funding_period: '8س',
        yes: 'نعم', no: 'لا',
        perps_meta: "حتى 40× · حسب السوق",
        open_trade: 'افتح صفقة →',
        open_predict: 'افتح التنبؤات →',
        pred_hint: '↳ راهن من محفظتك — بلا تمويل وسيط',
        stocks_meta: 'رمز · 24/7 · كسور من 0.01$',
        browse_stocks: 'عرض الأسهم →',
        diag_eye: 'لماذا GROM',
        diag_h: 'اربط مرة واحدة. تداول في كل مكان.',
        diag_sub: 'محفظتك هي حسابك. Swap و Futures والتنبؤات والأسهم — بتوقيع واحد. GROM لا يحتفظ بالأموال أبداً.',
        diag_wallet: 'محفظتك',
        diag_swap: 'Swap · 10k', diag_perps: 'Futures · حتى 40×', diag_pred: 'التنبؤات', diag_stocks: 'الأسهم 24/7',
        diag_swap_m: 'Swap', diag_perps_m: 'Futures', diag_pred_m: 'Predict', diag_stocks_m: 'أسهم',
        diag_cap: '<strong>لا إيداعات في GROM.</strong> كل صفقة توقّعها أنت وتُسوّى على السلسلة.',
        updates: '🚀 <b>جديد:</b> الأسهم · التنبؤات · Futures · Cross-chain',
        faq_q: 'كيف يعمل GROM DEX؟',
        faq_a: "يقارن GROM المسارات المتاحة للرموز والشبكات والمبلغ المحدد. يعتمد مقدمو الخدمة والرسوم والمبلغ المستلم على عرض السعر الحالي. راجع التفاصيل وأكد كل عملية مطلوبة في محفظتك.",
        cmp_eye: 'مقارنة',
        cmp_h: 'لماذا يفوز الـ on-chain',
        cmp_sub: 'نفس الوظائف الكبيرة — بلا وصاية ولا KYC ولا حظر جغرافي.',
        tip_perps_q: 'ما هو Futures؟', tip_perps_a: 'عقود دائمة: تداول BTC/ETH/SOL حتى 40×. الهامش على Hyperliquid، والربح والتمويل على السلسلة.',
        tip_predict_q: 'كيف تعمل التنبؤات؟', tip_predict_a: 'راهن بـ USDC على نتيجة (نعم/لا). السعر = الاحتمال. الدفع إلى محفظتك مباشرة.',
        tip_stocks_q: 'هل هذه أسهم حقيقية؟', tip_stocks_a: 'أسهم مرمّزة (xStocks): مطالبات على السلسلة. تداول 24/7 وكسور من 0.01$ إلى محفظتك.',
      },
      zh: {
      quote_example: "示例计算 · 非报价",
      compare_estimate: "估算",
      compare_note: "模型而非实时报价：假设 1inch 的输出低 0.67%。不含燃气费及手续费。",
        kicker: 'Non-custodial · Swap · Futures · 预测 · 股票',
        kicker_m: 'Non-custodial · Swap · Futures · Predictions · Stocks',
        sub: '兑换 10 000+ 代币、交易 Futures、押注事件、购买代币化股票——全部来自你的钱包。无需注册、无需 KYC、无需向 GROM 充值。',
        sub_m: 'Swap、Futures、预测与股票 — 直接来自你的钱包。无 KYC，无需存入 GROM。',
        cta1: '连接钱包 →', cta2: '打开仪表盘',
        trust: ["Non-custodial", "跨链兑换", "可用路由"],
        trust_m: ["Non-custodial", "跨链兑换"],
        tab_swap: 'Swap', tab_perps: 'Futures', tab_predict: '预测', tab_stocks: '股票',
        card_perps: 'GROM Futures', card_predict: 'GROM 预测', card_stocks: 'GROM 股票',
        pay: '你支付', get: '你获得', bal: '余额',
        rate: '汇率', save: '节省', vs: 'vs 1inch',
        route: '路由:', route_best: "请求报价后显示",
        connect: '连接钱包 →',
        funding: 'Funding', funding_period: '8小时',
        yes: '是', no: '否',
        perps_meta: "最高 40× · 取决于市场",
        open_trade: '开仓 →',
        open_predict: '打开预测 →',
        pred_hint: '↳ 用自己的钱包下注 — 无需代理充值',
        stocks_meta: '代码 · 24/7 · 最低 $0.01 碎股',
        browse_stocks: '查看股票 →',
        diag_eye: '为什么选 GROM',
        diag_h: '连接一次。随处交易。',
        diag_sub: '你的钱包就是账户。Swap、Futures、预测、股票——一次签名搞定。GROM 从不托管资金。',
        diag_wallet: '你的钱包',
        diag_swap: 'Swap · 1万代币', diag_perps: 'Futures · 最高 40×', diag_pred: '预测市场', diag_stocks: '股票 24/7',
        diag_swap_m: 'Swap', diag_perps_m: 'Futures', diag_pred_m: '预测', diag_stocks_m: '股票',
        diag_cap: '<strong>无需向 GROM 充值。</strong>每笔交易由你签名并在链上结算。',
        updates: '🚀 <b>刚刚上线:</b> 股票 · 预测 · Futures · Cross-chain',
        faq_q: 'GROM DEX 如何运作？',
        faq_a: "GROM 比较所选代币、网络和金额的可用路由。提供商、费用和到账金额取决于当前报价。请核对详情，并在自己的钱包中确认每项必要操作。",
        cmp_eye: '对比',
        cmp_h: '为什么链上更好',
        cmp_sub: '与大型平台同样的功能面——没有托管、KYC 或地域封锁。',
        tip_perps_q: '什么是 Futures？', tip_perps_a: '永续合约：BTC/ETH/SOL 最高 40×。保证金在 Hyperliquid，盈亏与资金费率在链上。',
        tip_predict_q: '预测市场如何运作？', tip_predict_a: '用 USDC 押注结果（是/否）。价格=概率。赔付到你的钱包。',
        tip_stocks_q: '这是真股票吗？', tip_stocks_a: '代币化股票（xStocks）：链上权益。24/7 交易，最低 $0.01 碎股，结算到钱包。',
      },
      hi: {
      quote_example: "उदाहरण · वास्तविक कोट नहीं",
      compare_estimate: "अनुमान",
      compare_note: "मॉडल, वास्तविक कोट नहीं: 1inch का परिणाम 0.67% कम माना गया है। गैस और शुल्क शामिल नहीं हैं।",
        kicker: 'Non-custodial · Swap · Futures · प्रेडिक्शन्स · स्टॉक्स',
        kicker_m: 'Non-custodial · Swap · Futures · Predictions · Stocks',
        sub: '10 000+ टोकन स्वैप करें, Futures ट्रेड करें, इवेंट्स पर दांव लगाएँ और टोकनाइज़्ड स्टॉक्स खरीदें — सब अपने वॉलेट से। कोई रजिस्ट्रेशन नहीं, कोई KYC नहीं, GROM पर कोई डिपॉजिट नहीं।',
        sub_m: 'Swap, Futures, प्रेडिक्शन्स और स्टॉक्स — अपने वॉलेट से। कोई KYC नहीं, GROM पर कोई डिपॉजिट नहीं।',
        cta1: 'वॉलेट कनेक्ट करें →', cta2: 'डैशबोर्ड खोलें',
        trust: ["Non-custodial", "क्रॉस-चेन स्वैप", "उपलब्ध रूट"],
        trust_m: ["Non-custodial", "क्रॉस-चेन स्वैप"],
        tab_swap: 'Swap', tab_perps: 'Futures', tab_predict: 'प्रेडिक्शन्स', tab_stocks: 'स्टॉक्स',
        card_perps: 'GROM Futures', card_predict: 'GROM प्रेडिक्शन्स', card_stocks: 'GROM स्टॉक्स',
        pay: 'आप देते हैं', get: 'आप पाते हैं', bal: 'बैलेंस',
        rate: 'रेट', save: 'बचत', vs: 'vs 1inch',
        route: 'रूट:', route_best: "कोट मांगने के बाद",
        connect: 'वॉलेट कनेक्ट करें →',
        funding: 'Funding', funding_period: '8घं',
        yes: 'हाँ', no: 'नहीं',
        perps_meta: "40× तक · बाजार की शर्तें",
        open_trade: 'ट्रेड खोलें →',
        open_predict: 'प्रेडिक्शन्स खोलें →',
        pred_hint: '↳ अपने वॉलेट से दांव — बिना प्रॉक्सी फंडिंग',
        stocks_meta: 'टिकर · 24/7 · $0.01 से फ्रैक्शनल',
        browse_stocks: 'स्टॉक्स देखें →',
        diag_eye: 'क्यों GROM',
        diag_h: 'एक बार कनेक्ट करें। हर जगह ट्रेड करें।',
        diag_sub: 'आपका वॉलेट ही आपका अकाउंट है। Swap, Futures, प्रेडिक्शन्स, स्टॉक्स — एक सिग्नेचर। GROM कभी फंड नहीं रखता।',
        diag_wallet: 'आपका वॉलेट',
        diag_swap: 'Swap · 10k टोकन', diag_perps: 'Futures · 40× तक', diag_pred: 'प्रेडिक्शन्स', diag_stocks: 'स्टॉक्स 24/7',
        diag_swap_m: 'Swap', diag_perps_m: 'Futures', diag_pred_m: 'Predict', diag_stocks_m: 'स्टॉक्स',
        diag_cap: '<strong>GROM पर कोई डिपॉजिट नहीं।</strong> हर ट्रेड आपके वॉलेट से साइन होकर ऑन-चेन सेटल होता है।',
        updates: '🚀 <b>अभी:</b> स्टॉक्स · प्रेडिक्शन्स · Futures · Cross-chain',
        faq_q: 'GROM DEX कैसे काम करता है?',
        faq_a: "GROM चुने हुए टोकन, नेटवर्क और राशि के लिए उपलब्ध रूट की तुलना करता है। प्रदाता, शुल्क और प्राप्त राशि मौजूदा कोट पर निर्भर हैं। विवरण जांचें और हर आवश्यक कार्रवाई अपने वॉलेट में पुष्टि करें।",
        cmp_eye: 'तुलना',
        cmp_h: 'ऑन-चेन क्यों जीतता है',
        cmp_sub: 'बड़े वेन्यू जैसा प्रोडक्ट — बिना कस्टडी, KYC या जियो-ब्लॉक।',
        tip_perps_q: 'Futures क्या हैं?', tip_perps_a: 'परपेचुअल फ्यूचर्स: BTC/ETH/SOL 40× तक। मार्जिन Hyperliquid पर, PnL ऑन-चेन।',
        tip_predict_q: 'प्रेडिक्शन्स कैसे काम करते हैं?', tip_predict_a: 'USDC से Yes/No पर दांव। प्राइस = संभाव्यता। पेआउट आपके वॉलेट में।',
        tip_stocks_q: 'क्या ये असली स्टॉक्स हैं?', tip_stocks_a: 'टोकनाइज़्ड स्टॉक्स (xStocks): ऑन-चेन दावे। 24/7 ट्रेड, $0.01 से फ्रैक्शनल।',
      },
      tr: {
      quote_example: "Örnek hesaplama · kotasyon değildir",
      compare_estimate: "Tahmin",
      compare_note: "Modeldir, fiyat teklifi değildir: 1inch getirisinin %0,67 daha düşük olduğu varsayılır. Gas ve ücretler hariçtir.",
        kicker: 'Non-custodial · Swap · Futures · Tahminler · Hisse',
        kicker_m: 'Non-custodial · Swap · Futures · Predictions · Stocks',
        sub: '10 000+ token swap’le, Futures işle, olaylara bahis yap, tokenize hisse al — hepsi cüzdanından. Kayıt yok, KYC yok, GROM’a yatırma yok.',
        sub_m: 'Swap, Futures, tahminler ve hisse — cüzdanından. KYC yok, GROM’a yatırma yok.',
        cta1: 'Cüzdan bağla →', cta2: 'Paneli aç',
        trust: ["Non-custodial", "Ağlar arası swap", "Kullanılabilir rotalar"],
        trust_m: ["Non-custodial", "Ağlar arası swap"],
        tab_swap: 'Swap', tab_perps: 'Futures', tab_predict: 'Tahminler', tab_stocks: 'Hisse',
        card_perps: 'GROM Futures', card_predict: 'GROM Tahminler', card_stocks: 'GROM Hisse',
        pay: 'Ödersin', get: 'Alırsın', bal: 'Bakiye',
        rate: 'Kur', save: 'Tasarruf', vs: 'vs 1inch',
        route: 'Rota:', route_best: "Kotasyon istendiğinde",
        connect: 'Cüzdan bağla →',
        funding: 'Funding', funding_period: '8s',
        yes: 'Evet', no: 'Hayır',
        perps_meta: "40×’e kadar · piyasa koşulları",
        open_trade: 'İşlem aç →',
        open_predict: 'Tahminleri aç →',
        pred_hint: '↳ Cüzdanından bahis — proxy fonlama yok',
        stocks_meta: 'ticker · 24/7 · $0,01’den kesir',
        browse_stocks: 'Hisseleri gör →',
        diag_eye: 'Neden GROM',
        diag_h: 'Bir kez bağlan. Her yerde işlem yap.',
        diag_sub: 'Cüzdanın hesabındır. Swap, Futures, tahminler, hisse — tek imza. GROM asla fon tutmaz.',
        diag_wallet: 'CÜZDANIN',
        diag_swap: 'Swap · 10k token', diag_perps: 'Futures · 40×’e kadar', diag_pred: 'Tahminler', diag_stocks: 'Hisse 24/7',
        diag_swap_m: 'Swap', diag_perps_m: 'Futures', diag_pred_m: 'Predict', diag_stocks_m: 'Hisse',
        diag_cap: '<strong>GROM’a yatırma yok.</strong> Her işlem cüzdanınla imzalanır ve zincirde yerleşir.',
        updates: '🚀 <b>Yeni:</b> Hisse · Tahminler · Futures · Cross-chain',
        faq_q: 'GROM DEX nasıl çalışır?',
        faq_a: "GROM seçilen tokenler, ağlar ve tutar için kullanılabilir rotaları karşılaştırır. Sağlayıcılar, ücretler ve çıktı güncel kotasyona bağlıdır. Ayrıntıları kontrol edin ve gereken her işlemi kendi cüzdanınızda onaylayın.",
        cmp_eye: 'Karşılaştır',
        cmp_h: 'Neden on-chain kazanır',
        cmp_sub: 'Büyük platformlarla aynı yüzey — saklama, KYC veya coğrafi engel olmadan.',
        tip_perps_q: 'Futures nedir?', tip_perps_a: 'Kalıcı vadeli: BTC/ETH/SOL’u 40×’e kadar işle. Marjin Hyperliquid’de, PnL zincirde.',
        tip_predict_q: 'Tahminler nasıl çalışır?', tip_predict_a: 'USDC ile Evet/Hayır’a bahis. Fiyat = olasılık. Ödeme cüzdanına gelir.',
        tip_stocks_q: 'Bunlar gerçek hisseler mi?', tip_stocks_a: 'Tokenize hisseler (xStocks): zincir üstü haklar. 24/7 işlem, $0,01’den kesir.',
      },
    };
    Object.keys(packs).forEach(function (code) {
      I18N[code] = clone(I18N.en, packs[code]);
    });
  })();

  /* Comparison copy — keys resolve via grom-i18n (lp_v2_cmp_*) with local fallbacks. */
  var CMP_TABLES = [
    {
      eye: 'tab_perps',
      hook: 'lp_v2_cmp_perps_hook',
      vs: 'lp_v2_cmp_perps_vs',
      slogan: 'lp_v2_cmp_perps_slogan',
      headOther: 'lp_v2_cmp_cex',
      rows: [
        ['lp_v2_cmp_perps_r1_k', 'lp_v2_cmp_perps_r1_a', 'lp_v2_cmp_perps_r1_b', { bYes: 1 }],
        ['lp_v2_cmp_perps_r2_k', 'lp_v2_cmp_perps_r2_a', 'lp_v2_cmp_perps_r2_b', { bStrong: 1 }],
        ['lp_v2_cmp_perps_r3_k', 'lp_v2_cmp_perps_r3_a', 'lp_v2_cmp_perps_r3_b', {}],
        ['lp_v2_cmp_perps_r4_k', 'lp_v2_cmp_perps_r4_a', 'lp_v2_cmp_perps_r4_b', {}],
        ['lp_v2_cmp_perps_r5_k', 'lp_v2_cmp_perps_r5_a', 'lp_v2_cmp_perps_r5_b', { aNo: 1, bYes: 1 }],
        ['lp_v2_cmp_perps_r6_k', 'lp_v2_cmp_perps_r6_a', 'lp_v2_cmp_perps_r6_b', { aNo: 1, bYes: 1 }],
      ],
    },
    {
      eye: 'tab_predict',
      hook: 'lp_v2_cmp_pred_hook',
      vs: 'lp_v2_cmp_pred_vs',
      slogan: 'lp_v2_cmp_pred_slogan',
      headOther: 'lp_v2_cmp_broker',
      rows: [
        ['lp_v2_cmp_pred_r1_k', 'lp_v2_cmp_pred_r1_a', 'lp_v2_cmp_pred_r1_b', { bYes: 1 }],
        ['lp_v2_cmp_pred_r2_k', 'lp_v2_cmp_pred_r2_a', 'lp_v2_cmp_pred_r2_b', { aNo: 1, bYes: 1 }],
        ['lp_v2_cmp_pred_r3_k', 'lp_v2_cmp_pred_r3_a', 'lp_v2_cmp_pred_r3_b', { bYes: 1 }],
        ['lp_v2_cmp_pred_r4_k', 'lp_v2_cmp_pred_r4_a', 'lp_v2_cmp_pred_r4_b', { bYes: 1 }],
        ['lp_v2_cmp_pred_r5_k', 'lp_v2_cmp_pred_r5_a', 'lp_v2_cmp_pred_r5_b', { bStrong: 1 }],
        ['lp_v2_cmp_pred_r6_k', 'lp_v2_cmp_pred_r6_a', 'lp_v2_cmp_pred_r6_b', { bYes: 1 }],
      ],
    },
    {
      eye: 'tab_stocks',
      hook: 'lp_v2_cmp_stk_hook',
      vs: 'lp_v2_cmp_stk_vs',
      slogan: 'lp_v2_cmp_stk_slogan',
      headOther: 'lp_v2_cmp_broker',
      rows: [
        ['lp_v2_cmp_stk_r1_k', 'lp_v2_cmp_stk_r1_a', 'lp_v2_cmp_stk_r1_b', { bYes: 1 }],
        ['lp_v2_cmp_stk_r2_k', 'lp_v2_cmp_stk_r2_a', 'lp_v2_cmp_stk_r2_b', { aNo: 1, bYes: 1 }],
        ['lp_v2_cmp_stk_r3_k', 'lp_v2_cmp_stk_r3_a', 'lp_v2_cmp_stk_r3_b', {}],
        ['lp_v2_cmp_stk_r4_k', 'lp_v2_cmp_stk_r4_a', 'lp_v2_cmp_stk_r4_b', { bStrong: 1 }],
        ['lp_v2_cmp_stk_r5_k', 'lp_v2_cmp_stk_r5_a', 'lp_v2_cmp_stk_r5_b', { bYes: 1 }],
        ['lp_v2_cmp_stk_r6_k', 'lp_v2_cmp_stk_r6_a', 'lp_v2_cmp_stk_r6_b', { aNo: 1, bYes: 1 }],
      ],
    },
  ];

  var GROM_I18N_KEYS = {
    updates: 'lp_v2_updates',
    open_predict: 'lp_v2_cta_predict',
    open_trade: 'lp_v2_cta_trade',
    browse_stocks: 'lp_v2_cta_stocks',
    connect: 'lp_hero_cta1',
    cta1: 'lp_hero_cta1',
    cta2: 'lp_hero_cta2',
  };

  function lang() {
    try {
      var s = (typeof window.getGromLang === 'function' ? window.getGromLang() : '') || localStorage.getItem('grom_lang') || '';
      if (s === 'uk') s = 'ua';
      if (I18N[s]) return s;
    } catch (_) {}
    return 'en';
  }
  function t(k) {
    try {
      var gk = GROM_I18N_KEYS[k] || (String(k).indexOf('lp_v2_') === 0 ? k : null);
      if (gk && typeof window.t === 'function') {
        var gv = window.t(gk);
        if (gv && gv !== gk) return gv;
      }
    } catch (_) {}
    var p = I18N[lang()] || I18N.en;
    return p[k] != null ? p[k] : (I18N.en[k] || k);
  }
  function tl(map) {
    if (!map) return '';
    if (typeof map === 'string') return map;
    var l = lang();
    return map[l] != null ? map[l] : (map.en || map.ru || '');
  }
  function cellMark(text, yes, no, strong) {
    var inner = esc(text);
    if (strong) inner = '<strong>' + inner + '</strong>';
    if (yes) return '<span class="lv2-yes">' + inner + '</span>';
    if (no) return '<span class="lv2-no">' + inner + '</span>';
    return inner;
  }
  function tipBlock(kind) {
    return (
      '<div class="lv2-tip">' +
        '<button type="button" class="lv2-tip-btn" data-lv2-tip aria-expanded="false" aria-label="' + esc(t('tip_' + kind + '_q')) + '">?</button>' +
        '<div class="lv2-tip-pop" role="tooltip" hidden>' +
          '<strong>' + esc(t('tip_' + kind + '_q')) + '</strong>' +
          '<p>' + esc(t('tip_' + kind + '_a')) + '</p>' +
        '</div>' +
      '</div>'
    );
  }

  function go(page, qs) {
    try {
      if (typeof window.show === 'function') {
        window.show(page);
        var pathOf = window.GROM_PATH_OF || {};
        if (pathOf[page]) {
          try { history.replaceState(null, '', pathOf[page] + (location.search || '')); } catch (_) {}
        } else if (qs) {
          history.replaceState(null, '', location.pathname + location.search + '#' + page + (qs[0] === '?' ? qs : '?' + qs));
        } else if (page) {
          history.replaceState(null, '', location.pathname + location.search + '#' + page);
        }
        return;
      }
    } catch (_) {}
    location.hash = '#' + page + (qs ? (qs[0] === '?' ? qs : '?' + qs) : '');
  }
  function isOnLanding() {
    try {
      var route = document.documentElement.getAttribute('data-grom-route') || '';
      if (route && route !== 'landing') return false;
      var seg = (location.pathname || '/').replace(/^\/|\/$/g, '').split('/')[0] || '';
      var map = window.GROM_PATH_MAP || {};
      if (seg && map[seg] && map[seg] !== 'landing') return false;
      if (route === 'landing') return true;
      var page = document.getElementById('page-landing');
      return !!(page && page.classList.contains('active'));
    } catch (_) { return false; }
  }
  function goDashAfterConnect() {
    if (!isOnLanding()) return;
    try { go('dashboard'); } catch (_) {
      try { location.hash = '#dashboard'; } catch (_) {}
    }
  }
  function connect() {
    try {
      window.__lv2GoDashAfterConnect = true;
      /* Always open the wallet-list Connect modal (wallet-list only). */
      try {
        var wm = document.getElementById('walletModal');
        if (wm) {
          wm.classList.remove('open');
          wm.hidden = true;
          wm.setAttribute('aria-hidden', 'true');
        }
      } catch (_) {}
      var ov = document.getElementById('connectModal');
      if (ov) {
        try {
          document.querySelectorAll('#connectModal .wm-body > .cn-list, #connectModal .wm-body > .cn-foot').forEach(function (el) {
            el.style.display = '';
          });
          document.querySelectorAll('#connectModal .cn-list button.cn-row').forEach(function (el) {
            el.style.display = '';
            el.hidden = false;
          });
          var pv = document.getElementById('walletInlineFormRemoved');
          if (pv) pv.style.display = 'none';
          if (typeof window.gwEnsureConnectWalletRows === 'function') window.gwEnsureConnectWalletRows();
        } catch (_) {}
      }
      if (typeof window.openConnectModal === 'function') {
        window.openConnectModal();
        return;
      }
      if (ov) {
        ov.hidden = false;
        ov.setAttribute('aria-hidden', 'false');
        ov.classList.add('open');
      }
    } catch (_) {}
  }

  function fmtUsd(n, dig) {
    n = Number(n) || 0;
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
    if (n >= 1e3) return '$' + Math.round(n).toLocaleString('ru-RU');
    if (n > 0 && n < 1) return '$' + n.toLocaleString('ru-RU', { maximumFractionDigits: dig != null ? dig : 4 });
    return '$' + n.toLocaleString('ru-RU', { maximumFractionDigits: dig != null ? dig : 2 });
  }
  function fmtPct(n) {
    n = Number(n) || 0;
    return (n >= 0 ? '+' : '') + n.toFixed(2).replace('.', ',') + '%';
  }
  function trunc(s, n) {
    s = String(s || '');
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
  }
  function esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  }

  function cached(key, ttl, fn) {
    var hit = _cache[key];
    if (hit && Date.now() - hit.at < ttl) return Promise.resolve(hit.v);
    return Promise.resolve().then(fn).then(function (v) {
      if (v != null) _cache[key] = { at: Date.now(), v: v };
      return v;
    }).catch(function () { return hit ? hit.v : null; });
  }

  function hlInfo(body) {
    return fetch('https://api.hyperliquid.xyz/info', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }).then(function (r) { if (!r.ok) throw 0; return r.json(); });
  }

  var COIN_LOGO = {
    BTC: 'https://assets.coingecko.com/coins/images/1/large/bitcoin.png',
    ETH: 'https://assets.coingecko.com/coins/images/279/large/ethereum.png',
    SOL: 'https://assets.coingecko.com/coins/images/4128/large/solana.png',
    DOGE: 'https://assets.coingecko.com/coins/images/5/large/dogecoin.png',
  };
  var COIN_TINT = {
    BTC: '#f7931a',
    ETH: '#627eea',
    SOL: '#14f195',
    DOGE: '#c2a633',
  };







  function fetchEthUsd() {
    return cached('ethusd4', 60_000, function () {
      /* HL mid only — faster than waiting on /api/market/quotes. */
      return hlInfo({ type: 'allMids' })
        .then(function (mids) {
          var px = Number(mids && mids.ETH) || 0;
          return Number.isFinite(px) && px > 0 ? px : null;
        })
        .catch(function () { return null; });
    });
  }

  var ICON = {
    swap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3v18M17 3l-4 4M7 21V3M7 21l4-4"/></svg>',
    perps: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 17l6-6 4 4 8-8M21 7h-6M21 7v6"/></svg>',
    predict: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1"/></svg>',
    stocks: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20h16M6 20V10M11 20V4M16 20v-8M21 20V14"/></svg>',
    flip: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 3v14M7 17l-4-4M17 21V7M17 7l4 4"/></svg>',
  };


  function typeHeroH1(h1) {
    if (!h1) return;
    /* Static headline: the four markets must be readable at once (no typewriter). */
    h1.setAttribute('data-no-tr', '');
    if (h1.innerHTML !== H1_EN) h1.innerHTML = H1_EN;
    h1.classList.remove('lv2-h1-typing');
    h1.classList.add('lv2-h1-anim');
  }

  function rewriteHeroLeft() {
    var page = document.getElementById('page-landing');
    if (!page) return;
    var left = page.querySelector('.lp-hero-left');
    if (!left) return;

    var eye = left.querySelector('.lp-eyebrow');
    if (eye) eye.remove();

    var kicker = left.querySelector('.lv2-kicker');
    if (kicker) kicker.remove();
    var narrowHero = false;
    try { narrowHero = !!(window.matchMedia && window.matchMedia('(max-width: 720px)').matches); } catch (_) {}

    var h1 = left.querySelector('.lp-h1');
    if (h1) {
      h1.removeAttribute('data-i18n-html');
      /* Don't restart typewriter if already mid-type from early paintHeroNow */
      if (!(h1.classList.contains('lv2-h1-typing') && h1._lv2TypeTimer)) {
        typeHeroH1(h1);
      }
    }
    var sub = left.querySelector('.lp-h1-sub');
    if (sub) {
      sub.textContent = (narrowHero && t('sub_m')) ? t('sub_m') : t('sub');
      sub.removeAttribute('data-i18n');
    }
    var c1 = left.querySelector('.lp-btn-primary');
    if (c1) {
      c1.textContent = t('cta1');
      c1.removeAttribute('data-i18n');
      c1.removeAttribute('onclick');
      if (!c1._lv2ConnectBound) {
        c1._lv2ConnectBound = true;
        c1.addEventListener('click', function (e) {
          e.preventDefault();
          connect();
        });
      }
    }
    var c2 = left.querySelector('.lp-btn-secondary');
    if (c2) {
      c2.textContent = t('cta2');
      c2.removeAttribute('data-i18n');
      c2.removeAttribute('onclick');
      if (!c2._lv2DashBound) {
        c2._lv2DashBound = true;
        c2.addEventListener('click', function (e) {
          e.preventDefault();
          go('dashboard');
        });
      }
    }

    var trust = left.querySelector('.lv2-trust');
    if (!trust) {
      trust = document.createElement('div');
      trust.className = 'lv2-trust';
      var cta = left.querySelector('.lp-cta-row');
      if (cta) cta.after(trust);
      else left.appendChild(trust);
    }
    var narrowTrust = false;
    try { narrowTrust = !!(window.matchMedia && window.matchMedia('(max-width: 640px)').matches); } catch (_) {}
    var trustItems = (narrowTrust && t('trust_m') && t('trust_m').length) ? t('trust_m') : (t('trust') || []);
    trust.innerHTML = trustItems.map(function (x) {
      return '<span><span class="ok">✓</span>' + esc(x) + '</span>';
    }).join('');
  }

  /* Same networks, order and logos as the swap chips on «Главное» (grom-wallet.js GW_DS_CHAINS).
   * The wallet is an ES module loaded later, so its chip helper is not on window — the landing
   * builds the row itself from the same sources: base chains + window.GromSwapNetworks. */
  var LV2_CHAIN_ICON = 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/';
  var LV2_BASE_CHAINS = [
    { name: 'Ethereum', short: 'ETH', slug: 'ethereum' },
    { name: 'BNB Chain', short: 'BSC', slug: 'bsc' },
    { name: 'Arbitrum', short: 'ARB', slug: 'arbitrum' },
    { name: 'Polygon', short: 'POL', slug: 'polygon' },
    { name: 'Base', short: 'BASE', slug: 'base' },
    { name: 'Optimism', short: 'OP', slug: 'optimism' },
    { name: 'Avalanche', short: 'AVAX', slug: 'avalanche' },
    { name: 'Linea', short: 'LINEA', slug: 'linea' }
  ];
  var LV2_NONEVM_CHAINS = [
    { name: 'Solana', short: 'SOL', slug: 'solana' },
    { name: 'Bitcoin', short: 'BTC', slug: 'bitcoin' },
    { name: 'Tron', short: 'TRX', slug: 'tron' }
  ];

  function previewChainList() {
    var extra = [];
    try {
      var nets = window.GromSwapNetworks && window.GromSwapNetworks.chains;
      if (nets && nets.length) {
        extra = nets.map(function (c) { return { name: c.name, short: c.short, logo: c.logoURI }; });
      }
    } catch (_) {}
    function withLogo(c) { return { name: c.name, short: c.short, logo: LV2_CHAIN_ICON + c.slug + '.svg' }; }
    return LV2_BASE_CHAINS.map(withLogo).concat(extra, LV2_NONEVM_CHAINS.map(withLogo));
  }

  function renderPreviewChains() {
    var host = document.createElement('div');
    host.className = 'lv2-preview-chains';
    previewChainList().forEach(function (c) {
      if (!c || !c.short) return;
      var item = document.createElement('span');
      item.title = c.name || c.short;
      if (c.logo) {
        var img = document.createElement('img');
        img.src = c.logo;
        img.alt = '';
        img.loading = 'lazy';
        img.decoding = 'async';
        img.width = 18;
        img.height = 18;
        item.appendChild(img);
      }
      item.appendChild(document.createTextNode(c.short));
      host.appendChild(item);
    });
    return host.children.length ? host.outerHTML : '';
  }

  function renderSwap(eth) {
    eth = Number(eth);
    var hasPrice = Number.isFinite(eth) && eth > 0;
    var pay = 0.5;
    var get = hasPrice ? pay * eth : null;
    // Explicit illustrative assumption; this is not a fetched 1inch quote.
    var modelDifference = hasPrice ? get * 0.0067 : null;
    var valueText = hasPrice ? get.toLocaleString('ru-RU', { maximumFractionDigits: 2 }) : '—';
    var usdText = hasPrice ? '≈ ' + fmtUsd(get) : '—';
    var rateText = hasPrice ? eth.toLocaleString('ru-RU', { maximumFractionDigits: 2 }) : '—';
    return (
      '<div class="lv2-swap-demo lv2-dashboard-preview" data-lv2-act="connect" role="button" tabindex="0" aria-label="' + esc(t('connect')) + '">' +
        (typeof renderPreviewChains === 'function' ? renderPreviewChains() : '') +
        '<div class="lv2-swap-field">' +
          '<div class="lv2-swap-lbl">' + esc(t('pay')) + '</div>' +
          '<div class="lv2-swap-body">' +
            '<input class="lv2-swap-amt" value="' + String(pay).replace('.', ',') + '" readonly tabindex="-1" />' +
            '<span class="lv2-pill">' + coinBadge('ETH', COIN_LOGO.ETH, COIN_TINT.ETH) + 'ETH</span>' +
          '</div>' +
          '<div class="lv2-swap-meta"><span>' + usdText + '</span></div>' +
          '<div class="lv2-preview-percent"><span>25%</span><span>50%</span><span>75%</span><span>MAX</span></div>' +
        '</div>' +
        '<div class="lv2-flip-wrap"><div class="lv2-flip">' + ICON.flip + '</div></div>' +
        '<div class="lv2-swap-field">' +
          '<div class="lv2-swap-lbl">' + esc(t('get')) + '</div>' +
          '<div class="lv2-swap-body">' +
            '<input class="lv2-swap-amt" value="' + valueText + '" readonly tabindex="-1" />' +
            '<span class="lv2-pill">' + coinBadge('U', 'https://assets.coingecko.com/coins/images/6319/large/usdc.png', '#2775ca') + 'USDC</span>' +
          '</div>' +
          '<div class="lv2-swap-meta"><span>' + usdText + '</span></div>' +
        '</div>' +
        '<div class="lv2-swap-info"><span>' + esc(t('rate')) + ': 1 ETH = ' + rateText + ' USDC</span>' +
          '<span class="save">' + esc(t('compare_estimate')) + ': ' + (hasPrice ? '+' + fmtUsd(modelDifference) : '—') + ' vs 1inch</span></div>' +
        '<p class="lv2-swap-model">' + esc(t('compare_note')) + '</p>' +
        '<button type="button" class="lv2-cta" data-lv2-act="connect">' + esc(t('connect')) + '</button>' +
      '</div>'
    );
  }

  function coinBadge(name, logo, tint) {
    var letter = esc(String(name || '?').slice(0, 1));
    var bg = tint || '#4ea9ff';
    if (logo) {
      return (
        '<span class="lv2-coin" style="--lv2-coin:' + bg + '" data-letter="' + letter + '">' +
          '<img src="' + esc(logo) + '" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" ' +
            'onerror="var p=this.parentNode;this.remove();if(p)p.classList.add(\'is-fallback\');"/>' +
        '</span>'
      );
    }
    return '<span class="lv2-coin is-fallback" style="--lv2-coin:' + bg + '" data-letter="' + letter + '"></span>';
  }






  function ensureRoot() {
    var wrap = document.querySelector('#page-landing .lp-wrap');
    if (!wrap) return null;
    var root = document.getElementById('landing-v2-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'landing-v2-root';
      var hero = wrap.querySelector('.lp-hero');
      if (hero) hero.after(root);
      else wrap.insertBefore(root, wrap.firstChild);
    }
    return root;
  }



  /* Dot walks dashed lines only — never through logo. At hub: left edge → jump → right edge. */



  function removePreview() {
    document.querySelectorAll('#landing-v2-root .lv2-live-sec, .lv2-live-sec, #landing-v2-ticker, .lv2-ticker-wrap').forEach(function (el) {
      el.remove();
    });
  }

  function removeCompare() {
    var host = document.getElementById('landing-v2-cmp');
    if (host) host.remove();
  }


  function removeUpdates() {
    document.querySelectorAll('#landing-v2-updates, .lv2-updates').forEach(function (el) {
      el.remove();
    });
  }

  function injectFaq() {
    var list = document.querySelector('#page-landing .gw-lp-faq-list');
    if (!list) return;
    var qWant = t('faq_q');
    var existing = list.querySelector('[data-lv2-faq="1"]');
    if (!existing) {
      var items = list.querySelectorAll('.gw-lp-faq-item');
      for (var i = 0; i < items.length; i++) {
        var qNode = items[i].querySelector('.gw-lp-faq-q');
        var qText = qNode ? String(qNode.textContent || '').replace(/\+$/, '').trim() : '';
        if (qText === qWant || /Как работает GROM DEX|How does GROM DEX work|Як працює GROM DEX/i.test(qText)) {
          existing = items[i];
          existing.setAttribute('data-lv2-faq', '1');
          break;
        }
      }
    }
    if (existing) {
      if (existing !== list.firstChild) list.insertBefore(existing, list.firstChild);
      var q = existing.querySelector('.gw-lp-faq-q');
      var a = existing.querySelector('.gw-lp-faq-a');
      if (q) {
        var caret = q.querySelector('.caret');
        q.textContent = '';
        q.appendChild(document.createTextNode(qWant));
        if (caret) q.appendChild(caret);
        else {
          var c = document.createElement('span');
          c.className = 'caret';
          c.textContent = '+';
          q.appendChild(c);
        }
      }
      if (a) a.textContent = t('faq_a');
      /* Close once on first paint — never re-close after user opens */
      if (!_faqLocked) {
        list.querySelectorAll('.gw-lp-faq-item').forEach(function (it) { it.classList.remove('open'); });
        _faqLocked = true;
      }
      return;
    }
    var item = document.createElement('div');
    item.className = 'gw-lp-faq-item';
    item.setAttribute('data-lv2-faq', '1');
    item.innerHTML =
      '<div class="gw-lp-faq-q">' + esc(qWant) + '<span class="caret">+</span></div>' +
      '<div class="gw-lp-faq-a">' + esc(t('faq_a')) + '</div>';
    list.insertBefore(item, list.firstChild);
    if (!_faqLocked) {
      list.querySelectorAll('.gw-lp-faq-item').forEach(function (it) { it.classList.remove('open'); });
      _faqLocked = true;
    }
    var qEl = item.querySelector('.gw-lp-faq-q');
    if (qEl && !qEl._lv2Bound) {
      qEl._lv2Bound = true;
      qEl.addEventListener('click', function () { item.classList.toggle('open'); });
    }
  }

  function bind(root) {
    var page = document.getElementById('page-landing');
    if (page && !page._lv2Bound) {
      page._lv2Bound = true;
      page.addEventListener('click', function (e) {
        var tipBtn = e.target.closest('[data-lv2-tip]');
        if (tipBtn) {
          e.preventDefault();
          e.stopPropagation();
          var tip = tipBtn.closest('.lv2-tip');
          var open = tip && tip.classList.contains('is-open');
          page.querySelectorAll('.lv2-tip.is-open').forEach(function (x) {
            x.classList.remove('is-open');
            var b = x.querySelector('[data-lv2-tip]');
            var p = x.querySelector('.lv2-tip-pop');
            if (b) b.setAttribute('aria-expanded', 'false');
            if (p) p.hidden = true;
          });
          if (!open && tip) {
            tip.classList.add('is-open');
            tipBtn.setAttribute('aria-expanded', 'true');
            var pop = tip.querySelector('.lv2-tip-pop');
            if (pop) {
              pop.hidden = false;
              pop.classList.remove('is-flip');
              try {
                var rect = pop.getBoundingClientRect();
                if (rect.right > (window.innerWidth - 10)) pop.classList.add('is-flip');
              } catch (_) {}
            }
          }
          return;
        }
        if (!e.target.closest('.lv2-tip')) {
          page.querySelectorAll('.lv2-tip.is-open').forEach(function (x) {
            x.classList.remove('is-open');
            var b = x.querySelector('[data-lv2-tip]');
            var p = x.querySelector('.lv2-tip-pop');
            if (b) b.setAttribute('aria-expanded', 'false');
            if (p) p.hidden = true;
          });
        }
        var btn = e.target.closest('[data-lv2-go],[data-lv2-act]');
        if (!btn) return;
        e.preventDefault();
        if (btn.getAttribute('data-lv2-act') === 'connect') return connect();
        go(btn.getAttribute('data-lv2-go'), btn.getAttribute('data-lv2-qs') || '');
      });
      page.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        var demo = e.target.closest('.lv2-swap-demo[data-lv2-act="connect"]');
        if (!demo) return;
        e.preventDefault();
        connect();
      });
    }
    if (root) root._lv2Bound = true;
  }

  function syncI18nDefaults() {
    /* Lock hero H1 to English across all i18n packs; keep RU sub in sync. */
    try {
      if (window.GROM_I18N) {
        Object.keys(window.GROM_I18N).forEach(function (code) {
          if (window.GROM_I18N[code]) window.GROM_I18N[code].lp_hero_h1 = H1_EN;
        });
        if (window.GROM_I18N.ru) window.GROM_I18N.ru.lp_hero_sub = t('sub');
      }
    } catch (_) {}
  }

  /* ===================== Landing v3 — market floor (2026-11-15) =====================
   * Owner: "человек заходит и сразу хочет купить акции, перпы и прогнозы — как будто попал на Уолл-стрит".
   * Live data only (no invented activity): stock quotes from /api/market/stocks/*, perps from the
   * perps venue's public info API, prediction markets from /api/market/predict. */
  var L3_STOCKS = ['NVDA', 'AAPL', 'TSLA', 'MSFT', 'AMZN', 'META'];
  var L3_ETF = { SPX: 'SPY', NDX: 'QQQ', RUT: 'IWM', GOLD: 'GLD' };
  var L3_PERPS = ['BTC', 'ETH', 'SOL', 'XRP', 'BNB', 'DOGE'];
  var L3_COIN_LOGO = {
    BTC: COIN_LOGO.BTC,
    ETH: COIN_LOGO.ETH,
    SOL: COIN_LOGO.SOL,
    DOGE: COIN_LOGO.DOGE,
    XRP: 'https://assets.coingecko.com/coins/images/44/large/xrp-symbol-white-128.png',
    BNB: 'https://assets.coingecko.com/coins/images/825/large/bnb-icon2_2x.png',
  };
  var L3_COIN_NAME = { BTC: 'Bitcoin', ETH: 'Ethereum', SOL: 'Solana', XRP: 'XRP', BNB: 'BNB', DOGE: 'Dogecoin' };
  var _l3 = { top: null, idx: null, spark: null, perps: null, candles: null, predict: null };
  var _l3SparkId = 0;

  var L3TX = {
    en: {
      sub: 'Buy Apple and Nvidia, trade Bitcoin with up to 40× leverage and take a side on world events — straight from your wallet. No KYC, no deposits to GROM.',
      sub_m: 'Stocks, perps, swap and predictions — from your own wallet. No KYC, no deposits.',
      trust: ['No KYC', 'No deposits', 'You sign every trade'],
      now_h: 'Markets now', mkt_open: 'US market open', mkt_closed: 'US market closed — last close',
      gold: 'Gold',
      stk_sub: 'Trade 24/7',
      stk_cta: 'Buy stocks', movers: 'Top movers',
      prp_sub: '350+ markets',
      prp_cta: 'Trade perps', vol: '24h vol',
      prd_sub: 'Crypto, politics, finance, sports, esports and culture',
      prd_cta: 'Open predictions', yes: 'Yes', no: 'No', ends: 'Ends {d}', today: 'Today {t}', tmr: 'Tomorrow {t}',
      c_crypto: 'Crypto', c_politics: 'Politics', c_economy: 'Economy', c_sport: 'Sports', c_world: 'World',
      swp_sub: '10,000+ tokens',
      swp_cta: 'Swap tokens',
      foot: 'Prices are for reference and update automatically. The exact price is in the quote you see before signing.',
      fin_sub: 'Connect your wallet and start with stocks, perps or predictions.',
      loading: 'Loading…',
    },
    ru: {
      sub: 'Покупай акции Apple и Nvidia, торгуй биткоином с плечом до 40× и делай прогнозы на события в мире — прямо из своего кошелька. Без KYC и без депозитов на GROM.',
      sub_m: 'Акции, perps, своп и прогнозы — из своего кошелька. Без KYC и депозитов.',
      trust: ['Без KYC', 'Без депозитов', 'Каждую сделку подписываешь ты'],
      now_h: 'Рынки сейчас', mkt_open: 'Биржа США открыта', mkt_closed: 'Биржа США закрыта — цены закрытия',
      gold: 'Золото',
      stk_sub: 'Торговля 24/7',
      stk_cta: 'Купить акции', movers: 'Сильнее всего двигаются',
      prp_sub: '350+ рынков',
      prp_cta: 'Торговать perps', vol: 'Объём 24ч',
      prd_sub: 'Крипта, политика, финансы, спорт, киберспорт и культура',
      prd_cta: 'Открыть прогнозы', yes: 'Да', no: 'Нет', ends: 'До {d}', today: 'Сегодня {t}', tmr: 'Завтра {t}',
      c_crypto: 'Крипта', c_politics: 'Политика', c_economy: 'Экономика', c_sport: 'Спорт', c_world: 'Мир',
      swp_sub: '10 000+ токенов',
      swp_cta: 'Обменять токены',
      foot: 'Цены справочные и обновляются автоматически. Точная цена — в котировке перед подписью.',
      fin_sub: 'Подключи кошелёк и начни с акций, perps или прогнозов.',
      loading: 'Загрузка…',
    },
    ua: {
      sub: 'Купуй акції Apple і Nvidia, торгуй біткоїном з плечем до 40× і роби прогнози на події у світі — прямо зі свого гаманця. Без KYC і без депозитів на GROM.',
      sub_m: 'Акції, perps, своп і прогнози — зі свого гаманця. Без KYC і депозитів.',
      trust: ['Без KYC', 'Без депозитів', 'Кожну угоду підписуєш ти'],
      now_h: 'Ринки зараз', mkt_open: 'Біржа США відкрита', mkt_closed: 'Біржа США закрита — ціни закриття',
      gold: 'Золото',
      stk_sub: 'Торгівля 24/7',
      stk_cta: 'Купити акції', movers: 'Найбільше рухаються',
      prp_sub: '350+ ринків',
      prp_cta: 'Торгувати perps', vol: 'Обсяг 24 год',
      prd_sub: 'Крипта, політика, фінанси, спорт, кіберспорт і культура',
      prd_cta: 'Відкрити прогнози', yes: 'Так', no: 'Ні', ends: 'До {d}', today: 'Сьогодні {t}', tmr: 'Завтра {t}',
      c_crypto: 'Крипта', c_politics: 'Політика', c_economy: 'Економіка', c_sport: 'Спорт', c_world: 'Світ',
      swp_sub: '10 000+ токенів',
      swp_cta: 'Обміняти токени',
      foot: 'Ціни довідкові й оновлюються автоматично. Точна ціна — у котируванні перед підписом.',
      fin_sub: 'Підключи гаманець і почни з акцій, perps або прогнозів.',
      loading: 'Завантаження…',
    },
    es: {
      sub: 'Compra acciones de Apple y Nvidia, opera bitcoin con apalancamiento de hasta 40× y predice eventos del mundo, directamente desde tu billetera. Sin KYC ni depósitos en GROM.',
      sub_m: 'Acciones, perps, swap y predicciones — desde tu billetera. Sin KYC ni depósitos.',
      trust: ['Sin KYC', 'Sin depósitos', 'Tú firmas cada operación'],
      now_h: 'Mercados ahora', mkt_open: 'Bolsa de EE. UU. abierta', mkt_closed: 'Bolsa de EE. UU. cerrada — precios de cierre',
      gold: 'Oro',
      stk_sub: 'Opera 24/7',
      stk_cta: 'Comprar acciones', movers: 'Mayores movimientos',
      prp_sub: 'Más de 350 mercados',
      prp_cta: 'Operar perps', vol: 'Vol. 24 h',
      prd_sub: 'Cripto, política, finanzas, deportes, esports y cultura',
      prd_cta: 'Abrir predicciones', yes: 'Sí', no: 'No', ends: 'Cierra {d}', today: 'Hoy {t}', tmr: 'Mañana {t}',
      c_crypto: 'Cripto', c_politics: 'Política', c_economy: 'Economía', c_sport: 'Deportes', c_world: 'Mundo',
      swp_sub: 'Más de 10 000 tokens',
      swp_cta: 'Intercambiar tokens',
      foot: 'Precios de referencia que se actualizan solos. El precio exacto aparece en la cotización antes de firmar.',
      fin_sub: 'Conecta tu billetera y empieza con acciones, perps o predicciones.',
      loading: 'Cargando…',
    },
    ar: {
      sub: 'اشترِ أسهم Apple وNvidia، وتداول البيتكوين برافعة حتى 40×، وتوقّع أحداث العالم — مباشرةً من محفظتك. بلا KYC وبلا إيداع لدى GROM.',
      sub_m: 'أسهم وعقود دائمة وتبديل وتوقعات — من محفظتك. بلا KYC وبلا إيداع.',
      trust: ['بلا KYC', 'بلا إيداع', 'أنت توقّع كل صفقة'],
      now_h: 'الأسواق الآن', mkt_open: 'السوق الأمريكية مفتوحة', mkt_closed: 'السوق الأمريكية مغلقة — أسعار الإغلاق',
      gold: 'الذهب',
      stk_sub: 'تداول على مدار الساعة 24/7',
      stk_cta: 'اشترِ الأسهم', movers: 'الأكثر تحركًا',
      prp_sub: 'أكثر من 350 سوقًا',
      prp_cta: 'تداول العقود الدائمة', vol: 'حجم 24س',
      prd_sub: 'كريبتو، سياسة، مال، رياضة، رياضات إلكترونية وثقافة',
      prd_cta: 'افتح التوقعات', yes: 'نعم', no: 'لا', ends: 'ينتهي {d}', today: 'اليوم {t}', tmr: 'غدًا {t}',
      c_crypto: 'كريبتو', c_politics: 'سياسة', c_economy: 'اقتصاد', c_sport: 'رياضة', c_world: 'العالم',
      swp_sub: 'أكثر من 10,000 رمز',
      swp_cta: 'بدّل الرموز',
      foot: 'الأسعار استرشادية وتتحدّث تلقائيًا. السعر الدقيق يظهر في عرض السعر قبل التوقيع.',
      fin_sub: 'اربط محفظتك وابدأ بالأسهم أو العقود الدائمة أو التوقعات.',
      loading: 'جارٍ التحميل…',
    },
    zh: {
      sub: '买入苹果和英伟达股票，以最高 40 倍杠杆交易比特币，预测全球事件——全部直接用你的钱包完成。无需 KYC，无需向 GROM 存款。',
      sub_m: '股票、永续合约、兑换和预测——用你自己的钱包。无需 KYC，无需存款。',
      trust: ['无需 KYC', '无需存款', '每笔交易由你签名'],
      now_h: '市场动态', mkt_open: '美股交易中', mkt_closed: '美股休市——显示收盘价',
      gold: '黄金',
      stk_sub: '7×24 小时交易',
      stk_cta: '买入股票', movers: '涨跌幅榜',
      prp_sub: '350+ 个市场',
      prp_cta: '交易永续合约', vol: '24h 成交额',
      prd_sub: '加密、政治、金融、体育、电竞和文化',
      prd_cta: '打开预测', yes: '是', no: '否', ends: '{d} 截止', today: '今天 {t}', tmr: '明天 {t}',
      c_crypto: '加密', c_politics: '政治', c_economy: '经济', c_sport: '体育', c_world: '世界',
      swp_sub: '10,000+ 种代币',
      swp_cta: '兑换代币',
      foot: '价格仅供参考，自动更新。确切价格以签名前看到的报价为准。',
      fin_sub: '连接钱包，从股票、永续合约或预测开始。',
      loading: '加载中…',
    },
    hi: {
      sub: 'Apple और Nvidia के शेयर खरीदें, 40× तक लीवरेज के साथ बिटकॉइन ट्रेड करें और दुनिया की घटनाओं पर प्रेडिक्शन करें — सीधे अपने वॉलेट से। न KYC, न GROM में जमा।',
      sub_m: 'शेयर, पर्प्स, स्वैप और प्रेडिक्शन — अपने वॉलेट से। न KYC, न जमा।',
      trust: ['न KYC', 'न जमा', 'हर ट्रेड आप साइन करते हैं'],
      now_h: 'बाज़ार अभी', mkt_open: 'US बाज़ार खुला है', mkt_closed: 'US बाज़ार बंद — क्लोज़िंग कीमतें',
      gold: 'सोना',
      stk_sub: '24/7 ट्रेडिंग',
      stk_cta: 'शेयर खरीदें', movers: 'सबसे ज़्यादा हलचल',
      prp_sub: '350+ मार्केट',
      prp_cta: 'पर्प्स ट्रेड करें', vol: '24घं वॉल्यूम',
      prd_sub: 'क्रिप्टो, राजनीति, फ़ाइनेंस, खेल, ई-स्पोर्ट्स और संस्कृति',
      prd_cta: 'प्रेडिक्शन खोलें', yes: 'हाँ', no: 'नहीं', ends: '{d} तक', today: 'आज {t}', tmr: 'कल {t}',
      c_crypto: 'क्रिप्टो', c_politics: 'राजनीति', c_economy: 'अर्थव्यवस्था', c_sport: 'खेल', c_world: 'दुनिया',
      swp_sub: '10,000+ टोकन',
      swp_cta: 'टोकन स्वैप करें',
      foot: 'कीमतें संदर्भ के लिए हैं और अपने-आप अपडेट होती हैं। सही कीमत साइन करने से पहले कोट में दिखती है।',
      fin_sub: 'वॉलेट कनेक्ट करें और शेयर, पर्प्स या प्रेडिक्शन से शुरू करें।',
      loading: 'लोड हो रहा है…',
    },
    tr: {
      sub: 'Apple ve Nvidia hissesi al, bitcoin’i 40×’e kadar kaldıraçla işle ve dünya olaylarını tahmin et — doğrudan cüzdanından. KYC yok, GROM’a para yatırma yok.',
      sub_m: 'Hisseler, perp, takas ve tahminler — kendi cüzdanından. KYC yok, para yatırma yok.',
      trust: ['KYC yok', 'Para yatırma yok', 'Her işlemi sen imzalarsın'],
      now_h: 'Piyasalar şimdi', mkt_open: 'ABD borsası açık', mkt_closed: 'ABD borsası kapalı — kapanış fiyatları',
      gold: 'Altın',
      stk_sub: '7/24 işlem',
      stk_cta: 'Hisse al', movers: 'En çok hareket edenler',
      prp_sub: '350+ piyasa',
      prp_cta: 'Perp işlem yap', vol: '24s hacim',
      prd_sub: 'Kripto, siyaset, finans, spor, e-spor ve kültür',
      prd_cta: 'Tahminleri aç', yes: 'Evet', no: 'Hayır', ends: '{d} bitiyor', today: 'Bugün {t}', tmr: 'Yarın {t}',
      c_crypto: 'Kripto', c_politics: 'Siyaset', c_economy: 'Ekonomi', c_sport: 'Spor', c_world: 'Dünya',
      swp_sub: '10.000+ token',
      swp_cta: 'Token takas et',
      foot: 'Fiyatlar bilgi amaçlıdır ve otomatik güncellenir. Kesin fiyat, imzadan önce gördüğün teklifte yer alır.',
      fin_sub: 'Cüzdanını bağla; hisse, perp veya tahminle başla.',
      loading: 'Yükleniyor…',
    },
  };
  function t3(k, vars) {
    var p = L3TX[lang()] || L3TX.en;
    var v = p[k] != null ? p[k] : L3TX.en[k];
    if (typeof v === 'string' && vars) {
      v = v.replace(/\{(\w+)\}/g, function (_, n) { return vars[n] != null ? vars[n] : ''; });
    }
    return v;
  }
  var L3_LOC = { ru: 'ru-RU', ua: 'uk-UA', es: 'es-ES', tr: 'tr-TR', en: 'en-US' };
  function l3Loc() { return L3_LOC[lang()] || 'en-US'; }
  function l3Num(n, dig) {
    n = Number(n);
    if (!Number.isFinite(n)) return '—';
    var d = dig != null ? dig : (n >= 1000 ? 2 : n >= 1 ? 2 : n >= 0.01 ? 4 : 6);
    try { return n.toLocaleString(l3Loc(), { minimumFractionDigits: Math.min(2, d), maximumFractionDigits: d }); }
    catch (_) { return n.toFixed(d); }
  }
  function l3Usd(n, dig) { return Number.isFinite(Number(n)) ? '$' + l3Num(n, dig) : '—'; }
  function l3Pct(n) {
    n = Number(n);
    if (!Number.isFinite(n)) return '—';
    var s = Math.abs(n).toLocaleString(l3Loc(), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (n > 0 ? '+' : n < 0 ? '−' : '') + s + '%';
  }
  function l3Big(n) {
    n = Number(n) || 0;
    if (n >= 1e9) return '$' + l3Num(n / 1e9, 1) + 'B';
    if (n >= 1e6) return '$' + l3Num(n / 1e6, 1) + 'M';
    if (n >= 1e3) return '$' + l3Num(n / 1e3, 0) + 'K';
    return '$' + l3Num(n, 0);
  }
  function l3Dir(n) { n = Number(n); return n > 0 ? 'is-up' : n < 0 ? 'is-dn' : 'is-flat'; }
  function l3Arrow(n) {
    n = Number(n);
    var d = n >= 0 ? 'M6 2l4 6H2z' : 'M6 10L2 4h8z';
    return '<svg class="l3-arr" viewBox="0 0 12 12" aria-hidden="true"><path d="' + d + '" fill="currentColor"/></svg>';
  }

  /* Sparkline with a dotted line at the opening value (like a broker app). */
  function l3Spark(vals, dir, w, h) {
    w = w || 120; h = h || 40;
    if (!vals || vals.length < 2) return '<svg class="l3-spark is-empty" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" aria-hidden="true"></svg>';
    var min = Infinity, max = -Infinity;
    for (var i = 0; i < vals.length; i++) { if (vals[i] < min) min = vals[i]; if (vals[i] > max) max = vals[i]; }
    var span = max - min || Math.abs(max) * 0.001 || 1;
    var pad = 3;
    function y(v) { return (h - pad - ((v - min) / span) * (h - pad * 2)).toFixed(1); }
    var pts = [];
    for (var j = 0; j < vals.length; j++) pts.push(((j / (vals.length - 1)) * w).toFixed(1) + ',' + y(vals[j]));
    var line = 'M' + pts.join(' L');
    var area = line + ' L' + w + ',' + h + ' L0,' + h + ' Z';
    var id = 'l3g' + (++_l3SparkId);
    var y0 = y(vals[0]);
    return '<svg class="l3-spark ' + dir + '" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" aria-hidden="true">' +
      '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="currentColor" stop-opacity=".26"/><stop offset="1" stop-color="currentColor" stop-opacity="0"/></linearGradient></defs>' +
      '<line x1="0" x2="' + w + '" y1="' + y0 + '" y2="' + y0 + '" class="l3-base" vector-effect="non-scaling-stroke"/>' +
      '<path d="' + area + '" fill="url(#' + id + ')"/>' +
      '<path d="' + line + '" fill="none" stroke="currentColor" stroke-width="1.7" vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round"/>' +
      '</svg>';
  }

  /* Last session from a 5-day hourly series, opened at the previous close so the line matches the day's change. */
  function l3DaySeries(series, chg) {
    if (!series || series.length < 3) return null;
    var tail = series.slice(-7);
    var last = tail[tail.length - 1];
    var c = Number(chg);
    if (Number.isFinite(c) && c > -99) tail.unshift(last / (1 + c / 100));
    return tail;
  }

  function l3Logo(sym, cls) {
    var letter = esc(String(sym || '?').slice(0, 1));
    return '<span class="l3-logo ' + (cls || '') + '" data-letter="' + letter + '"><img src="/api/market/stocks/logo/' + encodeURIComponent(sym) + '.png" alt="" loading="lazy" decoding="async" ' +
      'onerror="this.parentNode.classList.add(\'is-fb\');this.remove();"/></span>';
  }
  function l3CoinLogo(coin) {
    var letter = esc(String(coin || '?').slice(0, 1));
    var src = L3_COIN_LOGO[coin];
    return '<span class="l3-logo is-coin" data-letter="' + letter + '">' + (src ? '<img src="' + esc(src) + '" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" ' +
      'onerror="this.parentNode.classList.add(\'is-fb\');this.remove();"/>' : '') + '</span>';
  }

  /* ---------- data ---------- */
  function l3Json(url, ms) {
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = setTimeout(function () { try { if (ctrl) ctrl.abort(); } catch (_) {} }, ms || 12000);
    return fetch(url, { cache: 'no-store', signal: ctrl ? ctrl.signal : undefined })
      .then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .finally(function () { clearTimeout(timer); });
  }
  function l3FetchTop() {
    return cached('l3top', 60_000, function () {
      return l3Json('/api/market/stocks/top?n=24').then(function (j) {
        var items = (j && j.items) || [];
        return items.length ? { items: items, count: Number(j.count) || 0 } : null;
      });
    });
  }
  function l3FetchIdx() {
    return cached('l3idx', 60_000, function () {
      return l3Json('/api/market/stocks/indices').then(function (j) {
        var list = (j && j.indices) || [];
        if (!list.length) return null;
        var by = {};
        list.forEach(function (x) { by[x.sym] = x; });
        return { by: by, list: list, state: j.marketState || '' };
      });
    });
  }
  function l3FetchSpark() {
    var syms = L3_STOCKS.concat([L3_ETF.SPX, L3_ETF.NDX, L3_ETF.RUT, L3_ETF.GOLD]);
    return cached('l3spark', 300_000, function () {
      return l3Json('/api/market/stocks/spark?syms=' + syms.join(','), 15000).then(function (j) {
        var s = (j && j.series) || {};
        return Object.keys(s).length ? s : null;
      });
    });
  }
  function l3FetchPerps() {
    return cached('l3perps', 15_000, function () {
      return hlInfo({ type: 'metaAndAssetCtxs' }).then(function (j) {
        var uni = (j && j[0] && j[0].universe) || [];
        var ctx = (j && j[1]) || [];
        var live = 0;
        var rows = {};
        var heat = [];
        for (var i = 0; i < uni.length; i++) {
          if (!uni[i] || uni[i].isDelisted) continue;
          live++;
          var name = String(uni[i].name || '').toUpperCase();
          if (ctx[i]) {
            var hm = Number(ctx[i].markPx) || 0, hp = Number(ctx[i].prevDayPx) || 0, hv = Number(ctx[i].dayNtlVlm) || 0;
            if (hm > 0 && hp > 0 && hv > 0 && /^[A-Z0-9]{2,10}$/.test(name)) heat.push({ coin: name, vol: hv, chg: (hm / hp - 1) * 100 });
          }
          if (L3_PERPS.indexOf(name) < 0 || !ctx[i]) continue;
          var mark = Number(ctx[i].markPx) || 0;
          var prev = Number(ctx[i].prevDayPx) || 0;
          if (!(mark > 0)) continue;
          rows[name] = {
            coin: name,
            price: mark,
            chg: prev > 0 ? (mark / prev - 1) * 100 : 0,
            lev: Number(uni[i].maxLeverage) || 0,
            vol: Number(ctx[i].dayNtlVlm) || 0,
          };
        }
        heat.sort(function (a, b) { return b.vol - a.vol; });
        return Object.keys(rows).length ? { rows: rows, live: live, heat: heat.slice(0, 18) } : null;
      });
    });
  }
  function l3FetchCandles() {
    return cached('l3candles', 300_000, function () {
      var start = Date.now() - 24 * 3600_000;
      return Promise.all(L3_PERPS.map(function (coin) {
        return hlInfo({ type: 'candleSnapshot', req: { coin: coin, interval: '1h', startTime: start } })
          .then(function (rows) {
            var closes = (rows || []).map(function (c) { return Number(c.c); }).filter(function (v) { return v > 0; });
            return [coin, closes];
          })
          .catch(function () { return [coin, null]; });
      })).then(function (pairs) {
        var out = {};
        pairs.forEach(function (p) { if (p[1] && p[1].length > 2) out[p[0]] = p[1]; });
        return Object.keys(out).length ? out : null;
      });
    });
  }

  /* Sub-market names (totals, handicaps, «Match Winner», «Game 2 Winner», draws) are not outcomes a reader can follow. */
  var L3_SKIP_ROW = /(^|\s)(O\/U|[1-4]Q|[12]H)\b|spread|handicap|over\/under|^[+\-−]\d|winner|game\s*\d|map\s*\d|set\s*\d|^draw\b|ничья|победитель/i;
  var L3_PLACEHOLDER = /^(команда|team|другая|другой|other|otro|otra|diğer|其他|अन्य|أخرى)(\s|$)/i;
  function l3PredCat(m) {
    var cat = String(m.cat || '').toLowerCase();
    var q = String(m.q || '');
    if (cat === 'crypto') return 'crypto';
    if (cat === 'politics') return 'politics';
    if (cat === 'economy' || cat === 'finance') return 'economy';
    if (cat === 'sport' || cat === 'sports' || cat === 'esports' || /\svs\.?\s|\sпротив\s/i.test(q)) return 'sport';
    return 'world';
  }
  function l3FixTitle(q) {
    /* Machine-translated titles sometimes glue a word to a date ("через22 ноября"). */
    return String(q || '').replace(/([A-Za-zА-Яа-яЁёІіЇїЄє])(\d)/g, '$1 $2').replace(/\s{2,}/g, ' ').trim();
  }
  function l3FetchPredict() {
    return cached('l3pred_' + lang(), 90_000, function () {
      return l3Json('/api/market/predict?limit=80&offset=0&lang=' + encodeURIComponent(lang()), 15000).then(function (j) {
        var list = (j && j.markets) || [];
        var now = Date.now();
        var pool = { match: [], crypto: [], politics: [], economy: [], sport: [], world: [] };
        list.forEach(function (m) {
          var ends = Date.parse(m.endsAt || '') || 0;
          var vol = Number(m.vol24 != null ? m.vol24 : m.vol) || 0;
          if (vol < 20000) return;
          /* Upcoming games: «Team A 55% · Team B 45%» cards with the kick-off time, like a broker app. */
          var mt = m.match;
          if (mt && mt.a && mt.b && mt.pa > 0 && mt.pb > 0) {
            if (Math.min(mt.pa, mt.pb) < 5) return; // a foregone result is not worth a card
            if (ends > now + 10 * 60_000 && ends < now + 4 * 86400_000) {
              pool.match.push({ id: m.id || m.slug, q: l3FixTitle(m.q || m.title), cat: 'sport', isMatch: true,
                outs: [{ n: String(mt.a), p: Math.round(Number(mt.pa)) }, { n: String(mt.b), p: Math.round(Number(mt.pb)) }],
                vol: vol, ends: ends, img: String(m.img || '') });
            }
            return;
          }
          if (ends && ends < now + 3 * 3600_000) return;
          var rows = (m.rows || []).filter(function (r) {
            var n = String(r.n || '');
            var p = Number(r.p);
            if (!(p > 0 && p < 100)) return false;
            if (L3_SKIP_ROW.test(n)) return false;
            if (L3_PLACEHOLDER.test(n)) return false;
            if (n.length > 42) return false;
            return true;
          });
          var single = rows.length === 1 && (m.rows || []).length === 1;
          /* A lone outcome of a multi-outcome market (e.g. one team of a match) reads as half a question. */
          if (!rows.length || (rows.length < 2 && !single)) return;
          rows.sort(function (a, b) { return Number(b.p) - Number(a.p); });
          var outs = single
            ? [{ n: t3('yes'), p: Math.round(Number(rows[0].p)) }, { n: t3('no'), p: Math.round(Number(rows[0].pNo != null ? rows[0].pNo : 100 - rows[0].p)) }]
            : rows.slice(0, 2).map(function (r) { return { n: String(r.n || ''), p: Math.round(Number(r.p)) }; });
          var cat = l3PredCat(m);
          pool[cat].push({ id: m.id || m.slug, q: l3FixTitle(m.q || m.title), cat: cat, outs: outs, vol: vol, ends: ends, img: String(m.img || '') });
        });
        Object.keys(pool).forEach(function (k) { pool[k].sort(function (a, b) { return b.vol - a.vol; }); });
        var pick = [];
        var seen = {};
        function take(cat, n) {
          for (var i = 0; i < pool[cat].length && n > 0; i++) {
            var m = pool[cat][i];
            if (seen[m.id]) continue;
            seen[m.id] = 1; pick.push(m); n--;
          }
        }
        take('match', 2); take('crypto', 2); take('politics', 2); take('economy', 1); take('sport', 1);
        if (pick.length < 8) take('world', 8 - pick.length);
        ['sport', 'match', 'politics', 'economy', 'crypto'].forEach(function (c) { if (pick.length < 8) take(c, 8 - pick.length); });
        /* Mix the kinds so the first row (and the 6 cards a phone shows) is not one topic. */
        var lanes = {};
        pick.forEach(function (m) { var k = m.isMatch ? 'match' : m.cat; (lanes[k] = lanes[k] || []).push(m); });
        var order = ['match', 'crypto', 'politics', 'economy', 'sport', 'world'];
        var mixed = [];
        for (var round = 0; mixed.length < pick.length && round < 8; round++) {
          order.forEach(function (k) { if (lanes[k] && lanes[k][round]) mixed.push(lanes[k][round]); });
        }
        return mixed.length ? { cards: mixed.slice(0, 8), total: Number(j.total) || list.length } : null;
      });
    });
  }

  /* ---------- views ---------- */
  function l3TopBy() {
    var by = {};
    ((_l3.top && _l3.top.items) || []).forEach(function (x) { by[x.s] = x; });
    return by;
  }
  function l3Skel(n, cls) {
    var out = '';
    for (var i = 0; i < n; i++) out += '<div class="l3-card ' + cls + ' is-skel" aria-hidden="true"><i></i><i></i><i></i></div>';
    return out;
  }

  function l3TapeHtml() {
    var items = [];
    var idx = _l3.idx && _l3.idx.by;
    if (idx) {
      [['^GSPC', 'S&P 500'], ['^IXIC', 'Nasdaq'], ['^DJI', 'Dow Jones'], ['GC=F', t3('gold')], ['CL=F', 'WTI'], ['^VIX', 'VIX']].forEach(function (p) {
        var x = idx[p[0]];
        if (x && x.price > 0) items.push({ k: p[1], v: l3Num(x.price, 2), c: x.chg });
      });
    }
    var perps = _l3.perps && _l3.perps.rows;
    if (perps) ['BTC', 'ETH', 'SOL'].forEach(function (c) { var r = perps[c]; if (r) items.push({ k: c, v: l3Usd(r.price, r.price < 10 ? 4 : 2), c: r.chg }); });
    ((_l3.top && _l3.top.items) || []).slice(0, 16).forEach(function (s) {
      if (s.s === 'GOOG') return;
      items.push({ k: s.s, v: l3Usd(s.p, 2), c: s.c });
    });
    if (items.length < 6) return null;
    var row = items.map(function (x) {
      return '<span class="l3-tp" data-k="' + esc(x.k) + '"><b>' + esc(x.k) + '</b><span>' + esc(x.v) + '</span><em class="' + l3Dir(x.c) + '">' + l3Arrow(x.c) + esc(l3Pct(x.c)) + '</em></span>';
    }).join('');
    return { keys: items.map(function (x) { return x.k; }).join('|'), items: items,
      html: '<div class="l3-tape-track">' + row + '</div><div class="l3-tape-track" aria-hidden="true">' + row + '</div>' };
  }
  function mountTape() {
    var page = document.getElementById('page-landing');
    var wrap = page && page.querySelector('.lp-wrap');
    if (!wrap) return;
    var tape = page.querySelector('.l3-tape');
    if (!tape) {
      tape = document.createElement('div');
      tape.className = 'l3-tape';
      tape.setAttribute('data-no-tr', '');
      tape.setAttribute('role', 'marquee');
      tape.setAttribute('aria-label', 'Live market prices');
      wrap.parentNode.insertBefore(tape, wrap);
    }
    var data = l3TapeHtml();
    if (!data) { tape.hidden = true; return; }
    tape.hidden = false;
    if (tape.__l3keys === data.keys) {
      /* Same symbols: update numbers in place so the running tape never jumps back to the start. */
      data.items.forEach(function (x) {
        tape.querySelectorAll('.l3-tp[data-k="' + x.k.replace(/"/g, '') + '"]').forEach(function (el) {
          var v = el.children[1], e = el.children[2];
          if (v && v.textContent !== x.v) v.textContent = x.v;
          var cls = l3Dir(x.c), txt = l3Pct(x.c);
          if (e && (e.className !== cls || e.textContent !== txt)) { e.className = cls; e.innerHTML = l3Arrow(x.c) + esc(txt); }
        });
      });
      return;
    }
    tape.innerHTML = data.html;
    tape.__l3keys = data.keys;
  }

  /* Squarified treemap (Bruls et al.) in a w×h box. */
  function l3Squarify(items, w, h) {
    var total = 0;
    items.forEach(function (it) { total += it.v; });
    var scale = (w * h) / (total || 1);
    var rest = items.map(function (it) { return { it: it, a: it.v * scale }; });
    var x = 0, y = 0, out = [];
    function worst(row, side) {
      var s = 0, mx = 0, mn = Infinity;
      row.forEach(function (r) { s += r.a; if (r.a > mx) mx = r.a; if (r.a < mn) mn = r.a; });
      return Math.max((side * side * mx) / (s * s), (s * s) / (side * side * mn));
    }
    while (rest.length) {
      var side = Math.min(w, h);
      var row = [rest[0]], i = 1;
      while (i < rest.length) {
        var cand = row.concat([rest[i]]);
        if (worst(cand, side) <= worst(row, side)) { row = cand; i++; } else break;
      }
      var sum = 0;
      row.forEach(function (r) { sum += r.a; });
      if (w >= h) {
        var cw = sum / h, cy = y;
        row.forEach(function (r) { var rh = r.a / cw; out.push({ it: r.it, x: x, y: cy, w: cw, h: rh }); cy += rh; });
        x += cw; w -= cw;
      } else {
        var rh2 = sum / w, cx = x;
        row.forEach(function (r) { var rw = r.a / rh2; out.push({ it: r.it, x: cx, y: y, w: rw, h: rh2 }); cx += rw; });
        y += rh2; h -= rh2;
      }
      rest = rest.slice(row.length);
    }
    return out;
  }
  function l3Tiles(items, span) {
    var W = 100, H = 72;
    var rects = l3Squarify(items, W, H);
    return rects.map(function (r) {
      var it = r.it;
      var c = Number(it.c) || 0;
      var k = Math.min(1, Math.abs(c) / span);
      var a = (0.42 + 0.58 * k).toFixed(2);
      var bg = c >= 0 ? 'rgba(14,196,112,' + a + ')' : 'rgba(255,72,56,' + a + ')';
      var area = r.w * r.h;
      var size = area > 900 ? 'is-xl' : area > 420 ? 'is-l' : area > 170 ? 'is-m' : area > 70 ? 'is-s' : 'is-xs';
      return '<button type="button" class="l3-tile ' + size + '" ' + it.attr + ' style="left:' + (r.x / W * 100).toFixed(3) + '%;top:' + (r.y / H * 100).toFixed(3) + '%;width:' + (r.w / W * 100).toFixed(3) + '%;height:' + (r.h / H * 100).toFixed(3) + '%;--tile:' + bg + '" title="' + esc(it.title || it.label) + '">' +
        '<b>' + esc(it.label) + '</b><span>' + esc(l3Pct(c)) + '</span></button>';
    }).join('');
  }
  /* Titles open their market with a ›, like a broker app; no «24h change» caption (owner, 15.11). */
  var L3_CHEV = '<svg class="l3-chev" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3.5L10.5 8 6 12.5"/></svg>';
  function l3CardHead(title, chip, go) {
    return '<div class="l3-map-head"><button type="button" class="l3-head-link" data-lv2-go="' + go + '">' + esc(title) + L3_CHEV + '</button>' + (chip || '') + '</div>';
  }
  function l3MapHtml() {
    var items = ((_l3.top && _l3.top.items) || []).filter(function (s) { return s.mc > 0 && s.s !== 'GOOG' && s.s !== 'BRK.A'; }).slice(0, 18);
    var spx = _l3.idx && _l3.idx.by['^GSPC'];
    var head = l3CardHead('Market map', spx ? '<span class="l3-chip ' + l3Dir(spx.chg) + '">S&amp;P 500 ' + l3Arrow(spx.chg) + esc(l3Pct(spx.chg)) + '</span>' : '', 'xstocks');
    if (!items.length) return head + '<div class="l3-map-box is-skel"></div>';
    return head + '<div class="l3-map-box">' + l3Tiles(items.map(function (s) {
      return { v: Math.sqrt(s.mc), c: s.c, label: s.s, title: s.n || s.s, attr: 'data-l3-stock="' + esc(s.s) + '"' };
    }), 3) + '</div>';
  }
  function l3CryptoMapHtml() {
    var heat = (_l3.perps && _l3.perps.heat) || [];
    var btc = _l3.perps && _l3.perps.rows && _l3.perps.rows.BTC;
    var head = l3CardHead('Crypto map', btc ? '<span class="l3-chip ' + l3Dir(btc.chg) + '">BTC ' + l3Arrow(btc.chg) + esc(l3Pct(btc.chg)) + '</span>' : '', 'futures');
    if (!heat.length) return head + '<div class="l3-map-box is-skel"></div>';
    return head + '<div class="l3-map-box">' + l3Tiles(heat.map(function (h) {
      return { v: Math.sqrt(h.vol), c: h.chg, label: h.coin, title: h.coin + '-PERP', attr: 'data-l3-perp="' + esc(h.coin) + '"' };
    }), 6) + '</div>';
  }
  function l3PredMiniHtml() {
    var cards = (_l3.predict && _l3.predict.cards) || [];
    var head = l3CardHead('Predictions', '', 'predict');
    if (!cards.length) return head + '<div class="l3-map-box is-skel"></div>';
    var rows = cards.slice(0, 4).map(function (m) {
      var o = m.outs[0] || { n: '', p: 0 };
      var p = Math.max(1, Math.min(99, o.p));
      return '<button type="button" class="l3-pm" data-lv2-go="predict">' +
        '<span class="l3-pm-ico is-' + m.cat + '">' + (L3_CAT_ICON[m.cat] || '') + '</span>' +
        '<span class="l3-pm-q"><span class="l3-pm-t">' + esc(m.q) + '</span><small>' + esc(o.n) + '</small></span>' +
        '<span class="l3-pm-p"><b>' + p + '%</b><i><em style="width:' + p + '%"></em></i></span>' +
      '</button>';
    }).join('');
    return head + '<div class="l3-map-box l3-pm-box">' + rows + '</div>';
  }
  /* Hero right: swipeable cards like a broker app — the next card peeks at the edge. */
  function mountMap() {
    var right = document.querySelector('#page-landing .lp-hero-right');
    if (!right) return;
    right.querySelectorAll('.landing-hero-icon, .landing-hero-logo-frame, .landing-brand-anim, .lv2-hw').forEach(function (n) {
      try { n.remove(); } catch (_) {}
    });
    var car = right.querySelector('.l3-car');
    if (!car) {
      right.querySelectorAll('.l3-map').forEach(function (n) { try { n.remove(); } catch (_) {} });
      car = document.createElement('div');
      car.className = 'l3-car';
      car.setAttribute('data-no-tr', '');
      car.innerHTML =
        '<div class="l3-car-track">' +
          '<div class="l3-map l3-car-card" data-car="stocks"></div>' +
          '<div class="l3-map l3-car-card" data-car="crypto"></div>' +
          '<div class="l3-map l3-car-card" data-car="pred"></div>' +
        '</div>' +
        '<div class="l3-car-nav">' +
          '<button type="button" class="l3-car-arr" data-car-step="-1" aria-label="Previous">‹</button>' +
          '<span class="l3-car-dots"><button type="button" class="on" data-car-i="0" aria-label="1"></button><button type="button" data-car-i="1" aria-label="2"></button><button type="button" data-car-i="2" aria-label="3"></button></span>' +
          '<button type="button" class="l3-car-arr" data-car-step="1" aria-label="Next">›</button>' +
        '</div>';
      right.appendChild(car);
      var track = car.querySelector('.l3-car-track');
      var cardsEl = function () { return track.querySelectorAll('.l3-car-card'); };
      var current = function () {
        var list = cardsEl(), best = 0, bestD = Infinity;
        for (var i = 0; i < list.length; i++) {
          var d = Math.abs(list[i].offsetLeft - track.offsetLeft - track.scrollLeft);
          if (d < bestD) { bestD = d; best = i; }
        }
        return best;
      };
      var goTo = function (i) {
        var list = cardsEl();
        i = Math.max(0, Math.min(list.length - 1, i));
        try { track.scrollTo({ left: list[i].offsetLeft - track.offsetLeft, behavior: 'smooth' }); } catch (_) { track.scrollLeft = list[i].offsetLeft - track.offsetLeft; }
      };
      var syncDots = function () {
        var i = current();
        car.querySelectorAll('.l3-car-dots button').forEach(function (b, k) { b.classList.toggle('on', k === i); });
      };
      track.addEventListener('scroll', function () {
        clearTimeout(track._l3t);
        track._l3t = setTimeout(syncDots, 60);
      }, { passive: true });
      car.addEventListener('click', function (e) {
        var dot = e.target.closest('[data-car-i]');
        if (dot) { e.preventDefault(); goTo(Number(dot.getAttribute('data-car-i'))); return; }
        var step = e.target.closest('[data-car-step]');
        if (step) { e.preventDefault(); goTo(current() + Number(step.getAttribute('data-car-step'))); }
      });
    }
    var parts = { stocks: l3MapHtml(), crypto: l3CryptoMapHtml(), pred: l3PredMiniHtml() };
    Object.keys(parts).forEach(function (k) {
      var el = car.querySelector('[data-car="' + k + '"]');
      if (el && el.__l3 !== parts[k]) { el.innerHTML = parts[k]; el.__l3 = parts[k]; }
    });
  }

  function l3MarketCards() {
    var idx = _l3.idx && _l3.idx.by;
    var sp = _l3.spark || {};
    var perps = (_l3.perps && _l3.perps.rows) || {};
    var cand = _l3.candles || {};
    var cards = [
      { key: '^GSPC', name: 'S&P 500', etf: L3_ETF.SPX, go: 'xstocks', sym: 'SPY' },
      { key: '^IXIC', name: 'Nasdaq', etf: L3_ETF.NDX, go: 'xstocks', sym: 'QQQ' },
      { key: '^RUT', name: 'Russell 2000', etf: L3_ETF.RUT, go: 'xstocks', sym: 'IWM' },
      { key: 'GC=F', name: t3('gold'), etf: L3_ETF.GOLD, go: 'xstocks', sym: 'GLD' },
      { coin: 'BTC', name: 'Bitcoin' },
      { coin: 'ETH', name: 'Ethereum' },
    ];
    var html = cards.map(function (c) {
      var price, chg, series, attr;
      if (c.coin) {
        var r = perps[c.coin];
        if (!r) return '<div class="l3-card l3-mkt is-skel" aria-hidden="true"><i></i><i></i><i></i></div>';
        price = l3Usd(r.price, 2); chg = r.chg; c.v = r.price;
        series = cand[c.coin] ? cand[c.coin].slice() : null;
        if (series) series.unshift(r.price / (1 + chg / 100));
        attr = 'data-l3-perp="' + c.coin + '"';
      } else {
        var x = idx && idx[c.key];
        if (!x) return '<div class="l3-card l3-mkt is-skel" aria-hidden="true"><i></i><i></i><i></i></div>';
        price = l3Num(x.price, 2); chg = x.chg; c.v = x.price;
        series = l3DaySeries(sp[c.etf], chg);
        attr = 'data-l3-stock="' + c.sym + '"';
      }
      return '<button type="button" class="l3-card l3-mkt" ' + attr + '>' +
        '<span class="l3-mkt-name">' + esc(c.name) + '</span>' +
        l3Spark(series, l3Dir(chg), 140, 46) +
        '<span class="l3-mkt-px" data-k="m:' + esc(c.coin || c.key) + '" data-v="' + c.v + '">' + esc(price) + '</span>' +
        '<span class="l3-chg ' + l3Dir(chg) + '">' + l3Arrow(chg) + esc(l3Pct(chg)) + '</span>' +
      '</button>';
    }).join('');
    return html;
  }

  function l3StockCards() {
    var by = l3TopBy();
    var sp = _l3.spark || {};
    if (!_l3.top) return l3Skel(6, 'l3-stk');
    return L3_STOCKS.map(function (sym) {
      var s = by[sym];
      if (!s) return '';
      var series = l3DaySeries(sp[sym], s.c);
      return '<button type="button" class="l3-card l3-stk" data-l3-stock="' + esc(sym) + '">' +
        '<span class="l3-row">' + l3Logo(sym) + '<span class="l3-id"><b>' + esc(sym) + '</b><small>' + esc(s.n || '') + '</small></span></span>' +
        l3Spark(series, l3Dir(s.c), 160, 48) +
        '<span class="l3-row l3-row-px"><span class="l3-px" data-k="s:' + esc(sym) + '" data-v="' + Number(s.p) + '">' + esc(l3Usd(s.p, 2)) + '</span><span class="l3-chg ' + l3Dir(s.c) + '">' + l3Arrow(s.c) + esc(l3Pct(s.c)) + '</span></span>' +
      '</button>';
    }).join('');
  }
  function l3MoverChips() {
    var items = ((_l3.top && _l3.top.items) || []).filter(function (s) {
      return s.s !== 'GOOG' && L3_STOCKS.indexOf(s.s) < 0 && Number.isFinite(Number(s.c));
    });
    items.sort(function (a, b) { return Math.abs(b.c) - Math.abs(a.c); });
    if (!items.length) return '';
    return '<div class="l3-chips-wrap"><span class="l3-chips-h">' + esc(t3('movers')) + '</span><div class="l3-chips">' +
      items.slice(0, 7).map(function (s) {
        return '<button type="button" class="l3-chip-btn" data-l3-stock="' + esc(s.s) + '">' + l3Logo(s.s, 'is-sm') + '<b>' + esc(s.s) + '</b><em class="' + l3Dir(s.c) + '">' + l3Arrow(s.c) + esc(l3Pct(s.c)) + '</em></button>';
      }).join('') + '</div></div>';
  }

  function l3PerpCards() {
    var rows = _l3.perps && _l3.perps.rows;
    var cand = _l3.candles || {};
    if (!rows) return l3Skel(6, 'l3-prp');
    return L3_PERPS.map(function (coin) {
      var r = rows[coin];
      if (!r) return '';
      var series = cand[coin] ? cand[coin].slice() : null;
      if (series) series.unshift(r.price / (1 + r.chg / 100));
      return '<button type="button" class="l3-card l3-prp" data-l3-perp="' + coin + '">' +
        '<span class="l3-row">' + l3CoinLogo(coin) + '<span class="l3-id"><b>' + coin + '</b><small>' + esc(L3_COIN_NAME[coin] || coin) + '</small></span>' +
          (r.lev ? '<span class="l3-lev">' + r.lev + '×</span>' : '') + '</span>' +
        l3Spark(series, l3Dir(r.chg), 160, 48) +
        '<span class="l3-row l3-row-px"><span class="l3-px" data-k="p:' + coin + '" data-v="' + r.price + '">' + esc(l3Usd(r.price, r.price < 1 ? 5 : r.price < 10 ? 4 : 2)) + '</span><span class="l3-chg ' + l3Dir(r.chg) + '">' + l3Arrow(r.chg) + esc(l3Pct(r.chg)) + '</span></span>' +
        '<span class="l3-meta">' + esc(t3('vol')) + ' ' + esc(l3Big(r.vol)) + '</span>' +
      '</button>';
    }).join('');
  }

  function l3When(ts) {
    if (!ts) return '';
    var d = new Date(ts);
    var now = new Date();
    try {
      if (d.toDateString() === now.toDateString()) {
        return t3('today', { t: d.toLocaleTimeString(l3Loc(), { hour: '2-digit', minute: '2-digit' }) });
      }
      var opts = { day: 'numeric', month: 'short' };
      if (d.getFullYear() !== now.getFullYear()) opts.year = 'numeric';
      return t3('ends', { d: d.toLocaleDateString(l3Loc(), opts) });
    } catch (_) { return ''; }
  }
  /* Kick-off time of a game: «Сегодня 21:05», «Завтра 18:00», «22 нояб. 17:30». */
  function l3MatchWhen(ts) {
    if (!ts) return '';
    var d = new Date(ts);
    var now = new Date();
    try {
      var tm = d.toLocaleTimeString(l3Loc(), { hour: '2-digit', minute: '2-digit' });
      if (d.toDateString() === now.toDateString()) return t3('today', { t: tm });
      var tmr = new Date(now.getTime() + 86400_000);
      if (d.toDateString() === tmr.toDateString()) return t3('tmr', { t: tm });
      return d.toLocaleDateString(l3Loc(), { day: 'numeric', month: 'short' }) + ' ' + tm;
    } catch (_) { return ''; }
  }
  var L3_CAT_ICON = {
    crypto: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M9 7h5.5a2.5 2.5 0 010 5H9zm0 5h6a2.5 2.5 0 010 5H9zM9 5v14M11 5v2m0 10v2"/></svg>',
    politics: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 21h18M5 21V10m4 11V10m6 11V10m4 11V10M2 10l10-6 10 6z"/></svg>',
    economy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 17l6-6 4 4 8-8M15 7h6v6"/></svg>',
    sport: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7l4 3-1.5 5h-5L8 10z"/></svg>',
    world: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18"/></svg>',
  };
  /* Compact event cards like a broker app's match cards: when · question · two outcomes · one split bar. */
  function l3PredCards() {
    var cards = _l3.predict && _l3.predict.cards;
    if (!cards) return l3Skel(8, 'l3-prd');
    return cards.map(function (m) {
      var o = m.outs.slice(0, 2).map(function (x) { return { n: x.n, p: Math.max(1, Math.min(99, x.p)) }; });
      var outs = o.map(function (x, i) {
        return '<span class="l3-out' + (i === 0 ? ' is-lead' : '') + '"><i class="l3-out-dot" aria-hidden="true"></i><span class="l3-out-n">' + esc(x.n) + '</span><b>' + x.p + '%</b></span>';
      }).join('');
      /* Two sides of one question (Yes/No, Team A/Team B) share one split bar; otherwise the bar is the
         leading outcome's chance — two separate markets must not look like shares of one whole. */
      var pair = o.length === 2 && Math.abs(o[0].p + o[1].p - 100) <= 3;
      var split = pair
        ? '<span class="l3-split" aria-hidden="true"><i style="flex-grow:' + o[0].p + '"></i><i style="flex-grow:' + o[1].p + '"></i></span>'
        : '<span class="l3-split is-one" aria-hidden="true"><i style="flex-grow:' + o[0].p + '"></i><i style="flex-grow:' + (100 - o[0].p) + '"></i></span>';
      var img = /^https:\/\//.test(m.img || '')
        ? '<img class="l3-prd-img" src="' + esc(m.img) + '" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.remove()">'
        : '<span class="l3-prd-img is-' + m.cat + '" aria-hidden="true">' + (L3_CAT_ICON[m.cat] || '') + '</span>';
      return '<button type="button" class="l3-card l3-prd' + (pair ? '' : ' is-one') + '" data-lv2-go="predict">' +
        '<span class="l3-prd-top"><span class="l3-when">' + esc(m.isMatch ? l3MatchWhen(m.ends) : l3When(m.ends)) + '</span><span class="l3-prd-vol">' + esc(l3Big(m.vol)) + '</span></span>' +
        '<span class="l3-prd-head">' + img + '<span class="l3-prd-q">' + esc(m.q) + '</span></span>' +
        '<span class="l3-outs">' + outs + '</span>' + split +
      '</button>';
    }).join('');
  }

  /* The section title itself opens the market («Stocks ›»); the separate CTA buttons are gone (owner, 15.11). */
  function l3SecHead(title, sub, hint, go) {
    return '<div class="l3-sec-head">' +
      '<h2 class="l3-sec-title"><button type="button" class="l3-sec-link" data-lv2-go="' + go + '" title="' + esc(hint) + '">' +
        '<span class="l3-dot" aria-hidden="true"></span>' + esc(title) + L3_CHEV + '</button></h2>' +
      '<p class="l3-sec-sub">' + esc(sub) + '</p>' +
    '</div>';
  }

  function l3BoardParts() {
    var idx = _l3.idx;
    var state = idx && idx.state ? (String(idx.state).toUpperCase() === 'REGULAR' ? t3('mkt_open') : t3('mkt_closed')) : '';
    return {
      now: '<div class="l3-now-head"><h2>' + esc(t3('now_h')) + '</h2>' + (state ? '<span class="l3-state' + (/REGULAR/i.test(idx.state) ? ' is-open' : '') + '"><i></i>' + esc(state) + '</span>' : '') + '</div>' +
        '<div class="l3-rail l3-rail-mkt">' + l3MarketCards() + '</div>',
      stocks: l3SecHead('Stocks', t3('stk_sub'), t3('stk_cta'), 'xstocks') +
        '<div class="l3-rail l3-grid-6">' + l3StockCards() + '</div>' + l3MoverChips(),
      perps: l3SecHead('Perps', t3('prp_sub'), t3('prp_cta'), 'futures') +
        '<div class="l3-rail l3-grid-6">' + l3PerpCards() + '</div>',
      predict: l3SecHead('Predictions', t3('prd_sub'), t3('prd_cta'), 'predict') +
        '<div class="l3-rail l3-grid-4">' + l3PredCards() + '</div>',
      swaphead: l3SecHead('Swap', t3('swp_sub'), t3('swp_cta'), 'dashboard'),
      swapdemo: '<div class="l3-swap-demo lv2-hw">' + renderSwap(_live.eth) + '</div>',
      foot: '<p class="l3-foot">' + esc(t3('foot')) + '</p>',
    };
  }
  /* A price that just changed blinks green or red once, so the board reads as live. */
  var _l3Prev = Object.create(null);
  function l3Flash(scope) {
    if (!scope) return;
    var reduce = false;
    try { reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (_) {}
    scope.querySelectorAll('[data-k][data-v]').forEach(function (el) {
      var k = el.getAttribute('data-k');
      var v = Number(el.getAttribute('data-v'));
      if (!Number.isFinite(v)) return;
      var p = _l3Prev[k];
      if (!reduce && p != null && v !== p) {
        el.classList.remove('l3-fl-up', 'l3-fl-dn');
        void el.offsetWidth;
        el.classList.add(v > p ? 'l3-fl-up' : 'l3-fl-dn');
      }
      _l3Prev[k] = v;
    });
  }
  function mountBoard(root) {
    if (!root) return;
    var board = root.querySelector('.l3-board');
    if (!board) {
      root.querySelectorAll('.lv2-diagram-sec, .gw-tr-wrap, .gw-lp-dex, [data-gw-trending]').forEach(function (n) {
        try { n.remove(); } catch (_) {}
      });
      board = document.createElement('div');
      board.className = 'l3-board';
      board.innerHTML =
        '<section class="l3-sec l3-now" data-no-tr data-l3="now"></section>' +
        '<section class="l3-sec l3-stocks" data-no-tr data-l3="stocks"></section>' +
        '<section class="l3-sec l3-perps" data-no-tr data-l3="perps"></section>' +
        '<section class="l3-sec l3-predict" data-no-tr data-l3="predict"></section>' +
        '<div data-no-tr data-l3="foot"></div>' +
        '<section class="l3-sec l3-swap">' +
          '<div data-no-tr data-l3="swaphead"></div>' +
          '<div class="l3-swap-grid"><div data-no-tr data-l3="swapdemo"></div><div class="l3-trend-host" id="l3TrendHost"></div></div>' +
        '</section>';
      root.insertBefore(board, root.firstChild);
    }
    var parts = l3BoardParts();
    Object.keys(parts).forEach(function (k) {
      var el = board.querySelector('[data-l3="' + k + '"]');
      if (el && el.__l3 !== parts[k]) { el.innerHTML = parts[k]; el.__l3 = parts[k]; l3Flash(el); }
    });
  }

  function l3HeroCopy() {
    var page = document.getElementById('page-landing');
    if (!page) return;
    var k = page.querySelector('.lp-hero-left .lv2-kicker');
    if (k) k.remove();
    var h1 = page.querySelector('.lp-hero-left .lp-h1');
    if (h1) {
      h1.setAttribute('data-no-tr', '');
      h1.removeAttribute('data-i18n-html');
      if (h1.innerHTML !== H1_EN) h1.innerHTML = H1_EN;
      h1.classList.remove('lv2-h1-typing');
      h1.classList.add('lv2-h1-anim');
    }
    var narrow = false;
    try { narrow = !!(window.matchMedia && window.matchMedia('(max-width: 720px)').matches); } catch (_) {}
    var sub = page.querySelector('.lp-hero-left .lp-h1-sub');
    if (sub) {
      sub.removeAttribute('data-i18n');
      sub.setAttribute('data-no-tr', '');
      var subText = narrow ? t3('sub_m') : t3('sub');
      if (sub.textContent !== subText) sub.textContent = subText;
    }
    var trust = page.querySelector('.lp-hero-left .lv2-trust');
    if (trust) {
      trust.setAttribute('data-no-tr', '');
      var trustHtml = (t3('trust') || []).map(function (x) {
        return '<span><span class="ok">✓</span>' + esc(x) + '</span>';
      }).join('');
      if (trust.__l3 !== trustHtml) { trust.innerHTML = trustHtml; trust.__l3 = trustHtml; }
    }
    var fh = page.querySelector('.lp-final-cta .lp-final-h');
    if (fh && fh.textContent !== 'Four markets. One wallet.') { fh.removeAttribute('data-i18n'); fh.setAttribute('data-no-tr', ''); fh.textContent = 'Four markets. One wallet.'; }
    var fs = page.querySelector('.lp-final-cta .lp-final-sub');
    if (fs && fs.textContent !== t3('fin_sub')) { fs.removeAttribute('data-i18n'); fs.setAttribute('data-no-tr', ''); fs.textContent = t3('fin_sub'); }
  }

  function l3GoStock(sym) {
    sym = String(sym || '').toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9.\-]{0,15}$/.test(sym)) return go('xstocks');
    try { history.pushState(null, '', '/stocks?sym=' + encodeURIComponent(sym) + '#xstocks'); } catch (_) {}
    try {
      if (typeof window.show === 'function') { window.show('xstocks'); return; }
    } catch (_) {}
    location.href = '/stocks?sym=' + encodeURIComponent(sym) + '#xstocks';
  }
  function l3GoPerp(coin) {
    coin = String(coin || '').toUpperCase();
    if (!/^[A-Z0-9]{2,12}$/.test(coin)) return go('futures');
    /* The landing is a slim document: show('futures') loads the app with this query, and the desk reads ?perp= on boot. */
    try { history.replaceState(null, '', '/futures?perp=' + encodeURIComponent(coin) + '#futures'); } catch (_) {}
    try {
      if (typeof window.show === 'function') window.show('futures');
      else location.href = '/futures?perp=' + encodeURIComponent(coin) + '#futures';
    } catch (_) {}
    /* Open the desk on the coin from the card once the perps list is loaded (setFuturesPair is the desk's own picker). */
    var tries = 0;
    var iv = setInterval(function () {
      var hl = window.gromHL;
      var ready = hl && typeof hl.isMetaReady === 'function' && hl.isMetaReady();
      if (ready && typeof window.setFuturesPair === 'function') {
        clearInterval(iv);
        try { window.setFuturesPair(coin + '/USDT'); } catch (_) {}
        return;
      }
      if (++tries > 100) clearInterval(iv);
    }, 150);
  }
  function l3Bind() {
    var page = document.getElementById('page-landing');
    if (!page || page._l3Bound) return;
    page._l3Bound = true;
    page.addEventListener('click', function (e) {
      var st = e.target.closest('[data-l3-stock]');
      if (st) { e.preventDefault(); l3GoStock(st.getAttribute('data-l3-stock')); return; }
      var pp = e.target.closest('[data-l3-perp]');
      if (pp) { e.preventDefault(); l3GoPerp(pp.getAttribute('data-l3-perp')); }
    });
  }

  function l3MountTrending() {
    var host = document.getElementById('l3TrendHost');
    if (!host || host._l3Trend) return;
    host._l3Trend = true;
    function render() {
      var stray = document.getElementById('gwLandingTrendingCard');
      if (stray && stray.parentNode !== host) host.appendChild(stray);
      if (typeof window.gwRenderTrending === 'function') {
        try { window.gwRenderTrending({ instance: 'landing', root: host }); } catch (_) {}
      }
    }
    function bootWallet() {
      if (typeof window.gwRenderTrending === 'function') return render();
      if (typeof window.gromEnsureWalletModule === 'function') {
        window.gromEnsureWalletModule().then(render).catch(function () {});
        return;
      }
      if (typeof window.gromLoadWalletScripts === 'function') window.gromLoadWalletScripts();
      var tries = 0;
      var poll = setInterval(function () {
        if (typeof window.gwRenderTrending === 'function') { clearInterval(poll); render(); }
        else if (++tries > 40) clearInterval(poll);
      }, 250);
    }
    if (lv2StableUi() && typeof IntersectionObserver === 'function') {
      var seen = false;
      var obs = new IntersectionObserver(function (entries) {
        if (seen || !entries.some(function (e) { return e.isIntersecting; })) return;
        seen = true;
        try { obs.disconnect(); } catch (_) {}
        bootWallet();
      }, { rootMargin: '400px 0px', threshold: 0.01 });
      obs.observe(host);
      setTimeout(function () { if (!seen) { seen = true; bootWallet(); } }, 15000);
      return;
    }
    bootWallet();
  }

  function l3Paint() {
    l3HeroCopy();
    mountTape();
    mountMap();
    mountBoard(ensureRoot());
    l3MountTrending();
  }
  function l3Load(force) {
    var jobs = [
      ['top', l3FetchTop], ['idx', l3FetchIdx], ['perps', l3FetchPerps],
      ['spark', l3FetchSpark], ['candles', l3FetchCandles], ['predict', l3FetchPredict],
    ];
    jobs.forEach(function (j) {
      j[1]().then(function (v) {
        if (v == null) return;
        _l3[j[0]] = v;
        l3Paint();
      }).catch(function () {});
    });
    fetchEthUsd().then(function (eth) { if (eth) { _live.eth = eth; l3Paint(); } }).catch(function () {});
  }

  function refresh(opts) {
    opts = opts || {};
    if (!document.getElementById('page-landing')) return;
    removeCompare();
    removeUpdates();
    removePreview();
    var root = ensureRoot();
    bind(root);
    l3Bind();
    if (opts.force || !_painted || _lang !== lang()) {
      rewriteHeroLeft();
      l3Paint();
      injectFaq();
      _painted = true;
      _lang = lang();
    }
    l3Load(!!opts.force);
  }

  function boot() {
    syncI18nDefaults();
    /* Hero typewriter must start on first paint — do not wait for idle/wallet.
     * Idle used to delay up to 3.5s; wallet warm then stole the main thread. */
    function paintHeroNow() {
      try {
        var page = document.getElementById('page-landing');
        if (!page) return;
        var h1 = page.querySelector('.lp-hero-left .lp-h1');
        if (h1 && !h1.classList.contains('lv2-h1-typing') && !h1.querySelector('.lv2-h1-typed')) {
          h1.removeAttribute('data-i18n-html');
          typeHeroH1(h1);
        }
      } catch (_) {}
    }
    paintHeroNow();
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(paintHeroNow);
    }

    var run = function () {
      refresh({ force: true, fetchAll: true });
      var tries = 0;
      var faqPoll = setInterval(function () {
        injectFaq();
        if (document.querySelector('#page-landing .gw-lp-faq-list') || ++tries > 6) clearInterval(faqPoll);
      }, window.GROM_LANDING ? 2000 : 1200);
      if (_timer) clearInterval(_timer);
      if (!lv2StableUi()) {
        _timer = setInterval(function () {
          if (document.hidden) return;
          var route = '';
          try { route = document.documentElement.getAttribute('data-grom-route') || ''; } catch (_) {}
          if (route && route !== 'landing') return;
          refresh({ force: false });
        }, REFRESH_MS);
        /* Perps prices tick every 20 s on desktop (one request); phones keep a single load. */
        if (_l3Live) clearInterval(_l3Live);
        _l3Live = setInterval(function () {
          if (document.hidden) return;
          var route = '';
          try { route = document.documentElement.getAttribute('data-grom-route') || ''; } catch (_) {}
          if (route && route !== 'landing') return;
          l3FetchPerps().then(function (v) { if (v) { _l3.perps = v; l3Paint(); } }).catch(function () {});
        }, 20_000);
      }
    };
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(run, { timeout: window.GROM_LANDING ? 1200 : 800 });
    } else {
      setTimeout(run, window.GROM_LANDING ? 200 : 80);
    }
  }

  function onWalletConnected() {
    /* Any successful connect while still on landing → Главное (dashboard). */
    if (window.__lv2GoDashAfterConnect || isOnLanding()) {
      window.__lv2GoDashAfterConnect = false;
      goDashAfterConnect();
    }
  }
  document.addEventListener('grom:wallet-connected', onWalletConnected);
  window.addEventListener('grom:wallet-connected', onWalletConnected);

  /* Header Connect Wallet also counts when user is on landing. */
  document.addEventListener('click', function (e) {
    if (!isOnLanding()) return;
    var btn = e.target.closest('#walletBtn, #topConnectBtn, [data-open-connect], .cn-row');
    if (!btn) return;
    window.__lv2GoDashAfterConnect = true;
  }, true);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  window.addEventListener('grom:lang-change', function () {
    if (_painted && _lang === lang()) return;
    _painted = false;
    _lang = '';
    _live.predict = null;
    try {
      Object.keys(_cache).forEach(function (k) {
        if (k.indexOf('predict') >= 0) delete _cache[k];
      });
    } catch (_) {}
    clearTimeout(window.__lv2LangRefreshTimer);
    window.__lv2LangRefreshTimer = setTimeout(function () {
      refresh({ force: true, fetchAll: true });
      if (typeof window.gromRenderPredictWidgets === 'function') {
        window.gromRenderPredictWidgets({ force: true });
      }
    }, 0);
  });
})();
