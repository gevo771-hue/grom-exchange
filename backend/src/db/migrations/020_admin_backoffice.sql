-- Admin settings store (prod-safe — existing tables unchanged)
BEGIN;

CREATE TABLE IF NOT EXISTS admin_settings (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  UUID REFERENCES users(id)
);

INSERT INTO admin_settings (key, value) VALUES
  ('maintenance', '{"enabled":false,"reason":"","actor":null,"updated_at":null}'::jsonb),
  ('markets', '{"swap":{"status":"running","reason":""},"futures":{"status":"running","reason":""},"predict":{"status":"running","reason":""},"xstocks":{"status":"running","reason":""}}'::jsonb),
  ('risk', '{"kill_switch":false,"default_swap_slippage_pct":0.5,"futures_max_leverage":50}'::jsonb),
  ('market_config', '{"swap_default_slippage_pct":0.5,"futures_max_leverage":50}'::jsonb),
  ('insurance_fund_usdt', '{"amount":50000}'::jsonb),
  ('desks_pause', '{"until":null,"reason":""}'::jsonb)
ON CONFLICT (key) DO NOTHING;

COMMIT;
