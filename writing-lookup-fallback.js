// Keep known Vietnamese lookups usable when the external translator is unavailable.
(() => {
  const dictionaryWorkerUrl = typeof document.currentScript?.src === 'string' ? new URL('dictionary/search-worker.js',document.currentScript.src).href : 'dictionary/search-worker.js';
  function init() {
    if (typeof translateVietnameseForWriting !== 'function') return;
    const original = translateVietnameseForWriting;
    const cacheKey = 'aluni_writing_translation_cache_v1';
    const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase().trim().replace(/\s+/g, ' ');
    const additions = [
      {hanzi:'恐龙',pinyin:'Kǒnglóng',vi:'Con khủng long',aliases:['khủng long','con khủng long']},
      {hanzi:'猪',pinyin:'Zhū',vi:'Con heo (con lợn)',aliases:['heo','con heo','lợn','con lợn']}
    ];
    const pinyinKey = value => normalize(String(value).toLowerCase().replace(/u:|ü|ǖ|ǘ|ǚ|ǜ/g,'v')).replace(/[1-5]/g,'').replace(/[^a-z]/g,'');
    function vocabulary() {
      const words = [...additions];
      const catalogs = [window.ALUNI_DEFAULT_DATA || [], typeof courses !== 'undefined' ? courses : []];
      for (const catalog of catalogs) for (const course of catalog) for (const lesson of course.lessons || []) words.push(...(lesson.items || []));
      if (typeof savedWritingVocabulary === 'function') words.push(...savedWritingVocabulary());
      words.push(...readCache().map(x=>({...x.item,aliases:[x.query]})));
      return words.filter(valid);
    }
    function matches(raw) {
      const q=normalize(raw), py=pinyinKey(raw), found=new Map();
      for (const item of vocabulary()) {
        const meanings=[item.vi,...(item.aliases||[]),...String(item.vi).split(/[;,/()]/)].map(normalize).filter(Boolean);
        const exact=item.hanzi===raw || (py && pinyinKey(item.pinyin)===py) || meanings.includes(q);
        const partial=item.hanzi.includes(raw) || meanings.some(v=>v.includes(q));
        if ((exact||partial)&&!found.has(item.hanzi)) found.set(item.hanzi,{item,score:exact?2:1});
      }
      return [...found.values()].sort((a,b)=>b.score-a.score).map(x=>({...x.item}));
    }
    const valid = item => item && typeof item.hanzi === 'string' && /\p{Script=Han}/u.test(item.hanzi) && item.hanzi.length <= 200 && typeof item.vi === 'string' && typeof item.pinyin === 'string';
    function readCache() {
      try { const data = JSON.parse(localStorage.getItem(cacheKey) || '[]'); return Array.isArray(data) ? data.filter(x => typeof x?.query === 'string' && valid(x.item)).slice(0,200) : []; } catch (_) { return []; }
    }
    translateVietnameseForWriting = async function(raw) {
      const query = normalize(raw);
      const known = matches(String(raw).trim())[0];
      if (known) return known;
      const item = await original(raw);
      if (valid(item)) {
        try { localStorage.setItem(cacheKey, JSON.stringify([{query,item:{hanzi:item.hanzi,pinyin:item.pinyin,vi:item.vi}},...readCache().filter(entry => entry.query !== query)].slice(0,200))); } catch (_) {}
      }
      return item;
    };
    let dictionaryWorker, jobId=0;
    const jobs=new Map();
    function dictionarySearch(query) {
      if(!dictionaryWorker){
        dictionaryWorker=new Worker(dictionaryWorkerUrl);
        dictionaryWorker.onmessage=event=>{const data=event.data,job=jobs.get(data.id);if(!job)return;clearTimeout(job.timer);jobs.delete(data.id);data.error?job.reject(Error(data.error)):job.resolve(data)};
        dictionaryWorker.onerror=()=>{for(const job of jobs.values()){clearTimeout(job.timer);job.reject(Error('Không mở được bộ từ điển.'))}jobs.clear();dictionaryWorker.terminate();dictionaryWorker=null;};
      }
      return new Promise((resolve,reject)=>{const id=++jobId,timer=setTimeout(()=>{jobs.delete(id);reject(Error('Tải từ điển lâu hơn dự kiến. Vui lòng thử lại.'));},60000);jobs.set(id,{resolve,reject,timer});dictionaryWorker.postMessage({id,query});});
    }
    function sourceNote() {
      if(document.getElementById('writingDictionarySource'))return;
      const note=document.createElement('p');note.id='writingDictionarySource';note.className='hint';
      note.innerHTML='Nguồn từ điển: <a href="https://github.com/ph0ngp/CVDICT" target="_blank" rel="noopener">CVDICT — Phong Phan</a>, từ CC-CEDICT · <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener">CC BY-SA 4.0</a>. Nghĩa Việt có hỗ trợ dịch bằng AI và có thể còn sai sót.';
      document.getElementById('writingSearchHint').after(note);
    }
    // One search path for Hanzi, pinyin and Vietnamese across all available pools.
    if (typeof doSearch === 'function') {
      let requestId=0;
      doSearch = async function() {
        const id=++requestId, raw=document.getElementById('searchInput').value.trim();
        const hint=document.getElementById('writingSearchHint');
        if (!raw) { hint.textContent='Nhập tiếng Việt, chữ Hán hoặc pinyin để tra từ.'; return renderItems([],'Kết quả tìm kiếm'); }
        let results=matches(raw);
        hint.textContent=results.length?'Chọn thẻ từ để nghe và luyện viết.':'Đang tra cứu…';
        if(typeof Worker !== 'undefined') {
          sourceNote();
          if(results.length)renderItems(results,`Kết quả: ${raw}`);
          hint.textContent='Đang tra từ điển Trung–Việt… Lần đầu cần tải dữ liệu, các lần sau sẽ nhanh hơn.';
          try {
            const data=await dictionarySearch(raw);if(id!==requestId)return;
            const seen=new Set(results.map(x=>x.hanzi+'|'+pinyinKey(x.pinyin)));
            for(const item of data.items){const key=item.hanzi+'|'+pinyinKey(item.pinyin);if(!seen.has(key)){seen.add(key);results.push(item)}else{const existing=results.find(x=>x._dictionary&&x.hanzi===item.hanzi&&pinyinKey(x.pinyin)===pinyinKey(item.pinyin));if(existing&&!existing.vi.includes(item.vi))existing.vi+='; '+item.vi;}}
            hint.textContent=data.total>data.items.length?`Đang hiện các kết quả phù hợp nhất trong ${data.total} mục. Nhập cụ thể hơn để thu hẹp.`:'Chọn thẻ từ để nghe, lưu và luyện viết.';
          } catch(error) {if(id!==requestId)return;hint.textContent=error.message;}
          if(id===requestId)renderItems(results,results.length?`Kết quả: ${raw}`:`Chưa có kết quả: ${raw}`);
          return;
        }
        if (!results.length) {
          try {
            const item=/\p{Script=Han}/u.test(raw) ? await translateChineseForWriting(raw) : await translateVietnameseForWriting(raw);
            if(id!==requestId)return;
            results=[item];hint.textContent='Kết quả dịch tham khảo ngoài kho Aluni. Hãy kiểm tra nghĩa trước khi luyện viết.';
          } catch (_) {
            if(id!==requestId)return;
            hint.textContent='Chưa có kết quả trong kho; dịch vụ tra cứu bên ngoài hiện không phản hồi. Anh/chị có thể thử lại sau.';
          }
        }
        if(id===requestId)renderItems(results,results.length?`Kết quả: ${raw}`:`Không tìm thấy: ${raw}`);
      };
      document.getElementById('searchBtn').onclick=doSearch;
      document.getElementById('searchInput').onkeydown=event=>{if(event.key==='Enter')doSearch();};
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();
