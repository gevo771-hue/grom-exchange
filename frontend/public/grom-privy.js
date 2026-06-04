/* ==========================================================================
 * GROM · Privy integration (lightweight, REST-API-only)
 *
 * Не грузит Privy React SDK (тот имеет 200+ sub-imports и ломается через CDN).
 * Использует прямые fetch() на auth.privy.io — email OTP + Google OAuth (PKCE).
 *
 * Экспорт:
 *   window.privyLogin('email')  — показать форму email
 *   window.privyLogin('google') — popup Google OAuth (PKCE)
 *   window.privyLogout()
 * ========================================================================== */

const PRIVY_APP_ID = 'cmobpd4kh006e0cl5zuziu36v';
const API = 'https://auth.privy.io/api/v1';

/* ---------- state ---------- */
let pendingEmail = null;

const LS_KEY = 'grom:privy:session';

/* ---------- helpers ---------- */

function privyFetch(path, body) {
  return fetch(API + path, {
    method: 'POST',
    headers: {
      'privy-app-id': PRIVY_APP_ID,
      'privy-client': 'grom-web/1.0',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body || {})
  }).then(async r => {
    const text = await r.text();
    let json; try { json = JSON.parse(text); } catch { json = { raw: text }; }
    if (!r.ok) throw new Error(json.error || json.message || ('HTTP ' + r.status));
    return json;
  });
}

function saveSession(auth) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(auth)); } catch {}
}
function loadSession() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch { return null; }
}
function clearSession() { try { localStorage.removeItem(LS_KEY); } catch {} }

/* ---------- PKCE ---------- */
function b64url(arr) {
  let s = '';
  for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
async function makePkce() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const verifier = b64url(bytes);
  const hashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  const challenge = b64url(new Uint8Array(hashBuf));
  const state = b64url(crypto.getRandomValues(new Uint8Array(16)));
  return { verifier, challenge, state };
}

/* ---------- apply login ---------- */

function applyLogin(user, authJson) {
  const linked = user?.linked_accounts || [];
  const walletAccount = linked.find(a => a.type === 'wallet');
  const emailAccount  = linked.find(a => a.type === 'email');
  const googleAccount = linked.find(a => a.type === 'google_oauth');

  const addr  = walletAccount?.address;
  const email = emailAccount?.address || user?.email;
  const glog  = googleAccount?.email;
  const label = addr || email || glog || user?.id || 'Connected';

  const short = addr
    ? addr.slice(0, 6) + '…' + addr.slice(-4)
    : (label.length > 18 ? label.slice(0, 15) + '…' : label);

  window.setWalletLabel?.(short);
  if (window.GROM_CONN) {
    window.GROM_CONN.connected = true;
    window.GROM_CONN.label = label;
    window.GROM_CONN.method = addr ? 'wallet' : (email ? 'email' : 'social');
  }
  // Сохраняем для старого restoreAuthUi() — обратная совместимость чипа.
  // Любой явный логин снимает флаг "logged_out" (иначе следующий refresh не воскресит сессию)
  try {
    localStorage.removeItem('grom:logged_out');
    localStorage.setItem('grom_jwt', authJson.token || 'privy-session');
    localStorage.setItem('grom_wallet_label', label);
  } catch {}
  window.updateAuthUi?.();
  window.closeConnectModal?.();
  window.toast?.('Connected · ' + short, 'success');

  saveSession({ user, token: authJson.token, identity: authJson.identity_token });
}

/* ---------- EMAIL OTP flow ---------- */

async function sendEmailCode(email) {
  await privyFetch('/passwordless/init', { email });
}

async function verifyEmailCode(email, code) {
  const r = await privyFetch('/passwordless/authenticate', { email, code });
  return r;
}

/* Inline UI — показываем прямо внутри существующего connectModal */

