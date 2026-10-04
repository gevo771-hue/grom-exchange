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
const landingV2=fs.readFileSync(path.join(here,'../../frontend/public/landing-v2.js'),'utf8');
const i18n=fs.readFileSync(path.join(here,'../../frontend/public/grom-i18n.js'),'utf8');
const i18nExtra=fs.readFileSync(path.join(here,'../../frontend/public/grom-i18n-extra.js'),'utf8');
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
test('futures funding controls are not hijacked by a fake spot-success handler',()=>{
 assert.doesNotMatch(landingHtml,/function wireSpot\(\)|0\.00500 BTC submitted/);
 assert.doesNotMatch(landingHtml,/queued \(offline\)/);
 assert.match(landingHtml,/window\.submitFuturesOrder = async function \(side\)/);
 assert.match(landingHtml,/if \(resp && resp\.order\)[\s\S]{0,500}Futures service unavailable — no order was placed/);
 assert.match(landingHtml,/function updateFuturesBoard\(\)[\s\S]{0,180}window\.__gromHlActive[\s\S]{0,180}gromHlPriceForPair\(futDeskState\.pair, null, isTradeSpot\(\) \? 'spot' : 'perp'\)/);
 assert.match(landingHtml,/function futDeskMidPx\(\)[\s\S]{0,220}gromHlPriceForPair\(pair, null, isTradeSpot\(\) \? 'spot' : 'perp'\)/);
 assert.match(landingHtml,/id="hlFundPerpBtn"[^>]*>Fund Perp/);
 assert.match(landingHtml,/id="hlFundSpotBtn"[^>]*>Fund Spot/);
});
test('referral access explains and explicitly starts wallet-message sign-in',()=>{
 assert.match(landingHtml,/id="refSignInBtn"[^>]*onclick="gwReferralSignIn\(\)"/);
 assert.match(walletSrc,/window\.addEventListener\('grom:wallet-connected',[\s\S]{0,150}hydrateReferralSlice\(true\)/);
 assert.match(walletSrc,/window\.gwReferralSignIn = async function[\s\S]{0,1800}gwEnsureSignedIn\(/);
 assert.match(walletSrc,/No transaction will be sent/);
});
test('landing removes the retired explainer sections and keeps active landing content',()=>{
 assert.doesNotMatch(landingHtml,/class="lp-products"/);
 for(const marker of ['class="lp-why"','class="lp-how"'])assert.doesNotMatch(landingHtml,new RegExp(marker));
 for(const marker of ['class="lp-hero"','id="lpPredictSec"','class="lp-security"','class="lp-final-cta"','id="lpSeoPrimaryWrap"','id="lpSeoMultilangWrap"'])assert.match(landingHtml,new RegExp(marker));
 assert.doesNotMatch(landingCss,/\.lp-products\s*\{\s*display:\s*none/);
 assert.doesNotMatch(landingCss,/\.lp-(?:why|how)\s*\{\s*display:\s*none/);
});

test('landing never fabricates recent trading activity',()=>{
 assert.doesNotMatch(landingV2,/function buildTickerItems|function mountTicker/);
 assert.doesNotMatch(landingV2,/0,5 ETH →|BTC-PERP .* ×3|USDT → USDC · Arbitrum|Live activity/);
 assert.doesNotMatch(landingV2,/mountTicker\(_live\)/);
 assert.match(landingV2,/function removePreview\(\)[\s\S]*?#landing-v2-ticker, \.lv2-ticker-wrap/);
});

test('referral UI does not promise inactive payouts or commission rates',()=>{
 const copy=[landingHtml,i18n,i18nExtra].join('\n');
 for(const claim of ['Up to 50%','До 50%','Hasta 50%','最高 50%','50% तक','%50\\\'ye kadar','You automatically receive 50% of our 0.20% fee — forever','50% от нашей 0.20% комиссии автоматически идёт тебе — навсегда','paid daily 00:00 UTC','Share your link — when friends swap on-chain, you earn a share of fees. Payouts are on-chain weekly.'])assert.equal(copy.includes(claim),false,claim);
 assert.doesNotMatch(copy,/50\/50|ref_tag:[^\n]*(?:50\s*%|%\s*50)|automatically receive.*fee|автоматически идёт тебе/i);
 assert.match(landingHtml,/New wallet signups are counted once; rewards and payouts are not enabled/);
 assert.match(landingHtml,/Existing accounts are never reassigned/);
 assert.doesNotMatch(landingHtml,/Your earnings|Total earned|Pending payout/);
});

test('referral invite identity is generated and attributed by the authenticated backend',()=>{
 assert.match(walletSrc,/fetch\('\/api\/referral\/summary'/);
 assert.match(walletSrc,/Date\.now\(\) - capturedAt > 30 \* 24 \* 60 \* 60 \* 1000/);
 assert.doesNotMatch(walletSrc,/function gwInviteCodeFromSeed|function gwApplyLocalInviteIdentity/);
 assert.match(landingHtml,/id="refKpiSignups30d"/);
 assert.match(landingHtml,/rememberReferral\(m\[1\]\)/);
});
