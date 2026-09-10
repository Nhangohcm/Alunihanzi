const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{webcrypto,createHash}=require('node:crypto');
const engine=require('../dictionary/search-worker.js');
const fixture='鴿子 鸽子 [ge1 zi5] /chim bồ câu/chim cu/\n豬 猪 [zhu1] /lợn/heo/\n綠 绿 [lu:4] /xanh lá/\n路 路 [lu4] /đường/\n鴿子 鸽子 [ge1 zi5] /chim bồ câu/chim cu/';
const rows=engine.parseDictionary(fixture);
for(const q of ['chim bồ câu','chim bo cau','bồ câu','鸽子','鴿子','gezi','gē zi','ge1zi5'])assert.equal(engine.searchDictionary(rows,q).items[0].hanzi,'鸽子',q);
for(const q of ['con heo','con lợn','heo','猪','zhu1'])assert.equal(engine.searchDictionary(rows,q).items[0].hanzi,'猪',q);
assert.equal(engine.searchDictionary(rows,'lǜ').items[0].hanzi,'绿');assert.equal(engine.searchDictionary(rows,'lu4').items[0].hanzi,'路');
assert.equal(engine.searchDictionary(rows,'鸽子').total,1);assert.equal(engine.searchDictionary(rows,'').total,0);
assert.equal(engine.searchDictionary(rows,'not-in-dictionary').total,0);
assert.equal(engine.tonePinyin('shui3 liu2 nv3 ou3'),'shuǐ liú nǚ ǒu');
assert(engine.searchDictionary(rows,'chim',1).items.length<=1);
console.log('PASS: dictionary aliases, traditional, tones/ü, duplicates, limits and missing queries.');
if(process.env.CVDICT_PATH)(async()=>{
 const text=fs.readFileSync(process.env.CVDICT_PATH,'utf8');
 assert.equal(createHash('sha256').update(text).digest('hex'),'4dde4b204193efa9c192d7f7daeab1bb579c8ccd7c41ed90d1b6caee22ba0948');
 const start=Date.now(),data=engine.parseDictionary(text);assert.equal(data.length,122596);
 for(const [q,expected] of [['chim bồ câu','鸽子'],['hợp đồng','合同'],['máy tính','电脑'],['điện áp','电压'],['quang hợp','光合作用'],['bệnh viện','医院'],['xe đạp','自行车'],['hòa bình','和平'],['quả táo','苹果'],['ge1 zi5','鸽子']])assert(engine.searchDictionary(data,q).items.some(x=>x.hanzi===expected),q);
 for(const [q,word] of [['con mèo','猫'],['hoa sen','荷花']]){const result=engine.searchDictionary(data,q);assert.equal(result.items.length,1);assert.equal(result.items[0].hanzi,word);}
 assert(!engine.searchDictionary(data,'con mèo').items.some(x=>['毛','门','门道'].includes(x.hanzi)));
 let requests=0,fail=true,messages=[];
 const self={postMessage:x=>messages.push(x)};
 const c={self,crypto:webcrypto,TextEncoder,AbortController,setTimeout,clearTimeout,fetch:async()=>{requests++;return{ok:true,text:async()=>fail?'corrupt':text}}};
 vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(__dirname,'../dictionary/search-worker.js'),'utf8'),c);
 await self.onmessage({data:{id:1,query:'chim bồ câu'}});assert(messages[0].error);assert.equal(requests,2);
 fail=false;await self.onmessage({data:{id:2,query:'chim bồ câu'}});assert.equal(messages[1].entries,122596);assert(messages[1].items.some(x=>x.hanzi==='鸽子'));
 const count=requests;await self.onmessage({data:{id:3,query:'điện áp'}});assert.equal(requests,count);assert.equal(messages[2].items[0].hanzi,'电压');
 console.log(`PASS: full 122,596-entry snapshot, 10 topics/queries, checksum rejection, retry, memory reuse and unavailable IndexedDB (${Date.now()-start}ms).`);
})().catch(e=>{console.error(e);process.exitCode=1});
