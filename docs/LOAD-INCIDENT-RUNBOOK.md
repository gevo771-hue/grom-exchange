# LOAD INCIDENT RUNBOOK

When prod is under pressure — **do these first**. Keep changes reversible.

## 0. Triage (2 minutes)

```bash
ssh -p 2222 root@PROD 'cd /opt/grom-exchange && docker compose ps && docker stats --no-stream'
curl -fsS https://grom.exchange/health
curl -fsS https://grom.exchange/metrics | head   # if exposed through proxy
```

Classify:

| Symptom | Likely | Jump to |
|---|---|---|
| Site 502 / blank | Frontend or edge | §1 |
| `/api/*` slow / 5xx | Backend / PG / Redis | §2–4 |
| Wallet balances fail | RPC 429 | §5 |
| Swap quotes fail | Aggregator rate-limit | §6 |
| WS disconnects | Relays / max clients | §7 |

---

## 1. Edge / static (Cloudflare + nginx)

1. Cloudflare dashboard → **Under Attack Mode** (temporary) if scrape/DDoS.
2. Rate-limit rules (emergency):
   - `/api/*` → 60 req / 10s / IP
   - `/auth/*` → 20 req / 10s / IP
3. Purge only if serving **stale fatal** HTML (careful — stampede).
4. Confirm frontend container:

```bash
docker compose logs --tail 80 frontend
docker exec grom_frontend nginx -s reload
```

---

## 2. Raise Postgres pool **without downtime**

Pool is env-driven (`GROM_DB_POOL_MAX`, default 50 as of 2026-07-14).

```bash
# On prod host
cd /opt/grom-exchange
# Edit .env (or compose env):
#   GROM_DB_POOL_MAX=100
docker compose up -d --no-deps --force-recreate backend
# Wait health:
for i in $(seq 1 20); do curl -fsS http://127.0.0.1:4000/health && break; sleep 2; done
```

Longer term: put **PGBouncer** in front (transaction mode), keep Node pool ≈ 20–30 per instance × N instances ≤ PG `max_connections`.

Check saturation:

```sql
SELECT count(*) AS total,
       count(*) FILTER (WHERE state = 'active') AS active,
       count(*) FILTER (WHERE wait_event IS NOT NULL) AS waiting
FROM pg_stat_activity
WHERE datname = current_database();
```

---

## 3. Slow queries / locks

Enable if not already (requires PG restart **or** reload for some GUCs):

```sql
-- Prefer set in postgresql.conf / docker command:
-- log_min_duration_statement = 100
SELECT pid, now() - query_start AS age, state, wait_event_type, left(query, 120)
FROM pg_stat_activity
WHERE state <> 'idle'
ORDER BY age DESC
LIMIT 20;

SELECT query, calls, mean_exec_time, total_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 20;
```

Indexes already cared for: `spot_orders`, `futures_positions`, `wallet_transfers` (016/017). If a new hot path appears → `EXPLAIN ANALYZE` + migration.

---

## 4. Backend CPU / event loop

```bash
docker stats grom_backend --no-stream
docker compose logs --tail 120 backend
```

| Fix | How |
|---|---|
| Single-process Node pegged | Run cluster: `node --max-old-space-size=2048` + compose `replicas` / `pm2 -i max` behind sticky LB |
| Event loop lag > 100ms | Move heavy sync work to `worker_threads` or queue |
| Memory climb | Heap snapshot; restart as last resort (`compose restart backend`) |

Feature-flag: temporarily disable heavy routes (market-maker, aggressive polling workers) by env kill-switch if present.

---

## 5. RPC 429 / latency

Circuit-breaker lives in frontend `gwRpcTry` and backend RPC helpers — confirm logs for fallback.

Emergency:

1. Switch primary RPC URL in `.env` to paid Alchemy/QuickNode.
2. Reduce dashboard poll intervals (frontend cache already 45s for trending).
3. Short-cache `/api/wallet/overview` responses in Redis (5–15s) if stampeded.

---

## 6. Meta-aggregator 429

Symptoms: swap quote p95 climbs, 429 in backend logs from LiFi/Paraswap/Kyber.

Fix:

1. Cache successful quotes **5–10s** keyed by `(chainId, src, dst, amountBucket)`.
2. Shed load: return last-good cached quote with `stale: true`.
3. Lower UI quote concurrency (already Promise.allSettled — can gate to top-N aggs under pressure).

---

## 7. WebSocket floods

Path: `wss://grom.exchange/ws`

1. Cap connections per IP at Cloudflare / nginx `limit_conn`.
2. Scale backend horizontally with sticky sessions **or** fan-out via Redis pub/sub (already used for some broadcast channels).
3. Monitor open FDs: `ls /proc/$(docker inspect -f '{{.State.Pid}}' grom_backend)/fd | wc -l`

---

## 8. Who to page

| Role | When |
|---|---|
| On-call eng ( Гевор / deploy key owner ) | Any p95>2s sustained 5m or error>5% |
| Infra / DO | Disk full, host OOM, network |
| RPC vendor support | Sustained 429 after key swap |

Slack/Email/Sentry — wire `scripts/load/smoke.sh` failure as deploy gate alert.

---

## 9. After the fire

1. Append numbers to `LOAD-TEST-RESULTS.md`.
2. File PR with the permanent fix (cache, pool, index, blue-green).
3. Retest **STAGE=load** on staging before claiming recovery.
4. Schedule next night stress if breaking point unknown.
