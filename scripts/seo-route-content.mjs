/**
 * Route-level English SEO copy + JSON-LD for GROM product URLs.
 * Used by build-frontend.mjs. Keep factual — no invented volume, TVL, audits, users, or APY.
 * Brand policy: do not name Hyperliquid / Polymarket / Kalshi / Backed / xStocks in this copy.
 */
export const SEO_ROUTE_KEYS = ['landing', 'dashboard', 'futures', 'predict', 'xstocks', 'markets'];

const NAV = `
<nav class="grom-seo-nav" aria-label="Product links">
  <a href="/">Home</a>
  <a href="/swap">Swap</a>
  <a href="/futures">Trade</a>
  <a href="/predict">Predictions</a>
  <a href="/stocks">Stocks</a>
  <a href="/markets">Markets</a>
</nav>`.trim();

function faqHtml(items) {
  return `<div class="grom-seo-faq">${items.map((q) =>
    `<details class="grom-seo-faq-item"><summary>${esc(q.q)}</summary><p>${q.a}</p></details>`
  ).join('\n')}</div>`;
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** @type {Record<string, { h1: string, lead: string, sections: {h2:string, html:string}[], faq: {q:string,a:string}[], appName: string, appDesc: string }>} */
export const SEO_COPY = {
  landing: {
    h1: 'GROM Exchange — non-custodial DeFi terminal',
    lead: 'GROM is a wallet-first crypto hub. You connect a self-custody wallet, keep your keys, and sign every trade. There is no exchange deposit account and no KYC gate for core wallet trading.',
    appName: 'GROM Exchange',
    appDesc: 'Non-custodial DeFi terminal for cross-chain swaps, spot and perpetual futures, prediction markets, and tokenized stocks.',
    sections: [
      {
        h2: 'Four product lines, one wallet',
        html: `<p>GROM brings four markets into one interface: <a href="/swap">cross-chain swaps and spot-style routing</a>, <a href="/futures">perpetual futures and spot trading</a>, <a href="/predict">prediction markets</a>, and <a href="/stocks">tokenized stocks (RWA equities)</a>. Live prices and discovery live on <a href="/markets">Markets</a>.</p>
<p>Each product settles to addresses you control. Quotes and fills come from on-chain venues and aggregators; GROM does not take custody of your balances.</p>`,
      },
      {
        h2: 'How trading works',
        html: `<p>Connect a Web3 wallet (browser extension or WalletConnect). Pick a product, review the quote or order ticket, then confirm the signature or transaction in your wallet. Assets move on the destination chain or venue — not into a GROM balance you must later withdraw.</p>
<p>Supported networks for swaps include major EVM chains and additional ecosystems surfaced by the routing layer. Futures and spot tickets, prediction stakes, and tokenized stock flows use the networks those products require. Always verify the network and asset in your wallet before signing.</p>`,
      },
      {
        h2: 'Fees and risks',
        html: `<p>Swaps show routing fees inside the quote plus network gas. Perpetuals, predictions, and tokenized stocks charge venue fees disclosed in the ticket before you confirm. GROM does not promise returns, volume, or liquidity depth.</p>
<p>Trading involves risk of loss. Leveraged perpetuals can liquidate. Prediction stakes can expire worthless. Tokenized stocks are crypto wrappers around equity exposure — not traditional brokerage shares — and may differ in settlement, hours, and regulation. Only use funds you can afford to lose.</p>`,
      },
    ],
    faq: [
      {
        q: 'What is GROM Exchange?',
        a: 'GROM is a non-custodial DeFi terminal. You trade from your own wallet across swaps, perpetuals, prediction markets, and tokenized stocks without depositing into a custodial exchange account.',
      },
      {
        q: 'Do I need to create an account or pass KYC?',
        a: 'Core wallet trading does not require an email account or GROM KYC. Third-party railss and some regions may apply their own checks. Always follow local law.',
      },
      {
        q: 'Where do my funds sit?',
        a: 'In your wallet and on the venues you trade. GROM software helps you route and sign; it does not hold user deposits.',
      },
      {
        q: 'Which products can I open from the homepage?',
        a: 'Swap (/swap), Trade for spot and perpetuals (/futures), Predictions (/predict), Stocks (/stocks), and Markets (/markets).',
      },
    ],
  },

  dashboard: {
    h1: 'Cross-chain crypto swap from your wallet',
    lead: 'Swap tokens across many chains without creating a GROM balance. The Instant Swap desk queries multiple routers, shows a quote, and asks your wallet to sign. Settlement is on-chain to your address.',
    appName: 'GROM Instant Swap',
    appDesc: 'Non-custodial cross-chain crypto swap aggregator with wallet signatures and on-chain settlement.',
    sections: [
      {
        h2: 'What Instant Swap does',
        html: `<p>Choose a source token and chain, a destination token and chain, and an amount. GROM requests quotes from several aggregators and bridges in parallel, then presents a route you can accept or reject. You never send funds to a GROM hot wallet for the swap itself.</p>
<p>Coverage includes thousands of tokens across twenty-plus networks when liquidity and bridges allow. Exact availability depends on the routers at quote time — empty routes are possible for illiquid pairs.</p>`,
      },
      {
        h2: 'Chains, wallets, and signing',
        html: `<p>Use a self-custody wallet that can sign EVM transactions (and other ecosystems the desk supports). After you confirm, your wallet may ask to approve a token spend, then to send the swap or bridge transaction. Cross-chain routes can take longer than same-chain swaps; track the status from the desk and your wallet activity.</p>
<p>Related products stay one click away: <a href="/futures">Trade</a> for spot and perpetuals, <a href="/markets">Markets</a> for prices, <a href="/predict">Predictions</a>, and <a href="/stocks">tokenized stocks</a>.</p>`,
      },
      {
        h2: 'Fees, slippage, and risks',
        html: `<p>Each quote lists estimated output, route fee, and network gas. Slippage settings control how much price movement you accept. Bridge and DEX venues can fail, delay, or return less than estimated in volatile markets.</p>
<p>Always double-check token contracts, chains, and amounts in the wallet prompt. GROM does not invent guaranteed best prices or zero-risk bridges.</p>`,
      },
    ],
    faq: [
      {
        q: 'Is Instant Swap custodial?',
        a: 'No. You sign in your wallet and settlement targets your address. GROM does not take custody of swap principal.',
      },
      {
        q: 'Why did I get no route?',
        a: 'Aggregators may lack liquidity, pause a bridge, or reject the pair or amount. Try another token, chain, or size.',
      },
      {
        q: 'What fees do I pay?',
        a: 'Routing fees shown in the quote plus gas on the source (and sometimes destination) network. Third-party bridge fees may apply inside the route.',
      },
      {
        q: 'Can I move from swap into perps or stocks?',
        a: 'Yes. After tokens arrive in your wallet, open Trade (/futures), Stocks (/stocks), or Predictions (/predict) with the same connection.',
      },
    ],
  },

  futures: {
    h1: 'Spot and perpetual futures from your wallet',
    lead: 'The Trade desk lets you buy and sell spot markets and perpetual futures while signing from a self-custody wallet. Margin and positions live on the trading venue — not in a GROM deposit account.',
    appName: 'GROM Trade',
    appDesc: 'Wallet-signed spot and perpetual futures trading terminal.',
    sections: [
      {
        h2: 'Spot and perps in one terminal',
        html: `<p>Switch between spot and perpetual modes on the Trade page. Spot tickets buy or sell the listed asset against the quote currency. Perpetual tickets open long or short exposure with leverage you select within venue limits.</p>
<p>Charts, balances, and open orders update from the venue after you connect. Pair lists include major crypto markets and additional listings the venue exposes — availability can change.</p>`,
      },
      {
        h2: 'Wallet flow and funding',
        html: `<p>Connect your wallet, fund the venue when the product requires a deposit or transfer step, then place market or limit orders. Every sensitive action asks for a wallet signature or transaction. Closing or reducing a position follows the same wallet-first pattern.</p>
<p>Use <a href="/swap">Swap</a> if you need assets on another chain first. Browse prices on <a href="/markets">Markets</a>, or move to <a href="/predict">Predictions</a> and <a href="/stocks">Stocks</a> without creating a separate GROM login.</p>`,
      },
      {
        h2: 'Fees and leveraged risk',
        html: `<p>Order tickets show estimated fees before you confirm. Maker and taker rates depend on the venue and order type. Builder or platform fees may appear when configured; if paused, the ticket states that clearly.</p>
<p>Leverage amplifies gains and losses. Positions can be liquidated when margin is insufficient. Funding payments on perpetuals can credit or debit your account over time. Do not treat perpetual trading as risk-free or suitable for every user.</p>`,
      },
    ],
    faq: [
      {
        q: 'Does Trade require a GROM deposit?',
        a: 'No custodial GROM balance. You connect a wallet and fund the trading venue as the product instructs, then sign orders yourself.',
      },
      {
        q: 'What is the difference between spot and perpetuals?',
        a: 'Spot exchanges the asset itself. Perpetuals track a market with leverage and funding, without delivering the underlying on each trade.',
      },
      {
        q: 'Can I lose more than I deposit?',
        a: 'Liquidation is designed to close positions when margin is exhausted, but gaps and fees can still cause losses. Understand venue rules before using leverage.',
      },
      {
        q: 'Where do I see prices before trading?',
        a: 'Open Markets (/markets) or the Trade chart for the selected pair.',
      },
    ],
  },

  predict: {
    h1: 'Prediction markets funded from your wallet',
    lead: 'GROM Predictions lets you take positions on event outcomes using funds from your connected wallet. Markets cover themes such as crypto, sports, and politics when listed. Resolution follows the market rules — not a discretionary GROM payout.',
    appName: 'GROM Predictions',
    appDesc: 'Non-custodial prediction markets with wallet funding and on-venue settlement.',
    sections: [
      {
        h2: 'How prediction markets work here',
        html: `<p>Browse open events, read the question and rules, then buy or sell outcome shares at the displayed prices. Prices reflect market-implied probabilities and can move as traders update views. Closing a position before resolution sells your shares back to the market.</p>
<p>Staking and claiming use wallet signatures and the chain the product runs on. There is no separate “prediction balance” custodied by GROM.</p>`,
      },
      {
        h2: 'Getting started and related products',
        html: `<p>Connect a wallet, ensure you hold the collateral asset the market requires, then enter a size and confirm. If you need to bridge or swap collateral first, use <a href="/swap">Instant Swap</a>. Macro prices and other assets remain on <a href="/markets">Markets</a>; leveraged crypto exposure is on <a href="/futures">Trade</a>; equity-style tokens are on <a href="/stocks">Stocks</a>.</p>`,
      },
      {
        h2: 'Fees and risks',
        html: `<p>Tickets disclose trading fees before you confirm. Spreads and liquidity vary by market — thin books can slip. If an event resolves against your shares, you can lose the stake. Dispute or resolution delays are possible on any event market.</p>
<p>Prediction markets are not sportsbook cash-out products and are not suitable for users seeking guaranteed income. Follow regional restrictions that apply to event contracts.</p>`,
      },
    ],
    faq: [
      {
        q: 'Are prediction winnings deposited to GROM?',
        a: 'No. Collateral and payouts settle to your wallet through the market venue.',
      },
      {
        q: 'What topics are available?',
        a: 'Listings change. You may see crypto, sports, politics, and other event categories when markets are open.',
      },
      {
        q: 'What fees apply?',
        a: 'Venue trading fees shown in the order ticket, plus network gas for on-chain steps.',
      },
      {
        q: 'Can markets resolve slowly?',
        a: 'Yes. Resolution depends on oracles and market rules. Read each market’s terms before trading.',
      },
    ],
  },

  xstocks: {
    h1: 'Tokenized stocks (RWA) traded from your wallet',
    lead: 'GROM Stocks offers tokenized equity exposure — crypto tokens that track listed companies — so you can trade fractional sizes outside traditional brokerage hours when the venue is open. Settlement is to your wallet, not a GROM brokerage account.',
    appName: 'GROM Stocks',
    appDesc: 'Wallet-traded tokenized stocks and RWA equity tokens.',
    sections: [
      {
        h2: 'What tokenized stocks are',
        html: `<p>Tokenized stocks are on-chain representations of equity exposure. They can trade in smaller sizes than whole shares and may be available when traditional stock markets are closed, subject to venue hours and liquidity. They are not identical to brokerage shares: custody, corporate actions, and regulation differ.</p>
<p>Popular names such as large US tech equities may appear when the issuer and venue list them. Always read the token and market disclosures in the product UI.</p>`,
      },
      {
        h2: 'How to buy and sell',
        html: `<p>Connect a wallet, select a tokenized stock, enter a size, and confirm. You may need the venue’s quote asset (often a stablecoin) on the correct chain — use <a href="/swap">Swap</a> if you must bridge first. Monitor open positions in the Stocks desk and in your wallet’s token list.</p>
<p>Combine with <a href="/futures">Trade</a> for crypto spot and perps, <a href="/predict">Predictions</a> for event markets, and <a href="/markets">Markets</a> for broader price discovery.</p>`,
      },
      {
        h2: 'Fees and risks',
        html: `<p>Expect venue trading fees and network gas. Spreads can widen outside peak hours. Tokenized equities can depeg from the traditional reference price, pause mint/redeem, or face issuer and regulatory constraints.</p>
<p>This is not investment advice. Tokenized stocks can lose value. They may be unavailable in some jurisdictions.</p>`,
      },
    ],
    faq: [
      {
        q: 'Are these traditional stock certificates?',
        a: 'No. They are crypto tokens that track equity exposure. Rights and custody differ from a regulated brokerage account.',
      },
      {
        q: 'Can I trade on weekends?',
        a: 'Venues may allow 24/7 crypto trading of the tokens, but liquidity and pricing can differ from weekday stock-market hours.',
      },
      {
        q: 'Do I need a brokerage KYC with GROM?',
        a: 'GROM does not open a brokerage account for you. Wallet access is non-custodial; issuers or on-ramps may still impose their own rules.',
      },
      {
        q: 'How do I fund a purchase?',
        a: 'Hold the required quote asset in your wallet on the supported chain, then confirm the trade. Use Swap if you need to bridge or convert first.',
      },
    ],
  },

  markets: {
    h1: 'Crypto markets and live prices on GROM',
    lead: 'Markets is the discovery layer for GROM: live prices, movers, and shortcuts into Swap, Trade, Predictions, and Stocks. It does not custody funds — it helps you pick a market and jump into the matching desk.',
    appName: 'GROM Markets',
    appDesc: 'Live crypto and related market discovery for the GROM DeFi terminal.',
    sections: [
      {
        h2: 'What you see on Markets',
        html: `<p>Browse listed pairs and assets with recent price context. Open a row to continue into the product that can trade it — for example Instant Swap for cross-chain tokens, Trade for spot and perpetuals, or Stocks for tokenized equities when available.</p>
<p>Figures update from public market data sources. Brief gaps or delays can happen; always confirm the live ticket before signing.</p>`,
      },
      {
        h2: 'From price to trade',
        html: `<p>Use Markets to compare names quickly, then navigate with ordinary links: <a href="/swap">Swap</a>, <a href="/futures">Trade</a>, <a href="/predict">Predictions</a>, <a href="/stocks">Stocks</a>, and <a href="/">Home</a>. The same wallet connection carries across products.</p>`,
      },
      {
        h2: 'Accuracy and risk notes',
        html: `<p>GROM does not claim exclusive data or guaranteed uptime for every feed. Charts and tables are informational. Trading decisions remain yours; fees and risks are disclosed on each product ticket.</p>`,
      },
    ],
    faq: [
      {
        q: 'Does Markets execute trades?',
        a: 'Markets is for discovery. Execution happens on Swap, Trade, Predictions, or Stocks after you confirm in your wallet.',
      },
      {
        q: 'Are prices real-time?',
        a: 'They aim to be near real-time from connected feeds, but can lag or miss updates. Verify on the order ticket.',
      },
      {
        q: 'Which products can I open from here?',
        a: 'Depending on the asset: Swap, spot/perps Trade, Predictions, or tokenized Stocks.',
      },
      {
        q: 'Is market data custodial?',
        a: 'No. Viewing prices does not move funds. Only wallet signatures move assets.',
      },
    ],
  },
};

export function wordCount(html) {
  const text = String(html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return text ? text.split(' ').length : 0;
}

import { getSeoCopy, localizedNavHtml } from './seo-copy-localized.mjs';
import { SEO_LOCALES, languageSwitcherHtml } from './seo-locales.mjs';

export function buildRouteArticleHtml(routeKey, localeCode = 'en', productPath = '/') {
  const localized = getSeoCopy(localeCode, routeKey);
  const c = localized || SEO_COPY[routeKey];
  if (!c) return '';
  const loc = SEO_LOCALES.find((l) => l.code === localeCode) || SEO_LOCALES[0];
  const aboutPrefix = loc.aboutPrefix || 'About';
  const navHtml = localizedNavHtml(localeCode);
  const langHtml = languageSwitcherHtml(localeCode, productPath);
  const explore = loc.explore || 'Explore GROM';
  const htmlLang = loc.htmlLang || 'en';
  const body = c.sections.map((s) => `<h2>${esc(s.h2)}</h2>\n${s.html}`).join('\n');
  const summary = `${esc(aboutPrefix)} · ${esc(c.appName || 'GROM')}`;
  return `
<section id="gromSeoRouteCopy" class="grom-seo-route" data-seo-route="${esc(routeKey)}" lang="${esc(htmlLang)}">
  <details class="grom-seo-details">
    <summary class="grom-seo-summary">${summary}</summary>
    <article class="grom-seo-article">
      <h1>${esc(c.h1)}</h1>
      <p class="grom-seo-lead">${esc(c.lead)}</p>
      ${body}
      <h2>${esc(explore)}</h2>
      ${navHtml}
      ${langHtml}
      <h2>FAQ</h2>
      ${faqHtml(c.faq)}
    </article>
  </details>
</section>`.trim();
}

export function buildRouteJsonLd(page, localeCode = 'en') {
  const routeKey = page.route;
  const localized = getSeoCopy(localeCode, routeKey);
  const c = localized || SEO_COPY[routeKey];
  if (!c) return '';
  const path = page.path || '/';
  const url = 'https://grom.exchange' + (path === '/' ? '/' : path);
  const webApp = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: c.appName,
    url,
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'Web',
    browserRequirements: 'Requires a Web3 wallet',
    description: c.appDesc,
    inLanguage: localeCode === 'pt-BR' ? 'pt-BR' : localeCode,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      description: 'No GROM account fee; venue and network fees apply per trade',
    },
    publisher: {
      '@type': 'Organization',
      name: 'GROM Exchange',
      url: 'https://grom.exchange/',
    },
  };
  const faq = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    inLanguage: localeCode === 'pt-BR' ? 'pt-BR' : localeCode,
    mainEntity: c.faq.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  };
  return [
    `<script type="application/ld+json" id="gromSeoWebAppLd">${JSON.stringify(webApp)}</script>`,
    `<script type="application/ld+json" id="gromSeoFaqLd">${JSON.stringify(faq)}</script>`,
  ].join('\n');
}

