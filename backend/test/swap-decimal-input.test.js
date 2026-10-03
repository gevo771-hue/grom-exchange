import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const core=require('../../frontend/public/grom-swap-core.js');
const src=fs.readFileSync(new URL('../../frontend/public/grom-wallet.js',import.meta.url),'utf8');
function harness(raw) {
 let draft=raw;
 const input={selectionStart:raw.length,selectionEnd:raw.length};
 Object.defineProperty(input,'value',{get:()=>draft,set:()=>{throw new Error('amount reader must not rewrite the draft');}});
 const context={window:{GromSwapCore:core},document:{getElementById:id=>id==='gwDsAmt'?input:null}};
 vm.createContext(context);
 const start=src.indexOf('function gwDsCanonicalAmtStr(');
 const end=src.indexOf('\ntry {\n  window.gwDsCanonicalAmtStr',start);
 vm.runInContext(src.slice(start,end),context);
 return {context,input};
}
test('quote and CTA readers preserve fractional typing drafts and the cursor',()=>{
 for(const raw of ['0','0.','0.0','0.00','0.0005','0,','0,00','0,0005']) {
  const {context,input}=harness(raw);
  const expected=core.canonicalAmountString(raw);
  for(let tick=0;tick<3;tick++) {
   assert.equal(context.gwDsReadSwapAmtStr(),expected);
   assert.equal(context.gwDsReadSwapAmt(),Number(expected)||0);
  }
  assert.equal(input.value,raw);
  assert.equal(input.selectionStart,raw.length);
 }
});
test('quote input preserves exact wei precision and rejects invalid drafts without clearing them',()=>{
 for(const raw of ['0.000000000000000001','1.000000000000000001','1e-8','-1','bad']) {
  const {context,input}=harness(raw);
  assert.equal(context.gwDsReadSwapAmtStr(),core.canonicalAmountString(raw));
  assert.equal(input.value,raw);
 }
});
test('simple input synchronizes raw fractional drafts without a Number round trip',()=>{
 const begin=src.indexOf("    simAmt.addEventListener('input', () => {");
 const end=src.indexOf("    dsAmt.addEventListener('input'",begin);
 assert.ok(begin>0&&end>begin);
 for(const raw of ['0.0','0,0005','0.000000000000000001','1.000000000000000001']) {
  let listener;
  const simAmt={value:raw,addEventListener:(_name,fn)=>{listener=fn;}};
  const dsAmt={value:''};
  let refreshed=0;
  const context={simAmt,dsAmt,gwDsQuoteTimer:null,setTimeout:fn=>{fn();return 1;},clearTimeout(){},gwDsRefreshRate:()=>{refreshed++;}};
  vm.createContext(context);vm.runInContext(src.slice(begin,end),context);listener();
  assert.equal(simAmt.value,raw);assert.equal(dsAmt.value,raw);assert.equal(refreshed,1);
 }
});
