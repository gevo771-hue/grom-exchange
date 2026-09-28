import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  escHtml,
  escAttr,
  safeLogoUrl,
  safeTokenSymbol,
  safeTokenName,
} from '../src/utils/html-escape.js';

describe('CA-04 DOM XSS sanitizers', () => {
  const xss = '"><img src=x onerror=alert(1)>';

  it('escapes HTML so payload is inert text', () => {
    const out = escHtml(xss);
    assert.equal(out.includes('<img'), false);
    assert.equal(out.includes('onerror'), true); // text only
    assert.ok(out.includes('&lt;') || out.includes('&quot;'));
  });

  it('blocks javascript: and data: logos', () => {
    assert.equal(safeLogoUrl('javascript:alert(1)'), '');
    assert.equal(safeLogoUrl('data:text/html,<script>'), '');
    assert.equal(safeLogoUrl('http://evil.example/a.png'), '');
    assert.ok(safeLogoUrl('https://cdn.example/token.png').startsWith('https://'));
  });

  it('rejects hostile symbols/names', () => {
    assert.equal(safeTokenSymbol(xss), '???');
    assert.equal(safeTokenName(xss, 'ETH').includes('<'), false);
    assert.equal(safeTokenSymbol('USDC'), 'USDC');
  });

  it('escAttr neutralizes attribute breakouts', () => {
    const a = escAttr('x" onload="alert(1)');
    assert.equal(a.includes('"'), false);
    assert.ok(a.includes('&quot;'));
  });
});
