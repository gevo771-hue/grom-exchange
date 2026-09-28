# GROM production runbook

## Быстрая диагностика

```bash
curl -fsS https://grom.exchange/health
docker ps --format '{{.Names}} {{.Status}}'
docker logs --tail=200 grom_backend
docker logs --tail=100 grom_frontend
```

Проверка конфигурации свопа выполняется через `GET /api/swap/public-config`. Секретные значения endpoint публиковать не должен.

## Swap incidents

- `503` от конкретного агрегатора: проверить его fee identifier/API key и upstream status. Не включать no-fee fallback для fee-обязательных EVM-маршрутов.
- Jupiter unavailable: проверить явный `GROM_JUP_FEE_MODE`. В `free` комиссии GROM нет; в `fee` обязательны per-mint accounts, owner и Solana RPC.
- Операция в `unknown`: не снимать lock вручную до проверки chain receipt/nonce. Повторная отправка может создать двойную транзакцию.
- Cross-chain операция: различать `DONE`, `PARTIAL`, `REFUNDED` и незавершённый destination monitoring.

## База данных

Нельзя вручную обнулять или удалять legacy balances/transfers в production. Сначала backup, read-only reconciliation report и dry-run на копии. Миграции применяются по порядку и фиксируются migrator-таблицей.

## Откат

Frontend можно откатить на предыдущий проверенный build. Backend откатывается только если применённые миграции совместимы; иначе делается fix-forward. После любого действия проверить health, public config, логи и read-only котировки без подписи транзакций.
