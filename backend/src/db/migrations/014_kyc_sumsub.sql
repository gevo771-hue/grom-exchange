-- Migration 014 — Sumsub KYC integration.

BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS kyc_provider TEXT DEFAULT 'sumsub',
  ADD COLUMN IF NOT EXISTS kyc_external_id TEXT,
  ADD COLUMN IF NOT EXISTS kyc_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS kyc_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS kyc_level TEXT DEFAULT 'tier_0';

CREATE TABLE IF NOT EXISTS kyc_webhooks (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider         TEXT NOT NULL,
  external_user_id TEXT,
  review_status    TEXT,
  payload          JSONB NOT NULL DEFAULT '{}'::jsonb,
  signature        TEXT,
  processed_at     TIMESTAMPTZ,
  received_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS kyc_webhooks_external_user
  ON kyc_webhooks(external_user_id);

COMMIT;
