# GROM Postgres backup

`backup-postgres.sh` is already production-grade (KMS-encrypted SSE,
SHA256 verification, Prometheus pushgateway metric, retention prune).
The `Dockerfile.backup` builds an alpine image with `aws-cli` + `pg_dump`.
What's missing is **scheduling** the container to run daily on prod —
that's what this guide does.

## Two ways to schedule

### Option A — cron on the host (simplest)

```bash
ssh -i ~/.ssh/grom_do -p 2222 root@134.122.69.161

# 1. Build the backup image once
cd /opt/grom-exchange/scripts
docker build -t grom-backup:latest -f Dockerfile.backup .

# 2. Create env file (host, NOT committed to repo)
cat > /etc/default/grom-backup <<'EOF'
PGHOST=postgres
PGPORT=5432
PGUSER=grom
PGPASSWORD=__paste_from_/opt/grom-exchange/backend/.env__
PGDATABASE=grom
BACKUP_S3_BUCKET=grom-backups
BACKUP_S3_PREFIX=postgres/prod
BACKUP_KMS_KEY_ID=__not_needed_for_DO_Spaces__
BACKUP_RETAIN_DAYS=30
# DO Spaces credentials (S3-compatible)
AWS_ACCESS_KEY_ID=__do_spaces_key__
AWS_SECRET_ACCESS_KEY=__do_spaces_secret__
AWS_DEFAULT_REGION=fra1
AWS_ENDPOINT_URL=https://fra1.digitaloceanspaces.com
EOF
chmod 600 /etc/default/grom-backup

# 3. Add cron — 03:00 UTC daily
( crontab -l 2>/dev/null; cat <<'EOF'
0 3 * * * docker run --rm --network grom_default --env-file /etc/default/grom-backup grom-backup:latest >> /var/log/grom-backup.log 2>&1
EOF
) | crontab -

# 4. Test manually
docker run --rm --network grom_default --env-file /etc/default/grom-backup grom-backup:latest
```

### Option B — docker-compose sidecar (cleaner)

Add to `docker-compose.yml` next to `grom_backend`:

```yaml
  backup:
    build:
      context: ./scripts
      dockerfile: Dockerfile.backup
    env_file: ./scripts/backup.env       # host-only, gitignored
    depends_on: [postgres]
    profiles: [backup]                   # don't start with default `up`
    restart: "no"
```

Then schedule via host cron:

```bash
0 3 * * * cd /opt/grom-exchange && docker compose run --rm backup >> /var/log/grom-backup.log 2>&1
```

## Digital Ocean Spaces specifics

The existing script uses `aws s3 cp` with KMS encryption. DO Spaces:

- **Does NOT support `--sse aws:kms`** → remove or override `BACKUP_KMS_KEY_ID`.
- **Does support `--sse AES256`** → patch script: replace `--sse aws:kms` with `--sse AES256` and drop `--sse-kms-key-id`.
- Set `AWS_ENDPOINT_URL=https://<region>.digitaloceanspaces.com` (or pass `--endpoint-url` per command).

If you want full KMS, use real AWS S3 instead — same script, no edits.

## Restore

```bash
aws s3 cp s3://grom-backups/postgres/prod/2026/06/21/grom-grom-20260621T030000Z.dump /tmp/restore.dump
docker exec -i grom_postgres pg_restore --clean --no-owner --no-privileges -U grom -d grom < /tmp/restore.dump
```

## Monitoring

- `tail -f /var/log/grom-backup.log` — daily run log
- If `PROM_PUSHGATEWAY_URL` is set, metric `grom_pg_backup_last_success_timestamp` fires
- Alert if metric is older than 26h (24 + grace)

## Files

- `backup-postgres.sh` — production dump + S3 upload + retention
- `restore-postgres.sh` — companion restore script
- `Dockerfile.backup` — alpine image with aws-cli + pg_dump
- `backup-postgres.README.md` — this file