function ensureInlineForm() {
  const modalBody = document.querySelector('#connectModal .wm-body');
  if (!modalBody) return null;

  let box = document.getElementById('privyInlineForm');
  if (box) return box;

  box = document.createElement('div');
  box.id = 'privyInlineForm';
  box.style.cssText = 'display:none;padding:8px 0';
  box.innerHTML = `
    <button type="button" id="pvBack" style="background:transparent;border:0;color:#9bb3c7;cursor:pointer;padding:4px 0;margin-bottom:10px">‹ Back</button>
    <div id="pvStep1">
      <div style="color:#cfe1f2;font-weight:600;margin-bottom:8px">Enter your email</div>
      <div style="display:flex;gap:8px">
        <input id="pvEmail" type="email" placeholder="you@email.com" autocomplete="email"
          style="flex:1;padding:10px 12px;border-radius:10px;background:rgba(11,18,32,.7);color:#e8f1fa;border:1px solid rgba(122,162,199,.25);outline:none"/>
        <button type="button" id="pvSend"
          style="padding:10px 16px;border-radius:10px;background:linear-gradient(180deg,#00c2ff,#0091c4);color:#00131c;font-weight:700;border:0;cursor:pointer">Send code</button>
      </div>
      <div id="pvErr" style="color:#ff7a7a;font-size:12px;margin-top:6px;display:none"></div>
    </div>
    <div id="pvStep2" style="display:none">
      <div style="color:#cfe1f2;font-weight:600;margin-bottom:8px">Enter the 6-digit code we sent to <span id="pvMail" style="color:#00c2ff"></span></div>
      <div style="display:flex;gap:8px">
        <input id="pvCode" inputmode="numeric" maxlength="6" placeholder="123456" autocomplete="one-time-code"
          style="flex:1;padding:10px 12px;border-radius:10px;background:rgba(11,18,32,.7);color:#e8f1fa;border:1px solid rgba(122,162,199,.25);outline:none;letter-spacing:4px;text-align:center;font-size:16px"/>
        <button type="button" id="pvVerify"
          style="padding:10px 16px;border-radius:10px;background:linear-gradient(180deg,#00c2ff,#0091c4);color:#00131c;font-weight:700;border:0;cursor:pointer">Verify</button>
      </div>
      <div id="pvErr2" style="color:#ff7a7a;font-size:12px;margin-top:6px;display:none"></div>
      <button type="button" id="pvResend" style="background:transparent;border:0;color:#9bb3c7;font-size:12px;cursor:pointer;margin-top:6px;padding:0">Resend code</button>
    </div>
    <div style="color:#8aa4b8;font-size:11px;margin-top:10px">Secured by Privy · non-custodial embedded wallet will be auto-created.</div>
  `;
  modalBody.appendChild(box);

  box.querySelector('#pvBack').onclick = () => showMainRows();
  box.querySelector('#pvSend').onclick = async () => {
    const email = box.querySelector('#pvEmail').value.trim();
    const err = box.querySelector('#pvErr');
    err.style.display = 'none';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { err.textContent = 'Invalid email'; err.style.display = 'block'; return; }
    try {
      box.querySelector('#pvSend').textContent = '...';
      await sendEmailCode(email);
      pendingEmail = email;
      box.querySelector('#pvStep1').style.display = 'none';
      box.querySelector('#pvStep2').style.display = '';
      box.querySelector('#pvMail').textContent = email;
      box.querySelector('#pvCode').focus();
    } catch (e) {
      err.textContent = e.message || 'Failed to send code';
      err.style.display = 'block';
    } finally {
      box.querySelector('#pvSend').textContent = 'Send code';
    }
  };
  box.querySelector('#pvVerify').onclick = async () => {
    const code = box.querySelector('#pvCode').value.trim();
    const err = box.querySelector('#pvErr2');
    err.style.display = 'none';
    if (!/^\d{6}$/.test(code)) { err.textContent = 'Enter the 6-digit code'; err.style.display = 'block'; return; }
    try {
      box.querySelector('#pvVerify').textContent = '...';
      const auth = await verifyEmailCode(pendingEmail, code);
      applyLogin(auth.user, auth);
      resetInlineForm();
      showMainRows();
    } catch (e) {
      err.textContent = e.message || 'Invalid code';
      err.style.display = 'block';
    } finally {
      box.querySelector('#pvVerify').textContent = 'Verify';
    }
  };
  box.querySelector('#pvResend').onclick = async () => {
    if (!pendingEmail) return;
    try { await sendEmailCode(pendingEmail); window.toast?.('Code resent', 'info'); } catch (e) { window.toast?.(e.message, 'error'); }
  };

  return box;
}

