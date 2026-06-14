/* ==========================================================================
 * GROM · Wallet integration (WalletConnect v2 + injected providers)
 *
 * ВАЖНО: это ES-модуль, подключается через <script type="module">.
 * Работает ТОЛЬКО при открытии через HTTP (file:// не позволит SDK запуститься).
 * Запусти локально:
 *   cd "/Users/hevorksimonyan/Desktop/grom 1"
 *   npx http-server . -p 8080 -c-1
 *   открой http://localhost:8080/grom-preview.html
 * ========================================================================== */

// >>>>>>>>>>>>>>>>>>  ВПИШИ СЮДА СВОЙ PROJECT ID  <<<<<<<<<<<<<<<<<<
// Получен на https://cloud.reown.com → Projects → Project ID
// Reown / WalletConnect Project ID. Это публичный client-side идентификатор, не secret.
const WC_PROJECT_ID = '28302d1699a8833692b54f0454164625';
// >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

import { EthereumProvider } from 'https://esm.sh/@walletconnect/ethereum-provider@2.18.0';

/* ----- metadata для WalletConnect / Trust Wallet Verify API -----
 * url ДОЛЖЕН совпадать с реальным доменом (иначе «Недійсний домен»).
 * Нормализуем www → apex и фиксируем production origin. */
function walletAppOrigin() {
  const host = (location.hostname || '').replace(/^www\./i, '');
  if (host === 'grom.exchange') return 'https://grom.exchange';
  if (location.protocol === 'http:' || location.protocol === 'https:') {
    return location.protocol + '//' + host + (location.port ? ':' + location.port : '');
  }
  return 'https://grom.exchange';
}
const WALLET_APP_ORIGIN = walletAppOrigin();
const METADATA = {
  name: 'GROM',
  description: 'Trade spot, binary options, and futures on GROM.',
  url: WALLET_APP_ORIGIN,
  icons: [WALLET_APP_ORIGIN + '/assets/grom-brand-mark-clear.png']
};

/* ----- chains (Arbitrum по умолчанию, остальные как optional) ----- */
const CHAINS = {
  required: [42161],                      // Arbitrum One
  optional: [1, 8453, 137, 56, 10, 43114] // Ethereum, Base, Polygon, BNB, Optimism, Avalanche
};

/* ----- state ----- */
let wcProvider = null;
let currentAccount = null;
let currentChainId = null;

/* ----- UI hook: обновляем чип и закрываем модалку ----- */
function updateChip(addr) {
  currentAccount = addr || null;
  const short = addr ? (addr.slice(0, 6) + '…' + addr.slice(-4)) : 'Connect wallet';
  if (typeof window.setWalletLabel === 'function') window.setWalletLabel(short);
  if (window.GROM_CONN) {
    window.GROM_CONN.connected = !!addr;
    window.GROM_CONN.label = addr || '';
  }
  if (typeof window.closeConnectModal === 'function') window.closeConnectModal();
  if (typeof window.toast === 'function' && addr) window.toast('Wallet connected · ' + short, 'success');
}

function failToast(e) {
  const msg = (e && e.message) ? e.message : String(e);
  console.error('[grom-wallet]', e);
  if (typeof window.toast === 'function') window.toast('Connection failed: ' + msg.slice(0, 80), 'error');
}

function syncEmailSession(email, token, user) {
  const label = email || user?.email || 'Email account';
  localStorage.setItem('grom_jwt', token);
  localStorage.setItem('grom_wallet_label', label);
  localStorage.setItem('grom_user', JSON.stringify(user || { email: label }));

  if (window.GROM_CONN) {
    window.GROM_CONN.connected = true;
    window.GROM_CONN.label = label;
    window.GROM_CONN.method = 'email';
  }
  if (typeof window.setWalletLabel === 'function') window.setWalletLabel(label);
  if (typeof window.updateAuthUi === 'function') window.updateAuthUi();
  if (typeof window.closeConnectModal === 'function') window.closeConnectModal();
  if (window.gromWS?.connect) window.gromWS.connect();
  if (typeof window.hydrateWalletSlice === 'function') window.hydrateWalletSlice(true);
  if (typeof window.hydrateReferralSlice === 'function') window.hydrateReferralSlice(true);
}

async function connectEmail(email) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new Error('Enter a valid email');
  }

  const response = await fetch('/auth/email-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: normalized })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.token) {
    throw new Error(payload.error || payload.message || 'Email login failed');
  }

  syncEmailSession(normalized, payload.token, payload.user);
  window.toast?.('Signed in · ' + normalized, 'success');
  return payload;
}

function openEmailFallback(providerName = 'email') {
  if (typeof window.cnShowEmail === 'function') window.cnShowEmail();
  setTimeout(() => {
    const input = document.getElementById('cnEmail');
    if (input) {
      input.placeholder = providerName === 'Google' ? 'your@gmail.com' : 'you@example.com';
      input.focus();
    }
  }, 30);
}

/* ----- SIWE authentication after wallet connect -----
 * Without this, the UI chip says "Connected" but the backend has no JWT.
 * Every /api/wallet/* request returns 401 and no balance/deposit address
 * shows up. This helper runs after a successful EIP-1193 connect:
 *   1. Get fresh nonce from /auth/nonce (server stores it in DB)
 *   2. Build EIP-4361 SIWE message
 *   3. personal_sign through the wallet provider
 *   4. POST /auth/verify { message, signature } → { token, user }
 *   5. Persist JWT + update GROM_CONN + reconnect WS
 * If the user rejects the signature, throws and the caller disconnects.
 */
async function authenticateWithSIWE(address, provider) {
  if (!address || !provider) throw new Error('SIWE: missing address or provider');

  // 1. Server-issued nonce
  const nonceRes = await fetch('/auth/nonce', { method: 'POST' });
  const nonceJson = await nonceRes.json().catch(() => ({}));
  if (!nonceRes.ok || !nonceJson.nonce) {
    throw new Error(nonceJson.error || 'Could not get nonce from server');
  }
  const { nonce, statement, domain, version } = nonceJson;

  // 2. Probe chain id (some providers cache it; ask once)
  let chainId = currentChainId;
  try {
    const hex = await provider.request({ method: 'eth_chainId' });
    chainId = parseInt(hex, 16);
    currentChainId = chainId;
  } catch (_) {}
  if (!chainId) chainId = 1; // default to mainnet for SIWE only

  // 3. Build EIP-4361 SIWE message
  const issuedAt = new Date().toISOString();
  const siweDomain = domain || location.host;
  const siweStatement = statement || "Sign in to GROM. You're proving ownership of this wallet — no gas required.";
  const message =
`${siweDomain} wants you to sign in with your Ethereum account:
${address}

${siweStatement}

URI: ${location.origin}
Version: ${version || '1'}
Chain ID: ${chainId}
Nonce: ${nonce}
Issued At: ${issuedAt}`;

  // 4. Sign — this opens the wallet's signature dialog
  const signature = await provider.request({
    method: 'personal_sign',
    params: [message, address]
  });

  // 5. Verify with backend, receive JWT
  const verifyRes = await fetch('/auth/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, signature })
  });
  const verifyJson = await verifyRes.json().catch(() => ({}));
  if (!verifyRes.ok || !verifyJson.token) {
    throw new Error(verifyJson.error || 'Signature verification failed');
  }

  // 6. Persist + update UI
  const short = address.slice(0, 6) + '…' + address.slice(-4);
  try {
    localStorage.setItem('grom_jwt', verifyJson.token);
    localStorage.setItem('grom_wallet_label', address);
    localStorage.removeItem('grom:logged_out');
  } catch (_) {}
  if (window.GROM_CONN) {
    window.GROM_CONN.connected = true;
    window.GROM_CONN.label = address;
    window.GROM_CONN.method = 'wallet';
  }
  if (typeof window.setWalletLabel === 'function') window.setWalletLabel(short);
  if (typeof window.updateAuthUi === 'function') window.updateAuthUi();
  if (typeof window.closeConnectModal === 'function') window.closeConnectModal();
  if (typeof window.toast === 'function') window.toast('Connected · ' + short, 'success');
  if (window.gromWS?.connect) try { window.gromWS.connect(); } catch (_) {}
  if (typeof window.hydrateWalletSlice === 'function') window.hydrateWalletSlice(true);
  if (typeof window.hydrateReferralSlice === 'function') window.hydrateReferralSlice(true);

  return verifyJson;
}

