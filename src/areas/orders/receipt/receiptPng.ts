/**
 * Квитанция картинкой PNG (04.10.2026): рисуем на canvas сами — без печати (print запрещён) и без снимка DOM. Тексты
 * приходят уже переведёнными и отформатированными из экрана; шрифт — тот же, что у страницы (армянский тоже).
 */
import { PAPER, type QrMatrix } from '@/areas/orders/receipt/qr';

export interface ReceiptPngData {
  businessName: string;
  businessLines: string[];
  title: string;
  /** «Принят · сб, 4 окт, 12:10», «Клиент · Ани», «Готово к · сегодня» */
  rows: [string, string][];
  itemsTitle: string;
  items: string[];
  /** Деньги: [подпись, сумма, выделить] */
  money: [string, string, boolean][];
  qr: QrMatrix;
  caption: string;
  url: string;
  fontFamily: string;
}

const W = 720;
const PAD = 48;
const SCALE = 2;

/** Разбить строку по ширине (по словам; слишком длинное слово — по символам) */
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= width) {
      line = next;
      continue;
    }
    if (line) out.push(line);
    line = word;
    while (ctx.measureText(line).width > width && line.length > 1) {
      let cut = line.length - 1;
      while (cut > 1 && ctx.measureText(line.slice(0, cut)).width > width) cut--;
      out.push(line.slice(0, cut));
      line = line.slice(cut);
    }
  }
  if (line) out.push(line);
  return out;
}

/** Вся раскладка за один проход: measure=true — только посчитать высоту, иначе нарисовать */
function layout(ctx: CanvasRenderingContext2D, d: ReceiptPngData, measure: boolean): number {
  const font = (size: number, weight = 400) => `${weight} ${size}px ${d.fontFamily}`;
  const inner = W - PAD * 2;
  let y = PAD;
  const text = (s: string, x: number, size: number, color: string, weight = 400, align: CanvasTextAlign = 'left') => {
    if (measure) return;
    ctx.font = font(size, weight);
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.fillText(s, x, y);
  };
  const block = (s: string, size: number, color: string, weight = 400, lh = 1.35) => {
    ctx.font = font(size, weight);
    for (const l of wrap(ctx, s, inner)) {
      y += size * lh;
      text(l, PAD, size, color, weight);
    }
  };
  const divider = (gap = 20) => {
    y += gap;
    if (!measure) {
      ctx.strokeStyle = PAPER.line;
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.moveTo(PAD, y);
      ctx.lineTo(W - PAD, y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    y += gap - 6;
  };
  const pair = (label: string, value: string, size: number, strong: boolean) => {
    ctx.font = font(size, strong ? 700 : 500);
    const valueW = Math.min(ctx.measureText(value).width, inner * 0.6);
    ctx.font = font(size, 400);
    const labelLines = wrap(ctx, label, inner - valueW - 16);
    y += size * 1.5;
    text(labelLines[0] ?? '', PAD, size, PAPER.muted);
    text(value, W - PAD, size, PAPER.ink, strong ? 700 : 500, 'right');
    for (const l of labelLines.slice(1)) {
      y += size * 1.3;
      text(l, PAD, size, PAPER.muted);
    }
  };

  block(d.businessName, 30, PAPER.ink, 700, 1.2);
  for (const l of d.businessLines) block(l, 20, PAPER.muted);
  divider();
  block(d.title, 34, PAPER.ink, 700, 1.25);
  for (const [label, value] of d.rows) pair(label, value, 21, false);
  y += 12;
  block(d.itemsTitle, 18, PAPER.muted, 600);
  for (const item of d.items) block(`• ${item}`, 22, PAPER.ink, 500);
  divider();
  for (const [label, value, strong] of d.money) pair(label, value, strong ? 26 : 21, strong);
  divider(24);

  const qrSide = 300;
  const cell = qrSide / (d.qr.size + 8);
  const qx = (W - qrSide) / 2;
  if (!measure) {
    ctx.fillStyle = PAPER.ink;
    for (let r = 0; r < d.qr.size; r++)
      for (let c = 0; c < d.qr.size; c++) if (d.qr.dark(r, c)) ctx.fillRect(qx + (c + 4) * cell, y + (r + 4) * cell, Math.ceil(cell), Math.ceil(cell));
  }
  y += qrSide;
  ctx.font = font(20);
  for (const l of wrap(ctx, d.caption, inner)) {
    y += 28;
    text(l, W / 2, 20, PAPER.ink, 500, 'center');
  }
  ctx.font = font(18);
  for (const l of wrap(ctx, d.url, inner)) {
    y += 26;
    text(l, W / 2, 18, PAPER.muted, 400, 'center');
  }
  return y + PAD;
}

export async function receiptPng(d: ReceiptPngData): Promise<Blob> {
  // Шрифт страницы должен быть загружен, иначе canvas нарисует запасным
  if (typeof document !== 'undefined' && document.fonts?.ready) await document.fonts.ready;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas');
  ctx.textBaseline = 'alphabetic';
  const height = Math.ceil(layout(ctx, d, true));
  canvas.width = W * SCALE;
  canvas.height = height * SCALE;
  ctx.scale(SCALE, SCALE);
  ctx.fillStyle = PAPER.bg;
  ctx.fillRect(0, 0, W, height);
  ctx.textBaseline = 'alphabetic';
  layout(ctx, d, false);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob'))), 'image/png'));
}

/** Сохранить файл: на телефоне с «Поделиться файлом» — системное меню (WhatsApp, Telegram, Фото), иначе — загрузка */
export async function saveBlob(blob: Blob, fileName: string): Promise<'shared' | 'downloaded'> {
  const file = new File([blob], fileName, { type: blob.type });
  const nav = navigator as Navigator & { canShare?: (data: { files: File[] }) => boolean };
  const coarse = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
  if (coarse && nav.canShare?.({ files: [file] }) && nav.share) {
    try {
      await nav.share({ files: [file] });
      return 'shared';
    } catch (err) {
      if ((err as Error).name === 'AbortError') return 'shared';
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'downloaded';
}
