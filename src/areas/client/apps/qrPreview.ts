/**
 * Декоративная «QR»-сетка для стойки (F-14-003) — детерминированный узор по строке ссылки, без внешней
 * сети и библиотек (CSP не пускает сторонние скрипты). Это НЕ настоящий QR-код — сканер его не прочитает;
 * рядом всегда есть сама ссылка текстом и кнопка «Скопировать». Настоящий QR — просьба (qa/requests/client.md).
 */
function hashString(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

export function qrPreviewSvg(value: string, size = 96): string {
  const cells = 9;
  const cell = size / cells;
  const seed = hashString(value);
  let rects = '';
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      const onCorner = (x < 2 && y < 2) || (x >= cells - 2 && y < 2) || (x < 2 && y >= cells - 2);
      const bit = onCorner ? true : ((seed >> ((x * cells + y) % 31)) & 1) === 1;
      if (bit) rects += `<rect x="${x * cell}" y="${y * cell}" width="${cell}" height="${cell}" fill="#1b1930"/>`; // tokens-ok
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" fill="#fff"/>${rects}</svg>`; // tokens-ok
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
