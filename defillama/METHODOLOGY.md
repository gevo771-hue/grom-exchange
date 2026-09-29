# GROM → DefiLlama methodology

Status: **NOT submitted** (2026-09-13). Contact: `support.grom@gmail.com`.

## Parent project

| Field | Value |
|-------|--------|
| Name | GROM |
| Site | https://grom.exchange |
| Contact | support.grom@gmail.com |

### Four products (metadata)

| Product | Dashboard intent | Volume attribution | Ledger status |
|---------|------------------|--------------------|---------------|
| DEX Instant Swap | `aggregators/grom` | GROM-routed **executed** swaps only | **Ready only where indexed** (confirmed fills; empty *scanned* window = verified 0, unscanned = 503) |
| Perp DEX | `aggregator-derivatives/grom` (review) | GROM HL **builder** fills only | **Unavailable** — API 503, adapter throws |
| Prediction Markets | TBD with maintainers | GROM-attributed **filled** trades only | **Unavailable** |
| Tokenized stocks (RWA) | Same Instant Swap rails | Stock-token swaps counted **once** under swap | Via swap; no separate TVL from branding |

Do **not** treat four product descriptions as four live volume dashboards.

## Authoritative data (what counts)

**Source of truth for listed Instant Swap volume/fees:** Postgres table `dimension_fills` rows with `status = 'confirmed'`, exposed at:

- `GET /api/public/dimensions/meta`
- `GET /api/public/dimensions?product=swap&chainKey=<key>&startTimestamp=<s>&endTimestamp=<e>`

Half-open UTC window: `[startTimestamp, endTimestamp)`.

### Explicitly excluded

- Frontend quote events and Instant Swap quote caches
- `user_activity` / `gw_tx_log_v1` (client-fired, not settlement-verified)
- Wallet deposits, funding, withdrawals, bridges as “volume”
- Reverted / dry-run / test transactions
- Fee-wallet ERC-20 transfers **alone** (not swap volume; do not infer volume as `transfer / 0.002`)
- Third-party global venue volume (LiFi / HL / Polymarket market-wide)
- Rewriting history by multiplying historical token amounts by **current** USD prices

### Dedup / attribution

- Unique key: `chainId:txHash:logIndex` or `product:fill:<fillId>`
- Hash normalisation is chain-specific: EVM hashes/addresses are lowercased, Solana base58 signatures and addresses keep their case (two case-distinct signatures are two different fills, never collapsed)
- Split routes / retries / reorgs: one confirmed row per settlement id
- Attribution evidence stored in `evidence` JSONB (integrator id, builder code, receipt refs)
- Fee vs volume: `fee_usd` and `volume_usd` are separate columns; both must come from verified settlement + historical USD pricing at confirmation time

## Indexing watermark and coverage

`indexedFrom` is the **earliest day we are willing to index**, not a claim that anything after it was scanned. What was actually scanned lives in table `dimension_index_coverage` (migration `025_dimension_index_coverage.sql`): every sync writes the exact `[covered_from, covered_to)` window it scanned, per product and chain, with `status = 'ok'` or `'failed'`.

- `indexedFrom`: **2026-08-22T00:00:00.000Z** — first day with known LiFi `integrator=grom-exchange` DONE transfers; same value as `START` in `aggregators/grom.ts`
- **Confirmed Instant Swap source for DefiLlama:** LiFi analytics (`GET /v2/analytics/transfers`, paginated to completion) filtered to `integrator=grom-exchange` + `status=DONE`. Coverage `ok` means that LI.FI integrator window was fully fetched and every attributable fill was written — **not** that CoWSwap, xStocks-only venues, or other GROM routers were scanned.
- Malformed LI.FI payloads (`{}`, missing/`null`/`{}` transfers), incomplete pagination, unmappable GROM DONE rows, or upsert errors record `status=failed` and must **not** be treated as verified zero.
- LiFi sync: `POST /api/dimensions/sync-lifi` (admin) or `node src/dimensions/sync-lifi-cli.js --from 2026-08-22 [--to …]`. The window is **required**: without it we cannot record honest coverage, so the endpoint/CLI refuse rather than imply a scan
- Known seed (as of 2026-09-13): 2 BSC DONE swaps on 2026-08-22, ~$7.30 combined `sending.amountUSD`; GROM `integratorFee` share = $0 on those txs

Response contract for `[startTimestamp, endTimestamp)` on one chain:

| Situation | HTTP | Body |
|-----------|------|------|
| Before `indexedFrom` | 503 | `NO_DATA`, `coverage.status = "before_index"` |
| Requested window not fully inside recorded `ok` coverage (fresh DB, gap, or `failed` sync) | 503 | `NO_DATA` `interval_not_indexed`, `coverage.status = "unsynced"` |
| Fully covered, zero confirmed fills | 200 | `dailyVolumeUsd: 0`, `dailyFeesUsd: 0`, `coverage.status = "ready"` — verified empty |
| Fully covered, confirmed fills | 200 | Sum of that chain’s confirmed rows only |
| Product without an indexer (`perps`, `predict`, `xstocks` standalone) | 503 | `NO_DATA`, regardless of coverage rows |
| DB / query failure | 503 | `UPSTREAM_ERROR`, `coverage.status = "error"` — never silent zero |

`/api/public/dimensions/meta` is generated from the same table: `coverageByProduct.swap.watermark` is the newest `covered_to` actually recorded, `chainsCovered` lists only chains with `ok` windows, and `status` is `unsynced` until something is recorded. If the store is unreachable, `/meta` answers 503 too.

## Confirming fills (ops) and the trust boundary

1. Client may `POST /api/dimensions/report` (auth) → `status = reported` (**not counted**). Client reports are **untrusted**: they can never insert `confirmed`, and if a row for the same dedupe key is already `confirmed` they cannot change its product, fill id, router, attribution, volume, fees, evidence or status — the existing row is returned unchanged
2. Admin `POST /api/dimensions/confirm` and the LiFi indexer are the only **trusted** writers (`upsertFill(..., { trusted: true })`); they set `status = confirmed` with historical `volumeUsd` / `feeUsd`
3. Future work: LiFi partner export, on-chain receipt verifier, HL builder API, Polymarket builder API — still only after GROM attribution is proven

## Adapter package (local → PR)

Located at `grom-exchange/defillama/dimension-adapters/`:

| File | Submit? |
|------|---------|
| `aggregators/grom.ts` | Yes, after API is live on prod + migration applied |
| `aggregator-derivatives/grom.ts` | **No** until perps indexer exists (stub throws) |

Upstream repo: https://github.com/DefiLlama/dimension-adapters (not the TVL repo).

## Supersedes

`marketing/listings-kit/submissions/04-defillama.md` — do **not** submit its example figures, launch date guesses, or per-chain copies of all-chain totals.
