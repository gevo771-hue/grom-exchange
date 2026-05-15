#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# GROM Postgres backup -> S3 (encrypted, retention-managed)
#
# Target RPO: 15 minutes (WAL archiving is handled separately by
# pg_basebackup + wal-g; this script produces logical dumps for PITR safety
# and for restore drills).
#
# Env required:
#   PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE
#   BACKUP_S3_BUCKET     (e.g. grom-prod-backups)
#   BACKUP_S3_PREFIX     (e.g. postgres/prod)
#   BACKUP_KMS_KEY_ID    (KMS key for SSE-KMS)
#   BACKUP_RETAIN_DAYS   (default 30)
#
# Exit non-zero on any failure so systemd/cron/k8s CronJob marks it failed.
# ---------------------------------------------------------------------------
set -Eeuo pipefail

: "${PGHOST:?PGHOST required}"
: "${PGUSER:?PGUSER required}"
: "${PGDATABASE:?PGDATABASE required}"
: "${BACKUP_S3_BUCKET:?BACKUP_S3_BUCKET required}"
: "${BACKUP_S3_PREFIX:=postgres}"
: "${BACKUP_KMS_KEY_ID:?BACKUP_KMS_KEY_ID required}"
: "${BACKUP_RETAIN_DAYS:=30}"

TS=$(date -u +%Y%m%dT%H%M%SZ)
WORKDIR=$(mktemp -d -t grom-backup-XXXXXX)
trap 'rm -rf "$WORKDIR"' EXIT

DUMP_FILE="${WORKDIR}/grom-${PGDATABASE}-${TS}.dump"
META_FILE="${WORKDIR}/grom-${PGDATABASE}-${TS}.meta.json"
S3_KEY="s3://${BACKUP_S3_BUCKET}/${BACKUP_S3_PREFIX}/$(date -u +%Y/%m/%d)/$(basename "${DUMP_FILE}")"

echo "[$(date -u +%FT%TZ)] Starting pg_dump of ${PGDATABASE} from ${PGHOST}"
PGPASSWORD="${PGPASSWORD:-}" pg_dump \
    --host="${PGHOST}" \
    --port="${PGPORT:-5432}" \
    --username="${PGUSER}" \
    --dbname="${PGDATABASE}" \
    --format=custom \
    --compress=9 \
    --no-owner --no-privileges \
    --jobs=1 \
    --file="${DUMP_FILE}"

# Integrity: verify the custom archive can be listed.
pg_restore --list "${DUMP_FILE}" > /dev/null

SIZE=$(stat -c%s "${DUMP_FILE}" 2>/dev/null || stat -f%z "${DUMP_FILE}")
SHA=$(sha256sum "${DUMP_FILE}" | awk '{print $1}')

cat > "${META_FILE}" <<EOF
{
  "database": "${PGDATABASE}",
  "host": "${PGHOST}",
  "timestamp": "${TS}",
  "size_bytes": ${SIZE},
  "sha256": "${SHA}",
  "pg_dump_version": "$(pg_dump --version | awk '{print $NF}')"
}
EOF

echo "[$(date -u +%FT%TZ)] Uploading ${SIZE} bytes to ${S3_KEY}"
aws s3 cp "${DUMP_FILE}" "${S3_KEY}" \
    --sse aws:kms \
    --sse-kms-key-id "${BACKUP_KMS_KEY_ID}" \
    --only-show-errors
aws s3 cp "${META_FILE}" "${S3_KEY}.meta.json" \
    --sse aws:kms \
    --sse-kms-key-id "${BACKUP_KMS_KEY_ID}" \
    --only-show-errors

echo "[$(date -u +%FT%TZ)] Upload complete: sha256=${SHA}"

# Emit a Prometheus pushgateway metric so alerts fire if this stops running.
if [[ -n "${PROM_PUSHGATEWAY_URL:-}" ]]; then
  cat <<EOF | curl -fsS --data-binary @- "${PROM_PUSHGATEWAY_URL}/metrics/job/grom_pg_backup/instance/${PGHOST}"
# TYPE grom_pg_backup_last_success_timestamp gauge
grom_pg_backup_last_success_timestamp $(date -u +%s)
# TYPE grom_pg_backup_last_size_bytes gauge
grom_pg_backup_last_size_bytes ${SIZE}
EOF
fi

# Retention: delete objects older than BACKUP_RETAIN_DAYS.
CUTOFF=$(date -u -d "${BACKUP_RETAIN_DAYS} days ago" +%Y-%m-%d 2>/dev/null \
         || date -u -v-"${BACKUP_RETAIN_DAYS}"d +%Y-%m-%d)

echo "[$(date -u +%FT%TZ)] Pruning backups older than ${CUTOFF}"
aws s3api list-objects-v2 \
    --bucket "${BACKUP_S3_BUCKET}" \
    --prefix "${BACKUP_S3_PREFIX}/" \
    --query "Contents[?LastModified<'${CUTOFF}'].Key" \
    --output text 2>/dev/null \
  | tr '\t' '\n' \
  | while read -r key; do
      [[ -z "${key}" || "${key}" == "None" ]] && continue
      echo "  deleting s3://${BACKUP_S3_BUCKET}/${key}"
      aws s3 rm "s3://${BACKUP_S3_BUCKET}/${key}" --only-show-errors
    done

echo "[$(date -u +%FT%TZ)] Done."
