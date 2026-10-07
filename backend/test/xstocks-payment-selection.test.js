import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const wallet = readFileSync(new URL('../../frontend/public/grom-wallet.js',import.meta.url),'utf8');
const html = readFileSync(new URL('../../frontend/public/index.html',import.meta.url),'utf8');
const owner='0x'+'1'.repeat(40);
const funded={namespace:'evm',account:owner,sym:'USDC',amt:18.4,chainId:42161,chain:'Arbitrum'};
function fn(source,name){const start=source.indexOf('function '+name+'(');assert.ok(start>=0,name);return (source.slice(start-6,start)==='async '?'async ':'')+source.slice(start,source.indexOf('\n}',start)+2);}
function quoteHarness(){
  const calls=[];
  const ctx=vm.createContext({window:{},Number,Promise,gwReadOnlyAddress:()=>owner,gwXstocksSolPayAccount:()=>'',gwXstocksSolDest:()=> 'saved-destination',gwIsSolAddr:a=>a==='sol-destination',
    gwXstocksEnrichUsd:q=>q,gwXstocksPickBestQuote:list=>list.filter(Boolean).sort((a,b)=>b.score-a.score)[0]||null,
    gwXstocksQuoteEvmOnChain:async q=>{calls.push(['evm',q]);return {venue:'evm',_execChainId:q.chainId,_fromSym:q.fromSym,score:1};},
    gwXstocksQuoteLifiToSol:async q=>{calls.push(['bridge',q]);return {venue:'bridge-sol',_bridgeChainId:q.chainId,_fromSym:q.fromSym,score:2};},
    gwXstocksQuoteSolana:async q=>{calls.push(['solana',q]);return {venue:'solana',_solInMint:q.fromSym,score:5};},
  });
  vm.runInContext(fn(wallet,'gwXstocksQuoteForPayment')+'\n'+fn(wallet,'gwXstocksSamePaymentRoute'),ctx);
  return {ctx,calls};
}
const request={payment:funded,receiveAddress:'sol-destination',toSym:'AAPLX',amtNum:6,chainId:1,address:'eth-token',addrsByChain:{42161:'arb-token'},solMint:'stock-mint',refPrice:300};
test('funded Arbitrum USDC quotes only that source and can reach Solana without a Phantom payment',async()=>{
 const {ctx,calls}=quoteHarness();const q=await ctx.gwXstocksQuoteForPayment(request);
 assert.equal(q.venue,'bridge-sol');assert.equal(q._solDest,'sol-destination');assert.equal(q._payment.sym,'USDC');
 assert.deepEqual(calls.map(c=>c[0]),['evm','bridge']);
 for(const [,c] of calls){assert.equal(c.chainId,42161);assert.equal(c.fromSym,'USDC');assert.equal(c.account,owner);}
});
test('payment selection rejects stale wallet, missing/insufficient balance and nonfinite input',async()=>{
 const {ctx,calls}=quoteHarness();
 for(const overrides of [{amtNum:20},{amtNum:Infinity},{payment:{...funded,account:'other'}},{payment:{...funded,amt:NaN}},{payment:{...funded,amt:null}},{payment:{...funded,sym:'ETH'}}]){
  assert.equal(await ctx.gwXstocksQuoteForPayment({...request,...overrides}),null);
 }
 assert.equal(calls.length,0);
});
test('Solana payment requires the connected source wallet, not a pasted receive address',async()=>{
 const {ctx,calls}=quoteHarness();const r={...request,payment:{...funded,namespace:'solana',account:'sol-source',chainId:'solana'}};
 assert.equal(await ctx.gwXstocksQuoteForPayment(r),null);assert.equal(calls.length,0);
 ctx.gwXstocksSolPayAccount=()=> 'sol-source';assert.equal((await ctx.gwXstocksQuoteForPayment(r)).venue,'solana');assert.deepEqual(calls.map(c=>c[0]),['solana']);
});
test('execution requires the displayed source, venue, network and destination to survive refresh',()=>{
 const {ctx}=quoteHarness();const q={venue:'bridge-sol',_bridgeChainId:42161,_fromSym:'USDC',_solDest:'sol-a',_payment:funded};
 assert.equal(ctx.gwXstocksSamePaymentRoute(q,{...q}),true);
 for(const changed of [{venue:'solana'},{_bridgeChainId:1},{_fromSym:'USDT'},{_solDest:'sol-b'},{_payment:{...funded,account:'other'}}])assert.equal(ctx.gwXstocksSamePaymentRoute(q,{...q,...changed}),false);
 assert.equal(ctx.gwXstocksSamePaymentRoute(q,null),false);
});
test('cleared or invalid receive address never falls back to a saved bridge recipient',async()=>{
 for(const receiveAddress of ['',undefined,'invalid']){
  const {ctx,calls}=quoteHarness();const q=await ctx.gwXstocksQuoteForPayment({...request,receiveAddress});
  assert.equal(q.venue,'evm');assert.deepEqual(calls.map(c=>c[0]),['evm']);
 }
});
test('Solana payment account comes from the provider, not the saved receive address',()=>{
 const ctx=vm.createContext({window:{solana:{publicKey:{toString:()=> 'connected-source'}}},gwSolPubkey:()=> 'pasted-recipient'});
 vm.runInContext(fn(wallet,'gwXstocksSolPayAccount'),ctx);
 assert.equal(ctx.gwXstocksSolPayAccount(),'connected-source');
 ctx.window.solana={};assert.equal(ctx.gwXstocksSolPayAccount(),'');
});
function uiHarness(infoAsync){
 const timers=new Map();let timerId=0,overlay;const requests=[],submitted=[];
 const element=()=>({value:'',textContent:'',innerHTML:'',disabled:false,hidden:false,isConnected:true,dataset:{},children:[],events:{},
  classList:{add(){},remove(){}},addEventListener(k,cb){this.events[k]=cb;},setAttribute(){},removeAttribute(){},focus(){},
  appendChild(c){this.children.push(c);if(this.children.length===1)this.value=c.value;},replaceChildren(){this.children=[];this.value='';}});
 const ids=Object.fromEntries(['#gtmAmt','#gtmInfo','.gtm-confirm','#gtmPayment','#gtmPayUnit','#gtmStockBal','.gtm-x','.gtm-cancel'].map(k=>[k,element()]));
 const max=element();max.dataset.a='max';
 const ctx=vm.createContext({window:{},document:{body:{appendChild(e){overlay=e;}},createElement(){const e=element();e.querySelector=k=>ids[k]||null;e.querySelectorAll=k=>k==='.gtm-presets button'?[max]:[];return e;}},
  injectCss(){},closeModal(){if(overlay)overlay.isConnected=false;},tx:(k,f)=>f,esc:x=>x,money:x=>String(x),gwxConnected:()=>true,gwxUsdtBal:1.99,
  notify(){},setTimeout(cb,ms){timers.set(++timerId,{cb,ms});return timerId;},clearTimeout(id){timers.delete(id);},
  refreshUsdtBalChip:async()=>({rows:[funded,{...funded,sym:'USDT',amt:1.99,chain:'Polygon',chainId:137}]}),
 });
 const start=html.indexOf('  function openStockModal(opts)');vm.runInContext(html.slice(start,html.indexOf('\n  function injectCss()',start)),ctx);
 ctx.openStockModal({side:'buy',unit:'USDT',title:'Buy',confirmLabel:'Buy',infoAsync:async(v,p)=>{requests.push({v,p});return infoAsync?infoAsync(v,p):{quote:{_payment:p},html:'quote'};},onConfirm:async(v,q,p)=>submitted.push({v,q,p})});
 return {ids,max,requests,submitted,async settle(){await Promise.resolve();await Promise.resolve();},async input(v){ids['#gtmAmt'].value=v;ids['#gtmAmt'].events.input();},async quote(){const t=[...timers.values()].find(x=>x.ms===180);timers.clear();if(t)await t.cb();},ctx};
}
test('buy form pays from selected USDC balance and MAX never sums wallets or networks',async()=>{
 const h=uiHarness();await h.settle();assert.equal(h.ids['#gtmPayUnit'].textContent,'USDC');
 await h.input('6');await h.quote();assert.equal(h.ids['.gtm-confirm'].disabled,false);assert.equal(h.requests[0].p.sym,'USDC');
 await h.ids['.gtm-confirm'].onclick();assert.equal(h.submitted[0].p.chainId,42161);
 const j=uiHarness();await j.settle();j.max.events.click();await j.settle();assert.equal(j.ids['#gtmAmt'].value,'18.4');
 j.ids['#gtmPayment'].value='1';j.ids['#gtmPayment'].events.change();await j.settle();assert.equal(j.ids['.gtm-confirm'].disabled,true);assert.match(j.ids['#gtmInfo'].textContent,/Insufficient/);
});
test('clearing amount immediately disables an old quote and late responses cannot restore it',async()=>{
 let resolve;const h=uiHarness(()=>new Promise(r=>{resolve=r;}));await h.settle();await h.input('6');const pending=h.quote();await h.settle();
 await h.input('');assert.equal(h.ids['.gtm-confirm'].disabled,true);resolve({quote:{},html:'old quote'});await pending;assert.equal(h.ids['.gtm-confirm'].disabled,true);
 await h.quote();assert.equal(h.ids['.gtm-confirm'].disabled,true);assert.equal(h.submitted.length,0);
});
test('stock chart never fabricates a price path when historical data is unavailable',()=>{
 const start=html.indexOf('  function openStockModal(opts)');const source=html.slice(start,html.indexOf('\n  function injectCss()',start));
 assert.doesNotMatch(source,/Math\.sin|Fallback spark|pts\[27\]/);assert.match(source,/drawGtmChart\(\[\]\)/);assert.match(source,/if \(foot\) foot\.textContent = ''/);
});
