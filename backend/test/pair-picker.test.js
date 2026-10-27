import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('../../frontend/public/index.html',import.meta.url),'utf8');
function picker(){
 const els={};for(const id of ['btn','pop','inp','list'])els[id]={dataset:{},hidden:id==='pop',value:'',innerHTML:'',scrollTop:0,events:{},setAttribute(k,v){this[k]=v;},addEventListener(k,fn){this.events[k]=fn;},focus(){this.focused=true;}};
 const ctx={document:{getElementById:id=>els[id],querySelectorAll:s=>s.includes('btn')?[els.btn]:[els.pop],body:{classList:{toggle(){},remove(){}}}},window:{innerWidth:390,__gromDeskPairPickerWired:true},console,setTimeout:fn=>fn(),priceForPair:()=>12,marketFmt:String};
 vm.createContext(ctx);vm.runInContext(src.slice(src.indexOf('function initDeskPairPicker('),src.indexOf('function initSpotPairPicker(')),ctx);
 let selected;const options=Array.from({length:347},(_,i)=>'TOKEN'+i+'/USDC');
 ctx.initDeskPairPicker({btnId:'btn',popId:'pop',searchId:'inp',listId:'list',getOptions:()=>options,onSelect:s=>selected=s});
 const click=selector=>els.list.events.click({preventDefault(){},target:{closest:s=>s===selector?{}:null}});
 const count=()=> (els.list.innerHTML.match(/data-sym=/g)||[]).length;
 return {els,options,click,count,get selected(){return selected;}};
}
test('all catalog pairs are reachable in bounded batches and search includes the tail',()=>{
 const p=picker();assert.equal(p.count(),120);p.els.list.scrollTop=450;p.click('[data-pair-more]');assert.equal(p.count(),240);assert.equal(p.els.list.scrollTop,450);
 p.click('[data-pair-more]');assert.equal(p.count(),347);p.els.inp.value='TOKEN346';p.els.inp.events.input();assert.equal(p.count(),1);assert.match(p.els.list.innerHTML,/TOKEN346/);
 p.els.inp.value='missing';p.els.inp.events.input();assert.equal(p.count(),0);assert.match(p.els.list.innerHTML,/No matching markets/);
});
test('search shortcut focuses input and newly loaded venues appear in an open picker',()=>{
 const p=picker();p.click('[data-pair-search]');assert.equal(p.els.inp.focused,true);
 p.els.pop.hidden=false;p.els.inp.value='NEWCOIN';p.els.inp.events.input();assert.equal(p.count(),0);p.options.push('NEWCOIN/USDC');p.els.pop.events['grom:pairs-updated']();assert.equal(p.count(),1);assert.match(p.els.list.innerHTML,/NEWCOIN/);
});

test('opening and selecting a pair keeps expanded state synchronized',()=>{
 const p=picker();p.els.btn.events.click({preventDefault(){},stopPropagation(){}});assert.equal(p.els.btn['aria-expanded'],'true');
 p.els.list.events.click({target:{closest:s=>s==='.spot-pair-item[data-sym]'?{dataset:{sym:'TOKEN346/USDC'}}:null}});assert.equal(p.selected,'TOKEN346/USDC');assert.equal(p.els.btn['aria-expanded'],'false');assert.equal(p.els.pop.hidden,true);
});
