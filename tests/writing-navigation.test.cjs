const {parseHTML} = require('linkedom');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const data = fs.readFileSync(path.join(root, 'data.js'), 'utf8');
assert.match(html, /data\.js\?v=20260910-2/);
assert.match(data, /sentence-saves\.js\?v=20260910-2/);

const {document} = parseHTML('<html><body class="writing-practice-mode"><section id="writingSection"></section><div id="practiceCard" class="show"></div><div id="writingStudyTitle"></div><div id="resultsTitle"></div><div id="resultCount"></div><div id="words"></div></body></html>');
document.getElementById('writingSection').scrollTo = () => {};
const pending = new Map(), rendered = [];
const context = {
  document, console, writingLessonLoadVersion: 0, writingCourseContext: null,
  currentItem: {hanzi: '谢谢'}, currentChars: ['谢'], practiceItems: [{hanzi: '谢谢'}],
  selectedCourseObj: null, selectedLessonObj: null,
  publicLearningCourses: [{id: '50plus', title: '50+'}],
  setActiveAppSection() {}, trackAnalytics() {}, trackActivatedLearner() {}, aluniPushView() {},
  api: value => value, esc: String, warmAudio() {},
  renderItems(items, title) { rendered.push({items, title}); },
  fetch(url) { return new Promise(resolve => pending.set(url, resolve)); },
};
context.$ = id => document.getElementById(id);
context.window = context;
vm.createContext(context);
const start = html.indexOf('async function openWritingLesson(');
const end = html.indexOf('\nfunction leaveWritingStudyUi', start);
vm.runInContext(html.slice(start, end), context);

(async () => {
  const first = context.openWritingLesson('50plus', 1);
  assert.equal(document.body.classList.contains('writing-practice-mode'), false);
  assert.equal(document.getElementById('practiceCard').classList.contains('show'), false);
  assert.match(document.getElementById('words').textContent, /Đang tải/);
  const second = context.openWritingLesson('50plus', 2);
  pending.get('/content/lesson?course_id=50plus&lesson_number=2')({ok: true, json: async () => ({lesson: {title: 'Bài 02', items: [{hanzi: '二'}]}})});
  await second;
  pending.get('/content/lesson?course_id=50plus&lesson_number=1')({ok: true, json: async () => ({lesson: {title: 'Bài 01', items: [{hanzi: '一'}]}})});
  await first;
  assert.deepEqual(rendered.map(x => x.title), ['Bài 02'], 'a slow previous request cannot overwrite the current lesson');
  console.log('PASS: Writing clears the old card immediately and ignores stale lesson responses.');
})().catch(error => { console.error(error); process.exitCode = 1; });
