/** GROM Predict — pUSD collateral on Polygon, CLOB v2 EOA orders.
 * Contract references: https://docs.polymarket.com/resources/contracts
 * Funding: https://docs.polymarket.com/concepts/pusd
 */
(function () {
  'use strict';
  const POLY_CHAIN = 137;
  const PUSD = '0xC011a7E12a19f7B1f670d46F03B03f3342E82DFB';
  const USDCE = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';
  const ONRAMP = '0x93070a847efEf7F70739046A929D47a521F5B8ee';
  const OFFRAMP = '0x2957922Eb93258b93368531d39fAcCA3B4dC5854';
  const EXCHANGE = '0xE111180000d2663C0091e4f400237545B87B996B';
  const NEG_EXCHANGE = '0xe2222d279d744050d28e00520010520000310F59';
  const ERC20_BAL = '0x70a08231', ERC20_ALLOW = '0xdd62ed3e', ERC20_APPROVE = '0x095ea581';
  let _cfg, _sdk, _client, _clientProvider, _clientAddress = '', _busy = false;
  const _status = new Map(), _statusFlight = new Map(), _pendingMemory = new Map();

  function tr(ru, en) {
    try { return (localStorage.getItem('grom_lang') || document.documentElement.lang).startsWith('ru') ? ru : en; }
    catch (_) { return en; }
  }
  function fail(code, ru, en) { return Object.assign(new Error(tr(ru, en)), { code }); }
  function toast(msg, kind) {
    try { (window.notify || window.gwToast)?.(msg, kind || 'info'); } catch (_) {}
  }
  function padAddr(a) {
    if (!/^0x[0-9a-f]{40}$/i.test(a)) throw new Error('Invalid wallet or contract address');
    return a.slice(2).toLowerCase().padStart(64, '0');
  }
  function units(value) {
    // Never round up a requested spend or silently reinterpret an exponent.
    const s = String(value).trim();
    if (!/^\d+(?:\.\d{1,6})?$/.test(s)) throw fail('AMOUNT', 'Введите сумму с точностью до 6 знаков.', 'Enter an amount with up to 6 decimals.');
    const [whole, frac = ''] = s.split('.');
    const n = BigInt(whole) * 1000000n + BigInt(frac.padEnd(6, '0'));
    if (n <= 0n || n > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Invalid amount');
    return n;
  }
  async function bounded(promise, ms = 5000) {
    let timer;
    try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Read timeout')), ms); })]); }
    finally { clearTimeout(timer); }
  }
  async function json(url, options = {}) {
    const abort = new AbortController(), timer = setTimeout(() => abort.abort(), 8000);
    try {
      const r = await fetch(url, { ...options, signal: abort.signal });
      if (!r.ok) throw new Error('API unavailable (' + r.status + ')');
      return await r.json();
    } finally { clearTimeout(timer); }
  }
  async function fetchConfig(force) {
    if (!_cfg || force) _cfg = await json('/api/market/predict/config', { cache: 'no-store' });
    return _cfg;
  }
  function eth() {
    try {
      if (typeof window.gwActiveSigningProvider === 'function') {
        const p = window.gwActiveSigningProvider();
        return p?.request ? p : null;
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


  async function getAccount(provider) {
    // A remembered address is sufficient for display, never for authorization.
    if (!provider?.request) throw fail('CONNECT', 'Подключите кошелёк.', 'Connect your wallet.');
    let acc = await bounded(provider.request({ method: 'eth_accounts' }));
    if (!acc?.[0]) acc = await provider.request({ method: 'eth_requestAccounts' });
    const address = String(acc?.[0] || '');
    padAddr(address);
    return address;
  }
  async function assertSigner(provider, address) {
    if (eth() !== provider || (await getAccount(provider)).toLowerCase() !== address.toLowerCase() || await getChainId(provider) !== POLY_CHAIN) {
      throw fail('WALLET_CHANGED', 'Кошелёк или сеть изменились. Проверьте выбранный аккаунт.', 'Wallet or network changed. Check the selected account.');
    }
  }
  async function polygonRead(method, params) {
    let last;
    // Read through public RPC even when the signing wallet is on another network.
    for (const url of ['https://polygon-bor-rpc.publicnode.com', 'https://polygon.drpc.org']) {
      try {
        const r = await json(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
        if (r.error || r.result === undefined) throw new Error(r.error?.message || 'Empty RPC result');
        return r.result;
      } catch (e) { last = e; }
    }
    throw last || new Error('Polygon RPC unavailable');
  }
  async function rawBalance(token, owner) {
    return BigInt(await polygonRead('eth_call', [{ to: token, data: ERC20_BAL + padAddr(owner) }, 'latest']));
  }
  function pendingKey(address) { return 'grom_predict_pending_v1:' + address.toLowerCase(); }
  function pendingRead(address) {
    try { return JSON.parse(localStorage.getItem(pendingKey(address)) || 'null') || _pendingMemory.get(address.toLowerCase()); }
    catch (_) { return _pendingMemory.get(address.toLowerCase()); }
  }
  function pendingWrite(address, value) {
    _pendingMemory.set(address.toLowerCase(), value);
    try {
      if (value) localStorage.setItem(pendingKey(address), JSON.stringify(value));
      else localStorage.removeItem(pendingKey(address));
    } catch (_) { /* In-memory lock still protects this page. */ }
    _status.delete(address.toLowerCase());
  }
  function pendingError() { return fail('PREDICT_PENDING', 'Предыдущий запрос ещё проверяется. Проверьте историю кошелька перед повтором.', 'Previous request is still being checked. Check wallet history before trying again.'); }
  async function checkPending(address) {
    const op = pendingRead(address);
    if (!op) return null;
    if (op.hash) {
      try {
        const rec = await polygonRead('eth_getTransactionReceipt', [op.hash]);
        if (rec?.blockNumber && (rec.status === '0x1' || rec.status === '0x0')) {
          pendingWrite(address, null);
          return null;
        }
      } catch (_) {}
    }
    return op;
  }
  async function getStatus({ force = false } = {}) {
    const provider = eth();
    let address = readDisplayAddress();
    try {
      const accounts = provider?.request ? await bounded(provider.request({ method: 'eth_accounts' }), 1500) : [];
      if (accounts?.[0]) address = String(accounts[0]);
    } catch (_) {}
    if (!/^0x[0-9a-f]{40}$/i.test(address)) return { connected: false, polyBal: null, needsFund: true };
    const key = address.toLowerCase();
    if (_statusFlight.has(key)) return _statusFlight.get(key);
    if (!force && _status.has(key) && Date.now() - _status.get(key).at < 15000) return _status.get(key).value;
    const work = (async () => {
      const [pusd, usdce, pending] = await Promise.all([
        rawBalance(PUSD, address).catch(() => null), rawBalance(USDCE, address).catch(() => null), checkPending(address),
      ]);
      const value = { connected: true, address, chainId: POLY_CHAIN, collateral: 'pUSD',
        polyBal: pusd === null ? null : Number(pusd) / 1e6,
        polyUsdce: usdce === null ? null : Number(usdce) / 1e6,
        balanceUnavailable: pusd === null, needsFund: pusd !== null && pusd < 1000000n, pending };
      _status.set(key, { at: Date.now(), value });
      return value;
    })();
    _statusFlight.set(key, work);
    try { return await work; } finally { _statusFlight.delete(key); }
  }
  async function exclusive(fn) {
    if (_busy) throw pendingError();
    _busy = true;
    try { return await fn(); } finally { _busy = false; }
  }
  function rejected(e) { return Number(e?.code) === 4001 || /user rejected|user denied|request rejected/i.test(String(e?.message)); }
  async function sendConfirmed(provider, address, tx, kind) {
    await assertSigner(provider, address);
    if (await checkPending(address)) throw pendingError();
    pendingWrite(address, { kind, at: Date.now(), state: 'wallet' });
    let hash;
    try {
      hash = await provider.request({ method: 'eth_sendTransaction', params: [{ from: address, ...tx }] });
    } catch (e) {
      if (rejected(e)) pendingWrite(address, null);
      throw e;
    }
    if (!/^0x[0-9a-f]{64}$/i.test(hash)) throw pendingError();
    pendingWrite(address, { kind, hash, at: Date.now(), state: 'confirming' });
    for (let i = 0; i < 30; i++) {
      const rec = await polygonRead('eth_getTransactionReceipt', [hash]).catch(() => null);
      if (rec?.blockNumber && (rec.status === '0x1' || rec.status === '0x0')) {
        pendingWrite(address, null);
        if (rec.status === '0x0') throw fail('TX_REVERTED', 'Транзакция отклонена сетью.', 'Transaction reverted on chain.');
        return hash;
      }
      await new Promise(r => setTimeout(r, 2000));
    }
    throw pendingError();
  }
  async function approve(provider, address, token, spender, amount) {
    const raw = await polygonRead('eth_call', [{ to: token, data: ERC20_ALLOW + padAddr(address) + padAddr(spender) }, 'latest']);
    if (BigInt(raw) >= amount) return;
    toast(tr('Разрешите использование выбранной суммы в кошельке.', 'Approve the selected amount in your wallet.'));
    await sendConfirmed(provider, address, { to: token, data: ERC20_APPROVE + padAddr(spender) + amount.toString(16).padStart(64, '0') }, 'approval');
  }
  async function loadSdk() {
    // No legacy v1 fallback: its order domain/collateral are incompatible.
    if (!_sdk) _sdk = import(/* webpackIgnore: true */ 'https://esm.sh/@polymarket/clob-client-v2@1.0.3?bundle').catch(e => { _sdk = null; throw e; });
    return _sdk;
  }
  function ethersSignerFromProvider(provider, address) {
    return {
      getAddress: async () => address,
      _signTypedData: async (domain, types, value) => {
        await assertSigner(provider, address);
        const definitions = { name: 'string', version: 'string', chainId: 'uint256', verifyingContract: 'address', salt: 'bytes32' };
        const t = { ...types }; delete t.EIP712Domain;
        const typed = { types: { EIP712Domain: Object.keys(definitions).filter(k => domain[k] !== undefined).map(name => ({ name, type: definitions[name] })), ...t },
          primaryType: Object.keys(t)[0], domain, message: value };
        return provider.request({ method: 'eth_signTypedData_v4', params: [address, JSON.stringify(typed, (_, v) => typeof v === 'bigint' ? v.toString() : v)] });
      },
      signTypedData: async function (domain, types, value) { return this._signTypedData(domain, types, value); },
    };
  }
  async function getClient(force = false) {
    const provider = eth(), address = await getAccount(provider);
    await ensurePolygon(provider);
    if (!force && _client && provider === _clientProvider && address.toLowerCase() === _clientAddress) return _client;
    const cfg = await fetchConfig(), mod = await loadSdk();
    if (!cfg.enabled) throw fail('PREDICT_DISABLED', 'Торговля прогнозами пока недоступна.', 'Prediction trading is unavailable.');
    const host = location.origin + '/api/market/clob';
    const signer = ethersSignerFromProvider(provider, address);
    const base = { host, chain: POLY_CHAIN, signer, signatureType: 0, funderAddress: address, retryOnError: false, useServerTime: true };
    const auth = new mod.ClobClient(base);
    if (Number(await auth.getVersion()) !== 2) throw new Error('Unsupported Polymarket order version');
    const creds = await auth.createOrDeriveApiKey();
    if (!creds?.key || !creds?.secret || !creds?.passphrase) throw new Error('Trading authorization was not completed');
    await assertSigner(provider, address);
    _client = new mod.ClobClient({ ...base, creds, throwOnError: true });
    _clientProvider = provider; _clientAddress = address.toLowerCase();
    return _client;
  }
  async function convertCollateral({ amountUsd, direction = 'wrap' }) {
    return exclusive(async () => {
      const amount = units(amountUsd), provider = eth(), address = await getAccount(provider);
      if (!['wrap', 'unwrap'].includes(direction)) throw new Error('Invalid conversion');
      await ensurePolygon(provider);
      if (await checkPending(address)) throw pendingError();
      const token = direction === 'wrap' ? USDCE : PUSD, ramp = direction === 'wrap' ? ONRAMP : OFFRAMP;
      if (await rawBalance(token, address) < amount) throw fail('BALANCE', 'Недостаточно средств для конвертации.', 'Insufficient conversion balance.');
      // ABI selectors are fixed below; no provider-supplied destination is used.
      await approve(provider, address, token, ramp, amount);
      const selector = direction === 'wrap' ? '0x62355638' : '0x8cc7104f';
      const hash = await sendConfirmed(provider, address, { to: ramp, data: selector + padAddr(USDCE) + padAddr(address) + amount.toString(16).padStart(64, '0') }, direction);
      _status.clear();
      return { hash, confirmed: true };
    });
  }
  async function buyMarket({ tokenId, amountUsd }) {
    return exclusive(async () => {
      const amount = units(amountUsd), provider = eth(), address = await getAccount(provider);
      if (!/^\d+$/.test(String(tokenId))) throw new Error('Missing outcome token');
      const cfg = await fetchConfig();
      if (!cfg.enabled) throw new Error('Prediction trading unavailable');
      await ensurePolygon(provider);
      if (await checkPending(address)) throw pendingError();
      const balance = await rawBalance(PUSD, address);
      if (balance < amount) throw fail('PUSD_REQUIRED', 'Недостаточно pUSD. Пополните баланс прогнозов.', 'Insufficient pUSD. Fund your prediction balance.');
      const client = await getClient();
      if (Number(await client.resolveVersion(true)) !== 2) throw new Error('Unsupported Polymarket order version');
      const actualNegRisk = await client.getNegRisk(String(tokenId));
      if (typeof actualNegRisk !== 'boolean') throw new Error('Market configuration unavailable');
      await approve(provider, address, PUSD, actualNegRisk ? NEG_EXCHANGE : EXCHANGE, amount);
      await client.updateBalanceAllowance({ asset_type: 'COLLATERAL' });
      await assertSigner(provider, address);
      // Sign once, post once. Never retry an ambiguous financial submission.
      const order = await client.createMarketOrder({ tokenID: String(tokenId), amount: Number(amount) / 1e6,
        userUSDCBalance: Number(amount) / 1e6, side: 'BUY', orderType: 'FOK', builderCode: cfg.builderCode },
      { negRisk: actualNegRisk });
      if (BigInt(order.makerAmount) > amount || BigInt(order.makerAmount) <= 0n) throw new Error('Order exceeds selected amount');
      await assertSigner(provider, address);
      if (pendingRead(address)) throw pendingError();
      pendingWrite(address, { kind: 'order', state: 'submitting', at: Date.now(), tokenId: String(tokenId), amount: String(amountUsd) });
      let result;
      try { result = await client.postOrder(order, 'FOK'); }
      catch (e) {
        // Only an explicit non-timeout client rejection proves there is no order.
        if ([400, 401, 403, 404, 422].includes(Number(e?.status))) pendingWrite(address, null);
        throw e;
      }
      if (result?.success === false) {
        pendingWrite(address, null);
        throw new Error(result.errorMsg || result.error || 'Order rejected');
      }
      if (result?.success !== true || !(result.orderID || result.orderId)) throw pendingError();
      pendingWrite(address, null); _status.clear();
      return result;
    });
  }
  async function listPositions() {
    let address = readDisplayAddress();
    try { const accounts = await bounded(eth()?.request({ method: 'eth_accounts' }), 1500); if (accounts?.[0]) address = accounts[0]; } catch (_) {}
    if (!/^0x[0-9a-f]{40}$/i.test(address)) return [];
    const data = await json('/api/market/pm-data/positions?user=' + encodeURIComponent(address), { cache: 'no-store' });
    return Array.isArray(data) ? data : [];
  }
  function resetSession() { _client = null; _clientProvider = null; _clientAddress = ''; _status.clear(); }
  document.addEventListener('grom:wallet-disconnected', resetSession);
  document.addEventListener('grom:wallet-connected', resetSession);
  window.gromPredict = { fetchConfig, getClient, buyMarket, listPositions, ensurePolygon, getStatus, convertCollateral,
    POLY_CHAIN, USDCE, PUSD, isLiveReady: async () => !!(await fetchConfig()).enabled };
})();
