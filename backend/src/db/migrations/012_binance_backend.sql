-- Migration 012 — Binance backend hot-wallet mode.

BEGIN;

ALTER TABLE wallet_transfers
  ADD COLUMN IF NOT EXISTS binance_deposit_id TEXT,
  ADD COLUMN IF NOT EXISTS binance_withdraw_id TEXT;

CREATE INDEX IF NOT EXISTS wallet_transfers_binance_deposit_id
  ON wallet_transfers(binance_deposit_id)
  WHERE binance_deposit_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS binance_subaccounts (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  binance_email          TEXT UNIQUE NOT NULL,
  binance_subaccount_id  TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS binance_deposit_addresses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  asset       TEXT NOT NULL,
  network     TEXT NOT NULL,
  address     TEXT NOT NULL,
  memo        TEXT,
  fetched_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, asset, network)
);

CREATE INDEX IF NOT EXISTS binance_deposit_addresses_address
  ON binance_deposit_addresses(address);

CREATE TABLE IF NOT EXISTS binance_withdrawal_log (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id           UUID REFERENCES wallet_transfers(id) ON DELETE CASCADE,
  binance_withdraw_id   TEXT,
  binance_status        TEXT,
  binance_response      JSONB NOT NULL DEFAULT '{}'::jsonb,
  polled_at             TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS binance_withdrawal_log_transfer
  ON binance_withdrawal_log(transfer_id);

CREATE INDEX IF NOT EXISTS binance_withdrawal_log_withdraw_id
  ON binance_withdrawal_log(binance_withdraw_id)
  WHERE binance_withdraw_id IS NOT NULL;

INSERT INTO email_templates (template_key, subject_tpl, html_tpl, text_tpl)
VALUES
  ('deposit_confirmed', 'GROM deposit confirmed', '<p>Your ${asset} deposit of ${amount} is confirmed.</p>', 'Your ${asset} deposit of ${amount} is confirmed.')
ON CONFLICT (template_key) DO NOTHING;

COMMIT;
