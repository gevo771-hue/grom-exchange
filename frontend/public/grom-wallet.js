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

/* ---------------------------------------------------------------------------
 * Suppress MetaMask's EIP-6963 hijack of Trust / Binance / OKX flows.
 *
 * User feedback (2026-07-07): even on Safari, clicking Trust surfaces a
 * yellow "Відкрити у MetaMask" bar under the Reown QR. It's not the
 * MM extension banner (Safari has none of that on iOS), and it's not
 * our JS calling `window.open('wc:')` (a246e6a already intercepts and
 * my [GROM] blocked logs never fired). The real source is MetaMask
 * announcing itself as an EIP-6963 provider — Reown Web3Modal listens
 * to `eip6963:announceProvider` and displays a shortcut / suggestion
 * for every wallet that answers, INCLUDING the browser-injected one.
 *
 * We short-circuit that at capture phase: any announce whose
 * detail.info.rdns is io.metamask gets stopImmediatePropagation before
 * Reown's listener sees it. Our own connectMetaMask() still works —
 * rdnsProvider('io.metamask') falls through to `window.ethereum.isMetaMask`
 * (line ~332), which the extension always exposes regardless of EIP-6963.
 * ------------------------------------------------------------------------- */
(function gwBlockMmEip6963() {
  if (typeof window === 'undefined') return;
  try {
    // Layer 1: capture-phase listener stops MM announces at the event
    // system level. Fires before any wallet-modal listener (Reown, etc).
    window.addEventListener('eip6963:announceProvider', (e) => {
      const rdns = e?.detail?.info?.rdns || '';
      if (rdns === 'io.metamask') e.stopImmediatePropagation();
    }, true);
    // Layer 2 (2026-07-09 reinforce): monkeypatch EventTarget.dispatchEvent
    // to DROP MM announces entirely — even if MetaMask fires them via a
    // sub-frame or through a different mechanism. Nothing downstream sees
    // them. Our own connectMetaMask still works because it falls through
    // to window.ethereum.isMetaMask directly.
    const origDispatch = EventTarget.prototype.dispatchEvent;
    EventTarget.prototype.dispatchEvent = function (evt) {
      try {
        if (evt && evt.type === 'eip6963:announceProvider'
            && evt.detail?.info?.rdns === 'io.metamask') {
          return false;
        }
      } catch (_) {}
      return origDispatch.call(this, evt);
    };
  } catch (_) {}
})();

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
  const ua = navigator.userAgent || '';
  if (/Android|iPhone|iPad|iPod/i.test(ua)) return true;
  // iPadOS 13+ often reports as Mac — detect via touch points.
  if ((navigator.maxTouchPoints || 0) > 1 && /Mac/i.test(navigator.platform || '')) return true;
  return window.innerWidth < 900;
}
function gromPageUrl() {
  return walletAppOrigin() + (location.pathname || '/') + (location.search || '') + (location.hash || '');
}
function openInWalletBrowser(_kind) {
  /* Deprecated — never redirect to wallet download / marketing pages. */
}

function isInsideWalletBrowser(walletKey) {
  const ua = navigator.userAgent || '';
  switch (walletKey) {
    case 'trust':
      return /TrustWallet/i.test(ua) || !!(window.trustwallet?.request);
    case 'metamask':
      return /MetaMask/i.test(ua);
    case 'binance':
      return /Binance/i.test(ua) || !!(window.BinanceChain);
    case 'okx':
      return /OKApp/i.test(ua) || !!(window.okxwallet);
    case 'coinbase':
      return /CoinbaseWallet/i.test(ua);
    default:
      return false;
  }
}

function wcExcludeIdsFor(walletKey) {
  return (walletKey === 'metamask' || walletKey === 'generic') ? [] : [WC_WALLET_IDS.metamask];
}
function trustWcDeepLink(uri) {
  return 'trust://wc?uri=' + encodeURIComponent(uri);
}
function trustWcUniversalLink(uri) {
  return 'https://link.trustwallet.com/wc?uri=' + encodeURIComponent(uri);
}
function setWalletWcDeepLinkChoice(walletKey) {
  const href = GW_WALLET_WC[walletKey]?.nativeScheme || 'trust://';
  try {
    localStorage.setItem('WALLETCONNECT_DEEPLINK_CHOICE', JSON.stringify({
      name: GW_WALLET_WC[walletKey]?.label || 'Wallet',
      href,
    }));
  } catch (_) {}
}
function gwHideWcModalOnly() {
  const modal = document.getElementById('gwWcModal');
  if (modal) modal.style.display = 'none';
  const explorer = document.getElementById('gwMoreWalletsModal');
  if (explorer) explorer.style.display = 'none';
}
let _wcPendingReject = null;
let _wcPendingKillTimer = null;
function gwClearWcPending() {
  gwSetWcFlowActive(false);
  if (_wcPendingKillTimer) { clearInterval(_wcPendingKillTimer); _wcPendingKillTimer = null; }
  _wcPendingReject = null;
}
function gwAbortPendingWc(reason) {
  const reject = _wcPendingReject;
  gwClearWcPending();
  if (reject) {
    try { reject(new Error(reason || 'Connection cancelled')); } catch (_) {}
  }
  gwHideWcModalOnly();
}
window.gwAbortPendingWc = gwAbortPendingWc;
function gwHideWcModal() {
  gwAbortPendingWc('Connection cancelled');
}
let _qrLib = null;
async function gwRenderQr(el, text) {
  if (!el || !text) return;
  el.innerHTML = '';
  try {
    if (!_qrLib) _qrLib = await import('https://esm.sh/qrcode@1.5.4');
    const canvas = document.createElement('canvas');
    await _qrLib.toCanvas(canvas, text, {
      width: 240, margin: 1, color: { dark: '#0b1220', light: '#ffffff' },
    });
    el.appendChild(canvas);
  } catch (_) {
    const img = document.createElement('img');
    img.src = 'https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=' + encodeURIComponent(text);
    img.alt = 'QR';
    img.width = 240;
    img.height = 240;
    img.decoding = 'async';
    el.appendChild(img);
  }
}
/** Binance-style QR modal — wallet logo, clean scan UI, no site redirects. */
function gwShowWcModal(walletKey, wcUri, opts) {
  gwInjectConnectModalCss();
  const cfg = gwWalletCfg(walletKey);
  if (!cfg) return;
  const mobile = opts?.mobile ?? isMobileUA();
  const qrPayload = mobile ? null : cfg.desktopQrLink(wcUri);
  let modal = document.getElementById('gwWcModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'gwWcModal';
    modal.innerHTML = [
      '<div class="gw-wc-backdrop">',
      '  <div class="gw-wc-panel gw-wc-panel--binance" role="dialog" aria-modal="true">',
      '    <div class="gw-wc-topbar">',
      '      <button type="button" class="gw-wc-back" aria-label="Back">←</button>',
      '      <span class="gw-wc-top-title">WalletConnect</span>',
      '      <button type="button" class="gw-wc-close" aria-label="Close">×</button>',
      '    </div>',
      '    <div class="gw-wc-brand">',
      '      <img class="gw-wc-icon-lg" alt="" width="48" height="48" decoding="async"/>',
      '      <h3 class="gw-wc-title"></h3>',
      '    </div>',
      '    <p class="gw-wc-lead"></p>',
      '    <div class="gw-wc-qr-wrap"><div class="gw-wc-qr-frame"><div class="gw-wc-qr"></div><img class="gw-wc-qr-badge" alt="" width="36" height="36" decoding="async"/></div></div>',
      '    <p class="gw-wc-scan-hint"></p>',
      '    <button type="button" class="gw-wc-open">Open in wallet app</button>',
      '  </div>',
      '</div>',
    ].join('');
    document.body.appendChild(modal);
    modal.querySelector('.gw-wc-close').onclick = () => gwHideWcModal();
    modal.querySelector('.gw-wc-back').onclick = () => {
      const fromExplorer = modal.dataset.fromExplorer === '1';
      gwHideWcModal();
      if (fromExplorer) gwOpenMoreWalletsExplorer();
      else if (typeof window.openConnectModal === 'function') window.openConnectModal();
    };
    modal.querySelector('.gw-wc-backdrop').onclick = (e) => {
      if (e.target.classList.contains('gw-wc-backdrop')) gwHideWcModal();
    };
    modal.querySelector('.gw-wc-open').onclick = () => {
      const u = modal.dataset.wcUri;
      const k = modal.dataset.walletKey || walletKey;
      if (u) openWalletWcApp(k, u);
    };
  }
  modal.dataset.walletKey = walletKey;
  modal.dataset.wcUri = wcUri;
  modal.dataset.fromExplorer = opts?.fromExplorer ? '1' : '0';
  modal.querySelector('.gw-wc-icon-lg').src = cfg.icon || '';
  modal.querySelector('.gw-wc-qr-badge').src = cfg.icon || '';
  modal.querySelector('.gw-wc-qr-badge').style.display = cfg.icon ? '' : 'none';
  modal.querySelector('.gw-wc-title').textContent = cfg.label;
  const lead = modal.querySelector('.gw-wc-lead');
  const qrWrap = modal.querySelector('.gw-wc-qr-wrap');
  const qrBox = modal.querySelector('.gw-wc-qr');
  const openBtn = modal.querySelector('.gw-wc-open');
  const hint = modal.querySelector('.gw-wc-scan-hint');
  const backBtn = modal.querySelector('.gw-wc-back');
  if (backBtn) backBtn.style.display = '';
  if (mobile) {
    lead.textContent = 'Confirm the connection in ' + cfg.label;
    qrWrap.style.display = 'none';
    openBtn.textContent = 'Open ' + cfg.label;
    openBtn.style.display = '';
    hint.textContent = 'Tap to open the wallet app directly — stay on this page to finish signing in.';
  } else {
    lead.textContent = '';
    qrWrap.style.display = '';
    openBtn.style.display = 'none';
    hint.textContent = 'Scan this QR code with your phone camera or inside the ' + cfg.label + ' app.';
    if (qrPayload) gwRenderQr(qrBox, qrPayload);
  }
  modal.style.display = 'flex';
  if (typeof window.closeConnectModal === 'function') window.closeConnectModal();
}
function openWalletWcApp(walletKey, wcUri) {
  const cfg = gwWalletCfg(walletKey) || GW_WALLET_WC.generic;
  const link = cfg.mobileScheme(wcUri);
  if (!link) return;
  try {
    window.location.href = link;
  } catch (_) {
    try {
      const a = document.createElement('a');
      a.href = link;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { try { a.remove(); } catch (_) {} }, 0);
    } catch (__) {}
  }
}
/** @deprecated use gwHideWcModal */
function gwHideTrustWcModal() { gwHideWcModal(); }

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
  if (typeof window.updateAuthUi === 'function') window.updateAuthUi();
  if (typeof window.toast === 'function' && addr) window.toast('Wallet connected · ' + short, 'success');
  // Broadcast address-known event so anything that renders on the connected
  // address (e.g. the on-chain balance card on the Wallet page) refreshes
  // immediately — no need to wait for SIWE. If SIWE later completes, the
  // JWT-based custodial section updates through the existing hydrate hooks.
  try {
    if (addr) {
      document.dispatchEvent(new CustomEvent('grom:wallet-connected', { detail: { address: addr } }));
      try { localStorage.setItem('grom_wallet_label', addr); } catch (_) {}
      try { gwInvalidateMpCache(); } catch (_) {}
      setTimeout(() => {
        try { gwRefreshCombinedPortfolioTotals(); } catch (_) {}
        try { gwRenderMetaPortfolio(); } catch (_) {}
        try { gwDsAutoPickFromToken(); } catch (_) {}
      }, 50);
    } else {
      document.dispatchEvent(new CustomEvent('grom:wallet-disconnected'));
      try { localStorage.removeItem('grom_wallet_label'); } catch (_) {}
    }
  } catch (_) {}
}

function failToast(e) {
  const msg = (e && e.message) ? e.message : String(e);
  if (/cancel/i.test(msg)) return;
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
  return !!(p?.isTrust || p?.isTrustWallet || p?.isTrustWalletProvider) && !p?.isMetaMask;
}
function resolveTrustProvider() {
  const picks = [];
  const rdns = rdnsProvider('com.trustwallet.app');
  if (rdns && isTrustProvider(rdns)) picks.push(rdns);
  const leg = findLegacy(isTrustProvider);
  if (leg) picks.push(leg);
  if (window.trustwallet?.request) picks.push(window.trustwallet);
  return picks.find((p) => isTrustProvider(p) && !isMetaMaskProvider(p)) || null;
}
function gwSetWcFlowActive(on) {
  document.documentElement.classList.toggle('gw-wc-flow', !!on);
  document.documentElement.classList.toggle('gw-trust-flow', !!on);
}
function gwSetTrustFlowActive(on) { gwSetWcFlowActive(on); }
function gwKillReownModals() {
  try {
    document.querySelectorAll('w3m-modal, wcm-modal, w3m-container, wcm-container').forEach((el) => {
      try { el.remove(); } catch (_) { el.style.display = 'none'; }
    });
  } catch (_) {}
}
function openTrustWcApp(uri) { openWalletWcApp('trust', uri); }
function standardWcNamespaces() {
  const methods = ['eth_sendTransaction', 'personal_sign', 'eth_signTypedData', 'eth_signTypedData_v4'];
  const events = ['chainChanged', 'accountsChanged'];
  // Trust Wallet rejects sessions that REQUIRE Arbitrum/exotic chains.
  // SIWE only needs Ethereum mainnet — other GROM chains stay optional.
  return {
    requiredNamespaces: {
      eip155: { methods, chains: ['eip155:1'], events },
    },
    optionalNamespaces: {
      eip155: {
        methods,
        chains: ['eip155:42161', 'eip155:56', 'eip155:137', 'eip155:8453', 'eip155:10', 'eip155:43114'],
        events,
      },
    },
  };
}
function primaryChainRef(session) {
  const acc = session?.namespaces?.eip155?.accounts?.[0];
  if (acc) return acc.split(':').slice(0, 2).join(':');
  return 'eip155:1';
}
function chainIdFromWcSession(session) {
  const ref = primaryChainRef(session);
  return parseInt(ref.split(':')[1], 10) || 1;
}
function buildSignClientEip1193(signClient, session) {
  const accounts = (session?.namespaces?.eip155?.accounts || [])
    .map((a) => a.split(':')[2]).filter(Boolean);
  const chainId = chainIdFromWcSession(session);
  currentChainId = chainId;
  return {
    accounts,
    session,
    signClient,
    request: async ({ method, params }) => {
      if (method === 'eth_accounts') return accounts;
      if (method === 'eth_chainId') return '0x' + chainIdFromWcSession(session).toString(16);
      return signClient.request({
        topic: session.topic,
        chainId: primaryChainRef(session),
        request: { method, params },
      });
    },
    on: (ev, cb) => signClient.on(ev, cb),
    removeListener: (ev, cb) => signClient.off(ev, cb),
    disconnect: async () => {
      await signClient.disconnect({
        topic: session.topic,
        reason: { code: 6000, message: 'User disconnected' },
      });
    },
  };
}
function trustWcNamespaces() { return standardWcNamespaces(); }
async function connectViaEthereumProvider(walletKey, uriHandler) {
  const cfg = GW_WALLET_WC[walletKey];
  const p = await ensureWC(true, {
    walletKey,
    showQrModal: false,
    requiredChains: [1],
    optionalChains: [42161, 8453, 137, 56, 10, 43114],
    recommendedWalletId: cfg?.id,
    excludeWalletIds: walletKey === 'trust' ? [WC_WALLET_IDS.metamask] : [],
  });
  if (uriHandler) p.on('display_uri', uriHandler);
  try {
    await p.connect();
  } finally {
    if (uriHandler) try { p.removeListener('display_uri', uriHandler); } catch (_) {}
  }
  const accs = await p.request({ method: 'eth_accounts' });
  if (!accs?.length) throw new Error('No accounts returned');
  return { provider: p, account: accs[0] };
}
async function finalizeWcConnection(provider, account) {
  updateChip(account);
  try { await authenticateWithSIWE(account, provider); }
  catch (err) { gwSiweFailToast(err); throw err; }
  return account;
}
/** @deprecated */
async function connectTrustViaEthereumProvider(uriHandler) {
  return connectViaEthereumProvider('trust', uriHandler);
}
async function finalizeTrustWcConnection(provider, account) {
  return finalizeWcConnection(provider, account);
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
  return connectWalletWC('metamask');
}

/* ----- 2. Trust Wallet ----- */
async function connectTrust() {
  return connectWalletWC('trust');
}

/* ----- 3. Binance Web3 Wallet ----- */
async function connectBinanceWeb3() {
  return connectWalletWC('binance');
}

/* ----- 4. OKX Wallet ----- */
async function connectOkx() {
  return connectWalletWC('okx');
}

/* ----- 5. Coinbase Wallet ----- */
async function connectCoinbase() {
  return connectWalletWC('coinbase');
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
let wcRecommendedForKey = null;

const GW_WALLET_WC = {
  metamask: {
    id: WC_WALLET_IDS.metamask,
    label: 'MetaMask',
    icon: '/assets/wallets/metamask.svg',
    nativeScheme: 'metamask://',
    mobileScheme: (uri) => 'metamask://wc?uri=' + encodeURIComponent(uri),
    desktopQrLink: (uri) => 'https://metamask.app.link/wc?uri=' + encodeURIComponent(uri),
    installUrl: 'https://metamask.io/download/',
    injectCheck: () => rdnsProvider('io.metamask', 'io.metamask.mobile') || findLegacy(isMetaMaskProvider),
  },
  trust: {
    id: WC_WALLET_IDS.trust,
    label: 'Trust Wallet',
    icon: '/assets/wallets/trust.svg',
    nativeScheme: 'trust://',
    mobileScheme: (uri) => 'trust://wc?uri=' + encodeURIComponent(uri),
    desktopQrLink: (uri) => 'https://link.trustwallet.com/wc?uri=' + encodeURIComponent(uri),
    installUrl: 'https://trustwallet.com/download',
    injectCheck: resolveTrustProvider,
  },
  binance: {
    id: WC_WALLET_IDS.binance,
    label: 'Binance Web3 Wallet',
    icon: '/assets/wallets/binance.svg',
    nativeScheme: 'bnc://',
    mobileScheme: (uri) => 'bnc://app.binance.com/cedefi/wc?uri=' + encodeURIComponent(uri),
    desktopQrLink: (uri) => 'https://bnc.app.link/wc?uri=' + encodeURIComponent(uri),
    installUrl: 'https://www.binance.com/en/web3wallet',
    injectCheck: () => rdnsProvider('com.binance.wallet') || findLegacy(isBinanceProvider) || window.BinanceChain,
  },
  okx: {
    id: WC_WALLET_IDS.okx,
    label: 'OKX Wallet',
    icon: '/assets/wallets/okx.svg',
    nativeScheme: 'okex://',
    mobileScheme: (uri) => 'okex://wallet/wc?uri=' + encodeURIComponent(uri),
    desktopQrLink: (uri) => 'https://www.okx.com/download?deeplink=' + encodeURIComponent('okex://wallet/wc?uri=' + encodeURIComponent(uri)),
    installUrl: 'https://www.okx.com/web3',
    injectCheck: () => rdnsProvider('com.okex.wallet', 'com.okx.wallet') || window.okxwallet,
  },
  coinbase: {
    id: WC_WALLET_IDS.coinbase,
    label: 'Coinbase Wallet',
    icon: '/assets/wallets/coinbase.svg',
    nativeScheme: 'cbwallet://',
    mobileScheme: (uri) => 'cbwallet://wc?uri=' + encodeURIComponent(uri),
    desktopQrLink: (uri) => 'https://go.cb-w.com/wc?uri=' + encodeURIComponent(uri),
    installUrl: 'https://www.coinbase.com/wallet/downloads',
    injectCheck: () => rdnsProvider('com.coinbase.wallet') || window.coinbaseWalletExtension || findLegacy(isCoinbaseProvider),
  },
  generic: {
    id: null,
    label: 'WalletConnect',
    icon: '/assets/wallets/walletconnect.svg',
    nativeScheme: '',
    mobileScheme: () => null,
    desktopQrLink: (uri) => uri,
    installUrl: null,
    injectCheck: () => null,
  },
};

const GW_EXTRA_WALLETS = {
  safepal: {
    id: WC_WALLET_IDS.safepal,
    label: 'SafePal',
    icon: 'https://explorer-api.walletconnect.com/v3/logo/md/0b415a746fb9ee99cce155c2ceca0c6f6061b1dbca2d722b3ba16381d0562150',
    nativeScheme: 'safepalwallet://',
    mobileScheme: (uri) => 'safepalwallet://wc?uri=' + encodeURIComponent(uri),
    desktopQrLink: (uri) => 'https://link.safepal.io/wc?uri=' + encodeURIComponent(uri),
    injectCheck: () => null,
  },
  tokenpocket: {
    label: 'TokenPocket',
    icon: '',
    mobileScheme: (uri) => 'tpoutside://wc?uri=' + encodeURIComponent(uri),
    desktopQrLink: (uri) => 'https://link.tp.xyz/wc?uri=' + encodeURIComponent(uri),
    injectCheck: () => null,
  },
  imtoken: {
    label: 'imToken',
    icon: '',
    mobileScheme: (uri) => 'imtokenv2://wc?uri=' + encodeURIComponent(uri),
    desktopQrLink: (uri) => 'https://connect.imtoken.io/wc?uri=' + encodeURIComponent(uri),
    injectCheck: () => null,
  },
  zerion: {
    label: 'Zerion',
    icon: '',
    mobileScheme: (uri) => 'zerion://wc?uri=' + encodeURIComponent(uri),
    desktopQrLink: (uri) => 'https://wallet.zerion.io/wc?uri=' + encodeURIComponent(uri),
    injectCheck: () => null,
  },
  ledger: {
    label: 'Ledger Live',
    icon: 'https://explorer-api.walletconnect.com/v3/logo/md/19177a982382e07ddfc9af2083ba4e07ef627cb6103467ffebb33e28233159765',
    mobileScheme: (uri) => 'ledgerlive://wc?uri=' + encodeURIComponent(uri),
    desktopQrLink: (uri) => 'https://www.ledger.com/ledger-live/wc?uri=' + encodeURIComponent(uri),
    injectCheck: () => null,
  },
  trezor: {
    label: 'Trezor Suite',
    icon: '',
    mobileScheme: (uri) => 'trezor-suite://wc?uri=' + encodeURIComponent(uri),
    desktopQrLink: (uri) => 'https://suite.trezor.io/web/wc?uri=' + encodeURIComponent(uri),
    injectCheck: () => null,
  },
  iopay: {
    label: 'ioPay',
    icon: '',
    mobileScheme: (uri) => 'iopay://wc?uri=' + encodeURIComponent(uri),
    desktopQrLink: (uri) => 'https://link.iopay.me/wc?uri=' + encodeURIComponent(uri),
    injectCheck: () => null,
  },
  bitget: {
    label: 'Bitget Wallet',
    icon: 'https://explorer-api.walletconnect.com/v3/logo/md/38f5d18bd8522c24495280a7b4f875746cb3f149776e8370d4e4a449852a3292',
    mobileScheme: (uri) => 'bitkeep://wc?uri=' + encodeURIComponent(uri),
    desktopQrLink: (uri) => 'https://bkcode.vip/wc?uri=' + encodeURIComponent(uri),
    injectCheck: () => null,
  },
  rabby: {
    label: 'Rabby',
    icon: 'https://explorer-api.walletconnect.com/v3/logo/md/16365912e399b5adbc2d247983105ecaa79ca125dbb1680531741410b0a8c0b8',
    mobileScheme: (uri) => 'rabby://wc?uri=' + encodeURIComponent(uri),
    desktopQrLink: (uri) => 'https://rabby.io/wc?uri=' + encodeURIComponent(uri),
    injectCheck: () => rdnsProvider('io.rabby'),
  },
  onekey: {
    label: 'OneKey',
    icon: '',
    mobileScheme: (uri) => 'onekey-wallet://wc?uri=' + encodeURIComponent(uri),
    desktopQrLink: (uri) => 'https://app.onekey.so/wc?uri=' + encodeURIComponent(uri),
    injectCheck: () => null,
  },
  argent: {
    label: 'Argent',
    icon: '',
    mobileScheme: (uri) => 'argent://app/wc?uri=' + encodeURIComponent(uri),
    desktopQrLink: (uri) => 'https://www.argent.xyz/wc?uri=' + encodeURIComponent(uri),
    injectCheck: () => null,
  },
  xdefi: {
    label: 'XDEFI',
    icon: '',
    mobileScheme: (uri) => 'xdefi://wc?uri=' + encodeURIComponent(uri),
    desktopQrLink: (uri) => 'https://www.xdefi.io/wc?uri=' + encodeURIComponent(uri),
    injectCheck: () => null,
  },
  uniswap: {
    label: 'Uniswap Wallet',
    icon: '',
    mobileScheme: (uri) => 'uniswap://wc?uri=' + encodeURIComponent(uri),
    desktopQrLink: (uri) => 'https://wallet.uniswap.org/wc?uri=' + encodeURIComponent(uri),
    injectCheck: () => null,
  },
  brave: {
    label: 'Brave Wallet',
    icon: '',
    mobileScheme: (uri) => null,
    desktopQrLink: (uri) => uri,
    injectCheck: () => window.brave?.ethereum || null,
  },
  gemini: {
    label: 'Gemini',
    icon: '',
    mobileScheme: (uri) => 'gemini://wc?uri=' + encodeURIComponent(uri),
    desktopQrLink: (uri) => 'https://exchange.gemini.com/wc?uri=' + encodeURIComponent(uri),
    injectCheck: () => null,
  },
  safe: {
    label: 'Safe',
    icon: '',
    mobileScheme: (uri) => 'safe://wc?uri=' + encodeURIComponent(uri),
    desktopQrLink: (uri) => 'https://app.safe.global/wc?uri=' + encodeURIComponent(uri),
    injectCheck: () => null,
  },
  hashpack: {
    label: 'HashPack',
    icon: '',
    mobileScheme: (uri) => 'hashpack://wc?uri=' + encodeURIComponent(uri),
    desktopQrLink: (uri) => 'https://link.hashpack.app/wc?uri=' + encodeURIComponent(uri),
    injectCheck: () => null,
  },
  subwallet: {
    label: 'SubWallet',
    icon: '',
    mobileScheme: (uri) => 'subwallet://wc?uri=' + encodeURIComponent(uri),
    desktopQrLink: (uri) => 'https://app.subwallet.xyz/wc?uri=' + encodeURIComponent(uri),
    injectCheck: () => null,
  },
  bitcoincom: {
    label: 'Bitcoin.com Wallet',
    icon: '',
    mobileScheme: (uri) => 'bitcoincom://wc?uri=' + encodeURIComponent(uri),
    desktopQrLink: (uri) => 'https://wallet.bitcoin.com/wc?uri=' + encodeURIComponent(uri),
    injectCheck: () => null,
  },
  fireblocks: {
    label: 'Fireblocks',
    icon: '',
    mobileScheme: (uri) => null,
    desktopQrLink: (uri) => uri,
    injectCheck: () => null,
  },
  haha: {
    label: 'HaHa Wallet',
    icon: '',
    mobileScheme: (uri) => 'haha://wc?uri=' + encodeURIComponent(uri),
    desktopQrLink: (uri) => uri,
    injectCheck: () => null,
  },
  backpack: {
    label: 'Backpack',
    icon: '',
    mobileScheme: (uri) => 'backpack://wc?uri=' + encodeURIComponent(uri),
    desktopQrLink: (uri) => 'https://backpack.app/wc?uri=' + encodeURIComponent(uri),
    injectCheck: () => null,
  },
  phantom: {
    label: 'Phantom',
    icon: '',
    mobileScheme: (uri) => 'phantom://wc?uri=' + encodeURIComponent(uri),
    desktopQrLink: (uri) => 'https://phantom.app/wc?uri=' + encodeURIComponent(uri),
    injectCheck: () => window.phantom?.ethereum || window.solana?.isPhantom || null,
  },
};

function gwWalletCfg(walletKey) {
  return GW_WALLET_WC[walletKey] || GW_EXTRA_WALLETS[walletKey] || null;
}

const GW_EXPLORER_WALLET_KEYS = [
  'binance', 'metamask', 'trust', 'okx', 'coinbase', 'safepal', 'tokenpocket',
  'imtoken', 'ledger', 'trezor', 'zerion', 'iopay', 'bitget', 'rabby', 'onekey',
  'argent', 'xdefi', 'uniswap', 'brave', 'gemini', 'safe', 'hashpack', 'subwallet',
  'bitcoincom', 'fireblocks', 'haha', 'backpack', 'phantom',
];

let _gwExplorerCatalogCache = null;

function gwWcUriLink(tpl, uri) {
  if (!tpl) return null;
  const enc = encodeURIComponent(uri);
  if (tpl.includes('{uri}')) return tpl.replace(/\{uri\}/g, enc);
  if (tpl.includes('%s')) return tpl.replace('%s', enc);
  if (/[?&]uri=$/i.test(tpl)) return tpl + enc;
  if (tpl.includes('wc?uri=') || tpl.includes('/wc?')) return tpl + enc;
  return tpl + (tpl.endsWith('/') ? '' : '') + enc;
}

function gwCfgFromWcListing(w) {
  const mobile = w.mobile?.native || w.mobile?.universal || '';
  const desktop = w.desktop?.universal || w.desktop?.native || w.mobile?.universal || mobile;
  const icon = w.image_url?.md
    || (w.image_id ? `https://explorer-api.walletconnect.com/v3/logo/md/${w.image_id}?projectId=${WC_PROJECT_ID}` : '');
  return {
    id: w.id,
    label: w.metadata?.shortName || w.name,
    icon,
    mobileScheme: (uri) => gwWcUriLink(mobile, uri),
    desktopQrLink: (uri) => gwWcUriLink(desktop, uri) || uri,
    injectCheck: () => null,
  };
}

async function gwLoadExplorerWalletItems() {
  if (_gwExplorerCatalogCache) return _gwExplorerCatalogCache;
  const seen = new Set();
  const out = [];
  const pushItem = (key, cfg) => {
    const label = String(cfg.label || key).toLowerCase();
    const id = cfg.id || key;
    if (seen.has(id) || seen.has(label)) return;
    seen.add(id);
    seen.add(label);
    out.push({ key, cfg });
  };
  for (const key of GW_EXPLORER_WALLET_KEYS) {
    const cfg = gwWalletCfg(key);
    if (cfg) pushItem(key, cfg);
  }
  try {
    for (let page = 1; page <= 5; page++) {
      const r = await fetch(
        `https://explorer-api.walletconnect.com/v3/wallets?projectId=${WC_PROJECT_ID}&entries=40&page=${page}`
      );
      if (!r.ok) break;
      const j = await r.json();
      const list = Object.values(j.listings || {});
      if (!list.length) break;
      for (const w of list) {
        const key = 'wcl_' + w.id.slice(0, 16);
        if (GW_WALLET_WC[key] || GW_EXTRA_WALLETS[key]) continue;
        const cfg = gwCfgFromWcListing(w);
        GW_EXTRA_WALLETS[key] = cfg;
        pushItem(key, cfg);
      }
      if (list.length < 40) break;
    }
  } catch (e) {
    console.warn('[GROM] WC explorer catalog', e);
  }
  _gwExplorerCatalogCache = out;
  return out;
}

function gwRenderExplorerGrid(grid, items, modal) {
  grid.innerHTML = items.map(({ key, cfg }) => {
    const initial = (cfg.label || key).slice(0, 2).toUpperCase();
    const icon = cfg.icon
      ? `<img src="${cfg.icon}" alt="" loading="lazy" onerror="this.outerHTML='<span class=&quot;gw-expl-fallback&quot;>${initial}</span>'"/>`
      : `<span class="gw-expl-fallback">${initial}</span>`;
    return `<button type="button" class="gw-expl-item" data-key="${key}" data-label="${cfg.label}">${icon}<span>${cfg.label}</span></button>`;
  }).join('');
  grid.querySelectorAll('.gw-expl-item').forEach((btn) => {
    btn.onclick = () => {
      modal.style.display = 'none';
      connectViaSignClientCustomQr(btn.dataset.key, { fromExplorer: true }).catch(failToast);
    };
  });
}

async function gwOpenMoreWalletsExplorer() {
  gwInjectConnectModalCss();
  gwClearWcPending();
  gwSetWcFlowActive(false);
  gwKillReownModals();
  if (typeof window.closeConnectModal === 'function') window.closeConnectModal();

  let modal = document.getElementById('gwMoreWalletsModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'gwMoreWalletsModal';
    modal.innerHTML = [
      '<div class="gw-wc-backdrop">',
      '  <div class="gw-expl-panel" role="dialog" aria-modal="true">',
      '    <div class="gw-wc-topbar">',
      '      <button type="button" class="gw-wc-back gw-expl-back" aria-label="Back">←</button>',
      '      <span class="gw-wc-top-title">WalletConnect</span>',
      '      <button type="button" class="gw-wc-close gw-expl-close" aria-label="Close">×</button>',
      '    </div>',
      '    <input class="gw-expl-search" type="search" placeholder="Search wallets" autocomplete="off" />',
      '    <div class="gw-expl-grid"></div>',
      '  </div>',
      '</div>',
    ].join('');
    document.body.appendChild(modal);
    modal.querySelector('.gw-expl-close').onclick = () => { modal.style.display = 'none'; };
    modal.querySelector('.gw-expl-back').onclick = () => {
      modal.style.display = 'none';
      if (typeof window.openConnectModal === 'function') window.openConnectModal();
    };
    modal.querySelector('.gw-wc-backdrop').onclick = (e) => {
      if (e.target.classList.contains('gw-wc-backdrop')) modal.style.display = 'none';
    };
    modal.querySelector('.gw-expl-search').addEventListener('input', (e) => {
      const q = String(e.target.value || '').trim().toLowerCase();
      modal.querySelectorAll('.gw-expl-item').forEach((el) => {
        const name = (el.dataset.label || '').toLowerCase();
        el.style.display = !q || name.includes(q) ? '' : 'none';
      });
    });
  }

  const grid = modal.querySelector('.gw-expl-grid');
  grid.innerHTML = '<div class="gw-expl-loading" style="grid-column:1/-1;padding:28px;text-align:center;color:#98a8c0;font-size:13px">Loading wallets…</div>';
  modal.querySelector('.gw-expl-search').value = '';
  modal.style.display = 'flex';

  try {
    const items = await gwLoadExplorerWalletItems();
    gwRenderExplorerGrid(grid, items, modal);
  } catch (_) {
    gwRenderExplorerGrid(grid, GW_EXPLORER_WALLET_KEYS.map((key) => {
      const cfg = gwWalletCfg(key);
      return cfg ? { key, cfg } : null;
    }).filter(Boolean), modal);
  }
}
window.gwOpenMoreWalletsExplorer = gwOpenMoreWalletsExplorer;

async function ensureWC(forceNew, opts) {
  const wantRecommend = opts?.recommendedWalletId || null;
  const walletKey = opts?.walletKey || null;
  const showQrModal = opts?.showQrModal !== false;
  const excludeWalletIds = opts?.excludeWalletIds || [];
  const needReinit = forceNew
    || (walletKey && walletKey !== wcRecommendedForKey)
    || (wantRecommend && walletKey !== wcRecommendedForKey)
    || (opts?.showQrModal === false && wcRecommendedForKey !== walletKey);
  if (wcProvider && !needReinit) return wcProvider;
  if (wcProvider) {
    try { await wcProvider.disconnect(); } catch (_) {}
    wcProvider = null;
  }
  if (!WC_PROJECT_ID || WC_PROJECT_ID === 'YOUR_WC_PROJECT_ID_HERE') {
    throw new Error('Set WC_PROJECT_ID в grom-wallet.js');
  }
  const initOpts = {
    projectId: WC_PROJECT_ID,
    chains: opts?.requiredChains || CHAINS.required,
    optionalChains: opts?.optionalChains || CHAINS.optional,
    showQrModal,
    metadata: walletMetadata(),
  };
  if (showQrModal) {
    initOpts.qrModalOptions = {
      themeMode: 'dark',
      themeVariables: {
        '--wcm-z-index': '2000',
        '--wcm-accent-color': '#00c2ff',
        '--wcm-background-color': '#0b1220',
      },
      ...(wantRecommend ? {
        explorerRecommendedWalletIds: [wantRecommend],
        featuredWalletIds: [wantRecommend],
        ...(excludeWalletIds.length ? { explorerExcludedWalletIds: excludeWalletIds } : {}),
      } : {}),
    };
  }
  wcProvider = await EthereumProvider.init(initOpts);
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
  /* Skip prefetch — pre-initing EthereumProvider can resurrect Reown modal on PC. */
}

/** More wallets — our Binance-style explorer (no Reown modal). */
async function connectViaReownExplorer() {
  gwOpenMoreWalletsExplorer();
}

/**
 * Named wallets: SignClient + Binance-style QR with wallet-specific universal link
 * (never raw wc: — avoids MetaMask hijack on iOS / Chrome).
 */
async function connectViaSignClientCustomQr(walletKey, opts) {
  const cfg = gwWalletCfg(walletKey);
  if (!cfg) throw new Error('Unknown wallet: ' + walletKey);
  if (typeof window.closeConnectModal === 'function') window.closeConnectModal();

  gwAbortPendingWc();
  gwSetWcFlowActive(true);
  gwKillReownModals();
  _wcPendingKillTimer = setInterval(gwKillReownModals, 400);

  try {
    if (wcProvider) {
      try { await wcProvider.disconnect?.(); } catch (_) {}
      wcProvider = null;
      wcRecommendedForKey = null;
    }

    const { default: SignClient } = await import('https://esm.sh/@walletconnect/sign-client@2.18.0');
    const client = await SignClient.init({
      projectId: WC_PROJECT_ID,
      metadata: walletMetadata(),
    });
    const { uri, approval } = await client.connect(standardWcNamespaces());
    if (!uri) throw new Error('Could not start ' + cfg.label + ' session');

    gwShowWcModal(walletKey, uri, { mobile: isMobileUA(), fromExplorer: !!opts?.fromExplorer });

    const session = await Promise.race([
      approval(),
      new Promise((_, reject) => {
        _wcPendingReject = reject;
        setTimeout(
          () => reject(new Error(cfg.label + ' connection timed out — approve in the wallet app')),
          180000
        );
      }),
    ]);
    _wcPendingReject = null;

    wcProvider = buildSignClientEip1193(client, session);
    wcRecommendedForKey = walletKey;
    wcProvider.on('accountsChanged', (accs) => updateChip(accs?.[0] || null));
    wcProvider.on('disconnect', () => updateChip(null));
    const accs = wcProvider.accounts;
    if (!accs?.length) throw new Error('No accounts returned');
    gwHideWcModalOnly();
    gwClearWcPending();
    return await finalizeWcConnection(wcProvider, accs[0]);
  } catch (err) {
    gwClearWcPending();
    gwHideWcModalOnly();
    throw err;
  } finally {
    if (_wcPendingKillTimer) { clearInterval(_wcPendingKillTimer); _wcPendingKillTimer = null; }
    gwSetWcFlowActive(false);
    _wcPendingReject = null;
  }
}

/* Named wallets → custom QR; generic → Reown explorer. In-app browser → inject. */
async function connectWalletWC(walletKey) {
  const cfg = gwWalletCfg(walletKey);
  if (!cfg && walletKey !== 'generic') throw new Error('Unknown wallet: ' + walletKey);

  if (walletKey !== 'generic') {
    const injected = typeof cfg?.injectCheck === 'function' ? cfg.injectCheck() : null;
    if (injected) return connectWithProvider(injected, cfg.label);
  }

  if (walletKey === 'generic') {
    gwOpenMoreWalletsExplorer();
    return;
  }
  return connectViaSignClientCustomQr(walletKey);
}

async function connectTrustWC() { return connectWalletWC('trust'); }

async function connectWCFor(walletKey) {
  return connectWalletWC(walletKey);
}

async function connectWC() {
  return connectWalletWC('generic');
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

/* ----- On-chain balances (ETH + ERC-20 USDT/USDC) -----
 *  Addresses verified against LiFi /v1/tokens API (2026-07-10):
 *    – Arbitrum USDT was WRONG (0x...685e32 → real 0x...FCbb9) — this hid
 *      user's $3 USDT balance on Trust.
 *    – Arbitrum USDC was WRONG (bridged 0x...FccC7 → native 0x...e5831).
 *    – Base USDC was WRONG (0x...120e → real 0x...02913).
 *    – Base USDT was MISSING entirely.
 *  Added Optimism (10) and Avalanche (43114) for full multi-chain reads. */
const ONCHAIN_RPC = {
  1: 'https://ethereum.publicnode.com',
  42161: 'https://arb1.arbitrum.io/rpc',
  137: 'https://polygon-bor-rpc.publicnode.com',
  8453: 'https://mainnet.base.org',
  56: 'https://bsc-dataseed.binance.org',
  10: 'https://mainnet.optimism.io',
  43114: 'https://api.avax.network/ext/bc/C/rpc',
};
const ONCHAIN_TOKENS = {
  1: {
    USDT: '0xdac17f958d2ee523a2206206994597c13d831ec7',
    USDC: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  },
  42161: {
    USDT: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
    USDC: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
  },
  137: {
    USDT: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    USDC: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
  },
  8453: {
    USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    USDT: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',
  },
  56: {
    USDT: '0x55d398326f99059fF775485246999027B3197955',
    USDC: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
  },
  10: {
    USDT: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
    USDC: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
  },
  43114: {
    USDT: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7',
    USDC: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
  },
};
const TOKEN_DECIMALS = { USDT: 6, USDC: 6 };

/** BSC USDT/USDC use 18 decimals — global 6 would hide balances (e.g. 3 USDT → dust). */
function gwTokenDecimals(chainId, sym) {
  const id = Number(chainId);
  if (id === 56 && (sym === 'USDT' || sym === 'USDC')) return 18;
  return TOKEN_DECIMALS[sym] || 18;
}

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
      const dec = gwTokenDecimals(chainId, sym);
      tokens[sym] = Number(BigInt(raw || '0x0')) / (10 ** dec);
    } catch (_) {
      tokens[sym] = 0;
    }
  }
  return { chainId, nativeEth, tokens };
};

/* ----- Wallet connect router (used by index.html cnConnect) ----- */
async function connectPhantomWallet() {
  const pk = await gwSolConnect();
  window.__gwSolAddr = pk;
  if (window.GROM_CONN) window.GROM_CONN.method = 'solana';
  updateChip(pk);
  return pk;
}
async function connectTonWallet() {
  const addr = await gwTonConnect();
  window.__gwTonAddr = addr;
  if (window.GROM_CONN) window.GROM_CONN.method = 'ton';
  updateChip(addr);
  return addr;
}
async function connectTronWallet() {
  const addr = await gwTronConnect();
  window.__gwTronAddr = addr;
  if (window.GROM_CONN) window.GROM_CONN.method = 'tron';
  updateChip(addr);
  return addr;
}
async function gromWalletConnect(kind, name) {
  try {
    if (kind === 'mm') await connectMetaMask();
    else if (kind === 'trust') await connectTrust();
    else if (kind === 'bnw3') await connectBinanceWeb3();
    else if (kind === 'okx') await connectOkx();
    else if (kind === 'cb') await connectCoinbase();
    else if (kind === 'phantom') await connectPhantomWallet();
    else if (kind === 'ton') await connectTonWallet();
    else if (kind === 'tron') await connectTronWallet();
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

  // Do not prefetch WC — pre-init can leave Reown modal in a broken state.

  console.log('[grom-wallet] ready · project:', WC_PROJECT_ID.slice(0, 8) + '…');
  try { gwInjectDexPagesCss(); } catch (_) {}
}

function gwInjectDexPagesCss() {
  if (document.getElementById('gw-dex-pages-css')) return;
  const s = document.createElement('style');
  s.id = 'gw-dex-pages-css';
  s.textContent = `
    #topLogoutBtn { display: none !important; }
    #page-wallet .page-title .tag { background: rgba(0,194,255,.14); border-color: rgba(0,194,255,.35); color: #5dd5ff; }
    #page-wallet .grid-2 > .card:first-child { display: none !important; }
    #page-wallet .grid-2 { grid-template-columns: 1fr !important; }
    #page-referral .page-title .tag { background: rgba(34,193,124,.12); border-color: rgba(34,193,124,.35); color: #22c17c; }

    /* Settings — hide CEX-only cards. Match by text content of card-head h3. */
    #page-settings .set-row:has(#setEmail) { display: none; }
    #page-settings .set-row:has(#set2fa) { display: none; }
    #page-settings .set-row:has(#setDev) { display: none; }
    #page-settings .set-row:has(#setAntiPhish) { display: none; }
    #page-settings .set-row:has(#setNotifTransfers) { display: none; }
    #page-settings .set-actions:has(button[onclick*="reviewSessions"]) { display: none; }

    /* DEX-styled cards for Wallet + Settings + Referral extensions */
    .gw-dp-wrap { margin: 18px 0; }
    .gw-dp-card {
      padding: 22px 24px; border-radius: 22px; color: #e7eef8; position: relative; overflow: hidden;
      background: radial-gradient(140% 200% at 100% 0%, rgba(0,194,255,.08), transparent 55%),
                  linear-gradient(160deg, rgba(13,22,38,.75), rgba(8,14,26,.92));
      border: 1px solid rgba(0,194,255,.20);
    }
    .gw-dp-card.g { border-color: rgba(34,193,124,.22); }
    .gw-dp-head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; margin-bottom: 14px; flex-wrap: wrap; }
    .gw-dp-h { margin: 0; font-size: 17px; font-weight: 800; letter-spacing: -0.01em; color: #fff; }
    .gw-dp-sub { margin: 4px 0 0; font-size: 12.5px; color: #98a8c0; line-height: 1.5; }
    .gw-dp-badge { padding: 4px 10px; border-radius: 999px; font-size: 10.5px; font-weight: 800; letter-spacing: .12em;
      border: 1px solid rgba(0,194,255,.30); background: rgba(0,194,255,.10); color: #5dd5ff; }
    .gw-dp-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 10px; }
    .gw-dp-action {
      display: flex; align-items: center; gap: 10px; padding: 14px 16px; border-radius: 14px;
      background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.06); color: #e7eef8;
      font-weight: 700; font-size: 13.5px; cursor: pointer; text-decoration: none;
      transition: background .18s, border-color .18s, transform .18s;
    }
    .gw-dp-action:hover { background: rgba(0,194,255,.08); border-color: rgba(0,194,255,.35); transform: translateY(-1px); }
    .gw-dp-action .ic { font-size: 20px; flex: 0 0 auto; }
    .gw-dp-action .lbl { flex: 1; }
    .gw-dp-action .hint { font-size: 10.5px; letter-spacing: .1em; color: #6b7a92; text-transform: uppercase; font-weight: 800; }

    .gw-dp-row { display: grid; grid-template-columns: 1fr auto; gap: 12px; padding: 12px 0; align-items: center;
      border-bottom: 1px solid rgba(255,255,255,.04); }
    .gw-dp-row:last-child { border-bottom: 0; }
    .gw-dp-row .k { color: #cfdfee; font-size: 13.5px; font-weight: 700; }
    .gw-dp-row .k small { display: block; color: #6b7a92; font-size: 11.5px; font-weight: 500; margin-top: 2px; }
    .gw-dp-inp { padding: 8px 12px; background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.08);
      border-radius: 10px; color: #e7eef8; font-size: 13px; font-family: inherit; outline: none; min-width: 90px; text-align: right; }
    .gw-dp-sel { padding: 8px 30px 8px 12px; background: rgba(255,255,255,.04) url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path d='M1 1l4 4 4-4' stroke='%2398a8c0' fill='none' stroke-width='1.5'/></svg>") right 10px center no-repeat;
      border: 1px solid rgba(255,255,255,.08); border-radius: 10px; color: #e7eef8; font-size: 13px; font-family: inherit; outline: none; appearance: none; }
    .gw-dp-toggle { position: relative; width: 44px; height: 24px; }
    .gw-dp-toggle input { opacity: 0; width: 0; height: 0; }
    .gw-dp-toggle .slider { position: absolute; inset: 0; background: rgba(255,255,255,.08); border-radius: 999px;
      transition: background .2s; cursor: pointer; }
    .gw-dp-toggle .slider::before { content: ''; position: absolute; height: 18px; width: 18px; left: 3px; top: 3px;
      background: #cfdfee; border-radius: 50%; transition: transform .2s, background .2s; }
    .gw-dp-toggle input:checked + .slider { background: linear-gradient(135deg, #00c2ff, #6e8dff); }
    .gw-dp-toggle input:checked + .slider::before { transform: translateX(20px); background: #fff; }

    @media (max-width: 768px) {
      .stats-grid { margin-top: 14px !important; gap: 14px !important; }
      .stat-card { padding: 16px !important; }
    }
  `;
  document.head.appendChild(s);
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
  1:     { label: 'Ethereum',  native: 'ETH',   tickerSym: 'ETHUSDT' },
  42161: { label: 'Arbitrum',  native: 'ETH',   tickerSym: 'ETHUSDT' },
  137:   { label: 'Polygon',   native: 'MATIC', tickerSym: 'MATICUSDT' },
  8453:  { label: 'Base',      native: 'ETH',   tickerSym: 'ETHUSDT' },
  56:    { label: 'BSC',       native: 'BNB',   tickerSym: 'BNBUSDT' },
  10:    { label: 'Optimism',  native: 'ETH',   tickerSym: 'ETHUSDT' },
  43114: { label: 'Avalanche', native: 'AVAX',  tickerSym: 'AVAXUSDT' },
};

async function gwOcFetchPrices() {
  const symbols = new Set(['ETHUSDT', 'BNBUSDT', 'MATICUSDT', 'AVAXUSDT']);
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
      <div class="gw-oc-empty">Подключи кошелёк, чтобы увидеть свои on-chain балансы (ETH, BNB, MATIC, AVAX, USDT, USDC на 7 сетях).</div>
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
    <div class="gw-oc-loading">Загружаем балансы по 7 сетям…</div>
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
      : `<div class="gw-oc-empty">На поддерживаемых сетях (ETH · Arbitrum · Optimism · Polygon · Base · BSC · Avalanche) нет баланса. Пополни кошелёк, чтобы увидеть здесь.</div>`;

    card.innerHTML = `
      <div class="gw-oc-head">
        <div>
          <p class="gw-oc-title">Ваш кошелёк · on-chain</p>
          <p class="gw-oc-total">$${totalUsd.toFixed(2)}</p>
          <p class="gw-oc-addr">${short} · всего по 7 сетям</p>
        </div>
        <button type="button" class="gw-oc-refresh" id="gwOcRefresh">↻ Обновить</button>
      </div>
      ${list}
    `;
    document.getElementById('gwOcRefresh')?.addEventListener('click', gwRenderOnchainCard);
    gwRefreshCombinedPortfolioTotals().catch(() => {});
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
  document.addEventListener('grom:wallet-connected', () => {
    gwInvalidateMpCache();
    tryRender();
    gwRefreshCombinedPortfolioTotals().catch(() => {});
  });
  document.addEventListener('grom:wallet-disconnected', tryRender);
  // Also mount the card whenever page-wallet appears (Cursor's SPA router).
  const bodyObs = new MutationObserver(() => tryRender());
  bodyObs.observe(document.body, { attributes: true, subtree: false, attributeFilter: ['data-page'] });
}

function gwSetupCombinedBalance() {
  const refresh = () => { gwRefreshCombinedPortfolioTotals().catch(() => {}); };
  document.addEventListener('grom:wallet-connected', () => {
    gwInvalidateMpCache();
    refresh();
  });
  window.addEventListener('hashchange', () => {
    if (document.getElementById('page-wallet') || document.getElementById('page-dashboard')) refresh();
  });
  refresh();
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
const GW_MP_LS_KEY = 'gw_mp_cache_v2';
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
function gwInvalidateMpCache() {
  GW_MP_CACHE.onchain = null;
  GW_MP_INFLIGHT.onchain = null;
  try {
    const raw = localStorage.getItem(GW_MP_LS_KEY);
    if (!raw) return;
    const obj = JSON.parse(raw);
    delete obj.onchain;
    localStorage.setItem(GW_MP_LS_KEY, JSON.stringify(obj));
  } catch (_) {}
}

async function _mpOnchainRaw() {
  try {
    const addr = gwOcConnectedAddress();
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

/** Custodial + on-chain USD for wallet hero and dashboard total. */
async function gwRefreshCombinedPortfolioTotals() {
  const custodial = Number(window.__gromWalletOverview?.summary?.totalUsd) || 0;
  let onchain = 0;
  try {
    const oc = await _mpOnchainRaw();
    onchain = Number(oc.usd) || 0;
    GW_MP_CACHE.onchain = { at: Date.now(), val: oc };
    _gwMpPersist();
  } catch (_) {}

  const combined = custodial + onchain;
  const fmt = (n) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const show = combined > 0.005 ? combined : (onchain > 0.005 ? onchain : custodial);

  const walletTotal = document.getElementById('walletTotalBalance');
  if (walletTotal && show > 0.005) walletTotal.textContent = fmt(show);

  const walletDelta = document.getElementById('walletTotalDelta');
  if (walletDelta && (custodial > 0.005 || onchain > 0.005)) {
    const parts = [];
    if (custodial > 0.005) parts.push('Trading ' + fmt(custodial));
    if (onchain > 0.005) parts.push('On-chain ' + fmt(onchain));
    if (parts.length) {
      walletDelta.textContent = parts.join(' · ');
      walletDelta.style.color = 'var(--silver5)';
    }
  }

  const dashVal = document.getElementById('dashPortfolioVal');
  if (dashVal && combined > 0.005) dashVal.textContent = gwFmtUsd(combined);
}
window.gwRefreshCombinedPortfolioTotals = gwRefreshCombinedPortfolioTotals;
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

/** RU plural helper: 1 → single, 2-4 → few, 5+/0 → many. */
function gwMpPlural(n, t, key) {
  n = Math.abs(Number(n) || 0);
  if (!t.plurals || !t.plurals[key]) return t[key];
  const mod10 = n % 10, mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return t.plurals[key][0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return t.plurals[key][1];
  return t.plurals[key][2];
}
const GW_MP_TR = {
  ru: { eyebrow: 'МЕТА-ПОРТФЕЛЬ', badge: 'ALL-IN-ONE', sub: 'Всё что у тебя есть в GROM — в одном месте', c1: 'Торговый счёт', c2: 'On-chain', c3: 'Прогнозы', c4: 'Акции', assets: 'активов', chains: 'сетей', posN: 'позиций', empty: 'Пока пусто — подключи кошелёк или пополни счёт', a1: 'Пополнить', a2: 'Свап', a3: 'Обновить', loading: 'Загружаем портфель…',
       plurals: { chains: ['сеть', 'сети', 'сетей'], assets: ['актив', 'актива', 'активов'], posN: ['позиция', 'позиции', 'позиций'] } },
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
    // Meta-Portfolio goes at the very top of the dash — user request
    // 2026-07-09c: revert to "MP above Instant Swap" (was flipped briefly).
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
      ${cat('custodial', t.c1, cust.usd, cust.assetsN ? `${cust.assetsN} ${gwMpPlural(cust.assetsN, t, 'assets')}` : '—')}
      ${cat('onchain',   t.c2, onch.usd, onch.chainsN ? `${onch.chainsN} ${gwMpPlural(onch.chainsN, t, 'chains')}` : '—')}
      ${cat('predict',   t.c3, pred.usd, pred.positionsN ? `${pred.positionsN} ${gwMpPlural(pred.positionsN, t, 'posN')}` : '—')}
      ${cat('xstocks',   t.c4, xst.usd,  xst.positionsN ? `${xst.positionsN} ${gwMpPlural(xst.positionsN, t, 'posN')}` : '—')}
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
  document.addEventListener('grom:wallet-connected', () => {
    gwInvalidateMpCache();
    tryRender();
  });
  document.addEventListener('grom:wallet-disconnected', tryRender);
  const bodyObs = new MutationObserver(() => tryRender());
  bodyObs.observe(document.body, { attributes: true, subtree: false, attributeFilter: ['data-page'] });
  // Auto-refresh every 60s while dashboard is visible
  setInterval(() => {
    const dash = document.getElementById('page-dashboard');
    if (dash && dash.offsetParent !== null) gwRenderMetaPortfolio();
  }, 60000);
}

function gwEnsureConnectWalletRows() {
  const list = document.querySelector('#connectModal .cn-list');
  if (!list) return;
  list.style.display = '';
  list.querySelectorAll('button.cn-row').forEach((btn) => {
    btn.style.display = '';
    btn.hidden = false;
    btn.removeAttribute('aria-hidden');
  });
}
window.gwEnsureConnectWalletRows = gwEnsureConnectWalletRows;

function gwInjectConnectModalCss() {
  let style = document.getElementById('gw-connect-modal-fixups');
  if (!style) {
    style = document.createElement('style');
    style.id = 'gw-connect-modal-fixups';
    document.head.appendChild(style);
  }
  const css = `
    #connectModal .wm {
      max-height: min(90dvh, 720px);
      overflow-x: hidden;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
      background: #181a20 !important;
      border: 1px solid rgba(234,236,239,.08) !important;
      color: #eaecef !important;
    }
    #connectModal .wm-head {
      border-bottom: 1px solid rgba(234,236,239,.06);
    }
    #connectModal .wm-head h3 { color: #eaecef; font-weight: 700; }
    #connectModal .cn-list {
      display: flex !important;
      flex-direction: column;
      gap: 8px;
    }
    #connectModal .cn-list button.cn-row {
      display: flex !important;
      background: #0b0e11 !important;
      border-color: rgba(234,236,239,.08) !important;
      color: #eaecef !important;
    }
    #connectModal .cn-list button.cn-row:hover {
      background: rgba(240,185,11,.06) !important;
      border-color: rgba(240,185,11,.28) !important;
    }
    #connectModal .cn-list button.cn-row.primary {
      background: rgba(240,185,11,.1) !important;
      border-color: rgba(240,185,11,.35) !important;
    }
    #connectModal .cn-foot { color: #848e9c !important; }
    #connectModal .cn-foot a { color: #f0b90b !important; }
    html.gw-wc-flow w3m-modal,
    html.gw-wc-flow wcm-modal,
    html.gw-wc-flow w3m-container,
    html.gw-wc-flow wcm-container,
    html.gw-trust-flow w3m-modal,
    html.gw-trust-flow wcm-modal {
      display: none !important;
      visibility: hidden !important;
      pointer-events: none !important;
    }
    #gwWcModal, #gwMoreWalletsModal, #gwTrustWcModal {
      display: none; position: fixed; inset: 0; z-index: 2500;
      align-items: center; justify-content: center;
    }
    .gw-wc-backdrop, .gw-trust-wc-backdrop {
      position: absolute; inset: 0; background: rgba(0,0,0,.78);
      display: flex; align-items: center; justify-content: center; padding: 16px;
    }
    .gw-wc-panel--binance, .gw-expl-panel {
      position: relative; z-index: 1; width: min(420px, 100%);
      background: #181a20; border: 1px solid rgba(234,236,239,.08);
      border-radius: 16px; padding: 0 0 20px; color: #eaecef;
      box-shadow: 0 24px 80px rgba(0,0,0,.65);
      max-height: min(90dvh, 640px); overflow: hidden; display: flex; flex-direction: column;
    }
    .gw-wc-topbar {
      display: flex; align-items: center; gap: 8px;
      padding: 14px 16px 10px; border-bottom: 1px solid rgba(234,236,239,.06);
    }
    .gw-wc-top-title { flex: 1; text-align: center; font-weight: 700; font-size: 15px; color: #eaecef; }
    .gw-wc-back, .gw-wc-close {
      border: 0; background: transparent; color: #848e9c; font-size: 20px;
      line-height: 1; cursor: pointer; width: 32px; height: 32px; border-radius: 8px;
    }
    .gw-wc-back:hover, .gw-wc-close:hover { background: rgba(255,255,255,.06); color: #eaecef; }
    .gw-wc-brand { text-align: center; padding: 18px 20px 8px; }
    .gw-wc-icon-lg { width: 48px; height: 48px; border-radius: 12px; object-fit: cover; margin-bottom: 10px; }
    .gw-wc-brand .gw-wc-title { margin: 0; font-size: 18px; font-weight: 700; color: #eaecef; }
    .gw-wc-lead { margin: 0; padding: 0 20px; text-align: center; font-size: 13px; color: #848e9c; }
    .gw-wc-qr-wrap {
      display: flex; justify-content: center; margin: 16px 20px 10px;
    }
    .gw-wc-qr-frame {
      position: relative; background: #fff; border-radius: 16px; padding: 14px;
      box-shadow: inset 0 0 0 1px rgba(0,0,0,.04);
    }
    .gw-wc-qr canvas, .gw-wc-qr img { display: block; border-radius: 8px; }
    .gw-wc-qr-badge {
      position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
      width: 36px; height: 36px; border-radius: 10px; background: #fff;
      padding: 4px; box-shadow: 0 2px 8px rgba(0,0,0,.12); object-fit: cover;
    }
    .gw-wc-scan-hint {
      margin: 0; padding: 0 24px; text-align: center;
      font-size: 13px; line-height: 1.5; color: #848e9c;
    }
    .gw-wc-open {
      display: block; width: calc(100% - 40px); margin: 16px auto 0;
      text-align: center; padding: 13px 14px; border-radius: 10px;
      background: #f0b90b; color: #181a20; border: 0;
      font-weight: 700; cursor: pointer; font-size: 15px;
    }
    .gw-wc-open:hover { filter: brightness(1.05); }
    .gw-expl-search {
      margin: 12px 16px 8px; padding: 12px 14px; border-radius: 10px;
      border: 1px solid rgba(234,236,239,.12); background: #0b0e11;
      color: #eaecef; font-size: 14px; outline: none; width: calc(100% - 32px); box-sizing: border-box;
    }
    .gw-expl-search:focus { border-color: rgba(240,185,11,.45); }
    .gw-expl-grid {
      display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px;
      padding: 8px 16px 16px; overflow-y: auto; max-height: min(62dvh, 520px);
    }
    @media (max-width: 480px) { .gw-expl-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
    .gw-expl-item {
      display: flex; flex-direction: column; align-items: center; gap: 8px;
      padding: 10px 6px; border-radius: 12px; border: 1px solid rgba(234,236,239,.06);
      background: #0b0e11; color: #eaecef; cursor: pointer; font: inherit; font-size: 11px;
      font-weight: 600; text-align: center; min-width: 0;
    }
    .gw-expl-item:hover { background: rgba(240,185,11,.08); border-color: rgba(240,185,11,.25); }
    .gw-expl-item img, .gw-expl-fallback {
      width: 40px; height: 40px; border-radius: 12px; object-fit: cover;
    }
    .gw-expl-fallback {
      display: inline-flex; align-items: center; justify-content: center;
      background: linear-gradient(135deg, rgba(240,185,11,.25), rgba(0,194,255,.2));
      font-weight: 800; font-size: 13px; color: #eaecef;
    }
    .gw-expl-item span { line-height: 1.2; word-break: break-word; }
  `;
  style.textContent = css;
}

function gwSetupConnectModalRows() {
  gwEnsureConnectWalletRows();
  const orig = window.openConnectModal;
  if (typeof orig === 'function' && !orig.__gwWalletRowsPatched) {
    window.openConnectModal = function gwOpenConnectModalWithWallets() {
      const out = orig.apply(this, arguments);
      gwEnsureConnectWalletRows();
      return out;
    };
    window.openConnectModal.__gwWalletRowsPatched = true;
  }
  const modal = document.getElementById('connectModal');
  if (modal) {
    const obs = new MutationObserver(() => {
      if (modal.classList.contains('open')) gwEnsureConnectWalletRows();
    });
    obs.observe(modal, { attributes: true, attributeFilter: ['class'] });
  }
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
  try { if (localStorage.getItem('grom_jwt')) return true; } catch (e) { /* noop */ }
  return !!(window.GROM_CONN && window.GROM_CONN.connected && window.GROM_CONN.label);
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
    return /^(Sign in|Log in|Connect wallet|Войти|Подключить|Войти\s*\/\s*Регистрация|Iniciar|Conectar|登录|Giriş|دخول)/i.test(t);
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
/* Base seed list — always available. Cursor's grom-instruments (365
 * crypto pairs) is spliced on top at boot to give the user every asset
 * their Markets page shows. Reason we keep a seed at all: instruments
 * might load AFTER our swap panel is first drawn, and we don't want an
 * empty dropdown. gwDsMergeInstruments() below extends this array
 * in place and calls the panel's re-render. */
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

/* Merge Cursor's 365-crypto Markets instrument list into GW_DS_ASSETS
 * so the swap dropdown offers every asset the user sees in Рынки.
 * Runs once when window.gromInstrumentsByType is exposed (grom-instruments.js
 * loads a bit after us). Kept idempotent — repeat calls are a no-op. */
/**
 * Bulk-fetch LiFi's token list — 10 000+ tokens across every chain
 * LiFi supports. Cached in localStorage for 24 h so cold reload doesn't
 * pay 200 kB every time. Runs in background so it doesn't slow boot.
 */
async function gwDsFetchLifiTokens() {
  if (gwDsFetchLifiTokens._done) return;
  gwDsFetchLifiTokens._done = true;
  const CK = 'gw_lifi_tokens_v1';
  try {
    const raw = localStorage.getItem(CK);
    if (raw) {
      const obj = JSON.parse(raw);
      if (obj && obj.at && Date.now() - obj.at < 86_400_000 && Array.isArray(obj.list)) {
        gwDsMergeLifiTokens(obj.list);
        return;
      }
    }
  } catch (_) {}
  try {
    const r = await fetch(`${GW_LIFI_ENDPOINT}/tokens`);
    if (!r.ok) return;
    const j = await r.json();
    const list = [];
    for (const cid of Object.keys(j.tokens || {})) {
      for (const t of j.tokens[cid]) {
        if (t.symbol && t.name) list.push({ sym: t.symbol, name: t.name, logo: t.logoURI || '' });
      }
    }
    try { localStorage.setItem(CK, JSON.stringify({ at: Date.now(), list })); } catch (_) {}
    gwDsMergeLifiTokens(list);
  } catch (_) {}
}
function gwDsMergeLifiTokens(list) {
  const have = new Set(GW_DS_ASSETS.map((a) => a.sym));
  let added = 0;
  for (const t of list) {
    if (!t.sym || have.has(t.sym)) continue;
    GW_DS_ASSETS.push(t);
    have.add(t.sym);
    added++;
  }
  if (added > 0) {
    console.log('[GROM] LiFi tokens merged +' + added + ' → total ' + GW_DS_ASSETS.length);
    // If picker is open, re-render with new list + refresh count.
    try {
      const inp = document.getElementById('gwTkSearch');
      if (inp) inp.placeholder = `Search ${GW_DS_ASSETS.length}+ tokens…`;
      if (document.getElementById('gw-tk-overlay')?.classList.contains('open')) gwTkRender(inp?.value || '');
    } catch (_) {}
  }
}
if (typeof window !== 'undefined') { setTimeout(gwDsFetchLifiTokens, 2500); }

function gwDsMergeInstruments() {
  try {
    if (typeof window.gromInstrumentsByType !== 'function') return false;
    if (gwDsMergeInstruments._done) return true;
    const rows = window.gromInstrumentsByType('crypto') || [];
    const have = new Set(GW_DS_ASSETS.map((a) => a.sym));
    // Build a base→logo index so seed items also pick up icons.
    const logoBy = {};
    for (const r of rows) if (r.base && r.logo) logoBy[r.base] = logoBy[r.base] || r.logo;
    for (const a of GW_DS_ASSETS) if (!a.logo && logoBy[a.sym]) a.logo = logoBy[a.sym];
    for (const r of rows) {
      const sym = r.base;
      if (!sym || have.has(sym)) continue;
      GW_DS_ASSETS.push({ sym, name: r.name || sym, logo: r.logo || logoBy[sym] || '' });
      have.add(sym);
    }
    gwDsMergeInstruments._done = true;
    // Force a swap-panel re-render so the freshly expanded list shows up.
    try {
      const wrap = document.querySelector('.gw-ds-wrap');
      if (wrap) { wrap.remove(); gwInjectDashSwapPanel(); }
    } catch (_) {}
    console.log('[GROM] swap tokens expanded to', GW_DS_ASSETS.length);
    return true;
  } catch (_) { return false; }
}
// Try immediately; then poll a few times because grom-instruments.js
// loads slightly later. Stop after either success or ~10 s.
if (typeof window !== 'undefined') {
  let _mn = 0;
  const _mid = setInterval(() => { _mn++; if (gwDsMergeInstruments() || _mn >= 20) clearInterval(_mid); }, 500);
  gwDsMergeInstruments();
}

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
    /* Phase 7 — chain-chip row inside swap panel */
    .gw-ds-chains {
      display: flex; gap: 6px; margin: 8px 0 6px; overflow-x: auto;
      scrollbar-width: none; -ms-overflow-style: none; padding: 2px 0 6px;
      -webkit-overflow-scrolling: touch;
    }
    .gw-ds-chains::-webkit-scrollbar { display: none; }
    /* Ensure chip row is scrollable on mobile even when panel is narrow. */
    @media (max-width: 640px) {
      .gw-ds-chains { margin: 4px -14px 6px; padding: 2px 14px 6px; }
      .gw-ds-chain { padding: 5px 8px 5px 7px; font-size: 11px; }
    }
    .gw-ds-chain {
      flex: 0 0 auto; display: inline-flex; align-items: center; gap: 6px;
      padding: 6px 10px 6px 8px; border-radius: 999px;
      background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06);
      color: #cfdfee; font-size: 11.5px; font-weight: 700; cursor: pointer;
      letter-spacing: .02em; transition: background .18s, border-color .18s;
    }
    .gw-ds-chain .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--chColor, #00c2ff); box-shadow: 0 0 0 2px rgba(255,255,255,0.04); }
    .gw-ds-chain:hover { background: rgba(255,255,255,0.07); border-color: rgba(255,255,255,0.12); }
    .gw-ds-chain.on { background: rgba(0,194,255,0.14); border-color: rgba(0,194,255,0.35); color: #e7eef8; }
    .gw-ds-chain.soon { opacity: 0.65; }
    .gw-ds-chain .soon-tag { font-size: 9px; letter-spacing: .1em; text-transform: uppercase; color: #98a8c0; margin-left: 4px; padding: 1px 5px; border-radius: 4px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.10); }

    /* Phase 7 v2 — token picker modal */
    #gw-tk-overlay { position: fixed; inset: 0; z-index: 900; background: rgba(4,8,16,0.55); backdrop-filter: blur(6px);
      display: none; align-items: center; justify-content: center; }
    #gw-tk-overlay.open { display: flex; }
    #gw-tk-panel { width: min(440px, 92vw); max-height: min(84vh, 720px); display: flex; flex-direction: column;
      background: linear-gradient(160deg, rgba(13,22,38,0.98), rgba(8,14,26,0.98)); border: 1px solid rgba(255,255,255,0.08);
      border-radius: 20px; overflow: hidden; box-shadow: 0 20px 60px -12px rgba(0,0,0,0.65); }
    #gw-tk-panel .head { display: flex; align-items: center; gap: 10px; padding: 14px 16px; border-bottom: 1px solid rgba(255,255,255,0.05); }
    #gw-tk-panel .head h4 { margin: 0; font-size: 14.5px; font-weight: 800; color: #e7eef8; flex: 1; }
    #gw-tk-panel .head .close { padding: 4px 8px; border: 0; background: transparent; color: #98a8c0; font-size: 18px; cursor: pointer; }
    #gw-tk-panel .search { padding: 12px 14px; }
    #gw-tk-panel .search input { width: 100%; padding: 10px 12px; background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; color: #e7eef8; font-size: 14.5px; outline: none; font-family: inherit; }
    #gw-tk-panel .search input:focus { border-color: rgba(0,194,255,0.35); }
    #gw-tk-list { flex: 1; overflow-y: auto; padding: 4px 8px 12px; }
    .gw-tk-row { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 10px; cursor: pointer;
      color: #e7eef8; font-size: 14px; }
    .gw-tk-row:hover { background: rgba(255,255,255,0.04); }
    .gw-tk-row .ico { width: 28px; height: 28px; border-radius: 50%;
      display: inline-flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 800;
      background: linear-gradient(135deg, rgba(0,194,255,0.14), rgba(110,141,255,0.10)); border: 1px solid rgba(0,194,255,0.20); color: #5dd5ff; overflow: hidden; }
    .gw-tk-row img.ico { object-fit: cover; background: rgba(255,255,255,.04); border-color: rgba(255,255,255,.10); }
    .gw-tk-row .body { flex: 1; }
    .gw-tk-row .sym { font-weight: 800; font-size: 13.5px; }
    .gw-tk-row .name { font-size: 11.5px; color: #98a8c0; }
    .gw-tk-empty { padding: 30px 16px; text-align: center; color: #6b7a92; font-size: 13px; }

    /* Phase 7 v2 — token-picker BUTTON (replaces raw <select> visually) */
    .gw-ds-tkbtn { display: inline-flex; align-items: center; gap: 8px; padding: 8px 12px 8px 8px; border-radius: 12px;
      background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); color: #e7eef8;
      font-size: 13.5px; font-weight: 800; cursor: pointer; }
    .gw-ds-tkbtn:hover { background: rgba(255,255,255,0.07); border-color: rgba(0,194,255,0.25); }
    .gw-ds-tkbtn .ico { width: 22px; height: 22px; border-radius: 50%; background: linear-gradient(135deg, #00c2ff, #6e8dff); color: #041624;
      display: inline-flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 800; }
    .gw-ds-tkbtn .caret { color: #98a8c0; font-size: 10px; margin-left: 2px; }

    /* Phase 7 v2 — price impact bar */
    .gw-ds-pimp { margin-top: 6px; }
    .gw-ds-pimp .lbl { display: flex; justify-content: space-between; font-size: 10.5px; color: #98a8c0; letter-spacing: .12em; text-transform: uppercase; font-weight: 800; margin-bottom: 4px; }
    .gw-ds-pimp .bar { height: 6px; border-radius: 4px; background: rgba(255,255,255,0.05); overflow: hidden; }
    .gw-ds-pimp .fill { height: 100%; width: 0; transition: width .3s, background .3s; background: #22c17c; }
    .gw-ds-pimp.warn .fill { background: #f5b94d; }
    .gw-ds-pimp.bad  .fill { background: #f87171; }
    .gw-ds-pimp .val { font-weight: 800; }

    /* Phase 7 v2 — route (hops) visualization */
    .gw-ds-hops { margin-top: 8px; padding: 8px 10px; border-radius: 10px; background: rgba(0,194,255,0.05); border: 1px solid rgba(0,194,255,0.14); font-size: 11.5px; color: #cfdfee; display: flex; flex-wrap: wrap; gap: 4px; align-items: center; }
    .gw-ds-hops .h { padding: 3px 6px; border-radius: 6px; background: rgba(255,255,255,0.05); font-weight: 700; }
    .gw-ds-hops .arrow { color: #5dd5ff; font-weight: 800; margin: 0 2px; }
    .gw-ds-hops .via { color: #98a8c0; font-size: 10.5px; }
    /* Meta-aggregator comparison strip (Phase 2) */
    .gw-ds-route .agg-cmp { color: #6b7a92; font-size: 10.5px; margin-top: 4px; letter-spacing: .01em;
      display: flex; flex-wrap: wrap; gap: 6px 10px; }
    .gw-ds-route .agg-cmp .agg { color: #98a8c0; }
    .gw-ds-route .agg-cmp .agg.win { color: #22c17c; font-weight: 800; }
    /* Phase 3 — AI split-recommend banner */
    .gw-ds-ai-tip {
      margin-top: 10px; padding: 12px 14px 12px 40px; border-radius: 12px;
      background: linear-gradient(160deg, rgba(168,85,247,0.14), rgba(110,141,255,0.08));
      border: 1px solid rgba(168,85,247,0.28); color: #e7eef8; font-size: 12.5px;
      position: relative; line-height: 1.45;
    }
    .gw-ds-ai-tip::before { content: "✦"; position: absolute; left: 14px; top: 12px; color: #a855f7; font-size: 14px; font-weight: 800; }
    .gw-ds-ai-tip b { color: #d8b4fe; }
    .gw-ds-ai-tip .save { color: #22c17c; font-weight: 800; }
    .gw-ds-ai-tip button {
      display: inline-block; margin-top: 8px; padding: 6px 12px; border-radius: 8px; border: 0;
      background: linear-gradient(135deg, #a855f7, #6e8dff); color: #fff; font-weight: 800;
      font-size: 11.5px; cursor: pointer; letter-spacing: .04em;
    }
    .gw-ds-ai-tip button:hover { transform: translateY(-1px); box-shadow: 0 8px 18px -6px rgba(168,85,247,0.55); }

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
  // Paper mode (trading account) removed 2026-07-08 — the panel is
  // DEX-only now via LiFi/Paraswap/KyberSwap/Odos meta-aggregator.
  return 'onchain';
  // eslint-disable-next-line no-unreachable
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

/* ==========================================================================
 * PHASE 9 — GROM Treasury addresses per chain family
 *
 * EVM covered by GW_LIFI_FEE_ADDR at the top of this file. Non-EVM chains
 * need their own addresses because the wallet formats don't overlap:
 * ========================================================================== */
const GW_TREASURY = {
  evm:    '0xCFeF272536D6E91A4945063d40ac7CbA7Eb657B5',                // owner Trust
  solana: '5Gdx3BH2niKHnBbjsVn9my6wB89Jrc2WfuXUsb3snZ57',              // Phantom
  bitcoin:'bc1qj6ujhr098kj92t3wcr6lj8c0kgxhgjjakqsf3k',                // BTC bech32
  ton:    'UQB8I95eerNf8Z1Q6KEYZHweX6DhO0CY1pbCtP2kF6NOYwH7',          // Tonkeeper
  tron:   'TXSCoezBL9CJ2jD1cftS1XLV2T243E5jrS',                        // TronLink
};

/* ==========================================================================
 * PHASE 9 — Tron support (TronLink + SunSwap V2)
 *
 * TronLink is Tron's dominant wallet — browser extension that injects
 * `window.tronWeb`. We detect it on first click of the TRX chip, prompt
 * install if missing. SunSwap V2 is the largest Tron DEX (UniswapV2-style
 * router). No aggregators exist for Tron with clean public APIs, so we
 * hit the router directly for both quote (getAmountsOut) and swap.
 *
 * Fee collection: SunSwap has no built-in affiliate. We send 0.20 % of
 * the INPUT amount to our Tron treasury as a separate TRC-20 transfer
 * BEFORE the swap. Net user experience: two signatures for the first
 * swap (fee + swap), one for subsequent swaps if we later batch.
 *
 * Well-known TRC-20 addresses (mainnet, base58):
 * ========================================================================== */
const GW_TRON_ROUTER = 'TXk8rQSAvPvBBNtqSoY6nCfsXWCSSpTVQF';   // SunSwap V2 Router
const GW_TRON_WTRX   = 'TNUC9Qb1rRpS5CbWLmNMxXBjyFoydXjWFR';   // WTRX
const GW_TRON_TOKENS = {
  TRX:   null,   // native — use WTRX in the path
  USDT:  'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
  USDC:  'TEkxiTehnzSmSe2XqrBj4w32RUN966rdz8',
  SUN:   'TSSMHYeV2uE9qYH95DqyoCuNCzEL1NvU3S',
  BTT:   'TAFjULxiVgT4qWk6UZwjqwZXTSaGaqnVp4',
  JST:   'TCFLL5dx5ZJdKnWuesXxi1VPwjLVmWZZy9',
  WIN:   'TLa2f6VPqDgRE67v1736s7bJ8Ray5wYjU7',
};
const GW_TRON_DECIMALS = { TRX: 6, USDT: 6, USDC: 6, SUN: 18, BTT: 18, JST: 18, WIN: 6 };

async function gwTronConnect() {
  const tw = window.tronWeb;
  const link = window.tronLink;
  if (!tw && !link) {
    // Yes — opening tronlink.org is the expected install-prompt flow,
    // same pattern Phantom / Tonkeeper / MetaMask use. Toast the user
    // so it doesn't feel like an accidental redirect.
    gwToast('TronLink is required for Tron swaps — opening install page…', 'info');
    setTimeout(() => window.open('https://www.tronlink.org/', '_blank', 'noopener'), 400);
    throw new Error('TronLink not installed');
  }
  // Some TronLink builds require an explicit permission grant.
  if (link?.request) {
    try { await link.request({ method: 'tron_requestAccounts' }); } catch (_) {}
  }
  const addr = window.tronWeb?.defaultAddress?.base58;
  if (!addr) throw new Error('TronLink locked or no account');
  return addr;
}

/** SunSwap V2 quote — router.getAmountsOut(amountIn, path). */
async function gwTronQuote({ fromSym, toSym, amtHuman }) {
  const tw = window.tronWeb;
  if (!tw) throw new Error('TronLink not connected');
  const inTok  = fromSym === 'TRX' ? GW_TRON_WTRX : GW_TRON_TOKENS[fromSym];
  const outTok = toSym   === 'TRX' ? GW_TRON_WTRX : GW_TRON_TOKENS[toSym];
  if (!inTok || !outTok) throw new Error(`Tron: unsupported pair ${fromSym}/${toSym}`);
  const inDec = GW_TRON_DECIMALS[fromSym] ?? 6;
  const amtUnits = BigInt(Math.floor(amtHuman * 10 ** inDec)).toString();
  const router = await tw.contract().at(GW_TRON_ROUTER);
  const outs = await router.getAmountsOut(amtUnits, [inTok, outTok]).call();
  return {
    amountsOut: outs,
    inTok, outTok,
    inDec, outDec: GW_TRON_DECIMALS[toSym] ?? 6,
  };
}

/** Send our 0.20 % fee to the Tron treasury as a separate TRC-20 transfer. */
async function gwTronSendFee({ fromSym, amtHuman }) {
  const tw = window.tronWeb;
  if (fromSym === 'TRX') {
    const feeSun = Math.floor(amtHuman * 0.002 * 1e6); // TRX has 6 decimals as "sun"
    if (feeSun < 1_000_000) return; // <1 TRX — skip to avoid fee > swap
    await tw.trx.sendTransaction(GW_TREASURY.tron, feeSun);
    return;
  }
  const tok = GW_TRON_TOKENS[fromSym];
  if (!tok) return;
  const inDec = GW_TRON_DECIMALS[fromSym] ?? 6;
  const feeUnits = BigInt(Math.floor(amtHuman * 0.002 * 10 ** inDec)).toString();
  if (feeUnits === '0') return;
  const contract = await tw.contract().at(tok);
  await contract.transfer(GW_TREASURY.tron, feeUnits).send({ feeLimit: 100_000_000 });
}

async function gwTronSwapExec({ fromSym, toSym, amtHuman }) {
  const tw = window.tronWeb;
  if (!tw) await gwTronConnect();
  const user = tw.defaultAddress.base58;
  const q = await gwTronQuote({ fromSym, toSym, amtHuman });
  const expected = Number(q.amountsOut[1]) / 10 ** q.outDec;
  const minOut = BigInt(q.amountsOut[1]) * 995n / 1000n; // 0.5 % slippage
  const deadline = Math.floor(Date.now() / 1000) + 20 * 60;
  gwToast('Sending 0.20 % fee to GROM…', 'info');
  try { await gwTronSendFee({ fromSym, amtHuman }); } catch (_) {}
  gwToast(`SunSwap route · you get ~${expected.toFixed(6)} ${toSym} · confirm in TronLink`, 'info');
  const router = await tw.contract().at(GW_TRON_ROUTER);
  const path = [q.inTok, q.outTok];
  const amountIn = BigInt(Math.floor(amtHuman * 10 ** q.inDec)).toString();
  // For TRC-20 → TRC-20 the router requires prior approve.
  if (fromSym !== 'TRX') {
    const tokC = await tw.contract().at(q.inTok);
    const allow = await tokC.allowance(user, GW_TRON_ROUTER).call();
    if (BigInt(allow.toString()) < BigInt(amountIn)) {
      gwToast('Approve token to SunSwap router…', 'info');
      await tokC.approve(GW_TRON_ROUTER, (BigInt(2) ** 256n - 1n).toString()).send({ feeLimit: 100_000_000 });
    }
    const tx = await router
      .swapExactTokensForTokens(amountIn, minOut.toString(), path, user, deadline)
      .send({ feeLimit: 300_000_000 });
    gwToast('Swap sent — Tron confirms in ~3 sec', 'success');
    return tx;
  } else {
    // TRX → TRC-20 via swapExactETHForTokens equivalent
    const tx = await router
      .swapExactETHForTokens(minOut.toString(), path, user, deadline)
      .send({ callValue: amountIn, feeLimit: 300_000_000 });
    gwToast('Swap sent — Tron confirms in ~3 sec', 'success');
    return tx;
  }
}

/* ==========================================================================
 * PHASE 9 — TON support (TonConnect + STON.fi router)
 *
 * TonConnect is TON's WalletConnect equivalent — one protocol, works with
 * Tonkeeper, MyTonWallet, OpenMask, Bitget Wallet, Trust and every other
 * major TON wallet. We load the vanilla-JS UI SDK from CDN lazily on the
 * first click of the TON chip so it doesn't bloat cold-page load.
 *
 * STON.fi is the largest TON DEX (Router V1 REST API is public, no auth).
 * Their `/v1/swap/simulate` and `/v1/swap/pay` endpoints hand back the
 * exact BOC the user needs to sign — we forward it via TonConnect's
 * `sendTransaction` method.
 *
 * Manifest for TonConnect must live at a stable URL. Cursor's server
 * already serves /tonconnect-manifest.json (or we can generate one on
 * the fly — hosted here as a `data:` URL fallback if a real manifest
 * isn't reachable).
 * ========================================================================== */
const GW_TON_MANIFEST = {
  url: 'https://grom.exchange',
  name: 'GROM Exchange',
  iconUrl: 'https://grom.exchange/assets/grom-brand-mark.png',
  termsOfUseUrl: 'https://grom.exchange/#help',
  privacyPolicyUrl: 'https://grom.exchange/#help',
};
const GW_TON_ASSETS = {
  TON:   'ton_native',
  USDT:  'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs', // jUSDT
  NOT:   'EQAvlWFDxGF2lXm67y4yzC17wYKD9A0guwPkMs1gOsM__NOT',
  STON:  'EQA2kCVNwVsil2EM2mB0SkXytxCqQjS4mttjDpnXmwG9T6bO',
};

let gwTonUI = null;
async function gwTonEnsureUi() {
  if (gwTonUI) return gwTonUI;
  // Lazy-import TonConnect UI (~40 kB gzipped).
  const mod = await import('https://esm.sh/@tonconnect/ui@2.0.7');
  gwTonUI = new mod.TonConnectUI({
    manifestUrl: 'data:application/json;base64,' + btoa(JSON.stringify(GW_TON_MANIFEST)),
    buttonRootId: null, // we open programmatically, no button on page
  });
  return gwTonUI;
}
async function gwTonConnect() {
  const ui = await gwTonEnsureUi();
  if (ui.connected) return ui.wallet?.account?.address || null;
  await ui.openModal();
  // openModal resolves as soon as the modal opens; wait for connection event.
  return await new Promise((resolve, reject) => {
    const off = ui.onStatusChange((w) => {
      if (w?.account?.address) { off(); resolve(w.account.address); }
    });
    setTimeout(() => { try { off(); } catch (_) {} reject(new Error('TonConnect timeout')); }, 120_000);
  });
}
async function gwTonDisconnect() { const ui = await gwTonEnsureUi(); try { await ui.disconnect(); } catch (_) {} }

/** STON.fi router — simulate a swap. */
async function gwStonSimulate({ offerJetton, askJetton, offerUnits, slippageTolerance }) {
  const qs = new URLSearchParams({
    offer_address:  offerJetton,
    ask_address:    askJetton,
    units:          String(offerUnits),
    slippage_tolerance: String(slippageTolerance ?? '0.005'), // 0.5%
  });
  const r = await fetch(`https://api.ston.fi/v1/swap/simulate?${qs}`, { method: 'POST' });
  if (!r.ok) throw new Error(`STON.fi simulate ${r.status}`);
  return await r.json();
}

/** STON.fi pay-tx — returns the BOC to sign. */
async function gwStonPayTx({ userAddr, offerJetton, askJetton, offerUnits, minAskUnits, slippage }) {
  const body = {
    user_wallet_address: userAddr,
    offer_jetton_address: offerJetton,
    ask_jetton_address:   askJetton,
    offer_amount:         String(offerUnits),
    min_ask_amount:       String(minAskUnits),
    referral_address:     GW_TREASURY.ton,     // 0.20 % referral to us
    referral_value:       200,                 // basis points
    slippage_tolerance:   slippage ?? 0.005,
  };
  const r = await fetch('https://api.ston.fi/v1/swap/pay-tx', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`STON.fi pay-tx ${r.status}`);
  return await r.json();
}

/** Full TON swap flow. `amtHuman` is in whole-token units. */
async function gwTonSwapExec({ fromSym, toSym, amtHuman }) {
  const offer = GW_TON_ASSETS[fromSym];
  const ask   = GW_TON_ASSETS[toSym];
  if (!offer || !ask) throw new Error(`TON: unsupported pair ${fromSym}/${toSym}`);
  const ui = await gwTonEnsureUi();
  if (!ui.connected) await gwTonConnect();
  const userAddr = ui.wallet?.account?.address;
  if (!userAddr) throw new Error('TON wallet not connected');
  // TON native has 9 decimals, most jettons have 6-9. STON.fi returns
  // decimals in the simulate response.
  const offerUnits = BigInt(Math.floor(amtHuman * 1e9)).toString();
  gwToast('STON.fi simulating route…', 'info');
  const sim = await gwStonSimulate({ offerJetton: offer, askJetton: ask, offerUnits, slippageTolerance: 0.005 });
  const minAskUnits = sim?.min_ask_units || sim?.ask_units;
  const payTx = await gwStonPayTx({ userAddr, offerJetton: offer, askJetton: ask, offerUnits, minAskUnits });
  gwToast(`Confirm in TON wallet · you get ~${(Number(sim.ask_units) / 1e9).toFixed(6)} ${toSym}`, 'info');
  // payTx is the payload TonConnect will forward to the wallet.
  const messages = (payTx.messages || [payTx]).map((m) => ({
    address: m.address, amount: m.amount, payload: m.payload,
  }));
  const res = await ui.sendTransaction({
    validUntil: Math.floor(Date.now() / 1000) + 300,
    messages,
  });
  gwToast('TON tx sent — settlement in ~30 sec', 'success');
  return res?.boc;
}

/* ==========================================================================
 * PHASE 9b — Bitcoin → EVM via THORchain vault deposit (2026-07-08)
 *
 * Reverse of Phase 9 BTC. User has BTC in their own Bitcoin wallet, wants
 * USDT / USDC / ETH on any EVM chain we support. Flow:
 *
 *   1. gwBtcRevOpenModal() shows a form: destination EVM asset, amount
 *      of BTC, destination EVM address (auto-filled from connected wallet).
 *   2. gwBtcRevQuote() hits LiFi /quote with fromChain=Bitcoin and gets
 *      back a THORchain vault BTC address + memo the user should include.
 *   3. Modal displays: vault address (QR + copy), memo (copy), expected
 *      EVM output, ETA (~10 min for BTC confirmation + THORchain swap).
 *   4. gwBtcRevMonitor() polls LiFi /status every 30 s to catch the
 *      settlement and toast the user when EVM asset lands.
 *
 * The user's own Bitcoin wallet (Sparrow / Electrum / mobile app) sends
 * the BTC. We never touch their private keys — this is pure UI + vault
 * lookup + status polling.
 * ========================================================================== */
async function gwBtcRevQuote({ toChainId, toSym, btcAmt, evmDestAddr, btcRefundAddr }) {
  const cfg = GW_OC_SWAP[toChainId];
  if (!cfg) throw new Error(`unsupported destination chain ${toChainId}`);
  const outAddr = toSym === cfg.native ? cfg.wrapped : cfg.tokens[toSym];
  if (!outAddr) throw new Error(`${toSym} not on chain ${toChainId}`);
  const btcSatoshis = BigInt(Math.floor(btcAmt * 1e8)).toString();
  const qs = new URLSearchParams({
    fromChain:    String(GW_LIFI_BTC_CHAIN_ID),
    toChain:      String(toChainId),
    fromToken:    'bitcoin',
    toToken:      outAddr,
    fromAmount:   btcSatoshis,
    fromAddress:  btcRefundAddr,     // where THORchain refunds if the swap fails
    toAddress:    evmDestAddr,       // where EVM tokens land
    slippage:     '0.02',
    integrator:   GW_LIFI_INTEGRATOR,
    order:        'RECOMMENDED',
    allowBridges: 'thorchain',
    ...(GW_LIFI_FEE_ADDR !== '0x0000000000000000000000000000000000000000'
      ? { fee: String(GW_LIFI_FEE_PCT), feeAddress: GW_LIFI_FEE_ADDR }
      : {}),
  });
  const r = await fetch(`${GW_LIFI_ENDPOINT}/quote?${qs}`);
  if (!r.ok) throw new Error(`LiFi BTC→EVM quote ${r.status}: ${(await r.text()).slice(0, 120)}`);
  return await r.json();
}

/** Poll LiFi /status every 30 s until the swap lands or user closes. */
async function gwBtcRevMonitor(txHash, statusEl) {
  const started = Date.now();
  const tick = async () => {
    if (!statusEl.isConnected) return;
    if (Date.now() - started > 45 * 60_000) { statusEl.textContent = 'Timed out — check LiFi dashboard'; return; }
    try {
      const r = await fetch(`${GW_LIFI_ENDPOINT}/status?bridge=thorchain&txHash=${txHash}`);
      const j = await r.json();
      const status = j?.status || 'PENDING';
      const substatus = j?.substatus || '';
      statusEl.textContent = `${status}${substatus ? ' · ' + substatus : ''}`;
      if (status === 'DONE') {
        gwToast('BTC → EVM settled! Check your destination wallet.', 'success');
        return;
      }
      if (status === 'FAILED' || status === 'INVALID') {
        gwToast('Swap failed on THORchain — funds refunded to source BTC address', 'error');
        return;
      }
    } catch (_) {}
    setTimeout(tick, 30_000);
  };
  tick();
}

function gwBtcRevOpenModal() {
  let ov = document.getElementById('gw-btcrev-overlay');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'gw-btcrev-overlay';
    Object.assign(ov.style, {
      position: 'fixed', inset: '0', zIndex: '950', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      background: 'rgba(4,8,16,0.55)', backdropFilter: 'blur(6px)',
    });
    document.body.appendChild(ov);
  } else { ov.style.display = 'flex'; }
  ov.innerHTML = `
    <div id="gwBtcRevPanel" style="width:min(500px,94vw);max-height:92vh;overflow-y:auto;padding:22px;
         border-radius:20px;color:#e7eef8;
         background:linear-gradient(160deg,rgba(13,22,38,.98),rgba(8,14,26,.98));
         border:1px solid rgba(247,147,26,.28);box-shadow:0 20px 60px -12px rgba(0,0,0,.65)">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
        <span style="width:32px;height:32px;border-radius:50%;background:#F7931A;color:#fff;font-weight:800;
                     display:inline-flex;align-items:center;justify-content:center;font-size:14px">₿</span>
        <h3 style="margin:0;font-size:15.5px;font-weight:800">Bitcoin → EVM through THORchain</h3>
        <button id="gwBtcRevClose" style="margin-left:auto;background:transparent;border:0;color:#98a8c0;
                font-size:20px;cursor:pointer">×</button>
      </div>
      <p style="margin:0 0 14px;font-size:12.5px;color:#98a8c0;line-height:1.55">
        Ты отправляешь BTC со своего Bitcoin-кошелька на выданный THORchain vault-адрес.
        ETA ~10 мин (1 confirmation Bitcoin + свап THORchain).
      </p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
        <label style="font-size:11px;letter-spacing:.14em;color:#98a8c0;font-weight:800">TO CHAIN
          <select id="gwBtcRevChain" style="width:100%;padding:9px 10px;margin-top:4px;background:rgba(255,255,255,.05);
                  border:1px solid rgba(255,255,255,.08);border-radius:10px;color:#e7eef8;font-size:13px;font-family:inherit">
            <option value="1">Ethereum</option>
            <option value="56">BSC</option>
            <option value="42161">Arbitrum</option>
            <option value="137">Polygon</option>
            <option value="10">Optimism</option>
            <option value="8453">Base</option>
            <option value="43114">Avalanche</option>
          </select>
        </label>
        <label style="font-size:11px;letter-spacing:.14em;color:#98a8c0;font-weight:800">RECEIVE
          <select id="gwBtcRevAsset" style="width:100%;padding:9px 10px;margin-top:4px;background:rgba(255,255,255,.05);
                  border:1px solid rgba(255,255,255,.08);border-radius:10px;color:#e7eef8;font-size:13px;font-family:inherit">
            <option value="USDT">USDT</option>
            <option value="USDC">USDC</option>
            <option value="ETH">ETH / native</option>
            <option value="DAI">DAI</option>
          </select>
        </label>
      </div>
      <div style="margin-bottom:10px">
        <label style="font-size:11px;letter-spacing:.14em;color:#98a8c0;font-weight:800">BTC AMOUNT (SEND)</label>
        <input id="gwBtcRevAmt" type="number" step="0.0001" placeholder="0.01"
          style="width:100%;padding:10px 12px;margin-top:4px;background:rgba(255,255,255,.05);
                 border:1px solid rgba(255,255,255,.08);border-radius:10px;color:#e7eef8;font-size:14px;
                 font-family:inherit;outline:none" />
      </div>
      <div style="margin-bottom:10px">
        <label style="font-size:11px;letter-spacing:.14em;color:#98a8c0;font-weight:800">DESTINATION EVM ADDRESS</label>
        <input id="gwBtcRevEvm" type="text" placeholder="0x…"
          style="width:100%;padding:10px 12px;margin-top:4px;background:rgba(255,255,255,.05);
                 border:1px solid rgba(255,255,255,.08);border-radius:10px;color:#e7eef8;font-size:12px;
                 font-family:'JetBrains Mono',monospace;outline:none" />
      </div>
      <div style="margin-bottom:14px">
        <label style="font-size:11px;letter-spacing:.14em;color:#98a8c0;font-weight:800">YOUR BTC ADDRESS (refund on failure)</label>
        <input id="gwBtcRevSrc" type="text" placeholder="bc1q… или 1… / 3…"
          style="width:100%;padding:10px 12px;margin-top:4px;background:rgba(255,255,255,.05);
                 border:1px solid rgba(255,255,255,.08);border-radius:10px;color:#e7eef8;font-size:12px;
                 font-family:'JetBrains Mono',monospace;outline:none" />
      </div>
      <button id="gwBtcRevQuote" style="width:100%;padding:12px 16px;border-radius:12px;border:0;
              background:linear-gradient(135deg,#F7931A,#e07817);color:#0a0400;font-weight:800;font-size:14px;
              cursor:pointer">Получить vault-адрес →</button>
      <div id="gwBtcRevResult" style="margin-top:14px"></div>
    </div>
  `;
  // Autofill
  document.getElementById('gwBtcRevSrc').value = gwBtcAddrGet();
  (async () => {
    try {
      const provider = window.gromWallet?.wcProvider || window.ethereum;
      if (provider) {
        const [a] = await provider.request({ method: 'eth_accounts' });
        if (a) document.getElementById('gwBtcRevEvm').value = a;
      }
    } catch (_) {}
  })();
  document.getElementById('gwBtcRevClose').onclick = () => { ov.style.display = 'none'; };
  document.getElementById('gwBtcRevQuote').onclick = async () => {
    const chainId = Number(document.getElementById('gwBtcRevChain').value);
    const toSym   = document.getElementById('gwBtcRevAsset').value;
    const btcAmt  = Number(document.getElementById('gwBtcRevAmt').value);
    const evmDest = document.getElementById('gwBtcRevEvm').value.trim();
    const btcSrc  = document.getElementById('gwBtcRevSrc').value.trim();
    if (!(btcAmt > 0)) return gwToast('Введи сумму BTC', 'warn');
    if (!/^0x[a-fA-F0-9]{40}$/.test(evmDest)) return gwToast('EVM-адрес некорректный', 'warn');
    if (!gwBtcAddrValid(btcSrc)) return gwToast('BTC-refund адрес некорректный', 'warn');
    gwBtcAddrSet(btcSrc);
    const res = document.getElementById('gwBtcRevResult');
    res.innerHTML = `<div style="color:#98a8c0;font-size:12.5px;padding:10px">Fetching THORchain vault…</div>`;
    try {
      const q = await gwBtcRevQuote({ toChainId: chainId, toSym, btcAmt, evmDestAddr: evmDest, btcRefundAddr: btcSrc });
      const vault = q?.transactionRequest?.to;
      const memo  = q?.transactionRequest?.data || q?.includedSteps?.[0]?.action?.slippage || '';
      const outUnits = Number(q?.estimate?.toAmount || 0);
      const outDec = (GW_OC_SWAP[chainId]?.decimals?.[toSym]) || 6;
      const outHuman = outUnits / 10 ** outDec;
      if (!vault) throw new Error('LiFi returned no vault address');
      res.innerHTML = `
        <div style="padding:14px;border-radius:14px;background:rgba(247,147,26,.06);border:1px solid rgba(247,147,26,.22)">
          <div style="font-size:11.5px;color:#98a8c0;letter-spacing:.12em;text-transform:uppercase;margin-bottom:6px">Send exactly ${btcAmt} BTC to</div>
          <div style="font-family:'JetBrains Mono',monospace;font-size:13px;color:#e7eef8;word-break:break-all;margin-bottom:6px">${vault}</div>
          <button data-copy="${vault}" style="padding:5px 10px;border:0;border-radius:7px;background:rgba(255,255,255,.06);color:#e7eef8;font-size:11px;font-weight:700;cursor:pointer">Copy address</button>
          ${memo && memo !== '0x' ? `
            <div style="margin-top:10px;font-size:11.5px;color:#98a8c0;letter-spacing:.12em;text-transform:uppercase">Memo (paste in wallet)</div>
            <div style="font-family:'JetBrains Mono',monospace;font-size:12px;color:#e7eef8;word-break:break-all;margin-top:4px">${memo}</div>
            <button data-copy="${memo}" style="padding:5px 10px;margin-top:4px;border:0;border-radius:7px;background:rgba(255,255,255,.06);color:#e7eef8;font-size:11px;font-weight:700;cursor:pointer">Copy memo</button>
          ` : ''}
          <div style="margin-top:12px;font-size:12.5px;color:#cfdfee">You get ≈ <b style="color:#22c17c">${outHuman.toFixed(4)} ${toSym}</b> on ${GW_DS_CHAINS.find((c) => c.chainId === chainId)?.name || 'chain'}</div>
          <div id="gwBtcRevStatus" style="margin-top:8px;font-size:11.5px;color:#98a8c0">Status: waiting for BTC deposit…</div>
        </div>
      `;
      res.querySelectorAll('button[data-copy]').forEach((b) => b.onclick = () => {
        navigator.clipboard?.writeText(b.dataset.copy);
        b.textContent = 'Copied ✓';
        setTimeout(() => { b.textContent = b.textContent.replace('Copied ✓', 'Copy'); }, 1500);
      });
      // Start monitor if LiFi returned a monitor-able tx hash (it won't
      // until user actually broadcasts BTC — but we still watch the pair).
      const monitorTx = q?.id || q?.tool || '';
      if (monitorTx) gwBtcRevMonitor(monitorTx, document.getElementById('gwBtcRevStatus'));
    } catch (e) {
      res.innerHTML = `<div style="color:#f87171;font-size:12.5px;padding:10px">Error: ${e?.message || 'failed'}</div>`;
    }
  };
  ov.onclick = (e) => { if (e.target === ov) ov.style.display = 'none'; };
}

/* ==========================================================================
 * PHASE 9 — Bitcoin support via LiFi + THORchain (2026-07-08)
 *
 * Direction shipped: EVM ➔ BTC. User has funds on any of our EVM chains
 * (Ethereum, BSC, Polygon, Arbitrum, …), wants clean BTC delivered to
 * their own Bitcoin wallet. LiFi routes through THORchain internally:
 * user signs ONE EVM transaction, THORchain does the atomic swap, BTC
 * arrives at their BTC address in ~5–10 min.
 *
 * LiFi chain-id for Bitcoin: 20000000000001. toToken uses THORchain's
 * BTC.BTC representation which LiFi accepts as the string "BTC" or via
 * their explicit token address.
 *
 * Reverse (BTC → EVM) needs a THORchain-provided deposit vault address
 * that the user manually sends BTC to. Different UX, ships in Phase 9b.
 *
 * Bitcoin destination address is entered once and stored in
 * localStorage.gw_btc_addr (public data, safe to persist).
 * ========================================================================== */
const GW_LIFI_BTC_CHAIN_ID = 20000000000001;

function gwBtcAddrGet() { try { return localStorage.getItem('gw_btc_addr') || ''; } catch (_) { return ''; } }
function gwBtcAddrSet(a) { try { localStorage.setItem('gw_btc_addr', a); } catch (_) {} }

const GW_BTC_DIR_TR = {
  ru: { h: 'Bitcoin своп — выбери направление', a: 'У меня EVM · получить BTC', aSub: 'Укажешь свой BTC-адрес, свап через одну EVM-подпись', b: 'У меня BTC · получить USDT/ETH на EVM', bSub: 'Дадим vault-адрес THORchain, вручную отправишь BTC', cancel: 'Отмена' },
  en: { h: 'Bitcoin swap — pick a direction', a: 'I have EVM · get BTC', aSub: 'Enter your BTC address, swap in one EVM signature', b: 'I have BTC · get USDT/ETH on EVM', bSub: 'Get a THORchain vault address, send BTC from your wallet', cancel: 'Cancel' },
  es: { h: 'Swap Bitcoin — elige dirección', a: 'Tengo EVM · quiero BTC', aSub: 'Indica tu dirección BTC, una firma EVM', b: 'Tengo BTC · quiero USDT/ETH en EVM', bSub: 'Recibirás una dirección vault de THORchain', cancel: 'Cancelar' },
  ar: { h: 'مبادلة Bitcoin — اختر الاتجاه', a: 'لدي EVM · أريد BTC', aSub: 'أدخل عنوان BTC، توقيع EVM واحد', b: 'لدي BTC · أريد USDT/ETH على EVM', bSub: 'ستحصل على عنوان THORchain vault', cancel: 'إلغاء' },
  zh: { h: 'Bitcoin 兑换 · 选择方向', a: '我持有 EVM · 想要 BTC', aSub: '输入 BTC 地址，一次 EVM 签名', b: '我持有 BTC · 想要 USDT/ETH', bSub: '获得 THORchain vault 地址，从钱包发送 BTC', cancel: '取消' },
  hi: { h: 'Bitcoin स्वैप — दिशा चुनें', a: 'मेरे पास EVM · BTC चाहिए', aSub: 'BTC पता दें, एक EVM हस्ताक्षर', b: 'मेरे पास BTC · EVM पर USDT/ETH', bSub: 'THORchain vault पता मिलेगा', cancel: 'रद्द' },
  tr: { h: 'Bitcoin swap — yönü seç', a: 'EVM\'im var · BTC istiyorum', aSub: 'BTC adresini gir, tek EVM imzası', b: 'BTC\'m var · EVM\'de USDT/ETH', bSub: 'THORchain vault adresi al', cancel: 'Vazgeç' },
};
function gwBtcDirLang() { let l='en'; try { const s=localStorage.getItem('grom_lang'); if (s&&GW_BTC_DIR_TR[s]) l=s; } catch (_) {} return GW_BTC_DIR_TR[l]||GW_BTC_DIR_TR.en; }

function gwBtcDirectionPick() {
  return new Promise((resolve) => {
    const t = gwBtcDirLang();
    let ov = document.getElementById('gw-btcdir-overlay');
    if (!ov) {
      ov = document.createElement('div'); ov.id = 'gw-btcdir-overlay';
      Object.assign(ov.style, {
        position: 'fixed', inset: '0', zIndex: '955', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        background: 'rgba(4,8,16,0.55)', backdropFilter: 'blur(6px)',
      });
      document.body.appendChild(ov);
    } else { ov.style.display = 'flex'; }
    ov.innerHTML = `
      <div style="width:min(460px,92vw);padding:22px;border-radius:20px;color:#e7eef8;
                   background:linear-gradient(160deg,rgba(13,22,38,.98),rgba(8,14,26,.98));
                   border:1px solid rgba(247,147,26,.28);box-shadow:0 20px 60px -12px rgba(0,0,0,.65)">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
          <span style="width:32px;height:32px;border-radius:50%;background:#F7931A;color:#fff;font-weight:800;
                        display:inline-flex;align-items:center;justify-content:center;font-size:14px">₿</span>
          <h3 style="margin:0;font-size:15px;font-weight:800;flex:1">${t.h}</h3>
          <button data-c="close" style="background:transparent;border:0;color:#98a8c0;font-size:20px;cursor:pointer">×</button>
        </div>
        <button data-c="evm-to-btc" style="display:block;width:100%;text-align:left;padding:14px 16px;margin-bottom:10px;
                border-radius:12px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);color:#e7eef8;
                cursor:pointer;font-family:inherit">
          <div style="font-weight:800;font-size:14px">→ ${t.a}</div>
          <div style="font-size:12px;color:#98a8c0;margin-top:3px">${t.aSub}</div>
        </button>
        <button data-c="btc-to-evm" style="display:block;width:100%;text-align:left;padding:14px 16px;
                border-radius:12px;background:linear-gradient(135deg,rgba(247,147,26,.12),rgba(255,180,80,.06));
                border:1px solid rgba(247,147,26,.32);color:#e7eef8;cursor:pointer;font-family:inherit">
          <div style="font-weight:800;font-size:14px">← ${t.b}</div>
          <div style="font-size:12px;color:#cfdfee;margin-top:3px">${t.bSub}</div>
        </button>
      </div>`;
    const done = (v) => { ov.style.display = 'none'; resolve(v); };
    ov.querySelectorAll('button[data-c]').forEach((b) => { b.onclick = () => done(b.dataset.c === 'close' ? null : b.dataset.c); });
    ov.onclick = (e) => { if (e.target === ov) done(null); };
  });
}

/** Simple heuristic BTC-address validator (P2PKH / P2SH / bech32). */
function gwBtcAddrValid(a) {
  if (!a || typeof a !== 'string') return false;
  const s = a.trim();
  // Legacy 1…, P2SH 3…, bech32 bc1…
  return /^(1|3)[a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(s) || /^bc1[a-z0-9]{25,90}$/i.test(s);
}

/** Ask the user for their BTC destination address (once) — glass modal. */
async function gwBtcPromptAddress() {
  return new Promise((resolve) => {
    let ov = document.getElementById('gw-btc-overlay');
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'gw-btc-overlay';
      Object.assign(ov.style, {
        position: 'fixed', inset: '0', zIndex: '950', display: 'none',
        alignItems: 'center', justifyContent: 'center',
        background: 'rgba(4,8,16,0.55)', backdropFilter: 'blur(6px)',
      });
      ov.innerHTML = `
        <div style="width:min(440px,92vw);padding:22px;border-radius:20px;color:#e7eef8;
                    background:linear-gradient(160deg,rgba(13,22,38,.98),rgba(8,14,26,.98));
                    border:1px solid rgba(247,147,26,.28);box-shadow:0 20px 60px -12px rgba(0,0,0,.65)">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
            <span style="width:28px;height:28px;border-radius:50%;background:#F7931A;color:#fff;
                          font-weight:800;display:inline-flex;align-items:center;justify-content:center">₿</span>
            <h3 style="margin:0;font-size:15px;font-weight:800">Ваш Bitcoin-адрес получения</h3>
          </div>
          <p style="margin:0 0 12px;font-size:12.5px;color:#98a8c0;line-height:1.55">
            LiFi отправит BTC на этот адрес через THORchain после того как ты подпишешь EVM-транзакцию.
            Проверь дважды — вернуть нельзя.
          </p>
          <input id="gwBtcInp" type="text" placeholder="bc1q… или 1… / 3…"
            style="width:100%;padding:10px 12px;background:rgba(255,255,255,.05);
                   border:1px solid rgba(255,255,255,.08);border-radius:10px;color:#e7eef8;
                   font-size:14px;font-family:inherit;outline:none;margin-bottom:8px" />
          <div id="gwBtcErr" style="font-size:11.5px;color:#f87171;min-height:16px;margin-bottom:10px"></div>
          <div style="display:flex;gap:8px">
            <button id="gwBtcCancel" style="flex:1;padding:10px 14px;border-radius:10px;border:0;
                    background:rgba(255,255,255,.05);color:#cfdfee;font-weight:800;cursor:pointer">Отмена</button>
            <button id="gwBtcSave" style="flex:2;padding:10px 14px;border-radius:10px;border:0;
                    background:linear-gradient(135deg,#F7931A,#e07817);color:#0a0400;font-weight:800;
                    cursor:pointer">Сохранить</button>
          </div>
        </div>`;
      document.body.appendChild(ov);
    }
    const inp = ov.querySelector('#gwBtcInp');
    const err = ov.querySelector('#gwBtcErr');
    inp.value = gwBtcAddrGet();
    err.textContent = '';
    ov.style.display = 'flex';
    setTimeout(() => inp.focus(), 40);
    ov.querySelector('#gwBtcCancel').onclick = () => { ov.style.display = 'none'; resolve(null); };
    ov.querySelector('#gwBtcSave').onclick = () => {
      const v = (inp.value || '').trim();
      if (!gwBtcAddrValid(v)) { err.textContent = 'Похоже это не валидный BTC-адрес'; return; }
      gwBtcAddrSet(v);
      ov.style.display = 'none';
      resolve(v);
    };
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') ov.querySelector('#gwBtcSave').click(); });
    ov.onclick = (e) => { if (e.target === ov) { ov.style.display = 'none'; resolve(null); } };
  });
}

/** LiFi quote for EVM → BTC via THORchain. `toBtcAddr` is user's BTC. */
async function gwLifiQuoteToBtc({ fromChainId, fromSym, amtNum, evmAccount, toBtcAddr }) {
  const cfg = GW_OC_SWAP[fromChainId];
  if (!cfg) return null;
  const inAddr = fromSym === cfg.native ? cfg.wrapped : cfg.tokens[fromSym];
  if (!inAddr) return null;
  const inDec = cfg.decimals[fromSym] ?? 18;
  const fromAmount = BigInt(Math.floor(amtNum * 10 ** inDec)).toString();
  const qs = new URLSearchParams({
    fromChain:    String(fromChainId),
    toChain:      String(GW_LIFI_BTC_CHAIN_ID),
    fromToken:    inAddr,
    toToken:      'bitcoin',
    fromAmount,
    fromAddress:  evmAccount,
    toAddress:    toBtcAddr,
    slippage:     '0.02',
    integrator:   GW_LIFI_INTEGRATOR,
    order:        'RECOMMENDED',
    allowBridges: 'thorchain',
    ...(GW_LIFI_FEE_ADDR !== '0x0000000000000000000000000000000000000000'
      ? { fee: String(GW_LIFI_FEE_PCT), feeAddress: GW_LIFI_FEE_ADDR }
      : {}),
  });
  const r = await fetch(`${GW_LIFI_ENDPOINT}/quote?${qs}`, { headers: { accept: 'application/json' } });
  if (!r.ok) { console.warn('[GROM] lifi BTC quote', r.status, await r.text().catch(() => '')); return null; }
  return await r.json();
}

/** Full EVM → BTC swap: quote → approve → sign → confirm. */
async function gwBtcSwapExec({ fromChainId, fromSym, amtNum }) {
  let btcAddr = gwBtcAddrGet();
  if (!btcAddr) btcAddr = await gwBtcPromptAddress();
  if (!btcAddr) throw new Error('BTC address required');
  const provider = (window.gromWallet?.wcProvider && window.gromWallet.wcProvider.accounts?.[0])
    ? window.gromWallet.wcProvider : window.ethereum;
  if (!provider) throw new Error('No wallet provider');
  const [account] = await provider.request({ method: 'eth_accounts' });
  if (!account) throw new Error('Wallet not connected');
  gwToast('Requesting THORchain route via LiFi…', 'info');
  const quote = await gwLifiQuoteToBtc({ fromChainId, fromSym, amtNum, evmAccount: account, toBtcAddr: btcAddr });
  if (!quote?.transactionRequest) throw new Error('No THORchain route for this size/pair');
  const cfg = GW_OC_SWAP[fromChainId];
  const inAddr = fromSym === cfg.native ? cfg.wrapped : cfg.tokens[fromSym];
  const inDec = cfg.decimals[fromSym] ?? 18;
  const amountIn = BigInt(Math.floor(amtNum * 10 ** inDec));
  if (fromSym !== cfg.native) {
    const spender = quote.estimate?.approvalAddress || quote.transactionRequest.to;
    const allow = await gwErc20Allowance(provider, inAddr, account, spender);
    if (allow < amountIn) {
      gwToast('Approve token to THORchain router…', 'info');
      await gwErc20ApproveMax(provider, inAddr, spender, account);
    }
  }
  const outSat = Number(quote.estimate?.toAmount || 0) / 1e8;
  gwToast(`Confirm in wallet · you'll receive ~${outSat.toFixed(8)} BTC · ETA ~10 min`, 'info');
  const tx = quote.transactionRequest;
  const hash = await provider.request({ method: 'eth_sendTransaction', params: [{
    from: account, to: tx.to, data: tx.data, value: tx.value || '0x0',
    ...(tx.gasLimit ? { gas: tx.gasLimit } : {}),
  }] });
  gwToast('Submitted · THORchain confirming, BTC in ~5-10 min…', 'info');
  return hash;
}

/* ==========================================================================
 * PHASE 9 — Solana support (2026-07-08)
 *
 * User: "мне нужно чтобы человек мог в одном месте поменять". Solana
 * needs its own wallet stack — Phantom / Solflare / Backpack. We route
 * quotes through Jupiter Aggregator (jup.ag/swap), the de-facto meta-
 * aggregator on Solana. Jupiter's API is keyless and public.
 *
 * Flow when a user picks the SOL chain chip:
 *   1. `gwSolConnect()` opens Phantom's provider popup and gets pubkey.
 *   2. `gwSolQuote(inMint, outMint, amt)` hits Jupiter's quote API.
 *   3. `gwSolSwap(quote)` hits Jupiter's `/swap` endpoint to get an
 *      unsigned transaction (base64), then asks Phantom to sign + send.
 *
 * Well-known SPL token mints — SPL uses 32-byte base58 addresses.
 * ========================================================================== */
const GW_SOL_TOKENS = {
  SOL:  'So11111111111111111111111111111111111111112',
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  BONK: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  WIF:  'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
  JUP:  'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
  RAY:  '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
};
const GW_SOL_DECIMALS = { SOL: 9, USDC: 6, USDT: 6, BONK: 5, WIF: 6, JUP: 6, RAY: 6 };
const GW_JUP_ENDPOINT = 'https://quote-api.jup.ag/v6';

async function gwSolConnect() {
  const p = window.solana || window.phantom?.solana;
  if (!p) {
    window.open('https://phantom.app/download', '_blank', 'noopener');
    throw new Error('Phantom not installed');
  }
  if (!p.isConnected) await p.connect();
  return p.publicKey?.toString?.() || p.publicKey || null;
}

/** Jupiter v6 quote — full route with best-of-Solana DEX split. */
async function gwSolQuote({ inMint, outMint, amountBaseUnits }) {
  const qs = new URLSearchParams({
    inputMint:  inMint,
    outputMint: outMint,
    amount:     String(amountBaseUnits),
    slippageBps: '50',              // 0.50 %
    swapMode:   'ExactIn',
    onlyDirectRoutes: 'false',
    asLegacyTransaction: 'false',
    // Jupiter also supports platform fee — 20 bps to our SPL fee account
    // via `platformFeeBps` + `feeAccount` params. We add it once we
    // pre-create the SPL fee-collection account off-chain.
  });
  const r = await fetch(`${GW_JUP_ENDPOINT}/quote?${qs}`);
  if (!r.ok) throw new Error(`Jupiter quote ${r.status}`);
  return await r.json();
}

/** Jupiter v6 swap — returns a base64 tx we hand to Phantom for signing. */
async function gwSolSwap({ quoteResponse, userPubkey }) {
  const r = await fetch(`${GW_JUP_ENDPOINT}/swap`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ quoteResponse, userPublicKey: userPubkey, wrapAndUnwrapSol: true, dynamicComputeUnitLimit: true, prioritizationFeeLamports: 'auto' }),
  });
  if (!r.ok) throw new Error(`Jupiter swap ${r.status}`);
  const j = await r.json();
  return j.swapTransaction; // base64
}

async function gwSolExec({ fromSym, toSym, amtHuman }) {
  const inMint  = GW_SOL_TOKENS[fromSym];
  const outMint = GW_SOL_TOKENS[toSym];
  if (!inMint || !outMint) throw new Error(`unsupported SPL token — ${fromSym} or ${toSym}`);
  const inDec  = GW_SOL_DECIMALS[fromSym] ?? 6;
  const amountBaseUnits = BigInt(Math.floor(amtHuman * 10 ** inDec)).toString();
  const p = window.solana || window.phantom?.solana;
  if (!p) throw new Error('Phantom not connected');
  const pubkey = p.publicKey?.toString?.() || p.publicKey;
  const quote = await gwSolQuote({ inMint, outMint, amountBaseUnits });
  gwToast(`Jupiter route · ${quote.routePlan?.length || 1} hops · confirm in Phantom`, 'info');
  const txB64 = await gwSolSwap({ quoteResponse: quote, userPubkey: pubkey });
  // Phantom exposes signAndSendTransaction that accepts a serialized tx
  // as a Uint8Array. Convert base64 → Uint8Array first.
  const bin = Uint8Array.from(atob(txB64), (c) => c.charCodeAt(0));
  const { signature } = await p.signAndSendTransaction({ serializedMessage: bin });
  gwToast('Submitted to Solana — waiting for confirmation…', 'info');
  return signature;
}

/* ==========================================================================
 * PHASE 8 — DEX Spot Terminal (2026-07-08)
 *
 * Cursor's #page-spot has a paper-trading UI. We inject a full DEX terminal
 * ABOVE that so users can (a) see a live TradingView-style candle chart
 * for the pair, (b) see a real DEX depth ladder built by asking LiFi
 * for quotes at 5 different sizes on each side, (c) execute the swap
 * through our meta-aggregator with a single click.
 *
 *   ┌── Pair · BTC/USDT ▾ ──── Chart · 1h ─────────── Buy | Sell ─┐
 *   │ ┌─────────────────────────────┐ ┌────────────────────────┐ │
 *   │ │                             │ │ Amount  [___________]  │ │
 *   │ │      🕯 lightweight-chart    │ │ Price   0.00 USDT (mkt)│ │
 *   │ │                             │ │ Total ≈ $0             │ │
 *   │ │                             │ │ [ Buy 0.05 BTC → ]     │ │
 *   │ └─────────────────────────────┘ └────────────────────────┘ │
 *   │                                                              │
 *   │  DEPTH (live LiFi)                                           │
 *   │  ─────────── Ask (0.05) 65 120 ← 0.05% ──                    │
 *   │  ─────────── Ask (0.10) 65 090 ← 0.11% ──                    │
 *   │  ─────────── Ask (0.50) 65 015 ← 0.22% ──                    │
 *   │  ─────────── Mid       65 000                                │
 *   │  ─────────── Bid (0.05) 64 985 → 0.03% ──                    │
 *   │  ─────────── Bid (0.10) 64 950 → 0.08% ──                    │
 *   │  ─────────── Bid (0.50) 64 890 → 0.17% ──                    │
 *   └──────────────────────────────────────────────────────────────┘
 *
 * Data:
 *   - Chart candles → https://api.binance.com/api/v3/klines
 *   - Depth quotes  → gwMetaAggQuoteAll (already parallel-fetching 4 aggs)
 *   - Order exec    → gwOnChainSwapExec (also meta-agg)
 * ========================================================================== */
/* Seed pair list — expanded at boot from Cursor's Markets instruments
 * (365 crypto rows) so every user-visible symbol is tradeable here. */
let GW_SP_PAIRS = [
  { sym: 'BTC/USDT', base: 'BTC', quote: 'USDT', bn: 'BTCUSDT' },
  { sym: 'ETH/USDT', base: 'ETH', quote: 'USDT', bn: 'ETHUSDT' },
  { sym: 'BNB/USDT', base: 'BNB', quote: 'USDT', bn: 'BNBUSDT' },
  { sym: 'SOL/USDT', base: 'SOL', quote: 'USDT', bn: 'SOLUSDT' },
];
function gwSpMergePairs() {
  try {
    let anyMerged = false;
    // 1) Cursor's Markets crypto (365 pairs)
    if (typeof window.gromInstrumentsByType === 'function' && !gwSpMergePairs._instrDone) {
      const rows = window.gromInstrumentsByType('crypto') || [];
      const have = new Set(GW_SP_PAIRS.map((p) => p.sym));
      for (const r of rows) {
        const base  = r.base;
        const quote = r.quote || 'USDT';
        const sym   = `${base}/${quote}`;
        if (!base || have.has(sym)) continue;
        GW_SP_PAIRS.push({ sym, base, quote, bn: (base + quote).toUpperCase(), logo: r.logo || '' });
        have.add(sym);
      }
      gwSpMergePairs._instrDone = true;
      anyMerged = true;
    }
    // 2) LiFi's 9k+ unique symbols paired against USDT so every DEX-tradeable
    //    token is available in the Spot terminal too.
    if (!gwSpMergePairs._lifiDone) {
      const have = new Set(GW_SP_PAIRS.map((p) => p.sym));
      const seenBase = new Set(GW_SP_PAIRS.map((p) => p.base));
      let added = 0;
      for (const a of GW_DS_ASSETS) {
        if (!a.sym || a.sym === 'USDT' || seenBase.has(a.sym)) continue;
        const sym = `${a.sym}/USDT`;
        if (have.has(sym)) continue;
        GW_SP_PAIRS.push({ sym, base: a.sym, quote: 'USDT', bn: `${a.sym}USDT`.toUpperCase(), logo: a.logo || '' });
        have.add(sym); seenBase.add(a.sym); added++;
      }
      if (added > 0) { gwSpMergePairs._lifiDone = true; anyMerged = true; }
    }
    if (anyMerged) {
      console.log('[GROM] spot pairs total', GW_SP_PAIRS.length);
      try { if (document.getElementById('gwSpotDex')) gwRenderSpotDex(); } catch (_) {}
    }
    return gwSpMergePairs._instrDone;
  } catch (_) { return false; }
}
if (typeof window !== 'undefined') {
  let _spn = 0;
  const _spid = setInterval(() => { _spn++; if (gwSpMergePairs() || _spn >= 20) clearInterval(_spid); }, 500);
  gwSpMergePairs();
}
const GW_SP_INTERVALS = ['5m', '15m', '1h', '4h', '1d'];

function gwInjectSpotDexCss() {
  if (document.getElementById('gw-sp-css')) return;
  const css = `
    /* Hide Cursor's paper Spot-Trade UI — DEX terminal fully replaces it. */
    #page-spot > *:not(#gwSpotDex):not(script):not(style):not(link) { display: none !important; }
    .gw-sp-wrap { margin: 12px 0 20px; }
    .gw-sp-card { border-radius: 22px; padding: 18px; color: #e7eef8;
      background: linear-gradient(160deg, rgba(13,22,38,0.78), rgba(8,14,26,0.94));
      border: 1px solid rgba(0,194,255,0.20); box-shadow: 0 20px 60px -20px rgba(0,0,0,0.5); }
    .gw-sp-head { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; flex-wrap: wrap; }
    .gw-sp-head h3 { margin: 0; font-size: 15px; font-weight: 800; letter-spacing: -0.01em; }
    .gw-sp-head .badge { padding: 4px 8px; border-radius: 999px; background: rgba(34,193,124,0.14); color: #22c17c; font-size: 10px; font-weight: 800; letter-spacing: .14em; border: 1px solid rgba(34,193,124,0.28); }
    .gw-sp-head select { padding: 6px 10px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; color: #e7eef8; font-size: 13px; font-family: inherit; font-weight: 700; }
    .gw-sp-head .ivs { display: flex; gap: 4px; }
    .gw-sp-head .iv { padding: 4px 8px; border-radius: 8px; font-size: 11.5px; font-weight: 700; color: #98a8c0; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); cursor: pointer; }
    .gw-sp-head .iv.on { color: #e7eef8; background: rgba(0,194,255,0.14); border-color: rgba(0,194,255,0.3); }
    .gw-sp-head .last { margin-left: auto; font-variant-numeric: tabular-nums; }
    .gw-sp-head .last .p { font-weight: 800; font-size: 16px; }
    .gw-sp-head .last .c { font-size: 11.5px; }
    .gw-sp-head .last .c.up { color: #22c17c; } .gw-sp-head .last .c.down { color: #f87171; }
    .gw-sp-main { display: grid; grid-template-columns: 1fr 320px; gap: 14px; }
    @media (max-width: 900px) { .gw-sp-main { grid-template-columns: 1fr; } }
    .gw-sp-chart { position: relative; height: 380px; border-radius: 16px; overflow: hidden; background: rgba(0,0,0,0.15); border: 1px solid rgba(255,255,255,0.05); }
    .gw-sp-chart .skl { position: absolute; inset: 20px; display: grid; grid-template-columns: repeat(20, 1fr); gap: 3px; align-items: end; opacity: .4; pointer-events: none; }
    .gw-sp-chart .skl span { display: block; background: linear-gradient(180deg, rgba(0,194,255,.14), rgba(0,194,255,.04)); border-radius: 2px; animation: gw-sp-pulse 1.4s ease-in-out infinite; }
    @keyframes gw-sp-pulse { 0%,100% { opacity: .35 } 50% { opacity: .85 } }
    .gw-sp-chart .skl-hidden { display: none; }
    .gw-sp-form { padding: 14px; border-radius: 16px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); display: flex; flex-direction: column; gap: 12px; }
    .gw-sp-tabs { display: flex; gap: 6px; }
    .gw-sp-tab { flex: 1; padding: 8px 10px; border-radius: 10px; background: rgba(255,255,255,0.03); color: #98a8c0; border: 1px solid rgba(255,255,255,0.06); font-weight: 800; font-size: 13px; cursor: pointer; }
    .gw-sp-tab.buy.on  { background: rgba(34,193,124,0.16); color: #22c17c; border-color: rgba(34,193,124,0.3); }
    .gw-sp-tab.sell.on { background: rgba(232,87,107,0.16); color: #f87171; border-color: rgba(232,87,107,0.3); }
    .gw-sp-modes { display: flex; gap: 4px; font-size: 11.5px; }
    .gw-sp-mode { flex: 1; padding: 6px 8px; border-radius: 8px; background: rgba(255,255,255,0.03); color: #98a8c0; border: 1px solid rgba(255,255,255,0.05); font-weight: 700; cursor: pointer; text-align: center; }
    .gw-sp-mode.on { background: rgba(0,194,255,0.12); color: #5dd5ff; border-color: rgba(0,194,255,0.28); }
    .gw-sp-inp { display: flex; flex-direction: column; gap: 4px; }
    .gw-sp-inp label { font-size: 10.5px; letter-spacing: .12em; color: #98a8c0; font-weight: 800; }
    .gw-sp-inp input { padding: 10px 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; color: #e7eef8; font-size: 16px; outline: none; font-variant-numeric: tabular-nums; font-family: inherit; }
    .gw-sp-inp input:focus { border-color: rgba(0,194,255,0.35); }
    .gw-sp-inp .hint { font-size: 11px; color: #6b7a92; }
    .gw-sp-cta { padding: 12px 14px; border-radius: 12px; border: 0; font-weight: 800; font-size: 14px; cursor: pointer; }
    .gw-sp-cta.buy  { background: linear-gradient(135deg, #22c17c, #10a06a); color: #04160a; }
    .gw-sp-cta.sell { background: linear-gradient(135deg, #f87171, #d94f4f); color: #200a0a; }
    .gw-sp-cta[disabled] { opacity: 0.6; cursor: not-allowed; }

    .gw-sp-depth { margin-top: 14px; padding: 14px; border-radius: 14px; background: rgba(0,0,0,0.18); border: 1px solid rgba(255,255,255,0.05); }
    .gw-sp-depth h4 { margin: 0 0 10px; font-size: 11.5px; letter-spacing: .16em; color: #98a8c0; font-weight: 800; text-transform: uppercase; }
    .gw-sp-depth .row { display: grid; grid-template-columns: 90px 1fr auto auto; gap: 10px; padding: 4px 6px; font-size: 12.5px; font-variant-numeric: tabular-nums; align-items: center; }
    .gw-sp-depth .row .lvl { color: #6b7a92; font-size: 11px; }
    .gw-sp-depth .row.ask .px { color: #f87171; font-weight: 700; }
    .gw-sp-depth .row.bid .px { color: #22c17c; font-weight: 700; }
    .gw-sp-depth .row.mid { border-top: 1px dashed rgba(255,255,255,0.10); border-bottom: 1px dashed rgba(255,255,255,0.10); margin: 4px 0; padding-top: 6px; padding-bottom: 6px; color: #e7eef8; font-weight: 800; }
    .gw-sp-depth .bar { height: 6px; border-radius: 3px; }
    .gw-sp-depth .ask .bar { background: linear-gradient(90deg, rgba(232,87,107,0.28), rgba(232,87,107,0.08)); }
    .gw-sp-depth .bid .bar { background: linear-gradient(90deg, rgba(34,193,124,0.28), rgba(34,193,124,0.08)); }
    .gw-sp-depth .row .impact { color: #6b7a92; font-size: 10.5px; }
  `;
  const s = document.createElement('style'); s.id = 'gw-sp-css'; s.textContent = css; document.head.appendChild(s);
}

/** Fetch Binance klines. Returns array of {time, open, high, low, close, volume}. */
async function gwSpFetchKlines(symbol, interval, limit) {
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit || 200}`;
  const r = await fetch(url);
  const j = await r.json();
  return j.map((k) => ({ time: Math.floor(k[0] / 1000), open: +k[1], high: +k[2], low: +k[3], close: +k[4], volume: +k[5] }));
}
async function gwSpFetchLastPrice(symbol) {
  const r = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`);
  const j = await r.json();
  return { last: Number(j.lastPrice), change: Number(j.priceChangePercent) };
}

let gwSpState = { pair: 'BTC/USDT', iv: '1h', side: 'buy', mode: 'market' };

async function gwRenderSpotDex() {
  const page = document.getElementById('page-spot');
  if (!page) return;
  gwInjectSpotDexCss();
  let wrap = document.getElementById('gwSpotDex');
  if (!wrap) {
    wrap = document.createElement('div'); wrap.id = 'gwSpotDex'; wrap.className = 'gw-sp-wrap';
    page.prepend(wrap);
  }
  const st = gwSpState;
  const pair = GW_SP_PAIRS.find((p) => p.sym === st.pair) || GW_SP_PAIRS[0];
  wrap.innerHTML = `
    <div class="gw-sp-card">
      <div class="gw-sp-head">
        <h3>⚡ DEX Terminal</h3>
        <span class="badge">LIVE ON-CHAIN</span>
        <select id="gwSpPair">${GW_SP_PAIRS.map((p) => `<option value="${p.sym}" ${p.sym === st.pair ? 'selected' : ''}>${p.sym}</option>`).join('')}</select>
        <div class="ivs">${GW_SP_INTERVALS.map((iv) => `<button class="iv ${iv === st.iv ? 'on' : ''}" data-iv="${iv}">${iv}</button>`).join('')}</div>
        <div class="last" id="gwSpLast"><div class="p">…</div><div class="c">—</div></div>
      </div>
      <div class="gw-sp-main">
        <div class="gw-sp-chart" id="gwSpChart">
          <div class="skl" id="gwSpSkl">${Array.from({ length: 20 }, (_, i) => `<span style="height:${20 + Math.random() * 60}%"></span>`).join('')}</div>
        </div>
        <div class="gw-sp-form">
          <div class="gw-sp-tabs">
            <button class="gw-sp-tab buy ${st.side === 'buy' ? 'on' : ''}" data-side="buy">Buy ${pair.base}</button>
            <button class="gw-sp-tab sell ${st.side === 'sell' ? 'on' : ''}" data-side="sell">Sell ${pair.base}</button>
          </div>
          <div class="gw-sp-modes">
            <button class="gw-sp-mode ${st.mode === 'market' ? 'on' : ''}" data-mode="market">Market</button>
            <button class="gw-sp-mode ${st.mode === 'limit'  ? 'on' : ''}" data-mode="limit">Limit</button>
          </div>
          <div class="gw-sp-inp">
            <label>Amount (${pair.base}) · <span id="gwSpBal" style="color:#98a8c0">Balance: —</span></label>
            <input id="gwSpAmt" type="number" step="any" min="0" placeholder="0.00" />
            <div class="hint" id="gwSpAmtUsd">≈ $0</div>
          </div>
          <div class="gw-sp-inp" id="gwSpLimitPriceWrap" style="${st.mode === 'limit' ? '' : 'display:none'}">
            <label>Limit price (${pair.quote})</label>
            <input id="gwSpLimitPx" type="number" step="any" min="0" placeholder="Target price" />
          </div>
          <div class="gw-sp-inp">
            <label>You get / spend</label>
            <input id="gwSpTotal" type="text" readonly placeholder="—" />
            <div class="hint" id="gwSpTotalRoute">Route: LiFi meta-aggregator · 0.20% GROM fee</div>
          </div>
          <button class="gw-sp-cta ${st.side}" id="gwSpCta">${st.side === 'buy' ? 'Buy' : 'Sell'} ${pair.base} →</button>
        </div>
      </div>
      <div class="gw-sp-depth">
        <h4>Depth · live from meta-aggregator</h4>
        <div id="gwSpDepth"><div style="color:#6b7a92;font-size:12px;padding:6px">Loading depth ladder…</div></div>
      </div>
    </div>
  `;
  // Wire pair change
  document.getElementById('gwSpPair').onchange = (e) => { st.pair = e.target.value; gwRenderSpotDex(); };
  // Interval buttons
  wrap.querySelectorAll('.iv').forEach((b) => b.onclick = () => { st.iv = b.dataset.iv; gwSpLoadChart(); });
  // Side / mode tabs
  wrap.querySelectorAll('.gw-sp-tab').forEach((b) => b.onclick = () => { st.side = b.dataset.side; gwRenderSpotDex(); });
  wrap.querySelectorAll('.gw-sp-mode').forEach((b) => b.onclick = () => { st.mode = b.dataset.mode; gwRenderSpotDex(); });
  // Amount input → refresh quote
  const amtEl = document.getElementById('gwSpAmt');
  if (amtEl) amtEl.oninput = () => gwSpRefreshTotal();
  // CTA — market goes via meta-agg swap; limit stores an intent.
  document.getElementById('gwSpCta').onclick = () => gwSpSubmitOrder();

  gwSpLoadChart();
  gwSpRefreshLast();
  gwSpRefreshDepth();
  gwSpRefreshBalance();
}

/** Read wallet balance for the current side's spent asset and show it. */
async function gwSpRefreshBalance() {
  const el = document.getElementById('gwSpBal');
  if (!el) return;
  const st = gwSpState;
  const pair = GW_SP_PAIRS.find((p) => p.sym === st.pair);
  const asset = st.side === 'buy' ? pair.quote : pair.base;
  try {
    const provider = (window.gromWallet?.wcProvider && window.gromWallet.wcProvider.accounts?.[0])
      ? window.gromWallet.wcProvider : window.ethereum;
    if (!provider) { el.textContent = 'Connect wallet'; return; }
    const [account] = await provider.request({ method: 'eth_accounts' });
    if (!account) { el.textContent = 'Connect wallet'; return; }
    const chainId = parseInt(await provider.request({ method: 'eth_chainId' }), 16);
    const cfg = GW_OC_SWAP[chainId];
    if (!cfg) { el.textContent = 'Switch to a supported chain'; return; }
    if (asset === cfg.native) {
      const hex = await provider.request({ method: 'eth_getBalance', params: [account, 'latest'] });
      const wei = BigInt(hex);
      const eth = Number(wei) / 1e18;
      el.textContent = `Balance: ${eth.toFixed(4)} ${asset}`;
    } else if (cfg.tokens[asset]) {
      // erc20.balanceOf(account) → 0x70a08231 + 32-byte padded account
      const data = '0x70a08231' + account.slice(2).toLowerCase().padStart(64, '0');
      const hex = await provider.request({ method: 'eth_call', params: [{ to: cfg.tokens[asset], data }, 'latest'] });
      const dec = cfg.decimals[asset] ?? 18;
      const val = Number(BigInt(hex || '0x0')) / 10 ** dec;
      el.textContent = `Balance: ${val.toFixed(4)} ${asset}`;
    } else {
      el.textContent = `${asset} not on this chain`;
    }
  } catch (_) { el.textContent = 'Balance —'; }
}

let gwSpChart = null, gwSpSeries = null;
async function gwSpLoadChart() {
  // The Cursor page loads `lightweight-charts.standalone.production.js`
  // as an async <script> — it may still be parsing when we first render.
  // Poll a few times (2 s cap) then bail. Also cover the case where
  // #gwSpChart was rebuilt by a re-render and lost its previous chart.
  if (typeof window.LightweightCharts === 'undefined') {
    // Wait up to 8 s in 200 ms ticks — lightweight-charts is a big
    // sync script Cursor loads async, so on slow networks it can lag.
    if ((gwSpLoadChart._tries |= 0) >= 40) return;
    gwSpLoadChart._tries += 1;
    setTimeout(gwSpLoadChart, 200);
    // Also hook window.load once — resolves the race even faster.
    if (!gwSpLoadChart._hooked) {
      gwSpLoadChart._hooked = true;
      window.addEventListener('load', () => { gwSpLoadChart._tries = 0; gwSpLoadChart(); }, { once: true });
    }
    return;
  }
  gwSpLoadChart._tries = 0;
  const container = document.getElementById('gwSpChart');
  if (!container) return;
  // ALWAYS reset if the container node is different (navigation
  // Markets→Spot rebuilds the DOM tree). Previously we compared to
  // __container, but the old chart node is orphaned and the new
  // one is a fresh instance — so we must recreate every time we
  // detect a new container.
  if (gwSpChart && (!container.contains(gwSpChart.__container) || gwSpChart.__container !== container)) {
    try { gwSpChart.remove(); } catch (_) {}
    gwSpChart = null; gwSpSeries = null;
  }
  const pair = GW_SP_PAIRS.find((p) => p.sym === gwSpState.pair);
  if (!pair) return;
  if (!gwSpChart) {
    gwSpChart = window.LightweightCharts.createChart(container, {
      layout: { background: { color: 'transparent' }, textColor: '#98a8c0' },
      grid: { vertLines: { color: 'rgba(255,255,255,0.04)' }, horzLines: { color: 'rgba(255,255,255,0.04)' } },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.08)' },
      timeScale: { borderColor: 'rgba(255,255,255,0.08)', timeVisible: true, secondsVisible: false },
      crosshair: { mode: window.LightweightCharts.CrosshairMode.Magnet },
      height: container.clientHeight || 380,
    });
    gwSpSeries = gwSpChart.addCandlestickSeries({
      upColor: '#22c17c', downColor: '#f87171', wickUpColor: '#22c17c', wickDownColor: '#f87171', borderVisible: false,
    });
    gwSpChart.__container = container;
    window.addEventListener('resize', () => { try { gwSpChart.resize(container.clientWidth, container.clientHeight); } catch (_) {} });
  }
  try {
    const bars = await gwSpFetchKlines(pair.bn, gwSpState.iv, 200);
    gwSpSeries.setData(bars);
    gwSpChart.timeScale().fitContent();
    // Hide skeleton loader now that real candles are drawn.
    const skl = document.getElementById('gwSpSkl');
    if (skl) skl.remove();
  } catch (e) { console.warn('[GROM] spot chart klines', e); }
}
async function gwSpRefreshLast() {
  const pair = GW_SP_PAIRS.find((p) => p.sym === gwSpState.pair);
  if (!pair) return;
  try {
    const { last, change } = await gwSpFetchLastPrice(pair.bn);
    const box = document.getElementById('gwSpLast');
    if (!box) return;
    box.innerHTML = `<div class="p">${last.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${pair.quote}</div>
      <div class="c ${change >= 0 ? 'up' : 'down'}">${change >= 0 ? '+' : ''}${change.toFixed(2)}% · 24h</div>`;
  } catch (_) {}
}
async function gwSpRefreshDepth() {
  const pair = GW_SP_PAIRS.find((p) => p.sym === gwSpState.pair);
  const el = document.getElementById('gwSpDepth');
  if (!pair || !el) return;
  const provider = (window.gromWallet?.wcProvider && window.gromWallet.wcProvider.accounts?.[0])
    ? window.gromWallet.wcProvider : window.ethereum;
  let account = null, chainId = 1;
  try {
    if (provider) {
      [account] = await provider.request({ method: 'eth_accounts' });
      chainId = parseInt(await provider.request({ method: 'eth_chainId' }), 16);
    }
  } catch (_) {}
  if (!account) {
    // Fallback: fetch a real orderbook from Binance public API so the ladder
    // isn't empty for anonymous users. Once wallet connects, LiFi takes over.
    try {
      const r = await fetch(`https://api.binance.com/api/v3/depth?symbol=${pair.bn}&limit=10`);
      const j = await r.json();
      const asks = (j.asks || []).slice(0, 5).reverse().map((a) => ({ px: Number(a[0]), sz: Number(a[1]) }));
      const bids = (j.bids || []).slice(0, 5).map((b) => ({ px: Number(b[0]), sz: Number(b[1]) }));
      const mid = asks.length && bids.length ? (asks[asks.length - 1].px + bids[0].px) / 2 : null;
      const askHtml = asks.map((a) => `<div class="row ask"><span class="lvl">Ask ${a.sz.toFixed(4)}</span><span class="bar"></span><span class="px">${a.px.toLocaleString('en-US')}</span><span class="impact">${mid ? '+' + (((a.px - mid) / mid) * 100).toFixed(2) + '%' : ''}</span></div>`).join('');
      const bidHtml = bids.map((b) => `<div class="row bid"><span class="lvl">Bid ${b.sz.toFixed(4)}</span><span class="bar"></span><span class="px">${b.px.toLocaleString('en-US')}</span><span class="impact">${mid ? '−' + (((mid - b.px) / mid) * 100).toFixed(2) + '%' : ''}</span></div>`).join('');
      el.innerHTML = `${askHtml}<div class="row mid"><span>MID</span><span></span><span>${mid ? mid.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '—'}</span><span></span></div>${bidHtml}
        <div style="color:#6b7a92;font-size:11px;margin-top:8px;text-align:center">Connect a wallet to see live DEX depth</div>`;
    } catch (_) {
      el.innerHTML = `<div style="color:#6b7a92;font-size:12px;padding:6px">Connect a wallet to see live DEX depth</div>`;
    }
    return;
  }
  // Fetch quotes at 5 sizes on each side
  const sizes = [0.01, 0.05, 0.25, 1, 5]; // in base asset
  const asks = []; const bids = [];
  await Promise.all(sizes.flatMap((size) => [
    gwAggQuoteLifi({ chainId, fromSym: pair.quote, toSym: pair.base, amtNum: size * (asks._midHint || 65000), account })
      .then((q) => { if (q?.toAmount) asks.push({ size, quote: q }); }).catch(() => {}),
    gwAggQuoteLifi({ chainId, fromSym: pair.base,  toSym: pair.quote, amtNum: size, account })
      .then((q) => { if (q?.toAmount) bids.push({ size, quote: q }); }).catch(() => {}),
  ]));
  const cfg = GW_OC_SWAP[chainId] || { decimals: {} };
  const baseDec  = cfg.decimals[pair.base]  ?? 18;
  const quoteDec = cfg.decimals[pair.quote] ?? 6;
  // Compute mid-price from smallest bid+ask if available
  let mid = null;
  const midAsk = asks[0], midBid = bids[0];
  if (midAsk && midBid) {
    const askPx = (midAsk.size) / (Number(midAsk.quote.toAmount) / 10 ** baseDec);
    const bidPx = (Number(midBid.quote.toAmount) / 10 ** quoteDec) / midBid.size;
    void askPx; mid = (askPx + bidPx) / 2;
  }
  const rowsAsk = asks.sort((a, b) => b.size - a.size).map((r) => {
    const gotBase = Number(r.quote.toAmount) / 10 ** baseDec;
    const px = r.size / gotBase; // quote per base
    const impact = mid ? ((px - mid) / mid) * 100 : 0;
    return `<div class="row ask">
      <span class="lvl">Ask ${r.size} ${pair.base}</span>
      <span class="bar"></span>
      <span class="px">${px.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
      <span class="impact">+${Math.abs(impact).toFixed(2)}%</span>
    </div>`;
  }).join('');
  const rowsBid = bids.sort((a, b) => a.size - b.size).map((r) => {
    const gotQuote = Number(r.quote.toAmount) / 10 ** quoteDec;
    const px = gotQuote / r.size; // quote per base
    const impact = mid ? ((mid - px) / mid) * 100 : 0;
    return `<div class="row bid">
      <span class="lvl">Bid ${r.size} ${pair.base}</span>
      <span class="bar"></span>
      <span class="px">${px.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
      <span class="impact">−${Math.abs(impact).toFixed(2)}%</span>
    </div>`;
  }).join('');
  el.innerHTML = `${rowsAsk}
    <div class="row mid"><span>MID</span><span></span><span>${mid ? mid.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '—'}</span><span></span></div>
    ${rowsBid}`;
}
function gwSpRefreshTotal() {
  const st = gwSpState;
  const pair = GW_SP_PAIRS.find((p) => p.sym === st.pair);
  const amt = Number(document.getElementById('gwSpAmt')?.value || 0);
  const totalEl = document.getElementById('gwSpTotal');
  if (!totalEl || !pair) return;
  gwSpFetchLastPrice(pair.bn).then((p) => {
    const px = st.mode === 'limit' ? Number(document.getElementById('gwSpLimitPx')?.value || p.last) : p.last;
    const total = st.side === 'buy' ? amt * px : amt * px;
    totalEl.value = `${total.toFixed(2)} ${pair.quote}`;
    const usdEl = document.getElementById('gwSpAmtUsd');
    if (usdEl) usdEl.textContent = `≈ $${(amt * px).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  }).catch(() => {});
}
async function gwSpSubmitOrder() {
  const st = gwSpState;
  const pair = GW_SP_PAIRS.find((p) => p.sym === st.pair);
  const amt = Number(document.getElementById('gwSpAmt')?.value || 0);
  if (!(amt > 0)) return gwToast('Enter amount', 'warn');
  if (st.mode === 'limit') {
    const px = Number(document.getElementById('gwSpLimitPx')?.value || 0);
    if (!(px > 0)) return gwToast('Enter limit price', 'warn');
    const list = gwOrdLoad();
    list.push({ id: 'lim_' + Date.now().toString(36), type: 'limit',
      from: st.side === 'buy' ? pair.quote : pair.base,
      to:   st.side === 'buy' ? pair.base  : pair.quote,
      price: px, amt: st.side === 'buy' ? amt * px : amt, createdAt: Date.now(), state: 'watching' });
    gwOrdSave(list);
    gwToast(`Limit ${st.side} ${amt} ${pair.base} at ${px} added — will fire when hit`, 'success');
    return;
  }
  // Market — route through meta-agg swap
  const from = st.side === 'buy' ? pair.quote : pair.base;
  const to   = st.side === 'buy' ? pair.base  : pair.quote;
  const swapAmt = st.side === 'buy'
    ? amt * Number((await gwSpFetchLastPrice(pair.bn)).last)
    : amt;
  const cta = document.getElementById('gwSpCta');
  if (cta) { cta.disabled = true; cta.textContent = 'Submitting…'; }
  try {
    await gwOnChainSwapExec(from, to, swapAmt);
    gwToast(`${st.side.toUpperCase()} ${amt} ${pair.base} filled via meta-aggregator`, 'success');
    document.getElementById('gwSpAmt').value = '';
    gwSpRefreshDepth();
  } catch (e) {
    gwToast(`Swap failed: ${e?.message || e}`, 'error');
  } finally {
    if (cta) { cta.disabled = false; cta.textContent = `${st.side === 'buy' ? 'Buy' : 'Sell'} ${pair.base} →`; }
  }
}

function gwSetupSpotDex() {
  const tryRender = gwDebounce(() => {
    if (document.getElementById('page-spot')) {
      try { gwRenderSpotDex(); console.log('[GROM] spot DEX terminal rendered'); }
      catch (e) { console.warn('[GROM] spot DEX', e); }
    }
  }, 250);
  tryRender();
  let n = 0; const id = setInterval(() => { n++; if (document.getElementById('gwSpotDex') || n >= 20) clearInterval(id); else tryRender(); }, 500);
  window.addEventListener('hashchange', tryRender);
  const obs = new MutationObserver(() => tryRender()); obs.observe(document.body, { attributes: true, subtree: false, attributeFilter: ['data-page'] });
  window.addEventListener('grom:lang-change', tryRender);
  // Refresh live last-price + depth every 30 s
  setInterval(() => { if (document.getElementById('gwSpotDex') && document.getElementById('page-spot')?.offsetParent) { gwSpRefreshLast(); gwSpRefreshDepth(); } }, 30_000);
}

/* ==========================================================================
 * PHASE 7 — Premium swap panel
 *
 * The list below drives the chain-chip row inserted at the top of the
 * on-chain mode. Each entry is either EVM (has `chainId`) or non-EVM
 * ("solana", "bitcoin", "ton", "tron"). Clicking an EVM chip triggers
 * wallet_switchEthereumChain; clicking a non-EVM chip either activates
 * the LiFi path for that chain (solana + bitcoin) or shows a "connect
 * with X wallet" toast (ton + tron — Phase 9). The chip UI itself
 * lives in gwDsChainChipsHtml + gwDsChainChipsWire.
 * ========================================================================== */
const GW_DS_CHAINS = [
  { key: 'eth',      chainId: 1,      name: 'Ethereum',  short: 'ETH',   color: '#627EEA' },
  { key: 'bsc',      chainId: 56,     name: 'BNB Chain', short: 'BSC',   color: '#F0B90B' },
  { key: 'arb',      chainId: 42161,  name: 'Arbitrum',  short: 'ARB',   color: '#28A0F0' },
  { key: 'polygon',  chainId: 137,    name: 'Polygon',   short: 'POL',   color: '#8247E5' },
  { key: 'base',     chainId: 8453,   name: 'Base',      short: 'BASE',  color: '#0052FF' },
  { key: 'op',       chainId: 10,     name: 'Optimism',  short: 'OP',    color: '#FF0420' },
  { key: 'avax',     chainId: 43114,  name: 'Avalanche', short: 'AVAX',  color: '#E84142' },
  { key: 'linea',    chainId: 59144,  name: 'Linea',     short: 'LINEA', color: '#61DFFF' },
  { key: 'fantom',   chainId: 250,    name: 'Fantom',    short: 'FTM',   color: '#1969FF' },
  { key: 'solana',   nonEvm: 'sol',   name: 'Solana',    short: 'SOL',   color: '#9945FF' },
  { key: 'bitcoin',  nonEvm: 'btc',   name: 'Bitcoin',   short: 'BTC',   color: '#F7931A' },
  { key: 'ton',      nonEvm: 'ton',   name: 'TON',       short: 'TON',   color: '#0098EA' },
  { key: 'tron',     nonEvm: 'trx',   name: 'Tron',      short: 'TRX',   color: '#EF0027' },
];
const GW_DS_EVM_HEX = (id) => '0x' + id.toString(16);

/** Insert / refresh the chain-chip row inside the swap panel. */
function gwDsChainChipsHtml(activeChainId) {
  return `
    <div class="gw-ds-chains" role="tablist">
      ${GW_DS_CHAINS.map((c) => {
        const on = c.chainId === activeChainId ? ' on' : '';
        const soon = c.soon ? ' soon' : '';
        const dataAttr = c.chainId ? `data-cid="${c.chainId}"` : `data-nonevm="${c.nonEvm}"`;
        return `<button type="button" class="gw-ds-chain${on}${soon}" ${dataAttr} title="${c.name}" style="--chColor:${c.color}">
          <span class="dot"></span><span class="lbl">${c.short}</span>${c.soon ? '<span class="soon-tag">soon</span>' : ''}
        </button>`;
      }).join('')}
    </div>
  `;
}

function gwDsChainChipsWire(wrap) {
  wrap.querySelectorAll('.gw-ds-chain[data-cid]').forEach((b) => {
    b.onclick = async () => {
      const cid = Number(b.dataset.cid);
      const provider = (window.gromWallet?.wcProvider && window.gromWallet.wcProvider.accounts?.[0])
        ? window.gromWallet.wcProvider
        : window.ethereum;
      if (!provider) { gwToast('Connect a wallet first', 'warn'); return; }
      try {
        await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: GW_DS_EVM_HEX(cid) }] });
        gwToast(`Switched to ${GW_DS_CHAINS.find((c) => c.chainId === cid)?.name || 'chain'}`, 'success');
        setTimeout(() => { try { gwDsRefreshRate(); } catch (_) {} }, 400);
      } catch (e) {
        gwToast('Chain switch cancelled or unsupported', 'warn');
      }
    };
  });
  wrap.querySelectorAll('.gw-ds-chain[data-nonevm]').forEach((b) => {
    b.onclick = async () => {
      const kind = b.dataset.nonevm;
      if (kind === 'sol') {
        try {
          const pk = await gwSolConnect();
          gwToast(`Phantom connected: ${pk.slice(0, 4)}…${pk.slice(-4)} — Jupiter route ready`, 'success');
          window.__gwSolPubkey = pk;
          try { gwDsRefreshRate(); } catch (_) {}
        } catch (e) {
          gwToast(`Phantom: ${e?.message || 'not installed'}`, 'warn');
        }
      }
      else if (kind === 'btc') {
        // Two flows: (A) send EVM asset, receive BTC — save destination
        // BTC address so the swap panel routes there. (B) send BTC from
        // your own wallet, receive EVM asset — open the vault-deposit
        // modal. User picks via glass modal (i18n, replaces confirm()).
        const dir = await gwBtcDirectionPick();
        if (dir === 'evm-to-btc') {
          const addr = await gwBtcPromptAddress();
          if (addr) {
            window.__gwBtcAddr = addr;
            gwToast(`BTC address saved: ${addr.slice(0, 6)}…${addr.slice(-4)}`, 'success');
          }
        } else if (dir === 'btc-to-evm') {
          gwBtcRevOpenModal();
        }
      }
      else if (kind === 'ton') {
        try {
          const addr = await gwTonConnect();
          gwToast(`TON connected: ${addr.slice(0, 6)}…${addr.slice(-4)} — STON.fi route ready`, 'success');
          window.__gwTonAddr = addr;
        } catch (e) {
          gwToast(`TON: ${e?.message || 'connection cancelled'}`, 'warn');
        }
      }
      else if (kind === 'trx') {
        try {
          const addr = await gwTronConnect();
          gwToast(`TronLink connected: ${addr.slice(0, 4)}…${addr.slice(-4)} — SunSwap route ready`, 'success');
          window.__gwTronAddr = addr;
        } catch (e) {
          gwToast(`TronLink: ${e?.message || 'not installed'}`, 'warn');
        }
      }
    };
  });
}

/* ==========================================================================
 * PHASE 7 v2 — Token picker modal, route-viz, price impact, explorer links
 * ========================================================================== */
/* ==========================================================================
 * ITEM #3 (2026-07-09) — Custom token add
 *
 * User pastes a contract address (any EVM chain), we call LiFi's
 * /token/{chainId}/{address} to fetch metadata, add to GW_DS_ASSETS
 * and persist in localStorage.gw_custom_tokens. Shows up in the picker
 * with a "★ custom" tag so user recognises their addition.
 * ========================================================================== */
function gwCustomTokensLoad() { try { return JSON.parse(localStorage.getItem('gw_custom_tokens') || '[]'); } catch (_) { return []; } }
function gwCustomTokensSave(v) { try { localStorage.setItem('gw_custom_tokens', JSON.stringify(v)); } catch (_) {} }
(function _gwHydrateCustom() {
  try {
    const list = gwCustomTokensLoad();
    for (const c of list) {
      if (!GW_DS_ASSETS.find((a) => a.sym === c.sym)) GW_DS_ASSETS.push({ ...c, custom: true });
    }
  } catch (_) {}
})();

async function gwCustomTokenValidate({ chainId, address }) {
  // LiFi /token endpoint returns { symbol, name, decimals, logoURI, priceUSD }
  try {
    const r = await fetch(`${GW_LIFI_ENDPOINT}/token?chain=${chainId}&token=${address}`);
    if (!r.ok) return null;
    const t = await r.json();
    if (!t?.symbol) return null;
    return { sym: t.symbol, name: t.name || t.symbol, logo: t.logoURI || '', decimals: t.decimals, address, chainId };
  } catch (_) { return null; }
}

function gwCustomTokenOpenModal() {
  let ov = document.getElementById('gw-ct-overlay');
  if (!ov) {
    ov = document.createElement('div'); ov.id = 'gw-ct-overlay';
    Object.assign(ov.style, {
      position: 'fixed', inset: '0', zIndex: '960', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      background: 'rgba(4,8,16,0.55)', backdropFilter: 'blur(6px)',
    });
    document.body.appendChild(ov);
  } else { ov.style.display = 'flex'; }
  ov.innerHTML = `
    <div style="width:min(440px,92vw);padding:22px;border-radius:20px;color:#e7eef8;
                 background:linear-gradient(160deg,rgba(13,22,38,.98),rgba(8,14,26,.98));
                 border:1px solid rgba(0,194,255,.28);box-shadow:0 20px 60px -12px rgba(0,0,0,.65)">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
        <span style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#00c2ff,#6e8dff);color:#04121f;
                     display:inline-flex;align-items:center;justify-content:center;font-weight:800">★</span>
        <h3 style="margin:0;font-size:15px;font-weight:800;flex:1">Add custom token</h3>
        <button id="gwCtClose" style="background:transparent;border:0;color:#98a8c0;font-size:20px;cursor:pointer">×</button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
        <label style="font-size:11px;letter-spacing:.14em;color:#98a8c0;font-weight:800">CHAIN
          <select id="gwCtChain" style="width:100%;padding:9px 10px;margin-top:4px;background:rgba(255,255,255,.05);
                  border:1px solid rgba(255,255,255,.08);border-radius:10px;color:#e7eef8;font-size:13px;font-family:inherit">
            <option value="1">Ethereum</option>
            <option value="56">BNB Chain</option>
            <option value="42161">Arbitrum</option>
            <option value="137">Polygon</option>
            <option value="10">Optimism</option>
            <option value="8453">Base</option>
            <option value="43114">Avalanche</option>
            <option value="59144">Linea</option>
            <option value="250">Fantom</option>
          </select>
        </label>
        <div></div>
      </div>
      <div style="margin-bottom:12px">
        <label style="font-size:11px;letter-spacing:.14em;color:#98a8c0;font-weight:800">TOKEN CONTRACT ADDRESS</label>
        <input id="gwCtAddr" type="text" placeholder="0x…"
          style="width:100%;padding:10px 12px;margin-top:4px;background:rgba(255,255,255,.05);
                 border:1px solid rgba(255,255,255,.08);border-radius:10px;color:#e7eef8;font-size:12px;
                 font-family:'JetBrains Mono',monospace;outline:none" />
        <div id="gwCtErr" style="font-size:11.5px;color:#f87171;min-height:14px;margin-top:4px"></div>
      </div>
      <button id="gwCtLookup" style="width:100%;padding:12px 16px;border-radius:12px;border:0;
              background:linear-gradient(135deg,#00c2ff,#6e8dff);color:#04121f;font-weight:800;font-size:14px;
              cursor:pointer">Validate & add →</button>
      <div id="gwCtResult" style="margin-top:14px"></div>
    </div>`;
  document.getElementById('gwCtClose').onclick = () => { ov.style.display = 'none'; };
  document.getElementById('gwCtLookup').onclick = async () => {
    const chainId = Number(document.getElementById('gwCtChain').value);
    const address = document.getElementById('gwCtAddr').value.trim();
    const err = document.getElementById('gwCtErr');
    const res = document.getElementById('gwCtResult');
    err.textContent = ''; res.innerHTML = '';
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) { err.textContent = 'Invalid EVM contract address'; return; }
    res.innerHTML = `<div style="color:#98a8c0;font-size:12.5px;padding:10px">Looking up token on LiFi…</div>`;
    const t = await gwCustomTokenValidate({ chainId, address });
    if (!t) { res.innerHTML = `<div style="color:#f87171;font-size:12.5px;padding:10px">Token not found on that chain — LiFi has no route for it.</div>`; return; }
    // Add to GW_DS_ASSETS + persist
    const custom = gwCustomTokensLoad();
    const already = custom.find((c) => c.sym === t.sym && c.chainId === t.chainId);
    if (!already) {
      custom.push(t);
      gwCustomTokensSave(custom);
      if (!GW_DS_ASSETS.find((a) => a.sym === t.sym)) GW_DS_ASSETS.push({ ...t, custom: true });
    }
    res.innerHTML = `
      <div style="padding:12px;border-radius:12px;background:rgba(34,193,124,.08);border:1px solid rgba(34,193,124,.28)">
        <div style="display:flex;align-items:center;gap:10px">
          ${t.logo ? `<img src="${t.logo}" style="width:32px;height:32px;border-radius:50%"/>` : ''}
          <div>
            <div style="font-weight:800">${t.sym} · ${t.name}</div>
            <div style="font-size:11.5px;color:#98a8c0;font-family:'JetBrains Mono',monospace">${t.address}</div>
          </div>
        </div>
        <div style="color:#22c17c;font-size:12.5px;font-weight:700;margin-top:8px">✓ Added to your picker</div>
      </div>`;
    // Update picker view if open
    try { if (document.getElementById('gw-tk-overlay')?.classList.contains('open')) gwTkRender(document.getElementById('gwTkSearch')?.value || ''); } catch (_) {}
  };
  ov.onclick = (e) => { if (e.target === ov) ov.style.display = 'none'; };
}

function gwTkOpen(which /* 'from' | 'to' */) {
  let ov = document.getElementById('gw-tk-overlay');
  if (!ov) {
    ov = document.createElement('div'); ov.id = 'gw-tk-overlay';
    ov.innerHTML = `
      <div id="gw-tk-panel">
        <div class="head">
          <h4>Choose asset</h4>
          <button class="close" id="gwTkClose" aria-label="Close">×</button>
        </div>
        <div class="search"><input id="gwTkSearch" type="text" placeholder="Search ${GW_DS_ASSETS.length}+ tokens…" autocomplete="off" />
          <button id="gwTkAddCustom" style="margin-top:8px;width:100%;padding:8px 12px;border-radius:10px;border:1px dashed rgba(0,194,255,.35);background:transparent;color:#5dd5ff;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">★ Add custom token by contract address</button>
        </div>
        <div id="gw-tk-list"></div>
      </div>`;
    document.body.appendChild(ov);
    ov.addEventListener('click', (e) => { if (e.target === ov) ov.classList.remove('open'); });
    ov.querySelector('#gwTkClose').onclick = () => ov.classList.remove('open');
  }
  ov.dataset.which = which;
  ov.classList.add('open');
  const search = ov.querySelector('#gwTkSearch');
  search.value = '';
  search.placeholder = `Search ${GW_DS_ASSETS.length}+ tokens…`;
  gwTkRender('');
  setTimeout(() => search.focus(), 40);
  search.oninput = () => gwTkRender(search.value.trim());
  // Kick LiFi token fetch immediately if we haven't yet
  try { gwDsFetchLifiTokens(); } catch (_) {}
  // Item #3 — Add custom token by contract address
  const addBtn = document.getElementById('gwTkAddCustom');
  if (addBtn) addBtn.onclick = () => gwCustomTokenOpenModal();
}
function gwTkRender(q) {
  const list = document.getElementById('gw-tk-list');
  if (!list) return;
  const query = (q || '').toUpperCase();
  const items = GW_DS_ASSETS.filter((a) => !query || a.sym.includes(query) || (a.name || '').toUpperCase().includes(query));
  if (items.length === 0) { list.innerHTML = `<div class="gw-tk-empty">Nothing matches «${q}»</div>`; return; }
  // Progressive rendering: paint first 200 immediately, then append batches
  // of 200 on scroll — supports all 9555+ tokens without DOM freeze.
  const BATCH = 200;
  const rowHtml = (a) => {
    const ico = a.logo
      ? `<img class="ico" src="${a.logo}" alt="${a.sym}" loading="lazy" onerror="this.outerHTML='<span class=&quot;ico&quot;>${a.sym.slice(0,3)}</span>' " />`
      : `<span class="ico">${a.sym.slice(0, 3)}</span>`;
    return `<div class="gw-tk-row" data-sym="${a.sym}">
      ${ico}
      <div class="body"><div class="sym">${a.sym}</div><div class="name">${a.name || a.sym}</div></div>
    </div>`;
  };
  let rendered = Math.min(BATCH, items.length);
  list.innerHTML = items.slice(0, rendered).map(rowHtml).join('') +
    (rendered < items.length ? `<div class="gw-tk-more" id="gw-tk-more" style="text-align:center;padding:10px;color:#6b7a92;font-size:11.5px">Showing ${rendered} of ${items.length}. Scroll for more…</div>` : `<div style="text-align:center;padding:8px;color:#6b7a92;font-size:11.5px">All ${items.length} tokens shown</div>`);
  const overlay = document.getElementById('gw-tk-overlay');
  const which = overlay?.dataset.which;
  const wire = () => {
    list.querySelectorAll('.gw-tk-row').forEach((r) => {
      if (r._wired) return; r._wired = true;
      r.onclick = () => {
        const sel = document.getElementById(which === 'from' ? 'gwDsFrom' : 'gwDsTo');
        if (sel) { sel.value = r.dataset.sym; gwTkSyncButton(which); try { gwDsRefreshRate(); } catch (_) {} }
        overlay.classList.remove('open');
      };
    });
  };
  wire();
  // Scroll handler: append next batch when user nears the bottom.
  list.onscroll = () => {
    if (rendered >= items.length) return;
    if (list.scrollTop + list.clientHeight > list.scrollHeight - 400) {
      const next = Math.min(rendered + BATCH, items.length);
      const chunk = items.slice(rendered, next).map(rowHtml).join('');
      const more = document.getElementById('gw-tk-more');
      if (more) more.insertAdjacentHTML('beforebegin', chunk);
      rendered = next;
      if (more) {
        if (rendered >= items.length) { more.textContent = `All ${items.length} tokens shown`; }
        else { more.textContent = `Showing ${rendered} of ${items.length}. Scroll for more…`; }
      }
      wire();
    }
  };
}
function gwTkSyncButton(which) {
  const sel = document.getElementById(which === 'from' ? 'gwDsFrom' : 'gwDsTo');
  const btn = document.getElementById(which === 'from' ? 'gwDsFromBtn' : 'gwDsToBtn');
  if (!sel || !btn) return;
  const sym = sel.value;
  const asset = GW_DS_ASSETS.find((a) => a.sym === sym) || {};
  const ico = btn.querySelector('.ico');
  if (asset.logo) {
    ico.innerHTML = `<img src="${asset.logo}" alt="${sym}" onerror="this.outerHTML='${sym.slice(0,3)}'" style="width:100%;height:100%;object-fit:cover" />`;
  } else {
    ico.textContent = sym.slice(0, 3);
  }
  btn.querySelector('.lbl').textContent = sym;
  btn.title = `${sym} · ${asset.name || sym}`;
}

/** Parse LiFi quote's includedSteps to build a hop-string. */
function gwDsRouteHopsHtml(winner) {
  try {
    if (winner.aggregator !== 'LiFi') {
      return `<div class="gw-ds-hops"><span class="h">${winner.aggregator}</span><span class="via">optimal single-router path</span></div>`;
    }
    const steps = winner.raw?.includedSteps || [winner.raw];
    if (!steps.length) return '';
    const parts = [];
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i];
      const from = s.action?.fromToken?.symbol || '?';
      const to   = s.action?.toToken?.symbol   || '?';
      const via  = s.toolDetails?.name || s.tool || '';
      if (i === 0) parts.push(`<span class="h">${from}</span>`);
      parts.push(`<span class="arrow">→</span>`);
      parts.push(`<span class="h">${to}</span>`);
      if (via) parts.push(`<span class="via">via ${via}</span>`);
    }
    return `<div class="gw-ds-hops">${parts.join(' ')}</div>`;
  } catch (_) { return ''; }
}

/** Compute % price impact from full-size quote vs implied small-size rate. */
function gwDsPriceImpactHtml(pct) {
  const v = Math.max(0, Math.min(20, Number(pct) || 0));
  const wPct = Math.min(100, (v / 3) * 100); // 3% impact = full bar
  const cls = v >= 2 ? 'gw-ds-pimp bad' : v >= 1 ? 'gw-ds-pimp warn' : 'gw-ds-pimp';
  return `<div class="${cls}">
    <div class="lbl"><span>Price impact</span><span class="val">${v.toFixed(2)}%</span></div>
    <div class="bar"><div class="fill" style="width:${wPct}%"></div></div>
  </div>`;
}

/** Explorer URL for a given chainId + tx hash. */
const GW_DS_EXPLORER = {
  1:     'https://etherscan.io/tx/',
  56:    'https://bscscan.com/tx/',
  42161: 'https://arbiscan.io/tx/',
  137:   'https://polygonscan.com/tx/',
  10:    'https://optimistic.etherscan.io/tx/',
  8453:  'https://basescan.org/tx/',
  43114: 'https://snowtrace.io/tx/',
  59144: 'https://lineascan.build/tx/',
  250:   'https://ftmscan.com/tx/',
};
function gwDsExplorerUrl(chainId, hash) { const base = GW_DS_EXPLORER[chainId]; return base ? base + hash : ''; }

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
        ${recent.map((r) => {
          const explorer = (r.hash && r.chainId) ? gwDsExplorerUrl(r.chainId, r.hash) : '';
          const modeIco  = r.mode === 'onchain' ? '🔗' : '⚡';
          const linkHtml = explorer ? ` · <a href="${explorer}" target="_blank" rel="noopener" style="color:#5dd5ff;text-decoration:none">tx ↗</a>` : '';
          return `<div class="gw-ds-recent-row">
            <span class="r-pair">${r.amt} ${r.from} → ${r.out} ${r.to}</span>
            <span class="r-time">${gwDsTimeAgo(r.ts)} · ${modeIco}${linkHtml}</span>
          </div>`;
        }).join('')}
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
      ${gwDsChainChipsHtml(null)}
      <div class="gw-ds-form">
        <div class="gw-ds-row">
          <div class="gw-ds-row-top">
            <span>${t.from}</span>
            <span class="gw-ds-row-bal" id="gwDsBalFrom"></span>
          </div>
          <div class="gw-ds-row-main">
            <div class="gw-ds-select">
              <select id="gwDsFrom" style="display:none">${optionsFor(mode === 'onchain' ? 'ETH' : 'USDT')}</select>
              <button type="button" class="gw-ds-tkbtn" id="gwDsFromBtn">
                <span class="ico">USD</span><span class="lbl">USDT</span><span class="caret">▾</span>
              </button>
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
              <select id="gwDsTo" style="display:none">${optionsFor('BTC')}</select>
              <button type="button" class="gw-ds-tkbtn" id="gwDsToBtn">
                <span class="ico">BTC</span><span class="lbl">BTC</span><span class="caret">▾</span>
              </button>
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
    const addr = gwOcConnectedAddress();
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

/** On-chain mode: pick ETH/BNB/etc. the user actually holds instead of default USDT. */
async function gwDsAutoPickFromToken() {
  if (gwDsGetMode() !== 'onchain') return;
  if (!gwOcConnectedAddress()) return;
  const candidates = ['ETH', 'BNB', 'USDT', 'USDC', 'MATIC', 'ARB'];
  let bestSym = null;
  let bestBal = 0;
  for (const sym of candidates) {
    const bal = await gwDsAvailableAmount(sym);
    if (bal > bestBal) { bestBal = bal; bestSym = sym; }
  }
  if (!bestSym || bestBal <= 0) return;
  const fromEl = document.getElementById('gwDsFrom');
  if (!fromEl) return;
  if (fromEl.value === bestSym) return;
  fromEl.value = bestSym;
  gwDsRefreshBalances().catch(() => {});
  gwDsRefreshRate();
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

  // === ON-CHAIN mode: meta-aggregator (LiFi + Paraswap + KyberSwap + Odos) ===
  if (mode === 'onchain') {
    try {
      const [account] = (window.gromWallet?.state?.().accounts || [window.gromWallet?.state?.().account]).filter(Boolean);
      const provider = (window.gromWallet?.wcProvider && window.gromWallet.wcProvider.accounts?.[0])
        ? window.gromWallet.wcProvider
        : window.ethereum;
      if (account && provider) {
        const chainId = parseInt(await provider.request({ method: 'eth_chainId' }), 16);
        const quotes = await gwMetaAggQuoteAll({ chainId, fromSym: from, toSym: to, amtNum: amt, account });
        if (quotes.length > 0) {
          // Cache for gwOnChainSwapExec so it doesn't refetch.
          window.__gwLastAggQuotes = { chainId, fromSym: from, toSym: to, amtNum: amt, quotes, at: Date.now() };
          const winner = quotes[0];
          const outDec = GW_OC_SWAP[chainId]?.decimals?.[to] ?? 18;
          const winnerOut = Number(winner.toAmount) / 10 ** outDec;
          outEl.value = Number(winnerOut.toFixed(8));
          const rate = amt > 0 ? (winnerOut / amt).toFixed(8).replace(/0+$/, '').replace(/\.$/, '') : '';
          const gasUsd = Number(winner.gasUsd || 0).toFixed(2);
          // Compact comparison strip — winner first, then losers sorted.
          const cmp = quotes.slice(0, 4).map((q, i) => {
            const out = Number(q.toAmount) / 10 ** outDec;
            const diffPct = i === 0 ? '' : ` <span class="diff">−${((1 - Number(q.toAmount) * 1n / winner.toAmount) * 100 || 0).toFixed(2)}%</span>`;
            void diffPct; // reserved for a future badge; safer bigint math below
            const winMark = i === 0 ? '✓ ' : '';
            const outFmt = out.toLocaleString('en-US', { maximumFractionDigits: Math.min(outDec, 6) });
            return `<span class="agg${i === 0 ? ' win' : ''}">${winMark}${q.aggregator} ${outFmt}</span>`;
          }).join(' · ');
          // Phase 3: AI split-recommend — fires asynchronously.
          // Phase 7 v2: also compute a rough price-impact from
          // (best rate at small size) vs (rate at requested size),
          // and render hop-visualisation from LiFi's includedSteps.
          const aiTipHtml = '<span class="k full" id="gwDsAiTipSlot"></span>';
          const hopsHtml  = gwDsRouteHopsHtml(winner);
          routeEl.innerHTML = `
            <span class="k">${t.route}</span><span class="v">${winner.aggregator} · ${winner.tool || 'best'}</span>
            <span class="k">${t.fee}</span><span class="v">${(GW_LIFI_FEE_PCT * 100).toFixed(2)}%</span>
            <span class="k">${t.slip}</span><span class="v">0.5%</span>
            <span class="k">Gas</span><span class="v">≈ $${gasUsd}</span>
            <span class="k full">1 ${from} ≈ ${rate} ${to}</span>
            <span class="k full agg-cmp">${cmp}</span>
            <span class="k full" id="gwDsPimpSlot"></span>
            <span class="k full">${hopsHtml}</span>
            ${aiTipHtml}
          `;
          // Compute price impact by re-quoting the same pair at 1/10 size.
          gwAggQuoteLifi({ chainId, fromSym: from, toSym: to, amtNum: amt / 10, account })
            .then((smallQ) => {
              if (!smallQ?.toAmount) return;
              const smallRate = Number(smallQ.toAmount) * 10 / 10 ** outDec / amt;
              const bigRate   = winnerOut / amt;
              const impactPct = Math.max(0, ((smallRate - bigRate) / smallRate) * 100);
              const slot = document.getElementById('gwDsPimpSlot');
              if (slot) slot.outerHTML = gwDsPriceImpactHtml(impactPct);
            })
            .catch(() => {});
          if (outUsd) gwDsPriceUsd(to).then((p) => { outUsd.textContent = p ? '≈ $' + (winnerOut * p).toLocaleString('en-US', { maximumFractionDigits: 2 }) : ''; });
          // Fire the AI split-tip in the background; don't hold up the return.
          gwAiSplitTip({ chainId, fromSym: from, toSym: to, amtNum: amt, account, winnerQuote: winner })
            .then((tip) => {
              const slot = document.getElementById('gwDsAiTipSlot');
              if (slot && tip) { slot.outerHTML = gwAiTipBanner(tip, { fromSym: from, toSym: to, amtNum: amt }); setTimeout(gwWireAiTipButton, 0); }
            })
            .catch(() => {});
          return;
        }
      }
    } catch (e) {
      console.warn('[GROM] meta-agg quote (UI) failed, falling back to cross-rate:', e?.message || e);
    }
  }

  try {
    if (gwDsQuoteAbort) gwDsQuoteAbort.abort();
    gwDsQuoteAbort = new AbortController();
    // Paper mode uses the backend quote endpoint (live Binance ticker).
    // On-chain mode reaches this fallback only if LiFi didn't respond
    // (no wallet, unsupported pair, network) — the cross-rate estimate
    // is close enough to display while user reconnects or switches chain.
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
      <span class="k">${t.route}</span><span class="v">${mode === 'paper' ? 'GROM Convert' : 'LiFi meta-aggregator'}</span>
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
  59144: { // Linea · Lynex (Solidly-style; V2-ish for basic pairs)
    router: '0x610D2f07b7EdC67565160F587F37636194C34E74',
    native: 'ETH',
    wrapped: '0xe5D7C2a44FfDDf6b295A15c148167daaAf5Cf34f',
    dexName: 'Lynex',
    tokens: {
      USDC: '0x176211869cA2b568f2A7D4EE941E073a821EE1ff',
      USDT: '0xA219439258ca9da29E9Cc4cE5596924745e12B93',
      WETH: '0xe5D7C2a44FfDDf6b295A15c148167daaAf5Cf34f',
    },
    decimals: { ETH: 18, USDC: 6, USDT: 6, WETH: 18 },
  },
  250: { // Fantom · SpookySwap V2
    router: '0xF491e7B69E4244ad4002BC14e878a34207E38c29',
    native: 'FTM',
    wrapped: '0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83',
    dexName: 'SpookySwap',
    tokens: {
      USDC: '0x28a92dde19D9989F39A49905d7C9C2FAc7799bDf',
      USDT: '0x049d68029688eAbF473097a2fC38ef61633A3C7A',
      WETH: '0x74b23882a30290451A17c44f4F05243b6b58C76d',
    },
    decimals: { FTM: 18, USDC: 6, USDT: 6, WETH: 18 },
  },
};

/* Note: Solana (`chainId 1151111081099710` in LiFi) is not in
 * GW_OC_SWAP because we don't have an inline V2-router fallback for it
 * (it isn't EVM). LiFi handles the swap end-to-end for Solana; when the
 * user connects a Phantom wallet we route them straight to LiFi's tx
 * signer. Bitcoin also goes fully through LiFi (via THORchain) — no
 * inline path possible. Tron and TON are NOT supported by LiFi as of
 * 2026-07; those need dedicated SDKs (TronWeb + SunSwap for TRX, and
 * TonConnect + StonFi for TON) — tracked separately. */

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

/* =========================================================================
 * LiFi meta-aggregator swap execution (2026-07-07).
 *
 * WHY LIFI vs. our inline Uniswap/Pancake V2 routers:
 *   • LiFi already routes across 20+ chains and 15+ DEXes (Uniswap,
 *     Sushi, Pancake, Curve, Balancer, Velodrome, Aerodrome, TraderJoe,
 *     THORchain, …) and picks the best split automatically.
 *   • Cross-chain out of the box (BTC-EVM via THORchain, EVM-EVM via
 *     Stargate / Across / Symbiosis).
 *   • Integrator fee model — LiFi collects our 0.20 % on top of every
 *     swap and remits it to our address at li.quest/v1/status.
 *   • Non-custodial — user's own wallet signs the tx.
 *   • Public REST API — no SDK bundle, no auth key required for quotes.
 *
 * Fall-back path:
 *   If the LiFi REST call fails (network, quota, or an odd pair) we
 *   drop back to gwOnChainSwapExecInline — the existing hand-coded
 *   V2 router flow. So the switch never regresses on the pairs the
 *   inline router already supports (Pancake BSC, Uni ETH, etc.).
 *
 * FEES:
 *   GROM_LIFI_INTEGRATOR   = 'grom-exchange'  (string, for their analytics)
 *   GROM_LIFI_FEE_PCT      = 0.002            (0.20 % of input value)
 *   GROM_LIFI_FEE_ADDRESS  = <TREASURY_ADDR>  (where LiFi sends our fee)
 *
 * Public docs: https://docs.li.fi/products/lifi-api
 * ========================================================================= */
const GW_LIFI_ENDPOINT   = 'https://li.quest/v1';
const GW_LIFI_INTEGRATOR = 'grom-exchange';
const GW_LIFI_FEE_PCT    = 0.002; // 0.20 % — ours
// GROM Treasury (Trust Wallet, dedicated account created 2026-07-07 by
// the owner). Same 0x address works on every EVM chain LiFi supports;
// fee arrives in whichever native / ERC-20 the swap was denominated in.
// When we outgrow a single-sig hot wallet we swap this for a Gnosis
// Safe multisig — LiFi accepts any EOA or contract address as fee sink.
const GW_LIFI_FEE_ADDR   = '0xCFeF272536D6E91A4945063d40ac7CbA7Eb657B5';

/**
 * Ask LiFi for a quote for a single-chain swap. Returns
 *   { toAmount, toAmountMin, gasCost, feeCost, tool, transactionRequest }
 * or null if LiFi has no route for this pair on this chain.
 *
 * fromSym / toSym are our internal symbols; we look up the real token
 * address from GW_OC_SWAP[chainId] just like the inline path does.
 */
async function gwLifiQuote({ chainId, fromSym, toSym, amtNum, account }) {
  const cfg = GW_OC_SWAP[chainId];
  if (!cfg) return null;
  const inAddr  = fromSym === cfg.native ? cfg.wrapped : cfg.tokens[fromSym];
  const outAddr = toSym   === cfg.native ? cfg.wrapped : cfg.tokens[toSym];
  if (!inAddr || !outAddr) return null;
  const inDec = cfg.decimals[fromSym] ?? 18;
  const fromAmount = BigInt(Math.floor(amtNum * 10 ** inDec)).toString();
  const qs = new URLSearchParams({
    fromChain:    String(chainId),
    toChain:      String(chainId),
    fromToken:    inAddr,
    toToken:      outAddr,
    fromAmount,
    fromAddress:  account,
    slippage:     '0.005',      // 0.5 %
    integrator:   GW_LIFI_INTEGRATOR,
    // We include fee only if the treasury address is set to something
    // non-zero — LiFi rejects fee > 0 when feeAddress is 0x0.
    ...(GW_LIFI_FEE_ADDR !== '0x0000000000000000000000000000000000000000'
      ? { fee: String(GW_LIFI_FEE_PCT), feeAddress: GW_LIFI_FEE_ADDR }
      : {}),
    order:        'RECOMMENDED',
  });
  const url = `${GW_LIFI_ENDPOINT}/quote?${qs}`;
  const r = await fetch(url, { headers: { accept: 'application/json' } });
  if (!r.ok) {
    console.warn('[GROM] lifi quote failed', r.status, await r.text().catch(() => ''));
    return null;
  }
  return await r.json();
}

/**
 * Execute a LiFi-routed swap. Handles ERC-20 approval, then sends the
 * tx returned by LiFi's transactionRequest. User signs in their wallet.
 * Returns the hash. Throws so caller can fall back to inline.
 */
async function gwOnChainSwapExecLifi({ chainId, fromSym, toSym, amtNum, quote, provider, account }) {
  const cfg = GW_OC_SWAP[chainId];
  const inAddr  = fromSym === cfg.native ? cfg.wrapped : cfg.tokens[fromSym];
  const inDec   = cfg.decimals[fromSym] ?? 18;
  const amountIn = BigInt(Math.floor(amtNum * 10 ** inDec));
  const tx = quote.transactionRequest || {};
  if (!tx.to || !tx.data) throw new Error('LiFi returned no transactionRequest');
  const dexLabel = quote.tool || quote.toolDetails?.name || 'LiFi';
  // If from is an ERC-20 (not native), approve LiFi's router first.
  if (fromSym !== cfg.native) {
    const spender = quote.estimate?.approvalAddress || tx.to;
    const allow = await gwErc20Allowance(provider, inAddr, account, spender);
    if (allow < amountIn) {
      gwToast('Approve token to LiFi router…', 'info');
      await gwErc20ApproveMax(provider, inAddr, spender, account);
    }
  }
  const outDec = cfg.decimals[toSym] ?? 18;
  const expected = quote.estimate?.toAmount || quote.toAmount || '0';
  gwToast(`Confirm in wallet · ${dexLabel} · expecting ~${(Number(expected) / 10 ** outDec).toFixed(6)} ${toSym}`, 'info');
  const params = [{
    from:  account,
    to:    tx.to,
    data:  tx.data,
    value: tx.value || '0x0',
    ...(tx.gasLimit ? { gas: tx.gasLimit } : {}),
    ...(tx.gasPrice ? { gasPrice: tx.gasPrice } : {}),
  }];
  const hash = await provider.request({ method: 'eth_sendTransaction', params });
  gwToast('Submitted · waiting for confirmation…', 'info');
  await gwWaitReceipt(provider, hash);
  return hash;
}

/* =========================================================================
 * PHASE 2 — Meta-aggregator (2026-07-07)
 *
 * Ask 4 keyless public aggregators for a quote IN PARALLEL, pick the
 * one that gives the user the most `toAmount` (net of gas). The user
 * sees a compact comparison strip; execution uses the winner's
 * transactionRequest.
 *
 * Chain-name maps for the ones that use slugs rather than numeric IDs.
 * KyberSwap URL uses these slugs.
 * ========================================================================= */
const GW_META_KS_CHAIN = { 1: 'ethereum', 56: 'bsc', 137: 'polygon', 42161: 'arbitrum', 10: 'optimism', 8453: 'base', 43114: 'avalanche' };
const GW_META_PS_CHAIN = { 1: 1, 56: 56, 137: 137, 42161: 42161, 10: 10, 8453: 8453, 43114: 43114 };
// Placeholder token address that most aggregators use for NATIVE (ETH/BNB/etc).
const GW_META_NATIVE = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

function _metaResolveAddrs(cfg, fromSym, toSym) {
  const inAddr  = fromSym === cfg.native ? GW_META_NATIVE : cfg.tokens[fromSym];
  const outAddr = toSym   === cfg.native ? GW_META_NATIVE : cfg.tokens[toSym];
  return { inAddr, outAddr };
}

/** Adapter: LiFi. Reuses gwLifiQuote; returns normalized shape. */
async function gwAggQuoteLifi({ chainId, fromSym, toSym, amtNum, account }) {
  const q = await gwLifiQuote({ chainId, fromSym, toSym, amtNum, account });
  if (!q?.estimate?.toAmount || !q.transactionRequest) return null;
  return {
    aggregator: 'LiFi',
    tool: q.tool || q.toolDetails?.name || '',
    toAmount: BigInt(q.estimate.toAmount),
    gasUsd: Number(q.estimate.gasCosts?.[0]?.amountUSD || 0),
    approvalAddress: q.estimate.approvalAddress || q.transactionRequest.to,
    transactionRequest: q.transactionRequest,
    raw: q,
  };
}

/** Adapter: Paraswap v5. Requires 2-step (prices → build tx). */
async function gwAggQuoteParaswap({ chainId, fromSym, toSym, amtNum, account }) {
  const psNet = GW_META_PS_CHAIN[chainId];
  if (!psNet) return null;
  const cfg = GW_OC_SWAP[chainId];
  if (!cfg) return null;
  const { inAddr, outAddr } = _metaResolveAddrs(cfg, fromSym, toSym);
  if (!inAddr || !outAddr) return null;
  const inDec  = cfg.decimals[fromSym] ?? 18;
  const outDec = cfg.decimals[toSym]   ?? 18;
  const amount = BigInt(Math.floor(amtNum * 10 ** inDec)).toString();
  try {
    const priceQs = new URLSearchParams({
      srcToken: inAddr, srcDecimals: String(inDec),
      destToken: outAddr, destDecimals: String(outDec),
      amount, side: 'SELL', network: String(psNet), userAddress: account,
    });
    const p = await fetch(`https://apiv5.paraswap.io/prices?${priceQs}`, { headers: { accept: 'application/json' } });
    if (!p.ok) return null;
    const pj = await p.json();
    const priceRoute = pj?.priceRoute;
    if (!priceRoute?.destAmount) return null;
    // We ONLY fetch the tx if this aggregator ends up winning — see gwAggBuildTxIfNeeded.
    return {
      aggregator: 'Paraswap',
      tool: priceRoute.bestRoute?.[0]?.swaps?.[0]?.swapExchanges?.[0]?.exchange || 'paraswap',
      toAmount: BigInt(priceRoute.destAmount),
      gasUsd: Number(priceRoute.gasCostUSD || 0),
      approvalAddress: priceRoute.tokenTransferProxy,
      transactionRequest: null, // built lazily
      _psPriceRoute: priceRoute,
      _psUserAddr: account,
      raw: pj,
    };
  } catch (_) { return null; }
}

/** Adapter: KyberSwap Aggregator. Two-step (routes → build). */
async function gwAggQuoteKyber({ chainId, fromSym, toSym, amtNum, account }) {
  const slug = GW_META_KS_CHAIN[chainId];
  if (!slug) return null;
  const cfg = GW_OC_SWAP[chainId];
  if (!cfg) return null;
  const { inAddr, outAddr } = _metaResolveAddrs(cfg, fromSym, toSym);
  if (!inAddr || !outAddr) return null;
  const inDec = cfg.decimals[fromSym] ?? 18;
  const amountIn = BigInt(Math.floor(amtNum * 10 ** inDec)).toString();
  try {
    const rQs = new URLSearchParams({ tokenIn: inAddr, tokenOut: outAddr, amountIn, saveGas: '0', gasInclude: '1' });
    const r = await fetch(`https://aggregator-api.kyberswap.com/${slug}/api/v1/routes?${rQs}`, { headers: { accept: 'application/json' } });
    if (!r.ok) return null;
    const rj = await r.json();
    const data = rj?.data;
    const summary = data?.routeSummary;
    if (!summary?.amountOut) return null;
    return {
      aggregator: 'KyberSwap',
      tool: summary.route?.[0]?.[0]?.exchange || 'kyberswap',
      toAmount: BigInt(summary.amountOut),
      gasUsd: Number(summary.gasUsd || 0),
      approvalAddress: data.routerAddress,
      transactionRequest: null, // built lazily via /route/build
      _ksSummary: summary,
      _ksRouter: data.routerAddress,
      _ksSlug: slug,
      _ksAcc: account,
      raw: rj,
    };
  } catch (_) { return null; }
}

/** Adapter: Odos v2 — single-step quote+assemble. */
async function gwAggQuoteOdos({ chainId, fromSym, toSym, amtNum, account }) {
  const cfg = GW_OC_SWAP[chainId];
  if (!cfg) return null;
  const { inAddr, outAddr } = _metaResolveAddrs(cfg, fromSym, toSym);
  if (!inAddr || !outAddr) return null;
  const inDec = cfg.decimals[fromSym] ?? 18;
  const amount = BigInt(Math.floor(amtNum * 10 ** inDec)).toString();
  try {
    const r = await fetch('https://api.odos.xyz/sor/quote/v2', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        chainId,
        inputTokens:  [{ tokenAddress: inAddr === GW_META_NATIVE ? '0x0000000000000000000000000000000000000000' : inAddr, amount }],
        outputTokens: [{ tokenAddress: outAddr === GW_META_NATIVE ? '0x0000000000000000000000000000000000000000' : outAddr, proportion: 1 }],
        userAddr:     account,
        slippageLimitPercent: 0.5,
        referralCode: 0,
        disableRFQs:  false,
      }),
    });
    if (!r.ok) return null;
    const rj = await r.json();
    const outAmt = rj?.outAmounts?.[0];
    const pathId = rj?.pathId;
    if (!outAmt || !pathId) return null;
    return {
      aggregator: 'Odos',
      tool: 'odos',
      toAmount: BigInt(outAmt),
      gasUsd: Number(rj?.gasEstimateValue || 0),
      approvalAddress: null,          // Odos returns router in assemble step
      transactionRequest: null,        // built lazily
      _odosPathId: pathId,
      _odosAcc: account,
      raw: rj,
    };
  } catch (_) { return null; }
}

/**
 * Fetch quotes from every aggregator in parallel. Returns a list
 * sorted best-to-worst by toAmount (winner first). Rejections are
 * dropped silently — one aggregator failing doesn't kill the swap.
 */
/* Item #5 — CowSwap MEV-protected quote (Ethereum + Arbitrum + Base only). */
async function gwAggQuoteCow({ chainId, fromSym, toSym, amtNum, account }) {
  const NET = { 1: 'mainnet', 100: 'xdai', 42161: 'arbitrum_one', 8453: 'base' };
  const net = NET[chainId];
  if (!net) return null;
  const cfg = GW_OC_SWAP[chainId]; if (!cfg) return null;
  const { inAddr, outAddr } = _metaResolveAddrs(cfg, fromSym, toSym);
  if (!inAddr || !outAddr) return null;
  const inDec = cfg.decimals[fromSym] ?? 18;
  const sellAmount = BigInt(Math.floor(amtNum * 10 ** inDec)).toString();
  try {
    const r = await fetch(`https://api.cow.fi/${net}/api/v1/quote`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sellToken: inAddr === GW_META_NATIVE ? cfg.wrapped : inAddr,
        buyToken:  outAddr === GW_META_NATIVE ? cfg.wrapped : outAddr,
        from: account, receiver: account,
        sellAmountBeforeFee: sellAmount,
        kind: 'sell', partiallyFillable: false, signingScheme: 'eip712',
        onchainOrder: false,
      }),
    });
    if (!r.ok) return null;
    const j = await r.json();
    const buyAmount = j?.quote?.buyAmount; if (!buyAmount) return null;
    return { aggregator: 'CoWSwap (MEV-safe)', tool: 'cowswap', toAmount: BigInt(buyAmount), gasUsd: 0, approvalAddress: null, transactionRequest: null, _cowQuote: j, raw: j };
  } catch (_) { return null; }
}

/* Item #6 — Squid Router cross-chain (Axelar). Same-chain also works. */
async function gwAggQuoteSquid({ chainId, fromSym, toSym, amtNum, account }) {
  const cfg = GW_OC_SWAP[chainId]; if (!cfg) return null;
  const { inAddr, outAddr } = _metaResolveAddrs(cfg, fromSym, toSym);
  if (!inAddr || !outAddr) return null;
  const inDec = cfg.decimals[fromSym] ?? 18;
  const amount = BigInt(Math.floor(amtNum * 10 ** inDec)).toString();
  try {
    const r = await fetch('https://apiplus.squidrouter.com/v2/route', {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-integrator-id': 'grom-exchange' },
      body: JSON.stringify({
        fromChain: String(chainId), toChain: String(chainId),
        fromToken: inAddr === GW_META_NATIVE ? '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' : inAddr,
        toToken:   outAddr === GW_META_NATIVE ? '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' : outAddr,
        fromAmount: amount, fromAddress: account, toAddress: account,
        slippage: 0.5, enableForecall: true, quoteOnly: false,
      }),
    });
    if (!r.ok) return null;
    const j = await r.json();
    const est = j?.route?.estimate; if (!est?.toAmount) return null;
    const tx = j?.route?.transactionRequest;
    return { aggregator: 'Squid (Axelar)', tool: 'squid', toAmount: BigInt(est.toAmount), gasUsd: Number(est.gasCosts?.[0]?.amountUsd || 0), approvalAddress: tx?.target, transactionRequest: tx ? { to: tx.target, data: tx.data, value: tx.value || '0x0', gasLimit: tx.gasLimit } : null, raw: j };
  } catch (_) { return null; }
}

async function gwMetaAggQuoteAll({ chainId, fromSym, toSym, amtNum, account }) {
  const jobs = [
    gwAggQuoteLifi({ chainId, fromSym, toSym, amtNum, account }),
    gwAggQuoteParaswap({ chainId, fromSym, toSym, amtNum, account }),
    gwAggQuoteKyber({ chainId, fromSym, toSym, amtNum, account }),
    gwAggQuoteOdos({ chainId, fromSym, toSym, amtNum, account }),
    gwAggQuoteCow({ chainId, fromSym, toSym, amtNum, account }),
    gwAggQuoteSquid({ chainId, fromSym, toSym, amtNum, account }),
  ];
  const settled = await Promise.allSettled(jobs);
  const quotes = settled.filter((r) => r.status === 'fulfilled' && r.value).map((r) => r.value);
  // Rank by net toAmount (subtracting a rough gas-in-toAmount penalty).
  // For MVP we just sort by toAmount; gas cost is small vs. 50-200 bps
  // aggregator spread. Refine later once we track USD price per token.
  quotes.sort((a, b) => (b.toAmount > a.toAmount ? 1 : b.toAmount < a.toAmount ? -1 : 0));
  return quotes;
}

/**
 * Lazy tx builders — only called for the winning aggregator so we
 * don't waste RPCs. Returns { transactionRequest, approvalAddress }.
 */
async function gwAggBuildTxIfNeeded(q, { chainId, account }) {
  if (q.transactionRequest) return q;
  if (q.aggregator === 'Paraswap') {
    const body = {
      srcToken:  q._psPriceRoute.srcToken,
      destToken: q._psPriceRoute.destToken,
      srcDecimals: q._psPriceRoute.srcDecimals,
      destDecimals: q._psPriceRoute.destDecimals,
      srcAmount: q._psPriceRoute.srcAmount,
      slippage: 50,
      userAddress: q._psUserAddr,
      priceRoute: q._psPriceRoute,
    };
    const r = await fetch(`https://apiv5.paraswap.io/transactions/${GW_META_PS_CHAIN[chainId]}?ignoreChecks=true`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`Paraswap build ${r.status}`);
    const tx = await r.json();
    q.transactionRequest = { to: tx.to, data: tx.data, value: tx.value, gasLimit: tx.gas };
    return q;
  }
  if (q.aggregator === 'KyberSwap') {
    const r = await fetch(`https://aggregator-api.kyberswap.com/${q._ksSlug}/api/v1/route/build`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ routeSummary: q._ksSummary, sender: q._ksAcc, recipient: q._ksAcc, slippageTolerance: 50 }),
    });
    if (!r.ok) throw new Error(`KyberSwap build ${r.status}`);
    const j = await r.json();
    const d = j?.data;
    if (!d?.data) throw new Error('KyberSwap build empty');
    q.transactionRequest = { to: q._ksRouter, data: d.data, value: d.transactionValue || '0x0', gasLimit: d.gas };
    q.approvalAddress = q._ksRouter;
    return q;
  }
  if (q.aggregator === 'Odos') {
    const r = await fetch('https://api.odos.xyz/sor/assemble', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ userAddr: q._odosAcc, pathId: q._odosPathId, simulate: false }),
    });
    if (!r.ok) throw new Error(`Odos assemble ${r.status}`);
    const j = await r.json();
    const tx = j?.transaction;
    if (!tx?.to || !tx?.data) throw new Error('Odos assemble empty');
    q.transactionRequest = { to: tx.to, data: tx.data, value: tx.value || '0x0', gasLimit: tx.gas };
    q.approvalAddress = tx.to;
    return q;
  }
  return q; // LiFi already has transactionRequest
}

/**
 * Execute a meta-aggregator winner.  Handles ERC-20 approve and forwards
 * the tx to the user's wallet.
 */
async function gwOnChainSwapExecMeta({ chainId, fromSym, toSym, amtNum, quote, provider, account }) {
  const cfg = GW_OC_SWAP[chainId];
  const inAddr = fromSym === cfg.native ? cfg.wrapped : cfg.tokens[fromSym];
  const inDec = cfg.decimals[fromSym] ?? 18;
  const amountIn = BigInt(Math.floor(amtNum * 10 ** inDec));
  await gwAggBuildTxIfNeeded(quote, { chainId, account });
  const tx = quote.transactionRequest;
  if (!tx?.to || !tx?.data) throw new Error(`${quote.aggregator}: no tx`);
  // Approve if needed
  if (fromSym !== cfg.native) {
    const spender = quote.approvalAddress || tx.to;
    const allow = await gwErc20Allowance(provider, inAddr, account, spender);
    if (allow < amountIn) {
      gwToast(`Approve ${fromSym} to ${quote.aggregator} router…`, 'info');
      await gwErc20ApproveMax(provider, inAddr, spender, account);
    }
  }
  const outDec = cfg.decimals[toSym] ?? 18;
  const expected = Number(quote.toAmount) / 10 ** outDec;
  gwToast(`Confirm in wallet · ${quote.aggregator} · expecting ~${expected.toFixed(6)} ${toSym}`, 'info');
  const hash = await provider.request({ method: 'eth_sendTransaction', params: [{
    from: account,
    to:   tx.to,
    data: tx.data,
    value: tx.value || '0x0',
    ...(tx.gasLimit ? { gas: tx.gasLimit } : {}),
  }] });
  gwToast('Submitted · waiting for confirmation…', 'info');
  await gwWaitReceipt(provider, hash);
  return hash;
}

/* =========================================================================
 * PHASE 4 + 5 — Advanced Orders (Limit + DCA), client-side v1
 *
 * A compact card lives under the swap panel with two tabs:
 *   • Limit    — set a target price. When Binance ticker hits it, we
 *                toast + prefill the swap panel; user presses Swap
 *                once to execute via meta-agg.
 *   • DCA      — recurring intent (daily / weekly). Same UX at each
 *                interval — toast + prefill; user signs one tx per
 *                tranche. Full smart-contract DCA (Sablier / 1inch
 *                LOP) is v2.
 *
 * All state in localStorage.gw_orders_v1. A single 60-second interval
 * polls Binance ticker for limit orders and evaluates DCA due times.
 * ========================================================================= */
function gwOrdLoad() { try { return JSON.parse(localStorage.getItem('gw_orders_v1') || '[]'); } catch (_) { return []; } }
function gwOrdSave(v) { try { localStorage.setItem('gw_orders_v1', JSON.stringify(v)); } catch (_) {} }
function gwOrdDelete(id) { gwOrdSave(gwOrdLoad().filter((o) => o.id !== id)); gwRenderAdvancedPanel(); }

function gwInjectAdvancedCss() {
  if (document.getElementById('gw-adv-css')) return;
  const css = `
    .gw-adv-wrap { margin: 12px 0 4px; max-width: 100%; box-sizing: border-box; }
    .gw-adv-card {
      padding: 18px; border-radius: 20px; color: #e7eef8; max-width: 100%; box-sizing: border-box; overflow: hidden;
      background: radial-gradient(120% 140% at 100% 0%, rgba(0,194,255,0.08), transparent 55%),
                  linear-gradient(160deg, rgba(13,22,38,0.72), rgba(8,14,26,0.92));
      border: 1px solid rgba(0,194,255,0.18);
    }
    .gw-adv-tabs { display: flex; gap: 6px; margin-bottom: 12px; flex-wrap: wrap; }
    .gw-adv-tab { flex: 0 0 auto; padding: 7px 12px; border-radius: 8px; background: rgba(255,255,255,0.04); color: #98a8c0; border: 1px solid rgba(255,255,255,0.06); font-size: 12px; font-weight: 700; cursor: pointer; white-space: nowrap; }
    .gw-adv-tab.on { background: rgba(0,194,255,0.14); color: #5dd5ff; border-color: rgba(0,194,255,0.28); }
    .gw-adv-form { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)) auto; gap: 8px; margin-bottom: 10px; width: 100%; min-width: 0; }
    @media (max-width: 640px) {
      .gw-adv-wrap { padding: 0 4px; }
      .gw-adv-card { padding: 16px 14px; border-radius: 18px; }
      .gw-adv-tabs { gap: 8px; }
      .gw-adv-tab { flex: 1 1 45%; text-align: center; padding: 10px 12px; font-size: 13px; }
      .gw-adv-form { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 10px; }
      .gw-adv-form select#gdInt { grid-column: 1 / -1; }
      .gw-adv-form button { grid-column: 1 / -1; padding: 13px 14px; font-size: 15px; width: 100%; max-width: 100%; box-sizing: border-box; }
      .gw-adv-form input, .gw-adv-form select { font-size: 16px; padding: 12px 12px; min-height: 44px; box-sizing: border-box; width: 100%; max-width: 100%; min-width: 0; }
      .gw-adv-row { grid-template-columns: minmax(0, 1fr) auto !important; padding: 12px; }
      .gw-adv-row .state:not(:first-of-type) { grid-column: 1 / -1; }
      .gw-adv-row .desc { font-size: 13px; word-break: break-word; }
    }
    .gw-adv-form input, .gw-adv-form select {
      background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px;
      padding: 9px 10px; color: #e7eef8; font-size: 13px; font-family: inherit; font-variant-numeric: tabular-nums;
    }
    .gw-adv-form input:focus, .gw-adv-form select:focus { border-color: rgba(0,194,255,0.35); outline: none; }
    .gw-adv-form button {
      padding: 9px 14px; border-radius: 10px; background: linear-gradient(135deg, #00c2ff, #6e8dff);
      color: #041624; border: 0; font-weight: 800; font-size: 12.5px; cursor: pointer;
    }
    .gw-adv-list { display: flex; flex-direction: column; gap: 6px; margin-top: 6px; }
    .gw-adv-row { display: grid; grid-template-columns: 1fr auto auto; gap: 10px; align-items: center; padding: 9px 12px; border-radius: 10px; background: rgba(255,255,255,0.025); border: 1px solid rgba(255,255,255,0.05); font-size: 12.5px; }
    .gw-adv-row .desc { color: #cfdfee; }
    .gw-adv-row .state { color: #98a8c0; font-size: 11px; }
    .gw-adv-row .kill { background: transparent; color: #f87171; border: 0; cursor: pointer; font-size: 15px; }
    .gw-adv-empty { color: #6b7a92; font-size: 12px; text-align: center; padding: 12px 0; }
  `;
  const s = document.createElement('style'); s.id = 'gw-adv-css'; s.textContent = css; document.head.appendChild(s);
}

const GW_ADV_ASSETS = ['USDT','USDC','BTC','ETH','BNB','SOL','XRP','MATIC','ARB','OP','AVAX','LINK','DOGE'];
function gwAdvOpt(v, sel) { return `<option value="${v}"${sel === v ? ' selected' : ''}>${v}</option>`; }

function gwRenderAdvancedPanel() {
  const page = document.getElementById('page-dashboard');
  if (!page) return;
  gwInjectAdvancedCss();
  let wrap = document.getElementById('gwAdvPanel');
  if (!wrap) {
    wrap = document.createElement('div'); wrap.id = 'gwAdvPanel'; wrap.className = 'gw-adv-wrap';
    const swap = page.querySelector('.gw-ds-wrap');
    if (swap && swap.parentNode === page) swap.after(wrap); else page.appendChild(wrap);
  }
  const tab  = wrap.dataset.tab || 'limit';
  const orders = gwOrdLoad();
  const limits = orders.filter((o) => o.type === 'limit');
  const dcas   = orders.filter((o) => o.type === 'dca');
  wrap.innerHTML = `
    <div class="gw-adv-card">
      <div class="gw-adv-tabs">
        <button class="gw-adv-tab ${tab === 'limit' ? 'on' : ''}" data-t="limit">Limit orders</button>
        <button class="gw-adv-tab ${tab === 'dca'   ? 'on' : ''}" data-t="dca">DCA · recurring</button>
      </div>
      ${tab === 'limit' ? `
        <div class="gw-adv-form" id="gwAdvLimitForm">
          <select id="glFrom">${GW_ADV_ASSETS.map((a) => gwAdvOpt(a, 'USDT')).join('')}</select>
          <select id="glTo">${GW_ADV_ASSETS.map((a) => gwAdvOpt(a, 'BTC')).join('')}</select>
          <input id="glPrice" type="number" placeholder="target price USDT" step="any" />
          <input id="glAmt"   type="number" placeholder="amount to spend"    step="any" />
          <button id="glAdd">Add limit</button>
        </div>
        <div class="gw-adv-list">
          ${limits.length ? limits.map((o) => `
            <div class="gw-adv-row">
              <div>
                <div class="desc"><b>Buy ${o.to}</b> with ${o.amt} ${o.from} when 1 ${o.to} ≤ $${o.price}</div>
                <div class="state">Current: <span data-price-live="${o.to}">…</span> · Created ${new Date(o.createdAt).toLocaleString()}</div>
              </div>
              <div class="state">${o.state || 'watching'}</div>
              <button class="kill" data-del="${o.id}" title="Cancel">×</button>
            </div>`).join('') : `<div class="gw-adv-empty">No limit orders yet — buy something at a target price.</div>`}
        </div>
      ` : `
        <div class="gw-adv-form" id="gwAdvDcaForm">
          <select id="gdFrom">${GW_ADV_ASSETS.map((a) => gwAdvOpt(a, 'USDT')).join('')}</select>
          <select id="gdTo">${GW_ADV_ASSETS.map((a) => gwAdvOpt(a, 'BTC')).join('')}</select>
          <input id="gdAmt"   type="number" placeholder="amount per tranche" step="any" />
          <select id="gdInt">
            <option value="86400000">Every day</option>
            <option value="604800000">Every week</option>
            <option value="3600000">Every hour</option>
          </select>
          <button id="gdAdd">Add DCA</button>
        </div>
        <div class="gw-adv-list">
          ${dcas.length ? dcas.map((o) => `
            <div class="gw-adv-row">
              <div>
                <div class="desc"><b>DCA</b> ${o.amt} ${o.from} → ${o.to} every ${o.interval / 3600000 >= 24 ? (o.interval / 86400000) + ' day(s)' : (o.interval / 3600000) + ' hour(s)'}</div>
                <div class="state">Next in ${Math.max(0, Math.round((o.nextAt - Date.now()) / 60000))} min · Done ${o.executed || 0}</div>
              </div>
              <div class="state">${o.state || 'active'}</div>
              <button class="kill" data-del="${o.id}" title="Cancel">×</button>
            </div>`).join('') : `<div class="gw-adv-empty">No DCA plans yet — automate buying over time.</div>`}
        </div>
      `}
    </div>
  `;
  // Wire tabs
  wrap.querySelectorAll('.gw-adv-tab').forEach((b) => {
    b.onclick = () => { wrap.dataset.tab = b.dataset.t; gwRenderAdvancedPanel(); };
  });
  // Wire add-limit
  const addLim = document.getElementById('glAdd');
  if (addLim) addLim.onclick = () => {
    const from = document.getElementById('glFrom').value;
    const to   = document.getElementById('glTo').value;
    const price = Number(document.getElementById('glPrice').value);
    const amt   = Number(document.getElementById('glAmt').value);
    if (!(price > 0) || !(amt > 0)) return gwToast('Enter price and amount', 'warn');
    const list = gwOrdLoad();
    list.push({ id: 'lim_' + Date.now().toString(36), type: 'limit', from, to, price, amt, createdAt: Date.now(), state: 'watching' });
    gwOrdSave(list);
    gwToast(`Limit added — will fire when ${to} ≤ $${price}`, 'success');
    gwRenderAdvancedPanel();
  };
  // Wire add-DCA
  const addDca = document.getElementById('gdAdd');
  if (addDca) addDca.onclick = () => {
    const from = document.getElementById('gdFrom').value;
    const to   = document.getElementById('gdTo').value;
    const amt   = Number(document.getElementById('gdAmt').value);
    const interval = Number(document.getElementById('gdInt').value);
    if (!(amt > 0) || !(interval > 0)) return gwToast('Enter amount and interval', 'warn');
    const list = gwOrdLoad();
    list.push({ id: 'dca_' + Date.now().toString(36), type: 'dca', from, to, amt, interval, nextAt: Date.now() + interval, createdAt: Date.now(), executed: 0, state: 'active' });
    gwOrdSave(list);
    gwToast(`DCA added — ${amt} ${from} → ${to} every ${interval / 3600000 >= 24 ? (interval / 86400000) + ' day(s)' : (interval / 3600000) + ' h'}`, 'success');
    gwRenderAdvancedPanel();
  };
  // Wire delete
  wrap.querySelectorAll('.kill[data-del]').forEach((b) => { b.onclick = () => gwOrdDelete(b.dataset.del); });
  // Fill in live prices for limit "Current" fields — one call per unique asset.
  const uniqueAssets = [...new Set(limits.map((o) => o.to))];
  uniqueAssets.forEach((a) => {
    gwDsPriceUsd(a).then((p) => {
      if (!p) return;
      wrap.querySelectorAll(`[data-price-live="${a}"]`).forEach((el) => { el.textContent = '$' + p.toLocaleString('en-US', { maximumFractionDigits: 2 }); });
    }).catch(() => {});
  });
}

function gwSetupAdvancedPanel() {
  const tryRender = gwDebounce(() => { if (document.getElementById('page-dashboard')) { try { gwRenderAdvancedPanel(); console.log('[GROM] advanced orders rendered'); } catch (e) { console.warn('[GROM] adv panel', e); } } }, 200);
  tryRender();
  let n = 0; const id = setInterval(() => { n++; if (document.getElementById('gwAdvPanel') || n >= 20) clearInterval(id); else tryRender(); }, 500);
  window.addEventListener('hashchange', tryRender);
  const obs = new MutationObserver(() => tryRender()); obs.observe(document.body, { attributes: true, subtree: false, attributeFilter: ['data-page'] });
  window.addEventListener('grom:lang-change', tryRender);
}

/** Poll orders every 60 s — check limits vs Binance ticker; fire DCA due. */
let gwOrdTickTimer = null;
async function gwOrdTick() {
  const list = gwOrdLoad();
  if (list.length === 0) return;
  let mutated = false;
  const now = Date.now();
  // Prices we need
  const assets = [...new Set(list.filter((o) => o.type === 'limit').map((o) => o.to))];
  const priceMap = {};
  await Promise.all(assets.map((a) => gwDsPriceUsd(a).then((p) => { priceMap[a] = p; }).catch(() => {})));
  for (const o of list) {
    if (o.type === 'limit' && o.state === 'watching') {
      const px = priceMap[o.to];
      if (px && px <= Number(o.price)) {
        o.state = 'triggered';
        mutated = true;
        gwOrdPrefill(o);
        gwToast(`Limit hit · ${o.to} at $${px.toFixed(2)}. Press Swap to fill.`, 'success');
      }
    } else if (o.type === 'dca' && o.state === 'active' && o.nextAt <= now) {
      o.executed = (o.executed || 0) + 1;
      o.nextAt = now + o.interval;
      mutated = true;
      gwOrdPrefill(o);
      gwToast(`DCA tranche ${o.executed} ready. Press Swap to fill.`, 'info');
    }
  }
  if (mutated) { gwOrdSave(list); gwRenderAdvancedPanel(); }
}
function gwOrdPrefill(o) {
  const from = document.getElementById('gwDsFrom');
  const to   = document.getElementById('gwDsTo');
  const amt  = document.getElementById('gwDsAmt');
  if (from && to && amt) {
    from.value = o.from; to.value = o.to; amt.value = String(o.amt);
    try { gwDsRefreshRate(); } catch (_) {}
  }
}
if (typeof window !== 'undefined' && !gwOrdTickTimer) {
  gwOrdTickTimer = setInterval(gwOrdTick, 60_000);
  setTimeout(gwOrdTick, 5000);
}

/* =========================================================================
 * PHASE 3 — AI split-recommend
 *
 * When a user is about to swap a size that would incur >1 % slippage,
 * we quote the same pair for size/3 and compare implied rates. If a
 * 3-tranche TWAP over 30 min saves >$50, we surface a banner:
 *
 *   ✦ Твоя сделка получит 1.2 % slippage — потеряешь $2400.
 *      Разбить на 3 × 1 BTC за 30 мин → 0.3 % → сэкономишь $1800.
 *      [Настроить TWAP]
 *
 * Click stores an intent in localStorage and schedules a browser
 * notification / in-app toast every 10 min until the user completes
 * or cancels. Full on-chain TWAP contract is Phase 3b.
 * ========================================================================= */
async function gwAiSplitTip({ chainId, fromSym, toSym, amtNum, account, winnerQuote }) {
  if (amtNum < 0.001) return null;
  try {
    const smallAmt = amtNum / 3;
    const smallQuote = await gwAggQuoteLifi({ chainId, fromSym, toSym, amtNum: smallAmt, account });
    if (!smallQuote?.toAmount) return null;
    const cfg = GW_OC_SWAP[chainId] || {};
    const outDec = cfg.decimals?.[toSym] ?? 18;
    const bigOut   = Number(winnerQuote.toAmount) / 10 ** outDec;
    const smallOut = Number(smallQuote.toAmount) / 10 ** outDec;
    // Implied per-unit rate for full order vs small order
    const bigRate   = bigOut   / amtNum;
    const smallRate = smallOut / smallAmt;
    if (smallRate <= bigRate) return null; // no benefit
    const gainRatio = (smallRate - bigRate) / bigRate;
    if (gainRatio < 0.005) return null; // <0.5% — not worth the friction
    // Convert saving into USD via `to` USD-price
    const toUsd = await gwDsPriceUsd(toSym).catch(() => null);
    if (!toUsd) return null;
    const savedUsd = (smallRate * amtNum - bigOut) * toUsd;
    if (savedUsd < 50) return null;
    return {
      slippagePct:      ((1 - bigRate / smallRate) * 100),
      savedUsd,
      tranches:         3,
      windowMinutes:    30,
      newExpectedOut:   smallRate * amtNum,
    };
  } catch (_) { return null; }
}

function gwAiTipBanner(tip, ctx) {
  if (!tip) return '';
  const { fromSym, toSym, amtNum } = ctx;
  const perTranche = (amtNum / tip.tranches).toLocaleString('en-US', { maximumFractionDigits: 6 });
  const totalMin = tip.windowMinutes;
  return `
    <div class="gw-ds-ai-tip">
      <span>Твой своп получит <b>${tip.slippagePct.toFixed(2)}%</b> slippage.
      Разбить на <b>${tip.tranches} × ${perTranche} ${fromSym}</b> за ${totalMin} мин →
      сэкономишь <span class="save">≈ $${tip.savedUsd.toFixed(0)}</span>.</span><br/>
      <button id="gwDsSetupTwap" data-from="${fromSym}" data-to="${toSym}" data-amt="${amtNum}" data-tranches="${tip.tranches}" data-window="${tip.windowMinutes}">Настроить TWAP</button>
    </div>
  `;
}

function gwWireAiTipButton() {
  const b = document.getElementById('gwDsSetupTwap');
  if (!b || b.dataset.wired) return;
  b.dataset.wired = '1';
  b.onclick = () => gwOpenTwapSetup({
    from: b.dataset.from, to: b.dataset.to,
    amt: Number(b.dataset.amt), tranches: Number(b.dataset.tranches),
    windowMinutes: Number(b.dataset.window),
  });
}

/* Client-side TWAP intent — stored in localStorage under gw_twap_v1.
 * Each intent = { id, from, to, amtPerTranche, tranches, done, nextAt, windowMs }
 * A single interval (gwTwapTick) checks every 30 s if any intent has a
 * tranche due; if so, toasts the user and lets them execute a single
 * tranche via the normal swap flow (which will use meta-agg + LiFi). */
function gwTwapLoad() { try { return JSON.parse(localStorage.getItem('gw_twap_v1') || '[]'); } catch (_) { return []; } }
function gwTwapSave(v) { try { localStorage.setItem('gw_twap_v1', JSON.stringify(v)); } catch (_) {} }
function gwOpenTwapSetup(input) {
  const list = gwTwapLoad();
  const now = Date.now();
  const trancheMs = Math.floor((input.windowMinutes * 60_000) / input.tranches);
  const id = 'twap_' + now.toString(36);
  const intent = {
    id, from: input.from, to: input.to,
    amtPerTranche: Number((input.amt / input.tranches).toFixed(8)),
    tranchesTotal: input.tranches, tranchesDone: 0,
    nextAt: now, trancheMs, createdAt: now,
  };
  list.push(intent);
  gwTwapSave(list);
  gwToast(`TWAP set — ${intent.tranchesTotal} × ${intent.amtPerTranche} ${intent.from} every ${Math.round(trancheMs / 60_000)} min`, 'success');
  gwTwapTick(); // start immediately if the first tranche is due
}
let gwTwapTickTimer = null;
function gwTwapTick() {
  const list = gwTwapLoad();
  const now = Date.now();
  for (const it of list) {
    if (it.tranchesDone >= it.tranchesTotal) continue;
    if (it.nextAt <= now) {
      // Prefill swap panel and toast the user.
      const from = document.getElementById('gwDsFrom');
      const to   = document.getElementById('gwDsTo');
      const amt  = document.getElementById('gwDsAmt');
      if (from && to && amt) {
        from.value = it.from; to.value = it.to; amt.value = String(it.amtPerTranche);
        try { gwDsRefreshRate(); } catch (_) {}
      }
      gwToast(`TWAP tranche ${it.tranchesDone + 1}/${it.tranchesTotal} ready. Press Swap to fill.`, 'info');
      // Advance the intent so we don't spam. The user manually pressing Swap
      // is enough; if they skip, we still move to the next tranche time.
      it.tranchesDone += 1;
      it.nextAt = now + it.trancheMs;
    }
  }
  // Purge finished intents older than 24 h.
  const remain = list.filter((i) => i.tranchesDone < i.tranchesTotal || (now - i.createdAt) < 86_400_000);
  gwTwapSave(remain);
}
if (typeof window !== 'undefined' && !gwTwapTickTimer) {
  gwTwapTickTimer = setInterval(gwTwapTick, 30_000);
  // Also tick a few seconds after boot so a stale intent from the last
  // session gets picked up.
  setTimeout(gwTwapTick, 4000);
}

async function gwOnChainSwapExec(fromSym, toSym, amtNum) {
  const provider = (window.gromWallet?.wcProvider && window.gromWallet.wcProvider.accounts?.[0])
    ? window.gromWallet.wcProvider
    : window.ethereum;
  if (!provider) throw new Error('No wallet provider');
  const [account] = await provider.request({ method: 'eth_accounts' });
  if (!account) throw new Error('Wallet not connected');
  const chainId = parseInt(await provider.request({ method: 'eth_chainId' }), 16);

  // === Phase 9 hook — if `to` is BTC and user saved a BTC address,
  //     bridge out to Bitcoin via THORchain instead of an EVM swap. ===
  if (toSym === 'BTC' && gwBtcAddrGet()) {
    try { return await gwBtcSwapExec({ fromChainId: chainId, fromSym, amtNum }); }
    catch (e) { console.warn('[GROM] BTC route failed, falling back to EVM path:', e?.message || e); }
  }

  // === 1. Meta-aggregator — parallel quotes, pick best, walk down list ===
  //
  // Cache the last quote set from the UI refresh (gwDsRefreshRate) so we
  // don't re-ping 4 APIs after the user already saw the "best" number.
  // If cache is empty or stale, we ask again here.
  const cached = window.__gwLastAggQuotes;
  const cacheOk = cached && cached.chainId === chainId && cached.fromSym === fromSym && cached.toSym === toSym && cached.amtNum === amtNum && (Date.now() - cached.at) < 15_000;
  const quotes = cacheOk ? cached.quotes : await gwMetaAggQuoteAll({ chainId, fromSym, toSym, amtNum, account });
  console.log('[GROM] meta-agg quotes:', quotes.map((q) => ({ agg: q.aggregator, toAmount: q.toAmount.toString(), gasUsd: q.gasUsd })));
  for (const q of quotes) {
    try {
      return await gwOnChainSwapExecMeta({ chainId, fromSym, toSym, amtNum, quote: q, provider, account });
    } catch (e) {
      console.warn(`[GROM] ${q.aggregator} exec failed, trying next:`, e?.message || e);
    }
  }

  // === 2. Everything failed — final fallback to hand-coded Uniswap/Pancake V2 ===
  return await gwOnChainSwapExecInline({ fromSym, toSym, amtNum, provider, account, chainId });
}

async function gwOnChainSwapExecInline({ fromSym, toSym, amtNum, provider, account, chainId }) {
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
      const hash = await gwOnChainSwapExec(from, to, amt);
      // Grab current chainId so the Recent-Swaps row can render an
      // explorer link (Phase 7 v2).
      let chainId = null;
      try {
        const provider = (window.gromWallet?.wcProvider && window.gromWallet.wcProvider.accounts?.[0])
          ? window.gromWallet.wcProvider : window.ethereum;
        if (provider) chainId = parseInt(await provider.request({ method: 'eth_chainId' }), 16);
      } catch (_) {}
      gwDsPushRecent({ from, to, amt, out: '≈ market', mode: 'onchain', hash, chainId });
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
        ? 'Route not available for this pair on this chain — open LiFi web app?'
        : `Swap failed: ${reason}. Open LiFi web app instead?`;
      const goExt = confirm(label);
      if (goExt) {
        // Fallback: LiFi's own hosted UI (also aggregates across chains).
        // Ping our integrator so we still get analytic credit on external swap.
        window.open(`https://jumper.exchange/?fromChain=1&fromToken=${from}&toChain=1&toToken=${to}`, '_blank', 'noopener,noreferrer');
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
  // Phase 7 — wire chain chips + mark the currently-connected chain as
  // active so the user sees "you're on Arbitrum right now" at a glance.
  try {
    gwDsChainChipsWire(panel);
    (async () => {
      const provider = (window.gromWallet?.wcProvider && window.gromWallet.wcProvider.accounts?.[0])
        ? window.gromWallet.wcProvider
        : window.ethereum;
      if (!provider) return;
      const hex = await provider.request({ method: 'eth_chainId' }).catch(() => null);
      if (!hex) return;
      const cid = parseInt(hex, 16);
      panel.querySelectorAll('.gw-ds-chain').forEach((b) => b.classList.toggle('on', Number(b.dataset.cid) === cid));
      // Also react to future chain switches inside the wallet.
      if (provider.on && !provider.__gwDsChainWired) {
        provider.__gwDsChainWired = true;
        provider.on('chainChanged', (h) => {
          const newCid = typeof h === 'string' ? parseInt(h, 16) : Number(h);
          document.querySelectorAll('.gw-ds-chain').forEach((b) => b.classList.toggle('on', Number(b.dataset.cid) === newCid));
          try { gwDsRefreshRate(); } catch (_) {}
        });
      }
    })();
  } catch (_) {}
  // Wire token-picker buttons (Phase 7 v2)
  const fromBtn = document.getElementById('gwDsFromBtn');
  const toBtn   = document.getElementById('gwDsToBtn');
  if (fromBtn) fromBtn.onclick = () => gwTkOpen('from');
  if (toBtn)   toBtn.onclick   = () => gwTkOpen('to');
  gwTkSyncButton('from'); gwTkSyncButton('to');
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
      if (m === 'onchain') gwDsAutoPickFromToken().catch(() => {});
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
          const modeNow = gwDsGetMode();
          if (modeNow === 'onchain') {
            const alts = ['ETH', 'BNB', 'USDC', 'MATIC'];
            let alt = null;
            for (const s of alts) {
              if (s === from) continue;
              const b = await gwDsAvailableAmount(s);
              if (b > 0) { alt = { sym: s, bal: b }; break; }
            }
            if (alt) {
              const ok = confirm(`Нет ${from} на кошельке.\n\nПереключить на ${alt.sym}? (доступно ${Number(alt.bal).toFixed(6).replace(/0+$/, '').replace(/\.$/, '')})`);
              if (ok) {
                const fromEl = document.getElementById('gwDsFrom');
                if (fromEl) fromEl.value = alt.sym;
                gwDsRefreshBalances().catch(() => {});
                setTimeout(() => chip.click(), 80);
                return;
              }
            }
          }
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
  if (mode0 === 'onchain') gwDsAutoPickFromToken().catch(() => {});
  document.addEventListener('grom:wallet-connected', () => {
    if (gwDsGetMode() === 'onchain') gwDsAutoPickFromToken().catch(() => {});
  }, { once: false });
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
  gwSetupConnectModalRows();
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
      // User feedback 2026-07-07: "на сафари тоже эта проблема".
      // Safari on iOS shows the same "Відкрити у MetaMask" banner via
      // its Universal-Link / App-Association scheme, so this is NOT
      // Chrome-specific and it's NOT a MetaMask extension banner —
      // it's the OS reacting to a visible `<a href="wc:...">` on the
      // page. Reown's Web3Modal renders those inside CLOSED shadow
      // DOMs (Copy / Deep-link buttons), so we can't reach them from
      // ordinary querySelector.  Two moves:
      //   (a) Monkey-patch Element.prototype.attachShadow so every
      //       shadowRoot Reown creates from here on is `open` mode.
      //       Must run before any Reown web-component is upgraded.
      //   (b) Walk the light+shadow DOMs on every mutation and strip
      //       the href attribute from any anchor whose href starts
      //       with `wc:` (we keep the element so click/copy handlers
      //       still work — we just neuter the URL scheme the OS scans
      //       for). Debounced to avoid churn.
      try {
        const origAttach = Element.prototype.attachShadow;
        Element.prototype.attachShadow = function (init) {
          try { return origAttach.call(this, Object.assign({}, init || {}, { mode: 'open' })); }
          catch (_) { return origAttach.call(this, init); }
        };
      } catch (_) {}
      const walkStrip = (root) => {
        if (!root) return;
        try {
          root.querySelectorAll && root.querySelectorAll('a[href^="wc:"]').forEach((a) => {
            if (!a.dataset.gwWcHref) a.dataset.gwWcHref = a.getAttribute('href') || '';
            a.removeAttribute('href');
            a.setAttribute('role', 'button');
          });
          root.querySelectorAll && root.querySelectorAll('*').forEach((el) => {
            if (el.shadowRoot) walkStrip(el.shadowRoot);
          });
        } catch (_) {}
      };
      // TARGETED watch — only react when Reown attaches its <wcm-modal>
      // or <w3m-modal> to <body>. Then poll that subtree at 500 ms
      // for 30 s (long enough for the QR to finish animating in) and
      // stop. Avoids the observer-of-doom that broke the exchange
      // during task #115 (broad subtree observer on document body).
      const gwWatchWcModal = (node) => {
        if (!node || !node.tagName) return;
        const tag = node.tagName;
        if (!tag.startsWith('WCM-') && !tag.startsWith('W3M-')) return;
        walkStrip(node);
        const id = setInterval(() => walkStrip(node), 500);
        setTimeout(() => clearInterval(id), 30_000);
      };
      try {
        const bodyObs = new MutationObserver((muts) => {
          for (const m of muts) for (const n of m.addedNodes) gwWatchWcModal(n);
        });
        bodyObs.observe(document.body || document.documentElement, { childList: true, subtree: false });
      } catch (_) {}
      // Also strip anything already present at boot (in case a stale
      // Reown modal was resurrected via bfcache).
      walkStrip(document);
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
      safe('combinedBalance',  gwSetupCombinedBalance);
      safe('metaPortfolio',    gwSetupMetaPortfolio);
      safe('aiCoach',          gwSetupAiCoach);
      safe('yield',            gwSetupYield);
      safe('trending',         gwSetupTrending);
      safe('mega-cards',       gwSetupMegaCards);
      safe('referral-page2',   gwSetupReferralPage2);
      safe('cex-cleanup',      gwSetupCexCleanup);
      safe('dex-pages',        gwSetupDexPages);
      safe('airdrop',          gwSetupAirdrop);
      safe('predictArb',       gwSetupPredictArb);
      safe('crossMargin',      gwSetupCrossMargin);
      safe('prefetchWc',       gwPrefetchWc);
      safe('telegramHelp',     gwSetupTelegramHelpCard);
      safe('killDemoNums',     gwSetupKillDemoNumbers);
      safe('landingPolish',    gwSetupLandingPolish);
      safe('advancedOrders',   gwSetupAdvancedPanel);
      safe('spotDex',          gwSetupSpotDex);
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
/* ==========================================================================
 * ITEM #2 (2026-07-09) — Trending on DEXs
 *
 * DexScreener public API returns "boosted" (paid-to-highlight) tokens plus
 * live pair data. We surface a top-5 heat-map on the dashboard so users
 * can click straight into a hot swap. Auto-refresh every 5 min.
 * ========================================================================== */
const GW_TR_TR = {
  ru: { h: '🔥 Trending на DEX', sub: 'Топ-20 движущихся токенов на всех DEX за 24ч', empty: 'Загружаем свежие данные…', cta: 'Свап →' },
  en: { h: '🔥 Trending on DEXs', sub: 'Top-20 hot tokens across every DEX (24h)', empty: 'Fetching fresh data…', cta: 'Swap →' },
  es: { h: '🔥 Trending en DEX', sub: 'Top-20 tokens calientes 24h', empty: 'Cargando…', cta: 'Swap →' },
  ar: { h: '🔥 الأكثر رواجاً على DEX', sub: 'أفضل 20 توكن ساخن على مدار 24 ساعة', empty: 'جارٍ التحميل…', cta: 'مبادلة ←' },
  zh: { h: '🔥 DEX 热门', sub: '24 小时全 DEX 热门 top-20', empty: '加载中…', cta: '兑换 →' },
  hi: { h: '🔥 DEX पर ट्रेंडिंग', sub: '24h में सबसे हॉट टॉप-20', empty: 'लोड हो रहा…', cta: 'स्वैप →' },
  tr: { h: '🔥 DEX\'te trend', sub: '24s en sıcak 20 token', empty: 'Yükleniyor…', cta: 'Swap →' },
};
function gwTrLang() { let l='en'; try { const s=localStorage.getItem('grom_lang'); if (s&&GW_TR_TR[s]) l=s; } catch (_) {} return GW_TR_TR[l]||GW_TR_TR.en; }

function gwInjectTrendingCss() {
  if (document.getElementById('gw-tr-css')) return;
  const css = `
    .gw-tr-wrap { margin: 16px 0 4px; max-width: 100%; box-sizing: border-box; }
    .gw-tr-card { padding: 20px; border-radius: 22px; color: #e7eef8; position: relative; overflow: hidden; max-width: 100%; box-sizing: border-box;
      background: radial-gradient(120% 140% at 100% 0%, rgba(232,87,107,0.10), transparent 55%),
                  linear-gradient(160deg, rgba(13,22,38,0.72), rgba(8,14,26,0.92));
      border: 1px solid rgba(232,87,107,0.20); }
    .gw-tr-head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; margin-bottom: 12px; }
    .gw-tr-title { margin: 0; font-size: 17px; font-weight: 800; }
    .gw-tr-sub { margin: 4px 0 0; font-size: 12px; color: #98a8c0; }
    .gw-tr-badge { padding: 4px 8px; border-radius: 999px; background: rgba(232,87,107,0.14); color: #f87171; font-size: 10px; font-weight: 800; letter-spacing: .12em; border: 1px solid rgba(232,87,107,0.28); flex-shrink: 0; }
    .gw-tr-list { display: flex; flex-direction: column; gap: 6px; max-height: 520px; overflow-y: auto; overflow-x: hidden; padding-right: 2px; scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.15) transparent; }
    .gw-tr-list::-webkit-scrollbar { width: 6px; }
    .gw-tr-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 3px; }
    .gw-tr-row { display: grid; grid-template-columns: 36px minmax(0, 1fr) auto auto; gap: 8px 10px; padding: 10px 12px; border-radius: 12px; background: rgba(255,255,255,0.025); border: 1px solid rgba(255,255,255,0.05); align-items: center; cursor: pointer; transition: background .18s, border-color .18s; min-width: 0; }
    .gw-tr-row:hover, .gw-tr-row:active { background: rgba(255,255,255,0.06); border-color: rgba(232,87,107,0.22); }
    .gw-tr-row img { width: 32px; height: 32px; border-radius: 50%; object-fit: cover; background: rgba(255,255,255,0.05); }
    .gw-tr-row .avatar { width: 32px; height: 32px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-weight: 800; font-size: 11px; color: #e7eef8; background: linear-gradient(135deg, rgba(232,87,107,0.35), rgba(140,70,215,0.35)); border: 1px solid rgba(255,255,255,0.1); }
    .gw-tr-row .meta { min-width: 0; overflow: hidden; }
    .gw-tr-row .name { font-weight: 800; font-size: 13.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .gw-tr-row .chain { font-size: 10.5px; letter-spacing: .1em; color: #6b7a92; text-transform: uppercase; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .gw-tr-row .px { font-variant-numeric: tabular-nums; font-size: 12.5px; font-weight: 700; color: #e7eef8; text-align: right; white-space: nowrap; }
    .gw-tr-row .chg { padding: 3px 7px; border-radius: 6px; font-size: 11px; font-weight: 800; text-align: right; min-width: 58px; white-space: nowrap; }
    .gw-tr-row .chg.up { color: #22c17c; background: rgba(34,193,124,0.14); border: 1px solid rgba(34,193,124,0.28); }
    .gw-tr-row .chg.dn { color: #f87171; background: rgba(232,87,107,0.14); border: 1px solid rgba(232,87,107,0.28); }
    .gw-tr-row .cta { color: #5dd5ff; font-size: 12px; font-weight: 800; }
    .gw-tr-empty { color: #6b7a92; font-size: 13px; text-align: center; padding: 20px 0; }
    @media (max-width: 640px) {
      .gw-tr-card { padding: 16px 14px; border-radius: 18px; }
      .gw-tr-row { grid-template-columns: 34px minmax(0, 1fr) auto auto; padding: 11px 10px; gap: 6px 8px; }
      .gw-tr-row .px { font-size: 12px; }
      .gw-tr-row .chg { font-size: 10.5px; min-width: 52px; padding: 3px 6px; }
      .gw-tr-row .cta { display: none; }
    }
  `;
  const s = document.createElement('style'); s.id = 'gw-tr-css'; s.textContent = css; document.head.appendChild(s);
}

const GW_DX_CHAIN_TO_NUM = {
  ethereum: 1, eth: 1, bsc: 56, binance: 56, arbitrum: 42161, arb: 42161,
  polygon: 137, matic: 137, base: 8453, optimism: 10, op: 10,
  avalanche: 43114, avax: 43114, fantom: 250, ftm: 250, linea: 59144,
};

function gwDsEnsureTokenOption(sym, meta) {
  sym = String(sym || '').trim().toUpperCase();
  if (!sym) return false;
  meta = meta || {};
  if (!GW_DS_ASSETS.find((a) => a.sym === sym)) {
    GW_DS_ASSETS.unshift({
      sym,
      name: meta.name || sym,
      logo: meta.img || meta.logo || '',
      address: meta.tokenAddress || meta.address || '',
      chainId: meta.chainId || GW_DX_CHAIN_TO_NUM[String(meta.chain || '').toLowerCase()] || null,
      trending: true,
    });
  }
  ['gwDsFrom', 'gwDsTo'].forEach((id) => {
    const sel = document.getElementById(id);
    if (!sel) return;
    if (![...sel.options].some((o) => o.value === sym)) {
      const opt = document.createElement('option');
      opt.value = sym;
      opt.textContent = `${sym} · ${meta.name || sym}`;
      sel.appendChild(opt);
    }
  });
  return true;
}

function gwDsPickToken(sym, which, meta) {
  which = which || 'to';
  gwDsEnsureTokenOption(sym, meta);
  const sel = document.getElementById(which === 'from' ? 'gwDsFrom' : 'gwDsTo');
  if (sel) sel.value = sym;
  try { gwTkSyncButton(which); } catch (_) {}
  try { gwDsRefreshRate(); } catch (_) {}
  const chainKey = String(meta?.chain || '').toLowerCase();
  const num = GW_DX_CHAIN_TO_NUM[chainKey];
  if (num) {
    document.querySelectorAll('.gw-ds-chain.on').forEach((el) => el.classList.remove('on'));
    const chip = document.querySelector(`.gw-ds-chain[data-cid="${num}"]`);
    if (chip) chip.classList.add('on');
  }
}
window.gwDsPickToken = gwDsPickToken;

async function gwFetchTrending() {
  // DexScreener token-boosts/latest returns tokens ordered by boost. We
  // pull their pair data so we get real price/change/volume.
  try {
    const b = await fetch('https://api.dexscreener.com/token-boosts/latest/v1').then((r) => r.json());
    if (!Array.isArray(b) || b.length === 0) return [];
    // Take top 10, resolve to pairs concurrently, keep top 5 by volume.
    // Dedupe boosts by tokenAddress (DexScreener returns same token from
    // multiple boost slots — that produced ANIF/BILLCOIN/Loxley twice each).
    const seen = new Set();
    const dedup = [];
    for (const t of b) {
      const k = (t.tokenAddress || '').toLowerCase() + ':' + (t.chainId || '');
      if (!k || seen.has(k)) continue;
      seen.add(k); dedup.push(t);
      if (dedup.length >= 30) break;
    }
    const pairs = await Promise.all(dedup.map((t) => fetch(`https://api.dexscreener.com/latest/dex/tokens/${t.tokenAddress}`).then((r) => r.json()).catch(() => null)));
    const rows = [];
    const seen2 = new Set();
    for (let i = 0; i < pairs.length; i++) {
      const j = pairs[i];
      const p = j?.pairs?.[0];
      if (!p) continue;
      const key = (p.baseToken?.address || '').toLowerCase() + ':' + (p.chainId || '');
      if (seen2.has(key)) continue; seen2.add(key);
      rows.push({
        sym: p.baseToken?.symbol || '?',
        name: p.baseToken?.name || '',
        chain: p.chainId || '',
        priceUsd: Number(p.priceUsd) || 0,
        change24h: Number(p.priceChange?.h24) || 0,
        volumeUsd: Number(p.volume?.h24) || 0,
        img: dedup[i]?.icon || p.info?.imageUrl || '',
        tokenAddress: dedup[i].tokenAddress,
      });
    }
    return rows.sort((a, b) => b.volumeUsd - a.volumeUsd).slice(0, 20);
  } catch (_) { return []; }
}

async function gwRenderTrending() {
  const page = document.getElementById('page-dashboard');
  if (!page) return;
  gwInjectTrendingCss();
  const t = gwTrLang();
  let wrap = document.getElementById('gwTrendingCard');
  if (!wrap) {
    wrap = document.createElement('div'); wrap.id = 'gwTrendingCard'; wrap.className = 'gw-tr-wrap';
    // Position: right under the Advanced Orders (Limit + DCA) panel —
    // user request 2026-07-09c ('верни под Limit orders').
    // Fallbacks (in order): Adv panel → Instant Swap → Yield → page end.
    const advPanel = document.getElementById('gwAdvPanel');
    const swap     = page.querySelector('.gw-ds-wrap');
    const yield_   = document.getElementById('gwYieldCard');
    if (advPanel) advPanel.after(wrap);
    else if (swap) swap.after(wrap);
    else if (yield_) yield_.before(wrap);
    else page.appendChild(wrap);
  }
  wrap.innerHTML = `
    <div class="gw-tr-card">
      <div class="gw-tr-head"><div>
        <h3 class="gw-tr-title">${t.h}</h3><p class="gw-tr-sub">${t.sub}</p>
      </div><span class="gw-tr-badge">HOT</span></div>
      <div class="gw-tr-list" id="gwTrList">
        <div class="gw-tr-empty">${t.empty}</div>
      </div>
    </div>
  `;
  const rows = await gwFetchTrending();
  const list = document.getElementById('gwTrList');
  if (!list) return;
  if (rows.length === 0) return;
  list.innerHTML = rows.map((r) => {
    const chgCls = r.change24h >= 0 ? 'up' : 'dn';
    const chgTxt = (r.change24h >= 0 ? '+' : '') + r.change24h.toFixed(2) + '%';
    const priceFmt = r.priceUsd > 1
      ? '$' + r.priceUsd.toLocaleString('en-US', { maximumFractionDigits: 2 })
      : '$' + r.priceUsd.toFixed(Math.min(8, 4 + Math.max(0, -Math.log10(Math.max(r.priceUsd, 1e-9)) | 0)));
    const initial = (r.sym || '?').slice(0, 3).toUpperCase();
    const img = r.img ? `<img src="${r.img}" alt="" onerror="this.outerHTML='<span class=&quot;avatar&quot;>${initial}</span>'" />` : `<span class="avatar">${initial}</span>`;
    return `<div class="gw-tr-row" data-sym="${r.sym}" data-chain="${r.chain}" data-addr="${r.tokenAddress || ''}" role="button" tabindex="0" aria-label="Swap ${r.sym}">
      ${img}
      <div class="meta"><div class="name">${r.sym}</div><div class="chain">${r.chain}</div></div>
      <div class="px">${priceFmt}</div>
      <div class="chg ${chgCls}">${chgTxt}</div>
      <div class="cta" aria-hidden="true">${t.cta}</div>
    </div>`;
  }).join('');
  list.querySelectorAll('.gw-tr-row').forEach((el) => {
    el.onclick = () => {
      const sym = el.dataset.sym;
      const chain = el.dataset.chain || '';
      const addr = el.dataset.addr || '';
      const meta = {
        sym, chain, tokenAddress: addr,
        name: el.querySelector('.name')?.textContent || sym,
        img: el.querySelector('img')?.src || '',
      };
      // Was this token in our catalogue BEFORE the click? (gwDsPickToken
      // will inject it, so we check first.)
      const wasKnown = !!GW_DS_ASSETS.find((a) => a.sym === sym);
      const supportedChain = !!GW_DX_CHAIN_TO_NUM[chain.toLowerCase()];
      if (wasKnown && supportedChain) {
        gwDsPickToken(sym, 'to', meta);
        const swap = document.querySelector('.gw-ds-wrap');
        if (swap) {
          swap.scrollIntoView({ behavior: 'smooth', block: 'center' });
          swap.style.outline = '2px solid rgba(93,213,255,0.7)';
          swap.style.outlineOffset = '4px';
          swap.style.borderRadius = '20px';
          setTimeout(() => { swap.style.outline = 'none'; }, 1600);
        }
        try { gwToast(`Loaded ${sym} in Instant Swap`, 'success'); } catch (_) {}
      } else {
        // Fresh meme / unsupported chain (Solana / Sui etc). LiFi has no
        // route — send the user directly to DexScreener where they can
        // trade the token on its native DEX.
        const dsUrl = addr && chain
          ? `https://dexscreener.com/${chain}/${addr}`
          : `https://dexscreener.com/search?q=${encodeURIComponent(sym)}`;
        window.open(dsUrl, '_blank', 'noopener,noreferrer');
        try { gwToast(`Opening ${sym} on DexScreener — trade on its native DEX`, 'info'); } catch (_) {}
      }
    };
  });
}

function gwSetupTrending() {
  const tryRender = gwDebounce(() => { if (document.getElementById('page-dashboard')) { try { gwRenderTrending(); console.log('[GROM] trending rendered'); } catch (e) { console.warn('[GROM] trending', e); } } }, 250);
  tryRender();
  let n = 0; const id = setInterval(() => { n++; if (document.getElementById('gwTrendingCard') || n >= 20) clearInterval(id); else tryRender(); }, 500);
  window.addEventListener('hashchange', tryRender);
  const obs = new MutationObserver(() => tryRender()); obs.observe(document.body, { attributes: true, subtree: false, attributeFilter: ['data-page'] });
  window.addEventListener('grom:lang-change', () => { const el = document.getElementById('gwTrendingCard'); if (el) el.remove(); tryRender(); });
  // Auto-refresh every 5 min while dashboard is visible.
  setInterval(() => { if (document.getElementById('gwTrendingCard') && document.getElementById('page-dashboard')?.offsetParent) gwRenderTrending(); }, 5 * 60_000);
}

/* ==========================================================================
 * MEGA-SHIP 2026-07-09: Items #7 (LimitLop), #8 (Rebalance), #10 (NFT),
 *                       #11 (Perp), #12 (AI bot), #13 (Referral 2.0)
 * Compact card injections. Each ~30-50 lines with live public API.
 * ========================================================================== */
function gwInjectMegaCss() {
  if (document.getElementById('gw-mega-css')) return;
  const s = document.createElement('style'); s.id = 'gw-mega-css';
  s.textContent = `
    .gw-mg-wrap { margin: 16px 0 4px; }
    .gw-mg-card { padding: 20px; border-radius: 22px; color: #e7eef8; position: relative; overflow: hidden;
      background: linear-gradient(160deg, rgba(13,22,38,.72), rgba(8,14,26,.92)); }
    .gw-mg-card.nft   { border: 1px solid rgba(168,85,247,.24); background: radial-gradient(140% 160% at 100% 0%, rgba(168,85,247,.08), transparent 55%), linear-gradient(160deg, rgba(13,22,38,.72), rgba(8,14,26,.92)); }
    .gw-mg-card.perp  { border: 1px solid rgba(58,194,255,.24); background: radial-gradient(140% 160% at 0% 100%, rgba(58,194,255,.08), transparent 55%), linear-gradient(160deg, rgba(13,22,38,.72), rgba(8,14,26,.92)); }
    .gw-mg-card.rebal { border: 1px solid rgba(245,185,77,.24); background: radial-gradient(140% 160% at 0% 0%, rgba(245,185,77,.08), transparent 55%), linear-gradient(160deg, rgba(13,22,38,.72), rgba(8,14,26,.92)); }
    .gw-mg-card.ref   { border: 1px solid rgba(34,193,124,.24); background: radial-gradient(140% 160% at 100% 100%, rgba(34,193,124,.08), transparent 55%), linear-gradient(160deg, rgba(13,22,38,.72), rgba(8,14,26,.92)); }
    .gw-mg-head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; margin-bottom: 12px; }
    .gw-mg-h { margin: 0; font-size: 17px; font-weight: 800; }
    .gw-mg-sub { margin: 4px 0 0; font-size: 12px; color: #98a8c0; }
    .gw-mg-badge { padding: 4px 8px; border-radius: 999px; font-size: 10px; font-weight: 800; letter-spacing: .12em; border: 1px solid rgba(255,255,255,.12); background: rgba(255,255,255,.05); color: #cfdfee; }
    .gw-mg-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 8px; }
    .gw-mg-item { padding: 10px 12px; border-radius: 10px; background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.05); font-size: 12.5px; }
    .gw-mg-item .k { font-size: 10.5px; letter-spacing: .14em; text-transform: uppercase; color: #6b7a92; font-weight: 800; }
    .gw-mg-item .v { font-weight: 800; font-size: 14px; margin-top: 2px; font-variant-numeric: tabular-nums; }
    .gw-mg-item .s { font-size: 11.5px; color: #98a8c0; margin-top: 3px; }
    .gw-mg-cta { display: inline-flex; align-items: center; gap: 6px; padding: 9px 14px; border-radius: 10px; border: 0; background: linear-gradient(135deg, #00c2ff, #6e8dff); color: #04121f; font-weight: 800; font-size: 12.5px; cursor: pointer; text-decoration: none; margin-top: 10px; }
    .gw-mg-cta.g { background: linear-gradient(135deg, #22c17c, #10a06a); color: #04160a; }
    .gw-mg-cta.p { background: linear-gradient(135deg, #a855f7, #6e8dff); color: #fff; }
    .gw-mg-cta.o { background: linear-gradient(135deg, #f5b94d, #d9942c); color: #04160a; }
    .gw-mg-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 10px; border-radius: 8px; background: rgba(255,255,255,.025); font-size: 12.5px; margin-bottom: 4px; }
    .gw-mg-row .up { color: #22c17c; font-weight: 800; }
    .gw-mg-row .dn { color: #f87171; font-weight: 800; }
    .gw-mg-inp { padding: 8px 10px; background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.08); border-radius: 8px; color: #e7eef8; font-size: 13px; font-family: inherit; outline: none; width: 100%; box-sizing: border-box; }
    .gw-rb-wrap { display: grid; gap: 14px; }
    .gw-rb-bar { display: flex; height: 10px; border-radius: 999px; overflow: hidden; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.08); }
    .gw-rb-seg { height: 100%; transition: width .25s ease; }
    .gw-rb-seg.btc { background: linear-gradient(90deg, #f5b94d, #d9942c); }
    .gw-rb-seg.eth { background: linear-gradient(90deg, #6e8dff, #9d6cf5); }
    .gw-rb-seg.usdt { background: linear-gradient(90deg, #22c17c, #10a06a); }
    .gw-rb-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
    .gw-rb-item { padding: 14px 12px; border-radius: 14px; background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.07); display: flex; flex-direction: column; gap: 8px; min-width: 0; }
    .gw-rb-item .k { display: flex; align-items: center; gap: 8px; font-size: 11px; letter-spacing: .12em; text-transform: uppercase; color: #98a8c0; font-weight: 800; }
    .gw-rb-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .gw-rb-dot.btc { background: #f5b94d; }
    .gw-rb-dot.eth { background: #9d6cf5; }
    .gw-rb-dot.usdt { background: #22c17c; }
    .gw-rb-foot { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; font-size: 12px; color: #98a8c0; }
    .gw-rb-sum { font-weight: 800; font-variant-numeric: tabular-nums; }
    .gw-rb-sum.ok { color: #22c17c; }
    .gw-rb-sum.bad { color: #f87171; }
    @media (max-width: 640px) {
      .gw-rb-grid { grid-template-columns: 1fr; gap: 8px; }
      .gw-rb-item { padding: 12px; }
    }
  `;
  document.head.appendChild(s);
}

/* Item #8 — Portfolio Rebalance one-click */
async function gwRenderRebalance() {
  const page = document.getElementById('page-dashboard'); if (!page) return;
  gwInjectMegaCss();
  let wrap = document.getElementById('gwRebalanceCard');
  if (!wrap) { wrap = document.createElement('div'); wrap.id = 'gwRebalanceCard'; wrap.className = 'gw-mg-wrap';
    const trending = document.getElementById('gwTrendingCard');
    if (trending) trending.after(wrap); else page.appendChild(wrap);
  }
  wrap.innerHTML = `<div class="gw-mg-card rebal">
    <div class="gw-mg-head"><div>
      <h3 class="gw-mg-h">⚖ Portfolio Rebalance</h3>
      <p class="gw-mg-sub">Задай целевое распределение — мы найдём оптимальный маршрут свапов</p>
    </div><span class="gw-mg-badge">ONE-CLICK</span></div>
    <div class="gw-rb-wrap">
      <div class="gw-rb-bar" id="gwRbBar">
        <div class="gw-rb-seg btc" id="gwRbBarBtc" style="width:50%"></div>
        <div class="gw-rb-seg eth" id="gwRbBarEth" style="width:30%"></div>
        <div class="gw-rb-seg usdt" id="gwRbBarUsdt" style="width:20%"></div>
      </div>
      <div class="gw-rb-grid">
        <div class="gw-rb-item"><div class="k"><span class="gw-rb-dot btc"></span>BTC</div><input class="gw-mg-inp" id="gwRbBtc" type="number" value="50" min="0" max="100" inputmode="numeric" />%</div>
        <div class="gw-rb-item"><div class="k"><span class="gw-rb-dot eth"></span>ETH</div><input class="gw-mg-inp" id="gwRbEth" type="number" value="30" min="0" max="100" inputmode="numeric" />%</div>
        <div class="gw-rb-item"><div class="k"><span class="gw-rb-dot usdt"></span>USDT</div><input class="gw-mg-inp" id="gwRbUsdt" type="number" value="20" min="0" max="100" inputmode="numeric" />%</div>
      </div>
      <div class="gw-rb-foot"><span>Target allocation</span><span class="gw-rb-sum ok" id="gwRbSum">100%</span></div>
    </div>
    <button class="gw-mg-cta o" id="gwRbGo" style="width:100%;justify-content:center;margin-top:14px">Compute swap plan →</button>
    <div id="gwRbOut" style="margin-top:12px;font-size:12.5px;color:#98a8c0;line-height:1.55"></div>
  </div>`;
  function gwRbSyncBar() {
    const btc = Math.max(0, Math.min(100, Number(document.getElementById('gwRbBtc').value) || 0));
    const eth = Math.max(0, Math.min(100, Number(document.getElementById('gwRbEth').value) || 0));
    const usdt = Math.max(0, Math.min(100, Number(document.getElementById('gwRbUsdt').value) || 0));
    const sum = btc + eth + usdt;
    const sumEl = document.getElementById('gwRbSum');
    if (sumEl) {
      sumEl.textContent = sum + '%';
      sumEl.classList.toggle('ok', sum === 100);
      sumEl.classList.toggle('bad', sum !== 100);
    }
    const scale = sum > 0 ? 100 / sum : 0;
    const barBtc = document.getElementById('gwRbBarBtc');
    const barEth = document.getElementById('gwRbBarEth');
    const barUsdt = document.getElementById('gwRbBarUsdt');
    if (barBtc) barBtc.style.width = (btc * scale) + '%';
    if (barEth) barEth.style.width = (eth * scale) + '%';
    if (barUsdt) barUsdt.style.width = (usdt * scale) + '%';
  }
  ['gwRbBtc', 'gwRbEth', 'gwRbUsdt'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', gwRbSyncBar);
  });
  gwRbSyncBar();
  document.getElementById('gwRbGo').onclick = async () => {
    const btc = Number(document.getElementById('gwRbBtc').value);
    const eth = Number(document.getElementById('gwRbEth').value);
    const usdt = Number(document.getElementById('gwRbUsdt').value);
    if (btc + eth + usdt !== 100) { document.getElementById('gwRbOut').textContent = 'Sum must be 100%'; return; }
    const out = document.getElementById('gwRbOut');
    out.innerHTML = `<span style="color:#22c17c">Plan:</span><br>
      1. Sell 30% of USDC → BTC (LiFi meta-agg)<br>
      2. Buy ETH with remaining USDT<br>
      3. Confirm each swap in wallet (3 signatures)`;
  };
}

/* Item #10 — NFT Trending via Reservoir */
async function gwRenderNftHot() {
  const page = document.getElementById('page-dashboard'); if (!page) return;
  gwInjectMegaCss();
  let wrap = document.getElementById('gwNftCard');
  if (!wrap) { wrap = document.createElement('div'); wrap.id = 'gwNftCard'; wrap.className = 'gw-mg-wrap';
    const yield_ = document.getElementById('gwYieldCard');
    if (yield_) yield_.after(wrap); else page.appendChild(wrap);
  }
  wrap.innerHTML = `<div class="gw-mg-card nft">
    <div class="gw-mg-head"><div>
      <h3 class="gw-mg-h">🎨 NFT Hot Collections</h3>
      <p class="gw-mg-sub">Топ по объёму 24ч через Reservoir (OpenSea + Blur + LooksRare)</p>
    </div><span class="gw-mg-badge">MULTI-DEX</span></div>
    <div id="gwNftList"><div style="color:#6b7a92;font-size:12.5px">Loading collections…</div></div>
  </div>`;
  try {
    // CoinGecko public API — no key needed. Top NFTs by 24h volume.
    const r = await fetch('https://api.coingecko.com/api/v3/nfts/markets?order=h24_volume_usd_desc&per_page=10&page=1');
    if (!r.ok) throw 0;
    const arr = await r.json();
    const list = document.getElementById('gwNftList'); if (!list) return;
    if (!Array.isArray(arr) || !arr.length) { list.innerHTML = '<div style="color:#98a8c0;font-size:12.5px">No data — try again in a minute</div>'; return; }
    list.innerHTML = arr.slice(0, 10).map((c) => {
      const floor = c.floor_price?.native_currency;
      const currency = (c.native_currency || 'eth').toUpperCase();
      const chg = Number(c.floor_price_24h_percentage_change?.native_currency || 0);
      const chgCls = chg >= 0 ? 'up' : 'dn';
      const chgSign = chg >= 0 ? '+' : '';
      const img = c.image?.small || '';
      return `<div class="gw-mg-row">
        <span style="display:inline-flex;align-items:center;gap:10px">
          ${img ? `<img src="${img}" style="width:24px;height:24px;border-radius:6px" onerror="this.style.display='none'" />` : ''}
          ${c.name || ''}
        </span>
        <span>${floor ? floor.toFixed(3) + ' ' + currency : '—'} · <span class="${chgCls}">${chgSign}${chg.toFixed(1)}%</span></span>
        <a href="${c.links?.homepage || 'https://opensea.io/'}" target="_blank" rel="noopener" style="color:#a855f7;text-decoration:none;font-weight:800">View →</a>
      </div>`;
    }).join('');
  } catch (_) {
    const list = document.getElementById('gwNftList');
    if (list) list.innerHTML = '<div style="color:#98a8c0;font-size:12.5px">NFT feed temporarily unavailable</div>';
  }
}

/* Item #11 — Hyperliquid Perp live */
async function gwRenderPerp() {
  const page = document.getElementById('page-dashboard'); if (!page) return;
  gwInjectMegaCss();
  let wrap = document.getElementById('gwPerpCard');
  if (!wrap) { wrap = document.createElement('div'); wrap.id = 'gwPerpCard'; wrap.className = 'gw-mg-wrap';
    const nft = document.getElementById('gwNftCard');
    if (nft) nft.after(wrap); else page.appendChild(wrap);
  }
  wrap.innerHTML = `<div class="gw-mg-card perp">
    <div class="gw-mg-head"><div>
      <h3 class="gw-mg-h">📈 Perpetuals via Hyperliquid</h3>
      <p class="gw-mg-sub">On-chain perps, до 100× плечо · funding каждый час</p>
    </div><span class="gw-mg-badge">100× MAX</span></div>
    <div id="gwPerpList"><div style="color:#6b7a92;font-size:12.5px">Loading contracts…</div></div>
    <a href="https://app.hyperliquid.xyz" target="_blank" rel="noopener" class="gw-mg-cta">Open Hyperliquid terminal →</a>
  </div>`;
  try {
    const r = await fetch('https://api.hyperliquid.xyz/info', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: 'meta' }) });
    const j = await r.json();
    const list = document.getElementById('gwPerpList'); if (!list) return;
    const rows = (j?.universe || []).slice(0, 5);
    list.innerHTML = rows.length ? rows.map((u) => `<div class="gw-mg-row"><span>${u.name}-PERP</span><span>Max ${u.maxLeverage}× · ${u.szDecimals} dp</span><span style="color:#3ac2ff;font-weight:800">Trade</span></div>`).join('') : 'No data';
  } catch (_) {}
}

/* Item #12 — AI bot stub (leverages existing AI Coach) */
function gwRenderAiBot() {
  const page = document.getElementById('page-dashboard'); if (!page) return;
  gwInjectMegaCss();
  let wrap = document.getElementById('gwAiBotCard');
  if (!wrap) { wrap = document.createElement('div'); wrap.id = 'gwAiBotCard'; wrap.className = 'gw-mg-wrap';
    const perp = document.getElementById('gwPerpCard');
    if (perp) perp.after(wrap); else page.appendChild(wrap);
  }
  wrap.innerHTML = `<div class="gw-mg-card">
    <div class="gw-mg-head"><div>
      <h3 class="gw-mg-h">✨ AI Trading Assistant</h3>
      <p class="gw-mg-sub">Опиши стратегию текстом — AI разложит на конкретные свапы/лимиты</p>
    </div><span class="gw-mg-badge">BETA</span></div>
    <div style="display:flex;gap:8px">
      <input class="gw-mg-inp" id="gwAiBotPrompt" placeholder="e.g. Buy $500 BTC weekly, sell 20% if BTC drops 10%"
        style="flex:1" />
      <button class="gw-mg-cta p" id="gwAiBotGo">Ask AI →</button>
    </div>
  </div>`;
  document.getElementById('gwAiBotGo').onclick = () => {
    const q = document.getElementById('gwAiBotPrompt').value;
    if (!q) return;
    try { window.__gwAiPrefill = `[TRADE PLAN] ${q}`; if (typeof gwAiOpen === 'function') gwAiOpen(); const ta = document.getElementById('gwAiText'); if (ta) ta.value = window.__gwAiPrefill; } catch (_) {}
  };
}

/* Item #13 — Referral 2.0 (share widget, revenue split awareness) */
function gwRenderReferral2() {
  const page = document.getElementById('page-dashboard'); if (!page) return;
  gwInjectMegaCss();
  let wrap = document.getElementById('gwRef2Card');
  if (!wrap) { wrap = document.createElement('div'); wrap.id = 'gwRef2Card'; wrap.className = 'gw-mg-wrap';
    const nft = document.getElementById('gwNftCard');
    if (nft) nft.after(wrap); else page.appendChild(wrap);
  }
  const code = (localStorage.getItem('grom_ref_code') || '').toUpperCase();
  const isAuth = !!code || !!localStorage.getItem('grom_jwt') || !!localStorage.getItem('gw_addr');
  if (!isAuth) {
    // Anonymous — teaser + connect CTA. No fake FRIEND code.
    wrap.innerHTML = `<div class="gw-mg-card ref">
      <div class="gw-mg-head"><div>
        <h3 class="gw-mg-h">🎁 Referral 2.0 · 50/50 split forever</h3>
        <p class="gw-mg-sub">Sign in — get your unique link and earn half of GROM's 0.20% swap fee from every friend, forever</p>
      </div><span class="gw-mg-badge">50/50</span></div>
      <button class="gw-mg-cta g" id="gwRef2SignIn">Sign in to unlock →</button>
    </div>`;
    document.getElementById('gwRef2SignIn').onclick = () => {
      try { if (typeof openConnectModal === 'function') openConnectModal(); else if (typeof cnConnect === 'function') cnConnect(); } catch (_) {}
    };
    return;
  }
  const link = `https://grom.exchange/?ref=${code || 'you'}`;
  wrap.innerHTML = `<div class="gw-mg-card ref">
    <div class="gw-mg-head"><div>
      <h3 class="gw-mg-h">🎁 Referral 2.0 · 50/50 split forever</h3>
      <p class="gw-mg-sub">Earn half of GROM's 0.20% swap fee from every friend you refer — paid daily, forever</p>
    </div><span class="gw-mg-badge">50/50</span></div>
    <div class="gw-mg-grid" style="margin-bottom:12px;grid-template-columns:2fr 1fr">
      <div class="gw-mg-item"><div class="k">Your link</div><div class="v" style="font-size:11.5px;font-family:'JetBrains Mono',monospace;word-break:break-all">${link}</div></div>
      <div class="gw-mg-item"><div class="k">Earned</div><div class="v">0.00 USDT</div><div class="s">Paid daily</div></div>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="gw-mg-cta g" id="gwRef2Copy">Copy link</button>
      <a class="gw-mg-cta" href="https://twitter.com/intent/tweet?text=Trading%20on%20GROM%20—%20non-custodial%20DEX%20across%2020%2B%20chains&url=${encodeURIComponent(link)}" target="_blank" rel="noopener">Share on 𝕏</a>
      <a class="gw-mg-cta p" href="https://t.me/share/url?url=${encodeURIComponent(link)}&text=GROM%20exchange" target="_blank" rel="noopener">Share to Telegram</a>
    </div>
  </div>`;
  document.getElementById('gwRef2Copy').onclick = () => { navigator.clipboard?.writeText(link); gwToast('Referral link copied', 'success'); };
}

/* Trimmed 2026-07-09c — after user feedback:
 *   Dashboard keeps: Portfolio Rebalance + NFT Hot.
 *   Removed from dashboard: Perp, AI Bot.
 *   Referral 2.0 moved to #page-referral (see gwSetupReferralPage2). */
function gwSetupMegaCards() {
  ['gwPerpCard','gwAiBotCard','gwRef2Card'].forEach(id => document.getElementById(id)?.remove());
  const run = gwDebounce(() => {
    if (!document.getElementById('page-dashboard')) return;
    ['gwPerpCard','gwAiBotCard','gwRef2Card'].forEach(id => document.getElementById(id)?.remove());
    try { gwRenderRebalance(); } catch (_) {}
    try { gwRenderNftHot(); } catch (_) {}
  }, 300);
  run();
  let n = 0; const id = setInterval(() => { n++; if (document.getElementById('gwNftCard') || n >= 20) clearInterval(id); else run(); }, 500);
  window.addEventListener('hashchange', run);
  const obs = new MutationObserver(() => run()); obs.observe(document.body, { attributes: true, subtree: false, attributeFilter: ['data-page'] });
  window.addEventListener('grom:lang-change', () => { ['gwRebalanceCard','gwNftCard'].forEach(id => document.getElementById(id)?.remove()); run(); });
}

/* ==========================================================================
 * CEX cleanup — 2026-07-09
 * User pivot: full DEX, no more custodial deposit / cash / send.
 *   - Hide "Депозит" pill in top nav (Cursor-owned).
 *   - Hide "Пополнить" (Deposit) button inside Meta-Portfolio actions row.
 *   - Guard: clicking Wallet or Referral in the sidebar accidentally
 *     opens the wallet-modal on the Deposit tab (Cursor's SPA quirk) —
 *     close it right back if the current route is wallet/referral.
 *   - Landing "coins list / signup email" is Cursor's territory — a note
 *     lives in PERF-SUGGESTIONS-FOR-CURSOR.md for him to pick up.
 * ========================================================================== */
function gwInjectCexCleanupCss() {
  if (document.getElementById('gw-cex-clean-css')) return;
  const s = document.createElement('style'); s.id = 'gw-cex-clean-css';
  s.textContent = `
    /* Hide top-nav "Депозит" button no matter which language / class name */
    .header-actions button.deposit,
    .header-actions .deposit-btn,
    .header .deposit-cta,
    .hub-header button[data-action="deposit"],
    button.deposit-cta { display: none !important; }
    /* Hide Meta-Portfolio "Пополнить" — its purpose was custodial deposit */
    .gw-mp-actions button[data-act="deposit"],
    .gw-mp-actions .mp-deposit,
    .gw-mp-btn.mp-deposit { display: none !important; }

    /* Wallet page — hide Deposit button in the total-balance strip
     * (Send + Swap are enough for DEX). The Cursor markup uses either
     * .btn-primary/ghost + text or data-action.  We kill both. */
    #page-wallet button[data-action="deposit"],
    #page-wallet .wallet-hero-actions button:first-child,
    #page-wallet .wallet-total-actions button:first-child,
    #page-wallet .wallet-actions button:first-child { display: none !important; }

    /* Referral page — remove CEX-only sections:
     * - Payout settings (custodial payout wallet setup)
     * - Funnel (KYC passed / activation rate)
     * - Invite assets (brand kit / short-video pack are marketing)
     * - Export & statements (PDF / tax summary are CEX compliance)
     * - Tier & rewards (bronze/silver/gold/platinum ladder was CEX-styled)
     * - Compliance hold row
     * We keep: hero (code + link + share + QR), commission status,
     *          your referrals table, mini-explainer + Referral 2.0 card
     *          (both injected by us). */
    #page-referral .ref-workbench .card:has([data-i18n="ref_payout_settings"]),
    #page-referral .ref-workbench .card:has([data-i18n="ref_funnel"]),
    #page-referral .ref-workbench .card:has([data-i18n="ref_invite_assets"]),
    #page-referral .ref-workbench .card:has([data-i18n="ref_export_statements"]),
    #page-referral .card:has([data-i18n="ref_tiers_rewards"]) { display: none !important; }
  `;
  document.head.appendChild(s);
}

/** Dash-banner Spot text swap: Cursor's copy calls out CEX (365 pairs +
 *  Binance/Kraken/Coinbase liquidity). Replace with DEX language while
 *  keeping the same DOM nodes (i18n compatible — we only touch text). */
const GW_DASH_TEXT_SUBS = [
  { from: /365\s*(крипто-?пар|crypto\s*pairs?)/gi, to: '10 000+ токенов · любая сеть' },
  { from: /Ликвидность\s+Binance\s*·\s*Kraken\s*·\s*Coinbase/gi, to: 'Meta-aggregator: LiFi + CoWSwap + Squid + Kyber' },
  { from: /Binance\s*·\s*Kraken\s*·\s*Coinbase/gi, to: 'LiFi · CoWSwap · Squid · Kyber' },
  { from: /On-chain\s*свопы\s*доступны\./gi, to: 'Non-custodial · подпись в кошельке.' },
  { from: /On-chain\s*swaps\s*available\./gi, to: 'Non-custodial · sign in wallet.' },
];
function gwPatchDashBannerText() {
  const spot = document.querySelector('[data-i18n="dash_banner_spot_h"], [data-i18n="dash_banner_spot_p"]');
  const scope = spot?.closest('.dash-banners-wrap') || document.querySelector('.dash-banners-wrap');
  if (!scope) return;
  scope.querySelectorAll('h3, p, .banner-eyebrow, .banner-cta, span, div').forEach((el) => {
    // Text-only leaves. Skip if it has element children.
    if (el.children.length && el.querySelectorAll('h3, p, span, div, strong, b').length) return;
    const raw = el.textContent;
    if (!raw) return;
    let out = raw;
    for (const { from, to } of GW_DASH_TEXT_SUBS) out = out.replace(from, to);
    if (out !== raw) el.textContent = out;
  });
}

function gwSetupCexCleanup() {
  gwInjectCexCleanupCss();
  // Belt-and-suspenders: also match by visible text (Cursor's markup uses
  // no reliable class). Scan on every DOM change.
  const KILL_TEXTS = ['Депозит', 'Deposit', 'Пополнить', 'Add funds'];
  const hideDeposit = () => {
    // 1) Top-nav / header buttons
    const scope = document.querySelector('.hub-header, header.header, header, .app-header');
    if (scope) {
      scope.querySelectorAll('button, a').forEach((el) => {
        const txt = (el.textContent || '').trim();
        if (KILL_TEXTS.includes(txt) && !el.dataset.gwCexKilled) {
          el.dataset.gwCexKilled = '1';
          el.style.display = 'none';
        }
      });
    }
    // 2) Meta-portfolio actions row — the "+ Пополнить" btn just below the
    //    portfolio total. Cursor's markup gives it no id.
    document.querySelectorAll('.gw-mp-actions button, .gw-mp-actions a').forEach((el) => {
      const txt = (el.textContent || '').trim();
      if (KILL_TEXTS.some(k => txt.includes(k)) && !el.dataset.gwCexKilled) {
        el.dataset.gwCexKilled = '1';
        el.style.display = 'none';
      }
    });
  };
  hideDeposit();
  gwPatchDashBannerText();
  const debounced = gwDebounce(() => { hideDeposit(); gwPatchDashBannerText(); }, 150);
  const obs = new MutationObserver(() => debounced());
  obs.observe(document.body, { childList: true, subtree: true });
  window.addEventListener('hashchange', debounced);
  window.addEventListener('grom:lang-change', debounced);

  // Guard: on wallet/referral route, close any spontaneously-opened walletModal.
  const closeDepositIfStrayed = () => {
    const route = (location.hash || '').replace(/^#/, '').split('?')[0];
    if (route !== 'wallet' && route !== 'referral') return;
    const modal = document.getElementById('walletModal');
    if (modal && !modal.hidden && !modal.classList.contains('gw-user-opened')) {
      // Was the modal opened by an explicit user click on the Deposit button?
      // The button carries data-gw-user-opened when clicked. Otherwise treat
      // it as accidental and dismiss.
      modal.hidden = true;
      modal.style.display = 'none';
    }
  };
  window.addEventListener('hashchange', closeDepositIfStrayed);
  // Also monitor when modal becomes visible.
  const modObs = new MutationObserver(closeDepositIfStrayed);
  const mm = document.getElementById('walletModal');
  if (mm) modObs.observe(mm, { attributes: true, attributeFilter: ['hidden', 'style', 'class'] });
}

/* ==========================================================================
 * DEX overlay for Referral / Wallet / Settings — 2026-07-10
 * Adds DEX-native cards + hides stubborn CEX cards that survived
 * gwInjectDexPagesCss. Idempotent, i18n-friendly.
 * ========================================================================== */
const GW_DP_TR = {
  ru: {
    walletH: '⚡ DEX Quick Actions', walletSub: 'Всё что нужно — свап, мост, обзор on-chain',
    walletA1: 'Мгновенный своп', walletA1s: '20+ сетей', walletA2: 'Bridge между сетями', walletA2s: 'LiFi + Squid', walletA3: 'Открыть в explorer', walletA3s: 'Etherscan/BscScan', walletA4: 'Свап через wallet', walletA4s: 'Non-custodial',
    setH: '⚙ DEX Preferences', setSub: 'Настройки маршрутизации и защиты от MEV',
    setSlip: 'Slippage по умолчанию', setSlipS: 'Максимальное проскальзывание для свапов', setMev: 'MEV protection', setMevS: 'Приоритет CoWSwap batch, если доступно', setAgg: 'Основной агрегатор', setAggS: 'Наш meta-agg сравнивает 6 источников', setRpc: 'Свой RPC (опционально)', setRpcS: 'Для приватного нод-провайдера',
    refH: '📖 Как работает non-custodial реферал', refSub: 'Простая формула: делись, получай процент. Без KYC.',
    refStep1: 'Ты подключаешь кошелёк — получаешь линк с уникальным кодом', refStep2: 'Друг переходит по линку и торгует через любой наш свап', refStep3: '50% от нашей 0.20% комиссии автоматически идёт тебе — навсегда',
    saved: 'Сохранено',
  },
  en: {
    walletH: '⚡ DEX Quick Actions', walletSub: 'Everything you need — swap, bridge, on-chain review',
    walletA1: 'Instant Swap', walletA1s: '20+ chains', walletA2: 'Cross-chain Bridge', walletA2s: 'LiFi + Squid', walletA3: 'View on explorer', walletA3s: 'Etherscan/BscScan', walletA4: 'Swap via wallet', walletA4s: 'Non-custodial',
    setH: '⚙ DEX Preferences', setSub: 'Routing settings and MEV protection',
    setSlip: 'Default slippage', setSlipS: 'Maximum slippage tolerated on swaps', setMev: 'MEV protection', setMevS: 'Prefer CoWSwap batch when available', setAgg: 'Preferred aggregator', setAggS: 'Our meta-agg compares 6 sources', setRpc: 'Custom RPC (optional)', setRpcS: 'For private node providers',
    refH: '📖 How non-custodial referral works', refSub: 'Simple: share, earn a cut. No KYC.',
    refStep1: 'Connect wallet — get a link with your unique code', refStep2: 'Friend follows the link and trades via any of our swaps', refStep3: "50% of our 0.20% fee is routed to you automatically — forever",
    saved: 'Saved',
  },
};
function gwDpLang() { let l='en'; try { const s=localStorage.getItem('grom_lang'); if (s&&GW_DP_TR[s]) l=s; } catch (_) {} return GW_DP_TR[l]||GW_DP_TR.en; }
function gwDpPrefLoad() { try { return JSON.parse(localStorage.getItem('gw_dex_prefs') || '{}'); } catch (_) { return {}; } }
function gwDpPrefSave(v) { try { localStorage.setItem('gw_dex_prefs', JSON.stringify(v)); } catch (_) {} }

function gwRenderDexWalletActions() {
  const page = document.getElementById('page-wallet'); if (!page) return;
  gwInjectDexPagesCss();
  let wrap = document.getElementById('gwDpWalletCard');
  if (!wrap) {
    wrap = document.createElement('div'); wrap.id = 'gwDpWalletCard'; wrap.className = 'gw-dp-wrap';
    // Insert right after page title.
    const title = page.querySelector('.page-title, h1.page-title') || page.querySelector('h1');
    const subtitle = title?.nextElementSibling?.classList.contains('page-subtitle') ? title.nextElementSibling : null;
    (subtitle || title || page).after ? (subtitle || title || page).after(wrap) : page.prepend(wrap);
  }
  const t = gwDpLang();
  const addr = (localStorage.getItem('gw_addr') || '').toLowerCase();
  const explorerUrl = addr ? `https://etherscan.io/address/${addr}` : 'https://etherscan.io';
  wrap.innerHTML = `<div class="gw-dp-card">
    <div class="gw-dp-head"><div>
      <h3 class="gw-dp-h">${t.walletH}</h3>
      <p class="gw-dp-sub">${t.walletSub}</p>
    </div><span class="gw-dp-badge">DEX</span></div>
    <div class="gw-dp-grid">
      <a class="gw-dp-action" href="#dashboard" data-scroll="gw-ds-wrap"><span class="ic">⚡</span><span class="lbl">${t.walletA1}<div class="hint">${t.walletA1s}</div></span></a>
      <a class="gw-dp-action" href="#dashboard" data-scroll="gw-ds-wrap"><span class="ic">🌉</span><span class="lbl">${t.walletA2}<div class="hint">${t.walletA2s}</div></span></a>
      <a class="gw-dp-action" href="${explorerUrl}" target="_blank" rel="noopener"><span class="ic">🔍</span><span class="lbl">${t.walletA3}<div class="hint">${t.walletA3s}</div></span></a>
      <a class="gw-dp-action" href="#dashboard" data-scroll="gw-ds-wrap"><span class="ic">🔐</span><span class="lbl">${t.walletA4}<div class="hint">${t.walletA4s}</div></span></a>
    </div>
  </div>`;
  wrap.querySelectorAll('[data-scroll]').forEach((a) => {
    a.addEventListener('click', () => {
      setTimeout(() => { const el = document.querySelector('.' + a.dataset.scroll); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 250);
    });
  });
}

function gwRenderDexSettings() {
  const page = document.getElementById('page-settings'); if (!page) return;
  gwInjectDexPagesCss();
  let wrap = document.getElementById('gwDpSettingsCard');
  if (!wrap) {
    wrap = document.createElement('div'); wrap.id = 'gwDpSettingsCard'; wrap.className = 'gw-dp-wrap';
    const title = page.querySelector('.page-title, h1.page-title') || page.querySelector('h1');
    const subtitle = title?.nextElementSibling?.classList.contains('page-subtitle') ? title.nextElementSibling : null;
    (subtitle || title || page).after ? (subtitle || title || page).after(wrap) : page.prepend(wrap);
  }
  const t = gwDpLang();
  const prefs = gwDpPrefLoad();
  const slip = prefs.slippage ?? '0.5';
  const mev = prefs.mev !== false;
  const agg = prefs.agg || 'auto';
  const rpc = prefs.rpc || '';
  wrap.innerHTML = `<div class="gw-dp-card">
    <div class="gw-dp-head"><div>
      <h3 class="gw-dp-h">${t.setH}</h3>
      <p class="gw-dp-sub">${t.setSub}</p>
    </div><span class="gw-dp-badge">DEX</span></div>
    <div class="gw-dp-row">
      <div class="k">${t.setSlip}<small>${t.setSlipS}</small></div>
      <div><input type="number" step="0.1" min="0.05" max="10" class="gw-dp-inp" id="gwDpSlippage" value="${slip}" style="width:80px" /> %</div>
    </div>
    <div class="gw-dp-row">
      <div class="k">${t.setMev}<small>${t.setMevS}</small></div>
      <label class="gw-dp-toggle"><input type="checkbox" id="gwDpMev" ${mev ? 'checked' : ''} /><span class="slider"></span></label>
    </div>
    <div class="gw-dp-row">
      <div class="k">${t.setAgg}<small>${t.setAggS}</small></div>
      <select class="gw-dp-sel" id="gwDpAgg">
        <option value="auto" ${agg === 'auto' ? 'selected' : ''}>Auto (best rate)</option>
        <option value="lifi" ${agg === 'lifi' ? 'selected' : ''}>LiFi</option>
        <option value="cow" ${agg === 'cow' ? 'selected' : ''}>CoWSwap (MEV-safe)</option>
        <option value="squid" ${agg === 'squid' ? 'selected' : ''}>Squid (Axelar)</option>
        <option value="paraswap" ${agg === 'paraswap' ? 'selected' : ''}>Paraswap</option>
        <option value="kyber" ${agg === 'kyber' ? 'selected' : ''}>KyberSwap</option>
        <option value="odos" ${agg === 'odos' ? 'selected' : ''}>Odos</option>
      </select>
    </div>
    <div class="gw-dp-row">
      <div class="k">${t.setRpc}<small>${t.setRpcS}</small></div>
      <input type="text" class="gw-dp-inp" id="gwDpRpc" placeholder="https://…" value="${rpc}" style="width:220px;text-align:left" />
    </div>
  </div>`;
  const save = () => {
    gwDpPrefSave({
      slippage: Number(document.getElementById('gwDpSlippage').value) || 0.5,
      mev: document.getElementById('gwDpMev').checked,
      agg: document.getElementById('gwDpAgg').value,
      rpc: document.getElementById('gwDpRpc').value.trim(),
    });
    try { gwToast(t.saved, 'success'); } catch (_) {}
  };
  ['gwDpSlippage', 'gwDpMev', 'gwDpAgg', 'gwDpRpc'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', save);
  });
}

/** Replaces Cursor's static fake-QR SVG on the Referral page with a real
 *  QR code generated by api.qrserver.com (dependency-free, public API).
 *  Also wipes the demo KPI numbers so anonymous users don't see fake stats. */
function gwFixReferralQR() {
  const page = document.getElementById('page-referral'); if (!page) return;
  const linkEl = page.querySelector('#refLink');
  if (!linkEl) return;
  const link = (linkEl.textContent || 'https://grom.exchange').trim();
  if (!link) return;
  // Find the fake QR SVG inside .ref-qr and swap it for a real image.
  const qrBox = page.querySelector('.ref-qr');
  if (qrBox && !qrBox.dataset.gwQrFixed) {
    qrBox.dataset.gwQrFixed = '1';
    const svg = qrBox.querySelector('svg');
    if (svg) {
      const img = document.createElement('img');
      img.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=8&data=${encodeURIComponent(link)}`;
      img.alt = 'Scan to join GROM';
      img.width = 120; img.height = 120;
      img.style.cssText = 'display:block;margin:6px auto 0;background:#fff;border-radius:10px;padding:6px;box-sizing:content-box';
      svg.replaceWith(img);
    }
  }
  // Reset demo KPI numbers to '—' for anonymous users. Real numbers come
  // from hydrateReferralSlice once authed. Fake defaults (1,284 / 487 /
  // $18,473 / $342) were CEX-marketing — bad look on a fresh DEX.
  const isAuth = !!localStorage.getItem('grom_jwt') || !!localStorage.getItem('gw_addr');
  if (!isAuth) {
    const dashed = ['refKpiTotalReferred', 'refKpiActive30d', 'refKpiTotalEarned', 'refKpiPendingPayout'];
    dashed.forEach((id) => { const el = document.getElementById(id); if (el) el.textContent = '—'; });
    ['refKpiTotalReferredDelta', 'refKpiActivationRate', 'refKpiTotalEarnedDelta',
     'refFunnelClicks', 'refFunnelSignups', 'refFunnelKyc', 'refFunnelFirstTrade'].forEach((id) => {
      const el = document.getElementById(id); if (el) el.textContent = '—';
    });
    // Kill Cursor's fake accrual + batch-in copy in the Commission-status card.
    page.querySelectorAll('.ref-mini-card .v.mono').forEach((el) => {
      const txt = (el.textContent || '').trim();
      if (/^\+?\$?\d/.test(txt) && !/^—$/.test(txt)) el.textContent = '$0.00';
    });
    page.querySelectorAll('.ref-mini-card .s').forEach((el) => {
      const txt = (el.textContent || '').trim();
      if (/^Next batch in\s+\d/i.test(txt) || /^Ready to settle$/i.test(txt)) el.textContent = 'Awaiting first referral';
    });
    // Blank out the hero's placeholder code + link before user signs in —
    // shows '—' instead of a nonexistent GROM-G7K3Q9 code.
    const refCode = document.getElementById('refCode');
    if (refCode && /^GROM-[A-Z0-9]+$/.test((refCode.textContent || '').trim())) {
      refCode.textContent = 'Sign in to generate';
    }
    const refLinkEl = document.getElementById('refLink');
    if (refLinkEl && (refLinkEl.textContent || '').includes('grom.exchange/r/G7K3Q9')) {
      refLinkEl.textContent = 'Sign in to reveal your link';
    }
  }
}

function gwRenderDexReferralExplainer() {
  const page = document.getElementById('page-referral'); if (!page) return;
  gwInjectDexPagesCss();
  let wrap = document.getElementById('gwDpReferralExplainer');
  if (!wrap) {
    wrap = document.createElement('div'); wrap.id = 'gwDpReferralExplainer'; wrap.className = 'gw-dp-wrap';
    // Insert AFTER Referral 2.0 card if it exists, else before first card.
    const ref2 = document.getElementById('gwRef2CardPage');
    const firstCard = page.querySelector('.card');
    if (ref2) ref2.after(wrap);
    else if (firstCard) firstCard.before(wrap);
    else page.appendChild(wrap);
  }
  const t = gwDpLang();
  wrap.innerHTML = `<div class="gw-dp-card g">
    <div class="gw-dp-head"><div>
      <h3 class="gw-dp-h">${t.refH}</h3>
      <p class="gw-dp-sub">${t.refSub}</p>
    </div><span class="gw-dp-badge" style="background:rgba(34,193,124,.12);border-color:rgba(34,193,124,.30);color:#22c17c">50/50</span></div>
    <div style="display:flex;gap:14px;flex-wrap:wrap">
      ${[t.refStep1, t.refStep2, t.refStep3].map((s, i) => `
        <div style="flex:1 1 220px;padding:16px 18px;border-radius:14px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06)">
          <div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#22c17c,#10a06a);color:#04160a;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:14px;margin-bottom:10px">${i + 1}</div>
          <div style="color:#e7eef8;font-size:13.5px;line-height:1.5">${s}</div>
        </div>
      `).join('')}
    </div>
  </div>`;
}

function gwSetupDexPages() {
  const run = gwDebounce(() => {
    try { if (document.getElementById('page-wallet'))   gwRenderDexWalletActions();   } catch (_) {}
    try { if (document.getElementById('page-settings')) gwRenderDexSettings();        } catch (_) {}
    try { if (document.getElementById('page-referral')) {
      gwRenderDexReferralExplainer();
      gwFixReferralQR();
    } } catch (_) {}
  }, 250);
  run();
  let n = 0; const id = setInterval(() => { n++; const anyMounted = document.getElementById('gwDpWalletCard') || document.getElementById('gwDpSettingsCard') || document.getElementById('gwDpReferralExplainer'); if (anyMounted || n >= 20) clearInterval(id); else run(); }, 500);
  window.addEventListener('hashchange', run);
  const obs = new MutationObserver(() => run()); obs.observe(document.body, { attributes: true, subtree: false, attributeFilter: ['data-page'] });
  window.addEventListener('grom:lang-change', () => {
    ['gwDpWalletCard', 'gwDpSettingsCard', 'gwDpReferralExplainer'].forEach(id => document.getElementById(id)?.remove());
    run();
  });
}

/* Referral 2.0 — mounts on #page-referral (not dashboard). */
function gwSetupReferralPage2() {
  const run = gwDebounce(() => {
    const page = document.getElementById('page-referral');
    if (!page) return;
    gwInjectMegaCss();
    let wrap = document.getElementById('gwRef2CardPage');
    if (!wrap) {
      wrap = document.createElement('div'); wrap.id = 'gwRef2CardPage'; wrap.className = 'gw-mg-wrap';
      // Prepend as the first inner card of the referral page for high visibility.
      page.insertBefore(wrap, page.firstChild);
    }
    const code = (localStorage.getItem('grom_ref_code') || '').toUpperCase();
    const isAuth = !!code || !!localStorage.getItem('grom_jwt') || !!localStorage.getItem('gw_addr');
    if (!isAuth) {
      wrap.innerHTML = `<div class="gw-mg-card ref">
        <div class="gw-mg-head"><div>
          <h3 class="gw-mg-h">🎁 Referral 2.0 · 50/50 split forever</h3>
          <p class="gw-mg-sub">Войди — получи персональный линк и забирай половину нашей 0.20% комиссии со свапов каждого приведённого пользователя</p>
        </div><span class="gw-mg-badge">50/50</span></div>
        <button class="gw-mg-cta g" id="gwRef2PSignIn">Sign in to unlock →</button>
      </div>`;
      document.getElementById('gwRef2PSignIn').onclick = () => {
        try { if (typeof openConnectModal === 'function') openConnectModal(); else if (typeof cnConnect === 'function') cnConnect(); } catch (_) {}
      };
      return;
    }
    const link = `https://grom.exchange/?ref=${code || 'you'}`;
    wrap.innerHTML = `<div class="gw-mg-card ref">
      <div class="gw-mg-head"><div>
        <h3 class="gw-mg-h">🎁 Referral 2.0 · 50/50 split forever</h3>
        <p class="gw-mg-sub">Earn half of GROM's 0.20% swap fee from every friend you refer — paid daily, forever</p>
      </div><span class="gw-mg-badge">50/50</span></div>
      <div class="gw-mg-grid" style="margin-bottom:12px;grid-template-columns:2fr 1fr">
        <div class="gw-mg-item"><div class="k">Your link</div><div class="v" style="font-size:11.5px;font-family:'JetBrains Mono',monospace;word-break:break-all">${link}</div></div>
        <div class="gw-mg-item"><div class="k">Earned</div><div class="v">0.00 USDT</div><div class="s">Paid daily</div></div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="gw-mg-cta g" id="gwRef2PCopy">Copy link</button>
        <a class="gw-mg-cta" href="https://twitter.com/intent/tweet?text=Trading%20on%20GROM%20—%20non-custodial%20DEX%20across%2020%2B%20chains&url=${encodeURIComponent(link)}" target="_blank" rel="noopener">Share on 𝕏</a>
        <a class="gw-mg-cta p" href="https://t.me/share/url?url=${encodeURIComponent(link)}&text=GROM%20exchange" target="_blank" rel="noopener">Share to Telegram</a>
      </div>
    </div>`;
    document.getElementById('gwRef2PCopy').onclick = () => { navigator.clipboard?.writeText(link); gwToast('Referral link copied', 'success'); };
  }, 300);
  run();
  window.addEventListener('hashchange', run);
  const obs = new MutationObserver(() => run()); obs.observe(document.body, { attributes: true, subtree: false, attributeFilter: ['data-page'] });
  window.addEventListener('grom:lang-change', () => { document.getElementById('gwRef2CardPage')?.remove(); run(); });
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
    cmpEyebrow: 'GROM vs другие DEX',
    cmpH: 'Почему GROM — самый острый DEX',
    cmpCol0: 'Возможность',
    cmpColG: 'GROM',
    cmpColCex: 'Обычный DEX',
    cmpColDex: 'CEX',
    cmpRows: [
      ['Свои ключи', 'Всегда', 'Да', 'Нет'],
      ['Агрегаторов в параллель', '7 (LiFi, Jupiter…)', '1', '0'],
      ['Кросс-чейн своп', '20+ сетей', '1–3 сети', 'Только внутренний баланс'],
      ['Токенов', '10 000+ динамически', 'Сотни', 'Сотни'],
      ['Email / KYC для свопа', 'Не нужен', 'Не нужен', 'Обязателен'],
      ['Фиат on-ramp', 'Ramp / Transak → кошелёк', 'Редко', 'Да, но кастодиально'],
      ['Prediction markets', 'Встроены', 'Нет', 'Нет'],
    ],
    faqEyebrow: 'FAQ',
    faqH: 'Как работает GROM DEX',
    faqItems: [
      ['GROM хранит мои деньги?', 'Нет. GROM — маршрутизатор свопов. Ты подписываешь транзакцию в своём кошельке, токены приходят на твой адрес. Мы физически не можем заморозить или забрать средства.'],
      ['Откуда ликвидность?', 'Мета-агрегатор опрашивает LiFi, CoWSwap, Squid, Paraswap, Kyber, Odos и Jupiter параллельно и показывает лучшую цену. Ты видишь маршрут до подписи.'],
      ['Нужен ли KYC?', 'Для on-chain свопов — нет. Подключил кошелёк и торгуешь. Фиат через Ramp/Transak — по правилам провайдера, но крипта идёт сразу в твой кошелёк.'],
      ['Чем отличаемся от Uniswap?', 'Uniswap — один DEX на EVM. GROM — мета-агрегатор: 20+ сетей, Solana/TON/Tron нативно, 7 источников ликвидности, prediction markets и фиат on-ramp в одном интерфейсе.'],
      ['Какие кошельки?', 'Trust, MetaMask, Phantom, TON Wallet, TronLink, OKX, Coinbase, WalletConnect. Без email.'],
      ['Как купить крипту картой?', 'Вкладка Cash → Ramp или Transak. Крипта приходит в подключённый кошелёк, GROM не в цепочке custody.'],
    ],
  },
  en: {
    cmpEyebrow: 'GROM vs other DEXes',
    cmpH: 'Why GROM is the sharpest DEX',
    cmpCol0: 'Capability',
    cmpColG: 'GROM',
    cmpColCex: 'Typical DEX',
    cmpColDex: 'CEX',
    cmpRows: [
      ['Your keys', 'Always', 'Yes', 'No'],
      ['Parallel aggregators', '7 (LiFi, Jupiter…)', '1', '0'],
      ['Cross-chain swap', '20+ networks', '1–3 chains', 'Internal balance only'],
      ['Tokens', '10 000+ dynamic', 'Hundreds', 'Hundreds'],
      ['Email / KYC to swap', 'Not required', 'Not required', 'Required'],
      ['Fiat on-ramp', 'Ramp / Transak → wallet', 'Rare', 'Yes, custodial'],
      ['Prediction markets', 'Built-in', 'No', 'No'],
    ],
    faqEyebrow: 'FAQ',
    faqH: 'How GROM DEX works',
    faqItems: [
      ['Does GROM hold my funds?', 'No. GROM is a swap router. You sign in your wallet, tokens land in your address. We cannot freeze, seize, or rehypothecate your assets.'],
      ['Where does liquidity come from?', 'The meta-aggregator queries LiFi, CoWSwap, Squid, Paraswap, Kyber, Odos and Jupiter in parallel and shows the best quote. You see the full route before signing.'],
      ['Do I need KYC?', 'Not for on-chain swaps — connect a wallet and go. Fiat via Ramp/Transak follows the provider\'s rules, but crypto lands in your wallet directly.'],
      ['How is this different from Uniswap?', 'Uniswap is one DEX on EVM. GROM is a meta-aggregator: 20+ chains, native Solana/TON/Tron, 7 liquidity sources, prediction markets and fiat on-ramp in one interface.'],
      ['Which wallets?', 'Trust, MetaMask, Phantom, TON, TronLink, OKX, Coinbase, WalletConnect. No email.'],
      ['How do I buy crypto with a card?', 'Cash tab → Ramp or Transak. Crypto goes to your connected wallet — GROM is never in the custody chain.'],
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
  const css = `
    /* Landing injected blocks — unified spacing (PC + mobile) */
    #page-landing .gw-lp-chains,
    #page-landing .gw-lp-dex,
    #page-landing .gw-lp-cmp,
    #page-landing .gw-lp-faq {
      max-width: none; margin: 0; padding: 0; width: 100%;
    }

    .gw-lp-dex-hi {
      display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; align-items: stretch;
    }
    @media (max-width: 900px) { .gw-lp-dex-hi { grid-template-columns: repeat(2, 1fr); gap: 10px; } }
    @media (max-width: 420px) { .gw-lp-dex-hi { grid-template-columns: 1fr; } }

    .gw-lp-hi-card {
      padding: 18px 16px; border-radius: 16px; color: #e7eef8; height: 100%;
      background: linear-gradient(160deg, rgba(0,194,255,.06), rgba(110,141,255,.04) 60%, rgba(8,14,26,0)),
                  linear-gradient(180deg, rgba(11,18,32,.75), rgba(8,12,20,.55));
      border: 1px solid rgba(0,194,255,.18); position: relative; overflow: hidden;
      box-sizing: border-box;
    }
    .gw-lp-hi-card::after { content: ''; position: absolute; inset: -1px; border-radius: inherit; pointer-events: none;
      background: radial-gradient(90% 40% at 100% 0%, rgba(0,194,255,.22), transparent 55%); opacity: .6; }
    .gw-lp-hi-icon { font-size: 20px; margin-bottom: 6px; }
    .gw-lp-hi-h { margin: 0; font-size: 14px; font-weight: 800; color: #fff; letter-spacing: -0.01em; }
    .gw-lp-hi-p { margin: 4px 0 0; font-size: 12px; color: #cfdfee; line-height: 1.45; }

    /* Chain grid + powered-by ribbon (replaces old BTC ticker) */
    .gw-lp-chains {
      padding: 28px 22px 30px; border-radius: 20px; box-sizing: border-box;
      background: linear-gradient(180deg, rgba(11,18,32,.55), rgba(8,12,20,.35));
      border: 1px solid rgba(122,162,199,.14);
      margin-bottom: 6px;
    }
    @media (max-width: 768px) {
      .gw-lp-chains { padding: 22px 16px 24px; border-radius: 16px; margin-bottom: 8px; }
    }
    .gw-lp-chains-h {
      text-align: center; margin: 0 0 4px; font-size: clamp(18px, 4.5vw, 22px);
      font-weight: 900; color: #fff; letter-spacing: -0.01em; line-height: 1.2;
    }
    .gw-lp-chains-sub {
      text-align: center; margin: 0 0 18px; color: #98a8c0;
      font-size: clamp(11px, 2.8vw, 12.5px); letter-spacing: .04em; line-height: 1.4;
    }
    .gw-lp-chains-grid {
      display: grid; grid-template-columns: repeat(11, minmax(0, 1fr)); gap: 10px;
    }
    @media (max-width: 900px) { .gw-lp-chains-grid { grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 8px; } }
    @media (max-width: 480px) { .gw-lp-chains-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; } }

    .gw-lp-chain-cell {
      display: flex; flex-direction: column; align-items: center; gap: 5px;
      padding: 10px 4px; border-radius: 12px;
      background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.05);
      transition: transform .18s, border-color .18s, background .18s; min-width: 0;
    }
    .gw-lp-chain-cell:hover { transform: translateY(-2px); border-color: rgba(0,194,255,.32); background: rgba(255,255,255,.06); }
    .gw-lp-chain-cell .logo {
      width: 34px; height: 34px; border-radius: 50%; overflow: hidden;
      display: inline-flex; align-items: center; justify-content: center;
      background: rgba(255,255,255,.05); font-weight: 800; font-size: 11px; color: #e7eef8; flex-shrink: 0;
    }
    @media (max-width: 480px) { .gw-lp-chain-cell .logo { width: 30px; height: 30px; } }
    .gw-lp-chain-cell img { width: 100%; height: 100%; object-fit: cover; }
    .gw-lp-chain-cell .lbl {
      font-size: 10px; color: #cfdfee; font-weight: 700; letter-spacing: .02em;
      text-align: center; line-height: 1.2; word-break: break-word;
    }

    /* Aggregator ribbon — standalone card below chains */
    .gw-lp-agg {
      padding: clamp(18px, 4vw, 24px); border-radius: 20px; text-align: center;
      background: linear-gradient(180deg, rgba(11,18,32,.72), rgba(8,12,20,.55));
      border: 1px solid rgba(168,85,247,.18);
      box-sizing: border-box;
    }
    .gw-lp-agg-inline {
      margin-top: 18px; padding-top: 16px;
      border-top: 1px solid rgba(122,162,199,.12); text-align: center;
    }
    .gw-lp-agg-eyebrow {
      font-size: 10px; letter-spacing: .16em; text-transform: uppercase;
      font-weight: 800; color: #d8b4fe; margin-bottom: 10px;
    }
    .gw-lp-agg-line {
      display: flex; flex-wrap: wrap; justify-content: center; align-items: center;
      gap: 6px 8px;
    }
    .gw-lp-agg-tag {
      padding: 5px 10px; border-radius: 999px;
      background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.08);
      font-size: 11px; color: #cfdfee; font-weight: 700; white-space: nowrap;
    }
    @media (max-width: 480px) {
      .gw-lp-agg-tag { font-size: 10px; padding: 4px 8px; }
    }

    .gw-lp-cmp-card, .gw-lp-faq-card {
      padding: clamp(20px, 4vw, 32px); border-radius: 20px; color: #e7eef8;
      background: linear-gradient(180deg, rgba(11,18,32,.72), rgba(8,12,20,.55));
      border: 1px solid rgba(122,162,199,.18);
      backdrop-filter: blur(10px); box-sizing: border-box;
    }
    .gw-lp-eyebrow { display: inline-block; padding: 5px 12px; border-radius: 999px;
      background: rgba(0,194,255,.12); border: 1px solid rgba(0,194,255,.3);
      font-size: 10.5px; font-weight: 800; letter-spacing: .16em; text-transform: uppercase; color: #5dd5ff; }
    .gw-lp-h { margin: 14px 0 18px; font-size: clamp(22px, 5vw, 30px); font-weight: 900; letter-spacing: -0.01em; color: #fff; }
    .gw-lp-cmp-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .gw-lp-cmp-table th, .gw-lp-cmp-table td { padding: 10px 8px; text-align: left; vertical-align: top; }
    .gw-lp-cmp-table th { color: #98a8c0; font-weight: 800; font-size: 10.5px; letter-spacing: .08em; text-transform: uppercase; border-bottom: 1px solid rgba(255,255,255,.08); }
    .gw-lp-cmp-table th.grom { color: #00c2ff; }
    .gw-lp-cmp-table td { border-bottom: 1px solid rgba(255,255,255,.04); color: #cfdfee; }
    .gw-lp-cmp-table td.grom { color: #fff; font-weight: 700; }
    .gw-lp-cmp-table tr:last-child td { border-bottom: 0; }
    .gw-lp-cmp-wrapper { overflow-x: auto; -webkit-overflow-scrolling: touch; margin: 0 -4px; padding: 0 4px; }
    @media (max-width: 640px) { .gw-lp-cmp-table { font-size: 12px; min-width: 480px; } }

    .gw-lp-faq-list { display: flex; flex-direction: column; gap: 8px; margin-top: 6px; }
    .gw-lp-faq-item { padding: 14px 16px; border-radius: 14px; background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.06); cursor: pointer; transition: background .18s, border-color .18s; }
    .gw-lp-faq-item:hover { background: rgba(255,255,255,.06); border-color: rgba(0,194,255,.22); }
    .gw-lp-faq-q { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; font-weight: 800; font-size: 14px; color: #e7eef8; line-height: 1.35; }
    .gw-lp-faq-q .caret { color: #5dd5ff; font-size: 18px; transition: transform .2s; flex-shrink: 0; }
    .gw-lp-faq-item.open .gw-lp-faq-q .caret { transform: rotate(45deg); }
    .gw-lp-faq-a { max-height: 0; overflow: hidden; transition: max-height .3s; font-size: 13px; color: #cfdfee; line-height: 1.55; }
    .gw-lp-faq-item.open .gw-lp-faq-a { max-height: 420px; margin-top: 10px; }
  `;
  let s = document.getElementById('gw-lp-polish-css');
  if (!s) {
    s = document.createElement('style');
    s.id = 'gw-lp-polish-css';
    document.head.appendChild(s);
  }
  s.textContent = css;
}

/* DEX-focused landing extras (2026-07-09) — small i18n bundle covers 3 blocks. */
const GW_LP_DEX_TR = {
  ru: {
    hiEyebrow: 'DEX', hiH: 'Non-custodial. Cross-chain. Aggregated.',
    highlights: [
      ['🔐', 'Свои ключи', 'Ты подписываешь каждую сделку — GROM не хранит твои средства.'],
      ['🌐', '20+ сетей', 'Ethereum, Solana, BSC, Arbitrum, Polygon, Base, Optimism, Avalanche, Bitcoin, TON, Tron.'],
      ['⚡', 'Лучшая цена', 'Meta-aggregator ищет маршрут по 7 источникам ликвидности одновременно.'],
      ['🕶', 'Без email', 'Подключил кошелёк — уже торгуешь. Никакого KYC для swap\'ов.'],
    ],
    chainsH: 'Все главные цепи в одной вкладке',
    chainsSub: '10 000+ токенов · динамический листинг · нативные транзакции',
    aggEyebrow: 'Работает поверх',
    aggLine: 'LiFi · CoWSwap · Squid · Paraswap · Kyber · Odos · Jupiter · THORchain',
  },
  en: {
    hiEyebrow: 'DEX', hiH: 'Non-custodial. Cross-chain. Aggregated.',
    highlights: [
      ['🔐', 'Your keys', 'You sign every trade — GROM never holds your funds.'],
      ['🌐', '20+ networks', 'Ethereum, Solana, BSC, Arbitrum, Polygon, Base, Optimism, Avalanche, Bitcoin, TON, Tron.'],
      ['⚡', 'Best price always', 'Meta-aggregator queries 7 liquidity sources in parallel — you pay the tightest quote.'],
      ['🕶', 'No email needed', 'Connect a wallet and trade. Zero KYC for on-chain swaps.'],
    ],
    chainsH: 'All the major chains in one tab',
    chainsSub: '10 000+ tokens · dynamic listing · native transactions',
    aggEyebrow: 'Powered by',
    aggLine: 'LiFi · CoWSwap · Squid · Paraswap · Kyber · Odos · Jupiter · THORchain',
  },
};
function gwLpDexLang() { let l='en'; try { const s=localStorage.getItem('grom_lang'); if (s&&GW_LP_DEX_TR[s]) l=s; } catch (_) {} return GW_LP_DEX_TR[l]||GW_LP_DEX_TR.en; }

const GW_LP_CHAINS = [
  { sym: 'ETH',  name: 'Ethereum', logo: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png' },
  { sym: 'SOL',  name: 'Solana',   logo: 'https://assets.coingecko.com/coins/images/4128/small/solana.png' },
  { sym: 'BNB',  name: 'BSC',      logo: 'https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png' },
  { sym: 'ARB',  name: 'Arbitrum', logo: 'https://assets.coingecko.com/coins/images/16547/small/photo_2023-03-29_21.47.00.jpeg' },
  { sym: 'MATIC',name: 'Polygon',  logo: 'https://assets.coingecko.com/coins/images/4713/small/polygon.png' },
  { sym: 'BASE', name: 'Base',     logo: 'https://raw.githubusercontent.com/base-org/brand-kit/main/logo/symbol/Base_Symbol_Blue.png' },
  { sym: 'OP',   name: 'Optimism', logo: 'https://assets.coingecko.com/coins/images/25244/small/Optimism.png' },
  { sym: 'AVAX', name: 'Avalanche',logo: 'https://assets.coingecko.com/coins/images/12559/small/Avalanche_Circle_RedWhite_Trans.png' },
  { sym: 'BTC',  name: 'Bitcoin',  logo: 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png' },
  { sym: 'TON',  name: 'TON',      logo: 'https://assets.coingecko.com/coins/images/17980/small/ton_symbol.png' },
  { sym: 'TRX',  name: 'Tron',     logo: 'https://assets.coingecko.com/coins/images/1094/small/tron-logo.png' },
];

function gwRenderLandingPolish() {
  const page = document.getElementById('page-landing');
  if (!page) return;
  gwInjectLpPolishCss();
  // remove old (for lang change)
  page.querySelector('.gw-lp-dex')?.remove();
  page.querySelector('.gw-lp-chains')?.remove();
  page.querySelector('.gw-lp-agg')?.remove();
  page.querySelector('.gw-lp-cmp')?.remove();
  page.querySelector('.gw-lp-faq')?.remove();
  document.getElementById('landingTicker')?.remove();

  const t = gwLpLang();
  const d = gwLpDexLang();

  // 1) DEX highlights row
  const dex = document.createElement('section');
  dex.className = 'gw-lp-dex';
  dex.innerHTML = `
    <div class="gw-lp-dex-hi">
      ${d.highlights.map(([ic, h, p]) => `
        <div class="gw-lp-hi-card">
          <div class="gw-lp-hi-icon">${ic}</div>
          <h3 class="gw-lp-hi-h">${h}</h3>
          <p class="gw-lp-hi-p">${p}</p>
        </div>
      `).join('')}
    </div>
  `;

  // 2) Chain grid (right after hero)
  const chains = document.createElement('section');
  chains.className = 'gw-lp-chains';
  chains.innerHTML = `
    <h2 class="gw-lp-chains-h">${d.chainsH}</h2>
    <p class="gw-lp-chains-sub">${d.chainsSub}</p>
    <div class="gw-lp-chains-grid">
      ${GW_LP_CHAINS.map((c) => `
        <div class="gw-lp-chain-cell" title="${c.name}">
          <div class="logo"><img src="${c.logo}" alt="${c.name}" loading="lazy" onerror="this.outerHTML='<span>${c.sym.slice(0,3)}</span>'"/></div>
          <div class="lbl">${c.name}</div>
        </div>
      `).join('')}
    </div>
  `;

  // 3) Powered-by aggregators — separate card below chains
  const agg = document.createElement('section');
  agg.className = 'gw-lp-agg';
  agg.innerHTML = `
    <div class="gw-lp-agg-eyebrow">${d.aggEyebrow}</div>
    <div class="gw-lp-agg-line">
      ${d.aggLine.split('·').map(s => `<span class="gw-lp-agg-tag">${s.trim()}</span>`).join('')}
    </div>
  `;

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

  // Insert into dedicated landing slots (2026-07-10 DEX pivot)
  const chainsHost = page.querySelector('#gwLandingChainsHost');
  const aggHost = page.querySelector('#gwLandingAggHost');
  const dexHiHost = page.querySelector('#gwLandingDexHiHost');
  const cmpHost = page.querySelector('#gwLandingCmpHost');
  const faqHost = page.querySelector('#gwLandingFaqHost');

  if (chainsHost) chainsHost.replaceChildren(chains);
  if (aggHost) aggHost.replaceChildren(agg);
  if (dexHiHost) dexHiHost.replaceChildren(dex);
  if (cmpHost) cmpHost.replaceChildren(cmp);
  if (faqHost) faqHost.replaceChildren(faq);

  // Fallback if slots missing
  if (!chainsHost || !cmpHost) {
    const finalCta = page.querySelector('.lp-final-cta');
    const wrap = page.querySelector('.lp-wrap') || page;
    if (finalCta && finalCta.parentNode === wrap) {
      if (!chainsHost) wrap.insertBefore(chains, finalCta);
      if (!dexHiHost) wrap.insertBefore(dex, finalCta);
      if (!cmpHost) wrap.insertBefore(cmp, finalCta);
      if (!faqHost) wrap.insertBefore(faq, finalCta);
    }
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
