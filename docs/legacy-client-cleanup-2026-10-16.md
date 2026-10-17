# Legacy client API cleanup — 2026-10-16

The browser no longer probes a development login or a nonexistent settings inbox on load. Display names remain browser-local and saving reports local storage failures. Notification cards and the bell remain, with unavailable subscriptions explicitly disabled; the bell can render current-page notices without requesting a wallet signature.

Removed obsolete CEX REST fallback requests for futures overview/funding/liquidations/orders/positions, old spot snapshots, sessions, support tickets and the unimplemented SSE transport. The WebSocket reconnect path remains with backoff. Active Hyperliquid order/position handling and its rendering remain. The unused legacy risk editor and compatibility `PUT /api/settings` are removed, preventing cached profile clients from writing into risk settings. The actual admin `/api/admin/settings/risk` endpoint remains.

Four unreferenced copies (`grom-gwx.js`, `grom-markets.js`, `grom-dash-watch.js`, `grom-dom-safe.js`) are removed from release sources. They are recoverable from Git history. The source gate rejects their return and the retired API paths in future releases.

## Verification

- Profile save/clear/storage failure and bell rendering exercised with network and signatures forbidden.
- Hyperliquid refresh, close and order parameter forwarding tested on mocks; no financial transaction signed or submitted.
- All executable inline scripts parsed. Ten main product section fragments unchanged byte-for-byte.
- Full suite: 627 passed, 3 database-dependent skipped, zero failures. Lint: zero errors, six existing warnings. Frontend build and all 42 SEO route checks passed.
- Browser fixture using actual page sections/styles/functions: local name saved and empty bell opened without console errors or signing.

## Audit qualifications and remaining work

The supplied audit used GET to classify some routes. Odos quote and assemble are POST routes actually registered in the backend; production configuration currently disables the quote integration. They are not nonexistent routes and are not removed in this patch. Inactive provider choices and the remaining old spot render helpers require a separate dependency review.

Further page-specific loading of chart, Trade and prediction code is separate performance work. Public pages already externalize shared CSS/JS during the build. HTML size alone is not the complete transfer size.
