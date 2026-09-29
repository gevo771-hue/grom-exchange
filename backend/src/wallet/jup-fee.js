/**
 * Jupiter platform-fee account selection + on-chain verification (RR5/RR6).
 *
 * Jupiter requires feeAccount to be an initialized SPL token account whose mint
 * matches inputMint OR outputMint. See:
 * https://developers.jup.ag/docs/api-reference/swap/v1/swap
 *
 * Config:
 *   GROM_JUP_FEE_MODE          = free | fee  (required; never auto-detected)
 *   GROM_JUP_FEE_ACCOUNTS_JSON = {"mintA":"tokenAccountA","mintB":"tokenAccountB"}
 *   GROM_JUP_FEE_OWNER         = wallet pubkey that must own the fee token account
 *   SOLANA_RPC_URL / GROM_SOLANA_RPC = required for fee-mode readiness + verify
 *   GROM_FEE_BPS               = platform fee bps in fee mode (default 20)
 *
 * free: Jupiter works without platformFeeBps / feeAccount / map / owner / RPC.
 * fee:  strict 20 bps; missing map/owner/RPC → Jupiter unavailable (503).
 */

const JUP_MINT_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const TOKEN_2022_PROGRAM = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';

/** @type {Map<string, string>|null} */
let _mintMapCache = null;
/** @type {string|null} */
let _mintMapCacheKey = null;
/** @type {Map<string, { ok: boolean, at: number }>} */
const _accountVerifyCache = new Map();
const VERIFY_TTL_MS = 10 * 60 * 1000;

function parseMintMap(rawJson) {
  const map = new Map();
  const raw = String(rawJson || '').trim();
  if (raw) {
    try {
      const obj = JSON.parse(raw);
      if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
        for (const [mint, acct] of Object.entries(obj)) {
          const m = String(mint || '').trim();
          const a = String(acct || '').trim();
          if (JUP_MINT_RE.test(m) && JUP_MINT_RE.test(a)) {
            map.set(m, a);
          }
        }
      }
    } catch (_) {
      /* invalid JSON → empty map */
    }
  }
  return map;
}

export function resetJupFeeCachesForTests() {
  _mintMapCache = null;
  _mintMapCacheKey = null;
  _accountVerifyCache.clear();
}

export function loadJupFeeMintMap(config) {
  const raw = String(config?.liquidity?.jupiterFeeAccountsJson || '');
  if (_mintMapCache && _mintMapCacheKey === raw) return _mintMapCache;
  _mintMapCacheKey = raw;
  _mintMapCache = parseMintMap(raw);
  return _mintMapCache;
}

export function solanaRpcUrlFromConfig(config, opts = {}) {
  return String(
    opts.rpcUrl
    || config?.liquidity?.solanaRpcUrl
    || process.env.SOLANA_RPC_URL
    || process.env.GROM_SOLANA_RPC
    || '',
  ).trim();
}

export function jupFeeOwnerFromConfig(config) {
  return String(config?.liquidity?.jupiterFeeOwner || process.env.GROM_JUP_FEE_OWNER || '').trim();
}

/**
 * Explicit fee mode only — never infer from missing env.
 * @returns {'free'|'fee'|null}
 */
export function jupFeeModeFromConfig(config) {
  const raw = String(
    config?.liquidity?.jupiterFeeMode
    ?? process.env.GROM_JUP_FEE_MODE
    ?? '',
  ).trim().toLowerCase();
  if (raw === 'free' || raw === 'fee') return raw;
  return null;
}

/** True when mint map, fee owner, and Solana RPC are all configured (fee-mode infra). */
export function jupiterFeeReady(config) {
  const map = loadJupFeeMintMap(config);
  if (!map.size) return false;
  const owner = jupFeeOwnerFromConfig(config);
  if (!JUP_MINT_RE.test(owner)) return false;
  if (!solanaRpcUrlFromConfig(config)) return false;
  return true;
}

/** Jupiter Instant Swap available: free mode always; fee mode only when fee infra ready. */
export function jupiterEnabled(config) {
  const mode = jupFeeModeFromConfig(config);
  if (mode === 'free') return true;
  if (mode === 'fee') return jupiterFeeReady(config);
  return false;
}

/** GROM takes a Jupiter platform fee (fee mode + ready infra). */
export function jupiterFeeEnabled(config) {
  return jupFeeModeFromConfig(config) === 'fee' && jupiterFeeReady(config);
}

/**
 * Platform fee bps for Jupiter quote/swap.
 * free → 0; fee → GROM_FEE_BPS (default 20); unset → 0 (Jupiter disabled separately).
 */
export function jupFeeBpsFromConfig(config) {
  if (jupFeeModeFromConfig(config) === 'free') return 0;
  if (jupFeeModeFromConfig(config) !== 'fee') return 0;
  const b = Number(config?.liquidity?.feeBps);
  return Number.isFinite(b) && b > 0 && b <= 100 ? Math.floor(b) : 20;
}

/**
 * Pick feeAccount whose mint equals inputMint or outputMint.
 * Prefer outputMint match (common Jupiter pattern), then inputMint.
 * @returns {{ feeAccount: string, matchedMint: string } | null}
 */
