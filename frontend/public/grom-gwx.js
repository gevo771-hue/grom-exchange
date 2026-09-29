/* ============================================================
 * Prediction Markets + Tokenized Stocks — owned end-to-end here.
 * grom-wallet.84845dfe.js handed these pages to index.html, so we render real
 * first-class `.page` sections (#page-predict / #page-xstocks) wired into
 * the app's own show() router — fixes both click + direct-URL rendering.
 * Predict uses shared window.boState balance (not marketed as Demo/$50k): live prices,
 * working Buy/Sell + YES/NO bets, positions w/ PnL, trade modal.
 * ============================================================ */
// Prediction categories (key, emoji, i18n key).
var GROM_PCATS = [
  ['all', 'i-globe', 'px_cat_all'], ['sport', 'i-cat-sport', 'px_cat_sport'], ['crypto', 'i-cat-crypto', 'px_cat_crypto'],
  ['esports', 'i-cat-esports', 'px_cat_esports'], ['politics', 'i-cat-politics', 'px_cat_politics'],
  ['culture', 'i-cat-culture', 'px_cat_culture'], ['finance', 'i-cat-finance', 'px_cat_finance'], ['economy', 'i-cat-economy', 'px_cat_economy'],
];
// Multi-outcome prediction markets. rows = [{ n: outcome, p: probability% }].
var GROM_PREDICT_MARKETS = [
  // ── Спорт ──
  { id: 'mlb_atl', cat: 'sport', ico: '⚾', q: 'MLB: кто победит — Atlanta Braves или Chicago White Sox?', vol: 184230, part: 23, ends: '15 июн, 21:40', rows: [{ n: 'Atlanta Braves', p: 49 }, { n: 'Chicago White Sox', p: 51 }] },
  { id: 'wc_ned', cat: 'sport', ico: '🏆', q: 'ЧМ-2026: Нидерланды выйдут из группы?', vol: 412980, part: 41, ends: '22 июн, 18:00', rows: [{ n: 'Да', p: 62 }, { n: 'Нет', p: 38 }] },
  { id: 'nba_fin', cat: 'sport', ico: '🏀', q: 'NBA Finals 2026: победит Boston Celtics?', vol: 928400, part: 88, ends: '20 июн, 02:00', rows: [{ n: 'Да', p: 44 }, { n: 'Нет', p: 56 }] },
  { id: 'f1_ver', cat: 'sport', ico: '🏎️', q: 'F1 2026: Max Verstappen возьмёт титул?', vol: 1204000, part: 132, ends: '30 ноя', rows: [{ n: 'Да', p: 58 }, { n: 'Нет', p: 42 }] },
  { id: 'ucl_rm', cat: 'sport', ico: '⚽', q: 'Лига Чемпионов: Real Madrid дойдёт до финала?', vol: 760300, part: 64, ends: '28 мая', rows: [{ n: 'Да', p: 35 }, { n: 'Нет', p: 65 }] },
  { id: 'wim_alc', cat: 'sport', ico: '🎾', q: 'Wimbledon: Карлос Алькарас выиграет?', vol: 318900, part: 37, ends: '14 июл', rows: [{ n: 'Да', p: 41 }, { n: 'Нет', p: 59 }] },
  // ── Криптовалюта ──
  { id: 'btc_tgt', cat: 'crypto', ico: '₿', q: 'Какую цену BTC достигнет в июне 2026?', vol: 2840110, part: 412, ends: '30 июн', rows: [{ n: '$110K', p: 71 }, { n: '$120K', p: 34 }, { n: '$130K', p: 12 }] },
  { id: 'eth_etf', cat: 'crypto', ico: 'Ξ', q: 'SEC одобрит ETH staking ETF до конца Q3?', vol: 1180550, part: 196, ends: '30 сен', rows: [{ n: 'Да', p: 41 }, { n: 'Нет', p: 59 }] },
  { id: 'sol_tvl', cat: 'crypto', ico: '◎', q: 'TVL Solana DeFi превысит $15B в этом квартале?', vol: 624000, part: 88, ends: '30 сен', rows: [{ n: 'Да', p: 28 }, { n: 'Нет', p: 72 }] },
  { id: 'btc_ath', cat: 'crypto', ico: '🚀', q: 'BTC обновит исторический максимум в 2026?', vol: 3920000, part: 540, ends: '31 дек', rows: [{ n: 'Да', p: 67 }, { n: 'Нет', p: 33 }] },
  { id: 'doge_50', cat: 'crypto', ico: '🐕', q: 'DOGE вырастет на 50%+ в этом месяце?', vol: 421000, part: 73, ends: '30 июн', rows: [{ n: 'Да', p: 22 }, { n: 'Нет', p: 78 }] },
  // ── Киберспорт ──
  { id: 'lol_t1', cat: 'esports', ico: '🎮', q: 'LoL Worlds 2026: T1 выйдут в финал?', vol: 286000, part: 54, ends: '02 ноя', rows: [{ n: 'Да', p: 46 }, { n: 'Нет', p: 54 }] },
  { id: 'dota_ti', cat: 'esports', ico: '🛡️', q: 'The International: Team Spirit возьмут Аегис?', vol: 198400, part: 39, ends: '12 окт', rows: [{ n: 'Да', p: 31 }, { n: 'Нет', p: 69 }] },
  { id: 'cs_navi', cat: 'esports', ico: '🔫', q: 'CS2 Major: NAVI выиграют чемпионат?', vol: 244500, part: 47, ends: '24 авг', rows: [{ n: 'Да', p: 38 }, { n: 'Нет', p: 62 }] },
  // ── Политика ──
  { id: 'us_senate', cat: 'politics', ico: '🏛️', q: 'Республиканцы сохранят большинство в Сенате?', vol: 1840000, part: 221, ends: '03 ноя', rows: [{ n: 'Да', p: 55 }, { n: 'Нет', p: 45 }] },
  { id: 'trump_eo', cat: 'politics', ico: '🇺🇸', q: 'Трамп подпишет крипто-указ в Q3 2026?', vol: 980000, part: 142, ends: '30 сен', rows: [{ n: 'Да', p: 48 }, { n: 'Нет', p: 52 }] },
  { id: 'eu_mica', cat: 'politics', ico: '🇪🇺', q: 'ЕС примет MiCA 2.0 в 2026 году?', vol: 312000, part: 58, ends: '31 дек', rows: [{ n: 'Да', p: 33 }, { n: 'Нет', p: 67 }] },
  // ── Культура ──
  { id: 'dune3', cat: 'culture', ico: '🎬', q: '«Dune: Part Three» соберёт $1B в прокате?', vol: 274000, part: 49, ends: '31 дек', rows: [{ n: 'Да', p: 44 }, { n: 'Нет', p: 56 }] },
  { id: 'gta6', cat: 'culture', ico: '🎮', q: 'GTA VI выйдет до конца 2026?', vol: 1120000, part: 188, ends: '31 дек', rows: [{ n: 'Да', p: 39 }, { n: 'Нет', p: 61 }] },
  { id: 'swift_alb', cat: 'culture', ico: '🎤', q: 'Новый альбом Taylor Swift в этом году?', vol: 168000, part: 31, ends: '31 дек', rows: [{ n: 'Да', p: 57 }, { n: 'Нет', p: 43 }] },
  // ── Финансы (акции) ──
  { id: 'meta_tgt', cat: 'finance', ico: '🟦', q: 'Какую цену META достигнет в июне 2026?', vol: 542000, part: 33, ends: '30 июн', rows: [{ n: '$520', p: 99 }, { n: '$720', p: 99 }, { n: '$740', p: 99 }] },
  { id: 'pltr_tgt', cat: 'finance', ico: '⬛', q: 'Какую цену PLTR достигнет в июне 2026?', vol: 318000, part: 20, ends: '30 июн', rows: [{ n: '$126', p: 83 }, { n: '$168', p: 50 }, { n: '$174', p: 50 }] },
  { id: 'aapl_tgt', cat: 'finance', ico: '🍎', q: 'Какую цену AAPL достигнет в июне 2026?', vol: 612000, part: 44, ends: '30 июн', rows: [{ n: '$240', p: 78 }, { n: '$250', p: 43 }, { n: '$260', p: 21 }] },
  { id: 'nvda_tgt', cat: 'finance', ico: '🟩', q: 'Какую цену NVDA достигнет в июне 2026?', vol: 904000, part: 71, ends: '30 июн', rows: [{ n: '$150', p: 82 }, { n: '$160', p: 50 }, { n: '$180', p: 24 }] },
  { id: 'tsla_400', cat: 'finance', ico: '🚗', q: 'TSLA достигнет $400 в июне 2026?', vol: 488000, part: 52, ends: '30 июн', rows: [{ n: 'Да', p: 29 }, { n: 'Нет', p: 71 }] },
  { id: 'sp500_6k', cat: 'finance', ico: '📈', q: 'S&P 500 закроет июнь выше 6000?', vol: 1340000, part: 164, ends: '30 июн', rows: [{ n: 'Да', p: 61 }, { n: 'Нет', p: 39 }] },
  // ── Экономика ──
  { id: 'fomc_cut', cat: 'economy', ico: '🏦', q: 'ФРС снизит ставку на 25 bps в июле?', vol: 3104000, part: 388, ends: '31 июл', rows: [{ n: 'Да', p: 71 }, { n: 'Нет', p: 29 }] },
  { id: 'cpi_3', cat: 'economy', ico: '📊', q: 'Инфляция США (CPI) опустится ниже 3% в этом квартале?', vol: 920000, part: 118, ends: '30 сен', rows: [{ n: 'Да', p: 52 }, { n: 'Нет', p: 48 }] },
  { id: 'gold_2800', cat: 'economy', ico: '🥇', q: 'Золото выше $2800/oz к концу квартала?', vol: 540000, part: 67, ends: '30 сен', rows: [{ n: 'Да', p: 64 }, { n: 'Нет', p: 36 }] },
  { id: 'oil_90', cat: 'economy', ico: '🛢️', q: 'Нефть Brent выше $90 в этом месяце?', vol: 388000, part: 44, ends: '30 июн', rows: [{ n: 'Да', p: 27 }, { n: 'Нет', p: 73 }] },
];
// Stock categories (key, i18n key).
var GROM_SCATS = [
  ['all', 'px_scat_all'], ['tech', 'px_scat_tech'], ['finance', 'px_scat_finance'], ['etf', 'px_scat_etf'],
  ['auto', 'px_scat_auto'], ['consumer', 'px_scat_consumer'], ['crypto', 'px_scat_crypto'],
  ['energy', 'px_scat_energy'], ['health', 'px_scat_health'],
];
var GROM_XSTOCKS = [
  { sym: 'AAPL',  name: 'Apple Inc.',            price: 234.18, chg:  0.84, vol24: '$48.2M', mc: '$3.56T', cat: 'tech' },
  { sym: 'MSFT',  name: 'Microsoft Corp.',       price: 469.55, chg:  1.20, vol24: '$31.7M', mc: '$3.49T', cat: 'tech' },
  { sym: 'NVDA',  name: 'NVIDIA Corp.',          price: 144.62, chg: -2.31, vol24: '$92.4M', mc: '$3.55T', cat: 'tech' },
  { sym: 'GOOGL', name: 'Alphabet Inc. (C)',     price: 191.78, chg:  0.46, vol24: '$22.1M', mc: '$2.37T', cat: 'tech' },
  { sym: 'META',  name: 'Meta Platforms',        price: 612.40, chg: -0.92, vol24: '$19.8M', mc: '$1.55T', cat: 'tech' },
  { sym: 'AMZN',  name: 'Amazon.com Inc.',       price: 232.45, chg:  1.18, vol24: '$28.3M', mc: '$2.44T', cat: 'consumer' },
  { sym: 'AMD',   name: 'Advanced Micro Dev.',   price: 134.92, chg: -1.07, vol24: '$14.6M', mc: '$218B',  cat: 'tech' },
  { sym: 'NFLX',  name: 'Netflix Inc.',          price: 912.30, chg:  1.84, vol24: '$9.4M',  mc: '$392B',  cat: 'tech' },
  { sym: 'ADBE',  name: 'Adobe Inc.',            price: 528.70, chg: -0.61, vol24: '$5.2M',  mc: '$236B',  cat: 'tech' },
  { sym: 'CRM',   name: 'Salesforce Inc.',       price: 332.15, chg:  0.92, vol24: '$4.8M',  mc: '$318B',  cat: 'tech' },
  { sym: 'ORCL',  name: 'Oracle Corp.',          price: 198.44, chg:  2.13, vol24: '$6.1M',  mc: '$552B',  cat: 'tech' },
  { sym: 'AVGO',  name: 'Broadcom Inc.',         price: 248.90, chg:  3.07, vol24: '$12.7M', mc: '$1.16T', cat: 'tech' },
  { sym: 'QCOM',  name: 'Qualcomm Inc.',         price: 172.36, chg: -0.48, vol24: '$3.9M',  mc: '$192B',  cat: 'tech' },
  { sym: 'CSCO',  name: 'Cisco Systems',         price: 64.18,  chg:  0.31, vol24: '$5.5M',  mc: '$258B',  cat: 'tech' },
  { sym: 'INTC',  name: 'Intel Corp.',           price: 24.86,  chg: -1.92, vol24: '$8.3M',  mc: '$107B',  cat: 'tech' },
  { sym: 'IBM',   name: 'IBM',                    price: 268.40, chg:  0.74, vol24: '$2.6M',  mc: '$248B',  cat: 'tech' },
  { sym: 'PLTR',  name: 'Palantir Tech.',        price: 142.55, chg:  5.21, vol24: '$18.9M', mc: '$330B',  cat: 'tech' },
  { sym: 'TSLA',  name: 'Tesla Inc.',            price: 351.04, chg:  3.42, vol24: '$58.6M', mc: '$1.12T', cat: 'auto' },
  { sym: 'F',     name: 'Ford Motor Co.',        price: 11.92,  chg: -0.83, vol24: '$3.1M',  mc: '$47B',   cat: 'auto' },
  { sym: 'GM',    name: 'General Motors',         price: 54.27,  chg:  0.62, vol24: '$2.4M',  mc: '$58B',   cat: 'auto' },
  { sym: 'RIVN',  name: 'Rivian Automotive',      price: 14.38,  chg: -2.74, vol24: '$1.9M',  mc: '$15B',   cat: 'auto' },
  { sym: 'JPM',   name: 'JPMorgan Chase',         price: 268.90, chg:  0.54, vol24: '$7.2M',  mc: '$748B',  cat: 'finance' },
  { sym: 'BAC',   name: 'Bank of America',        price: 46.18,  chg:  0.27, vol24: '$4.1M',  mc: '$352B',  cat: 'finance' },
  { sym: 'V',     name: 'Visa Inc.',              price: 348.70, chg:  0.88, vol24: '$3.8M',  mc: '$682B',  cat: 'finance' },
  { sym: 'MA',    name: 'Mastercard Inc.',        price: 552.30, chg:  1.04, vol24: '$2.9M',  mc: '$508B',  cat: 'finance' },
  { sym: 'GS',    name: 'Goldman Sachs',          price: 612.40, chg: -0.36, vol24: '$2.2M',  mc: '$196B',  cat: 'finance' },
  { sym: 'MS',    name: 'Morgan Stanley',         price: 138.55, chg:  0.41, vol24: '$1.8M',  mc: '$222B',  cat: 'finance' },
  { sym: 'BRK.B', name: 'Berkshire Hathaway B',   price: 478.20, chg:  0.19, vol24: '$1.6M',  mc: '$1.03T', cat: 'finance' },
  { sym: 'KO',    name: 'Coca-Cola Co.',          price: 71.85,  chg:  0.23, vol24: '$2.7M',  mc: '$309B',  cat: 'consumer' },
  { sym: 'PEP',   name: 'PepsiCo Inc.',           price: 158.40, chg: -0.44, vol24: '$1.9M',  mc: '$217B',  cat: 'consumer' },
  { sym: 'MCD',   name: "McDonald's Corp.",        price: 312.70, chg:  0.58, vol24: '$1.7M',  mc: '$224B',  cat: 'consumer' },
  { sym: 'NKE',   name: 'Nike Inc.',              price: 78.92,  chg: -1.21, vol24: '$2.3M',  mc: '$118B',  cat: 'consumer' },
  { sym: 'DIS',   name: 'Walt Disney Co.',        price: 114.36, chg:  1.46, vol24: '$3.4M',  mc: '$207B',  cat: 'consumer' },
  { sym: 'WMT',   name: 'Walmart Inc.',           price: 96.18,  chg:  0.67, vol24: '$4.6M',  mc: '$772B',  cat: 'consumer' },
  { sym: 'COST',  name: 'Costco Wholesale',       price: 1018.40, chg: 0.92, vol24: '$2.1M',  mc: '$452B',  cat: 'consumer' },
  { sym: 'COIN',  name: 'Coinbase Global',        price: 308.50, chg:  4.62, vol24: '$11.2M', mc: '$77B',   cat: 'crypto' },
  { sym: 'MSTR',  name: 'MicroStrategy',          price: 412.30, chg:  6.18, vol24: '$24.8M', mc: '$96B',   cat: 'crypto' },
  { sym: 'MARA',  name: 'MARA Holdings',          price: 22.74,  chg:  7.31, vol24: '$5.6M',  mc: '$8B',    cat: 'crypto' },
  { sym: 'HOOD',  name: 'Robinhood Markets',      price: 58.92,  chg:  3.84, vol24: '$6.8M',  mc: '$52B',   cat: 'crypto' },
  { sym: 'XOM',   name: 'Exxon Mobil',            price: 118.40, chg: -0.74, vol24: '$3.2M',  mc: '$520B',  cat: 'energy' },
  { sym: 'CVX',   name: 'Chevron Corp.',          price: 162.30, chg: -0.51, vol24: '$2.4M',  mc: '$296B',  cat: 'energy' },
  { sym: 'LLY',   name: 'Eli Lilly & Co.',        price: 924.60, chg:  1.92, vol24: '$4.9M',  mc: '$878B',  cat: 'health' },
  { sym: 'UNH',   name: 'UnitedHealth Group',     price: 528.40, chg: -0.62, vol24: '$2.8M',  mc: '$486B',  cat: 'health' },
  { sym: 'JNJ',   name: 'Johnson & Johnson',      price: 156.70, chg:  0.34, vol24: '$2.5M',  mc: '$377B',  cat: 'health' },
  { sym: 'PFE',   name: 'Pfizer Inc.',            price: 26.18,  chg: -0.91, vol24: '$3.1M',  mc: '$148B',  cat: 'health' },
  { sym: 'SPY',   name: 'S&P 500 ETF',            price: 596.78, chg:  0.34, vol24: '$210M',  mc: '$598B',  cat: 'etf' },
  { sym: 'QQQ',   name: 'Nasdaq-100 ETF',         price: 524.13, chg:  0.61, vol24: '$182M',  mc: '$305B',  cat: 'etf' },
  { sym: 'DIA',   name: 'Dow Jones ETF',          price: 438.20, chg:  0.18, vol24: '$24M',   mc: '$38B',   cat: 'etf' },
  { sym: 'IWM',   name: 'Russell 2000 ETF',       price: 232.60, chg:  0.92, vol24: '$48M',   mc: '$72B',   cat: 'etf' },
  { sym: 'ARKK',  name: 'ARK Innovation ETF',     price: 68.44,  chg:  2.18, vol24: '$12M',   mc: '$6B',    cat: 'etf' },
];
(function gromExtraEnhance() {
  function tx(k, fb) {
    if (typeof window.t === 'function') { var v = window.t(k); if (v && v !== k) return v; }
    return fb || k;
  }
  function txFmt(k, fb, rep) {
    var s = tx(k, fb);
    if (rep) Object.keys(rep).forEach(function (n) { s = s.split('{' + n + '}').join(rep[n]); });
    return s;
  }
  function bal() {
    var b = window.boState && window.boState.balance;
    if (b && typeof b.demo === 'number') return b.demo;
    var v = parseFloat(localStorage.getItem('grom_demo_bal') || '');
    // No default $50,000 seed — brief: remove Demo/Paper/$50,000 copy & marketing numbers.
    return isFinite(v) ? v : 0;
  }
  function setBal(v) {
    v = Math.max(0, v);
    if (window.boState && window.boState.balance) window.boState.balance.demo = v;
    try { localStorage.setItem('grom_demo_bal', String(v)); } catch (_) {}
    if (typeof window.syncAcctBalances === 'function') { try { window.syncAcctBalances(); } catch (_) {} }
    updateBalChips();
  }
  function money(n) { return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function notify(m, k) { if (typeof toast === 'function') toast(m, k || 'info'); }
  function loadPos(key) { try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch (_) { return []; } }
  function savePos(key, arr) { try { localStorage.setItem(key, JSON.stringify(arr.slice(0, 60))); } catch (_) {} }
  function livePx(sym) { var p = (typeof window.gromLivePrice === 'function') ? window.gromLivePrice(sym) : null; return (p != null && isFinite(p) && p > 0) ? p : null; }

  /* ---- Backed xStocks catalog (Phase 1) — dynamic, cached 5 min ---- */
  var GWX_SEED_CAT = {};
  GROM_XSTOCKS.forEach(function (s) { if (s.cat) GWX_SEED_CAT[s.sym] = s.cat; });
  /* Full Backed catalog → chip categories (627 tickers). Keywords cover future listings. */
  var GWX_CAT_BY_SYM = {A:'tech',AA:'tech',AAPL:'tech',ABBV:'health',ABNB:'tech',ABT:'health',ACN:'tech',ADBE:'tech',ADI:'tech',ADM:'consumer',ADP:'tech',ADSK:'tech',AEE:'energy',AEP:'energy',AFL:'finance',AIG:'finance',AIT:'tech',AIZ:'finance',AJG:'finance',AKAM:'tech',ALAB:'tech',ALB:'health',ALGN:'tech',ALL:'finance',ALLY:'finance',ALNY:'health',AMAT:'tech',AMBR:'tech',AMD:'tech',AME:'tech',AMGN:'health',AMP:'finance',AMT:'finance',AMZN:'tech',ANET:'tech',APA:'energy',APD:'health',APG:'tech',APH:'tech',APLD:'tech',APO:'finance',APP:'tech',ARES:'finance',ARMK:'etf',ARW:'tech',ASML:'tech',ASTS:'tech',ATI:'tech',ATO:'energy',AVB:'finance',AVGO:'tech',AVY:'consumer',AWK:'energy',AXON:'tech',AZN:'health',AZO:'auto',BA:'tech',BAC:'finance',BALL:'consumer',BAM:'finance',BBY:'consumer',BDX:'health',BIIB:'health',BITX:'crypto',BJ:'consumer',BMNR:'crypto',BMY:'health',BNY:'finance',BOT:'crypto',BR:'finance','BRK.B':'finance',BRKB:'finance',BRO:'finance',BSP:'tech',BSX:'health',BTBT:'crypto',BTGO:'crypto',BURL:'consumer',BWA:'auto',BWXT:'tech',BX:'finance',C:'finance',CAH:'health',CARR:'tech',CASY:'consumer',CAT:'tech',CBRE:'finance',CCI:'finance',CDNS:'tech',CDW:'tech',CEG:'energy',CF:'health',CFG:'finance',CG:'finance',CHD:'consumer',CHRW:'tech',CHTR:'tech',CI:'health',CIEN:'tech',CINF:'finance',CL:'consumer',CLH:'energy',CLSK:'crypto',CLX:'consumer',CMCSA:'tech',CME:'finance',CMG:'consumer',CMI:'tech',CMS:'energy',CNC:'health',CNP:'energy',COF:'finance',COHR:'tech',COIN:'crypto',COO:'health',COP:'energy',COPX:'etf',COR:'health',CORZ:'crypto',CPAY:'finance',CPNG:'consumer',CPRT:'auto',CPT:'finance',CRCL:'crypto',CRM:'tech',CRS:'tech',CRWD:'tech',CSCO:'tech',CSGP:'finance',CSL:'consumer',CSX:'tech',CTAS:'consumer',CTSH:'tech',CTVA:'consumer',CVNA:'auto',CVS:'health',CVX:'energy',CW:'tech',D:'energy',DAL:'consumer',DASH:'tech',DAX:'etf',DDOG:'tech',DE:'tech',DECK:'consumer',DELL:'tech',DFDV:'finance',DG:'consumer',DGX:'health',DHI:'consumer',DHR:'health',DIS:'consumer',DKNG:'consumer',DKS:'consumer',DLR:'finance',DLTR:'consumer',DOC:'health',DOV:'tech',DOW:'health',DRI:'consumer',DT:'tech',DTE:'energy',DUK:'energy',DVN:'energy',DXCM:'health',EA:'tech',ECL:'consumer',ED:'energy',EFX:'finance',EG:'finance',EIX:'energy',EL:'consumer',ELAN:'health',ELS:'finance',ELV:'health',EME:'tech',EMR:'tech',ENHA:'finance',ENTG:'tech',EOG:'energy',EQH:'finance',EQIX:'tech',EQR:'finance',EQT:'energy',ES:'energy',ESS:'finance',ETN:'tech',ETR:'energy',EVR:'finance',EVRG:'energy',EW:'health',EWBC:'finance',EWG:'etf',EWQ:'etf',EWU:'etf',EWY:'etf',EXC:'energy',EXE:'energy',EXEL:'health',EXPD:'tech',EXR:'tech',F:'auto',FAAA:'etf',FANG:'energy',FAST:'consumer',FCNCA:'finance',FCX:'consumer',FDX:'tech',FE:'energy',FERG:'consumer',FEZ:'etf',FFIV:'tech',FGDL:'etf',FHN:'finance',FICO:'tech',FIS:'finance',FISV:'finance',FITB:'finance',FIX:'tech',FLBL:'etf',FLQM:'etf',FNF:'finance',FSLR:'energy',FSML:'etf',FTAI:'tech',FTNT:'tech',FTV:'tech',FWONK:'consumer',GD:'tech',GDX:'etf',GE:'tech',GEHC:'health',GEN:'tech',GEV:'energy',GGG:'tech',GILD:'health',GIS:'consumer',GL:'finance',GLD:'etf',GLPI:'finance',GLW:'tech',GLXY:'crypto',GM:'auto',GME:'consumer',GNRC:'energy',GOOGL:'tech',GPC:'consumer',GPN:'finance',GS:'finance',GWW:'tech',HAL:'energy',HAS:'consumer',HBAN:'finance',HCA:'health',HD:'consumer',HEI:'tech',HIG:'auto',HIMS:'health',HLT:'consumer',HON:'tech',HOOD:'finance',HPE:'tech',HPQ:'tech',HST:'consumer',HSY:'consumer',HUBB:'tech',HUM:'health',HUT:'crypto',HWM:'tech',IBKR:'finance',IBM:'tech',ICE:'finance',IDXX:'health',IEMG:'finance',IEX:'tech',IFF:'consumer',IJR:'etf',ILMN:'health',INCY:'health',INSM:'health',INTC:'tech',INTU:'tech',INVH:'finance',IP:'consumer',IQM:'tech',IQV:'health',IR:'tech',IREN:'crypto',IRM:'tech',ISRG:'health',ITA:'etf',ITT:'tech',ITW:'tech',IWM:'etf',J:'tech',JAAA:'etf',JBHT:'consumer',JBL:'tech',JLL:'finance',JNJ:'health',JPM:'finance',JPST:'finance',KDP:'consumer',KEY:'finance',KEYS:'tech',KHC:'consumer',KIM:'finance',KKR:'finance',KLAC:'tech',KMB:'consumer',KMI:'energy',KNX:'consumer',KO:'consumer',KR:'consumer',KRAQ:'etf',KVUE:'consumer',L:'finance',LAMR:'consumer',LDOS:'tech',LECO:'energy',LEN:'consumer',LHX:'tech',LII:'tech',LIN:'health',LITE:'finance',LLY:'health',LMT:'tech',LNG:'energy',LNT:'energy',LOW:'consumer',LPLA:'finance',LRCX:'tech',LSCC:'tech',LUV:'consumer',LVS:'energy',LYV:'consumer',MA:'finance',MAA:'finance',MAR:'consumer',MARA:'crypto',MAS:'consumer',MCD:'consumer',MCHP:'tech',MCK:'health',MCO:'finance',MDB:'tech',MDLN:'health',MDLZ:'consumer',MDT:'health',MET:'finance',META:'tech',MKC:'consumer',MKL:'finance',MKSI:'tech',MLI:'tech',MLM:'consumer',MMM:'consumer',MO:'consumer',MOO:'etf',MPC:'energy',MPWR:'tech',MRK:'health',MRNA:'health',MRSH:'finance',MRVL:'tech',MS:'finance',MSCI:'finance',MSFT:'tech',MSI:'tech',MSTR:'crypto',MTB:'finance',MTD:'health',MTSI:'tech',MTZ:'energy',MU:'tech',NBIX:'health',NDAQ:'finance',NDSN:'tech',NEE:'energy',NEM:'consumer',NET:'tech',NFLX:'tech',NI:'energy',NKE:'consumer',NLR:'etf',NLY:'finance',NOC:'tech',NOW:'tech',NRG:'energy',NSC:'tech',NTAP:'tech',NTNX:'tech',NTRA:'health',NTRS:'finance',NUE:'consumer',NVDA:'tech',NVO:'health',NYT:'consumer',O:'finance',ODFL:'tech',OHI:'health',OKE:'energy',OKLO:'energy',OKTA:'tech',OMC:'consumer',ON:'tech',ONDS:'tech',ONTO:'tech',OPEN:'finance',ORCL:'tech',ORLY:'auto',OTIS:'tech',OVV:'energy',OXY:'energy',P:'consumer',PALL:'finance',PANW:'tech',PAYX:'tech',PCAR:'auto',PCG:'energy',PEG:'energy',PEN:'health',PEP:'consumer',PFE:'health',PFG:'finance',PFGC:'consumer',PG:'consumer',PGR:'finance',PH:'tech',PINS:'tech',PKG:'consumer',PL:'tech',PLD:'finance',PLTR:'tech',PM:'consumer',PNC:'finance',PNFP:'finance',PNW:'finance',PPG:'consumer',PPL:'energy',PPLT:'finance',PR:'energy',PRU:'finance',PSA:'finance',PSX:'energy',PTC:'tech',PWR:'tech',PYPL:'finance',Q:'tech',QCOM:'tech',QQQ:'etf',QSR:'consumer',RBA:'etf',RBLX:'tech',RCAT:'tech',RDDT:'tech',REG:'finance',REGN:'health',RF:'finance',RGA:'finance',RGLD:'etf',RIOT:'crypto',RIVN:'auto',RJF:'finance',RKLB:'tech',RL:'consumer',RMD:'health',RNR:'finance',ROIV:'health',ROK:'tech',ROKU:'tech',ROL:'consumer',ROP:'tech',ROST:'consumer',RRX:'tech',RS:'tech',RSG:'energy',RTX:'tech',RVMD:'health',SAIA:'consumer',SATA:'etf',SBAC:'tech',SBET:'consumer',SBUX:'consumer',SCCO:'etf',SCHF:'finance',SCHW:'finance',SGI:'consumer',SGOV:'etf',SHW:'consumer',SJM:'consumer',SKHY:'tech',SLMT:'consumer',SLV:'etf',SMCI:'tech',SMH:'etf',SMR:'energy',SNA:'tech',SNDK:'tech',SNOW:'tech',SNPS:'tech',SNX:'tech',SO:'energy',SOFI:'finance',SOLS:'tech',SOXL:'tech',SOXX:'etf',SPCE:'tech',SPCX:'tech',SPG:'finance',SPY:'etf',SRE:'energy',SSNC:'tech',STLD:'consumer',STRC:'crypto',STRK:'crypto',STT:'finance',STZ:'consumer',SUI:'finance',SWK:'consumer',SYF:'finance',SYK:'health',SYY:'consumer',TBLL:'etf',TDG:'tech',TDY:'tech',TEAM:'tech',TER:'tech',TFC:'finance',THC:'health',TJX:'consumer',TLN:'energy',TMO:'health',TMUS:'tech',TOL:'consumer',TONX:'crypto',TPL:'energy',TPR:'consumer',TQQQ:'etf',TRGP:'energy',TRMB:'tech',TROW:'finance',TRU:'finance',TRV:'finance',TSCO:'consumer',TSLA:'auto',TSM:'tech',TSN:'consumer',TTWO:'tech',TW:'finance',TWLO:'tech',TXN:'tech',TXT:'tech',TYL:'tech',UAL:'consumer',UBER:'tech',UDR:'finance',ULTA:'consumer',UNH:'health',UNM:'finance',UNP:'tech',UPS:'tech',URA:'etf',URI:'tech',USAR:'etf',USB:'finance',USFD:'consumer',USPX:'etf',UTHR:'health',UUUU:'energy',V:'finance',VCX:'etf',VEEV:'tech',VGK:'etf',VICI:'finance',VIDA:'etf',VIK:'consumer',VLO:'energy',VLTO:'tech',VMC:'consumer',VOO:'etf',VRSK:'finance',VRSN:'tech',VRT:'finance',VRTX:'health',VT:'etf',VTI:'etf',VTR:'finance',VTRS:'health',VUG:'etf',VXUS:'etf',VZ:'tech',WAB:'tech',WAT:'health',WBD:'finance',WBS:'finance',WCC:'tech',WDAY:'tech',WDC:'tech',WEC:'energy',WELL:'finance',WEN:'consumer',WFC:'finance',WM:'energy',WMB:'energy',WMT:'tech',WPC:'finance',WRB:'finance',WSM:'consumer',WSO:'tech',WST:'health',WULF:'crypto',WWD:'tech',WY:'consumer',XEL:'energy',XLE:'etf',XOM:'energy',XOP:'etf',XPO:'tech',XYL:'tech',XYZ:'finance',YLDE:'etf',YUM:'consumer',ZBH:'health',ZBRA:'tech',ZM:'tech',ZS:'tech',ZTS:'health'};
  var GWX_CAT_KW = [
    ['etf', /\betf\b|trust\b|fund\b|spdr|ishares|vanguard|invesco|proshares|ark |index/i],
    ['crypto', /coinbase|microstrategy|bitcoin|crypto|blockchain|bitgo|circle|robinhood|marathon digital|riot platforms/i],
    ['auto', /\bauto|automotive|tesla|ford |general motors|rivian|lucid|\bmotor\b|vehicles?/i],
    ['energy', /\benergy|oil|petroleum|exxon|chevron|utility|utilities|electric power|solar|gas\b|pipeline|refin/i],
    ['health', /health|pharma|biotech|therapeut|medtronic|abbott|lilly|unitedhealth|pfizer|moderna|medical/i],
    ['finance', /\bbank|financial|capital|visa|mastercard|insurance|reit|realty|asset management|blackrock|schwab/i],
    ['tech', /technolog|software|semiconductor|chip|cloud|cyber|internet|nvidia|apple|microsoft|google|meta platforms|amazon|oracle|cisco|intel|palantir|broadcom|qualcomm|netflix|salesforce|adobe|aerospace|defense|electronics/i],
    ['consumer', /consumer|retail|coca|pepsi|mcdonald|nike|disney|walmart|costco|starbucks|restaurant|apparel|hotel|airline|beverage|food/i],
  ];
  function gwxMapCat(underlying, name) {
    var raw = String(underlying || '').toUpperCase();
    var u = raw.replace(/\./g, '');
    if (GWX_SEED_CAT[raw] || GWX_SEED_CAT[u]) return GWX_SEED_CAT[raw] || GWX_SEED_CAT[u];
    if (GWX_CAT_BY_SYM[raw] || GWX_CAT_BY_SYM[u]) return GWX_CAT_BY_SYM[raw] || GWX_CAT_BY_SYM[u];
    var blob = String(name || '') + ' ' + u;
    for (var i = 0; i < GWX_CAT_KW.length; i++) if (GWX_CAT_KW[i][1].test(blob)) return GWX_CAT_KW[i][0];
    return null;
  }
  function gwxConnected() {
    try {
      if (typeof gwReadOnlyAddress === 'function' && gwReadOnlyAddress()) return true;
      if (typeof gwIsWalletUiConnected === 'function' && gwIsWalletUiConnected()) return true;
    } catch (_) {}
    return false;
  }
  function gwxOpenConnect() {
    try {
      if (typeof openConnectModal === 'function') { openConnectModal(); return; }
      var chip = document.getElementById('walletChip');
      if (chip) chip.click();
    } catch (_) {}
  }
  function gwxUiChainId() {
    try { if (typeof gwGetActiveUiChainId === 'function') { var c = gwGetActiveUiChainId(); if (c) return Number(c); } } catch (_) {}
    return 1;
  }
  function gwxPickTrade(s) {
    if (!s) return null;
    var solMint = String(s.solMint || '');
    var cid = (s.addrs && typeof window.gwXstocksPickChain === 'function')
      ? window.gwXstocksPickChain(s.addrs, gwxUiChainId())
      : null;
    if (!cid && !solMint) return null;
    return {
      chainId: cid || null,
      address: (cid && s.addrs) ? s.addrs[cid] : '',
      decimals: s.decimals || 18,
      tokenSym: s.tokenSym,
      solMint: solMint,
      solDecimals: Number(s.solDecimals) || 8,
    };
  }
  var GWX_CACHE_KEY = 'gwx_xstocks_catalog_v7';
  var _gwxCatalogPromise = null;
  var gwxCatalogAt = 0;
  var gwxUsdtBal = 0;
  var gwxPositions = [];
  function gwxIsRealXStock(item) {
    if (!item) return false;
    var name = String(item.name || '');
    var tok = String(item.tokenSym || '');
    if (!/xStock$/i.test(name)) return false;
    if (tok && !/x$/i.test(tok)) return false;
    // Reject obvious non-equity leftovers if a bad cache slips through
    if (/network|wrapped|stable|frax|liquid staking|memecoin|protocol/i.test(name)) return false;
    var hasEvm = !!(item.addrs && Object.keys(item.addrs).length);
    var hasSol = !!(item.solMint && String(item.solMint).length >= 32);
    return hasEvm || hasSol;
  }
  function gwxEnrichItem(item) {
    if (!item) return null;
    var addrs = item.addrs || {};
    var chains = item.chains && item.chains.length
      ? item.chains.slice()
      : Object.keys(addrs).map(Number).filter(Boolean);
    var solMint = String(item.solMint || '');
    if (!chains.length && !solMint) return null;
    var pref = Number(item.chain)
      || (typeof window.gwXstocksPickChain === 'function' ? window.gwXstocksPickChain(addrs, 1) : null)
      || chains[0]
      || null;
    var label = item.chainLabel
      || (pref && window.GWX_ID_TO_LABEL && window.GWX_ID_TO_LABEL[pref])
      || (pref && Object.keys(GWX_NET).find(function (k) { return GWX_NET[k] === pref; }))
      || (solMint ? 'Solana' : String(pref));
    item.addrs = addrs;
    item.chains = chains;
    item.solMint = solMint;
    item.solDecimals = Number(item.solDecimals) || 8;
    item.chain = pref || 'solana';
    item.chainLabel = label;
    item.cat = item.cat || gwxMapCat(item.sym, item.name);
    item.decimals = item.decimals || 18;
    item.tradeable = item.halted ? false : true;
    if (!item.vol24 || item.vol24 === '—') item.vol24 = '—';
    if (!item.mc || item.mc === '—') item.mc = '—';
    item.chg = item.chg || 0;
    item.price = item.price || 0;
    return item;
  }
  function gwxFmtCompactUsd(n) {
    var v = Number(n);
    if (!(v > 0)) return '—';
    if (v >= 1e12) return '$' + (v / 1e12).toFixed(2) + 'T';
    if (v >= 1e9) return '$' + (v / 1e9).toFixed(2) + 'B';
    if (v >= 1e6) return '$' + (v / 1e6).toFixed(1) + 'M';
    if (v >= 1e3) return '$' + (v / 1e3).toFixed(1) + 'K';
    return '$' + v.toFixed(0);
  }
  function gwxSanitizeCatalog(items) {
    var out = [], seen = {};
    (items || []).forEach(function (raw) {
      var it = gwxEnrichItem(Object.assign({}, raw));
      if (!gwxIsRealXStock(it) || seen[it.sym]) return;
      seen[it.sym] = 1;
      out.push(it);
    });
    out.sort(function (a, b) { return a.sym.localeCompare(b.sym); });
    return out;
  }
  function gwxApplyCatalog(items) {
    var clean = gwxSanitizeCatalog(items);
    if (!clean.length) return;
    GROM_XSTOCKS.length = 0;
    clean.forEach(function (it) { GROM_XSTOCKS.push(it); });
    STOCK_MAP = {};
    GROM_XSTOCKS.forEach(function (s) { STOCK_MAP[s.sym] = s; });
    gwxPxInit = false;
    initPx();
    GROM_XSTOCKS.forEach(function (s) {
      if (s.price > 0) { gwxPx[s.sym] = s.price; gwxB0[s.sym] = s.price / (1 + (s.chg || 0) / 100); }
    });
    updateXstocksStats();
    renderXstocksRows();
  }
  async function gwxFetchBackedViaProxy() {
    if (window.__gromXstocksInflight) {
      var j0 = await window.__gromXstocksInflight;
      var items0 = gwxSanitizeCatalog((j0 && j0.items) || []);
      if (!items0.length) throw new Error('xstocks proxy empty');
      return items0;
    }
    window.__gromXstocksInflight = fetch('/api/market/xstocks', {
      headers: { Accept: 'application/json' }, cache: 'no-store',
    }).then(function (r) {
      if (!r.ok) throw new Error('xstocks proxy ' + r.status);
      return r.json();
    }).finally(function () { window.__gromXstocksInflight = null; });
    var d = await window.__gromXstocksInflight;
    var items = gwxSanitizeCatalog(d.items || []);
    if (!items.length) throw new Error('xstocks proxy empty');
    return items;
  }
  async function gwxFetchLifiFallback() {
    var r = await fetch('https://li.quest/v1/tokens?chains=1,42161,10,56', { headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error('lifi tokens ' + r.status);
    var d = await r.json();
    var tokens = d.tokens || {};
    var bySym = {};
    Object.keys(tokens).forEach(function (chain) {
      var cid = Number(chain);
      (tokens[chain] || []).forEach(function (t) {
        var name = String(t.name || '');
        var s = String(t.symbol || '');
        // STRICT: name must end with xStock — never accept bare *x tickers (LOGX, FRAX, TRX…)
        if (!/xStock$/i.test(name)) return;
        if (!/x$/i.test(s)) return;
        if (!t.address || !/^0x[a-fA-F0-9]{40}$/i.test(t.address)) return;
        var underlying = s.replace(/x$/i, '').toUpperCase();
        if (!bySym[underlying]) {
          bySym[underlying] = {
            sym: underlying, tokenSym: s, name: name, price: Number(t.priceUSD) || 0,
            chg: 0, vol24: '—', mc: '—', cat: gwxMapCat(underlying, name), logo: t.logoURI || '',
            addrs: {}, decimals: Number(t.decimals) || 18, tradeable: true, halted: false,
          };
        }
        bySym[underlying].addrs[cid] = t.address;
        if (t.priceUSD) bySym[underlying].price = Number(t.priceUSD);
      });
    });
    return gwxSanitizeCatalog(Object.keys(bySym).map(function (k) { return bySym[k]; }));
  }
  async function gwxLoadCatalog(force) {
    if (_gwxCatalogPromise && !force) return _gwxCatalogPromise;
    if (!force && gwxCatalogAt && (Date.now() - gwxCatalogAt) < 5 * 60 * 1000
      && GROM_XSTOCKS.length && gwxIsRealXStock(GROM_XSTOCKS[0]) && GROM_XSTOCKS.length < 900) {
      return GROM_XSTOCKS;
    }
    _gwxCatalogPromise = (async function () {
      try {
        // Drop poisoned v1 cache (LiFi junk: LOGX, FRAX, TRX…)
        try { localStorage.removeItem('gwx_btokens_catalog'); } catch (_) {}
        var cached = null;
        try { cached = JSON.parse(localStorage.getItem(GWX_CACHE_KEY) || 'null'); } catch (_) {}
        if (!force && cached && cached.at && (Date.now() - cached.at) < 5 * 60 * 1000 && cached.items && cached.items.length) {
          var cachedClean = gwxSanitizeCatalog(cached.items);
          if (cachedClean.length >= 20 && cachedClean.length === gwxSanitizeCatalog(cached.items).length) {
            // reject caches dominated by non-xStock (defensive)
            var okRatio = cachedClean.length / Math.max(1, cached.items.length);
            if (okRatio > 0.85) {
              gwxApplyCatalog(cachedClean);
              gwxCatalogAt = cached.at;
              gwxRefreshPrices();
              return cachedClean;
            }
          }
        }
        var items = null;
        try { items = await gwxFetchBackedViaProxy(); } catch (e) { console.warn('[gwx] backed proxy', e); }
        if (!items || !items.length) items = await gwxFetchLifiFallback();
        items = gwxSanitizeCatalog(items);
        if (items && items.length) {
          gwxApplyCatalog(items);
          gwxCatalogAt = Date.now();
          try { localStorage.setItem(GWX_CACHE_KEY, JSON.stringify({ at: gwxCatalogAt, items: items, v: 2 })); } catch (_) {}
          gwxRefreshPrices();
          return items;
        }
      } catch (e) {
        console.warn('[gwx] catalog load failed', e);
      } finally {
        _gwxCatalogPromise = null;
      }
      return GROM_XSTOCKS;
    })();
    return _gwxCatalogPromise;
  }
  async function gwxRefreshPrices() {
    var page = document.getElementById('page-xstocks');
    var wanted = [];
    var seen = {};
    function take(s) {
      if (!s || seen[s.sym]) return;
      seen[s.sym] = 1;
      wanted.push(s);
    }
    if (page) {
      page.querySelectorAll('.gwx-row[data-sym]').forEach(function (row) { take(STOCK_MAP[row.dataset.sym]); });
    }
    var lim = gwxMobile() ? 24 : 80;
    GROM_XSTOCKS.slice(0, lim).forEach(take);
    var mints = wanted.map(function (s) { return String(s.solMint || ''); }).filter(function (m) { return m.length >= 32; });
    for (var i = 0; i < mints.length; i += 25) {
      var part = mints.slice(i, i + 25);
      try {
        var r = await fetch('https://api.dexscreener.com/tokens/v1/solana/' + part.join(','), { headers: { Accept: 'application/json' } });
        if (!r.ok) continue;
        var pairs = await r.json();
        (Array.isArray(pairs) ? pairs : []).forEach(function (p) {
          var mint = (p && p.baseToken && p.baseToken.address) || '';
          var px = Number(p && p.priceUsd);
          if (!mint || !(px > 0)) return;
          GROM_XSTOCKS.forEach(function (s) {
            if (String(s.solMint || '') !== mint) return;
            gwxPx[s.sym] = px;
            s.price = px;
            if (!gwxB0[s.sym]) gwxB0[s.sym] = px;
          });
        });
      } catch (_) {}
    }
    // Patch visible rows only — full re-render drops mobile "Load more" window and janks scroll.
    try { refreshStockPrices(); } catch (_) { renderXstocksRows(); }
  }
  async function refreshUsdtBalChip() {
    try {
      if (!gwxConnected()) { gwxUsdtBal = 0; updateXstocksStats(); return; }
      var tradeChain = gwxUiChainId();
      if (typeof window.gwXstocksUsdtBalance === 'function') {
        gwxUsdtBal = await window.gwXstocksUsdtBalance(tradeChain);
      }
    } catch (_) { gwxUsdtBal = 0; }
    updateXstocksStats();
  }
  function updateXstocksStats() {
    var page = document.getElementById('page-xstocks'); if (!page) return;
    var stats = page.querySelectorAll('.gwx-stats > div');
    if (stats[0]) {
      var b = stats[0].querySelector('b');
      var sm = stats[0].querySelector('small');
      if (b) b.textContent = gwxConnected() ? money(gwxUsdtBal) : '—';
      if (sm) {
        sm.textContent = gwxConnected() ? tx('px_my_usdt', 'My USDT balance') : tx('px_connect_for_bal', 'Connect wallet');
        sm.classList.add('live');
      }
    }
    if (stats[1]) {
      var tb = stats[1].querySelector('b');
      if (tb) tb.textContent = String(GROM_XSTOCKS.length);
    }
  }
  async function gwxLoadPositions() {
    var addr = null;
    try { addr = typeof gwReadOnlyAddress === 'function' ? gwReadOnlyAddress() : null; } catch (_) {}
    if (!addr || typeof window.gwXstocksBalanceOf !== 'function') {
      gwxPositions = [];
      window.__gwxLastPositions = [];
      renderStockPos();
      try { document.dispatchEvent(new CustomEvent('grom:xstocks-positions-updated', { detail: { positions: [] } })); } catch (_) {}
      return;
    }
    var chainId = gwxUiChainId();
    var list = GROM_XSTOCKS.filter(function (s) { return s.addrs && (s.addrs[chainId] || s.addrs[1] || s.addrs[42161]); });
    var out = [];
    // Cap concurrent reads — scan tokens that have addr on preferred chains
    var batch = list.slice(0, 80);
    await Promise.all(batch.map(async function (s) {
      var cid = s.addrs[chainId] ? chainId : (s.addrs[1] ? 1 : 42161);
      var tokenAddr = s.addrs[cid];
      if (!tokenAddr) return;
      var qty = await window.gwXstocksBalanceOf({ chainId: cid, tokenAddress: tokenAddr, account: addr, decimals: s.decimals || 18 });
      if (!(qty > 0.0000001)) return;
      var px = curPx(s.sym) || s.price || 0;
      out.push({
        sym: s.sym, tokenSym: s.tokenSym, name: s.name, logo: s.logo,
        qty: qty, px: px, usd: qty * px, chainId: cid, address: tokenAddr, decimals: s.decimals || 18,
      });
    }));
    out.sort(function (a, b) { return b.usd - a.usd; });
    gwxPositions = out;
    window.__gwxLastPositions = out;
    renderStockPos();
    try { document.dispatchEvent(new CustomEvent('grom:xstocks-positions-updated', { detail: { positions: out } })); } catch (_) {}
  }
  function stockSparkSvg(sym, px, chg) {
    var n = 28;
    var pts = [];
    var base = Number(px) > 0 ? Number(px) : 1;
    var drift = Number(chg) || 0;
    var start = base / (1 + drift / 100);
    for (var i = 0; i < n; i++) {
      var t = i / (n - 1);
      var wave = Math.sin(i * 0.9 + (sym || '').length) * 0.004
        + Math.sin(i * 0.33) * 0.002;
      var y = start + (base - start) * t + base * wave;
      pts.push(y);
    }
    pts[n - 1] = base;
    var min = Math.min.apply(null, pts);
    var max = Math.max.apply(null, pts);
    var span = Math.max(max - min, base * 0.002) || 1;
    var w = 320, h = 72, pad = 4;
    var d = pts.map(function (v, i) {
      var x = pad + (w - pad * 2) * (i / (n - 1));
      var yy = h - pad - ((v - min) / span) * (h - pad * 2);
      return (i ? 'L' : 'M') + x.toFixed(1) + ' ' + yy.toFixed(1);
    }).join(' ');
    var up = drift >= 0;
    var stroke = up ? '#22c55e' : '#f87171';
    var fill = up ? 'rgba(34,197,94,.14)' : 'rgba(248,113,113,.14)';
    var area = d + ' L' + (w - pad) + ' ' + (h - pad) + ' L' + pad + ' ' + (h - pad) + ' Z';
    return '<div class="gtm-chart" aria-hidden="true">'
      + '<svg viewBox="0 0 ' + w + ' ' + h + '" width="100%" height="72" preserveAspectRatio="none">'
      + '<path d="' + area + '" fill="' + fill + '"/>'
      + '<path d="' + d + '" fill="none" stroke="' + stroke + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'
      + '</svg>'
      + '<div class="gtm-chart-meta"><span>' + (sym || '') + '</span>'
      + '<span class="' + (up ? 'up' : 'dn') + '">' + (up ? '+' : '') + (Number.isFinite(drift) ? drift.toFixed(2) : '0.00') + '%</span>'
      + '<span class="mono">$' + (base >= 100 ? base.toFixed(2) : base.toFixed(base >= 1 ? 2 : 4)) + '</span></div></div>';
  }

  function openStockModal(opts) {
    injectCss(); closeModal();
    var ov = document.createElement('div'); ov.id = 'gromTradeModal'; ov.className = 'gtm-ov';
    var balLabel = gwxConnected()
      ? (tx('px_my_usdt', 'My USDT balance') + ': <b>' + money(gwxUsdtBal) + '</b>')
      : tx('px_connect_wallet', 'Connect wallet to trade');
    var chartHtml = opts.chartHtml || '';
    ov.innerHTML = '<div class="gtm gtm-stock">'
      + '<div class="gtm-h"><span>' + opts.title + '</span><button class="gtm-x" type="button">✕</button></div>'
      + (opts.sub ? '<div class="gtm-sub">' + opts.sub + '</div>' : '')
      + chartHtml
      + '<div class="gtm-bal">' + balLabel + '</div>'
      + '<div class="gtm-field"><input type="number" id="gtmAmt" min="0" step="any" placeholder="0.00"/><span>' + (opts.unit || 'USDT') + '</span></div>'
      + '<div class="gtm-presets"><button type="button" data-a="25">$25</button><button type="button" data-a="100">$100</button><button type="button" data-a="500">$500</button><button type="button" data-a="max">Max</button></div>'
      + '<div class="gtm-info" id="gtmInfo"></div>'
      + '<div class="gtm-actions"><button type="button" class="gtm-cancel">' + tx('gtm_cancel', 'Cancel') + '</button><button type="button" class="gtm-confirm">' + opts.confirmLabel + '</button></div>'
      + '</div>';
    document.body.appendChild(ov);
    var amt = ov.querySelector('#gtmAmt'), info = ov.querySelector('#gtmInfo'), confirmBtn = ov.querySelector('.gtm-confirm');
    var quoteTimer = null, lastQuote = null, quoteSeq = 0;
    function instantEstimate(v) {
      var px = Number(opts.refPrice) || 0;
      if (!(v > 0) || !(px > 0)) return '';
      if (opts.unit === 'TOKEN') {
        return '≈ <b>' + (v * px).toFixed(2) + '</b> USDT · est.';
      }
      return '≈ <b>' + (v / px).toFixed(4) + '</b> ' + esc(opts.tokenLabel || '') + ' · est.';
    }
    async function upd() {
      var v = parseFloat(amt.value || '0');
      if (!v || v <= 0) { info.textContent = tx('px_enter_amount', 'Enter amount') + (opts.unit === 'TOKEN' ? '.' : ' USDT.'); return; }
      var est = instantEstimate(v);
      if (est) info.innerHTML = est + ' <span style="opacity:.7">' + tx('px_quoting', 'Fetching route…') + '</span>';
      else info.textContent = tx('px_quoting', 'Fetching route…');
      if (typeof opts.infoAsync === 'function') {
        var seq = ++quoteSeq;
        try {
          lastQuote = await opts.infoAsync(v);
          if (seq !== quoteSeq) return;
          info.innerHTML = lastQuote && lastQuote.html ? lastQuote.html : (lastQuote || '');
        } catch (e) {
          if (seq !== quoteSeq) return;
          info.textContent = (e && e.message) || tx('px_quote_fail', 'Quote unavailable');
        }
      } else if (typeof opts.info === 'function') {
        info.innerHTML = opts.info(v);
      }
    }
    amt.addEventListener('input', function () {
      clearTimeout(quoteTimer);
      var v = parseFloat(amt.value || '0');
      if (v > 0) {
        var est = instantEstimate(v);
        if (est) info.innerHTML = est;
      }
      quoteTimer = setTimeout(upd, 160);
    });
    ov.querySelectorAll('.gtm-presets button').forEach(function (b) {
      b.addEventListener('click', function () {
        if (b.dataset.a === 'max') amt.value = opts.unit === 'TOKEN' ? String(opts.maxToken || 0) : String(Math.floor(gwxUsdtBal * 100) / 100);
        else amt.value = b.dataset.a;
        upd();
      });
    });
    ov.querySelector('.gtm-x').onclick = closeModal;
    ov.querySelector('.gtm-cancel').onclick = closeModal;
    ov.addEventListener('click', function (e) { if (e.target === ov) closeModal(); });
    confirmBtn.onclick = async function () {
      var v = parseFloat(amt.value || '0');
      if (!v || v <= 0) { notify(tx('px_enter_amount', 'Enter amount'), 'error'); return; }
      if (!gwxConnected()) { gwxOpenConnect(); return; }
      if (opts.unit !== 'TOKEN' && v > gwxUsdtBal + 1e-9) { notify(tx('px_insufficient_usdt', 'Insufficient USDT'), 'error'); return; }
      confirmBtn.disabled = true;
      confirmBtn.textContent = tx('px_signing', 'Confirm in wallet…');
      try {
        await opts.onConfirm(v, lastQuote);
        closeModal();
      } catch (e) {
        notify((e && e.message) || tx('px_swap_fail', 'Swap failed'), 'error');
        confirmBtn.disabled = false;
        confirmBtn.textContent = opts.confirmLabel;
      }
    };
    upd(); setTimeout(function () { try { amt.focus(); } catch (_) {} }, 30);
  }

  function injectCss() {
    if (document.getElementById('grom-extra-enhance-css')) {
      try { document.getElementById('grom-extra-enhance-css').remove(); } catch (_) {}
    }
    var css = ''
      + '.gwx-bal{display:flex;flex-direction:column;padding-right:18px;margin-right:6px;border-right:1px solid rgba(255,255,255,.1)}'
      + '.gwx-bal b{font-size:16px;font-weight:800;color:var(--cyan,#3ac2ff)}'
      + '.gwx-bal small{font-size:11px;color:var(--silver5,#6b7a92)}'
      + '.gxp{margin-top:24px;scroll-margin-top:88px}'
      + '.gxp.gxp-flash{animation:gxpFlash 1.1s ease}'
      + '@keyframes gxpFlash{0%,100%{box-shadow:none}35%{box-shadow:0 0 0 2px rgba(58,194,255,.45),0 0 24px rgba(58,194,255,.18)}}'
      + '.gxp-h{font-size:13px;font-weight:800;letter-spacing:.4px;text-transform:uppercase;color:var(--silver4,#8c9bb2);margin-bottom:10px}'
      + '.gxp-list{display:flex;flex-direction:column;gap:8px}'
      + '.gxp-empty{color:var(--silver5,#6b7a92);font-size:13px;padding:14px;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.05);border-radius:12px}'
      + '.gxp-row{display:flex;align-items:center;gap:12px;padding:12px 14px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:12px}'
      + '.gxp-row > div:first-child{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}'
      + '.gxp-row b{font-size:13px;color:var(--silver1,#e7eef8)}'
      + '.gxp-row small{font-size:11px;color:var(--silver5,#6b7a92)}'
      + '.gxp-side{display:inline-block;font-size:9px;font-weight:800;letter-spacing:.4px;padding:1px 6px;border-radius:5px;margin-left:6px;vertical-align:middle}'
      + '.gxp-side.b{background:rgba(34,197,94,.18);color:#22c55e}.gxp-side.s{background:rgba(239,68,68,.18);color:#f87171}'
      + '.gxp-pnl{font-weight:800;font-size:13px;font-variant-numeric:tabular-nums}.gxp-pnl.up{color:#22c55e}.gxp-pnl.dn{color:#f87171}'
      + '.gxp-close{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);color:var(--silver2,#c8d4e8);font-weight:700;font-size:11px;padding:6px 10px;border-radius:8px;cursor:pointer}'
      + '.gxp-close:hover{background:rgba(255,255,255,.12)}'
      + '.gtm-ov{position:fixed;inset:0;background:rgba(46,55,71,.66);backdrop-filter:blur(4px);z-index:200;display:flex;align-items:center;justify-content:center;padding:16px;animation:gtmIn .16s ease}'
      + '@keyframes gtmIn{from{opacity:0}to{opacity:1}}'
      + '.gtm{width:100%;max-width:380px;background:linear-gradient(180deg,#303642,#252d3a);border:1px solid rgba(136,192,208,.18);border-radius:18px;padding:18px;box-shadow:0 20px 60px rgba(0,0,0,.45)}'
      + '.gtm.gtm-stock{max-width:420px}'
      + '.gtm-chart{margin:4px 0 12px;padding:8px 10px 6px;border-radius:12px;background:rgba(0,0,0,.22);border:1px solid rgba(136,192,208,.12)}'
      + '.gtm-chart svg{display:block;border-radius:8px}'
      + '.gtm-chart-meta{display:flex;justify-content:space-between;gap:8px;margin-top:6px;font-size:11px;color:var(--silver4,#8c9bb2);font-weight:700}'
      + '.gtm-chart-meta .up{color:#22c55e}.gtm-chart-meta .dn{color:#f87171}.gtm-chart-meta .mono{color:var(--silver1,#e7eef8);font-variant-numeric:tabular-nums}'
      + '.gtm-h{display:flex;justify-content:space-between;align-items:center;font-size:16px;font-weight:800;color:var(--silver1,#e7eef8)}'
      + '.gtm-x{background:none;border:none;color:var(--silver4,#8c9bb2);font-size:16px;cursor:pointer}'
      + '.gtm-sub{font-size:12px;color:var(--silver4,#8c9bb2);margin:6px 0 12px;line-height:1.4}'
      + '.gtm-bal{font-size:12px;color:var(--silver4,#8c9bb2);margin-bottom:10px;line-height:1.45}.gtm-bal b{color:var(--cyan,#3ac2ff)}'
      + '.gtm-fund{display:flex;flex-direction:column;gap:8px;margin:0 0 12px}'
      + '.gtm-bridge-btn,.gtm-swap-btn{width:100%;padding:11px 12px;border-radius:10px;font-weight:700;font-size:13px;cursor:pointer;font:inherit}'
      + '.gtm-bridge-btn{border:1px solid rgba(58,194,255,.35);background:rgba(58,194,255,.1);color:var(--silver1,#e7eef8)}'
      + '.gtm-swap-btn{border:1px solid rgba(34,197,94,.35);background:rgba(34,197,94,.1);color:#86efac}'
      + '.gtm-bridge-btn:disabled,.gtm-swap-btn:disabled{opacity:.55;cursor:wait}'
      + '.gtm-field{display:flex;align-items:center;gap:8px;background:rgba(37,45,58,.7);border:1px solid rgba(136,192,208,.2);border-radius:12px;padding:10px 14px}'
      + '.gtm-field input{flex:1;background:none;border:none;outline:none;color:var(--silver1,#e7eef8);font-size:18px;font-weight:700}'
      + '.gtm-field span{color:var(--silver4,#8c9bb2);font-weight:700;font-size:13px}'
      + '.gtm-presets{display:flex;gap:6px;margin:10px 0}'
      + '.gtm-presets button{flex:1;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);color:var(--silver2,#c8d4e8);font-weight:700;font-size:12px;padding:7px 0;border-radius:9px;cursor:pointer}'
      + '.gtm-presets button:hover{background:rgba(58,194,255,.16);color:var(--cyan,#3ac2ff)}'
      + '.gtm-info{font-size:12px;color:var(--silver3,#9ba9bf);min-height:34px;line-height:1.4;margin-bottom:12px}'
      + '.gtm-actions{display:flex;gap:8px}'
      + '.gtm-actions button{flex:1;padding:11px 0;border-radius:11px;font-weight:800;font-size:13px;cursor:pointer;border:none}'
      + '.gtm-cancel{background:rgba(255,255,255,.06);color:var(--silver2,#c8d4e8)}'
      + '.gtm-confirm{background:linear-gradient(135deg,#3ac2ff,#0091c4);color:#04121b}'
      + '@media(max-width:560px){.gtm-ov{align-items:flex-end;padding:0}.gtm{max-width:100%;border-radius:18px 18px 0 0;padding:16px 16px calc(16px + env(safe-area-inset-bottom,0px))}.gtm-fund{position:sticky;top:0;z-index:2;background:#252d3a;padding-bottom:4px}}'
      // ---- page shells (predict / xstocks) ----
      + '.gwx-wrap{max-width:1240px}'
      + '.gwx-hero{margin-bottom:18px}'
      + '.gwx-hero-row{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;flex-wrap:wrap;margin-bottom:6px}'
      + '.gwx-h1{margin:0;font-size:26px;font-weight:800;letter-spacing:-.4px;display:flex;align-items:center;gap:12px;color:var(--silver1,#e7eef8)}'
      + '.gwx-h1-ico{display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;width:42px;height:42px;border-radius:12px}'
      + '.gwx-h1-ico svg{width:21px;height:21px;display:block}'
      + '#page-predict .gwx-h1-ico{color:#ddd6fe;background:linear-gradient(145deg,rgba(124,108,240,.35),rgba(93,213,255,.1));border:1px solid rgba(167,139,250,.45);box-shadow:0 8px 22px -12px rgba(139,124,247,.55),0 1px 0 rgba(255,255,255,.1) inset;border-radius:14px 8px}'
      + '#page-xstocks .gwx-h1-ico{color:#ffe29a;background:linear-gradient(145deg,rgba(255,193,77,.32),rgba(255,122,61,.12));border:1px solid rgba(255,193,77,.42);box-shadow:0 8px 22px -12px rgba(255,168,60,.5),0 1px 0 rgba(255,255,255,.1) inset;border-radius:10px}'
      + '.gwx-badge{font-size:10px;font-weight:800;letter-spacing:.8px;padding:3px 8px;border-radius:6px}'
      + '.gwx-badge.beta{background:rgba(58,194,255,.18);color:#3ac2ff}.gwx-badge.new{background:rgba(34,197,94,.18);color:#22c55e}'
      + '.gwx-stats{display:flex;gap:20px;align-items:center}.gwx-stats>div{display:flex;flex-direction:column}'
      + '.gwx-stats b{font-size:15px;font-weight:800;color:var(--silver1,#e7eef8)}.gwx-stats small{font-size:11px;color:var(--silver5,#6b7a92)}'
      + '.gwx-hero-aside{display:flex;flex-direction:column;align-items:flex-end;gap:10px}'
      + '.gwx-jump{background:rgba(58,194,255,.12);border:1px solid rgba(58,194,255,.28);color:#7cd4ff;font-size:12px;font-weight:700;padding:8px 14px;border-radius:10px;cursor:pointer;white-space:nowrap;transition:.15s;display:inline-flex;align-items:center;gap:6px}'
      + '.gwx-jump:hover{background:rgba(58,194,255,.22);transform:translateY(-1px)}'
      + '.gwx-jump svg{width:14px;height:14px;opacity:.85}'
      + '.gwx-sub{color:var(--silver4,#8c9bb2);font-size:13.5px;line-height:1.55;max-width:760px;margin:6px 0 14px}'
      + '.gwx-seo{margin:12px 0 14px;padding:12px 14px;border-radius:12px;background:rgba(255,255,255,.03);border:1px solid rgba(136,192,208,.16)}'
      + '.gwx-seo p{margin:0;color:var(--silver4,#9fb3c9);font-size:12.8px;line-height:1.55}'
      + '.gwx-seo-nav{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}'
      + '.gwx-seo-nav button{background:rgba(255,255,255,.04);border:1px solid rgba(136,192,208,.2);color:var(--silver2,#dbe7f5);font-weight:700;font-size:11.5px;padding:7px 10px;border-radius:8px;cursor:pointer}'
      + '.gwx-seo-nav button:hover{background:rgba(77,158,255,.12);border-color:rgba(136,192,208,.4)}'
      + '.gwx-toolbar{display:flex;gap:12px;align-items:center;margin:14px 0 18px;flex-wrap:wrap}'
      + '.gwx-cats{display:flex;gap:8px;flex-wrap:wrap;flex:1;min-width:0}'
      + '.gwx-pill{display:inline-flex;align-items:center;gap:6px;background:rgba(47,53,67,.95);color:var(--silver3,#7a8291);border:1px solid rgba(136,192,208,.14);border-radius:999px;padding:8px 14px;font-size:12.5px;font-weight:600;cursor:pointer;transition:.15s;white-space:nowrap}'
      + '.gwx-pill-ico{display:inline-flex;align-items:center;justify-content:center;width:14px;height:14px;flex:none;opacity:.9}'
      + '.gwx-pill-ico svg,.gwx-cat svg,.gwx-q-ico svg,.grom-pv-cat svg,.lp-pc-cat svg,.lp-pc-ico svg{display:block;color:currentColor}'
      + '.gwx-pill:hover{background:rgba(255,255,255,.08);color:var(--silver1,#e7eef8)}'
      + '.gwx-pill.on{background:linear-gradient(135deg,rgba(58,194,255,.24),rgba(58,194,255,.08));color:#7cd4ff;border-color:rgba(58,194,255,.42);box-shadow:0 4px 16px rgba(58,194,255,.14)}'
      + '.gwx-search{position:relative;min-width:210px}'
      + '.gwx-search input{width:100%;background:rgba(47,53,67,.95);border:1px solid rgba(136,192,208,.18);border-radius:12px;padding:9px 14px 9px 34px;color:var(--silver1,#e7eef8);font-size:13px;outline:none;transition:.15s}'
      + '.gwx-search input:focus{border-color:rgba(58,194,255,.45);box-shadow:0 0 0 3px rgba(58,194,255,.1)}'
      + '.gwx-search:before{content:"⌕";position:absolute;left:12px;top:50%;transform:translateY(-52%);font-size:16px;color:var(--silver5,#6b7a92)}'
      + '.gwx-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px}'
      /* Polymarket-style compact cards */
      + '.gwx-card{position:relative;display:flex;flex-direction:column;background:#252833;border:1px solid rgba(255,255,255,.06);border-radius:12px;padding:14px 14px 12px;overflow:hidden;min-height:172px;transition:border-color .15s,background .15s;cursor:default}'
      + '.gwx-card:hover{border-color:rgba(255,255,255,.12);background:#2a2e3a}'
      + '.gwx-card:hover .gwx-ring:after{background:#2a2e3a}'
      + '.gwx-card-head{display:flex;align-items:flex-start;gap:10px;margin-bottom:12px}'
      + '.gwx-card-img{flex:none;width:40px;height:40px;border-radius:8px;object-fit:cover;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08)}'
      + '.gwx-q-ico{flex:none;width:40px;height:40px;border-radius:8px;display:grid;place-items:center;font-size:18px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08)}'
      + '.gwx-card-title{flex:1;min-width:0;font-size:14px;font-weight:700;line-height:1.4;color:#f4f5f7;overflow-wrap:anywhere;word-break:break-word}'
      + '.gwx-card-chance{flex:none;display:flex;flex-direction:column;align-items:center;justify-content:center;width:52px;margin-left:4px}'
      + '.gwx-ring{--p:50;width:48px;height:48px;border-radius:50%;display:grid;place-items:center;background:conic-gradient(#3d9a6a calc(var(--p)*1%),rgba(255,255,255,.08) 0);position:relative}'
      + '.gwx-ring:after{content:"";position:absolute;inset:5px;border-radius:50%;background:#252833;transition:background .15s}'
      + '.gwx-ring b{position:relative;z-index:1;font-size:11px;font-weight:800;color:#f4f5f7;font-variant-numeric:tabular-nums}'
      + '.gwx-ring-lbl{font-size:9px;font-weight:700;color:#8b93a7;margin-top:2px;letter-spacing:.02em}'
      + '.gwx-live{display:inline-flex;align-items:center;gap:4px;color:#ff4d4d;font-size:9px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;margin-bottom:6px}'
      + '.gwx-live i{width:6px;height:6px;border-radius:50%;background:#ff4d4d;box-shadow:0 0 6px rgba(255,77,77,.7);animation:gwxPulse 1.6s infinite}'
      + '@keyframes gwxPulse{0%{box-shadow:0 0 0 0 rgba(255,77,77,.55)}70%{box-shadow:0 0 0 7px rgba(255,77,77,0)}100%{box-shadow:0 0 0 0 rgba(255,77,77,0)}}'
      + '.gwx-cat{display:none}'
      + '.gwx-outcomes{display:flex;flex-direction:column;gap:6px;flex:1}'
      + '.gwx-oc{display:grid;grid-template-columns:1fr auto auto;align-items:center;gap:8px;padding:0;background:transparent;border:0;min-height:32px}'
      + '.gwx-oc-fill{display:none}'
      + '.gwx-oc-name{font-size:12.5px;font-weight:600;color:#d8dee9;line-height:1.25;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
      + '.gwx-oc-prob{font-size:12.5px;font-weight:800;color:#f4f5f7;font-variant-numeric:tabular-nums;min-width:36px;text-align:right}'
      + '.gwx-oc-prob.up{color:#3d9a6a}.gwx-oc-prob.dn{color:#c44}'
      + '.gwx-oc-btns{display:flex;gap:4px}'
      + '.gwx-yn{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:2px}'
      + '.gwx-yn .gwx-bet{min-width:0;width:100%;padding:10px 8px;border-radius:8px;font-size:13px;display:flex;align-items:center;justify-content:center;gap:6px}'
      + '.gwx-yn .gwx-bet b{font-weight:800;font-variant-numeric:tabular-nums;opacity:.92}'
      + '.gwx-bet{min-width:44px;padding:6px 10px;border-radius:6px;border:0;font-weight:800;font-size:11.5px;cursor:pointer;transition:filter .12s,transform .12s;text-align:center}'
      + '.gwx-yes{background:#1e3d2f;color:#4ade80}.gwx-yes:hover{filter:brightness(1.15)}'
      + '.gwx-no{background:#3d1e22;color:#f87171}.gwx-no:hover{filter:brightness(1.15)}'
      + '.gwx-bet-team{background:#2f3543;color:#e7eef8;max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.gwx-bet-team:hover{filter:brightness(1.12)}'
      + '.gwx-card-foot{display:flex;align-items:center;gap:10px;flex-wrap:wrap;color:#6b7385;font-size:11px;font-weight:600;margin-top:auto;padding-top:10px;border-top:1px solid rgba(255,255,255,.05)}'
      + '.gwx-card-foot span{display:inline-flex;align-items:center;gap:4px}'
      + '.gwx-none{grid-column:1/-1;text-align:center;color:var(--silver5,#6b7a92);font-size:14px;padding:48px 16px;background:rgba(255,255,255,.02);border:1px dashed rgba(255,255,255,.08);border-radius:16px}'
      + '.gwx-table{background:linear-gradient(180deg,#2f3543,#202737);border:1px solid rgba(136,192,208,.14);border-radius:16px;overflow:hidden}'
      // Same 6-col grid for head+rows; actions column fixed so headers don't drift; room before Buy/Sell.
      + '.gwx-thead,.gwx-row{display:grid;grid-template-columns:minmax(200px,2.4fr) minmax(90px,1fr) minmax(80px,.9fr) minmax(100px,1fr) minmax(128px,1.2fr) 168px;gap:16px;align-items:center;padding:14px 20px}'
      + '.gwx-thead{background:rgba(255,255,255,.03);color:var(--silver5,#6b7a92);font-size:11px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;border-bottom:1px solid rgba(255,255,255,.06)}'
      + '.gwx-thead .gwx-col-vol,.gwx-thead .gwx-col-mc{font-size:9px;letter-spacing:.25px;line-height:1.2;white-space:nowrap}'
      + '.gwx-thead>div:last-child{width:168px;min-width:168px}'
      + '.gwx-row{border-bottom:1px solid rgba(255,255,255,.04)}.gwx-row:last-child{border-bottom:0}.gwx-row:hover{background:rgba(255,255,255,.03)}'
      + '.gwx-row-sym{display:flex;align-items:center;gap:11px;min-width:0}'
      + '.gwx-logo{position:relative;overflow:hidden;flex:none;width:32px;height:32px;border-radius:9px;display:grid;place-items:center;font-weight:800;font-size:11px;color:#04121b;letter-spacing:-.3px}'
      + '.gwx-logo img,.gwx-row-sym .coin-ico img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#fff;padding:2px;z-index:2;border-radius:9px}'
      + '.gwx-logo .cl,.gwx-row-sym .coin-ico .cl{position:relative;z-index:1;font-weight:800;font-size:11px}'
      + '.gwx-q-logo{width:36px;height:36px;border-radius:11px;font-size:18px;color:#fff}'
      + '.gwx-row-sym .nm{display:flex;flex-direction:column;min-width:0}'
      + '.gwx-tick{font-weight:800;font-size:14px;color:var(--silver1,#e7eef8)}.gwx-name{color:var(--silver5,#6b7a92);font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
      + '.gwx-price{font-weight:700;font-size:14px;color:var(--silver1,#e7eef8);font-variant-numeric:tabular-nums}.gwx-chg{font-weight:700;font-size:13px;font-variant-numeric:tabular-nums}.gwx-up{color:#22c55e}.gwx-dn{color:#f87171}'
      + '.gwx-col-vol,.gwx-col-mc{color:var(--silver3,#9ba9bf);font-size:13px;font-variant-numeric:tabular-nums}'
      + '.gwx-col-mc{padding-right:12px}'
      + '.gwx-row-actions{display:flex;gap:8px;justify-content:flex-end;width:168px;min-width:168px;justify-self:end}'
      + '.gwx-trade{padding:7px 13px;border-radius:9px;border:0;font-weight:700;font-size:12px;cursor:pointer;transition:.13s;white-space:nowrap}'
      + '.gwx-buy{background:rgba(34,197,94,.18);color:#34d27f}.gwx-buy:hover{background:rgba(34,197,94,.3);transform:translateY(-1px)}'
      + '.gwx-sell{background:rgba(239,68,68,.18);color:#f87171}.gwx-sell:hover{background:rgba(239,68,68,.3);transform:translateY(-1px)}'
      + '.gwx-soon{display:inline-flex;align-items:center;padding:7px 12px;border-radius:9px;font-size:11px;font-weight:800;letter-spacing:.04em;color:#98a8c0;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08)}'
      + '.gwx-bal small.live{color:#7cd4ff}'
      + '.gwx-price.flash-up{animation:gwxFlashUp .6s ease}.gwx-price.flash-dn{animation:gwxFlashDn .6s ease}'
      + '@keyframes gwxFlashUp{0%{color:#34d27f;text-shadow:0 0 12px rgba(52,210,127,.6)}100%{color:var(--silver1,#e7eef8);text-shadow:none}}'
      + '@keyframes gwxFlashDn{0%{color:#f87171;text-shadow:0 0 12px rgba(248,113,113,.6)}100%{color:var(--silver1,#e7eef8);text-shadow:none}}'
      + '@media(max-width:1100px) and (min-width:761px){#page-xstocks .gwx-table{overflow-x:auto;-webkit-overflow-scrolling:touch}#page-xstocks .gwx-thead,#page-xstocks .gwx-row{min-width:720px}}'
      + '@media(max-width:760px){.gwx-toolbar{flex-direction:column;align-items:stretch;gap:10px}.gwx-cats{flex-wrap:nowrap;overflow-x:auto;overflow-y:hidden;touch-action:pan-x;width:100%;flex:0 0 auto;-webkit-overflow-scrolling:touch;padding-bottom:5px;scrollbar-width:none;-ms-overflow-style:none}.gwx-cats::-webkit-scrollbar{display:none}.gwx-pill{flex:0 0 auto}.gwx-search{width:100%;min-width:0}.gwx-grid{grid-template-columns:1fr;gap:12px}.gwx-hero-row{gap:14px}.gwx-hero-aside{align-items:flex-start;width:100%}.gwx-stats{gap:16px;flex-wrap:wrap}.gwx-h1{font-size:21px}.gwx-h1-ico{width:34px;height:34px}.gwx-h1-ico svg{width:17px;height:17px}.gwx-sub{font-size:12.5px}.gwx-live i,.grom-pv-pulse{animation:none!important}.gwx-card:hover{transform:none;box-shadow:none}.gwx-oc-fill{transition:none!important}.gwx-card{overflow:hidden}'
      + 'html.grom-safari .gwx-card{contain:none!important;overflow:hidden!important}'
      + '#page-predict,#page-dashboard{padding-bottom:calc(88px + env(safe-area-inset-bottom,0px))}'
      + '#page-dashboard .gw-ds-wrap{margin-bottom:16px}'
      + '#page-dashboard .gw-ds-card{margin-bottom:4px}'
      + '#page-xstocks .gwx-table{overflow-x:hidden;max-width:100%;border-radius:14px}'
      + '#page-xstocks .gwx-wrap,#page-xstocks .gwx-rows{max-width:100%;min-width:0}'
      + '#page-xstocks .gwx-thead{display:flex!important;align-items:center;gap:10px;min-width:0!important;max-width:100%;width:100%;box-sizing:border-box;padding:10px 12px}'
      + '#page-xstocks .gwx-thead>div:nth-child(1){flex:1 1 0;min-width:0}#page-xstocks .gwx-thead>div:nth-child(2),#page-xstocks .gwx-thead>div:nth-child(3){flex:0 0 auto}#page-xstocks .gwx-thead>div:nth-child(n+4){display:none!important}'
      + '#page-xstocks .gwx-row{display:flex!important;flex-wrap:wrap!important;align-items:center;column-gap:8px;row-gap:8px;min-width:0!important;max-width:100%!important;width:100%!important;box-sizing:border-box;padding:12px;overflow:hidden;grid-template-columns:none!important;grid-template-areas:none!important}'
      + '#page-xstocks .gwx-row-sym{flex:1 1 0!important;min-width:0!important;max-width:100%;order:1;overflow:hidden}'
      + '#page-xstocks .gwx-row-sym .nm,#page-xstocks .gwx-name,#page-xstocks .gwx-tick{min-width:0;max-width:100%;overflow:hidden;text-overflow:ellipsis}'
      + '#page-xstocks .gwx-price{order:2;flex:0 0 auto}#page-xstocks .gwx-chg{order:3;flex:0 0 auto;text-align:right}'
      + '#page-xstocks .gwx-row>.gwx-col-vol,#page-xstocks .gwx-row>.gwx-col-mc{display:none!important}'
      + '#page-xstocks .gwx-row-actions{order:4;flex:1 1 100%!important;display:grid!important;grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important;width:100%!important;max-width:100%!important;min-width:0!important;gap:8px!important;justify-content:stretch!important;justify-self:stretch!important;box-sizing:border-box}'
      + '#page-xstocks .gwx-trade,#page-xstocks .gwx-soon{display:inline-flex!important;align-items:center;justify-content:center;width:100%!important;min-width:0!important;max-width:none!important;flex:none!important;min-height:42px;padding:10px 8px;font-size:13px;border-radius:10px;box-sizing:border-box}}'
      + '.gwx-load-more{grid-column:1/-1;display:block;width:100%;margin:4px 0 8px;padding:14px;border-radius:14px;border:1px dashed rgba(58,194,255,.35);background:rgba(58,194,255,.08);color:#7cd4ff;font:inherit;font-size:13px;font-weight:700;cursor:pointer}'
      + '.gwx-load-more:active{background:rgba(58,194,255,.16)}'
      + '@media(max-width:560px){.gwx-card{padding:14px}.gwx-bet{min-width:48px;padding:7px 10px}.gwx-yn .gwx-bet{padding:11px 8px}}'
      + '.gwx-foot{color:var(--silver5,#6b7a92);font-size:12px;line-height:1.6;margin-top:22px;padding-top:16px;border-top:1px solid rgba(255,255,255,.05)}'
      + '.gwx-link{color:#3ac2ff;text-decoration:none}'
      + '@media(max-width:900px){.gwx-bal{border-right:none;padding-right:0}}'
      // ---- predict live calendar (Polymarket-style) ----
      + '#page-predict.gwx-live-view .gwx-grid{display:none!important}'
      + '#page-predict.gwx-live-view #gwxPredictCal{display:block!important}'
      + '#page-predict:not(.gwx-live-view) #gwxPredictCal{display:none!important}'
      + '.gwx-cal[hidden]{display:none!important}'
      + '.gwx-view-tabs{display:flex;gap:8px;margin:0 0 14px;flex-wrap:wrap;align-items:center}'
      + '.gwx-view-tabs .gwx-jump{margin-left:auto}'
      + '.gwx-view-tab{display:inline-flex;align-items:center;gap:7px;padding:9px 16px;border-radius:999px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.04);color:var(--silver3,#9ba9bf);font:inherit;font-size:12.5px;font-weight:700;cursor:pointer;transition:.15s}'
      + '.gwx-view-tab:hover{color:var(--silver1,#e7eef8);background:rgba(255,255,255,.07)}'
      + '.gwx-view-tab.on{background:linear-gradient(135deg,rgba(34,197,94,.22),rgba(34,197,94,.08));color:#34d27f;border-color:rgba(34,197,94,.35);box-shadow:0 4px 18px rgba(34,197,94,.12)}'
      + '.gwx-view-tab .gwx-live-dot{width:7px;height:7px;border-radius:50%;background:#22c55e;box-shadow:0 0 8px rgba(34,197,94,.65);animation:gwxPulse 1.6s infinite}'
      + 'html.grom-safari .gwx-view-tab .gwx-live-dot,html.grom-safari .gwx-cal-head .gwx-live-dot{animation:none!important}'
      + '.gwx-cal{background:transparent;border:0;border-radius:0;overflow:visible}'
      + '.gwx-cal-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:4px 2px 12px;border-bottom:0;background:transparent}'
      + '.gwx-cal-head h3{margin:0;font-size:18px;font-weight:800;color:var(--silver1,#e7eef8);display:flex;align-items:center;gap:8px}'
      + '.gwx-cal-src{font-size:11px;font-weight:700;letter-spacing:.04em;color:var(--silver5,#6b7a92)}'
      + '.gwx-cal-days{display:flex;gap:8px;padding:0 0 14px;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;border-bottom:0}'
      + '.gwx-cal-days::-webkit-scrollbar{display:none}'
      + '.gwx-cal-day{flex:0 0 auto;padding:8px 14px;border-radius:999px;border:1px solid rgba(255,255,255,.08);background:#252833;color:#8b93a7;font:inherit;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;transition:.15s}'
      + '.gwx-cal-day:hover{color:#e7eef8;border-color:rgba(255,255,255,.14)}'
      + '.gwx-cal-day.on{color:#fff;border-color:rgba(255,255,255,.22);background:#2f3543}'
      + '.gwx-cal-list{display:flex;flex-direction:column;gap:18px}'
      + '.gwx-cal-sec{display:flex;flex-direction:column;gap:8px}'
      + '.gwx-cal-sec-h{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:0 2px}'
      + '.gwx-cal-sec-h b{font-size:13px;font-weight:800;color:#f4f5f7;display:inline-flex;align-items:center;gap:7px}'
      + '.gwx-cal-sec-h span{font-size:11px;font-weight:700;color:#6b7385}'
      + '.gwx-cal-sec-body{display:flex;flex-direction:column;gap:8px}'
      + '.gwx-cal-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:14px;align-items:center;padding:14px 14px;background:#252833;border:1px solid rgba(255,255,255,.06);border-radius:12px;transition:border-color .15s,background .15s}'
      + '.gwx-cal-row:hover{border-color:rgba(255,255,255,.12);background:#2a2e3a}'
      + '.gwx-cal-main{min-width:0;display:flex;flex-direction:column;gap:8px}'
      + '.gwx-cal-top{display:flex;align-items:center;gap:10px;flex-wrap:wrap}'
      + '.gwx-cal-crumb{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:700;color:#8b93a7}'
      + '.gwx-cal-crumb .gwx-live{margin:0}'
      + '.gwx-cal-body{display:flex;align-items:flex-start;gap:12px}'
      + '.gwx-cal-img{flex:none;width:44px;height:44px;border-radius:8px;object-fit:cover;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08)}'
      + '.gwx-cal-ico{flex:none;width:44px;height:44px;border-radius:8px;display:grid;place-items:center;font-size:18px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08)}'
      + '.gwx-cal-qwrap{min-width:0;flex:1}'
      + '.gwx-cal-q{font-size:14px;font-weight:700;color:#f4f5f7;line-height:1.4;margin:0 0 4px;overflow-wrap:anywhere;word-break:break-word}'
      + '.gwx-cal-meta{display:flex;flex-wrap:wrap;gap:8px 12px;font-size:11.5px;color:#8b93a7;align-items:center}'
      + '.gwx-cal-meta b{color:#e7eef8;font-weight:800}'
      + '.gwx-cal-time{font-variant-numeric:tabular-nums;font-weight:700;color:#6b7385}'
      + '.gwx-cal-actions{display:flex;flex-direction:column;gap:6px;flex-shrink:0;width:200px;max-width:42vw}'
      + '.gwx-cal-actions .gwx-bet{width:100%;min-width:0;max-width:100%;box-sizing:border-box;padding:10px 12px;border-radius:8px;font-size:12.5px;display:flex;align-items:center;justify-content:space-between;gap:10px;overflow:hidden}'
      + '.gwx-cal-actions .gwx-bet>span{min-width:0;flex:1 1 auto;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:left}'
      + '.gwx-cal-actions .gwx-bet em{flex:none;font-style:normal;font-weight:800;font-variant-numeric:tabular-nums;opacity:.95}'
      + '.gwx-cal-actions .gwx-bet-team{background:#2f3543;color:#e7eef8}'
      + '.gwx-cal-more{display:block;width:100%;margin-top:4px;padding:12px;border-radius:12px;border:1px dashed rgba(255,255,255,.12);background:rgba(255,255,255,.03);color:#9ba9bf;font:inherit;font-size:12.5px;font-weight:700;cursor:pointer}'
      + '.gwx-cal-more:hover{color:#e7eef8;border-color:rgba(255,255,255,.2)}'
      + '@media(max-width:760px){.gwx-cal-row{grid-template-columns:1fr;gap:12px;padding:12px}.gwx-cal-actions{width:100%;max-width:none;display:grid;grid-template-columns:1fr 1fr}.gwx-cal-actions .gwx-bet{padding:10px}.gwx-cal-q{font-size:13.5px}}'
      // ---- dashboard + landing prediction previews (match #predict cards) ----
      + '.card--predict-spot{background:linear-gradient(180deg,#2f3543,#202737);border-color:rgba(255,255,255,.08)}'
      + '.grom-pv-pulse{display:inline-block;width:8px;height:8px;border-radius:50%;background:#22c55e;box-shadow:0 0 10px rgba(34,197,94,.6);margin-right:6px;vertical-align:middle;animation:gwxLive 1.4s ease-in-out infinite}'
      + '.grom-pv-beta{font-size:9px;font-weight:800;letter-spacing:.6px;padding:2px 6px;border-radius:5px;background:rgba(58,194,255,.16);color:#3ac2ff;margin-left:6px;vertical-align:middle}'
      + '.grom-pv-link{background:none;border:none;color:#7cd4ff;font-size:12px;font-weight:700;cursor:pointer;padding:0}'
      + '.grom-pv-link:hover{text-decoration:underline}'
      + '.grom-pv-sub{font-size:12.5px;color:var(--silver4,#8c9bb2);line-height:1.5;margin:-4px 0 14px}'
      + '.grom-pv-list{display:flex;flex-direction:column;gap:10px}'
      + '.grom-pv-item{display:block;width:100%;text-align:left;background:#252833;border:1px solid rgba(255,255,255,.06);border-radius:12px;padding:14px;cursor:pointer;transition:border-color .15s,background .15s;color:inherit;font:inherit;overflow:hidden;position:relative;isolation:isolate}'
      + '.grom-pv-item:hover{background:#2a2e3a;border-color:rgba(255,255,255,.12)}'
      + '.grom-pv-item:hover .grom-pv-ring:after{background:#2a2e3a}'
      + '.grom-pv-item-top{display:flex;align-items:center;gap:8px;margin-bottom:10px}'
      + '.grom-pv-cat{font-size:10px;font-weight:700;color:#8b93a7}'
      + '.grom-pv-live-sm{display:inline-flex;align-items:center;gap:4px;font-size:8.5px;font-weight:800;letter-spacing:.08em;color:#ff4d4d;text-transform:uppercase}'
      + '.grom-pv-live-sm i{width:5px;height:5px;border-radius:50%;background:#ff4d4d;animation:gwxPulse 1.6s infinite}'
      + '.grom-pv-head{display:flex;align-items:flex-start;gap:10px;margin-bottom:10px}'
      + '.grom-pv-q{flex:1;min-width:0;font-size:13.5px;font-weight:700;color:#f4f5f7;line-height:1.4;overflow-wrap:anywhere;word-break:break-word}'
      + '.grom-pv-chance{flex:none;width:48px;display:flex;flex-direction:column;align-items:center}'
      + '.grom-pv-ring{--p:50;width:44px;height:44px;border-radius:50%;display:grid;place-items:center;background:conic-gradient(#3d9a6a calc(var(--p)*1%),rgba(255,255,255,.08) 0);position:relative}'
      + '.grom-pv-ring:after{content:"";position:absolute;inset:5px;border-radius:50%;background:#252833;transition:background .15s}'
      + '.grom-pv-ring b{position:relative;z-index:1;font-size:10.5px;font-weight:800;color:#f4f5f7;font-variant-numeric:tabular-nums}'
      + '.grom-pv-ring-lbl{font-size:9px;font-weight:700;color:#8b93a7;margin-top:2px}'
      + '.grom-pv-yn{display:grid;grid-template-columns:1fr 1fr;gap:8px}'
      + '.grom-pv-yes,.grom-pv-no{display:flex;align-items:center;justify-content:center;gap:6px;padding:9px 8px;border-radius:8px;font-size:12.5px;font-weight:800}'
      + '.grom-pv-yes{background:#1e3d2f;color:#4ade80}.grom-pv-no{background:#3d1e22;color:#f87171}'
      + '.grom-pv-yes b,.grom-pv-no b{font-weight:800;font-variant-numeric:tabular-nums}'
      + '.lp-predict-card{background:#252833;border:1px solid rgba(255,255,255,.06);border-radius:12px;padding:14px;cursor:pointer;transition:border-color .15s,background .15s;text-align:left}'
      + '.lp-predict-card:hover{background:#2a2e3a;border-color:rgba(255,255,255,.12)}'
      + '.lp-predict-card:hover .grom-pv-ring:after{background:#2a2e3a}'
      + '.lp-pc-top{display:flex;align-items:center;gap:8px;margin-bottom:10px}'
      + '.lp-pc-cat{font-size:10px;font-weight:700;color:#8b93a7}'
      + '.lp-pc-live{display:inline-flex;align-items:center;gap:4px;font-size:8.5px;font-weight:800;letter-spacing:.08em;color:#ff4d4d;text-transform:uppercase}'
      + '.lp-pc-live i{width:5px;height:5px;border-radius:50%;background:#ff4d4d}';
    var s = document.createElement('style'); s.id = 'grom-extra-enhance-css'; s.textContent = css;
    document.head.appendChild(s);
  }

  /* ---- modal ---- */
  function closeModal() { var m = document.getElementById('gromTradeModal'); if (m) m.remove(); }

  /** Instant Swap (Advanced) → YOU RECEIVE native USDC on Polygon for Predict stakes. */
  function gwxOpenPolygonSwap(amountUsd) {
    closeModal();
    var wantUsd = Number(amountUsd) > 0 ? Number(amountUsd) : 25;
    var payload = {
      toSym: 'USDC',
      toChainId: 137,
      toAddress: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
      toDecimals: 6,
      amountUsd: wantUsd,
      forceBridge: true,
      hint: tx('px_pm_swap_hint', 'Advanced swap · YOU RECEIVE USDC on Polygon for Predict'),
    };
    var run = function () {
      if (typeof window.gwOpenTargetSwap === 'function') {
        window.gwOpenTargetSwap(payload);
        return true;
      }
      return false;
    };
    if (run()) return;
    try { if (typeof window.gromLoadWalletScripts === 'function') window.gromLoadWalletScripts(); } catch (_) {}
    var tries = 0;
    var poll = setInterval(function () {
      tries++;
      if (run()) { clearInterval(poll); return; }
      if (tries >= 60) {
        clearInterval(poll);
        try { location.hash = '#dashboard'; } catch (_) {}
        notify(tx('px_pm_swap_hint', 'Open Instant Swap and bridge USDC to Polygon'), 'info');
      }
    }, 100);
    if (window.gromWalletReady && typeof window.gromWalletReady.then === 'function') {
      window.gromWalletReady.then(function () { run(); }).catch(function () {});
    }
  }

  function openModal(opts) {
    injectCss(); closeModal();
    var live = !!opts.live;
    var ov = document.createElement('div'); ov.id = 'gromTradeModal'; ov.className = 'gtm-ov';
    var balLine = live
      ? (tx('px_pm_live_bal', 'Live · Polygon USDC/USDT in wallet'))
      : (tx('gtm_demo_bal', 'Balance:') + ' <b>' + money(bal()) + '</b>');
    ov.innerHTML = '<div class="gtm">'
      + '<div class="gtm-h"><span>' + opts.title + '</span><button class="gtm-x" type="button">✕</button></div>'
      + (opts.sub ? '<div class="gtm-sub">' + opts.sub + '</div>' : '')
      + '<div class="gtm-bal" id="gtmBal">' + balLine + '</div>'
      + (live ? '<div class="gtm-fund" id="gtmFund" style="display:none">'
        + '<button type="button" class="gtm-swap-btn" id="gtmFundBtn">'
        + tx('px_pm_fund_poly', 'Fund Polygon · Swap / Bridge') + '</button></div>' : '')
      + '<div class="gtm-field"><input type="number" id="gtmAmt" min="1" step="1" placeholder="0.00"/><span>USDT</span></div>'
      + '<div class="gtm-presets"><button type="button" data-a="25">$25</button><button type="button" data-a="100">$100</button><button type="button" data-a="500">$500</button><button type="button" data-a="max">Max</button></div>'
      + '<div class="gtm-info" id="gtmInfo"></div>'
      + '<div class="gtm-actions"><button type="button" class="gtm-cancel">' + tx('gtm_cancel', 'Cancel') + '</button><button type="button" class="gtm-confirm">' + opts.confirmLabel + '</button></div>'
      + '</div>';
    document.body.appendChild(ov);
    var amt = ov.querySelector('#gtmAmt'), info = ov.querySelector('#gtmInfo'), confirmBtn = ov.querySelector('.gtm-confirm');
    var balEl = ov.querySelector('#gtmBal'), fundWrap = ov.querySelector('#gtmFund');
    var fundBtn = ov.querySelector('#gtmFundBtn');
    function upd() { info.innerHTML = opts.info(parseFloat(amt.value || '0')); }
    amt.addEventListener('input', upd);
    ov.querySelectorAll('.gtm-presets button').forEach(function (b) {
      b.addEventListener('click', function () {
        amt.value = (b.dataset.a === 'max') ? (live ? '100' : String(Math.floor(bal()))) : b.dataset.a;
        upd();
      });
    });
    ov.querySelector('.gtm-x').onclick = closeModal;
    ov.querySelector('.gtm-cancel').onclick = closeModal;
    ov.addEventListener('click', function (e) { if (e.target === ov) closeModal(); });

    async function refreshLiveStatus() {
      if (!live) return;
      try {
        if (!window.gromPredict || typeof window.gromPredict.getStatus !== 'function') {
          if (balEl) balEl.textContent = tx('px_connect_wallet', 'Connect wallet to trade');
          if (fundWrap) fundWrap.style.display = '';
          return;
        }
        var st = await window.gromPredict.getStatus();
        if (!balEl) return;
        if (!st.connected) {
          balEl.textContent = tx('px_connect_wallet', 'Connect wallet to trade');
          if (fundWrap) fundWrap.style.display = '';
          if (fundBtn) fundBtn.textContent = tx('px_pm_fund_poly', 'Fund Polygon · Swap / Bridge');
          return;
        }
        var poly = Number(st.polyBal != null ? st.polyBal : ((st.polyUsdc || 0) + (st.polyUsdt || 0)));
        var arb = Number(st.arbUsdc != null ? st.arbUsdc : 0);
        var here = Number((st.usdc || 0) + (st.usdt || 0));
        if (st.chainId === 42161 && arb > here) here = arb;
        var need = !st.onPolygon || poly < 1 || !!st.needsFund;
        if (!st.onPolygon) {
          balEl.innerHTML = txFmt('px_pm_wrong_chain', 'Network: {n} · stakes need Polygon', { n: st.label || '—' })
            + ' · here <b>' + money(here) + '</b>'
            + (arb > 0 ? (' · Arb USDC <b>' + money(arb) + '</b>') : '')
            + ' · Polygon <b>' + money(poly) + '</b>';
        } else {
          balEl.innerHTML = tx('px_pm_live_bal', 'Live · Polygon') + ' · USDC/USDT <b>' + money(poly) + '</b>'
            + (arb > 0 ? (' · Arb USDC <b>' + money(arb) + '</b>') : '');
        }
        if (fundWrap) fundWrap.style.display = need ? '' : 'none';
        if (fundBtn) fundBtn.textContent = tx('px_pm_fund_poly', 'Fund Polygon · Swap / Bridge');
      } catch (e) {
        console.warn('[GROM] predict status', e);
        if (balEl) balEl.textContent = tx('px_connect_wallet', 'Connect wallet to trade');
        if (fundWrap) fundWrap.style.display = '';
      }
    }
    if (live) {
      refreshLiveStatus();
      if (fundBtn) {
        fundBtn.onclick = function () {
          var v = parseFloat(amt.value || '0') || 25;
          if (!gwxConnected()) { gwxOpenConnect(); return; }
          /* Always route via Instant Swap (Advanced) — not in-wallet LiFi bridge. */
          gwxOpenPolygonSwap(v);
        };
      }
    }

    confirmBtn.onclick = async function () {
      var v = parseFloat(amt.value || '0');
      if (!v || v <= 0) { notify(tx('px_enter_amount', 'Enter amount'), 'error'); return; }
      if (!live && v > bal()) { notify(tx('px_insufficient', 'Insufficient balance'), 'error'); return; }
      if (typeof opts.onConfirmAsync === 'function') {
        if (!gwxConnected()) { gwxOpenConnect(); return; }
        confirmBtn.disabled = true;
        confirmBtn.textContent = tx('px_signing', 'Confirm in wallet…');
        try {
          if (live && window.gromPredict && typeof window.gromPredict.getStatus === 'function') {
            var st0 = await window.gromPredict.getStatus();
            if (st0.needsFund || (st0.polyBal != null && st0.polyBal < 1) || !st0.onPolygon) {
              confirmBtn.disabled = false;
              confirmBtn.textContent = opts.confirmLabel;
              if (fundWrap) fundWrap.style.display = '';
              notify(tx('px_pm_need_poly_funds', 'Need USDC on Polygon — bridge or open Swap'), 'warn');
              return;
            }
            if (typeof window.gromPredict.ensurePolygon === 'function') {
              await window.gromPredict.ensurePolygon();
            }
          }
          await opts.onConfirmAsync(v);
          closeModal();
        } catch (e) {
          notify((e && e.message) || tx('px_swap_fail', 'Trade failed'), 'error');
          try {
            if (typeof window.gromReportIssue === 'function') {
              window.gromReportIssue({
                product: 'predict',
                action: live ? 'pm_bet_failed' : 'demo_bet_failed',
                message: String((e && e.message) || e || 'Trade failed').slice(0, 500),
                detail: {
                  live: !!live,
                  amount: v,
                  amt: v,
                  chainId: 137,
                  chainLabel: 'Polygon',
                  kind: /reject|denied|4001|cancel/i.test(String((e && e.message) || '')) ? 'cancelled' : 'failed',
                  admin_brief: /reject|denied|4001|cancel/i.test(String((e && e.message) || ''))
                    ? 'Отклонил ставку прогноза в кошельке'
                    : (live ? 'Сбой live-ставки Polymarket' : 'Сбой demo-ставки'),
                },
              });
            }
          } catch (_) {}
          confirmBtn.disabled = false;
          confirmBtn.textContent = opts.confirmLabel;
          if (live) refreshLiveStatus();
        }
        return;
      }
      opts.onConfirm(v); closeModal();
    };
    upd(); setTimeout(function () { try { amt.focus(); } catch (_) {} }, 30);
  }

  /* ---- balance chip ---- */
  function updateBalChips() {
    // Predict hero is Polygon USDC — never overwrite with retired paper-demo ledger.
    document.querySelectorAll('.gwx-bal-v').forEach(function (el) {
      if (el.closest('#page-predict')) return;
      el.textContent = money(bal());
    });
  }

  /* ---- helpers ---- */
  var gwxState = {
    pCat: 'all', pQ: '', pShow: 16, pView: 'all', pDay: 'today', pCalShow: 24,
    pOffset: 0, pHasMore: false, pTotal: 0, pPage: 1, pMode: 'browse',
    sCat: 'all', sQ: '', sShow: 20,
  };
  var GWX_MOBILE_BATCH = 16;
  var GWX_PREDICT_PAGE = 60;
  var GWX_STOCKS_BATCH = 20;
  function gwxMobile() { return window.matchMedia('(max-width:760px)').matches; }
  function gwxTickMs() {
    if (window.GROM_SAFARI) return 10000;
    return gwxMobile() ? 6000 : 1200;
  }
  var STOCK_MAP = {}; GROM_XSTOCKS.forEach(function (s) { STOCK_MAP[s.sym] = s; });
  var gwxPx = {}, gwxB0 = {}, gwxPxInit = false;
  function initPx() { if (gwxPxInit) return; GROM_XSTOCKS.forEach(function (s) { gwxPx[s.sym] = s.price; gwxB0[s.sym] = s.price / (1 + s.chg / 100); }); gwxPxInit = true; }
  function curPx(sym) { initPx(); if (gwxPx[sym] != null) return gwxPx[sym]; var s = STOCK_MAP[sym]; return s ? s.price : 0; }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function escA(s) { return esc(s).replace(/"/g, '&quot;'); }
  function fmtVol(n) { return '$' + (n >= 1e9 ? (n / 1e9).toFixed(2) + 'B' : n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : n.toFixed(0)); }
  function pcat(key) { for (var i = 0; i < GROM_PCATS.length; i++) if (GROM_PCATS[i][0] === key) return GROM_PCATS[i]; return ['all', 'i-globe', 'px_cat_all']; }
  function pcatLabel(key) { var c = pcat(key); return tx(c[2], c[2]); }
  function gwxSvg(id, size) {
    size = size || 14;
    return '<svg width="' + size + '" height="' + size + '" aria-hidden="true"><use href="#' + id + '"/></svg>';
  }
  function pcatIco(key, size) { return gwxSvg(pcat(key)[1] || 'i-globe', size || 14); }
  function logoBg(sym) {
    var h = 0; for (var i = 0; i < sym.length; i++) h = (h * 31 + sym.charCodeAt(i)) % 360;
    return 'linear-gradient(135deg,hsl(' + h + ',70%,58%),hsl(' + ((h + 40) % 360) + ',70%,46%))';
  }
  // Ticker → brand domain for real logos (Clearbit). Missing/failed logos
  // gracefully fall back to the coloured letter-avatar underneath.
  var STOCK_DOM = {
    AAPL: 'apple.com', MSFT: 'microsoft.com', NVDA: 'nvidia.com', GOOGL: 'google.com', META: 'meta.com',
    AMZN: 'amazon.com', AMD: 'amd.com', NFLX: 'netflix.com', ADBE: 'adobe.com', CRM: 'salesforce.com',
    ORCL: 'oracle.com', AVGO: 'broadcom.com', QCOM: 'qualcomm.com', CSCO: 'cisco.com', INTC: 'intel.com',
    IBM: 'ibm.com', PLTR: 'palantir.com', TSLA: 'tesla.com', F: 'ford.com', GM: 'gm.com', RIVN: 'rivian.com',
    JPM: 'jpmorganchase.com', BAC: 'bankofamerica.com', V: 'visa.com', MA: 'mastercard.com', GS: 'goldmansachs.com',
    MS: 'morganstanley.com', 'BRK.B': 'berkshirehathaway.com', KO: 'coca-colacompany.com', PEP: 'pepsico.com',
    MCD: 'mcdonalds.com', NKE: 'nike.com', DIS: 'disney.com', WMT: 'walmart.com', COST: 'costco.com',
    COIN: 'coinbase.com', MSTR: 'microstrategy.com', MARA: 'mara.com', HOOD: 'robinhood.com', XOM: 'exxonmobil.com',
    CVX: 'chevron.com', LLY: 'lilly.com', UNH: 'unitedhealthgroup.com', JNJ: 'jnj.com', PFE: 'pfizer.com',
    SPY: 'ssga.com', QQQ: 'invesco.com', DIA: 'ssga.com', IWM: 'ishares.com', ARKK: 'ark-funds.com'
  };
  function logoHtml(sym, fallbackText) {
    var t = String(sym || '').toUpperCase().replace(/\./g, '-');
    var fmp = 'https://financialmodelingprep.com/image-stock/' + t + '.png';
    var key = (typeof gromLogoKey === 'function') ? gromLogoKey(fmp, sym) : sym;
    if (window.__gromLogoOk && window.__gromLogoOk[key]) {
      return '<span class="gwx-logo gwx-has-logo coin-ico has-logo" style="background:' + logoBg(sym) + '"><img src="' + window.__gromLogoOk[key] + '" alt="" decoding="async"/></span>';
    }
    return '<span class="gwx-logo gwx-has-logo coin-ico has-logo" style="background:' + logoBg(sym) + '" data-logo="' + fmp + '" data-ltype="stock" data-lsym="' + sym + '"><span class="cl">' + fallbackText + '</span></span>';
  }

  /* ---- card / row markup ---- */
  // Markets whose probabilities track a real live underlying price (BTC, ETH,
  // a tokenized stock, …). "above target" outcomes move with the underlying.
  var GWX_UND = { btc_tgt: 'BTC', btc_ath: 'BTC', doge_50: 'DOGE', meta_tgt: 'META', pltr_tgt: 'PLTR', aapl_tgt: 'AAPL', nvda_tgt: 'NVDA', tsla_400: 'TSLA', sp500_6k: 'SPY' };
  function liveBadgeHtml(m, cls) {
    if (!predictIsLive(m)) return '';
    return '<span class="' + (cls || 'gwx-live') + '"><i></i> ' + tx('px_live', 'LIVE') + '</span>';
  }
  function pmRowTradeAttrs(r) {
    if (!r || !r.tradeable) return '';
    return ' data-token-yes="' + escA(r.tokenYes || '') + '"'
      + ' data-token-no="' + escA(r.tokenNo || '') + '"'
      + ' data-tick="' + escA(r.tickSize || '0.01') + '"'
      + ' data-min-size="' + escA(String(r.minSize || 5)) + '"'
      + ' data-neg-risk="' + (r.negRisk ? '1' : '0') + '"'
      + ' data-slug="' + escA(r.slug || '') + '"'
      + ' data-condition="' + escA(r.conditionId || '') + '"';
  }
  /** Share price 0.01–0.99 from button data-prob (already the clicked side's %). */
  function sidePriceFromBtn(btn) {
    var prob = parseFloat(btn && btn.dataset && btn.dataset.prob) || 50;
    return Math.min(0.99, Math.max(0.01, prob / 100));
  }
  function rowNoPct(r) {
    if (!r) return 50;
    if (r.pNo != null && isFinite(Number(r.pNo))) return Math.max(1, Math.min(99, Math.round(Number(r.pNo))));
    return Math.max(1, Math.min(99, 100 - (Number(r.p) || 50)));
  }
  function predictIsBinaryYesNo(m) {
    var rows = m.rows || [];
    if (rows.length !== 1) return false;
    var n = String(rows[0].n || '').toLowerCase();
    return !n || n === 'yes' || n === 'no' || n === 'да' || n === 'нет' || n === 'up' || n === 'down';
  }
  function predictCardHtml(m) {
    var rows = (m.rows || []).slice(0, 4);
    var binary = predictIsBinaryYesNo(m);
    var top = rows[0] || { p: 50, pNo: 50, n: 'Yes' };
    var ocs;
    if (binary) {
      var ta0 = pmRowTradeAttrs(top);
      var pNo = rowNoPct(top);
      ocs = '<div class="gwx-yn"' + ta0 + '>'
        + '<button type="button" class="gwx-bet gwx-yes" data-side="yes" data-name="Yes" data-prob="' + top.p + '">' + tx('px_yes', 'Yes') + ' <b>' + top.p + '%</b></button>'
        + '<button type="button" class="gwx-bet gwx-no" data-side="no" data-name="No" data-prob="' + pNo + '">' + tx('px_no', 'No') + ' <b>' + pNo + '%</b></button>'
        + '</div>';
    } else {
      ocs = rows.map(function (r) {
        var ta = pmRowTradeAttrs(r);
        var pNo = rowNoPct(r);
        return '<div class="gwx-oc"' + ta + '>'
          + '<span class="gwx-oc-name" title="' + escA(r.n) + '">' + esc(r.n) + '</span>'
          + '<span class="gwx-oc-prob">' + r.p + '%</span>'
          + '<span class="gwx-oc-btns">'
          + '<button type="button" class="gwx-bet gwx-yes" data-side="yes" data-name="' + escA(r.n) + '" data-prob="' + r.p + '">' + tx('px_yes', 'Yes') + '</button>'
          + '<button type="button" class="gwx-bet gwx-no" data-side="no" data-name="' + escA(r.n) + '" data-prob="' + pNo + '">' + tx('px_no', 'No') + '</button>'
          + '</span></div>';
      }).join('');
    }
    var imgLoad = (window.GROM_SAFARI || gwxMobile()) ? 'eager' : 'lazy';
    var imgHtml = m.img
      ? '<img class="gwx-card-img" src="' + escA(m.img) + '" alt="" loading="' + imgLoad + '" decoding="async" onerror="this.style.display=\'none\'">'
      : '<span class="gwx-q-ico">' + pcatIco(m.cat, 18) + '</span>';
    var chanceHtml = binary
      ? ('<div class="gwx-card-chance"><div class="gwx-ring" style="--p:' + top.p + '"><b>' + top.p + '%</b></div>'
        + '<div class="gwx-ring-lbl">' + esc(tx('px_chance', 'Chance')) + '</div></div>')
      : '';
    var und = GWX_UND[m.id] ? ' data-und="' + GWX_UND[m.id] + '"' : '';
    var live = predictIsLive(m) ? ('<div class="gwx-live"><i></i> ' + tx('px_live', 'LIVE') + '</div>') : '';
    return '<div class="gwx-card" data-pm-id="' + escA(m.id || m.q) + '" data-pm-slug="' + escA(m.slug || '') + '" data-q="' + escA(m.q) + '"' + und + '>'
      + live
      + '<div class="gwx-card-head">' + imgHtml
      + '<div class="gwx-card-title">' + esc(m.q) + '</div>'
      + chanceHtml + '</div>'
      + '<div class="gwx-outcomes">' + ocs + '</div>'
      + '<div class="gwx-card-foot"><span>' + fmtVol(m.vol) + ' ' + esc(tx('px_vol', 'Vol')) + '</span>'
      + (predictWhen(m) ? '<span>' + esc(predictWhen(m)) + '</span>' : '') + '</div></div>';
  }
  function stockRowHtml(s) {
    var px = curPx(s.sym) || s.price || 0;
    var b0 = gwxB0[s.sym] || s.price || px || 1;
    var chg = s.chg != null ? s.chg : ((px / b0 - 1) * 100);
    var cls = chg >= 0 ? 'gwx-up' : 'gwx-dn';
    var ini = s.sym.replace(/[^A-Z]/g, '').slice(0, 2) || s.sym.slice(0, 2);
    var trade = gwxPickTrade(s);
    var actions;
    if (s.halted || !trade) {
      actions = '<span class="gwx-soon" style="width:100%;justify-content:center">' + tx('px_soon', 'Soon') + '</span>';
    } else {
      // Equal columns via inline grid — survives desktop .gwx-row-actions width:168px races on mobile.
      actions = '<button type="button" class="gwx-trade gwx-buy" style="width:100%;min-width:0;box-sizing:border-box" data-sym="' + s.sym + '" data-side="buy">' + tx('px_buy', 'Buy') + '</button>'
        + '<button type="button" class="gwx-trade gwx-sell" style="width:100%;min-width:0;box-sizing:border-box" data-sym="' + s.sym + '" data-side="sell">' + tx('px_sell', 'Sell') + '</button>';
    }
    var tickLbl = s.tokenSym ? (s.sym + ' <small style="opacity:.55;font-weight:600">' + esc(s.tokenSym) + '</small>') : s.sym;
    return '<div class="gwx-row" data-sym="' + s.sym + '" data-b0="' + b0 + '">'
      + '<div class="gwx-row-sym">' + logoHtml(s.sym, ini)
      + '<div class="nm"><div class="gwx-tick">' + tickLbl + '</div><div class="gwx-name">' + esc(s.name) + '</div></div></div>'
      + '<div class="gwx-price">' + (px ? ('$' + px.toFixed(2)) : '—') + '</div>'
      + '<div class="gwx-chg ' + cls + '">' + (px ? ((chg >= 0 ? '+' : '') + chg.toFixed(2) + '%') : '—') + '</div>'
      + '<div class="gwx-col-vol">' + (s.vol24 || '—') + '</div>'
      + '<div class="gwx-col-mc">' + (s.mc || '—') + '</div>'
      + '<div class="gwx-row-actions" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;width:100%;max-width:100%;min-width:0;flex:1 0 100%;box-sizing:border-box">' + actions + '</div>'
      + '</div>';
  }
  function catTabsHtml(list, active, withIcon) {
    return list.map(function (c) {
      var on = (c[0] === active) ? ' on' : '';
      var label = withIcon
        ? ('<span class="gwx-pill-ico">' + gwxSvg(c[1], 13) + '</span>' + esc(tx(c[2], c[2])))
        : esc(tx(c[1], c[1]));
      return '<button type="button" class="gwx-pill' + on + '" data-cat="' + c[0] + '">' + label + '</button>';
    }).join('');
  }

  function heroJumpBtn(targetId, labelKey, fb) {
    return '<button type="button" class="gwx-jump" data-jump="' + targetId + '" aria-label="' + esc(tx(labelKey, fb)) + '">'
      + esc(tx(labelKey, fb)) + ' <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M12 5v14M5 12l7 7 7-7"/></svg></button>';
  }
  function scrollToGwxSection(id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    el.classList.remove('gxp-flash');
    void el.offsetWidth;
    el.classList.add('gxp-flash');
    setTimeout(function () { el.classList.remove('gxp-flash'); }, 1200);
  }

  /* ---- page builders ---- */
  function buildPredict() {
    initPx();
    var totalVol = GROM_PREDICT_MARKETS.reduce(function (a, m) { return a + m.vol; }, 0);
    return '<div class="gwx-wrap"><div class="gwx-hero"><div class="gwx-hero-row">'
      + '<h1 class="gwx-h1"><span class="gwx-h1-ico" aria-hidden="true"><svg width="21" height="21"><use href="#i-predict"/></svg></span><span>' + tx('pg_predict_title', 'Prediction markets') + '</span></h1>'
      + '<div class="gwx-hero-aside"><div class="gwx-stats"><div class="gwx-bal"><b class="gwx-bal-v">…</b><small>' + tx('px_poly_bal', 'Polygon USDC') + '</small></div><div><b>' + fmtVol(totalVol) + '</b><small>' + tx('px_vol_24h', '24h volume') + '</small></div><div><b>' + GROM_PREDICT_MARKETS.length + '</b><small>' + tx('px_markets_n', 'Markets') + '</small></div></div>'
      + '</div></div></div>'
      + '<div class="gwx-view-tabs" role="tablist">'
      + '<button type="button" class="gwx-view-tab' + (gwxState.pView === 'all' ? ' on' : '') + '" data-pview="all" role="tab">' + tx('px_view_all', 'All markets') + '</button>'
      + '<button type="button" class="gwx-view-tab' + (gwxState.pView === 'live' ? ' on' : '') + '" data-pview="live" role="tab"><span class="gwx-live-dot" aria-hidden="true"></span> ' + tx('px_view_live', 'Live calendar') + '</button>'
      + heroJumpBtn('gromPredictPos', 'px_my_bets', 'My bets')
      + '</div>'
      + '<div class="gwx-toolbar"><div class="gwx-cats">' + catTabsHtml(GROM_PCATS, gwxState.pCat, true) + '</div>'
      + '<div class="gwx-search"><input type="search" id="gwxPredictSearch" autocomplete="off" spellcheck="false" placeholder="' + esc(tx('px_search_predict', 'Search markets…')) + '" /></div></div>'
      + '<div class="gwx-seo"><p>' + esc((window.GROM_SEO_I18N && window.GROM_SEO_I18N.pageBlurb) ? window.GROM_SEO_I18N.pageBlurb('predict', (window.GROM_SEO_I18N.curLang ? window.GROM_SEO_I18N.curLang() : 'en')) : 'Prediction markets on GROM — live probabilities on crypto, sports, and politics.') + '</p><div class="gwx-seo-nav"><button type="button" onclick="show(\'markets\')">Crypto prices</button><button type="button" onclick="show(\'futures\')">Futures</button><button type="button" onclick="show(\'xstocks\')">Stocks</button><button type="button" onclick="show(\'help\')">Help</button></div></div>'
      + '<div class="gwx-grid"></div>'
      + '<div class="gwx-predict-more-wrap" id="gwxPredictMoreWrap" hidden style="padding:8px 0 16px">'
      + '<button type="button" class="gwx-load-more" id="gwxPredictLoadMore">' + tx('px_load_more', 'Load more') + '</button></div>'
      + '<div class="gwx-cal" id="gwxPredictCal" hidden></div>'
      + '<div class="gxp" id="gromPredictPos"><div class="gxp-h">' + tx('px_my_bets', 'My bets') + '</div><div class="gxp-list"></div></div>'
      + '<div class="gwx-foot">' + tx('px_foot_predict', '') + '</div></div>';
  }
  function buildXstocks() {
    initPx();
    var balTxt = gwxConnected() ? money(gwxUsdtBal) : '—';
    var balSm = gwxConnected() ? tx('px_my_usdt', 'My USDT balance') : tx('px_connect_for_bal', 'Connect wallet');
    return '<div class="gwx-wrap"><div class="gwx-hero"><div class="gwx-hero-row">'
      + '<div><h1 class="gwx-h1"><span class="gwx-h1-ico" aria-hidden="true"><svg width="21" height="21"><use href="#i-xstocks"/></svg></span><span>' + tx('pg_xstocks_title', 'Tokenized stocks') + '</span></h1>'
      + '<p class="gwx-sub">' + tx('pg_xstocks_sub', 'Real S&P 500 / NASDAQ stocks tokenized on-chain.') + '</p></div>'
      + '<div class="gwx-hero-aside"><div class="gwx-stats"><div class="gwx-bal"><b class="gwx-bal-v">' + balTxt + '</b><small class="live">' + balSm + '</small></div><div><b id="gwxTickerCount">' + GROM_XSTOCKS.length + '</b><small>' + tx('px_tickers', 'Tickers') + '</small></div><div><b>24/7</b><small>' + tx('px_trading', 'Trading') + '</small></div></div>'
      + heroJumpBtn('gromStockPos', 'px_my_positions', 'My positions') + '</div></div></div>'
      + '<div class="gwx-toolbar"><div class="gwx-cats">' + catTabsHtml(GROM_SCATS, gwxState.sCat, false) + '</div>'
      + '<div class="gwx-search"><input type="text" placeholder="' + esc(tx('px_search_stocks', 'Search ticker…')) + '" /></div></div>'
      + '<div class="gwx-seo"><p>' + esc((window.GROM_SEO_I18N && window.GROM_SEO_I18N.pageBlurb) ? window.GROM_SEO_I18N.pageBlurb('xstocks', (window.GROM_SEO_I18N.curLang ? window.GROM_SEO_I18N.curLang() : 'en')) : 'Tokenized stocks and xStocks on GROM.') + '</p><div class="gwx-seo-nav"><button type="button" onclick="show(\'markets\')">Crypto markets</button><button type="button" onclick="show(\'futures\')">Futures</button><button type="button" onclick="show(\'predict\')">Predictions</button><button type="button" onclick="show(\'help\')">Help</button></div></div>'
      + '<div class="gwx-table"><div class="gwx-thead"><div>' + tx('px_col_ticker', 'Ticker') + '</div><div>' + tx('px_col_price', 'Price') + '</div><div>' + tx('px_col_chg', '24h %') + '</div><div class="gwx-col-vol">' + tx('px_col_vol', '24h vol') + '</div><div class="gwx-col-mc">' + tx('px_col_mc', 'Market cap') + '</div><div></div></div><div class="gwx-rows"></div></div>'
      + '<div class="gxp" id="gromStockPos"><div class="gxp-h">' + tx('px_my_positions', 'My positions') + '</div><div class="gxp-list"></div></div>'
      + '<div class="gwx-foot">' + tx('px_foot_xstocks', 'Powered by Backed xStocks · fee 0.20% · non-custodial via LiFi') + '</div></div>';
  }
  var GWX_LIVE = null;
  var GWX_LIVE_SEARCH = null;
  var GWX_CATALOG = null; // full browse catalog for instant category filters
  var GWX_CATALOG_LANG = null;
  var _predictFetch = null;
  var _predictCatalogFetch = null;
  var _predictPollTimer = null;
  function predictMarketMap() {
    var map = Object.create(null);
    predictSource().forEach(function (m) { map[m.id || m.q] = m; });
    return map;
  }
  function patchPredictQuotes() {
    if (window.GROM_SAFARI || gwxMobile()) return;
    var page = document.getElementById('page-predict');
    if (!page || !page.classList.contains('active') || !GWX_LIVE || !GWX_LIVE.length) return;
    if (window.GROM_SAFARI || gwxMobile()) {
      var nowPx = Date.now();
      if (window.__gwxPatchLast && (nowPx - window.__gwxPatchLast) < 4000) return;
      window.__gwxPatchLast = nowPx;
    }
    var map = predictMarketMap();
    page.querySelectorAll('.gwx-card[data-pm-id], .gwx-cal-row[data-pm-id]').forEach(function (el) {
      var m = map[el.getAttribute('data-pm-id')];
      if (!m || !m.rows || !m.rows.length) return;
      if (el.classList.contains('gwx-cal-row')) {
        var r0 = m.rows[0];
        var pNo0 = rowNoPct(r0);
        var meta = el.querySelector('.gwx-cal-meta');
        if (meta) {
          var bEl = meta.querySelector('span b');
          if (bEl) bEl.textContent = r0.p + '%';
          else {
            var timeEl = meta.querySelector('.gwx-cal-time');
            var timeHtml = timeEl ? timeEl.outerHTML : '';
            meta.innerHTML = '<span><b>' + r0.p + '%</b> ' + esc(tx('px_chance', 'chance')) + '</span>' + timeHtml;
          }
        }
        var acts = el.querySelector('.gwx-cal-actions');
        if (acts) {
          var yesC = acts.querySelector('.gwx-bet.gwx-yes');
          var noC = acts.querySelector('.gwx-bet.gwx-no');
          if (yesC) {
            yesC.dataset.prob = r0.p;
            var ye = yesC.querySelector('em');
            if (ye) ye.textContent = pmCents(r0.p);
          }
          if (noC) {
            noC.dataset.prob = pNo0;
            var ne = noC.querySelector('em');
            if (ne) ne.textContent = pmCents(pNo0);
          }
          var teams = acts.querySelectorAll('.gwx-bet.gwx-bet-team');
          teams.forEach(function (btn, i) {
            var rr = m.rows[i];
            if (!rr) return;
            btn.dataset.prob = rr.p;
            if (rr.tradeable && rr.tokenYes) {
              btn.setAttribute('data-token-yes', rr.tokenYes);
              btn.setAttribute('data-token-no', rr.tokenNo || '');
              if (rr.tickSize) btn.setAttribute('data-tick', rr.tickSize);
              btn.setAttribute('data-neg-risk', rr.negRisk ? '1' : '0');
            }
            var te = btn.querySelector('em');
            if (te) te.textContent = pmCents(rr.p);
          });
        }
        return;
      }
      var yn = el.querySelector('.gwx-yn');
      if (yn) {
        var r0 = m.rows[0];
        var pNo = rowNoPct(r0);
        if (r0.tradeable && r0.tokenYes) {
          yn.setAttribute('data-token-yes', r0.tokenYes);
          yn.setAttribute('data-token-no', r0.tokenNo || '');
          if (r0.tickSize) yn.setAttribute('data-tick', r0.tickSize);
          yn.setAttribute('data-neg-risk', r0.negRisk ? '1' : '0');
        }
        var yes = yn.querySelector('.gwx-bet.gwx-yes');
        var no = yn.querySelector('.gwx-bet.gwx-no');
        if (yes) {
          yes.dataset.prob = r0.p;
          var yb = yes.querySelector('b');
          if (yb) yb.textContent = r0.p + '%';
        }
        if (no) {
          no.dataset.prob = pNo;
          var nb = no.querySelector('b');
          if (nb) nb.textContent = pNo + '%';
        }
        var ring = el.querySelector('.gwx-ring');
        if (ring) {
          var rb = ring.querySelector('b');
          if (rb) rb.textContent = r0.p + '%';
          if (!window.GROM_SAFARI) ring.style.setProperty('--p', r0.p);
        }
        return;
      }
      m.rows.forEach(function (r, ri) {
        var oc = el.querySelectorAll('.gwx-oc')[ri];
        if (!oc) return;
        var probEl = oc.querySelector('.gwx-oc-prob');
        var fill = oc.querySelector('.gwx-oc-fill');
        var yes = oc.querySelector('.gwx-bet.gwx-yes');
        var no = oc.querySelector('.gwx-bet.gwx-no');
        var team = oc.querySelector('.gwx-bet.gwx-bet-team');
        if (probEl) {
          var pt = r.p + '%';
          if (probEl.textContent !== pt) probEl.textContent = pt;
        }
        if (fill && !window.GROM_SAFARI) fill.style.width = r.p + '%';
        if (r.tradeable && r.tokenYes) {
          oc.setAttribute('data-token-yes', r.tokenYes);
          oc.setAttribute('data-token-no', r.tokenNo || '');
          if (r.tickSize) oc.setAttribute('data-tick', r.tickSize);
          oc.setAttribute('data-neg-risk', r.negRisk ? '1' : '0');
        }
        if (yes) { yes.dataset.prob = r.p; yes.dataset.name = r.n; }
        if (no) no.dataset.prob = rowNoPct(r);
        if (team) team.dataset.prob = r.p;
      });
    });
  }
  function ensurePredictPoll() {
    if (_predictPollTimer) return;
    if (window.GROM_SAFARI || gwxMobile()) return;
    _predictPollTimer = setInterval(function () {
      var pp = document.getElementById('page-predict');
      if (!pp || !pp.classList.contains('active') || document.hidden || (gwxState.pQ || '').trim()) return;
      if (gwxMobile()) {
        patchPredictQuotes();
        updatePredictStats();
        return;
      }
      loadPredictLive(false, { append: false, soft: true });
    }, 90000);
  }
  function predictPageScrollY() {
    return window.scrollY || document.documentElement.scrollTop || 0;
  }
  function predictRestoreScroll(y) {
    if (!(y > 60)) return;
    if (window.__gwxUserScrolling && (Date.now() - window.__gwxUserScrolling) < 3000) return;
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { window.scrollTo(0, y); });
    });
  }
  if (!window.__gwxScrollTrack) {
    window.__gwxScrollTrack = true;
    var _gwxScrollIdle = null;
    window.addEventListener('scroll', function () {
      window.__gwxUserScrolling = Date.now();
      clearTimeout(_gwxScrollIdle);
      _gwxScrollIdle = setTimeout(function () { window.__gwxUserScrolling = 0; }, 400);
    }, { passive: true });
  }
  function predictGridHasCards() {
    var grid = document.getElementById('page-predict')?.querySelector('.gwx-grid');
    return !!(grid && !grid.hidden && grid.querySelector('.gwx-card'));
  }
  function predictDomHasCards() {
    var page = document.getElementById('page-predict');
    if (!page || !page.classList.contains('active')) return false;
    if (gwxState.pView === 'live') {
      var cal = document.getElementById('gwxPredictCal');
      return !!(cal && !cal.hidden && cal.querySelector('.gwx-cal-list'));
    }
    return predictGridHasCards();
  }
  function predictRefreshDom(opts) {
    opts = opts || {};
    updatePredictStats();
    updatePredictMoreBtn();
    if (window.GROM_STABLE_UI || window.GROM_SAFARI || gwxMobile()) {
      if (opts.fullRender || !predictDomHasCards()) applyPredictView();
      return;
    }
    if (opts.fullRender || !predictDomHasCards()) {
      applyPredictView();
      patchPredictQuotes();
      return;
    }
    if (gwxState.pView === 'live') patchPredictQuotes();
    else patchPredictQuotes();
  }
  function predictFilterCat(list, cat) {
    var c = cat || 'all';
    if (!c || c === 'all') return (list || []).slice();
    return (list || []).filter(function (m) { return m && m.cat === c; });
  }
  function applyPredictCatalog(cat) {
    if (!GWX_CATALOG || !GWX_CATALOG.length) return false;
    var c = cat || gwxState.pCat || 'all';
    GWX_LIVE = predictFilterCat(GWX_CATALOG, c);
    GWX_LIVE_SEARCH = null;
    var apiTotal = Number(gwxState.pTotal) || 0;
    gwxState.pTotal = Math.max(apiTotal, GWX_LIVE.length);
    if (apiTotal > GWX_LIVE.length) {
      gwxState.pHasMore = true;
    } else {
      gwxState.pHasMore = false;
      gwxState.pOffset = GWX_LIVE.length;
    }
    gwxState.pMode = 'browse';
    if (!gwxState.pShow || gwxState.pShow < GWX_MOBILE_BATCH) gwxState.pShow = GWX_MOBILE_BATCH;
    return true;
  }
  // Live Polymarket feed (browse or remote search); curated markets are offline fallback.
  // GWX_LIVE === null → not loaded yet; [] → loaded (maybe empty). Never treat [] as "use RU demo".
  function predictSource() {
    var q = (gwxState.pQ || '').trim();
    if (q && GWX_LIVE_SEARCH && GWX_LIVE_SEARCH.length) return GWX_LIVE_SEARCH.slice();
    if (q) {
      var pool = GWX_CATALOG && GWX_CATALOG.length ? GWX_CATALOG : (GWX_LIVE || []);
      if (pool.length) {
        var ql = q.toLowerCase();
        var local = pool.filter(function (m) {
          return (m.q || '').toLowerCase().indexOf(ql) >= 0
            || (m.slug || '').toLowerCase().indexOf(ql) >= 0;
        });
        if (local.length) return local;
      }
    }
    if (GWX_LIVE != null) return GWX_LIVE.slice();
    return GROM_PREDICT_MARKETS;
  }
  /** Dashboard / landing cards: live Polymarket only (demo catalog is RU-hardcoded). */
  function predictWidgetSource() {
    if (GWX_LIVE && GWX_LIVE.length) return GWX_LIVE.slice();
    if (GWX_CATALOG && GWX_CATALOG.length) return GWX_CATALOG.slice();
    return [];
  }
  function prefetchPredictCatalog(lang) {
    if (_predictCatalogFetch) return _predictCatalogFetch;
    var L = lang || 'en';
    var seen = Object.create(null);
    var acc = (GWX_CATALOG && GWX_CATALOG_LANG === L) ? GWX_CATALOG.slice() : [];
    acc.forEach(function (m) { seen[m.id || m.q] = 1; });
    var offset = acc.length;
    var pageLimit = 120;
    var maxPages = 25; // up to ~3000
    var pages = 0;
    function applyAcc() {
      if (!acc.length) return;
      GWX_CATALOG = acc.slice();
      GWX_CATALOG_LANG = L;
      if (!(gwxState.pQ || '').trim()) {
        applyPredictCatalog(gwxState.pCat || 'all');
        /* Prefetch must never rebuild the grid — only patch live quotes in memory. */
        if (document.getElementById('page-predict')?.classList.contains('active') && predictDomHasCards()) {
          if (!window.GROM_SAFARI && !gwxMobile()) patchPredictQuotes();
          updatePredictStats();
          updatePredictMoreBtn();
        }
      }
    }
    function pull() {
      if (pages >= maxPages) { _predictCatalogFetch = null; return; }
      pages++;
      var url = '/api/market/predict?limit=' + pageLimit + '&offset=' + offset
        + '&lang=' + encodeURIComponent(L) + '&cat=all&_=' + Date.now();
      _predictCatalogFetch = fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) {
          if (!d || !Array.isArray(d.markets) || !d.markets.length) { _predictCatalogFetch = null; return; }
          d.markets.forEach(function (m) {
            var k = m.id || m.q;
            if (seen[k]) return;
            seen[k] = 1;
            acc.push(m);
          });
          offset = Number(d.offset || 0) + d.markets.length;
          if (d.total && offset < d.total) offset = Math.max(offset, acc.length);
          applyAcc();
          if (d.hasMore && pages < maxPages) {
            // Yield to UI between pages — avoids 10–20s main-thread freeze
            setTimeout(pull, 80);
          } else {
            _predictCatalogFetch = null;
          }
        })
        .catch(function () { _predictCatalogFetch = null; });
      return _predictCatalogFetch;
    }
    return pull();
  }
  function updatePredictMoreBtn() {
    var wrap = document.getElementById('gwxPredictMoreWrap');
    var btn = document.getElementById('gwxPredictLoadMore');
    if (!wrap || !btn) return;
    var page = document.getElementById('page-predict');
    var liveCal = page && page.classList.contains('gwx-live-view');
    var list = predictSource();
    var showN = gwxState.pShow || GWX_MOBILE_BATCH;
    var localMore = list.length > showN;
    var show = !liveCal && list.length > 0 && (localMore || !!gwxState.pHasMore);
    wrap.hidden = !show;
    if (show) {
      var shown = Math.min(showN, list.length);
      var total = Math.max(Number(gwxState.pTotal) || 0, list.length);
      var left = Math.max(0, (list.length - shown) + (gwxState.pHasMore ? Math.max(0, total - list.length) : 0));
      btn.textContent = tx('px_load_more', 'Load more')
        + (left > 0 ? (' (+' + left + ')') : '')
        + (total ? (' · ' + shown + '/' + total) : '');
      btn.disabled = !!_predictFetch;
    }
  }
  function applyPredictView() {
    var page = document.getElementById('page-predict');
    if (!page) return;
    var live = gwxState.pView === 'live';
    page.classList.toggle('gwx-live-view', live);
    page.querySelectorAll('.gwx-view-tab[data-pview]').forEach(function (tab) {
      tab.classList.toggle('on', tab.dataset.pview === gwxState.pView);
    });
    if (live) renderPredictCalendar();
    else renderPredictGridContent();
  }
  function predictWhen(m) { return m.starts || m.ends || ''; }
  function predictEndMs(m) {
    if (!m || !m.endsAt) return NaN;
    return new Date(m.endsAt).getTime();
  }
  function predictIsLive(m) {
    if (!m || m.live === false) return false;
    var end = predictEndMs(m);
    if (Number.isFinite(end) && end < Date.now() - 3 * 3600_000) return false;
    return true;
  }
  function predictIsFresh(m) {
    if (!m) return false;
    var end = predictEndMs(m);
    if (Number.isFinite(end) && end < Date.now() - 3 * 3600_000) return false;
    return true;
  }
  function localDayIso(d) {
    var y = d.getFullYear(), mo = d.getMonth() + 1, da = d.getDate();
    return y + '-' + (mo < 10 ? '0' : '') + mo + '-' + (da < 10 ? '0' : '') + da;
  }
  function eventAnchorMs(m) {
    if (m.startsAt) return new Date(m.startsAt).getTime();
    if (m.endsAt) return new Date(m.endsAt).getTime();
    return NaN;
  }
  function liveCalendarSource() {
    var src = predictSource().filter(function (m) { return predictIsLive(m); });
    if (!src.length && GWX_LIVE && GWX_LIVE.length) src = GWX_LIVE.slice();
    return src.sort(function (a, b) {
      var ta = eventAnchorMs(a);
      var tb = eventAnchorMs(b);
      if (!Number.isFinite(ta)) ta = Infinity;
      if (!Number.isFinite(tb)) tb = Infinity;
      if (ta !== tb) return ta - tb;
      return (b.vol24 || b.vol || 0) - (a.vol24 || a.vol || 0);
    });
  }
  function calDayKey(m) {
    var iso = m.startsAt || m.endsAt;
    if (!iso) return 'later';
    var d = new Date(iso);
    if (Number.isNaN(d.getTime())) return 'later';
    var now = new Date();
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    var day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    if (day.getTime() === today.getTime()) return 'today';
    if (day.getTime() === tomorrow.getTime()) return 'tomorrow';
    return localDayIso(day);
  }
  function calDayLabel(key) {
    if (key === 'today') return tx('px_cal_today', 'Today');
    if (key === 'tomorrow') return tx('px_cal_tomorrow', 'Tomorrow');
    if (key === 'later') return tx('px_cal_later', 'Later');
    try {
      var d = new Date(key + 'T12:00:00');
      return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
    } catch (_) { return key; }
  }
  function pmCents(p) {
    var n = Math.max(1, Math.min(99, Math.round(Number(p) || 50)));
    return n + '¢';
  }
  /** Short outcome label for calendar buttons — avoid "Draw (Team A vs…)" truncation mess. */
  function calOutcomeLabel(n) {
    var s = String(n || '').trim();
    if (!s) return '—';
    if (/^draw\b/i.test(s) || /^ничья\b/i.test(s)) return tx('px_draw', 'Draw');
    if (/^o\/?u\b/i.test(s) || /^total\b/i.test(s)) {
      var ou = s.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
      return ou.length > 18 ? ou.slice(0, 16) + '…' : ou;
    }
    s = s.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
    if (s.length > 22) s = s.slice(0, 20) + '…';
    return s;
  }
  function predictCalRowHtml(m) {
    var rows = (m.rows || []).slice(0, 3);
    var top = rows[0] || { n: 'Yes', p: 50, pNo: 50 };
    var binary = predictIsBinaryYesNo(m);
    var qAttr = escA(m.q);
    var img = m.img
      ? '<img class="gwx-cal-img" src="' + escA(m.img) + '" alt="" loading="lazy" decoding="async" onerror="this.style.display=\'none\'">'
      : '<span class="gwx-cal-ico">' + pcatIco(m.cat, 18) + '</span>';
    var actions;
    if (binary) {
      var pNo = rowNoPct(top);
      var ta0 = pmRowTradeAttrs(top);
      actions = '<div class="gwx-cal-actions"' + ta0 + '>'
        + '<button type="button" class="gwx-bet gwx-yes" data-side="yes" data-name="Yes" data-prob="' + top.p + '">'
        + '<span>' + tx('px_yes', 'Yes') + '</span><em>' + pmCents(top.p) + '</em></button>'
        + '<button type="button" class="gwx-bet gwx-no" data-side="no" data-name="No" data-prob="' + pNo + '">'
        + '<span>' + tx('px_no', 'No') + '</span><em>' + pmCents(pNo) + '</em></button>'
        + '</div>';
    } else {
      actions = '<div class="gwx-cal-actions">' + rows.map(function (r) {
        var label = calOutcomeLabel(r.n);
        return '<button type="button" class="gwx-bet gwx-bet-team" data-side="yes" data-name="' + escA(r.n) + '" data-prob="' + r.p + '"' + pmRowTradeAttrs(r) + '>'
          + '<span title="' + escA(r.n) + '">' + esc(label) + '</span><em>' + pmCents(r.p) + '</em></button>';
      }).join('') + '</div>';
    }
    return '<div class="gwx-cal-row" data-pm-id="' + escA(m.id || m.q) + '" data-pm-slug="' + escA(m.slug || '') + '" data-q="' + qAttr + '">'
      + '<div class="gwx-cal-main">'
      + '<div class="gwx-cal-top">'
      + '<span class="gwx-cal-crumb">' + liveBadgeHtml(m) + '<span>' + pcatIco(m.cat, 12) + ' ' + esc(pcatLabel(m.cat)) + '</span></span>'
      + '</div>'
      + '<div class="gwx-cal-body">' + img
      + '<div class="gwx-cal-qwrap"><div class="gwx-cal-q">' + esc(m.q) + '</div>'
      + '<div class="gwx-cal-meta">'
      + '<span><b>' + top.p + '%</b> ' + esc(tx('px_chance', 'chance')) + '</span>'
      + (m.time || predictWhen(m) ? '<span class="gwx-cal-time">' + esc(m.time || '') + (predictWhen(m) ? ' · ' + esc(predictWhen(m)) : '') + '</span>' : '')
      + '</div></div></div></div>'
      + actions + '</div>';
  }
  function predictCalSectionHtml(cat, items) {
    var body = items.map(predictCalRowHtml).join('');
    return '<section class="gwx-cal-sec" data-cat="' + escA(cat) + '">'
      + '<div class="gwx-cal-sec-h"><b>' + pcatIco(cat, 14) + ' ' + esc(pcatLabel(cat === 'all' ? 'all' : cat)) + '</b>'
      + '<span>' + items.length + '</span></div>'
      + '<div class="gwx-cal-sec-body">' + body + '</div></section>';
  }
  function renderPredictCalendar() {
    var page = document.getElementById('page-predict');
    var cal = document.getElementById('gwxPredictCal');
    var grid = page && page.querySelector('.gwx-grid');
    if (!cal || !page) return;
    page.classList.add('gwx-live-view');
    if (grid) grid.hidden = true;
    cal.hidden = false;
    var q = gwxState.pQ.trim().toLowerCase();
    var remote = !!(q && GWX_LIVE_SEARCH && GWX_LIVE_SEARCH.length);
    var list = liveCalendarSource().filter(function (m) {
      return (gwxState.pCat === 'all' || m.cat === gwxState.pCat)
        && (remote || !q || (m.q || '').toLowerCase().indexOf(q) >= 0 || (m.slug || '').toLowerCase().indexOf(q) >= 0);
    });
    // Prefer higher volume within the day (Polymarket-like ranking)
    list = list.slice().sort(function (a, b) { return (b.vol24 || b.vol || 0) - (a.vol24 || a.vol || 0); });
    var buckets = Object.create(null);
    list.forEach(function (m) {
      var k = calDayKey(m);
      if (!buckets[k]) buckets[k] = [];
      buckets[k].push(m);
    });
    var order = Object.keys(buckets).sort(function (a, b) {
      var rank = { today: 0, tomorrow: 1, later: 9999 };
      var ra = rank[a] != null ? rank[a] : 2;
      var rb = rank[b] != null ? rank[b] : 2;
      if (ra !== rb) return ra - rb;
      if (a === 'later') return 1;
      if (b === 'later') return -1;
      return a.localeCompare(b);
    });
    if (!order.length) {
      gwxState.pDay = 'today';
      cal.innerHTML = '<div class="gwx-cal-head"><h3><span class="gwx-live-dot" style="width:8px;height:8px;border-radius:50%;background:#22c55e;display:inline-block"></span> ' + tx('px_view_live', 'Live calendar') + '</h3><span class="gwx-cal-src">' + tx('px_live', 'LIVE') + '</span></div>'
        + '<div class="gwx-none" style="border:0;border-radius:0;margin:0">' + tx('px_cal_empty', 'Loading live events…') + '</div>';
      return;
    }
    if (!order.includes(gwxState.pDay)) gwxState.pDay = order[0];
    var dayBtns = order.map(function (k) {
      return '<button type="button" class="gwx-cal-day' + (k === gwxState.pDay ? ' on' : '') + '" data-day="' + k + '">' + calDayLabel(k) + ' · ' + buckets[k].length + '</button>';
    }).join('');
    var dayList = buckets[gwxState.pDay] || [];
    if (!gwxState.pCalShow || gwxState.pCalShow < 24) gwxState.pCalShow = 24;
    var showN = Math.min(dayList.length, gwxState.pCalShow);
    var visible = dayList.slice(0, showN);
    // Group by category like Polymarket league sections
    var catOrder = ['sport', 'esports', 'crypto', 'politics', 'finance', 'economy', 'culture', 'all'];
    var byCat = Object.create(null);
    visible.forEach(function (m) {
      var c = m.cat || 'all';
      if (!byCat[c]) byCat[c] = [];
      byCat[c].push(m);
    });
    var secHtml = catOrder.filter(function (c) { return byCat[c] && byCat[c].length; })
      .concat(Object.keys(byCat).filter(function (c) { return catOrder.indexOf(c) < 0; }))
      .map(function (c) { return predictCalSectionHtml(c, byCat[c]); }).join('');
    if (!secHtml) secHtml = '<div class="gwx-none" style="border:0;border-radius:0;margin:0">' + tx('px_none', 'Nothing found') + '</div>';
    if (dayList.length > showN) {
      secHtml += '<button type="button" class="gwx-cal-more" id="gwxCalLoadMore">' + tx('px_load_more', 'Show more')
        + ' (+' + (dayList.length - showN) + ')</button>';
    }
    cal.innerHTML = '<div class="gwx-cal-head"><h3><span class="gwx-live-dot" style="width:8px;height:8px;border-radius:50%;background:#22c55e;display:inline-block;box-shadow:0 0 8px rgba(34,197,94,.6)"></span> '
      + tx('px_view_live', 'Live calendar') + '</h3><span class="gwx-cal-src">' + list.length + ' ' + tx('px_markets_n', 'Markets') + '</span></div>'
      + '<div class="gwx-cal-days">' + dayBtns + '</div>'
      + '<div class="gwx-cal-list">' + secHtml + '</div>';
    if (typeof window.gromHydrateLogos === 'function') window.gromHydrateLogos(cal);
  }
  function renderPredictGridContent(opts) {
    opts = opts || {};
    var gridCards = 0;
    try {
      gridCards = document.querySelectorAll('#page-predict .gwx-grid .gwx-card[data-pm-id]').length;
    } catch (_) {}
    var srcLen = predictSource().length;
    var needExpand = srcLen > gridCards;
    if (!opts.force && predictGridHasCards() && !needExpand) {
      if (!window.GROM_SAFARI && !gwxMobile()) patchPredictQuotes();
      updatePredictMoreBtn();
      return;
    }
    if ((window.GROM_SAFARI || gwxMobile()) && predictGridHasCards() && !needExpand && !opts.force) {
      updatePredictMoreBtn();
      return;
    }
    var scrollY = predictPageScrollY();
    var page = document.getElementById('page-predict');
    var cal = document.getElementById('gwxPredictCal');
    var grid = page && page.querySelector('.gwx-grid');
    if (!grid) return;
    if (page) page.classList.remove('gwx-live-view');
    if (cal) cal.hidden = true;
    grid.hidden = false;
    var q = gwxState.pQ.trim().toLowerCase();
    var list = predictSource().filter(function (m) {
      if (!predictIsFresh(m)) return false;
      return (gwxState.pCat === 'all' || m.cat === gwxState.pCat)
        && (!q || (m.q || '').toLowerCase().indexOf(q) >= 0 || (m.slug || '').toLowerCase().indexOf(q) >= 0
          || (GWX_LIVE_SEARCH && GWX_LIVE_SEARCH.length)); // remote search already filtered
    });
    // Windowed render keeps mobile smooth; server Load more fills GWX_LIVE.
    if (!gwxState.pShow || gwxState.pShow < GWX_MOBILE_BATCH) gwxState.pShow = GWX_MOBILE_BATCH;
    var showN = list.length > gwxState.pShow ? gwxState.pShow : list.length;
    var visible = list.slice(0, showN);
    var html = visible.length ? visible.map(predictCardHtml).join('') : '<div class="gwx-none">'
      + (q ? tx('px_none_search', 'No markets for this search') : tx('px_none', 'Nothing found'))
      + '</div>';
    /* Single load-more lives in #gwxPredictMoreWrap — do not inject a second button into the grid. */
    grid.innerHTML = html;
    if (typeof window.gromHydrateLogos === 'function') window.gromHydrateLogos(grid);
    updatePredictMoreBtn();
    predictRestoreScroll(scrollY);
  }
  function renderPredictGrid() { applyPredictView(); }
  function updatePredictStats() {
    var page = document.getElementById('page-predict'); if (!page) return;
    var src = predictSource();
    var stats = page.querySelectorAll('.gwx-stats > div');
    if (stats.length >= 3) {
      var cb = stats[2].querySelector('b');
      if (cb) {
        var total = Math.max(Number(gwxState.pTotal) || 0, src.length);
        cb.textContent = String(total || src.length || 0);
      }
    }
    if (stats.length >= 2) {
      var vb = stats[1].querySelector('b');
      if (vb && src.length) {
        var vol = 0;
        for (var i = 0; i < src.length; i++) vol += Number(src[i].vol || src[i].vol24 || 0) || 0;
        if (vol > 0 && typeof fmtVol === 'function') vb.textContent = fmtVol(vol);
      }
    }
  }
  var _predictReqSeq = 0;
  function loadPredictLive(force, opts) {
    opts = opts || {};
    if (_predictFetch && !force && !opts.append && opts.q == null) return _predictFetch;
    var q = (opts.q != null ? opts.q : gwxState.pQ || '').trim();
    var append = !!opts.append;
    var isSearch = !!q;
    var limit = GWX_PREDICT_PAGE;
    var lang = (typeof window.getGromLang === 'function' ? window.getGromLang() : (localStorage.getItem('grom_lang') || 'en')) || 'en';
    var cat = gwxState.pCat || 'all';

    // Instant path: catalog in memory — patch quotes only (never full grid rebuild on poll).
    if (!isSearch && !append && !force && GWX_CATALOG && GWX_CATALOG.length && GWX_CATALOG_LANG === lang) {
      applyPredictCatalog(cat);
      predictRefreshDom({ soft: !!opts.soft });
      return Promise.resolve();
    }

    var url = '/api/market/predict?limit=' + limit + '&lang=' + encodeURIComponent(lang)
      + '&cat=' + encodeURIComponent(cat) + '&_=' + Date.now();
    if (isSearch) {
      url += '&q=' + encodeURIComponent(q) + '&page=' + (append ? ((gwxState.pPage || 1) + 1) : 1);
    } else {
      var off = append ? (GWX_LIVE ? GWX_LIVE.length : 0) : 0;
      url += '&offset=' + off;
    }
    var reqId = ++_predictReqSeq;
    _predictFetch = fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (reqId !== _predictReqSeq) return; // stale response (typing / race)
        if (!d || !Array.isArray(d.markets)) return;
        gwxState.pMode = d.mode || (isSearch ? 'search' : 'browse');
        gwxState.pHasMore = !!d.hasMore;
        gwxState.pTotal = Number(d.total) || d.markets.length;
        gwxState.pPage = Number(d.page) || 1;
        if (isSearch) {
          if (append && GWX_LIVE_SEARCH && GWX_LIVE_SEARCH.length) {
            var seen = Object.create(null);
            GWX_LIVE_SEARCH.forEach(function (m) { seen[m.id || m.q] = 1; });
            d.markets.forEach(function (m) {
              var k = m.id || m.q;
              if (!seen[k]) { GWX_LIVE_SEARCH.push(m); seen[k] = 1; }
            });
          } else {
            GWX_LIVE_SEARCH = d.markets.slice();
          }
          gwxState.pShow = Math.max(GWX_MOBILE_BATCH, GWX_LIVE_SEARCH.length);
        } else {
          GWX_LIVE_SEARCH = null;
          if (append && GWX_LIVE && GWX_LIVE.length) {
            var seenB = Object.create(null);
            GWX_LIVE.forEach(function (m) { seenB[m.id || m.q] = 1; });
            d.markets.forEach(function (m) {
              var k = m.id || m.q;
              if (!seenB[k]) { GWX_LIVE.push(m); seenB[k] = 1; }
            });
          } else {
            GWX_LIVE = d.markets.slice();
          }
          gwxState.pOffset = GWX_LIVE.length;
          if (gwxState.pView !== 'live') gwxState.pView = 'all';
          gwxState.pShow = Math.max(gwxState.pShow || GWX_MOBILE_BATCH, Math.min(GWX_LIVE.length, GWX_MOBILE_BATCH * 2));
          if (!append && !opts.soft && !gwxMobile() && document.getElementById('page-predict')?.classList.contains('active')) {
            prefetchPredictCatalog(lang);
          }
        }
        var canPatch = !append && !isSearch && predictGridHasCards();
        if (window.GROM_STABLE_UI || window.GROM_SAFARI || gwxMobile()) {
          var rendered = 0;
          try {
            rendered = document.querySelectorAll('#page-predict .gwx-grid .gwx-card[data-pm-id]').length;
          } catch (_) {}
          var liveLen = (GWX_LIVE && GWX_LIVE.length) || 0;
          if (!canPatch || liveLen > rendered || opts.force) {
            var scrollY = predictPageScrollY();
            applyPredictView();
            predictRestoreScroll(scrollY);
          }
          updatePredictStats();
          updatePredictMoreBtn();
        } else if (canPatch || opts.soft) {
          patchPredictQuotes();
          updatePredictStats();
          updatePredictMoreBtn();
        } else {
          var scrollY = predictPageScrollY();
          applyPredictView();
          patchPredictQuotes();
          updatePredictStats();
          updatePredictMoreBtn();
          predictRestoreScroll(scrollY);
        }
        if (!opts.soft) renderPredictWidgets();
        try {
          var countEl = document.querySelector('#page-predict .gwx-stats > div:nth-child(3) b');
          if (countEl) countEl.textContent = String(gwxState.pTotal || predictSource().length);
        } catch (_) {}
      })
      .catch(function () {
        patchPredictQuotes();
        if (!opts.soft && gwxState.pView === 'live') applyPredictView();
        updatePredictMoreBtn();
      })
      .finally(function () { _predictFetch = null; updatePredictMoreBtn(); });
    return _predictFetch;
  }
  window.gromLoadPredictLive = loadPredictLive;
  window.gromEnsurePredictPoll = ensurePredictPoll;
  function featuredMarkets(n) {
    var src = predictWidgetSource().slice().sort(function (a, b) { return (b.vol || 0) - (a.vol || 0); });
    var out = [], seen = {};
    src.forEach(function (m) {
      if (out.length >= n) return;
      if (seen[m.cat]) return;
      seen[m.cat] = 1; out.push(m);
    });
    src.forEach(function (m) {
      if (out.length >= n) return;
      if (out.indexOf(m) >= 0) return;
      out.push(m);
    });
    return out.slice(0, n);
  }
  function previewYesPct(m) {
    var r = (m && m.rows && m.rows[0]) || { p: 50 };
    return Math.max(1, Math.min(99, Math.round(Number(r.p) || 50)));
  }
  function previewNoPct(m, yesPct) {
    var r = (m && m.rows && m.rows[0]) || {};
    if (r.pNo != null && isFinite(Number(r.pNo))) {
      return Math.max(1, Math.min(99, Math.round(Number(r.pNo))));
    }
    return Math.max(1, Math.min(99, 100 - yesPct));
  }
  function previewYnHtml(yesPct, noPct) {
    var y = yesPct;
    var n = noPct != null ? noPct : (100 - y);
    return '<div class="grom-pv-yn">'
      + '<span class="grom-pv-yes">' + tx('px_yes', 'Yes') + ' <b>' + y + '%</b></span>'
      + '<span class="grom-pv-no">' + tx('px_no', 'No') + ' <b>' + n + '%</b></span>'
      + '</div>';
  }
  function dashPreviewHtml(m) {
    var y = previewYesPct(m);
    var n = previewNoPct(m, y);
    return '<button type="button" class="grom-pv-item" onclick="show(\'predict\')">'
      + '<div class="grom-pv-item-top"><span class="grom-pv-cat">' + pcatIco(m.cat, 12) + ' ' + esc(pcatLabel(m.cat)) + '</span>' + liveBadgeHtml(m, 'grom-pv-live-sm') + '</div>'
      + '<div class="grom-pv-head"><div class="grom-pv-q">' + esc(m.q) + '</div>'
      + '<div class="grom-pv-chance"><div class="grom-pv-ring" style="--p:' + y + '"><b>' + y + '%</b></div>'
      + '<div class="grom-pv-ring-lbl">' + esc(tx('px_chance', 'chance')) + '</div></div></div>'
      + previewYnHtml(y, n)
      + '</button>';
  }
  function lpPreviewHtml(m) {
    var y = previewYesPct(m);
    var n = previewNoPct(m, y);
    return '<div class="lp-predict-card" onclick="show(\'predict\')" role="button" tabindex="0">'
      + '<div class="lp-pc-top"><span class="lp-pc-cat">' + pcatIco(m.cat, 12) + ' ' + esc(pcatLabel(m.cat)) + '</span>' + liveBadgeHtml(m, 'lp-pc-live') + '</div>'
      + '<div class="grom-pv-head"><div class="grom-pv-q">' + esc(m.q) + '</div>'
      + '<div class="grom-pv-chance"><div class="grom-pv-ring" style="--p:' + y + '"><b>' + y + '%</b></div>'
      + '<div class="grom-pv-ring-lbl">' + esc(tx('px_chance', 'chance')) + '</div></div></div>'
      + previewYnHtml(y, n)
      + '</div>';
  }
  function renderPredictWidgets(opts) {
    opts = opts || {};
    injectCss();
    var loading = '<div class="grom-pv-item" style="opacity:.65;cursor:default">'
      + '<div class="grom-pv-q">' + esc(tx('px_loading', 'Loading markets…')) + '</div></div>';
    var dash = document.getElementById('dashPredictSpot');
    if (dash) {
      var hasLive = !!(GWX_LIVE && GWX_LIVE.length);
      var freezeDash = (window.GROM_SAFARI || gwxMobile()) && dash.dataset.gwxPvLive === '1';
      if (opts.soft && freezeDash && dash.querySelector('.grom-pv-item')) return;
      var d = featuredMarkets(3);
      dash.innerHTML = d.length ? d.map(dashPreviewHtml).join('') : loading;
      if (hasLive && d.length) dash.dataset.gwxPvLive = '1';
      else delete dash.dataset.gwxPvLive;
    }
    var lp = document.getElementById('lpPredictGrid');
    if (lp) {
      var l = featuredMarkets(4);
      lp.innerHTML = l.length ? l.map(lpPreviewHtml).join('') : loading;
    }
    if (typeof window.gromHydrateLogos === 'function') {
      if (dash) window.gromHydrateLogos(dash);
      if (lp) window.gromHydrateLogos(lp);
    }
  }
  window.gromRenderPredictWidgets = renderPredictWidgets;
  function xstocksDomHasRows() {
    var host = document.querySelector('#page-xstocks .gwx-rows');
    return !!(host && host.querySelector('.gwx-row[data-sym]'));
  }
  function renderXstocksRows() {
    var host = document.querySelector('#page-xstocks .gwx-rows'); if (!host) return;
    var q = gwxState.sQ.trim().toLowerCase();
    var list = GROM_XSTOCKS.filter(function (s) {
      var catOk = gwxState.sCat === 'all' || s.cat === gwxState.sCat;
      // Uncategorized tokens only appear under "Все"
      if (gwxState.sCat !== 'all' && !s.cat) return false;
      return catOk && (!q || s.sym.toLowerCase().indexOf(q) >= 0 || s.name.toLowerCase().indexOf(q) >= 0 || String(s.tokenSym || '').toLowerCase().indexOf(q) >= 0);
    });
    list.sort(function (a, b) {
      var ap = (curPx(a.sym) || a.price || 0) > 0 ? 0 : 1;
      var bp = (curPx(b.sym) || b.price || 0) > 0 ? 0 : 1;
      if (ap !== bp) return ap - bp;
      return String(a.tokenSym || a.sym).localeCompare(String(b.tokenSym || b.sym));
    });
    // Windowed list (desktop + mobile) — full 600+ row DOM stutters Stocks.
    // Search / non-all category: show full filtered set (usually small).
    if (q || gwxState.sCat !== 'all') {
      gwxState.sShow = list.length;
    } else if (!gwxState.sShow || gwxState.sShow < GWX_STOCKS_BATCH) {
      gwxState.sShow = GWX_STOCKS_BATCH;
    }
    var showN = list.length > gwxState.sShow ? gwxState.sShow : list.length;
    var visible = list.slice(0, showN);
    var html = visible.length ? visible.map(stockRowHtml).join('') : '<div class="gwx-none" style="border:0">' + tx('px_none_stocks', 'Nothing found') + '</div>';
    if (list.length > showN) {
      html += '<button type="button" class="gwx-load-more" id="gwxStockLoadMore">'
        + tx('px_load_more', 'Show more')
        + ' (+' + (list.length - showN) + ')</button>';
    }
    host.innerHTML = html;
    if (typeof gromHydrateLogos === 'function') gromHydrateLogos(host);
    var countEl = document.getElementById('gwxTickerCount');
    if (countEl) countEl.textContent = String(GROM_XSTOCKS.length);
  }

  function gwxCurrentLang() {
    try {
      if (typeof window.getGromLang === 'function') return window.getGromLang();
    } catch (_) {}
    try { return localStorage.getItem('grom_lang') || 'en'; } catch (_) { return 'en'; }
  }
  // Create real <section class="page"> shells so the app's own show() router
  // renders them on click AND on direct #predict / #xstocks URLs.
  function ensurePredictPage() {
    var anchor = document.getElementById('page-markets') || document.querySelector('main .page');
    if (!anchor || !anchor.parentNode) return;
    var sec = document.getElementById('page-predict');
    var lang = gwxCurrentLang();
    var langOk = sec && sec.dataset.gwxLang === lang;
    if (sec && sec.dataset.gwxReady === '12' && !sec.dataset.gwxForce && langOk) {
      predictRefreshDom({ soft: true });
      return;
    }
    if (!sec) {
      sec = document.createElement('section'); sec.className = 'page'; sec.id = 'page-predict';
      anchor.parentNode.appendChild(sec);
    }
    sec.innerHTML = buildPredict();
    sec.dataset.gwxReady = '12';
    sec.dataset.gwxLang = lang;
    delete sec.dataset.gwxForce;
    applyPredictView();
  }
  function ensureXstocksPage() {
    var anchor = document.getElementById('page-markets') || document.querySelector('main .page');
    if (!anchor || !anchor.parentNode) return;
    var sec = document.getElementById('page-xstocks');
    var lang = gwxCurrentLang();
    var langOk = sec && sec.dataset.gwxLang === lang;
    if (sec && sec.dataset.gwxReady === '12' && !sec.dataset.gwxForce && langOk) {
      if (xstocksDomHasRows()) refreshStockPrices();
      else renderXstocksRows();
      return;
    }
    if (!sec) {
      sec = document.createElement('section'); sec.className = 'page'; sec.id = 'page-xstocks';
      anchor.parentNode.appendChild(sec);
    }
    sec.innerHTML = buildXstocks();
    sec.dataset.gwxReady = '12';
    sec.dataset.gwxLang = lang;
    delete sec.dataset.gwxForce;
    renderXstocksRows();
    try {
      gwxLoadCatalog(false).then(function () {
        refreshUsdtBalChip();
        gwxLoadPositions();
        gwxFocusFromHash();
      });
    } catch (_) {}
  }
  function ensurePages(which) {
    if (!which || which === 'predict') ensurePredictPage();
    if (!which || which === 'xstocks') ensureXstocksPage();
  }

  function gwxFocusFromHash() {
    var sym = '';
    try { sym = sessionStorage.getItem('gwx_focus_sym') || ''; } catch (_) {}
    if (!sym) {
      try {
        var h = String(location.hash || '');
        var m = h.match(/[?&]sym=([A-Za-z0-9.]+)/);
        if (m) sym = m[1].toUpperCase();
      } catch (_) {}
    }
    if (!sym) return;
    try { sessionStorage.removeItem('gwx_focus_sym'); } catch (_) {}
    gwxState.sQ = sym;
    var page = document.getElementById('page-xstocks');
    var inp = page && page.querySelector('.gwx-search input');
    if (inp) inp.value = sym;
    renderXstocksRows();
    setTimeout(function () {
      var row = document.querySelector('#page-xstocks .gwx-row[data-sym="' + sym + '"]');
      if (row) {
        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
        row.classList.add('gxp-flash');
        setTimeout(function () { row.classList.remove('gxp-flash'); }, 1200);
      }
      scrollToGwxSection('gromStockPos');
    }, 120);
  }

  /* ---- positions (on-chain bToken / xStock balances) ---- */
  function renderStockPos() {
    var page = document.getElementById('page-xstocks'); if (!page) return;
    var list = page.querySelector('#gromStockPos .gxp-list'); if (!list) return;
    if (!gwxConnected()) {
      list.innerHTML = '<div class="gxp-empty">' + tx('px_connect_for_pos', 'Connect wallet to see positions') + '</div>';
      return;
    }
    var arr = gwxPositions || [];
    if (!arr.length) { list.innerHTML = '<div class="gxp-empty">' + tx('px_empty_stocks', 'No stock positions yet') + '</div>'; return; }
    list.innerHTML = arr.map(function (p, i) {
      var cur = curPx(p.sym) || p.px || 0;
      var val = p.qty * cur;
      var chainLbl = (window.GWX_ID_TO_LABEL && window.GWX_ID_TO_LABEL[p.chainId]) || ('chain ' + p.chainId);
      return '<div class="gxp-row" data-sym="' + p.sym + '"><div><b>' + esc(p.tokenSym || p.sym) + '<span class="gxp-side b">LONG</span></b>'
        + '<small>' + p.qty.toFixed(4) + ' · ' + esc(chainLbl) + ' · ' + tx('px_now', 'now') + ' $' + cur.toFixed(2) + '</small></div>'
        + '<div class="gxp-pnl up">' + money(val) + '</div>'
        + '<button type="button" class="gxp-close" data-k="stock" data-i="' + i + '" data-sym="' + p.sym + '">' + tx('px_sell', 'Sell') + '</button></div>';
    }).join('');
  }
  var _pmLiveCached = null;
  function clearDemoPredictBets() {
    try {
      localStorage.removeItem('grom_predict_pos');
    } catch (_) {}
  }
  async function pmIsLive() {
    if (_pmLiveCached != null) return _pmLiveCached;
    try {
      if (window.gromPredict && typeof window.gromPredict.fetchConfig === 'function') {
        _pmLiveCached = !!(await window.gromPredict.fetchConfig()).enabled;
      } else {
        var r = await fetch('/api/market/predict/config', { cache: 'no-store' });
        _pmLiveCached = !!(await r.json()).enabled;
      }
    } catch (_) { _pmLiveCached = false; }
    if (_pmLiveCached) clearDemoPredictBets();
    return _pmLiveCached;
  }
  function refreshPredictHeroMode(_live) {
    var el = document.querySelector('#page-predict .gwx-bal');
    if (!el) return;
    var apply = function (txt, sub) {
      var b = el.querySelector('.gwx-bal-v');
      var s = el.querySelector('small');
      if (b) b.textContent = txt;
      if (s) s.textContent = sub;
      if (!b) {
        el.innerHTML = '<b class="gwx-bal-v">' + txt + '</b><small>' + esc(sub) + '</small>';
      }
    };
    if (!window.gromPredict || typeof window.gromPredict.getStatus !== 'function') {
      apply(money(0), tx('px_poly_bal', 'Polygon USDC'));
      return;
    }
    window.gromPredict.getStatus().then(function (st) {
      if (!el.isConnected) return;
      if (!st || !st.connected) {
        apply(money(0), tx('px_connect_wallet', 'Connect wallet'));
        return;
      }
      var n = Number(st.polyBal || 0);
      apply(money(n), tx('px_poly_bal', 'Polygon USDC'));
    }).catch(function () {
      if (el.isConnected) apply(money(0), tx('px_poly_bal', 'Polygon USDC'));
    });
  }
  function renderPredictPosDemo() {
    var page = document.getElementById('page-predict'); if (!page) return;
    var list = page.querySelector('#gromPredictPos .gxp-list'); if (!list) return;
    var arr = loadPos('grom_predict_pos');
    if (!arr.length) {
      list.innerHTML = '<div class="gxp-empty">' + tx('px_empty_bets', 'No bets yet') + '</div>';
      return;
    }
    list.innerHTML = arr.map(function (p, i) {
      return '<div class="gxp-row"><div><b>' + p.label + '</b>'
        + '<small>' + money(p.stake) + ' @ ' + Math.round(p.price * 100) + '¢ · demo · ' + (p.q || '') + '</small></div>'
        + '<div class="gxp-pnl up">→ ' + money(p.shares) + '</div>'
        + '<button type="button" class="gxp-close" data-k="predict" data-i="' + i + '">' + tx('px_sell_bet', 'Sell') + '</button></div>';
    }).join('');
  }
  function renderPredictPosEmptyLive() {
    var page = document.getElementById('page-predict'); if (!page) return;
    var list = page.querySelector('#gromPredictPos .gxp-list'); if (!list) return;
    list.innerHTML = '<div class="gxp-empty">' + tx('px_empty_bets_live', 'No open positions yet. Place a live bet above.') + '</div>';
  }
  async function renderPredictPosLive() {
    var page = document.getElementById('page-predict'); if (!page) return;
    var list = page.querySelector('#gromPredictPos .gxp-list'); if (!list) return;
    clearDemoPredictBets();
    if (!window.gromPredict || typeof window.gromPredict.listPositions !== 'function') {
      if (!list.querySelector('.gxp-empty')) renderPredictPosEmptyLive();
      return;
    }
    var pos = await window.gromPredict.listPositions();
    var sig = pos.length ? pos.slice(0, 40).map(function (p) {
      return (p.title || p.market || p.slug || '') + '|' + (p.outcome || '') + '|' + Number(p.size || p.amount || 0).toFixed(2);
    }).join(';') : 'empty';
    if (list.dataset.gxpSig === sig) return;
    list.dataset.gxpSig = sig;
    if (!pos.length) {
      renderPredictPosEmptyLive();
      return;
    }
    list.innerHTML = pos.slice(0, 40).map(function (p) {
      var title = esc(p.title || p.market || p.slug || 'Position');
      var outcome = esc(p.outcome || p.outcomeName || '');
      var size = Number(p.size || p.amount || 0);
      var val = p.currentValue != null
        ? Number(p.currentValue)
        : (p.cashPnl != null ? Number(p.initialValue || 0) + Number(p.cashPnl || 0) : 0);
      return '<div class="gxp-row"><div><b>' + title + (outcome ? (' · ' + outcome) : '') + '</b>'
        + '<small>' + tx('px_live', 'LIVE') + ' · ' + size.toFixed(2) + ' shares</small></div>'
        + '<div class="gxp-pnl up">' + (val ? money(val) : '—') + '</div></div>';
    }).join('');
  }
  var _predictHeroRefreshAt = 0;
  function renderPredictPos() {
    pmIsLive().then(function (live) {
      if (Date.now() - _predictHeroRefreshAt > 120000) {
        _predictHeroRefreshAt = Date.now();
        refreshPredictHeroMode(live);
      }
      if (live) {
        if (gwxConnected() && window.gromPredict) {
          renderPredictPosLive().catch(function () { renderPredictPosEmptyLive(); });
        } else {
          clearDemoPredictBets();
          renderPredictPosEmptyLive();
        }
        return;
      }
      renderPredictPosDemo();
    }).catch(function () { renderPredictPosDemo(); });
  }
  function closePos(kind, i) {
    if (kind === 'stock') {
      var p = (gwxPositions || [])[i];
      if (!p) return;
      onStockBySym(p.sym, 'sell');
    } else if (kind === 'predict') {
      var a = loadPos('grom_predict_pos'); var pp = a[i]; if (!pp) return;
      setBal(bal() + pp.stake * 0.95);
      a.splice(i, 1); savePos('grom_predict_pos', a); notify(tx('px_bet_sold', 'Bet sold'), 'info'); renderPredictPos();
    }
  }

  /* ---- trade / bet handlers ---- */
  function onStock(row, side) {
    if (!row) return;
    onStockBySym(row.dataset.sym, side);
  }
  function onStockBySym(sym, side) {
    if (!sym) return;
    if (!gwxConnected()) { gwxOpenConnect(); return; }
    var s = STOCK_MAP[sym] || GROM_XSTOCKS.find(function (x) { return x.sym === sym; });
    if (!s) { notify(tx('px_price_unavail', 'Price unavailable'), 'error'); return; }
    var trade = gwxPickTrade(s);
    if (!trade) { notify(tx('px_soon', 'Soon') + ' — ' + tx('px_no_evm_route', 'No EVM market for this ticker yet'), 'info'); return; }
    var uiChain = gwxUiChainId();
    if (trade.chainId && uiChain && trade.chainId !== uiChain && !(s.addrs && s.addrs[uiChain])) {
      var label = (window.GWX_ID_TO_LABEL && window.GWX_ID_TO_LABEL[trade.chainId]) || ('chain ' + trade.chainId);
      notify(tx('px_switch_chain', 'Switch to') + ' ' + label + ' ' + tx('px_to_buy', 'to buy') + ' ' + (s.tokenSym || sym), 'info');
    }
    var px = curPx(sym) || s.price || 0;
    refreshUsdtBalChip();
    var pos = (gwxPositions || []).find(function (p) { return p.sym === sym; });
    var maxTok = pos ? pos.qty : 0;
    var chainLbl = (trade.chainId && window.GWX_ID_TO_LABEL && window.GWX_ID_TO_LABEL[trade.chainId])
      || (trade.solMint ? 'Solana' : '');
    openStockModal({
      title: (side === 'buy' ? tx('px_buy', 'Buy') + ' ' : tx('px_sell', 'Sell') + ' ') + sym,
      sub: (s.tokenSym || sym) + ' · ' + chainLbl + (px ? (' · ~$' + px.toFixed(2)) : ''),
      confirmLabel: (side === 'buy' ? tx('px_buy', 'Buy') + ' ' : tx('px_sell', 'Sell') + ' ') + sym,
      unit: side === 'sell' ? 'TOKEN' : 'USDT',
      maxToken: maxTok,
      refPrice: px,
      tokenLabel: s.tokenSym || sym,
      chartHtml: stockSparkSvg(sym, px, s.chg),
      infoAsync: async function (v) {
        if (typeof window.gwXstocksQuote !== 'function') {
          return { html: px ? ('≈ ' + (side === 'buy' ? (v / px) : (v * px)).toFixed(4) + (side === 'buy' ? (' ' + (s.tokenSym || sym)) : ' USDT') + ' · fee 0.20%') : tx('px_quoting', 'Fetching route…') };
        }
        var fromSym = side === 'buy' ? 'USDT' : trade.tokenSym;
        var toSym = side === 'buy' ? trade.tokenSym : 'USDT';
        /* Solana-first when mint exists — skips slow EVM mega fan-out for the modal quote. */
        var q = await window.gwXstocksQuote({
          fromSym: fromSym, toSym: toSym, amtNum: v, chainId: trade.chainId,
          address: trade.address, decimals: trade.decimals, name: s.name, logo: s.logo,
          solMint: trade.solMint, solDecimals: trade.solDecimals, addrsByChain: s.addrs || null,
          refPrice: px,
          probeLite: !!trade.solMint,
        });
        if (!q && trade.solMint) {
          q = await window.gwXstocksQuote({
            fromSym: fromSym, toSym: toSym, amtNum: v, chainId: trade.chainId,
            address: trade.address, decimals: trade.decimals, name: s.name, logo: s.logo,
            solMint: trade.solMint, solDecimals: trade.solDecimals, addrsByChain: s.addrs || null,
            refPrice: px,
          });
        }
        if (!q) return { html: tx('px_quote_fail', 'No route yet. Best liquidity: Solana (Phantom + USDC/USDT). Also tries EVM aggs (1inch/Paraswap/Kyber/Odos/LiFi) when pools exist.') };
        var outDec = q.outDecimals != null ? Number(q.outDecimals)
          : (side === 'buy' ? ((q.venue === 'solana' ? trade.solDecimals : trade.decimals) || 18) : 6);
        var outAmt = Number(q.toAmount) / Math.pow(10, outDec);
        var gas = (q.gasUsd != null) ? (' · gas ≈ $' + Number(q.gasUsd).toFixed(2)) : '';
        var route = (q.aggregator || q.tool || 'DEX') + (q.venue === 'solana' ? ' · Solana' : '');
        return {
          html: '≈ <b>' + outAmt.toFixed(4) + '</b> ' + toSym
            + ' · route: ' + esc(route)
            + ' · fee 0.20%' + gas,
          quote: q, outAmt: outAmt,
        };
      },
      onConfirm: async function (v) {
        if (side === 'buy') {
          await window.gwXstocksBuy({
            tokenSym: trade.tokenSym, usdtAmount: v, chainId: trade.chainId,
            address: trade.address, decimals: trade.decimals, name: s.name, logo: s.logo,
            solMint: trade.solMint, solDecimals: trade.solDecimals, addrsByChain: s.addrs || null,
          });
          notify(tx('px_bought', 'Bought') + ' ' + sym + ' · ' + money(v), 'success');
        } else {
          await window.gwXstocksSell({
            tokenSym: trade.tokenSym, tokenAmount: v, chainId: trade.chainId,
            address: trade.address, decimals: trade.decimals, name: s.name, logo: s.logo,
            solMint: trade.solMint, solDecimals: trade.solDecimals, addrsByChain: s.addrs || null,
          });
          notify(tx('px_sold', 'Sold') + ' ' + v.toFixed(4) + ' ' + (s.tokenSym || sym), 'success');
        }
        await refreshUsdtBalChip();
        await gwxLoadPositions();
      },
    });
  }
  function tradeAttr(el, name) {
    if (!el) return '';
    return el.getAttribute(name) || '';
  }
  async function onBet(btn) {
    var card = btn.closest('.gwx-card') || btn.closest('.gwx-cal-row');
    var oc = btn.closest('.gwx-oc') || btn.closest('.gwx-yn') || btn.closest('.gwx-cal-actions') || card;
    var q = card ? (card.getAttribute('data-q') || '') : '';
    var name = btn.dataset.name || 'Outcome';
    var side = btn.dataset.side === 'no' ? 'no' : 'yes';
    // Each .gwx-bet stores ITS side's price in data-prob (Yes→p, No→pNo). Do not invert again.
    var p = sidePriceFromBtn(btn);
    var label = name + ' · ' + (side === 'yes' ? tx('px_yes', 'Yes') : tx('px_no', 'No'));
    // Tokens may live on the button (calendar multi-outcome) or parent (.gwx-oc / .gwx-yn / .gwx-cal-actions).
    var tokenYes = tradeAttr(btn, 'data-token-yes') || tradeAttr(oc, 'data-token-yes') || tradeAttr(card, 'data-token-yes');
    var tokenNo = tradeAttr(btn, 'data-token-no') || tradeAttr(oc, 'data-token-no') || tradeAttr(card, 'data-token-no');
    var tokenId = side === 'yes' ? tokenYes : tokenNo;
    var tickSize = tradeAttr(btn, 'data-tick') || tradeAttr(oc, 'data-tick') || '0.01';
    var negRisk = (tradeAttr(btn, 'data-neg-risk') || tradeAttr(oc, 'data-neg-risk')) === '1';
    var builderOn = false;
    var predictReady = !!(window.gromPredict && typeof window.gromPredict.buyMarket === 'function');
    try {
      if (window.gromPredict && typeof window.gromPredict.fetchConfig === 'function') {
        builderOn = !!(await window.gromPredict.fetchConfig()).enabled;
      } else if (!predictReady) {
        // Script still loading — one quick retry
        await new Promise(function (r) { setTimeout(r, 120); });
        predictReady = !!(window.gromPredict && typeof window.gromPredict.buyMarket === 'function');
        if (predictReady && typeof window.gromPredict.fetchConfig === 'function') {
          builderOn = !!(await window.gromPredict.fetchConfig()).enabled;
        }
      }
    } catch (_) {}
    var canLive = !!(tokenId && predictReady && builderOn);
    var modeTag = canLive
      ? ' · LIVE'
      : (!tokenId
        ? ' · ' + tx('px_pm_no_token', 'not tradeable')
        : (!predictReady
          ? ' · ' + tx('px_pm_loading', 'loading…')
          : (!builderOn
            ? ' · ' + tx('px_pm_need_builder_short', 'builder off')
            : ' · demo')));

    openModal({
      live: canLive,
      title: tx('px_bet_title', 'Bet:') + ' ' + label,
      sub: q + modeTag,
      confirmLabel: tx('gtm_buy_shares', 'Buy shares'),
      info: function (v) {
        var pn = String(Math.round(p * 100));
        if (!v) {
          return (canLive
            ? tx('px_pm_live_hint', 'Live order on Polygon · signed in your wallet.') + ' '
            : (!tokenId
              ? tx('px_pm_demo_hint', 'Preview only · this outcome has no live order book token.') + ' '
              : (!builderOn
                ? tx('px_pm_need_builder', 'Set GROM_POLYMARKET_BUILDER_CODE on the server to enable live orders') + ' '
                : ''))) + txFmt('px_prob_line', 'Price {n}¢ = probability {n}%.', { n: pn });
        }
        var sh = v / p;
        return txFmt('px_payout_line', 'You get ~{sh} shares · max payout ~{pay} if outcome wins.', { sh: sh.toFixed(2), pay: money(sh) })
          + ' · ' + txFmt('px_prob_line', 'Price {n}¢ = probability {n}%.', { n: pn });
      },
      onConfirm: function (v) {
        var sh = v / p; setBal(bal() - v);
        var arr = loadPos('grom_predict_pos'); arr.unshift({ label: label, q: q, stake: v, price: p, shares: sh, t: Date.now() }); savePos('grom_predict_pos', arr);
        notify(tx('px_bet_title', 'Bet:') + ' ' + money(v) + ' · ' + label, 'success'); renderPredictPos();
      },
      onConfirmAsync: canLive ? async function (v) {
        if (!gwxConnected()) { gwxOpenConnect(); throw new Error(tx('px_connect_wallet', 'Connect wallet to trade')); }
        var resp = await window.gromPredict.buyMarket({
          tokenId: tokenId, amountUsd: v, tickSize: tickSize, negRisk: negRisk,
        });
        var oid = (resp && (resp.orderID || resp.orderId || resp.id)) || '';
        notify(tx('px_pm_order_ok', 'Order submitted') + (oid ? (' · ' + String(oid).slice(0, 10) + '…') : ''), 'success');
        try { await renderPredictPosLive(); } catch (_) { renderPredictPos(); }
      } : null,
    });
  }

  document.addEventListener('grom:xstocks-focus', function (ev) {
    try {
      var sym = ev && ev.detail && ev.detail.sym;
      if (sym) { try { sessionStorage.setItem('gwx_focus_sym', sym); } catch (_) {} gwxFocusFromHash(); }
    } catch (_) {}
  });
  document.addEventListener('grom:wallet-connected', function () { refreshUsdtBalChip(); gwxLoadPositions(); });
  document.addEventListener('grom:wallet-disconnected', function () { gwxUsdtBal = 0; gwxPositions = []; updateXstocksStats(); renderStockPos(); });

  document.addEventListener('click', function (e) {
    var jump = e.target.closest('.gwx-jump');
    if (jump) { e.preventDefault(); e.stopPropagation(); scrollToGwxSection(jump.getAttribute('data-jump')); return; }
    var bet = e.target.closest('.gwx-bet');
    if (bet) { e.preventDefault(); e.stopPropagation(); onBet(bet); return; }
    var tr = e.target.closest('.gwx-trade');
    if (tr) { e.preventDefault(); e.stopPropagation(); onStock(tr.closest('.gwx-row'), tr.dataset.side); return; }
    var mobRow = e.target.closest('#page-xstocks .gwx-row[data-sym]');
    if (mobRow && !e.target.closest('button,a,.gwx-trade,.gwx-soon') && window.matchMedia('(max-width:760px)').matches) {
      if (mobRow.querySelector('.gwx-trade.gwx-buy')) { e.preventDefault(); onStock(mobRow, 'buy'); }
      return;
    }
    var cl = e.target.closest('.gxp-close');
    if (cl) { e.preventDefault(); e.stopPropagation(); closePos(cl.dataset.k, parseInt(cl.dataset.i, 10)); return; }
    if (e.target.closest('#gwxPredictLoadMore')) {
      e.preventDefault();
      var listMore = predictSource();
      var showCur = gwxState.pShow || GWX_MOBILE_BATCH;
      if (listMore.length > showCur) {
        gwxState.pShow = showCur + GWX_MOBILE_BATCH;
        renderPredictGrid();
        return;
      }
      loadPredictLive(true, { append: true, q: gwxState.pQ || '' });
      return;
    }
    if (e.target.closest('#gwxStockLoadMore')) {
      gwxState.sShow = (gwxState.sShow || GWX_STOCKS_BATCH) + GWX_STOCKS_BATCH;
      renderXstocksRows();
      return;
    }
    var pill = e.target.closest('.gwx-cats .gwx-pill');
    if (pill) {
      e.preventDefault(); e.stopPropagation();
      pill.parentNode.querySelectorAll('.gwx-pill').forEach(function (x) { x.classList.remove('on'); }); pill.classList.add('on');
      if (pill.closest('#page-predict')) {
        gwxState.pCat = pill.dataset.cat || 'all';
        gwxState.pShow = GWX_MOBILE_BATCH;
        gwxState.pOffset = 0;
        GWX_LIVE_SEARCH = null;
        if (applyPredictCatalog(gwxState.pCat)) {
          renderPredictGrid();
          updatePredictStats();
          updatePredictMoreBtn();
        } else {
          // Keep previous cards visible while fetching — no empty flash
          loadPredictLive(true);
        }
      }
      else if (pill.closest('#page-xstocks')) { gwxState.sCat = pill.dataset.cat; gwxState.sShow = GWX_STOCKS_BATCH; renderXstocksRows(); }
      return;
    }
    var viewTab = e.target.closest('.gwx-view-tab[data-pview]');
    if (viewTab && viewTab.closest('#page-predict')) {
      e.preventDefault(); e.stopPropagation();
      gwxState.pView = viewTab.dataset.pview || 'all';
      if (gwxState.pView === 'live') loadPredictLive(!predictDomHasCards(), { soft: predictDomHasCards() });
      else applyPredictView();
      return;
    }
    var calDay = e.target.closest('.gwx-cal-day[data-day]');
    if (calDay) {
      e.preventDefault(); e.stopPropagation();
      gwxState.pDay = calDay.dataset.day;
      gwxState.pCalShow = 24;
      renderPredictCalendar();
      return;
    }
    if (e.target.closest('#gwxCalLoadMore')) {
      e.preventDefault(); e.stopPropagation();
      gwxState.pCalShow = (gwxState.pCalShow || 24) + 24;
      renderPredictCalendar();
      return;
    }
  });
  var _gwxSearchTimer = null;
  document.addEventListener('input', function (e) {
    var inp = e.target.closest('.gwx-search input'); if (!inp) return;
    var v = inp.value || '';
    clearTimeout(_gwxSearchTimer);
    _gwxSearchTimer = setTimeout(function () {
      if (inp.closest('#page-predict')) {
        gwxState.pQ = v;
        gwxState.pShow = GWX_MOBILE_BATCH;
        gwxState.pPage = 1;
        if (String(v || '').trim()) {
          // Remote Polymarket search (title / slug / event URL)
          renderPredictGrid();
          loadPredictLive(true, { q: v });
        } else {
          GWX_LIVE_SEARCH = null;
          gwxState.pHasMore = !!(GWX_LIVE && gwxState.pTotal > GWX_LIVE.length);
          renderPredictGrid();
          if (!GWX_LIVE || !GWX_LIVE.length) loadPredictLive(true);
          else updatePredictMoreBtn();
        }
      } else if (inp.closest('#page-xstocks')) {
        gwxState.sQ = v; gwxState.sShow = GWX_STOCKS_BATCH; renderXstocksRows();
      }
    }, 380);
  });

  /* ---- live drift (only when page is active) ---- */
  var undLast = {};
  function getUnd(sym) { if (STOCK_MAP[sym]) return curPx(sym); return livePx(sym); }
  function flash(el, up) { if (!el) return; el.classList.remove('flash-up', 'flash-dn'); void el.offsetWidth; el.classList.add(up ? 'flash-up' : 'flash-dn'); }
  function refreshStockPrices() {
    var page = document.getElementById('page-xstocks'); if (!page || !page.classList.contains('active')) return;
    initPx();
    // Paint cached LiFi / catalog prices — no fake random drift on live markets
    page.querySelectorAll('.gwx-row[data-sym]').forEach(function (row) {
      var sym = row.dataset.sym;
      var s = STOCK_MAP[sym];
      var b0 = parseFloat(row.dataset.b0) || gwxB0[sym] || (s && s.price) || curPx(sym) || 1;
      var p = curPx(sym) || (s && s.price) || 0;
      if (!p) return;
      var chg = s && s.chg != null ? s.chg : ((p / b0 - 1) * 100);
      var pe = row.querySelector('.gwx-price'); if (pe) pe.textContent = '$' + p.toFixed(2);
      var ce = row.querySelector('.gwx-chg');
      if (ce) {
        ce.textContent = (chg >= 0 ? '+' : '') + chg.toFixed(2) + '%';
        ce.classList.toggle('gwx-up', chg >= 0);
        ce.classList.toggle('gwx-dn', chg < 0);
      }
    });
  }
  function driftPredict() {
    var page = document.getElementById('page-predict'); if (!page || !page.classList.contains('active')) return;
    if (document.hidden || gwxState.pView === 'live' || gwxMobile()) return;
    var lite = gwxMobile();
    var deltas = {};
    page.querySelectorAll('.gwx-card[data-und]').forEach(function (card) {
      var u = card.dataset.und; if (deltas[u] !== undefined) return;
      var cur = getUnd(u);
      if (cur == null || !isFinite(cur) || cur <= 0) { deltas[u] = 0; return; }
      var last = undLast[u]; deltas[u] = (last != null && last > 0) ? (cur - last) / last * 100 : 0; undLast[u] = cur;
    });
    var ocs = page.querySelectorAll('.gwx-oc');
    var step = lite ? 2 : 1;
    for (var oi = 0; oi < ocs.length; oi += step) {
      var oc = ocs[oi];
      var probEl = oc.querySelector('.gwx-oc-prob'); var fill = oc.querySelector('.gwx-oc-fill');
      var yes = oc.querySelector('.gwx-bet.gwx-yes'); var no = oc.querySelector('.gwx-bet.gwx-no');
      if (!probEl || !yes) continue;
      var card = oc.closest('.gwx-card'); var u = card ? card.dataset.und : null;
      var a = parseFloat(probEl.textContent) || 50;
      var dir = (u && deltas[u]) ? Math.max(-3, Math.min(3, deltas[u] * 10)) : 0;
      var jitter = lite ? 0.9 : 1.4;
      var nv = Math.round(Math.min(99, Math.max(1, a + (Math.random() * jitter - jitter / 2) + dir)));
      if (nv === a) continue;
      probEl.textContent = nv + '%';
      if (fill) fill.style.width = nv + '%';
      yes.dataset.prob = nv; if (no) no.dataset.prob = 100 - nv;
      if (!lite) {
        probEl.classList.remove('up', 'dn'); void probEl.offsetWidth; probEl.classList.add(nv > a ? 'up' : 'dn');
        setTimeout(function (el) { return function () { el.classList.remove('up', 'dn'); }; }(probEl), 480);
      }
    }
  }
  var _gwxTick = 0;
  function refreshActive() {
    if (document.hidden) return;
    _gwxTick++;
    var px = document.getElementById('page-xstocks');
    var pp = document.getElementById('page-predict');
    if (px && px.classList.contains('active')) {
      refreshStockPrices();
      if (_gwxTick % 4 === 0) { renderStockPos(); updateXstocksStats(); }
      if (_gwxTick % 20 === 0) { refreshUsdtBalChip(); gwxLoadPositions(); }
      if (_gwxTick % 50 === 0) gwxRefreshPrices();
    }
    if (pp && pp.classList.contains('active')) {
      if (!window.GROM_SAFARI && _gwxTick % 3 === 0) patchPredictQuotes();
      if (!gwxMobile() && !window.GROM_SAFARI) driftPredict();
      if (_gwxTick % 20 === 0) { renderPredictPos(); updateBalChips(); }
      if (!gwxMobile() && !window.GROM_SAFARI && _gwxTick % 10 === 0) loadPredictLive(false, { soft: true });
    }
  }
  function scheduleGwxTick() {
    if (window.GROM_SAFARI) return;
    setTimeout(function () {
      try { refreshActive(); } catch (_) {}
      scheduleGwxTick();
    }, gwxTickMs());
  }
  if (!window.GROM_SAFARI) scheduleGwxTick();

  /* ---- sidebar nav links (any UI language) ---- */
  function setNavPageIcon(node, page) {
    if (!node) return;
    var href = page === 'predict' ? '#i-predict' : (page === 'xstocks' ? '#i-xstocks' : '');
    if (!href) return;
    var ico = node.querySelector('.ico');
    if (!ico) return;
    ico.innerHTML = '<svg width="18" height="18" aria-hidden="true"><use href="' + href + '"/></svg>';
  }
  function ensureNav() {
    var navFb = { nav_predict: 'Predictions', nav_xstocks: 'Stocks' };
    var items = [['predict', 'nav_predict', ''], ['xstocks', 'nav_xstocks', 'NEW']];
    var aside = document.querySelector('aside.sidebar');
    if (aside) {
      var markets = aside.querySelector('.nav-item[data-page="markets"]');
      if (markets) {
        var anchor = markets;
        items.forEach(function (p) {
          var existing = aside.querySelector('.nav-item[data-page="' + p[0] + '"]');
          if (existing) {
            var label = existing.querySelector('.nav-label');
            if (label) { label.setAttribute('data-i18n', p[1]); label.textContent = tx(p[1], navFb[p[1]]); }
            setNavPageIcon(existing, p[0]);
            existing.querySelectorAll('.badge, .gw-nav-badge').forEach(function (b) {
              if (!p[2]) b.remove();
            });
            anchor = existing; return;
          }
          var node = markets.cloneNode(true);
          node.classList.remove('active'); node.id = 'gwNav_' + p[0]; node.setAttribute('data-page', p[0]);
          var label = node.querySelector('.nav-label');
          if (label) { label.setAttribute('data-i18n', p[1]); label.textContent = tx(p[1], navFb[p[1]]); } else { node.textContent = tx(p[1], navFb[p[1]]); }
          setNavPageIcon(node, p[0]);
          node.querySelectorAll('.badge, .gw-nav-badge').forEach(function (b) { b.remove(); });
          if (p[2]) {
            var bdg = document.createElement('span'); bdg.className = 'badge new';
            bdg.textContent = p[2];
            node.appendChild(bdg);
          }
          anchor.parentNode.insertBefore(node, anchor.nextSibling);
          anchor = node;
        });
      }
    }
    // Desktop top menu (hub-nav): add the same sections after "Markets".
    var hub = document.querySelector('nav.hub-nav');
    if (hub) {
      var hMarkets = hub.querySelector('.hub-link[data-page="markets"]');
      if (hMarkets) {
        var hAnchor = hMarkets;
        items.forEach(function (p) {
          var ex = hub.querySelector('.hub-link[data-page="' + p[0] + '"]');
          if (ex) { ex.setAttribute('data-i18n', p[1]); ex.textContent = tx(p[1], navFb[p[1]]); hAnchor = ex; return; }
          var btn = document.createElement('button');
          btn.type = 'button'; btn.className = 'hub-link'; btn.setAttribute('data-page', p[0]); btn.setAttribute('data-i18n', p[1]);
          btn.textContent = tx(p[1], navFb[p[1]]);
          hAnchor.parentNode.insertBefore(btn, hAnchor.nextSibling);
          hAnchor = btn;
        });
      }
    }
  }

  // Refresh positions/balance when navigating to either page (the app's own
  // show() router handles activation; we just freshen dynamic bits).
  document.addEventListener('click', function (e) {
    var n = e.target.closest('[data-page="predict"], [data-page="xstocks"]');
    if (n) { setTimeout(refreshActive, 60); }
  }, true);
  window.addEventListener('hashchange', function () {
    var h = (location.hash || '').replace(/^#/, '').split('?')[0];
    if (h === 'predict' || h === 'xstocks') setTimeout(refreshActive, 80);
    if (h === 'predict') {
      ensurePredictPage();
      loadPredictLive(!predictGridHasCards(), { soft: predictGridHasCards() });
      ensurePredictPoll();
      return;
    }
    if (h === 'xstocks') ensureXstocksPage();
  });
  /* Safari visibilitychange fires on address-bar show/hide — never reload predict on resume. */
  (function () {
    var xstocksHiddenAt = 0;
    var xstocksResumeAt = 0;
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        xstocksHiddenAt = Date.now();
        return;
      }
      var sleptX = xstocksHiddenAt ? (Date.now() - xstocksHiddenAt) : 0;
      xstocksHiddenAt = 0;
      var xs = document.getElementById('page-xstocks');
      if (xs && xs.classList.contains('active') && sleptX >= 15000 && (Date.now() - xstocksResumeAt >= 60000)) {
        xstocksResumeAt = Date.now();
        try { refreshStockPrices(); } catch (_) {}
        try { gwxRefreshPrices(); } catch (_) {}
      }
    });
  })();
  window.addEventListener('grom:lang-change', function () {
    GWX_LIVE = [];
    GWX_LIVE_SEARCH = null;
    GWX_CATALOG = null;
    GWX_CATALOG_LANG = null;
    gwxState.pOffset = 0;
    gwxState.pPage = 1;
    var dashPv = document.getElementById('dashPredictSpot');
    if (dashPv) delete dashPv.dataset.gwxPvLive;
    ['page-predict', 'page-xstocks'].forEach(function (id) {
      var sec = document.getElementById(id);
      if (!sec) return;
      sec.dataset.gwxForce = '1';
      delete sec.dataset.gwxReady;
      delete sec.dataset.gwxLang;
    });
    try { renderPredictWidgets(); } catch (_) {}
    try {
      var wl = document.getElementById('watchlist');
      if (wl) { delete wl.__dashWlMounted; wl.dataset.dashWlPxFrozen = '0'; }
      if (typeof renderDashboardWatchlist === 'function') renderDashboardWatchlist();
    } catch (_) {}
    clearTimeout(window.__gwxLangReloadTimer);
    window.__gwxLangReloadTimer = setTimeout(function () {
      try {
        ensurePredictPage();
        ensureXstocksPage();
        ensureNav();
        if (typeof window.applyI18n === 'function') {
          window.applyI18n(document.querySelector('.sidebar'));
          window.applyI18n(document.querySelector('.hub-header'));
          window.applyI18n();
        }
      } catch (_) {}
      loadPredictLive(true);
    }, window.GROM_STABLE_UI ? 80 : 200);
  });

  function bootHeavyLanding() {
    ensurePredictPage(); ensureNav();
    var loadLpPredict = function () {
      if (window.__gromLpPredictLoaded) return;
      window.__gromLpPredictLoaded = true;
      loadPredictLive(false);
      renderPredictWidgets();
    };
    var lpSec = document.getElementById('lpPredictSec');
    if (lpSec && typeof IntersectionObserver === 'function') {
      var obs = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { obs.disconnect(); loadLpPredict(); }
        });
      }, { rootMargin: '320px 0px' });
      obs.observe(lpSec);
      setTimeout(loadLpPredict, window.GROM_SAFARI ? 18000 : 14000);
    } else {
      loadLpPredict();
    }
  }
  function bootHeavy() {
    ensurePredictPage(); ensureXstocksPage(); ensureNav();
    loadPredictLive(false, { soft: false });
    ensurePredictPoll();
    renderPredictWidgets();
    refreshActive();
  }
  function boot() {
    injectCss(); ensureNav();
    var route = '';
    try { route = document.documentElement.getAttribute('data-grom-route') || ''; } catch (_) {}
    var onLanding = !route || route === 'landing';
    if (onLanding) {
      var runHeavy = function () { try { bootHeavyLanding(); } catch (_) {} };
      var deferMs = window.GROM_SAFARI ? 3500 : 4500;
      var idleTimeout = window.GROM_SAFARI ? 8000 : 12000;
      if (typeof requestIdleCallback === 'function') requestIdleCallback(runHeavy, { timeout: idleTimeout });
      else setTimeout(runHeavy, deferMs);
    } else if (route === 'predict') {
      ensurePredictPage();
      loadPredictLive(!predictGridHasCards(), { soft: predictGridHasCards() });
      ensurePredictPoll();
    } else if (route === 'xstocks') {
      ensureXstocksPage(); ensureNav(); loadPredictLive(false); renderPredictWidgets();
    } else {
      bootHeavy();
    }
    if (typeof window.applyI18n === 'function') window.applyI18n();
  }
  window.gromEnsureGwxPages = function (which) {
    if (which === 'xstocks' || which === 'both') ensureXstocksPage();
    else ensurePredictPage();
    ensureNav();
    if (!GWX_LIVE || !GWX_LIVE.length) loadPredictLive(false);
    if (which === 'xstocks' || which === 'both') { /* catalog loaded in ensureXstocksPage */ }
    if (document.getElementById('page-predict')?.classList.contains('active')) ensurePredictPoll();
  };
  window.gromRefreshI18nPages = function () {
    if (typeof window.applyI18n === 'function') window.applyI18n();
    if (window.GROM_SEO_I18N && window.GROM_SEO_I18N.refreshLight) window.GROM_SEO_I18N.refreshLight();
    // Always invalidate predict/xstocks shells on lang change (stable UI skips heavy loops only).
    ['page-predict', 'page-xstocks'].forEach(function (id) {
      var sec = document.getElementById(id);
      if (!sec) return;
      sec.dataset.gwxForce = '1';
      delete sec.dataset.gwxReady;
      delete sec.dataset.gwxLang;
    });
    if (window.GROM_STABLE_UI) {
      try {
        var dashPv = document.getElementById('dashPredictSpot');
        if (dashPv) delete dashPv.dataset.gwxPvLive;
        GWX_LIVE = [];
        GWX_LIVE_SEARCH = null;
        GWX_CATALOG = null;
        GWX_CATALOG_LANG = null;
        renderPredictWidgets();
        loadPredictLive(true);
      } catch (_) {}
      return;
    }
    var heavy = function () {
      try {
        ensurePredictPage();
        ensureXstocksPage();
        ensureNav();
      } catch (_) {}
      GWX_LIVE = [];
      GWX_LIVE_SEARCH = null;
      GWX_CATALOG = null;
      GWX_CATALOG_LANG = null;
      try { renderPredictWidgets(); } catch (_) {}
      loadPredictLive(true);
      try { renderPredictPos(); } catch (_) {}
      try { renderStockPos(); } catch (_) {}
      if (typeof renderMarketsEnhanced === 'function') renderMarketsEnhanced();
      if (typeof renderDashboardWatchlist === 'function') renderDashboardWatchlist();
      // Re-apply chrome labels after shells rewrite nav text via tx().
      if (typeof window.applyI18n === 'function') window.applyI18n();
    };
    if (typeof requestIdleCallback === 'function') requestIdleCallback(heavy, { timeout: 1200 });
    else setTimeout(heavy, 80);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.gromPredictHasLive = function () { return !!(typeof GWX_LIVE !== 'undefined' && GWX_LIVE && GWX_LIVE.length); };
  window.gromWarmPredictCache = function () { try { loadPredictLive(false); } catch (_) {} };
  window.gromApplyPredictView = function () { try { if (typeof applyPredictView === 'function') applyPredictView(); } catch (_) {} };
  window.gromPaintPredictLoading = function () {
    try {
      var grid = document.querySelector('#page-predict .gwx-grid, #page-predict .gwx-list');
      if (grid && !grid.querySelector('.gwx-card, .gwx-row, .grom-pv-item')) {
        grid.innerHTML = '<div class="gwx-none" style="opacity:.7">Loading markets…</div>';
      }
      var dash = document.getElementById('dashPredictSpot');
      if (dash && !dash.querySelector('.grom-pv-item')) {
        dash.innerHTML = '<div class="grom-pv-item" style="opacity:.65;cursor:default"><div class="grom-pv-q">Loading markets…</div></div>';
      }
    } catch (_) {}
  };

})();
