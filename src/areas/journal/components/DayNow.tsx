'use client';

/**
 * ⭐ Строка «Сейчас» над журналом (29.09.2026, контроль рабочего дня): только сегодня — «идёт 4 · опаздывает 1 ·
 * через 30 мин 3». «Идёт» и «скоро» раскрывают список записей (клик — окно записи), «опаздывает» — панель
 * «Требует внимания», где у опоздавших свои кнопки. Считается из данных дня, пересчёт раз в полминуты.
 */
import { TimeText } from "@/areas/journal/components/TimeText";
import { useLocale } from 'next-intl';
import type { Booking, BookingStatus, Client, Id, ISODate, Service, Staff } from '@/domain/core';
import { useT } from '@/i18n/useT';
import { useFormat } from '@/i18n/useFormat';
import { cn } from '@/lib/cn';
import { pickText } from '@/lib/text';
import { startMinutes } from '@/areas/journal/lib/board';
import { shortClientName } from '@/areas/journal/lib/clientName';
import { lateMinutes, useNowMinuteYerevan } from '@/areas/journal/lib/lateness';
import { useJournalHourFormat } from '@/areas/journal/lib/useJournalHourFormat';
import { canFinishEarly, canStartNow, useVisitTiming } from '@/areas/journal/lib/visitTiming';
import { Button } from '@/ui/Button';
import { Popover } from '@/ui/Popover';

/** «Скоро» — начнутся в ближайшие столько минут */
export const SOON_MIN = 30;
const EXPECTED: BookingStatus[] = ['scheduled', 'client_confirmed'];

export interface DayNowProps {
  date: ISODate;
  bookings: Booking[];
  clientsById: Record<Id, Client>;
  staff: Staff[];
  services: Service[];
  onOpenBooking: (id: Id) => void;
  onOpenAttention: () => void;
  className?: string;
}

export function DayNow({ date, bookings, clientsById, staff, services, onOpenBooking, onOpenAttention, className }: DayNowProps) {
  const t = useT('journal');
  const format = useFormat({ hourCycle: useJournalHourFormat() });
  const locale = useLocale();
  const now = useNowMinuteYerevan(date);
  const timing = useVisitTiming();
  if (now === null) return null;

  const live = bookings.filter((b) => !b.deletedAt && !b.groupEventId);
  const inProgress = live
    .filter((b) => b.status === 'arrived' && startMinutes(b) <= now && now < startMinutes(b) + b.durationMin)
    .sort((a, b) => a.start.localeCompare(b.start));
  const late = live.filter((b) => lateMinutes(b, now) !== null);
  const soon = live
    .filter((b) => EXPECTED.includes(b.status) && startMinutes(b) > now && startMinutes(b) <= now + SOON_MIN)
    .sort((a, b) => a.start.localeCompare(b.start));
  if (!inProgress.length && !late.length && !soon.length) return null;

  const name = (b: Booking) => {
    const c = b.clientId ? clientsById[b.clientId] : undefined;
    return (c?.name ? shortClientName(c.name) : undefined) || b.visitorName || t('block.noClient');
  };
  const master = (b: Booking) => staff.find((s) => s.id === b.staffId)?.name.split(' ')[0] ?? '';
  const service = (b: Booking) => {
    const s = services.find((x) => x.id === b.services[0]?.serviceId);
    return s ? pickText(s.name, locale) : '';
  };

  const segment = (kind: 'inProgress' | 'soon', list: Booking[], label: string, title: string) => (
    <Popover
      align="start"
      label={title}
      trigger={(p) => (
        <button
          {...p}
          type="button"
          className="-mx-1 rounded-md px-1 whitespace-nowrap text-fg transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-focus"
        >
          {label}
        </button>
      )}
      className="w-80 p-1.5"
    >
      {({ close }) => (
        <ul className="flex max-h-80 flex-col overflow-y-auto">
          {list.map((b) => (
            <li key={b.id} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  close();
                  onOpenBooking(b.id);
                }}
                className="flex min-w-0 flex-1 items-baseline gap-3 rounded-lg px-2 py-2 text-left text-[13px] hover:bg-surface-2"
              >
                <b className="min-w-11 shrink-0 font-bold text-fg tabular-nums"><TimeText value={format.time(b.start)} suffixClassName="text-[10px]" /></b>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-semibold text-fg">{name(b)}</span>
                  <span className="truncate text-xs text-muted">{[service(b), master(b)].filter(Boolean).join(' · ')}</span>
                </span>
              </button>
              {kind === 'inProgress' && canFinishEarly(b, now) && (
                <Button size="sm" variant="ghost" className="shrink-0" onClick={() => void timing.finishNow(b).then((ok) => ok && close())}>
                  {t('board.timing.finishEarly')}
                </Button>
              )}
              {kind === 'soon' && canStartNow(b, now) && (
                <Button size="sm" variant="ghost" className="shrink-0" onClick={() => void timing.startNow(b).then((ok) => ok && close())}>
                  {t('board.timing.startNowShort')}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Popover>
  );

  return (
    <p aria-label={t('board.nowStrip.label')} className={cn('flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted', className)}>
      <span className="inline-flex items-center gap-1.5 font-semibold text-fg">
        <span aria-hidden className="size-2 animate-pulse rounded-full bg-danger motion-reduce:animate-none" />
        {t('board.nowStrip.title')}
      </span>
      {inProgress.length > 0 && segment('inProgress', inProgress, t('board.nowStrip.inProgress', { n: inProgress.length }), t('board.nowStrip.inProgressTitle'))}
      {late.length > 0 && (
        <button
          type="button"
          onClick={onOpenAttention}
          className="-mx-1 rounded-md px-1 font-semibold whitespace-nowrap text-danger transition-colors hover:bg-danger-soft focus-visible:outline-2 focus-visible:outline-focus"
        >
          {t('board.nowStrip.late', { n: late.length })}
        </button>
      )}
      {soon.length > 0 && segment('soon', soon, t('board.nowStrip.soon', { n: soon.length, min: SOON_MIN }), t('board.nowStrip.soonTitle', { min: SOON_MIN }))}
    </p>
  );
}