/* ----- EIP-6963 + multi-wallet provider pickers -----
 * Trust/Binance often share window.ethereum with MetaMask — never call ethereum blindly. */
const EIP6963 = new Map();

function initEip6963() {
  if (typeof window === 'undefined') return;
  window.addEventListener('eip6963:announceProvider', (event) => {
    const { info, provider } = event.detail || {};
    if (info?.uuid) EIP6963.set(info.uuid, { info, provider });
    if (info?.rdns) EIP6963.set(info.rdns, { info, provider });
  });
  window.dispatchEvent(new Event('eip6963:requestProvider'));
}
initEip6963();

function rdnsProvider(...rdnsIds) {
  for (const id of rdnsIds) {
    const entry = EIP6963.get(id);
    if (entry?.provider) return entry.provider;
  }
  return null;
}

function legacyProviders() {
  const list = [];
  const eth = window.ethereum;
  if (Array.isArray(eth?.providers)) list.push(...eth.providers);
  else if (eth) list.push(eth);
  if (window.trustwallet) list.push(window.trustwallet);
  if (window.okxwallet) list.push(window.okxwallet);
  if (window.BinanceChain) list.push(window.BinanceChain);
  const binanceW3 = window.binancew3w?.ethereum || window.binance?.ethereum;
  if (binanceW3) list.push(binanceW3);
  if (window.coinbaseWalletExtension) list.push(window.coinbaseWalletExtension);
  return list.filter(Boolean);
}

function findLegacy(matchFn) {
  return legacyProviders().find(matchFn) || null;
}

function isMetaMaskProvider(p) {
  return !!p?.isMetaMask && !p?.isTrust && !p?.isTrustWallet && !p?.isBinance && !p?.isBinanceWallet && !p?.isCoinbaseWallet;
}
function isTrustProvider(p) {
  return !!(p?.isTrust || p?.isTrustWallet || p?.isTrustWalletProvider);
}
function isBinanceProvider(p) {
  return !!(p?.isBinance || p?.isBinanceWallet || p?.bbcSignTx);
}
function isCoinbaseProvider(p) {
  return !!p?.isCoinbaseWallet;
}

async function connectWithProvider(provider, label) {
  if (!provider?.request) throw new Error(label + ' provider unavailable');
  const accounts = await provider.request({ method: 'eth_requestAccounts' });
  if (!accounts?.length) throw new Error('User rejected');
  provider.on?.('accountsChanged', (accs) => updateChip(accs[0] || null));
  provider.on?.('chainChanged', (hex) => { currentChainId = parseInt(hex, 16); });
  await authenticateWithSIWE(accounts[0], provider);
  return accounts[0];
}

/* ----- 1. MetaMask ----- */
async function connectMetaMask() {
  let provider = rdnsProvider('io.metamask', 'io.metamask.mobile');
  if (!provider) provider = findLegacy(isMetaMaskProvider);
  if (!provider) {
    window.open('https://metamask.io/download/', '_blank');
    throw new Error('MetaMask not installed — opened download page');
  }
  return connectWithProvider(provider, 'MetaMask');
}

/* ----- 2. Trust Wallet ----- */
async function connectTrust() {
  let provider = rdnsProvider('com.trustwallet.app');
  if (!provider) provider = findLegacy(isTrustProvider);
  if (!provider && window.trustwallet?.request) provider = window.trustwallet;
  if (provider) return connectWithProvider(provider, 'Trust Wallet');
  if (typeof window.toast === 'function') window.toast('Scan QR with Trust Wallet app', 'info');
  return connectWC();
}

/* ----- 3. Binance Web3 Wallet ----- */
async function connectBinanceWeb3() {
  let provider = rdnsProvider('com.binance.wallet');
  if (!provider) provider = findLegacy(isBinanceProvider);
  if (!provider && window.BinanceChain?.request) provider = window.BinanceChain;
  if (provider) return connectWithProvider(provider, 'Binance Web3 Wallet');
  if (typeof window.toast === 'function') window.toast('Install Binance Web3 Wallet or scan QR', 'info');
  return connectWC();
}

/* ----- 4. OKX Wallet ----- */
async function connectOkx() {
  let provider = rdnsProvider('com.okex.wallet', 'com.okx.wallet');
  if (!provider) provider = window.okxwallet;
  if (!provider) {
    window.open('https://www.okx.com/web3', '_blank');
    throw new Error('OKX Wallet not installed');
  }
  return connectWithProvider(provider, 'OKX Wallet');
}

/* ----- 5. Coinbase Wallet (инъекция или SDK fallback) ----- */
async function connectCoinbase() {
  let cb = rdnsProvider('com.coinbase.wallet');
  if (!cb) cb = window.coinbaseWalletExtension || findLegacy(isCoinbaseProvider);
  if (cb) {
    return connectWithProvider(cb, 'Coinbase Wallet');
  }
  // Fallback — Coinbase Wallet SDK (QR / universal link)
  const { CoinbaseWalletSDK } = await import('https://esm.sh/@coinbase/wallet-sdk@4.0.0');
  const sdk = new CoinbaseWalletSDK({ appName: 'GROM Exchange', appLogoUrl: METADATA.icons[0] });
  const provider = sdk.makeWeb3Provider({ options: 'all' });
  const accounts = await provider.request({ method: 'eth_requestAccounts' });
  provider.on?.('accountsChanged', (accs) => updateChip(accs[0] || null));
  await authenticateWithSIWE(accounts[0], provider);
  return accounts[0];
}

/* ----- 4. WalletConnect (универсальный QR для любого мобильного кошелька) ----- */
async function ensureWC() {
  if (wcProvider) return wcProvider;
  if (!WC_PROJECT_ID || WC_PROJECT_ID === 'YOUR_WC_PROJECT_ID_HERE') {
    throw new Error('Set WC_PROJECT_ID в grom-wallet.js');
  }
  wcProvider = await EthereumProvider.init({
    projectId: WC_PROJECT_ID,
    chains: CHAINS.required,
    optionalChains: CHAINS.optional,
    showQrModal: true,
    metadata: METADATA,
    qrModalOptions: {
      themeMode: 'dark',
      themeVariables: {
        '--wcm-z-index': '2000',
        '--wcm-accent-color': '#00c2ff',
        '--wcm-background-color': '#0b1220'
      }
    }
  });
  wcProvider.on('accountsChanged', (accs) => updateChip(accs[0] || null));
  wcProvider.on('chainChanged', (hex) => { currentChainId = parseInt(hex, 16); });
  wcProvider.on('disconnect', () => updateChip(null));
  // Восстанавливаем сессию если есть
  if (wcProvider.accounts?.length) updateChip(wcProvider.accounts[0]);
  return wcProvider;
}

async function connectWC() {
  const p = await ensureWC();
  await p.connect();
  const accs = await p.request({ method: 'eth_accounts' });
  if (!accs?.length) throw new Error('No accounts returned');
  // Sign in with backend so /api/wallet/* returns 200 instead of 401 and the
  // balance + deposit address actually load. Required for Trust Wallet, Binance
  // Web3 Wallet, MetaMask Mobile, and every other WalletConnect-compatible app.
  await authenticateWithSIWE(accs[0], p);
  return accs[0];
}

