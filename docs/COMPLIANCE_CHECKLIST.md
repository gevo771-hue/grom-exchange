# GROM Compliance Checklist

Track with checkboxes. Launch blocker if any critical box is unchecked.

## Entity & licensing (critical)

- [ ] Operating entity incorporated with clear ownership structure
- [ ] Banking relationship established (payments, payroll)
- [ ] Legal opinion from counsel for each target jurisdiction
- [ ] Crypto exchange license or exemption documented
- [ ] Binary options: gambling or derivatives license determination + acquisition
- [ ] Marketing restrictions per jurisdiction mapped

## KYC / AML (critical)

- [ ] KYC provider integrated (Sumsub / Onfido / Jumio). Pick based on: speed, accuracy, cost per verification, coverage of target countries.
- [ ] Tier structure defined. Suggested:
  - Tier 0: connect wallet only → read-only + demo binary options
  - Tier 1: email + basic KYC → $500/day live trade limit
  - Tier 2: full KYC + source of funds → $50k/day
  - Tier 3: enhanced due diligence → bespoke limits
- [ ] AML policy document written + approved by board
- [ ] Designated MLRO (Money Laundering Reporting Officer)
- [ ] Chainalysis KYT or equivalent for on-chain transaction monitoring
- [ ] Travel Rule solution (Notabene, Sumsub Travel Rule) for transfers > threshold
- [ ] Sanctions screening (OFAC, UN, EU) on every deposit/withdrawal address
- [ ] SAR (Suspicious Activity Report) filing playbook

## Data protection

- [ ] GDPR compliant data processing (EU users)
  - [ ] Privacy policy published
  - [ ] Data Processing Agreements with all vendors
  - [ ] DPO designated if thresholds met
  - [ ] Right-to-erasure implemented (except data legally retained for AML: 5y minimum)
- [ ] CCPA notice for California users (even if blocked from trading, marketing may apply)
- [ ] Data residency: primary user data in EU (if EU users) or home jurisdiction
- [ ] Encryption at rest (Postgres TDE or disk-level) + in transit (TLS 1.3)
- [ ] Key management via HSM or cloud KMS; rotation quarterly

## Product disclosures (critical for binary options)

- [ ] Terms of Service with arbitration clause
- [ ] Risk Disclosure Statement accepted on signup
- [ ] Binary options risk warning visible on every trade screen: "Binary options are high-risk. Most retail traders lose money."
- [ ] Explicit profit / loss statistics shown (e.g., "XX% of our binary traders lose money")
- [ ] Responsible trading tools:
  - [ ] Daily deposit / loss limits (user-settable, 24h cooling-off to increase)
  - [ ] Self-exclusion (1 week / 1 month / permanent)
  - [ ] Reality checks (popup every 1h of active trading)
- [ ] No marketing of binary options to users under 21
- [ ] No bonuses / incentives that lock funds (banned under many regimes)

## Technical security (SOC 2 / ISO 27001 readiness)

- [ ] Penetration test (annual + on major release)
- [ ] Bug bounty program (HackerOne / Immunefi)
- [ ] SAST + DAST in CI
- [ ] Dependency scanning (Snyk / Dependabot)
- [ ] Secrets scanning on commits
- [ ] Principle of least privilege: no shared admin accounts
- [ ] MFA enforced on all staff accounts
- [ ] Audit log retention ≥ 1 year (WORM storage for critical actions)
- [ ] Incident response plan tested quarterly
- [ ] Backup restore tested quarterly
- [ ] DR plan with RTO ≤ 4h, RPO ≤ 15 min

## Financial controls

- [ ] Segregation of customer funds (on-chain addresses distinct from operating funds)
- [ ] Proof-of-reserves publish cadence (monthly recommended)
- [ ] External audit of reserves (annual)
- [ ] Crypto custody insurance (BitGo, Coincover, etc.)
- [ ] Binary options settlement float funded separately; monitored daily
- [ ] Tax reporting to users (1099 equivalents per jurisdiction)

## Operational

- [ ] 24/7 on-call rotation
- [ ] Status page (statuspage.io / Atlassian Statuspage)
- [ ] Customer support SLAs (T1 < 1h, T2 < 24h, T3 < 72h)
- [ ] Complaint register + regulatory reporting workflow
- [ ] Vendor risk reviews annual

## Geographic blocking

Current block list (update quarterly):
- United States (CFTC prohibition)
- United Kingdom (FCA retail prohibition)
- EEA retail (ESMA — professionals allowed)
- Sanctioned: Iran, North Korea, Syria, Cuba, Crimea, Donetsk, Luhansk
- High-risk FATF: case-by-case

Enforcement:
- IP geolocation (MaxMind + Cloudflare)
- Self-attestation at KYC
- Wallet address heuristics (on-chain KYT flags sanctioned addresses)
- Both checks must pass; deny if conflict

## Sign-off

Launch requires written sign-off from:
- [ ] CEO
- [ ] CTO
- [ ] MLRO
- [ ] External legal counsel
- [ ] External auditor (for reserves)
