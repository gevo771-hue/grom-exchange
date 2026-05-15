BEGIN;

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
  CHECK (status IN (
    'pending','awaiting_otp','awaiting_review','approved','queued','signing','broadcast',
    'confirming','completed','failed','cancelled','review','rejected'
  ));

CREATE TABLE IF NOT EXISTS webhook_events (
  id            BIGSERIAL PRIMARY KEY,
  provider      TEXT NOT NULL,
  external_id   TEXT NOT NULL,
  payload_hash  TEXT NOT NULL,
  processed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, external_id)
);

CREATE TABLE IF NOT EXISTS sweep_transfers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset           TEXT NOT NULL,
  amount          NUMERIC(38,18) NOT NULL CHECK (amount > 0),
  hot_address     TEXT NOT NULL,
  cold_address    TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'queued'
                  CHECK (status IN ('queued','signing','broadcast','confirmed','failed')),
  tx_hash         TEXT,
  attempts        INTEGER NOT NULL DEFAULT 0,
  last_error      TEXT,
  created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  broadcast_at    TIMESTAMPTZ,
  confirmed_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_sweep_transfers_status
  ON sweep_transfers(status, created_at);

COMMIT;
