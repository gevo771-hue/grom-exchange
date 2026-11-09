/* GROM · Stocks section v2 — list, market map, stock page and "buy with any token on any network".
 * Product module (loaded by gromEnsureProductModule('stocks')). Renders inside #page-xstocks only;
 * the app shell, router and wallet stay untouched. Trades go through grom-wallet.js
 * (gwStocksQuote / gwStocksExecute) with the xStocks price guard. */
(function () {
  'use strict';
  if (window.gromStocks) return;

  var API = '/api/market';
  /* Networks with an executable same-chain route today (KyberSwap on EVM, Jupiter on Solana). */
  var EVM_TRADE = { 1: 1, 56: 1, 42161: 1, 10: 1, 8453: 1 };
  var CH = {
    solana: { id: 'solana', name: 'Solana' },
    ethereum: { id: 1, name: 'Ethereum' },
    bsc: { id: 56, name: 'BNB Chain' },
    arbitrum: { id: 42161, name: 'Arbitrum' },
    optimism: { id: 10, name: 'Optimism' },
    base: { id: 8453, name: 'Base' },
    polygon: { id: 137, name: 'Polygon' },
    avalanche: { id: 43114, name: 'Avalanche' },
    linea: { id: 59144, name: 'Linea' },
    robinhood: { id: 4663, name: 'Robinhood Chain' },
    hyperevm: { id: 999, name: 'HyperEVM' },
    monad: { id: 143, name: 'Monad' },
  };
  var KEY_BY_ID = {};
  Object.keys(CH).forEach(function (k) { KEY_BY_ID[String(CH[k].id)] = k; });
  var CHAIN_ICON = 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/';
  var TOKEN_ICON = {
    ETH: 'https://assets.coingecko.com/coins/images/279/large/ethereum.png',
    WETH: 'https://assets.coingecko.com/coins/images/279/large/ethereum.png',
    USDC: 'https://assets.coingecko.com/coins/images/6319/large/usdc.png',
    USDT: 'https://assets.coingecko.com/coins/images/325/large/Tether.png',
    SOL: 'https://assets.coingecko.com/coins/images/4128/large/solana.png',
    BNB: 'https://assets.coingecko.com/coins/images/825/large/bnb-icon2_2x.png',
    WBTC: 'https://assets.coingecko.com/coins/images/7598/large/wrapped_bitcoin_wbtc.png',
    POL: 'https://assets.coingecko.com/coins/images/32440/large/polygon.png',
    AVAX: 'https://assets.coingecko.com/coins/images/12559/large/Avalanche_Circle_RedWhite_Trans.png',
    ARB: 'https://assets.coingecko.com/coins/images/16547/large/arb.jpg',
    OP: 'https://assets.coingecko.com/coins/images/25244/large/Optimism.png',
    DAI: 'https://assets.coingecko.com/coins/images/9956/large/Badge_Dai.png',
  };
  var EXPLORER = {
    1: 'https://etherscan.io/tx/', 56: 'https://bscscan.com/tx/', 42161: 'https://arbiscan.io/tx/', 10: 'https://optimistic.etherscan.io/tx/',
    8453: 'https://basescan.org/tx/', 137: 'https://polygonscan.com/tx/', 43114: 'https://snowtrace.io/tx/', 59144: 'https://lineascan.build/tx/',
    4663: 'https://robin.etherscan.io/tx/', 999: 'https://hyperevmscan.io/tx/', 143: 'https://monadscan.com/tx/',
  };
  var CATS = ['all', 'tech', 'finance', 'etf', 'auto', 'consumer', 'crypto', 'energy', 'health'];
  var THEMES = ['all', 'fav', 'gainers', 'losers', 'buffett', 'ai', 'space', 'crypto', 'quantum', 'etf', 'robinhood'];
  var THEME_SYMS = {
    buffett: 'AAPL AXP BAC KO CVX OXY MCO CB KHC DVA KR VRSN V MA AMZN AON COF ALLY UNH DPZ POOL NUE LEN DHI CHTR STZ LPX HEI LAMR BRK.B',
    ai: 'NVDA AMD AVGO TSM MU SNDK INTC MRVL QCOM ARM ASML AMAT LRCX KLAC SMCI DELL CRWV NBIS PLTR ORCL MSFT GOOGL META CBRS ANET SKHY TSEM AAOI LITE POET MXL PENG IREN APLD SMH SOXX SOXL NVDL',
    space: 'SPCX RKLB ASTS LUNR RDW PL SATS IRDM BKSY SPCE FLY ITA UFO LMT NOC RTX BA',
    quantum: 'IONQ QBTS RGTI QUBT XNDU IBM HON',
  };
  Object.keys(THEME_SYMS).forEach(function (k) { var m = {}; THEME_SYMS[k].split(' ').forEach(function (s) { m[s] = 1; }); THEME_SYMS[k] = m; });

  var I18N = {
    en: {
      seo_h1: 'Tokenized stocks', loading: 'Loading stocks…', load_err: 'Stocks are temporarily unavailable. Retrying…', retry: 'Retry',
      m_open: 'US market open', m_closed: 'US market closed', m_pre: 'Pre-market', m_post: 'After hours', m_onchain: 'on-chain trading runs 24/7',
      k_stocks: 'stocks & ETFs', k_nets: 'networks', k_247: 'on-chain trading',
      trends: 'Trending 24h', trends_sub: 'by volume', heat: 'Market map', heat_sub: 'size — market cap · color — 24h change',
      vol: 'Vol', mcap: 'MC', price: 'Price',
      th_all: 'All', th_fav: 'Favorites', th_gainers: 'Top gainers', th_losers: 'Top losers', th_buffett: 'Buffett portfolio', th_ai: 'AI & chips',
      th_space: 'Space & SpaceX', th_crypto: 'Crypto stocks', th_quantum: 'Quantum', th_etf: 'ETFs', th_robinhood: 'Robinhood Chain',
      c_all: 'All sectors', c_tech: 'Technology', c_finance: 'Finance', c_etf: 'ETF', c_auto: 'Auto', c_consumer: 'Consumer', c_crypto: 'Crypto sector', c_energy: 'Energy', c_health: 'Healthcare',
      n_all: 'All networks', search: 'Ticker or company', found: 'Found: {n}',
      h_name: 'Company', h_price: 'Price', h_chga: 'Change $', h_chg: 'Change %', h_5d: '5 days', h_mc: 'Market cap', h_vol: 'Volume 24h', h_pe: 'P/E', h_nets: 'Networks',
      buy: 'Buy', sell: 'Sell', empty: 'Nothing found. Try another ticker or clear the filters.',
      back: 'Stocks', share: 'Share', copied: 'Copied', link_copied: 'Link copied',
      nets_n: '{n} networks', ex_price: 'Exchange price', premium: 'premium', discount: 'discount',
      t_chart: 'Chart', t_where: 'Where to buy', t_stats: 'Statistics', t_token: 'Token', t_faq: 'FAQ',
      chart_ex: 'Exchange price, USD', chart_none: 'Chart is not available for this ticker yet.', chart_load: 'Loading chart…',
      sess_closed: 'The token trades on-chain 24/7 — at night and on weekends the pool price can differ from the exchange; GROM shows the difference before you buy.',
      where_h: 'Where to buy: liquidity by network', where_sub: '“Auto” buys where pools are deepest, so you get more shares for the same amount. You can also pick a network manually.',
      w_net: 'Network', w_liq: 'Pool liquidity', w_vol: 'Volume 24h', w_pools: 'Pools', w_addr: 'Contract',
      b_best: 'Auto picks', b_deep: 'Deep', b_mid: 'Medium', b_low: 'Low', b_none: 'No pools', b_nodata: 'No data', b_ratio: 'Not 1:1', b_soon: 'Trading soon',
      s_onchain: 'On-chain price', s_ex: 'Exchange price', s_prem: 'Premium to exchange', s_chg: '24h change', s_mc: 'Company market cap', s_vol: 'Volume 24h', s_pe: 'P/E (TTM)', s_liq: 'On-chain liquidity', s_trade: 'Trading', s_trade_v: '24/7 · {n} networks',
      how_h: 'How buying works on GROM', how1: 'Pay with what you have', how1p: 'Any token in your wallet on any supported network — ETH, USDC, USDT, SOL, BNB and more. No need to swap to a stablecoin first.',
      how2: 'GROM builds the route', how2p: 'Swap, bridge and purchase are combined into one route. You see every step, fee and the time before you confirm.',
      how3: 'The stock lands in your wallet', how3p: 'The token goes to your own address. GROM never holds your funds — sell or move it any time.',
      tok_h: 'Token versions', tok_what: 'What it is', tok_what_v: 'A token that tracks the {name} share price', tok_vers: 'Versions',
      faq_h: 'FAQ',
      fq1: 'What exactly am I buying?', fa1: 'A token that follows the {name} share price. It stays in your own wallet — GROM does not hold funds and needs no sign-up. The token issuer defines its terms.',
      fq2: 'Can I buy at night or on weekends?', fa2: 'Yes. On-chain trading runs 24/7. When the US market is closed the pool price can drift from the last exchange price — GROM shows that premium or discount before you buy.',
      fq3: 'What can I pay with?', fa3: 'Almost any token on any supported network. GROM swaps and bridges it for you. Usually 1–2 confirmations in your wallet.',
      fq4: 'Why did “Auto” pick another network?', fa4: 'Auto buys where liquidity for this stock is deepest — a shallow pool would give a noticeably worse price. Pick a network manually if you need a specific one.',
      fq5: 'What are the risks?', fa5: 'Share prices move, pool liquidity is limited and cross-network routes use bridges. Tokenized stocks are not available in every country — check the rules where you live. This is not investment advice.',
      sim_h: 'Similar stocks',
      tp_pay: 'You pay', tp_get: 'You receive', tp_sell: 'You sell', tp_bal: 'Balance', tp_dest: 'Network', tp_dest_sub: 'where the stock will be',
      tp_auto: 'Auto', tp_pick: 'Choose network', tp_manual: 'manually', tp_liq: 'liquidity {v}', tp_best_route: 'best route',
      tp_soldest: 'Receive on Solana address', tp_soldest_ph: 'Paste your Solana address', tp_phantom: 'Connect Phantom', tp_route: 'Route', tp_steps: '{n} steps', tp_step: '1 step',
      tp_rate: 'Rate', tp_vs: 'Value vs exchange price', tp_fees: 'Network & bridge fees', tp_grom: 'GROM fee', tp_min: 'Minimum received', tp_via: 'Provider', tp_time: 'Time',
      tp_connect: 'Connect wallet', tp_enter: 'Enter amount', tp_quoting: 'Finding the best route…', tp_buy_x: 'Buy {sym}', tp_sell_x: 'Sell {sym}',
      tp_fine: 'Trades run from your own wallet. GROM never holds your funds.',
      tp_nohold: 'You don’t hold {sym} on a supported network yet.', tp_pick_tok: 'Choose a token',
      tp_auto_note: '“Auto” buys on {net} — deepest liquidity ({liq}). The transfer from {from} is included in the route.',
      tp_lowliq: 'Almost no {sym} liquidity on {net} — the price there would be poor. Switch to “Auto”.',
      tp_no_route: 'No route for this amount on {net}. Try “Auto”, another network or a different amount.',
      tp_rate_lim: 'Too many quote requests — retrying in a few seconds.',
      tp_cross: 'Buying from another network is not available yet. Pay with a token on {net} — or choose a network where you hold tokens.', tp_pick_on: 'Choose a token on {net}',
      tp_pay_evm: 'To buy on {net}, pay from an EVM wallet (MetaMask, Trust, etc.). Solana tokens can buy the Solana version.',
      tp_need_sol: 'Add a Solana address to receive the stock.',
      g_fair: 'Independent share price is unavailable right now — trading is paused for safety. Try again shortly.',
      g_ratio: 'This token version isn’t priced at 1 share per token — choose another network.',
      g_input: 'Could not value your payment token. Try USDC, USDT or another token.',
      g_output: 'Could not value what you receive. Choose USDC or USDT.',
      g_impact: 'Price protection: you would get {n}% less than the exchange value. Lower the amount or choose a network with more liquidity.',
      x_confirm: 'Confirm in your wallet', x_confirm_sub: 'Check the amount and network before signing', x_sent: 'Submitted', x_bridge: 'Delivery to {net}', x_bridge_sub: 'Usually takes {t}. You can close this window.',
      x_done: 'Done', x_done_sub: '{amt} {sym} on your address', x_fail: 'Not completed', x_close: 'Close', x_view: 'View transaction',
      pk_title_pay: 'Pay with', pk_title_get: 'Receive', pk_mine: 'In your wallet', pk_pop: 'Popular', pk_more: 'Can’t find your token? Swap it to one of these on the Swap page.',
      pk_search: 'Token or network', all_nets: 'All',
    },
    ru: {
      seo_h1: 'Токенизированные акции', loading: 'Загружаем акции…', load_err: 'Акции временно недоступны. Пробуем снова…', retry: 'Повторить',
      m_open: 'Биржа США открыта', m_closed: 'Биржа США закрыта', m_pre: 'Премаркет', m_post: 'Торги после закрытия', m_onchain: 'on-chain торговля идёт 24/7',
      k_stocks: 'акций и ETF', k_nets: 'сетей', k_247: 'on-chain торговля',
      trends: 'Тренды за 24 ч', trends_sub: 'по объёму', heat: 'Карта рынка', heat_sub: 'размер — капитализация · цвет — изменение за 24 ч',
      vol: 'Объём', mcap: 'Кап.', price: 'Цена',
      th_all: 'Все', th_fav: 'Избранное', th_gainers: 'Лидеры роста', th_losers: 'Лидеры падения', th_buffett: 'Портфель Баффета', th_ai: 'ИИ и чипы',
      th_space: 'Космос и SpaceX', th_crypto: 'Крипто-акции', th_quantum: 'Квантовые', th_etf: 'ETF', th_robinhood: 'Robinhood Chain',
      c_all: 'Все секторы', c_tech: 'Технологии', c_finance: 'Финансы', c_etf: 'ETF', c_auto: 'Авто', c_consumer: 'Потребительский', c_crypto: 'Крипто-сектор', c_energy: 'Энергетика', c_health: 'Здравоохранение',
      n_all: 'Все сети', search: 'Тикер или компания', found: 'Найдено: {n}',
      h_name: 'Компания', h_price: 'Цена', h_chga: 'Изм. $', h_chg: 'Изм. %', h_5d: '5 дней', h_mc: 'Капитализация', h_vol: 'Объём 24ч', h_pe: 'P/E', h_nets: 'Сети',
      buy: 'Купить', sell: 'Продать', empty: 'Ничего не найдено. Попробуйте другой тикер или снимите фильтры.',
      back: 'Акции', share: 'Поделиться', copied: 'Скопировано', link_copied: 'Ссылка скопирована',
      nets_n: '{n} сетей', ex_price: 'Цена на бирже', premium: 'премия', discount: 'дисконт',
      t_chart: 'График', t_where: 'Где купить', t_stats: 'Статистика', t_token: 'О токене', t_faq: 'FAQ',
      chart_ex: 'Биржевая цена, USD', chart_none: 'График для этого тикера пока недоступен.', chart_load: 'Загружаем график…',
      sess_closed: 'Токен торгуется on-chain 24/7 — ночью и в выходные цена в пулах может отличаться от биржевой, GROM показывает разницу до покупки.',
      where_h: 'Где купить: ликвидность по сетям', where_sub: 'Режим «Авто» покупает там, где пулы глубже, — так вы получите больше акций за ту же сумму. Сеть можно выбрать и вручную.',
      w_net: 'Сеть', w_liq: 'Ликвидность в пулах', w_vol: 'Объём 24ч', w_pools: 'Пулы', w_addr: 'Контракт',
      b_best: 'Авто выберет', b_deep: 'Глубокая', b_mid: 'Средняя', b_low: 'Мало', b_none: 'Нет пулов', b_nodata: 'Нет данных', b_ratio: 'Не 1:1', b_soon: 'Покупка скоро',
      s_onchain: 'Цена on-chain', s_ex: 'Цена на бирже', s_prem: 'Премия к бирже', s_chg: 'Изменение 24ч', s_mc: 'Капитализация компании', s_vol: 'Объём 24ч', s_pe: 'P/E (TTM)', s_liq: 'Ликвидность on-chain', s_trade: 'Торговля', s_trade_v: '24/7 · {n} сетей',
      how_h: 'Как работает покупка на GROM', how1: 'Платите чем есть', how1p: 'Любой токен из вашего кошелька в любой поддерживаемой сети: ETH, USDC, USDT, SOL, BNB и другие. Не нужно сначала менять на стейблкоин.',
      how2: 'GROM строит маршрут', how2p: 'Обмен, мост между сетями и покупка акции собираются в один маршрут. Вы видите все шаги, комиссии и время до подтверждения.',
      how3: 'Акция в вашем кошельке', how3p: 'Токен приходит на ваш адрес. GROM не хранит средства — продать или перевести его можно в любой момент.',
      tok_h: 'Версии токена', tok_what: 'Что это', tok_what_v: 'Токен, который отслеживает цену акции {name}', tok_vers: 'Версии',
      faq_h: 'Частые вопросы',
      fq1: 'Что именно я покупаю?', fa1: 'Токен, который следует за ценой акции {name}. Он хранится в вашем собственном кошельке — GROM не держит средства и не требует регистрации. Условия токена определяет его эмитент.',
      fq2: 'Можно купить ночью или в выходные?', fa2: 'Да. On-chain торговля идёт 24/7. Когда биржа США закрыта, цена в пулах может отходить от последней биржевой — эту премию или дисконт мы показываем до покупки.',
      fq3: 'Чем можно заплатить?', fa3: 'Почти любым токеном из любой поддерживаемой сети. GROM сам обменяет его и перенесёт в нужную сеть. Обычно нужно 1–2 подтверждения в кошельке.',
      fq4: 'Почему «Авто» выбрал другую сеть?', fa4: '«Авто» покупает там, где ликвидность этой акции глубже всего: в мелком пуле цена была бы заметно хуже. Если нужна конкретная сеть — выберите её вручную.',
      fq5: 'Какие риски?', fa5: 'Цена акции меняется, ликвидность в пулах ограничена, а между сетями маршрут идёт через мост. Токенизированные акции доступны не во всех странах — проверьте правила своей страны. Это не инвестиционная рекомендация.',
      sim_h: 'Похожие акции',
      tp_pay: 'Вы платите', tp_get: 'Вы получаете', tp_sell: 'Вы продаёте', tp_bal: 'Баланс', tp_dest: 'Сеть покупки', tp_dest_sub: 'где окажется акция',
      tp_auto: 'Авто', tp_pick: 'Выбрать сеть', tp_manual: 'вручную', tp_liq: 'ликвидность {v}', tp_best_route: 'лучший маршрут',
      tp_soldest: 'Зачислить на Solana-адрес', tp_soldest_ph: 'Вставьте ваш Solana-адрес', tp_phantom: 'Подключить Phantom', tp_route: 'Маршрут', tp_steps: '{n} шага', tp_step: '1 шаг',
      tp_rate: 'Курс', tp_vs: 'Стоимость к биржевой цене', tp_fees: 'Газ сетей и мост', tp_grom: 'Комиссия GROM', tp_min: 'Минимум к получению', tp_via: 'Провайдер', tp_time: 'Время',
      tp_connect: 'Подключить кошелёк', tp_enter: 'Введите сумму', tp_quoting: 'Ищем лучший маршрут…', tp_buy_x: 'Купить {sym}', tp_sell_x: 'Продать {sym}',
      tp_fine: 'Сделка выполняется из вашего кошелька. GROM не хранит средства.',
      tp_nohold: 'У вас пока нет {sym} в поддерживаемых сетях.', tp_pick_tok: 'Выберите токен',
      tp_auto_note: '«Авто» покупает в {net} — там самая глубокая ликвидность ({liq}). Перенос из {from} уже включён в маршрут.',
      tp_lowliq: 'В сети {net} почти нет ликвидности {sym} — цена там будет плохой. Включите «Авто».',
      tp_no_route: 'Нет маршрута для этой суммы в {net}. Попробуйте «Авто», другую сеть или сумму.',
      tp_rate_lim: 'Слишком много запросов котировок — повторим через несколько секунд.',
      tp_cross: 'Покупка из другой сети пока недоступна. Оплатите токеном в сети {net} или выберите сеть, где у вас есть токены.', tp_pick_on: 'Выбрать токен в {net}',
      tp_pay_evm: 'Чтобы купить в {net}, платите из EVM-кошелька (MetaMask, Trust и др.). Токенами Solana можно купить версию в Solana.',
      tp_need_sol: 'Добавьте Solana-адрес для зачисления акции.',
      g_fair: 'Независимая цена акции сейчас недоступна — торговля приостановлена для безопасности. Попробуйте чуть позже.',
      g_ratio: 'Эта версия токена не равна 1 акции — выберите другую сеть.',
      g_input: 'Не удалось оценить токен оплаты. Попробуйте USDC, USDT или другой токен.',
      g_output: 'Не удалось оценить, что вы получите. Выберите USDC или USDT.',
      g_impact: 'Защита цены: вы получите на {n}% меньше биржевой стоимости. Уменьшите сумму или выберите сеть с большей ликвидностью.',
      x_confirm: 'Подтвердите в кошельке', x_confirm_sub: 'Проверьте сумму и сеть перед подписью', x_sent: 'Отправлено', x_bridge: 'Доставка в {net}', x_bridge_sub: 'Обычно занимает {t}. Окно можно закрыть.',
      x_done: 'Готово', x_done_sub: '{amt} {sym} на вашем адресе', x_fail: 'Не выполнено', x_close: 'Закрыть', x_view: 'Открыть транзакцию',
      pk_title_pay: 'Чем платить', pk_title_get: 'Что получить', pk_mine: 'В вашем кошельке', pk_pop: 'Популярные', pk_more: 'Нет нужного токена? Обменяйте его на один из этих в разделе Swap.',
      pk_search: 'Токен или сеть', all_nets: 'Все',
    },
  };
  function lang() {
    var l = '';
    try { l = typeof window.getGromLang === 'function' ? window.getGromLang() : (localStorage.getItem('grom_lang') || ''); } catch (_) {}
    return l === 'ru' ? 'ru' : 'en';
  }
  function t(key, vars) {
    var d = I18N[lang()] || I18N.en;
    var s = d[key] != null ? d[key] : (I18N.en[key] != null ? I18N.en[key] : key);
    if (vars) Object.keys(vars).forEach(function (k) { s = s.split('{' + k + '}').join(vars[k]); });
    return s;
  }

  /* ---------- state ---------- */
  var S = {
    rows: null, bySym: {}, err: false, indices: null, spark: {}, sparkPending: {},
    theme: 'all', cat: 'all', net: 'all', q: '', sort: 'mc', dir: -1, page: 1,
    fav: readFav(), detail: null, detailSym: '', detailErr: false, range: '5d', chart: {},
    hold: null, holdAt: 0, varBal: {},
    tr: { side: 'buy', token: null, amt: '', dest: 'auto', openNets: false, routeOpen: true, quote: null, quoting: false, qerr: null, seq: 0, solDest: '', sellKey: '' },
  };
  var root = null;
  var timers = { list: 0, quote: 0 };
  function readFav() { try { return JSON.parse(localStorage.getItem('grom_stock_favs') || '{}') || {}; } catch (_) { return {}; } }
  function saveFav() { try { localStorage.setItem('grom_stock_favs', JSON.stringify(S.fav)); } catch (_) {} }

  /* ---------- helpers ---------- */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function loc() { return lang() === 'ru' ? 'ru-RU' : 'en-US'; }
  function nf(n, d) { return Number(n).toLocaleString(loc(), { minimumFractionDigits: d, maximumFractionDigits: d }); }
  function usdS(n) {
    if (n == null || !isFinite(n) || n <= 0) return '—';
    var a = Math.abs(n);
    if (a >= 1e12) return '$' + nf(n / 1e12, 2) + 'T';
    if (a >= 1e9) return '$' + nf(n / 1e9, 2) + 'B';
    if (a >= 1e6) return '$' + nf(n / 1e6, 2) + 'M';
    if (a >= 1e3) return '$' + nf(n / 1e3, 1) + 'K';
    return '$' + nf(n, a < 10 ? 2 : 0);
  }
  function px(n) { if (!(n > 0)) return '—'; return '$' + nf(n, n >= 1 ? 2 : (n >= 0.01 ? 4 : 6)); }
  function pct(n, d) { if (n == null || !isFinite(n)) return '—'; return (n > 0 ? '+' : '') + nf(n, d == null ? 2 : d) + '%'; }
  function cls(n) { return n > 0 ? 'gs-up' : (n < 0 ? 'gs-dn' : ''); }
  function amtF(n) { if (!isFinite(n) || n <= 0) return '0'; if (n >= 1000) return nf(n, 2); if (n >= 1) return nf(n, 4); return nf(n, 6); }
  function priceOf(r) { return r.p > 0 ? r.p : (r.f > 0 ? r.f : 0); }
  function chgAbs(r) {
    if (r.ca != null) return r.ca;
    var p = r.f > 0 ? r.f : priceOf(r);
    if (r.c == null || !(p > 0)) return null;
    return p - p / (1 + r.c / 100);
  }
  function hue(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360; return h; }
  var ICO = {
    star: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4L2.8 9.5l6.4-.8z"/></svg>',
    starO: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4L2.8 9.5l6.4-.8z"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
    down: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M6 9l6 6 6-6"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 5v14M6 13l6 6 6-6"/></svg>',
    copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/></svg>',
    shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/></svg>',
    x: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    share: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4"/></svg>',
  };
  function logo(sym, sz, fallback) {
    sz = sz || 36;
    var ini = esc(String(sym).replace(/[^A-Z]/g, '').slice(0, 2) || String(sym).slice(0, 2));
    var u = 'https://financialmodelingprep.com/image-stock/' + encodeURIComponent(String(sym).replace(/\./g, '-')) + '.png';
    return '<span class="gs-lg" style="width:' + sz + 'px;height:' + sz + 'px;padding:' + Math.round(sz * 0.1) + 'px" data-ini="' + ini + '" data-h="' + hue(String(sym)) + '">'
      + '<img src="' + u + '" alt="" loading="lazy" decoding="async"' + (fallback ? ' data-fb="' + esc(fallback) + '"' : '') + '></span>';
  }
  function ci(key, sz) {
    sz = sz || 18;
    return '<span class="gs-ci" style="width:' + sz + 'px;height:' + sz + 'px" title="' + esc((CH[key] || {}).name || key) + '"><img src="' + CHAIN_ICON + encodeURIComponent(key) + '.svg" alt="" loading="lazy"></span>';
  }
  function badge(key, sz) {
    var b = Math.max(10, Math.round(sz * 0.5));
    return '<img class="gs-cb" src="' + CHAIN_ICON + encodeURIComponent(key) + '.svg" width="' + b + '" height="' + b + '" alt="">';
  }
  function ti(sym, sz, url) {
    sz = sz || 28;
    var u = url || TOKEN_ICON[String(sym).toUpperCase()] || '';
    return '<span class="gs-ci" style="width:' + sz + 'px;height:' + sz + 'px;display:inline-flex;align-items:center;justify-content:center;font-size:' + Math.round(sz * 0.36) + 'px;font-weight:800;background:hsl(' + hue(String(sym)) + ',35%,40%)">'
      + (u ? '<img src="' + esc(u) + '" alt="" loading="lazy">' : esc(String(sym).slice(0, 2))) + '</span>';
  }
  function tokc(tok, sz) { return '<span class="gs-tk">' + ti(tok.sym, sz, tok.logo) + badge(tok.netKey, sz) + '</span>'; }
  function stockc(sym, key, sz) { return '<span class="gs-tk">' + logo(sym, sz) + (key ? badge(key, sz) : '') + '</span>'; }
  function onImgError(e) {
    var img = e.target;
    if (!img || img.tagName !== 'IMG') return;
    var fb = img.getAttribute('data-fb');
    if (fb) { img.removeAttribute('data-fb'); img.src = fb; return; }
    var box = img.parentNode;
    if (box && box.classList && box.classList.contains('gs-lg')) {
      box.classList.add('ini');
      box.style.background = 'hsl(' + (box.getAttribute('data-h') || 200) + ',38%,42%)';
      box.style.fontSize = Math.round(parseInt(box.style.width, 10) * 0.34) + 'px';
      box.textContent = box.getAttribute('data-ini') || '';
    } else {
      img.style.visibility = 'hidden';
    }
  }
  var toastT = 0;
  function toast(m) {
    var el = document.getElementById('gsToast');
    if (!el) { el = document.createElement('div'); el.id = 'gsToast'; el.className = 'gs-toast'; document.body.appendChild(el); }
    el.textContent = m; el.style.display = 'block';
    clearTimeout(toastT); toastT = setTimeout(function () { el.style.display = 'none'; }, 2200);
  }
  function getJson(url, timeoutMs) {
    var ctl = typeof AbortController === 'function' ? new AbortController() : null;
    var tm = ctl ? setTimeout(function () { ctl.abort(); }, timeoutMs || 15000) : 0;
    return fetch(url, { headers: { accept: 'application/json' }, signal: ctl ? ctl.signal : undefined })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .finally(function () { clearTimeout(tm); });
  }
  function wallet() {
    try { return typeof window.gwStocksAccount === 'function' ? window.gwStocksAccount() : { evm: '', sol: '', solDest: '' }; } catch (_) { return { evm: '', sol: '', solDest: '' }; }
  }
  function connected() { var w = wallet(); return !!(w.evm || w.sol); }
  function isActive() {
    var sec = document.getElementById('page-xstocks');
    return !!(sec && root && sec.contains(root) && (sec.classList.contains('active') || sec.offsetParent !== null));
  }

  /* ---------- US session ---------- */
  function session() {
    var st = S.indices && S.indices.marketState ? String(S.indices.marketState).toUpperCase() : '';
    var parts = {};
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false })
        .formatToParts(new Date()).forEach(function (p) { parts[p.type] = p.value; });
    } catch (_) {}
    var wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday);
    var mins = ((+parts.hour || 0) % 24) * 60 + (+parts.minute || 0);
    var open = wd >= 1 && wd <= 5 && mins >= 570 && mins < 960;
    if (st === 'REGULAR') open = true;
    else if (st === 'CLOSED' || st === 'PRE' || st === 'POST' || st === 'PREPRE' || st === 'POSTPOST') open = false;
    var label = open ? t('m_open') : (st === 'PRE' ? t('m_pre') : (st === 'POST' ? t('m_post') : t('m_closed')));
    return { open: open, label: label };
  }

  /* ---------- data ---------- */
  function loadList(force) {
    if (S.loadingList && !force) return S.loadingList;
    S.loadingList = getJson(API + '/stocks', 20000).then(function (j) {
      var rows = Array.isArray(j && j.items) ? j.items : [];
      if (!rows.length) throw new Error('empty');
      S.rows = rows; S.bySym = {};
      rows.forEach(function (r) { S.bySym[r.s] = r; });
      S.err = false;
      return rows;
    }).catch(function () {
      S.err = !S.rows;
      return S.rows;
    }).finally(function () { S.loadingList = null; });
    return S.loadingList;
  }
  function loadIndices() {
    if (S.idxPending) return S.idxPending;
    S.idxPending = getJson(API + '/stocks/indices', 12000).then(function (j) {
      if (j && Array.isArray(j.indices) && j.indices.length) S.indices = j;
    }).catch(function () {}).finally(function () { S.idxPending = null; });
    return S.idxPending;
  }
  function loadSpark(syms) {
    var want = syms.filter(function (s) { return !S.spark[s] && !S.sparkPending[s]; }).slice(0, 30);
    if (!want.length) return Promise.resolve();
    want.forEach(function (s) { S.sparkPending[s] = 1; });
    return getJson(API + '/stocks/spark?syms=' + encodeURIComponent(want.join(',')), 15000).then(function (j) {
      var series = (j && j.series) || {};
      want.forEach(function (s) { S.spark[s] = Array.isArray(series[s]) ? series[s] : []; });
    }).catch(function () {}).finally(function () { want.forEach(function (s) { delete S.sparkPending[s]; }); });
  }

  /* ---------- routing ---------- */
  /* Stock page = ?sym=TICKER in the query (the app router keeps query params and owns the hash). */
  function hashSym() {
    var s = '';
    try { s = new URL(location.href).searchParams.get('sym') || ''; } catch (_) {}
    if (!s) { var m = String(location.hash || '').match(/^#xstocks\?(?:.*&)?sym=([A-Za-z0-9.\-]+)/); if (m) s = decodeURIComponent(m[1]); }
    s = String(s).toUpperCase();
    return /^[A-Z0-9][A-Z0-9.\-]{0,15}$/.test(s) ? s : '';
  }
  function stockUrl(sym) {
    var u = new URL(location.href);
    if (sym) u.searchParams.set('sym', sym); else u.searchParams.delete('sym');
    u.hash = 'xstocks';
    return u.pathname + u.search + u.hash;
  }
  function go(sym, toTrade) {
    S.pendingTrade = !!toTrade;
    var next = stockUrl(sym);
    if (location.pathname + location.search + location.hash !== next) {
      try { history.pushState(null, '', next); } catch (_) { location.hash = 'xstocks'; }
    }
    render();
  }
  function render() {
    if (!root) return;
    var sym = hashSym();
    var focus = '';
    try { focus = String(sessionStorage.getItem('gwx_focus_sym') || '').toUpperCase(); if (focus) sessionStorage.removeItem('gwx_focus_sym'); } catch (_) {}
    if (focus && /^[A-Z0-9.\-]{1,16}$/.test(focus) && focus !== sym) { go(focus); return; }
    if (sym) viewDetail(sym); else viewList();
  }

  /* ================= LIST ================= */
  function filtered() {
    var rows = S.rows || [];
    var q = S.q.trim().toLowerCase();
    var th = q ? 'all' : S.theme; /* search covers every stock, whatever collection is open */
    var list = rows.filter(function (r) {
      if (S.cat !== 'all' && r.k !== S.cat) return false;
      if (S.net !== 'all' && r.nets.indexOf(S.net) < 0) return false;
      if (q && r.s.toLowerCase().indexOf(q) < 0 && String(r.n || '').toLowerCase().indexOf(q) < 0) return false;
      if (th === 'fav' && !S.fav[r.s]) return false;
      if ((th === 'gainers' || th === 'losers') && (r.c == null || !(r.mc > 1e9))) return false;
      if (THEME_SYMS[th] && !THEME_SYMS[th][r.s]) return false;
      if (th === 'crypto' && r.k !== 'crypto') return false;
      if (th === 'etf' && r.k !== 'etf') return false;
      if (th === 'robinhood' && r.nets.indexOf('robinhood') < 0) return false;
      return true;
    });
    var k = S.sort, dir = S.dir;
    if (th === 'gainers') { k = 'c'; dir = -1; }
    if (th === 'losers') { k = 'c'; dir = 1; }
    function val(r) {
      if (k === 'n') return r.s;
      if (k === 'p') return priceOf(r) > 0 ? priceOf(r) : null;
      if (k === 'ca') return chgAbs(r);
      if (k === 'c') return r.c == null ? null : r.c;
      if (k === 'v') return r.v > 0 ? r.v : null;
      if (k === 'pe') return r.pe > 0 ? r.pe : null;
      return r.mc > 0 ? r.mc : (priceOf(r) > 0 ? 0 : null);
    }
    list.sort(function (a, b) {
      var x = val(a), y = val(b);
      if (k === 'n') return dir * (x < y ? -1 : x > y ? 1 : 0);
      if (x == null && y == null) return 0;
      if (x == null) return 1; /* missing values always last */
      if (y == null) return -1;
      if (x === y) return 0;
      return dir * (x - y);
    });
    return list;
  }
  function stripHtml() {
    var ss = session();
    var items = (S.indices && S.indices.indices) || [];
    var line = items.map(function (i) {
      return '<span>' + esc(i.name) + '<b class="num">' + nf(i.price, i.price >= 1000 ? 2 : 2) + '</b><em class="num ' + cls(i.chg) + '" style="font-style:normal">'
        + (i.chgAbs != null ? (i.chgAbs > 0 ? '+' : '') + nf(i.chgAbs, 2) + ' ' : '') + '(' + pct(i.chg) + ')</em></span>';
    }).join('');
    return '<div class="gs-strip"><span class="gs-mstate ' + (ss.open ? 'open' : '') + '"><i></i>' + esc(ss.label) + '</span>'
      + '<div class="gs-marq">' + (line ? '<div class="gs-marq-in">' + line + line + '</div>' : '<div class="gs-marq-in" style="animation:none"><span class="gs-mu">' + esc(t('m_onchain')) + '</span></div>') + '</div></div>';
  }
  function viewList() {
    S.detailSym = '';
    root.classList.remove('gs-detail');
    if (!S.rows) {
      root.innerHTML = '<h1 class="gs-sr">' + esc(t('seo_h1')) + '</h1>' + stripHtml()
        + '<div class="gs-card gs-tbl">' + (S.err ? '<div class="gs-empty">' + esc(t('load_err')) + '</div>' : '<div class="gs-skel"></div><div class="gs-skel"></div><div class="gs-skel"></div><div class="gs-skel"></div><div class="gs-skel"></div>') + '</div>';
      loadList().then(function () { if (!hashSym() && root) viewList(); });
      return;
    }
    var rows = S.rows;
    var nets = {};
    rows.forEach(function (r) { r.nets.forEach(function (n) { nets[n] = (nets[n] || 0) + 1; }); });
    var trend = rows.filter(function (r) { return r.v > 0 && r.c != null && priceOf(r) > 0; }).sort(function (a, b) { return b.v - a.v; }).slice(0, 5);
    root.innerHTML = '<h1 class="gs-sr">' + esc(t('seo_h1')) + '</h1>' + stripHtml()
      + '<div class="gs-hero"><div class="gs-kpis"><div class="gs-kpi"><b class="num">' + nf(rows.length, 0) + '</b><span>' + esc(t('k_stocks')) + '</span></div>'
      + '<div class="gs-kpi"><b class="num">' + Object.keys(nets).length + '</b><span>' + esc(t('k_nets')) + '</span></div>'
      + '<div class="gs-kpi"><b>24/7</b><span>' + esc(t('k_247')) + '</span></div></div></div>'
      + '<div class="gs-top"><div class="gs-card"><div class="gs-h2">' + esc(t('trends')) + '<small>' + esc(t('trends_sub')) + '</small></div>'
      + trend.map(function (r, i) {
        return '<div class="gs-trend" data-go="' + esc(r.s) + '"><span class="rk">' + (i + 1) + '</span>' + logo(r.s, 36, r.l)
          + '<div class="nm"><b>' + esc(r.s) + '</b><small>' + esc(t('vol')) + ' ' + usdS(r.v) + (r.mc ? ' | ' + esc(t('mcap')) + ' ' + usdS(r.mc) : '') + '</small></div>'
          + '<div class="r num"><b>' + px(priceOf(r)) + '</b><small class="' + cls(r.c) + '">' + pct(r.c) + '</small></div></div>';
      }).join('')
      + '</div><div class="gs-card"><div class="gs-h2">' + esc(t('heat')) + '<small>' + esc(t('heat_sub')) + '</small></div><div class="gs-heat" id="gsHeat"><div class="gs-tip" id="gsTip"></div></div></div></div>'
      + '<div class="gs-themes" id="gsThemes">' + THEMES.map(function (th) { return '<button type="button" data-th="' + th + '" class="' + (S.theme === th ? 'on' : '') + '">' + esc(t('th_' + th)) + '</button>'; }).join('') + '</div>'
      + '<div class="gs-toolbar"><label class="gs-search">' + ICO.search + '<input id="gsQ" type="search" autocomplete="off" placeholder="' + esc(t('search')) + '" value="' + esc(S.q) + '"></label>'
      + '<div class="gs-sel" id="gsCatSel"></div><div class="gs-sel" id="gsNetSel"></div><span class="gs-cnt" id="gsCnt"></span></div>'
      + '<div class="gs-card gs-tbl" id="gsTbl"></div><div class="gs-pager" id="gsPager"></div>';
    root.querySelectorAll('[data-go]').forEach(function (e) { e.addEventListener('click', function () { go(e.getAttribute('data-go')); }); });
    root.querySelectorAll('#gsThemes button').forEach(function (b) {
      b.addEventListener('click', function () {
        S.theme = b.getAttribute('data-th'); S.page = 1;
        root.querySelectorAll('#gsThemes button').forEach(function (x) { x.classList.toggle('on', x === b); });
        paintTable();
      });
    });
    var qi = root.querySelector('#gsQ');
    qi.addEventListener('input', function () { S.q = qi.value; S.page = 1; paintTable(); });
    paintSelect('gsCatSel', CATS.map(function (c) { return [c, t('c_' + c), null]; }), S.cat, function (v) { S.cat = v; S.page = 1; paintTable(); });
    var netOpts = [['all', t('n_all'), rows.length]].concat(Object.keys(nets).sort(function (a, b) { return nets[b] - nets[a]; }).map(function (n) { return [n, (CH[n] || {}).name || n, nets[n], n]; }));
    paintSelect('gsNetSel', netOpts, S.net, function (v) { S.net = v; S.page = 1; paintTable(); });
    paintHeat();
    paintTable();
  }
  function paintSelect(id, opts, cur, onPick) {
    var el = root.querySelector('#' + id); if (!el) return;
    var c = opts.filter(function (o) { return o[0] === cur; })[0] || opts[0];
    el.innerHTML = '<button type="button">' + (c[3] ? ci(c[3], 18) : '') + '<span>' + esc(c[1]) + '</span>' + ICO.down + '</button>';
    el.firstChild.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = el.querySelector('.gs-menu');
      root.querySelectorAll('.gs-menu').forEach(function (m) { m.remove(); });
      if (open) return;
      var m = document.createElement('div'); m.className = 'gs-menu';
      m.innerHTML = opts.map(function (o) { return '<button type="button" data-v="' + esc(o[0]) + '" class="' + (o[0] === cur ? 'on' : '') + '">' + (o[3] ? ci(o[3], 18) : '') + '<span>' + esc(o[1]) + '</span>' + (o[2] != null ? '<span class="r">' + o[2] + '</span>' : '') + '</button>'; }).join('');
      el.appendChild(m);
      m.querySelectorAll('button').forEach(function (b) {
        b.addEventListener('click', function (ev) { ev.stopPropagation(); m.remove(); var v = b.getAttribute('data-v'); paintSelect(id, opts, v, onPick); onPick(v); });
      });
      setTimeout(function () { document.addEventListener('click', function h() { m.remove(); document.removeEventListener('click', h); }); }, 0);
    });
  }
  var PER = 25;
  function sparkSvg(sym, w, h) {
    var p = S.spark[sym];
    if (!p) return '<span class="gs-na" data-spark="' + esc(sym) + '"></span>';
    if (p.length < 3) return '<span class="gs-na">—</span>';
    var mn = Math.min.apply(0, p), mx = Math.max.apply(0, p), rg = (mx - mn) || 1;
    var pts = p.map(function (v, i) { return (i / (p.length - 1) * w).toFixed(1) + ',' + (h - 2 - (v - mn) / rg * (h - 4)).toFixed(1); }).join(' ');
    var col = p[p.length - 1] >= p[0] ? '#22c55e' : '#f04c65';
    return '<svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '"><polyline points="' + pts + '" fill="none" stroke="' + col + '" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  }
  function paintTable() {
    var tbl = root && root.querySelector('#gsTbl'); if (!tbl) return;
    var list = filtered(), n = list.length, pages = Math.max(1, Math.ceil(n / PER));
    if (S.page > pages) S.page = pages;
    var vis = list.slice((S.page - 1) * PER, S.page * PER);
    root.querySelector('#gsCnt').textContent = t('found', { n: nf(n, 0) });
    function hs(k, label, rt, c) {
      var on = S.sort === k && S.theme !== 'gainers' && S.theme !== 'losers';
      return '<div class="s ' + (rt ? 'rt ' : '') + (c || '') + (on ? ' on' : '') + '" data-s="' + k + '">' + esc(label) + (on ? (S.dir < 0 ? ' ↓' : ' ↑') : '') + '</div>';
    }
    var head = '<div class="gs-tr h"><div></div>' + hs('n', t('h_name')) + hs('p', t('h_price'), 1, 'c-p') + hs('ca', t('h_chga'), 1, 'c-ca') + hs('c', t('h_chg'), 1, 'c-c')
      + '<div class="rt c-sp">' + esc(t('h_5d')) + '</div>' + hs('mc', t('h_mc'), 1, 'c-mc') + hs('v', t('h_vol'), 1, 'c-v') + hs('pe', t('h_pe'), 1, 'c-pe') + '<div class="c-n">' + esc(t('h_nets')) + '</div><div class="c-b"></div></div>';
    var body = vis.map(function (r) {
      var a = chgAbs(r);
      var netsH = r.nets.slice(0, 4).map(function (k) { return ci(k, 18); }).join('') + (r.nets.length > 4 ? '<em>+' + (r.nets.length - 4) + '</em>' : '');
      return '<div class="gs-tr row" data-sym="' + esc(r.s) + '"><button type="button" class="gs-star' + (S.fav[r.s] ? ' on' : '') + '" data-fav="' + esc(r.s) + '" aria-label="★">' + (S.fav[r.s] ? ICO.star : ICO.starO) + '</button>'
        + '<div class="gs-nm">' + logo(r.s, 36, r.l) + '<div style="min-width:0"><div class="t">' + esc(r.n || r.s) + '</div><div class="n">' + esc(r.s) + '</div></div></div>'
        + '<div class="rt c-p num"><b>' + px(priceOf(r)) + '</b><small class="mchg ' + cls(r.c) + '" style="display:none;font-size:12px">' + pct(r.c) + '</small></div>'
        + '<div class="rt c-ca num ' + cls(a) + '">' + (a == null ? '<span class="gs-na">—</span>' : (a > 0 ? '+' : '') + nf(a, Math.abs(a) >= 1 ? 2 : 3) + ' $') + '</div>'
        + '<div class="rt c-c num ' + cls(r.c) + '" style="font-weight:700">' + pct(r.c) + '</div>'
        + '<div class="rt c-sp">' + sparkSvg(r.s, 96, 30) + '</div>'
        + '<div class="rt c-mc num">' + usdS(r.mc) + '</div>'
        + '<div class="rt c-v num">' + usdS(r.v) + '</div>'
        + '<div class="rt c-pe num">' + (r.pe ? nf(r.pe, 2) : '<span class="gs-na">—</span>') + '</div>'
        + '<div class="c-n"><div class="gs-nets">' + netsH + '</div></div>'
        + '<div class="rt c-b"><button type="button" class="gs-btn-buy" data-buy="' + esc(r.s) + '">' + esc(t('buy')) + '</button></div></div>';
    }).join('');
    tbl.innerHTML = head + (body || '<div class="gs-empty">' + esc(t('empty')) + '</div>');
    tbl.querySelectorAll('.gs-tr.h .s').forEach(function (h) {
      h.addEventListener('click', function () {
        var k = h.getAttribute('data-s');
        if (S.theme === 'gainers' || S.theme === 'losers') { S.theme = 'all'; root.querySelectorAll('#gsThemes button').forEach(function (x) { x.classList.toggle('on', x.getAttribute('data-th') === 'all'); }); }
        if (S.sort === k) S.dir = -S.dir; else { S.sort = k; S.dir = k === 'n' ? 1 : -1; }
        paintTable();
      });
    });
    tbl.querySelectorAll('.gs-tr.row').forEach(function (rw) {
      rw.addEventListener('click', function (e) {
        var f = e.target.closest('[data-fav]');
        if (f) { e.stopPropagation(); var s = f.getAttribute('data-fav'); if (S.fav[s]) delete S.fav[s]; else S.fav[s] = 1; saveFav(); paintTable(); return; }
        go(rw.getAttribute('data-sym'), !!e.target.closest('[data-buy]'));
      });
    });
    var pg = '';
    if (pages > 1) {
      var arr = [];
      for (var i = 1; i <= pages; i++) { if (i === 1 || i === pages || Math.abs(i - S.page) <= 1) arr.push(i); else if (arr[arr.length - 1] !== '…') arr.push('…'); }
      pg = '<button type="button" data-p="' + Math.max(1, S.page - 1) + '">‹</button>' + arr.map(function (x) { return x === '…' ? '<span>…</span>' : '<button type="button" data-p="' + x + '" class="' + (x === S.page ? 'on' : '') + '">' + x + '</button>'; }).join('') + '<button type="button" data-p="' + Math.min(pages, S.page + 1) + '">›</button>';
    }
    var pe = root.querySelector('#gsPager'); pe.innerHTML = pg;
    pe.querySelectorAll('button').forEach(function (b) {
      b.addEventListener('click', function () {
        S.page = +b.getAttribute('data-p'); paintTable();
        var th = root.querySelector('#gsThemes'); if (th) window.scrollTo({ top: th.getBoundingClientRect().top + window.scrollY - 90, behavior: 'smooth' });
      });
    });
    var need = vis.map(function (r) { return r.s; }).filter(function (s) { return !S.spark[s]; });
    if (need.length) loadSpark(need).then(function () {
      if (!root) return;
      root.querySelectorAll('[data-spark]').forEach(function (el) {
        var s = el.getAttribute('data-spark');
        if (S.spark[s]) el.outerHTML = sparkSvg(s, 96, 30);
      });
    });
  }
  /* Squarified treemap. */
  function squarify(items, x, y, w, h) {
    var out = [];
    var total = items.reduce(function (a, b) { return a + b.v; }, 0);
    if (!(total > 0)) return out;
    var scale = (w * h) / total;
    var rest = items.map(function (it) { return { it: it, a: it.v * scale }; });
    function worst(row, side) {
      var s = row.reduce(function (a, b) { return a + b.a; }, 0), mx = 0, mn = Infinity;
      row.forEach(function (r) { mx = Math.max(mx, r.a); mn = Math.min(mn, r.a); });
      return Math.max(side * side * mx / (s * s), (s * s) / (side * side * mn));
    }
    while (rest.length) {
      var side = Math.min(w, h), row = [rest[0]], i = 1;
      while (i < rest.length && worst(row.concat([rest[i]]), side) <= worst(row, side)) { row.push(rest[i]); i++; }
      rest = rest.slice(i);
      var s = row.reduce(function (a, b) { return a + b.a; }, 0);
      if (w >= h) {
        var cw = s / h, cy = y;
        row.forEach(function (r) { var rh = r.a / cw; out.push({ it: r.it, x: x, y: cy, w: cw, h: rh }); cy += rh; });
        x += cw; w -= cw;
      } else {
        var chh = s / w, cx = x;
        row.forEach(function (r) { var rw = r.a / chh; out.push({ it: r.it, x: cx, y: y, w: rw, h: chh }); cx += rw; });
        y += chh; h -= chh;
      }
    }
    return out;
  }
  function heatColor(c) {
    if (c == null) return 'rgb(70,78,92)';
    var k = Math.min(1, Math.abs(c) / 4);
    return c >= 0 ? 'rgb(' + Math.round(40 - 10 * k) + ',' + Math.round(110 + 60 * k) + ',' + Math.round(80 + 10 * k) + ')'
      : 'rgb(' + Math.round(150 + 70 * k) + ',' + Math.round(60 - 20 * k) + ',' + Math.round(75 - 15 * k) + ')';
  }
  function paintHeat() {
    var host = root && root.querySelector('#gsHeat'); if (!host) return;
    var W = host.clientWidth || 600, H = host.clientHeight || 300;
    var n = W < 520 ? 12 : 22;
    var items = (S.rows || []).filter(function (r) { return r.mc > 0 && priceOf(r) > 0; }).sort(function (a, b) { return b.mc - a.mc; }).slice(0, n)
      .map(function (r) { return { v: Math.sqrt(r.mc), r: r }; });
    var tip = host.querySelector('#gsTip');
    host.querySelectorAll('.gs-tile').forEach(function (e) { e.remove(); });
    squarify(items, 0, 0, W, H).forEach(function (b) {
      var r = b.it.r, d = document.createElement('div');
      d.className = 'gs-tile';
      d.style.cssText = 'left:' + b.x + 'px;top:' + b.y + 'px;width:' + b.w + 'px;height:' + b.h + 'px;background:' + heatColor(r.c);
      var big = b.w > 90 && b.h > 64;
      d.innerHTML = (b.w > 38 && b.h > 26 ? '<b>' + esc(r.s) + '</b>' : '') + (b.w > 52 && b.h > 42 ? '<span class="num">' + pct(r.c) + '</span>' : '') + (big ? '<em class="num">' + px(priceOf(r)) + '</em>' : '');
      d.addEventListener('click', function () { go(r.s); });
      d.addEventListener('mouseenter', function () {
        tip.innerHTML = '<b>' + esc(r.n || r.s) + ' · ' + esc(r.s) + '</b><div><span>' + esc(t('price')) + '</span><b class="num" style="margin:0;font-size:12px">' + px(priceOf(r)) + '</b></div>'
          + '<div><span>24h</span><span class="num ' + cls(r.c) + '">' + pct(r.c) + '</span></div><div><span>' + esc(t('h_mc')) + '</span><span class="num">' + usdS(r.mc) + '</span></div>'
          + '<div><span>' + esc(t('h_vol')) + '</span><span class="num">' + usdS(r.v) + '</span></div><div><span>' + esc(t('h_nets')) + '</span><span>' + r.nets.length + '</span></div>';
        tip.style.display = 'block';
        var lx = b.x + b.w / 2, ly = b.y + b.h / 2;
        tip.style.left = Math.max(4, Math.min(W - 200, lx - 95)) + 'px';
        tip.style.top = Math.max(4, Math.min(H - 150, ly + 12)) + 'px';
      });
      d.addEventListener('mouseleave', function () { tip.style.display = 'none'; });
      host.appendChild(d);
    });
  }

  /* ================= DETAIL ================= */
  function loadDetail(sym) {
    S.detailErr = false;
    return getJson(API + '/stocks/detail?sym=' + encodeURIComponent(sym), 25000).then(function (d) {
      if (!d || !Array.isArray(d.variants)) throw new Error('bad');
      if (S.detailSym === sym) { S.detail = d; S.liqTries = 0; if (!d.liquidityKnown) pollLiquidity(sym); }
      return d;
    }).catch(function () { if (S.detailSym === sym) S.detailErr = true; });
  }
  /* Pool liquidity is filled server-side in the background; pick it up without blocking the page. */
  function pollLiquidity(sym) {
    if ((S.liqTries || 0) >= 5) return;
    S.liqTries = (S.liqTries || 0) + 1;
    setTimeout(function () {
      if (S.detailSym !== sym) return;
      getJson(API + '/stocks/detail?sym=' + encodeURIComponent(sym), 20000).then(function (d) {
        if (S.detailSym !== sym || !d || !Array.isArray(d.variants)) return;
        if (!d.liquidityKnown) { pollLiquidity(sym); return; }
        S.detail = d;
        applyDetailUpdate(sym);
      }).catch(function () { pollLiquidity(sym); });
    }, 2500);
  }
  function applyDetailUpdate(sym) {
    var a = document.activeElement;
    if (a && root && root.contains(a) && a.tagName === 'INPUT') {
      a.addEventListener('blur', function once() { a.removeEventListener('blur', once); if (S.detailSym === sym) viewDetail(sym); });
      return;
    }
    var y = window.scrollY;
    if (S.tr.tokenAuto && !S.tr.amt) S.tr.token = null; /* default pay token follows the new best network */
    viewDetail(sym);
    window.scrollTo(0, y);
  }
  function refPx(d) { return d && d.ref && d.ref.price > 0 ? d.ref.price : 0; }
  function vkey(v) { return v.c + ':' + (v.c === 'solana' ? v.a : String(v.a).toLowerCase()); }
  function tradable(d) {
    var ref = refPx(d) || (d && d.f) || 0;
    return (d.variants || []).filter(function (v) {
      if (!(v.net === 'solana' || EVM_TRADE[v.c])) return false;
      if (v.k !== 'x' && ref > 0 && v.p > 0 && (v.p / ref < 0.85 || v.p / ref > 1.2)) return false;
      return true;
    });
  }
  function bestVariant(d, payKey) {
    var vs = tradable(d);
    if (payKey === 'solana') vs = vs.filter(function (v) { return v.net === 'solana'; });
    if (!vs.length) return null;
    var known = vs.some(function (v) { return v.liq != null; });
    vs = vs.slice().sort(function (a, b) {
      if (known) return (b.liq || 0) - (a.liq || 0);
      var pr = function (v) { return v.net === 'solana' ? 0 : (v.c === 1 ? 1 : 2); };
      return pr(a) - pr(b);
    });
    var best = vs[0];
    if (payKey) {
      /* Prefer the payer's own network when it has real liquidity — no bridge needed. */
      var same = vs.filter(function (v) { return v.net === payKey; })[0];
      if (same && same !== best && (!known || (same.liq || 0) >= 5000)) return same;
    }
    return best;
  }
  function destVariant(d) {
    var tr = S.tr;
    if (tr.side === 'sell') return sellVariant(d);
    if (tr.dest !== 'auto') {
      var v = tradable(d).filter(function (x) { return vkey(x) === tr.dest; })[0];
      if (v) return v;
    }
    return bestVariant(d, tr.token ? tr.token.netKey : null);
  }
  function sellVariant(d) {
    var held = tradable(d).filter(function (v) { return (S.varBal[vkey(v)] || 0) > 0; });
    if (!held.length) return null;
    var pick = held.filter(function (v) { return vkey(v) === S.tr.sellKey; })[0];
    return pick || held.sort(function (a, b) { return (S.varBal[vkey(b)] || 0) - (S.varBal[vkey(a)] || 0); })[0];
  }
  function viewDetail(sym) {
    var fresh = S.detailSym !== sym;
    if (fresh) {
      S.detailSym = sym; S.detail = null; S.varBal = {}; S.detailLoading = false; S.detailErr = false;
      S.tr = { side: 'buy', token: S.tr.token, amt: '', dest: 'auto', openNets: false, routeOpen: true, quote: null, quoting: false, qerr: null, seq: S.tr.seq + 1, solDest: S.tr.solDest, sellKey: '' };
    }
    root.classList.add('gs-detail');
    var row = S.bySym[sym] || null;
    if (!S.detail && !S.detailLoading && !S.detailErr) {
      S.detailLoading = true;
      loadDetail(sym).then(function () {
        S.detailLoading = false;
        if (S.detailSym === sym && hashSym() === sym) { if (S.detail) applyDetailUpdate(sym); else viewDetail(sym); }
      });
    }
    if (!S.detail && (!row || S.detailErr)) {
      root.innerHTML = '<div class="gs-crumb"><a data-back>' + esc(t('back')) + '</a><span>›</span><span>' + esc(row ? row.n : sym) + '</span></div>'
        + '<div class="gs-card gs-sec">' + (S.detailErr ? '<div class="gs-empty">' + esc(t('load_err')) + ' <button type="button" class="gs-ghost" data-retry>' + esc(t('retry')) + '</button></div>' : '<div class="gs-skel"></div><div class="gs-skel"></div><div class="gs-skel"></div>') + '</div>';
      bindBack();
      var rb = root.querySelector('[data-retry]'); if (rb) rb.addEventListener('click', function () { S.detailErr = false; viewDetail(sym); });
      if (!S.rows) loadList().then(function () { if (S.detailSym === sym && !S.detail && S.bySym[sym]) viewDetail(sym); });
      return;
    }
    /* Instant page from the list row; contract data and liquidity fill in when they arrive. */
    var d = S.detail || { variants: [], ref: null, liquidityKnown: false, _partial: true };
    var r = Object.assign({}, row || {}, d);
    var ref = refPx(d) || r.f || 0;
    var price = priceOf(r);
    var prem = ref > 0 && price > 0 ? (price / ref - 1) * 100 : null;
    var ss = session();
    var vs = (d.variants || []).slice().sort(function (a, b) { return (b.liq || 0) - (a.liq || 0); });
    var maxL = vs.reduce(function (m, v) { return Math.max(m, v.liq || 0); }, 0);
    var tradeSet = {}; tradable(d).forEach(function (v) { tradeSet[vkey(v)] = 1; });
    var best = bestVariant(d, null);
    var totalLiq = vs.reduce(function (m, v) { return m + (v.liq || 0); }, 0);
    var sim = (S.rows || []).filter(function (x) { return x.s !== r.s && r.k && x.k === r.k; }).sort(function (a, b) { return (b.mc || 0) - (a.mc || 0); }).slice(0, 6);
    var ntbl = '<div class="r h"><div>' + esc(t('w_net')) + '</div><div>' + esc(t('w_liq')) + '</div><div>' + esc(t('w_vol')) + '</div><div>' + esc(t('w_pools')) + '</div><div>' + esc(t('w_addr')) + '</div></div>'
      + vs.map(function (v) {
        var b;
        if (!(v.net === 'solana' || EVM_TRADE[v.c])) b = '<span class="gs-badge b-none">' + esc(t('b_soon')) + '</span>';
        else if (!tradeSet[vkey(v)]) b = '<span class="gs-badge b-none">' + esc(t('b_ratio')) + '</span>';
        else if (v.liq == null) b = '<span class="gs-badge b-none">' + esc(t('b_nodata')) + '</span>';
        else if (best && vkey(v) === vkey(best) && v.liq > 0) b = '<span class="gs-badge b-best">' + esc(t('b_best')) + '</span>';
        else if (v.liq >= 100000) b = '<span class="gs-badge b-mid">' + esc(t('b_deep')) + '</span>';
        else if (v.liq >= 5000) b = '<span class="gs-badge b-mid">' + esc(t('b_mid')) + '</span>';
        else if (v.liq > 0) b = '<span class="gs-badge b-low">' + esc(t('b_low')) + '</span>';
        else b = '<span class="gs-badge b-none">' + esc(t('b_none')) + '</span>';
        var w = v.liq && maxL ? Math.max(3, Math.round(v.liq / maxL * 100)) : 0;
        return '<div class="r"><div class="cn">' + ci(v.net, 22) + '<span style="min-width:0">' + esc((CH[v.net] || {}).name || v.net) + '<small>' + esc(v.s) + '</small></span></div>'
          + '<div><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><b class="num">' + (v.liq == null ? '—' : usdS(v.liq) === '—' ? '$0' : usdS(v.liq)) + '</b>' + b + '</div><div class="gs-bar"><i style="width:' + w + '%"></i></div></div>'
          + '<div class="num">' + (v.vol != null ? (usdS(v.vol) === '—' ? '$0' : usdS(v.vol)) : '—') + '</div><div class="num">' + (v.pools != null ? v.pools : '—') + '</div>'
          + '<div class="gs-addr"><span>' + esc(String(v.a).slice(0, 6) + '…' + String(v.a).slice(-4)) + '</span><button type="button" data-copy="' + esc(v.a) + '" title="Copy">' + ICO.copy + '</button></div></div>';
      }).join('');
    var versions = {};
    (d.variants || []).forEach(function (v) { (versions[v.s] = versions[v.s] || []).push((CH[v.net] || {}).name || v.net); });
    root.innerHTML = '<div class="gs-crumb"><a data-back>' + esc(t('back')) + '</a><span>›</span><span style="color:#dfe5ee">' + esc(r.n || r.s) + '</span></div>'
      + '<div class="gs-dgrid"><div class="gs-dtop">'
      + '<div class="gs-dhead">' + logo(r.s, 58, r.l) + '<div><div class="gs-ttl"><h1>' + esc(r.n || r.s) + '</h1><span class="gs-pill">' + esc(r.s) + '</span>' + (r.k ? '<span class="gs-pill">' + esc(t('c_' + r.k)) + '</span>' : '') + '<span class="gs-pill">' + esc(t('nets_n', { n: (r.nets || []).length })) + '</span></div>'
      + '<div class="gs-px"><b class="num">' + px(price) + '</b><span class="gs-chg num ' + cls(r.c) + '">' + pct(r.c) + ' 24h</span></div>'
      + '<div class="gs-ref">' + esc(t('ex_price')) + ': <b class="num">' + px(ref) + '</b>' + (prem != null ? ' · ' + esc(prem >= 0 ? t('premium') : t('discount')) + ' <b class="num">' + nf(Math.abs(prem), 2) + '%</b>' : '') + '</div></div>'
      + '<div class="gs-dacts"><button type="button" class="gs-ghost" data-fav1 aria-label="★">' + (S.fav[r.s] ? ICO.star.replace('<svg', '<svg width="15" height="15" style="color:#f5c84a"') : ICO.starO.replace('<svg', '<svg width="15" height="15"')) + '</button><button type="button" class="gs-ghost" data-share>' + ICO.share + esc(t('share')) + '</button></div></div>'
      + '<div class="gs-card gs-sec" id="gsChartCard"><div class="gs-chhead"><div class="gs-rng" id="gsRng">' + [['1d', '1D'], ['5d', '5D'], ['1mo', '1M']].map(function (x) { return '<button type="button" data-r="' + x[0] + '" class="' + (S.range === x[0] ? 'on' : '') + '">' + x[1] + '</button>'; }).join('') + '</div><span class="gs-mu" style="font-size:12px">' + esc(t('chart_ex')) + '</span></div>'
      + '<div class="gs-chart" id="gsChart"><div class="gs-ctip" id="gsCtip"></div></div>'
      + '<div class="gs-sess ' + (ss.open ? 'open' : '') + '">' + ICO.clock + '<span><b>' + esc(ss.label) + '.</b> ' + esc(t('sess_closed')) + '</span></div></div>'
      + '</div><div class="gs-aside"><div class="gs-card gs-tp" id="gsTrade"></div></div><div class="gs-drest">'
      + '<div class="gs-card gs-sec" id="gsWhere"><div class="gs-h2">' + esc(t('where_h')) + '</div><div class="gs-mu" style="font-size:12.5px;margin:-6px 0 12px;line-height:1.5">' + esc(t('where_sub')) + '</div><div class="gs-ntbl">' + (d._partial ? '<div class="gs-skel"></div><div class="gs-skel"></div><div class="gs-skel"></div>' : ntbl) + '</div></div>'
      + '<div class="gs-card gs-sec"><div class="gs-h2">' + esc(t('t_stats')) + '</div><div class="gs-stats">'
      + '<div><span>' + esc(t('s_onchain')) + '</span><b class="num">' + px(price) + '</b></div><div><span>' + esc(t('s_ex')) + '</span><b class="num">' + px(ref) + '</b></div>'
      + '<div><span>' + esc(t('s_prem')) + '</span><b class="num ' + cls(prem) + '">' + pct(prem) + '</b></div><div><span>' + esc(t('s_chg')) + '</span><b class="num ' + cls(r.c) + '">' + pct(r.c) + '</b></div>'
      + '<div><span>' + esc(t('s_mc')) + '</span><b class="num">' + usdS(r.mc) + '</b></div><div><span>' + esc(t('s_vol')) + '</span><b class="num">' + usdS(r.v) + '</b></div>'
      + '<div><span>' + esc(t('s_liq')) + '</span><b class="num">' + (d.liquidityKnown ? usdS(totalLiq) : '—') + '</b></div><div><span>' + esc(t('s_pe')) + '</span><b class="num">' + (r.pe ? nf(r.pe, 2) : '—') + '</b></div></div></div>'
      + '<div class="gs-card gs-sec"><div class="gs-h2">' + esc(t('how_h')) + '</div><div class="gs-how"><div><b><i>1</i>' + esc(t('how1')) + '</b><p>' + esc(t('how1p')) + '</p></div><div><b><i>2</i>' + esc(t('how2')) + '</b><p>' + esc(t('how2p')) + '</p></div><div><b><i>3</i>' + esc(t('how3')) + '</b><p>' + esc(t('how3p')) + '</p></div></div></div>'
      + '<div class="gs-card gs-sec" id="gsToken"><div class="gs-h2">' + esc(t('tok_h')) + '</div><div class="gs-kv"><div><span>' + esc(t('tok_what')) + '</span><b>' + esc(t('tok_what_v', { name: r.n || r.s })) + '</b></div>'
      + Object.keys(versions).map(function (s) { return '<div><span>' + esc(s) + '</span><b>' + esc(versions[s].join(', ')) + '</b></div>'; }).join('') + '</div></div>'
      + '<div class="gs-card gs-sec gs-faq" id="gsFaq"><div class="gs-h2">' + esc(t('faq_h')) + '</div>'
      + [1, 2, 3, 4, 5].map(function (i) { return '<details' + (i === 1 ? ' open' : '') + '><summary>' + esc(t('fq' + i)) + '</summary><p>' + esc(t('fa' + i, { name: r.n || r.s })) + '</p></details>'; }).join('') + '</div>'
      + (sim.length ? '<div class="gs-card gs-sec"><div class="gs-h2">' + esc(t('sim_h')) + '</div><div class="gs-sim">' + sim.map(function (x) {
        return '<div class="c" data-go="' + esc(x.s) + '">' + logo(x.s, 34, x.l) + '<div class="m"><b>' + esc(x.s) + '</b><small>' + esc(x.n) + '</small></div><div class="r num"><b>' + px(priceOf(x)) + '</b><div class="' + cls(x.c) + '">' + pct(x.c) + '</div></div></div>';
      }).join('') + '</div></div>' : '')
      + '</div></div>'
      + '<div class="gs-mbar"><button type="button" class="gs-cta b" style="margin:0" data-mb="buy">' + esc(t('tp_buy_x', { sym: r.s })) + '</button><button type="button" class="gs-cta s" style="margin:0" data-mb="sell">' + esc(t('sell')) + '</button></div>';
    bindBack();
    root.querySelectorAll('[data-go]').forEach(function (e) { e.addEventListener('click', function () { go(e.getAttribute('data-go')); }); });
    root.querySelectorAll('[data-copy]').forEach(function (b) {
      b.addEventListener('click', function (e) { e.stopPropagation(); try { navigator.clipboard.writeText(b.getAttribute('data-copy')); } catch (_) {} toast(t('copied')); });
    });
    root.querySelector('[data-fav1]').addEventListener('click', function () { if (S.fav[r.s]) delete S.fav[r.s]; else S.fav[r.s] = 1; saveFav(); viewDetail(r.s); });
    root.querySelector('[data-share]').addEventListener('click', function () {
      var url = location.origin + '/stocks?sym=' + encodeURIComponent(r.s) + '#xstocks';
      try { if (navigator.share) { navigator.share({ title: (r.n || r.s) + ' · GROM', url: url }).catch(function () {}); return; } } catch (_) {}
      try { navigator.clipboard.writeText(url); } catch (_) {}
      toast(t('link_copied'));
    });
    root.querySelectorAll('#gsRng button').forEach(function (b) {
      b.addEventListener('click', function () { S.range = b.getAttribute('data-r'); root.querySelectorAll('#gsRng button').forEach(function (x) { x.classList.toggle('on', x === b); }); drawChart(); });
    });
    root.querySelectorAll('[data-mb]').forEach(function (b) {
      b.addEventListener('click', function () { setSide(b.getAttribute('data-mb')); var tp = root.querySelector('#gsTrade'); if (tp) tp.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
    });
    drawChart();
    renderTrade();
    if (fresh) window.scrollTo(0, 0);
    if (S.pendingTrade) {
      S.pendingTrade = false;
      setTimeout(function () {
        var tp = root && root.querySelector('#gsTrade');
        if (tp && window.innerWidth <= 1020) tp.scrollIntoView({ behavior: 'smooth', block: 'start' });
        var i = root && root.querySelector('#gsAmt'); if (i && window.innerWidth > 1020) i.focus();
      }, 80);
    }
    if (connected() && !d._partial) refreshBalances(d);
  }
  function bindBack() {
    var b = root.querySelector('[data-back]');
    if (b) b.addEventListener('click', function () { go(''); });
  }

  /* ---------- chart ---------- */
  function drawChart() {
    var host = root && root.querySelector('#gsChart'); if (!host || !S.detailSym) return;
    var sym = S.detailSym, range = S.range, key = sym + '|' + range;
    var tip = host.querySelector('#gsCtip');
    host.querySelectorAll('svg,.gs-cmsg').forEach(function (e) { e.remove(); });
    var data = S.chart[key];
    if (!data) {
      host.insertAdjacentHTML('beforeend', '<div class="gs-cmsg">' + esc(t('chart_load')) + '</div>');
      getJson(API + '/xstocks/chart?symbol=' + encodeURIComponent(sym) + '&range=' + range, 15000)
        .then(function (j) { S.chart[key] = (j && Array.isArray(j.points)) ? j.points : []; })
        .catch(function () { S.chart[key] = []; })
        .then(function () { if (S.detailSym === sym && S.range === range) drawChart(); });
      return;
    }
    if (data.length < 2) { host.insertAdjacentHTML('beforeend', '<div class="gs-cmsg">' + esc(t('chart_none')) + '</div>'); return; }
    var W = host.clientWidth || 700, H = host.clientHeight || 300, padR = 60, padB = 24, padT = 10;
    var ys = data.map(function (q) { return q.c; }), mn = Math.min.apply(0, ys), mx = Math.max.apply(0, ys), rg = (mx - mn) || mx * 0.01;
    mn -= rg * 0.08; mx += rg * 0.08; rg = mx - mn;
    function X(i) { return i / (data.length - 1) * (W - padR); }
    function Y(v) { return padT + (1 - (v - mn) / rg) * (H - padT - padB); }
    var up = ys[ys.length - 1] >= ys[0], col = up ? '#22c55e' : '#f04c65';
    var line = data.map(function (q, i) { return (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(q.c).toFixed(1); }).join(' ');
    var area = line + ' L' + X(data.length - 1).toFixed(1) + ' ' + (H - padB) + ' L0 ' + (H - padB) + ' Z';
    var grid = '';
    for (var g = 0; g <= 4; g++) { var v = mn + rg * g / 4, y = Y(v); grid += '<line x1="0" x2="' + (W - padR) + '" y1="' + y + '" y2="' + y + '" stroke="rgba(200,212,232,.08)"/><text x="' + (W - padR + 8) + '" y="' + (y + 4) + '" fill="#8d98ab" font-size="11">' + nf(v, 2) + '</text>'; }
    var fmt = range === '1mo' ? { day: '2-digit', month: 'short' } : (range === '5d' ? { weekday: 'short', day: '2-digit' } : { hour: '2-digit', minute: '2-digit' });
    var xl = '', last = '';
    for (var k = 0; k < 6; k++) {
      var i = Math.round(k / 5 * (data.length - 1));
      var s = new Date(data[i].t).toLocaleString(loc(), fmt);
      if (s === last) continue; last = s;
      xl += '<text x="' + Math.min(Math.max(X(i), 20), W - padR - 20) + '" y="' + (H - 6) + '" fill="#8d98ab" font-size="11" text-anchor="middle">' + esc(s) + '</text>';
    }
    var gid = 'gsGa' + Date.now();
    host.insertAdjacentHTML('afterbegin', '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none"><defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + col + '" stop-opacity=".28"/><stop offset="1" stop-color="' + col + '" stop-opacity="0"/></linearGradient></defs>'
      + grid + xl + '<path d="' + area + '" fill="url(#' + gid + ')"/><path d="' + line + '" fill="none" stroke="' + col + '" stroke-width="2" stroke-linejoin="round"/>'
      + '<line class="vl" y1="' + padT + '" y2="' + (H - padB) + '" stroke="rgba(229,233,240,.35)" stroke-dasharray="3 3" style="display:none"/><circle class="vd" r="4.5" fill="' + col + '" stroke="#fff" stroke-width="2" style="display:none"/>'
      + '<rect class="hov" x="0" y="0" width="' + (W - padR) + '" height="' + H + '" fill="transparent"/></svg>');
    var svg = host.querySelector('svg'), hov = svg.querySelector('.hov'), vl = svg.querySelector('.vl'), vd = svg.querySelector('.vd');
    function mv(ev) {
      var b = host.getBoundingClientRect();
      var cx = (ev.touches ? ev.touches[0].clientX : ev.clientX) - b.left;
      var idx = Math.max(0, Math.min(data.length - 1, Math.round(cx / (b.width * (W - padR) / W) * (data.length - 1))));
      var x = X(idx), y = Y(data[idx].c);
      vl.setAttribute('x1', x); vl.setAttribute('x2', x); vl.style.display = ''; vd.setAttribute('cx', x); vd.setAttribute('cy', y); vd.style.display = '';
      tip.style.display = 'block';
      tip.style.left = Math.min(Math.max(x * b.width / W, 70), b.width - 70) + 'px';
      tip.style.top = Math.max(y * b.height / H, 48) + 'px';
      tip.innerHTML = '<b>' + px(data[idx].c) + '</b><span class="gs-mu">' + esc(new Date(data[idx].t).toLocaleString(loc(), { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })) + '</span>';
    }
    function out() { vl.style.display = 'none'; vd.style.display = 'none'; tip.style.display = 'none'; }
    hov.addEventListener('mousemove', mv); hov.addEventListener('touchmove', mv, { passive: true });
    hov.addEventListener('mouseleave', out); hov.addEventListener('touchend', out);
  }

  /* ---------- wallet data ---------- */
  function netKeyOf(chainId) { return chainId === 'solana' ? 'solana' : (KEY_BY_ID[String(chainId)] || String(chainId)); }
  function decorate(tok) { if (!tok) return null; tok.netKey = netKeyOf(tok.chainId); return tok; }
  function loadHoldings(force) {
    if (!connected() || typeof window.gwStocksHoldings !== 'function') return Promise.resolve([]);
    if (S.hold && !force && Date.now() - S.holdAt < 60000) return Promise.resolve(S.hold);
    return window.gwStocksHoldings().then(function (rows) {
      S.hold = (rows || []).map(decorate); S.holdAt = Date.now(); return S.hold;
    }).catch(function () { return S.hold || []; });
  }
  function popularTokens() {
    if (typeof window.gwStocksTokenRef !== 'function') return [];
    var chains = typeof window.gwStocksEvmChains === 'function' ? window.gwStocksEvmChains() : [];
    var syms = ['ETH', 'BNB', 'POL', 'AVAX', 'HYPE', 'MON', 'USDC', 'USDT', 'USDG', 'USDE', 'DAI', 'WBTC'];
    var out = [];
    chains.forEach(function (cid) {
      if (!KEY_BY_ID[String(cid)]) return;
      syms.forEach(function (s) { var r = window.gwStocksTokenRef(cid, s); if (r) out.push(decorate(r)); });
    });
    ['SOL', 'USDC', 'USDT'].forEach(function (s) { var r = window.gwStocksTokenRef('solana', s); if (r) out.push(decorate(r)); });
    return out;
  }
  function holdingOf(tok) {
    if (!tok || !S.hold) return null;
    return S.hold.filter(function (h) { return String(h.chainId) === String(tok.chainId) && String(h.address).toLowerCase() === String(tok.address).toLowerCase(); })[0] || null;
  }
  function refreshBalances(d) {
    var sym = S.detailSym;
    loadHoldings(false).then(function (rows) {
      if (S.detailSym !== sym) return;
      var tr = S.tr;
      if (!tr.token && rows && rows.length) tr.token = rows[0];
      if (!tr.token) tr.token = defaultPayToken();
      renderTrade();
    });
    if (typeof window.gwStocksVariantBalance !== 'function') return;
    var vs = tradable(d).slice(0, 14);
    Promise.all(vs.map(function (v) { return window.gwStocksVariantBalance(v).then(function (b) { return [vkey(v), Number(b) || 0]; }).catch(function () { return [vkey(v), 0]; }); }))
      .then(function (pairs) {
        if (S.detailSym !== sym) return;
        pairs.forEach(function (p) { S.varBal[p[0]] = p[1]; });
        if (S.tr.side === 'sell') renderTrade();
      });
  }
  function defaultPayToken() {
    var w = wallet();
    if (typeof window.gwStocksTokenRef !== 'function') return null;
    if (!w.evm && w.sol) return decorate(window.gwStocksTokenRef('solana', 'USDC'));
    /* USDC on the network where Auto buys, so the default route needs no bridge. */
    var best = S.detail ? bestVariant(S.detail, null) : null;
    var ref = best ? (best.net === 'solana' ? window.gwStocksTokenRef('solana', 'USDC') : window.gwStocksTokenRef(best.c, 'USDC')) : null;
    return decorate(ref || window.gwStocksTokenRef(42161, 'USDC') || window.gwStocksTokenRef(1, 'USDC'));
  }
  function defaultRecvToken(v) {
    if (!v || typeof window.gwStocksTokenRef !== 'function') return null;
    if (v.net === 'solana') return decorate(window.gwStocksTokenRef('solana', 'USDC'));
    return decorate(window.gwStocksTokenRef(v.c, 'USDC') || window.gwStocksTokenRef(v.c, 'USDT') || window.gwStocksTokenRef(42161, 'USDC'));
  }

  /* ---------- trade panel ---------- */
  function setSide(side) {
    var tr = S.tr;
    if (tr.side === side) return;
    tr.side = side; tr.amt = ''; tr.quote = null; tr.qerr = null; tr.openNets = false; tr.seq++;
    if (side === 'sell') tr.token = null;
    renderTrade();
  }
  function renderTrade() {
    var el = root && root.querySelector('#gsTrade'); if (!el) return;
    if (!S.detail) { el.innerHTML = '<div class="gs-skel" style="border-radius:12px"></div><div class="gs-skel" style="height:110px;border-radius:12px"></div><div class="gs-skel" style="height:110px;border-radius:12px"></div>'; return; }
    var d = S.detail, tr = S.tr, buy = tr.side === 'buy';
    var sym = S.detailSym;
    var v = destVariant(d);
    if (!buy && v && !tr.token) tr.token = defaultRecvToken(v);
    if (buy && !tr.token) { tr.token = defaultPayToken(); tr.tokenAuto = true; }
    var tok = tr.token;
    var h = holdingOf(tok);
    var payBox, recvBox, destHtml = '';
    if (buy) {
      payBox = '<div class="gs-box"><div class="lbl"><span>' + esc(t('tp_pay')) + '</span><span>' + (h ? esc(t('tp_bal')) + ': <span class="num">' + amtF(h.amt) + '</span> ' + esc(h.sym) : '') + '</span></div>'
        + '<div class="row"><input id="gsAmt" inputmode="decimal" placeholder="0" autocomplete="off" value="' + esc(tr.amt) + '">'
        + '<button type="button" class="gs-tokbtn" id="gsPayBtn">' + (tok ? tokc(tok, 28) + '<span class="tx">' + esc(tok.sym) + '<small>' + esc((CH[tok.netKey] || {}).name || '') + '</small></span>' : '<span class="tx">' + esc(t('tp_pick_tok')) + '</span>') + ICO.down + '</button></div>'
        + '<div class="usd"><span id="gsUsdIn">≈ $0</span></div>'
        + (h ? '<div class="gs-qk"><button type="button" data-q=".25">25%</button><button type="button" data-q=".5">50%</button><button type="button" data-q=".75">75%</button><button type="button" data-q="1">MAX</button></div>' : '') + '</div>';
      recvBox = '<div class="gs-box"><div class="lbl"><span>' + esc(t('tp_get')) + '</span><span class="num">1 ' + esc(sym) + ' ≈ ' + px(refPx(d) || priceOf(Object.assign({}, S.bySym[sym] || {}, d))) + '</span></div>'
        + '<div class="row"><div class="out num" id="gsOut">0</div><span class="gs-tokbtn" style="cursor:default">' + stockc(sym, v ? v.net : null, 28) + '<span class="tx">' + esc(sym) + '<small>' + esc(v ? ((CH[v.net] || {}).name || v.net) : '') + '</small></span></span></div>'
        + '<div class="usd"><span id="gsOutUsd">≈ $0</span><span id="gsVs"></span></div></div>';
      var an = bestVariant(d, tok ? tok.netKey : null);
      var manual = tr.dest !== 'auto' && v;
      destHtml = '<div class="gs-dest"><div class="lbl"><span>' + esc(t('tp_dest')) + '</span><span class="gs-mu">' + esc(t('tp_dest_sub')) + '</span></div><div class="gs-seg">'
        + '<button type="button" id="gsAuto" class="' + (manual ? '' : 'on') + '">' + (an ? ci(an.net, 22) : '') + '<span><b>' + esc(t('tp_auto')) + (an ? ' · ' + esc((CH[an.net] || {}).name || an.net) : '') + '</b><small>' + (an && an.liq ? esc(t('tp_liq', { v: usdS(an.liq) })) : esc(t('tp_best_route'))) + '</small></span></button>'
        + '<button type="button" id="gsManual" class="' + (manual ? 'on' : '') + '">' + (manual ? ci(v.net, 22) : '') + '<span><b>' + esc(manual ? ((CH[v.net] || {}).name || v.net) : t('tp_pick')) + '</b><small>' + esc(manual ? (v.liq != null ? t('tp_liq', { v: usdS(v.liq) === '—' ? '$0' : usdS(v.liq) }) : v.s) : t('tp_manual')) + '</small></span></button></div>';
      if (tr.openNets) {
        var tv = tradable(d), mx = tv.reduce(function (m, x) { return Math.max(m, x.liq || 0); }, 0);
        destHtml += '<div class="gs-netlist">' + tv.slice().sort(function (a, b) { return (b.liq || 0) - (a.liq || 0); }).map(function (x) {
          var w = x.liq && mx ? Math.max(3, Math.round(x.liq / mx * 100)) : 0;
          return '<button type="button" data-net="' + esc(vkey(x)) + '" class="' + (manual && vkey(x) === vkey(v) ? 'on' : '') + '">' + ci(x.net, 22)
            + '<span style="min-width:0"><b>' + esc((CH[x.net] || {}).name || x.net) + '</b> <span class="gs-mu" style="font-size:11px">' + esc(x.s) + '</span><div class="gs-bar" style="max-width:none"><i style="width:' + w + '%"></i></div></span>'
            + '<span class="num gs-mu">' + (x.liq == null ? '—' : (usdS(x.liq) === '—' ? '$0' : usdS(x.liq))) + '</span></button>';
        }).join('') + '</div>';
      }
      destHtml += '</div>';
    } else {
      var held = tradable(d).filter(function (x) { return (S.varBal[vkey(x)] || 0) > 0; });
      var bal = v ? (S.varBal[vkey(v)] || 0) : 0;
      payBox = '<div class="gs-box"><div class="lbl"><span>' + esc(t('tp_sell')) + '</span><span>' + (v ? esc(t('tp_bal')) + ': <span class="num">' + amtF(bal) + '</span> ' + esc(v.s) : '') + '</span></div>'
        + '<div class="row"><input id="gsAmt" inputmode="decimal" placeholder="0" autocomplete="off" value="' + esc(tr.amt) + '"' + (v ? '' : ' disabled') + '>'
        + '<span class="gs-tokbtn" style="cursor:default">' + stockc(sym, v ? v.net : null, 28) + '<span class="tx">' + esc(sym) + '<small>' + esc(v ? ((CH[v.net] || {}).name || v.net) : '') + '</small></span></span></div>'
        + '<div class="usd"><span id="gsUsdIn">≈ $0</span></div>'
        + (v ? '<div class="gs-qk"><button type="button" data-q=".25">25%</button><button type="button" data-q=".5">50%</button><button type="button" data-q=".75">75%</button><button type="button" data-q="1">MAX</button></div>' : '') + '</div>';
      if (held.length > 1) {
        destHtml = '<div class="gs-dest"><div class="lbl"><span>' + esc(t('tp_dest')) + '</span></div><div class="gs-netlist">' + held.map(function (x) {
          return '<button type="button" data-sellnet="' + esc(vkey(x)) + '" class="' + (v && vkey(x) === vkey(v) ? 'on' : '') + '">' + ci(x.net, 22) + '<span><b>' + esc((CH[x.net] || {}).name || x.net) + '</b></span><span class="num gs-mu">' + amtF(S.varBal[vkey(x)]) + '</span></button>';
        }).join('') + '</div></div>';
      }
      recvBox = '<div class="gs-box"><div class="lbl"><span>' + esc(t('tp_get')) + '</span></div>'
        + '<div class="row"><div class="out num" id="gsOut">0</div><button type="button" class="gs-tokbtn" id="gsRecvBtn">' + (tok ? tokc(tok, 28) + '<span class="tx">' + esc(tok.sym) + '<small>' + esc((CH[tok.netKey] || {}).name || '') + '</small></span>' : '<span class="tx">' + esc(t('tp_pick_tok')) + '</span>') + ICO.down + '</button></div>'
        + '<div class="usd"><span id="gsOutUsd">≈ $0</span><span id="gsVs"></span></div></div>';
    }
    el.innerHTML = '<div class="gs-side"><button type="button" class="b ' + (buy ? 'on' : '') + '" data-side="buy">' + esc(t('buy')) + '</button><button type="button" class="s ' + (!buy ? 'on' : '') + '" data-side="sell">' + esc(t('sell')) + '</button></div>'
      + payBox + '<div class="gs-flip"><span>' + ICO.arrow + '</span></div>' + recvBox + destHtml
      + '<div id="gsRecvAddr"></div><div class="gs-route" id="gsRoute" style="display:none"></div><div id="gsWarn"></div><button type="button" class="gs-cta" id="gsCta"></button>'
      + '<div class="gs-fine">' + esc(t('tp_fine')) + '</div>';
    el.querySelectorAll('[data-side]').forEach(function (b) { b.addEventListener('click', function () { setSide(b.getAttribute('data-side')); }); });
    var inp = el.querySelector('#gsAmt');
    if (inp) inp.addEventListener('input', function () {
      var val = inp.value.replace(',', '.').replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
      if (val !== inp.value) inp.value = val;
      tr.amt = val; scheduleQuote();
    });
    el.querySelectorAll('[data-q]').forEach(function (b) {
      b.addEventListener('click', function () {
        var max = buy ? (h ? h.amt : 0) : (v ? (S.varBal[vkey(v)] || 0) : 0);
        var f = parseFloat(b.getAttribute('data-q'));
        var val = max * f;
        if (buy && h && h.isNative && f === 1) val = Math.max(0, val * 0.97); /* keep gas */
        tr.amt = val > 0 ? String(+val.toFixed(8)) : '';
        if (inp) inp.value = tr.amt;
        scheduleQuote(true);
      });
    });
    var pb = el.querySelector('#gsPayBtn'); if (pb) pb.addEventListener('click', function () { openPicker('pay'); });
    var rb = el.querySelector('#gsRecvBtn'); if (rb) rb.addEventListener('click', function () { openPicker('recv'); });
    var ab = el.querySelector('#gsAuto'); if (ab) ab.addEventListener('click', function () { tr.dest = 'auto'; tr.openNets = false; tr.quote = null; renderTrade(); scheduleQuote(true); });
    var mb = el.querySelector('#gsManual'); if (mb) mb.addEventListener('click', function () { tr.openNets = !tr.openNets; renderTrade(); });
    el.querySelectorAll('[data-net]').forEach(function (b) {
      b.addEventListener('click', function () { tr.dest = b.getAttribute('data-net'); tr.openNets = false; tr.quote = null; renderTrade(); scheduleQuote(true); });
    });
    el.querySelectorAll('[data-sellnet]').forEach(function (b) {
      b.addEventListener('click', function () { tr.sellKey = b.getAttribute('data-sellnet'); tr.token = null; tr.quote = null; renderTrade(); scheduleQuote(true); });
    });
    paintTradeState();
  }
  function needSolDest(v, tok) {
    if (!v || !tok) return false;
    var stockSol = v.net === 'solana';
    var tokSol = tok.netKey === 'solana';
    return S.tr.side === 'buy' ? (stockSol && !tokSol) : (tokSol && !stockSol);
  }
  function paintTradeState() {
    var el = root && root.querySelector('#gsTrade'); if (!el || !S.detail) return;
    var d = S.detail, tr = S.tr, buy = tr.side === 'buy', sym = S.detailSym;
    var v = destVariant(d), tok = tr.token, q = tr.quote;
    var amt = parseFloat(tr.amt) || 0;
    var h = holdingOf(tok);
    var ref = refPx(d);
    var usdIn = buy ? (q && q.amountInUsd > 0 ? q.amountInUsd : (h && h.priceUsd > 0 ? amt * h.priceUsd : 0)) : amt * (ref || 0);
    var ui = el.querySelector('#gsUsdIn'); if (ui) ui.textContent = '≈ ' + (usdIn > 0 ? '$' + nf(usdIn, 2) : '$0');
    var outEl = el.querySelector('#gsOut'), outUsd = el.querySelector('#gsOutUsd'), vsEl = el.querySelector('#gsVs');
    var outTokens = q ? Number(q.toAmount) / Math.pow(10, Number(q.outDecimals) || 18) : 0;
    if (outEl) outEl.textContent = q && amt > 0 ? amtF(outTokens) : '0';
    if (outUsd) outUsd.textContent = q && amt > 0 ? '≈ $' + nf(buy ? (q.amountOutUsdEquity || q.amountOutUsd || 0) : (q.amountOutUsd || 0), 2) : '≈ $0';
    if (vsEl) {
      var imp = q && isFinite(q.priceImpact) ? -q.priceImpact * 100 : null;
      vsEl.className = imp != null && imp < -1.5 ? 'gs-dn' : 'gs-mu';
      vsEl.textContent = imp != null && amt > 0 ? pct(imp) : '';
    }
    /* receive address */
    var ra = el.querySelector('#gsRecvAddr');
    if (needSolDest(v, tok)) {
      var w = wallet();
      var dest = tr.solDest || w.solDest || '';
      ra.innerHTML = '<div class="gs-recv"><div class="hd">' + ci('solana', 18) + '<b>' + esc(t('tp_soldest')) + '</b></div><input id="gsSolDest" spellcheck="false" autocomplete="off" placeholder="' + esc(t('tp_soldest_ph')) + '" value="' + esc(dest) + '">'
        + (!w.sol ? '<div class="row2"><button type="button" id="gsPhantom">' + esc(t('tp_phantom')) + '</button></div>' : '') + '</div>';
      var si = ra.querySelector('#gsSolDest');
      si.addEventListener('input', function () { tr.solDest = si.value.trim(); scheduleQuote(); });
      var ph = ra.querySelector('#gsPhantom');
      if (ph) ph.addEventListener('click', function () {
        if (typeof window.connectPhantomWallet !== 'function') return;
        window.connectPhantomWallet().then(function (pk) { if (pk) { tr.solDest = pk; renderTrade(); scheduleQuote(true); } }).catch(function () {});
      });
    } else ra.innerHTML = '';
    /* route */
    var ro = el.querySelector('#gsRoute');
    if (q && amt > 0 && !tr.qerr) {
      ro.style.display = '';
      var from = buy ? tok : null;
      var steps = q._steps && q._steps.length ? q._steps.length : (q._crossChain ? 2 : 1);
      var path = [];
      if (buy) {
        path.push('<span class="nd">' + tokc(from, 20) + esc(from.sym) + '</span>');
        if (q._crossChain) path.push('<span class="ar">→ ' + esc(q.tool || 'LI.FI') + ' →</span>'); else path.push('<span class="ar">→</span>');
        path.push('<span class="nd">' + stockc(sym, v.net, 20) + esc(sym) + '</span>');
      } else {
        path.push('<span class="nd">' + stockc(sym, v.net, 20) + esc(sym) + '</span>');
        if (q._crossChain) path.push('<span class="ar">→ ' + esc(q.tool || 'LI.FI') + ' →</span>'); else path.push('<span class="ar">→</span>');
        path.push('<span class="nd">' + tokc(tok, 20) + esc(tok.sym) + '</span>');
      }
      var dur = q._durationSec > 0 ? (q._durationSec < 90 ? '≈ ' + Math.max(5, Math.round(q._durationSec)) + 's' : '≈ ' + Math.round(q._durationSec / 60) + ' min') : (q.aggregator === 'Jupiter' ? '≈ 10s' : '—');
      var minOut = null;
      if (q.raw && q.raw.estimate && q.raw.estimate.toAmountMin) minOut = Number(q.raw.estimate.toAmountMin) / Math.pow(10, Number(q.outDecimals) || 18);
      else if (q._solQuote && q._solQuote.otherAmountThreshold) minOut = Number(q._solQuote.otherAmountThreshold) / Math.pow(10, Number(q.outDecimals) || 18);
      var rate = buy && outTokens > 0 && q.amountInUsd > 0 ? q.amountInUsd / outTokens : (!buy && amt > 0 && q.amountOutUsd > 0 ? q.amountOutUsd / amt : 0);
      ro.innerHTML = '<div class="rh" id="gsRh">' + ICO.info.replace('<svg', '<svg width="15" height="15" style="opacity:.7"') + esc(t('tp_route')) + ' · ' + esc(steps > 1 ? t('tp_steps', { n: steps }) : t('tp_step')) + ' · ' + esc(dur) + '<span class="r">' + (tr.routeOpen ? '–' : '+') + '</span></div>'
        + (tr.routeOpen ? '<div class="gs-path">' + path.join('') + '</div><div class="gs-kv">'
          + '<div><span>' + esc(t('tp_rate')) + '</span><b class="num">1 ' + esc(sym) + ' = ' + px(rate) + '</b></div>'
          + '<div><span>' + esc(t('tp_vs')) + '</span><b class="num ' + (q.priceImpact > 0.015 ? 'gs-dn' : '') + '">' + (isFinite(q.priceImpact) ? pct(-q.priceImpact * 100) : '—') + '</b></div>'
          + '<div><span>' + esc(t('tp_fees')) + '</span><b class="num">' + (q.gasUsd > 0 ? '≈ $' + nf(q.gasUsd, 2) : '—') + '</b></div>'
          + '<div><span>' + esc(t('tp_grom')) + '</span><b class="num">' + nf((Number(q._gromFeeBps) || 0) / 100, 2) + '%</b></div>'
          + (minOut ? '<div><span>' + esc(t('tp_min')) + '</span><b class="num">' + amtF(minOut) + ' ' + esc(buy ? (v.s || sym) : tok.sym) + '</b></div>' : '')
          + '<div><span>' + esc(t('tp_via')) + '</span><b>' + esc(q.tool || q.aggregator || '') + '</b></div></div>' : '');
      ro.querySelector('#gsRh').addEventListener('click', function () { tr.routeOpen = !tr.routeOpen; paintTradeState(); });
    } else { ro.style.display = 'none'; ro.innerHTML = ''; }
    /* warnings */
    var warn = '', wl = el.querySelector('#gsWarn');
    var netName = v ? ((CH[v.net] || {}).name || v.net) : '';
    if (!buy && !v && connected()) warn = '<div class="gs-warn y">' + ICO.info + '<span>' + esc(t('tp_nohold', { sym: sym })) + '</span></div>';
    else if (buy && v && tr.dest !== 'auto' && v.liq != null && v.liq < 2000) warn = '<div class="gs-warn y">' + ICO.info + '<span>' + esc(t('tp_lowliq', { sym: sym, net: netName })) + '</span></div>';
    if (tr.qerr) {
      var code = tr.qerr.code || '';
      var cross = tok && v && tok.netKey !== v.net;
      var msg = code === 'cross_unavailable' || (code === 'no_route' && cross) ? t('tp_cross', { net: netName })
        : code === 'no_route' ? t('tp_no_route', { net: netName }) : code === 'rate_limited' ? t('tp_rate_lim')
        : code === 'pay_evm_required' ? (v && v.net === 'solana' ? t('tp_cross', { net: netName }) : t('tp_pay_evm', { net: netName }))
        : code === 'sol_dest' ? t('tp_need_sol') : (tr.qerr.message || t('tp_no_route', { net: netName }));
      warn += '<div class="gs-warn y">' + ICO.info + '<span>' + esc(msg)
        + (cross && v ? '<br><button type="button" class="gs-ghost" style="margin-top:8px" data-pick-net="' + esc(v.net) + '">' + esc(t('tp_pick_on', { net: netName })) + '</button>' : '') + '</span></div>';
    } else if (q && q.impactBlocked && amt > 0) {
      var rs = q.impactBlockReason || '';
      var bm = rs === 'missing_fair_value' || rs === 'missing_share_multiplier' ? t('g_fair') : rs === 'share_ratio_unknown' ? t('g_ratio') : rs === 'missing_input_value' ? t('g_input') : rs === 'missing_output_value' ? t('g_output') : t('g_impact', { n: nf((q.priceImpact || 0) * 100, 1) });
      warn += '<div class="gs-warn r">' + ICO.shield + '<span>' + esc(bm) + '</span></div>';
    } else if (q && amt > 0 && buy && tr.dest === 'auto' && tok && v && tok.netKey !== v.net) {
      warn += '<div class="gs-warn g">' + ICO.shield + '<span>' + esc(t('tp_auto_note', { net: netName, liq: v.liq ? usdS(v.liq) : '—', from: (CH[tok.netKey] || {}).name || tok.netKey })) + '</span></div>';
    }
    wl.innerHTML = warn;
    var pn = wl.querySelector('[data-pick-net]');
    if (pn) pn.addEventListener('click', function () { openPicker(tr.side === 'buy' ? 'pay' : 'recv', pn.getAttribute('data-pick-net')); });
    /* CTA */
    var c = el.querySelector('#gsCta');
    var cta = function (cl, text, dis, fn) { c.className = 'gs-cta ' + cl; c.textContent = text; c.disabled = !!dis; c.onclick = fn || null; };
    if (!connected()) cta('c', t('tp_connect'), false, function () { if (typeof window.openConnectModal === 'function') window.openConnectModal(); });
    else if (!buy && !v) cta('s', t('tp_sell_x', { sym: sym }), true);
    else if (!(amt > 0)) cta(buy ? 'b' : 's', t('tp_enter'), true);
    else if (tr.quoting) cta(buy ? 'b' : 's', t('tp_quoting'), true);
    else if (!q || tr.qerr || q.impactBlocked) cta(buy ? 'b' : 's', buy ? t('tp_buy_x', { sym: sym }) : t('tp_sell_x', { sym: sym }), true);
    else cta(buy ? 'b' : 's', (buy ? t('tp_buy_x', { sym: amtF(outTokens) + ' ' + sym }) : t('tp_sell_x', { sym: amtF(amt) + ' ' + sym })), false, function () { execute(q); });
  }
  function scheduleQuote(now) {
    var tr = S.tr;
    tr.quote = null; tr.qerr = null;
    clearTimeout(timers.quote);
    var amt = parseFloat(tr.amt) || 0;
    if (!(amt > 0) || !S.detail || !connected()) { tr.quoting = false; paintTradeState(); return; }
    tr.quoting = true; paintTradeState();
    timers.quote = setTimeout(runQuote, now ? 50 : 650);
  }
  function runQuote() {
    var tr = S.tr, d = S.detail; if (!d) return;
    var seq = ++tr.seq;
    var v = destVariant(d), tok = tr.token;
    var amt = parseFloat(tr.amt) || 0;
    if (!v || !tok || !(amt > 0) || typeof window.gwStocksQuote !== 'function') { tr.quoting = false; paintTradeState(); return; }
    var h = holdingOf(tok);
    var w = wallet();
    var solDest = tr.solDest || w.solDest || '';
    var p = Promise.resolve().then(function () {
      return window.gwStocksQuote({
        side: tr.side, token: tok, amount: amt, tokenPriceUsd: h && h.priceUsd > 0 ? h.priceUsd : (/^USD/.test(tok.sym) ? 1 : 0),
        variant: v, refPrice: refPx(d), solMultiplier: d.ref ? d.ref.solMultiplier : null, solDest: solDest,
      });
    });
    p.then(function (q) {
      if (seq !== tr.seq) return;
      tr.quote = q; tr.qerr = null;
    }).catch(function (e) {
      if (seq !== tr.seq) return;
      tr.quote = null; tr.qerr = { code: e && e.code, message: e && e.message };
      if (e && e.code === 'rate_limited') setTimeout(function () { if (seq === tr.seq) scheduleQuote(true); }, 6000);
    }).finally(function () {
      if (seq !== tr.seq) return;
      tr.quoting = false; paintTradeState();
    });
  }

  /* ---------- token picker ---------- */
  function openPicker(mode, initialNet) {
    closeOverlay();
    var nets = ['all'];
    var curNet = initialNet || 'all', qq = '';
    var ov = document.createElement('div'); ov.className = 'gs-ov'; ov.id = 'gsOv';
    ov.innerHTML = '<div class="gs-mdl" role="dialog" aria-modal="true"><div class="mh">' + esc(mode === 'pay' ? t('pk_title_pay') : t('pk_title_get')) + '<button type="button" class="x" data-x>' + ICO.x + '</button></div>'
      + '<div class="mb"><label class="gs-search">' + ICO.search + '<input id="gsPkQ" autocomplete="off" placeholder="' + esc(t('pk_search')) + '"></label><div class="chs" id="gsPkChs"></div><div class="tl" id="gsPkList"></div></div></div>';
    document.body.appendChild(ov);
    ov.addEventListener('error', onImgError, true);
    var destNet = (destVariant(S.detail) || {}).net || '';
    var pop = popularTokens().sort(function (a, b) { return (b.netKey === destNet ? 1 : 0) - (a.netKey === destNet ? 1 : 0); });
    var stockNet = mode === 'recv' ? destNet : null;
    function allowed(tk) {
      /* Sells settle on the stock's own network (cross-network routes are not available yet). */
      if (mode === 'recv' && stockNet) return tk.netKey === stockNet;
      return true;
    }
    function listAll() {
      var mine = (S.hold || []).filter(allowed);
      var seen = {};
      mine.forEach(function (m) { seen[m.chainId + ':' + String(m.address).toLowerCase()] = 1; });
      var others = pop.filter(function (p) { return allowed(p) && !seen[p.chainId + ':' + String(p.address).toLowerCase()]; });
      return { mine: mine, others: others };
    }
    var all = listAll();
    (all.mine.concat(all.others)).forEach(function (tk) { if (nets.indexOf(tk.netKey) < 0) nets.push(tk.netKey); });
    if (nets.indexOf(curNet) < 0) curNet = 'all';
    function chs() {
      var el = ov.querySelector('#gsPkChs');
      el.innerHTML = nets.map(function (n) { return '<button type="button" data-n="' + esc(n) + '" class="' + (curNet === n ? 'on' : '') + '">' + (n === 'all' ? esc(t('all_nets')) : ci(n, 16) + esc((CH[n] || {}).name || n)) + '</button>'; }).join('');
      el.querySelectorAll('button').forEach(function (b) { b.addEventListener('click', function () { curNet = b.getAttribute('data-n'); chs(); list(); }); });
    }
    function ok(tk) {
      if (curNet !== 'all' && tk.netKey !== curNet) return false;
      if (!qq) return true;
      return tk.sym.toLowerCase().indexOf(qq) >= 0 || ((CH[tk.netKey] || {}).name || '').toLowerCase().indexOf(qq) >= 0;
    }
    function item(tk, held) {
      return '<button type="button" data-k="' + esc(tk.chainId + ':' + tk.address) + '">' + tokc(tk, 34) + '<span><span class="t">' + esc(tk.sym) + '</span><div class="n">' + esc((CH[tk.netKey] || {}).name || tk.netKey) + '</div></span>'
        + '<span class="r">' + (held ? '<b class="num">' + amtF(held.amt) + '</b><small class="num">' + (held.usd > 0 ? '$' + nf(held.usd, 2) : '') + '</small>' : '') + '</span></button>';
    }
    function list() {
      var h = '';
      var mine = all.mine.filter(ok), others = all.others.filter(ok);
      if (mine.length) h += '<div class="gh">' + esc(t('pk_mine')) + '</div>' + mine.map(function (m) { return item(m, m); }).join('');
      if (others.length) h += '<div class="gh">' + esc(t('pk_pop')) + '</div>' + others.map(function (p) { return item(p, null); }).join('');
      h += '<div class="gs-mu" style="font-size:12px;padding:12px 6px 2px;color:#9aa6b9">' + esc(t('pk_more')) + '</div>';
      var el = ov.querySelector('#gsPkList'); el.innerHTML = h;
      el.querySelectorAll('[data-k]').forEach(function (b) {
        b.addEventListener('click', function () {
          var k = b.getAttribute('data-k');
          var pick = all.mine.concat(all.others).filter(function (tk) { return (tk.chainId + ':' + tk.address) === k; })[0];
          if (pick) { S.tr.token = pick; S.tr.tokenAuto = false; S.tr.quote = null; }
          closeOverlay(); renderTrade(); scheduleQuote(true);
        });
      });
    }
    ov.querySelector('[data-x]').addEventListener('click', closeOverlay);
    ov.addEventListener('click', function (e) { if (e.target === ov) closeOverlay(); });
    var qi = ov.querySelector('#gsPkQ'); qi.addEventListener('input', function () { qq = qi.value.trim().toLowerCase(); list(); });
    chs(); list();
    if (connected() && !S.hold) loadHoldings(true).then(function () { all = listAll(); list(); });
    setTimeout(function () { if (window.innerWidth > 760) qi.focus(); }, 30);
  }
  function closeOverlay() { var o = document.getElementById('gsOv'); if (o) o.remove(); }
  function onKey(e) { if (e.key === 'Escape') closeOverlay(); }

  /* ---------- execution ---------- */
  function execute(q) {
    if (!q || typeof window.gwStocksExecute !== 'function') return;
    var tr = S.tr, d = S.detail, v = destVariant(d), sym = S.detailSym, buy = tr.side === 'buy';
    var tok = tr.token;
    var outTokens = Number(q.toAmount) / Math.pow(10, Number(q.outDecimals) || 18);
    closeOverlay();
    var ov = document.createElement('div'); ov.className = 'gs-ov'; ov.id = 'gsOv';
    var netName = (CH[v.net] || {}).name || v.net;
    ov.innerHTML = '<div class="gs-mdl" role="dialog" aria-modal="true"><div class="mh">' + esc(buy ? t('tp_buy_x', { sym: sym }) : t('tp_sell_x', { sym: sym })) + '<button type="button" class="x" data-x>' + ICO.x + '</button></div>'
      + '<div class="mb"><div class="steps" id="gsSteps"><div class="run" data-st="1"><i></i><span>' + esc(t('x_confirm')) + '<small>' + esc(t('x_confirm_sub')) + '</small></span></div></div>'
      + '<button type="button" class="gs-cta" id="gsXDone" disabled>' + esc(t('tp_quoting')) + '</button></div></div>';
    document.body.appendChild(ov);
    var steps = ov.querySelector('#gsSteps'), done = ov.querySelector('#gsXDone');
    function finish(label) { done.disabled = false; done.textContent = label || t('x_close'); done.onclick = function () { closeOverlay(); }; }
    ov.querySelector('[data-x]').addEventListener('click', closeOverlay);
    window.gwStocksExecute(q, { tokenPriceUsd: (holdingOf(tok) || {}).priceUsd || 0 }).then(function (res) {
      var s1 = steps.querySelector('[data-st="1"]'); s1.className = 'ok';
      var link = '';
      if (res && res.signature) link = 'https://solscan.io/tx/' + encodeURIComponent(res.signature);
      else if (res && res.hash) link = res.crossChain ? 'https://scan.li.fi/tx/' + encodeURIComponent(res.hash) : ((EXPLORER[res.chainId] || '') ? EXPLORER[res.chainId] + encodeURIComponent(res.hash) : '');
      var html = '<div class="ok"><i></i><span>' + esc(t('x_sent')) + (link ? '<small><a href="' + esc(link) + '" target="_blank" rel="noopener">' + esc(t('x_view')) + '</a></small>' : '') + '</span></div>';
      if (res && res.crossChain) {
        var mins = q._durationSec > 0 ? Math.max(1, Math.round(q._durationSec / 60)) + ' min' : '1–5 min';
        html += '<div class="run"><i></i><span>' + esc(t('x_bridge', { net: buy ? netName : ((CH[tok.netKey] || {}).name || '') })) + '<small>' + esc(t('x_bridge_sub', { t: mins })) + '</small></span></div>';
      } else {
        html += '<div class="ok"><i></i><span>' + esc(t('x_done')) + '<small>' + esc(t('x_done_sub', { amt: amtF(buy ? outTokens : outTokens), sym: buy ? sym : tok.sym })) + '</small></span></div>';
      }
      steps.insertAdjacentHTML('beforeend', html);
      finish(t('x_close'));
      tr.amt = ''; tr.quote = null; S.hold = null;
      setTimeout(function () { if (S.detail) { refreshBalances(S.detail); renderTrade(); } }, 1500);
    }).catch(function (e) {
      var s1 = steps.querySelector('[data-st="1"]'); s1.className = 'err';
      s1.querySelector('span').innerHTML = esc(t('x_fail')) + '<small>' + esc(String((e && e.message) || e || '').slice(0, 220)) + '</small>';
      finish(t('x_close'));
      scheduleQuote(true);
    });
  }

  /* ---------- mount ---------- */
  function ensureCss() {
    if (document.getElementById('grom-stocks-style')) return;
    var l = document.createElement('link'); l.id = 'grom-stocks-style'; l.rel = 'stylesheet'; l.href = '/grom-stocks.css';
    document.head.appendChild(l);
  }
  var bound = false;
  function bindGlobal() {
    if (bound) return; bound = true;
    ['grom:wallet-connected', 'grom:wallet-disconnected'].forEach(function (ev) {
      window.addEventListener(ev, function () {
        S.hold = null; S.varBal = {};
        if (S.tr.side === 'buy') S.tr.token = null;
        if (S.detail && isActive()) { renderTrade(); if (connected()) refreshBalances(S.detail); }
      });
    });
    window.addEventListener('grom:lang-change', function () { if (isActive()) render(); });
    window.addEventListener('popstate', function () { if (root && isActive()) render(); });
    document.addEventListener('keydown', onKey);
    var rz = 0;
    window.addEventListener('resize', function () {
      clearTimeout(rz);
      rz = setTimeout(function () {
        if (!isActive()) return;
        if (S.detailSym) drawChart(); else paintHeat();
      }, 150);
    });
    setInterval(function () {
      if (!isActive() || document.visibilityState === 'hidden') return;
      loadIndices().then(function () {
        var s = root && root.querySelector('.gs-strip');
        if (s) s.outerHTML = stripHtml();
      });
      if (!S.detailSym) loadList(true).then(function () {
        if (S.detailSym || !isActive() || !root) return;
        /* First prices can arrive after the cold start — rebuild the whole list once they do. */
        if (!root.querySelector('.gs-trend') || !root.querySelector('.gs-tile')) { viewList(); return; }
        paintTable(); paintHeat();
      });
    }, 60000);
  }
  function mount(sec) {
    if (!sec) return;
    ensureCss();
    bindGlobal();
    if (!root || !sec.contains(root)) {
      sec.innerHTML = '<div class="gs-root" id="gsRoot"></div>';
      root = sec.querySelector('#gsRoot');
      root.addEventListener('error', onImgError, true);
    }
    if (!S.indices) loadIndices().then(function () { var s = root && root.querySelector('.gs-strip'); if (s) s.outerHTML = stripHtml(); });
    if (!S.rows) loadList();
    render();
  }

  window.gromStocks = { mount: mount, open: function (sym) { go(String(sym || '').toUpperCase()); } };
})();
