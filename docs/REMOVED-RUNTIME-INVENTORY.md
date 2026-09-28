# Removed runtime inventory (current)

Physical deletions / unmounts (not 410 stubs).

## Backend routes removed (now 404)
- `/auth/email-login`, `/auth/2fa/setup|verify|disable`
- `/api/wallet/deposit-address`, `/api/wallet/whitelist*`, `/api/wallet/withdrawals*`
- `/api/webhooks/wallet-settlement`, `/api/webhooks/moonpay`, `/api/webhooks/transak`
- Admin: `/kyc/*`, `/withdrawals*`, `/wallet/reserves|sweep-now|test-broadcast`, `/email-templates*`, `/binance/*`, `/treasury/summary`, `/users/:id/balance-adjust|limits`
- `/api/binary` (Binary Options)

## Modules deleted
- `backend/src/utils/onramp-adapters.js`
- `backend/src/utils/provider-webhooks.js`
- `frontend/public/grom-privy.js`
- `backend/test/r02-r06-wallet-webhooks.test.js`

## Config / compose
- Retired Binance/Kraken/Coinbase/Hummingbot/MM/KYC/onramp/hot-wallet shapes removed from `config/index.js`
- Hummingbot service removed from `docker-compose.yml`

## Frontend
- 2FA / withdraw-signature toast stubs removed from `index.html`
- Cash / MoonPay / Transak / fiat providers removed
- Custodial Convert paper path removed from Instant Swap submit
- Inline no-fee DEX fallback already retired (throws)

## Migrations
- `028_decommission_custodial.sql` — write-block triggers
- `029_remove_custodial_schema.sql` — fail-closed DROP of custodial tables

## Allowlist exceptions (not CEX)
- BSC chain id 56, BNB, BscScan, CoinGecko binancecoin
- Coinbase Wallet / Binance Web3 as WC connectors
- Historical SQL migrations ≤032
