# DefiLlama listing — coverage matrix

Updated: 2026-09-14. Contact: support.grom@gmail.com.

| Metric / surface | Status | Evidence / notes |
|------------------|--------|------------------|
| Instant Swap dailyVolume (per chain) | Ready **for scanned windows only** (may be 0) | `dimension_fills` confirmed + `dimension_index_coverage` + `/api/public/dimensions`; unscanned window → 503, never 0 |
| Instant Swap dailyFees (per chain) | Ready **for scanned windows only** (may be 0) | Same; not inferred from fee wallet |
| Perps dailyVolume | Unsupported | No GROM builder fill indexer; API 503 |
| Predict filled volume | Unsupported | No GROM PM fill indexer; API 503 |
| xStocks separate volume series | Not listed | Count once under Instant Swap when confirmed |
| TVL | Out of scope | RWA branding ≠ TVL listing |
| Historical USD | At confirm time | Never rewrite with current prices |
| user_activity / gw_tx_log | Not used | Client-side, incomplete |
| Old `04-defillama.md` figures | Do not submit | Wrong methodology |

## Production checklist before PR

1. Apply migrations `024_dimension_fills.sql` and `025_dimension_index_coverage.sql` on prod DB
2. Deploy backend with dimensions routes
3. Run LiFi sync **with an explicit window** so coverage is recorded: admin `POST /api/dimensions/sync-lifi` with `fromTimestamp`, or `node src/dimensions/sync-lifi-cli.js --from 2026-08-22` on droplet
4. Verify `https://grom.exchange/api/public/dimensions/meta` (`indexedFrom` = 2026-08-22, `coverageByProduct.swap.watermark` = end of the window you just synced, `chainsCovered.swap` non-empty)
5. Verify BSC day 2026-08-22 → ~$7.30 volume (2 DONE LiFi fills), not silent fabrication
6. Verify a scanned empty chain/day → 0; an **unscanned** day (e.g. before the sync window), pre-index, and `product=perps` → 503
7. Open PR using `DRAFT_PR.md` — only `aggregators/grom.ts`

Coverage is per `(source, product, chain_id, covered_from, covered_to)`; a failed sync records `status = 'failed'` and stays 503, so a crashed job can never masquerade as a zero-volume day.
