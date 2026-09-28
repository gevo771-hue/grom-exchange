# GROM current product allowlist (2026-09-21)

## Keep and test
- Wallet-only auth / SIWE / WalletConnect
- Instant Swap (fee-verified aggregators)
- **Hyperliquid Spot (L1 CLOB)** via `grom-hyperliquid.js` + `#page-futures` `trade-mode-spot`
- Hyperliquid Perpetual Futures (same Trade page)
- Predict / Polymarket
- xStocks
- On-chain Send / Receive / History
- Admin security, observability, rate limits, audit, health needed by the above

## Explicitly removed
- Legacy autonomous `#page-spot` (CEX desk, fake balances, `submitSpotOrder`)
- Binary Options (DOM, JS, API, `grom-live.js`, BO schema)
- Email / Privy / 2FA / TOTP / OTP
- Fiat on-ramp (MoonPay / Transak / Ramp)
- Custodial ledger tables (`balances`, `spot_orders`, `bo_*`) — migration 030
- CEX API feeds / Hummingbot / hot-wallet signing

## Allowlist exceptions (not CEX trash)
- BSC 56 / BNB / BscScan / CoinGecko `binancecoin`
- Coinbase Wallet + Binance Web3 as WC connectors only
- Historical SQL migrations ≤030
- `trade-mode-spot` / `placeSpotOrder` = Hyperliquid Spot
