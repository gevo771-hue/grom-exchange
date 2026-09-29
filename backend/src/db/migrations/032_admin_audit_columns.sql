-- 032: Align admin_audit_log with logAdminAudit() runtime contract.
-- Upgrade-safe: create table if missing, then add target_type / ua columns.

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

ALTER TABLE admin_audit_log
  ADD COLUMN IF NOT EXISTS target_type TEXT;

ALTER TABLE admin_audit_log
  ADD COLUMN IF NOT EXISTS ua TEXT;

CREATE INDEX IF NOT EXISTS idx_admin_audit_ts ON admin_audit_log (ts DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_actor ON admin_audit_log (actor_id);

COMMENT ON COLUMN admin_audit_log.target_type IS
  'Optional entity class for target_id (user, setting, market, …)';
COMMENT ON COLUMN admin_audit_log.ua IS
  'Client User-Agent captured at audit time';
