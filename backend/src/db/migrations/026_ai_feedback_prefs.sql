-- AI assistant v2: preferences + feedback
ALTER TABLE ai_user_memory
  ADD COLUMN IF NOT EXISTS preferences JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE ai_user_memory
  ADD COLUMN IF NOT EXISTS memory_enabled BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS ai_response_feedback (
  id            UUID PRIMARY KEY,
  user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  response_id   TEXT NOT NULL,
  rating        SMALLINT NOT NULL CHECK (rating IN (-1, 1)),
  reason        TEXT,
  prompt_version TEXT,
  model         TEXT,
  latency_ms    INTEGER,
  task_type     TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, response_id)
);

CREATE INDEX IF NOT EXISTS idx_ai_feedback_created
  ON ai_response_feedback (created_at DESC);
