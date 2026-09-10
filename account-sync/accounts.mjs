import {emailAccountsRoute} from './email-accounts.mjs';
// Free sync accounts use generated 256-bit secrets, never user-selected passwords.
export const accountSecret=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');
export async function secretHash(value){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),x=>x.toString(16).padStart(2,'0')).join('');}
export async function accountSession(req,env){
 if(env.FREE_ACCOUNT_SYNC!=='true')return null;
 const token=(req.headers.get('Authorization')||'').replace(/^Bearer /,'');
 if(!/^acct_[a-f0-9]{64}$/.test(token))return null;
 const db=env.DB.withSession?env.DB.withSession('first-primary'):env.DB;
 const row=await db.prepare('SELECT a.id,a.username FROM sync_accounts a JOIN sync_account_sessions s ON s.account_id=a.id WHERE s.token_hash=? AND s.expires_at>? AND a.status=? AND s.auth_version=a.auth_version').bind(await secretHash(token),Date.now(),'active').first();
 return row?{id:row.id,username:row.username}:null;
}
export async function accountsRoute(req,env,headers={}){
 const emailResponse=await emailAccountsRoute(req,env,headers);if(emailResponse)return emailResponse;
 const url=new URL(req.url),path=url.pathname;
 if(!path.startsWith('/account/')&&path!=='/admin/sync-accounts')return null;
 const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{...headers,'Content-Type':'application/json','Cache-Control':'no-store'}});
 if(env.FREE_ACCOUNT_SYNC!=='true')return reply({error:'Tài khoản miễn phí chưa được bật.'},404);
 const db=env.DB.withSession?env.DB.withSession('first-primary'):env.DB;
 try{
 if(path==='/admin/sync-accounts'){
  if(!env.ADMIN_SECRET||req.headers.get('X-Admin-Key')!==env.ADMIN_SECRET)return reply({error:'Unauthorized'},401);
  if(req.method!=='GET')return reply({error:'Method not allowed'},405);
  const cursor=Math.max(0,Number(url.searchParams.get('after'))||0);
  const rows=await db.prepare("SELECT a.id,a.username,a.display_name,a.status,a.created_at,a.last_login_at,COALESCE(json_array_length(l.words_json),0) AS words,COALESCE(json_array_length(l.sentences_json),0) AS sentences FROM sync_accounts a LEFT JOIN saved_libraries l ON l.code_id=-a.id WHERE a.id>? ORDER BY a.id LIMIT 51").bind(cursor).all();
  const list=rows.results||[];return reply({accounts:list.slice(0,50),next:list.length>50?list[49].id:null});
 }
 if(req.method!=='POST')return reply({error:'Method not allowed'},405);
 if(!['/account/register','/account/login','/account/recover','/account/logout'].includes(path))return reply({error:'Not found'},404);
 if(path==='/account/logout'){
  const token=(req.headers.get('Authorization')||'').replace(/^Bearer /,'');
  if(/^acct_[a-f0-9]{64}$/.test(token))await db.prepare('DELETE FROM sync_account_sessions WHERE token_hash=?').bind(await secretHash(token)).run();return reply({ok:true});
 }
 // Cloudflare supplies this header; no forwarding headers from callers are trusted.
 const ip=req.headers.get('CF-Connecting-IP');if(!ip)return reply({error:'Không xác định được kết nối.'},400);
 const bucket=Math.floor(Date.now()/3600000),key=await secretHash(ip+':'+bucket);
 await db.prepare('DELETE FROM sync_account_limits WHERE bucket<?').bind(bucket-24).run();
 const limit=await db.prepare('INSERT INTO sync_account_limits(key,bucket,hits) VALUES(?,?,1) ON CONFLICT(key) DO UPDATE SET hits=hits+1 RETURNING hits').bind(key,bucket).first();
 if(limit.hits>30)return reply({error:'Bạn đã thử nhiều lần. Vui lòng quay lại sau.'},429);
 const reader=req.body?.getReader();if(!reader)return reply({error:'Thiếu thông tin.'},400);
 let size=0,parts=[];while(true){const r=await reader.read();if(r.done)break;size+=r.value.length;if(size>4096){await reader.cancel();return reply({error:'Thông tin quá dài.'},413);}parts.push(r.value);}
 const bytes=new Uint8Array(size);let offset=0;for(const p of parts){bytes.set(p,offset);offset+=p.length;}
 let body;try{body=JSON.parse(new TextDecoder().decode(bytes));}catch{return reply({error:'Thông tin không hợp lệ.'},400);}
 const username=String(body.username||'').trim().toLowerCase();
 if(!/^[a-z][a-z0-9_]{3,31}$/.test(username))return reply({error:'Tên tài khoản dài 4–32 ký tự, bắt đầu bằng chữ; dùng chữ không dấu, số hoặc dấu gạch dưới.'},400);
 let row,loginKey,recoveryKey;
 if(path!=='/account/login'){
  loginKey=String(body.new_login_key||'');recoveryKey=String(body.new_recovery_key||'');
  if(!/^[a-f0-9]{64}$/.test(loginKey)||!/^[a-f0-9]{64}$/.test(recoveryKey)||loginKey===recoveryKey)return reply({error:'Thiếu mã ngẫu nhiên do giao diện tạo.'},400);
 }
 if(path==='/account/register'){
  const name=String(body.display_name||'').trim();if(!name||name.length>80)return reply({error:'Nhập tên hiển thị (tối đa 80 ký tự).'},400);
  // Bound staging registrations independently of IP rate limits.
  const count=await db.prepare('SELECT COUNT(*) AS n FROM sync_accounts').first();if(count.n>=1000)return reply({error:'Đợt đăng ký thử đã đủ số lượng.'},429);
  row=await db.prepare('INSERT OR IGNORE INTO sync_accounts(username,display_name,login_hash,recovery_hash,created_at,last_login_at) VALUES(?,?,?,?,?,?) RETURNING id,username,auth_version').bind(username,name,await secretHash(loginKey),await secretHash(recoveryKey),Date.now(),Date.now()).first();
  if(!row){row=await db.prepare('SELECT id,username,auth_version FROM sync_accounts WHERE username=? AND login_hash=? AND recovery_hash=? AND status=?').bind(username,await secretHash(loginKey),await secretHash(recoveryKey),'active').first();if(!row)return reply({error:'Tên tài khoản đã được sử dụng.'},409);} 
 }else{
  const key=String(body.key||'').trim().toLowerCase();if(!/^[a-f0-9]{64}$/.test(key))return reply({error:'Tên tài khoản hoặc mã không đúng.'},401);
  const hash=await secretHash(key),column=path==='/account/recover'?'recovery_hash':'login_hash';
  row=await db.prepare('SELECT id,username,auth_version FROM sync_accounts WHERE username=? AND '+column+'=? AND status=?').bind(username,hash,'active').first();
  if(!row&&path==='/account/recover'){
   // Retry after lost response proves possession of both replacement secrets.
   row=await db.prepare('SELECT id,username,auth_version FROM sync_accounts WHERE username=? AND login_hash=? AND recovery_hash=? AND status=?').bind(username,await secretHash(loginKey),await secretHash(recoveryKey),'active').first();
   if(row)row.replayed=true;
  }
  if(!row)return reply({error:'Tên tài khoản hoặc mã không đúng.'},401);
  if(path==='/account/recover'&&!row.replayed){
    // Atomic claim of one-time recovery key; concurrent replays cannot rotate twice.
   const changed=await db.prepare('UPDATE sync_accounts SET login_hash=?,recovery_hash=?,auth_version=auth_version+1 WHERE id=? AND recovery_hash=? RETURNING id,auth_version').bind(await secretHash(loginKey),await secretHash(recoveryKey),row.id,hash).first();
   if(!changed)return reply({error:'Mã khôi phục đã được sử dụng.'},401);row.auth_version=changed.auth_version;
   await db.prepare('DELETE FROM sync_account_sessions WHERE account_id=?').bind(row.id).run();
  }
 }
 await db.prepare('DELETE FROM sync_account_sessions WHERE expires_at<?').bind(Date.now()).run();
 const token='acct_'+accountSecret(),expires=Date.now()+30*86400000;
 await db.batch([
  db.prepare('INSERT INTO sync_account_sessions(token_hash,account_id,expires_at,auth_version) VALUES(?,?,?,?)').bind(await secretHash(token),row.id,expires,row.auth_version),
  db.prepare('UPDATE sync_accounts SET last_login_at=? WHERE id=?').bind(Date.now(),row.id)
 ]);
 return reply({ok:true,username:row.username,account_id:String(-row.id),token,expires_at:expires,...(loginKey?{login_key:loginKey,recovery_key:recoveryKey}:{})});
 }catch{return reply({error:'Dịch vụ tài khoản chưa sẵn sàng. Vui lòng thử lại.'},503);}
}
