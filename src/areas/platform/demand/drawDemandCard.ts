/**
 * Картинка спроса для соцсетей (F-00-202) — рисунок на canvas. Цвета — пиксели готовой картинки для скачивания
 * (Canvas не читает CSS-токены), это данные картинки, а не оформление экрана. tokens-ok
 */
export interface DemandCardText {
  query: string;
  where: string;
  people: string;
  footer: string;
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number): number {
  const words = text.split(' ');
  let line = '';
  let cy = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, cy);
      line = word;
      cy += lineHeight;
    } else {
      line = test;
    }
  }
  ctx.fillText(line, x, cy);
  return cy;
}

export function drawDemandCard(canvas: HTMLCanvasElement, w: number, h: number, text: DemandCardText): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  canvas.width = w;
  canvas.height = h;
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, '#3b2a8f'); // tokens-ok
  grad.addColorStop(1, '#161033'); // tokens-ok
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  const pad = w * 0.08;
  const top = h * (h > w ? 0.3 : 0.2);
  ctx.fillStyle = '#c9c3e8'; // tokens-ok
  ctx.font = `${Math.round(w * 0.04)}px sans-serif`;
  const whereEnd = wrapText(ctx, text.where, pad, top, w - pad * 2, w * 0.055);
  ctx.fillStyle = '#ffffff'; // tokens-ok
  ctx.font = `bold ${Math.round(w * 0.075)}px sans-serif`;
  const last = wrapText(ctx, text.query, pad, whereEnd + w * 0.11, w - pad * 2, w * 0.09);
  ctx.fillStyle = '#ffd27a'; // tokens-ok
  ctx.font = `bold ${Math.round(w * 0.2)}px sans-serif`;
  const numY = last + w * 0.26;
  const [num, ...rest] = text.people.split(' ');
  ctx.fillText(num, pad, numY);
  ctx.fillStyle = '#ffffff'; // tokens-ok
  ctx.font = `${Math.round(w * 0.045)}px sans-serif`;
  wrapText(ctx, rest.join(' '), pad, numY + w * 0.08, w - pad * 2, w * 0.06);
  ctx.fillStyle = '#c9c3e8'; // tokens-ok
  ctx.font = `${Math.round(w * 0.035)}px sans-serif`;
  ctx.fillText(text.footer, pad, h - pad);
}
