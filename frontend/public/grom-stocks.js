/* GROM · Stocks section v2 — list, market map, stock page and "buy with any token on any network".
 * Product module (loaded by gromEnsureProductModule('stocks')). Renders inside #page-xstocks only;
 * the app shell, router and wallet stay untouched. Trades go through grom-wallet.js
 * (gwStocksQuote / gwStocksExecute) with the xStocks price guard. */
(function () {
  'use strict';
  if (window.gromStocks) return;

  var API = '/api/market';
  /* Networks with an executable same-chain route today (KyberSwap on EVM, Jupiter on Solana). */
  var EVM_TRADE = { 1: 1, 56: 1, 42161: 1, 10: 1, 8453: 1, 4663: 1, 999: 1, 143: 1 };
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
      trends: 'Trending 24h', trends_sub: 'by volume', heat: 'Market map', heat_sub: '24h change',
      vol: 'Vol', mcap: 'MC', price: 'Price',
      th_all: 'All', th_fav: 'Favorites', th_gainers: 'Top gainers', th_losers: 'Top losers', th_buffett: 'Buffett portfolio', th_ai: 'AI & chips',
      th_space: 'Space & SpaceX', th_crypto: 'Crypto stocks', th_quantum: 'Quantum', th_etf: 'ETFs', th_robinhood: 'Robinhood Chain',
      c_all: 'All sectors', c_tech: 'Technology', c_finance: 'Finance', c_etf: 'ETF', c_auto: 'Auto', c_consumer: 'Consumer', c_crypto: 'Crypto sector', c_energy: 'Energy', c_health: 'Healthcare',
      n_all: 'All networks', search: 'Ticker or company', found: 'Found: {n}',
      h_name: 'Company', h_price: 'Price', h_chga: 'Change $', h_chg: 'Change %', h_5d: '5 days', h_mc: 'Market cap', h_vol: 'Volume 24h', h_pe: 'P/E', h_nets: 'Networks',
      buy: 'Buy', sell: 'Sell', empty: 'Nothing found. Try another ticker or clear the filters.',
      back: 'Stocks', share: 'Share', copied: 'Copied', link_copied: 'Link copied',
      nets_n: '{n} networks', net_1: '1 network', sh_title: 'Share', sh_sub: 'Share the {name} price with friends.', sh_copy: 'Copy', sh_link: 'Link', sh_more: 'More', sh_text: '{name} ({sym}) — {price}, {chg} in 24h. Tokenized stocks 24/7 on GROM', tp_close: 'Close', sw_title: 'Choose a stock', sw_fav: 'Favorites', sw_top: 'Largest', sw_all: 'All stocks · {n}', sw_none: 'Nothing found', sw_open: 'Other stocks', ex_price: 'Exchange price', premium: 'premium', discount: 'discount',
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
      tp_fine: 'Trades run from your own wallet. GROM never holds your funds.', tp_legal: 'Important information',
      lg_h: 'Important information',
      lg1: 'GROM is an independent interface. Some routes, including transfers between networks, use LI.FI. GROM integrates LI.FI independently and is not associated with LI.FI.',
      lg2: 'LI.FI is a technology infrastructure provider. It does not issue, distribute, market, promote, recommend or endorse any tokenized stock and does not provide financial, investment or advisory services to users.',
      lg3: 'LI.FI has no contractual relationship with users and no relationship with any token issuer.',
      lg4: 'The smart contracts behind these routes are non-custodial. Transactions are executed by independent third-party protocols and solvers. LI.FI does not warrant the availability, reliability or operation of any third-party protocol, solver or token issuer at any time.',
      lg5: 'Tokenized stocks may be regulated financial instruments in some jurisdictions and may not be suitable for all investors. Blockchain transactions carry risks, including smart-contract vulnerabilities, liquidity risk and regulatory risk.',
      lg6: 'Seek independent legal and financial advice before trading tokenized stocks.',
      tp_nohold: 'You don’t hold {sym} on a supported network yet.', tp_pick_tok: 'Choose a token',
      tp_auto_note: '“Auto” buys on {net} — deepest liquidity ({liq}). The transfer from {from} is included in the route.',
      tp_lowliq: 'Almost no {sym} liquidity on {net} — the price there would be poor. Switch to “Auto”.',
      tp_no_route: 'No route for this amount on {net}. Try “Auto”, another network or a different amount.',
      tp_rate_lim: 'Too many quote requests — retrying in a few seconds.',
      tp_cross: 'No route from another network right now. Pay with a token on {net} — or try another network or amount.', tp_pick_on: 'Choose a token on {net}',
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
      trends: 'Тренды за 24 ч', trends_sub: 'по объёму', heat: 'Market map', heat_sub: '24h change',
      vol: 'Объём', mcap: 'Кап.', price: 'Цена',
      th_all: 'Все', th_fav: 'Избранное', th_gainers: 'Лидеры роста', th_losers: 'Лидеры падения', th_buffett: 'Портфель Баффета', th_ai: 'ИИ и чипы',
      th_space: 'Космос и SpaceX', th_crypto: 'Крипто-акции', th_quantum: 'Квантовые', th_etf: 'ETF', th_robinhood: 'Robinhood Chain',
      c_all: 'Все секторы', c_tech: 'Технологии', c_finance: 'Финансы', c_etf: 'ETF', c_auto: 'Авто', c_consumer: 'Потребительский', c_crypto: 'Крипто-сектор', c_energy: 'Энергетика', c_health: 'Здравоохранение',
      n_all: 'Все сети', search: 'Тикер или компания', found: 'Найдено: {n}',
      h_name: 'Компания', h_price: 'Цена', h_chga: 'Изм. $', h_chg: 'Изм. %', h_5d: '5 дней', h_mc: 'Капитализация', h_vol: 'Объём 24ч', h_pe: 'P/E', h_nets: 'Сети',
      buy: 'Купить', sell: 'Продать', empty: 'Ничего не найдено. Попробуйте другой тикер или снимите фильтры.',
      back: 'Акции', share: 'Поделиться', copied: 'Скопировано', link_copied: 'Ссылка скопирована',
      nets_n: '{n} сетей', nets_few: '{n} сети', net_1: '1 сеть', sh_title: 'Поделиться', sh_sub: 'Поделитесь ценой {name} с друзьями.', sh_copy: 'Копировать', sh_link: 'Ссылка', sh_more: 'Ещё', sh_text: '{name} ({sym}) — {price}, {chg} за 24 ч. Токенизированные акции 24/7 на GROM', tp_close: 'Закрыть', sw_title: 'Выбрать акцию', sw_fav: 'Избранное', sw_top: 'Крупнейшие', sw_all: 'Все акции · {n}', sw_none: 'Ничего не найдено', sw_open: 'Другие акции', ex_price: 'Цена на бирже', premium: 'премия', discount: 'дисконт',
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
      tp_fine: 'Сделка выполняется из вашего кошелька. GROM не хранит средства.', tp_legal: 'Важная информация',
      lg_h: 'Важная информация',
      lg1: 'GROM — независимый интерфейс. Часть маршрутов, включая переводы между сетями, работает через LI.FI. GROM интегрирует LI.FI самостоятельно и не связан с LI.FI.',
      lg2: 'LI.FI — поставщик технологической инфраструктуры. LI.FI не выпускает, не распространяет, не продвигает, не рекламирует, не рекомендует и не одобряет токенизированные акции и не оказывает пользователям финансовых, инвестиционных или консультационных услуг.',
      lg3: 'У LI.FI нет договорных отношений с пользователями и нет отношений с эмитентами токенов.',
      lg4: 'Смарт-контракты этих маршрутов некастодиальные. Транзакции исполняют независимые сторонние протоколы и солверы. LI.FI не гарантирует доступность, надёжность и работу сторонних протоколов, солверов и эмитентов токенов.',
      lg5: 'Токенизированные акции в ряде юрисдикций могут быть регулируемыми финансовыми инструментами и подходят не всем инвесторам. Операции в блокчейне несут риски, включая уязвимости смарт-контрактов, риск ликвидности и регуляторный риск.',
      lg6: 'Перед сделками с токенизированными акциями получите независимую юридическую и финансовую консультацию.',
      tp_nohold: 'У вас пока нет {sym} в поддерживаемых сетях.', tp_pick_tok: 'Выберите токен',
      tp_auto_note: '«Авто» покупает в {net} — там самая глубокая ликвидность ({liq}). Перенос из {from} уже включён в маршрут.',
      tp_lowliq: 'В сети {net} почти нет ликвидности {sym} — цена там будет плохой. Включите «Авто».',
      tp_no_route: 'Нет маршрута для этой суммы в {net}. Попробуйте «Авто», другую сеть или сумму.',
      tp_rate_lim: 'Слишком много запросов котировок — повторим через несколько секунд.',
      tp_cross: 'Сейчас нет маршрута из другой сети. Оплатите токеном в сети {net} или попробуйте другую сеть или сумму.', tp_pick_on: 'Выбрать токен в {net}',
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
  /* es/tr/zh/ar/hi — same keys as en (generated from outputs/qa/tr/stocks_*.py). */
  I18N.es = {"seo_h1": "Acciones tokenizadas", "loading": "Cargando acciones…", "load_err": "Las acciones no están disponibles por ahora. Reintentando…", "retry": "Reintentar", "m_open": "Mercado de EE. UU. abierto", "m_closed": "Mercado de EE. UU. cerrado", "m_pre": "Pre-mercado", "m_post": "Fuera de horario", "m_onchain": "el trading on-chain funciona 24/7", "k_stocks": "acciones y ETF", "k_nets": "redes", "k_247": "trading on-chain", "trends": "Tendencias 24h", "trends_sub": "por volumen", "heat": "Market map", "heat_sub": "24h change", "vol": "Vol", "mcap": "Cap.", "price": "Precio", "th_all": "Todo", "th_fav": "Favoritos", "th_gainers": "Mayores subidas", "th_losers": "Mayores caídas", "th_buffett": "Cartera de Buffett", "th_ai": "IA y chips", "th_space": "Espacio y SpaceX", "th_crypto": "Acciones cripto", "th_quantum": "Cuántica", "th_etf": "ETF", "th_robinhood": "Robinhood Chain", "c_all": "Todos los sectores", "c_tech": "Tecnología", "c_finance": "Finanzas", "c_etf": "ETF", "c_auto": "Automoción", "c_consumer": "Consumo", "c_crypto": "Sector cripto", "c_energy": "Energía", "c_health": "Salud", "n_all": "Todas las redes", "search": "Ticker o empresa", "found": "Encontradas: {n}", "h_name": "Empresa", "h_price": "Precio", "h_chga": "Cambio $", "h_chg": "Cambio %", "h_5d": "5 días", "h_mc": "Capitalización", "h_vol": "Volumen 24h", "h_pe": "P/E", "h_nets": "Redes", "buy": "Comprar", "sell": "Vender", "empty": "No se encontró nada. Prueba otro ticker o quita los filtros.", "back": "Acciones", "share": "Compartir", "copied": "Copiado", "link_copied": "Enlace copiado", "nets_n": "{n} redes", "net_1": "1 red", "sh_title": "Compartir", "sh_sub": "Comparte el precio de {name} con tus amigos.", "sh_copy": "Copiar", "sh_link": "Enlace", "sh_more": "Más", "sh_text": "{name} ({sym}) — {price}, {chg} en 24h. Acciones tokenizadas 24/7 en GROM", "tp_close": "Cerrar", "sw_title": "Elige una acción", "sw_fav": "Favoritos", "sw_top": "Las más grandes", "sw_all": "Todas las acciones · {n}", "sw_none": "No se encontró nada", "sw_open": "Otras acciones", "ex_price": "Precio en bolsa", "premium": "prima", "discount": "descuento", "t_chart": "Gráfico", "t_where": "Dónde comprar", "t_stats": "Estadísticas", "t_token": "Token", "t_faq": "Preguntas", "chart_ex": "Precio en bolsa, USD", "chart_none": "El gráfico aún no está disponible para este ticker.", "chart_load": "Cargando gráfico…", "sess_closed": "El token cotiza on-chain 24/7: de noche y en fines de semana el precio del pool puede diferir del de la bolsa; GROM muestra la diferencia antes de comprar.", "where_h": "Dónde comprar: liquidez por red", "where_sub": "«Auto» compra donde los pools son más profundos, así obtienes más acciones por el mismo importe. También puedes elegir la red manualmente.", "w_net": "Red", "w_liq": "Liquidez del pool", "w_vol": "Volumen 24h", "w_pools": "Pools", "w_addr": "Contrato", "b_best": "Elección de Auto", "b_deep": "Profunda", "b_mid": "Media", "b_low": "Baja", "b_none": "Sin pools", "b_nodata": "Sin datos", "b_ratio": "No 1:1", "b_soon": "Pronto", "s_onchain": "Precio on-chain", "s_ex": "Precio en bolsa", "s_prem": "Prima sobre la bolsa", "s_chg": "Cambio 24h", "s_mc": "Capitalización de la empresa", "s_vol": "Volumen 24h", "s_pe": "P/E (TTM)", "s_liq": "Liquidez on-chain", "s_trade": "Trading", "s_trade_v": "24/7 · {n} redes", "how_h": "Cómo funciona la compra en GROM", "how1": "Paga con lo que tengas", "how1p": "Cualquier token de tu wallet en cualquier red compatible: ETH, USDC, USDT, SOL, BNB y más. No hace falta cambiar antes a una stablecoin.", "how2": "GROM construye la ruta", "how2p": "El swap, el puente y la compra se combinan en una sola ruta. Ves cada paso, la comisión y el tiempo antes de confirmar.", "how3": "La acción llega a tu wallet", "how3p": "El token va a tu propia dirección. GROM nunca custodia tus fondos: vende o muévelo cuando quieras.", "tok_h": "Versiones del token", "tok_what": "Qué es", "tok_what_v": "Un token que sigue el precio de la acción de {name}", "tok_vers": "Versiones", "faq_h": "Preguntas frecuentes", "fq1": "¿Qué estoy comprando exactamente?", "fa1": "Un token que sigue el precio de la acción de {name}. Se queda en tu propia wallet: GROM no custodia fondos ni requiere registro. Las condiciones las define el emisor del token.", "fq2": "¿Puedo comprar de noche o en fin de semana?", "fa2": "Sí. El trading on-chain funciona 24/7. Cuando el mercado de EE. UU. está cerrado, el precio del pool puede alejarse del último precio de la bolsa; GROM muestra esa prima o descuento antes de comprar.", "fq3": "¿Con qué puedo pagar?", "fa3": "Con casi cualquier token en cualquier red compatible. GROM lo cambia y lo lleva entre redes por ti. Normalmente 1–2 confirmaciones en tu wallet.", "fq4": "¿Por qué «Auto» eligió otra red?", "fa4": "Auto compra donde la liquidez de esta acción es más profunda: un pool pequeño daría un precio notablemente peor. Elige la red manualmente si necesitas una concreta.", "fq5": "¿Cuáles son los riesgos?", "fa5": "Los precios de las acciones se mueven, la liquidez de los pools es limitada y las rutas entre redes usan puentes. Las acciones tokenizadas no están disponibles en todos los países: revisa las normas de donde vives. Esto no es asesoramiento de inversión.", "sim_h": "Acciones similares", "tp_pay": "Pagas", "tp_get": "Recibes", "tp_sell": "Vendes", "tp_bal": "Saldo", "tp_dest": "Red", "tp_dest_sub": "donde estará la acción", "tp_auto": "Auto", "tp_pick": "Elegir red", "tp_manual": "manualmente", "tp_liq": "liquidez {v}", "tp_best_route": "mejor ruta", "tp_soldest": "Recibir en dirección de Solana", "tp_soldest_ph": "Pega tu dirección de Solana", "tp_phantom": "Conectar Phantom", "tp_route": "Ruta", "tp_steps": "{n} pasos", "tp_step": "1 paso", "tp_rate": "Tipo", "tp_vs": "Valor frente al precio en bolsa", "tp_fees": "Comisiones de red y puente", "tp_grom": "Comisión de GROM", "tp_min": "Mínimo recibido", "tp_via": "Proveedor", "tp_time": "Tiempo", "tp_connect": "Conectar wallet", "tp_enter": "Introduce un importe", "tp_quoting": "Buscando la mejor ruta…", "tp_buy_x": "Comprar {sym}", "tp_sell_x": "Vender {sym}", "tp_fine": "Las operaciones se hacen desde tu propia wallet. GROM nunca custodia tus fondos.", "tp_legal": "Información importante", "lg_h": "Información importante", "lg1": "GROM es una interfaz independiente. Algunas rutas, incluidas las transferencias entre redes, usan LI.FI. GROM integra LI.FI de forma independiente y no está asociado con LI.FI.", "lg2": "LI.FI es un proveedor de infraestructura tecnológica. No emite, distribuye, comercializa, promociona, recomienda ni respalda ninguna acción tokenizada y no presta servicios financieros, de inversión ni de asesoramiento a los usuarios.", "lg3": "LI.FI no tiene relación contractual con los usuarios ni relación con ningún emisor de tokens.", "lg4": "Los contratos inteligentes detrás de estas rutas no son custodios. Las transacciones las ejecutan protocolos y solvers de terceros independientes. LI.FI no garantiza en ningún momento la disponibilidad, fiabilidad ni funcionamiento de ningún protocolo, solver o emisor de tokens de terceros.", "lg5": "Las acciones tokenizadas pueden ser instrumentos financieros regulados en algunas jurisdicciones y pueden no ser adecuadas para todos los inversores. Las transacciones en blockchain conllevan riesgos, como vulnerabilidades de contratos inteligentes, riesgo de liquidez y riesgo regulatorio.", "lg6": "Busca asesoramiento legal y financiero independiente antes de operar con acciones tokenizadas.", "tp_nohold": "Todavía no tienes {sym} en una red compatible.", "tp_pick_tok": "Elige un token", "tp_auto_note": "«Auto» compra en {net}: la liquidez más profunda ({liq}). La transferencia desde {from} está incluida en la ruta.", "tp_lowliq": "Casi no hay liquidez de {sym} en {net}: el precio sería malo. Cambia a «Auto».", "tp_no_route": "No hay ruta para este importe en {net}. Prueba «Auto», otra red u otro importe.", "tp_rate_lim": "Demasiadas solicitudes de cotización: reintentando en unos segundos.", "tp_cross": "Ahora no hay ruta desde otra red. Paga con un token en {net}, o prueba otra red u otro importe.", "tp_pick_on": "Elige un token en {net}", "tp_pay_evm": "Para comprar en {net}, paga desde una wallet EVM (MetaMask, Trust, etc.). Los tokens de Solana pueden comprar la versión de Solana.", "tp_need_sol": "Añade una dirección de Solana para recibir la acción.", "g_fair": "El precio independiente de la acción no está disponible ahora: el trading está en pausa por seguridad. Inténtalo de nuevo en breve.", "g_ratio": "Esta versión del token no vale 1 acción por token: elige otra red.", "g_input": "No se pudo valorar tu token de pago. Prueba con USDC, USDT u otro token.", "g_output": "No se pudo valorar lo que recibes. Elige USDC o USDT.", "g_impact": "Protección de precio: recibirías un {n}% menos que el valor en bolsa. Reduce el importe o elige una red con más liquidez.", "x_confirm": "Confirma en tu wallet", "x_confirm_sub": "Revisa el importe y la red antes de firmar", "x_sent": "Enviado", "x_bridge": "Entrega en {net}", "x_bridge_sub": "Suele tardar {t}. Puedes cerrar esta ventana.", "x_done": "Listo", "x_done_sub": "{amt} {sym} en tu dirección", "x_fail": "No completado", "x_close": "Cerrar", "x_view": "Ver transacción", "pk_title_pay": "Pagar con", "pk_title_get": "Recibir", "pk_mine": "En tu wallet", "pk_pop": "Populares", "pk_more": "¿No encuentras tu token? Cámbialo por uno de estos en la página Swap.", "pk_search": "Token o red", "all_nets": "Todas"};
  I18N.tr = {"seo_h1": "Tokenize hisseler", "loading": "Hisseler yükleniyor…", "load_err": "Hisseler şu an kullanılamıyor. Yeniden deneniyor…", "retry": "Tekrar dene", "m_open": "ABD piyasası açık", "m_closed": "ABD piyasası kapalı", "m_pre": "Piyasa öncesi", "m_post": "Mesai sonrası", "m_onchain": "zincir üstü işlemler 7/24 sürer", "k_stocks": "hisse ve ETF", "k_nets": "ağ", "k_247": "zincir üstü işlem", "trends": "24s trendler", "trends_sub": "hacme göre", "heat": "Market map", "heat_sub": "24h change", "vol": "Hacim", "mcap": "PD", "price": "Fiyat", "th_all": "Tümü", "th_fav": "Favoriler", "th_gainers": "En çok yükselenler", "th_losers": "En çok düşenler", "th_buffett": "Buffett portföyü", "th_ai": "Yapay zekâ ve çipler", "th_space": "Uzay ve SpaceX", "th_crypto": "Kripto hisseleri", "th_quantum": "Kuantum", "th_etf": "ETF'ler", "th_robinhood": "Robinhood Chain", "c_all": "Tüm sektörler", "c_tech": "Teknoloji", "c_finance": "Finans", "c_etf": "ETF", "c_auto": "Otomotiv", "c_consumer": "Tüketim", "c_crypto": "Kripto sektörü", "c_energy": "Enerji", "c_health": "Sağlık", "n_all": "Tüm ağlar", "search": "Sembol veya şirket", "found": "Bulunan: {n}", "h_name": "Şirket", "h_price": "Fiyat", "h_chga": "Değişim $", "h_chg": "Değişim %", "h_5d": "5 gün", "h_mc": "Piyasa değeri", "h_vol": "24s hacim", "h_pe": "F/K", "h_nets": "Ağlar", "buy": "Al", "sell": "Sat", "empty": "Hiçbir şey bulunamadı. Başka bir sembol deneyin veya filtreleri temizleyin.", "back": "Hisseler", "share": "Paylaş", "copied": "Kopyalandı", "link_copied": "Bağlantı kopyalandı", "nets_n": "{n} ağ", "net_1": "1 ağ", "sh_title": "Paylaş", "sh_sub": "{name} fiyatını arkadaşlarınla paylaş.", "sh_copy": "Kopyala", "sh_link": "Bağlantı", "sh_more": "Daha fazla", "sh_text": "{name} ({sym}) — {price}, 24s'te {chg}. GROM'da 7/24 tokenize hisseler", "tp_close": "Kapat", "sw_title": "Hisse seç", "sw_fav": "Favoriler", "sw_top": "En büyükler", "sw_all": "Tüm hisseler · {n}", "sw_none": "Hiçbir şey bulunamadı", "sw_open": "Diğer hisseler", "ex_price": "Borsa fiyatı", "premium": "prim", "discount": "iskonto", "t_chart": "Grafik", "t_where": "Nereden alınır", "t_stats": "İstatistikler", "t_token": "Token", "t_faq": "SSS", "chart_ex": "Borsa fiyatı, USD", "chart_none": "Bu sembol için grafik henüz yok.", "chart_load": "Grafik yükleniyor…", "sess_closed": "Token zincir üstünde 7/24 işlem görür — gece ve hafta sonları havuz fiyatı borsadan farklı olabilir; GROM almadan önce farkı gösterir.", "where_h": "Nereden alınır: ağlara göre likidite", "where_sub": "«Otomatik», havuzların en derin olduğu yerden alır; böylece aynı tutara daha fazla hisse alırsın. Ağı elle de seçebilirsin.", "w_net": "Ağ", "w_liq": "Havuz likiditesi", "w_vol": "24s hacim", "w_pools": "Havuzlar", "w_addr": "Kontrat", "b_best": "Otomatik seçim", "b_deep": "Derin", "b_mid": "Orta", "b_low": "Düşük", "b_none": "Havuz yok", "b_nodata": "Veri yok", "b_ratio": "1:1 değil", "b_soon": "Yakında", "s_onchain": "Zincir üstü fiyat", "s_ex": "Borsa fiyatı", "s_prem": "Borsaya göre prim", "s_chg": "24s değişim", "s_mc": "Şirketin piyasa değeri", "s_vol": "24s hacim", "s_pe": "F/K (TTM)", "s_liq": "Zincir üstü likidite", "s_trade": "İşlem", "s_trade_v": "7/24 · {n} ağ", "how_h": "GROM'da alım nasıl çalışır", "how1": "Elindekiyle öde", "how1p": "Desteklenen herhangi bir ağdaki cüzdanındaki her token — ETH, USDC, USDT, SOL, BNB ve daha fazlası. Önce stablecoin'e çevirmen gerekmez.", "how2": "GROM rotayı kurar", "how2p": "Takas, köprü ve alım tek bir rotada birleşir. Onaylamadan önce her adımı, ücreti ve süreyi görürsün.", "how3": "Hisse cüzdanına gelir", "how3p": "Token kendi adresine gider. GROM fonlarını asla tutmaz — istediğin zaman sat ya da taşı.", "tok_h": "Token sürümleri", "tok_what": "Nedir", "tok_what_v": "{name} hisse fiyatını takip eden bir token", "tok_vers": "Sürümler", "faq_h": "Sık sorulan sorular", "fq1": "Tam olarak ne satın alıyorum?", "fa1": "{name} hisse fiyatını takip eden bir token. Kendi cüzdanında kalır — GROM fon tutmaz ve kayıt gerektirmez. Koşulları token ihraççısı belirler.", "fq2": "Gece veya hafta sonu alabilir miyim?", "fa2": "Evet. Zincir üstü işlemler 7/24 sürer. ABD piyasası kapalıyken havuz fiyatı son borsa fiyatından sapabilir — GROM almadan önce bu primi veya iskontoyu gösterir.", "fq3": "Ne ile ödeyebilirim?", "fa3": "Desteklenen herhangi bir ağdaki neredeyse her token ile. GROM senin için takas eder ve ağlar arasında taşır. Genellikle cüzdanında 1–2 onay.", "fq4": "«Otomatik» neden başka bir ağ seçti?", "fa4": "Otomatik, bu hisse için likiditenin en derin olduğu yerden alır — sığ bir havuz belirgin şekilde daha kötü fiyat verir. Belirli bir ağ gerekiyorsa elle seç.", "fq5": "Riskler nelerdir?", "fa5": "Hisse fiyatları değişir, havuz likiditesi sınırlıdır ve ağlar arası rotalar köprü kullanır. Tokenize hisseler her ülkede sunulmaz — yaşadığın yerin kurallarını kontrol et. Bu yatırım tavsiyesi değildir.", "sim_h": "Benzer hisseler", "tp_pay": "Ödersin", "tp_get": "Alırsın", "tp_sell": "Satarsın", "tp_bal": "Bakiye", "tp_dest": "Ağ", "tp_dest_sub": "hissenin olacağı yer", "tp_auto": "Otomatik", "tp_pick": "Ağ seç", "tp_manual": "elle", "tp_liq": "likidite {v}", "tp_best_route": "en iyi rota", "tp_soldest": "Solana adresine al", "tp_soldest_ph": "Solana adresini yapıştır", "tp_phantom": "Phantom bağla", "tp_route": "Rota", "tp_steps": "{n} adım", "tp_step": "1 adım", "tp_rate": "Kur", "tp_vs": "Borsa fiyatına göre değer", "tp_fees": "Ağ ve köprü ücretleri", "tp_grom": "GROM ücreti", "tp_min": "Minimum alınan", "tp_via": "Sağlayıcı", "tp_time": "Süre", "tp_connect": "Cüzdan bağla", "tp_enter": "Tutar gir", "tp_quoting": "En iyi rota aranıyor…", "tp_buy_x": "{sym} al", "tp_sell_x": "{sym} sat", "tp_fine": "İşlemler kendi cüzdanından yapılır. GROM fonlarını asla tutmaz.", "tp_legal": "Önemli bilgiler", "lg_h": "Önemli bilgiler", "lg1": "GROM bağımsız bir arayüzdür. Ağlar arası transferler dahil bazı rotalar LI.FI kullanır. GROM, LI.FI'yi bağımsız olarak entegre eder ve LI.FI ile bağlantılı değildir.", "lg2": "LI.FI bir teknoloji altyapı sağlayıcısıdır. Herhangi bir tokenize hisseyi ihraç etmez, dağıtmaz, pazarlamaz, tanıtmaz, önermez veya desteklemez ve kullanıcılara finansal, yatırım veya danışmanlık hizmeti sunmaz.", "lg3": "LI.FI'nin kullanıcılarla sözleşmesel bir ilişkisi ve herhangi bir token ihraççısıyla bir ilişkisi yoktur.", "lg4": "Bu rotaların arkasındaki akıllı kontratlar saklama yapmaz (non-custodial). İşlemler bağımsız üçüncü taraf protokoller ve çözücüler (solver) tarafından yürütülür. LI.FI, hiçbir üçüncü taraf protokolün, çözücünün veya token ihraççısının erişilebilirliğini, güvenilirliğini veya işleyişini hiçbir zaman garanti etmez.", "lg5": "Tokenize hisseler bazı yargı bölgelerinde düzenlenmiş finansal araçlar olabilir ve her yatırımcı için uygun olmayabilir. Blokzincir işlemleri akıllı kontrat açıkları, likidite riski ve düzenleyici risk gibi riskler taşır.", "lg6": "Tokenize hisselerle işlem yapmadan önce bağımsız hukuki ve finansal danışmanlık alın.", "tp_nohold": "Desteklenen bir ağda henüz {sym} yok.", "tp_pick_tok": "Token seç", "tp_auto_note": "«Otomatik» {net} ağında alır — en derin likidite ({liq}). {from} ağından transfer rotaya dahildir.", "tp_lowliq": "{net} ağında neredeyse hiç {sym} likiditesi yok — fiyat kötü olur. «Otomatik»e geç.", "tp_no_route": "{net} ağında bu tutar için rota yok. «Otomatik», başka bir ağ veya farklı bir tutar dene.", "tp_rate_lim": "Çok fazla fiyat isteği — birkaç saniye içinde yeniden denenecek.", "tp_cross": "Şu an başka bir ağdan rota yok. {net} ağındaki bir token ile öde — veya başka bir ağ ya da tutar dene.", "tp_pick_on": "{net} ağında bir token seç", "tp_pay_evm": "{net} ağında almak için bir EVM cüzdanından (MetaMask, Trust vb.) öde. Solana token'ları Solana sürümünü alabilir.", "tp_need_sol": "Hisseyi almak için bir Solana adresi ekle.", "g_fair": "Bağımsız hisse fiyatı şu an yok — güvenlik için işlemler durduruldu. Kısa süre sonra tekrar dene.", "g_ratio": "Bu token sürümü token başına 1 hisse olarak fiyatlanmıyor — başka bir ağ seç.", "g_input": "Ödeme token'ının değeri hesaplanamadı. USDC, USDT veya başka bir token dene.", "g_output": "Alacağın şeyin değeri hesaplanamadı. USDC veya USDT seç.", "g_impact": "Fiyat koruması: borsa değerinden %{n} daha az alırdın. Tutarı düşür veya daha likit bir ağ seç.", "x_confirm": "Cüzdanında onayla", "x_confirm_sub": "İmzalamadan önce tutarı ve ağı kontrol et", "x_sent": "Gönderildi", "x_bridge": "{net} ağına teslimat", "x_bridge_sub": "Genellikle {t} sürer. Bu pencereyi kapatabilirsin.", "x_done": "Tamamlandı", "x_done_sub": "Adresinde {amt} {sym}", "x_fail": "Tamamlanmadı", "x_close": "Kapat", "x_view": "İşlemi görüntüle", "pk_title_pay": "Ödeme", "pk_title_get": "Al", "pk_mine": "Cüzdanında", "pk_pop": "Popüler", "pk_more": "Token'ını bulamıyor musun? Swap sayfasında bunlardan birine çevir.", "pk_search": "Token veya ağ", "all_nets": "Tümü"};
  I18N.zh = {"seo_h1": "代币化股票", "loading": "正在加载股票…", "load_err": "股票暂时不可用，正在重试…", "retry": "重试", "m_open": "美股开盘中", "m_closed": "美股已收盘", "m_pre": "盘前", "m_post": "盘后", "m_onchain": "链上交易 24/7 运行", "k_stocks": "股票和 ETF", "k_nets": "个网络", "k_247": "链上交易", "trends": "24 小时热门", "trends_sub": "按成交量", "heat": "Market map", "heat_sub": "24h change", "vol": "成交量", "mcap": "市值", "price": "价格", "th_all": "全部", "th_fav": "收藏", "th_gainers": "涨幅榜", "th_losers": "跌幅榜", "th_buffett": "巴菲特持仓", "th_ai": "AI 与芯片", "th_space": "太空与 SpaceX", "th_crypto": "加密概念股", "th_quantum": "量子", "th_etf": "ETF", "th_robinhood": "Robinhood Chain", "c_all": "所有行业", "c_tech": "科技", "c_finance": "金融", "c_etf": "ETF", "c_auto": "汽车", "c_consumer": "消费", "c_crypto": "加密行业", "c_energy": "能源", "c_health": "医疗", "n_all": "所有网络", "search": "代码或公司", "found": "找到：{n}", "h_name": "公司", "h_price": "价格", "h_chga": "涨跌 $", "h_chg": "涨跌 %", "h_5d": "5 天", "h_mc": "市值", "h_vol": "24 小时成交量", "h_pe": "市盈率", "h_nets": "网络", "buy": "买入", "sell": "卖出", "empty": "未找到结果。请尝试其他代码或清除筛选。", "back": "股票", "share": "分享", "copied": "已复制", "link_copied": "链接已复制", "nets_n": "{n} 个网络", "net_1": "1 个网络", "sh_title": "分享", "sh_sub": "与朋友分享 {name} 的价格。", "sh_copy": "复制", "sh_link": "链接", "sh_more": "更多", "sh_text": "{name}（{sym}）— {price}，24 小时 {chg}。在 GROM 上 24/7 交易代币化股票", "tp_close": "关闭", "sw_title": "选择股票", "sw_fav": "收藏", "sw_top": "市值最大", "sw_all": "全部股票 · {n}", "sw_none": "未找到结果", "sw_open": "其他股票", "ex_price": "交易所价格", "premium": "溢价", "discount": "折价", "t_chart": "图表", "t_where": "购买渠道", "t_stats": "统计", "t_token": "代币", "t_faq": "常见问题", "chart_ex": "交易所价格，美元", "chart_none": "该代码暂无图表。", "chart_load": "正在加载图表…", "sess_closed": "该代币在链上 24/7 交易——夜间和周末，池内价格可能与交易所不同；GROM 会在购买前显示差额。", "where_h": "购买渠道：各网络流动性", "where_sub": "「自动」会在池子最深的网络买入，相同金额可获得更多股份。你也可以手动选择网络。", "w_net": "网络", "w_liq": "池流动性", "w_vol": "24 小时成交量", "w_pools": "池子", "w_addr": "合约", "b_best": "自动选择", "b_deep": "深", "b_mid": "中", "b_low": "浅", "b_none": "无池子", "b_nodata": "无数据", "b_ratio": "非 1:1", "b_soon": "即将上线", "s_onchain": "链上价格", "s_ex": "交易所价格", "s_prem": "相对交易所溢价", "s_chg": "24 小时涨跌", "s_mc": "公司市值", "s_vol": "24 小时成交量", "s_pe": "市盈率（TTM）", "s_liq": "链上流动性", "s_trade": "交易", "s_trade_v": "24/7 · {n} 个网络", "how_h": "在 GROM 上如何购买", "how1": "用你手里的代币支付", "how1p": "任何受支持网络上钱包里的任何代币——ETH、USDC、USDT、SOL、BNB 等。无需先换成稳定币。", "how2": "GROM 规划路线", "how2p": "兑换、跨链和购买合并为一条路线。确认前可看到每一步、费用和时间。", "how3": "股票到达你的钱包", "how3p": "代币会发送到你自己的地址。GROM 从不托管你的资金——随时可以卖出或转移。", "tok_h": "代币版本", "tok_what": "这是什么", "tok_what_v": "跟踪 {name} 股价的代币", "tok_vers": "版本", "faq_h": "常见问题", "fq1": "我买到的到底是什么？", "fa1": "一种跟踪 {name} 股价的代币。它保存在你自己的钱包里——GROM 不托管资金，也无需注册。代币条款由发行方规定。", "fq2": "可以在夜间或周末购买吗？", "fa2": "可以。链上交易 24/7 运行。美股休市时，池内价格可能偏离最后的交易所价格——GROM 会在购买前显示溢价或折价。", "fq3": "可以用什么支付？", "fa3": "几乎任何受支持网络上的任何代币。GROM 会为你完成兑换和跨链。通常只需在钱包中确认 1–2 次。", "fq4": "为什么「自动」选择了其他网络？", "fa4": "「自动」会在该股票流动性最深的网络买入——浅池会给出明显更差的价格。如需指定网络，请手动选择。", "fq5": "有哪些风险？", "fa5": "股价会波动，池内流动性有限，跨网络路线会使用跨链桥。代币化股票并非在所有国家都可用——请查看你所在地的规定。这不构成投资建议。", "sim_h": "相似股票", "tp_pay": "你支付", "tp_get": "你收到", "tp_sell": "你卖出", "tp_bal": "余额", "tp_dest": "网络", "tp_dest_sub": "股票所在网络", "tp_auto": "自动", "tp_pick": "选择网络", "tp_manual": "手动", "tp_liq": "流动性 {v}", "tp_best_route": "最佳路线", "tp_soldest": "接收到 Solana 地址", "tp_soldest_ph": "粘贴你的 Solana 地址", "tp_phantom": "连接 Phantom", "tp_route": "路线", "tp_steps": "{n} 步", "tp_step": "1 步", "tp_rate": "汇率", "tp_vs": "相对交易所价格的价值", "tp_fees": "网络和跨链费用", "tp_grom": "GROM 手续费", "tp_min": "最少收到", "tp_via": "提供方", "tp_time": "时间", "tp_connect": "连接钱包", "tp_enter": "输入金额", "tp_quoting": "正在寻找最佳路线…", "tp_buy_x": "买入 {sym}", "tp_sell_x": "卖出 {sym}", "tp_fine": "交易从你自己的钱包发起。GROM 从不托管你的资金。", "tp_legal": "重要信息", "lg_h": "重要信息", "lg1": "GROM 是一个独立界面。部分路线（包括跨网络转账）使用 LI.FI。GROM 独立集成 LI.FI，与 LI.FI 不存在关联。", "lg2": "LI.FI 是技术基础设施提供方。它不发行、分销、营销、推广、推荐或背书任何代币化股票，也不向用户提供金融、投资或咨询服务。", "lg3": "LI.FI 与用户之间不存在合同关系，与任何代币发行方也不存在关系。", "lg4": "这些路线背后的智能合约为非托管合约。交易由独立的第三方协议和求解器（solver）执行。LI.FI 在任何时候都不保证任何第三方协议、求解器或代币发行方的可用性、可靠性或运行。", "lg5": "代币化股票在某些司法辖区可能属于受监管的金融工具，并不一定适合所有投资者。区块链交易存在风险，包括智能合约漏洞、流动性风险和监管风险。", "lg6": "交易代币化股票前，请寻求独立的法律和财务意见。", "tp_nohold": "你在受支持的网络上还没有 {sym}。", "tp_pick_tok": "选择代币", "tp_auto_note": "「自动」在 {net} 买入——流动性最深（{liq}）。从 {from} 的转账已包含在路线中。", "tp_lowliq": "{net} 上几乎没有 {sym} 流动性——价格会很差。请切换到「自动」。", "tp_no_route": "{net} 上没有该金额的路线。请尝试「自动」、其他网络或其他金额。", "tp_rate_lim": "报价请求过多——几秒后重试。", "tp_cross": "目前没有来自其他网络的路线。请用 {net} 上的代币支付，或尝试其他网络或金额。", "tp_pick_on": "选择 {net} 上的代币", "tp_pay_evm": "要在 {net} 上购买，请使用 EVM 钱包（MetaMask、Trust 等）支付。Solana 代币可购买 Solana 版本。", "tp_need_sol": "请添加 Solana 地址以接收股票。", "g_fair": "暂时无法获取独立股价——为安全起见已暂停交易。请稍后再试。", "g_ratio": "该代币版本不是每枚代币对应 1 股——请选择其他网络。", "g_input": "无法估值你的支付代币。请尝试 USDC、USDT 或其他代币。", "g_output": "无法估值你将收到的资产。请选择 USDC 或 USDT。", "g_impact": "价格保护：你将比交易所价值少收到 {n}%。请降低金额或选择流动性更好的网络。", "x_confirm": "请在钱包中确认", "x_confirm_sub": "签名前请检查金额和网络", "x_sent": "已提交", "x_bridge": "正在送达 {net}", "x_bridge_sub": "通常需要 {t}。你可以关闭此窗口。", "x_done": "完成", "x_done_sub": "{amt} {sym} 已到你的地址", "x_fail": "未完成", "x_close": "关闭", "x_view": "查看交易", "pk_title_pay": "支付方式", "pk_title_get": "接收", "pk_mine": "你的钱包", "pk_pop": "热门", "pk_more": "找不到你的代币？请在 Swap 页面把它兑换成以下之一。", "pk_search": "代币或网络", "all_nets": "全部"};
  I18N.ar = {"seo_h1": "الأسهم المرمّزة", "loading": "جارٍ تحميل الأسهم…", "load_err": "الأسهم غير متاحة مؤقتًا. جارٍ إعادة المحاولة…", "retry": "إعادة المحاولة", "m_open": "السوق الأمريكية مفتوحة", "m_closed": "السوق الأمريكية مغلقة", "m_pre": "ما قبل الافتتاح", "m_post": "بعد الإغلاق", "m_onchain": "التداول على السلسلة يعمل 24/7", "k_stocks": "أسهم وصناديق ETF", "k_nets": "شبكات", "k_247": "تداول على السلسلة", "trends": "الأكثر تداولًا 24س", "trends_sub": "حسب الحجم", "heat": "Market map", "heat_sub": "24h change", "vol": "الحجم", "mcap": "ق.س", "price": "السعر", "th_all": "الكل", "th_fav": "المفضلة", "th_gainers": "الأكثر ارتفاعًا", "th_losers": "الأكثر انخفاضًا", "th_buffett": "محفظة بافيت", "th_ai": "الذكاء الاصطناعي والرقائق", "th_space": "الفضاء وSpaceX", "th_crypto": "أسهم الكريبتو", "th_quantum": "الكم", "th_etf": "صناديق ETF", "th_robinhood": "Robinhood Chain", "c_all": "كل القطاعات", "c_tech": "التكنولوجيا", "c_finance": "المالية", "c_etf": "ETF", "c_auto": "السيارات", "c_consumer": "الاستهلاك", "c_crypto": "قطاع الكريبتو", "c_energy": "الطاقة", "c_health": "الرعاية الصحية", "n_all": "كل الشبكات", "search": "الرمز أو الشركة", "found": "النتائج: {n}", "h_name": "الشركة", "h_price": "السعر", "h_chga": "التغيّر $", "h_chg": "التغيّر %", "h_5d": "5 أيام", "h_mc": "القيمة السوقية", "h_vol": "حجم 24س", "h_pe": "م/ر", "h_nets": "الشبكات", "buy": "شراء", "sell": "بيع", "empty": "لم يتم العثور على شيء. جرّب رمزًا آخر أو امسح عوامل التصفية.", "back": "الأسهم", "share": "مشاركة", "copied": "تم النسخ", "link_copied": "تم نسخ الرابط", "nets_n": "{n} شبكات", "net_1": "شبكة واحدة", "sh_title": "مشاركة", "sh_sub": "شارك سعر {name} مع أصدقائك.", "sh_copy": "نسخ", "sh_link": "رابط", "sh_more": "المزيد", "sh_text": "{name} ({sym}) — {price}، {chg} خلال 24س. أسهم مرمّزة 24/7 على GROM", "tp_close": "إغلاق", "sw_title": "اختر سهمًا", "sw_fav": "المفضلة", "sw_top": "الأكبر", "sw_all": "كل الأسهم · {n}", "sw_none": "لم يتم العثور على شيء", "sw_open": "أسهم أخرى", "ex_price": "سعر البورصة", "premium": "علاوة", "discount": "خصم", "t_chart": "الرسم البياني", "t_where": "أين تشتري", "t_stats": "الإحصاءات", "t_token": "الرمز", "t_faq": "الأسئلة الشائعة", "chart_ex": "سعر البورصة، دولار", "chart_none": "الرسم البياني غير متاح لهذا الرمز بعد.", "chart_load": "جارٍ تحميل الرسم البياني…", "sess_closed": "يُتداول الرمز على السلسلة 24/7 — في الليل وعطلات نهاية الأسبوع قد يختلف سعر المجمّع عن البورصة؛ يعرض GROM الفرق قبل الشراء.", "where_h": "أين تشتري: السيولة حسب الشبكة", "where_sub": "«تلقائي» يشتري حيث المجمّعات أعمق، فتحصل على أسهم أكثر بالمبلغ نفسه. يمكنك أيضًا اختيار الشبكة يدويًا.", "w_net": "الشبكة", "w_liq": "سيولة المجمّع", "w_vol": "حجم 24س", "w_pools": "المجمّعات", "w_addr": "العقد", "b_best": "اختيار تلقائي", "b_deep": "عميقة", "b_mid": "متوسطة", "b_low": "منخفضة", "b_none": "لا مجمّعات", "b_nodata": "لا بيانات", "b_ratio": "ليست 1:1", "b_soon": "قريبًا", "s_onchain": "السعر على السلسلة", "s_ex": "سعر البورصة", "s_prem": "العلاوة مقابل البورصة", "s_chg": "تغيّر 24س", "s_mc": "القيمة السوقية للشركة", "s_vol": "حجم 24س", "s_pe": "م/ر (TTM)", "s_liq": "السيولة على السلسلة", "s_trade": "التداول", "s_trade_v": "24/7 · {n} شبكات", "how_h": "كيف يعمل الشراء على GROM", "how1": "ادفع بما لديك", "how1p": "أي رمز في محفظتك على أي شبكة مدعومة — ETH وUSDC وUSDT وSOL وBNB وغيرها. لا حاجة للتحويل إلى عملة مستقرة أولًا.", "how2": "GROM يبني المسار", "how2p": "يُجمع التبديل والجسر والشراء في مسار واحد. ترى كل خطوة والرسوم والوقت قبل التأكيد.", "how3": "يصل السهم إلى محفظتك", "how3p": "يذهب الرمز إلى عنوانك الخاص. لا يحتفظ GROM بأموالك أبدًا — بِع أو انقل متى شئت.", "tok_h": "إصدارات الرمز", "tok_what": "ما هو", "tok_what_v": "رمز يتتبع سعر سهم {name}", "tok_vers": "الإصدارات", "faq_h": "الأسئلة الشائعة", "fq1": "ماذا أشتري بالضبط؟", "fa1": "رمز يتتبع سعر سهم {name}. يبقى في محفظتك الخاصة — لا يحتفظ GROM بالأموال ولا يتطلب تسجيلًا. يحدد مُصدر الرمز شروطه.", "fq2": "هل يمكنني الشراء ليلًا أو في عطلة نهاية الأسبوع؟", "fa2": "نعم. التداول على السلسلة يعمل 24/7. عندما تكون السوق الأمريكية مغلقة قد يبتعد سعر المجمّع عن آخر سعر في البورصة — يعرض GROM هذه العلاوة أو الخصم قبل الشراء.", "fq3": "بماذا يمكنني الدفع؟", "fa3": "بأي رمز تقريبًا على أي شبكة مدعومة. يقوم GROM بالتبديل والنقل بين الشبكات نيابةً عنك. عادةً 1–2 تأكيد في محفظتك.", "fq4": "لماذا اختار «تلقائي» شبكة أخرى؟", "fa4": "«تلقائي» يشتري حيث تكون سيولة هذا السهم أعمق — المجمّع الضحل يعطي سعرًا أسوأ بوضوح. اختر الشبكة يدويًا إذا احتجت إلى شبكة معينة.", "fq5": "ما المخاطر؟", "fa5": "أسعار الأسهم تتحرك، وسيولة المجمّعات محدودة، والمسارات بين الشبكات تستخدم الجسور. الأسهم المرمّزة غير متاحة في كل البلدان — تحقق من القواعد في مكان إقامتك. هذه ليست نصيحة استثمارية.", "sim_h": "أسهم مشابهة", "tp_pay": "تدفع", "tp_get": "تستلم", "tp_sell": "تبيع", "tp_bal": "الرصيد", "tp_dest": "الشبكة", "tp_dest_sub": "حيث سيكون السهم", "tp_auto": "تلقائي", "tp_pick": "اختر الشبكة", "tp_manual": "يدويًا", "tp_liq": "السيولة {v}", "tp_best_route": "أفضل مسار", "tp_soldest": "الاستلام على عنوان Solana", "tp_soldest_ph": "الصق عنوان Solana الخاص بك", "tp_phantom": "ربط Phantom", "tp_route": "المسار", "tp_steps": "{n} خطوات", "tp_step": "خطوة واحدة", "tp_rate": "السعر", "tp_vs": "القيمة مقابل سعر البورصة", "tp_fees": "رسوم الشبكة والجسر", "tp_grom": "رسوم GROM", "tp_min": "الحد الأدنى للاستلام", "tp_via": "المزوّد", "tp_time": "الوقت", "tp_connect": "ربط المحفظة", "tp_enter": "أدخل المبلغ", "tp_quoting": "جارٍ البحث عن أفضل مسار…", "tp_buy_x": "شراء {sym}", "tp_sell_x": "بيع {sym}", "tp_fine": "تتم الصفقات من محفظتك الخاصة. لا يحتفظ GROM بأموالك أبدًا.", "tp_legal": "معلومات مهمة", "lg_h": "معلومات مهمة", "lg1": "GROM واجهة مستقلة. تستخدم بعض المسارات، ومنها التحويلات بين الشبكات، خدمة LI.FI. يدمج GROM خدمة LI.FI بشكل مستقل ولا يرتبط بها.", "lg2": "LI.FI مزوّد بنية تحتية تقنية. لا تُصدر أي سهم مرمّز ولا توزّعه ولا تسوّقه ولا تروّج له ولا توصي به ولا تؤيده، ولا تقدّم للمستخدمين خدمات مالية أو استثمارية أو استشارية.", "lg3": "لا تربط LI.FI أي علاقة تعاقدية بالمستخدمين ولا أي علاقة بأي مُصدر للرموز.", "lg4": "العقود الذكية وراء هذه المسارات غير احتجازية. تُنفَّذ المعاملات بواسطة بروتوكولات ومنفّذين (solvers) مستقلين من أطراف ثالثة. لا تضمن LI.FI في أي وقت توفّر أي بروتوكول أو منفّذ أو مُصدر رموز من طرف ثالث أو موثوقيته أو تشغيله.", "lg5": "قد تكون الأسهم المرمّزة أدوات مالية منظَّمة في بعض الولايات القضائية وقد لا تناسب جميع المستثمرين. تنطوي معاملات البلوكتشين على مخاطر، منها ثغرات العقود الذكية ومخاطر السيولة والمخاطر التنظيمية.", "lg6": "اطلب استشارة قانونية ومالية مستقلة قبل تداول الأسهم المرمّزة.", "tp_nohold": "لا تملك {sym} على شبكة مدعومة بعد.", "tp_pick_tok": "اختر رمزًا", "tp_auto_note": "«تلقائي» يشتري على {net} — أعمق سيولة ({liq}). التحويل من {from} مشمول في المسار.", "tp_lowliq": "لا توجد تقريبًا سيولة {sym} على {net} — سيكون السعر سيئًا. انتقل إلى «تلقائي».", "tp_no_route": "لا يوجد مسار لهذا المبلغ على {net}. جرّب «تلقائي» أو شبكة أخرى أو مبلغًا مختلفًا.", "tp_rate_lim": "طلبات تسعير كثيرة جدًا — ستتم إعادة المحاولة خلال ثوانٍ.", "tp_cross": "لا يوجد مسار من شبكة أخرى الآن. ادفع برمز على {net} — أو جرّب شبكة أو مبلغًا آخر.", "tp_pick_on": "اختر رمزًا على {net}", "tp_pay_evm": "للشراء على {net}، ادفع من محفظة EVM (MetaMask وTrust وغيرها). يمكن لرموز Solana شراء إصدار Solana.", "tp_need_sol": "أضف عنوان Solana لاستلام السهم.", "g_fair": "سعر السهم المستقل غير متاح الآن — تم إيقاف التداول مؤقتًا للأمان. حاول مجددًا بعد قليل.", "g_ratio": "إصدار الرمز هذا لا يساوي سهمًا واحدًا لكل رمز — اختر شبكة أخرى.", "g_input": "تعذّر تقييم رمز الدفع. جرّب USDC أو USDT أو رمزًا آخر.", "g_output": "تعذّر تقييم ما ستستلمه. اختر USDC أو USDT.", "g_impact": "حماية السعر: ستحصل على أقل بنسبة {n}% من قيمة البورصة. خفّض المبلغ أو اختر شبكة ذات سيولة أكبر.", "x_confirm": "أكّد في محفظتك", "x_confirm_sub": "تحقق من المبلغ والشبكة قبل التوقيع", "x_sent": "تم الإرسال", "x_bridge": "التسليم إلى {net}", "x_bridge_sub": "يستغرق عادةً {t}. يمكنك إغلاق هذه النافذة.", "x_done": "تم", "x_done_sub": "{amt} {sym} على عنوانك", "x_fail": "لم يكتمل", "x_close": "إغلاق", "x_view": "عرض المعاملة", "pk_title_pay": "الدفع بـ", "pk_title_get": "الاستلام", "pk_mine": "في محفظتك", "pk_pop": "الشائعة", "pk_more": "لا تجد رمزك؟ بدّله بأحد هذه في صفحة Swap.", "pk_search": "الرمز أو الشبكة", "all_nets": "الكل"};
  I18N.hi = {"seo_h1": "टोकनाइज़्ड स्टॉक्स", "loading": "स्टॉक्स लोड हो रहे हैं…", "load_err": "स्टॉक्स अभी उपलब्ध नहीं हैं। फिर से कोशिश की जा रही है…", "retry": "फिर कोशिश करें", "m_open": "अमेरिकी बाज़ार खुला है", "m_closed": "अमेरिकी बाज़ार बंद है", "m_pre": "प्री-मार्केट", "m_post": "आफ्टर आवर्स", "m_onchain": "ऑन-चेन ट्रेडिंग 24/7 चलती है", "k_stocks": "स्टॉक्स और ETF", "k_nets": "नेटवर्क", "k_247": "ऑन-चेन ट्रेडिंग", "trends": "24 घंटे में ट्रेंडिंग", "trends_sub": "वॉल्यूम के अनुसार", "heat": "Market map", "heat_sub": "24h change", "vol": "वॉल्यूम", "mcap": "MC", "price": "कीमत", "th_all": "सभी", "th_fav": "पसंदीदा", "th_gainers": "सबसे ज़्यादा बढ़े", "th_losers": "सबसे ज़्यादा गिरे", "th_buffett": "बफेट पोर्टफोलियो", "th_ai": "AI और चिप्स", "th_space": "स्पेस और SpaceX", "th_crypto": "क्रिप्टो स्टॉक्स", "th_quantum": "क्वांटम", "th_etf": "ETF", "th_robinhood": "Robinhood Chain", "c_all": "सभी सेक्टर", "c_tech": "टेक्नोलॉजी", "c_finance": "फ़ाइनेंस", "c_etf": "ETF", "c_auto": "ऑटो", "c_consumer": "कंज़्यूमर", "c_crypto": "क्रिप्टो सेक्टर", "c_energy": "एनर्जी", "c_health": "हेल्थकेयर", "n_all": "सभी नेटवर्क", "search": "टिकर या कंपनी", "found": "मिले: {n}", "h_name": "कंपनी", "h_price": "कीमत", "h_chga": "बदलाव $", "h_chg": "बदलाव %", "h_5d": "5 दिन", "h_mc": "मार्केट कैप", "h_vol": "24 घंटे का वॉल्यूम", "h_pe": "P/E", "h_nets": "नेटवर्क", "buy": "खरीदें", "sell": "बेचें", "empty": "कुछ नहीं मिला। दूसरा टिकर आज़माएँ या फ़िल्टर हटाएँ।", "back": "स्टॉक्स", "share": "शेयर करें", "copied": "कॉपी हो गया", "link_copied": "लिंक कॉपी हो गया", "nets_n": "{n} नेटवर्क", "net_1": "1 नेटवर्क", "sh_title": "शेयर करें", "sh_sub": "{name} की कीमत दोस्तों के साथ शेयर करें।", "sh_copy": "कॉपी करें", "sh_link": "लिंक", "sh_more": "और", "sh_text": "{name} ({sym}) — {price}, 24 घंटे में {chg}। GROM पर 24/7 टोकनाइज़्ड स्टॉक्स", "tp_close": "बंद करें", "sw_title": "स्टॉक चुनें", "sw_fav": "पसंदीदा", "sw_top": "सबसे बड़े", "sw_all": "सभी स्टॉक्स · {n}", "sw_none": "कुछ नहीं मिला", "sw_open": "अन्य स्टॉक्स", "ex_price": "एक्सचेंज कीमत", "premium": "प्रीमियम", "discount": "डिस्काउंट", "t_chart": "चार्ट", "t_where": "कहाँ खरीदें", "t_stats": "आँकड़े", "t_token": "टोकन", "t_faq": "FAQ", "chart_ex": "एक्सचेंज कीमत, USD", "chart_none": "इस टिकर के लिए चार्ट अभी उपलब्ध नहीं है।", "chart_load": "चार्ट लोड हो रहा है…", "sess_closed": "टोकन ऑन-चेन 24/7 ट्रेड होता है — रात और वीकेंड पर पूल की कीमत एक्सचेंज से अलग हो सकती है; GROM खरीदने से पहले अंतर दिखाता है।", "where_h": "कहाँ खरीदें: नेटवर्क के अनुसार लिक्विडिटी", "where_sub": "«ऑटो» वहाँ खरीदता है जहाँ पूल सबसे गहरे हों, ताकि उसी राशि में ज़्यादा शेयर मिलें। आप नेटवर्क खुद भी चुन सकते हैं।", "w_net": "नेटवर्क", "w_liq": "पूल लिक्विडिटी", "w_vol": "24 घंटे का वॉल्यूम", "w_pools": "पूल", "w_addr": "कॉन्ट्रैक्ट", "b_best": "ऑटो का चुनाव", "b_deep": "गहरा", "b_mid": "मध्यम", "b_low": "कम", "b_none": "कोई पूल नहीं", "b_nodata": "डेटा नहीं", "b_ratio": "1:1 नहीं", "b_soon": "जल्द ट्रेडिंग", "s_onchain": "ऑन-चेन कीमत", "s_ex": "एक्सचेंज कीमत", "s_prem": "एक्सचेंज पर प्रीमियम", "s_chg": "24 घंटे का बदलाव", "s_mc": "कंपनी का मार्केट कैप", "s_vol": "24 घंटे का वॉल्यूम", "s_pe": "P/E (TTM)", "s_liq": "ऑन-चेन लिक्विडिटी", "s_trade": "ट्रेडिंग", "s_trade_v": "24/7 · {n} नेटवर्क", "how_h": "GROM पर खरीदारी कैसे होती है", "how1": "जो आपके पास है उससे भुगतान करें", "how1p": "किसी भी समर्थित नेटवर्क पर आपके वॉलेट का कोई भी टोकन — ETH, USDC, USDT, SOL, BNB और भी। पहले स्टेबलकॉइन में बदलने की ज़रूरत नहीं।", "how2": "GROM रूट बनाता है", "how2p": "स्वैप, ब्रिज और खरीद एक ही रूट में जुड़ जाते हैं। पुष्टि से पहले आप हर कदम, शुल्क और समय देखते हैं।", "how3": "स्टॉक आपके वॉलेट में आता है", "how3p": "टोकन आपके अपने पते पर जाता है। GROM कभी आपके फंड नहीं रखता — जब चाहें बेचें या ट्रांसफ़र करें।", "tok_h": "टोकन वर्ज़न", "tok_what": "यह क्या है", "tok_what_v": "{name} के शेयर की कीमत को ट्रैक करने वाला टोकन", "tok_vers": "वर्ज़न", "faq_h": "अक्सर पूछे जाने वाले सवाल", "fq1": "मैं असल में क्या खरीद रहा हूँ?", "fa1": "{name} के शेयर की कीमत को फ़ॉलो करने वाला टोकन। यह आपके अपने वॉलेट में रहता है — GROM फंड नहीं रखता और साइन-अप की ज़रूरत नहीं। इसकी शर्तें टोकन जारीकर्ता तय करता है।", "fq2": "क्या मैं रात या वीकेंड पर खरीद सकता हूँ?", "fa2": "हाँ। ऑन-चेन ट्रेडिंग 24/7 चलती है। जब अमेरिकी बाज़ार बंद हो, पूल की कीमत आख़िरी एक्सचेंज कीमत से हट सकती है — GROM खरीदने से पहले वह प्रीमियम या डिस्काउंट दिखाता है।", "fq3": "मैं किससे भुगतान कर सकता हूँ?", "fa3": "किसी भी समर्थित नेटवर्क पर लगभग किसी भी टोकन से। GROM आपके लिए स्वैप और ब्रिज करता है। आमतौर पर वॉलेट में 1–2 पुष्टि।", "fq4": "«ऑटो» ने दूसरा नेटवर्क क्यों चुना?", "fa4": "ऑटो वहाँ खरीदता है जहाँ इस स्टॉक की लिक्विडिटी सबसे गहरी हो — छोटा पूल साफ़ तौर पर ख़राब कीमत देगा। किसी खास नेटवर्क की ज़रूरत हो तो खुद चुनें।", "fq5": "जोखिम क्या हैं?", "fa5": "शेयर की कीमतें बदलती हैं, पूल की लिक्विडिटी सीमित है और नेटवर्क के बीच रूट ब्रिज का उपयोग करते हैं। टोकनाइज़्ड स्टॉक्स हर देश में उपलब्ध नहीं हैं — अपने यहाँ के नियम देखें। यह निवेश सलाह नहीं है।", "sim_h": "मिलते-जुलते स्टॉक्स", "tp_pay": "आप देंगे", "tp_get": "आपको मिलेगा", "tp_sell": "आप बेचेंगे", "tp_bal": "बैलेंस", "tp_dest": "नेटवर्क", "tp_dest_sub": "स्टॉक कहाँ होगा", "tp_auto": "ऑटो", "tp_pick": "नेटवर्क चुनें", "tp_manual": "मैन्युअली", "tp_liq": "लिक्विडिटी {v}", "tp_best_route": "सबसे अच्छा रूट", "tp_soldest": "Solana पते पर प्राप्त करें", "tp_soldest_ph": "अपना Solana पता पेस्ट करें", "tp_phantom": "Phantom कनेक्ट करें", "tp_route": "रूट", "tp_steps": "{n} कदम", "tp_step": "1 कदम", "tp_rate": "रेट", "tp_vs": "एक्सचेंज कीमत की तुलना में मूल्य", "tp_fees": "नेटवर्क और ब्रिज शुल्क", "tp_grom": "GROM शुल्क", "tp_min": "न्यूनतम प्राप्त", "tp_via": "प्रदाता", "tp_time": "समय", "tp_connect": "वॉलेट कनेक्ट करें", "tp_enter": "राशि दर्ज करें", "tp_quoting": "सबसे अच्छा रूट खोजा जा रहा है…", "tp_buy_x": "{sym} खरीदें", "tp_sell_x": "{sym} बेचें", "tp_fine": "ट्रेड आपके अपने वॉलेट से होते हैं। GROM कभी आपके फंड नहीं रखता।", "tp_legal": "महत्वपूर्ण जानकारी", "lg_h": "महत्वपूर्ण जानकारी", "lg1": "GROM एक स्वतंत्र इंटरफ़ेस है। कुछ रूट, जिनमें नेटवर्क के बीच ट्रांसफ़र शामिल हैं, LI.FI का उपयोग करते हैं। GROM, LI.FI को स्वतंत्र रूप से इंटीग्रेट करता है और LI.FI से जुड़ा नहीं है।", "lg2": "LI.FI एक टेक्नोलॉजी इंफ्रास्ट्रक्चर प्रदाता है। यह किसी भी टोकनाइज़्ड स्टॉक को जारी, वितरित, मार्केट, प्रमोट, अनुशंसित या समर्थित नहीं करता और उपयोगकर्ताओं को वित्तीय, निवेश या सलाहकार सेवाएँ नहीं देता।", "lg3": "LI.FI का उपयोगकर्ताओं के साथ कोई अनुबंध संबंध नहीं है और किसी भी टोकन जारीकर्ता के साथ कोई संबंध नहीं है।", "lg4": "इन रूट्स के पीछे के स्मार्ट कॉन्ट्रैक्ट नॉन-कस्टोडियल हैं। लेनदेन स्वतंत्र थर्ड-पार्टी प्रोटोकॉल और सॉल्वर द्वारा किए जाते हैं। LI.FI किसी भी समय किसी थर्ड-पार्टी प्रोटोकॉल, सॉल्वर या टोकन जारीकर्ता की उपलब्धता, विश्वसनीयता या संचालन की गारंटी नहीं देता।", "lg5": "कुछ क्षेत्राधिकारों में टोकनाइज़्ड स्टॉक्स विनियमित वित्तीय साधन हो सकते हैं और सभी निवेशकों के लिए उपयुक्त नहीं हो सकते। ब्लॉकचेन लेनदेन में जोखिम होते हैं, जिनमें स्मार्ट-कॉन्ट्रैक्ट कमज़ोरियाँ, लिक्विडिटी जोखिम और नियामकीय जोखिम शामिल हैं।", "lg6": "टोकनाइज़्ड स्टॉक्स में ट्रेड करने से पहले स्वतंत्र कानूनी और वित्तीय सलाह लें।", "tp_nohold": "आपके पास अभी किसी समर्थित नेटवर्क पर {sym} नहीं है।", "tp_pick_tok": "टोकन चुनें", "tp_auto_note": "«ऑटो» {net} पर खरीदता है — सबसे गहरी लिक्विडिटी ({liq})। {from} से ट्रांसफ़र रूट में शामिल है।", "tp_lowliq": "{net} पर {sym} की लगभग कोई लिक्विडिटी नहीं — वहाँ कीमत ख़राब होगी। «ऑटो» पर जाएँ।", "tp_no_route": "{net} पर इस राशि के लिए कोई रूट नहीं। «ऑटो», दूसरा नेटवर्क या अलग राशि आज़माएँ।", "tp_rate_lim": "बहुत ज़्यादा कोट अनुरोध — कुछ सेकंड में फिर कोशिश होगी।", "tp_cross": "अभी दूसरे नेटवर्क से कोई रूट नहीं। {net} पर किसी टोकन से भुगतान करें — या दूसरा नेटवर्क या राशि आज़माएँ।", "tp_pick_on": "{net} पर टोकन चुनें", "tp_pay_evm": "{net} पर खरीदने के लिए EVM वॉलेट (MetaMask, Trust आदि) से भुगतान करें। Solana टोकन से Solana वर्ज़न खरीदा जा सकता है।", "tp_need_sol": "स्टॉक प्राप्त करने के लिए Solana पता जोड़ें।", "g_fair": "स्वतंत्र शेयर कीमत अभी उपलब्ध नहीं है — सुरक्षा के लिए ट्रेडिंग रोकी गई है। थोड़ी देर बाद फिर कोशिश करें।", "g_ratio": "इस टोकन वर्ज़न की कीमत 1 टोकन = 1 शेयर नहीं है — दूसरा नेटवर्क चुनें।", "g_input": "आपके भुगतान टोकन का मूल्य नहीं निकाला जा सका। USDC, USDT या कोई और टोकन आज़माएँ।", "g_output": "आपको मिलने वाली चीज़ का मूल्य नहीं निकाला जा सका। USDC या USDT चुनें।", "g_impact": "कीमत सुरक्षा: आपको एक्सचेंज मूल्य से {n}% कम मिलेगा। राशि घटाएँ या ज़्यादा लिक्विडिटी वाला नेटवर्क चुनें।", "x_confirm": "अपने वॉलेट में पुष्टि करें", "x_confirm_sub": "साइन करने से पहले राशि और नेटवर्क जाँचें", "x_sent": "भेजा गया", "x_bridge": "{net} पर डिलीवरी", "x_bridge_sub": "आमतौर पर {t} लगता है। आप यह विंडो बंद कर सकते हैं।", "x_done": "हो गया", "x_done_sub": "आपके पते पर {amt} {sym}", "x_fail": "पूरा नहीं हुआ", "x_close": "बंद करें", "x_view": "लेनदेन देखें", "pk_title_pay": "भुगतान करें", "pk_title_get": "प्राप्त करें", "pk_mine": "आपके वॉलेट में", "pk_pop": "लोकप्रिय", "pk_more": "अपना टोकन नहीं मिल रहा? Swap पेज पर इसे इनमें से किसी एक में बदलें।", "pk_search": "टोकन या नेटवर्क", "all_nets": "सभी"};
  /* 2026-11-13 real-test fixes: balance check, two-step signing, plain wallet errors. */
  (function () {
    var add = {
      en: {
        tp_nobal: 'Not enough {sym}',
        tp_nobal_buy: 'You have {bal} {sym} on {net} — not enough for this amount. Lower the amount or pick a token you have.',
        tp_nobal_sell: 'You have {bal} {sym} on {net}. Lower the amount.',
        x_wait: 'Waiting for your wallet…',
        x_s1: 'Step 1 of 2 · Permission for {sym}',
        x_s1_sub: 'Your wallet asks to allow {sym} for exactly this amount. This is not the trade yet.',
        x_s1_ok: 'Permission confirmed',
        x_s2: 'Step 2 of 2 · The trade',
        x_s2_sub: 'After the permission, your wallet will ask you to confirm the trade.',
        xe_rejected: 'You declined the request in your wallet. Nothing was sent.',
        xe_funds: 'Not enough funds for the amount or for the network fee on {net}.',
        xe_price: 'The price moved and price protection stopped the trade. Check the new quote and try again.',
        xe_route: 'The route expired. The quote has been refreshed — check it and try again.',
        xe_wchanged: 'The wallet or account changed. Check the details and try again.',
        xe_connect: 'The wallet is not connected. Connect it and try again.',
        xe_timeout: 'Your wallet did not answer in time. Check the activity in your wallet: if the transaction is there, it went through; if not, try again.',
        xe_timeout_approve: 'The permission is taking longer than usual. If your wallet shows it as sent, press the button again — the wallet will only ask for the trade.',
        xe_wallet_approve: 'Your wallet declined the permission request without showing it. Your funds did not move. Try again; if it repeats, reconnect the wallet: remove old grom.exchange connections in the WalletConnect section of your wallet and connect again.',
        xe_wallet: 'Your wallet declined the request. Check the activity in your wallet and try again. If it repeats, reconnect the wallet: remove old grom.exchange connections in the WalletConnect section of your wallet and connect again.',
        xe_reconnect: 'Reconnect wallet',
        xe_raw: 'Wallet reply',
      },
      ru: {
        tp_nobal: 'Недостаточно {sym}',
        tp_nobal_buy: 'На балансе {bal} {sym} в сети {net} — на эту сумму не хватает. Уменьшите сумму или выберите токен, который у вас есть.',
        tp_nobal_sell: 'У вас {bal} {sym} в сети {net}. Уменьшите сумму.',
        x_wait: 'Ждём подтверждения в кошельке…',
        x_s1: 'Шаг 1 из 2 · Разрешение на {sym}',
        x_s1_sub: 'Кошелёк попросит разрешить списание {sym} ровно на эту сумму. Это ещё не сделка.',
        x_s1_ok: 'Разрешение подтверждено',
        x_s2: 'Шаг 2 из 2 · Сделка',
        x_s2_sub: 'После разрешения кошелёк попросит подтвердить сделку.',
        xe_rejected: 'Вы отклонили запрос в кошельке. Ничего не отправлено.',
        xe_funds: 'Не хватает средств на сумму или на комиссию сети {net}.',
        xe_price: 'Цена изменилась, и защита цены остановила сделку. Проверьте новую котировку и повторите.',
        xe_route: 'Маршрут устарел. Котировка обновлена — проверьте её и повторите.',
        xe_wchanged: 'Сменился кошелёк или аккаунт. Проверьте данные и повторите.',
        xe_connect: 'Кошелёк не подключён. Подключите его и повторите.',
        xe_timeout: 'Кошелёк не ответил вовремя. Проверьте историю в кошельке: если транзакция там есть — она прошла; если нет — повторите.',
        xe_timeout_approve: 'Разрешение идёт дольше обычного. Если в кошельке оно отправлено, нажмите кнопку ещё раз — кошелёк спросит только сделку.',
        xe_wallet_approve: 'Кошелёк отклонил запрос на разрешение, не показав его. Средства не списывались. Повторите; если повторится — переподключите кошелёк: в кошельке в разделе WalletConnect удалите старые подключения grom.exchange и подключитесь заново.',
        xe_wallet: 'Кошелёк отклонил запрос. Проверьте историю в кошельке и повторите. Если повторится — переподключите кошелёк: в кошельке в разделе WalletConnect удалите старые подключения grom.exchange и подключитесь заново.',
        xe_reconnect: 'Переподключить кошелёк',
        xe_raw: 'Ответ кошелька',
      },
      es: {
        tp_nobal: 'No tienes suficiente {sym}',
        tp_nobal_buy: 'Tienes {bal} {sym} en {net}: no alcanza para este importe. Reduce el importe o elige un token que tengas.',
        tp_nobal_sell: 'Tienes {bal} {sym} en {net}. Reduce el importe.',
        x_wait: 'Esperando a tu wallet…',
        x_s1: 'Paso 1 de 2 · Permiso para {sym}',
        x_s1_sub: 'Tu wallet pedirá permitir {sym} exactamente por este importe. Todavía no es la operación.',
        x_s1_ok: 'Permiso confirmado',
        x_s2: 'Paso 2 de 2 · La operación',
        x_s2_sub: 'Después del permiso, tu wallet pedirá confirmar la operación.',
        xe_rejected: 'Rechazaste la solicitud en tu wallet. No se envió nada.',
        xe_funds: 'No hay fondos suficientes para el importe o para la comisión de red en {net}.',
        xe_price: 'El precio cambió y la protección de precio detuvo la operación. Revisa la nueva cotización e inténtalo de nuevo.',
        xe_route: 'La ruta caducó. La cotización se actualizó: revísala e inténtalo de nuevo.',
        xe_wchanged: 'Cambió la wallet o la cuenta. Revisa los datos e inténtalo de nuevo.',
        xe_connect: 'La wallet no está conectada. Conéctala e inténtalo de nuevo.',
        xe_timeout: 'Tu wallet no respondió a tiempo. Revisa la actividad de tu wallet: si la transacción está ahí, se realizó; si no, inténtalo de nuevo.',
        xe_timeout_approve: 'El permiso tarda más de lo normal. Si tu wallet lo muestra como enviado, pulsa el botón otra vez: la wallet solo pedirá la operación.',
        xe_wallet_approve: 'Tu wallet rechazó la solicitud de permiso sin mostrarla. Tus fondos no se movieron. Inténtalo de nuevo; si se repite, vuelve a conectar la wallet: elimina las conexiones antiguas de grom.exchange en la sección WalletConnect de tu wallet y conéctala otra vez.',
        xe_wallet: 'Tu wallet rechazó la solicitud. Revisa la actividad de tu wallet e inténtalo de nuevo. Si se repite, vuelve a conectar la wallet: elimina las conexiones antiguas de grom.exchange en la sección WalletConnect de tu wallet y conéctala otra vez.',
        xe_reconnect: 'Volver a conectar la wallet',
        xe_raw: 'Respuesta de la wallet',
      },
      tr: {
        tp_nobal: 'Yetersiz {sym}',
        tp_nobal_buy: '{net} ağında {bal} {sym} var — bu tutar için yetmiyor. Tutarı düşür veya sahip olduğun bir token seç.',
        tp_nobal_sell: '{net} ağında {bal} {sym} var. Tutarı düşür.',
        x_wait: 'Cüzdanın bekleniyor…',
        x_s1: 'Adım 1/2 · {sym} için izin',
        x_s1_sub: 'Cüzdanın {sym} için tam bu tutarda izin isteyecek. Bu henüz işlem değil.',
        x_s1_ok: 'İzin onaylandı',
        x_s2: 'Adım 2/2 · İşlem',
        x_s2_sub: 'İzinden sonra cüzdanın işlemi onaylamanı isteyecek.',
        xe_rejected: 'İsteği cüzdanında reddettin. Hiçbir şey gönderilmedi.',
        xe_funds: '{net} ağında tutar veya ağ ücreti için yeterli bakiye yok.',
        xe_price: 'Fiyat değişti ve fiyat koruması işlemi durdurdu. Yeni teklifi kontrol edip tekrar dene.',
        xe_route: 'Rotanın süresi doldu. Teklif yenilendi — kontrol edip tekrar dene.',
        xe_wchanged: 'Cüzdan veya hesap değişti. Bilgileri kontrol edip tekrar dene.',
        xe_connect: 'Cüzdan bağlı değil. Bağlayıp tekrar dene.',
        xe_timeout: 'Cüzdanın zamanında yanıt vermedi. Cüzdan geçmişini kontrol et: işlem oradaysa gerçekleşti; değilse tekrar dene.',
        xe_timeout_approve: 'İzin normalden uzun sürüyor. Cüzdanın onu gönderilmiş gösteriyorsa düğmeye tekrar bas — cüzdan yalnızca işlemi soracak.',
        xe_wallet_approve: 'Cüzdanın izin isteğini göstermeden reddetti. Fonların hareket etmedi. Tekrar dene; tekrarlanırsa cüzdanı yeniden bağla: cüzdanının WalletConnect bölümünde eski grom.exchange bağlantılarını sil ve yeniden bağlan.',
        xe_wallet: 'Cüzdanın isteği reddetti. Cüzdan geçmişini kontrol edip tekrar dene. Tekrarlanırsa cüzdanı yeniden bağla: cüzdanının WalletConnect bölümünde eski grom.exchange bağlantılarını sil ve yeniden bağlan.',
        xe_reconnect: 'Cüzdanı yeniden bağla',
        xe_raw: 'Cüzdan yanıtı',
      },
      zh: {
        tp_nobal: '{sym} 余额不足',
        tp_nobal_buy: '你在 {net} 上有 {bal} {sym}，不足以支付该金额。请降低金额或选择你持有的代币。',
        tp_nobal_sell: '你在 {net} 上有 {bal} {sym}。请降低金额。',
        x_wait: '正在等待钱包确认…',
        x_s1: '第 1 步（共 2 步）· 授权 {sym}',
        x_s1_sub: '钱包会请求按本次金额授权使用 {sym}。这还不是交易本身。',
        x_s1_ok: '授权已确认',
        x_s2: '第 2 步（共 2 步）· 交易',
        x_s2_sub: '授权完成后，钱包会请你确认交易。',
        xe_rejected: '你在钱包中拒绝了请求。未发送任何内容。',
        xe_funds: '{net} 上的余额不足以支付金额或网络手续费。',
        xe_price: '价格已变动，价格保护已停止本次交易。请查看新报价后重试。',
        xe_route: '路线已过期。报价已刷新——请检查后重试。',
        xe_wchanged: '钱包或账户已变更。请检查信息后重试。',
        xe_connect: '钱包未连接。请连接后重试。',
        xe_timeout: '钱包未及时响应。请查看钱包中的记录：如果交易在那里，说明已完成；如果没有，请重试。',
        xe_timeout_approve: '授权比平时慢。如果钱包显示已发送，请再按一次按钮——钱包只会请求确认交易。',
        xe_wallet_approve: '钱包未显示就拒绝了授权请求。你的资金没有变动。请重试；如果再次出现，请重新连接钱包：在钱包的 WalletConnect 设置中删除旧的 grom.exchange 连接，然后重新连接。',
        xe_wallet: '钱包拒绝了请求。请查看钱包中的记录后重试。如果再次出现，请重新连接钱包：在钱包的 WalletConnect 设置中删除旧的 grom.exchange 连接，然后重新连接。',
        xe_reconnect: '重新连接钱包',
        xe_raw: '钱包回复',
      },
      ar: {
        tp_nobal: 'رصيد {sym} غير كافٍ',
        tp_nobal_buy: 'لديك {bal} {sym} على {net} — لا يكفي لهذا المبلغ. خفّض المبلغ أو اختر رمزًا تملكه.',
        tp_nobal_sell: 'لديك {bal} {sym} على {net}. خفّض المبلغ.',
        x_wait: 'بانتظار محفظتك…',
        x_s1: 'الخطوة 1 من 2 · إذن لـ {sym}',
        x_s1_sub: 'ستطلب محفظتك السماح باستخدام {sym} بهذا المبلغ بالضبط. هذه ليست الصفقة بعد.',
        x_s1_ok: 'تم تأكيد الإذن',
        x_s2: 'الخطوة 2 من 2 · الصفقة',
        x_s2_sub: 'بعد الإذن ستطلب منك محفظتك تأكيد الصفقة.',
        xe_rejected: 'رفضت الطلب في محفظتك. لم يُرسل شيء.',
        xe_funds: 'الرصيد غير كافٍ للمبلغ أو لرسوم الشبكة على {net}.',
        xe_price: 'تغيّر السعر وأوقفت حماية السعر الصفقة. راجع عرض السعر الجديد وحاول مرة أخرى.',
        xe_route: 'انتهت صلاحية المسار. تم تحديث عرض السعر — راجعه وحاول مرة أخرى.',
        xe_wchanged: 'تغيّرت المحفظة أو الحساب. راجع البيانات وحاول مرة أخرى.',
        xe_connect: 'المحفظة غير متصلة. اربطها وحاول مرة أخرى.',
        xe_timeout: 'لم تستجب محفظتك في الوقت المناسب. راجع سجل المحفظة: إذا كانت المعاملة موجودة فقد تمت؛ وإلا فحاول مرة أخرى.',
        xe_timeout_approve: 'الإذن يستغرق وقتًا أطول من المعتاد. إذا أظهرت محفظتك أنه أُرسل، فاضغط الزر مرة أخرى — ستطلب المحفظة الصفقة فقط.',
        xe_wallet_approve: 'رفضت محفظتك طلب الإذن دون عرضه. لم تتحرك أموالك. حاول مرة أخرى؛ وإذا تكرر ذلك فأعد ربط المحفظة: احذف اتصالات grom.exchange القديمة من قسم WalletConnect في محفظتك ثم اتصل من جديد.',
        xe_wallet: 'رفضت محفظتك الطلب. راجع سجل المحفظة وحاول مرة أخرى. وإذا تكرر ذلك فأعد ربط المحفظة: احذف اتصالات grom.exchange القديمة من قسم WalletConnect في محفظتك ثم اتصل من جديد.',
        xe_reconnect: 'إعادة ربط المحفظة',
        xe_raw: 'رد المحفظة',
      },
      hi: {
        tp_nobal: '{sym} पर्याप्त नहीं है',
        tp_nobal_buy: '{net} पर आपके पास {bal} {sym} है — इस राशि के लिए पर्याप्त नहीं। राशि कम करें या अपने पास मौजूद टोकन चुनें।',
        tp_nobal_sell: '{net} पर आपके पास {bal} {sym} है। राशि कम करें।',
        x_wait: 'आपके वॉलेट का इंतज़ार…',
        x_s1: 'चरण 1/2 · {sym} की अनुमति',
        x_s1_sub: 'आपका वॉलेट ठीक इसी राशि के लिए {sym} की अनुमति मांगेगा। यह अभी ट्रेड नहीं है।',
        x_s1_ok: 'अनुमति की पुष्टि हुई',
        x_s2: 'चरण 2/2 · ट्रेड',
        x_s2_sub: 'अनुमति के बाद आपका वॉलेट ट्रेड की पुष्टि मांगेगा।',
        xe_rejected: 'आपने वॉलेट में अनुरोध अस्वीकार किया। कुछ नहीं भेजा गया।',
        xe_funds: '{net} पर राशि या नेटवर्क शुल्क के लिए पर्याप्त फ़ंड नहीं है।',
        xe_price: 'कीमत बदल गई और प्राइस प्रोटेक्शन ने ट्रेड रोक दिया। नया कोट देखें और फिर कोशिश करें।',
        xe_route: 'रूट की अवधि समाप्त हो गई। कोट अपडेट हो गया है — इसे देखें और फिर कोशिश करें।',
        xe_wchanged: 'वॉलेट या अकाउंट बदल गया। जानकारी देखें और फिर कोशिश करें।',
        xe_connect: 'वॉलेट कनेक्ट नहीं है। इसे कनेक्ट करें और फिर कोशिश करें।',
        xe_timeout: 'आपके वॉलेट ने समय पर जवाब नहीं दिया। वॉलेट की गतिविधि देखें: अगर ट्रांज़ैक्शन वहाँ है तो वह हो गया; नहीं तो फिर कोशिश करें।',
        xe_timeout_approve: 'अनुमति में सामान्य से ज़्यादा समय लग रहा है। अगर वॉलेट में यह भेजी गई दिखती है, तो बटन फिर दबाएँ — वॉलेट केवल ट्रेड पूछेगा।',
        xe_wallet_approve: 'आपके वॉलेट ने अनुमति का अनुरोध दिखाए बिना अस्वीकार कर दिया। आपके फ़ंड नहीं हिले। फिर कोशिश करें; दोबारा हो तो वॉलेट फिर से कनेक्ट करें: वॉलेट के WalletConnect सेक्शन में grom.exchange के पुराने कनेक्शन हटाएँ और फिर से कनेक्ट करें।',
        xe_wallet: 'आपके वॉलेट ने अनुरोध अस्वीकार कर दिया। वॉलेट की गतिविधि देखें और फिर कोशिश करें। दोबारा हो तो वॉलेट फिर से कनेक्ट करें: वॉलेट के WalletConnect सेक्शन में grom.exchange के पुराने कनेक्शन हटाएँ और फिर से कनेक्ट करें।',
        xe_reconnect: 'वॉलेट फिर से कनेक्ट करें',
        xe_raw: 'वॉलेट का जवाब',
      },
    };
    Object.keys(add).forEach(function (l) { if (I18N[l]) Object.keys(add[l]).forEach(function (k) { I18N[l][k] = add[l][k]; }); });
  })();
  function lang() {
    var l = '';
    try { l = typeof window.getGromLang === 'function' ? window.getGromLang() : (localStorage.getItem('grom_lang') || ''); } catch (_) {}
    return I18N[l] ? l : 'en';
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
    hold: null, holdAt: 0, varBal: {}, payBal: {},
    tr: { side: 'buy', token: null, amt: '', dest: 'auto', openNets: false, routeOpen: true, quote: null, quoting: false, qerr: null, seq: 0, solDest: '', sellKey: '' },
  };
  var root = null;
  var timers = { list: 0, quote: 0 };
  function readFav() { try { return JSON.parse(localStorage.getItem('grom_stock_favs') || '{}') || {}; } catch (_) { return {}; } }
  function saveFav() { try { localStorage.setItem('grom_stock_favs', JSON.stringify(S.fav)); } catch (_) {} }

  /* ---------- helpers ---------- */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function loc() { var l = lang(); return l === 'ru' ? 'ru-RU' : l === 'es' ? 'es-ES' : l === 'tr' ? 'tr-TR' : 'en-US'; }
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
  /* Share glyphs: Simple Icons (CC0-1.0) path data. */
  var SHARE_ICO = {"telegram": "M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z", "facebook": "M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z", "x": "M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z", "whatsapp": "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z", "reddit": "M12 0C5.373 0 0 5.373 0 12c0 3.314 1.343 6.314 3.515 8.485l-2.286 2.286C.775 23.225 1.097 24 1.738 24H12c6.627 0 12-5.373 12-12S18.627 0 12 0Zm4.388 3.199c1.104 0 1.999.895 1.999 1.999 0 1.105-.895 2-1.999 2-.946 0-1.739-.657-1.947-1.539v.002c-1.147.162-2.032 1.15-2.032 2.341v.007c1.776.067 3.4.567 4.686 1.363.473-.363 1.064-.58 1.707-.58 1.547 0 2.802 1.254 2.802 2.802 0 1.117-.655 2.081-1.601 2.531-.088 3.256-3.637 5.876-7.997 5.876-4.361 0-7.905-2.617-7.998-5.87-.954-.447-1.614-1.415-1.614-2.538 0-1.548 1.255-2.802 2.803-2.802.645 0 1.239.218 1.712.585 1.275-.79 2.881-1.291 4.64-1.365v-.01c0-1.663 1.263-3.034 2.88-3.207.188-.911.993-1.595 1.959-1.595Zm-8.085 8.376c-.784 0-1.459.78-1.506 1.797-.047 1.016.64 1.429 1.426 1.429.786 0 1.371-.369 1.418-1.385.047-1.017-.553-1.841-1.338-1.841Zm7.406 0c-.786 0-1.385.824-1.338 1.841.047 1.017.634 1.385 1.418 1.385.785 0 1.473-.413 1.426-1.429-.046-1.017-.721-1.797-1.506-1.797Zm-3.703 4.013c-.974 0-1.907.048-2.77.135-.147.015-.241.168-.183.305.483 1.154 1.622 1.964 2.953 1.964 1.33 0 2.47-.81 2.953-1.964.057-.137-.037-.29-.184-.305-.863-.087-1.795-.135-2.769-.135Z"};
  function glyph(k) { return '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="' + SHARE_ICO[k] + '"/></svg>'; }
  /* Logos come through our own domain (/api/market/stocks/logo/…): cached for a week in the
   * browser and at the edge, so lists show logos right away on repeat visits (2026-11-14). */
  function logo(sym, sz, fallback, eager) {
    sz = sz || 36;
    var ini = esc(String(sym).replace(/[^A-Z]/g, '').slice(0, 2) || String(sym).slice(0, 2));
    var u = '/api/market/stocks/logo/' + encodeURIComponent(String(sym).toUpperCase()) + '.png';
    return '<span class="gs-lg" style="width:' + sz + 'px;height:' + sz + 'px;padding:' + Math.round(sz * 0.1) + 'px" data-ini="' + ini + '" data-h="' + hue(String(sym)) + '">'
      + '<img src="' + u + '" alt="" ' + (eager ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"') + ' decoding="async"' + (fallback ? ' data-fb="' + esc(fallback) + '"' : '') + '></span>';
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
    if (fb) { img.removeAttribute('data-fb'); img.removeAttribute('crossorigin'); img.src = fb; return; }
    var src0 = img.getAttribute('src') || '';
    if (src0.indexOf('/api/market/stocks/logo/') === 0 && !img.getAttribute('data-direct')) {
      /* Our logo route failed (server hiccup): try the logo host directly once. */
      var sym0 = decodeURIComponent(src0.split('/').pop().replace(/\.png$/i, ''));
      img.setAttribute('data-direct', '1');
      img.setAttribute('crossorigin', 'anonymous');
      img.src = 'https://financialmodelingprep.com/image-stock/' + encodeURIComponent(sym0.replace(/\./g, '-')) + '.png';
      return;
    }
    logoInitials(img.parentNode, img);
  }
  function logoInitials(box, img) {
    if (box && box.classList && box.classList.contains('gs-lg')) {
      box.classList.remove('dk');
      box.classList.add('ini');
      box.style.background = 'hsl(' + (box.getAttribute('data-h') || 200) + ',38%,42%)';
      box.style.fontSize = Math.round(parseInt(box.style.width, 10) * 0.34) + 'px';
      box.textContent = box.getAttribute('data-ini') || '';
    } else if (img) {
      img.style.visibility = 'hidden';
    }
  }
  /* Some logos are white marks on a transparent background — invisible on the white tile.
     Sample the loaded image once and switch that tile to a dark background. */
  var LOGO_TONE = {};
  function logoTone(img) {
    try {
      var n = 24, c = document.createElement('canvas'); c.width = n; c.height = n;
      var x = c.getContext('2d', { willReadFrequently: true });
      x.drawImage(img, 0, 0, n, n);
      var d = x.getImageData(0, 0, n, n).data, op = 0, lum = 0;
      for (var i = 0; i < d.length; i += 4) {
        if (d[i + 3] > 48) { op++; lum += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; }
      }
      if (op < 6) return 'empty';
      return (op / (n * n) < 0.92 && lum / op > 212) ? 'dark' : 'light';
    } catch (_) { return 'light'; }
  }
  function onImgLoad(e) {
    var img = e.target;
    if (!img || img.tagName !== 'IMG') return;
    var box = img.parentNode;
    if (!box || !box.classList || !box.classList.contains('gs-lg')) return;
    var key = img.currentSrc || img.src;
    var tone = LOGO_TONE[key] || (LOGO_TONE[key] = logoTone(img));
    if (tone === 'empty') { if (img.getAttribute('data-fb')) { onImgError(e); } else logoInitials(box, img); return; }
    box.classList.toggle('dk', tone === 'dark');
    box.classList.add('ok');
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
  /* On phones the app shell scrolls <main>, not the window (index.html @media max-width:900px). */
  function scroller() {
    var el = root && root.parentElement;
    while (el && el !== document.body && el !== document.documentElement) {
      var oy = getComputedStyle(el).overflowY;
      if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight + 1) return el;
      el = el.parentElement;
    }
    return null;
  }
  function scrollPos() { var sc = scroller(); return sc ? sc.scrollTop : (window.scrollY || 0); }
  function setScroll(y) {
    var sc = scroller();
    if (sc) sc.scrollTop = y;
    try { window.scrollTo({ top: sc ? 0 : y, left: 0, behavior: 'instant' }); } catch (_) { window.scrollTo(0, sc ? 0 : y); }
  }
  var topT = [], topMoved = false, topT0 = 0;
  function onUserScrollIntent() { if (Date.now() - topT0 > 250) topMoved = true; }
  function toTop() {
    var go0 = function () {
      setScroll(0);
      try { document.documentElement.scrollTop = 0; document.body.scrollTop = 0; } catch (_) {}
    };
    topT.forEach(clearTimeout); topT = [];
    topT0 = Date.now(); topMoved = false;
    go0();
    window.addEventListener('touchstart', onUserScrollIntent, { passive: true });
    window.addEventListener('wheel', onUserScrollIntent, { passive: true });
    try { requestAnimationFrame(function () { if (!topMoved) go0(); }); } catch (_) {}
    [120, 360, 800].forEach(function (ms) { topT.push(setTimeout(function () { if (!topMoved && scrollPos() > 0) go0(); }, ms)); });
    topT.push(setTimeout(function () { window.removeEventListener('touchstart', onUserScrollIntent); window.removeEventListener('wheel', onUserScrollIntent); }, 1500));
  }
  function sheetMode() { return window.innerWidth <= 1020; }
  function openSheet() {
    if (!root || !sheetMode()) return;
    root.classList.add('gs-tp-open'); lockPage(true);
    var a = root.querySelector('.gs-aside'); if (a) a.scrollTop = 0;
  }
  function closeSheet() {
    if (!root || !root.classList.contains('gs-tp-open')) return;
    root.classList.remove('gs-tp-open');
    if (!document.getElementById('gsOv')) lockPage(false);
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
  function netsLabel(n) {
    if (n === 1) return t('net_1');
    if (lang() === 'ru') {
      var m10 = n % 10, m100 = n % 100;
      if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return t('nets_few', { n: n });
    }
    return t('nets_n', { n: n });
  }
  function legalCard(id) {
    return '<div class="gs-card gs-sec gs-legal"' + (id ? ' id="' + id + '"' : '') + '><div class="gs-h2">' + esc(t('lg_h')) + '</div>'
      + [1, 2, 3, 4, 5, 6].map(function (i) { return '<p>' + esc(t('lg' + i)) + '</p>'; }).join('') + '</div>';
  }
  function viewList() {
    S.detailSym = '';
    closeSheet();
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
        return '<div class="gs-trend" data-go="' + esc(r.s) + '"><span class="rk">' + (i + 1) + '</span>' + logo(r.s, 36, r.l, true)
          + '<div class="nm"><b>' + esc(r.s) + '</b><small>' + esc(t('vol')) + ' ' + usdS(r.v) + (r.mc ? ' | ' + esc(t('mcap')) + ' ' + usdS(r.mc) : '') + '</small></div>'
          + '<div class="r num"><b>' + px(priceOf(r)) + '</b><small class="' + cls(r.c) + '">' + pct(r.c) + '</small></div></div>';
      }).join('')
      + '</div><div class="gs-card"><div class="gs-h2">' + esc(t('heat')) + '<small>' + esc(t('heat_sub')) + '</small></div><div class="gs-heat" id="gsHeat"><div class="gs-tip" id="gsTip"></div></div></div></div>'
      + '<div class="gs-themes" id="gsThemes">' + THEMES.map(function (th) { return '<button type="button" data-th="' + th + '" class="' + (S.theme === th ? 'on' : '') + '">' + esc(t('th_' + th)) + '</button>'; }).join('') + '</div>'
      + '<div class="gs-toolbar"><label class="gs-search">' + ICO.search + '<input id="gsQ" type="search" autocomplete="off" placeholder="' + esc(t('search')) + '" value="' + esc(S.q) + '"></label>'
      + '<div class="gs-sel" id="gsCatSel"></div><div class="gs-sel" id="gsNetSel"></div><span class="gs-cnt" id="gsCnt"></span></div>'
      + '<div class="gs-card gs-tbl" id="gsTbl"></div><div class="gs-pager" id="gsPager"></div>' + legalCard('');
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
        var th = root.querySelector('#gsThemes'); if (th) { var sc = scroller(); var off = th.getBoundingClientRect().top - (sc ? sc.getBoundingClientRect().top : 0) - (sc ? 12 : 90); if (sc) sc.scrollTo({ top: sc.scrollTop + off, behavior: 'smooth' }); else window.scrollTo({ top: window.scrollY + off, behavior: 'smooth' }); }
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
    if ((S.liqTries || 0) >= 10) return;
    S.liqTries = (S.liqTries || 0) + 1;
    setTimeout(function () {
      if (S.detailSym !== sym) return;
      getJson(API + '/stocks/detail?sym=' + encodeURIComponent(sym), 20000).then(function (d) {
        if (S.detailSym !== sym || !d || !Array.isArray(d.variants)) return;
        if (!d.liquidityKnown) { pollLiquidity(sym); return; }
        S.detail = d;
        applyDetailUpdate(sym);
      }).catch(function () { pollLiquidity(sym); });
    }, S.liqTries < 4 ? 2500 : 6000);
  }
  function applyDetailUpdate(sym) {
    var a = document.activeElement;
    if (a && root && root.contains(a) && a.tagName === 'INPUT') {
      a.addEventListener('blur', function once() { a.removeEventListener('blur', once); if (S.detailSym === sym) viewDetail(sym); });
      return;
    }
    var y = scrollPos();
    if (S.tr.tokenAuto && !S.tr.amt) S.tr.token = null; /* default pay token follows the new best network */
    viewDetail(sym);
    setScroll(y);
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
    if (fresh) closeSheet();
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
      if (fresh) toTop();
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
      + '<div class="gs-dhead">' + logo(r.s, 48, r.l)
      + '<div class="gs-dh-main"><div class="gs-ttl"><h1 data-switch>' + esc(r.n || r.s) + '</h1><button type="button" class="gs-chev" data-switch aria-haspopup="dialog" aria-label="' + esc(t('sw_open')) + '" title="' + esc(t('sw_open')) + '">' + ICO.down + '</button></div>'
      + '<div class="gs-meta"><b>' + esc(r.s) + '</b>' + (r.k ? '<i></i><span>' + esc(t('c_' + r.k)) + '</span>' : '') + '<i></i><span>' + esc(netsLabel((r.nets || []).length)) + '</span></div></div>'
      + '<div class="gs-dacts"><button type="button" class="gs-ghost gs-ic" data-fav1 aria-label="★">' + (S.fav[r.s] ? ICO.star.replace('<svg', '<svg width="16" height="16" style="color:#f5c84a"') : ICO.starO.replace('<svg', '<svg width="16" height="16"')) + '</button><button type="button" class="gs-ghost gs-ic" data-share aria-label="' + esc(t('share')) + '">' + ICO.share + '<span class="gs-sh-t">' + esc(t('share')) + '</span></button></div></div>'
      + '<div class="gs-px"><b class="num">' + px(price) + '</b><span class="gs-chg num ' + cls(r.c) + '">' + pct(r.c) + ' <small>24h</small></span></div>'
      + '<div class="gs-ref">' + esc(t('ex_price')) + ': <b class="num">' + px(ref) + '</b>' + (prem != null ? ' · ' + esc(prem >= 0 ? t('premium') : t('discount')) + ' <b class="num">' + nf(Math.abs(prem), 2) + '%</b>' : '') + '</div>'
      + '<div class="gs-card gs-sec" id="gsChartCard"><div class="gs-chhead"><div class="gs-rng" id="gsRng">' + [['1d', '1D'], ['5d', '5D'], ['1mo', '1M']].map(function (x) { return '<button type="button" data-r="' + x[0] + '" class="' + (S.range === x[0] ? 'on' : '') + '">' + x[1] + '</button>'; }).join('') + '</div><span class="gs-mu" style="font-size:12px">' + esc(t('chart_ex')) + '</span></div>'
      + '<div class="gs-chart" id="gsChart"><div class="gs-ctip" id="gsCtip"></div></div>'
      + '<div class="gs-sess ' + (ss.open ? 'open' : '') + '">' + ICO.clock + '<span><b>' + esc(ss.label) + '.</b> ' + esc(t('sess_closed')) + '</span></div></div>'
      + '</div><div class="gs-tp-bd" data-tp-close></div><div class="gs-aside"><div class="gs-sheet-h"><i class="grab"></i><span>' + logo(r.s, 24, r.l) + '<b>' + esc(r.s) + '</b><small class="num">' + px(price) + '</small></span><button type="button" class="x" data-tp-close aria-label="' + esc(t('tp_close')) + '">' + ICO.x + '</button></div><div class="gs-card gs-tp" id="gsTrade"></div></div><div class="gs-drest">'
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
      + legalCard('gsLegal')
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
    root.querySelectorAll('[data-switch]').forEach(function (b) { b.addEventListener('click', function () { openStockSwitch(r.s); }); });
    root.querySelector('[data-share]').addEventListener('click', function () { openShare(r, price); });
    root.querySelectorAll('#gsRng button').forEach(function (b) {
      b.addEventListener('click', function () { S.range = b.getAttribute('data-r'); root.querySelectorAll('#gsRng button').forEach(function (x) { x.classList.toggle('on', x === b); }); drawChart(); });
    });
    root.querySelectorAll('[data-tp-close]').forEach(function (b) { b.addEventListener('click', closeSheet); });
    root.querySelectorAll('[data-mb]').forEach(function (b) {
      b.addEventListener('click', function () { setSide(b.getAttribute('data-mb')); openSheet(); });
    });
    drawChart();
    renderTrade();
    if (fresh) toTop();
    if (S.pendingTrade) {
      S.pendingTrade = false;
      setTimeout(function () {
        var i = root && root.querySelector('#gsAmt');
        if (sheetMode()) openSheet();
        else if (i) { try { i.focus({ preventScroll: true }); } catch (_) {} }
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
      if (tr.side === 'buy' && (!tr.token || tr.tokenAuto)) {
        var mine = bestPayHolding();
        var amtSet = parseFloat(tr.amt) > 0;
        /* Swap the auto token only when the typed amount keeps its meaning (stable → stable). */
        if (mine && tokKey(mine) !== tokKey(tr.token) && (!amtSet || (tr.token && STABLE_RE.test(tr.token.sym) && STABLE_RE.test(mine.sym)))) {
          tr.token = mine; tr.tokenAuto = true; tr.quote = null;
          if (amtSet) { renderTrade(); scheduleQuote(true); return; }
        }
      }
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
  /* Default pay token = what the wallet actually holds (2026-11-13 real test: the
   * default was USDC on Ethereum with a 0 balance while the funds were on Arbitrum).
   * Stablecoins first, then the largest holding; the Auto network follows it. */
  var STABLE_RE = /^(USDC|USDT|USDG|DAI|USDE|USDC\.E|USDT0|PYUSD|FDUSD)$/i;
  function bestPayHolding() {
    if (!S.hold || !S.hold.length) return null;
    var w = wallet();
    var ok = S.hold.filter(function (h) {
      if (!(h && h.usd >= 1)) return false;
      if (h.netKey === 'solana') return !!w.sol;
      return !!w.evm && !!CH[h.netKey];
    });
    if (!ok.length) return null;
    var best = S.detail ? bestVariant(S.detail, null) : null;
    function score(h) { return h.usd * (STABLE_RE.test(h.sym) ? 1 : 0.6) * (best && h.netKey === best.net ? 1.15 : 1); }
    return ok.slice().sort(function (a, b) { return score(b) - score(a); })[0];
  }
  function tokKey(tok) { return tok ? tok.chainId + ':' + String(tok.address).toLowerCase() : ''; }
  /* Exact on-chain balance of the pay token — holdings can miss a network that did not answer. */
  function checkPayBal(tok) {
    if (!tok || !connected() || typeof window.gwStocksTokenBalance !== 'function') return;
    var k = tokKey(tok), cur = S.payBal[k];
    if (cur && (cur.pending || Date.now() - cur.at < 20000)) return;
    S.payBal[k] = { pending: true, at: Date.now(), amt: cur ? cur.amt : null };
    window.gwStocksTokenBalance(tok).then(function (b) {
      S.payBal[k] = { pending: false, at: Date.now(), amt: (b == null || !isFinite(b)) ? null : b };
    }).catch(function () { S.payBal[k] = { pending: false, at: Date.now(), amt: null }; })
      .then(function () {
        var tr = S.tr;
        if (!tr.token || tokKey(tr.token) !== k) return;
        if (!tr.quote && !tr.quoting && parseFloat(tr.amt) > 0 && !overBalance()) scheduleQuote(true);
        else paintTradeState();
      });
  }
  /* null = unknown (never block on unknown). */
  function payBalOf(tok) {
    if (!tok) return null;
    var x = S.payBal[tokKey(tok)];
    if (x && x.amt != null) return x.amt;
    var h = holdingOf(tok);
    if (h) return h.amt;
    if (S.hold && x && !x.pending && x.amt == null) return null;
    return null;
  }
  function defaultPayToken() {
    var w = wallet();
    if (typeof window.gwStocksTokenRef !== 'function') return null;
    var mine = bestPayHolding();
    if (mine) return mine;
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
    if (buy && tok) checkPayBal(tok);
    var payBox, recvBox, destHtml = '';
    if (buy) {
      var pb = payBalOf(tok);
      payBox = '<div class="gs-box"><div class="lbl"><span>' + esc(t('tp_pay')) + '</span><span>' + (tok && pb != null ? esc(t('tp_bal')) + ': <span class="num">' + (pb > 0 ? amtF(pb) : '0') + '</span> ' + esc(tok.sym) : '') + '</span></div>'
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
      + '<div class="gs-fine">' + esc(t('tp_fine')) + ' <a href="#" data-legal>' + esc(t('tp_legal')) + '</a></div>';
    var lgA = el.querySelector('[data-legal]');
    if (lgA) lgA.addEventListener('click', function (e) { e.preventDefault(); closeSheet(); var lg = root.querySelector('#gsLegal'); if (lg) setTimeout(function () { lg.scrollIntoView({ block: 'start', behavior: 'smooth' }); }, sheetMode() ? 280 : 0); });
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
    var haveBal = buy ? payBalOf(tok) : (v ? (S.varBal[vkey(v)] != null ? S.varBal[vkey(v)] : null) : null);
    var shortBal = connected() && !!tok && haveBal != null && amt > 0 && amt > haveBal * (1 + 1e-9) + 1e-12;
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
    if (shortBal) {
      var tn = buy ? ((CH[tok.netKey] || {}).name || tok.netKey) : netName;
      warn += '<div class="gs-warn y">' + ICO.info + '<span>' + esc(t(buy ? 'tp_nobal_buy' : 'tp_nobal_sell', { bal: haveBal > 0 ? amtF(haveBal) : '0', sym: buy ? tok.sym : sym, net: tn }))
        + (buy ? '<br><button type="button" class="gs-ghost" style="margin-top:8px" data-pick-pay>' + esc(t('tp_pick_tok')) + '</button>' : '') + '</span></div>';
    } else if (tr.qerr) {
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
    var pp = wl.querySelector('[data-pick-pay]');
    if (pp) pp.addEventListener('click', function () { openPicker('pay'); });
    var pn = wl.querySelector('[data-pick-net]');
    if (pn) pn.addEventListener('click', function () { openPicker(tr.side === 'buy' ? 'pay' : 'recv', pn.getAttribute('data-pick-net')); });
    /* CTA */
    var c = el.querySelector('#gsCta');
    var cta = function (cl, text, dis, fn) { c.className = 'gs-cta ' + cl; c.textContent = text; c.disabled = !!dis; c.onclick = fn || null; };
    if (!connected()) cta('c', t('tp_connect'), false, function () { if (typeof window.openConnectModal === 'function') window.openConnectModal(); });
    else if (!buy && !v) cta('s', t('tp_sell_x', { sym: sym }), true);
    else if (!(amt > 0)) cta(buy ? 'b' : 's', t('tp_enter'), true);
    else if (shortBal) cta(buy ? 'b' : 's', t('tp_nobal', { sym: buy ? tok.sym : sym }), true);
    else if (tr.quoting) cta(buy ? 'b' : 's', t('tp_quoting'), true);
    else if (!q || tr.qerr || q.impactBlocked) cta(buy ? 'b' : 's', buy ? t('tp_buy_x', { sym: sym }) : t('tp_sell_x', { sym: sym }), true);
    else cta(buy ? 'b' : 's', (buy ? t('tp_buy_x', { sym: amtF(outTokens) + ' ' + sym }) : t('tp_sell_x', { sym: amtF(amt) + ' ' + sym })), false, function () { execute(q); });
  }
  function overBalance() {
    var tr = S.tr, amt = parseFloat(tr.amt) || 0;
    if (!(amt > 0) || !S.detail || !connected()) return false;
    var bal;
    if (tr.side === 'buy') bal = payBalOf(tr.token);
    else { var v = sellVariant(S.detail); bal = v && S.varBal[vkey(v)] != null ? S.varBal[vkey(v)] : null; }
    return bal != null && amt > bal * (1 + 1e-9) + 1e-12;
  }
  function scheduleQuote(now) {
    var tr = S.tr;
    tr.quote = null; tr.qerr = null;
    clearTimeout(timers.quote);
    var amt = parseFloat(tr.amt) || 0;
    if (!(amt > 0) || !S.detail || !connected()) { tr.quoting = false; paintTradeState(); return; }
    /* No route for money the wallet does not have — the panel says so instead. */
    if (overBalance()) { tr.quoting = false; tr.seq++; paintTradeState(); return; }
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
      + '<div class="mb lst"><label class="gs-search">' + ICO.search + '<input id="gsPkQ" autocomplete="off" placeholder="' + esc(t('pk_search')) + '"></label><div class="chs" id="gsPkChs"></div><div class="tl" id="gsPkList"></div></div></div>';
    document.body.appendChild(ov); lockPage(true);
    ov.addEventListener('error', onImgError, true);
    ov.addEventListener('load', onImgLoad, true);
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
  function openStockSwitch(cur) {
    closeOverlay();
    var ov = document.createElement('div'); ov.className = 'gs-ov gs-ov-sw'; ov.id = 'gsOv';
    ov.innerHTML = '<div class="gs-mdl gs-sw" role="dialog" aria-modal="true"><div class="mh">' + esc(t('sw_title')) + '<button type="button" class="x" data-x>' + ICO.x + '</button></div>'
      + '<div class="mb lst"><label class="gs-search">' + ICO.search + '<input id="gsSwQ" type="search" autocomplete="off" placeholder="' + esc(t('search')) + '"></label><div class="tl" id="gsSwList"></div></div></div>';
    document.body.appendChild(ov); lockPage(true);
    ov.addEventListener('error', onImgError, true);
    ov.addEventListener('load', onImgLoad, true);
    var qq = '';
    function row(x) {
      return '<button type="button" data-sw="' + esc(x.s) + '"' + (x.s === cur ? ' class="on"' : '') + '>' + logo(x.s, 34, x.l)
        + '<span style="min-width:0"><span class="t">' + esc(x.s) + '</span><div class="n">' + esc(x.n || '') + '</div></span>'
        + '<span class="r"><b class="num">' + px(priceOf(x)) + '</b><small class="num ' + cls(x.c) + '">' + pct(x.c) + '</small></span></button>';
    }
    /* Every stock is listed; rows are rendered in pages as the list scrolls. */
    var items = [], shown = 0, PAGE = 80;
    function byCap(a, b) { return (b.mc || 0) - (a.mc || 0) || (b.v || 0) - (a.v || 0) || (a.s < b.s ? -1 : 1); }
    function more() {
      var el = ov.querySelector('#gsSwList'); if (!el || shown >= items.length) return;
      var next = items.slice(shown, shown + PAGE); shown += next.length;
      el.insertAdjacentHTML('beforeend', next.map(function (x) { return x.gh ? '<div class="gh">' + esc(x.gh) + '</div>' : row(x); }).join(''));
    }
    function list() {
      var rows = S.rows || [], el = ov.querySelector('#gsSwList');
      items = []; shown = 0;
      if (!rows.length) { el.innerHTML = '<div class="gs-skel"></div><div class="gs-skel"></div><div class="gs-skel"></div>'; return; }
      if (qq) {
        var hit = rows.filter(function (x) { return x.s.toLowerCase().indexOf(qq) >= 0 || String(x.n || '').toLowerCase().indexOf(qq) >= 0; });
        hit.sort(function (a, b) {
          var ra = a.s.toLowerCase() === qq ? 0 : a.s.toLowerCase().indexOf(qq) === 0 ? 1 : 2;
          var rb = b.s.toLowerCase() === qq ? 0 : b.s.toLowerCase().indexOf(qq) === 0 ? 1 : 2;
          return ra - rb || byCap(a, b);
        });
        items = hit;
        el.innerHTML = hit.length ? '' : '<div class="gs-mu" style="padding:18px 6px">' + esc(t('sw_none')) + '</div>';
      } else {
        var fav = rows.filter(function (x) { return S.fav[x.s]; }).sort(byCap);
        var rest = rows.filter(function (x) { return !S.fav[x.s]; }).sort(byCap);
        if (fav.length) items.push({ gh: t('sw_fav') });
        items = items.concat(fav);
        items.push({ gh: t('sw_all', { n: nf(rows.length, 0) }) });
        items = items.concat(rest);
        el.innerHTML = '';
      }
      el.scrollTop = 0;
      more();
    }
    ov.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[data-sw]'); if (!b) return;
      var sym = b.getAttribute('data-sw'); closeOverlay(); if (sym !== cur) go(sym);
    });
    ov.querySelector('[data-x]').addEventListener('click', closeOverlay);
    ov.addEventListener('click', function (e) { if (e.target === ov) closeOverlay(); });
    var qi = ov.querySelector('#gsSwQ'); qi.addEventListener('input', function () { qq = qi.value.trim().toLowerCase(); list(); });
    var sl = ov.querySelector('#gsSwList');
    sl.addEventListener('scroll', function () { if (sl.scrollTop + sl.clientHeight > sl.scrollHeight - 600) more(); }, { passive: true });
    list();
    if (!S.rows) loadList().then(function () { if (document.getElementById('gsOv') === ov) list(); });
    setTimeout(function () { if (window.innerWidth > 760) qi.focus(); }, 30);
  }
  function openShare(r, price) {
    closeOverlay();
    var url = location.origin + '/stocks?sym=' + encodeURIComponent(r.s) + '#xstocks';
    var name = r.n || r.s;
    var text = t('sh_text', { name: name, sym: r.s, price: px(price), chg: pct(r.c) });
    var U = encodeURIComponent(url), T = encodeURIComponent(text);
    var nets = [
      ['telegram', 'Telegram', 'https://t.me/share/url?url=' + U + '&text=' + T],
      ['facebook', 'Facebook', 'https://www.facebook.com/sharer/sharer.php?u=' + U],
      ['x', 'X', 'https://x.com/intent/tweet?text=' + T + '&url=' + U],
      ['whatsapp', 'WhatsApp', 'https://wa.me/?text=' + encodeURIComponent(text + ' ' + url)],
      ['reddit', 'Reddit', 'https://www.reddit.com/submit?url=' + U + '&title=' + T],
    ];
    var ov = document.createElement('div'); ov.className = 'gs-ov gs-ov-sh'; ov.id = 'gsOv';
    ov.innerHTML = '<div class="gs-mdl gs-share" role="dialog" aria-modal="true"><div class="mh">' + esc(t('sh_title')) + '<button type="button" class="x" data-x aria-label="' + esc(t('tp_close')) + '">' + ICO.x + '</button></div>'
      + '<div class="mb"><p class="sub">' + esc(t('sh_sub', { name: name })) + '</p>'
      + '<div class="pv">' + logo(r.s, 40, r.l) + '<span class="m"><b>' + esc(name) + '</b><small>' + esc(r.s) + ' · GROM</small></span><span class="r"><b class="num">' + px(price) + '</b><small class="num ' + cls(r.c) + '">' + pct(r.c) + ' 24h</small></span></div>'
      + '<div class="lk"><span class="u">' + esc(url.replace(/^https?:\/\//, '')) + '</span><button type="button" data-copy-link>' + esc(t('sh_copy')) + '</button></div>'
      + '<div class="nets">' + nets.map(function (n) { return '<a class="sn sn-' + n[0] + '" href="' + esc(n[2]) + '" target="_blank" rel="noopener noreferrer" title="' + esc(n[1]) + '" aria-label="' + esc(n[1]) + '">' + glyph(n[0]) + '</a>'; }).join('')
      + '<button type="button" class="sn" data-copy-link title="' + esc(t('sh_link')) + '" aria-label="' + esc(t('sh_link')) + '"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3.2-3.2a4.5 4.5 0 0 0-6.4-6.4L12 5.6"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3.2 3.2a4.5 4.5 0 0 0 6.4 6.4l1.2-1.2"/></svg></button>'
      + (navigator.share ? '<button type="button" class="sn" data-native title="' + esc(t('sh_more')) + '" aria-label="' + esc(t('sh_more')) + '"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg></button>' : '')
      + '</div></div></div>';
    document.body.appendChild(ov); lockPage(true);
    ov.addEventListener('error', onImgError, true);
    ov.addEventListener('load', onImgLoad, true);
    ov.querySelector('[data-x]').addEventListener('click', closeOverlay);
    ov.addEventListener('click', function (e) { if (e.target === ov) closeOverlay(); });
    ov.querySelectorAll('[data-copy-link]').forEach(function (b) {
      b.addEventListener('click', function () { try { navigator.clipboard.writeText(url); } catch (_) {} toast(t('link_copied')); });
    });
    var nb = ov.querySelector('[data-native]');
    if (nb) nb.addEventListener('click', function () { try { navigator.share({ title: name + ' · GROM', text: text, url: url }).catch(function () {}); } catch (_) {} });
  }
  var lockedEl = null;
  function lockPage(on) {
    try { document.documentElement.classList.toggle('gs-lock', !!on); } catch (_) {}
    if (on && !lockedEl) {
      var sc = scroller();
      if (sc) { lockedEl = sc; sc.setAttribute('data-gs-ov', sc.style.overflowY || ''); sc.style.overflowY = 'hidden'; }
    } else if (!on && lockedEl) {
      lockedEl.style.overflowY = lockedEl.getAttribute('data-gs-ov') || ''; lockedEl.removeAttribute('data-gs-ov'); lockedEl = null;
    }
  }
  function closeOverlay() { var o = document.getElementById('gsOv'); if (o) o.remove(); lockPage(!!(root && root.classList.contains('gs-tp-open'))); }
  function onKey(e) { if (e.key !== 'Escape') return; if (document.getElementById('gsOv')) closeOverlay(); else closeSheet(); }

  /* ---------- execution ---------- */
  /* Wallet errors in plain words (2026-11-13 real test showed the raw
   * "An error has occurred. Please, try again." from Trust Wallet). */
  function friendlyErr(e, net) {
    var raw = String((e && e.message) || e || '');
    var step = e && e.gsStep;
    var rej = typeof window.gwStocksIsUserReject === 'function' ? window.gwStocksIsUserReject(e) : /reject|denied|cancel/i.test(raw);
    if (rej) return { msg: t('xe_rejected'), recon: false, raw: '' };
    if (/insufficient funds|exceeds balance|insufficient balance|transfer amount exceeds/i.test(raw)) return { msg: t('xe_funds', { net: net }), recon: false, raw: raw };
    if (/price protection|Price moved/i.test(raw)) return { msg: t('xe_price'), recon: false, raw: '' };
    if (/Route expired|Route changed|refresh the quote|would fail on-chain/i.test(raw)) return { msg: t('xe_route'), recon: false, raw: '' };
    if (/Wallet changed|Solana wallet changed/i.test(raw)) return { msg: t('xe_wchanged'), recon: false, raw: '' };
    if (/Connect (EVM wallet|Phantom)/i.test(raw)) return { msg: t('xe_connect'), recon: true, raw: '' };
    if (/timed? ?out|timeout|still connecting/i.test(raw)) return { msg: t(step === 'approve' ? 'xe_timeout_approve' : 'xe_timeout'), recon: true, raw: raw };
    return { msg: t(step === 'approve' ? 'xe_wallet_approve' : 'xe_wallet'), recon: true, raw: raw };
  }
  function reconnectWallet() {
    closeOverlay();
    var w = window.gromWallet;
    var p = (w && typeof w.disconnect === 'function') ? Promise.resolve().then(function () { return w.disconnect(); }) : Promise.resolve();
    p.catch(function () {}).then(function () {
      setTimeout(function () { if (typeof window.openConnectModal === 'function') window.openConnectModal(); }, 350);
    });
  }
  function execute(q) {
    if (!q || typeof window.gwStocksExecute !== 'function') return;
    var tr = S.tr, d = S.detail, v = destVariant(d), sym = S.detailSym, buy = tr.side === 'buy';
    var tok = tr.token;
    var outTokens = Number(q.toAmount) / Math.pow(10, Number(q.outDecimals) || 18);
    closeOverlay();
    var ov = document.createElement('div'); ov.className = 'gs-ov'; ov.id = 'gsOv';
    var netName = (CH[v.net] || {}).name || v.net;
    var payNet = buy ? ((CH[tok.netKey] || {}).name || tok.netKey) : netName;
    var spendSym = buy ? tok.sym : ((v && v.s) || sym);
    ov.innerHTML = '<div class="gs-mdl" role="dialog" aria-modal="true"><div class="mh">' + esc(buy ? t('tp_buy_x', { sym: sym }) : t('tp_sell_x', { sym: sym })) + '<button type="button" class="x" data-x>' + ICO.x + '</button></div>'
      + '<div class="mb"><div class="steps" id="gsSteps"><div class="run" data-st="swap"><i></i><span>' + esc(t('x_confirm')) + '<small>' + esc(t('x_confirm_sub')) + '</small></span></div></div>'
      + '<button type="button" class="gs-cta" id="gsXDone" disabled>' + esc(t('x_wait')) + '</button></div></div>';
    document.body.appendChild(ov); lockPage(true);
    var steps = ov.querySelector('#gsSteps'), done = ov.querySelector('#gsXDone');
    var approved = false;
    function row(st) { return steps.querySelector('[data-st="' + st + '"]'); }
    function setRow(st, cl, title, sub) {
      var r = row(st);
      if (!r) { r = document.createElement('div'); r.setAttribute('data-st', st); steps.appendChild(r); }
      r.className = cl; r.innerHTML = '<i></i><span>' + esc(title) + (sub ? '<small>' + sub + '</small>' : '') + '</span>';
      return r;
    }
    /* Two wallet confirmations when a permission is needed: say so up front. */
    function onStep(st) {
      if (!document.body.contains(ov)) return;
      if (st === 'approve') {
        approved = true;
        steps.innerHTML = '';
        setRow('approve', 'run', t('x_s1', { sym: spendSym }), esc(t('x_s1_sub', { sym: spendSym })));
        setRow('swap', '', t('x_s2'), esc(t('x_s2_sub')));
      } else if (st === 'swap') {
        if (approved) {
          setRow('approve', 'ok', t('x_s1', { sym: spendSym }), esc(t('x_s1_ok')));
          setRow('swap', 'run', t('x_s2'), esc(t('x_confirm_sub')));
        } else setRow('swap', 'run', t('x_confirm'), esc(t('x_confirm_sub')));
      }
    }
    function finish(label) { done.disabled = false; done.textContent = label || t('x_close'); done.onclick = function () { closeOverlay(); }; }
    ov.querySelector('[data-x]').addEventListener('click', closeOverlay);
    window.gwStocksExecute(q, { tokenPriceUsd: (holdingOf(tok) || {}).priceUsd || 0, onStep: onStep }).then(function (res) {
      if (approved) setRow('approve', 'ok', t('x_s1', { sym: spendSym }), esc(t('x_s1_ok')));
      var s1 = row('swap') || setRow('swap', 'ok', t('x_confirm'), ''); s1.className = 'ok';
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
      tr.amt = ''; tr.quote = null; S.hold = null; S.payBal = {};
      setTimeout(function () { if (S.detail) { refreshBalances(S.detail); renderTrade(); } }, 1500);
    }).catch(function (e) {
      try { console.warn('[GROM stocks] trade failed', e && e.gsStep, e && (e.code != null ? e.code : ''), String((e && e.message) || e || '').slice(0, 300)); } catch (_) {}
      var st = (e && e.gsStep === 'approve' && row('approve')) ? 'approve' : 'swap';
      var fe = friendlyErr(e, payNet);
      var r = row(st) || setRow(st, 'err', t('x_fail'), '');
      var title = st === 'approve' ? t('x_s1', { sym: spendSym }) + ' — ' + t('x_fail').toLowerCase()
        : (approved ? t('x_s2') + ' — ' + t('x_fail').toLowerCase() : t('x_fail'));
      r.className = 'err';
      r.innerHTML = '<i></i><span>' + esc(title) + '<small>' + esc(fe.msg) + (fe.raw ? '<br><span class="gs-raw">' + esc(t('xe_raw')) + ': ' + esc(fe.raw.slice(0, 140)) + '</span>' : '') + '</small></span>';
      if (st === 'approve' && row('swap')) row('swap').className = 'off';
      if (fe.recon) {
        var rb = document.createElement('button');
        rb.type = 'button'; rb.className = 'gs-rc'; rb.textContent = t('xe_reconnect');
        rb.addEventListener('click', reconnectWallet);
        steps.appendChild(rb);
      }
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
      root.addEventListener('load', onImgLoad, true);
    }
    /* Booted in the background on other pages: wait until Stocks is actually opened. */
    if (!stocksWanted(sec)) {
      if (!lazyBound) {
        lazyBound = true;
        window.addEventListener('grom:route-change', function (e) {
          if (e && e.detail && e.detail.page === 'xstocks') setTimeout(function () { mount(document.getElementById('page-xstocks')); }, 0);
        });
      }
      return;
    }
    if (!S.indices) loadIndices().then(function () { var s = root && root.querySelector('.gs-strip'); if (s) s.outerHTML = stripHtml(); });
    if (!S.rows) loadList();
    render();
  }
  var lazyBound = false;
  function stocksWanted(sec) {
    if (sec && sec.classList.contains('active')) return true;
    var r = ''; try { r = document.documentElement.getAttribute('data-grom-route') || ''; } catch (_) {}
    if (r === 'xstocks') return true;
    return /^#xstocks/.test(location.hash || '') || /^\/stocks/.test(location.pathname || '');
  }

  window.gromStocks = { mount: mount, open: function (sym) { go(String(sym || '').toUpperCase()); } };
})();