/* ----- disconnect ----- */
async function disconnect() {
  try { await wcProvider?.disconnect?.(); } catch (_) {}
  updateChip(null);
}

/* ----- SIWE — подпись для backend-аутентификации ----- */
async function signSiwe(address) {
  const domain = location.host;
  const nonce = crypto.randomUUID().replace(/-/g, '');
  const issuedAt = new Date().toISOString();
  const msg =
`${domain} wants you to sign in with your Ethereum account:
${address}

Sign in to GROM. You're proving ownership of this wallet — no gas required.

URI: ${location.origin}
Version: 1
Chain ID: ${currentChainId || 42161}
Nonce: ${nonce}
Issued At: ${issuedAt}`;

  let provider = window.ethereum;
  if (wcProvider?.accounts?.length) provider = wcProvider;
  const signature = await provider.request({
    method: 'personal_sign',
    params: [msg, address]
  });
  return { message: msg, signature, nonce };
}

/* ----- On-chain balances (ETH + ERC-20 USDT/USDC) ----- */
const ONCHAIN_RPC = {
  1: 'https://ethereum.publicnode.com',
  42161: 'https://arb1.arbitrum.io/rpc',
  137: 'https://polygon-bor-rpc.publicnode.com',
  8453: 'https://mainnet.base.org',
  56: 'https://bsc-dataseed.binance.org',
};
const ONCHAIN_TOKENS = {
  1: {
    USDT: '0xdac17f958d2ee523a2206206994597c13d831ec7',
    USDC: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  },
  42161: {
    USDT: '0xfd086bc7cd5c481dcc9c85eb478a1c0b6c685e32',
    USDC: '0xaf88d065e77c8cC2239327C0EDb1A48022fCcC7',
  },
  137: {
    USDT: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    USDC: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
  },
  8453: {
    USDC: '0x833589fCD6eDb6E08f4c7C32D6f7b9bD686120e',
  },
  56: {
    USDT: '0x55d398326f99059fF775485246999027B3197955',
    USDC: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
  },
};
const TOKEN_DECIMALS = { USDT: 6, USDC: 6 };

async function rpcCall(url, method, params) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const json = await res.json().catch(() => ({}));
  if (json.error) throw new Error(json.error.message || 'rpc error');
  return json.result;
}

function padAddressData(address) {
  return '0x70a08231' + address.slice(2).toLowerCase().padStart(64, '0');
}

window.gromFetchOnchainBalances = async function gromFetchOnchainBalances(address, chainId) {
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) return null;
  chainId = Number(chainId || currentChainId || 42161);
  const rpc = ONCHAIN_RPC[chainId];
  if (!rpc) return { chainId, nativeEth: null, tokens: {} };

  const nativeWei = await rpcCall(rpc, 'eth_getBalance', [address, 'latest']);
  const nativeEth = Number(BigInt(nativeWei || '0x0')) / 1e18;
  const tokens = {};
  const tokenMap = ONCHAIN_TOKENS[chainId] || {};
  for (const [sym, contract] of Object.entries(tokenMap)) {
    try {
      const raw = await rpcCall(rpc, 'eth_call', [{ to: contract, data: padAddressData(address) }, 'latest']);
      const dec = TOKEN_DECIMALS[sym] || 6;
      tokens[sym] = Number(BigInt(raw || '0x0')) / (10 ** dec);
    } catch (_) {
      tokens[sym] = 0;
    }
  }
  return { chainId, nativeEth, tokens };
};

/* ----- Wallet connect router (used by index.html cnConnect) ----- */
async function gromWalletConnect(kind, name) {
  try {
    if (kind === 'mm') await connectMetaMask();
    else if (kind === 'trust') await connectTrust();
    else if (kind === 'bnw3') await connectBinanceWeb3();
    else if (kind === 'okx') await connectOkx();
    else if (kind === 'cb') await connectCoinbase();
    else if (kind === 'wc' || kind === 'ghost') await connectWC();
    else await connectWC();
  } catch (e) {
    failToast(e);
  }
}

/* ----- Hook email submit + chip disconnect ----- */
function hook() {
  window.gromWalletConnect = gromWalletConnect;

  window.cnSubmitEmail = async function () {
    const input = document.getElementById('cnEmail');
    const button = input?.closest('.cn-email-box')?.querySelector('button');
    const originalText = button?.textContent;
    try {
      if (button) {
        button.disabled = true;
        button.textContent = 'Connecting…';
      }
      await connectEmail(input?.value);
    } catch (e) {
      failToast(e);
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = originalText || 'Continue';
      }
    }
  };

  // Disconnect при повторном клике на чип
  window.disconnectWallet = disconnect;

  // Подписка на сетевые ивенты window.ethereum (если юзер подключал ранее)
  if (window.ethereum && window.ethereum.selectedAddress) {
    updateChip(window.ethereum.selectedAddress);
  }

  // Auto-reconnect WalletConnect если была сессия
  ensureWC().catch(() => {});

  console.log('[grom-wallet] ready · project:', WC_PROJECT_ID.slice(0, 8) + '…');
}

/* -------------------------------------------------------------------------
 * Referral slice hydration.
 * Backend (/api/referral/summary) returns:
 *   { code, link, totals: {total_settled, total_pending, total_accrued},
 *     payout: {payout_wallet, payout_chain, schedule, min_payout, asset},
 *     funnel: {clicks_30d, signups_30d, kyc_30d, first_trade_30d} }
 * We patch DOM IDs Cursor added on index.html:
 *   #refCode, #refLink — invite identity (always patched)
 *   #refKpiTotalReferred / #refKpiActive30d / #refKpiTotalEarned / #refKpiPendingPayout
 *   #refKpiActivationRate (derived = first_trade/signups)
 *   #refFunnelClicks / #refFunnelSignups / #refFunnelKyc / #refFunnelFirstTrade
 *   #refFunnelSignupsCvr / #refFunnelKycRate / #refFunnelFirstTradeRate (derived)
 *   #refPayoutAsset / #refDestWallet / #refPayoutSchedule
 *   *Delta fields (refKpiTotalEarnedDelta etc.) — backend doesn't track yet,
 *   left untouched until /summary returns week-over-week deltas.
 * Numbers are formatted with thousand separators; balances use 2 decimals
 * and a leading "$"; rates use one decimal and "%".
 * -----------------------------------------------------------------------*/
function fmtInt(n) {
  const v = Number(n);
  return Number.isFinite(v) ? v.toLocaleString('en-US') : '—';
}
function fmtUsd(n) {
  const v = Number(n);
  return Number.isFinite(v)
    ? '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '—';
}
function fmtPct(num, den, suffix) {
  const n = Number(num), d = Number(den);
  if (!Number.isFinite(n) || !Number.isFinite(d) || d === 0) return '—';
  return (n / d * 100).toFixed(1) + '% ' + (suffix || '').trim();
}
function fmtWallet(w) {
  if (!w) return '—';
  return w.length > 12 ? w.slice(0, 6) + '…' + w.slice(-4) : w;
}
function fmtSchedule(s) {
  if (s === 'daily')  return 'Daily at 00:00 UTC';
  if (s === 'weekly') return 'Weekly · Mon 00:00 UTC';
  if (s === 'manual') return 'Manual claim only';
  return s || '—';
}
function setText(id, text) {
  const el = document.getElementById(id);
  if (el && text != null) el.textContent = text;
}

