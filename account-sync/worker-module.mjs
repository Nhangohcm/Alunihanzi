// Standalone route adapter for the existing V98 Worker. No identity from the body is trusted.
const PATH='/student/saved-library';
const MAX_BYTES=1000000;
function text(v,max){if(typeof v!=='string'||v.length>max)throw Error('Invalid text');return v;}
export function validateLibrary(body){
 if(!body||!Number.isSafeInteger(body.revision)||body.revision<0||!/^[a-zA-Z0-9-]{20,80}$/.test(body.commit_id||''))throw Error('Invalid version');
 if(!Array.isArray(body.words)||!Array.isArray(body.sentences)||body.words.length>500||body.sentences.length>500)throw Error('Maximum 500 words and 500 sentences');
 const words=body.words.map(w=>({hanzi:text(w.hanzi,200).trim(),pinyin:text(w.pinyin,400),vi:text(w.vi,1000)}));
 if(words.some(w=>!w.hanzi||!/\p{Script=Han}/u.test(w.hanzi))||new Set(words.map(w=>w.hanzi)).size!==words.length)throw Error('Invalid words');
 const sentences=body.sentences.map(s=>{
  if(!['shadowing','kids'].includes(s.source)||!['media','shadow'].includes(s.kind)||!Number.isFinite(s.start)||!Number.isFinite(s.end)||s.start<0||s.end<=s.start||s.end>86400)throw Error('Invalid sentence');
  const item={source:s.source,kind:s.kind,videoId:text(String(s.videoId),100),start:s.start,end:s.end,zh:text(s.zh,2000),py:text(s.py,4000),vi:text(s.vi,4000),title:text(s.title,500),courseId:text(s.courseId,100)};
  item.id=JSON.stringify([item.source,item.kind,item.videoId,item.start,item.end,item.zh]);
  if(!item.zh.trim()||item.id!==s.id)throw Error('Invalid sentence id');return item;
 });
 if(new Set(sentences.map(s=>s.id)).size!==sentences.length)throw Error('Duplicate sentence');
 return {words,sentences};
}
async function bodyJSON(req){
 const reader=req.body?.getReader();if(!reader)throw Error('Missing body');let bytes=0,chunks=[];
 while(true){const {value,done}=await reader.read();if(done)break;bytes+=value.length;if(bytes>MAX_BYTES){await reader.cancel();throw Error('Body too large');}chunks.push(value);}
 const all=new Uint8Array(bytes);let n=0;for(const c of chunks){all.set(c,n);n+=c.length;}return JSON.parse(new TextDecoder().decode(all));
}
export async function savedLibraryRoute(req,env,{getBearerPayload,headers={}}){
 if(new URL(req.url).pathname!==PATH)return null;
 const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{...headers,'Content-Type':'application/json','Cache-Control':'no-store'}});
 if(env.SAVED_LIBRARY_SYNC!=='true')return reply({error:'Sync disabled'},404);
 if(!['GET','POST'].includes(req.method))return reply({error:'Method not allowed'},405);
 const payload=await getBearerPayload(req,env),device=req.headers.get('X-Aluni-Device');
 if(!payload?.code_id||!payload.device_id||device!==payload.device_id)return reply({error:'Please activate on this device'},401);
 const db=env.DB.withSession?env.DB.withSession('first-primary'):env.DB;
 const owner=Number(payload.code_id);if(!Number.isSafeInteger(owner)||owner<=0)return reply({error:'Invalid session'},401);
 const row=await db.prepare('SELECT status,expires_at FROM activation_codes WHERE id=?').bind(owner).first();
 const registration=await db.prepare('SELECT id FROM access_devices WHERE code_id=? AND device_id=?').bind(owner,device).first();
 if(!row||row.status!=='active'||!Number.isFinite(Date.parse(row.expires_at))||Date.parse(row.expires_at)<=Date.now()||!registration)return reply({error:'Session expired or device revoked'},401);
 try{
  await db.prepare('INSERT OR IGNORE INTO saved_libraries(code_id) VALUES(?)').bind(owner).run();
  const read=async()=>{const r=await db.prepare('SELECT revision,words_json,sentences_json FROM saved_libraries WHERE code_id=?').bind(owner).first();return {account_id:String(owner),revision:r.revision,words:JSON.parse(r.words_json),sentences:JSON.parse(r.sentences_json)}};
  if(req.method==='GET')return reply({ok:true,...await read()});
  let body,clean;try{body=await bodyJSON(req);clean=validateLibrary(body);}catch(e){return reply({error:e.message},400);}
  const done=await db.prepare('SELECT commit_id FROM saved_library_commits WHERE code_id=? AND commit_id=?').bind(owner,body.commit_id).first();
  if(done)return reply({ok:true,replayed:true,...await read()});
  const result=await db.batch([
   db.prepare('UPDATE saved_libraries SET words_json=?,sentences_json=?,revision=revision+1,commit_id=?,updated_at=CURRENT_TIMESTAMP WHERE code_id=? AND revision=?').bind(JSON.stringify(clean.words),JSON.stringify(clean.sentences),body.commit_id,owner,body.revision),
   db.prepare('INSERT OR IGNORE INTO saved_library_commits(code_id,commit_id) SELECT code_id,commit_id FROM saved_libraries WHERE code_id=? AND commit_id=?').bind(owner,body.commit_id)
  ]);
  if(!result[0].meta.changes)return reply({error:'Conflict',...await read()},409);
  return reply({ok:true,...await read()});
 }catch(_){return reply({error:'Sync storage is not ready'},503);}
}
