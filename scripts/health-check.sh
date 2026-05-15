#!/usr/bin/env bash
# Simple smoke test for GROM backend.
# Usage: ./health-check.sh [host]   default: http://localhost:4000
set -euo pipefail
HOST="${1:-http://localhost:4000}"

echo "→ GET $HOST/health"
curl -sf "$HOST/health" | jq .

echo
echo "→ POST $HOST/auth/nonce"
curl -sf -X POST "$HOST/auth/nonce" -H 'Content-Type: application/json' -d '{}' | jq .

echo
echo "→ GET $HOST/api/binary/rounds?asset=BTC/USDT"
curl -sf "$HOST/api/binary/rounds?asset=BTC/USDT" | jq '.rounds | length'

echo
echo "→ GET $HOST/metrics (first 10 lines)"
curl -sf "$HOST/metrics" | head -10

echo
echo "OK"
