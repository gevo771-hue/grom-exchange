# GROM Production Roadmap — 8 weeks

Team assumption: 1 backend, 1 frontend, 1 mobile, 0.5 devops, 0.5 QA. Legal & compliance are external dependencies and block launch regardless of engineering progress.

## Week 1 — Foundation
- [x] Repository skeleton, Docker Compose, isolated DB / ports
- [x] SIWE wallet auth, JWT sessions
- [x] Binary engine + migrations + price aggregator
- [ ] CI pipeline (GitHub Actions): lint, test, build image on main
- [ ] Secrets management setup (AWS Secrets Manager / Doppler / Vault — pick one)
- [ ] Staging VM + managed Postgres 16

## Week 2 — Liquidity & spot scaffold
- [ ] Binance signed REST client for spot order routing (maker/taker)
- [ ] Hummingbot config validated on testnet, inventory skew tuned
- [ ] Kraken + Coinbase feeds wired (done) + health dashboards
- [ ] 1inch / Odos quote endpoint finalised + slippage guardrails
- [ ] DEX swap execution (build tx, user signs in wallet)

## Week 3 — Binary options hardening
- [ ] Backtest payout ratio vs. historical BTC/ETH 1m ticks (target house edge 6–8%)
- [ ] Engine chaos tests: DB disconnect mid-settlement, price feed blackout
- [ ] Fraud detector: latency-arb, duplicate IP, stake anomaly
- [ ] Admin tool: manual round cancel, position refund, balance adjust (audited)
- [ ] Demo-only mode flag for soft launch

## Week 4 — Frontend integration
- [ ] Port `grom-preview.html` UI into `frontend/` React + Vite
- [ ] WalletConnect v2 modal, wagmi + viem hooks
- [ ] Live WS price stream + Lightweight Charts
- [ ] Binary trade panel bound to API (stake/duration/UP/DOWN)
- [ ] Trade history pagination, filters, CSV export
- [ ] Analytics widget (RSI/MACD/BBands + combined signal)
- [ ] i18n (EN, RU to start)

## Week 5 — Security & compliance groundwork
- [ ] Penetration test (external firm) — both backend + wallet flows
- [ ] Rate limiting review (global + per-endpoint + per-IP)
- [ ] WAF (Cloudflare / AWS WAF) rules for bet endpoints
- [ ] SOC 2 gap assessment kickoff (if pursuing)
- [ ] Geoblock by IP + self-declared jurisdiction (GROM_GEOBLOCK env)
- [ ] Terms of Service + Risk Disclosure + Privacy Policy drafted with counsel
- [ ] Responsible-trading limits UI (daily cap, cooling-off)

## Week 6 — Observability & reliability
- [ ] Grafana dashboards: binary engine, liquidity health, user funnel
- [ ] Alertmanager routes: PagerDuty for SEV-1, Slack for SEV-2
- [ ] Synthetic monitoring: round-create → position-open → settle loop every 5 min
- [ ] DB backup & restore drill (PITR verified)
- [ ] Redis Sentinel config for prod (HA)
- [ ] Runbook dry-run with on-call team

## Week 7 — Load test & bug bash
- [ ] k6 scenarios: 10k concurrent users, 50 bets/sec sustained
- [ ] Latency budget: p95 bet placement < 80 ms
- [ ] Settlement invariant check: ledger sum == balance delta (continuous test)
- [ ] Internal bug bash (all hands, 2 days)
- [ ] Bug bounty program published on HackerOne (staging scope)

## Week 8 — Launch
- [ ] Soft launch: demo balances for all, live for whitelist of 50
- [ ] Feature flag rollout: 1% → 10% → 50% → 100% over 5 days
- [ ] Day-1 comms: incident channel, status page, PR moratorium on deploy freeze
- [ ] Post-launch retro scheduled

## Cross-cutting (any week)

**Legal & Compliance** — may take 6–12 weeks in parallel, independent of engineering:
- Entity + banking
- CASP / MiCA registration (EU) or equivalent
- Binary options jurisdictional review (EU = restricted to professional clients, US = prohibited for retail)
- KYC provider integration (Sumsub / Onfido / Jumio)
- AML/Travel Rule (Notabene / Chainalysis KYT)
- Insurance (Lloyd's of London / BitGo)

**Marketing & support** — mostly non-engineering:
- Help Center content
- Learn section explaining binary options risk
- Support ticketing (Zendesk / Intercom)
- Localisation plan

## Critical path

Engineering critical path is **Week 3 hardening → Week 5 security audit**. Everything else parallelises. Legal is the single biggest risk to the launch date; start that on day 1.
