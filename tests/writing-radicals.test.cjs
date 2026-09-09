const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const assert = require('node:assert/strict');
const source = fs.readFileSync(path.join(__dirname, '../writing-radicals.js'), 'utf8');
let options, baseCalls = 0, quizzes = 0, meta, upstream;
const ctx = {document: {getElementById: () => ({innerHTML: '', classList: {contains: () => false}})},
  innerWidth: 390, radicalMode: true, writer: null, buildWriter: () => {baseCalls++;},
  updateRadicalInfo: ch => {meta = ch;},
  HanziWriter: {create: (target, ch, config) => {options = config; return {quiz: () => {quizzes++;}};}, loadCharacterData: async () => upstream}};
vm.createContext(ctx); vm.runInContext(source, ctx);
(async () => {
  for (const [ch, count, expected] of [['老',6,[0,1,2,3,4,5]],['师',6,[3,4,5]],['龙',5,[0,1,2,3,4]]]) {
    upstream = {strokes: Array(count).fill('path')}; ctx.buildWriter(ch);
    const result = await options.charDataLoader();
    assert.deepEqual(Array.from(result.radStrokes), expected); assert.equal(upstream.radStrokes, undefined);
    assert.equal(options.radicalColor, '#e04343'); assert.equal(meta, ch);
  }
  ctx.radicalMode = false; ctx.buildWriter('师', true); assert.equal(options.radicalColor, null); assert.equal(options.showCharacter, false); assert.equal(quizzes, 1);
  upstream = {strokes: Array(6).fill('path'), radStrokes: [3,4,5]}; assert.equal(await options.charDataLoader(), upstream);
  upstream = {strokes: ['changed']}; assert.equal(await options.charDataLoader(), upstream);
  ctx.buildWriter('恐'); assert.equal(baseCalls, 1, 'existing radical rendering stays in original builder');
  console.log('PASS: missing metadata, whole radicals, toggle off, quiz, unmodified upstream data, changed stroke guard, existing character fallback.');
})().catch(e => {console.error(e); process.exitCode = 1;});
