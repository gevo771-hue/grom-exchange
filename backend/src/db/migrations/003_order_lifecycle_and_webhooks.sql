ALTER TABLE spot_orders
  ADD COLUMN IF NOT EXISTS reserved_asset TEXT,
  ADD COLUMN IF NOT EXISTS reserved_amount NUMERIC(24,8) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trigger_price NUMERIC(24,8),
  ADD COLUMN IF NOT EXISTS client_order_id TEXT,
  ADD COLUMN IF NOT EXISTS last_fill_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_spot_orders_status ON spot_orders (user_id, status, updated_at DESC);

ALTER TABLE wallet_transfers
  ADD COLUMN IF NOT EXISTS provider TEXT,
  ADD COLUMN IF NOT EXISTS external_ref TEXT,
  ADD COLUMN IF NOT EXISTS settled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS webhook_payload JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_wallet_transfers_external_ref
  ON wallet_transfers (external_ref)
  WHERE external_ref IS NOT NULL;

CREATE TABLE IF NOT EXISTS futures_positions (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    contract      TEXT NOT NULL,
    side          TEXT NOT NULL CHECK (side IN ('long','short')),
    leverage      INTEGER NOT NULL CHECK (leverage >= 1 AND leverage <= 100),
    size          NUMERIC(24,8) NOT NULL CHECK (size > 0),
    entry_price   NUMERIC(24,8) NOT NULL CHECK (entry_price > 0),
    mark_price    NUMERIC(24,8) NOT NULL CHECK (mark_price > 0),
    margin_usdt   NUMERIC(24,8) NOT NULL CHECK (margin_usdt >= 0),
    liq_price     NUMERIC(24,8),
    status        TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed','liquidated')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_futures_positions_user ON futures_positions (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS futures_orders (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    contract      TEXT NOT NULL,
    side          TEXT NOT NULL CHECK (side IN ('buy','sell')),
    type          TEXT NOT NULL CHECK (type IN ('market','limit','stop')),
    price         NUMERIC(24,8),
    size          NUMERIC(24,8) NOT NULL CHECK (size > 0),
    leverage      INTEGER NOT NULL CHECK (leverage >= 1 AND leverage <= 100),
    status        TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','filled','cancelled')),
    reduce_only   BOOLEAN NOT NULL DEFAULT FALSE,
    post_only     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    filled_at     TIMESTAMPTZ,
    cancelled_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_futures_orders_user ON futures_orders (user_id, created_at DESC);
