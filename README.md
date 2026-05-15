# GROM Exchange

Standalone crypto exchange with spot trading and **binary options**. Completely isolated from Granium — own database, own wallets, own infrastructure.

## Stack

- **Backend:** Node.js 20 / Express / Socket.IO / PostgreSQL 16 / Redis 7
- **Frontend:** React 18 / Vite / Tailwind (steel-blue + navy palette from Grom logo)
- **Liquidity:** Binance (primary) → Kraken / Coinbase (fallback) + Hummingbot (internal MM) + 1inch/Odos (DEX swap)
- **Wallets:** Non-custodial via WalletConnect v2 + SIWE (Sign-In with Ethereum). Supported chains: Ethereum, Polygon, BSC, Arbitrum, Base.
- **Infra:** Docker Compose · Nginx · Prometheus + Grafana

## Isolation from Granium

Everything runs on **different ports, different DB names, different env namespace** so the two projects never collide.

| Resource | Granium | Grom |
|----------|---------|------|
| Backend port | 3000 | **4000** |
| Frontend port | 5173 | **5273** |
| WebSocket port | 3001 | **4001** |
| Postgres DB | `granium` | **`grom`** |
| Redis namespace | `gr:` | **`grom:`** |
| Docker network | `granium_net` | **`grom_net`** |
| Env prefix | `GRANIUM_*` | **`GROM_*`** |

## Quick start

```bash
cd grom-exchange
cp .env.example .env
# fill in BINANCE_API_KEY, WALLETCONNECT_PROJECT_ID, DB_PASSWORD etc.
docker compose up -d
# backend API (host) → http://localhost:4000
# UI + proxied API (recommended) → http://localhost:5273
# WebSocket prices → ws://localhost:5273/ws (nginx → backend :4000/ws)
# Optional: `docker compose --profile mm up -d` (Hummingbot), `--profile obs` (Prometheus/Grafana)
```

## Project structure

```
grom-exchange/
├── backend/
│   ├── src/
│   │   ├── server.js                 # entry
│   │   ├── binary/                   # binary options engine
│   │   │   ├── engine.js             # round lifecycle + settlement
│   │   │   ├── routes.js             # REST API
│   │   │   ├── ws.js                 # WebSocket broadcaster
│   │   │   └── indicators.js         # RSI / MACD / Bollinger
│   │   ├── liquidity/                # market data + exec
│   │   │   ├── price-aggregator.js   # Binance → Kraken → Coinbase failover
│   │   │   ├── binance.js
│   │   │   ├── kraken.js
│   │   │   ├── coinbase.js
│   │   │   └── dex-aggregator.js     # 1inch + Odos
│   │   ├── wallet/                   # non-custodial auth
│   │   │   ├── siwe.js               # EIP-4361 verify
│   │   │   └── session.js            # JWT issuance
│   │   ├── db/
│   │   │   ├── pool.js
│   │   │   └── migrations/
│   │   │       └── 001_init.sql
│   │   ├── config/index.js
│   │   └── utils/
│   │       ├── logger.js
│   │       └── metrics.js
│   └── package.json
├── frontend/                         # skeleton (reuse Grom preview → real app)
├── docs/
│   ├── ARCHITECTURE.md
│   ├── ROADMAP.md                    # 8-week production plan
│   ├── RUNBOOK.md                    # on-call procedures
│   ├── RISK_ASSESSMENT.md            # binary options specific risks
│   ├── COMPLIANCE_CHECKLIST.md       # KYC/AML/MiCA/geoblock
│   └── DEPLOYMENT.md
├── scripts/
│   └── health-check.sh
├── docker-compose.yml
├── .env.example
└── README.md
```

## Status

Skeleton + binary engine + liquidity aggregator + SIWE auth are implemented. See `docs/ROADMAP.md` for what's left before production launch.
