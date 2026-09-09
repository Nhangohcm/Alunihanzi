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
