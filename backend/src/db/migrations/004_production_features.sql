-- Migration 004 — production features for full exchange parity.
-- Adds: user settings persistence, session/device tracking, referral
-- commission ledger, API keys, KYC events, futures position lifecycle hooks.

BEGIN;

-- ===== Add role to users =======================================================
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'user';
CREATE INDEX IF NOT EXISTS users_role_idx ON users(role) WHERE role <> 'user';

-- ===== User settings ===========================================================
CREATE TABLE IF NOT EXISTS user_settings (
  user_id           UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  display_name      VARCHAR(120),
  email             VARCHAR(160),
  language          VARCHAR(8)  DEFAULT 'en',
  base_currency     VARCHAR(8)  DEFAULT 'USDT',
  default_leverage  INTEGER     DEFAULT 10,
  notifications     JSONB       NOT NULL DEFAULT '{"email":true,"push":false,"trade_summary":true,"market_alerts":false}'::jsonb,
  security          JSONB       NOT NULL DEFAULT '{"two_fa":false,"anti_phishing":"","login_email":true,"withdraw_email":true}'::jsonb,
  risk              JSONB       NOT NULL DEFAULT '{"daily_loss_cap_usdt":2500,"max_round_size_usdt":250,"cooldown_after_loss_min":15}'::jsonb,
  preferences       JSONB       NOT NULL DEFAULT '{}'::jsonb,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ===== Sessions / devices ======================================================
CREATE TABLE IF NOT EXISTS user_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_label  TEXT,
  ip_address    INET,
  user_agent    TEXT,
  jwt_jti       VARCHAR(64),
  is_protected  BOOLEAN NOT NULL DEFAULT FALSE,
  revoked_at    TIMESTAMPTZ,
  last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS user_sessions_user_idx
  ON user_sessions(user_id, revoked_at NULLS FIRST, last_seen_at DESC);

-- ===== API keys ================================================================
CREATE TABLE IF NOT EXISTS api_keys (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label         VARCHAR(120) NOT NULL,
  key_prefix    VARCHAR(16)  NOT NULL,
  key_hash      VARCHAR(120) NOT NULL,
  permissions   JSONB        NOT NULL DEFAULT '["read"]'::jsonb,
  ip_whitelist  TEXT[],
  status        VARCHAR(16)  NOT NULL DEFAULT 'active',
  last_used_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  revoked_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS api_keys_user_idx ON api_keys(user_id, status);

-- ===== Referral commission ledger =============================================
CREATE TABLE IF NOT EXISTS referral_commissions (
  id            BIGSERIAL PRIMARY KEY,
  affiliate_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  source_type   VARCHAR(20) NOT NULL,
  source_ref    VARCHAR(80),
  amount_usdt   NUMERIC(28,8) NOT NULL,
  status        VARCHAR(20)   NOT NULL DEFAULT 'pending',
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  settled_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS referral_commissions_affiliate_idx
  ON referral_commissions(affiliate_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS referral_payout_settings (
  user_id       UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  payout_wallet VARCHAR(120),
  payout_chain  VARCHAR(24)  DEFAULT 'ARB',
  schedule      VARCHAR(20)  DEFAULT 'daily',
  min_payout    NUMERIC(28,8) DEFAULT 50,
  asset         VARCHAR(16)  DEFAULT 'USDT',
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ===== KYC events / actions ===================================================
CREATE TABLE IF NOT EXISTS kyc_events (
  id            BIGSERIAL PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_id      UUID REFERENCES users(id) ON DELETE SET NULL,
  action        VARCHAR(40) NOT NULL,
  reason        TEXT,
  metadata      JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS kyc_events_user_idx ON kyc_events(user_id, created_at DESC);

-- ===== Notifications outbox ===================================================
CREATE TABLE IF NOT EXISTS notifications_outbox (
  id            BIGSERIAL PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel       VARCHAR(20) NOT NULL,
  template      VARCHAR(80) NOT NULL,
  payload       JSONB,
  status        VARCHAR(16) NOT NULL DEFAULT 'queued',
  attempts      INTEGER     NOT NULL DEFAULT 0,
  last_error    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at       TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS notifications_status_idx
  ON notifications_outbox(status, created_at);

-- ===== Support tickets ========================================================
CREATE TABLE IF NOT EXISTS support_tickets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  category      VARCHAR(40)  NOT NULL,
  subject       VARCHAR(200) NOT NULL,
  body          TEXT,
  status        VARCHAR(20)  NOT NULL DEFAULT 'open',
  priority      VARCHAR(20)  NOT NULL DEFAULT 'normal',
  assignee_id   UUID REFERENCES users(id) ON DELETE SET NULL,
  metadata      JSONB,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS support_tickets_status_idx
  ON support_tickets(status, created_at DESC);

-- ===== Futures position close events =========================================
CREATE TABLE IF NOT EXISTS futures_position_events (
  id            BIGSERIAL PRIMARY KEY,
  position_id   UUID NOT NULL REFERENCES futures_positions(id) ON DELETE CASCADE,
  user_id       UUID   NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type    VARCHAR(24) NOT NULL,
  trigger_price NUMERIC(28,8),
  size_delta    NUMERIC(28,8),
  realised_pnl  NUMERIC(28,8),
  metadata      JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS futures_pos_events_user_idx
  ON futures_position_events(user_id, created_at DESC);

-- Add lifecycle columns if they don't exist on futures_positions
DO $$
BEGIN
  BEGIN
    ALTER TABLE futures_positions
      ADD COLUMN IF NOT EXISTS take_profit_price NUMERIC(28,8),
      ADD COLUMN IF NOT EXISTS stop_loss_price   NUMERIC(28,8),
      ADD COLUMN IF NOT EXISTS realised_pnl      NUMERIC(28,8) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS closed_at         TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS close_reason      VARCHAR(40);
  EXCEPTION WHEN undefined_table THEN
    -- futures_positions not yet created
    NULL;
  END;
END$$;

COMMIT;
