-- 030: DROP legacy custodial / Binary / internal Spot ledger tables.
-- Prerequisites: 028 write-blocks, 029 DROP of wallet_transfers/queue/etc.
-- Fail-closed: non-zero live balances OR any remaining rows in
--   balances-live, bo_positions, bo_rounds, bo_ledger, spot_orders block DROP.
-- Hyperliquid Spot/Perp do NOT use these tables — balances come from HL API.
-- users / SIWE / activity / admin_settings / notifications stay.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'balances'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM balances
       WHERE mode = 'live' AND (amount > 0 OR locked > 0)
       LIMIT 1
    ) THEN
      RAISE EXCEPTION
        '030_drop_blocked: non-zero live balances — reconcile/archive before DROP';
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'bo_positions'
  ) THEN
    IF EXISTS (SELECT 1 FROM bo_positions LIMIT 1) THEN
      RAISE EXCEPTION
        '030_drop_blocked: bo_positions rows remain — archive before DROP';
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'bo_rounds'
  ) THEN
    IF EXISTS (SELECT 1 FROM bo_rounds LIMIT 1) THEN
      RAISE EXCEPTION
        '030_drop_blocked: bo_rounds rows remain — archive before DROP';
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'bo_ledger'
  ) THEN
    IF EXISTS (SELECT 1 FROM bo_ledger LIMIT 1) THEN
      RAISE EXCEPTION
        '030_drop_blocked: bo_ledger rows remain — archive before DROP';
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'spot_orders'
  ) THEN
    IF EXISTS (SELECT 1 FROM spot_orders LIMIT 1) THEN
      RAISE EXCEPTION
        '030_drop_blocked: spot_orders rows remain — archive before DROP';
    END IF;
  END IF;
END $$;

-- Drop write-block triggers from 028 if still present
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'balances', 'spot_orders', 'bo_rounds', 'bo_positions', 'bo_ledger'
  ]
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = t
    ) THEN
      EXECUTE format('DROP TRIGGER IF EXISTS trg_block_%I ON %I', t, t);
    END IF;
  END LOOP;
END $$;

DROP TABLE IF EXISTS bo_ledger CASCADE;
DROP TABLE IF EXISTS bo_positions CASCADE;
DROP TABLE IF EXISTS bo_rounds CASCADE;
DROP TABLE IF EXISTS spot_orders CASCADE;
DROP TABLE IF EXISTS balances CASCADE;

-- Optional legacy columns on users (safe if absent)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'email'
  ) THEN
    ALTER TABLE users DROP COLUMN IF EXISTS email;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'kyc_status'
  ) THEN
    ALTER TABLE users DROP COLUMN IF EXISTS kyc_status;
  END IF;
END $$;

COMMENT ON SCHEMA public IS
  'GROM non-custodial: balances/bo_*/spot_orders dropped in 030. Hyperliquid Spot/Perp use HL API.';
