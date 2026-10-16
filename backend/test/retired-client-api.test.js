import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const src=readFileSync(new URL('../../frontend/public/index.html',import.meta.url),'utf8');
const part=(a,b)=>src.slice(src.indexOf(a),src.indexOf(b,src.indexOf(a)));
const forbidden=()=>{throw new Error('unexpected remote request or signature');};
function node(){return {value:'',dataset:{},innerHTML:'',classList:{add(){},remove(){},contains(){return false},toggle(){}},querySelectorAll:()=>[],addEventListener(){}};}
test('profile is local, can be cleared, and storage failures cannot report success',async()=>{
 const saved=new Map(),toasts=[],name=node();name.value=' Alice ';
 const c=vm.createContext({document:{getElementById:()=>name},localStorage:{setItem:(k,v)=>saved.set(k,v)},toast:(...a)=>toasts.push(a),fetch:forbidden,gput:forbidden,gget:forbidden,window:{gromApiFetch:forbidden}});
 vm.runInContext(part('async function saveSettings() {','(function wireSettings() {'),c);
 await c.saveSettings();assert.equal(saved.get('grom_set_name'),'Alice');assert.equal(toasts.at(-1)[1],'success');
 name.value='';await c.saveSettings();assert.equal(saved.get('grom_set_name'),'');
 c.localStorage.setItem=()=>{throw Error('storage blocked')};await c.saveSettings();assert.equal(toasts.at(-1)[1],'error');
});
test('bell opens without auth/API and still shows and marks a current-page notice read',async()=>{
 const nodes=new Map();const el=id=>{if(!nodes.has(id))nodes.set(id,node());return nodes.get(id)};
 const window={t:k=>k,addEventListener(){},gwEnsureSignedIn:forbidden,gwOpenSignIn:forbidden,gromApiFetch:forbidden};
 const c=vm.createContext({window,document:{getElementById:el,addEventListener(){}},localStorage:{getItem:()=>null},fetch:forbidden,toast(){}});
 vm.runInContext(part('(function gromNotifBoot() {','/* Wallet / Connect */'),c);
 window.gromNotif.open();assert.match(el('notifList').innerHTML,/No notifications yet/);assert.doesNotMatch(el('notifList').innerHTML,/notifSignIn|notifConnect/);
 window.gromNotif.ingest({id:'qa',title:'QA notice',body:'page-only'});assert.match(el('notifList').innerHTML,/unread/);
 window.gromNotif.open();assert.doesNotMatch(el('notifList').innerHTML,/ unread/);await window.gromNotif.refresh();
});
test('public API helper does not create a dev session and preserves existing signed JWT',async()=>{
 const code=part('  function isGromJwt(token) {','  async function apiFetch(path, options) {');
 const c=vm.createContext({localStorage:{getItem:()=>null},fetch:forbidden});vm.runInContext(code,c);
 assert.equal(await c.ensureApiToken(),'');c.localStorage.getItem=()=> 'header.payload.signature';assert.equal(await c.ensureApiToken(),'header.payload.signature');
});
test('Trade refresh/close still delegate to Hyperliquid, with no retired CEX fallback',async()=>{
 const calls=[];const window={__gromFuturesState:{},__gromHlActive:true,gromApiFetch:forbidden,gromHL:{syncDeskState:async()=>calls.push('sync'),closePosition:async coin=>calls.push(coin)}};
 const c=vm.createContext({window,confirm:()=>true,toast(){}});
 vm.runInContext(part('async function loadFuturesOverview() {','var __futOverviewDebounce'),c);
 vm.runInContext(part('window.closeFuturesPos = async function','// Tab switching for the futures table'),c);
 await c.loadFuturesOverview();await window.closeFuturesPos('hl_BTC');assert.deepEqual(calls,['sync','BTC','sync']);
 window.__gromHlActive=false;await c.loadFuturesOverview();await window.closeFuturesPos('old-position');assert.equal(calls.length,3);
});
test('all inline executable scripts remain syntactically valid',()=>{
 let count=0;
 for(const m of src.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){
  if(/\bsrc\s*=|application\/ld\+json|type\s*=\s*["']module/.test(m[1]))continue;
  new vm.Script(m[2],{filename:'inline-'+(++count)});
 }
 assert.ok(count>5);
});
test('retired request paths and nonexistent Settings handler cannot ship again',()=>{
 assert.doesNotMatch(src,/\/auth\/dev-login|\/api\/(?:settings|notifications|sessions|support\/tickets|stream\/sse|__removed_spot)\b|\/api\/futures\/(?:overview|funding|liquidations|orders|positions)\b|loadApiKeys\(/);
 const server=readFileSync(new URL('../src/server.js',import.meta.url),'utf8');assert.doesNotMatch(server,/app\.put\('\/api\/settings'/);
 const admin=readFileSync(new URL('../src/admin/routes.js',import.meta.url),'utf8');assert.match(admin,/r\.put\('\/settings\/risk'/);
});
test('Trade order dispatch still reaches HL with unchanged fields; unavailable HL never submits elsewhere',async()=>{
 const calls=[],messages=[],page={dataset:{hlUsd:'10000',arbUsd:'0'}};
 const window={__gromHlActive:true,futDeskState:{tradeMode:'perp'},gromHL:{placeOrder:async x=>{calls.push(x);return {coin:'BTC',leverage:3}},syncDeskState:async()=>{}},gromApiFetch:forbidden};
 const c=vm.createContext({window,document:{getElementById:id=>id==='page-futures'?page:{value:id==='futSizeInput'?'0.01':'100000'},querySelector:()=>null},futDeskState:{pair:'BTC/USDC',leverage:3},parseNumberInput:Number,toast:(...x)=>messages.push(x),gpost:forbidden});
 vm.runInContext(part('window.submitFuturesOrder = async function','window.refreshHlFuturesBoard = async function'),c);
 await window.submitFuturesOrder('buy');assert.equal(calls.length,1);assert.equal(calls[0].pair,'BTC/USDC');assert.equal(calls[0].size,0.01);assert.equal(calls[0].leverage,3);assert.equal(calls[0].type,'market');
 window.__gromHlActive=false;await window.submitFuturesOrder('sell');assert.equal(calls.length,1);assert.match(messages.at(-1)[0],/no order was placed/);
});
