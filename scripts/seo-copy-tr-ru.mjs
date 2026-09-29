/**
 * Stage 2 SEO copy: Turkish (tr) + Russian (ru).
 * Merged into seo-copy-localized.mjs exports.
 */
import { SEO_LOCALES, localePath } from './seo-locales.mjs';

function p(localeCode, productPath) {
  const loc = SEO_LOCALES.find((l) => l.code === localeCode) || SEO_LOCALES[0];
  return localePath(loc, productPath);
}

export const SEO_META_TR_RU = {
  tr: {
    landing: {
      title: 'GROM Exchange — Saklamasız DeFi terminali',
      description: 'Kendi cüzdanınızdan Swap, perpetual futures, prediction markets ve Tokenized Stocks. GROM’da saklamalı mevduat yok.',
    },
    dashboard: {
      title: 'Cüzdanınızdan zincirler arası kripto Swap',
      description: 'Birçok ağ arasında token değiştirin; cüzdanınızda imzalayın. Birkaç router kotasyonu; settlement on-chain adresinize.',
    },
    futures: {
      title: 'Cüzdanınızdan Spot ve Perpetual Futures',
      description: 'Öz-saklama cüzdanıyla spot ve perpetual işlem. Marj venue’de kalır — GROM bakiyenizi tutmaz.',
    },
    predict: {
      title: 'Cüzdanınızdan Prediction Markets',
      description: 'Bağlı cüzdan bakiyesiyle olay piyasalarında pozisyon. Çözüm piyasa kurallarına göre; GROM keyfi ödeme yapmaz.',
    },
    xstocks: {
      title: 'Tokenized Stocks (RWA) — zincir üstü 7/24',
      description: 'Kendi cüzdanınızdan tokenleştirilmiş hisse maruziyeti; geleneksel borsa saatleri dışında da. Broker hesabı değil.',
    },
    markets: {
      title: 'Markets ve canlı fiyatlar — GROM Exchange',
      description: 'Fiyatları keşfedin; Swap, Trade, Predictions veya Stocks’a geçin. Markets fon saklamaz.',
    },
  },
  ru: {
    landing: {
      title: 'GROM Exchange — некастодиальный DeFi-терминал',
      description: 'Swap, perpetual futures, prediction markets и Tokenized Stocks с вашего кошелька. Без депозита на балансе GROM.',
    },
    dashboard: {
      title: 'Кроссчейн Swap криптовалют с вашего кошелька',
      description: 'Обменивайте токены между сетями, подписывая в своём wallet. Котировки нескольких роутеров; settlement on-chain на ваш адрес.',
    },
    futures: {
      title: 'Spot и Perpetual Futures с вашего кошелька',
      description: 'Торгуйте spot и перпетуалами с подписью из self-custody wallet. Маржа на venue — не на балансе GROM.',
    },
    predict: {
      title: 'Prediction Markets с вашего кошелька',
      description: 'Позиции на событиях из средств подключённого wallet. Расчёт по правилам рынка, без произвольной выплаты GROM.',
    },
    xstocks: {
      title: 'Tokenized Stocks (RWA) on-chain 24/7 — GROM',
      description: 'Токенизированная экспозиция к акциям с вашего кошелька, часто вне часов классической биржи. Это не брокерский счёт.',
    },
    markets: {
      title: 'Markets и живые цены — GROM Exchange',
      description: 'Смотрите цены и открывайте Swap, Trade, Predictions или Stocks. Markets не хранит средства.',
    },
  },
};

