'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useT } from '@/i18n/useT';
import { Modal } from '@/ui/Modal';
import { ScrollRow } from '@/ui/ScrollRow';

/** Фото работ лентой превью 96–120 px (ux-r2 №40): по тапу — крупно. Не больше 6 (F-00-085) */
export function PhotoStrip({ photos, title }: { photos: string[]; title: string }) {
  const t = useT('client');
  const [open, setOpen] = useState<string | undefined>(undefined);
  if (!photos.length) return null;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-semibold text-fg">{title}</h2>
      <ScrollRow gap="sm" aria-label={title}>
        {photos.slice(0, 6).map((src, i) => (
          <button
            key={src}
            type="button"
            onClick={() => setOpen(src)}
            aria-label={t('master.photoOpen', { n: i + 1 })}
            className="block size-24 shrink-0 overflow-hidden rounded-xl ring-1 ring-border focus-visible:outline-2 focus-visible:outline-focus md:size-28"
          >
            <Image src={src} alt="" width={112} height={112} unoptimized className="size-full object-cover" />
          </button>
        ))}
      </ScrollRow>
      <Modal open={Boolean(open)} onOpenChange={(v) => !v && setOpen(undefined)} title={title} size="lg">
        {open && <Image src={open} alt="" width={800} height={800} unoptimized className="h-auto w-full rounded-xl" />}
      </Modal>
    </section>
  );
}
