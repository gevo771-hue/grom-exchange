import test from 'node:test';
import assert from 'node:assert/strict';
import { pmCategory } from '../src/market/predict-category.js';

test('short league and ticker names do not match fragments of political event text', () => {
  assert.equal(pmCategory({ title: 'Democratic Presidential Nominee 2028', tags: [{ label: 'Elections', slug: 'elections' }] }), 'politics');
  assert.equal(pmCategory({ title: 'Netherlands election', tags: [{ label: 'Politics' }] }), 'politics');
  assert.equal(pmCategory({ title: 'Will the Fed cut interest rates?' }), 'economy');
});
test('real esport leagues and crypto tickers still match whole words', () => {
  for (const title of ['LEC winner', 'LCK: T1 vs Gen.G', 'CS2: Spirit vs Vitality', 'League of Legends Worlds']) {
    assert.equal(pmCategory({ title }), 'esports', title);
  }
  assert.equal(pmCategory({ title: 'ETH above $3000?' }), 'crypto');
  assert.equal(pmCategory({ title: 'NFL champion 2027' }), 'sport');
});
test('canonical tag slugs and event slugs preserve classification across translations', () => {
  for (const title of ['Democratic Presidential Nominee 2028', 'Демократический кандидат в президенты 2028 года', 'Nominiert 2028']) {
    assert.equal(pmCategory({ title, tags: [{ label: 'Wahlen', slug: 'elections' }] }), 'politics');
  }
  assert.equal(pmCategory({ title: 'Прогноз', slug: 'fed-decision-in-october' }), 'economy');
});
