export const BINANCE_NETWORK_MAP = {
  ETH: 'ETH',
  ERC20: 'ETH',
  ARB: 'ARBITRUM',
  ARBITRUM: 'ARBITRUM',
  MATIC: 'MATIC',
  POLYGON: 'MATIC',
  BASE: 'BASE',
  BSC: 'BSC',
  BEP20: 'BSC',
  TRON: 'TRX',
  TRX: 'TRX',
  TRC20: 'TRX',
  'TRC-20': 'TRX',
  BTC: 'BTC',
  BITCOIN: 'BTC',
  SOL: 'SOL',
  SOLANA: 'SOL',
};

export function toBinanceNetwork(network) {
  return BINANCE_NETWORK_MAP[String(network || '').toUpperCase()] || null;
}

export function supportedBinanceNetworkPairs() {
  const networks = ['ETH', 'ARB', 'MATIC', 'BASE', 'BSC', 'TRON', 'BTC', 'SOL'];
  const assetsByNetwork = {
    ETH: ['USDT', 'USDC', 'ETH'],
    ARB: ['USDT', 'USDC', 'ETH'],
    MATIC: ['USDT', 'USDC', 'MATIC'],
    BASE: ['USDT', 'USDC', 'ETH'],
    BSC: ['USDT', 'USDC', 'BNB'],
    TRON: ['USDT', 'TRX'],
    BTC: ['BTC'],
    SOL: ['USDT', 'USDC', 'SOL'],
  };
  return networks.flatMap((network) => assetsByNetwork[network].map((asset) => ({
    asset,
    network,
    binanceNetwork: toBinanceNetwork(network),
  })));
}
