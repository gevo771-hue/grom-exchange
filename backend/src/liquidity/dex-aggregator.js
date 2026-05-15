/**
 * DEX aggregator — returns best-quote swap for non-custodial "Convert" function.
 * Queries 1inch and Odos in parallel, returns best.
 *
 * NOTE: For production, also consider `Jupiter` for Solana and `LI.FI` for cross-chain.
 */
import axios from 'axios';
import config from '../config/index.js';
import logger from '../utils/logger.js';

const ONEINCH_V6 = (chainId) => `https://api.1inch.dev/swap/v6.0/${chainId}/quote`;
const ODOS_QUOTE = () => `${config.liquidity.odosUrl}/sor/quote/v2`;

export class DexAggregator {
  constructor() {
    this.oneinchHeaders = config.liquidity.oneinchKey
      ? { Authorization: `Bearer ${config.liquidity.oneinchKey}` }
      : {};
  }

  /** @param params {chainId, src, dst, amount, userAddress?} */
  async quote(params) {
    const [oneinch, odos] = await Promise.allSettled([
      this._oneinch(params),
      this._odos(params),
    ]);
    const candidates = [];
    if (oneinch.status === 'fulfilled' && oneinch.value) candidates.push(oneinch.value);
    if (odos.status    === 'fulfilled' && odos.value)    candidates.push(odos.value);
    if (candidates.length === 0) throw new Error('No DEX quotes');
    candidates.sort((a, b) => Number(b.toAmount) - Number(a.toAmount));
    return { best: candidates[0], all: candidates };
  }

  async _oneinch({ chainId, src, dst, amount }) {
    try {
      const { data } = await axios.get(ONEINCH_V6(chainId), {
        params: { src, dst, amount },
        headers: this.oneinchHeaders,
        timeout: 5000,
      });
      return {
        source: '1inch',
        toAmount: data.toAmount,
        estimatedGas: data.estimatedGas,
        protocols: data.protocols,
      };
    } catch (err) {
      logger.warn({ err: err.message }, '1inch quote failed');
      return null;
    }
  }

  async _odos({ chainId, src, dst, amount, userAddress }) {
    try {
      const { data } = await axios.post(ODOS_QUOTE(), {
        chainId,
        inputTokens:  [{ tokenAddress: src, amount: String(amount) }],
        outputTokens: [{ tokenAddress: dst, proportion: 1 }],
        userAddr: userAddress || '0x0000000000000000000000000000000000000000',
        slippageLimitPercent: 0.5,
      }, { timeout: 5000 });
      return {
        source: 'odos',
        toAmount: data.outAmounts?.[0],
        estimatedGas: data.gasEstimate,
        pathId: data.pathId,
      };
    } catch (err) {
      logger.warn({ err: err.message }, 'odos quote failed');
      return null;
    }
  }
}

export default DexAggregator;
