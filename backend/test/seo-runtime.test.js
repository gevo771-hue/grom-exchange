import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const source = readFileSync(new URL('../../frontend/public/index.html', import.meta.url), 'utf8');
const update = source.slice(source.indexOf('function updateRouteSeo(page) {'), source.indexOf('window.gromSeoRefreshRouteMeta ='));
function context({path, route, locale, canonicalUrl, language='ru'}) {
  const canonical = { value: canonicalUrl, getAttribute() { return this.value; }, setAttribute(_k,v) { this.value=v; } };
  const doc = { title:'SSR translated title', documentElement:{lang:locale, getAttribute(k) {return k==='data-grom-locale'?locale:route;}}, querySelector(){return canonical;} };
  const calls=[];
  const ctx = {document:doc,location:{pathname:path},window:{GROM_SEO_I18N:{curLang:()=>language,getRouteMeta:(key)=>{calls.push(key);return {title:key,description:'Description'};}}},GROM_SEO_VARIANTS:{a:{base:{}}},GROM_SEO_AB:'a',GROM_SEO_KEYWORDS:{},gromSeoSet(){},gromSeoSetProp(){}};
  vm.createContext(ctx);vm.runInContext(update,ctx);return {ctx,doc,canonical,calls};
}
test('hydration preserves translated path metadata despite a different saved UI language',()=>{
  const x=context({path:'/id/',route:'landing',locale:'id',canonicalUrl:'https://grom.exchange/id/'});
  x.ctx.updateRouteSeo('landing');assert.equal(x.doc.title,'SSR translated title');assert.equal(x.doc.documentElement.lang,'id');assert.equal(x.canonical.value,'https://grom.exchange/id/');assert.deepEqual(x.calls,[]);
});
test('swap navigation gets swap metadata and a clean product canonical without language query or hash',()=>{
  const x=context({path:'/swap',canonicalUrl:'https://grom.exchange/'});
  x.ctx.updateRouteSeo('dashboard');assert.deepEqual(x.calls,['dashboard']);assert.equal(x.canonical.value,'https://grom.exchange/swap');assert.equal(x.doc.title,'dashboard');
});
test('localized product navigation preserves its path prefix',()=>{
  const x=context({path:'/pt-BR/futures',canonicalUrl:'https://grom.exchange/pt-BR/'});
  x.ctx.updateRouteSeo('futures');assert.equal(x.canonical.value,'https://grom.exchange/pt-BR/futures');
});

test('leaving a slim landing preserves its content until the full app loads',()=>{
  const start=source.indexOf('function show(page) {');
  const handoff=source.slice(start,source.indexOf('  var prevPage = window.__gromLastPage;',start))+'}';
  for(const page of ['markets','predict','futures']) {
    let destination,dismissed=false;const stored={};
    const doc={documentElement:{lang:'ru'},getElementById(){return null;},
      querySelectorAll(){throw new Error('The current page must stay visible during navigation');},
      createElement(){throw new Error('No overlay should be added');}};
    const ctx={document:doc,window:{gromDismissSplash(){dismissed=true;}},URLSearchParams,Date,sessionStorage:{setItem(k,v){stored[k]=v;}},
      location:{search:'?_spa=old&_spa=duplicate&event=32225&lang=ru',replace(url){destination=url;}}};
    vm.createContext(ctx);vm.runInContext(handoff,ctx);ctx.show(page);
    const url=new URL(destination,'https://grom.exchange');
    assert.equal(url.pathname,'/app.html');assert.equal(url.hash,'#'+page);
    assert.equal(url.searchParams.getAll('_spa').length,0);
    assert.equal(url.searchParams.get('lang'),'ru');
    assert.equal(url.searchParams.get('event'),page==='predict'?'32225':null);
    assert.equal(stored.grom_spa_page,page);assert.equal(dismissed,true);
  }
});
