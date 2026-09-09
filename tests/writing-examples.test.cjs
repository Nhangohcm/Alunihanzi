// Run from tests: node writing-examples.test.cjs (npm install first).
const {parseHTML, Event} = require('linkedom');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'writing-examples.js'), 'utf8');
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'writing-examples.json'), 'utf8'));
const fixture = '<html><head></head><body><div id="words">Original word cards</div><section id="practiceCard"><div id="writerTarget">Writer</div><div class="radical-info">Radicals</div></section></body></html>';
function setup(initialItem = null, extra = {}) {
  const {document} = parseHTML(fixture);
  let requests = 0, resolveData, spoken, opened = [];
  const context = {document, currentItem: initialItem, speak: text => { spoken = text; }, openPractice: (item, scroll) => { opened.push([item, scroll]); return 'original-result'; }, fetch: () => { requests++; return new Promise(resolve => { resolveData = resolve; }); }};
  Object.assign(context, extra); context.window = context;
  vm.createContext(context); vm.runInContext(source, context);
  return {document, context, requests: () => requests, opened, spoken: () => spoken, complete: (data = catalog, ok = true) => resolveData({ok, json: async () => data})};
}
const tick = () => new Promise(setImmediate);
(async () => {
  const a = setup(); const box = a.document.getElementById('writingExample');
  assert.equal(a.requests(), 0, 'no examples fetch at page initialization');
  assert.equal(box.hidden, true);
  assert.equal(box.nextElementSibling.className, 'radical-info');
  assert.equal(a.context.openPractice({hanzi: '你好'}, false), 'original-result');
  assert.equal(a.opened[0][1], false); assert.equal(a.requests(), 1);
  a.complete(); await tick();
  assert.equal(box.hidden, false); assert.equal(box.querySelector('mark').textContent, '你好');
  box.querySelector('button').dispatchEvent(new Event('click', {bubbles: true}));
  assert.equal(a.spoken(), '你好，很高兴认识你。');
  a.context.openPractice({hanzi: '不存在的词'}); assert.equal(box.hidden, true); await tick(); assert.equal(box.hidden, true);
  assert.equal(a.document.getElementById('words').innerHTML, 'Original word cards');
  assert.equal(a.document.getElementById('writerTarget').textContent, 'Writer');
  assert.equal(a.document.querySelector('.radical-info').textContent, 'Radicals');
  const seen = new Set();
  for (const entry of catalog.entries) for (const word of entry.words) {
    assert(!seen.has(word), `duplicate word ${word}`); seen.add(word);
    assert(entry.hanzi.includes(word)); assert(entry.pinyin.trim()); assert(entry.vi.trim());
    a.context.openPractice({hanzi: word}); await tick();
    assert.equal(box.hidden, false); assert.equal(box.querySelector('mark').textContent, word);
  }
  assert.equal(a.requests(), 1, 'catalog reused when switching words');
  const b = setup(); b.context.openPractice({hanzi: '你好'});
  b.context.openPractice({hanzi: '老师', example: {hanzi: '老师说：<img src=x onerror=bad()>', pinyin: 'Lǎoshī shuō', vi: 'Câu riêng của bài'}});
  b.complete(); await tick();
  const bBox = b.document.getElementById('writingExample');
  assert.equal(bBox.querySelector('mark').textContent, '老师', 'old request cannot replace new word');
  assert.equal(bBox.querySelector('img'), null, 'example text is not interpreted as HTML');
  assert.match(bBox.textContent, /Câu riêng/);
  b.context.openPractice({hanzi: 'không có', example: {hanzi: 'sai từ', pinyin: 'x', vi: 'x'}}); await tick();
  assert.equal(bBox.hidden, true, 'mismatched example hidden');
  const c = setup(); c.context.openPractice({hanzi: '你好'}); c.complete(null, false); await tick();
  assert.equal(c.opened.length, 1, 'writer opens despite missing optional catalog');
  assert.equal(c.document.getElementById('writingExample').hidden, true);
  c.context.openPractice({hanzi: '你好'}); assert.equal(c.requests(), 2, 'failed fetch can retry');
  // HSK links may have opened a word before the examples script loads.
  const hsk = setup({hanzi: '老师'}); hsk.complete(); await tick();
  assert.equal(hsk.document.querySelector('#writingExample mark').textContent, '老师');
  // Exercise the actual course word-card renderer and click into the shared openPractice wrapper.
  const course = setup();
  for (const id of ['resultsTitle', 'resultCount']) {const node = course.document.createElement('div'); node.id = id; course.document.body.appendChild(node);}
  Object.assign(course.context, {$: id => course.document.getElementById(id), isHan: () => true,
    extractChars: text => [...text], esc: text => text, writingSavedKey: item => item.hanzi,
    toggleWritingWordSaved() {}, openWritingDictionary() {}});
  const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  vm.runInContext(index.slice(index.indexOf('function renderItems('), index.indexOf('const WRITING_SAVED_KEY')), course.context);
  const begin = index.indexOf('function createWritingWordCard(');
  vm.runInContext(index.slice(begin, index.indexOf('\nfunction ', begin + 1)), course.context);
  course.context.renderItems([{hanzi: '老师', pinyin: 'lǎoshī', vi: 'giáo viên'}], 'Bài học');
  course.document.querySelector('#words .word').onclick(); course.complete(); await tick();
  assert.equal(course.document.querySelector('#writingExample mark').textContent, '老师', 'course cards reach shared examples');
  let externalCalls = 0, rendered;
  const local = setup(null, {
    ALUNI_DEFAULT_DATA: [{lessons: [{items: [{hanzi: '老师', pinyin: 'lǎoshī', vi: 'giáo viên'}]}]}],
    createWritingWordCard: item => { rendered = item; return item; },
    translateChineseForWriting: async () => {externalCalls++; return {hanzi: '外'};},
    getWritingPinyin: async () => {externalCalls++; return 'wài';}
  });
  assert.equal((await local.context.translateChineseForWriting('老师')).vi, 'giáo viên');
  assert.equal(await local.context.getWritingPinyin('老师'), 'lǎoshī');
  const missing = {hanzi: '老师', pinyin: '', vi: 'Tra từ và luyện viết'};
  local.context.createWritingWordCard(missing);
  assert.equal(rendered.pinyin, 'lǎoshī'); assert.equal(missing.vi, 'giáo viên'); assert.equal(externalCalls, 0);
  local.context.createWritingWordCard({hanzi: '老师', pinyin: 'Custom', vi: 'Nghĩa trong bài'});
  assert.equal(rendered.pinyin, 'Custom'); assert.equal(rendered.vi, 'Nghĩa trong bài');
  await local.context.translateChineseForWriting('外'); assert.equal(externalCalls, 1);
  a.context.openPractice({hanzi: '几点了?'}); await tick(); assert.equal(box.hidden, false);
  a.context.openPractice({hanzi: '一刻'}); await tick(); assert.equal(box.querySelector('mark').textContent, '一刻');
  console.log('PASS: local vocabulary restores missing fields, preserves lesson data, external fallback, time lesson and punctuation.');
  console.log('PASS: course card click and already-open HSK word use shared examples.');
  console.log(`PASS: ${seen.size} word examples; insertion, highlighting, speech, unchanged writer/cards/radicals, explicit data, request race, XSS, missing data, retry and lazy caching.`);
})().catch(e => { console.error(e); process.exitCode = 1; });
