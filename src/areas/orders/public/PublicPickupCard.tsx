'use client';

/**
 * ⭐ «Когда заберёте?» на странице заказа /o/<код> (выдача по времени, 06.10.2026): заказ готов — клиент без входа
 * выбирает день и время на неделю вперёд, одна большая кнопка «Приду завтра в 15:30». Выбрал — карточка показывает
 * «Ждём вас …», «Изменить время» и «Не смогу». Мастерская видит его в журнале («Выдача: №…») и в «Забирают сегодня».
 */
import { useState } from 'react';
import { CalendarCheck, CalendarClock, CalendarX } from 'lucide-react';
import { cancelPublicPickup } from '@/api/orders-public';
import { useApiMutation } from '@/api/request';
import type { PublicOrderPickup } from '@/domain/orders';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';
import { PickupPicker } from '@/areas/orders/public/PickupPicker';
import { Button } from '@/ui/Button';
import { useConfirm, useToast } from '@/ui/Toast';

export interface PublicPickupCardProps {
  code: string;
  pickup: PublicOrderPickup;
  /** Перечитать заказ (время поменяли с другого устройства, мастерская выключила выдачу по времени) */
  onStale: () => void;
}

export function PublicPickupCard({ code, pickup, onStale }: PublicPickupCardProps) {
  const t = useT('orders');
  const fmt = useFormat();
  const toast = useToast();
  const confirm = useConfirm();
  const [changing, setChanging] = useState(false);
  const booking = pickup.booking;
  const picking = pickup.enabled && (!booking || changing);
  const cancelM = useApiMutation(cancelPublicPickup);

  async function cancel() {
    const ok = await confirm({
      title: t('public.pickup.cancelConfirm.title'),
      description: t('public.pickup.cancelConfirm.text'),
      confirmLabel: t('public.pickup.cancelConfirm.confirm'),
      cancelLabel: t('public.pickup.cancelConfirm.keep'),
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await cancelM.mutate(code);
      toast.success(t('public.pickup.cancelledToast'));
    } catch {
      toast.error(t('public.pickup.failed'));
    }
  }

  return (
    <section
      data-f="orders-pickup-public"
      aria-labelledby="pickup-title"
      className={cn('rounded-2xl border bg-surface p-4 sm:p-6', picking ? 'border-primary shadow-sm' : 'border-border')}
    >
      {booking && !changing ? (
        <div role="status" className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
            <CalendarCheck aria-hidden className="size-5" />
          </span>
          <div className="min-w-0">
            <h2 id="pickup-title" className="text-[1.0625rem] font-bold text-fg">
              {t('public.pickup.booked', { day: fmt.relativeDayInline(booking.start), time: fmt.time(booking.start) })}
            </h2>
            <p className="mt-0.5 text-base text-muted">{t(pickup.enabled ? 'public.pickup.bookedHint' : 'public.pickup.bookedPhoneHint')}</p>
          </div>
        </div>
      ) : (
        <>
          <h2 id="pickup-title" className="flex items-center gap-2 text-[1.0625rem] font-bold text-fg">
            <CalendarClock aria-hidden className="size-5 text-primary-text" />
            {t('public.pickup.title')}
          </h2>
          <p className="mt-1 text-base text-muted">{t('public.pickup.intro')}</p>
        </>
      )}

      {picking && <PickupPicker code={code} current={booking?.start ?? null} onDone={() => setChanging(false)} onStale={onStale} dayText={fmt.relativeDayInline} />}

      {booking && !changing && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {pickup.enabled && (
            <Button variant="secondary" fullWidth leftIcon={<CalendarClock aria-hidden />} onClick={() => setChanging(true)}>
              {t('public.pickup.change')}
            </Button>
          )}
          <Button variant="ghost" fullWidth leftIcon={<CalendarX aria-hidden />} loading={cancelM.isPending} onClick={() => void cancel()}>
            {t('public.pickup.cancel')}
          </Button>
        </div>
      )}
      {booking && changing && (
        <Button variant="ghost" fullWidth className="mt-3" onClick={() => setChanging(false)}>
          {t('public.pickup.keep')}
        </Button>
      )}
    </section>
  );
}
