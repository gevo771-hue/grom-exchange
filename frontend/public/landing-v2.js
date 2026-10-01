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
  var _cache = Object.create(null);
  var _painted = false;
  var _lang = '';
  var _live = { perps: null, predict: null, stocks: null, eth: null };
  var _faqLocked = false;
  var _liveHeroPatched = false;

  function lv2StableUi() {
    return !!(window.GROM_STABLE_UI || window.GROM_SAFARI
      || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent || ''));
  }

  /* Hero H1 stays English on every locale */
  var H1_LINE1 = 'One wallet.';
  var H1_LINE2 = 'All of DeFi.';
  var H1_EN = '<span class="lv2-h1-line">One wallet.</span><br><span class="lv2-h1-line lv2-accent">All of DeFi.</span>';

  var I18N = {
    ru: {
      kicker: 'Non-custodial · Swap · Futures · Прогнозы · Акции',
      kicker_m: 'Non-custodial · Swap · Futures · Predictions · Stocks',
      h1: H1_EN,
      sub: 'Свопай 10 000+ токенов, торгуй Futures, ставь на события, покупай токенизированные акции — всё из твоего кошелька. Без регистрации, без KYC, без депозитов на GROM.',
      sub_m: 'Swap, Futures, прогнозы и акции — из своего кошелька. Без KYC и без депозитов на GROM.',
      cta1: 'Подключить кошелёк →',
      cta2: 'Открыть дашборд',
      trust: ['Non-custodial', 'Без KYC', '20+ сетей', '6 источников на EVM'],
      trust_m: ['Non-custodial', 'Без KYC', '20+ сетей'],
      tab_swap: 'Swap', tab_perps: 'Futures', tab_predict: 'Прогнозы', tab_stocks: 'Акции',
      card_perps: 'GROM Futures', card_predict: 'GROM Прогнозы', card_stocks: 'GROM Акции',
      pay: 'Ты платишь', get: 'Ты получаешь', bal: 'Баланс',
      rate: 'Курс', save: 'Экономия', vs: 'vs 1inch',
      route: 'Маршрут:', route_best: '— лучший из 6',
      connect: 'Подключить кошелёк →',
      funding: 'Фандинг', funding_period: '8ч',
      yes: 'Да', no: 'Нет', chance: 'шанс',
      perps_meta: 'До 100× · 0,05% тейкер',
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
      diag_perps: 'Futures · до 100×',
      diag_pred: 'Прогнозы',
      diag_stocks: 'Акции 24/7',
      diag_swap_m: 'Swap',
      diag_perps_m: 'Futures',
      diag_pred_m: 'Прогнозы',
      diag_stocks_m: 'Акции',
      diag_cap: '<strong>Никаких депозитов на GROM.</strong> Каждая сделка подписана твоим кошельком и исполнена ончейн.',
      updates: '🚀 <b>Только что:</b> Акции · Прогнозы · Futures · 20+ сетей',
      faq_q: 'Как работает GROM DEX?',
      faq_a: 'GROM — мета-агрегатор: при каждом свопе он запрашивает котировки у 6 источников на EVM параллельно (LiFi, Paraswap, Kyber, Odos, CoWSwap, Squid, Jupiter) и исполняет сделку через того, кто даёт лучшую цену. Ты подписываешь транзакцию своим кошельком — токены приходят на твой адрес напрямую. GROM не хранит средства, не запрашивает KYC и не открывает счетов.',
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
      lp_v2_cmp_perps_r4_k: 'Максимальное плечо', lp_v2_cmp_perps_r4_a: '125×', lp_v2_cmp_perps_r4_b: '100×',
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
      tip_perps_a: 'Бессрочные фьючерсы (perpetuals): торгуешь BTC/ETH/SOL с плечом до 100×. Маржа на Hyperliquid, PnL и funding — ончейн. GROM не держит твои средства.',
      tip_predict_q: 'Как работают прогнозы?',
      tip_predict_a: 'Ставишь USDC на исход события (Yes/No). Цена = рыночная вероятность. Выплата в USDC на твой кошелёк — без proxy-депозита и без KYC на GROM.',
      tip_stocks_q: 'Это настоящие акции?',
      tip_stocks_a: 'Токенизированные акции (xStocks): ончейн-требования на базовый актив. Торговля 24/7, дробные от $0,01, расчёт в кошелёк — не брокерский счёт.',
    },
    en: {
      kicker: 'Non-custodial · Swap · Futures · Predictions · Stocks',
      kicker_m: 'Non-custodial · Swap · Futures · Predictions · Stocks',
      h1: H1_EN,
      sub: 'Swap 10,000+ tokens, trade futures, bet on outcomes, own tokenized stocks — all from your own wallet. No sign-up, no KYC, no deposits to GROM.',
      sub_m: 'Swap, futures, predictions and stocks — from your wallet. No KYC, no deposits to GROM.',
      cta1: 'Connect wallet →',
      cta2: 'Open dashboard',
      trust: ['Non-custodial', 'No KYC', '20+ chains', '6 EVM liquidity sources'],
      trust_m: ['Non-custodial', 'No KYC', '20+ chains'],
      tab_swap: 'Swap', tab_perps: 'Futures', tab_predict: 'Predictions', tab_stocks: 'Stocks',
      card_perps: 'GROM Futures', card_predict: 'GROM Predictions', card_stocks: 'GROM Stocks',
      pay: 'You pay', get: 'You receive', bal: 'Balance',
      rate: 'Rate', save: 'Saved', vs: 'vs 1inch',
      route: 'Route:', route_best: '— best of 4',
      connect: 'Connect wallet →',
      funding: 'Funding', funding_period: '8h',
      yes: 'Yes', no: 'No', chance: 'chance',
      perps_meta: 'Up to 100× · 0.05% taker',
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
      diag_perps: 'Futures · up to 100×',
      diag_pred: 'Predictions',
      diag_stocks: 'Stocks 24/7',
      diag_swap_m: 'Swap',
      diag_perps_m: 'Futures',
      diag_pred_m: 'Predict',
      diag_stocks_m: 'Stocks',
      diag_cap: '<strong>No deposits to GROM.</strong> Every trade is signed by your wallet and settled on-chain.',
      updates: '🚀 <b>Just shipped:</b> Stocks · Predictions · Futures · 20+ chains',
      faq_q: 'How does GROM DEX work?',
      faq_a: 'GROM is a meta-aggregator: on every swap it queries 6 EVM liquidity sources in parallel (LiFi, Paraswap, Kyber, Odos, CoWSwap, Squid, Jupiter) and executes through the best price. You sign with your wallet — tokens arrive at your address directly. GROM never holds funds, never asks for KYC, and never opens accounts.',
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
      lp_v2_cmp_perps_r4_k: 'Max leverage', lp_v2_cmp_perps_r4_a: '125×', lp_v2_cmp_perps_r4_b: '100×',
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
      tip_perps_a: 'Perpetual futures: trade BTC/ETH/SOL with up to 100×. Margin on Hyperliquid, PnL and funding on-chain. GROM never holds your funds.',
      tip_predict_q: 'How do predictions work?',
      tip_predict_a: 'Stake USDC on an outcome (Yes/No). Price = market probability. Payout lands in your wallet — no proxy deposit, no GROM KYC.',
      tip_stocks_q: 'Are these real stocks?',
      tip_stocks_a: 'Tokenized stocks (xStocks): on-chain claims on the underlying. Trade 24/7, fractionals from $0.01, settle to your wallet — not a brokerage account.',
    },
    ua: {
      kicker: 'Non-custodial · Swap · Ф\'ючерси · Прогнози · Акції',
      kicker_m: 'Non-custodial · Swap · Futures · Predictions · Stocks',
      h1: H1_EN,
      sub: 'Свопай 10 000+ токенів, торгуй ф\'ючерси, став на події, купуй токенізовані акції — усе зі свого гаманця. Без реєстрації, без KYC, без депозитів на GROM.',
      sub_m: 'Swap, ф\'ючерси, прогнози й акції — зі свого гаманця. Без KYC і без депозитів на GROM.',
      cta1: 'Підключити гаманець →',
      cta2: 'Відкрити дашборд',
      trust: ['Non-custodial', 'Без KYC', '20+ мереж', '7 джерел ліквідності'],
      trust_m: ['Non-custodial', 'Без KYC', '20+ мереж'],
      tab_swap: 'Swap', tab_perps: 'Futures', tab_predict: 'Прогнози', tab_stocks: 'Акції',
      card_perps: 'GROM Futures', card_predict: 'GROM Прогнози', card_stocks: 'GROM Акції',
      pay: 'Ти платиш', get: 'Ти отримуєш', bal: 'Баланс',
      rate: 'Курс', save: 'Економія', vs: 'vs 1inch',
      route: 'Маршрут:', route_best: '— найкращий з 4',
      connect: 'Підключити гаманець →',
      funding: 'Фандинг', funding_period: '8г',
      yes: 'Так', no: 'Ні',
      perps_meta: 'До 100× · 0,05% тейкер',
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
      diag_perps: 'Futures · до 100×',
      diag_pred: 'Прогнози',
      diag_stocks: 'Акції 24/7',
      diag_swap_m: 'Swap',
      diag_perps_m: 'Futures',
      diag_pred_m: 'Прогнози',
      diag_stocks_m: 'Акції',
      diag_cap: '<strong>Жодних депозитів на GROM.</strong> Кожну угоду підписує твій гаманець і виконує ончейн.',
      updates: '🚀 <b>Щойно:</b> Акції · Прогнози · Futures · 20+ мереж',
      faq_q: 'Як працює GROM DEX?',
      faq_a: 'GROM — мета-агрегатор: на кожному свопі він запитує котирування у 7 джерел ліквідності паралельно (LiFi, Paraswap, Kyber, Odos, CoWSwap, Squid, Jupiter) і виконує угоду через того, хто дає кращу ціну. Ти підписуєш транзакцію своїм гаманцем — токени приходять на твою адресу напряму. GROM не зберігає кошти, не запитує KYC і не відкриває рахунків.',
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
      lp_v2_cmp_perps_r4_k: 'Максимальне плече', lp_v2_cmp_perps_r4_a: '125×', lp_v2_cmp_perps_r4_b: '100×',
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
      tip_perps_a: 'Безстрокові ф\'ючерси: торгуєш BTC/ETH/SOL з плечем до 100×. Маржа на Hyperliquid, PnL і funding — ончейн. GROM не тримає твої кошти.',
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
        kicker: 'Non-custodial · Swap · Futures · Predicciones · Acciones',
        kicker_m: 'Non-custodial · Swap · Futures · Predictions · Stocks',
        sub: 'Haz swap de más de 10 000 tokens, opera Futures, apuesta en eventos y compra acciones tokenizadas — todo desde tu billetera. Sin registro, sin KYC, sin depósitos en GROM.',
        sub_m: 'Swap, Futures, predicciones y acciones — desde tu billetera. Sin KYC ni depósitos en GROM.',
        cta1: 'Conectar billetera →', cta2: 'Abrir panel',
        trust: ['Non-custodial', 'Sin KYC', '20+ redes', '7 fuentes de liquidez'],
        trust_m: ['Non-custodial', 'Sin KYC', '20+ redes'],
        tab_swap: 'Swap', tab_perps: 'Futures', tab_predict: 'Predicciones', tab_stocks: 'Acciones',
        card_perps: 'GROM Futures', card_predict: 'GROM Predicciones', card_stocks: 'GROM Acciones',
        pay: 'Pagas', get: 'Recibes', bal: 'Saldo',
        rate: 'Tipo', save: 'Ahorro', vs: 'vs 1inch',
        route: 'Ruta:', route_best: '— la mejor de 4',
        connect: 'Conectar billetera →',
        funding: 'Funding', funding_period: '8h',
        yes: 'Sí', no: 'No',
        perps_meta: 'Hasta 100× · taker 0,05%',
        open_trade: 'Abrir operación →',
        open_predict: 'Abrir predicciones →',
        pred_hint: '↳ Apuesta desde tu billetera — sin fondeo proxy',
        stocks_meta: 'ticker · 24/7 · fracciones desde $0,01',
        browse_stocks: 'Ver acciones →',
        diag_eye: 'Por qué GROM',
        diag_h: 'Conéctate una vez. Opera en todas partes.',
        diag_sub: 'Tu billetera es tu cuenta. Swap, Futures, predicciones, acciones — una sola firma. GROM nunca custodia fondos.',
        diag_wallet: 'TU BILLETERA',
        diag_swap: 'Swap · 10k tokens', diag_perps: 'Futures · hasta 100×', diag_pred: 'Predicciones', diag_stocks: 'Acciones 24/7',
        diag_swap_m: 'Swap', diag_perps_m: 'Futures', diag_pred_m: 'Predict', diag_stocks_m: 'Acciones',
        diag_cap: '<strong>Sin depósitos en GROM.</strong> Cada operación la firmas tú y se liquida on-chain.',
        updates: '🚀 <b>Recién:</b> Acciones · Predicciones · Futures · 20+ redes',
        faq_q: '¿Cómo funciona GROM DEX?',
        faq_a: 'GROM es un meta-agregador: en cada swap consulta 7 fuentes de liquidez en paralelo (LiFi, Paraswap, Kyber, Odos, CoWSwap, Squid, Jupiter) y ejecuta por el mejor precio. Firmas con tu billetera — los tokens llegan a tu dirección. GROM no custodia fondos, no pide KYC y no abre cuentas.',
        cmp_eye: 'Comparar',
        cmp_h: 'Por qué gana lo on-chain',
        cmp_sub: 'La misma superficie de producto que las grandes plataformas — sin custodia, KYC ni bloqueos geográficos.',
        tip_perps_q: '¿Qué es Futures?', tip_perps_a: 'Futuros perpetuos: opera BTC/ETH/SOL hasta 100×. Margen en Hyperliquid, PnL y funding on-chain. GROM nunca custodia tus fondos.',
        tip_predict_q: '¿Cómo funcionan las predicciones?', tip_predict_a: 'Apuesta USDC a un resultado (Sí/No). El precio = probabilidad del mercado. El pago llega a tu billetera — sin depósito proxy ni KYC de GROM.',
        tip_stocks_q: '¿Son acciones reales?', tip_stocks_a: 'Acciones tokenizadas (xStocks): derechos on-chain sobre el subyacente. Opera 24/7, fracciones desde $0,01, liquidación en tu billetera.',
      },
      ar: {
        kicker: 'Non-custodial · Swap · Futures · التنبؤات · الأسهم',
        kicker_m: 'Non-custodial · Swap · Futures · Predictions · Stocks',
        sub: 'بادل أكثر من 10 000 رمز، تداول Futures، راهن على الأحداث واشترِ أسهماً مرمّزة — كل ذلك من محفظتك. بلا تسجيل، بلا KYC، بلا إيداع في GROM.',
        sub_m: 'Swap و Futures والتنبؤات والأسهم — من محفظتك. بلا KYC وبلا إيداع في GROM.',
        cta1: 'ربط المحفظة →', cta2: 'فتح لوحة التحكم',
        trust: ['Non-custodial', 'بلا KYC', '20+ شبكة', '7 مصادر سيولة'],
        trust_m: ['Non-custodial', 'بلا KYC', '20+ شبكة'],
        tab_swap: 'Swap', tab_perps: 'Futures', tab_predict: 'التنبؤات', tab_stocks: 'الأسهم',
        card_perps: 'GROM Futures', card_predict: 'GROM التنبؤات', card_stocks: 'GROM الأسهم',
        pay: 'تدفع', get: 'تستلم', bal: 'الرصيد',
        rate: 'السعر', save: 'توفير', vs: 'vs 1inch',
        route: 'المسار:', route_best: '— الأفضل من 4',
        connect: 'ربط المحفظة →',
        funding: 'Funding', funding_period: '8س',
        yes: 'نعم', no: 'لا',
        perps_meta: 'حتى 100× · 0.05% تيكر',
        open_trade: 'افتح صفقة →',
        open_predict: 'افتح التنبؤات →',
        pred_hint: '↳ راهن من محفظتك — بلا تمويل وسيط',
        stocks_meta: 'رمز · 24/7 · كسور من 0.01$',
        browse_stocks: 'عرض الأسهم →',
        diag_eye: 'لماذا GROM',
        diag_h: 'اربط مرة واحدة. تداول في كل مكان.',
        diag_sub: 'محفظتك هي حسابك. Swap و Futures والتنبؤات والأسهم — بتوقيع واحد. GROM لا يحتفظ بالأموال أبداً.',
        diag_wallet: 'محفظتك',
        diag_swap: 'Swap · 10k', diag_perps: 'Futures · حتى 100×', diag_pred: 'التنبؤات', diag_stocks: 'الأسهم 24/7',
        diag_swap_m: 'Swap', diag_perps_m: 'Futures', diag_pred_m: 'Predict', diag_stocks_m: 'أسهم',
        diag_cap: '<strong>لا إيداعات في GROM.</strong> كل صفقة توقّعها أنت وتُسوّى على السلسلة.',
        updates: '🚀 <b>جديد:</b> الأسهم · التنبؤات · Futures · 20+ شبكة',
        faq_q: 'كيف يعمل GROM DEX؟',
        faq_a: 'GROM مُجمّع سيولة: عند كل مقايضة يستعلم 7 مصادر بالتوازي وينفّذ بأفضل سعر. توقّع من محفظتك — تصل الرموز إلى عنوانك مباشرة. لا وصاية، لا KYC، لا حسابات.',
        cmp_eye: 'مقارنة',
        cmp_h: 'لماذا يفوز الـ on-chain',
        cmp_sub: 'نفس الوظائف الكبيرة — بلا وصاية ولا KYC ولا حظر جغرافي.',
        tip_perps_q: 'ما هو Futures؟', tip_perps_a: 'عقود دائمة: تداول BTC/ETH/SOL حتى 100×. الهامش على Hyperliquid، والربح والتمويل على السلسلة.',
        tip_predict_q: 'كيف تعمل التنبؤات؟', tip_predict_a: 'راهن بـ USDC على نتيجة (نعم/لا). السعر = الاحتمال. الدفع إلى محفظتك مباشرة.',
        tip_stocks_q: 'هل هذه أسهم حقيقية؟', tip_stocks_a: 'أسهم مرمّزة (xStocks): مطالبات على السلسلة. تداول 24/7 وكسور من 0.01$ إلى محفظتك.',
      },
      zh: {
        kicker: 'Non-custodial · Swap · Futures · 预测 · 股票',
        kicker_m: 'Non-custodial · Swap · Futures · Predictions · Stocks',
        sub: '兑换 10 000+ 代币、交易 Futures、押注事件、购买代币化股票——全部来自你的钱包。无需注册、无需 KYC、无需向 GROM 充值。',
        sub_m: 'Swap、Futures、预测与股票 — 直接来自你的钱包。无 KYC，无需存入 GROM。',
        cta1: '连接钱包 →', cta2: '打开仪表盘',
        trust: ['Non-custodial', '无 KYC', '20+ 网络', '7 个流动性源'],
        trust_m: ['Non-custodial', '无 KYC', '20+ 网络'],
        tab_swap: 'Swap', tab_perps: 'Futures', tab_predict: '预测', tab_stocks: '股票',
        card_perps: 'GROM Futures', card_predict: 'GROM 预测', card_stocks: 'GROM 股票',
        pay: '你支付', get: '你获得', bal: '余额',
        rate: '汇率', save: '节省', vs: 'vs 1inch',
        route: '路由:', route_best: '— 4 条中最优',
        connect: '连接钱包 →',
        funding: 'Funding', funding_period: '8小时',
        yes: '是', no: '否',
        perps_meta: '最高 100× · 吃单 0.05%',
        open_trade: '开仓 →',
        open_predict: '打开预测 →',
        pred_hint: '↳ 用自己的钱包下注 — 无需代理充值',
        stocks_meta: '代码 · 24/7 · 最低 $0.01 碎股',
        browse_stocks: '查看股票 →',
        diag_eye: '为什么选 GROM',
        diag_h: '连接一次。随处交易。',
        diag_sub: '你的钱包就是账户。Swap、Futures、预测、股票——一次签名搞定。GROM 从不托管资金。',
        diag_wallet: '你的钱包',
        diag_swap: 'Swap · 1万代币', diag_perps: 'Futures · 最高 100×', diag_pred: '预测市场', diag_stocks: '股票 24/7',
        diag_swap_m: 'Swap', diag_perps_m: 'Futures', diag_pred_m: '预测', diag_stocks_m: '股票',
        diag_cap: '<strong>无需向 GROM 充值。</strong>每笔交易由你签名并在链上结算。',
        updates: '🚀 <b>刚刚上线:</b> 股票 · 预测 · Futures · 20+ 链',
        faq_q: 'GROM DEX 如何运作？',
        faq_a: 'GROM 是元聚合器：每次兑换并行查询 7 个流动性源并按最优价格执行。你用钱包签名——代币直接到账。不托管、不要 KYC、不开户。',
        cmp_eye: '对比',
        cmp_h: '为什么链上更好',
        cmp_sub: '与大型平台同样的功能面——没有托管、KYC 或地域封锁。',
        tip_perps_q: '什么是 Futures？', tip_perps_a: '永续合约：BTC/ETH/SOL 最高 100×。保证金在 Hyperliquid，盈亏与资金费率在链上。',
        tip_predict_q: '预测市场如何运作？', tip_predict_a: '用 USDC 押注结果（是/否）。价格=概率。赔付到你的钱包。',
        tip_stocks_q: '这是真股票吗？', tip_stocks_a: '代币化股票（xStocks）：链上权益。24/7 交易，最低 $0.01 碎股，结算到钱包。',
      },
      hi: {
        kicker: 'Non-custodial · Swap · Futures · प्रेडिक्शन्स · स्टॉक्स',
        kicker_m: 'Non-custodial · Swap · Futures · Predictions · Stocks',
        sub: '10 000+ टोकन स्वैप करें, Futures ट्रेड करें, इवेंट्स पर दांव लगाएँ और टोकनाइज़्ड स्टॉक्स खरीदें — सब अपने वॉलेट से। कोई रजिस्ट्रेशन नहीं, कोई KYC नहीं, GROM पर कोई डिपॉजिट नहीं।',
        sub_m: 'Swap, Futures, प्रेडिक्शन्स और स्टॉक्स — अपने वॉलेट से। कोई KYC नहीं, GROM पर कोई डिपॉजिट नहीं।',
        cta1: 'वॉलेट कनेक्ट करें →', cta2: 'डैशबोर्ड खोलें',
        trust: ['Non-custodial', 'बिना KYC', '20+ नेटवर्क', '7 लिक्विडिटी स्रोत'],
        trust_m: ['Non-custodial', 'बिना KYC', '20+ नेटवर्क'],
        tab_swap: 'Swap', tab_perps: 'Futures', tab_predict: 'प्रेडिक्शन्स', tab_stocks: 'स्टॉक्स',
        card_perps: 'GROM Futures', card_predict: 'GROM प्रेडिक्शन्स', card_stocks: 'GROM स्टॉक्स',
        pay: 'आप देते हैं', get: 'आप पाते हैं', bal: 'बैलेंस',
        rate: 'रेट', save: 'बचत', vs: 'vs 1inch',
        route: 'रूट:', route_best: '— 4 में सर्वश्रेष्ठ',
        connect: 'वॉलेट कनेक्ट करें →',
        funding: 'Funding', funding_period: '8घं',
        yes: 'हाँ', no: 'नहीं',
        perps_meta: '100× तक · 0.05% टेकर',
        open_trade: 'ट्रेड खोलें →',
        open_predict: 'प्रेडिक्शन्स खोलें →',
        pred_hint: '↳ अपने वॉलेट से दांव — बिना प्रॉक्सी फंडिंग',
        stocks_meta: 'टिकर · 24/7 · $0.01 से फ्रैक्शनल',
        browse_stocks: 'स्टॉक्स देखें →',
        diag_eye: 'क्यों GROM',
        diag_h: 'एक बार कनेक्ट करें। हर जगह ट्रेड करें।',
        diag_sub: 'आपका वॉलेट ही आपका अकाउंट है। Swap, Futures, प्रेडिक्शन्स, स्टॉक्स — एक सिग्नेचर। GROM कभी फंड नहीं रखता।',
        diag_wallet: 'आपका वॉलेट',
        diag_swap: 'Swap · 10k टोकन', diag_perps: 'Futures · 100× तक', diag_pred: 'प्रेडिक्शन्स', diag_stocks: 'स्टॉक्स 24/7',
        diag_swap_m: 'Swap', diag_perps_m: 'Futures', diag_pred_m: 'Predict', diag_stocks_m: 'स्टॉक्स',
        diag_cap: '<strong>GROM पर कोई डिपॉजिट नहीं।</strong> हर ट्रेड आपके वॉलेट से साइन होकर ऑन-चेन सेटल होता है।',
        updates: '🚀 <b>अभी:</b> स्टॉक्स · प्रेडिक्शन्स · Futures · 20+ चेन',
        faq_q: 'GROM DEX कैसे काम करता है?',
        faq_a: 'GROM एक मेटा-एग्रीगेटर है: हर स्वैप पर 7 लिक्विडिटी सोर्स समानांतर पूछता है और बेस्ट प्राइस पर एक्ज़ीक्यूट करता है। आप वॉलेट से साइन करते हैं — टोकन सीधे आपके पते पर आते हैं।',
        cmp_eye: 'तुलना',
        cmp_h: 'ऑन-चेन क्यों जीतता है',
        cmp_sub: 'बड़े वेन्यू जैसा प्रोडक्ट — बिना कस्टडी, KYC या जियो-ब्लॉक।',
        tip_perps_q: 'Futures क्या हैं?', tip_perps_a: 'परपेचुअल फ्यूचर्स: BTC/ETH/SOL 100× तक। मार्जिन Hyperliquid पर, PnL ऑन-चेन।',
        tip_predict_q: 'प्रेडिक्शन्स कैसे काम करते हैं?', tip_predict_a: 'USDC से Yes/No पर दांव। प्राइस = संभाव्यता। पेआउट आपके वॉलेट में।',
        tip_stocks_q: 'क्या ये असली स्टॉक्स हैं?', tip_stocks_a: 'टोकनाइज़्ड स्टॉक्स (xStocks): ऑन-चेन दावे। 24/7 ट्रेड, $0.01 से फ्रैक्शनल।',
      },
      tr: {
        kicker: 'Non-custodial · Swap · Futures · Tahminler · Hisse',
        kicker_m: 'Non-custodial · Swap · Futures · Predictions · Stocks',
        sub: '10 000+ token swap’le, Futures işle, olaylara bahis yap, tokenize hisse al — hepsi cüzdanından. Kayıt yok, KYC yok, GROM’a yatırma yok.',
        sub_m: 'Swap, Futures, tahminler ve hisse — cüzdanından. KYC yok, GROM’a yatırma yok.',
        cta1: 'Cüzdan bağla →', cta2: 'Paneli aç',
        trust: ['Non-custodial', 'KYC yok', '20+ ağ', '7 likidite kaynağı'],
        trust_m: ['Non-custodial', 'KYC yok', '20+ ağ'],
        tab_swap: 'Swap', tab_perps: 'Futures', tab_predict: 'Tahminler', tab_stocks: 'Hisse',
        card_perps: 'GROM Futures', card_predict: 'GROM Tahminler', card_stocks: 'GROM Hisse',
        pay: 'Ödersin', get: 'Alırsın', bal: 'Bakiye',
        rate: 'Kur', save: 'Tasarruf', vs: 'vs 1inch',
        route: 'Rota:', route_best: '— 4 içinden en iyi',
        connect: 'Cüzdan bağla →',
        funding: 'Funding', funding_period: '8s',
        yes: 'Evet', no: 'Hayır',
        perps_meta: '100×’e kadar · %0,05 taker',
        open_trade: 'İşlem aç →',
        open_predict: 'Tahminleri aç →',
        pred_hint: '↳ Cüzdanından bahis — proxy fonlama yok',
        stocks_meta: 'ticker · 24/7 · $0,01’den kesir',
        browse_stocks: 'Hisseleri gör →',
        diag_eye: 'Neden GROM',
        diag_h: 'Bir kez bağlan. Her yerde işlem yap.',
        diag_sub: 'Cüzdanın hesabındır. Swap, Futures, tahminler, hisse — tek imza. GROM asla fon tutmaz.',
        diag_wallet: 'CÜZDANIN',
        diag_swap: 'Swap · 10k token', diag_perps: 'Futures · 100×’e kadar', diag_pred: 'Tahminler', diag_stocks: 'Hisse 24/7',
        diag_swap_m: 'Swap', diag_perps_m: 'Futures', diag_pred_m: 'Predict', diag_stocks_m: 'Hisse',
        diag_cap: '<strong>GROM’a yatırma yok.</strong> Her işlem cüzdanınla imzalanır ve zincirde yerleşir.',
        updates: '🚀 <b>Yeni:</b> Hisse · Tahminler · Futures · 20+ ağ',
        faq_q: 'GROM DEX nasıl çalışır?',
        faq_a: 'GROM bir meta-toplayıcıdır: her swap’te 7 likidite kaynağını paralel sorar ve en iyi fiyatla yürütür. Cüzdanınla imzalarsın — tokenler doğrudan adresine gelir. Saklama yok, KYC yok, hesap yok.',
        cmp_eye: 'Karşılaştır',
        cmp_h: 'Neden on-chain kazanır',
        cmp_sub: 'Büyük platformlarla aynı yüzey — saklama, KYC veya coğrafi engel olmadan.',
        tip_perps_q: 'Futures nedir?', tip_perps_a: 'Kalıcı vadeli: BTC/ETH/SOL’u 100×’e kadar işle. Marjin Hyperliquid’de, PnL zincirde.',
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
    BTC: 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png',
    ETH: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
    SOL: 'https://assets.coingecko.com/coins/images/4128/small/solana.png',
    DOGE: 'https://assets.coingecko.com/coins/images/5/small/dogecoin.png',
  };
  var COIN_TINT = {
    BTC: '#f7931a',
    ETH: '#627eea',
    SOL: '#14f195',
    DOGE: '#c2a633',
  };

  function fetchCgRefs() {
    return cached('cg4', 120_000, function () {
      var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      var timer = setTimeout(function () { try { if (ctrl) ctrl.abort(); } catch (_) {} }, 1200);
      return fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,dogecoin&vs_currencies=usd', {
        cache: 'no-store',
        signal: ctrl ? ctrl.signal : undefined,
      })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) {
          if (!j) return null;
          return {
            BTC: Number(j.bitcoin && j.bitcoin.usd) || 0,
            ETH: Number(j.ethereum && j.ethereum.usd) || 0,
            SOL: Number(j.solana && j.solana.usd) || 0,
            DOGE: Number(j.dogecoin && j.dogecoin.usd) || 0,
          };
        })
        .catch(function () { return null; })
        .finally(function () { clearTimeout(timer); });
    });
  }

  function fetchPerpsMulti() {
    return cached('perps4', 30_000, function () {
      return Promise.all([
        hlInfo({ type: 'metaAndAssetCtxs' }),
        hlInfo({ type: 'allMids' }).catch(function () { return null; }),
        fetchCgRefs(),
      ]).then(function (parts) {
        var j = parts[0];
        var mids = parts[1] || {};
        var cg = parts[2];
        var uni = (j && j[0] && j[0].universe) || [];
        var ctx = (j && j[1]) || [];
        var want = ['BTC', 'ETH', 'SOL', 'DOGE'];
        var out = [];
        var funding = 0;
        want.forEach(function (name) {
          var idx = -1;
          for (var i = 0; i < uni.length; i++) {
            if (String(uni[i].name || '').toUpperCase() === name) { idx = i; break; }
          }
          if (idx < 0 || !ctx[idx]) return;
          var c = ctx[idx];
          var mid = Number(mids[name]);
          var mark = mid > 0 ? mid : (Number(c.markPx) || 0);
          var prev = Number(c.prevDayPx) || 0;
          var chg = prev > 0 ? ((mark / prev) - 1) * 100 : 0;
          if (name === 'BTC') funding = (Number(c.funding) || 0) * 100;
          if (!(mark > 0)) return;
          var ref = cg && cg[name];
          if (ref > 0) {
            var drift = Math.abs(mark - ref) / ref;
            if (drift > 0.2) {
              try { console.warn('[lv2] skip', name + '-PERP', 'hl=', mark, 'cg=', ref, 'drift=', (drift * 100).toFixed(1) + '%'); } catch (_) {}
              return;
            }
          }
          out.push({
            sym: name + '-PERP',
            name: name,
            price: mark,
            chg: chg,
            logo: COIN_LOGO[name] || '',
            tint: COIN_TINT[name] || '#4ea9ff',
          });
        });
        return out.length ? { rows: out, funding: funding } : null;
      });
    });
  }

  var ES_RE = /dota|\blol\b|lol:|cs:?go|counter-?strike|valorant|\bbo3\b|\bbo5\b|\blck\b|\blpl\b|kespa|esports|league of legends|call of duty|overwatch/i;
  var US_SPORT_RE = /\b(nfl|nba|mlb|nhl|epl|premier league|super bowl|world series|ncaa)\b/i;

  function predictTier(cat, title) {
    cat = String(cat || '').toLowerCase();
    title = String(title || '');
    if (ES_RE.test(title) || cat === 'esports') return 5;
    if (cat === 'crypto' || /\b(btc|bitcoin|eth|ethereum|solana|crypto|etf|xrp|dogecoin)\b/i.test(title)) return 1;
    if (cat === 'politics' || /\b(election|president|senate|congress|trump|biden|vote|primary|parliament)\b/i.test(title)) return 2;
    if (cat === 'economy' || /\b(fed\b|inflation|gdp|cpi|rates?|fomc|treasury)\b/i.test(title)) return 2;
    if ((cat === 'sport' || cat === 'sports') && US_SPORT_RE.test(title)) return 4;
    return 0;
  }

  function fetchPredict() {
    return cached('predict370v3_' + lang(), 60_000, function () {
      var lng = lang();
      return fetch('/api/market/predict?limit=80&offset=0&lang=' + encodeURIComponent(lng), { cache: 'no-store' })
        .then(function (r) { if (!r.ok) throw 0; return r.json(); })
        .then(function (j) {
          var list = (j && j.markets) || [];
          var seen = Object.create(null);
          var top = [];

          function pickRow(rows) {
            if (!rows || !rows.length) return null;
            var best = null;
            for (var i = 0; i < rows.length; i++) {
              var p = Number(rows[i].p);
              if (p >= 25 && p <= 75) {
                if (!best || /match\s*winner/i.test(String(rows[i].n || ''))) best = rows[i];
                if (best && /match\s*winner/i.test(String(best.n || ''))) break;
              }
            }
            return best || rows[0];
          }

          function pushMarket(m, tierOverride) {
            var title = m.q || m.title || '';
            if (!title) return null;
            var id = m.id || m.slug || title;
            if (seen[id]) return null;
            var rows = m.rows || [];
            var pick = pickRow(rows);
            if (!pick) return null;
            var yesPct = Math.max(1, Math.min(99, Math.round(Number(pick.p) || 50)));
            var noPct = pick.pNo != null && isFinite(Number(pick.pNo))
              ? Math.max(1, Math.min(99, Math.round(Number(pick.pNo))))
              : Math.max(1, Math.min(99, 100 - yesPct));
            return {
              id: id,
              title: title,
              yes: yesPct,
              no: noPct,
              vol: Number(m.vol24 != null ? m.vol24 : m.vol) || 0,
              tier: tierOverride != null ? tierOverride : predictTier(m.cat, title),
            };
          }

          function add(row) {
            if (!row || top.length >= 3 || seen[row.id]) return;
            seen[row.id] = 1;
            top.push(row);
          }

          var scored = [];
          list.forEach(function (m) {
            var vol = Number(m.vol24 != null ? m.vol24 : m.vol) || 0;
            if (vol < 25000) return;
            var row = pushMarket(m);
            if (!row || !row.tier) return;
            scored.push(row);
          });
          scored.sort(function (a, b) { return (a.tier || 9) - (b.tier || 9) || b.vol - a.vol; });

          var tiers = [1, 2, 4, 5];
          for (var ti = 0; ti < tiers.length && top.length < 3; ti++) {
            for (var si = 0; si < scored.length && top.length < 3; si++) {
              if (scored[si].tier === tiers[ti]) add(scored[si]);
            }
          }
          for (si = 0; si < scored.length && top.length < 3; si++) add(scored[si]);
          if (top.length < 3) {
            list.forEach(function (m) {
              if (top.length >= 3) return;
              add(pushMarket(m, 6));
            });
          }
          return top.length ? top.slice(0, 3) : null;
        });
    });
  }

  function fetchStocks() {
    return cached('stocks6', 90_000, function () {
      function pick(j) {
        var items = (j && j.items) || [];
        if (!items.length) return null;
        /* Top-6 by |chg| without allocating a full mapped array first. */
        var top = [];
        for (var i = 0; i < items.length; i++) {
          var s = items[i];
          var ticker = s.sym || s.ticker || '';
          if (!ticker) continue;
          var chg = Number(s.chg != null ? s.chg : s.change24h) || 0;
          var abs = Math.abs(chg);
          var row = { ticker: ticker, chg: chg, logo: s.logo || s.logoUrl || s.img || '', _a: abs };
          if (top.length < 6) {
            top.push(row);
            if (top.length === 6) top.sort(function (a, b) { return a._a - b._a; });
          } else if (abs > top[0]._a) {
            top[0] = row;
            top.sort(function (a, b) { return a._a - b._a; });
          }
        }
        top.sort(function (a, b) { return b._a - a._a; });
        for (var j2 = 0; j2 < top.length; j2++) delete top[j2]._a;
        return top.length ? { movers: top, count: items.length } : null;
      }
      if (!window.__gromXstocksInflight) {
        window.__gromXstocksInflight = fetch('/api/market/xstocks', { cache: 'no-store' })
          .then(function (r) { if (!r.ok) throw 0; return r.json(); })
          .finally(function () { window.__gromXstocksInflight = null; });
      }
      return window.__gromXstocksInflight.then(pick);
    });
  }

  function fetchEthUsd() {
    return cached('ethusd3', 60_000, function () {
      /* HL mid only — faster than waiting on /api/market/quotes. */
      return hlInfo({ type: 'allMids' })
        .then(function (mids) {
          var px = Number(mids && mids.ETH) || 0;
          return px > 0 ? px : 2500;
        })
        .catch(function () { return 2500; });
    });
  }

  var ICON = {
    swap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3v18M17 3l-4 4M7 21V3M7 21l4-4"/></svg>',
    perps: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 17l6-6 4 4 8-8M21 7h-6M21 7v6"/></svg>',
    predict: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1"/></svg>',
    stocks: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20h16M6 20V10M11 20V4M16 20v-8M21 20V14"/></svg>',
    flip: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 3v14M7 17l-4-4M17 21V7M17 7l4 4"/></svg>',
  };

  function parseTab() {
    var h = location.hash || '';
    if (/^#tab=/i.test(h)) {
      var raw = h.replace(/^#tab=/i, '').split(/[&#]/)[0];
      try { history.replaceState(null, '', location.pathname + location.search + '#landing?tab=' + encodeURIComponent(raw)); } catch (_) {}
      return String(raw || 'swap').toLowerCase();
    }
    var q = h.indexOf('?') >= 0 ? h.split('?')[1] : (location.search || '').replace(/^\?/, '');
    var m = /(?:^|&)tab=([a-z]+)/i.exec(q || '');
    var tab = m ? m[1].toLowerCase() : 'swap';
    return ['swap', 'perps', 'predict', 'stocks'].indexOf(tab) >= 0 ? tab : 'swap';
  }

  function typeHeroH1(h1) {
    if (!h1) return;
    /* Allow re-entry only if not already typing mid-animation */
    if (h1.classList.contains('lv2-h1-typing') && h1.querySelector('.lv2-h1-typed') && h1._lv2TypeTimer) {
      return;
    }
    if (h1._lv2TypeTimer) {
      clearTimeout(h1._lv2TypeTimer);
      h1._lv2TypeTimer = null;
    }
    var reduce = false;
    try { reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (_) {}
    if (reduce) {
      h1.innerHTML = H1_EN;
      h1.classList.remove('lv2-h1-typing');
      h1.classList.add('lv2-h1-anim');
      return;
    }
    h1.classList.remove('lv2-h1-anim');
    h1.classList.add('lv2-h1-typing');
    h1.innerHTML =
      '<span class="lv2-h1-line"><span class="lv2-h1-typed"></span><span class="lv2-h1-caret" aria-hidden="true"></span></span>' +
      '<br>' +
      '<span class="lv2-h1-line lv2-accent"><span class="lv2-h1-typed"></span></span>';
    var typed = h1.querySelectorAll('.lv2-h1-typed');
    var t1 = typed[0];
    var t2 = typed[1];
    var caret = h1.querySelector('.lv2-h1-caret');
    var line1 = H1_LINE1;
    var line2 = H1_LINE2;
    var i = 0;
    var phase = 1;

    function finish() {
      if (caret) {
        caret.classList.add('is-done');
        setTimeout(function () {
          try { caret.remove(); } catch (_) {}
        }, 460);
      }
      h1.classList.remove('lv2-h1-typing');
      h1.classList.add('lv2-h1-anim');
      h1._lv2TypeTimer = null;
    }

    function tick() {
      if (!h1.isConnected) { h1._lv2TypeTimer = null; return; }
      if (phase === 1) {
        i += 1;
        t1.textContent = line1.slice(0, i);
        if (i >= line1.length) {
          phase = 2;
          i = 0;
          if (caret && t2 && t2.parentNode) {
            caret.classList.add('on-accent');
            t2.parentNode.appendChild(caret);
          }
          h1._lv2TypeTimer = setTimeout(tick, 720);
          return;
        }
        h1._lv2TypeTimer = setTimeout(tick, 126);
        return;
      }
      i += 1;
      t2.textContent = line2.slice(0, i);
      if (i >= line2.length) {
        finish();
        return;
      }
      h1._lv2TypeTimer = setTimeout(tick, 138);
    }
    h1._lv2TypeTimer = setTimeout(tick, 480);
  }

  function rewriteHeroLeft() {
    var page = document.getElementById('page-landing');
    if (!page) return;
    var left = page.querySelector('.lp-hero-left');
    if (!left) return;

    var eye = left.querySelector('.lp-eyebrow');
    if (eye) eye.remove();

    var kicker = left.querySelector('.lv2-kicker');
    if (!kicker) {
      kicker = document.createElement('div');
      kicker.className = 'lv2-kicker';
      left.insertBefore(kicker, left.firstChild);
    }
    var narrowHero = false;
    try { narrowHero = !!(window.matchMedia && window.matchMedia('(max-width: 720px)').matches); } catch (_) {}
    var kickerText = (narrowHero && t('kicker_m')) ? t('kicker_m') : t('kicker');
    kicker.innerHTML = '<span class="lv2-kicker-dot"></span><span class="lv2-kicker-text">' + esc(kickerText) + '</span>';

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

  function renderSwap(eth) {
    eth = eth || 2500;
    var pay = 0.5;
    var get = pay * eth;
    var save = Math.max(3, get * 0.0067);
    return (
      '<div class="lv2-swap-demo" data-lv2-act="connect" role="button" tabindex="0" aria-label="' + esc(t('connect')) + '">' +
        '<div class="lv2-swap-field">' +
          '<div class="lv2-swap-lbl">' + esc(t('pay')) + '</div>' +
          '<div class="lv2-swap-body">' +
            '<input class="lv2-swap-amt" value="' + String(pay).replace('.', ',') + '" readonly tabindex="-1" />' +
            '<span class="lv2-pill">' + coinBadge('ETH', COIN_LOGO.ETH, COIN_TINT.ETH) + 'ETH</span>' +
          '</div>' +
          '<div class="lv2-swap-meta"><span>≈ ' + fmtUsd(pay * eth) + '</span></div>' +
        '</div>' +
        '<div class="lv2-flip-wrap"><div class="lv2-flip">' + ICON.flip + '</div></div>' +
        '<div class="lv2-swap-field">' +
          '<div class="lv2-swap-lbl">' + esc(t('get')) + '</div>' +
          '<div class="lv2-swap-body">' +
            '<input class="lv2-swap-amt" value="' + get.toLocaleString('ru-RU', { maximumFractionDigits: 2 }) + '" readonly tabindex="-1" />' +
            '<span class="lv2-pill">' + coinBadge('U', 'https://assets.coingecko.com/coins/images/6319/small/usdc.png', '#2775ca') + 'USDC</span>' +
          '</div>' +
          '<div class="lv2-swap-meta"><span>≈ ' + fmtUsd(get) + '</span></div>' +
        '</div>' +
        '<div class="lv2-swap-info"><span>' + esc(t('rate')) + ': 1 ETH = ' + eth.toLocaleString('ru-RU', { maximumFractionDigits: 2 }) + ' USDC</span>' +
          '<span class="save">' + esc(t('save')) + ' ' + fmtUsd(save) + ' ' + esc(t('vs')) + '</span></div>' +
        '<div class="lv2-swap-route">' + esc(t('route')) +
          ' <span class="dot">●</span> LiFi <span class="dot">●</span> Paraswap <span class="dot">●</span> Kyber <span class="dot">●</span> Odos ' +
          esc(t('route_best')) + '</div>' +
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

  function renderPerps(data) {
    if (!data || !data.rows || !data.rows.length) {
      var loadPerps = lang() === 'en' ? 'Loading futures…' : (lang() === 'ua' ? 'Завантаження ф\'ючерсів…' : 'Загрузка фьючерсов…');
      return '<div class="lv2-empty">' + esc(loadPerps) + '</div>' +
        '<button type="button" class="lv2-cta" data-lv2-go="futures">' + esc(t('open_trade')) + '</button>';
    }
    var rows = data.rows.map(function (r) {
      var up = r.chg >= 0;
      return (
        '<div class="lv2-perp-row">' +
          '<div class="lv2-perp-sym">' + coinBadge(r.name, r.logo || COIN_LOGO[r.name], r.tint || COIN_TINT[r.name]) +
            '<span class="lv2-perp-name">' + esc(r.sym) + '</span></div>' +
          '<div class="lv2-perp-px ' + (up ? 'lv2-up' : 'lv2-dn') + '">' + fmtUsd(r.price) +
            '<span class="lv2-perp-chg">' + fmtPct(r.chg) + '</span></div>' +
        '</div>'
      );
    }).join('');
    return rows +
      '<div class="lv2-foot"><span>' + esc(t('funding')) + ': <b>' + fmtPct(data.funding) + ' / ' + esc(t('funding_period')) + '</b></span>' +
        '<span>' + esc(t('perps_meta')) + '</span></div>' +
      '<button type="button" class="lv2-cta" data-lv2-go="futures">' + esc(t('open_trade')) + '</button>';
  }

  function renderPredict(rows) {
    if (!rows || !rows.length) {
      return '<div class="lv2-empty">' + esc(lang() === 'en' ? 'Loading markets…' : 'Загрузка рынков…') + '</div>' +
        '<button type="button" class="lv2-cta lv2-cta-ghost" data-lv2-go="predict">' + esc(t('open_predict')) + '</button>';
    }
    var yesLbl = t('yes') || 'Yes';
    var noLbl = t('no') || 'No';
    var chanceLbl = t('chance') || (lang() === 'ru' ? 'шанс' : 'chance');
    var html = rows.map(function (m) {
      var y = Math.max(1, Math.min(99, Math.round(Number(m.yes) || 50)));
      var n = Math.max(1, Math.min(99, Math.round(
        m.no != null && isFinite(Number(m.no)) ? Number(m.no) : (100 - y)
      )));
      return (
        '<div class="lv2-mkt" data-lv2-go="predict" role="button" tabindex="0">' +
          '<div class="lv2-mkt-head">' +
            '<p class="lv2-mkt-q">' + esc(m.title || '') + '</p>' +
            '<div class="lv2-mkt-chance"><div class="lv2-mkt-ring" style="--p:' + y + '"><b>' + y + '%</b></div>' +
              '<span>' + esc(chanceLbl) + '</span></div>' +
          '</div>' +
          '<div class="lv2-mkt-yn">' +
            '<span class="lv2-mkt-yesb">' + esc(yesLbl) + ' <b>' + y + '%</b></span>' +
            '<span class="lv2-mkt-nob">' + esc(noLbl) + ' <b>' + n + '%</b></span>' +
          '</div>' +
        '</div>'
      );
    }).join('');
    return html +
      '<button type="button" class="lv2-cta lv2-cta-ghost" data-lv2-go="predict">' + esc(t('open_predict')) + '</button>';
  }

  function renderStocks(data) {
    if (!data || !data.movers || !data.movers.length) {
      return '<div class="lv2-empty">' + esc(lang() === 'en' ? 'Loading stocks…' : 'Загрузка акций…') + '</div>' +
        '<button type="button" class="lv2-cta" data-lv2-go="xstocks">' + esc(t('browse_stocks')) + '</button>';
    }
    var cells = data.movers.map(function (s) {
      var up = s.chg >= 0;
      var letter = esc(String(s.ticker || '?').slice(0, 1));
      var logo = s.logo
        ? '<span class="lv2-stk-logo"><img src="' + esc(s.logo) + '" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" ' +
            'onerror="this.parentNode.classList.add(\'is-fallback\');this.remove();"/></span>'
        : '<span class="lv2-stk-logo is-fallback" data-letter="' + letter + '"></span>';
      if (s.logo) {
        /* keep letter for CSS fallback after onerror */
        logo = logo.replace('class="lv2-stk-logo"', 'class="lv2-stk-logo" data-letter="' + letter + '"');
      }
      return (
        '<div class="lv2-stk-cell"><div class="lv2-stk-sym">' + logo + '<span>' + esc(s.ticker) + '</span></div>' +
          '<div class="lv2-stk-chg ' + (up ? 'lv2-up' : 'lv2-dn') + '">' + fmtPct(s.chg) + '</div></div>'
      );
    }).join('');
    return (
      '<div class="lv2-stk-grid">' + cells + '</div>' +
      '<button type="button" class="lv2-cta" data-lv2-go="xstocks">' + esc(t('browse_stocks')) + '</button>'
    );
  }

  function setHeroTab(hw, id) {
    if (!hw) return;
    hw.querySelectorAll('.lv2-hw-tab').forEach(function (b) {
      b.setAttribute('aria-selected', b.getAttribute('data-tab') === id ? 'true' : 'false');
    });
    hw.querySelectorAll('.lv2-panel').forEach(function (p) {
      var on = p.getAttribute('data-panel') === id;
      p.classList.toggle('is-on', on);
      if (on) p.removeAttribute('hidden');
      else p.setAttribute('hidden', '');
    });
    if (id !== 'swap') {
      if (id === 'perps' && !_live.perps) {
        fetchPerpsMulti().then(function (perps) { if (perps) { _live.perps = perps; patchHeroPanels(_live); } }).catch(function () {});
      } else if (id === 'predict' && !_live.predict) {
        fetchPredict().then(function (predict) { if (predict) { _live.predict = predict; patchHeroPanels(_live); } }).catch(function () {});
      } else if (id === 'stocks' && !_live.stocks) {
        fetchStocks().then(function (stocks) { if (stocks) { _live.stocks = stocks; patchHeroPanels(_live); } }).catch(function () {});
      }
    }
    try {
      /* Only rewrite landing hero tab into the hash — never leak ?tab= onto /futures /predict /stocks etc. */
      if (!isOnLanding()) return;
      if ((location.pathname || '/') !== '/' && (location.pathname || '/') !== '') return;
      history.replaceState(null, '', '/' + (location.search || '') + '#landing?tab=' + id);
    } catch (_) {}
  }

  function mountHeroWidget(data) {
    var right = document.querySelector('#page-landing .lp-hero-right');
    if (!right) return;
    /* Never keep the legacy orbit logo beside the swap widget */
    right.querySelectorAll('.landing-hero-icon, .landing-hero-logo-frame, .landing-brand-anim').forEach(function (n) {
      try { n.remove(); } catch (_) {}
    });
    var hw = right.querySelector('.lv2-hw') || document.getElementById('lv2HeroWidget');
    if (!hw) {
      hw = document.createElement('div');
      hw.className = 'lv2-hw';
      hw.id = 'lv2HeroWidget';
      right.appendChild(hw);
    }
    try { hw.removeAttribute('aria-busy'); } catch (_) {}

    var active = parseTab();
    var tabs = [
      { id: 'swap', label: t('tab_swap'), icon: ICON.swap, html: renderSwap(data.eth) },
      { id: 'perps', label: t('tab_perps'), icon: ICON.perps, html: renderPerps(data.perps) },
      { id: 'predict', label: t('tab_predict'), icon: ICON.predict, html: renderPredict(data.predict) },
      { id: 'stocks', label: t('tab_stocks'), icon: ICON.stocks, html: renderStocks(data.stocks) },
    ];
    if (!tabs.some(function (x) { return x.id === active; })) active = 'swap';

    hw.innerHTML =
      '<div class="lv2-hw-tabs" role="tablist">' +
        tabs.map(function (tab) {
          return '<button type="button" class="lv2-hw-tab" role="tab" data-tab="' + tab.id + '" aria-selected="' + (tab.id === active) + '">' +
            tab.icon + esc(tab.label) + '</button>';
        }).join('') +
      '</div>' +
      tabs.map(function (tab) {
        return '<div class="lv2-panel' + (tab.id === active ? ' is-on' : '') + '" data-panel="' + tab.id + '"' +
          (tab.id === active ? '' : ' hidden') + '>' + tab.html + '</div>';
      }).join('');

    hw.querySelectorAll('.lv2-hw-tab').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        setHeroTab(hw, btn.getAttribute('data-tab'));
      });
    });
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

  function stopFlowDot(host) {
    if (!host) return;
    if (host._lv2FlowRaf) {
      try { cancelAnimationFrame(host._lv2FlowRaf); } catch (_) {}
      host._lv2FlowRaf = 0;
    }
    if (host._lv2FlowIo) {
      try { host._lv2FlowIo.disconnect(); } catch (_) {}
      host._lv2FlowIo = null;
    }
  }

  function diagramNarrow() {
    try {
      return !!(window.matchMedia && window.matchMedia('(max-width: 720px)').matches);
    } catch (_) {
      return false;
    }
  }

  /* Dot walks dashed lines only — never through logo. At hub: left edge → jump → right edge. */
  function startFlowDot(host) {
    stopFlowDot(host);
    var svg = host && host.querySelector('.lv2-diagram svg');
    var dot = svg && svg.querySelector('.lv2-flow-dot');
    if (!dot) return;
    try {
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        dot.setAttribute('visibility', 'hidden');
        return;
      }
    } catch (_) {}

    var lay = host._lv2FlowLay || {};
    var HUB_L = lay.hubL || [380, 130];
    var HUB_R = lay.hubR || [500, 130];
    var WALLET = lay.wallet || [180, 130];
    var DEST = lay.dest || [[700, 60], [700, 110], [700, 160], [700, 210]];
    /* segments: [x0,y0,x1,y1] travel; null = instant jump to next point */
    var segs = [];
    segs.push([WALLET[0], WALLET[1], HUB_L[0], HUB_L[1]]);
    segs.push(null); /* jump across logo */
    segs.push([HUB_R[0], HUB_R[1], DEST[0][0], DEST[0][1]]);
    segs.push([DEST[0][0], DEST[0][1], HUB_R[0], HUB_R[1]]);
    for (var i = 1; i < DEST.length; i++) {
      segs.push([HUB_R[0], HUB_R[1], DEST[i][0], DEST[i][1]]);
      segs.push([DEST[i][0], DEST[i][1], HUB_R[0], HUB_R[1]]);
    }
    segs.push(null); /* jump back to left of logo */
    segs.push([HUB_L[0], HUB_L[1], WALLET[0], WALLET[1]]);

    var lengths = [];
    var total = 0;
    for (var s = 0; s < segs.length; s++) {
      var seg = segs[s];
      if (!seg) { lengths.push(0); continue; }
      var dx = seg[2] - seg[0];
      var dy = seg[3] - seg[1];
      var len = Math.sqrt(dx * dx + dy * dy) || 0.001;
      lengths.push(len);
      total += len;
    }
    var DUR = 84000; /* 2× faster than prior 168s */
    var visible = true;
    var lastPaint = 0;
    var t0 = performance.now();

    function posAt(u) {
      var dist = u * total;
      var acc = 0;
      var cur = WALLET;
      for (var j = 0; j < segs.length; j++) {
        var sg = segs[j];
        if (!sg) {
          /* jump: snap to start of next real segment */
          for (var k = j + 1; k < segs.length; k++) {
            if (segs[k]) { cur = [segs[k][0], segs[k][1]]; break; }
          }
          continue;
        }
        var L = lengths[j];
        if (dist <= acc + L) {
          var p = (dist - acc) / L;
          return [sg[0] + (sg[2] - sg[0]) * p, sg[1] + (sg[3] - sg[1]) * p];
        }
        acc += L;
        cur = [sg[2], sg[3]];
      }
      return cur;
    }

    function tick(now) {
      host._lv2FlowRaf = requestAnimationFrame(tick);
      if (!visible || document.hidden) return;
      if (now - lastPaint < 50) return; /* ~20fps — smooth, less jank */
      lastPaint = now;
      if (!dot.isConnected) { stopFlowDot(host); return; }
      var u = ((now - t0) % DUR) / DUR;
      var xy = posAt(u);
      dot.setAttribute('cx', xy[0].toFixed(2));
      dot.setAttribute('cy', xy[1].toFixed(2));
    }

    try {
      host._lv2FlowIo = new IntersectionObserver(function (entries) {
        visible = !!(entries[0] && entries[0].isIntersecting);
      }, { threshold: 0.05 });
      host._lv2FlowIo.observe(svg);
    } catch (_) { visible = true; }

    dot.setAttribute('cx', String(WALLET[0]));
    dot.setAttribute('cy', String(WALLET[1]));
    host._lv2FlowRaf = requestAnimationFrame(tick);
  }

  function mountLandingTrending(root) {
    if (!root || !document.getElementById('page-landing')) return;
    function render() {
      if (typeof window.gwRenderTrending === 'function') {
        window.gwRenderTrending({ instance: 'landing', root: root });
      }
    }
    function bootWallet() {
      if (typeof window.gwRenderTrending === 'function') {
        render();
        return;
      }
      if (typeof window.gromEnsureWalletModule === 'function') {
        window.gromEnsureWalletModule().then(render).catch(function () {});
        return;
      }
      if (typeof window.gromLoadWalletScripts === 'function') window.gromLoadWalletScripts();
      var tries = 0;
      var poll = setInterval(function () {
        if (typeof window.gwRenderTrending === 'function') {
          clearInterval(poll);
          render();
        } else if (++tries > 30) clearInterval(poll);
      }, 250);
    }
    /* Mobile: don't pull 1MB wallet bundle until user scrolls near the card. */
    if (lv2StableUi()) {
      var anchor = root.querySelector('.lv2-diagram-sec') || root.lastElementChild;
      if (anchor && typeof IntersectionObserver === 'function') {
        var seen = false;
        var obs = new IntersectionObserver(function (entries) {
          if (seen) return;
          if (!entries.some(function (e) { return e.isIntersecting; })) return;
          seen = true;
          try { obs.disconnect(); } catch (_) {}
          bootWallet();
        }, { rootMargin: '280px 0px', threshold: 0.01 });
        obs.observe(anchor);
        setTimeout(function () { if (!seen) bootWallet(); }, 14000);
        return;
      }
      setTimeout(bootWallet, 10000);
      return;
    }
    bootWallet();
  }

  function mountDiagram(root) {
    var host = root.querySelector('.lv2-diagram-sec');
    if (!host) {
      host = document.createElement('section');
      host.className = 'lv2-sec lv2-diagram-sec';
      root.appendChild(host);
    }
    try {
      if (!window._lv2DiagMq && window.matchMedia) {
        window._lv2DiagMq = window.matchMedia('(max-width: 720px)');
        var onMq = function () {
          var r = document.getElementById('landing-v2-root');
          if (r) mountDiagram(r);
        };
        if (window._lv2DiagMq.addEventListener) window._lv2DiagMq.addEventListener('change', onMq);
        else if (window._lv2DiagMq.addListener) window._lv2DiagMq.addListener(onMq);
      }
    } catch (_) {}
    var narrow = diagramNarrow();
    /* Keep running animation — remount only on language / layout / flow-version change */
    var flowVer = narrow ? 'v8m' : 'v5d';
    if (host.querySelector('.lv2-diagram svg')
      && host.getAttribute('data-lv2-lang') === lang()
      && host.getAttribute('data-lv2-flow') === flowVer) {
      return;
    }
    stopFlowDot(host);
    host.setAttribute('data-lv2-lang', lang());
    host.setAttribute('data-lv2-flow', flowVer);
    /* Same raster as nav — dark plate so 3D mark reads clean (no neon wash). */
    var logo = '/assets/grom-brand-header-clear.webp';

    /* Desktop: wallet → hub → products. Mobile: GROM hub center, products left/right. */
    var vbW = narrow ? 360 : 900;
    var vbH = narrow ? 188 : 260;
    var pad = narrow ? 16 : 60;
    var walletW = narrow ? 0 : 120;
    var walletH = narrow ? 0 : 80;
    var pillW = narrow ? 112 : 160;
    var pillH = narrow ? 36 : 40;
    var pillFs = narrow ? 12 : 12;
    var pillRx = narrow ? 12 : 10;
    var pillDot = narrow ? 5 : 8;
    var hubRing = narrow ? 40 : 58;
    var hubRad = narrow ? 35 : 54;
    var logoSize = narrow ? 52 : 80;
    var wx;
    var pillPositions; /* [{x,y}] */
    var hubCx;
    var hubCy;
    var midY;
    var wy;
    var lines;
    var lineStroke = narrow ? '#88c0d0' : '#3b4558';
    var lineOp = narrow ? '0.5' : '1';
    var ambience = '';

    if (narrow) {
      hubCx = vbW / 2;
      hubCy = 100;
      midY = hubCy;
      wx = 0;
      wy = 0;
      var sidePad = 12;
      var leftX = sidePad;
      var rightX = vbW - sidePad - pillW;
      var topY = 14;
      var botY = 150;
      /* TL Swap, TR Futures, BL Predict, BR Stocks */
      pillPositions = [
        { x: leftX, y: topY },
        { x: rightX, y: topY },
        { x: leftX, y: botY },
        { x: rightX, y: botY }
      ];
      vbH = botY + pillH + 12;
      ambience =
        '<circle cx="' + hubCx + '" cy="' + hubCy + '" r="78" fill="url(#lv2HubGlow)"/>' +
        '<circle class="lv2-hub-pulse" cx="' + hubCx + '" cy="' + hubCy + '" r="' + (hubRing + 8) + '" fill="none" stroke="#88c0d0" stroke-width="1" opacity="0.22"/>';
      lines = pillPositions.map(function (p, idx) {
        var tx = p.x + pillW / 2;
        var ty = p.y + pillH / 2;
        var dx = tx - hubCx;
        var dy = ty - hubCy;
        var dist = Math.sqrt(dx * dx + dy * dy) || 1;
        var x1 = hubCx + (dx / dist) * (hubRing + 3);
        var y1 = hubCy + (dy / dist) * (hubRing + 3);
        var x2 = tx - (dx / dist) * 12;
        var y2 = ty - (dy / dist) * 12;
        return '<line class="lv2-spoke" data-i="' + idx + '" x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) + '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) + '" stroke="' + lineStroke + '" stroke-width="1.4" stroke-dasharray="3 5" stroke-linecap="round" opacity="' + lineOp + '"/>';
      }).join('');
      host._lv2FlowLay = {
        wallet: [hubCx, hubCy],
        hubL: [hubCx - hubRing, hubCy],
        hubR: [hubCx + hubRing, hubCy],
        dest: pillPositions.map(function (p) { return [p.x + pillW / 2, p.y + pillH / 2]; })
      };
    } else {
      wx = pad;
      wy = 90;
      hubCx = 440;
      hubCy = 130;
      midY = 130;
      var pillX = 700;
      var pillYs = [40, 90, 140, 190];
      pillPositions = pillYs.map(function (y) { return { x: pillX, y: y }; });
      var walletEdge = wx + walletW;
      lines =
        '<line x1="' + walletEdge + '" y1="' + midY + '" x2="' + (hubCx - hubRing) + '" y2="' + hubCy + '" stroke="#3b4558" stroke-width="2" stroke-dasharray="4 4"/>' +
        pillPositions.map(function (p) {
          return '<line x1="' + (hubCx + hubRing) + '" y1="' + hubCy + '" x2="' + p.x + '" y2="' + (p.y + pillH / 2) + '" stroke="#3b4558" stroke-width="2" stroke-dasharray="4 4"/>';
        }).join('');
      host._lv2FlowLay = {
        wallet: [walletEdge, midY],
        hubL: [hubCx - hubRing, hubCy],
        hubR: [hubCx + hubRing, hubCy],
        dest: pillPositions.map(function (p) { return [p.x, p.y + pillH / 2]; })
      };
    }

    var hubX = hubCx - 60;
    var hubY = hubCy - 40;

    function pill(x, y, label, color) {
      var dotX = narrow ? 15 : 16;
      var textX = narrow ? 28 : 30;
      var stroke = narrow ? color : '#3b4558';
      var strokeOp = narrow ? '0.45' : '1';
      var fill = narrow ? '#222b3a' : '#1f2a38';
      return (
        '<g class="lv2-pill" transform="translate(' + x + ',' + y + ')">' +
          '<rect width="' + pillW + '" height="' + pillH + '" rx="' + pillRx + '" fill="' + fill + '" stroke="' + stroke + '" stroke-opacity="' + strokeOp + '"/>' +
          '<circle cx="' + dotX + '" cy="' + (pillH / 2) + '" r="' + pillDot + '" fill="' + color + '" opacity="' + (narrow ? '0.85' : '0.45') + '"/>' +
          '<text x="' + textX + '" y="' + (pillH / 2 + 4) + '" fill="#eaf1fb" font-size="' + pillFs + '" font-weight="650" font-family="Inter,system-ui,sans-serif">' + esc(label) + '</text>' +
        '</g>'
      );
    }
    var clipR = hubRad - 4;
    var wRx = 14;
    var wBarY1 = Math.round(walletH * 0.22);
    var wBarY2 = Math.round(walletH * 0.42);
    var wBarY3 = Math.round(walletH * 0.60);
    var labSwap = narrow ? (t('diag_swap_m') || t('diag_swap')) : t('diag_swap');
    var labPerps = narrow ? (t('diag_perps_m') || t('diag_perps')) : t('diag_perps');
    var labPred = narrow ? (t('diag_pred_m') || t('diag_pred')) : t('diag_pred');
    var labStocks = narrow ? (t('diag_stocks_m') || t('diag_stocks')) : t('diag_stocks');
    var walletBlock = narrow
      ? ''
      : (
          '<g transform="translate(' + wx + ',' + wy + ')">' +
            '<rect width="' + walletW + '" height="' + walletH + '" rx="' + wRx + '" fill="#1f2a38" stroke="#3b4558"/>' +
            '<rect x="14" y="' + wBarY1 + '" width="' + Math.round(walletW * 0.32) + '" height="10" rx="3" fill="#88c0d0" opacity="0.65"/>' +
            '<rect x="14" y="' + wBarY2 + '" width="' + Math.round(walletW * 0.55) + '" height="8" rx="3" fill="#eaf1fb" opacity="0.9"/>' +
            '<rect x="14" y="' + wBarY3 + '" width="' + Math.round(walletW * 0.38) + '" height="6" rx="3" fill="#8a9bb5"/>' +
            '<circle cx="' + (walletW - 18) + '" cy="' + Math.round(walletH * 0.28) + '" r="6" fill="#a3be8c"/>' +
            '<text x="' + (walletW / 2) + '" y="' + (walletH + 22) + '" text-anchor="middle" fill="#a3adc2" font-size="11" font-weight="700" font-family="Inter,system-ui,sans-serif">' + esc(t('diag_wallet')) + '</text>' +
          '</g>'
        );
    var flowDot = narrow
      ? ''
      : ('<circle class="lv2-flow-dot" cx="' + host._lv2FlowLay.wallet[0] + '" cy="' + host._lv2FlowLay.wallet[1] + '" r="3.5" fill="#88c0d0" opacity="0.95"/>');
    host.innerHTML =
      '<div class="lv2-sec-head">' +
        '<div class="lv2-sec-eye">' + esc(t('diag_eye')) + '</div>' +
        '<h2 class="lv2-sec-title">' + esc(t('diag_h')) + '</h2>' +
        '<p class="lv2-sec-sub">' + esc(t('diag_sub')) + '</p>' +
      '</div>' +
      '<div class="lv2-diagram' + (narrow ? ' is-narrow' : '') + '">' +
        '<svg viewBox="0 0 ' + vbW + ' ' + vbH + '" role="img" aria-label="GROM wallet hub">' +
          '<defs>' +
            '<linearGradient id="lv2HubRing" x1="0" y1="0" x2="1" y2="1">' +
              '<stop offset="0" stop-color="#88c0d0"/><stop offset="1" stop-color="#a3be8c"/></linearGradient>' +
            '<radialGradient id="lv2HubGlow" cx="50%" cy="50%" r="50%">' +
              '<stop offset="0" stop-color="#88c0d0" stop-opacity="0.30"/>' +
              '<stop offset="0.55" stop-color="#81a1c1" stop-opacity="0.10"/>' +
              '<stop offset="1" stop-color="#88c0d0" stop-opacity="0"/></radialGradient>' +
            '<clipPath id="lv2HubClip"><circle cx="60" cy="40" r="' + clipR + '"/></clipPath>' +
          '</defs>' +
          ambience +
          walletBlock +
          lines +
          '<g class="lv2-hub" transform="translate(' + hubX + ',' + hubY + ')">' +
            '<circle cx="60" cy="40" r="' + hubRing + '" fill="none" stroke="url(#lv2HubRing)" stroke-width="' + (narrow ? 1.75 : 2) + '" opacity="0.95"/>' +
            '<circle cx="60" cy="40" r="' + hubRad + '" fill="#1f2a38" stroke="#3b4558" stroke-width="1"/>' +
            '<image class="lv2-hub-logo" href="' + logo + '" xlink:href="' + logo + '" x="' + (60 - logoSize / 2) + '" y="' + (40 - logoSize / 2) + '" width="' + logoSize + '" height="' + logoSize + '" preserveAspectRatio="xMidYMid meet" clip-path="url(#lv2HubClip)"/>' +
          '</g>' +
          pill(pillPositions[0].x, pillPositions[0].y, labSwap, '#88c0d0') +
          pill(pillPositions[1].x, pillPositions[1].y, labPerps, '#a3be8c') +
          pill(pillPositions[2].x, pillPositions[2].y, labPred, '#ebcb8b') +
          pill(pillPositions[3].x, pillPositions[3].y, labStocks, '#81a1c1') +
          flowDot +
        '</svg>' +
        '<div class="lv2-diagram-cap">' + t('diag_cap') + '</div>' +
      '</div>';
    if (!narrow) startFlowDot(host);
  }

  function removePreview() {
    document.querySelectorAll('#landing-v2-root .lv2-live-sec, .lv2-live-sec, #landing-v2-ticker, .lv2-ticker-wrap').forEach(function (el) {
      el.remove();
    });
  }

  function removeCompare() {
    var host = document.getElementById('landing-v2-cmp');
    if (host) host.remove();
  }

  function patchHeroPanels(data) {
    var hw = document.querySelector('#page-landing .lv2-hw');
    if (!hw || !hw.querySelector('.lv2-panel')) {
      mountHeroWidget(data);
      return;
    }
    var map = {
      swap: renderSwap(data.eth),
      perps: renderPerps(data.perps),
      predict: renderPredict(data.predict),
      stocks: renderStocks(data.stocks),
    };
    Object.keys(map).forEach(function (id) {
      var panel = hw.querySelector('.lv2-panel[data-panel="' + id + '"]');
      if (panel) panel.innerHTML = map[id];
    });
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

  function refresh(opts) {
    opts = opts || {};
    var force = !!opts.force;
    if (!document.getElementById('page-landing')) return;
    removeCompare();
    removeUpdates();
    removePreview();
    var root = ensureRoot();
    bind(root);
    var needShell = !_painted || force || _lang !== lang();

    function apply(partial) {
      if (partial) {
        if (partial.perps != null) _live.perps = partial.perps;
        if (partial.predict != null) _live.predict = partial.predict;
        if (partial.stocks != null) _live.stocks = partial.stocks;
        if (partial.eth != null) _live.eth = partial.eth;
      }
      /* Mobile/Safari: one paint + one live fill — no repeating innerHTML patches */
      if (lv2StableUi() && _painted && !force) {
        if (partial && !_liveHeroPatched && (partial.perps || partial.predict || partial.stocks || partial.eth)) {
          _liveHeroPatched = true;
          patchHeroPanels(_live);
        }
        return;
      }
      if (needShell) {
        rewriteHeroLeft();
        mountHeroWidget(_live);
        if (root) {
          mountLandingTrending(root);
          mountDiagram(root);
        }
        injectFaq();
        _painted = true;
        _lang = lang();
        needShell = false; /* progressive fills only patch after first shell */
      } else {
        patchHeroPanels(_live);
      }
      removeUpdates();
      bind(root);
    }

    /* Instant shell — don't block on network */
    if (!_painted || force || _lang !== lang()) apply();

    fetchEthUsd().then(function (eth) { apply({ eth: eth }); }).catch(function () {});
    if (!opts.fetchAll && !lv2StableUi()) return;

    fetchPerpsMulti().then(function (perps) { apply({ perps: perps }); }).catch(function () {});
    fetchStocks().then(function (stocks) { apply({ stocks: stocks }); }).catch(function () {});
    fetchPredict().then(function (predict) { apply({ predict: predict }); }).catch(function () {});
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
    _painted = false;
    _liveHeroPatched = false;
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
  window.addEventListener('hashchange', function () {
    var hw = document.querySelector('#page-landing .lv2-hw');
    if (hw) setHeroTab(hw, parseTab());
  });
})();
