import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../../frontend/public/grom-wallet.js', import.meta.url), 'utf8');
function fn(name) {
  const at = source.indexOf(`function ${name}(`);
  assert.ok(at >= 0, name);
  return (source.slice(at - 6, at) === 'async ' ? 'async ' : '') + source.slice(at, source.indexOf('\n}', at) + 2);
}
const a = '0x' + '1'.repeat(40), b = '0x' + '2'.repeat(40);
function setup() {
  const elements = new Map();
  const ids = ['refCode','refLink','refStatus','refSignInBtn','refCopyBtn','refCopyLinkBtn','refShareXBtn','refShareTelegramBtn','refQr','refKpiTotalReferred','refKpiSignups30d','refKpiActive30d','refStatsStatus','refLinkRetry'];
  for (const id of ids) elements.set(id, { textContent: '', hidden: false, disabled: false, attrs: new Set(['data-i18n']), dataset: {}, classList: { add(){}, remove(){} }, removeAttribute(attr){ this.attrs.delete(attr); }, replaceChildren(){} });
  const storage = new Map([['grom_jwt', 'test-token']]);
  const calls = [];
  const ctx = vm.createContext({ window: { location: { origin: 'https://grom.exchange' } }, console, AbortController, URL, setTimeout, clearTimeout,
    address: a, owner: a, valid: true, gwReferralLoadId: 0, gwReferralSigning: false, gwReferralLinks: new Map(),
    localStorage: { getItem: key => storage.get(key) || null, setItem: (key,value) => storage.set(key,value), removeItem: key => storage.delete(key) },
    document: { getElementById: id => elements.get(id) || null },
    gwDisplayAddress: () => ctx.address, gwReadOnlyAddress: () => '', gwUxText: (ru) => ru,
    gwJwtPayload: () => ({ addr: ctx.owner }), gwJwtValid: () => ctx.valid && !!storage.get('grom_jwt'),
    setText: (id,text) => { if(elements.has(id)) elements.get(id).textContent = text; },
    gwFixReferralQR: () => calls.push('qr'),
    fetch: async () => ({ ok: true, status: 200, json: async () => ({ code: 'GROM-ABCDEFGHJK', totals: { total_referred: 7 }, funnel: { signups_30d: 2, active_30d: 3 } }) }),
    gwActiveSigningProvider: () => ctx.provider, provider: { request: async () => [a] },
    gwEnsureSigningForSwap: async () => { calls.push('connect'); ctx.provider = { request: async () => [a] }; },
    gwEnsureSignedIn: async opts => { calls.push(opts); storage.set('grom_jwt','new-token'); ctx.owner = ctx.address; return true; },
    gwToast() {},
  });
  vm.runInContext(['gwReferralAddress','gwReferralActions','gwSetReferralEmpty','gwRenderReferralIdentity','gwReferralStatsSignIn','hydrateReferralSlice'].map(fn).join('\n'),ctx);
  const start = source.indexOf('window.gwReferralSignIn = async function');
  vm.runInContext(source.slice(start,source.indexOf('\n};',start)+3),ctx);
  return { ctx, elements, storage, calls };
}
test('referrals show a connect action only when disconnected and disable sharing until issued identity exists', () => {
  const h=setup(); h.ctx.address=''; h.ctx.gwSetReferralEmpty();
  assert.equal(h.elements.get('refCode').textContent,'—');
  assert.equal(h.elements.get('refSignInBtn').hidden,false);
  for(const id of ['refCopyBtn','refCopyLinkBtn','refShareXBtn','refShareTelegramBtn']) assert.equal(h.elements.get(id).disabled,true);
  assert.equal(h.elements.get('refCode').attrs.has('data-i18n'),false);
});
test('public identity enables sharing, renders QR and survives language repaint', async () => {
  const h=setup(); await h.ctx.hydrateReferralSlice(true);
  assert.equal(h.elements.get('refCode').textContent,'GROM-ABCDEFGHJK');
  assert.equal(h.elements.get('refLink').textContent,'https://grom.exchange/r/ABCDEFGHJK');
  assert.equal(h.elements.get('refKpiTotalReferred').textContent,'7');
  assert.equal(h.elements.get('refSignInBtn').hidden,true);
  assert.equal(h.elements.get('refCopyLinkBtn').disabled,false);
  assert.equal(h.elements.get('refLink').attrs.has('data-i18n'),false);
  assert.deepEqual(h.calls,['qr']);
});
test('another wallet JWT never authenticates counts but public link still works', async () => {
  const h=setup(); h.ctx.owner=b; const requests=[];
  h.ctx.fetch=async(url,opts)=>{requests.push({url,opts});return {ok:true,json:async()=>({code:'GROM-ABCDEFGHJK'})};};
  await h.ctx.hydrateReferralSlice(true);
  assert.equal(requests.length,1); assert.match(requests[0].url,/referral\/link/);
  assert.equal(requests[0].opts.headers,undefined);
  assert.equal(h.elements.get('refCode').textContent,'GROM-ABCDEFGHJK');
  assert.equal(h.elements.get('refKpiTotalReferred').textContent,'—');
});
test('connected wallet without JWT gets link and QR without any wallet request',async()=>{
  const h=setup();h.storage.clear();h.ctx.valid=false;
  await h.ctx.hydrateReferralSlice(true);
  assert.equal(h.elements.get('refCode').textContent,'GROM-ABCDEFGHJK');
  assert.equal(h.elements.get('refCopyLinkBtn').disabled,false);
  assert.deepEqual(h.calls,['qr']);
  assert.equal(h.elements.get('refSignInBtn').textContent,'Открыть статистику');
});
test('late response cannot repaint referrals after wallet changes', async () => {
  const h=setup(); let resolve;
  h.ctx.fetch=()=>new Promise(yes=>{resolve=yes;});
  const pending=h.ctx.hydrateReferralSlice(true); h.ctx.address=b; h.ctx.gwSetReferralEmpty();
  resolve({ok:true,status:200,json:async()=>({code:'GROM-ABCDEFGHJK'})}); await pending;
  assert.equal(h.elements.get('refCode').textContent,'—'); assert.equal(h.calls.length,0);
});
test('expired auth and failed statistics preserve shareable public link', async () => {
  for(const status of [401,503]) {
    const h=setup(); h.ctx.fetch=async url=>url.includes('/link?')?{ok:true,json:async()=>({code:'GROM-ABCDEFGHJK'})}:{ok:false,status};
    await h.ctx.hydrateReferralSlice(true);
    assert.equal(h.elements.get('refSignInBtn').hidden,false);
    assert.equal(h.elements.get('refCopyBtn').disabled,false);
    assert.equal(h.storage.has('grom_jwt'),status!==401);
    assert.equal(h.elements.get('refKpiTotalReferred').textContent,'—');
  }
});
test('public link failure offers retry and never asks for signature',async()=>{
  const h=setup();h.storage.clear();h.ctx.fetch=async()=>({ok:false,status:503});
  await h.ctx.hydrateReferralSlice(true);
  assert.equal(h.elements.get('refLinkRetry').hidden,false);
  assert.equal(h.elements.get('refSignInBtn').hidden,true);
  assert.equal(h.elements.get('refCopyBtn').disabled,true);
  assert.deepEqual(h.calls,[]);
});
test('referral sign-in reuses live signer and requests remote SIWE without admin login', async () => {
  const h=setup(); await h.ctx.window.gwReferralSignIn();
  assert.equal(h.calls.includes('connect'),false);
  assert.equal(h.calls[0].allowRemoteSignature,true);
  assert.equal(h.elements.get('refCopyBtn').disabled,false);
});
test('missing signer recovers connection once before signing; duplicate clicks do not sign twice', async () => {
  const h=setup(); h.storage.clear(); h.ctx.provider=null;
  let release; h.ctx.gwEnsureSigningForSwap=()=>new Promise(yes=>{release=()=>{h.ctx.provider={request:async()=>[a]};yes();}; h.calls.push('connect');});
  const pending=h.ctx.window.gwReferralSignIn();
  assert.equal(await h.ctx.window.gwReferralSignIn(),false); release(); await pending;
  assert.equal(h.calls.filter(x=>x==='connect').length,1);
  assert.equal(h.calls.filter(x=>x?.allowRemoteSignature).length,1);
});
test('ordinary connected WC uses direct SIWE only for the explicit referral opt-in', async () => {
  const calls=[]; const provider={request:async()=>[a]};
  const ctx=vm.createContext({window:{gromWallet:{signSiweAndVerify:async(...args)=>{calls.push(args);ctx.authed=true;}},dispatchEvent(){},boffStartDeviceLogin:async()=>{calls.push('admin');}},
    authed:false,gwJwtValid:()=>ctx.authed,gwActiveSigningProvider:()=>provider,gwAddrOk:()=>true,gwIsRemoteWcSigner:()=>true,
    CustomEvent:class{},gwToast(){},console});
  vm.runInContext(fn('gwEnsureSignedIn'),ctx);
  assert.equal(await ctx.gwEnsureSignedIn({allowRemoteSignature:true}),true);
  assert.equal(calls[0][0],a); assert.equal(calls[0][1],provider); assert.equal(calls[0][2].allowRemoteSignature,true);
  assert.equal(calls.includes('admin'),false);
});
test('remote referral login sends only SIWE through existing session, verifies signature, and stores JWT',async()=>{
 const storage=new Map(),requests=[],wake=[];let owner=a;
 const ctx=vm.createContext({window:{location:{origin:'https://grom.exchange'}},console,Date,URL,setTimeout,clearTimeout,currentChainId:42161,
 localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
 gwIsRemoteWcSigner:()=>true,gwDisplayAddress:()=>owner,gwAlignWcProviderChain:async()=>{},walletAppOrigin:()=> 'https://grom.exchange',
 gwProviderRequestWithWake:async(p,request,opts)=>{wake.push({p,request,opts});return '0xsignature';},gromReferralPayload:()=>({}),gwNotifyWalletConnected(){},gwHideSessionSyncBanner(){},gwHideRemoteSignCoach(){},
 fetch:async(url,opts)=>{requests.push({url,opts});return {ok:true,json:async()=>url==='/auth/nonce'?{nonce:'abcdef1234',domain:'grom.exchange',version:'1'}:{token:'verified-jwt'}};},
 });vm.runInContext(fn('authenticateWithSIWE'),ctx);const provider={request:async()=> '0xa4b1'};
 await ctx.authenticateWithSIWE(a,provider,{allowRemoteSignature:true});
 assert.equal(wake.length,1);assert.equal(wake[0].p,provider);assert.equal(wake[0].request.method,'personal_sign');assert.equal(wake[0].opts.authOnly,true);
 assert.match(wake[0].request.params[0],/grom.exchange wants you to sign in/);assert.equal(JSON.parse(requests[1].opts.body).signature,'0xsignature');assert.equal(storage.get('grom_jwt'),'verified-jwt');
 storage.clear();ctx.gwProviderRequestWithWake=async()=>{owner=b;return '0xsignature';};
 await assert.rejects(ctx.authenticateWithSIWE(a,provider,{allowRemoteSignature:true}),/Wallet changed/);assert.equal(storage.has('grom_jwt'),false);
});


test('returning to referrals reuses only the wallet-scoped public link cache',async()=>{
 const h=setup();h.storage.clear();let requests=0;
 h.ctx.fetch=async()=>{requests++;return {ok:true,json:async()=>({code:requests===1?'GROM-ABCDEFGHJK':'GROM-KJHGFEDCBA'})};};
 await h.ctx.hydrateReferralSlice(true);await h.ctx.hydrateReferralSlice(true);
 assert.equal(requests,1);assert.equal(h.elements.get('refCode').textContent,'GROM-ABCDEFGHJK');
 h.ctx.address=b;await h.ctx.hydrateReferralSlice(true);
 assert.equal(requests,2);assert.equal(h.elements.get('refCode').textContent,'GROM-KJHGFEDCBA');
 assert.equal(h.elements.get('refKpiTotalReferred').textContent,'—');
});
