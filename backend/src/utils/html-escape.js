/**
 * HTML / URL sanitizers for untrusted token metadata (LI.FI, custom tokens).
 * Keep in sync with frontend/public/grom-dom-safe.js (window.GromDomSafe).
 */

const SAFE_SYM = /^[\p{L}\p{N}.$_+-]{1,32}$/u;

export function escHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function escAttr(value) {
  return escHtml(value).replace(/`/g, '&#96;');
}

/** Allow only https logos (http blocked; data/javascript blocked). */
export function safeLogoUrl(url) {
  const s = String(url || '').trim();
  if (!s) return '';
  try {
    const u = new URL(s);
    if (u.protocol !== 'https:') return '';
    return u.href;
  } catch {
    return '';
  }
}

export function safeTokenSymbol(sym) {
  const s = String(sym || '').trim().slice(0, 32);
  if (!s || !SAFE_SYM.test(s)) return '???';
  return s;
}

export function safeTokenName(name, fallbackSym = '') {
  const raw = String(name || fallbackSym || '').trim().slice(0, 64);
  if (!raw) return safeTokenSymbol(fallbackSym) || 'Token';
  /* Strip angle brackets / quotes that break attributes even after escape misuse */
  return raw.replace(/[<>"`]/g, '');
}
