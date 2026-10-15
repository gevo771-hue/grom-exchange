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
      landing: {"title":"GROM Exchange — Crypto DEX, Futures, Prediction Markets & Tokenized stocks","description":"Swaps, perpetual futures, prediction markets and tokenized stocks from your own wallet. No sign-up, no deposits, no KYC for swaps.","keywords":"crypto exchange, DEX, crypto futures, prediction markets, tokenized stocks, RWA"},
      dashboard: {"title":"Crypto Swaps & Cross-Chain Routes — GROM Exchange","description":"Compare available crypto swap and bridge routes. Supported tokens, networks, fees and output depend on the current quote. Confirm each transaction in your wallet.","keywords":"crypto swap, cross-chain swap, DEX aggregator, best route, non-custodial swap"},
      markets: {"title":"Crypto Markets & Live Prices — GROM Exchange","description":"Live prices, 24h volume and depth across crypto, TradFi and trending pairs. Open any market straight into the terminal.","keywords":"crypto prices, BTC price, ETH price, live crypto charts, market cap"},
      futures: {"title":"Perpetual Futures From Your Wallet — Up to 40x","description":"Trade spot and perpetual futures from a self-custody wallet. Margin stays on the venue — GROM never holds your deposit.","keywords":"crypto futures, perpetual futures, BTC futures, leverage trading, perp trading"},
      predict: {"title":"Prediction Markets — Politics, Sports, Crypto","description":"Explore event markets and review each market’s rules, collateral and current fees before submitting an order from your wallet. Availability depends on the venue and region.","keywords":"prediction markets, event forecasts, crypto predictions"},
      xstocks: {"title":"Tokenized Stocks On-Chain, 24/7 — AAPL, TSLA, NVDA","description":"Buy fractional tokenized equities any time, including weekends. Settles to the same wallet you swap and trade perps with. No brokerage account.","keywords":"tokenized stocks, trade stocks crypto, fractional stocks, RWA stocks, AAPL TSLA NVDA"},
    },
    ru: {
      landing: {"title":"GROM Exchange — некастодиальный DeFi-терминал","description":"Swap, perpetual futures, prediction markets и Tokenized Stocks с вашего кошелька. Без депозита на балансе GROM.","keywords":"крипто биржа, DEX, фьючерсы крипто, рынки прогнозов, Polymarket, токенизированные акции, акции"},
      dashboard: {"title":"Кроссчейн Swap криптовалют с вашего кошелька","description":"Обменивайте токены между сетями, подписывая в своём wallet. Котировки нескольких роутеров; settlement on-chain на ваш адрес.","keywords":"крипто своп, кросс-чейн обмен, DEX агрегатор, лучший маршрут"},
      markets: {"title":"Markets и живые цены — GROM Exchange","description":"Смотрите цены и открывайте Swap, Trade, Predictions или Stocks. Markets не хранит средства.","keywords":"курс биткоина, цена ETH, криптовалюты онлайн, график BTC, капитализация"},
      futures: {"title":"Spot и Perpetual Futures с вашего кошелька","description":"Торгуйте spot и перпетуалами с подписью из self-custody wallet. Маржа на venue — не на балансе GROM.","keywords":"фьючерсы крипто, бессрочные фьючерсы, BTC фьючерс, торговля с плечом"},
      predict: {"title":"Prediction Markets с вашего кошелька","description":"Позиции на событиях из средств подключённого wallet. Расчёт по правилам рынка, без произвольной выплаты GROM.","keywords":"рынки прогнозов, Polymarket аналог, Kalshi, ставки на события, прогнозы крипто"},
      xstocks: {"title":"Tokenized Stocks (RWA) on-chain 24/7 — GROM","description":"Токенизированная экспозиция к акциям с вашего кошелька, часто вне часов классической биржи. Это не брокерский счёт.","keywords":"токенизированные акции, акции крипто, AAPL TSLA NVDA, торговля акциями"},
    },
    es: {
      landing: {"title":"GROM Exchange — Terminal DeFi sin custodia","description":"Swap, futuros perpetuos, mercados de predicción y Tokenized Stocks desde tu propio monedero. Sin depósito custodial en GROM.","keywords":"exchange cripto, DEX, futuros cripto, mercados predicción, Polymarket, acciones tokenizadas"},
      dashboard: {"title":"Swap cripto cross-chain desde tu monedero","description":"Cambia tokens entre muchas redes firmando en tu wallet. Cotizaciones de varios routers; liquidación on-chain a tu dirección.","keywords":"swap cripto, swap cross-chain, agregador DEX, mejor ruta"},
      markets: {"title":"Markets y precios en vivo — GROM Exchange","description":"Descubre precios y abre Swap, Trade, Predictions o Stocks. Markets no custodia fondos; solo ayuda a elegir el mercado.","keywords":"precio bitcoin, precio ETH, gráficos cripto, capitalización mercado"},
      futures: {"title":"Spot y Perpetual Futures desde tu wallet","description":"Opera spot y perpetuos con firma desde un monedero de autocustodia. El margen vive en el venue, no en un saldo GROM.","keywords":"futuros cripto, futuros perpetuos, apalancamiento cripto, trading BTC"},
      predict: {"title":"Prediction Markets desde tu monedero","description":"Toma posiciones sobre eventos con fondos de tu wallet. Liquidación según las reglas del mercado, no un pago discrecional de GROM.","keywords":"mercados predicción, alternativa Polymarket, Kalshi, pronósticos eventos"},
      xstocks: {"title":"Tokenized Stocks (RWA) on-chain 24/7","description":"Exposición tokenizada a acciones desde tu monedero, a menudo fuera del horario bursátil tradicional. No es una cuenta de bróker.","keywords":"acciones tokenizadas, trading acciones cripto, AAPL TSLA NVDA"},
    },
    de: {
      landing: { title: 'GROM — Krypto-DEX, Futures, Prognosen & Aktien', description: 'Nicht-verwahrter Krypto-DEX: Cross-Chain-Swap, Spot, Perpetual-Futures, tokenisierte Aktien und Prognosemärkte im Polymarket/Kalshi-Stil.', keywords: 'Krypto Börse, DEX, Krypto Futures, Prognosemärkte, Polymarket, tokenisierte Aktien' },
      dashboard: {"title":"Krypto-Swaps und Cross-Chain-Routen — GROM","description":"Verfügbare Swap- und Bridge-Routen vergleichen. Netzwerke, Gebühren und Ausgabebetrag hängen vom aktuellen Angebot ab. Jede Transaktion in der eigenen Wallet bestätigen.","keywords":"Krypto Swap, Cross-Chain Swap, DEX Aggregator, beste Route"},
      markets: { title: 'Krypto-Kurse — BTC, ETH live | GROM', description: 'Live Krypto-Preise, 24h-Volumen, Top-Gewinner und -Verlierer. BTC, ETH, SOL vor Spot-, Futures-, Aktien- und Prognose-Trading.', keywords: 'Bitcoin Kurs, ETH Preis, Krypto Charts, Marktkapitalisierung' },
      futures: { title: 'Perpetual Futures aus der Wallet — bis 40x | GROM', description: 'Handle BTC, ETH, SOL und 30+ Perps mit Hebel bis 40x. 0.05% Taker, 0% Maker. Kein Exchange-Konto, keine Auszahlungswarteschlange.', keywords: 'Krypto Futures, Perpetual Futures, BTC Futures, Hebel Trading' },
      predict: { title: 'Prognosemärkte — Event-Wetten | GROM', description: 'Handele Prognosen zu Krypto, Sport und Politik mit Live-Wahrscheinlichkeiten. Non-custodial Event-Prognosen auf GROM.', keywords: 'Prognosemärkte, Polymarket Alternative, Kalshi, Event Prognosen' },
      xstocks: { title: 'Tokenisierte Aktien 24/7 — AAPL, TSLA, NVDA | GROM', description: 'Kaufe fractionale tokenisierte Aktien jederzeit, auch am Wochenende. Settlement in dieselbe Wallet wie Swap und Perps.', keywords: 'tokenisierte Aktien, Aktien mit Krypto handeln, AAPL TSLA NVDA' },
    },
    ko: {
      landing: { title: 'GROM — 크립토 DEX, 선물, 예측 시장 & 주식', description: '비수탁 크립토 DEX: 크로스체인 스왑, 현물, 무기한 선물, 토큰화 주식, Polymarket/Kalshi 스타일 예측 시장.', keywords: '크립토 거래소, DEX, 크립토 선물, 예측 시장, Polymarket, 토큰화 주식' },
      dashboard: {"title":"크립토 스왑 및 크로스체인 경로 — GROM","description":"사용 가능한 스왑과 브리지 경로를 비교하세요. 네트워크, 수수료 및 수령 금액은 현재 견적에 따라 달라집니다. 각 거래는 본인의 지갑에서 확인하세요.","keywords":"크립토 스왑, 크로스체인 스왑, DEX 애그리게이터, 최적 경로"},
      markets: { title: '크립토 시세 — BTC, ETH 실시간 | GROM', description: '실시간 크립토 가격, 24시간 거래량, 상승/하락 TOP. BTC, ETH, SOL — 현물·선물·주식·예측 거래 전.', keywords: '비트코인 시세, ETH 가격, 크립토 차트, 시가총액' },
      futures: { title: '지갑에서 무기한 선물 — 최대 40x | GROM', description: 'BTC, ETH, SOL 및 30+ 퍼프, 레버리지 최대 40x. 테이커 0.05%, 메이커 0%. 거래소 계정·출금 대기 없음.', keywords: '크립토 선물, 무기한 선물, BTC 선물, 레버리지 거래' },
      predict: { title: '예측 시장 — 이벤트 베팅 | GROM', description: '크립토·스포츠·정치 예측 시장, 실시간 확률. 비수탁 이벤트 예측 on GROM.', keywords: '예측 시장, Polymarket 대안, Kalshi, 이벤트 예측' },
      xstocks: { title: '토큰화 주식 24/7 — AAPL, TSLA, NVDA | GROM', description: '주말 포함 언제든 분할 토큰화 주식 매수. 스왑·퍼프와 같은 지갑으로 정산.', keywords: '토큰화 주식, 크립토 주식 거래, AAPL TSLA NVDA' },
    },
    zh: {
      landing: { title: 'GROM — 加密 DEX、期货、预测市场与股票', description: '非托管加密 DEX：跨链兑换、现货、永续期货、代币化股票、Polymarket/Kalshi 风格预测市场。', keywords: '加密货币交易所, DEX, 加密期货, 预测市场, Polymarket, 代币化股票' },
      dashboard: {"title":"加密兑换与跨链路由 — GROM","description":"比较可用的兑换和跨链路由。支持的网络、费用和到账金额取决于当前报价。每笔交易均需在自己的钱包中确认。","keywords":"加密兑换, 跨链兑换, DEX 聚合器, 最优路由"},
      markets: { title: '加密货币行情 — BTC、ETH 实时 | GROM', description: '实时加密价格、24小时成交量、涨跌幅榜。BTC、ETH、SOL — 现货、期货、股票、预测交易前查看。', keywords: '比特币价格, ETH价格, 加密行情, 市值' },
      futures: { title: '钱包内永续合约 — 最高 40x | GROM', description: '交易 BTC、ETH、SOL 及 30+ 永续，杠杆最高 40x。吃单 0.05%，挂单 0%。无需交易所账户与提现排队。', keywords: '加密期货, 永续合约, BTC期货, 杠杆交易' },
      predict: { title: '预测市场 — 事件投注 | GROM', description: '加密、体育、政治预测市场，实时概率。非托管事件预测 on GROM。', keywords: '预测市场, Polymarket替代, Kalshi, 事件预测' },
      xstocks: { title: '代币化股票 24/7 — AAPL、TSLA、NVDA | GROM', description: '随时（含周末）买入碎股代币化股票。与兑换、永续同一钱包结算。', keywords: '代币化股票, 加密交易股票, AAPL TSLA NVDA' },
    },
    ja: {
      landing: { title: 'GROM — 暗号DEX・先物・予測市場・株式', description: '非カストディアル暗号DEX：クロスチェーンスワップ、現物、パーペチュアル先物、トークン化株式、Polymarket/Kalshi型予測市場。', keywords: '暗号取引所, DEX, 暗号先物, 予測市場, Polymarket, トークン化株式' },
      dashboard: {"title":"暗号資産スワップとクロスチェーンルート — GROM","description":"利用可能なスワップとブリッジのルートを比較。対応ネットワーク、手数料、受取額は現在の見積もりによって異なります。各取引は自分のウォレットで確認してください。","keywords":"暗号スワップ, クロスチェーンスワップ, DEXアグリゲーター, 最適ルート"},
      markets: { title: '暗号相場 — BTC・ETH ライブ | GROM', description: 'リアルタイム暗号価格、24h出来高、騰落ランキング。BTC、ETH、SOL — 現物・先物・株式・予測の前に。', keywords: 'ビットコイン価格, ETH価格, 暗号チャート, 時価総額' },
      futures: { title: 'ウォレットからパーペチュアル — 最大40x | GROM', description: 'BTC・ETH・SOLほか30+パープ、レバレッジ最大40x。テイカー0.05%、メーカー0%。取引所口座も出金待ちも不要。', keywords: '暗号先物, パーペチュアル, BTC先物, レバレッジ' },
      predict: { title: '予測市場 — イベント賭け | GROM', description: '暗号・スポーツ・政治の予測市場、ライブ確率。非カストディアルイベント予測。', keywords: '予測市場, Polymarket代替, Kalshi, イベント予測' },
      xstocks: { title: 'トークン化株式 24/7 — AAPL・TSLA・NVDA | GROM', description: '週末も含めいつでも端株トークン化株式を購入。スワップ・パープと同じウォレットで決済。', keywords: 'トークン化株式, 暗号で株式取引, AAPL TSLA NVDA' },
    },
    fr: {
      landing: { title: 'GROM — DEX crypto, futures, prédictions & actions', description: 'DEX crypto non custodial : swap cross-chain, spot, futures perpétuels, actions tokenisées, marchés prédictifs Polymarket/Kalshi.', keywords: 'exchange crypto, DEX, futures crypto, marchés prédictifs, Polymarket, actions tokenisées' },
      dashboard: {"title":"Swaps crypto et routes cross-chain — GROM","description":"Comparez les routes de swap et de bridge disponibles. Réseaux, frais et montant reçu dépendent du devis actuel. Confirmez chaque transaction dans votre portefeuille.","keywords":"swap crypto, swap cross-chain, agrégateur DEX, meilleure route"},
      markets: { title: 'Prix crypto — BTC, ETH en direct | GROM', description: 'Prix crypto live, volume 24h, top hausses et baisses. BTC, ETH, SOL avant spot, futures, actions ou prédictions.', keywords: 'prix bitcoin, prix ETH, graphiques crypto, capitalisation' },
      futures: { title: 'Futures perpétuels depuis le wallet — jusqu\'à 40x | GROM', description: 'Tradez BTC, ETH, SOL et 30+ perps jusqu\'à 40x. 0,05 % taker, 0 % maker. Pas de compte exchange ni file de retrait.', keywords: 'futures crypto, perpétuels, futures BTC, trading levier' },
      predict: { title: 'Marchés prédictifs — paris sur événements | GROM', description: 'Marchés prédictifs crypto, sport, politique avec probabilités live. Prévisions non custodiales sur GROM.', keywords: 'marchés prédictifs, alternative Polymarket, Kalshi, prévisions événements' },
      xstocks: { title: 'Actions tokenisées 24/7 — AAPL, TSLA, NVDA | GROM', description: 'Achetez des actions tokenisées fractionnées à tout moment, week-end inclus. Même wallet que swap et perps.', keywords: 'actions tokenisées, trader actions crypto, AAPL TSLA NVDA' },
    },
    pt: {
      landing: {"title":"GROM Exchange — Terminal DeFi não custodial","description":"Swap, perpetual futures, prediction markets e Tokenized Stocks pela sua própria carteira. Sem depósito custodial na GROM.","keywords":"exchange cripto, DEX, futuros cripto, mercados previsão, Polymarket, ações tokenizadas"},
      dashboard: {"title":"Swap cripto cross-chain pela sua carteira","description":"Troque tokens entre várias redes assinando na wallet. Cotações de vários roteadores; liquidação on-chain no seu endereço.","keywords":"swap cripto, swap cross-chain, agregador DEX, melhor rota"},
      markets: {"title":"Markets e preços ao vivo — GROM Exchange","description":"Descubra preços e abra Swap, Trade, Predictions ou Stocks. Markets não custodia fundos; só ajuda a escolher o mercado.","keywords":"preço bitcoin, preço ETH, gráficos cripto, capitalização"},
      futures: {"title":"Spot e Perpetual Futures pela sua wallet","description":"Negocie spot e perpétuos com assinatura de uma carteira de autocustódia. A margem fica no venue, não em saldo GROM.","keywords":"futuros cripto, perpétuos, futuros BTC, alavancagem"},
      predict: {"title":"Prediction Markets pela sua carteira","description":"Posições em eventos com fundos da sua wallet. Liquidação pelas regras do mercado — não um pagamento discricionário da GROM.","keywords":"mercados previsão, alternativa Polymarket, Kalshi, previsões eventos"},
      xstocks: {"title":"Ações tokenizadas (RWA) on-chain 24/7 — GROM Stocks","description":"Exposição tokenizada a ações pela sua carteira, muitas vezes fora do horário da bolsa tradicional. Não é conta de corretora.","keywords":"ações tokenizadas, trading ações cripto, AAPL TSLA NVDA"},
    },
    ar: {
      landing: { title: 'GROM — DEX كريبتو، عقود آجلة، توقعات وأسهم', description: 'DEX كريبتو غير حاضن: swap cross-chain، سبوت، عقود دائمة، أسهم مرمّزة وأسواق توقعات بأسلوب Polymarket/Kalshi.', keywords: 'بورصة كريبتو, DEX, عقود آجلة, أسواق توقعات, Polymarket, أسهم مرمّزة' },
      dashboard: {"title":"مقايضات العملات الرقمية والمسارات عبر الشبكات — GROM","description":"قارن مسارات المقايضة والجسور المتاحة. تعتمد الشبكات والرسوم والمبلغ المستلم على عرض السعر الحالي. أكد كل معاملة في محفظتك.","keywords":"مبادلة كريبتو, مبادلة عبر السلاسل, مجمع DEX, أفضل مسار"},
      markets: { title: 'أسعار العملات — BTC وETH مباشر | GROM', description: 'أسعار كريبتو مباشرة، حجم 24 ساعة، أكبر الرابحين والخاسرين. BTC وETH وSOL قبل التداول.', keywords: 'سعر البitcoin, سعر ETH, رسوم كريبتو, القيمة السوقية' },
      futures: { title: 'عقود دائمة من المحفظة — حتى 40x | GROM', description: 'تداول BTC وETH وSOL وأكثر من 30 عقداً برافعة حتى 40x. آخذ 0.05٪ وصانع 0٪. بلا حساب بورصة أو طابور سحب.', keywords: 'عقود آجلة كريبتو, عقود دائمة, BTC futures, رافعة مالية' },
      predict: { title: 'أسواق التوقعات — رهانات على الأحداث | GROM', description: 'أسواق توقعات للكريبتو والرياضة والسياسة باحتمالات مباشرة. توقعات أحداث غير حاضنة على GROM.', keywords: 'أسواق توقعات, بديل Polymarket, Kalshi, توقعات أحداث' },
      xstocks: { title: 'أسهم مرمّزة على مدار الساعة — AAPL وTSLA وNVDA | GROM', description: 'اشترِ أسهماً مرمّزة مجزأة في أي وقت بما فيها عطلة نهاية الأسبوع. نفس محفظة المبادلة والعقود.', keywords: 'أسهم مرمّزة, تداول أسهم كريبتو, AAPL TSLA NVDA' },
    },
    tr: {
      landing: {"title":"GROM Exchange — Saklamasız DeFi terminali","description":"Kendi cüzdanınızdan Swap, perpetual futures, prediction markets ve Tokenized Stocks. GROM’da saklamalı mevduat yok.","keywords":"kripto borsası, DEX, kripto vadeli, tahmin piyasaları, Polymarket, tokenize hisseler"},
      dashboard: {"title":"Cüzdanınızdan zincirler arası kripto Swap","description":"Birçok ağ arasında token değiştirin; cüzdanınızda imzalayın. Birkaç router kotasyonu; settlement on-chain adresinize.","keywords":"kripto swap, cross-chain swap, DEX aggregator, en iyi rota"},
      markets: {"title":"Markets ve canlı fiyatlar — GROM Exchange","description":"Fiyatları keşfedin; Swap, Trade, Predictions veya Stocks’a geçin. Markets fon saklamaz.","keywords":"bitcoin fiyatı, ETH fiyatı, kripto grafik, piyasa değeri"},
      futures: {"title":"Cüzdanınızdan Spot ve Perpetual Futures","description":"Öz-saklama cüzdanıyla spot ve perpetual işlem. Marj venue’de kalır — GROM bakiyenizi tutmaz.","keywords":"kripto vadeli, perpetual, BTC vadeli, kaldıraçlı işlem"},
      predict: {"title":"Cüzdanınızdan Prediction Markets","description":"Bağlı cüzdan bakiyesiyle olay piyasalarında pozisyon. Çözüm piyasa kurallarına göre; GROM keyfi ödeme yapmaz.","keywords":"tahmin piyasaları, Polymarket alternatifi, Kalshi, olay tahminleri"},
      xstocks: {"title":"Tokenized Stocks (RWA) — zincir üstü 7/24","description":"Kendi cüzdanınızdan tokenleştirilmiş hisse maruziyeti; geleneksel borsa saatleri dışında da. Broker hesabı değil.","keywords":"tokenize hisseler, kripto ile hisse, AAPL TSLA NVDA"},
    },
    hi: {
      landing: { title: 'GROM Exchange — Non-Custodial DeFi Terminal', description: 'Swaps, perpetual futures, prediction markets and tokenized stocks from your own wallet. No sign-up, no deposits, no KYC for swaps.', keywords: 'crypto exchange, DEX, crypto futures, prediction markets, tokenized stocks' },
      dashboard: {"title":"क्रिप्टो स्वैप और क्रॉस-चेन रूट — GROM","description":"उपलब्ध स्वैप और ब्रिज रूट की तुलना करें। नेटवर्क, शुल्क और प्राप्त राशि वर्तमान कोट पर निर्भर हैं। हर लेनदेन अपने वॉलेट में पुष्टि करें।","keywords":"crypto swap, cross-chain swap, DEX aggregator, best route"},
      markets: { title: 'Crypto Prices — BTC, ETH Live | GROM', description: 'Live crypto prices, 24h volume, top movers. BTC, ETH, SOL before spot, futures, stocks or predictions.', keywords: 'bitcoin price, ETH price, crypto charts, market cap' },
      futures: { title: 'Perpetual futures from your wallet — up to 40x | GROM', description: 'Trade BTC, ETH, SOL and 30+ perps with up to 40x. 0.05% taker, 0% maker. No exchange account or withdrawal queue.', keywords: 'crypto futures, perpetual futures, BTC futures, leverage' },
      predict: { title: 'Prediction Markets — Event Betting | GROM', description: 'Prediction markets on crypto, sports, politics with live probabilities. Non-custodial on GROM.', keywords: 'prediction markets, Polymarket, Kalshi, event forecasts' },
      xstocks: { title: 'Tokenized stocks 24/7 — AAPL, TSLA, NVDA | GROM', description: 'Buy fractional tokenized equities anytime, including weekends. Same wallet as swap and perps.', keywords: 'tokenized stocks, trade stocks crypto, AAPL TSLA NVDA' },
    },
    vi: {
      landing: {"title":"GROM Exchange — Terminal DeFi không lưu ký","description":"Swap, perpetual futures, prediction markets và Tokenized Stocks từ ví của bạn. Không gửi ký quỹ custodial trên GROM.","keywords":"sàn crypto, DEX, futures crypto, thị trường dự đoán, Polymarket, cổ phiếu token"},
      dashboard: {"title":"Swap crypto cross-chain từ ví của bạn","description":"Đổi token giữa nhiều mạng, ký trong wallet. Nhiều router báo giá; settlement on-chain về địa chỉ của bạn.","keywords":"swap crypto, swap cross-chain, DEX aggregator, tuyến tốt nhất"},
      markets: {"title":"Markets và giá trực tiếp — GROM Exchange","description":"Khám phá giá rồi mở Swap, Trade, Predictions hoặc Stocks. Markets không lưu trữ tiền.","keywords":"giá bitcoin, giá ETH, biểu đồ crypto, vốn hóa"},
      futures: {"title":"Spot và Perpetual Futures từ ví của bạn","description":"Giao dịch spot và perpetual bằng chữ ký từ ví tự lưu ký. Margin nằm ở venue — GROM không giữ số dư.","keywords":"futures crypto, perpetual, BTC futures, đòn bẩy"},
      predict: {"title":"Prediction Markets từ ví của bạn","description":"Mở vị thế sự kiện bằng số dư ví đã kết nối. Thanh toán theo quy tắc thị trường; GROM không trả tùy ý.","keywords":"thị trường dự đoán, Polymarket, Kalshi, dự báo sự kiện"},
      xstocks: {"title":"Tokenized Stocks (RWA) on-chain 24/7 — GROM Stocks","description":"Phơi nhiễm cổ phiếu token hóa từ ví của bạn, thường ngoài giờ sàn truyền thống. Không phải tài khoản môi giới.","keywords":"cổ phiếu token, giao dịch cổ phiếu crypto, AAPL TSLA NVDA"},
    },
    id: {
      landing: {"title":"GROM Exchange — Terminal DeFi non-kustodial","description":"Swap, perpetual futures, prediction markets, dan Tokenized Stocks dari wallet Anda. Tanpa deposit kustodial di GROM.","keywords":"exchange kripto, DEX, futures kripto, pasar prediksi, Polymarket, saham tokenisasi"},
      dashboard: {"title":"Swap kripto lintas chain dari wallet Anda","description":"Tukar token antar jaringan; tanda tangani di wallet. Beberapa router memberi kuotasi; settlement on-chain ke alamat Anda.","keywords":"swap kripto, swap cross-chain, aggregator DEX, rute terbaik"},
      markets: {"title":"Markets dan harga live — GROM Exchange","description":"Jelajahi harga lalu buka Swap, Trade, Predictions, atau Stocks. Markets tidak menyimpan dana.","keywords":"harga bitcoin, harga ETH, grafik kripto, kapitalisasi pasar"},
      futures: {"title":"Spot dan Perpetual Futures dari wallet Anda","description":"Perdagangkan spot dan perpetual dengan tanda tangan dari wallet self-custody. Margin di venue — GROM tidak menyimpan saldo.","keywords":"futures kripto, perpetual, BTC futures, leverage"},
      predict: {"title":"Prediction Markets dari wallet Anda","description":"Ambil posisi pada peristiwa dengan saldo wallet yang terhubung. Resolusi mengikuti aturan pasar; GROM tidak membayar sewenang-wenang.","keywords":"pasar prediksi, alternatif Polymarket, Kalshi, prakiraan event"},
      xstocks: {"title":"Aksi tokenisasi (RWA) on-chain 24/7 — GROM Stocks","description":"Eksposur saham yang ditokenisasi dari wallet Anda, sering di luar jam bursa tradisional. Bukan rekening broker.","keywords":"saham tokenisasi, trading saham kripto, AAPL TSLA NVDA"},
    },
    th: {
      landing: { title: 'GROM — DEX คริปโต, futures, ทำนาย & หุ้น', description: 'DEX คริปโต แบบ non-custodial: swap cross-chain, spot, perpetual futures, หุ้นโทเคนไนซ์, ตลาดทำนายแบบ Polymarket/Kalshi', keywords: 'exchange คริปโต, DEX, futures คริปโต, ตลาดทำนาย, Polymarket, หุ้นโทเคน' },
      dashboard: {"title":"สวอปคริปโตและเส้นทางข้ามเชน — GROM","description":"เปรียบเทียบเส้นทางสวอปและบริดจ์ที่มีให้ใช้ เครือข่าย ค่าธรรมเนียม และจำนวนที่ได้รับขึ้นอยู่กับราคาปัจจุบัน ยืนยันแต่ละธุรกรรมในกระเป๋าของคุณ","keywords":"สวอปคริปโต, สวอปข้ามเชน, DEX aggregator, เส้นทางที่ดีที่สุด"},
      markets: { title: 'ราคา คริปโต — BTC, ETH สด | GROM', description: 'ราคา คริปโต สด, ปริมาณ 24 ชม., top ขึ้นลง. BTC, ETH, SOL ก่อนเทรด spot, futures, หุ้น, ทำนาย', keywords: 'ราคา bitcoin, ราคา ETH, กราฟ คริปโต, มูลค่าตลาด' },
      futures: { title: 'Perpetual จากกระเป๋า — สูงสุด 40x | GROM', description: 'เทรด BTC ETH SOL และ 30+ perp เลเวอเรจสูงสุด 40x Taker 0.05% Maker 0% ไม่ต้องมีบัญชีแลกเปลี่ยนหรือคิวถอน', keywords: 'futures คริปโต, perpetual, BTC futures, leverage' },
      predict: { title: 'ตลาดทำนาย — เดิมพันเหตุการณ์ | GROM', description: 'ตลาดทำนาย crypto กีฬา การเมือง ความน่าจะเป็นสด. non-custodial บน GROM', keywords: 'ตลาดทำนาย, Polymarket, Kalshi, พยากรณ์เหตุการณ์' },
      xstocks: { title: 'หุ้นโทเคนไนซ์ 24/7 — AAPL, TSLA, NVDA | GROM', description: 'ซื้อหุ้นโทเคนไนซ์แบบเศษส่วนได้ทุกเวลา รวมวันหยุดสุดสัปดาห์ กระเป๋าเดียวกับสวอปและ perp', keywords: 'หุ้นโทเคน, เทรดหุ้น crypto, AAPL TSLA NVDA' },
    },
    pl: {
      landing: { title: 'GROM — Krypto DEX, futures, predykcje i akcje', description: 'Niekustodialny krypto DEX: swap cross-chain, spot, perpetual futures, tokenizowane akcje, rynki predykcji Polymarket/Kalshi.', keywords: 'giełda krypto, DEX, futures krypto, rynki predykcji, Polymarket, akcje tokenizowane' },
      dashboard: {"title":"Swapy krypto i trasy cross-chain — GROM","description":"Porównaj dostępne trasy swap i bridge. Sieci, opłaty i otrzymana kwota zależą od aktualnej wyceny. Potwierdź każdą transakcję we własnym portfelu.","keywords":"swap krypto, swap cross-chain, aggregator DEX, najlepsza trasa"},
      markets: { title: 'Kursy krypto — BTC, ETH na żywo | GROM', description: 'Ceny krypto live, wolumen 24h, top wzrosty i spadki. BTC, ETH, SOL przed tradingiem.', keywords: 'cena bitcoin, cena ETH, wykresy krypto, kapitalizacja' },
      futures: { title: 'Perpetual z wallet — do 40x | GROM', description: 'Handluj BTC, ETH, SOL i 30+ perpami z dźwignią do 40x. 0,05% taker, 0% maker. Bez konta giełdy i kolejki wypłat.', keywords: 'futures krypto, perpetual, BTC futures, dźwignia' },
      predict: { title: 'Rynki predykcji — zakłady na wydarzenia | GROM', description: 'Rynki predykcji krypto, sport, polityka z live prawdopodobieństwami. Non-custodial na GROM.', keywords: 'rynki predykcji, alternatywa Polymarket, Kalshi, prognozy wydarzeń' },
      xstocks: { title: 'Tokenizowane akcje 24/7 — AAPL, TSLA, NVDA | GROM', description: 'Kupuj ułamkowe tokenizowane akcje o każdej porze, także w weekend. Ten sam wallet co swap i perpy.', keywords: 'akcje tokenizowane, akcje krypto, AAPL TSLA NVDA' },
    },
    uk: {
      landing: { title: 'GROM — Крипто DEX, ф\'ючерси, прогнози та акції', description: 'Некастodialний крипто DEX: cross-chain своп, спот, безстрокові ф\'ючерси, токенізовані акції, ринки прогнозів Polymarket/Kalshi.', keywords: 'крипто біржа, DEX, ф\'ючерси крипто, ринки прогнозів, Polymarket, токенізовані акції' },
      dashboard: {"title":"Криптосвопи та міжмережеві маршрути — GROM","description":"Порівнюйте доступні маршрути свопів і мостів. Мережі, комісії та отримана сума залежать від поточного котирування. Підтверджуйте кожну транзакцію у власному гаманці.","keywords":"крипто своп, крос-чейн обмін, DEX агрегатор, найкращий маршрут"},
      markets: { title: 'Курси криптовалют — BTC, ETH онлайн | GROM', description: 'Актуальні ціни крипто, обсяг 24г, топ зростання і падіння. BTC, ETH, SOL перед торгівлею.', keywords: 'курс біткоіна, ціна ETH, криптовалюти онлайн, графік BTC' },
      futures: { title: 'Безстрокові ф\'ючерси з гаманця — до 40x | GROM', description: 'Торгуйте BTC, ETH, SOL і 30+ перпами з плечем до 40x. 0.05% тейкер, 0% мейкер. Без акаунта біржі й черги на вивід.', keywords: 'ф\'ючерси крипто, perpetual, BTC ф\'ючерс, торгівля з плечем' },
      predict: { title: 'Ринки прогнозів — ставки на події | GROM', description: 'Прогнози з крипто, спорту та політики з live-ймовірностями. Некастodialно на GROM.', keywords: 'ринки прогнозів, аналог Polymarket, Kalshi, прогнози подій' },
      xstocks: { title: 'Токенізовані акції 24/7 — AAPL, TSLA, NVDA | GROM', description: 'Купуйте дробові токенізовані акції будь-коли, включно з вихідними. Той самий гаманець, що й для свопу та перпів.', keywords: 'токенізовані акції, акції крипто, AAPL TSLA NVDA' },
    },
    it: {
      landing: { title: 'GROM — DEX crypto, futures, previsioni e azioni', description: 'DEX crypto non custodial: swap cross-chain, spot, futures perpetui, azioni tokenizzate, mercati predittivi Polymarket/Kalshi.', keywords: 'exchange crypto, DEX, futures crypto, mercati predittivi, Polymarket, azioni tokenizzate' },
      dashboard: {"title":"Swap crypto e percorsi cross-chain — GROM","description":"Confronta i percorsi di swap e bridge disponibili. Reti, commissioni e importo ricevuto dipendono dalla quotazione attuale. Conferma ogni transazione nel tuo wallet.","keywords":"swap crypto, swap cross-chain, aggregatore DEX, migliore route"},
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
    if (ps && !document.querySelector('#lpSeoPrimary[data-seo-static]')) ps.textContent = PRIMARY_SUMMARY[lang] || PRIMARY_SUMMARY.en;
    if (ms) ms.textContent = ML_HEADING[lang] || ML_HEADING.en;
  }

  function curLang() {
    var pathLocale = /^\/(es|pt-BR|tr|ru|vi|id)(?:\/|$)/.exec(location.pathname || '');
    if (pathLocale) return pathLocale[1] === 'pt-BR' ? 'pt' : pathLocale[1];
    if (typeof window.getGromLang === 'function') {
      var g = window.getGromLang();
      if (LANGS.indexOf(g) !== -1) return g;
    }
    return 'en';
  }

  function esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function renderPrimaryBlock() {
    var host = document.getElementById('lpSeoPrimary');
    if (!host || host.hasAttribute('data-seo-static')) return;
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

  function injectHreflang() {
    var head = document.head;
    if (!head || head.querySelector('link[hreflang]')) return;
    var page = currentSeoPage();
    var path = pathForSeoPage(page);
    var basePath = path === '/' ? '/' : path;
    ['en', 'es', 'pt-BR', 'tr', 'ru', 'vi', 'id'].forEach(function (code) {
      var link = document.createElement('link');
      link.rel = 'alternate';
      link.hreflang = code;
      link.href = 'https://grom.exchange' + (code === 'en' ? '' : '/' + code) + basePath;
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
    if (page === 'landing') return '/';
    return '/';
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
