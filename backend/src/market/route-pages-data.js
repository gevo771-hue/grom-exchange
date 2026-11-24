/**
 * Swap, bridge and «alternative to …» pages (owner, 24.11: GROM should show up for popular crypto
 * searches — «Swap ETH to SOL», «Bridge USDC Ethereum → Base», «Uniswap alternative»).
 *
 * Every route here had a live cross-chain quote when it was added (24.11), and the GROM swap can
 * pick both sides. Addresses and decimals match the swap's own token lists (grom-wallet.js
 * GW_OC_SWAP / GW_SOL_TOKENS / GW_TRON_TOKENS, grom-swap-networks.js).
 *
 * Plain data, no imports: the frontend build reads it too (links on the crawler /swap page).
 */

const ZERO = '0x0000000000000000000000000000000000000000';

/* kind: address format (evm / solana / tron); l1: Ethereum mainnet; fresh: a newer network many wallets
   do not list yet. */
export const RP_CHAINS = {
  ethereum: { id: 1, name: 'Ethereum', gas: 'ETH', kind: 'evm', l1: true },
  base: { id: 8453, name: 'Base', gas: 'ETH', kind: 'evm' },
  arbitrum: { id: 42161, name: 'Arbitrum', gas: 'ETH', kind: 'evm' },
  optimism: { id: 10, name: 'Optimism', gas: 'ETH', kind: 'evm' },
  linea: { id: 59144, name: 'Linea', gas: 'ETH', kind: 'evm' },
  polygon: { id: 137, name: 'Polygon', gas: 'POL', kind: 'evm' },
  bsc: { id: 56, name: 'BNB Chain', gas: 'BNB', kind: 'evm' },
  solana: { id: 1151111081099710, name: 'Solana', gas: 'SOL', kind: 'solana' },
  tron: { id: 728126428, name: 'TRON', gas: 'TRX', kind: 'tron' },
  monad: { id: 143, name: 'Monad', gas: 'MON', kind: 'evm', fresh: true },
  plasma: { id: 9745, name: 'Plasma', gas: 'XPL', kind: 'evm', fresh: true },
  robinhood: { id: 4663, name: 'Robinhood Chain', gas: 'ETH', kind: 'evm', fresh: true },
  xlayer: { id: 196, name: 'X Layer', gas: 'OKB', kind: 'evm', fresh: true },
};

/* CoinGecko ids for the indicative rate on swap pages. */
export const RP_ASSETS = {
  ETH: { name: 'Ethereum', cg: 'ethereum' },
  SOL: { name: 'Solana', cg: 'solana' },
  BNB: { name: 'BNB', cg: 'binancecoin' },
  USDT: { name: 'Tether USD', cg: 'tether' },
  USDT0: { name: 'USDT0', cg: 'tether' },
  USDC: { name: 'USD Coin', cg: 'usd-coin' },
};

/* `${sym}@${chain}` → [address, decimals] */
export const RP_TOKENS = {
  'ETH@ethereum': [ZERO, 18],
  'ETH@base': [ZERO, 18],
  'ETH@arbitrum': [ZERO, 18],
  'ETH@optimism': [ZERO, 18],
  'ETH@linea': [ZERO, 18],
  'ETH@robinhood': [ZERO, 18],
  'BNB@bsc': [ZERO, 18],
  'SOL@solana': ['So11111111111111111111111111111111111111112', 9],
  'USDC@ethereum': ['0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', 6],
  'USDC@base': ['0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', 6],
  'USDC@arbitrum': ['0xaf88d065e77c8cC2239327C5EDb3A432268e5831', 6],
  'USDC@polygon': ['0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', 6],
  'USDC@solana': ['EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', 6],
  'USDC@monad': ['0x754704Bc059F8C67012fEd69BC8A327a5aafb603', 6],
  'USDC@xlayer': ['0xB6CEceAB302E2E4948951eE7843FC24E92933061', 6],
  'USDT@ethereum': ['0xdAC17F958D2ee523a2206206994597C13D831ec7', 6],
  'USDT@tron': ['TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t', 6],
  'USDT0@plasma': ['0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb', 6],
};

