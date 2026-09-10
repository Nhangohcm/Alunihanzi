const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const source=fs.readFileSync(require('node:path').join(__dirname,'../writing-lookup-fallback.js'),'utf8');
let calls=0, fail=true, stored='broken', quota=false;
const context={document:{readyState:'complete'},localStorage:{getItem:()=>stored,setItem:(key,value)=>{assert.equal(key,'aluni_writing_translation_cache_v1');if(quota)throw Error('quota');stored=value}},savedWritingVocabulary:()=>[{hanzi:'老师',pinyin:'Lǎoshī',vi:'Giáo viên'}],translateVietnameseForWriting:async raw=>{calls++;if(fail)throw Error('offline');return {hanzi:'苹果',pinyin:'Píngguǒ',vi:raw}}};context.window=context;vm.createContext(context);vm.runInContext(source,context);
(async()=>{
 for(const query of ['con khủng long','khủng long','CON KHUNG LONG','  con   khủng long ']){const item=await context.translateVietnameseForWriting(query);assert.equal(item.hanzi,'恐龙');assert.equal(item.pinyin,'Kǒnglóng')}
 assert.equal((await context.translateVietnameseForWriting('giáo viên')).hanzi,'老师');assert.equal(calls,0);
 await assert.rejects(context.translateVietnameseForWriting('từ mới'),/offline/);
 fail=false;await context.translateVietnameseForWriting('quả táo');const count=calls;fail=true;assert.equal((await context.translateVietnameseForWriting('quả táo')).hanzi,'苹果');assert.equal(calls,count);
 stored='[]';quota=true;fail=false;assert.equal((await context.translateVietnameseForWriting('quả táo')).hanzi,'苹果');
 console.log('PASS: Vietnamese aliases offline, saved vocabulary, successful cache reuse, failed requests and quota handling.');
})().catch(e=>{console.error(e);process.exitCode=1});

// Exercise actual button and Enter bindings, all three input forms, and lazy course data.
(async()=>{
 const {parseHTML}=require('linkedom');
 const {document}=parseHTML('<html><body><input id="searchInput"><button id="searchBtn"></button><p id="writingSearchHint"></p></body></html>');
 let results=[], external=0;
 const c={document,localStorage:{getItem:()=>null,setItem:()=>{}},courses:[],ALUNI_DEFAULT_DATA:[{lessons:[{items:[{hanzi:'老师',pinyin:'Lǎoshī',vi:'Giáo viên'}]}]}],doSearch:()=>{},renderItems:items=>{results=items},translateVietnameseForWriting:async()=>{external++;throw Error('429')},translateChineseForWriting:async()=>{external++;throw Error('429')}};
 c.window=c;vm.createContext(c);vm.runInContext(source,c);
 for(const [hanzi,queries] of [['猪',['con heo','con lợn','heo','lon','猪','zhū','zhu','zhu1']],['恐龙',['con khủng long','恐龙','kǒnglóng','konglong','kong long','kong3 long2']],['老师',['老师','laoshi','lǎo shī','giáo viên']]]){
   for(const query of queries){document.getElementById('searchInput').value=query;await document.getElementById('searchBtn').onclick();assert.equal(results[0].hanzi,hanzi,query)}
 }
 assert.equal(external,0);
 document.getElementById('searchInput').value='con heo';document.getElementById('searchInput').onkeydown({key:'Enter'});assert.equal(results[0].hanzi,'猪');
 const examples=JSON.parse(fs.readFileSync(require('node:path').join(__dirname,'../writing-examples.json'),'utf8')).entries;
 for(const word of ['猪','恐龙']) assert(examples.some(e=>e.words.includes(word)&&e.hanzi.includes(word)&&e.pinyin&&e.vi));
 console.log('PASS: search button/Enter for Hanzi, spaced/toned/numbered pinyin, Vietnamese aliases and shared examples.');
})().catch(e=>{console.error(e);process.exitCode=1});

