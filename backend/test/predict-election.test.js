import test from 'node:test';
import assert from 'node:assert/strict';
import { isUsElection2026 } from '../src/market/predict-election.js';
test('US election shortcut is tag-based, locale-independent, and excludes unrelated countries and election years', () => {
 const e = (slug, tags) => ({ slug, title: 'Translated title', tags: tags.map(slug => ({slug})) });
 assert.equal(isUsElection2026(e('which-party-will-win-the-house-in-2026',['midterms','elections'])),true);
 assert.equal(isUsElection2026(e('governor-2026',['united-states','elections'])),true);
 assert.equal(isUsElection2026(e('brazil-2026',['elections','brazil'])),false);
 assert.equal(isUsElection2026(e('us-president-2028',['united-states','elections'])),false);
 assert.equal(isUsElection2026(e('us-iran-ceasefire',['united-states','politics'])),false);
});
