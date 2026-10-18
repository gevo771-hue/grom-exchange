/** Provider tags are stable across UI locales; never match translated country names. */
export function isUsElection2026(event) {
  const tags = new Set((Array.isArray(event?.tags) ? event.tags : []).map(t => String(t.slug || '').toLowerCase()));
  const slug = String(event?.slug || '').toLowerCase();
  return tags.has('midterms') || (tags.has('united-states') && tags.has('elections') && /(?:^|-)2026(?:-|$)/.test(slug));
}
