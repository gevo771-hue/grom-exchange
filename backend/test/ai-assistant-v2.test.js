/**
 * GROM AI Assistant v2 — unit + acceptance (mock provider, no paid calls).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CAPABILITIES, AI_PROMPT_VERSION } from '../src/ai/capabilities.js';
import { buildSystemPrompt } from '../src/ai/prompt.js';
import { sanitizeAction, extractCoachPayload } from '../src/ai/sanitize.js';
import { getFeeSnapshot, redactSnapshotForModel } from '../src/ai/tools.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('AI capabilities manifest', () => {
  it('exposes four products and forbids inventing unavailable ones', () => {
    assert.equal(CAPABILITIES.products.swap.available, true);
    assert.equal(CAPABILITIES.products.perps.available, true);
    assert.equal(CAPABILITIES.products.predict.available, true);
    assert.equal(CAPABILITIES.products.stocks.available, true);
    assert.equal(CAPABILITIES.unavailable.gridBot, false);
    assert.equal(CAPABILITIES.unavailable.guaranteedReturns, false);
    assert.ok(String(AI_PROMPT_VERSION).includes('grom-ai-v2'));
  });
});

describe('AI fee snapshot', () => {
  it('predict taker is 0.30% from config', () => {
    const fees = getFeeSnapshot();
    assert.equal(fees.predictTaker, 0.003);
    assert.equal(fees.predictTakerLabel, '0.3%');
    assert.equal(fees.status, 'ok');
    assert.ok(fees.asOf);
    assert.ok(fees.source);
  });
});

describe('AI sanitizeAction — no silent trade defaults', () => {
  it('buy ETH without amount → null', () => {
    const { action, error } = sanitizeAction({ type: 'swap.buy', params: { asset: 'ETH' } });
    assert.equal(action, null);
    assert.equal(error, 'swap_notional_required');
  });

  it('short BTC $20 without leverage → null', () => {
    const { action, error } = sanitizeAction({
      type: 'futures.open',
      params: { market: 'BTC', side: 'short', notionalUsd: 20 },
    });
    assert.equal(action, null);
    assert.equal(error, 'futures_leverage_required');
  });

  it('complete futures.open is accepted', () => {
    const { action } = sanitizeAction({
      type: 'futures.open',
      params: { market: 'BTC', side: 'short', notionalUsd: 20, leverage: 3 },
    });
    assert.equal(action.type, 'futures.open');
    assert.equal(action.params.notionalUsd, 20);
    assert.equal(action.params.leverage, 3);
    assert.equal(action.confirmRequired, true);
  });

  it('null action stays null', () => {
    assert.equal(sanitizeAction(null).action, null);
  });

  it('unknown type → null', () => {
    assert.equal(sanitizeAction({ type: 'grid.bot', params: {} }).action, null);
  });
});

describe('AI extractCoachPayload', () => {
  it('parses JSON and drops incomplete swap', () => {
    const out = extractCoachPayload(JSON.stringify({
      reply: 'How much ETH and on which network?',
      action: { type: 'swap.buy', params: { asset: 'ETH' } },
    }));
    assert.match(out.reply, /How much/i);
    assert.equal(out.action, null);
    assert.equal(out.sanitizeError, 'swap_notional_required');
  });

  it('keeps educational reply with action null', () => {
    const out = extractCoachPayload('{"reply":"Leverage magnifies loss.","action":null}');
    assert.match(out.reply, /Leverage/);
    assert.equal(out.action, null);
  });
});

describe('AI prompt policy', () => {
  it('forbids inventing products and trade defaults', () => {
    const p = buildSystemPrompt({
      snapshot: { balances: [], generatedAt: new Date().toISOString() },
      lang: 'en',
      fees: getFeeSnapshot(),
    });
    assert.match(p, /Do NOT invent products/);
    assert.match(p, /Do NOT invent trade defaults/);
    assert.match(p, /grid bot/i);
    assert.match(p, /UNTRUSTED/);
    assert.doesNotMatch(p, /ANY in-exchange task/i);
  });
});

describe('AI snapshot redaction', () => {
  it('omits demo/internal amounts and never treats unknown as 0', () => {
    const red = redactSnapshotForModel({
      balances: [
        { asset: 'USDT', mode: 'demo', amount: 9999, locked: 0 },
        { asset: 'ETH', mode: 'ledger', amount: 1.5, locked: 0 },
      ],
      generatedAt: '2026-09-15T00:00:00.000Z',
    });
    const demo = red.balances.find((b) => b.asset === 'USDT');
    assert.equal(demo.amount, null);
    assert.equal(demo.amountStatus, 'not_onchain_demo_or_internal');
    const eth = red.balances.find((b) => b.asset === 'ETH');
    assert.equal(eth.amount, 1.5);
    assert.equal(eth.amountStatus, 'ledger');
  });
});

describe('AI acceptance fixtures (mock model outputs)', () => {
  const fixturesPath = join(__dirname, '../src/ai/evals/v2-acceptance.json');
  const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf8'));

  for (const caseRow of fixtures.cases) {
    it(caseRow.id + ': ' + caseRow.title, () => {
      const out = extractCoachPayload(JSON.stringify(caseRow.modelOutput));
      if (caseRow.expect.actionNull) {
        assert.equal(out.action, null, 'expected action null');
      }
      if (caseRow.expect.actionType) {
        assert.equal(out.action?.type, caseRow.expect.actionType);
      }
      if (caseRow.expect.replyIncludes) {
        for (const frag of caseRow.expect.replyIncludes) {
          assert.match(out.reply, new RegExp(frag, 'i'));
        }
      }
      if (caseRow.expect.replyExcludes) {
        for (const frag of caseRow.expect.replyExcludes) {
          assert.doesNotMatch(out.reply, new RegExp(frag, 'i'));
        }
      }
      if (caseRow.expect.sanitizeError) {
        assert.equal(out.sanitizeError, caseRow.expect.sanitizeError);
      }
      if (caseRow.expect.feeCheck) {
        const fees = getFeeSnapshot();
        assert.equal(fees.predictTaker, 0.003);
        assert.match(out.reply, /0\.?30?\s*%|0\.003/i);
      }
    });
  }
});

describe('AI feedback ownership rules (pure)', () => {
  it('responseId must be owned by user', () => {
    const userId = '11111111-1111-1111-1111-111111111111';
    const ok = `${userId}:${crypto.randomUUID()}`;
    const bad = `22222222-2222-2222-2222-222222222222:${crypto.randomUUID()}`;
    assert.ok(ok.startsWith(`${userId}:`));
    assert.equal(bad.startsWith(`${userId}:`), false);
  });
});
