import type { SphereId } from '@/domain/core';

/**
 * Демо-фото без внешних ссылок: рисованные SVG (data:) — интерьер бизнеса и «работы» мастера по сфере.
 * Это иллюстрации, а не снимки: на показе видно, где будут фото, и экран не выглядит пустым.
 * Строки короткие (~1 КБ), потому что вся база живёт в localStorage.
 */

/** Компактная запись SVG в data:-адрес (кодируем только то, что ломает адрес) */
function uri(svg: string): string {
  const compact = svg.replace(/\s{2,}/g, ' ').replace(/> </g, '><').replace(/"/g, "'").trim();
  return `data:image/svg+xml,${compact.replace(/%/g, '%25').replace(/#/g, '%23').replace(/</g, '%3C').replace(/>/g, '%3E')}`;
}

function frame(bg: [string, string], body: string): string {
  return uri(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><defs><linearGradient id="b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${bg[0]}"/><stop offset="1" stop-color="${bg[1]}"/></linearGradient></defs><rect width="400" height="400" fill="url(#b)"/>${body}</svg>`,
  );
}

// ─────────── Работы мастеров

/** Пять ногтей веером; tip — френч */
function nails(bg: [string, string], color: string, tip?: string): string {
  const nail = 'M0-72C21-72 26-34 26 6V58Q26 70 16 70H-16Q-26 70-26 58V6C-26-34-21-72 0-72Z';
  const tipPath = 'M0-72C21-72 26-34 26-20H-26C-26-34-21-72 0-72Z';
  const xs = [72, 136, 200, 264, 328];
  const body = xs
    .map((x, i) => {
      const r = (i - 2) * 9;
      const y = 214 + Math.abs(i - 2) * 16;
      return `<g transform="translate(${x} ${y}) rotate(${r})"><path d="${nail}" fill="${color}"/>${tip ? `<path d="${tipPath}" fill="${tip}"/>` : ''}<ellipse cx="-9" cy="-30" rx="5" ry="22" fill="#fff" opacity=".35"/></g>`;
    })
    .join('');
  return frame(bg, `<ellipse cx="200" cy="330" rx="170" ry="26" fill="#000" opacity=".06"/>${body}`);
}

/** Волны волос */
function hair(bg: [string, string], top: string, bottom: string): string {
  const strands = [60, 110, 160, 210, 260, 310]
    .map((x, i) => `<path d="M${x}-20C${x + 70} 110 ${x - 70} 250 ${x + 30} 420" stroke="url(#h)" stroke-width="${i % 2 ? 34 : 26}" fill="none" stroke-linecap="round" opacity="${i % 2 ? 0.95 : 0.8}"/>`)
    .join('');
  return frame(
    bg,
    `<defs><linearGradient id="h" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient></defs>${strands}<path d="M130 40C210 150 90 260 190 380" stroke="#fff" stroke-width="6" fill="none" opacity=".25" stroke-linecap="round"/>`,
  );
}

function barberPole(bg: [string, string]): string {
  const stripes = [-120, -60, 0, 60, 120, 180, 240]
    .map((y, i) => `<path d="M140 ${y + 60}L260 ${y}V${y + 30}L140 ${y + 90}Z" fill="${i % 2 ? '#2F4B9A' : '#C8313B'}"/>`)
    .join('');
  return frame(
    bg,
    `<defs><clipPath id="p"><rect x="150" y="70" width="100" height="260" rx="50"/></clipPath></defs><rect x="150" y="70" width="100" height="260" rx="50" fill="#fff"/><g clip-path="url(#p)">${stripes}</g><rect x="140" y="52" width="120" height="22" rx="11" fill="#C9A45C"/><rect x="140" y="326" width="120" height="22" rx="11" fill="#C9A45C"/><rect x="164" y="80" width="14" height="240" rx="7" fill="#fff" opacity=".35"/>`,
  );
}

function scissors(bg: [string, string], metal: string): string {
  return frame(
    bg,
    `<g transform="rotate(-30 200 200)"><path d="M200 196L330 170L200 210Z" fill="${metal}"/><path d="M200 204L330 230L200 190Z" fill="${metal}" opacity=".85"/><circle cx="118" cy="160" r="34" fill="none" stroke="${metal}" stroke-width="14"/><circle cx="118" cy="240" r="34" fill="none" stroke="${metal}" stroke-width="14"/><path d="M146 176L200 200L146 224" stroke="${metal}" stroke-width="14" fill="none"/><circle cx="200" cy="200" r="7" fill="#fff" opacity=".7"/></g>`,
  );
}

function combRazor(bg: [string, string], accent: string): string {
  const teeth = Array.from({ length: 16 }, (_, i) => `<rect x="${92 + i * 14}" y="150" width="7" height="46" rx="3" fill="${accent}"/>`).join('');
  return frame(
    bg,
    `<rect x="84" y="126" width="232" height="30" rx="10" fill="${accent}"/>${teeth}<g transform="rotate(-12 200 280)"><rect x="80" y="258" width="130" height="40" rx="8" fill="#E9ECEF"/><rect x="200" y="266" width="130" height="24" rx="12" fill="#6B4A2E"/><rect x="88" y="264" width="110" height="6" rx="3" fill="#fff" opacity=".6"/></g>`,
  );
}

/** Флакон с пипеткой и капли */
function serum(bg: [string, string], glass: string, liquid: string): string {
  return frame(
    bg,
    `<rect x="150" y="150" width="100" height="170" rx="26" fill="${glass}"/><rect x="150" y="220" width="100" height="100" rx="26" fill="${liquid}" opacity=".85"/><rect x="176" y="100" width="48" height="56" rx="10" fill="#3B3B45"/><ellipse cx="200" cy="98" rx="30" ry="18" fill="#3B3B45"/><rect x="164" y="170" width="12" height="120" rx="6" fill="#fff" opacity=".45"/><path d="M300 150C300 170 286 180 286 192A14 14 0 0 0 314 192C314 180 300 170 300 150Z" fill="${liquid}"/><path d="M104 230C104 246 94 254 94 263A10 10 0 0 0 114 263C114 254 104 246 104 230Z" fill="${liquid}" opacity=".7"/>`,
  );
}

function leaves(bg: [string, string], leaf: string, dot: string): string {
  const l = (x: number, y: number, r: number, s: number) =>
    `<g transform="translate(${x} ${y}) rotate(${r}) scale(${s})"><path d="M0 0C40-60 110-60 150 0C110 60 40 60 0 0Z" fill="${leaf}"/><path d="M8 0H140" stroke="#fff" stroke-width="3" opacity=".5"/></g>`;
  return frame(bg, `${l(70, 260, -40, 1)}${l(180, 200, 10, 0.9)}${l(120, 130, -70, 0.7)}<circle cx="300" cy="120" r="30" fill="${dot}" opacity=".8"/><circle cx="310" cy="300" r="18" fill="${dot}" opacity=".6"/>`);
}

function brows(bg: [string, string], color: string): string {
  return frame(
    bg,
    `<path d="M50 190C90 130 160 120 190 150" stroke="${color}" stroke-width="22" fill="none" stroke-linecap="round"/><path d="M350 190C310 130 240 120 210 150" stroke="${color}" stroke-width="22" fill="none" stroke-linecap="round"/><path d="M70 250Q125 215 180 250Q125 280 70 250Z" fill="#fff" opacity=".7"/><path d="M220 250Q275 215 330 250Q275 280 220 250Z" fill="#fff" opacity=".7"/><circle cx="125" cy="249" r="16" fill="${color}"/><circle cx="275" cy="249" r="16" fill="${color}"/>`,
  );
}

function stones(bg: [string, string], stone: string): string {
  return frame(
    bg,
    `<ellipse cx="200" cy="330" rx="150" ry="18" fill="#000" opacity=".08"/><ellipse cx="200" cy="296" rx="120" ry="36" fill="${stone}"/><ellipse cx="200" cy="236" rx="92" ry="30" fill="${stone}" opacity=".9"/><ellipse cx="200" cy="184" rx="66" ry="24" fill="${stone}" opacity=".8"/><ellipse cx="200" cy="142" rx="42" ry="18" fill="${stone}" opacity=".7"/><path d="M250 120C290 60 350 70 360 90C320 90 290 110 250 120Z" fill="#7FA36B"/><ellipse cx="170" cy="286" rx="40" ry="8" fill="#fff" opacity=".2"/>`,
  );
}

function candle(bg: [string, string], wax: string): string {
  return frame(
    bg,
    `<ellipse cx="200" cy="140" rx="70" ry="90" fill="#FFD27A" opacity=".25"/><rect x="140" y="190" width="120" height="140" rx="18" fill="${wax}"/><ellipse cx="200" cy="192" rx="60" ry="14" fill="#fff" opacity=".5"/><path d="M200 120C216 150 214 170 200 178C186 170 184 150 200 120Z" fill="#F4A340"/><rect x="198" y="176" width="4" height="16" fill="#3B3B45"/>`,
  );
}

function tooth(bg: [string, string], shine: string): string {
  return frame(
    bg,
    `<circle cx="200" cy="200" r="140" fill="#fff" opacity=".35"/><path d="M200 120C170 96 110 100 110 160C110 210 130 240 140 300C146 336 176 336 182 300C188 266 194 250 200 250C206 250 212 266 218 300C224 336 254 336 260 300C270 240 290 210 290 160C290 100 230 96 200 120Z" fill="#fff"/><path d="M140 150C150 124 180 124 190 136" stroke="${shine}" stroke-width="10" fill="none" stroke-linecap="round"/><path d="M310 90L318 108L336 116L318 124L310 142L302 124L284 116L302 108Z" fill="#fff"/>`,
  );
}

function smile(bg: [string, string], lip: string): string {
  const teeth = Array.from({ length: 6 }, (_, i) => `<rect x="${118 + i * 28}" y="186" width="24" height="${i === 0 || i === 5 ? 30 : 38}" rx="8" fill="#fff"/>`).join('');
  return frame(bg, `<path d="M90 190Q200 130 310 190Q200 300 90 190Z" fill="${lip}"/><path d="M110 192Q200 170 290 192Q200 250 110 192Z" fill="#7A2230"/>${teeth}`);
}

function dumbbell(bg: [string, string], plate: string): string {
  return frame(
    bg,
    `<g transform="rotate(-20 200 200)"><rect x="110" y="190" width="180" height="20" rx="10" fill="#9AA0A6"/><rect x="72" y="140" width="34" height="120" rx="10" fill="${plate}"/><rect x="108" y="156" width="20" height="88" rx="8" fill="${plate}" opacity=".85"/><rect x="294" y="140" width="34" height="120" rx="10" fill="${plate}"/><rect x="272" y="156" width="20" height="88" rx="8" fill="${plate}" opacity=".85"/></g>`,
  );
}

function kettlebell(bg: [string, string], body: string): string {
  return frame(
    bg,
    `<path d="M150 190C150 120 250 120 250 190" stroke="${body}" stroke-width="26" fill="none"/><circle cx="200" cy="250" r="90" fill="${body}"/><ellipse cx="170" cy="222" rx="18" ry="34" fill="#fff" opacity=".2"/><ellipse cx="200" cy="350" rx="110" ry="14" fill="#000" opacity=".1"/>`,
  );
}

function car(bg: [string, string], paint: string): string {
  const bubbles = [
    [90, 110, 22],
    [140, 80, 14],
    [300, 90, 26],
    [330, 150, 12],
    [240, 60, 10],
  ]
    .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" opacity=".55"/>`)
    .join('');
  return frame(
    bg,
    `${bubbles}<path d="M60 270V240Q60 222 80 218L120 210L160 170Q170 160 186 160H254Q270 160 280 172L312 210L336 216Q350 220 350 236V270Z" fill="${paint}"/><path d="M172 176H222V210H140Z" fill="#DDEBF5"/><path d="M232 176H262Q270 176 276 184L296 210H232Z" fill="#DDEBF5"/><circle cx="126" cy="274" r="30" fill="#2B2F36"/><circle cx="126" cy="274" r="12" fill="#C9CED6"/><circle cx="290" cy="274" r="30" fill="#2B2F36"/><circle cx="290" cy="274" r="12" fill="#C9CED6"/><ellipse cx="205" cy="312" rx="160" ry="10" fill="#000" opacity=".1"/>`,
  );
}

const WARM: [string, string] = ['#FBF1EC', '#F2D9CE'];
const PEACH: [string, string] = ['#FFF4EC', '#F7D4C2'];
const LILAC: [string, string] = ['#F4F0FB', '#DCD3F2'];
const SAGE: [string, string] = ['#EEF3EC', '#D2E0CF'];
const SAND: [string, string] = ['#F8F3EA', '#E9DCC6'];
const MINT: [string, string] = ['#EEF8F6', '#CFEAE4'];
const SKY: [string, string] = ['#EEF5FB', '#CFE1F2'];
const NIGHT: [string, string] = ['#2A2F3A', '#171A21'];
const GRAPHITE: [string, string] = ['#3A3F4B', '#22252D'];

/** Набор «работ» по сфере; variant сдвигает набор, чтобы у соседних мастеров фото различались */
const WORKS: Partial<Record<SphereId, (() => string)[]>> = {
  nails: [
    () => nails(WARM, '#D9A391'),
    () => nails(PEACH, '#8E1B3A'),
    () => nails(WARM, '#F3D3CC', '#FFFFFF'),
    () => nails(LILAC, '#B9A6E0'),
    () => nails(PEACH, '#C8102E'),
    () => nails(SAND, '#C9CED6'),
    () => nails(SAGE, '#7C9A7E'),
    () => nails(LILAC, '#2E3A59'),
  ],
  barber: [
    () => barberPole(NIGHT),
    () => scissors(GRAPHITE, '#D8DCE2'),
    () => combRazor(SAND, '#2B2F36'),
    () => hair(GRAPHITE, '#3A2A20', '#15100C'),
    () => scissors(SAND, '#2B2F36'),
    () => combRazor(NIGHT, '#C9A45C'),
  ],
  hair: [
    () => hair(WARM, '#6B4226', '#E3BC7E'),
    () => hair(SAND, '#E8CD96', '#B8864B'),
    () => hair(PEACH, '#C0612B', '#7E3413'),
    () => hair(LILAC, '#4A2E22', '#24150F'),
    () => hair(SAGE, '#D9CFC3', '#A89B8C'),
    () => scissors(WARM, '#B08D57'),
  ],
  cosmetology: [
    () => serum(MINT, '#E6F2EF', '#9AD0C2'),
    () => leaves(SAGE, '#7FA36B', '#F2C9B8'),
    () => serum(PEACH, '#FBEDE6', '#F0A992'),
    () => brows(WARM, '#5A3B2B'),
    () => leaves(MINT, '#5E9C8F', '#F7D9A8'),
    () => serum(LILAC, '#F1ECFA', '#B7A3E3'),
  ],
  massage: [() => stones(SAND, '#4B4F57'), () => candle(PEACH, '#F6EFE6'), () => leaves(SAGE, '#7FA36B', '#E9CFA8'), () => stones(SAGE, '#5E5A55')],
  dental: [() => tooth(MINT, '#9AD0C2'), () => smile(SKY, '#E27D7D'), () => tooth(SKY, '#8DB8E0')],
  fitness: [() => dumbbell(SKY, '#2B2F36'), () => kettlebell(SAND, '#2B2F36'), () => dumbbell(PEACH, '#D0463C'), () => kettlebell(MINT, '#3E7C6F')],
  carwash: [() => car(SKY, '#3E6FB0'), () => car(MINT, '#2B2F36'), () => car(SKY, '#D0463C'), () => car(SAND, '#C9CED6')],
};

/** Фото работ мастера (F-00-085: до 6 штук) */
export function workPhotos(sphereId: SphereId, count: number, variant = 0): string[] {
  const list = WORKS[sphereId];
  if (!list || count <= 0) return [];
  return Array.from({ length: Math.min(count, 6) }, (_, i) => list[(variant + i) % list.length]());
}

// ─────────── Интерьер бизнеса

interface Interior {
  wall: [string, string];
  floor: string;
  accent: string;
  wood: string;
}

const INTERIORS: Record<'blush' | 'terracotta' | 'sage' | 'barber' | 'clinic' | 'sand', Interior> = {
  blush: { wall: ['#FBEFEA', '#F3DAD0'], floor: '#E2C4B6', accent: '#D98C8C', wood: '#C9A27E' },
  terracotta: { wall: ['#F7ECE3', '#EBCFBC'], floor: '#C98B6B', accent: '#B5613E', wood: '#8C5A3C' },
  sage: { wall: ['#EEF3EC', '#D5E2D1'], floor: '#BFCDB9', accent: '#6E8F6A', wood: '#B89B77' },
  barber: { wall: ['#2E323C', '#1C1F26'], floor: '#4A3A2E', accent: '#C9A45C', wood: '#6B4A2E' },
  clinic: { wall: ['#F2F8F8', '#DDEEEE'], floor: '#CFE0E2', accent: '#4FA3A5', wood: '#9DB4BA' },
  sand: { wall: ['#FAF5EC', '#EDE1CC'], floor: '#D8C4A2', accent: '#B08D57', wood: '#9C7A55' },
};

export type InteriorStyle = keyof typeof INTERIORS;

function plant(x: number, green: string): string {
  return `<rect x="${x - 22}" y="280" width="44" height="46" rx="8" fill="#F4F1EC"/><path d="M${x} 282C${x - 40} 240 ${x - 40} 200 ${x - 6} 180C${x - 10} 220 ${x} 250 ${x} 282Z" fill="${green}"/><path d="M${x} 282C${x + 36} 244 ${x + 44} 214 ${x + 20} 190C${x + 16} 230 ${x + 4} 254 ${x} 282Z" fill="${green}" opacity=".85"/>`;
}

function lamp(x: number, color: string): string {
  return `<path d="M${x} 0V64" stroke="${color}" stroke-width="3"/><path d="M${x - 30} 92A30 30 0 0 1 ${x + 30} 92Z" fill="${color}"/><ellipse cx="${x}" cy="96" rx="44" ry="10" fill="#FFE6A8" opacity=".5"/>`;
}

function interiorMirror(p: Interior): string {
  return frame(
    p.wall,
    `<rect y="320" width="400" height="80" fill="${p.floor}"/><path d="M130 300V150A70 70 0 0 1 270 150V300Z" fill="${p.wood}"/><path d="M142 296V152A58 58 0 0 1 258 152V296Z" fill="#E9F1F5"/><path d="M160 290L230 110" stroke="#fff" stroke-width="10" opacity=".5"/><rect x="120" y="296" width="160" height="14" rx="4" fill="${p.wood}"/><rect x="160" y="250" width="80" height="80" rx="24" fill="${p.accent}"/><rect x="176" y="328" width="8" height="40" fill="#3B3B45"/><rect x="216" y="328" width="8" height="40" fill="#3B3B45"/>${plant(330, '#6E8F6A')}${lamp(64, p.accent)}`,
  );
}

function interiorReception(p: Interior): string {
  return frame(
    p.wall,
    `<rect y="320" width="400" height="80" fill="${p.floor}"/><circle cx="200" cy="120" r="46" fill="none" stroke="${p.accent}" stroke-width="6"/><circle cx="200" cy="120" r="18" fill="${p.accent}"/><rect x="90" y="220" width="220" height="110" rx="16" fill="${p.wood}"/><rect x="90" y="220" width="220" height="16" rx="8" fill="#fff" opacity=".35"/><rect x="250" y="196" width="30" height="24" rx="4" fill="#3B3B45"/>${plant(52, '#6E8F6A')}${lamp(340, p.accent)}`,
  );
}

function interiorShelf(p: Interior): string {
  const bottles = [0, 1, 2, 3, 4]
    .map((i) => `<rect x="${118 + i * 36}" y="${150 - (i % 2) * 14}" width="24" height="${40 + (i % 2) * 14}" rx="6" fill="${i % 2 ? p.accent : '#fff'}" opacity=".95"/>`)
    .join('');
  const bottles2 = [0, 1, 2, 3]
    .map((i) => `<rect x="${130 + i * 40}" y="${236 - (i % 3) * 10}" width="26" height="${34 + (i % 3) * 10}" rx="8" fill="${i % 2 ? '#fff' : p.accent}" opacity=".9"/>`)
    .join('');
  return frame(
    p.wall,
    `<rect y="320" width="400" height="80" fill="${p.floor}"/><rect x="100" y="190" width="200" height="10" rx="4" fill="${p.wood}"/><rect x="100" y="270" width="200" height="10" rx="4" fill="${p.wood}"/>${bottles}${bottles2}<rect x="40" y="220" width="40" height="110" rx="10" fill="${p.accent}" opacity=".6"/>${plant(340, '#6E8F6A')}`,
  );
}

/** Фото бизнеса: интерьер в своей палитре (3 кадра) */
export function interiorPhotos(style: InteriorStyle): string[] {
  const p = INTERIORS[style];
  return [interiorMirror(p), interiorReception(p), interiorShelf(p)];
}

// ─────────── Портреты-аватары мастеров

/** Причёска на рисованном портрете */
export type AvatarHair = 'long' | 'bob' | 'bun' | 'curly' | 'short' | 'fade';

export interface AvatarSpec {
  hair: AvatarHair;
  /** Фон 0–7, кожа 0–3, цвет волос 0–6, одежда 0–7 */
  bg: number;
  skin: number;
  hairColor: number;
  top: number;
  beard?: boolean;
  glasses?: boolean;
}

const AV_BG: [string, string][] = [
  ['#EDE9FE', '#DDD6FE'], ['#E0F2FE', '#BAE6FD'], ['#FCE7F3', '#FBCFE8'], ['#DCFCE7', '#BBF7D0'],
  ['#FEF3C7', '#FDE68A'], ['#FFE4E6', '#FECDD3'], ['#E0E7FF', '#C7D2FE'], ['#F1F5F9', '#E2E8F0'],
];
const AV_SKIN = ['#F2D3BD', '#E8BF9F', '#D9A77F', '#C68E68'];
const AV_HAIR = ['#2B211C', '#4A3226', '#6B4A33', '#A0714A', '#C9A06A', '#1E1E24', '#8A8F99'];
const AV_TOP = ['#6D5BD0', '#3E7CB1', '#C2577A', '#3F8F6B', '#B7793A', '#2F3441', '#8B6FB5', '#D86F55'];

/**
 * Рисованный портрет без лица (плоская иллюстрация) — вместо фото мастера в демо, чтобы журнал, каталог и
 * карточки выглядели как у живого салона. Настоящее фото мастер загружает сам.
 */
export function avatarPhoto(a: AvatarSpec): string {
  const [b1, b2] = AV_BG[a.bg % AV_BG.length];
  const s = AV_SKIN[a.skin % AV_SKIN.length];
  const hc = AV_HAIR[a.hairColor % AV_HAIR.length];
  const t = AV_TOP[a.top % AV_TOP.length];
  const back: Record<AvatarHair, string> = {
    long: `<path d="M28 46C28 24 38 16 50 16S72 24 72 46V78C66 82 34 82 28 78Z" fill="${hc}"/>`,
    bob: `<path d="M29 46C29 24 39 17 50 17S71 24 71 46V62C66 66 34 66 29 62Z" fill="${hc}"/>`,
    bun: `<circle cx="50" cy="15" r="9" fill="${hc}"/>`,
    curly: `<g fill="${hc}"><circle cx="34" cy="34" r="10"/><circle cx="44" cy="24" r="11"/><circle cx="57" cy="24" r="11"/><circle cx="66" cy="34" r="10"/><circle cx="31" cy="46" r="8"/><circle cx="69" cy="46" r="8"/><circle cx="32" cy="58" r="8"/><circle cx="68" cy="58" r="8"/></g>`,
    short: '',
    fade: '',
  };
  const front: Record<AvatarHair, string> = {
    long: `<path d="M33 44C33 27 41 21 51 21C61 21 68 28 67 42C60 35 50 31 43 29C40 34 37 39 33 44Z" fill="${hc}"/>`,
    bob: `<path d="M33 44C33 27 41 21 51 21C61 21 68 28 67 44C63 36 57 30 48 30C42 34 37 38 33 44Z" fill="${hc}"/>`,
    bun: `<path d="M33 42C33 27 41 21 50 21S67 27 67 42C62 33 56 29 50 29S38 33 33 42Z" fill="${hc}"/>`,
    curly: `<path d="M34 40C36 28 43 24 50 24S64 28 66 40C60 34 55 32 50 32S40 34 34 40Z" fill="${hc}"/>`,
    short: `<path d="M33 42C31 25 41 19 51 19C62 19 70 26 67 42C65 34 59 29 50 29C43 29 37 33 33 42Z" fill="${hc}"/>`,
    fade: `<path d="M34 38C33 24 42 19 51 19C61 19 68 24 66 38C63 31 57 28 50 28C43 28 37 31 34 38Z" fill="${hc}"/>`,
  };
  const beard = a.beard ? `<path d="M34 46C34 62 42 69 50 69S66 62 66 46C63 54 58 57 50 57S37 54 34 46Z" fill="${hc}"/>` : '';
  const glasses = a.glasses
    ? `<g fill="none" stroke="#2F3441" stroke-width="1.6"><circle cx="43.5" cy="46" r="5"/><circle cx="56.5" cy="46" r="5"/><path d="M48.5 46H51.5"/></g>`
    : '';
  return uri(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${b1}"/><stop offset="1" stop-color="${b2}"/></linearGradient></defs><rect width="100" height="100" fill="url(#a)"/>${back[a.hair]}<path d="M44 58H56V74H44Z" fill="${s}"/><path d="M44 66C47 69 53 69 56 66" fill="#000" opacity=".08"/><path d="M14 104C14 82 30 72 50 72S86 82 86 104Z" fill="${t}"/><path d="M42 72L50 80L58 72" fill="${s}"/><ellipse cx="50" cy="45" rx="16.5" ry="19" fill="${s}"/><ellipse cx="33.5" cy="47" rx="2.6" ry="4" fill="${s}"/><ellipse cx="66.5" cy="47" rx="2.6" ry="4" fill="${s}"/>${beard}${front[a.hair]}${glasses}</svg>`,
  );
}

// ─────────── Логотипы мест

/**
 * Логотип-монограмма (Business.logoUrl): буквы на круге в цветах бизнеса. Шрифт — системный, поэтому
 * картинка одинаково рисуется без сети; у настоящего бизнеса владелец загружает свой логотип.
 */
export function logoPhoto(letters: string, bg: [string, string], fg: string, ring = fg): string {
  return uri(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><defs><linearGradient id="l" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${bg[0]}"/><stop offset="1" stop-color="${bg[1]}"/></linearGradient></defs><rect width="200" height="200" fill="url(#l)"/><circle cx="100" cy="100" r="74" fill="none" stroke="${ring}" stroke-width="4" opacity=".55"/><text x="100" y="100" dy=".35em" text-anchor="middle" font-family="Georgia, serif" font-size="${letters.length > 1 ? 64 : 84}" font-weight="700" letter-spacing="2" fill="${fg}">${letters}</text></svg>`,
  );
}
