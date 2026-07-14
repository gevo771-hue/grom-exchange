-- 017_load_indexes.sql
-- Extra indexes for auth'd history / transfer / swap lookups under load.

CREATE INDEX IF NOT EXISTS idx_wallet_transfers_user_created
  ON wallet_transfers (user_id, created_at DESC);

-- swap_events may not exist on older installs — guard via DO block
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'swap_events'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_swap_events_user_created
             ON swap_events (user_id, created_at DESC)';
  END IF;
END $$;
