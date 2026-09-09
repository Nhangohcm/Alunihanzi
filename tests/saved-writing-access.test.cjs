const {parseHTML, Event} = require('linkedom');
const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const source = fs.readFileSync(require('node:path').join(__dirname, '../saved-writing-access.js'), 'utf8');
function setup(hsk = false, search = '') {
  const {document} = parseHTML('<html><head></head><body>' + (hsk ? '<section id="banner"></section><main id="app"></main>' : '<div class="course-showcase-head"></div><div id="allCoursesGrid">Khởi động</div><details id="writingSavedDetails"></details>') + '</body></html>');
  let rows = [{hanzi:'老师',pinyin:'Lǎoshī',vi:'Giáo viên'}], originalCalls = 0;
  const handlers = {}, opened = [];
  const context = {document, URLSearchParams, location:{search}, requestAnimationFrame:fn=>fn(),
    localStorage:{getItem:()=>JSON.stringify(rows),setItem:()=>{throw Error('must not create another pool')}},
    addEventListener:(name, fn)=>{handlers[name]=fn}, savedWritingVocabulary:()=>rows,
    renderSavedWritingVocabulary:()=>{originalCalls++}, refreshWritingSaveButtons:()=>{},
    createWritingWordCard:(item,open)=>{const el=document.createElement('button');el.textContent=item.hanzi;el.onclick=open;return el},
    openPractice:item=>opened.push(item),setActiveAppSection:id=>{context.section=id}};
  const details = document.getElementById('writingSavedDetails'); if(details) details.scrollIntoView=()=>{};
  context.window=context;vm.createContext(context);vm.runInContext(source,context);
  return {context,document,handlers,opened,setRows:value=>{rows=value},originalCalls:()=>originalCalls};
}
const a=setup();const panel=a.document.getElementById('courseSavedDetails');
assert.equal(panel.nextElementSibling.id,'allCoursesGrid');
assert.equal(panel.previousElementSibling.className,'course-showcase-head');
assert.equal(panel.querySelector('.writing-saved-count').textContent,'1');
panel.open=true;panel.dispatchEvent(new Event('toggle'));
panel.querySelector('button').onclick();assert.equal(a.opened[0].hanzi,'老师');assert.equal(a.context.practiceItems.length,1);
a.setRows([]);a.context.renderSavedWritingVocabulary();assert.equal(panel.querySelector('.writing-saved-count').textContent,'0');assert(panel.querySelector('.writing-saved-empty'));assert(a.originalCalls()>1);
a.setRows([{hanzi:'一刻'}]);a.handlers.storage({key:'aluni_writing_saved_vocab_v1'});assert.equal(panel.querySelector('button').textContent,'一刻');
const b=setup(true);const link=b.document.getElementById('hskSavedVocabulary');assert.equal(link.nextElementSibling.id,'app');assert.equal(link.getAttribute('href'),'../index.html?writing_saved=1#writingSection');assert.equal(link.querySelector('[data-saved-count]').textContent,'1');
b.setRows([]);b.handlers.pageshow();assert.equal(link.querySelector('[data-saved-count]').textContent,'0');
const c=setup(false,'?writing_saved=1');assert.equal(c.context.section,'writingSection');assert.equal(c.document.getElementById('writingSavedDetails').open,true);
console.log('Shared saved vocabulary entrances: passed');
