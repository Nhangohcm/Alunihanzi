// Keep known Vietnamese lookups usable when the external translator is unavailable.
(() => {
  function init() {
    if (typeof translateVietnameseForWriting !== 'function') return;
    const original = translateVietnameseForWriting;
    const cacheKey = 'aluni_writing_translation_cache_v1';
    const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase().trim().replace(/\s+/g, ' ');
    const additions = [
      {hanzi:'恐龙',pinyin:'Kǒnglóng',vi:'Con khủng long',aliases:['khủng long','con khủng long']},
      {hanzi:'猪',pinyin:'Zhū',vi:'Con heo (con lợn)',aliases:['heo','con heo','lợn','con lợn']}
    ];
    const pinyinKey = value => normalize(value).replace(/[1-5]/g,'').replace(/[^a-z]/g,'');
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
    // One search path for Hanzi, pinyin and Vietnamese across all available pools.
    if (typeof doSearch === 'function') {
      let requestId=0;
      doSearch = async function() {
        const id=++requestId, raw=document.getElementById('searchInput').value.trim();
        const hint=document.getElementById('writingSearchHint');
        if (!raw) { hint.textContent='Nhập tiếng Việt, chữ Hán hoặc pinyin để tra từ.'; return renderItems([],'Kết quả tìm kiếm'); }
        let results=matches(raw);
        hint.textContent=results.length?'Chọn thẻ từ để nghe và luyện viết.':'Đang tra cứu…';
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
