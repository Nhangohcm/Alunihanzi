/* Optional examples inside the final writing workspace only. */
(() => {
  'use strict';
  function init() {
    const card = document.getElementById('practiceCard');
    const radicals = card?.querySelector('.radical-info');
    if (!radicals || typeof openPractice !== 'function' || document.getElementById('writingExample')) return;
    const box = document.createElement('section');
    box.id = 'writingExample'; box.hidden = true; box.setAttribute('aria-label', 'Câu ví dụ');
    box.innerHTML = '<div class="writing-example-head"><strong>Câu ví dụ</strong><button type="button" class="btn soft" aria-label="Nghe câu ví dụ">🔊 Nghe câu</button></div><p class="writing-example-zh"></p><p class="writing-example-py"></p><p class="writing-example-vi"></p>';
    radicals.before(box);
    const style = document.createElement('style');
    style.textContent = '#practiceCard #writingExample{width:min(620px,94%);box-sizing:border-box;margin:14px auto 0;padding:14px 16px;border:1px solid #e0e4f1;border-radius:14px;background:#f7f8ff;text-align:left;overflow-wrap:anywhere}#practiceCard #writingExample[hidden]{display:none!important}#writingExample .writing-example-head{display:flex;align-items:center;justify-content:space-between;gap:10px}#writingExample .writing-example-head button{min-height:44px;flex-shrink:0}#writingExample p{margin:8px 0 0;line-height:1.55}#writingExample .writing-example-zh{font-size:1.35rem;color:#26334f}#writingExample .writing-example-py{color:#5b64ca}#writingExample .writing-example-vi{color:#65708a}#writingExample mark{color:#453bb0;background:#e8e4ff;border-radius:4px;padding:0 2px}@media(max-width:480px){#practiceCard #writingExample{padding:11px}#writingExample .writing-example-zh{font-size:1.2rem}#writingExample .writing-example-head button{padding:7px 10px;font-size:.88rem}}';
    // All entry points share practiceCard. Retain hidden metadata nodes for existing setters.
    style.textContent += `
      #practiceCard .practice-top>.brand,#practiceCard #practiceWord,#practiceCard .practice-meta{display:none!important}
      #practiceCard .practice-top{display:flex!important;align-items:center;justify-content:center;
        flex-wrap:nowrap;gap:10px;min-width:0;margin:0 0 10px;padding:0}
      #practiceCard #charPills{display:flex;flex:0 1 auto;min-width:0;max-width:100%;
        flex-wrap:nowrap;overflow-x:auto;justify-content:flex-start;gap:6px;margin:0;padding:2px;grid-area:auto}
      #practiceCard #charPills .char-pill{flex:0 0 auto;min-width:44px;min-height:44px}
      #practiceCard #speakPractice{flex:0 0 auto;min-height:44px;margin:0;white-space:nowrap;grid-area:auto}
      @media(max-width:480px){#practiceCard .practice-top{gap:6px}
        #practiceCard #speakPractice{font-size:.88rem;padding:8px 10px}}
    `;
    document.head.appendChild(style);
    // Prefer existing local course vocabulary before external translation. Course catalogs can be lazy.
    const localWords = new Map();
    for (const course of window.ALUNI_DEFAULT_DATA || []) for (const lesson of course.lessons || []) {
      for (const item of lesson.items || []) {
        const key = String(item.hanzi || '').trim();
        if (key && item.pinyin && item.vi && !localWords.has(key)) localWords.set(key, item);
      }
    }
    function completeLocalWord(item) {
      const known = localWords.get(String(item?.hanzi || '').trim());
      if (!known) return item;
      if (!String(item.pinyin || '').trim() || item.pinyin === 'Chưa có pinyin') item.pinyin = known.pinyin;
      if (!String(item.vi || '').trim() || /^(Tra từ và luyện viết|Luyện viết chữ này)$/.test(item.vi)) item.vi = known.vi;
      return item;
    }
    if (typeof createWritingWordCard === 'function') {
      const originalCard = createWritingWordCard;
      createWritingWordCard = function(item, onOpen) { return originalCard(completeLocalWord(item), onOpen); };
    }
    if (typeof translateChineseForWriting === 'function') {
      const originalTranslate = translateChineseForWriting;
      translateChineseForWriting = async function(raw) {
        const known = localWords.get(String(raw || '').trim());
        return known ? {hanzi: String(raw).trim(), pinyin: known.pinyin, vi: known.vi} : originalTranslate(raw);
      };
    }
    if (typeof getWritingPinyin === 'function') {
      const originalPinyin = getWritingPinyin;
      getWritingPinyin = async function(hanzi) {
        const known = localWords.get(String(hanzi || '').trim());
        return known ? known.pinyin : originalPinyin(hanzi);
      };
    }
    let examplesPromise, requestId = 0, shown = null;
    function valid(example, word) {
      return example && typeof example.hanzi === 'string' && example.hanzi.length <= 300 &&
        example.hanzi.includes(word) && typeof example.pinyin === 'string' && example.pinyin.trim() &&
        typeof example.vi === 'string' && example.vi.trim();
    }
    function loadExamples() {
      if (!examplesPromise) examplesPromise = fetch('writing-examples.json?v=1')
        .then(r => { if (!r.ok) throw Error('Examples unavailable'); return r.json(); })
        .then(data => { if (data.version !== 1 || !Array.isArray(data.entries)) throw Error('Invalid examples'); return data.entries; })
        .catch(() => { examplesPromise = null; return []; });
      return examplesPromise;
    }
    function paint(example, word) {
      shown = example;
      const zh = box.querySelector('.writing-example-zh'); zh.replaceChildren();
      const parts = example.hanzi.split(word);
      parts.forEach((part, i) => {
        if (i) { const mark = document.createElement('mark'); mark.textContent = word; zh.appendChild(mark); }
        zh.appendChild(document.createTextNode(part));
      });
      box.querySelector('.writing-example-py').textContent = example.pinyin;
      box.querySelector('.writing-example-vi').textContent = example.vi;
      box.hidden = false;
    }
    async function show(item) {
      const version = ++requestId; shown = null; box.hidden = true;
      const word = String(item?.hanzi || '').trim().replace(/\?/g, '？'); if (!word) return;
      // Explicit examples are word-level data, independent of the selected character/radical.
      if (valid(item.example, word)) { paint(item.example, word); return; }
      const entries = await loadExamples();
      if (version !== requestId) return;
      const entry = entries.find(x => Array.isArray(x.words) && x.words.includes(word) && valid(x, word));
      if (entry) paint(entry, word);
    }
    box.querySelector('button').addEventListener('click', event => {
      event.preventDefault(); event.stopPropagation();
      if (shown && !box.hidden && typeof speak === 'function') speak(shown.hanzi);
    });
    const base = openPractice;
    openPractice = function(item, ...args) {
      const result = base.call(this, item, ...args);
      // An optional example must never prevent the writer from opening.
      show(item).catch(() => { box.hidden = true; shown = null; });
      return result;
    };
    if (typeof currentItem !== 'undefined' && currentItem) show(currentItem).catch(() => {});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
