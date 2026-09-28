-- 029: Physically drop custodial CEX tables after 028 write-blocks.
-- Fail-closed: unknown / NULL statuses and live balances block DROP.
-- spot_orders stays (matching-engine scaffold from 001_init).
-- users + balances stay for admin reads; 030 may DROP balances after product confirms.
-- Must live in backend/src/db/migrations/ so migrate.js + Docker init see it.

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
        '029_remove_custodial_blocked: non-zero live balances — reconcile before DROP';
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
        '029_remove_custodial_blocked: open withdrawal_queue rows — manual reconciliation required';
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
        '029_remove_custodial_blocked: nonterminal wallet_transfers — manual reconciliation required';
    END IF;
  END IF;
END $$;

-- Drop write-block triggers from 028 (tables may still exist briefly)
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
    END IF;
  END LOOP;
END $$;

DROP TABLE IF EXISTS wallet_transfers CASCADE;
DROP TABLE IF EXISTS withdrawal_queue CASCADE;
DROP TABLE IF EXISTS deposit_addresses CASCADE;
DROP TABLE IF EXISTS address_whitelist CASCADE;
DROP TABLE IF EXISTS wallet_action_challenges CASCADE;

DROP FUNCTION IF EXISTS grom_block_custodial_write() CASCADE;

DO $$
BEGIN
  RAISE NOTICE
    '029: custodial tables dropped. balances/users kept for admin — 030 may DROP balances after product confirms admin no longer needs them. spot_orders kept (matching engine).';
END $$;