function showEmailForm() {
  const box = ensureInlineForm();
  if (!box) return;
  hideMainRows();
  box.style.display = '';
  box.querySelector('#pvStep1').style.display = '';
  box.querySelector('#pvStep2').style.display = 'none';
  setTimeout(() => box.querySelector('#pvEmail')?.focus(), 50);
}

function hideMainRows() {
  document.querySelectorAll('#connectModal .wm-body > button.cn-row').forEach(el => el.style.display = 'none');
  document.querySelectorAll('#connectModal .wm-body > .cn-div, #connectModal .wm-body > .cn-list, #connectModal .wm-body > .wm-note').forEach(el => el.style.display = 'none');
}

function showMainRows() {
  document.querySelectorAll('#connectModal .wm-body > button.cn-row').forEach(el => el.style.display = '');
  document.querySelectorAll('#connectModal .wm-body > .cn-div, #connectModal .wm-body > .cn-list, #connectModal .wm-body > .wm-note').forEach(el => el.style.display = '');
  const box = document.getElementById('privyInlineForm');
  if (box) box.style.display = 'none';
}

function resetInlineForm() {
  const box = document.getElementById('privyInlineForm');
  if (!box) return;
  box.querySelector('#pvEmail').value = '';
  box.querySelector('#pvCode').value = '';
  box.querySelector('#pvErr').style.display = 'none';
  box.querySelector('#pvErr2').style.display = 'none';
  pendingEmail = null;
}

/* ---------- OAuth PKCE flow (full-page redirect — устойчивее popup+postMessage) ---------- */

const PKCE_KEY = 'grom:privy:oauth-pkce';

async function oauthLogin(provider) {
  try {
    const pkce = await makePkce();

    const initRes = await privyFetch('/oauth/init', {
      provider,
      redirect_to: location.origin + '/oauth-callback.html',
      state_code: pkce.state,
      code_challenge: pkce.challenge,
      code_challenge_method: 'S256'
    });
    if (!initRes.url) throw new Error('No OAuth URL returned');

    // Сохраняем PKCE verifier + куда вернуться после успеха
    try {
      localStorage.setItem(PKCE_KEY, JSON.stringify({
        state: pkce.state,
        verifier: pkce.verifier,
        provider,
        returnTo: location.href,
        ts: Date.now()
      }));
    } catch (_) {}

    // Full-page redirect (вместо popup) — работает на mobile Safari,
    // не ломается от COOP, не требует window.opener.postMessage
    window.location.assign(initRes.url);
  } catch (e) {
    console.error('[grom-privy] oauth init failed', e);
    window.toast?.((provider === 'google' ? 'Google' : 'Social') + ' login failed: ' + (e.message || e), 'error');
  }
}

/* Завершение OAuth (вызывается из oauth-callback.html через fetch на auth.privy.io,
 * но мы экспортируем helper чтобы callback мог им пользоваться) */
async function finishOauth(state_code, authorization_code) {
  const saved = (() => {
    try { return JSON.parse(localStorage.getItem(PKCE_KEY) || 'null'); } catch { return null; }
  })();
  if (!saved) throw new Error('No saved PKCE state — начни логин заново');
  if (saved.state !== state_code) throw new Error('OAuth state mismatch — possible CSRF');
  if (!authorization_code) throw new Error('No authorization code');

  const auth = await privyFetch('/oauth/authenticate', {
    state_code,
    authorization_code,
    code_verifier: saved.verifier
  });
  localStorage.removeItem(PKCE_KEY);
  applyLogin(auth.user, auth);
  return { auth, returnTo: saved.returnTo };
}

