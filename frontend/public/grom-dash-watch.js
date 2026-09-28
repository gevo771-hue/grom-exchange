var DASH_MS_CATS = [
  { id: 'crypto', i18n: 'ms_cat_crypto', emoji: '₿', tint: '#00d4ff' },
  { id: 'fx', i18n: 'ms_cat_fx', emoji: '¤', tint: '#9d6cf5' },
  { id: 'index', i18n: 'ms_cat_index', emoji: '∑', tint: '#f5b94d' },
  { id: 'etf', i18n: 'ms_cat_etf', emoji: '◈', tint: '#20d08a' }
];
var dashMsCat = 'crypto';
var DASH_MS_LIMIT = 12;
var DASH_MS_MOBILE_LIMIT = 9;
var DASH_WATCH_SYMS = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT', 'XRP/USDT', 'DOGE/USDT', 'LINK/USDT', 'AVAX/USDT', 'ADA/USDT', 'DOT/USDT', 'MATIC/USDT', 'LTC/USDT'];

function dashSymLabel(sym) {
  var it = typeof window.gromGetInstrument === 'function' ? window.gromGetInstrument(sym) : null;
  if (!it) return String(sym || '');
  if (it.type === 'crypto' || it.type === 'fx') return it.base + '/' + it.quote;
  return it.symbol;
}

function getDashWatchSymbols(cat) {
  var limit = dashMsMobile() ? DASH_MS_MOBILE_LIMIT : DASH_MS_LIMIT;
  if (typeof window.gromInstrumentsByType === 'function') {
    var list = window.gromInstrumentsByType(cat);
    if (list && list.length) return list.slice(0, limit).map(function (it) { return it.symbol; });
  }
  if (cat === 'crypto') return DASH_WATCH_SYMS.map(function (s) { return s.replace('/', ''); }).slice(0, limit);
  return [];
}

function dashWatchCryptoBase(sym) {
  return String(sym || '').toUpperCase().replace(/USDT$/, '').replace(/[^A-Z0-9]/g, '');
}

function dashWatchPriceSane(sym, px) {
  var n = Number(px);
  if (!Number.isFinite(n) || n <= 0) return false;
  var base = dashWatchCryptoBase(sym);
  var bands = {
    BTC: [1000, 500000], ETH: [50, 50000], BNB: [10, 2000], SOL: [1, 2000],
    XRP: [0.01, 50], ADA: [0.01, 20], DOGE: [0.00001, 5], AVAX: [1, 500],
    DOT: [0.5, 200], LINK: [0.5, 500], MATIC: [0.01, 20], LTC: [10, 2000]
  };
  var band = bands[base];
  if (!band) return n < 1e6;
  return n >= band[0] && n <= band[1];
}

function dashWatchResolvePx(sym) {
  var px = (typeof window.gromLivePrice === 'function') ? window.gromLivePrice(sym) : null;
  if (px == null || !Number.isFinite(px)) {
    try {
      var pfn = (typeof window.priceForPair === 'function') ? window.priceForPair
        : (typeof priceForPair === 'function' ? priceForPair : null);
      if (pfn) px = pfn(sym);
    } catch (_) { px = null; }
  }
  var base = dashWatchCryptoBase(sym);
  if (window.__gromLiveFeedActive && !dashWatchPriceSane(sym, px)) {
    if (typeof window.extraCryptoPrices !== 'undefined' && window.extraCryptoPrices && window.extraCryptoPrices[base] != null) {
      return window.extraCryptoPrices[base];
    }
    if (typeof extraCryptoPrices !== 'undefined' && extraCryptoPrices[base] != null) return extraCryptoPrices[base];
    return null;
  }
  if (!dashWatchPriceSane(sym, px)) return null;
  return px;
}

