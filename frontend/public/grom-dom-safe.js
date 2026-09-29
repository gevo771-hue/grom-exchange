/**
 * Browser twin of backend/src/utils/html-escape.js — attach to window.GromDomSafe.
 * Loaded before grom-wallet.js when present; wallet falls back to local copies.
 */
(function (w) {
  'use strict';
  var SAFE_SYM = /^[\p{L}\p{N}.$_+-]{1,32}$/u;

  function escHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  function escAttr(value) {
    return escHtml(value).replace(/`/g, '&#96;');
  }
  function safeLogoUrl(url) {
    var s = String(url || '').trim();
    if (!s) return '';
    try {
      var u = new URL(s);
      if (u.protocol !== 'https:') return '';
      return u.href;
    } catch (e) {
      return '';
    }
  }
  function safeTokenSymbol(sym) {
    var s = String(sym || '').trim().slice(0, 32);
    if (!s || !SAFE_SYM.test(s)) return '???';
    return s;
  }
  function safeTokenName(name, fallbackSym) {
    var raw = String(name || fallbackSym || '').trim().slice(0, 64);
    if (!raw) return safeTokenSymbol(fallbackSym) || 'Token';
    return raw.replace(/[<>"`]/g, '');
  }

  w.GromDomSafe = {
    escHtml: escHtml,
    escAttr: escAttr,
    safeLogoUrl: safeLogoUrl,
    safeTokenSymbol: safeTokenSymbol,
    safeTokenName: safeTokenName,
  };
})(typeof window !== 'undefined' ? window : globalThis);