window.privyFinishOauth = finishOauth;

/* ---------- Chip dropdown (Copy address / Disconnect) ---------- */

function ensureChipMenu() {
  let menu = document.getElementById('walletChipMenu');
  if (menu) return menu;
  menu = document.createElement('div');
  menu.id = 'walletChipMenu';
  menu.style.cssText = 'position:fixed;display:none;z-index:10000;background:#0f172a;border:1px solid rgba(122,162,199,.25);border-radius:12px;padding:6px;min-width:220px;box-shadow:0 18px 60px rgba(0,0,0,.6);font-family:inherit';
  menu.innerHTML = `
    <div id="pvChipAddr" style="padding:10px;color:#9bb3c7;font-size:12px;word-break:break-all;border-bottom:1px solid rgba(122,162,199,.15);margin-bottom:4px"></div>
    <button id="pvChipCopy" type="button" style="display:block;width:100%;text-align:left;padding:10px 12px;background:transparent;border:0;color:#e8f1fa;cursor:pointer;border-radius:8px;font:inherit">Copy address</button>
    <button id="pvChipDisc" type="button" style="display:block;width:100%;text-align:left;padding:10px 12px;background:transparent;border:0;color:#ff7a7a;cursor:pointer;border-radius:8px;font:inherit">Disconnect</button>
  `;
  document.body.appendChild(menu);

  const copyBtn = menu.querySelector('#pvChipCopy');
  copyBtn.onmouseenter = () => copyBtn.style.background = 'rgba(122,162,199,.1)';
  copyBtn.onmouseleave = () => copyBtn.style.background = 'transparent';
  copyBtn.onclick = async () => {
    const t = menu.querySelector('#pvChipAddr').textContent;
    try { await navigator.clipboard.writeText(t); window.toast?.('Copied', 'info'); } catch {}
    menu.style.display = 'none';
  };

  const discBtn = menu.querySelector('#pvChipDisc');
  discBtn.onmouseenter = () => discBtn.style.background = 'rgba(255,122,122,.1)';
  discBtn.onmouseleave = () => discBtn.style.background = 'transparent';
  discBtn.onclick = () => {
    menu.style.display = 'none';
    window.disconnectWallet?.();
  };

  document.addEventListener('click', (e) => {
    const chip = document.getElementById('walletChip');
    if (!menu.contains(e.target) && !(chip && chip.contains(e.target))) {
      menu.style.display = 'none';
    }
  });
  return menu;
}

function hookChipDropdown() {
  const chip = document.getElementById('walletChip');
  if (!chip || chip.dataset.pvHooked === '1') return;
  chip.dataset.pvHooked = '1';
  chip.addEventListener('click', (e) => {
    if (!window.GROM_CONN?.connected) return; // не перехватываем — пусть откроется connect modal
    e.preventDefault();
    e.stopImmediatePropagation();
    const menu = ensureChipMenu();
    const addr = window.GROM_CONN.label || '';
    menu.querySelector('#pvChipAddr').textContent = addr;
    const r = chip.getBoundingClientRect();
    menu.style.top = (r.bottom + 6) + 'px';
    menu.style.right = Math.max(8, (window.innerWidth - r.right)) + 'px';
    menu.style.left = 'auto';
    menu.style.display = 'block';
  }, true); // capture-phase, чтобы обогнать старый connectWallet обработчик
}

/* ---------- Public API ---------- */

