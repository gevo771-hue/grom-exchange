/**
 * Landing-only SEO copy (owner rule: SEO text lives on the landing page only).
 * 22.11.2026 — owner wants GROM to show up next to searches for Uniswap, Binance, meme tokens and other
 * popular platforms. Two extra sections + three FAQ items per landing locale, appended to the existing copy.
 * Facts checked against GET /api/swap/public-config on 22.11.2026 (aggregators: LI.FI, ParaSwap, KyberSwap,
 * Squid, Jupiter). Brand policy: never name Hyperliquid / Polymarket / Kalshi / Backed / xStocks here.
 * Comparison stays factual and neutral; the disclaimer says GROM is not affiliated with the named projects.
 */

/** CoinGecko ids of the meme coins linked from the landing — always present on /token/<id> (backend pin list). */
export const LANDING_MEME_TOKENS = [
  ['pepe', 'PEPE'],
  ['dogwifcoin', 'WIF'],
  ['bonk', 'BONK'],
  ['shiba-inu', 'SHIB'],
  ['floki', 'FLOKI'],
  ['based-brett', 'BRETT'],
  ['popcat', 'POPCAT'],
  ['pudgy-penguins', 'PENGU'],
  ['official-trump', 'TRUMP'],
  ['fartcoin', 'FARTCOIN'],
  ['mog-coin', 'MOG'],
  ['spx6900', 'SPX'],
  ['toshi', 'TOSHI'],
];

const PREFIX = { en: '', es: '/es', 'pt-BR': '/pt-BR', tr: '/tr', ru: '/ru', vi: '/vi', id: '/id' };
/* Coin pages exist in every SEO language (/ru/token/pepe…): each landing links to its own language. */
const tokenLinks = (prefix = '') => LANDING_MEME_TOKENS.map(([id, sym]) => `<a href="${prefix}/token/${id}">${sym}</a>`).join(', ');

