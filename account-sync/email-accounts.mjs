// Email/password accounts share existing account IDs and saved libraries.
const hex=bytes=>Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('');
const random=()=>hex(crypto.getRandomValues(new Uint8Array(32)));
const hash=async value=>hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));
export async function passwordHash(password,pepper,salt=random()){
 const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(pepper),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const hardened=await crypto.subtle.sign('HMAC',material,new TextEncoder().encode(password));
 const key=await crypto.subtle.importKey('raw',hardened,'PBKDF2',false,['deriveBits']);
 const derived=await crypto.subtle.deriveBits({name:'PBKDF2',salt:new TextEncoder().encode(salt),iterations:100000,hash:'SHA-256'},key,256);
 return 'email1$'+salt+'$'+hex(derived);
}
async function passwordMatches(password,encoded,pepper){
 if(!/^email1\$[a-f0-9]{64}\$[a-f0-9]{64}$/.test(encoded||''))return false;
 const actual=await passwordHash(password,pepper,encoded.split('$')[1]);let diff=actual.length^encoded.length;
 for(let i=0;i<actual.length;i++)diff|=actual.charCodeAt(i)^encoded.charCodeAt(i);return diff===0;
}
const validPassword=p=>typeof p==='string'&&p.length>=10&&p.length<=128;
export async function emailAccountsRoute(req,env,headers={}){
 const path=new URL(req.url).pathname;if(!path.startsWith('/account/email/'))return null;
 const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{...headers,'Content-Type':'application/json','Cache-Control':'no-store'}});
 if(env.FREE_ACCOUNT_SYNC!=='true'||env.EMAIL_ACCOUNT_SYNC!=='true')return reply({error:'Đăng ký bằng email đang được chuẩn bị. Bạn vẫn có thể dùng web và lưu trên máy.'},503);
 if(req.method!=='POST')return reply({error:'Method not allowed'},405);
 const action=path.slice('/account/email/'.length);
 if(!['register','login','resend','forgot','verify','reset'].includes(action))return reply({error:'Not found'},404);
 const db=env.DB.withSession?env.DB.withSession('first-primary'):env.DB;
 try{
 if(!env.ACCOUNT_PASSWORD_PEPPER||env.ACCOUNT_PASSWORD_PEPPER.length<32)throw Error('config');
 const ip=req.headers.get('CF-Connecting-IP');if(!ip)return reply({error:'Không xác định được kết nối.'},400);
 async function limit(label,max){const bucket=Math.floor(Date.now()/3600000),key=await hash('email:'+label+':'+bucket);const r=await db.prepare('INSERT INTO sync_account_limits(key,bucket,hits) VALUES(?,?,1) ON CONFLICT(key) DO UPDATE SET hits=hits+1 RETURNING hits').bind(key,bucket).first();return r.hits<=max;}
 await db.prepare('DELETE FROM sync_account_limits WHERE bucket<?').bind(Math.floor(Date.now()/3600000)-24).run();
 if(!await limit('ip:'+ip,30))return reply({error:'Bạn đã thử nhiều lần. Vui lòng quay lại sau.'},429);
 const reader=req.body?.getReader();if(!reader)return reply({error:'Thiếu thông tin.'},400);
 let content='',size=0;const decoder=new TextDecoder();while(true){const r=await reader.read();if(r.done)break;size+=r.value.length;if(size>4096){await reader.cancel();return reply({error:'Thông tin quá dài.'},413);}content+=decoder.decode(r.value,{stream:true});}content+=decoder.decode();
 let body;try{body=JSON.parse(content);}catch{return reply({error:'Thông tin không hợp lệ.'},400);}
 if(!body||typeof body!=='object')return reply({error:'Thông tin không hợp lệ.'},400);
 const password=body.password;
 if(['verify','reset'].includes(action)){
  if(!/^[a-f0-9]{64}$/.test(body.token||'')||!validPassword(password))return reply({error:'Liên kết không hợp lệ hoặc mật khẩu chưa đủ 10 ký tự.'},400);
  const tokenHash=await hash(body.token),purpose=action==='verify'?'verify':'reset';
  const row=await db.prepare('SELECT a.* FROM sync_accounts a JOIN sync_email_tokens t ON t.account_id=a.id WHERE t.token_hash=? AND t.purpose=? AND t.expires_at>? AND t.auth_version=a.auth_version').bind(tokenHash,purpose,Date.now()).first();
  if(!row||!['pending','active'].includes(row.status))return reply({error:'Liên kết đã hết hạn hoặc đã dùng. Vui lòng yêu cầu gửi lại email.'},400);
  if(action==='verify'&&(row.status!=='pending'||!await passwordMatches(password,row.login_hash,env.ACCOUNT_PASSWORD_PEPPER)))return reply({error:'Nhập đúng mật khẩu bạn đã đặt khi đăng ký.'},400);
  const nextHash=action==='reset'?await passwordHash(password,env.ACCOUNT_PASSWORD_PEPPER):row.login_hash;
  const result=await db.batch([
   db.prepare("UPDATE sync_accounts SET status='active',login_hash=?,auth_version=auth_version+1 WHERE id=? AND auth_version=? AND EXISTS(SELECT 1 FROM sync_email_tokens WHERE token_hash=? AND purpose=? AND expires_at>?)").bind(nextHash,row.id,row.auth_version,tokenHash,purpose,Date.now()),
   db.prepare('DELETE FROM sync_email_tokens WHERE account_id=? AND auth_version=?').bind(row.id,row.auth_version)
  ]);
  if(!result[0].meta.changes)return reply({error:'Liên kết đã được sử dụng. Hãy đăng nhập hoặc yêu cầu email mới.'},400);
  return reply({ok:true,message:action==='verify'?'Xác thực email thành công. Vui lòng quay lại đăng nhập.':'Đã đổi mật khẩu. Vui lòng đăng nhập lại.'});
 }
 const email=String(body.email||'').trim().toLowerCase();
 if(email.length>254||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return reply({error:'Vui lòng nhập email hợp lệ.'},400);
 if(!await limit('email:'+email,12))return reply({error:'Email này đã được thử nhiều lần. Vui lòng quay lại sau.'},429);
 let row=await db.prepare('SELECT * FROM sync_accounts WHERE username=?').bind(email).first();
 if(action==='login'){
  if(!validPassword(password))return reply({error:'Email hoặc mật khẩu chưa đúng.'},401);
  const matches=await passwordMatches(password,row?.login_hash||('email1$'+'0'.repeat(64)+'$'+'0'.repeat(64)),env.ACCOUNT_PASSWORD_PEPPER);
  if(!row||!matches)return reply({error:'Email hoặc mật khẩu chưa đúng.'},401);
  if(row.status==='pending')return reply({error:'Vui lòng mở email để xác thực tài khoản, sau đó quay lại đăng nhập.',code:'EMAIL_UNVERIFIED'},403);
  if(row.status!=='active')return reply({error:'Tài khoản không khả dụng.'},403);
  const token='acct_'+random(),expires=Date.now()+30*86400000;
  await db.batch([db.prepare('INSERT INTO sync_account_sessions(token_hash,account_id,expires_at,auth_version) VALUES(?,?,?,?)').bind(await hash(token),row.id,expires,row.auth_version),db.prepare('UPDATE sync_accounts SET last_login_at=? WHERE id=?').bind(Date.now(),row.id)]);
  return reply({ok:true,username:email,account_id:String(-row.id),token,expires_at:expires});
 }
 // Missing mail configuration must never produce a false "email sent" success.
 if(!env.RESEND_API_KEY||!env.ACCOUNT_EMAIL_FROM||!env.ACCOUNT_PUBLIC_URL)throw Error('config');
 const publicUrl=new URL(env.ACCOUNT_PUBLIC_URL);if(publicUrl.protocol!=='https:'||publicUrl.username||publicUrl.password)throw Error('config');
 if(!await limit('mail:global',100)||!await limit('mail:'+email,3))return reply({error:'Đã yêu cầu gửi email nhiều lần. Vui lòng thử lại sau.'},429);
 if(action==='register'){
  const name=String(body.display_name||'').trim();if(!name||name.length>80||!validPassword(password))return reply({error:'Nhập họ tên và mật khẩu từ 10 đến 128 ký tự.'},400);
  if(!row){
   const count=await db.prepare('SELECT COUNT(*) AS n FROM sync_accounts').first();if(count.n>=1000)return reply({error:'Đợt đăng ký thử đã đủ số lượng.'},429);
   row=await db.prepare("INSERT OR IGNORE INTO sync_accounts(username,display_name,login_hash,recovery_hash,status,created_at,last_login_at) VALUES(?,?,?,?,'pending',?,0) RETURNING *").bind(email,name,await passwordHash(password,env.ACCOUNT_PASSWORD_PEPPER),await hash(random()),Date.now()).first();
   if(!row)row=await db.prepare('SELECT * FROM sync_accounts WHERE username=?').bind(email).first();
  }
 }
 const generic={ok:true,message:'Nếu email đủ điều kiện, thư hướng dẫn sẽ được gửi. Hãy kiểm tra Hộp thư đến và Thư rác.'};
 if(!row||!['pending','active'].includes(row.status))return reply(generic);
 const purpose=action==='forgot'?'reset':'verify';
 if(purpose==='verify'&&row.status!=='pending')return reply(generic);
 const token=random(),tokenHash=await hash(token);
 await db.prepare('DELETE FROM sync_email_tokens WHERE expires_at<?').bind(Date.now()).run();
 await db.prepare('INSERT INTO sync_email_tokens(token_hash,account_id,purpose,auth_version,expires_at) VALUES(?,?,?,?,?)').bind(tokenHash,row.id,purpose,row.auth_version,Date.now()+30*60000).run();
 publicUrl.hash=new URLSearchParams({action:purpose,token}).toString();
 const text=purpose==='verify'?`Vui lòng mở liên kết để xác thực tài khoản Aluni:\n${publicUrl}\n\nNhập mật khẩu bạn đã đặt khi đăng ký để xác nhận. Sau đó quay lại đăng nhập. Liên kết có hiệu lực 30 phút.\nNếu bạn không đăng ký, hãy bỏ qua email này.`:`Mở liên kết để đặt lại mật khẩu Aluni:\n${publicUrl}\n\nLiên kết có hiệu lực 30 phút. Nếu bạn không yêu cầu, hãy bỏ qua email này.`;
 const sent=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':'aluni-'+tokenHash},body:JSON.stringify({from:env.ACCOUNT_EMAIL_FROM,to:[email],subject:purpose==='verify'?'Xác thực tài khoản Tiếng Trung Aluni':'Đặt lại mật khẩu Tiếng Trung Aluni',text}),signal:AbortSignal.timeout(10000)});
 if(!sent.ok)throw Error('mail');
 return reply({...generic,message:purpose==='verify'?'Vui lòng mở email để xác thực tài khoản, sau đó quay lại đăng nhập. Kiểm tra cả mục Thư rác nếu chưa thấy thư.':'Vui lòng mở email để đặt lại mật khẩu, sau đó quay lại đăng nhập.'});
 }catch{return reply({error:'Chưa thể xử lý tài khoản/email lúc này. Bạn vẫn dùng web và lưu trên máy bình thường. Vui lòng thử lại sau.'},503);}
}
