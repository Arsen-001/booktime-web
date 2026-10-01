/**
 * Выгрузка графика в PDF (F-02-016) без сторонней библиотеки: минимальный валидный PDF-файл
 * с моноширинным текстом — то, что справка называет «Выгрузить в PDF» по адресу
 * /schedule/print_pdf/<локация>/. Хватает для «сохранить/распечатать таблицу», без вёрстки.
 */
function escapePdfText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

const PAGE_HEIGHT = 841.89; // A4, pt
const PAGE_WIDTH = 595.28;
const MARGIN = 40;
const LINE_HEIGHT = 14;
const LINES_PER_PAGE = Math.floor((PAGE_HEIGHT - MARGIN * 2) / LINE_HEIGHT);

function buildPageContent(lines: string[]): string {
  const ops: string[] = ['BT', '/F1 10 Tf', `${LINE_HEIGHT} TL`, `${MARGIN} ${PAGE_HEIGHT - MARGIN} Td`];
  lines.forEach((line, i) => {
    if (i > 0) ops.push('T*');
    ops.push(`(${escapePdfText(line)}) Tj`);
  });
  ops.push('ET');
  return ops.join('\n');
}

/** Собирает PDF из строк текста, разбивая на страницы, и возвращает Blob для скачивания */
export function buildTextPdf(title: string, lines: string[]): Blob {
  const allLines = [title, ''.padEnd(0), ...lines];
  const pages: string[][] = [];
  for (let i = 0; i < allLines.length; i += LINES_PER_PAGE) pages.push(allLines.slice(i, i + LINES_PER_PAGE));
  if (pages.length === 0) pages.push(['']);

  const objects: string[] = [];
  const fontObjNum = 2 + pages.length * 2 + 1;
  const pagesObjNum = 2;

  // 1: Catalog, 2: Pages, 3..: (Page, Content) pairs, last: Font
  objects[0] = `1 0 obj\n<< /Type /Catalog /Pages ${pagesObjNum} 0 R >>\nendobj`;

  const pageObjNums: number[] = [];
  let nextObjNum = 3;
  const pageBodies: { num: number; contentNum: number; content: string }[] = [];
  for (const pageLines of pages) {
    const pageNum = nextObjNum++;
    const contentNum = nextObjNum++;
    pageObjNums.push(pageNum);
    pageBodies.push({ num: pageNum, contentNum, content: buildPageContent(pageLines) });
  }

  objects[1] = `${pagesObjNum} 0 obj\n<< /Type /Pages /Kids [${pageObjNums.map((n) => `${n} 0 R`).join(' ')}] /Count ${pageObjNums.length} >>\nendobj`;

  for (const { num, contentNum } of pageBodies) {
    objects.push(
      `${num} 0 obj\n<< /Type /Page /Parent ${pagesObjNum} 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${fontObjNum} 0 R >> >> /Contents ${contentNum} 0 R >>\nendobj`,
    );
  }
  for (const { contentNum, content } of pageBodies) {
    objects.push(`${contentNum} 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj`);
  }
  objects.push(`${fontObjNum} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>\nendobj`);

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  for (const obj of objects) {
    offsets.push(pdf.length);
    pdf += `${obj}\n`;
  }
  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) pdf += `${String(off).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return new Blob([pdf], { type: 'application/pdf' });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
