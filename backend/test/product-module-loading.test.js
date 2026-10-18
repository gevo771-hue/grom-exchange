import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const src = readFileSync(new URL('../../frontend/public/index.html', import.meta.url), 'utf8');
const wallet = readFileSync(new URL('../../frontend/public/grom-wallet.js', import.meta.url), 'utf8');
function part(source, start, end) {
  const a = source.indexOf(start), b = source.indexOf(end, a);
  assert.ok(a >= 0 && b > a, start);
  return source.slice(a, b);
}
const loader = part(src, '/* Product module loader:', '/* End product module loader. */');
function fixture() {
  const scripts = [];
  const context = vm.createContext({ Promise, console, setTimeout, clearTimeout,
    document: {
      createElement: () => ({ remove() { this.removed = true; } }),
      head: { appendChild: el => scripts.push(el) },
    },
  });
  context.window = context;
  vm.runInContext(loader, context);
  const exports = { trade: 'gromHL', predict: 'gromPredict', charts: 'LightweightCharts' };
  function finish(name, api = {}) {
    context[exports[name]] = api;
    scripts.findLast(s => s.id === 'grom-product-' + name && !s.removed).onload();
  }
  return { context, scripts, finish };
}
test('landing and unrelated pages do not download trading, prediction or chart modules', async () => {
  const { context: c, scripts } = fixture();
  for (const page of ['landing', 'xstocks', 'settings', 'referral', 'help', 'backoffice']) {
    await c.gromLoadPageModules(page);
  }
  assert.equal(scripts.length, 0);
  assert.doesNotMatch(src, /<script[^>]+src=["'][^"']*lightweight-charts/);
  assert.doesNotMatch(src + wallet, /gromLoadAuxScripts|__gromAuxLoaded/);
});
test('direct Trade entry and concurrent balance requests share one download per module', async () => {
  const { context: c, scripts, finish } = fixture();
  const route = c.gromLoadPageModules('futures');
  const balance = c.gromEnsureProductModule('trade');
  const history = c.gromLoadPageModules('history');
  assert.equal(balance, c.gromEnsureProductModule('trade'));
  assert.deepEqual(scripts.map(x => x.id), ['grom-product-trade', 'grom-product-charts']);
  const hl = { balancesSnapshot() {} }; finish('trade', hl); finish('charts');
  await Promise.all([route, history]); assert.equal(await balance, hl);
  for (const page of ['markets', 'dashboard', 'wallet', 'futures']) await c.gromLoadPageModules(page);
  assert.equal(scripts.length, 2);
});
test('Predictions request only their module, and a failed download can be retried', async () => {
  const { context: c, scripts, finish } = fixture();
  const route = c.gromLoadPageModules('predict');
  assert.equal(scripts.length, 1); assert.match(scripts[0].src, /grom-predict/);
  const failure = assert.rejects(route, /Could not load predict/);
  scripts[0].onerror(); await failure;
  assert.equal(scripts[0].removed, true);
  const retry = c.gromLoadPageModules('predict'); finish('predict'); await retry;
  assert.equal(scripts.length, 2);
  await assert.rejects(c.gromEnsureProductModule('invalid'), /Unknown product module/);
});
test('an asset without its expected export fails instead of being marked ready', async () => {
  const { context: c, scripts } = fixture();
  const load = c.gromEnsureProductModule('trade');
  const rejected = assert.rejects(load, /Could not load trade/);
  scripts[0].onload(); await rejected;
});
function predictionFixture() {
  const f = fixture(), c = f.context, modals = [], messages = [];
  const attrs = { 'data-token-yes': 'yes-token', 'data-ends-at': 'future', 'data-q': 'Test market' };
  const card = { getAttribute: k => attrs[k] || '' };
  const btn = { dataset: { side: 'yes', name: 'Yes' }, getAttribute: k => attrs[k] || '', closest: () => card };
  Object.assign(c, { sidePriceFromBtn: () => .5, predictIsFresh: () => true,
    tx: (_k, fb) => fb, notify: (...args) => messages.push(args), openModal: opts => modals.push(opts) });
  vm.runInContext(src.split('\n').find(line => line.startsWith('  function esc(s)')), c);
  vm.runInContext(part(src, '  function tradeAttr(', "  document.addEventListener('grom:xstocks-focus'"), c);
  const api = { fetchConfig: async () => ({ enabled: true }), buyMarket() { assert.fail('no financial action during loading'); } };
  return { ...f, btn, modals, messages, api };
}
test('first prediction click waits for the module before offering the live confirmation', async () => {
  const { context: c, finish, btn, modals, api } = predictionFixture();
  const click = c.onBet(btn); await Promise.resolve(); assert.equal(modals.length, 0);
  finish('predict', api); await click;
  assert.equal(modals.length, 1); assert.equal(modals[0].live, true);
  assert.equal(typeof modals[0].onConfirmAsync, 'function');
});
test('a market closing during module loading does not open a stale order confirmation', async () => {
  const { context: c, finish, btn, modals, messages, api } = predictionFixture();
  const click = c.onBet(btn); c.predictIsFresh = () => false;
  finish('predict', api); await click;
  assert.equal(modals.length, 0); assert.equal(messages.at(-1)[1], 'error');
});
test('failed prediction module never falls through into a demo purchase; next click retries', async () => {
  const { context: c, scripts, finish, btn, modals, messages, api } = predictionFixture();
  const click = c.onBet(btn); scripts[0].onerror(); await click;
  assert.equal(modals.length, 0); assert.equal(messages.at(-1)[1], 'error');
  const retry = c.onBet(btn); finish('predict', api); await retry;
  assert.equal(modals[0].live, true);
});
test('hidden charts request nothing, and a slow chart download does not spin animation frames', async () => {
  const { context: c, scripts, finish } = fixture(); let visible = false, redraws = 0;
  Object.assign(c, { _gromTVChartIds: ['futChart'], scheduleDeskChartDraw() { assert.fail('no frame polling while downloading'); },
    drawVisibleDeskCharts() { redraws++; }, gromDrawTVChart() {},
  });
  c.document.getElementById = () => ({ closest: () => visible, offsetParent: visible ? {} : null });
  vm.runInContext(part(src, 'function gromWaitForLightweightCharts(', 'window.drawChart = drawChart;'), c);
  c.drawChart('futChart'); assert.equal(scripts.length, 0);
  visible = true; c.drawChart('futChart'); c.drawChart('futChart');
  assert.equal(scripts.length, 1); assert.equal(redraws, 0);
  finish('charts'); await c.__gromTVLibWait; assert.equal(redraws, 1);
});
test('history waits for Trade code and retains the connected-wallet guard', async () => {
  const { context: c, scripts, finish } = fixture(); let address = '';
  c.gromHistoryWalletAddress = () => address;
  vm.runInContext(part(src, '  async function fetchHlHistoryItems()', '  async function hydrateHistoryPage('), c);
  assert.equal((await c.fetchHlHistoryItems()).length, 0); assert.equal(scripts.length, 0);
  address = '0x' + 'ab'.repeat(20); const history = c.fetchHlHistoryItems();
  finish('trade', { historyItems: async limit => [{ id: 'fill', limit }] });
  assert.equal((await history)[0].id, 'fill');
});
test('portfolio loads Trade without loading Predictions and uses the real balance API', async () => {
  const { context: c, scripts, finish } = fixture();
  vm.runInContext(part(wallet, 'async function gwWaitForGromHl(', 'async function gwRenderTradingHubCard('), c);
  const wait = c.gwWaitForGromHl();
  finish('trade', { balancesSnapshot() {} }); assert.equal(await wait, true);
  assert.deepEqual(scripts.map(s => s.id), ['grom-product-trade']);
});

test('wallet module wait respects its time budget without cancelling the shared download', async () => {
  const { context: c, scripts, finish } = fixture(); let timeout;
  c.setTimeout = fn => { timeout = fn; return 1; }; c.clearTimeout = () => {};
  vm.runInContext(part(wallet, 'async function gwWaitForGromHl(', 'async function gwRenderTradingHubCard('), c);
  const wait = c.gwWaitForGromHl(500); timeout(); assert.equal(await wait, false);
  const later = c.gwWaitForGromHl(); finish('trade', { balancesSnapshot() {} });
  assert.equal(await later, true); assert.equal(scripts.length, 1);
});

test('prediction modal escapes untrusted outcome text before rendering HTML', async () => {
  const { context: c, finish, btn, modals, api } = predictionFixture();
  btn.dataset.name = '<img src=x onerror=alert(1)>';
  const click = c.onBet(btn); finish('predict', api); await click;
  assert.ok(modals[0].title.includes('&lt;img'));
  assert.ok(!modals[0].title.includes('<img'));
});
