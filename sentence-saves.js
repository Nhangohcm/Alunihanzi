/* Optional standalone-video sentence library. No course progress or API writes. */
(() => {
  'use strict';
  const KEY = 'aluni.video-sentences.v1';
  const labels = {shadowing: 'Shadowing', kids: 'Hoạt hình & Truyện'};
  const startOf = s => Number(s.start_sec ?? s.start ?? s.start_time ?? s.start_seconds ?? 0);
  const endOf = s => Number(s.end_sec ?? s.end ?? s.end_time ?? s.end_seconds ?? startOf(s) + 4);
  const textOf = s => String(s.hanzi ?? s.zh ?? s.text ?? s.chinese ?? '');
  const identity = x => JSON.stringify([x.source, x.kind, String(x.videoId), x.start, x.end, x.zh]);
  function read() {
    const rows = JSON.parse(localStorage.getItem(KEY) || '[]');
    if (!Array.isArray(rows) || rows.some(x => !x || typeof x.id !== 'string' || !labels[x.source] || !['media', 'shadow'].includes(x.kind) || !Number.isFinite(x.start) || !Number.isFinite(x.end))) throw new Error('Kho câu trên trình duyệt chưa đọc được. Dữ liệu cũ được giữ nguyên.');
    return rows;
  }
  function mutate(item, remove = false) {
    const rows = read().filter(x => x.id !== item.id);
    if (!remove) rows.unshift(item);
    window.ALUNI_SAVED_SYNC?.record('sentences',read(),rows);
    localStorage.setItem(KEY, JSON.stringify(rows));
  }
  function ready() {
    if (!document.getElementById('shadowSection')) return;
    const $ = id => document.getElementById(id);
    let shadowRenderVersion = 0, kidsRenderVersion = 0;
    let shadowContext = null, kidsContext = null, filter = 'shadowing', replay = null, replayTimer = null, replayVersion = 0, lastFocus = null;
    const style = document.createElement('style');
    style.textContent = '.sentence-save,.sentence-library-link{padding:9px 14px;margin:8px 4px;border:1px solid #dce0fa;border-radius:12px;background:#fff;color:#424caf;font:inherit;font-weight:700;cursor:pointer}.sentence-save[aria-pressed="true"]{background:#eeeaff}.sentence-kids-row{display:flex;align-items:center;gap:8px}.sentence-kids-row>.kids-all-row{flex:1;min-width:0}.sentence-dialog{width:min(900px,94vw);max-height:90dvh;padding:20px;border:1px solid #dce0fa;border-radius:20px;color:#1e2843;background:#f8f9ff}.sentence-dialog::backdrop{background:#18213c99}.sentence-dialog article{padding:16px;margin:12px 0;border:1px solid #dce0fa;border-radius:14px;background:white;overflow-wrap:anywhere}.sentence-dialog h2{margin:12px 0}.sentence-dialog .sentence-zh{font-size:1.5rem}.sentence-dialog header{display:flex;justify-content:space-between;align-items:center;gap:10px}.sentence-dialog select{padding:10px;max-width:100%}.sentence-replay{aspect-ratio:16/9;width:100%;border:0}.sentence-status{padding:8px;color:#42518c}.sentence-toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:10000;background:#26334f;color:white;padding:12px 18px;border-radius:12px;max-width:90vw}@media(max-width:500px){.sentence-kids-row{flex-wrap:wrap}.sentence-kids-row>.kids-all-row{flex-basis:100%}}';
    // Keep the save control inside the existing card, without an extra content row.
    style.textContent += `
      .sentence-save-host{position:relative!important;padding-right:58px!important}
      #shadowLive.sentence-save-host,#shadowTranscript .sentence-save-host,#kidsCurrentSentence.sentence-save-host{padding-right:58px!important}
      .sentence-save-host>.sentence-save{position:absolute!important;top:6px;right:6px;
        display:grid!important;place-items:center;width:44px!important;height:44px!important;
        min-width:44px!important;padding:0!important;margin:0!important;border:0;
        border-radius:50%;background:transparent;font-size:23px;line-height:1}
      .sentence-save-host>.sentence-save[aria-pressed="true"]{background:#eeeaff;color:#584bc5}
      .sentence-save-host>.sentence-save:focus-visible{outline:2px solid #6359dc;outline-offset:1px}
      .sentence-kids-row.sentence-save-host{padding-right:0!important;display:block}
      .sentence-kids-row>.kids-all-row{width:100%;padding-right:58px!important}
      .sentence-kids-row.active>.kids-all-row{background:#eef0ff;border-color:#8a83d7}
    `;
    document.head.appendChild(style);
    const toast = document.createElement('div');
    toast.className = 'sentence-toast'; toast.hidden = true; toast.setAttribute('role', 'status'); document.body.appendChild(toast);
    let toastTimer;
    function notify(message) { toast.textContent = message; toast.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { toast.hidden = true; }, 3500); }
    const dialog = document.createElement('dialog'); dialog.className = 'sentence-dialog';
    dialog.innerHTML = '<header><h2 id="sentenceLibraryTitle">Câu đã lưu</h2><button type="button" class="sentence-library-link" data-close>← Quay lại</button></header><p data-sentence-storage-note>Lưu trên trình duyệt này. Xóa dữ liệu trình duyệt sẽ xóa các câu đã lưu.</p><label>Kho câu <select aria-label="Chọn kho câu"><option value="shadowing">Shadowing</option><option value="kids">Hoạt hình & Truyện</option><option value="all">Tất cả</option></select></label><div class="sentence-status" role="status"></div><div data-replay></div><div data-rows></div>';
    dialog.setAttribute('aria-labelledby', 'sentenceLibraryTitle'); document.body.appendChild(dialog);
    function stopReplay() { replayVersion++; clearInterval(replayTimer); replayTimer = null; try { replay?.destroy(); } catch {} replay = null; dialog.querySelector('[data-replay]').replaceChildren(); }
    function close() { stopReplay(); dialog.close(); lastFocus?.focus(); }
    function requestClose() { if (history.state?.aluniLevel === 'sentence-library') history.back(); else close(); }
    dialog.querySelector('[data-close]').onclick = requestClose;
    dialog.addEventListener('cancel', e => { e.preventDefault(); requestClose(); });
    window.addEventListener('popstate', e => { if (!dialog.open) return; e.stopImmediatePropagation(); close(); }, true);
    dialog.querySelector('select').onchange = e => { filter = e.target.value; stopReplay(); paintLibrary(); };
    function openLibrary(source) {
      lastFocus = document.activeElement; filter = source; dialog.querySelector('select').value = source;
      shadowPlayer?.pauseVideo?.(); kidsPlayer?.pauseVideo?.();
      if (!dialog.open) { history.pushState({...history.state, aluniLevel: 'sentence-library'}, ''); dialog.showModal(); }
      paintLibrary();
    }
    function button(label, action, className = 'sentence-library-link') { const b = document.createElement('button'); b.type = 'button'; b.className = className; b.textContent = label; b.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); action(); }); return b; }
    function context(source) { return source === 'kids' ? kidsContext : shadowContext; }
    function itemFor(source, s) {
      const c = context(source); if (!c || !s || !textOf(s).trim()) return null;
      const item = {...c, source, start: startOf(s), end: endOf(s), zh: textOf(s), py: String(s.pinyin ?? s.py ?? ''), vi: String(s.vi ?? s.translation ?? s.meaning ?? '')};
      if (!Number.isFinite(item.start) || !Number.isFinite(item.end) || item.start < 0 || item.end <= item.start) return null;
      item.id = identity(item); return item;
    }
    function refresh() {
      let rows; try { rows = read(); } catch { return; }
      const ids = new Set(rows.map(x => x.id));
      document.querySelectorAll('.sentence-save').forEach(b => { const saved = ids.has(b.dataset.sentenceId); b.setAttribute('aria-pressed', String(saved)); b.textContent = saved ? '♥' : '♡'; b.setAttribute('aria-label', saved ? 'Bỏ lưu câu' : 'Lưu câu'); b.title = saved ? 'Bỏ lưu câu' : 'Lưu câu'; });
      document.querySelectorAll('[data-sentence-library]').forEach(b => { b.textContent = `♡ Câu đã lưu (${rows.filter(x => x.source === b.dataset.sentenceLibrary).length})`; });
    }
    function addSave(host, source, s) {
      if (!host) return; const item = itemFor(source, s); if (!item) { host.classList.remove('sentence-save-host'); return; }
      const b = button('♡', () => {
        try { const exists = read().some(x => x.id === item.id); mutate(item, exists); refresh(); notify(exists ? 'Đã bỏ lưu câu.' : 'Đã lưu câu.'); }
        catch { notify('Chưa lưu được câu. Kiểm tra dung lượng hoặc quyền lưu của trình duyệt; dữ liệu cũ được giữ nguyên.'); }
      }, 'sentence-save');
      host.classList.add('sentence-save-host'); b.setAttribute('aria-label', 'Lưu câu'); b.title = 'Lưu câu'; b.dataset.sentenceId = item.id; b.setAttribute('aria-pressed', 'false'); host.appendChild(b);
    }
    function libraryLink(host, source) { if (!host) return; const b = button('♡ Câu đã lưu', () => openLibrary(source)); b.dataset.sentenceLibrary = source; host.appendChild(b); }
    function paintLibrary() {
      const box = dialog.querySelector('[data-rows]'); box.replaceChildren(); const status = dialog.querySelector('.sentence-status');
      let rows; try { rows = read().filter(x => filter === 'all' || x.source === filter); } catch (e) { status.textContent = e.message; return; }
      status.textContent = rows.length ? `${rows.length} câu đã lưu` : 'Chưa có câu đã lưu trong kho này.';
      rows.forEach(item => {
        const card = document.createElement('article');
        [item.title, item.zh, item.py, item.vi, `${labels[item.source]} · ${Math.floor(item.start / 60)}:${String(Math.floor(item.start % 60)).padStart(2, '0')}`].forEach((text, i) => { const p = document.createElement('p'); p.textContent = text; if (i === 1) p.className = 'sentence-zh'; card.appendChild(p); });
        card.appendChild(button('▶ Nghe lại câu', () => playSaved(item)));
        card.appendChild(button('Bỏ lưu', () => { try { mutate(item, true); stopReplay(); paintLibrary(); refresh(); } catch { notify('Chưa bỏ lưu được câu. Vui lòng thử lại.'); } }));
        box.appendChild(card);
      });
    }
    async function playSaved(item) {
      stopReplay(); const version = replayVersion, status = dialog.querySelector('.sentence-status'); status.textContent = 'Đang mở câu…';
      try {
        const ent = item.courseId ? entitlementFor(item.courseId) : savedEntitlements()[ALL_ACCESS_ID];
        const url = item.kind === 'media' ? '/media/item?id=' : '/shadowing/video?id=';
        const r = await fetch(shadowApi(url + encodeURIComponent(item.videoId)), {cache: 'no-store', headers: ent?.token ? {Authorization: `Bearer ${ent.token}`} : {}});
        const j = await r.json(); if (version !== replayVersion) return;
        if (!r.ok) throw new Error(j.locked ? 'Cần kích hoạt quyền truy cập video này để nghe lại.' : 'Video hiện chưa mở được. Câu đã lưu vẫn được giữ.');
        // Match the current transcript; do not replay an obsolete timing after an edit.
        const segment = (j.segments || []).find(s => textOf(s) === item.zh && startOf(s) === item.start);
        if (!segment) throw new Error('Nội dung video đã thay đổi. Hãy mở video gốc và lưu lại câu này.');
        const yt = youtubeIdFromUrl(j.video?.youtube_url || j.item?.youtube_url || '');
        if (!yt || !window.YT?.Player) throw new Error('Chưa tải được trình phát YouTube. Vui lòng thử lại.');
        const host = document.createElement('div'); host.className = 'sentence-replay'; dialog.querySelector('[data-replay]').appendChild(host);
        const end = endOf(segment);
        replay = new YT.Player(host, {videoId: yt, width: '100%', height: '260', playerVars: {playsinline: 1, rel: 0, start: Math.floor(item.start)}, events: {onReady: e => { if (version !== replayVersion) { e.target.destroy(); return; } e.target.seekTo(item.start, true); e.target.playVideo(); replayTimer = setInterval(() => { if (e.target.getCurrentTime?.() >= end) e.target.pauseVideo(); }, 100); }, onError: () => { status.textContent = 'YouTube chưa phát được video này. Câu đã lưu vẫn được giữ.'; }}});
        status.textContent = item.zh; dialog.scrollTop = 0;
      } catch (e) { if (version === replayVersion) status.textContent = e.message; }
    }
    // Follow inside the transcript's own scroller, never scroll the page/video.
    const manualUntil = new WeakMap();
    function follow(box, row) {
      if (!box || !row || box.hidden || Date.now() < (manualUntil.get(box) || 0)) return;
      const outer = box.getBoundingClientRect(), inner = row.getBoundingClientRect();
      if (!outer.height || box.scrollHeight <= box.clientHeight) return;
      if (inner.top >= outer.top + 8 && inner.bottom <= outer.bottom - 8) return;
      box.scrollTo({top: Math.max(0, box.scrollTop + inner.top - outer.top - 12),
        behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'});
    }
    for (const id of ['shadowTranscript', 'kidsAllSentenceList']) {
      const box = $(id);
      ['wheel', 'touchmove', 'pointerdown', 'keydown'].forEach(type => box?.addEventListener(type, () => manualUntil.set(box, Date.now() + 3000), {passive: true}));
    }
    function followShadow() {
      if (document.body.classList.contains('shadow-study-mode')) return;
      follow($('shadowTranscript'), $('shadowTranscript')?.querySelector('.transcript-line.active'));
    }
    const baseHighlight = highlightShadowLine;
    highlightShadowLine = function(i) { baseHighlight(i); followShadow(); };
    if (typeof setShadowTranscriptOpen === 'function') {
      const baseOpenTranscript = setShadowTranscriptOpen;
      setShadowTranscriptOpen = function(open) { baseOpenTranscript(open); if (open) followShadow(); };
    }
    function followKids() {
      const list = $('kidsAllSentenceList');
      list?.querySelectorAll('.sentence-kids-row').forEach((row, i) => row.classList.toggle('active', i === kidsStudyIndex));
      if ($('kidsAllSentences')?.open) follow(list, list?.querySelector('.sentence-kids-row.active'));
    }
    $('kidsAllSentences')?.addEventListener('toggle', followKids);
    // Wrap renderers only; original player, access checks and repeat logic remain authoritative.
    const baseTranscript = renderShadowTranscript;
    renderShadowTranscript = function() { shadowRenderVersion++; baseTranscript(); $('shadowTranscript').querySelectorAll('.transcript-line').forEach((row, i) => addSave(row, 'shadowing', shadowSegments[i])); libraryLink($('shadowTranscript'), 'shadowing'); refresh(); };
    const baseLive = renderShadowLive;
    renderShadowLive = function(i) { baseLive(i); $('shadowLive')?.querySelectorAll('.sentence-save').forEach(b => b.remove()); addSave($('shadowLive'), 'shadowing', shadowSegments[i]); refresh(); };
    const baseMedia = loadMediaVideo;
    loadMediaVideo = async function(id) { shadowContext = null; const before = shadowRenderVersion; await baseMedia(id); const p = mediaPlaylists.find(p => (p.items || []).some(x => String(x.id) === String(id))), item = p?.items?.find(x => String(x.id) === String(id)); if (!item || item.locked || before === shadowRenderVersion) return; shadowContext = {kind: 'media', videoId: String(id), title: item.title, courseId: item.product_course_id || p.product_course_id || ''}; renderShadowTranscript(); renderShadowLive(Math.max(0, shadowCurrentIndex)); };
    const baseVideo = loadShadowVideo;
    loadShadowVideo = async function(id) { shadowContext = null; const before = shadowRenderVersion; await baseVideo(id); const item = shadowVideos.find(x => String(x.id) === String(id)); if (!item || item.locked || before === shadowRenderVersion) return; shadowContext = {kind: 'shadow', videoId: String(id), title: item.title, courseId: item.course_id || $('shadowCourse').value}; renderShadowTranscript(); renderShadowLive(Math.max(0, shadowCurrentIndex)); };
    const baseKidsPaint = kidsPaintSegments;
    kidsPaintSegments = function() { kidsRenderVersion++; baseKidsPaint(); $('kidsAllSentenceList').querySelectorAll('.kids-all-row').forEach((row, i) => { const wrap = document.createElement('div'); wrap.className = 'sentence-kids-row'; row.replaceWith(wrap); wrap.appendChild(row); addSave(wrap, 'kids', kidsStudySegments[i]); }); libraryLink($('kidsAllSentenceList'), 'kids'); followKids(); refresh(); };
    const baseKidsCurrent = kidsSetCurrentSentence;
    kidsSetCurrentSentence = function(i) { baseKidsCurrent(i); $('kidsCurrentSentence')?.querySelectorAll('.sentence-save').forEach(b => b.remove()); addSave($('kidsCurrentSentence'), 'kids', kidsStudySegments[i]); followKids(); refresh(); };
    const baseKidsOpen = openKidsLesson;
    openKidsLesson = async function(si, li, mode) { kidsContext = null; const before = kidsRenderVersion; await baseKidsOpen(si, li, mode); const series = adultKidsData?.series?.[si], item = series?.lessons?.[li]; if (before === kidsRenderVersion || !item?.media_item_id || item.locked || $('kidsStudyPanel').hidden || kidsStudyLesson !== item || !$('kidsStudyTitle').textContent.startsWith(series.title + ' ·')) return; kidsContext = {kind: 'media', videoId: String(item.media_item_id), title: `${series.title} · ${item.title}`, courseId: item.product_course_id || series.product_course_id || ''}; kidsPaintSegments(); };
    libraryLink($('shadowSection').querySelector('.module-header'), 'shadowing');
    libraryLink($('kidsPublicSection').querySelector('.module-header') || $('adultKidsSeries').parentElement, 'kids');
    libraryLink($('kidsCurrentSentence')?.parentElement, 'kids');
    window.addEventListener('aluni-saved-library-updated', () => {refresh(); if(dialog.open)paintLibrary();});
    window.addEventListener('storage', e => { if (e.key !== KEY) return; refresh(); if (dialog.open) paintLibrary(); });
    refresh();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready); else ready();
})();
