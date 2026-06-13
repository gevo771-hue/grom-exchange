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

/* ----- экспорт для отладки ----- */
window.gromWallet = {
  connectMetaMask, connectTrust, connectBinanceWeb3,
  connectOkx, connectCoinbase, connectWC,
  connectEmail, gromWalletConnect,
  disconnect, signSiwe,
  fetchOnchainBalances: window.gromFetchOnchainBalances,
  state: () => ({ account: currentAccount, chainId: currentChainId })
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', hook);
} else {
  hook();
}
