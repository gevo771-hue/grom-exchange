-- Minimal referral attribution. Rewards, commissions and payouts are not
-- configured; this records only a one-time account-to-account invite link.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS referral_code TEXT,
  ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS referred_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_referral_code_unique
  ON users (referral_code)
  WHERE referral_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_referred_by_created
  ON users (referred_by, created_at DESC)
  WHERE referred_by IS NOT NULL;

DO $$
BEGIN
ALTER TABLE users
  ADD CONSTRAINT users_referral_not_self
    CHECK (referred_by IS NULL OR referred_by <> id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
