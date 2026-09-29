-- Per-user AI assistant memory (cross-device personalization)
CREATE TABLE IF NOT EXISTS ai_user_memory (
  user_id     UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  events      JSONB NOT NULL DEFAULT '[]'::jsonb,
  top_types   JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes       JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_user_memory_updated
  ON ai_user_memory (updated_at DESC);
