'use client';

/**
 * ⭐ «Забирают сегодня» (выдача по времени, 06.10.2026): клиенты, которые по ссылке готового заказа выбрали, когда придут
 * забрать, — время, имя, номер заказа и что забирают. Пришёл — «Выдать» одним нажатием (заказ «Выдан», запись на
 * выдачу — «Пришёл»). Записей на сегодня нет — блока нет.
 */
import { useState } from 'react';
import Link from 'next/link';
import { CalendarClock, PackageCheck } from 'lucide-react';
import { setOrderStatus } from '@/api/orders';
import { useApiMutation } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import type { PickupBooking } from '@/domain/orders';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { today } from '@/lib/date';
import { useIntakeSettings, usePickupBookings } from '@/areas/orders/lib/useOrdersData';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { SectionCard } from '@/ui/SectionCard';
import { Skeleton, SkeletonText } from '@/ui/Skeleton';
import { useToast } from '@/ui/Toast';

export function PickupTodayCard() {
  const t = useT('orders');
  const fmt = useFormat();
  const toast = useToast();
  const { businessId } = useCurrent();
  const [date] = useState(today);
  const settingsQ = useIntakeSettings();
  const q = usePickupBookings(date, { enabled: settingsQ.data?.serviceId != null });
  const issueM = useApiMutation(setOrderStatus);
  const [issuing, setIssuing] = useState<string | null>(null);
  const rows = q.data ?? [];

  if (settingsQ.data?.enabled && q.isLoading) {
    return (
      <SectionCard title={<SkeletonText width="16ch" />} description={<SkeletonText width="34ch" />} padding="none">
        <div aria-busy className="flex flex-col divide-y divide-border">
          <div className="flex items-center gap-3 px-4 py-3 md:px-6">
            <Skeleton variant="rect" className="h-7 w-14 rounded-md" />
            <Skeleton lines={2} className="flex-1" />
          </div>
        </div>
      </SectionCard>
    );
  }
  if (!rows.length) return null;
  const waiting = rows.filter((r) => r.orderStatus === 'ready').length;

  async function issue(r: PickupBooking) {
    if (!r.orderId || !businessId) return;
    setIssuing(r.bookingId);
    try {
      await issueM.mutate({ businessId, orderId: r.orderId, status: 'issued' });
      toast.success(t('pickupToday.issuedToast', { number: r.orderNumber ?? '' }));
    } catch {
      toast.error(t('pickupToday.failed'));
    } finally {
      setIssuing(null);
    }
  }

  return (
    <div data-f="orders-pickup-today">
      <SectionCard title={t('pickupToday.title', { count: waiting })} description={t('pickupToday.hint')} padding="none">
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
                  <p className="line-clamp-2 text-sm text-muted">
                    {r.orderNumber != null ? t('pickupToday.order', { number: r.orderNumber }) : t('pickupToday.noOrder')}
                    {r.items ? ` · ${r.items}` : ''}
                  </p>
                </div>
              </div>
              {r.orderId && r.orderStatus === 'ready' ? (
                <Button
                  variant="secondary"
                  leftIcon={<PackageCheck aria-hidden />}
                  className="self-start sm:self-center"
                  loading={issuing === r.bookingId}
                  disabled={issuing !== null && issuing !== r.bookingId}
                  onClick={() => void issue(r)}
                >
                  {t('pickupToday.issue')}
                </Button>
              ) : r.orderId ? (
                <Link href={`/biz/orders/${r.orderId}`} className="inline-flex min-h-10 items-center self-start sm:self-center">
                  <Badge tone={r.orderStatus === 'issued' ? 'success' : 'neutral'}>
                    {r.orderStatus === 'issued' ? t('pickupToday.issued', { number: r.orderNumber ?? '' }) : t('pickupToday.notReady', { number: r.orderNumber ?? '' })}
                  </Badge>
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      </SectionCard>
    </div>
  );
}
