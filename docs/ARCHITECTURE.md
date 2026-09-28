# GROM architecture

GROM — wallet-only некастодиальный DEX-хаб. Средства остаются в кошельке пользователя, а каждая транзакция требует его подписи.

## Потоки

```text
Wallet / WalletConnect / Phantom
              │
              ▼
Static frontend ──► GROM backend proxies ──► DEX aggregators
              │                              Hyperliquid
              │                              Polymarket
              └──────── user signature ───► on-chain settlement
```

- Instant Swap получает котировки через backend, проверяет fee-контекст и отправляет выбранную транзакцию в активный кошелёк.
- Hyperliquid Spot/Perp использует собственный некастодиальный торговый контур Hyperliquid.
- Predict и xStocks используют поддерживаемые внешние on-chain протоколы.
- SIWE/JWT подтверждает владение кошельком; email, пароль и 2FA отсутствуют.
- Postgres хранит техническое состояние, аудит и историю операций, но не пользовательский торговый баланс.
- Redis используется для cache, rate limits и операционных locks.

## Fee policy

- Базовая комиссия GROM: 20 bps (`0.002`) там, где интеграция её поддерживает и может подтвердить.
- Aggregator fee-параметры задаёт backend; client override игнорируется.
- Непроверяемый fee-контекст закрывает маршрут fail-closed.
- Jupiter: `free` означает 0% комиссии GROM; `fee` требует per-mint accounts, owner и Solana RPC.

## Исключено

Custodial deposits/withdrawals, внутренний ledger, CEX order book, Binary Options, hot-wallet signing, email/2FA/Privy, KYC/CEX admin и fiat-onramp не входят в продукт и удалены из runtime.
