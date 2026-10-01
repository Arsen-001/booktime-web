'use client';

/**
 * ⭐ «Итоги дня» и «Закрыть день» (владелец, 01.10.2026 — пункт 7): итог дня в журнале поверх кассовой смены финансов
 * (смена и Z-отчёт не пересобираются): визиты, «не пришёл», отмены, выручка, деньги кассы по способам оплаты, наличные
 * в ящике против учёта и закрытие смены. Открыть можно на любой день — итог закрытого дня видит владелец.
 * Право journal.stats (как сводка дня в шапке); блок смены — finance.shift / finance.edit / finance.view.
 */
import type { ReactNode } from 'react';
import { ClipboardX } from 'lucide-react';
import type { ISODate, Id, Service, Staff } from '@/domain/core';
import { getDayClose, workdayKeys, type WorkdayItem } from '@/api/journal-workday';
import { useApiQuery } from '@/api/request';
import { useTodayYerevan } from '@/areas/journal/lib/lateness';
import { useCan } from '@/demo/hooks';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';
import { Accordion } from '@/ui/Accordion';
import { Button } from '@/ui/Button';
import { ErrorState } from '@/ui/ErrorState';
import { Sheet } from '@/ui/Sheet';
import { SkeletonText } from '@/ui/Skeleton';
import { DayCloseShift } from './DayCloseShift';
import { openWorkdaySheet } from './events';
import { WorkdayRow } from './WorkdayRow';

export function DayCloseSheet({
  open,
  onOpenChange,
  businessId,
  date,
  staff,
  services,
  onOpenBooking,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessId: Id;
  date: ISODate;
  staff: Staff[];
  services: Service[];
  onOpenBooking: (id: Id, date: ISODate) => void;
}) {
  const t = useT('journal');
  const format = useFormat();
  const today = useTodayYerevan();
  const canShiftRight = useCan('finance.shift');
  const canFinanceEdit = useCan('finance.edit');
  const canFinanceView = useCan('finance.view');
  const q = useApiQuery(workdayKeys.dayClose(businessId, date), () => getDayClose(businessId, date), { enabled: open && Boolean(businessId) });
  const s = q.data;
  const money = (v?: number) => (v === undefined ? undefined : format.money(v));
  const list = (items: WorkdayItem[]) => (
    <ul className="flex flex-col divide-y divide-border">
      {items.map((i) => (
        <WorkdayRow
          key={i.bookingId}
          start={i.start}
          staffId={i.staffId}
          serviceIds={i.serviceIds}
          clientName={i.clientName}
          staff={staff}
          services={services}
          onOpen={() => onOpenBooking(i.bookingId, i.start.slice(0, 10))}
        />
      ))}
    </ul>
  );
  const lists = s
    ? [
        ...(s.noShows.length ? [{ id: 'noShow', title: t('workday.dayClose.noShowList', { n: s.noShows.length }), content: list(s.noShows) }] : []),
        ...(s.cancellations.length ? [{ id: 'cancelled', title: t('workday.dayClose.cancelList', { n: s.cancellations.length }), content: list(s.cancellations) }] : []),
      ]
    : [];

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={date === today ? t('workday.dayClose.title') : t('workday.dayClose.titleDate', { date: format.date(date, 'long') })}
      description={t('workday.dayClose.subtitle')}
      size="md"
    >
      <div data-f="F-01-011" className="flex flex-col gap-6 pb-2">
        {q.isError ? (
          <ErrorState onRetry={() => q.refetch()} />
        ) : (
          <>
            {s && s.counts.unclosed > 0 && (
              <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-warning/40 bg-warning-soft p-4">
                <ClipboardX aria-hidden className="size-5 shrink-0 text-warning" />
                <p className="min-w-0 flex-1 text-sm font-semibold text-fg">{t('workday.dayClose.unclosedWarn', { n: s.counts.unclosed })}</p>
                <Button size="sm" variant="secondary" onClick={() => openWorkdaySheet('unclosed')}>
                  {t('workday.unclosed.cardAction')}
                </Button>
              </section>
            )}

            <Block title={t('workday.dayClose.visits')}>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Tile label={t('workday.dayClose.bookings')} value={s && String(s.counts.bookings)} />
                <Tile label={t('workday.dayClose.arrived')} value={s && String(s.counts.arrived)} />
                <Tile label={t('workday.dayClose.noShow')} value={s && String(s.counts.noShow)} tone={s?.counts.noShow ? 'text-danger' : undefined} />
                <Tile label={t('workday.dayClose.cancelled')} value={s && String(s.counts.cancelled)} />
              </div>
              {lists.length > 0 && <Accordion multiple items={lists} />}
            </Block>

            <Block title={t('workday.dayClose.revenue')}>
              <Line label={t('workday.dayClose.done')} value={money(s?.revenue.done)} strong />
              <Line label={t('workday.dayClose.booked')} value={money(s?.revenue.booked)} />
            </Block>

            <Block title={t('workday.dayClose.money')}>
              <Line label={t('workday.dayClose.cash')} value={money(s?.money.cash)} />
              <Line label={t('workday.dayClose.card')} value={money(s?.money.card)} />
              {(s?.money.transfer ?? 0) > 0 && <Line label={t('workday.dayClose.transfer')} value={money(s?.money.transfer)} />}
              {(s?.money.other ?? 0) > 0 && <Line label={t('workday.dayClose.other')} value={money(s?.money.other)} />}
              <Line label={t('workday.dayClose.totalIn')} value={money(s?.money.totalIn)} strong border />
              {(s?.money.refunds ?? 0) > 0 && <Line label={t('workday.dayClose.refunds')} value={s ? `−${format.money(s.money.refunds)}` : undefined} />}
              {(s?.money.expense ?? 0) > 0 && <Line label={t('workday.dayClose.expense')} value={s ? `−${format.money(s.money.expense)}` : undefined} />}
            </Block>

            {(canShiftRight || canFinanceEdit || canFinanceView) && <DayCloseShift businessId={businessId} date={date} today={today} staff={staff} />}
          </>
        )}
      </div>
    </Sheet>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h3 className="text-sm font-bold text-fg">{title}</h3>
      {children}
    </section>
  );
}

function Tile({ label, value, tone }: { label: string; value?: string | false; tone?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-xl bg-surface-2 px-3 py-2.5">
      <span className="truncate text-xs text-muted">{label}</span>
      <b className={cn('text-lg font-bold tabular-nums', tone ?? 'text-fg')}>{value || <SkeletonText width="3ch" />}</b>
    </div>
  );
}

function Line({ label, value, strong, border }: { label: string; value?: string; strong?: boolean; border?: boolean }) {
  return (
    <div className={cn('flex items-baseline justify-between gap-3 text-sm', strong && 'font-semibold', border && 'border-t border-border pt-2')}>
      <span className={strong ? 'text-fg' : 'text-muted'}>{label}</span>
      <span className="text-fg tabular-nums">{value ?? <SkeletonText width="9ch" />}</span>
    </div>
  );
}
