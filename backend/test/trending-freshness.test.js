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
test('network requests coalesce, refresh changes the price, and stale data expires', async () => {
  let now=1800000000000,calls=0,fail=false,change='10';
  const service=createTrendingService({nets,now:()=>now,pause:async()=>{},get:async()=>{calls++;if(fail)throw Error('offline');return {data:payload(change)};}});
  const [a,b]=await Promise.all([service('bsc'),service('bsc')]);
  assert.equal(calls,1);assert.equal(a.updatedAt,b.updatedAt);
  now+=91000;change='-93.858';
  const c=await service('bsc');assert.equal(c.rows[0].change24h,-93.858);assert.equal(c.stale,false);
  const fetched=c.updatedAt;fail=true;now+=91000;
  const d=await service('bsc');assert.equal(d.stale,true);assert.equal(d.updatedAt,fetched);
  now+=600000;await assert.rejects(service('bsc'),/offline/);
});
test('the all-networks cache never renews the timestamp of stale underlying quotes', async () => {
  let now=1800000000000,fail=false;
  const service=createTrendingService({nets,now:()=>now,pause:async()=>{},get:async()=>{if(fail)throw Error('offline');return {data:payload()};}});
  const a=await service('all');fail=true;now+=91000;
  const b=await service('all');assert.equal(b.updatedAt,a.updatedAt);assert.equal(b.stale,true);
  now+=600000;await assert.rejects(service('all'),/unavailable/);
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
