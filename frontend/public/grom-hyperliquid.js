/**
 * GROM Trade — Hyperliquid Builder Codes (browser).
 * Perps + L1 CLOB spot. Activates when /api/futures/hl/config returns enabled:true.
 * Does not touch Binary / Predict / Instant Swap (DEX aggregator).
 */
(function () {
  'use strict';

  const FEE_FALLBACK = 50; // 0.05%
  const BUILDER_FALLBACK = '0xCFeF272536D6E91A4945063d40ac7CbA7Eb657B5';
  /** Unit wrapped majors: show BTC not UBTC. Other Unit tickers keep native names (UFART, UPUMP…). */
  const UNIT_DISPLAY = { UBTC: 'BTC', UETH: 'ETH', USOL: 'SOL' };
  const SPOT_PIN = { BTC: 0, ETH: 1, SOL: 2, HYPE: 3, PURR: 4 };

  let _cfg = null;
  let _meta = null;
  let _spotMeta = null;
  let _sdk = null;
  let _booted = false;
  let _midsTimer = null;
  let _posTimer = null;

  /** coin → mid price (number) — read by priceForPair via window.__hlMids */
  window.__hlMids = window.__hlMids || Object.create(null);
  /** coin → { funding, markPx, prevDayPx, dayNtlVlm, maxLeverage, szDecimals, id } */
  window.__hlCtx = window.__hlCtx || Object.create(null);
  /** [{ sym, coin, type, fundingBase, rank, ai, fresh, maxLeverage, szDecimals, assetId }] */
  window.__hlMarkets = window.__hlMarkets || [];
  window.__hlSpotMids = window.__hlSpotMids || Object.create(null);
  window.__hlSpotCtx = window.__hlSpotCtx || Object.create(null);
  window.__hlSpotMarkets = window.__hlSpotMarkets || [];

  function isSpotMode() {
    return !!(window.futDeskState && window.futDeskState.tradeMode === 'spot');
  }

  function toast(msg, kind) {
    try {
      if (typeof window.toast === 'function') window.toast(msg, kind || 'info');
      else if (typeof window.notify === 'function') window.notify(msg, kind || 'info');
    } catch (_) {}
  }

  function eth() {
    try {
      if (typeof window.gwActiveSigningProvider === 'function') {
        const p = window.gwActiveSigningProvider();
        if (p?.request) return p;
      }
    } catch (_) {}
    const p = window.gromWallet?.wcProvider || window.ethereum || null;
    try {
      if (p && typeof window.gwPatchProviderRequestAccounts === 'function') {
        return window.gwPatchProviderRequestAccounts(p);
      }
    } catch (_) {}
    return p;
  }

  async function fetchConfig(force) {
    if (_cfg && !force) return _cfg;
    const r = await fetch('/api/futures/hl/config', { cache: 'no-store' });
    _cfg = await r.json();
    return _cfg;
  }

  async function hlInfo(body) {
    const r = await fetch('/api/futures/hl/info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || ('HL info ' + r.status));
    return data;
  }

  function coinFromPair(pair) {
    // BTC/USDT → BTC · xyz:SMH/USDC → XYZ:SMH
    let coin = String(pair || 'BTC/USDT').split('/')[0].replace(/-PERP$/i, '').toUpperCase();
    coin = UNIT_DISPLAY[coin] || coin;
    // Bare names (EUR) from bad UI state → unique HIP-3 match (xyz:EUR). Skip in Spot so FART ≠ xyz:FART.
    if (!isSpotMode()) {
      try {
        const map = _meta?.assetByCoin || window.__hlAssetByCoin;
        if (map && !map.has(coin)) {
          const hits = [];
          map.forEach((_, k) => {
            if (k === coin || String(k).endsWith(':' + coin)) hits.push(k);
          });
          if (hits.length === 1) coin = hits[0];
        }
      } catch (_) {}
    }
    return coin;
  }

  function pairFromCoin(coin) {
    const c = String(coin || 'BTC');
    if (isSpotMode()) return displaySpotCoin(c) + '/USDC';
    const q = c.includes(':') ? 'USDC' : 'USDT';
    return c.toUpperCase() + '/' + q;
  }

  function normalizeSpotSym(pairOrCoin) {
    const raw = String(pairOrCoin || '');
    const coin = (raw.includes('/') ? raw.split('/')[0] : raw).replace(/-PERP$/i, '').toUpperCase();
    return displaySpotCoin(coin) + '/USDC';
  }

  /** Base for UI only: xyz:BABA → BABA (API still uses full coin id). */
  function displayCoinBase(coinOrPair) {
    const raw = String(coinOrPair || '');
    const coin = raw.includes('/')
      ? coinFromPair(raw)
      : String(raw).split('/')[0].replace(/-PERP$/i, '').toUpperCase();
    if (coin.includes(':')) {
      const parts = coin.split(':');
      return String(parts[parts.length - 1] || coin);
    }
    return coin;
  }

  /** Short label: xyz:SMH → SMHUSDC, BTC perp → BTCUSDT, BTC spot → BTCUSDC */
  function displayCoinLabel(coinOrPair) {
    const raw = String(coinOrPair || '');
    const quotedUsdc = /\/USDC$/i.test(raw);
    if (isSpotMode() || quotedUsdc) {
      const coin = coinFromPair(raw.includes('/') ? raw : normalizeSpotSym(raw));
      return displayCoinBase(displaySpotCoin(coin)) + 'USDC';
    }
    const coin = raw.includes('/') ? coinFromPair(raw) : String(raw).split('/')[0].replace(/-PERP$/i, '').toUpperCase();
    const base = displayCoinBase(coin);
    if (coin.includes(':')) return base + 'USDC';
    return base + 'USDT';
  }

  /** True once HL universe meta is loaded (listing checks are meaningful). */
  function isMetaReady() {
    try {
      const map = _meta?.assetByCoin || window.__hlAssetByCoin;
      return !!(map && map.size);
    } catch (_) { return false; }
  }

  /** True only for live Hyperliquid perps (main + HIP-3) or USDC spot pairs. Never OTC/FX soup. */
  function isListedPair(pairOrCoin) {
    try {
      if (isSpotMode()) {
        const map = _spotMeta?.assetBySym || window.__hlSpotAssetBySym;
        if (!map || !map.size) return false;
        const raw = String(pairOrCoin || '');
        if (raw.includes('/') && !/\/USDC$/i.test(raw)) return false;
        const lookup = _spotMeta?.assetLookup || window.__hlSpotAssetLookup;
        if (lookup && lookup.has(raw.toUpperCase())) return true;
        return map.has(normalizeSpotSym(pairOrCoin));
      }
      const raw = String(pairOrCoin || '');
      const map = _meta?.assetByCoin || window.__hlAssetByCoin;
      if (!map || !map.size) return false;
      const coin = coinFromPair(pairOrCoin);
      // BTC/USDC is spot. HIP-3 perps are quoted USDC as DEX:COIN/USDC (xyz:BE).
      if (/\/USDC$/i.test(raw) && !String(coin).includes(':')) return false;
      return map.has(coin);
    } catch (_) { return false; }
  }

  function filterListedMarkets(list, opts) {
    // Markets / perp catalog must stay on perps even if Trade desk is in Spot.
    const mode = opts && opts.mode;
    const spot = mode === 'spot' ? true : mode === 'perp' ? false : isSpotMode();
    if (spot) {
      const map = _spotMeta?.assetBySym || window.__hlSpotAssetBySym;
      if (!map || !map.size) return [];
      return (list || []).filter((m) => m && m.spot && map.has(m.sym || normalizeSpotSym(m.coin)));
    }
    const map = _meta?.assetByCoin || window.__hlAssetByCoin;
    if (!map || !map.size) {
      // Meta not ready — keep flagged perps so TradFi/HIP-3 pills are not empty.
      return (list || []).filter((m) => m && !m.spot);
    }
    return (list || []).filter((m) => {
      if (m && m.spot) return false;
      const coin = String(m?.coin || coinFromPair(m?.sym || '')).toUpperCase();
      return map.has(coin);
    });
  }

  function hip3AssetId(dexIndex, assetIndex) {
    if (!dexIndex) return assetIndex;
    return 110000 + ((dexIndex - 1) * 10000) + assetIndex;
  }

  function trimNum(s) {
    const str = String(s);
    if (!str.includes('.')) return str;
    return str.replace(/\.?0+$/, '');
  }

  /**
   * HL tick rules: ≤5 significant figures, ≤ (MAX_DECIMALS − szDecimals) decimals.
   * MAX_DECIMALS = 6 perp / 8 spot. Integer prices always allowed.
   * @see https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/tick-and-lot-size
   */
  function formatPx(px, szDecimals, isSpot) {
    const n = Number(px);
    if (!Number.isFinite(n) || n <= 0) throw new Error('bad price');
    const maxDec = Math.max(0, (isSpot ? 8 : 6) - Number(szDecimals || 0));
    /* 5 sig figs first — BTC ~81791.5 is 6 figs and HL rejects as bad tick. */
    let rounded = Number(n.toPrecision(5));
    if (!Number.isFinite(rounded) || rounded <= 0) throw new Error('bad price');
    const f = Math.pow(10, maxDec);
    rounded = Math.round(rounded * f) / f;
    if (Math.abs(rounded - Math.round(rounded)) < 1e-9) {
      return String(Math.round(rounded));
    }
    return trimNum(rounded.toFixed(maxDec));
  }

  function formatSz(sz, szDecimals) {
    const d = Math.max(0, Number(szDecimals || 0));
    const n = Number(sz);
    if (!Number.isFinite(n) || n <= 0) throw new Error('bad size');
    return trimNum(n.toFixed(d));
  }

  async function loadSdk() {
    if (_sdk) return _sdk;
    const urls = [
      'https://esm.sh/@nktkas/hyperliquid@0.25.1?bundle',
      'https://esm.sh/@nktkas/hyperliquid@0.24.3?bundle',
      'https://esm.sh/@nktkas/hyperliquid?bundle',
    ];
    let last;
    for (const u of urls) {
      try {
        _sdk = await import(/* webpackIgnore: true */ u);
        return _sdk;
      } catch (e) { last = e; }
    }
    throw last || new Error('Hyperliquid SDK unavailable');
  }

  function proxyTransport() {
    return {
      async request(endpoint, payload) {
        const path = endpoint === 'exchange' ? '/api/futures/hl/exchange' : '/api/futures/hl/info';
        const r = await fetch(path, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) {
          const msg = data.response || data.error || data.message || ('HL ' + endpoint + ' ' + r.status);
          throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
        }
        return data;
      },
    };
  }

  async function getAddress() {
    const provider = eth();
    let address = '';
    /* Prefer already-known session accounts — WC rejects eth_requestAccounts. */
    try {
      if (provider?.accounts?.[0]) address = String(provider.accounts[0]);
    } catch (_) {}
    if (!address && provider?.request) {
      try {
        const acc = await provider.request({ method: 'eth_accounts' });
        address = String(acc?.[0] || '');
      } catch (_) {}
    }
    if (!address && provider?.request) {
      try {
        const acc = await provider.request({ method: 'eth_requestAccounts' });
        address = String(acc?.[0] || '');
      } catch (_) {}
    }
    if (!address) {
      try {
        if (typeof window.gwOcConnectedAddress === 'function') {
          address = String(window.gwOcConnectedAddress() || '');
        }
      } catch (_) {}
    }
    if (!address) {
      try {
        address = String(localStorage.getItem('grom_wallet_label') || '');
      } catch (_) {}
    }
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      throw new Error('Connect wallet first');
    }
    return address;
  }

  /** WC sessions minted before typed-data was required cannot sign HL actions. */
  function wcSessionHasTypedData(provider) {
    try {
      const ns = provider?.session?.namespaces?.eip155
        || provider?.session?.namespaces?.['eip155']
        || null;
      const methods = (ns && ns.methods) || [];
      if (!methods.length) return true; /* injected / unknown — assume OK */
      return methods.indexOf('eth_signTypedData_v4') >= 0
        || methods.indexOf('eth_signTypedData') >= 0;
    } catch (_) {
      return true;
    }
  }

  /** HL EIP-712 domain uses chainId 1337 — Trust needs it in the WC session. */
  function wcSessionHasHlL1(provider) {
    try {
      const ns = provider?.session?.namespaces?.eip155 || null;
      if (!ns) return true; /* injected */
      const chains = ns.chains || [];
      const accounts = ns.accounts || [];
      if (!chains.length && !accounts.length) return true;
      return chains.some((c) => String(c) === 'eip155:1337')
        || accounts.some((a) => String(a).startsWith('eip155:1337:'));
    } catch (_) {
      return true;
    }
  }

  function isHlSignatureCancelled(error) {
    const pending = [error];
    const seen = new Set();
    while (pending.length && seen.size < 20) {
      const e = pending.shift();
      if (e == null || seen.has(e)) continue;
      seen.add(e);
      const raw = typeof e === 'string' ? e : String(e.message || '');
      if (Number(e.code) === 4001 || e.code === 'ACTION_REJECTED'
          || /4001|ACTION_REJECTED|user rejected|user denied|denied by user|Request rejected by user|cancelled by user|canceled by user/i.test(raw)) return true;
      if (typeof e === 'object') pending.push(e.error, e.cause, e.info?.error, e.data?.originalError);
    }
    return false;
  }

  function isHlSignRetriable(e) {
    if (isHlSignatureCancelled(e)) return false;
    const raw = String((e && e.message) || e || '');
    return /32603|32000|5201|coalesce|Internal JSON-RPC|WCError|unknown method|Missing or invalid|method.*not.*support|Unsupported wallet|signTypedData|An error has occurred|Please,?\s*try again/i.test(raw);
  }

  function logHlFill({ spot, side, coin, size, mid, resp }) {
    try {
      const isBuy = side === 'buy' || side === 'long';
      const st0 = resp?.response?.data?.statuses?.[0] || {};
      const oid = st0.resting?.oid || st0.filled?.oid || st0.oid || null;
      const filledSz = Number(st0.filled?.totalSz || size) || Number(size) || 0;
      const avgPx = Number(st0.filled?.avgPx || mid) || Number(mid) || 0;
      const notional = filledSz * avgPx;
      const fromSym = spot ? (isBuy ? 'USDC' : coin) : coin;
      const toSym = spot ? (isBuy ? coin : 'USDC') : 'USDC';
      if (typeof window.gwTxLogPush === 'function') {
        window.gwTxLogPush({
          product: spot ? 'spot' : 'futures',
          action: spot ? (isBuy ? 'spot_buy' : 'spot_sell') : (isBuy ? 'long' : 'short'),
          kind: spot ? 'hl-spot' : 'hl-perp',
          fromSym,
          toSym,
          asset: coin,
          amt: notional > 0 ? Number(notional.toFixed(4)) : filledSz,
          amount: notional > 0 ? Number(notional.toFixed(4)) : filledSz,
          status: 'filled',
          hash: oid != null ? ('hl:' + oid) : undefined,
          chain: 'hyperliquid',
        });
      }
    } catch (_) {}
  }

  async function getExchangeClient() {
    const mod = await loadSdk();
    const ExchangeClient = mod.ExchangeClient || mod.default?.ExchangeClient;
    if (!ExchangeClient) throw new Error('ExchangeClient missing from SDK');
    const ethersMod = await import(/* webpackIgnore: true */ 'https://esm.sh/ethers@6.13.4');
    let provider = eth();
    /* After a reload the wallet chip is soft-restored but the WC signing session
     * is not — every HL action (order, transfer) needs it back first. */
    if (!provider?.request && typeof window.gwEnsureSigningForSwap === 'function') {
      toast('Reconnect the wallet to sign on Hyperliquid…', 'info');
      try {
        await window.gwEnsureSigningForSwap({ reason: 'hl-action', silent: false });
      } catch (_) {}
      provider = eth();
    }
    /* Old WC pairings often lack eth_signTypedData_v4 — force a fresh approve. */
    if (provider?.request && !wcSessionHasTypedData(provider)
        && typeof window.gwEnsureSigningForSwap === 'function') {
      toast('Reconnect wallet once — Hyperliquid needs a signature approval', 'warn');
      try {
        await window.gwEnsureSigningForSwap({ force: true, reason: 'hl-typedata', silent: false });
      } catch (_) {}
      provider = eth();
    }
    /* Tip only: HL EIP-712 uses chainId 1337. New WC proposals include it as
     * optional; do not force-reconnect here — Trust may refuse a non-EVM chain
     * and loop. hlSignedAction retries after generic Trust errors. */
    if (provider?.request && !wcSessionHasHlL1(provider)) {
      try {
        console.info('[GROM HL] WC session missing eip155:1337 — HL sign may need Trust reconnect');
      } catch (_) {}
    }
    if (!provider?.request) throw new Error('Connect wallet first');
    const address = await getAddress();
    const browserProvider = new ethersMod.BrowserProvider(provider);
    /* Pass address so ethers does not call eth_requestAccounts on WC. */
    const wallet = await browserProvider.getSigner(address);
    /* Prefer ethers' native signTypedData first — that path worked for prior
     * Spot sells (BTC). Raw v4/v3 is fallback only. Keep arity === 3 for @nktkas. */
    try {
      const orig = wallet.signTypedData?.bind(wallet);
      if (typeof orig === 'function' && !wallet.__gromHlWakePatched) {
        wallet.__gromHlWakePatched = true;
        const TypedDataEncoder = ethersMod.TypedDataEncoder;
        const getAddressFn = ethersMod.getAddress;
        wallet.signTypedData = async function gromHlSignTypedData(domain, types, value) {
          try {
            if (typeof window.gwClearWcDeepLinkChoice === 'function') {
              window.gwClearWcDeepLinkChoice();
            }
          } catch (_) {}
          try {
            if (typeof window.gwWakeWalletForSigning === 'function') {
              window.gwWakeWalletForSigning({ action: 'sign', chainLabel: 'Hyperliquid Spot' });
            }
          } catch (_) {}

          const bareRequest = provider.request.bind(provider);
          const wakeOpts = { action: 'sign', chainLabel: 'Hyperliquid Spot' };
          const wakeReq = (args) => {
            if (typeof window.gwProviderRequestWithWake === 'function') {
              /* Shim avoids recursion if provider.request is wrapped elsewhere. */
              return window.gwProviderRequestWithWake(
                { request: bareRequest, session: provider.session },
                args,
                wakeOpts,
              );
            }
            return bareRequest(args);
          };

          const signerAddr = (() => {
            try { return getAddressFn ? getAddressFn(address) : address; } catch (_) { return address; }
          })();

          let signedOk = false;
          try {
            try {
              const sig = await orig(domain, types, value);
              signedOk = true;
              return sig;
            } catch (eOrig) {
              if (isHlSignatureCancelled(eOrig)) throw eOrig;
              if (!(TypedDataEncoder && typeof TypedDataEncoder.getPayload === 'function')) {
                throw eOrig;
              }
              const payload = TypedDataEncoder.getPayload(domain, types, value);
              if (payload?.domain && typeof payload.domain.chainId === 'bigint') {
                payload.domain.chainId = Number(payload.domain.chainId);
              }
              const data = JSON.stringify(payload);
              try {
                const sig = await wakeReq({
                  method: 'eth_signTypedData_v4',
                  params: [signerAddr, data],
                });
                signedOk = true;
                return sig;
              } catch (eV4) {
                if (isHlSignatureCancelled(eV4)) throw eV4;
                try {
                  const sig = await wakeReq({
                    method: 'eth_signTypedData',
                    params: [signerAddr, data],
                  });
                  signedOk = true;
                  return sig;
                } catch (eLegacy) {
                  if (isHlSignatureCancelled(eLegacy)) throw eLegacy;
                  throw eOrig;
                }
              }
            }
          } finally {
            setTimeout(() => {
              try {
                if (typeof window.gwHideRemoteSignCoach === 'function') window.gwHideRemoteSignCoach();
              } catch (_) {}
            }, signedOk ? 500 : 14000);
          }
        };
      }
    } catch (_) {}
    return new ExchangeClient({ transport: proxyTransport(), wallet });
  }

  function ingestUniverse(universe, ctxs, dexName, dexIndex, assetByCoin, markets, mids, ctxMap) {
    universe.forEach((u, i) => {
      if (!u?.name) return;
      // Drop delisted HL perps — they still appear in meta but are not tradeable.
      if (u.isDelisted) return;
      const coin = String(u.name).toUpperCase();
      const ctx = ctxs[i] || {};
      const mid = Number(ctx.midPx || ctx.markPx || 0);
      const prev = Number(ctx.prevDayPx || 0);
      const funding = Number(ctx.funding || 0) * 100;
      const maxLeverage = Number(u.maxLeverage) || 20;
      const szDecimals = u.szDecimals != null ? Number(u.szDecimals) : 4;
      const assetId = hip3AssetId(dexIndex, i);
      const isHip3 = !!dexName;
      const onlyIsolated = !!(u.onlyIsolated || u.marginMode === 'noCross' || u.marginMode === 'strictIsolated');
      // HL Pre-launch ≈ strictIsolated / ultra-low-lev isolated on main (e.g. CASHCAT 3×)
      const prelaunch = !isHip3 && (
        u.marginMode === 'strictIsolated'
        || (u.onlyIsolated && maxLeverage <= 3)
      );
      const chg24 = (prev > 0 && mid > 0) ? ((mid / prev) - 1) * 100 : null;
      assetByCoin.set(coin, {
        id: assetId,
        name: coin,
        szDecimals,
        maxLeverage,
        dex: dexName || '',
        dexIndex,
        onlyIsolated,
        prelaunch,
      });
      if (mid > 0) mids[coin] = mid;
      ctxMap[coin] = {
        funding,
        markPx: Number(ctx.markPx || mid),
        prevDayPx: prev,
        dayNtlVlm: Number(ctx.dayNtlVlm || 0),
        openInterest: Number(ctx.openInterest || 0),
        maxLeverage,
        szDecimals,
        id: assetId,
        dex: dexName || '',
        chg24,
        prelaunch,
      };
      markets.push({
        sym: pairFromCoin(coin),
        coin,
        type: prelaunch ? 'prelaunch' : (isHip3 ? 'hip3' : 'crypto'),
        dex: dexName || '',
        fundingBase: funding,
        rank: 0,
        ai: !isHip3 && !prelaunch && (coin === 'BTC' || coin === 'ETH' || i < 20),
        fresh: prelaunch,
        maxLeverage,
        szDecimals,
        assetId,
        dayNtlVlm: Number(ctx.dayNtlVlm || 0),
        openInterest: Number(ctx.openInterest || 0),
        chg24,
        prelaunch,
        tradfi: isHip3,
        hip3: isHip3,
        label: displayCoinLabel(coin),
      });
    });
  }

  /**
   * Load HL meta. Chrome opens many parallel sockets and used to fire every
   * HIP-3 dex at once → shared-proxy 429 → crypto OK, TradFi/HIP-3 empty.
   * Strategy: main first (publish), then xyz alone, then other HIP-3 one-by-one.
   */
  async function ensureMeta(force) {
    if (_meta && _meta.assetByCoin && _meta.assetByCoin.size > 0 && !force) return _meta;

    const prevHip = (window.__hlMarkets || []).filter((m) => m && m.hip3);
    const prevMids = window.__hlMids || Object.create(null);
    const prevCtx = window.__hlCtx || Object.create(null);

    let dexList = [null];
    try {
      const raw = await hlInfo({ type: 'perpDexs' });
      if (Array.isArray(raw) && raw.length) dexList = raw;
    } catch (e) {
      console.warn('[GROM HL] perpDexs', e);
    }

    const assetByCoin = new Map();
    const markets = [];
    const mids = Object.create(null);
    const ctxMap = Object.create(null);

    const dexIndexOf = (entry) => {
      const i = dexList.indexOf(entry);
      return i >= 0 ? i : 0;
    };

    const loadOne = async (entry) => {
      const dexName = entry && entry.name ? String(entry.name) : '';
      const dexIndex = dexIndexOf(entry);
      const body = { type: 'metaAndAssetCtxs' };
      if (dexName) body.dex = dexName;
      try {
        const data = await hlInfo(body);
        if (!data || (data && data.error) || !Array.isArray(data)) return false;
        const meta = data[0];
        const ctxs = data[1] || [];
        if (!meta || !Array.isArray(meta.universe)) return false;
        ingestUniverse(meta.universe, ctxs, dexName, dexIndex, assetByCoin, markets, mids, ctxMap);
        return true;
      } catch (e) {
        console.warn('[GROM HL] meta', dexName || 'main', e);
        return false;
      }
    };

    const mergePrevHip = () => {
      for (const m of prevHip) {
        const coin = String(m.coin || '').toUpperCase();
        if (!coin || assetByCoin.has(coin)) continue;
        markets.push(m);
        assetByCoin.set(coin, {
          id: m.assetId,
          name: coin,
          szDecimals: m.szDecimals != null ? Number(m.szDecimals) : 4,
          maxLeverage: Number(m.maxLeverage) || 20,
          dex: m.dex || '',
          dexIndex: 0,
          onlyIsolated: false,
          prelaunch: false,
        });
        if (prevMids[coin] != null) mids[coin] = prevMids[coin];
        if (prevCtx[coin]) ctxMap[coin] = prevCtx[coin];
      }
    };

    const publish = () => {
      if (!assetByCoin.size || !markets.length) return null;
      mergePrevHip();
      markets.sort((a, b) => (b.dayNtlVlm || 0) - (a.dayNtlVlm || 0));
      markets.forEach((m, i) => { m.rank = i; });
      _meta = { assetByCoin, markets, rawDexes: dexList };
      window.__hlMids = mids;
      window.__hlCtx = ctxMap;
      window.__hlMarkets = markets;
      window.__hlAssetByCoin = assetByCoin;
      try {
        if (typeof window.renderMarketsEnhanced === 'function'
          && document.getElementById('page-markets')?.classList.contains('active')) {
          window.renderMarketsEnhanced();
        }
      } catch (_) {}
      return _meta;
    };

    /* Main crypto first — Markets "All/Crypto" must never wait on HIP-3. */
    const mainEntry = dexList.find((e) => !(e && e.name)) ?? null;
    await loadOne(mainEntry);
    publish();

    /* HIP-3: xyz (TradFi) alone first — parallel batches were 429ing Chrome. */
    await loadHip3Dexes(dexList, { loadOne, publish, assetByCoin });

    if (!assetByCoin.size || !markets.length) {
      console.warn('[GROM HL] ensureMeta: empty universe (likely 429) — will retry');
      return null;
    }
    const hipN = markets.filter((m) => m && m.hip3).length;
    if (hipN < 5) {
      console.warn('[GROM HL] ensureMeta: only', hipN, 'HIP-3 rows — scheduling backfill');
      try { scheduleHip3Backfill(); } catch (_) {}
    }
    return _meta;
  }

  /** Sequential HIP-3 load: xyz first, then one dex at a time (avoids proxy 429). */
  async function loadHip3Dexes(dexList, { loadOne, publish, assetByCoin }) {
    const hipEntries = (Array.isArray(dexList) ? dexList : [])
      .filter((e) => e && e.name)
      .sort((a, b) => {
        const na = String(a.name || '');
        const nb = String(b.name || '');
        if (na === 'xyz' && nb !== 'xyz') return -1;
        if (nb === 'xyz' && na !== 'xyz') return 1;
        return na.localeCompare(nb);
      });
    for (let i = 0; i < hipEntries.length; i++) {
      const ok = await loadOne(hipEntries[i]);
      if (ok && typeof publish === 'function') publish();
      if (i + 1 < hipEntries.length) {
        await new Promise((r) => setTimeout(r, ok ? 220 : 700));
      }
    }
    return (assetByCoin && typeof assetByCoin.size === 'number')
      ? [...(window.__hlMarkets || [])].filter((m) => m && m.hip3).length
      : 0;
  }

  /**
   * Backfill only HIP-3 into the existing crypto catalog — never wipe main
   * markets when TradFi is empty (force ensureMeta used to re-fetch everything
   * and burn the rate budget before xyz arrived).
   */
  async function ensureHip3Only() {
    let dexList = [];
    try {
      const raw = await hlInfo({ type: 'perpDexs' });
      if (Array.isArray(raw) && raw.length) dexList = raw;
    } catch (e) {
      console.warn('[GROM HL] perpDexs (hip-only)', e);
      return 0;
    }
    const assetByCoin = window.__hlAssetByCoin instanceof Map
      ? window.__hlAssetByCoin
      : new Map((_meta && _meta.assetByCoin) || []);
    const markets = Array.isArray(window.__hlMarkets) ? window.__hlMarkets.slice() : [];
    const mids = Object.assign(Object.create(null), window.__hlMids || {});
    const ctxMap = Object.assign(Object.create(null), window.__hlCtx || {});

    const dexIndexOf = (entry) => {
      const i = dexList.indexOf(entry);
      return i >= 0 ? i : 0;
    };

    const loadOne = async (entry) => {
      const dexName = entry && entry.name ? String(entry.name) : '';
      if (!dexName) return false;
      const dexIndex = dexIndexOf(entry);
      try {
        const data = await hlInfo({ type: 'metaAndAssetCtxs', dex: dexName });
        if (!data || data.error || !Array.isArray(data)) return false;
        const meta = data[0];
        const ctxs = data[1] || [];
        if (!meta || !Array.isArray(meta.universe)) return false;
        /* Drop prior rows for this dex so we don't double-count on retry. */
        for (let i = markets.length - 1; i >= 0; i--) {
          if (String(markets[i]?.dex || '') === dexName) {
            const c = String(markets[i].coin || '').toUpperCase();
            markets.splice(i, 1);
            if (c) assetByCoin.delete(c);
          }
        }
        ingestUniverse(meta.universe, ctxs, dexName, dexIndex, assetByCoin, markets, mids, ctxMap);
        return true;
      } catch (e) {
        console.warn('[GROM HL] hip-only', dexName, e);
        return false;
      }
    };

    const publish = () => {
      markets.sort((a, b) => (b.dayNtlVlm || 0) - (a.dayNtlVlm || 0));
      markets.forEach((m, i) => { m.rank = i; });
      _meta = { assetByCoin, markets, rawDexes: dexList };
      window.__hlMids = mids;
      window.__hlCtx = ctxMap;
      window.__hlMarkets = markets;
      window.__hlAssetByCoin = assetByCoin;
      try {
        if (typeof window.renderMarketsEnhanced === 'function'
          && document.getElementById('page-markets')?.classList.contains('active')) {
          window.renderMarketsEnhanced();
        }
      } catch (_) {}
      try {
        if (typeof window.renderFuturesList === 'function') {
          window.renderFuturesList(document.querySelector('#page-futures .wl-search input')?.value || '');
        }
      } catch (_) {}
      try {
        applyMarketsToDesk();
      } catch (_) {}
    };

    await loadHip3Dexes(dexList, { loadOne, publish, assetByCoin });
    return markets.filter((m) => m && m.hip3).length;
  }

  function displaySpotCoin(tokenName) {
    const n = String(tokenName || '').toUpperCase();
    return UNIT_DISPLAY[n] || n;
  }

  async function ensureSpotMeta(force) {
    if (_spotMeta && !force) return _spotMeta;
    const data = await hlInfo({ type: 'spotMetaAndAssetCtxs' });
    const meta = Array.isArray(data) ? data[0] : data;
    const ctxs = Array.isArray(data) ? (data[1] || []) : [];
    const tokens = meta?.tokens || [];
    const universe = meta?.universe || [];
    const tokenByIndex = new Map();
    tokens.forEach((t) => { if (t && t.index != null) tokenByIndex.set(Number(t.index), t); });

    const assetBySym = new Map();
    const assetLookup = new Map();
    const markets = [];
    const mids = Object.create(null);
    const ctxMap = Object.create(null);
    const usedDisplay = new Set();
    const staged = [];

    universe.forEach((u) => {
      if (!u || u.isDelisted) return;
      const tids = u.tokens || [];
      const base = tokenByIndex.get(Number(tids[0]));
      const quote = tokenByIndex.get(Number(tids[1]));
      if (!base || !quote) return;
      if (String(quote.name || '').toUpperCase() !== 'USDC') return;
      const tokenName = String(base.name || '').toUpperCase();
      if (!tokenName || tokenName === 'USDC') return;
      const idx = Number(u.index);
      if (!Number.isFinite(idx) || idx < 0) return;
      const ctx = (Number.isFinite(idx) && ctxs[idx]) ? ctxs[idx] : {};
      staged.push({
        u,
        base,
        ctx,
        tokenName,
        vol: Number(ctx.dayNtlVlm || 0),
        mid: Number(ctx.midPx || ctx.markPx || 0),
      });
    });

    staged.sort((a, b) => b.vol - a.vol);
    staged.forEach((hit, i) => { hit.volRank = i; });

    const prepared = [];
    staged.forEach((hit) => {
      let coin = displaySpotCoin(hit.tokenName);
      if (usedDisplay.has(coin)) coin = hit.tokenName;
      usedDisplay.add(coin);
      prepared.push({ hit, coin });
    });
    prepared.sort((a, b) => {
      const pa = SPOT_PIN[a.coin] != null ? SPOT_PIN[a.coin] : 100;
      const pb = SPOT_PIN[b.coin] != null ? SPOT_PIN[b.coin] : 100;
      if (pa !== pb) return pa - pb;
      return a.hit.volRank - b.hit.volRank;
    });

    function rememberKey(key, rec, market) {
      const k = String(key || '').toUpperCase();
      if (!k) return;
      if (!assetBySym.has(k) && rec) assetBySym.set(k, rec);
      if (!assetLookup.has(k) && market) assetLookup.set(k, market);
    }

    prepared.forEach((item) => {
      const hit = item.hit;
      const coin = item.coin;
      const uniName = String(hit.u.name || '');
      const uniIndex = Number(hit.u.index);
      const assetId = 10000 + uniIndex;
      const szDecimals = hit.base.szDecimals != null ? Number(hit.base.szDecimals) : 4;
      const mid = hit.mid;
      const prev = Number(hit.ctx.prevDayPx || 0);
      const chg24 = (prev > 0 && mid > 0) ? ((mid / prev) - 1) * 100 : null;
      const sym = coin + '/USDC';
      const rec = {
        id: assetId,
        name: coin,
        tokenName: hit.tokenName,
        universeName: uniName,
        szDecimals,
        maxLeverage: 1,
        spot: true,
      };
      const market = {
        sym,
        coin,
        type: 'spot',
        spot: true,
        tokenName: hit.tokenName,
        universeName: uniName,
        fundingBase: 0,
        rank: hit.volRank,
        ai: coin === 'BTC' || coin === 'ETH' || coin === 'HYPE',
        fresh: coin === 'HYPE' || coin === 'PURR',
        maxLeverage: 1,
        szDecimals,
        assetId,
        dayNtlVlm: hit.vol,
        chg24,
        label: coin + 'USDC',
      };
      rememberKey(sym, rec, market);
      rememberKey(coin + '/USDC', rec, market);
      rememberKey(hit.tokenName + '/USDC', rec, market);
      rememberKey(coin, rec, market);
      rememberKey(hit.tokenName, rec, market);
      rememberKey(uniName, rec, market);
      rememberKey(market.label, rec, market);
      if (mid > 0) {
        mids[coin] = mid;
        mids[hit.tokenName] = mid;
        if (uniName) mids[uniName.toUpperCase()] = mid;
      }
      ctxMap[coin] = {
        markPx: Number(hit.ctx.markPx || mid),
        prevDayPx: prev,
        dayNtlVlm: hit.vol,
        szDecimals,
        id: assetId,
        universeName: uniName,
        tokenName: hit.tokenName,
        chg24,
        spot: true,
      };
      if (hit.tokenName !== coin) ctxMap[hit.tokenName] = ctxMap[coin];
      markets.push(market);
    });

    _spotMeta = { assetBySym, assetLookup, markets, raw: meta };
    window.__hlSpotMids = mids;
    window.__hlSpotCtx = ctxMap;
    window.__hlSpotMarkets = markets;
    window.__hlSpotAssetBySym = assetBySym;
    window.__hlSpotAssetLookup = assetLookup;
    return _spotMeta;
  }

  function spotAssetFromOrderCoin(hlCoin) {
    const raw = String(hlCoin || '').toUpperCase();
    if (!raw) return null;
    const lookup = _spotMeta?.assetLookup || window.__hlSpotAssetLookup;
    if (lookup) {
      if (lookup.has(raw)) return lookup.get(raw);
      const norm = normalizeSpotSym(raw);
      if (lookup.has(norm)) return lookup.get(norm);
    }
    const markets = window.__hlSpotMarkets || [];
    for (let i = 0; i < markets.length; i++) {
      const m = markets[i];
      if (!m) continue;
      if (String(m.universeName || '').toUpperCase() === raw) return m;
      if (String(m.tokenName || '').toUpperCase() === raw) return m;
      if (String(m.coin || '').toUpperCase() === raw) return m;
      if (String(m.sym || '').toUpperCase() === raw) return m;
    }
    return null;
  }

  function isSpotOrderCoin(hlCoin) {
    const raw = String(hlCoin || '');
    if (/^@\d+$/.test(raw)) return true;
    if (/\/USDC$/i.test(raw)) return true;
    return !!spotAssetFromOrderCoin(raw);
  }

  async function refreshMids() {
    try {
      // Lightweight price refresh: main allMids + active HIP-3 dex only (full universe on boot)
      const jobs = [hlInfo({ type: 'allMids' })];
      const pair = window.futDeskState?.pair || '';
      const coin = coinFromPair(pair);
      const dex = (window.__hlCtx && window.__hlCtx[coin] && window.__hlCtx[coin].dex) || '';
      if (dex) jobs.push(hlInfo({ type: 'allMids', dex }));
      const results = await Promise.all(jobs);
      results.forEach((mids) => {
        if (!mids || typeof mids !== 'object') return;
        Object.keys(mids).forEach((k) => {
          const n = Number(mids[k]);
          if (!(n > 0)) return;
          const key = String(k).toUpperCase();
          window.__hlMids[key] = n;
          const spotHit = spotAssetFromOrderCoin(key);
          if (spotHit) {
            window.__hlSpotMids[spotHit.coin] = n;
            if (spotHit.universeName) window.__hlSpotMids[String(spotHit.universeName).toUpperCase()] = n;
          }
        });
      });
      if (typeof window.renderFuturesList === 'function') {
        const q = document.querySelector('#page-futures .wl-search input');
        window.renderFuturesList(q ? q.value : '');
      }
      if (typeof window.updateFuturesBoard === 'function' && window.futDeskState) {
        window.updateFuturesBoard();
      }
      /* Push mid into active futures chart tip (HIP-3 has no Binance WS). */
      try {
        const futPage = document.getElementById('page-futures');
        if (futPage && futPage.classList.contains('active')
            && typeof window.scheduleDeskChartDraw === 'function') {
          window.scheduleDeskChartDraw('futChart');
        }
      } catch (_) {}
      const mkt = document.getElementById('page-markets');
      if (mkt && mkt.classList.contains('active') && typeof window.updateMarketsLiveRows === 'function') {
        try { window.updateMarketsLiveRows(); } catch (_) {}
      }
    } catch (e) {
      console.warn('[GROM HL] mids', e);
    }
  }

  async function maxBuilderFee(user, builder) {
    try {
      const v = await hlInfo({ type: 'maxBuilderFee', user, builder });
      if (typeof v === 'number') return v;
      return Number(v?.maxBuilderFee ?? v?.fee ?? 0) || 0;
    } catch (_) {
      return 0;
    }
  }

  function hlWalletLabel() {
    try {
      if (typeof window.gwConnectedWalletLabel === 'function') {
        const l = window.gwConnectedWalletLabel();
        if (l) return l;
      }
    } catch (_) {}
    return 'wallet';
  }

  /** HL requires the builder EOA to hold ≥ $100 perps equity before ApproveBuilderFee. */
  const HL_BUILDER_MIN_USD = 100;
  let _builderFundCache = { at: 0, ok: false, v: 0 };

  async function builderPerpsEquity(builder) {
    try {
      const st = await hlInfo({ type: 'clearinghouseState', user: builder });
      const mv = st?.marginSummary || st?.crossMarginSummary || {};
      return Number(mv.accountValue || 0) || 0;
    } catch (_) {
      return 0;
    }
  }

  async function isBuilderFunded(cfg) {
    const builder = cfg?.builder || BUILDER_FALLBACK;
    if (_builderFundCache.at && Date.now() - _builderFundCache.at < 60000) {
      return _builderFundCache.ok;
    }
    const v = await builderPerpsEquity(builder);
    _builderFundCache = { at: Date.now(), ok: v + 1e-9 >= HL_BUILDER_MIN_USD, v };
    return _builderFundCache.ok;
  }

  function humanizeHlSignError(e) {
    const raw = String((e && e.message) || e || '');
    const w = hlWalletLabel();
    if (isHlSignatureCancelled(e)) {
      return 'Signature cancelled in ' + w + ' — tap Sell/Buy again and confirm';
    }
    if (/insufficient balance to be approved/i.test(raw)) {
      return 'GROM builder needs ≥ $'
        + HL_BUILDER_MIN_USD
        + ' USDC on Hyperliquid Perps (platform fee account) — not your Spot balance. Trading continues without builder fee until funded.';
    }
    /* Never mask Hyperliquid CLOB / order errors as a Trust signature tip. */
    if (/insufficient|not enough|minimum order|Order must|Invalid nonce|tick size|lot size|oracle|perp|spot balance|margin|builder fee|underfunded|dust/i.test(raw)
        && !/32603|32000|Internal JSON-RPC|WCError|signTypedData/i.test(raw)) {
      return raw.length > 160 ? (raw.slice(0, 160) + '…') : raw;
    }
    if (/coalesce|32603|32000|5201|execution reverted|Internal JSON-RPC|WCError|unknown method|Missing or invalid|method.*not.*support|signTypedData|Unsupported wallet|An error has occurred|Please,?\s*try again/i.test(raw)) {
      return 'Подпись не дошла до '
        + w
        + '. Это не из‑за DRV/BTC — сессия WalletConnect устарела. Открой grom.exchange внутри Trust Browser или отключи кошелёк → Connect → Trust (QR), затем снова Sell.';
    }
    return raw.length > 160 ? (raw.slice(0, 160) + '…') : raw;
  }

  /** Sign HL action; on stale WC (32603 / missing typed-data) force reconnect once. */
  async function hlSignedAction(run) {
    try {
      return await run();
    } catch (e) {
      if (!isHlSignRetriable(e) || typeof window.gwEnsureSigningForSwap !== 'function') {
        throw new Error(humanizeHlSignError(e));
      }
      try {
        toast('Сессия Trust устарела — переподключи по QR, потом снова Sell', 'warn');
        await window.gwEnsureSigningForSwap({ force: true, reason: 'hl-resign', silent: false });
      } catch (re) {
        throw new Error(humanizeHlSignError(re));
      }
      try {
        return await run();
      } catch (e2) {
        throw new Error(humanizeHlSignError(e2));
      }
    }
  }

  /**
   * @returns {Promise<boolean>} true if builder fee may be attached to orders
   */
  async function ensureBuilderApproved(client, address, cfg) {
    if (!cfg?.enabled) return false;
    const builder = cfg.builder || BUILDER_FALLBACK;
    const need = Number(cfg.builderFeeTenthsBp || FEE_FALLBACK);
    const approved = await maxBuilderFee(address, builder);
    if (approved >= need) return true;

    /* Do not ask the user to sign ApproveBuilderFee when HL will reject it —
     * builder EOA must hold ≥ $100 perps equity (HL protocol rule). */
    if (!(await isBuilderFunded(cfg))) {
      console.warn('[GROM HL] builder underfunded', _builderFundCache.v);
      toast('Builder fee paused (platform) — order goes through without GROM fee', 'warn');
      return false;
    }

    const w = hlWalletLabel();
    if (!eth()?.request && typeof window.gwEnsureSigningForSwap === 'function') {
      try {
        await window.gwEnsureSigningForSwap({ reason: 'hl-builder-approve', silent: false });
      } catch (e) {
        throw new Error(humanizeHlSignError(e) || ('Reconnect ' + w + ', then tap Buy again'));
      }
    }
    if (!eth()?.request) {
      throw new Error(w + ' session offline — Connect again, then tap Buy');
    }
    const live = await getExchangeClient();
    toast('Open ' + w + ' · one-time «Approve GROM fee» (not a USDC transfer)', 'info');
    if (typeof live.approveBuilderFee !== 'function') {
      throw new Error('SDK missing approveBuilderFee');
    }
    try {
      if (typeof window.gwWakeWalletForSigning === 'function') {
        window.gwWakeWalletForSigning({ action: 'sign', chainLabel: 'Hyperliquid' });
      }
    } catch (_) {}
    try {
      await live.approveBuilderFee({
        builder,
        maxFeeRate: cfg.maxApproveFeePct || '0.1%',
      });
    } catch (e) {
      throw new Error(humanizeHlSignError(e));
    } finally {
      try {
        if (typeof window.gwHideRemoteSignCoach === 'function') window.gwHideRemoteSignCoach();
      } catch (_) {}
    }
    return true;
  }

  const ARB_USDC = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831';
  const HL_BRIDGE2 = '0x2Df1c51E09aECF9cacB7bc98cB1742757f163dF7';
  const HL_MIN_DEPOSIT_USD = 5;
  const ERC20_BAL = '0x70a08231';
  const HL_DESK_BAL_LS = 'grom_hl_desk_bal_v1';
  const HL_DESK_BAL_TTL_MS = 30 * 60 * 1000;
  let _arbUsdcCache = { at: 0, v: 0, addr: '' };

  function softWalletAddress() {
    try {
      if (typeof window.gwDisplayAddress === 'function') {
        const a = String(window.gwDisplayAddress() || '');
        if (/^0x[a-fA-F0-9]{40}$/.test(a)) return a;
      }
    } catch (_) {}
    try {
      if (typeof window.gwReadOnlyAddress === 'function') {
        const a = String(window.gwReadOnlyAddress() || '');
        if (/^0x[a-fA-F0-9]{40}$/.test(a)) return a;
      }
    } catch (_) {}
    try {
      if (typeof window.gwOcConnectedAddress === 'function') {
        const a = String(window.gwOcConnectedAddress() || '');
        if (/^0x[a-fA-F0-9]{40}$/.test(a)) return a;
      }
    } catch (_) {}
    try {
      const a = String(localStorage.getItem('grom_wallet_label') || '');
      if (/^0x[a-fA-F0-9]{40}$/.test(a)) return a;
    } catch (_) {}
    return '';
  }

  function readDeskBalCache(addr) {
    try {
      const o = JSON.parse(localStorage.getItem(HL_DESK_BAL_LS) || 'null');
      if (!o || !(o.at > 0) || Date.now() - o.at > HL_DESK_BAL_TTL_MS) return null;
      if (addr && o.addr && String(o.addr).toLowerCase() !== String(addr).toLowerCase()) return null;
      return o;
    } catch (_) { return null; }
  }

  function writeDeskBalCache(addr, perpUsd, spotUsd, arbUsd) {
    if (!addr || !/^0x[a-fA-F0-9]{40}$/.test(addr)) return;
    try {
      localStorage.setItem(HL_DESK_BAL_LS, JSON.stringify({
        at: Date.now(),
        addr: String(addr).toLowerCase(),
        perpUsd: Number(perpUsd) || 0,
        spotUsd: Number(spotUsd) || 0,
        arbUsd: Number(arbUsd) || 0,
      }));
    } catch (_) {}
  }

  /** Paint risk row + pills from last-known HL balances (no network). */
  function paintCachedDeskBalances() {
    const addr = softWalletAddress();
    if (!addr) return false;
    let perpUsd = null;
    let spotUsd = null;
    let arbUsd = 0;
    const cached = readDeskBalCache(addr);
    if (cached) {
      perpUsd = Number(cached.perpUsd) || 0;
      /* Desk Spot pill = USDC cash only (never portfolio equity). */
      spotUsd = Number(cached.spotUsd) || 0;
      arbUsd = Number(cached.arbUsd) || 0;
    }
    try {
      const hl = window.GW_MP_CACHE && window.GW_MP_CACHE.hl && window.GW_MP_CACHE.hl.val;
      if (hl && hl.ready !== false) {
        if (perpUsd == null || (Number(hl.perp) || 0) > 0) perpUsd = Number(hl.perp) || perpUsd || 0;
        /* Prefer spotUsdc when present — hl.spot may be mark equity of coins. */
        const cash = Number(hl.spotUsdc != null ? hl.spotUsdc : NaN);
        if (Number.isFinite(cash)) spotUsd = cash;
        else if (spotUsd == null) spotUsd = 0;
      }
    } catch (_) {}
    if (perpUsd == null && spotUsd == null) return false;
    perpUsd = Number(perpUsd) || 0;
    spotUsd = Number(spotUsd) || 0;
    paintDeskBalanceUi({
      connected: true,
      spotMode: isSpotMode(),
      perpUsd,
      spotUsd,
      arbUsd,
      stale: true,
    });
    return true;
  }

  function paintDeskBalanceUi(opts) {
    const connected = !!(opts && opts.connected);
    const spot = !!(opts && opts.spotMode);
    const perpUsd = Number(opts && opts.perpUsd) || 0;
    const spotUsd = Number(opts && opts.spotUsd) || 0;
    const arbUsd = Number(opts && opts.arbUsd) || 0;
    const av = spot ? spotUsd : perpUsd;
    const used = spot ? Number(opts && opts.spotHold) || 0 : Number(opts && opts.perpUsed) || 0;
    const withdrawable = spot
      ? Math.max(0, spotUsd - used)
      : (opts && opts.perpWithdrawable != null ? Number(opts.perpWithdrawable) : perpUsd);

    const riskLbl = document.getElementById('futRiskLbl');
    if (riskLbl) riskLbl.textContent = spot ? 'Spot USDC' : 'HL margin used';
    const risk = document.querySelector('#page-futures .risk-gov .row span.mono');
    if (risk && connected) {
      if (spot) {
        risk.textContent = '$' + spotUsd.toFixed(2) + ' USDC · Spot';
      } else {
        risk.textContent = '$' + used.toFixed(2) + ' / $' + perpUsd.toFixed(2) + ' HL';
      }
    }
    const wd = document.getElementById('futHlWithdrawable');
    if (wd && connected) {
      wd.textContent = '$' + withdrawable.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    }
    const bar = document.querySelector('#page-futures .risk-gov .bar > span');
    if (bar && connected) {
      const pct = av > 0 ? Math.min(100, Math.round((used / av) * 100)) : 0;
      bar.style.width = pct + '%';
    }
    paintWalletArbUsdc(arbUsd, av, { connected, perpUsd, spotUsd });
  }

  function openFundSwap() {
    const page = document.getElementById('page-futures');
    const arb = Number(page && page.dataset.arbUsd) || 0;
    const need = Math.max(HL_MIN_DEPOSIT_USD + 0.5 - arb, 5);
    if (typeof window.gwOpenTargetSwap === 'function') {
      window.gwOpenTargetSwap({
        toSym: 'USDC',
        toChainId: 42161,
        toAddress: ARB_USDC,
        toDecimals: 6,
        amountUsd: Math.ceil(need),
        forceBridge: true,
        source: 'futures',
        hint: 'Pay with any token · YOU RECEIVE native USDC on Arbitrum (HL min $'
          + HL_MIN_DEPOSIT_USD + ')',
      });
      return;
    }
    try {
      if (typeof window.show === 'function') window.show('dashboard');
      else location.hash = '#dashboard';
    } catch (_) {
      location.hash = '#dashboard';
    }
  }

  function showFundGuide(/* on */) {
    const banner = document.getElementById('hlFundBanner');
    if (banner) banner.setAttribute('hidden', '');
  }

  function hlFundLang() {
    try {
      const l = (localStorage.getItem('grom_lang') || '').slice(0, 2);
      if (l === 'ru') return { perp: 'Пополнить Perp', spot: 'Пополнить Spot' };
    } catch (_) {}
    return { perp: 'Fund Perp', spot: 'Fund Spot' };
  }

  function openHlFund(dst) {
    const page = document.getElementById('page-futures');
    const arb = Number(page && page.dataset.arbUsd) || 0;
    const perp = Number(page && page.dataset.hlPerpUsd) || 0;
    const spot = Number(page && page.dataset.hlSpotUsd) || 0;
    const to = dst === 'spot' ? 'spot' : 'perp';
    const sources = [
      ['wallet', arb],
      ['perp', perp],
      ['spot', spot],
    ].filter(([id]) => id !== to);
    const wallet = sources.find(([id]) => id === 'wallet');
    let from = 'wallet';
    if (wallet && wallet[1] + 1e-9 >= 5) {
      from = 'wallet';
    } else {
      sources.sort((a, b) => b[1] - a[1]);
      from = sources[0] && sources[0][1] >= 0.01 ? sources[0][0] : 'wallet';
    }
    if (typeof window.gwOpenWalletTransferHub === 'function') {
      window.gwOpenWalletTransferHub({ from, to, pin: true });
      return;
    }
    try {
      if (typeof window.show === 'function') window.show('wallet');
      else location.hash = '#wallet';
    } catch (_) { location.hash = '#wallet'; }
  }

  function padAddr(a) {
    return String(a || '').toLowerCase().replace(/^0x/, '').padStart(64, '0');
  }
  function padUint(n) {
    let h = (typeof n === 'bigint' ? n : BigInt(Math.floor(Number(n) || 0))).toString(16);
    if (h.length > 64) h = h.slice(-64);
    return h.padStart(64, '0');
  }

  async function fetchArbUsdc(address) {
    const addr = String(address || '').toLowerCase();
    if (!/^0x[a-f0-9]{40}$/.test(addr)) return 0;
    if (_arbUsdcCache.addr === addr && Date.now() - _arbUsdcCache.at < 20000) {
      return _arbUsdcCache.v;
    }
    const data = ERC20_BAL + padAddr(addr);
    const urls = [
      'https://arb1.arbitrum.io/rpc',
      'https://rpc.ankr.com/arbitrum',
      'https://1rpc.io/arb',
    ];
    for (const url of urls) {
      try {
        const r = await fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0', id: 1, method: 'eth_call',
            params: [{ to: ARB_USDC, data }, 'latest'],
          }),
        });
        const j = await r.json();
        if (j && j.result) {
          const v = Number(BigInt(j.result)) / 1e6;
          _arbUsdcCache = { at: Date.now(), v, addr };
          return v;
        }
      } catch (_) {}
    }
    return _arbUsdcCache.addr === addr ? _arbUsdcCache.v : 0;
  }

  function moneyUsd(n) {
    return '$' + Number(n || 0).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function paintWalletArbUsdc(arbUsd, hlUsd, opts) {
    const page = document.getElementById('page-futures');
    let connected = !!(opts && opts.connected);
    if (!opts || opts.connected == null) {
      try {
        if (window.GROM_CONN && window.GROM_CONN.connected) connected = true;
        else if (typeof window.gwDisplayAddress === 'function' && window.gwDisplayAddress()) connected = true;
        else if (typeof window.gwReadOnlyAddress === 'function' && window.gwReadOnlyAddress()) connected = true;
      } catch (_) {}
    }
    if (page) {
      page.dataset.walletConnected = connected ? '1' : '0';
      page.dataset.hlBalKnown = connected ? '1' : '0';
      if (connected) {
        page.dataset.hlUsd = String(hlUsd || 0);
        page.dataset.arbUsd = String(arbUsd || 0);
        page.dataset.hlPerpUsd = String((opts && opts.perpUsd) || 0);
        page.dataset.hlSpotUsd = String((opts && opts.spotUsd) || 0);
      } else {
        page.dataset.hlUsd = '';
        page.dataset.arbUsd = '';
      }
    }
    try {
      if (typeof window.updateFutCtaState === 'function') window.updateFutCtaState();
    } catch (_) {}
    const line = document.getElementById('hlWalletArbLine');
    if (line) {
      if (!connected) {
        line.textContent = 'Wallet Arb USDC: — · HL Trade: —';
      } else {
        line.textContent = 'Wallet Arb USDC: ' + moneyUsd(arbUsd)
          + ' · HL Trade: ' + moneyUsd(hlUsd)
          + (arbUsd > 0 && arbUsd < HL_MIN_DEPOSIT_USD && hlUsd < 1
            ? ' · min deposit $' + HL_MIN_DEPOSIT_USD
            : '');
      }
    }
    const title = document.getElementById('hlFundBannerTitle');
    const text = document.getElementById('hlFundBannerText');
    const depBtn = document.getElementById('hlFundDepositBtn');
    const swapBtn = document.getElementById('hlFundSwapBtn');
    const perpUsd = (opts && opts.perpUsd != null) ? Number(opts.perpUsd) || 0 : Number(hlUsd) || 0;
    const spotUsd = (opts && opts.spotUsd != null) ? Number(opts.spotUsd) || 0 : Number(hlUsd) || 0;
    /* The idle balance lives on the other HL account: the spot tab pulls from
     * perp margin, the perp tab pulls from spot. Fixed by an internal transfer,
     * not by another Arbitrum deposit. */
    const spotMode = isSpotMode();
    const moveSrc = spotMode ? perpUsd : spotUsd;
    const moveUsd = Math.floor(moveSrc * 100) / 100;
    const canMove = connected && moveSrc >= 1;
    const needMove = canMove && hlUsd < 1;
    const canDeposit = connected && arbUsd + 1e-9 >= HL_MIN_DEPOSIT_USD;
    if (title) {
      if (!connected) title.textContent = 'Connect wallet';
      else if (needMove) title.textContent = 'USDC sits in ' + (spotMode ? 'Perp' : 'Spot');
      else if (hlUsd >= 1) title.textContent = 'Hyperliquid funded';
      else title.textContent = canDeposit ? 'Ready to deposit' : 'No Hyperliquid USDC';
    }
    if (text) {
      if (!connected) {
        text.textContent = 'Connect your wallet first — then we check Arbitrum USDC and Hyperliquid balance.';
      } else if (needMove) {
        text.textContent = 'Your ' + moneyUsd(moveSrc) + ' is on the ' + (spotMode ? 'Perp' : 'Spot')
          + ' account. Open Wallet and transfer to ' + (spotMode ? 'Spot' : 'Perp')
          + ' — or tap Move here (one signature, no on-chain fee).';
      } else if (hlUsd >= 1) {
        text.textContent = 'HL balance ' + moneyUsd(hlUsd) + ' — you can trade.'
          + (canDeposit ? (' Wallet has ' + moneyUsd(arbUsd) + ' Arb USDC for a top-up in Wallet → Transfer.') : '');
      } else if (canDeposit) {
        text.textContent = 'You have ' + moneyUsd(arbUsd)
          + ' native USDC on Arbitrum. Open Wallet → Transfer to Perp (min $'
          + HL_MIN_DEPOSIT_USD + '), or Deposit here.';
      } else if (arbUsd > 0) {
        text.textContent = 'Wallet has ' + moneyUsd(arbUsd)
          + ' Arb USDC, but HL min deposit is $' + HL_MIN_DEPOSIT_USD
          + '. Swap to add more, then transfer in Wallet.';
      } else {
        text.textContent = 'Get native USDC on Arbitrum (min $'
          + HL_MIN_DEPOSIT_USD + '), then open Wallet and transfer to Perp/Spot.';
      }
    }
    if (depBtn) {
      depBtn.style.display = canDeposit ? '' : 'none';
      depBtn.classList.toggle('primary', !needMove);
      depBtn.textContent = canDeposit
        ? ('Deposit ' + moneyUsd(Math.floor(arbUsd * 100) / 100) + ' to HL')
        : 'Deposit to HL';
      depBtn.title = 'Sends wallet Arbitrum USDC to the HL bridge — lands on Perp margin';
    }
    const moveBtn = document.getElementById('hlFundMoveBtn');
    if (moveBtn) {
      moveBtn.style.display = canMove ? '' : 'none';
      moveBtn.classList.toggle('primary', needMove);
      moveBtn.dataset.moveUsd = canMove ? String(moveUsd) : '';
      moveBtn.dataset.toPerp = spotMode ? '0' : '1';
      moveBtn.textContent = 'Move ' + moneyUsd(moveUsd) + ' to ' + (spotMode ? 'Spot' : 'Perp');
      moveBtn.title = 'Internal Hyperliquid transfer — one wallet signature, no on-chain fee';
    }
    if (swapBtn) {
      swapBtn.textContent = !connected
        ? 'Connect Wallet'
        : (arbUsd >= HL_MIN_DEPOSIT_USD ? 'Get more USDC' : 'Get USDC · Swap');
      swapBtn.dataset.needConnect = connected ? '0' : '1';
    }
    const walletBtn = document.getElementById('hlFundWalletBtn');
    if (walletBtn) {
      walletBtn.style.display = connected ? '' : 'none';
      walletBtn.dataset.from = needMove ? (spotMode ? 'perp' : 'spot') : 'wallet';
      walletBtn.dataset.to = needMove ? (spotMode ? 'spot' : 'perp') : 'perp';
      walletBtn.textContent = needMove
        ? ('Wallet · ' + (spotMode ? 'Perp → Spot' : 'Spot → Perp'))
        : 'Wallet · Transfer';
    }
    /* Perp and spot pills must show their own account — painting both from the
     * active tab made Spot claim the perp margin it cannot trade with. */
    const perpTxt = connected ? moneyUsd(perpUsd) : '—';
    const spotTxt = connected ? moneyUsd(spotUsd) : '—';
    document.querySelectorAll('#page-futures .acct-switch.fut-perp-only .bal').forEach((el, i) => {
      if (i === 0) {
        el.textContent = perpTxt;
        el.title = connected
          ? ('Hyperliquid perp margin ' + perpTxt
            + (arbUsd > 0 ? (' · wallet Arb ' + moneyUsd(arbUsd)) : ''))
          : 'Connect wallet to load Hyperliquid balance';
      }
    });
    const spotBal = document.querySelector('#futSpotBalSwitch .bal');
    if (spotBal) {
      spotBal.textContent = spotTxt;
      spotBal.title = connected
        ? ('Hyperliquid spot ' + spotTxt
          + (arbUsd > 0 ? (' · wallet Arb ' + moneyUsd(arbUsd)) : ''))
        : 'Connect wallet to load Hyperliquid balance';
    }
    if (page && connected) {
      page.dataset.hlPerpUsd = String(perpUsd);
      page.dataset.hlSpotUsd = String(spotUsd);
    }
    const labels = hlFundLang();
    const perpBtn = document.getElementById('hlFundPerpBtn');
    const spotBtn = document.getElementById('hlFundSpotBtn');
    if (perpBtn) perpBtn.textContent = labels.perp;
    if (spotBtn) spotBtn.textContent = labels.spot;
    showFundGuide(false);
  }

  async function ensureArb(provider) {
    let p = provider || eth();
    /* After a reload the address chip is soft-restored but the WC signing
     * session is not. Swap re-opens the connect flow here; deposit used to
     * just throw "Connect wallet first". */
    if (!p?.request && typeof window.gwEnsureSigningForSwap === 'function') {
      toast('Reconnect the wallet to sign the deposit…', 'info');
      try {
        await window.gwEnsureSigningForSwap({ reason: 'hl-deposit', silent: false });
      } catch (_) {}
      p = eth();
    }
    if (!p?.request) throw new Error('Connect wallet first');
    let cid = 0;
    try { cid = parseInt(await p.request({ method: 'eth_chainId' }), 16) || 0; } catch (_) {}
    if (cid === 42161) return p;
    toast('Switch wallet to Arbitrum…', 'info');
    try {
      await p.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0xa4b1' }] });
    } catch (e) {
      if (e && (e.code === 4902 || /unrecognized|unknown chain/i.test(String(e.message || e)))) {
        await p.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: '0xa4b1',
            chainName: 'Arbitrum One',
            nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
            rpcUrls: ['https://arb1.arbitrum.io/rpc'],
            blockExplorerUrls: ['https://arbiscan.io'],
          }],
        });
      } else {
        throw new Error('Switch wallet to Arbitrum One to deposit');
      }
    }
    return p;
  }

  async function depositArbUsdcToHl(amountUsd) {
    /* Soft chip (address in UI) ≠ live Trust session. Without this, Transfer
     * looks clicked but no wallet popup appears — getAddress() falls back to
     * localStorage while eth_sendTransaction has no provider. */
    if (typeof window.gwEnsureSigningForSwap === 'function') {
      try {
        await window.gwEnsureSigningForSwap({ reason: 'hl-deposit', silent: false });
      } catch (e) {
        const w = hlWalletLabel();
        throw (e instanceof Error) ? e : new Error('Reconnect ' + w + ', then tap Transfer again');
      }
    }
    if (!eth()?.request) {
      throw new Error(hlWalletLabel() + ' session offline — Connect again, then tap Transfer');
    }
    const address = await getAddress();
    if (!address) throw new Error('Connect wallet first');
    const arb = await fetchArbUsdc(address);
    const want = amountUsd != null ? Number(amountUsd) : arb;
    const amt = Math.floor(Math.min(arb, want) * 1e6) / 1e6;
    if (!(amt >= HL_MIN_DEPOSIT_USD)) {
      const err = new Error('Hyperliquid min deposit is $' + HL_MIN_DEPOSIT_USD
        + ' · wallet has $' + arb.toFixed(2) + ' — swap to add USDC first');
      err.code = 'HL_MIN_DEPOSIT';
      throw err;
    }
    const provider = await ensureArb();
    const raw = BigInt(Math.floor(amt * 1e6));
    /* Hyperliquid credits a plain USDC transfer to Bridge2 and keys it off
     * msg.sender. batchedDepositWithPermit (the old path here) needs a real
     * permit signature — with zeroed r/s/v it mined as a no-op success and
     * moved nothing, which is why deposits never landed. */
    const data = '0xa9059cbb' + padAddr(HL_BRIDGE2) + padUint(raw);
    const walletLbl = (typeof window.gwConnectedWalletLabel === 'function')
      ? window.gwConnectedWalletLabel()
      : 'your wallet';
    toast('Open ' + walletLbl + ' and confirm the $' + amt.toFixed(2)
      + ' deposit — the request will not pop up in this window', 'info');
    try {
      if (typeof window.gwWakeWalletForSigning === 'function') {
        window.gwWakeWalletForSigning({ action: 'tx', chainLabel: 'Arbitrum' });
      }
    } catch (_) {}
    const sendTx = window.gwProviderSendTx
      || ((p, tx) => p.request({ method: 'eth_sendTransaction', params: [tx] }));
    let hash;
    try {
      hash = await sendTx(provider, {
        from: address,
        to: ARB_USDC,
        data,
        value: '0x0',
      }, 180000, 42161);
    } finally {
      try {
        if (typeof window.gwHideRemoteSignCoach === 'function') window.gwHideRemoteSignCoach();
      } catch (_) {}
    }
    _arbUsdcCache = { at: 0, v: 0, addr: '' };
    toast('Deposit submitted · waiting for HL credit…', 'success');
    for (let i = 0; i < 12; i++) {
      await new Promise((r) => setTimeout(r, 5000));
      try {
        const sum = await accountSummary();
        if (sum && Number(sum.accountValue) >= 1) {
          await syncDeskState();
          toast('HL funded · ' + moneyUsd(sum.accountValue), 'success');
          return { hash, credited: Number(sum.accountValue) };
        }
      } catch (_) {}
    }
    await syncDeskState();
    return { hash, credited: 0 };
  }

  /** HL → Arbitrum wallet withdrawal (signed action, $1 HL fee, ~5 min). */
  const HL_MIN_WITHDRAW_USD = 2;
  async function withdrawToWallet(amountUsd) {
    const amt = Math.floor((Number(amountUsd) || 0) * 100) / 100;
    if (!(amt >= HL_MIN_WITHDRAW_USD)) {
      throw new Error('Hyperliquid withdrawal minimum is $' + HL_MIN_WITHDRAW_USD + ' (includes $1 fee)');
    }
    const address = await getAddress();
    const client = await getExchangeClient();
    if (typeof client.withdraw3 !== 'function') {
      throw new Error('SDK has no withdraw3 — reload the page');
    }
    const walletLbl = (typeof window.gwConnectedWalletLabel === 'function')
      ? window.gwConnectedWalletLabel()
      : 'your wallet';
    toast('Open ' + walletLbl + ' and sign the withdrawal — the request will not pop up in this window', 'info');
    try {
      if (typeof window.gwWakeWalletForSigning === 'function') {
        window.gwWakeWalletForSigning({ action: 'sign', chainLabel: 'Hyperliquid' });
      }
      await client.withdraw3({ amount: String(amt), destination: String(address).toLowerCase() });
    } finally {
      try {
        if (typeof window.gwHideRemoteSignCoach === 'function') window.gwHideRemoteSignCoach();
      } catch (_) {}
    }
    _arbUsdcCache = { at: 0, v: 0, addr: '' };
    toast('Withdrawal sent · ' + moneyUsd(amt) + ' arrives on Arbitrum in ~5 min (−$1 fee)', 'success');
    try { await syncDeskState(); } catch (_) {}
    return { amount: amt };
  }

  /** Balances behind the wallet transfer hub: on-chain USDC, perp margin, spot. */
  async function balancesSnapshot() {
    let address = '';
    try { address = await getAddress(); } catch (_) {}
    try { await ensureSpotMeta(); } catch (_) {}
    const [arbUsdc, perp, spot] = await Promise.all([
      address ? fetchArbUsdc(address).catch(() => 0) : Promise.resolve(0),
      accountSummary().catch(() => null),
      spotAccountSummary().catch(() => null),
    ]);
    const holdings = holdingsFromSpotSum(spot);
    const coins = holdings.filter((h) => String(h.coin || '').toUpperCase() !== 'USDC');
    const usdc = spot ? Number(spot.accountValue || 0) : 0;
    const equity = spot ? Number(spot.equityUsd != null ? spot.equityUsd : usdc) : 0;
    return {
      address,
      wallet: Number(arbUsdc) || 0,
      perp: perp ? Number(perp.accountValue || 0) : 0,
      perpFree: perp ? Number(perp.withdrawable || 0) : 0,
      /* Transfer Max uses USDC only — coins must be sold first. */
      spot: usdc,
      spotEquity: equity,
      spotCoins: coins.map((h) => ({
        coin: h.coin,
        contract: h.contract,
        size: Number(h.size || 0),
        mark: Number(h.mark_price || 0),
        value: Number(h.margin_usdt || 0),
        id: h.id,
      })),
      minDeposit: HL_MIN_DEPOSIT_USD,
      minWithdraw: HL_MIN_WITHDRAW_USD,
    };
  }

  /**
   * One entry point for every wallet ⇄ perp ⇄ spot move. Hyperliquid only
   * bridges into perp margin, so wallet↔spot is composed of two legs.
   */
  async function transferFunds(from, to, amountUsd, onStep) {
    const src = String(from || '').toLowerCase();
    const dst = String(to || '').toLowerCase();
    const amt = Math.floor((Number(amountUsd) || 0) * 100) / 100;
    if (src === dst) throw new Error('Pick two different accounts');
    if (!(amt > 0)) throw new Error('Enter an amount');
    const step = (msg) => { try { if (typeof onStep === 'function') onStep(msg); } catch (_) {} };

    if (src === 'wallet' && dst === 'perp') {
      step('Depositing to Hyperliquid…');
      return depositArbUsdcToHl(amt);
    }
    if (src === 'wallet' && dst === 'spot') {
      step('Step 1/2 · deposit to Hyperliquid…');
      await depositArbUsdcToHl(amt);
      step('Step 2/2 · moving to Spot…');
      return moveUsdClass(amt, false);
    }
    if (src === 'perp' && dst === 'spot') {
      step('Moving to Spot…');
      return moveUsdClass(amt, false);
    }
    if (src === 'spot' && dst === 'perp') {
      step('Moving to Perp…');
      return moveUsdClass(amt, true);
    }
    if (src === 'perp' && dst === 'wallet') {
      step('Withdrawing to Arbitrum…');
      return withdrawToWallet(amt);
    }
    if (src === 'spot' && dst === 'wallet') {
      step('Step 1/2 · moving to Perp…');
      await moveUsdClass(amt, true);
      step('Step 2/2 · withdrawing to Arbitrum…');
      const out = await withdrawToWallet(amt);
      try { notifyHlBalancesChanged(); } catch (_) {}
      return out;
    }
    throw new Error('Unsupported transfer: ' + src + ' → ' + dst);
  }

  /** Internal HL transfer between perp margin and spot balance (usdClassTransfer). */
  async function moveUsdClass(amountUsd, toPerp) {
    const amt = Math.floor((Number(amountUsd) || 0) * 100) / 100;
    if (!(amt > 0)) throw new Error('Nothing to move');
    const from = toPerp ? 'Spot' : 'Perp';
    const to = toPerp ? 'Perp' : 'Spot';
    const client = await getExchangeClient();
    const walletLbl = (typeof window.gwConnectedWalletLabel === 'function')
      ? window.gwConnectedWalletLabel()
      : 'your wallet';
    toast('Open ' + walletLbl + ' and sign the ' + from + ' → ' + to
      + ' transfer — the request will not pop up in this window', 'info');
    if (typeof client.usdClassTransfer !== 'function') {
      throw new Error('SDK has no usdClassTransfer — reload the page');
    }
    /* ethers signs the typed data straight on the provider, so the usual
     * "confirm in wallet" coach has to be raised by hand here. */
    let resp;
    try {
      if (typeof window.gwWakeWalletForSigning === 'function') {
        window.gwWakeWalletForSigning({ action: 'sign', chainLabel: 'Hyperliquid' });
      }
      resp = await client.usdClassTransfer({ amount: String(amt), toPerp: !!toPerp });
    } finally {
      try {
        if (typeof window.gwHideRemoteSignCoach === 'function') window.gwHideRemoteSignCoach();
      } catch (_) {}
    }
    toast('Moved ' + moneyUsd(amt) + ' to ' + to, 'success');
    /* HL credits the other account within a second or two. */
    for (let i = 0; i < 6; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      const sum = await (toPerp ? accountSummary() : spotAccountSummary()).catch(() => null);
      if (sum && Number(sum.accountValue || 0) >= amt * 0.9) break;
    }
    try { await syncDeskState(); } catch (_) {}
    return resp;
  }

  async function ensureMarginOrGuide(reduceOnly, opts) {
    if (reduceOnly) return true;
    if (opts && opts.spot) {
      const sum = await spotAccountSummary().catch(() => null);
      const avail = sum ? Number(sum.accountValue || 0) : 0;
      if (avail < 1) {
        showFundGuide(true);
        const perp = await accountSummary().catch(() => null);
        const perpAvail = perp ? Number(perp.withdrawable || perp.accountValue || 0) : 0;
        const err = new Error(perpAvail >= 1
          ? ('Spot balance is empty — your ' + moneyUsd(perpAvail)
            + ' is on the Perp account. Use "Move to Spot" in the banner above.')
          : 'No USDC on Hyperliquid spot. Swap/bridge USDC on Arbitrum, then deposit to HL.');
        err.code = 'HL_NO_MARGIN';
        throw err;
      }
      showFundGuide(false);
      return true;
    }
    const sum = await accountSummary().catch(() => null);
    const avail = sum ? Number(sum.accountValue || 0) : 0;
    if (avail < 1) {
      showFundGuide(true);
      const err = new Error('No USDC margin on Hyperliquid. Swap/bridge USDC on Arbitrum, then deposit to HL.');
      err.code = 'HL_NO_MARGIN';
      throw err;
    }
    showFundGuide(false);
    return true;
  }

  /* HL rejects anything under $10 notional with a raw API error — say it upfront. */
  const HL_MIN_ORDER_USD = 10;
  function assertHlMinOrderValue(size, px) {
    const notional = (Number(size) || 0) * (Number(px) || 0);
    /* Round to cents — float mid≠limit can yield 9.999… for a $10 quote input. */
    if (notional > 0 && Math.round(notional * 100) < HL_MIN_ORDER_USD * 100) {
      const err = new Error('Hyperliquid minimum order is $' + HL_MIN_ORDER_USD
        + ' — this one is ' + moneyUsd(notional) + '. Increase size.');
      err.code = 'HL_MIN_ORDER';
      throw err;
    }
  }

  async function placeSpotOrder({ side, pair, size, reduceOnly, postOnly, price, type }) {
    const cfg = await fetchConfig();
    if (!cfg.enabled) throw new Error('Hyperliquid builder not configured');
    const meta = await ensureSpotMeta();
    const asset = meta.assetBySym.get(normalizeSpotSym(pair));
    if (!asset) throw new Error('Not listed on Hyperliquid spot: ' + pair);

    const address = await getAddress();
    const isBuy = side === 'buy' || side === 'long';
    if (isBuy) await ensureMarginOrGuide(!!reduceOnly, { spot: true });
    assertHlMinOrderValue(size, Number(price) || Number(window.__hlSpotMids[asset.name] || 0));

    /* Force a live WC signing session before EIP-712 (stale provider → 32603). */
    try {
      if (typeof window.gwClearWcDeepLinkChoice === 'function') window.gwClearWcDeepLinkChoice();
      if (typeof window.gwEnsureSigningForSwap === 'function') {
        await window.gwEnsureSigningForSwap({ reason: 'hl-spot-order', silent: false });
      }
    } catch (e) {
      throw new Error(humanizeHlSignError(e) || 'Reconnect wallet, then tap Sell/Buy again');
    }

    let client = await getExchangeClient();
    const useBuilder = await ensureBuilderApproved(client, address, cfg);
    client = await getExchangeClient();

    const mid = Number(window.__hlSpotMids[asset.name] || window.__hlSpotMids[String(asset.universeName || '').toUpperCase()] || 0);
    if (!(mid > 0)) throw new Error('No mid price for ' + asset.name);

    let px = Number(price);
    const isMarket = !type || type === 'market' || !price;
    if (!Number.isFinite(px) || isMarket) {
      px = mid * (isBuy ? 1.01 : 0.99);
    }

    /* Quote→base then formatSz often floors BTC to 0.00012 → ~$9.93 notional.
     * Size must clear $10 *after* wire formatting of both px and sz. */
    const szDec = Math.max(0, Number(asset.szDecimals) || 0);
    const tick = Math.pow(10, -szDec);
    let orderSz = Number(size) || 0;

    /* Spot sell: never bump size above holdings (min-$10 bump would oversell). */
    let holdCap = 0;
    if (!isBuy) {
      try {
        const coinU = String(asset.name || '').toUpperCase();
        ((window.__gromFuturesState && window.__gromFuturesState.positions) || []).forEach((p) => {
          if (String(p.coin || '').toUpperCase() === coinU) {
            holdCap += Math.abs(Number(p.size || p.szi || 0));
          }
        });
        if (!(holdCap > 0)) {
          const holdings = await listSpotHoldings().catch(() => []);
          holdings.forEach((p) => {
            if (String(p.coin || '').toUpperCase() === coinU) {
              holdCap += Math.abs(Number(p.size || p.szi || 0));
            }
          });
        }
      } catch (_) {}
      if (!(holdCap > 0)) throw new Error('No ' + asset.name + ' to sell');
      if (orderSz > holdCap) orderSz = holdCap;
    }

    const minSz = Math.ceil((HL_MIN_ORDER_USD / px) * Math.pow(10, szDec) - 1e-12) / Math.pow(10, szDec);
    if (!(orderSz >= minSz)) {
      if (!isBuy && holdCap + 1e-12 < minSz) {
        const err = new Error(
          asset.name + ' holding is below Hyperliquid min sell (~$' + HL_MIN_ORDER_USD + ')'
        );
        err.code = 'HL_DUST';
        throw err;
      }
      if (isBuy) orderSz = minSz;
    }
    let wirePx = formatPx(px, szDec, true);
    let wireSz = formatSz(orderSz, szDec);
    if (isBuy) {
      for (let i = 0; i < 20 && Number(wireSz) * Number(wirePx) + 1e-9 < HL_MIN_ORDER_USD; i++) {
        orderSz += tick;
        wireSz = formatSz(orderSz, szDec);
      }
    } else {
      /* Sell: floor to holdings; if under $10 after format, fail clearly. */
      if (holdCap > 0 && Number(wireSz) > holdCap) {
        orderSz = holdCap;
        wireSz = formatSz(orderSz, szDec);
      }
      if (Number(wireSz) * Number(wirePx) + 1e-9 < HL_MIN_ORDER_USD) {
        const err = new Error(
          'Sell notional ~$'
          + (Number(wireSz) * Number(wirePx)).toFixed(2)
          + ' — Hyperliquid min is $' + HL_MIN_ORDER_USD
        );
        err.code = 'HL_MIN_ORDER';
        throw err;
      }
    }

    let tif = 'Gtc';
    if (isMarket) tif = 'Ioc';
    else if (postOnly) tif = 'Alo';

    const order = {
      a: asset.id,
      b: isBuy,
      p: wirePx,
      s: wireSz,
      r: !!reduceOnly,
      t: { limit: { tif } },
    };

    toast(isBuy ? 'Confirm in wallet · Spot buy' : 'Confirm in wallet · Spot sell', 'info');
    try {
      if (typeof window.gwWakeWalletForSigning === 'function') {
        window.gwWakeWalletForSigning({ action: 'sign', chainLabel: 'Hyperliquid Spot' });
      }
    } catch (_) {}
    const orderReq = {
      orders: [order],
      grouping: 'na',
    };
    if (useBuilder) {
      orderReq.builder = {
        b: cfg.builder,
        f: Number(cfg.builderFeeTenthsBp || FEE_FALLBACK),
      };
    }
    const resp = await hlSignedAction(async () => {
      const live = await getExchangeClient();
      return live.order(orderReq);
    });

    const st = resp?.response?.data?.statuses?.[0];
    if (st && st.error) {
      const msg = String(st.error);
      if (/insufficient|margin|balance|not enough/i.test(msg)) {
        if (!isBuy) {
          const err = new Error(msg.replace(/margin/i, 'balance') || ('Not enough ' + asset.name + ' to sell'));
          err.code = 'HL_NO_BALANCE';
          throw err;
        }
        showFundGuide(true);
        const err = new Error(msg);
        err.code = 'HL_NO_MARGIN';
        throw err;
      }
      throw new Error(msg);
    }

    try { notifyHlBalancesChanged(); } catch (_) {}
    try { logHlFill({ spot: true, side, coin: asset.name, size: wireSz, mid, resp }); } catch (_) {}
    return { resp, coin: asset.name, mid, order, leverage: 1, spot: true };
  }

  async function placeOrder({ side, pair, size, leverage, reduceOnly, postOnly, isCross, price, type, spot }) {
    const wantSpot = spot === true || isSpotMode();
    if (wantSpot) {
      return placeSpotOrder({ side, pair, size, reduceOnly, postOnly, price, type });
    }

    const cfg = await fetchConfig();
    if (!cfg.enabled) throw new Error('Hyperliquid builder not configured');

    const coin = coinFromPair(pair);
    const meta = await ensureMeta();
    const asset = meta.assetByCoin.get(coin);
    if (!asset) throw new Error('Not listed on Hyperliquid: ' + coin);

    const address = await getAddress();
    await ensureMarginOrGuide(!!reduceOnly);
    assertHlMinOrderValue(size, Number(price) || Number(window.__hlMids[coin] || 0));
    let client = await getExchangeClient();
    const useBuilder = await ensureBuilderApproved(client, address, cfg);
    client = await getExchangeClient();

    const maxLev = Number(asset.maxLeverage) || 20;
    const lev = Math.max(1, Math.min(maxLev, Number(leverage) || 5));
    const cross = asset.onlyIsolated ? false : (isCross !== false);
    if (typeof client.updateLeverage === 'function') {
      try {
        await client.updateLeverage({ asset: asset.id, isCross: cross, leverage: lev });
      } catch (e) {
        console.warn('[GROM HL] updateLeverage', e);
      }
    }

    const mid = Number(window.__hlMids[coin] || 0);
    if (!(mid > 0)) throw new Error('No mid price for ' + coin);

    const isBuy = side === 'buy' || side === 'long';
    const isMarket = !type || type === 'market' || !price;
    let px = Number(price);
    if (!Number.isFinite(px) || isMarket) {
      px = mid * (isBuy ? 1.01 : 0.99);
    }

    let tif = 'Gtc';
    if (isMarket) tif = 'Ioc';
    else if (postOnly) tif = 'Alo';

    const order = {
      a: asset.id,
      b: isBuy,
      p: formatPx(px, asset.szDecimals, false),
      s: formatSz(size, asset.szDecimals),
      r: !!reduceOnly,
      t: { limit: { tif } },
    };

    toast('Confirm in wallet · Hyperliquid', 'info');
    const orderReq = {
      orders: [order],
      grouping: 'na',
    };
    if (useBuilder) {
      orderReq.builder = {
        b: cfg.builder,
        f: Number(cfg.builderFeeTenthsBp || FEE_FALLBACK),
      };
    }
    const resp = await hlSignedAction(async () => {
      const live = await getExchangeClient();
      return live.order(orderReq);
    });

    // Surface HL order errors clearly
    const st = resp?.response?.data?.statuses?.[0];
    if (st && st.error) {
      const msg = String(st.error);
      try {
        if (typeof window.gromReportIssue === 'function') {
          window.gromReportIssue({
            product: 'futures',
            action: /reject|denied|4001|cancel/i.test(msg) ? 'tx_rejected' : 'hl_order_error',
            message: msg,
            detail: {
              coin, mid,
              kind: /reject|denied|4001|cancel/i.test(msg) ? 'cancelled' : 'failed',
              admin_brief: /reject|denied|4001|cancel/i.test(msg)
                ? 'Отклонил HL-ордер в кошельке'
                : 'HL вернул ошибку ордера',
            },
          });
        }
      } catch (_) {}
      if (/insufficient|margin|balance|not enough/i.test(msg)) {
        showFundGuide(true);
        const err = new Error(msg);
        err.code = 'HL_NO_MARGIN';
        throw err;
      }
      throw new Error(msg);
    }

    try { logHlFill({ spot: false, side, coin, size: order.s, mid, resp }); } catch (_) {}
    return { resp, coin, mid, order, leverage: lev };
  }

  async function closePosition(coinOrPair, opts) {
    const forceSpot = !!(opts && opts.spot);
    if (forceSpot || isSpotMode()) {
      const coin = displaySpotCoin(coinFromPair(coinOrPair));
      const holdings = await listSpotHoldings();
      const pos = holdings.find((p) => String(p.coin).toUpperCase() === coin && coin !== 'USDC');
      if (!pos) throw new Error('No spot balance for ' + coin);
      const sz = Math.abs(Number(pos.size));
      const mid = Number(pos.mark_price || window.__hlSpotMids[coin] || 0);
      const ntl = sz * (mid || 0);
      if (ntl > 0 && ntl + 1e-9 < HL_MIN_ORDER_USD) {
        const err = new Error(
          coin + ' is only ~$' + ntl.toFixed(2)
          + ' — Hyperliquid min sell is $' + HL_MIN_ORDER_USD
          + '. Sell a larger holding (e.g. DRV) or leave this dust.'
        );
        err.code = 'HL_DUST';
        throw err;
      }
      return placeSpotOrder({
        side: 'sell',
        pair: coin + '/USDC',
        size: sz,
        type: 'market',
      });
    }
    const coin = coinFromPair(coinOrPair);
    const positions = await listPositions();
    const pos = positions.find((p) => String(p.coin).toUpperCase() === coin);
    if (!pos) throw new Error('No open position for ' + coin);
    const size = Math.abs(Number(pos.szi));
    const side = pos.szi > 0 ? 'sell' : 'buy'; // flatten
    return placeOrder({
      side,
      pair: pairFromCoin(coin),
      size,
      leverage: Number(pos.leverage) || 5,
      reduceOnly: true,
      type: 'market',
      spot: false,
    });
  }

  function mapHlPosition(p) {
    const coin = String(p.coin || '').toUpperCase();
    const szi = Number(p.szi);
    const levObj = p.leverage;
    const lev = typeof levObj === 'object' ? Number(levObj?.value || levObj?.rawUsd || 0) : Number(levObj || 0);
    return {
      id: 'hl_' + coin.replace(/[^a-zA-Z0-9]+/g, '_'),
      coin,
      contract: pairFromCoin(coin),
      side: szi > 0 ? 'long' : 'short',
      szi,
      size: Math.abs(szi),
      entry_price: Number(p.entryPx),
      entryPx: Number(p.entryPx),
      mark_price: Number(window.__hlCtx[coin]?.markPx || window.__hlMids[coin] || p.entryPx),
      unrealised_pnl: Number(p.unrealizedPnl),
      unrealizedPnl: Number(p.unrealizedPnl),
      leverage: lev || 1,
      margin_usdt: Number(p.marginUsed || 0),
      liq_price: p.liquidationPx != null && p.liquidationPx !== '' ? Number(p.liquidationPx) : 0,
      status: 'open',
      source: 'hyperliquid',
      dex: window.__hlCtx[coin]?.dex || '',
    };
  }

  async function listPositions() {
    let address = '';
    try { address = await getAddress(); } catch (_) { return []; }

    const dexNames = [''];
    (window.__hlMarkets || []).forEach((m) => {
      if (m.dex && dexNames.indexOf(m.dex) < 0) dexNames.push(m.dex);
    });

    const out = [];
    await Promise.all(dexNames.map(async (dex) => {
      try {
        const body = { type: 'clearinghouseState', user: address };
        if (dex) body.dex = dex;
        const state = await hlInfo(body);
        const rows = state.assetPositions || [];
        rows.forEach((row) => {
          const p = row.position || row;
          if (Math.abs(Number(p.szi || 0)) > 0) out.push(mapHlPosition(p));
        });
      } catch (_) {}
    }));
    return out;
  }

  async function listOpenOrders() {
    let address = '';
    try { address = await getAddress(); } catch (_) { return []; }
    const dexNames = [''];
    (window.__hlMarkets || []).forEach((m) => {
      if (m.dex && dexNames.indexOf(m.dex) < 0) dexNames.push(m.dex);
    });
    const out = [];
    await Promise.all(dexNames.map(async (dex) => {
      try {
        const body = { type: 'openOrders', user: address };
        if (dex) body.dex = dex;
        const orders = await hlInfo(body);
        const arr = Array.isArray(orders) ? orders : [];
        arr.forEach((o, i) => {
          const rawCoin = String(o.coin || '');
          const spotM = isSpotOrderCoin(rawCoin) ? spotAssetFromOrderCoin(rawCoin) : null;
          if (isSpotMode() && !spotM) return;
          if (!isSpotMode() && spotM) return;
          out.push({
            id: 'hl_ord_' + (o.oid != null ? o.oid : (dex + '_' + i)),
            contract: spotM ? spotM.sym : pairFromCoin(o.coin),
            coin: spotM ? spotM.coin : String(o.coin || '').toUpperCase(),
            side: o.side === 'B' || o.side === 'Buy' || o.b === true ? 'buy' : 'sell',
            type: 'limit',
            price: Number(o.limitPx || o.px || 0),
            size: Number(o.sz || 0),
            leverage: spotM ? 1 : 1,
            status: 'open',
            source: 'hyperliquid',
            dex: dex || '',
            spot: !!spotM,
          });
        });
      } catch (_) {}
    }));
    return out;
  }

  async function accountSummary() {
    let address = '';
    try { address = await getAddress(); } catch (_) { return null; }
    const state = await hlInfo({ type: 'clearinghouseState', user: address });
    const ms = state.marginSummary || state.crossMarginSummary || {};
    return {
      address,
      accountValue: Number(ms.accountValue || 0),
      totalMarginUsed: Number(ms.totalMarginUsed || 0),
      withdrawable: Number(state.withdrawable || 0),
    };
  }

  async function spotAccountSummary() {
    let address = '';
    try { address = await getAddress(); } catch (_) { return null; }
    try { await ensureSpotMeta(); } catch (_) {}
    const state = await hlInfo({ type: 'spotClearinghouseState', user: address });
    const bals = Array.isArray(state.balances) ? state.balances : [];
    const usdc = bals.find((b) => String(b.coin || '').toUpperCase() === 'USDC') || {};
    const total = Number(usdc.total || 0);
    const hold = Number(usdc.hold || 0);
    /* Equity = USDC cash + mark×size of every Spot coin (what the user actually owns). */
    let equityUsd = total;
    bals.forEach((b) => {
      const token = String(b.coin || '').toUpperCase();
      if (token === 'USDC') return;
      const sz = Number(b.total || 0);
      if (!(sz > 0)) return;
      const listed = spotAssetFromOrderCoin(token);
      const coin = listed ? listed.coin : displaySpotCoin(token);
      const mid = Number(window.__hlSpotMids[coin] || window.__hlSpotMids[token] || 0);
      if (mid > 0) equityUsd += sz * mid;
    });
    return {
      address,
      accountValue: total,
      equityUsd,
      totalMarginUsed: hold,
      withdrawable: Math.max(0, total - hold),
      balances: bals,
    };
  }

  function holdingsFromSpotSum(sum) {
    const bals = sum && Array.isArray(sum.balances) ? sum.balances : [];
    const out = [];
    bals.forEach((b) => {
      const token = String(b.coin || '').toUpperCase();
      const total = Number(b.total || 0);
      if (!(total > 0)) return;
      const listed = token === 'USDC' ? null : spotAssetFromOrderCoin(token);
      /* Keep unlisted names visible (meta still loading) so Balances do not flash empty. */
      if (token !== 'USDC' && !listed && _spotMeta) return;
      const coin = listed ? listed.coin : displaySpotCoin(token);
      const mid = Number(window.__hlSpotMids[coin] || window.__hlSpotMids[token] || 0) || (coin === 'USDC' ? 1 : 0);
      out.push({
        id: 'hl_' + coin.replace(/[^a-zA-Z0-9]+/g, '_'),
        coin,
        contract: coin === 'USDC' ? 'USDC' : (coin + '/USDC'),
        side: 'long',
        szi: total,
        size: total,
        entry_price: Number(b.entryNtl || 0) && total ? Number(b.entryNtl) / total : mid,
        entryPx: Number(b.entryNtl || 0) && total ? Number(b.entryNtl) / total : mid,
        mark_price: mid || 1,
        unrealised_pnl: 0,
        unrealizedPnl: 0,
        leverage: 1,
        margin_usdt: coin === 'USDC' ? total : total * (mid || 0),
        liq_price: 0,
        status: 'open',
        source: 'hyperliquid',
        spot: true,
        hold: Number(b.hold || 0),
      });
    });
    return out;
  }

  async function listSpotHoldings() {
    try { await ensureSpotMeta(); } catch (_) {}
    const sum = await spotAccountSummary().catch(() => null);
    return holdingsFromSpotSum(sum);
  }

  function notifyHlBalancesChanged() {
    try { window.dispatchEvent(new CustomEvent('grom:hl-balances')); } catch (_) {}
  }

  /** Push HL positions into existing desk table state (non-destructive if HL empty + no wallet). */
  async function syncDeskState() {
    const st = window.__gromFuturesState;
    if (!st) return;
    const spot = isSpotMode();

    /* Instant paint from last sync / meta-portfolio cache — avoid $0.00 flash. */
    try { paintCachedDeskBalances(); } catch (_) {}

    let address = '';
    try { address = await getAddress(); } catch (_) {}
    let connected = false;
    try {
      if (window.GROM_CONN && window.GROM_CONN.connected) connected = true;
      else if (typeof window.gwDisplayAddress === 'function' && window.gwDisplayAddress()) connected = true;
      else if (typeof window.gwReadOnlyAddress === 'function' && window.gwReadOnlyAddress()) connected = true;
      else if (address) connected = true;
    } catch (_) {}

    /* One parallel round-trip: no double spotClearinghouseState, no Arb-after-HL waterfall. */
    try { await ensureSpotMeta(); } catch (_) {}
    const [perpSum, spotSum, orders, arbUsdc, perpPositions] = await Promise.all([
      accountSummary().catch(() => null),
      spotAccountSummary().catch(() => null),
      listOpenOrders().catch(() => []),
      (connected && address) ? fetchArbUsdc(address).catch(() => 0) : Promise.resolve(0),
      spot ? Promise.resolve([]) : listPositions().catch(() => []),
    ]);

    const nextPositions = spot ? holdingsFromSpotSum(spotSum) : (perpPositions || []);
    const perpUsd = perpSum ? Number(perpSum.accountValue || 0) : 0;
    const spotUsd = spotSum ? Number(spotSum.accountValue || 0) : 0;

    /* Balance pills first — table render can wait a frame. */
    if (!connected) {
      paintWalletArbUsdc(0, 0, { connected: false });
      showFundGuide(true);
    } else {
      paintDeskBalanceUi({
        connected: true,
        spotMode: spot,
        perpUsd,
        spotUsd,
        arbUsd: arbUsdc,
        spotHold: spotSum ? Number(spotSum.totalMarginUsed || 0) : 0,
        perpUsed: perpSum ? Number(perpSum.totalMarginUsed || 0) : 0,
        perpWithdrawable: perpSum ? Number(perpSum.withdrawable || 0) : 0,
      });
      writeDeskBalCache(address, perpUsd, spotUsd, arbUsdc);
      try {
        if (window.GW_MP_CACHE) {
          const equity = spotSum && spotSum.equityUsd != null
            ? Number(spotSum.equityUsd)
            : spotUsd;
          window.GW_MP_CACHE.hl = {
            at: Date.now(),
            val: {
              usd: perpUsd + equity,
              perp: perpUsd,
              spot: equity,
              spotUsdc: spotUsd,
              has: (perpUsd + equity) > 0.005,
              ready: true,
            },
          };
        }
      } catch (_) {}
      showFundGuide(false);
    }

    /* Don't wipe a good table when spotClearinghouse briefly fails or meta lags. */
    const hadSpot = Array.isArray(st.positions) && st.positions.some((p) => p && p.spot);
    if (spot && nextPositions.length === 0 && hadSpot
      && (spotSum == null || !Array.isArray(spotSum.balances))) {
      /* keep st.positions */
    } else if (spot && nextPositions.length === 0 && hadSpot && st.source === 'hyperliquid' && st.spot
      && spotSum && Array.isArray(spotSum.balances) && spotSum.balances.some((b) => Number(b.total || 0) > 0)) {
      /* Raw balances exist but mapping produced nothing (meta race) — keep prior rows. */
    } else {
      st.positions = nextPositions;
    }
    st.orders = orders;
    st.source = 'hyperliquid';
    st.spot = spot;
    (st.positions || []).forEach((p) => {
      st.markByContract[p.contract] = p.mark_price;
    });
    if (typeof window.renderFuturesTable === 'function') window.renderFuturesTable();
  }

  function wireFuturesControls() {
    const page = document.getElementById('page-futures');
    if (!page || page.dataset.hlWired === '1') return;
    page.dataset.hlWired = '1';

    const typeRow = document.getElementById('futOrderTypeRow');
    if (typeRow) {
      typeRow.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-otype]');
        if (!btn || !typeRow.contains(btn)) return;
        if (btn.dataset.otype === 'stop') {
          e.preventDefault();
          e.stopPropagation();
          try {
            if (typeof window.toast === 'function') window.toast('Stop orders coming next — use Market or Limit', 'info');
          } catch (_) {}
          return;
        }
        typeRow.querySelectorAll('button').forEach((x) => x.classList.remove('active'));
        btn.classList.add('active');
        try {
          if (typeof window.paintFutOrderTypeUi === 'function') window.paintFutOrderTypeUi();
          if (typeof window.updateFutCtaState === 'function') window.updateFutCtaState();
        } catch (_) {}
      });
    }

    const flags = page.querySelector('.fut-form-flags');
    if (flags) {
      flags.addEventListener('click', (e) => {
        const btn = e.target.closest('.flag-chip[data-flag]');
        if (!btn || !flags.contains(btn)) return;
        btn.classList.toggle('on');
        try {
          if (typeof window.updateFutCtaState === 'function') window.updateFutCtaState();
        } catch (_) {}
      });
    }

    const fundPerpBtn = document.getElementById('hlFundPerpBtn');
    const fundSpotBtn = document.getElementById('hlFundSpotBtn');
    if (fundPerpBtn && !fundPerpBtn.dataset.hlWired) {
      fundPerpBtn.dataset.hlWired = '1';
      fundPerpBtn.addEventListener('click', (e) => {
        e.preventDefault();
        openHlFund('perp');
      });
    }
    if (fundSpotBtn && !fundSpotBtn.dataset.hlWired) {
      fundSpotBtn.dataset.hlWired = '1';
      fundSpotBtn.addEventListener('click', (e) => {
        e.preventDefault();
        openHlFund('spot');
      });
    }

    const walletBtn = document.getElementById('hlFundWalletBtn');
    if (walletBtn && !walletBtn.dataset.hlWired) {
      walletBtn.dataset.hlWired = '1';
      walletBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const from = walletBtn.dataset.from || 'wallet';
        const to = walletBtn.dataset.to || 'perp';
        if (typeof window.gwOpenWalletTransferHub === 'function') {
          window.gwOpenWalletTransferHub({ from, to });
        } else {
          try {
            if (typeof window.show === 'function') window.show('wallet');
            else location.hash = '#wallet';
          } catch (_) { location.hash = '#wallet'; }
        }
      });
    }
    const swapBtn = document.getElementById('hlFundSwapBtn');
    if (swapBtn && !swapBtn.dataset.hlWired) {
      swapBtn.dataset.hlWired = '1';
      swapBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (swapBtn.dataset.needConnect === '1') {
          try {
            if (typeof window.openConnectModal === 'function') window.openConnectModal();
            else {
              const chip = document.getElementById('walletChip');
              if (chip) chip.click();
            }
          } catch (_) {}
          return;
        }
        openFundSwap();
      });
    }
    const depBtn = document.getElementById('hlFundDepositBtn');
    if (depBtn && !depBtn.dataset.hlWired) {
      depBtn.dataset.hlWired = '1';
      depBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        if (depBtn.dataset.busy) return;
        depBtn.dataset.busy = '1';
        depBtn.disabled = true;
        try {
          await depositArbUsdcToHl();
        } catch (err) {
          const msg = (err && err.message) || 'Deposit failed';
          toast(msg, 'error');
          if (err && err.code === 'HL_MIN_DEPOSIT') openFundSwap();
          try {
            if (typeof window.gromReportIssue === 'function') {
              window.gromReportIssue({
                product: 'futures',
                action: 'hl_deposit_failed',
                message: msg,
                detail: {
                  kind: /reject|denied|4001|cancel/i.test(msg) ? 'cancelled' : 'failed',
                  chainId: 42161,
                  chainLabel: 'Arbitrum',
                  admin_brief: /reject|denied|4001|cancel/i.test(msg)
                    ? 'Отклонил депозит USDC→HL в кошельке'
                    : 'Сбой депозита Arb USDC на Hyperliquid',
                },
              });
            }
          } catch (_) {}
        } finally {
          delete depBtn.dataset.busy;
          depBtn.disabled = false;
          try { await syncDeskState(); } catch (_) {}
        }
      });
    }
    const moveBtn = document.getElementById('hlFundMoveBtn');
    if (moveBtn && !moveBtn.dataset.hlWired) {
      moveBtn.dataset.hlWired = '1';
      moveBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        if (moveBtn.dataset.busy) return;
        moveBtn.dataset.busy = '1';
        moveBtn.disabled = true;
        try {
          await moveUsdClass(Number(moveBtn.dataset.moveUsd) || 0, moveBtn.dataset.toPerp === '1');
        } catch (err) {
          const msg = (err && err.message) || 'Transfer failed';
          toast(msg, 'error');
          try {
            if (typeof window.gromReportIssue === 'function') {
              window.gromReportIssue({
                product: 'futures',
                action: 'hl_class_transfer_failed',
                message: msg,
                detail: {
                  kind: /reject|denied|4001|cancel/i.test(msg) ? 'cancelled' : 'failed',
                  admin_brief: /reject|denied|4001|cancel/i.test(msg)
                    ? 'Отклонил перевод Spot↔Perp в кошельке'
                    : 'Сбой перевода Spot↔Perp на HL',
                },
              });
            }
          } catch (_) {}
        } finally {
          delete moveBtn.dataset.busy;
          moveBtn.disabled = false;
          try { await syncDeskState(); } catch (_) {}
        }
      });
    }

    const presets = document.getElementById('futSizePresets');
    if (presets && !presets.dataset.hlPct) {
      presets.dataset.hlPct = '1';
      presets.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-pct]');
        if (!btn || !presets.contains(btn)) return;
        const frac = Number(btn.dataset.pct) / 100;
        if (!(frac > 0)) return;
        applySizePct(frac);
      });
    }

    function applySizePct(frac) {
      const sizeEl = document.getElementById('futSizeInput');
      const priceEl = document.getElementById('futPriceInput');
      if (!sizeEl) return;
      const pair = window.futDeskState?.pair || '';
      const coin = coinFromPair(pair);
      const mid = isSpotMode()
        ? Number(window.__hlSpotMids[coin] || 0)
        : Number(window.__hlMids[coin] || 0);
      const px = Number(priceEl && priceEl.value) || mid;
      if (!(px > 0)) return;
      const sideBtn = page.querySelector('.side-toggle button.active');
      let isSell = !!(sideBtn && /sell|short/i.test(sideBtn.textContent || ''));
      try {
        if (window.futDeskState && (futDeskState.side === 'short' || futDeskState.side === 'sell')) {
          isSell = true;
        }
        if (sideBtn && /buy|long/i.test(sideBtn.textContent || '') && !/sell|short/i.test(sideBtn.textContent || '')) {
          isSell = false;
        }
      } catch (_) {}
      let availUsd = Number(page.dataset.hlUsd) || 0;
      let availCoin = 0;
      try {
        const coinU = String(coin || '').toUpperCase();
        const disp = String(displaySpotCoin(coinU) || coinU).toUpperCase();
        ((window.__gromFuturesState && window.__gromFuturesState.positions) || []).forEach((p) => {
          const c = String(p.coin || '').toUpperCase();
          const d = String(displaySpotCoin(c) || c).toUpperCase();
          if (c === 'USDC' || c === 'USDT') availUsd = Math.max(availUsd, Number(p.size || p.szi || 0));
          if (c === coinU || d === coinU || c === disp || d === disp) {
            availCoin += Math.abs(Number(p.size || p.szi || 0));
          }
        });
      } catch (_) {}
      if (!(availUsd > 0.5) && !(isSell && availCoin > 0)) {
        toast('No HL USDC yet — deposit first (min $' + HL_MIN_DEPOSIT_USD + ')', 'warn');
        showFundGuide(true);
        return;
      }
      if (isSell && !(availCoin > 0)) {
        toast('No ' + coin + ' balance to sell', 'warn');
        return;
      }
      let sz = 0;
      const quoteMode = !!(window.futDeskState && window.futDeskState.sizeInQuote);
      const decimals = isSpotMode()
        ? Number((window.__hlSpotCtx && window.__hlSpotCtx[coin] && window.__hlSpotCtx[coin].szDecimals) || 4)
        : Number((window.__hlCtx && window.__hlCtx[coin] && window.__hlCtx[coin].szDecimals) || 4);
      const floorToLot = (n, d) => {
        const f = Math.pow(10, Math.max(0, d));
        return Math.floor((Number(n) + 1e-12) * f) / f;
      };
      if (isSpotMode()) {
        if (isSell) {
          /* Never exceed free balance — 100% must floor to lot size. */
          const baseMax = floorToLot(availCoin * frac, decimals);
          sz = quoteMode ? (Math.floor(baseMax * px * 100) / 100) : baseMax;
        } else {
          sz = quoteMode ? (availUsd * frac) : ((availUsd * frac) / px);
          if (!quoteMode) sz = floorToLot(sz, decimals);
          else sz = Math.floor(sz * 100) / 100;
        }
      } else if (quoteMode) {
        const L = Number(window.futDeskState?.leverage) || 1;
        if (isSell && availCoin > 0) {
          const baseMax = floorToLot(availCoin * frac, decimals);
          sz = Math.floor(baseMax * px * 100) / 100;
        } else {
          sz = Math.floor(availUsd * L * frac * 100) / 100;
        }
      } else {
        const L = Number(window.futDeskState?.leverage) || 1;
        if (isSell && availCoin > 0) {
          sz = floorToLot(availCoin * frac, decimals);
        } else {
          sz = floorToLot((availUsd * L * frac) / px, decimals);
        }
      }
      if (!(sz > 0)) return;
      /* Final sell clamp: quote→base must stay ≤ holdings. */
      if (isSell && availCoin > 0) {
        if (quoteMode) {
          const baseFromQuote = sz / px;
          if (baseFromQuote > availCoin * 1.0000001) {
            sz = Math.floor(floorToLot(availCoin, decimals) * px * 100) / 100;
          }
        } else if (sz > availCoin) {
          sz = floorToLot(availCoin, decimals);
        }
      }
      if (quoteMode) {
        sizeEl.value = String(Math.round(sz * 100) / 100);
      } else {
        try { sizeEl.value = formatSz(sz, decimals); } catch (_) { sizeEl.value = String(sz); }
        /* formatSz can round up — clamp sell back down. */
        if (isSell && availCoin > 0 && Number(sizeEl.value) > availCoin) {
          sizeEl.value = formatSz(floorToLot(availCoin, decimals), decimals);
        }
      }
      sizeEl.dispatchEvent(new Event('input', { bubbles: true }));
      try {
        if (typeof window.paintFutSizeCurrency === 'function') window.paintFutSizeCurrency();
        if (typeof window.updateFuturesBoard === 'function') window.updateFuturesBoard();
        if (typeof window.updateFutCtaState === 'function') window.updateFutCtaState();
      } catch (_) {}
    }

    // Live est. margin from size × mid / leverage (Futures panel only)
    const sizeIn = document.getElementById('futSizeInput');
    const priceIn = document.getElementById('futPriceInput');
    const lev = document.getElementById('levRange');
    const refreshEst = () => {
      try {
        const pair = window.futDeskState?.pair || 'BTC/USDT';
        const coin = coinFromPair(pair);
        const mid = isSpotMode()
          ? Number(window.__hlSpotMids[coin] || 0)
          : Number(window.__hlMids[coin] || 0);
        const px = Number(priceIn && priceIn.value) || mid;
        let raw = Number(sizeIn && sizeIn.value) || 0;
        const quoteMode = !!(window.futDeskState && window.futDeskState.sizeInQuote);
        const L = isSpotMode() ? 1 : (Number(lev && lev.value) || Number(window.futDeskState?.leverage) || 1);
        /* Quote mode: Est. cost = typed USDC (avoid szDecimals round-trip $10→$10.57). */
        const notional = quoteMode ? raw : (px * raw);
        const margin = L > 0 ? notional / L : 0;
        const el = document.getElementById('futEstMargin');
        const hlAvail = Number(page.dataset.hlUsd) || 0;
        if (el) {
          if (!(raw > 0) || !(margin > 0) || (!(px > 0) && !quoteMode)) el.textContent = '—';
          else {
            el.textContent = '$' + margin.toLocaleString('en-US', { maximumFractionDigits: 2 });
            el.style.color = (hlAvail > 0 && margin > hlAvail) ? 'var(--danger)' : 'var(--silver1)';
          }
        }
        const feeEl = document.getElementById('futBuilderFee');
        if (feeEl && _cfg) feeEl.textContent = (Number(_cfg.builderFeePct) || 0.05) + '%';
        const estLbl = document.getElementById('futEstLbl');
        if (estLbl) estLbl.textContent = isSpotMode() ? 'Est. cost' : 'Est. margin';
        try {
          if (typeof window.paintFutSizeCurrency === 'function') window.paintFutSizeCurrency();
        } catch (_) {}
      } catch (_) {}
    };
    [sizeIn, priceIn, lev].forEach((n) => {
      if (n && !n.dataset.hlEst) {
        n.dataset.hlEst = '1';
        n.addEventListener('input', refreshEst);
        n.addEventListener('change', refreshEst);
      }
    });
    refreshEst();
  }

  function applyMarketsToDesk() {
    const spot = isSpotMode();
    const markets = spot
      ? (window.__hlSpotMarkets || [])
      : filterListedMarkets(window.__hlMarkets || [], { mode: 'perp' });
    // Never shrink window.__hlMarkets here — Markets page needs the full
    // main+HIP-3 catalog even when the Trade desk is filtered/spot.
    if (!markets.length && !spot) return;

    try {
      if (typeof futuresPairs !== 'undefined') {
        futuresPairs.length = 0;
        Array.prototype.push.apply(futuresPairs, markets);
      }
    } catch (_) {}
    window.futuresPairs = markets;

    if (window.listUiState) {
      /* Keep the user's All/Crypto/TradFi pill — never yank them back to All on meta refresh. */
      if (!window.listUiState.futuresFilter) window.listUiState.futuresFilter = 'all';
      if (!window.listUiState.futuresCat) window.listUiState.futuresCat = 'all';
    }
    const futCats = document.getElementById('futCats');
    if (futCats) {
      if (spot) {
        futCats.hidden = true;
      } else {
        futCats.hidden = false;
        const allowed = { all: 1, crypto: 1, tradfi: 1, hip3: 1, trending: 1, prelaunch: 1 };
        [
          ['tradfi', 'TradFi'],
          ['hip3', 'HIP-3'],
          ['trending', 'Trending'],
          ['prelaunch', 'Pre-launch'],
        ].forEach(([id, label]) => {
          if (!futCats.querySelector('button[data-cat="' + id + '"]')) {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'cat-pill';
            b.dataset.cat = id;
            b.textContent = label;
            futCats.appendChild(b);
          }
        });
        const curCat = (window.listUiState && window.listUiState.futuresCat) || 'all';
        futCats.querySelectorAll('button[data-cat]').forEach((b) => {
          const cat = b.dataset.cat;
          b.style.display = allowed[cat] ? '' : 'none';
          b.classList.toggle('active', cat === curCat);
        });
      }
    }

    const futTabs = document.getElementById('futTabs');
    if (futTabs) futTabs.hidden = !spot;

    const wlHead = document.querySelector('#page-futures aside.wl .wl-head span:last-child');
    if (wlHead) wlHead.textContent = spot ? '24h vol' : 'Max lev';
    const wlLeft = document.querySelector('#page-futures aside.wl .wl-head span:first-child');
    if (wlLeft) wlLeft.textContent = spot ? 'Markets' : 'Contracts';

    const sub = document.querySelector('#page-futures .page-subtitle');
    if (sub) {
      sub.dataset.hl = '1';
      if (spot) {
        sub.textContent = 'Spot · ' + markets.length + ' markets / USDC · no leverage';
      } else {
        const nHip = markets.filter((m) => m.hip3).length;
        const nPre = markets.filter((m) => m.prelaunch).length;
        sub.textContent = 'Hyperliquid · ' + markets.length + ' perps'
          + (nHip ? (' · ' + nHip + ' HIP-3/TradFi') : '')
          + (nPre ? (' · ' + nPre + ' pre-launch') : '')
          + ' · builder 0.05%';
      }
    }

    const ai = document.querySelector('#page-futures .fut-ai-card');
    if (ai) {
      try { ai.remove(); } catch (_) { ai.hidden = true; }
    }

    wireFuturesControls();

    if (typeof window.renderFuturesList === 'function') {
      window.renderFuturesList(document.querySelector('#page-futures .wl-search input')?.value || '');
    }
    if (typeof window.renderMarketsEnhanced === 'function') {
      try { window.renderMarketsEnhanced(); } catch (_) {}
    }
    if (typeof window.paintFutPairTitle === 'function') window.paintFutPairTitle();

    if (!spot) syncLeverageCap();
  }

  function syncLeverageCap() {
    const pair = window.futDeskState?.pair || 'BTC/USDT';
    const coin = coinFromPair(pair);
    const max = Number(window.__hlCtx[coin]?.maxLeverage || 40);
    const range = document.getElementById('levRange');
    if (range) {
      range.max = String(max);
      let cur = Number(range.value) || 10;
      if (cur > max) cur = max;
      if (cur < 1) cur = 1;
      range.value = String(cur);
      if (window.futDeskState) window.futDeskState.leverage = cur;
    }
    if (typeof window.paintLeverageUi === 'function') {
      try { window.paintLeverageUi(); } catch (_) {}
    } else {
      const v = document.getElementById('levVal');
      const cur2 = Number(range && range.value) || 1;
      if (v) v.textContent = cur2 + '×';
    }
  }

  let _bootRetryTimer = null;
  let _bootAttempts = 0;

  let _watchersReady = false;
  function ensureWatchers() {
    if (_watchersReady) return;
    _watchersReady = true;
    _midsTimer = setInterval(() => {
      if (document.hidden) return;
      if (!window.__gromHlActive) {
        recoverMeta().catch(() => {});
        return;
      }
      const fut = document.getElementById('page-futures');
      const mkt = document.getElementById('page-markets');
      const futOn = fut && fut.classList.contains('active');
      const mktOn = mkt && mkt.classList.contains('active');
      if (!futOn && !mktOn) return;
      refreshMids().then(() => {
        if (mktOn && typeof window.renderMarketsEnhanced === 'function') {
          try { window.updateMarketsLiveRows ? window.updateMarketsLiveRows() : window.renderMarketsEnhanced(); } catch (_) {}
        }
      }).catch(() => {});
    }, 4000);

    _posTimer = setInterval(() => {
      if (document.hidden) return;
      const page = document.getElementById('page-futures');
      if (page && !page.classList.contains('active')) return;
      syncDeskState().catch(() => {});
    }, 8000);

    document.addEventListener('grom:wallet-connected', () => {
      try { paintCachedDeskBalances(); } catch (_) {}
      syncDeskState().catch(() => {});
    });
    document.addEventListener('grom:wallet-disconnected', () => {
      paintWalletArbUsdc(0, 0, { connected: false });
      showFundGuide(true);
    });

    document.addEventListener('click', (ev) => {
      if (ev.target.closest('#page-futures [data-pair]')) {
        setTimeout(syncLeverageCap, 50);
      }
    });
  }

  async function activateHlDesk() {
    if (!isMetaReady()) return false;
    window.__gromHlActive = true;
    try { paintCachedDeskBalances(); } catch (_) {}
    applyMarketsToDesk();
    if (typeof window.applyTradeModeUi === 'function') {
      try { window.applyTradeModeUi({ fromHl: true }); } catch (_) {}
    }
    if (typeof window.renderMarketsEnhanced === 'function') {
      try { window.renderMarketsEnhanced(); } catch (_) {}
    }
    if (typeof window.renderFuturesList === 'function') {
      try {
        window.renderFuturesList(document.querySelector('#page-futures .wl-search input')?.value || '');
      } catch (_) {}
    }
    ensureWatchers();
    scheduleHip3Backfill();
    return true;
  }

  let _hip3BackfillTimer = null;
  let _hip3BackfillTries = 0;
  let _hip3BackfillInflight = false;
  function scheduleHip3Backfill() {
    if (_hip3BackfillTimer || _hip3BackfillInflight) return;
    const hip = (window.__hlMarkets || []).filter((m) => m && m.hip3).length;
    if (hip >= 20) return;
    _hip3BackfillTimer = setTimeout(() => {
      _hip3BackfillTimer = null;
      backfillHip3().catch(() => {});
    }, 1800 + _hip3BackfillTries * 2500);
  }

  async function backfillHip3() {
    const hip = (window.__hlMarkets || []).filter((m) => m && m.hip3).length;
    if (hip >= 20) return true;
    if (_hip3BackfillInflight) return false;
    if (_hip3BackfillTries >= 14) {
      try {
        if (typeof window.gromReportIssue === 'function') {
          window.gromReportIssue({
            product: 'markets',
            action: 'markets_hip3_empty',
            message: `HIP-3 backfill исчерпан (${hip} рынков) — TradFi pill пустой`,
            detail: { source: 'hl_backfill', hip, tries: _hip3BackfillTries },
          });
        }
      } catch (_) {}
      return false;
    }
    _hip3BackfillTries += 1;
    try { window.__hip3BackfillTries = _hip3BackfillTries; } catch (_) {}
    _hip3BackfillInflight = true;
    try {
      /* Prefer hip-only merge — full ensureMeta(force) re-burns rate budget on main. */
      let hip2 = 0;
      if ((window.__hlMarkets || []).length > 30) {
        hip2 = await ensureHip3Only();
      } else {
        await ensureMeta(true);
        hip2 = (window.__hlMarkets || []).filter((m) => m && m.hip3).length;
      }
      if (hip2 > hip) {
        console.info('[GROM HL] HIP-3 backfill', hip, '→', hip2);
        await activateHlDesk();
        try {
          const wl = document.getElementById('watchlist');
          if (wl) {
            delete wl.__dashWlMounted;
            delete wl.dataset.dashHip;
          }
          if (typeof window.renderDashboardWatchlist === 'function') window.renderDashboardWatchlist();
        } catch (_) {}
        return hip2 >= 20;
      }
    } catch (e) {
      console.warn('[GROM HL] HIP-3 backfill', e);
    } finally {
      _hip3BackfillInflight = false;
    }
    scheduleHip3Backfill();
    return false;
  }

  function scheduleBootRetry() {
    if (_bootRetryTimer || window.__gromHlActive) return;
    _bootRetryTimer = setTimeout(() => {
      _bootRetryTimer = null;
      recoverMeta().catch(() => {});
    }, Math.min(60_000, 8_000 + _bootAttempts * 4_000));
  }

  async function recoverMeta() {
    if (window.__gromHlActive && isMetaReady()) {
      const hip = (window.__hlMarkets || []).filter((m) => m && m.hip3).length;
      if (hip < 20) return backfillHip3();
      return true;
    }
    _bootAttempts += 1;
    try {
      await ensureMeta(true);
      if (await activateHlDesk()) {
        console.info('[GROM HL] recovered after rate-limit / empty meta');
        return true;
      }
    } catch (e) {
      console.warn('[GROM HL] recover', e);
    }
    scheduleBootRetry();
    return false;
  }

  async function boot() {
    if (_booted && window.__gromHlActive) return;
    const cfg = await fetchConfig(true);
    if (!cfg.enabled) return;
    _booted = true;
    /* Show last Spot/Perp numbers while meta + HL info load (kills the $0.00 flash). */
    try { paintCachedDeskBalances(); } catch (_) {}

    await Promise.all([
      ensureMeta(true),
      ensureSpotMeta(true).catch((e) => console.warn('[GROM HL] spot meta', e)),
    ]);
    // Only mark active after meta is ready — otherwise setFuturesPair races and
    // flashes "Not listed on Hyperliquid" while the universe is still empty.
    if (!isMetaReady()) {
      console.warn('[GROM HL] boot: meta empty (429?) — scheduling retry; Markets may show registry fallback');
      ensureWatchers();
      scheduleBootRetry();
      return;
    }
    await activateHlDesk();

    // Heal default pair quietly — never toast (especially not on Главное / dashboard).
    if (window.futDeskState) {
      try {
        const cur = window.futDeskState.pair;
        if (!isListedPair(cur)) {
          const fallback = isSpotMode()
            ? ((window.__hlSpotMarkets && window.__hlSpotMarkets[0] && window.__hlSpotMarkets[0].sym) || 'BTC/USDC')
            : (window.__hlMids?.BTC
              ? 'BTC/USDT'
              : ((window.__hlMarkets && window.__hlMarkets[0] && window.__hlMarkets[0].sym) || 'BTC/USDT'));
          const onFutures = !!document.getElementById('page-futures')?.classList?.contains('active');
          if (onFutures && typeof window.setFuturesPair === 'function') {
            window.setFuturesPair(fallback, { silent: true });
          } else {
            window.futDeskState.pair = fallback;
          }
        }
      } catch (_) {}
    }

    syncDeskState().catch(() => {});
  }

  async function listUserFills(limit) {
    let address = '';
    try { address = softWalletAddress(); } catch (_) {}
    if (!address) {
      try { address = await getAddress(); } catch (_) {}
    }
    if (!address || !/^0x[a-fA-F0-9]{40}$/i.test(address)) return [];
    try { await ensureSpotMeta(); } catch (_) {}
    try { await ensureMeta(); } catch (_) {}
    const rows = await hlInfo({ type: 'userFills', user: address });
    const list = Array.isArray(rows) ? rows : [];
    const max = Math.max(1, Math.min(200, Number(limit) || 80));
    return list.slice(0, max);
  }

  function historyItemsFromFills(fills) {
    return (fills || []).map((f) => {
      const rawCoin = String(f.coin || '');
      const spot = isSpotOrderCoin(rawCoin);
      let label = rawCoin;
      try {
        if (spot) {
          const listed = spotAssetFromOrderCoin(rawCoin);
          label = listed ? (listed.coin + '/USDC') : (displaySpotCoin(rawCoin) + '/USDC');
        } else {
          label = displayCoinLabel(rawCoin) || rawCoin;
        }
      } catch (_) {
        label = rawCoin;
      }
      const side = String(f.side || '').toUpperCase() === 'B' || /buy/i.test(String(f.dir || ''))
        ? 'Buy'
        : 'Sell';
      const sz = Number(f.sz || 0);
      const px = Number(f.px || 0);
      const ntl = sz * px;
      const fee = Number(f.fee || 0);
      const pnl = Number(f.closedPnl || 0);
      const at = Number(f.time || 0) || Date.now();
      const hash = String(f.hash || f.tid || f.oid || '');
      const base = String(label).split('/')[0].replace(/^[^:]+:/, '') || '—';
      const result = pnl
        ? ((pnl >= 0 ? '+' : '') + '$' + Math.abs(pnl).toFixed(2))
        : (ntl > 0 ? ('$' + ntl.toFixed(2)) : 'filled');
      return {
        kind: spot ? 'spot' : 'futures',
        directionTone: side === 'Buy' ? 'up' : 'down',
        assetLabel: (spot ? 'Spot' : 'Perp') + ' · ' + side + ' ' + label,
        timeLabel: new Date(at).toLocaleString(),
        stakeLabel: (sz > 0 ? (sz < 0.001 ? sz.toFixed(8) : sz.toFixed(4)) : '—')
          + ' ' + base
          + (ntl > 0 ? (' · $' + ntl.toFixed(2)) : ''),
        resultLabel: result,
        statusTone: pnl < 0 ? 'loss' : 'win',
        explorerUrl: '',
        _ts: at,
        _hash: hash ? String(hash).toLowerCase() : '',
      };
    });
  }

  async function historyItems(limit) {
    const fills = await listUserFills(limit).catch(() => []);
    return historyItemsFromFills(fills);
  }

  async function candleSnapshot(coin, interval, startTime, endTime) {
    const rows = await hlInfo({
      type: 'candleSnapshot',
      req: {
        coin: String(coin || ''),
        interval: String(interval || '15m'),
        startTime: Number(startTime) || (Date.now() - 7 * 86400000),
        endTime: Number(endTime) || Date.now(),
      },
    });
    return Array.isArray(rows) ? rows : [];
  }

  /** HL candle coin: spot uses universe `@N`, perps use BTC / xyz:TSLA (dex must be lowercase). */
  function candleCoinForPair(pair, spot) {
    const p = String(pair || '');
    if (spot) {
      const coin = coinFromPair(p.includes('/') ? p : normalizeSpotSym(p));
      const ctx = window.__hlSpotCtx && window.__hlSpotCtx[coin];
      if (ctx && ctx.universeName) return String(ctx.universeName);
      const rec = (_spotMeta && _spotMeta.assetBySym && _spotMeta.assetBySym.get(normalizeSpotSym(p)))
        || (window.__hlSpotAssetBySym && window.__hlSpotAssetBySym.get(normalizeSpotSym(p)));
      if (rec && rec.universeName) return String(rec.universeName);
      return coin;
    }
    let coin = coinFromPair(p);
    // candleSnapshot is case-sensitive: meta stores XYZ:SKHY, API wants xyz:SKHY
    if (coin.includes(':')) {
      const i = coin.indexOf(':');
      coin = coin.slice(0, i).toLowerCase() + ':' + coin.slice(i + 1);
    }
    return coin;
  }

  window.gromHL = {
    fetchConfig,
    ensureMeta,
    ensureHip3Only,
    ensureSpotMeta,
    recoverMeta,
    backfillHip3,
    scheduleHip3Backfill,
    placeOrder,
    closePosition,
    listPositions,
    listSpotHoldings,
    listUserFills,
    historyItems,
    historyItemsFromFills,
    listOpenOrders,
    accountSummary,
    spotAccountSummary,
    syncDeskState,
    applyMarketsToDesk,
    syncLeverageCap,
    boot,
    coinFromPair,
    displayCoinBase,
    displayCoinLabel,
    isListedPair,
    isMetaReady,
    filterListedMarkets,
    normalizeSpotSym,
    displaySpotCoin,
    isSpotMode,
    candleSnapshot,
    candleCoinForPair,
    openFundSwap,
    showFundGuide,
    openFundSwap,
    depositArbUsdcToHl,
    moveUsdClass,
    moveToSpot: (usd) => moveUsdClass(usd, false),
    moveToPerp: (usd) => moveUsdClass(usd, true),
    withdrawToWallet,
    balancesSnapshot,
    transferFunds,
    fetchArbUsdc,
    paintCachedDeskBalances,
    getMid: (pairOrCoin) => {
      const c = coinFromPair(pairOrCoin);
      if (isSpotMode()) return Number(window.__hlSpotMids[c] || 0) || null;
      return Number(window.__hlMids[c] || 0) || null;
    },
    isReady: async () => {
      const c = await fetchConfig();
      return !!c.enabled;
    },
    isActive: () => !!window.__gromHlActive,
  };
  try { window.dispatchEvent(new CustomEvent('grom:hl-ready')); } catch (_) {}

  function start() {
    boot().catch((e) => console.warn('[GROM HL] boot', e));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
