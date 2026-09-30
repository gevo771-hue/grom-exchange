/**
 * GROM multilingual SEO — landing blocks, route meta, hreflang.
 * Loaded after grom-i18n.js; crawlers see all language blocks in DOM.
 */
(function () {
  'use strict';

  var LANGS = ['en', 'ru', 'es', 'de', 'ko', 'zh', 'ja', 'fr', 'pt', 'ar', 'tr', 'hi', 'vi', 'id', 'th', 'pl', 'uk', 'it'];

  var HREFLANG = {
    en: 'en', ru: 'ru', es: 'es', de: 'de', ko: 'ko', zh: 'zh-Hans',
    ja: 'ja', fr: 'fr', pt: 'pt', ar: 'ar', tr: 'tr', hi: 'hi',
    vi: 'vi', id: 'id', th: 'th', pl: 'pl', uk: 'uk', it: 'it',
  };

  /* Only these locales have canonical, pre-rendered SEO routes and sitemap URLs. */
  var SEO_LOCALE_PREFIX = {
    en: '', es: '/es', 'pt-BR': '/pt-BR', tr: '/tr', ru: '/ru', vi: '/vi', id: '/id',
  };
  var SEO_ROUTE_PATH = {
    landing: '/', dashboard: '/swap', markets: '/markets',
    futures: '/futures', predict: '/predict', xstocks: '/stocks',
  };

  function normalizeLang(code) {
    var value = String(code || '').toLowerCase();
    return value === 'pt-br' ? 'pt' : value;
  }

  function blk(label, htmlLang, h2, intro, kw, links) {
    return { label: label, htmlLang: htmlLang, h2: h2, intro: intro, kw: kw, links: links };
  }

  var BLOCKS = {
    en: blk('English', 'en',
      'Crypto DEX, futures, prediction markets & tokenized stocks',
      'GROM is a non-custodial crypto hub for cross-chain swaps, spot trading, perpetual futures, prediction markets, and tokenized stocks (RWA) — all from your own wallet.',
      [
        { t: 'Crypto & DEX', p: 'Decentralized exchange, swap crypto, cross-chain routing, wallet-first trading, live crypto prices.' },
        { t: 'Futures (Perps)', p: 'Crypto futures, perpetual futures, BTC/ETH leverage, spot and perp in one terminal.' },
        { t: 'Prediction markets', p: 'Event forecasts with wallet funding — crypto, sports, politics, and more when listed.' },
        { t: 'Stocks', p: 'Tokenized stocks and RWA equity exposure, fractional sizes, from your crypto wallet.' },
      ],
      { markets: 'Open Markets', trade: 'Spot & Futures', stocks: 'Stocks', predict: 'Predictions', help: 'Help' }),

    ru: blk('Русский', 'ru',
      'Крипто DEX, фьючерсы, рынки прогнозов и токенизированные акции',
      'GROM — некастодиальный крипто-хаб: кросс-чейн свопы, спот, бессрочные фьючерсы, токенизированные акции и рынки прогнозов в стиле Polymarket и Kalshi.',
      [
        { t: 'Крипто и DEX', p: 'Децентрализованная биржа, обмен криптовалют, кросс-чейн мост, торговля через кошелёк, цены BTC ETH SOL.' },
        { t: 'Фьючерсы', p: 'Крипто фьючерсы, perpetual, плечо на BTC/ETH, спот и перпы в одном терминале.' },
        { t: 'Прогнозы', p: 'Рынки событий, вероятности по крипте, спорту и политике, аналог Polymarket и Kalshi.' },
        { t: 'Акции', p: 'Токенизированные акции, S&P/NASDAQ, долевой доступ к акциям из крипто-кошелька.' },
      ],
      { markets: 'Рынки', trade: 'Спот и фьючерсы', stocks: 'Акции', predict: 'Прогнозы', help: 'Помощь' }),

    es: blk('Español', 'es',
      'DEX cripto, futuros, mercados de predicción y acciones tokenizadas',
      'GROM es un hub cripto no custodial: swaps cross-chain, spot, futuros perpetuos, acciones tokenizadas y mercados de predicción al estilo Polymarket y Kalshi.',
      [
        { t: 'Cripto y DEX', p: 'Exchange descentralizado, swap cripto, puente cross-chain, trading con wallet, precios en vivo.' },
        { t: 'Futuros', p: 'Futuros cripto, perpetuos, apalancamiento BTC/ETH, spot y perps en un terminal.' },
        { t: 'Predicciones', p: 'Pronósticos de eventos, probabilidades cripto/deportes/política, flujos tipo Polymarket.' },
        { t: 'Acciones', p: 'Acciones tokenizadas, exposición S&P/NASDAQ, trading fraccionado desde wallet.' },
      ],
      { markets: 'Mercados', trade: 'Spot y futuros', stocks: 'Acciones', predict: 'Predicciones', help: 'Ayuda' }),

    de: blk('Deutsch', 'de',
      'Krypto-DEX, Futures, Prognosemärkte & tokenisierte Aktien',
      'GROM ist ein nicht-verwahrter Krypto-Hub: Cross-Chain-Swaps, Spot, Perpetual-Futures, tokenisierte Aktien und Prognosemärkte im Polymarket/Kalshi-Stil.',
      [
        { t: 'Krypto & DEX', p: 'Dezentrale Börse, Krypto tauschen, Cross-Chain-Brücke, Wallet-Trading, Live-Kurse.' },
        { t: 'Futures', p: 'Krypto-Futures, Perpetuals, BTC/ETH Hebel, Spot und Perps in einem Terminal.' },
        { t: 'Prognosen', p: 'Event-Prognosen, Wahrscheinlichkeiten Krypto/Sport/Politik, Polymarket-ähnliche Flows.' },
        { t: 'Aktien', p: 'Tokenisierte Aktien, S&P/NASDAQ, Bruchteile handeln aus der Wallet.' },
      ],
      { markets: 'Märkte', trade: 'Spot & Futures', stocks: 'Aktien', predict: 'Prognosen', help: 'Hilfe' }),

    ko: blk('한국어', 'ko',
      '크립토 DEX, 선물, 예측 시장 및 토큰화 주식',
      'GROM은 비수탁 크립토 허브입니다. 크로스체인 스왑, 현물, 무기한 선물, 토큰화 주식, Polymarket·Kalshi 스타일 예측 시장을 제공합니다.',
      [
        { t: '크립토 & DEX', p: '탈중앙화 거래소, 크립토 스왑, 크로스체인 브릿지, 지갑 거래, 실시간 시세.' },
        { t: '선물', p: '크립토 선물, 무기한 선물, BTC/ETH 레버리지, 현물·선물 통합 터미널.' },
        { t: '예측 시장', p: '이벤트 예측, 크립토·스포츠·정치 확률, Polymarket 스타일 플로우.' },
        { t: '주식', p: '토큰화 주식, S&P/NASDAQ 노출, 지갑에서 분할 주식 거래.' },
      ],
      { markets: '시장', trade: '현물·선물', stocks: '주식', predict: '예측', help: '도움말' }),

    zh: blk('中文', 'zh-Hans',
      '加密 DEX、期货、预测市场与代币化股票',
      'GROM 是非托管加密金融枢纽：跨链兑换、现货、永续期货、代币化股票，以及 Polymarket 和 Kalshi 风格的预测市场。',
      [
        { t: '加密与 DEX', p: '去中心化交易所、加密兑换、跨链桥、钱包交易、实时行情。' },
        { t: '期货', p: '加密期货、永续合约、BTC/ETH 杠杆、现货与合约一体终端。' },
        { t: '预测市场', p: '事件预测、加密/体育/政治概率、Polymarket 风格流程。' },
        { t: '股票', p: '代币化股票、、标普/纳斯达克敞口、钱包分额交易。' },
      ],
      { markets: '市场', trade: '现货与期货', stocks: '股票', predict: '预测', help: '帮助' }),

    ja: blk('日本語', 'ja',
      '暗号DEX・先物・予測市場・トークン化株式',
      'GROMは非カストディアル暗号ハブです。クロスチェーンスワップ、現物、パーペチュアル先物、トークン化株式、Polymarket/Kalshi型予測市場に対応。',
      [
        { t: '暗号 & DEX', p: '分散型取引所、暗号スワップ、クロスチェーンブリッジ、ウォレット取引、ライブ価格。' },
        { t: '先物', p: '暗号先物、パーペチュアル、BTC/ETHレバレッジ、現物と先物を一体表示。' },
        { t: '予測市場', p: 'イベント予測、暗号/スポーツ/政治の確率、Polymarket型フロー。' },
        { t: '株式', p: 'トークン化株式、、S&P/NASDAQ、ウォレットから分割取引。' },
      ],
      { markets: 'マーケット', trade: '現物・先物', stocks: '株式', predict: '予測', help: 'ヘルプ' }),

    fr: blk('Français', 'fr',
      'DEX crypto, futures, marchés prédictifs & actions tokenisées',
      'GROM est un hub crypto non custodial : swaps cross-chain, spot, futures perpétuels, actions tokenisées et marchés prédictifs style Polymarket/Kalshi.',
      [
        { t: 'Crypto & DEX', p: 'Exchange décentralisé, swap crypto, pont cross-chain, trading wallet, prix en direct.' },
        { t: 'Futures', p: 'Futures crypto, perpétuels, levier BTC/ETH, spot et perps dans un terminal.' },
        { t: 'Prédictions', p: 'Prévisions d\'événements, probabilités crypto/sport/politique, flux type Polymarket.' },
        { t: 'Actions', p: 'Actions tokenisées, exposition S&P/NASDAQ, trading fractionné via wallet.' },
      ],
      { markets: 'Marchés', trade: 'Spot & futures', stocks: 'Actions', predict: 'Prédictions', help: 'Aide' }),

    pt: blk('Português', 'pt',
      'DEX cripto, futuros, mercados de previsão e ações tokenizadas',
      'GROM é um hub cripto não custodial: swaps cross-chain, spot, futuros perpétuos, ações tokenizadas e mercados de previsão estilo Polymarket/Kalshi.',
      [
        { t: 'Cripto & DEX', p: 'Exchange descentralizada, swap cripto, ponte cross-chain, trading via wallet, preços ao vivo.' },
        { t: 'Futuros', p: 'Futuros cripto, perpétuos, alavancagem BTC/ETH, spot e perps num terminal.' },
        { t: 'Previsões', p: 'Previsões de eventos, probabilidades cripto/esporte/política, fluxos tipo Polymarket.' },
        { t: 'Ações', p: 'Ações tokenizadas, exposição S&P/NASDAQ, trading fracionado na wallet.' },
      ],
      { markets: 'Mercados', trade: 'Spot e futuros', stocks: 'Ações', predict: 'Previsões', help: 'Ajuda' }),

    ar: blk('العربية', 'ar',
      'DEX للعملات المشفرة، العقود الآجلة، أسواق التوقعات والأسهم المرمّزة',
      'GROM مركز تداول غير حاضن: مبادلات cross-chain، سبوت، عقود دائمة، أسهم مرمّزة وأسواق توقعات بأسلوب Polymarket وKalshi.',
      [
        { t: 'العملات و DEX', p: 'بورصة لامركزية، مبادلة كريبتو، جسر cross-chain، تداول بالمحفظة، أسعار مباشرة.' },
        { t: 'العقود الآجلة', p: 'عقود كريبتو، دائمة، رافعة BTC/ETH، سبوت وperps في محطة واحدة.' },
        { t: 'أسواق التوقعات', p: 'توقعات الأحداث، احتمالات كريبتو/رياضة/سياسة، تدفقات شبيهة بـ Polymarket.' },
        { t: 'الأسهم', p: 'أسهم مرمّزة،، تعرض S&P/NASDAQ، تداول جزئي من المحفظة.' },
      ],
      { markets: 'الأسواق', trade: 'سبوت وعقود', stocks: 'أسهم', predict: 'توقعات', help: 'مساعدة' }),

    tr: blk('Türkçe', 'tr',
      'Kripto DEX, vadeli işlemler, tahmin piyasaları ve tokenize hisseler',
      'GROM, saklamasız kripto merkezidir: cross-chain swap, spot, sürekli vadeli, tokenize hisseler ve Polymarket/Kalshi tarzı tahmin piyasaları.',
      [
        { t: 'Kripto & DEX', p: 'Merkeziyetsiz borsa, kripto swap, cross-chain köprü, cüzdan ile işlem, canlı fiyatlar.' },
        { t: 'Vadeli', p: 'Kripto vadeli, perpetual, BTC/ETH kaldıraç, spot ve perps tek terminalde.' },
        { t: 'Tahminler', p: 'Etkinlik tahminleri, kripto/spor/siyaset olasılıkları, Polymarket tarzı akış.' },
        { t: 'Hisseler', p: 'Tokenize hisseler, S&P/NASDAQ maruziyeti, cüzdandan kesirli işlem.' },
      ],
      { markets: 'Piyasalar', trade: 'Spot & vadeli', stocks: 'Hisseler', predict: 'Tahminler', help: 'Yardım' }),

    hi: blk('हिन्दी', 'hi',
      'क्रिप्टो DEX, फ्यूचर्स, भविष्यवाणी बाज़ार और टोकनाइज़्ड स्टॉक',
      'GROM एक non-custodial क्रिप्टो हब है: cross-chain swap, spot, perpetual futures, tokenized stocks और Polymarket/Kalshi शैली prediction markets.',
      [
        { t: 'क्रिप्टो & DEX', p: 'विकेंद्रीकृत एक्सचेंज, क्रिप्टो swap, cross-chain ब्रिज, wallet ट्रेडिंग, live कीमतें।' },
        { t: 'फ्यूचर्स', p: 'क्रिप्टो futures, perpetual, BTC/ETH leverage, spot और perps एक टर्मिनल में।' },
        { t: 'भविष्यवाणी', p: 'इवेंट forecasts, crypto/sports/politics probabilities, Polymarket-style flows.' },
        { t: 'स्टॉक', p: 'Tokenized stocks, S&P/NASDAQ exposure, wallet से fractional trading.' },
      ],
      { markets: 'मार्केट', trade: 'Spot & Futures', stocks: 'स्टॉक', predict: 'Predictions', help: 'मदद' }),

    vi: blk('Tiếng Việt', 'vi',
      'DEX crypto, hợp đồng tương lai, thị trường dự đoán & cổ phiếu token hóa',
      'GROM là trung tâm crypto không giữ hộ: swap cross-chain, spot, futures vĩnh viễn, cổ phiếu token hóa và thị trường dự đoán kiểu Polymarket/Kalshi.',
      [
        { t: 'Crypto & DEX', p: 'Sàn phi tập trung, swap crypto, cầu cross-chain, giao dịch ví, giá trực tiếp.' },
        { t: 'Futures', p: 'Futures crypto, perpetual, đòn bẩy BTC/ETH, spot và perps một terminal.' },
        { t: 'Dự đoán', p: 'Dự báo sự kiện, xác suất crypto/thể thao/chính trị, luồng kiểu Polymarket.' },
        { t: 'Cổ phiếu', p: 'Cổ phiếu token hóa, S&P/NASDAQ, giao dịch phân đoạn từ ví.' },
      ],
      { markets: 'Thị trường', trade: 'Spot & futures', stocks: 'Cổ phiếu', predict: 'Dự đoán', help: 'Trợ giúp' }),

    id: blk('Bahasa Indonesia', 'id',
      'DEX kripto, futures, pasar prediksi & saham tokenisasi',
      'GROM adalah hub kripto non-kustodial: swap cross-chain, spot, futures perpetual, saham tokenisasi, dan pasar prediksi gaya Polymarket/Kalshi.',
      [
        { t: 'Kripto & DEX', p: 'Exchange terdesentralisasi, swap kripto, jembatan cross-chain, trading wallet, harga live.' },
        { t: 'Futures', p: 'Futures kripto, perpetual, leverage BTC/ETH, spot dan perps satu terminal.' },
        { t: 'Prediksi', p: 'Prakiraan event, probabilitas kripto/olahraga/politik, alur ala Polymarket.' },
        { t: 'Saham', p: 'Saham tokenisasi, eksposur S&P/NASDAQ, trading fraksional dari wallet.' },
      ],
      { markets: 'Pasar', trade: 'Spot & futures', stocks: 'Saham', predict: 'Prediksi', help: 'Bantuan' }),

    th: blk('ไทย', 'th',
      'DEX คริปโต, ฟิวเจอร์ส, ตลาดทำนาย & หุ้นโทเคนไนซ์',
      'GROM เป็นศูนย์กลางคริปโต แบบ non-custodial: swap cross-chain, spot, perpetual futures, หุ้นโทเคนไนซ์ และตลาดทำนายแบบ Polymarket/Kalshi',
      [
        { t: 'คริปโต & DEX', p: 'แลกเปลี่ยนกระจายศูนย์, swap คริปโต, สะพาน cross-chain, เทรดผ่าน wallet, ราคาสด' },
        { t: 'ฟิวเจอร์ส', p: 'ฟิวเจอร์สคริปโต, perpetual, leverage BTC/ETH, spot และ perps ในเทอร์มินัลเดียว' },
        { t: 'ทำนาย', p: 'พยากรณ์เหตุการณ์, ความน่าจะเป็น crypto/กีฬา/การเมือง, โฟลว์แบบ Polymarket' },
        { t: 'หุ้น', p: 'หุ้นโทเคนไนซ์, S&P/NASDAQ, เทรดแบบแบ่งส่วนจาก wallet' },
      ],
      { markets: 'ตลาด', trade: 'Spot & futures', stocks: 'หุ้น', predict: 'ทำนาย', help: 'ช่วยเหลือ' }),

    pl: blk('Polski', 'pl',
      'Krypto DEX, futures, rynki predykcji i tokenizowane akcje',
      'GROM to niekustodialny hub krypto: swapy cross-chain, spot, perpetual futures, tokenizowane akcje i rynki predykcji w stylu Polymarket/Kalshi.',
      [
        { t: 'Krypto & DEX', p: 'Zdecentralizowana giełda, swap krypto, most cross-chain, trading z wallet, ceny na żywo.' },
        { t: 'Futures', p: 'Futures krypto, perpetual, dźwignia BTC/ETH, spot i perps w jednym terminalu.' },
        { t: 'Predykcje', p: 'Prognozy wydarzeń, prawdopodobieństwa krypto/sport/polityka, flow jak Polymarket.' },
        { t: 'Akcje', p: 'Tokenizowane akcje, ekspozycja S&P/NASDAQ, ułamkowy trading z wallet.' },
      ],
      { markets: 'Rynki', trade: 'Spot i futures', stocks: 'Akcje', predict: 'Predykcje', help: 'Pomoc' }),

    uk: blk('Українська', 'uk',
      'Крипто DEX, ф\'ючерси, ринки прогнозів і токенізовані акції',
      'GROM — некастodialний крипто-хаб: cross-chain свопи, спот, безстрокові ф\'ючерси, токенізовані акції та ринки прогнозів у стилі Polymarket і Kalshi.',
      [
        { t: 'Крипто та DEX', p: 'Децентралізована біржа, обмін криптовалют, cross-chain міст, торгівля через гаманець, ціни BTC ETH.' },
        { t: 'Ф\'ючерси', p: 'Крипто ф\'ючерси, perpetual, плече BTC/ETH, спот і перпи в одному терміналі.' },
        { t: 'Прогнози', p: 'Ринки подій, ймовірності крипто/спорт/політика, аналог Polymarket і Kalshi.' },
        { t: 'Акції', p: 'Токенізовані акції, S&P/NASDAQ, частковий доступ до акцій з крипто-гаманця.' },
      ],
      { markets: 'Ринки', trade: 'Спот і ф\'ючерси', stocks: 'Акції', predict: 'Прогнози', help: 'Допомога' }),

    it: blk('Italiano', 'it',
      'DEX crypto, futures, mercati predittivi e azioni tokenizzate',
      'GROM è un hub crypto non custodial: swap cross-chain, spot, futures perpetui, azioni tokenizzate e mercati predittivi stile Polymarket/Kalshi.',
      [
        { t: 'Crypto & DEX', p: 'Exchange decentralizzato, swap crypto, bridge cross-chain, trading wallet, prezzi live.' },
        { t: 'Futures', p: 'Futures crypto, perpetual, leva BTC/ETH, spot e perps in un terminale.' },
        { t: 'Previsioni', p: 'Previsioni eventi, probabilità crypto/sport/politica, flussi tipo Polymarket.' },
        { t: 'Azioni', p: 'Azioni tokenizzate, esposizione S&P/NASDAQ, trading frazionato da wallet.' },
      ],
      { markets: 'Mercati', trade: 'Spot e futures', stocks: 'Azioni', predict: 'Previsioni', help: 'Aiuto' }),
  };

  var PAGE_BLURBS = {
    predict: {
      en: 'Prediction markets on GROM — live probabilities on crypto, sports, and politics. Your stake stays in your wallet — no top-up of someone else\'s balance.',
      ru: 'Рынки прогнозов GROM — live-вероятности по крипте, спорту и политике. Ставка идёт с твоего кошелька, без пополнения чужого баланса.',
      es: 'Mercados de predicción en GROM — probabilidades en vivo sobre cripto, deportes y política. La apuesta sale de tu wallet, sin recargar el saldo de nadie.',
      de: 'Prognosemärkte auf GROM — Live-Wahrscheinlichkeiten für Krypto, Sport und Politik. Einsatz aus deiner Wallet — ohne fremdes Guthaben aufzuladen.',
      ko: 'GROM 예측 시장 — 크립토·스포츠·정치 실시간 확률. 스테이크는 내 지갑에서, 남의 잔고 충전 없음.',
      zh: 'GROM 预测市场 — 加密、体育、政治实时概率。下注来自你的钱包，无需向他人账户充值。',
      ja: 'GROM予測市場 — 暗号・スポーツ・政治のライブ確率。賭けは自分のウォレットから。他人の残高への入金は不要。',
      fr: 'Marchés prédictifs GROM — probabilités live crypto, sport, politique. La mise part de ton wallet, sans recharger le solde d\'un tiers.',
      pt: 'Mercados de previsão GROM — probabilidades ao vivo em cripto, esporte e política. A aposta sai da sua wallet, sem depositar no saldo de ninguém.',
      ar: 'أسواق التوقعات على GROM — احتمالات مباشرة للعملات والرياضة والسياسة. الرهان من محفظتك دون شحن رصيد طرف آخر.',
      tr: 'GROM tahmin piyasaları — kripto, spor ve siyasette canlı olasılıklar. Bahis cüzdanından — başkasının bakiyesine yatırma yok.',
      hi: 'GROM prediction markets — crypto, sports, politics live probabilities. Stake from your wallet — no topping up anyone else\'s balance.',
      vi: 'Thị trường dự đoán GROM — xác suất trực tiếp crypto, thể thao, chính trị. Cược từ ví của bạn, không nạp vào số dư của người khác.',
      id: 'Pasar prediksi GROM — probabilitas live kripto, olahraga, politik. Taruhan dari wallet Anda — tanpa top-up saldo orang lain.',
      th: 'ตลาดทำนาย GROM — ความน่าจะเป็นสด crypto กีฬา การเมือง เดิมพันจากกระเป๋าคุณ ไม่ต้องเติมยอดของคนอื่น',
      pl: 'Rynki predykcji GROM — live prawdopodobieństwa krypto, sport, polityka. Stawka z Twojego wallet — bez doładowania cudzego salda.',
      uk: 'Ринки прогнозів GROM — live-ймовірності з крипто, спорту та політики. Ставка з твого гаманця, без поповнення чужого балансу.',
      it: 'Mercati predittivi GROM — probabilità live su crypto, sport, politica. La puntata esce dal tuo wallet, senza ricaricare il saldo altrui.',
    },
    xstocks: {
      en: 'Tokenized stocks — trade S&P 500 and NASDAQ names straight from your wallet, without a broker, anytime.',
      ru: 'Токенизированные акции — торгуйте бумагами S&P 500 и NASDAQ прямо из своего кошелька, без брокера и в любое время.',
      es: 'Acciones tokenizadas — opera nombres del S&P 500 y NASDAQ desde tu wallet, sin broker, a cualquier hora.',
      de: 'Tokenisierte Aktien — handele S&P 500- und NASDAQ-Titel direkt aus der Wallet, ohne Broker, jederzeit.',
      ko: '토큰화 주식 — 중개인 없이 지갑에서 언제든 S&P 500·NASDAQ 종목을 거래하세요.',
      zh: '代币化股票 — 无需券商，随时从钱包交易标普与纳斯达克标的。',
      ja: 'トークン化株式 — ブローカーなしで、いつでもウォレットからS&P500/NASDAQ銘柄を取引。',
      fr: 'Actions tokenisées — tradez des titres S&P 500 et NASDAQ depuis votre wallet, sans courtier, à tout moment.',
      pt: 'Ações tokenizadas — negocie nomes do S&P 500 e NASDAQ da sua wallet, sem corretora, a qualquer hora.',
      ar: 'أسهم مرمّزة — تداول أسماء S&P 500 وNASDAQ من محفظتك مباشرة دون وسيط وفي أي وقت.',
      tr: 'Tokenize hisseler — aracı kurum olmadan, istediğin zaman cüzdanından S&P 500 ve NASDAQ işlemleri.',
      hi: 'Tokenized stocks — S&P 500 और NASDAQ नाम अपने wallet से, बिना broker, कभी भी।',
      vi: 'Cổ phiếu token hóa — giao dịch S&P 500 và NASDAQ từ ví, không cần môi giới, mọi lúc.',
      id: 'Saham tokenisasi — trade nama S&P 500 dan NASDAQ dari wallet, tanpa broker, kapan saja.',
      th: 'หุ้นโทเคนไนซ์ — เทรด S&P 500 และ NASDAQ จากกระเป๋า โดยไม่ต้องผ่านโบรกเกอร์ ได้ทุกเวลา',
      pl: 'Tokenizowane akcje — handluj spółkami S&P 500 i NASDAQ prosto z wallet, bez brokera, o każdej porze.',
      uk: 'Токенізовані акції — торгуйте паперами S&P 500 і NASDAQ прямо з гаманця, без брокера і в будь-який час.',
      it: 'Azioni tokenizzate — opera titoli S&P 500 e NASDAQ dalla wallet, senza broker, in qualsiasi momento.',
    },
  };

  var ROUTE_META = {
    en: {
      landing: { title: 'GROM Exchange — Non-Custodial DeFi Terminal', description: 'Swaps, perpetual futures, prediction markets and tokenized stocks from your own wallet. No sign-up, no deposits, no KYC for swaps.', keywords: 'crypto exchange, DEX, crypto futures, prediction markets, tokenized stocks, RWA' },
      dashboard: { title: 'Cross-Chain Crypto Swap — Best Route, 20+ Chains', description: 'Swap 10 000+ tokens across 20+ chains. Six routers queried in parallel, you get the best quote. Signed in your wallet, settled on-chain.', keywords: 'crypto swap, cross-chain swap, DEX aggregator, best route, non-custodial swap' },
      markets: { title: 'Crypto Markets & Live Prices — GROM Exchange', description: 'Live prices, 24h volume and depth across crypto, TradFi and trending pairs. Open any market straight into the terminal.', keywords: 'crypto prices, BTC price, ETH price, live crypto charts, market cap' },
      futures: { title: 'Perpetual Futures From Your Wallet — Up to 40x', description: 'Trade BTC, ETH, SOL and 30+ perps with leverage up to 40x. 0.05% taker, 0% maker. No exchange account, no deposit, no withdrawal queue.', keywords: 'crypto futures, perpetual futures, BTC futures, leverage trading, perp trading' },
      predict: { title: 'Prediction Markets — Politics, Sports, Crypto', description: 'Live event markets funded from your own wallet and resolved on-chain. 0.30% taker, 0% maker. No balance to top up, nothing to withdraw.', keywords: 'prediction markets, event forecasts, crypto predictions' },
      xstocks: { title: 'Tokenized Stocks On-Chain, 24/7 — AAPL, TSLA, NVDA', description: 'Buy fractional tokenized equities any time, including weekends. Settles to the same wallet you swap and trade perps with. No brokerage account.', keywords: 'tokenized stocks, trade stocks crypto, fractional stocks, RWA stocks, AAPL TSLA NVDA' },
    },
    ru: {
      landing: { title: 'GROM Exchange — Крипто DEX, фьючерсы, прогнозы и акции', description: 'Некастодиальный крипто DEX: кросс-чейн своп, спот, бессрочные фьючерсы, токенизированные акции и рынки прогнозов. Polymarket и Kalshi из кошелька.', keywords: 'крипто биржа, DEX, фьючерсы крипто, рынки прогнозов, Polymarket, токенизированные акции, акции' },
      dashboard: { title: 'Кросс-чейн своп — лучший маршрут, 20+ сетей | GROM', description: 'Обмен 10 000+ токенов в 20+ сетях. Шесть роутеров параллельно, вы получаете лучшую котировку. Подпись в кошельке, расчёт on-chain.', keywords: 'крипто своп, кросс-чейн обмен, DEX агрегатор, лучший маршрут' },
      markets: { title: 'Курсы криптовалют — BTC, ETH онлайн | GROM', description: 'Актуальные цены криптовалют, объём 24ч, топ роста и падения. BTC, ETH, SOL перед торговлей спот, фьючерсами, акциями и прогнозами.', keywords: 'курс биткоина, цена ETH, криптовалюты онлайн, график BTC, капитализация' },
      futures: { title: 'Бессрочные фьючерсы из кошелька — до 40x | GROM', description: 'Торгуйте BTC, ETH, SOL и 30+ перпами с плечом до 40x. 0.05% тейкер, 0% мейкер. Без аккаунта биржи и очереди на вывод.', keywords: 'фьючерсы крипто, бессрочные фьючерсы, BTC фьючерс, торговля с плечом' },
      predict: { title: 'Рынки прогнозов — ставки на события | GROM', description: 'Торгуйте прогнозами по крипте, спорту и политике с live-вероятностями. Некастодиальные рынки событий на GROM.', keywords: 'рынки прогнозов, Polymarket аналог, Kalshi, ставки на события, прогнозы крипто' },
      xstocks: { title: 'Токенизированные акции 24/7 — AAPL, TSLA, NVDA | GROM', description: 'Покупайте дробные токенизированные акции в любое время, включая выходные. Расчёт в тот же кошелёк, что и своп с перпами.', keywords: 'токенизированные акции, акции крипто, AAPL TSLA NVDA, торговля акциями' },
    },
    es: {
      landing: { title: 'GROM — DEX cripto, futuros, predicciones y acciones', description: 'DEX cripto no custodial: swap cross-chain, spot, futuros perpetuos, acciones tokenizadas y mercados de predicción estilo Polymarket/Kalshi.', keywords: 'exchange cripto, DEX, futuros cripto, mercados predicción, Polymarket, acciones tokenizadas' },
      dashboard: { title: 'Swap cross-chain — mejor ruta, 20+ redes | GROM', description: 'Intercambia 10 000+ tokens en 20+ cadenas. Seis routers en paralelo, la mejor cotización. Firma en tu wallet, liquidación on-chain.', keywords: 'swap cripto, swap cross-chain, agregador DEX, mejor ruta' },
      markets: { title: 'Precios cripto — BTC, ETH en vivo | GROM', description: 'Precios cripto en vivo, volumen 24h, mayores subidas y caídas. BTC, ETH, SOL antes de operar spot, futuros, acciones o predicciones.', keywords: 'precio bitcoin, precio ETH, gráficos cripto, capitalización mercado' },
      futures: { title: 'Futuros perpetuos desde tu wallet — hasta 40x | GROM', description: 'Opera BTC, ETH, SOL y 30+ perps con apalancamiento hasta 40x. 0.05% taker, 0% maker. Sin cuenta de exchange ni cola de retiro.', keywords: 'futuros cripto, futuros perpetuos, apalancamiento cripto, trading BTC' },
      predict: { title: 'Mercados de predicción — apuestas en eventos | GROM', description: 'Opera predicciones en cripto, deportes y política con probabilidades en vivo. Pronósticos no custodiales en GROM.', keywords: 'mercados predicción, alternativa Polymarket, Kalshi, pronósticos eventos' },
      xstocks: { title: 'Acciones tokenizadas 24/7 — AAPL, TSLA, NVDA | GROM', description: 'Compra acciones tokenizadas fraccionadas en cualquier momento, también fines de semana. Misma wallet que swap y perps.', keywords: 'acciones tokenizadas, trading acciones cripto, AAPL TSLA NVDA' },
    },
    de: {
      landing: { title: 'GROM — Krypto-DEX, Futures, Prognosen & Aktien', description: 'Nicht-verwahrter Krypto-DEX: Cross-Chain-Swap, Spot, Perpetual-Futures, tokenisierte Aktien und Prognosemärkte im Polymarket/Kalshi-Stil.', keywords: 'Krypto Börse, DEX, Krypto Futures, Prognosemärkte, Polymarket, tokenisierte Aktien' },
      dashboard: { title: 'Cross-Chain-Swap — beste Route, 20+ Chains | GROM', description: 'Tausche 10 000+ Tokens über 20+ Chains. Sechs Router parallel — du bekommst das beste Quote. Signiert in der Wallet, on-chain Settlement.', keywords: 'Krypto Swap, Cross-Chain Swap, DEX Aggregator, beste Route' },
      markets: { title: 'Krypto-Kurse — BTC, ETH live | GROM', description: 'Live Krypto-Preise, 24h-Volumen, Top-Gewinner und -Verlierer. BTC, ETH, SOL vor Spot-, Futures-, Aktien- und Prognose-Trading.', keywords: 'Bitcoin Kurs, ETH Preis, Krypto Charts, Marktkapitalisierung' },
      futures: { title: 'Perpetual Futures aus der Wallet — bis 40x | GROM', description: 'Handle BTC, ETH, SOL und 30+ Perps mit Hebel bis 40x. 0.05% Taker, 0% Maker. Kein Exchange-Konto, keine Auszahlungswarteschlange.', keywords: 'Krypto Futures, Perpetual Futures, BTC Futures, Hebel Trading' },
      predict: { title: 'Prognosemärkte — Event-Wetten | GROM', description: 'Handele Prognosen zu Krypto, Sport und Politik mit Live-Wahrscheinlichkeiten. Non-custodial Event-Prognosen auf GROM.', keywords: 'Prognosemärkte, Polymarket Alternative, Kalshi, Event Prognosen' },
      xstocks: { title: 'Tokenisierte Aktien 24/7 — AAPL, TSLA, NVDA | GROM', description: 'Kaufe fractionale tokenisierte Aktien jederzeit, auch am Wochenende. Settlement in dieselbe Wallet wie Swap und Perps.', keywords: 'tokenisierte Aktien, Aktien mit Krypto handeln, AAPL TSLA NVDA' },
    },
    ko: {
      landing: { title: 'GROM — 크립토 DEX, 선물, 예측 시장 & 주식', description: '비수탁 크립토 DEX: 크로스체인 스왑, 현물, 무기한 선물, 토큰화 주식, Polymarket/Kalshi 스타일 예측 시장.', keywords: '크립토 거래소, DEX, 크립토 선물, 예측 시장, Polymarket, 토큰화 주식' },
      dashboard: { title: '크로스체인 스왑 — 최적 경로, 20+ 체인 | GROM', description: '20+ 체인에서 10,000+ 토큰 스왑. 6개 라우터 병렬 조회, 최적 호가. 지갑 서명, 온체인 정산.', keywords: '크립토 스왑, 크로스체인 스왑, DEX 애그리게이터, 최적 경로' },
      markets: { title: '크립토 시세 — BTC, ETH 실시간 | GROM', description: '실시간 크립토 가격, 24시간 거래량, 상승/하락 TOP. BTC, ETH, SOL — 현물·선물·주식·예측 거래 전.', keywords: '비트코인 시세, ETH 가격, 크립토 차트, 시가총액' },
      futures: { title: '지갑에서 무기한 선물 — 최대 40x | GROM', description: 'BTC, ETH, SOL 및 30+ 퍼프, 레버리지 최대 40x. 테이커 0.05%, 메이커 0%. 거래소 계정·출금 대기 없음.', keywords: '크립토 선물, 무기한 선물, BTC 선물, 레버리지 거래' },
      predict: { title: '예측 시장 — 이벤트 베팅 | GROM', description: '크립토·스포츠·정치 예측 시장, 실시간 확률. 비수탁 이벤트 예측 on GROM.', keywords: '예측 시장, Polymarket 대안, Kalshi, 이벤트 예측' },
      xstocks: { title: '토큰화 주식 24/7 — AAPL, TSLA, NVDA | GROM', description: '주말 포함 언제든 분할 토큰화 주식 매수. 스왑·퍼프와 같은 지갑으로 정산.', keywords: '토큰화 주식, 크립토 주식 거래, AAPL TSLA NVDA' },
    },
    zh: {
      landing: { title: 'GROM — 加密 DEX、期货、预测市场与股票', description: '非托管加密 DEX：跨链兑换、现货、永续期货、代币化股票、Polymarket/Kalshi 风格预测市场。', keywords: '加密货币交易所, DEX, 加密期货, 预测市场, Polymarket, 代币化股票' },
      dashboard: { title: '跨链兑换 — 最优路由，20+ 链 | GROM', description: '在 20+ 链上兑换 10,000+ 代币。六个路由并行询价，给你最优报价。钱包签名，链上结算。', keywords: '加密兑换, 跨链兑换, DEX 聚合器, 最优路由' },
      markets: { title: '加密货币行情 — BTC、ETH 实时 | GROM', description: '实时加密价格、24小时成交量、涨跌幅榜。BTC、ETH、SOL — 现货、期货、股票、预测交易前查看。', keywords: '比特币价格, ETH价格, 加密行情, 市值' },
      futures: { title: '钱包内永续合约 — 最高 40x | GROM', description: '交易 BTC、ETH、SOL 及 30+ 永续，杠杆最高 40x。吃单 0.05%，挂单 0%。无需交易所账户与提现排队。', keywords: '加密期货, 永续合约, BTC期货, 杠杆交易' },
      predict: { title: '预测市场 — 事件投注 | GROM', description: '加密、体育、政治预测市场，实时概率。非托管事件预测 on GROM。', keywords: '预测市场, Polymarket替代, Kalshi, 事件预测' },
      xstocks: { title: '代币化股票 24/7 — AAPL、TSLA、NVDA | GROM', description: '随时（含周末）买入碎股代币化股票。与兑换、永续同一钱包结算。', keywords: '代币化股票, 加密交易股票, AAPL TSLA NVDA' },
    },
    ja: {
      landing: { title: 'GROM — 暗号DEX・先物・予測市場・株式', description: '非カストディアル暗号DEX：クロスチェーンスワップ、現物、パーペチュアル先物、トークン化株式、Polymarket/Kalshi型予測市場。', keywords: '暗号取引所, DEX, 暗号先物, 予測市場, Polymarket, トークン化株式' },
      dashboard: { title: 'クロスチェーンスワップ — 最適ルート、20+チェーン | GROM', description: '20+チェーンで10,000+トークンをスワップ。6ルーター並列照会で最良レート。ウォレット署名、オンチェーン決済。', keywords: '暗号スワップ, クロスチェーンスワップ, DEXアグリゲーター, 最適ルート' },
      markets: { title: '暗号相場 — BTC・ETH ライブ | GROM', description: 'リアルタイム暗号価格、24h出来高、騰落ランキング。BTC、ETH、SOL — 現物・先物・株式・予測の前に。', keywords: 'ビットコイン価格, ETH価格, 暗号チャート, 時価総額' },
      futures: { title: 'ウォレットからパーペチュアル — 最大40x | GROM', description: 'BTC・ETH・SOLほか30+パープ、レバレッジ最大40x。テイカー0.05%、メーカー0%。取引所口座も出金待ちも不要。', keywords: '暗号先物, パーペチュアル, BTC先物, レバレッジ' },
      predict: { title: '予測市場 — イベント賭け | GROM', description: '暗号・スポーツ・政治の予測市場、ライブ確率。非カストディアルイベント予測。', keywords: '予測市場, Polymarket代替, Kalshi, イベント予測' },
      xstocks: { title: 'トークン化株式 24/7 — AAPL・TSLA・NVDA | GROM', description: '週末も含めいつでも端株トークン化株式を購入。スワップ・パープと同じウォレットで決済。', keywords: 'トークン化株式, 暗号で株式取引, AAPL TSLA NVDA' },
    },
    fr: {
      landing: { title: 'GROM — DEX crypto, futures, prédictions & actions', description: 'DEX crypto non custodial : swap cross-chain, spot, futures perpétuels, actions tokenisées, marchés prédictifs Polymarket/Kalshi.', keywords: 'exchange crypto, DEX, futures crypto, marchés prédictifs, Polymarket, actions tokenisées' },
      dashboard: { title: 'Swap cross-chain — meilleure route, 20+ chaînes | GROM', description: 'Échangez 10 000+ tokens sur 20+ chaînes. Six routeurs en parallèle, le meilleur devis. Signature wallet, règlement on-chain.', keywords: 'swap crypto, swap cross-chain, agrégateur DEX, meilleure route' },
      markets: { title: 'Prix crypto — BTC, ETH en direct | GROM', description: 'Prix crypto live, volume 24h, top hausses et baisses. BTC, ETH, SOL avant spot, futures, actions ou prédictions.', keywords: 'prix bitcoin, prix ETH, graphiques crypto, capitalisation' },
      futures: { title: 'Futures perpétuels depuis le wallet — jusqu\'à 40x | GROM', description: 'Tradez BTC, ETH, SOL et 30+ perps jusqu\'à 40x. 0,05 % taker, 0 % maker. Pas de compte exchange ni file de retrait.', keywords: 'futures crypto, perpétuels, futures BTC, trading levier' },
      predict: { title: 'Marchés prédictifs — paris sur événements | GROM', description: 'Marchés prédictifs crypto, sport, politique avec probabilités live. Prévisions non custodiales sur GROM.', keywords: 'marchés prédictifs, alternative Polymarket, Kalshi, prévisions événements' },
      xstocks: { title: 'Actions tokenisées 24/7 — AAPL, TSLA, NVDA | GROM', description: 'Achetez des actions tokenisées fractionnées à tout moment, week-end inclus. Même wallet que swap et perps.', keywords: 'actions tokenisées, trader actions crypto, AAPL TSLA NVDA' },
    },
    pt: {
      landing: { title: 'GROM — DEX cripto, futuros, previsões e ações', description: 'DEX cripto não custodial: swap cross-chain, spot, futuros perpétuos, ações tokenizadas e mercados de previsão Polymarket/Kalshi.', keywords: 'exchange cripto, DEX, futuros cripto, mercados previsão, Polymarket, ações tokenizadas' },
      dashboard: { title: 'Swap cross-chain — melhor rota, 20+ redes | GROM', description: 'Troque 10 000+ tokens em 20+ chains. Seis routers em paralelo, melhor cotação. Assinatura na wallet, liquidação on-chain.', keywords: 'swap cripto, swap cross-chain, agregador DEX, melhor rota' },
      markets: { title: 'Preços cripto — BTC, ETH ao vivo | GROM', description: 'Preços cripto live, volume 24h, maiores altas e baixas. BTC, ETH, SOL antes de spot, futuros, ações ou previsões.', keywords: 'preço bitcoin, preço ETH, gráficos cripto, capitalização' },
      futures: { title: 'Futuros perpétuos da wallet — até 40x | GROM', description: 'Opere BTC, ETH, SOL e 30+ perps com alavancagem até 40x. 0,05% taker, 0% maker. Sem conta de exchange nem fila de saque.', keywords: 'futuros cripto, perpétuos, futuros BTC, alavancagem' },
      predict: { title: 'Mercados de previsão — apostas em eventos | GROM', description: 'Mercados de previsão em cripto, esporte e política com probabilidades live. Previsões não custodiais no GROM.', keywords: 'mercados previsão, alternativa Polymarket, Kalshi, previsões eventos' },
      xstocks: { title: 'Ações tokenizadas 24/7 — AAPL, TSLA, NVDA | GROM', description: 'Compre ações tokenizadas fracionadas a qualquer hora, inclusive fins de semana. Mesma wallet do swap e perps.', keywords: 'ações tokenizadas, trading ações cripto, AAPL TSLA NVDA' },
    },
    ar: {
      landing: { title: 'GROM — DEX كريبتو، عقود آجلة، توقعات وأسهم', description: 'DEX كريبتو غير حاضن: swap cross-chain، سبوت، عقود دائمة، أسهم مرمّزة وأسواق توقعات بأسلوب Polymarket/Kalshi.', keywords: 'بورصة كريبتو, DEX, عقود آجلة, أسواق توقعات, Polymarket, أسهم مرمّزة' },
      dashboard: { title: 'مبادلة عبر السلاسل — أفضل مسار، +20 شبكة | GROM', description: 'بادل أكثر من 10 آلاف توكن عبر +20 سلسلة. ستة موجهات بالتوازي لأفضل سعر. توقيع من المحفظة وتسوية على السلسلة.', keywords: 'مبادلة كريبتو, مبادلة عبر السلاسل, مجمع DEX, أفضل مسار' },
      markets: { title: 'أسعار العملات — BTC وETH مباشر | GROM', description: 'أسعار كريبتو مباشرة، حجم 24 ساعة، أكبر الرابحين والخاسرين. BTC وETH وSOL قبل التداول.', keywords: 'سعر البitcoin, سعر ETH, رسوم كريبتو, القيمة السوقية' },
      futures: { title: 'عقود دائمة من المحفظة — حتى 40x | GROM', description: 'تداول BTC وETH وSOL وأكثر من 30 عقداً برافعة حتى 40x. آخذ 0.05٪ وصانع 0٪. بلا حساب بورصة أو طابور سحب.', keywords: 'عقود آجلة كريبتو, عقود دائمة, BTC futures, رافعة مالية' },
      predict: { title: 'أسواق التوقعات — رهانات على الأحداث | GROM', description: 'أسواق توقعات للكريبتو والرياضة والسياسة باحتمالات مباشرة. توقعات أحداث غير حاضنة على GROM.', keywords: 'أسواق توقعات, بديل Polymarket, Kalshi, توقعات أحداث' },
      xstocks: { title: 'أسهم مرمّزة على مدار الساعة — AAPL وTSLA وNVDA | GROM', description: 'اشترِ أسهماً مرمّزة مجزأة في أي وقت بما فيها عطلة نهاية الأسبوع. نفس محفظة المبادلة والعقود.', keywords: 'أسهم مرمّزة, تداول أسهم كريبتو, AAPL TSLA NVDA' },
    },
    tr: {
      landing: { title: 'GROM — Kripto DEX, vadeli, tahminler ve hisseler', description: 'Saklamasız kripto DEX: cross-chain swap, spot, sürekli vadeli, tokenize hisseler, Polymarket/Kalshi tarzı tahmin piyasaları.', keywords: 'kripto borsası, DEX, kripto vadeli, tahmin piyasaları, Polymarket, tokenize hisseler' },
      dashboard: { title: 'Cross-chain swap — en iyi rota, 20+ zincir | GROM', description: '20+ zincirde 10.000+ token takas. Altı router paralel, en iyi teklif. Cüzdan imzası, on-chain settlement.', keywords: 'kripto swap, cross-chain swap, DEX aggregator, en iyi rota' },
      markets: { title: 'Kripto fiyatları — BTC, ETH canlı | GROM', description: 'Canlı kripto fiyatları, 24s hacim, en çok yükselen/düşenler. BTC, ETH, SOL — spot, vadeli, hisse, tahmin öncesi.', keywords: 'bitcoin fiyatı, ETH fiyatı, kripto grafik, piyasa değeri' },
      futures: { title: 'Cüzdandan perpetual — 40x\'e kadar | GROM', description: 'BTC, ETH, SOL ve 30+ perp, kaldıraç 40x\'e kadar. %0.05 taker, %0 maker. Borsa hesabı ve çekim kuyruğu yok.', keywords: 'kripto vadeli, perpetual, BTC vadeli, kaldıraçlı işlem' },
      predict: { title: 'Tahmin piyasaları — olay bahisleri | GROM', description: 'Kripto, spor ve siyaset tahmin piyasaları, canlı olasılıklar. Saklamasız olay tahminleri GROM\'da.', keywords: 'tahmin piyasaları, Polymarket alternatifi, Kalshi, olay tahminleri' },
      xstocks: { title: 'Tokenize hisseler 7/24 — AAPL, TSLA, NVDA | GROM', description: 'Hafta sonu dahil her an kesirli tokenize hisse al. Swap ve perp ile aynı cüzdan.', keywords: 'tokenize hisseler, kripto ile hisse, AAPL TSLA NVDA' },
    },
    hi: {
      landing: { title: 'GROM Exchange — Non-Custodial DeFi Terminal', description: 'Swaps, perpetual futures, prediction markets and tokenized stocks from your own wallet. No sign-up, no deposits, no KYC for swaps.', keywords: 'crypto exchange, DEX, crypto futures, prediction markets, tokenized stocks' },
      dashboard: { title: 'Cross-chain swap — best route, 20+ chains | GROM', description: 'Swap 10,000+ tokens across 20+ chains. Six routers in parallel for the best quote. Wallet-signed, on-chain settlement.', keywords: 'crypto swap, cross-chain swap, DEX aggregator, best route' },
      markets: { title: 'Crypto Prices — BTC, ETH Live | GROM', description: 'Live crypto prices, 24h volume, top movers. BTC, ETH, SOL before spot, futures, stocks or predictions.', keywords: 'bitcoin price, ETH price, crypto charts, market cap' },
      futures: { title: 'Perpetual futures from your wallet — up to 40x | GROM', description: 'Trade BTC, ETH, SOL and 30+ perps with up to 40x. 0.05% taker, 0% maker. No exchange account or withdrawal queue.', keywords: 'crypto futures, perpetual futures, BTC futures, leverage' },
      predict: { title: 'Prediction Markets — Event Betting | GROM', description: 'Prediction markets on crypto, sports, politics with live probabilities. Non-custodial on GROM.', keywords: 'prediction markets, Polymarket, Kalshi, event forecasts' },
      xstocks: { title: 'Tokenized stocks 24/7 — AAPL, TSLA, NVDA | GROM', description: 'Buy fractional tokenized equities anytime, including weekends. Same wallet as swap and perps.', keywords: 'tokenized stocks, trade stocks crypto, AAPL TSLA NVDA' },
    },
    vi: {
      landing: { title: 'GROM — DEX crypto, futures, dự đoán & cổ phiếu', description: 'DEX crypto không giữ hộ: swap cross-chain, spot, futures vĩnh viễn, cổ phiếu token hóa, thị trường dự đoán Polymarket/Kalshi.', keywords: 'sàn crypto, DEX, futures crypto, thị trường dự đoán, Polymarket, cổ phiếu token' },
      dashboard: { title: 'Swap cross-chain — tuyến tốt nhất, 20+ chain | GROM', description: 'Đổi 10.000+ token trên 20+ chain. Sáu router song song, báo giá tốt nhất. Ký bằng ví, thanh toán on-chain.', keywords: 'swap crypto, swap cross-chain, DEX aggregator, tuyến tốt nhất' },
      markets: { title: 'Giá crypto — BTC, ETH trực tiếp | GROM', description: 'Giá crypto trực tiếp, khối lượng 24h, top tăng giảm. BTC, ETH, SOL trước khi giao dịch.', keywords: 'giá bitcoin, giá ETH, biểu đồ crypto, vốn hóa' },
      futures: { title: 'Futures vĩnh viễn từ ví — tới 40x | GROM', description: 'Giao dịch BTC, ETH, SOL và 30+ perp đòn bẩy tới 40x. Taker 0.05%, maker 0%. Không tài khoản sàn hay hàng rút.', keywords: 'futures crypto, perpetual, BTC futures, đòn bẩy' },
      predict: { title: 'Thị trường dự đoán — cược sự kiện | GROM', description: 'Dự đoán crypto, thể thao, chính trị với xác suất trực tiếp. Không giữ hộ trên GROM.', keywords: 'thị trường dự đoán, Polymarket, Kalshi, dự báo sự kiện' },
      xstocks: { title: 'Cổ phiếu token hóa 24/7 — AAPL, TSLA, NVDA | GROM', description: 'Mua cổ phiếu token hóa phân đoạn mọi lúc, kể cả cuối tuần. Cùng ví với swap và perp.', keywords: 'cổ phiếu token, giao dịch cổ phiếu crypto, AAPL TSLA NVDA' },
    },
    id: {
      landing: { title: 'GROM — DEX kripto, futures, prediksi & saham', description: 'DEX kripto non-kustodial: swap cross-chain, spot, futures perpetual, saham tokenisasi, pasar prediksi gaya Polymarket/Kalshi.', keywords: 'exchange kripto, DEX, futures kripto, pasar prediksi, Polymarket, saham tokenisasi' },
      dashboard: { title: 'Swap cross-chain — rute terbaik, 20+ chain | GROM', description: 'Tukar 10.000+ token di 20+ chain. Enam router paralel, kutipan terbaik. Tanda tangan wallet, settlement on-chain.', keywords: 'swap kripto, swap cross-chain, aggregator DEX, rute terbaik' },
      markets: { title: 'Harga kripto — BTC, ETH live | GROM', description: 'Harga kripto live, volume 24j, top naik turun. BTC, ETH, SOL sebelum trading spot, futures, saham, prediksi.', keywords: 'harga bitcoin, harga ETH, grafik kripto, kapitalisasi pasar' },
      futures: { title: 'Futures perpetual dari wallet — hingga 40x | GROM', description: 'Trade BTC, ETH, SOL dan 30+ perp leverage hingga 40x. Taker 0.05%, maker 0%. Tanpa akun exchange atau antrean penarikan.', keywords: 'futures kripto, perpetual, BTC futures, leverage' },
      predict: { title: 'Pasar prediksi — taruhan event | GROM', description: 'Pasar prediksi kripto, olahraga, politik dengan probabilitas live. Non-kustodial di GROM.', keywords: 'pasar prediksi, alternatif Polymarket, Kalshi, prakiraan event' },
      xstocks: { title: 'Saham tokenisasi 24/7 — AAPL, TSLA, NVDA | GROM', description: 'Beli saham tokenisasi fraksional kapan saja, termasuk akhir pekan. Wallet yang sama dengan swap dan perp.', keywords: 'saham tokenisasi, trading saham kripto, AAPL TSLA NVDA' },
    },
    th: {
      landing: { title: 'GROM — DEX คริปโต, futures, ทำนาย & หุ้น', description: 'DEX คริปโต แบบ non-custodial: swap cross-chain, spot, perpetual futures, หุ้นโทเคนไนซ์, ตลาดทำนายแบบ Polymarket/Kalshi', keywords: 'exchange คริปโต, DEX, futures คริปโต, ตลาดทำนาย, Polymarket, หุ้นโทเคน' },
      dashboard: { title: 'สวอปข้ามเชน — เส้นทางที่ดีที่สุด, 20+ เชน | GROM', description: 'สวอป 10,000+ โทเคนบน 20+ เชน หก router แบบขนานได้ราคาดีที่สุด เซ็นด้วยกระเป๋า ชำระบนเชน', keywords: 'สวอปคริปโต, สวอปข้ามเชน, DEX aggregator, เส้นทางที่ดีที่สุด' },
      markets: { title: 'ราคา คริปโต — BTC, ETH สด | GROM', description: 'ราคา คริปโต สด, ปริมาณ 24 ชม., top ขึ้นลง. BTC, ETH, SOL ก่อนเทรด spot, futures, หุ้น, ทำนาย', keywords: 'ราคา bitcoin, ราคา ETH, กราฟ คริปโต, มูลค่าตลาด' },
      futures: { title: 'Perpetual จากกระเป๋า — สูงสุด 40x | GROM', description: 'เทรด BTC ETH SOL และ 30+ perp เลเวอเรจสูงสุด 40x Taker 0.05% Maker 0% ไม่ต้องมีบัญชีแลกเปลี่ยนหรือคิวถอน', keywords: 'futures คริปโต, perpetual, BTC futures, leverage' },
      predict: { title: 'ตลาดทำนาย — เดิมพันเหตุการณ์ | GROM', description: 'ตลาดทำนาย crypto กีฬา การเมือง ความน่าจะเป็นสด. non-custodial บน GROM', keywords: 'ตลาดทำนาย, Polymarket, Kalshi, พยากรณ์เหตุการณ์' },
      xstocks: { title: 'หุ้นโทเคนไนซ์ 24/7 — AAPL, TSLA, NVDA | GROM', description: 'ซื้อหุ้นโทเคนไนซ์แบบเศษส่วนได้ทุกเวลา รวมวันหยุดสุดสัปดาห์ กระเป๋าเดียวกับสวอปและ perp', keywords: 'หุ้นโทเคน, เทรดหุ้น crypto, AAPL TSLA NVDA' },
    },
    pl: {
      landing: { title: 'GROM — Krypto DEX, futures, predykcje i akcje', description: 'Niekustodialny krypto DEX: swap cross-chain, spot, perpetual futures, tokenizowane akcje, rynki predykcji Polymarket/Kalshi.', keywords: 'giełda krypto, DEX, futures krypto, rynki predykcji, Polymarket, akcje tokenizowane' },
      dashboard: { title: 'Swap cross-chain — najlepsza trasa, 20+ sieci | GROM', description: 'Wymień 10 000+ tokenów w 20+ sieciach. Sześć routerów równolegle — najlepsza wycena. Podpis w wallet, settlement on-chain.', keywords: 'swap krypto, swap cross-chain, aggregator DEX, najlepsza trasa' },
      markets: { title: 'Kursy krypto — BTC, ETH na żywo | GROM', description: 'Ceny krypto live, wolumen 24h, top wzrosty i spadki. BTC, ETH, SOL przed tradingiem.', keywords: 'cena bitcoin, cena ETH, wykresy krypto, kapitalizacja' },
      futures: { title: 'Perpetual z wallet — do 40x | GROM', description: 'Handluj BTC, ETH, SOL i 30+ perpami z dźwignią do 40x. 0,05% taker, 0% maker. Bez konta giełdy i kolejki wypłat.', keywords: 'futures krypto, perpetual, BTC futures, dźwignia' },
      predict: { title: 'Rynki predykcji — zakłady na wydarzenia | GROM', description: 'Rynki predykcji krypto, sport, polityka z live prawdopodobieństwami. Non-custodial na GROM.', keywords: 'rynki predykcji, alternatywa Polymarket, Kalshi, prognozy wydarzeń' },
      xstocks: { title: 'Tokenizowane akcje 24/7 — AAPL, TSLA, NVDA | GROM', description: 'Kupuj ułamkowe tokenizowane akcje o każdej porze, także w weekend. Ten sam wallet co swap i perpy.', keywords: 'akcje tokenizowane, akcje krypto, AAPL TSLA NVDA' },
    },
    uk: {
      landing: { title: 'GROM — Крипто DEX, ф\'ючерси, прогнози та акції', description: 'Некастodialний крипто DEX: cross-chain своп, спот, безстрокові ф\'ючерси, токенізовані акції, ринки прогнозів Polymarket/Kalshi.', keywords: 'крипто біржа, DEX, ф\'ючерси крипто, ринки прогнозів, Polymarket, токенізовані акції' },
      dashboard: { title: 'Крос-чейн своп — найкращий маршрут, 20+ мереж | GROM', description: 'Обмін 10 000+ токенів у 20+ мережах. Шість роутерів паралельно — найкраща котировка. Підпис у гаманці, розрахунок on-chain.', keywords: 'крипто своп, крос-чейн обмін, DEX агрегатор, найкращий маршрут' },
      markets: { title: 'Курси криптовалют — BTC, ETH онлайн | GROM', description: 'Актуальні ціни крипто, обсяг 24г, топ зростання і падіння. BTC, ETH, SOL перед торгівлею.', keywords: 'курс біткоіна, ціна ETH, криптовалюти онлайн, графік BTC' },
      futures: { title: 'Безстрокові ф\'ючерси з гаманця — до 40x | GROM', description: 'Торгуйте BTC, ETH, SOL і 30+ перпами з плечем до 40x. 0.05% тейкер, 0% мейкер. Без акаунта біржі й черги на вивід.', keywords: 'ф\'ючерси крипто, perpetual, BTC ф\'ючерс, торгівля з плечем' },
      predict: { title: 'Ринки прогнозів — ставки на події | GROM', description: 'Прогнози з крипто, спорту та політики з live-ймовірностями. Некастodialно на GROM.', keywords: 'ринки прогнозів, аналог Polymarket, Kalshi, прогнози подій' },
      xstocks: { title: 'Токенізовані акції 24/7 — AAPL, TSLA, NVDA | GROM', description: 'Купуйте дробові токенізовані акції будь-коли, включно з вихідними. Той самий гаманець, що й для свопу та перпів.', keywords: 'токенізовані акції, акції крипто, AAPL TSLA NVDA' },
    },
    it: {
      landing: { title: 'GROM — DEX crypto, futures, previsioni e azioni', description: 'DEX crypto non custodial: swap cross-chain, spot, futures perpetui, azioni tokenizzate, mercati predittivi Polymarket/Kalshi.', keywords: 'exchange crypto, DEX, futures crypto, mercati predittivi, Polymarket, azioni tokenizzate' },
      dashboard: { title: 'Swap cross-chain — migliore route, 20+ chain | GROM', description: 'Scambia 10.000+ token su 20+ chain. Sei router in parallelo, miglior quotazione. Firma in wallet, settlement on-chain.', keywords: 'swap crypto, swap cross-chain, aggregatore DEX, migliore route' },
      markets: { title: 'Prezzi crypto — BTC, ETH live | GROM', description: 'Prezzi crypto live, volume 24h, top rialzi e ribassi. BTC, ETH, SOL prima di spot, futures, azioni, previsioni.', keywords: 'prezzo bitcoin, prezzo ETH, grafici crypto, capitalizzazione' },
      futures: { title: 'Futures perpetui dal wallet — fino a 40x | GROM', description: 'Opera BTC, ETH, SOL e 30+ perp con leva fino a 40x. 0,05% taker, 0% maker. Niente account exchange né coda di prelievo.', keywords: 'futures crypto, perpetual, BTC futures, leva trading' },
      predict: { title: 'Mercati predittivi — scommesse su eventi | GROM', description: 'Mercati predittivi crypto, sport, politica con probabilità live. Non custodial su GROM.', keywords: 'mercati predittivi, alternativa Polymarket, Kalshi, previsioni eventi' },
      xstocks: { title: 'Azioni tokenizzate 24/7 — AAPL, TSLA, NVDA | GROM', description: 'Compra azioni tokenizzate frazionate in qualsiasi momento, weekend inclusi. Stesso wallet di swap e perp.', keywords: 'azioni tokenizzate, trading azioni crypto, AAPL TSLA NVDA' },
    },
  };

  var ML_HEADING = {
    en: 'GROM in 18 languages — crypto, futures, predictions & stocks',
    ru: 'GROM на 18 языках — крипто, фьючерсы, прогнозы и акции',
    es: 'GROM en 18 idiomas — cripto, futuros, predicciones y acciones',
    de: 'GROM in 18 Sprachen — Krypto, Futures, Prognosen & Aktien',
    ko: '18개 언어 GROM — 크립토, 선물, 예측, 주식',
    zh: 'GROM 18 种语言 — 加密、期货、预测与股票',
    ja: '18言語のGROM — 暗号・先物・予測・株式',
    fr: 'GROM en 18 langues — crypto, futures, prédictions et actions',
    pt: 'GROM em 18 idiomas — cripto, futuros, previsões e ações',
    ar: 'GROM بـ 18 لغة — كريبتو والعقود والتوقعات والأسهم',
    tr: '18 dilde GROM — kripto, vadeli, tahminler ve hisseler',
    hi: '18 languages — crypto, futures, predictions & stocks',
    vi: 'GROM 18 ngôn ngữ — crypto, futures, dự đoán & cổ phiếu',
    id: 'GROM 18 bahasa — kripto, futures, prediksi & saham',
    th: 'GROM 18 ภาษา — คริปโต, futures, ทำนาย & หุ้น',
    pl: 'GROM w 18 językach — krypto, futures, predykcje i akcje',
    uk: 'GROM 18 мовами — крипто, ф\'ючерси, прогнози та акції',
    it: 'GROM in 18 lingue — crypto, futures, previsioni e azioni',
  };

  var PRIMARY_SUMMARY = {
    en: 'Guides: crypto, futures, predictions & stocks',
    ru: 'Гайды: крипто, фьючерсы, прогнозы и акции',
    es: 'Guías: cripto, futuros, predicciones y acciones',
    de: 'Guides: Krypto, Futures, Prognosen & Aktien',
    ko: '가이드: 크립토, 선물, 예측, 주식',
    zh: '指南：加密、期货、预测与股票',
    ja: 'ガイド：暗号・先物・予測・株式',
    fr: 'Guides : crypto, futures, prédictions et actions',
    pt: 'Guias: cripto, futuros, previsões e ações',
    ar: 'أدلة: كريبتو والعقود والتوقعات والأسهم',
    tr: 'Rehberler: kripto, vadeli, tahminler ve hisseler',
    hi: 'Guides: crypto, futures, predictions & stocks',
    vi: 'Hướng dẫn: crypto, futures, dự đoán & cổ phiếu',
    id: 'Panduan: kripto, futures, prediksi & saham',
    th: 'คู่มือ: คริปโต, futures, ทำนาย & หุ้น',
    pl: 'Przewodniki: krypto, futures, predykcje i akcje',
    uk: 'Гайди: крипто, ф\'ючерси, прогнози та акції',
    it: 'Guide: crypto, futures, previsioni e azioni',
  };

  function updateDetailsSummaries() {
    var lang = curLang();
    var ps = document.getElementById('lpSeoPrimarySum');
    var ms = document.getElementById('lpSeoMultilangSum');
    if (ps) ps.textContent = PRIMARY_SUMMARY[lang] || PRIMARY_SUMMARY.en;
    if (ms) ms.textContent = ML_HEADING[lang] || ML_HEADING.en;
  }

  function curLang() {
    try {
      var queryLang = normalizeLang(new URLSearchParams(location.search).get('lang'));
      if (queryLang && LANGS.indexOf(queryLang) !== -1) return queryLang;
    } catch (_) {}
    try {
      var renderedLocale = normalizeLang(document.documentElement.getAttribute('data-grom-locale'));
      if (renderedLocale && renderedLocale !== 'en' && LANGS.indexOf(renderedLocale) !== -1) return renderedLocale;
    } catch (_) {}
    if (typeof window.getGromLang === 'function') {
      var g = normalizeLang(window.getGromLang());
      if (LANGS.indexOf(g) !== -1) return g;
    }
    return 'en';
  }

  function seoLang() {
    try {
      var queryLang = normalizeLang(new URLSearchParams(location.search).get('lang'));
      if (queryLang && LANGS.indexOf(queryLang) !== -1) return queryLang;
    } catch (_) {}
    try {
      var renderedLocale = normalizeLang(document.documentElement.getAttribute('data-grom-locale'));
      if (LANGS.indexOf(renderedLocale) !== -1) return renderedLocale;
    } catch (_) {}
    return curLang();
  }

  function esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function renderPrimaryBlock() {
    var host = document.getElementById('lpSeoPrimary');
    if (!host) return;
    var lang = curLang();
    var b = BLOCKS[lang] || BLOCKS.en;
    var kw = b.kw.map(function (k) {
      return '<div><h3>' + esc(k.t) + '</h3><p>' + esc(k.p) + '</p></div>';
    }).join('');
    var lk = b.links;
    host.setAttribute('lang', b.htmlLang);
    host.innerHTML = '<h2>' + esc(b.h2) + '</h2><p>' + esc(b.intro) + '</p>'
      + '<div class="lp-seo-kw">' + kw + '</div>'
      + '<div class="lp-seo-links">'
      + '<a href="/markets">' + esc(lk.markets) + '</a>'
      + '<a href="/futures">' + esc(lk.trade) + '</a>'
      + '<a href="/stocks">' + esc(lk.stocks) + '</a>'
      + '<a href="/predict">' + esc(lk.predict) + '</a>'
      + '<a href="/swap">Swap</a>'
      + '</div>';
  }

  function isLandingRoute() {
    var page = (location.hash || '').replace(/^#/, '').split('?')[0];
    if (!page || page === 'landing') return true;
    try {
      return !!(document.getElementById('page-landing') && document.getElementById('page-landing').classList.contains('active'));
    } catch (_) {}
    return false;
  }

  /* Lazy: summaries only; full article injected on first open — keeps main thread free. */
  function summaryHtml(code, open) {
    var b = BLOCKS[code];
    if (!b) return '';
    return '<details class="lp-seo-lang" data-seo-lang="' + esc(code) + '"' + (open ? ' open' : '') + ' lang="' + esc(b.htmlLang) + '">'
      + '<summary>' + esc(b.label) + '</summary>'
      + '<article data-seo-body="' + esc(code) + '"></article></details>';
  }

  function fillLangBody(code) {
    var art = document.querySelector('#lpSeoMultilang article[data-seo-body="' + code + '"]');
    if (!art || art.dataset.seoFilled === '1') return;
    var b = BLOCKS[code];
    if (!b) return;
    var kw = b.kw.map(function (k) {
      return '<div><h3>' + esc(k.t) + '</h3><p>' + esc(k.p) + '</p></div>';
    }).join('');
    var lk = b.links;
    art.innerHTML = '<h2>' + esc(b.h2) + '</h2><p>' + esc(b.intro) + '</p>'
      + '<div class="lp-seo-kw">' + kw + '</div>'
      + '<div class="lp-seo-links">'
      + '<a href="/markets">' + esc(lk.markets) + '</a>'
      + '<a href="/futures">' + esc(lk.trade) + '</a>'
      + '<a href="/stocks">' + esc(lk.stocks) + '</a>'
      + '<a href="/predict">' + esc(lk.predict) + '</a>'
      + '<a href="/swap">Swap</a>'
      + '</div>';
    art.dataset.seoFilled = '1';
  }

  function onMultilangToggle(e) {
    var det = e.target;
    if (!det || det.tagName !== 'DETAILS' || !det.open) return;
    var code = det.getAttribute('data-seo-lang');
    if (code) fillLangBody(code);
  }

  var _mlBuilt = false;
  function renderMultilang(force) {
    var host = document.getElementById('lpSeoMultilang');
    if (!host) return;
    if (!force && !isLandingRoute()) {
      host.dataset.seoDeferred = '1';
      return;
    }
    if (_mlBuilt && host.dataset.seoBuilt === '1') {
      return;
    }
    var inner = LANGS.map(function (code) {
      return summaryHtml(code, false);
    }).join('');
    host.innerHTML = '<div class="lp-seo-lang-grid">' + inner + '</div>';
    host.removeEventListener('toggle', onMultilangToggle, true);
    host.addEventListener('toggle', onMultilangToggle, true);
    host.dataset.seoBuilt = '1';
    _mlBuilt = true;
  }

  function scheduleMultilang() {
    if (!document.getElementById('lpSeoMultilang')) return;
    var run = function () { try { renderMultilang(false); } catch (_) {} };
    if (window.GROM_SAFARI) {
      if (typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout: 12000 });
      else setTimeout(run, 4000);
      return;
    }
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(run, { timeout: 4000 });
    } else {
      setTimeout(run, 1200);
    }
  }

  function injectHreflang(force) {
    var head = document.head;
    if (!head) return;
    /* The crawler HTML already has the exact path-based alternates from the build. */
    try {
      if (document.documentElement.hasAttribute('data-grom-locale')) return;
    } catch (_) {}
    if (!force && head.querySelector('[data-grom-hreflang]')) return;
    head.querySelectorAll('[data-grom-hreflang]').forEach(function (link) { link.remove(); });
    var page = currentSeoPage();
    var path = pathForSeoPage(page);
    Object.keys(SEO_LOCALE_PREFIX).forEach(function (code) {
      var basePath = SEO_LOCALE_PREFIX[code] + (path === '/' ? '/' : path);
      var link = document.createElement('link');
      link.rel = 'alternate';
      link.hreflang = HREFLANG[code] || code;
      link.href = 'https://grom.exchange' + basePath;
      link.setAttribute('data-grom-hreflang', '1');
      head.appendChild(link);
    });
    var xd = document.createElement('link');
    xd.rel = 'alternate';
    xd.hreflang = 'x-default';
    xd.href = 'https://grom.exchange' + (basePath === '/' ? '/' : basePath);
    xd.setAttribute('data-grom-hreflang', '1');
    head.appendChild(xd);
  }

  function getRouteMeta(page, lang) {
    var key = page || 'landing';
    if (key === 'trade') key = 'futures';
    if (key === 'stocks' || key === 'stock') key = 'xstocks';
    if (key === 'binary' || key === 'spot') key = 'dashboard';
    var pack = ROUTE_META[lang] || ROUTE_META.en;
    return pack[key] || pack.landing || ROUTE_META.en.landing;
  }

  /** Resolve SPA page for SEO: path URLs / data-grom-route first, hash only as fallback. */
  function currentSeoPage() {
    try {
      var fromAttr = document.documentElement.getAttribute('data-grom-route') || '';
      if (fromAttr) {
        if (fromAttr === 'trade') return 'futures';
        if (fromAttr === 'stocks' || fromAttr === 'stock') return 'xstocks';
        if (fromAttr === 'binary' || fromAttr === 'spot') return 'dashboard';
        return fromAttr;
      }
    } catch (_) {}
    try {
      var map = window.GROM_PATH_MAP || {};
      var seg = (location.pathname || '/').replace(/^\/|\/$/g, '').split('/')[0] || '';
      if (Object.prototype.hasOwnProperty.call(map, seg)) {
        var fromPath = map[seg];
        if (fromPath === 'trade') return 'futures';
        if (fromPath === 'stocks' || fromPath === 'stock') return 'xstocks';
        if (fromPath === 'binary' || fromPath === 'spot') return 'dashboard';
        return fromPath;
      }
    } catch (_) {}
    try {
      var hash = (location.hash || '').replace(/^#/, '').split('?')[0];
      if (hash) {
        if (hash === 'trade') return 'futures';
        if (hash === 'stocks' || hash === 'stock' || hash === 'акции') return 'xstocks';
        if (hash === 'binary' || hash === 'spot') return 'dashboard';
        return hash;
      }
    } catch (_) {}
    return 'landing';
  }

  function pathForSeoPage(page) {
    var pathOf = window.GROM_PATH_OF || {};
    if (pathOf[page]) return pathOf[page];
    return SEO_ROUTE_PATH[page] || '/';
  }

  function canonicalUrlFor(page, lang) {
    var key = page || 'landing';
    if (key === 'trade') key = 'futures';
    if (key === 'stocks' || key === 'stock') key = 'xstocks';
    if (key === 'binary' || key === 'spot') key = 'dashboard';
    var locale = normalizeLang(lang) === 'pt' ? 'pt-BR' : normalizeLang(lang);
    var prefix = Object.prototype.hasOwnProperty.call(SEO_LOCALE_PREFIX, locale)
      ? SEO_LOCALE_PREFIX[locale]
      : '';
    return 'https://grom.exchange' + prefix + (SEO_ROUTE_PATH[key] || '/');
  }

  function htmlLangFor(lang) {
    try {
      var queryLang = new URLSearchParams(location.search).get('lang');
      if (queryLang && LANGS.indexOf(normalizeLang(queryLang)) !== -1) {
        return normalizeLang(queryLang) === 'pt' && queryLang.toLowerCase() === 'pt-br'
          ? 'pt-BR'
          : (HREFLANG[normalizeLang(queryLang)] || queryLang);
      }
      var renderedLocale = document.documentElement.getAttribute('data-grom-locale');
      if (renderedLocale && normalizeLang(renderedLocale) !== 'en') return renderedLocale;
      if (renderedLocale === 'en') lang = curLang();
    } catch (_) {}
    return HREFLANG[normalizeLang(lang)] || normalizeLang(lang) || 'en';
  }

  function pageBlurb(route, lang) {
    var pack = PAGE_BLURBS[route];
    if (!pack) return '';
    return pack[lang] || pack.en || '';
  }

  function applyLangFromQuery() {
    try {
      var q = (new URLSearchParams(location.search).get('lang') || '').toLowerCase();
      if (q && LANGS.indexOf(q) !== -1) {
        localStorage.setItem('grom_lang', q);
        document.documentElement.lang = q === 'zh' ? 'zh-Hans' : q;
        return q;
      }
    } catch (_) {}
    return null;
  }

  function refreshMeta() {
    if (typeof window.gromSeoRefreshRouteMeta === 'function') {
      window.gromSeoRefreshRouteMeta(currentSeoPage());
    }
  }

  function refreshLight() {
    updateDetailsSummaries();
    if (document.getElementById('lpSeoPrimary')) renderPrimaryBlock();
    refreshMeta();
  }

  function refreshAll() {
    refreshLight();
    scheduleMultilang();
  }

  function hookSetLang() {
    if (typeof window.setGromLang !== 'function' || window.setGromLang.__gromSeoHook) return;
    var orig = window.setGromLang;
    window.setGromLang = function (lng) {
      orig(lng);
      refreshLight();
    };
    window.setGromLang.__gromSeoHook = true;
  }

  function init() {
    applyLangFromQuery();
    updateDetailsSummaries();
    injectHreflang();
    hookSetLang();
    refreshMeta();
    try {
      window.addEventListener('grom:route-change', function (ev) {
        try {
          var page = (ev && ev.detail && ev.detail.page) || currentSeoPage();
          if (typeof window.gromSeoRefreshRouteMeta === 'function') {
            window.gromSeoRefreshRouteMeta(page);
          }
          injectHreflang(true);
        } catch (_) {}
      });
    } catch (_) {}
    /* Late pass: hash→path boot can settle after the first refreshMeta. */
    setTimeout(function () {
      try { refreshMeta(); } catch (_) {}
    }, 0);
    setTimeout(function () {
      try { refreshMeta(); } catch (_) {}
    }, 50);
    var deferPrimary = function () {
      try { renderPrimaryBlock(); } catch (_) {}
    };
    if (window.GROM_LANDING || window.GROM_SAFARI) {
      if (typeof requestIdleCallback === 'function') requestIdleCallback(deferPrimary, { timeout: 8000 });
      else setTimeout(deferPrimary, 3000);
    } else if (document.getElementById('lpSeoPrimary')) {
      deferPrimary();
    }
    var mlHost = document.getElementById('lpSeoMultilangWrap') || document.getElementById('lpSeoMultilang');
    if (mlHost && typeof IntersectionObserver === 'function') {
      var obs = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) {
            obs.disconnect();
            scheduleMultilang();
          }
        });
      }, { rootMargin: '200px 0px' });
      obs.observe(mlHost);
    }
    var mlWrap = document.getElementById('lpSeoMultilangWrap');
    if (mlWrap) {
      mlWrap.addEventListener('toggle', function () {
        if (mlWrap.open && document.getElementById('lpSeoMultilang') && document.getElementById('lpSeoMultilang').dataset.seoBuilt !== '1') {
          scheduleMultilang();
        }
      });
    }
    setTimeout(function () {
      if (window.GROM_LANDING || window.GROM_SAFARI) return;
      if (document.getElementById('lpSeoMultilang') && document.getElementById('lpSeoMultilang').dataset.seoBuilt !== '1') {
        scheduleMultilang();
      }
    }, 12000);
  }

  window.GROM_SEO_I18N = {
    LANGS: LANGS,
    BLOCKS: BLOCKS,
    ROUTE_META: ROUTE_META,
    PAGE_BLURBS: PAGE_BLURBS,
    getRouteMeta: getRouteMeta,
    currentSeoPage: currentSeoPage,
    canonicalUrlFor: canonicalUrlFor,
    htmlLangFor: htmlLangFor,
    seoLang: seoLang,
    pageBlurb: pageBlurb,
    curLang: curLang,
    renderPrimaryBlock: renderPrimaryBlock,
    renderMultilang: renderMultilang,
    scheduleMultilang: scheduleMultilang,
    refreshLight: refreshLight,
    refreshAll: refreshAll,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(init, 0);
    }, { once: true });
  } else {
    setTimeout(init, 0);
  }
})();
