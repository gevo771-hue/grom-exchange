# GROM AI Assistant v2 — runbook

## What improved (not model weight training)
- Versioned capability manifest + strict system prompt (`src/ai/capabilities.js`, `prompt.js`)
- Strict action sanitize — no silent ETH / $50 / lev 5 defaults (`sanitize.js`)
- Fee snapshot with predict **0.30%** (`tools.js`)
- Portfolio redaction: demo/internal ≠ on-chain; unknown ≠ 0
- Guest coach rate limit; JWT required for portfolio/memory/feedback
- Frontend: safe Markdown, no local trade invent on `action:null` / API error
- Memory scoped per wallet/user; forget clears local + server
- Thumbs feedback + versioned eval fixtures

## Local checks
```bash
cd backend
node --test test/ai-assistant-v2.test.js
node --test test/*.js   # full suite
node --check src/ai/*.js
```

```bash
cd ..
node --check frontend/public/grom-wallet.js
node scripts/build-frontend.mjs
```

## Limits
- Guest: 6 coach req/min/IP; authenticated: 12/min (shared limiter)
- Max message 4000 chars; history last 8 turns
- No shell / arbitrary URL fetch / secrets for the model
- Feedback requires JWT + owned `responseId` (`userId:uuid`)

## Staging / release
1. Apply migration `026_ai_feedback_prefs.sql`
2. Deploy **only** AI-related backend + frontend dist (do not ship unrelated dirty-tree changes)
3. Rollback: revert AI files + migration down (drop `ai_response_feedback` / preference columns if needed)

## Not verified in this pass
- Live Anthropic calls / paid evals
- Real signed on-chain trades
- Full desktop/mobile browser QA screenshots (run after build on staging)
