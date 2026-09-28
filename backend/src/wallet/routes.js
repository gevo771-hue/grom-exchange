import express from 'express';
import rateLimit from 'express-rate-limit';
import config from '../config/index.js';
import { query } from '../db/pool.js';
import { logUserActivity } from '../activity/log.js';
import {
  JUP_MINT_RE,
  jupFeeBpsFromConfig,
  jupFeeModeFromConfig,
  jupiterEnabled,
  resolveJupFeeAccount,
  assertJupPlatformFee,
  attachJupQuoteMeta,
} from './jup-fee.js';

function toNum(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}



function formatHistoryTime(value) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));
}

function explorerForTx(chainHint, txHash) {
  if (!txHash) return '';
  const h = String(txHash);
  const c = String(chainHint || '').toLowerCase();
  if (c === '42161' || c === 'arb' || c.includes('arbitrum')) return `https://arbiscan.io/tx/${h}`;
  if (c === '8453' || c === 'base') return `https://basescan.org/tx/${h}`;
  if (c === '137' || c === 'matic' || c.includes('polygon')) return `https://polygonscan.com/tx/${h}`;
  if (c === '56' || c === 'bsc' || c.includes('bnb')) return `https://bscscan.com/tx/${h}`;
  if (c === '10' || c === 'op' || c.includes('optimism')) return `https://optimistic.etherscan.io/tx/${h}`;
  if (c === '43114' || c === 'avax' || c.includes('avalanche')) return `https://snowtrace.io/tx/${h}`;
  if (c === '1' || c === 'eth' || c.includes('ethereum')) return `https://etherscan.io/tx/${h}`;
  return `https://etherscan.io/tx/${h}`;
}

/** History from on-chain/user_activity only — no custodial ledger. */
export function buildHistoryItems({ transfers = [], spotOrders = [], swapActivity = [] } = {}) {
  const items = [];
  for (const row of (swapActivity || [])) {
    const d = row.detail && typeof row.detail === 'object' ? row.detail : {};
    const product = String(row.product || 'swap');
    const from = d.from || d.fromSym || row.asset || '?';
    const to = d.to || d.toSym || '';
    const amt = row.amount != null ? toNum(row.amount) : null;
    const chain = d.chain || d.fromChainId || d.chainId || '';
    const kind = product === 'futures' ? 'futures' : (product === 'spot' ? 'spot' : 'swap');
    const labelCore = to
      ? `${amt != null ? amt : ''} ${from} → ${to}`.replace(/\s+/g, ' ').trim()
      : `${row.action || product} · ${from}`;
    items.push({
      kind,
      occurredAt: row.created_at,
      assetLabel: `${kind === 'futures' ? 'Perp' : kind === 'spot' ? 'Spot' : 'Swap'} · ${labelCore}`,
      stakeLabel: amt != null ? `${amt} ${from}` : '—',
      resultLabel: row.status || row.action || 'filled',
      pnl: null,
      statusTone: /fail|reject|cancel|error/i.test(String(row.status || row.action || '')) ? 'loss' : 'win',
      directionTone: /sell|short|down/i.test(String(row.action || '')) ? 'down' : 'up',
      timeLabel: formatHistoryTime(row.created_at),
      explorerUrl: explorerForTx(chain, row.tx_hash),
      txHash: row.tx_hash || null,
      wallet: String(row.wallet_address || '').toLowerCase() || null,
      wallet_address: String(row.wallet_address || '').toLowerCase() || null,
      _ts: row.created_at ? new Date(row.created_at).getTime() : 0,
      _hash: row.tx_hash || null,
    });
  }
  void transfers; void spotOrders;
  return items.sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt));
}

