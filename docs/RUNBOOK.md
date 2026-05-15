# GROM Runbook — On-call procedures

## 0. Quick reference

- Status page: https://status.grom.exchange
- Incident channel: `#grom-incident` (Slack)
- PagerDuty service: `grom-prod`
- Grafana: https://grafana.grom.internal → "GROM / Binary Options"
- Logs: `kubectl logs -n grom -l app=grom-backend --tail=200 -f`
- DB console (break-glass): `psql $GROM_DB_URL`

## 1. Severity levels

| SEV | Definition | Response time | Escalation |
|-----|------------|---------------|------------|
| 1 | User funds at risk, trading halted, data loss | 5 min | CTO + Legal |
| 2 | Degraded trading, >1% error rate, price feed failover | 15 min | Eng manager |
| 3 | Non-critical feature broken, cosmetic | Next business day | — |

## 2. Common incidents

### 2.1 Price feed divergence > 50 bps

**Symptom:** `grom_price_feed_failover_total` spiking; `price sources` showing only 1-2 healthy in `/health`.

**Diagnosis:**
```bash
kubectl logs -n grom -l app=grom-backend | grep "price diverges"
curl -s https://api.grom.exchange/health | jq .price_sources
```

**Response:**
1. Verify against the source's public chart that the affected exchange is actually off-market (often a maintenance window).
2. If only one source is off: the aggregator already ignored it — no action. Add a status-page post.
3. If **two or more** diverge: **immediately halt binary options** via feature flag:
   ```bash
   kubectl set env deploy/grom-backend BINARY_HALT=true -n grom
   ```
4. Open incident channel. Let in-flight rounds settle on last-known-good price; cancel new round scheduling until restored.

### 2.2 Binary settlement stuck

**Symptom:** round in `bo_rounds` with `status='settling'` older than 30s.

**Diagnosis:**
```sql
SELECT id, asset, status, expiry_at, settled_at FROM bo_rounds
WHERE status='settling' AND expiry_at < NOW() - INTERVAL '30 seconds';
```

**Response:**
1. Inspect backend logs for the round id; look for `Failed to fetch expiry price` or DB errors.
2. If expiry price is genuinely unavailable: cancel & refund the round (DB-safe):
   ```sql
   BEGIN;
   UPDATE bo_positions SET status='refunded', payout=0, settled_at=NOW()
     WHERE round_id='<id>' AND status='open';
   -- ledger refund rows handled by engine on next kick
   UPDATE bo_rounds SET status='cancelled', settled_at=NOW() WHERE id='<id>';
   COMMIT;
   ```
3. Restart the backend pod to trigger `_recoverInFlight()`.
4. Post-mortem within 48h.

### 2.3 Ledger / balance drift

**Symptom:** `bo_ledger` sum per user != balances table.

**Diagnosis (read-only):**
```sql
SELECT l.user_id,
       SUM(l.amount) FILTER (WHERE l.kind IN ('stake_refund','payout_win')) -
       SUM(l.amount) FILTER (WHERE l.kind='stake_lock') AS ledger_net,
       b.amount AS current_amount
FROM bo_ledger l
LEFT JOIN balances b ON b.user_id=l.user_id AND b.asset=l.asset AND b.mode=l.mode
GROUP BY l.user_id, b.amount
HAVING ABS(...) > 0.00001;
```

**Response:**
1. **Ledger is source of truth.** Do not adjust balances manually — regenerate from ledger:
   ```sql
   -- see scripts/reconcile-balances.sql
   ```
2. Freeze affected user accounts (set `risk_level='elevated'`) pending review.
3. Open SEV-1.

### 2.4 WebSocket storm

**Symptom:** backend CPU pegged, WS connection count spiking.

**Response:**
1. Check for reconnect storms: `grep "ws connected" | wc -l` over last minute.
2. Enable per-IP WS connect rate limit in nginx:
   ```nginx
   limit_conn_zone $binary_remote_addr zone=ws:10m;
   limit_conn ws 10;
   ```
3. Horizontal scale backend deployment:
   ```bash
   kubectl scale deploy/grom-backend --replicas=8 -n grom
   ```

### 2.5 SIWE nonce exhaustion / replay attempt

**Symptom:** spike in `auth/verify` 401 responses, especially with `stale nonce`.

**Response:**
1. Not necessarily malicious — clock skew or slow frontend common. Check aggregate.
2. If sustained from a small IP range: block at WAF.
3. Audit `siwe_nonces` for any nonce consumed twice (should be prevented by unique constraint; if not, SEV-1).

## 3. Deploy & rollback

```bash
# Deploy
./scripts/deploy.sh v1.2.3

# Rollback (fast)
kubectl rollout undo deploy/grom-backend -n grom

# DB migration rollback
psql $GROM_DB_URL -f migrations/<ver>_down.sql
```

Never rollback past a migration that has written to `bo_ledger`. Ledger is append-only; schema must be forward-compatible.

## 4. Maintenance windows

- Announce 24h in advance on status page.
- Enter "maintenance mode" via feature flag `MAINT_MODE=true`; frontend shows banner, bet endpoint returns 503.
- Preferred window: Tue 03:00–05:00 UTC (lowest binary volume).

## 5. Escalation contacts

| Role | Name | Channel |
|------|------|---------|
| On-call primary | — | PagerDuty |
| On-call secondary | — | PagerDuty |
| Eng manager | — | Slack + phone |
| CTO | — | Phone |
| Legal (for regulatory incidents) | — | Phone |
| BitGo / custody vendor | — | See vendor portal |
