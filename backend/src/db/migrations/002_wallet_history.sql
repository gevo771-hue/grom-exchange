CREATE TABLE IF NOT EXISTS wallet_transfers (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    direction               TEXT NOT NULL CHECK (direction IN ('deposit','withdrawal')),
    asset                   TEXT NOT NULL,
    network                 TEXT NOT NULL,
    address                 TEXT NOT NULL,
    tx_hash                 TEXT,
    amount                  NUMERIC(38,18) NOT NULL CHECK (amount > 0),
    fee                     NUMERIC(38,18) NOT NULL DEFAULT 0 CHECK (fee >= 0),
    status                  TEXT NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending','confirming','completed','failed','cancelled','review')),
    confirmations           INTEGER NOT NULL DEFAULT 0 CHECK (confirmations >= 0),
    required_confirmations  INTEGER NOT NULL DEFAULT 0 CHECK (required_confirmations >= 0),
    note                    TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_transfers_user_time
  ON wallet_transfers (user_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_wallet_transfers_tx_hash
  ON wallet_transfers (tx_hash)
  WHERE tx_hash IS NOT NULL;
