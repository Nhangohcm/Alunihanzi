// Keep known Vietnamese lookups usable when the external translator is unavailable.
(() => {
  function init() {
    if (typeof translateVietnameseForWriting !== 'function') return;
    const original = translateVietnameseForWriting;
    const cacheKey = 'aluni_writing_translation_cache_v1';
    const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase().trim().replace(/\s+/g, ' ');
    const dinosaur = {hanzi: '恐龙', pinyin: 'Kǒnglóng', vi: 'Con khủng long'};
    const valid = item => item && typeof item.hanzi === 'string' && /\p{Script=Han}/u.test(item.hanzi) && item.hanzi.length <= 200 && typeof item.vi === 'string' && typeof item.pinyin === 'string';
    function readCache() {
      try { const data = JSON.parse(localStorage.getItem(cacheKey) || '[]'); return Array.isArray(data) ? data.filter(x => typeof x?.query === 'string' && valid(x.item)).slice(0,200) : []; } catch (_) { return []; }
    }
    translateVietnameseForWriting = async function(raw) {
      const query = normalize(raw);
      if (query === 'khung long' || query === 'con khung long') return {...dinosaur};
      const words = typeof savedWritingVocabulary === 'function' ? [...savedWritingVocabulary()] : [];
      for (const course of window.ALUNI_DEFAULT_DATA || []) for (const lesson of course.lessons || []) words.push(...(lesson.items || []));
      const known = words.find(item => valid(item) && normalize(item.vi) === query);
      if (known) return {hanzi:known.hanzi,pinyin:known.pinyin,vi:known.vi};
      const cached = readCache().find(entry => entry.query === query);
      if (cached) return {...cached.item};
      const item = await original(raw);
      if (valid(item)) {
        try { localStorage.setItem(cacheKey, JSON.stringify([{query,item:{hanzi:item.hanzi,pinyin:item.pinyin,vi:item.vi}},...readCache().filter(entry => entry.query !== query)].slice(0,200))); } catch (_) {}
      }
      return item;
    };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();
