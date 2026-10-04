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

-- Recover previously displayed browser links for all verified accounts, even
-- before they reopen the referral page. Ambiguous legacy hashes are skipped.
CREATE OR REPLACE FUNCTION pg_temp.grom_legacy_invite(wallet TEXT) RETURNS TEXT
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  alphabet TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  seed TEXT := 'grom-invite:' || lower(wallet);
  h BIGINT := 2166136261;
  x BIGINT;
  code TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..length(seed) LOOP
    h := ((h # ascii(substr(seed,i,1))::BIGINT) * 16777619) & 4294967295;
  END LOOP;
  x := h;
  FOR i IN 1..6 LOOP
    code := code || substr(alphabet,(x % 32)::INTEGER + 1,1);
    x := ((x # (x >> 13)) * 1540483477) & 4294967295;
  END LOOP;
  RETURN code;
END $$;
WITH candidates AS (
  SELECT link.wallet_address, pg_temp.grom_legacy_invite(link.wallet_address) AS alias
  FROM wallet_referral_links link JOIN users ON users.wallet_address=link.wallet_address
), unambiguous AS (
  SELECT min(wallet_address) AS wallet_address, alias
  FROM candidates GROUP BY alias HAVING count(*)=1
)
UPDATE wallet_referral_links link SET legacy_code=unambiguous.alias FROM unambiguous
WHERE link.wallet_address=unambiguous.wallet_address AND link.legacy_code IS NULL
  AND NOT EXISTS (SELECT 1 FROM wallet_referral_links WHERE legacy_code=unambiguous.alias);
DROP FUNCTION pg_temp.grom_legacy_invite(TEXT);

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
