import { Router } from 'express';
import { fetchLifiOcQuote } from '../liquidity/lifi-proxy.js';

const ADDRESS = /^0x[0-9a-f]{40}$/i;
const CHAIN = /^[1-9]\d{0,14}$/;
const invalid = () => Object.assign(new Error('Invalid Earn request'), { status: 400 });
const unavailable = () => Object.assign(new Error('Earn data unavailable'), { status: 503 });
function requireAsset(chain, address) {
  if (!CHAIN.test(String(chain)) || !ADDRESS.test(address)) throw invalid();
}
function filters(input) {
  const params = new URLSearchParams({ isTransactional: 'true', limit: '24' });
  const rules = {
    chainId: CHAIN,
    protocol: /^[\w.-]{1,80}$/,
    asset: /^[\w.-]{1,50}$/,
    sortBy: /^(tvl|apy)$/,
    cursor: /^[\w:./+%=-]{1,400}$/,
  };
  for (const [key, value] of Object.entries(input)) {
    if (typeof value !== 'string' || !Object.hasOwn(rules, key) || !rules[key].test(value)) throw invalid();
    params.set(key, value);
  }
  if (!params.has('sortBy')) params.set('sortBy', 'tvl');
  return params;
}
export function earnFeeConfirmed(result, inputAddress) {
  const amount = String(result?.context?.fromAmount || '');
  if (!/^\d+$/.test(amount)) return false;
  const expected = (BigInt(amount) * 20n) / 10000n;
  if (!expected) return false;
  const fees = result.lifi?.estimate?.feeCosts || [];
  const collected = fees
    .flatMap((fee) =>
      fee.token?.address?.toLowerCase() === inputAddress.toLowerCase()
        ? (fee.feeSplit?.recipients || []).filter((recipient) => recipient.name === 'grom-exchange')
        : []
    )
    .reduce((sum, r) => (/^\d+$/.test(r.fee) ? sum + BigInt(r.fee) : sum), 0n);
  return collected === expected;
}
export function createEarnRouter({ apiKey, fetchImpl = fetch, quote = fetchLifiOcQuote }) {
  const router = Router();
  const cache = new Map();
  const inflight = new Map();
  async function get(url, cacheable = true) {
    if (!apiKey) throw unavailable();
    const cached = cacheable && cache.get(url);
    if (cached && cached.until > Date.now()) return cached.value;
    if (cacheable && inflight.has(url)) return inflight.get(url);
    const request = (async () => {
      let response;
      try {
        response = await fetchImpl(url, {
          headers: { 'x-lifi-api-key': apiKey },
          redirect: 'error',
          signal: AbortSignal.timeout(cacheable ? 10000 : 30000),
        });
      } catch {
        throw unavailable();
      }
      if (!response.ok)
        throw Object.assign(unavailable(), {
          status: [404, 429].includes(response.status) ? response.status : 503,
        });
      const value = await response.json();
      if (cacheable) {
        if (cache.size >= 256) cache.delete(cache.keys().next().value);
        cache.set(url, { until: Date.now() + 60000, value });
      }
      return value;
    })();
    if (cacheable) inflight.set(url, request);
    try {
      return await request;
    } finally {
      if (cacheable) inflight.delete(url);
    }
  }
  const earn = (path) => 'https://earn.li.fi/v1/' + path;
  async function vault(chain, address) {
    requireAsset(chain, address);
    const item = await get(earn('vaults/' + chain + '/' + address.toLowerCase()));
    if (item.chainId !== Number(chain) || item.address?.toLowerCase() !== address.toLowerCase())
      throw unavailable();
    return item;
  }
  async function token(chain, address) {
    requireAsset(chain, address);
    const item = await get(
      'https://li.quest/v1/token?' + new URLSearchParams({ chain, token: address.toLowerCase() })
    );
    if (
      item.chainId !== Number(chain) ||
      item.address?.toLowerCase() !== address.toLowerCase() ||
      !Number.isInteger(item.decimals) ||
      item.decimals < 0 ||
      item.decimals > 36 ||
      !item.symbol
    )
      throw unavailable();
    return { address: item.address, chainId: item.chainId, symbol: item.symbol, decimals: item.decimals };
  }
  const route = (handler) => async (req, res) => {
    try {
      res.json(await handler(req));
    } catch (error) {
      const status = [400, 404, 409, 422, 429, 502, 503, 504].includes(error.status) ? error.status : 503;
      if (status === 429) res.set('Retry-After', '10');
      res
        .status(status)
        .json({
          error:
            status === 400
              ? 'Invalid Earn request'
              : status === 404
                ? 'Vault, asset or route not found'
                : 'Earn request unavailable',
        });
    }
  };
  router.get(
    '/filters',
    route(async () => {
      const [chains, protocols] = await Promise.all([get(earn('chains')), get(earn('protocols'))]);
      if (!Array.isArray(chains) || !Array.isArray(protocols)) throw unavailable();
      return {
        chains: chains.map(({ chainId, name }) => ({ chainId, name })),
        protocols: protocols.map(({ id, name }) => ({ id: id || name, name })),
      };
    })
  );
  router.get(
    '/vaults',
    route(async (req) => {
      const result = await get(earn('vaults?' + filters(req.query)));
      if (!Array.isArray(result.data)) throw unavailable();
      return {
        data: result.data.filter(
          (v) => v.isTransactional === true && v.chainId > 0 && ADDRESS.test(v.address)
        ),
        nextCursor: result.nextCursor || null,
      };
    })
  );
  router.get(
    '/vaults/:chain/:address',
    route((req) => vault(req.params.chain, req.params.address))
  );
  router.get(
    '/tokens/:chain/:address',
    route((req) => token(req.params.chain, req.params.address))
  );
  router.get(
    '/portfolio/:address/positions',
    (req, res, next) => {
      res.set('Cache-Control', 'private, no-store');
      next();
    },
    route(async (req) => {
      if (!ADDRESS.test(req.params.address)) throw invalid();
      const params = new URLSearchParams({ limit: '50' });
      if (req.query.cursor !== undefined) {
        if (typeof req.query.cursor !== 'string' || !/^[\w:./+%=-]{1,400}$/.test(req.query.cursor))
          throw invalid();
        params.set('cursor', req.query.cursor);
      }
      const result = await get(
        earn('portfolio/' + req.params.address.toLowerCase() + '/positions?' + params),
        false
      );
      const positions = result.data ?? result.positions;
      if (!Array.isArray(positions)) throw unavailable();
      return { positions, nextCursor: result.nextCursor || null };
    })
  );
  router.post(
    '/quote',
    route(async ({ body }) => {
      const { side, chain, address, payChain, payToken, account, amount } = body || {};
      if (
        !['deposit', 'withdraw'].includes(side) ||
        !ADDRESS.test(account) ||
        !/^\d{1,40}(\.\d{1,36})?$/.test(amount) ||
        typeof amount !== 'string'
      )
        throw invalid();
      const selected = await vault(chain, address);
      const withdraw = side === 'withdraw';
      if (withdraw ? !selected.isRedeemable : !selected.isTransactional) throw invalid();
      if (
        withdraw &&
        (Number(payChain) !== selected.chainId ||
          !selected.underlyingTokens?.some(
            (t) => t.address?.toLowerCase() === String(payToken).toLowerCase()
          ))
      )
        throw invalid();
      const [shares, other] = await Promise.all([token(chain, address), token(payChain, payToken)]);
      const [input, output] = withdraw ? [shares, other] : [other, shares];
      if (input.chainId === output.chainId && input.address.toLowerCase() === output.address.toLowerCase())
        throw invalid();
      const result = await quote(
        {
          fromChainId: input.chainId,
          toChainId: output.chainId,
          fromToken: input.address,
          toToken: output.address,
          fromSym: input.symbol,
          toSym: output.symbol,
          fromDecimals: input.decimals,
          amountStr: amount,
          fromAddress: account,
          toAddress: account,
          slippage: '0.005',
        },
        { readCache: async () => null, writeCache: async () => {} }
      );
      if (
        result.stale ||
        result.context?.informative ||
        Number(result.context?.fee) !== 0.002 ||
        !ADDRESS.test(result.context?.feeAddress) ||
        !result.lifi?.transactionRequest?.data ||
        !earnFeeConfirmed(result, input.address)
      )
        throw unavailable();
      return { lifi: result.lifi, expiresAt: result.expiresAt, input, output, feeBps: 20 };
    })
  );
  return router;
}
