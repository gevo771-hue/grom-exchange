BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='futures_position_events' AND column_name='position_id' AND data_type <> 'uuid'
  ) THEN
    ALTER TABLE futures_position_events DROP CONSTRAINT IF EXISTS futures_position_events_position_id_fkey;
    ALTER TABLE futures_position_events ALTER COLUMN position_id TYPE UUID USING position_id::text::uuid;
    ALTER TABLE futures_position_events
      ADD CONSTRAINT futures_position_events_position_id_fkey
      FOREIGN KEY (position_id) REFERENCES futures_positions(id) ON DELETE CASCADE;
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS futures_funding (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract       TEXT NOT NULL,
  rate           NUMERIC(18,10) NOT NULL,
  mark_price     NUMERIC(28,8) NOT NULL,
  index_price    NUMERIC(28,8) NOT NULL,
  interval_hours INTEGER NOT NULL DEFAULT 8,
  applied_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS futures_funding_contract_ts ON futures_funding(contract, applied_at DESC);

CREATE TABLE IF NOT EXISTS futures_liquidations (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id            UUID REFERENCES futures_positions(id) ON DELETE SET NULL,
  user_id                UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contract               TEXT NOT NULL,
  side                   TEXT NOT NULL,
  size                   NUMERIC(28,8) NOT NULL,
  mark_price             NUMERIC(28,8) NOT NULL,
  liq_price              NUMERIC(28,8),
  bankruptcy_price       NUMERIC(28,8),
  realised_pnl           NUMERIC(28,8) NOT NULL DEFAULT 0,
  insurance_contribution NUMERIC(28,8) NOT NULL DEFAULT 0,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS futures_liquidations_contract_ts ON futures_liquidations(contract, created_at DESC);
CREATE INDEX IF NOT EXISTS futures_liquidations_user_ts ON futures_liquidations(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS futures_insurance (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset      TEXT NOT NULL DEFAULT 'USDT',
  balance    NUMERIC(38,18) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(asset)
);
INSERT INTO futures_insurance (asset, balance)
VALUES ('USDT', 0)
ON CONFLICT (asset) DO NOTHING;

ALTER TABLE futures_positions
  ADD COLUMN IF NOT EXISTS margin_mode TEXT NOT NULL DEFAULT 'cross',
  ADD COLUMN IF NOT EXISTS unrealised_pnl NUMERIC(28,8) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS funding_paid NUMERIC(28,8) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS futures_positions_active
  ON futures_positions(contract, status)
  WHERE status='open';

COMMIT;