function dashWatchRowHtml(sym, idx) {
  var it = dashWatchInstrument(sym);
  var px = dashWatchResolvePx(sym);
  var chg = (typeof window.gromLiveChange === 'function') ? window.gromLiveChange(sym) : 0;
  if (!Number.isFinite(Number(chg))) chg = 0;
  var up = chg >= 0;
  var name = (it && it.name) || sym;
  var label = dashSymLabel(sym);
  var safeSym = String(sym).replace(/'/g, "\\'");
  return '<div class="dw-row" data-sym="' + sym + '" onclick="openSpotPair(\'' + safeSym + '\')">' +
    '<span class="dw-rank">' + (idx + 1) + '</span>' +
    dashWatchIcoHtml(sym) +
    '<div class="dw-info"><span class="dw-name">' + name + '</span><span class="dw-pair">' + label + '</span></div>' +
    '<div class="dw-spark">' + dashWatchSpark(up, sym) + '</div>' +
    '<div class="dw-price-col"><span class="dw-price mono" data-px>' + (px != null ? ('$' + marketFmt(px)) : '—') + '</span>' +
    '<span class="dw-chg ' + (up ? 'up' : 'down') + '" data-chg>' + (up ? '+' : '') + Number(chg).toFixed(2) + '%</span></div>' +
    '</div>';
}

function msCatLabel(cat) {
  var meta = DASH_MS_CATS.find(function (c) { return c.id === cat; }) || DASH_MS_CATS[0];
  return (typeof window.t === 'function') ? window.t(meta.i18n) : meta.i18n;
}

function dashWatchPanelHtml(cat) {
  var meta = DASH_MS_CATS.find(function (c) { return c.id === cat; }) || DASH_MS_CATS[0];
  var syms = getDashWatchSymbols(cat);
  if (!syms.length) {
    syms = cat === 'crypto' ? getDashWatchSymbols('crypto') : [];
  }
  return '<section class="ms-panel" data-ms-cat="' + cat + '" style="--ms-tint:' + meta.tint + '">' +
    '<div class="ms-panel-rows">' +
    (syms.length ? syms.map(function (sym, idx) { return dashWatchRowHtml(sym, idx); }).join('') :
      '<div style="padding:18px 12px;color:var(--silver5);font-size:12.5px;text-align:center">No markets in this category yet.</div>') +
    '</div></section>';
}

function syncMsDots() {
  var dots = document.getElementById('msDots');
  if (!dots) return;
  dots.querySelectorAll('span').forEach(function (d) {
    d.classList.toggle('active', d.dataset.msCat === dashMsCat);
  });
}

function dashWatchPanelShell(cat) {
  var meta = DASH_MS_CATS.find(function (c) { return c.id === cat; }) || DASH_MS_CATS[0];
  return '<section class="ms-panel" data-ms-cat="' + cat + '" data-ms-lazy="1" style="--ms-tint:' + meta.tint + '"><div class="ms-panel-rows"></div></section>';
}

function dashEnsureWatchPanel(cat) {
  if (window.GROM_SAFARI || dashMsMobile()) return;
  var carousel = document.getElementById('watchlist');
  if (!carousel) return;
  var panel = carousel.querySelector('.ms-panel[data-ms-cat="' + cat + '"]');
  if (!panel || panel.dataset.msLazy !== '1') return;
  panel.outerHTML = dashWatchPanelHtml(cat);
  if (typeof window.gromHydrateLogos === 'function') {
    var next = carousel.querySelector('.ms-panel[data-ms-cat="' + cat + '"]');
    if (next) window.gromHydrateLogos(next);
  }
}

function msGoToCat(catId, smooth) {
  var carousel = document.getElementById('watchlist');
  if (!carousel) return;
  dashEnsureWatchPanel(catId);
  var panel = carousel.querySelector('.ms-panel[data-ms-cat="' + catId + '"]');
  if (!panel) return;
  dashMsCat = catId;
  carousel.scrollTo({ left: panel.offsetLeft, behavior: smooth ? 'smooth' : 'auto' });
  syncMsDots();
}

function dashMsMobile() {
  try {
    return window.matchMedia('(max-width:760px)').matches
      || window.matchMedia('(hover:none) and (pointer:coarse)').matches;
  } catch (_) { return false; }
}

function startMsAutoRotate() {
  if (dashMsMobile() || window.GROM_STABLE_UI) return;
  if (window.__msAutoTimer) clearInterval(window.__msAutoTimer);
  window.__msAutoTimer = setInterval(function () {
    if (!document.getElementById('page-dashboard')?.classList.contains('active')) return;
    var idx = DASH_MS_CATS.findIndex(function (c) { return c.id === dashMsCat; });
    var next = DASH_MS_CATS[(idx + 1) % DASH_MS_CATS.length];
    msGoToCat(next.id, true);
  }, 10000);
}

function wireMsCarousel() {
  var carousel = document.getElementById('watchlist');
  if (!carousel) return;
  if (!carousel.__msScrollBound) {
    carousel.__msScrollBound = true;
    if (!window.GROM_SAFARI && !dashMsMobile() && !window.GROM_STABLE_UI) {
      carousel.addEventListener('scroll', function () {
        var panels = carousel.querySelectorAll('.ms-panel');
        if (!panels.length) return;
        var idx = 0;
        var minDist = Infinity;
        panels.forEach(function (panel, i) {
          var dist = Math.abs(panel.offsetLeft - carousel.scrollLeft);
          if (dist < minDist) { minDist = dist; idx = i; }
        });
        var cat = DASH_MS_CATS[idx];
        if (cat) {
          dashEnsureWatchPanel(cat.id);
          if (cat.id !== dashMsCat) {
            dashMsCat = cat.id;
            syncMsDots();
          }
        }
      }, { passive: true });
    }
    carousel.addEventListener('touchstart', function () {
      if (window.__msAutoTimer) clearInterval(window.__msAutoTimer);
      if (window.__msAutoResume) clearTimeout(window.__msAutoResume);
      if (!window.GROM_STABLE_UI && !dashMsMobile()) {
        window.__msAutoResume = setTimeout(startMsAutoRotate, 12000);
      }
    }, { passive: true });
  }
  var dots = document.getElementById('msDots');
  if (dots && !dots.__msClickBound) {
    dots.__msClickBound = true;
    dots.addEventListener('click', function (e) {
      var dot = e.target.closest('span[data-ms-cat]');
      if (!dot) return;
      msGoToCat(dot.dataset.msCat, true);
      if (window.__msAutoTimer) clearInterval(window.__msAutoTimer);
      if (window.__msAutoResume) clearTimeout(window.__msAutoResume);
      window.__msAutoResume = setTimeout(startMsAutoRotate, 12000);
    });
  }
  startMsAutoRotate();
}

function dashWatchInstrument(sym) {
  if (typeof window.gromGetInstrument === 'function') {
    var it = window.gromGetInstrument(sym);
    if (it) return it;
  }
  var meta = pairMeta(sym);
  if (meta) {
    return { sym: sym, base: sym.split('/')[0], name: meta.name, coin: meta.coin, logo: null };
  }
  return { sym: sym, base: sym.split('/')[0], name: sym };
}

function dashWatchIcoHtml(sym) {
  var p = dashWatchInstrument(sym);
  if (typeof instrumentIcoHtmlLive === 'function') return instrumentIcoHtmlLive(p);
  var meta = pairMeta(sym) || {};
  return '<span class="coin-ico ' + (meta.coin || '') + '">' + (meta.gliph || sym.charAt(0)) + '</span>';
}

function dashWatchSpark(up, sym) {
  var seed = 0;
  String(sym || '').split('').forEach(function (c, i) { seed += c.charCodeAt(0) * (i + 1); });
  var pts = [];
  for (var i = 0; i < 20; i++) {
    var wobble = Math.sin((seed + i) * 0.41) * 3.2 + (up ? i * 0.08 : -i * 0.05);
    pts.push(10 + wobble + Math.cos(i * 0.55 + seed) * 2);
  }
  var min = Math.min.apply(null, pts);
  var max = Math.max.apply(null, pts);
  var path = pts.map(function (v, i) {
    return (i === 0 ? 'M' : 'L') + ' ' + (i * 5) + ' ' + (20 - ((v - min) / (max - min || 1)) * 16);
  }).join(' ');
  return '<svg class="spark" viewBox="0 0 100 24" preserveAspectRatio="none" width="72" height="22"><path d="' + path + '" fill="none" stroke="' + (up ? '#22c17c' : '#e8576b') + '" stroke-width="1.5"/></svg>';
}

function renderDashboardWatchlist() {
  var host = document.getElementById('watchlist');
  if (!host) return;
  if (host.__dashWlMounted && host.querySelector('.ms-panel')) {
    if (typeof updateDashboardWatchlistPrices === 'function') updateDashboardWatchlistPrices();
    return;
  }
  host.__dashWlMounted = true;
  var dots = document.getElementById('msDots');
  if (dots) {
    dots.innerHTML = DASH_MS_CATS.map(function (c) {
      return '<span data-ms-cat="' + c.id + '" title="' + msCatLabel(c.id) + '"></span>';
  }).join('');
}
  host.className = 'ms-carousel';
  var preAllPanels = window.GROM_SAFARI || dashMsMobile();
  host.innerHTML = DASH_MS_CATS.map(function (c) {
    return preAllPanels ? dashWatchPanelHtml(c.id) : (c.id === dashMsCat ? dashWatchPanelHtml(c.id) : dashWatchPanelShell(c.id));
  }).join('');
  wireMsCarousel();
  if (!window.GROM_SAFARI && !dashMsMobile() && typeof window.gromHydrateLogos === 'function') {
    window.gromHydrateLogos(host);
  }
  msGoToCat(dashMsCat, false);
}
window.renderDashboardWatchlist = renderDashboardWatchlist;

function wireDashBannerCarousel() {
  var carousel = document.getElementById('dashBanners');
  var dotsHost = document.getElementById('dashBannerDots');
  var wrap = document.getElementById('dashBannersWrap');
  if (!carousel) return;
  var banners = carousel.querySelectorAll('.dash-banner');
  if (!banners.length) return;

  function revealBanners() {
    document.documentElement.classList.add('grom-dash-ready');
    if (wrap) wrap.hidden = false;
  }

  function hideBanners() {
    document.documentElement.classList.remove('grom-dash-ready');
    if (wrap) wrap.hidden = true;
  }

  if (carousel.__dashWired) {
    /* Re-wire on route change — restore position + restart auto-slide on mobile. */
    try {
      var savedIdx = parseInt(sessionStorage.getItem('grom_dash_banner'), 10);
      if (Number.isFinite(savedIdx) && savedIdx >= 0 && savedIdx < banners.length) {
        var b = banners[savedIdx];
        carousel.scrollLeft = b ? b.offsetLeft : savedIdx * (carousel.clientWidth || 0);
      }
    } catch (_) {}
    revealBanners();
    syncBannerDotsNow();
    if (dashBannerMobile() || window.GROM_SAFARI) startDashBannerAuto();
    return;
  }
  carousel.__dashWired = true;
  if (dashBannerMobile()) {
    revealBanners();
  } else {
    hideBanners();
  }
  var dashBannerIdx = 0;
  try {
    var saved = parseInt(sessionStorage.getItem('grom_dash_banner'), 10);
    if (Number.isFinite(saved) && saved >= 0 && saved < banners.length) dashBannerIdx = saved;
  } catch (_) {}

  function markDashReady() { revealBanners(); }

  function persistBannerIdx(idx) {
    try { sessionStorage.setItem('grom_dash_banner', String(idx)); } catch (_) {}
  }

  function dashBannerMobile() {
    try {
      return window.matchMedia('(max-width:760px)').matches
        || window.matchMedia('(hover:none) and (pointer:coarse)').matches;
    } catch (_) { return false; }
  }

  function snapBanner(idx) {
    dashBannerIdx = ((idx % banners.length) + banners.length) % banners.length;
    var b = banners[dashBannerIdx];
    var left = b ? b.offsetLeft : dashBannerIdx * (carousel.clientWidth || 0);
    carousel.scrollLeft = left;
    persistBannerIdx(dashBannerIdx);
    syncBannerDots();
  }

  function goBanner(idx, smooth) {
    if (!banners.length) return;
    dashBannerIdx = ((idx % banners.length) + banners.length) % banners.length;
    var left = banners[dashBannerIdx].offsetLeft;
    var useSmooth = !!smooth && !dashBannerMobile();
    if (useSmooth && carousel.scrollTo) carousel.scrollTo({ left: left, behavior: 'smooth' });
    else carousel.scrollLeft = left;
    persistBannerIdx(dashBannerIdx);
    syncBannerDots();
  }

  var _bannerDotRaf = 0;
  function syncBannerDots() {
    if (_bannerDotRaf) return;
    _bannerDotRaf = requestAnimationFrame(function () {
      _bannerDotRaf = 0;
      syncBannerDotsNow();
    });
  }
  function syncBannerDotsNow() {
    var idx = 0;
    var minDist = Infinity;
    banners.forEach(function (b, i) {
      var dist = Math.abs(b.offsetLeft - carousel.scrollLeft);
      if (dist < minDist) { minDist = dist; idx = i; }
    });
    dashBannerIdx = idx;
    persistBannerIdx(idx);
    if (dotsHost) {
      if (!dotsHost.__built || dotsHost.children.length !== banners.length) {
        dotsHost.innerHTML = '';
        banners.forEach(function (_, i) {
          var d = document.createElement('span');
          d.setAttribute('role', 'button');
          d.setAttribute('aria-label', 'Banner ' + (i + 1));
          d.onclick = function (ev) {
            ev.preventDefault();
            ev.stopPropagation();
            pauseDashBannerAuto();
            goBanner(i, true);
          };
          dotsHost.appendChild(d);
        });
        dotsHost.__built = true;
        dotsHost.setAttribute('aria-hidden', 'false');
      }
      Array.prototype.forEach.call(dotsHost.children, function (el, i) {
        el.classList.toggle('active', i === idx);
      });
    }
  }

  function startDashBannerAuto() {
    if (window.__dashBannerAutoTimer) clearInterval(window.__dashBannerAutoTimer);
    var ms = 4000;
    window.__dashBannerAutoTimer = setInterval(function () {
      if (!document.getElementById('page-dashboard')?.classList.contains('active')) return;
      if (document.hidden) return;
      goBanner(dashBannerIdx + 1, !dashBannerMobile());
    }, ms);
  }

  function pauseDashBannerAuto() {
    if (window.__dashBannerAutoTimer) clearInterval(window.__dashBannerAutoTimer);
    window.__dashBannerAutoTimer = null;
    if (window.__dashBannerAutoResume) clearTimeout(window.__dashBannerAutoResume);
    window.__dashBannerAutoResume = setTimeout(startDashBannerAuto, dashBannerMobile() ? 12000 : 10000);
  }
  window.startDashBannerAuto = startDashBannerAuto;
  window.pauseDashBannerAuto = pauseDashBannerAuto;

    if (!carousel.__dashScrollBound) {
    carousel.__dashScrollBound = true;
    carousel.addEventListener('scroll', syncBannerDots, { passive: true });
    carousel.addEventListener('touchend', syncBannerDots, { passive: true });
    carousel.addEventListener('touchstart', pauseDashBannerAuto, { passive: true });
    carousel.addEventListener('wheel', function (e) {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      if (carousel.scrollWidth <= carousel.clientWidth + 2) return;
      e.preventDefault();
      carousel.scrollLeft += e.deltaY;
      pauseDashBannerAuto();
    }, { passive: false });
    var drag = { on: false, x: 0, left: 0, moved: false, pid: null };
    carousel.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'touch') return;
      if (e.button != null && e.button !== 0) return;
      drag.on = true; drag.moved = false; drag.x = e.clientX; drag.left = carousel.scrollLeft; drag.pid = e.pointerId;
      // Do NOT setPointerCapture here — it steals clicks from <a.dash-banner>
    });
    carousel.addEventListener('pointermove', function (e) {
      if (!drag.on) return;
      var dx = e.clientX - drag.x;
      if (!drag.moved && Math.abs(dx) > 12) {
        drag.moved = true;
        try { carousel.setPointerCapture(e.pointerId); } catch (_) {}
      }
      if (drag.moved) {
        carousel.scrollLeft = drag.left - dx;
        pauseDashBannerAuto();
      }
    });
    function endDrag(e) {
      if (!drag.on) return;
      var wasMoved = drag.moved;
      drag.on = false;
      try { if (drag.pid != null) carousel.releasePointerCapture(drag.pid); } catch (_) {}
      drag.pid = null;
      if (wasMoved) {
        e.preventDefault();
        syncBannerDots();
        goBanner(dashBannerIdx, true);
      }
    }
    carousel.addEventListener('pointerup', endDrag);
    carousel.addEventListener('pointercancel', endDrag);
    carousel.addEventListener('click', function (e) {
      if (drag.moved) {
        e.preventDefault();
        e.stopPropagation();
        drag.moved = false;
        return;
      }
      var a = e.target && e.target.closest ? e.target.closest('a.dash-banner') : null;
      if (!a) return;
      var go = a.getAttribute('data-banner-go');
      if (!go) return;
      e.preventDefault();
      pauseDashBannerAuto();
      try {
        if (typeof show === 'function') show(go);
        else location.hash = go;
      } catch (_) {
        try { location.hash = go; } catch (__) {}
      }
    }, true);
    carousel.addEventListener('mouseenter', function () {
      if (window.__dashBannerAutoTimer) clearInterval(window.__dashBannerAutoTimer);
    });
    carousel.addEventListener('mouseleave', function () {
      if (!dashBannerMobile()) startDashBannerAuto();
    });
  }

  if (!window.__dashMainScrollPause) {
    window.__dashMainScrollPause = true;
    var _dashScrollPauseT = 0;
    window.addEventListener('scroll', function () {
      if (!dashBannerMobile()) return;
      if (!document.getElementById('page-dashboard')?.classList.contains('active')) return;
      var now = Date.now();
      if (now - _dashScrollPauseT < 120) return;
      _dashScrollPauseT = now;
      pauseDashBannerAuto();
    }, { passive: true });
  }

  snapBanner(dashBannerIdx);
  if (typeof applyI18n === 'function') applyI18n();
  if (dashBannerMobile() || window.GROM_SAFARI) {
    markDashReady();
    syncBannerDotsNow();
    startDashBannerAuto();
  } else {
    requestAnimationFrame(function () {
      snapBanner(dashBannerIdx);
      requestAnimationFrame(function () {
        markDashReady();
        if (!window.__dashBannerAutoTimer) startDashBannerAuto();
      });
    });
  }
}
window.wireDashBannerCarousel = wireDashBannerCarousel;
if (!window.__dashPageshowBound) {
  window.__dashPageshowBound = true;
  /* Intentionally no pageshow re-wire — Safari bfcache restore already looked like a reload. */
}
(function bootDashBanners() {
  var route = document.documentElement.getAttribute('data-grom-route') || '';
  var onDash = route === 'dashboard' || document.getElementById('page-dashboard')?.classList.contains('active');
  if (onDash) wireDashBannerCarousel();
})();

