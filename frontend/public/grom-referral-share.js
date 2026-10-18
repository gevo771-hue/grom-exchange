/* Public invite sharing only. Private statistics keep the existing authenticated flow. */
(function () {
  'use strict';
  const ru = () => (document.documentElement.lang || '').startsWith('ru');
  const tr = (a, b) => ru() ? a : b;
  function link() {
    const value = document.getElementById('refLink')?.textContent?.trim() || '';
    try { const u = new URL(value); return u.origin === location.origin && /^\/r\/[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{10}$/.test(u.pathname) && !u.search && !u.hash ? u.href : ''; } catch (_) { return ''; }
  }
  function open() {
    if (!link()) return;
    const dialog = document.getElementById('refShareDialog');
    dialog.querySelector('.ref-share-link').textContent = link();
    dialog.showModal();
  }
  async function nativeShare() {
    const url = link(); if (!url) return;
    if (!navigator.share) { window.copyRefLink(); return; }
    try { await navigator.share({ title: 'GROM Exchange', text: tr('Присоединяйтесь ко мне в GROM', 'Join me on GROM'), url }); }
    catch (e) { if (e.name !== 'AbortError') window.copyRefLink(); }
  }
  async function saveCard() {
    const url = link(); if (!url) return;
    const qr = document.querySelector('#refQr canvas');
    const img = document.querySelector('#refQr img');
    const data = qr ? qr.toDataURL('image/png') : img?.src;
    // Only embed a local QR; never fetch a private image or produce a poster with a fake QR.
    if (!data?.startsWith('data:image/png')) {
      const status = document.querySelector('#refShareStatus');
      status.textContent = tr('QR ещё не готов. Пока можно скопировать ссылку.', 'QR is not ready. You can copy the link.');
      return;
    }
    const code = document.getElementById('refCode').textContent.trim();
    if (!/^GROM-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{10}$/.test(code)) return;
    const title = tr('DeFi начинается', 'Your next move'), second = tr('с вашего кошелька.', 'starts in your wallet.');
    const subtitle = tr('Присоединяйтесь ко мне в GROM', 'Join me on GROM');
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080"><rect width="1080" height="1080" rx="36" fill="#202936"/><circle cx="950" cy="310" r="280" fill="none" stroke="#88c0d0" stroke-opacity=".17" stroke-width="2"/><circle cx="950" cy="310" r="210" fill="none" stroke="#88c0d0" stroke-opacity=".12" stroke-width="40"/><g fill="#e5edf5" font-family="system-ui,sans-serif"><text x="80" y="130" font-size="36" letter-spacing="10">GROM</text><text x="80" y="340" font-size="66" font-weight="700">' + title + '</text><text x="80" y="430" font-size="66" font-weight="700">' + second + '</text><text x="80" y="515" font-size="30" fill="#a8bdcf">' + subtitle + '</text><text x="80" y="840" font-size="28" fill="#a8d8e6">grom.exchange</text><text x="80" y="900" font-size="22" fill="#a8bdcf">' + code + '</text></g><rect x="748" y="728" width="252" height="252" rx="16" fill="white"/><image href="' + data + '" x="764" y="744" width="220" height="220"/></svg>';
    const source = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    try {
      const image = new Image();
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('image_timeout')), 5000);
        image.onload = () => { clearTimeout(timer); resolve(); };
        image.onerror = () => { clearTimeout(timer); reject(new Error('image_failed')); };
        image.src = source;
      });
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1080;
      canvas.getContext('2d').drawImage(image, 0, 0);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('image_failed');
      const download = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = download; a.download = 'grom-invite.png'; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(download), 30000);
    } catch (_) {
      document.querySelector('#refShareStatus').textContent = tr('Не удалось сохранить карточку. Можно скопировать ссылку.', 'Could not save the card. You can copy the link.');
    } finally { URL.revokeObjectURL(source); }
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-ref-share]'); if (!b) return;
    const action = b.dataset.refShare;
    if (action === 'open') open();
    if (action === 'native') nativeShare();
    if (action === 'save') saveCard();
    if (action === 'close') document.getElementById('refShareDialog').close();
  });
  ['grom:wallet-connected', 'grom:wallet-disconnected'].forEach(name => document.addEventListener(name, () => document.getElementById('refShareDialog')?.close()));
})();
