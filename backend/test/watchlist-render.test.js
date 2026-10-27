import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('../../frontend/public/index.html',import.meta.url),'utf8');
const patch=vm.runInNewContext(src.slice(src.indexOf('function patchFuturesListRows('),src.indexOf('function renderFuturesList('))+';patchFuturesListRows');
class Node {
  constructor(){this.dataset={};this.children=[];this.className='';this.textContent='';}
  appendChild(n){return this.insertBefore(n,null);}
  insertBefore(n,b){if(n.parentNode)n.remove();const i=b?this.children.indexOf(b):this.children.length;assert.ok(i>=0);this.children.splice(i,0,n);n.parentNode=this;return n;}
  remove(){if(this.parentNode){const a=this.parentNode.children;a.splice(a.indexOf(this),1);this.parentNode=null;}}
  get firstElementChild(){return this.children[0]||null;}
  get nextElementSibling(){const a=this.parentNode?.children||[];return a[a.indexOf(this)+1]||null;}
  querySelectorAll(s){return this.children.filter(n=>s.includes('data-pair')?n.dataset.pair:n.className==='wl-empty');}
}
function host(pairs){const h=new Node();h.ownerDocument={createElement:()=>new Node()};h.scrollTop=200;pairs.forEach(p=>{const n=new Node();n.dataset.pair=p;for(let i=0;i<4;i++)n.appendChild(new Node());h.appendChild(n);});return h;}
function update(pair,price='$123'){return {pair,coin:pair,active:pair==='BTC',cells:[{cls:'nm',text:pair},{cls:'chg down',text:'-2.00%'},{cls:'px mono',text:price},{cls:'pay fut-max-lev',text:'40×'}]};}
test('quote updates preserve row/cell identity and avoid unchanged text writes',()=>{
 const h=host(['BTC']),node=h.children[0],cell=node.children[2];patch(h,[update('BTC')]);
 assert.equal(h.scrollTop,200);assert.equal(h.children[0],node);assert.equal(node.children[2],cell);assert.equal(cell.textContent,'$123');
 Object.defineProperty(cell,'textContent',{get:()=>'$123',set:()=>assert.fail('unchanged price mutated')});patch(h,[update('BTC')]);
});
test('new venues and reordering retain existing rows and their own prices',()=>{
 const h=host(['BTC','ETH']);const [btc,eth]=h.children;patch(h,[update('ETH','$2'),update('SP500','$3'),update('BTC','$1')]);
 assert.equal(h.children[0],eth);assert.equal(h.children[2],btc);assert.deepEqual(h.children.map(n=>n.children[2].textContent),['$2','$3','$1']);
 const sp=h.children[1];patch(h,[update('SP500','$4'),update('BTC','$5')]);assert.equal(h.children[0],sp);assert.equal(h.children[1],btc);assert.equal(eth.parentNode,null);
});
test('loading row is removed once live markets arrive, without wiping existing rows',()=>{
 const h=host([]);const loading=new Node();loading.className='wl-empty';h.appendChild(loading);patch(h,[update('BTC')]);assert.equal(h.children.length,1);assert.equal(h.children[0].dataset.pair,'BTC');
});
