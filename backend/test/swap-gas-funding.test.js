import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const src=fs.readFileSync(new URL('../../frontend/public/grom-wallet.js',import.meta.url),'utf8');
const account='0x'+'a'.repeat(40),hash='0x'+'b'.repeat(64);
function harness(extra={}) {
 let now=0;
 const op={id:'main',from:'USDT',to:'ETH',amt:'2',chainId:8453,account,stage:'preparing'};
 const context={URLSearchParams,console:{warn(){}},Date:{now:()=>now},setTimeout:(fn,ms)=>{if(ms===6000)return 0;now+=ms;fn();},clearTimeout(){},
  localStorage:{getItem:()=> 'en'},document:{documentElement:{lang:'en'}},
  window:{__gwSwapOp:op},GW_OC_SWAP:{1:{},56:{},42161:{},8453:{},10:{},137:{},43114:{},59144:{}},
  gwDsPriceUsd:async sym=>({ETH:2500,BNB:500,POL:.25,AVAX:20}[sym]||1),
  gwDsTokenBalanceOnChain:async()=>0,gwRpcTry:async()=> '0x0',
  gwSwapSlippageFraction:()=>.005,gwChainLabel:c=>String(c),gwToast(){},
  gwAggCanExec:q=>q?.toAmount>0n,gwEnsureChain:async()=>{},
  gwSquidBridgeMonitor(a){a.onTerminal?.({outcome:'completed',success:true,destTxHash:'0x'+'f'.repeat(64)});},
  gwLifiBridgeMonitor(a){a.onTerminal?.({outcome:'completed',success:true,destTxHash:'0x'+'f'.repeat(64)});},gwEvmConfirmMonitor(){},
  gwSwapOpGet(){return context.window.__gwSwapOp;},gwSwapOpUpdate(patch){Object.assign(context.window.__gwSwapOp,patch);},
  gwSwapWalletActionPending:o=>!!(o.walletRequestPending||o.walletResultUnknown||o.approvalPending),
  gwResolveEvmToken:(_chain,sym)=>({isNative:['ETH','BNB','POL','AVAX'].includes(sym),address:['ETH','BNB','POL','AVAX'].includes(sym)?'0x'+'e'.repeat(40):'0x'+'c'.repeat(40),decimals:6}),
  gwDsReadSwapAmtStr:()=> '2',padAddressData:()=> '0x70a08231',
  ...extra};
 vm.createContext(context);
 const start=src.indexOf('/** Min native USD');
 const end=src.indexOf("try { window.gwEnsureGasTopUpBeforeSwap",start);
 vm.runInContext(src.slice(start,end),context);
 vm.runInContext(src.slice(src.indexOf('function gwChainGasSymbol('),src.indexOf('/** Min native USD')),context);
 return context;
}
function args(overrides={}) {return {chainId:8453,fromSym:'USDT',amtNum:'2',account,provider:{request:async()=>[account]},...overrides};}
function quote(overrides={}) {return {aggregator:'LiFi · Bridge',toAmount:500000000000000n,gasUsd:.1,_fromChainId:42161,_toChainId:8453,raw:{estimate:{toAmountMin:'400000000000000'}},...overrides};}
function native(balance){return '0x'+BigInt(Math.round(balance*1e18)).toString(16);}

