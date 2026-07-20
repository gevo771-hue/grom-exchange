# LOAD-TEST-RESULTS

Updated: **2026-07-14** · Tooling: k6 + `scripts/load/*`  
Environment: production `https://grom.exchange` for **smoke only** (safe).  
Full stress/soak: **pending** on staging or off-peak night window.

## SLO checklist (target)

| Surface | SLO | Status |
|---|---|---|
| Landing / public | 5000 concurrent, p95 < 200ms | ⏳ not stress-tested |
| Auth'd API | 500 rps, p95 < 800ms | ⏳ not stress-tested |
| WebSocket | 10 000 concurrent | ⏳ not stress-tested |
| Swap E2E | 200 quote+exec/min no 429 | ⏳ not stress-tested |
| Uptime | 99.5% | ⏳ monitor TBD |

## How to fill cells

```text
cell = p95_ms / error_rate%
Example: 45ms/0.0%
```

Run:

```bash
BASE_URL=… STAGE=smoke|load|stress k6 run scripts/load/A_landing.js
```

Paste k6 summary `http_req_duration{p(95)}` and `http_req_failed{rate}` into the tables.

---

## Scenario A — Landing / public

| Stage | VUs / duration | p95 | Error rate | Notes |
|---|---|---|---|---|
| Smoke | ~5 × 30s | night1 #1: 643ms ❌ → night1 #2: TTFB 515ms / dur 1027ms ❌ | 0.0% | Post-deploy CI |
| Load | 50 × 5m | night1 #1: 1016ms ❌ → night1 #2: TTFB 707ms / dur 805ms ❌ | 0.0% | Blocked on CF Cache Rule (see bottlenecks) |
| Stress | →500–1000 | — | — | Breaking point: ___ (hold night2 until CF rule) |
| Soak | 100 × 2h | — | — | Watch heap |
| Spike | 50→1000 / 5s | — | — | |

**night1 #1 (2026-07-14, baseline)** — 0% errors/timeouts at all stages; `cf-cache-status: DYNAMIC` on `/`,
every request hit origin which gzipped 887KB HTML per request.

**night1 #2 (2026-07-14, after fix, run 29353848682)** — deployed: `s-maxage=60` on `/` + `index.html`,
`gzip_static on` with pre-compressed `.gz` twins from `build-frontend.mjs` (887KB → 202KB, origin TTFB 1s → **11ms**).
Load dur p95 improved 1016 → 805ms (−21%), but `/` is **still DYNAMIC**: Cloudflare never edge-caches
HTML by default regardless of `s-maxage` — a dashboard **Cache Rule** is required (see bottlenecks table).
Remaining p95 ≈ GH-runner→edge→origin round trips, not origin CPU.

## Scenario B — SIWE burst

| Stage | p95 (nonce) | Error rate (verify expected failures OK) | PG `pg_stat_activity` peak |
|---|---|---|---|
| Smoke | — | — | — |
| Load | — | — | — |
| Stress (100) | — | — | — |

## Scenario C — Swap quote

| Stage | p95 | 429 count | Notes |
|---|---|---|---|
| Smoke | — | — | External agg dominates |
| Stress (200 vus) | — | — | If 429 → Redis quote cache 5–10s |

## Scenario D — Orderbook

| Stage | p95 | Error rate | Cached? |
|---|---|---|---|
| Smoke | — | — | |
| Load (50) | night1: 280ms → 292ms | 0.0% | No CF cache (API, DYNAMIC) — backend scales fine; p95 ≈ network RTT from GH runner |
| Stress (500) | target <100ms | — | If >100ms → in-memory/redis 1–2s |

## Scenario E — Wallet API (needs `GROM_JWT`)

| Stage | `/wallet/overview` p95 | `/referral/summary` p95 | RPC 429s |
|---|---|---|---|
| Smoke | — | — | — |
| Load | — | — | — |

## Scenario F — WebSocket

| Stage | Clients | Opened | Dropped | Memory delta backend |
|---|---|---|---|---|
| Smoke (20) | 20 | — | — | — |
| Load (200) | 200 | — | — | — |
| Stress (1000) | 1000 | — | — | — |

## Scenario G — Browser E2E

| Stage | Iterations | Pass rate | Notes |
|---|---|---|---|
| Smoke | 3 | — | Chromium via k6 browser |

---

## Identified bottlenecks (live discoveries)

| Found | Evidence | Fix | Retest |
|---|---|---|---|
| PG pool historically default 10–20 | config audit 2026-07-14 | Raised default to **50** (`GROM_DB_POOL_MAX`) | Pending stress B/E |
| Indexes for transfers / spot / futures | migrations 016+017 | Shipped | Pending stress |
| Meta-agg quote uncached under load | code review | TODO: Redis 5–10s quote cache | Pending C |
| Backend recreate ~15–25s | deploy.sh | TODO: blue-green | Pending |
| Docker name conflict on recreate | prod 2026-07-14 | Manual `docker rm -f` + recreate | Monitor |
| `/` gzipped on-the-fly (887KB) per request | night1 #1: load p95 1016ms | ✅ Shipped 2026-07-14: `gzip_static on` + pre-built `.gz` twins; origin TTFB → 11ms | night1 #2: −21% dur p95 |
| CF won't cache HTML by default — `s-maxage` alone is ignored, `/` stays DYNAMIC | night1 #2: `cf-cache-status: DYNAMIC` despite `s-maxage=60` | **USER ACTION (CF dashboard):** Caching → Cache Rules → new rule: hostname eq `grom.exchange`, Cache eligibility = *Eligible for cache*, Edge TTL = *Use cache-control header if present, bypass if not*. Origin header already sends `s-maxage=60`. | Re-run night1 after rule → expect A load p95 < 300ms |

---

## Smoke run log

| Date (UTC) | Target | Script | p95 | Fail% | Result |
|---|---|---|---|---|---|
| 2026-07-14 | grom.exchange | `smoke.sh` / A | _(fill after first CI/local run)_ | | |

> **Rule:** never run STAGE=stress against prod at peak. Night window 03:00–06:00 UTC or staging only.


## 2026-07-20 — night1 false-fail note

Scheduled night1 failed on GH→prod RTT (tight p95), not origin outage. Schedule disabled; thresholds loosened; soft-fail kept for future cron.