export const SEO_ROUTE_STYLE = `
<style id="gromSeoRouteCss">
  /* Visible to users (collapsed <details>) — avoids Google hidden-text risk while keeping the desk clean. */
  #gromSeoRouteCopy.grom-seo-route{
    position:relative;
    z-index:1;
    max-width:920px;
    margin:28px auto 48px;
    padding:0 16px 24px;
    color:#c5d3e3;
    font-size:15px;
    line-height:1.65;
  }
  #gromSeoRouteCopy[hidden]{display:none!important}
  #gromSeoRouteCopy .grom-seo-details{
    border:1px solid rgba(136,192,208,.16);
    border-radius:14px;
    background:rgba(20,28,40,.55);
    overflow:hidden;
  }
  #gromSeoRouteCopy .grom-seo-summary{
    list-style:none;
    cursor:pointer;
    padding:14px 16px;
    font-size:13px;
    font-weight:750;
    letter-spacing:.02em;
    color:#e7eef8;
    user-select:none;
  }
  #gromSeoRouteCopy .grom-seo-summary::-webkit-details-marker{display:none}
  #gromSeoRouteCopy .grom-seo-summary::after{
    content:"▾";
    float:right;
    opacity:.55;
    font-weight:700;
  }
  #gromSeoRouteCopy .grom-seo-details[open] > .grom-seo-summary::after{content:"▴"}
  #gromSeoRouteCopy .grom-seo-article{padding:4px 16px 18px}
  #gromSeoRouteCopy h1{font-size:1.35rem;line-height:1.25;margin:8px 0 10px;color:#eef5fc;font-weight:800}
  #gromSeoRouteCopy h2{font-size:1.05rem;margin:18px 0 8px;color:#e7eef8;font-weight:750}
  #gromSeoRouteCopy p,#gromSeoRouteCopy li{margin:0 0 12px;color:#9eb0c4}
  #gromSeoRouteCopy .grom-seo-lead{font-size:1rem;color:#b7c7d8!important}
  #gromSeoRouteCopy .grom-seo-nav{display:flex;flex-wrap:wrap;gap:10px 14px;margin:8px 0 16px}
  #gromSeoRouteCopy .grom-seo-nav a{color:#7ec8ff;font-weight:650;text-decoration:underline}
  #gromSeoRouteCopy .grom-seo-langs{display:flex;flex-wrap:wrap;gap:8px 12px;margin:0 0 16px;font-size:12.5px}
  #gromSeoRouteCopy .grom-seo-langs a{color:#9eb0c4;text-decoration:underline}
  #gromSeoRouteCopy .grom-seo-langs a[aria-current="page"]{color:#e7eef8;font-weight:750;text-decoration:none}
  #gromSeoRouteCopy .grom-seo-faq-item{border:1px solid rgba(136,192,208,.16);border-radius:10px;margin:0 0 8px;padding:0 12px;background:rgba(255,255,255,.02)}
  #gromSeoRouteCopy .grom-seo-faq-item summary{cursor:pointer;padding:12px 4px;font-weight:700;color:#dce7f4}
  #gromSeoRouteCopy .grom-seo-faq-item p{padding:0 4px 12px}
  @media(max-width:900px){
    /* Sit at the end of the main scroll, not under the viewport chrome */
    #gromSeoRouteCopy.grom-seo-route{
      margin:48px auto calc(28px + env(safe-area-inset-bottom, 0px));
      padding:0 12px 36px;
    }
    #gromSeoRouteCopy h1{font-size:1.2rem}
  }
  @media(max-width:640px){
    #gromSeoRouteCopy.grom-seo-route{margin-top:40px;padding:0 10px 32px}
  }
</style>`.trim();

export const ORG_JSON_LD = `{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "GROM Exchange",
  "url": "https://grom.exchange/",
  "logo": "https://grom.exchange/assets/grom-logo-icon.png",
  "sameAs": [
    "https://x.com/GromExchange",
    "https://t.me/grom_finence_hub"
  ]
}`;
