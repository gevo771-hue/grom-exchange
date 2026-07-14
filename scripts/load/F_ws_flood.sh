#!/usr/bin/env bash
# Scenario F — WebSocket concurrent connections
# Target: 1000 stable connections to wss://grom.exchange/ws
#
# Usage:
#   CHAT=100 STAGE=smoke ./scripts/load/F_ws_flood.sh
#   CHAT=1000 STAGE=load ./scripts/load/F_ws_flood.sh
#
# Requires: websocat (brew install websocat) OR node
set -euo pipefail

BASE_URL="${BASE_URL:-https://grom.exchange}"
WS_URL="${WS_URL:-${BASE_URL/https/wss}/ws}"
CHAT="${CHAT:-}"
STAGE="${STAGE:-smoke}"

if [[ -z "$CHAT" ]]; then
  case "$STAGE" in
    smoke) CHAT=20 ;;
    load) CHAT=200 ;;
    stress|spike|soak) CHAT=1000 ;;
    *) CHAT=50 ;;
  esac
fi

HOLD_SEC="${HOLD_SEC:-20}"
echo "▶ WS flood: $CHAT clients → $WS_URL (hold ${HOLD_SEC}s)"

if command -v websocat >/dev/null 2>&1; then
  PIDS=()
  for i in $(seq 1 "$CHAT"); do
    (websocat -n1 --ping-interval 10 "$WS_URL" >/dev/null 2>&1 || true) &
    PIDS+=($!)
    # Ramp gently so we don't slam relay on smoke
    if (( i % 50 == 0 )); then sleep 0.2; fi
  done
  sleep "$HOLD_SEC"
  for p in "${PIDS[@]:-}"; do kill "$p" 2>/dev/null || true; done
  wait 2>/dev/null || true
  echo "✅ websocat flood finished ($CHAT)"
  exit 0
fi

# Node fallback
node --input-type=module - <<'NODE'
import WebSocket from 'ws';
const url = process.env.WS_URL || 'wss://grom.exchange/ws';
const n = Number(process.env.CHAT || 20);
const hold = Number(process.env.HOLD_SEC || 20) * 1000;
const sockets = [];
let open = 0, err = 0;
for (let i = 0; i < n; i++) {
  const ws = new WebSocket(url);
  ws.on('open', () => { open += 1; });
  ws.on('error', () => { err += 1; });
  sockets.push(ws);
  if (i % 50 === 0) await new Promise(r => setTimeout(r, 50));
}
await new Promise(r => setTimeout(r, hold));
for (const ws of sockets) try { ws.close(); } catch {}
console.log(`open=${open} err=${err} of ${n}`);
NODE
