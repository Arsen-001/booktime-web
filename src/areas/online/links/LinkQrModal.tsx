'use client';

/**
 * F-00-200 «QR на стойку»: администратор печатает QR и вешает у кассы — клиент наводит камеру
 * и попадает на страницу записи в этот салон/к мастеру (та же ссылка, что и выше в карточке).
 * QR кодируется на месте (@/lib/qrcode, без внешнего пакета и без сети) — работает и без сети.
 */
import { useMemo } from 'react';
import { Download } from 'lucide-react';
import { encodeQR } from '@/lib/qrcode';
import { useT } from '@/i18n/useT';
import { useToast } from '@/ui/Toast';
import { Button } from '@/ui/Button';
import { Modal } from '@/ui/Modal';

export interface LinkQrModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string;
  title: string;
}

const MODULE_PX = 8;
const QUIET_MODULES = 4;

function buildSvgMarkup(matrix: boolean[][]): { markup: string; sizePx: number } {
  const size = matrix.length;
  const sizePx = (size + QUIET_MODULES * 2) * MODULE_PX;
  let rects = '';
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!matrix[y][x]) continue;
      rects += `<rect x="${(x + QUIET_MODULES) * MODULE_PX}" y="${(y + QUIET_MODULES) * MODULE_PX}" width="${MODULE_PX}" height="${MODULE_PX}" fill="#000"/>`; // настоящий чёрный пиксель QR, не токен темы; tokens-ok
    }
  }
  const markup = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${sizePx} ${sizePx}" width="${sizePx}" height="${sizePx}"><rect width="${sizePx}" height="${sizePx}" fill="#fff"/>${rects}</svg>`; // настоящий белый лист QR, не токен темы; tokens-ok
  return { markup, sizePx };
}

export function LinkQrModal({ open, onOpenChange, url, title }: LinkQrModalProps) {
  const t = useT('online');
  const toast = useToast();

  const svg = useMemo(() => {
    if (!open) return null;
    try {
      return buildSvgMarkup(encodeQR(url));
    } catch {
      return null;
    }
  }, [open, url]);

  const download = () => {
    if (!svg) return;
    try {
      const blob = new Blob([svg.markup], { type: 'image/svg+xml' });
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = `qr-${title.replace(/\s+/g, '-').toLowerCase() || 'link'}.svg`;
      a.click();
      URL.revokeObjectURL(href);
    } catch {
      toast.error(t('links.qr.downloadFailed'));
    }
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={t('links.qr.title')}>
      <div data-f="F-00-200" className="flex flex-col items-center gap-4">
        <p className="text-center text-sm text-muted">{t('links.qr.hint')}</p>
        {svg ? (
          <div
            className="rounded-xl border border-border p-3"
            style={{ background: '#fff' }} // QR — настоящий белый лист при любой теме, иначе камера его не различит; tokens-ok
            dangerouslySetInnerHTML={{ __html: svg.markup }}
          />
        ) : (
          <p className="text-sm text-danger">{t('links.qr.buildFailed')}</p>
        )}
        <p className="max-w-xs truncate text-xs text-muted" title={url}>
          {url}
        </p>
        <Button leftIcon={<Download aria-hidden />} onClick={download} disabled={!svg}>
          {t('links.qr.download')}
        </Button>
      </div>
    </Modal>
  );
}
