#!/usr/bin/env bash
# Read-only smoke test. Does not request signatures or send transactions.
set -euo pipefail
HOST="${1:-http://localhost:4000}"

printf '%s\n' "GET $HOST/health"
curl -fsS "$HOST/health"
printf '\n\n%s\n' "GET $HOST/api/swap/public-config"
curl -fsS "$HOST/api/swap/public-config"
printf '\n\nOK\n'
