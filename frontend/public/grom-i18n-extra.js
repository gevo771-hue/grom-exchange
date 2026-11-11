/**
 * Extended UI strings — predict/xstocks + full page coverage for all 7 langs.
 * Merged into window.GROM_STR after grom-i18n.js loads.
 */
(function () {
  'use strict';

  var EXTRA = {
    ru: {
      ref_new_title: "Приглашайте своих.",
      ref_new_sub: "Ваша ссылка. Ваше сообщество в GROM.",
      ref_new_share: "Поделиться",
      ref_new_rewards: "Приглашения учитываются. Вознаграждения и выплаты пока не запущены.",
      ref_new_details: "Как учитываются приглашения",
      ref_new_poster: "DeFi начинается с вашего кошелька.",
      ref_new_join: "Присоединяйтесь ко мне в GROM",
      ref_new_save: "Сохранить",
      ref_new_more: "Ещё…",
      ref_steps_title: "Как это работает",
      ref_step1_t: "Поделитесь ссылкой",
      ref_step1_p: "Отправьте ссылку или код другу — в Telegram, X или где вы общаетесь.",
      ref_step2_t: "Друг подключает кошелёк",
      ref_step2_p: "Новый кошелёк закрепляется за вами при первом входе по вашей ссылке.",
      ref_step3_t: "Приглашение засчитано",
      ref_step3_p: "Следите за приглашениями в статистике ниже. Награды пока не запущены.",
      ref_art_caption: "Ваша сеть в GROM",
      ref_card_title: "Пригласите друзей",
      ref_card_live: "Учёт включён",
      ref_share_via: "Поделиться в",
      ref_overview: "Обзор",
      ref_rules_title: "Правила",

      px_pm_live_bal: "Баланс прогнозов · pUSD · Polygon",
      px_poly_bal: "pUSD · Polygon",
      px_cat_us_election: "Выборы США",
      px_pm_fund_poly: "Получить pUSD через своп",
      px_pm_return: "Вернуться к прогнозу", px_pm_return_hint: "После подтверждения свопа вернитесь к прогнозу: баланс pUSD обновится автоматически.", px_pm_fallback: "Нет маршрута? Через USDC.e", px_pm_fallback_hint: "Получите USDC.e на Polygon, затем конвертируйте его в pUSD в Прогнозах.", px_pm_ready: "Ваш pUSD уже доступен для прогнозов. Конвертация не нужна.", px_pm_add_funds: "Получите pUSD через своп или конвертируйте имеющийся USDC.e ниже.", px_pm_convert: "Конвертировать USDC.e в pUSD",
      px_pm_swap_hint: "Получите pUSD на Polygon и вернитесь к выбранному прогнозу.",
      px_pm_need_poly_funds: "Недостаточно pUSD. Пополните баланс прогнозов.",
      px_pm_funding_help: "Как пополнить прогнозы?",
      px_pm_refresh_help: "«Проверить баланс» только считывает средства из кошелька — без перевода и подписи.",
      px_pm_conversion_hint: "Для прогнозов нужен pUSD на Polygon. Его можно получить через своп, если доступен маршрут. Если у вас уже есть USDC.e — перенесённый через мост USDC — конвертируйте его здесь в pUSD. При отсутствии прямого маршрута используйте своп в USDC.e, затем конвертацию. Каждую операцию подтверждаете вы; для комиссии Polygon нужен POL.",
      px_pm_refresh: "Проверить баланс",
      px_pm_pending: "Предыдущий запрос ещё проверяется.",
      px_pm_tx_hash: "Хеш транзакции из истории кошелька (0x…)",
      px_pm_recover: "Проверить предыдущий запрос",
      px_pm_rejected: "Я отклонил запрос в кошельке",
      px_pm_recover_wallet: "Если транзакция отправлена, вставьте её хеш из истории кошелька. Если запрос отклонён, подтвердите это ниже.",
      px_pm_recover_hint: "Проверка существующего запроса без повторной отправки. Для чтения статуса заявки может потребоваться подпись входа.",
      px_pm_unfilled: "Запрос не исполнен. Проверьте баланс и позиции.",
      px_pm_reconciled: "Статус запроса обновлён. Проверьте баланс и позиции.",
      px_pm_rejected_confirm: "Продолжайте, только если вы отклонили запрос в кошельке и транзакция не была отправлена. Это снимет ожидание на сайте, но не отменит транзакцию.",
      px_pm_balance_unavailable: "Не удалось обновить баланс. Повторите проверку.",
      px_pm_converted: "Конвертация подтверждена",
      px_pm_fund_hint: "Пополнение из другой сети: своп в USDC.e на Polygon, затем конвертация в pUSD.",
      px_pm_fund_hint_empty: "Для ставки нужен pUSD на Polygon. Пополнение доступно через своп и конвертацию.",
      nav_predict: 'Прогнозы', nav_xstocks: 'Акции',
      pg_predict_bc: 'Прогнозы', pg_xstocks_bc: 'Акции',
      pg_predict_title: 'Рынки прогнозов', pg_predict_sub: '',
      pg_xstocks_title: 'Токенизированные акции',
      px_stock_title: 'Акции',
      px_stock_intro: 'Акции и ETF в токенах. Торгуйте из своего кошелька.',
      pg_xstocks_sub: 'Реальные акции S&P 500 / NASDAQ в токенах on-chain. Живая цена · non-custodial свопы.',
      px_demo_bal: 'Баланс', px_vol_24h: 'Объём 24ч', px_markets_n: 'Рынков', px_tickers: 'Тикеров', px_trading: 'Торговля',
      px_search_predict: 'Поиск рынков…', px_search_stocks: 'Поиск тикера…',
      px_my_bets: 'Мои ставки', px_my_positions: 'Мои позиции',
      px_yes: 'Да', px_no: 'Нет', px_draw: 'Ничья', px_chance: 'шанс', px_vol: 'Объём', px_outcome: 'Исход', px_buy: 'Купить', px_sell: 'Продать',
      px_cat_all: 'Все', px_cat_sport: 'Спорт', px_cat_crypto: 'Криптовалюта', px_cat_esports: 'Киберспорт',
      px_cat_politics: 'Политика', px_cat_culture: 'Культура', px_cat_finance: 'Финансы', px_cat_economy: 'Экономика',
      px_scat_all: 'Все', px_scat_tech: 'Технологии', px_scat_finance: 'Финансы', px_scat_etf: 'ETF',
      px_scat_auto: 'Авто', px_scat_consumer: 'Потребительские', px_scat_crypto: 'Крипто-сектор',
      px_scat_energy: 'Энергетика', px_scat_health: 'Здоровье',
      px_col_ticker: 'Тикер', px_col_price: 'Цена', px_col_chg: '24ч %', px_col_vol: 'Объём 24ч', px_col_mc: 'Капитализация',
      px_reference_price: "Ориентир",
      px_reference_help: "Справочная цена за акцию. Итоговая цена сделки рассчитывается для вашей суммы.",
      px_buy_quote_help: 'Средняя цена покупки по доступному маршруту. Перед сделкой котировка пересчитывается под введённую сумму; газ оплачивается отдельно.',
      px_buy_quote_unavailable: 'Сейчас нет доступной котировки покупки.',
      px_none: 'Ничего не найдено по этому фильтру 🔍', px_none_stocks: 'Ничего не найдено 🔍',
      px_foot_predict: 'Live-вероятности · комиссия GROM {pct}% · расчёт через oracle после фиксации исхода.',
      px_foot_xstocks: 'Оплата в USDC или USDT. Токен, сеть получения и комиссия указаны в расчёте маршрута. Сделку подтверждаете вы в кошельке.',
      px_stable_balance: 'USDC + USDT · все сети',
      px_balance_loading: 'Загружаем доступные USDC и USDT…',
      px_pay_with: 'Оплатить токеном',
      px_select_payment: 'Нет доступных USDC или USDT. Проверьте баланс кошелька.',
      px_insufficient_payment: 'Недостаточно выбранного токена в этой сети.',
      px_insufficient_token: 'Недостаточно {token}',
      px_available_payment: 'Доступно:',
      px_no_stables: 'Нет USDC / USDT',
      px_trade_unavailable: 'Сделка недоступна',
      px_unfavorable_rate: 'Невыгодный курс',
      px_quote_value_gap: 'По проверочной цене стоимость получаемых токенов примерно на {n}% ниже суммы оплаты. Сделка заблокирована. Обновите расчёт или измените сумму.',
      px_retry_quote: 'Обновить расчёт',
      px_retry_wait: 'Повтор через {seconds} с',
      px_reference_unavailable: 'Цена недоступна',
      px_reference_price_missing: 'Проверочная цена акции временно недоступна. Нажмите «Обновить расчёт» для повторной проверки.',
      px_payment_separate: 'Одна покупка — один токен в одной сети. Газ оплачивается отдельно.',
      px_no_payment_route: 'Нет доступного маршрута для этого токена и сети. Выберите другой источник оплаты или сумму.',
      px_my_usdt: 'Мой USDT баланс', px_connect_for_bal: 'Подключи кошелёк', px_connect_for_pos: 'Подключи кошелёк, чтобы увидеть позиции',
      px_quoting: 'Ищем маршрут…', px_quote_fail: 'Нет DEX-ликвидности на EVM. Укажи Solana-адрес получения (Trust / любой Sol-кошелёк) или другой тикер.',
      px_need_phantom: 'Ликвидность xStocks на Solana. Плати EVM USDC/USDT через LiFi — вставь Solana-адрес получения (Trust или любой Sol-кошелёк).',
      px_need_sol_bridge: 'Ликвидность xStocks на Solana. Плати EVM USDC/USDT через LiFi — вставь Solana-адрес получения (Trust или любой Sol-кошелёк).',
      px_sol_dest_lbl: 'Solana-адрес получения (сюда придёт xStock)',
      px_sol_phantom: 'Phantom',
      px_sol_bridge_hint: 'Плати EVM USDC/USDT (любая сеть) через LiFi → Solana. Вставь адрес из Trust / любого Sol-кошелька.',
      px_sol_dest_need: 'Укажи Solana-адрес — xStock придёт туда через LiFi.',
      px_sol_set_dest: 'Указать Solana-адрес',
      px_connect_phantom: 'Подключить Phantom',
      px_my_stables: 'Доступно к оплате (USDT/USDC)',
      px_xs_use_any: 'Или USDC в другой сети через LiFi (укажи Solana-адрес выше).',
      px_impact: 'impact',
      px_impact_blocked: 'Сделка заблокирована — недостаточно ликвидности',
      px_impact_block_msg: 'Недостаточно ликвидности: получишь ≈{out} за {inn}. Сделка заблокирована.',
      px_impact_loss_block: 'Недостаточно ликвидности: потеряешь {n}%',
      px_impact_loss_warn: 'Высокий impact: потеряешь ~{n}%',
      px_no_liq: 'Нет ликвидности',
      px_no_liq_hint: 'Нет маршрута DEX / проскальзывание >5%',
      px_liq_check: 'Проверка…',
      px_exec_price: 'Исполнение',
      px_stock_price: 'Цена акции',
      px_fee_grom: 'Комиссия GROM',
      px_insufficient_usdt: 'Недостаточно USDT', px_signing: 'Подтверди в кошельке…', px_bought: 'Куплено', px_sold: 'Продано',
      px_soon: 'Скоро', px_switch_chain: 'Переключись на', px_to_buy: 'чтобы купить',
      px_live: 'LIVE',
      px_view_all: 'Все рынки', px_view_live: 'Live-календарь',
      px_cal_today: 'Сегодня', px_cal_tomorrow: 'Завтра', px_cal_later: 'Позже',
      px_cal_empty: 'Загрузка live-событий…',
      dash_px_title: 'Рынки прогнозов', dash_px_sub: 'Live-вероятности реальных событий — спорт, крипто, политика.',
      dash_px_link: 'Все рынки →',
      dash_banner_px_eyebrow: 'PREDICTION MARKETS', dash_banner_px_h: 'Спорт · Крипто · Политика',
      dash_banner_px_p: 'Live-вероятности реальных событий — спорт, крипто, политика.',
      dash_banner_px_cta: 'Открыть прогнозы →',
      qa_predict_t: 'Рынки прогнозов', qa_predict_d: 'Live-вероятности реальных событий',
      lp_predict_eyebrow: '🎯 Live · Prediction markets', lp_predict_h2: 'Рынки прогнозов',
      lp_predict_sub: 'Торгуй исходами спорта, крипто, политики и экономики. Цена контракта = вероятность исхода.',
      lp_predict_cta1: 'Открыть все прогнозы →', lp_predict_cta2: 'Токенизированные акции',
      gtm_cancel: 'Отмена', gtm_demo_bal: 'Баланс:', gtm_buy_shares: 'Купить шансы',
      px_bet_title: 'Ставка:', px_close: 'Закрыть', px_sell_bet: 'Продать',
      px_empty_bets: 'Пока нет ставок. Выбери исход выше, чтобы сделать ставку.',
      px_empty_stocks: 'Пока нет позиций. Купи xStock выше — токены появятся здесь и в Кошельке.',
      px_pos_closed: 'Позиция закрыта', px_market_closed: 'Рынок закрыт — ставки недоступны.', px_bet_sold: 'Ставка продана (−5% комиссия)',
      px_enter_amount: 'Введите сумму', px_insufficient: 'Недостаточно средств',
      px_now: 'сейчас', px_price_unavail: 'Цена недоступна',
      px_prob_line: 'Цена {n}¢ = вероятность {n}%.',
      px_payout_line: 'Получишь ~{sh} контрактов · макс. выплата ~{pay}, если исход сыграет.',
      px_load_more: 'Показать ещё',
      px_pm_live_hint: 'Живой ордер на Polygon · подпись в твоём кошельке.',
      px_pm_order_ok: 'Ордер отправлен',
      px_pm_need_builder: 'На сервере нужен GROM_POLYMARKET_BUILDER_CODE для live-ставок',
      px_pm_need_builder_short: 'builder выкл.',
      px_pm_no_token: 'не торгуется',
      px_pm_loading: 'загрузка…',
      px_pm_demo_hint: 'Только превью · у этого исхода нет live-токена ордербука.',
      px_pm_wrong_chain: 'Сеть: {n} · ставки только на Polygon',
      px_pm_bal_here: 'Здесь',
      px_pm_bal_poly: 'На Polygon',
      px_pm_bridge: 'Bridge USDC → Polygon',
      px_pm_bridge_topup: 'Докинуть USDC на Polygon',
      px_pm_bridging: 'Бридж…',
      px_pm_bridge_ok: 'Бридж отправлен — подожди 1–5 мин, потом ставь',
      px_pm_already_poly: 'Уже на Polygon',
      px_pm_open_swap: 'Открыть своп → Polygon',
      px_pm_insufficient_usdc: 'Недостаточно USDC на Polygon',
      px_pm_insufficient_liq: 'Недостаточно ликвидности',
      px_pm_fee_line: 'Комиссия GROM {pct}% ({fee})',
      px_pm_payout_fee: 'Получишь ~{sh} контрактов · макс. выплата ~{pay}',
      px_pm_min_stake: 'Минимум $1',
      px_pm_mode_live: 'Live · Polygon',
      px_empty_bets_live: 'Пока нет открытых позиций. Сделай live-ставку выше.',
      px_open: 'Открыть',
      px_connect_wallet: 'Подключи кошелёк для торговли',
      px_swap_fail: 'Сделка не удалась'
    },
    en: {
      ref_new_title: "Good things are better shared.",
      ref_new_sub: "Invite friends to GROM. Your link, your community.",
      ref_new_share: "Share invitation",
      ref_new_rewards: "Invite tracking is active. Rewards and payouts have not launched.",
      ref_new_details: "How invitations work",
      ref_new_poster: "Your next move starts in your wallet.",
      ref_new_join: "Join me on GROM",
      ref_new_save: "Save card",
      ref_new_more: "More…",
      ref_steps_title: "How it works",
      ref_step1_t: "Share your link",
      ref_step1_p: "Send your link or code to a friend — in Telegram, X or wherever you chat.",
      ref_step2_t: "Your friend connects a wallet",
      ref_step2_p: "A new wallet is linked to you the first time it signs in through your link.",
      ref_step3_t: "The invite is counted",
      ref_step3_p: "Track your invites in the stats below. Rewards have not launched yet.",
      ref_art_caption: "Your network on GROM",
      ref_card_title: "Invite friends",
      ref_card_live: "Tracking on",
      ref_share_via: "Share via",
      ref_overview: "Overview",
      ref_rules_title: "Rules",

      px_pm_funding_help: "How to fund predictions",
      px_pm_refresh_help: "Check balance only reads your wallet balance; it does not transfer funds or require a signature.",
      px_pm_live_bal: "Prediction balance · pUSD · Polygon",
      px_poly_bal: "pUSD · Polygon",
      px_cat_us_election: "US elections",
      px_pm_fund_poly: "Get pUSD via swap",
      px_pm_swap_hint: "Receive pUSD on Polygon, then return to your prediction.",
      px_pm_need_poly_funds: "Insufficient pUSD. Fund your prediction balance.",
      px_pm_conversion_hint: "Predictions use pUSD on Polygon. Swap directly into pUSD when a route is available, or convert existing USDC.e (bridged USDC) here. If a direct route is unavailable, swap into USDC.e first and then convert. You confirm each transaction; POL pays Polygon network fees.",
      px_pm_refresh: "Check balance",
      px_pm_pending: "Previous request is still being checked.",
      px_pm_tx_hash: "Transaction hash from wallet activity (0x…)",
      px_pm_recover: "Check previous request",
      px_pm_rejected: "I rejected the wallet request",
      px_pm_recover_wallet: "If the transaction was sent, paste its hash from wallet activity. If you rejected the request, confirm that below.",
      px_pm_recover_hint: "Check the existing request without submitting it again. Wallet authorization may be needed to read the order.",
      px_pm_unfilled: "The request was not executed. Check your balance and positions.",
      px_pm_reconciled: "Request status updated. Check your balance and positions.",
      px_pm_rejected_confirm: "Only continue if you rejected the request in your wallet and no transaction was sent. This clears the local waiting status; it does not cancel a transaction.",
      px_pm_balance_unavailable: "Balance could not be refreshed. Try again.",
      px_pm_converted: "Conversion confirmed",
      px_pm_fund_hint: "Fund from another network: swap to USDC.e on Polygon, then convert to pUSD.",
      px_pm_fund_hint_empty: "Trading requires pUSD on Polygon. Fund through swap and conversion.",
      nav_predict: 'Predictions', nav_xstocks: 'Stocks',
      pg_predict_bc: 'Predictions', pg_xstocks_bc: 'Stocks',
      pg_predict_title: 'Prediction markets', pg_predict_sub: '',
      pg_xstocks_title: 'Tokenized stocks',
      px_stock_title: 'Stocks',
      px_stock_intro: 'Tokenized stocks and ETFs. Trade from your wallet.',
      pg_xstocks_sub: 'Real S&P 500 / NASDAQ stocks tokenized on-chain. Live price · non-custodial swaps.',
      px_demo_bal: 'Balance', px_vol_24h: '24h volume', px_markets_n: 'Markets', px_tickers: 'Tickers', px_trading: 'Trading',
      px_search_predict: 'Search markets…', px_search_stocks: 'Search ticker…',
      px_my_bets: 'My bets', px_my_positions: 'My positions',
      px_yes: 'Yes', px_no: 'No', px_draw: 'Draw', px_chance: 'chance', px_vol: 'Vol', px_outcome: 'Outcome', px_buy: 'Buy', px_sell: 'Sell',
      px_cat_all: 'All', px_cat_sport: 'Sports', px_cat_crypto: 'Crypto', px_cat_esports: 'Esports',
      px_cat_politics: 'Politics', px_cat_culture: 'Culture', px_cat_finance: 'Finance', px_cat_economy: 'Economy',
      px_scat_all: 'All', px_scat_tech: 'Technology', px_scat_finance: 'Finance', px_scat_etf: 'ETF',
      px_scat_auto: 'Auto', px_scat_consumer: 'Consumer', px_scat_crypto: 'Crypto sector',
      px_scat_energy: 'Energy', px_scat_health: 'Healthcare',
      px_col_ticker: 'Ticker', px_col_price: 'Price', px_col_chg: '24h %', px_col_vol: '24h vol', px_col_mc: 'Market cap',
      px_reference_price: "Indicative price",
      px_reference_help: "Indicative price per share. The final trade price is calculated for your amount.",
      px_buy_quote_help: 'Average purchase price from the available route. The trade dialog recalculates for your amount; network gas is separate.',
      px_buy_quote_unavailable: 'No executable buy quote is available right now.',
      px_none: 'Nothing found for this filter 🔍', px_none_stocks: 'Nothing found 🔍',
      px_foot_predict: 'Live probabilities · GROM fee {pct}% · settle via oracle after outcome resolution.',
      px_foot_xstocks: 'Pay with USDC or USDT. The route shows the receive network and fee. You confirm each trade in your wallet.',
      px_stable_balance: 'USDC + USDT · across networks',
      px_balance_loading: 'Loading available USDC and USDT…',
      px_pay_with: 'Pay with',
      px_select_payment: 'No available USDC or USDT. Check your wallet balance.',
      px_insufficient_payment: 'Insufficient selected token on this network.',
      px_insufficient_token: 'Insufficient {token}',
      px_available_payment: 'Available:',
      px_no_stables: 'No USDC / USDT',
      px_trade_unavailable: 'Trade unavailable',
      px_unfavorable_rate: 'Unfavorable rate',
      px_quote_value_gap: 'At the reference price, the received tokens are worth about {n}% less than the payment. Trade blocked. Refresh the quote or change the amount.',
      px_retry_quote: 'Refresh quote',
      px_retry_wait: 'Retry in {seconds}s',
      px_reference_unavailable: 'Price unavailable',
      px_reference_price_missing: 'The independent share price is temporarily unavailable. Refresh the quote to check again.',
      px_payment_separate: 'Each purchase uses one token on one network. Gas is paid separately.',
      px_no_payment_route: 'No route for this token and network. Choose another payment account or amount.',
      px_my_usdt: 'My USDT balance', px_connect_for_bal: 'Connect wallet', px_connect_for_pos: 'Connect wallet to see positions',
      px_quoting: 'Fetching route…', px_quote_fail: 'No EVM DEX liquidity. Paste a Solana receive address (Trust / any Sol wallet) or try another ticker.',
      px_need_phantom: 'xStocks liquidity is on Solana. Pay with EVM USDC/USDT via LiFi — paste your Solana receive address (Trust or any Sol wallet).',
      px_need_sol_bridge: 'xStocks liquidity is on Solana. Pay with EVM USDC/USDT via LiFi — paste your Solana receive address (Trust or any Sol wallet).',
      px_sol_dest_lbl: 'Solana receive address (xStock lands here)',
      px_sol_phantom: 'Phantom',
      px_sol_bridge_hint: 'Pay with EVM USDC/USDT (any chain) via LiFi → Solana. Paste an address from Trust / any Sol wallet.',
      px_sol_dest_need: 'Enter a Solana address — xStock arrives there via LiFi.',
      px_sol_set_dest: 'Set Solana address',
      px_connect_phantom: 'Connect Phantom',
      px_my_stables: 'Available to pay (USDT/USDC)',
      px_xs_use_any: 'Or use USDC on another chain via LiFi bridge (set Solana address above).',
      px_impact: 'impact',
      px_impact_blocked: 'Trade blocked — insufficient liquidity',
      px_impact_block_msg: 'Insufficient liquidity: you get ≈{out} for {inn}. Trade blocked.',
      px_impact_loss_block: 'Insufficient liquidity: you lose {n}%',
      px_impact_loss_warn: 'High impact: you lose ~{n}%',
      px_no_liq: 'No liquidity',
      px_no_liq_hint: 'No viable DEX route / impact >5%',
      px_liq_check: 'Checking…',
      px_exec_price: 'Execution',
      px_stock_price: 'Stock price',
      px_fee_grom: 'GROM fee',
      px_insufficient_usdt: 'Insufficient USDT', px_signing: 'Confirm in wallet…', px_bought: 'Bought', px_sold: 'Sold',
      px_soon: 'Soon', px_switch_chain: 'Switch to', px_to_buy: 'to buy',
      px_live: 'LIVE',
      px_view_all: 'All markets', px_view_live: 'Live calendar',
      px_cal_today: 'Today', px_cal_tomorrow: 'Tomorrow', px_cal_later: 'Later',
      px_cal_empty: 'Loading live events…',
      dash_px_title: 'Prediction markets', dash_px_sub: 'Live probabilities of real events — sports, crypto, politics.',
      dash_px_link: 'All markets →',
      dash_banner_px_eyebrow: 'PREDICTION MARKETS', dash_banner_px_h: 'Sports · Crypto · Politics',
      dash_banner_px_p: 'Live probabilities on real-world outcomes. Sports, crypto, politics.',
      dash_banner_px_cta: 'Open predictions →',
      qa_predict_t: 'Prediction markets', qa_predict_d: 'Live probabilities on real events',
      lp_predict_eyebrow: '🎯 Live · Prediction markets', lp_predict_h2: 'Prediction markets',
      lp_predict_sub: 'Trade sports, crypto, politics and macro outcomes. Contract price = outcome probability.',
      lp_predict_cta1: 'Open all predictions →', lp_predict_cta2: 'Tokenized stocks',
      gtm_cancel: 'Cancel', gtm_demo_bal: 'Balance:', gtm_buy_shares: 'Buy shares',
      px_bet_title: 'Bet:', px_close: 'Close', px_sell_bet: 'Sell',
      px_empty_bets: 'No bets yet. Pick an outcome above to place a bet.',
      px_empty_stocks: 'No positions yet. Buy an xStock above — tokens show up here and in Wallet.',
      px_pos_closed: 'Position closed', px_market_closed: 'Market closed — betting is no longer available.', px_bet_sold: 'Bet sold (−5% fee)',
      px_enter_amount: 'Enter amount', px_insufficient: 'Insufficient balance',
      px_now: 'now', px_price_unavail: 'Price unavailable',
      px_prob_line: 'Price {n}¢ = probability {n}%.',
      px_payout_line: 'You get ~{sh} shares · max payout ~{pay} if outcome wins.',
      px_load_more: 'Load more',
      px_pm_live_hint: 'Live order on Polygon · signed in your wallet.',
      px_pm_order_ok: 'Order submitted',
      px_pm_need_builder: 'Set GROM_POLYMARKET_BUILDER_CODE on the server to enable live orders',
      px_pm_need_builder_short: 'builder off',
      px_pm_no_token: 'not tradeable',
      px_pm_loading: 'loading…',
      px_pm_demo_hint: 'Preview only · this outcome has no live order book token.',
      px_pm_wrong_chain: 'Network: {n} · stakes need Polygon',
      px_pm_bal_here: 'Here',
      px_pm_bal_poly: 'On Polygon',
      px_pm_bridge: 'Bridge USDC → Polygon',
      px_pm_bridge_topup: 'Bridge more USDC → Polygon',
      px_pm_bridging: 'Bridging…',
      px_pm_bridge_ok: 'Bridge sent — wait 1–5 min, then place bet',
      px_pm_already_poly: 'Already on Polygon',
      px_pm_open_swap: 'Open Swap → Polygon',
      px_pm_insufficient_usdc: 'Insufficient USDC on Polygon',
      px_pm_insufficient_liq: 'Insufficient liquidity',
      px_pm_fee_line: 'GROM fee {pct}% ({fee})',
      px_pm_payout_fee: 'You get ~{sh} shares · max payout ~{pay}',
      px_pm_min_stake: 'Minimum $1',
      px_pm_mode_live: 'Live · Polygon',
      px_empty_bets_live: 'No open positions yet. Place a live bet above.',
      px_open: 'Open',
      px_connect_wallet: 'Connect wallet to trade',
      px_swap_fail: 'Trade failed'
    },
    es: {
      landing_kicker: 'FINANCE HUB', landing_logo_img_alt: 'GROM Finance Hub', landing_title: 'Opera más inteligente. Opera con GROM.',
      landing_lead: 'DEX no custodial. Swap cross-chain con meta-agregador. Tus claves, tus firmas.',
      landing_cta_trade: 'Empezar a operar', landing_cta_demo: 'Cuenta demo',
      feat1_title: 'SPOT', feat1_desc: "Comparamos las rutas disponibles. Firma en tu billetera y liquida en la cadena.",
      feat2_title: 'MERCADOS DE PREDICCIÓN', feat2_desc: 'Expiraciones cortas y pagos hasta 92%.',
      feat3_title: 'ALMACENAMIENTO EN FRÍO', feat3_desc: 'Hasta 95% de fondos en cold wallets multisig.',
      feat4_title: 'ANÁLISIS PRO', feat4_desc: 'Indicadores, libro de órdenes y señales en un solo desk.',
      dash_bc: 'Panel', dash_title: 'Buenos días, trader', dash_sub: 'Resumen de tu cartera y lista de seguimiento.',
      dash_welcome_h: 'Bienvenido a GROM Finance Hub', dash_welcome_p: 'Spot, opciones binarias y DeFi — desde una sola billetera no custodial.',


      pg_spot_title: 'BTC/USDT', pg_spot_sub: 'Libro de órdenes y velas en vivo — Binance, Kraken y Coinbase con failover automático.',
      pg_markets_title: 'Todos los mercados', pg_markets_sub: 'Mercados Hyperliquid en vivo — las mismas parejas que Trade.',
      pg_wallet_title: 'Tu billetera', pg_wallet_sub: 'Los saldos de trading permiten ejecución instantánea en Spot y Futures. Swaps y retiros on-chain usan tu billetera conectada.',
      pg_history_title: 'Historial de operaciones', pg_history_sub: 'Todas las operaciones, depósitos y retiros en GROM.',
      pg_futures_bc: 'Futuros', pg_futures_title: 'Futuros con margen USDT', pg_futures_sub: 'Margen aislado y cruzado, profundidad agregada, salidas bracket / OCO — mismo motor de riesgo que Spot.',
      fut_pos_title: 'Posiciones abiertas', fut_pos_empty: 'Sin contratos abiertos — define tamaño desde la escalera o Quick long / short.',
      fut_ladder_title: 'Escalera rápida', fut_btn_long: 'Long rápido', fut_btn_short: 'Short rápido',
      pg_referral_bc: 'Programa de referidos', pg_referral_title: 'Programa de referidos inactivo', pg_referral_sub: 'Publicaremos las condiciones antes de activar el seguimiento y los pagos.',
      ref_link_title: 'Tu enlace', ref_copy: 'Copiar', ref_stat_inv: 'Invitados', ref_stat_vol: 'Su volumen (30d)', ref_stat_earn: 'Tus rebates',
      pg_settings_bc: 'Ajustes', pg_settings_title: 'Preferencias', pg_settings_sub: 'Idioma, notificaciones y valores de trading se guardan en este navegador hasta que inicies sesión con billetera.',
      set_lang_title: 'Idioma', set_notif_title: 'Notificaciones', set_notif_desc: 'Push del navegador desactivado en este build — usa la campana para alertas in-app.',
      pg_help_bc: 'Ayuda', pg_help_title: 'Ayuda y soporte', pg_help_sub: 'Cómo usar el hub DEX: swap, perps, predicciones, acciones — y contacto con el equipo.',
      help_card_wallet_t: 'Billetera = cuenta', help_card_wallet_d: 'GROM no es custodial: sin depósitos en exchange ni colas de retiro. Los fondos quedan en tu billetera; las operaciones se liquidan on-chain.', help_card_wallet_f: 'Self-custody · on-chain',
      help_card_markets_t: 'Cuatro mercados, una billetera', help_card_markets_d: "Swap, Spot y perpetuos, predicciones y acciones tokenizadas — desde una billetera conectada.",
      help_card_support_t: 'Soporte', help_card_support_d: 'Escribe por Telegram o email. Incluye producto, dirección, hora UTC y tx hash.',
      help_qa_dash: 'Abrir panel', help_qa_tg: 'Telegram', help_qa_tg_d: 'Canal oficial', help_qa_email: 'Email', help_qa_contact: 'Cómo contactar', help_qa_contact_d: 'FAQ abajo',
      help_faq_title: 'Preguntas frecuentes', help_faq_sub: 'DEX',
      help_faq_cust_q: '¿GROM es custodial?', help_faq_cust_a: 'No. Es un hub DEX non-custodial. Los swaps van por agregadores a tu billetera. El margen de perps está en Hyperliquid. Predicciones y acciones también a tu dirección.',
      help_faq_do_q: '¿Qué puedo hacer?', help_faq_do_a: "<strong>Swap</strong> — rutas disponibles entre tokens y redes.<br><strong>Trade</strong> — Spot y perpetuos de Hyperliquid; el apalancamiento depende del mercado.<br><strong>Predicciones</strong> — opera con resultados de eventos.<br><strong>Acciones</strong> — xStocks tokenizadas.",
      help_faq_swap_q: '¿Cómo funciona el swap?', help_faq_swap_a: 'Conecta la billetera, elige tokens, compara cotizaciones y firma. Los tokens llegan a tu dirección.',
      help_faq_funds_q: '¿Cómo añadir fondos?', help_faq_funds_a: 'Envía crypto a tu billetera o compra vía on-ramp (your wallet). No hay depósito «en GROM».',
      help_faq_fee_q: '¿Qué comisiones hay?', help_faq_fee_a: 'Swap: fee de routing + gas. Hyperliquid, Predict y xStocks tienen sus propias fees. No hay order book CEX.',
      help_faq_kyc_q: '¿Necesito KYC?', help_faq_kyc_a: 'No para operar con billetera. Los on-ramps fiat pueden pedir verificación. Algunas regiones pueden estar restringidas.',
      help_faq_contact_q: '¿Cómo contactar a una persona?', help_faq_contact_a: 'Email support.grom@gmail.com o Telegram t.me/grom_finence_hub. Incluye producto, dirección, UTC, tx hash y capturas.',
      help_legal_title: 'Legal y riesgos', help_legal_sub: 'Resumen',
      help_legal_risk_q: 'Trading responsable', help_legal_risk_a: 'Perps, predicciones y acciones tokenizadas implican riesgo de pérdida, incluida liquidación. Opera solo con lo que puedas perder.',
      help_legal_terms_q: 'Términos de uso', help_legal_terms_a: 'Al usar GROM aceptas reglas de elegibilidad, regiones y liquidación on-chain. Venues y bridges de terceros son bajo tu riesgo.',
      help_legal_priv_q: 'Privacidad', help_legal_priv_a: 'Podemos procesar dirección de billetera y datos de sesión. No pedimos documentos para el uso DEX básico.',
      nav_predict: 'Predicciones', nav_xstocks: 'Acciones',
      pg_predict_bc: 'Predicciones', pg_xstocks_bc: 'Acciones',
      pg_predict_title: 'Mercados de predicción', pg_predict_sub: 'Opera resultados de eventos reales — deportes, cripto, esports, política, cultura, finanzas y economía. Precio del contrato = probabilidad del resultado.',
      pg_xstocks_title: 'Acciones tokenizadas',
      px_stock_title: 'Acciones',
      px_stock_intro: 'Acciones y ETF tokenizados. Opera desde tu cartera.',
      pg_xstocks_sub: 'Acciones reales S&P 500 / NASDAQ tokenizadas on-chain (Backed). Precio en vivo · swaps non-custodial.',
      px_demo_bal: 'Saldo', px_vol_24h: 'Volumen 24h', px_markets_n: 'Mercados', px_tickers: 'Tickers', px_trading: 'Trading',
      px_search_predict: 'Buscar mercados…', px_search_stocks: 'Buscar ticker…',
      px_my_bets: 'Mis apuestas', px_my_positions: 'Mis posiciones',
      px_yes: 'Sí', px_no: 'No', px_draw: 'Empate', px_chance: 'prob.', px_vol: 'Vol', px_outcome: 'Resultado', px_buy: 'Comprar', px_sell: 'Vender',
      px_cat_all: 'Todos', px_cat_sport: 'Deportes', px_cat_crypto: 'Cripto', px_cat_esports: 'Esports',
      px_cat_politics: 'Política', px_cat_culture: 'Cultura', px_cat_finance: 'Finanzas', px_cat_economy: 'Economía',
      px_scat_all: 'Todos', px_scat_tech: 'Tecnología', px_scat_finance: 'Finanzas', px_scat_etf: 'ETF',
      px_scat_auto: 'Auto', px_scat_consumer: 'Consumo', px_scat_crypto: 'Sector cripto',
      px_scat_energy: 'Energía', px_scat_health: 'Salud',
      px_col_ticker: 'Ticker', px_col_price: 'Precio', px_col_chg: '24h %', px_col_vol: 'Vol. 24h', px_col_mc: 'Cap. de mercado',
      px_reference_price: "Precio orientativo",
      px_reference_help: "Precio de referencia por acción. El precio final se calcula para tu importe.",
      px_buy_quote_help: 'Precio medio de compra según la ruta disponible. El diálogo recalcula la cotización según el importe; el gas de red se paga aparte.',
      px_buy_quote_unavailable: 'No hay una cotización de compra ejecutable disponible ahora.',
      px_none: 'Nada encontrado con este filtro 🔍', px_none_stocks: 'Nada encontrado 🔍',
 px_foot_predict: 'Probabilidades en vivo · comisión GROM {pct}% · liquidación vía oracle (Chainlink / UMA).',
      px_foot_xstocks: 'Swaps reales on-chain de Backed xStocks vía LiFi · comisión 0.20% · non-custodial.',
      px_live: 'LIVE',
      px_view_all: 'Todos los mercados', px_view_live: 'Calendario live',
      px_cal_today: 'Hoy', px_cal_tomorrow: 'Mañana', px_cal_later: 'Más tarde',
 px_cal_empty: 'Cargando eventos live …',
      dash_px_title: 'Mercados de predicción', dash_px_sub: 'Probabilidades en vivo de eventos reales — deportes, cripto, política.',
      dash_px_link: 'Todos los mercados →',
      dash_banner_px_eyebrow: 'MERCADOS DE PREDICCIÓN', dash_banner_px_h: 'Deportes · Cripto · Política',
 dash_banner_px_p: 'Probabilidades en vivo . Apuesta en resultados reales.',
      dash_banner_px_cta: 'Abrir predicciones →',
 qa_predict_t: 'Mercados de predicción', qa_predict_d: 'Probabilidades en vivo',
 lp_predict_eyebrow: '🎯 Live · Prediction markets', lp_predict_h2: 'Mercados de predicción',
      lp_predict_sub: 'Opera resultados de deportes, cripto, política y economía. Precio del contrato = probabilidad.',
      lp_predict_cta1: 'Abrir todas las predicciones →', lp_predict_cta2: 'Acciones tokenizadas',
      gtm_cancel: 'Cancelar', gtm_demo_bal: 'Saldo:', gtm_buy_shares: 'Comprar probabilidades',
      px_bet_title: 'Apuesta:', px_close: 'Cerrar', px_sell_bet: 'Vender',
      px_empty_bets: 'Sin apuestas aún. Elige un resultado arriba para apostar.',
      px_empty_stocks: 'Sin posiciones aún. Compra un xStock arriba — aparece aquí y en Wallet.',
      px_pos_closed: 'Posición cerrada', px_market_closed: 'Mercado cerrado: ya no se pueden hacer apuestas.', px_bet_sold: 'Apuesta vendida (−5% comisión)',
      px_enter_amount: 'Introduce importe', px_insufficient: 'Saldo insuficiente',
      px_now: 'ahora', px_price_unavail: 'Precio no disponible',
      px_prob_line: 'Precio {n}¢ = probabilidad {n}%.',
      px_payout_line: 'Recibirás {sh} contratos · pago máx. {pay}, si el resultado gana.',
      px_load_more: 'Cargar más'
    },
    ar: {
      landing_kicker: 'FINANCE HUB', landing_logo_img_alt: 'GROM Finance Hub', landing_title: 'تداول بذكاء. تداول مع GROM.',
      landing_lead: 'DEX غير وصائي. مبادلة عبر السلاسل بمجمّع مسارات. مفاتيحك وتوقيعاتك.',
      landing_cta_trade: 'ابدأ التداول', landing_cta_demo: 'حساب تجريبي',
      feat1_title: 'سبوت', feat1_desc: "نقارن المسارات المتاحة. وقّع في محفظتك لتتم التسوية على السلسلة.",
      feat2_title: 'أسواق التنبؤ', feat2_desc: 'انتهاءات قصيرة وعوائد حتى 92%.',
      feat3_title: 'تخزين بارد', feat3_desc: 'حتى 95% من الأموال في محافظ باردة متعددة التوقيع.',
      feat4_title: 'تحليلات احترافية', feat4_desc: 'مؤشرات ودفتر أوامر وإشارات في منصة واحدة.',
      dash_bc: 'لوحة التحكم', dash_title: 'صباح الخير أيها المتداول', dash_sub: 'ملخص محفظتك وقائمة المتابعة.',
      dash_welcome_h: 'مرحبًا بك في GROM Finance Hub', dash_welcome_p: 'سبوت وأسواق التنبؤ وDeFi — من محفظة واحدة غير حفظية.',


      pg_spot_title: 'BTC/USDT', pg_spot_sub: 'دفتر أوامر وشموع مباشرة — Binance وKraken وCoinbase مع تبديل تلقائي.',
      pg_markets_title: 'كل الأسواق', pg_markets_sub: 'أسواق Hyperliquid المباشرة — نفس أزواج Trade.',
      pg_wallet_title: 'محفظتك', pg_wallet_sub: 'أرصدة التداول للتنفيذ الفوري في Spot و Futures. المبادلات والسحوبات على السلسلة عبر محفظتك.',
      pg_history_title: 'سجل الصفقات', pg_history_sub: 'كل الصفقات والإيداعات والسحوبات على GROM.',
      pg_futures_bc: 'العقود الآجلة', pg_futures_title: 'عقود آجلة بهامش USDT', pg_futures_sub: 'هامش معزول أو متقاطع، عمق مجمّع، مخارج bracket / OCO — نفس محرك المخاطر كالسبوت.',
      fut_pos_title: 'مراكز مفتوحة', fut_pos_empty: 'لا عقود مفتوحة — حدّد الحجم من السلم أو Quick long / short.',
      fut_ladder_title: 'سلم سريع', fut_btn_long: 'Long سريع', fut_btn_short: 'Short سريع',
      pg_referral_bc: 'برنامج الإحالة', pg_referral_title: 'برنامج الإحالة غير نشط', pg_referral_sub: 'سنعلن الشروط قبل تفعيل التتبع والمدفوعات.',
      ref_link_title: 'رابطك', ref_copy: 'نسخ', ref_stat_inv: 'مدعوون', ref_stat_vol: 'حجمهم (30ي)', ref_stat_earn: 'rebates الخاصة بك',
      pg_settings_bc: 'الإعدادات', pg_settings_title: 'التفضيلات', pg_settings_sub: 'اللغة والإشعارات وإعدادات التداول تُحفظ في هذا المتصفح حتى تسجيل الدخول بالمحفظة.',
      set_lang_title: 'اللغة', set_notif_title: 'الإشعارات', set_notif_desc: 'إشعارات المتصفح معطّلة في هذا الإصدار — استخدم الجرس للتنبيهات داخل التطبيق.',
      pg_help_bc: 'المساعدة', pg_help_title: 'المساعدة والدعم', pg_help_sub: 'كيفية استخدام مركز DEX: المبادلة والعقود والتنبؤات والأسهم — والتواصل مع الفريق.',
      help_card_wallet_t: 'المحفظة = الحساب', help_card_wallet_d: 'GROM غير وصائية: لا ودائع في المنصة ولا طوابير سحب. الأموال في محفظتك والصفقات على السلسلة.', help_card_wallet_f: 'Self-custody · on-chain',
      help_card_markets_t: 'أربعة أسواق، محفظة واحدة', help_card_markets_d: "مبادلة وتداول فوري وعقود دائمة وتنبؤات وأسهم مرمّزة — من محفظة متصلة واحدة.",
      help_card_support_t: 'الدعم', help_card_support_d: 'راسلنا عبر تيليجرام أو البريد. اذكر المنتج والعنوان ووقت UTC و tx hash.',
      help_qa_dash: 'فتح اللوحة', help_qa_tg: 'Telegram', help_qa_tg_d: 'القناة الرسمية', help_qa_email: 'البريد', help_qa_contact: 'كيفية التواصل', help_qa_contact_d: 'الأسئلة أدناه',
      help_faq_title: 'أسئلة شائعة', help_faq_sub: 'DEX',
      help_faq_cust_q: 'هل GROM وصائية؟', help_faq_cust_a: 'لا. مركز DEX غير وصائي. المبادلات عبر مجمّعات إلى محفظتك. هامش العقود على Hyperliquid.',
      help_faq_do_q: 'ماذا يمكنني أن أفعل؟', help_faq_do_a: "<strong>مبادلة</strong> — المسارات المتاحة بين التوكنات والشبكات.<br><strong>Trade</strong> — التداول الفوري والعقود الدائمة على Hyperliquid؛ الرافعة حسب السوق.<br><strong>تنبؤات</strong> — تداول نتائج الأحداث.<br><strong>أسهم</strong> — xStocks مرمّزة.",
      help_faq_swap_q: 'كيف تعمل المبادلة؟', help_faq_swap_a: 'اربط المحفظة واختر التوكنات وقارن العروض ووقّع. التوكنات تصل إلى عنوانك.',
      help_faq_funds_q: 'كيف أضيف أموالاً؟', help_faq_funds_a: 'أرسل عملات إلى محفظتك أو اشترِ عبر on-ramp. لا يوجد إيداع «في GROM».',
      help_faq_fee_q: 'ما الرسوم؟', help_faq_fee_a: 'المبادلة: رسوم التوجيه + الغاز. للمنصات الأخرى رسومها. لا يوجد دفتر أوامر CEX.',
      help_faq_kyc_q: 'هل أحتاج KYC؟', help_faq_kyc_a: 'لا للتداول بالمحفظة. قد تطلب بوابات الدفع تحققًا. بعض المناطق قد تكون مقيدة.',
      help_faq_contact_q: 'كيف أتواصل مع شخص؟', help_faq_contact_a: 'البريد support.grom@gmail.com أو تيليجرام t.me/grom_finence_hub.',
      help_legal_title: 'القانون والمخاطر', help_legal_sub: 'مختصر',
      help_legal_risk_q: 'تداول مسؤول', help_legal_risk_a: 'العقود والتنبؤات والأسهم تحمل مخاطر خسارة. تداول فقط بما تستطيع خسارته.',
      help_legal_terms_q: 'شروط الاستخدام', help_legal_terms_a: 'باستخدام GROM تقبل قواعد الأهلية والمناطق والتسوية على السلسلة.',
      help_legal_priv_q: 'الخصوصية', help_legal_priv_a: 'قد نعالج عنوان المحفظة وبيانات الجلسة. لا نطلب وثائق للهوية لاستخدام DEX الأساسي.',
      nav_predict: 'التوقعات', nav_xstocks: 'الأسهم',
      pg_predict_bc: 'التوقعات', pg_xstocks_bc: 'الأسهم',
      pg_predict_title: 'أسواق التوقعات', pg_predict_sub: 'تداول نتائج أحداث حقيقية — رياضة وكريبتو ورياضات إلكترونية وسياسة وثقافة ومالية واقتصاد. سعر العقد = احتمال النتيجة.',
      pg_xstocks_title: 'أسهم مُرمّزة',
      px_stock_title: 'الأسهم',
      px_stock_intro: 'أسهم وصناديق ETF مُرمّزة. تداول من محفظتك.',
      pg_xstocks_sub: 'أسهم S&P 500 / NASDAQ مُرمّزة on-chain (Backed). سعر مباشر · مقايضات غير وصائية.',
      px_demo_bal: 'الرصيد', px_vol_24h: 'حجم 24س', px_markets_n: 'أسواق', px_tickers: 'Tickers', px_trading: 'تداول',
      px_search_predict: 'بحث في الأسواق…', px_search_stocks: 'بحث ticker…',
      px_my_bets: 'رهاناتي', px_my_positions: 'مراكزي',
      px_yes: 'نعم', px_no: 'لا', px_draw: 'تعادل', px_chance: 'فرصة', px_vol: 'حجم', px_outcome: 'نتيجة', px_buy: 'شراء', px_sell: 'بيع',
      px_cat_all: 'الكل', px_cat_sport: 'رياضة', px_cat_crypto: 'كريبتو', px_cat_esports: 'رياضات إلكترونية',
      px_cat_politics: 'سياسة', px_cat_culture: 'ثقافة', px_cat_finance: 'مالية', px_cat_economy: 'اقتصاد',
      px_scat_all: 'الكل', px_scat_tech: 'تكنولوجيا', px_scat_finance: 'مالية', px_scat_etf: 'ETF',
      px_scat_auto: 'سيارات', px_scat_consumer: 'استهلاك', px_scat_crypto: 'قطاع كريبتو',
      px_scat_energy: 'طاقة', px_scat_health: 'صحة',
      px_col_ticker: 'Ticker', px_col_price: 'السعر', px_col_chg: '24س %', px_col_vol: 'حجم 24س', px_col_mc: 'القيمة السوقية',
      px_reference_price: "سعر إرشادي",
      px_reference_help: "سعر إرشادي للسهم. يُحسب سعر الصفقة النهائي للمبلغ الذي تختاره.",
      px_buy_quote_help: 'متوسط سعر الشراء حسب المسار المتاح. يعيد مربع التداول حساب السعر للمبلغ الذي تدخله؛ رسوم الشبكة منفصلة.',
      px_buy_quote_unavailable: 'لا يتوفر الآن عرض شراء قابل للتنفيذ.',
      px_none: 'لا نتائج لهذا الفلتر 🔍', px_none_stocks: 'لا نتائج 🔍',
 px_foot_predict: 'احتمالات مباشرة · رسوم GROM {pct}% · تسوية عبر oracle (Chainlink / UMA).',
      px_foot_xstocks: 'مقايضات Backed xStocks الحقيقية عبر LiFi · عمولة 0.20% · غير وصائية.',
      px_live: 'LIVE',
      px_view_all: 'كل الأسواق', px_view_live: 'تقويم مباشر',
      px_cal_today: 'اليوم', px_cal_tomorrow: 'غدًا', px_cal_later: 'لاحقًا',
 px_cal_empty: 'جاري تحميل أحداث المباشرة…',
      dash_px_title: 'أسواق التوقعات', dash_px_sub: 'احتمالات مباشرة لأحداث حقيقية — رياضة وكريبتو وسياسة.',
      dash_px_link: 'كل الأسواق →',
      dash_banner_px_eyebrow: 'أسواق التوقعات', dash_banner_px_h: 'رياضة · كريبتو · سياسة',
 dash_banner_px_p: 'احتمالات مباشرة . راهن على نتائج حقيقية.',
      dash_banner_px_cta: 'فتح التوقعات →',
 qa_predict_t: 'أسواق التوقعات', qa_predict_d: 'احتمالات مباشرة',
 lp_predict_eyebrow: '🎯 مباشر', lp_predict_h2: 'أسواق التوقعات',
      lp_predict_sub: 'تداول نتائج الرياضة والكريبتو والسياسة والاقتصاد. سعر العقد = الاحتمال.',
      lp_predict_cta1: 'فتح كل التوقعات →', lp_predict_cta2: 'أسهم مُرمّزة',
      gtm_cancel: 'إلغاء', gtm_demo_bal: 'الرصيد:', gtm_buy_shares: 'شراء احتمالات',
      px_bet_title: 'رهان:', px_close: 'إغلاق', px_sell_bet: 'بيع',
      px_empty_bets: 'لا رهانات بعد. اختر نتيجة أعلاه لوضع رهان.',
      px_empty_stocks: 'لا مراكز بعد. اشترِ xStock أعلاه — يظهر هنا وفي المحفظة.',
      px_pos_closed: 'تم إغلاق المركز', px_market_closed: 'السوق مغلق، ولم يعد الرهان متاحًا.', px_bet_sold: 'تم بيع الرهان (−5% رسوم)',
      px_enter_amount: 'أدخل المبلغ', px_insufficient: 'رصيد غير كافٍ',
      px_now: 'الآن', px_price_unavail: 'السعر غير متاح',
      px_prob_line: 'السعر {n}¢ = احتمال {n}%.',
      px_payout_line: 'ستحصل على {sh} عقود · أقصى دفع {pay} إذا تحقق النتيجة.',
      px_load_more: 'تحميل المزيد'
    },
    zh: {
      landing_kicker: 'FINANCE HUB', landing_logo_img_alt: 'GROM Finance Hub', landing_title: '更聪明地交易。与 GROM 同行。',
      landing_lead: '非托管 DEX。跨链元聚合兑换。密钥在你手中。',
      landing_cta_trade: '开始交易', landing_cta_demo: '模拟账户',
      feat1_title: '现货', feat1_desc: "比较可用路径。在钱包中签名，链上结算。",
      feat2_title: '预测市场', feat2_desc: '短到期，赔付最高 92%。',
      feat3_title: '冷存储', feat3_desc: '最多 95% 资金存放在多签冷钱包。',
      feat4_title: '专业分析', feat4_desc: '指标、订单簿与信号，一屏搞定。',
      dash_bc: '仪表盘', dash_title: '早上好，交易者', dash_sub: '投资组合与自选概览。',
      dash_welcome_h: '欢迎使用 GROM Finance Hub', dash_welcome_p: '现货、预测市场与 DeFi — 一个非托管钱包搞定。',


      pg_spot_title: 'BTC/USDT', pg_spot_sub: '实时订单簿与K线 — Binance、Kraken、Coinbase 自动切换。',
      pg_markets_title: '全部市场', pg_markets_sub: 'Hyperliquid 实时市场 — 与 Trade 相同的交易对。',
      pg_wallet_title: '你的钱包', pg_wallet_sub: '交易余额用于即时 Spot、合约与二元成交。链上兑换与提现使用你连接的钱包。',
      pg_history_title: '交易历史', pg_history_sub: 'GROM 上的全部交易、充值与提现。',
      pg_futures_bc: '合约', pg_futures_title: 'USDT 本位合约', pg_futures_sub: '逐仓与全仓、聚合深度、bracket / OCO 出场 — 与现货相同的风控引擎。',
      fut_pos_title: '持仓', fut_pos_empty: '暂无持仓 — 从阶梯设置数量或使用快速做多/做空。',
      fut_ladder_title: '快速阶梯', fut_btn_long: '快速做多', fut_btn_short: '快速做空',
      pg_referral_bc: '推荐计划', pg_referral_title: '推荐计划暂未启用', pg_referral_sub: '启用推荐跟踪和付款前，我们会公布相关条款。',
      ref_link_title: '你的链接', ref_copy: '复制', ref_stat_inv: '已邀请', ref_stat_vol: '他们的成交量(30天)', ref_stat_earn: '你的返佣',
      pg_settings_bc: '设置', pg_settings_title: '偏好', pg_settings_sub: '语言、通知与交易默认值保存在本浏览器，直至你用钱包登录。',
      set_lang_title: '语言', set_notif_title: '通知', set_notif_desc: '本版本未启用浏览器推送 — 请使用铃铛查看应用内提醒。',
      pg_help_bc: '帮助', pg_help_title: '帮助与支持', pg_help_sub: '如何使用 DEX 中心：兑换、永续、预测、股票 — 以及联系团队。',
      help_card_wallet_t: '钱包 = 账户', help_card_wallet_d: 'GROM 非托管：无交易所充值、无提现队列。资金在你的钱包，交易链上结算。', help_card_wallet_f: 'Self-custody · on-chain',
      help_card_markets_t: '四个市场，一个钱包', help_card_markets_d: "兑换、现货与永续合约、预测及代币化股票 — 一个已连接的钱包即可使用。",
      help_card_support_t: '支持', help_card_support_d: '通过 Telegram 或邮箱联系。请注明产品、钱包地址、UTC 时间与 tx hash。',
      help_qa_dash: '打开仪表盘', help_qa_tg: 'Telegram', help_qa_tg_d: '官方频道', help_qa_email: '邮箱', help_qa_contact: '如何联系', help_qa_contact_d: '下方 FAQ',
      help_faq_title: '常见问题', help_faq_sub: 'DEX',
      help_faq_cust_q: 'GROM 是托管的吗？', help_faq_cust_a: '不是。非托管 DEX 中心。兑换经聚合器直达钱包；永续保证金在 Hyperliquid。',
      help_faq_do_q: '我能做什么？', help_faq_do_a: "<strong>兑换</strong> — 代币与网络之间的可用路径。<br><strong>Trade</strong> — Hyperliquid 现货与永续合约，杠杆取决于市场。<br><strong>预测</strong> — 交易事件结果。<br><strong>股票</strong> — 代币化 xStocks。",
      help_faq_swap_q: '兑换如何工作？', help_faq_swap_a: '连接钱包、选择代币、比较报价并签名。代币到账你的地址。',
      help_faq_funds_q: '如何入金？', help_faq_funds_a: '向自己的钱包转币，或通过 your wallet 法币入金。没有「充值到 GROM」。',
      help_faq_fee_q: '有哪些费用？', help_faq_fee_a: '兑换：路由费 + Gas。Hyperliquid、Predict、xStocks 另有场地费。无 CEX 订单簿。',
      help_faq_kyc_q: '需要 KYC 吗？', help_faq_kyc_a: '钱包交易不需要。法币通道可能自行核验。部分地区可能受限。',
      help_faq_contact_q: '如何联系人工？', help_faq_contact_a: '邮箱 support.grom@gmail.com 或 Telegram t.me/grom_finence_hub。',
      help_legal_title: '法律与风险', help_legal_sub: '简要',
      help_legal_risk_q: '负责任交易', help_legal_risk_a: '永续、预测与代币化股票有亏损风险，包括杠杆清算。只用可承受损失的资金交易。',
      help_legal_terms_q: '使用条款', help_legal_terms_a: '使用 GROM 即表示接受资格、地区与链上结算规则。第三方场所与桥接风险自负。',
      help_legal_priv_q: '隐私', help_legal_priv_a: '可能处理钱包地址与会话数据。核心 DEX 使用不需要身份证件。',
      nav_predict: '预测', nav_xstocks: '股票',
      pg_predict_bc: '预测', pg_xstocks_bc: '股票',
      pg_predict_title: '预测市场', pg_predict_sub: '交易真实事件结果 — 体育、加密、电竞、政治、文化、金融与宏观。合约价格 = 结果概率。',
      pg_xstocks_title: '代币化股票',
      px_stock_title: '股票',
      px_stock_intro: '代币化股票与 ETF，直接使用你的钱包交易。',
      pg_xstocks_sub: '真实 S&P 500 / NASDAQ 股票的链上代币（Backed）。实时价格 · 非托管兑换。',
      px_demo_bal: '余额', px_vol_24h: '24小时成交量', px_markets_n: '市场数', px_tickers: 'Ticker 数', px_trading: '交易',
      px_search_predict: '搜索市场…', px_search_stocks: '搜索 ticker…',
      px_my_bets: '我的下注', px_my_positions: '我的持仓',
      px_yes: '是', px_no: '否', px_draw: '平局', px_chance: '概率', px_vol: '成交量', px_outcome: '结果', px_buy: '买入', px_sell: '卖出',
      px_cat_all: '全部', px_cat_sport: '体育', px_cat_crypto: '加密', px_cat_esports: '电竞',
      px_cat_politics: '政治', px_cat_culture: '文化', px_cat_finance: '金融', px_cat_economy: '经济',
      px_scat_all: '全部', px_scat_tech: '科技', px_scat_finance: '金融', px_scat_etf: 'ETF',
      px_scat_auto: '汽车', px_scat_consumer: '消费', px_scat_crypto: '加密板块',
      px_scat_energy: '能源', px_scat_health: '医疗',
      px_col_ticker: 'Ticker', px_col_price: '价格', px_col_chg: '24h %', px_col_vol: '24h 量', px_col_mc: '市值',
      px_reference_price: "参考价格",
      px_reference_help: "每股参考价格。最终交易价格根据您的金额计算。",
      px_buy_quote_help: '根据当前可用路线计算的平均买入价格。交易窗口会按输入金额重新计算；网络 Gas 另计。',
      px_buy_quote_unavailable: '当前没有可执行的买入报价。',
      px_none: '此筛选无结果 🔍', px_none_stocks: '未找到 🔍',
 px_foot_predict: '实时概率 · GROM 手续费 {pct}% · 通过 oracle（Chainlink / UMA）结算。',
      px_foot_xstocks: 'Backed xStocks 真实链上兑换（LiFi）· 手续费 0.20% · 非托管。',
      px_live: 'LIVE',
      px_view_all: '全部市场', px_view_live: 'Live 日历',
      px_cal_today: '今天', px_cal_tomorrow: '明天', px_cal_later: '稍后',
 px_cal_empty: '正在加载 实时事件…',
      dash_px_title: '预测市场', dash_px_sub: '真实事件的实时概率 — 体育、加密、政治。',
      dash_px_link: '全部市场 →',
      dash_banner_px_eyebrow: '预测市场', dash_banner_px_h: '体育 · 加密 · 政治',
 dash_banner_px_p: '实时概率。押注真实事件结果。',
      dash_banner_px_cta: '打开预测 →',
 qa_predict_t: '预测市场', qa_predict_d: '实时概率',
 lp_predict_eyebrow: '🎯 实时', lp_predict_h2: '预测市场',
      lp_predict_sub: '交易体育、加密、政治与宏观结果。合约价格 = 概率。',
      lp_predict_cta1: '打开全部预测 →', lp_predict_cta2: '代币化股票',
      gtm_cancel: '取消', gtm_demo_bal: '余额：', gtm_buy_shares: '买入概率',
      px_bet_title: '下注：', px_close: '平仓', px_sell_bet: '卖出',
      px_empty_bets: '暂无下注。在上方选择结果以下注。',
      px_empty_stocks: '暂无持仓。在上方买入 xStock — 将显示在此处和钱包中。',
      px_pos_closed: '持仓已平', px_market_closed: '市场已关闭，无法继续下注。', px_bet_sold: '下注已卖出（−5% 手续费）',
      px_enter_amount: '请输入金额', px_insufficient: '余额不足',
      px_now: '现价', px_price_unavail: '价格不可用',
      px_prob_line: '价格 {n}¢ = 概率 {n}%。',
      px_payout_line: '将获得 {sh} 份合约 · 最高赔付 {pay}，若结果成立。',
      px_load_more: '加载更多'
    },
    hi: {
      landing_kicker: 'FINANCE HUB', landing_logo_img_alt: 'GROM Finance Hub', landing_title: 'समझदारी से ट्रेड करें। GROM के साथ।',
      landing_lead: 'नॉन-कस्टोडियल DEX। क्रॉस-चेन मेटा-एग्रीगेटर स्वैप। आपकी कुंजियाँ।',
      landing_cta_trade: 'ट्रेडिंग शुरू करें', landing_cta_demo: 'डेमो अकाउंट',
      feat1_title: 'SPOT', feat1_desc: "उपलब्ध रूट की तुलना करें। वॉलेट में साइन करें और ऑन-चेन सेटल करें।",
      feat2_title: 'प्रेडिक्शन मार्केट', feat2_desc: 'छोटी एक्सपायरी, 92% तक पेआउट।',
      feat3_title: 'कोल्ड स्टोरेज', feat3_desc: '95% तक फंड मल्टी-सिग कोल्ड वॉलेट में।',
      feat4_title: 'PRO एनालिटिक्स', feat4_desc: 'इंडिकेटर, ऑर्डरबुक और सिग्नल एक डेस्क में।',
      dash_bc: 'डैशबोर्ड', dash_title: 'सुप्रभात, ट्रेडर', dash_sub: 'पोर्टफोलियो और वॉचलिस्ट का सारांश।',
      dash_welcome_h: 'GROM Finance Hub में आपका स्वागत है', dash_welcome_p: 'Spot, बाइनरी और DeFi — एक नॉन-कस्टोडियल वॉलेट से।',


      pg_spot_title: 'BTC/USDT', pg_spot_sub: 'लाइव ऑर्डरबुक और कैंडल — Binance, Kraken और Coinbase failover के साथ।',
      pg_markets_title: 'सभी मार्केट', pg_markets_sub: 'लाइव Hyperliquid मार्केट — Trade जैसे ही पेयर।',
      pg_wallet_title: 'आपका वॉलेट', pg_wallet_sub: 'ट्रेडिंग बैलेंस तुरंत Spot और Futures के लिए। ऑन-चेन स्वैप और निकासी आपके वॉलेट से।',
      pg_history_title: 'ट्रेड इतिहास', pg_history_sub: 'GROM पर सभी ट्रेड, जमा और निकासी।',
      pg_futures_bc: 'फ्यूचर्स', pg_futures_title: 'USDT-मार्जिन फ्यूचर्स', pg_futures_sub: 'आइसोलेटेड और क्रॉस मार्जिन, एग्रीगेटेड डेप्थ, bracket / OCO — Spot जैसा रिस्क इंजन।',
      fut_pos_title: 'खुली पोजीशन', fut_pos_empty: 'कोई खुला कॉन्ट्रैक्ट नहीं — लैडर से साइज़ करें या Quick long / short।',
      fut_ladder_title: 'क्विक लैडर', fut_btn_long: 'क्विक long', fut_btn_short: 'क्विक short',
      pg_referral_bc: 'रेफ़रल प्रोग्राम', pg_referral_title: 'रेफ़रल प्रोग्राम अभी सक्रिय नहीं है', pg_referral_sub: 'ट्रैकिंग और भुगतान शुरू होने से पहले शर्तें प्रकाशित की जाएँगी।',
      ref_link_title: 'आपका लिंक', ref_copy: 'कॉपी', ref_stat_inv: 'आमंत्रित', ref_stat_vol: 'उनका वॉल्यूम (30d)', ref_stat_earn: 'आपके rebates',
      pg_settings_bc: 'सेटिंग्स', pg_settings_title: 'प्राथमिकताएँ', pg_settings_sub: 'भाषा, नोटिफिकेशन और ट्रेडिंग डिफ़ॉल्ट इस ब्राउज़र में सेव होते हैं जब तक वॉलेट से साइन इन न करें।',
      set_lang_title: 'भाषा', set_notif_title: 'नोटिफिकेशन', set_notif_desc: 'इस बिल्ड में ब्राउज़र push बंद है — इन-ऐप अलर्ट के लिए घंटी का उपयोग करें।',
      pg_help_bc: 'सहायता', pg_help_title: 'सहायता और सपोर्ट', pg_help_sub: 'DEX हब कैसे इस्तेमाल करें: स्वैप, फ्यूचर्स, प्रेडिक्शन्स, स्टॉक्स — और टीम से संपर्क।',
      help_card_wallet_t: 'वॉलेट = अकाउंट', help_card_wallet_d: 'GROM नॉन-कस्टोडियल है: एक्सचेंज डिपॉज़िट नहीं। फंड आपके वॉलेट में रहते हैं।', help_card_wallet_f: 'Self-custody · on-chain',
      help_card_markets_t: 'चार मार्केट, एक वॉलेट', help_card_markets_d: "स्वैप, स्पॉट और परपेचुअल, प्रेडिक्शन और टोकनाइज़्ड स्टॉक्स — एक जुड़े हुए वॉलेट से।",
      help_card_support_t: 'सपोर्ट', help_card_support_d: 'Telegram या ईमेल लिखें। प्रॉडक्ट, पता, UTC समय और tx hash बताएँ।',
      help_qa_dash: 'डैशबोर्ड खोलें', help_qa_tg: 'Telegram', help_qa_tg_d: 'आधिकारिक चैनल', help_qa_email: 'ईमेल', help_qa_contact: 'संपर्क कैसे करें', help_qa_contact_d: 'नीचे FAQ',
      help_faq_title: 'अक्सर पूछे जाने वाले', help_faq_sub: 'DEX',
      help_faq_cust_q: 'क्या GROM कस्टोडियल है?', help_faq_cust_a: 'नहीं। नॉन-कस्टोडियल DEX हब। स्वैप एग्रीगेटर से सीधे आपके वॉलेट में।',
      help_faq_do_q: 'मैं क्या कर सकता हूँ?', help_faq_do_a: "<strong>स्वैप</strong> — टोकन और नेटवर्क के बीच उपलब्ध रूट।<br><strong>Trade</strong> — Hyperliquid स्पॉट और परपेचुअल; लीवरेज मार्केट पर निर्भर है।<br><strong>प्रेडिक्शन</strong> — इवेंट के नतीजों पर ट्रेड।<br><strong>स्टॉक्स</strong> — टोकनाइज़्ड xStocks।",
      help_faq_swap_q: 'स्वैप कैसे काम करता है?', help_faq_swap_a: 'वॉलेट कनेक्ट करें, टोकन चुनें, कोट तुलना करें और साइन करें।',
      help_faq_funds_q: 'फंड कैसे जोड़ें?', help_faq_funds_a: 'अपने वॉलेट पर क्रिप्टो भेजें या your wallet से खरीदें।',
      help_faq_fee_q: 'फीस क्या हैं?', help_faq_fee_a: 'स्वैप: रूटिंग फीस + गैस। कोई CEX ऑर्डर बुक नहीं।',
      help_faq_kyc_q: 'क्या KYC चाहिए?', help_faq_kyc_a: 'वॉलेट ट्रेडिंग के लिए नहीं। फिएट ऑन-रैंप अपनी जाँच कर सकते हैं।',
      help_faq_contact_q: 'व्यक्ति से कैसे संपर्क करें?', help_faq_contact_a: 'ईमेल support.grom@gmail.com या Telegram t.me/grom_finence_hub।',
      help_legal_title: 'कानूनी और जोखिम', help_legal_sub: 'संक्षेप',
      help_legal_risk_q: 'जिम्मेदार ट्रेडिंग', help_legal_risk_a: 'फ्यूचर्स और प्रेडिक्शन्स में नुकसान का जोखिम है। केवल वही ट्रेड करें जो खो सकते हैं।',
      help_legal_terms_q: 'उपयोग की शर्तें', help_legal_terms_a: 'GROM उपयोग का मतलब पात्रता और ऑन-चेन सेटलमेंट नियमों को स्वीकार करना है।',
      help_legal_priv_q: 'गोपनीयता', help_legal_priv_a: 'हम वॉलेट पता और सेशन डेटा प्रोसेस कर सकते हैं।',
      nav_predict: 'भविष्यवाणी', nav_xstocks: 'स्टॉक',
      pg_predict_bc: 'भविष्यवाणी', pg_xstocks_bc: 'स्टॉक',
      pg_predict_title: '_prediction markets', pg_predict_sub: 'वास्तविक इवेंट के परिणामों पर ट्रेड — खेल, क्रिप्टो, esports, राजनीति, संस्कृति, वित्त और अर्थव्यवस्था। कॉन्ट्रैक्ट कीमत = संभावना।',
      pg_xstocks_title: 'टोकनाइज़्ड स्टॉक',
      px_stock_title: 'स्टॉक',
      px_stock_intro: 'टोकनाइज़्ड स्टॉक और ETF। अपने वॉलेट से ट्रेड करें।',
      pg_xstocks_sub: 'वास्तविक S&P 500 / NASDAQ स्टॉक on-chain (Backed)। लाइव कीमत · non-custodial स्वैप।',
      px_demo_bal: 'बैलेंस', px_vol_24h: '24घं वॉल्यूम', px_markets_n: 'मार्केट', px_tickers: 'Tickers', px_trading: 'ट्रेडिंग',
      px_search_predict: 'मार्केट खोजें…', px_search_stocks: 'Ticker खोजें…',
      px_my_bets: 'मेरे दांव', px_my_positions: 'मेरी पोजीशन',
      px_yes: 'हाँ', px_no: 'नहीं', px_draw: 'ड्रॉ', px_chance: 'संभावना', px_vol: 'वॉल्यूम', px_outcome: 'परिणाम', px_buy: 'खरीदें', px_sell: 'बेचें',
      px_cat_all: 'सभी', px_cat_sport: 'खेल', px_cat_crypto: 'क्रिप्टो', px_cat_esports: 'Esports',
      px_cat_politics: 'राजनीति', px_cat_culture: 'संस्कृति', px_cat_finance: 'वित्त', px_cat_economy: 'अर्थव्यवस्था',
      px_scat_all: 'सभी', px_scat_tech: 'टेक', px_scat_finance: 'वित्त', px_scat_etf: 'ETF',
      px_scat_auto: 'ऑटो', px_scat_consumer: 'उपभोक्ता', px_scat_crypto: 'क्रिप्टो सेक्टर',
      px_scat_energy: 'ऊर्जा', px_scat_health: 'स्वास्थ्य',
      px_col_ticker: 'Ticker', px_col_price: 'कीमत', px_col_chg: '24घं %', px_col_vol: '24घं vol', px_col_mc: 'मार्केट कैप',
      px_reference_price: "सांकेतिक मूल्य",
      px_reference_help: "प्रति शेयर संदर्भ मूल्य। अंतिम सौदे का मूल्य आपकी राशि के लिए निकाला जाता है।",
      px_buy_quote_help: 'उपलब्ध रूट के आधार पर औसत खरीद मूल्य। ट्रेड विंडो आपकी राशि के अनुसार कोट फिर से गणना करती है; नेटवर्क गैस अलग है।',
      px_buy_quote_unavailable: 'अभी कोई निष्पादन योग्य खरीद कोट उपलब्ध नहीं है।',
      px_none: 'इस फ़िल्टर में कुछ नहीं 🔍', px_none_stocks: 'कुछ नहीं मिला 🔍',
 px_foot_predict: 'Live संभावनाएँ · GROM फीस {pct}% · oracle (Chainlink / UMA) से सेटल।',
      px_foot_xstocks: 'Backed xStocks के असली on-chain स्वैप (LiFi) · शुल्क 0.20% · non-custodial।',
      px_live: 'LIVE',
      px_view_all: 'सभी मार्केट', px_view_live: 'Live कैलेंडर',
      px_cal_today: 'आज', px_cal_tomorrow: 'कल', px_cal_later: 'बाद में',
 px_cal_empty: ' live इवेंट लोड हो रहे हैं…',
      dash_px_title: '_prediction markets', dash_px_sub: 'वास्तविक इवेंट की लाइव संभावनाएँ — खेल, क्रिप्टो, राजनीति।',
      dash_px_link: 'सभी मार्केट →',
      dash_banner_px_eyebrow: 'PREDICTION MARKETS', dash_banner_px_h: 'खेल · क्रिप्टो · राजनीति',
 dash_banner_px_p: ' लाइव संभावनाएँ। वास्तविक परिणामों पर दांव।',
      dash_banner_px_cta: 'भविष्यवाणी खोलें →',
 qa_predict_t: '_prediction markets', qa_predict_d: 'लाइव संभावनाएँ',
 lp_predict_eyebrow: '🎯 Live', lp_predict_h2: '_prediction markets',
      lp_predict_sub: 'खेल, क्रिप्टो, राजनीति और अर्थव्यवस्था के परिणाम। कॉन्ट्रैक्ट = संभावना।',
      lp_predict_cta1: 'सभी भविष्यवाणी खोलें →', lp_predict_cta2: 'टोकनाइज़्ड स्टॉक',
      gtm_cancel: 'रद्द', gtm_demo_bal: 'बैलेंस:', gtm_buy_shares: 'संभावना खरीदें',
      px_bet_title: 'दांव:', px_close: 'बंद', px_sell_bet: 'बेचें',
      px_empty_bets: 'अभी कोई दांव नहीं। ऊपर परिणाम चुनें।',
      px_empty_stocks: 'अभी कोई पोजीशन नहीं। ऊपर xStock खरीदें — यहाँ और Wallet में दिखेगा।',
      px_pos_closed: 'पोजीशन बंद', px_market_closed: 'बाज़ार बंद है — अब दांव नहीं लगाए जा सकते।', px_bet_sold: 'दांव बेचा गया (−5% फीस)',
      px_enter_amount: 'राशि दर्ज करें', px_insufficient: 'अपर्याप्त बैलेंस',
      px_now: 'अभी', px_price_unavail: 'कीमत उपलब्ध नहीं',
      px_prob_line: 'कीमत {n}¢ = संभावना {n}%.',
      px_payout_line: 'आपको {sh} कॉन्ट्रैक्ट मिलेंगे · अधिकतम भुगतान {pay}, यदि परिणाम सही हो।',
      px_load_more: 'और दिखाएँ'
    },
    tr: {
      landing_kicker: 'FINANCE HUB', landing_logo_img_alt: 'GROM Finance Hub', landing_title: 'Daha akıllı işlem yapın. GROM ile.',
      landing_lead: 'Non-custodial DEX. Cross-chain meta-agregatör swap. Anahtarlar sende.',
      landing_cta_trade: 'İşleme başla', landing_cta_demo: 'Demo hesap',
      feat1_title: 'SPOT', feat1_desc: "Mevcut rotaları karşılaştırın. Cüzdanınızda imzalayın, zincir üzerinde sonuçlandırın.",
      feat2_title: 'TAHMİN PİYASALARI', feat2_desc: 'Kısa vadeler, %92\'ye kadar getiri.',
      feat3_title: 'SOĞUK DEPOLAMA', feat3_desc: 'Fonların %95\'ine kadar multisig soğuk cüzdan.',
      feat4_title: 'PRO ANALİZ', feat4_desc: 'Göstergeler, emir defteri ve sinyaller tek masada.',
      dash_bc: 'Panel', dash_title: 'Günaydın, trader', dash_sub: 'Portföy ve izleme listesi özeti.',
      dash_welcome_h: "GROM Finance Hub'a hoş geldiniz", dash_welcome_p: 'Spot, ikili opsiyon ve DeFi — tek non-custodial cüzdandan.',


      pg_spot_title: 'BTC/USDT', pg_spot_sub: 'Canlı emir defteri ve mumlar — Binance, Kraken ve Coinbase otomatik yedekleme.',
      pg_markets_title: 'Tüm piyasalar', pg_markets_sub: 'Canlı Hyperliquid piyasaları — Trade ile aynı pariteler.',
      pg_wallet_title: 'Cüzdanınız', pg_wallet_sub: 'İşlem bakiyeleri anında Spot ve Futures için. Zincir üstü takas ve çekim bağlı cüzdanınızdan.',
      pg_history_title: 'İşlem geçmişi', pg_history_sub: "GROM'daki tüm işlemler, yatırma ve çekmeler.",
      pg_futures_bc: 'Vadeli', pg_futures_title: 'USDT marjlı vadeli', pg_futures_sub: 'İzole ve çapraz marj, birleşik derinlik, bracket / OCO — Spot ile aynı risk motoru.',
      fut_pos_title: 'Açık pozisyonlar', fut_pos_empty: 'Açık sözleşme yok — merdivenden boyutlandırın veya Quick long / short.',
      fut_ladder_title: 'Hızlı merdiven', fut_btn_long: 'Hızlı long', fut_btn_short: 'Hızlı short',
      pg_referral_bc: 'Referans programı', pg_referral_title: 'Referans programı henüz etkin değil', pg_referral_sub: 'Takip ve ödeme koşulları program başlamadan önce duyurulacak.',
      ref_link_title: 'Linkiniz', ref_copy: 'Kopyala', ref_stat_inv: 'Davetliler', ref_stat_vol: 'Hacimleri (30g)', ref_stat_earn: 'Rebate\'leriniz',
      pg_settings_bc: 'Ayarlar', pg_settings_title: 'Tercihler', pg_settings_sub: 'Dil, bildirimler ve işlem varsayılanları cüzdanla giriş yapana kadar bu tarayıcıda saklanır.',
      set_lang_title: 'Dil', set_notif_title: 'Bildirimler', set_notif_desc: 'Bu sürümde tarayıcı push kapalı — uygulama içi uyarılar için zili kullanın.',
      pg_help_bc: 'Yardım', pg_help_title: 'Yardım ve destek', pg_help_sub: 'DEX hub nasıl kullanılır: swap, vadeli, tahminler, hisseler — ve ekibe ulaşım.',
      help_card_wallet_t: 'Cüzdan = hesap', help_card_wallet_d: 'GROM saklama yapmaz: borsaya yatırma yok. Fonlar cüzdanınızda, işlemler zincirde.', help_card_wallet_f: 'Self-custody · on-chain',
      help_card_markets_t: 'Dört piyasa, bir cüzdan', help_card_markets_d: "Swap, spot ve sürekli vadeli, tahminler ve tokenleştirilmiş hisseler — tek bağlı cüzdandan.",
      help_card_support_t: 'Destek', help_card_support_d: 'Telegram veya e-posta yazın. Ürün, adres, UTC saati ve tx hash ekleyin.',
      help_qa_dash: 'Paneli aç', help_qa_tg: 'Telegram', help_qa_tg_d: 'Resmi kanal', help_qa_email: 'E-posta', help_qa_contact: 'Nasıl iletişim', help_qa_contact_d: 'Aşağıda SSS',
      help_faq_title: 'Sık sorulanlar', help_faq_sub: 'DEX',
      help_faq_cust_q: 'GROM saklama yapıyor mu?', help_faq_cust_a: 'Hayır. Non-custodial DEX hub. Swap’ler cüzdanınıza gider. Vadeli marj Hyperliquid’de.',
      help_faq_do_q: 'Ne yapabilirim?', help_faq_do_a: "<strong>Swap</strong> — tokenler ve ağlar arasındaki mevcut rotalar.<br><strong>Trade</strong> — Hyperliquid spot ve sürekli vadeli; kaldıraç piyasaya bağlıdır.<br><strong>Tahminler</strong> — olay sonuçları üzerine işlem.<br><strong>Hisseler</strong> — tokenleştirilmiş xStocks.",
      help_faq_swap_q: 'Swap nasıl çalışır?', help_faq_swap_a: 'Cüzdan bağlayın, token seçin, teklifleri karşılaştırın ve imzalayın.',
      help_faq_funds_q: 'Nasıl fon eklerim?', help_faq_funds_a: 'Kendi cüzdanınıza kripto gönderin veya your wallet ile alın.',
      help_faq_fee_q: 'Ücretler neler?', help_faq_fee_a: 'Swap: routing ücreti + gas. CEX order book yok.',
      help_faq_kyc_q: 'KYC gerekir mi?', help_faq_kyc_a: 'Cüzdan ticareti için hayır. Üçüncü taraf servislerin kendi kuralları olabilir.',
      help_faq_contact_q: 'İnsanla nasıl iletişim?', help_faq_contact_a: 'E-posta support.grom@gmail.com veya Telegram t.me/grom_finence_hub.',
      help_legal_title: 'Hukuki ve risk', help_legal_sub: 'Kısa',
      help_legal_risk_q: 'Sorumlu trading', help_legal_risk_a: 'Vadeli ve tahminler kayıp riski taşır. Sadece kaybedebileceğinizle işlem yapın.',
      help_legal_terms_q: 'Kullanım şartları', help_legal_terms_a: 'GROM kullanımı uygunluk ve on-chain settlement kurallarını kabul etmek demektir.',
      help_legal_priv_q: 'Gizlilik', help_legal_priv_a: 'Cüzdan adresi ve oturum verilerini işleyebiliriz.',
      nav_predict: 'Tahminler', nav_xstocks: 'Hisse',
      pg_predict_bc: 'Tahminler', pg_xstocks_bc: 'Hisse',
      pg_predict_title: 'Tahmin piyasaları', pg_predict_sub: 'Gerçek olay sonuçları — spor, kripto, esports, siyaset, kültür, finans ve ekonomi. Sözleşme fiyatı = olasılık.',
      pg_xstocks_title: 'Tokenize hisseler',
      px_stock_title: 'Hisseler',
      px_stock_intro: 'Tokenize hisseler ve ETF’ler. Cüzdanınızdan işlem yapın.',
      pg_xstocks_sub: 'Gerçek S&P 500 / NASDAQ hisseleri on-chain (Backed). Canlı fiyat · non-custodial swap.',
      px_demo_bal: 'Bakiye', px_vol_24h: '24s hacim', px_markets_n: 'Piyasa', px_tickers: 'Ticker', px_trading: 'İşlem',
      px_search_predict: 'Piyasa ara…', px_search_stocks: 'Ticker ara…',
      px_my_bets: 'Bahislerim', px_my_positions: 'Pozisyonlarım',
      px_yes: 'Evet', px_no: 'Hayır', px_draw: 'Beraberlik', px_chance: 'şans', px_vol: 'Hacim', px_outcome: 'Sonuç', px_buy: 'Al', px_sell: 'Sat',
      px_cat_all: 'Tümü', px_cat_sport: 'Spor', px_cat_crypto: 'Kripto', px_cat_esports: 'Esports',
      px_cat_politics: 'Siyaset', px_cat_culture: 'Kültür', px_cat_finance: 'Finans', px_cat_economy: 'Ekonomi',
      px_scat_all: 'Tümü', px_scat_tech: 'Teknoloji', px_scat_finance: 'Finans', px_scat_etf: 'ETF',
      px_scat_auto: 'Otomotiv', px_scat_consumer: 'Tüketim', px_scat_crypto: 'Kripto sektör',
      px_scat_energy: 'Enerji', px_scat_health: 'Sağlık',
      px_col_ticker: 'Ticker', px_col_price: 'Fiyat', px_col_chg: '24s %', px_col_vol: '24s hacim', px_col_mc: 'Piyasa değeri',
      px_reference_price: "Gösterge fiyatı",
      px_reference_help: "Hisse başına referans fiyat. Nihai işlem fiyatı tutarınız için hesaplanır.",
      px_buy_quote_help: 'Mevcut rota üzerinden ortalama alış fiyatı. İşlem penceresi kotasyonu girdiğiniz tutara göre yeniden hesaplar; ağ gas ücreti ayrıca ödenir.',
      px_buy_quote_unavailable: 'Şu anda yürütülebilir alış kotasyonu yok.',
      px_none: 'Bu filtrede sonuç yok 🔍', px_none_stocks: 'Sonuç yok 🔍',
 px_foot_predict: 'Canlı olasılıkları · GROM ücreti %{pct} · oracle (Chainlink / UMA) ile kapanış.',
      px_foot_xstocks: 'Backed xStocks gerçek on-chain swap (LiFi) · %0.20 ücret · non-custodial.',
      px_live: 'LIVE',
      px_view_all: 'Tüm piyasalar', px_view_live: 'Live takvim',
      px_cal_today: 'Bugün', px_cal_tomorrow: 'Yarın', px_cal_later: 'Daha sonra',
 px_cal_empty: 'canlı etkinlikleri yükleniyor…',
      dash_px_title: 'Tahmin piyasaları', dash_px_sub: 'Gerçek olayların canlı olasılıkları — spor, kripto, siyaset.',
      dash_px_link: 'Tüm piyasalar →',
      dash_banner_px_eyebrow: 'TAHMIN PIYASALARI', dash_banner_px_h: 'Spor · Kripto · Siyaset',
 dash_banner_px_p: 'canlı olasılıkları. Gerçek sonuçlara bahis.',
      dash_banner_px_cta: 'Tahminleri aç →',
 qa_predict_t: 'Tahmin piyasaları', qa_predict_d: 'Canlı olasılıklar',
 lp_predict_eyebrow: '🎯 Canlı', lp_predict_h2: 'Tahmin piyasaları',
      lp_predict_sub: 'Spor, kripto, siyaset ve makro sonuçları. Sözleşme fiyatı = olasılık.',
      lp_predict_cta1: 'Tüm tahminleri aç →', lp_predict_cta2: 'Tokenize hisseler',
      gtm_cancel: 'İptal', gtm_demo_bal: 'Bakiye:', gtm_buy_shares: 'Olasılık satın al',
      px_bet_title: 'Bahis:', px_close: 'Kapat', px_sell_bet: 'Sat',
      px_empty_bets: 'Henüz bahis yok. Yukarıdan sonuç seçerek bahis yapın.',
      px_empty_stocks: 'Henüz pozisyon yok. Yukarıdan xStock alın — burada ve Cüzdan’da görünür.',
      px_pos_closed: 'Pozisyon kapatıldı', px_market_closed: 'Piyasa kapandı; artık bahis yapılamaz.', px_bet_sold: 'Bahis satıldı (−%5 ücret)',
      px_enter_amount: 'Tutar girin', px_insufficient: 'Yetersiz bakiye',
      px_now: 'şimdi', px_price_unavail: 'Fiyat kullanılamıyor',
      px_prob_line: 'Fiyat {n}¢ = olasılık {n}%.',
      px_payout_line: '{sh} sözleşme alırsınız · maks. ödeme {pay}, sonuç tutarsa.',
      px_load_more: 'Daha fazla yükle'
    }
    };

  // Fix Hindi typos (_prediction -> proper Hindi)
  EXTRA.hi.pg_predict_title = 'भविष्यवाणी बाज़ार';
  EXTRA.hi.dash_px_title = 'भविष्यवाणी बाज़ार';
  EXTRA.en.help_legal_rwa_q = 'Tokenized stocks and LI.FI';
  EXTRA.en.help_legal_rwa_a = 'GROM is an independent interface; some routes, including transfers between networks, use LI.FI, which GROM integrates independently and without association with LI.FI. LI.FI is a technology infrastructure provider: it does not issue, distribute, market, promote, recommend or endorse any tokenized stock, provides no financial, investment or advisory services to users, and has no contractual relationship with users and no relationship with any token issuer. The smart contracts are non-custodial and transactions are executed by independent third-party protocols and solvers; LI.FI does not warrant the availability, reliability or operation of any third-party protocol, solver or token issuer at any time. Tokenized stocks may be regulated financial instruments in some jurisdictions and may not be suitable for all investors; blockchain transactions carry smart-contract, liquidity and regulatory risks. Seek independent legal and financial advice before trading tokenized stocks.';
  EXTRA.ru.help_legal_rwa_q = 'Токенизированные акции и LI.FI';
  EXTRA.ru.help_legal_rwa_a = 'GROM — независимый интерфейс; часть маршрутов, включая переводы между сетями, работает через LI.FI, который GROM интегрирует самостоятельно и без связи с LI.FI. LI.FI — поставщик технологической инфраструктуры: не выпускает, не распространяет, не продвигает, не рекламирует, не рекомендует и не одобряет токенизированные акции, не оказывает пользователям финансовых, инвестиционных или консультационных услуг, не имеет договорных отношений с пользователями и отношений с эмитентами токенов. Смарт-контракты некастодиальные, транзакции исполняют независимые сторонние протоколы и солверы; LI.FI не гарантирует доступность, надёжность и работу сторонних протоколов, солверов и эмитентов токенов. Токенизированные акции в ряде юрисдикций могут быть регулируемыми финансовыми инструментами и подходят не всем инвесторам; операции в блокчейне несут риски смарт-контрактов, ликвидности и регулирования. Перед сделками получите независимую юридическую и финансовую консультацию.';
  ['es', 'ar', 'zh', 'hi', 'tr'].forEach(function (l) { if (EXTRA[l]) { EXTRA[l].help_legal_rwa_q = EXTRA.en.help_legal_rwa_q; EXTRA[l].help_legal_rwa_a = EXTRA.en.help_legal_rwa_a; } });
  EXTRA.hi.qa_predict_t = 'भविष्यवाणी बाज़ार';
  EXTRA.hi.lp_predict_h2 = 'भविष्यवाणी बाज़ार';
  EXTRA.hi.pg_predict_sub = 'वास्तविक इवेंट के परिणामों पर ट्रेड — खेल, क्रिप्टो, esports, राजनीति, संस्कृति, वित्त और अर्थव्यवस्था। कॉन्ट्रैक्ट कीमत = संभावना।';
  EXTRA.hi.dash_px_sub = 'वास्तविक इवेंट की लाइव संभावनाएँ — खेल, क्रिप्टो, राजनीति।';

  var SHARED = {
    ru: {
      mkt_intro: "Котировки и изменение цен за 24 часа.", mkt_search: "Поиск тикера или названия…", mkt_favorites: "Избранное", mkt_gainers: "Растут", mkt_losers: "Падают",
      auth_login: 'Connect Wallet', lang_switched: 'Язык', mkt_trade: 'Торговать',
      set_regional_title: 'Регион', set_theme_title: 'Тема', set_theme_dark: 'Тёмная', set_theme_system: 'Системная',
      set_notif_fills: 'Исполнения и выигрыши', set_notif_transfers: 'Депозиты и выводы', set_notif_digest: 'Еженедельный дайджест', set_notif_product: 'Обновления продукта',
      set_protect_title: 'Торговая защита', set_protect_sub: 'Ответственная торговля',
      set_loss_cap_t: 'Дневной лимит убытка', set_loss_cap_m: 'Напоминания о риске для торговли из кошелька — GROM не хранит балансы',
      set_cooldown_t: 'Пауза после серии', set_cooldown_m: 'Авто-пауза после частых убытков',
      set_withdraw_t: 'Подтверждение переводов', set_withdraw_m: 'Крупные on-chain переводы требуют повторной проверки устройства в кошельке',
      set_enabled: 'Включено', set_strict: 'Строго', set_edit: 'Изменить', set_policy: 'Политика', set_review: 'Проверить'
    },
    en: {
      mkt_intro: "Live prices and 24-hour market moves.", mkt_search: "Search ticker or name…", mkt_favorites: "Favorites", mkt_gainers: "Gainers", mkt_losers: "Losers",
      auth_login: 'Connect Wallet', lang_switched: 'Language', mkt_trade: 'Trade',
      set_regional_title: 'Regional', set_theme_title: 'Theme', set_theme_dark: 'Dark', set_theme_system: 'System',
      set_notif_fills: 'Order fills & wins', set_notif_transfers: 'Deposits & withdrawals', set_notif_digest: 'Weekly digest', set_notif_product: 'Product updates',
      set_protect_title: 'Trading protections', set_protect_sub: 'Responsible trading',
      set_loss_cap_t: 'Daily loss cap', set_loss_cap_m: 'Optional risk reminders for your own wallet trading — GROM never holds balances',
      set_cooldown_t: 'Cooldown after streak', set_cooldown_m: 'Auto cool-off after repeated high-frequency losses',
      set_withdraw_t: 'Transfer confirmations', set_withdraw_m: 'Large on-chain transfers require a wallet device re-check — no email approval',
      set_enabled: 'Enabled', set_strict: 'Strict', set_edit: 'Edit', set_policy: 'Policy', set_review: 'Review'
    },
    es: {
      mkt_intro: "Cotizaciones y cambios de precio en 24 horas.", mkt_search: "Buscar símbolo o nombre…", mkt_favorites: "Favoritos", mkt_gainers: "Al alza", mkt_losers: "A la baja",
      auth_login: 'Connect Wallet', lang_switched: 'Idioma', mkt_trade: 'Operar',
      set_regional_title: 'Regional', set_theme_title: 'Tema', set_theme_dark: 'Oscuro', set_theme_system: 'Sistema',
      set_notif_fills: 'Ejecuciones y ganancias', set_notif_transfers: 'Depósitos y retiros', set_notif_digest: 'Resumen semanal', set_notif_product: 'Actualizaciones',
      set_protect_title: 'Protecciones de trading', set_protect_sub: 'Trading responsable',
      set_loss_cap_t: 'Límite diario de pérdida', set_loss_cap_m: 'Recordatorios de riesgo para trading con tu billetera — GROM no custodia saldos',
      set_cooldown_t: 'Pausa tras racha', set_cooldown_m: 'Pausa automática tras pérdidas frecuentes',
      set_withdraw_t: 'Confirmación de transferencias', set_withdraw_m: 'Transferencias on-chain grandes requieren re-verificación del dispositivo en el monedero',
      set_enabled: 'Activo', set_strict: 'Estricto', set_edit: 'Editar', set_policy: 'Política', set_review: 'Revisar'
    },
    ar: {
      mkt_intro: "أسعار مباشرة وتغيرات السوق خلال 24 ساعة.", mkt_search: "ابحث بالرمز أو الاسم…", mkt_favorites: "المفضلة", mkt_gainers: "الرابحون", mkt_losers: "الخاسرون",
      auth_login: 'Connect Wallet', lang_switched: 'اللغة', mkt_trade: 'تداول',
      set_regional_title: 'الإعدادات الإقليمية', set_theme_title: 'المظهر', set_theme_dark: 'داكن', set_theme_system: 'النظام',
      set_notif_fills: 'تنفيذات وانتصارات', set_notif_transfers: 'إيداعات وسحوبات', set_notif_digest: 'ملخص أسبوعي', set_notif_product: 'تحديثات المنتج',
      set_protect_title: 'حماية التداول', set_protect_sub: 'تداول مسؤول',
      set_loss_cap_t: 'حد الخسارة اليومي', set_loss_cap_m: 'تذكيرات مخاطر لتداول محفظتك — GROM لا يحتفظ بأرصدة',
      set_cooldown_t: 'توقف بعد سلسلة', set_cooldown_m: 'توقف تلقائي بعد خسائر متكررة',
      set_withdraw_t: 'تأكيد التحويلات', set_withdraw_m: 'التحويلات الكبيرة على السلسلة تتطلب إعادة التحقق من الجهاز في المحفظة',
      set_enabled: 'مفعّل', set_strict: 'صارم', set_edit: 'تعديل', set_policy: 'السياسة', set_review: 'مراجعة'
    },
    zh: {
      mkt_intro: "实时价格与 24 小时市场涨跌。", mkt_search: "搜索代码或名称…", mkt_favorites: "自选", mkt_gainers: "涨幅", mkt_losers: "跌幅",
      auth_login: 'Connect Wallet', lang_switched: '语言', mkt_trade: '交易',
      set_regional_title: '区域', set_theme_title: '主题', set_theme_dark: '深色', set_theme_system: '跟随系统',
      set_notif_fills: '成交与盈利', set_notif_transfers: '充值与提现', set_notif_digest: '每周摘要', set_notif_product: '产品更新',
      set_protect_title: '交易保护', set_protect_sub: '负责任交易',
      set_loss_cap_t: '每日亏损上限', set_loss_cap_m: '自托管交易的风险提示 — GROM 不托管余额',
      set_cooldown_t: '连亏冷却', set_cooldown_m: '高频连亏后自动冷却',
      set_withdraw_t: '转账确认', set_withdraw_m: '大额链上转账需在钱包中重新验证设备 — 无需邮箱审批',
      set_enabled: '已启用', set_strict: '严格', set_edit: '编辑', set_policy: '政策', set_review: '审核'
    },
    hi: {
      mkt_intro: "लाइव कीमतें और 24 घंटे का बदलाव।", mkt_search: "टिकर या नाम खोजें…", mkt_favorites: "पसंदीदा", mkt_gainers: "बढ़ने वाले", mkt_losers: "गिरने वाले",
      auth_login: 'Connect Wallet', lang_switched: 'भाषा', mkt_trade: 'ट्रेड',
      set_regional_title: 'क्षेत्र', set_theme_title: 'थीम', set_theme_dark: 'डार्क', set_theme_system: 'सिस्टम',
      set_notif_fills: 'ऑर्डर फिल और जीत', set_notif_transfers: 'जमा और निकासी', set_notif_digest: 'साप्ताहिक सार', set_notif_product: 'उत्पाद अपडेट',
      set_protect_title: 'ट्रेडिंग सुरक्षा', set_protect_sub: 'जिम्मेदार ट्रेडिंग',
      set_loss_cap_t: 'दैनिक हानि सीमा', set_loss_cap_m: 'वॉलेट ट्रेडिंग के लिए जोखिम अनुस्मारक — GROM बैलेंस नहीं रखता',
      set_cooldown_t: 'स्ट्रीक के बाद विराम', set_cooldown_m: 'बार-बार हानि के बाद ऑटो विराम',
      set_withdraw_t: 'ट्रांसफ़र पुष्टि', set_withdraw_m: 'बड़े ऑन-चेन ट्रांसफ़र के लिए वॉलेट में डिवाइस पुनः जाँच — कोई ईमेल अनुमोदन नहीं',
      set_enabled: 'सक्रिय', set_strict: 'सख्त', set_edit: 'संपादित', set_policy: 'नीति', set_review: 'समीक्षा'
    },
    tr: {
      mkt_intro: "Canlı fiyatlar ve 24 saatlik değişimler.", mkt_search: "Sembol veya ad ara…", mkt_favorites: "Favoriler", mkt_gainers: "Yükselenler", mkt_losers: "Düşenler",
      auth_login: 'Connect Wallet', lang_switched: 'Dil', mkt_trade: 'İşlem',
      set_regional_title: 'Bölgesel', set_theme_title: 'Tema', set_theme_dark: 'Koyu', set_theme_system: 'Sistem',
      set_notif_fills: 'Emir gerçekleşmeleri ve kazançlar', set_notif_transfers: 'Yatırma ve çekme', set_notif_digest: 'Haftalık özet', set_notif_product: 'Ürün güncellemeleri',
      set_protect_title: 'İşlem korumaları', set_protect_sub: 'Sorumlu işlem',
      set_loss_cap_t: 'Günlük zarar limiti', set_loss_cap_m: 'Cüzdan ticaretiniz için risk hatırlatıcıları — GROM bakiye tutmaz',
      set_cooldown_t: 'Seri sonrası bekleme', set_cooldown_m: 'Tekrarlayan kayıplardan sonra otomatik ara',
      set_withdraw_t: 'Transfer onayları', set_withdraw_m: 'Büyük on-chain transferler cüzdanda cihaz yeniden doğrulaması gerektirir — e-posta onayı yok',
      set_enabled: 'Açık', set_strict: 'Sıkı', set_edit: 'Düzenle', set_policy: 'Politika', set_review: 'İncele'
    }
    };
  ['ru', 'en', 'es', 'ar', 'zh', 'hi', 'tr'].forEach(function (lng) {
    if (EXTRA[lng] && SHARED[lng]) Object.assign(EXTRA[lng], SHARED[lng]);
  });

  // Dashboard / settings / help — page strings for all langs
  var PAGE_UI = {
    ru: {
      dash_banner_spot_eyebrow: 'INSTANT SWAP', dash_banner_spot_h: "Своп между сетями", dash_banner_spot_p: "Сравниваем доступные маршруты. Подпись в кошельке, расчёт в блокчейне.", dash_banner_spot_cta: 'Свопнуть →',

      dash_banner_fut_eyebrow: "TRADE · PERP & SPOT", dash_banner_fut_h: "Spot и фьючерсы", dash_banner_fut_p: "Торговля на Hyperliquid. Плечо зависит от выбранного рынка.", dash_banner_fut_cta: 'Открыть Trade →',
      dash_stat_portfolio: 'Стоимость портфеля', dash_stat_pnl: 'P&L за 24ч', dash_stat_open: 'Открытые позиции', dash_stat_assets: 'Активы',
      dash_ms_title: 'Снимок рынка', dash_ms_live: 'LIVE', dash_ms_swipe: '← свайп →',
      ms_cat_crypto: 'Крипто', ms_cat_fx: 'Форекс', ms_cat_index: 'Индексы', ms_cat_etf: 'ETF', ms_cat_live: 'live',
      ms_cat_tradfi: 'TradFi', ms_cat_hip3: 'HIP-3', ms_cat_trending: 'Trending', ms_cat_prelaunch: 'Pre-launch',
      dash_qa_title: 'Быстрые действия', dash_qa_sub: 'Нажмите <span class="kbd">⌘K</span> для поиска',
        qa_spot_t: 'Мгновенный своп', qa_spot_d: 'Лучший маршрут on-chain',
      qa_dep_t: 'Пополнить кошелёк', qa_dep_d: 'Пополните кошелёк · ваш кошелёк', qa_mkt_t: 'Обзор рынков', qa_mkt_d: '10 000+ токенов',
      qa_hist_t: 'История', qa_hist_d: 'Все сделки и переводы', qa_tour_t: 'Помощь', qa_tour_d: 'Справка и поддержка',
      set_profile_title: 'Профиль', set_display_name: 'Отображаемое имя', set_contact_label: '', set_wallet: 'Кошелёк', set_save: 'Сохранить',
      set_security_title: 'Безопасность',    set_review_sessions: 'Активные сессии'
    },
    en: {
      dash_banner_spot_eyebrow: 'INSTANT SWAP', dash_banner_spot_h: "Swap across networks", dash_banner_spot_p: "Compare available routes. Sign in your wallet and settle on-chain.", dash_banner_spot_cta: 'Swap now →',

      dash_banner_fut_eyebrow: "TRADE · PERP & SPOT", dash_banner_fut_h: "Spot and perpetuals", dash_banner_fut_p: "Trade on Hyperliquid. Leverage depends on the selected market.", dash_banner_fut_cta: 'Open Trade →',
      dash_stat_portfolio: 'Portfolio value', dash_stat_pnl: '24h P&L', dash_stat_open: 'Open positions', dash_stat_assets: 'Assets',
      dash_ms_title: 'Market snapshot', dash_ms_live: 'Live', dash_ms_swipe: '← swipe →',
      ms_cat_crypto: 'Crypto', ms_cat_fx: 'Forex', ms_cat_index: 'Indices', ms_cat_etf: 'ETF', ms_cat_live: 'live',
      ms_cat_tradfi: 'TradFi', ms_cat_hip3: 'HIP-3', ms_cat_trending: 'Trending', ms_cat_prelaunch: 'Pre-launch',
      dash_qa_title: 'Quick actions', dash_qa_sub: 'Press <span class="kbd">⌘K</span> to search any action',
        qa_spot_t: 'Instant Swap', qa_spot_d: 'Best on-chain route',
      qa_dep_t: 'Fund wallet', qa_dep_d: 'Fund in your wallet app · your wallet', qa_mkt_t: 'Browse markets', qa_mkt_d: '10 000+ tokens',
      qa_hist_t: 'View history', qa_hist_d: 'All trades & transfers', qa_tour_t: 'Help', qa_tour_d: 'Docs & support',
      set_profile_title: 'Profile', set_display_name: 'Display name', set_contact_label: '', set_wallet: 'Wallet', set_save: 'Save changes',
      set_security_title: 'Security',    set_review_sessions: 'Review active sessions'
    },
    es: {
      dash_banner_spot_eyebrow: 'INSTANT SWAP', dash_banner_spot_h: "Swap entre redes", dash_banner_spot_p: "Comparamos las rutas disponibles. Firma en tu billetera y liquida en la cadena.", dash_banner_spot_cta: 'Swap ahora →',

      dash_banner_fut_eyebrow: "TRADE · PERP & SPOT", dash_banner_fut_h: "Spot y perpetuos", dash_banner_fut_p: "Opera en Hyperliquid. El apalancamiento depende del mercado elegido.", dash_banner_fut_cta: 'Abrir Futuros →',
      dash_stat_portfolio: 'Valor del portafolio', dash_stat_pnl: 'P&L 24h', dash_stat_open: 'Posiciones abiertas',
      dash_ms_title: 'Resumen de mercado', dash_ms_live: 'Live', dash_ms_swipe: '← deslizar →',
      ms_cat_crypto: 'Cripto', ms_cat_fx: 'Forex', ms_cat_index: 'Índices', ms_cat_etf: 'ETF', ms_cat_live: 'live',
      ms_cat_tradfi: 'TradFi', ms_cat_hip3: 'HIP-3', ms_cat_trending: 'Trending', ms_cat_prelaunch: 'Pre-launch',
      dash_qa_title: 'Acciones rápidas', dash_qa_sub: 'Pulsa <span class="kbd">⌘K</span> para buscar',
        qa_spot_t: 'Instant Swap', qa_spot_d: 'Mejor ruta on-chain',
      qa_dep_t: 'Fondear wallet', qa_dep_d: 'Fondea en tu wallet · tu wallet', qa_mkt_t: 'Explorar mercados', qa_mkt_d: '10 000+ tokens',
      qa_hist_t: 'Ver historial', qa_hist_d: 'Todas las operaciones', qa_tour_t: 'Ayuda', qa_tour_d: 'Docs y soporte',
      set_profile_title: 'Perfil', set_display_name: 'Nombre visible', set_contact_label: '', set_wallet: 'Billetera', set_save: 'Guardar cambios',
      set_security_title: 'Seguridad',    set_review_sessions: 'Revisar sesiones activas'
    },
    ar: {
      dash_banner_spot_eyebrow: 'INSTANT SWAP', dash_banner_spot_h: "مبادلة عبر الشبكات", dash_banner_spot_p: "نقارن المسارات المتاحة. وقّع في محفظتك لتتم التسوية على السلسلة.", dash_banner_spot_cta: 'بدّل الآن →',

      dash_banner_fut_eyebrow: "TRADE · PERP & SPOT", dash_banner_fut_h: "التداول الفوري والعقود الدائمة", dash_banner_fut_p: "تداول على Hyperliquid. تعتمد الرافعة المالية على السوق المختار.", dash_banner_fut_cta: 'افتح العقود →',
      dash_stat_portfolio: 'قيمة المحفظة', dash_stat_pnl: 'P&L 24س', dash_stat_open: 'مراكز مفتوحة',
      dash_ms_title: 'لمحة السوق', dash_ms_live: 'Live', dash_ms_swipe: '← اسحب →',
      ms_cat_crypto: 'كريبتو', ms_cat_fx: 'فوركس', ms_cat_index: 'مؤشرات', ms_cat_etf: 'ETF', ms_cat_live: 'live',
      ms_cat_tradfi: 'TradFi', ms_cat_hip3: 'HIP-3', ms_cat_trending: 'Trending', ms_cat_prelaunch: 'Pre-launch',
      dash_qa_title: 'إجراءات سريعة', dash_qa_sub: 'اضغط <span class="kbd">⌘K</span> للبحث',
        qa_spot_t: 'Instant Swap', qa_spot_d: 'أفضل مسار on-chain',
      qa_dep_t: 'تمويل المحفظة', qa_dep_d: 'موّل محفظتك · محفظتك', qa_mkt_t: 'تصفح الأسواق', qa_mkt_d: 'أكثر من 10 000 توكن',
      qa_hist_t: 'عرض السجل', qa_hist_d: 'كل الصفقات والتحويلات', qa_tour_t: 'مساعدة', qa_tour_d: 'الدعم والوثائق',
      set_profile_title: 'الملف الشخصي', set_display_name: 'الاسم المعروض', set_contact_label: '', set_wallet: 'المحفظة', set_save: 'حفظ التغييرات',
      set_security_title: 'الأمان',    set_review_sessions: 'مراجعة الجلسات النشطة'
    },
    zh: {
      dash_banner_spot_eyebrow: 'INSTANT SWAP', dash_banner_spot_h: "跨网络兑换", dash_banner_spot_p: "比较可用路径。在钱包中签名，链上结算。", dash_banner_spot_cta: '立即兑换 →',

      dash_banner_fut_eyebrow: "TRADE · PERP & SPOT", dash_banner_fut_h: "现货与永续合约", dash_banner_fut_p: "在 Hyperliquid 交易。杠杆上限取决于所选市场。", dash_banner_fut_cta: '打开合约 →',
      dash_stat_portfolio: '组合价值', dash_stat_pnl: '24小时盈亏', dash_stat_open: '未平仓位',
      dash_ms_title: '市场快照', dash_ms_live: 'Live', dash_ms_swipe: '← 滑动 →',
      ms_cat_crypto: '加密', ms_cat_fx: '外汇', ms_cat_index: '指数', ms_cat_etf: 'ETF', ms_cat_live: 'live',
      ms_cat_tradfi: 'TradFi', ms_cat_hip3: 'HIP-3', ms_cat_trending: 'Trending', ms_cat_prelaunch: 'Pre-launch',
      dash_qa_title: '快捷操作', dash_qa_sub: '按 <span class="kbd">⌘K</span> 搜索',
        qa_spot_t: 'Instant Swap', qa_spot_d: '最优链上路由',
      qa_dep_t: '充值钱包', qa_dep_d: "在钱包应用中充值", qa_mkt_t: '浏览市场', qa_mkt_d: '10 000+ 代币',
      qa_hist_t: '查看历史', qa_hist_d: '全部成交与划转', qa_tour_t: '帮助', qa_tour_d: '文档与支持',
      set_profile_title: '个人资料', set_display_name: '显示名称', set_contact_label: '', set_wallet: '钱包', set_save: '保存更改',
      set_security_title: '安全',    set_review_sessions: '查看活跃会话'
    },
    hi: {
      dash_banner_spot_eyebrow: 'INSTANT SWAP', dash_banner_spot_h: "नेटवर्क के बीच स्वैप", dash_banner_spot_p: "उपलब्ध रूट की तुलना करें। वॉलेट में साइन करें और ऑन-चेन सेटल करें।", dash_banner_spot_cta: 'अभी स्वैप →',

      dash_banner_fut_eyebrow: "TRADE · PERP & SPOT", dash_banner_fut_h: "स्पॉट और परपेचुअल", dash_banner_fut_p: "Hyperliquid पर ट्रेड करें। लीवरेज चुने गए मार्केट पर निर्भर है।", dash_banner_fut_cta: 'Futures खोलें →',
      dash_stat_portfolio: 'पोर्टफोलियो मूल्य', dash_stat_pnl: '24h P&L', dash_stat_open: 'खुली पोज़िशन',
      dash_ms_title: 'मार्केट स्नैपशॉट', dash_ms_live: 'Live', dash_ms_swipe: '← स्वाइप →',
      ms_cat_crypto: 'क्रिप्टो', ms_cat_fx: 'फॉरेक्स', ms_cat_index: 'इंडेक्स', ms_cat_etf: 'ETF', ms_cat_live: 'live',
      ms_cat_tradfi: 'TradFi', ms_cat_hip3: 'HIP-3', ms_cat_trending: 'Trending', ms_cat_prelaunch: 'Pre-launch',
      dash_qa_title: 'त्वरित कार्य', dash_qa_sub: '<span class="kbd">⌘K</span> दबाकर खोजें',
        qa_spot_t: 'Instant Swap', qa_spot_d: 'बेस्ट on-chain रूट',
      qa_dep_t: 'वॉलेट फंड', qa_dep_d: 'वॉलेट ऐप से फंड · आपका वॉलेट', qa_mkt_t: 'मार्केट देखें', qa_mkt_d: '10 000+ टोकन',
      qa_hist_t: 'इतिहास', qa_hist_d: 'सभी ट्रेड और ट्रांसफर', qa_tour_t: 'मदद', qa_tour_d: 'डॉक्स और सपोर्ट',
      set_profile_title: 'प्रोफ़ाइल', set_display_name: 'प्रदर्शित नाम', set_contact_label: '', set_wallet: 'वॉलेट', set_save: 'सहेजें',
      set_security_title: 'सुरक्षा',    set_review_sessions: 'सक्रिय सत्र देखें'
    },
    tr: {
      dash_banner_spot_eyebrow: 'INSTANT SWAP', dash_banner_spot_h: "Ağlar arası swap", dash_banner_spot_p: "Mevcut rotaları karşılaştırın. Cüzdanınızda imzalayın, zincir üzerinde sonuçlandırın.", dash_banner_spot_cta: 'Şimdi swap →',

      dash_banner_fut_eyebrow: "TRADE · PERP & SPOT", dash_banner_fut_h: "Spot ve sürekli vadeli", dash_banner_fut_p: "Hyperliquid üzerinde işlem yapın. Kaldıraç seçilen piyasaya bağlıdır.", dash_banner_fut_cta: 'Vadeli aç →',
      dash_stat_portfolio: 'Portföy değeri', dash_stat_pnl: '24s K/Z', dash_stat_open: 'Açık pozisyonlar',
      dash_ms_title: 'Piyasa özeti', dash_ms_live: 'Live', dash_ms_swipe: '← kaydır →',
      ms_cat_crypto: 'Kripto', ms_cat_fx: 'Forex', ms_cat_index: 'Endeksler', ms_cat_etf: 'ETF', ms_cat_live: 'live',
      ms_cat_tradfi: 'TradFi', ms_cat_hip3: 'HIP-3', ms_cat_trending: 'Trending', ms_cat_prelaunch: 'Pre-launch',
      dash_qa_title: 'Hızlı işlemler', dash_qa_sub: 'Aramak için <span class="kbd">⌘K</span>',
        qa_spot_t: 'Instant Swap', qa_spot_d: 'En iyi on-chain rota',
      qa_dep_t: 'Cüzdan fonla', qa_dep_d: 'Cüzdan uygulamasından fonla · senin cüzdanın', qa_mkt_t: 'Piyasalara göz at', qa_mkt_d: '10 000+ token',
      qa_hist_t: 'Geçmişi gör', qa_hist_d: 'Tüm işlemler ve transferler', qa_tour_t: 'Yardım', qa_tour_d: 'Doküman ve destek',
      set_profile_title: 'Profil', set_display_name: 'Görünen ad', set_contact_label: '', set_wallet: 'Cüzdan', set_save: 'Değişiklikleri kaydet',
      set_security_title: 'Güvenlik',    set_review_sessions: 'Aktif oturumları incele'
    }
    };
  ['ru', 'en', 'es', 'ar', 'zh', 'hi', 'tr'].forEach(function (lng) {
    if (EXTRA[lng] && PAGE_UI[lng]) Object.assign(EXTRA[lng], PAGE_UI[lng]);
  });

  var HIST_REF_UI = {
    es: {
      pg_history_sub: 'Swaps, spot, futuros, predicciones y acciones tokenizadas en GROM.',
      hist_sum_pnl: 'P&L 30d', hist_sum_pnl_sub: 'Resultado realizado de operaciones',
      hist_sum_trades: 'Operaciones', hist_sum_trades_sub: 'En el filtro actual',
      hist_sum_swaps: 'Swaps', hist_sum_swaps_sub: 'Intercambios on-chain',
      hist_all_activity: 'Toda la actividad',
      hist_f_all: 'Todos', hist_f_swap: 'Swap', hist_f_spot: 'Spot', hist_f_fut: 'Futuros', hist_f_predict: 'Predicciones', hist_f_xstocks: 'Acciones',
      hist_export: 'Exportar CSV',
      hist_empty: 'Conecta la billetera y opera — el historial aparecerá aquí.',
      hist_empty_activity: 'Sin actividad aún — swaps y operaciones aparecerán aquí.',
      ref_title: 'Programa de referidos', ref_tag: 'Inactivo',
      ref_invite_code: 'Tu código', ref_invite_link: 'Enlace de invitación', ref_copy_link: 'Copiar enlace', ref_scan_join: 'Escanea para unirte',
      ref_total_referred: 'Total referidos', ref_active_30d: 'Activos (30d)', ref_total_earned: 'Total ganado', ref_pending_payout: 'Pendiente de pago',
      ref_paid_daily: 'Pagos aún no disponibles',
      ref_commission_status: 'Estado de comisiones', ref_status_live: 'Inactivo', ref_today_accrual: 'Acumulado hoy',
      ref_awaiting: 'El seguimiento aún no está activo', ref_onchain_rebate: 'Los pagos aún no están activos',
      ref_pending_label: 'Pendiente', ref_paid_onchain: 'Los pagos se anunciarán al activar el programa',
      ref_your_referrals: 'Tus referidos', ref_last_10: 'últimos 10',
      ref_tbl_user: 'Usuario', ref_tbl_joined: 'Registro', ref_tbl_volume_30d: 'Volumen 30d', ref_tbl_tier: 'Nivel', ref_tbl_earnings: 'Tus ganancias',
      ref_empty_list: 'Aún no hay referidos — comparte tu enlace',
      ref_connect_wallet_code: 'Conecta la billetera para generar', ref_connect_wallet_link: 'Conecta la billetera para ver tu enlace',
      ref_sign_for_code: 'Firma un mensaje para generar tu código', ref_sign_for_link: 'Firma un mensaje para ver tu enlace', ref_sign_to_load: 'Inicia sesión con tu billetera'
    },
    ar: {
      pg_history_sub: 'المبادلات والسبوت والعقود والتنبؤات والأسهم على GROM.',
      hist_sum_pnl: 'P&L 30ي', hist_sum_pnl_sub: 'النتيجة المحققة من الصفقات',
      hist_sum_trades: 'صفقات', hist_sum_trades_sub: 'في الفلتر الحالي',
      hist_sum_swaps: 'مبادلات', hist_sum_swaps_sub: 'تبادلات on-chain',
      hist_all_activity: 'كل النشاط',
      hist_f_all: 'الكل', hist_f_swap: 'مبادلة', hist_f_spot: 'سبوت', hist_f_fut: 'عقود', hist_f_predict: 'تنبؤات', hist_f_xstocks: 'أسهم',
      hist_export: 'تصدير CSV',
      hist_empty: 'اربط المحفظة ونفّذ صفقة — سيظهر السجل هنا.',
      hist_empty_activity: 'لا نشاط بعد — المبادلات والصفقات ستظهر هنا.',
      ref_title: 'برنامج الإحالة', ref_tag: 'غير نشط',
      ref_invite_code: 'رمز الدعوة', ref_invite_link: 'رابط الدعوة', ref_copy_link: 'نسخ الرابط', ref_scan_join: 'امسح للانضمام',
      ref_total_referred: 'إجمالي المدعوين', ref_active_30d: 'نشط (30ي)', ref_total_earned: 'إجمالي الأرباح', ref_pending_payout: 'قيد الدفع',
      ref_paid_daily: 'المدفوعات غير متاحة بعد',
      ref_commission_status: 'حالة العمولة', ref_status_live: 'غير نشط', ref_today_accrual: 'تراكم اليوم',
      ref_awaiting: 'التتبع غير مفعّل بعد', ref_onchain_rebate: 'المدفوعات غير مفعّلة بعد',
      ref_pending_label: 'قيد الدفع', ref_paid_onchain: 'سيُعلن عن المدفوعات بعد الإطلاق',
      ref_your_referrals: 'إحالاتك', ref_last_10: 'آخر 10',
      ref_tbl_user: 'المستخدم', ref_tbl_joined: 'الانضمام', ref_tbl_volume_30d: 'الحجم 30ي', ref_tbl_tier: 'المستوى', ref_tbl_earnings: 'أرباحك',
      ref_empty_list: 'لا إحالات بعد — شارك رابطك',
      ref_connect_wallet_code: 'اربط المحفظة لإنشاء الرمز', ref_connect_wallet_link: 'اربط المحفظة لإظهار الرابط',
      ref_sign_for_code: 'وقّع رسالة لإنشاء رمزك', ref_sign_for_link: 'وقّع رسالة لإظهار رابطك', ref_sign_to_load: 'سجّل الدخول بالمحفظة'
    },
    zh: {
      pg_history_sub: 'GROM 上的兑换、现货、永续、预测与代币化股票。',
      hist_sum_pnl: '30天盈亏', hist_sum_pnl_sub: '已实现交易结果',
      hist_sum_trades: '成交', hist_sum_trades_sub: '当前筛选',
      hist_sum_swaps: '兑换', hist_sum_swaps_sub: '链上交换',
      hist_all_activity: '全部活动',
      hist_f_all: '全部', hist_f_swap: '兑换', hist_f_spot: '现货', hist_f_fut: '永续', hist_f_predict: '预测', hist_f_xstocks: '股票',
      hist_export: '导出 CSV',
      hist_empty: '连接钱包并交易 — 历史将显示在此。',
      hist_empty_activity: '暂无活动 — 兑换与交易将显示在此。',
      ref_title: '推荐计划', ref_tag: '暂未启用',
      ref_invite_code: '邀请码', ref_invite_link: '邀请链接', ref_copy_link: '复制链接', ref_scan_join: '扫码加入',
      ref_total_referred: '总邀请', ref_active_30d: '活跃 (30天)', ref_total_earned: '总收益', ref_pending_payout: '待支付',
      ref_paid_daily: '付款暂不可用',
      ref_commission_status: '佣金状态', ref_status_live: '暂未启用', ref_today_accrual: '今日累计',
      ref_awaiting: '推荐跟踪暂未启用', ref_onchain_rebate: '付款暂未启用',
      ref_pending_label: '待支付', ref_paid_onchain: '计划启用后公布付款安排',
      ref_your_referrals: '你的推荐', ref_last_10: '最近 10',
      ref_tbl_user: '用户', ref_tbl_joined: '加入', ref_tbl_volume_30d: '30天成交量', ref_tbl_tier: '等级', ref_tbl_earnings: '你的收益',
      ref_empty_list: '暂无推荐 — 分享你的链接',
      ref_connect_wallet_code: '连接钱包以生成', ref_connect_wallet_link: '连接钱包以显示链接',
      ref_sign_for_code: '签署消息以生成邀请码', ref_sign_for_link: '签署消息以显示邀请链接', ref_sign_to_load: '使用钱包签名登录'
    },
    hi: {
      pg_history_sub: 'GROM पर स्वैप, स्पॉट, फ्यूचर्स, प्रेडिक्शन्स और स्टॉक्स।',
      hist_sum_pnl: '30d P&L', hist_sum_pnl_sub: 'ट्रेड से realized परिणाम',
      hist_sum_trades: 'ट्रेड', hist_sum_trades_sub: 'वर्तमान फ़िल्टर में',
      hist_sum_swaps: 'स्वैप', hist_sum_swaps_sub: 'On-chain एक्सचेंज',
      hist_all_activity: 'सारी गतिविधि',
      hist_f_all: 'सभी', hist_f_swap: 'स्वैप', hist_f_spot: 'स्पॉट', hist_f_fut: 'फ्यूचर्स', hist_f_predict: 'प्रेडिक्शन्स', hist_f_xstocks: 'स्टॉक्स',
      hist_export: 'CSV निर्यात',
      hist_empty: 'वॉलेट कनेक्ट करें और ट्रेड करें — इतिहास यहाँ दिखेगा।',
      hist_empty_activity: 'अभी कोई गतिविधि नहीं — स्वैप और ट्रेड यहाँ दिखेंगे।',
      ref_title: 'रेफ़रल प्रोग्राम', ref_tag: 'अभी सक्रिय नहीं',
      ref_invite_code: 'आपका कोड', ref_invite_link: 'आमंत्रण लिंक', ref_copy_link: 'लिंक कॉपी', ref_scan_join: 'जुड़ने के लिए स्कैन',
      ref_total_referred: 'कुल रेफ़र', ref_active_30d: 'सक्रिय (30d)', ref_total_earned: 'कुल कमाई', ref_pending_payout: 'लंबित भुगतान',
      ref_paid_daily: 'भुगतान अभी उपलब्ध नहीं हैं',
      ref_commission_status: 'कमीशन स्थिति', ref_status_live: 'अभी सक्रिय नहीं', ref_today_accrual: 'आज का accrual',
      ref_awaiting: 'ट्रैकिंग अभी सक्रिय नहीं है', ref_onchain_rebate: 'भुगतान अभी सक्रिय नहीं हैं',
      ref_pending_label: 'लंबित', ref_paid_onchain: 'लॉन्च के बाद भुगतान की घोषणा होगी',
      ref_your_referrals: 'आपके रेफ़रल', ref_last_10: 'अंतिम 10',
      ref_tbl_user: 'उपयोगकर्ता', ref_tbl_joined: 'शामिल', ref_tbl_volume_30d: 'वॉल्यूम 30d', ref_tbl_tier: 'स्तर', ref_tbl_earnings: 'आपकी कमाई',
      ref_empty_list: 'अभी कोई रेफ़रल नहीं — लिंक साझा करें',
      ref_connect_wallet_code: 'कोड के लिए वॉलेट कनेक्ट करें', ref_connect_wallet_link: 'लिंक के लिए वॉलेट कनेक्ट करें',
      ref_sign_for_code: 'कोड बनाने के लिए संदेश पर हस्ताक्षर करें', ref_sign_for_link: 'लिंक देखने के लिए संदेश पर हस्ताक्षर करें', ref_sign_to_load: 'वॉलेट से साइन इन करें'
    },
    tr: {
      pg_history_sub: "GROM'da swap, spot, vadeli, tahminler ve tokenleştirilmiş hisseler.",
      hist_sum_pnl: '30g K/Z', hist_sum_pnl_sub: 'İşlemlerden realize sonuç',
      hist_sum_trades: 'İşlem', hist_sum_trades_sub: 'Mevcut filtrede',
      hist_sum_swaps: 'Swap', hist_sum_swaps_sub: 'On-chain takaslar',
      hist_all_activity: 'Tüm aktivite',
      hist_f_all: 'Tümü', hist_f_swap: 'Swap', hist_f_spot: 'Spot', hist_f_fut: 'Vadeli', hist_f_predict: 'Tahminler', hist_f_xstocks: 'Hisseler',
      hist_export: 'CSV dışa aktar',
      hist_empty: 'Cüzdan bağla ve işlem yap — geçmiş burada görünür.',
      hist_empty_activity: 'Henüz aktivite yok — swap ve işlemler burada görünür.',
      ref_title: 'Referans programı', ref_tag: 'Etkin değil',
      ref_invite_code: 'Davet kodun', ref_invite_link: 'Davet linki', ref_copy_link: 'Linki kopyala', ref_scan_join: 'Katılmak için tara',
      ref_total_referred: 'Toplam davet', ref_active_30d: 'Aktif (30g)', ref_total_earned: 'Toplam kazanç', ref_pending_payout: 'Bekleyen ödeme',
      ref_paid_daily: 'Ödeme planı henüz etkin değil',
      ref_commission_status: 'Komisyon durumu', ref_status_live: 'Etkin değil', ref_today_accrual: 'Bugün biriken',
      ref_awaiting: 'Takip henüz etkin değil', ref_onchain_rebate: 'Ödemeler henüz etkin değil',
      ref_pending_label: 'Bekleyen', ref_paid_onchain: 'Ödeme bilgileri lansmanda duyurulacak',
      ref_your_referrals: 'Referansların', ref_last_10: 'son 10',
      ref_tbl_user: 'Kullanıcı', ref_tbl_joined: 'Katılım', ref_tbl_volume_30d: 'Hacim 30g', ref_tbl_tier: 'Seviye', ref_tbl_earnings: 'Kazancın',
      ref_empty_list: 'Henüz referans yok — linkini paylaş',
      ref_connect_wallet_code: 'Kod için cüzdan bağla', ref_connect_wallet_link: 'Link için cüzdan bağla',
      ref_sign_for_code: 'Kod oluşturmak için mesajı imzala', ref_sign_for_link: 'Bağlantıyı görmek için mesajı imzala', ref_sign_to_load: 'Cüzdanla giriş yap'
    }
    };
  ['es', 'ar', 'zh', 'hi', 'tr'].forEach(function (lng) {
    if (EXTRA[lng] && HIST_REF_UI[lng]) Object.assign(EXTRA[lng], HIST_REF_UI[lng]);
  });

  const REFERRAL_TRACKING = {
    es: {
      ref_title: 'Seguimiento de referidos', ref_tag: 'Solo seguimiento',
      ref_tracking_disclosure: 'Invita a tus amigos con tu enlace. Las nuevas billeteras se cuentan una vez; las recompensas y los pagos no están habilitados.',
      ref_how_title: 'Cómo funciona el seguimiento',
      ref_how_sub: 'Una billetera nueva se atribuye una sola vez al iniciar sesión desde tu enlace. Las cuentas existentes no se reasignan.',
      ref_step_1: 'Comparte tu enlace único.', ref_step_2: 'El primer registro de una billetera nueva se atribuye una vez.',
      ref_step_3: 'Se rechazan las autorreferencias. Las recompensas y los pagos no están habilitados.', ref_rewards_inactive: 'Recompensas inactivas',
      ref_total_invited_note: 'Cuentas atribuidas a tu código', ref_signups_30d: 'Nuevos registros (30d)',
      ref_signups_note: 'Creadas en los últimos 30 días', ref_active_30d: 'Vistas (30d)', ref_active_note: 'Última visita en los últimos 30 días'
    },
    ar: {
      ref_title: 'تتبع الإحالات', ref_tag: 'تتبع فقط',
      ref_tracking_disclosure: 'ادعُ أصدقاءك عبر رابطك. تُحتسب المحافظ الجديدة مرة واحدة؛ المكافآت والمدفوعات غير مفعّلة.',
      ref_how_title: 'كيف يعمل تتبع الدعوات',
      ref_how_sub: 'تُنسب المحفظة الجديدة مرة واحدة عند تسجيل الدخول عبر رابطك. لا يُعاد إسناد الحسابات الموجودة.',
      ref_step_1: 'شارك رابط الدعوة الخاص بك.', ref_step_2: 'يُنسب تسجيل المحفظة الجديدة مرة واحدة.',
      ref_step_3: 'يُرفض الإحالة الذاتية. المكافآت والمدفوعات غير مفعّلة.', ref_rewards_inactive: 'المكافآت غير مفعّلة',
      ref_total_invited_note: 'الحسابات المرتبطة برمزك', ref_signups_30d: 'تسجيلات جديدة (30 يومًا)',
      ref_signups_note: 'أُنشئت خلال آخر 30 يومًا', ref_active_30d: 'ظهرت (30 يومًا)', ref_active_note: 'آخر ظهور خلال آخر 30 يومًا'
    },
    zh: {
      ref_title: '邀请跟踪', ref_tag: '仅跟踪',
      ref_tracking_disclosure: '通过邀请链接邀请朋友。新钱包注册只计一次；奖励和付款尚未启用。',
      ref_how_title: '邀请跟踪方式',
      ref_how_sub: '新钱包首次通过链接登录时只归属一次，现有账户不会重新归属。',
      ref_step_1: '分享你的专属邀请链接。', ref_step_2: '新钱包首次注册时计入一次。',
      ref_step_3: '拒绝自我邀请。奖励和付款尚未启用。', ref_rewards_inactive: '奖励未启用',
      ref_total_invited_note: '归属于此邀请码的账户', ref_signups_30d: '近30天新增',
      ref_signups_note: '过去30天创建', ref_active_30d: '近30天出现', ref_active_note: '过去30天内最后登录'
    },
    hi: {
      ref_title: 'रेफ़रल ट्रैकिंग', ref_tag: 'केवल ट्रैकिंग',
      ref_tracking_disclosure: 'अपने लिंक से दोस्तों को आमंत्रित करें। नए वॉलेट एक बार गिने जाते हैं; पुरस्कार और भुगतान चालू नहीं हैं।',
      ref_how_title: 'आमंत्रण ट्रैकिंग कैसे काम करती है',
      ref_how_sub: 'नया वॉलेट पहली बार आपके लिंक से साइन इन करने पर एक बार जोड़ा जाता है। मौजूदा खाते दोबारा नहीं जोड़े जाते।',
      ref_step_1: 'अपना अनोखा लिंक साझा करें।', ref_step_2: 'नए वॉलेट का पहला साइनअप एक बार जोड़ा जाता है।',
      ref_step_3: 'सेल्फ-रेफ़रल अस्वीकार होते हैं। पुरस्कार और भुगतान चालू नहीं हैं।', ref_rewards_inactive: 'पुरस्कार निष्क्रिय',
      ref_total_invited_note: 'आपके कोड से जुड़े खाते', ref_signups_30d: 'नए साइनअप (30d)',
      ref_signups_note: 'पिछले 30 दिनों में बनाए गए', ref_active_30d: 'देखे गए (30d)', ref_active_note: 'पिछले 30 दिनों में अंतिम बार देखे गए'
    },
    tr: {
      ref_title: 'Davet takibi', ref_tag: 'Yalnızca takip',
      ref_tracking_disclosure: 'Bağlantınızla arkadaşlarınızı davet edin. Yeni cüzdan kayıtları bir kez sayılır; ödüller ve ödemeler etkin değildir.',
      ref_how_title: 'Davet takibi nasıl çalışır',
      ref_how_sub: 'Yeni bir cüzdan bağlantınızdan ilk kez giriş yaptığında bir kez ilişkilendirilir. Mevcut hesaplar yeniden atanmaz.',
      ref_step_1: 'Benzersiz davet bağlantınızı paylaşın.', ref_step_2: 'Yeni cüzdanın ilk kaydı bir kez ilişkilendirilir.',
      ref_step_3: 'Kendi kendine davet reddedilir. Ödüller ve ödemeler etkin değildir.', ref_rewards_inactive: 'Ödüller etkin değil',
      ref_total_invited_note: 'Kodunuza bağlanan hesaplar', ref_signups_30d: 'Yeni kayıt (30g)',
      ref_signups_note: 'Son 30 günde oluşturuldu', ref_active_30d: 'Görülen (30g)', ref_active_note: 'Son 30 gündeki son etkinlik'
    }
  };
  Object.keys(REFERRAL_TRACKING).forEach(function (lng) {
    if (EXTRA[lng]) Object.assign(EXTRA[lng], REFERRAL_TRACKING[lng]);
  });

  var LOCAL_SETTINGS_COPY = {
  "en": {
    "set_saved_local": "Saved in this browser",
    "set_save_failed": "Could not save in this browser",
    "set_local_note": "Display name is saved only in this browser.",
    "set_notif_unavailable": "Notification subscriptions are not available.",
    "notif_local_body": "Only notices received while this page is open appear here. See History for your transactions.",
    "pg_settings_sub": "Language and trading preferences are stored in this browser."
  },
  "ru": {
    "set_saved_local": "Сохранено в этом браузере",
    "set_save_failed": "Не удалось сохранить в этом браузере",
    "set_local_note": "Отображаемое имя сохраняется только в этом браузере.",
    "set_notif_unavailable": "Подписки на уведомления пока недоступны.",
    "notif_local_body": "Здесь видны уведомления, полученные при открытой странице. Операции смотрите в Истории.",
    "pg_settings_sub": "Язык и торговые настройки хранятся в этом браузере."
  },
  "es": {
    "set_saved_local": "Guardado en este navegador",
    "set_save_failed": "No se pudo guardar en este navegador",
    "set_local_note": "El nombre se guarda solo en este navegador.",
    "set_notif_unavailable": "Las suscripciones a notificaciones no están disponibles.",
    "notif_local_body": "Aquí solo aparecen avisos recibidos con esta página abierta. Consulta tus operaciones en Historial.",
    "pg_settings_sub": "El idioma y las preferencias de trading se guardan en este navegador."
  },
  "tr": {
    "set_saved_local": "Bu tarayıcıda kaydedildi",
    "set_save_failed": "Bu tarayıcıda kaydedilemedi",
    "set_local_note": "Görünen ad yalnızca bu tarayıcıda saklanır.",
    "set_notif_unavailable": "Bildirim abonelikleri henüz kullanılamıyor.",
    "notif_local_body": "Burada yalnızca bu sayfa açıkken alınan bildirimler görünür. İşlemler için Geçmiş bölümüne bakın.",
    "pg_settings_sub": "Dil ve işlem tercihleri bu tarayıcıda saklanır."
  },
  "ar": {
    "set_saved_local": "تم الحفظ في هذا المتصفح",
    "set_save_failed": "تعذّر الحفظ في هذا المتصفح",
    "set_local_note": "يُحفظ اسم العرض في هذا المتصفح فقط.",
    "set_notif_unavailable": "اشتراكات الإشعارات غير متاحة حالياً.",
    "notif_local_body": "تظهر هنا الإشعارات المستلمة أثناء فتح هذه الصفحة فقط. راجع السجل للاطلاع على معاملاتك.",
    "pg_settings_sub": "تُحفظ اللغة وتفضيلات التداول في هذا المتصفح."
  },
  "zh": {
    "set_saved_local": "已保存在此浏览器中",
    "set_save_failed": "无法保存在此浏览器中",
    "set_local_note": "显示名称仅保存在此浏览器中。",
    "set_notif_unavailable": "通知订阅暂不可用。",
    "notif_local_body": "这里只显示此页面打开时收到的通知。请在历史记录中查看交易。",
    "pg_settings_sub": "语言和交易偏好保存在此浏览器中。"
  },
  "hi": {
    "set_saved_local": "इस ब्राउज़र में सेव किया गया",
    "set_save_failed": "इस ब्राउज़र में सेव नहीं हो सका",
    "set_local_note": "डिस्प्ले नाम केवल इस ब्राउज़र में सेव होता है।",
    "set_notif_unavailable": "सूचना सदस्यताएँ अभी उपलब्ध नहीं हैं।",
    "notif_local_body": "यहाँ केवल इस पेज के खुले रहने पर मिली सूचनाएँ दिखती हैं। लेनदेन के लिए इतिहास देखें।",
    "pg_settings_sub": "भाषा और ट्रेडिंग प्राथमिकताएँ इस ब्राउज़र में सेव होती हैं।"
  }
};
  Object.keys(LOCAL_SETTINGS_COPY).forEach(function (lng) { Object.assign(EXTRA[lng], LOCAL_SETTINGS_COPY[lng]); });

  function syncSettingsLangSeg(lng) {
    var seg = document.getElementById('setLangSeg');
    if (!seg) return;
    seg.querySelectorAll('button[data-lng]').forEach(function (b) {
      b.classList.toggle('active', b.dataset.lng === lng);
      if (b.dataset.lng === 'ru') b.textContent = 'Русский';
      if (b.dataset.lng === 'en') b.textContent = 'English';
    });
    var ru = document.getElementById('langRu');
    if (ru) ru.textContent = 'Русский';
    var en = document.getElementById('langEn');
    if (en) en.textContent = 'English';
  }
  function refreshAuthLoginLabel() {
    try { if (localStorage.getItem('grom_jwt')) return; } catch (_) {}
    var el = document.getElementById('walletLabel');
    if (el && typeof window.t === 'function') el.textContent = window.t('auth_login');
  }


  /* Swap UI strings shown through gwUxText(ru, en) in grom-wallet.js, keyed by the
   * English text; RU comes from the call itself, EN is the key. */
  window.GROM_UX_TR = {"es":{"Active: ":"Activo: ","Awaiting signature":"Esperando firma","Balances are currently unavailable.":"Los saldos no están disponibles en este momento.","Bridge in progress":"Transferencia en curso","Bridge is delivering to the destination network.":"El puente está entregando en la red de destino.","Bridging":"En tránsito","Check balance and gas":"Revisa el saldo y el gas","Check the unresolved wallet request. A new swap is unavailable until its result is known.":"Revisa la solicitud pendiente en tu billetera. No podrás hacer otro swap hasta conocer su resultado.","Check wallet":"Revisa la billetera","Check wallet request":"Revisa la solicitud en la billetera","Choose a destination network. Timing depends on the route.":"Elige la red de destino. El tiempo depende de la ruta.","Choose a same-chain EVM pair for a limit.":"Para una orden límite elige un par EVM en la misma red.","Choose another token":"Elige otro token","Confirm in wallet":"Confirma en la billetera","Confirm sign-in in your wallet…":"Confirma el inicio de sesión en tu billetera…","Confirm the request in your wallet.":"Confirma la solicitud en tu billetera.","Confirmation rejected.":"Confirmación rechazada.","Confirmed":"Confirmado","Connect the wallet bound to this plan.":"Conecta la billetera vinculada a este plan.","Connect wallet":"Conectar billetera","Connect wallet, choose a pair and amount.":"Conecta la billetera y elige el par y la cantidad.","Could not load invite link. Try again.":"No se pudo cargar el enlace de invitación. Inténtalo de nuevo.","Create plan":"Crear plan","Cross-chain options":"Opciones entre redes","Cross-chain swap · Receive:":"Swap entre redes · Recibes:","Daily":"Diario","Depends on network":"Depende de la red","Enter a minimum rate.":"Introduce un tipo mínimo.","Enter amount":"Introduce la cantidad","Estimated time":"Tiempo estimado","Failed · review to retry":"Fallido · revisa para reintentar","Favorite: ":"Favorito: ","Favorites":"Favoritos","Filled":"Ejecutado","Finding route…":"Buscando ruta…","Full token list temporarily unavailable. ":"La lista completa de tokens no está disponible temporalmente. ","Funding gas…":"Cargando gas…","Gas · ":"Gas · ","Have you rejected or closed this wallet request, with no transaction sent?":"¿Has rechazado o cerrado esta solicitud sin enviar ninguna transacción?","Hourly":"Cada hora","Legacy plan · recreate":"Plan antiguo · vuelve a crearlo","Limit":"Límite","Limit plan":"Plan límite","Loading invite link…":"Cargando enlace de invitación…","Loading network tokens…":"Cargando tokens de la red…","Looking up this contract on every network…":"Buscando este contrato en todas las redes…","Minimum":"Mínimo","Minimum received":"Mínimo a recibir","More network tokens":"Más tokens de la red","My assets":"Mis activos","Network / route costs":"Costes de red / ruta","Network confirmation":"Confirmación de la red","Network: ":"Red: ","No assets here. Choose another network or Popular.":"No hay activos aquí. Elige otra red o Populares.","No fee-verified aggregator route — try another pair or network":"No hay una ruta lista — prueba otro par u otra red","No network found":"No se encontró ninguna red","No plans of this type yet.":"Aún no hay planes de este tipo.","Nothing matches: ":"Sin resultados: ","On selected network":"En la red seleccionada","Open wallet":"Abrir billetera","Order pair, amount or wallet changed.":"Cambió el par, la cantidad o la billetera de la orden.","Pair or amount changed. Review the plan again.":"Cambió el par o la cantidad. Revisa el plan de nuevo.","Partially completed":"Completado parcialmente","Partially updated":"Actualizado parcialmente","Pending":"Pendiente","Popular":"Populares","Preparing":"Preparando","Preparing route and checking balance. No request has been sent to the wallet yet.":"Preparando la ruta y comprobando el saldo. Aún no se ha enviado ninguna solicitud a la billetera.","Preparing swap…":"Preparando el swap…","Previous request · ":"Solicitud anterior · ","Previous swap unresolved":"Swap anterior sin resolver","Price pending":"Precio pendiente","Provided by route":"Lo indica la ruta","Ready for review":"Listo para revisar","Receipt confirmed by the network.":"La red confirmó la transacción.","Recent":"Recientes","Reconnect and swap":"Reconectar y hacer swap","Refresh route":"Actualizar ruta","Refunded":"Reembolsado","Remove plan":"Eliminar plan","Repeat":"Repetir","Request rejected":"Solicitud rechazada","Retry":"Reintentar","Review":"Revisar","Review and sign":"Revisa y firma","Route does not guarantee the limit price. Plan retained.":"La ruta no garantiza el precio límite. El plan se mantiene.","Route partially completed.":"La ruta se completó parcialmente.","Route preparation timed out before a wallet request was sent. Refresh the quote and try again.":"La preparación de la ruta tardó demasiado y no se envió ninguna solicitud a la billetera. Actualiza la cotización e inténtalo de nuevo.","Route refunded funds.":"La ruta devolvió los fondos.","Scheduled":"Programado","Search networks":"Buscar redes","Search tokens":"Buscar tokens","Sign in to view private statistics. Your invite link is already ready to share.":"Inicia sesión para ver las estadísticas privadas. Tu enlace de invitación ya está listo para compartir.","Sign-in declined. No transaction will be sent.":"Inicio de sesión rechazado. No se enviará ninguna transacción.","Signature declined":"Firma rechazada","Some networks did not respond. Known balances are retained; refresh to check the others.":"Algunas redes no respondieron. Se mantienen los saldos conocidos; actualiza para revisar el resto.","Some networks did not respond; known balances are retained.":"Algunas redes no respondieron; se mantienen los saldos conocidos.","Statistics are temporarily unavailable. Your invite link still works.":"Las estadísticas no están disponibles temporalmente. Tu enlace de invitación sigue funcionando.","Status unknown":"Estado desconocido","Submitted":"Enviado","Submitted · awaiting confirmation":"Enviado · esperando confirmación","Swap":"Intercambiar","Swap details":"Detalles del swap","Swap failed. Review error details.":"El swap falló. Revisa los detalles del error.","Swap in progress…":"Swap en curso…","Swap mode":"Modo de swap","Token approval submitted; waiting for network confirmation. The swap has not been sent yet.":"Aprobación del token enviada; esperando confirmación de la red. El swap aún no se ha enviado.","Token lists":"Listas de tokens","Transaction":"Transacción","Transaction found on-chain":"Transacción encontrada en la red","Updating other networks…":"Actualizando otras redes…","Uses the tokens and amount above. Keep this tab open; every swap needs wallet confirmation.":"Usa los tokens y la cantidad de arriba. Mantén esta pestaña abierta; cada swap necesita confirmación en la billetera.","View invite statistics":"Ver estadísticas de invitaciones","Wait for the current swap.":"Espera a que termine el swap actual.","Waiting for source-chain gas. The main swap has not been sent.":"Esperando gas en la red de origen. El swap principal aún no se ha enviado.","Watching":"Vigilando","Weekly":"Semanal","Works for a same-chain EVM pair. The fresh route minimum is verified before signing.":"Funciona con un par EVM en la misma red. El mínimo de la ruta actual se verifica antes de firmar.","Your invite link is ready to share.":"Tu enlace de invitación está listo para compartir.","Your wallet holds no token at this address.":"Tu billetera no tiene ningún token con esta dirección.","min":"min","sources responded":"fuentes respondieron","Unverified token — check the contract address":"Token no verificado: comprueba la dirección del contrato","unverified":"no verificado","On other networks":"En otras redes"},"ar":{"Active: ":"نشط: ","Awaiting signature":"بانتظار التوقيع","Balances are currently unavailable.":"الأرصدة غير متاحة حاليًا.","Bridge in progress":"التحويل قيد التنفيذ","Bridge is delivering to the destination network.":"يجري التسليم إلى الشبكة المستلِمة.","Bridging":"قيد التحويل","Check balance and gas":"تحقق من الرصيد والغاز","Check the unresolved wallet request. A new swap is unavailable until its result is known.":"تحقق من الطلب المعلّق في المحفظة. لا يمكن إجراء مبادلة جديدة حتى تُعرف نتيجته.","Check wallet":"تحقق من المحفظة","Check wallet request":"تحقق من طلب المحفظة","Choose a destination network. Timing depends on the route.":"اختر شبكة الاستلام. المدة تعتمد على المسار.","Choose a same-chain EVM pair for a limit.":"لأمر الحد اختر زوج EVM على الشبكة نفسها.","Choose another token":"اختر رمزًا آخر","Confirm in wallet":"أكّد في المحفظة","Confirm sign-in in your wallet…":"أكّد تسجيل الدخول في محفظتك…","Confirm the request in your wallet.":"أكّد الطلب في محفظتك.","Confirmation rejected.":"تم رفض التأكيد.","Confirmed":"تم التأكيد","Connect the wallet bound to this plan.":"اربط المحفظة المرتبطة بهذه الخطة.","Connect wallet":"ربط المحفظة","Connect wallet, choose a pair and amount.":"اربط المحفظة واختر الزوج والمبلغ.","Could not load invite link. Try again.":"تعذّر تحميل رابط الدعوة. حاول مرة أخرى.","Create plan":"إنشاء خطة","Cross-chain options":"خيارات بين الشبكات","Cross-chain swap · Receive:":"مبادلة بين الشبكات · تستلم:","Daily":"يوميًا","Depends on network":"يعتمد على الشبكة","Enter a minimum rate.":"أدخل حدًا أدنى للسعر.","Enter amount":"أدخل المبلغ","Estimated time":"الوقت المتوقع","Failed · review to retry":"فشل · راجع لإعادة المحاولة","Favorite: ":"المفضلة: ","Favorites":"المفضلة","Filled":"تم التنفيذ","Finding route…":"جارٍ البحث عن مسار…","Full token list temporarily unavailable. ":"قائمة الرموز الكاملة غير متاحة مؤقتًا. ","Funding gas…":"جارٍ تمويل الغاز…","Gas · ":"الغاز · ","Have you rejected or closed this wallet request, with no transaction sent?":"هل رفضت هذا الطلب أو أغلقته دون إرسال أي معاملة؟","Hourly":"كل ساعة","Legacy plan · recreate":"خطة قديمة · أعد إنشاءها","Limit":"حد","Limit plan":"خطة الحد","Loading invite link…":"جارٍ تحميل رابط الدعوة…","Loading network tokens…":"جارٍ تحميل رموز الشبكة…","Looking up this contract on every network…":"جارٍ البحث عن هذا العقد في كل الشبكات…","Minimum":"الحد الأدنى","Minimum received":"الحد الأدنى المستلم","More network tokens":"مزيد من رموز الشبكة","My assets":"أصولي","Network / route costs":"تكاليف الشبكة / المسار","Network confirmation":"تأكيد الشبكة","Network: ":"الشبكة: ","No assets here. Choose another network or Popular.":"لا توجد أصول هنا. اختر شبكة أخرى أو «الشائعة».","No fee-verified aggregator route — try another pair or network":"لا يوجد مسار جاهز — جرّب زوجًا أو شبكة أخرى","No network found":"لم يتم العثور على شبكة","No plans of this type yet.":"لا توجد خطط من هذا النوع بعد.","Nothing matches: ":"لا نتائج: ","On selected network":"على الشبكة المختارة","Open wallet":"فتح المحفظة","Order pair, amount or wallet changed.":"تغيّر زوج الأمر أو المبلغ أو المحفظة.","Pair or amount changed. Review the plan again.":"تغيّر الزوج أو المبلغ. راجع الخطة مرة أخرى.","Partially completed":"اكتمل جزئيًا","Partially updated":"تم التحديث جزئيًا","Pending":"قيد الانتظار","Popular":"الشائعة","Preparing":"جارٍ التحضير","Preparing route and checking balance. No request has been sent to the wallet yet.":"جارٍ تحضير المسار والتحقق من الرصيد. لم يُرسل أي طلب إلى المحفظة بعد.","Preparing swap…":"جارٍ تحضير المبادلة…","Previous request · ":"الطلب السابق · ","Previous swap unresolved":"مبادلة سابقة غير محسومة","Price pending":"السعر قيد التحديد","Provided by route":"يحدده المسار","Ready for review":"جاهز للمراجعة","Receipt confirmed by the network.":"أكّدت الشبكة المعاملة.","Recent":"الأخيرة","Reconnect and swap":"أعد الربط وبادِل","Refresh route":"تحديث المسار","Refunded":"تم الاسترداد","Remove plan":"حذف الخطة","Repeat":"تكرار","Request rejected":"تم رفض الطلب","Retry":"إعادة المحاولة","Review":"مراجعة","Review and sign":"راجع ووقّع","Route does not guarantee the limit price. Plan retained.":"المسار لا يضمن سعر الحد. تم الاحتفاظ بالخطة.","Route partially completed.":"اكتمل المسار جزئيًا.","Route preparation timed out before a wallet request was sent. Refresh the quote and try again.":"انتهت مهلة تحضير المسار قبل إرسال أي طلب إلى المحفظة. حدّث السعر وحاول مرة أخرى.","Route refunded funds.":"أعاد المسار الأموال.","Scheduled":"مجدول","Search networks":"ابحث عن شبكة","Search tokens":"ابحث عن رمز","Sign in to view private statistics. Your invite link is already ready to share.":"سجّل الدخول لعرض الإحصاءات الخاصة. رابط دعوتك جاهز للمشاركة.","Sign-in declined. No transaction will be sent.":"تم رفض تسجيل الدخول. لن تُرسل أي معاملة.","Signature declined":"تم رفض التوقيع","Some networks did not respond. Known balances are retained; refresh to check the others.":"بعض الشبكات لم تستجب. تم الاحتفاظ بالأرصدة المعروفة؛ حدّث للتحقق من الباقي.","Some networks did not respond; known balances are retained.":"بعض الشبكات لم تستجب؛ تم الاحتفاظ بالأرصدة المعروفة.","Statistics are temporarily unavailable. Your invite link still works.":"الإحصاءات غير متاحة مؤقتًا. رابط دعوتك ما زال يعمل.","Status unknown":"الحالة غير معروفة","Submitted":"تم الإرسال","Submitted · awaiting confirmation":"تم الإرسال · بانتظار التأكيد","Swap":"مبادلة","Swap details":"تفاصيل المبادلة","Swap failed. Review error details.":"فشلت المبادلة. راجع تفاصيل الخطأ.","Swap in progress…":"المبادلة جارية…","Swap mode":"وضع المبادلة","Token approval submitted; waiting for network confirmation. The swap has not been sent yet.":"تم إرسال موافقة الرمز؛ بانتظار تأكيد الشبكة. لم تُرسل المبادلة بعد.","Token lists":"قوائم الرموز","Transaction":"المعاملة","Transaction found on-chain":"تم العثور على المعاملة في الشبكة","Updating other networks…":"جارٍ تحديث الشبكات الأخرى…","Uses the tokens and amount above. Keep this tab open; every swap needs wallet confirmation.":"يستخدم الرموز والمبلغ أعلاه. أبقِ هذه الصفحة مفتوحة؛ كل مبادلة تحتاج تأكيدًا في المحفظة.","View invite statistics":"عرض إحصاءات الدعوات","Wait for the current swap.":"انتظر انتهاء المبادلة الحالية.","Waiting for source-chain gas. The main swap has not been sent.":"بانتظار الغاز في الشبكة المرسِلة. لم تُرسل المبادلة الرئيسية.","Watching":"قيد المراقبة","Weekly":"أسبوعيًا","Works for a same-chain EVM pair. The fresh route minimum is verified before signing.":"يعمل مع زوج EVM على الشبكة نفسها. يتم التحقق من الحد الأدنى للمسار الحالي قبل التوقيع.","Your invite link is ready to share.":"رابط دعوتك جاهز للمشاركة.","Your wallet holds no token at this address.":"لا تحتوي محفظتك على رمز بهذا العنوان.","min":"د","sources responded":"مصادر استجابت","Unverified token — check the contract address":"رمز غير موثّق — تحقّق من عنوان العقد","unverified":"غير موثّق","On other networks":"على شبكات أخرى"},"zh":{"Active: ":"进行中：","Awaiting signature":"等待签名","Balances are currently unavailable.":"余额暂时不可用。","Bridge in progress":"跨链转账进行中","Bridge is delivering to the destination network.":"跨链桥正在向目标网络交付。","Bridging":"跨链中","Check balance and gas":"检查余额和 Gas","Check the unresolved wallet request. A new swap is unavailable until its result is known.":"请检查钱包中未完成的请求。在其结果确定前无法发起新的兑换。","Check wallet":"检查钱包","Check wallet request":"检查钱包请求","Choose a destination network. Timing depends on the route.":"选择目标网络。用时取决于路由。","Choose a same-chain EVM pair for a limit.":"限价单请选择同一 EVM 网络内的交易对。","Choose another token":"选择其他代币","Confirm in wallet":"在钱包中确认","Confirm sign-in in your wallet…":"请在钱包中确认登录…","Confirm the request in your wallet.":"请在钱包中确认请求。","Confirmation rejected.":"确认已被拒绝。","Confirmed":"已确认","Connect the wallet bound to this plan.":"请连接与此计划绑定的钱包。","Connect wallet":"连接钱包","Connect wallet, choose a pair and amount.":"连接钱包，选择交易对和数量。","Could not load invite link. Try again.":"无法加载邀请链接，请重试。","Create plan":"创建计划","Cross-chain options":"跨链选项","Cross-chain swap · Receive:":"跨链兑换 · 收到：","Daily":"每天","Depends on network":"取决于网络","Enter a minimum rate.":"请输入最低汇率。","Enter amount":"输入数量","Estimated time":"预计时间","Failed · review to retry":"失败 · 检查后重试","Favorite: ":"收藏：","Favorites":"收藏","Filled":"已成交","Finding route…":"正在寻找路由…","Full token list temporarily unavailable. ":"完整代币列表暂时不可用。","Funding gas…":"正在补充 Gas…","Gas · ":"Gas · ","Have you rejected or closed this wallet request, with no transaction sent?":"你是否已拒绝或关闭此钱包请求，且未发送任何交易？","Hourly":"每小时","Legacy plan · recreate":"旧计划 · 请重新创建","Limit":"限价","Limit plan":"限价计划","Loading invite link…":"正在加载邀请链接…","Loading network tokens…":"正在加载网络代币…","Looking up this contract on every network…":"正在所有网络中查找此合约…","Minimum":"最低","Minimum received":"最少收到","More network tokens":"更多网络代币","My assets":"我的资产","Network / route costs":"网络 / 路由费用","Network confirmation":"网络确认","Network: ":"网络：","No assets here. Choose another network or Popular.":"这里没有资产。请选择其他网络或「热门」。","No fee-verified aggregator route — try another pair or network":"暂无可用路由 — 请尝试其他交易对或网络","No network found":"未找到网络","No plans of this type yet.":"暂无此类计划。","Nothing matches: ":"无匹配结果：","On selected network":"所选网络","Open wallet":"打开钱包","Order pair, amount or wallet changed.":"订单的交易对、数量或钱包已更改。","Pair or amount changed. Review the plan again.":"交易对或数量已更改，请重新检查计划。","Partially completed":"部分完成","Partially updated":"部分已更新","Pending":"待处理","Popular":"热门","Preparing":"准备中","Preparing route and checking balance. No request has been sent to the wallet yet.":"正在准备路由并检查余额。尚未向钱包发送任何请求。","Preparing swap…":"正在准备兑换…","Previous request · ":"上一个请求 · ","Previous swap unresolved":"上一笔兑换未完成","Price pending":"价格待定","Provided by route":"由路由提供","Ready for review":"待检查","Receipt confirmed by the network.":"网络已确认交易。","Recent":"最近","Reconnect and swap":"重新连接并兑换","Refresh route":"刷新路由","Refunded":"已退款","Remove plan":"删除计划","Repeat":"重复","Request rejected":"请求已被拒绝","Retry":"重试","Review":"检查","Review and sign":"检查并签名","Route does not guarantee the limit price. Plan retained.":"路由无法保证限价，计划已保留。","Route partially completed.":"路由部分完成。","Route preparation timed out before a wallet request was sent. Refresh the quote and try again.":"路由准备超时，未向钱包发送请求。请刷新报价后重试。","Route refunded funds.":"路由已退回资金。","Scheduled":"已排程","Search networks":"搜索网络","Search tokens":"搜索代币","Sign in to view private statistics. Your invite link is already ready to share.":"登录后可查看私人统计。你的邀请链接已可分享。","Sign-in declined. No transaction will be sent.":"登录已被拒绝，不会发送任何交易。","Signature declined":"签名已被拒绝","Some networks did not respond. Known balances are retained; refresh to check the others.":"部分网络未响应。已保留已知余额，刷新以检查其余网络。","Some networks did not respond; known balances are retained.":"部分网络未响应，已保留已知余额。","Statistics are temporarily unavailable. Your invite link still works.":"统计暂时不可用，你的邀请链接仍然有效。","Status unknown":"状态未知","Submitted":"已提交","Submitted · awaiting confirmation":"已提交 · 等待确认","Swap":"兑换","Swap details":"兑换详情","Swap failed. Review error details.":"兑换失败，请查看错误详情。","Swap in progress…":"兑换进行中…","Swap mode":"兑换模式","Token approval submitted; waiting for network confirmation. The swap has not been sent yet.":"代币授权已提交，等待网络确认。兑换尚未发送。","Token lists":"代币列表","Transaction":"交易","Transaction found on-chain":"已在链上找到交易","Updating other networks…":"正在更新其他网络…","Uses the tokens and amount above. Keep this tab open; every swap needs wallet confirmation.":"使用上方的代币和数量。请保持此页面打开，每笔兑换都需要在钱包中确认。","View invite statistics":"查看邀请统计","Wait for the current swap.":"请等待当前兑换完成。","Waiting for source-chain gas. The main swap has not been sent.":"正在等待源网络的 Gas。主兑换尚未发送。","Watching":"监控中","Weekly":"每周","Works for a same-chain EVM pair. The fresh route minimum is verified before signing.":"适用于同一 EVM 网络内的交易对。签名前会校验最新路由的最低值。","Your invite link is ready to share.":"你的邀请链接已可分享。","Your wallet holds no token at this address.":"你的钱包中没有此地址的代币。","min":"分钟","sources responded":"个来源已响应","Unverified token — check the contract address":"未验证的代币 — 请核对合约地址","unverified":"未验证","On other networks":"其他网络"},"hi":{"Active: ":"सक्रिय: ","Awaiting signature":"हस्ताक्षर की प्रतीक्षा","Balances are currently unavailable.":"बैलेंस अभी उपलब्ध नहीं हैं।","Bridge in progress":"ब्रिज जारी है","Bridge is delivering to the destination network.":"ब्रिज गंतव्य नेटवर्क पर पहुँचा रहा है।","Bridging":"ब्रिज हो रहा है","Check balance and gas":"बैलेंस और गैस जाँचें","Check the unresolved wallet request. A new swap is unavailable until its result is known.":"वॉलेट में लंबित अनुरोध जाँचें। उसका परिणाम पता चलने तक नया स्वैप उपलब्ध नहीं है।","Check wallet":"वॉलेट जाँचें","Check wallet request":"वॉलेट अनुरोध जाँचें","Choose a destination network. Timing depends on the route.":"गंतव्य नेटवर्क चुनें। समय रूट पर निर्भर करता है।","Choose a same-chain EVM pair for a limit.":"लिमिट के लिए एक ही नेटवर्क की EVM जोड़ी चुनें।","Choose another token":"दूसरा टोकन चुनें","Confirm in wallet":"वॉलेट में पुष्टि करें","Confirm sign-in in your wallet…":"अपने वॉलेट में साइन-इन की पुष्टि करें…","Confirm the request in your wallet.":"अपने वॉलेट में अनुरोध की पुष्टि करें।","Confirmation rejected.":"पुष्टि अस्वीकार की गई।","Confirmed":"पुष्टि हुई","Connect the wallet bound to this plan.":"इस योजना से जुड़ा वॉलेट कनेक्ट करें।","Connect wallet":"वॉलेट कनेक्ट करें","Connect wallet, choose a pair and amount.":"वॉलेट कनेक्ट करें, जोड़ी और राशि चुनें।","Could not load invite link. Try again.":"आमंत्रण लिंक लोड नहीं हुआ। फिर से कोशिश करें।","Create plan":"योजना बनाएँ","Cross-chain options":"क्रॉस-चेन विकल्प","Cross-chain swap · Receive:":"क्रॉस-चेन स्वैप · मिलेगा:","Daily":"रोज़ाना","Depends on network":"नेटवर्क पर निर्भर","Enter a minimum rate.":"न्यूनतम दर दर्ज करें।","Enter amount":"राशि दर्ज करें","Estimated time":"अनुमानित समय","Failed · review to retry":"विफल · दोबारा कोशिश के लिए जाँचें","Favorite: ":"पसंदीदा: ","Favorites":"पसंदीदा","Filled":"पूरा हुआ","Finding route…":"रूट खोजा जा रहा है…","Full token list temporarily unavailable. ":"पूरी टोकन सूची अस्थायी रूप से उपलब्ध नहीं है। ","Funding gas…":"गैस भरी जा रही है…","Gas · ":"गैस · ","Have you rejected or closed this wallet request, with no transaction sent?":"क्या आपने यह वॉलेट अनुरोध बिना कोई लेनदेन भेजे अस्वीकार या बंद किया?","Hourly":"हर घंटे","Legacy plan · recreate":"पुरानी योजना · फिर से बनाएँ","Limit":"लिमिट","Limit plan":"लिमिट योजना","Loading invite link…":"आमंत्रण लिंक लोड हो रहा है…","Loading network tokens…":"नेटवर्क टोकन लोड हो रहे हैं…","Looking up this contract on every network…":"यह कॉन्ट्रैक्ट सभी नेटवर्क पर खोजा जा रहा है…","Minimum":"न्यूनतम","Minimum received":"न्यूनतम प्राप्त","More network tokens":"नेटवर्क के और टोकन","My assets":"मेरी संपत्तियाँ","Network / route costs":"नेटवर्क / रूट लागत","Network confirmation":"नेटवर्क पुष्टि","Network: ":"नेटवर्क: ","No assets here. Choose another network or Popular.":"यहाँ कोई संपत्ति नहीं। दूसरा नेटवर्क या लोकप्रिय चुनें।","No fee-verified aggregator route — try another pair or network":"कोई तैयार रूट नहीं — दूसरी जोड़ी या नेटवर्क आज़माएँ","No network found":"कोई नेटवर्क नहीं मिला","No plans of this type yet.":"इस प्रकार की कोई योजना अभी नहीं है।","Nothing matches: ":"कोई मेल नहीं: ","On selected network":"चुने गए नेटवर्क पर","Open wallet":"वॉलेट खोलें","Order pair, amount or wallet changed.":"ऑर्डर की जोड़ी, राशि या वॉलेट बदल गया।","Pair or amount changed. Review the plan again.":"जोड़ी या राशि बदल गई। योजना फिर से जाँचें।","Partially completed":"आंशिक रूप से पूरा","Partially updated":"आंशिक रूप से अपडेट","Pending":"लंबित","Popular":"लोकप्रिय","Preparing":"तैयारी","Preparing route and checking balance. No request has been sent to the wallet yet.":"रूट तैयार हो रहा है और बैलेंस जाँचा जा रहा है। वॉलेट को अभी कोई अनुरोध नहीं भेजा गया।","Preparing swap…":"स्वैप तैयार हो रहा है…","Previous request · ":"पिछला अनुरोध · ","Previous swap unresolved":"पिछला स्वैप अनसुलझा है","Price pending":"कीमत लंबित","Provided by route":"रूट द्वारा दिया गया","Ready for review":"जाँच के लिए तैयार","Receipt confirmed by the network.":"नेटवर्क ने लेनदेन की पुष्टि की।","Recent":"हाल के","Reconnect and swap":"फिर से कनेक्ट करें और स्वैप करें","Refresh route":"रूट रीफ़्रेश करें","Refunded":"धनवापसी हुई","Remove plan":"योजना हटाएँ","Repeat":"दोहराएँ","Request rejected":"अनुरोध अस्वीकार हुआ","Retry":"फिर कोशिश करें","Review":"जाँचें","Review and sign":"जाँचें और हस्ताक्षर करें","Route does not guarantee the limit price. Plan retained.":"रूट लिमिट कीमत की गारंटी नहीं देता। योजना बनी रहेगी।","Route partially completed.":"रूट आंशिक रूप से पूरा हुआ।","Route preparation timed out before a wallet request was sent. Refresh the quote and try again.":"वॉलेट अनुरोध भेजने से पहले रूट की तैयारी का समय खत्म हो गया। कोट रीफ़्रेश करके फिर कोशिश करें।","Route refunded funds.":"रूट ने धनवापसी कर दी।","Scheduled":"निर्धारित","Search networks":"नेटवर्क खोजें","Search tokens":"टोकन खोजें","Sign in to view private statistics. Your invite link is already ready to share.":"निजी आँकड़े देखने के लिए साइन इन करें। आपका आमंत्रण लिंक शेयर करने के लिए तैयार है।","Sign-in declined. No transaction will be sent.":"साइन-इन अस्वीकार हुआ। कोई लेनदेन नहीं भेजा जाएगा।","Signature declined":"हस्ताक्षर अस्वीकार हुआ","Some networks did not respond. Known balances are retained; refresh to check the others.":"कुछ नेटवर्क ने जवाब नहीं दिया। ज्ञात बैलेंस रखे गए हैं; बाकी जाँचने के लिए रीफ़्रेश करें।","Some networks did not respond; known balances are retained.":"कुछ नेटवर्क ने जवाब नहीं दिया; ज्ञात बैलेंस रखे गए हैं।","Statistics are temporarily unavailable. Your invite link still works.":"आँकड़े अस्थायी रूप से उपलब्ध नहीं हैं। आपका आमंत्रण लिंक काम कर रहा है।","Status unknown":"स्थिति अज्ञात","Submitted":"भेजा गया","Submitted · awaiting confirmation":"भेजा गया · पुष्टि की प्रतीक्षा","Swap":"स्वैप","Swap details":"स्वैप विवरण","Swap failed. Review error details.":"स्वैप विफल हुआ। त्रुटि का विवरण देखें।","Swap in progress…":"स्वैप जारी है…","Swap mode":"स्वैप मोड","Token approval submitted; waiting for network confirmation. The swap has not been sent yet.":"टोकन अनुमति भेजी गई; नेटवर्क पुष्टि की प्रतीक्षा। स्वैप अभी नहीं भेजा गया।","Token lists":"टोकन सूचियाँ","Transaction":"लेनदेन","Transaction found on-chain":"लेनदेन नेटवर्क पर मिला","Updating other networks…":"अन्य नेटवर्क अपडेट हो रहे हैं…","Uses the tokens and amount above. Keep this tab open; every swap needs wallet confirmation.":"ऊपर दिए टोकन और राशि का उपयोग होता है। यह टैब खुला रखें; हर स्वैप के लिए वॉलेट पुष्टि चाहिए।","View invite statistics":"आमंत्रण आँकड़े देखें","Wait for the current swap.":"मौजूदा स्वैप पूरा होने तक प्रतीक्षा करें।","Waiting for source-chain gas. The main swap has not been sent.":"स्रोत नेटवर्क पर गैस की प्रतीक्षा। मुख्य स्वैप अभी नहीं भेजा गया।","Watching":"निगरानी में","Weekly":"साप्ताहिक","Works for a same-chain EVM pair. The fresh route minimum is verified before signing.":"एक ही नेटवर्क की EVM जोड़ी के लिए। हस्ताक्षर से पहले ताज़ा रूट का न्यूनतम जाँचा जाता है।","Your invite link is ready to share.":"आपका आमंत्रण लिंक शेयर करने के लिए तैयार है।","Your wallet holds no token at this address.":"आपके वॉलेट में इस पते का कोई टोकन नहीं है।","min":"मिनट","sources responded":"स्रोतों ने जवाब दिया","Unverified token — check the contract address":"असत्यापित टोकन — कॉन्ट्रैक्ट पता जाँचें","unverified":"असत्यापित","On other networks":"अन्य नेटवर्क पर"},"tr":{"Active: ":"Aktif: ","Awaiting signature":"İmza bekleniyor","Balances are currently unavailable.":"Bakiyeler şu anda kullanılamıyor.","Bridge in progress":"Köprü işlemi sürüyor","Bridge is delivering to the destination network.":"Köprü, hedef ağa teslim ediyor.","Bridging":"Köprüleniyor","Check balance and gas":"Bakiyeyi ve gas'ı kontrol edin","Check the unresolved wallet request. A new swap is unavailable until its result is known.":"Cüzdandaki bekleyen isteği kontrol edin. Sonucu belli olana kadar yeni takas yapılamaz.","Check wallet":"Cüzdanı kontrol et","Check wallet request":"Cüzdan isteğini kontrol et","Choose a destination network. Timing depends on the route.":"Hedef ağı seçin. Süre rotaya bağlıdır.","Choose a same-chain EVM pair for a limit.":"Limit için aynı ağda bir EVM çifti seçin.","Choose another token":"Başka bir token seçin","Confirm in wallet":"Cüzdanda onaylayın","Confirm sign-in in your wallet…":"Cüzdanınızda girişi onaylayın…","Confirm the request in your wallet.":"Cüzdanınızda isteği onaylayın.","Confirmation rejected.":"Onay reddedildi.","Confirmed":"Onaylandı","Connect the wallet bound to this plan.":"Bu plana bağlı cüzdanı bağlayın.","Connect wallet":"Cüzdan bağla","Connect wallet, choose a pair and amount.":"Cüzdanı bağlayın, çift ve miktar seçin.","Could not load invite link. Try again.":"Davet bağlantısı yüklenemedi. Tekrar deneyin.","Create plan":"Plan oluştur","Cross-chain options":"Ağlar arası seçenekler","Cross-chain swap · Receive:":"Ağlar arası takas · Alacağınız:","Daily":"Günlük","Depends on network":"Ağa bağlı","Enter a minimum rate.":"Minimum kur girin.","Enter amount":"Miktar girin","Estimated time":"Tahmini süre","Failed · review to retry":"Başarısız · tekrar için inceleyin","Favorite: ":"Favori: ","Favorites":"Favoriler","Filled":"Gerçekleşti","Finding route…":"Rota aranıyor…","Full token list temporarily unavailable. ":"Tam token listesi geçici olarak kullanılamıyor. ","Funding gas…":"Gas yükleniyor…","Gas · ":"Gas · ","Have you rejected or closed this wallet request, with no transaction sent?":"Bu cüzdan isteğini hiçbir işlem göndermeden reddettiniz veya kapattınız mı?","Hourly":"Saatlik","Legacy plan · recreate":"Eski plan · yeniden oluşturun","Limit":"Limit","Limit plan":"Limit planı","Loading invite link…":"Davet bağlantısı yükleniyor…","Loading network tokens…":"Ağ tokenları yükleniyor…","Looking up this contract on every network…":"Bu sözleşme tüm ağlarda aranıyor…","Minimum":"Minimum","Minimum received":"Minimum alınacak","More network tokens":"Ağdaki diğer tokenlar","My assets":"Varlıklarım","Network / route costs":"Ağ / rota maliyeti","Network confirmation":"Ağ onayı","Network: ":"Ağ: ","No assets here. Choose another network or Popular.":"Burada varlık yok. Başka bir ağ veya Popüler'i seçin.","No fee-verified aggregator route — try another pair or network":"Hazır rota yok — başka bir çift veya ağ deneyin","No network found":"Ağ bulunamadı","No plans of this type yet.":"Bu türde henüz plan yok.","Nothing matches: ":"Eşleşme yok: ","On selected network":"Seçili ağda","Open wallet":"Cüzdanı aç","Order pair, amount or wallet changed.":"Emrin çifti, miktarı veya cüzdanı değişti.","Pair or amount changed. Review the plan again.":"Çift veya miktar değişti. Planı yeniden inceleyin.","Partially completed":"Kısmen tamamlandı","Partially updated":"Kısmen güncellendi","Pending":"Bekliyor","Popular":"Popüler","Preparing":"Hazırlanıyor","Preparing route and checking balance. No request has been sent to the wallet yet.":"Rota hazırlanıyor ve bakiye kontrol ediliyor. Cüzdana henüz istek gönderilmedi.","Preparing swap…":"Takas hazırlanıyor…","Previous request · ":"Önceki istek · ","Previous swap unresolved":"Önceki takas sonuçlanmadı","Price pending":"Fiyat bekleniyor","Provided by route":"Rota tarafından verilir","Ready for review":"İncelemeye hazır","Receipt confirmed by the network.":"Ağ işlemi onayladı.","Recent":"Son kullanılan","Reconnect and swap":"Yeniden bağlan ve takas et","Refresh route":"Rotayı yenile","Refunded":"İade edildi","Remove plan":"Planı kaldır","Repeat":"Tekrarla","Request rejected":"İstek reddedildi","Retry":"Tekrar dene","Review":"İncele","Review and sign":"İncele ve imzala","Route does not guarantee the limit price. Plan retained.":"Rota limit fiyatı garanti etmiyor. Plan korundu.","Route partially completed.":"Rota kısmen tamamlandı.","Route preparation timed out before a wallet request was sent. Refresh the quote and try again.":"Rota hazırlığı cüzdana istek gönderilmeden zaman aşımına uğradı. Teklifi yenileyip tekrar deneyin.","Route refunded funds.":"Rota fonları iade etti.","Scheduled":"Planlandı","Search networks":"Ağ ara","Search tokens":"Token ara","Sign in to view private statistics. Your invite link is already ready to share.":"Özel istatistikleri görmek için giriş yapın. Davet bağlantınız paylaşıma hazır.","Sign-in declined. No transaction will be sent.":"Giriş reddedildi. Hiçbir işlem gönderilmeyecek.","Signature declined":"İmza reddedildi","Some networks did not respond. Known balances are retained; refresh to check the others.":"Bazı ağlar yanıt vermedi. Bilinen bakiyeler korunuyor; diğerleri için yenileyin.","Some networks did not respond; known balances are retained.":"Bazı ağlar yanıt vermedi; bilinen bakiyeler korunuyor.","Statistics are temporarily unavailable. Your invite link still works.":"İstatistikler geçici olarak kullanılamıyor. Davet bağlantınız hâlâ çalışıyor.","Status unknown":"Durum bilinmiyor","Submitted":"Gönderildi","Submitted · awaiting confirmation":"Gönderildi · onay bekleniyor","Swap":"Takas","Swap details":"Takas ayrıntıları","Swap failed. Review error details.":"Takas başarısız. Hata ayrıntılarını inceleyin.","Swap in progress…":"Takas sürüyor…","Swap mode":"Takas modu","Token approval submitted; waiting for network confirmation. The swap has not been sent yet.":"Token onayı gönderildi; ağ onayı bekleniyor. Takas henüz gönderilmedi.","Token lists":"Token listeleri","Transaction":"İşlem","Transaction found on-chain":"İşlem ağda bulundu","Updating other networks…":"Diğer ağlar güncelleniyor…","Uses the tokens and amount above. Keep this tab open; every swap needs wallet confirmation.":"Yukarıdaki token ve miktarı kullanır. Bu sekmeyi açık tutun; her takas cüzdan onayı gerektirir.","View invite statistics":"Davet istatistiklerini gör","Wait for the current swap.":"Mevcut takasın bitmesini bekleyin.","Waiting for source-chain gas. The main swap has not been sent.":"Kaynak ağda gas bekleniyor. Ana takas henüz gönderilmedi.","Watching":"İzleniyor","Weekly":"Haftalık","Works for a same-chain EVM pair. The fresh route minimum is verified before signing.":"Aynı ağdaki EVM çifti için çalışır. İmzadan önce güncel rota minimumu doğrulanır.","Your invite link is ready to share.":"Davet bağlantınız paylaşıma hazır.","Your wallet holds no token at this address.":"Cüzdanınızda bu adreste token yok.","min":"dk","sources responded":"kaynak yanıt verdi","Unverified token — check the contract address":"Doğrulanmamış token — sözleşme adresini kontrol edin","unverified":"doğrulanmamış","On other networks":"Diğer ağlarda"}};
  /* Swap notices with values ({amt}, {from}, {to}, {chain}…) — used via gwTx(key, vars). */
  EXTRA.ru.swap_toast_bridge_sent = "Отправлено: {amt} {from} → {to}. Ждём зачисления в сети получения, обычно 1–2 мин.";
  EXTRA.en.swap_toast_bridge_sent = "Sent {amt} {from} → {to}. Waiting for delivery on the destination network, usually 1–2 min.";
  EXTRA.es.swap_toast_bridge_sent = "Enviado {amt} {from} → {to}. Esperando la entrega en la red de destino, normalmente 1–2 min.";
  EXTRA.ar.swap_toast_bridge_sent = "تم إرسال {amt} {from} → {to}. بانتظار الوصول إلى الشبكة المستلِمة، عادةً خلال 1–2 دقيقة.";
  EXTRA.zh.swap_toast_bridge_sent = "已发送 {amt} {from} → {to}。正在等待目标网络到账，通常需要 1–2 分钟。";
  EXTRA.hi.swap_toast_bridge_sent = "{amt} {from} → {to} भेजा गया। गंतव्य नेटवर्क पर पहुँचने की प्रतीक्षा, आमतौर पर 1–2 मिनट।";
  EXTRA.tr.swap_toast_bridge_sent = "{amt} {from} → {to} gönderildi. Hedef ağa teslim bekleniyor, genellikle 1–2 dk.";
  EXTRA.ru.swap_toast_submitted = "Отправлено · ждём подтверждения сети…";
  EXTRA.en.swap_toast_submitted = "Submitted · waiting for confirmation…";
  EXTRA.es.swap_toast_submitted = "Enviado · esperando confirmación…";
  EXTRA.ar.swap_toast_submitted = "تم الإرسال · بانتظار التأكيد…";
  EXTRA.zh.swap_toast_submitted = "已提交 · 等待确认…";
  EXTRA.hi.swap_toast_submitted = "भेजा गया · पुष्टि की प्रतीक्षा…";
  EXTRA.tr.swap_toast_submitted = "Gönderildi · onay bekleniyor…";
  EXTRA.ru.swap_toast_submitted_bridge = "Отправлено · ждём зачисления в сети получения";
  EXTRA.en.swap_toast_submitted_bridge = "Submitted · delivery to the destination network is pending";
  EXTRA.es.swap_toast_submitted_bridge = "Enviado · entrega pendiente en la red de destino";
  EXTRA.ar.swap_toast_submitted_bridge = "تم الإرسال · الوصول إلى الشبكة المستلِمة قيد الانتظار";
  EXTRA.zh.swap_toast_submitted_bridge = "已提交 · 等待目标网络到账";
  EXTRA.hi.swap_toast_submitted_bridge = "भेजा गया · गंतव्य नेटवर्क पर पहुँचना बाकी है";
  EXTRA.tr.swap_toast_submitted_bridge = "Gönderildi · hedef ağa teslim bekleniyor";
  EXTRA.ru.swap_toast_bridge_done = "Готово: средства зачислены";
  EXTRA.en.swap_toast_bridge_done = "Bridge complete";
  EXTRA.es.swap_toast_bridge_done = "Listo: fondos recibidos";
  EXTRA.ar.swap_toast_bridge_done = "تم: وصلت الأموال";
  EXTRA.zh.swap_toast_bridge_done = "完成：资金已到账";
  EXTRA.hi.swap_toast_bridge_done = "पूरा: राशि जमा हो गई";
  EXTRA.tr.swap_toast_bridge_done = "Tamamlandı: fonlar ulaştı";
  EXTRA.ru.swap_no_liq_chain = "Сейчас нет ликвидности {from} → {to} в сети {chain}. Выберите другой токен для получения или другую сеть.";
  EXTRA.en.swap_no_liq_chain = "No liquidity for {from} → {to} on {chain} right now. Pick another receive token or network.";
  EXTRA.es.swap_no_liq_chain = "Ahora no hay liquidez para {from} → {to} en {chain}. Elige otro token a recibir u otra red.";
  EXTRA.ar.swap_no_liq_chain = "لا توجد سيولة لـ {from} → {to} على {chain} حاليًا. اختر رمزًا آخر للاستلام أو شبكة أخرى.";
  EXTRA.zh.swap_no_liq_chain = "{chain} 上暂时没有 {from} → {to} 的流动性。请选择其他接收代币或网络。";
  EXTRA.hi.swap_no_liq_chain = "{chain} पर अभी {from} → {to} के लिए लिक्विडिटी नहीं है। प्राप्ति के लिए दूसरा टोकन या नेटवर्क चुनें।";
  EXTRA.tr.swap_no_liq_chain = "{chain} ağında şu an {from} → {to} için likidite yok. Başka bir alınacak token veya ağ seçin.";
  EXTRA.ru.swap_no_route_pair = "Сейчас нет маршрута {from} ({a}) → {to} ({b}). Попробуйте другую сумму, другой токен для получения или оплату в USDC/ETH.";
  EXTRA.en.swap_no_route_pair = "No route {from} ({a}) → {to} ({b}) right now. Try another amount, another receive token, or pay with USDC/ETH.";
  EXTRA.es.swap_no_route_pair = "Ahora no hay ruta {from} ({a}) → {to} ({b}). Prueba otra cantidad, otro token a recibir o paga con USDC/ETH.";
  EXTRA.ar.swap_no_route_pair = "لا يوجد مسار {from} ({a}) → {to} ({b}) حاليًا. جرّب مبلغًا آخر أو رمز استلام آخر أو الدفع بـ USDC/ETH.";
  EXTRA.zh.swap_no_route_pair = "暂无 {from}（{a}）→ {to}（{b}）的路由。请尝试其他数量、其他接收代币，或用 USDC/ETH 支付。";
  EXTRA.hi.swap_no_route_pair = "अभी {from} ({a}) → {to} ({b}) का कोई रूट नहीं है। दूसरी राशि, दूसरा प्राप्ति टोकन या USDC/ETH से भुगतान आज़माएँ।";
  EXTRA.tr.swap_no_route_pair = "Şu an {from} ({a}) → {to} ({b}) rotası yok. Başka bir miktar, başka bir alınacak token deneyin veya USDC/ETH ile ödeyin.";
  EXTRA.ru.swap_hint_no_liq = "Сейчас нет ликвидности для {sym} в сети {chain}. Попробуйте другую сумму, оплату в USDT/USDC или другую сеть.";
  EXTRA.en.swap_hint_no_liq = "No live route for {sym} on {chain} right now. Try another amount, USDT/USDC, or another network.";
  EXTRA.es.swap_hint_no_liq = "Ahora no hay ruta para {sym} en {chain}. Prueba otra cantidad, USDT/USDC u otra red.";
  EXTRA.ar.swap_hint_no_liq = "لا يوجد مسار لـ {sym} على {chain} حاليًا. جرّب مبلغًا آخر أو USDT/USDC أو شبكة أخرى.";
  EXTRA.zh.swap_hint_no_liq = "{chain} 上暂时没有 {sym} 的路由。请尝试其他数量、USDT/USDC 或其他网络。";
  EXTRA.hi.swap_hint_no_liq = "{chain} पर अभी {sym} का कोई रूट नहीं है। दूसरी राशि, USDT/USDC या दूसरा नेटवर्क आज़माएँ।";
  EXTRA.tr.swap_hint_no_liq = "{chain} ağında şu an {sym} için rota yok. Başka bir miktar, USDT/USDC veya başka bir ağ deneyin.";
  EXTRA.ru.swap_hint_not_on = "{sym} нет в сети {chain}. Выберите другую сеть или другой токен.";
  EXTRA.en.swap_hint_not_on = "{sym} is not available on {chain}. Switch network above, or pick another token.";
  EXTRA.es.swap_hint_not_on = "{sym} no está disponible en {chain}. Cambia de red o elige otro token.";
  EXTRA.ar.swap_hint_not_on = "{sym} غير متاح على {chain}. غيّر الشبكة أو اختر رمزًا آخر.";
  EXTRA.zh.swap_hint_not_on = "{chain} 上没有 {sym}。请切换网络或选择其他代币。";
  EXTRA.hi.swap_hint_not_on = "{chain} पर {sym} उपलब्ध नहीं है। नेटवर्क बदलें या दूसरा टोकन चुनें।";
  EXTRA.tr.swap_hint_not_on = "{sym}, {chain} ağında yok. Ağı değiştirin veya başka bir token seçin.";
  EXTRA.ru.swap_hint_available = "{sym} нет в сети {chain}. Есть в: {list}. Переключите сеть и повторите.";
  EXTRA.en.swap_hint_available = "{sym} is not on {chain}. Available on: {list}. Switch network above, then retry.";
  EXTRA.es.swap_hint_available = "{sym} no está en {chain}. Disponible en: {list}. Cambia de red e inténtalo de nuevo.";
  EXTRA.ar.swap_hint_available = "{sym} غير موجود على {chain}. متاح على: {list}. غيّر الشبكة ثم أعد المحاولة.";
  EXTRA.zh.swap_hint_available = "{chain} 上没有 {sym}。可用网络：{list}。请切换网络后重试。";
  EXTRA.hi.swap_hint_available = "{chain} पर {sym} नहीं है। उपलब्ध: {list}। नेटवर्क बदलकर फिर कोशिश करें।";
  EXTRA.tr.swap_hint_available = "{sym}, {chain} ağında yok. Mevcut olduğu ağlar: {list}. Ağı değiştirip tekrar deneyin.";
  EXTRA.ru.tk_search_count = "Поиск среди {n} токенов";
  EXTRA.en.tk_search_count = "Search {n} tokens";
  EXTRA.es.tk_search_count = "Buscar entre {n} tokens";
  EXTRA.ar.tk_search_count = "ابحث بين {n} رمز";
  EXTRA.zh.tk_search_count = "在 {n} 个代币中搜索";
  EXTRA.hi.tk_search_count = "{n} टोकन में खोजें";
  EXTRA.tr.tk_search_count = "{n} token içinde ara";
  EXTRA.ru.tk_search_other_none = "{sym} нет в сети {chain} — нашли в других сетях";
  EXTRA.en.tk_search_other_none = "{sym} is not on {chain} — found on other networks";
  EXTRA.es.tk_search_other_none = "{sym} no está en {chain}: lo encontramos en otras redes";
  EXTRA.ar.tk_search_other_none = "{sym} غير موجود على {chain} — وجدناه على شبكات أخرى";
  EXTRA.zh.tk_search_other_none = "{chain} 上没有 {sym} — 已在其他网络找到";
  EXTRA.hi.tk_search_other_none = "{chain} पर {sym} नहीं है — अन्य नेटवर्क पर मिला";
  EXTRA.tr.tk_search_other_none = "{sym}, {chain} ağında yok — diğer ağlarda bulundu";

  
// Swap/wallet toasts: English source → all site languages (gwToast localizes at display time)
window.GROM_TOAST_TR = {"exact": {"Approved ✓": {"ru": "Разрешение подтверждено ✓", "es": "Aprobado ✓", "ar": "تمت الموافقة ✓", "zh": "已授权 ✓", "hi": "स्वीकृत ✓", "tr": "Onaylandı ✓"}, "Confirmed ✓": {"ru": "Подтверждено ✓", "es": "Confirmado ✓", "ar": "تم التأكيد ✓", "zh": "已确认 ✓", "hi": "पुष्टि हुई ✓", "tr": "Onaylandı ✓"}, "Waiting for approve…": {"ru": "Ждём подтверждения разрешения…", "es": "Esperando la aprobación…", "ar": "بانتظار الموافقة…", "zh": "等待授权…", "hi": "स्वीकृति की प्रतीक्षा…", "tr": "Onay bekleniyor…"}, "Waiting for confirmation…": {"ru": "Ждём подтверждения в сети…", "es": "Esperando confirmación…", "ar": "بانتظار التأكيد…", "zh": "等待确认…", "hi": "पुष्टि की प्रतीक्षा…", "tr": "Onay bekleniyor…"}, "Confirm the transaction in your wallet…": {"ru": "Подтвердите транзакцию в кошельке…", "es": "Confirma la transacción en tu billetera…", "ar": "أكّد المعاملة في محفظتك…", "zh": "请在钱包中确认交易…", "hi": "अपने वॉलेट में लेनदेन की पुष्टि करें…", "tr": "İşlemi cüzdanında onayla…"}, "You cancelled the transaction": {"ru": "Вы отменили транзакцию", "es": "Cancelaste la transacción", "ar": "لقد ألغيت المعاملة", "zh": "你已取消交易", "hi": "आपने लेनदेन रद्द कर दिया", "tr": "İşlemi iptal ettin"}, "Insufficient balance (or not enough for gas)": {"ru": "Недостаточно средств (или не хватает на газ)", "es": "Saldo insuficiente (o no alcanza para el gas)", "ar": "رصيد غير كافٍ (أو لا يكفي للغاز)", "zh": "余额不足（或不够支付 Gas）", "hi": "अपर्याप्त बैलेंस (या गैस के लिए कम)", "tr": "Yetersiz bakiye (veya gas için yetersiz)"}, "Invalid amount": {"ru": "Неверная сумма", "es": "Importe no válido", "ar": "مبلغ غير صالح", "zh": "金额无效", "hi": "अमान्य राशि", "tr": "Geçersiz tutar"}, "Recipient and amount required": {"ru": "Укажите получателя и сумму", "es": "Indica destinatario e importe", "ar": "أدخل المستلم والمبلغ", "zh": "请填写收款地址和金额", "hi": "प्राप्तकर्ता और राशि आवश्यक है", "tr": "Alıcı ve tutar gerekli"}, "Send currently supports EVM 0x… addresses only": {"ru": "Отправка пока поддерживает только EVM-адреса 0x…", "es": "Por ahora el envío solo admite direcciones EVM 0x…", "ar": "الإرسال يدعم حاليًا عناوين EVM ‏0x… فقط", "zh": "发送目前仅支持 EVM 0x… 地址", "hi": "भेजना अभी केवल EVM 0x… पतों का समर्थन करता है", "tr": "Gönderim şu an yalnızca EVM 0x… adreslerini destekler"}, "Active wallet has no accounts — reconnect and retry": {"ru": "В кошельке нет активного аккаунта — переподключите и повторите", "es": "La billetera activa no tiene cuentas: vuelve a conectarla e inténtalo de nuevo", "ar": "لا توجد حسابات في المحفظة النشطة — أعد الاتصال وحاول مجددًا", "zh": "当前钱包没有账户——请重新连接后重试", "hi": "सक्रिय वॉलेट में कोई खाता नहीं — फिर से कनेक्ट करें और दोबारा कोशिश करें", "tr": "Aktif cüzdanda hesap yok — yeniden bağlanıp tekrar dene"}, "Send failed": {"ru": "Не удалось отправить", "es": "No se pudo enviar", "ar": "فشل الإرسال", "zh": "发送失败", "hi": "भेजना विफल रहा", "tr": "Gönderilemedi"}, "Sign in required to continue.": {"ru": "Чтобы продолжить, подключите кошелёк.", "es": "Conecta tu billetera para continuar.", "ar": "اربط محفظتك للمتابعة.", "zh": "请连接钱包以继续。", "hi": "जारी रखने के लिए वॉलेट कनेक्ट करें।", "tr": "Devam etmek için cüzdanını bağla."}, "Solana Instant Swap is temporarily unavailable": {"ru": "Мгновенный своп в Solana временно недоступен", "es": "El swap instantáneo en Solana no está disponible por ahora", "ar": "التبديل الفوري على Solana غير متاح مؤقتًا", "zh": "Solana 即时兑换暂时不可用", "hi": "Solana इंस्टेंट स्वैप अस्थायी रूप से उपलब्ध नहीं है", "tr": "Solana anında takas geçici olarak kullanılamıyor"}, "Cross-chain swap delivered to the destination network": {"ru": "Межсетевой обмен доставлен в сеть получения", "es": "El swap entre redes llegó a la red de destino", "ar": "وصل التبديل بين الشبكات إلى شبكة الوجهة", "zh": "跨链兑换已到达目标网络", "hi": "क्रॉस-चेन स्वैप गंतव्य नेटवर्क पर पहुंच गया", "tr": "Ağlar arası takas hedef ağa ulaştı"}, "Token approval confirmed. The swap was not sent; review the quote and tap Swap again.": {"ru": "Разрешение на токен подтверждено. Обмен не отправлен — проверьте курс и нажмите «Обменять» ещё раз.", "es": "Aprobación del token confirmada. El swap no se envió: revisa la cotización y pulsa Swap de nuevo.", "ar": "تم تأكيد الموافقة على الرمز. لم يُرسل التبديل؛ راجع السعر واضغط تبديل مرة أخرى.", "zh": "代币授权已确认。兑换尚未发送；请检查报价后再次点击兑换。", "hi": "टोकन स्वीकृति की पुष्टि हुई। स्वैप नहीं भेजा गया; कोट देखें और फिर से स्वैप दबाएं।", "tr": "Token onayı tamamlandı. Takas gönderilmedi; fiyatı kontrol edip tekrar Takas'a bas."}, "Token approval reverted. The swap was not sent; check gas and try again.": {"ru": "Разрешение на токен не прошло. Обмен не отправлен — проверьте газ и повторите.", "es": "La aprobación del token falló. El swap no se envió: revisa el gas e inténtalo de nuevo.", "ar": "فشلت الموافقة على الرمز. لم يُرسل التبديل؛ تحقق من الغاز وحاول مجددًا.", "zh": "代币授权失败。兑换未发送；请检查 Gas 后重试。", "hi": "टोकन स्वीकृति विफल रही। स्वैप नहीं भेजा गया; गैस जांचें और फिर कोशिश करें।", "tr": "Token onayı başarısız oldu. Takas gönderilmedi; gas'ı kontrol edip tekrar dene."}, "Refreshing route after reconnect…": {"ru": "Обновляем маршрут после переподключения…", "es": "Actualizando la ruta tras reconectar…", "ar": "جارٍ تحديث المسار بعد إعادة الاتصال…", "zh": "重新连接后正在刷新路线…", "hi": "फिर से कनेक्ट होने के बाद रूट अपडेट हो रहा है…", "tr": "Yeniden bağlandıktan sonra rota yenileniyor…"}, "Reconnecting wallet…": {"ru": "Переподключаем кошелёк…", "es": "Reconectando la billetera…", "ar": "جارٍ إعادة ربط المحفظة…", "zh": "正在重新连接钱包…", "hi": "वॉलेट फिर से कनेक्ट हो रहा है…", "tr": "Cüzdan yeniden bağlanıyor…"}, "Could not calculate MAX": {"ru": "Не удалось рассчитать MAX", "es": "No se pudo calcular el MAX", "ar": "تعذّر حساب الحد الأقصى", "zh": "无法计算最大值", "hi": "MAX की गणना नहीं हो सकी", "tr": "MAX hesaplanamadı"}, "Confirm in Phantom": {"ru": "Подтвердите в Phantom", "es": "Confirma en Phantom", "ar": "أكّد في Phantom", "zh": "请在 Phantom 中确认", "hi": "Phantom में पुष्टि करें", "tr": "Phantom'da onayla"}, "Submitted on Solana…": {"ru": "Отправлено в сеть Solana…", "es": "Enviado en Solana…", "ar": "تم الإرسال على Solana…", "zh": "已在 Solana 提交…", "hi": "Solana पर भेजा गया…", "tr": "Solana'da gönderildi…"}, "Swap unavailable — GROM fee not configured on this route": {"ru": "Обмен недоступен — для этого маршрута не настроена комиссия GROM", "es": "Swap no disponible: la comisión de GROM no está configurada en esta ruta", "ar": "التبديل غير متاح — رسوم GROM غير مهيأة لهذا المسار", "zh": "无法兑换——此路线未配置 GROM 手续费", "hi": "स्वैप उपलब्ध नहीं — इस रूट पर GROM शुल्क सेट नहीं है", "tr": "Takas kullanılamıyor — bu rotada GROM ücreti ayarlı değil"}, "Previous tx reverted — retrying with LiFi…": {"ru": "Прошлая транзакция не прошла — пробуем через LiFi…", "es": "La transacción anterior falló: reintentando con LiFi…", "ar": "فشلت المعاملة السابقة — إعادة المحاولة عبر LiFi…", "zh": "上一笔交易失败——正在通过 LiFi 重试…", "hi": "पिछला लेनदेन विफल — LiFi से फिर कोशिश…", "tr": "Önceki işlem başarısız — LiFi ile tekrar deneniyor…"}, "Submitted on Solana · bridge in progress…": {"ru": "Отправлено в Solana · идёт перевод между сетями…", "es": "Enviado en Solana · puente en curso…", "ar": "تم الإرسال على Solana · الجسر قيد التنفيذ…", "zh": "已在 Solana 提交 · 跨链进行中…", "hi": "Solana पर भेजा गया · ब्रिज जारी है…", "tr": "Solana'da gönderildi · köprü sürüyor…"}, "Submitted on Tron · bridge in progress…": {"ru": "Отправлено в Tron · идёт перевод между сетями…", "es": "Enviado en Tron · puente en curso…", "ar": "تم الإرسال على Tron · الجسر قيد التنفيذ…", "zh": "已在 Tron 提交 · 跨链进行中…", "hi": "Tron पर भेजा गया · ब्रिज जारी है…", "tr": "Tron'da gönderildi · köprü sürüyor…"}, "Enter an amount": {"ru": "Введите сумму", "es": "Introduce un importe", "ar": "أدخل المبلغ", "zh": "请输入金额", "hi": "राशि दर्ज करें", "tr": "Tutar gir"}, "That looks like a dollar amount in the ETH field — set ~0.004 ETH for a $10 swap": {"ru": "Похоже, в поле ETH введена сумма в долларах — для обмена на $10 укажите ~0.004 ETH", "es": "Parece un importe en dólares en el campo ETH: pon ~0.004 ETH para un swap de $10", "ar": "يبدو أنك أدخلت مبلغًا بالدولار في حقل ETH — ضع ~0.004 ETH لتبديل بقيمة $10", "zh": "ETH 栏里好像填的是美元金额——$10 的兑换约为 0.004 ETH", "hi": "ETH फ़ील्ड में डॉलर राशि लगती है — $10 के स्वैप के लिए ~0.004 ETH डालें", "tr": "ETH alanına dolar tutarı girilmiş gibi — $10'lık takas için ~0.004 ETH yaz"}, "Choose different assets": {"ru": "Выберите разные токены", "es": "Elige activos distintos", "ar": "اختر أصولًا مختلفة", "zh": "请选择不同的资产", "hi": "अलग-अलग एसेट चुनें", "tr": "Farklı varlıklar seç"}, "Still preparing the route — no request has been sent to your wallet yet": {"ru": "Маршрут ещё готовится — в кошелёк пока ничего не отправлено", "es": "Aún preparando la ruta: todavía no se ha enviado nada a tu billetera", "ar": "لا يزال المسار قيد التحضير — لم يُرسل أي طلب إلى محفظتك بعد", "zh": "路线仍在准备中——尚未向你的钱包发送请求", "hi": "रूट अभी तैयार हो रहा है — आपके वॉलेट को अभी कोई अनुरोध नहीं भेजा गया", "tr": "Rota hâlâ hazırlanıyor — cüzdanına henüz istek gönderilmedi"}, "No wallet response yet — check wallet activity; do not retry until the result is clear": {"ru": "Кошелёк пока не ответил — проверьте активность в кошельке и не повторяйте, пока результат не ясен", "es": "La billetera aún no responde: revisa su actividad y no lo repitas hasta saber el resultado", "ar": "لا رد من المحفظة بعد — تحقق من نشاط المحفظة ولا تُعد المحاولة حتى تتضح النتيجة", "zh": "钱包尚未响应——请查看钱包活动，结果明确前不要重试", "hi": "वॉलेट से अभी जवाब नहीं — वॉलेट गतिविधि देखें; परिणाम स्पष्ट होने तक दोबारा न करें", "tr": "Cüzdandan henüz yanıt yok — cüzdan etkinliğini kontrol et; sonuç netleşene kadar tekrar deneme"}, "Use Instant Swap (on-chain)": {"ru": "Используйте мгновенный своп (в сети)", "es": "Usa el swap instantáneo (on-chain)", "ar": "استخدم التبديل الفوري (على السلسلة)", "zh": "请使用即时兑换（链上）", "hi": "इंस्टेंट स्वैप (ऑन-चेन) इस्तेमाल करें", "tr": "Anında takası kullan (zincir üstü)"}, "Tron linked — loading TRX balances…": {"ru": "Tron подключён — загружаем балансы TRX…", "es": "Tron vinculado: cargando saldos de TRX…", "ar": "تم ربط Tron — جارٍ تحميل أرصدة TRX…", "zh": "Tron 已连接——正在加载 TRX 余额…", "hi": "Tron जुड़ गया — TRX बैलेंस लोड हो रहे हैं…", "tr": "Tron bağlandı — TRX bakiyeleri yükleniyor…"}, "Tron connect failed": {"ru": "Не удалось подключить Tron", "es": "No se pudo conectar Tron", "ar": "فشل ربط Tron", "zh": "Tron 连接失败", "hi": "Tron कनेक्ट नहीं हो सका", "tr": "Tron bağlanamadı"}, "Opening TronLink…": {"ru": "Открываем TronLink…", "es": "Abriendo TronLink…", "ar": "جارٍ فتح TronLink…", "zh": "正在打开 TronLink…", "hi": "TronLink खुल रहा है…", "tr": "TronLink açılıyor…"}, "Opening Trust (Tron)…": {"ru": "Открываем Trust (Tron)…", "es": "Abriendo Trust (Tron)…", "ar": "جارٍ فتح Trust (Tron)…", "zh": "正在打开 Trust（Tron）…", "hi": "Trust (Tron) खुल रहा है…", "tr": "Trust (Tron) açılıyor…"}, "Tron WalletConnect cancelled": {"ru": "Подключение Tron через WalletConnect отменено", "es": "WalletConnect de Tron cancelado", "ar": "تم إلغاء WalletConnect لـ Tron", "zh": "Tron WalletConnect 已取消", "hi": "Tron WalletConnect रद्द किया गया", "tr": "Tron WalletConnect iptal edildi"}, "Enable Tron in this wallet (network / DApp browser), then tap TronLink again": {"ru": "Включите Tron в этом кошельке (сеть / DApp-браузер) и снова нажмите TronLink", "es": "Activa Tron en esta billetera (red / navegador DApp) y vuelve a pulsar TronLink", "ar": "فعّل Tron في هذه المحفظة (الشبكة / متصفح DApp) ثم اضغط TronLink مجددًا", "zh": "请在此钱包中启用 Tron（网络 / DApp 浏览器），然后再次点击 TronLink", "hi": "इस वॉलेट में Tron चालू करें (नेटवर्क / DApp ब्राउज़र), फिर TronLink दोबारा दबाएं", "tr": "Bu cüzdanda Tron'u aç (ağ / DApp tarayıcı), sonra tekrar TronLink'e bas"}, "Reconnect Trust once — enable Tron in the approval, then Confirm the swap": {"ru": "Переподключите Trust один раз — включите Tron при подтверждении, затем подтвердите обмен", "es": "Reconecta Trust una vez: activa Tron en la aprobación y confirma el swap", "ar": "أعد ربط Trust مرة واحدة — فعّل Tron في الموافقة ثم أكّد التبديل", "zh": "重新连接 Trust 一次——在授权中启用 Tron，然后确认兑换", "hi": "Trust को एक बार फिर कनेक्ट करें — स्वीकृति में Tron चालू करें, फिर स्वैप की पुष्टि करें", "tr": "Trust'ı bir kez yeniden bağla — onayda Tron'u aç, sonra takası onayla"}, "Tron wallet not ready — open Trust, enable Tron, then tap Start again": {"ru": "Кошелёк Tron не готов — откройте Trust, включите Tron и снова нажмите «Старт»", "es": "La billetera Tron no está lista: abre Trust, activa Tron y vuelve a pulsar Iniciar", "ar": "محفظة Tron غير جاهزة — افتح Trust وفعّل Tron ثم اضغط ابدأ مجددًا", "zh": "Tron 钱包未就绪——打开 Trust 并启用 Tron，然后再次点击开始", "hi": "Tron वॉलेट तैयार नहीं — Trust खोलें, Tron चालू करें, फिर Start दोबारा दबाएं", "tr": "Tron cüzdanı hazır değil — Trust'ı aç, Tron'u etkinleştir, sonra tekrar Başlat'a bas"}, "No executable route after reconnect — wait for the rate, then Start again": {"ru": "После переподключения маршрута нет — дождитесь курса и снова нажмите «Старт»", "es": "No hay ruta ejecutable tras reconectar: espera la cotización y vuelve a Iniciar", "ar": "لا يوجد مسار قابل للتنفيذ بعد إعادة الاتصال — انتظر السعر ثم ابدأ مجددًا", "zh": "重新连接后没有可执行路线——请等待报价后再次开始", "hi": "फिर से कनेक्ट होने के बाद कोई रूट नहीं — रेट का इंतज़ार करें, फिर Start दबाएं", "tr": "Yeniden bağlandıktan sonra uygulanabilir rota yok — fiyatı bekle, sonra tekrar Başlat"}, "Submitted to Solana — waiting for confirmation…": {"ru": "Отправлено в Solana — ждём подтверждения…", "es": "Enviado a Solana: esperando confirmación…", "ar": "تم الإرسال إلى Solana — بانتظار التأكيد…", "zh": "已提交到 Solana——等待确认…", "hi": "Solana पर भेजा गया — पुष्टि की प्रतीक्षा…", "tr": "Solana'ya gönderildi — onay bekleniyor…"}, "Jupiter · confirm in Phantom": {"ru": "Jupiter · подтвердите в Phantom", "es": "Jupiter · confirma en Phantom", "ar": "Jupiter · أكّد في Phantom", "zh": "Jupiter · 请在 Phantom 中确认", "hi": "Jupiter · Phantom में पुष्टि करें", "tr": "Jupiter · Phantom'da onayla"}, "Jupiter sell · confirm in Phantom": {"ru": "Продажа через Jupiter · подтвердите в Phantom", "es": "Venta en Jupiter · confirma en Phantom", "ar": "بيع عبر Jupiter · أكّد في Phantom", "zh": "Jupiter 卖出 · 请在 Phantom 中确认", "hi": "Jupiter बिक्री · Phantom में पुष्टि करें", "tr": "Jupiter satışı · Phantom'da onayla"}, "BTC → EVM settled! Check your destination wallet.": {"ru": "BTC → EVM зачислено! Проверьте кошелёк получения.", "es": "¡BTC → EVM completado! Revisa tu billetera de destino.", "ar": "تمت تسوية BTC → EVM! تحقق من محفظة الوجهة.", "zh": "BTC → EVM 已到账！请查看目标钱包。", "hi": "BTC → EVM पूरा हुआ! अपना गंतव्य वॉलेट देखें।", "tr": "BTC → EVM tamamlandı! Hedef cüzdanını kontrol et."}, "Refunded to source BTC address — destination not delivered": {"ru": "Средства возвращены на исходный BTC-адрес — до получателя не дошли", "es": "Reembolsado a la dirección BTC de origen: no llegó al destino", "ar": "تمت الإعادة إلى عنوان BTC المصدر — لم يصل إلى الوجهة", "zh": "已退回到来源 BTC 地址——未到达目标", "hi": "स्रोत BTC पते पर वापस किया गया — गंतव्य तक नहीं पहुंचा", "tr": "Kaynak BTC adresine iade edildi — hedefe ulaşmadı"}, "Partial fill — check received asset": {"ru": "Частичное исполнение — проверьте полученный актив", "es": "Ejecución parcial: revisa el activo recibido", "ar": "تنفيذ جزئي — تحقق من الأصل المستلم", "zh": "部分成交——请检查收到的资产", "hi": "आंशिक भराव — प्राप्त एसेट जांचें", "tr": "Kısmi gerçekleşme — alınan varlığı kontrol et"}, "Swap failed on THORchain": {"ru": "Обмен через THORchain не удался", "es": "El swap falló en THORchain", "ar": "فشل التبديل على THORchain", "zh": "THORchain 兑换失败", "hi": "THORchain पर स्वैप विफल रहा", "tr": "THORchain'de takas başarısız oldu"}, "Requesting THORchain route via LiFi…": {"ru": "Запрашиваем маршрут THORchain через LiFi…", "es": "Solicitando ruta THORchain vía LiFi…", "ar": "جارٍ طلب مسار THORchain عبر LiFi…", "zh": "正在通过 LiFi 请求 THORchain 路线…", "hi": "LiFi के ज़रिए THORchain रूट मांगा जा रहा है…", "tr": "LiFi üzerinden THORchain rotası isteniyor…"}, "Approve token to THORchain router…": {"ru": "Разрешите токен для роутера THORchain…", "es": "Aprueba el token para el router de THORchain…", "ar": "وافق على الرمز لموجّه THORchain…", "zh": "请授权代币给 THORchain 路由…", "hi": "THORchain राउटर के लिए टोकन स्वीकृत करें…", "tr": "Token'ı THORchain yönlendiricisi için onayla…"}, "Submitted · THORchain confirming — destination not complete yet": {"ru": "Отправлено · THORchain подтверждает — до получателя ещё не дошло", "es": "Enviado · THORchain confirmando: el destino aún no se completó", "ar": "تم الإرسال · THORchain يؤكد — لم تكتمل الوجهة بعد", "zh": "已提交 · THORchain 确认中——目标尚未完成", "hi": "भेजा गया · THORchain पुष्टि कर रहा है — गंतव्य अभी पूरा नहीं", "tr": "Gönderildi · THORchain onaylıyor — hedef henüz tamamlanmadı"}}, "patterns": [["Bridge route · you receive (.+?) on (.+?)", {"ru": "Межсетевой маршрут · получите $1 в сети $2", "es": "Ruta entre redes · recibirás $1 en $2", "ar": "مسار بين الشبكات · ستستلم $1 على $2", "zh": "跨链路线 · 你将在 $2 收到 $1", "hi": "क्रॉस-चेन रूट · आपको $2 पर $1 मिलेगा", "tr": "Ağlar arası rota · $1, $2 ağında gelecek"}], ["Receive (.+?) on (.+?) · bridge route", {"ru": "Получите $1 в сети $2 · межсетевой маршрут", "es": "Recibirás $1 en $2 · ruta entre redes", "ar": "ستستلم $1 على $2 · مسار بين الشبكات", "zh": "在 $2 收到 $1 · 跨链路线", "hi": "$2 पर $1 मिलेगा · क्रॉस-चेन रूट", "tr": "$1, $2 ağında gelecek · ağlar arası rota"}], ["Unsupported or non-EVM chain (.+?)\\. Switch network in your wallet\\.", {"ru": "Сеть $1 не поддерживается. Переключите сеть в кошельке.", "es": "Red $1 no compatible. Cambia de red en tu billetera.", "ar": "الشبكة $1 غير مدعومة. بدّل الشبكة في محفظتك.", "zh": "不支持的网络 $1。请在钱包中切换网络。", "hi": "नेटवर्क $1 समर्थित नहीं है। वॉलेट में नेटवर्क बदलें।", "tr": "$1 ağı desteklenmiyor. Cüzdanında ağı değiştir."}], ["Submitted — waiting for confirmation… (.+?)", {"ru": "Отправлено — ждём подтверждения… $1", "es": "Enviado: esperando confirmación… $1", "ar": "تم الإرسال — بانتظار التأكيد… $1", "zh": "已提交——等待确认… $1", "hi": "भेजा गया — पुष्टि की प्रतीक्षा… $1", "tr": "Gönderildi — onay bekleniyor… $1"}], ["Sent \\(still propagating\\): (.+?)", {"ru": "Отправлено (расходится по сети): $1", "es": "Enviado (propagándose): $1", "ar": "تم الإرسال (قيد الانتشار): $1", "zh": "已发送（正在广播）：$1", "hi": "भेजा गया (नेटवर्क में फैल रहा है): $1", "tr": "Gönderildi (ağda yayılıyor): $1"}], ["Route would revert — trying (.+?)…", {"ru": "Маршрут не пройдёт — пробуем $1…", "es": "La ruta fallaría: probando $1…", "ar": "المسار سيفشل — نجرب $1…", "zh": "该路线会失败——正在尝试 $1…", "hi": "यह रूट विफल होगा — $1 आज़मा रहे हैं…", "tr": "Rota başarısız olacak — $1 deneniyor…"}], ["Confirm in wallet · (.+?) bridge", {"ru": "Подтвердите в кошельке · мост $1", "es": "Confirma en la billetera · puente $1", "ar": "أكّد في المحفظة · جسر $1", "zh": "请在钱包中确认 · $1 跨链桥", "hi": "वॉलेट में पुष्टि करें · $1 ब्रिज", "tr": "Cüzdanında onayla · $1 köprüsü"}], ["Confirm in wallet · (.+?) · Tron bridge", {"ru": "Подтвердите в кошельке · $1 · мост Tron", "es": "Confirma en la billetera · $1 · puente Tron", "ar": "أكّد في المحفظة · $1 · جسر Tron", "zh": "请在钱包中确认 · $1 · Tron 跨链桥", "hi": "वॉलेट में पुष्टि करें · $1 · Tron ब्रिज", "tr": "Cüzdanında onayla · $1 · Tron köprüsü"}], ["Switch wallet to (.+?) — gas is paid in (.+?)", {"ru": "Переключите кошелёк на $1 — газ оплачивается в $2", "es": "Cambia la billetera a $1: el gas se paga en $2", "ar": "بدّل المحفظة إلى $1 — يُدفع الغاز بـ $2", "zh": "请将钱包切换到 $1——Gas 以 $2 支付", "hi": "वॉलेट को $1 पर बदलें — गैस $2 में दी जाती है", "tr": "Cüzdanı $1 ağına geçir — gas $2 ile ödenir"}], ["Amount is bigger than your (.+?) balance \\((.+?)\\)", {"ru": "Сумма больше баланса $1 ($2)", "es": "El importe supera tu saldo de $1 ($2)", "ar": "المبلغ أكبر من رصيد $1 لديك ($2)", "zh": "金额超过你的 $1 余额（$2）", "hi": "राशि आपके $1 बैलेंस ($2) से अधिक है", "tr": "Tutar $1 bakiyenden ($2) fazla"}], ["No (.+?) balance — amount set to 0", {"ru": "Нет баланса $1 — сумма сброшена до 0", "es": "Sin saldo de $1: importe en 0", "ar": "لا يوجد رصيد $1 — تم ضبط المبلغ على 0", "zh": "没有 $1 余额——金额已设为 0", "hi": "$1 बैलेंस नहीं — राशि 0 कर दी गई", "tr": "$1 bakiyesi yok — tutar 0 yapıldı"}], ["No (.+?) balance anywhere yet — deposit first", {"ru": "Баланса $1 пока нет ни в одной сети — сначала пополните", "es": "Aún no tienes saldo de $1 en ninguna red: deposita primero", "ar": "لا يوجد رصيد $1 في أي شبكة بعد — قم بالإيداع أولًا", "zh": "目前任何网络都没有 $1 余额——请先充值", "hi": "अभी किसी नेटवर्क पर $1 बैलेंस नहीं — पहले जमा करें", "tr": "Henüz hiçbir ağda $1 bakiyen yok — önce yatır"}], ["Loaded (.+?) in Instant Swap", {"ru": "$1 добавлен в мгновенный своп", "es": "$1 cargado en el swap instantáneo", "ar": "تم تحميل $1 في التبديل الفوري", "zh": "已将 $1 载入即时兑换", "hi": "$1 इंस्टेंट स्वैप में लोड किया गया", "tr": "$1 anında takasa yüklendi"}], ["Approve (.+?) in your wallet", {"ru": "Разрешите $1 в кошельке", "es": "Aprueba $1 en tu billetera", "ar": "وافق على $1 في محفظتك", "zh": "请在钱包中授权 $1", "hi": "अपने वॉलेट में $1 को स्वीकृति दें", "tr": "$1 için cüzdanında onay ver"}], ["Preparing (.+?)…", {"ru": "Готовим $1…", "es": "Preparando $1…", "ar": "جارٍ تجهيز $1…", "zh": "正在准备 $1…", "hi": "$1 तैयार हो रहा है…", "tr": "$1 hazırlanıyor…"}], ["Open (.+?)…", {"ru": "Откройте $1…", "es": "Abre $1…", "ar": "افتح $1…", "zh": "请打开 $1…", "hi": "$1 खोलें…", "tr": "$1 uygulamasını aç…"}], ["Reconnecting (.+?) to sign…", {"ru": "Переподключаем $1 для подписи…", "es": "Reconectando $1 para firmar…", "ar": "جارٍ إعادة ربط $1 للتوقيع…", "zh": "正在重新连接 $1 以签名…", "hi": "साइन के लिए $1 फिर से कनेक्ट हो रहा है…", "tr": "İmza için $1 yeniden bağlanıyor…"}], ["Open (.+?) to sign", {"ru": "Откройте $1, чтобы подписать", "es": "Abre $1 para firmar", "ar": "افتح $1 للتوقيع", "zh": "请打开 $1 进行签名", "hi": "साइन करने के लिए $1 खोलें", "tr": "İmzalamak için $1 uygulamasını aç"}], ["Connect (.+?) to sign the swap", {"ru": "Подключите $1, чтобы подписать обмен", "es": "Conecta $1 para firmar el swap", "ar": "اربط $1 لتوقيع التبديل", "zh": "请连接 $1 以签署兑换", "hi": "स्वैप साइन करने के लिए $1 कनेक्ट करें", "tr": "Takası imzalamak için $1 bağla"}], ["Connect (.+?) to sign", {"ru": "Подключите $1 для подписи", "es": "Conecta $1 para firmar", "ar": "اربط $1 للتوقيع", "zh": "请连接 $1 进行签名", "hi": "साइन करने के लिए $1 कनेक्ट करें", "tr": "İmzalamak için $1 bağla"}], ["Scan (.+?) once to sign Tron", {"ru": "Отсканируйте $1 один раз, чтобы подписывать в Tron", "es": "Escanea $1 una vez para firmar en Tron", "ar": "امسح $1 مرة واحدة للتوقيع على Tron", "zh": "扫描 $1 一次以签署 Tron", "hi": "Tron पर साइन करने के लिए $1 एक बार स्कैन करें", "tr": "Tron'da imzalamak için $1 ile bir kez tara"}], ["Confirm Tron in (.+?) to swap USDT↔TRX", {"ru": "Подтвердите Tron в $1, чтобы менять USDT↔TRX", "es": "Confirma Tron en $1 para cambiar USDT↔TRX", "ar": "أكّد Tron في $1 لتبديل USDT↔TRX", "zh": "请在 $1 中确认 Tron 以兑换 USDT↔TRX", "hi": "USDT↔TRX स्वैप के लिए $1 में Tron की पुष्टि करें", "tr": "USDT↔TRX takası için $1 içinde Tron'u onayla"}], ["Jupiter route · (.+?) hops · confirm in wallet", {"ru": "Маршрут Jupiter · шагов: $1 · подтвердите в кошельке", "es": "Ruta Jupiter · $1 saltos · confirma en la billetera", "ar": "مسار Jupiter · $1 خطوات · أكّد في المحفظة", "zh": "Jupiter 路线 · $1 跳 · 请在钱包中确认", "hi": "Jupiter रूट · $1 हॉप · वॉलेट में पुष्टि करें", "tr": "Jupiter rotası · $1 adım · cüzdanında onayla"}], ["Phantom connected: (.+?) — fetching Jupiter route…", {"ru": "Phantom подключён: $1 — ищем маршрут Jupiter…", "es": "Phantom conectado: $1 — buscando ruta de Jupiter…", "ar": "تم ربط Phantom: $1 — جارٍ جلب مسار Jupiter…", "zh": "Phantom 已连接：$1——正在获取 Jupiter 路线…", "hi": "Phantom जुड़ गया: $1 — Jupiter रूट लाया जा रहा है…", "tr": "Phantom bağlandı: $1 — Jupiter rotası alınıyor…"}], ["BTC address saved: (.+?)", {"ru": "BTC-адрес сохранён: $1", "es": "Dirección BTC guardada: $1", "ar": "تم حفظ عنوان BTC: $1", "zh": "BTC 地址已保存：$1", "hi": "BTC पता सहेजा गया: $1", "tr": "BTC adresi kaydedildi: $1"}], ["Tron connected: (.+?) — TRX \\/ TRC-20 ready", {"ru": "Tron подключён: $1 — TRX / TRC-20 готовы", "es": "Tron conectado: $1 — TRX / TRC-20 listos", "ar": "تم ربط Tron: $1 — TRX / TRC-20 جاهزة", "zh": "Tron 已连接：$1——TRX / TRC-20 已就绪", "hi": "Tron जुड़ गया: $1 — TRX / TRC-20 तैयार", "tr": "Tron bağlandı: $1 — TRX / TRC-20 hazır"}], ["Confirm in wallet · you'll receive ~(.+?) BTC · ETA approximate", {"ru": "Подтвердите в кошельке · получите ~$1 BTC · время примерное", "es": "Confirma en la billetera · recibirás ~$1 BTC · tiempo aproximado", "ar": "أكّد في المحفظة · ستستلم ~$1 BTC · الوقت تقريبي", "zh": "请在钱包中确认 · 将收到约 $1 BTC · 时间为估算", "hi": "वॉलेट में पुष्टि करें · आपको ~$1 BTC मिलेगा · समय अनुमानित", "tr": "Cüzdanında onayla · ~$1 BTC alacaksın · süre yaklaşık"}], ["TWAP tranche (.+?)\\/(.+?) ready\\. Press Swap to fill\\.", {"ru": "Часть TWAP $1/$2 готова. Нажмите «Обменять», чтобы исполнить.", "es": "Tramo TWAP $1/$2 listo. Pulsa Swap para ejecutarlo.", "ar": "شريحة TWAP ‏$1/$2 جاهزة. اضغط تبديل للتنفيذ.", "zh": "TWAP 第 $1/$2 份已就绪。点击兑换执行。", "hi": "TWAP किश्त $1/$2 तैयार। भरने के लिए स्वैप दबाएं।", "tr": "TWAP dilimi $1/$2 hazır. Gerçekleştirmek için Takas'a bas."}], ["TWAP set — (.+?) × (.+?) (.+?) every (.+?) min", {"ru": "TWAP настроен — $1 × $2 $3 каждые $4 мин", "es": "TWAP configurado: $1 × $2 $3 cada $4 min", "ar": "تم ضبط TWAP — $1 × $2 $3 كل $4 دقيقة", "zh": "TWAP 已设置——每 $4 分钟 $1 × $2 $3", "hi": "TWAP सेट — हर $4 मिनट $1 × $2 $3", "tr": "TWAP ayarlandı — her $4 dk'da $1 × $2 $3"}]]};
try {
  const ux = window.GROM_UX_TR || (window.GROM_UX_TR = {});
  const add = { es: '≈ mercado', ar: '≈ سعر السوق', zh: '≈ 市价', hi: '≈ बाज़ार भाव', tr: '≈ piyasa' };
  for (const l of Object.keys(add)) { ux[l] = ux[l] || {}; ux[l]['≈ market'] = add[l]; }
} catch (_) {}
// Merge all language packs into GROM_STR
  ['ru', 'en', 'es', 'ar', 'zh', 'hi', 'tr'].forEach(function (lng) {
    if (!window.GROM_STR) return;
    if (!window.GROM_STR[lng]) window.GROM_STR[lng] = {};
    if (EXTRA[lng]) Object.assign(window.GROM_STR[lng], EXTRA[lng]);
  });

  window.syncSettingsLangSeg = syncSettingsLangSeg;
  window.refreshAuthLoginLabel = refreshAuthLoginLabel;

  syncSettingsLangSeg(typeof window.getGromLang === 'function' ? window.getGromLang() : 'en');
  refreshAuthLoginLabel();
  if (typeof window.applyI18n === 'function') window.applyI18n();
})();
