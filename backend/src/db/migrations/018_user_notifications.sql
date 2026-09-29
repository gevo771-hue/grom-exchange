-- In-app notification inbox (bell panel). Separate from email outbox.
BEGIN;

CREATE TABLE IF NOT EXISTS user_notifications (
  id          bigserial PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind        varchar(32) NOT NULL DEFAULT 'info',
  title       text NOT NULL,
  body        text NOT NULL DEFAULT '',
  payload     jsonb,
  read_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_notifications_user_created_idx
  ON user_notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS user_notifications_user_unread_idx
  ON user_notifications (user_id)
  WHERE read_at IS NULL;

-- Extend default prefs used by the bell (merge-safe; existing keys kept).
UPDATE user_settings
   SET notifications = COALESCE(notifications, '{}'::jsonb) || jsonb_build_object(
     'fills', COALESCE(notifications->'fills', 'true'::jsonb),
     'transfers', COALESCE(notifications->'transfers', 'true'::jsonb),
     'digest', COALESCE(notifications->'digest', 'false'::jsonb),
     'product', COALESCE(notifications->'product', 'true'::jsonb)
   );

COMMIT;
