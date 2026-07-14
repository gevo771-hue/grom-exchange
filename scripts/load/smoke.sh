#!/usr/bin/env bash
# Post-deploy / CI smoke — Scenario A × ~30s against BASE_URL.
# Fails if p95 > 500ms OR http_req_failed > 1%.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BASE_URL="${BASE_URL:-https://grom.exchange}"
STAGE=smoke
export BASE_URL STAGE

if ! command -v k6 >/dev/null 2>&1; then
  echo "⚠ k6 not installed — installing via brew (mac) or skipping soft"
  if command -v brew >/dev/null 2>&1; then
    brew install k6
  else
    echo "Install k6: https://k6.io/docs/get-started/installation/"
    exit 2
  fi
fi

echo "▶ Smoke A_landing against $BASE_URL (STAGE=smoke)"
# Stricter CI thresholds overrides
k6 run \
  --summary-export=/tmp/grom-load-smoke.json \
  -e BASE_URL="$BASE_URL" \
  -e STAGE=smoke \
  "$ROOT/scripts/load/A_landing.js"

# Parse summary via node for portable threshold check
node - <<'NODE'
const fs = require('fs');
const j = JSON.parse(fs.readFileSync('/tmp/grom-load-smoke.json', 'utf8'));
const m = j.metrics || {};
const p95 = m.http_req_duration?.values?.['p(95)'] ?? m.http_req_duration?.['p(95)'];
const fail = m.http_req_failed?.values?.rate ?? m.http_req_failed?.rate ?? 0;
console.log(`p95=${p95}ms fail_rate=${(fail * 100).toFixed(2)}%`);
if (p95 == null) {
  console.error('Could not read p95 from k6 summary');
  process.exit(1);
}
if (p95 > 500) {
  console.error(`ALERT: p95 ${p95}ms > 500ms`);
  process.exit(1);
}
if (fail > 0.01) {
  console.error(`ALERT: error rate ${(fail * 100).toFixed(2)}% > 1%`);
  process.exit(1);
}
console.log('✅ Smoke passed');
NODE
