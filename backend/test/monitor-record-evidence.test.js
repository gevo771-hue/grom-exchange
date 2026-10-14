import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { classifyIssue } from '../src/activity/classify.js';
import { issueDiagnostics } from '../src/activity/diagnostics.js';
import { userRecordEvidence } from '../src/admin/user-evidence.js';

const incident = (action, detail = {}) => ({ product: 'swap', action, detail });
test('a client-labelled canary is not proof of a failed swap or its author', () => {
  const result = issueDiagnostics(incident('probe-canary', { note: 'engagement rail verification', cause: 'swap_other', ai_summary: 'Сбой свопа' }));
  assert.equal(result.cause, 'diagnostic_probe');
  assert.equal(result.severity, 'info');
  assert.equal(result.current_state, 'unverified');
  assert.match(result.evidence_label, /автор не установлен/);
  assert.match(result.state_label, /Хеш транзакции не записан/);
  assert.equal(result.recovery.automatic_financial_actions, false);
  assert.doesNotMatch(result.ai_summary, /Сбой свопа/);
});
test('even a diagnostic record with a hash does not imply execution', () => {
  const result = issueDiagnostics({ ...incident('swap_simbolico_poc'), tx_hash: '0x' + 'ab'.repeat(32) });
  assert.equal(result.current_state, 'unverified');
  assert.match(result.state_label, /результат в сети требует проверки/);
  assert.equal(classifyIssue(incident('swap_failed', { message: 'execution reverted' })).cause, 'tx_reverted');
  assert.notEqual(classifyIssue(incident('swap_failed', { note: 'probe-canary' })).cause, 'diagnostic_probe');
});
test('relay country refusal overrides generic runtime action without claiming present failure', () => {
  const detail = { message: 'WebSocket connection closed abnormally with code: 3000 (Country is blocked)', file: 'https://grom.exchange/wc/sign-client.bundle.js', walletLabel: 'Trust Wallet', mobile: true };
  for (const action of ['runtime_error', 'unhandled_rejection']) {
    const result = issueDiagnostics({ product: 'system', action, detail });
    assert.equal(result.cause, 'wallet_relay_region_blocked');
    assert.equal(result.current_state, 'historical');
    assert.equal(result.severity, 'warn');
    assert.match(result.ai_summary, /Country is blocked/);
    assert.doesNotMatch(result.ai_summary, /Необработанная ошибка JavaScript/);
  }
  assert.equal(classifyIssue({ action: 'runtime_error', message: 'Cannot read property foo' }).cause, 'runtime_error');
});
test('one event-loop observation cannot prove permanent overload, including old stored summaries', () => {
  const result = issueDiagnostics(incident('health_eventloop', { source: 'health_pulse', probe: 'eventloop', ms: 579, ai_summary: 'Бэкенд перегружен — биржа будет тупить' }));
  assert.match(result.ai_summary, /579ms/);
  assert.match(result.ai_summary, /Один замер не устанавливает/);
  assert.doesNotMatch(result.ai_summary, /биржа будет тупить/);
});
test('account records distinguish placeholders, service and logged SIWE without identifying people', () => {
  for (const suffix of ['0001', 'b047', 'dead']) {
    assert.equal(userRecordEvidence({ wallet_address: '0x' + '0'.repeat(36) + suffix }).record_kind, 'placeholder');
  }
  assert.equal(userRecordEvidence({ wallet_address: '0x' + '1'.repeat(40) }).record_kind, 'placeholder');
  assert.equal(userRecordEvidence({ wallet_address: 'market-maker' }).record_kind, 'service');
  const wallet_address = '0x' + 'ab'.repeat(20);
  assert.equal(userRecordEvidence({ wallet_address }).record_kind, 'unverified');
  const logged = userRecordEvidence({ wallet_address, siwe_recorded_at: '2026-10-13T20:52:08Z' });
  assert.equal(logged.record_kind, 'siwe_recorded');
  assert.match(logged.record_label, /запись SIWE/);
  assert.equal(userRecordEvidence({ wallet_address: '0x' + '1'.repeat(40), siwe_recorded_at: '2026-10-13T20:52:08Z' }).record_kind, 'siwe_recorded');
});
const html = readFileSync(new URL('../../frontend/public/index.html', import.meta.url), 'utf8');
function extract(name) { const at = html.indexOf('function ' + name + '('); assert.ok(at >= 0); return html.slice(at, html.indexOf('\n}', at) + 2); }
const ctx = vm.createContext({ boffShortAddr: x => x, boffFmtTime: x => x });
vm.runInContext(['boffMonitorEsc', 'boffTradeHtml', 'boffEventDetailsHtml', 'boffUserRowHtml', 'boffActionRu', 'boffDetailText', 'boffFeedRowHtml'].map(extract).join('\n'), ctx);
test('admin account and activity render untrusted report fields as text', () => {
  const unsafe = '<img src=x onerror=alert(1)>';
  const account = ctx.boffUserRowHtml({ wallet_address: unsafe, record_label: unsafe, created_at: unsafe, last_seen_at: unsafe });
  assert.doesNotMatch(account, /<img/); assert.match(account, /&lt;img/);
  const feed = ctx.boffFeedRowHtml({ at: unsafe, wallet: unsafe, product: 'other', action: unsafe, product_label: unsafe, status: unsafe, detail: { message: unsafe } });
  assert.doesNotMatch(feed, /<img/); assert.match(feed, /&lt;img/);
});
test('activity feed shows diagnostic labels and does not present the client note as settled funds', () => {
  const feed = ctx.boffFeedRowHtml({ product: 'swap', action: 'swap_simbolico_poc', detail: { from: 'ETH', to: 'USDC', note: 'signed tx' } });
  assert.match(feed, /Диагностическая запись/);
  assert.match(feed, /Исполнение сделки не подтверждено/);
});