test('fresh signing-account balance is required, with RPC failure distinct from zero',async()=>{
 let params;
 const c=harness({gwRpcTry:async(_chain,method,p)=>{params={method,p};return native(.001);}});
 assert.equal(await c.gwGasNativeBal(8453,account),.001);
 assert.equal(params.method,'eth_getBalance');assert.equal(params.p[0],account);
 c.gwRpcTry=async()=>{throw new Error('RPC unavailable');};
 await assert.rejects(c.gwGasNativeBal(8453,account),{code:'GAS_BALANCE_UNAVAILABLE'});
});
test('normal funded swaps do not send a refuel wallet request',async()=>{
 const c=harness({gwRpcTry:async()=>native(.001)});
 c.gwGasExecSameChainTokenTopUp=()=>assert.fail('unexpected top-up');
 c.gwGasExecDonorBridgeTopUp=()=>assert.fail('unexpected donor');
 assert.equal((await c.gwEnsureGasTopUpBeforeSwap(args())).ok,true);
});
test('zero source gas never triggers a futile same-chain token swap',async()=>{
 const c=harness();let donors=0;
 c.gwGasExecSameChainTokenTopUp=()=>assert.fail('zero-gas swap cannot pay its own fee');
 c.gwGasExecDonorBridgeTopUp=async()=>{donors++;return null;};
 await assert.rejects(c.gwEnsureGasTopUpBeforeSwap(args()),{code:'GAS_TOPUP_NO_DONOR'});
 assert.equal(donors,1);assert.equal(c.window.__gwGasTopUpInFlight,false);
});
test('native swap value is separate from its gas reserve; missing input is not funded as gas',async()=>{
 const c=harness({gwRpcTry:async()=>native(.001)});
 c.gwGasExecDonorBridgeTopUp=()=>assert.fail('full native MAX must reserve gas, not bridge more funds');
 await assert.rejects(c.gwEnsureGasTopUpBeforeSwap(args({fromSym:'ETH',amtNum:'.001'})),{code:'GAS_NATIVE_RESERVE'});
 await assert.rejects(c.gwEnsureGasTopUpBeforeSwap(args({fromSym:'ETH',amtNum:'.002'})),{code:'GAS_SWAP_BALANCE'});
});
test('WETH does not bypass gas checks',async()=>{
 const c=harness({gwRpcTry:async()=>native(.00003)});let same=0;
 c.gwGasExecSameChainTokenTopUp=async()=>{same++;c.gwRpcTry=async()=>native(.001);return {ok:true};};
 await c.gwEnsureGasTopUpBeforeSwap(args({fromSym:'WETH'}));assert.equal(same,1);
});
test('rejection, timeout and pending approval each prevent a second funding request',async()=>{
 for(const error of [Object.assign(new Error('declined'),{code:4001}),new Error('Wallet request timed out'),new Error('provider error')]) {
  const c=harness({gwRpcTry:async()=>native(.00003)});
  c.gwGasExecSameChainTokenTopUp=async()=>{if(error.message==='provider error')c.window.__gwSwapOp.approvalPending=true;throw error;};
  c.gwGasExecDonorBridgeTopUp=()=>assert.fail('must not cascade after wallet request');
  await assert.rejects(c.gwEnsureGasTopUpBeforeSwap(args()),e=>e===error);
 }
});
test('same-chain funding preserves the amount reserved for the main swap',async()=>{
 const c=harness({gwRpcTry:async()=> '0x1e8480'}); // 2 USDT
 c.gwMetaAggQuoteAll=()=>assert.fail('the selected 2 USDT is not spare refuel balance');
 assert.equal(await c.gwGasExecSameChainTokenTopUp({...args(),gasSym:'ETH',swapAmount:'2'}),null);
});
test('confirmed same-chain funding restores main intent and clears only its own hash',async()=>{
 let quoteArgs;
 const c=harness({gwRpcTry:async(_c,m)=>m==='eth_call'?'0x989680':native(.00003)});
 c.gwMetaAggQuoteAll=async a=>{quoteArgs=a;return [quote({_fromChainId:8453,gasUsd:.01})];};
 c.gwOnChainSwapExecMeta=async()=>{c.window.__gwSwapOp.hash=hash;return {hash,confirmed:true};};
 const result=await c.gwGasExecSameChainTokenTopUp({...args(),gasSym:'ETH',swapAmount:'2'});
 assert.equal(result.ok,true);assert.equal(quoteArgs.toChainId,8453);
 assert.equal(c.window.__gwSwapOp.hash,null);assert.equal(c.window.__gwSwapOp.from,'USDT');
 assert.equal(c.window.__gwSwapOp.amt,'2');assert.equal(c.window.__gwSwapOp.gasFunding.hash,hash);
});
test('native donors include BNB for a quoted BNB-to-ETH route and preserve their gas',async()=>{
 const c=harness({gwRpcTry:async chain=>chain===56?native(.01):'0x0'});
 const donors=await c.gwGasFindDonors(8453,account);
 assert.equal(donors.length,1);assert.equal(donors[0].sym,'BNB');
 assert.ok((donors[0].bal-donors[0].amtNum)*donors[0].px>=.8);
});
test('donor routes reject excessive total cost and insufficient minimum delivery',async()=>{
 const c=harness();let executions=0;
 c.gwGasFindDonors=async()=>[{chainId:42161,sym:'ETH',amtNum:.0005,px:2500,bal:.01}];
 c.gwOnChainSwapExecMeta=async()=>{executions++;};
 for(const q of [quote({gasUsd:1}),quote({raw:{estimate:{toAmountMin:'1'}}})]) {
  c.gwGasQuoteNativeBridge=async()=>q;
  assert.equal(await c.gwGasExecDonorBridgeTopUp({destChainId:8453,gasSym:'ETH',account,provider:{request:async()=>[account]},requiredNative:.00008}),null);
 }
 assert.equal(executions,0);
});
test('received gas continues without another Start and preserves a funding audit record',async()=>{
 const c=harness({gwRpcTry:async()=>native(.001)});
 const intent=c.gwGasCaptureIntent();c.window.__gwSwapOp.from='ETH';c.window.__gwSwapOp.to='ETH';
 const result=await c.gwGasWaitForFunding({result:{hash,fromChainId:42161,bridge:'squid',quoteId:'qid'},destChainId:8453,account,requiredNative:.00008,provider:{request:async()=>[account]},intent});
 assert.equal(result.ok,true);assert.equal(c.window.__gwSwapOp.stage,'preparing');
 assert.equal(c.window.__gwSwapOp.hash,null);assert.equal(c.window.__gwSwapOp.from,'USDT');
 assert.equal(c.window.__gwSwapOp.chainId,8453);assert.equal(c.window.__gwSwapOp.gasFunding.hash,hash);
});
test('delayed funding keeps its bridge hash instead of re-sending or marking it failed',async()=>{
 const c=harness();const intent=c.gwGasCaptureIntent();
 await assert.rejects(c.gwGasWaitForFunding({result:{hash,fromChainId:42161,bridge:'squid',quoteId:'qid'},destChainId:8453,account,requiredNative:.00008,provider:{request:async()=>[account]},intent}),{code:'GAS_TOPUP_PENDING'});
 assert.equal(c.window.__gwSwapOp.hash,hash);assert.equal(c.window.__gwSwapOp.stage,'bridging');
 assert.equal(c.window.__gwSwapOp.purpose,'gas_topup');assert.equal(c.window.__gwSwapOp.quoteId,'qid');
});
test('changed pair, amount or account prevents automatic main-swap continuation',async()=>{
 for(const change of ['pair','amount','account']) {
  const c=harness({gwRpcTry:async()=>native(.001)});const intent=c.gwGasCaptureIntent();
  if(change==='pair')c.window.__gwDsUserPickedTo={sym:'USDC'};
  if(change==='amount')c.gwDsReadSwapAmtStr=()=> '3';
  const provider={request:async()=>[change==='account'?'0x'+'d'.repeat(40):account]};
  await assert.rejects(c.gwGasWaitForFunding({result:{hash,fromChainId:42161,bridge:'lifi'},destChainId:8453,account,requiredNative:.00008,provider,intent}),{code:change==='account'?'GAS_TOPUP_PENDING':'GAS_TOPUP_READY'});
  if(change==='account')assert.equal(c.window.__gwSwapOp.hash,hash);
 }
});


