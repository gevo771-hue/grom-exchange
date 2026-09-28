# Draft PR — DefiLlama dimension-adapters

**Target repo:** https://github.com/DefiLlama/dimension-adapters
**Branch suggestion:** `grom-aggregators-adapter`
**GitHub (fork owner):** `gevo771-hue`
**Do not open until:** migrations `024`/`025` applied, LiFi sync recorded coverage with **completed UTC days only** (no future watermark), and meta/dimensions checks below pass.

## Title

```
Add GROM Instant Swap aggregator adapter (LI.FI integrator ledger)
```

## Body

```markdown
## Summary

- Adds `aggregators/grom.ts` + `helpers/aggregators/grom.ts` for GROM Instant Swap volume/fees.
- Data source: read-only GROM confirmed-fill API
  `GET https://grom.exchange/api/public/dimensions?product=swap&chainKey=…&startTimestamp=…&endTimestamp=…`
- **Scope is LI.FI integrator-only** (`integrator=grom-exchange`, DONE transfers). Other GROM routers (CoWSwap / xStocks-only venues, etc.) are out of scope until indexed.
- Per-chain fetches only (no all-chain total repeated on every chain).
- Indexed-and-empty windows return **0**; unsynced / pre-index / in-progress UTC day / upstream errors **throw** (no silent zero).
- Fail closed: `ok === true`, `coverage.status === "ready"`, matching `chainKey` + window, finite non-negative metrics. Guards live in `grom-guards.js`.

## Project

- Website: https://grom.exchange
- Contact: support.grom@gmail.com
- Parent products (metadata only — not four live volume series):
  1. Instant Swap (this adapter)
  2. Perps (HL builder) — **not submitted**
  3. Prediction Markets — **not submitted**
  4. Tokenized stocks — spot swaps that settle via Instant Swap / LiFi rails are counted once under swap

## Methodology

- Volume = GROM-attributed **executed** Instant Swap fills confirmed in GROM’s ledger for `[start,end)` on that chain (LiFi integrator attribution only).
- Fees = recorded GROM fee receipts on those fills (not fee-wallet transfers ÷ fee rate).
- Never attributes LiFi / venue global volume to GROM.
- Indexing start: `2026-08-22` UTC.
- Coverage is limited to **completed UTC days** (exclusive `to` = start of current UTC day). In-progress / future intervals are not advertised as ready.
- Seed volume: 2 BSC swaps ~$7.30 on 2026-08-22.
- Write-up: https://grom.exchange/api/public/dimensions/meta and repo `defillama/METHODOLOGY.md`.

## Test plan

- [x] `GET /api/public/dimensions/meta` → `ok: true`; swap watermarks ≤ start of current UTC day (not tomorrow)
- [x] Indexed empty completed day → `dailyVolumeUsd: 0`, `ok: true`, `coverage.status: ready`
- [x] In-progress UTC day (e.g. today while still today) → HTTP 503 `interval_extends_into_future` (adapter throws)
- [x] BSC `2026-08-22` → ~`$7.3025`, `fillCount: 2`
- [ ] Day never synced → HTTP 503 `interval_not_indexed`
- [ ] `startTimestamp` before `2026-08-22` → HTTP 503
- [ ] `product=perps` → HTTP 503 (not zero)
- [ ] Malformed body / wrong `chainKey` / non-ready coverage → adapter throws via `grom-guards.js`
- [ ] DefiLlama adapter harness for `aggregators/grom` on empty + nonempty day

## Notes for maintainers

- We are **not** claiming TVL in this PR.
- `aggregator-derivatives/grom` is intentionally **omitted**.
- Confirmed production fills may still be sparse — intentional honesty, not a missing endpoint.
```

## Files to copy into the fork

From `grom-exchange/defillama/dimension-adapters/`:

1. `aggregators/grom.ts` → upstream `aggregators/grom.ts`
2. `helpers/aggregators/grom.ts` → upstream `helpers/aggregators/grom.ts`

Do **not** put helpers under `aggregators/` (CI treats every file there as an adapter).
Do **not** copy `aggregator-derivatives/grom.ts`.