export const SEO_COPY_TR = {
  landing: {
    h1: 'GROM Exchange — saklamasız DeFi terminali',
    lead: 'GROM, cüzdan öncelikli bir kripto merkezidir. Öz-saklama cüzdan bağlar, anahtarları sizde tutar ve her işlemi imzalarsınız. GROM’da saklamalı borsa mevduatı ve temel cüzdan ticareti için GROM KYC kapısı yoktur.',
    appName: 'GROM Exchange',
    appDesc: 'Zincirler arası swap, spot ve perpetual futures, prediction markets ve tokenized stocks için saklamasız DeFi terminali.',
    sections: [
      {
        h2: 'Dört ürün hattı, bir cüzdan',
        html: `<p>GROM dört piyasayı tek arayüzde toplar: <a href="${p('tr', '/swap')}">zincirler arası swap ve spot tarzı routing</a>, <a href="${p('tr', '/futures')}">perpetual futures ve spot</a>, <a href="${p('tr', '/predict')}">prediction markets</a> ve <a href="${p('tr', '/stocks')}">Tokenized Stocks (RWA)</a>. Fiyatlar ve keşif <a href="${p('tr', '/markets')}">Markets</a> üzerindedir.</p>
<p>Her ürün sizin kontrol ettiğiniz adreslere settle olur. Kotasyon ve fill’ler on-chain venue ve aggregator’lardan gelir; GROM bakiyelerinizi saklamaz.</p>`,
      },
      {
        h2: 'İşlem nasıl yürür',
        html: `<p>Web3 cüzdan bağlayın (uzantı veya WalletConnect). Ürün seçin, kotasyonu veya ticket’ı inceleyin, imzayı veya işlemi cüzdanda onaylayın. Varlıklar hedef ağ veya venue’ye gider — sonra çekmeniz gereken bir GROM bakiyesine değil.</p>
<p>Swap için desteklenen ağlar başlıca EVM zincirlerini ve routing katmanının gösterdiği ek ekosistemleri kapsar. Futures, predictions ve Tokenized Stocks her ürünün gerektirdiği ağları kullanır. İmzalamadan önce cüzdan isteminde ağ ve varlığı doğrulayın.</p>`,
      },
      {
        h2: 'Ücretler ve riskler',
        html: `<p>Swap’lar kotasyonda routing ücretini ve ağ gas’ını gösterir. Perpetuals, Predictions ve Tokenized Stocks, onaydan önce ticket’ta açıklanan venue ücretlerini alır. GROM getiri, hacim veya likidite derinliği vaat etmez.</p>
<p>İşlem kayıp riski taşır. Kaldıraçlı perpetualler likide olabilir. Prediction stake’leri değersiz bitebilir. Tokenized Stocks, hisse maruziyetinin kripto sarmalayıcılarıdır — klasik broker hissesi değildir — settlement, saat ve düzenleme fark edebilir. Yalnızca kaybetmeyi göze aldığınız fonları kullanın.</p>`,
      },
    ],
    faq: [
      { q: 'GROM Exchange nedir?', a: 'GROM saklamasız bir DeFi terminalidir. Swap, perpetualler, prediction markets ve Tokenized Stocks’ta kendi cüzdanınızdan işlem yaparsınız; saklamalı borsa hesabına yatırmadan.' },
      { q: 'Hesap veya KYC gerekir mi?', a: 'Temel cüzdan ticareti GROM e-posta hesabı veya GROM KYC istemez. Third-party rails’ler ve bazı bölgeler kendi kontrollerini uygulayabilir. Yerel hukuka uyun.' },
      { q: 'Fonlarım nerede durur?', a: 'Cüzdanınızda ve işlem yaptığınız venue’lerde. GROM yazılımı yönlendirip imzalatmaya yardımcı olur; kullanıcı mevduatı tutmaz.' },
      { q: 'Ana sayfadan hangi ürünleri açabilirim?', a: 'Swap (/tr/swap), spot ve perpetualler için Trade (/tr/futures), Predictions (/tr/predict), Stocks (/tr/stocks) ve Markets (/tr/markets).' },
    ],
  },
  dashboard: {
    h1: 'Cüzdanınızdan zincirler arası kripto Swap',
    lead: 'GROM bakiyesi oluşturmadan birçok ağ arasında token değiştirin. Instant Swap birkaç router’dan kotasyon alır, gösterir ve cüzdanınızın imzalamasını ister. Settlement on-chain adresinizedir.',
    appName: 'GROM Instant Swap',
    appDesc: 'Cüzdan imzaları ve on-chain settlement ile saklamasız zincirler arası kripto swap aggregator’ı.',
    sections: [
      {
        h2: 'Instant Swap ne yapar',
        html: `<p>Kaynak token ve ağ, hedef token ve ağ ile tutarı seçin. GROM birkaç aggregator ve bridge’den paralel kotasyon ister, kabul veya reddedebileceğiniz bir rota sunar. Swap anaparasını GROM hot wallet’ına göndermezsiniz.</p>
<p>Likidite ve bridge’ler elverdiğinde yirmiden fazla ağda binlerce token kapsanır. Kesin uygunluk kotasyon anındaki router’lara bağlıdır — likit olmayan çiftlerde rota olmayabilir.</p>`,
      },
      {
        h2: 'Ağlar, cüzdanlar ve imza',
        html: `<p>EVM (ve desk’in desteklediği diğer ekosistemler) imzalayabilen öz-saklama cüzdan kullanın. Onaydan sonra cüzdan harcama izni ve ardından swap veya bridge işlemi isteyebilir. Zincirler arası rotalar aynı-ağ swap’tan uzun sürebilir; durumu desk ve cüzdan aktivitesinden izleyin.</p>
<p>İlgili ürünler bir tık ötede: spot ve perpetualler için <a href="${p('tr', '/futures')}">Trade</a>, fiyatlar için <a href="${p('tr', '/markets')}">Markets</a>, <a href="${p('tr', '/predict')}">Predictions</a> ve <a href="${p('tr', '/stocks')}">Tokenized Stocks</a>.</p>`,
      },
      {
        h2: 'Ücret, slippage ve riskler',
        html: `<p>Her kotasyon tahmini çıkışı, rota ücretini ve ağ gas’ını listeler. Slippage ne kadar fiyat hareketini kabul ettiğinizi kontrol eder. Bridge ve DEX’ler başarısız olabilir, gecikebilir veya volatil piyasada tahminden az dönebilir.</p>
<p>Cüzdan isteminde sözleşme, ağ ve tutarları her zaman kontrol edin. GROM garantili en iyi fiyat veya risksiz bridge uydurmaz.</p>`,
      },
    ],
    faq: [
      { q: 'Instant Swap saklamalı mı?', a: 'Hayır. Cüzdanınızda imzalarsınız; settlement adresinizedir. GROM swap anaparasını saklamaz.' },
      { q: 'Neden rota yok?', a: 'Aggregator’larda likidite olmayabilir, bridge durmuş veya çift/tutar reddedilmiş olabilir. Başka token, ağ veya boyut deneyin.' },
      { q: 'Hangi ücretleri öderim?', a: 'Kotasyondaki routing ücretleri artı kaynak (ve bazen hedef) ağ gas’ı. Üçüncü taraf bridge ücretleri rota içinde olabilir.' },
      { q: 'Swap’tan perps veya stocks’a geçebilir miyim?', a: 'Evet. Tokenler cüzdana gelince aynı bağlantıyla Trade (/tr/futures), Stocks (/tr/stocks) veya Predictions (/tr/predict) açın.' },
    ],
  },
  futures: {
    h1: 'Cüzdanınızdan Spot ve perpetual futures',
    lead: 'Trade desk, öz-saklama cüzdandan imzalayarak spot piyasalar ve perpetual futures alıp satmanıza olanak tanır. Marj ve pozisyonlar trading venue’de yaşar — GROM mevduat hesabında değil.',
    appName: 'GROM Trade',
    appDesc: 'Cüzdandan imzalı spot ve perpetual futures işlem terminali.',
    sections: [
      {
        h2: 'Tek terminalde spot ve perps',
        html: `<p>Trade sayfasında spot ve perpetual modları arasında geçiş yapın. Spot ticket’lar listelenen varlığı kotasyon para birimine karşı alır veya satar. Perpetual ticket’lar venue limitleri içinde seçtiğiniz kaldıraçla long veya short açar.</p>
<p>Grafikler, bakiyeler ve açık emirler bağlandıktan sonra venue’den güncellenir. Çift listeleri ana kripto piyasalarını ve venue’nin ek listelerini içerir — uygunluk değişebilir.</p>`,
      },
      {
        h2: 'Cüzdan akışı ve fonlama',
        html: `<p>Cüzdan bağlayın, ürün gerektiriyorsa venue’yi fonlayın, market veya limit emir verin. Hassas her eylem imza veya işlem ister. Pozisyon kapatma veya küçültme aynı cüzdan-öncelikli kalıbı izler.</p>
<p>Önce başka ağda varlık gerekiyorsa <a href="${p('tr', '/swap')}">Swap</a> kullanın. Fiyatlar için <a href="${p('tr', '/markets')}">Markets</a>; ayrı GROM girişi olmadan <a href="${p('tr', '/predict')}">Predictions</a> ve <a href="${p('tr', '/stocks')}">Stocks</a>.</p>`,
      },
      {
        h2: 'Ücretler ve kaldıraç riski',
        html: `<p>Ticket’lar onaydan önce tahmini ücretleri gösterir. Maker/taker venue ve emir tipine bağlıdır. Yapılandırıldığında builder veya platform ücretleri görünebilir; duraklatıldıysa ticket bunu belirtir.</p>
<p>Kaldıraç kazanç ve kaybı büyütür. Marj yetmezse pozisyonlar likide edilebilir. Perpetual funding zamanla hesabınıza yazabilir veya düşebilir. Perpetual ticareti risksiz veya herkese uygun saymayın.</p>`,
      },
    ],
    faq: [
      { q: 'Trade GROM mevduatı ister mi?', a: 'Saklamalı GROM bakiyesi yok. Cüzdan bağlar, ürünün söylediği gibi venue’yi fonlar ve emirleri kendiniz imzalarsınız.' },
      { q: 'Spot ile perpetual farkı nedir?', a: 'Spot varlığın kendisini değiştirir. Perpetualler kaldıraç ve funding ile piyasayı takip eder; her işlemde dayanak teslim etmez.' },
      { q: 'Yatırdığımdan fazlasını kaybedebilir miyim?', a: 'Likidasyon marj bitince pozisyonu kapatmak için tasarlanmıştır; yine de boşluklar ve ücretler kayba yol açabilir. Kaldıraç öncesi venue kurallarını anlayın.' },
      { q: 'İşlemden önce fiyatları nerede görürüm?', a: 'Markets (/tr/markets) veya seçili çiftin Trade grafiğini açın.' },
    ],
  },
  predict: {
    h1: 'Cüzdanınızdan finanse edilen prediction markets',
    lead: 'GROM Predictions, bağlı cüzdanınızdaki fonlarla olay sonuçlarına pozisyon almanızı sağlar. Listelendiğinde kripto, spor ve siyaset temaları görülebilir. Çözüm piyasa kurallarına göredir — GROM’un keyfi ödemesi değil.',
    appName: 'GROM Predictions',
    appDesc: 'Cüzdan fonlaması ve venue settlement ile saklamasız prediction markets.',
    sections: [
      {
        h2: 'Burada prediction markets nasıl işler',
        html: `<p>Açık olaylara bakın, soru ve kuralları okuyun, gösterilen fiyatlardan outcome share alın veya satın. Fiyatlar piyasanın ima ettiği olasılıkları yansıtır ve hareket edebilir. Çözümden önce kapatmak share’leri piyasaya geri satar.</p>
<p>Stake ve claim cüzdan imzaları ve ürünün zincirini kullanır. GROM’un sakladığı ayrı bir “prediction bakiyesi” yoktur.</p>`,
      },
      {
        h2: 'Başlangıç ve ilgili ürünler',
        html: `<p>Cüzdan bağlayın, piyasanın istediği teminatı bulundurun, boyutu girip onaylayın. Önce bridge veya swap gerekiyorsa <a href="${p('tr', '/swap')}">Instant Swap</a> kullanın. Makro fiyatlar <a href="${p('tr', '/markets')}">Markets</a>; kaldıraçlı kripto <a href="${p('tr', '/futures')}">Trade</a>; hisse tarzı tokenler <a href="${p('tr', '/stocks')}">Stocks</a>.</p>
<p>Aynı cüzdan bağlantısı ürünler arasında taşınır. Her işlemden önce ticket’taki soru metnini, çözüm kaynağını ve ücret satırını okuyun — bunlar piyasa kurallarının özeti değildir, yalnızca UI’da görünen koşullardır.</p>`,
      },
      {
        h2: 'Ücretler ve riskler',
        html: `<p>Ticket’lar onaydan önce işlem ücretlerini açıklar. Spread ve likidite piyasaya göre değişir — ince defterler kayabilir. Olay aleyhinize çözülürse stake’i kaybedebilirsiniz. İtiraz veya çözüm gecikmeleri mümkündür.</p>
<p>Prediction markets bahis bürosu cash-out ürünü değildir ve garantili gelir arayanlara uygun değildir. Olay sözleşmelerine uygulanan bölgesel kısıtlara uyun. GROM sonuçları “garanti etmez”; yalnızca venue ve oracle kurallarını yansıtır.</p>`,
      },
    ],
    faq: [
      { q: 'Prediction kazançları GROM’a yatırılır mı?', a: 'Hayır. Teminat ve ödemeler piyasa venue’sü üzerinden cüzdanınıza settle olur.' },
      { q: 'Hangi konular var?', a: 'Listeler değişir. Piyasalar açıkken kripto, spor, siyaset ve diğer kategoriler görülebilir.' },
      { q: 'Hangi ücretler uygulanır?', a: 'Ticket’taki venue işlem ücretleri artı on-chain adımlar için ağ gas’ı.' },
      { q: 'Piyasalar yavaş çözülebilir mi?', a: 'Evet. Çözüm oracle’lara ve piyasa kurallarına bağlıdır. İşlemden önce her piyasanın şartlarını okuyun.' },
    ],
  },
  xstocks: {
    h1: 'Cüzdanınızdan Tokenized Stocks (RWA)',
    lead: 'GROM Stocks, borsada işlem gören şirketleri takip eden kripto tokenler — tokenleştirilmiş hisse maruziyeti — sunar; venue açıkken geleneksel borsa saatleri dışında da kesirli boyutlarla işlem yapılabilir. Settlement cüzdanınıza gider, GROM broker hesabına değil.',
    appName: 'GROM Stocks',
    appDesc: 'Cüzdandan işlem gören tokenized stocks ve RWA equity tokenleri.',
    sections: [
      {
        h2: 'Tokenized Stocks nedir',
        html: `<p>Tokenized Stocks, equity maruziyetinin on-chain temsilleridir. Tam hisseden küçük boyutlarda işlem görebilir ve venue saati ile likiditeye bağlı olarak geleneksel piyasalar kapalıyken de açık olabilir. Broker hissesiyle aynı değildir: saklama, kurumsal işlemler ve düzenleme farklıdır.</p>
<p>İhraççı ve venue listelediğinde büyük ABD teknoloji isimleri görünebilir. Ürün arayüzündeki token ve piyasa açıklamalarını her zaman okuyun.</p>`,
      },
      {
        h2: 'Nasıl alınıp satılır',
        html: `<p>Cüzdan bağlayın, bir Tokenized Stock seçin, boyut girip onaylayın. Venue’nin kotasyon varlığı (çoğunlukla stablecoin) doğru ağda gerekebilir — önce bridge lazımsa <a href="${p('tr', '/swap')}">Swap</a> kullanın. Pozisyonları Stocks desk’inde ve cüzdan token listesinde izleyin.</p>
<p>Kripto spot/perps için <a href="${p('tr', '/futures')}">Trade</a>, olaylar için <a href="${p('tr', '/predict')}">Predictions</a>, keşif için <a href="${p('tr', '/markets')}">Markets</a> ile birleştirin.</p>`,
      },
      {
        h2: 'Ücretler ve riskler',
        html: `<p>Venue işlem ücretleri ve ağ gas’ı bekleyin. Yoğun saatler dışında spread açılabilir. Tokenleştirilmiş equities referans fiyattan sapabilir, mint/redeem durabilir veya ihraççı/düzenleme kısıtlarıyla karşılaşabilir.</p>
<p>Bu yatırım tavsiyesi değildir. Tokenized Stocks değer kaybedebilir ve bazı yargı alanlarında kullanılamayabilir.</p>`,
      },
    ],
    faq: [
      { q: 'Bunlar geleneksel hisse senetleri mi?', a: 'Hayır. Equity maruziyetini takip eden kripto tokenlerdir. Haklar ve saklama düzenlenmiş broker hesabından farklıdır.' },
      { q: 'Hafta sonu işlem yapabilir miyim?', a: 'Venue’ler tokenlerin 7/24 kripto işlemine izin verebilir; likidite ve fiyat hafta içi borsa saatlerinden farklı olabilir.' },
      { q: 'GROM ile broker KYC gerekir mi?', a: 'GROM sizin için broker hesabı açmaz. Cüzdan erişimi saklamasızdır; ihraççılar veya on-ramp’ler kendi kurallarını uygulayabilir.' },
      { q: 'Alımı nasıl fonlarım?', a: 'Desteklenen ağda gerekli kotasyon varlığını cüzdanda tutun ve işlemi onaylayın. Önce bridge veya dönüşüm için Swap kullanın.' },
    ],
  },
  markets: {
    h1: 'GROM’da Markets ve canlı fiyatlar',
    lead: 'Markets, GROM’un keşif katmanıdır: canlı fiyatlar, movers ve Swap, Trade, Predictions, Stocks kısayolları. Fon saklamaz — piyasa seçip ilgili desk’e atlamanıza yardım eder.',
    appName: 'GROM Markets',
    appDesc: 'GROM DeFi terminali için canlı kripto ve ilgili piyasa keşfi.',
    sections: [
      {
        h2: 'Markets’te ne görürsünüz',
        html: `<p>Son fiyat bağlamıyla listelenen çift ve varlıkları gezin. İşlem yapabilecek ürüne devam etmek için bir satır açın — örneğin zincirler arası tokenler için Instant Swap, spot/perpetualler için Trade veya varsa Tokenized Stocks.</p>
<p>Rakamlar kamuya açık piyasa veri kaynaklarından güncellenir. Kısa boşluk veya gecikme olabilir; imzalamadan önce canlı ticket’ı doğrulayın.</p>`,
      },
      {
        h2: 'Fiyattan işleme',
        html: `<p>Markets ile isimleri hızlı karşılaştırın, ardından sıradan bağlantılarla gidin: <a href="${p('tr', '/swap')}">Swap</a>, <a href="${p('tr', '/futures')}">Trade</a>, <a href="${p('tr', '/predict')}">Predictions</a>, <a href="${p('tr', '/stocks')}">Stocks</a> ve <a href="${p('tr', '/')}">Ana sayfa</a>. Aynı cüzdan bağlantısı ürünler arasında taşınır.</p>
<p>Keşif ekranı emir göndermez. Bir satıra tıkladığınızda ilgili desk açılır; fon hareketi yalnızca cüzdanınızda imzaladığınızda başlar. Hacim veya sıralama metrikleri pazarlama vaadi değildir — yalnızca o anki feed özetidir.</p>`,
      },
      {
        h2: 'Doğruluk ve risk notları',
        html: `<p>GROM her feed için özel veri veya garantili uptime iddia etmez. Grafik ve tablolar bilgilendiricidir. İşlem kararları size aittir; ücret ve riskler her ürün ticket’ında açıklanır.</p>
<p>Farklı ürünler farklı venue ve ağlar kullanabilir. Markets’te gördüğünüz sembol, Swap veya Trade’de hemen işlem yapılabilir anlamına gelmez — önce desk’te destek ve bakiyeyi doğrulayın.</p>`,
      },
    ],
    faq: [
      { q: 'Markets işlem yürütür mü?', a: 'Markets keşif içindir. Yürütme, cüzdanda onayladıktan sonra Swap, Trade, Predictions veya Stocks’ta olur.' },
      { q: 'Fiyatlar gerçek zamanlı mı?', a: 'Bağlı feed’lerden neredeyse gerçek zamanlı olmayı hedefler ama gecikebilir. Emir ticket’ında doğrulayın.' },
      { q: 'Buradan hangi ürünleri açabilirim?', a: 'Varlığa göre: Swap, spot/perps Trade, Predictions veya Tokenized Stocks.' },
      { q: 'Piyasa verisi saklamalı mı?', a: 'Hayır. Fiyatları görmek fon hareket ettirmez. Varlıkları yalnızca cüzdan imzaları taşır.' },
    ],
  },
};

