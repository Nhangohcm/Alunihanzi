/* Aluni dictionary engine. Source data: Phong Phan/CVDICT, derived from CC-CEDICT, CC BY-SA 4.0. */
const SOURCE_REV='c379d909e308343a247e51619f7839a2060a271c';
const SOURCE_HASH='4dde4b204193efa9c192d7f7daeab1bb579c8ccd7c41ed90d1b6caee22ba0948';
const SOURCES=[`https://raw.githubusercontent.com/ph0ngp/CVDICT/${SOURCE_REV}/CVDICT.u8`,`https://cdn.jsdelivr.net/gh/ph0ngp/CVDICT@${SOURCE_REV}/CVDICT.u8`];
function norm(value){return String(value||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').trim().replace(/\s+/g,' ')}
function pyKey(value){return norm(String(value).toLowerCase().replace(/u:|ü|ǖ|ǘ|ǚ|ǜ/g,'v')).replace(/[1-5\s'’-]/g,'')}
function tonePinyin(raw){
 return raw.replace(/([a-zA-ZüÜ:]+)([1-5])/g,(_,letters,digit)=>{
  let s=letters.toLowerCase().replace(/u:/g,'ü').replace(/v/g,'ü'),n=Number(digit);if(n===5)return s;
  let i=s.indexOf('a');if(i<0)i=s.indexOf('e');if(i<0&&s.includes('ou'))i=s.indexOf('o');if(i<0){for(let k=s.length-1;k>=0;k--)if('aeiouü'.includes(s[k])){i=k;break}}
  if(i<0)return s;const marks={a:'āáǎà',e:'ēéěè',i:'īíǐì',o:'ōóǒò',u:'ūúǔù','ü':'ǖǘǚǜ'};
  return s.slice(0,i)+marks[s[i]][n-1]+s.slice(i+1);
 });
}
function parseDictionary(text){
 const rows=[];
 for(const line of text.split(/\r?\n/)){
  if(!line||line.startsWith('#'))continue;
  const m=line.match(/^(\S+) (\S+) \[([^\]]+)\] \/(.*)\/$/);if(!m)continue;
  const meanings=m[4].split('/').filter(Boolean),vi=meanings.join('; ');
  rows.push({traditional:m[1],hanzi:m[2],pinyin:tonePinyin(m[3]),vi,py:pyKey(m[3]),meanings:meanings.map(norm)});
 }
 return rows;
}
function searchDictionary(rows,raw,limit=60){
 const q=norm(raw),py=pyKey(raw),han=/\p{Script=Han}/u.test(raw);
 if(!q||q.length>150)return {items:[],total:0};
 const short=q.replace(/^(con|cai|chiec|cay)\s+/,''),queries=[q,...(short!==q?[short]:[])];
 const hits=[];const seen=new Set();
 const common=new Set(['鸽子','猪','合同','光合作用','电脑','苹果','恐龙','和平','自行车','医生','医院','学校','工作','学习']);
 const toneQuery=/[1-5āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/i.test(raw);
 const tones=value=>tonePinyin(value.toLowerCase()).replace(/[\s'’-]/g,'');
 for(const r of rows){
  let score=0;
  if(han){if(r.hanzi===raw||r.traditional===raw)score=100;else if(r.hanzi.startsWith(raw)||r.traditional.startsWith(raw))score=70;else if(r.hanzi.includes(raw)||r.traditional.includes(raw))score=50}
  else {
   if(r.py===py)score=toneQuery?(tones(raw)===tones(r.pinyin)?99:80):95;
   for(const term of queries)for(const meaning of r.meanings){
    if(meaning===term)score=Math.max(score,90);
    else if(meaning.startsWith(term+' ')||meaning.startsWith(term+';'))score=Math.max(score,75);
    else if(term.length>=3&&(' '+meaning+' ').includes(' '+term+' '))score=Math.max(score,60);
   }
  }
  const key=r.hanzi+'|'+r.pinyin+'|'+r.vi;
  if(score&&!seen.has(key)){seen.add(key);hits.push({r,score:score+(common.has(r.hanzi)?2:0)})}
 }
 hits.sort((a,b)=>b.score-a.score||a.r.hanzi.length-b.r.hanzi.length||a.r.vi.length-b.r.vi.length);
 return {total:hits.length,items:hits.slice(0,Math.min(limit,100)).map(({r})=>({hanzi:r.hanzi,traditional:r.traditional,pinyin:r.pinyin,vi:r.vi,_dictionary:'CVDICT'}))};
}
if(typeof module!=='undefined')module.exports={parseDictionary,searchDictionary,tonePinyin,pyKey};
if(typeof self!=='undefined'&&typeof self.postMessage==='function'){
 let ready;
 async function db(){return new Promise((resolve,reject)=>{const r=indexedDB.open('aluni-dictionary-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('sources');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
 async function cached(write){let conn;try{conn=await db();return await new Promise((resolve,reject)=>{const tx=conn.transaction('sources',write===undefined?'readonly':'readwrite'),store=tx.objectStore('sources');const r=write===undefined?store.get(SOURCE_REV):store.put(write,SOURCE_REV);let result;r.onsuccess=()=>{result=r.result};tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)})}catch(_){return null}finally{conn?.close()}}
 async function verified(text){const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return [...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join('')===SOURCE_HASH}
 async function load(){
  const saved=await cached();if(typeof saved==='string'&&await verified(saved))return parseDictionary(saved);
  for(const url of SOURCES){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),25000);try{
   const r=await fetch(url,{signal:controller.signal});if(!r.ok)throw Error('source');const text=await r.text();if(!await verified(text))throw Error('integrity');const rows=parseDictionary(text);if(rows.length<120000)throw Error('incomplete');await cached(text);return rows;
  }catch(_){}finally{clearTimeout(timer)}}
  throw Error('Chưa tải được bộ từ điển. Vui lòng thử lại khi có kết nối mạng.');
 }
 self.onmessage=async event=>{const {id,query}=event.data||{};try{if(!ready)ready=load().catch(e=>{ready=null;throw e});const rows=await ready;self.postMessage({id,...searchDictionary(rows,String(query||'')),entries:rows.length})}catch(e){self.postMessage({id,error:e.message})}};
}
