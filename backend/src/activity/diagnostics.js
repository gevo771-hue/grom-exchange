/** Evidence-based presentation of historical reports. Never settles a trade. */
import { classifyIssue } from './classify.js';

export const HEALTH_STALE_MS = 3 * 90_000;
export function healthView(snapshot, now = Date.now()) {
  const age = snapshot?.at ? now - new Date(snapshot.at).getTime() : NaN;
  const stale = !Number.isFinite(age) || age < 0 || age > HEALTH_STALE_MS;
  return { ...(snapshot || {}), ok: stale ? null : snapshot.ok, stale,
    age_ms: Number.isFinite(age) ? Math.max(0, age) : null };
}

export function issueDiagnostics(row, snapshot, now = Date.now()) {
  const detail = row.detail || {};
  const classification = classifyIssue({ product: row.product, action: row.action,
    message: detail.message, code: detail.code, detail });
  const cause = detail.source === 'health_pulse' ? `health_${detail.probe || String(row.action).replace(/^health_/, '')}` : classification.cause;
  let evidence = 'client_report';
  let evidenceLabel = 'Сообщение клиента · причина требует проверки';
  let state = 'historical';
  let stateLabel = 'Событие в прошлом · текущее состояние неизвестно';
  let summary = classification.ai_summary;
  if (cause === 'user_rejected') {
    evidence = 'wallet_rejection'; evidenceLabel = 'Клиент сообщил явный отказ кошелька';
    state = 'rejected'; stateLabel = 'Отказ в этой попытке';
  } else if (cause === 'wallet_no_confirm' || cause === 'wallet_request_timeout') {
    evidence = Number(detail.walletRequestAt) > 0 || detail.requestDispatched === true ? 'request_dispatched' : 'dispatch_unverified';
    evidenceLabel = evidence === 'request_dispatched'
      ? 'Клиент зафиксировал отправку запроса · ответ не получен'
      : 'Доставка запроса не подтверждена телеметрией';
    state = 'unknown'; stateLabel = 'Результат неизвестен · таймаут не означает отказ';
    summary = 'Кошелёк не вернул результат в срок. Отказ пользователя и отправка транзакции не установлены.';
  } else if (detail.source === 'health_pulse') {
    evidence = 'server_probe'; evidenceLabel = 'Проверка сервера';
    summary = detail.ai_summary || classification.ai_summary;
    const view = healthView(snapshot, now);
    const check = view.checks?.find(c => `health_${c.id}` === cause);
    const eventAt = new Date(row.created_at || row.at).getTime();
    const observedAt = new Date(check?.observed_at || 0).getTime();
    if (!view.stale && check && observedAt >= eventAt && check.verification === 'live') {
      state = check.ok ? 'passing_now' : 'failing_now';
      stateLabel = check.ok ? 'Сейчас проверка проходит · исторический сбой сохранён' : 'Повторная проверка подтверждает проблему';
    } else if (!view.stale && check?.verification === 'cached') {
      state = 'cached'; stateLabel = 'Показан последний успех из кэша · нужна свежая проверка';
    } else if (view.stale) {
      state = 'stale'; stateLabel = 'Свежей проверки сервера нет';
    }
  }
  return { cause, ai_summary: summary, severity: detail.source === 'health_pulse' ? (detail.severity || classification.severity) : classification.severity,
    evidence, evidence_label: evidenceLabel, current_state: state, state_label: stateLabel,
    recovery: { mode: detail.source === 'health_pulse' ? 'read_only_recheck' : 'manual_review',
      automatic_financial_actions: false },
    app_version: String(detail.appVer || '').slice(0, 64) || null };
}

/** Sequential scheduler + admin clicks share one read-only check, with a cooldown. */
export function createPulseController(run, { now = Date.now, cooldownMs = 30_000 } = {}) {
  let pending = null, lastStarted = -Infinity;
  const start = (options = {}) => {
    if (pending) return pending;
    lastStarted = now();
    pending = Promise.resolve().then(() => run(options)).finally(() => { pending = null; });
    return pending;
  };
  return { run: start, get running() { return !!pending; },
    recheck(options = {}) {
      if (pending) return { accepted: false, checking: true, retry_after_ms: 0 };
      const retryAfter = Math.max(0, cooldownMs - (now() - lastStarted));
      if (retryAfter) return { accepted: false, checking: false, retry_after_ms: retryAfter };
      // Background promise is intentionally handled, not an unobserved rejection.
      start({ ...options, force: true }).catch(() => {});
      return { accepted: true, checking: true, retry_after_ms: 0 };
    } };
}

export function trackProbe(check, previous, now = Date.now()) {
  const live = check.verification !== 'cached';
  return { ...check, verification: check.verification || 'live',
    observed_at: check.observed_at || new Date(now).toISOString(),
    consecutive_failures: live ? (check.ok ? 0 : (previous?.consecutive_failures || 0) + 1) : (previous?.consecutive_failures || 0),
    last_success_at: live && check.ok ? new Date(now).toISOString() : (previous?.last_success_at || null),
    recovered: live && check.ok && (previous?.consecutive_failures || 0) > 0 };
}