window.addEventListener('grom-public-feed', function () {
  try {
    if (!document.getElementById('page-dashboard')?.classList.contains('active')) return;
    var host = document.getElementById('watchlist');
    if (!host) return;
    host.dataset.dashWlPxFrozen = '0';
    if (typeof updateDashboardWatchlistPrices === 'function') updateDashboardWatchlistPrices();
  } catch (_) {}
});

function updateDashboardWatchlistPrices() {
  var host = document.getElementById('watchlist');
  if (!host) return;
  if (!document.getElementById('page-dashboard')?.classList.contains('active')) return;
  var liveOk = !!(window.__gromLiveFeedActive && (Date.now() - (window.__gromLastLiveTick || 0) < 45000));
  if (window.GROM_SAFARI || dashMsMobile()) {
    if (host.dataset.dashWlPxFrozen === '1' && !liveOk) return;
    if (liveOk) host.dataset.dashWlPxFrozen = '1';
  }
  var now = Date.now();
  var minMs = (window.GROM_SAFARI || dashMsMobile()) ? 3000 : 1500;
  if (window.__dashWlPxLast && (now - window.__dashWlPxLast) < minMs) return;
  window.__dashWlPxLast = now;
  var noFlash = dashMsMobile() || window.GROM_SAFARI;
  host.querySelectorAll('.dw-row').forEach(function (row) {
    var sym = row.dataset.sym;
    if (!sym) return;
    var px = dashWatchResolvePx(sym);
    var pxEl = row.querySelector('[data-px]');
    if (pxEl) {
      if (px == null) {
        pxEl.textContent = '—';
        return;
      }
      var prev = parseFloat(pxEl.dataset.prev || '0');
      pxEl.textContent = '$' + marketFmt(px);
      if (!noFlash && prev && Math.abs(prev - px) > 1e-9) {
        row.classList.remove('flash-up', 'flash-down');
        row.classList.add(px > prev ? 'flash-up' : 'flash-down');
        setTimeout(function () { row.classList.remove('flash-up', 'flash-down'); }, 550);
      }
      pxEl.dataset.prev = String(px);
    }
    var meta = pairMeta(sym);
    var chg = (typeof window.gromLiveChange === 'function') ? window.gromLiveChange(sym) : (meta ? meta.chg : 0);
    if (meta && meta.chg != null && (chg == null || !Number.isFinite(Number(chg)))) chg = meta.chg;
    if (chg != null && Number.isFinite(Number(chg))) {
      var chgEl = row.querySelector('[data-chg]');
      if (chgEl) {
        var up = Number(chg) >= 0;
        chgEl.textContent = (up ? '+' : '') + Number(chg).toFixed(2) + '%';
        chgEl.className = 'dw-chg ' + (up ? 'up' : 'down');
      }
      var sparkEl = row.querySelector('.dw-spark');
      if (sparkEl && !noFlash) sparkEl.innerHTML = dashWatchSpark(Number(chg) >= 0, sym);
    }
  });
}


