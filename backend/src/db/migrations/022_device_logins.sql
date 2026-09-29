-- Cross-device SIWE: desktop starts, phone (Trust DApp) signs, desktop polls JWT.
CREATE TABLE IF NOT EXISTS device_logins (
  code          TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  message       TEXT NOT NULL,
  nonce         TEXT NOT NULL,
  chain_id      INT  NOT NULL DEFAULT 1,
  status        TEXT NOT NULL DEFAULT 'pending',
  token         TEXT,
  user_json     JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ NOT NULL,
  completed_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_device_logins_expires ON device_logins (expires_at);
CREATE INDEX IF NOT EXISTS idx_device_logins_wallet ON device_logins (wallet_address);