async function hydrateReferralSlice(force) {
  try {
    const codeEl = document.getElementById('refCode');
    const linkEl = document.getElementById('refLink');
    if (!codeEl && !linkEl) return; // not on referral page
    const jwt = localStorage.getItem('grom_jwt');
    if (!jwt) return; // require auth — backend won't answer otherwise
    const r = await fetch('/api/referral/summary', {
      headers: { Authorization: `Bearer ${jwt}` },
      cache: force ? 'no-store' : 'default',
    });
    if (!r.ok) return;
    const data = await r.json();

    // Identity
    if (codeEl && data.code) codeEl.textContent = data.code;
    if (linkEl && data.link) linkEl.textContent = data.link;

    const t = data.totals || {};
    const f = data.funnel || {};
    const p = data.payout || {};

    // KPI cards — totals + funnel-derived counts
    setText('refKpiTotalReferred', fmtInt(f.signups_30d));
    setText('refKpiActive30d',     fmtInt(f.first_trade_30d));
    setText('refKpiActivationRate', fmtPct(f.first_trade_30d, f.signups_30d, 'activation'));
    setText('refKpiTotalEarned',   fmtUsd(t.total_accrued));
    setText('refKpiPendingPayout', fmtUsd(t.total_pending));

    // Funnel
    setText('refFunnelClicks',          fmtInt(f.clicks_30d));
    setText('refFunnelSignups',         fmtInt(f.signups_30d));
    setText('refFunnelSignupsCvr',      fmtPct(f.signups_30d, f.clicks_30d, 'CVR'));
    setText('refFunnelKyc',             fmtInt(f.kyc_30d));
    setText('refFunnelKycRate',         fmtPct(f.kyc_30d, f.signups_30d, ''));
    setText('refFunnelFirstTrade',      fmtInt(f.first_trade_30d));
    setText('refFunnelFirstTradeRate',  fmtPct(f.first_trade_30d, f.signups_30d, ''));

    // Payout settings
    setText('refPayoutAsset',    p.asset || 'USDT');
    setText('refDestWallet',     fmtWallet(p.payout_wallet));
    setText('refPayoutSchedule', fmtSchedule(p.schedule));

    // *Delta fields (week-over-week) — backend doesn't return them yet.
    // Leave the existing static "this week" / "+12.4%" text in place.
  } catch (e) {
    console.warn('[grom-referral] hydrate failed:', e);
  }
}
window.hydrateReferralSlice = hydrateReferralSlice;

// Fire on page load + every time wallet slice hydrates (login/logout/connect)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => hydrateReferralSlice(false));
} else {
  hydrateReferralSlice(false);
}

/* =====================================================================
 * WALLET MODAL OPERATIONS (Web3-native deposit / send / swap / fiat).
 *
 * Hooks the existing modal markup in index.html (DOM IDs from Cursor):
 *   #walletModal · #wmDepAsset · #wmDepNetGrid · #wmDepAddr · #wmDepMin
 *   #wmDepConf · #wmDepMemoRow · #wmDepMemo · #wmSendAsset · #wmSendTo
 *   #wmSendAmt · #wmSwapFrom · #wmSwapTo · #wmSwapAmt · #wmSwapEst
 *   #fiatProviders · #fiatAmt · #fiatCur · #fiatRecv · #fiatCoin · #fiatNote
 *
 * Overrides these globals declared inline in index.html:
 *   submitSend · submitSwap · openFiatProvider · copyDepAddr
 *   confirmDepositIntent
 *
 * No HTML edits — Cursor's territory is untouched.
 * ==================================================================== */

/* Networks registry — pruned subset of Binance Spot supported chains.
 * Each entry: {key, label, evmChainId?, kind, minDep, conf, memo?, hex?}
 *   kind: 'evm' | 'solana' | 'tron' | 'bitcoin' | 'ton' | 'cosmos' | 'other'
 *   memo: true if this chain requires destination tag/memo (Ton/XRP/EOS/etc) */
const GROM_NETWORKS = {
  ETH:      { label: 'Ethereum (ERC-20)',    evmChainId: 1,     hex: '0x1',     kind: 'evm',     minDep: 0.001, conf: 12 },
  ARBITRUM: { label: 'Arbitrum One',         evmChainId: 42161, hex: '0xa4b1',  kind: 'evm',     minDep: 0.001, conf: 12 },
  OPTIMISM: { label: 'Optimism',             evmChainId: 10,    hex: '0xa',     kind: 'evm',     minDep: 0.001, conf: 12 },
  POLYGON:  { label: 'Polygon (PoS)',        evmChainId: 137,   hex: '0x89',    kind: 'evm',     minDep: 1,     conf: 128 },
  BASE:     { label: 'Base',                 evmChainId: 8453,  hex: '0x2105',  kind: 'evm',     minDep: 0.001, conf: 12 },
  BSC:      { label: 'BNB Chain (BEP-20)',   evmChainId: 56,    hex: '0x38',    kind: 'evm',     minDep: 0.1,   conf: 15 },
  AVAXC:    { label: 'Avalanche C-Chain',    evmChainId: 43114, hex: '0xa86a',  kind: 'evm',     minDep: 0.1,   conf: 12 },
  LINEA:    { label: 'Linea',                evmChainId: 59144, hex: '0xe708',  kind: 'evm',     minDep: 0.001, conf: 12 },
  SCROLL:   { label: 'Scroll',               evmChainId: 534352,hex: '0x82750', kind: 'evm',     minDep: 0.001, conf: 12 },
  ZKSYNC:   { label: 'zkSync Era',           evmChainId: 324,   hex: '0x144',   kind: 'evm',     minDep: 0.001, conf: 12 },
  MANTLE:   { label: 'Mantle',               evmChainId: 5000,  hex: '0x1388',  kind: 'evm',     minDep: 0.001, conf: 12 },
  FANTOM:   { label: 'Fantom',               evmChainId: 250,   hex: '0xfa',    kind: 'evm',     minDep: 1,     conf: 12 },
  CELO:     { label: 'Celo',                 evmChainId: 42220, hex: '0xa4ec',  kind: 'evm',     minDep: 0.1,   conf: 12 },
  KAVA:     { label: 'Kava',                 evmChainId: 2222,  hex: '0x8ae',   kind: 'evm',     minDep: 0.1,   conf: 12 },
  SOL:      { label: 'Solana',               kind: 'solana',                                     minDep: 0.01,  conf: 1 },
  TRX:      { label: 'Tron (TRC-20)',        kind: 'tron',                                       minDep: 1,     conf: 20 },
  BTC:      { label: 'Bitcoin',              kind: 'bitcoin',                                    minDep: 0.0001,conf: 1 },
  LTC:      { label: 'Litecoin',             kind: 'other',                                      minDep: 0.001, conf: 6 },
  BCH:      { label: 'Bitcoin Cash',         kind: 'other',                                      minDep: 0.001, conf: 6 },
  DOGE:     { label: 'Dogecoin',             kind: 'other',                                      minDep: 5,     conf: 20 },
  TON:      { label: 'The Open Network',     kind: 'ton',                                        minDep: 0.1,   conf: 1,  memo: true },
  XRP:      { label: 'XRP Ledger',           kind: 'other',                                      minDep: 10,    conf: 1,  memo: true },
  XLM:      { label: 'Stellar',              kind: 'other',                                      minDep: 1,     conf: 1,  memo: true },
  EOS:      { label: 'EOS',                  kind: 'other',                                      minDep: 0.1,   conf: 1,  memo: true },
  ATOM:     { label: 'Cosmos Hub',           kind: 'cosmos',                                     minDep: 0.1,   conf: 1,  memo: true },
  ALGO:     { label: 'Algorand',             kind: 'other',                                      minDep: 1,     conf: 1 },
  NEAR:     { label: 'NEAR Protocol',        kind: 'other',                                      minDep: 0.1,   conf: 1 },
  APT:      { label: 'Aptos',                kind: 'other',                                      minDep: 0.1,   conf: 1 },
  SUI:      { label: 'Sui',                  kind: 'other',                                      minDep: 0.1,   conf: 1 },
  DOT:      { label: 'Polkadot',             kind: 'other',                                      minDep: 1,     conf: 1 },
  ADA:      { label: 'Cardano',              kind: 'other',                                      minDep: 1,     conf: 1 },
};

