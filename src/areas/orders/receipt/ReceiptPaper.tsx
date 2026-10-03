'use client';

/** Квитанция на экране — «листок»: бизнес, заказ, клиент, что сдали, деньги и QR-код ссылки статуса */
import type { ReactNode } from 'react';
import { useT } from '@/i18n/useT';
import { QrCode } from '@/areas/orders/receipt/QrCode';
import type { ReceiptModel } from '@/areas/orders/receipt/receiptModel';
import { cn } from '@/lib/cn';
import { Skeleton, SkeletonText } from '@/ui/Skeleton';

function Row({ label, children, strong }: { label: string; children: ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className={cn('text-right text-fg tabular-nums', strong ? 'text-lg font-bold' : 'text-base font-medium')}>{children}</dd>
    </div>
  );
}

export function ReceiptPaper({ model, number }: { model: ReceiptModel; number: number }) {
  const t = useT('orders');
  return (
    <article data-f="orders-receipt" className="w-full rounded-2xl border border-border bg-surface px-5 py-6 shadow-sm sm:px-7">
      <header className="flex flex-col gap-1">
        <h2 className="text-xl leading-tight font-bold text-fg">{model.businessName}</h2>
        {model.address && <p className="text-sm text-muted">{model.address}</p>}
        {model.phone && <p className="text-sm text-muted tabular-nums">{model.phone}</p>}
      </header>

      <div className="my-5 border-t border-dashed border-border-strong" />

      <p className="text-2xl leading-tight font-bold text-fg">{model.title}</p>
      <dl className="mt-3 flex flex-col gap-2">
        <Row label={t('receipt.accepted')}>{model.accepted}</Row>
        <Row label={t('receipt.client')}>{model.client}</Row>
        <Row label={t('receipt.due')}>{model.due}</Row>
      </dl>

      <p className="mt-5 text-sm font-medium text-muted">{t('receipt.items')}</p>
      <ul className="mt-1 flex list-disc flex-col gap-1 pl-5 text-base text-fg marker:text-muted">
        {model.items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>

      <div className="my-5 border-t border-dashed border-border-strong" />

      <dl className="flex flex-col gap-2">
        <Row label={t('receipt.price')}>{model.price}</Row>
        {model.prepaid && <Row label={t('receipt.prepaid')}>{model.prepaid}</Row>}
        <Row label={t('receipt.remaining')} strong>
          {model.remaining}
        </Row>
      </dl>

      <div className="my-5 border-t border-dashed border-border-strong" />

      <figure className="flex flex-col items-center gap-3 text-center">
        <QrCode value={model.url} label={t('receipt.qrAlt', { number })} className="size-48 rounded-md sm:size-52" />
        <figcaption className="flex flex-col gap-1">
          <span className="text-sm font-medium text-fg">{t('receipt.scan')}</span>
          <span className="text-sm break-all text-muted">{model.url}</span>
        </figcaption>
      </figure>
    </article>
  );
}

/** Квитанция до данных — тот же листок */
export function ReceiptPaperSkeleton() {
  return (
    <div aria-busy className="w-full rounded-2xl border border-border bg-surface px-5 py-6 shadow-sm sm:px-7">
      <p className="text-xl leading-tight font-bold">
        <SkeletonText width="14ch" />
      </p>
      <p className="mt-1 text-sm">
        <SkeletonText width="24ch" />
      </p>
      <div className="my-5 border-t border-dashed border-border-strong" />
      <p className="text-2xl leading-tight font-bold">
        <SkeletonText width="10ch" />
      </p>
      <div className="mt-3 flex flex-col gap-2">
        {Array.from({ length: 3 }, (_, i) => (
          <p key={i} className="text-base">
            <SkeletonText width="100%" />
          </p>
        ))}
      </div>
      <div className="my-5 border-t border-dashed border-border-strong" />
      <Skeleton variant="rect" className="mx-auto size-48 rounded-md sm:size-52" />
    </div>
  );
}
