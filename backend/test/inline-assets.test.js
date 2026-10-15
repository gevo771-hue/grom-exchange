import test from 'node:test';
import assert from 'node:assert/strict';
import { externalizeInline } from '../../scripts/externalize-inline.mjs';
const pad = '/*' + 'x'.repeat(1100) + '*/';
test('shared inline blocks reuse hashed URLs without changing parser order', () => {
 const files = new Map(); const emit=(name,body)=>files.set(name,body);
 const code=`${pad}window.a = 1;`;
 const html=externalizeInline(`<script>${code}</script><div>body</div><script>${pad}window.b = window.a;</script>`,emit);
 assert.equal(files.size,2); assert.match(html, /^<script src="\/grom-inline-js\.[a-f0-9]{8}\.js"><\/script><div>body<\/div>/);
 const repeated=externalizeInline(`<script>${code}</script>`,emit);
 assert.ok(html.startsWith(repeated)); assert.equal(files.size,2);
 assert.ok([...files.values()].includes(code));
});
test('keeps JSON-LD, mutable styles, short bootstraps and scheduling-sensitive code inline', () => {
 for(const block of [`<script type="application/ld+json">${pad}</script>`,`<style id="theme">${pad}</style>`,`<script>window.a=1</script>`,`<script defer>${pad}</script>`,`<script>${pad}document.currentScript.remove()</script>`]) {
   assert.equal(externalizeInline(block,()=>assert.fail('must stay inline')),block);
 }
});
test('extracts CSS and modules with attributes and does not parse embedded style strings as CSS', () => {
 const files=[];
 const html=externalizeInline(`<style media="screen">${pad}body{color:red}</style><script type="module">${pad}const s = '<style>fake</style>';</script>`,(name,body)=>files.push({name,body}));
 assert.equal(files.length,2); assert.match(html, /<link rel="stylesheet" media="screen" href="\/grom-inline-css\.[a-f0-9]{8}\.css">/);
 assert.match(html, /<script type="module" src="\/grom-inline-js\.[a-f0-9]{8}\.js"><\/script>/);
 assert.ok(files[1].body.includes('<style>fake</style>'));
});
