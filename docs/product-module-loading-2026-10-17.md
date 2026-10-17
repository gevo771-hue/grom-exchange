# Product modules loaded on demand — 17 October 2026

The shared page shell previously downloaded prediction and Hyperliquid code on every page (or after a landing-page timer/any click), plus a blocking chart library in the head. Page markup, cards, styling, live market catalogues and financial execution functions are unchanged.

The loader now shares one pending Promise per module and uses build-rewritten hashed asset URLs. Routes request only their dependencies:

| Page | Modules requested |
| --- | --- |
| Landing, Stocks, Settings, Referrals, Help, Admin | None of these three modules |
| Predictions | Prediction execution/client module |
| Swap dashboard, Markets, Wallet, History | Hyperliquid (also used for portfolio and history) |
| Trade | Hyperliquid and the existing pinned chart library |

An explicit consumer can also request its dependency, e.g. an authenticated balance refresh or AI prediction collateral check. Already-loaded modules are retained when navigating within the SPA. This does not remove shared wallet/i18n/catalogue code or change provider availability.

Prediction confirmations await the module rather than guessing readiness after 120 ms. Markets that expire during the download are rejected. Download failures do not open a demo purchase and can be retried. History awaits Trade code; wallet balance waits are bounded without cancelling the shared download. Visible desk charts await the library without animation-frame polling. Hidden charts do not trigger downloads. No pending financial action is automatically replayed when a module finishes loading.

Validation:

- 641 tests: 638 passed, 3 DB-dependent skipped, no failures; 11 new module-loading regressions use isolated mocks and make no financial requests.
- Source/syntax gate, build and SEO regression for 42 compatible URLs passed.
- All 12 static page sections match the previous release byte-for-byte.
- Read-only local browser preview: landing loads none of these modules; Predictions loads only its module and renders live cards; Trade loads its module and chart library, shows candles/market lists; direct Stocks reload renders quotes without these modules. No console errors observed.
- Local preview blocks financial POSTs. No transaction, order, wallet signature or funding operation was executed.

This reduces unnecessary downloads and parsing; it is not a claim that the entire site transfer equals its HTML size, or that all real-money flows have been validated.
