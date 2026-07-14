# GROM load tests (k6)

```bash
brew install k6
# Smoke (safe):
k6 run scripts/load/A_landing.js
# Stress (prefer staging / off-peak):
k6 run -e BASE_URL=https://grom.exchange scripts/load/A_landing.js
```

| Script | What |
|---|---|
| `A_landing.js` | Public pages (landing / markets / predict) |
| `B_siwe.js` | Auth nonce + verify burst |
| `C_swap_quote.js` | Swap quote storm |
| `D_orderbook.js` | Spot orderbook flood |

Do **not** run stress against prod at peak hours.
