import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../../frontend/public/grom-wallet.js', import.meta.url), 'utf8');
const A='0x'+'a'.repeat(40), B='0x'+'b'.repeat(40);
function block(start,end) { const a=source.indexOf(start); return source.slice(a,source.indexOf(end,a)); }
const defer=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const tick=()=>new Promise(r=>setImmediate(r));
function harness() {
 const c={window:{__gwTkHoldingsCache:{at:0,rows:[]}},localStorage:{getItem:()=>''},console,
 setTimeout:(fn,ms)=>setTimeout(fn,ms>=2000?60:ms),clearTimeout,
 gwDisplayAddress:()=>c.owner,gwTronSavedAddr:()=>c.tron,gwSolPubkey:()=>c.sol,
 __gwQuotesMem:{data:{crypto:{ETH:2000}}},GW_DS_ASSETS:[],GW_OC_CHAIN_META:{1:{native:'ETH',label:'Ethereum'},42161:{native:'ETH',label:'Arbitrum'}},
 GW_TRON_CHAIN_ID:728126428,GW_LIFI_SOL_CHAIN:1151111081099710,
 gwOcFetchPrices:async()=>({ETH:2000,USDC:1}),gwTronMaybeAutolink:()=>{throw new Error('must not request accounts');}};
 c.owner=A;c.tron='';c.sol='';c.calls=[];
 c.window.gromFetchOnchainBalances=async(a,id)=>{c.calls.push([a,id]);return {nativeEth:0,tokens:{USDC:id===1?5:7}};};
 vm.createContext(c);
 vm.runInContext(block('async function gwOcFetchAllChains(', '\nfunction gwInjectOnchainCardCss'),c);
 vm.runInContext(block('function gwTkReadWithin(', '\nfunction gwTkGetFromContext'),c);
 return c;
}
test('fast network publishes balances before a slow network and price service',async()=>{
 const c=harness(),slow=defer(),price=defer(),seen=[];
 c.gwOcFetchPrices=()=>price.promise;
 c.window.gromFetchOnchainBalances=async(a,id)=>id===1?{nativeEth:0,tokens:{USDC:5}}:slow.promise;
 const work=c.gwTkLoadHoldings(false,(rows,status)=>seen.push({rows:[...rows],...status}));
 await tick();
 assert(seen.some(s=>s.loading&&s.rows.some(r=>r.sym==='USDC'&&r.amt===5)));
 const rows=await work;assert.equal(rows.length,1);assert.equal(c.window.__gwTkHoldingsCache.incomplete,true);
 slow.resolve({nativeEth:100,tokens:{}});price.resolve({ETH:1});await tick();
 assert.equal(c.window.__gwTkHoldingsCache.rows.length,1,'late timed-out response cannot paint or cache');
});
test('balances start without waiting for prices and native USD stays pending',async()=>{
 const c=harness(),p=defer();c.__gwQuotesMem={data:null};c.gwOcFetchPrices=()=>p.promise;
 c.window.gromFetchOnchainBalances=async()=>({nativeEth:1,tokens:{}});
 const seen=[];const work=c.gwTkLoadHoldings(false,rows=>seen.push([...rows]));await tick();
 assert(seen.some(rows=>rows.some(r=>r.pricePending&&r.amt===1)));
 await work;
});
test('concurrent consumers and forced refresh share the same balance requests',async()=>{
 const c=harness(),d=defer();
 c.window.gromFetchOnchainBalances=async(a,id)=>{c.calls.push([a,id]);return d.promise;};
 const a=c.gwTkLoadHoldings(false),b=c.gwTkLoadHoldings(true);
 assert.equal(c.calls.length,2);d.resolve({nativeEth:0,tokens:{USDC:5}});await Promise.all([a,b]);
 assert.equal(c.window.__gwTkHoldingsInflight.size,0);
});
test('same-account cached rows display immediately while refresh runs',async()=>{
 const c=harness(),d=defer(),old={sym:'USDC',amt:9,usd:9,chainId:1};
 Object.assign(c.window.__gwTkHoldingsCache,{ownerKey:A+'||',rows:[old],at:1});
 c.window.gromFetchOnchainBalances=()=>d.promise;
 const seen=[];const work=c.gwTkLoadHoldings(false,rows=>seen.push([...rows]));
 assert.equal(seen[0][0].amt,9);await tick();assert.equal(c.window.__gwTkHoldingsCache.rows[0].amt,9);
 d.resolve({nativeEth:0,tokens:{USDC:5}});await work;
});
test('account change never displays another owner cache or overwrites new results',async()=>{
 const c=harness(),old=defer();c.window.gromFetchOnchainBalances=(a)=>a===A?old.promise:Promise.resolve({nativeEth:0,tokens:{USDC:2}});
 const first=c.gwTkLoadHoldings(false);c.owner=B;
 const seen=[];await c.gwTkLoadHoldings(false,r=>seen.push([...r]));
 old.resolve({nativeEth:0,tokens:{USDC:999}});assert.equal((await first).length,0);
 assert.equal(c.window.__gwTkHoldingsCache.ownerKey,B+'||');assert(seen.every(rows=>rows.every(r=>r.amt!==999)));
});
test('read errors do not return previous wallet balances',async()=>{
 const c=harness();Object.assign(c.window.__gwTkHoldingsCache,{ownerKey:B+'||',rows:[{amt:999}],at:1});
 c.window.gromFetchOnchainBalances=()=>Promise.reject(new Error('offline'));
 assert.equal((await c.gwTkLoadHoldings(false)).length,0);assert.equal(c.window.__gwTkHoldingsCache.incomplete,true);
});
test('empty wallet is cached and reopened without duplicate scans',async()=>{
 const c=harness();c.window.gromFetchOnchainBalances=async(a,id)=>{c.calls.push([a,id]);return {nativeEth:0,tokens:{}};};
 await c.gwTkLoadHoldings(false);await c.gwTkLoadHoldings(false);assert.equal(c.calls.length,2);
});
test('asset loading never invokes Tron account connection',async()=>{
 const c=harness();await c.gwTkLoadHoldings(false);assert.equal(c.calls.length,2);
});
test('known Tron and Solana balances publish independently of slow EVM',async()=>{
 const c=harness(),d=defer();c.tron='Tknown';c.sol='Sknown';
 c.window.gromFetchOnchainBalances=()=>d.promise;c.gwTronFetchAllBalances=async()=>[{sym:'USDT',amt:3}];c.gwSolAvailableAmount=async sym=>sym==='USDC'?4:0;
 const seen=[];const work=c.gwTkLoadHoldings(false,r=>seen.push([...r]));await tick();
 assert(seen.some(rows=>rows.some(r=>r.chain==='TRON')));assert(seen.some(rows=>rows.some(r=>r.chain==='Solana')));
 await work;
});
test('partial RPC data remains usable but is marked incomplete',async()=>{
 const c=harness();c.window.gromFetchOnchainBalances=async()=>({nativeEth:null,tokens:{USDC:5},incomplete:true});
 const rows=await c.gwTkLoadHoldings(false);assert.equal(rows.length,2);assert.equal(c.window.__gwTkHoldingsCache.incomplete,true);
});
function rpcHarness() {
 const c={window:{},currentChainId:1,ONCHAIN_RPC:{1:'rpc'},ONCHAIN_TOKENS:{1:{USDC:'usdc',USDT:'usdt'}},gwTokenDecimals:()=>6,padAddressData:a=>a};
 vm.createContext(c);vm.runInContext(block('window.gromFetchOnchainBalances = async','\n/* ----- Wallet connect router'),c);return c;
}
test('native and token RPC reads start together, not sequentially',async()=>{
 const c=rpcHarness(),d=defer(),calls=[];c.gwRpcTry=async(id,method,params)=>{calls.push([method,params]);return d.promise;};
 const work=c.window.gromFetchOnchainBalances(A,1);assert.equal(calls.length,3);
 d.resolve('0x0');const r=await work;assert.equal(r.nativeEth,0);assert.equal(r.incomplete,false);
});
test('failed native balance is unknown and partial results are not cached as zero',async()=>{
 const c=rpcHarness();c.gwRpcTry=async(id,method)=>{if(method==='eth_getBalance')throw new Error('offline');return '0x4c4b40';};
 const r=await c.window.gromFetchOnchainBalances(A,1);assert.equal(r.nativeEth,null);assert.equal(r.tokens.USDC,5);assert.equal(r.incomplete,true);assert.equal(Object.keys(c.window.__gwOcBalCache).length,0);
});
test('malformed token RPC response is not treated as verified zero',async()=>{
 const c=rpcHarness();c.gwRpcTry=async(id,method)=>method==='eth_getBalance'?'0x0':undefined;
 const r=await c.window.gromFetchOnchainBalances(A,1);assert.equal(r.tokens.USDC,undefined);assert.equal(r.incomplete,true);
});
