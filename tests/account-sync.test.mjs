import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {savedLibraryRoute} from '../account-sync/worker-module.mjs';
import {exchange,changes,rebase} from '../account-sync/core.mjs';
const sql=new DatabaseSync(':memory:');
sql.exec('CREATE TABLE activation_codes(id INTEGER PRIMARY KEY,status TEXT,expires_at TEXT); CREATE TABLE access_devices(id INTEGER PRIMARY KEY,code_id INTEGER,device_id TEXT);');
sql.exec(readFileSync(new URL('../account-sync/schema.sql',import.meta.url),'utf8'));
sql.exec("INSERT INTO activation_codes VALUES(1,'active','2099-01-01'),(2,'active','2099-01-01'),(3,'blocked','2099-01-01'),(4,'active','2000-01-01'); INSERT INTO access_devices VALUES(1,1,'device-a'),(2,1,'device-b'),(3,2,'device-c'),(4,3,'device-d'),(5,4,'device-e');");
function prepare(query){const stmt=sql.prepare(query);return {bind(...values){return {first:async()=>stmt.get(...values),run:async()=>({meta:{changes:Number(stmt.run(...values).changes)}})}}};}
const DB={prepare,batch:async statements=>{sql.exec('BEGIN');try{const out=[];for(const s of statements)out.push(await s.run());sql.exec('COMMIT');return out;}catch(e){sql.exec('ROLLBACK');throw e;}}};
const env={DB,SAVED_LIBRARY_SYNC:'true'};
const tokens={a:{code_id:1,device_id:'device-a'},b:{code_id:1,device_id:'device-b'},c:{code_id:2,device_id:'device-c'},d:{code_id:3,device_id:'device-d'},e:{code_id:4,device_id:'device-e'}};
const deps={getBearerPayload:async req=>tokens[req.headers.get('Authorization')?.slice(7)]||null};
async function call(token='a',method='GET',body,device=tokens[token]?.device_id,environment=env){const req=new Request('https://staging.example/student/saved-library',{method,headers:{Authorization:'Bearer '+token,'X-Aluni-Device':device||''},...(body?{body:JSON.stringify(body)}:{})});const response=await savedLibraryRoute(req,environment,deps);return {status:response.status,body:await response.json()};}
for(const token of ['bad','d','e'])assert.equal((await call(token)).status,401);
assert.equal((await call('a','GET',null,'device-b')).status,401);
assert.equal((await call('a','GET',null,undefined,{...env,SAVED_LIBRARY_SYNC:'false'})).status,404);
assert.equal((await call('a','DELETE')).status,405);
const word={hanzi:'老师',pinyin:'lǎoshī',vi:'giáo viên'};
const first={revision:0,commit_id:randomUUID(),words:[word],sentences:[],account_id:'2'};
assert.equal((await call('a','POST',first)).status,200);assert.equal((await call('c')).body.words.length,0,'body owner ignored');
assert.equal((await call('b')).body.words[0].hanzi,'老师','same credential sees same pool');
assert.equal((await call('b','POST',{...first,commit_id:randomUUID()})).status,409,'stale snapshot rejected');
assert.equal((await call('a','POST',first)).body.replayed,true,'retry does not apply twice');
assert.equal((await call('a')).body.revision,1);
assert.equal((await call('a','POST',{...first,revision:1,commit_id:randomUUID(),words:Array(501).fill(word)})).status,400);
assert.equal((await call('a','POST',{...first,revision:1,commit_id:randomUUID(),words:[{...word,hanzi:''}]})).status,400);
const sentence={source:'shadowing',kind:'media',videoId:'12',start:1,end:3,zh:'你好',py:'nǐ hǎo',vi:'xin chào',title:'Bài học',courseId:'50plus'};sentence.id=JSON.stringify([sentence.source,sentence.kind,sentence.videoId,sentence.start,sentence.end,sentence.zh]);
assert.equal((await call('a','POST',{revision:1,commit_id:randomUUID(),words:[word],sentences:[sentence]})).status,200);
assert.equal((await call('b')).body.sentences[0].id,sentence.id);
assert.equal((await call('a','POST',{revision:2,commit_id:randomUUID(),words:[],sentences:[{...sentence,id:'bad'}]})).status,400);
class Storage{m=new Map();get length(){return this.m.size}key(i){return [...this.m.keys()][i]}getItem(k){return this.m.get(k)||null}setItem(k,v){this.m.set(k,String(v))}removeItem(k){this.m.delete(k)}}
const A=new Storage(),B=new Storage();
let order=0;function enqueue(store,op){store.setItem('aluni.sync.v1.1.op.'+randomUUID(),JSON.stringify({order:String(++order).padStart(5,'0'),op}));}
const request=token=>async(method,body)=>{const r=await call(token,method,body);if(r.status!==200){const e=Error(r.body.error);e.status=r.status;throw e;}return r.body;};
const flush=(storage,requestFn=request('a'))=>exchange({storage,account:'1',request:requestFn,uuid:randomUUID});
enqueue(A,{kind:'words',key:'老师',remove:true});enqueue(B,{kind:'words',key:'猫',item:{hanzi:'猫',pinyin:'māo',vi:'mèo'}});
await flush(A);await flush(B,request('b'));let state=(await call('a')).body;assert.deepEqual(state.words.map(x=>x.hanzi),['猫'],'remote additions do not resurrect deletion');
// Real CAS conflict injected between GET and POST: keep both devices edits.
enqueue(A,{kind:'words',key:'狗',item:{hanzi:'狗',pinyin:'gǒu',vi:'chó'}});let conflict=true;
await flush(A,async(m,b)=>{if(m==='POST'&&conflict){conflict=false;enqueue(B,{kind:'words',key:'鱼',item:{hanzi:'鱼',pinyin:'yú',vi:'cá'}});await flush(B,request('b'));}return request('a')(m,b);});
assert.deepEqual(new Set((await call('a')).body.words.map(x=>x.hanzi)),new Set(['猫','狗','鱼']));
// Lost acknowledgement followed by another device deletion must not resurrect an item.
enqueue(A,{kind:'words',key:'鸟',item:{hanzi:'鸟',pinyin:'niǎo',vi:'chim'}});
await assert.rejects(flush(A,async(m,b)=>{const out=await request('a')(m,b);if(m==='POST')throw Error('lost response');return out;}),/lost response/);
assert(A.getItem('aluni.sync.v1.1.batch'));
enqueue(B,{kind:'words',key:'鸟',remove:true});await flush(B,request('b'));await flush(A);assert(!(await call('a')).body.words.some(x=>x.hanzi==='鸟'));
assert.equal(A.length,0,'acknowledged queue cleared');
enqueue(A,{kind:'sentences',key:sentence.id,remove:true});await flush(A);assert.equal((await call('a')).body.sentences.length,0);
// Failed requests and wrong owners retain the queue.
enqueue(A,{kind:'words',key:'猫',remove:true});await assert.rejects(flush(A,async()=>{throw Error('offline')}),/offline/);assert(A.length>0);
await assert.rejects(flush(A,request('c')),/Hồ sơ/);assert(A.length>0);
assert.deepEqual(changes('words',[word],[]),[{kind:'words',key:'老师',remove:true}]);
assert.throws(()=>rebase({words:Array.from({length:500},(_,i)=>({hanzi:String(i)})),sentences:[]},[{kind:'words',key:'new',item:{hanzi:'new'}}]),/500/);
sql.exec("DELETE FROM access_devices WHERE device_id='device-a'");assert.equal((await call('a')).status,401,'revoked device cannot read or write');
console.log('PASS: real SQLite isolation, expired/revoked sessions, validation, CAS conflicts, two devices, removals, lost-response idempotency, offline outbox, wrong owner, quotas.');