test('funding quotes reject a different recipient, wrong chain, wrapped output and refreshed budget',()=>{
 const c=harness();
 const plan={fromChainId:42161,toChainId:8453,fromSym:'ETH',toSym:'ETH',nativeInput:true,spendUsd:1.25,account,minOutputNative:.00008};
 c.gwGasValidateFundingQuote(quote(),plan);
 for(const q of [quote({_toChainId:1}),quote({gasUsd:.8}),quote({amountInUsd:2}),
  quote({raw:{action:{toAddress:'0x'+'d'.repeat(40)}}}),
  quote({raw:{action:{toToken:{address:'0x'+'c'.repeat(40)}}}})]) {
  assert.throws(()=>c.gwGasValidateFundingQuote(q,plan),{code:'GAS_TOPUP_BAD_QUOTE'});
 }
});
test('funding quote lookup chooses an affordable delivery over a costlier larger output',async()=>{
 const c=harness();
 c.gwAggQuoteLifi=async()=>quote({gasUsd:.1});
 c.gwAggQuoteSquid=async()=>quote({gasUsd:1,toAmount:600000000000000n});
 const q=await c.gwGasQuoteNativeBridge({fromChainId:42161,toChainId:8453,sym:'ETH',toSym:'ETH',amtNum:.0005,account,maxGasUsd:.75,minOutputNative:.00008});
 assert.equal(q.gasUsd,.1);
 c.gwResolveEvmToken=()=>({isNative:false,address:'0x'+'c'.repeat(40)});
 assert.equal(await c.gwGasQuoteNativeBridge({fromChainId:42161,toChainId:8453,sym:'ETH',amtNum:.0005,account}),null);
});
test('confirmed funding never clears an unrelated hash, even under the same operation id',()=>{
 const c=harness();const intent=c.gwGasCaptureIntent();
 c.window.__gwSwapOp.hash='0x'+'d'.repeat(64);c.window.__gwSwapOp.purpose='gas_topup';
 assert.throws(()=>c.gwGasRestoreIntent(intent,{hash}),{code:'GAS_TOPUP_PENDING'});
 assert.equal(c.window.__gwSwapOp.hash,'0x'+'d'.repeat(64));
});
test('editing the pair during funding quote preparation sends no wallet request',async()=>{
 const c=harness();const intent=c.gwGasCaptureIntent();let executions=0;
 c.gwGasFindDonors=async()=>[{chainId:42161,sym:'ETH',amtNum:.0005,px:2500,bal:.01}];
 c.gwGasQuoteNativeBridge=async()=>{c.window.__gwDsUserPickedTo={sym:'USDC',chainId:1};return quote();};
 c.gwOnChainSwapExecMeta=async()=>{executions++;};
 await assert.rejects(c.gwGasExecDonorBridgeTopUp({destChainId:8453,gasSym:'ETH',account,provider:{request:async()=>[account]},requiredNative:.00008,intent}),{code:'GAS_SWAP_CONTEXT_CHANGED'});
 assert.equal(executions,0);
});
test('successful BNB donor funding continues the original Base swap and logs a separate funding entry',async()=>{
 const logs=[];let execution;
 const c=harness({gwRpcTry:async()=>native(.001),gwTxLogPush:e=>logs.push(e)});
 c.gwGasFindDonors=async()=>[{chainId:56,sym:'BNB',amtNum:.0025,px:500,bal:.01}];
 c.gwGasQuoteNativeBridge=async()=>quote({_fromChainId:56,aggregator:'Squid · Bridge'});
 c.gwOnChainSwapExecMeta=async a=>{execution=a;return {hash,fromChainId:56,toChainId:8453,bridge:'squid',status:'bridging'};};
 const result=await c.gwGasExecDonorBridgeTopUp({destChainId:8453,gasSym:'ETH',account,provider:{request:async()=>[account]},requiredNative:.00008});
 assert.equal(result.ok,true);assert.equal(execution.fromSym,'BNB');assert.equal(execution.toSym,'ETH');
 assert.equal(c.window.__gwSwapOp.from,'USDT');assert.equal(c.window.__gwSwapOp.amt,'2');
 assert.equal(logs[0].action,'gas_topup');assert.equal(logs[0].hash,hash);
});
test('late funding starts only one background monitor, with the real bridge metadata',()=>{
 const calls=[];const c=harness({gwSquidBridgeMonitor:a=>calls.push(a)});
 Object.assign(c.window.__gwSwapOp,{purpose:'gas_topup',hash,crossChain:true,bridge:'squid',fromChainId:42161,toChainId:8453,quoteId:'qid'});
 c.gwGasMonitorFunding(c.window.__gwSwapOp);c.gwGasMonitorFunding(c.window.__gwSwapOp);
 assert.equal(calls.length,1);assert.equal(calls[0].quoteId,'qid');assert.equal(calls[0].txHash,hash);
});

