'use client';

/**
 * ⭐ Вклад «Заказы» в окно записи (хост bookingWindow), запись на сдачу (05.10.2026): у записи на «Приём заказа» — что
 * клиент сдаёт и «Принять заказ» (форма заказа уже с клиентом и вещью). Заказ уже принят — номер и ссылка на него.
 * Хозяин показывает вкладку только у таких записей. Посмотреть без хозяина: /dev/ext/bookingWindow/orders
 */
import { useState } from 'react';
import Link from 'next/link';
import { PackageCheck, PackagePlus } from 'lucide-react';
import type { BookingWindowExtProps } from '@/extensions/types';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { OrderFormSheet } from '@/areas/orders/form/OrderFormSheet';
import { useIntakeBookings } from '@/areas/orders/lib/useOrdersData';
import { Button, LinkButton } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { ExitHold } from '@/ui/ExitHold';
import { Skeleton } from '@/ui/Skeleton';

export default function OrdersBookingWindow({ bookingId, draft }: BookingWindowExtProps) {
  const t = useT('orders');
  const fmt = useFormat();
  const date = draft.start?.slice(0, 10) ?? '';
  const q = useIntakeBookings(date, { enabled: Boolean(bookingId && date) });
  const [accepting, setAccepting] = useState(false);
  const row = q.data?.find((r) => r.bookingId === bookingId);

  if (q.isLoading) {
    return (
      <div aria-busy className="flex flex-col gap-3">
        <Skeleton lines={3} />
        <Skeleton variant="rect" className="h-11 w-40 rounded-lg" />
      </div>
    );
  }
  if (!row) {
    return <EmptyState icon={<PackagePlus aria-hidden />} title={t('intake.windowGone')} description={t('intake.windowGoneHint')} />;
  }

  return (
    <div className="flex flex-col gap-4" data-f="orders-intake-booking">
      <div className="flex flex-col gap-1 rounded-xl bg-surface-2 p-4">
        <p className="text-sm text-muted">{t('intake.windowTitle', { time: fmt.time(row.start) })}</p>
        <p className="font-medium text-fg">{row.clientName || t('intake.noName')}</p>
        <p className="text-fg">{row.description || t('intake.noDescription')}</p>
      </div>
      {row.orderId ? (
        <div className="flex flex-col gap-2">
          <p className="flex items-center gap-2 text-sm text-fg">
            <PackageCheck aria-hidden className="size-4 text-success" />
            {t('intake.accepted', { number: row.orderNumber ?? '' })}
          </p>
          <LinkButton href={`/biz/orders/${row.orderId}`} variant="secondary" className="self-start">
            {t('intake.openOrder')}
          </LinkButton>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <Button leftIcon={<PackagePlus aria-hidden />} className="self-start" onClick={() => setAccepting(true)}>
            {t('intake.accept')}
          </Button>
          <p className="text-sm text-muted">{t('intake.acceptHint')}</p>
        </div>
      )}
      <p className="text-sm text-muted">
        <Link href="/biz/orders" className="font-medium text-primary-text hover:underline">
          {t('intake.allToday')}
        </Link>
      </p>
      <ExitHold value={accepting ? row : null}>
        {(b) => (
          <OrderFormSheet
            fromBooking={{ bookingId: b.bookingId, clientId: b.clientId, clientName: b.clientName, clientPhone: b.clientPhone, description: b.description, staffId: b.staffId }}
            onClose={() => setAccepting(false)}
          />
        )}
      </ExitHold>
    </div>
  );
}
