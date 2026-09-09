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
