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
  if (!provider) {
    if (isMobileUA()) {
      if (typeof window.toast === 'function') window.toast('Opening GROM in MetaMask…', 'info');
      openInWalletBrowser('mm');
      return;
    }
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
  if (isMobileUA()) {
    if (typeof window.toast === 'function') window.toast('Opening GROM in Trust Wallet…', 'info');
    openInWalletBrowser('trust');
    return;
  }
  if (typeof window.toast === 'function') window.toast('Scan QR with Trust Wallet app', 'info');
  return connectWC();
}

/* ----- 3. Binance Web3 Wallet ----- */
async function connectBinanceWeb3() {
  let provider = rdnsProvider('com.binance.wallet');
  if (!provider) provider = findLegacy(isBinanceProvider);
  if (!provider && window.BinanceChain?.request) provider = window.BinanceChain;
  if (provider) return connectWithProvider(provider, 'Binance Web3 Wallet');
  if (isMobileUA()) {
    if (typeof window.toast === 'function') window.toast('Open grom.exchange in Binance Web3 Wallet browser, then connect', 'info');
    openInWalletBrowser('bnw3');
    return;
  }
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
async function ensureWC(forceNew) {
  if (wcProvider && !forceNew) return wcProvider;
  if (wcProvider) {
    try { await wcProvider.disconnect(); } catch (_) {}
    wcProvider = null;
  }
  if (!WC_PROJECT_ID || WC_PROJECT_ID === 'YOUR_WC_PROJECT_ID_HERE') {
    throw new Error('Set WC_PROJECT_ID в grom-wallet.js');
  }
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


/* Floating Telegram contact button — pinned bottom-right on all pages, link
 * to https://t.me/grom_finence_hub. Used for support, investor inquiries,
 * community. CSS-injected so we don't touch Cursor's index.html. Hidden on
 * print + reduced motion gets a static (non-animated) variant. */
function gwInjectTelegramFab() {
  if (document.getElementById('gw-tg-fab')) return;
  const css = `
    #gw-tg-fab {
      position: fixed; right: 18px; bottom: 18px;
      z-index: 60;
      display: inline-flex; align-items: center; gap: 8px;
      padding: 11px 16px 11px 13px;
      border-radius: 999px;
      background: linear-gradient(135deg, #29a9eb 0%, #1f8fd0 60%, #166fb0 100%);
      color: #fff !important;
      font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
      font-size: 13px; font-weight: 700; letter-spacing: .02em;
      text-decoration: none !important;
      box-shadow: 0 10px 28px -8px rgba(41,169,235,0.55), 0 2px 0 rgba(255,255,255,0.08) inset;
      border: 1px solid rgba(255,255,255,0.14);
      cursor: pointer;
      transition: transform .25s cubic-bezier(.2,.7,.2,1), box-shadow .25s, opacity .2s;
      -webkit-tap-highlight-color: transparent;
    }
    #gw-tg-fab:hover { transform: translateY(-2px) scale(1.02); box-shadow: 0 14px 36px -10px rgba(41,169,235,0.7); }
    #gw-tg-fab:active { transform: translateY(0) scale(0.98); }
    #gw-tg-fab .gw-tg-ico {
      width: 24px; height: 24px;
      border-radius: 50%;
      background: radial-gradient(circle at 30% 30%, #fff, #eaf6fe 70%);
      display: inline-flex; align-items: center; justify-content: center;
      box-shadow: 0 2px 6px rgba(0,0,0,0.25) inset, 0 0 0 1px rgba(255,255,255,0.4);
    }
    #gw-tg-fab .gw-tg-ico svg { width: 14px; height: 14px; }
    #gw-tg-fab::after {
      content: "";
      position: absolute; inset: -4px;
      border-radius: 999px;
      border: 2px solid rgba(41,169,235,0.55);
      opacity: 0;
      animation: gwTgPulse 2.4s ease-out infinite;
      pointer-events: none;
    }
    @keyframes gwTgPulse {
      0%   { opacity: 0.6; transform: scale(0.94); }
      80%  { opacity: 0;   transform: scale(1.12); }
      100% { opacity: 0;   transform: scale(1.12); }
    }
    @media (max-width: 600px) {
      #gw-tg-fab {
        right: 12px; bottom: 12px;
        padding: 10px 14px 10px 11px;
        font-size: 12.5px;
      }
    }
    @media print { #gw-tg-fab { display: none !important; } }
    @media (prefers-reduced-motion: reduce) {
      #gw-tg-fab::after { animation: none; }
      #gw-tg-fab:hover { transform: none; }
    }
  `;
  const style = document.createElement('style');
  style.id = 'gw-tg-fab-css';
  style.textContent = css;
  document.head.appendChild(style);

  const mount = () => {
    if (document.getElementById('gw-tg-fab') || !document.body) return;
    const a = document.createElement('a');
    a.id = 'gw-tg-fab';
    a.href = 'https://t.me/grom_finence_hub';
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.setAttribute('aria-label', 'Telegram канал GROM');
    a.innerHTML = '<span class="gw-tg-ico"><svg viewBox="0 0 24 24" fill="#1f8fd0" xmlns="http://www.w3.org/2000/svg"><path d="M9.999 15.2l-.397 5.6c.567 0 .812-.243 1.108-.535l2.66-2.54 5.514 4.034c1.011.557 1.724.265 1.997-.937L23.92 3.06c.36-1.5-.542-2.085-1.523-1.72L1.116 9.534c-1.466.57-1.444 1.39-.25 1.762l5.46 1.704 12.683-7.99c.597-.395 1.14-.176.694.218z"/></svg></span><span>Telegram</span>';
    document.body.appendChild(a);
  };

  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount, { once: true });
}

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
  try {
    const chip = document.getElementById('walletChipAddr')?.textContent?.trim();
    if (chip && /^0x[a-fA-F0-9]{40}$/.test(chip)) return chip;
  } catch (_) {}
  try {
    const stored = localStorage.getItem('grom_wallet_label');
    if (stored && /^0x[a-fA-F0-9]{40}$/.test(stored)) return stored;
  } catch (_) {}
  try {
    if (window.gromWallet?.state) {
      const s = window.gromWallet.state();
      if (s?.account && /^0x[a-fA-F0-9]{40}$/.test(s.account)) return s.account;
    }
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
  // Also mount the card whenever page-wallet appears (Cursor's SPA router).
  const bodyObs = new MutationObserver(() => tryRender());
  bodyObs.observe(document.body, { attributes: true, subtree: false, attributeFilter: ['data-page'] });
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
  if (typeof window.openConnectModal === 'function') {
    try { window.openConnectModal(); return; } catch (e) {}
  }
  // Fallback — click the visible "Sign in / Sign up" button.
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
    if (gwIsAuthed() || ticks >= 20) clearInterval(id);
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
  { sym: 'BTC',  name: 'Bitcoin' },
  { sym: 'ETH',  name: 'Ethereum' },
  { sym: 'USDC', name: 'USD Coin' },
  { sym: 'SOL',  name: 'Solana' },
  { sym: 'BNB',  name: 'BNB' },
  { sym: 'XRP',  name: 'Ripple' },
  { sym: 'TRX',  name: 'Tron' },
  { sym: 'DOGE', name: 'Dogecoin' },
  { sym: 'ADA',  name: 'Cardano' },
  { sym: 'AVAX', name: 'Avalanche' },
];

const GW_DS_TR = {
  ru: { h: 'Мгновенный своп', sub: 'Обмен между активами без комиссий сети. Расчёт за секунды через Binance Convert.', from: 'Отдаёшь', to: 'Получаешь', est: 'Введи сумму, чтобы увидеть курс.', cta: 'Сделать своп', getting: 'Запрос курса…', ratemsg: '1 {from} ≈ {rate} {to} · ~{out} {to}' },
  en: { h: 'Instant swap',     sub: 'Swap any two assets, zero network fees, settles in seconds via Binance Convert.', from: 'You pay',     to: 'You get',      est: 'Enter an amount to see the live rate.', cta: 'Swap now',  getting: 'Fetching rate…',  ratemsg: '1 {from} ≈ {rate} {to} · ~{out} {to}' },
  es: { h: 'Swap instantáneo', sub: 'Intercambia dos activos, sin comisiones de red, liquida en segundos vía Binance Convert.', from: 'Pagas', to: 'Recibes', est: 'Introduce un importe para ver el tipo en vivo.', cta: 'Hacer swap', getting: 'Obteniendo tipo…', ratemsg: '1 {from} ≈ {rate} {to} · ~{out} {to}' },
  ar: { h: 'مبادلة فوريّة', sub: 'بدّل بين أي أصلين دون رسوم شبكة، تتم التسوية خلال ثوانٍ عبر Binance Convert.', from: 'تدفع', to: 'تستلم', est: 'أدخل المبلغ لرؤية السعر.', cta: 'مبادلة', getting: 'جلب السعر…', ratemsg: '1 {from} ≈ {rate} {to} · ~{out} {to}' },
  zh: { h: '极速兑换',        sub: '任意两种资产秒级兑换，零网络手续费，通过 Binance Convert 结算。', from: '你支付', to: '你得到', est: '输入金额以查看实时汇率。', cta: '立即兑换', getting: '获取报价…', ratemsg: '1 {from} ≈ {rate} {to} · ~{out} {to}' },
  hi: { h: 'इंस्टेंट स्वैप',     sub: 'किन्हीं दो एसेट्स में स्वैप, शून्य नेटवर्क फी — Binance Convert के ज़रिए।', from: 'आप देते हैं', to: 'आप पाते हैं', est: 'दर देखने के लिए राशि दर्ज करें।', cta: 'अभी स्वैप करें', getting: 'दर ली जा रही है…', ratemsg: '1 {from} ≈ {rate} {to} · ~{out} {to}' },
  tr: { h: 'Anlık swap',       sub: 'İki varlık arasında sıfır ağ ücretiyle saniyeler içinde takas — Binance Convert üzerinden.', from: 'Verdiğin', to: 'Aldığın', est: 'Canlı kuru görmek için bir tutar gir.', cta: 'Swap yap', getting: 'Kur çekiliyor…', ratemsg: '1 {from} ≈ {rate} {to} · ~{out} {to}' },
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
    .gw-ds-wrap { margin: 12px 0 4px; }
    .gw-ds-card {
      position: relative;
      isolation: isolate;
      padding: 22px 22px 20px;
      border-radius: 22px;
      background:
        radial-gradient(120% 140% at 0% 0%, rgba(0,194,255,0.10), transparent 55%),
        linear-gradient(155deg, rgba(13,22,38,0.72) 0%, rgba(8,14,26,0.92) 100%);
      border: 1px solid rgba(255,255,255,0.07);
      box-shadow:
        0 1px 0 rgba(255,255,255,0.06) inset,
        0 14px 38px -18px rgba(0,0,0,0.55);
      backdrop-filter: blur(14px) saturate(150%);
      -webkit-backdrop-filter: blur(14px) saturate(150%);
      overflow: hidden;
      color: #e7eef8;
    }
    .gw-ds-card::before {
      content: ""; position: absolute; inset: -2px;
      padding: 1.5px; border-radius: inherit;
      background: conic-gradient(from 0deg, #00c2ff 0%, transparent 25%, #6e8dff 50%, transparent 75%, #00c2ff 100%);
      -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
              mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
      -webkit-mask-composite: xor; mask-composite: exclude;
      opacity: 0.6;
      animation: gwBnSpin 16s linear infinite; /* shares keyframes with banners */
      pointer-events: none; z-index: 0;
    }
    .gw-ds-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 14px; position: relative; z-index: 1; margin-bottom: 14px; }
    .gw-ds-title { font-size: 18px; font-weight: 800; letter-spacing: -0.01em;
      background: linear-gradient(180deg,#fff,#c7d8ec); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; margin: 0 0 4px; }
    .gw-ds-sub { font-size: 12.5px; color: #98a8c0; line-height: 1.5; margin: 0; max-width: 520px; }
    .gw-ds-badge { background: rgba(0,194,255,0.18); color: #3ac2ff; padding: 3px 10px; border-radius: 999px; font-size: 10px; font-weight: 800; letter-spacing: .14em; align-self: center; }

    .gw-ds-form { position: relative; z-index: 1; display: grid; grid-template-columns: 1fr; gap: 8px; }
    .gw-ds-row { display: grid; grid-template-columns: 120px 1fr; gap: 10px; align-items: center;
      padding: 14px; border-radius: 14px;
      background: rgba(255,255,255,0.025); border: 1px solid rgba(255,255,255,0.06); }
    .gw-ds-row .lbl { font-size: 11px; color: #6b7a92; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; grid-column: 1 / -1; margin-bottom: -4px; }
    .gw-ds-row select, .gw-ds-row input {
      background: rgba(255,255,255,0.06); color: #e7eef8;
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 10px; padding: 10px 12px;
      font-family: inherit; font-size: 15px; font-weight: 700;
      outline: none; -webkit-appearance: none; appearance: none;
    }
    .gw-ds-row select { background-image: linear-gradient(45deg, transparent 50%, #8aa0bc 50%), linear-gradient(135deg, #8aa0bc 50%, transparent 50%); background-position: calc(100% - 14px) center, calc(100% - 9px) center; background-size: 5px 5px, 5px 5px; background-repeat: no-repeat; padding-right: 28px; }
    .gw-ds-row input { text-align: right; }
    .gw-ds-row input:focus, .gw-ds-row select:focus { border-color: rgba(0,194,255,0.5); }

    .gw-ds-swap-icon { display: flex; justify-content: center; margin: -2px 0; }
    .gw-ds-swap-icon button {
      width: 34px; height: 34px;
      display: inline-flex; align-items: center; justify-content: center;
      border-radius: 50%; border: 1px solid rgba(255,255,255,0.1);
      background: linear-gradient(135deg, rgba(0,194,255,0.18), rgba(110,141,255,0.10));
      color: #3ac2ff; cursor: pointer; transition: transform .2s, background .2s;
      font-size: 16px;
    }
    .gw-ds-swap-icon button:hover { transform: rotate(180deg); background: linear-gradient(135deg, rgba(0,194,255,0.30), rgba(110,141,255,0.18)); }

    .gw-ds-rate { font-size: 12.5px; color: #98a8c0; padding: 4px 4px 0; min-height: 18px; }
    .gw-ds-rate.warn { color: #f5b94d; }
    .gw-ds-rate.err  { color: #f87171; }

    .gw-ds-cta {
      margin-top: 10px;
      width: 100%;
      padding: 14px 18px;
      border-radius: 14px; border: 0;
      background: linear-gradient(135deg, #00c2ff, #5d8eff);
      color: #001624; font-weight: 800; font-size: 14.5px; letter-spacing: .02em;
      cursor: pointer;
      box-shadow: 0 10px 26px -10px rgba(0,194,255,0.55);
      transition: transform .2s, box-shadow .2s, opacity .2s;
    }
    .gw-ds-cta:hover { transform: translateY(-1px); box-shadow: 0 14px 32px -10px rgba(0,194,255,0.75); }
    .gw-ds-cta:active { transform: translateY(0); }
    .gw-ds-cta[disabled] { opacity: 0.6; cursor: not-allowed; }

    @media (max-width: 600px) {
      .gw-ds-row { grid-template-columns: 100px 1fr; padding: 12px; }
      .gw-ds-row select, .gw-ds-row input { padding: 9px 10px; font-size: 14px; }
    }
  `;
  const style = document.createElement('style');
  style.id = 'gw-ds-css';
  style.textContent = css;
  document.head.appendChild(style);
}

function gwDsBuildPanel() {
  const t = gwDsLang();
  const optionsFor = (selectedSym) => GW_DS_ASSETS
    .map((a) => `<option value="${a.sym}" ${a.sym === selectedSym ? 'selected' : ''}>${a.sym} · ${a.name}</option>`)
    .join('');
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
      <div class="gw-ds-form">
        <div class="gw-ds-row">
          <div class="lbl">${t.from}</div>
          <select id="gwDsFrom">${optionsFor('USDT')}</select>
          <input id="gwDsAmt" type="number" min="0" step="any" placeholder="0.00" />
        </div>
        <div class="gw-ds-swap-icon">
          <button type="button" id="gwDsFlip" aria-label="Flip">⇅</button>
        </div>
        <div class="gw-ds-row">
          <div class="lbl">${t.to}</div>
          <select id="gwDsTo">${optionsFor('BTC')}</select>
          <input id="gwDsOut" type="text" readonly placeholder="0.00" />
        </div>
        <div class="gw-ds-rate" id="gwDsRate">${t.est}</div>
        <button type="button" class="gw-ds-cta" id="gwDsCta">${t.cta} →</button>
      </div>
    </div>
  `;
  return wrap;
}

let gwDsQuoteAbort = null;
let gwDsQuoteTimer = null;
async function gwDsRefreshRate() {
  const t = gwDsLang();
  const rateEl = document.getElementById('gwDsRate');
  const outEl  = document.getElementById('gwDsOut');
  if (!rateEl || !outEl) return;
  const from = document.getElementById('gwDsFrom')?.value || 'USDT';
  const to   = document.getElementById('gwDsTo')?.value   || 'BTC';
  const amt  = Number(document.getElementById('gwDsAmt')?.value || 0);
  rateEl.className = 'gw-ds-rate';
  if (amt <= 0) { rateEl.textContent = t.est; outEl.value = ''; return; }
  if (from === to) { rateEl.className = 'gw-ds-rate warn'; rateEl.textContent = '⚠ ' + (from === to ? 'Different assets required' : ''); outEl.value = ''; return; }
  rateEl.textContent = t.getting;
  try {
    if (gwDsQuoteAbort) gwDsQuoteAbort.abort();
    gwDsQuoteAbort = new AbortController();
    const jwt = localStorage.getItem('grom_jwt');
    const headers = { 'Content-Type': 'application/json' };
    if (jwt) headers.Authorization = `Bearer ${jwt}`;
    const r = await fetch('/api/swap/convert/quote', {
      method: 'POST', headers, signal: gwDsQuoteAbort.signal,
      body: JSON.stringify({ from, to, fromAmount: amt }),
    });
    const q = await r.json();
    if (q.error) { rateEl.className = 'gw-ds-rate warn'; rateEl.textContent = q.error; outEl.value = ''; return; }
    outEl.value = q.toAmount;
    rateEl.textContent = t.ratemsg
      .replace('{from}', from)
      .replace('{rate}', Number(q.ratio).toFixed(6))
      .replace('{to}', to)
      .replace('{out}', q.toAmount);
  } catch (e) {
    if (e.name === 'AbortError') return;
    rateEl.className = 'gw-ds-rate err';
    rateEl.textContent = 'Rate unavailable';
  }
}

async function gwDsSubmit() {
  if (!gwIsAuthed()) { gwOpenSignIn(); return; }
  // Re-use the wallet modal's swap submitter by mirroring values into its
  // inputs (it's already battle-tested + handles errors uniformly).
  const map = { gwDsFrom: 'wmSwapFrom', gwDsTo: 'wmSwapTo', gwDsAmt: 'wmSwapAmt' };
  Object.entries(map).forEach(([from, to]) => {
    const src = document.getElementById(from);
    const dst = document.getElementById(to);
    if (src && dst) dst.value = src.value;
  });
  if (typeof window.gwSubmitSwap === 'function') {
    try { await window.gwSubmitSwap(); } catch (e) { console.warn('[dashSwap]', e); }
  } else if (typeof window.submitSwap === 'function') {
    try { await window.submitSwap(); } catch (e) { console.warn('[dashSwap]', e); }
  }
  // After submit, refresh dash rate
  setTimeout(gwDsRefreshRate, 600);
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
    gwInjectTelegramFab();
    gwInjectMiscOverridesCss();
    gwSetupAuthGate();
    gwSetupDashSwap();
    gwSetupDepositAutoContinue();
    gwSetupOnchainCard();
  }
} catch (e) { /* defensive — never block module evaluation on cosmetic CSS */ }

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
