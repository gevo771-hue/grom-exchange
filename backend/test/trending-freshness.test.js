import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { createTrendingService, parseGtNetwork } from '../src/market/trending.js';
const nets = [{ key:'all' }, { key:'bsc', gt:'bsc', chainId:56, label:'BSC' }];
function payload(change = '1393272.585') {
  return { data:[{ attributes:{ address:'pool', base_token_price_usd:'0.015', price_change_percentage:{h24:change}, pool_created_at:'2026-10-22T16:35:53Z', volume_usd:{h24:'1000'} }, relationships:{base_token:{data:{id:'token'}}} }], included:[{id:'token',attributes:{symbol:'BSC',name:'Binance Super CZ',address:'0xtoken',decimals:18}}] };
}
test('provider percentage is already percent; missing is unknown, not zero', () => {
  const row = parseGtNetwork('bsc',payload(),56,'BSC')[0];
  assert.equal(row.change24h,1393272.585);
  assert.equal(row.poolAddress,'pool');
  assert.equal(row.poolCreatedAt,'2026-10-22T16:35:53Z');
  for (const invalid of [null,'','bad']) assert.equal(parseGtNetwork('bsc',payload(invalid),56,'BSC')[0].change24h,null);
  const missing=payload();delete missing.data[0].attributes.price_change_percentage.h24;
  assert.equal(parseGtNetwork('bsc',missing,56,'BSC')[0].change24h,null);
  assert.equal(parseGtNetwork('bsc',payload('0'),56,'BSC')[0].change24h,0);
});
const tick = () => new Promise((resolve) => setImmediate(resolve));
test('network requests coalesce; revalidation does not delay cached rows or renew their age', async () => {
  let now=1800000000000,calls=0,fail=false,change='10';
  const service=createTrendingService({nets,now:()=>now,pause:async()=>{},get:async()=>{calls++;if(fail)throw Error('offline');return {data:payload(change)};}});
  const [a,b]=await Promise.all([service('bsc'),service('bsc')]);
  assert.equal(calls,1);assert.equal(a.updatedAt,b.updatedAt);
  now+=91000;change='-93.858';
  const cached=await service('bsc');assert.equal(cached.rows[0].change24h,10);assert.equal(cached.refreshing,true);
  await tick();
  const c=await service('bsc');assert.equal(c.rows[0].change24h,-93.858);assert.equal(c.stale,false);
  const fetched=c.updatedAt;fail=true;now+=91000;
  const d=await service('bsc');assert.equal(d.stale,true);assert.equal(d.updatedAt,fetched);
  await tick();
  now+=600000;await assert.rejects(service('bsc'),/unavailable/);
});
test('all-networks reads never renew stale provider timestamps', async () => {
  let now=1800000000000,fail=false;
  const service=createTrendingService({nets,now:()=>now,pause:async()=>{},get:async()=>{if(fail)throw Error('offline');return {data:payload()};}});
  const a=await service('all');fail=true;now+=91000;
  const b=await service('all');assert.equal(b.updatedAt,a.updatedAt);assert.equal(b.stale,true);
  await tick();
  now+=600000;await assert.rejects(service('all'),/unavailable/);
});
test('a stalled first network cannot block All or another network; partial results fill in', async () => {
  const mixed=[{key:'all'},{key:'eth',gt:'eth',chainId:1,label:'ETH'},nets[1]];
  let finishSlow,calls=0;
  const service=createTrendingService({nets:mixed,pause:async()=>{},get:async(url)=>{
    calls++;
    if(url.includes('/eth/'))return new Promise(resolve=>{finishSlow=()=>resolve({data:payload('20')});});
    return {data:payload('10')};
  }});
  const first=await service('all');
  assert.equal(first.partial,true);assert.equal(first.refreshing,true);
  assert.deepEqual(first.rows.map(r=>r.chainId),[56]);
  assert.equal((await service('bsc')).rows[0].chainId,56);
  finishSlow();await tick();
  const complete=await service('all');
  assert.equal(complete.partial,false);assert.equal(complete.refreshing,false);
  assert.deepEqual(complete.rows.map(r=>r.chainId),[1,56]);assert.equal(calls,2);
});
test('failed networks respect Retry-After, coalesce failures and recover without empty-cache poisoning', async()=>{
  let now=1800000000000,calls=0,fail=true;
  const service=createTrendingService({nets,now:()=>now,pause:async()=>{},get:async()=>{
    calls++;if(fail)throw Object.assign(Error('rate limit'),{response:{status:429,headers:{'retry-after':'120'}}});
    return {data:payload()};
  }});
  await Promise.all([assert.rejects(service('bsc')),assert.rejects(service('all'))]);
  assert.equal(calls,1);
  now+=61000;await assert.rejects(service('bsc'));assert.equal(calls,1);
  now+=60000;fail=false;assert.equal((await service('bsc')).rows.length,1);assert.equal(calls,2);
});
test('empty provider refresh preserves the last quote until expiry',async()=>{
  let now=1800000000000,empty=false;
  const service=createTrendingService({nets,now:()=>now,pause:async()=>{},get:async()=>({data:empty?{data:[]}:payload()})});
  const first=await service('bsc');now+=91000;empty=true;
  await service('bsc');await tick();
  const stale=await service('bsc');assert.equal(stale.updatedAt,first.updatedAt);assert.equal(stale.rows.length,1);assert.equal(stale.refreshing,false);
  now+=600000;await assert.rejects(service('bsc'));
});
const source=readFileSync(new URL('../../frontend/public/grom-wallet.js',import.meta.url),'utf8');
function browserCache() {
  const ctx={window:{},Date,Map,Number,JSON,console,AbortSignal,localStorage:{getItem:()=>null,setItem(){}},fetch:null};
  vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('const GW_TR_CACHE_TTL'),source.indexOf('async function gwFetchTrending(netKey)')),ctx);return ctx;
}
test('stale browser cache awaits a shared fresh request so its caller repaints', async () => {
  const c=browserCache();const old={at:Date.now()-120000,rows:[{change24h:100,observedAt:Date.now()-120000}]};
  c.window.__gwTrMemCache=new Map([['bsc',old]]);
  let finish,calls=0;c.fetch=()=>{calls++;return new Promise(resolve=>{finish=resolve;});};
  const a=c.gwFetchTrendingNetwork({key:'bsc'}),b=c.gwFetchTrendingNetwork({key:'bsc'});
  assert.equal(calls,1);
  finish({ok:true,json:async()=>({updatedAt:Date.now(),rows:[{change24h:-90,observedAt:Date.now()}]})});
  assert.equal((await a)[0].change24h,-90);assert.equal((await b)[0].change24h,-90);
});
test('expired browser cache is not returned after a failed request', async () => {
  const c=browserCache();c.window.__gwTrMemCache=new Map([['bsc',{at:Date.now()-86400000,rows:[{change24h:100}]}]]);
  c.fetch=async()=>{throw Error('offline');};
  assert.equal((await c.gwFetchTrendingNetwork({key:'bsc'})).length,0);
});