/* Asset → list of supported network keys. Pruned to what makes sense per-asset. */
const GROM_ASSET_NETS = {
  USDT: ['ETH','ARBITRUM','OPTIMISM','POLYGON','BASE','BSC','AVAXC','LINEA','SOL','TRX','TON'],
  USDC: ['ETH','ARBITRUM','OPTIMISM','POLYGON','BASE','BSC','AVAXC','SOL','NEAR','ALGO','XLM'],
  BTC:  ['BTC','ETH','BSC','ARBITRUM'],
  ETH:  ['ETH','ARBITRUM','OPTIMISM','BASE','LINEA','SCROLL','ZKSYNC','BSC'],
  SOL:  ['SOL','BSC','ETH'],
  BNB:  ['BSC','ETH'],
  TRX:  ['TRX'],
  MATIC:['POLYGON','ETH','BSC'],
  ARB:  ['ARBITRUM','ETH'],
  AVAX: ['AVAXC','BSC'],
  TON:  ['TON','BSC'],
  XRP:  ['XRP','BSC'],
  ATOM: ['ATOM','BSC'],
  DOT:  ['DOT','BSC'],
  ADA:  ['ADA','BSC'],
  DOGE: ['DOGE','BSC','ETH'],
  LTC:  ['LTC','BSC','ETH'],
};

/* Native token addresses on each EVM chain (for native send vs ERC-20).
 * ERC-20 contract addresses for USDT/USDC by chain.
 * For Send: ETH/BNB/MATIC/AVAX etc are native; USDT/USDC are ERC-20 calls. */
