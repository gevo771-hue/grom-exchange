# GROM load tests (k6)

## Install

```bash
brew install k6          # macOS
# Ubuntu CI: see .github/workflows — sudo gpg key install
# Optional WS flood: brew install websocat
```

## Scenarios

| # | File | Target SLO (stress) | Notes |
|---|---|---|---|
| A | `A_landing.js` | 500 concurrent, p95 < 200ms | Public static + `/health` |
| B | `B_siwe.js` | 100 concurrent, p95 < 500ms | Nonce + mock verify (loads PG) |
| C | `C_swap_quote.js` | 200 vus, p95 < 1.5s | External agg latency |
| D | `D_orderbook.js` | 500 vus, p95 < 100ms | Must be cached |
| E | `E_wallet_api.js` | 100 vus, p95 < 800ms | Needs `GROM_JWT` |
| F | `F_ws_flood.sh` | 1000 stable WS | `websocat` or node `ws` |
| G | `G_e2e.js` | browser E2E | `k6` browser module |

## Progressive stages

All JS scenarios honour `STAGE`:

| STAGE | Behaviour |
|---|---|
| `smoke` (default) | ~5 VUs × 30s — **safe for post-deploy CI** |
| `load` | 50 VUs × 5m |
| `stress` | ramp 100→1000 × ~15m |
| `soak` | 100 VUs × 2h (leak hunt) |
| `spike` | 50→1000 in 5s |

```bash
# Always start smoke on staging / off-peak:
BASE_URL=https://grom.exchange STAGE=smoke k6 run scripts/load/A_landing.js

# Load / stress — prefer staging OR 03:00–06:00 UTC on prod
BASE_URL=https://staging.example STAGE=load k6 run scripts/load/D_orderbook.js
BASE_URL=https://staging.example STAGE=stress k6 run scripts/load/A_landing.js

# Auth'd wallet API
GROM_JWT='eyJ…' STAGE=smoke k6 run scripts/load/E_wallet_api.js

# WebSocket flood
chmod +x scripts/load/F_ws_flood.sh
STAGE=smoke ./scripts/load/F_ws_flood.sh

# Post-deploy / CI wrapper (fails if p95>500ms or errors>1%)
chmod +x scripts/load/smoke.sh
./scripts/load/smoke.sh
```

## Safety

- **Do not** run `stress` / `spike` / `soak` against prod in peak hours.
- Prefer a staging clone; if prod only — night window 03:00–06:00 UTC.
- Capture baseline with 1 user before comparing stages.

## Observability while testing

```bash
# On prod host
docker stats grom_backend grom_postgres grom_redis
curl -s localhost:9464/metrics | head
# Postgres
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity"
psql $DATABASE_URL -c "SELECT query, mean_exec_time FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10"
```

## SLO (formal)

- Landing/public: **5000** concurrent without degradation
- Auth'd API: **500 rps** sustained, p95 < 800ms
- WebSocket: **10 000** concurrent connections
- Swap E2E: **200** quote+exec/min without aggregator 429
- Uptime: **99.5%**

Results → repo root `LOAD-TEST-RESULTS.md`  
Incidents → `docs/LOAD-INCIDENT-RUNBOOK.md`
