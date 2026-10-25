import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('../../frontend/public/index.html',import.meta.url),'utf8');
const patch=vm.runInNewContext(src.slice(src.indexOf('function patchFuturesListRows('),src.indexOf('function renderFuturesList('))+';patchFuturesListRows');
function row(pair){return {dataset:{pair,coin:pair},className:'wl-item',children:['nm','chg up','px mono','pay fut-max-lev'].map(cls=>({className:cls,textContent:'old'}))}}
function update(pair){return {pair,coin:pair,active:true,cells:[{cls:'nm',text:pair},{cls:'chg down',text:'-2.00%'},{cls:'px mono',text:'$123'},{cls:'pay fut-max-lev',text:'40×'}]}}
test('quote updates keep row/cell identity and scroll, replacing only changed text',()=>{
  const node=row('BTC'),cell=node.children[2],host={scrollTop:200,querySelectorAll:()=>[node]};
  assert.equal(patch(host,[update('BTC')]),true);assert.equal(host.scrollTop,200);assert.equal(node.children[2],cell);
  assert.equal(cell.textContent,'$123');assert.equal(node.children[1].className,'chg down');assert.equal(node.className,'wl-item active');
  Object.defineProperty(cell,'textContent',{get:()=>'$123',set:()=>assert.fail('Unchanged quote must not mutate DOM')});
  assert.equal(patch(host,[update('BTC')]),true);
});
test('different row ordering/count rebuilds instead of assigning prices to the wrong symbol',()=>{
  const a=row('BTC'),b=row('ETH'),host={querySelectorAll:()=>[a,b]};
  assert.equal(patch(host,[update('ETH'),update('BTC')]),false);assert.equal(a.children[2].textContent,'old');
  assert.equal(patch(host,[update('BTC')]),false);
});
