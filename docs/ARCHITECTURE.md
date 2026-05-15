# GROM Architecture

## Overview

GROM is a non-custodial crypto exchange with two product surfaces:

1. **Spot trading** — order book matching backed by Binance liquidity + Hummingbot internal MM.
2. **Binary Options (UP/DOWN)** — short-duration derivatives (30s / 1m / 5m / 15m) settled against an aggregated spot price feed.

The system is intentionally isolated from Granium: different database, ports, env prefix (`GROM_*`), Docker network (`grom_net`). The two projects share no runtime state.

## High-level diagram

```
                ┌───────────────────────┐
                │  Web Wallet (MetaMask │
                │  Rainbow, WalletConn.)│
                └──────────┬────────────┘
                           │ SIWE (EIP-4361)
                           ▼
 ┌───────────────────────────────────────────────────┐
 │                  Frontend (React)                 │
 │  Dashboard | Spot | Binary Options | Wallet       │
 └───────┬──────────────────────┬──────────┬─────────┘
         │ REST (HTTPS)         │ WSS      │ DEX quote
         ▼                      ▼          ▼
 ┌───────────────────────────────────────────────────┐
 │                 GROM Backend (Node 20)            │
 │  ┌─────────┐  ┌──────────┐  ┌──────────────────┐ │
 │  │  SIWE   │  │  Binary  │  │   Spot Orders    │ │
 │  │  Auth   │  │  Engine  │  │  (Binance route) │ │
 │  └─────────┘  └────┬─────┘  └─────────┬────────┘ │
 │                    │                  │          │
 │             ┌──────▼──────────────────▼─────┐    │
 │             │    Price Aggregator           │    │
 │             │  Binance → Kraken → Coinbase  │    │
 │             │  (median / failover)          │    │
 │             └───────────────────────────────┘    │
 │                                                   │
 │       Postgres (ledger)     Redis (hot state)    │
 └───────────────────────────────────────────────────┘
         │                    │
         ▼                    ▼
   Hummingbot MM          Prometheus + Grafana
```

## Service responsibilities

### Price Aggregator (`liquidity/price-aggregator.js`)
Subscribes to Binance, Kraken, Coinbase trade/ticker WebSockets. Maintains last price + timestamp per source. On every `getPrice()`:

1. Collect quotes from all healthy sources.
2. Compute median.
3. Iterate sources in priority order; skip any source whose price diverges from the median by > 50 bps (configurable).
4. If the primary (Binance) is skipped, increment `grom_price_feed_failover_total` and switch `activeIdx`.

This protects binary settlement from a single corrupted feed.

### Binary Options Engine (`binary/engine.js`)
- Round scheduler aligns rounds to even `durationSec` boundaries so all users see the same rounds.
- Each round transitions: `open` → `locked` (strike captured) → `settled`.
- On settlement: fetch expiry price, compute winners/losers, write to `bo_ledger` (append-only).
- Recovery: on boot, in-flight rounds from DB are resumed (crash-safe).
- Invariant: `bo_ledger` is the source of truth; balances are a cached projection.

### SIWE Auth (`wallet/siwe.js`)
- `POST /auth/nonce` issues a 16-byte hex nonce (stored in `siwe_nonces`, TTL 5 min).
- Frontend constructs EIP-4361 message and asks the wallet to sign.
- `POST /auth/verify` validates signature via `siwe` lib, consumes nonce atomically, upserts user, issues JWT (24h default).
- `GET /auth/me` returns current user.

### Hummingbot
Runs as a sidecar container with `pure_market_making` strategy. Holds inventory on Binance, provides quotes to the internal order book. Out of scope for v1: latency arbitrage protection (added in v2 via separate kill-switch service).

## Data model (PostgreSQL)

See `backend/src/db/migrations/001_init.sql`. Key tables:

- `users` — wallet_address (PK), chain_id, kyc_status, risk_level, country_code
- `balances` — `(user, asset, mode)` triple; separate `live` and `demo` modes
- `bo_rounds` — scheduler state: open_at, close_at, expiry_at, strike_price, expiry_price, status
- `bo_positions` — user bets: direction, stake, payout, status
- `bo_ledger` — **append-only** audit trail. Every balance mutation has a row.
- `siwe_nonces` — short-lived anti-replay store

## Deployment

See `DEPLOYMENT.md`. Three environments: `dev` (local compose), `staging` (single VM + managed Postgres), `prod` (Kubernetes + multi-AZ Postgres + Redis Sentinel).

## Observability

- Prometheus metrics at `/metrics` (port 9464): round counters, latency histograms, failover counters.
- Pino structured JSON logs → stdout → log shipper.
- Grafana dashboard: `binary-options.json` (see `monitoring/`).

## Non-goals (v1)

- Futures / perpetuals (planned v2)
- Cross-chain deposits (v1 = Ethereum, Polygon, BSC, Arbitrum, Base)
- Staking / savings (rehydrate from Granium in v1.5)
- Native mobile app (use `grom-mobile` workspace later)
