-- Public invite identity is independent of SIWE login. This table contains no
-- credentials or account statistics and does not create authenticated users.
CREATE TABLE IF NOT EXISTS wallet_referral_links (
  wallet_address TEXT PRIMARY KEY CHECK (wallet_address ~ '^0x[0-9a-f]{40}$'),
  code TEXT NOT NULL UNIQUE CHECK (code ~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{10}$'),
  legacy_code TEXT UNIQUE CHECK (legacy_code ~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO wallet_referral_links (wallet_address, code)
  SELECT wallet_address, referral_code FROM users
  WHERE wallet_address ~ '^0x[0-9a-f]{40}$'
    AND referral_code ~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{10}$'
  ON CONFLICT DO NOTHING;

ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by_wallet TEXT;
UPDATE users AS invitee SET referred_by_wallet=referrer.wallet_address
  FROM users AS referrer
  WHERE invitee.referred_by=referrer.id AND invitee.referred_by_wallet IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_referred_by_wallet
  ON users (referred_by_wallet, created_at DESC) WHERE referred_by_wallet IS NOT NULL;
DO $$ BEGIN
  ALTER TABLE users ADD CONSTRAINT users_referral_wallet_not_self
    CHECK (referred_by_wallet IS NULL OR referred_by_wallet <> wallet_address);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
