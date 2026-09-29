-- Wallet-signature withdrawals (replace email OTP / TOTP).
-- Additive: keep old otp_* columns; stop writing them. Cancel stale OTP drafts.
-- Clean DEX installs may never have created wallet_transfers — do not FK to it.

CREATE TABLE IF NOT EXISTS wallet_action_challenges (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id),
  transfer_id     UUID,
  action          TEXT NOT NULL,
  nonce           TEXT NOT NULL UNIQUE,
  domain          TEXT NOT NULL,
  payload         JSONB NOT NULL,
  payload_hash    TEXT NOT NULL,
  message_to_sign TEXT NOT NULL,
  expires_at      TIMESTAMPTZ NOT NULL,
  used_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_action_challenges_transfer
  ON wallet_action_challenges (transfer_id);

CREATE INDEX IF NOT EXISTS idx_wallet_action_challenges_user_open
  ON wallet_action_challenges (user_id) WHERE used_at IS NULL;

-- Unique refund marker (idempotent reject) — only when wallet_audit exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'wallet_audit'
  ) THEN
    EXECUTE $sql$
      CREATE UNIQUE INDEX IF NOT EXISTS uq_wallet_audit_reject_refund
        ON wallet_audit (transfer_id)
        WHERE type = 'withdrawal_reject_refund'
    $sql$;
  END IF;
END $$;

-- Cancel unfinished OTP withdrawals — only if legacy custodial table exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'wallet_transfers'
  ) THEN
    UPDATE wallet_transfers
       SET status = 'cancelled',
           note = COALESCE(note, '') || ' [cancelled: otp flow retired]',
           updated_at = NOW()
     WHERE direction = 'withdrawal'
       AND status = 'awaiting_otp';
  END IF;
END $$;