window.privyLogin = async function privyLogin(method) {
  try {
    if (method === 'email') return showEmailForm();
    if (method === 'google' || method === 'farcaster' || method === 'apple') return oauthLogin(method);
    return showEmailForm();
  } catch (e) {
    console.error('[grom-privy] login error', e);
    window.toast?.('Login error: ' + (e.message || e), 'error');
  }
};

window.privyLogout = async function privyLogout() {
  clearSession();
  try { localStorage.removeItem('grom_jwt'); } catch {}
  try { localStorage.removeItem('grom_wallet_label'); } catch {}
  try { localStorage.removeItem('grom:privy:oauth-pkce'); } catch {}
  try { localStorage.setItem('grom:logged_out', '1'); } catch {}
  window.setWalletLabel?.('Connect wallet');
  if (window.GROM_CONN) { window.GROM_CONN.connected = false; window.GROM_CONN.label = ''; window.GROM_CONN.method = ''; }
  window.updateAuthUi?.();
};

/* Оборачиваем существующий disconnectWallet — чтобы "Logout" в хедере тоже чистил Privy */
(function wrapDisconnect() {
  const orig = window.disconnectWallet;
  window.disconnectWallet = function () {
    clearSession();
    try { localStorage.removeItem('grom:privy:oauth-pkce'); } catch {}
    try { localStorage.setItem('grom:logged_out', '1'); } catch {}
    if (typeof orig === 'function') {
      try { orig(); } catch (e) { console.warn('[grom-privy] orig disconnect threw', e); }
    } else {
      window.setWalletLabel?.('Connect wallet');
      if (window.GROM_CONN) { window.GROM_CONN.connected = false; window.GROM_CONN.label = ''; }
      window.updateAuthUi?.();
    }
  };
})();

/* ---------- Modal state recovery (MutationObserver) ----------
 *
 * Problem: every time showEmailForm() runs it calls hideMainRows() and shows our
 * inline form. If the user then closes the modal mid-flow (✕ click, ESC, backdrop),
 * the next time the modal is opened the main rows (Email / Google / wallets) are
 * STILL hidden and the inline form is STILL visible — so the user can only see
 * the email form and can't pick a different provider.
 *
 * Fix: watch #connectModal for class changes. Whenever it transitions to .open,
 * unconditionally restore the main rows and hide the inline form. This catches
 * every code path that opens the modal (button clicks, hash routing, programmatic),
 * regardless of whether the host page caches an older index.html with a buggy
 * openConnectModal(). It's a recovery hook, not a replacement.
 */
function installModalResetObserver() {
  const modal = document.getElementById('connectModal');
  if (!modal) return;
  let lastOpen = modal.classList.contains('open');
  const observer = new MutationObserver(() => {
    const isOpen = modal.classList.contains('open');
    if (isOpen && !lastOpen) {
      // Modal just opened — restore main rows + hide inline form.
      showMainRows();
      resetInlineForm();
    }
    lastOpen = isOpen;
  });
  observer.observe(modal, { attributes: true, attributeFilter: ['class'] });
  // Also reset immediately in case the modal was already open at boot.
  if (lastOpen) { showMainRows(); resetInlineForm(); }
}

/* ---------- Bootstrap (после DOMContentLoaded) ---------- */

function boot() {
  hookChipDropdown();
  installModalResetObserver();

  /* Auto-restore сессии: если у нас есть saved Privy session — применяем.
   * НО: если юзер явно вышел (флаг grom:logged_out), сначала чистим всё и не воскрешаем. */
  let loggedOut = false;
  try { loggedOut = localStorage.getItem('grom:logged_out') === '1'; } catch {}
  if (loggedOut) {
    clearSession();
    try { localStorage.removeItem('grom_jwt'); } catch {}
    try { localStorage.removeItem('grom_wallet_label'); } catch {}
  } else {
    const s = loadSession();
    if (s?.user) {
      try { applyLogin(s.user, s); } catch {}
    }
  }

  console.log('[grom-privy] lightweight REST-API client ready · app:', PRIVY_APP_ID.slice(0, 10) + '…');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
