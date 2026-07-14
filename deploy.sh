#!/bin/bash
# GROM one-click deploy — with zero-downtime frontend hot-swap.
#
# Stages + commits local changes, pushes to GitHub, SSHes into prod,
# then picks the LEAST disruptive path for what actually changed:
#
#   1. Frontend static files only (frontend/public/*)  → zero-downtime:
#        docker cp new files into the running nginx container +
#        `nginx -s reload`.  Users see the fresh files on their next
#        request; no 502 window at all.
#
#   2. Frontend infra (Dockerfile / nginx.conf)        → full rebuild
#        of the frontend container (brief ~5-10 s outage — rare path).
#
#   3. Backend changes                                 → rebuild +
#        recreate backend only.  The frontend nginx keeps serving
#        `index.html` and static assets throughout, so grom.exchange
#        itself never returns 502; only `/api/*` calls fail during
#        the ~15-25 s backend startup (browser side just retries).
#
# Usage:  ./deploy.sh "commit message"
# Or:     ./deploy.sh           (auto-generated commit message with date)

set -e

MSG="${1:-deploy: $(date '+%Y-%m-%d %H:%M')}"

# Remove stale git lock from an aborted run, if any.
if [ -f .git/index.lock ]; then
  echo "▶ Found stale .git/index.lock — removing."
  rm -f .git/index.lock
fi

echo "▶ git status:"
git status --short

# Snapshot HEAD before commit so we can tell what's new even after a fresh commit.
PREV_HEAD=$(git rev-parse HEAD)

if [ -n "$(git status --porcelain)" ]; then
  echo ""
  echo "▶ Staging + committing: $MSG"
  git add -A
  git commit -m "$MSG"
else
  echo "▶ No local changes — pushing whatever's ahead of origin."
fi

echo ""
echo "▶ Pulling remote rebase (in case sandbox or codex pushed) ..."
git pull --rebase --autostash

echo ""
echo "▶ Pushing to GitHub ..."
git push

# ---- Classify what actually changed since PREV_HEAD ----
CHANGED=$(git diff --name-only "$PREV_HEAD" HEAD 2>/dev/null || true)

BACKEND_CHANGED=false
FRONTEND_CHANGED=false
FRONTEND_STATIC_ONLY=true

if echo "$CHANGED" | grep -qE '^backend/';  then BACKEND_CHANGED=true;  fi
if echo "$CHANGED" | grep -qE '^frontend/'; then FRONTEND_CHANGED=true; fi
# If any frontend/ path is outside frontend/public/, we can't hot-swap.
if echo "$CHANGED" | grep -E '^frontend/' | grep -qvE '^frontend/public/'; then
  FRONTEND_STATIC_ONLY=false
fi

# Nothing changed?  Fall back to a static-only refresh (safe no-op).
if ! $BACKEND_CHANGED && ! $FRONTEND_CHANGED; then
  echo "▶ No service-affecting changes — treating as static-only refresh."
  FRONTEND_CHANGED=true
  FRONTEND_STATIC_ONLY=true
fi

echo ""
echo "▶ Deploy plan:"
echo "    backend changed:          $BACKEND_CHANGED"
echo "    frontend changed:         $FRONTEND_CHANGED"
echo "    frontend static-only:     $FRONTEND_STATIC_ONLY"

SSH="ssh -i $HOME/.ssh/grom_do -p 2222 root@134.122.69.161"

# ---- Always start with git pull on prod ----
echo ""
echo "▶ Pulling latest into /opt/grom-exchange on prod ..."
$SSH "cd /opt/grom-exchange && git pull"

# ---- Frontend ----
if $FRONTEND_CHANGED; then
  if $FRONTEND_STATIC_ONLY; then
    echo ""
    echo "▶ ZERO-DOWNTIME frontend hot-swap:"
    echo "    - docker cp frontend/public/. → running grom_frontend container"
    echo "    - nginx -s reload (no restart, no 502)"
    $SSH "cd /opt/grom-exchange && \
          docker cp frontend/public/. grom_frontend:/usr/share/nginx/html/ && \
          docker exec grom_frontend nginx -s reload"
  else
    echo ""
    echo "▶ Frontend Dockerfile/nginx.conf changed — full rebuild required:"
    $SSH "cd /opt/grom-exchange && \
          docker compose build frontend && \
          docker compose up -d --force-recreate --no-deps frontend"
  fi
fi

# ---- Backend ----
if $BACKEND_CHANGED; then
  echo ""
  echo "▶ Rebuilding backend (frontend nginx keeps serving throughout):"
  $SSH "cd /opt/grom-exchange && \
        docker compose build backend && \
        docker compose up -d --force-recreate --no-deps backend"
fi

echo ""
echo "▶ Container status:"
$SSH "cd /opt/grom-exchange && docker compose ps"

echo ""
if $FRONTEND_CHANGED && $FRONTEND_STATIC_ONLY && ! $BACKEND_CHANGED; then
  echo "✅ Zero-downtime deploy done.  https://grom.exchange/  (Cmd+Shift+R to verify)"
else
  echo "✅ Deploy done.  https://grom.exchange/  (Cmd+Shift+R to verify)"
fi

# ---- Post-deploy smoke (Scenario A, ~30s) — never blocks static-only if k6 missing ----
echo ""
echo "▶ Post-deploy load smoke (Scenario A)…"
if command -v k6 >/dev/null 2>&1; then
  chmod +x scripts/load/smoke.sh scripts/load/F_ws_flood.sh 2>/dev/null || true
  if BASE_URL=https://grom.exchange ./scripts/load/smoke.sh; then
    echo "✅ Load smoke passed"
  else
    echo "⚠ Load smoke FAILED (p95>500ms or errors>1%) — investigate before traffic spike"
    exit 1
  fi
else
  echo "⚠ k6 not installed locally — skip smoke (CI workflow still runs it)"
fi
