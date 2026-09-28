# GROM Exchange

GROM — некастодиальный DEX-хаб. Пользователь подключает свой кошелёк и подписывает каждую операцию сам; GROM не хранит пользовательские средства.

## Текущий продукт

- Instant Swap: EVM, Tron, BTC-маршруты и Solana через backend proxy.
- Trade: Hyperliquid Spot и Perpetual Futures.
- Predict: Polymarket.
- xStocks: токенизированные акции через поддерживаемые on-chain маршруты.
- Авторизация: WalletConnect/SIWE без email, паролей и 2FA.

## Структура

| Путь | Назначение |
|---|---|
| `backend/` | Express API, агрегаторы, SIWE, миграции и тесты |
| `frontend/public/` | Канонический статический frontend |
| `docs/` | Актуальная архитектура, deployment/runbook и inventory удалённого runtime |
| `scripts/` | Сборка, проверки, backup/restore и smoke |
| `defillama/` | Адаптер публичной аналитики |
| `docker-compose.yml` | Локальный и production Docker stack |

## Локальный запуск

```bash
cp .env.example .env
cd backend && npm ci && npm test
cd .. && docker compose up -d postgres redis backend frontend
```

Frontend собирается командой `node scripts/build-frontend.mjs`, затем обязательно проверяется `node scripts/assert-frontend-clean.mjs`.

## Зафиксированные правила

- Fee для поддерживаемых маршрутов — 20 bps. Маршрут без обязательной fee-конфигурации закрывается fail-closed.
- Jupiter работает только в явном режиме `GROM_JUP_FEE_MODE=free|fee`; текущий план — `free` без комиссии GROM.
- CEX/custody, внутренние балансы, Binary, email/2FA/Privy и fiat-onramp удалены и не должны возвращаться.
- Coinbase Wallet, Binance Web3, BSC и Hyperliquid Spot являются допустимыми wallet/network/DEX интеграциями.