export const SEO_COPY_RU = {
  landing: {
    h1: 'GROM Exchange — некастодиальный DeFi-терминал',
    lead: 'GROM — крипто-хаб с акцентом на кошелёк. Вы подключаете self-custody wallet, ключи остаются у вас, и каждую операцию подписываете сами. Нет депозитного счёта на бирже и нет KYC GROM для базовой торговли с кошелька.',
    appName: 'GROM Exchange',
    appDesc: 'Некастодиальный DeFi-терминал для кроссчейн-свопов, spot и perpetual futures, prediction markets и tokenized stocks.',
    sections: [
      {
        h2: 'Четыре продуктовые линии, один кошелёк',
        html: `<p>GROM объединяет четыре рынка в одном интерфейсе: <a href="${p('ru', '/swap')}">кроссчейн Swap и spot-маршрутизация</a>, <a href="${p('ru', '/futures')}">perpetual futures и spot</a>, <a href="${p('ru', '/predict')}">prediction markets</a> и <a href="${p('ru', '/stocks')}">Tokenized Stocks (RWA)</a>. Цены и поиск — на <a href="${p('ru', '/markets')}">Markets</a>.</p>
<p>Каждый продукт расчётывает на адреса, которыми вы управляете. Котировки и исполнения приходят с on-chain venue и агрегаторов; GROM не хранит ваши балансы.</p>`,
      },
      {
        h2: 'Как проходит торговля',
        html: `<p>Подключите Web3-кошелёк (расширение или WalletConnect). Выберите продукт, проверьте котировку или тикет и подтвердите подпись или транзакцию в wallet. Активы уходят в целевую сеть или venue — не на баланс GROM, с которого потом нужно выводить.</p>
<p>Для Swap доступны основные EVM-сети и другие экосистемы, которые показывает слой routing. Futures, predictions и Tokenized Stocks используют сети, нужные каждому продукту. Перед подписью сверьте сеть и актив в запросе кошелька.</p>`,
      },
      {
        h2: 'Комиссии и риски',
        html: `<p>Swap показывает routing fee в котировке плюс gas сети. Perpetuals, Predictions и Tokenized Stocks берут комиссии venue, раскрытые в тикете до подтверждения. GROM не обещает доходность, объём или глубину ликвидности.</p>
<p>Торговля несёт риск потери. Плечевые перпетуалы могут ликвидироваться. Ставки prediction могут обнулиться. Tokenized Stocks — крипто-обёртки экспозиции к акциям, а не брокерские акции; settlement, часы и регулирование могут отличаться. Используйте только средства, которые готовы потерять.</p>`,
      },
    ],
    faq: [
      { q: 'Что такое GROM Exchange?', a: 'GROM — некастодиальный DeFi-терминал. Вы торгуете со своего кошелька на Swap, перпетуалах, prediction markets и Tokenized Stocks без депозита на кастодиальный счёт биржи.' },
      { q: 'Нужен ли аккаунт или KYC?', a: 'Базовая торговля с кошелька не требует email-аккаунта или KYC GROM. Third-party rails и некоторые регионы могут применять свои проверки. Соблюдайте местное законодательство.' },
      { q: 'Где находятся мои средства?', a: 'В вашем кошельке и на venue, где вы торгуете. ПО GROM помогает маршрутизировать и подписывать; оно не удерживает депозиты пользователей.' },
      { q: 'Какие продукты открыть с главной?', a: 'Swap (/ru/swap), Trade для spot и перпетуалов (/ru/futures), Predictions (/ru/predict), Stocks (/ru/stocks) и Markets (/ru/markets).' },
    ],
  },
  dashboard: {
    h1: 'Кроссчейн Swap криптовалют с вашего кошелька',
    lead: 'Меняйте токены между сетями без баланса GROM. Instant Swap запрашивает несколько роутеров, показывает котировку и просит подпись в wallet. Settlement on-chain на ваш адрес.',
    appName: 'GROM Instant Swap',
    appDesc: 'Некастодиальный кроссчейн-агрегатор Swap с подписями кошелька и on-chain settlement.',
    sections: [
      {
        h2: 'Что делает Instant Swap',
        html: `<p>Выберите исходный токен и сеть, целевой токен и сеть, сумму. GROM параллельно запрашивает котировки у нескольких агрегаторов и мостов и показывает маршрут, который можно принять или отклонить. Основную сумму swap вы не отправляете на hot wallet GROM.</p>
<p>Покрытие — тысячи токенов на двадцати с лишним сетях, когда есть ликвидность и мосты. Точная доступность зависит от роутеров в момент котировки — для неликвидных пар маршрута может не быть.</p>`,
      },
      {
        h2: 'Сети, кошельки и подписи',
        html: `<p>Используйте self-custody wallet, способный подписывать EVM (и другие экосистемы desk). После подтверждения кошелёк может запросить approve, затем отправку swap или bridge. Кроссчейн-маршруты дольше односетевых; статус смотрите в desk и в активности кошелька.</p>
<p>Смежные продукты в один клик: <a href="${p('ru', '/futures')}">Trade</a> для spot и перпетуалов, <a href="${p('ru', '/markets')}">Markets</a> для цен, <a href="${p('ru', '/predict')}">Predictions</a> и <a href="${p('ru', '/stocks')}">Tokenized Stocks</a>.</p>`,
      },
      {
        h2: 'Комиссии, slippage и риски',
        html: `<p>В каждой котировке — оценка выхода, fee маршрута и gas сети. Slippage задаёт допустимое движение цены. Мосты и DEX могут отказать, задержать или вернуть меньше оценки на волатильном рынке.</p>
<p>Всегда проверяйте контракты, сети и суммы в запросе кошелька. GROM не гарантирует «лучшую» цену и безрисковые мосты.</p>`,
      },
    ],
    faq: [
      { q: 'Instant Swap кастодиальный?', a: 'Нет. Вы подписываете в кошельке, settlement идёт на ваш адрес. GROM не хранит основную сумму swap.' },
      { q: 'Почему нет маршрута?', a: 'У агрегаторов может не быть ликвидности, мост на паузе или пара/размер отклонены. Попробуйте другой токен, сеть или сумму.' },
      { q: 'Какие комиссии?', a: 'Routing fee из котировки плюс gas в исходной (иногда целевой) сети. Комиссии сторонних мостов могут входить в маршрут.' },
      { q: 'Можно ли после swap открыть perps или stocks?', a: 'Да. Когда токены придут на кошелёк, откройте Trade (/ru/futures), Stocks (/ru/stocks) или Predictions (/ru/predict) с тем же подключением.' },
    ],
  },
  futures: {
    h1: 'Spot и perpetual futures с вашего кошелька',
    lead: 'Desk Trade позволяет покупать и продавать spot и perpetual futures с подписью из self-custody wallet. Маржа и позиции живут на trading venue — не на депозитном счёте GROM.',
    appName: 'GROM Trade',
    appDesc: 'Терминал spot и perpetual futures с подписью из кошелька.',
    sections: [
      {
        h2: 'Spot и perps в одном терминале',
        html: `<p>Переключайте режимы spot и perpetual на странице Trade. Spot-тикеты покупают или продают актив против котируемой валюты. Perpetual-тикеты открывают long или short с плечом в пределах лимитов venue.</p>
<p>Графики, балансы и открытые ордера обновляются с venue после подключения. Списки пар включают основные крипторынки и доп. листинги venue — доступность может меняться.</p>`,
      },
      {
        h2: 'Поток кошелька и фондирование',
        html: `<p>Подключите кошелёк, при необходимости пополните venue, выставляйте market или limit. Любое чувствительное действие требует подписи или транзакции. Закрытие или уменьшение позиции — тот же wallet-first паттерн.</p>
<p>Нужны активы в другой сети — используйте <a href="${p('ru', '/swap')}">Swap</a>. Цены на <a href="${p('ru', '/markets')}">Markets</a>; без отдельного логина GROM — <a href="${p('ru', '/predict')}">Predictions</a> и <a href="${p('ru', '/stocks')}">Stocks</a>.</p>`,
      },
      {
        h2: 'Комиссии и риск плеча',
        html: `<p>Тикеты показывают оценочные комиссии до подтверждения. Maker/taker зависят от venue и типа ордера. Могут отображаться builder или platform fee; если они на паузе, тикет это указывает.</p>
<p>Плечо усиливает прибыль и убыток. Позиции могут ликвидироваться при недостатке маржи. Funding на перпетуалах со временем может начислять или списывать. Не считайте торговлю перпетуалами безрисковой или подходящей всем.</p>`,
      },
    ],
    faq: [
      { q: 'Нужен ли депозит GROM для Trade?', a: 'Кастодиального баланса GROM нет. Вы подключаете кошелёк, фондируете venue по инструкции продукта и сами подписываете ордера.' },
      { q: 'Чем spot отличается от перпетуалов?', a: 'Spot обменивает сам актив. Перпетуалы следуют рынку с плечом и funding без поставки базового актива на каждой сделке.' },
      { q: 'Можно ли потерять больше депозита?', a: 'Ликвидация закрывает позиции при исчерпании маржи, но гэпы и комиссии всё равно могут дать убыток. Изучите правила venue до использования плеча.' },
      { q: 'Где смотреть цены до сделки?', a: 'Откройте Markets (/ru/markets) или график Trade выбранной пары.' },
    ],
  },
  predict: {
    h1: 'Prediction markets с финансированием из кошелька',
    lead: 'GROM Predictions позволяет занимать позиции на исходы событий средствами подключённого кошелька. В листинге могут быть крипто, спорт и политика. Расчёт идёт по правилам рынка — не по усмотрению GROM.',
    appName: 'GROM Predictions',
    appDesc: 'Некастодиальные prediction markets с фондированием из кошелька и settlement на venue.',
    sections: [
      {
        h2: 'Как здесь работают prediction markets',
        html: `<p>Смотрите открытые события, читайте вопрос и правила, покупайте или продавайте outcome-shares по показанным ценам. Цены отражают подразумеваемые вероятности и могут двигаться. Закрытие до резолюции продаёт shares обратно рынку.</p>
<p>Stake и claim используют подписи кошелька и сеть продукта. Отдельного «prediction-баланса» у GROM нет.</p>`,
      },
      {
        h2: 'Старт и смежные продукты',
        html: `<p>Подключите кошелёк, обеспечьте нужный коллатераль, введите размер и подтвердите. Нужен bridge или swap коллатераля — <a href="${p('ru', '/swap')}">Instant Swap</a>. Макро-цены на <a href="${p('ru', '/markets')}">Markets</a>; плечо по крипте на <a href="${p('ru', '/futures')}">Trade</a>; equity-токены на <a href="${p('ru', '/stocks')}">Stocks</a>.</p>
<p>То же подключение кошелька действует между продуктами. Перед каждой сделкой читайте формулировку вопроса, источник резолюции и строку комиссий в тикете — это условия, которые показывает UI, а не отдельная гарантия GROM.</p>`,
      },
      {
        h2: 'Комиссии и риски',
        html: `<p>Тикеты раскрывают торговые комиссии до подтверждения. Спреды и ликвидность разные — тонкие стаканы могут проскальзывать. Если событие разрешится против вас, stake можно потерять. Возможны задержки споров и резолюции.</p>
<p>Prediction markets — не cash-out букмекера и не продукт для гарантированного дохода. Соблюдайте региональные ограничения для event-контрактов. GROM не «гарантирует» исход; он отражает правила venue и oracle.</p>`,
      },
    ],
    faq: [
      { q: 'Выигрыши prediction зачисляются на GROM?', a: 'Нет. Коллатераль и выплаты settle на ваш кошелёк через venue рынка.' },
      { q: 'Какие темы доступны?', a: 'Листинги меняются. Могут быть крипто, спорт, политика и другие категории, когда рынки открыты.' },
      { q: 'Какие комиссии?', a: 'Торговые комиссии venue в тикете плюс gas сети для on-chain шагов.' },
      { q: 'Может ли резолюция затянуться?', a: 'Да. Она зависит от оракулов и правил рынка. Читайте условия каждого рынка до сделки.' },
    ],
  },
  xstocks: {
    h1: 'Tokenized Stocks (RWA) с вашего кошелька',
    lead: 'GROM Stocks даёт токенизированную экспозицию к акциям — крипто-токены, отслеживающие котируемые компании, — чтобы торговать дробными размерами вне часов классической биржи, когда venue открыт. Settlement на ваш кошелёк, не на брокерский счёт GROM.',
    appName: 'GROM Stocks',
    appDesc: 'Tokenized stocks и RWA equity-токены с торговлей из кошелька.',
    sections: [
      {
        h2: 'Что такое Tokenized Stocks',
        html: `<p>Tokenized Stocks — on-chain представления экспозиции к equity. Их можно торговать меньшими размерами, чем целая акция, и они могут быть доступны, когда традиционные рынки закрыты — по часам и ликвидности venue. Это не то же самое, что брокерские акции: хранение, корпоративные действия и регулирование отличаются.</p>
<p>Популярные имена крупного US tech могут появляться, когда эмитент и venue их листя. Всегда читайте раскрытия токена и рынка в UI.</p>`,
      },
      {
        h2: 'Как купить и продать',
        html: `<p>Подключите кошелёк, выберите Tokenized Stock, введите размер и подтвердите. Может понадобиться котируемый актив venue (часто стейблкоин) в нужной сети — используйте <a href="${p('ru', '/swap')}">Swap</a>, если нужен bridge. Следите за позициями в desk Stocks и в списке токенов кошелька.</p>
<p>Сочетайте с <a href="${p('ru', '/futures')}">Trade</a> для crypto spot/perps, <a href="${p('ru', '/predict')}">Predictions</a> для событий и <a href="${p('ru', '/markets')}">Markets</a> для цен.</p>`,
      },
      {
        h2: 'Комиссии и риски',
        html: `<p>Ожидайте торговые комиссии venue и gas сети. Вне пиковых часов спреды могут расширяться. Токенизированные equities могут отойти от референсной цены, приостановить mint/redeem или столкнуться с ограничениями эмитента и регуляторики.</p>
<p>Это не инвестиционная рекомендация. Tokenized Stocks могут терять стоимость и быть недоступны в некоторых юрисдикциях.</p>`,
      },
    ],
    faq: [
      { q: 'Это традиционные акции?', a: 'Нет. Это крипто-токены, отслеживающие экспозицию к equity. Права и хранение отличаются от регулируемого брокерского счёта.' },
      { q: 'Можно ли торговать в выходные?', a: 'Venue могут разрешать 24/7 crypto-торговлю токенами, но ликвидность и цена могут отличаться от будних часов фондового рынка.' },
      { q: 'Нужен ли брокерский KYC с GROM?', a: 'GROM не открывает вам брокерский счёт. Доступ через wallet некастодиальный; эмитенты или on-ramp могут требовать свои правила.' },
      { q: 'Как профинансировать покупку?', a: 'Держите нужный котируемый актив в кошельке в поддерживаемой сети и подтвердите сделку. Используйте Swap для bridge или конвертации.' },
    ],
  },
  markets: {
    h1: 'Markets и живые цены на GROM',
    lead: 'Markets — слой discovery GROM: живые цены, movers и быстрые переходы в Swap, Trade, Predictions и Stocks. Он не хранит средства — помогает выбрать рынок и перейти в нужный desk.',
    appName: 'GROM Markets',
    appDesc: 'Живой discovery крипто- и смежных рынков для DeFi-терминала GROM.',
    sections: [
      {
        h2: 'Что видно на Markets',
        html: `<p>Смотрите листинговые пары и активы с недавним ценовым контекстом. Откройте строку, чтобы продолжить в продукте, который может торговать актив — например Instant Swap для кроссчейн-токенов, Trade для spot и перпетуалов или Stocks для токенизированных equities, когда они доступны.</p>
<p>Цифры обновляются из публичных источников рыночных данных. Возможны короткие пропуски или задержки; перед подписью сверяйте живой тикет.</p>`,
      },
      {
        h2: 'От цены к сделке',
        html: `<p>Используйте Markets для быстрого сравнения и переходите обычными ссылками: <a href="${p('ru', '/swap')}">Swap</a>, <a href="${p('ru', '/futures')}">Trade</a>, <a href="${p('ru', '/predict')}">Predictions</a>, <a href="${p('ru', '/stocks')}">Stocks</a> и <a href="${p('ru', '/')}">Главная</a>. То же подключение кошелька действует между продуктами.</p>
<p>Экран discovery не отправляет ордера. Клик по строке открывает нужный desk; средства двигаются только после подписи в кошельке. Метрики объёма или ранжирования — не маркетинговое обещание, а снимок текущего feed.</p>`,
      },
      {
        h2: 'Точность и риски',
        html: `<p>GROM не заявляет эксклюзивные данные или гарантированный uptime каждого feed. Графики и таблицы информативны. Решения о сделках ваши; комиссии и риски раскрываются в тикете каждого продукта.</p>
<p>Разные продукты могут использовать разные venue и сети. Символ на Markets не означает мгновенную доступность на Swap или Trade — сначала проверьте поддержку и баланс в desk.</p>`,
      },
    ],
    faq: [
      { q: 'Markets исполняет сделки?', a: 'Markets для discovery. Исполнение — на Swap, Trade, Predictions или Stocks после подтверждения в кошельке.' },
      { q: 'Цены в реальном времени?', a: 'Они стремятся быть почти realtime с подключённых feed, но могут отставать. Проверяйте на тикете ордера.' },
      { q: 'Какие продукты открыть отсюда?', a: 'В зависимости от актива: Swap, Trade spot/perps, Predictions или Tokenized Stocks.' },
      { q: 'Рыночные данные кастодиальны?', a: 'Нет. Просмотр цен не двигает средства. Активы двигают только подписи кошелька.' },
    ],
  },
};