const COPY = {
  en: {
    compareH2: 'A wallet-first alternative to Uniswap, PancakeSwap, 1inch and Binance',
    compare: [
      'If you already swap on Uniswap, PancakeSwap, 1inch or CoW Swap, GROM works the same way: you connect your own wallet, review the quote and sign the transaction yourself. On top of single-chain swaps, GROM compares routes from several aggregators — LI.FI, ParaSwap, KyberSwap, Squid and Jupiter on Solana — so you can buy a token on one network paying with assets on another, in one flow.',
      'Compared with centralized exchanges such as Binance, there is no account to open, no KYC for swaps and no deposit: funds stay in your wallet until you sign a trade, and tokens arrive at your own address. The trade-off is that you pay network gas and confirm each transaction yourself.',
    ],
    note: 'GROM is independent and not affiliated with Uniswap Labs, PancakeSwap, 1inch, CoW Protocol or Binance. Their names are used only to describe how GROM compares.',
    memeH2: 'Swap meme coins across chains',
    meme: 'Trending on DEX and NEW show meme coins that are moving on Ethereum, Base, BNB Chain, Solana and other networks. Open any of them straight into the swap — GROM looks for a route from the token you hold, even on another chain.',
    memeList: 'Popular meme coins:',
    memeRisk: 'Meme coins are highly volatile and can lose most of their value quickly — only trade what you can afford to lose.',
    faq: [
      { q: 'Is GROM an alternative to Uniswap or 1inch?', a: 'Yes, for wallet swaps. Like Uniswap or 1inch, GROM is non-custodial — you sign every swap in your own wallet. GROM also compares cross-chain routes from several aggregators, so one swap can move tokens between networks.' },
      { q: 'Can I use GROM instead of Binance without KYC?', a: 'For swaps, yes: GROM has no account, no KYC and no deposit — you trade from your own wallet. Unlike a centralized exchange, you pay network gas and confirm each transaction yourself. Third-party services and some regions may apply their own checks.' },
      { q: 'How do I buy meme coins like PEPE or WIF?', a: 'Open the token page (for example /token/pepe), connect your wallet, choose what to pay with and confirm the route in your wallet. The token arrives at your address on its network.' },
    ],
  },
  es: {
    compareH2: 'Una alternativa a Uniswap, PancakeSwap, 1inch y Binance desde tu monedero',
    compare: [
      'Si ya haces swaps en Uniswap, PancakeSwap, 1inch o CoW Swap, GROM funciona igual: conectas tu propio monedero, revisas la cotización y firmas tú mismo la transacción. Además de los swaps en una sola red, GROM compara rutas de varios agregadores — LI.FI, ParaSwap, KyberSwap, Squid y Jupiter en Solana — para que puedas comprar un token en una red pagando con activos de otra en un solo paso.',
      'Frente a exchanges centralizados como Binance, no hay cuenta que abrir, ni KYC para los swaps, ni depósito: los fondos permanecen en tu monedero hasta que firmas una operación y los tokens llegan a tu propia dirección. A cambio, pagas el gas de la red y confirmas cada transacción tú mismo.',
    ],
    note: 'GROM es independiente y no está afiliado a Uniswap Labs, PancakeSwap, 1inch, CoW Protocol ni Binance. Sus nombres se usan solo para comparar.',
    memeH2: 'Swap de meme coins entre redes',
    meme: 'Trending en DEX y NEW muestran las meme coins que se mueven en Ethereum, Base, BNB Chain, Solana y otras redes. Abre cualquiera directamente en el swap: GROM busca una ruta desde el token que tienes, incluso en otra red.',
    memeList: 'Meme coins populares:',
    memeRisk: 'Las meme coins son muy volátiles y pueden perder gran parte de su valor rápidamente: opera solo con lo que puedas permitirte perder.',
    faq: [
      { q: '¿Es GROM una alternativa a Uniswap o 1inch?', a: 'Sí, para swaps desde tu monedero. Como Uniswap o 1inch, GROM no custodia fondos: firmas cada swap en tu propio wallet. Además, GROM compara rutas cross-chain de varios agregadores, así que un solo swap puede mover tokens entre redes.' },
      { q: '¿Puedo usar GROM en lugar de Binance sin KYC?', a: 'Para swaps, sí: GROM no tiene cuenta, KYC ni depósito; operas desde tu propio monedero. A diferencia de un exchange centralizado, pagas el gas de la red y confirmas cada transacción. Algunos servicios de terceros y algunas regiones pueden aplicar sus propias comprobaciones.' },
      { q: '¿Cómo compro meme coins como PEPE o WIF?', a: 'Abre la página del token (por ejemplo /token/pepe), conecta tu monedero, elige con qué pagar y confirma la ruta en tu wallet. El token llega a tu dirección en su red.' },
    ],
  },
  'pt-BR': {
    compareH2: 'Uma alternativa a Uniswap, PancakeSwap, 1inch e Binance pela sua carteira',
    compare: [
      'Se você já faz swaps na Uniswap, PancakeSwap, 1inch ou CoW Swap, a GROM funciona do mesmo jeito: você conecta sua própria carteira, confere a cotação e assina a transação você mesmo. Além de swaps em uma única rede, a GROM compara rotas de vários agregadores — LI.FI, ParaSwap, KyberSwap, Squid e Jupiter na Solana — para você comprar um token em uma rede pagando com ativos de outra, em um só passo.',
      'Em comparação com exchanges centralizadas como a Binance, não há conta para abrir, nem KYC para swaps, nem depósito: os fundos ficam na sua carteira até você assinar uma operação, e os tokens chegam ao seu próprio endereço. Em troca, você paga o gas da rede e confirma cada transação.',
    ],
    note: 'A GROM é independente e não tem vínculo com Uniswap Labs, PancakeSwap, 1inch, CoW Protocol ou Binance. Os nomes são usados apenas para comparação.',
    memeH2: 'Swap de meme coins entre redes',
    meme: 'Trending na DEX e NEW mostram as meme coins em movimento na Ethereum, Base, BNB Chain, Solana e outras redes. Abra qualquer uma direto no swap — a GROM procura uma rota a partir do token que você tem, mesmo em outra rede.',
    memeList: 'Meme coins populares:',
    memeRisk: 'Meme coins são muito voláteis e podem perder grande parte do valor rapidamente — opere só com o que pode perder.',
    faq: [
      { q: 'A GROM é uma alternativa à Uniswap ou à 1inch?', a: 'Sim, para swaps pela sua carteira. Como a Uniswap ou a 1inch, a GROM não custodia fundos — você assina cada swap na sua própria carteira. Além disso, a GROM compara rotas cross-chain de vários agregadores, então um único swap pode mover tokens entre redes.' },
      { q: 'Posso usar a GROM no lugar da Binance sem KYC?', a: 'Para swaps, sim: a GROM não tem conta, KYC nem depósito — você opera pela sua carteira. Diferente de uma exchange centralizada, você paga o gas da rede e confirma cada transação. Serviços de terceiros e algumas regiões podem aplicar verificações próprias.' },
      { q: 'Como compro meme coins como PEPE ou WIF?', a: 'Abra a página do token (por exemplo /token/pepe), conecte a carteira, escolha com o que pagar e confirme a rota na carteira. O token chega ao seu endereço na rede dele.' },
    ],
  },
  tr: {
    compareH2: 'Kendi cüzdanınızdan Uniswap, PancakeSwap, 1inch ve Binance alternatifi',
    compare: [
      'Zaten Uniswap, PancakeSwap, 1inch veya CoW Swap’ta takas yapıyorsanız GROM da aynı şekilde çalışır: kendi cüzdanınızı bağlarsınız, teklifi incelersiniz ve işlemi kendiniz imzalarsınız. Tek ağdaki takasların ötesinde GROM birden fazla toplayıcının rotalarını karşılaştırır — LI.FI, ParaSwap, KyberSwap, Squid ve Solana’da Jupiter — böylece bir ağdaki token’ı başka bir ağdaki varlıklarla tek adımda satın alabilirsiniz.',
      'Binance gibi merkezi borsalardan farklı olarak hesap açmanız, takaslar için KYC’den geçmeniz veya para yatırmanız gerekmez: bir işlemi imzalayana kadar fonlar cüzdanınızda kalır ve token’lar kendi adresinize gelir. Buna karşılık ağ ücretini siz ödersiniz ve her işlemi kendiniz onaylarsınız.',
    ],
    note: 'GROM bağımsızdır; Uniswap Labs, PancakeSwap, 1inch, CoW Protocol veya Binance ile bağlantısı yoktur. Adlar yalnızca karşılaştırma için kullanılır.',
    memeH2: 'Ağlar arası meme coin takası',
    meme: 'DEX’te Trend ve NEW, Ethereum, Base, BNB Chain, Solana ve diğer ağlarda hareketlenen meme coin’leri gösterir. Herhangi birini doğrudan takasta açın — GROM, başka bir ağda olsa bile elinizdeki token’dan bir rota arar.',
    memeList: 'Popüler meme coin’ler:',
    memeRisk: 'Meme coin’ler çok oynaktır ve değerlerinin büyük kısmını hızla kaybedebilir — yalnızca kaybetmeyi göze alabileceğiniz tutarla işlem yapın.',
    faq: [
      { q: 'GROM, Uniswap veya 1inch’e bir alternatif mi?', a: 'Evet, cüzdandan takaslar için. Uniswap veya 1inch gibi GROM da fonlarınızı saklamaz — her takası kendi cüzdanınızda imzalarsınız. Ayrıca GROM birden fazla toplayıcının zincirler arası rotalarını karşılaştırır; tek bir takas token’ları ağlar arasında taşıyabilir.' },
      { q: 'Binance yerine KYC olmadan GROM kullanabilir miyim?', a: 'Takaslar için evet: GROM’da hesap, KYC veya para yatırma yoktur — kendi cüzdanınızdan işlem yaparsınız. Merkezi bir borsadan farklı olarak ağ ücretini siz öder ve her işlemi onaylarsınız. Üçüncü taraf hizmetler ve bazı bölgeler kendi kontrollerini uygulayabilir.' },
      { q: 'PEPE veya WIF gibi meme coin’leri nasıl alırım?', a: 'Token sayfasını açın (örneğin /token/pepe), cüzdanınızı bağlayın, neyle ödeyeceğinizi seçin ve rotayı cüzdanınızda onaylayın. Token, kendi ağında adresinize gelir.' },
    ],
  },
  ru: {
    compareH2: 'Альтернатива Uniswap, PancakeSwap, 1inch и Binance — со своего кошелька',
    compare: [
      'Если вы уже меняете токены на Uniswap, PancakeSwap, 1inch или CoW Swap, в GROM всё устроено так же: вы подключаете свой кошелёк, смотрите котировку и сами подписываете транзакцию. Кроме обмена внутри одной сети, GROM сравнивает маршруты нескольких агрегаторов — LI.FI, ParaSwap, KyberSwap, Squid и Jupiter в Solana, — поэтому можно купить токен в одной сети, заплатив активами из другой, за один шаг.',
      'В отличие от централизованных бирж вроде Binance, здесь не нужно открывать аккаунт, проходить KYC для обмена или вносить депозит: средства остаются в вашем кошельке, пока вы не подпишете сделку, а токены приходят на ваш адрес. Взамен комиссию сети вы платите сами и подтверждаете каждую транзакцию.',
    ],
    note: 'GROM — независимый проект и не связан с Uniswap Labs, PancakeSwap, 1inch, CoW Protocol или Binance. Их названия используются только для сравнения.',
    memeH2: 'Обмен мем-токенов в разных сетях',
    meme: 'Блоки Trending на DEX и NEW показывают мем-токены, которые движутся в Ethereum, Base, BNB Chain, Solana и других сетях. Любой из них открывается сразу в обмене — GROM ищет маршрут из токена, который у вас есть, даже если он в другой сети.',
    memeList: 'Популярные мем-токены:',
    memeRisk: 'Мем-токены очень волатильны и могут быстро потерять большую часть стоимости — используйте только те средства, которые готовы потерять.',
    faq: [
      { q: 'GROM — альтернатива Uniswap или 1inch?', a: 'Да, для обмена со своего кошелька. Как и Uniswap или 1inch, GROM не хранит ваши средства — каждую операцию вы подписываете сами. Кроме того, GROM сравнивает кроссчейн-маршруты нескольких агрегаторов, поэтому один обмен может перевести токены между сетями.' },
      { q: 'Можно ли пользоваться GROM вместо Binance без KYC?', a: 'Для обмена — да: в GROM нет аккаунта, KYC и депозита, вы торгуете со своего кошелька. В отличие от централизованной биржи, комиссию сети вы платите сами и подтверждаете каждую транзакцию. Сторонние сервисы и отдельные регионы могут применять свои проверки.' },
      { q: 'Как купить мем-токены вроде PEPE или WIF?', a: 'Откройте страницу токена (например, /token/pepe), подключите кошелёк, выберите, чем платить, и подтвердите маршрут в кошельке. Токен придёт на ваш адрес в его сети.' },
    ],
  },
  vi: {
    compareH2: 'Lựa chọn thay thế Uniswap, PancakeSwap, 1inch và Binance ngay từ ví của bạn',
    compare: [
      'Nếu bạn đã swap trên Uniswap, PancakeSwap, 1inch hoặc CoW Swap, GROM hoạt động tương tự: bạn kết nối ví của mình, xem báo giá và tự ký giao dịch. Ngoài swap trong một mạng, GROM so sánh tuyến từ nhiều bộ tổng hợp — LI.FI, ParaSwap, KyberSwap, Squid và Jupiter trên Solana — để bạn có thể mua token trên một mạng bằng tài sản ở mạng khác chỉ trong một bước.',
      'So với các sàn tập trung như Binance, bạn không cần mở tài khoản, không cần KYC để swap và không cần nạp tiền: tiền vẫn nằm trong ví cho đến khi bạn ký giao dịch, và token về thẳng địa chỉ của bạn. Đổi lại, bạn tự trả phí mạng và tự xác nhận từng giao dịch.',
    ],
    note: 'GROM là dự án độc lập, không liên kết với Uniswap Labs, PancakeSwap, 1inch, CoW Protocol hay Binance. Các tên này chỉ được dùng để so sánh.',
    memeH2: 'Swap meme coin trên nhiều mạng',
    meme: 'Trending trên DEX và NEW hiển thị các meme coin đang biến động trên Ethereum, Base, BNB Chain, Solana và các mạng khác. Mở bất kỳ token nào thẳng vào swap — GROM tìm tuyến từ token bạn đang có, kể cả ở mạng khác.',
    memeList: 'Meme coin phổ biến:',
    memeRisk: 'Meme coin biến động rất mạnh và có thể mất phần lớn giá trị rất nhanh — chỉ giao dịch số tiền bạn chấp nhận mất.',
    faq: [
      { q: 'GROM có phải là lựa chọn thay thế Uniswap hay 1inch không?', a: 'Có, với swap từ ví. Giống Uniswap hay 1inch, GROM không giữ tiền của bạn — bạn tự ký mỗi lần swap trong ví của mình. Ngoài ra, GROM so sánh tuyến cross-chain từ nhiều bộ tổng hợp, nên một lần swap có thể chuyển token giữa các mạng.' },
      { q: 'Tôi có thể dùng GROM thay cho Binance mà không cần KYC không?', a: 'Với swap thì có: GROM không có tài khoản, KYC hay tiền nạp — bạn giao dịch từ ví của mình. Khác với sàn tập trung, bạn tự trả phí mạng và xác nhận từng giao dịch. Dịch vụ bên thứ ba và một số khu vực có thể áp dụng kiểm tra riêng.' },
      { q: 'Làm sao mua meme coin như PEPE hoặc WIF?', a: 'Mở trang token (ví dụ /token/pepe), kết nối ví, chọn token để thanh toán và xác nhận tuyến trong ví. Token sẽ về địa chỉ của bạn trên mạng của nó.' },
    ],
  },
  id: {
    compareH2: 'Alternatif Uniswap, PancakeSwap, 1inch, dan Binance langsung dari dompet Anda',
    compare: [
      'Jika Anda sudah swap di Uniswap, PancakeSwap, 1inch, atau CoW Swap, GROM bekerja dengan cara yang sama: Anda menghubungkan dompet sendiri, memeriksa kuotasi, dan menandatangani transaksi sendiri. Selain swap dalam satu jaringan, GROM membandingkan rute dari beberapa agregator — LI.FI, ParaSwap, KyberSwap, Squid, dan Jupiter di Solana — sehingga Anda bisa membeli token di satu jaringan dengan aset dari jaringan lain dalam satu langkah.',
      'Dibandingkan bursa terpusat seperti Binance, tidak ada akun yang perlu dibuka, tidak ada KYC untuk swap, dan tidak ada deposit: dana tetap di dompet Anda sampai Anda menandatangani transaksi, dan token masuk ke alamat Anda sendiri. Sebagai gantinya, Anda membayar biaya jaringan dan mengonfirmasi setiap transaksi sendiri.',
    ],
    note: 'GROM adalah proyek independen dan tidak berafiliasi dengan Uniswap Labs, PancakeSwap, 1inch, CoW Protocol, atau Binance. Nama-nama tersebut hanya dipakai untuk perbandingan.',
    memeH2: 'Swap meme coin lintas jaringan',
    meme: 'Trending di DEX dan NEW menampilkan meme coin yang sedang bergerak di Ethereum, Base, BNB Chain, Solana, dan jaringan lain. Buka token mana pun langsung di swap — GROM mencari rute dari token yang Anda miliki, bahkan di jaringan lain.',
    memeList: 'Meme coin populer:',
    memeRisk: 'Meme coin sangat volatil dan bisa kehilangan sebagian besar nilainya dengan cepat — hanya gunakan dana yang siap Anda tanggung kerugiannya.',
    faq: [
      { q: 'Apakah GROM alternatif Uniswap atau 1inch?', a: 'Ya, untuk swap dari dompet. Seperti Uniswap atau 1inch, GROM tidak menyimpan dana Anda — Anda menandatangani setiap swap di dompet sendiri. Selain itu, GROM membandingkan rute lintas jaringan dari beberapa agregator, sehingga satu swap bisa memindahkan token antarjaringan.' },
      { q: 'Bisakah saya memakai GROM sebagai pengganti Binance tanpa KYC?', a: 'Untuk swap, bisa: GROM tidak punya akun, KYC, atau deposit — Anda bertransaksi dari dompet sendiri. Berbeda dengan bursa terpusat, Anda membayar biaya jaringan dan mengonfirmasi setiap transaksi. Layanan pihak ketiga dan beberapa wilayah dapat menerapkan pemeriksaan sendiri.' },
      { q: 'Bagaimana cara membeli meme coin seperti PEPE atau WIF?', a: 'Buka halaman token (misalnya /token/pepe), hubungkan dompet, pilih aset untuk membayar, lalu konfirmasi rute di dompet. Token akan masuk ke alamat Anda di jaringannya.' },
    ],
  },
};

