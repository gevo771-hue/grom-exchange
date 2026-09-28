-- Dimension index coverage — successful sync windows per source/product/chain.
-- Public daily queries require the requested [start,end) to be fully covered.
-- A last fill timestamp is NOT a coverage watermark.
BEGIN;

CREATE TABLE IF NOT EXISTS dimension_index_coverage (
  id              BIGSERIAL PRIMARY KEY,
  source          TEXT NOT NULL,
  product         TEXT NOT NULL CHECK (product IN ('swap', 'perps', 'predict', 'xstocks')),
  chain_id        INTEGER NOT NULL,
  covered_from    TIMESTAMPTZ NOT NULL,
  covered_to      TIMESTAMPTZ NOT NULL,
  status          TEXT NOT NULL DEFAULT 'ok'
                    CHECK (status IN ('ok', 'failed')),
  evidence        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_dimension_coverage_range CHECK (covered_to > covered_from),
  CONSTRAINT uq_dimension_coverage_window
    UNIQUE (source, product, chain_id, covered_from, covered_to)
);

CREATE INDEX IF NOT EXISTS idx_dimension_coverage_lookup
  ON dimension_index_coverage (product, chain_id, status, covered_from, covered_to);

COMMIT;
