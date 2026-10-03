import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const src = fs.readFileSync(new URL('../../frontend/public/grom-wallet.js', import.meta.url), 'utf8');
function block(name, next) { return src.slice(src.indexOf('function ' + name + '('), src.indexOf(next, src.indexOf('function ' + name + '('))); }
function harness() {
 const els = { gwDsFrom: { value: 'TRX' }, gwDsTo: { value: 'USDT' }, gwDsAmt: { value: '' } };
 const c = { window: {}, document: { getElementById: id => els[id] }, GW_TRON_CHAIN_ID:728126428, GW_LIFI_SOL_CHAIN:1151111081099710,
 gwDsNormSym:s=>String(s).toUpperCase(),gwDsToSymIncompatibleWithPayChain:()=>false,gwDsDefaultReceiveSym:()=> 'USDC',
 gwDsEnsureTokenOption:()=>{},gwTkSyncButton:()=>{},gwDsClearForceBridge:()=>{c.window.__gwDsForceBridgeTo=null;},
 gwDsGetMode:()=> 'onchain', gwOcConnectedAddress:()=> 'wallet-A', gwTkLoadHoldings:async()=>[],
 gwResolveEvmToken:(cid,sym)=>({address:`${cid}:${sym}`}),
 gwTronResolveToken:sym=>['TRX','USDT','USDC'].includes(sym)?{address:sym}:null,
 gwSolResolveToken:sym=>['SOL','USDC','USDT'].includes(sym)?{mint:sym}:null,
 gwDsSetActiveChain: cid=>{c.selected=cid;}, gwDsInvalidateQuoteUi:()=>{}, gwDsRefreshBalances:async()=>{},gwDsRefreshRate:()=>{} };
 vm.createContext(c);
 vm.runInContext(block('gwDsLargestNetworkHolding','/** Apply once'),c);
 vm.runInContext(block('gwDsAlignReceiveToPayChain','try { window.gwDsAlignReceiveToPayChain'),c);
 vm.runInContext('async '+block('gwDsAutoPickFromToken','\nlet gwDsQuoteAbort'),c);
 vm.runInContext(block('gwTkGetToCatalogChain','\nfunction gwIsTronContext'),c);
 return {c,els};
}
test('default ranks total network USD then largest holding, not raw token amount',()=>{
 const {c}=harness();
 const hit=c.gwDsLargestNetworkHolding([{sym:'TRX',chainId:728126428,amt:1000,usd:0.001},{sym:'ETH',chainId:1,amt:1,usd:30},{sym:'USDC',chainId:42161,amt:22,usd:22},{sym:'ETH',chainId:42161,amt:0.1,usd:10}]);
 assert.equal(hit.chainId,42161); assert.equal(hit.sym,'USDC');
 assert.equal(c.gwDsLargestNetworkHolding([{sym:'BAD',chainId:1,amt:1,usd:NaN}]),null);
});
test('pay-from picker hides dust and assets without a supported source resolver',()=>{
 const {c}=harness();
 c.gwResolveEvmToken=(cid,sym)=>sym==='USDC'?{address:'arb-usdc'}:null;
 const rows=c.gwDsSpendablePayHoldings([
  {sym:'TRX',chainId:728126428,amt:0.000001,usd:0.000001},
  {sym:'USDT',chainId:1,amt:0.49,usd:0.49},
  {sym:'UNKNOWN',chainId:42161,amt:4,usd:12},
  {sym:'USDC',chainId:42161,amt:0.5,usd:0.5},
  {sym:'USDT',chainId:728126428,amt:9,usd:9},
  {sym:'BONK',chainId:1151111081099710,amt:900000,usd:8},
 ]);
 assert.deepEqual(rows.map(r=>r.sym),['USDC','USDT']);
 assert.deepEqual(rows.map(r=>r.chainId),[42161,728126428]);
});
test('changing source resets stale TRON destination, bridge and old token address',()=>{
 const {c,els}=harness(); els.gwDsFrom.value='ETH';
 c.window.__gwDsUserPickedTo={sym:'USDT',chainId:728126428,address:'tron-old'};
 c.window.__gwDsForceBridgeTo={chainId:728126428,source:'user'};
 c.window.__gwTkUserPickedToChain=true;
 c.gwDsAlignReceiveToPayChain(1);
 assert.equal(c.window.__gwDsToCatalogChain,1); assert.equal(c.window.__gwDsUserPickedTo.chainId,1);
 assert.equal(c.window.__gwDsUserPickedTo.address,undefined); assert.equal(c.window.__gwDsForceBridgeTo,null);
 assert.equal(c.window.__gwTkUserPickedToChain,false);
});
test('manual cross-chain catalog remains available after default alignment',()=>{
 const {c}=harness(); c.gwDsAlignReceiveToPayChain(1);
 c.window.__gwTkUserPickedToChain=true; c.window.__gwDsToCatalogChain=8453;
 assert.equal(c.gwTkGetToCatalogChain(1),8453);
 c.window.__gwTkUserPickedToChain=false;
 assert.equal(c.gwTkGetToCatalogChain(1),1);
});
test('late balances cannot overwrite manual selection',async()=>{
 const {c}=harness(); let resolve;
 c.gwTkLoadHoldings=()=>new Promise(r=>resolve=r);
 const work=c.gwDsAutoPickFromToken(); c.window.__gwDsManualSelection=true;
 resolve([{sym:'USDC',chainId:42161,amt:22,usd:22}]); await work;
 assert.equal(c.selected,undefined);
});
test('automatic initial TRON selection can be replaced by funded network once',async()=>{
 const {c,els}=harness(); c.window.__gwDsUserPickedFrom={sym:'TRX',chainId:728126428};
 c.gwTkLoadHoldings=async()=>[
  {sym:'TRX',chainId:728126428,amt:0.000001,usd:0.000001},
  {sym:'USDC',chainId:42161,amt:22,usd:22},
 ];
 await c.gwDsAutoPickFromToken(); assert.equal(c.selected,42161); assert.equal(els.gwDsFrom.value,'USDC');
 assert.equal(c.window.__gwDsUserPickedTo.chainId,42161);
 c.gwTkLoadHoldings=async()=>[{sym:'ETH',chainId:1,amt:1,usd:1000}];
 await c.gwDsAutoPickFromToken(); assert.equal(c.selected,42161);
});
test('dedicated venue funding destination is preserved',()=>{
 const {c}=harness(); const intent={source:'hl',chainId:42161}; c.window.__gwDsForceBridgeTo=intent;
 c.gwDsAlignReceiveToPayChain(1); assert.equal(c.window.__gwDsForceBridgeTo,intent);
});

