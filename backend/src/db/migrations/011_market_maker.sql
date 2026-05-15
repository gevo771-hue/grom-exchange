-- Migration 011 — autonomous market maker state.

BEGIN;

CREATE TABLE IF NOT EXISTS mm_positions (
  pair                 TEXT PRIMARY KEY,
  net_position         NUMERIC(38,18) NOT NULL DEFAULT 0,
  avg_entry_price      NUMERIC(24,8),
  hedged_position      NUMERIC(38,18) NOT NULL DEFAULT 0,
  realised_pnl_usdt    NUMERIC(38,18) NOT NULL DEFAULT 0,
  unrealised_pnl_usdt  NUMERIC(38,18) NOT NULL DEFAULT 0,
  last_updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mm_quotes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pair        TEXT NOT NULL,
  side        TEXT NOT NULL CHECK (side IN ('buy','sell')),
  layer       INTEGER NOT NULL CHECK (layer >= 1),
  price       NUMERIC(24,8) NOT NULL CHECK (price > 0),
  size        NUMERIC(24,8) NOT NULL CHECK (size > 0),
  filled_size NUMERIC(24,8) NOT NULL DEFAULT 0,
  order_id    UUID REFERENCES spot_orders(id) ON DELETE SET NULL,
  status      TEXT NOT NULL DEFAULT 'placed' CHECK (status IN ('placed','cancelled','partial','filled')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS mm_quotes_active
  ON mm_quotes(pair, status)
  WHERE status IN ('placed','partial');

CREATE TABLE IF NOT EXISTS mm_hedges (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_order_id  UUID REFERENCES spot_orders(id) ON DELETE SET NULL,
  pair              TEXT NOT NULL,
  side              TEXT NOT NULL CHECK (side IN ('buy','sell')),
  size              NUMERIC(24,8) NOT NULL CHECK (size > 0),
  price             NUMERIC(24,8),
  binance_order_id  TEXT,
  binance_status    TEXT,
  executed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mm_pair_settings (
  pair               TEXT PRIMARY KEY,
  spread_bps         NUMERIC(12,4),
  size_base          NUMERIC(24,8),
  max_position_base  NUMERIC(24,8),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMIT;
