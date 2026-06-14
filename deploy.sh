#!/bin/bash
# GROM one-click deploy.
# Stages + commits local changes, pushes to GitHub, SSHes into prod, pulls,
# and rebuilds ONLY the services whose source files actually changed.
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

# Auto-detect which compose services to rebuild from the diff vs. previous HEAD.
# Default to frontend if we somehow can't compute a diff (safe fallback).
CHANGED=$(git diff --name-only "$PREV_HEAD" HEAD 2>/dev/null || true)
SERVICES=""
if echo "$CHANGED" | grep -qE '^frontend/'; then SERVICES="$SERVICES frontend"; fi
if echo "$CHANGED" | grep -qE '^backend/';  then SERVICES="$SERVICES backend";  fi
SERVICES=$(echo "$SERVICES" | xargs)   # trim
if [ -z "$SERVICES" ]; then
  echo "▶ No service-affecting changes detected — rebuilding frontend by default."
  SERVICES="frontend"
fi
echo "▶ Will rebuild: $SERVICES"

echo ""
echo "▶ Deploying to grom-prod-fra1 ..."
ssh -i ~/.ssh/grom_do -p 2222 root@134.122.69.161 \
  "cd /opt/grom-exchange && git pull && docker compose build $SERVICES && docker compose up -d --remove-orphans --force-recreate $SERVICES && docker compose ps $SERVICES"

echo ""
echo "✅ Deploy done ($SERVICES). Open https://grom.exchange/ and Cmd+Shift+R to verify."
