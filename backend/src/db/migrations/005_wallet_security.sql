BEGIN;

-- Allow richer withdrawal lifecycle.
ALTER TABLE wallet_transfers
  ADD COLUMN IF NOT EXISTS otp_code_hash TEXT,
  ADD COLUMN IF NOT EXISTS otp_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS otp_confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approval_required BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS risk_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

DO $$
BEGIN
  BEGIN
    ALTER TABLE wallet_transfers DROP CONSTRAINT IF EXISTS wallet_transfers_status_check;
  EXCEPTION WHEN undefined_object THEN
    NULL;
  END;
END $$;

ALTER TABLE wallet_transfers
  ADD CONSTRAINT wallet_transfers_status_check
  CHECK (status IN ('pending','awaiting_otp','queued','signing','broadcast','confirming','completed','failed','cancelled','review'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_wallet_transfers_user_idempotency
  ON wallet_transfers(user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS two_fa_secrets (
  user_id         UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  secret_base32   TEXT NOT NULL,
  enabled         BOOLEAN NOT NULL DEFAULT FALSE,
  verified_at     TIMESTAMPTZ,
  disabled_at     TIMESTAMPTZ,
  last_used_step  BIGINT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS address_whitelist (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  asset           TEXT,
  network         TEXT NOT NULL,
  address         TEXT NOT NULL,
  label           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at      TIMESTAMPTZ,
  UNIQUE (user_id, network, address)
);
CREATE INDEX IF NOT EXISTS idx_address_whitelist_user
  ON address_whitelist(user_id, revoked_at NULLS FIRST, created_at DESC);

CREATE TABLE IF NOT EXISTS deposit_addresses (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  asset             TEXT NOT NULL,
  network           TEXT NOT NULL,
  address           TEXT NOT NULL,
  derivation_index  INTEGER NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, asset, network),
  UNIQUE (network, address)
);

CREATE TABLE IF NOT EXISTS wallet_audit (
  id              BIGSERIAL PRIMARY KEY,
  user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  transfer_id     UUID REFERENCES wallet_transfers(id) ON DELETE SET NULL,
  type            TEXT NOT NULL,
  asset           TEXT,
  amount          NUMERIC(38,18),
  before_balance  NUMERIC(38,18),
  after_balance   NUMERIC(38,18),
  actor           TEXT NOT NULL DEFAULT 'system',
  reason          TEXT,
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wallet_audit_user_time
  ON wallet_audit(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS withdrawal_queue (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id       UUID NOT NULL UNIQUE REFERENCES wallet_transfers(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  asset             TEXT NOT NULL,
  network           TEXT NOT NULL,
  address           TEXT NOT NULL,
  amount            NUMERIC(38,18) NOT NULL CHECK (amount > 0),
  idempotency_key   TEXT,
  status            TEXT NOT NULL DEFAULT 'queued'
                    CHECK (status IN ('queued','signing','broadcast','confirmed','failed')),
  tx_hash           TEXT,
  attempts          INTEGER NOT NULL DEFAULT 0,
  last_error        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  broadcast_at      TIMESTAMPTZ,
  confirmed_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_withdrawal_queue_status
  ON withdrawal_queue(status, created_at);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  route_key       TEXT NOT NULL,
  request_hash    TEXT NOT NULL,
  response_code   INTEGER,
  response_body   JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours',
  PRIMARY KEY (user_id, route_key)
);
CREATE INDEX IF NOT EXISTS idx_idempotency_expiry ON idempotency_keys(expires_at);

COMMIT;