test('an unrelated balance deposit does not prove that the funding bridge delivered',async()=>{
 const c=harness({gwRpcTry:async()=>native(.001),gwSquidBridgeMonitor(){}});const intent=c.gwGasCaptureIntent();
 await assert.rejects(c.gwGasWaitForFunding({result:{hash,fromChainId:42161,bridge:'squid'},destChainId:8453,account,requiredNative:.00008,provider:{request:async()=>[account]},intent}),{code:'GAS_TOPUP_PENDING'});
 assert.equal(c.window.__gwSwapOp.hash,hash);
});
test('a partial or refunded bridge never starts the main swap',async()=>{
 for(const outcome of ['partial','refunded','failed']) {
  const c=harness({gwRpcTry:async()=>native(.001),gwLifiBridgeMonitor:a=>a.onTerminal?.({outcome,success:false})});
  const intent=c.gwGasCaptureIntent();
  await assert.rejects(c.gwGasWaitForFunding({result:{hash,fromChainId:42161,bridge:'lifi'},destChainId:8453,account,requiredNative:.00008,provider:{request:async()=>[account]},intent}),{code:'GAS_TOPUP_NOT_DELIVERED'});
  assert.equal(c.window.__gwSwapOp.gasFundingOutcome,outcome);
 }
});

test('a fresh source quote supplies a gas reserve instead of a flat twenty cents',()=>{
 const c=harness();c.window.__gwLastAggQuotes={chainId:8453,fromSym:'USDT',toSym:'ETH',account,amtNum:'2',at:0,
  quotes:[quote({_fromChainId:8453,raw:{estimate:{gasCosts:[{amountUSD:'1',token:{chainId:8453}},{amountUSD:'5',token:{chainId:1}}]}}})]};
 const a={chainId:8453,fromSym:'USDT',toSym:'ETH',account,amtNum:'2',nativeInput:false};
 assert.equal(c.gwGasSwapReserveUsd(a),2.5);
 c.window.__gwLastAggQuotes.account='0x'+'d'.repeat(40);
 assert.equal(c.gwGasSwapReserveUsd(a),.2);
});

