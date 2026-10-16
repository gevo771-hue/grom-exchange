import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { tradeFacts } from '../src/activity/trade-facts.js';
const src = readFileSync(new URL('../../frontend/public/index.html', import.meta.url), 'utf8');
const loader = src.slice(src.indexOf('var __boffActivity = {};'), src.indexOf('function showAdminLink('));
function setup(kind = 'issues') {
  const nodes = new Map(), requests = [], renders = [];
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, {value:'', textContent:'existing snapshot', dataset:{}, attributes:{}, hidden:false,
      setAttribute(k,v) {this.attributes[k]=v;}, querySelector() {return this.button ||= {disabled:false};} });
    return nodes.get(id);
  };
  const ctx = vm.createContext({window:{}, document:{getElementById:node}, checkAdminAccessFromJwt:()=>true,
    boffPeriodQs:()=>'', boffIssueRowHtml:()=>'', boffFeedRowHtml:()=>'',
    gget:url=>new Promise((resolve,reject)=>requests.push({url,resolve,reject})) });
  vm.runInContext(loader,ctx);
  ctx.boffRenderActivity = (host, rows) => { renders.push(rows); host.textContent=JSON.stringify(rows); };
  const data = (rows,hasMore=false) => ({[kind==='issues'?'issues':'events']:rows,hasMore,reports_24h:3});
  const load = mode=>ctx.boffLoadActivity(kind,mode);
  return {ctx,node,requests,renders,data,load};
}
for (const kind of ['issues','feed']) test(`${kind}: refresh keeps content while pending and after an API failure`,async()=>{
  const x=setup(kind), prefix=kind==='issues'?'Issues':'Feed', host=x.node('boff'+prefix+'List');
  let p=x.load();x.requests[0].resolve(x.data([{id:1}]));await p;
  const snapshot=host.textContent;
  p=x.load('refresh');assert.equal(host.textContent,snapshot);assert.equal(host.attributes['aria-busy'],'true');
  x.requests[1].resolve(null);await p;
  assert.equal(host.textContent,snapshot);assert.equal(host.attributes['aria-busy'],'false');
  assert.match(x.node('boff'+prefix+'Status').textContent,/предыдущие данные/);
  assert.equal(x.renders.length,1);
});
test('refresh preserves all pages revealed with Show more and skips overlapping polls',async()=>{
  const x=setup();let p=x.load();x.requests[0].resolve(x.data(Array.from({length:5},(_,id)=>({id})),true));await p;
  p=x.load(false);assert.match(x.requests[1].url,/offset=5/);x.requests[1].resolve(x.data([{id:5},{id:6}],false));await p;
  p=x.load('refresh');await x.load('refresh');assert.equal(x.requests.length,3);assert.match(x.requests[2].url,/limit=7&offset=0/);
  x.requests[2].resolve(x.data(Array.from({length:7},(_,id)=>({id}))));await p;
  assert.equal(x.renders.at(-1).length,7);
});
test('a late request cannot replace a newer product filter and polling waits for a pending filter',async()=>{
  const x=setup(), first=x.load();
  x.node('boffIssuesFilter').value='swap';await x.load('refresh');assert.equal(x.requests.length,1);
  const second=x.load();assert.match(x.requests[1].url,/product=swap/);
  x.requests[1].resolve(x.data([{id:2,product:'swap'}]));await second;
  x.requests[0].resolve(x.data([{id:1,product:'system'}]));await first;
  assert.equal(x.renders.length,1);assert.equal(x.renders[0][0].product,'swap');
});
test('refresh respects the API page limit while keeping a large visible history',async()=>{
  const x=setup();x.ctx.__boffActivity.issues={rows:Array.from({length:105},(_,id)=>({id})),request:0,query:'',loading:false};
  const p=x.load('refresh');assert.match(x.requests[0].url,/limit=100&offset=0/);
  x.requests[0].resolve(x.data(Array.from({length:100},(_,id)=>({id})),true));await new Promise(resolve=>setImmediate(resolve));
  assert.match(x.requests[1].url,/limit=5&offset=100/);assert.equal(x.renders.length,0);
  x.requests[1].resolve(x.data(Array.from({length:5},(_,id)=>({id:id+100}))));await p;
  assert.equal(x.renders[0].length,105);
});
test('expired admin access invalidates in-flight data and clears the displayed snapshot',async()=>{
  const x=setup(), first=x.load();x.ctx.checkAdminAccessFromJwt=()=>false;await x.load();
  x.requests[0].resolve(x.data([{id:1}]));await first;
  assert.equal(x.renders.length,0);assert.match(x.node('boffIssuesList').textContent,/Нужен вход/);
});
test('server health checks do not acquire empty trade fields from the product category',()=>{
  assert.equal(tradeFacts({product:'xstocks',action:'health_xstocks',detail:{source:'health_pulse'}}),null);
  assert.notEqual(tradeFacts({product:'xstocks',action:'buy_failed',detail:{from:'USDC',to:'AAPLx'}}),null);
});