test('missing or invalid pool price stays unavailable instead of zero dollars',()=>{
 for(const price of [null,undefined,'',0,'bad',-1,'Infinity']){const data=payload();data.data[0].attributes.base_token_price_usd=price;assert.equal(parseGtNetwork('bsc',data,56,'BSC')[0].priceUsd,null);}
});

test('browser rechecks a fresh partial response until remaining networks finish',async()=>{
  const c=browserCache();const at=Date.now();let calls=0;
  c.fetch=async()=>({ok:true,json:async()=>({updatedAt:at,refreshing:++calls===1,rows:[{change24h:calls,observedAt:at}]})});
  assert.equal((await c.gwFetchTrendingNetwork({key:'all'}))[0].change24h,1);
  assert.equal((await c.gwFetchTrendingNetwork({key:'all'}))[0].change24h,2);
  assert.equal((await c.gwFetchTrendingNetwork({key:'all'}))[0].change24h,2);
  assert.equal(calls,2);
});

test('a clicked network jumps ahead of background warming without bypassing pacing',async()=>{
  const many=[{key:'all'},...['eth','bsc','linea'].map((key,i)=>({key,gt:key,chainId:i+1,label:key}))];
  const starts=[],waits=[];let release;
  const service=createTrendingService({nets:many,pause:(ms)=>{waits.push(ms);return new Promise(resolve=>{release=resolve;});},get:async(url)=>{starts.push(url.match(/networks\/(.*?)\//)[1]);return {data:payload()};}});
  await service('all');
  const selected=service('linea');
  release();await selected;assert.deepEqual(starts,['eth','linea']);
  assert.ok(waits[0]>0 && waits[0]<=2100);
  release();await tick();assert.deepEqual(starts,['eth','linea','bsc']);
});

test('a provider rate limit also stops queued background network requests',async()=>{
  const two=[...nets,{key:'linea',gt:'linea',chainId:59144,label:'LINEA'}];let calls=0;
  const service=createTrendingService({nets:two,pause:async()=>{},get:async()=>{calls++;throw Object.assign(Error('limited'),{response:{status:429,headers:{'retry-after':'60'}}});}});
  await assert.rejects(service('all'));assert.equal(calls,1);
  await assert.rejects(service('linea'));assert.equal(calls,1);
});