function execHarness(extra={}) {
 const c=harness({currentChainId:8453,GW_META_NATIVE:'0x'+'e'.repeat(40),
  gwDsCanonicalAmtStr:a=>String(a),gwDsTokenBalanceOnChain:async()=>10,
  gwAmtToBaseUnits:(amount,dec)=>BigInt(Math.round(Number(amount)*10**dec)),
  gwAggBuildTxIfNeeded:async()=>{},gwErc20Allowance:async()=>10n**30n,
  gwAggRefreshExecQuote:async()=>{},gwEnsureLiveSigningProvider:async p=>p,
  gwSimulateSwapTx:async()=>({ok:true}),gwOrdValidateExecQuote(){},gwIsFeeVerified:()=>true,
  gwWakeWalletForSigning(){},gwWaitReceipt:async()=>{},gwAssertNativeTxValue(){},
  ...extra});
 c.console={log(){},warn(){}};
 for(const cfg of Object.values(c.GW_OC_SWAP)) {cfg.native='ETH';cfg.wrapped='0x'+'c'.repeat(40);cfg.decimals={ETH:18,USDT:6};}
 c.gwResolveEvmToken=(_c,s)=>({isNative:s==='ETH',address:s==='ETH'?'0x'+'e'.repeat(40):'0x'+'c'.repeat(40),decimals:s==='ETH'?18:6});
 vm.runInContext(src.slice(src.indexOf('async function gwOnChainSwapExecMeta('),src.indexOf('/* =========================================================================\n * PHASE 4 + 5')),c);
 return c;
}
function fundingExec(c) {
 const q=quote({transactionRequest:{to:'0x'+'c'.repeat(40),data:'0x1234',value:'0x1c6bf52634000'},outDecimals:18,_crossChain:true});
 return {chainId:42161,fromSym:'ETH',toSym:'ETH',amtNum:'.0005',quote:q,account,provider:{request:async()=>[account]},deferReceipt:true,
  gasFundingPlan:{fromChainId:42161,toChainId:8453,fromSym:'ETH',toSym:'ETH',nativeInput:true,spendUsd:1.25,account,minOutputNative:.00008,intent:c.gwGasCaptureIntent()}};
}
test('real executor rechecks refreshed funding cost before sending to the wallet',async()=>{
 const c=execHarness({gwAggRefreshExecQuote:async q=>{q.gasUsd=.8;},gwProviderSendTx:()=>assert.fail('over-budget quote must not be signed')});
 await assert.rejects(c.gwOnChainSwapExecMeta(fundingExec(c)),{code:'GAS_TOPUP_BAD_QUOTE'});
});
test('real executor does not cascade to another route when funding simulation reverts',async()=>{
 const c=execHarness({gwSimulateSwapTx:async()=>({ok:false,err:'revert'}),gwProviderSendTx:()=>assert.fail('reverting funding must not be signed'),
  gwAggQuoteLifi:()=>assert.fail('no extra funding route')});
 await assert.rejects(c.gwOnChainSwapExecMeta(fundingExec(c)),{code:'GAS_TOPUP_BAD_QUOTE'});
});
test('real executor sends the guarded native donor request once and preserves bridge identity',async()=>{
 let sends=0,guard;
 const c=execHarness({gwAssertNativeTxValue:a=>{guard=a;},gwProviderSendTx:async()=>{sends++;return hash;}});
 const result=await c.gwOnChainSwapExecMeta(fundingExec(c));
 assert.equal(sends,1);assert.equal(guard.isNative,true);assert.equal(result.hash,hash);
 assert.equal(result.fromChainId,42161);assert.equal(result.toChainId,8453);assert.equal(result.status,'bridging');
});
test('real LI.FI monitor hands a terminal funding result to the waiter without clearing its operation',async()=>{
 let terminal;
 const c=harness({GW_LIFI_ENDPOINT:'https://li.quest/v1',fetch:async()=>({ok:true,json:async()=>({status:'DONE',substatus:'COMPLETED',receiving:{txHash:hash}})}),
  gwNormalizeLifiBridgeStatus:()=>({outcome:'completed',success:true}),gwSwapOpClear:()=>assert.fail('waiter owns the funding operation')});
 vm.runInContext(src.slice(src.indexOf('async function gwLifiBridgeMonitor('),src.indexOf('function gwResumeSwapOpFromStorage(')),c);
 Object.assign(c.window.__gwSwapOp,{hash});
 await c.gwLifiBridgeMonitor({txHash:hash,fromChainId:42161,toChainId:8453,opId:'main',onTerminal:status=>{terminal=status;}});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(terminal.outcome,'completed');assert.equal(terminal.destTxHash,hash);
 assert.equal(c.window.__gwSwapOp.hash,hash);
});

