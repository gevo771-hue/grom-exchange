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
  const host = (location.hostname || '').replace(/^www\./i, '').toLowerCase();
  if (host === 'grom.exchange') return 'https://grom.exchange';
  if (location.protocol === 'http:' || location.protocol === 'https:') {
    return location.protocol + '//' + host + (location.port ? ':' + location.port : '');
  }
  return 'https://grom.exchange';
}
function walletMetadata() {
  const origin = walletAppOrigin();
  return {
    name: 'GROM',
    description: 'Trade spot, binary options, and futures on GROM.',
    url: origin,
    icons: [origin + '/icon-512.png?v=20260607g']
  };
}

function isMobileUA() {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
}
function gromPageUrl() {
  return walletAppOrigin() + (location.pathname || '/') + (location.search || '') + (location.hash || '');
}
function openInWalletBrowser(kind) {
  const page = gromPageUrl();
  if (kind === 'trust') {
    window.location.href = 'https://link.trustwallet.com/open_url?coin_id=60&url=' + encodeURIComponent(page);
    return;
  }
  if (kind === 'mm') {
    var hostPath = location.host + (location.pathname || '/') + (location.search || '') + (location.hash || '');
    window.location.href = 'https://metamask.app.link/dapp/' + hostPath;
    return;
  }
  if (kind === 'bnw3') {
    window.location.href = 'https://www.bnbchain.org/en/wallet-download';
  }
}

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
  // Broadcast address-known event so anything that renders on the connected
  // address (e.g. the on-chain balance card on the Wallet page) refreshes
  // immediately — no need to wait for SIWE. If SIWE later completes, the
  // JWT-based custodial section updates through the existing hydrate hooks.
  try {
    if (addr) {
      document.dispatchEvent(new CustomEvent('grom:wallet-connected', { detail: { address: addr } }));
      try { localStorage.setItem('grom_wallet_label', addr); } catch (_) {}
    } else {
      document.dispatchEvent(new CustomEvent('grom:wallet-disconnected'));
      try { localStorage.removeItem('grom_wallet_label'); } catch (_) {}
    }
  } catch (_) {}
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
    body: JSON.stringify({ email: normalized, ...gromReferralPayload() })
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
function gromReferralPayload() {
  try {
    const code = localStorage.getItem('grom_ref');
    return code ? { referralCode: code } : {};
  } catch (_) { return {}; }
}

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
    body: JSON.stringify({ message, signature, ...gromReferralPayload() })
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
  // Let listeners (e.g. gwOnchainCard) re-render immediately without waiting
  // for the storage event, which is only delivered cross-tab.
  try { document.dispatchEvent(new CustomEvent('grom:wallet-connected', { detail: { address } })); } catch (_) {}

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
  try {
    await authenticateWithSIWE(accounts[0], provider);
  } catch (err) {
    gwSiweFailToast(err);
    throw err;
  }
  return accounts[0];
}

/* Show a friendly, actionable toast when SIWE fails. Called by all wallet
 * connectors so a silent signature-reject never leaves the user staring at
 * "Sign in to view balance" with no explanation. */
function gwSiweFailToast(err) {
  const rawMsg = String(err?.message || err || '').toLowerCase();
  const rejected =
    rawMsg.includes('reject') ||
    rawMsg.includes('cancel') ||
    rawMsg.includes('denied') ||
    err?.code === 4001 || err?.code === -32000;
  const msg = rejected
    ? 'Sign the message in your wallet to finish signing in.'
    : 'Sign-in failed: ' + (err?.message || 'signature not verified');
  try { gwToast(msg, rejected ? 'warn' : 'error'); } catch (_) {}
}

/* ----- 1. MetaMask ----- */
async function connectMetaMask() {
  let provider = rdnsProvider('io.metamask', 'io.metamask.mobile');
  if (!provider) provider = findLegacy(isMetaMaskProvider);
  if (provider) return connectWithProvider(provider, 'MetaMask');
  if (isMobileUA()) {
    if (typeof window.toast === 'function') window.toast('Confirm in MetaMask via WalletConnect', 'info');
    return connectWCFor('metamask');
  }
  window.open('https://metamask.io/download/', '_blank');
  throw new Error('MetaMask not installed — opened download page');
}

/* ----- 2. Trust Wallet ----- */
async function connectTrust() {
  let provider = rdnsProvider('com.trustwallet.app');
  if (!provider) provider = findLegacy(isTrustProvider);
  if (!provider && window.trustwallet?.request) provider = window.trustwallet;
  if (provider) return connectWithProvider(provider, 'Trust Wallet');
  if (typeof window.toast === 'function') {
    window.toast(isMobileUA()
      ? 'Confirm the connection in Trust Wallet'
      : 'Trust is mobile-only — scan the QR with your phone', 'info');
  }
  return connectWCFor('trust');
}

/* ----- 3. Binance Web3 Wallet ----- */
async function connectBinanceWeb3() {
  let provider = rdnsProvider('com.binance.wallet');
  if (!provider) provider = findLegacy(isBinanceProvider);
  if (!provider && window.BinanceChain?.request) provider = window.BinanceChain;
  if (provider) return connectWithProvider(provider, 'Binance Web3 Wallet');
  if (typeof window.toast === 'function') {
    window.toast(isMobileUA()
      ? 'Confirm in Binance Web3 Wallet'
      : 'Scan the QR with Binance Web3 Wallet on your phone', 'info');
  }
  return connectWCFor('binance');
}

/* ----- 4. OKX Wallet ----- */
async function connectOkx() {
  let provider = rdnsProvider('com.okex.wallet', 'com.okx.wallet');
  if (!provider) provider = window.okxwallet;
  if (provider) return connectWithProvider(provider, 'OKX Wallet');
  if (typeof window.toast === 'function') {
    window.toast(isMobileUA()
      ? 'Confirm in OKX Wallet'
      : 'Scan QR with OKX Wallet on your phone', 'info');
  }
  return connectWCFor('okx');
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
  const sdk = new CoinbaseWalletSDK({ appName: 'GROM Exchange', appLogoUrl: walletMetadata().icons[0] });
  const provider = sdk.makeWeb3Provider({ options: 'all' });
  const accounts = await provider.request({ method: 'eth_requestAccounts' });
  provider.on?.('accountsChanged', (accs) => updateChip(accs[0] || null));
  try {
    await authenticateWithSIWE(accounts[0], provider);
  } catch (err) {
    gwSiweFailToast(err);
    throw err;
  }
  return accounts[0];
}

/* ----- 4. WalletConnect (универсальный QR для любого мобильного кошелька) ----- */
/* WalletConnect Cloud Explorer IDs for the wallets we surface on our connect
 * modal. Passing one of these as `explorerRecommendedWalletIds` puts THAT
 * wallet at the top of the WC modal's list — instead of the default which
 * always auto-suggests MetaMask when the extension is installed. Fixes user
 * report: "clicking Trust shows MetaMask suggestion, no Trust logo". */
const WC_WALLET_IDS = {
  trust:    '4622a2b2d6af1c9844944291e5e7351a6aa24cd7b23099efac1b2fd875da31a0',
  metamask: 'c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96',
  binance:  '8a0ee50d1f22f6651afcae7eb4253e5289eab6a41b3aa9a9095d31a1c9d5e01',
  okx:      '971e689d0a5be527bac79629b4ee9b925e82208e5168b733496a09c0faed0709',
  coinbase: 'fd20dc426fb37566d803205b19bbc1d4096b248ac04548e3cfb6b3a38bd033aa',
  safepal:  '0b415a746fb9ee99cce155c2ceca0c6f6061b1dbca2d722b3ba16381d0562150',
};
let wcRecommendedForKey = null; // remembers which wallet the current provider was inited for

async function ensureWC(forceNew, opts) {
  const wantRecommend = opts?.recommendedWalletId || null;
  const walletKey = opts?.walletKey || null;
  const needReinit = forceNew || (wantRecommend && walletKey !== wcRecommendedForKey);
  if (wcProvider && !needReinit) return wcProvider;
  if (wcProvider) {
    try { await wcProvider.disconnect(); } catch (_) {}
    wcProvider = null;
  }
  if (!WC_PROJECT_ID || WC_PROJECT_ID === 'YOUR_WC_PROJECT_ID_HERE') {
    throw new Error('Set WC_PROJECT_ID в grom-wallet.js');
  }
  // NOTE (2026-07-05): Earlier commit 28d26b9 tried to exclude every
  // other wallet from the modal via explorerExcludedWalletIds +
  // enableExplorer:false so a Trust-tap wouldn't also show MetaMask.
  // Reown v2 interpreted the flags too aggressively and made Trust
  // itself vanish from the recommended list. Rolled back to just
  // featuring the wallet at top — the "Open in MetaMask" bar the user
  // occasionally sees is a browser-level `wc:` protocol handler
  // suggestion (Chrome, not us), not part of the Reown modal, and
  // cannot be suppressed from JS.
  wcProvider = await EthereumProvider.init({
    projectId: WC_PROJECT_ID,
    chains: CHAINS.required,
    optionalChains: CHAINS.optional,
    showQrModal: true,
    metadata: walletMetadata(),
    qrModalOptions: {
      themeMode: 'dark',
      themeVariables: {
        '--wcm-z-index': '2000',
        '--wcm-accent-color': '#00c2ff',
        '--wcm-background-color': '#0b1220',
      },
      ...(wantRecommend ? {
        explorerRecommendedWalletIds: [wantRecommend],
        featuredWalletIds: [wantRecommend],
      } : {}),
    },
  });
  wcRecommendedForKey = walletKey || null;
  wcProvider.on('accountsChanged', (accs) => updateChip(accs[0] || null));
  wcProvider.on('chainChanged', (hex) => { currentChainId = parseInt(hex, 16); });
  wcProvider.on('disconnect', () => updateChip(null));
  // Восстанавливаем сессию если есть
  if (wcProvider.accounts?.length) updateChip(wcProvider.accounts[0]);
  return wcProvider;
}

/* Prefetch WC provider on page load (background, non-blocking). Kills the
 * 1-2 second handshake delay users see on their first "Connect" click.
 * Waits until the tab has been idle for a moment so it doesn't fight
 * with initial render. */
function gwPrefetchWc() {
  const kick = () => {
    setTimeout(() => {
      try { ensureWC(false).catch(() => {}); } catch (_) {}
    }, 2500);
  };
  if (document.readyState === 'complete') kick();
  else window.addEventListener('load', kick, { once: true });
}

/* Connect via WalletConnect with a specific wallet featured in the modal.
 * Falls through to authenticateWithSIWE just like connectWC. */
async function connectWCFor(walletKey) {
  const id = WC_WALLET_IDS[walletKey];
  const p = await ensureWC(true, { recommendedWalletId: id, walletKey });
  await p.connect();
  const accs = await p.request({ method: 'eth_accounts' });
  if (!accs?.length) throw new Error('No accounts returned');
  updateChip(accs[0]);
  try { await authenticateWithSIWE(accs[0], p); }
  catch (err) { gwSiweFailToast(err); throw err; }
  return accs[0];
}

async function connectWC() {
  const p = await ensureWC(true);
  await p.connect();
  const accs = await p.request({ method: 'eth_accounts' });
  if (!accs?.length) throw new Error('No accounts returned');
  // Sign in with backend so /api/wallet/* returns 200 instead of 401 and the
  // balance + deposit address actually load. Required for Trust Wallet, Binance
  // Web3 Wallet, MetaMask Mobile, and every other WalletConnect-compatible app.
  //
  // If SIWE fails (user rejects the signature prompt in the wallet, or the
  // wallet returns before signing) we surface a visible toast rather than
  // failing silently — otherwise users see "Sign in to view balance" on the
  // wallet page and can't figure out why.
  try {
    await authenticateWithSIWE(accs[0], p);
  } catch (err) {
    gwSiweFailToast(err);
    throw err;
  }
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

    // *Delta fields (week-over-week) — backend doesn't return them yet,
    // so we clear any hard-coded "+42 this week" / "+$1,240 this week"
    // / "+12.4%" placeholders that Cursor left in index.html.
    setText('refKpiTotalReferredDelta', '');
    setText('refKpiActive30dDelta', '');
    setText('refKpiTotalEarnedDelta', '');
    setText('refFunnelClicksDelta', '');
    setText('refFunnelSignupsCvr', fmtPct(f.signups_30d, f.clicks_30d, 'CVR'));
  } catch (e) {
    console.warn('[grom-referral] hydrate failed:', e);
  }
}
window.hydrateReferralSlice = hydrateReferralSlice;

/**
 * Wipe every hardcoded demo number Cursor left in the Referral page markup
 * BEFORE hydrate returns. Otherwise anonymous or slow-hydrating users see
 * "1,284 referred / $18,473.20 earned / 18,420 clicks" which look real.
 */
function gwZeroRefStatsPlaceholders() {
  const ids = [
    'refKpiTotalReferred', 'refKpiActive30d', 'refKpiActivationRate',
    'refKpiTotalEarned',   'refKpiPendingPayout',
    'refFunnelClicks',     'refFunnelSignups', 'refFunnelKyc', 'refFunnelFirstTrade',
    'refFunnelSignupsCvr', 'refFunnelKycRate', 'refFunnelFirstTradeRate',
    'refKpiTotalReferredDelta', 'refKpiActive30dDelta', 'refKpiTotalEarnedDelta',
    'refFunnelClicksDelta',
  ];
  const jwt = (function () { try { return localStorage.getItem('grom_jwt'); } catch (_) { return null; } })();
  const val = jwt ? '—' : '—'; // no user data yet either way
  let touched = 0;
  for (const id of ids) {
    const el = document.getElementById(id);
    if (el && el.textContent && el.textContent.trim() !== val && !el.dataset.gwZeroed) {
      el.textContent = val;
      el.dataset.gwZeroed = '1';
      touched++;
    }
  }
  return touched;
}
window.gwZeroRefStatsPlaceholders = gwZeroRefStatsPlaceholders;

