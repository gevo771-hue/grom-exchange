-- 028: Decommission custodial CEX tables (additive, fail-closed).
-- Blocks NEW writes via triggers (INSERT/UPDATE/DELETE). Does NOT drop tables.
-- Cleanup DROP requires owner review after reconciliation counts are zero.
-- Must live in backend/src/db/migrations/ so migrate.js + Docker init see it.
--
-- Fail-closed: unknown / NULL statuses are treated as nonterminal (must reconcile).

DO $$
DECLARE
  terminal_xfer text[] := ARRAY[
    'completed', 'done', 'failed', 'cancelled', 'canceled',
    'rejected', 'refunded', 'expired'
  ];
  terminal_queue text[] := ARRAY[
    'completed', 'done', 'failed', 'cancelled', 'canceled',
    'rejected', 'expired', 'broadcast_done'
  ];
BEGIN
  -- Guard: abort if live custodial balances remain.
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
        '028_decommission_blocked: non-zero live balances — reconcile before decommission';
    END IF;
  END IF;

  -- Guard: open / unknown withdrawal_queue rows (allowlist terminal only)
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'withdrawal_queue'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM withdrawal_queue
       WHERE status IS NULL
          OR lower(status) <> ALL (terminal_queue)
       LIMIT 1
    ) THEN
      RAISE EXCEPTION
        '028_decommission_blocked: open withdrawal_queue rows — manual reconciliation required';
    END IF;
  END IF;

  -- Guard: nonterminal / unknown wallet_transfers (allowlist terminal only)
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'wallet_transfers'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM wallet_transfers
       WHERE status IS NULL
          OR lower(status) <> ALL (terminal_xfer)
       LIMIT 1
    ) THEN
      RAISE EXCEPTION
        '028_decommission_blocked: nonterminal wallet_transfers — manual reconciliation required';
    END IF;
  END IF;
END $$;

-- Report counts (visible in migration logs)
DO $$
DECLARE
  bal_n int := 0;
  xfer_n int := 0;
  q_n int := 0;
  wl_n int := 0;
  dep_n int := 0;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='balances') THEN
    SELECT COUNT(*) INTO bal_n FROM balances;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='wallet_transfers') THEN
    SELECT COUNT(*) INTO xfer_n FROM wallet_transfers;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='withdrawal_queue') THEN
    SELECT COUNT(*) INTO q_n FROM withdrawal_queue;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='address_whitelist') THEN
    SELECT COUNT(*) INTO wl_n FROM address_whitelist;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='deposit_addresses') THEN
    SELECT COUNT(*) INTO dep_n FROM deposit_addresses;
  END IF;
  RAISE NOTICE '028 custodial counts balances=% transfers=% queue=% whitelist=% deposits=%',
    bal_n, xfer_n, q_n, wl_n, dep_n;
END $$;

CREATE OR REPLACE FUNCTION grom_block_custodial_write()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'dex_non_custodial: writes to % are blocked', TG_TABLE_NAME
    USING ERRCODE = 'integrity_constraint_violation';
END;
$$;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'balances',
    'wallet_transfers',
    'withdrawal_queue',
    'deposit_addresses',
    'address_whitelist',
    'wallet_action_challenges',
    'spot_orders'
  ]
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = t
    ) THEN
      EXECUTE format('DROP TRIGGER IF EXISTS trg_block_%I ON %I', t, t);
      EXECUTE format(
        'CREATE TRIGGER trg_block_%I BEFORE INSERT OR UPDATE OR DELETE ON %I
         FOR EACH ROW EXECUTE FUNCTION grom_block_custodial_write()',
        t, t
      );
    END IF;
  END LOOP;
END $$;

COMMENT ON FUNCTION grom_block_custodial_write() IS
  'GROM non-custodial: blocks ledger INSERT/UPDATE/DELETE. DROP tables only after owner cleanup migration.';
