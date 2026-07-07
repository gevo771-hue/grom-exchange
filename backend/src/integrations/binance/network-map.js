export const BINANCE_NETWORK_MAP = {
  ETH: 'ETH', ERC20: 'ETH', 'ERC-20': 'ETH',
  ARB: 'ARBITRUM', ARBITRUM: 'ARBITRUM',
  OP: 'OPTIMISM', OPTIMISM: 'OPTIMISM',
  MATIC: 'MATIC', POLYGON: 'MATIC',
  BASE: 'BASE',
  BSC: 'BSC', BEP20: 'BSC', 'BEP-20': 'BSC',
  AVAXC: 'AVAXC', AVAX: 'AVAXC', AVALANCHE: 'AVAXC',
  LINEA: 'LINEA',
  TRON: 'TRX', TRX: 'TRX', TRC20: 'TRX', 'TRC-20': 'TRX',
  BTC: 'BTC', BITCOIN: 'BTC',
  SOL: 'SOL', SOLANA: 'SOL',
  TON: 'TON', TONCOIN: 'TON',
  XRP: 'XRP',
};

export function toBinanceNetwork(network) {
  return BINANCE_NETWORK_MAP[String(network || '').toUpperCase()] || null;
}

/* Rich network metadata for Binance-style deposit UI.
 * Cursor renders cards from this; iconUrl lets him use unified iconography.
 * Numbers are conservative defaults; will be replaced with live Binance API
 * data (/sapi/v1/capital/config/getall) when BINANCE_HOT_WALLET=true. */
const NETWORK_META = {
  ETH:      { label: 'Ethereum (ERC-20)',  feeEst: 3.0, etaMin: 5,  conf: 12,  iconKey: 'eth' },
  ARBITRUM: { label: 'Arbitrum One',       feeEst: 0.1, etaMin: 3,  conf: 12,  iconKey: 'arb' },
  OPTIMISM: { label: 'Optimism',           feeEst: 0.1, etaMin: 3,  conf: 12,  iconKey: 'op'  },
  MATIC:    { label: 'Polygon (PoS)',      feeEst: 0.05,etaMin: 5,  conf: 128, iconKey: 'matic' },
  BASE:     { label: 'Base',               feeEst: 0.05,etaMin: 3,  conf: 12,  iconKey: 'eth' },
  BSC:      { label: 'BNB Chain (BEP-20)', feeEst: 0.3, etaMin: 3,  conf: 15,  iconKey: 'bnb' },
  AVAXC:    { label: 'Avalanche C-Chain',  feeEst: 0.5, etaMin: 2,  conf: 12,  iconKey: 'avax' },
  LINEA:    { label: 'Linea',              feeEst: 0.05,etaMin: 5,  conf: 12,  iconKey: 'eth' },
  TRON:     { label: 'Tron (TRC-20)',      feeEst: 1.0, etaMin: 3,  conf: 20,  iconKey: 'trx' },
  BTC:      { label: 'Bitcoin',            feeEst: 2.0, etaMin: 30, conf: 3,   iconKey: 'btc' },
  SOL:      { label: 'Solana',             feeEst: 0.01,etaMin: 1,  conf: 1,   iconKey: 'sol' },
  TON:      { label: 'The Open Network',   feeEst: 0.1, etaMin: 1,  conf: 1,   iconKey: 'ton', memo: true },
  XRP:      { label: 'XRP Ledger',         feeEst: 0.5, etaMin: 1,  conf: 1,   iconKey: 'xrp', memo: true },
};

const ASSET_META = {
  USDT: { label: 'Tether',     iconKey: 'usdt' },
  USDC: { label: 'USD Coin',   iconKey: 'usdc' },
  BTC:  { label: 'Bitcoin',    iconKey: 'btc'  },
  ETH:  { label: 'Ethereum',   iconKey: 'eth'  },
  SOL:  { label: 'Solana',     iconKey: 'sol'  },
  BNB:  { label: 'BNB',        iconKey: 'bnb'  },
  TRX:  { label: 'Tron',       iconKey: 'trx'  },
  MATIC:{ label: 'Polygon',    iconKey: 'matic'},
  AVAX: { label: 'Avalanche',  iconKey: 'avax' },
  TON:  { label: 'Toncoin',    iconKey: 'ton'  },
  XRP:  { label: 'XRP',        iconKey: 'xrp'  },
};

const MIN_DEPOSIT = {
  USDT: 1, USDC: 1, BTC: 0.0001, ETH: 0.001, SOL: 0.01, BNB: 0.001,
  TRX: 1, MATIC: 1, AVAX: 0.01, TON: 0.1, XRP: 1,
};

const ICON_BASE = 'https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63530be6e374711a8554f31b17e4cb92c25fa5/svg/color';

const iconUrl = (key) => key ? `${ICON_BASE}/${key}.svg` : null;

const ASSETS_BY_NETWORK = {
  ETH:      ['USDT','USDC','ETH'],
  ARBITRUM: ['USDT','USDC','ETH'],
  OPTIMISM: ['USDT','USDC','ETH'],
  MATIC:    ['USDT','USDC','MATIC'],
  BASE:     ['USDC','ETH'],
  BSC:      ['USDT','USDC','BNB','BTC','ETH','SOL','MATIC','AVAX','TON','XRP'],
  AVAXC:    ['USDT','USDC','AVAX'],
  LINEA:    ['USDC','ETH'],
  TRON:      ['USDT','TRX'],
  BTC:      ['BTC'],
  SOL:      ['USDT','USDC','SOL'],
  TON:      ['TON','USDT'],
  XRP:      ['XRP'],
};

export function supportedBinanceNetworkPairs() {
  const out = [];
  for (const [network, assets] of Object.entries(ASSETS_BY_NETWORK)) {
    const meta = NETWORK_META[network];
    if (!meta) continue;
    for (const asset of assets) {
      const am = ASSET_META[asset] || {};
      out.push({
        asset,
        assetLabel: am.label || asset,
        assetIcon: iconUrl(am.iconKey),
        network,
        networkLabel: meta.label,
        networkIcon: iconUrl(meta.iconKey),
        binanceNetwork: toBinanceNetwork(network),
        minDeposit: MIN_DEPOSIT[asset] ?? 1,
        confirmations: meta.conf,
        feeEstimateUsd: meta.feeEst,
        etaMinutes: meta.etaMin,
        memoRequired: !!meta.memo,
      });
    }
  }
  return out;
}

/* Helper for Cursor's coin-list view: returns deduped list of all supported
 * assets across all networks, with per-asset network counts. */
export function supportedAssets() {
  const map = new Map();
  for (const pair of supportedBinanceNetworkPairs()) {
    const cur = map.get(pair.asset) || { asset: pair.asset, label: pair.assetLabel, icon: pair.assetIcon, networks: 0 };
    cur.networks += 1;
    map.set(pair.asset, cur);
  }
  return Array.from(map.values()).sort((a, b) => b.networks - a.networks || a.asset.localeCompare(b.asset));
}
