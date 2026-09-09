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
    style.textContent = '#practiceCard #writingExample{margin:14px 0;padding:14px;border:1px solid #e0e4f1;border-radius:14px;background:#f7f8ff;text-align:left;overflow-wrap:anywhere}#practiceCard #writingExample[hidden]{display:none!important}#writingExample .writing-example-head{display:flex;align-items:center;justify-content:space-between;gap:10px}#writingExample .writing-example-head button{min-height:44px;flex-shrink:0}#writingExample p{margin:8px 0 0;line-height:1.55}#writingExample .writing-example-zh{font-size:1.35rem;color:#26334f}#writingExample .writing-example-py{color:#5b64ca}#writingExample .writing-example-vi{color:#65708a}#writingExample mark{color:#453bb0;background:#e8e4ff;border-radius:4px;padding:0 2px}@media(max-width:480px){#practiceCard #writingExample{padding:11px}#writingExample .writing-example-zh{font-size:1.2rem}#writingExample .writing-example-head button{padding:7px 10px;font-size:.88rem}}';
    document.head.appendChild(style);
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
      const word = String(item?.hanzi || '').trim(); if (!word) return;
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
