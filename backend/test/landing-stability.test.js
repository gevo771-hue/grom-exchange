import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const source = readFileSync(new URL('../../frontend/public/grom-wallet.js', import.meta.url), 'utf8');
const start = source.indexOf('(function gwLangReactor() {');
const reactor = source.slice(start, source.indexOf('\n    })();', start) + '\n    })();'.length);
function setup() {
  const handlers = new Map(), observers = [], emitted = [];
  class Storage { constructor(){this.values=new Map([['grom_lang','ru']]);} getItem(k){return this.values.get(k)||null;} setItem(k,v){this.values.set(k,String(v));} }
  const localStorage = new Storage();
  const window = { addEventListener(type,fn){const list=handlers.get(type)||[];list.push(fn);handlers.set(type,list);}, dispatchEvent(e){emitted.push(e);for(const fn of handlers.get(e.type)||[])fn(e);} };
  const document = {documentElement:{lang:'ru'}};
  const context = {window,document,localStorage,Storage,CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}},MutationObserver:class{constructor(fn){observers.push(fn);}observe(){}}};
  vm.runInNewContext(reactor, context);
  return {context,emitted,mutate:()=>observers.forEach(fn=>fn([{attributeName:'lang'}]))};
}
test('SEO, hydration and language attribute writes do not repeatedly restart the landing',()=>{
  const x=setup();
  for(let i=0;i<100;i++){x.context.window.gromRefreshI18nPages();x.mutate();x.context.localStorage.setItem('grom_lang','ru');}
  assert.equal(x.emitted.length,0);
});
test('a real language switch emits once even when storage, hydration and SEO all signal it',()=>{
  const x=setup();
  x.context.localStorage.setItem('grom_lang','en');x.context.document.documentElement.lang='en';x.mutate();x.context.window.gromRefreshI18nPages();
  assert.equal(x.emitted.length,1);assert.equal(x.emitted[0].detail.lang,'en');
  x.context.localStorage.setItem('grom_lang','ru');x.mutate();
  assert.equal(x.emitted.length,2);assert.equal(x.emitted[1].detail.lang,'ru');
});
test('cross-tab preference changes are applied without repeating an already handled event',()=>{
  const x=setup();x.context.localStorage.values.set('grom_lang','es');
  x.context.window.dispatchEvent({type:'storage',key:'grom_lang'});x.mutate();
  assert.equal(x.emitted.filter(e=>e.type==='grom:lang-change').length,1);
});
