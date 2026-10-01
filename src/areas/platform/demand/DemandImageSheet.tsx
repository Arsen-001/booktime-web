'use client';

/** Картинка для соцсетей по запросу (F-00-202): готовое превью сразу, формат квадрат / сторис, «Скачать». */
import { useEffect, useRef, useState } from 'react';
import { Download } from 'lucide-react';
import { drawDemandCard } from '@/areas/platform/demand/drawDemandCard';
import type { DemandQueryGroup } from '@/domain/platform';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { Sheet } from '@/ui/Sheet';

type Format = 'square' | 'story';
const SIZE: Record<Format, [number, number]> = { square: [1080, 1080], story: [1080, 1920] };

export function DemandImageSheet({ group, onClose }: { group: DemandQueryGroup; onClose: () => void }) {
  const t = useT('platform');
  const tc = useT('common');
  const [format, setFormat] = useState<Format>('square');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const noOffer = group.districts.filter((d) => d.offerInDistrict === 0).map((d) => tc(`districts.${d.district}`));
  const text = {
    query: group.query,
    where: noOffer.length ? t('demand.imageWhere', { districts: noOffer.slice(0, 3).join(', ') }) : t('demand.imageWhereCity'),
    people: t('demand.imagePeople', { n: group.people }),
    footer: t('demand.imageFooter'),
  };
  const [w, h] = SIZE[format];

  useEffect(() => {
    if (canvasRef.current) drawDemandCard(canvasRef.current, w, h, text);
  });

  const download = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `demand-${format}-${w}x${h}.png`;
    a.click();
  };

  return (
    <Sheet
      open
      onOpenChange={(o) => !o && onClose()}
      title={t('demand.imageTitle')}
      description={group.query}
      size="md"
      footer={<Button fullWidth leftIcon={<Download aria-hidden />} onClick={download}>{t('demand.download', { size: `${w}×${h}` })}</Button>}
    >
      <div data-f="F-00-202" className="flex flex-col items-center gap-4">
        <SegmentedControl fullWidth value={format} onValueChange={(v) => setFormat(v as Format)} options={[{ value: 'square', label: t('demand.formatSquare') }, { value: 'story', label: t('demand.formatStory') }]} />
        <canvas ref={canvasRef} className={format === 'square' ? 'aspect-square w-full max-w-sm rounded-xl shadow-md' : 'aspect-[9/16] w-full max-w-[15rem] rounded-xl shadow-md'} aria-label={t('demand.imageTitle')} role="img" />
      </div>
    </Sheet>
  );
}