export function createWalletRouter({ requireAuth, priceAggregator: _priceAggregator, wsBroadcaster: _wsBroadcaster = null }) {
  const r = express.Router();

  /** Wallet connect — creates user row before SIWE (visible in admin). */
  r.post('/wallet/connect', rateLimit({ windowMs: 60_000, max: 30 }), async (req, res, next) => {
    try {
      const address = String(req.body?.address || '').toLowerCase();
      const chainId = parseInt(req.body?.chain_id || req.body?.chainId || '1', 10);
      if (!/^0x[a-f0-9]{40}$/.test(address)) {
        return res.status(400).json({ error: 'bad_address' });
      }
      const prev = await query('SELECT id FROM users WHERE wallet_address=$1', [address]);
      const isNew = prev.rowCount === 0;
      const { rows } = await query(
        `INSERT INTO users (wallet_address, chain_id, last_seen_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (wallet_address) DO UPDATE
           SET last_seen_at = NOW(), chain_id = EXCLUDED.chain_id
         RETURNING id, wallet_address, chain_id, created_at, last_seen_at`,
        [address, chainId]
      );
      const user = rows[0];
      await logUserActivity({
        userId: user.id,
        wallet: address,
        product: 'auth',
        action: isNew ? 'register' : 'connect',
        detail: { chain_id: chainId, method: 'wallet_connect' },
        status: 'done',
      });
      res.json({ user, isNew });
    } catch (err) { next(err); }
  });

  /**
   * Public Tron account proxy — browser → TronGrid often blocked / rate-limited
   * on mobile Safari. Uses TRON_API_KEY when set; falls back to publicnode
   * getaccount + TRC-20 balanceOf so Instant Swap still shows USDT.
   * GET /api/wallet/tron-account?address=T…
   */
  const tronAccountCache = new Map(); // address → { at, body }
  const TRON_ACCOUNT_TTL_MS = 45_000;
  const TRON_PUBLIC_HOSTS = [
    'https://tron-rpc.publicnode.com',
    'https://api.trongrid.io',
  ];

  async function tronPostJson(host, path, body, headers = {}) {
    const res = await fetch(`${String(host).replace(/\/$/, '')}${path}`, {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(12000),
    });
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch (_) { json = { raw: text }; }
    return { ok: res.ok, status: res.status, json };
  }

  /** Base58Check → 32-byte ABI parameter for balanceOf(address).
   * publicnode validateaddress often returns no hexAddress — local decode is required. */
  function tronBase58ToParameter(base58) {
    const ALPH = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    try {
      let num = 0n;
      for (const c of String(base58 || '')) {
        const i = ALPH.indexOf(c);
        if (i < 0) return '';
        num = num * 58n + BigInt(i);
      }
      let hex = num.toString(16);
      if (hex.length % 2) hex = '0' + hex;
      let leading = 0;
      for (const c of String(base58 || '')) {
        if (c === '1') leading += 1;
        else break;
      }
      const bytes = Buffer.concat([Buffer.alloc(leading), Buffer.from(hex, 'hex')]);
      if (bytes.length < 25) return '';
      const payload = bytes.subarray(0, bytes.length - 4); // drop checksum
      if (payload.length !== 21 || payload[0] !== 0x41) return '';
      return Buffer.from(payload.subarray(1)).toString('hex').padStart(64, '0');
    } catch (_) {
      return '';
    }
  }

  async function tronHexPayload(host, base58, headers = {}) {
    const local = tronBase58ToParameter(base58);
    if (local) return local;
    try {
      const { json } = await tronPostJson(host, '/wallet/validateaddress', {
        address: base58,
        visible: true,
      }, headers);
      const hx = String(json?.hexAddress || '').replace(/^0x/i, '');
      if (/^41[a-fA-F0-9]{40}$/.test(hx)) {
        return hx.slice(2).toLowerCase().padStart(64, '0');
      }
    } catch (_) {}
    return '';
  }

  async function tronTrc20Balance(host, owner, contract, headers = {}) {
    const parameter = await tronHexPayload(host, owner, headers);
    if (!parameter) return null;
    const { json } = await tronPostJson(host, '/wallet/triggerconstantcontract', {
      owner_address: owner,
      contract_address: contract,
      function_selector: 'balanceOf(address)',
      parameter,
      visible: true,
    }, headers);
    const raw = json?.constant_result?.[0];
    if (!raw) return null;
    try { return BigInt('0x' + String(raw).replace(/^0x/i, '')).toString(); }
    catch (_) { return null; }
  }

  async function tronAccountViaFullNode(address, headers = {}) {
    const tronCfg = config.signers?.tron || config.tron || {};
    // Curated Instant Swap / Wallet TRC-20 set — must match frontend GW_TRON_TOKENS.
    // Older path only queried USDT/USDC, so Wallet page looked empty for SUN/NFT/…
    const contracts = {
      USDT: tronCfg.contracts?.USDT || tronCfg.usdtContract || 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
      USDC: tronCfg.contracts?.USDC || process.env.USDC_TRON_CONTRACT || 'TEkxiTehnzSmSe2XqrBj4w32RUN966rdz8',
      USDD: tronCfg.contracts?.USDD || 'TPYmHEhy5n8TCEfYGqW2rPxsghSfzghPDn',
      TUSD: tronCfg.contracts?.TUSD || 'TUpMhErZL2fhh4sVNULAbNKLokS4GjC1F4',
      USDJ: tronCfg.contracts?.USDJ || 'TMwFHYXLJaRUPeW6421aqXL4ZEzPRFGkGT',
      SUN:  tronCfg.contracts?.SUN  || 'TSSMHYeV2uE9qYH95DqyoCuNCzEL1NvU3S',
      BTT:  tronCfg.contracts?.BTT  || 'TAFjULxiVgT4qWk6UZwjqwZXTSaGaqnVp4',
      JST:  tronCfg.contracts?.JST  || 'TCFLL5dx5ZJdKnWuesXxi1VPwjLVmWZZy9',
      WIN:  tronCfg.contracts?.WIN  || 'TLa2f6VPqDgRE67v1736s7bJ8Ray5wYjU7',
      NFT:  tronCfg.contracts?.NFT  || 'TFczxzPhnThNSqr5by8tvxsdCFRRz6cPNq',
      HTX:  tronCfg.contracts?.HTX  || 'TUPM7K8REVzD2UdV4R5fe5M8XbnR2DdoJ6',
    };
    let lastErr = '';
    for (const host of TRON_PUBLIC_HOSTS) {
      try {
        const accRes = await tronPostJson(host, '/wallet/getaccount', {
          address,
          visible: true,
        }, headers);
        if (accRes.json?.Error || accRes.json?.error) {
          lastErr = String(accRes.json.Error || accRes.json.error);
          continue;
        }
        const acc = accRes.json && (accRes.json.address || accRes.json.balance != null)
          ? accRes.json
          : null;
        if (!acc) {
          lastErr = 'empty_account';
          continue;
        }
        const trc20 = [];
        // Parallel balanceOf — sequential was too slow and easy to abort mid-list.
        const entries = Object.entries(contracts).filter(([, c]) => c && /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(c));
        const bals = await Promise.all(entries.map(async ([, contract]) => {
          try {
            const bal = await tronTrc20Balance(host, address, contract, headers);
            return bal != null && bal !== '0' ? { [contract]: bal } : null;
          } catch (_) {
            return null;
          }
        }));
        for (const row of bals) {
          if (row) trc20.push(row);
        }
        return {
          data: [{
            address,
            balance: Number(acc.balance || 0),
            trc20,
            create_time: acc.create_time,
            latest_opration_time: acc.latest_opration_time,
          }],
          success: true,
          meta: { source: host.replace(/^https?:\/\//, ''), mode: 'fullnode' },
        };
      } catch (e) {
        lastErr = String(e?.message || e);
      }
    }
    throw new Error(lastErr || 'tron_fullnode_failed');
  }

  r.get('/wallet/tron-account', async (req, res) => {
    try {
      const address = String(req.query.address || '').trim();
      if (!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address)) {
        return res.status(400).json({ error: 'invalid_tron_address' });
      }

      const cached = tronAccountCache.get(address);
      if (cached && (Date.now() - cached.at) < TRON_ACCOUNT_TTL_MS) {
        return res.json(cached.body);
      }

      const tronCfg = config.signers?.tron || config.tron || {};
      const host = tronCfg.fullHost || process.env.TRON_FULL_HOST || 'https://api.trongrid.io';
      const key = tronCfg.apiKey
        || process.env.TRON_API_KEY
        || process.env.TRONGRID_API_KEY
        || '';
      const headers = { accept: 'application/json' };
      if (key) headers['TRON-PRO-API-KEY'] = key;

      let body = null;
      let rateLimited = false;

      try {
        const url = `${String(host).replace(/\/$/, '')}/v1/accounts/${encodeURIComponent(address)}`;
        const upstream = await fetch(url, { headers, signal: AbortSignal.timeout(12000) });
        const text = await upstream.text();
        let parsed;
        try { parsed = JSON.parse(text); } catch (_) { parsed = { raw: text }; }
        if (parsed && typeof parsed === 'object' && (parsed.Error || parsed.error) && !parsed.data) {
          const msg = String(parsed.Error || parsed.error || '');
          rateLimited = /rate|exceeded|quota|suspended/i.test(msg);
        } else if (upstream.ok && Array.isArray(parsed?.data)) {
          body = parsed;
        } else if (!upstream.ok) {
          rateLimited = upstream.status === 429;
        }
      } catch (_) {
        /* fall through to fullnode */
      }

      if (!body) {
        try {
          body = await tronAccountViaFullNode(address, key ? { 'TRON-PRO-API-KEY': key } : {});
        } catch (e) {
          return res.status(rateLimited ? 429 : 502).json({
            error: 'tron_upstream',
            message: String(e?.message || e),
            authenticated: !!key,
          });
        }
      }

      // Never cache empty TRC-20 fullnode payloads — they used to stick for 45s
      // and made Wallet look broke after a TronGrid blip (SUN/USDT → $0).
      const trc20n = Array.isArray(body?.data?.[0]?.trc20) ? body.data[0].trc20.length : 0;
      const isSparseFullnode = body?.meta?.mode === 'fullnode' && trc20n === 0;
      if (!isSparseFullnode) {
        tronAccountCache.set(address, { at: Date.now(), body });
        if (tronAccountCache.size > 500) {
          const oldest = tronAccountCache.keys().next().value;
          tronAccountCache.delete(oldest);
        }
      }
      res.json(body);
    } catch (err) {
      res.status(502).json({ error: 'tron_upstream', message: String(err?.message || err) });
    }
  });

  /**
   * Jupiter quote/swap proxy — browser hits lite-api.jup.ag 429 often.
   * Same-chain Solana Instant Swap only. Tight param allow-list.
   * RR5-03: per-mint feeAccount map; no Ultra no-fee fallback.
   */
  const jupQuoteCache = new Map();
  const jupLastGood = new Map();
  const JUP_QUOTE_TTL_MS = 20000;
  const JUP_STALE_MS = 120000;
  const JUP_BASES = ['https://lite-api.jup.ag/swap/v1', 'https://api.jup.ag/swap/v1'];

  async function jupUpstream(pathWithQuery, init = {}) {
    let lastErr = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      for (const base of JUP_BASES) {
        try {
          const upstream = await fetch(base + pathWithQuery, {
            ...init,
            headers: { accept: 'application/json', ...(init.headers || {}) },
            signal: AbortSignal.timeout(14000),
          });
          const text = await upstream.text();
          if (upstream.status === 429) {
            lastErr = Object.assign(new Error('jupiter_429'), { status: 429 });
            continue;
          }
          if (!upstream.ok) {
            lastErr = Object.assign(new Error('jupiter_' + upstream.status), { status: 502 });
            continue;
          }
          return JSON.parse(text);
        } catch (e) {
          lastErr = e;
        }
      }
      if (lastErr?.status === 429 && attempt < 2) {
        await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)));
      } else {
        break;
      }
    }
    throw lastErr || new Error('jupiter_upstream');
  }

  function jupFeeBps() {
    return jupFeeBpsFromConfig(config);
  }

  function jupMode() {
    return jupFeeModeFromConfig(config);
  }

  function assertJupiterAvailableOrThrow() {
    if (!jupiterEnabled(config)) {
      throw Object.assign(new Error('fee_config_unavailable'), {
        status: 503,
        code: 'fee_config_unavailable',
      });
    }
  }

  function assertQuotePlatformFeeOrThrow(quote) {
    if (jupMode() !== 'fee') return;
    const check = assertJupPlatformFee(quote, jupFeeBps());
    if (!check.ok) {
      throw Object.assign(new Error('jupiter_platform_fee_missing'), {
        status: 502,
        code: check.reason || 'jupiter_platform_fee_missing',
      });
    }
  }

  function assertSwapQuoteContext(quote, expected = {}) {
    if (!quote || typeof quote !== 'object') {
      throw Object.assign(new Error('invalid_jup_swap'), { status: 400, code: 'invalid_jup_swap' });
    }
    if (expected.inputMint && String(quote.inputMint) !== String(expected.inputMint)) {
      throw Object.assign(new Error('jup_quote_context_mismatch'), { status: 409, code: 'jup_quote_context_mismatch' });
    }
    if (expected.outputMint && String(quote.outputMint) !== String(expected.outputMint)) {
      throw Object.assign(new Error('jup_quote_context_mismatch'), { status: 409, code: 'jup_quote_context_mismatch' });
    }
    if (expected.inAmount != null && String(quote.inAmount) !== String(expected.inAmount)) {
      throw Object.assign(new Error('jup_quote_context_mismatch'), { status: 409, code: 'jup_quote_context_mismatch' });
    }
    if (expected.slippageBps != null && Number(quote.slippageBps) !== Number(expected.slippageBps)) {
      throw Object.assign(new Error('jup_quote_context_mismatch'), { status: 409, code: 'jup_quote_context_mismatch' });
    }
    if (!Array.isArray(quote.routePlan)) {
      throw Object.assign(new Error('jup_quote_context_mismatch'), { status: 409, code: 'jup_quote_missing_route' });
    }
    assertQuotePlatformFeeOrThrow(quote);
  }

  async function requireJupFee(inputMint, outputMint) {
    const selected = await resolveJupFeeAccount(config, inputMint, outputMint);
    if (!selected) {
      throw Object.assign(new Error('fee_config_unavailable'), {
        status: 503,
        code: 'fee_config_unavailable',
      });
    }
    return selected;
  }

  r.get('/wallet/jup-quote', async (req, res) => {
    try {
      const inputMint = String(req.query.inputMint || '');
      const outputMint = String(req.query.outputMint || '');
      const amount = String(req.query.amount || '');
      const slippageBps = String(req.query.slippageBps || '50');
      if (!JUP_MINT_RE.test(inputMint) || !JUP_MINT_RE.test(outputMint) || !/^\d{1,24}$/.test(amount)) {
        return res.status(400).json({ error: 'invalid_jup_quote' });
      }
      if (!/^\d{1,4}$/.test(slippageBps) || Number(slippageBps) > 5000) {
        return res.status(400).json({ error: 'invalid_jup_slippage' });
      }
      try {
        assertJupiterAvailableOrThrow();
      } catch (_) {
        return res.status(503).json({
          error: 'fee_config_unavailable',
          message: 'Jupiter Instant Swap unavailable — set GROM_JUP_FEE_MODE=free|fee (and fee infra when fee)',
        });
      }
      const mode = jupMode();
      let feePick = null;
      if (mode === 'fee') {
        try {
          feePick = await requireJupFee(inputMint, outputMint);
        } catch (_) {
          return res.status(503).json({
            error: 'fee_config_unavailable',
            message: 'Jupiter Instant Swap unavailable — no GROM fee token account for this mint pair',
          });
        }
      }
      const qs = new URLSearchParams({
        inputMint, outputMint, amount, slippageBps,
        swapMode: 'ExactIn',
        onlyDirectRoutes: 'false',
        asLegacyTransaction: 'false',
      });
      if (mode === 'fee') {
        qs.set('platformFeeBps', String(jupFeeBps()));
      }
      const cacheKey = qs.toString() + (feePick ? `|fee:${feePick.feeAccount}` : '|free');
      const hit = jupQuoteCache.get(cacheKey);
      if (hit && (Date.now() - hit.at) < JUP_QUOTE_TTL_MS) {
        return res.json(hit.body);
      }
      try {
        const upstream = await jupUpstream('/quote?' + qs.toString());
        assertQuotePlatformFeeOrThrow(upstream);
        /* RR6-04: keep full QuoteResponse (incl. platformFee); only attach GROM meta. */
        const meta = {
          _gromFeeBps: jupFeeBps(),
          _gromFeeMode: mode,
        };
        if (feePick) {
          meta._gromFeeAccount = feePick.feeAccount;
          meta._gromFeeMint = feePick.matchedMint;
        }
        const body = attachJupQuoteMeta(upstream, meta);
        jupQuoteCache.set(cacheKey, { at: Date.now(), body });
        jupLastGood.set(cacheKey, { at: Date.now(), body });
        if (jupQuoteCache.size > 400) {
          const oldest = jupQuoteCache.keys().next().value;
          jupQuoteCache.delete(oldest);
        }
        return res.json(body);
      } catch (err) {
        /* No Ultra fallback — fail closed rather than return a no-fee quote in fee mode. */
        if (err?.code === 'missing_platformFee'
          || err?.code === 'jupiter_platform_fee_missing'
          || err?.code === 'platformFee_bps_mismatch'
          || err?.code === 'platformFee_amount_invalid'
          || (err?.code && String(err.code).startsWith('platformFee'))) {
          return res.status(502).json({
            error: 'jupiter_platform_fee_missing',
            message: 'Jupiter quote missing verified platformFee',
            reason: err.code,
          });
        }
        const stale = jupLastGood.get(cacheKey);
        if (stale && (Date.now() - stale.at) < JUP_STALE_MS) {
          return res.json(stale.body);
        }
        throw err;
      }
    } catch (err) {
      if (err?.code === 'fee_config_unavailable' || err?.status === 503) {
        return res.status(503).json({
          error: 'fee_config_unavailable',
          message: 'Jupiter Instant Swap unavailable — no GROM fee token account for this mint pair',
        });
      }
      if (err?.code === 'jupiter_platform_fee_missing' || err?.status === 502 && String(err.message || '').includes('platform')) {
        return res.status(502).json({
          error: 'jupiter_platform_fee_missing',
          message: 'Jupiter quote missing verified platformFee',
        });
      }
      res.status(err?.status === 429 ? 429 : 502).json({
        error: 'jupiter_upstream',
        message: String(err?.message || err),
      });
    }
  });

  r.post('/wallet/jup-swap', async (req, res) => {
    try {
      const quoteResponse = req.body?.quoteResponse;
      const userPublicKey = String(req.body?.userPublicKey || '');
      if (!quoteResponse || typeof quoteResponse !== 'object' || !JUP_MINT_RE.test(userPublicKey)) {
        return res.status(400).json({ error: 'invalid_jup_swap' });
      }
      try {
        assertJupiterAvailableOrThrow();
      } catch (_) {
        return res.status(503).json({
          error: 'fee_config_unavailable',
          message: 'Jupiter Instant Swap unavailable — set GROM_JUP_FEE_MODE=free|fee (and fee infra when fee)',
        });
      }
      const mode = jupMode();
      const inMint = String(quoteResponse.inputMint || '');
      const outMint = String(quoteResponse.outputMint || '');
      let feePick = null;
      if (mode === 'fee') {
        try {
          feePick = await requireJupFee(inMint, outMint);
        } catch (_) {
          return res.status(503).json({
            error: 'fee_config_unavailable',
            message: 'Jupiter Instant Swap unavailable — no GROM fee token account for this mint pair',
          });
        }
      }
      try {
        assertSwapQuoteContext(quoteResponse, {
          inputMint: inMint,
          outputMint: outMint,
          inAmount: quoteResponse.inAmount,
          slippageBps: quoteResponse.slippageBps,
        });
      } catch (ctxErr) {
        return res.status(ctxErr.status || 409).json({
          error: ctxErr.code || 'jup_quote_context_mismatch',
          message: String(ctxErr.message || ctxErr),
        });
      }
      /* Strip GROM-only meta before forwarding to Jupiter /swap */
      const {
        _gromFeeAccount,
        _gromFeeMint,
        _gromFeeBps,
        _gromFeeMode,
        ...cleanQuote
      } = quoteResponse;
      void _gromFeeAccount; void _gromFeeMint; void _gromFeeBps; void _gromFeeMode;
      const payload = {
        quoteResponse: cleanQuote,
        userPublicKey,
        wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: 'auto',
      };
      if (feePick) {
        payload.feeAccount = feePick.feeAccount;
      }
      const body = await jupUpstream('/swap', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!body?.swapTransaction) {
        return res.status(502).json({ error: 'jupiter_no_tx' });
      }
      const out = {
        swapTransaction: body.swapTransaction,
        lastValidBlockHeight: body.lastValidBlockHeight,
        _gromFeeBps: jupFeeBps(),
        _gromFeeMode: mode,
      };
      if (feePick) {
        out._gromFeeAccount = feePick.feeAccount;
        out._gromFeeMint = feePick.matchedMint;
      }
      res.json(out);
    } catch (err) {
      if (err?.code === 'fee_config_unavailable' || err?.status === 503) {
        return res.status(503).json({
          error: 'fee_config_unavailable',
          message: 'Jupiter Instant Swap unavailable — no GROM fee token account for this mint pair',
        });
      }
      res.status(err?.status === 429 ? 429 : 502).json({
        error: 'jupiter_upstream',
        message: String(err?.message || err),
      });
    }
  });

  /**
   * Wallet-first Instant Swap history (no SIWE). Public, rate-limited, address-scoped.
   * GET /api/history/onchain?wallet=0x…&limit=50
   */
  r.get('/history/onchain', async (req, res, next) => {
    try {
      const wallet = String(req.query.wallet || '').trim().toLowerCase();
      if (!/^0x[a-f0-9]{40}$/.test(wallet)) {
        return res.status(400).json({ error: 'invalid_wallet' });
      }
      const limit = Math.min(parseInt(req.query.limit || '50', 10), 100);
      const swapActRes = await query(
        `SELECT product, action, detail, tx_hash, amount, asset, status, created_at, wallet_address
         FROM user_activity
         WHERE lower(wallet_address)=$1
           AND product IN ('swap', 'spot', 'futures')
           AND (
             tx_hash IS NOT NULL
             OR status IN ('filled', 'completed', 'bridging', 'submitted', 'source_confirmed')
             OR action IN ('swap', 'bridge', 'filled', 'completed', 'spot_buy', 'spot_sell', 'order')
           )
           AND NOT (coalesce(status,'') = 'error' AND coalesce(action,'') ILIKE '%fail%')
         ORDER BY created_at DESC
         LIMIT $2`,
        [wallet, limit]
      );
      const items = buildHistoryItems({
        transfers: [],
        spotOrders: [],
        swapActivity: swapActRes.rows,
      });
      res.json({ items, wallet });
    } catch (err) { next(err); }
  });

  r.get('/history', requireAuth, async (req, res, next) => {
    try {
      const limit = Math.min(parseInt(req.query.limit || '100', 10), 250);
      const wallet = (req.user.addr || '').toLowerCase() || null;
      /* Strict: only this SIWE wallet's activity — never leak another address via user_id alone. */
      const swapActRes = await query(
        `SELECT product, action, detail, tx_hash, amount, asset, status, created_at, wallet_address
           FROM user_activity
          WHERE product IN ('swap', 'spot', 'futures')
            AND (
              ($3::text IS NOT NULL AND lower(wallet_address)=$3)
              OR ($3::text IS NULL AND user_id=$1)
            )
          ORDER BY created_at DESC
          LIMIT $2`,
        [req.user.sub, limit, wallet]
      );
      const items = buildHistoryItems({
        transfers: [],
        spotOrders: [],
        swapActivity: swapActRes.rows,
      }).slice(0, limit);
      res.json({ items });
    } catch (err) { next(err); }
  });

  return r;
}

export default createWalletRouter;
