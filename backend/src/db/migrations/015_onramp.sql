-- Migration 015 — MoonPay on-ramp orders.

BEGIN;

CREATE TABLE IF NOT EXISTS onramp_orders (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID REFERENCES users(id) ON DELETE SET NULL,
  provider          TEXT NOT NULL DEFAULT 'moonpay',
  external_order_id TEXT UNIQUE,
  asset             TEXT,
  fiat_currency     TEXT,
  fiat_amount       NUMERIC(24,8),
  crypto_amount     NUMERIC(24,8),
  status            TEXT NOT NULL DEFAULT 'pending',
  wallet_address    TEXT,
  payload           JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS onramp_orders_user_status
  ON onramp_orders(user_id, status);

COMMIT;