function escText(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Extra landing sections + FAQ for one locale (falls back to English). */
export function landingExtra(localeCode = 'en') {
  const c = COPY[localeCode] || COPY.en;
  const prefix = COPY[localeCode] ? PREFIX[localeCode] || '' : '';
  return {
    sections: [
      {
        h2: c.compareH2,
        html: c.compare.map((t) => `<p>${escText(t)}</p>`).join('\n') + `\n<p><small>${escText(c.note)}</small></p>`,
      },
      {
        h2: c.memeH2,
        html: `<p>${escText(c.meme)}</p>\n<p>${escText(c.memeList)} ${tokenLinks(prefix)}.</p>\n<p>${escText(c.memeRisk)}</p>`,
      },
    ],
    faq: c.faq.map((x) => ({ ...x, a: x.a.split('/token/pepe').join(`${prefix}/token/pepe`) })),
  };
}

/** Append the extra copy to a landing copy object once (module-level copies are shared). */
export function withLandingExtra(landing, localeCode) {
  if (!landing || landing.__extra) return landing;
  const extra = landingExtra(localeCode);
  landing.sections = [...landing.sections, ...extra.sections];
  landing.faq = [...landing.faq, ...extra.faq];
  Object.defineProperty(landing, '__extra', { value: true, enumerable: false });
  return landing;
}

export const LANDING_EXTRA_LOCALES = Object.keys(COPY);
