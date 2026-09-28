import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertFiniteNonNeg,
  assertOkDimensionsResponse,
} from '../../defillama/dimension-adapters/aggregators/grom-guards.js';

describe('grom aggregator assertFiniteNonNeg (adapter logic)', () => {
  it('accepts finite numbers and numeric strings', () => {
    assert.equal(assertFiniteNonNeg(0, 'dailyVolumeUsd'), 0);
    assert.equal(assertFiniteNonNeg(1.5, 'dailyVolumeUsd'), 1.5);
    assert.equal(assertFiniteNonNeg('2.25', 'dailyFeesUsd'), 2.25);
  });

  for (const [label, value] of [
    ['false', false],
    ['true', true],
    ['empty string', ''],
    ['whitespace', '   '],
    ['array', []],
    ['object', {}],
    ['null', null],
    ['undefined', undefined],
    ['NaN', NaN],
    ['Infinity', Infinity],
    ['negative', -1],
    ['non-numeric string', 'abc'],
  ]) {
    it(`rejects ${label}`, () => {
      assert.throws(() => assertFiniteNonNeg(value, 'dailyVolumeUsd'), /grom aggregator/);
    });
  }
});

describe('grom aggregator assertOkDimensionsResponse (adapter logic)', () => {
  const base = {
    ok: true,
    chainKey: 'arbitrum',
    startTimestamp: 100,
    endTimestamp: 200,
    dailyVolumeUsd: 0,
    dailyFeesUsd: 0,
    coverage: { status: 'ready' },
  };
  const want = { chainKey: 'arbitrum', startTimestamp: 100, endTimestamp: 200 };

  it('accepts ready zero window', () => {
    const out = assertOkDimensionsResponse(base, want);
    assert.equal(out.volume, 0);
    assert.equal(out.fees, 0);
  });

  it('rejects missing chainKey', () => {
    const { chainKey, ...rest } = base;
    assert.throws(() => assertOkDimensionsResponse(rest, want), /missing chainKey/);
  });

  it('rejects empty chainKey', () => {
    assert.throws(
      () => assertOkDimensionsResponse({ ...base, chainKey: '  ' }, want),
      /missing chainKey/
    );
  });

  it('rejects wrong chainKey', () => {
    assert.throws(
      () => assertOkDimensionsResponse({ ...base, chainKey: 'ethereum' }, want),
      /chainKey mismatch/
    );
  });

  it('rejects ok!==true', () => {
    assert.throws(
      () => assertOkDimensionsResponse({ ...base, ok: false }, want),
      /ok!==true|rejected/
    );
  });

  it('rejects coverage not ready', () => {
    assert.throws(
      () => assertOkDimensionsResponse({ ...base, coverage: { status: 'unsynced' } }, want),
      /not ready/
    );
  });

  it('rejects boolean volume coerced-to-zero traps', () => {
    assert.throws(
      () => assertOkDimensionsResponse({ ...base, dailyVolumeUsd: false }, want),
      /invalid dailyVolumeUsd/
    );
  });

  it('rejects array fees', () => {
    assert.throws(
      () => assertOkDimensionsResponse({ ...base, dailyFeesUsd: [] }, want),
      /invalid dailyFeesUsd/
    );
  });

  it('rejects one-element array timestamps (Number coercion trap)', () => {
    assert.throws(
      () => assertOkDimensionsResponse({ ...base, startTimestamp: [100] }, want),
      /invalid startTimestamp/
    );
    assert.throws(
      () => assertOkDimensionsResponse({ ...base, endTimestamp: ['200'] }, want),
      /invalid endTimestamp/
    );
  });
});
