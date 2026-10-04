import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const source=readFileSync(new URL('../../frontend/public/grom-wallet.js',import.meta.url),'utf8');
function fn(name){const a=source.indexOf(`function ${name}(`);assert.ok(a>=0);return (source.slice(a-6,a)==='async '?'async ':'')+source.slice(a,source.indexOf('\n}',a)+2);}
const addr='0x'+'1'.repeat(40), other='0x'+'2'.repeat(40);
const chain={chainId:42161,meta:{label:'Arbitrum',native:'ETH'},data:{nativeEth:0.002,tokens:{USDC:20}}};
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
function setup(){
  const calls=[];const ctx=vm.createContext({console,Date,setTimeout,clearTimeout,Map,Set,Promise,
    __gwOcCardSnapshots:new Map(),__gwOcCardRenderId:0,
    gwOcFetchPrices:async()=>{calls.push('prices');return {ETH:2700};},
    gwOcFetchAllChains:async(a,publish)=>{calls.push(a);publish(chain);return [chain];},
    gwTronFetchAllBalances:async()=>{calls.push('tron');return [{sym:'USDT',amt:2}];},
    gwTkReadWithin:read=>read,
  });vm.runInContext(fn('gwOcCardSnapshotKey')+'\n'+fn('gwOcCardRead'),ctx);return {ctx,calls};
}
test('route re-entry reuses fresh account snapshot and does not repeat network reads',async()=>{
 const h=setup();await h.ctx.gwOcCardRead(addr,'',false).done;
 const read=h.ctx.gwOcCardRead(addr,'',false);assert.equal(read.entry.chains[0].data.tokens.USDC,20);await read.done;
 assert.deepEqual(h.calls,['prices',addr]);
});
test('parallel readers share one job; EVM paints before slow Tron or prices finish',async()=>{
 const h=setup(),prices=deferred(),tron=deferred(),evm=deferred();let publish;
 h.ctx.gwOcFetchPrices=()=>{h.calls.push('prices');return prices.promise;};
 h.ctx.gwTronFetchAllBalances=()=>{h.calls.push('tron');return tron.promise;};
 h.ctx.gwOcFetchAllChains=(a,callback)=>{h.calls.push(a);publish=callback;return evm.promise;};
 const seen=[];const first=h.ctx.gwOcCardRead(addr,'Ttest',false,s=>seen.push({known:s.known,n:s.chains.length}));
 const second=h.ctx.gwOcCardRead(addr,'Ttest',true);
 assert.equal(first.done,second.done);assert.deepEqual(h.calls,['prices',addr,'tron']);
 publish(chain);assert.deepEqual(seen.at(-1),{known:true,n:1});
 prices.resolve({ETH:2700});tron.resolve([]);evm.resolve([chain]);await first.done;first.unsubscribe();
 assert.equal(first.entry.loading,false);
});
test('timeouts retain known network amounts and report incomplete refresh',async()=>{
 const h=setup();await h.ctx.gwOcCardRead(addr,'Ttest',false).done;
 h.ctx.gwOcFetchAllChains=async(a,publish)=>{publish({...chain,data:null});return [];};
 h.ctx.gwTronFetchAllBalances=async()=>{throw new Error('timeout');};
 const read=h.ctx.gwOcCardRead(addr,'Ttest',true);assert.equal(read.entry.chains[0].data.tokens.USDC,20);await read.done;
 assert.equal(read.entry.chains[0].data.tokens.USDC,20);assert.equal(read.entry.tRows[0].amt,2);assert.equal(read.entry.incomplete,true);
});
test('another wallet has isolated data, including late responses from previous account',async()=>{
 const h=setup(),slow=deferred();let publishOld;
 h.ctx.gwOcFetchAllChains=(a,publish)=>{if(a===addr){publishOld=publish;return slow.promise;} publish({...chain,data:{nativeEth:0,tokens:{USDC:5}}});return Promise.resolve([]);};
 const old=h.ctx.gwOcCardRead(addr,'',false),current=h.ctx.gwOcCardRead(other,'',false);await current.done;
 publishOld(chain);slow.resolve([]);await old.done;
 assert.equal(current.entry.chains[0].data.tokens.USDC,5);assert.equal(old.entry.chains[0].data.tokens.USDC,20);
});
test('renderer never blanks known same-account amounts during refresh and ignores old wallet responses',async()=>{
 const h=setup();let owner=addr,callback,resolve;const done=new Promise(yes=>resolve=yes);let html='known $20.00';const writes=[];
 const card={dataset:{gwAccount:addr+'|'},querySelector:()=>({}),appendChild(){},get innerHTML(){return html;},set innerHTML(value){html=value;writes.push(value);}};
 Object.assign(h.ctx,{gwOcConnectedAddress:()=>owner,gwTronSavedAddr:()=>'',gwInjectOnchainCardCss(){},gwOcT:key=>key,
 document:{getElementById:id=>id==='page-wallet'?{}:id==='gwOnchainCard'?card:null},
 gwOcCardRead:(a,t,f,p)=>{callback=p;p({known:false,loading:true});return {done,unsubscribe(){}};},gwRefreshCombinedPortfolioTotals:async()=>{},
 });vm.runInContext(fn('gwRenderOnchainCard'),h.ctx);
 const pending=h.ctx.gwRenderOnchainCard({force:true});assert.equal(html,'known $20.00');assert.equal(writes.length,0);
 owner=other;callback({known:false,loading:false});assert.equal(writes.length,0);resolve();await pending;
});
test('empty successful Tron balance is cached; concurrent requests do not repeat proxy reads',async()=>{
 const h=setup();let requests=0;Object.assign(h.ctx,{AbortController,__gwTronBalCache:new Map(),__gwTronBalInflight:new Map(),GW_TRON_TOKENS:{USDT:'token'},GW_TRON_DECIMALS:{USDT:6},GW_TRON_CHAIN_ID:728126428,
 fetch:async()=>{requests++;return {ok:true,json:async()=>({data:[{balance:0,trc20:[]}]})};}});
 vm.runInContext(fn('gwTronReadAllBalances')+'\n'+fn('gwTronFetchAllBalances'),h.ctx);
 await Promise.all([h.ctx.gwTronFetchAllBalances('Ttest'),h.ctx.gwTronFetchAllBalances('Ttest')]);const first=requests;
 await h.ctx.gwTronFetchAllBalances('Ttest');assert.equal(requests,first);assert.equal(first,2);
});
