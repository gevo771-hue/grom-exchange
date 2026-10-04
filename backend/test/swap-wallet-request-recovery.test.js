import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../../frontend/public/grom-wallet.js',import.meta.url),'utf8');
const code=source.slice(source.indexOf('function gwUxCanDismissWalletRequest('),source.indexOf('function gwUxProgress('));
function harness(op){const c={op,clears:[],resets:0,window:{confirm:()=>true},gwUxText:r=>r,gwSwapOpGet:()=>c.op,gwSwapOpClear:s=>{c.clears.push(s);c.op=null;},gwDsSubmit:{_busy:true},gwDsResetSubmitState:()=>c.resets++};vm.createContext(c);vm.runInContext(code,c);return c;}
const old=()=>({id:'old',stage:'unknown',restoredFromStorage:true,walletResultUnknown:true});
test('restored rejected request clears only after user confirmation',()=>{const c=harness(old());assert.equal(c.gwUxDismissWalletRequest('old'),true);assert.equal(c.op,null);assert.equal(c.gwDsSubmit._busy,false);assert.equal(c.resets,1);assert.deepEqual(c.clears,['cancelled']);});
test('declining cancellation leaves the request locked',()=>{const c=harness(old());c.window.confirm=()=>false;assert.equal(c.gwUxDismissWalletRequest('old'),false);assert.equal(c.clears.length,0);assert.equal(c.gwDsSubmit._busy,true);});
test('submitted transactions and approvals cannot be cleared manually',()=>{for(const patch of [{hash:'0xtx'},{signature:'sig'},{boc:'boc'},{approvalHash:'0xapproval'},{approvalPending:true},{restoredFromStorage:false},{stage:'awaiting_signature'},{stage:'bridging'}]){const c=harness({...old(),...patch});c.window.confirm=()=>{throw Error('must not prompt');};assert.equal(c.gwUxDismissWalletRequest('old'),false);assert.equal(c.clears.length,0);}});
test('late hash or another operation during confirmation cannot be cleared',()=>{for(const patch of [{hash:'0xlate'},{id:'new'}]){const c=harness(old());c.window.confirm=()=>{c.op={...c.op,...patch};return true;};assert.equal(c.gwUxDismissWalletRequest('old'),false);assert.equal(c.clears.length,0);}});
