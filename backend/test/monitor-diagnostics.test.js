import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { classifyIssue } from '../src/activity/classify.js';
import { issueDiagnostics, healthView, trackProbe, createPulseController } from '../src/activity/diagnostics.js';
const now = Date.parse('2026-10-04T19:00:00Z');
const row = (action, detail = {}) => ({ product: 'swap', action, detail, created_at: new Date(now - 10000).toISOString() });
test('legacy timeout wording is corrected at read time; never blames user or settles funds', () => {
 const d = issueDiagnostics(row('wallet_no_confirm', { abandoned: true, ai_summary: 'Пользователь не подтвердил', kind: 'unknown' }), null, now);
 assert.equal(d.current_state, 'unknown'); assert.equal(d.evidence, 'dispatch_unverified');
 assert.match(d.ai_summary, /не установлены/); assert.equal(d.recovery.automatic_financial_actions, false);
});
test('dispatch timestamp proves client dispatch only, not delivery or approval', () => {
 const d = issueDiagnostics(row('tx_unknown', { walletRequestAt: now - 20000 }), null, now);
 assert.equal(d.evidence, 'request_dispatched'); assert.equal(d.current_state, 'unknown');
 assert.match(d.evidence_label, /Клиент зафиксировал/);
});
test('explicit wallet rejection wins over a timeout action', () => {
 assert.equal(classifyIssue({action:'wallet_no_confirm',code:4001}).cause,'user_rejected');
 assert.equal(issueDiagnostics(row('wallet_no_confirm',{code:4001})).current_state,'rejected');
});
test('fresh live check describes current health without deleting historical incident', () => {
 const e=row('health_xstocks',{source:'health_pulse',probe:'xstocks'});
 const snap={at:new Date(now).toISOString(),ok:true,checks:[{id:'xstocks',ok:true,verification:'live',observed_at:new Date(now).toISOString()}]};
 assert.equal(issueDiagnostics(e,snap,now).current_state,'passing_now');
 snap.checks[0].ok=false;assert.equal(issueDiagnostics(e,snap,now).current_state,'failing_now');
 snap.checks[0].verification='cached';assert.equal(issueDiagnostics(e,snap,now).current_state,'cached');
 snap.at=new Date(now-300000).toISOString();assert.equal(issueDiagnostics(e,snap,now).current_state,'stale');
});
test('stale pulse never reports healthy; future timestamps and absent snapshot also unknown', () => {
 for(const snapshot of [null,{at:new Date(now-300000).toISOString(),ok:true},{at:new Date(now+1000).toISOString(),ok:true}]) {
 assert.equal(healthView(snapshot,now).stale,true); assert.equal(healthView(snapshot,now).ok,null);
 }
});
test('failure streak and recovery only advance on live probes, not cached successes', () => {
 const one=trackProbe({ok:false},null,now),two=trackProbe({ok:false},one,now+1000);
 assert.equal(two.consecutive_failures,2);
 const cached=trackProbe({ok:true,verification:'cached',observed_at:new Date(now-1000).toISOString()},two,now+2000);
 assert.equal(cached.consecutive_failures,2);assert.equal(cached.recovered,false);
 const recovered=trackProbe({ok:true},cached,now+3000);
 assert.equal(recovered.recovered,true);assert.equal(recovered.consecutive_failures,0);
});
test('scheduled and manual probes coalesce; recheck forces fresh read with bounded cooldown', async () => {
 let time=0,calls=0,release,options;
 const c=createPulseController(o=>{calls++;options=o;return new Promise(yes=>{release=yes;});},{now:()=>time});
 assert.equal(c.recheck().accepted,true);const p=c.run();await Promise.resolve();
 assert.equal(c.recheck().accepted,false);assert.equal(calls,1);assert.equal(options.force,true);
 release({ok:true});await p;
 assert.equal(c.recheck().retry_after_ms,30000);time=30001;
 assert.equal(c.recheck().accepted,true);await Promise.resolve();release();await c.run();assert.equal(calls,2);
});
test('rejected probe clears singleflight so automatic subsequent checks can recover', async () => {
 let calls=0;const c=createPulseController(()=>{if(!calls++)throw new Error('offline');return {ok:true};});
 await assert.rejects(c.run(),/offline/);assert.equal(c.running,false);assert.deepEqual(await c.run(),{ok:true});
});
const wallet=readFileSync(new URL('../../frontend/public/grom-wallet.js',import.meta.url),'utf8');
function fn(source,name){const at=source.indexOf('function '+name+'(');return source.slice(at,source.indexOf('\n}',at)+2);}
test('runtime monitor captures first-party crashes but drops cancellations, third-party errors and arbitrary values',()=>{
 const ctx=vm.createContext({location:{origin:'https://grom.exchange'},document:{visibilityState:'visible'}});
 vm.runInContext(fn(wallet,'gromRuntimeIssue'),ctx);
 assert.equal(ctx.gromRuntimeIssue({reason:'secret value'},'unhandled_rejection'),null);
 assert.equal(ctx.gromRuntimeIssue({error:{name:'AbortError',message:'aborted'}},'runtime_error'),null);
 assert.equal(ctx.gromRuntimeIssue({error:{message:'denied',code:4001}},'runtime_error'),null);
 assert.equal(ctx.gromRuntimeIssue({error:{message:'crash'},filename:'https://extension.example/code.js'},'runtime_error'),null);
 const ev=ctx.gromRuntimeIssue({error:{message:'failure https://grom.exchange/api?token=secret Bearer secret'},filename:'https://grom.exchange/app.js?private=secret',lineno:5},'runtime_error');
 assert.equal(ev.detail.file,'https://grom.exchange/app.js');assert.doesNotMatch(ev.message,/secret/);assert.equal(ev.detail.line,5);
});
test('UI report safely escapes diagnostics and renders unknown results separately from severity',()=>{
 const html=readFileSync(new URL('../../frontend/public/index.html',import.meta.url),'utf8');
 const ctx=vm.createContext({boffFmtTime:x=>x,boffShortAddr:x=>x});
 vm.runInContext(fn(html,'boffMonitorEsc')+'\n'+fn(html,'boffIssueRowHtml'),ctx);
 const out=ctx.boffIssueRowHtml({at:'today',product_label:'<img src=x>',cause:'unknown',ai_summary:'<script>bad</script>',state_label:'Неизвестно',evidence_label:'Телеметрия',repeats_24h:2});
 assert.doesNotMatch(out,/<script|<img/);assert.match(out,/Неизвестно/);assert.match(out,/2 сообщ/);
});
test('actual health probes label caches, force fresh checks, and never turn HTTP 429 green', async()=>{
 const src=readFileSync(new URL('../src/activity/health-pulse.js',import.meta.url),'utf8');
 let requests=0,status=200;
 const ctx=vm.createContext({Date,Promise,process:{env:{}},axios:{post:async(url,body)=>{requests++;return {status,data:body.type==='allMids'?Object.fromEntries(Array.from({length:20},(_,i)=>[i,'1'])):[{universe:Array(30).fill({})}]};},get:async()=>{requests++;return {status,data:{items:Array(50).fill({solMint:'mint'})}};}}});
 vm.runInContext('const HL_API="https://api.hyperliquid.xyz";let lastHlOk=null,lastHipOk=null,lastXstocksOk=null;\n'+['timed','probeHyperliquid','probeHip3','probeXstocks'].map(name=>(name==='timed'?'':'async ')+fn(src,name)).join('\n'),ctx);
 for(const name of ['probeHyperliquid','probeHip3','probeXstocks']) {
 const live=await ctx[name]();assert.equal(live.ok,true);const before=requests;
 const cached=await ctx[name]();assert.equal(cached.verification,'cached');assert.equal(requests,before);
 status=429;const failure=await ctx[name](true);assert.equal(failure.ok,false);assert.equal(failure.severity,'warn');assert.ok(requests>before);
 status=200;
 }
});