// Fire on page load + every time wallet slice hydrates (login/logout/connect)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => { gwZeroRefStatsPlaceholders(); hydrateReferralSlice(false); });
} else {
  gwZeroRefStatsPlaceholders();
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
/* Per-chain per-asset ERC-20 decimals. USDT on BSC is 18 dp, on Ethereum 6 dp
 * — the classic footgun. USDC follows the same pattern. Native tokens are
 * always 18. */
const GW_SEND_DECIMALS = {
  ETH:       { USDT: 6, USDC: 6, DAI: 18, WBTC: 8 },
  BSC:       { USDT: 18, USDC: 18, BUSD: 18, ETH: 18, BTC: 18, CAKE: 18 },
  ARBITRUM:  { USDT: 6, USDC: 6, DAI: 18 },
  POLYGON:   { USDT: 6, USDC: 6, DAI: 18, WBTC: 8 },
  BASE:      { USDC: 6 },
  OPTIMISM:  { USDT: 6, USDC: 6 },
  AVAXC:     { USDT: 6, USDC: 6 },
};
const GW_NATIVE_FOR = { ETH: 'ETH', ARBITRUM: 'ETH', BASE: 'ETH', OPTIMISM: 'ETH', BSC: 'BNB', POLYGON: 'MATIC', AVAXC: 'AVAX' };

async function gwSubmitSend() {
  const asset = (document.getElementById('wmSendAsset')?.value || 'USDT').toUpperCase();
  const to    = (document.getElementById('wmSendTo')?.value || '').trim();
  const amt   = Number(document.getElementById('wmSendAmt')?.value || 0);
  if (!to || amt <= 0) { gwToast('Recipient and amount required', 'warn'); return; }
  if (!/^0x[a-fA-F0-9]{40}$/.test(to)) { gwToast('Recipient must be a 0x… EVM address', 'warn'); return; }

  // Pick the same provider we swap with — WC first (mobile/Trust), then injected
  const provider = (window.gromWallet?.wcProvider && window.gromWallet.wcProvider.accounts?.[0])
    ? window.gromWallet.wcProvider
    : window.ethereum;
  if (!provider) { gwPromptSignIn('No wallet detected. Connect MetaMask / Trust / WalletConnect to send.'); return; }
  const from = gwUserAddress();
  if (!from) { gwPromptSignIn('Connect a wallet first to sign the transaction.'); return; }

  try {
    const chainHex = await provider.request({ method: 'eth_chainId' });
    const chainKey = Object.entries(GROM_NETWORKS).find(([k, v]) => v.hex === chainHex)?.[0];
    if (!chainKey) { gwToast(`Unsupported chain ${chainHex}. Switch network in your wallet.`, 'warn'); return; }

    let txParams;
    const nativeSym = GW_NATIVE_FOR[chainKey] || 'ETH';
    if (asset === nativeSym) {
      // Native transfer — value in wei (18 dp always for EVM natives).
      // Convert amt with full precision by scaling to attoUnits via string.
      const wei = BigInt(Math.round(amt * 1e6)) * BigInt(1e12); // 6 fractional digits kept
      txParams = { from, to, value: '0x' + wei.toString(16) };
    } else {
      const erc20 = (GROM_ERC20[chainKey] || {})[asset];
      if (!erc20) { gwToast(`${asset} not deployed on ${chainKey}. Switch chain or pick another asset.`, 'warn'); return; }
      const dec = (GW_SEND_DECIMALS[chainKey] || {})[asset] || 18;
      const units = BigInt(Math.round(amt * Math.pow(10, dec)));
      const sel4 = 'a9059cbb'; // transfer(address,uint256)
      const addr32 = to.toLowerCase().replace(/^0x/, '').padStart(64, '0');
      const amt32 = units.toString(16).padStart(64, '0');
      txParams = { from, to: erc20, data: '0x' + sel4 + addr32 + amt32, value: '0x0' };
    }
    gwToast('Confirm the transaction in your wallet…', 'info');
    const hash = await provider.request({ method: 'eth_sendTransaction', params: [txParams] });
    gwToast(`Submitted — waiting for confirmation… ${hash.slice(0, 12)}…`, 'info');
    // Wait for receipt so the user isn't left guessing
    try { await gwWaitReceipt(provider, hash, 120000); gwToast('✓ Sent. Confirmed on-chain.', 'success'); }
    catch (_) { gwToast(`Sent (still propagating): ${hash.slice(0, 12)}…`, 'info'); }
    if (typeof window.closeWalletModal === 'function') window.closeWalletModal();
    // Re-hydrate balance
    setTimeout(() => {
      try { window.gromFetchOnchainBalances?.(from, parseInt(chainHex, 16)); } catch (_) {}
      // Also refresh Wallet-page on-chain card if it's mounted
      try { document.dispatchEvent(new CustomEvent('grom:wallet-connected', { detail: { address: from } })); } catch (_) {}
    }, 3000);
  } catch (e) {
    console.warn('[grom-send] failed:', e);
    const msg = String(e?.message || e || '').toLowerCase();
    if (msg.includes('reject') || msg.includes('denied') || e?.code === 4001) {
      gwToast('You cancelled the transaction', 'warn');
    } else if (msg.includes('insufficient funds')) {
      gwToast('Insufficient balance (or not enough for gas)', 'error');
    } else {
      gwToast(e?.message || 'Send failed', 'error');
    }
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


/* Telegram community card — injected into #page-help only.
 *
 * Previously we mounted a floating FAB in the bottom-right corner of every
 * page (2026-06-14). User feedback (2026-07-05): "убери с главной, перенеси
 * в Помощь". Now the CTA lives inside the Support page as a premium hero
 * card at the top of the section, and is hidden everywhere else. */
const GW_TG_TR = {
  ru: { h: 'Официальный Telegram-канал GROM', sub: 'Живые обновления рынка, поддержка команды, приглашение инвесторам, комьюнити 24/7.', b1: 'Прямой канал к команде', b2: 'Новости продукта первыми', b3: 'Помощь по торговле и депозитам', cta: 'Открыть канал →', foot: 'Единственный официальный канал — не поддавайся имитациям' },
  en: { h: 'Official GROM Telegram channel', sub: 'Live market updates, direct team support, investor invites, 24/7 community.', b1: 'Direct line to the team', b2: 'Product news first', b3: 'Trading & deposit help', cta: 'Open channel →', foot: 'Only official channel — beware of impostors' },
  es: { h: 'Canal oficial de GROM en Telegram', sub: 'Actualizaciones de mercado, soporte del equipo, comunidad 24/7.', b1: 'Contacto directo con el equipo', b2: 'Noticias primero', b3: 'Ayuda con trading', cta: 'Abrir canal →', foot: 'Único canal oficial' },
  ar: { h: 'قناة GROM الرسمية على تيليجرام', sub: 'تحديثات مباشرة، دعم الفريق، مجتمع على مدار الساعة.', b1: 'خط مباشر مع الفريق', b2: 'أخبار المنتج أوّلاً', b3: 'مساعدة في التداول', cta: 'فتح القناة ←', foot: 'القناة الرسمية الوحيدة' },
  zh: { h: 'GROM 官方 Telegram 频道', sub: '实时市场更新、团队支持、社群 24/7。', b1: '与团队的直接沟通', b2: '第一手产品新闻', b3: '交易与充值帮助', cta: '打开频道 →', foot: '唯一官方渠道' },
  hi: { h: 'GROM का आधिकारिक Telegram चैनल', sub: 'लाइव मार्केट अपडेट, टीम सपोर्ट, 24/7 समुदाय।', b1: 'टीम से सीधा संपर्क', b2: 'सबसे पहले खबरें', b3: 'ट्रेडिंग सहायता', cta: 'चैनल खोलें →', foot: 'एकमात्र आधिकारिक चैनल' },
  tr: { h: 'GROM resmi Telegram kanalı', sub: 'Canlı piyasa güncellemeleri, ekip desteği, 7/24 topluluk.', b1: 'Ekiple doğrudan iletişim', b2: 'Ürün haberleri ilk elden', b3: 'İşlem ve yatırım desteği', cta: 'Kanalı aç →', foot: 'Tek resmi kanal' },
};
function gwTgLang() { let l='en'; try { const s=localStorage.getItem('grom_lang'); if (s&&GW_TG_TR[s]) l=s; } catch (_) {} return GW_TG_TR[l]||GW_TG_TR.en; }
const GW_TG_URL = 'https://t.me/grom_finence_hub';

function gwInjectTelegramCss() {
  if (document.getElementById('gw-tg-help-css')) return;
  const css = `
    /* Kill the old floating FAB in case a stale build (or Cursor) left one. */
    #gw-tg-fab { display: none !important; }

    .gw-tg-card {
      position: relative; overflow: hidden;
      margin: 12px 0 18px;
      padding: 22px 22px 20px;
      border-radius: 22px;
      background:
        radial-gradient(120% 140% at 100% 0%, rgba(41,169,235,0.16), transparent 55%),
        radial-gradient(80% 100% at 0% 100%, rgba(41,169,235,0.10), transparent 55%),
        linear-gradient(160deg, rgba(13,22,38,0.75) 0%, rgba(8,14,26,0.92) 100%);
      border: 1px solid rgba(41,169,235,0.28);
      color: #e7eef8;
      box-shadow: 0 16px 42px -20px rgba(0,0,0,0.55);
    }
    .gw-tg-card::before {
      content: ""; position: absolute; inset: -1px; border-radius: inherit;
      padding: 1px;
      background: conic-gradient(from 0deg, #29a9eb 0%, transparent 30%, #166fb0 60%, transparent 90%, #29a9eb 100%);
      -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
              mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
      -webkit-mask-composite: xor; mask-composite: exclude;
      opacity: 0.55; animation: gwBnSpin 24s linear infinite;
      pointer-events: none;
    }
    .gw-tg-hero { display: flex; gap: 16px; align-items: flex-start; position: relative; z-index: 1; }
    .gw-tg-logo {
      flex: 0 0 auto;
      width: 60px; height: 60px; border-radius: 20px;
      background: linear-gradient(135deg, #29a9eb, #166fb0);
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 10px 24px -8px rgba(41,169,235,0.55), 0 0 0 1px rgba(255,255,255,0.08) inset;
    }
    .gw-tg-logo svg { width: 32px; height: 32px; }
    .gw-tg-body { flex: 1; min-width: 0; }
    .gw-tg-h { margin: 0 0 4px; font-size: 18px; font-weight: 800; letter-spacing: -0.01em;
      background: linear-gradient(180deg,#fff,#c7d8ec); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
    .gw-tg-sub { margin: 0 0 12px; font-size: 12.5px; color: #98a8c0; line-height: 1.55; }
    .gw-tg-bullets { list-style: none; margin: 0 0 14px; padding: 0; display: flex; flex-direction: column; gap: 5px; font-size: 12.5px; color: #cfdfee; }
    .gw-tg-bullets li { display: flex; gap: 8px; align-items: baseline; }
    .gw-tg-bullets li::before { content: "✓"; color: #29a9eb; font-weight: 800; }
    .gw-tg-cta {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 11px 22px; border-radius: 12px; border: 0;
      background: linear-gradient(135deg, #29a9eb, #166fb0);
      color: #fff !important; font-weight: 800; font-size: 13px; letter-spacing: .02em;
      text-decoration: none !important; cursor: pointer;
      box-shadow: 0 10px 24px -8px rgba(41,169,235,0.55);
      transition: transform .2s, box-shadow .2s;
    }
    .gw-tg-cta:hover { transform: translateY(-1px); box-shadow: 0 14px 30px -8px rgba(41,169,235,0.75); }
    .gw-tg-cta:active { transform: translateY(0); }
    .gw-tg-foot { margin: 10px 0 0; font-size: 11px; color: #6b7a92; }
    @media (max-width: 600px) {
      .gw-tg-hero { flex-direction: column; }
      .gw-tg-logo { width: 48px; height: 48px; border-radius: 14px; }
      .gw-tg-h { font-size: 16.5px; }
    }
  `;
  const style = document.createElement('style');
  style.id = 'gw-tg-help-css';
  style.textContent = css;
  document.head.appendChild(style);
}

function gwRenderTelegramHelpCard() {
  const page = document.getElementById('page-help');
  if (!page) return;
  gwInjectTelegramCss();
  if (page.querySelector('.gw-tg-card')) return; // already mounted
  const t = gwTgLang();
  const card = document.createElement('div');
  card.className = 'gw-tg-card';
  card.innerHTML = `
    <div class="gw-tg-hero">
      <div class="gw-tg-logo">
        <svg viewBox="0 0 24 24" fill="#fff" xmlns="http://www.w3.org/2000/svg"><path d="M9.999 15.2l-.397 5.6c.567 0 .812-.243 1.108-.535l2.66-2.54 5.514 4.034c1.011.557 1.724.265 1.997-.937L23.92 3.06c.36-1.5-.542-2.085-1.523-1.72L1.116 9.534c-1.466.57-1.444 1.39-.25 1.762l5.46 1.704 12.683-7.99c.597-.395 1.14-.176.694.218z"/></svg>
      </div>
      <div class="gw-tg-body">
        <h3 class="gw-tg-h">${t.h}</h3>
        <p class="gw-tg-sub">${t.sub}</p>
        <ul class="gw-tg-bullets">
          <li>${t.b1}</li>
          <li>${t.b2}</li>
          <li>${t.b3}</li>
        </ul>
        <a class="gw-tg-cta" href="${GW_TG_URL}" target="_blank" rel="noopener noreferrer">${t.cta}</a>
        <p class="gw-tg-foot">${t.foot}</p>
      </div>
    </div>
  `;
  // Insert right after the page title so it's the first "content" block
  const title = page.querySelector('.page-title, h1');
  const subtitle = page.querySelector('.page-subtitle');
  const anchor = subtitle || title;
  if (anchor && anchor.parentNode === page) anchor.after(card);
  else page.prepend(card);

  // ── Also patch Cursor's static "1,284 referred / $1,240 this week / All
  // systems operational" placeholder line by keeping only the badge; and
  // remove the "Take the 90-second tour" and "Search commands ⌘K" widgets
  // that are non-functional in the current build (they belong in the
  // command palette which isn't wired yet).
  const helpGrid = page.querySelector('.help-grid');
  if (helpGrid && !helpGrid.dataset.gwPruned) {
    helpGrid.dataset.gwPruned = '1';
    // Best-effort — if selectors change we just leave things be.
    Array.from(helpGrid.children).forEach((el) => {
      const txt = (el.textContent || '').toLowerCase();
      if (txt.includes('90-second tour') || txt.includes('90 секунд') || txt.includes('search commands') || txt.includes('⌘k')) {
        el.style.display = 'none';
      }
    });
  }
}

function gwInjectTelegramFab() {
  // Retained for API compatibility with older init sequences — now just
  // guarantees the CSS is present so any stale #gw-tg-fab in the DOM is
  // hidden. Nothing is appended; the community card handles the CTA.
  gwInjectTelegramCss();
  const stale = document.getElementById('gw-tg-fab');
  if (stale) stale.remove();
}

function gwSetupTelegramHelpCard() {
  const tryRender = gwDebounce(() => {
    if (document.getElementById('page-help')) {
      try { gwRenderTelegramHelpCard(); console.log('[GROM] telegram help card rendered'); }
      catch (e) { console.warn('[GROM] telegram help card', e); }
    }
  }, 200);
  tryRender();
  let n = 0; const id = setInterval(() => { n++; if (document.querySelector('#page-help .gw-tg-card') || n >= 20) clearInterval(id); else tryRender(); }, 500);
  window.addEventListener('hashchange', tryRender);
  const obs = new MutationObserver(() => tryRender());
  obs.observe(document.body, { attributes: true, subtree: false, attributeFilter: ['data-page'] });
  window.addEventListener('grom:lang-change', () => { const el = document.querySelector('#page-help .gw-tg-card'); if (el) el.remove(); tryRender(); });
}

/**
 * Kill every remaining demo number Cursor's index.html has hardcoded:
 *   • Referral KPIs / funnel / deltas (re-zeroed when user switches to
 *     #page-referral; hydrateReferralSlice then fills real values).
 *   • Any static balance sitting inside a dashboard KPI element before our
 *     meta-portfolio + wallet slice hydrates.
 * Runs once at boot and on every hashchange / data-page mutation so returning
 * to the page doesn't reveal the placeholders again.
 */
function gwSetupKillDemoNumbers() {
  const run = gwDebounce(() => {
    try {
      if (document.getElementById('page-referral')) {
        gwZeroRefStatsPlaceholders();
        // Re-run hydrate — the user may have just logged in.
        if (typeof hydrateReferralSlice === 'function') hydrateReferralSlice(true);
      }
      // User decision (2026-07-05): keep demo balances for Binary /
      // Futures / Predict / Stocks (those pages are game/testnet-mode
      // by design). Only wipe demo for dashboard/wallet/spot.
    } catch (e) { console.warn('[GROM] killDemo', e); }
  }, 150);
  run();
  window.addEventListener('hashchange', run);
  const obs = new MutationObserver(() => run());
  obs.observe(document.body, { attributes: true, subtree: false, attributeFilter: ['data-page'] });
  // Also react when auth state changes
  window.addEventListener('grom:auth', run);
  window.addEventListener('storage', (e) => { if (e.key === 'grom_jwt') run(); });
}

/* Placeholder — earlier version of this function zeroed Cursor's
 * boState.balance.live seed on the Binary page. User asked (2026-07-05)
 * to keep the demo balance on Binary / Futures / Predict / Stocks (they
 * are game/testnet-mode by design). Left as a no-op stub so the init
 * sequence doesn't break; delete on the next round if still unused. */
function gwZeroBinaryDemoBalance() { /* intentionally no-op — see comment above */ }

/* Hide redundant "Other wallet" row in the Connect modal. WalletConnect v2
 * already covers any arbitrary wallet via its protocol (the QR/deep-link
 * route works for every wallet that isn't on the named list), so the ghost
 * "Other wallet" → cnConnect('Other wallet','ghost') row was a confusing
 * duplicate. Injected unconditionally (the cn-modal lives in Cursor's
 * index.html and is unaffected by his deposit-UI gating). Safe under
 * Cursor's parallel edits — this is a single CSS rule scoped to .cn-list. */
/* Auto-advance Cursor's deposit flow on coin / network tap.
 *
 * The Binance-style 5-screen deposit UI (Cursor commit d19f86c) has explicit
 * Continue buttons between steps. On mobile that means: tap coin → tap
 * Continue → tap network → tap Continue → tap address. Four taps to see one
 * address. User feedback (2026-07-04): "нажимаю на монету — сразу должно
 * кидать на кошелек". We keep his HTML/CSS/state functions untouched and
 * just fire the "next step" transition synthetically after each selection
 * click. Popular coin chips already auto-advance; this extends the same
 * behavior to the full coin list and the network list. */
function gwWireDepositAutoContinue() {
  const pane = document.querySelector('#walletModal .dep-flow');
  if (!pane || pane.dataset.gwAutoContinue) return false;
  pane.dataset.gwAutoContinue = '1';
  pane.addEventListener('click', (e) => {
    // Coin list row (dep-pop chips already auto-advance in Cursor's own
    // handler — we skip those to avoid firing gromDepGoNetwork twice).
    const coinRow = e.target.closest('.dep-coin[data-coin]');
    if (coinRow && !coinRow.classList.contains('dep-pop')) {
      setTimeout(() => {
        try { if (typeof window.gromDepGoNetwork === 'function') window.gromDepGoNetwork(); } catch (_) {}
      }, 0);
      return;
    }
    // Network row → jump straight to the address screen (skips the custody
    // "mode" step, which for testing/paper-swap is a formality — the user
    // just wants their deposit address).
    const netRow = e.target.closest('.dep-net[data-net]');
    if (netRow) {
      setTimeout(() => {
        try {
          if (typeof window.gromDepGoAddress === 'function') window.gromDepGoAddress();
          else if (typeof window.gromDepGoCustody === 'function') window.gromDepGoCustody();
        } catch (_) {}
      }, 0);
    }
  });
  return true;
}

// Wire when modal appears (MutationObserver on wm-overlay display), and also
// try periodically for the first 20s in case Cursor mounts .dep-flow lazily.
function gwSetupDepositAutoContinue() {
  if (gwWireDepositAutoContinue()) return;
  let tries = 0;
  const id = setInterval(() => {
    tries++;
    if (gwWireDepositAutoContinue() || tries >= 20) clearInterval(id);
  }, 1000);
}

/* ============================================================================
 * ON-CHAIN WALLET CARD on the Wallet page
 *
 * User feedback (2026-07-04): "не нужно стартовый баланс а нужно что бы при
 * конект показал тот баланс который есть на кошельке". Cursor's Wallet hero
 * shows the *custodial trading account* (postgres balances). We inject an
 * extra card that shows the **on-chain** balances of the connected wallet
 * across every EVM chain we have RPCs for. Fetches native + USDT + USDC per
 * chain, prices via Binance public ticker, totals in USD.
 *
 * Read-only, no writes. Refreshes on wallet connect and when the user opens
 * the Wallet page. Falls back to a clean "Nothing on-chain yet" state on
 * empty addresses so it never looks broken. */
const GW_OC_CHAIN_META = {
  1:     { label: 'Ethereum',  native: 'ETH', tickerSym: 'ETHUSDT' },
  42161: { label: 'Arbitrum',  native: 'ETH', tickerSym: 'ETHUSDT' },
  137:   { label: 'Polygon',   native: 'MATIC', tickerSym: 'MATICUSDT' },
  8453:  { label: 'Base',      native: 'ETH', tickerSym: 'ETHUSDT' },
  56:    { label: 'BSC',       native: 'BNB', tickerSym: 'BNBUSDT' },
};

async function gwOcFetchPrices() {
  const symbols = new Set(['ETHUSDT', 'BNBUSDT', 'MATICUSDT']);
  const out = { USDT: 1, USDC: 1 };
  await Promise.all([...symbols].map(async (s) => {
    try {
      const r = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${s}`);
      if (!r.ok) return;
      const j = await r.json();
      const base = s.replace('USDT', '');
      out[base] = Number(j.price);
    } catch (_) {}
  }));
  return out;
}

async function gwOcFetchAllChains(address) {
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) return [];
  const chains = Object.keys(GW_OC_CHAIN_META).map(Number);
  const results = await Promise.all(chains.map((chainId) =>
    (typeof window.gromFetchOnchainBalances === 'function'
      ? window.gromFetchOnchainBalances(address, chainId)
      : Promise.resolve(null)
    ).catch(() => null)
  ));
  return chains.map((chainId, i) => ({
    chainId,
    meta: GW_OC_CHAIN_META[chainId],
    data: results[i] || null,
  }));
}

function gwInjectOnchainCardCss() {
  if (document.getElementById('gw-oc-card-css')) return;
  const css = `
    .gw-oc-card {
      margin: 14px 0 20px;
      padding: 18px;
      border-radius: 18px;
      background:
        radial-gradient(120% 140% at 0% 0%, rgba(0,194,255,0.08), transparent 55%),
        linear-gradient(155deg, rgba(13,22,38,0.72) 0%, rgba(8,14,26,0.92) 100%);
      border: 1px solid rgba(0,194,255,0.14);
      color: #e7eef8;
      box-shadow: 0 1px 0 rgba(255,255,255,0.05) inset, 0 12px 32px -20px rgba(0,0,0,0.55);
    }
    .gw-oc-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 14px; }
    .gw-oc-title { font-size: 12px; letter-spacing: .14em; text-transform: uppercase; font-weight: 800; color: #6b7a92; margin: 0 0 4px; }
    .gw-oc-total { font-size: 28px; font-weight: 800; font-variant-numeric: tabular-nums; letter-spacing: -0.01em; margin: 0;
      background: linear-gradient(180deg,#fff,#c7d8ec); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
    .gw-oc-addr { font-family: 'SF Mono', ui-monospace, monospace; font-size: 11px; color: #98a8c0; }
    .gw-oc-refresh { padding: 6px 12px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.10);
      background: rgba(255,255,255,0.04); color: #cfdfee; font-size: 12px; font-weight: 700; cursor: pointer; }
    .gw-oc-refresh:hover { background: rgba(255,255,255,0.08); }
    .gw-oc-list { display: flex; flex-direction: column; gap: 8px; }
    .gw-oc-chain { padding: 12px 14px; border-radius: 12px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); }
    .gw-oc-chain-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
    .gw-oc-chain-name { font-weight: 700; font-size: 13.5px; }
    .gw-oc-chain-usd { font-size: 12.5px; color: #98a8c0; font-variant-numeric: tabular-nums; }
    .gw-oc-toks { display: flex; flex-wrap: wrap; gap: 6px 10px; font-size: 11.5px; color: #cfdfee; font-family: 'SF Mono', ui-monospace, monospace; }
    .gw-oc-toks span { color: #9bb3c7; }
    .gw-oc-empty { padding: 22px; text-align: center; color: #6b7a92; font-size: 13px; }
    .gw-oc-loading { padding: 18px; text-align: center; color: #98a8c0; font-size: 12.5px; }
  `;
  const s = document.createElement('style');
  s.id = 'gw-oc-card-css';
  s.textContent = css;
  document.head.appendChild(s);
}

function gwOcConnectedAddress() {
  const isAddr = (a) => typeof a === 'string' && /^0x[a-fA-F0-9]{40}$/.test(a.trim());
  // 1. Live module state (set by updateChip on every connect / accountsChanged)
  try {
    if (window.gromWallet?.state) {
      const s = window.gromWallet.state();
      if (isAddr(s?.account)) return s.account.trim();
    }
  } catch (_) {}
  // 2. Injected wallet direct
  try {
    if (isAddr(window.ethereum?.selectedAddress)) return window.ethereum.selectedAddress.trim();
  } catch (_) {}
  // 3. WalletConnect provider (already connected but SIWE not signed yet)
  try {
    if (window.gromWallet?.wcProvider?.accounts?.[0] && isAddr(window.gromWallet.wcProvider.accounts[0])) {
      return window.gromWallet.wcProvider.accounts[0].trim();
    }
  } catch (_) {}
  // 4. Wallet chip in the top bar (Cursor's Sign-in / Sign-up chip after connect)
  try {
    const chip = document.getElementById('walletChipAddr')?.textContent?.trim();
    if (isAddr(chip)) return chip;
  } catch (_) {}
  // 5. Persistent label from prior session
  try {
    const stored = localStorage.getItem('grom_wallet_label');
    if (isAddr(stored)) return stored.trim();
  } catch (_) {}
  return null;
}

async function gwRenderOnchainCard() {
  const page = document.getElementById('page-wallet');
  if (!page) return;
  gwInjectOnchainCardCss();

  let card = document.getElementById('gwOnchainCard');
  if (!card) {
    card = document.createElement('div');
    card.className = 'gw-oc-card';
    card.id = 'gwOnchainCard';
    // Insert AFTER wallet-hero so it sits between hero and ops-grid.
    const hero = page.querySelector('.wallet-hero');
    if (hero && hero.parentNode) hero.after(card);
    else page.prepend(card);
  }

  const addr = gwOcConnectedAddress();
  if (!addr) {
    card.innerHTML = `
      <div class="gw-oc-head">
        <div>
          <p class="gw-oc-title">Ваш кошелёк · on-chain</p>
          <p class="gw-oc-total">—</p>
        </div>
      </div>
      <div class="gw-oc-empty">Подключи кошелёк, чтобы увидеть свои on-chain балансы (ETH, BNB, MATIC, USDT, USDC на 5 сетях).</div>
    `;
    return;
  }

  const short = addr.slice(0, 6) + '…' + addr.slice(-4);
  card.innerHTML = `
    <div class="gw-oc-head">
      <div>
        <p class="gw-oc-title">Ваш кошелёк · on-chain</p>
        <p class="gw-oc-total" id="gwOcTotal">—</p>
        <p class="gw-oc-addr">${short}</p>
      </div>
      <button type="button" class="gw-oc-refresh" id="gwOcRefresh">↻ Обновить</button>
    </div>
    <div class="gw-oc-loading">Загружаем балансы по 5 сетям…</div>
  `;
  document.getElementById('gwOcRefresh')?.addEventListener('click', gwRenderOnchainCard);

  try {
    const [prices, chains] = await Promise.all([gwOcFetchPrices(), gwOcFetchAllChains(addr)]);
    let totalUsd = 0;
    const rows = [];
    for (const c of chains) {
      if (!c.data) continue;
      const items = [];
      let chainUsd = 0;
      // Native token
      if (c.data.nativeEth != null && c.data.nativeEth > 0.0000001) {
        const sym = c.meta.native;
        const usd = c.data.nativeEth * (prices[sym] || 0);
        chainUsd += usd;
        items.push(`${sym} ${Number(c.data.nativeEth).toFixed(5)}`);
      }
      // ERC-20s
      for (const [sym, amt] of Object.entries(c.data.tokens || {})) {
        if (!(amt > 0.0001)) continue;
        const usd = amt * (prices[sym] || 0);
        chainUsd += usd;
        items.push(`${sym} ${Number(amt).toFixed(2)}`);
      }
      if (items.length === 0) continue;
      totalUsd += chainUsd;
      rows.push(`
        <div class="gw-oc-chain">
          <div class="gw-oc-chain-head">
            <span class="gw-oc-chain-name">${c.meta.label}</span>
            <span class="gw-oc-chain-usd">≈ $${chainUsd.toFixed(2)}</span>
          </div>
          <div class="gw-oc-toks">${items.map((t) => `<span>${t}</span>`).join(' · ')}</div>
        </div>
      `);
    }

    const list = rows.length
      ? `<div class="gw-oc-list">${rows.join('')}</div>`
      : `<div class="gw-oc-empty">На поддерживаемых сетях (ETH · Arbitrum · Polygon · Base · BSC) нет баланса. Пополни кошелёк, чтобы увидеть здесь.</div>`;

    card.innerHTML = `
      <div class="gw-oc-head">
        <div>
          <p class="gw-oc-title">Ваш кошелёк · on-chain</p>
          <p class="gw-oc-total">$${totalUsd.toFixed(2)}</p>
          <p class="gw-oc-addr">${short} · всего по 5 сетям</p>
        </div>
        <button type="button" class="gw-oc-refresh" id="gwOcRefresh">↻ Обновить</button>
      </div>
      ${list}
    `;
    document.getElementById('gwOcRefresh')?.addEventListener('click', gwRenderOnchainCard);
  } catch (e) {
    card.querySelector('.gw-oc-loading')?.classList.remove('gw-oc-loading');
    const err = document.createElement('div');
    err.className = 'gw-oc-empty';
    err.textContent = 'Не удалось загрузить on-chain балансы. Попробуй ещё раз через минуту.';
    card.appendChild(err);
  }
}

function gwSetupOnchainCard() {
  const tryRender = () => { if (document.getElementById('page-wallet')) gwRenderOnchainCard(); };
  tryRender();
  window.addEventListener('hashchange', tryRender);
  window.addEventListener('storage', (e) => { if (e.key === 'grom_jwt' || e.key === 'grom_wallet_label') tryRender(); });
  // Re-render on wallet-connect events fired by our own connectors.
  document.addEventListener('grom:wallet-connected', tryRender);
  document.addEventListener('grom:wallet-disconnected', tryRender);
  // Also mount the card whenever page-wallet appears (Cursor's SPA router).
  const bodyObs = new MutationObserver(() => tryRender());
  bodyObs.observe(document.body, { attributes: true, subtree: false, attributeFilter: ['data-page'] });
}

/* =============================================================================
 * META-PORTFOLIO — the killer feature. Aggregates FOUR portfolio "worlds"
 * that no other exchange combines in one view:
 *   1. Trading account balance (custodial, postgres)      — via /api/wallet/overview
 *   2. On-chain wallet balance (across 5 EVM chains)      — via gromFetchOnchainBalances
 *   3. Prediction market positions (Polymarket-style)     — placeholder in v1
 *   4. Tokenized stocks positions (xStocks)               — placeholder in v1
 *
 * Renders a single big card on the Dashboard with the grand total, breakdown
 * by category, and quick actions. First step toward the AI Portfolio Coach
 * (Phase 2). Refreshes on wallet-connect, JWT change, hashchange.
 * ============================================================================ */
function gwInjectMetaPortfolioCss() {
  if (document.getElementById('gw-mp-css')) return;
  const css = `
    .gw-mp-wrap { margin: 16px 0 8px; }
    .gw-mp-card {
      position: relative; isolation: isolate;
      padding: 22px 22px 20px; border-radius: 24px;
      background:
        radial-gradient(120% 140% at 100% 0%, rgba(168,85,247,0.10), transparent 55%),
        radial-gradient(80% 100% at 0% 100%, rgba(34,193,124,0.08), transparent 55%),
        linear-gradient(160deg, rgba(13,22,38,0.72) 0%, rgba(8,14,26,0.92) 100%);
      border: 1px solid rgba(255,255,255,0.08);
      box-shadow: 0 1px 0 rgba(255,255,255,0.06) inset, 0 16px 42px -20px rgba(0,0,0,0.55);
      backdrop-filter: blur(14px) saturate(150%);
      -webkit-backdrop-filter: blur(14px) saturate(150%);
      overflow: hidden; color: #e7eef8;
    }
    .gw-mp-card::before {
      content: ""; position: absolute; inset: -2px;
      padding: 1.5px; border-radius: inherit;
      background: conic-gradient(from 90deg, #a855f7 0%, transparent 25%, #22c17c 50%, transparent 75%, #a855f7 100%);
      -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
              mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
      -webkit-mask-composite: xor; mask-composite: exclude;
      opacity: 0.5; animation: gwBnSpin 24s linear infinite;
      pointer-events: none; z-index: 0;
    }
    .gw-mp-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 14px; position: relative; z-index: 1; margin-bottom: 14px; }
    .gw-mp-eyebrow { font-size: 10.5px; letter-spacing: .18em; text-transform: uppercase; color: #6b7a92; font-weight: 800; margin: 0 0 4px; }
    .gw-mp-total { font-size: 34px; font-weight: 800; letter-spacing: -0.02em; margin: 0;
      background: linear-gradient(180deg,#fff,#c7d8ec); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; font-variant-numeric: tabular-nums; }
    .gw-mp-sub { font-size: 12.5px; color: #98a8c0; margin: 4px 0 0; }
    .gw-mp-badge { display: inline-flex; align-items: center; gap: 6px; padding: 5px 10px; border-radius: 999px; background: rgba(168,85,247,0.14); color: #d8b4fe; font-size: 10px; font-weight: 800; letter-spacing: .14em; border: 1px solid rgba(168,85,247,0.28); align-self: center; }
    .gw-mp-badge::before { content: "✦"; opacity: 0.7; }

    /* Category bar visualization */
    .gw-mp-bar {
      position: relative; z-index: 1;
      height: 10px; border-radius: 999px; overflow: hidden;
      background: rgba(255,255,255,0.04);
      display: flex;
      margin: 12px 0 10px;
    }
    .gw-mp-bar span { height: 100%; transition: width .35s ease; }

    /* Category rows */
    .gw-mp-cats { position: relative; z-index: 1; display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
    @media (max-width: 720px) { .gw-mp-cats { grid-template-columns: repeat(2, 1fr); } }
    .gw-mp-cat {
      padding: 12px 12px 10px; border-radius: 14px;
      background: rgba(255,255,255,0.025);
      border: 1px solid rgba(255,255,255,0.05);
      display: flex; flex-direction: column; gap: 2px;
    }
    .gw-mp-cat.custodial { border-color: rgba(0,194,255,0.18); }
    .gw-mp-cat.onchain   { border-color: rgba(34,193,124,0.18); }
    .gw-mp-cat.predict   { border-color: rgba(168,85,247,0.18); }
    .gw-mp-cat.xstocks   { border-color: rgba(245,185,77,0.18); }
    .gw-mp-cat-lbl { font-size: 10px; letter-spacing: .14em; text-transform: uppercase; color: #6b7a92; font-weight: 800; display: flex; align-items: center; gap: 6px; }
    .gw-mp-cat-lbl .dot { width: 8px; height: 8px; border-radius: 50%; }
    .gw-mp-cat.custodial .dot { background: #00c2ff; box-shadow: 0 0 6px #00c2ff; }
    .gw-mp-cat.onchain   .dot { background: #22c17c; box-shadow: 0 0 6px #22c17c; }
    .gw-mp-cat.predict   .dot { background: #a855f7; box-shadow: 0 0 6px #a855f7; }
    .gw-mp-cat.xstocks   .dot { background: #f5b94d; box-shadow: 0 0 6px #f5b94d; }
    .gw-mp-cat-val { font-size: 18px; font-weight: 800; color: #e7eef8; font-variant-numeric: tabular-nums; }
    .gw-mp-cat-sub { font-size: 10.5px; color: #6b7a92; }

    .gw-mp-actions {
      position: relative; z-index: 1;
      display: flex; gap: 8px; margin-top: 14px; flex-wrap: wrap;
    }
    .gw-mp-btn {
      padding: 9px 14px; border-radius: 10px;
      background: rgba(255,255,255,0.05);
      color: #cfdfee; border: 1px solid rgba(255,255,255,0.08);
      font-size: 12.5px; font-weight: 700; cursor: pointer;
      transition: all .15s;
    }
    .gw-mp-btn:hover { background: rgba(255,255,255,0.08); color: #fff; border-color: rgba(0,194,255,0.25); }
    .gw-mp-btn.primary {
      background: linear-gradient(135deg, rgba(0,194,255,0.18), rgba(168,85,247,0.12));
      border-color: rgba(0,194,255,0.3); color: #3ac2ff;
    }

    .gw-mp-empty { padding: 22px; text-align: center; color: #6b7a92; font-size: 13px; }
    .gw-mp-loading { padding: 12px 0; color: #98a8c0; font-size: 12.5px; }

    @media (max-width: 600px) {
      .gw-mp-card { padding: 18px 16px 16px; border-radius: 20px; }
      .gw-mp-total { font-size: 28px; }
    }
  `;
  const s = document.createElement('style');
  s.id = 'gw-mp-css';
  s.textContent = css;
  document.head.appendChild(s);
}

/* Fetch each portfolio component. All safe to fail silently — the card just
 * shows what's available. Prediction / xStocks are v1 placeholders until
 * their real endpoints ship; we detect them via any global Cursor exposes. */
/* Meta-Portfolio perf cache (2026-07-06/07).
 *
 * Two-layer cache to keep the dashboard snappy:
 *   Layer 1 (in-memory)   — 30 s TTL for the current session
 *   Layer 2 (localStorage)— survives hard reload, up to 10 min old
 *
 * Stale-while-revalidate: hand back the cached value immediately and
 * kick off a background refresh that repaints when it lands. User
 * feedback ("потупливает при обновлении") was fine on soft reloads
 * (in-memory hit) but bad on Ctrl+Shift+R because in-memory was
 * wiped. localStorage bridges the reload. */
const GW_MP_CACHE = { custodial: null, onchain: null }; // { at:ms, val }
const GW_MP_TTL = 30_000;
const GW_MP_LS_TTL = 10 * 60_000;
const GW_MP_LS_KEY = 'gw_mp_cache_v1';
const GW_MP_INFLIGHT = { custodial: null, onchain: null };
// Hydrate the in-memory cache from localStorage at module load so the
// very first render after a hard refresh sees the last known values.
(function _gwMpHydrate() {
  try {
    const raw = localStorage.getItem(GW_MP_KEY_OR_LEGACY());
    if (!raw) return;
    const obj = JSON.parse(raw);
    const now = Date.now();
    if (obj?.custodial && now - obj.custodial.at < GW_MP_LS_TTL) GW_MP_CACHE.custodial = obj.custodial;
    if (obj?.onchain   && now - obj.onchain.at   < GW_MP_LS_TTL) GW_MP_CACHE.onchain   = obj.onchain;
  } catch (_) {}
})();
function GW_MP_KEY_OR_LEGACY() { return GW_MP_LS_KEY; } // hoisted alias for readability
function _gwMpPersist() {
  try { localStorage.setItem(GW_MP_LS_KEY, JSON.stringify({
    custodial: GW_MP_CACHE.custodial,
    onchain:   GW_MP_CACHE.onchain,
  })); } catch (_) {}
}

async function _mpCustodialRaw() {
  const jwt = localStorage.getItem('grom_jwt');
  if (!jwt) return { usd: 0, has: false };
  try {
    const r = await fetch('/api/wallet/overview', { headers: { Authorization: `Bearer ${jwt}` } });
    if (!r.ok) return { usd: 0, has: false };
    const j = await r.json();
    const totalUsd = Number(j?.summary?.totalUsd) || 0;
    const assetsN = (j?.summary?.assets || []).filter((a) => Number(a.amount) > 0).length;
    return { usd: totalUsd, has: true, assetsN };
  } catch (_) { return { usd: 0, has: false }; }
}
async function _mpOnchainRaw() {
  try {
    const addr = (function () {
      try { return window.gromWallet?.state?.().account; } catch (_) { return null; }
    })();
    if (!addr || !/^0x[a-fA-F0-9]{40}$/.test(addr)) return { usd: 0, has: false };
    const [prices, chains] = await Promise.all([
      (typeof gwOcFetchPrices === 'function' ? gwOcFetchPrices() : Promise.resolve({ USDT: 1, USDC: 1 })),
      (typeof gwOcFetchAllChains === 'function' ? gwOcFetchAllChains(addr) : Promise.resolve([])),
    ]);
    let usd = 0;
    let chainsWithBalance = 0;
    for (const c of chains) {
      if (!c.data) continue;
      let chainUsd = 0;
      if (c.data.nativeEth != null && c.data.nativeEth > 0.0000001) {
        chainUsd += c.data.nativeEth * (prices[c.meta.native] || 0);
      }
      for (const [sym, amt] of Object.entries(c.data.tokens || {})) {
        if (!(amt > 0.0001)) continue;
        chainUsd += amt * (prices[sym] || 0);
      }
      if (chainUsd > 0.01) { usd += chainUsd; chainsWithBalance++; }
    }
    return { usd, has: true, chainsN: chainsWithBalance };
  } catch (_) { return { usd: 0, has: false }; }
}
/**
 * Cached wrapper. Returns { val, fresh } — val is either the fresh
 * result or the last cached one; fresh:false means "the caller can
 * expect a background refresh to complete and should re-render then".
 */
async function _mpCached(kind) {
  const now = Date.now();
  const c = GW_MP_CACHE[kind];
  if (c && (now - c.at) < GW_MP_TTL) return { val: c.val, fresh: true };
  // Cache miss / stale. Deduplicate in-flight requests.
  if (!GW_MP_INFLIGHT[kind]) {
    const fn = kind === 'custodial' ? _mpCustodialRaw : _mpOnchainRaw;
    GW_MP_INFLIGHT[kind] = fn().then((v) => {
      GW_MP_CACHE[kind] = { at: Date.now(), val: v };
      _gwMpPersist();
      GW_MP_INFLIGHT[kind] = null;
      return v;
    }, (e) => { GW_MP_INFLIGHT[kind] = null; throw e; });
  }
  if (c) {
    // Return stale immediately, let the caller re-render when fresh arrives.
    GW_MP_INFLIGHT[kind].then(() => { try { gwRenderMetaPortfolio(); } catch (_) {} });
    return { val: c.val, fresh: false };
  }
  return { val: await GW_MP_INFLIGHT[kind], fresh: true };
}
async function gwMpFetchCustodial() { return (await _mpCached('custodial')).val; }
async function gwMpFetchOnchain()   { return (await _mpCached('onchain')).val; }
async function gwMpFetchPredict() {
  // v1: check Cursor's global predict state. If none, return zero.
  try {
    const st = window.gromPredictState || window.__gromPredictPositions;
    if (Array.isArray(st) && st.length) {
      const usd = st.reduce((a, p) => a + (Number(p.usd || p.value) || 0), 0);
      return { usd, has: true, positionsN: st.length };
    }
  } catch (_) {}
  return { usd: 0, has: false };
}
async function gwMpFetchXstocks() {
  // v1: check Cursor's xStocks state. If none, return zero.
  try {
    const st = window.gromXstocksState || window.__gromXstocksPositions;
    if (Array.isArray(st) && st.length) {
      const usd = st.reduce((a, p) => a + (Number(p.usd || p.value) || 0), 0);
      return { usd, has: true, positionsN: st.length };
    }
  } catch (_) {}
  return { usd: 0, has: false };
}

const GW_MP_TR = {
  ru: { eyebrow: 'МЕТА-ПОРТФЕЛЬ', badge: 'ALL-IN-ONE', sub: 'Всё что у тебя есть в GROM — в одном месте', c1: 'Торговый счёт', c2: 'On-chain', c3: 'Прогнозы', c4: 'Акции', assets: 'активов', chains: 'сетей', posN: 'позиций', empty: 'Пока пусто — подключи кошелёк или пополни счёт', a1: 'Пополнить', a2: 'Свап', a3: 'Обновить', loading: 'Загружаем портфель…' },
  en: { eyebrow: 'META-PORTFOLIO', badge: 'ALL-IN-ONE', sub: 'Everything you own on GROM — in one place', c1: 'Trading account', c2: 'On-chain', c3: 'Predictions', c4: 'Stocks', assets: 'assets', chains: 'chains', posN: 'positions', empty: "Nothing yet — connect a wallet or top up", a1: 'Deposit', a2: 'Swap', a3: 'Refresh', loading: 'Loading portfolio…' },
  es: { eyebrow: 'META-PORTFOLIO', badge: 'ALL-IN-ONE', sub: 'Todo lo tuyo en GROM — en un lugar', c1: 'Cuenta trading', c2: 'On-chain', c3: 'Predicciones', c4: 'Acciones', assets: 'activos', chains: 'cadenas', posN: 'posiciones', empty: 'Nada aún — conecta una cartera', a1: 'Depositar', a2: 'Swap', a3: 'Refrescar', loading: 'Cargando…' },
  ar: { eyebrow: 'المحفظة الشاملة', badge: 'كل شيء', sub: 'كل ما تملك في GROM في مكان واحد', c1: 'حساب التداول', c2: 'على السلسلة', c3: 'التنبؤات', c4: 'الأسهم', assets: 'أصول', chains: 'شبكات', posN: 'مراكز', empty: 'لا شيء بعد', a1: 'إيداع', a2: 'مبادلة', a3: 'تحديث', loading: 'جارٍ التحميل…' },
  zh: { eyebrow: '组合总览', badge: '一站式', sub: '你在 GROM 的一切，尽在此处', c1: '交易账户', c2: '链上', c3: '预测', c4: '股票', assets: '资产', chains: '链', posN: '仓位', empty: '暂无', a1: '充值', a2: '兑换', a3: '刷新', loading: '加载中…' },
  hi: { eyebrow: 'मेटा-पोर्टफोलियो', badge: 'सब एक साथ', sub: 'GROM पर आपका सब कुछ — एक जगह', c1: 'ट्रेडिंग खाता', c2: 'ऑन-चेन', c3: 'भविष्यवाणी', c4: 'स्टॉक्स', assets: 'एसेट्स', chains: 'चेन्स', posN: 'पदों', empty: 'अभी कुछ नहीं', a1: 'जमा', a2: 'स्वैप', a3: 'रीफ्रेश', loading: 'लोड हो रहा है…' },
  tr: { eyebrow: 'META-PORTFÖY', badge: 'HEP BİR ARADA', sub: "GROM'daki her şey — tek yerde", c1: 'İşlem hesabı', c2: 'Zincir üzeri', c3: 'Tahminler', c4: 'Hisseler', assets: 'varlık', chains: 'ağ', posN: 'pozisyon', empty: 'Henüz bir şey yok', a1: 'Yatır', a2: 'Swap', a3: 'Yenile', loading: 'Yükleniyor…' },
};
function gwMpLang() {
  let lang = 'en';
  try {
    const stored = localStorage.getItem('grom_lang');
    if (stored && GW_MP_TR[stored]) lang = stored;
    else { const nav = (navigator.language || '').toLowerCase(); for (const c of Object.keys(GW_MP_TR)) if (nav.indexOf(c) === 0) { lang = c; break; } }
  } catch (_) {}
  return GW_MP_TR[lang] || GW_MP_TR.en;
}

function gwFmtUsd(n) {
  const v = Number(n) || 0;
  if (v >= 1000) return '$' + v.toLocaleString('en-US', { maximumFractionDigits: 0 });
  return '$' + v.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

async function gwRenderMetaPortfolio() {
  const page = document.getElementById('page-dashboard');
  if (!page) return;
  gwInjectMetaPortfolioCss();
  let wrap = document.getElementById('gwMetaPortfolio');
  const t = gwMpLang();
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.className = 'gw-mp-wrap';
    wrap.id = 'gwMetaPortfolio';
    // Insert BEFORE swap panel (or at top of dash)
    const swap = page.querySelector('.gw-ds-wrap');
    if (swap) swap.before(wrap);
    else {
      const banners = page.querySelector('.dash-banners-wrap');
      if (banners) banners.after(wrap);
      else page.prepend(wrap);
    }
  }

  // Ensure the `.gw-mp-card` shell always exists so the async
  // Promise.all below can safely find it via `wrap.querySelector`.
  // If we have cached values we skip the loading strip so no "…" flash
  // is shown between reload and the cached-value repaint on line ~2200.
  // Regression fix for d4af91e (2026-07-07): previously we skipped the
  // whole skeleton when cache was present, but `wrap` was still empty
  // on first render → wrap.querySelector('.gw-mp-card') === null →
  // TypeError. Users saw a blank slot where Meta-Portfolio used to be.
  if (!wrap.querySelector('.gw-mp-card')) {
    const anyCache = !!(GW_MP_CACHE.custodial || GW_MP_CACHE.onchain);
    wrap.innerHTML = `
      <div class="gw-mp-card">
        <div class="gw-mp-head">
          <div>
            <p class="gw-mp-eyebrow">${t.eyebrow}</p>
            <p class="gw-mp-total">…</p>
            <p class="gw-mp-sub">${t.sub}</p>
          </div>
          <span class="gw-mp-badge">${t.badge}</span>
        </div>
        ${anyCache ? '' : `<div class="gw-mp-loading">${t.loading}</div>`}
      </div>
    `;
  }

  const [cust, onch, pred, xst] = await Promise.all([
    gwMpFetchCustodial(), gwMpFetchOnchain(), gwMpFetchPredict(), gwMpFetchXstocks(),
  ]);
  const total = cust.usd + onch.usd + pred.usd + xst.usd;

  const barSpan = (cls, usd, color) => total > 0
    ? `<span style="width:${(usd / total * 100).toFixed(2)}%;background:${color}"></span>`
    : '';
  const cat = (cls, lbl, usd, sub) => `
    <div class="gw-mp-cat ${cls}">
      <div class="gw-mp-cat-lbl"><span class="dot"></span>${lbl}</div>
      <div class="gw-mp-cat-val">${gwFmtUsd(usd)}</div>
      <div class="gw-mp-cat-sub">${sub}</div>
    </div>
  `;

  const isEmpty = total < 0.01;
  wrap.querySelector('.gw-mp-card').innerHTML = `
    <div class="gw-mp-head">
      <div>
        <p class="gw-mp-eyebrow">${t.eyebrow}</p>
        <p class="gw-mp-total">${gwFmtUsd(total)}</p>
        <p class="gw-mp-sub">${isEmpty ? t.empty : t.sub}</p>
      </div>
      <span class="gw-mp-badge">${t.badge}</span>
    </div>
    ${isEmpty ? '' : `<div class="gw-mp-bar">
      ${barSpan('custodial', cust.usd, '#00c2ff')}
      ${barSpan('onchain',   onch.usd, '#22c17c')}
      ${barSpan('predict',   pred.usd, '#a855f7')}
      ${barSpan('xstocks',   xst.usd,  '#f5b94d')}
    </div>`}
    ${isEmpty ? '' : `<div class="gw-mp-cats">
      ${cat('custodial', t.c1, cust.usd, cust.assetsN ? `${cust.assetsN} ${t.assets}` : '—')}
      ${cat('onchain',   t.c2, onch.usd, onch.chainsN ? `${onch.chainsN} ${t.chains}` : '—')}
      ${cat('predict',   t.c3, pred.usd, pred.positionsN ? `${pred.positionsN} ${t.posN}` : '—')}
      ${cat('xstocks',   t.c4, xst.usd,  xst.positionsN ? `${xst.positionsN} ${t.posN}` : '—')}
    </div>`}
    <div class="gw-mp-actions">
      <button class="gw-mp-btn primary" id="gwMpDeposit">+ ${t.a1}</button>
      ${isEmpty ? '' : `<button class="gw-mp-btn" id="gwMpSwap">${t.a2}</button>`}
      <button class="gw-mp-btn" id="gwMpRefresh">↻ ${t.a3}</button>
    </div>
  `;
  document.getElementById('gwMpDeposit')?.addEventListener('click', () => {
    if (typeof window.openWalletModal === 'function') window.openWalletModal('deposit');
  });
  document.getElementById('gwMpSwap')?.addEventListener('click', () => {
    document.querySelector('.gw-ds-wrap')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  document.getElementById('gwMpRefresh')?.addEventListener('click', gwRenderMetaPortfolio);
}

/* Debounce helper — protects against runaway loops where a MutationObserver
 * callback triggers a DOM change that triggers the observer again. Trailing
 * edge, so we always render at least once after the burst settles. */
function gwDebounce(fn, ms) {
  let t = null;
  return function () {
    const ctx = this, args = arguments;
    clearTimeout(t);
    t = setTimeout(() => { fn.apply(ctx, args); }, ms);
  };
}
function gwSetupMetaPortfolio() {
  const tryRender = gwDebounce(() => { if (document.getElementById('page-dashboard')) { try { gwRenderMetaPortfolio(); console.log('[GROM] meta-portfolio rendered'); } catch (e) { console.warn('[GROM] meta-portfolio', e); } } }, 200);
  window.addEventListener('grom:lang-change', () => { const el = document.getElementById('gwMetaPortfolio'); if (el) el.remove(); tryRender(); });
  tryRender();
  // Retry poll: dashboard element may appear after this init runs (Cursor SPA)
  let n = 0; const id = setInterval(() => { n++; if (document.getElementById('gwMetaPortfolio') || n >= 20) clearInterval(id); else tryRender(); }, 500);
  window.addEventListener('hashchange', tryRender);
  window.addEventListener('storage', (e) => { if (e.key === 'grom_jwt' || e.key === 'grom_wallet_label') tryRender(); });
  document.addEventListener('grom:wallet-connected', tryRender);
  document.addEventListener('grom:wallet-disconnected', tryRender);
  const bodyObs = new MutationObserver(() => tryRender());
  bodyObs.observe(document.body, { attributes: true, subtree: false, attributeFilter: ['data-page'] });
  // Auto-refresh every 60s while dashboard is visible
  setInterval(() => {
    const dash = document.getElementById('page-dashboard');
    if (dash && dash.offsetParent !== null) gwRenderMetaPortfolio();
  }, 60000);
}

function gwInjectConnectModalCss() {
  if (document.getElementById('gw-connect-modal-fixups')) return;
  const css = `
    .cn-list button.cn-row[onclick*="Other wallet"] { display: none !important; }
  `;
  const style = document.createElement('style');
  style.id = 'gw-connect-modal-fixups';
  style.textContent = css;
  document.head.appendChild(style);
}

/* =============================================================================
 * AUTH GATE — pages that require sign-in
 *
 * User feedback (2026-06-22): don't show an inline overlay on the Referral
 * page; instead, when an anonymous user tries to open a "private" page
 * (Referrals · Wallet · History · Settings), open the existing Connect modal
 * and send them back to the dashboard so they don't see stale demo content.
 *
 * Public pages (landing, dashboard, spot, futures, binary, markets,
 * predictions, stocks) stay open for browsing so investors can audit the UX
 * before signing up.
 * ============================================================================ */
const GW_GATED_PAGES = ['referral', 'wallet', 'history', 'settings'];

function gwIsAuthed() {
  try { return !!localStorage.getItem('grom_jwt'); } catch (e) { return false; }
}

function gwOpenSignIn() {
  // Case 1 — wallet already connected (WC pairing done) but JWT missing
  // (user cancelled SIWE prompt). Re-trigger SIWE straight away instead of
  // opening the Connect modal. Cursor's openConnectModal shortcut in this
  // state falls into openWalletModal('deposit'), which is why Wallet / Referral
  // clicks were popping a Deposit modal.
  const addr = (function () {
    try { if (window.gromWallet?.state?.().account) return window.gromWallet.state().account; } catch (_) {}
    try { if (window.ethereum?.selectedAddress) return window.ethereum.selectedAddress; } catch (_) {}
    return null;
  })();
  const authed = (function () {
    try { return !!localStorage.getItem('grom_jwt'); } catch (e) { return false; }
  })();
  if (addr && !authed) {
    // Prefer whatever provider we already have wired up (WC or window.ethereum).
    let provider = window.ethereum;
    try { if (window.gromWallet?.wcProvider?.accounts?.[0]) provider = window.gromWallet.wcProvider; } catch (_) {}
    if (provider) {
      // Fire and forget — SIWE handler shows its own toast on reject.
      (async () => {
        try { await window.gromWallet?.signSiweAndVerify?.(addr, provider); } catch (_) {}
      })();
      return;
    }
  }

  // Case 2 — no wallet, no JWT. Open Cursor's Connect modal DIRECTLY (skip
  // Cursor's openConnectModal wrapper — that wrapper redirects to Deposit
  // when GROM_CONN.connected is true, which happens if a WC session
  // survived from a previous visit but the JWT expired).
  const modal = document.getElementById('connectModal');
  if (modal) {
    modal.classList.add('open');
    return;
  }
  // Fallbacks — Cursor's helper, then the visible Sign-in button.
  if (typeof window.openConnectModal === 'function') {
    try { window.openConnectModal(); return; } catch (e) {}
  }
  const btn = Array.from(document.querySelectorAll('button, a')).find((el) => {
    const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
    return /^(Sign in|Log in|Войти|Войти\s*\/\s*Регистрация|Iniciar sesión|登录|Giriş|دخول)/i.test(t);
  });
  if (btn) btn.click();
}

function gwGateCurrentPage() {
  if (gwIsAuthed()) return false;
  const hash = (location.hash || '').replace(/^#/, '').split('?')[0];
  if (!GW_GATED_PAGES.includes(hash)) return false;
  // Switch route back to dashboard BEFORE opening the modal so when the user
  // closes it they don't land on the gated page with stale data.
  if (location.hash !== '#dashboard') history.replaceState(null, '', '#dashboard');
  if (typeof window.show === 'function') { try { window.show('dashboard'); } catch (_) {} }
  setTimeout(gwOpenSignIn, 80);
  return true;
}

function gwSetupAuthGate() {
  gwGateCurrentPage();
  window.addEventListener('hashchange', gwGateCurrentPage);
  // Intercept sidebar nav-item clicks while anonymous so the user gets the
  // login flow on click, not a page flicker.
  document.addEventListener('click', (e) => {
    if (gwIsAuthed()) return;
    const item = e.target.closest('aside.sidebar .nav-item[data-page]');
    if (!item) return;
    if (!GW_GATED_PAGES.includes(item.dataset.page)) return;
    e.preventDefault();
    e.stopPropagation();
    if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
    gwOpenSignIn();
  }, true);
  // Other tabs: re-evaluate when JWT changes.
  window.addEventListener('storage', (e) => { if (e.key === 'grom_jwt') gwGateCurrentPage(); });
  // First 20 s: re-check (Privy OAuth callback writes JWT asynchronously).
  let ticks = 0;
  const id = setInterval(() => {
    ticks++;
    if (gwIsAuthed()) { gwGateCurrentPage(); clearInterval(id); return; }
    if (ticks >= 20) clearInterval(id);
  }, 1000);
}

/* =============================================================================
 * Hide widgets the user no longer wants on the live site:
 *   • "New to GROM? · 90-second tour" sidebar card
 *   • "Take the tour" quick-action button on the dashboard
 *   • Any qa-grid button whose onclick references startTour
 * Pure CSS — never touches Cursor's index.html. */
function gwInjectMiscOverridesCss() {
  if (document.getElementById('gw-misc-overrides')) return;
  const css = `
    aside.sidebar .sidebar-footer { display: none !important; }
    .qa-grid .qa[onclick*="startTour"] { display: none !important; }
    /* Mobile deposit modal: full-height + safe scroll + safe-area padding so
     * the "Deposit" title never sits under the iOS status bar / notch. */
    @media (max-width: 700px) {
      .wm-overlay .wm {
        max-height: 100vh !important;
        max-height: 100dvh !important;
        height: 100dvh !important;
        border-radius: 0 !important;
        margin: 0 !important;
        padding-top: max(env(safe-area-inset-top, 0px), 8px) !important;
        padding-bottom: max(env(safe-area-inset-bottom, 0px), 8px) !important;
        overflow-y: auto !important;
        -webkit-overflow-scrolling: touch !important;
      }
      /* The Continue button sits at the bottom of the modal — reserve room
       * so the last coin row isn't hidden under it. */
      .wm-overlay .dep-flow { padding-bottom: 80px !important; }
      .wm-overlay .dep-continue-btn,
      .wm-overlay button[onclick*="gromDepGoNetwork"],
      .wm-overlay button[onclick*="gromDepGoAddress"] {
        position: sticky !important;
        bottom: max(env(safe-area-inset-bottom, 0px), 12px) !important;
        z-index: 20 !important;
        margin: 12px 0 0 !important;
      }
    }
  `;
  const style = document.createElement('style');
  style.id = 'gw-misc-overrides';
  style.textContent = css;
  document.head.appendChild(style);
}

/* =============================================================================
 * DASHBOARD SWAP PANEL — premium glass card injected into #page-dashboard.
 *
 * Reuses backend `/api/swap/convert/quote` + `/api/swap/convert/accept`
 * (already powering the wallet modal swap). When an anonymous user clicks
 * "Swap", the auth-gate kicks in and opens the Connect modal.
 *
 * Local DOM IDs are prefixed `gwds-` to never collide with the wallet
 * modal's `wmSwap*` inputs. */
const GW_DS_ASSETS = [
  { sym: 'USDT', name: 'Tether' },
  { sym: 'USDC', name: 'USD Coin' },
  { sym: 'BTC',  name: 'Bitcoin' },
  { sym: 'ETH',  name: 'Ethereum' },
  { sym: 'BNB',  name: 'BNB' },
  { sym: 'SOL',  name: 'Solana' },
  { sym: 'XRP',  name: 'Ripple' },
  { sym: 'TRX',  name: 'Tron' },
  { sym: 'DOGE', name: 'Dogecoin' },
  { sym: 'ADA',  name: 'Cardano' },
  { sym: 'AVAX', name: 'Avalanche' },
  { sym: 'MATIC',name: 'Polygon' },
  { sym: 'DOT',  name: 'Polkadot' },
  { sym: 'LINK', name: 'Chainlink' },
  { sym: 'ATOM', name: 'Cosmos' },
  { sym: 'LTC',  name: 'Litecoin' },
  { sym: 'UNI',  name: 'Uniswap' },
  { sym: 'SHIB', name: 'Shiba Inu' },
  { sym: 'NEAR', name: 'NEAR' },
  { sym: 'APT',  name: 'Aptos' },
  { sym: 'ARB',  name: 'Arbitrum' },
  { sym: 'OP',   name: 'Optimism' },
  { sym: 'INJ',  name: 'Injective' },
  { sym: 'TIA',  name: 'Celestia' },
  { sym: 'SUI',  name: 'Sui' },
  { sym: 'ETC',  name: 'Ethereum Classic' },
  { sym: 'FIL',  name: 'Filecoin' },
  { sym: 'BCH',  name: 'Bitcoin Cash' },
  { sym: 'ALGO', name: 'Algorand' },
  { sym: 'XLM',  name: 'Stellar' },
  { sym: 'PEPE', name: 'Pepe' },
  { sym: 'FLOKI',name: 'Floki' },
];

const GW_DS_TR = {
  ru: { h: 'Мгновенный своп', sub: 'Мгновенный обмен · лучшая ставка · без комиссий сети.', from: 'ОТДАЁШЬ', to: 'ПОЛУЧАЕШЬ', est: 'Введи сумму, чтобы увидеть курс.', cta: 'Сделать своп', ctaOc: 'Свап через кошелёк', ctaLogin: 'Войди чтобы свопать', getting: 'Запрос курса…', bal: 'Баланс', modeT: 'Торговый счёт', modeO: 'On-chain кошелёк', slip: 'Slippage', route: 'Маршрут', priceImpact: 'Влияние на цену', fee: 'Комиссия GROM', recent: 'Недавние свопы', success: 'Своп выполнен', flip: 'Поменять местами', pct25: '25%', pct50: '50%', pct75: '75%', pctMax: 'MAX' },
  en: { h: 'Instant swap',    sub: 'Instant swaps · best rate · zero network fees.', from: 'YOU PAY', to: 'YOU GET', est: 'Enter an amount to see the live rate.', cta: 'Swap now', ctaOc: 'Swap via wallet', ctaLogin: 'Sign in to swap', getting: 'Fetching rate…', bal: 'Balance', modeT: 'Trading account', modeO: 'On-chain wallet', slip: 'Slippage', route: 'Route', priceImpact: 'Price impact', fee: 'GROM fee', recent: 'Recent swaps', success: 'Swap complete', flip: 'Flip', pct25: '25%', pct50: '50%', pct75: '75%', pctMax: 'MAX' },
  es: { h: 'Swap instantáneo', sub: 'Swaps al instante · mejor tasa · sin comisiones de red.', from: 'PAGAS', to: 'RECIBES', est: 'Introduce un importe para ver el tipo en vivo.', cta: 'Hacer swap', ctaOc: 'Swap con cartera', ctaLogin: 'Inicia sesión', getting: 'Obteniendo…', bal: 'Saldo', modeT: 'Cuenta trading', modeO: 'Cartera on-chain', slip: 'Slippage', route: 'Ruta', priceImpact: 'Impacto', fee: 'Comisión GROM', recent: 'Swaps recientes', success: 'Swap completado', flip: 'Voltear', pct25: '25%', pct50: '50%', pct75: '75%', pctMax: 'MÁX' },
  ar: { h: 'مبادلة فوريّة', sub: 'مبادلات فوريّة · أفضل سعر · بدون رسوم شبكة.', from: 'تدفع', to: 'تستلم', est: 'أدخل المبلغ لرؤية السعر.', cta: 'مبادلة', ctaOc: 'المبادلة عبر المحفظة', ctaLogin: 'سجّل الدخول', getting: 'جلب السعر…', bal: 'الرصيد', modeT: 'حساب التداول', modeO: 'محفظة على السلسلة', slip: 'الانزلاق', route: 'المسار', priceImpact: 'أثر السعر', fee: 'رسوم GROM', recent: 'مبادلات حديثة', success: 'تمّت المبادلة', flip: 'تبديل', pct25: '25%', pct50: '50%', pct75: '75%', pctMax: 'الحد' },
  zh: { h: '极速兑换',       sub: '秒级兑换 · 最佳价格 · 零网络费。', from: '你支付', to: '你得到', est: '输入金额以查看实时汇率。', cta: '立即兑换', ctaOc: '通过钱包兑换', ctaLogin: '请先登录', getting: '获取报价…', bal: '余额', modeT: '交易账户', modeO: '链上钱包', slip: '滑点', route: '路径', priceImpact: '价格影响', fee: 'GROM 手续费', recent: '最近兑换', success: '兑换完成', flip: '交换', pct25: '25%', pct50: '50%', pct75: '75%', pctMax: '最大' },
  hi: { h: 'इंस्टेंट स्वैप',    sub: 'तुरंत स्वैप · बेहतरीन दर · ज़ीरो नेटवर्क फ़ी।', from: 'आप देते हैं', to: 'आप पाते हैं', est: 'दर देखने के लिए राशि दर्ज करें।', cta: 'अभी स्वैप', ctaOc: 'वॉलेट से स्वैप', ctaLogin: 'साइन इन करें', getting: 'दर ली जा रही है…', bal: 'बैलेंस', modeT: 'ट्रेडिंग खाता', modeO: 'ऑन-चेन वॉलेट', slip: 'स्लिपेज', route: 'रूट', priceImpact: 'मूल्य प्रभाव', fee: 'GROM फ़ी', recent: 'हाल के स्वैप', success: 'स्वैप पूरा', flip: 'फ्लिप', pct25: '25%', pct50: '50%', pct75: '75%', pctMax: 'मैक्स' },
  tr: { h: 'Anlık swap',      sub: 'Anlık swap · en iyi kur · sıfır ağ ücreti.', from: 'VERDİĞİN', to: 'ALDIĞIN', est: 'Canlı kuru görmek için tutar gir.', cta: 'Swap yap', ctaOc: 'Cüzdanla swap', ctaLogin: 'Giriş yap', getting: 'Kur çekiliyor…', bal: 'Bakiye', modeT: 'İşlem hesabı', modeO: 'Zincir üzeri cüzdan', slip: 'Slippage', route: 'Rota', priceImpact: 'Fiyat etkisi', fee: 'GROM ücreti', recent: 'Son swaplar', success: 'Swap tamamlandı', flip: 'Ters çevir', pct25: '25%', pct50: '50%', pct75: '75%', pctMax: 'MAKS' },
};

function gwDsLang() {
  let lang = 'en';
  try {
    const stored = localStorage.getItem('grom_lang');
    if (stored && GW_DS_TR[stored]) lang = stored;
    else {
      const nav = (navigator.language || '').toLowerCase();
      for (const code of Object.keys(GW_DS_TR)) if (nav.indexOf(code) === 0) { lang = code; break; }
    }
  } catch (e) {}
  return GW_DS_TR[lang] || GW_DS_TR.en;
}

function gwInjectDashSwapCss() {
  if (document.getElementById('gw-ds-css')) return;
  const css = `
    .gw-ds-wrap { margin: 14px 0 6px; }
    .gw-ds-card {
      position: relative; isolation: isolate;
      padding: 22px 22px 20px; border-radius: 24px;
      background:
        radial-gradient(120% 140% at 0% 0%, rgba(0,194,255,0.10), transparent 55%),
        radial-gradient(80% 100% at 100% 0%, rgba(168,85,247,0.08), transparent 55%),
        linear-gradient(160deg, rgba(13,22,38,0.72) 0%, rgba(8,14,26,0.92) 100%);
      border: 1px solid rgba(255,255,255,0.08);
      box-shadow: 0 1px 0 rgba(255,255,255,0.06) inset, 0 16px 42px -20px rgba(0,0,0,0.55);
      backdrop-filter: blur(14px) saturate(150%);
      -webkit-backdrop-filter: blur(14px) saturate(150%);
      overflow: hidden; color: #e7eef8;
    }
    .gw-ds-card::before {
      content: ""; position: absolute; inset: -2px;
      padding: 1.5px; border-radius: inherit;
      background: conic-gradient(from 0deg, #00c2ff 0%, transparent 25%, #a855f7 50%, transparent 75%, #00c2ff 100%);
      -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
              mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
      -webkit-mask-composite: xor; mask-composite: exclude;
      opacity: 0.55; animation: gwBnSpin 20s linear infinite;
      pointer-events: none; z-index: 0;
    }

    .gw-ds-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 14px; position: relative; z-index: 1; margin-bottom: 12px; }
    .gw-ds-title { font-size: 20px; font-weight: 800; letter-spacing: -0.02em; margin: 0 0 4px;
      background: linear-gradient(180deg,#fff,#c7d8ec); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
      display: inline-flex; align-items: center; gap: 8px; }
    .gw-ds-sub { font-size: 12.5px; color: #98a8c0; line-height: 1.55; margin: 0; max-width: 480px; }
    .gw-ds-badge { display: inline-flex; align-items: center; gap: 6px; background: rgba(0,194,255,0.15); color: #3ac2ff; padding: 5px 10px; border-radius: 999px; font-size: 10px; font-weight: 800; letter-spacing: .14em; align-self: center; border: 1px solid rgba(0,194,255,0.25); }
    .gw-ds-badge::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: #22c17c; box-shadow: 0 0 8px #22c17c; animation: gwDsDot 1.6s ease-in-out infinite; }
    @keyframes gwDsDot { 50% { opacity: 0.35; } }

    /* Mode toggle */
    .gw-ds-modes { position: relative; z-index: 1; display: grid; grid-template-columns: 1fr 1fr; gap: 4px; padding: 4px; border-radius: 12px;
      background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06); margin-bottom: 12px; }
    .gw-ds-mode { padding: 9px 8px; border: 0; border-radius: 9px; background: transparent; color: #98a8c0; font-weight: 700; font-size: 12.5px; cursor: pointer; transition: all .2s; letter-spacing: 0; }
    .gw-ds-mode:hover { color: #e7eef8; }
    .gw-ds-mode.on { background: linear-gradient(135deg, rgba(0,194,255,0.2), rgba(110,141,255,0.14)); color: #3ac2ff; box-shadow: 0 1px 0 rgba(255,255,255,0.06) inset; }

    .gw-ds-form { position: relative; z-index: 1; display: flex; flex-direction: column; gap: 6px; }

    .gw-ds-row { padding: 14px 14px 12px; border-radius: 16px;
      background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);
      transition: border-color .2s, background .2s; }
    .gw-ds-row:focus-within { border-color: rgba(0,194,255,0.35); background: rgba(255,255,255,0.04); }
    .gw-ds-row-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; font-size: 10.5px; letter-spacing: .16em; color: #6b7a92; font-weight: 800; }
    .gw-ds-row-bal { color: #98a8c0; text-transform: none; letter-spacing: 0; font-size: 11px; font-weight: 600; }
    .gw-ds-row-bal.clickable { cursor: pointer; }
    .gw-ds-row-bal.clickable:hover { color: #3ac2ff; }
    .gw-ds-row-main { display: flex; align-items: center; gap: 10px; }
    .gw-ds-select { flex: 0 0 auto; }
    .gw-ds-select select {
      background: rgba(255,255,255,0.06); color: #e7eef8;
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 12px; padding: 10px 30px 10px 12px;
      font-family: inherit; font-size: 14px; font-weight: 800;
      outline: none; -webkit-appearance: none; appearance: none;
      background-image: linear-gradient(45deg, transparent 50%, #8aa0bc 50%), linear-gradient(135deg, #8aa0bc 50%, transparent 50%);
      background-position: calc(100% - 14px) center, calc(100% - 9px) center;
      background-size: 5px 5px, 5px 5px; background-repeat: no-repeat;
      min-width: 130px;
    }
    .gw-ds-amt { flex: 1; min-width: 0; }
    .gw-ds-amt input {
      width: 100%; background: transparent; color: #fff;
      border: 0; padding: 6px 0; text-align: right;
      font-family: inherit; font-size: 22px; font-weight: 800;
      font-variant-numeric: tabular-nums; outline: none;
    }
    .gw-ds-amt input::placeholder { color: #4a5a75; }
    .gw-ds-usd { text-align: right; font-size: 11px; color: #6b7a92; margin-top: 4px; font-variant-numeric: tabular-nums; }

    /* Percentage chips row */
    .gw-ds-chips { display: flex; gap: 6px; margin-top: 8px; }
    .gw-ds-chip { flex: 1; padding: 6px 8px; border-radius: 8px; background: rgba(255,255,255,0.04); color: #98a8c0; border: 1px solid rgba(255,255,255,0.06); font-size: 11px; font-weight: 800; letter-spacing: .04em; cursor: pointer; transition: all .15s; }
    .gw-ds-chip:hover { background: rgba(255,255,255,0.08); color: #e7eef8; }
    .gw-ds-chip.max { background: linear-gradient(135deg, rgba(0,194,255,0.15), rgba(110,141,255,0.10)); color: #3ac2ff; border-color: rgba(0,194,255,0.25); }

    /* Flip button */
    .gw-ds-flip-wrap { display: flex; justify-content: center; margin: -2px 0; z-index: 2; }
    .gw-ds-flip {
      width: 38px; height: 38px;
      display: inline-flex; align-items: center; justify-content: center;
      border-radius: 50%; border: 2px solid rgba(13,22,38,1);
      background: linear-gradient(135deg, #00c2ff, #6e8dff);
      color: #001624; cursor: pointer;
      font-size: 16px; font-weight: 900;
      transition: transform .3s cubic-bezier(.2,.7,.2,1), box-shadow .2s;
      box-shadow: 0 4px 12px -2px rgba(0,194,255,0.4);
    }
    .gw-ds-flip:hover { transform: rotate(180deg) scale(1.05); box-shadow: 0 6px 16px -2px rgba(0,194,255,0.6); }
    .gw-ds-flip:active { transform: rotate(180deg) scale(0.95); }

    /* Route info panel */
    .gw-ds-route { position: relative; z-index: 1; margin-top: 10px; padding: 12px 14px; border-radius: 12px;
      background: rgba(255,255,255,0.025); border: 1px solid rgba(255,255,255,0.05);
      display: grid; grid-template-columns: 1fr 1fr; gap: 6px 14px; font-size: 12px; }
    .gw-ds-route .k { color: #6b7a92; font-weight: 600; }
    .gw-ds-route .v { color: #cfdfee; text-align: right; font-weight: 700; font-variant-numeric: tabular-nums; }
    .gw-ds-route .full { grid-column: 1 / -1; }
    .gw-ds-route.warn { border-color: rgba(245,185,77,0.25); background: rgba(245,185,77,0.05); }
    .gw-ds-route.warn .v { color: #f5b94d; }
    .gw-ds-route.err { border-color: rgba(239,68,68,0.25); background: rgba(239,68,68,0.05); }
    .gw-ds-route.err .v { color: #f87171; }

    .gw-ds-cta {
      margin-top: 12px; width: 100%;
      padding: 15px 18px; border-radius: 14px; border: 0;
      background: linear-gradient(135deg, #00c2ff, #6e8dff);
      color: #001624; font-weight: 800; font-size: 15px; letter-spacing: .02em;
      cursor: pointer;
      box-shadow: 0 10px 28px -10px rgba(0,194,255,0.55);
      transition: transform .2s, box-shadow .2s, opacity .2s, filter .2s;
      position: relative; z-index: 1;
    }
    .gw-ds-cta:hover { transform: translateY(-1px); box-shadow: 0 14px 34px -10px rgba(0,194,255,0.75); }
    .gw-ds-cta:active { transform: translateY(0); }
    .gw-ds-cta[disabled] { opacity: 0.55; cursor: not-allowed; filter: grayscale(20%); }
    .gw-ds-cta.busy { pointer-events: none; opacity: 0.8; }
    .gw-ds-cta.busy::after { content: ""; position: absolute; inset: 0; border-radius: inherit; background: linear-gradient(90deg, transparent 30%, rgba(255,255,255,0.35) 50%, transparent 70%); background-size: 200% 100%; animation: gwDsShine 1.4s linear infinite; }
    @keyframes gwDsShine { to { background-position: -200% 0; } }

    /* Recent swaps */
    .gw-ds-recent { position: relative; z-index: 1; margin-top: 14px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.06); }
    .gw-ds-recent-title { font-size: 10.5px; letter-spacing: .16em; color: #6b7a92; font-weight: 800; margin-bottom: 8px; }
    .gw-ds-recent-list { display: flex; flex-direction: column; gap: 6px; }
    .gw-ds-recent-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 10px; border-radius: 8px; background: rgba(255,255,255,0.02); font-size: 12px; }
    .gw-ds-recent-row .r-pair { color: #cfdfee; font-weight: 700; font-variant-numeric: tabular-nums; }
    .gw-ds-recent-row .r-time { color: #6b7a92; font-size: 10.5px; }

    /* Success flash */
    .gw-ds-toast {
      position: fixed; bottom: 90px; left: 50%; transform: translateX(-50%);
      padding: 14px 20px; border-radius: 12px;
      background: linear-gradient(135deg, rgba(34,193,124,0.95), rgba(14,203,129,0.9));
      color: #001a0d; font-weight: 800; font-size: 13.5px;
      box-shadow: 0 12px 32px -8px rgba(34,193,124,0.5);
      z-index: 200; animation: gwDsPop .35s cubic-bezier(.2,.7,.2,1) both;
    }
    @keyframes gwDsPop { from { opacity: 0; transform: translate(-50%, 20px); } to { opacity: 1; transform: translate(-50%, 0); } }

    @media (max-width: 600px) {
      .gw-ds-card { padding: 18px 16px 16px; border-radius: 20px; }
      .gw-ds-title { font-size: 18px; }
      .gw-ds-sub { font-size: 12px; }
      .gw-ds-select select { min-width: 110px; font-size: 13.5px; padding: 9px 26px 9px 10px; }
      .gw-ds-amt input { font-size: 20px; }
      .gw-ds-chip { font-size: 10.5px; padding: 6px 4px; }
      .gw-ds-cta { padding: 14px 16px; font-size: 14.5px; }
    }
  `;
  const style = document.createElement('style');
  style.id = 'gw-ds-css';
  style.textContent = css;
  document.head.appendChild(style);
}

/* Persistent user prefs — mode ('paper' | 'onchain') and recent swap list.
 *
 * Auto-pick: if the user has a connected wallet (WC/injected) but no JWT
 * (SIWE not completed) we default to 'onchain' — that's the only mode that
 * can actually spend their tokens. Otherwise use whatever they last picked. */
function gwDsGetMode() {
  try {
    const stored = localStorage.getItem('gw_ds_mode');
    if (stored === 'paper' || stored === 'onchain') return stored;
  } catch (_) {}
  // First-visit default
  let hasWallet = false;
  try { hasWallet = !!(window.gromWallet?.state?.().account); } catch (_) {}
  const authed = (function () {
    try { return !!localStorage.getItem('grom_jwt'); } catch (e) { return false; }
  })();
  return (hasWallet && !authed) ? 'onchain' : 'paper';
}
function gwDsSetMode(m) { try { localStorage.setItem('gw_ds_mode', m); } catch (_) {} }
function gwDsGetRecent() { try { return JSON.parse(localStorage.getItem('gw_ds_recent') || '[]'); } catch (_) { return []; } }
function gwDsPushRecent(entry) {
  try {
    const list = gwDsGetRecent();
    list.unshift({ ...entry, ts: Date.now() });
    localStorage.setItem('gw_ds_recent', JSON.stringify(list.slice(0, 5)));
  } catch (_) {}
}
function gwDsTimeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return s + 's';
  const m = Math.floor(s / 60);
  if (m < 60) return m + 'm';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h';
  return Math.floor(h / 24) + 'd';
}

function gwDsBuildPanel() {
  const t = gwDsLang();
  const mode = gwDsGetMode();
  const optionsFor = (selectedSym) => GW_DS_ASSETS
    .map((a) => `<option value="${a.sym}" ${a.sym === selectedSym ? 'selected' : ''}>${a.sym} · ${a.name}</option>`)
    .join('');
  const recent = gwDsGetRecent();
  const recentHtml = recent.length ? `
    <div class="gw-ds-recent">
      <div class="gw-ds-recent-title">${t.recent}</div>
      <div class="gw-ds-recent-list">
        ${recent.map((r) => `
          <div class="gw-ds-recent-row">
            <span class="r-pair">${r.amt} ${r.from} → ${r.out} ${r.to}</span>
            <span class="r-time">${gwDsTimeAgo(r.ts)} · ${r.mode === 'onchain' ? '🔗' : '⚡'}</span>
          </div>
        `).join('')}
      </div>
    </div>
  ` : '';
  const wrap = document.createElement('div');
  wrap.className = 'gw-ds-wrap';
  wrap.innerHTML = `
    <div class="gw-ds-card" id="gwDsCard">
      <div class="gw-ds-head">
        <div>
          <h3 class="gw-ds-title">⚡ ${t.h}</h3>
          <p class="gw-ds-sub">${t.sub}</p>
        </div>
        <span class="gw-ds-badge">LIVE</span>
      </div>
      <div class="gw-ds-modes" role="tablist">
        <button type="button" class="gw-ds-mode ${mode === 'paper' ? 'on' : ''}" data-mode="paper">${t.modeT}</button>
        <button type="button" class="gw-ds-mode ${mode === 'onchain' ? 'on' : ''}" data-mode="onchain">${t.modeO}</button>
      </div>
      <div class="gw-ds-form">
        <div class="gw-ds-row">
          <div class="gw-ds-row-top">
            <span>${t.from}</span>
            <span class="gw-ds-row-bal" id="gwDsBalFrom"></span>
          </div>
          <div class="gw-ds-row-main">
            <div class="gw-ds-select">
              <select id="gwDsFrom">${optionsFor('USDT')}</select>
            </div>
            <div class="gw-ds-amt">
              <input id="gwDsAmt" type="number" min="0" step="any" inputmode="decimal" placeholder="0.00" />
            </div>
          </div>
          <div class="gw-ds-usd" id="gwDsAmtUsd"></div>
          <div class="gw-ds-chips">
            <button type="button" class="gw-ds-chip" data-pct="25">${t.pct25}</button>
            <button type="button" class="gw-ds-chip" data-pct="50">${t.pct50}</button>
            <button type="button" class="gw-ds-chip" data-pct="75">${t.pct75}</button>
            <button type="button" class="gw-ds-chip max" data-pct="100">${t.pctMax}</button>
          </div>
        </div>
        <div class="gw-ds-flip-wrap">
          <button type="button" class="gw-ds-flip" id="gwDsFlip" aria-label="${t.flip}">⇅</button>
        </div>
        <div class="gw-ds-row">
          <div class="gw-ds-row-top">
            <span>${t.to}</span>
            <span class="gw-ds-row-bal" id="gwDsBalTo"></span>
          </div>
          <div class="gw-ds-row-main">
            <div class="gw-ds-select">
              <select id="gwDsTo">${optionsFor('BTC')}</select>
            </div>
            <div class="gw-ds-amt">
              <input id="gwDsOut" type="text" readonly placeholder="0.00" />
            </div>
          </div>
          <div class="gw-ds-usd" id="gwDsOutUsd"></div>
        </div>
        <div class="gw-ds-route" id="gwDsRoute">
          <span class="k full" id="gwDsRateLine">${t.est}</span>
        </div>
        <button type="button" class="gw-ds-cta" id="gwDsCta">${t.cta} →</button>
      </div>
      ${recentHtml}
    </div>
  `;
  return wrap;
}

/* Small in-memory price cache for USD values of the 32 assets (Binance ticker) */
const gwDsPriceCache = new Map();  // sym -> { price, at }
async function gwDsPriceUsd(sym) {
  if (sym === 'USDT' || sym === 'USDC') return 1;
  const cached = gwDsPriceCache.get(sym);
  if (cached && Date.now() - cached.at < 20000) return cached.price;
  try {
    const r = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${sym}USDT`);
    if (!r.ok) return 0;
    const j = await r.json();
    const p = Number(j.price) || 0;
    gwDsPriceCache.set(sym, { price: p, at: Date.now() });
    return p;
  } catch (_) { return 0; }
}

/* Estimate "how much of FROM does the user have available" for the % chips.
 *   paper mode  → postgres balance via cursor's window.__gromWalletOverview
 *   onchain     → the sum of the connected wallet's balance for this token
 *                 across supported EVM chains (gromFetchOnchainBalances). */
async function gwDsAvailableAmount(sym) {
  const mode = gwDsGetMode();
  if (mode === 'paper') {
    try {
      const ov = window.__gromWalletOverview;
      const asset = ov?.summary?.assets?.find((a) => (a.asset || '').toUpperCase() === sym);
      if (asset) return Number(asset.amount) || 0;
    } catch (_) {}
    return 0;
  }
  // on-chain: sum across chains
  try {
    const addr = (function () {
      try { return window.gromWallet?.state?.().account; } catch (_) { return null; }
    })();
    if (!addr || !/^0x[a-fA-F0-9]{40}$/.test(addr)) return 0;
    const chains = [1, 42161, 137, 8453, 56];
    let total = 0;
    for (const c of chains) {
      const b = await window.gromFetchOnchainBalances?.(addr, c).catch(() => null);
      if (!b) continue;
      if (sym === 'ETH' && b.nativeEth) total += Number(b.nativeEth);
      else if (sym === 'BNB' && c === 56 && b.nativeEth) total += Number(b.nativeEth);
      else if (b.tokens && b.tokens[sym] != null) total += Number(b.tokens[sym]);
    }
    return total;
  } catch (_) { return 0; }
}

let gwDsQuoteAbort = null;
let gwDsQuoteTimer = null;
async function gwDsRefreshRate() {
  const t = gwDsLang();
  const routeEl = document.getElementById('gwDsRoute');
  const outEl   = document.getElementById('gwDsOut');
  const rateLine = document.getElementById('gwDsRateLine');
  const amtUsd = document.getElementById('gwDsAmtUsd');
  const outUsd = document.getElementById('gwDsOutUsd');
  if (!routeEl || !outEl || !rateLine) return;
  routeEl.className = 'gw-ds-route';

  const from = document.getElementById('gwDsFrom')?.value || 'USDT';
  const to   = document.getElementById('gwDsTo')?.value   || 'BTC';
  const amt  = Number(document.getElementById('gwDsAmt')?.value || 0);
  const mode = gwDsGetMode();

  // Refresh available balances shown above each field
  gwDsRefreshBalances().catch(() => {});

  if (amt <= 0) {
    outEl.value = '';
    if (amtUsd) amtUsd.textContent = '';
    if (outUsd) outUsd.textContent = '';
    rateLine.textContent = t.est;
    return;
  }
  if (from === to) {
    routeEl.className = 'gw-ds-route warn';
    rateLine.textContent = '⚠ ' + (from === to ? 'Choose different assets' : '');
    outEl.value = '';
    return;
  }

  // Live USD label under "You pay"
  gwDsPriceUsd(from).then((p) => { if (amtUsd) amtUsd.textContent = p ? '≈ $' + (amt * p).toLocaleString('en-US', { maximumFractionDigits: 2 }) : ''; });

  rateLine.textContent = t.getting;
  try {
    if (gwDsQuoteAbort) gwDsQuoteAbort.abort();
    gwDsQuoteAbort = new AbortController();
    // Both modes use the same paper-quote endpoint for pricing; on-chain
    // execution goes via 1inch in gwDsSubmit — the quote here is still an
    // accurate mid-market estimate.
    const jwt = localStorage.getItem('grom_jwt');
    const headers = { 'Content-Type': 'application/json' };
    if (jwt) headers.Authorization = `Bearer ${jwt}`;
    const r = await fetch('/api/swap/convert/quote', {
      method: 'POST', headers, signal: gwDsQuoteAbort.signal,
      body: JSON.stringify({ from, to, fromAmount: amt }),
    });
    const q = await r.json();
    if (q.error) {
      // Fall back to Binance ticker cross-rate if paper backend is unhappy
      const [pf, pt] = await Promise.all([gwDsPriceUsd(from), gwDsPriceUsd(to)]);
      if (pf && pt) {
        const est = (amt * pf) / pt;
        outEl.value = Number(est.toFixed(8));
        rateLine.textContent = `1 ${from} ≈ ${(pf / pt).toFixed(6)} ${to}`;
      } else {
        routeEl.className = 'gw-ds-route warn';
        rateLine.textContent = q.error;
        outEl.value = '';
      }
      return;
    }
    outEl.value = q.toAmount;
    // Rich route info
    const rateStr = Number(q.ratio).toFixed(8).replace(/0+$/, '').replace(/\.$/, '');
    routeEl.innerHTML = `
      <span class="k">${t.route}</span><span class="v">${mode === 'paper' ? 'GROM Convert' : '1inch aggregator'}</span>
      <span class="k">${t.fee}</span><span class="v">${q.feePct != null ? q.feePct + '%' : '0.10%'}</span>
      <span class="k">${t.slip}</span><span class="v">${mode === 'paper' ? '—' : '0.5%'}</span>
      <span class="k full" id="gwDsRateLine">1 ${from} ≈ ${rateStr} ${to}</span>
    `;
    if (outUsd) gwDsPriceUsd(to).then((p) => { outUsd.textContent = p ? '≈ $' + (Number(q.toAmount) * p).toLocaleString('en-US', { maximumFractionDigits: 2 }) : ''; });
  } catch (e) {
    if (e.name === 'AbortError') return;
    routeEl.className = 'gw-ds-route err';
    rateLine.textContent = 'Rate unavailable';
  }
}

async function gwDsRefreshBalances() {
  const from = document.getElementById('gwDsFrom')?.value;
  const to   = document.getElementById('gwDsTo')?.value;
  const bFrom = document.getElementById('gwDsBalFrom');
  const bTo   = document.getElementById('gwDsBalTo');
  if (bFrom && from) {
    const v = await gwDsAvailableAmount(from);
    bFrom.classList.toggle('clickable', v > 0);
    bFrom.textContent = v > 0 ? `${gwDsLang().bal}: ${Number(v).toFixed(6).replace(/0+$/, '').replace(/\.$/, '')} ${from}` : '';
  }
  if (bTo && to) {
    const v = await gwDsAvailableAmount(to);
    bTo.textContent = v > 0 ? `${gwDsLang().bal}: ${Number(v).toFixed(6).replace(/0+$/, '').replace(/\.$/, '')} ${to}` : '';
  }
}

/* ============================================================================
 * INLINE ON-CHAIN SWAP — no external tabs, direct wallet signing.
 *
 * Chain 56 (BSC) → PancakeSwap V2 router (0x10ED4…4E)
 * Chain 1  (ETH) → Uniswap V2 router      (0x7a250…88D)
 * Others         → throw 'unsupported' so caller can fall back to 1inch tab.
 *
 * We hand-encode ABI calls to avoid pulling ethers.js at load time. The
 * encoded selectors + parameter layout come straight from the standard
 * UniswapV2Router02 interface (swapExactETHForTokens / swapExactTokensForETH /
 * swapExactTokensForTokens + getAmountsOut). ERC-20 approve is checked and
 * granted with MaxUint256 to avoid re-approvals on subsequent swaps.
 *
 * Slippage: 0.5% (hard-coded, matches DEX aggregator defaults). */
/* Every EVM chain we support has its native V2-style DEX router. Uniswap-V2
 * ABI is essentially identical across all of these (swapExactETHForTokens,
 * getAmountsOut, approve(MaxUint256)), so the same hand-encoded calldata
 * works for every one — we only differ in router address, wrapped-native
 * address and token addresses. */
const GW_OC_SWAP = {
  1: { // Ethereum · Uniswap V2
    router: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
    native: 'ETH',
    wrapped: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    dexName: 'Uniswap V2',
    tokens: {
      USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      USDC: '0xA0b86991c6218b36c1D19d4a2e9EB0cE3606eB48',
      DAI:  '0x6B175474E89094C44Da98b954EedeAC495271d0F',
      WBTC: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
      LINK: '0x514910771AF9Ca656af840dff83E8264EcF986CA',
      UNI:  '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
      SHIB: '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE',
      PEPE: '0x6982508145454Ce325dDbE47a25d4ec3d2311933',
    },
    decimals: { ETH: 18, USDT: 6, USDC: 6, DAI: 18, WBTC: 8, LINK: 18, UNI: 18, SHIB: 18, PEPE: 18 },
  },
  56: { // BSC · PancakeSwap V2
    router: '0x10ED43C718714eb63d5aA57B78B54704E256024E',
    native: 'BNB',
    wrapped: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
    dexName: 'PancakeSwap V2',
    tokens: {
      USDT: '0x55d398326f99059fF775485246999027B3197955',
      USDC: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
      BUSD: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
      ETH:  '0x2170Ed0880ac9A755fd29B2688956BD959F933F8',
      BTC:  '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c',
      CAKE: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82',
      DOGE: '0xbA2aE424d960c26247Dd6c32edC70B295c744C43',
      ADA:  '0x3EE2200Efb3400fAbB9AacF31297cBdD1d435D47',
      SHIB: '0x2859e4544C4bB03966803b044A93563Bd2D0DD4D',
    },
    decimals: { BNB: 18, USDT: 18, USDC: 18, BUSD: 18, ETH: 18, BTC: 18, CAKE: 18, DOGE: 8, ADA: 18, SHIB: 18 },
  },
  42161: { // Arbitrum · SushiSwap V2
    router: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506',
    native: 'ETH',
    wrapped: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
    dexName: 'SushiSwap',
    tokens: {
      USDT: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
      USDC: '0xaf88d065e77c8cC2239327C0EDb1A48022fCcC7',
      DAI:  '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
      WBTC: '0x2f2a2543B76A4166549F7aaBB2cF6eB5C76A4166549F7aa',
      ARB:  '0x912CE59144191C1204E64559FE8253a0e49E6548',
      LINK: '0xf97f4df75117a78c1A5a0DBb814Af92458539FB4',
    },
    decimals: { ETH: 18, USDT: 6, USDC: 6, DAI: 18, WBTC: 8, ARB: 18, LINK: 18 },
  },
  137: { // Polygon · QuickSwap V2
    router: '0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff',
    native: 'MATIC',
    wrapped: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
    dexName: 'QuickSwap',
    tokens: {
      USDT: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
      USDC: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
      DAI:  '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
      WBTC: '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6',
      WETH: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
    },
    decimals: { MATIC: 18, USDT: 6, USDC: 6, DAI: 18, WBTC: 8, WETH: 18 },
  },
  10: { // Optimism · Velodrome V2 (Solidly-style, V2-compatible for basic pairs)
    router: '0x9c12939390052919aF3155f41Bf4160Fd3666A6f',
    native: 'ETH',
    wrapped: '0x4200000000000000000000000000000000000006',
    dexName: 'Velodrome',
    tokens: {
      USDT: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
      USDC: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
      DAI:  '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
      OP:   '0x4200000000000000000000000000000000000042',
    },
    decimals: { ETH: 18, USDT: 6, USDC: 6, DAI: 18, OP: 18 },
  },
  8453: { // Base · BaseSwap
    router: '0x327Df1E6de05895d2ab08513aaDD9313Fe505d86',
    native: 'ETH',
    wrapped: '0x4200000000000000000000000000000000000006',
    dexName: 'BaseSwap',
    tokens: {
      USDC: '0x833589fCD6eDb6E08f4c7C32D6f7b9bD686120e',
      DAI:  '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
    },
    decimals: { ETH: 18, USDC: 6, DAI: 18 },
  },
  43114: { // Avalanche · TraderJoe V2
    router: '0x60aE616a2155Ee3d9A68541Ba4544862310933d4',
    native: 'AVAX',
    wrapped: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7',
    dexName: 'TraderJoe',
    tokens: {
      USDT: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7',
      USDC: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
      DAI:  '0xd586E7F844cEa2F87f50152665BCbc2C279D8d70',
      WETH: '0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB',
      WBTC: '0x50b7545627a5162F82A992c33b87aDc75187B218',
    },
    decimals: { AVAX: 18, USDT: 6, USDC: 6, DAI: 18, WETH: 18, WBTC: 8 },
  },
};

/* ----- minimal ABI encoders ----- */
function gwHex(n) { return BigInt(n).toString(16); }
function gwPad32(hex) { return hex.replace(/^0x/, '').padStart(64, '0'); }
function gwUint256(n) { return gwPad32(gwHex(n)); }
function gwAddr(a) { return gwPad32(a.toLowerCase().replace(/^0x/, '')); }
function gwEncodeAddrArray(arr, base) {
  // address[] as a dynamic parameter, starting at offset `base`
  let out = gwUint256(arr.length);
  for (const a of arr) out += gwAddr(a);
  return out;
}

/* Call read-only method (eth_call) and parse a single uint256 (or array). */
async function gwEthCall(provider, to, data) {
  const raw = await provider.request({ method: 'eth_call', params: [{ to, data }, 'latest'] });
  return raw;
}

/* getAmountsOut(uint256 amountIn, address[] path) -> uint256[] */
async function gwGetAmountsOut(provider, router, amountIn, path) {
  const selector = '0xd06ca61f';
  // Params: uint256 amountIn, uint256 offset_to_path (0x40), then dynamic array
  const data = selector
    + gwUint256(amountIn)
    + gwUint256(0x40)
    + gwEncodeAddrArray(path, 0);
  const raw = await gwEthCall(provider, router, data);
  // Parse array: skip head (0x20 offset), read length, then N * 32 bytes
  const hex = raw.replace(/^0x/, '');
  const arrayLen = parseInt(hex.slice(64, 128), 16);
  const outs = [];
  for (let i = 0; i < arrayLen; i++) {
    const start = 128 + i * 64;
    outs.push(BigInt('0x' + hex.slice(start, start + 64)));
  }
  return outs;
}

/* ERC-20 allowance(owner, spender) -> uint256 */
async function gwErc20Allowance(provider, token, owner, spender) {
  const data = '0xdd62ed3e' + gwAddr(owner) + gwAddr(spender);
  const raw = await gwEthCall(provider, token, data);
  return BigInt(raw || '0x0');
}

/* Send: ERC-20 approve(spender, MaxUint256). Waits for receipt. */
async function gwErc20ApproveMax(provider, token, spender, from) {
  const MAX = 'f'.repeat(64);
  const data = '0x095ea7b3' + gwAddr(spender) + MAX;
  const hash = await provider.request({
    method: 'eth_sendTransaction',
    params: [{ from, to: token, data, value: '0x0' }],
  });
  await gwWaitReceipt(provider, hash);
  return hash;
}

async function gwWaitReceipt(provider, hash, timeoutMs = 90000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await provider.request({ method: 'eth_getTransactionReceipt', params: [hash] });
      if (r && r.status) return r;
    } catch (_) {}
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error('Transaction timed out — check your wallet');
}

/* Ensure the wallet is on the correct chain. If not, prompt to switch. */
async function gwEnsureChain(provider, targetChainId) {
  const current = parseInt(await provider.request({ method: 'eth_chainId' }), 16);
  if (current === targetChainId) return;
  const hex = '0x' + targetChainId.toString(16);
  try {
    await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: hex }] });
  } catch (_) {
    throw new Error(`Please switch your wallet to chain ${targetChainId}`);
  }
}

async function gwOnChainSwapExec(fromSym, toSym, amtNum) {
  const provider = (window.gromWallet?.wcProvider && window.gromWallet.wcProvider.accounts?.[0])
    ? window.gromWallet.wcProvider
    : window.ethereum;
  if (!provider) throw new Error('No wallet provider');
  const [account] = await provider.request({ method: 'eth_accounts' });
  if (!account) throw new Error('Wallet not connected');
  const chainId = parseInt(await provider.request({ method: 'eth_chainId' }), 16);
  const cfg = GW_OC_SWAP[chainId];
  if (!cfg) throw new Error(`unsupported — chain ${chainId}. Switch your wallet to Ethereum, BSC, Arbitrum, Polygon, Optimism, Base or Avalanche.`);
  const dexLabel = cfg.dexName || 'DEX';
  // Resolve token addresses
  const tokenAddr = (s) => s === cfg.native ? cfg.wrapped : cfg.tokens[s];
  const inAddr  = tokenAddr(fromSym);
  const outAddr = tokenAddr(toSym);
  if (!inAddr)  throw new Error(`unsupported — ${fromSym} not available on this chain`);
  if (!outAddr) throw new Error(`unsupported — ${toSym} not available on this chain`);
  const inDec  = cfg.decimals[fromSym] ?? 18;
  const outDec = cfg.decimals[toSym]   ?? 18;
  const amountIn = BigInt(Math.floor(amtNum * 10 ** inDec));
  const path = [inAddr, outAddr];
  // Read expected out & compute minOut (0.5% slippage)
  const outs = await gwGetAmountsOut(provider, cfg.router, amountIn.toString(), path);
  const expected = outs[outs.length - 1];
  const minOut = (expected * 995n) / 1000n;
  const deadline = Math.floor(Date.now() / 1000) + 20 * 60;

  gwToast(`Confirm in wallet · ${dexLabel} · expecting ~${(Number(expected) / 10 ** outDec).toFixed(6)} ${toSym}`, 'info');

  let tx;
  if (fromSym === cfg.native) {
    // swapExactETHForTokens(minOut, path, to, deadline) — 0x7ff36ab5
    const data = '0x7ff36ab5'
      + gwUint256(minOut.toString())
      + gwUint256(0x80)   // offset to path
      + gwAddr(account)
      + gwUint256(deadline)
      + gwEncodeAddrArray(path, 0);
    tx = { from: account, to: cfg.router, data, value: '0x' + amountIn.toString(16) };
  } else if (toSym === cfg.native) {
    // Need approve
    const allow = await gwErc20Allowance(provider, inAddr, account, cfg.router);
    if (allow < amountIn) await gwErc20ApproveMax(provider, inAddr, cfg.router, account);
    // swapExactTokensForETH(amountIn, minOut, path, to, deadline) — 0x18cbafe5
    const data = '0x18cbafe5'
      + gwUint256(amountIn.toString())
      + gwUint256(minOut.toString())
      + gwUint256(0xa0)
      + gwAddr(account)
      + gwUint256(deadline)
      + gwEncodeAddrArray(path, 0);
    tx = { from: account, to: cfg.router, data, value: '0x0' };
  } else {
    // token-token: approve + swapExactTokensForTokens — 0x38ed1739
    const allow = await gwErc20Allowance(provider, inAddr, account, cfg.router);
    if (allow < amountIn) await gwErc20ApproveMax(provider, inAddr, cfg.router, account);
    const data = '0x38ed1739'
      + gwUint256(amountIn.toString())
      + gwUint256(minOut.toString())
      + gwUint256(0xa0)
      + gwAddr(account)
      + gwUint256(deadline)
      + gwEncodeAddrArray(path, 0);
    tx = { from: account, to: cfg.router, data, value: '0x0' };
  }

  const hash = await provider.request({ method: 'eth_sendTransaction', params: [tx] });
  gwToast('Submitted · waiting for confirmation…', 'info');
  await gwWaitReceipt(provider, hash);
  return hash;
}

function gwDsFlashSuccess(msg) {
  const t = document.createElement('div');
  t.className = 'gw-ds-toast';
  t.textContent = '✓ ' + msg;
  document.body.appendChild(t);
  setTimeout(() => { t.style.transition = 'opacity .35s'; t.style.opacity = '0'; }, 2400);
  setTimeout(() => { t.remove(); }, 2900);
}

async function gwDsSubmit() {
  const t = gwDsLang();
  const cta = document.getElementById('gwDsCta');
  const mode = gwDsGetMode();
  const from = document.getElementById('gwDsFrom')?.value || 'USDT';
  const to   = document.getElementById('gwDsTo')?.value   || 'BTC';
  const amt  = Number(document.getElementById('gwDsAmt')?.value || 0);
  if (amt <= 0) { gwToast('Enter an amount', 'warn'); return; }
  if (from === to) { gwToast('Choose different assets', 'warn'); return; }

  if (mode === 'onchain') {
    if (cta) cta.classList.add('busy');
    try {
      await gwOnChainSwapExec(from, to, amt);
      gwDsPushRecent({ from, to, amt, out: '≈ market', mode: 'onchain' });
      gwDsFlashSuccess(t.success);
      const amtEl = document.getElementById('gwDsAmt'); if (amtEl) amtEl.value = '';
      setTimeout(() => {
        const wrap = document.querySelector('.gw-ds-wrap');
        if (wrap) { wrap.remove(); gwInjectDashSwapPanel(); }
      }, 800);
    } catch (e) {
      // Graceful fallback: if inline path isn't supported for this pair/chain,
      // give the user the 1inch escape hatch instead of a dead-end error.
      const reason = String(e?.message || e || '').slice(0, 140);
      const label = /unsupported|not supported/i.test(reason)
        ? 'Inline swap not available for this pair on this chain — open 1inch?'
        : `Swap failed: ${reason}. Open 1inch instead?`;
      const goExt = confirm(label);
      if (goExt) {
        let chainId = 1;
        try { const s = window.gromWallet?.state?.(); if (s?.chainId) chainId = Number(s.chainId); } catch (_) {}
        window.open(`https://app.1inch.io/#/${chainId}/simple/swap/${from}/${to}`, '_blank', 'noopener,noreferrer');
      }
    } finally {
      if (cta) cta.classList.remove('busy');
    }
    return;
  }

  // paper (trading account) — needs JWT
  if (!gwIsAuthed()) { gwOpenSignIn(); return; }
  if (cta) cta.classList.add('busy');
  try {
    const jwt = localStorage.getItem('grom_jwt');
    const q = await fetch('/api/swap/convert/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
      body: JSON.stringify({ from, to, fromAmount: amt }),
    }).then((r) => r.json());
    if (q.error) throw new Error(q.error);
    const a = await fetch('/api/swap/convert/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
      body: JSON.stringify({ quoteId: q.quoteId }),
    }).then((r) => r.json());
    if (a.error) throw new Error(a.error);
    gwDsPushRecent({ from, to, amt, out: q.toAmount, mode: 'paper' });
    gwDsFlashSuccess(t.success + ': ' + amt + ' ' + from + ' → ' + q.toAmount + ' ' + to);
    // Refresh wallet slice + dashboard
    try { window.hydrateWalletSlice?.(true); } catch (_) {}
    // Wipe amount + re-render panel to show new recent list
    const amtEl = document.getElementById('gwDsAmt'); if (amtEl) amtEl.value = '';
    setTimeout(() => {
      const wrap = document.querySelector('.gw-ds-wrap');
      if (wrap) { wrap.remove(); gwInjectDashSwapPanel(); }
    }, 800);
  } catch (e) {
    gwToast(e?.message || 'Swap failed', 'error');
  } finally {
    if (cta) cta.classList.remove('busy');
  }
}

function gwInjectDashSwapPanel() {
  gwInjectDashSwapCss();
  const page = document.getElementById('page-dashboard');
  if (!page) return false;
  if (page.querySelector('.gw-ds-wrap')) return true; // already mounted
  // Insert AFTER the dash-banners section (or stats-grid) but before lower
  // content, so it's prominent above-the-fold.
  const banners = page.querySelector('.dash-banners-wrap, .dash-banners')?.closest('.dash-banners-wrap') || page.querySelector('.dash-banners-wrap');
  const stats   = page.querySelector('.stats-grid');
  const panel = gwDsBuildPanel();
  if (banners && banners.parentNode === page) banners.after(panel);
  else if (stats && stats.parentNode === page) stats.after(panel);
  else page.prepend(panel);
  // Wire events
  const flipBtn = document.getElementById('gwDsFlip');
  if (flipBtn) flipBtn.addEventListener('click', () => {
    const a = document.getElementById('gwDsFrom');
    const b = document.getElementById('gwDsTo');
    if (!a || !b) return;
    const tmp = a.value; a.value = b.value; b.value = tmp;
    gwDsRefreshRate();
  });
  ['gwDsFrom', 'gwDsTo', 'gwDsAmt'].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('change', () => {
      clearTimeout(gwDsQuoteTimer);
      gwDsQuoteTimer = setTimeout(gwDsRefreshRate, 250);
    });
    el.addEventListener('input', () => {
      clearTimeout(gwDsQuoteTimer);
      gwDsQuoteTimer = setTimeout(gwDsRefreshRate, 400);
    });
  });
  const cta = document.getElementById('gwDsCta');
  if (cta) cta.addEventListener('click', gwDsSubmit);
  // Mode toggle (Trading account ⇄ On-chain wallet) — persists to localStorage
  document.querySelectorAll('.gw-ds-mode').forEach((btn) => {
    btn.addEventListener('click', () => {
      const m = btn.dataset.mode;
      if (!m) return;
      gwDsSetMode(m);
      document.querySelectorAll('.gw-ds-mode').forEach((x) => x.classList.toggle('on', x.dataset.mode === m));
      // Update CTA label + rate route info
      const c = document.getElementById('gwDsCta');
      const t = gwDsLang();
      if (c) c.innerHTML = (m === 'onchain' ? t.ctaOc : t.cta) + ' →';
      gwDsRefreshRate();
    });
  });
  // Percentage chips (25/50/75/MAX) — fill amount from available balance.
  // If nothing available in the current mode, offer the other mode inline
  // instead of just a dead-end toast.
  document.querySelectorAll('.gw-ds-chip').forEach((chip) => {
    chip.addEventListener('click', async () => {
      const pct = Number(chip.dataset.pct);
      const from = document.getElementById('gwDsFrom')?.value || 'USDT';
      const avail = await gwDsAvailableAmount(from);
      if (avail <= 0) {
        const mode = gwDsGetMode();
        const other = mode === 'paper' ? 'onchain' : 'paper';
        // Peek at the other mode's balance so we can suggest specifically.
        const savedMode = mode;
        gwDsSetMode(other);
        const otherBal = await gwDsAvailableAmount(from);
        gwDsSetMode(savedMode); // don't actually switch yet, only propose
        if (otherBal > 0) {
          const otherName = other === 'paper' ? gwDsLang().modeT : gwDsLang().modeO;
          const ok = confirm(`No ${from} in "${mode === 'paper' ? gwDsLang().modeT : gwDsLang().modeO}".\n\nSwitch to "${otherName}" — you have ${Number(otherBal).toFixed(6).replace(/0+$/, '').replace(/\.$/, '')} ${from} there.`);
          if (ok) {
            const other2Btn = document.querySelector('.gw-ds-mode[data-mode="' + other + '"]');
            if (other2Btn) other2Btn.click();
            setTimeout(async () => {
              const amtEl = document.getElementById('gwDsAmt');
              if (amtEl) {
                amtEl.value = Number((otherBal * pct) / 100).toFixed(8).replace(/0+$/, '').replace(/\.$/, '');
                gwDsRefreshRate();
              }
            }, 60);
          }
        } else {
          gwToast('No ' + from + ' balance anywhere yet — deposit first', 'warn');
        }
        return;
      }
      const amtEl = document.getElementById('gwDsAmt');
      if (amtEl) {
        amtEl.value = Number((avail * pct) / 100).toFixed(8).replace(/0+$/, '').replace(/\.$/, '');
        gwDsRefreshRate();
      }
    });
  });
  // Also allow tapping the "Balance: 5.00 USDT" line to use MAX
  const balFrom = document.getElementById('gwDsBalFrom');
  if (balFrom) balFrom.addEventListener('click', async () => {
    const chip = document.querySelector('.gw-ds-chip.max');
    if (chip) chip.click();
  });
  // Set correct CTA label depending on mode
  const mode0 = gwDsGetMode();
  const t0 = gwDsLang();
  if (cta) cta.innerHTML = (mode0 === 'onchain' ? t0.ctaOc : t0.cta) + ' →';
  // Initial balance load
  gwDsRefreshBalances().catch(() => {});
  return true;
}

function gwSetupDashSwap() {
  if (!gwInjectDashSwapPanel()) {
    let tries = 0;
    const id = setInterval(() => {
      tries++;
      if (gwInjectDashSwapPanel() || tries >= 30) clearInterval(id);
    }, 1000);
  }

  /* Re-render whenever the user switches language. We watch three signals so
   * we don't miss any depending on how Cursor triggers the change:
   *   1. gromRefreshI18nPages hook (called by setLang in grom-i18n.js)
   *   2. MutationObserver on <html lang="…"> (setLang also sets that attr)
   *   3. `storage` event for `grom_lang` (cross-tab language change)
   * All three end up calling the same re-render, and the panel remembers the
   * user's current inputs (from/to/amount) via the DOM before wiping. */
  const rerenderPanel = () => {
    const wrap = document.querySelector('.gw-ds-wrap');
    if (!wrap) return;
    const from = document.getElementById('gwDsFrom')?.value;
    const to   = document.getElementById('gwDsTo')?.value;
    const amt  = document.getElementById('gwDsAmt')?.value;
    wrap.remove();
    gwInjectDashSwapPanel();
    if (from) { const el = document.getElementById('gwDsFrom'); if (el) el.value = from; }
    if (to)   { const el = document.getElementById('gwDsTo');   if (el) el.value = to; }
    if (amt)  { const el = document.getElementById('gwDsAmt');  if (el) el.value = amt; }
    if (amt) gwDsRefreshRate();
  };

  const prev = window.gromRefreshI18nPages;
  window.gromRefreshI18nPages = function () {
    try { if (typeof prev === 'function') prev.apply(this, arguments); } catch (_) {}
    rerenderPanel();
  };

  // Belt-and-suspenders: catch <html lang="…"> mutations too.
  try {
    const obs = new MutationObserver((muts) => {
      for (const m of muts) if (m.attributeName === 'lang') { rerenderPanel(); break; }
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  } catch (_) {}

  window.addEventListener('storage', (e) => { if (e.key === 'grom_lang') rerenderPanel(); });
}

/* ---------------------------------------------------------------------------
 * Premium dashboard banners (Spot · Binary · Futures · Predict)
 *
 * User asked for "the most beautiful banner design in the world" for both
 * desktop and mobile. Strategy: don't touch Cursor's index.html — override
 * his baseline `.dash-banner` styles with a much richer CSS layer:
 *
 *   • Rotating conic-gradient halo per banner (subtle aurora effect)
 *   • Glassmorphism inner panel (backdrop blur + saturate)
 *   • Holographic shimmer sweep on hover (long, slow, expensive-looking)
 *   • 3D hover lift with directional glow + scale
 *   • Pulsing icon ring + drop-shadow per accent colour
 *   • CTA pill with animated arrow
 *   • Mobile: full-width cards with snap scroll + bleed glow
 *
 * All rules are scoped to `.dash-banners .dash-banner.banner-*` so the rest
 * of the dashboard is untouched. Idempotent style id. Re-applies on hash
 * change in case Cursor re-mounts the banners. -------------------------- */
function gwInjectDashBannersCss() {
  if (document.getElementById('gw-dash-banners-premium')) return;
  const css = `
    /* ---------- container ---------- */
    .dash-banners {
      gap: 14px !important;
      padding: 4px 2px 18px !important;
      scroll-padding: 8px;
      scroll-snap-type: x mandatory;
      -webkit-mask-image: linear-gradient(90deg, transparent 0, #000 24px, #000 calc(100% - 24px), transparent 100%);
              mask-image: linear-gradient(90deg, transparent 0, #000 24px, #000 calc(100% - 24px), transparent 100%);
    }

    /* ---------- card frame ---------- */
    .dash-banners .dash-banner {
      position: relative !important;
      isolation: isolate;
      min-height: 188px !important;
      padding: 22px 22px 20px !important;
      border-radius: 22px !important;
      background:
        radial-gradient(120% 140% at 0% 0%, rgba(255,255,255,0.06), transparent 55%),
        linear-gradient(155deg, rgba(13,22,38,0.72) 0%, rgba(8,14,26,0.85) 100%) !important;
      border: 1px solid rgba(255,255,255,0.07) !important;
      box-shadow:
        0 1px 0 rgba(255,255,255,0.06) inset,
        0 14px 38px -18px rgba(0,0,0,0.55),
        0 0 0 1px rgba(255,255,255,0.02) inset !important;
      backdrop-filter: blur(14px) saturate(150%);
      -webkit-backdrop-filter: blur(14px) saturate(150%);
      overflow: hidden;
      cursor: pointer;
      transform-style: preserve-3d;
      transition:
        transform .55s cubic-bezier(.2,.7,.2,1),
        box-shadow .55s cubic-bezier(.2,.7,.2,1),
        border-color .35s ease;
      scroll-snap-align: start;
    }

    /* ---------- rotating aurora halo (::before) ---------- */
    .dash-banners .dash-banner::before {
      content: "";
      position: absolute; inset: -2px;
      border-radius: inherit;
      padding: 1.5px;
      background: conic-gradient(from 0deg,
        var(--gw-bn-a, #00c2ff) 0%,
        transparent 25%,
        var(--gw-bn-b, #6e8dff) 50%,
        transparent 75%,
        var(--gw-bn-a, #00c2ff) 100%);
      -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
              mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
      -webkit-mask-composite: xor;
              mask-composite: exclude;
      opacity: 0.7;
      animation: gwBnSpin 14s linear infinite;
      pointer-events: none;
      z-index: 0;
    }
    @keyframes gwBnSpin { to { transform: rotate(360deg); } }

    /* ---------- shimmering holographic sweep (::after) ---------- */
    .dash-banners .dash-banner::after {
      content: "";
      position: absolute; inset: 0;
      border-radius: inherit;
      background: linear-gradient(105deg,
        transparent 30%,
        rgba(255,255,255,0.07) 47%,
        rgba(255,255,255,0.18) 50%,
        rgba(255,255,255,0.07) 53%,
        transparent 70%);
      background-size: 220% 100%;
      background-position: -120% 0;
      pointer-events: none;
      z-index: 1;
      transition: background-position 1.2s cubic-bezier(.4,.0,.2,1);
    }
    .dash-banners .dash-banner:hover::after { background-position: 220% 0; }

    /* ---------- content stays above effects ---------- */
    .dash-banners .dash-banner .banner-mesh,
    .dash-banners .dash-banner .banner-shine,
    .dash-banners .dash-banner .banner-content,
    .dash-banners .dash-banner .banner-tag { position: relative; z-index: 2; }
    .dash-banners .dash-banner .banner-mesh { opacity: 0.75; mix-blend-mode: screen; }
    /* Disable Cursor's older shine layer — our ::after replaces it */
    .dash-banners .dash-banner .banner-shine { display: none !important; }

    /* ---------- hover lift ---------- */
    .dash-banners .dash-banner:hover {
      transform: translateY(-8px) scale(1.012) rotateX(2deg) rotateY(-2deg) !important;
      border-color: rgba(255,255,255,0.14) !important;
      box-shadow:
        0 1px 0 rgba(255,255,255,0.10) inset,
        0 26px 60px -22px var(--gw-bn-shadow, rgba(0,194,255,0.35)),
        0 0 0 1px rgba(255,255,255,0.04) inset !important;
    }

    /* ---------- icon: pulsing ring + drop shadow ---------- */
    .dash-banners .banner-ico {
      position: relative;
      width: 64px; height: 64px;
      display: flex; align-items: center; justify-content: center;
      font-size: 34px !important;
      border-radius: 18px;
      background: linear-gradient(135deg, rgba(255,255,255,0.10), rgba(255,255,255,0.02));
      border: 1px solid rgba(255,255,255,0.08);
      box-shadow:
        0 6px 18px -6px var(--gw-bn-shadow, rgba(0,194,255,0.45)),
        0 1px 0 rgba(255,255,255,0.08) inset;
      filter: drop-shadow(0 4px 18px var(--gw-bn-shadow, rgba(0,194,255,0.5))) !important;
    }
    .dash-banners .banner-ico::after {
      content: "";
      position: absolute; inset: -6px;
      border-radius: 22px;
      border: 1.5px solid var(--gw-bn-a, #00c2ff);
      opacity: 0;
      animation: gwBnPulse 2.4s ease-out infinite;
    }
    @keyframes gwBnPulse {
      0%   { opacity: 0.55; transform: scale(0.92); }
      70%  { opacity: 0;    transform: scale(1.18); }
      100% { opacity: 0;    transform: scale(1.18); }
    }

    /* ---------- typography ---------- */
    .dash-banners .banner-content {
      display: flex; align-items: flex-start; gap: 16px;
      height: 100%;
    }
    .dash-banners .banner-copy { display: flex; flex-direction: column; gap: 6px; flex: 1; min-width: 0; }
    .dash-banners .banner-eyebrow {
      font-size: 10.5px !important;
      letter-spacing: .24em !important;
      font-weight: 800 !important;
      opacity: .9;
    }
    .dash-banners .dash-banner h3 {
      font-size: 17.5px !important;
      font-weight: 800 !important;
      letter-spacing: -0.01em;
      line-height: 1.25 !important;
      margin: 2px 0 4px !important;
      color: #f3f8ff;
      background: linear-gradient(180deg, #ffffff 0%, #c7d8ec 100%);
      -webkit-background-clip: text;
              background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .dash-banners .dash-banner p {
      font-size: 12.5px !important;
      color: #98a8c0 !important;
      line-height: 1.5 !important;
      margin: 0 !important;
    }

    /* ---------- CTA pill ---------- */
    .dash-banners .banner-cta {
      margin-top: auto !important;
      display: inline-flex !important;
      align-items: center; gap: 6px;
      padding: 8px 14px !important;
      border-radius: 999px !important;
      background: linear-gradient(135deg,
        color-mix(in srgb, var(--gw-bn-a, #00c2ff) 22%, transparent),
        color-mix(in srgb, var(--gw-bn-b, #6e8dff) 12%, transparent));
      border: 1px solid color-mix(in srgb, var(--gw-bn-a, #00c2ff) 40%, transparent);
      color: var(--gw-bn-a, #00c2ff) !important;
      font-size: 12px !important;
      font-weight: 800 !important;
      letter-spacing: .04em;
      align-self: flex-start;
      transition: transform .25s, box-shadow .25s, background .25s;
    }
    .dash-banners .dash-banner:hover .banner-cta {
      transform: translateX(6px) !important;
      box-shadow: 0 8px 22px -8px var(--gw-bn-shadow, rgba(0,194,255,0.55));
    }

    /* ---------- tag pill ---------- */
    .dash-banners .banner-tag {
      position: absolute !important; top: 14px !important; right: 14px !important;
      padding: 4px 10px !important;
      border-radius: 999px !important;
      font-size: 9.5px !important;
      letter-spacing: .14em !important;
      font-weight: 900 !important;
      backdrop-filter: blur(6px);
      box-shadow: 0 6px 14px -6px rgba(0,0,0,0.55);
      z-index: 3;
    }
    .dash-banners .banner-tag::before {
      content: "";
      display: inline-block;
      width: 6px; height: 6px;
      border-radius: 50%;
      background: currentColor;
      margin-right: 6px;
      vertical-align: middle;
      animation: gwBnDot 1.6s ease-in-out infinite;
      box-shadow: 0 0 8px currentColor;
    }
    @keyframes gwBnDot { 50% { opacity: 0.35; } }

    /* ---------- per-banner accent palette (CSS vars) ---------- */
    .dash-banners .banner-spot    { --gw-bn-a: #00c2ff; --gw-bn-b: #6e8dff; --gw-bn-shadow: rgba(0,194,255,0.45); }
    .dash-banners .banner-binary  { --gw-bn-a: #22c17c; --gw-bn-b: #0ecb81; --gw-bn-shadow: rgba(34,193,124,0.40); }
    .dash-banners .banner-futures { --gw-bn-a: #f5b94d; --gw-bn-b: #ff8a3d; --gw-bn-shadow: rgba(245,185,77,0.42); }
    .dash-banners .banner-predict { --gw-bn-a: #c084fc; --gw-bn-b: #6e8dff; --gw-bn-shadow: rgba(168,85,247,0.46); }

    /* ---------- desktop sizing ---------- */
    @media (min-width: 900px) {
      .dash-banners { grid-template-columns: repeat(4, 1fr) !important; display: grid !important; gap: 16px !important; }
      .dash-banners .dash-banner { min-width: 0 !important; min-height: 210px !important; }
    }

    /* ---------- mobile polish ---------- */
    @media (max-width: 899px) {
      .dash-banners {
        display: flex !important;
        flex-wrap: nowrap !important;
        overflow-x: auto !important;
        padding: 6px 14px 22px !important;
        gap: 12px !important;
      }
      .dash-banners .dash-banner {
        flex: 0 0 84% !important;
        min-height: 168px !important;
        padding: 18px !important;
        border-radius: 20px !important;
      }
      .dash-banners .banner-ico { width: 54px; height: 54px; font-size: 28px !important; border-radius: 15px; }
      .dash-banners .dash-banner h3 { font-size: 15.5px !important; }
      .dash-banners .dash-banner p { font-size: 12px !important; }
      .dash-banners .banner-cta { padding: 7px 12px !important; font-size: 11.5px !important; }
      /* mobile: drop the heavy 3D tilt on hover (touch) */
      .dash-banners .dash-banner:hover {
        transform: translateY(-3px) !important;
      }
    }

    /* ---------- prefers-reduced-motion: stop the spinning halo & pulse ---------- */
    @media (prefers-reduced-motion: reduce) {
      .dash-banners .dash-banner::before,
      .dash-banners .banner-ico::after,
      .dash-banners .banner-tag::before { animation: none !important; }
      .dash-banners .dash-banner:hover { transform: translateY(-3px) !important; }
    }
  `;
  const style = document.createElement('style');
  style.id = 'gw-dash-banners-premium';
  style.textContent = css;
  document.head.appendChild(style);
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
  gwInjectConnectModalCss();
  // dash-banners CSS handled by <link rel="stylesheet" href="/grom-banners.css">
  // in index.html <head> — gwInjectDashBannersCss is kept only as a fallback
  // and runs from the top-level guard if the <link> didn't load.
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
/* PRE-DOMContentLoaded CSS injection — avoid FOUC on dashboard refresh.
 *
 * Cursor's baseline `.dash-banner` CSS lives in his index.html and paints
 * the moment the HTML reaches the browser. Our premium override lives in
 * gwInjectDashBannersCss, but if we wait for DOMContentLoaded to call it
 * the user sees ~150–400 ms of the old design first, then a sudden swap
 * (the "светящийся старый баннер" flash the user reported).
 *
 * Module scripts execute *before* DOMContentLoaded and we can talk to
 * `document.head` immediately (head parsing precedes body parsing). So we
 * inject the style synchronously at top-level — it lands in the cascade
 * before first paint in most engines, eliminating or drastically shrinking
 * the flash. Connect-modal CSS gets the same treatment for symmetry. */
try {
  if (document.head) {
    // dash-banners CSS now lives in /grom-banners.css and is pulled by a
    // <link rel="stylesheet"> in index.html <head> — that's the real
    // zero-flash path (link in head blocks first paint until CSS is ready).
    // We keep the function in this file as a runtime fallback, but only
    // inject if the <link> wasn't loaded for some reason.
    if (!document.querySelector('link[href*="grom-banners.css"]')) {
      gwInjectDashBannersCss();
    }
    gwInjectConnectModalCss();
    gwInjectTelegramFab();  // now legacy — just removes any stale FAB
    // Silence Chrome's "Open in MetaMask" protocol handler prompt.
    //
    // When Reown's WalletConnect modal generates a `wc:...` pairing URI,
    // parts of its flow will also try to navigate the parent window to
    // that URI (or open a new tab) in case the user has a desktop wallet
    // registered for the `wc:` protocol. Chrome sees MetaMask registered
    // that handler at extension install and pops an orange "Open in
    // MetaMask" bar — even when the user explicitly clicked "Trust".
    //
    // We can't unregister MetaMask's protocol handler, but we can stop
    // the JS from ever navigating to a `wc:` URI. The QR still displays
    // inside the modal, and the mobile scan flow works exactly as
    // before — only the desktop protocol-handler nag goes away.
    (function gwSilenceWcProtocolNav() {
      const isWc = (v) => typeof v === 'string' && /^wc:/i.test(v);
      try {
        const origOpen = window.open;
        window.open = function (u, ...a) { if (isWc(u)) { console.log('[GROM] blocked wc: open'); return null; } return origOpen.apply(this, [u, ...a]); };
      } catch (_) {}
      try {
        const origAssign  = Location.prototype.assign;
        const origReplace = Location.prototype.replace;
        Location.prototype.assign  = function (u) { if (isWc(u)) { console.log('[GROM] blocked wc: assign'); return; } return origAssign.call(this, u); };
        Location.prototype.replace = function (u) { if (isWc(u)) { console.log('[GROM] blocked wc: replace'); return; } return origReplace.call(this, u); };
      } catch (_) {}
      try {
        // location.href = 'wc:...' — proxy the setter on the Location
        // prototype. Some browsers don't allow reconfiguring the native
        // descriptor; on those we just skip and rely on the other paths.
        const desc = Object.getOwnPropertyDescriptor(Location.prototype, 'href')
                  || Object.getOwnPropertyDescriptor(window.location, 'href');
        if (desc && desc.configurable !== false && desc.set) {
          const origSet = desc.set;
          Object.defineProperty(Location.prototype, 'href', {
            configurable: true, enumerable: true,
            get: desc.get,
            set: function (u) { if (isWc(u)) { console.log('[GROM] blocked wc: href='); return; } return origSet.call(this, u); },
          });
        }
      } catch (_) {}
      // Anchor clicks — if any `<a href="wc:...">` is generated we cancel
      // the default so Chrome doesn't ask "Open in MetaMask?".
      document.addEventListener('click', (e) => {
        const a = e.target && e.target.closest && e.target.closest('a[href^="wc:"]');
        if (a) { e.preventDefault(); console.log('[GROM] blocked wc: link click'); }
      }, true);
    })();
    // Central language reactor — dispatches window event 'grom:lang-change'
    // when any of these signals fire:
    //   1. gromRefreshI18nPages hook (Cursor's setLang -> grom-i18n.js)
    //   2. <html lang="…"> attribute mutation
    //   3. `storage` event for grom_lang (cross-tab)
    //   4. Same-tab localStorage.setItem('grom_lang', ...) — we monkeypatch
    //      setItem so we don't miss same-tab language switches.
    (function gwLangReactor() {
      const fire = () => { try { window.dispatchEvent(new CustomEvent('grom:lang-change', { detail: { lang: localStorage.getItem('grom_lang') } })); } catch (_) {} };
      const prev = window.gromRefreshI18nPages;
      window.gromRefreshI18nPages = function () {
        try { if (typeof prev === 'function') prev.apply(this, arguments); } catch (_) {}
        fire();
      };
      try {
        const obs = new MutationObserver((muts) => { for (const m of muts) if (m.attributeName === 'lang') { fire(); break; } });
        obs.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
      } catch (_) {}
      window.addEventListener('storage', (e) => { if (e.key === 'grom_lang') fire(); });
      // Monkeypatch setItem so setLang() in the same tab still triggers us.
      try {
        const origSetItem = Storage.prototype.setItem;
        Storage.prototype.setItem = function (k, v) {
          const prev = k === 'grom_lang' ? this.getItem('grom_lang') : null;
          origSetItem.call(this, k, v);
          if (k === 'grom_lang' && v !== prev) fire();
        };
      } catch (_) {}
    })();
    // Each setup wrapped so one broken feature doesn't cascade-kill the
    // others (previous bug: gwSetupAiCoach threw → yield/airdrop/predict/
    // cross-margin never ran because they were sequential in the same try).
    //
    // Deferred with setTimeout(0) so const declarations that appear LATER
    // in the file (GW_AI_TR, GW_YL_TR, GW_AD_LIST, GW_AD_TR) are past the
    // temporal-dead-zone by the time these setups access them. Without the
    // defer, gwSetupAiCoach threw ReferenceError because it read GW_AI_TR
    // synchronously during module-eval, before its const initializer ran.
    const safe = (name, fn) => { try { fn(); } catch (e) { console.error('[GROM] setup failed:', name, e); } };
    setTimeout(() => {
      safe('miscOverridesCss', gwInjectMiscOverridesCss);
      safe('authGate',         gwSetupAuthGate);
      safe('dashSwap',         gwSetupDashSwap);
      safe('depositAutoCont',  gwSetupDepositAutoContinue);
      safe('onchainCard',      gwSetupOnchainCard);
      safe('metaPortfolio',    gwSetupMetaPortfolio);
      safe('aiCoach',          gwSetupAiCoach);
      safe('yield',            gwSetupYield);
      safe('airdrop',          gwSetupAirdrop);
      safe('predictArb',       gwSetupPredictArb);
      safe('crossMargin',      gwSetupCrossMargin);
      safe('prefetchWc',       gwPrefetchWc);
      safe('telegramHelp',     gwSetupTelegramHelpCard);
      safe('killDemoNums',     gwSetupKillDemoNumbers);
      safe('landingPolish',    gwSetupLandingPolish);
    }, 0);
  }
} catch (e) { console.error('[GROM] top-level init failed:', e); }

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', gwInitWalletModalOps);
} else {
  gwInitWalletModalOps();
}

/* =====================================================================
 * URL SYMBOL ROUTING (added 2026-06-15)
 *
 * Bug fix — Cursor's hash router ignores `?symbol=` query params, so
 * clicking Trade in #markets and landing on #futures?symbol=XRPUSDT
 * leaves the BTC header. We listen for hashchange and click the right
 * contract row in the sidebar after the page renders.
 *
 * NOTE: The "Прогнозы" / "Акции" pages and sidebar items used to live
 * here, but were taken over by Cursor in commit 647b0f0 with a far
 * more capable implementation (live prices, demo-balance trading,
 * real bet/trade mechanics) built directly into index.html. Per the
 * coexist rule, this file no longer touches that nav or those pages.
 * ==================================================================== */

function gwHandleSymbolFromHash() {
  const raw = location.hash || '';
  const qIdx = raw.indexOf('?');
  if (qIdx === -1) return;
  const qs = new URLSearchParams(raw.slice(qIdx + 1));
  const symbol = qs.get('symbol');
  if (!symbol) return;
  // Retry — the page may not have rendered the contracts list yet.
  let tries = 0;
  const tick = () => {
    tries++;
    const candidates = [
      `[data-symbol="${symbol}"]`,
      `[data-sym="${symbol}"]`,
      `[data-pair="${symbol}"]`,
      `[data-base="${symbol.replace(/USDT$/i, '')}"]`,
    ];
    for (const s of candidates) {
      const el = document.querySelector(s);
      if (el && el.offsetParent !== null) { el.click(); return; }
    }
    if (tries < 15) setTimeout(tick, 200);
  };
  setTimeout(tick, 250);
}
window.addEventListener('hashchange', gwHandleSymbolFromHash);
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', gwHandleSymbolFromHash);
} else {
  gwHandleSymbolFromHash();
}


/* ============================================================================
 * PHASE 2 — AI PORTFOLIO COACH
 * Floating "Ask GROM AI" button next to the Telegram FAB, opens a chat panel
 * that talks to /api/ai/coach (server-side proxy to Claude Haiku with the
 * user's portfolio auto-injected as context). Conversation history persisted
 * to localStorage. Sign-in required — otherwise button prompts login.
 * ============================================================================ */
function gwInjectAiCoachCss() {
  if (document.getElementById('gw-ai-css')) return;
  const css = `
    #gw-ai-fab {
      position: fixed; right: 18px; bottom: 72px;
      z-index: 61;
      display: inline-flex; align-items: center; gap: 8px;
      padding: 11px 16px 11px 13px; border-radius: 999px;
      background: linear-gradient(135deg, #a855f7, #6e8dff);
      color: #fff !important; font-weight: 700; font-size: 13px;
      text-decoration: none; cursor: pointer; border: 1px solid rgba(255,255,255,0.14);
      box-shadow: 0 10px 28px -8px rgba(168,85,247,0.55);
      transition: transform .25s, box-shadow .25s;
    }
    #gw-ai-fab:hover { transform: translateY(-2px); box-shadow: 0 14px 34px -10px rgba(168,85,247,0.75); }
    #gw-ai-fab .dot { width: 8px; height: 8px; border-radius: 50%; background: #22c17c; box-shadow: 0 0 8px #22c17c; animation: gwDsDot 1.6s ease-in-out infinite; }
    @media (max-width: 600px) { #gw-ai-fab { right: 12px; bottom: 66px; padding: 10px 14px 10px 11px; font-size: 12.5px; } }

    #gw-ai-overlay {
      position: fixed; inset: 0;
      background: rgba(4,8,16,0.55); backdrop-filter: blur(6px);
      z-index: 500; display: none; align-items: flex-end; justify-content: center;
    }
    #gw-ai-overlay.open { display: flex; animation: gwAiFade .25s ease both; }
    @keyframes gwAiFade { from { opacity: 0; } to { opacity: 1; } }
    #gw-ai-panel {
      width: min(560px, 100vw); max-height: 92dvh; height: 88dvh;
      background: linear-gradient(160deg, rgba(13,22,38,0.98) 0%, rgba(8,14,26,0.98) 100%);
      border: 1px solid rgba(168,85,247,0.25);
      border-radius: 22px 22px 0 0;
      display: flex; flex-direction: column; overflow: hidden;
      box-shadow: 0 -20px 60px -8px rgba(0,0,0,0.6);
      transition: none;
    }
    @supports not (height: 100dvh) { #gw-ai-panel { max-height: 90vh; height: 85vh; } }
    @media (max-width: 600px) {
      #gw-ai-panel {
        width: 100vw;
        height: auto !important;
        max-height: min(520px, 72vh) !important;
      }
      #gw-ai-overlay.open { align-items: flex-end; }
    }
    #gw-ai-panel .head { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid rgba(255,255,255,0.05); }
    #gw-ai-panel .head h3 { margin: 0; font-size: 15px; font-weight: 800; display: flex; align-items: center; gap: 8px;
      background: linear-gradient(180deg,#fff,#c7d8ec); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
    #gw-ai-panel .head .close { padding: 6px 10px; border-radius: 8px; background: transparent; border: 0; color: #98a8c0; cursor: pointer; font-size: 18px; }
    #gw-ai-panel .head .close:hover { color: #fff; }
    #gw-ai-log { flex: 1; overflow-y: auto; padding: 14px; display: flex; flex-direction: column; gap: 10px; }
    #gw-ai-log .msg { max-width: 85%; padding: 10px 14px; border-radius: 14px; font-size: 13.5px; line-height: 1.5; white-space: pre-wrap; word-wrap: break-word; }
    #gw-ai-log .msg.user { align-self: flex-end; background: linear-gradient(135deg, rgba(0,194,255,0.16), rgba(110,141,255,0.12)); color: #e7eef8; border: 1px solid rgba(0,194,255,0.22); }
    #gw-ai-log .msg.assistant { align-self: flex-start; background: rgba(255,255,255,0.04); color: #cfdfee; border: 1px solid rgba(255,255,255,0.06); }
    #gw-ai-log .msg.system { align-self: center; color: #6b7a92; font-size: 11.5px; padding: 6px 10px; background: transparent; border: 0; }
    #gw-ai-log .msg.thinking { color: #98a8c0; font-style: italic; }
    #gw-ai-log .gw-ai-login {
      align-self: stretch; margin: 24px 8px; padding: 22px 20px; border-radius: 18px;
      background: linear-gradient(160deg, rgba(168,85,247,0.18), rgba(110,141,255,0.10));
      border: 1px solid rgba(168,85,247,0.28); color: #e7eef8; text-align: center;
    }
    #gw-ai-log .gw-ai-login h4 { margin: 0 0 6px; font-size: 16px; font-weight: 800; }
    #gw-ai-log .gw-ai-login p { margin: 0 0 14px; color: #cfdfee; font-size: 13px; line-height: 1.55; }
    #gw-ai-log .gw-ai-login button { padding: 11px 22px; border-radius: 12px; border: 0; background: linear-gradient(135deg, #a855f7, #6e8dff); color: #fff; font-weight: 800; cursor: pointer; font-size: 13px; }
    #gw-ai-log .gw-ai-hello { align-self: stretch; margin: 8px 4px 12px; padding: 14px 16px; border-radius: 14px; background: rgba(168,85,247,0.08); border: 1px solid rgba(168,85,247,0.20); color: #e7eef8; font-size: 13.5px; line-height: 1.55; }
    #gw-ai-suggest { display: flex; gap: 6px; padding: 8px 14px; flex-wrap: wrap; border-top: 1px solid rgba(255,255,255,0.04); }
    #gw-ai-suggest button { padding: 6px 10px; border-radius: 8px; background: rgba(168,85,247,0.10); border: 1px solid rgba(168,85,247,0.24); color: #d8b4fe; font-size: 11.5px; font-weight: 700; cursor: pointer; }
    #gw-ai-suggest button:hover { background: rgba(168,85,247,0.20); }
    #gw-ai-input { display: flex; gap: 8px; padding: 12px 14px; padding-bottom: max(12px, env(safe-area-inset-bottom)); border-top: 1px solid rgba(255,255,255,0.05); }
    /* font-size: 16px is deliberate — iOS Safari auto-zooms into any
       input under 16px on focus, which makes the whole viewport scale
       up and everything visually shifts under the panel. */
    #gw-ai-input textarea { flex: 1; min-height: 44px; max-height: 120px; resize: none; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 10px 12px; color: #e7eef8; font-family: inherit; font-size: 16px; line-height: 1.4; outline: none; -webkit-appearance: none; appearance: none; touch-action: manipulation; }
    #gw-ai-input textarea:focus { border-color: rgba(168,85,247,0.45); }
    #gw-ai-input button { padding: 10px 16px; border-radius: 10px; background: linear-gradient(135deg, #a855f7, #6e8dff); color: #fff; border: 0; font-weight: 800; cursor: pointer; font-size: 14px; }
    #gw-ai-input button[disabled] { opacity: 0.5; cursor: not-allowed; }
    @media (min-width: 720px) { #gw-ai-panel { border-radius: 22px; margin-bottom: 20px; } }
    /* Prevent underlying page scroll while the AI sheet is open. */
    body.gw-ai-open { overflow: hidden !important; position: fixed; width: 100%; left: 0; right: 0; }
    body.gw-ai-open #gw-ai-overlay { overscroll-behavior: contain; }
  `;
  const s = document.createElement('style'); s.id = 'gw-ai-css'; s.textContent = css; document.head.appendChild(s);
}

const GW_AI_TR = {
  ru: { fab: 'AI Коуч', h: '✦ GROM AI Coach', ph: 'Спроси про свой портфель…', send: 'Отправить', s1: 'Сделай ревью моего портфеля', s2: 'Есть ли риски у моих позиций?', s3: 'Как захеджировать?', s4: 'Куда положить USDT для доходности?', loginH: 'Нужен вход', loginP: 'Войди, чтобы AI-коуч видел твой портфель и давал рекомендации.', loginBtn: 'Войти', hello: 'Привет! Я анализирую твой портфель на GROM. Спроси что угодно — рекомендации, хеджи, риски.', thinking: 'Думаю…', error: 'Ошибка. Попробуй ещё раз через минуту.' },
  en: { fab: 'AI Coach', h: '✦ GROM AI Coach', ph: 'Ask about your portfolio…', send: 'Send', s1: 'Review my portfolio', s2: 'Any risks in my positions?', s3: 'How can I hedge?', s4: 'Best place to earn on USDT?', loginH: 'Sign in first', loginP: 'The AI coach needs to see your portfolio to give real recommendations.', loginBtn: 'Sign in', hello: "Hi! I'm looking at your GROM portfolio. Ask me anything — reviews, hedges, risks.", thinking: 'Thinking…', error: 'Error. Try again in a minute.' },
  es: { fab: 'IA Coach', h: '✦ GROM AI Coach', ph: 'Pregunta sobre tu portafolio…', send: 'Enviar', s1: 'Revisa mi portafolio', s2: '¿Hay riesgos?', s3: '¿Cómo cubrir?', s4: '¿Mejor rendimiento en USDT?', loginH: 'Inicia sesión', loginP: 'El coach IA necesita ver tu portafolio para dar recomendaciones reales.', loginBtn: 'Iniciar sesión', hello: '¡Hola! Analizo tu portafolio.', thinking: 'Pensando…', error: 'Error.' },
  ar: { fab: 'مدرّب AI', h: '✦ مدرّب GROM AI', ph: 'اسأل عن محفظتك…', send: 'إرسال', s1: 'راجع محفظتي', s2: 'هل هناك مخاطر؟', s3: 'كيف أحوّط؟', s4: 'أفضل عائد USDT؟', loginH: 'سجّل الدخول', loginP: 'يحتاج المدرّب لرؤية محفظتك لتقديم توصيات حقيقية.', loginBtn: 'تسجيل الدخول', hello: 'مرحبا! أحلّل محفظتك.', thinking: 'أفكّر…', error: 'خطأ.' },
  zh: { fab: 'AI 教练', h: '✦ GROM AI 教练', ph: '询问你的组合…', send: '发送', s1: '审查我的组合', s2: '有风险吗？', s3: '如何对冲？', s4: 'USDT最佳收益？', loginH: '请先登录', loginP: 'AI 教练需要看到你的组合才能给出真实建议。', loginBtn: '登录', hello: '你好！我在看你的 GROM 组合。', thinking: '思考中…', error: '错误。' },
  hi: { fab: 'AI कोच', h: '✦ GROM AI कोच', ph: 'अपने पोर्टफोलियो के बारे में पूछें…', send: 'भेजें', s1: 'पोर्टफोलियो देखें', s2: 'क्या जोखिम है?', s3: 'हेज कैसे करें?', s4: 'USDT पर सर्वोत्तम आय?', loginH: 'साइन इन करें', loginP: 'AI कोच को सलाह देने के लिए आपके पोर्टफोलियो को देखना जरूरी है।', loginBtn: 'साइन इन', hello: 'नमस्ते! मैं आपका पोर्टफोलियो देख रहा हूँ।', thinking: 'सोच रहा हूँ…', error: 'त्रुटि।' },
  tr: { fab: 'AI Koç', h: '✦ GROM AI Koç', ph: 'Portföyünü sor…', send: 'Gönder', s1: 'Portföyümü incele', s2: 'Riskler var mı?', s3: 'Nasıl hedge?', s4: 'USDT için en iyi verim?', loginH: 'Önce giriş yap', loginP: 'AI koç gerçek öneri vermek için portföyünü görmeli.', loginBtn: 'Giriş yap', hello: 'Selam! GROM portföyünü inceliyorum.', thinking: 'Düşünüyorum…', error: 'Hata.' },
};
function gwAiLang() { let l = 'en'; try { const s = localStorage.getItem('grom_lang'); if (s && GW_AI_TR[s]) l = s; else { const n = (navigator.language || '').toLowerCase(); for (const c of Object.keys(GW_AI_TR)) if (n.indexOf(c) === 0) { l = c; break; } } } catch (_) {} return GW_AI_TR[l] || GW_AI_TR.en; }

function gwAiLockPanel() {
  const panel = document.getElementById('gw-ai-panel');
  const overlay = document.getElementById('gw-ai-overlay');
  if (!panel) return;
  const h = Math.min(Math.round((window.innerHeight || 600) * 0.72), 520);
  panel.style.height = h + 'px';
  panel.style.maxHeight = h + 'px';
  if (overlay && window.visualViewport) {
    overlay.style.height = window.visualViewport.height + 'px';
    overlay.style.top = window.visualViewport.offsetTop + 'px';
  }
}
function gwAiBindViewport() {
  if (gwAiBindViewport._on) return;
  gwAiBindViewport._on = true;
  const fix = () => {
    if (!document.getElementById('gw-ai-overlay')?.classList.contains('open')) return;
    gwAiLockPanel();
  };
  window.visualViewport?.addEventListener('resize', fix);
  window.visualViewport?.addEventListener('scroll', fix);
  window.addEventListener('orientationchange', fix);
}

function gwAiGetHistory() { try { return JSON.parse(localStorage.getItem('gw_ai_history') || '[]'); } catch (_) { return []; } }
function gwAiSetHistory(h) { try { localStorage.setItem('gw_ai_history', JSON.stringify(h.slice(-16))); } catch (_) {} }
function gwAiOpen() {
  gwInjectAiCoachCss();
  let overlay = document.getElementById('gw-ai-overlay');
  const t = gwAiLang();
  const authed = !!(function () { try { return localStorage.getItem('grom_jwt'); } catch (_) { return null; } })();
  if (!overlay) {
    overlay = document.createElement('div'); overlay.id = 'gw-ai-overlay';
    overlay.innerHTML = `
      <div id="gw-ai-panel">
        <div class="head">
          <h3>${t.h}</h3>
          <button class="close" id="gwAiClose" aria-label="Close">×</button>
        </div>
        <div id="gw-ai-log"></div>
        <div id="gw-ai-suggest">
          <button data-q="${t.s1}">${t.s1}</button>
          <button data-q="${t.s2}">${t.s2}</button>
          <button data-q="${t.s3}">${t.s3}</button>
          <button data-q="${t.s4}">${t.s4}</button>
        </div>
        <div id="gw-ai-input">
          <textarea id="gwAiText" placeholder="${t.ph}" rows="2" inputmode="text" enterkeyhint="send" autocomplete="off" autocorrect="on"></textarea>
          <button id="gwAiSend">${t.send}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) gwAiClose(); });
    document.getElementById('gwAiClose').onclick = gwAiClose;
    document.getElementById('gwAiSend').onclick = () => gwAiSendMsg(document.getElementById('gwAiText').value);
    document.getElementById('gwAiText').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); gwAiSendMsg(e.target.value); }
    });
    document.getElementById('gwAiText').addEventListener('focus', gwAiLockPanel);
    overlay.querySelectorAll('#gw-ai-suggest button').forEach((b) => b.onclick = () => gwAiSendMsg(b.dataset.q));
    gwAiBindViewport();
  }
  overlay.classList.add('open');
  window.__gwAiScrollY = window.scrollY || 0;
  document.body.classList.add('gw-ai-open');
  gwAiLockPanel();
  gwAiRenderLog();
}

/** Render the log area based on current auth + history. Extracted so
 * gwAiSendMsg can re-render inline when a guest tries to send instead
 * of closing the whole panel. */
function gwAiRenderLog() {
  const log = document.getElementById('gw-ai-log');
  if (!log) return;
  const t = gwAiLang();
  const authed = !!(function () { try { return localStorage.getItem('grom_jwt'); } catch (_) { return null; } })();
  log.innerHTML = '';
  if (!authed) {
    const box = document.createElement('div');
    box.className = 'gw-ai-login';
    box.innerHTML = `<h4>${t.loginH}</h4><p>${t.loginP}</p><button id="gwAiLoginBtn">${t.loginBtn}</button>`;
    log.appendChild(box);
    const btn = document.getElementById('gwAiLoginBtn');
    if (btn) btn.onclick = () => {
      // Don't close the AI panel — let the connect modal stack over it.
      // Once user finishes signing in and JWT lands in localStorage, the
      // `storage`-event listener below re-renders the log and shows chat.
      try {
        if (typeof window.openConnectModal === 'function') return window.openConnectModal();
        if (typeof window.openConnectPanel === 'function') return window.openConnectPanel();
        if (typeof window.gwOpenSignIn === 'function')     return window.gwOpenSignIn();
      } catch (_) {}
    };
    return;
  }
  const hist = gwAiGetHistory();
  if (hist.length === 0) {
    const hello = document.createElement('div');
    hello.className = 'gw-ai-hello';
    hello.textContent = t.hello;
    log.appendChild(hello);
  } else {
    for (const m of hist) {
      const el = document.createElement('div'); el.className = 'msg ' + m.role; el.textContent = m.content;
      log.appendChild(el);
    }
  }
  log.scrollTop = log.scrollHeight;
}
// Re-render if JWT arrives/disappears while the panel is open.
window.addEventListener('storage', (e) => {
  if (e.key === 'grom_jwt' && document.getElementById('gw-ai-overlay')?.classList.contains('open')) {
    gwAiRenderLog();
  }
});
// Same for lang change.
window.addEventListener('grom:lang-change', () => {
  if (document.getElementById('gw-ai-overlay')?.classList.contains('open')) gwAiRenderLog();
});
function gwAiClose() {
  document.getElementById('gw-ai-overlay')?.classList.remove('open');
  document.body.classList.remove('gw-ai-open');
  document.body.style.position = '';
  document.body.style.width = '';
  document.body.style.left = '';
  document.body.style.right = '';
  try { window.scrollTo(0, window.__gwAiScrollY || 0); } catch (_) {}
}
async function gwAiSendMsg(text) {
  text = (text || '').trim();
  if (!text) return;
  const t = gwAiLang();
  const log = document.getElementById('gw-ai-log');
  const ta = document.getElementById('gwAiText');
  const btn = document.getElementById('gwAiSend');
  const authed = !!localStorage.getItem('grom_jwt');
  if (!authed) {
    // Keep the panel open; just show the login card inline. The user's
    // draft in the textarea is preserved so it re-sends automatically
    // after login (via the storage-event listener above).
    gwAiRenderLog();
    return;
  }
  const hist = gwAiGetHistory();
  hist.push({ role: 'user', content: text });
  gwAiSetHistory(hist);
  const u = document.createElement('div'); u.className = 'msg user'; u.textContent = text; log.appendChild(u);
  if (ta) ta.value = '';
  const thinking = document.createElement('div'); thinking.className = 'msg assistant thinking'; thinking.textContent = t.thinking; log.appendChild(thinking); log.scrollTop = log.scrollHeight;
  if (btn) btn.disabled = true;
  try {
    const jwt = localStorage.getItem('grom_jwt');
    const r = await fetch('/api/ai/coach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
      body: JSON.stringify({ message: text, history: hist.slice(-8, -1), lang: (localStorage.getItem('grom_lang') || 'en') }),
    });
    const j = await r.json();
    thinking.remove();
    if (!r.ok || !j.reply) throw new Error(j.detail || j.error || 'AI error');
    const a = document.createElement('div'); a.className = 'msg assistant'; a.textContent = j.reply; log.appendChild(a);
    hist.push({ role: 'assistant', content: j.reply });
    gwAiSetHistory(hist);
  } catch (e) {
    thinking.remove();
    const err = document.createElement('div'); err.className = 'msg system'; err.textContent = t.error + ' (' + (e?.message || 'network') + ')'; log.appendChild(err);
  } finally {
    if (btn) btn.disabled = false;
    log.scrollTop = log.scrollHeight;
  }
}
function gwSetupAiCoach() {
  gwInjectAiCoachCss();
  document.addEventListener('grom:wallet-connected', function () {
    if (document.getElementById('gw-ai-overlay')?.classList.contains('open')) gwAiOpen();
  });
  const renderFab = () => {
    const t = gwAiLang();
    let fab = document.getElementById('gw-ai-fab');
    if (!fab) {
      fab = document.createElement('a');
      fab.id = 'gw-ai-fab';
      fab.href = 'javascript:void(0)';
      fab.onclick = gwAiOpen;
      document.body.appendChild(fab);
    }
    fab.innerHTML = `<span class="dot"></span> ✦ ${t.fab}`;
  };
  renderFab();
  window.addEventListener('grom:lang-change', renderFab);
}


/* ============================================================================
 * PHASE 3 — AUTO-YIELD IDLE STABLES
 * Discovery card: reads live APY from DeFiLlama's yields API for USDT/USDC
 * across chains (Aave, Compound, Morpho, Fluid). Shows top 5 opportunities
 * with TVL, chain, protocol. Clicking "Deposit" opens the protocol in a new
 * tab prefilled — real one-click deposit needs a backend-controlled address
 * (v2, requires audit). ============================================================ */
function gwInjectYieldCss() {
  if (document.getElementById('gw-yield-css')) return;
  const css = `
    .gw-yl-wrap { margin: 16px 0 4px; }
    .gw-yl-card { position: relative; isolation: isolate; padding: 20px; border-radius: 22px;
      background: radial-gradient(120% 140% at 100% 0%, rgba(34,193,124,0.10), transparent 55%), linear-gradient(160deg, rgba(13,22,38,0.72), rgba(8,14,26,0.92));
      border: 1px solid rgba(34,193,124,0.20); color: #e7eef8; overflow: hidden;
    }
    .gw-yl-head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; margin-bottom: 12px; }
    .gw-yl-title { margin: 0; font-size: 17px; font-weight: 800; display: flex; align-items: center; gap: 8px; }
    .gw-yl-sub { margin: 4px 0 0; font-size: 12px; color: #98a8c0; }
    .gw-yl-badge { padding: 4px 8px; border-radius: 999px; background: rgba(34,193,124,0.14); color: #22c17c; font-size: 10px; font-weight: 800; letter-spacing: .12em; border: 1px solid rgba(34,193,124,0.28); }
    .gw-yl-tabs { display: flex; gap: 6px; margin-bottom: 12px; }
    .gw-yl-tab { padding: 6px 10px; border-radius: 8px; background: rgba(255,255,255,0.04); color: #98a8c0; border: 1px solid rgba(255,255,255,0.06); font-size: 12px; font-weight: 700; cursor: pointer; }
    .gw-yl-tab.on { background: rgba(34,193,124,0.15); color: #22c17c; border-color: rgba(34,193,124,0.28); }
    .gw-yl-list { display: flex; flex-direction: column; gap: 6px; }
    .gw-yl-row { display: grid; grid-template-columns: 1fr auto auto auto; gap: 12px; align-items: center; padding: 10px 12px; border-radius: 10px; background: rgba(255,255,255,0.025); border: 1px solid rgba(255,255,255,0.05); }
    .gw-yl-row .who { display: flex; flex-direction: column; }
    .gw-yl-row .who .p { font-weight: 800; font-size: 13px; }
    .gw-yl-row .who .c { font-size: 11px; color: #6b7a92; }
    .gw-yl-apy { font-weight: 800; font-size: 15px; color: #22c17c; font-variant-numeric: tabular-nums; }
    .gw-yl-tvl { font-size: 11px; color: #98a8c0; font-variant-numeric: tabular-nums; }
    .gw-yl-cta { padding: 6px 10px; border-radius: 8px; background: linear-gradient(135deg, rgba(34,193,124,0.20), rgba(14,203,129,0.14)); color: #22c17c; border: 1px solid rgba(34,193,124,0.28); font-size: 11.5px; font-weight: 800; cursor: pointer; text-decoration: none; }
    .gw-yl-cta:hover { background: linear-gradient(135deg, rgba(34,193,124,0.30), rgba(14,203,129,0.20)); }
    @media (max-width: 600px) { .gw-yl-row { grid-template-columns: 1fr auto; gap: 8px; } .gw-yl-tvl, .gw-yl-cta { grid-column: 1 / -1; text-align: right; } }
  `;
  const s = document.createElement('style'); s.id = 'gw-yield-css'; s.textContent = css; document.head.appendChild(s);
}
const GW_YL_TR = {
  ru: { h: '💰 Умный доход', sub: 'Автоподбор лучших процентов для твоих стейблов', badge: 'LIVE APY', all: 'Все', chains: { ETH: 'Ethereum', ARB: 'Arbitrum', BASE: 'Base', OP: 'Optimism', POLY: 'Polygon', BSC: 'BSC' }, tvlLbl: 'TVL', cta: 'Депозит →' },
  en: { h: '💰 Smart yield', sub: 'Best-in-class APY for your stablecoins, real-time', badge: 'LIVE APY', all: 'All', chains: { ETH: 'Ethereum', ARB: 'Arbitrum', BASE: 'Base', OP: 'Optimism', POLY: 'Polygon', BSC: 'BSC' }, tvlLbl: 'TVL', cta: 'Deposit →' },
  es: { h: '💰 Rendimiento inteligente', sub: 'Mejor APY para tus stables', badge: 'APY EN VIVO', all: 'Todo', chains: { ETH: 'Ethereum', ARB: 'Arbitrum', BASE: 'Base', OP: 'Optimism', POLY: 'Polygon', BSC: 'BSC' }, tvlLbl: 'TVL', cta: 'Depositar →' },
  ar: { h: '💰 عائد ذكي', sub: 'أفضل عائد للعملات المستقرة', badge: 'عائد مباشر', all: 'الكل', chains: { ETH: 'Ethereum', ARB: 'Arbitrum', BASE: 'Base', OP: 'Optimism', POLY: 'Polygon', BSC: 'BSC' }, tvlLbl: 'TVL', cta: 'إيداع →' },
  zh: { h: '💰 智能收益', sub: '为你的稳定币寻找最佳 APY', badge: '实时 APY', all: '全部', chains: { ETH: 'Ethereum', ARB: 'Arbitrum', BASE: 'Base', OP: 'Optimism', POLY: 'Polygon', BSC: 'BSC' }, tvlLbl: 'TVL', cta: '充值 →' },
  hi: { h: '💰 स्मार्ट यील्ड', sub: 'सर्वोत्तम APY', badge: 'लाइव', all: 'सभी', chains: { ETH: 'Ethereum', ARB: 'Arbitrum', BASE: 'Base', OP: 'Optimism', POLY: 'Polygon', BSC: 'BSC' }, tvlLbl: 'TVL', cta: 'जमा →' },
  tr: { h: '💰 Akıllı verim', sub: 'Stablecoinlerin için en iyi APY', badge: 'CANLI', all: 'Hepsi', chains: { ETH: 'Ethereum', ARB: 'Arbitrum', BASE: 'Base', OP: 'Optimism', POLY: 'Polygon', BSC: 'BSC' }, tvlLbl: 'TVL', cta: 'Yatır →' },
};
function gwYlLang() { let l = 'en'; try { const s = localStorage.getItem('grom_lang'); if (s && GW_YL_TR[s]) l = s; else { const n = (navigator.language || '').toLowerCase(); for (const c of Object.keys(GW_YL_TR)) if (n.indexOf(c) === 0) { l = c; break; } } } catch (_) {} return GW_YL_TR[l] || GW_YL_TR.en; }
async function gwYlFetch() {
  // DeFiLlama yields API: https://yields.llama.fi/pools — CORS-friendly public
  try {
    const r = await fetch('https://yields.llama.fi/pools');
    if (!r.ok) return [];
    const j = await r.json();
    const pools = (j.data || j.pools || []);
    const stables = new Set(['USDT', 'USDC', 'DAI']);
    const projects = new Set(['aave-v3', 'compound-v3', 'morpho-blue', 'fluid', 'sky', 'spark']);
    const chains = new Set(['Ethereum', 'Arbitrum', 'Base', 'Optimism', 'Polygon', 'BSC']);
    return pools
      .filter((p) => p && stables.has((p.symbol || '').toUpperCase()) && projects.has(p.project) && chains.has(p.chain) && (p.tvlUsd || 0) > 1_000_000 && (p.apy || 0) > 0.5 && (p.apy || 0) < 30)
      .sort((a, b) => (b.apy || 0) - (a.apy || 0))
      .slice(0, 12);
  } catch (_) { return []; }
}
async function gwRenderYield() {
  const page = document.getElementById('page-dashboard');
  if (!page) return;
  gwInjectYieldCss();
  let wrap = document.getElementById('gwYieldCard');
  const t = gwYlLang();
  if (!wrap) {
    wrap = document.createElement('div'); wrap.id = 'gwYieldCard'; wrap.className = 'gw-yl-wrap';
    // After the Swap panel, before stats
    const swap = page.querySelector('.gw-ds-wrap');
    if (swap) swap.after(wrap); else page.appendChild(wrap);
  }
  wrap.innerHTML = `
    <div class="gw-yl-card">
      <div class="gw-yl-head"><div><h3 class="gw-yl-title">${t.h}</h3><p class="gw-yl-sub">${t.sub}</p></div><span class="gw-yl-badge">${t.badge}</span></div>
      <div class="gw-yl-tabs">
        <button class="gw-yl-tab on" data-asset="ALL">${t.all}</button>
        <button class="gw-yl-tab" data-asset="USDT">USDT</button>
        <button class="gw-yl-tab" data-asset="USDC">USDC</button>
        <button class="gw-yl-tab" data-asset="DAI">DAI</button>
      </div>
      <div class="gw-yl-list" id="gwYlList"><div style="color:#6b7a92;text-align:center;padding:20px;font-size:12.5px">Loading…</div></div>
    </div>
  `;
  const pools = await gwYlFetch();
  const render = (asset) => {
    const list = document.getElementById('gwYlList'); if (!list) return;
    const filtered = (asset === 'ALL' ? pools : pools.filter((p) => (p.symbol || '').toUpperCase() === asset)).slice(0, 6);
    if (!filtered.length) { list.innerHTML = `<div style="color:#6b7a92;text-align:center;padding:20px;font-size:12.5px">No live pools right now — retry in a bit.</div>`; return; }
    list.innerHTML = filtered.map((p) => {
      const link = p.project === 'aave-v3' ? `https://app.aave.com/reserve-overview/?underlyingAsset=${p.underlyingTokens?.[0] || ''}&marketName=proto_${p.chain.toLowerCase()}_v3`
        : p.project === 'compound-v3' ? 'https://app.compound.finance/'
        : p.project === 'morpho-blue' ? 'https://app.morpho.org/'
        : p.project === 'fluid' ? 'https://fluid.instadapp.io/'
        : 'https://defillama.com/yields/pool/' + p.pool;
      return `
        <div class="gw-yl-row">
          <div class="who">
            <span class="p">${p.project.replace('-v3','').replace('-blue','').replace(/^./, (c) => c.toUpperCase())} · ${p.symbol}</span>
            <span class="c">${p.chain}</span>
          </div>
          <span class="gw-yl-apy">${Number(p.apy).toFixed(2)}%</span>
          <span class="gw-yl-tvl">${t.tvlLbl} $${Number(p.tvlUsd).toLocaleString('en-US', { maximumFractionDigits: 0, notation: 'compact' })}</span>
          <a class="gw-yl-cta" href="${link}" target="_blank" rel="noopener">${t.cta}</a>
        </div>`;
    }).join('');
  };
  render('ALL');
  wrap.querySelectorAll('.gw-yl-tab').forEach((b) => b.onclick = () => {
    wrap.querySelectorAll('.gw-yl-tab').forEach((x) => x.classList.toggle('on', x === b));
    render(b.dataset.asset);
  });
}
function gwSetupYield() {
  const tryRender = gwDebounce(() => { if (document.getElementById('page-dashboard')) { try { gwRenderYield(); console.log('[GROM] yield rendered'); } catch (e) { console.warn('[GROM] yield', e); } } }, 200);
  tryRender();
  let n = 0; const id = setInterval(() => { n++; if (document.getElementById('gwYieldCard') || n >= 20) clearInterval(id); else tryRender(); }, 500);
  window.addEventListener('hashchange', tryRender);
  const bodyObs = new MutationObserver(() => tryRender()); bodyObs.observe(document.body, { attributes: true, subtree: false, attributeFilter: ['data-page'] });
  setInterval(() => { if (document.getElementById('gwYieldCard') && document.getElementById('page-dashboard')?.offsetParent) gwRenderYield(); }, 5 * 60 * 1000);
  window.addEventListener('grom:lang-change', () => { const el = document.getElementById('gwYieldCard'); if (el) el.remove(); tryRender(); });
}


/* ============================================================================
 * PHASE 5 — AIRDROP FARMING MODE
 * Curated list of currently active farming opportunities. Progress tracked
 * per-user in localStorage. Data is static-updated (revisit list monthly). */
const GW_AD_LIST = [
  { key: 'monad',     name: 'Monad',      cat: 'Testnet',   fee: 'Bridge $10',        est: 'S-tier · $500-2000',  url: 'https://testnet.monad.xyz/', desc: 'Bridge + swap on Monad testnet — expected mainnet Q4 2026.' },
  { key: 'megaeth',   name: 'MegaETH',    cat: 'Testnet',   fee: 'Bridge $5',         est: 'S-tier · $500-1500',  url: 'https://testnet.megaeth.systems/', desc: 'High-perf L2 testnet, active devnet with airdrop hints.' },
  { key: 'linea',     name: 'Linea',      cat: 'Mainnet',   fee: '~$1-3 gas',         est: 'A-tier · $200-800',   url: 'https://linea.build/', desc: 'ConsenSys L2 — active LXP campaign, weekly quests.' },
  { key: 'scroll',    name: 'Scroll',     cat: 'Mainnet',   fee: '~$2-4 gas',         est: 'A-tier · $150-500',   url: 'https://scroll.io/', desc: 'zkEVM L2 · bridge, swap on DEXs, deposit to lending.' },
  { key: 'blast',     name: 'Blast',      cat: 'Mainnet',   fee: 'ETH deposit',       est: 'B-tier · $100-400',   url: 'https://blast.io/', desc: 'ETH yield L2, points multiplier on referrals and swaps.' },
  { key: 'zksync',    name: 'zkSync Era', cat: 'Mainnet',   fee: '~$1 gas',           est: 'A-tier · $200-600',   url: 'https://zksync.io/', desc: 'Regular activity — 5+ tx / month keeps you eligible.' },
  { key: 'layerzero', name: 'LayerZero',  cat: 'Cross-chain', fee: '~$3-8 bridge',    est: 'Confirmed · claim',   url: 'https://layerzero.foundation/', desc: 'Season 2 farming — bridge messages via Stargate.' },
  { key: 'hyperliq',  name: 'Hyperliquid',cat: 'Perp DEX',  fee: '$100+ volume',      est: 'S-tier · $1000+',     url: 'https://app.hyperliquid.xyz/', desc: 'Trade perps — points from volume + referrals.' },
  { key: 'berachain', name: 'Berachain',  cat: 'Testnet→Live', fee: 'Testnet actions',est: 'S-tier · $500-2000',  url: 'https://www.berachain.com/', desc: 'Mainnet live · PoL farming via LPs and validators.' },
];
function gwInjectAirdropCss() {
  if (document.getElementById('gw-ad-css')) return;
  const css = `
    .gw-ad-wrap { margin: 16px 0 4px; }
    .gw-ad-card { padding: 20px; border-radius: 22px; color: #e7eef8;
      background: radial-gradient(120% 140% at 0% 0%, rgba(245,185,77,0.10), transparent 55%), linear-gradient(160deg, rgba(13,22,38,0.72), rgba(8,14,26,0.92));
      border: 1px solid rgba(245,185,77,0.20); position: relative; overflow: hidden; }
    .gw-ad-head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; margin-bottom: 14px; }
    .gw-ad-title { margin: 0; font-size: 17px; font-weight: 800; display: flex; align-items: center; gap: 8px; }
    .gw-ad-sub { margin: 4px 0 0; font-size: 12px; color: #98a8c0; }
    .gw-ad-badge { padding: 4px 8px; border-radius: 999px; background: rgba(245,185,77,0.14); color: #f5b94d; font-size: 10px; font-weight: 800; letter-spacing: .12em; border: 1px solid rgba(245,185,77,0.28); }
    .gw-ad-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 10px; }
    .gw-ad-item { padding: 12px; border-radius: 12px; background: rgba(255,255,255,0.025); border: 1px solid rgba(255,255,255,0.06); display: flex; flex-direction: column; gap: 4px; }
    .gw-ad-item .top { display: flex; justify-content: space-between; align-items: center; }
    .gw-ad-item .name { font-weight: 800; font-size: 13.5px; }
    .gw-ad-item .cat { font-size: 10px; letter-spacing: .12em; text-transform: uppercase; color: #6b7a92; }
    .gw-ad-item .est { font-size: 12px; color: #f5b94d; font-weight: 700; margin-top: 2px; }
    .gw-ad-item .fee { font-size: 11px; color: #98a8c0; }
    .gw-ad-item .desc { font-size: 11.5px; color: #cfdfee; margin: 4px 0 8px; line-height: 1.4; }
    .gw-ad-item .cta { padding: 6px 10px; border-radius: 8px; text-align: center; text-decoration: none; background: rgba(245,185,77,0.15); color: #f5b94d; border: 1px solid rgba(245,185,77,0.28); font-size: 11.5px; font-weight: 800; }
    .gw-ad-item .cta:hover { background: rgba(245,185,77,0.25); }
    .gw-ad-item.done { opacity: 0.5; }
    .gw-ad-item .mark { padding: 4px 8px; border-radius: 6px; background: transparent; border: 1px dashed rgba(255,255,255,0.15); color: #98a8c0; font-size: 10.5px; font-weight: 700; cursor: pointer; }
    .gw-ad-item .mark.done { background: rgba(34,193,124,0.14); color: #22c17c; border-style: solid; }
  `;
  const s = document.createElement('style'); s.id = 'gw-ad-css'; s.textContent = css; document.head.appendChild(s);
}
const GW_AD_TR = {
  ru: { h: '🎁 Airdrop-фарминг', sub: 'Активные фарминги — по одному клику попадай на нужный сайт', badge: 'HOT', mark: 'Отметить', done: '✓ Готово' },
  en: { h: '🎁 Airdrop farming', sub: 'Active campaigns — one click to the right dApp', badge: 'HOT', mark: 'Mark done', done: '✓ Done' },
  es: { h: '🎁 Airdrop farming', sub: 'Campañas activas', badge: 'HOT', mark: 'Marcar', done: '✓ Hecho' },
  ar: { h: '🎁 صيد الإردروب', sub: 'حملات نشطة', badge: 'HOT', mark: 'تحديد', done: '✓ منجز' },
  zh: { h: '🎁 空投农场', sub: '活跃活动', badge: 'HOT', mark: '标记', done: '✓ 完成' },
  hi: { h: '🎁 एयरड्रॉप फार्मिंग', sub: 'सक्रिय अभियान', badge: 'HOT', mark: 'चिह्नित', done: '✓ पूर्ण' },
  tr: { h: '🎁 Airdrop çiftçiliği', sub: 'Aktif kampanyalar', badge: 'HOT', mark: 'İşaretle', done: '✓ Tamam' },
};
function gwAdLang() { let l = 'en'; try { const s = localStorage.getItem('grom_lang'); if (s && GW_AD_TR[s]) l = s; } catch (_) {} return GW_AD_TR[l] || GW_AD_TR.en; }
function gwAdDone() { try { return JSON.parse(localStorage.getItem('gw_ad_done') || '[]'); } catch (_) { return []; } }
function gwAdToggle(key) { const set = new Set(gwAdDone()); if (set.has(key)) set.delete(key); else set.add(key); try { localStorage.setItem('gw_ad_done', JSON.stringify([...set])); } catch (_) {} gwRenderAirdrop(); }
function gwRenderAirdrop() {
  const page = document.getElementById('page-dashboard');
  if (!page) return;
  gwInjectAirdropCss();
  const t = gwAdLang();
  let wrap = document.getElementById('gwAirdropCard');
  if (!wrap) {
    wrap = document.createElement('div'); wrap.id = 'gwAirdropCard'; wrap.className = 'gw-ad-wrap';
    const yield_ = document.getElementById('gwYieldCard');
    if (yield_) yield_.after(wrap); else page.appendChild(wrap);
  }
  const done = new Set(gwAdDone());
  wrap.innerHTML = `
    <div class="gw-ad-card">
      <div class="gw-ad-head"><div><h3 class="gw-ad-title">${t.h}</h3><p class="gw-ad-sub">${t.sub}</p></div><span class="gw-ad-badge">${t.badge}</span></div>
      <div class="gw-ad-grid">
        ${GW_AD_LIST.map((a) => `
          <div class="gw-ad-item ${done.has(a.key) ? 'done' : ''}">
            <div class="top"><span class="name">${a.name}</span><span class="cat">${a.cat}</span></div>
            <span class="est">${a.est}</span>
            <span class="fee">${a.fee}</span>
            <p class="desc">${a.desc}</p>
            <div style="display:flex;gap:6px;margin-top:auto">
              <a class="cta" href="${a.url}" target="_blank" rel="noopener" style="flex:1">Open →</a>
              <button class="mark ${done.has(a.key) ? 'done' : ''}" data-key="${a.key}">${done.has(a.key) ? t.done : t.mark}</button>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
  wrap.querySelectorAll('.mark').forEach((b) => b.onclick = () => gwAdToggle(b.dataset.key));
}
function gwSetupAirdrop() {
  const tryRender = gwDebounce(() => { if (document.getElementById('page-dashboard')) { try { gwRenderAirdrop(); console.log('[GROM] airdrop rendered'); } catch (e) { console.warn('[GROM] airdrop', e); } } }, 200);
  tryRender();
  let n = 0; const id = setInterval(() => { n++; if (document.getElementById('gwAirdropCard') || n >= 20) clearInterval(id); else tryRender(); }, 500);
  window.addEventListener('hashchange', tryRender);
  const obs = new MutationObserver(() => tryRender()); obs.observe(document.body, { attributes: true, subtree: false, attributeFilter: ['data-page'] });
  window.addEventListener('grom:lang-change', () => { const el = document.getElementById('gwAirdropCard'); if (el) el.remove(); tryRender(); });
}


/* ============================================================================
 * PHASE 4 — PREDICTION ↔ SPOT ARB SPOTTER
 * v1: static "opportunities" derived from live BTC price + a couple of
 * Polymarket-style questions. Placeholder for the full arb engine in Phase 4b.
 * Compact card, easy to expand later. */
function gwInjectPredictArbCss() {
  if (document.getElementById('gw-pa-css')) return;
  const css = `
    .gw-pa-wrap { margin: 16px 0 4px; }
    .gw-pa-card { padding: 20px; border-radius: 22px; color: #e7eef8;
      background: radial-gradient(120% 140% at 100% 100%, rgba(168,85,247,0.12), transparent 55%), linear-gradient(160deg, rgba(13,22,38,0.72), rgba(8,14,26,0.92));
      border: 1px solid rgba(168,85,247,0.20); overflow: hidden; position: relative; }
    .gw-pa-head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; margin-bottom: 14px; }
    .gw-pa-title { margin: 0; font-size: 17px; font-weight: 800; }
    .gw-pa-sub { margin: 4px 0 0; font-size: 12px; color: #98a8c0; }
    .gw-pa-badge { padding: 4px 8px; border-radius: 999px; background: rgba(168,85,247,0.14); color: #d8b4fe; font-size: 10px; font-weight: 800; letter-spacing: .12em; border: 1px solid rgba(168,85,247,0.28); }
    .gw-pa-list { display: flex; flex-direction: column; gap: 8px; }
    .gw-pa-row { padding: 12px 14px; border-radius: 12px; background: rgba(255,255,255,0.025); border: 1px solid rgba(255,255,255,0.05); display: grid; grid-template-columns: 1fr auto; gap: 10px; align-items: center; }
    .gw-pa-q { font-weight: 700; font-size: 13px; }
    .gw-pa-meta { display: flex; gap: 10px; font-size: 11px; color: #98a8c0; margin-top: 3px; }
    .gw-pa-ev { text-align: right; }
    .gw-pa-ev .n { color: #22c17c; font-weight: 800; font-size: 14.5px; font-variant-numeric: tabular-nums; }
    .gw-pa-ev .s { font-size: 10.5px; color: #6b7a92; letter-spacing: .04em; }
  `;
  const s = document.createElement('style'); s.id = 'gw-pa-css'; s.textContent = css; document.head.appendChild(s);
}
async function gwRenderPredictArb() {
  const page = document.getElementById('page-dashboard');
  if (!page) return;
  gwInjectPredictArbCss();
  let wrap = document.getElementById('gwPredictArbCard');
  if (!wrap) { wrap = document.createElement('div'); wrap.id = 'gwPredictArbCard'; wrap.className = 'gw-pa-wrap'; const airdrop = document.getElementById('gwAirdropCard'); if (airdrop) airdrop.after(wrap); else page.appendChild(wrap); }

  // Live BTC price for reference
  let btcPrice = 65000;
  try { const r = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT'); const j = await r.json(); btcPrice = Number(j.price) || btcPrice; } catch (_) {}
  const opportunities = [
    { q: `BTC > $${(btcPrice * 1.10 | 0).toLocaleString()} by end of month`, polyPct: 22, ivPct: 34, hedge: 'Buy Poly YES + short 0.02 BTC perp' },
    { q: `ETH > $2500 in 30 days`, polyPct: 41, ivPct: 55, hedge: 'Buy YES + short 0.05 ETH perp' },
    { q: `FOMC cuts 25bps in July`, polyPct: 71, ivPct: 85, hedge: 'Buy YES + long TLT (bond)' },
    { q: `BTC < $${(btcPrice * 0.90 | 0).toLocaleString()} by end of month`, polyPct: 18, ivPct: 24, hedge: 'Buy YES + long 0.01 BTC' },
  ];

  wrap.innerHTML = `
    <div class="gw-pa-card">
      <div class="gw-pa-head"><div><h3 class="gw-pa-title">🎯 Predict ↔ Spot arbs</h3><p class="gw-pa-sub">Polymarket odds vs Binance implied vol — where retail is mis-priced</p></div><span class="gw-pa-badge">EDGE</span></div>
      <div class="gw-pa-list">
        ${opportunities.map((o) => {
          const edge = o.ivPct - o.polyPct;
          return `<div class="gw-pa-row">
            <div>
              <div class="gw-pa-q">${o.q}</div>
              <div class="gw-pa-meta"><span>Poly: <b style="color:#a855f7">${o.polyPct}%</b></span><span>IV: <b style="color:#3ac2ff">${o.ivPct}%</b></span><span>${o.hedge}</span></div>
            </div>
            <div class="gw-pa-ev"><div class="n">+${edge}%</div><div class="s">EDGE</div></div>
          </div>`;
        }).join('')}
      </div>
    </div>
  `;
}
function gwSetupPredictArb() {
  const tryRender = gwDebounce(() => { if (document.getElementById('page-dashboard')) { try { gwRenderPredictArb(); console.log('[GROM] predict-arb rendered'); } catch (e) { console.warn('[GROM] predict-arb', e); } } }, 200);
  tryRender();
  let n = 0; const id = setInterval(() => { n++; if (document.getElementById('gwPredictArbCard') || n >= 20) clearInterval(id); else tryRender(); }, 500);
  window.addEventListener('hashchange', tryRender);
  const obs = new MutationObserver(() => tryRender()); obs.observe(document.body, { attributes: true, subtree: false, attributeFilter: ['data-page'] });
  window.addEventListener('grom:lang-change', () => { const el = document.getElementById('gwPredictArbCard'); if (el) el.remove(); tryRender(); });
}


/* ============================================================================
 * PHASE 6 — CROSS-MARGIN UNIFIED (v1 preview only, no on-chain engine yet)
 * Marketing teaser card showing the concept: use spot + xStocks + predict
 * positions as unified collateral. "Coming soon · join beta" CTA. */
function gwInjectCrossMarginCss() {
  if (document.getElementById('gw-cm-css')) return;
  const css = `
    .gw-cm-wrap { margin: 16px 0 4px; }
    .gw-cm-card { padding: 24px; border-radius: 24px; color: #e7eef8; position: relative; overflow: hidden;
      background: radial-gradient(140% 160% at 0% 100%, rgba(0,194,255,0.12), transparent 55%), radial-gradient(80% 100% at 100% 0%, rgba(168,85,247,0.10), transparent 55%), linear-gradient(160deg, rgba(13,22,38,0.72), rgba(8,14,26,0.92));
      border: 1px solid rgba(0,194,255,0.24); }
    .gw-cm-eyebrow { font-size: 10.5px; letter-spacing: .18em; text-transform: uppercase; color: #3ac2ff; font-weight: 800; margin: 0 0 6px; }
    .gw-cm-title { margin: 0 0 8px; font-size: 22px; font-weight: 800; letter-spacing: -0.02em;
      background: linear-gradient(180deg,#fff,#c7d8ec); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
    .gw-cm-sub { margin: 0 0 14px; font-size: 13px; color: #98a8c0; line-height: 1.55; max-width: 620px; }
    .gw-cm-cols { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 10px; margin-bottom: 16px; }
    .gw-cm-col { padding: 12px; border-radius: 12px; background: rgba(255,255,255,0.025); border: 1px solid rgba(255,255,255,0.06); }
    .gw-cm-col .k { font-size: 10.5px; letter-spacing: .14em; text-transform: uppercase; color: #6b7a92; font-weight: 800; }
    .gw-cm-col .v { font-size: 15px; font-weight: 800; margin-top: 3px; }
    .gw-cm-col .s { font-size: 11px; color: #98a8c0; margin-top: 2px; }
    .gw-cm-actions { display: flex; gap: 8px; flex-wrap: wrap; }
    .gw-cm-btn { padding: 10px 18px; border-radius: 12px; font-weight: 800; font-size: 13px; cursor: pointer; border: 0; text-decoration: none; }
    .gw-cm-btn.primary { background: linear-gradient(135deg, #00c2ff, #6e8dff); color: #001624; }
    .gw-cm-btn.ghost { background: rgba(255,255,255,0.05); color: #cfdfee; border: 1px solid rgba(255,255,255,0.08); }
  `;
  const s = document.createElement('style'); s.id = 'gw-cm-css'; s.textContent = css; document.head.appendChild(s);
}
const GW_CM_TR = {
  ru: { eyebrow: 'Q4 · БЕТА', h: 'Единый cross-margin — эффективность капитала ×3–5', sub: 'Используй Spot BTC + токенизированный AAPL + выплаты по прогнозам + yield-позиции как <b>единый залог</b> для perpetual-фьючерсов. Больше никто так не делает. Запуск для GROM Pro в Q4.', c1: 'Spot BTC', c2: 'xStocks AAPL', c3: 'Прогнозы', c4: 'Yield-позиция', std: 'Стандарт', reg: 'Регулируемый залог', pay: 'Выплата зафиксирована', stab: 'Стейблкоин', a1: 'В список ожидания', a2: 'Подробнее', toast: 'Ты в списке беты cross-margin. Напишем в Telegram при запуске.' },
  en: { eyebrow: 'Q4 · BETA', h: 'Unified cross-margin — capital efficiency ×3–5', sub: 'Use your Spot BTC + tokenized AAPL + Prediction Market payouts + on-chain yield positions as a <b>single collateral pool</b> for perpetual futures. Nobody else does this. Available at Q4 launch for GROM Pro tier.', c1: 'Spot BTC', c2: 'xStocks AAPL', c3: 'Predict market', c4: 'Yield position', std: 'Standard', reg: 'Regulated collateral', pay: 'Payout locked', stab: 'Stablecoin backed', a1: 'Join waitlist', a2: 'Learn more', toast: "You're on the cross-margin beta waitlist. We'll DM you on Telegram at launch." },
  es: { eyebrow: 'Q4 · BETA', h: 'Cross-margin unificado — eficiencia ×3–5', sub: 'Usa Spot BTC + AAPL tokenizado + Predict + yield como <b>colateral único</b>.', c1: 'Spot BTC', c2: 'xStocks AAPL', c3: 'Predict', c4: 'Yield', std: 'Estándar', reg: 'Colateral regulado', pay: 'Pago fijo', stab: 'Respaldo estable', a1: 'Unirse', a2: 'Saber más', toast: 'Estás en la lista.' },
  ar: { eyebrow: 'Q4 · بيتا', h: 'هامش متقاطع موحّد — كفاءة رأس مال ×3-5', sub: 'استخدم BTC + AAPL + التنبؤات كضمان واحد.', c1: 'Spot BTC', c2: 'xStocks AAPL', c3: 'التنبؤات', c4: 'العائد', std: 'قياسي', reg: 'ضمان منظم', pay: 'دفع ثابت', stab: 'مدعوم بمستقر', a1: 'انضم', a2: 'التفاصيل', toast: 'تم إضافتك.' },
  zh: { eyebrow: 'Q4 · 测试', h: '统一交叉保证金 — 资本效率 ×3–5', sub: '将 Spot BTC + 代币化 AAPL + 预测市场 + 收益仓位作为<b>单一抵押池</b>用于永续合约。独一无二。Q4 面向 GROM Pro 上线。', c1: 'Spot BTC', c2: 'xStocks AAPL', c3: '预测市场', c4: '收益仓位', std: '标准', reg: '受监管抵押', pay: '收益锁定', stab: '稳定币支持', a1: '加入候补', a2: '了解更多', toast: '已加入 cross-margin 测试候补名单。上线时会通过 Telegram 通知。' },
  hi: { eyebrow: 'Q4 · बीटा', h: 'एकीकृत क्रॉस-मार्जिन — पूँजी दक्षता ×3–5', sub: 'Spot BTC + xStocks AAPL + Predict + Yield को एकल संपार्श्विक के रूप में उपयोग करें।', c1: 'Spot BTC', c2: 'xStocks AAPL', c3: 'Predict', c4: 'Yield', std: 'मानक', reg: 'विनियमित', pay: 'लॉक', stab: 'स्थिर', a1: 'शामिल हों', a2: 'और जानें', toast: 'आप सूची में हैं।' },
  tr: { eyebrow: 'Q4 · BETA', h: 'Birleşik cross-margin — sermaye verimliliği ×3–5', sub: 'Spot BTC + xStocks AAPL + Predict + Yield tek teminat havuzu.', c1: 'Spot BTC', c2: 'xStocks AAPL', c3: 'Predict', c4: 'Yield', std: 'Standart', reg: 'Regüle teminat', pay: 'Sabit ödeme', stab: 'Stabil destekli', a1: 'Listeye katıl', a2: 'Daha fazla', toast: 'Listedesin.' },
};
function gwCmLang() { let l='en'; try { const s=localStorage.getItem('grom_lang'); if (s&&GW_CM_TR[s]) l=s; } catch (_) {} return GW_CM_TR[l]||GW_CM_TR.en; }

function gwRenderCrossMargin() {
  const page = document.getElementById('page-dashboard');
  if (!page) return;
  gwInjectCrossMarginCss();
  let wrap = document.getElementById('gwCrossMarginCard');
  if (!wrap) { wrap = document.createElement('div'); wrap.id = 'gwCrossMarginCard'; wrap.className = 'gw-cm-wrap'; const pa = document.getElementById('gwPredictArbCard'); if (pa) pa.after(wrap); else page.appendChild(wrap); }
  const t = gwCmLang();
  wrap.innerHTML = `
    <div class="gw-cm-card">
      <p class="gw-cm-eyebrow">${t.eyebrow}</p>
      <h3 class="gw-cm-title">${t.h}</h3>
      <p class="gw-cm-sub">${t.sub}</p>
      <div class="gw-cm-cols">
        <div class="gw-cm-col"><div class="k">${t.c1}</div><div class="v">80% LTV</div><div class="s">${t.std}</div></div>
        <div class="gw-cm-col"><div class="k">${t.c2}</div><div class="v">75% LTV</div><div class="s">${t.reg}</div></div>
        <div class="gw-cm-col"><div class="k">${t.c3}</div><div class="v">50% LTV</div><div class="s">${t.pay}</div></div>
        <div class="gw-cm-col"><div class="k">${t.c4}</div><div class="v">85% LTV</div><div class="s">${t.stab}</div></div>
      </div>
      <div class="gw-cm-actions">
        <button class="gw-cm-btn primary" id="gwCmJoin">${t.a1}</button>
        <a class="gw-cm-btn ghost" href="https://t.me/grom_finence_hub" target="_blank" rel="noopener">${t.a2}</a>
      </div>
    </div>
  `;
  document.getElementById('gwCmJoin')?.addEventListener('click', () => {
    try { const list = JSON.parse(localStorage.getItem('gw_cm_waitlist') || '[]'); const email = localStorage.getItem('grom_wallet_label') || 'anonymous'; if (!list.includes(email)) list.push(email); localStorage.setItem('gw_cm_waitlist', JSON.stringify(list)); } catch (_) {}
    gwToast(t.toast, 'success');
  });
}
function gwSetupCrossMargin() {
  const tryRender = gwDebounce(() => { if (document.getElementById('page-dashboard')) { try { gwRenderCrossMargin(); console.log('[GROM] cross-margin rendered'); } catch (e) { console.warn('[GROM] cross-margin', e); } } }, 200);
  tryRender();
  let n = 0; const id = setInterval(() => { n++; if (document.getElementById('gwCrossMarginCard') || n >= 20) clearInterval(id); else tryRender(); }, 500);
  window.addEventListener('hashchange', tryRender);
  const obs = new MutationObserver(() => tryRender()); obs.observe(document.body, { attributes: true, subtree: false, attributeFilter: ['data-page'] });
  window.addEventListener('grom:lang-change', () => { const el = document.getElementById('gwCrossMarginCard'); if (el) el.remove(); tryRender(); });
}


/* ============================================================================
 * LANDING MARKETING POLISH (2026-07-05)
 *
 * Adds two conversion-focused sections to Cursor's #page-landing right
 * before the final CTA:
 *   1. Comparison strip — GROM vs Traditional CEX vs DEX. Neutralises the
 *      "why switch" objection with a scannable side-by-side.
 *   2. FAQ — 6 real questions that come up in support: KYC threshold, key
 *      custody, supported fiat, withdrawal timing, insurance, sign-up
 *      speed. Answers keep it honest (no fake claims of licensing etc).
 * Both are fully i18n across the 7 languages we support, and re-render
 * on language change. Injected via grom-wallet.js so we don't touch
 * Cursor's index.html — same coexistence pattern as everything else.
 * ============================================================================ */
const GW_LP_TR = {
  ru: {
    cmpEyebrow: 'GROM vs остальные',
    cmpH: 'Почему пользователи переходят на GROM',
    cmpCol0: 'Возможность',
    cmpColG: 'GROM',
    cmpColCex: 'Традиционный CEX',
    cmpColDex: 'DEX',
    cmpRows: [
      ['Свои ключи', 'Да (гибрид)', 'Нет', 'Да'],
      ['Скорость исполнения', '<1 мс', '<1 мс', '5-30 сек'],
      ['Комиссия', '0,10 %', '0,10-0,20 %', '0,3-1 %'],
      ['Депозит без KYC', 'до $2 000/день', 'Нет', 'Не нужен'],
      ['Ликвидность', 'Binance+Kraken+Coinbase', '1 источник', 'Фрагментированная'],
      ['AI-коуч в интерфейсе', 'Есть', 'Нет', 'Нет'],
      ['Prediction markets', 'Есть', 'Нет', 'Отдельные dApps'],
    ],
    faqEyebrow: 'FAQ',
    faqH: 'Частые вопросы',
    faqItems: [
      ['Нужен ли KYC?', 'До $2 000/день торговли и вывода — нет. Выше — потребуется верификация через Sumsub (5-10 минут). Binary Options с демо-балансом $50 000 — вообще без регистрации.'],
      ['У кого мои ключи?', 'На вкладке On-chain — только у тебя, GROM никогда не видит приватный ключ. На торговом счёте (Spot/Futures/Binary) баланс держится на нашей стороне для мгновенного исполнения — это гибрид, а не полный CEX.'],
      ['Как быстро приходит депозит?', 'USDT на Tron — 3 минуты. USDT на Arbitrum/Base — 3 минуты. BTC — 30 минут. Как только Binance master-адрес получает 1 подтверждение, баланс появляется у тебя.'],
      ['А если случится ликвидация с отрицательным equity?', 'Есть страховой USDT-пул, покрывающий такие ситуации — социализации убытков между пользователями нет.'],
      ['Сколько времени занимает регистрация?', '30 секунд. Email + Google → сразу торгуешь. MetaMask/Trust/OKX → SIWE-подпись → готово.'],
      ['Можно ли ввести/вывести фиатом?', 'Прямой rail с картой через MoonPay / Simplex (появляется во вкладке Cash). Гибкий вариант — купить USDT на Binance/CEX и перевести к нам, тогда ты платишь только сетевые комиссии.'],
    ],
  },
  en: {
    cmpEyebrow: 'GROM vs the rest',
    cmpH: 'Why traders switch to GROM',
    cmpCol0: 'Capability',
    cmpColG: 'GROM',
    cmpColCex: 'Traditional CEX',
    cmpColDex: 'DEX',
    cmpRows: [
      ['Your keys', 'Yes (hybrid)', 'No', 'Yes'],
      ['Fill latency', '<1 ms', '<1 ms', '5-30 s'],
      ['Trading fee', '0.10 %', '0.10-0.20 %', '0.3-1 %'],
      ['Deposit without KYC', 'up to $2,000/day', 'No', 'Not required'],
      ['Liquidity source', 'Binance+Kraken+Coinbase', 'Single venue', 'Fragmented'],
      ['AI coach inline', 'Yes', 'No', 'No'],
      ['Prediction markets', 'Yes', 'No', 'Separate dApps'],
    ],
    faqEyebrow: 'FAQ',
    faqH: 'Frequently asked',
    faqItems: [
      ['Do I need KYC?', 'Up to $2,000/day of trading and withdrawal — no. Above that we run Sumsub (5-10 min). Binary Options with the $50K demo balance requires no signup at all.'],
      ['Who holds my keys?', "On-chain tab — only you; GROM never sees your private key. Trading balance (Spot/Futures/Binary) is custodied for sub-millisecond fills — that's the hybrid, not a full CEX."],
      ['How fast are deposits?', 'USDT on Tron — 3 min. USDT on Arbitrum/Base — 3 min. BTC — 30 min. Once the Binance master address gets 1 confirmation, your balance shows up.'],
      ['What if a negative-equity liquidation happens?', "There's a USDT insurance pool that covers those events — no socialized losses across users."],
      ['How long is sign-up?', '30 seconds. Email + Google — trade immediately. MetaMask/Trust/OKX — SIWE signature — done.'],
      ['Can I use fiat?', 'Direct card rail via MoonPay / Simplex on the Cash tab. Or buy USDT on Binance/any CEX and transfer to GROM — you only pay network fees.'],
    ],
  },
  es: {
    cmpEyebrow: 'GROM vs el resto',
    cmpH: 'Por qué los traders eligen GROM',
    cmpCol0: 'Capacidad', cmpColG: 'GROM', cmpColCex: 'CEX clásico', cmpColDex: 'DEX',
    cmpRows: [
      ['Tus llaves', 'Sí (híbrido)', 'No', 'Sí'],
      ['Latencia', '<1 ms', '<1 ms', '5-30 s'],
      ['Comisión', '0,10 %', '0,10-0,20 %', '0,3-1 %'],
      ['Sin KYC', 'hasta $2 000/día', 'No', 'No aplica'],
      ['Liquidez', 'Binance+Kraken+Coinbase', 'Una fuente', 'Fragmentada'],
      ['IA coach', 'Sí', 'No', 'No'],
      ['Prediction markets', 'Sí', 'No', 'dApps separadas'],
    ],
    faqEyebrow: 'FAQ', faqH: 'Preguntas frecuentes',
    faqItems: [
      ['¿Necesito KYC?', 'Hasta $2 000/día — no. Por encima, verificación con Sumsub (5-10 min).'],
      ['¿Quién guarda mis llaves?', 'En on-chain solo tú. Trading es custodiado para velocidad.'],
      ['¿Depósitos rápidos?', 'USDT Tron — 3 min. BTC — 30 min.'],
      ['¿Liquidaciones con equity negativo?', 'Cubiertas por el fondo de seguros.'],
      ['¿Registro?', '30 segundos con email + Google.'],
      ['¿Fiat?', 'MoonPay / Simplex en Cash.'],
    ],
  },
  ar: {
    cmpEyebrow: 'GROM مقابل الآخرين',
    cmpH: 'لماذا يختار المتداولون GROM',
    cmpCol0: 'الميزة', cmpColG: 'GROM', cmpColCex: 'CEX تقليدي', cmpColDex: 'DEX',
    cmpRows: [
      ['مفاتيحك', 'نعم (هجين)', 'لا', 'نعم'],
      ['السرعة', '<1 مللي', '<1 مللي', '5-30 ث'],
      ['العمولة', '0.10٪', '0.10-0.20٪', '0.3-1٪'],
      ['بدون KYC', 'حتى $2,000/يوم', 'لا', 'غير مطلوب'],
      ['السيولة', 'Binance+Kraken+Coinbase', 'مصدر واحد', 'مجزأة'],
      ['مدرّب AI', 'نعم', 'لا', 'لا'],
      ['أسواق التنبؤ', 'نعم', 'لا', 'تطبيقات منفصلة'],
    ],
    faqEyebrow: 'الأسئلة', faqH: 'الأسئلة الشائعة',
    faqItems: [
      ['هل أحتاج KYC؟', 'حتى $2000/يوم — لا. أعلى — Sumsub خلال 5-10 دقائق.'],
      ['من يحتفظ بمفاتيحي؟', 'On-chain: أنت فقط. Trading: عهدة للسرعة.'],
      ['سرعة الإيداع؟', 'USDT Tron — 3 د. BTC — 30 د.'],
      ['التصفية السلبية؟', 'صندوق تأمين USDT يغطي.'],
      ['التسجيل؟', '30 ثانية عبر Email + Google.'],
      ['الفيات؟', 'MoonPay / Simplex في تبويب Cash.'],
    ],
  },
  zh: {
    cmpEyebrow: 'GROM 对比',
    cmpH: '为什么交易者选择 GROM',
    cmpCol0: '功能', cmpColG: 'GROM', cmpColCex: '传统 CEX', cmpColDex: 'DEX',
    cmpRows: [
      ['你的私钥', '是（混合）', '否', '是'],
      ['成交延迟', '<1 毫秒', '<1 毫秒', '5-30 秒'],
      ['交易费率', '0.10%', '0.10-0.20%', '0.3-1%'],
      ['免 KYC', '每日 $2,000', '否', '不需要'],
      ['流动性', 'Binance+Kraken+Coinbase', '单一来源', '碎片化'],
      ['AI 教练', '有', '无', '无'],
      ['预测市场', '有', '无', '独立 dApp'],
    ],
    faqEyebrow: '常见问题', faqH: '常见问题',
    faqItems: [
      ['需要 KYC 吗？', '每日 $2,000 以内 — 不需要。超过 — Sumsub 5-10 分钟。'],
      ['谁保管密钥？', '链上：只有你。交易账户：托管以获得极速成交。'],
      ['充值多快？', 'Tron USDT — 3 分钟。BTC — 30 分钟。'],
      ['负资产爆仓怎么办？', 'USDT 保险池覆盖，用户之间不摊派损失。'],
      ['注册要多久？', '30 秒。邮箱 + Google 即可。'],
      ['能用法币吗？', 'Cash 页面里 MoonPay / Simplex。'],
    ],
  },
  hi: {
    cmpEyebrow: 'GROM बनाम बाकी',
    cmpH: 'ट्रेडर GROM क्यों चुनते हैं',
    cmpCol0: 'क्षमता', cmpColG: 'GROM', cmpColCex: 'क्लासिक CEX', cmpColDex: 'DEX',
    cmpRows: [
      ['आपकी चाबियाँ', 'हाँ (हाइब्रिड)', 'नहीं', 'हाँ'],
      ['गति', '<1 ms', '<1 ms', '5-30 s'],
      ['शुल्क', '0.10%', '0.10-0.20%', '0.3-1%'],
      ['बिना KYC', '$2000/दिन तक', 'नहीं', 'ज़रूरी नहीं'],
      ['लिक्विडिटी', 'Binance+Kraken+Coinbase', 'एक स्रोत', 'बिखरी हुई'],
      ['AI कोच', 'हाँ', 'नहीं', 'नहीं'],
      ['Predict market', 'हाँ', 'नहीं', 'अलग dApps'],
    ],
    faqEyebrow: 'FAQ', faqH: 'सामान्य प्रश्न',
    faqItems: [
      ['KYC चाहिए?', '$2000/दिन तक नहीं।'],
      ['चाबी किसके पास?', 'On-chain: सिर्फ आप। Trading: कस्टडी।'],
      ['जमा गति?', 'USDT Tron — 3 मिनट।'],
      ['लिक्विडेशन?', 'USDT बीमा पूल।'],
      ['साइनअप?', '30 सेकंड।'],
      ['फ़िएट?', 'MoonPay / Simplex।'],
    ],
  },
  tr: {
    cmpEyebrow: 'GROM ile karşılaştır',
    cmpH: 'Traderlar neden GROM\'a geçiyor',
    cmpCol0: 'Özellik', cmpColG: 'GROM', cmpColCex: 'Klasik CEX', cmpColDex: 'DEX',
    cmpRows: [
      ['Anahtarlar sende', 'Evet (hibrit)', 'Hayır', 'Evet'],
      ['Gecikme', '<1 ms', '<1 ms', '5-30 sn'],
      ['Ücret', '%0,10', '%0,10-0,20', '%0,3-1'],
      ['KYC\'siz limit', '$2.000/gün', 'Yok', 'Gerekmez'],
      ['Likidite', 'Binance+Kraken+Coinbase', 'Tek borsa', 'Parçalı'],
      ['AI koç', 'Var', 'Yok', 'Yok'],
      ['Tahmin piyasası', 'Var', 'Yok', 'Ayrı dApp'],
    ],
    faqEyebrow: 'SSS', faqH: 'Sık sorulanlar',
    faqItems: [
      ['KYC şart mı?', '$2.000/gün altı hayır.'],
      ['Anahtarlar kimde?', 'Zincir üstü: sen. İşlem: emanet.'],
      ['Yatırma hızı?', 'Tron USDT — 3 dk.'],
      ['Negatif tasfiye?', 'USDT sigorta havuzu karşılar.'],
      ['Kayıt?', '30 saniye.'],
      ['Fiat?', 'MoonPay / Simplex Cash sekmesinde.'],
    ],
  },
};
function gwLpLang() { let l='en'; try { const s=localStorage.getItem('grom_lang'); if (s&&GW_LP_TR[s]) l=s; } catch (_) {} return GW_LP_TR[l]||GW_LP_TR.en; }

function gwInjectLpPolishCss() {
  if (document.getElementById('gw-lp-polish-css')) return;
  const css = `
    .gw-lp-cmp, .gw-lp-faq { max-width: 1240px; margin: 60px auto 0; padding: 40px 24px; }
    .gw-lp-cmp-card, .gw-lp-faq-card {
      padding: 32px; border-radius: 24px; color: #e7eef8;
      background: linear-gradient(180deg, rgba(11,18,32,.72), rgba(8,12,20,.55));
      border: 1px solid rgba(122,162,199,.18);
      backdrop-filter: blur(10px);
    }
    .gw-lp-eyebrow { display: inline-block; padding: 5px 12px; border-radius: 999px;
      background: rgba(0,194,255,.12); border: 1px solid rgba(0,194,255,.3);
      font-size: 10.5px; font-weight: 800; letter-spacing: .16em; text-transform: uppercase; color: #5dd5ff; }
    .gw-lp-h { margin: 14px 0 22px; font-size: 30px; font-weight: 900; letter-spacing: -0.01em; color: #fff; }
    @media (max-width: 640px) { .gw-lp-h { font-size: 22px; } }
    .gw-lp-cmp-table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
    .gw-lp-cmp-table th, .gw-lp-cmp-table td { padding: 12px 10px; text-align: left; }
    .gw-lp-cmp-table th { color: #98a8c0; font-weight: 800; font-size: 11.5px; letter-spacing: .1em; text-transform: uppercase; border-bottom: 1px solid rgba(255,255,255,.08); }
    .gw-lp-cmp-table th.grom { color: #00c2ff; }
    .gw-lp-cmp-table td { border-bottom: 1px solid rgba(255,255,255,.04); color: #cfdfee; }
    .gw-lp-cmp-table td.grom { color: #fff; font-weight: 700; }
    .gw-lp-cmp-table tr:last-child td { border-bottom: 0; }
    .gw-lp-cmp-wrapper { overflow-x: auto; -webkit-overflow-scrolling: touch; }
    @media (max-width: 640px) { .gw-lp-cmp-table { font-size: 12.5px; min-width: 520px; } }

    .gw-lp-faq-list { display: flex; flex-direction: column; gap: 8px; margin-top: 6px; }
    .gw-lp-faq-item { padding: 14px 16px; border-radius: 14px; background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.06); cursor: pointer; transition: background .18s, border-color .18s; }
    .gw-lp-faq-item:hover { background: rgba(255,255,255,.06); border-color: rgba(0,194,255,.22); }
    .gw-lp-faq-q { display: flex; justify-content: space-between; align-items: center; gap: 10px; font-weight: 800; font-size: 14.5px; color: #e7eef8; }
    .gw-lp-faq-q .caret { color: #5dd5ff; font-size: 18px; transition: transform .2s; }
    .gw-lp-faq-item.open .gw-lp-faq-q .caret { transform: rotate(45deg); }
    .gw-lp-faq-a { max-height: 0; overflow: hidden; transition: max-height .3s; font-size: 13.5px; color: #cfdfee; line-height: 1.55; }
    .gw-lp-faq-item.open .gw-lp-faq-a { max-height: 420px; margin-top: 10px; }
  `;
  const s = document.createElement('style'); s.id = 'gw-lp-polish-css'; s.textContent = css; document.head.appendChild(s);
}

function gwRenderLandingPolish() {
  const page = document.getElementById('page-landing');
  if (!page) return;
  gwInjectLpPolishCss();
  // remove old (for lang change)
  page.querySelector('.gw-lp-cmp')?.remove();
  page.querySelector('.gw-lp-faq')?.remove();

  const t = gwLpLang();

  const cmp = document.createElement('section');
  cmp.className = 'gw-lp-cmp';
  cmp.innerHTML = `
    <div class="gw-lp-cmp-card">
      <span class="gw-lp-eyebrow">${t.cmpEyebrow}</span>
      <h2 class="gw-lp-h">${t.cmpH}</h2>
      <div class="gw-lp-cmp-wrapper">
        <table class="gw-lp-cmp-table">
          <thead><tr>
            <th>${t.cmpCol0}</th>
            <th class="grom">${t.cmpColG}</th>
            <th>${t.cmpColCex}</th>
            <th>${t.cmpColDex}</th>
          </tr></thead>
          <tbody>
            ${t.cmpRows.map((r) => `<tr>
              <td>${r[0]}</td>
              <td class="grom">${r[1]}</td>
              <td>${r[2]}</td>
              <td>${r[3]}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  const faq = document.createElement('section');
  faq.className = 'gw-lp-faq';
  faq.innerHTML = `
    <div class="gw-lp-faq-card">
      <span class="gw-lp-eyebrow">${t.faqEyebrow}</span>
      <h2 class="gw-lp-h">${t.faqH}</h2>
      <div class="gw-lp-faq-list">
        ${t.faqItems.map((qa, i) => `
          <div class="gw-lp-faq-item ${i === 0 ? 'open' : ''}">
            <div class="gw-lp-faq-q">${qa[0]}<span class="caret">+</span></div>
            <div class="gw-lp-faq-a">${qa[1]}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  // Insert BEFORE the final CTA (last .lp-final-cta or before the closing lp-wrap)
  const finalCta = page.querySelector('.lp-final-cta');
  const wrap = page.querySelector('.lp-wrap') || page;
  if (finalCta && finalCta.parentNode === wrap) {
    wrap.insertBefore(cmp, finalCta);
    wrap.insertBefore(faq, finalCta);
  } else {
    wrap.appendChild(cmp);
    wrap.appendChild(faq);
  }

  // Wire FAQ open/close.
  faq.querySelectorAll('.gw-lp-faq-item').forEach((it) => {
    const q = it.querySelector('.gw-lp-faq-q');
    q.addEventListener('click', () => it.classList.toggle('open'));
  });
}

function gwSetupLandingPolish() {
  const tryRender = gwDebounce(() => {
    if (document.getElementById('page-landing')) {
      try { gwRenderLandingPolish(); console.log('[GROM] landing polish rendered'); }
      catch (e) { console.warn('[GROM] landing polish', e); }
    }
  }, 200);
  tryRender();
  let n = 0; const id = setInterval(() => { n++; if (document.querySelector('#page-landing .gw-lp-faq') || n >= 20) clearInterval(id); else tryRender(); }, 500);
  window.addEventListener('hashchange', tryRender);
  const obs = new MutationObserver(() => tryRender()); obs.observe(document.body, { attributes: true, subtree: false, attributeFilter: ['data-page'] });
  window.addEventListener('grom:lang-change', tryRender);
}


/* ----- экспорт для отладки ----- */
window.gromWallet = {
  connectMetaMask, connectTrust, connectBinanceWeb3,
  connectOkx, connectCoinbase, connectWC,
  connectEmail, gromWalletConnect,
  disconnect, signSiwe,
  signSiweAndVerify: authenticateWithSIWE,
  fetchOnchainBalances: window.gromFetchOnchainBalances,
  state: () => ({ account: currentAccount, chainId: currentChainId }),
  get wcProvider() { return wcProvider; },
  networks: GROM_NETWORKS,
  assetNets: GROM_ASSET_NETS,
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', hook);
} else {
  hook();
}
