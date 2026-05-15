/**
 * GROM live layer — WebSocket prices, REST rounds/analytics, SIWE or dev JWT.
 * Expects same-origin nginx proxy to backend (/api, /auth, /ws).
 */
(function () {
  'use strict';

  var ws = null;
  var jwt = localStorage.getItem('grom_jwt') || '';

  function shortAddr(a) {
    if (!a) return 'Connect wallet';
    return a.slice(0, 6) + '…' + a.slice(-4);
  }

  function updateWalletLabel() {
    var el = document.getElementById('walletLabel');
    if (!el) return;
    if (!jwt) {
      el.textContent = 'Connect wallet';
      return;
    }
    try {
      var p = JSON.parse(atob(jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      el.textContent = shortAddr(p.addr);
    } catch (e) {
      el.textContent = 'Signed in';
    }
  }

  function api(path, opts) {
    opts = opts || {};
    var h = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
    if (jwt) h.Authorization = 'Bearer ' + jwt;
    return fetch(path, Object.assign({}, opts, { headers: h, credentials: 'same-origin' }));
  }

  function connectWs() {
    if (ws && ws.readyState === 1) return;
    var proto = location.protocol === 'https:' ? 'wss' : 'ws';
    var q = jwt ? ('?token=' + encodeURIComponent(jwt)) : '';
    ws = new WebSocket(proto + '://' + location.host + '/ws' + q);
    ws.onopen = function () {
      ws.send(JSON.stringify({
        type: 'subscribe',
        channels: [
          'price:BTC/USDT', 'price:ETH/USDT', 'price:SOL/USDT',
          'bo:round:new', 'bo:round:locked', 'bo:round:settled', 'bo:position:new'
        ]
      }));
    };
    ws.onmessage = function (ev) {
      var msg;
      try { msg = JSON.parse(ev.data); } catch (e) { return; }
      if (msg.type !== 'event' || !msg.channel) return;
      if (msg.channel.indexOf('price:') === 0 && msg.data && msg.data.price != null) {
        window.__gromFeed = true;
        var asset = msg.channel.slice('price:'.length);
        if (typeof window.__gromApplyWsTick === 'function') {
          window.__gromApplyWsTick(asset, msg.data.price);
        }
        if (typeof tickPrices === 'function') tickPrices();
      }
      if (msg.channel === 'bo:round:settled' || msg.channel === 'bo:round:locked' || msg.channel === 'bo:round:new') {
        refreshRoundsSoon();
      }
    };
    ws.onclose = function () {
      ws = null;
      setTimeout(connectWs, 3000);
    };
  }

  var roundTimer = null;
  function refreshRoundsSoon() {
    clearTimeout(roundTimer);
    roundTimer = setTimeout(fetchRounds, 400);
  }
  window.refreshRoundsSoon = refreshRoundsSoon;

  function fetchRounds() {
    var pair = (window.boState && window.boState.pair) || 'BTC/USDT';
    var sec = (window.boState && window.boState.expirySec) || 60;
    return api('/api/binary/rounds?asset=' + encodeURIComponent(pair))
      .then(function (r) { return r.json(); })
      .then(function (j) {
        var rows = j.rounds || [];
        var open = rows.filter(function (x) {
          return x.status === 'open' && Number(x.duration_sec) === Number(sec);
        });
        open.sort(function (a, b) { return new Date(a.close_at) - new Date(b.close_at); });
        var round = open[0];
        if (round && round.close_at) {
          window.__gromRoundCloseMs = new Date(round.close_at).getTime();
          window.__gromCurrentRoundId = round.id;
          if (typeof boState !== 'undefined' && round.strike_price != null) {
            boState.strike = Number(round.strike_price);
          }
        } else {
          window.__gromRoundCloseMs = null;
          window.__gromCurrentRoundId = null;
        }
        if (j.payout != null && window.boState) window.boState.payout = Number(j.payout);
        return round;
      })
      .catch(function () { return null; });
  }

  function fetchAnalytics() {
    var pair = (window.boState && window.boState.pair) || 'BTC/USDT';
    return api('/api/binary/analytics?asset=' + encodeURIComponent(pair))
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (j.insufficient) return;
        var rsiEl = document.getElementById('sigRsi');
        var macdEl = document.getElementById('sigMacd');
        if (rsiEl && j.rsi != null) rsiEl.textContent = j.rsi.toFixed(1);
        if (macdEl && j.macd && j.macd.histogram != null) {
          var h = j.macd.histogram;
          macdEl.textContent = (h >= 0 ? '+' : '') + h.toFixed(2);
          macdEl.className = 'v mono' + (h >= 0 ? ' up' : ' down');
        }
        if (j.signal && window.boState) {
          var up = j.signal.direction === 'up';
          var pct = document.getElementById('sigPct');
          var ver = document.getElementById('sigVerdict');
          if (pct) pct.textContent = Math.round((j.signal.probability || 0.5) * 100) + '%';
          if (ver) {
            ver.className = 'verdict ' + (up ? 'up' : 'down');
            ver.innerHTML = '<span class="arr">' + (up ? '▲' : '▼') + '</span>' + (up ? 'UP' : 'DOWN');
          }
        }
      })
      .catch(function () {});
  }

  function fetchConfig() {
    return api('/api/config')
      .then(function (r) { return r.json(); })
      .then(function (c) {
        if (c.payout != null && window.boState) window.boState.payout = Number(c.payout);
        window.__gromDevLogin = !!c.devLogin;
        return c;
      })
      .catch(function () { return {}; });
  }

  window.connectWallet = async function connectWallet() {
    if (window.ethereum) {
      try {
        var mod = await Promise.all([
          import('https://esm.sh/ethers@6.13.4'),
          import('https://esm.sh/siwe@2.3.2')
        ]);
        var BrowserProvider = mod[0].BrowserProvider;
        var SiweMessage = mod[1].SiweMessage;
        var provider = new BrowserProvider(window.ethereum);
        var signer = await provider.getSigner();
        var address = await signer.getAddress();
        var chainIdHex = await window.ethereum.request({ method: 'eth_chainId' });
        var chainId = parseInt(chainIdHex, 16);
        var nonceRes = await api('/auth/nonce', { method: 'POST', body: '{}' });
        var nonceJson = await nonceRes.json();
        if (!nonceRes.ok) throw new Error(nonceJson.error || 'nonce failed');
        var siweMsg = new SiweMessage({
          domain: nonceJson.domain,
          address: address,
          statement: nonceJson.statement,
          uri: window.location.origin,
          version: nonceJson.version || '1',
          chainId: chainId,
          nonce: nonceJson.nonce
        });
        var message = siweMsg.prepareMessage();
        var signature = await signer.signMessage(message);
        var v = await api('/auth/verify', { method: 'POST', body: JSON.stringify({ message: message, signature: signature }) });
        var out = await v.json();
        if (!v.ok) throw new Error(out.error || 'verify failed');
        jwt = out.token;
        localStorage.setItem('grom_jwt', jwt);
        updateWalletLabel();
        if (typeof toast === 'function') toast('Wallet connected', 'success');
        if (ws) { try { ws.close(); } catch (e) {} }
        connectWs();
      } catch (err) {
        if (typeof toast === 'function') toast(err.message || 'Wallet sign-in failed', 'error');
      }
      return;
    }
    var dev = await api('/health').then(function (r) { return r.json(); }).catch(function () { return {}; });
    if (dev.dev_login) {
      var dr = await api('/auth/dev-login', { method: 'POST', body: '{}' });
      var dj = await dr.json();
      if (!dr.ok) {
        if (typeof toast === 'function') toast(dj.error || 'Dev login failed', 'error');
        return;
      }
      jwt = dj.token;
      localStorage.setItem('grom_jwt', jwt);
      updateWalletLabel();
      if (typeof toast === 'function') toast('Demo session (dev wallet)', 'success');
      if (ws) { try { ws.close(); } catch (e) {} }
      connectWs();
      return;
    }
    if (typeof toast === 'function') toast('Install MetaMask or enable GROM_ALLOW_DEV_LOGIN=1 on server', 'error');
  };

  window.placeBinary = async function (dir) {
    var stake = +document.getElementById('boStake').value || 0;
    if (stake <= 0) {
      if (typeof toast === 'function') toast('Enter a stake greater than zero', 'error');
      return;
    }
    if (!jwt) {
      if (typeof window.gromPlaceBinaryDemo === 'function') {
        window.gromPlaceBinaryDemo(dir);
        return;
      }
      if (typeof toast === 'function') toast('Connect wallet first', 'error');
      return;
    }
    await fetchRounds();
    var rid = window.__gromCurrentRoundId;
    if (!rid) {
      if (typeof toast === 'function') toast('No open round for this expiry — try 30s / 1m / 5m (engine durations)', 'error');
      return;
    }
    var mode = (window.boState && window.boState.account === 'live') ? 'live' : 'demo';
    var body = {
      round_id: rid,
      direction: dir === 'UP' ? 'up' : 'down',
      stake: stake,
      mode: mode,
      asset: 'USDT'
    };
    try {
      var pr = await api('/api/binary/positions', { method: 'POST', body: JSON.stringify(body) });
      var pj = await pr.json();
      if (!pr.ok) throw new Error(pj.error || pj.message || 'Order rejected');
      if (typeof window.gromPlaySfx === 'function') {
        window.gromPlaySfx(dir === 'UP' ? 'bet_up' : 'bet_down');
      }
      if (window.boState) {
        window.boState.lastDeal = {
          dir: dir === 'UP' ? 'UP' : 'DOWN',
          asset: window.boState.pair || 'BTC/USDT',
          stake: stake,
          strike: Number(window.boState.strike || 0),
          remain: Math.max(1, Number(window.boState.expirySec || 60))
        };
      }
      if (typeof toast === 'function') {
        toast((dir === 'UP' ? 'UP' : 'DOWN') + ' · $' + stake.toFixed(2) + ' · round ' + (rid + '').slice(0, 8) + '…', 'success');
      }
      refreshRoundsSoon();
    } catch (e) {
      if (typeof toast === 'function') toast(e.message || 'Order failed', 'error');
      return;
    }
  };

  document.addEventListener('DOMContentLoaded', function () {
    updateWalletLabel();
    fetchConfig().then(function () {
      connectWs();
      fetchRounds();
      setInterval(fetchRounds, 2500);
      setInterval(fetchAnalytics, 8000);
      fetchAnalytics();
    });
  });
})();
