-- 002: Active wallet-only schema bridge (idempotent).
-- Fills the gap between 001_init and 018+ for clean installs AND upgrades
-- where 018+ already ran but user_settings / users.status|role / admin_audit_log
-- were never created (legacy out-of-band schema).
-- No email / OTP / 2FA / CEX columns.

-- ===== user_settings (wallet prefs only) =====
CREATE TABLE IF NOT EXISTS user_settings (
    user_id         UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    security        JSONB NOT NULL DEFAULT '{}'::jsonb,
    notifications   JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ===== users.status / users.role (auth + admin) =====
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'status'
  ) THEN
    ALTER TABLE users
      ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
  END IF;
  -- Backfill + constraint (safe if already present)
  UPDATE users SET status = 'active' WHERE status IS NULL OR status = '';
  BEGIN
    ALTER TABLE users
      ADD CONSTRAINT users_status_check
      CHECK (status IN ('active', 'suspended', 'deleted'));
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'role'
  ) THEN
    ALTER TABLE users
      ADD COLUMN role TEXT NOT NULL DEFAULT 'user';
  END IF;
  -- Drop legacy CEX roles (market_maker, etc.) before tightening the check.
  -- Runtime only distinguishes admin vs user; market_maker is not a GROM role.
  UPDATE users
     SET role = 'user'
   WHERE role IS NULL
      OR role = ''
      OR role NOT IN ('user', 'admin', 'support');
  BEGIN
    ALTER TABLE users
      ADD CONSTRAINT users_role_check
      CHECK (role IN ('user', 'admin', 'support'));
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_status ON users (status);
CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);

-- ===== admin_audit_log (admin actions remain active) =====
CREATE TABLE IF NOT EXISTS admin_audit_log (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id    UUID REFERENCES users(id) ON DELETE SET NULL,
    action      TEXT NOT NULL,
    target_id   TEXT,
    target_type TEXT,
    payload     JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip          TEXT,
    ua          TEXT,
    ts          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_admin_audit_ts ON admin_audit_log (ts DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_actor ON admin_audit_log (actor_id);

COMMENT ON TABLE user_settings IS
  'Wallet-only prefs (security/notifications). No email/OTP columns.';
COMMENT ON TABLE admin_audit_log IS
  'Admin action audit trail for wallet-first backoffice.';
