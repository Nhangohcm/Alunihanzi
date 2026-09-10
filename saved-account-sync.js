import {installFreeAccounts} from './free-account-ui.js';
// Opt-in staging feature. The production page does not load this module.
import {WORDS_KEY,SENTENCES_KEY,changes,rebase,exchange} from './account-sync/core.mjs';
const ACTIVE='aluni.sync.v1.active',GUEST='aluni.sync.v1.guest';
const config=window.ALUNI_SAVED_SYNC_CONFIG;
if(config?.enabled) init();
function init(){
 const read=key=>{const v=JSON.parse(localStorage.getItem(key)||'[]');if(!Array.isArray(v))throw Error('Kho trên máy chưa đọc được.');return v;};
 const current=()=>({words:read(WORDS_KEY),sentences:read(SENTENCES_KEY)});
 let active=null,running=false,timer,sequence=0,awaitingActivation=false;
 const ui=document.createElement('section');ui.className='card';ui.id='savedAccountSync';
 ui.innerHTML='<strong>Đồng bộ từ và câu đã lưu</strong><p data-status role="status">Bạn vẫn có thể lưu và ôn miễn phí trên máy này. Có mã kích hoạt? Bấm bên dưới để đồng bộ hoặc khôi phục kho.</p><select aria-label="Chọn hồ sơ khóa học"></select> <button type="button" class="btn soft" data-connect>Bật đồng bộ / Khôi phục kho</button> <button type="button" class="btn soft" data-import hidden>Thêm kho trên máy vào hồ sơ</button> <button type="button" class="btn soft" data-sync hidden>Đồng bộ lại</button> <button type="button" class="btn soft" data-disconnect hidden>Ngắt đồng bộ</button><p class="hint">Dùng cùng mã kích hoạt trên thiết bị khác để mở cùng kho. Các mã khác nhau chưa tự gộp kho.</p>';
 const host=document.getElementById('writingSection');host?.querySelector('.writing-quick-card')?.after(ui);
 const freeAccounts=installFreeAccounts(ui,course=>connect(course));
 if(freeAccounts){const b=document.createElement('button');b.type='button';b.className='btn soft';b.textContent='Tài khoản miễn phí / Đăng nhập';b.dataset.freeAccount='';b.onclick=()=>freeAccounts.open();ui.append(b);}
 const status=message=>{ui.querySelector('[data-status]').textContent=message;const note=document.querySelector('[data-sentence-storage-note]');if(note)note.textContent=active?message:'Lưu trên trình duyệt này. Xóa dữ liệu trình duyệt sẽ xóa các câu đã lưu.';};
 const selected=()=>JSON.parse(localStorage.getItem(ACTIVE)||'null');
 const same=()=>active&&JSON.stringify(selected())===JSON.stringify(active);
 const token=()=>active?.course?.startsWith('free:')?freeAccounts?.tokenFor(active):typeof savedEntitlements==='function'?savedEntitlements()[active?.course]?.token:null;
 const tokenOwner=()=>{if(active?.course?.startsWith('free:'))return freeAccounts?.tokenFor(active)?freeAccounts.read().account_id:'';try{const body=token().split('.')[0].replace(/-/g,'+').replace(/_/g,'/');return String(JSON.parse(atob(body)).code_id);}catch(_){return '';}};
 const owns=()=>same()&&tokenOwner()===active.account;
 function detachChangedAccount(){if(active&&!owns()){
  localStorage.setItem('aluni.sync.v1.'+active.account+'.cache',JSON.stringify(current()));active=null;localStorage.removeItem(ACTIVE);paint({words:[],sentences:[]});buttons();status('Phiên học đã đổi. Hãy kết nối lại đúng hồ sơ để mở kho đã lưu.');return true;}return false;}
 const paint=state=>{
  localStorage.setItem(WORDS_KEY,JSON.stringify(state.words));localStorage.setItem(SENTENCES_KEY,JSON.stringify(state.sentences));
  if(typeof renderSavedWritingVocabulary==='function')renderSavedWritingVocabulary();if(typeof refreshWritingSaveButtons==='function')refreshWritingSaveButtons();window.dispatchEvent(new Event('aluni-saved-library-updated'));
 };
 const buttons=()=>{ui.querySelector('[data-connect]').hidden=!!active;const freeButton=ui.querySelector('[data-free-account]');if(freeButton)freeButton.hidden=!!active;ui.querySelector('select').hidden=!!active||ui.querySelector('select').children.length<2;for(const name of ['import','sync','disconnect'])ui.querySelector('[data-'+name+']').hidden=!active;};
 function choices(){const select=ui.querySelector('select');select.replaceChildren();for(const [key,ent] of Object.entries(typeof savedEntitlements==='function'?savedEntitlements():{})){if(!ent?.token)continue;const option=document.createElement('option');option.value=key;option.textContent=ent.course_name||ent.course_id||key;select.append(option);}buttons();}
 async function apiRequest(method,body,session=active){
  const bearer=session?.course?.startsWith('free:')?freeAccounts?.tokenFor(session):typeof savedEntitlements==='function'?savedEntitlements()[session?.course]?.token:null;if(!bearer)throw Error('Vui lòng kích hoạt lại hồ sơ trên thiết bị này.');
  const ctrl=new AbortController(),timeout=setTimeout(()=>ctrl.abort(),12000);
  try{
   const r=await fetch(config.apiBase+'/student/saved-library',{method,signal:ctrl.signal,cache:'no-store',headers:{'Content-Type':'application/json',Authorization:'Bearer '+bearer,'X-Aluni-Device':accessDeviceId()},...(body?{body:JSON.stringify(body)}:{})});
   const data=await r.json();if(!r.ok){const e=Error(r.status===401?'Phiên học hết hạn. Kho trên máy được giữ lại; hãy kích hoạt lại.':r.status===404||r.status===503?'Máy chủ đồng bộ chưa sẵn sàng. Kho trên máy vẫn được giữ nguyên.':'Chưa đồng bộ được. Kho trên máy vẫn được giữ nguyên.');e.status=r.status;throw e;}return data;
  }finally{clearTimeout(timeout)}
 }
 function pending(){const prefix='aluni.sync.v1.'+active.account+'.op.',ops=[];for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k.startsWith(prefix))ops.push(JSON.parse(localStorage.getItem(k)));}return ops.sort((a,b)=>a.order.localeCompare(b.order)).map(x=>x.op);}
 function record(kind,before,after){
  if(!active)return;if(!owns())throw Error('Hồ sơ đã đổi. Hãy tải lại trang.');
  for(const op of changes(kind,before,after)){const id=crypto.randomUUID();localStorage.setItem('aluni.sync.v1.'+active.account+'.op.'+id,JSON.stringify({order:String(Date.now()).padStart(16,'0')+'-'+String(++sequence).padStart(8,'0')+'-'+id,op}));}
  status('Đã lưu trên máy, đang chờ đồng bộ…');schedule();
 }
 window.ALUNI_SAVED_SYNC={record};
 if(typeof setWritingSavedVocabulary==='function'){
  const baseSet=setWritingSavedVocabulary;
  setWritingSavedVocabulary=function(rows){record('words',savedWritingVocabulary(),rows.slice(0,500));return baseSet(rows);};
 }
 function schedule(){clearTimeout(timer);timer=setTimeout(sync,700);}
 async function sync(){
  if(!active||running||!same())return;if(detachChangedAccount())return;running=true;const session=active;
  try{
   if(!navigator.locks)throw Error('Trình duyệt này chưa hỗ trợ đồng bộ an toàn giữa các tab. Kho vẫn lưu trên máy.');
   await navigator.locks.request('aluni-saved-sync',async()=>{
    const valid=()=>active===session&&owns();
    const remote=await exchange({storage:localStorage,account:session.account,uuid:()=>crypto.randomUUID(),valid,request:(m,b)=>apiRequest(m,b,session)});
    if(!remote||!valid())return;
    const state=rebase(remote,pending());localStorage.setItem('aluni.sync.v1.'+session.account+'.cache',JSON.stringify(state));paint(state);status('Đã đồng bộ từ và câu đã lưu.');
   });
  }catch(e){status(e.message||'Chưa kết nối được. Kho trên máy vẫn được giữ nguyên.');}finally{running=false;}
 }
 function requestActivation(){
  awaitingActivation=true;
  status('Nhập mã trong khung kích hoạt để mở lại kho của bạn. Chưa có mã thì đóng khung và tiếp tục lưu trên máy.');
  if(typeof openAccess==='function')openAccess();
 }
 window.ALUNI_SAVED_SYNC.afterActivation=async item=>{
  if(!awaitingActivation)return false;
  awaitingActivation=false;
  if(typeof closeAccess==='function')closeAccess();
  choices();await connect(item.course_id);
  if(typeof setActiveAppSection==='function')setActiveAppSection('writingSection');
  ui.scrollIntoView?.({block:'center',behavior:'smooth'});return true;
 };
 document.getElementById('accessModal')?.addEventListener('click',e=>{if(e.target.id==='accessModal'||e.target.closest?.('#accessCancelBtn, #accessCloseBtn'))awaitingActivation=false;});
 async function connect(course){
  if(!course||!(course.startsWith('free:')?freeAccounts?.tokenFor({course}):savedEntitlements()[course]?.token)){requestActivation();return;}
  const button=ui.querySelector('[data-connect]');button.disabled=true;
  try{
   const previous=localStorage.getItem(ACTIVE);
   const remote=await apiRequest('GET',null,{course});
   if(localStorage.getItem(ACTIVE)!==previous)throw Error('Hồ sơ đã đổi ở tab khác. Hãy tải lại trang.');
   // First connection never silently uploads another person's browser library.
   if(!localStorage.getItem(GUEST))localStorage.setItem(GUEST,JSON.stringify(current()));
   active={course,account:String(remote.account_id)};localStorage.setItem(ACTIVE,JSON.stringify(active));
   paint(rebase(remote,pending()));buttons();status('Đã mở kho của hồ sơ. Có thể thêm kho cũ trên máy bằng nút bên cạnh.');await sync();
  }catch(e){if(e.status===401){if(course.startsWith('free:'))freeAccounts.open();else requestActivation();}else status(e.message);}finally{button.disabled=false;}
 }
 ui.querySelector('[data-connect]').onclick=()=>{const saved=freeAccounts?.read();return connect(saved?'free:'+saved.username:ui.querySelector('select').value);};
 ui.querySelector('[data-import]').onclick=()=>{try{if(!same())throw Error('Hãy tải lại trang.');const guest=JSON.parse(localStorage.getItem(GUEST)||'null');if(!guest)return;const before=current(),after=rebase(before,[...guest.words.map(item=>({kind:'words',key:item.hanzi,item})),...guest.sentences.map(item=>({kind:'sentences',key:item.id,item}))]);record('words',before.words,after.words);record('sentences',before.sentences,after.sentences);paint(after);}catch(e){status(e.message);}};
 ui.querySelector('[data-sync]').onclick=sync;
 ui.querySelector('[data-disconnect]').onclick=async()=>{try{if(active?.course?.startsWith('free:'))await freeAccounts.logout();if(!same())throw Error('Hãy tải lại trang.');localStorage.setItem('aluni.sync.v1.'+active.account+'.cache',JSON.stringify(current()));active=null;localStorage.removeItem(ACTIVE);paint(JSON.parse(localStorage.getItem(GUEST)||'{"words":[],"sentences":[]}'));localStorage.removeItem(GUEST);buttons();choices();status('Đã ngắt đồng bộ và mở lại kho trên trình duyệt.');}catch(e){status(e.message);}};
 window.addEventListener('online',schedule);window.addEventListener('focus',()=>{choices();schedule();});
 window.addEventListener('storage',e=>{if(e.key===ACTIVE){location.reload();return;}if(e.key?.startsWith('aluni.sync.v1.'))schedule();});
 const originalSave=typeof saveEntitlement==='function'?saveEntitlement:null;if(originalSave)saveEntitlement=function(...args){const result=originalSave.apply(this,args);detachChangedAccount();choices();schedule();return result;};
 try{active=selected();buttons();choices();if(active&&!detachChangedAccount()){status('Kho trên máy đang chờ xác thực và đồng bộ.');schedule();}}catch(e){status(e.message);}
}
