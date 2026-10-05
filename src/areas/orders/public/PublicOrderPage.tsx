'use client';

/**
 * /o/<code> — ⭐ статус заказа для клиента без входа (03.10.2026): «Заказ №1024», крупный статус («Готов — можно
 * забирать», «Готов с 14:30»), шаги, что сдали, сколько заплатить при получении, телефон (текстом и звонком) и адрес.
 * Клиенту больше не нужно звонить «готово ли?» — ссылка приходит вместе с «Готово» и при приёме заказа. ⭐ Готов —
 * «Когда заберёте?»: клиент сам выбирает время выдачи (06.10.2026).
 */
import { MapPin, PackageSearch, Phone } from 'lucide-react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { HttpApiError } from '@/api/http';
import { publicAddressText } from '@/api/orders';
import { ApiError } from '@/api/request';
import { orderRemaining, skippedOrderSteps, type PublicOrder } from '@/domain/orders';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';
import { today } from '@/lib/date';
import { usePublicOrder } from '@/areas/orders/lib/useOrdersData';
import { PublicEstimateCard } from '@/areas/orders/public/PublicEstimateCard';
import { PublicPickupCard } from '@/areas/orders/public/PublicPickupCard';
import { PublicOrderSkeleton } from '@/areas/orders/public/PublicOrderSkeleton';
import { OrderProgress } from '@/areas/orders/ui/OrderProgress';
import { ORDER_STATUS_META } from '@/areas/orders/ui/orderStatusMeta';
import { buttonClasses } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';

const HERO_TONE = {
  received: 'bg-info-soft text-info',
  in_progress: 'bg-primary-soft text-primary-text',
  ready: 'bg-success-soft text-success',
  issued: 'bg-surface-3 text-fg',
  cancelled: 'bg-danger-soft text-danger',
} as const;

export function PublicOrderPage({ code, initialData }: { code: string; initialData?: PublicOrder }) {
  const t = useT('orders');
  const q = usePublicOrder(code, initialData);

  if (q.isLoading) return <PublicOrderSkeleton />;
  if (q.isError || !q.data) {
    const err = q.error;
    const notFound = (err instanceof HttpApiError && err.status === 404) || (err instanceof ApiError && err.code === 'not_found');
    return notFound ? (
      <EmptyState icon={<PackageSearch aria-hidden />} title={t('public.notFound')} description={t('public.notFoundHint')} />
    ) : (
      <ErrorState onRetry={q.refetch} />
    );
  }
  return <PublicOrderView code={code} order={q.data} onStale={() => void q.refetch()} />;
}

function PublicOrderView({ code, order, onStale }: { code: string; order: PublicOrder; onStale: () => void }) {
  const t = useT('orders');
  const fmt = useFormat();
  const locale = useLocale() as 'ru' | 'en' | 'hy';
  const { icon: Icon } = ORDER_STATUS_META[order.status];
  const left = orderRemaining(order);
  const address = publicAddressText(order.business.address, locale);

  const readySince = order.readyAt
    ? order.readyAt.slice(0, 10) === today()
      ? t('public.readySinceToday', { time: fmt.time(order.readyAt) })
      : t('public.readySince', { when: `${fmt.date(order.readyAt, 'dayMonth')}, ${fmt.time(order.readyAt)}` })
    : null;
  const est = order.estimate ?? null;
  const estimatePending = est?.status === 'pending' && (order.status === 'received' || order.status === 'in_progress');
  const subline = estimatePending
    ? t('public.estimate.waiting')
    : order.status === 'ready'
      ? (readySince ?? t('public.readyNow'))
      : order.status === 'issued'
        ? t('public.issuedHint')
        : order.status === 'cancelled'
          ? t('public.cancelledHint')
          : order.dueDate
            ? t('public.due', { when: fmt.relativeDay(order.dueDate).toLocaleLowerCase(locale) })
            : t('public.noDue');

  return (
    <div data-f="orders-public" className="flex flex-col gap-4">
      <header className="flex flex-col gap-1 px-1">
        <Link href={`/b/${order.business.slug}`} className="inline-flex min-h-10 items-center self-start text-sm font-semibold text-muted underline-offset-4 hover:text-fg hover:underline">
          {order.business.name}
        </Link>
        <h1 className="text-2xl leading-tight font-bold tracking-tight text-fg sm:text-3xl">{t('number', { number: order.number })}</h1>
      </header>

      <section aria-live="polite" className="rounded-2xl border border-border bg-surface p-4 sm:p-6">
        <div className="flex items-center gap-4">
          <span className={cn('inline-flex size-14 shrink-0 items-center justify-center rounded-full [&_svg]:size-7', HERO_TONE[order.status])}>
            <Icon aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-xl leading-tight font-bold text-fg sm:text-2xl">{t(`public.status.${order.status}`)}</p>
            <p className="mt-1 text-base text-muted">{subline}</p>
          </div>
        </div>
        {order.status !== 'cancelled' && <OrderProgress status={order.status} skipped={skippedOrderSteps(order)} className="mt-6" times={readySince ? { ready: fmt.time(order.readyAt ?? '') } : undefined} />}
      </section>

      {order.pickup && <PublicPickupCard code={code} pickup={order.pickup} onStale={onStale} />}

      {est && <PublicEstimateCard code={code} order={{ ...order, estimate: est }} onStale={onStale} />}

      <section className="rounded-2xl border border-border bg-surface p-4 sm:p-6">
        <h2 className="text-[1.0625rem] font-bold text-fg">{t('public.items')}</h2>
        <ul className="mt-3 flex flex-col divide-y divide-border">
          {order.items.map((item, i) => (
            <li key={i} className="flex items-baseline justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
              <span className="min-w-0 text-base text-fg">{item.title}</span>
              <span className="shrink-0 text-sm font-semibold text-muted tabular-nums">×{item.qty}</span>
            </li>
          ))}
        </ul>
        {order.price > 0 && order.status !== 'cancelled' && !estimatePending && (
          <div className="mt-4 flex flex-col gap-1 border-t border-border pt-4">
            <div className="flex items-baseline justify-between gap-4">
              <span className="font-semibold text-fg">{order.status === 'issued' ? t('public.total') : t('public.toPay')}</span>
              <span className="text-2xl font-bold text-fg tabular-nums">{fmt.money(order.status === 'issued' ? order.price : left)}</span>
            </div>
            {order.prepaid > 0 && order.status !== 'issued' && (
              <p className="text-sm text-muted">{t('public.prepaidLine', { price: fmt.money(order.price), prepaid: fmt.money(order.prepaid) })}</p>
            )}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-surface p-4 sm:p-6">
        <h2 className="text-[1.0625rem] font-bold text-fg">{order.business.name}</h2>
        <div className="mt-3 flex flex-col gap-3">
          {address && (
            <p className="flex items-start gap-2.5 text-base text-fg">
              <MapPin aria-hidden className="mt-0.5 size-5 shrink-0 text-muted" />
              {address}
            </p>
          )}
          {order.business.phone && (
            <p className="flex items-center gap-2.5 text-base text-fg">
              <Phone aria-hidden className="size-5 shrink-0 text-muted" />
              <span className="tabular-nums">{fmt.phone(order.business.phone)}</span>
            </p>
          )}
        </div>
        {order.business.phone && (
          <a
            href={`tel:${order.business.phone}`}
            className={cn(buttonClasses({ variant: order.status === 'ready' && !order.pickup?.enabled ? 'primary' : 'secondary', size: 'lg', fullWidth: true }), 'mt-4')}
          >
            <Phone aria-hidden />
            {t('public.call')}
          </a>
        )}
      </section>
    </div>
  );
}
