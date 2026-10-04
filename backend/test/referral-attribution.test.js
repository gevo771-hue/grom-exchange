import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { generateReferralCode, normalizeReferralCode, ensureReferralCode, attachReferralCode, ensurePublicReferralCode, legacyReferralCode, normalizeReferralWallet } from '../src/referral/invite.js';
import createReferralRouter from '../src/referral/routes.js';
import { pool } from '../src/db/pool.js';
import express from 'express';
import {readFileSync} from 'node:fs';

const pgEnabled = process.env.GROM_REQUIRE_PG === '1';

test('referral codes use a fixed public alphabet and normalize only issued code shapes', () => {
  const code = generateReferralCode();
  assert.match(code, /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{10}$/);
  assert.equal(normalizeReferralCode(code), code);
  assert.equal(normalizeReferralCode(`grom-${code.toLowerCase()}`), code);
  assert.equal(normalizeReferralCode('GROM-G7K3Q9'), 'G7K3Q9');
  assert.equal(normalizeReferralCode(`${code}x`), null);
});

test('legacy alias reproduces the existing link and wallet validation is strict', () => {
  assert.equal(legacyReferralCode('0xe61E6D7bdC744B2C7d49D42c6b727c988ACeAc79'), 'ZZWYPJ');
  assert.equal(normalizeReferralWallet(['0x'+'1'.repeat(40)]), null);
  assert.equal(normalizeReferralWallet('0x'+'A'.repeat(40)), '0x'+'a'.repeat(40));
  assert.equal(normalizeReferralWallet('wallet'), null);
});

test('public endpoint returns only stable identity without authenticating or creating users', async()=>{
  let calls=0, authCalls=0, server;
  const app=express();app.use('/api',createReferralRouter({requireAuth(_req,res){authCalls++;res.status(401).end();},
    publicCode:async wallet=>{calls++;assert.equal(wallet,'0x'+'a'.repeat(40));return 'ABCDEFGHJK';}}));
  try {
    server=await new Promise(resolve=>{const listener=app.listen(0,'127.0.0.1',()=>resolve(listener));});
    const base=`http://127.0.0.1:${server.address().port}`;
    const res=await fetch(base+'/api/referral/link?wallet=0x'+'A'.repeat(40));
    assert.equal(res.status,200);assert.equal(res.headers.get('cache-control'),'no-store');
    assert.deepEqual(await res.json(),{code:'GROM-ABCDEFGHJK',link:'/r/ABCDEFGHJK'});
    assert.equal((await fetch(base+'/api/referral/link?wallet=invalid')).status,400);
    assert.equal(calls,1);assert.equal(authCalls,0);
    assert.equal((await fetch(base+'/api/referral/summary')).status,401);assert.equal(authCalls,1);
  } finally {if(server) await new Promise(resolve=>server.close(resolve));}
});

test('parallel public code registrations converge without touching users',async()=>{
  const wallet='0x'+'b'.repeat(40);let code=null;
  const queries=[];const db=async(sql,params)=>{
    queries.push(sql);
    if(sql.startsWith('SELECT code'))return {rows:[]};
    if(sql.startsWith('INSERT INTO wallet_referral_links')){code ||= params[1];return {rows:[{code}]};}
    return {rows:[]};
  };
  const codes=await Promise.all(Array.from({length:5},()=>ensurePublicReferralCode(wallet,db)));
  assert.equal(new Set(codes).size,1);
  assert.equal(queries.some(sql=>/INSERT INTO users|UPDATE users/.test(sql)),false);
  assert.ok(queries.some(sql=>sql.includes('ON CONFLICT (wallet_address)')));
});

