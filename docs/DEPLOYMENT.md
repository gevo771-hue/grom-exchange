# GROM Deployment Guide

## Environments

| Env | Host | Purpose | Access |
|-----|------|---------|--------|
| dev | localhost (Docker Compose) | local development | engineers |
| staging | single AWS VM + RDS | integration tests, QA, bug bounty | eng + QA + external auditors |
| prod | Kubernetes (EKS/GKE) multi-AZ | live customers | on-call only |

## Local (dev)

```bash
cd grom-exchange
cp .env.example .env
# Edit .env — at minimum set GROM_DB_PASSWORD and GROM_JWT_SECRET
docker compose up -d postgres redis
docker compose up backend     # foreground for logs
docker compose up frontend    # in another terminal
```

Services:
- Backend:  http://localhost:4000
- WS:       ws://localhost:4001/ws
- Frontend: http://localhost:5273
- Postgres: localhost:54320 (user `grom`)
- Redis:    localhost:63790
- Grafana:  http://localhost:3001
- Prometheus: http://localhost:9091

Run migrations (idempotent; also auto-run on first Postgres start):
```bash
docker compose exec postgres psql -U grom -d grom -f /docker-entrypoint-initdb.d/001_init.sql
```

## Staging

1. Provision:
   - 1× `t3.large` VM (or equivalent) with Docker
   - RDS Postgres 16 (db.t3.medium, multi-AZ = false for cost)
   - ElastiCache Redis 7 (single node)
   - Cloudflare DNS + WAF
2. Clone repo, copy `.env.staging` (secrets from Vault).
3. `docker compose -f docker-compose.yml up -d`
4. Run smoke tests: `./scripts/health-check.sh staging.grom.exchange`

## Production (Kubernetes)

### Prerequisites
- EKS/GKE cluster with ≥ 3 nodes across AZs
- RDS Postgres 16 multi-AZ with read replica
- ElastiCache Redis 7 with Sentinel (or Redis Cluster)
- AWS Secrets Manager / GCP Secret Manager for env
- Cloudflare in front (WAF + DDoS + rate limiting)
- HashiCorp Vault or AWS KMS for signing keys

### Deploy

```bash
# Build & push image
docker build -t grom-backend:$TAG backend/
docker tag grom-backend:$TAG $REGISTRY/grom-backend:$TAG
docker push $REGISTRY/grom-backend:$TAG

# Apply manifests
kubectl apply -k k8s/overlays/prod
kubectl set image deploy/grom-backend backend=$REGISTRY/grom-backend:$TAG -n grom
kubectl rollout status deploy/grom-backend -n grom
```

### K8s manifests (sketch)

Create under `k8s/base/`:
- `deployment.yaml` — backend, 3 replicas, resources 500m/1Gi, liveness `/health`
- `service.yaml` — ClusterIP + annotations for Cloudflare Tunnel
- `hpa.yaml` — autoscale on CPU 60% + custom metric `grom_http_requests_total` rate
- `pdb.yaml` — PodDisruptionBudget minAvailable: 2
- `networkpolicy.yaml` — only allow ingress from ingress-nginx
- `servicemonitor.yaml` — Prometheus Operator scrape at :9464

### Secrets

Never commit `.env.prod`. Inject at runtime:
```yaml
envFrom:
  - secretRef:
      name: grom-backend-secrets   # provisioned by External Secrets Operator from AWS SM
```

### Database migrations

Always run migrations as a Kubernetes Job before rolling out new code:
```bash
kubectl apply -f k8s/jobs/migrate-$TAG.yaml
kubectl wait --for=condition=complete job/migrate-$TAG -n grom --timeout=5m
```

Migrations must be **backward-compatible** for ≥ 1 release to support rollback.

## Scaling

- **Backend:** horizontal. Binary engine round-scheduler is idempotent (DB row = source of truth) but should run on a single leader — use a lease in Redis.
- **Postgres:** vertical first (up to db.r6g.2xlarge), then read replicas for `bo_positions` list queries and `bo_ledger` audit queries.
- **Redis:** used for WS session count + rate limits; single primary OK to 50k connections.
- **WebSocket:** sticky sessions via `ingress-nginx` annotations; horizontal beyond 10k connections per pod.

## Disaster recovery

- RPO 15 min, RTO 4 h.
- Daily automated backups of Postgres → S3 with 90-day retention.
- Weekly restore drill in staging.
- Redis is cache; data loss acceptable.
- Binary engine state reconstructible from `bo_rounds` + `bo_ledger`.

## Observability

- **Metrics:** Prometheus scrapes `/metrics`. Dashboards in `monitoring/dashboards/`.
- **Logs:** stdout → Fluent Bit → Loki (or CloudWatch). Structured JSON from pino.
- **Traces:** OpenTelemetry SDK (TODO — add in week 2).
- **Alerts:** Alertmanager → PagerDuty (SEV-1), Slack (SEV-2).

Key SLOs:
- Bet placement p95 latency < 80 ms
- WS disconnect rate < 0.5% / hr
- Round settlement error rate < 0.01%
- Backend uptime 99.95% / month

## Rollback procedure

```bash
# Instant rollback to prior revision
kubectl rollout undo deploy/grom-backend -n grom

# If migration needs reverting (rare; require approval):
psql $GROM_DB_URL -f migrations/$PREV/down.sql
```

**Never** roll back past a ledger-affecting migration. If forward-only migrations have issues, fix-forward with a new migration.