test('changing only the source network also invalidates the saved funding intent',()=>{
 const c=harness();let network=8453;c.gwGetActiveUiChainId=()=>network;
 const intent=c.gwGasCaptureIntent();network=42161;
 assert.throws(()=>c.gwGasAssertIntent(intent,account),{code:'GAS_SWAP_CONTEXT_CHANGED'});
});

test('same-chain refuel refuses to spend when its output cannot cover the main gas reserve',async()=>{
 const c=harness({gwRpcTry:async(_c,m)=>m==='eth_call'?'0x989680':native(.00003)});
 c.gwMetaAggQuoteAll=async()=>[quote({_fromChainId:8453,gasUsd:.01,toAmount:10000000000000n,raw:{estimate:{toAmountMin:'10000000000000'}}})];
 c.gwOnChainSwapExecMeta=()=>assert.fail('insufficient refuel output must not spend tokens');
 await assert.rejects(c.gwGasExecSameChainTokenTopUp({...args(),gasSym:'ETH',swapAmount:'2',requiredNative:.00008}),{code:'GAS_TOPUP_NO_ROUTE'});
});

test('funding forces a fresh Squid quote even though ordinary Squid routes do not require refresh',async()=>{
 let refreshes=0;
 const c=execHarness({gwAggRefreshExecQuote:async()=>{refreshes++;},gwProviderSendTx:async()=>hash});
 const args=fundingExec(c);args.quote.aggregator='Squid · Bridge';
 await c.gwOnChainSwapExecMeta(args);assert.equal(refreshes,1);
});

