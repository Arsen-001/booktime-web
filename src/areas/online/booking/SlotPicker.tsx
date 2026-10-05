'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { CalendarClock } from 'lucide-react';
import type { PlanQuery, PlanSlot } from '@/api/online';
import { getPlanMonthAvailability, getPlanNearestDate, getPlanSlots } from '@/api/online-public';
import { prefetchApiQuery, useApiQuery } from '@/api/request';
import { planKey } from '@/areas/online/booking/wizard/plan';
import type { ISODate } from '@/domain/core';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { addDays, parse, toISODate, today } from '@/lib/date';
import { Button } from '@/ui/Button';
import { Calendar } from '@/ui/Calendar';
import { ErrorState } from '@/ui/ErrorState';
import { Skeleton } from '@/ui/Skeleton';
import { SlotButton } from '@/ui/SlotButton';

const monthOf = (d: ISODate) => `${d.slice(0, 7)}-01`;
/** Пустой план — только чтобы не писать `plan!` в функциях запросов (выключены, пока плана нет) */
const NO_PLAN: PlanQuery = { businessId: '', legs: [] };
const nextMonth = (m: ISODate) => toISODate(parse(m).add(1, 'month'));

/**
 * Выбор дня и времени — один и тот же экран у записи и у переноса (О19). Правила «ничего не мигает»:
 *  - отметки «есть время» считаются по ПОКАЗАННОМУ месяцу, следующий подгружается заранее (О11, М3);
 *  - пока отметки грузятся, дни нейтральные (без «доступно/недоступно»), потом мягко гаснут (переход opacity в Calendar);
 *  - при смене дня прежние окна сразу уходят — на их месте скелет того же размера, нажать нечего (М1);
 *  - блок окон держит высоту, кнопка «Продолжить» под ним не прыгает (М2);
 *  - без выбранного дня открываемся на ближайшем дне с окнами, над календарём — «Ближайшее: ср, 30 сент., 11:45» (О12).
 */
