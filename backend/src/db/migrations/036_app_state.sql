-- Small service snapshots that must survive a restart or a deploy
-- (first: the home «NEW» strip — its CoinGecko baseline and last rows, owner 17.11).
CREATE TABLE IF NOT EXISTS app_state (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
