-- GROM DefiLlama / dimensions ledger.
-- Only rows with status='confirmed' feed public dailyVolume / dailyFees.
BEGIN;

CREATE TABLE IF NOT EXISTS dimension_fills (
  id                BIGSERIAL PRIMARY KEY,
  dedupe_key        TEXT NOT NULL,
  product           TEXT NOT NULL CHECK (product IN ('swap', 'perps', 'predict', 'xstocks')),
  chain_id          INTEGER NOT NULL,
  chain_key         TEXT NOT NULL,
  tx_hash           TEXT NOT NULL,
  log_index         INTEGER,
  fill_id           TEXT,
  executed_at       TIMESTAMPTZ NOT NULL,
  router            TEXT,
  attribution       TEXT,
  volume_usd        NUMERIC(38, 18) NOT NULL DEFAULT 0 CHECK (volume_usd >= 0),
  fee_usd           NUMERIC(38, 18) NOT NULL DEFAULT 0 CHECK (fee_usd >= 0),
  token_in          TEXT,
  token_out         TEXT,
  amount_in         NUMERIC(78, 0),
  amount_out        NUMERIC(78, 0),
  decimals_in       INTEGER,
  decimals_out      INTEGER,
  status            TEXT NOT NULL DEFAULT 'reported'
                      CHECK (status IN ('reported', 'confirmed', 'rejected')),
  evidence          JSONB NOT NULL DEFAULT '{}'::jsonb,
  wallet_address    TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at      TIMESTAMPTZ,
  CONSTRAINT uq_dimension_fills_dedupe UNIQUE (dedupe_key)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_dimension_fills_fill_id
  ON dimension_fills (product, fill_id)
  WHERE fill_id IS NOT NULL AND fill_id <> '';

CREATE INDEX IF NOT EXISTS idx_dimension_fills_range
  ON dimension_fills (product, chain_id, status, executed_at);

CREATE INDEX IF NOT EXISTS idx_dimension_fills_confirmed
  ON dimension_fills (executed_at)
  WHERE status = 'confirmed';

COMMIT;
