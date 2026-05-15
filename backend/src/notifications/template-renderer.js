import { query } from '../db/pool.js';

const CACHE_TTL_MS = 60_000;
let cache = new Map();
let cacheLoadedAt = 0;

function flatten(value, prefix = '', out = {}) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const [key, child] of Object.entries(value)) {
      flatten(child, prefix ? `${prefix}.${key}` : key, out);
    }
    return out;
  }
  out[prefix] = value == null ? '' : String(value);
  return out;
}

export function interpolate(template, payload = {}) {
  const flat = flatten(payload);
  return String(template || '').replace(/\$\{([^}]+)\}/g, (_m, key) => {
    const trimmed = key.trim();
    return flat[trimmed] ?? flat[trimmed.split('.').at(-1)] ?? '';
  });
}

async function loadTemplates() {
  const now = Date.now();
  if (cache.size && now - cacheLoadedAt < CACHE_TTL_MS) return cache;
  const { rows } = await query(
    `SELECT template_key, subject_tpl, html_tpl, text_tpl
       FROM email_templates`
  );
  cache = new Map(rows.map((row) => [row.template_key, row]));
  cacheLoadedAt = now;
  return cache;
}

export function clearTemplateCache() {
  cache = new Map();
  cacheLoadedAt = 0;
}

export async function renderEmailTemplate(templateKey, payload = {}) {
  const templates = await loadTemplates();
  const template = templates.get(templateKey);
  if (!template) {
    const err = new Error(`email_template_not_found:${templateKey}`);
    err.status = 404;
    throw err;
  }
  return {
    subject: interpolate(template.subject_tpl, payload),
    html: interpolate(template.html_tpl, payload),
    text: interpolate(template.text_tpl, payload),
  };
}

export default renderEmailTemplate;
