'use client';

/**
 * ⭐ «Сдают сегодня» (запись на сдачу, 05.10.2026): клиенты, которые записались принести вещь сегодня, — время, имя и что
 * сдают. Пришёл — «Принять заказ»: форма заказа уже с клиентом и вещью. Принятые — ссылка на заказ. Записей на сегодня
 * нет — блока нет (список заказов ниже — главное на экране).
 */
import { useState } from 'react';
import Link from 'next/link';
import { CalendarClock, PackagePlus } from 'lucide-react';
import type { IntakeBooking } from '@/domain/orders';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { today } from '@/lib/date';
import { OrderFormSheet } from '@/areas/orders/form/OrderFormSheet';
import { useIntakeBookings, useIntakeSettings } from '@/areas/orders/lib/useOrdersData';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { ExitHold } from '@/ui/ExitHold';
import { SectionCard } from '@/ui/SectionCard';
import { Skeleton, SkeletonText } from '@/ui/Skeleton';

export function IntakeTodayCard() {
  const t = useT('orders');
  const fmt = useFormat();
  const [date] = useState(today);
  const settingsQ = useIntakeSettings();
  const q = useIntakeBookings(date, { enabled: settingsQ.data?.serviceId != null });
  const [accepting, setAccepting] = useState<IntakeBooking | null>(null);
  const rows = q.data ?? [];
  // Запись на сдачу включена, а список ещё грузится — место блока занято сразу (страница не прыгает)
  if (settingsQ.data?.enabled && q.isLoading) {
    return (
      <SectionCard title={<SkeletonText width="14ch" />} description={<SkeletonText width="32ch" />} padding="none">
        <div aria-busy className="flex flex-col divide-y divide-border">
          {[0, 1].map((i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3 md:px-6">
              <Skeleton variant="rect" className="h-7 w-14 rounded-md" />
              <Skeleton lines={2} className="flex-1" />
            </div>
          ))}
        </div>
      </SectionCard>
    );
  }
  if (!rows.length) return null;
  const waiting = rows.filter((r) => !r.orderId).length;

  return (
    <div data-f="orders-intake-today">
      <SectionCard
        title={t('intake.todayTitle', { count: waiting })}
        description={t('intake.todayHint')}
        padding="none"
      >
        <ul className="divide-y divide-border">
          {rows.map((r) => (
            <li key={r.bookingId} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4 md:px-6">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <span className="mt-0.5 flex h-7 min-w-14 shrink-0 items-center justify-center gap-1 rounded-md bg-surface-2 px-1.5 text-sm font-semibold text-fg tabular-nums">
                  <CalendarClock aria-hidden className="size-3.5 text-muted" />
                  {fmt.time(r.start)}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-medium text-fg">{r.clientName || t('intake.noName')}</p>
                  <p className="line-clamp-2 text-sm text-muted">{r.description || t('intake.noDescription')}</p>
                </div>
              </div>
              {r.orderId ? (
                <Link href={`/biz/orders/${r.orderId}`} className="inline-flex min-h-10 items-center self-start sm:self-center">
                  <Badge tone="success">{t('intake.accepted', { number: r.orderNumber ?? '' })}</Badge>
                </Link>
              ) : (
                <Button variant="secondary" leftIcon={<PackagePlus aria-hidden />} className="self-start sm:self-center" onClick={() => setAccepting(r)}>
                  {t('intake.accept')}
                </Button>
              )}
            </li>
          ))}
        </ul>
      </SectionCard>
      <ExitHold value={accepting}>
        {(b) => (
          <OrderFormSheet
            fromBooking={{ bookingId: b.bookingId, clientId: b.clientId, clientName: b.clientName, clientPhone: b.clientPhone, description: b.description, staffId: b.staffId }}
            onClose={() => setAccepting(null)}
          />
        )}
      </ExitHold>
    </div>
  );
}
