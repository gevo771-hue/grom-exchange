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

/* ----- metadata для диалога подключения ----- */
const METADATA = {
  name: 'GROM Exchange',
  description: 'Trade spot, binary options, and futures on GROM.',
  url: location.origin,
  icons: [location.origin + '/assets/grom-brand-mark-clear.png']
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

/* ----- 1. MetaMask / injected (инъекция EIP-1193) ----- */
async function connectInjected() {
  const eth = window.ethereum;
  if (!eth) {
    window.open('https://metamask.io/download/', '_blank');
    throw new Error('MetaMask not installed — opened download page');
  }
  const accounts = await eth.request({ method: 'eth_requestAccounts' });
  if (!accounts?.length) throw new Error('User rejected');
  eth.on?.('accountsChanged', (accs) => updateChip(accs[0] || null));
  eth.on?.('chainChanged', (hex) => { currentChainId = parseInt(hex, 16); });
  updateChip(accounts[0]);
  return accounts[0];
}

/* ----- 2. OKX Wallet (отдельный injection window.okxwallet) ----- */
async function connectOkx() {
  const okx = window.okxwallet;
  if (!okx) {
    window.open('https://www.okx.com/web3', '_blank');
    throw new Error('OKX Wallet not installed');
  }
  const accounts = await okx.request({ method: 'eth_requestAccounts' });
  okx.on?.('accountsChanged', (accs) => updateChip(accs[0] || null));
  updateChip(accounts[0]);
  return accounts[0];
}

/* ----- 3. Coinbase Wallet (инъекция или SDK fallback) ----- */
async function connectCoinbase() {
  const cb = window.coinbaseWalletExtension || (window.ethereum?.isCoinbaseWallet ? window.ethereum : null);
  if (cb) {
    const accounts = await cb.request({ method: 'eth_requestAccounts' });
    cb.on?.('accountsChanged', (accs) => updateChip(accs[0] || null));
    updateChip(accounts[0]);
    return accounts[0];
  }
  // Fallback — Coinbase Wallet SDK (QR / universal link)
  const { CoinbaseWalletSDK } = await import('https://esm.sh/@coinbase/wallet-sdk@4.0.0');
  const sdk = new CoinbaseWalletSDK({ appName: 'GROM Exchange', appLogoUrl: METADATA.icons[0] });
  const provider = sdk.makeWeb3Provider({ options: 'all' });
  const accounts = await provider.request({ method: 'eth_requestAccounts' });
  provider.on?.('accountsChanged', (accs) => updateChip(accs[0] || null));
  updateChip(accounts[0]);
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
  updateChip(accs[0]);
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

/* ----- Роутер: перехватываем клики по cn-row кнопкам ----- */
function hook() {
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

  // Подменяем cnConnect (был мок)
  window.cnConnect = async function (name, kind) {
    try {
      if (kind === 'mm') await connectInjected();
      else if (kind === 'okx') await connectOkx();
      else if (kind === 'cb') await connectCoinbase();
      else if (kind === 'wc' || kind === 'ghost') await connectWC();
      else if (kind === 'gg') {
        openEmailFallback('Google');
        window.toast?.('Google OAuth is not connected yet. Continue with your Google email for now.', 'info');
      } else {
        await connectWC();
      }
    } catch (e) { failToast(e); }
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

/* ----- экспорт для отладки ----- */
window.gromWallet = {
  connectInjected, connectOkx, connectCoinbase, connectWC,
  connectEmail,
  disconnect, signSiwe,
  state: () => ({ account: currentAccount, chainId: currentChainId })
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', hook);
} else {
  hook();
}
