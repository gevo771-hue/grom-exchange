-- Anonymous + authed site pageviews for admin KPI (24h visits)
BEGIN;

CREATE TABLE IF NOT EXISTS site_pageviews (
  id              BIGSERIAL PRIMARY KEY,
  visitor_key     TEXT NOT NULL,
  page            TEXT NOT NULL DEFAULT 'unknown',
  user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  wallet_address  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_site_pageviews_created ON site_pageviews (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_site_pageviews_visitor_created ON site_pageviews (visitor_key, created_at DESC);

COMMIT;
