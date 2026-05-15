BEGIN;

ALTER TABLE notifications_outbox
  ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS notifications_retry_idx
  ON notifications_outbox(status, next_attempt_at, created_at);

COMMIT;
