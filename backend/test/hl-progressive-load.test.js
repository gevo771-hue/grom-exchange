import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../../frontend/public/grom-hyperliquid.js',import.meta.url),'utf8');
const part=source.slice(source.indexOf('  function paintPublicQuotes()'),source.indexOf('  /** Sequential HIP-3 load:'));
test('main public quotes publish before venue discovery resolves without activating trading',async()=>{
  let discover,mainCalls=0,paints=0,deskPaints=0,boardPaints=0;
  const c={window:{renderMarketsEnhanced(){paints++;},renderFuturesList(q){assert.equal(q,'BTC');deskPaints++;},updateFuturesBoard(){boardPaints++;},futDeskState:{}},document:{querySelector:()=>({value:'BTC'}),getElementById:()=>({classList:{contains:()=>true}})},Map,console,
    hlInfo:async(body)=>{if(body.type==='perpDexs')return new Promise(resolve=>{discover=resolve;});mainCalls++;return [{universe:[{name:'BTC'}]},[{midPx:'100'}]];},
    ingestUniverse(_u,_c,_n,_i,map,markets,mids,ctx){map.set('BTC',{id:0});markets.push({coin:'BTC'});mids.BTC=100;ctx.BTC={prevDayPx:80};},loadHip3Dexes:async()=>{},scheduleHip3Backfill(){}};
  vm.createContext(c);vm.runInContext('let _meta=null,_metaInflight=null;'+part,c);
  const first=c.ensureMeta(true),second=c.ensureMeta(true);
  for(let i=0;i<4;i++)await Promise.resolve();
  assert.equal(mainCalls,1);assert.equal(c.window.__gromHlQuotesReady,true);assert.equal(c.window.__hlMids.BTC,100);
  assert.equal(c.window.__gromHlActive,undefined);assert.equal(paints,1);assert.equal(deskPaints,1);assert.equal(boardPaints,1);
  discover([null]);await Promise.all([first,second]);
});
