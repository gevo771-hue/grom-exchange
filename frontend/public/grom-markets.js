/* GROM Markets page — HL catalog renderer (restored after RE-CUT). */
(function () {
'use strict';
var MARKETS_PER_PAGE = 25;
/* Share cat/page/search with index.html — private copies desynced TradFi/HIP-3 pills. */
if (typeof window.marketsCat === 'undefined') window.marketsCat = 'all';
if (typeof window.marketsPage === 'undefined') window.marketsPage = 1;
if (typeof window.marketsSearchQ === 'undefined') window.marketsSearchQ = '';
var marketsFav = (typeof window.marketsFav !== 'undefined' && Array.isArray(window.marketsFav))
  ? window.marketsFav
  : (function () { try { return JSON.parse(localStorage.getItem('grom:fav') || '[]'); } catch (_) { return []; } })();
window.marketsFav = marketsFav;
function isFav(sym) { return Array.isArray(marketsFav) && marketsFav.indexOf(sym) >= 0; }
window.toggleFav = function toggleFav(sym) {
  var i = marketsFav.indexOf(sym);
  if (i >= 0) marketsFav.splice(i, 1); else marketsFav.push(sym);
  try { localStorage.setItem('grom:fav', JSON.stringify(marketsFav)); } catch (_) {}
  renderMarketsEnhanced();
};
function marketVolFmtLive(v) {
  var n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return '—';
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(Math.round(n));
}
function marketsPassHlCat(row, cat) {
  if (!cat || cat === 'all') return true;
  var catType = row.type || 'crypto';
  var chgAbs = Math.abs(Number(row.chg));
  if (!Number.isFinite(chgAbs)) chgAbs = 0;
  if (cat === 'crypto') return catType === 'crypto' || (!row.hip3 && !row.prelaunch && catType !== 'hip3' && catType !== 'prelaunch');
  if (cat === 'tradfi') return !!row.tradfi || catType === 'hip3';
  if (cat === 'hip3') return !!row.hip3 || catType === 'hip3';
  if (cat === 'prelaunch') return !!row.prelaunch || catType === 'prelaunch';
  // Softer than |chg|≥5 — otherwise Trending often looked empty.
  if (cat === 'trending') return (chgAbs >= 2) || (Number(row.rank) < 40 && Number(row.dayNtlVlm) > 0);
  return catType === cat;
}

function instrumentIcoHtmlLive(p) {
  if (!p) return '<span class="coin-ico">?</span>';
  if (!window.__gromIcoHtmlCache) window.__gromIcoHtmlCache = Object.create(null);
  if (!window.__gromLogoBad) window.__gromLogoBad = Object.create(null);
  if (!window.__gromLogoOk) window.__gromLogoOk = Object.create(null);
  var cacheKey = (p.sym || p.symbol || '') + '|' + (p.type || '') + '|' + (p.logo || '') + '|' + (p.glyph || '');
  if (p.logo && (p.type === 'crypto' || p.type === 'stock' || p.type === 'etf' || (p.type !== 'fx' && p.type !== 'commodity'))) {
    var lsym = p.base || p.symbol || p.sym || '?';
    var lt2 = lsym.slice(0, 3);
    var baseCls = (p.base || '').toLowerCase();
    var key2 = gromLogoKey(p.logo, lsym);
    // Failed before -> clean monogram, no network.
    if (window.__gromLogoBad[key2]) {
      return '<span class="coin-ico ' + baseCls + '">' + lt2 + '</span>';
    }
    // Known-good -> inject the verified (cached) image directly over the monogram.
    if (window.__gromLogoOk[key2]) {
      return '<span class="coin-ico has-logo ' + baseCls + '"><span class="cl">' + lt2 + '</span>'
        + '<img src="' + window.__gromLogoOk[key2] + '" alt="" decoding="async"/></span>';
    }
    // Unknown -> monogram now; gromHydrateLogos() verifies + injects the logo.
    return '<span class="coin-ico has-logo ' + baseCls + '" data-logo="' + p.logo + '" data-ltype="' + (p.type || '') + '" data-lsym="' + lsym + '"><span class="cl">' + lt2 + '</span></span>';
  }
  if (window.__gromIcoHtmlCache[cacheKey]) return window.__gromIcoHtmlCache[cacheKey];
  var html;
  if (p.type === 'fx' && p.logo && p.logoQuote) {
    html = '<span class="fx-pair-ico"><img class="fx-base" src="' + p.logo + '" alt="" decoding="async" loading="lazy"/><img class="fx-quote" src="' + p.logoQuote + '" alt="" decoding="async" loading="lazy"/></span>';
  } else if (p.type === 'commodity' && p.glyph) {
    html = '<span class="coin-ico no-bg" style="font-size:18px">' + p.glyph + '</span>';
  } else {
  var letters = (p.base || p.symbol || p.sym || '?').slice(0, 3);
    html = '<span class="coin-ico ' + ((p.base || '').toLowerCase()) + '">' + letters + '</span>';
  }
  window.__gromIcoHtmlCache[cacheKey] = html;
  return html;
}
window.openSpotPair = function openSpotPairLive(sym) {
  var deskSym = (typeof normalizeDeskPair === 'function') ? normalizeDeskPair(sym) : sym;
  if (typeof gromMarketOpensPerp === 'function' && gromMarketOpensPerp(deskSym) && window.futDeskState && futDeskState.tradeMode !== 'perp') {
    futDeskState.lastSpotPair = futDeskState.pair;
    futDeskState.tradeMode = 'perp';
    try { localStorage.setItem('grom_trade_mode', 'perp'); } catch (_) {}
  }
  try {
    if (typeof setActiveMarket === 'function') {
      // Markets rows always open the Trade desk (perp catalog).
      setActiveMarket(deskSym, { mode: 'perp', warn: true, clearSize: true, scrollChart: true });
    } else if (typeof setFuturesPair === 'function') {
      setFuturesPair(deskSym, { warn: true, clearSize: true, scrollChart: true });
    }
  } catch (_) {}
  if (typeof show === 'function') show('futures');
  toast('Opening ' + deskSym, 'info');
};
window.openInstrument = window.openSpotPair;
function getMarketRowsFromHlLive() {
  if (!window.__gromHlActive && !(window.__hlMarkets && window.__hlMarkets.length)) return null;
  var source = window.__hlMarkets || [];
  // Always perp catalog on Markets — ignore Trade Spot mode (that filter emptied TradFi/HIP-3).
  if (window.gromHL && typeof window.gromHL.filterListedMarkets === 'function') {
    source = window.gromHL.filterListedMarkets(source, { mode: 'perp' });
  } else {
    source = source.filter(function (m) { return m && !m.spot; });
  }
  if (!source.length) return null;
  return source.map(function (m, idx) {
    var sym = m.sym;
    var coin = m.coin || (sym ? String(sym).split('/')[0] : '');
    var px = (typeof priceForPair === 'function') ? Number(priceForPair(sym)) : 0;
    if (!(px > 0) && window.__hlMids && coin) px = Number(window.__hlMids[String(coin).toUpperCase()]) || 0;
    var chg = (typeof futuresChg24ForPair === 'function')
      ? Number(futuresChg24ForPair(sym, coin))
      : Number(m.chg24);
    if (!Number.isFinite(chg)) chg = 0;
    var volN = Number(m.dayNtlVlm);
    if (!(volN > 0) && window.__hlCtx && coin) {
      var ctx = window.__hlCtx[String(coin).toUpperCase()];
      if (ctx) volN = Number(ctx.dayNtlVlm) || 0;
    }
    var name = m.label
      || (window.gromHL && typeof window.gromHL.displayCoinLabel === 'function'
        ? window.gromHL.displayCoinLabel(coin)
        : (coin || sym));
    var type = m.type || (m.prelaunch ? 'prelaunch' : (m.hip3 ? 'hip3' : 'crypto'));
    var logoInfo = (typeof window.gromMarketLogoFor === 'function')
      ? window.gromMarketLogoFor(coin, type)
      : (function () {
          var base = String(coin || '');
          if (base.indexOf(':') >= 0) base = base.split(':').pop();
          base = base.replace(/-PERP$/i, '').trim();
          var logo = null;
          if (type === 'crypto' || type === 'prelaunch') {
            logo = 'https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63530be6e374711a8554f31b17e4cb92c25fa5/svg/color/' + base.toLowerCase() + '.svg';
          } else if (type === 'hip3' || type === 'tradfi') {
            logo = 'https://financialmodelingprep.com/image-stock/' + base.toUpperCase() + '.png';
          }
          return { base: base, logo: logo };
        })();
    return {
      sym: sym,
      name: name,
      type: type,
      coin: coin,
      base: logoInfo.base || String(coin || '').split(':').pop(),
      logo: logoInfo.logo || null,
      hip3: !!m.hip3,
      tradfi: !!m.tradfi || !!m.hip3,
      prelaunch: !!m.prelaunch,
      rank: m.rank != null ? m.rank : idx,
      dayNtlVlm: volN,
      price: px,
      chg: chg,
      vol: marketVolFmtLive(volN),
      maxLeverage: m.maxLeverage,
      glyph: String(name || coin || '?').slice(0, 1),
      fav: isFav(sym),
      fromHl: true,
    };
  });
}
function getMarketRowsFromRegistryLive() {
  var hl = getMarketRowsFromHlLive();
  if (hl) return hl;
  // Fallback before HL boots — crypto-only from registry (no FX/stocks/ETF).
  if (!Array.isArray(window.GROM_INSTRUMENTS) || !window.GROM_INSTRUMENTS.length) return null;
  return window.GROM_INSTRUMENTS.filter(function (it) {
    return !it.type || it.type === 'crypto';
  }).map(function (it) {
    var px = (typeof window.gromLivePrice === 'function') ? window.gromLivePrice(it.symbol) : null;
    if (px == null || !isFinite(px)) px = 0;
    var chg = (typeof window.gromLiveChange === 'function') ? window.gromLiveChange(it.symbol) : 0;
    return {
      sym: it.symbol, name: it.name, type: 'crypto', base: it.base, quote: it.quote,
      price: px, chg: chg, vol: '—',
      logo: it.logo, logoQuote: it.logoQuote, glyph: it.glyph, fav: isFav(it.symbol)
    };
  });
}
function getFilteredPairsLive() {
  var fromReg = getMarketRowsFromRegistryLive();
  var list = fromReg || [];
  var fHost = document.getElementById('marketsFilter');
  var fActive = fHost ? fHost.querySelector('button.active[data-filter]') : null;
  var fil = fActive ? fActive.dataset.filter : 'all';
  // Favorites are a cross-category view: show starred markets from every tab.
  if (fil !== 'favorites') {
    list = list.filter(function (p) { return marketsPassHlCat(p, window.marketsCat); });
  }
  if (window.marketsSearchQ) {
    var q = String(window.marketsSearchQ).toLowerCase();
    list = list.filter(function (p) {
      return (p.sym || '').toLowerCase().indexOf(q) >= 0
        || (p.name || '').toLowerCase().indexOf(q) >= 0
        || (p.coin || '').toLowerCase().indexOf(q) >= 0;
    });
  }
  if (fil === 'favorites') {
    list = list.filter(function (p) { return !!p.fav; });
  } else if (fil === 'gainers') {
    list = list.filter(function (p) { return Number(p.chg) > 0; }).sort(function (a, b) { return b.chg - a.chg; });
  } else if (fil === 'losers') {
    list = list.filter(function (p) { return Number(p.chg) < 0; }).sort(function (a, b) { return a.chg - b.chg; });
  } else if (window.marketsCat === 'trending') {
    list = list.slice().sort(function (a, b) {
      return Math.abs(Number(b.chg) || 0) - Math.abs(Number(a.chg) || 0);
    });
  }
  return list;
}
function updateMarketsLiveRows() {
  var el = document.getElementById('marketList');
  if (!el || !document.getElementById('page-markets')?.classList.contains('active')) return;
  if (!el.querySelector('.mkt-row[data-sym]')) {
    renderMarketsEnhanced();
    return;
  }
  el.querySelectorAll('.mkt-row[data-sym]').forEach(function (row) {
    var sym = row.dataset.sym;
    var coin = row.dataset.coin || '';
    if (!sym) return;
    var px = (typeof priceForPair === 'function') ? Number(priceForPair(sym)) : NaN;
    if (!(px > 0) && typeof window.gromLivePrice === 'function') px = Number(window.gromLivePrice(sym));
    if (!(px > 0)) px = 0;
    var chg = (typeof futuresChg24ForPair === 'function')
      ? Number(futuresChg24ForPair(sym, coin))
      : Number(typeof window.gromLiveChange === 'function' ? window.gromLiveChange(sym) : 0);
    if (!Number.isFinite(chg)) chg = 0;
    var pxEl = row.querySelector('[data-mkt-price]');
    if (pxEl) pxEl.textContent = '$' + marketFmt(px);
    var chgEl = row.querySelector('[data-mkt-chg]');
    if (chgEl) {
      chgEl.textContent = (chg >= 0 ? '+' : '') + (chg || 0).toFixed(2) + '%';
      chgEl.className = (chg >= 0 ? 'chg up' : 'chg down');
    }
    var volEl = row.querySelector('[data-mkt-vol]');
    if (volEl && row.dataset.vol) {
      var volN = Number(row.dataset.vol);
      if (volN > 0) volEl.textContent = '$' + marketVolFmtLive(volN);
    }
    var sparkEl = row.querySelector('[data-mkt-spark]');
    if (sparkEl) {
      var prev = Number(sparkEl.getAttribute('data-spark-chg'));
      if (!Number.isFinite(prev) || Math.abs(prev - chg) > 0.05) {
        sparkEl.setAttribute('data-spark-chg', String(chg));
        sparkEl.innerHTML = sparkFromChg(chg);
      }
    }
  });
}
function renderMarketsEnhanced() {
  var el = document.getElementById('marketList');
  if (!el) return;
  var rows = getFilteredPairsLive();
  var counter = document.getElementById('marketsCount');
  if (!rows.length) {
    var fActiveEmpty = document.querySelector('#marketsFilter button.active[data-filter]');
    var emptyMsg;
    if (fActiveEmpty && fActiveEmpty.dataset.filter === 'favorites') {
      emptyMsg = 'No favorites yet — tap the ★ on any market row to pin it here.';
    } else if (!window.__gromHlActive && !(window.__hlMarkets && window.__hlMarkets.length)) {
      emptyMsg = 'Loading Hyperliquid markets…';
    } else if (window.marketsCat === 'prelaunch') {
      emptyMsg = 'No pre-launch markets listed on Hyperliquid right now.';
    } else if (window.marketsCat === 'tradfi' || window.marketsCat === 'hip3') {
      emptyMsg = 'HIP-3 / TradFi markets still loading — try All, or reopen Markets in a moment.';
      try {
        if (window.gromHL && typeof window.gromHL.backfillHip3 === 'function') window.gromHL.backfillHip3();
      } catch (_) {}
    } else {
      emptyMsg = 'No markets match this filter.';
    }
    el.innerHTML = '<div class="mkt-row" style="grid-template-columns:1fr;padding:18px;color:var(--silver4)">' + emptyMsg + '</div>';
    if (counter) counter.innerHTML = '';
    return;
  }
  var totalPages = Math.max(1, Math.ceil(rows.length / MARKETS_PER_PAGE));
  if (window.marketsPage > totalPages) window.marketsPage = totalPages;
  if (window.marketsPage < 1) window.marketsPage = 1;
  var start = (window.marketsPage - 1) * MARKETS_PER_PAGE;
  var visible = rows.slice(start, start + MARKETS_PER_PAGE);
  el.innerHTML = visible.map(function (p) {
    var typeLbl = p.type ? String(p.type).toUpperCase() : 'CRYPTO';
    if (p.tradfi && typeLbl === 'HIP3') typeLbl = 'TRADFI';
    var lev = p.maxLeverage ? (' · ' + p.maxLeverage + '×') : '';
    var sparkHtml = sparkFromChg(p.chg);
    return '<div class="mkt-row" data-sym="' + p.sym + '" data-coin="' + (p.coin || '') + '" data-vol="' + (p.dayNtlVlm || '') + '" role="button" tabindex="0" onclick="openSpotPair(\'' + p.sym + '\')"><div class="star ' + (p.fav ? 'on' : '') + '" onclick="event.stopPropagation();toggleFav(\'' + p.sym + '\')">★</div><div class="name">' + instrumentIcoHtmlLive(p) + '<span class="pair-copy"><span class="pair-symbol">' + (p.name || p.sym) + '</span><span class="pair-meta">' + p.sym + ' · ' + typeLbl + lev + '</span></span></div><div class="mono" data-mkt-price style="text-align:right;color:var(--silver1);font-weight:600">$' + marketFmt(p.price) + '</div><div data-mkt-chg style="text-align:right" class="' + (p.chg >= 0 ? 'chg up' : 'chg down') + '">' + (p.chg >= 0 ? '+' : '') + (p.chg || 0).toFixed(2) + '%</div><div class="mono" data-mkt-vol style="text-align:right;color:var(--silver4)">$' + p.vol + '</div><div data-mkt-spark data-spark-chg="' + (p.chg || 0) + '">' + sparkHtml + '</div><button class="trade-btn" onclick="event.stopPropagation(); openSpotPair(\'' + p.sym + '\')">' + (typeof t === 'function' ? t('mkt_trade') : 'Trade') + '</button></div>';
  }).join('');
  requestAnimationFrame(function () {
    if (typeof gromHydrateLogos === 'function') gromHydrateLogos(el);
    else if (typeof window.gromHydrateLogos === 'function') window.gromHydrateLogos(el);
  });
  if (counter) {
    var maxBtns = 7;
    var startP = Math.max(1, window.marketsPage - 3);
    var endP = Math.min(totalPages, startP + maxBtns - 1);
    if (endP - startP < maxBtns - 1) startP = Math.max(1, endP - maxBtns + 1);
    var pageNums = []; for (var i = startP; i <= endP; i++) pageNums.push(i);
    var bs = 'background:rgba(37,45,58,.55);border:1px solid rgba(136,192,208,.18);color:var(--silver3);padding:6px 10px;border-radius:6px;cursor:pointer;font:inherit;font-size:12px;font-weight:600;min-width:32px';
    var as = 'background:linear-gradient(180deg,#00c2ff,#0091c4);color:#00131c;border-color:transparent';
    var html = '';
    var mp = window.marketsPage;
    html += '<button onclick="marketsGotoPage(1)" ' + (mp===1?'disabled':'') + ' style="' + bs + (mp===1?';opacity:.4;cursor:not-allowed':'') + '">«</button>';
    html += '<button onclick="marketsGotoPage(' + (mp-1) + ')" ' + (mp===1?'disabled':'') + ' style="' + bs + (mp===1?';opacity:.4;cursor:not-allowed':'') + '">‹</button>';
    pageNums.forEach(function (n) { html += '<button onclick="marketsGotoPage(' + n + ')" style="' + bs + (n===mp?';'+as:'') + '">' + n + '</button>'; });
    html += '<button onclick="marketsGotoPage(' + (mp+1) + ')" ' + (mp===totalPages?'disabled':'') + ' style="' + bs + (mp===totalPages?';opacity:.4;cursor:not-allowed':'') + '">›</button>';
    html += '<button onclick="marketsGotoPage(' + totalPages + ')" ' + (mp===totalPages?'disabled':'') + ' style="' + bs + (mp===totalPages?';opacity:.4;cursor:not-allowed':'') + '">»</button>';
    counter.style.cssText = 'padding:12px 14px;display:flex;flex-wrap:wrap;gap:6px;justify-content:center;align-items:center';
    counter.innerHTML = '<span style="color:var(--silver4);font-size:12px;margin-right:8px">' + (start+1) + '–' + Math.min(start+MARKETS_PER_PAGE, rows.length) + ' of ' + rows.length + '</span>' + html;
  }
}
window.marketsGotoPage = function marketsGotoPage(n) {
  window.marketsPage = n;
  renderMarketsEnhanced();
  var card = document.querySelector('#page-markets .card');
  if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
};
window.renderMarkets = renderMarketsEnhanced;
window.renderMarketsEnhanced = renderMarketsEnhanced;
window.updateMarketsLiveRows = updateMarketsLiveRows;
renderMarkets = renderMarketsEnhanced;

document.addEventListener('click', function (e) {
  var catBtn = e.target.closest('#page-markets .cat-pill[data-cat]');
  if (catBtn) {
    document.querySelectorAll('#page-markets .cat-pill').forEach(function (x) { x.classList.remove('active'); });
    catBtn.classList.add('active');
    window.marketsCat = catBtn.dataset.cat || 'all';
    window.marketsPage = 1;
    if (window.__marketsCatRaf) cancelAnimationFrame(window.__marketsCatRaf);
    window.__marketsCatRaf = requestAnimationFrame(function () {
      window.__marketsCatRaf = 0;
      renderMarketsEnhanced();
    });
    return;
  }
  var fBtn = e.target.closest('#marketsFilter button[data-filter]');
  if (fBtn) {
    document.querySelectorAll('#marketsFilter button[data-filter]').forEach(function (x) { x.classList.remove('active'); });
    fBtn.classList.add('active');
    window.marketsPage = 1;
    renderMarketsEnhanced();
  }
});
document.addEventListener('input', function (e) {
  if (e.target && e.target.id === 'marketsSearch') {
    window.marketsSearchQ = (e.target.value || '').trim();
    window.marketsPage = 1;
    renderMarketsEnhanced();
  }
});
setInterval(function () {
  if (document.getElementById('page-markets') && document.getElementById('page-markets').classList.contains('active')) {
    if (typeof updateMarketsLiveRows === 'function') updateMarketsLiveRows();
  }
}, 1500);

})();
