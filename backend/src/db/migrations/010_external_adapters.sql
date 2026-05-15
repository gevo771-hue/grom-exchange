BEGIN;

ALTER TABLE notifications_outbox
  ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'sendgrid',
  ADD COLUMN IF NOT EXISTS provider_message_id TEXT,
  ADD COLUMN IF NOT EXISTS provider_error TEXT;

CREATE TABLE IF NOT EXISTS email_templates (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key TEXT NOT NULL UNIQUE,
  subject_tpl  TEXT NOT NULL,
  html_tpl     TEXT NOT NULL,
  text_tpl     TEXT NOT NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO email_templates (template_key, subject_tpl, html_tpl, text_tpl)
VALUES
  ('withdraw_otp', 'GROM withdrawal code: ${otp}', '<p>Your withdrawal code is <b>${otp}</b>. Amount: ${amount} ${asset} on ${network}.</p>', 'Your withdrawal code is ${otp}. Amount: ${amount} ${asset} on ${network}.'),
  ('withdraw_approved', 'GROM withdrawal approved', '<p>Your ${amount} ${asset} withdrawal was approved and queued for broadcast.</p>', 'Your ${amount} ${asset} withdrawal was approved and queued for broadcast.'),
  ('withdraw_rejected', 'GROM withdrawal rejected', '<p>Your ${amount} ${asset} withdrawal was rejected. Reason: ${reason}</p>', 'Your ${amount} ${asset} withdrawal was rejected. Reason: ${reason}'),
  ('withdraw_completed', 'GROM withdrawal completed', '<p>Your ${amount} ${asset} withdrawal completed. Tx: ${tx_hash}</p>', 'Your ${amount} ${asset} withdrawal completed. Tx: ${tx_hash}'),
  ('withdraw_failed', 'GROM withdrawal failed', '<p>Your ${amount} ${asset} withdrawal failed. Reason: ${reason}</p>', 'Your ${amount} ${asset} withdrawal failed. Reason: ${reason}'),
  ('login_alert', 'New GROM login', '<p>New login detected for your GROM account.</p>', 'New login detected for your GROM account.'),
  ('kyc_status_changed', 'GROM KYC status changed', '<p>Your KYC status is now ${status}.</p>', 'Your KYC status is now ${status}.'),
  ('futures_liquidated', 'GROM futures position liquidated', '<p>Your ${contract} ${side} position was liquidated at ${mark_price}.</p>', 'Your ${contract} ${side} position was liquidated at ${mark_price}.')
ON CONFLICT (template_key) DO NOTHING;

ALTER TABLE withdrawal_queue
  ADD COLUMN IF NOT EXISTS confirmations INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS provider_error TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name='withdrawal_queue' AND constraint_name LIKE '%status%'
  ) THEN
    ALTER TABLE withdrawal_queue DROP CONSTRAINT IF EXISTS withdrawal_queue_status_check;
  END IF;
END$$;

ALTER TABLE withdrawal_queue
  ADD CONSTRAINT withdrawal_queue_status_check
  CHECK (status IN ('queued','signing','broadcast','confirmed','failed','awaiting_topup'));

CREATE TABLE IF NOT EXISTS hot_wallets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset       TEXT NOT NULL,
  network     TEXT NOT NULL,
  address     TEXT NOT NULL,
  kms_key_id  TEXT,
  enabled     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS hot_wallets_asset_network
  ON hot_wallets(asset, network)
  WHERE enabled;

COMMIT;
