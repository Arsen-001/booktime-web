'use client';

import { qrMatrix, qrPath, PAPER } from '@/areas/orders/receipt/qr';

/** QR-код ссылки: тёмные модули на белом в любой теме (иначе не все камеры прочитают), поле 4 модуля по стандарту */
export function QrCode({ value, label, className }: { value: string; label: string; className?: string }) {
  const m = qrMatrix(value);
  const quiet = 4;
  const full = m.size + quiet * 2;
  return (
    <svg role="img" aria-label={label} viewBox={`0 0 ${full} ${full}`} shapeRendering="crispEdges" className={className}>
      <rect width={full} height={full} fill={PAPER.bg} />
      <path d={qrPath(m, quiet)} fill={PAPER.ink} />
    </svg>
  );
}
