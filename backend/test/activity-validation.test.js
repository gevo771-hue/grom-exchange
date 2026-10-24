import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import createActivityRouter from '../src/activity/routes.js';

test('patched Zod preserves activity detail records and rejects invalid request shapes', async t => {
  const app=express();
  app.use(express.json({limit:'256kb'}));
  app.use(createActivityRouter({requireAuth:(_req,_res,next)=>next()}));
  app.use((err,_req,res,_next)=>res.status(err.name==='ZodError'?400:500).json({error:err.name}));
  const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const post=async(path,body)=>{
    const response=await fetch('http://127.0.0.1:'+server.address().port+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
    return {status:response.status,body:await response.json()};
  };
  const ok=await post('/issue',{product:'system',action:'ui_lag',detail:{ms:100,nested:{sample:true}}});
  assert.equal(ok.status,200);assert.equal(ok.body.ignored,'mild_ui_lag');
  // Valid record reaches auth, not a Zod 4 record-signature exception.
  assert.equal((await post('/log',{product:'swap',action:'preview',detail:{amount:1,nested:{sample:true}}})).status,401);
  for(const path of ['/issue','/log']) {
    for(const detail of [[],null,'bad']) assert.equal((await post(path,{product:'system',action:'ui_lag',detail})).status,400);
    assert.equal((await post(path,{product:'unknown',action:'ui_lag'})).status,400);
    assert.equal((await post(path,{product:'system',action:'ui_lag',unexpected:true})).status,400);
  }
  assert.equal((await post('/view',{page:'admin'})).body.ignored,'admin_page');
  assert.equal((await post('/view',{page:123})).status,400);
});
