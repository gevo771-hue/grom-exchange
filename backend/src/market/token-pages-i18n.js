/**
 * Coin pages /token/<id> in the site's SEO languages (owner, 22.11: «на многих языках, чтобы было
 * больше охвата»). Same set and URL prefixes as scripts/seo-locales.mjs: /es/token/pepe, /ru/token/pepe…
 * English has no prefix and is x-default.
 *
 * Every function returns plain text; token-pages.js escapes it.
 * Brand policy: no Hyperliquid / Polymarket / Kalshi / Backed / xStocks in the copy.
 */

const list = (items, and) => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} ${and} ${items[items.length - 1]}`);

export const TOKEN_LOCALES = [
  { code: 'en', prefix: '', htmlLang: 'en', hreflang: 'en', num: 'en-US', about: 'About', explore: 'Explore GROM', nav: ['Home', 'Swap', 'Trade', 'Predictions', 'Stocks', 'Markets'] },
  { code: 'es', prefix: '/es', htmlLang: 'es', hreflang: 'es', num: 'es-ES', about: 'Acerca de', explore: 'Explorar GROM', nav: ['Inicio', 'Swap', 'Trade', 'Predicciones', 'Stocks', 'Markets'] },
  { code: 'pt-BR', prefix: '/pt-BR', htmlLang: 'pt-BR', hreflang: 'pt-BR', num: 'pt-BR', about: 'Sobre', explore: 'Explorar GROM', nav: ['Início', 'Swap', 'Trade', 'Predições', 'Stocks', 'Markets'] },
  { code: 'tr', prefix: '/tr', htmlLang: 'tr', hreflang: 'tr', num: 'tr-TR', about: 'Hakkında', explore: 'GROM’u keşfet', nav: ['Ana sayfa', 'Swap', 'Trade', 'Predictions', 'Stocks', 'Markets'] },
  { code: 'ru', prefix: '/ru', htmlLang: 'ru', hreflang: 'ru', num: 'ru-RU', about: 'О токене', explore: 'Обзор GROM', nav: ['Главная', 'Swap', 'Trade', 'Predictions', 'Stocks', 'Markets'] },
  { code: 'vi', prefix: '/vi', htmlLang: 'vi', hreflang: 'vi', num: 'vi-VN', about: 'Giới thiệu', explore: 'Khám phá GROM', nav: ['Trang chủ', 'Swap', 'Trade', 'Predictions', 'Stocks', 'Markets'] },
  { code: 'id', prefix: '/id', htmlLang: 'id', hreflang: 'id', num: 'id-ID', about: 'Tentang', explore: 'Jelajahi GROM', nav: ['Beranda', 'Swap', 'Trade', 'Predictions', 'Stocks', 'Markets'] },
];

export const TOKEN_LOCALE_CODES = TOKEN_LOCALES.map((l) => l.code);

/** Locale by code (`en`, `pt-BR`…), or null for anything else. */
export function tokenLocale(code) {
  return TOKEN_LOCALES.find((l) => l.code === String(code || 'en')) || null;
}

/** /token/pepe, /ru/token/pepe … */
export function tokenPath(id, code = 'en') {
  const loc = tokenLocale(code) || TOKEN_LOCALES[0];
  return `${loc.prefix}/token/${id}`;
}

/*
 * p = { sym, name, nm (name with ticker, or the ticker alone), chains: [names], main, addr,
 *       price, pct, up, time, rank, vol }
 */
export const TOKEN_COPY = {
  en: {
    title: (p) => `Buy ${p.sym} — ${p.name} Price & Cross-Chain Swap | GROM`,
    where: (c) => c.slice(0, 3).join(', ') + (c.length > 3 ? ' and more' : ''),
    desc: (p, where) => `Swap or buy ${p.nm} on ${where} from your own wallet. Live ${p.sym} price, 24h change and contract addresses. No sign-up, no deposit.`,
    h1: (p) => `${p.name} (${p.sym}) price and swap`,
    lead: (p) => `Live ${p.sym} price, networks and contract addresses. Buy or swap ${p.sym} on ${p.chains.join(', ')} straight from your self-custody wallet with GROM — no sign-up and no deposit.`,
    priceH2: (p) => `${p.sym} price today`,
    price: (p) => `${p.name} (${p.sym}) trades at $${p.price}`
      + (p.pct != null ? `, ${p.up ? 'up' : 'down'} ${p.pct}% over the last 24 hours` : '')
      + ` (CoinGecko data, ${p.time} UTC).`
      + (p.rank ? ` Market cap rank #${p.rank}.` : '')
      + (p.vol ? ` 24h trading volume: $${p.vol}.` : ''),
    priceNone: (p) => `${p.name} (${p.sym}) price and 24h change load live in the swap.`,
    netH2: 'Networks and contract addresses',
    check: 'Always check the contract address before you swap — tokens with the same ticker exist on many networks.',
    howH2: (p) => `How to buy ${p.sym} on GROM`,
    steps: (p) => [
      'Connect a self-custody wallet (browser extension or WalletConnect).',
      `Open the swap with ${p.sym} selected and choose the token you pay with — on any supported network.`,
      'Review the route, fees and the amount you receive.',
      `Confirm the transaction in your wallet. ${p.sym} arrives at your address on ${p.main}.`,
    ],
    riskH2: 'Risks',
    riskMeme: 'Meme coins are highly volatile and can lose most of their value quickly. Quotes depend on available liquidity and can change before you sign. This page is information, not investment advice.',
    riskOther: 'Crypto prices are volatile. Quotes depend on available liquidity and can change before you sign. This page is information, not investment advice.',
    moreH2: 'More tokens',
    faqH2: 'FAQ',
    faq: (p) => [
      { q: `How do I buy ${p.sym} without KYC?`, a: `Connect a self-custody wallet on GROM, choose the token you pay with and confirm the swap to ${p.sym} in your wallet. GROM has no account and no deposit; third-party services and some regions may apply their own checks.` },
      { q: `Which networks is ${p.sym} on?`, a: `GROM can swap ${p.sym} on ${p.chains.join(', ')}. Pay with tokens on the same network or on another one — the route bridges for you.` },
      { q: `What is the ${p.sym} contract address on ${p.main}?`, a: `${p.addr}. Always check the address before you swap: tokens with the same ticker exist on many networks.` },
    ],
    notFound: 'Token not found.',
    openSwap: 'Open the GROM swap',
  },

  es: {
    title: (p) => `Comprar ${p.sym} — precio de ${p.name} y swap entre cadenas | GROM`,
    where: (c) => c.slice(0, 3).join(', ') + (c.length > 3 ? ' y más' : ''),
    desc: (p, where) => `Haz swap o compra ${p.nm} en ${where} desde tu propio monedero. Precio de ${p.sym} en vivo, variación en 24 h y direcciones de contrato. Sin registro ni depósito.`,
    h1: (p) => `${p.name} (${p.sym}): precio y swap`,
    lead: (p) => `Precio de ${p.sym} en vivo, redes y direcciones de contrato. Compra o intercambia ${p.sym} en ${list(p.chains, 'y')} directamente desde tu monedero de autocustodia con GROM, sin registro ni depósito.`,
    priceH2: (p) => `Precio de ${p.sym} hoy`,
    price: (p) => `${p.name} (${p.sym}) cotiza a $${p.price}`
      + (p.pct != null ? `, ${p.up ? 'sube' : 'baja'} un ${p.pct} % en las últimas 24 horas` : '')
      + ` (datos de CoinGecko, ${p.time} UTC).`
      + (p.rank ? ` Puesto n.º ${p.rank} por capitalización de mercado.` : '')
      + (p.vol ? ` Volumen de negociación en 24 h: $${p.vol}.` : ''),
    priceNone: (p) => `El precio de ${p.name} (${p.sym}) y su variación en 24 h se cargan en vivo en el swap.`,
    netH2: 'Redes y direcciones de contrato',
    check: 'Comprueba siempre la dirección del contrato antes del swap: hay tokens con el mismo ticker en muchas redes.',
    howH2: (p) => `Cómo comprar ${p.sym} en GROM`,
    steps: (p) => [
      'Conecta un monedero de autocustodia (extensión del navegador o WalletConnect).',
      `Abre el swap con ${p.sym} seleccionado y elige el token con el que pagas, en cualquier red compatible.`,
      'Revisa la ruta, las comisiones y la cantidad que recibes.',
      `Confirma la transacción en tu monedero. ${p.sym} llega a tu dirección en ${p.main}.`,
    ],
    riskH2: 'Riesgos',
    riskMeme: 'Las meme coins son muy volátiles y pueden perder rápidamente la mayor parte de su valor. Las cotizaciones dependen de la liquidez disponible y pueden cambiar antes de que firmes. Esta página es informativa, no es un consejo de inversión.',
    riskOther: 'Los precios de las criptomonedas son volátiles. Las cotizaciones dependen de la liquidez disponible y pueden cambiar antes de que firmes. Esta página es informativa, no es un consejo de inversión.',
    moreH2: 'Más tokens',
    faqH2: 'Preguntas frecuentes',
    faq: (p) => [
      { q: `¿Cómo compro ${p.sym} sin KYC?`, a: `Conecta un monedero de autocustodia en GROM, elige el token con el que pagas y confirma el swap a ${p.sym} en tu monedero. GROM no tiene cuentas ni depósitos; los servicios de terceros y algunas regiones pueden aplicar sus propias verificaciones.` },
      { q: `¿En qué redes está ${p.sym}?`, a: `GROM puede hacer swap de ${p.sym} en ${list(p.chains, 'y')}. Paga con tokens de la misma red o de otra: la ruta hace el puente por ti.` },
      { q: `¿Cuál es la dirección del contrato de ${p.sym} en ${p.main}?`, a: `${p.addr}. Comprueba siempre la dirección antes del swap: hay tokens con el mismo ticker en muchas redes.` },
    ],
    notFound: 'Token no encontrado.',
    openSwap: 'Abrir el swap de GROM',
  },

  'pt-BR': {
    title: (p) => `Comprar ${p.sym} — preço de ${p.name} e swap entre redes | GROM`,
    where: (c) => c.slice(0, 3).join(', ') + (c.length > 3 ? ' e mais' : ''),
    desc: (p, where) => `Faça swap ou compre ${p.nm} em ${where} pela sua própria carteira. Preço de ${p.sym} ao vivo, variação em 24 h e endereços de contrato. Sem cadastro, sem depósito.`,
    h1: (p) => `${p.name} (${p.sym}): preço e swap`,
    lead: (p) => `Preço de ${p.sym} ao vivo, redes e endereços de contrato. Compre ou troque ${p.sym} em ${list(p.chains, 'e')} direto da sua carteira de autocustódia com a GROM — sem cadastro e sem depósito.`,
    priceH2: (p) => `Preço de ${p.sym} hoje`,
    price: (p) => `${p.name} (${p.sym}) está cotado a $${p.price}`
      + (p.pct != null ? `, ${p.up ? 'alta' : 'queda'} de ${p.pct}% nas últimas 24 horas` : '')
      + ` (dados da CoinGecko, ${p.time} UTC).`
      + (p.rank ? ` Posição nº ${p.rank} em capitalização de mercado.` : '')
      + (p.vol ? ` Volume negociado em 24 h: $${p.vol}.` : ''),
    priceNone: (p) => `O preço de ${p.name} (${p.sym}) e a variação em 24 h carregam ao vivo no swap.`,
    netH2: 'Redes e endereços de contrato',
    check: 'Sempre confira o endereço do contrato antes do swap — existem tokens com o mesmo ticker em várias redes.',
    howH2: (p) => `Como comprar ${p.sym} na GROM`,
    steps: (p) => [
      'Conecte uma carteira de autocustódia (extensão do navegador ou WalletConnect).',
      `Abra o swap com ${p.sym} selecionado e escolha o token com que vai pagar — em qualquer rede suportada.`,
      'Confira a rota, as taxas e o valor que você recebe.',
      `Confirme a transação na carteira. O ${p.sym} chega ao seu endereço na rede ${p.main}.`,
    ],
    riskH2: 'Riscos',
    riskMeme: 'Meme coins são muito voláteis e podem perder rapidamente a maior parte do valor. As cotações dependem da liquidez disponível e podem mudar antes de você assinar. Esta página é informativa, não é recomendação de investimento.',
    riskOther: 'Os preços de criptomoedas são voláteis. As cotações dependem da liquidez disponível e podem mudar antes de você assinar. Esta página é informativa, não é recomendação de investimento.',
    moreH2: 'Mais tokens',
    faqH2: 'Perguntas frequentes',
    faq: (p) => [
      { q: `Como comprar ${p.sym} sem KYC?`, a: `Conecte uma carteira de autocustódia na GROM, escolha o token com que vai pagar e confirme o swap para ${p.sym} na carteira. A GROM não tem conta nem depósito; serviços de terceiros e algumas regiões podem fazer as próprias verificações.` },
      { q: `Em quais redes o ${p.sym} está disponível?`, a: `A GROM faz swap de ${p.sym} em ${list(p.chains, 'e')}. Pague com tokens da mesma rede ou de outra — a rota faz a ponte para você.` },
      { q: `Qual é o endereço do contrato de ${p.sym} na rede ${p.main}?`, a: `${p.addr}. Sempre confira o endereço antes do swap: existem tokens com o mesmo ticker em várias redes.` },
    ],
    notFound: 'Token não encontrado.',
    openSwap: 'Abrir o swap da GROM',
  },

  tr: {
    title: (p) => `${p.sym} Satın Al — ${p.name} Fiyatı ve Zincirler Arası Swap | GROM`,
    where: (c) => c.slice(0, 3).join(', ') + (c.length > 3 ? ' ve diğer ağlar' : ''),
    desc: (p, where) => `${where} üzerinde ${p.nm} token’ını kendi cüzdanınızdan alın veya swap edin. Canlı ${p.sym} fiyatı, 24 saatlik değişim ve kontrat adresleri. Kayıt ve para yatırma gerekmez.`,
    h1: (p) => `${p.name} (${p.sym}) fiyatı ve swap`,
    lead: (p) => `Canlı ${p.sym} fiyatı, ağlar ve kontrat adresleri. GROM ile ${list(p.chains, 've')} üzerinde ${p.sym} token’ını doğrudan emanetsiz (self-custody) cüzdanınızdan alın veya swap edin — kayıt ve para yatırma gerekmez.`,
    priceH2: (p) => `Bugün ${p.sym} fiyatı`,
    price: (p) => `${p.name} (${p.sym}) şu anda $${p.price} seviyesinde işlem görüyor`
      + (p.pct != null ? `; son 24 saatte %${p.pct} ${p.up ? 'yükseldi' : 'düştü'}` : '')
      + ` (CoinGecko verisi, ${p.time} UTC).`
      + (p.rank ? ` Piyasa değeri sıralaması: #${p.rank}.` : '')
      + (p.vol ? ` 24 saatlik işlem hacmi: $${p.vol}.` : ''),
    priceNone: (p) => `${p.name} (${p.sym}) fiyatı ve 24 saatlik değişim swap ekranında canlı yüklenir.`,
    netH2: 'Ağlar ve kontrat adresleri',
    check: 'Swap yapmadan önce kontrat adresini mutlaka kontrol edin — aynı sembole sahip tokenlar birçok ağda bulunur.',
    howH2: (p) => `GROM’da ${p.sym} nasıl alınır?`,
    steps: (p) => [
      'Emanetsiz bir cüzdan bağlayın (tarayıcı eklentisi veya WalletConnect).',
      `${p.sym} seçili swap ekranını açın ve ödeme yapacağınız tokenı seçin — desteklenen herhangi bir ağda.`,
      'Rotayı, ücretleri ve alacağınız miktarı kontrol edin.',
      `İşlemi cüzdanınızda onaylayın. ${p.sym}, ${p.main} ağındaki adresinize gelir.`,
    ],
    riskH2: 'Riskler',
    riskMeme: 'Meme coin’ler çok oynaktır ve değerlerinin büyük kısmını hızla kaybedebilir. Fiyat teklifleri mevcut likiditeye bağlıdır ve siz imzalamadan önce değişebilir. Bu sayfa bilgilendirme amaçlıdır, yatırım tavsiyesi değildir.',
    riskOther: 'Kripto fiyatları oynaktır. Fiyat teklifleri mevcut likiditeye bağlıdır ve siz imzalamadan önce değişebilir. Bu sayfa bilgilendirme amaçlıdır, yatırım tavsiyesi değildir.',
    moreH2: 'Diğer tokenlar',
    faqH2: 'Sık sorulan sorular',
    faq: (p) => [
      { q: `KYC olmadan ${p.sym} nasıl alınır?`, a: `GROM’da emanetsiz bir cüzdan bağlayın, ödeme yapacağınız tokenı seçin ve ${p.sym} swap işlemini cüzdanınızda onaylayın. GROM’da hesap ve para yatırma yoktur; üçüncü taraf hizmetler ve bazı bölgeler kendi kontrollerini uygulayabilir.` },
      { q: `${p.sym} hangi ağlarda var?`, a: `GROM, ${p.sym} için ${list(p.chains, 've')} ağlarında swap yapabilir. Aynı ağdaki veya başka bir ağdaki tokenlarla ödeyin — rota köprüyü sizin için kurar.` },
      { q: `${p.main} ağında ${p.sym} kontrat adresi nedir?`, a: `${p.addr}. Swap yapmadan önce adresi mutlaka kontrol edin: aynı sembole sahip tokenlar birçok ağda bulunur.` },
    ],
    notFound: 'Token bulunamadı.',
    openSwap: 'GROM swap’ı aç',
  },

  ru: {
    title: (p) => `Купить ${p.sym} — курс ${p.name} и кросс-чейн своп | GROM`,
    where: (c) => (c.length > 1 ? 'сетях ' : 'сети ') + c.slice(0, 3).join(', ') + (c.length > 3 ? ' и других' : ''),
    desc: (p, where) => `Купите или обменяйте ${p.nm} в ${where} прямо со своего кошелька. Курс ${p.sym} онлайн, изменение за 24 ч и адреса контрактов. Без регистрации и депозита.`,
    h1: (p) => `${p.name} (${p.sym}): курс и обмен`,
    lead: (p) => `Курс ${p.sym} в реальном времени, сети и адреса контрактов. Покупайте и обменивайте ${p.sym} в ${p.chains.length > 1 ? 'сетях' : 'сети'} ${list(p.chains, 'и')} прямо со своего некастодиального кошелька в GROM — без регистрации и депозита.`,
    priceH2: (p) => `Курс ${p.sym} сегодня`,
    price: (p) => `${p.name} (${p.sym}) торгуется по $${p.price}`
      + (p.pct != null ? `, ${p.up ? 'рост' : 'падение'} на ${p.pct}% за 24 часа` : '')
      + ` (данные CoinGecko, ${p.time} UTC).`
      + (p.rank ? ` Место по капитализации: #${p.rank}.` : '')
      + (p.vol ? ` Объём торгов за 24 ч: $${p.vol}.` : ''),
    priceNone: (p) => `Курс ${p.name} (${p.sym}) и изменение за 24 ч загружаются в свопе в реальном времени.`,
    netH2: 'Сети и адреса контрактов',
    check: 'Всегда проверяйте адрес контракта перед обменом: токены с тем же тикером есть во многих сетях.',
    howH2: (p) => `Как купить ${p.sym} в GROM`,
    steps: (p) => [
      'Подключите некастодиальный кошелёк (расширение браузера или WalletConnect).',
      `Откройте своп с выбранным ${p.sym} и выберите токен, которым платите, — в любой поддерживаемой сети.`,
      'Проверьте маршрут, комиссии и сумму, которую получите.',
      `Подтвердите транзакцию в кошельке. ${p.sym} придёт на ваш адрес в сети ${p.main}.`,
    ],
    riskH2: 'Риски',
    riskMeme: 'Мем-токены очень волатильны и могут быстро потерять бо́льшую часть стоимости. Котировки зависят от доступной ликвидности и могут измениться до подписи. Эта страница — информация, а не инвестиционная рекомендация.',
    riskOther: 'Цены криптовалют волатильны. Котировки зависят от доступной ликвидности и могут измениться до подписи. Эта страница — информация, а не инвестиционная рекомендация.',
    moreH2: 'Другие токены',
    faqH2: 'Частые вопросы',
    faq: (p) => [
      { q: `Как купить ${p.sym} без KYC?`, a: `Подключите некастодиальный кошелёк в GROM, выберите токен, которым платите, и подтвердите обмен на ${p.sym} в кошельке. В GROM нет аккаунта и депозита; сторонние сервисы и некоторые регионы могут применять свои проверки.` },
      { q: `В каких сетях есть ${p.sym}?`, a: `В GROM ${p.sym} можно обменять в ${p.chains.length > 1 ? 'сетях' : 'сети'} ${list(p.chains, 'и')}. Платите токенами из той же сети или из другой — маршрут сам переведёт средства между сетями.` },
      { q: `Какой адрес контракта ${p.sym} в сети ${p.main}?`, a: `${p.addr}. Всегда проверяйте адрес перед обменом: токены с тем же тикером есть во многих сетях.` },
    ],
    notFound: 'Токен не найден.',
    openSwap: 'Открыть своп GROM',
  },

  vi: {
    title: (p) => `Mua ${p.sym} — Giá ${p.name} và swap đa chuỗi | GROM`,
    where: (c) => c.slice(0, 3).join(', ') + (c.length > 3 ? ' và các mạng khác' : ''),
    desc: (p, where) => `Swap hoặc mua ${p.nm} trên ${where} ngay từ ví của bạn. Giá ${p.sym} trực tiếp, biến động 24 giờ và địa chỉ hợp đồng. Không cần đăng ký, không cần nạp tiền.`,
    h1: (p) => `Giá ${p.name} (${p.sym}) và swap`,
    lead: (p) => `Giá ${p.sym} theo thời gian thực, các mạng và địa chỉ hợp đồng. Mua hoặc swap ${p.sym} trên ${list(p.chains, 'và')} trực tiếp từ ví tự lưu ký với GROM — không cần đăng ký, không cần nạp tiền.`,
    priceH2: (p) => `Giá ${p.sym} hôm nay`,
    price: (p) => `${p.name} (${p.sym}) đang giao dịch ở mức $${p.price}`
      + (p.pct != null ? `, ${p.up ? 'tăng' : 'giảm'} ${p.pct}% trong 24 giờ qua` : '')
      + ` (dữ liệu CoinGecko, ${p.time} UTC).`
      + (p.rank ? ` Xếp hạng vốn hóa thị trường: #${p.rank}.` : '')
      + (p.vol ? ` Khối lượng giao dịch 24 giờ: $${p.vol}.` : ''),
    priceNone: (p) => `Giá ${p.name} (${p.sym}) và biến động 24 giờ được tải trực tiếp trong màn hình swap.`,
    netH2: 'Các mạng và địa chỉ hợp đồng',
    check: 'Luôn kiểm tra địa chỉ hợp đồng trước khi swap — có nhiều token cùng ký hiệu trên nhiều mạng.',
    howH2: (p) => `Cách mua ${p.sym} trên GROM`,
    steps: (p) => [
      'Kết nối ví tự lưu ký (tiện ích trình duyệt hoặc WalletConnect).',
      `Mở màn hình swap đã chọn sẵn ${p.sym} và chọn token dùng để thanh toán — trên bất kỳ mạng nào được hỗ trợ.`,
      'Kiểm tra tuyến, phí và số lượng bạn nhận được.',
      `Xác nhận giao dịch trong ví. ${p.sym} sẽ về địa chỉ của bạn trên ${p.main}.`,
    ],
    riskH2: 'Rủi ro',
    riskMeme: 'Meme coin biến động rất mạnh và có thể nhanh chóng mất phần lớn giá trị. Báo giá phụ thuộc vào thanh khoản hiện có và có thể thay đổi trước khi bạn ký. Trang này chỉ mang tính thông tin, không phải lời khuyên đầu tư.',
    riskOther: 'Giá crypto biến động mạnh. Báo giá phụ thuộc vào thanh khoản hiện có và có thể thay đổi trước khi bạn ký. Trang này chỉ mang tính thông tin, không phải lời khuyên đầu tư.',
    moreH2: 'Token khác',
    faqH2: 'Câu hỏi thường gặp',
    faq: (p) => [
      { q: `Làm sao mua ${p.sym} không cần KYC?`, a: `Kết nối ví tự lưu ký trên GROM, chọn token dùng để thanh toán và xác nhận swap sang ${p.sym} trong ví. GROM không có tài khoản và không cần nạp tiền; dịch vụ bên thứ ba và một số khu vực có thể áp dụng kiểm tra riêng.` },
      { q: `${p.sym} có trên những mạng nào?`, a: `GROM có thể swap ${p.sym} trên ${list(p.chains, 'và')}. Thanh toán bằng token trên cùng mạng hoặc mạng khác — tuyến sẽ tự bridge cho bạn.` },
      { q: `Địa chỉ hợp đồng ${p.sym} trên ${p.main} là gì?`, a: `${p.addr}. Luôn kiểm tra địa chỉ trước khi swap: có nhiều token cùng ký hiệu trên nhiều mạng.` },
    ],
    notFound: 'Không tìm thấy token.',
    openSwap: 'Mở swap GROM',
  },

  id: {
    title: (p) => `Beli ${p.sym} — Harga ${p.name} dan Swap Lintas Chain | GROM`,
    where: (c) => c.slice(0, 3).join(', ') + (c.length > 3 ? ' dan lainnya' : ''),
    desc: (p, where) => `Swap atau beli ${p.nm} di ${where} langsung dari dompet Anda. Harga ${p.sym} terkini, perubahan 24 jam, dan alamat kontrak. Tanpa daftar, tanpa deposit.`,
    h1: (p) => `Harga dan swap ${p.name} (${p.sym})`,
    lead: (p) => `Harga ${p.sym} terkini, jaringan, dan alamat kontrak. Beli atau swap ${p.sym} di ${list(p.chains, 'dan')} langsung dari dompet self-custody Anda dengan GROM — tanpa daftar dan tanpa deposit.`,
    priceH2: (p) => `Harga ${p.sym} hari ini`,
    price: (p) => `${p.name} (${p.sym}) diperdagangkan di $${p.price}`
      + (p.pct != null ? `, ${p.up ? 'naik' : 'turun'} ${p.pct}% dalam 24 jam terakhir` : '')
      + ` (data CoinGecko, ${p.time} UTC).`
      + (p.rank ? ` Peringkat kapitalisasi pasar #${p.rank}.` : '')
      + (p.vol ? ` Volume perdagangan 24 jam: $${p.vol}.` : ''),
    priceNone: (p) => `Harga ${p.name} (${p.sym}) dan perubahan 24 jam dimuat langsung di swap.`,
    netH2: 'Jaringan dan alamat kontrak',
    check: 'Selalu periksa alamat kontrak sebelum swap — token dengan ticker yang sama ada di banyak jaringan.',
    howH2: (p) => `Cara membeli ${p.sym} di GROM`,
    steps: (p) => [
      'Hubungkan dompet self-custody (ekstensi browser atau WalletConnect).',
      `Buka swap dengan ${p.sym} terpilih dan pilih token untuk membayar — di jaringan mana pun yang didukung.`,
      'Periksa rute, biaya, dan jumlah yang Anda terima.',
      `Konfirmasi transaksi di dompet. ${p.sym} masuk ke alamat Anda di ${p.main}.`,
    ],
    riskH2: 'Risiko',
    riskMeme: 'Meme coin sangat volatil dan bisa cepat kehilangan sebagian besar nilainya. Kuotasi bergantung pada likuiditas yang tersedia dan bisa berubah sebelum Anda menandatangani. Halaman ini bersifat informasi, bukan saran investasi.',
    riskOther: 'Harga kripto volatil. Kuotasi bergantung pada likuiditas yang tersedia dan bisa berubah sebelum Anda menandatangani. Halaman ini bersifat informasi, bukan saran investasi.',
    moreH2: 'Token lainnya',
    faqH2: 'Pertanyaan umum',
    faq: (p) => [
      { q: `Bagaimana cara membeli ${p.sym} tanpa KYC?`, a: `Hubungkan dompet self-custody di GROM, pilih token untuk membayar, lalu konfirmasi swap ke ${p.sym} di dompet. GROM tidak memakai akun dan tidak perlu deposit; layanan pihak ketiga dan beberapa wilayah dapat menerapkan pemeriksaan sendiri.` },
      { q: `${p.sym} ada di jaringan apa saja?`, a: `GROM dapat melakukan swap ${p.sym} di ${list(p.chains, 'dan')}. Bayar dengan token di jaringan yang sama atau jaringan lain — rute akan melakukan bridge untuk Anda.` },
      { q: `Apa alamat kontrak ${p.sym} di ${p.main}?`, a: `${p.addr}. Selalu periksa alamat sebelum swap: token dengan ticker yang sama ada di banyak jaringan.` },
    ],
    notFound: 'Token tidak ditemukan.',
    openSwap: 'Buka swap GROM',
  },
};
