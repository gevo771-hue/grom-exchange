import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../../frontend/public/grom-wallet.js', import.meta.url), 'utf8');
test('portfolio stays absent while disconnected, appears on connection and clears on disconnect', () => {
  const nodes = new Map();
  const slot = { hidden:false, appendChild(node) { nodes.set(node.id, node); } };
  let connected = false;
  const context = {
    document: { getElementById:id=>nodes.get(id), createElement:()=>({remove(){nodes.delete(this.id);}}) },
    gwMpDexEnsureSlot:()=>slot, gwMpDexConnected:()=>connected,
    gwInjectMetaPortfolioCss(){}, gwDashReconcileOrder(){},
    gwMpDexLang:()=>({}), gwMpDexFmt:n=>String(n),
  };
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('function gwMpDexZero()'), source.indexOf('function gwMpDexConnected()')), context);
  vm.runInContext(source.slice(source.indexOf('function gwMpDexPaint('), source.indexOf('function gwSyncDashboardStatCards(')), context);
  context.gwMpDexPaint(null,false);
  assert.equal(slot.hidden,true);assert.equal(nodes.size,0);
  connected=true;context.gwMpDexPaint(null,true);
  assert.equal(slot.hidden,false);assert.ok(nodes.get('gwMetaPortfolio').innerHTML.includes('gw-mp-loading'));
  context.gwMpDexPaint({...context.gwMpDexZero(),total:123},false);
  assert.ok(nodes.get('gwMetaPortfolio').innerHTML.includes('123'));
  connected=false;context.gwMpDexPaint(null,false);
  assert.equal(slot.hidden,true);assert.equal(nodes.size,0);
  // A late in-flight balance response must not bring the old card back.
  context.gwMpDexPaint({...context.gwMpDexZero(),total:123},false);
  assert.equal(slot.hidden,true);assert.equal(nodes.size,0);
});
