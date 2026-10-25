import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const src = readFileSync(new URL('../../frontend/public/grom-ai-launcher.js', import.meta.url), 'utf8');
function harness(reduced=false) {
  const buttons=[], timers=[], idle=[], listeners={}, docListeners={};
  let mutation, intersection, observed=new Set(), animationRemoved=0;
  const motion={matches:reduced,addEventListener:(_,fn)=>motion.change=fn};
  const document={readyState:'loading', hidden:false, body:{}, addEventListener:(k,f)=>docListeners[k]=f,
    querySelectorAll:s=>s.includes('animateTransform')?[{remove:()=>animationRemoved++}]:buttons.filter(b=>b.connected),
    createElement:()=>({paused:true, sources:false, plays:0, pauses:0, loads:0,
      setAttribute(){}, querySelector(){return this.sources?{}:null}, replaceChildren(){this.sources=false},
      set innerHTML(v){this.sources=v.includes('<source')}, load(){this.loads++},
      play(){this.paused=false;this.plays++;return Promise.resolve()}, pause(){this.paused=true;this.pauses++},
      get isConnected(){return this.parentElement?.connected},
    })};
  const window={matchMedia:()=>motion,innerHeight:844,innerWidth:390,requestIdleCallback:f=>idle.push(f),addEventListener:(k,f)=>listeners[k]=f};
  function IO(fn){intersection=fn;this.observe=v=>observed.add(v);this.unobserve=v=>observed.delete(v)}
  window.IntersectionObserver=IO;
  vm.runInNewContext(src,{window,document,IntersectionObserver:IO,Map,Array,
    MutationObserver:function(fn){mutation=fn;this.observe=()=>{}},setTimeout:f=>timers.push(f),requestAnimationFrame:f=>f(),
    getComputedStyle:b=>({visibility:b.visibility})});
  function button(){const b={nodeType:1,connected:true,visibility:'visible',firstChild:null,firstElementChild:null,video:null,
    classList:{contains:k=>k==='grom-ai-launcher',add(){}},querySelector:s=>s==='.gai-vid'?b.video:null,
    insertBefore(v){b.video=v;v.parentElement=b},getBoundingClientRect:()=>({width:44,height:44,top:20,bottom:64,left:320,right:364})};buttons.push(b);return b}
  const flush=()=>{while(timers.length)timers.shift()()};
  return {button,motion,document,timers,idle,listeners,docListeners,observed,flush,
    start(){listeners.load();idle.shift()()}, mutation:m=>mutation(m),visible:(b,on=true)=>intersection([{target:b.video,isIntersecting:on}]),
    removedAnimations:()=>animationRemoved};
}
test('deferred animation fetches only when visible and pauses for hidden route/background tab',()=>{
  const h=harness(), b=h.button(); assert.equal(b.video,null);h.start();
  assert.equal(b.video.sources,false);assert.equal(b.video.plays,0);h.visible(b);
  assert.equal(b.video.plays,1);assert.equal(b.video.muted,true);assert.equal(b.video.playsInline,true);
  b.visibility='hidden';h.listeners['grom:route-change']();assert.equal(b.video.paused,true);
  b.visibility='visible';h.listeners['grom:route-change']();assert.equal(b.video.paused,false);
  h.document.hidden=true;h.docListeners.visibilitychange();assert.equal(b.video.paused,true);
});
test('price text updates never scan launchers; SPA additions and replacements do',()=>{
  const h=harness(), b=h.button();h.start();
  h.mutation([{target:{nodeType:1,classList:{contains:()=>false}},addedNodes:[{nodeType:3}],removedNodes:[]}]);assert.equal(h.timers.length,0);
  const fresh=h.button();h.mutation([{target:{nodeType:1,classList:{contains:()=>false}},addedNodes:[fresh],removedNodes:[]}]);h.flush();assert.ok(fresh.video);
  const old=b.video;b.video=null;h.mutation([{target:b,addedNodes:[],removedNodes:[{nodeType:1,classList:{contains:()=>false}}]}]);
  // A detached video has no parent after a button's children are replaced.
  old.parentElement=null;h.flush();assert.notEqual(b.video,old);assert.equal(h.observed.has(old),false);
});
test('removed launchers are paused and released',()=>{
  const h=harness(), b=h.button();h.start();h.visible(b);b.connected=false;
  h.mutation([{target:{nodeType:1,classList:{contains:()=>false}},addedNodes:[],removedNodes:[b]}]);h.flush();
  assert.equal(b.video.paused,true);assert.equal(h.observed.size,0);
});
test('reduced motion keeps a poster with no media request, including preference changes',()=>{
  const h=harness(true), b=h.button();h.start();h.visible(b);
  assert.equal(b.video.sources,false);assert.equal(b.video.plays,0);assert.ok(h.removedAnimations()>0);
  h.motion.matches=false;h.motion.change();assert.equal(b.video.paused,false);
  h.motion.matches=true;h.motion.change();assert.equal(b.video.paused,true);assert.equal(b.video.sources,false);
});
