#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# GROM Postgres restore from S3. Used for DR drills and real recovery.
#
# Usage:
#   ./restore-postgres.sh s3://grom-prod-backups/postgres/prod/2026/04/19/grom-grom-20260419T120000Z.dump
#
# Safety: refuses to run against a database with existing tables unless
# FORCE_RESTORE=1 is set.
# ---------------------------------------------------------------------------
set -Eeuo pipefail

S3_URL="${1:?s3://... path required}"
: "${PGHOST:?PGHOST required}"
: "${PGUSER:?PGUSER required}"
: "${PGDATABASE:?PGDATABASE required}"

WORKDIR=$(mktemp -d -t grom-restore-XXXXXX)
trap 'rm -rf "$WORKDIR"' EXIT
LOCAL="${WORKDIR}/restore.dump"

if [[ "${FORCE_RESTORE:-0}" != "1" ]]; then
  EXISTING=$(PGPASSWORD="${PGPASSWORD:-}" psql -h "${PGHOST}" -U "${PGUSER}" -d "${PGDATABASE}" -tAc \
    "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")
  if [[ "${EXISTING:-0}" -gt 0 ]]; then
    echo "ERROR: target DB already has ${EXISTING} tables. Set FORCE_RESTORE=1 to proceed." >&2
    exit 2
  fi
fi

echo "[$(date -u +%FT%TZ)] Downloading ${S3_URL}"
aws s3 cp "${S3_URL}"           "${LOCAL}"           --only-show-errors
aws s3 cp "${S3_URL}.meta.json" "${LOCAL}.meta.json" --only-show-errors

EXPECTED_SHA=$(grep -Eo '"sha256": *"[a-f0-9]+"' "${LOCAL}.meta.json" | awk -F'"' '{print $4}')
ACTUAL_SHA=$(sha256sum "${LOCAL}" | awk '{print $1}')
if [[ "${EXPECTED_SHA}" != "${ACTUAL_SHA}" ]]; then
  echo "ERROR: sha256 mismatch. expected=${EXPECTED_SHA} actual=${ACTUAL_SHA}" >&2
  exit 3
fi
echo "[$(date -u +%FT%TZ)] Checksum OK (${ACTUAL_SHA})"

echo "[$(date -u +%FT%TZ)] Restoring into ${PGDATABASE}@${PGHOST}"
PGPASSWORD="${PGPASSWORD:-}" pg_restore \
    --host="${PGHOST}" \
    --port="${PGPORT:-5432}" \
    --username="${PGUSER}" \
    --dbname="${PGDATABASE}" \
    --clean --if-exists \
    --no-owner --no-privileges \
    --jobs=4 \
    "${LOCAL}"

echo "[$(date -u +%FT%TZ)] Restore complete."
