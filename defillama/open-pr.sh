#!/usr/bin/env bash
# Create fork PR for DefiLlama dimension-adapters (LI.FI-only aggregators/grom).
# Prerequisites: `gh auth login` (account that can fork, e.g. gevo771-hue).
set -euo pipefail
export PATH="${HOME}/bin:${PATH}"

ROOT="$(cd "$(dirname "$0")" && pwd)"
SRC="${ROOT}/dimension-adapters"
TITLE="Add GROM Instant Swap aggregator adapter (LI.FI integrator ledger)"

gh auth status >/dev/null
USER="$(gh api user -q .login)"
echo "Authenticated as ${USER}"

if ! gh repo view "${USER}/dimension-adapters" >/dev/null 2>&1; then
  gh repo fork DefiLlama/dimension-adapters --remote=false --default-branch-only=false
fi

WORKDIR="${TMPDIR:-/tmp}/grom-dimension-adapters-pr"
rm -rf "${WORKDIR}"
git clone "https://github.com/${USER}/dimension-adapters.git" "${WORKDIR}"
cd "${WORKDIR}"
git remote add upstream https://github.com/DefiLlama/dimension-adapters.git 2>/dev/null || true
git fetch upstream
git checkout -B grom-aggregators-adapter upstream/master 2>/dev/null \
  || git checkout -B grom-aggregators-adapter upstream/main

mkdir -p helpers/aggregators
cp "${SRC}/aggregators/grom.ts" aggregators/grom.ts
cp "${SRC}/helpers/aggregators/grom.ts" helpers/aggregators/grom.ts
rm -f aggregators/grom-guards.js aggregator-derivatives/grom.ts
git add aggregators/grom.ts helpers/aggregators/grom.ts
git rm -f aggregators/grom-guards.js 2>/dev/null || true
if git diff --cached --quiet; then
  echo "No new changes to commit (files may already match)."
else
  git commit -m "$(cat <<'EOF'
Add GROM Instant Swap aggregator adapter (LI.FI integrator ledger)

Fail-closed dimensions API client with helpers/aggregators/grom guards.
Scope is integrator=grom-exchange DONE fills only; no derivatives stub.
EOF
)"
fi

git push -u origin HEAD
gh pr create --repo DefiLlama/dimension-adapters \
  --head "${USER}:grom-aggregators-adapter" \
  --title "${TITLE}" \
  --body-file "${BODY}"
