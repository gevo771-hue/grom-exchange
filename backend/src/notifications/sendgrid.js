import config from '../config/index.js';
import logger from '../utils/logger.js';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function sendEmail({ to, subject, html, text }, {
  apiKey = config.email.sendgrid.apiKey,
  from = config.email.from,
  dryRun = config.email.dryRun,
  endpoint = config.email.sendgrid.baseUrl,
  fetchImpl = globalThis.fetch,
  retries = 3,
  timeoutMs = 10_000,
} = {}) {
  if (dryRun) {
    logger.info({ to, subject }, 'sendgrid dry-run email');
    return { ok: true, messageId: `dry-run-${Date.now()}` };
  }
  if (!apiKey) return { ok: false, error: 'sendgrid_api_key_missing' };
  if (!to) return { ok: false, error: 'recipient_missing' };

  const body = {
    personalizations: [{ to: [{ email: to }] }],
    from: parseFrom(from),
    subject,
    content: [
      { type: 'text/plain', value: text || '' },
      { type: 'text/html', value: html || text || '' },
    ],
  };

  let lastError = '';
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetchImpl(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const messageId = res.headers?.get?.('x-message-id') || null;
      if (res.status >= 200 && res.status < 300) return { ok: true, messageId };
      lastError = `sendgrid_http_${res.status}`;
      if (res.status < 500 || attempt === retries) break;
      await sleep(250 * attempt);
    } catch (err) {
      lastError = err.name === 'AbortError' ? 'sendgrid_timeout' : err.message;
      if (attempt === retries) break;
      await sleep(250 * attempt);
    } finally {
      clearTimeout(timer);
    }
  }
  return { ok: false, error: lastError || 'sendgrid_failed' };
}

export function parseFrom(value) {
  const input = String(value || '').trim();
  const match = input.match(/^(.*)<([^>]+)>$/);
  if (match) {
    return { name: match[1].trim().replace(/^"|"$/g, ''), email: match[2].trim() };
  }
  return { email: input };
}

export default { sendEmail };
