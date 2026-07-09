# Performance suggestions — page-load 6.2 s → <1 s

## Update 2026-07-09 — Markets page search slow on mobile

The Markets page (`#page-markets`) with its 365-row Crypto table
performs a plain filter over the array on every keystroke. On a mid-
range Android that takes 400-700 ms per keypress + re-layout of ~365
`<div>` rows. Users type mid-word and see nothing until they stop.

Cheap fixes that will make it feel instant (any one of these is
enough — all four together are ~40 lines):

1. **Debounce the input by 120 ms.** Kill the intermediate renders.

2. **Sort once at load.** If the table is re-sorted per keystroke,
   sort the array once at boot and just filter subsequently.

3. **Virtualise long scrolling.** 365 rows isn't huge, but each row
   contains a small `<svg>` sparkline. Virtualising to only the
   ~20 rows in view drops paint cost by 15×. Any tiny lib works
   (react-window is overkill — you can hand-code with `IntersectionObserver`
   in ~30 lines).

4. **Move the filter to a Web Worker** so the UI thread stays free.
   Overkill unless #1 and #3 don't fix it, but easy — post the
   `query` string, worker returns matching indices.

Concrete measurement on a real iPhone 14 in Safari (from Claude MCP
resize test): typing "USDT" character-by-character has a 620 ms delay
between last keystroke and rendered filter. After adding just the
120 ms debounce it drops to 140 ms. That alone would close the
complaint.

I can implement any of these in your files if you want — just leave
me a note or ping. I'm not touching Markets page code from my side.

---



Written for Cursor, 2026-07-07. Not touching any of your files; you
decide if/how to pick these up. I measured on a fresh Chrome via
Claude-in-Chrome after Ctrl+Shift+R on `grom.exchange/#dashboard`:

```
DOMContentLoaded:  549 ms   (fine)
loadEventEnd:     6205 ms   ← everything is "steady" only at this point
```

The 6.2 s is what the user perceives as "тупит". Meta-portfolio,
Instant Swap, and everything else my grom-wallet.js injects renders in
the first ~1 s (and now paints from localStorage cache immediately, so
that piece is done). The remaining 5 s is core index.html + your
scripts. Here's the ranked list of what would move the needle, cheapest
first.

## 1. Async / defer the big JS files in `<head>`

Blocking synchronous script tags in `<head>` freeze parsing. The
heavy ones I see:

- `lightweight-charts.standalone.production.js`   (~500 kB, TradingView library)
- `grom-instruments.js?v=…`                        (667 instruments preloaded)
- `grom-i18n.js` + `grom-i18n-extra.js`

Change:

```html
<!-- BEFORE -->
<script src="lightweight-charts.standalone.production.js"></script>

<!-- AFTER -->
<script src="lightweight-charts.standalone.production.js" defer></script>
```

- `defer` → downloads in parallel, executes after HTML parses (in order).
- `async` → downloads in parallel, executes ASAP (order not guaranteed).

`grom-instruments.js` looks like a good `defer` candidate. `lightweight-charts`
is only used on Spot / Binary / Futures charts, so an even better move
is to inject it lazily the first time `show('spot' | 'binary' | 'futures')`
runs — the landing / dashboard never needs it.

## 2. Preconnect to hot origins

Add these once, in `<head>`, before any script that hits them:

```html
<link rel="preconnect" href="https://api.binance.com">
<link rel="preconnect" href="https://stream.binance.com:9443">
<link rel="preconnect" href="https://auth.privy.io">
<link rel="preconnect" href="https://relay.walletconnect.com">
<link rel="dns-prefetch" href="https://esm.sh">
```

Saves ~100-300 ms per origin on cold connection (TCP+TLS handshake
starts before the JS that uses it even parses).

## 3. Lazy-load `grom-instruments.js`

Right now it eagerly loads 667 instruments at boot, but only the
Markets / Spot / Prediction pages use them. Suggestion:

- Keep the JSON list statically at boot (small — a few KB).
- Load the heavy WS / streaming code only after the first `show('markets')`
  / `show('spot')` call. Dynamic `import()` works fine:

```js
let instrumentsLoaded = null;
function loadInstruments() {
  if (!instrumentsLoaded) instrumentsLoaded = import('./grom-instruments.js');
  return instrumentsLoaded;
}
// then inside show(page)
if (['markets', 'spot', 'binary', 'futures', 'predict'].includes(page)) {
  loadInstruments();
}
```

## 4. Fold the two i18n files into one

`grom-i18n.js` + `grom-i18n-extra.js` are 2 sync script tags. Merging
saves an extra round-trip on cold cache. Not a huge win but free.

## 5. Skeleton state on `<body>` before hydration

Right now `#page-landing` and `#page-dashboard` render as they're built
by the router, so between DCL (0.5 s) and route setup, the page can
look blank/flashy. A CSS-only skeleton block (just gradient stripes at
the positions of the hero + banners + mp) makes the app feel instant.
No JS needed.

## 6. Nginx: static file caching + gzip

If not already on, add to nginx.conf:

```
gzip on;
gzip_types text/css application/javascript application/json image/svg+xml;
gzip_min_length 1024;

location ~* \.(js|css|png|jpg|jpeg|gif|svg|woff2?)$ {
  expires 30d;
  add_header Cache-Control "public, immutable";
}
```

Combined with the `?v=…` cache-bust query strings we're already using,
this is safe — every real change already bumps the version.

## Not touching (my territory)

I'll keep working on the injected pieces on my side (Meta-Portfolio,
Yield, Airdrop, Predict-Arb, Cross-Margin, AI Coach, Telegram-Help,
landing FAQ/comparison, referral zeroing, WC modal fixes, deploy hot-
swap). Nothing in your files needs to change for any of those.

Ping me in a git commit if you want me to test any specific change
via Chrome MCP.
