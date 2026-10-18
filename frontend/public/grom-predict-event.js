/* Read-only event exploration. Orders continue through the existing, explicit wallet flow. */
(function () {
  'use strict';
  let host, event, selected = 0, range = '1w', generation = 0, chartGeneration = 0, controller, chartController, returnFocus, returnY = 0;
  const copy = {
    ru: { back: 'Все события', loading: 'Загружаем событие…', unavailable: 'Не удалось загрузить событие.', retry: 'Повторить', outcomes: 'Все исходы', rules: 'Правила и источник', probability: 'Вероятность', history: 'История вероятности', empty: 'За этот период нет истории цен.', chartError: 'История цен временно недоступна.', total: 'Общий объём', day: 'Объём за 24ч', end: 'Завершение', closed: 'Торговля закрыта', yes: 'Да', no: 'Нет', share: 'Скопировать ссылку', copied: 'Ссылка скопирована', copyError: 'Не удалось скопировать ссылку', source: 'Источник разрешения', noRules: 'Правила для этого исхода не предоставлены.', choose: 'Выберите исход, чтобы посмотреть график и правила.', all: 'Всё', d: '1Д', w: '1Н', m: '1М', updated: 'Данные Polymarket', original: 'Открыть источник', noTrade: 'Недоступно', chartHint: 'История выбранного исхода · не гарантия результата' },
    en: { back: 'All events', loading: 'Loading event…', unavailable: 'Could not load this event.', retry: 'Retry', outcomes: 'All outcomes', rules: 'Rules and source', probability: 'Probability', history: 'Probability history', empty: 'No price history for this period.', chartError: 'Price history is temporarily unavailable.', total: 'Total volume', day: '24h volume', end: 'Ends', closed: 'Trading closed', yes: 'Yes', no: 'No', share: 'Copy link', copied: 'Link copied', copyError: 'Could not copy link', source: 'Resolution source', noRules: 'Rules were not provided for this outcome.', choose: 'Select an outcome to view its chart and rules.', all: 'All', d: '1D', w: '1W', m: '1M', updated: 'Polymarket data', original: 'View source', noTrade: 'Unavailable', chartHint: 'Selected outcome history · not a guarantee of results' }
  };
  function lang() { return document.documentElement.lang || 'en'; }
  function t(k) { return (copy[lang().startsWith('ru') ? 'ru' : 'en'])[k]; }
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const pct = n => n == null ? '—' : (n > 0 && n < 1 ? '<1' : n > 99 && n < 100 ? '>99' : Number(n.toFixed(1))) + '%';
  const money = n => n == null ? '—' : new Intl.NumberFormat(lang(), { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(n);
  function time(s) { return s ? new Date(s).toLocaleString(lang(), { dateStyle: 'medium', timeStyle: 'short' }) : '—'; }
  function safeUrl(v) { try { const u = new URL(v); return u.protocol === 'https:' ? u.href : ''; } catch (_) { return ''; } }
  function queryId() { const id = new URL(location.href).searchParams.get('event'); return /^[1-9][0-9]{0,19}$/.test(id || '') ? id : ''; }
  function setUrl(id, push) {
    const u = new URL(location.href);
    if (id) u.searchParams.set('event', id); else u.searchParams.delete('event');
    history[push ? 'pushState' : 'replaceState']({ ...history.state, gromPredictionDetail: !!push }, '', u);
  }
  function close(update = true) {
    ++generation; ++chartGeneration; controller?.abort(); chartController?.abort(); event = null;
    const wrap = document.querySelector('#page-predict .gwx-wrap');
    if (wrap) wrap.classList.remove('gwx-detail-open');
    if (host) host.hidden = true;
    if (update) setUrl('', false);
    if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
    window.scrollTo({ top: returnY, behavior: 'instant' });
  }
  function back() { if (history.state?.gromPredictionDetail) history.back(); else close(); }
  function shell() {
    const wrap = document.querySelector('#page-predict .gwx-wrap');
    if (!wrap) return false;
    host = wrap.querySelector('#gromPredictDetail');
    if (!host) { host = document.createElement('div'); host.id = 'gromPredictDetail'; wrap.appendChild(host); host.addEventListener('click', click); }
    host.hidden = false; wrap.classList.add('gwx-detail-open');
    return true;
  }
  const top = () => '<div class="gpe-nav"><button type="button" data-pe="back">← ' + t('back') + '</button><button type="button" data-pe="share">' + t('share') + '</button></div>';
  async function request(path, signal) {
    const r = await fetch('/api/market/predict/' + path, { signal, credentials: 'omit' });
    if (!r.ok) throw new Error('unavailable');
    return r.json();
  }
  async function open(id, push = true) {
    id = String(id).replace(/^pm_/, '');
    if (!/^[1-9][0-9]{0,19}$/.test(id)) return;
    const wasOpen = !!document.querySelector('.gwx-detail-open');
    if (!wasOpen) { returnFocus = document.activeElement; returnY = window.scrollY; }
    if (!shell()) return;
    const ticket = ++generation; ++chartGeneration; controller?.abort(); chartController?.abort(); controller = new AbortController();
    if (push) setUrl(id, true);
    host.dataset.event = id; host.dataset.lang = lang(); event = null;
    host.innerHTML = top() + '<div class="gpe-message" role="status">' + t('loading') + '</div>';
    host.scrollIntoView({ block: 'start' });
    try {
      const data = await request('event/' + id + '?lang=' + encodeURIComponent(lang().split('-')[0]), controller.signal);
      if (ticket !== generation || !host.isConnected) return;
      if (data.id !== id || !Array.isArray(data.rows)) throw new Error('invalid_event');
      event = data; selected = data.rows.reduce((best, r, i) => r.tradeable && (!data.rows[best]?.tradeable || r.p > data.rows[best].p) ? i : best, 0); range = '1w'; render();
      host.querySelector('h1')?.focus({ preventScroll: true });
    } catch (e) {
      if (ticket !== generation || e.name === 'AbortError') return;
      host.innerHTML = top() + '<div class="gpe-message" role="status">' + t('unavailable') + ' <button type="button" data-pe="retry">' + t('retry') + '</button></div>';
    }
  }
  function render() {
    const e = event;
    host.innerHTML = top()
      + '<header class="gpe-heading">' + (safeUrl(e.img) ? '<img src="' + esc(safeUrl(e.img)) + '" alt="" referrerpolicy="no-referrer">' : '')
      + '<div><div class="gpe-eyebrow">' + esc(e.tags.join(' · ')) + '</div><h1 tabindex="-1">' + esc(e.q) + '</h1></div></header>'
      + '<div class="gpe-metrics"><span>' + t('total') + ' <b>' + money(e.vol) + '</b></span><span>' + t('day') + ' <b>' + money(e.vol24) + '</b></span><span>' + t('end') + ' <b>' + esc(time(e.endsAt)) + '</b></span></div>'
      + '<section class="gpe-chart-panel" aria-label="' + t('history') + '"><div class="gpe-chart-head"><div><span id="gpeSelected"></span><strong id="gpePrice"></strong></div><div class="gpe-ranges">'
      + [['1d', 'd'], ['1w', 'w'], ['1m', 'm'], ['max', 'all']].map(([r, key]) => '<button type="button" data-range="' + r + '" aria-pressed="' + (r === range) + '">' + t(key) + '</button>').join('')
      + '</div></div><div id="gpeChart" aria-live="polite"></div><div class="gpe-chart-note">' + t('chartHint') + '</div></section>'
      + '<div class="gpe-body"><section class="gpe-outcomes"><h2>' + t('outcomes') + ' <small>' + e.rows.length + '</small></h2><p class="gpe-muted">' + t('choose') + '</p>'
      + e.rows.map((r, i) => '<div class="gpe-outcome gwx-card" data-q="' + esc(e.q) + '" data-ends-at="' + esc(r.endsAt) + '"><div class="gwx-oc" data-token-yes="' + esc(r.tokenYes) + '" data-token-no="' + esc(r.tokenNo) + '" data-tick="' + esc(r.tickSize) + '" data-neg-risk="' + (r.negRisk ? '1' : '0') + '">'
        + '<button type="button" class="gpe-select" data-select="' + i + '" aria-pressed="' + (i === selected) + '"><span class="gpe-selection-dot"></span><span>' + esc(r.n) + '<small>' + money(r.vol) + ' · ' + t('total') + '</small></span><b>' + pct(r.p) + '</b></button>'
        + '<div class="gpe-order-buttons">' + (r.tradeable ? ['yes', 'no'].map(side => '<button type="button" class="gwx-bet gwx-' + side + '" data-side="' + side + '" data-name="' + esc(r.n) + '" data-prob="' + (side === 'yes' ? r.p : r.pNo) + '">' + t(side) + ' <b>' + pct(side === 'yes' ? r.p : r.pNo) + '</b></button>').join('') : '<span class="gpe-muted">' + t(r.closed ? 'closed' : 'noTrade') + '</span>') + '</div></div></div>').join('')
      + '</section><aside class="gpe-rules"><h2>' + t('rules') + '</h2><div id="gpeRules"></div><div class="gpe-source">' + t('updated') + ' · ' + esc(time(e.fetchedAt)) + '</div>'
      + (/^[a-z0-9-]+$/.test(e.slug) ? '<a href="https://polymarket.com/event/' + esc(e.slug) + '" target="_blank" rel="noopener noreferrer">' + t('original') + ' ↗</a>' : '') + '</aside></div>';
    select(selected);
  }
  function select(i) {
    selected = i; const r = event?.rows[i]; if (!r) return;
    host.querySelectorAll('[data-select]').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.select) === i)));
    host.querySelector('#gpeSelected').textContent = r.n;
    host.querySelector('#gpePrice').textContent = pct(r.p);
    const source = safeUrl(r.resolutionSource || event.resolutionSource);
    host.querySelector('#gpeRules').innerHTML = '<h3>' + esc(r.question || r.n) + '</h3><p>' + esc(r.description || event.description || t('noRules')) + '</p>'
      + (source ? '<a href="' + esc(source) + '" target="_blank" rel="noopener noreferrer">' + t('source') + ' ↗</a>' : '');
    loadChart(r.tokenYes);
  }
  async function loadChart(token) {
    const ticket = ++chartGeneration, chart = host.querySelector('#gpeChart');
    chartController?.abort(); chartController = new AbortController();
    chart.innerHTML = '<div class="gpe-message">' + t('loading') + '</div>';
    if (!token) { chart.textContent = t('empty'); return; }
    try {
      const data = await request('history?token=' + encodeURIComponent(token) + '&range=' + range, chartController.signal);
      if (ticket !== chartGeneration || !chart.isConnected) return;
      draw(chart, data.history || []);
    } catch (e) { if (ticket === chartGeneration && e.name !== 'AbortError') chart.innerHTML = '<div class="gpe-message">' + t('chartError') + ' <button type="button" data-pe="chartRetry">' + t('retry') + '</button></div>'; }
  }
  function draw(chart, points) {
    if (points.length < 2) { chart.innerHTML = '<div class="gpe-message">' + t('empty') + '</div>'; return; }
    const start = points[0].t, duration = points[points.length - 1].t - start;
    if (!(duration > 0)) { chart.textContent = t('empty'); return; }
    const width = Math.max(280, Math.min(960, chart.clientWidth || 960)), height = width < 600 ? 210 : 250;
    const plotWidth = width - 60;
    const x = p => 8 + (p.t - start) / duration * plotWidth, y = p => height - 25 - p.p * (height - 40);
    const path = points.map((p, i) => (i ? 'L' : 'M') + x(p).toFixed(2) + ',' + y(p).toFixed(2)).join(' ');
    chart.innerHTML = '<svg viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="' + esc(t('history') + ': ' + event.rows[selected].n) + '">'
      + [0, .25, .5, .75, 1].map(p => '<path class="gpe-gridline" d="M8 ' + y({ p }) + 'H' + (width - 50) + '"/><text x="' + (width - 40) + '" y="' + (y({ p }) + 4) + '">' + p * 100 + '%</text>').join('')
      + '<path class="gpe-line" d="' + path + '"/><circle id="gpeCursor" r="5" fill="#88c0d0" cx="' + x(points[points.length - 1]) + '" cy="' + y(points[points.length - 1]) + '"/></svg>'
      + '<div class="gpe-chart-dates"><span>' + esc(time(start * 1000)) + '</span><output id="gpePoint"></output><span>' + esc(time(points[points.length - 1].t * 1000)) + '</span></div>';
    const svg = chart.querySelector('svg');
    svg.addEventListener('pointermove', ev => {
      const rect = svg.getBoundingClientRect(), target = start + Math.max(0, Math.min(1, ((ev.clientX - rect.left) / rect.width * width - 8) / plotWidth)) * duration;
      let closest = points[0]; for (const p of points) if (Math.abs(p.t - target) < Math.abs(closest.t - target)) closest = p;
      chart.querySelector('#gpeCursor').setAttribute('cx', x(closest)); chart.querySelector('#gpeCursor').setAttribute('cy', y(closest));
      chart.querySelector('#gpePoint').textContent = pct(closest.p * 100) + ' · ' + time(closest.t * 1000);
    });
  }
  async function click(e) {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.pe === 'back') { back(); return; }
    if (b.dataset.pe === 'retry') { open(host.dataset.event, false); return; }
    if (b.dataset.pe === 'chartRetry') { loadChart(event.rows[selected].tokenYes); return; }
    if (b.dataset.pe === 'share') {
      try { const u = new URL(location.href); u.searchParams.delete('_spa'); await navigator.clipboard.writeText(u.href); b.textContent = t('copied'); }
      catch (_) { b.textContent = t('copyError'); }
      return;
    }
    if (b.hasAttribute('data-select')) { select(Number(b.dataset.select)); return; }
    if (b.dataset.range) { range = b.dataset.range; host.querySelectorAll('[data-range]').forEach(el => el.setAttribute('aria-pressed', String(el.dataset.range === range))); loadChart(event.rows[selected].tokenYes); }
  }
  function sync() {
    const id = queryId(), page = document.getElementById('page-predict');
    if (!page?.classList.contains('active')) return;
    if (id && (!host?.isConnected || host.hidden || host.dataset.event !== id || host.dataset.lang !== lang())) open(id, false);
    else if (!id && document.querySelector('.gwx-detail-open')) close(false);
  }
  window.addEventListener('popstate', () => setTimeout(sync, 0));
  window.gromPredictEvent = { open, sync };
})();