/* a / b: how people search for the pair when the ticker alone is ambiguous (USDT on two networks). */
export const RP_ROUTES = [
  { kind: 'swap', slug: 'eth-to-sol', from: 'ETH@ethereum', to: 'SOL@solana' },
  { kind: 'swap', slug: 'sol-to-eth', from: 'SOL@solana', to: 'ETH@ethereum' },
  { kind: 'swap', slug: 'eth-to-bnb', from: 'ETH@ethereum', to: 'BNB@bsc' },
  { kind: 'swap', slug: 'bnb-to-eth', from: 'BNB@bsc', to: 'ETH@ethereum' },
  { kind: 'swap', slug: 'bnb-to-sol', from: 'BNB@bsc', to: 'SOL@solana' },
  { kind: 'swap', slug: 'eth-to-usdt', from: 'ETH@ethereum', to: 'USDT@ethereum' },
  { kind: 'swap', slug: 'usdt-trc20-to-erc20', from: 'USDT@tron', to: 'USDT@ethereum', a: 'USDT TRC20', b: 'USDT ERC20' },
  { kind: 'swap', slug: 'usdt-erc20-to-trc20', from: 'USDT@ethereum', to: 'USDT@tron', a: 'USDT ERC20', b: 'USDT TRC20' },
  { kind: 'swap', slug: 'sol-to-usdc', from: 'SOL@solana', to: 'USDC@solana' },
  { kind: 'bridge', slug: 'usdc-ethereum-to-base', from: 'USDC@ethereum', to: 'USDC@base' },
  { kind: 'bridge', slug: 'eth-ethereum-to-base', from: 'ETH@ethereum', to: 'ETH@base' },
  { kind: 'bridge', slug: 'eth-ethereum-to-arbitrum', from: 'ETH@ethereum', to: 'ETH@arbitrum' },
  { kind: 'bridge', slug: 'usdc-ethereum-to-arbitrum', from: 'USDC@ethereum', to: 'USDC@arbitrum' },
  { kind: 'bridge', slug: 'eth-ethereum-to-optimism', from: 'ETH@ethereum', to: 'ETH@optimism' },
  { kind: 'bridge', slug: 'usdc-ethereum-to-polygon', from: 'USDC@ethereum', to: 'USDC@polygon' },
  { kind: 'bridge', slug: 'eth-ethereum-to-linea', from: 'ETH@ethereum', to: 'ETH@linea' },
  { kind: 'bridge', slug: 'eth-arbitrum-to-base', from: 'ETH@arbitrum', to: 'ETH@base' },
  { kind: 'bridge', slug: 'usdc-base-to-solana', from: 'USDC@base', to: 'USDC@solana' },
  { kind: 'bridge', slug: 'usdc-ethereum-to-solana', from: 'USDC@ethereum', to: 'USDC@solana' },
  { kind: 'bridge', slug: 'usdc-ethereum-to-monad', from: 'USDC@ethereum', to: 'USDC@monad' },
  { kind: 'bridge', slug: 'usdt-ethereum-to-plasma', from: 'USDT@ethereum', to: 'USDT0@plasma' },
  { kind: 'bridge', slug: 'eth-ethereum-to-robinhood', from: 'ETH@ethereum', to: 'ETH@robinhood' },
  { kind: 'bridge', slug: 'usdc-ethereum-to-xlayer', from: 'USDC@ethereum', to: 'USDC@xlayer' },
];

/* type: dex (own pools), agg (DEX aggregator), sol (Solana aggregator — GROM uses it for Solana swaps),
   cex (custodial exchange). */
export const RP_ALTS = [
  { kind: 'alt', slug: 'uniswap', name: 'Uniswap', type: 'dex' },
  { kind: 'alt', slug: 'pancakeswap', name: 'PancakeSwap', type: 'dex' },
  { kind: 'alt', slug: '1inch', name: '1inch', type: 'agg' },
  { kind: 'alt', slug: 'jupiter', name: 'Jupiter', type: 'sol' },
  { kind: 'alt', slug: 'binance', name: 'Binance', type: 'cex' },
];

/* URL segment per kind: /swap/eth-to-sol, /bridge/usdc-ethereum-to-base, /alternatives/uniswap. */
export const RP_SEGMENT = { swap: 'swap', bridge: 'bridge', alt: 'alternatives' };
export const RP_KIND_BY_SEGMENT = { swap: 'swap', bridge: 'bridge', alternatives: 'alt' };

export const RP_ALL = [...RP_ROUTES, ...RP_ALTS];

export function rpFind(kind, slug) {
  const s = String(slug || '').toLowerCase();
  return RP_ALL.find((r) => r.kind === kind && r.slug === s) || null;
}

/** One side of a route: { key, sym, chain, chainId, chainName, gas, chainKind, address, decimals, assetName }. */
export function rpSide(key) {
  const [sym, chain] = String(key).split('@');
  const c = RP_CHAINS[chain];
  const t = RP_TOKENS[key];
  if (!c || !t) return null;
  return {
    key, sym, chain, chainId: c.id, chainName: c.name, gas: c.gas, chainKind: c.kind,
    l1: !!c.l1, fresh: !!c.fresh, address: t[0], decimals: t[1], assetName: RP_ASSETS[sym]?.name || sym,
  };
}

/** Nav label shared by all languages: «ETH → SOL», «USDC: Ethereum → Base». */
export function rpLabel(r) {
  if (r.kind === 'alt') return r.name;
  const a = rpSide(r.from);
  const b = rpSide(r.to);
  if (r.kind === 'bridge') return `${a.sym}: ${a.chainName} → ${b.chainName}`;
  return `${r.a || a.sym} → ${r.b || b.sym}`;
}
