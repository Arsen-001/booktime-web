// Иконки BookTime из src/shell/brand-mark.json: public/icons/* (PWA, apple-touch) и src/app/favicon.ico.
// Запуск: node scripts/brand-icons.mjs — после любой правки формы или цветов знака.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = fileURLToPath(new URL('..', import.meta.url));
const mark = JSON.parse(readFileSync(`${root}src/shell/brand-mark.json`, 'utf8'));
const { cell, gap, radius, icon } = mark;
const pitch = cell + gap;

function cells(rows) {
  const w = rows[0].length * pitch - gap, h = rows.length * pitch - gap;
  let s = '';
  rows.forEach((row, r) => [...row].forEach((ch, c) => {
    const fill = ch === '.' ? icon.empty : icon[ch];
    if (fill) s += `<rect x="${c * pitch}" y="${r * pitch}" width="${cell}" height="${cell}" rx="${radius}" fill="${fill}"/>`;
  }));
  return { w, h, s };
}

// size — сторона; share — доля стороны под знак (по большей стороне знака); round — скругление плитки
function svg(rows, size, share, round) {
  const m = cells(rows), k = (size * share) / Math.max(m.w, m.h);
  const x = (size - m.w * k) / 2, y = (size - m.h * k) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
    `<rect width="${size}" height="${size}" rx="${round ? Math.round(size * 0.22) : 0}" fill="${icon.bg}"/>` +
    `<g transform="translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${k.toFixed(4)})">${m.s}</g></svg>`;
}

const png = (s) => sharp(Buffer.from(s)).png().toBuffer();
const out = `${root}public/icons/`;

const anySvg = svg(mark.rows, 512, 0.62, true);
const maskSvg = svg(mark.rows, 512, 0.5, false); // знак внутри безопасной зоны 80%
writeFileSync(`${out}icon.svg`, anySvg + '\n');
writeFileSync(`${out}icon-maskable.svg`, maskSvg + '\n');
for (const n of [192, 512]) {
  writeFileSync(`${out}icon-${n}.png`, await png(svg(mark.rows, n, 0.62, true)));
  writeFileSync(`${out}icon-maskable-${n}.png`, await png(svg(mark.rows, n, 0.5, false)));
}
writeFileSync(`${out}apple-touch-icon.png`, await png(svg(mark.rows, 180, 0.6, false)));

// favicon.ico: PNG внутри ICO, 16/32/48. На таких размерах читается только B.
const sizes = [16, 32, 48];
const images = await Promise.all(sizes.map((n) => png(svg(mark.favicon, n, 0.7, true))));
const head = Buffer.alloc(6 + 16 * sizes.length);
head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(sizes.length, 4);
let offset = head.length;
sizes.forEach((n, i) => {
  const e = 6 + 16 * i;
  head.writeUInt8(n, e); head.writeUInt8(n, e + 1); head.writeUInt8(0, e + 2); head.writeUInt8(0, e + 3);
  head.writeUInt16LE(1, e + 4); head.writeUInt16LE(32, e + 6);
  head.writeUInt32LE(images[i].length, e + 8); head.writeUInt32LE(offset, e + 12);
  offset += images[i].length;
});
writeFileSync(`${root}src/app/favicon.ico`, Buffer.concat([head, ...images]));
console.log('brand-icons: public/icons/* и src/app/favicon.ico обновлены');