const GROM_ERC20 = {
  ETH:      { USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7', USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
  ARBITRUM: { USDT: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', USDC: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' },
  OPTIMISM: { USDT: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58', USDC: '0x0b2c639c533813f4aa9d7837caf62653d097ff85' },
  POLYGON:  { USDT: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', USDC: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359' },
  BASE:     { USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' },
  BSC:      { USDT: '0x55d398326f99059fF775485246999027B3197955', USDC: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d' },
  AVAXC:    { USDT: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7', USDC: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E' },
};

/* Fiat on-ramp deeplinks. Public widget URLs — no B2B contract required.
 * Each builder takes {amount, fiat, asset, address} and returns a URL. */
const GROM_FIAT_PROVIDERS = {
  moonpay: {
    label: 'MoonPay',
    url: (q) => `https://buy.moonpay.com/?defaultCurrencyCode=${encodeURIComponent(q.asset.toLowerCase())}&baseCurrencyCode=${encodeURIComponent(q.fiat.toLowerCase())}&baseCurrencyAmount=${q.amount}&walletAddress=${encodeURIComponent(q.address)}`,
  },
  // Transak blocks RU/CIS IPs via Cloudflare ("Sorry, you have been blocked").
  // Disabled until we either obtain a partner key or proxy through our own backend.
  // Ramp Network public widget rejects requests without an API key — disabling
  // until we either obtain a B2B partner key or build a proxy. Was showing
  // "Integration issue detected" to users.
  binanceP2P: {
    label: 'Binance P2P',
    url: (q) => `https://p2p.binance.com/${q.fiat === 'RUB' ? 'ru/' : 'en/'}trade/all-payments/${encodeURIComponent(q.asset)}?fiat=${encodeURIComponent(q.fiat)}`,
  },
  bybitP2P: {
    label: 'Bybit P2P',
    url: (q) => `https://www.bybit.com/fiat/trade/otc/?actionType=1&token=${encodeURIComponent(q.asset)}&fiat=${encodeURIComponent(q.fiat)}`,
  },
};

/* Helpers ----------------------------------------------------------------- */
function gwToast(msg, type) {
  if (typeof window.toast === 'function') return window.toast(msg, type || 'info');
  console.log('[grom-toast]', type || 'info', msg);
}
function gwUserAddress() {
  try { return (currentAccount || localStorage.getItem('grom_wallet_label') || '').toString(); }
  catch (_) { return ''; }
}
function gwFmtAmount(n, dp) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '0';
  return v.toFixed(dp ?? 6).replace(/\.?0+$/, '');
}

/* === DEPOSIT pane: replace demo address + render real networks ============ */
function gwRenderNetGrid(asset) {
  const grid = document.getElementById('wmDepNetGrid');
  if (!grid) return null;
  const allowed = GROM_ASSET_NETS[asset] || GROM_ASSET_NETS.USDT;
  grid.innerHTML = '';
  let firstKey = null;
  for (const key of allowed) {
    const net = GROM_NETWORKS[key];
    if (!net) continue;
    if (!firstKey) firstKey = key;
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'net-chip';
    chip.dataset.net = key;
    chip.textContent = net.label;
    chip.style.cssText = 'padding:6px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:var(--silver2);font-size:12px;cursor:pointer;margin:3px';
    chip.onclick = () => gwSelectNetwork(asset, key);
    grid.appendChild(chip);
  }
  return firstKey;
}
async function gwSelectNetwork(asset, netKey) {
  const net = GROM_NETWORKS[netKey];
  if (!net) return;
  document.querySelectorAll('#wmDepNetGrid .net-chip').forEach(el => {
    const sel = el.dataset.net === netKey;
    el.style.borderColor = sel ? 'var(--cyan)' : 'rgba(255,255,255,0.1)';
    el.style.background = sel ? 'rgba(58,194,255,0.12)' : 'rgba(255,255,255,0.04)';
    el.style.color = sel ? 'var(--cyan)' : 'var(--silver2)';
  });
  // Update min + confirmations + memo row
  const minEl = document.getElementById('wmDepMin');
  if (minEl) minEl.textContent = `${net.minDep} ${asset}`;
  const confEl = document.getElementById('wmDepConf');
  if (confEl) confEl.textContent = net.conf;
  const memoRow = document.getElementById('wmDepMemoRow');
  if (memoRow) memoRow.hidden = !net.memo;
  const addrEl = document.getElementById('wmDepAddr');
  const noteEl = document.getElementById('wmDepNote');
  const mode = window.gwCustodyMode || 'wallet';
  // ----- Custodial via Binance -----
  if (mode === 'grom') {
    if (addrEl) addrEl.textContent = 'Provisioning Binance deposit address…';
    const remote = await gwFetchCustodialAddress(asset, netKey);
    if (addrEl) addrEl.textContent = remote || '— Custodial deposits unavailable —';
    if (noteEl) {
      if (remote) {
        noteEl.textContent = `Send only on ${net.label}. Funds credit to your GROM custodial balance after ${net.conf} confirmations.`;
        noteEl.style.color = '';
      } else {
        noteEl.textContent = '⚠ GROM custodial deposits require Binance hot-wallet integration (in private beta). Switch to "Receive in my wallet".';
        noteEl.style.color = 'var(--warn, #f5b94d)';
      }
    }
    return;
  }
  // ----- Non-custodial: connected wallet address -----
  if (addrEl) addrEl.textContent = gwDepositAddress(netKey);
  if (noteEl) {
    const addr = gwUserAddress();
    if (!addr) {
      noteEl.textContent = '⚠ Connect a wallet first — without it you have no address to receive funds.';
      noteEl.style.color = 'var(--warn, #f5b94d)';
    } else if (net.kind === 'evm') {
      noteEl.textContent = `Send only on ${net.label}. Funds land in your connected wallet — GROM auto-detects the balance.`;
      noteEl.style.color = '';
    } else if (net.kind === 'solana') {
      noteEl.textContent = 'Connect a Solana wallet (Phantom) to receive SOL.';
      noteEl.style.color = 'var(--warn, #f5b94d)';
    } else {
      noteEl.textContent = `${net.label} requires a native wallet on this chain.`;
      noteEl.style.color = 'var(--warn, #f5b94d)';
    }
  }
}
function gwDepositAddress(netKey) {
  const net = GROM_NETWORKS[netKey];
  const addr = gwUserAddress();
  if (!net || !addr) return '— Connect a wallet first —';
  if (net.kind === 'evm') return addr; // EVM address is the same on every EVM chain
  if (net.kind === 'solana') {
    // We don't yet integrate Phantom — fallback to EVM with note
    return '— Solana wallet not connected —';
  }
  return `— ${net.label} not supported via connected wallet —`;
}
/* Mount custody toggle once. The toggle picks between:
 *  - 'wallet' (Web3-native): receive on connected wallet (default, no backend)
 *  - 'grom'   (custodial):    receive via Binance deposit address (per-user)
 */
function gwEnsureCustodyToggle() {
  if (document.getElementById('gwCustodyToggle')) return;
  // Mount the toggle at the very top of the deposit pane so it reads as a
  // primary mode switch ("how do you want to receive?"). Cursor's pane is:
  //   <wm-pane data-pane=deposit>
  //     <wm-field>Asset</wm-field>
  //     <wm-field>Network</wm-field>
  //     <wm-qr>…</wm-qr>
  //     <wm-addr>…</wm-addr>
  //   </wm-pane>
  // We prepend our toggle as the first child.
  const pane = document.querySelector('.wm-pane[data-pane="deposit"]');
  if (!pane) return;
  const wrap = document.createElement('div');
  wrap.id = 'gwCustodyToggle';
  wrap.style.cssText = 'display:flex;gap:6px;margin:0 0 12px;padding:4px;background:rgba(255,255,255,0.04);border-radius:10px';
  for (const opt of [
    { v: 'wallet', label: 'Receive in my wallet', hint: 'Non-custodial · you control the keys' },
    { v: 'grom',   label: 'Receive on GROM',     hint: 'Custodial · held on GROM Binance account' },
  ]) {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.cust = opt.v;
    b.title = opt.hint;
    b.textContent = opt.label;
    b.style.cssText = 'flex:1;padding:8px 10px;border-radius:8px;border:0;background:transparent;color:var(--silver2);font-size:12px;cursor:pointer;font-weight:600;line-height:1.2';
    b.onclick = () => gwSetCustody(opt.v);
    wrap.appendChild(b);
  }
  pane.insertBefore(wrap, pane.firstElementChild);
  gwSetCustody('wallet');
}
function gwSetCustody(mode) {
  const wrap = document.getElementById('gwCustodyToggle');
  if (wrap) {
    wrap.querySelectorAll('button').forEach(b => {
      const on = b.dataset.cust === mode;
      b.style.background = on ? 'rgba(58,194,255,0.18)' : 'transparent';
      b.style.color = on ? 'var(--cyan)' : 'var(--silver2)';
    });
  }
  window.gwCustodyMode = mode;
  // Re-render the address for the currently selected net
  const sel = document.getElementById('wmDepAsset');
  const asset = sel?.value || 'USDT';
  const selChip = document.querySelector('#wmDepNetGrid .net-chip[style*="cyan"]');
  const netKey = selChip?.dataset.net || (GROM_ASSET_NETS[asset] || ['ETH'])[0];
  if (netKey) gwSelectNetwork(asset, netKey);
}
/* When custody === 'grom', fetch the per-user Binance deposit address from
 * backend. Non-custodial path resolves synchronously (it's just the connected
 * wallet). Custodial path may show "Provisioning…" while the backend signs the
 * request to Binance. */
async function gwFetchCustodialAddress(asset, network) {
  const jwt = localStorage.getItem('grom_jwt');
  if (!jwt) return null;
  // Backend network code uses ERC20/BEP20/TRC20/POLYGON/etc; map our keys.
  const map = { ETH:'ERC20', BSC:'BEP20', TRX:'TRC20', POLYGON:'MATIC', ARBITRUM:'ARBITRUM', OPTIMISM:'OPTIMISM', BASE:'BASE', AVAXC:'AVAXC', SOL:'SOL', BTC:'BTC', TON:'TON' };
  const net = map[network] || network;
  try {
    const r = await fetch(`/api/wallet/deposit-address?asset=${encodeURIComponent(asset)}&network=${encodeURIComponent(net)}`, {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    if (!r.ok) return null;
    const j = await r.json();
    return j.depositAddress?.address || j.depositAddress || j.address || null;
  } catch (_) { return null; }
}
async function gwHydrateDepositPane() {
  const sel = document.getElementById('wmDepAsset');
  if (!sel) return;
  gwEnsureCustodyToggle();
  // Ensure the dropdown carries every asset we know about
  const wanted = Object.keys(GROM_ASSET_NETS);
  const present = Array.from(sel.options).map(o => o.value);
  for (const a of wanted) {
    if (!present.includes(a)) {
      const opt = document.createElement('option');
      opt.value = a; opt.textContent = a;
      sel.appendChild(opt);
    }
  }
  // On asset change → re-render networks
  if (!sel.dataset.gwBound) {
    sel.dataset.gwBound = '1';
    sel.addEventListener('change', () => {
      const first = gwRenderNetGrid(sel.value);
      if (first) gwSelectNetwork(sel.value, first);
    });
  }
  const first = gwRenderNetGrid(sel.value);
  if (first) gwSelectNetwork(sel.value, first);
}

/* === SEND pane: on-chain transfer via window.ethereum ==================== */
async function gwSubmitSend() {
  const asset = (document.getElementById('wmSendAsset')?.value || 'USDT').toUpperCase();
  const to    = (document.getElementById('wmSendTo')?.value || '').trim();
  const amt   = Number(document.getElementById('wmSendAmt')?.value || 0);
  if (!to || amt <= 0) { gwToast('Recipient and amount required', 'warn'); return; }
  if (!window.ethereum) {
    gwPromptSignIn('No EVM wallet detected. Connect MetaMask / Trust / Coinbase to send.');
    return;
  }
  const from = gwUserAddress();
  if (!from) { gwPromptSignIn('Connect a wallet first to sign the transaction.'); return; }
  try {
    const chainHex = await window.ethereum.request({ method: 'eth_chainId' });
    const chainKey = Object.entries(GROM_NETWORKS).find(([k, v]) => v.hex === chainHex)?.[0];
    if (!chainKey) { gwToast(`Unsupported chain ${chainHex}. Switch network in your wallet.`, 'warn'); return; }
    let txParams;
    if (asset === 'ETH' || asset === 'BNB' || asset === 'MATIC' || asset === 'AVAX') {
      // Native transfer — value is amount in wei (18 dp)
      const wei = BigInt(Math.round(amt * 1e9)) * BigInt(1e9); // safe for typical amounts
      txParams = { from, to, value: '0x' + wei.toString(16) };
    } else {
      // ERC-20 transfer(address,uint256)
      const erc20 = (GROM_ERC20[chainKey] || {})[asset];
      if (!erc20) { gwToast(`${asset} not deployed on ${chainKey}`, 'warn'); return; }
      const decimals = (asset === 'USDT' || asset === 'USDC') ? 6 : 18;
      const units = BigInt(Math.round(amt * Math.pow(10, decimals)));
      const sel4 = 'a9059cbb'; // transfer(address,uint256)
      const addr32 = to.toLowerCase().replace(/^0x/, '').padStart(64, '0');
      const amt32 = units.toString(16).padStart(64, '0');
      txParams = { from, to: erc20, data: '0x' + sel4 + addr32 + amt32 };
    }
    gwToast(`Awaiting wallet signature…`, 'info');
    const hash = await window.ethereum.request({ method: 'eth_sendTransaction', params: [txParams] });
    gwToast(`Sent. Hash: ${hash.slice(0, 12)}…`, 'success');
    if (typeof window.closeWalletModal === 'function') window.closeWalletModal();
    // Re-hydrate balance after a beat
    setTimeout(() => { try { window.gromFetchOnchainBalances?.(from, parseInt(chainHex, 16)); } catch (_) {} }, 3000);
  } catch (e) {
    console.warn('[grom-send] failed:', e);
    gwToast(e?.message || 'Send failed', 'error');
  }
}

/* === SWAP pane: Binance Convert via backend =============================== */
/* When a sign-in is required, open the wallet/connect modal instead of just
 * toasting. Cursor's flow shows the actions side-by-side, so the user gets
 * a clear "click here to fix it" affordance. */
function gwPromptSignIn(message) {
  gwToast(message || 'Sign in first to continue', 'warn');
  try {
    if (typeof window.closeWalletModal === 'function') window.closeWalletModal();
    if (typeof window.openConnectModal === 'function') {
      setTimeout(() => window.openConnectModal(), 200);
    }
  } catch (_) {}
}

async function gwSubmitSwap() {
  const from = (document.getElementById('wmSwapFrom')?.value || 'USDT').toUpperCase();
  const to   = (document.getElementById('wmSwapTo')?.value || 'BTC').toUpperCase();
  const amt  = Number(document.getElementById('wmSwapAmt')?.value || 0);
  if (amt <= 0) { gwToast('Enter amount', 'warn'); return; }
  if (from === to) { gwToast('Choose different assets', 'warn'); return; }
  const jwt = localStorage.getItem('grom_jwt');
  if (!jwt) { gwPromptSignIn('Swap requires sign-in. Choose how to log in:'); return; }
  try {
    gwToast('Fetching quote…', 'info');
    const q = await fetch('/api/swap/convert/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
      body: JSON.stringify({ from, to, fromAmount: amt }),
    }).then(r => r.json());
    if (q.error) { gwToast(`Quote failed: ${q.error}`, 'error'); return; }
    // Confirm + accept
    const confirmed = confirm(`Swap ${amt} ${from} → ${q.toAmount} ${to} (rate ${q.ratio})? Quote valid ${q.validSec || 8}s.`);
    if (!confirmed) return;
    const a = await fetch('/api/swap/convert/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
      body: JSON.stringify({ quoteId: q.quoteId }),
    }).then(r => r.json());
    if (a.error) { gwToast(`Accept failed: ${a.error}`, 'error'); return; }
    gwToast(`Swap done: ${a.orderId || 'ok'}`, 'success');
    if (typeof window.closeWalletModal === 'function') window.closeWalletModal();
    if (typeof window.hydrateWalletSlice === 'function') window.hydrateWalletSlice(true);
  } catch (e) {
    console.warn('[grom-swap] failed:', e);
    gwToast(e?.message || 'Swap failed', 'error');
  }
}

/* === CASH pane: deeplink to fiat on-ramp partners ========================= */
function gwOpenFiatProvider() {
  const provBtn = document.querySelector('#fiatProviders .prov.active');
  const provKey = provBtn?.dataset.prov || 'moonpay';
  const prov = GROM_FIAT_PROVIDERS[provKey];
  if (!prov) { gwToast(`Unknown provider ${provKey}`, 'warn'); return; }
  const amount = Number(document.getElementById('fiatAmt')?.value || 100);
  const fiat   = (document.getElementById('fiatCur')?.value || 'USD').toUpperCase();
  const asset  = (document.getElementById('fiatCoin')?.value || 'USDT').toUpperCase();
  const address = gwUserAddress();
  if (!address) { gwToast('Connect a wallet first — crypto needs an address to land in', 'warn'); return; }
  const url = prov.url({ amount, fiat, asset, address });
  window.open(url, '_blank', 'noopener,noreferrer');
}

/* === Override existing modal globals + hook open events =================== */
function gwCopyDepAddr() {
  const addr = document.getElementById('wmDepAddr')?.textContent?.trim() || '';
  if (!addr || addr.startsWith('—')) { gwToast('No address to copy', 'warn'); return; }
  navigator.clipboard?.writeText(addr).then(
    () => gwToast('Address copied', 'success'),
    () => gwToast('Copy failed', 'error')
  );
}
function gwConfirmDepositIntent() {
  if (typeof window.closeWalletModal === 'function') window.closeWalletModal();
}
/* Expand Cash with more providers if not yet present. */
function gwHydrateFiatProviders() {
  const wrap = document.getElementById('fiatProviders');
  if (!wrap || wrap.dataset.gwExpanded) return;
  wrap.dataset.gwExpanded = '1';
  // Hide Cursor's "Ramp" + "Transak" buttons:
  //   - Ramp public widget rejects requests without an API key (shows
  //     "Integration issue detected")
  //   - Transak blocks RU/CIS IPs via Cloudflare ("Sorry, you have been blocked")
  // Re-enable when we either get partner keys or proxy through our backend.
  wrap.querySelectorAll('.prov[data-prov="ramp"], .prov[data-prov="transak"]').forEach(el => el.remove());
  const present = new Set(Array.from(wrap.querySelectorAll('.prov')).map(b => b.dataset.prov));
  const extra = [
    { key: 'binanceP2P', label: 'Binance P2P' },
    { key: 'bybitP2P', label: 'Bybit P2P' },
  ];
  for (const x of extra) {
    if (present.has(x.key)) continue;
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'prov'; b.dataset.prov = x.key; b.textContent = x.label;
    b.onclick = () => {
      wrap.querySelectorAll('.prov').forEach(el => el.classList.remove('active'));
      b.classList.add('active');
    };
    wrap.appendChild(b);
  }
}
/* Inject a CSS rule that makes the wallet modal scrollable when its body
 * outgrows the viewport. The walletops module added a custody toggle + 11+
 * network chips (vs Cursor's 7), and on shorter screens the head/foot get
 * clipped. We tighten chip sizing, cap modal height to 90vh, and let the body
 * scroll. All overrides are scoped to the modal so the rest of the UI is
 * untouched. */
function gwInjectModalCss() {
  if (document.getElementById('gw-modal-fixups')) return;
  // Minimal CSS: the whole modal scrolls when content overflows. NO sticky —
  // sticky head + sticky tabs caused overlapping headlines on the Cash pane.
  // Just cap the modal height + let body scroll + tighten chip sizing.
  const css = `
    .wm-overlay .wm { max-height: 90vh; overflow-y: auto; overflow-x: hidden; -webkit-overflow-scrolling: touch; }
    .wm-overlay .net-grid { gap: 6px; }
    .wm-overlay .net-grid .net-chip { padding: 6px 10px; font-size: 12px; min-height: 32px; line-height: 1.2; }
    .wm-overlay .wm-qr { margin: 8px auto; }
    .wm-overlay .wm-qr svg { width: 96px; height: 96px; }
    .wm-overlay .wm-addr { font-size: 11px; word-break: break-all; }
    @media (max-height: 720px) {
      .wm-overlay .wm { max-height: 95vh; }
      .wm-overlay .wm-qr svg { width: 80px; height: 80px; }
    }
  `;
  const style = document.createElement('style');
  style.id = 'gw-modal-fixups';
  style.textContent = css;
  document.head.appendChild(style);
}

/* Cursor (commit d19f86c) replaced the flat deposit pane with a 5-screen
 * Binance-style flow (#depCoinSearch / #depCoinList / #depNetworkList /
 * #depCustody / #depAddrText / #depAddrQr / #depMemoCard / #depRecentList).
 * His JS owns the screen navigation + initial render, and calls our backend
 * /api/wallet/deposit-address inside gromDepLoadAddress(). What he doesn't
 * handle: when custody === 'self' (Receive in my wallet), the address shown
 * must be the user's CONNECTED wallet, not the backend (which would only
 * return a Binance custodial address when BINANCE_HOT_WALLET=true).
 *
 * We patch gromDepLoadAddress in-place: for self-custody, render the user's
 * EVM address directly. For grom-custody, delegate to Cursor's original
 * implementation so the existing 503 / "provisioning" UX kicks in. */
function gwPatchCursorDepositFlow() {
  if (!document.getElementById('depCoinList')) return false; // new UI not present
  const origLoadAddress = window.gromDepLoadAddress;
  if (!origLoadAddress || origLoadAddress.__gwPatched) return true;
  window.gromDepLoadAddress = async function gromDepLoadAddressPatched(...args) {
    try {
      const custody = window.gromDepState?.custody;
      if (custody === 'self') {
        const addr = (typeof currentAccount === 'string' && currentAccount)
          || localStorage.getItem('grom_wallet_label')
          || '';
        const addrEl = document.getElementById('depAddrText');
        const qrEl   = document.getElementById('depAddrQr');
        const memoCard = document.getElementById('depMemoCard');
        if (memoCard) memoCard.hidden = true;
        if (!addr) {
          if (addrEl) {
            addrEl.innerHTML = '<button type="button" style="all:unset;cursor:pointer;color:var(--cyan);text-decoration:underline">Connect a wallet</button> to receive funds.';
            const btn = addrEl.querySelector('button');
            if (btn) btn.onclick = () => {
              if (typeof window.closeWalletModal === 'function') window.closeWalletModal();
              setTimeout(() => { try { window.openConnectModal?.(); } catch (_) {} }, 200);
            };
          }
          if (qrEl) { qrEl.classList.add('pending'); qrEl.innerHTML = 'Wallet not connected'; }
          window.gromDepState.address = '';
          return;
        }
        if (addrEl) addrEl.textContent = addr;
        if (qrEl) {
          qrEl.classList.remove('pending');
          const src = `https://api.qrserver.com/v1/create-qr-code/?size=360x360&margin=0&data=${encodeURIComponent(addr)}`;
          qrEl.innerHTML = `<img src="${src}" alt="Deposit address QR" decoding="async"/>`;
        }
        window.gromDepState.address = addr;
        window.gromDepState.memo = '';
        return;
      }
    } catch (e) {
      console.warn('[grom-deposit] self-custody patch failed, falling back:', e);
    }
    return origLoadAddress.apply(this, args);
  };
  window.gromDepLoadAddress.__gwPatched = true;
  console.log('[grom-walletops] patched gromDepLoadAddress for self-custody');
  return true;
}

/* Expand Send + Swap asset dropdowns from Cursor's hardcoded 4
 * (USDT/BTC/ETH/SOL) to the 11 supported assets. Idempotent — only adds
 * options that aren't already present. Called on init + on every modal
 * open via re-hydrate. */
const GW_SUPPORTED_ASSETS = ['USDT','USDC','BTC','ETH','SOL','BNB','TRX','MATIC','AVAX','TON','XRP'];
function gwExpandAssetSelect(id) {
  const sel = document.getElementById(id);
  if (!sel) return;
  const present = new Set(Array.from(sel.options).map(o => o.value));
  for (const a of GW_SUPPORTED_ASSETS) {
    if (present.has(a)) continue;
    const o = document.createElement('option');
    o.value = a; o.textContent = a;
    sel.appendChild(o);
  }
}
function gwExpandSendSwapDropdowns() {
  gwExpandAssetSelect('wmSendAsset');
  gwExpandAssetSelect('wmSwapFrom');
  gwExpandAssetSelect('wmSwapTo');
}

function gwInitWalletModalOps() {
  // Override Cursor's inline modal functions (in index.html). These globals
  // were rendering a hardcoded network list with FAKE demo addresses
  // (`0x7a3f9c2b...`) and falling back to a seed-derived address from the
  // backend (`/api/wallet/deposit-address` in seed-fallback mode) that GROM
  // does NOT hold the private key for. Users who deposit to either lose funds.
  // We replace these with our connected-wallet (Web3-native) implementation.
  // If Cursor's new 5-screen deposit flow is mounted (d19f86c), skip the
  // legacy CSS + chip overrides — his own CSS owns the layout, and his
  // gromDep* functions own the rendering. We only patch his loadAddress for
  // self-custody (see gwPatchCursorDepositFlow).
  const newDepUi = !!document.getElementById('depCoinList');
  if (!newDepUi) gwInjectModalCss();
  gwPatchCursorDepositFlow();
  window.submitSend = gwSubmitSend;
  window.submitSwap = gwSubmitSwap;
  window.openFiatProvider = gwOpenFiatProvider;
  window.copyDepAddr = gwCopyDepAddr;
  window.confirmDepositIntent = gwConfirmDepositIntent;
  // Stub Cursor's renderers so they never overwrite our addresses.
  window.renderDepositNetworks = () => { try { gwHydrateDepositPane(); } catch (e) { console.warn('[grom-deposit]', e); } };
  window.applyDepositNetwork = (asset, n) => {
    const sel = document.getElementById('wmDepAsset');
    const a = asset || sel?.value || 'USDT';
    // Map Cursor's chip ids ('erc20', 'arb', 'poly', etc.) to our registry keys
    const idMap = { erc20:'ETH', arb:'ARBITRUM', poly:'POLYGON', bep20:'BSC', base:'BASE', trc20:'TRX', sol:'SOL', btc:'BTC', ln:'BTC', bep2:'BSC' };
    const key = (n && (idMap[n.id] || n.id)) || (GROM_ASSET_NETS[a] || ['ETH'])[0];
    gwSelectNetwork(a, key);
  };
  // Expose for debugging
  window.gwHydrateDepositPane = gwHydrateDepositPane;
  window.gwSelectNetwork = gwSelectNetwork;

  // Hook modal open — re-hydrate every time it becomes visible. We also
  // re-hydrate ~200ms later to win against any async Cursor render.
  const modal = document.getElementById('walletModal');
  if (!modal) {
    return setTimeout(gwInitWalletModalOps, 500);
  }
  const reHydrate = () => {
    const visible = modal.classList.contains('open') ||
                    getComputedStyle(modal).display !== 'none';
    if (!visible) return;
    // New 5-screen deposit UI owns its rendering — skip legacy hydrate so we
    // don't waste cycles rendering into a hidden chunk of DOM. Still patch
    // gromDepLoadAddress in case Cursor's script ran after init.
    if (document.getElementById('depCoinList')) {
      gwPatchCursorDepositFlow();
    } else {
      try { gwHydrateDepositPane(); } catch (e) { console.warn('[grom-deposit] hydrate:', e); }
      // second pass to defeat any async render from Cursor's inline code
      setTimeout(() => { try { gwHydrateDepositPane(); } catch (_) {} }, 250);
    }
    try { gwHydrateFiatProviders(); } catch (e) { console.warn('[grom-fiat] hydrate:', e); }
    try { gwExpandSendSwapDropdowns(); } catch (e) { console.warn('[grom-assets] expand:', e); }
  };
  const obs = new MutationObserver(reHydrate);
  obs.observe(modal, { attributes: true, attributeFilter: ['style', 'class'] });
  reHydrate();
  console.log('[grom-walletops] modal hooks installed (with Cursor overrides)');
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', gwInitWalletModalOps);
} else {
  gwInitWalletModalOps();
}

/* ----- экспорт для отладки ----- */
window.gromWallet = {
  connectMetaMask, connectTrust, connectBinanceWeb3,
  connectOkx, connectCoinbase, connectWC,
  connectEmail, gromWalletConnect,
  disconnect, signSiwe,
  fetchOnchainBalances: window.gromFetchOnchainBalances,
  state: () => ({ account: currentAccount, chainId: currentChainId }),
  networks: GROM_NETWORKS,
  assetNets: GROM_ASSET_NETS,
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', hook);
} else {
  hook();
}