test('late balance response cannot paint previous token or MAX after a selection change', async () => {
 const {c,els}=harness();
 els.gwDsBalFrom={textContent:'',dataset:{},classList:{toggle(){}}};
 els.gwDsBalTo={textContent:''};
 c.gwDsLang=()=>({bal:'Balance'});
 c.gwTkGetFromContext=()=>({chainId:c.window.__gwDsUserPickedFrom.chainId});
 c.gwDsTokenBalanceOnChain=async()=>0;
 c.window.__gwDsUserPickedFrom={sym:'TRX',chainId:728126428};
 c.window.__gwDsUserPickedTo={sym:'USDT',chainId:1};
 let finishOld;
 c.gwDsAvailableAmount=()=>new Promise(r=>finishOld=r);
 vm.runInContext('async '+block('gwDsRefreshBalances','\nconst gwDsRefreshBalancesDebounced'),c);
 const old=c.gwDsRefreshBalances();
 els.gwDsFrom.value='ETH';c.window.__gwDsUserPickedFrom={sym:'ETH',chainId:1};
 c.gwDsAvailableAmount=async()=>0.1;
 await c.gwDsRefreshBalances();finishOld(999);await old;
 assert.equal(els.gwDsBalFrom.textContent,'Balance: 0.1 ETH');
 assert.equal(els.gwDsBalFrom.dataset.maxSym,'ETH');
 assert.equal(els.gwDsBalFrom.dataset.maxCid,'1');
 assert.equal(els.gwDsBalTo.textContent.includes('TRX'),false);
});

function walletChainHarness() {
 const {c,els}=harness();
 els.gwDsFrom.value='USDC';
 const chips=[1,42161].map(cid=>({dataset:{cid:String(cid)},on:false,classList:{toggle(_name,on){this.owner.on=on;}}}));
 for(const chip of chips) chip.classList.owner=chip;
 c.document.querySelectorAll=()=>chips;
 c.gwTkSyncButton=which=>{if(which==='from') c.visibleSourceChain=c.window.__gwDsUserPickedFrom.chainId;};
 vm.runInContext(block('gwDsSetActiveChain','/** Pick swap chain:'),c);
 return {c,els,chips};
}
test('late initial wallet chain preserves restored source and matches visible network to quote chain',async()=>{
 const {c,chips}=walletChainHarness();
 let answer;
 const response=new Promise(resolve=>{answer=resolve;});
 const initialize=response.then(cid=>c.gwDsInitializeWalletChain(cid));
 c.window.__gwDsUserPickedFrom={sym:'USDC',chainId:42161,address:'arb-usdc'};
 answer(1);await initialize;
 assert.equal(c.window.__gwDsUserPickedFrom.chainId,42161);
 assert.equal(c.visibleSourceChain,42161);
 assert.equal(chips.find(chip=>chip.on).dataset.cid,'42161');
 c.gwGetActiveUiChainId=()=>Number(chips.find(chip=>chip.on).dataset.cid);
 vm.runInContext('async '+block('gwDsResolveSwapChainFor','/**\n * Auto-pick'),c);
 assert.equal(await c.gwDsResolveSwapChainFor('USDC',1),42161);
});
test('initial wallet network supplies default only before a source selection exists',()=>{
 const {c}=walletChainHarness();
 c.gwDsInitializeWalletChain(1);
 assert.equal(c.window.__gwDsUserPickedFrom.chainId,1);
 assert.equal(c.visibleSourceChain,1);
});
test('wallet startup does not overwrite a manual source or auto-selected account',()=>{
 for(const flag of ['__gwDsManualSelection','__gwDsAutoSelectedAccount']) {
  const {c}=walletChainHarness();c.window[flag]=true;
  c.gwDsInitializeWalletChain(1);
  assert.equal(c.window.__gwDsUserPickedFrom,undefined);
 }
});
test('source chain change refreshes its visible token network',()=>{
 const {c,chips}=walletChainHarness();
 c.gwDsSetActiveChain(42161);
 c.gwDsSetActiveChain(1);
 assert.equal(c.visibleSourceChain,1);
 assert.equal(chips.find(chip=>chip.on).dataset.cid,'1');
});