function maxHarness(extra={}) {
 const elements={gwDsAmt:{value:'0'},gwDsSimAmt:{value:'0'},gwDsOut:{value:'1.4',dataset:{pair:'ETH/USDT'}}};
 let refreshes=0;
 const c=harness({document:{documentElement:{lang:'en'},getElementById:id=>elements[id]},
  gwReadOnlyAddress:()=>account,gwDsGetMode:()=> 'onchain',gwGetActiveUiChainId:()=>8453,
  gwDsPaintAmtUsd(){},gwDsRefreshRate(){refreshes++;},gwRpcTry:async()=>native(.00051644),...extra});
 return {c,elements,refreshes:()=>refreshes,run:()=>c.gwDsFillNativeMax({chainId:8453,fromSym:'ETH',toSym:'USDT',decimals:18})};
}
test('Base ETH MAX subtracts gas from the same balance and needs no donor funding',async()=>{
 const h=maxHarness();await h.run();
 const amount=h.elements.gwDsAmt.value;
 assert.ok(Number(amount)>0 && Number(amount)<.00051644);
 assert.ok((.00051644-Number(amount))*2500>=.22);
 assert.equal(h.elements.gwDsSimAmt.value,amount);assert.equal(h.elements.gwDsOut.value,'');
 assert.equal(h.refreshes(),1);
 h.c.gwGasExecDonorBridgeTopUp=()=>assert.fail('MAX already reserved gas');
 assert.equal((await h.c.gwEnsureGasTopUpBeforeSwap(args({fromSym:'ETH',toSym:'USDT',amtNum:amount}))).ok,true);
});
test('native MAX uses a live route gas estimate, and never makes a tiny balance negative',async()=>{
 const h=maxHarness();h.c.window.__gwLastAggQuotes={chainId:8453,fromSym:'ETH',toSym:'USDT',account,amtNum:'0.0005',at:0,
  quotes:[{toAmount:1n,gasUsd:.5}]};
 await h.run();assert.ok((.00051644-Number(h.elements.gwDsAmt.value))*2500>=.825);
 h.c.gwGasNativeBal=async()=>.000001;await h.run();assert.equal(h.elements.gwDsAmt.value,'0');
});
test('late native MAX balance cannot overwrite a changed amount, network, account or newer chip',async()=>{
 for(const change of ['amount','network','account','request']) {
  let finish;const h=maxHarness();h.c.gwGasNativeBal=()=>new Promise(r=>{finish=r;});
  const pending=h.run();
  if(change==='amount')h.elements.gwDsAmt.value='0.0002';
  if(change==='network')h.c.gwGetActiveUiChainId=()=>42161;
  if(change==='account')h.c.gwReadOnlyAddress=()=> '0x'+'d'.repeat(40);
  if(change==='request')h.c.window.__gwNativeMaxRequest++;
  finish(.00051644);await pending;
  assert.equal(h.elements.gwDsAmt.value,change==='amount'?'0.0002':'0');assert.equal(h.refreshes(),0);
 }
});
test('native MAX preserves the user amount when the source RPC is unavailable',async()=>{
 const h=maxHarness();h.c.gwGasNativeBal=async()=>{throw new Error('RPC unavailable');};
 await h.run();assert.equal(h.elements.gwDsAmt.value,'0');assert.equal(h.refreshes(),0);
});
test('a Squid cross-chain executor reaches the send boundary without opening Trust early',async()=>{
 let sends=0;
 const c=execHarness({gwWakeWalletForSigning:()=>assert.fail('wallet wake must follow relay dispatch'),
  gwProviderSendTx:async(_p,tx,_timeout,chain)=>{sends++;assert.equal(chain,42161);assert.equal(tx.value,'0x0');return hash;}});
 const result=await c.gwOnChainSwapExecMeta({chainId:42161,fromSym:'USDT',toSym:'USDT',amtNum:'6',account,
  provider:{request:async()=>[account]},deferReceipt:true,
  quote:quote({aggregator:'Squid · Bridge',_toChainId:137,_crossChain:true,outDecimals:6,
    transactionRequest:{to:'0x'+'c'.repeat(40),data:'0x1234',value:'0x0'}})});
 assert.equal(sends,1);assert.equal(result.fromChainId,42161);assert.equal(result.toChainId,137);assert.equal(result.status,'bridging');
});

test('MAX calculation blocks submission of the old amount until its balance arrives',async()=>{
 let finish;const h=maxHarness();h.c.gwGasNativeBal=()=>new Promise(r=>{finish=r;});
 const at=src.indexOf('async function gwDsSubmit(');
 const guard=src.slice(at,src.indexOf('  /* Always clear fake locks',at))+'}';
 vm.runInContext(guard,h.c);
 const pending=h.run();
 assert.equal(h.c.window.__gwNativeMaxPending,h.c.window.__gwNativeMaxRequest);
 await h.c.gwDsSubmit(); // must return before any signing/preparation dependency
 finish(.00051644);await pending;assert.equal(h.c.window.__gwNativeMaxPending,null);
});
test('the legacy MATIC label still reserves native Polygon gas by asset identity',async()=>{
 const c=harness({gwRpcTry:async()=>native(2),gwResolveEvmToken:()=>({isNative:true})});
 c.gwGasExecDonorBridgeTopUp=()=>assert.fail('native MAX should subtract POL gas');
 await assert.rejects(c.gwEnsureGasTopUpBeforeSwap(args({chainId:137,fromSym:'MATIC',amtNum:'2'})),{code:'GAS_NATIVE_RESERVE'});
});
