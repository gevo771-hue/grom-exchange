import { createHash } from 'node:crypto';

/** Extract large static blocks while preserving parser order and executable type.
 * Keep small bootstraps, JSON-LD, async/defer scripts and mutable/id-bearing styles inline.
 */
export function externalizeInline(html, emit) {
  return html.replace(/<(script|style)\b([^>]*)>([\s\S]*?)<\/\1>/gi, (whole, tag, attrs, body) => {
    const script = tag.toLowerCase() === 'script';
    if (body.length < 1024 || /\b(?:src|id)\s*=/i.test(attrs)) return whole;
    if (script && (/\b(?:async|defer)\b/i.test(attrs) || /\bdocument\s*\.\s*(?:currentScript|write)\b/.test(body))) return whole;
    const type = attrs.match(/\btype\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase();
    if (script && type && !['text/javascript', 'application/javascript', 'module'].includes(type)) return whole;
    const ext = script ? 'js' : 'css';
    const hash = createHash('sha256').update(body).digest('hex').slice(0, 8);
    const name = `grom-inline-${ext}.${hash}.${ext}`;
    emit(name, body);
    return script ? `<script${attrs} src="/${name}"></script>` : `<link rel="stylesheet"${attrs} href="/${name}">`;
  });
}
