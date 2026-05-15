# GROM Risk Assessment

Focus: binary options module (the novel risk surface). Spot trading risks are industry-standard.

## Risk register

| ID | Risk | Likelihood | Impact | Score | Owner | Mitigation |
|----|------|------------|--------|-------|-------|------------|
| R01 | Price feed manipulation / single-source compromise | Med | Critical | High | Eng | 3-source aggregator with 50 bps divergence guard; halt on 2+ divergence |
| R02 | Latency arbitrage (bettor frontruns strike via faster feed) | High | High | High | Eng | Snapshot strike server-side only; 500 ms cooldown; WAF on bet endpoint |
| R03 | Settlement engine crash mid-round → stuck positions | Med | High | High | Eng | `_recoverInFlight()` on boot; append-only ledger; idempotent settle |
| R04 | Regulatory action — binary options banned in user's jurisdiction | High | Critical | Critical | Legal | IP geoblock; self-attestation; ToS; block list of EU retail |
| R05 | House-edge miscalibration → prolonged losses | Med | High | High | Product | Payout ratio feature-flagged; backtest before changes; risk limit |
| R06 | User wallet compromise (phishing) → unauthorized bets | High | Med | High | Security | SIWE re-sign for bets > $500; withdrawal delay; transaction simulation |
| R07 | DB failover loses in-flight round state | Low | Critical | Med | DevOps | Sync replication; point-in-time recovery; chaos drill quarterly |
| R08 | Insider abuse (admin adjusts ledger) | Low | Critical | Med | Security | All writes to `bo_ledger` audited; 4-eyes approval for manual adjustments |
| R09 | Money laundering via win-wash-withdraw pattern | Med | High | High | Compliance | Chainalysis KYT; daily transaction review; SAR filing process |
| R10 | UI misleads user about binary options risk | Med | High | High | Product | Risk disclosure modal on first bet; show loss-count prominently; cooling-off |
| R11 | DEX quote stale → user swaps at bad rate | Med | Med | Med | Eng | 15-sec quote TTL; slippage guard 0.5%; simulate tx before sign |
| R12 | Hummingbot inventory drains under one-sided flow | Med | High | High | Trading | Kill-switch at -3% PnL; inventory skew enabled; ops alert |
| R13 | 51% attack or reorg affects deposit finality | Low | Med | Low | Eng | 12 confirmations on ETH, 64 on BSC, 1 for L2 (Arbitrum/Base uses settlement) |
| R14 | Social engineering of support staff → account takeover | Med | High | High | Security | No password resets via support; mandatory re-auth; session bound to wallet sig |
| R15 | DDoS on bet endpoint timed to pump moves | Med | High | High | DevOps | Cloudflare + rate limit; autoscale; degradation mode (read-only) |

## Scoring: Likelihood × Impact

- Likelihood: Low (<5%/yr), Med (5-30%), High (>30%)
- Impact: Low (< $10k), Med ($10k-$100k), High ($100k-$1M), Critical (>$1M or reputational)

## Specific binary options considerations

### Regulatory

Binary options on retail cryptocurrency are **prohibited** in the US (CFTC 2018), **restricted to professional clients** in the EU (ESMA 2018 permanent measure), and the UK (FCA 2019). This pushes the product towards jurisdictions like **El Salvador, Seychelles, BVI, Curaçao**, each with its own licensing regime.

**Do not launch binary options without:**
1. Written legal opinion from counsel in target jurisdictions.
2. Gambling license if the product is classified as gaming (common for ≤1h expiries).
3. Clear geo-fencing by IP + declared residence + wallet on-chain heuristics.

### Economic

House edge at 92% payout on a 50/50 symmetric distribution is:
```
edge = 1 - 0.5 × 1.92 = 0.04  (4%)
```
But real distributions are asymmetric (mean reversion, momentum). Backtest on 1 year of historic data per asset before production; realised edge may vary ±3%.

Set a daily PnL floor per asset; if breached, auto-reduce payout or pause new rounds.

### Operational

- 30-second and 1-minute rounds are the highest-risk timeframes for price feed issues: a 200 ms feed delay can flip ~10% of outcomes. Minimum acceptable uptime SLA for feeds is 99.95%.
- Keep ≥ 3 independent feed sources. If the ecosystem consolidates (e.g., Binance + Coinbase both depend on a single CEX), add a fourth (Kraken + Bybit).

## Review cadence

- Quarterly full register review with CTO + Legal + Head of Risk.
- Immediate review after any SEV-1 or regulatory change.
