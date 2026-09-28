#!/usr/bin/env bash
set -euo pipefail

ENV=/opt/grom-exchange/.env
ADDR=0xCFeF272536D6E91A4945063d40ac7CbA7Eb657B5

# --- .env ---
python3 - <<'PY'
from pathlib import Path
p = Path("/opt/grom-exchange/.env")
lines = []
for ln in p.read_text().splitlines():
    if ln.startswith("GROM_HL_") or ln.startswith("# GROM_HL_"):
        continue
    lines.append(ln)
lines += [
    "GROM_HL_BUILDER_ADDRESS=0xCFeF272536D6E91A4945063d40ac7CbA7Eb657B5",
    "GROM_HL_BUILDER_FEE_TENTHS_BP=50",
    "GROM_HL_MAX_APPROVE_FEE_PCT=0.1%",
    "GROM_HL_TESTNET=false",
]
p.write_text("\n".join(lines) + "\n")
print("env ok")
PY
grep '^GROM_HL_' "$ENV"

mkdir -p /opt/grom-exchange/backend/src/futures
if [ -f /tmp/hl-routes.js ]; then
  cp /tmp/hl-routes.js /opt/grom-exchange/backend/src/futures/hl-routes.js
fi

# --- futures routes mount /hl ---
python3 - <<'PY'
from pathlib import Path
import subprocess
host = Path("/opt/grom-exchange/backend/src/futures/routes.js")
if not host.exists():
    subprocess.check_call(["docker", "cp", "grom_backend:/app/src/futures/routes.js", str(host)])
t = host.read_text()
changed = False
if "createHlFuturesRouter" not in t:
    t = "import createHlFuturesRouter from './hl-routes.js';\n" + t
    changed = True
if "r.use('/hl'" not in t and 'r.use("/hl"' not in t:
    t = t.replace("return r;", "  r.use('/hl', createHlFuturesRouter());\n  return r;", 1)
    changed = True
host.write_text(t)
print("futures routes", "patched" if changed else "ok")
PY

# --- config hyperliquid block ---
python3 - <<'PY'
from pathlib import Path
import re
p = Path("/opt/grom-exchange/backend/src/config/index.js")
t = p.read_text()
if "GROM_HL_BUILDER_ADDRESS" in t:
    print("config ok")
else:
    m = re.search(r"  polymarket: \{[^}]*\},", t, re.S)
    if not m:
        raise SystemExit("polymarket block missing — abort")
    block = m.group(0) + """
  hyperliquid: {
    builderAddress: env('GROM_HL_BUILDER_ADDRESS', ''),
    builderFeeTenthsBp: envInt('GROM_HL_BUILDER_FEE_TENTHS_BP', 50),
    maxApproveFeePct: env('GROM_HL_MAX_APPROVE_FEE_PCT', '0.1%'),
    testnet: envBool('GROM_HL_TESTNET', false),
  },"""
    p.write_text(t.replace(m.group(0), block, 1))
    print("config patched")
PY

cd /opt/grom-exchange
docker compose up -d --force-recreate backend
sleep 7

docker cp /opt/grom-exchange/backend/src/futures/hl-routes.js grom_backend:/app/src/futures/hl-routes.js
docker cp /opt/grom-exchange/backend/src/futures/routes.js grom_backend:/app/src/futures/routes.js
docker cp /opt/grom-exchange/backend/src/config/index.js grom_backend:/app/src/config/index.js
if [ -f /opt/grom-exchange/backend/src/market/routes.js ] && grep -q predict/config /opt/grom-exchange/backend/src/market/routes.js; then
  docker cp /opt/grom-exchange/backend/src/market/routes.js grom_backend:/app/src/market/routes.js
fi
docker restart grom_backend
sleep 8

echo -n "HL="
curl -sS http://127.0.0.1:4000/api/futures/hl/config
echo
echo -n "PM="
curl -sS http://127.0.0.1:4000/api/market/predict/config | head -c 140
echo
curl -sS -X POST http://127.0.0.1:4000/api/futures/hl/info \
  -H 'content-type: application/json' \
  -d '{"type":"metaAndAssetCtxs"}' \
  | python3 -c 'import sys,json;d=json.load(sys.stdin);print("markets",len(d[0]["universe"]))'
docker exec grom_backend printenv GROM_HL_BUILDER_ADDRESS
docker exec grom_frontend test -f /usr/share/nginx/html/grom-hyperliquid.a0d0788f.js && echo FE_HL_OK
