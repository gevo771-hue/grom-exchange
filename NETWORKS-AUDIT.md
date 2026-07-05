# GROM · Networks & Coins Audit (2026-07-05)

Snapshot of what's supported for each user flow.

Legend: ✓ live · ⚠ works but needs testing · ✗ not implemented

## Deposit (custodial + on-chain)

Backend `backend/src/integrations/binance/network-map.js` — 13 networks × ~11 assets.

| Network             | Assets                                                     | Fee   | ETA  | Memo |
|---------------------|------------------------------------------------------------|-------|------|------|
| Ethereum (ERC-20)   | USDT, USDC, ETH                                            | ~$3.0 | 5m   | –    |
| Arbitrum One        | USDT, USDC, ETH                                            | ~$0.1 | 3m   | –    |
| Optimism            | USDT, USDC, ETH                                            | ~$0.1 | 3m   | –    |
| Polygon (PoS)       | USDT, USDC, MATIC                                          | ~$0.05| 5m   | –    |
| Base                | USDC, ETH                                                  | ~$0.05| 3m   | –    |
| BNB Chain (BEP-20)  | USDT, USDC, BNB, BTC, ETH, SOL, MATIC, AVAX, TON, XRP      | ~$0.3 | 3m   | –    |
| Avalanche C-Chain   | USDT, USDC, AVAX                                           | ~$0.5 | 2m   | –    |
| Linea               | USDC, ETH                                                  | ~$0.05| 5m   | –    |
| Tron (TRC-20)       | USDT, TRX                                                  | ~$1.0 | 3m   | –    |
| Bitcoin             | BTC                                                        | ~$2.0 | 30m  | –    |
| Solana              | USDT, USDC, SOL                                            | ~$0.01| 1m   | –    |
| TON                 | TON, USDT                                                  | ~$0.1 | 1m   | **yes** |
| XRP Ledger          | XRP                                                        | ~$0.5 | 1m   | **yes** |

**Requires `BINANCE_HOT_WALLET=true`** in prod `.env` to return real Binance addresses. Without it, backend returns 503 as safety guard (task #56).

## Send (on-chain from connected wallet)

Frontend `gwSubmitSend` in `grom-wallet.js` — EVM chains only (WalletConnect + injected).

| Chain    | Native | ERC-20 supported                        |
|----------|--------|-----------------------------------------|
| Ethereum | ETH ✓  | USDT (6dp), USDC (6dp), DAI (18), WBTC (8) |
| Arbitrum | ETH ✓  | USDT (6), USDC (6), DAI (18)            |
| Base     | ETH ✓  | USDC (6)                                |
| Optimism | ETH ✓  | USDT (6), USDC (6)                      |
| BSC      | BNB ✓  | USDT (18!), USDC (18), BUSD, ETH, BTC (BTCB), CAKE |
| Polygon  | MATIC ✓| USDT (6), USDC (6), DAI (18), WBTC (8)  |
| Avalanche| AVAX ✓ | USDT (6), USDC (6)                      |

**Not supported by Send:** Tron, Bitcoin, Solana, TON, XRP — need non-EVM signers, roadmap item.

**Fixed 2026-07-05:** USDT/USDC decimals per chain (BSC = 18dp, all others = 6dp — used to hard-code 6 which sent 1e12× less on BSC).

## Swap — Trading account (paper mode)

Backend `backend/src/swap/routes.js` — `GROM_SWAP_MODE=paper`. Uses Binance public ticker + postgres balances.

| Assets (any pair) | USDT USDC BTC ETH BNB SOL XRP TRX DOGE ADA AVAX MATIC DOT LINK ATOM LTC UNI SHIB NEAR APT ARB OP INJ TIA SUI ETC FIL BCH ALGO XLM PEPE FLOKI |
|-------------------|-----------------------------------------------------|
| **32 assets, any pair** | Live rate from `api.binance.com/api/v3/ticker/price` |
| Fee               | 0.10% (GROM), no network fee                        |
| Min / Max         | $1 / $10 000 (per config.swap)                      |

Requires JWT (auth). Runs on postgres balance table. Instant.

## Swap — On-chain (inline via routers, no external tabs)

Frontend `gwOnChainSwapExec` — manual ABI encoding, no ethers dep.

| Chain    | Router            | Native ↔ USDT/USDC/…                    |
|----------|-------------------|-----------------------------------------|
| BSC      | PancakeSwap V2 ✓ | BNB ↔ USDT/USDC/BUSD/ETH/BTC/CAKE       |
| Ethereum | Uniswap V2 ✓     | ETH ↔ USDT/USDC/DAI/WBTC                |
| Arbitrum | ⚠ TODO (SushiSwap) | Falls back to 1inch tab                 |
| Polygon  | ⚠ TODO (QuickSwap) | Falls back to 1inch tab                 |
| Base     | ⚠ TODO (Aerodrome) | Falls back to 1inch tab                 |
| Optimism | ⚠ TODO (Velodrome) | Falls back to 1inch tab                 |
| Avalanche| ⚠ TODO (TraderJoe) | Falls back to 1inch tab                 |

Slippage: 0.5% hardcode.
Approve: MaxUint256 (once per token per router).

## On-chain balance card (Wallet page)

Reads native + USDT/USDC across 5 EVM chains: **Ethereum · Arbitrum · Polygon · Base · BSC**.
Missing: Optimism, Avalanche, Linea, Fantom, Tron, Solana, Bitcoin.

## Roadmap by user impact

**Now:**
- ✅ Send: WC provider + correct decimals (done 2026-07-05)
- ✅ Inline swap: BSC + ETH (done 2026-07-05)

**Next (small):**
- Add Optimism + Base + AVAXC inline swap (SushiSwap routers)
- Add Optimism + Avalanche to on-chain balance card
- Fantom EVM chain support (RPC + tokens)

**Later:**
- Tron send/swap (non-EVM, needs tronweb SDK)
- Solana send/swap (non-EVM, needs @solana/web3.js)
- Bitcoin send (BTC bech32 signing)
