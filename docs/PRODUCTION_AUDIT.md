# GROM Production Audit

Date: 2026-04-26

## Current state

The project is not production-ready yet. It is currently a strong demo / preview foundation with a partial backend.

## Critical blockers

1. Frontend divergence
- `grom-preview.html` and `frontend/public/index.html` had diverged.
- This meant the locally reviewed UI and the deployable UI were not the same artifact.

2. Frontend architecture
- `frontend/README.md` still describes the React/Vite app as a placeholder.
- The real deployable frontend is a large static HTML app in `frontend/public/index.html`.

3. Backend coverage gap
- Backend currently implements:
  - SIWE auth
  - binary options engine + REST
  - swap quote endpoint
- Backend does not yet implement full production APIs for:
  - spot trading lifecycle
  - futures lifecycle
  - deposits / withdrawals
  - referral accounting
  - KYC workflow
  - settings / session management
  - full user history aggregation

4. Config / secret safety
- Backend previously allowed unsafe defaults such as:
  - default JWT secret
  - wildcard CORS
  - localhost SIWE domain
  - dev login in production

5. Testing gap
- No effective backend test directory existed before this audit.
- `package.json` test script was also malformed for current Node test runner usage.

## Fixes applied in this pass

1. Unified deployable frontend with the current preview
- Synced:
  - `grom-preview.html` -> `frontend/public/index.html`
  - `grom-i18n.js` -> `frontend/public/grom-i18n.js`
  - `grom-wallet.js` -> `frontend/public/grom-wallet.js`

2. Hardened backend config
- Added config validation for production mode.
- Added support for `DATABASE_URL` and `REDIS_URL`.
- Prevents insecure production startup for:
  - default JWT secret
  - wildcard CORS
  - localhost SIWE domain
  - enabled dev login
  - missing DB password

3. Rebuilt `.env.example`
- Replaced mixed / outdated template with one aligned to the actual GROM runtime.

4. Added basic backend tests
- `backend/test/config.test.js`
- `backend/test/auth.test.js`
- Fixed backend test script:
  - `node --test test/*.js`

## Remaining production work

### P0
- Build real spot REST/WebSocket execution path
- Build real futures REST/WebSocket execution path
- Replace remaining frontend `toast(...)` placeholders with API-backed flows
- Add deposit / withdrawal backend and persistence model
- Add proper session / device / audit APIs

### P1
- Add integration tests for binary settlement invariants
- Add API tests for SIWE nonce / verify / me
- Add health checks for downstream liquidity sources
- Add frontend-to-backend contract map and typed API client

### P2
- Replace static frontend architecture with actual componentized app
- Add CI for lint / tests / build / config validation
- Add stricter production CSP / headers / cookie policy where applicable

## Recommendation

Treat the project today as:
- production-grade demo frontend in progress
- partial backend prototype

Do not treat it as a live exchange stack until the P0 items above are closed.
