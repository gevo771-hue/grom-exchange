-- Client activity log for admin analytics (swaps, auth, binary, etc.)
BEGIN;

CREATE TABLE IF NOT EXISTS user_activity (
  id              BIGSERIAL PRIMARY KEY,
  user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  wallet_address  TEXT,
  product         TEXT NOT NULL,
  action          TEXT NOT NULL,
  detail          JSONB NOT NULL DEFAULT '{}'::jsonb,
  tx_hash         TEXT,
  amount          NUMERIC(38,18),
  asset           TEXT,
  status          TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_activity_created ON user_activity (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_activity_product ON user_activity (product, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_activity_user ON user_activity (user_id, created_at DESC);

COMMIT;
