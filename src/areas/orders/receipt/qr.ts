/**
 * QR-код ссылки статуса заказа (04.10.2026) — пакет `qrcode` (только расчёт матрицы, рисуем сами: SVG на экране,
 * canvas для PNG). Коррекция ошибок M — код читается с мятой бумаги и экрана телефона.
 */
import { create } from 'qrcode';

export interface QrMatrix {
  size: number;
  /** true — тёмный модуль */
  dark: (row: number, col: number) => boolean;
}

export function qrMatrix(text: string): QrMatrix {
  const { modules } = create(text, { errorCorrectionLevel: 'M' });
  return { size: modules.size, dark: (r, c) => Boolean(modules.get(r, c)) };
}

/** Путь SVG всех тёмных модулей (один <path> вместо сотен <rect>) со сдвигом на поле `quiet` */
export function qrPath(m: QrMatrix, quiet: number): string {
  let d = '';
  for (let r = 0; r < m.size; r++) for (let c = 0; c < m.size; c++) if (m.dark(r, c)) d += `M${c + quiet} ${r + quiet}h1v1h-1z`;
  return d;
}

/**
 * Цвета «бумаги» QR и картинки PNG — всегда тёмное на светлом, в любой теме: светлый код на тёмном фоне читают не все
 * камеры, а квитанцию клиент пересылает и печатает. Это цвет как данные (как оттенок лака), не оформление.
 */
export const PAPER = {
  bg: '#ffffff', // tokens-ok
  ink: '#111111', // tokens-ok
  muted: '#5b6170', // tokens-ok
  line: '#e3e5ea', // tokens-ok
} as const;