(async()=>{
 const {parseHTML}=require('linkedom');
 const {document}=parseHTML('<html><body><input id="searchInput"><button id="searchBtn"></button><p id="writingSearchHint"></p></body></html>');
 let worker,results=[];
 class FakeWorker{constructor(){worker=this;this.requests=[]}postMessage(data){this.requests.push(data)}terminate(){}}
 const c={document,Worker:FakeWorker,setTimeout,clearTimeout,localStorage:{getItem:()=>null,setItem:()=>{}},doSearch:()=>{},translateVietnameseForWriting:async()=>{throw Error('must not call translator')},renderItems:items=>{results=items}};
 c.window=c;vm.createContext(c);vm.runInContext(source,c);
 document.getElementById('searchInput').value='chim bồ câu';const first=c.doSearch();
 document.getElementById('searchInput').value='điện áp';const second=c.doSearch();
 worker.onmessage({data:{id:worker.requests[1].id,total:1,items:[{hanzi:'电压',pinyin:'diàn yā',vi:'điện áp',_dictionary:'CVDICT'}]}});await second;
 worker.onmessage({data:{id:worker.requests[0].id,total:1,items:[{hanzi:'鸽子',pinyin:'gē zi',vi:'chim bồ câu',_dictionary:'CVDICT'}]}});await first;
 assert.equal(results[0].hanzi,'电压');assert.equal(document.querySelectorAll('#writingDictionarySource').length,1);
 document.getElementById('searchInput').value='con heo';const third=c.doSearch();worker.onmessage({data:{id:worker.requests[2].id,error:'offline'}});await third;assert.equal(results[0].hanzi,'猪');
 console.log('PASS: async dictionary results, stale query protection, visible attribution and local results retained on load failure.');
})().catch(e=>{console.error(e);process.exitCode=1});

(async()=>{
 const {parseHTML}=require('linkedom');
 const {document}=parseHTML('<html><body><input id="searchInput"><button id="searchBtn"></button><p id="writingSearchHint"></p></body></html>');
 let worker,results=[],translated=[],fail=false;
 class FakeWorker{constructor(){worker=this;this.requests=[]}postMessage(data){this.requests.push(data)}terminate(){}}
 const c={document,Worker:FakeWorker,setTimeout,clearTimeout,localStorage:{getItem:()=>null,setItem:()=>{}},doSearch:()=>{},translateVietnameseForWriting:async raw=>{translated.push(raw);if(fail)throw Error('429');return{hanzi:raw==='Quả đào'?'桃':'蚂蚁',pinyin:'test',vi:raw}},translateChineseForWriting:async raw=>({hanzi:raw,pinyin:'mǎ yǐ',vi:'Con kiến'}),renderItems:items=>{results=items}};
 c.window=c;vm.createContext(c);vm.runInContext(source,c);
 for(const [query,error] of [['Quả đào',false],['Con kiến',true]]){
 document.getElementById('searchInput').value=query;const pending=c.doSearch();const id=worker.requests.at(-1).id;worker.onmessage({data:error?{id,error:'network'}:{id,total:0,items:[]}});await pending;
 assert.equal(translated.at(-1),query);assert.equal(results.length,1);assert(document.getElementById('writingSearchHint').textContent.includes('Kết quả dịch'));
 }
 document.getElementById('searchInput').value='bạch tuột';const pending=c.doSearch();assert.equal(worker.requests.at(-1).query,'bạch tuộc');worker.onmessage({data:{id:worker.requests.at(-1).id,total:1,items:[{hanzi:'章鱼',pinyin:'zhāng yú',vi:'bạch tuộc',_dictionary:'CVDICT'}]}});await pending;assert.equal(results[0].hanzi,'章鱼');assert(document.getElementById('writingSearchHint').textContent.includes('bạch tuộc'));
 fail=true;document.getElementById('searchInput').value='không có kết quả';const empty=c.doSearch();worker.onmessage({data:{id:worker.requests.at(-1).id,total:0,items:[]}});await empty;assert.equal(results.length,0);assert(!document.getElementById('writingSearchHint').textContent.includes('Chọn thẻ'));
 console.log('PASS: production translation fallback after dictionary miss/error, spelling correction, truthful empty state.');
})().catch(e=>{console.error(e);process.exitCode=1});
