# GROM deployment

## Фактическая среда

Production работает на Docker Compose в `/opt/grom-exchange` и использует контейнеры `grom_backend`, `grom_frontend`, `grom_postgres`, `grom_redis`. Отдельной staging-инфраструктуры сейчас нет.

## Проверки перед выкладкой

```bash
cd backend
npm ci
npm test
npm run lint
npm audit --omit=dev --audit-level=high
cd ..
node scripts/assert-frontend-clean.mjs
node scripts/build-frontend.mjs
git diff --check
```

Перед production migration обязательно:

1. Сделать backup Postgres и проверить restore на копии.
2. Сверить четыре legacy balances и открытые transfers; migration 028 должна блокировать продолжение до reconcile.
3. Учесть, что migration 002 нормализует неизвестную роль `market_maker` в `user`.
4. Прогнать полный migration chain 001→текущая на копии БД.

Текущий production rollout намеренно запускает migrator с
`GROM_DEFER_LEGACY_CUSTODIAL=1`. Это оставляет миграции 027–031 pending и
сохраняет существующие balances, transfers и связанные таблицы без изменений;
добавительная migration 032 при этом применяется. Удалять legacy ledger можно
отдельной выкладкой только после reconciliation и owner review. Для чистого CI
и новых баз флаг не задаётся, поэтому полный migration chain продолжает
проверяться.

## Конфигурация

- Секреты находятся только в production `.env`.
- Для текущего Solana-режима установить `GROM_JUP_FEE_MODE=free`; UI должен показывать 0% комиссии GROM.
- Fee-режим Jupiter включается позже только вместе с per-mint fee accounts, owner и RPC.
- Остальные агрегаторы обязаны иметь свои fee identifiers; при отсутствии конфигурации маршрут остаётся недоступным.

Frontend выкладывается только из `frontend/dist/` после clean build. Старое содержимое web-root удаляется перед копированием, чтобы hashed bundles не накапливались. Backend и миграции выкладываются отдельным контролируемым шагом с проверкой `/health` и `/api/swap/public-config`.
