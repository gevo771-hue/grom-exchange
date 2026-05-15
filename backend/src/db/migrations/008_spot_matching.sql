BEGIN;

CREATE TABLE IF NOT EXISTS spot_trades (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pair            TEXT NOT NULL,
  price           NUMERIC(24,8) NOT NULL CHECK (price > 0),
  amount          NUMERIC(24,8) NOT NULL CHECK (amount > 0),
  taker_order_id  UUID REFERENCES spot_orders(id) ON DELETE SET NULL,
  maker_order_id  UUID REFERENCES spot_orders(id) ON DELETE SET NULL,
  taker_user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  maker_user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  taker_side      TEXT NOT NULL CHECK (taker_side IN ('buy','sell')),
  fee_taker       NUMERIC(24,8) NOT NULL DEFAULT 0,
  fee_maker       NUMERIC(24,8) NOT NULL DEFAULT 0,
  quote_volume    NUMERIC(24,8) NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS spot_trades_pair_ts ON spot_trades (pair, created_at DESC);
CREATE INDEX IF NOT EXISTS spot_trades_user ON spot_trades (taker_user_id, created_at DESC);

ALTER TABLE spot_orders
  ADD COLUMN IF NOT EXISTS fee_paid NUMERIC(24,8) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_fill_price NUMERIC(24,8);

CREATE INDEX IF NOT EXISTS spot_orders_book
  ON spot_orders (pair, side, status, price, created_at)
  WHERE status IN ('open','partial');

COMMIT;
