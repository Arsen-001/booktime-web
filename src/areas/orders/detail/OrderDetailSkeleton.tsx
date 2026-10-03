'use client';

/** Заказ до данных — та же раскладка, что у экрана: заголовок, шаги, две колонки карточек. */
import { useT } from '@/i18n/useT';
import { Skeleton, SkeletonText } from '@/ui/Skeleton';

function CardSkeleton({ lines }: { lines: number }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-4 py-4 sm:px-5 sm:pb-5">
      <p className="text-[1.0625rem] leading-snug font-bold">
        <SkeletonText width="10ch" />
      </p>
      <div className="mt-4 flex flex-col gap-3">
        {Array.from({ length: lines }, (_, i) => (
          <p key={i} className="text-base">
            <SkeletonText width={i % 2 ? '18ch' : '26ch'} />
          </p>
        ))}
      </div>
    </div>
  );
}

export function OrderDetailSkeleton() {
  const t = useT('orders');
  return (
    <div aria-busy className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <p className="text-sm text-muted">{t('title')}</p>
        <h1 className="text-2xl leading-tight font-bold sm:text-[1.75rem]">
          <SkeletonText width="11ch" />
        </h1>
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-24 rounded-full" />
          <span className="text-sm">
            <SkeletonText width="16ch" />
          </span>
        </div>
      </header>
      <section className="rounded-2xl border border-border bg-surface p-4 sm:p-6">
        <div className="grid grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <Skeleton variant="circle" className="size-10" />
              <span className="text-sm">
                <SkeletonText width="7ch" />
              </span>
            </div>
          ))}
        </div>
      </section>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <div className="flex flex-col gap-6">
          <CardSkeleton lines={2} />
          <CardSkeleton lines={3} />
        </div>
        <div className="flex flex-col gap-6">
          <CardSkeleton lines={3} />
          <CardSkeleton lines={3} />
        </div>
      </div>
    </div>
  );
}
