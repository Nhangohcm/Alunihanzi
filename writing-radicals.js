/* Targeted missing radical metadata in the shared final writing workspace. */
(() => {
  function init() {
    if (typeof buildWriter !== 'function') return;
    const base = buildWriter;
    // 老 and 龙 are whole radicals. 师: 巾 is the final three strokes.
    const corrections = {'老': {count: 6, indices: [0,1,2,3,4,5]}, '师': {count: 6, indices: [3,4,5]}, '龙': {count: 5, indices: [0,1,2,3,4]}};
    buildWriter = function(ch, quiz = false) {
      const fix = corrections[ch];
      if (!fix) return base(ch, quiz);
      document.getElementById('writerTarget').innerHTML = '';
      const size = Math.min(320, Math.max(240, innerWidth - 70));
      writer = HanziWriter.create('writerTarget', ch, {
        width: size, height: size, padding: 18, showOutline: true, showCharacter: !quiz,
        strokeAnimationSpeed: 1, delayBetweenStrokes: 180, showHintAfterMisses: 2,
        highlightOnComplete: true, strokeColor: '#2e3a34', radicalColor: radicalMode ? '#e04343' : null,
        charDataLoader: () => HanziWriter.loadCharacterData(ch).then(data => {
          // Keep upstream metadata if present; never guess indices for changed stroke data.
          if (data.radStrokes?.length || data.strokes?.length !== fix.count) return data;
          return {...data, radStrokes: [...fix.indices]};
        })
      });
      if (quiz) writer.quiz();
      updateRadicalInfo(ch);
    };
    // HSK deep links can open a character before this optional script finishes loading.
    if (typeof currentChars !== 'undefined' && currentChars.length && document.getElementById('practiceCard')?.classList.contains('show')) {
      const ch = currentChars[currentCharIndex];
      if (corrections[ch]) buildWriter(ch, false);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