function gromLogoKey(logoUrl, sym) {
  return String(logoUrl || sym || '').replace(/['"\\]/g, '');
}
// Ordered list of logo URLs to try for an instrument (most reliable first).
function gromLogoSources(sym, type, logoUrl) {
  var s = String(sym || '').toLowerCase().replace(/usdt$|usdc$/, '').replace(/[^a-z0-9]/g, '');
  var arr = [];
  if (type === 'crypto') {
    if (logoUrl) arr.push(logoUrl); // jsdelivr icon set (great for majors)
    arr.push('https://assets.coincap.io/assets/icons/' + s + '@2x.png');
  } else if (type === 'stock' || type === 'etf') {
    // Clearbit's free logo API was sunset, so try Financial Modeling Prep
    // (ticker-based, broad coverage incl. ADRs) first, Clearbit domain second.
    var t = String(sym || '').toUpperCase().replace(/\./g, '-');
    arr.push('https://financialmodelingprep.com/image-stock/' + t + '.png');
    if (logoUrl) arr.push(logoUrl);
  } else {
    if (logoUrl) arr.push(logoUrl); // fx / index flags etc.
  }
  return arr;
}
// Verify logos off-DOM with Image() and only inject an <img> once one has
// actually loaded — so a broken/loading logo never flashes over the monogram.
function gromHydrateLogos(root) {
  if (!window.__gromLogoOk) window.__gromLogoOk = Object.create(null);
  if (!window.__gromLogoBad) window.__gromLogoBad = Object.create(null);
  var scope = root || document;
  var nodes = scope.querySelectorAll('.coin-ico.has-logo[data-logo]');
  for (var k = 0; k < nodes.length; k++) {
    (function (span) {
      if (span.querySelector('img')) return;
      if (span.__gromHydrating) return;
      span.__gromHydrating = true;
      var url = span.getAttribute('data-logo');
      var type = span.getAttribute('data-ltype') || '';
      var sym = span.getAttribute('data-lsym') || '';
      var key = gromLogoKey(url, sym);
      var sources = gromLogoSources(sym, type, url);
      var i = 0;
      (function tryNext() {
        if (i >= sources.length) {
          window.__gromLogoBad[key] = 1;
          span.removeAttribute('data-logo');
          return;
        }
        var src = sources[i++];
        var probe = new Image();
        probe.onload = function () {
          if (!probe.naturalWidth) { tryNext(); return; }
          window.__gromLogoOk[key] = src;
          if (!span.querySelector('img')) {
            var im = document.createElement('img');
            im.alt = ''; im.decoding = 'async'; im.src = src;
            span.appendChild(im);
          }
          span.removeAttribute('data-logo');
        };
        probe.onerror = tryNext;
        probe.src = src;
      })();
    })(nodes[k]);
  }
}
window.gromHydrateLogos = gromHydrateLogos;
