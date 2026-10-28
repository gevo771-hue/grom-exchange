# Featured predictions: locale consistency — 28 October 2026

Production verification of release302 found a remaining discrepancy. The English featured endpoint selected 30829, 143443, 606422, 89502; Russian selected 30829, 606422, 89502, 202857. The first event was classified as esports in English because the substring LEC matched elections. Independent progressive catalogs also allowed selection to change between locales.

The server now selects one canonical snapshot for 90 seconds, coalesces concurrent initial loads and localizes only display labels by event/market identity. Categories, order, probabilities and token sides remain canonical. Missing or failed translations retain the same cards. Events that expire inside the snapshot are immediately excluded. Short league names and tickers require word boundaries; canonical tag/event slugs also contribute to classification.

Validation: 705 tests, 702 passed, 3 existing database skips, zero failures. ESLint: zero errors, 6 existing warnings. Regression tests cover real election/LEC and Netherlands/ETH collisions, actual league names, independent localized catalogs, simultaneous cold requests, mismatched outcome order/odds/token IDs, translation failure and expiry. Direct Gamma probing from this machine failed at TLS; this was not bypassed. Production API verification follows deployment.

Frontend and transaction submission/signature code are unchanged. Release302 UI was rechecked live: full 348-market picker and SP500 search worked; mobile390×844 Cross/Isolated and watchlist displayed correctly. AAL reference endpoint returned HTTP200 with official reference12.585 and multiplier1. No financial operations performed.
