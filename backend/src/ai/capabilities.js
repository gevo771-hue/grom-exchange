/**
 * Capability manifest — four live GROM products (from real integrations).
 * Do not invent products (no grid bot, no guaranteed yield).
 */
export const AI_PROMPT_VERSION = 'grom-ai-v2.2026-09-15';

export const CAPABILITIES = {
  version: AI_PROMPT_VERSION,
  products: {
    swap: {
      id: 'swap',
      label: 'DEX Instant Swap',
      available: true,
      guest: { guide: true, navigate: true, generativeChat: 'limited' },
      auth: { portfolio: true, prepareAction: true },
      rails: ['lifi', 'paraswap', 'kyber', 'odos', 'cow', 'jupiter'],
      actions: ['navigate', 'swap.buy', 'advise'],
      notes: 'Meta-aggregator. Quote + wallet signature required. No custody autopilot.',
    },
    perps: {
      id: 'perps',
      label: 'Perpetual futures',
      available: true,
      guest: { guide: true, navigate: true, generativeChat: 'limited' },
      auth: { portfolio: true, prepareAction: true },
      rails: ['hyperliquid'],
      actions: ['navigate', 'futures.open', 'futures.close', 'advise'],
      notes: 'HL builder. Leverage magnifies loss; liquidation possible. Form prep ≠ open position.',
    },
    predict: {
      id: 'predict',
      label: 'Prediction markets',
      available: true,
      guest: { guide: true, navigate: true, generativeChat: 'limited' },
      auth: { portfolio: true, prepareAction: true },
      rails: ['polymarket_style_ui'],
      actions: ['navigate', 'predict.bet', 'advise'],
      feeSource: 'window.GROM_FEES.predictTaker / server fee config',
      notes: 'Polygon USDC typical. Probability ≠ guarantee. Need concrete market/outcome to bet.',
    },
    stocks: {
      id: 'stocks',
      label: 'Tokenized stocks (xStocks / RWA)',
      available: true,
      guest: { guide: true, navigate: true, generativeChat: 'limited' },
      auth: { portfolio: true, prepareAction: true },
      rails: ['jupiter_solana', 'evm_meta_agg'],
      actions: ['navigate', 'xstocks.buy', 'xstocks.sell', 'advise'],
      notes: 'Tokenized exposure ≠ identical legal rights to equity. Check issuer terms.',
    },
  },
  unavailable: {
    gridBot: false,
    custodialAutopilot: false,
    guaranteedReturns: false,
    robinhoodBook: false,
  },
  guestGenerative: {
    enabled: true,
    note: 'Guest coach allowed with rate limits; address in body is NOT authentication. Portfolio requires JWT.',
  },
};

export function capabilitiesForPrompt() {
  return {
    version: CAPABILITIES.version,
    products: Object.fromEntries(
      Object.entries(CAPABILITIES.products).map(([k, v]) => [k, {
        available: v.available,
        actions: v.actions,
        notes: v.notes,
      }])
    ),
    unavailable: CAPABILITIES.unavailable,
  };
}

export default CAPABILITIES;
