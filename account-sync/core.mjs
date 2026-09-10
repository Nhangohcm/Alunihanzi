export const WORDS_KEY='aluni_writing_saved_vocab_v1';
export const SENTENCES_KEY='aluni.video-sentences.v1';
export const keyOf=(kind,item)=>kind==='words'?item.hanzi:item.id;
export function changes(kind,before,after){
 const old=new Map(before.map(x=>[keyOf(kind,x),x])),next=new Map(after.map(x=>[keyOf(kind,x),x]));
 return [...[...old.keys()].filter(k=>!next.has(k)).map(key=>({kind,key,remove:true})),...[...next].filter(([k,v])=>JSON.stringify(old.get(k))!==JSON.stringify(v)).map(([key,item])=>({kind,key,item}))];
}
export function rebase(remote,ops){
 const state={words:[...remote.words],sentences:[...remote.sentences]};
 for(const op of ops){const rows=state[op.kind];if(!rows)throw Error('Invalid operation');state[op.kind]=rows.filter(x=>keyOf(op.kind,x)!==op.key);if(!op.remove)state[op.kind].unshift(op.item);}
 if(state.words.length>500||state.sentences.length>500)throw Error('Kho đồng bộ tối đa 500 từ và 500 câu. Hãy bớt mục trước khi thử lại.');return state;
}
// Durable batch payload makes retry after a lost HTTP response idempotent.
export async function exchange({storage,account,request,uuid,valid=()=>true}){
 const prefix='aluni.sync.v1.'+account+'.',batchKey=prefix+'batch';
 const queue=()=>{const ops=[];for(let i=0;i<storage.length;i++){const key=storage.key(i);if(key.startsWith(prefix+'op.'))ops.push({key,...JSON.parse(storage.getItem(key))});}return ops.sort((a,b)=>a.order.localeCompare(b.order));};
 for(let attempt=0;attempt<5;attempt++){
  if(!valid())return null;
  let batch=JSON.parse(storage.getItem(batchKey)||'null');
  if(!batch){
   const remote=await request('GET');if(!valid())return null;
   if(String(remote.account_id)!==String(account))throw Error('Hồ sơ đã thay đổi. Vui lòng kết nối lại.');
   const pending=queue();if(!pending.length)return remote;
   batch={keys:pending.map(x=>x.key),body:{revision:remote.revision,commit_id:uuid(),...rebase(remote,pending.map(x=>x.op))}};
   storage.setItem(batchKey,JSON.stringify(batch));
  }
  let result;
  try{result=await request('POST',batch.body);}catch(e){if(e.status===409){storage.removeItem(batchKey);continue;}throw e;}
  if(!valid())return null;
  if(String(result.account_id)!==String(account))throw Error('Sai hồ sơ đồng bộ.');
  for(const key of batch.keys)storage.removeItem(key);storage.removeItem(batchKey);
  if(!queue().length)return result;
 }
 throw Error('Kho đang thay đổi trên thiết bị khác. Hãy thử đồng bộ lại.');
}
