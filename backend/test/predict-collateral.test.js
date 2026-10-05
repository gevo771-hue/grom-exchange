import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { Interface } from 'ethers';
const source = fs.readFileSync(new URL('../../frontend/public/grom-predict.js', import.meta.url), 'utf8');
const account = '0x' + 'a'.repeat(40), other = '0x' + 'b'.repeat(40), hash = '0x' + 'c'.repeat(64);
const PUSD = '0xc011a7e12a19f7b1f670d46f03b03f3342e82dfb';
const USDCE = '0x2791bca1f2de4661ed88a30c99a7a9449aa84174';
const onramp = '0x93070a847efef7f70739046a929d47a521f5b8ee';
const exchange = '0xe111180000d2663c0091e4f400237545b87b996b';
function harness(options = {}) {
  const storage = options.storage || new Map(), calls = [], posts = [], clients = [];
  let selected = account, chain = 42161;
  const balances = { [PUSD]: 10000000n, [USDCE]: 5000000n, ...options.balances };
  const provider = { request: async ({method, params}) => {
    calls.push({method, params});
    if (method === 'eth_accounts' || method === 'eth_requestAccounts') return [selected];
    if (method === 'eth_chainId') return '0x' + chain.toString(16);
    if (method === 'wallet_switchEthereumChain') {chain = 137; return null;}
    if (method === 'eth_sendTransaction') {
      if (options.sendError) throw options.sendError;
      return hash;
    }
    if (method === 'eth_signTypedData_v4') return '0xsignature';
    throw new Error('Unexpected wallet method ' + method);
  }};
  class ClobClient {
    constructor(config) { this.config = config; clients.push(this); }
    async getVersion() { return options.version || 2; }
    async resolveVersion() { return this.getVersion(); }
    async createOrDeriveApiKey() {
      await this.config.signer._signTypedData({ name:'ClobAuthDomain', version:'1', chainId:137n }, { ClobAuth:[{name:'nonce',type:'uint256'}] }, {nonce:0n});
      return { key:'test',secret:'test',passphrase:'test' };
    }
    async getNegRisk() {return options.negRisk || false;}
    async updateBalanceAllowance() {}
    async createMarketOrder(order) {
      if (options.onSign) options.onSign(() => { selected = other; });
      calls.push({method:'createMarketOrder',order});
      return { makerAmount: options.makerAmount || String(Math.round(order.amount * 1e6)) };
    }
    async postOrder(order,type) {
      posts.push({order,type});
      if (options.postError) throw options.postError;
      return options.response || {success:true,orderID:'id'};
    }
  }
  const fetch = async (url, init) => {
    if (url === '/api/market/predict/config') return {ok:true,json:async()=>({enabled:true,builderCode:'0x'+'0'.repeat(64)})};
    if (url.includes('/positions?')) return {ok:true,json:async()=>[{address:new URL('https://test'+url).searchParams.get('user')}]};
    const rpc = JSON.parse(init.body); calls.push(rpc);
    if (options.rpcError) throw new Error('RPC offline');
    let result;
    if (rpc.method === 'eth_getTransactionReceipt') result = options.pending ? null : {blockNumber:'0x1',status:options.reverted?'0x0':'0x1'};
    else if (rpc.method === 'eth_call') {
      const tx = rpc.params[0];
      result = '0x' + (tx.data.startsWith('0xdd62ed3e') ? (options.allowance ?? 10000000n) : (balances[tx.to.toLowerCase()] || 0n)).toString(16);
    } else throw new Error('Unexpected public method '+rpc.method);
    return {ok:true,json:async()=>({result})};
  };
  const ctx = {console, URL, AbortController, fetch, BigInt,
    setTimeout(fn,ms) { if(ms === 2000) {queueMicrotask(fn); return 0;} return setTimeout(fn, ms);}, clearTimeout,
    localStorage: {getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
    location:{origin:'https://grom.exchange'}, document:{documentElement:{lang:'en'},addEventListener(){}},
    window:{gwActiveSigningProvider:()=>options.noSigner?null:provider, gwDisplayAddress:()=>selected, ethereum:provider},
    fakeSdk:{ClobClient},
  };
  const script=source.replace("import(/* webpackIgnore: true */ 'https://esm.sh/@polymarket/clob-client-v2@1.0.3?bundle')", 'Promise.resolve(fakeSdk)');
  vm.runInNewContext(script, ctx);
  return {api:ctx.window.gromPredict, calls, posts, clients, storage, setAccount:a=>{selected=a;}};
}
const buy = {tokenId:'123',amountUsd:'2'};
test('reads pUSD separately from USDC.e without switching chains or prompting',async()=>{
 const h=harness();const st=await h.api.getStatus();
 assert.equal(st.polyBal,10);assert.equal(st.polyUsdce,5);assert.equal(st.collateral,'pUSD');
 assert.ok(!h.calls.some(x=>/switch|requestAccounts|sendTransaction/.test(x.method)));
 const n=h.calls.filter(x=>x.method==='eth_call').length;
 await h.api.getStatus();assert.equal(h.calls.filter(x=>x.method==='eth_call').length,n);
});
test('RPC failure is unknown balance, not zero and not a funding recommendation',async()=>{
 const h=harness({rpcError:true});const st=await h.api.getStatus();
 assert.equal(st.polyBal,null);assert.equal(st.balanceUnavailable,true);assert.equal(st.needsFund,false);
});
test('USDC.e alone cannot be spent as trading collateral',async()=>{
 const h=harness({balances:{[PUSD]:0n,[USDCE]:100000000n}});
 await assert.rejects(h.api.buyMarket(buy),{code:'PUSD_REQUIRED'});assert.equal(h.posts.length,0);
 assert.equal(h.calls.filter(x=>x.method==='eth_sendTransaction').length,0);
});
test('auth typed data omits absent domain fields, encodes BigInt and reuses same-account client',async()=>{
 const h=harness();await h.api.buyMarket(buy);await h.api.buyMarket(buy);
 const signed=h.calls.filter(x=>x.method==='eth_signTypedData_v4');assert.equal(signed.length,1);
 const typed=JSON.parse(signed[0].params[1]);assert.equal(typed.domain.chainId,'137');
 assert.deepEqual(typed.types.EIP712Domain.map(x=>x.name),['name','version','chainId']);
 assert.equal(h.posts.length,2);assert.equal(h.posts[0].type,'FOK');assert.equal(h.clients[1].config.retryOnError,false);
 h.setAccount(other);await h.api.getClient();assert.equal(h.calls.filter(x=>x.method==='eth_signTypedData_v4').length,2);
});
test('wrap and unwrap target official contracts, exact units and the same wallet',async()=>{
 const abi=new Interface(['function wrap(address,address,uint256)','function unwrap(address,address,uint256)']);
 for(const direction of ['wrap','unwrap']) {
   const h=harness({allowance:0n});await h.api.convertCollateral({amountUsd:'1.234567',direction});
   const txs=h.calls.filter(x=>x.method==='eth_sendTransaction').map(x=>x.params[0]);assert.equal(txs.length,2);
   assert.equal(txs[0].to.toLowerCase(),direction==='wrap'?USDCE:PUSD);
   assert.equal(BigInt('0x'+txs[0].data.slice(-64)),1234567n);
   assert.equal(txs[1].to.toLowerCase(),direction==='wrap'?onramp:'0x2957922eb93258b93368531d39facca3b4dc5854');
   const decoded=abi.parseTransaction(txs[1]);assert.equal(decoded.name,direction);
   assert.equal(decoded.args[0].toLowerCase(),USDCE);assert.equal(decoded.args[1].toLowerCase(),account);assert.equal(decoded.args[2],1234567n);
 }
});
test('pending or reverted approval never reaches conversion or order submission',async()=>{
 for(const state of [{pending:true},{reverted:true}]) {
   const h=harness({...state,allowance:0n});
   await assert.rejects(h.api.convertCollateral({amountUsd:'2'}));
   assert.equal(h.calls.filter(x=>x.method==='eth_sendTransaction').length,1);
   assert.equal(h.posts.length,0);
   if(state.pending) {
     await assert.rejects(h.api.convertCollateral({amountUsd:'2'}),{code:'PREDICT_PENDING'});
     assert.equal(h.calls.filter(x=>x.method==='eth_sendTransaction').length,1);
   }
 }
});
test('explicit wallet rejection releases guard; ambiguous send survives reload',async()=>{
 const rejected=harness({allowance:0n,sendError:Object.assign(new Error('rejected'),{code:4001})});
 await assert.rejects(rejected.api.convertCollateral({amountUsd:'2'}));assert.equal((await rejected.api.getStatus()).pending,null);
 const h=harness({allowance:0n,sendError:new Error('timeout')});
 await assert.rejects(h.api.convertCollateral({amountUsd:'2'}));
 const restored=harness({storage:h.storage});await assert.rejects(restored.api.buyMarket(buy),{code:'PREDICT_PENDING'});
 assert.equal(restored.posts.length,0);
});
test('false success and ambiguous network response cannot be presented as a completed order or retried',async()=>{
 const h=harness({response:{success:false,errorMsg:'No liquidity'}});
 await assert.rejects(h.api.buyMarket(buy),/No liquidity/);assert.equal((await h.api.getStatus()).pending,null);
 for(const opts of [{postError:new Error('network timeout')},{response:{}}]) {
   const h=harness(opts);await assert.rejects(h.api.buyMarket(buy));
   await assert.rejects(h.api.buyMarket(buy),{code:'PREDICT_PENDING'});assert.equal(h.posts.length,1);
 }
});
test('spend never increases; account changes after signing prevent submission',async()=>{
 const h=harness({makerAmount:'5000000'});await assert.rejects(h.api.buyMarket(buy),/exceeds/);assert.equal(h.posts.length,0);
 const change=harness({onSign:switchAccount=>switchAccount()});await assert.rejects(change.api.buyMarket(buy),{code:'WALLET_CHANGED'});assert.equal(change.posts.length,0);
});
test('approval is limited to exact spend and correct exchange, no stale-provider fallback',async()=>{
 const h=harness({allowance:0n});await h.api.buyMarket(buy);
 const tx=h.calls.find(x=>x.method==='eth_sendTransaction').params[0];assert.equal(tx.to.toLowerCase(),PUSD);
 assert.equal('0x'+tx.data.slice(34,74),exchange);assert.equal(BigInt('0x'+tx.data.slice(-64)),2000000n);
 await assert.rejects(harness({noSigner:true}).api.buyMarket(buy),{code:'CONNECT'});
});
test('malformed/subunit amounts and incompatible SDK protocol fail before spending',async()=>{
 for(const amountUsd of ['0','-1','2e3','0.0000001','Infinity']) {
   const h=harness();await assert.rejects(h.api.buyMarket({...buy,amountUsd}));assert.equal(h.posts.length,0);
 }
 const h=harness({version:1});await assert.rejects(h.api.buyMarket(buy),/Unsupported/);assert.equal(h.posts.length,0);
});
test('positions always follow selected account, not an old signed-in client',async()=>{
 const h=harness();await h.api.getClient();h.setAccount(other);assert.equal((await h.api.listPositions())[0].address,other);
});

test('CLOB proxy forwards authentication nonce and preserves real builder fee data',async()=>{
 const routes=fs.readFileSync(new URL('../src/market/routes.js',import.meta.url),'utf8');
 const start=routes.indexOf("  r.use('/clob',");
 const end=routes.indexOf('  // Data API proxy',start);
 let handler,request;
 vm.runInNewContext(routes.slice(start,end),{
  r:{use:(_path,h)=>{handler=h;}},
  axios:async options=>{request=options;return {status:200,data:{builder_maker_fee_rate_bps:0,builder_taker_fee_rate_bps:20}};},
 });
 const res={statusCode:0,body:null,status(n){this.statusCode=n;return this;},set(){return this;},send(data){this.body=data;},json(data){this.body=data;}};
 await handler({url:'/fees/builder-fees/test',method:'GET',headers:{poly_nonce:'0',poly_address:account,cookie:'private',authorization:'private'}},res);
 assert.equal(request.headers.poly_nonce,'0');assert.equal(request.headers.cookie,undefined);assert.equal(request.headers.authorization,undefined);
 assert.equal(res.body.builder_taker_fee_rate_bps,20);
});
