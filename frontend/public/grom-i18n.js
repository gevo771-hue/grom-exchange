/**
 * GROM UI strings — Russian / English.
 * Elements: [data-i18n="key"], [data-i18n-placeholder="key"], [data-i18n-html="key"] (trusted short HTML only).
 */
(function () {
  'use strict';

  var STR = {
    ru: {
      nav_landing: 'Лендинг',
      nav_home: 'Главная',
      nav_dashboard: 'Главное',
      top_brand_sub: 'Finance Hub',
      nav_spot: 'Spot',
      nav_binary: 'Binary',
      nav_wallet: 'Кошелёк',
      nav_markets: 'Рынки',
      nav_futures: 'Futures',
      nav_referral: 'Рефералы',
      nav_history: 'История',
      nav_settings: 'Настройки',
      nav_help: 'Помощь',
      wallet_deposit: 'Депозит',
      auth_logout: 'Выйти',
      ref_share_x: 'Поделиться в X',
      common_copy: 'Копировать',
      badge_new: 'НОВОЕ',
      badge_hot: 'ХИТ',
      top_help: 'Помощь',
      top_connect: 'Подключить кошелёк',
      top_search_ph: 'Поиск…',
      top_search_tip: 'Поиск — ⌘K',
      sidebar_tour_title: 'Впервые на GROM?',
      sidebar_tour_desc: '90-секундный тур по Binary desk.',
      sidebar_tour_link: '▶ Начать тур',
      landing_kicker: 'FINANCE HUB',
      landing_logo_img_alt: 'GROM Finance Hub',
      landing_title: 'Торгуйте умнее. Торгуйте с GROM.',
      landing_lead: 'Профессиональная платформа для Spot, Binary и аналитики. Агрегированные котировки Binance · Kraken · Coinbase, не‑кастодиальный вход и прозрачные лимиты риска.',
      landing_cta_trade: 'Начать торговать',
      landing_cta_demo: 'Демо-счёт',
      feat1_title: 'SPOT',
      feat1_desc: '200+ пар, низкие комиссии и глубокая ликвидность.',
      feat2_title: 'BINARY',
      feat2_desc: 'Короткие экспирации и выплаты до 92%.',
      feat3_title: 'ХОЛДИНГ',
      feat3_desc: 'До 95% средств в cold storage и мульти-подпись.',
      feat4_title: 'PRO-АНАЛИТИКА',
      feat4_desc: 'Индикаторы, стакан и сигналы в одном окне.',
      dash_bc: 'Главное',
      dash_title: 'Доброе утро, трейдер',
      dash_sub: 'Сводка по портфелю и избранным парам.',
      dash_welcome_h: 'Добро пожаловать в GROM Finance Hub',
      dash_welcome_p: 'Spot, Binary и DeFi — из одного некастодиального кошелька.',
      dash_try_bo: 'Попробовать Binary',
      dash_tour: '▶ Тур за 90 секунд',
      pg_binary_title: 'Binary Options',
      pg_binary_sub: 'Прогноз вверх или вниз к закрытию раунда. Фиксированные выплаты, жёсткий лимит риска, без плеча — по агрегированным котировкам.',
      pg_spot_title: 'BTC/USDT',
      pg_spot_sub: 'Стакан и свечи в реальном времени — Binance, Kraken и Coinbase с резервированием.',
      pg_markets_title: 'Все рынки',
      pg_markets_sub: 'Актуальные цены по парам. Нажмите строку, чтобы открыть график.',
      pg_wallet_title: 'Кошелёк',
      pg_wallet_sub: 'Торговые балансы — для мгновенных Spot, Futures и Binary сделок. On-chain свопы и вывод — через ваш кошелёк, ваши ключи.',
      pg_history_title: 'История сделок',
      pg_history_sub: 'Все сделки, пополнения и выводы на GROM.',
      pg_futures_bc: 'Futures',
      pg_futures_title: 'Futures · USDT margin',
      pg_futures_sub: 'Изолированная и кросс-маржа, глубина с агрегированных площадок, bracket / OCO — тот же риск-движок, что и на Spot, с размером контракта и превью фандинга.',
      fut_pos_title: 'Открытые позиции',
      fut_pos_empty: 'Нет открытых контрактов — задайте размер со стакана или Quick long / short.',
      fut_ladder_title: 'Быстрая лесенка',
      fut_btn_long: 'Быстро в лонг',
      fut_btn_short: 'Быстро в шорт',
      pg_referral_bc: 'Реферальная программа',
      pg_referral_title: 'Приглашайте трейдеров — получайте ребейты',
      pg_referral_sub: 'Делитесь ссылкой: когда друзья торгуют Spot, Futures или Binary — вы получаете долю комиссии в USDT. Выплаты по цепочке раз в неделю.',
      ref_link_title: 'Ваша ссылка',
      ref_copy: 'Копировать',
      ref_stat_inv: 'Приглашено',
      ref_stat_vol: 'Их объём (30д)',
      ref_stat_earn: 'Ваши ребейты',
      pg_settings_bc: 'Настройки',
      pg_settings_title: 'Параметры',
      pg_settings_sub: 'Язык, уведомления и торговые значения по умолчанию хранятся в этом браузере, пока вы не войдёте кошельком.',
      set_lang_title: 'Язык',
      set_notif_title: 'Уведомления',
      set_notif_desc: 'Push в этом билде выключен — используйте колокольчик для алертов в приложении.',
      pg_help_bc: 'Помощь',
      pg_help_title: 'Поддержка и гайды',
      pg_help_sub: 'Документация, статус и чат — то же окно, что и кнопка «Помощь» в шапке.',
      lp_hero_eyebrow: '⚡ Гибридная биржа · скорость CEX + свобода DEX',
      lp_hero_h1: 'Торгуйте криптой на скорости <span>мысли</span>.',
      lp_hero_sub: 'Spot · Futures · Binary Options · ончейн-свопы. Один аккаунт. Исполнение за доли миллисекунды. Ваши ключи — когда захотите. Банковская безопасность с первого дня.',
      lp_hero_cta1: 'Начать торговать →',
      lp_hero_cta2: 'Открыть дашборд',
      lp_hero_trust1: '<b>8</b> сетей',
      lp_hero_trust2: '<b>365+</b> пар',
      lp_hero_trust3: '<b>87%</b> выплата по бинарам',
      lp_hero_trust4: '<b>100×</b> макс. плечо',
      lp_prod_spot_h: 'Spot',
      lp_prod_spot_p: 'Движок исполнения FIFO. Ликвидность агрегируется с Binance · Kraken · Coinbase. Maker 5 б.п. · Taker 10 б.п. Глубина стакана в реальном времени.',
      lp_prod_spot_cta: 'Открыть Spot →',
      lp_prod_fut_h: 'Futures',
      lp_prod_fut_p: 'Бессрочные контракты с плечом до 100×. Кросс- или изолированная маржа. Mark price · фандинг · ликвидация · TP/SL — полный риск-движок на каждой позиции.',
      lp_prod_fut_cta: 'Открыть Futures →',
      lp_prod_bo_h: 'Binary Options',
      lp_prod_bo_p: 'Экспирации 5с · 15с · 30с · 1м · 5м · 15м. Выплата 87% при выигрыше. Демо-баланс $50K для практики — без депозита и KYC.',
      lp_prod_bo_cta: 'Попробовать Binary →',
      lp_why_h2: 'Биржа нового поколения',
      lp_why_intro: 'Большинство бирж заставляют выбирать: <b style="color:#e8f1fa">CEX</b> ради скорости, но вы отдаёте ключи, или <b style="color:#e8f1fa">DEX</b> ради самокастодиальности, но с высокими комиссиями и медленными свопами. GROM даёт и то, и другое.',
      lp_why_c1_h: 'Гибридное хранение',
      lp_why_c1_p: 'Торговые балансы под кастодиальным хранением для мгновенного исполнения. Ончейн-свопы через 1inch — ваши ключи, ваша транзакция. Переключение режимов в один клик.',
      lp_why_c2_h: 'Максимальная безопасность',
      lp_why_c2_p: 'MPC hot-wallet · Email OTP + TOTP 2FA · whitelist адресов на 24ч · ручная проверка > $10k · 90%+ в холодном хранилище · страховой фонд от ликвидаций.',
      lp_why_c3_h: 'Реальная ликвидность',
      lp_why_c3_p: 'Агрегированный поток цен с топ-3 CEX (Binance · Kraken · Coinbase). Маркет-мейкер держит спреды 5–30 б.п. Никаких пустых стаканов с первого дня.',
      lp_why_c4_h: 'Мультичейн из коробки',
      lp_why_c4_p: 'Ethereum · Arbitrum · Polygon · Base · BNB Chain · TRON · Bitcoin · Solana. Депозит USDT в Tron за $1. Вывод на любой адрес.',
      lp_why_c5_h: 'Pro-инструменты',
      lp_why_c5_p: 'Глубина стакана в реальном времени · свечи/линии · RSI · MACD · сигналы order-flow · WebSocket-пуш · API-ключи для алготрейдеров.',
      lp_why_c6_h: 'Простой старт',
      lp_why_c6_p: 'Торгуйте до $500/день без KYC. Подключение через Privy, MetaMask, Trust, Binance Web3 Wallet или просто email + Google. Старт за 30 секунд.',
      lp_how_h2: 'Начните торговать менее чем за 60 секунд',
      lp_how_s1_h: 'Подключите кошелёк или зарегистрируйтесь',
      lp_how_s1_p: 'Встроенный кошелёк Privy, MetaMask, Trust, Binance Web3 Wallet или вход по email + Google. Пароль не нужен.',
      lp_how_s2_h: 'Пополните или свопните',
      lp_how_s2_p: 'USDT в сети Tron за $1. Или пропустите депозит — свопайте ончейн через 1inch прямо из своего кошелька.',
      lp_how_s3_h: 'Торгуйте чем угодно',
      lp_how_s3_p: 'BTC, ETH, SOL, BNB и другое. Начните с Binary Options на демо-балансе $50K — без риска.',
      lp_sec_badge: '🛡 Биржа с приоритетом безопасности',
      lp_sec_h2: 'Надёжно как банк, быстро как DEX',
      lp_sec_sub: 'Большинство новых бирж стартуют с обещанием «добавим 2FA позже». Мы запустились со всем включённым.',
      lp_sec_i1: '<b>🔑 MPC hot-wallet</b>Никакого единого приватного ключа на сервере. Для компрометации нужны несколько фрагментов ключа от независимых сторон.',
      lp_sec_i2: '<b>📧 Вывод в 3 шага</b>Email OTP + TOTP 2FA + адрес из whitelist с задержкой 24 часа после добавления. Брутфорс невозможен.',
      lp_sec_i3: '<b>👁 Ручная проверка</b>Выводы свыше $10 000 требуют одобрения админа с записью причины в неизменяемый аудит-лог.',
      lp_sec_i4: '<b>❄ Холодное хранение 90%+</b>Авто-свип выводит излишки из горячего кошелька каждый час. Остальное хранит мультисиг Gnosis Safe, офлайн.',
      lp_sec_i5: '<b>💰 Страховой фонд</b>Пул USDT покрывает ликвидации с отрицательным капиталом на Futures. Никаких общих убытков для пользователей.',
      lp_sec_i6: '<b>🔍 SOC 2 в процессе</b>Внешние пентесты запланированы с Trail of Bits на Q3 2026. Программа bug bounty активна с запуска.',
      lp_final_h: 'Готовы торговать умнее?',
      lp_final_sub: 'Гибрид CEX/DEX. Реальная ликвидность. Банковская безопасность. Откройте счёт за 30 секунд — первая сделка за 60.',
      lp_final_cta1: 'Начать торговать →',
      lp_final_cta2: 'Войти / Регистрация',
      lp_final_tiny: 'Депозит не нужен для демо Binary · 8 сетей · гибридное хранение · исполнение за доли мс · поддержка 24/7',
    },
    en: {
      nav_landing: 'Landing',
      nav_home: 'Home',
      nav_dashboard: 'Main',
      top_brand_sub: 'Finance Hub',
      nav_spot: 'SPOT',
      nav_binary: 'OPTIONS',
      nav_wallet: 'Wallet',
      nav_markets: 'Markets',
      nav_futures: 'Futures',
      nav_referral: 'Referrals',
      nav_history: 'History',
      nav_settings: 'Settings',
      nav_help: 'Help & support',
      wallet_deposit: 'Deposit',
      auth_logout: 'Logout',
      ref_share_x: 'Share on X',
      common_copy: 'Copy',
      badge_new: 'NEW',
      badge_hot: 'HOT',
      top_help: 'Help',
      top_connect: 'Connect wallet',
      top_search_ph: 'Search…',
      top_search_tip: 'Search — ⌘K',
      sidebar_tour_title: 'New to GROM?',
      sidebar_tour_desc: '90-second tour of the binary options desk.',
      sidebar_tour_link: '▶ Start tour',
      landing_kicker: 'FINANCE HUB',
      landing_logo_img_alt: 'GROM Finance Hub',
      landing_title: 'Trade smarter. Trade with GROM.',
      landing_lead: 'A professional venue for spot, binary options, and analytics. Aggregated feeds from Binance · Kraken · Coinbase, non-custodial sign-in, and hard-capped risk.',
      landing_cta_trade: 'Start trading',
      landing_cta_demo: 'Demo account',
      feat1_title: 'SPOT TRADING',
      feat1_desc: '200+ pairs, tight fees, and deep liquidity.',
      feat2_title: 'BINARY OPTIONS',
      feat2_desc: 'Short expiries and payouts up to 92%.',
      feat3_title: 'COLD STORAGE',
      feat3_desc: 'Up to 95% of funds in multi-sig cold wallets.',
      feat4_title: 'PRO ANALYTICS',
      feat4_desc: 'Indicators, order book, and signals in one desk.',
      dash_bc: 'Main',
      dash_title: 'Good morning, trader',
      dash_sub: 'Here is what is moving across your portfolio and watchlist.',
      dash_welcome_h: 'Welcome to GROM Finance Hub',
      dash_welcome_p: 'Spot, binary options, and DeFi — from a single non-custodial wallet.',
      dash_try_bo: 'Try binary options',
      dash_tour: '▶ 90-second tour',
      pg_binary_title: 'Binary Options Desk',
      pg_binary_sub: 'Predict UP or DOWN at round close. Fixed payouts, hard-capped risk, no leverage — from aggregated feeds.',
      pg_spot_title: 'BTC/USDT',
      pg_spot_sub: 'Live order book and candles — Binance, Kraken & Coinbase with automatic failover.',
      pg_markets_title: 'All markets',
      pg_markets_sub: 'Live prices across pairs. Click a row to open the chart.',
      pg_wallet_title: 'Your wallet',
      pg_wallet_sub: 'Trading balances power instant Spot, Futures and Binary fills. On-chain swaps and withdrawals use your connected wallet — your keys.',
      pg_history_title: 'Trade history',
      pg_history_sub: 'Every trade, deposit and withdrawal on GROM.',
      pg_futures_bc: 'Futures',
      pg_futures_title: 'USDT-margined futures',
      pg_futures_sub: 'Isolated and cross margin, depth from aggregated venues, and bracket / OCO exits — same risk engine as spot, with contract sizing and funding previews.',
      fut_pos_title: 'Open positions',
      fut_pos_empty: 'No open contracts — size from the ladder or use Quick long / short.',
      fut_ladder_title: 'Quick ladder',
      fut_btn_long: 'Quick long',
      fut_btn_short: 'Quick short',
      pg_referral_bc: 'Referral program',
      pg_referral_title: 'Invite traders, earn rebates',
      pg_referral_sub: 'Share your link — when friends trade spot, futures, or binary, you earn a share of fees in USDT. Payouts are on-chain weekly.',
      ref_link_title: 'Your link',
      ref_copy: 'Copy',
      ref_stat_inv: 'Invited',
      ref_stat_vol: 'Their volume (30d)',
      ref_stat_earn: 'Your rebates',
      pg_settings_bc: 'Settings',
      pg_settings_title: 'Preferences',
      pg_settings_sub: 'Language, notifications, and trading defaults are stored in this browser until you sign in with a wallet.',
      set_lang_title: 'Language',
      set_notif_title: 'Notifications',
      set_notif_desc: 'Browser push is off in this build — use the bell for in-app alerts.',
      pg_help_bc: 'Help',
      pg_help_title: 'Support & guides',
      pg_help_sub: 'Documentation, status, and live chat — same desk as the top bar Help button.',
      lp_hero_eyebrow: '⚡ Hybrid Exchange · CEX Speed + DEX Freedom',
      lp_hero_h1: 'Trade crypto at the speed of <span>thought</span>.',
      lp_hero_sub: 'Spot · Futures · Binary Options · On-chain swaps. One account. Sub-millisecond fills. Your keys when you want them. Bank-grade security from day one.',
      lp_hero_cta1: 'Start trading →',
      lp_hero_cta2: 'Explore dashboard',
      lp_hero_trust1: '<b>8</b> chains',
      lp_hero_trust2: '<b>365+</b> pairs',
      lp_hero_trust3: '<b>87%</b> binary payout',
      lp_hero_trust4: '<b>100×</b> max leverage',
      lp_prod_spot_h: 'Spot',
      lp_prod_spot_p: 'FIFO matching engine. Liquidity aggregated from Binance · Kraken · Coinbase. Maker 5 bps · Taker 10 bps. Real-time orderbook depth.',
      lp_prod_spot_cta: 'Open Spot desk →',
      lp_prod_fut_h: 'Futures',
      lp_prod_fut_p: 'Perpetuals up to 100× leverage. Cross or isolated margin. Mark price · funding · liquidation · TP/SL — full risk engine on every position.',
      lp_prod_fut_cta: 'Open Futures desk →',
      lp_prod_bo_h: 'Binary Options',
      lp_prod_bo_p: '5s · 15s · 30s · 1m · 5m · 15m expiries. 87% payout on win. $50K demo balance to practice — no deposit, no KYC.',
      lp_prod_bo_cta: 'Try Binary now →',
      lp_why_h2: 'The next-generation exchange',
      lp_why_intro: 'Most exchanges force you to choose: <b style="color:#e8f1fa">CEX</b> for speed but you give up your keys, or <b style="color:#e8f1fa">DEX</b> for self-custody but high fees and slow swaps. GROM gives you both.',
      lp_why_c1_h: 'Hybrid Custody',
      lp_why_c1_p: 'Trading balances custodied for instant fills. On-chain swaps via 1inch — your keys, your transaction. Switch between modes in one click.',
      lp_why_c2_h: 'Maximum Security',
      lp_why_c2_p: 'MPC hot-wallet · Email OTP + TOTP 2FA · 24h address whitelist · Manual review > $10k · 90%+ in cold storage · Insurance fund for liquidations.',
      lp_why_c3_h: 'Real Liquidity',
      lp_why_c3_p: 'Aggregated price feed from top-3 CEX (Binance · Kraken · Coinbase). Market-maker bot keeps spreads 5–30 bps. No empty order books on day one.',
      lp_why_c4_h: 'Multi-Chain Native',
      lp_why_c4_p: 'Ethereum · Arbitrum · Polygon · Base · BNB Chain · TRON · Bitcoin · Solana. Deposit USDT on Tron for $1 fee. Withdraw to any address.',
      lp_why_c5_h: 'Pro Tools',
      lp_why_c5_p: 'Real-time orderbook depth · Candle/line charts · RSI · MACD · order-flow signals · WebSocket push · API keys for algo traders.',
      lp_why_c6_h: 'Easy Onboarding',
      lp_why_c6_p: 'Trade up to $500/day without KYC. Connect with Privy, MetaMask, Trust, Binance Web3 Wallet, or just email + Google. 30 seconds to start.',
      lp_how_h2: 'Start trading in under 60 seconds',
      lp_how_s1_h: 'Connect wallet or sign up',
      lp_how_s1_p: 'Privy embedded wallet, MetaMask, Trust, Binance Web3 Wallet, or email + Google login. No password needed.',
      lp_how_s2_h: 'Deposit or swap',
      lp_how_s2_p: 'USDT on Tron for $1 fee. Or skip deposit — swap on-chain via 1inch directly from your own wallet.',
      lp_how_s3_h: 'Trade anything',
      lp_how_s3_p: 'BTC, ETH, SOL, BNB and more. Try Binary Options first with $50K demo balance — zero risk.',
      lp_sec_badge: '🛡 Security-first exchange',
      lp_sec_h2: 'Built like a bank, fast like a DEX',
      lp_sec_sub: 'Most new exchanges launch with a "we\'ll add 2FA later" promise. We launched with everything on.',
      lp_sec_i1: '<b>🔑 MPC hot-wallet</b>No single private key sitting on a server. Compromise requires multiple key shards from independent parties.',
      lp_sec_i2: '<b>📧 3-step withdrawal</b>Email OTP + TOTP 2FA + whitelisted address with 24-hour cooldown after adding. Brute-force impossible.',
      lp_sec_i3: '<b>👁 Manual review</b>Withdrawals over $10,000 require admin approval with reason logged to immutable audit trail.',
      lp_sec_i4: '<b>❄ Cold storage 90%+</b>Auto-sweep moves excess out of hot wallet every hour. Multi-sig Gnosis Safe holds the rest, offline.',
      lp_sec_i5: '<b>💰 Insurance fund</b>USDT pool covers negative-equity liquidations on Futures. No socialized losses across users.',
      lp_sec_i6: '<b>🔍 SOC 2 in progress</b>External penetration tests planned with Trail of Bits Q3 2026. Bug bounty program live on launch.',
      lp_final_h: 'Ready to trade smarter?',
      lp_final_sub: 'Hybrid CEX/DEX. Real liquidity. Bank-grade security. Open your account in 30 seconds — first trade in 60.',
      lp_final_cta1: 'Start trading →',
      lp_final_cta2: 'Sign in / Sign up',
      lp_final_tiny: 'No deposit required for Binary demo · 8 chains · Hybrid custody · Sub-millisecond fills · 24/7 support',
    },
    es: {
      nav_landing: 'Inicio', nav_home: 'Inicio', nav_dashboard: 'Panel', top_brand_sub: 'Finance Hub',
      nav_spot: 'SPOT', nav_binary: 'OPCIONES', nav_wallet: 'Billetera', nav_markets: 'Mercados',
      nav_futures: 'Futuros', nav_referral: 'Referidos', nav_history: 'Historial', nav_settings: 'Ajustes',
      nav_help: 'Ayuda y soporte', wallet_deposit: 'Depositar', auth_logout: 'Salir', common_copy: 'Copiar',
      ref_share_x: 'Compartir en X', badge_new: 'NUEVO', badge_hot: 'TOP', top_help: 'Ayuda',
      top_connect: 'Conectar billetera', top_search_ph: 'Buscar…', top_search_tip: 'Buscar — ⌘K',
      sidebar_tour_title: '¿Nuevo en GROM?', sidebar_tour_desc: 'Tour de 90 segundos por el desk de opciones binarias.', sidebar_tour_link: '▶ Iniciar tour',
      lp_hero_eyebrow: '⚡ Exchange híbrido · Velocidad CEX + Libertad DEX',
      lp_hero_h1: 'Opera cripto a la velocidad del <span>pensamiento</span>.',
      lp_hero_sub: 'Spot · Futuros · Opciones binarias · Swaps on-chain. Una sola cuenta. Ejecución en submilisegundos. Tus llaves cuando quieras. Seguridad de nivel bancario desde el primer día.',
      lp_hero_cta1: 'Empezar a operar →', lp_hero_cta2: 'Explorar panel',
      lp_hero_trust1: '<b>8</b> redes', lp_hero_trust2: '<b>365+</b> pares', lp_hero_trust3: '<b>87%</b> pago binario', lp_hero_trust4: '<b>100×</b> apalancamiento máx.',
      lp_prod_spot_h: 'Spot', lp_prod_spot_p: 'Motor de emparejamiento FIFO. Liquidez agregada de Binance · Kraken · Coinbase. Maker 5 pb · Taker 10 pb. Profundidad del libro en tiempo real.', lp_prod_spot_cta: 'Abrir desk Spot →',
      lp_prod_fut_h: 'Futuros', lp_prod_fut_p: 'Perpetuos con hasta 100× de apalancamiento. Margen cruzado o aislado. Precio de marca · funding · liquidación · TP/SL — motor de riesgo completo en cada posición.', lp_prod_fut_cta: 'Abrir desk Futuros →',
      lp_prod_bo_h: 'Opciones binarias', lp_prod_bo_p: 'Expiraciones de 5s · 15s · 30s · 1m · 5m · 15m. 87% de pago al ganar. Saldo demo de $50K para practicar — sin depósito, sin KYC.', lp_prod_bo_cta: 'Probar Binary ahora →',
      lp_why_h2: 'El exchange de nueva generación',
      lp_why_intro: 'La mayoría de exchanges te obligan a elegir: <b style="color:#e8f1fa">CEX</b> por velocidad pero cediendo tus llaves, o <b style="color:#e8f1fa">DEX</b> por autocustodia pero con comisiones altas y swaps lentos. GROM te da ambos.',
      lp_why_c1_h: 'Custodia híbrida', lp_why_c1_p: 'Saldos de trading en custodia para ejecución instantánea. Swaps on-chain vía 1inch — tus llaves, tu transacción. Cambia de modo con un clic.',
      lp_why_c2_h: 'Máxima seguridad', lp_why_c2_p: 'Hot-wallet MPC · OTP por email + 2FA TOTP · whitelist de direcciones 24h · revisión manual > $10k · 90%+ en almacenamiento en frío · fondo de seguro para liquidaciones.',
      lp_why_c3_h: 'Liquidez real', lp_why_c3_p: 'Feed de precios agregado de los 3 mayores CEX (Binance · Kraken · Coinbase). El bot market-maker mantiene spreads de 5–30 pb. Sin libros vacíos desde el primer día.',
      lp_why_c4_h: 'Multi-cadena nativo', lp_why_c4_p: 'Ethereum · Arbitrum · Polygon · Base · BNB Chain · TRON · Bitcoin · Solana. Deposita USDT en Tron por $1. Retira a cualquier dirección.',
      lp_why_c5_h: 'Herramientas Pro', lp_why_c5_p: 'Profundidad del libro en tiempo real · gráficos de velas/líneas · RSI · MACD · señales de order-flow · push WebSocket · claves API para traders algorítmicos.',
      lp_why_c6_h: 'Registro sencillo', lp_why_c6_p: 'Opera hasta $500/día sin KYC. Conéctate con Privy, MetaMask, Trust, Binance Web3 Wallet o solo email + Google. 30 segundos para empezar.',
      lp_how_h2: 'Empieza a operar en menos de 60 segundos',
      lp_how_s1_h: 'Conecta billetera o regístrate', lp_how_s1_p: 'Billetera integrada Privy, MetaMask, Trust, Binance Web3 Wallet, o login con email + Google. Sin contraseña.',
      lp_how_s2_h: 'Deposita o haz swap', lp_how_s2_p: 'USDT en Tron por $1. O salta el depósito — haz swap on-chain vía 1inch directamente desde tu billetera.',
      lp_how_s3_h: 'Opera lo que quieras', lp_how_s3_p: 'BTC, ETH, SOL, BNB y más. Prueba primero las opciones binarias con saldo demo de $50K — riesgo cero.',
      lp_sec_badge: '🛡 Exchange con la seguridad primero', lp_sec_h2: 'Construido como un banco, rápido como un DEX',
      lp_sec_sub: 'La mayoría de exchanges nuevos arrancan prometiendo "añadiremos 2FA luego". Nosotros lanzamos con todo activado.',
      lp_sec_i1: '<b>🔑 Hot-wallet MPC</b>Ninguna llave privada única en un servidor. Comprometerla requiere varios fragmentos de llave de partes independientes.',
      lp_sec_i2: '<b>📧 Retiro en 3 pasos</b>OTP por email + 2FA TOTP + dirección en whitelist con espera de 24h tras añadirla. Fuerza bruta imposible.',
      lp_sec_i3: '<b>👁 Revisión manual</b>Los retiros sobre $10,000 requieren aprobación de admin con motivo registrado en un log de auditoría inmutable.',
      lp_sec_i4: '<b>❄ Almacenamiento en frío 90%+</b>El auto-barrido saca el excedente del hot wallet cada hora. Un multisig Gnosis Safe guarda el resto, offline.',
      lp_sec_i5: '<b>💰 Fondo de seguro</b>Un pool de USDT cubre liquidaciones con capital negativo en Futuros. Sin pérdidas socializadas entre usuarios.',
      lp_sec_i6: '<b>🔍 SOC 2 en progreso</b>Pruebas de penetración externas previstas con Trail of Bits para Q3 2026. Programa de bug bounty activo en el lanzamiento.',
      lp_final_h: '¿Listo para operar con inteligencia?', lp_final_sub: 'Híbrido CEX/DEX. Liquidez real. Seguridad de nivel bancario. Abre tu cuenta en 30 segundos — primera operación en 60.',
      lp_final_cta1: 'Empezar a operar →', lp_final_cta2: 'Entrar / Registrarse',
      lp_final_tiny: 'Sin depósito para la demo Binary · 8 redes · custodia híbrida · ejecución en submilisegundos · soporte 24/7',
    },
    ar: {
      nav_landing: 'الرئيسية', nav_home: 'الرئيسية', nav_dashboard: 'لوحة التحكم', top_brand_sub: 'Finance Hub',
      nav_spot: 'سبوت', nav_binary: 'خيارات', nav_wallet: 'المحفظة', nav_markets: 'الأسواق',
      nav_futures: 'العقود الآجلة', nav_referral: 'الإحالات', nav_history: 'السجل', nav_settings: 'الإعدادات',
      nav_help: 'المساعدة والدعم', wallet_deposit: 'إيداع', auth_logout: 'تسجيل الخروج', common_copy: 'نسخ',
      ref_share_x: 'مشاركة على X', badge_new: 'جديد', badge_hot: 'مميز', top_help: 'مساعدة',
      top_connect: 'ربط المحفظة', top_search_ph: 'بحث…', top_search_tip: 'بحث — ⌘K',
      sidebar_tour_title: 'جديد على GROM؟', sidebar_tour_desc: 'جولة 90 ثانية في منصة الخيارات الثنائية.', sidebar_tour_link: '▶ ابدأ الجولة',
      lp_hero_eyebrow: '⚡ منصة هجينة · سرعة CEX + حرية DEX',
      lp_hero_h1: 'تداول الكريبتو بسرعة <span>الفكرة</span>.',
      lp_hero_sub: 'سبوت · عقود آجلة · خيارات ثنائية · مبادلات على السلسلة. حساب واحد. تنفيذ في أجزاء من الميلي ثانية. مفاتيحك متى شئت. أمان بمستوى البنوك من اليوم الأول.',
      lp_hero_cta1: 'ابدأ التداول →', lp_hero_cta2: 'استكشف لوحة التحكم',
      lp_hero_trust1: '<b>8</b> شبكات', lp_hero_trust2: '<b>+365</b> زوج', lp_hero_trust3: '<b>87%</b> عائد الخيارات', lp_hero_trust4: '<b>×100</b> أقصى رافعة',
      lp_prod_spot_h: 'سبوت', lp_prod_spot_p: 'محرك مطابقة FIFO. سيولة مجمّعة من Binance · Kraken · Coinbase. صانع 5 نقاط أساس · آخذ 10 نقاط أساس. عمق دفتر الأوامر في الوقت الفعلي.', lp_prod_spot_cta: 'افتح منصة سبوت →',
      lp_prod_fut_h: 'العقود الآجلة', lp_prod_fut_p: 'عقود دائمة برافعة تصل إلى 100×. هامش متقاطع أو معزول. سعر التحديد · التمويل · التصفية · TP/SL — محرك مخاطر كامل لكل مركز.', lp_prod_fut_cta: 'افتح منصة العقود →',
      lp_prod_bo_h: 'الخيارات الثنائية', lp_prod_bo_p: 'انتهاءات 5ث · 15ث · 30ث · 1د · 5د · 15د. عائد 87% عند الربح. رصيد تجريبي 50 ألف دولار للتدريب — بلا إيداع وبلا KYC.', lp_prod_bo_cta: 'جرّب Binary الآن →',
      lp_why_h2: 'منصة الجيل القادم',
      lp_why_intro: 'معظم المنصات تجبرك على الاختيار: <b style="color:#e8f1fa">CEX</b> للسرعة لكن تتخلى عن مفاتيحك، أو <b style="color:#e8f1fa">DEX</b> للحفظ الذاتي لكن برسوم عالية ومبادلات بطيئة. GROM يمنحك الاثنين معًا.',
      lp_why_c1_h: 'حفظ هجين', lp_why_c1_p: 'أرصدة التداول محفوظة لتنفيذ فوري. مبادلات على السلسلة عبر 1inch — مفاتيحك ومعاملتك. بدّل بين الوضعين بنقرة واحدة.',
      lp_why_c2_h: 'أقصى درجات الأمان', lp_why_c2_p: 'محفظة ساخنة MPC · OTP بالبريد + 2FA TOTP · قائمة عناوين موثوقة 24س · مراجعة يدوية > 10 آلاف دولار · 90%+ في التخزين البارد · صندوق تأمين للتصفيات.',
      lp_why_c3_h: 'سيولة حقيقية', lp_why_c3_p: 'تغذية أسعار مجمّعة من أكبر 3 منصات (Binance · Kraken · Coinbase). بوت صانع السوق يحافظ على فروق 5–30 نقطة أساس. لا دفاتر أوامر فارغة من اليوم الأول.',
      lp_why_c4_h: 'متعدد السلاسل أصلاً', lp_why_c4_p: 'Ethereum · Arbitrum · Polygon · Base · BNB Chain · TRON · Bitcoin · Solana. أودع USDT على Tron مقابل دولار واحد. اسحب إلى أي عنوان.',
      lp_why_c5_h: 'أدوات احترافية', lp_why_c5_p: 'عمق دفتر الأوامر لحظيًا · شموع/خطوط · RSI · MACD · إشارات تدفق الأوامر · دفع WebSocket · مفاتيح API للمتداولين الخوارزميين.',
      lp_why_c6_h: 'بدء سهل', lp_why_c6_p: 'تداول حتى 500 دولار يوميًا بلا KYC. اتصل عبر Privy أو MetaMask أو Trust أو Binance Web3 Wallet أو بالبريد + Google. 30 ثانية للبدء.',
      lp_how_h2: 'ابدأ التداول في أقل من 60 ثانية',
      lp_how_s1_h: 'اربط محفظتك أو سجّل', lp_how_s1_p: 'محفظة Privy المدمجة أو MetaMask أو Trust أو Binance Web3 Wallet أو الدخول بالبريد + Google. لا حاجة لكلمة مرور.',
      lp_how_s2_h: 'أودع أو بادل', lp_how_s2_p: 'USDT على Tron مقابل دولار واحد. أو تخطَّ الإيداع — بادل على السلسلة عبر 1inch مباشرة من محفظتك.',
      lp_how_s3_h: 'تداول أي شيء', lp_how_s3_p: 'BTC وETH وSOL وBNB وغيرها. جرّب الخيارات الثنائية أولاً برصيد تجريبي 50 ألف دولار — بلا مخاطرة.',
      lp_sec_badge: '🛡 منصة الأمان أولاً', lp_sec_h2: 'مبنية كبنك، سريعة كـ DEX',
      lp_sec_sub: 'معظم المنصات الجديدة تنطلق بوعد "سنضيف 2FA لاحقًا". نحن انطلقنا وكل شيء مُفعّل.',
      lp_sec_i1: '<b>🔑 محفظة ساخنة MPC</b>لا مفتاح خاص واحد على الخادم. الاختراق يتطلب عدة أجزاء مفاتيح من جهات مستقلة.',
      lp_sec_i2: '<b>📧 سحب من 3 خطوات</b>OTP بالبريد + 2FA TOTP + عنوان موثوق بفترة انتظار 24 ساعة بعد إضافته. القوة الغاشمة مستحيلة.',
      lp_sec_i3: '<b>👁 مراجعة يدوية</b>السحوبات فوق 10,000 دولار تتطلب موافقة المشرف مع تسجيل السبب في سجل تدقيق غير قابل للتغيير.',
      lp_sec_i4: '<b>❄ تخزين بارد 90%+</b>المسح التلقائي ينقل الفائض من المحفظة الساخنة كل ساعة. يحتفظ Gnosis Safe متعدد التواقيع بالباقي دون اتصال.',
      lp_sec_i5: '<b>💰 صندوق تأمين</b>تجمع USDT يغطي تصفيات رأس المال السلبي على العقود الآجلة. لا خسائر مشتركة بين المستخدمين.',
      lp_sec_i6: '<b>🔍 SOC 2 قيد التنفيذ</b>اختبارات اختراق خارجية مخططة مع Trail of Bits في الربع الثالث 2026. برنامج مكافآت الأخطاء فعّال عند الإطلاق.',
      lp_final_h: 'مستعد للتداول بذكاء؟', lp_final_sub: 'هجين CEX/DEX. سيولة حقيقية. أمان بمستوى البنوك. افتح حسابك في 30 ثانية — أول صفقة خلال 60.',
      lp_final_cta1: 'ابدأ التداول →', lp_final_cta2: 'دخول / تسجيل',
      lp_final_tiny: 'لا إيداع لتجربة Binary · 8 شبكات · حفظ هجين · تنفيذ بأجزاء من الميلي ثانية · دعم 24/7',
    },
    zh: {
      nav_landing: '首页', nav_home: '首页', nav_dashboard: '仪表盘', top_brand_sub: 'Finance Hub',
      nav_spot: '现货', nav_binary: '二元期权', nav_wallet: '钱包', nav_markets: '市场',
      nav_futures: '合约', nav_referral: '推荐', nav_history: '历史', nav_settings: '设置',
      nav_help: '帮助与支持', wallet_deposit: '充值', auth_logout: '退出', common_copy: '复制',
      ref_share_x: '分享到 X', badge_new: '新', badge_hot: '热门', top_help: '帮助',
      top_connect: '连接钱包', top_search_ph: '搜索…', top_search_tip: '搜索 — ⌘K',
      sidebar_tour_title: '初次使用 GROM？', sidebar_tour_desc: '90 秒了解二元期权交易台。', sidebar_tour_link: '▶ 开始导览',
      lp_hero_eyebrow: '⚡ 混合交易所 · CEX 速度 + DEX 自由',
      lp_hero_h1: '以<span>思维</span>的速度交易加密货币。',
      lp_hero_sub: '现货 · 合约 · 二元期权 · 链上兑换。一个账户。亚毫秒级成交。随时掌握私钥。从第一天起即享银行级安全。',
      lp_hero_cta1: '开始交易 →', lp_hero_cta2: '查看仪表盘',
      lp_hero_trust1: '<b>8</b> 条链', lp_hero_trust2: '<b>365+</b> 交易对', lp_hero_trust3: '<b>87%</b> 二元收益', lp_hero_trust4: '<b>100×</b> 最高杠杆',
      lp_prod_spot_h: '现货', lp_prod_spot_p: 'FIFO 撮合引擎。聚合 Binance · Kraken · Coinbase 流动性。Maker 5 个基点 · Taker 10 个基点。实时订单簿深度。', lp_prod_spot_cta: '打开现货交易台 →',
      lp_prod_fut_h: '合约', lp_prod_fut_p: '永续合约，最高 100× 杠杆。全仓或逐仓保证金。标记价格 · 资金费 · 强平 · 止盈止损——每个仓位都有完整风控引擎。', lp_prod_fut_cta: '打开合约交易台 →',
      lp_prod_bo_h: '二元期权', lp_prod_bo_p: '5秒 · 15秒 · 30秒 · 1分 · 5分 · 15分到期。盈利赔付 87%。5 万美元模拟余额练习——无需充值，无需 KYC。', lp_prod_bo_cta: '立即体验二元 →',
      lp_why_h2: '下一代交易所',
      lp_why_intro: '大多数交易所迫使你二选一：选 <b style="color:#e8f1fa">CEX</b> 求速度却要交出私钥，或选 <b style="color:#e8f1fa">DEX</b> 自托管却面对高手续费和慢兑换。GROM 让你兼得。',
      lp_why_c1_h: '混合托管', lp_why_c1_p: '交易余额托管以实现即时成交。通过 1inch 进行链上兑换——你的私钥，你的交易。一键切换模式。',
      lp_why_c2_h: '极致安全', lp_why_c2_p: 'MPC 热钱包 · 邮箱 OTP + TOTP 双重验证 · 24 小时地址白名单 · 超过 1 万美元人工审核 · 90%+ 冷存储 · 强平保险基金。',
      lp_why_c3_h: '真实流动性', lp_why_c3_p: '聚合三大 CEX（Binance · Kraken · Coinbase）的价格源。做市机器人将价差维持在 5–30 个基点。开盘首日绝无空订单簿。',
      lp_why_c4_h: '原生多链', lp_why_c4_p: 'Ethereum · Arbitrum · Polygon · Base · BNB Chain · TRON · Bitcoin · Solana。在 Tron 上充值 USDT 仅需 1 美元。可提现至任意地址。',
      lp_why_c5_h: '专业工具', lp_why_c5_p: '实时订单簿深度 · K线/分时图 · RSI · MACD · 订单流信号 · WebSocket 推送 · 面向量化交易者的 API 密钥。',
      lp_why_c6_h: '轻松上手', lp_why_c6_p: '无需 KYC 每日可交易高达 500 美元。通过 Privy、MetaMask、Trust、Binance Web3 钱包，或仅用邮箱 + Google 连接。30 秒即可开始。',
      lp_how_h2: '60 秒内开始交易',
      lp_how_s1_h: '连接钱包或注册', lp_how_s1_p: 'Privy 内嵌钱包、MetaMask、Trust、Binance Web3 钱包，或邮箱 + Google 登录。无需密码。',
      lp_how_s2_h: '充值或兑换', lp_how_s2_p: '在 Tron 上充值 USDT 仅需 1 美元。或跳过充值——通过 1inch 直接从你的钱包链上兑换。',
      lp_how_s3_h: '交易一切', lp_how_s3_p: 'BTC、ETH、SOL、BNB 等。先用 5 万美元模拟余额体验二元期权——零风险。',
      lp_sec_badge: '🛡 安全优先的交易所', lp_sec_h2: '像银行一样稳健，像 DEX 一样快速',
      lp_sec_sub: '大多数新交易所开张时承诺"以后再加 2FA"。我们开张即全部启用。',
      lp_sec_i1: '<b>🔑 MPC 热钱包</b>服务器上没有单一私钥。攻破需要来自独立各方的多个密钥分片。',
      lp_sec_i2: '<b>📧 三步提现</b>邮箱 OTP + TOTP 双重验证 + 添加后有 24 小时冷却的白名单地址。暴力破解无从下手。',
      lp_sec_i3: '<b>👁 人工审核</b>超过 10,000 美元的提现需管理员批准，原因记录于不可篡改的审计日志。',
      lp_sec_i4: '<b>❄ 冷存储 90%+</b>自动归集每小时将多余资金移出热钱包。其余由多签 Gnosis Safe 离线保管。',
      lp_sec_i5: '<b>💰 保险基金</b>USDT 资金池覆盖合约的负权益强平。用户之间不分摊损失。',
      lp_sec_i6: '<b>🔍 SOC 2 进行中</b>计划于 2026 年第三季度与 Trail of Bits 进行外部渗透测试。漏洞赏金计划上线即启动。',
      lp_final_h: '准备好更聪明地交易了吗？', lp_final_sub: 'CEX/DEX 混合。真实流动性。银行级安全。30 秒开户——60 秒内完成首笔交易。',
      lp_final_cta1: '开始交易 →', lp_final_cta2: '登录 / 注册',
      lp_final_tiny: '二元模拟无需充值 · 8 条链 · 混合托管 · 亚毫秒成交 · 24/7 支持',
    },
    hi: {
      nav_landing: 'होम', nav_home: 'होम', nav_dashboard: 'डैशबोर्ड', top_brand_sub: 'Finance Hub',
      nav_spot: 'स्पॉट', nav_binary: 'ऑप्शंस', nav_wallet: 'वॉलेट', nav_markets: 'मार्केट',
      nav_futures: 'फ्यूचर्स', nav_referral: 'रेफ़रल', nav_history: 'इतिहास', nav_settings: 'सेटिंग्स',
      nav_help: 'सहायता और समर्थन', wallet_deposit: 'जमा करें', auth_logout: 'लॉग आउट', common_copy: 'कॉपी',
      ref_share_x: 'X पर शेयर करें', badge_new: 'नया', badge_hot: 'हॉट', top_help: 'सहायता',
      top_connect: 'वॉलेट कनेक्ट करें', top_search_ph: 'खोजें…', top_search_tip: 'खोज — ⌘K',
      sidebar_tour_title: 'GROM पर नए हैं?', sidebar_tour_desc: 'बाइनरी ऑप्शंस डेस्क का 90-सेकंड टूर।', sidebar_tour_link: '▶ टूर शुरू करें',
      lp_hero_eyebrow: '⚡ हाइब्रिड एक्सचेंज · CEX स्पीड + DEX फ्रीडम',
      lp_hero_h1: '<span>विचार</span> की गति से क्रिप्टो ट्रेड करें।',
      lp_hero_sub: 'स्पॉट · फ्यूचर्स · बाइनरी ऑप्शंस · ऑन-चेन स्वैप। एक अकाउंट। सब-मिलीसेकंड फिल। आपकी चाबियाँ जब चाहें। पहले दिन से बैंक-ग्रेड सुरक्षा।',
      lp_hero_cta1: 'ट्रेडिंग शुरू करें →', lp_hero_cta2: 'डैशबोर्ड देखें',
      lp_hero_trust1: '<b>8</b> चेन', lp_hero_trust2: '<b>365+</b> पेयर', lp_hero_trust3: '<b>87%</b> बाइनरी पेआउट', lp_hero_trust4: '<b>100×</b> अधिकतम लीवरेज',
      lp_prod_spot_h: 'स्पॉट', lp_prod_spot_p: 'FIFO मैचिंग इंजन। Binance · Kraken · Coinbase से एकत्रित लिक्विडिटी। मेकर 5 bps · टेकर 10 bps। रियल-टाइम ऑर्डरबुक डेप्थ।', lp_prod_spot_cta: 'स्पॉट डेस्क खोलें →',
      lp_prod_fut_h: 'फ्यूचर्स', lp_prod_fut_p: '100× तक लीवरेज वाले पर्पेचुअल। क्रॉस या आइसोलेटेड मार्जिन। मार्क प्राइस · फंडिंग · लिक्विडेशन · TP/SL — हर पोजीशन पर पूरा रिस्क इंजन।', lp_prod_fut_cta: 'फ्यूचर्स डेस्क खोलें →',
      lp_prod_bo_h: 'बाइनरी ऑप्शंस', lp_prod_bo_p: '5s · 15s · 30s · 1m · 5m · 15m एक्सपायरी। जीत पर 87% पेआउट। अभ्यास के लिए $50K डेमो बैलेंस — कोई जमा नहीं, कोई KYC नहीं।', lp_prod_bo_cta: 'अभी Binary आज़माएँ →',
      lp_why_h2: 'अगली पीढ़ी का एक्सचेंज',
      lp_why_intro: 'ज़्यादातर एक्सचेंज आपको चुनने पर मजबूर करते हैं: स्पीड के लिए <b style="color:#e8f1fa">CEX</b> पर अपनी चाबियाँ छोड़नी पड़ें, या सेल्फ-कस्टडी के लिए <b style="color:#e8f1fa">DEX</b> पर ऊँची फीस और धीमे स्वैप। GROM आपको दोनों देता है।',
      lp_why_c1_h: 'हाइब्रिड कस्टडी', lp_why_c1_p: 'तुरंत फिल के लिए ट्रेडिंग बैलेंस कस्टडी में। 1inch के ज़रिए ऑन-चेन स्वैप — आपकी चाबियाँ, आपका लेन-देन। एक क्लिक में मोड बदलें।',
      lp_why_c2_h: 'अधिकतम सुरक्षा', lp_why_c2_p: 'MPC हॉट-वॉलेट · ईमेल OTP + TOTP 2FA · 24घं एड्रेस व्हाइटलिस्ट · $10k से ऊपर मैनुअल समीक्षा · 90%+ कोल्ड स्टोरेज · लिक्विडेशन के लिए बीमा फंड।',
      lp_why_c3_h: 'असली लिक्विडिटी', lp_why_c3_p: 'टॉप-3 CEX (Binance · Kraken · Coinbase) से एकत्रित प्राइस फीड। मार्केट-मेकर बॉट स्प्रेड 5–30 bps रखता है। पहले दिन कोई खाली ऑर्डरबुक नहीं।',
      lp_why_c4_h: 'मल्टी-चेन नेटिव', lp_why_c4_p: 'Ethereum · Arbitrum · Polygon · Base · BNB Chain · TRON · Bitcoin · Solana। Tron पर $1 फीस में USDT जमा करें। किसी भी एड्रेस पर निकालें।',
      lp_why_c5_h: 'प्रो टूल्स', lp_why_c5_p: 'रियल-टाइम ऑर्डरबुक डेप्थ · कैंडल/लाइन चार्ट · RSI · MACD · ऑर्डर-फ्लो सिग्नल · WebSocket पुश · एल्गो ट्रेडर्स के लिए API कीज़।',
      lp_why_c6_h: 'आसान ऑनबोर्डिंग', lp_why_c6_p: 'बिना KYC रोज़ $500 तक ट्रेड करें। Privy, MetaMask, Trust, Binance Web3 Wallet, या सिर्फ़ ईमेल + Google से कनेक्ट करें। 30 सेकंड में शुरू।',
      lp_how_h2: '60 सेकंड से कम में ट्रेडिंग शुरू करें',
      lp_how_s1_h: 'वॉलेट कनेक्ट करें या साइन अप करें', lp_how_s1_p: 'Privy एम्बेडेड वॉलेट, MetaMask, Trust, Binance Web3 Wallet, या ईमेल + Google लॉगिन। पासवर्ड की ज़रूरत नहीं।',
      lp_how_s2_h: 'जमा करें या स्वैप करें', lp_how_s2_p: 'Tron पर $1 फीस में USDT। या जमा छोड़ें — 1inch के ज़रिए अपने वॉलेट से सीधे ऑन-चेन स्वैप करें।',
      lp_how_s3_h: 'कुछ भी ट्रेड करें', lp_how_s3_p: 'BTC, ETH, SOL, BNB और बहुत कुछ। पहले $50K डेमो बैलेंस के साथ बाइनरी ऑप्शंस आज़माएँ — शून्य जोखिम।',
      lp_sec_badge: '🛡 सुरक्षा-प्रथम एक्सचेंज', lp_sec_h2: 'बैंक जैसा मज़बूत, DEX जैसा तेज़',
      lp_sec_sub: 'ज़्यादातर नए एक्सचेंज "2FA बाद में जोड़ेंगे" के वादे के साथ लॉन्च होते हैं। हमने सब कुछ चालू करके लॉन्च किया।',
      lp_sec_i1: '<b>🔑 MPC हॉट-वॉलेट</b>सर्वर पर कोई एकल प्राइवेट की नहीं। सेंध के लिए स्वतंत्र पक्षों से कई की-शार्ड चाहिए।',
      lp_sec_i2: '<b>📧 3-चरण निकासी</b>ईमेल OTP + TOTP 2FA + जोड़ने के बाद 24-घंटे कूलडाउन वाला व्हाइटलिस्ट एड्रेस। ब्रूट-फोर्स असंभव।',
      lp_sec_i3: '<b>👁 मैनुअल समीक्षा</b>$10,000 से ऊपर की निकासी के लिए एडमिन की मंज़ूरी ज़रूरी, कारण अपरिवर्तनीय ऑडिट ट्रेल में दर्ज।',
      lp_sec_i4: '<b>❄ कोल्ड स्टोरेज 90%+</b>ऑटो-स्वीप हर घंटे हॉट वॉलेट से अतिरिक्त राशि हटाता है। बाकी मल्टी-सिग Gnosis Safe ऑफ़लाइन रखता है।',
      lp_sec_i5: '<b>💰 बीमा फंड</b>USDT पूल फ्यूचर्स पर नेगेटिव-इक्विटी लिक्विडेशन कवर करता है। उपयोगकर्ताओं के बीच साझा नुकसान नहीं।',
      lp_sec_i6: '<b>🔍 SOC 2 प्रगति पर</b>Trail of Bits के साथ बाहरी पेनिट्रेशन टेस्ट Q3 2026 के लिए नियोजित। लॉन्च पर बग बाउंटी प्रोग्राम सक्रिय।',
      lp_final_h: 'समझदारी से ट्रेड करने को तैयार?', lp_final_sub: 'हाइब्रिड CEX/DEX। असली लिक्विडिटी। बैंक-ग्रेड सुरक्षा। 30 सेकंड में अकाउंट खोलें — 60 में पहली ट्रेड।',
      lp_final_cta1: 'ट्रेडिंग शुरू करें →', lp_final_cta2: 'साइन इन / साइन अप',
      lp_final_tiny: 'Binary डेमो के लिए कोई जमा नहीं · 8 चेन · हाइब्रिड कस्टडी · सब-मिलीसेकंड फिल · 24/7 सहायता',
    },
    tr: {
      nav_landing: 'Ana sayfa', nav_home: 'Ana sayfa', nav_dashboard: 'Panel', top_brand_sub: 'Finance Hub',
      nav_spot: 'SPOT', nav_binary: 'OPSİYON', nav_wallet: 'Cüzdan', nav_markets: 'Piyasalar',
      nav_futures: 'Vadeli', nav_referral: 'Referanslar', nav_history: 'Geçmiş', nav_settings: 'Ayarlar',
      nav_help: 'Yardım ve destek', wallet_deposit: 'Para yatır', auth_logout: 'Çıkış', common_copy: 'Kopyala',
      ref_share_x: "X'te paylaş", badge_new: 'YENİ', badge_hot: 'POPÜLER', top_help: 'Yardım',
      top_connect: 'Cüzdan bağla', top_search_ph: 'Ara…', top_search_tip: 'Ara — ⌘K',
      sidebar_tour_title: "GROM'da yeni misiniz?", sidebar_tour_desc: 'İkili opsiyon masasının 90 saniyelik turu.', sidebar_tour_link: '▶ Tura başla',
      lp_hero_eyebrow: '⚡ Hibrit Borsa · CEX Hızı + DEX Özgürlüğü',
      lp_hero_h1: 'Kripto işlemlerini <span>düşünce</span> hızında yapın.',
      lp_hero_sub: 'Spot · Vadeli · İkili Opsiyon · Zincir üstü takas. Tek hesap. Milisaniyenin altında gerçekleşme. İstediğinizde anahtarlar sizde. İlk günden banka düzeyinde güvenlik.',
      lp_hero_cta1: 'İşleme başla →', lp_hero_cta2: 'Paneli keşfet',
      lp_hero_trust1: '<b>8</b> zincir', lp_hero_trust2: '<b>365+</b> parite', lp_hero_trust3: '<b>%87</b> ikili getiri', lp_hero_trust4: '<b>100×</b> maks. kaldıraç',
      lp_prod_spot_h: 'Spot', lp_prod_spot_p: "FIFO eşleştirme motoru. Binance · Kraken · Coinbase'den toplanan likidite. Maker 5 bps · Taker 10 bps. Gerçek zamanlı emir defteri derinliği.", lp_prod_spot_cta: 'Spot masasını aç →',
      lp_prod_fut_h: 'Vadeli', lp_prod_fut_p: "100×'e kadar kaldıraçlı sürekli sözleşmeler. Çapraz veya izole marj. Mark fiyatı · fonlama · likidasyon · TP/SL — her pozisyonda tam risk motoru.", lp_prod_fut_cta: 'Vadeli masasını aç →',
      lp_prod_bo_h: 'İkili Opsiyon', lp_prod_bo_p: 'Vadeler 5s · 15s · 30s · 1d · 5d · 15d. Kazançta %87 getiri. Pratik için 50.000 $ demo bakiye — yatırım yok, KYC yok.', lp_prod_bo_cta: "Binary'yi şimdi dene →",
      lp_why_h2: 'Yeni nesil borsa',
      lp_why_intro: 'Çoğu borsa sizi seçmeye zorlar: hız için <b style="color:#e8f1fa">CEX</b> ama anahtarlarınızdan vazgeçersiniz ya da öz saklama için <b style="color:#e8f1fa">DEX</b> ama yüksek ücretler ve yavaş takaslar. GROM ikisini birden sunar.',
      lp_why_c1_h: 'Hibrit saklama', lp_why_c1_p: 'Anında gerçekleşme için işlem bakiyeleri saklamada. 1inch ile zincir üstü takaslar — anahtarlar sizde, işlem sizin. Modlar arasında tek tıkla geçin.',
      lp_why_c2_h: 'Maksimum güvenlik', lp_why_c2_p: 'MPC sıcak cüzdan · E-posta OTP + TOTP 2FA · 24s adres beyaz listesi · 10 bin $ üzeri manuel inceleme · %90+ soğuk depolama · likidasyonlar için sigorta fonu.',
      lp_why_c3_h: 'Gerçek likidite', lp_why_c3_p: "İlk 3 CEX'ten (Binance · Kraken · Coinbase) toplanan fiyat akışı. Piyasa yapıcı bot spreadleri 5–30 bps tutar. İlk günden boş emir defteri yok.",
      lp_why_c4_h: 'Doğal çoklu zincir', lp_why_c4_p: 'Ethereum · Arbitrum · Polygon · Base · BNB Chain · TRON · Bitcoin · Solana. Tron üzerinde 1 $ ücretle USDT yatırın. Herhangi bir adrese çekin.',
      lp_why_c5_h: 'Pro araçlar', lp_why_c5_p: 'Gerçek zamanlı emir defteri derinliği · mum/çizgi grafikler · RSI · MACD · emir akışı sinyalleri · WebSocket push · algoritmik yatırımcılar için API anahtarları.',
      lp_why_c6_h: 'Kolay başlangıç', lp_why_c6_p: "KYC olmadan günde 500 $'a kadar işlem yapın. Privy, MetaMask, Trust, Binance Web3 Wallet veya yalnızca e-posta + Google ile bağlanın. 30 saniyede başlayın.",
      lp_how_h2: '60 saniyeden kısa sürede işleme başlayın',
      lp_how_s1_h: 'Cüzdan bağla veya kaydol', lp_how_s1_p: 'Privy gömülü cüzdan, MetaMask, Trust, Binance Web3 Wallet ya da e-posta + Google girişi. Şifre gerekmez.',
      lp_how_s2_h: 'Yatır veya takas et', lp_how_s2_p: 'Tron üzerinde 1 $ ücretle USDT. Ya da yatırımı atlayın — 1inch ile doğrudan kendi cüzdanınızdan zincir üstü takas yapın.',
      lp_how_s3_h: 'Her şeyi işle', lp_how_s3_p: 'BTC, ETH, SOL, BNB ve daha fazlası. Önce 50.000 $ demo bakiyeyle İkili Opsiyonları deneyin — sıfır risk.',
      lp_sec_badge: '🛡 Güvenlik öncelikli borsa', lp_sec_h2: 'Banka gibi sağlam, DEX gibi hızlı',
      lp_sec_sub: 'Çoğu yeni borsa "2FA\'yı sonra ekleriz" sözüyle açılır. Biz her şey açıkken başladık.',
      lp_sec_i1: '<b>🔑 MPC sıcak cüzdan</b>Sunucuda tek bir özel anahtar yok. Ele geçirmek için bağımsız taraflardan birden çok anahtar parçası gerekir.',
      lp_sec_i2: '<b>📧 3 adımlı çekim</b>E-posta OTP + TOTP 2FA + eklendikten sonra 24 saat bekleme süreli beyaz listede adres. Kaba kuvvet imkânsız.',
      lp_sec_i3: '<b>👁 Manuel inceleme</b>10.000 $ üzeri çekimler, nedeni değiştirilemez denetim kaydına işlenerek yönetici onayı gerektirir.',
      lp_sec_i4: '<b>❄ Soğuk depolama %90+</b>Otomatik süpürme her saat fazlalığı sıcak cüzdandan çıkarır. Geri kalanını çoklu imzalı Gnosis Safe çevrimdışı tutar.',
      lp_sec_i5: '<b>💰 Sigorta fonu</b>USDT havuzu Vadeli\'deki negatif öz sermaye likidasyonlarını karşılar. Kullanıcılar arasında paylaştırılan zarar yok.',
      lp_sec_i6: '<b>🔍 SOC 2 sürüyor</b>Trail of Bits ile dış sızma testleri 2026 3. çeyrek için planlandı. Hata ödül programı lansmanda aktif.',
      lp_final_h: 'Daha akıllı işlem yapmaya hazır mısınız?', lp_final_sub: 'Hibrit CEX/DEX. Gerçek likidite. Banka düzeyinde güvenlik. 30 saniyede hesap açın — 60 saniyede ilk işlem.',
      lp_final_cta1: 'İşleme başla →', lp_final_cta2: 'Giriş / Kayıt',
      lp_final_tiny: 'Binary demo için yatırım gerekmez · 8 zincir · hibrit saklama · milisaniye altı gerçekleşme · 7/24 destek',
    },
  };

  var SUPPORTED = ['ru', 'en', 'es', 'ar', 'zh', 'hi', 'tr'];
  var LANG_BTNS = { langRu: 'ru', langEn: 'en', langEs: 'es', langAr: 'ar', langZh: 'zh', langHi: 'hi', langTr: 'tr' };

  function getLang() {
    var s = localStorage.getItem('grom_lang');
    if (SUPPORTED.indexOf(s) !== -1) return s;
    var nav = (navigator.language || '').toLowerCase();
    for (var i = 0; i < SUPPORTED.length; i++) {
      if (nav.indexOf(SUPPORTED[i]) === 0) return SUPPORTED[i];
    }
    return 'en';
  }

  function syncLangButtons(lng) {
    Object.keys(LANG_BTNS).forEach(function (id) {
      var b = document.getElementById(id);
      if (b) b.classList.toggle('active', LANG_BTNS[id] === lng);
    });
  }

  function setLang(lng) {
    if (SUPPORTED.indexOf(lng) === -1) return;
    localStorage.setItem('grom_lang', lng);
    document.documentElement.lang = lng;
    // Keep LTR layout for the trading desks; per-element Unicode bidi still
    // renders Arabic text right-to-left within its own boxes.
    applyI18n();
    syncLangButtons(lng);
  }

  function t(key) {
    var L = STR[getLang()] || STR.en;
    return L[key] != null ? L[key] : (STR.en[key] || key);
  }

  function applyI18n() {
    var L = STR[getLang()] || STR.en;
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      if (el.id === 'walletLabel' && localStorage.getItem('grom_jwt')) return;
      var k = el.getAttribute('data-i18n');
      if (k && L[k]) el.textContent = L[k];
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
      var k = el.getAttribute('data-i18n-placeholder');
      if (k && L[k]) el.placeholder = L[k];
    });
    document.querySelectorAll('[data-i18n-html]').forEach(function (el) {
      var k = el.getAttribute('data-i18n-html');
      if (k && L[k]) el.innerHTML = L[k];
    });
    document.querySelectorAll('[data-i18n-tip]').forEach(function (el) {
      var k = el.getAttribute('data-i18n-tip');
      if (k && L[k]) {
        el.setAttribute('title', L[k]);
        el.setAttribute('aria-label', L[k]);
      }
    });
    document.querySelectorAll('[data-i18n-alt]').forEach(function (el) {
      var k = el.getAttribute('data-i18n-alt');
      if (k && L[k]) el.setAttribute('alt', L[k]);
    });
  }

  window.getGromLang = getLang;
  window.setGromLang = setLang;
  window.t = t;
  window.applyI18n = applyI18n;
  window.GROM_STR = STR;

  function closeLangPopover() {
    var pop = document.getElementById('langPopover');
    var btn = document.getElementById('langGlobeBtn');
    if (pop) pop.hidden = true;
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }

  function toggleLangPopover() {
    var pop = document.getElementById('langPopover');
    var btn = document.getElementById('langGlobeBtn');
    if (!pop || !btn) return;
    var open = pop.hidden;
    pop.hidden = !open;
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.documentElement.lang = getLang();
    Object.keys(LANG_BTNS).forEach(function (id) {
      var btn = document.getElementById(id);
      if (btn) btn.addEventListener('click', function () {
        setLang(LANG_BTNS[id]);
        closeLangPopover();
      });
    });
    syncLangButtons(getLang());

    var globe = document.getElementById('langGlobeBtn');
    if (globe) {
      globe.addEventListener('click', function (e) {
        e.stopPropagation();
        toggleLangPopover();
      });
    }
    document.addEventListener('click', function () { closeLangPopover(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeLangPopover();
    });

    applyI18n();
  });
})();
