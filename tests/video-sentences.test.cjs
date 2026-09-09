// Run: cd tests && npm install && npm test
// DOM integration with real transcript renderers; YouTube/network are deterministic fakes.
const {parseHTML} = require('linkedom');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'sentence-saves.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const {document, Event, HTMLElement} = parseHTML('<html><head></head><body><section id="shadowSection"><header class="module-header"></header><div id="shadowTranscript"></div><div id="shadowLive"></div><div id="shadowCounter"></div><div id="shadowNote"></div><select id="shadowCourse"></select></section><section id="kidsPublicSection"><div id="adultKidsSeries"></div><div id="kidsStudyPanel"><h2 id="kidsStudyTitle"></h2><div id="kidsCurrentSentence"><div id="kidsCurrentZh"></div><div id="kidsCurrentPy"></div><div id="kidsCurrentVi"></div></div><div id="kidsAllSentences"><div id="kidsAllSentenceList"></div></div><div id="kidsSentenceStrip"></div></div></section></body></html>');
HTMLElement.prototype.scrollIntoView = function() {};
HTMLElement.prototype.showModal = function() { this.open = true; };
HTMLElement.prototype.close = function() { this.open = false; };
const $ = id => document.getElementById(id);
const storage = new Map(); let quota = false, seeks = 0, playback = 0, fetchCalls = 0, deny = false;
const listeners = {};
const segment = {start_sec: 1.25, end_sec: 3.5, hanzi: '你好', pinyin: 'nǐ hǎo', vi: 'Xin chào'};
const ctx = {
  document, console, setTimeout: () => 1, clearTimeout() {}, setInterval: () => 1, clearInterval() {},
  localStorage: {getItem: k => storage.get(k) ?? null, setItem: (k, v) => { if (quota) throw Error('quota'); storage.set(k, v); }},
  history: {state: {aluniLevel: 'kids-study'}, pushState(s) { this.state = s; }, back() { this.state = {aluniLevel: 'kids-study'}; for (const fn of listeners.popstate || []) fn({stopImmediatePropagation() {}}); }},
  addEventListener: (name, fn) => (listeners[name] ||= []).push(fn),
  shadowSegments: [], shadowCurrentIndex: 0, showShadowPinyin: true, showShadowVi: true,
  shadowPlayer: {pauseVideo() {}, seekTo() { seeks++; }, playVideo() { playback++; }},
  kidsPlayer: {pauseVideo() {}, seekTo() { seeks++; }, playVideo() { playback++; }},
  shadowVideos: [{id: 'legacy', title: 'Khóa video', course_id: 'course'}],
  mediaPlaylists: [{id: 'p', items: [{id: 'v', title: 'Video riêng', product_course_id: 'access'}]}],
  adultKidsData: {series: [{title: 'Truyện', lessons: [{media_item_id: 'story', title: 'Tập 1', product_course_id: 'access'}]}]},
  kidsStudySegments: [], kidsStudyIndex: -1, kidsVisibleFields: {zh: true, py: true, vi: true}, kidsStudyLesson: null,
  shadowChunkHtml: s => s.hanzi, shadowEsc: s => s,
  entitlementFor: () => ({token: 'fixture-token'}), savedEntitlements: () => ({}), ALL_ACCESS_ID: 'all', shadowApi: p => p,
  youtubeIdFromUrl: s => s ? 'abcdefghijk' : '',
  fetch: async (url, options) => { fetchCalls++; assert.equal(options.headers.Authorization, 'Bearer fixture-token'); return {ok: !deny, json: async () => deny ? {locked: true} : {segments: [segment], item: {youtube_url: 'youtube'}}}; },
  YT: {Player: function(host, options) { playback++; this.destroy = () => {}; this.options = options; }},
};
ctx.window = ctx;
vm.createContext(ctx);
// Extract unchanged production renderers and segment accessors instead of copying their behavior.
for (const name of ['kidsSegmentStart', 'kidsSegmentEnd', 'kidsSegmentZh', 'kidsSegmentPy', 'kidsSegmentVi', 'kidsSetCurrentSentence', 'kidsSeekSentence', 'kidsPaintSegments', 'renderShadowTranscript', 'renderShadowLive', 'highlightShadowLine', 'syncShadow']) {
  const begin = html.indexOf('function ' + name + '(');
  const next = html.indexOf('\nfunction ', begin + 1);
  vm.runInContext(html.slice(begin, next), ctx);
}
ctx.repeatCurrentLine = false;
ctx.loadMediaVideo = async id => { if (id === 'fail') return; ctx.shadowSegments = [segment, {...segment, start_sec: 5, end_sec: 7, hanzi: '再见'}]; ctx.renderShadowTranscript(); ctx.renderShadowLive(0); };
ctx.loadShadowVideo = async () => { ctx.shadowSegments = [segment]; ctx.renderShadowTranscript(); ctx.renderShadowLive(0); };
ctx.openKidsLesson = async (si, li) => { const series = ctx.adultKidsData.series[si]; const item = series?.lessons[li]; if (!item || item.locked) return; ctx.kidsStudyLesson = item; ctx.kidsStudySegments = [segment]; $('kidsStudyPanel').hidden = false; $('kidsStudyTitle').textContent = series.title + ' · Tập 01'; ctx.kidsPaintSegments(); };
// Linkedom select.value has no setter; native browser select does.
Object.defineProperty(Object.getPrototypeOf(document.createElement('select')), 'value', {configurable: true, get() { return this._value || ''; }, set(v) { this._value = v; }});
vm.runInContext(source, ctx);
const click = node => { assert.ok(node, 'button exists'); node.dispatchEvent(new Event('click', {bubbles: true, cancelable: true})); };
const rows = () => JSON.parse(storage.get('aluni.video-sentences.v1') || '[]');
(async () => {
  $('shadowLive').addEventListener('click', () => { seeks++; });
  await ctx.loadMediaVideo('v');
  assert.equal($('shadowTranscript').querySelectorAll('.sentence-save').length, 2);
  click($('shadowLive').querySelector('.sentence-save'));
  assert.equal($('shadowLive').querySelector('.sentence-save').textContent, '♥');
  assert.equal($('shadowLive').querySelector('.sentence-save').getAttribute('aria-label'), 'Bỏ lưu câu');
  assert.equal(rows().length, 1); assert.equal(rows()[0].start, 1.25); assert.equal(rows()[0].videoId, 'v'); assert.equal(seeks, 0, 'save does not seek video');
  assert.equal($('shadowTranscript').querySelector('.sentence-save').getAttribute('aria-pressed'), 'true');
  click($('shadowTranscript').querySelector('.sentence-save'));
  assert.equal(rows().length, 0); assert.equal(seeks, 0);
  click($('shadowLive').querySelector('.sentence-save'));
  ctx.renderShadowTranscript(); assert.equal(rows().length, 1, 'rerender does not duplicate saves');
  quota = true; click($('shadowLive').querySelector('.sentence-save')); assert.equal(rows().length, 1, 'quota failure preserves existing data'); quota = false;
  const raw = storage.get('aluni.video-sentences.v1'); storage.set('aluni.video-sentences.v1', '{broken');
  click($('shadowLive').querySelector('.sentence-save')); assert.equal(storage.get('aluni.video-sentences.v1'), '{broken', 'corrupt storage is not overwritten'); storage.set('aluni.video-sentences.v1', raw);
  document.body.classList.add('shadow-study-mode'); ctx.renderShadowLive(0); assert.equal($('shadowLive').querySelector('.sentence-save'), null, 'no save in course study'); document.body.classList.remove('shadow-study-mode');
  await ctx.openKidsLesson(0, 0); $('kidsCurrentSentence').addEventListener('click', () => { seeks++; });
  assert.equal($('kidsAllSentenceList').querySelectorAll('button button').length, 0, 'no nested buttons');
  click($('kidsCurrentSentence').querySelector('.sentence-save')); assert.equal(rows().length, 2); assert.equal(rows()[0].source, 'kids'); assert.equal(seeks, 0);
  click($('kidsPublicSection').querySelector('[data-sentence-library]'));
  const dialog = document.querySelector('dialog'); assert.equal(dialog.open, true); assert.equal(dialog.querySelectorAll('article').length, 1, 'Kids library filters source');
  click(dialog.querySelector('article button')); await new Promise(setImmediate); assert.equal(fetchCalls, 1); assert.equal(playback, 1);
  deny = true; click(dialog.querySelector('article button')); await new Promise(setImmediate); assert.equal(playback, 1, 'locked response never creates a player'); assert.match(dialog.querySelector('.sentence-status').textContent, /kích hoạt/);
  click(dialog.querySelector('[data-close]')); assert.equal(dialog.open, false); assert.equal(ctx.history.state.aluniLevel, 'kids-study');
  await ctx.loadShadowVideo('legacy'); click($('shadowLive').querySelector('.sentence-save')); assert.equal(rows().length, 3); assert.equal(rows()[0].kind, 'shadow');
  // Playback sync follows the highlighted row without seeking or moving the page.
  await ctx.loadMediaVideo('v');
  const transcript = $('shadowTranscript'); transcript.hidden = false;
  transcript.getBoundingClientRect = () => ({top: 100, bottom: 400, height: 300});
  Object.defineProperty(transcript, 'scrollHeight', {value: 900});
  Object.defineProperty(transcript, 'clientHeight', {value: 300});
  transcript.scrollTop = 0; let scrolls = 0;
  transcript.scrollTo = opts => { scrolls++; assert.equal(opts.top, 488); };
  transcript.querySelectorAll('.transcript-line').forEach(row => { row.getBoundingClientRect = () => ({top: 600, bottom: 700}); });
  const beforeSeeks = seeks, beforePlays = playback;
  ctx.shadowPlayer.getCurrentTime = () => 6;
  ctx.syncShadow();
  assert.equal(transcript.querySelector('.active').dataset.index, '1');
  assert.equal(scrolls, 1); assert.equal(seeks, beforeSeeks); assert.equal(playback, beforePlays);
  transcript.dispatchEvent(new Event('wheel')); ctx.highlightShadowLine(0);
  assert.equal(scrolls, 1, 'manual scrolling temporarily suspends following');
  assert.ok(document.querySelector('.sentence-save-host'));
  console.log('PASS: compact accessible save icons and transcript auto-follow/manual-scroll pause; ');
  console.log('PASS: real-renderer DOM integration — sentence controls, no playback bubbling/nested buttons, persistence, duplicates, corrupt/quota storage, source filtering, course exclusion, authenticated replay, locked replay, Back.');
})().catch(e => { console.error(e); process.exitCode = 1; });
