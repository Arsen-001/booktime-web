'use client';

/**
 * ⭐ «Свободно сегодня» (30.09.2026, контроль рабочего дня; F-00-101/F-00-103): все пустоты мастеров от 30 минут до
 * конца дня — «Свободно 6 ч 30 мин у 4 мастеров» — и одно предложение сразу на всё: листу ожидания, тем, кто просил
 * «сообщить об окне», и подписчикам как горящее окно (то же подтверждение, что в «Найти окно», SlotOfferConfirm).
 * У окна своя услуга: услуги мастера, которые помещаются в пустоту, — лист ожидания сверяет именно услугу.
 * Открывается из «Требует внимания» и из тоста «Освободилось … · Предложить окно» (OFFER_GAP_EVENT).
 */
import { useState } from 'react';
import type { Booking, DayHours, Id, ISODate, Service, Staff } from '@/domain/core';
import type { SlotOfferTarget } from '@/api/journal-offers';
import { SlotOfferConfirm } from '@/areas/journal/components/SlotOfferConfirm';
import { freeGaps } from '@/areas/journal/lib/board';
import { useNowMinuteYerevan } from '@/areas/journal/lib/lateness';
import { useJournalHourFormat } from '@/areas/journal/lib/useJournalHourFormat';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { fromMinutes, nowYerevan, today } from '@/lib/date';
import { Checkbox } from '@/ui/Checkbox';
import { EmptyState } from '@/ui/EmptyState';
import { Sheet } from '@/ui/Sheet';

/** Пустоты короче этого не предлагаем — никакая услуга не влезет */
const MIN_GAP = 30;
/** Не больше стольких услуг на одно окно: лист ожидания сверяет услугу, но сообщение человеку — одно */
const SERVICES_PER_GAP = 4;

export interface FreeGap {
  staff: Staff;
  from: number;
  to: number;
}

/** Пустоты сегодня от «сейчас» (с ближайшей четверти часа) — одна функция для панели (сумма) и шторки (список) */
export function todayGaps(
  date: ISODate,
  staff: Staff[],
  hoursByStaff: Record<Id, DayHours>,
  bookings: Booking[],
  /** Минуты «сейчас» из тикающего хука (useNowMinuteYerevan) — чтобы React Compiler пересчитывал сумму со временем */
  nowMinute?: number | null,
): FreeGap[] {
  if (date !== today()) return [];
  const n = nowYerevan();
  const nowMin = Math.ceil((nowMinute ?? n.hour() * 60 + n.minute()) / 15) * 15;
  return staff.flatMap((s) =>
    freeGaps(hoursByStaff[s.id] ?? [], bookings.filter((b) => b.staffId === s.id), MIN_GAP, nowMin).map((g) => ({ staff: s, from: g.from, to: g.to })),
  );
}

export function FreeTodaySheet({
  open,
  onOpenChange,
  businessId,
  date,
  staff,
  hoursByStaff,
  bookings,
  services,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessId: Id;
  date: ISODate;
  staff: Staff[];
  hoursByStaff: Record<Id, DayHours>;
  /** Записи сегодняшнего дня; нет — журнал открыт на другом дне, часы и записи сегодня неизвестны */
  bookings: Booking[] | undefined;
  services: Service[];
}) {
  const t = useT('journal');
  const format = useFormat({ hourCycle: useJournalHourFormat() });
  const nowMinute = useNowMinuteYerevan(date);
  const gaps = open && bookings ? todayGaps(date, staff, hoursByStaff, bookings, nowMinute) : [];
  // Выбор — по мастеру: у салона на 15 мастеров десятки пустот, строка на мастера читается, строка на пустоту — нет
  const [off, setOff] = useState<Id[]>([]);
  const chosen = gaps.filter((g) => !off.includes(g.staff.id));
  const byStaff = [...new Map(gaps.map((g) => [g.staff.id, g.staff])).values()].map((st) => {
    const own = gaps.filter((g) => g.staff.id === st.id);
    return { staff: st, gaps: own, minutes: own.reduce((sum, g) => sum + (g.to - g.from), 0) };
  });
  const totalMin = gaps.reduce((sum, g) => sum + (g.to - g.from), 0);
  const masters = new Set(gaps.map((g) => g.staff.id)).size;
  const time = (m: number) => format.time(`${date}T${fromMinutes(m)}`);

  // У окна — услуги мастера, которые помещаются в пустоту (короткие первыми)
  const targets: SlotOfferTarget[] = chosen.flatMap((g) =>
    services
      .filter((sv) => (sv.staffIds.includes(g.staff.id) || g.staff.serviceIds.includes(sv.id)) && sv.durationMin <= g.to - g.from)
      .sort((a, b) => a.durationMin - b.durationMin)
      .slice(0, SERVICES_PER_GAP)
      .map((sv) => ({ businessId, staffId: g.staff.id, serviceId: sv.id, date, time: fromMinutes(g.from), freeMin: g.to - g.from })),
  );

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        if (!v) setOff([]);
        onOpenChange(v);
      }}
      title={t('board.freeToday.title')}
      description={gaps.length ? t('board.freeToday.subtitle', { time: durationText(totalMin, t), n: masters }) : undefined}
      size="md"
    >
      <div data-f="F-00-101 F-00-103" className="flex flex-col gap-4">
        {gaps.length === 0 ? (
          <EmptyState compact title={bookings ? t('board.freeToday.empty') : t('board.freeToday.openToday')} />
        ) : (
          <>
            <ul className="flex flex-col gap-2">
              {byStaff.map((row) => (
                <li key={row.staff.id}>
                  <Checkbox
                    checked={!off.includes(row.staff.id)}
                    onCheckedChange={(v) => setOff((prev) => (v ? prev.filter((x) => x !== row.staff.id) : [...prev, row.staff.id]))}
                    label={`${row.staff.name} · ${durationText(row.minutes, t)}`}
                    description={row.gaps.map((g) => `${time(g.from)}–${time(g.to)}`).join(', ')}
                  />
                </li>
              ))}
            </ul>
            <div className="border-t border-border pt-4">
              {targets.length ? (
                <SlotOfferConfirm
                  key={targets.map((x) => `${x.staffId}${x.time}`).join()}
                  businessId={businessId}
                  date={date}
                  serviceId=""
                  serviceName=""
                  slots={[]}
                  staffById={new Map(staff.map((s) => [s.id, s]))}
                  targets={targets}
                  title={t('board.freeToday.offerTitle', { n: chosen.length })}
                  subtitle={t('board.freeToday.offerSubtitle')}
                  hideBack
                  onBack={() => onOpenChange(false)}
                  onSent={() => onOpenChange(false)}
                />
              ) : (
                <p className="text-sm text-muted">{t('board.freeToday.pickSome')}</p>
              )}
            </div>
          </>
        )}
      </div>
    </Sheet>
  );
}

/** «2 ч 30 мин» / «45 мин» */
export function durationText(min: number, t: ReturnType<typeof useT<'journal'>>): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return t('board.freeToday.minutes', { m });
  return m ? t('board.freeToday.hoursMinutes', { h, m }) : t('board.freeToday.hours', { h });
}
