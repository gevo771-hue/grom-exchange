/**
 * Slim / scrub public HTML for SEO routes so crawlers do not receive the full
 * SPA DOM (admin, demo stats, inactive Russian panels).
 */

export const ALL_PAGE_IDS = [
  'page-landing',
  'page-dashboard',
  'page-markets',
  'page-predict',
  'page-xstocks',
  'page-wallet',
  'page-history',
  'page-futures',
  'page-spot',
  'page-binary',
  'page-referral',
  'page-backoffice',
  'page-settings',
  'page-help',
];

/** SEO route key → page section to keep (others stripped). */
export const ROUTE_KEEP_PAGES = {
  landing: ['page-landing'],
  dashboard: ['page-dashboard'],
  futures: ['page-futures'],
  predict: ['page-predict'],
  xstocks: ['page-xstocks'],
  markets: ['page-markets'],
};

/** Demo / prize / referral figures that must not look like live production data. */
export const DEMO_CLAIM_PATTERNS = [
  /GROM-G7K3Q9/g,
  /https:\/\/grom\.exchange\/r\/G7K3Q9/g,
  /0x7a3f\.\.\.c9e1/gi,
  /\$18,473(?:\.20)?/g,
  /18,420/g,
  /1,284/g,
  /\b742\b/g,
  /\b487\b/g,
  /\+12\.4%/g,
  /prize pool[\s\S]{0,120}?\$25,000/gi,
  /Your rank\s*<strong>#148<\/strong>[\s\S]{0,80}?4,217/gi,
  /Your tier:\s*Gold/gi,
  /Gold ← you/gi,
];

export const ADMIN_MARKERS = [
  'id="page-backoffice"',
  'Админ-панель',
  'boffApplyPeriod',
  'boffKpiOnline',
];
/* navBackoffice stays in the SPA shell (display:none) — showAdminLink needs the hook.
 * Heavy panel markup lives in /pages/backoffice.html and is injected at runtime. */

function mapOutsideScriptsStyles(html, fn) {
  const parts = html.split(/(<(?:script|style)\b[^>]*>[\s\S]*?<\/(?:script|style)>)/gi);
  return parts.map((chunk) => {
    if (/^<(?:script|style)\b/i.test(chunk)) return chunk;
    return fn(chunk);
  }).join('');
}

/** Remove a top-level <section id="..."> including nested <section> children. */
export function stripSectionById(html, id) {
  const openRe = new RegExp(`<section\\b[^>]*\\bid="${id}"[^>]*>`, 'i');
  const m = openRe.exec(html);
  if (!m) return html;
  const start = m.index;
  let depth = 1;
  const tagRe = /<\/?section\b[^>]*>/gi;
  tagRe.lastIndex = start + m[0].length;
  let tm;
  while ((tm = tagRe.exec(html))) {
    if (/^<\//.test(tm[0])) depth -= 1;
    else depth += 1;
    if (depth === 0) {
      return html.slice(0, start) + html.slice(tm.index + tm[0].length);
    }
  }
  return html;
}

/** Canonical lazy-page content; fail the build instead of shipping an old copy. */
export function extractSectionInnerHtml(html, id) {
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error('Invalid section id');
  const open = new RegExp(`<section\\b[^>]*\\bid="${id}"[^>]*>`, 'i').exec(html);
  if (!open) throw new Error(`Missing section: ${id}`);
  const start = open.index + open[0].length;
  const tags = /<\/?section\b[^>]*>/gi;
  tags.lastIndex = start;
  let depth = 1;
  let tag;
  while ((tag = tags.exec(html))) {
    depth += tag[0].startsWith('</') ? -1 : 1;
    if (!depth) return html.slice(start, tag.index).trim() + '\n';
  }
  throw new Error(`Unclosed section: ${id}`);
}

export function stripAdminFromHtml(html) {
  /* Drop the heavy panel from crawlable HTML; keep #navBackoffice (hidden) so
   * admins can open the desk after /pages/backoffice.html is injected. */
  let out = stripSectionById(html, 'page-backoffice');
  out = mapOutsideScriptsStyles(out, (chunk) => chunk
    .replace(/>Админка</g, '>Admin<')
    .replace(/>Админ-панель</g, '>Admin panel<'));
  return out;
}

export function scrubDemoClaims(html) {
  return mapOutsideScriptsStyles(html, (chunk) => {
    let c = chunk;
    for (const re of DEMO_CLAIM_PATTERNS) {
      c = c.replace(re, '—');
    }
    /* Zero visible funnel / tier demo numbers still left as digits in ref cards */
    c = c.replace(/(id="refFunnelClicks">)[^<]*/gi, '$1—');
    c = c.replace(/(id="refFunnelSignups">)[^<]*/gi, '$1—');
    c = c.replace(/(id="refFunnelTraders">)[^<]*/gi, '$1—');
    c = c.replace(/(id="refFunnelPaid">)[^<]*/gi, '$1—');
    c = c.replace(/(id="refCode">)[^<]*/gi, '$1—');
    return c;
  });
}

/** Prefer English chrome labels in crawlable body of EN public routes.
 *  Do NOT rewrite language-picker native names (Русский stays Русский). */
export function scrubShellToEnglish(html) {
  return mapOutsideScriptsStyles(html, (chunk) => chunk
    .replace(/>Админка</g, '>Admin<'));
}

/**
 * Keep only the route's page section(s); drop the rest of the SPA DOM.
 * Shell / nav / scripts stay. Missing pages are handled at runtime via hard nav.
 */
export function slimHtmlForRoute(html, routeKey) {
  const keep = new Set(ROUTE_KEEP_PAGES[routeKey] || []);
  if (!keep.size) return html;
  let out = html;
  for (const id of ALL_PAGE_IDS) {
    if (keep.has(id)) continue;
    out = stripSectionById(out, id);
  }
  return out;
}

export function preparePublicRouteHtml(html, routeKey) {
  let out = slimHtmlForRoute(html, routeKey);
  out = stripAdminFromHtml(out);
  out = scrubDemoClaims(out);
  out = scrubShellToEnglish(out);
  return out;
}

/** Full app shell for /wallet|/history|… SPA fallback — no admin, no demo claims. */
export function prepareAppShellHtml(html) {
  let out = stripAdminFromHtml(html);
  out = scrubDemoClaims(out);
  out = scrubShellToEnglish(out);
  /* Drop binary desk prize UI (hidden product) from crawlable shell */
  out = stripSectionById(out, 'page-binary');
  return out;
}

/** Body text visible to naive crawlers (no script/style, tags stripped). */
export function crawlableBodyText(html) {
  return html
    .replace(/<(?:script|style)\b[^>]*>[\s\S]*?<\/(?:script|style)>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
