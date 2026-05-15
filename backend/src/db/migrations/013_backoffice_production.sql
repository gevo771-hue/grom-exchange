-- Migration 013 — production backoffice, maintenance, controls and alerts.

BEGIN;

CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL DEFAULT 'null'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO settings(key, value)
VALUES ('maintenance_mode', 'false'::jsonb)
ON CONFLICT(key) DO NOTHING;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspended_reason TEXT,
  ADD COLUMN IF NOT EXISTS daily_withdrawal_usd NUMERIC(24,8),
  ADD COLUMN IF NOT EXISTS weekly_withdrawal_usd NUMERIC(24,8);

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    UUID,
  action      TEXT NOT NULL,
  target_id   TEXT,
  target_type TEXT,
  payload     JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip          TEXT,
  ua          TEXT,
  ts          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS admin_audit_actor_ts ON admin_audit_log(actor_id, ts DESC);
CREATE INDEX IF NOT EXISTS admin_audit_action_ts ON admin_audit_log(action, ts DESC);

CREATE TABLE IF NOT EXISTS product_status (
  product    TEXT PRIMARY KEY,
  paused     BOOLEAN NOT NULL DEFAULT FALSE,
  killed     BOOLEAN NOT NULL DEFAULT FALSE,
  reason     TEXT,
  updated_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO product_status(product, paused, killed)
VALUES ('spot', FALSE, FALSE), ('futures', FALSE, FALSE), ('binary', FALSE, FALSE)
ON CONFLICT(product) DO NOTHING;

CREATE TABLE IF NOT EXISTS symbols (
  pair            TEXT PRIMARY KEY,
  taker_fee_bps   NUMERIC(12,4),
  maker_fee_bps   NUMERIC(12,4),
  min_order_size   NUMERIC(24,8),
  max_leverage     INTEGER,
  enabled          BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO symbols(pair, enabled)
VALUES ('BTC/USDT', TRUE), ('ETH/USDT', TRUE), ('SOL/USDT', TRUE), ('XRP/USDT', TRUE)
ON CONFLICT(pair) DO NOTHING;

CREATE TABLE IF NOT EXISTS alerts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type        TEXT NOT NULL,
  severity    TEXT NOT NULL DEFAULT 'medium',
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  payload     JSONB NOT NULL DEFAULT '{}'::jsonb,
  status      TEXT NOT NULL DEFAULT 'open',
  ts          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  resolution  TEXT
);

CREATE INDEX IF NOT EXISTS alerts_status_severity_ts ON alerts(status, severity, ts DESC);

COMMIT;