export function selectJupFeeAccount(config, inputMint, outputMint) {
  const map = loadJupFeeMintMap(config);
  const inM = String(inputMint || '').trim();
  const outM = String(outputMint || '').trim();
  if (JUP_MINT_RE.test(outM) && map.has(outM)) {
    return { feeAccount: map.get(outM), matchedMint: outM };
  }
  if (JUP_MINT_RE.test(inM) && map.has(inM)) {
    return { feeAccount: map.get(inM), matchedMint: inM };
  }
  return null;
}

/**
 * On-chain verify via Solana JSON-RPC getAccountInfo.
 * Fail-closed without RPC. Requires parsed mint + authority match.
 */
export async function verifyJupFeeTokenAccount(feeAccount, expectedMint, opts = {}) {
  const rpc = String(opts.rpcUrl || '').trim();
  const expectedOwner = String(opts.expectedOwner || '').trim();
  const key = `${feeAccount}|${expectedMint}|${expectedOwner || '-'}|${rpc || 'none'}`;
  const hit = _accountVerifyCache.get(key);
  if (hit && (Date.now() - hit.at) < VERIFY_TTL_MS) return hit.ok;

  if (!rpc) {
    /* RR6-05: missing RPC is never success — do not cache as ok. */
    return false;
  }
  if (!JUP_MINT_RE.test(String(feeAccount || '')) || !JUP_MINT_RE.test(String(expectedMint || ''))) {
    return false;
  }
  if (!JUP_MINT_RE.test(expectedOwner)) {
    return false;
  }

  try {
    const fetchFn = opts.fetchImpl || fetch;
    const res = await fetchFn(rpc, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getAccountInfo',
        params: [feeAccount, { encoding: 'jsonParsed', commitment: 'confirmed' }],
      }),
      signal: AbortSignal.timeout(8000),
    });
    const json = await res.json();
    const value = json?.result?.value;
    if (!value) {
      _accountVerifyCache.set(key, { ok: false, at: Date.now() });
      return false;
    }
    const programOwner = String(value.owner || '');
    if (programOwner !== TOKEN_PROGRAM && programOwner !== TOKEN_2022_PROGRAM) {
      _accountVerifyCache.set(key, { ok: false, at: Date.now() });
      return false;
    }
    const info = value?.data?.parsed?.info;
    const parsedMint = info?.mint;
    if (!parsedMint || String(parsedMint) !== String(expectedMint)) {
      _accountVerifyCache.set(key, { ok: false, at: Date.now() });
      return false;
    }
    const authority = info?.owner;
    if (!authority || String(authority) !== String(expectedOwner)) {
      _accountVerifyCache.set(key, { ok: false, at: Date.now() });
      return false;
    }
    /* Cache only successful exact tuples */
    _accountVerifyCache.set(key, { ok: true, at: Date.now() });
    return true;
  } catch (_) {
    _accountVerifyCache.set(key, { ok: false, at: Date.now() });
    return false;
  }
}

/**
 * Resolve fee account for a pair or return null (caller must 503).
 */
export async function resolveJupFeeAccount(config, inputMint, outputMint, opts = {}) {
  if (!jupiterFeeReady(config) && !opts.skipReadyCheck) {
    /* Still attempt select+verify when tests inject rpc/owner via opts */
  }
  const rpc = solanaRpcUrlFromConfig(config, opts);
  const expectedOwner = String(opts.expectedOwner || jupFeeOwnerFromConfig(config) || '').trim();
  if (!rpc || !JUP_MINT_RE.test(expectedOwner)) return null;

  const selected = selectJupFeeAccount(config, inputMint, outputMint);
  if (!selected) return null;
  const ok = await verifyJupFeeTokenAccount(selected.feeAccount, selected.matchedMint, {
    ...opts,
    rpcUrl: rpc,
    expectedOwner,
  });
  if (!ok) return null;
  return selected;
}

/**
 * Assert Jupiter quote carries a real platformFee of required bps.
 * Does not trust _gromFeeBps metadata.
 */
export function assertJupPlatformFee(quote, requiredBps = 20) {
  const pf = quote?.platformFee;
  if (!pf || typeof pf !== 'object') {
    return { ok: false, reason: 'missing_platformFee' };
  }
  const feeBps = Number(pf.feeBps);
  if (feeBps !== Number(requiredBps)) {
    return { ok: false, reason: 'platformFee_bps_mismatch', feeBps };
  }
  const amount = String(pf.amount ?? '');
  if (!/^\d+$/.test(amount) || BigInt(amount) <= 0n) {
    return { ok: false, reason: 'platformFee_amount_invalid', amount };
  }
  return { ok: true };
}

/**
 * Preserve full upstream QuoteResponse; only attach GROM metadata.
 * Never strip platformFee / routePlan / contextSlot (RR6-04).
 */
export function attachJupQuoteMeta(upstreamQuote, extra = {}) {
  if (!upstreamQuote || typeof upstreamQuote !== 'object') return upstreamQuote;
  return { ...upstreamQuote, ...extra };
}

export { JUP_MINT_RE, TOKEN_PROGRAM, TOKEN_2022_PROGRAM };
