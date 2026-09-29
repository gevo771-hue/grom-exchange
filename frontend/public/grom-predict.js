/**
 * GROM Predict — Polymarket Builders trade client (browser).
 * Loads @polymarket/clob-client-v2 via esm.sh, talks to CLOB through /api/market/clob proxy.
 * Also: auto-switch to Polygon + LiFi bridge of USDC/USDT → Polygon for collateral.
 */
(function () {
  'use strict';

  const POLY_CHAIN = 137;
  const ZERO_BUILDER = '0x' + '0'.repeat(64);
  const ERC20_BAL = '0x70a08231'; // balanceOf(address)
  const ERC20_ALLOW = '0xdd62ed3e'; // allowance(owner,spender)
  const ERC20_APPROVE = '0x095ea581'; // approve(spender,amount)

  /** Native USDC/USDT used as bridge endpoints (6 decimals on these chains). */
  const STABLES = {
    1:     { USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7' },
    10:    { USDC: '0x0b2c639c533813f4aa9d7837caf62653d097ff85', USDT: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58' },
    56:    { USDC: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', USDT: '0x55d398326f99059fF775485246999027B3197955' },
    137:   { USDC: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', USDT: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F' },
    8453:  { USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', USDT: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2' },
    42161: { USDC: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', USDT: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9' },
    43114: { USDC: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E', USDT: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7' },
  };
  const CHAIN_LABEL = {
    1: 'Ethereum', 10: 'Optimism', 56: 'BSC', 137: 'Polygon',
    8453: 'Base', 42161: 'Arbitrum', 43114: 'Avalanche',
  };

  let _cfg = null;
  let _client = null;
  let _Side = null;
  let _addr = '';

  function toast(msg, kind) {
    try {
      if (typeof window.notify === 'function') window.notify(msg, kind || 'info');
      else if (typeof window.gwToast === 'function') window.gwToast(msg, kind || 'info');
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

  function lifiBase() {
    if (typeof window.GW_LIFI_ENDPOINT === 'string' && window.GW_LIFI_ENDPOINT) return window.GW_LIFI_ENDPOINT;
    return 'https://li.quest/v1';
  }

  function padAddr(a) {
    return String(a || '').toLowerCase().replace(/^0x/, '').padStart(64, '0');
  }

  async function fetchConfig(force) {
    if (_cfg && !force) return _cfg;
    const r = await fetch('/api/market/predict/config', { cache: 'no-store' });
    _cfg = await r.json();
    return _cfg;
  }

  async function getChainId(provider) {
    const p = provider || eth();
    if (!p?.request) return 0;
    try {
      const hex = await p.request({ method: 'eth_chainId' });
      return parseInt(hex, 16) || 0;
    } catch (_) { return 0; }
  }

  async function ensurePolygon(provider) {
    const p = provider || eth();
    if (!p?.request) throw new Error('Connect wallet first');
    let cid = await getChainId(p);
    if (cid === POLY_CHAIN) return;
    toast('Switch wallet to Polygon…', 'info');
    try {
      await p.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x89' }],
      });
    } catch (e) {
      if (e && (e.code === 4902 || /unrecognized|unknown chain/i.test(String(e.message || e)))) {
        await p.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: '0x89',
            chainName: 'Polygon',
            nativeCurrency: { name: 'POL', symbol: 'POL', decimals: 18 },
            rpcUrls: ['https://polygon-rpc.com'],
            blockExplorerUrls: ['https://polygonscan.com'],
          }],
        });
      } else {
        throw new Error('Switch wallet to Polygon to trade predictions');
      }
    }
    cid = await getChainId(p);
    if (cid !== POLY_CHAIN) throw new Error('Still not on Polygon — switch network in wallet');
  }

  async function erc20Balance(provider, token, owner) {
    try {
      const data = ERC20_BAL + padAddr(owner);
      const raw = await provider.request({
        method: 'eth_call',
        params: [{ to: token, data }, 'latest'],
      });
      return Number(BigInt(raw || '0x0')) / 1e6;
    } catch (_) { return 0; }
  }

  /** Public-RPC balance — works on mobile when wallet RPC is on another chain. */
  async function erc20BalancePublic(chainId, token, owner) {
    const cid = Number(chainId);
    const urls = cid === 137
      ? ['https://polygon-rpc.com', 'https://rpc.ankr.com/polygon', 'https://1rpc.io/matic']
      : (cid === 42161
        ? ['https://arb1.arbitrum.io/rpc', 'https://rpc.ankr.com/arbitrum', 'https://1rpc.io/arb']
        : (cid === 1
          ? ['https://ethereum.publicnode.com', 'https://rpc.ankr.com/eth', 'https://1rpc.io/eth']
          : []));
    if (!urls.length || !token || !owner) return 0;
    const data = ERC20_BAL + padAddr(owner);
    for (const url of urls) {
      try {
        const r = await fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0', id: 1, method: 'eth_call',
            params: [{ to: token, data }, 'latest'],
          }),
        });
        const j = await r.json();
        if (j && j.result) return Number(BigInt(j.result)) / 1e6;
      } catch (_) {}
    }
    return 0;
  }

  function readDisplayAddress() {
    try {
      if (typeof window.gwDisplayAddress === 'function') {
        const a = window.gwDisplayAddress();
        if (a && /^0x[a-fA-F0-9]{40}$/i.test(a)) return a;
      }
    } catch (_) {}
    try {
      if (typeof window.gwReadOnlyAddress === 'function') {
        const a = window.gwReadOnlyAddress();
        if (a && /^0x[a-fA-F0-9]{40}$/i.test(a)) return a;
      }
    } catch (_) {}
    try {
      const s = localStorage.getItem('grom_wallet_label') || '';
      if (/^0x[a-fA-F0-9]{40}$/i.test(s)) return s;
    } catch (_) {}
    return '';
  }

  async function erc20Allowance(provider, token, owner, spender) {
    const data = ERC20_ALLOW + padAddr(owner) + padAddr(spender);
    const raw = await provider.request({
      method: 'eth_call',
      params: [{ to: token, data }, 'latest'],
    });
    return BigInt(raw || '0x0');
  }

  async function erc20ApproveMax(provider, token, owner, spender) {
    const max = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
    const data = ERC20_APPROVE + padAddr(spender) + max.slice(2);
    const hash = await provider.request({
      method: 'eth_sendTransaction',
      params: [{ from: owner, to: token, data }],
    });
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      const rec = await provider.request({ method: 'eth_getTransactionReceipt', params: [hash] });
      if (rec && rec.blockNumber) {
        if (rec.status === '0x0') throw new Error('Approve failed');
        return hash;
      }
    }
    return hash;
  }

  async function getAccount(provider) {
    const p = provider || eth();
    let address = '';
    try {
      if (p?.accounts?.[0]) address = String(p.accounts[0]);
    } catch (_) {}
    if (!address && p?.request) {
      try {
        const accounts = await p.request({ method: 'eth_accounts' });
        address = String(accounts?.[0] || '');
      } catch (_) {}
    }
    if (!address && p?.request) {
      try {
        const accounts = await p.request({ method: 'eth_requestAccounts' });
        address = String(accounts?.[0] || '');
      } catch (_) {}
    }
    if (!address) {
      try { address = readDisplayAddress(); } catch (_) {}
    }
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) throw new Error('Connect wallet first');
    return address;
  }

  /** Snapshot for UI: chain, Polygon stables, whether bridge/swap is needed.
   *  Mobile Trust/WC often has empty eth_accounts while the chip still shows
   *  a restored address — always fall back to gwDisplayAddress. */
  async function getStatus() {
    const provider = eth();
    let address = '';
    if (provider?.request) {
      try {
        const acc = await provider.request({ method: 'eth_accounts' });
        address = String(acc?.[0] || '');
      } catch (_) {}
    }
    if (!address) address = readDisplayAddress();

    let chainId = 0;
    if (provider?.request) {
      try { chainId = await getChainId(provider); } catch (_) {}
    }
    if (!chainId) {
      try {
        if (typeof window.gwGetActiveUiChainId === 'function') {
          chainId = Number(window.gwGetActiveUiChainId()) || 0;
        }
      } catch (_) {}
    }
    if (!chainId) {
      try {
        const hex = window.ethereum && window.ethereum.chainId;
        if (hex) chainId = parseInt(hex, 16) || 0;
      } catch (_) {}
    }

    const onPolygon = chainId === POLY_CHAIN;
    let usdc = 0;
    let usdt = 0;
    if (address && provider?.request && STABLES[chainId]) {
      usdc = await erc20Balance(provider, STABLES[chainId].USDC, address);
      usdt = await erc20Balance(provider, STABLES[chainId].USDT, address);
    }

    // Always read Polygon + Arbitrum collateral via public RPC (mobile WC often wrong chain).
    let polyUsdc = 0;
    let polyUsdt = 0;
    let arbUsdc = 0;
    if (address) {
      if (onPolygon && provider?.request) {
        polyUsdc = usdc;
        polyUsdt = usdt;
      } else {
        const [a, b] = await Promise.all([
          erc20BalancePublic(137, STABLES[137].USDC, address),
          erc20BalancePublic(137, STABLES[137].USDT, address),
        ]);
        polyUsdc = a;
        polyUsdt = b;
      }
      if (chainId === 42161 && usdc > 0) {
        arbUsdc = usdc;
      } else {
        arbUsdc = await erc20BalancePublic(42161, STABLES[42161].USDC, address);
      }
      // If current-chain read failed but we are on Arb, prefer public Arb figure.
      if (chainId === 42161 && arbUsdc > usdc) usdc = arbUsdc;
    }
    const polyBal = polyUsdc + polyUsdt;
    let label = CHAIN_LABEL[chainId] || '';
    try {
      if ((!label || label === '—') && typeof window.gwChainLabel === 'function' && chainId) {
        label = window.gwChainLabel(chainId) || label;
      }
    } catch (_) {}
    if (!label) label = chainId ? ('chain ' + chainId) : '—';
    return {
      connected: !!address,
      chainId,
      onPolygon,
      address,
      usdc,
      usdt,
      arbUsdc,
      label,
      polyUsdc,
      polyUsdt,
      polyBal,
      needsFund: polyUsdc < 1,
    };
  }

  /**
   * Bridge USDC or USDT from current EVM chain → Polygon USDC via LiFi.
   * User signs approve (if needed) + bridge tx.
   */
  async function bridgeToPolygon({ amountUsd, fromSym }) {
    const amt = Number(amountUsd);
    if (!(amt > 0)) throw new Error('Enter amount to bridge');
    const provider = eth();
    if (!provider?.request) throw new Error('Connect wallet first');
    const address = await getAccount(provider);
    let fromChain = await getChainId(provider);
    if (fromChain === POLY_CHAIN) {
      throw new Error('Already on Polygon — no bridge needed');
    }
    if (!STABLES[fromChain]) {
      throw new Error('Bridge from this network is not supported yet — switch to ETH / Arbitrum / Base / Optimism / BSC');
    }

    // Prefer requested sym, else whichever balance covers the amount.
    let sym = (fromSym || '').toUpperCase();
    if (sym !== 'USDC' && sym !== 'USDT') {
      const balUsdc = await erc20Balance(provider, STABLES[fromChain].USDC, address);
      const balUsdt = await erc20Balance(provider, STABLES[fromChain].USDT, address);
      if (balUsdc >= amt) sym = 'USDC';
      else if (balUsdt >= amt) sym = 'USDT';
      else if (balUsdc >= balUsdt) sym = 'USDC';
      else sym = 'USDT';
    }
    const fromToken = STABLES[fromChain][sym];
    const toToken = STABLES[137].USDC;
    if (!fromToken || !toToken) throw new Error('Missing stable addresses');

    const fromAmount = BigInt(Math.floor(amt * 1e6)).toString();
    const integrator = (typeof window.GW_LIFI_INTEGRATOR === 'string' && window.GW_LIFI_INTEGRATOR)
      ? window.GW_LIFI_INTEGRATOR
      : 'grom-exchange';
    const qs = new URLSearchParams({
      fromChain: String(fromChain),
      toChain: String(POLY_CHAIN),
      fromToken,
      toToken,
      fromAmount,
      fromAddress: address,
      toAddress: address,
      slippage: '0.01',
      integrator,
      order: 'RECOMMENDED',
    });
    toast('Finding bridge route → Polygon USDC…', 'info');
    const r = await fetch(lifiBase() + '/quote?' + qs, { headers: { accept: 'application/json' } });
    if (!r.ok) {
      const t = await r.text().catch(() => '');
      throw new Error('No bridge route: ' + (t || r.status).toString().slice(0, 120));
    }
    const quote = await r.json();
    const tx = quote.transactionRequest;
    if (!tx?.to || !tx?.data) throw new Error('Bridge quote has no transaction');

    const amountIn = BigInt(fromAmount);
    const spender = quote.estimate?.approvalAddress || tx.to;
    const allow = await erc20Allowance(provider, fromToken, address, spender);
    if (allow < amountIn) {
      toast('Approve ' + sym + ' for bridge…', 'info');
      await erc20ApproveMax(provider, fromToken, address, spender);
    }

    const outAmt = Number(quote.estimate?.toAmount || 0) / 1e6;
    toast('Confirm bridge in wallet · ~' + outAmt.toFixed(2) + ' USDC on Polygon', 'info');
    const hash = await provider.request({
      method: 'eth_sendTransaction',
      params: [{
        from: address,
        to: tx.to,
        data: tx.data,
        value: tx.value || '0x0',
        ...(tx.gasLimit ? { gas: tx.gasLimit } : {}),
        ...(tx.gasPrice ? { gasPrice: tx.gasPrice } : {}),
      }],
    });
    toast('Bridge submitted · wait 1–5 min, then bet on Polygon', 'success');
    return { hash, quote, fromChain, sym, outAmt };
  }

  async function loadSdk() {
    const urls = [
      'https://esm.sh/@polymarket/clob-client-v2@1.0.3?bundle',
      'https://esm.sh/@polymarket/clob-client-v2@1.0.0?bundle',
      'https://esm.sh/@polymarket/clob-client@4.22.8?bundle',
    ];
    let last;
    for (const u of urls) {
      try {
        const mod = await import(/* webpackIgnore: true */ u);
        return mod;
      } catch (e) { last = e; }
    }
    throw last || new Error('Prediction market SDK unavailable');
  }

  function ethersSignerFromProvider(provider, address) {
    return {
      _address: address,
      getAddress: async () => address,
      provider: {
        getNetwork: async () => ({ chainId: BigInt(POLY_CHAIN) }),
      },
      signMessage: async (msg) => {
        const m = typeof msg === 'string' ? msg : (
          '0x' + Array.from(msg).map((b) => b.toString(16).padStart(2, '0')).join('')
        );
        return provider.request({
          method: 'personal_sign',
          params: [m, address],
        });
      },
      _signTypedData: async (domain, types, value) => {
        const primary = Object.keys(types).find((k) => k !== 'EIP712Domain');
        const t = { ...types };
        delete t.EIP712Domain;
        return provider.request({
          method: 'eth_signTypedData_v4',
          params: [address, JSON.stringify({
            types: { EIP712Domain: [
              { name: 'name', type: 'string' },
              { name: 'version', type: 'string' },
              { name: 'chainId', type: 'uint256' },
              { name: 'verifyingContract', type: 'address' },
            ], ...t },
            primaryType: primary,
            domain: {
              ...domain,
              chainId: typeof domain.chainId === 'bigint' ? Number(domain.chainId) : domain.chainId,
            },
            message: value,
          })],
        });
      },
      signTypedData: async function (domain, types, value) {
        return this._signTypedData(domain, types, value);
      },
    };
  }

  async function getClient(force) {
    if (_client && !force) return _client;
    const provider = eth();
    if (!provider?.request) {
      try { if (typeof openConnectModal === 'function') openConnectModal(); } catch (_) {}
      throw new Error('Connect wallet first');
    }
    const address = await getAccount(provider);
    await ensurePolygon(provider);
    const cfg = await fetchConfig();
    const host = (typeof location !== 'undefined' ? location.origin : '') + (cfg.clobHost || '/api/market/clob');
    const mod = await loadSdk();
    const ClobClient = mod.ClobClient || mod.default?.ClobClient || mod.default;
    _Side = mod.Side || mod.OrderSide || mod.default?.Side || { BUY: 'BUY', SELL: 'SELL' };
    if (!ClobClient) throw new Error('ClobClient missing from SDK');
    const signer = ethersSignerFromProvider(provider, address);

    let client;
    try {
      client = new ClobClient({ host, chain: POLY_CHAIN, chainId: POLY_CHAIN, signer });
    } catch (_) {
      client = new ClobClient(host, POLY_CHAIN, signer);
    }
    let creds;
    if (typeof client.createOrDeriveApiKey === 'function') {
      creds = await client.createOrDeriveApiKey();
    } else if (typeof client.createApiKey === 'function') {
      try { creds = await client.createApiKey(); }
      catch (_) { creds = await client.deriveApiKey?.(); }
    }
    if (!creds) throw new Error('Could not create trading credentials — sign the message in your wallet');

    try {
      client = new ClobClient({
        host,
        chain: POLY_CHAIN,
        chainId: POLY_CHAIN,
        signer,
        creds,
        signatureType: 0,
        funderAddress: address,
      });
    } catch (_) {
      client = new ClobClient(host, POLY_CHAIN, signer, creds, 0, address);
    }
    _client = client;
    _addr = address;
    return client;
  }

  async function buyMarket({ tokenId, amountUsd, tickSize, negRisk }) {
    const amt = Number(amountUsd);
    if (!(amt > 0)) throw new Error('Enter amount');
    if (!tokenId) throw new Error('Missing outcome token');
    const cfg = await fetchConfig();
    const builderCode = cfg.enabled ? cfg.builderCode : ZERO_BUILDER;
    // Always force Polygon before CLOB creds / order
    await ensurePolygon();
    const client = await getClient(true);
    const tick = String(tickSize || '0.01');
    const sideBuy = _Side.BUY != null ? _Side.BUY : 'BUY';

    toast('Confirm in wallet…', 'info');

    if (typeof client.createAndPostMarketOrder === 'function') {
      return client.createAndPostMarketOrder(
        {
          tokenID: String(tokenId),
          tokenId: String(tokenId),
          amount: Number(amt),
          side: sideBuy,
          builderCode,
        },
        { tickSize: tick, negRisk: !!negRisk },
      );
    }
    if (typeof client.placeMarketOrder === 'function') {
      return client.placeMarketOrder({
        tokenId: String(tokenId),
        side: sideBuy,
        amount: String(amt),
        builderCode,
      });
    }
    const book = await fetch((cfg.clobHost || '/api/market/clob') + '/book?token_id=' + encodeURIComponent(tokenId));
    const bj = await book.json().catch(() => ({}));
    const ask = Number(bj?.asks?.[0]?.price || bj?.asks?.[0]?.[0] || 0.99);
    const price = Math.min(0.99, Math.max(0.01, ask || 0.99));
    const size = Math.max(Number(amt) / price, Number(cfg.minSize) || 5);
    if (typeof client.createAndPostOrder === 'function') {
      return client.createAndPostOrder(
        {
          tokenID: String(tokenId),
          tokenId: String(tokenId),
          price,
          size,
          side: sideBuy,
          builderCode,
        },
        { tickSize: tick, negRisk: !!negRisk },
      );
    }
    throw new Error('Prediction order API not available in this build');
  }

  async function listPositions() {
    const provider = eth();
    let address = _addr;
    if (!address && provider?.request) {
      try {
        const acc = await provider.request({ method: 'eth_accounts' });
        address = acc?.[0] || '';
      } catch (_) {}
    }
    if (!/^0x[a-fA-F0-9]{40}$/i.test(address)) return [];
    const r = await fetch('/api/market/pm-data/positions?user=' + encodeURIComponent(address), { cache: 'no-store' });
    if (!r.ok) return [];
    const data = await r.json();
    return Array.isArray(data) ? data : [];
  }

  window.gromPredict = {
    fetchConfig,
    getClient,
    buyMarket,
    listPositions,
    ensurePolygon,
    getStatus,
    bridgeToPolygon,
    POLY_CHAIN,
    isLiveReady: async () => {
      const c = await fetchConfig();
      return !!c.enabled;
    },
  };
})();
