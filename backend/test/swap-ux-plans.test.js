import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
const c=require('../../frontend/public/grom-swap-core.js');
const here=path.dirname(fileURLToPath(import.meta.url));
const walletSrc=fs.readFileSync(path.join(here,'../../frontend/public/grom-wallet.js'),'utf8');
const landingHtml=fs.readFileSync(path.join(here,'../../frontend/public/index.html'),'utf8');
const landingCss=fs.readFileSync(path.join(here,'../../frontend/public/landing-v2.css'),'utf8');
const ctx={amount:'1',connected:true,ready:true,pairValid:true};
test('CTA gives an action for empty, disconnected, loading, stale and ready states',()=>{
 assert.equal(c.swapCtaModel({...ctx,amount:'',ready:false}).key,'amount');
 assert.equal(c.swapCtaModel({...ctx,connected:false}).action,'connect');
 assert.equal(c.swapCtaModel({...ctx,ready:false}).key,'loading');
 assert.equal(c.swapCtaModel({...ctx,ready:false,error:'Quote expired'}).action,'refresh');
 assert.equal(c.swapCtaModel(ctx).action,'swap');
 assert.equal(c.swapCtaModel({...ctx,busy:true}).enabled,false);
 assert.equal(c.swapCtaModel({...ctx,active:true,stage:'unknown'}).enabled,false);
});
const order={id:'o1',account:'A',type:'dca',from:'USDC',to:'ETH',amt:'1.0',fromChainId:1,toChainId:1,fromAddress:'a',toAddress:'b',interval:1000,executed:0,state:'review'};
const op={orderId:'o1',id:'tx1',account:'A',from:'USDC',to:'ETH',amt:'1',stage:'submitted',hash:'0x1'};
test('DCA only counts confirmed completion, never submission, failure or unknown',()=>{
 for(const stage of ['submitted','awaiting_signature','failed','cancelled','unknown','bridging','partial','refunded']){
 const n=c.orderTransition(order,{...op,stage},100);
 assert.equal(n.executed,0,stage);
 }
 const n=c.orderTransition(order,{...op,stage:'completed'},100);
 assert.equal(n.executed,1);assert.equal(n.state,'active');assert.equal(n.nextAt,1100);
 assert.equal(c.orderTransition(n,{...op,stage:'completed'},200).executed,1);
});
test('stale op, wrong account, pair and amount cannot settle an order',()=>{
 for(const patch of [{account:'B'},{to:'DAI'},{amt:'2'},{orderId:'other'}])assert.equal(c.orderTransition(order,{...op,...patch,stage:'completed'},100),order);
 const pending={...order,opId:'new-tx'};assert.equal(c.orderTransition(pending,{...op,stage:'completed'},100),pending);
});
test('limit order remains submitted until completion and cannot count terminal twice',()=>{
 const o={...order,type:'limit'};const submitted=c.orderTransition(o,op,100);assert.equal(submitted.state,'submitted');
 const filled=c.orderTransition(submitted,{...op,stage:'completed'},200);assert.equal(filled.state,'filled');assert.equal(filled.executed,1);
 assert.equal(c.orderTransition(filled,{...op,stage:'failed'},300).state,'filled');
});
test('order binding compares chain, contract, wallet and exact decimal amount',()=>{
 assert.equal(c.boundOrderMatches(order,{...order,amt:'1'}),true);
 for(const key of ['account','fromChainId','toChainId','fromAddress','toAddress','from','to','amt'])assert.equal(c.boundOrderMatches(order,{...order,[key]:'other'}),false,key);
});
test('limit checks use minimum output and exact integers, including beyond JS safe integers',()=>{
 const o={type:'limit',amt:'9007199254740993',price:'1'};
 assert.equal(c.orderQuoteMeetsLimit(o,'9007199254740993000000',6),true);
 assert.equal(c.orderQuoteMeetsLimit(o,'9007199254740992999999',6),false);
 assert.equal(c.orderQuoteMeetsLimit(o,undefined,6),false);
 assert.equal(c.orderQuoteMeetsLimit({type:'limit',amt:'10',price:'0.2'},'1999999',6),false);
 assert.equal(c.orderQuoteMeetsLimit({type:'limit',amt:'10',price:'0.2'},'2000000',6),true);
});
test('Swap, Limit and DCA share the Instant Swap card and fee is not painted',()=>{
 assert.match(walletSrc,/id='gwSwapModeTabs'|id="gwSwapModeTabs"/);
 assert.doesNotMatch(walletSrc,/data-mode="advanced"|data-mode="simple"/);
 assert.match(walletSrc,/route\.before\(panel\)/);
 assert.doesNotMatch(walletSrc,/gwUxDetails\([^)]*feeLabel/);
 assert.doesNotMatch(walletSrc,/\$\{t\.fee\}<\/span><span class="v">/);
});
test('landing keeps the active sections as siblings and removes retired product cards',()=>{
 assert.doesNotMatch(landingHtml,/class="lp-products"/);
 for(const marker of ['class="lp-why"','class="lp-how"','class="lp-security"','id="lpSeoPrimaryWrap"','id="lpSeoMultilangWrap"'])assert.match(landingHtml,new RegExp(marker));
 assert.match(landingHtml,/lp_why_c5_p[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*<!-- HOW IT WORKS -->/);
 assert.doesNotMatch(landingCss,/\.lp-products\s*\{\s*display:\s*none/);
 assert.doesNotMatch(landingCss,/\.lp-(?:why|how)\s*\{\s*display:\s*none/);
});
