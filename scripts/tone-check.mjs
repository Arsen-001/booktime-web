#!/usr/bin/env node
// Проверка src/ui/tone.ts без тест-раннера: node scripts/tone-check.mjs (Node ≥ 23 читает .ts сам).
// Падает с кодом 1, если хоть одна проверка не прошла.
import assert from 'node:assert/strict';
// Предупреждение Node «тип модуля не указан» для .ts — шум, глушим до загрузки
process.removeAllListeners('warning');
const { contrast, darken, isLight, luminance, mix, parseHex, tone, toneFill, toneInk, toneRing, toHex } = await import(
  '../src/ui/tone.ts'
);

let failed = 0;
const check = (name, fn) => {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${name}\n    ${e.message}`);
  }
};

console.log('tone.ts');
check('parseHex / toHex: #abc, #AABBCC, обратно', () => {
  assert.deepEqual(parseHex('#abc'), [170, 187, 204]);
  assert.equal(toHex(parseHex('#AABBCC')), '#aabbcc');
  assert.throws(() => parseHex('red'));
});
check('contrast: чёрный/белый = 21, одинаковые = 1, симметричен', () => {
  assert.equal(Math.round(contrast('#000', '#fff')), 21);
  assert.equal(contrast('#4f46e5', '#4f46e5'), 1);
  assert.equal(contrast('#4f46e5', '#fff'), contrast('#fff', '#4f46e5'));
  // известное значение: #767676 на белом ≈ 4.54
  assert.ok(Math.abs(contrast('#767676', '#ffffff') - 4.54) < 0.02);
});
check('mix: 16% цвета с белым', () => {
  assert.equal(mix('#9b1b30', '#ffffff', 0.16), toneFill('#9b1b30'));
  assert.equal(toneFill('#000000'), '#d6d6d6');
  assert.equal(toneFill('#ffffff'), '#ffffff');
});
check('darken ×0.45', () => assert.equal(darken('#e9c6bd', 0.45), '#695955'));

const SHADES = [
  ['Nude 012', '#e9c6bd', true],
  ['Cherry 207', '#9b1b30', false],
  ['Rose milk', '#e3a9c1', true],
  ['Navy 402', '#1f3a5f', false],
  ['Sage', '#8fb9a8', true],
  ['Emerald', '#2e7d6b', false],
  // крайние: почти белый, жёлтый (светлый и «яркий»), чистый чёрный, основной индиго
  ['Почти белый', '#fbfbf7', true],
  ['Жёлтый', '#ffd400', true],
  ['Чёрный', '#000000', false],
  ['Indigo', '#4f46e5', false],
];
for (const [name, hex, light] of SHADES) {
  check(`${name} ${hex}: светлый=${light}, ink ≥ 4.5:1 на заливке, текст #1b1a2e ≥ 4.5:1`, () => {
    assert.equal(isLight(hex), light, `isLight: luminance ${luminance(hex).toFixed(3)}`);
    const t = tone(hex);
    assert.ok(t.contrast >= 4.5, `ink ${t.ink} на ${t.fill}: ${t.contrast.toFixed(2)}`);
    assert.ok(contrast('#1b1a2e', t.fill) >= 4.5, 'основной текст на заливке');
    // светлый ×0.45 (или темнее, если не хватило контраста); тёмный — как есть (или темнее)
    if (light) assert.ok(luminance(t.ink) <= luminance(darken(hex, 0.45)) + 1e-9);
    else assert.ok(luminance(t.ink) <= luminance(hex) + 1e-9);
    // кольцо между заливкой и каплей по яркости
    assert.ok(luminance(toneRing(hex)) <= luminance(t.fill) + 1e-9 && luminance(toneRing(hex)) >= luminance(hex) - 1e-9);
  });
}
check('тёмный достаточно контрастный цвет не меняется', () => assert.equal(toneInk('#1f3a5f'), '#1f3a5f'));
check('Emerald #2e7d6b сам не держит 4.5 на своей заливке — затемнён', () => {
  assert.ok(contrast('#2e7d6b', toneFill('#2e7d6b')) < 4.5);
  assert.notEqual(toneInk('#2e7d6b'), '#2e7d6b');
});

console.log('\n  оттенок        капля     заливка   текст     кольцо    контраст');
for (const [name, hex] of SHADES.slice(0, 6)) {
  const t = tone(hex);
  console.log(`  ${name.padEnd(14)} ${t.drop}   ${t.fill}   ${t.ink}   ${t.ring}   ${t.contrast.toFixed(2)}:1`);
}
console.log(failed ? `\n✗ провалено: ${failed}` : '\n✓ все проверки прошли');
process.exit(failed ? 1 : 0);
