import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {accountsRoute,accountSession,secretHash,accountSecret} from '../account-sync/accounts.mjs';
import {savedLibraryRoute} from '../account-sync/worker-module.mjs';
const sql=new DatabaseSync(':memory:');
for(const f of ['schema.sql','accounts-schema.sql'])sql.exec(readFileSync(new URL('../account-sync/'+f,import.meta.url),'utf8'));
const prepare=q=>{const stmt=sql.prepare(q);const bound=(values=[])=>({bind:(...v)=>bound(v),first:async()=>stmt.get(...values),all:async()=>({results:stmt.all(...values)}),run:async()=>({meta:{changes:Number(stmt.run(...values).changes)}})});return bound();};
const DB={prepare,batch:async list=>{sql.exec('BEGIN');try{const r=[];for(const s of list)r.push(await s.run());sql.exec('COMMIT');return r;}catch(e){sql.exec('ROLLBACK');throw e;}}};
const env={DB,FREE_ACCOUNT_SYNC:'true',SAVED_LIBRARY_SYNC:'true',ADMIN_SECRET:'test-admin'};
let ip=0;
async function call(path,body={},headers={},method='POST',config=env){if(['/account/register','/account/recover'].includes(path))body={new_login_key:accountSecret(),new_recovery_key:accountSecret(),...body};const req=new Request('https://test'+path,{method,headers:{'CF-Connecting-IP':'test-'+ ++ip,'Content-Type':'application/json',...headers},...(method==='GET'?{}:{body:JSON.stringify(body)})});const r=await accountsRoute(req,config);return{status:r.status,...await r.json()};}
const a=await call('/account/register',{username:'alice',display_name:'Alice'});assert.equal(a.status,200);assert.equal(a.login_key.length,64);assert.equal(a.recovery_key.length,64);
assert.notEqual(sql.prepare('SELECT login_hash FROM sync_accounts').get().login_hash,a.login_key);
assert.equal((await call('/account/register',{username:'alice',display_name:'Other'})).status,409);
assert.equal((await call('/account/login',{username:'alice',key:'0'.repeat(64)})).status,401);
const b=await call('/account/login',{username:'alice',key:a.login_key});assert.equal(b.account_id,a.account_id);
const req=t=>new Request('https://test/student/saved-library',{headers:{Authorization:'Bearer '+t}});
assert.equal((await accountSession(req(a.token),env)).username,'alice');
const deps={accountSession,getBearerPayload:async()=>null};
let r=await savedLibraryRoute(req(a.token),env,deps);assert.equal(r.status,200);const empty=await r.json();assert.equal(empty.account_id,a.account_id);
r=await savedLibraryRoute(new Request('https://test/student/saved-library',{method:'POST',headers:{Authorization:'Bearer '+a.token},body:JSON.stringify({revision:0,commit_id:'a'.repeat(25),words:[{hanzi:'猫',pinyin:'māo',vi:'Mèo'}],sentences:[]})}),env,deps);assert.equal(r.status,200);
r=await savedLibraryRoute(req(b.token),env,deps);assert.equal((await r.json()).words.length,1,'same account across devices');
const other=await call('/account/register',{username:'bobby',display_name:'Bob'});r=await savedLibraryRoute(req(other.token),env,deps);assert.equal((await r.json()).words.length,0,'separate account');
assert.equal((await call('/admin/sync-accounts',{}, {},'GET')).status,401);
const admin=await call('/admin/sync-accounts',{}, {'X-Admin-Key':'test-admin'},'GET');assert.equal(admin.accounts.length,2);assert.equal(admin.accounts[0].words,1);assert(!JSON.stringify(admin).includes(a.login_key));assert(!JSON.stringify(admin).includes('login_hash'));
assert.deepEqual(admin.summary,{total:2,active:2,pending:0});assert.equal(admin.accounts[0].account_type,'legacy');
const searched=await call('/admin/sync-accounts?q=ali&status=active',{}, {'X-Admin-Key':'test-admin'},'GET');assert.equal(searched.accounts.length,1);assert.equal(searched.accounts[0].username,'alice');
const recovered=await call('/account/recover',{username:'alice',key:a.recovery_key});assert.equal(recovered.status,200);assert.equal(await accountSession(req(a.token),env),null);assert.equal(await accountSession(req(b.token),env),null);
assert.equal((await call('/account/recover',{username:'alice',key:a.recovery_key})).status,401);
assert.equal((await call('/account/login',{username:'alice',key:a.login_key})).status,401);
r=await savedLibraryRoute(req(recovered.token),env,deps);assert.equal((await r.json()).words.length,1,'recovery preserves library');
// A login begun before recovery cannot gain access after rotation, even if its session is inserted late.
await DB.prepare('INSERT INTO sync_account_sessions VALUES(?,?,?,?)').bind(await secretHash(a.token),1,Date.now()+100000,1).run();assert.equal(await accountSession(req(a.token),env),null);
await call('/account/logout',{}, {Authorization:'Bearer '+recovered.token});assert.equal(await accountSession(req(recovered.token),env),null);
assert.equal((await call('/account/register',{username:'third',display_name:'T'}, {},'POST',{...env,FREE_ACCOUNT_SYNC:'false'})).status,404);
for(let i=0;i<31;i++){ip=500;const r=await call('/account/login',{username:'alice',key:'0'.repeat(64)});assert.equal(r.status,i===30?429:401);}
console.log('PASS free accounts: registration, secrets hashed, login, isolation, shared device library, recovery rotation/replay/race, logout, admin privacy, feature gate, throttling.');