export function SlotPicker({
  plan,
  date: dateProp,
  onDateChange,
  selectedStart,
  onSelect,
  max,
  hourCycle,
  autoNearest = true,
  currentNote,
  emptyExtra,
}: {
  plan: PlanQuery | undefined;
  date: ISODate | undefined;
  /** replace — день подставлен сам (ближайший), а не выбран человеком */
  onDateChange: (d: ISODate, how: 'user' | 'auto') => void;
  selectedStart: string | undefined;
  onSelect: (slot: PlanSlot) => void;
  max?: ISODate;
  hourCycle?: '24' | '12';
  autoNearest?: boolean;
  /** Перенос: «Сейчас вы записаны на …» над календарём */
  currentNote?: ReactNode;
  /** Пустой день: дополнительное действие (лист ожидания) */
  emptyExtra?: (date: ISODate) => ReactNode;
}) {
  const t = useT('online');
  const format = useFormat({ hourCycle });
  const key = planKey(plan);
  const now = today();
  // М1: выбранный день показываем в тот же кадр, не дожидаясь, пока он вернётся через адрес: старые окна уходят сразу
  const [picked, setPicked] = useState<{ day: ISODate; from: ISODate | undefined } | undefined>();
  const date = picked && picked.from === dateProp ? picked.day : dateProp;
  const [shownMonth, setShownMonth] = useState<ISODate | undefined>(undefined);
  const month = shownMonth ?? monthOf(date ?? now);

  const monthKey = (m: ISODate) => ['online', 'plan-month', key, m] as const;
  const monthFetch = (m: ISODate) => () => getPlanMonthAvailability(plan ?? NO_PLAN, m);
  const availQ = useApiQuery(monthKey(month), () => getPlanMonthAvailability(plan ?? NO_PLAN, month), {
    enabled: Boolean(plan),
    keepPrevious: false,
  });
  // Следующий месяц — заранее, чтобы перелистывание не показывало «пустой» месяц (О11)
  useEffect(() => {
    if (!plan) return;
    prefetchApiQuery(monthKey(nextMonth(month)), monthFetch(nextMonth(month)));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ключ плана и месяц — всё, от чего зависит запрос
  }, [JSON.stringify(key), month]);

  const nearestQ = useApiQuery(['online', 'plan-nearest', key, now], () => getPlanNearestDate(plan ?? NO_PLAN, now), {
    enabled: Boolean(plan),
  });
  const nearest = nearestQ.data;
  // О12: день не выбран — сразу открываем ближайший с окнами (сегодня остаётся в календаре)
  useEffect(() => {
    if (!autoNearest || date || nearestQ.isLoading) return;
    onDateChange(nearest ?? now, 'auto');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- срабатывает, когда пришёл ответ «ближайший день»
  }, [nearest, nearestQ.isLoading, date]);

  const slotsQ = useApiQuery(['online', 'plan-slots', key, date ?? ''], () => getPlanSlots(plan ?? NO_PLAN, date ?? now), {
    enabled: Boolean(plan && date),
    keepPrevious: false,
  });
  // Первое окно ближайшего дня — тот же ключ, что у списка окон этого дня (кэш общий)
  const nearestSlotsQ = useApiQuery(['online', 'plan-slots', key, nearest ?? ''], () => getPlanSlots(plan ?? NO_PLAN, nearest ?? now), {
    enabled: Boolean(plan && nearest),
    keepPrevious: false,
  });
  const firstNearest = nearestSlotsQ.data?.[0];

  const slots = slotsQ.data ?? [];
  const dayEmpty = Boolean(date) && !slotsQ.isLoading && !slotsQ.isError && slots.length === 0;
  const afterQ = useApiQuery(['online', 'plan-nearest', key, date ? addDays(date, 1) : ''], () => getPlanNearestDate(plan ?? NO_PLAN, addDays(date ?? now, 1)), {
    enabled: Boolean(plan && dayEmpty),
  });

  const hour = (s: PlanSlot) => Number(s.start.slice(11, 13));
  const groups = [
    { key: 'morning', label: t('booking.timeStep.morning'), slots: slots.filter((s) => hour(s) < 12) },
    { key: 'day', label: t('booking.timeStep.day'), slots: slots.filter((s) => hour(s) >= 12 && hour(s) < 18) },
    { key: 'evening', label: t('booking.timeStep.evening'), slots: slots.filter((s) => hour(s) >= 18) },
  ].filter((g) => g.slots.length > 0);

  const pickDay = (d: ISODate) => {
    setPicked({ day: d, from: dateProp });
    setShownMonth(undefined);
    onDateChange(d, 'user');
  };

  return (
    <div className="flex flex-col gap-4" data-f="F-03-084 F-03-065 F-02-075">
      {currentNote}
      <p className="flex min-h-6 items-center gap-2 text-sm text-muted" data-f="F-03-085">
        <CalendarClock aria-hidden className="size-4 shrink-0" />
        {nearestQ.isLoading || (nearest && nearestSlotsQ.isLoading) ? (
          <Skeleton className="h-4 w-48" />
        ) : nearest && firstNearest ? (
          <span>
            {t('booking.timeStep.nearestLine', { date: format.date(nearest, 'weekday'), time: format.time(firstNearest.start) })}
          </span>
        ) : (
          <span>{t('booking.timeStep.noneAheadShort')}</span>
        )}
      </p>
      <div className="flex flex-col gap-4 md:grid md:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] md:items-start md:gap-6">
        <Calendar
          month={month}
          onMonthChange={(m) => setShownMonth(m)}
          value={date ?? null}
          onValueChange={pickDay}
          min={now}
          max={max}
          dayMeta={(d) => {
            const has = availQ.data?.[d];
            if (has === undefined) return undefined;
            return has ? { tone: 'primary', dot: true } : { disabled: d !== date };
          }}
        />

        {/* Высота держится скелетом того же размера — «Продолжить» ниже не прыгает (М2) */}
        <div className="flex min-h-52 flex-col gap-3" aria-busy={slotsQ.isLoading || !date || undefined}>
          {!date || slotsQ.isLoading ? (
            <SlotsSkeleton />
          ) : slotsQ.isError ? (
            <ErrorState onRetry={() => slotsQ.refetch()} />
          ) : slots.length === 0 ? (
            <div className="flex animate-fade-in flex-col items-center gap-2 rounded-xl border border-border bg-surface-2 p-4 text-center" data-f="F-03-085 F-02-076">
              <p className="font-medium text-fg" data-f="F-03-140">
                {t('booking.timeStep.emptyDay')}
              </p>
              {afterQ.isLoading ? (
                <Skeleton className="h-10 w-48" />
              ) : afterQ.data ? (
                // Узкая правая колонка на десктопе: длинная подпись переносится, а не вылезает за карточку
                <Button size="sm" variant="secondary" className="h-auto min-h-9 max-w-full py-1.5 whitespace-normal" onClick={() => afterQ.data && pickDay(afterQ.data)}>
                  {t('booking.timeStep.goToDate', { date: format.date(afterQ.data, 'weekday') })}
                </Button>
              ) : (
                <p className="text-sm text-muted">{t('booking.timeStep.noneAheadShort')}</p>
              )}
              {date && emptyExtra?.(date)}
            </div>
          ) : (
            <div className="flex animate-fade-in flex-col gap-3">
              {groups.map((g) => (
                <div key={g.key} className="flex flex-col gap-2">
                  <h4 className="text-sm font-medium text-muted">{g.label}</h4>
                  <div className="flex flex-wrap gap-2">
                    {g.slots.map((s) => (
                      <SlotButton key={s.start} selected={selectedStart === s.start} onClick={() => onSelect(s)}>
                        {format.time(s.start)}
                      </SlotButton>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Скелет окон: подпись группы и два ряда кнопок — того же размера, что настоящие окна */
function SlotsSkeleton() {
  return (
    <div className="flex flex-col gap-3" data-skeleton="">
      {[0, 1].map((g) => (
        <div key={g} className="flex flex-col gap-2">
          <Skeleton className="h-4 w-16" />
          <div className="flex flex-wrap gap-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} variant="rect" className="h-11 w-16 rounded-lg md:h-10" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
