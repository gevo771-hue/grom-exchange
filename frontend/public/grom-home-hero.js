/* GROM home — "Live stories" hero (replaces the dashboard banner carousel).
 * Four short stories on live data: stock move of the day, BTC, prediction of the day, networks.
 * Everything is DOM/SVG (sharp at any resolution). Loaded only on the dashboard. */
(function () {
  'use strict';
  /* Note: #gromHomeHero (the mount) is also window.gromHomeHero via named access — use another global. */
  if (window.gromHomeStories) return;

  var API = '/api';
  var CHAIN_ICON = 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/';
  var MARK = '/assets/grom-brand-header-clear.webp';
  var BTC_ICON = 'https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63530be6e374711a8554f31b17e4cb92c25fa5/svg/color/btc.svg'; // vector: sharp at any size
  var STORY_MS = 6500;

  var I18N = {
    en: {
      eb_stocks: 'STOCKS 24/7', eb_crypto: 'CRYPTO MARKET', eb_pred: 'PREDICTION OF THE DAY', eb_nets: '17+ NETWORKS',
      stock_h: '{name} {chg} on the day',
      stock_p: '{n} tokenized stocks on 9 networks. Buy with any token in your wallet — even at night and on weekends.',
      stock_cta: 'Open stocks',
      btc_h: 'Bitcoin {price}',
      btc_p: '{chg} in 24h. Swap any token for any token — the route across 17+ networks is built in one click.',
      btc_cta: 'Swap now',
      pred_p: 'The market puts «{opt}» at {p}%. Buy “Yes” or “No” — the share price is the probability.',
      pred_p2: 'The market puts it at {p}%. Buy “Yes” or “No” — the share price is the probability.',
      pred_cta: 'See predictions', pred_vol: '24h volume {v}', chance: 'chance',
      nets_h: 'One wallet — every network',
      nets_p: 'Ethereum, BNB Chain, Solana, Arbitrum, Base, Robinhood Chain, HyperEVM, Monad and more. Your funds stay with you.',
      nets_cta: 'Connect wallet', nets_cta2: 'Make a swap',
      all: 'All markets', story: 'Story {i} of {n}', region: 'Market highlights',
    },
    ru: {
      eb_stocks: 'АКЦИИ 24/7', eb_crypto: 'КРИПТОРЫНОК', eb_pred: 'ПРОГНОЗ ДНЯ', eb_nets: '17+ СЕТЕЙ',
      stock_h: '{name} {chg} за день',
      stock_p: '{n} токенизированных акций в 9 сетях. Покупайте за любой токен из кошелька — даже ночью и в выходные.',
      stock_cta: 'Открыть акции',
      btc_h: 'Биткоин {price}',
      btc_p: '{chg} за 24 ч. Обменяйте любой токен на любой — маршрут через 17+ сетей собирается в один клик.',
      btc_cta: 'Сделать своп',
      pred_p: 'Рынок оценивает «{opt}» в {p}%. Покупайте «Да» или «Нет» — цена доли и есть вероятность.',
      pred_p2: 'Рынок оценивает шанс в {p}%. Покупайте «Да» или «Нет» — цена доли и есть вероятность.',
      pred_cta: 'Смотреть прогнозы', pred_vol: 'Объём за 24 ч {v}', chance: 'шанс',
      nets_h: 'Один кошелёк — все сети',
      nets_p: 'Ethereum, BNB Chain, Solana, Arbitrum, Base, Robinhood Chain, HyperEVM, Monad и другие. Средства всегда у вас.',
      nets_cta: 'Подключить кошелёк', nets_cta2: 'Сделать своп',
      all: 'Все рынки', story: 'История {i} из {n}', region: 'Главное на рынках',
    },
  };
  function lang() {
    var l = '';
    try { l = typeof window.getGromLang === 'function' ? window.getGromLang() : (localStorage.getItem('grom_lang') || ''); } catch (_) {}
    return l === 'ru' ? 'ru' : 'en';
  }
  function t(k, v) {
    var s = (I18N[lang()] || I18N.en)[k];
    if (s == null) s = I18N.en[k] == null ? k : I18N.en[k];
    if (v) Object.keys(v).forEach(function (x) { s = s.split('{' + x + '}').join(v[x]); });
    return s;
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function loc() { return lang() === 'ru' ? 'ru-RU' : 'en-US'; }
  function nf(n, d) { return Number(n).toLocaleString(loc(), { minimumFractionDigits: d, maximumFractionDigits: d }); }
  function px(n) { if (!(n > 0)) return '—'; return '$' + nf(n, n >= 1 ? 2 : (n >= 0.01 ? 4 : 6)); }
  function pct(c) { if (c == null || !isFinite(c)) return '—'; return (c > 0 ? '+' : '') + nf(c, 2) + '%'; }
  function usdS(v) { if (!(v > 0)) return '—'; if (v >= 1e9) return '$' + nf(v / 1e9, 1) + 'B'; if (v >= 1e6) return '$' + nf(v / 1e6, 1) + 'M'; if (v >= 1e3) return '$' + nf(v / 1e3, 0) + 'K'; return '$' + nf(v, 0); }
  function cls(c) { return c > 0 ? 'up' : (c < 0 ? 'dn' : ''); }
  function getJson(url, opts) {
    var ctl = typeof AbortController === 'function' ? new AbortController() : null;
    var tm = ctl ? setTimeout(function () { ctl.abort(); }, 12000) : 0;
    var o = Object.assign({ headers: { accept: 'application/json' } }, opts || {});
    if (ctl) o.signal = ctl.signal;
    return fetch(url, o).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .finally(function () { clearTimeout(tm); });
  }

  var D = { top: null, quotes: null, btc: null, pred: null, stockCount: 0, ts: 0 };
  var host = null, cur = 0, stories = [], timer = 0, paused = false, loading = null, refreshT = 0, bound = false;

  function load() {
    if (loading) return loading;
    var now = Date.now();
    var jobs = [
      getJson(API + '/market/stocks/top?n=12').then(function (j) { D.top = (j && j.items) || null; D.stockCount = (j && j.count) || D.stockCount; }).catch(function () {}),
      getJson(API + '/market/quotes').then(function (j) { D.quotes = j || null; }).catch(function () {}),
      getJson(API + '/futures/hl/info', {
        method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ type: 'candleSnapshot', req: { coin: 'BTC', interval: '1h', startTime: now - 24 * 3600e3, endTime: now } }),
      }).then(function (j) { D.btc = Array.isArray(j) ? j.map(function (c) { return Number(c.c); }).filter(function (x) { return x > 0; }) : null; }).catch(function () {}),
      getJson(API + '/market/predict?featured=1&lang=' + lang()).then(function (j) { D.pred = pickPrediction(j && j.markets); }).catch(function () {}),
    ];
    loading = Promise.all(jobs).then(function () { D.ts = Date.now(); loading = null; });
    return loading;
  }
  function pickPrediction(list) {
    if (!Array.isArray(list) || !list.length) return null;
    var ok = list.filter(function (m) { return m && m.q && m.rows && m.rows[0] && m.rows[0].p > 0 && m.rows[0].p < 100; });
    if (!ok.length) return null;
    var crypto = ok.filter(function (m) { return m.cat === 'crypto'; });
    var pool = crypto.length ? crypto : ok;
    pool.sort(function (a, b) { return (b.vol24 || 0) - (a.vol24 || 0); });
    var m = pool[0];
    return { q: m.q, p: Math.round(m.rows[0].p), opt: m.rows.length > 1 ? m.rows[0].n : '', vol: m.vol24 || m.vol || 0, ends: m.ends || '' };
  }

  /* ---------- visuals ---------- */
  function sparkPath(a, w, h) {
    var mn = Math.min.apply(0, a), mx = Math.max.apply(0, a), r = mx - mn || 1;
    return a.map(function (v, i) { return (i ? 'L' : 'M') + (i / (a.length - 1) * w).toFixed(1) + ',' + (h - 4 - (v - mn) / r * (h - 10)).toFixed(1); }).join(' ');
  }
  function treemap(el, items, hl) {
    var W = el.clientWidth, H = el.clientHeight;
    if (!W || !H) return;
    var R = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
    var it = items.map(function (x) { return { x: x, v: x.mc }; });
    function col(c) { var a = Math.min(1, Math.abs(c || 0) / 5); return c >= 0 ? 'rgba(34,' + (120 + Math.round(80 * a)) + ',86,' + (0.6 + 0.35 * a) + ')' : 'rgba(' + (170 + Math.round(70 * a)) + ',58,76,' + (0.6 + 0.35 * a) + ')'; }
    function lay(a, x, y, w, h) {
      if (!a.length) return;
      if (a.length === 1) { put(a[0], x, y, w, h); return; }
      var s = a.reduce(function (p, b) { return p + b.v; }, 0), acc = 0, i = 0;
      while (i < a.length - 1 && acc + a[i].v < s / 2) { acc += a[i].v; i++; }
      if (i === 0) { acc = a[0].v; i = 1; }
      var f = acc / s;
      if (w >= h) { lay(a.slice(0, i), x, y, w * f, h); lay(a.slice(i), x + w * f, y, w * (1 - f), h); }
      else { lay(a.slice(0, i), x, y, w, h * f); lay(a.slice(i), x, y + h * f, w, h * (1 - f)); }
    }
    function put(o, x, y, w, h) {
      var d = document.createElement('button');
      d.type = 'button';
      d.className = 't' + (o.x.s === hl ? ' hl' : '');
      d.setAttribute('data-sym', o.x.s);
      d.setAttribute('aria-label', (o.x.n || o.x.s) + ' ' + pct(o.x.c));
      // Tiles touching a corner of the map take the map's radius, so the white
      // highlight frame follows the rounded corner instead of being cut by it.
      var e = 0.5, rr = R + 'px', L = x < e, T = y < e, Rt = x + w > W - e, B = y + h > H - e;
      d.style.cssText = 'left:' + x + 'px;top:' + y + 'px;width:' + w + 'px;height:' + h + 'px;background:' + col(o.x.c)
        + (T && L ? ';border-top-left-radius:' + rr : '') + (T && Rt ? ';border-top-right-radius:' + rr : '')
        + (B && L ? ';border-bottom-left-radius:' + rr : '') + (B && Rt ? ';border-bottom-right-radius:' + rr : '');
      d.innerHTML = (w > 30 && h > 26 ? '<b>' + esc(o.x.s) + '</b><span>' + pct(o.x.c) + '</span>' : '');
      el.appendChild(d);
      fit(d);
    }
    // Labels never spill past a tile: compact first, then drop the change, then the ticker.
    function fit(d) {
      if (!d.firstChild) return;
      // flex-end pushes overflow upward, where scrollHeight can't see it — compare child boxes with the tile box.
      function over() {
        var r = d.getBoundingClientRect(), k = d.children;
        for (var i = 0; i < k.length; i++) {
          var c = k[i].getBoundingClientRect();
          if (c.top < r.top + 1 || c.left < r.left || c.right > r.right - 2 || c.bottom > r.bottom) return true;
        }
        return false;
      }
      if (over()) d.classList.add('sm');
      if (over() && d.clientWidth > d.clientHeight * 1.8) d.classList.add('row');
      if (over()) d.classList.add('xs');
      if (over()) { var sp = d.querySelector('span'); if (sp) sp.remove(); }
      if (over()) d.innerHTML = '';
    }
    el.innerHTML = '';
    lay(it, 0, 0, W, H);
  }
  function orbit() {
    var outer = ['ethereum', 'bsc', 'solana', 'arbitrum', 'base', 'robinhood', 'polygon', 'avalanche'], inner = ['optimism', 'hyperevm', 'monad', 'linea'];
    function ring(list, c) {
      return '<div class="ringo' + c + '">' + list.map(function (k, i) {
        var a = i / list.length * Math.PI * 2;
        return '<img src="' + CHAIN_ICON + k + '.svg" alt="" loading="lazy" style="left:calc(50% + ' + (Math.cos(a) * 50).toFixed(1) + '% - var(--ic)/2);top:calc(50% + ' + (Math.sin(a) * 50).toFixed(1) + '% - var(--ic)/2)">';
      }).join('') + '</div>';
    }
    return '<div class="orb">' + ring(outer, '') + ring(inner, ' i') + '<div class="c"><img src="' + MARK + '" alt="GROM"></div></div>';
  }

  /* ---------- stories ---------- */
  function build() {
    var out = [];
    var top = (D.top || []).filter(function (x) { return x && x.mc > 0 && isFinite(x.c); });
    if (top.length >= 4) {
      var mover = top.slice().sort(function (a, b) { return Math.abs(b.c) - Math.abs(a.c); })[0];
      out.push({
        id: 'stocks', eb: t('eb_stocks'), h: t('stock_h', { name: esc(mover.n || mover.s), chg: pct(mover.c) }),
        p: t('stock_p', { n: nf(D.stockCount || 1700, 0) }), cta: t('stock_cta'), go: 'xstocks',
        vis: function (r) {
          r.innerHTML = '<div class="tmap" role="group" aria-label="' + esc(t('eb_stocks')) + '"></div>';
          var el = r.querySelector('.tmap');
          var vw = window.innerWidth, list = top.slice(0, vw < 380 ? 6 : vw < 820 ? 8 : 12);
          if (list.indexOf(mover) < 0) list[list.length - 1] = mover; // the headline stock is always on the map
          treemap(el, list, mover.s);
        },
      });
    }
    var q = D.quotes || {};
    var btcSeries = D.btc && D.btc.length > 2 ? D.btc : null;
    var btcP = btcSeries ? btcSeries[btcSeries.length - 1] : (q.crypto && q.crypto.BTC);
    var btcC = btcSeries ? (btcSeries[btcSeries.length - 1] / btcSeries[0] - 1) * 100 : (q.cryptoChange24h && q.cryptoChange24h.BTC);
    if (btcP > 0) {
      out.push({
        id: 'btc', eb: t('eb_crypto'), h: t('btc_h', { price: px(btcP) }),
        p: t('btc_p', { chg: '<span class="' + cls(btcC) + '">' + pct(btcC) + '</span>' }), cta: t('btc_cta'), go: 'swap',
        vis: function (r) {
          var chips = ['ETH', 'SOL'].filter(function (s) { return q.crypto && q.crypto[s] > 0; }).map(function (s) {
            var c = q.cryptoChange24h && q.cryptoChange24h[s];
            return '<span>' + s + ' ' + px(q.crypto[s]) + ' <i class="' + cls(c) + '">' + pct(c) + '</i></span>';
          }).join('');
          var w = 400, h = 110;
          r.innerHTML = '<div class="pricev"><div class="ph"><img src="' + BTC_ICON + '" alt=""><b>BTC</b><span class="' + cls(btcC) + '">' + pct(btcC) + '</span></div>'
            + '<div class="big">' + px(btcP) + '</div>'
            + (btcSeries ? '<svg class="spk" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="ghhG" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="rgba(126,228,255,.35)"/><stop offset="1" stop-color="rgba(126,228,255,0)"/></linearGradient></defs><path d="' + sparkPath(btcSeries, w, h) + ' L' + w + ',' + h + ' L0,' + h + ' Z" fill="url(#ghhG)"/><path class="ln" d="' + sparkPath(btcSeries, w, h) + '" fill="none" stroke="#7ee4ff" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>' : '')
            + (chips ? '<div class="chips">' + chips + '</div>' : '') + '</div>';
        },
      });
    }
    var pr = D.pred;
    if (pr) {
      out.push({
        id: 'pred', eb: t('eb_pred'), h: esc(pr.q), p: pr.opt ? t('pred_p', { opt: esc(pr.opt), p: pr.p }) : t('pred_p2', { p: pr.p }), cta: t('pred_cta'), go: 'predict',
        vis: function (r) {
          r.innerHTML = '<div class="ringv"><div class="ring" style="--p:0"><span>' + pr.p + '%<small>' + esc(t('chance')) + '</small></span></div><div><div class="q">' + esc(pr.opt || pr.q) + '</div><div class="m">' + esc(t('pred_vol', { v: usdS(pr.vol) })) + (pr.ends ? ' · ' + esc(pr.ends) : '') + '</div></div></div>';
          var g = r.querySelector('.ring');
          requestAnimationFrame(function () { requestAnimationFrame(function () { if (g) g.style.setProperty('--p', pr.p); }); });
        },
      });
    }
    var connected = !!(window.GROM_CONN && window.GROM_CONN.connected);
    out.push({ id: 'nets', eb: t('eb_nets'), h: t('nets_h'), p: t('nets_p'), cta: connected ? t('nets_cta2') : t('nets_cta'), go: connected ? 'swap' : 'connect', vis: function (r) { r.innerHTML = orbit(); } });
    return out;
  }

  function goTo(where, sym) {
    try {
      if (where === 'connect') { if (typeof window.openConnectModal === 'function') { window.openConnectModal(); return; } where = 'swap'; }
      if (where === 'swap') {
        var sw = document.getElementById('gwDsWrap') || document.querySelector('#page-dashboard .gw-ds-wrap');
        if (sw) { sw.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
        where = 'markets';
      }
      if (where === 'xstocks' && sym) { try { sessionStorage.setItem('gwx_focus_sym', sym); } catch (_) {} }
      if (typeof window.show === 'function') window.show(where);
      else location.hash = where;
    } catch (_) {}
  }

  function paint(i, instant) {
    if (!host || !stories.length) return;
    cur = (i + stories.length) % stories.length;
    var s = stories[cur];
    var L = host.querySelector('.ghh-l'), R = host.querySelector('.ghh-r');
    var swap = function () {
      L.innerHTML = '<span class="eb"><i class="dot"></i>' + esc(s.eb) + '</span><h2>' + s.h + '</h2><p>' + s.p + '</p>'
        + '<div class="btns"><button type="button" class="cta" data-go="' + s.go + '">' + esc(s.cta) + ' <span aria-hidden="true">→</span></button><button type="button" class="ghost" data-go="markets">' + esc(t('all')) + '</button></div>';
      s.vis(R);
      L.classList.remove('fade'); R.classList.remove('fade');
    };
    if (instant) swap(); else { L.classList.add('fade'); R.classList.add('fade'); setTimeout(swap, 220); }
    host.querySelectorAll('.bars button').forEach(function (b, j) {
      b.className = j < cur ? 'done' : (j === cur ? 'run' : '');
      b.setAttribute('aria-current', j === cur ? 'true' : 'false');
      var f = b.querySelector('i'); f.style.animation = 'none'; void f.offsetWidth; f.style.animation = '';
    });
    host.style.setProperty('--ghh-ms', STORY_MS + 'ms');
  }
  function next() { paint(cur + 1); }

  function render() {
    if (!host) return;
    stories = build();
    host.innerHTML = '<section class="ghh" role="region" aria-roledescription="carousel" aria-label="' + esc(t('region')) + '">'
      + '<div class="bg" aria-hidden="true"></div><div class="grid" aria-hidden="true"></div>'
      + '<div class="ghh-l"></div><div class="ghh-r"></div>'
      + '<div class="bars">' + stories.map(function (_, i) { return '<button type="button" aria-label="' + esc(t('story', { i: i + 1, n: stories.length })) + '"><i></i></button>'; }).join('') + '</div></section>';
    var sec = host.querySelector('.ghh');
    sec.addEventListener('click', function (e) {
      var b = e.target.closest('[data-go]');
      if (b) { goTo(b.getAttribute('data-go')); return; }
      var tile = e.target.closest('.tmap .t');
      if (tile) { goTo('xstocks', tile.getAttribute('data-sym')); return; }
      var bar = e.target.closest('.bars button');
      if (bar) paint(Array.prototype.indexOf.call(bar.parentNode.children, bar));
    });
    sec.querySelector('.bars').addEventListener('animationend', function (e) {
      if (e.pseudoElement || e.animationName !== 'ghhTick') return;
      if (e.target && e.target.parentNode && e.target.parentNode.classList.contains('run')) next();
    });
    sec.addEventListener('mouseenter', function () { sec.classList.add('paused'); });
    sec.addEventListener('mouseleave', function () { sec.classList.remove('paused'); });
    /* swipe between stories on touch screens */
    var x0 = null, y0 = 0;
    sec.addEventListener('touchstart', function (e) { var p = e.touches[0]; x0 = p.clientX; y0 = p.clientY; }, { passive: true });
    sec.addEventListener('touchend', function (e) {
      if (x0 == null) return;
      var p = e.changedTouches[0], dx = p.clientX - x0, dy = p.clientY - y0; x0 = null;
      if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.4) paint(cur + (dx < 0 ? 1 : -1));
    }, { passive: true });
    paint(Math.min(cur, stories.length - 1), true);
  }

  function active() {
    var p = document.getElementById('page-dashboard');
    return !!(p && p.classList.contains('active') && host && document.body.contains(host));
  }
  function bindOnce() {
    if (bound) return; bound = true;
    document.addEventListener('visibilitychange', function () { if (host) host.classList.toggle('ghh-hidden', document.hidden); });
    window.addEventListener('grom:lang-change', function () { if (active()) { D.pred = null; load().then(render); } });
    ['grom:wallet-connected', 'grom:wallet-disconnected'].forEach(function (ev) { window.addEventListener(ev, function () { if (active()) render(); }); });
    var rz = 0;
    window.addEventListener('resize', function () { clearTimeout(rz); rz = setTimeout(function () { if (active() && stories[cur] && stories[cur].id === 'stocks') paint(cur, true); }, 200); });
    refreshT = setInterval(function () {
      if (!active() || document.hidden) return;
      load().then(function () { var keep = cur; stories = build(); if (keep >= stories.length) keep = 0; render(); paint(keep, true); });
    }, 90000);
  }

  function mount(el) {
    if (!el) return;
    host = el;
    host.classList.add('ghh-host');
    bindOnce();
    if (!host.querySelector('.ghh')) {
      /* Networks story right away, live stories as soon as data lands. */
      stories = build(); render();
    }
    if (!D.ts || Date.now() - D.ts > 60000) load().then(function () { if (host) render(); });
  }

  window.gromHomeStories = { mount: mount };
})();