test('referral attribution is first-signup-only, self-referrals are rejected, and summary exposes counts only', { skip: !pgEnabled }, async () => {
  const wallets = Array.from({ length: 2 }, () => `0x${randomBytes(20).toString('hex')}`);
  let server;
  try {
    const users = await Promise.all(wallets.map(async (wallet) => {
      const { rows } = await pool.query(
        `INSERT INTO users (wallet_address, chain_id) VALUES ($1,1) RETURNING id`, [wallet]
      );
      return rows[0].id;
    }));
    const [inviterId, inviteeId] = users;
    const codes = await Promise.all(Array.from({ length: 5 }, () => ensureReferralCode(inviterId)));
    const code = codes[0];
    assert.equal(await ensurePublicReferralCode(wallets[0]),code);
    assert.equal(await attachReferralCode(inviterId,legacyReferralCode(wallets[0])),false);
    assert.equal(new Set(codes).size, 1, 'parallel logins must converge on one code');
    assert.equal(await attachReferralCode(inviterId, code), false, 'self-referral must be rejected');
    assert.equal(await attachReferralCode(inviteeId, 'NOT-A-CODE'), false, 'unissued codes must be rejected');
    assert.equal(await attachReferralCode(inviteeId, `GROM-${legacyReferralCode(wallets[0])}`), true);
    assert.equal(await attachReferralCode(inviteeId, code), false, 'existing attribution must not be overwritten');

    const app = express();
    app.use('/api', createReferralRouter({
      requireAuth(req, res, next) {
        if (req.get('authorization') !== 'Bearer test') return res.status(401).json({ error: 'unauthorized' });
        req.user = { sub: inviterId };
        next();
      },
    }));
    server = await new Promise((resolve) => {
      const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
    });
    const base = `http://127.0.0.1:${server.address().port}`;
    const denied = await fetch(`${base}/api/referral/summary`);
    assert.equal(denied.status, 401);
    const response = await fetch(`${base}/api/referral/summary`, { headers: { Authorization: 'Bearer test' } });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const body = await response.json();
    assert.equal(body.code, `GROM-${code}`);
    assert.equal(body.link, `/r/${code}`);
    assert.equal(body.totals.total_referred, 1);
    assert.equal(body.funnel.signups_30d, 1);
    assert.equal(body.funnel.active_30d, 1);
    assert.equal(body.tracking, 'active');
    assert.equal(body.rewards, 'inactive');
    assert.equal('payout' in body, false);
    assert.equal('wallets' in body, false);
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    await pool.query('DELETE FROM users WHERE wallet_address = ANY($1::text[])', [wallets]);
    await pool.query('DELETE FROM wallet_referral_links WHERE wallet_address = ANY($1::text[])', [wallets]);
  }
});


test('an invite remains attributed before its inviter signs in', {skip:!pgEnabled}, async()=>{
  const inviter='0x'+randomBytes(20).toString('hex'),invitee='0x'+randomBytes(20).toString('hex');
  try {
    const code=await ensurePublicReferralCode(inviter);
    assert.equal((await pool.query('SELECT id FROM users WHERE wallet_address=$1',[inviter])).rows.length,0);
    const {rows}=await pool.query('INSERT INTO users(wallet_address,chain_id)VALUES($1,1)RETURNING id',[invitee]);
    assert.equal(await attachReferralCode(rows[0].id,code),true);
    assert.equal(await attachReferralCode(rows[0].id,code),false);
    const verified=await pool.query('INSERT INTO users(wallet_address,chain_id)VALUES($1,1)RETURNING id',[inviter]);
    assert.equal(await ensureReferralCode(verified.rows[0].id),code);
    const stats=await pool.query('SELECT count(*)::int AS n FROM users WHERE referred_by_wallet=$1',[inviter]);
    assert.equal(stats.rows[0].n,1);
    assert.equal(await attachReferralCode(verified.rows[0].id,code),false);
  } finally {
    await pool.query('DELETE FROM users WHERE wallet_address=ANY($1::text[])',[[inviter,invitee]]);
    await pool.query('DELETE FROM wallet_referral_links WHERE wallet_address=ANY($1::text[])',[[inviter,invitee]]);
  }
});


test('migration preserves canonical links and backfills the original six-character algorithm', {skip:!pgEnabled},async()=>{
 const wallet='0x'+randomBytes(20).toString('hex'), code=generateReferralCode();
 try {
   await pool.query('INSERT INTO users(wallet_address,chain_id,referral_code)VALUES($1,1,$2)',[wallet,code]);
   const migration=readFileSync(new URL('../src/db/migrations/034_public_referral_links.sql',import.meta.url),'utf8');
   await pool.query(migration);
   const {rows}=await pool.query('SELECT code,legacy_code FROM wallet_referral_links WHERE wallet_address=$1',[wallet]);
   assert.equal(rows[0].code,code);assert.equal(rows[0].legacy_code,legacyReferralCode(wallet));
   await pool.query(migration);
   assert.equal(await ensurePublicReferralCode(wallet),code);
 } finally {
   await pool.query('DELETE FROM users WHERE wallet_address=$1',[wallet]);
   await pool.query('DELETE FROM wallet_referral_links WHERE wallet_address=$1',[wallet]);
 }
});
