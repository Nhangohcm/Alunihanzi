window.ALUNI_API_BASE = 'https://aluni-tts.nhangohcm.workers.dev';

window.ALUNI_SALES_PAGE_URL =
  'https://tieng-trung-aluni.nhangohcm.chatgpt.site/';

// Kho Viết chữ V2 được cô lập trong một khối để dễ thử nghiệm và hoàn tác qua PR.
(function(){
  const groups={all:'Tất cả','50plus':'50+','npcr':'NPCR','hsk20_1':'HSK 1','hsk20_2':'HSK 2','hsk20_3':'HSK 3','hsk20_4':'HSK 4','hsk20_5':'HSK 5','hsk20_6':'HSK 6','hsk30_1':'HSK 1','hsk30_2':'HSK 2','hsk30_3':'HSK 3','hsk30_4':'HSK 4','hsk30_5':'HSK 5','hsk30_6':'HSK 6'};
  let active='all',library,courseView,lessonList,courseTitle,resultsCard;
  const css=`
  #writingSection .writing-v2-header{margin-bottom:26px}#writingSection .writing-v2-header h1{margin:8px 0;font-size:clamp(2.2rem,5vw,3.7rem)}
  .writing-v2-library,.writing-v2-course{margin-bottom:16px}.writing-v2-tabs{display:grid;gap:11px;margin-top:14px}.writing-v2-row{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px;align-items:center}.writing-v2-row:first-child{grid-template-columns:repeat(3,minmax(0,1fr))}.writing-v2-label{font-weight:900;color:#59637b}.writing-v2-tab{min-height:48px;border:1px solid #d7ddef;border-radius:999px;background:#fff;color:#505a73;font-weight:900;cursor:pointer}.writing-v2-tab:hover{border-color:#7784ed;color:#4056c5}.writing-v2-tab.active{border-color:transparent;background:linear-gradient(135deg,#536cf0,#805ee7);color:#fff}.writing-v2-note{margin-top:12px;color:#737d94;font-size:.9rem}.writing-v2-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:14px}.writing-v2-head h2{margin:3px 0 0}.writing-v2-back{border:1px solid #d7ddef;border-radius:12px;background:#fff;padding:10px 13px;color:#4056c5;font-weight:900;cursor:pointer}.writing-v2-lessons{display:grid;gap:10px}.writing-v2-lesson{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;padding:14px 16px;border:1px solid #dce2ef;border-radius:15px;background:#f9faff}.writing-v2-main{border:0;background:transparent;color:#1f2940;text-align:left;cursor:pointer}.writing-v2-main b,.writing-v2-main small{display:block}.writing-v2-main small{margin-top:5px;color:#788299}.writing-v2-actions{display:flex;gap:8px}.writing-v2-action{border:1px solid #cfd7ef;border-radius:11px;background:#fff;padding:9px 11px;color:#4056c5;font-weight:850;cursor:pointer}.writing-v2-action.game{background:#eef1ff}.writing-v2-empty{padding:24px;border:1px dashed #cfd7e8;border-radius:15px;text-align:center;color:#747e94;background:#fafbff}.writing-v2-course[hidden],.writing-v2-library[hidden],.writing-v2-results[hidden]{display:none!important}
  @media(max-width:700px){.writing-v2-row{grid-template-columns:68px repeat(3,minmax(0,1fr));gap:8px}.writing-v2-row:first-child{grid-template-columns:repeat(3,minmax(0,1fr))}.writing-v2-row .writing-v2-label{grid-row:span 2}.writing-v2-tab{min-height:44px;padding:8px 5px}.writing-v2-lesson{grid-template-columns:1fr}.writing-v2-actions{width:100%}.writing-v2-action{flex:1}}
  `;
  function text(course){return norm([course?.id,course?.code,course?.slug,course?.name,course?.title,course?.group,course?.free_group].filter(Boolean).join(' '))}
  function courseFor(group){
    if(group==='all')return null;
    const direct=courses.find(c=>String(c.free_group||c.group||'')===group);if(direct)return direct;
    if(group==='50plus')return courses.find(isFiftyPlusCourse)||null;
    if(group==='npcr')return courses.find(c=>text(c).includes('npcr'))||null;
    const m=group.match(/^hsk(20|30)_(\d)$/);if(!m)return null;
    return courses.find(c=>{const t=text(c),v=m[1],level=m[2];return t.includes('hsk'+v+level)||t.includes('hsk'+v+'cap'+level)||t.includes('hsk'+level+(v==='30'?'30':''))})||null;
  }
  function button(id){return `<button class="writing-v2-tab ${id===active?'active':''}" data-writing-v2="${id}" type="button">${groups[id]}</button>`}
  function renderTabs(){
    const box=library.querySelector('.writing-v2-tabs');
    box.innerHTML=`<div class="writing-v2-row">${['all','50plus','npcr'].map(button).join('')}</div><div class="writing-v2-row"><span class="writing-v2-label">HSK 2.0</span>${['hsk20_1','hsk20_2','hsk20_3','hsk20_4','hsk20_5','hsk20_6'].map(button).join('')}</div><div class="writing-v2-row"><span class="writing-v2-label">HSK 3.0</span>${['hsk30_1','hsk30_2','hsk30_3','hsk30_4','hsk30_5','hsk30_6'].map(button).join('')}</div>`;
    box.querySelectorAll('button').forEach(b=>b.onclick=()=>openGroup(b.dataset.writingV2));
  }
  function displayName(group,course){return course?.name||course?.title||(group.startsWith('hsk20_')?`HSK 2.0 — Cấp ${group.at(-1)}`:group.startsWith('hsk30_')?`HSK 3.0 — Cấp ${group.at(-1)}`:groups[group])}
  async function openGroup(group){
    active=group;renderTabs();
    if(group==='all'){showLibrary();return}
    const course=courseFor(group);library.hidden=true;courseView.hidden=false;resultsCard.hidden=true;courseTitle.textContent=displayName(group,course);
    if(!course){lessonList.innerHTML='<div class="writing-v2-empty"><b>Khóa học đã được đồng bộ tên.</b><br>Nội dung bài học đang được cập nhật.</div>';return}
    await renderLessonsV2(course);
  }
  function showLibrary(){active='all';renderTabs();library.hidden=false;courseView.hidden=true;resultsCard.hidden=true;document.getElementById('writingSearchHint').textContent='Kết quả sẽ hiện ngay bên dưới; chọn một từ để nghe, tra nghĩa và tập viết.'}
  async function renderLessonsV2(course){
    selectedCourseObj=course;const full=await hasFullAccess(course.id),limit=freeCount(course),lessons=course.lessons||[];lessonList.innerHTML='';
    if(!lessons.length){lessonList.innerHTML='<div class="writing-v2-empty"><b>Khóa học đã được đồng bộ.</b><br>Chưa có nội dung viết chữ trong khóa này.</div>';return}
    lessons.forEach((lesson,index)=>{const locked=!full&&(index+1)>limit,hasGame=Array.isArray(lesson.games)&&lesson.games.length,row=document.createElement('div');row.className='writing-v2-lesson';row.innerHTML=`<button class="writing-v2-main" type="button"><b>${locked?'🔒 ':''}Bài ${String(lesson.number??index+1).padStart(2,'0')} · ${esc(lesson.title||lesson.name||`Bài ${index+1}`)}</b><small>${Number(lesson.items?.length||lesson.writing_count||0)?`${Number(lesson.items?.length||lesson.writing_count)} từ luyện viết`:'Nội dung viết chữ đang cập nhật'}${hasGame?' · Có game':''}</small></button><div class="writing-v2-actions"><button class="writing-v2-action learn" type="button">✍ Học bài</button>${hasGame?'<button class="writing-v2-action game" type="button">🎮 Game</button>':''}</div>`;
      const open=async()=>{await selectLesson(course,lesson,index,full);if(!locked){courseView.after(resultsCard);resultsCard.hidden=false;resultsCard.scrollIntoView({behavior:'smooth',block:'start'})}};
      row.querySelector('.writing-v2-main').onclick=open;row.querySelector('.learn').onclick=open;row.querySelector('.game')?.addEventListener('click',()=>openLearningGame(String(lesson.id),'adult',lesson.games.join(',')));lessonList.appendChild(row);
    });
  }
  function init(){
    const section=document.getElementById('writingSection'),quick=section?.querySelector('.writing-quick-card'),old=document.getElementById('writingFreeDetails');if(!section||!quick||!old)return;
    document.head.appendChild(Object.assign(document.createElement('style'),{textContent:css}));
    const header=document.createElement('div');header.className='module-header writing-v2-header';header.innerHTML='<div class="brand">TIẾNG TRUNG ALUNI</div><h1>Viết chữ</h1><p>Tra nhanh · học theo bài · luyện nét · chơi game.</p>';quick.before(header);
    library=document.createElement('section');library.className='card writing-v2-library';library.innerHTML='<b>Chọn kho luyện viết</b><div class="writing-v2-tabs"></div><div class="writing-v2-note">Chọn một khóa để mở danh sách bài học riêng.</div>';
    courseView=document.createElement('section');courseView.className='card writing-v2-course';courseView.hidden=true;courseView.innerHTML='<div class="writing-v2-head"><div><div class="brand">KHO LUYỆN VIẾT</div><h2>Khóa học</h2></div><button class="writing-v2-back" type="button">← Chọn khóa khác</button></div><div class="writing-v2-lessons"></div>';
    courseTitle=courseView.querySelector('h2');lessonList=courseView.querySelector('.writing-v2-lessons');resultsCard=document.getElementById('resultsTitle').closest('section.card');resultsCard.classList.add('writing-v2-results');resultsCard.hidden=true;
    old.replaceWith(library,courseView);courseView.querySelector('.writing-v2-back').onclick=showLibrary;renderTabs();
    document.getElementById('searchBtn').addEventListener('click',()=>{quick.after(resultsCard);resultsCard.hidden=false},true);
    document.getElementById('searchInput').addEventListener('keydown',e=>{if(e.key==='Enter'){quick.after(resultsCard);resultsCard.hidden=false}},true);
    const base=window.renderCourseSelect;window.renderCourseSelect=function(){const value=base.apply(this,arguments);if(active!=='all')openGroup(active);return value};
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
