// Additional entrances to the existing vocabulary pool; never copies or writes storage.
(() => {
  const key = 'aluni_writing_saved_vocab_v1';
  function init() {
    if (document.getElementById('courseSavedDetails') || document.getElementById('hskSavedVocabulary')) return;
    const grid = document.getElementById('allCoursesGrid');
    let refresh;
    if (grid && typeof savedWritingVocabulary === 'function') {
      const panel = document.createElement('details');
      panel.id = 'courseSavedDetails';
      panel.className = 'writing-saved-details';
      panel.innerHTML = '<summary><span>💾 Ôn từ vựng đã lưu</span><span class="writing-saved-count">0</span></summary><div class="writing-saved-body"><p class="writing-saved-note">Từ được lưu ở ô tra cứu hoặc trong các bài Viết chữ đều tập trung tại đây.</p><div class="words"></div></div>';
      grid.before(panel);
      const draw = () => {
        const rows = savedWritingVocabulary();
        panel.querySelector('.writing-saved-count').textContent = String(rows.length);
        const words = panel.querySelector('.words');
        words.replaceChildren();
        if (!panel.open) return;
        if (!rows.length) {
          words.innerHTML = '<div class="writing-saved-empty">Chưa có từ nào được lưu. Bấm 💾 trên một thẻ từ để thêm vào kho ôn tập.</div>';
          return;
        }
        rows.forEach(item => words.appendChild(createWritingWordCard(item, () => {
          practiceItems = savedWritingVocabulary();
          openPractice(item);
        })));
        refreshWritingSaveButtons();
      };
      const original = renderSavedWritingVocabulary;
      renderSavedWritingVocabulary = function (...args) {
        const result = original.apply(this, args);
        draw();
        return result;
      };
      refresh = () => renderSavedWritingVocabulary();
      panel.addEventListener('toggle', draw);
      refresh();
      if (new URLSearchParams(location.search).get('writing_saved') === '1') {
        const saved = document.getElementById('writingSavedDetails');
        if (saved) {
          setActiveAppSection('writingSection');
          saved.open = true;
          requestAnimationFrame(() => saved.scrollIntoView({block: 'start'}));
        }
      }
    } else if (document.getElementById('banner') && document.getElementById('app')) {
      const link = document.createElement('a');
      link.id = 'hskSavedVocabulary';
      link.href = '../index.html?writing_saved=1#writingSection';
      link.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:12px;margin:16px auto;padding:16px 20px;width:calc(100% - 32px);max-width:1200px;box-sizing:border-box;border:1px solid #ecc3c3;border-radius:16px;background:#fff;color:#993b38;font-weight:800;text-decoration:none';
      link.innerHTML = '<span>💾 Ôn từ vựng đã lưu</span><span data-saved-count>0</span>';
      document.getElementById('app').before(link);
      refresh = () => {
        let rows = [];
        try { const data = JSON.parse(localStorage.getItem(key) || '[]'); if (Array.isArray(data)) rows = data.filter(x => x && x.hanzi); } catch (_) {}
        link.querySelector('[data-saved-count]').textContent = String(rows.length);
      };
      refresh();
    }
    if (refresh) {
      window.addEventListener('storage', event => { if (event.key === key || event.key === null) refresh(); });
      window.addEventListener('pageshow', refresh);
      window.addEventListener('focus', refresh);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once: true});
  else init();
})();
