import test from 'node:test';
import assert from 'node:assert/strict';
import { createEarnRouter, earnFeeConfirmed } from '../src/earn/routes.js';
import { validateEarnQuote, submitEarnOrder } from '../../frontend/public/grom-earn-order.js';
import express from 'express';

const owner='0x'+'1'.repeat(40), pay='0x'+'2'.repeat(40), vault='0x'+'3'.repeat(40), router='0x'+'4'.repeat(40);
const order={side:'deposit',account:owner,chain:8453,address:vault,payChain:42161,payToken:pay,amount:'1.000001'};
function sample(){
  const input={chainId:42161,address:pay,decimals:6,symbol:'USDC'},output={chainId:8453,address:vault,decimals:18,symbol:'SHARE'};
  return {input,output,feeBps:20,expiresAt:Date.now()+30000,lifi:{
    action:{fromChainId:42161,toChainId:8453,fromToken:input,toToken:output,fromAddress:owner,toAddress:owner,fromAmount:'1000001'},
    estimate:{toAmountMin:'9750000',approvalAddress:router},transactionRequest:{to:router,from:owner,data:'0x12345678',value:'0',chainId:42161},
  }};
}
test('Earn review binds both assets, exact units, chain, recipient, minimum and expiry',()=>{
  assert.equal(validateEarnQuote(order,sample()),1000001n);
  for(const change of [q=>q.lifi.action.toAddress=pay,q=>q.lifi.action.toToken={...q.output,address:pay},q=>q.lifi.action.fromAmount='1000000',
    q=>q.expiresAt=Date.now()-1,q=>q.lifi.transactionRequest.chainId=1,q=>q.lifi.estimate.toAmountMin='9749999',q=>q.lifi.transactionRequest.value='1']){
    const changed=sample();change(changed);assert.throws(()=>validateEarnQuote(order,changed,sample()));
  }
});
function transport(){
  const calls=[];
  const p={request:async({method})=>method==='eth_accounts'?[owner]:'0xa4b1'};
  return {calls,p,wallet:{provider:()=>p,switchChain:async()=>{},allowance:async()=>0n,
    approve:async(p,asset,spender,account,chain,n,verify)=>{await verify();calls.push(['approve',asset,spender,n]);},checkValue:()=>{},
    send:async(p,tx,time,chain,opts)=>{await opts.verify();calls.push(['send',tx]);return '0x'+'a'.repeat(64);}}};
}
test('Earn mock wallet approves only the exact input and uses the refreshed calldata',async()=>{
  const {wallet,calls}=transport();let refreshes=0;
  await submitEarnOrder(order,sample(),wallet,async()=>{const q=sample();q.lifi.transactionRequest.data=++refreshes===2?'0xaabbccdd':'0x12345678';return q;},()=>true);
  assert.deepEqual(calls[0],['approve',pay,router,1000001n]);assert.equal(calls[1][1].data,'0xaabbccdd');
});
test('Changed spender, signer, or worse terms after approval never dispatch a deposit',async()=>{
  for(const issue of ['spender','account','minimum','left']){
    const {wallet,p,calls}=transport();let count=0,active=true;
    await assert.rejects(submitEarnOrder(order,sample(),wallet,async()=>{const q=sample();if(++count===2){
      if(issue==='spender')q.lifi.estimate.approvalAddress=owner;
      if(issue==='account')p.request=async({method})=>method==='eth_accounts'?[pay]:'0xa4b1';
      if(issue==='minimum')q.lifi.estimate.toAmountMin='1';
      if(issue==='left')active=false;
    }return q;},()=>active));
    assert.equal(calls.some(c=>c[0]==='send'),false,issue);
  }
});
test('Earn fee must pay GROM 20 bps, not the entire vendor fee or a different integrator',()=>{
  const split={name:'grom-exchange',fee:'2000'}, fee={token:{address:pay},feeSplit:{recipients:[{name:'lifi',fee:'2500'},split]}};
  const q={context:{fromAmount:'1000001'},lifi:{estimate:{feeCosts:[fee]}}};
  assert.equal(earnFeeConfirmed(q,pay),true);split.name='else';assert.equal(earnFeeConfirmed(q,pay),false);split.name='grom-exchange';split.fee='4500';assert.equal(earnFeeConfirmed(q,pay),false);
});
test('Earn proxy pins the upstream, isolates positions and filters, and disallows withdrawals from nonredeemable vaults',async()=>{
  const hits=[];const app=express();app.use(express.json());
  const v={chainId:8453,address:vault,isTransactional:true,isRedeemable:false,underlyingTokens:[{address:pay}]};
  app.use('/earn',createEarnRouter({apiKey:'test',fetchImpl:async(url,opt)=>{
    assert.equal(opt.redirect,'error');assert.equal(opt.headers['x-lifi-api-key'],'test');hits.push(url);
    if(url.includes('/portfolio/'))return Response.json({positions:[]});
    if(url.includes('/vaults?'))return Response.json({data:[v,{...v,isTransactional:false}]});
    return Response.json(v);
  },quote:()=>assert.fail('withdrawal may not be quoted')}));
  const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));try{
    const base='http://127.0.0.1:'+server.address().port+'/earn/';
    for(let i=0;i<2;i++)assert.equal((await(await fetch(base+'vaults?asset=USDC')).json()).data.length,1);
    assert.equal(hits.length,1);assert.match(hits[0],/^https:\/\/earn\.li\.fi\/v1\/vaults\?/);
    assert.equal((await fetch(base+'vaults?url=https://invalid.test')).status,400);
    for(let i=0;i<2;i++)assert.equal((await fetch(base+'portfolio/'+owner+'/positions')).headers.get('cache-control'),'private, no-store');
    assert.equal(hits.length,3);
    const res=await fetch(base+'quote',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...order,side:'withdraw',payChain:8453})});
    assert.equal(res.status,400);
  }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});
