'use client';

import { type Order } from '@/domain/orders';
import { useT } from '@/i18n/useT';
import { SectionCard } from '@/ui/SectionCard';

export function ItemsCard({ order }: { order: Order }) {
  const t = useT('orders');
  return (
    <SectionCard title={t('detail.items')}>
      <ul className="flex flex-col divide-y divide-border">
        {order.items.map((item, i) => (
          <li key={i} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
            <span className="min-w-0">
              <span className="block font-medium text-fg">{item.title}</span>
              {item.note && <span className="mt-0.5 block text-sm text-muted">{item.note}</span>}
            </span>
            <span className="shrink-0 text-sm font-semibold text-muted tabular-nums">×{item.qty}</span>
          </li>
        ))}
      </ul>
      {order.photos.length > 0 && (
        <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {order.photos.map((src, i) => (
            <a key={i} href={src} target="_blank" rel="noreferrer" className="block aspect-square overflow-hidden rounded-lg bg-surface-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- фото приёма: data: URL или адрес хранилища */}
              <img src={src} alt={t('detail.photoAlt', { n: i + 1 })} className="size-full object-cover" />
            </a>
          ))}
        </div>
      )}
      {order.comment && (
        <p className="mt-4 rounded-lg bg-surface-2 px-3 py-2.5 text-sm text-fg">
          <span className="font-semibold">{t('detail.comment')}: </span>
          {order.comment}
        </p>
      )}
    </SectionCard>
  );
}
