/*
 * «Тон» (docs/design/DESIGN.md → Booking card «C · Tone»): из одного цвета (оттенок лака, цвет категории услуги,
 * цвет мастера) — заливка карточки, тёмный тон для крупного времени и текста, кольцо вокруг «капли».
 * Контраст не на глаз: toneInk сам затемняет, пока текст не держит ≥ 4.5:1 на заливке.
 *
 *   const t = tone('#9b1b30');   // { fill, ink, ring, drop, solid, contrast }
 *   <div style={{ background: t.fill, color: t.ink }}>…</div>
 *
 * Чистые функции без React — проверка: node scripts/tone-check.mjs
 */

export type Rgb = readonly [number, number, number];

/** Минимальный контраст обычного текста (WCAG AA) */
export const MIN_CONTRAST = 4.5;
/** Доля цвета в заливке карточки (остальное — белый) */
export const FILL_AMOUNT = 0.16;
/** Доля цвета в кольце «капли» — светлее самой капли, темнее заливки */
export const RING_AMOUNT = 0.32;
/** Светлый цвет затемняется до ×0.45 */
export const INK_DARKEN = 0.45;
/** Порог «светлого» цвета по относительной яркости: светлее — затемняем, темнее — берём как есть */
export const LIGHT_LUMINANCE = 0.18;

const WHITE: Rgb = [255, 255, 255];

export function parseHex(hex: string): Rgb {
  let h = hex.trim().replace(/^#/, '');
  if (h.length === 3 || h.length === 4) h = [...h.slice(0, 3)].map((c) => c + c).join('');
  if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(h)) throw new Error(`tone: not a hex colour: ${hex}`);
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function toHex([r, g, b]: Rgb): string {
  const c = (v: number) =>
    Math.round(Math.min(255, Math.max(0, v)))
      .toString(16)
      .padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Смешать: amount — доля цвета a (1 → a, 0 → b) */
export function mix(a: string, b: string, amount: number): string {
  const x = parseHex(a);
  const y = parseHex(b);
  return toHex([0, 1, 2].map((i) => x[i] * amount + y[i] * (1 - amount)) as unknown as Rgb);
}

/** Умножить каналы (затемнить к чёрному): factor 0.45 → 45% яркости каналов */
export function darken(hex: string, factor: number): string {
  const [r, g, b] = parseHex(hex);
  return toHex([r * factor, g * factor, b * factor]);
}

/** Относительная яркость по WCAG 2.x */
export function luminance(hex: string): number {
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = parseHex(hex);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Контраст двух цветов по WCAG: 1…21 */
export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export function isLight(hex: string): boolean {
  return luminance(hex) > LIGHT_LUMINANCE;
}

/** Заливка карточки: цвет, смешанный с белым (16% цвета) */
export function toneFill(hex: string): string {
  return mix(hex, toHex(WHITE), FILL_AMOUNT);
}

/** Кольцо вокруг «капли»: светлее цвета, темнее заливки */
export function toneRing(hex: string): string {
  return mix(hex, toHex(WHITE), RING_AMOUNT);
}

/**
 * Тёмный тон для крупного времени и текста на заливке: светлый цвет — ×0.45, тёмный — как есть.
 * Если на фоне (по умолчанию — toneFill того же цвета) контраст < 4.5:1, затемняем дальше шагами по 10%.
 */
export function toneInk(hex: string, background: string = toneFill(hex), min: number = MIN_CONTRAST): string {
  let ink = isLight(hex) ? darken(hex, INK_DARKEN) : toHex(parseHex(hex));
  for (let i = 0; i < 24 && contrast(ink, background) < min; i++) ink = darken(ink, 0.9);
  return ink;
}

/**
 * Сплошная заливка события, как в Google Calendar (журнал, 08.10.2026): сам цвет, а если белый текст на нём
 * не держит 4.5:1 — тот же цвет темнее шагами по 8% (насыщенность остаётся, цвет не «грязнеет» в серый).
 */
export function toneSolid(hex: string, min: number = MIN_CONTRAST): string {
  let solid = toHex(parseHex(hex));
  for (let i = 0; i < 30 && contrast(solid, toHex(WHITE)) < min; i++) solid = darken(solid, 0.92);
  return solid;
}

export interface Tone {
  /** Исходный цвет — «капля» */
  drop: string;
  /** Сплошная заливка с белым текстом (≥ 4.5:1) */
  solid: string;
  /** Заливка карточки */
  fill: string;
  /** Текст и крупное время */
  ink: string;
  /** Кольцо вокруг капли */
  ring: string;
  /** Фактический контраст ink на fill */
  contrast: number;
}

/** Всё сразу для карточки в тоне цвета */
export function tone(hex: string): Tone {
  const drop = toHex(parseHex(hex));
  const fill = toneFill(drop);
  const ink = toneInk(drop, fill);
  return { drop, solid: toneSolid(drop), fill, ink, ring: toneRing(drop), contrast: contrast(ink, fill) };
}
