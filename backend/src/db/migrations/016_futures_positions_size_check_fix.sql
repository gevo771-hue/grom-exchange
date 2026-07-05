-- 016_futures_positions_size_check_fix.sql
--
-- Bug (spammed prod logs every second, 2026-07-05):
--   "new row for relation \"futures_positions\" violates check constraint
--    \"futures_positions_size_check\""
--   coming from processTpSl / processLiquidations / closeFuturesPosition,
--   which set `size=0` for fully-closed positions.
--
-- The original check `size > 0` (migration 003) was correct at open time
-- but incompatible with the full-close code path, which needs to write
-- `size=0, status='closed'` in a single UPDATE.
--
-- Fix: relax the constraint to `size >= 0`. Openness is already guaranteed
-- by the `status IN ('open','closed','liquidated')` field, and the entry
-- path (openFuturesPosition) still enforces `input.size > 0` at the API
-- boundary, so this is safe.
DO $$
DECLARE
  con_name TEXT;
BEGIN
  SELECT conname INTO con_name
    FROM pg_constraint
   WHERE conrelid = 'futures_positions'::regclass
     AND contype = 'c'
     AND pg_get_constraintdef(oid) ILIKE '%(size%>%0)%';

  IF con_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE futures_positions DROP CONSTRAINT ' || quote_ident(con_name);
  END IF;
END $$;

ALTER TABLE futures_positions
  ADD CONSTRAINT futures_positions_size_check
  CHECK (size >= 0);

-- Also relax entry_price and mark_price constraints defensively — a
-- fully-closed position may retain the last known prices, but future
-- code paths may want to clear them. Keep them strictly positive for
-- now since the current code never writes 0.

-- Index that supports the mark-loop hot path: SELECT DISTINCT contract
-- WHERE status='open'. Without it, every tick full-scans the table.
CREATE INDEX IF NOT EXISTS idx_futures_positions_open_contract
  ON futures_positions (contract)
  WHERE status = 'open';

-- Slow-query hint (routes /api/futures/positions) — list current user's
-- positions ordered by created_at. Add a composite index that matches
-- the most common WHERE + ORDER BY pattern.
CREATE INDEX IF NOT EXISTS idx_futures_positions_user_status
  ON futures_positions (user_id, status, created_at DESC);

-- Slow query surfaced in prod logs (2026-07-05, 282-444 ms):
--   backend/src/spot/stop-worker.js tick() polls every 2s:
--   SELECT ... FROM spot_orders WHERE status='pending_trigger'
--                              ORDER BY updated_at ASC LIMIT 100
-- Without a partial index this seq-scans the whole spot_orders table
-- every 2s once we have >a few thousand rows. Partial-index the
-- pending-trigger slice by updated_at.
CREATE INDEX IF NOT EXISTS idx_spot_orders_pending_trigger_updated
  ON spot_orders (updated_at ASC)
  WHERE status = 'pending_trigger';

-- Bonus: /api/spot/orders route filters user_id + status often.
CREATE INDEX IF NOT EXISTS idx_spot_orders_user_status_created
  ON spot_orders (user_id, status, created_at DESC);
