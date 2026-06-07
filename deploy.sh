#!/bin/bash
# GROM one-click deploy.
# Pushes local changes to GitHub, then SSH into prod, pulls, restarts frontend.
# Usage:  ./deploy.sh "commit message"
# Or:     ./deploy.sh           (auto-generated commit message with date)

set -e

MSG="${1:-deploy: $(date '+%Y-%m-%d %H:%M')}"

echo "▶ git status:"
git status --short

# If there are unstaged changes, stage them.
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

echo ""
echo "▶ Deploying to grom-prod-fra1 ..."
ssh -i ~/.ssh/grom_do -p 2222 root@134.122.69.161 \
  "cd /opt/grom-exchange && git pull && docker compose build frontend && docker compose up -d frontend && docker compose ps frontend"

echo ""
echo "✅ Deploy done. Open https://grom.exchange/ and Cmd+Shift+R to verify."
