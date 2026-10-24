import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const src = readFileSync(new URL('../../frontend/public/landing-v2.js', import.meta.url), 'utf8');
const fn = src.slice(src.indexOf('  function renderSwap(eth)'), src.indexOf('  function coinBadge('));
const render = vm.runInNewContext(fn + ';renderSwap', {
  t: k => ({compare_estimate:'Estimate',compare_note:'Model, not a quote: assumes 1inch returns 0.67% less. Gas and fees excluded.'}[k] || k),
  esc: s => s, fmtUsd: n => '$' + n.toFixed(2), coinBadge: () => '', COIN_LOGO: {}, COIN_TINT: {}, ICON: {}
});
test('comparison is a labelled model calculated from the displayed reference amount', () => {
  const html = render(2000);
  assert.match(html, /Estimate: \+\$6\.70 vs 1inch/);
  assert.match(html, /Model, not a quote/);
  assert.match(html, /0\.67%/);
  assert.match(html, /Gas and fees excluded/);
});
test('small reference amounts do not get an invented minimum saving', () => {
  assert.match(render(100), /Estimate: \+\$0\.34 vs 1inch/);
});
test('absent or invalid prices cannot produce a numerical comparison', () => {
  for (const value of [null,undefined,0,-1,NaN,Infinity,'not a price']) {
    const html=render(value);
    assert.match(html, /Estimate: — vs 1inch/);
    assert.doesNotMatch(html, /\$[0-9]|NaN|Infinity/);
  }
});
