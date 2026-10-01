'use client';

/**
 * Вид дня «Обзор» (⭐ наше, 29.09.2026): все мастера узкими колонками, весь рабочий день по высоте экрана — видно
 * загрузку салона разом, без прокрутки. Записи — полосы цвета услуги, подробности — при наведении, клик — окно записи;
 * клик по пустому месту — новая запись на это время. Масштаб подбирается под экран (один ResizeObserver на вид).
 */
import { TimeText } from '@/areas/journal/components/TimeText';
import { useLocale } from 'next-intl';
import { useLayoutEffect, useMemo, useState } from 'react';
import { isActiveBooking, startMinutes, staffLoad } from '@/areas/journal/lib/board';
import { shortClientName } from '@/areas/journal/lib/clientName';
import { computeDayRange, hourTicks, hoursToBands } from '@/areas/journal/lib/grid';
import { useJournalBlockRights } from '@/areas/journal/lib/rights';
import { useJournalHourFormat } from '@/areas/journal/lib/useJournalHourFormat';
import { STAFF_BAR, snapTime, useBookingPeek, useColumnLabel, useNowMinute, withoutParticipants, type DayViewProps } from '@/areas/journal/components/DayViewParts';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';
import { fromMinutes, today } from '@/lib/date';
import { pickText } from '@/lib/text';
import { Avatar } from '@/ui/Avatar';
import { Tooltip } from '@/ui/Tooltip';

const GUTTER = 44;
const HEAD_H = 76;
/** Шапка со строкой выручки мастера — когда колонка достаточно широкая, чтобы «145 000 ֏» читалось целиком */
const HEAD_H_MONEY = 90;
const MONEY_COL_MIN = 60;
/** Колонка не уже — иначе полоса записи перестаёт читаться; не влезли — вид листается вбок */
const COL_MIN = 44;
/** Минимум px на минуту — 10 часов ≈ 300px; ниже экран — день листается вниз */
const MIN_PPM = 0.5;

export function DayOverview({
  date,
  columns,
  bookingsByColumn,
  clientsById,
  services,
  toneOf,
  showPhones,
  canCreate,
  onCreate,
  onOpen,
  slotGaps,
  slotDurationMin = 0,
  onPickSlot,
  groupEventsByColumn = {},
  participantCountByEvent = {},
  onOpenGroupEvent,
  className,
}: DayViewProps) {
  const t = useT('journal');
  const locale = useLocale();
  const format = useFormat({ hourCycle: useJournalHourFormat() });
  const label = useColumnLabel();
  const peek = useBookingPeek({ date, clientsById, services, showPhones });
  const nowMin = useNowMinute(date === today());

  const [scroller, setScroller] = useState<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const height = size.h;
  useLayoutEffect(() => {
    if (!scroller) return;
    const ro = new ResizeObserver(() => setSize({ w: scroller.clientWidth, h: scroller.clientHeight }));
    ro.observe(scroller);
    return () => ro.disconnect();
  }, [scroller]);

  const layout = useMemo(() => {
    // Диапазон — и по записям, и по групповым занятиям: занятие в 19:00 не должно оказаться за краем шкалы
    const all = [...Object.values(bookingsByColumn).flat(), ...Object.values(groupEventsByColumn).flat()];
    const range = computeDayRange(
      columns.map((c) => (c.kind === 'staff' ? c.hours : [])),
      all.map((b) => ({ from: startMinutes(b), to: startMinutes(b) + b.durationMin })),
    );
    const cols = columns.map((column) => {
      const bookings = withoutParticipants(bookingsByColumn[column.id] ?? [], groupEventsByColumn[column.id]);
      return {
        column,
        bookings,
        bands: column.kind === 'staff' ? hoursToBands(column.hours, range).filter((b) => !b.working) : [],
        load: column.kind === 'staff' ? staffLoad(column.hours, bookings) : { count: bookings.length, ratio: 0 },
        // Выручка мастера за день — как в итогах дня: все активные записи колонки
        revenue: (bookingsByColumn[column.id] ?? []).filter(isActiveBooking).reduce((sum, b) => sum + b.total, 0),
      };
    });
    return { range, ticks: hourTicks(range), cols };
  }, [columns, bookingsByColumn, groupEventsByColumn]);

  const { range, ticks, cols } = layout;
  // Строка выручки в шапке — только если колонки широкие; иначе сумма в подсказке по наведению на шапку
  // F-01-178 «Показывать статистику»: без права — без выручки мастера в шапке колонки (journal-perms.md)
  const { showStatistics } = useJournalBlockRights();
  const showMoney = showStatistics && size.w > 0 && (size.w - GUTTER) / Math.max(1, cols.length) >= MONEY_COL_MIN;
  const headH = showMoney ? HEAD_H_MONEY : HEAD_H;
  const spanMin = Math.max(60, range.endMin - range.startMin);
  const ppm = Math.max(MIN_PPM, (height - headH - 8) / spanMin);
  const bodyH = spanMin * ppm;
  const y = (m: number) => (m - range.startMin) * ppm;
  const hourLabel = (m: number) => format.time(`${date}T${String(Math.floor(m / 60)).padStart(2, '0')}:00`);
  // Подписи часов — не чаще, чем помещаются (при мелком масштабе через час)
  const labelEvery = 60 * ppm < 22 ? 2 : 1;
  const showNow = nowMin !== null && nowMin >= range.startMin && nowMin <= range.endMin;

  return (
    <div className={cn('relative flex min-h-0 flex-col', className)}>
      <div
        ref={setScroller}
        data-f="F-01-018 F-01-022 F-01-023"
        aria-label={t('board.layout.overview')}
        className="scrollbar-thin min-h-0 flex-1 overflow-auto overscroll-contain rounded-2xl border border-border bg-surface pb-24 md:pb-0"
      >
        <div className="flex min-w-fit flex-col">
          {/* Шапки колонок — прилипают сверху */}
          <div className="sticky top-0 z-30 flex border-b border-border bg-surface" style={{ height: headH }}>
            <div className="sticky left-0 z-10 shrink-0 bg-surface" style={{ width: GUTTER }} />
            {cols.map(({ column, load, revenue }) => {
              const name = label(column);
              const count = t('board.column.bookings', { n: load.count });
              const money = format.money(revenue);
              return (
                <Tooltip
                  key={column.id}
                  side="bottom"
                  classNames={{ anchor: 'flex flex-1 border-l border-line' }}
                  content={
                    <span className="flex flex-col">
                      <b className="font-semibold">{name.name}</b>
                      <span className="tabular-nums">
                        {count} · {money}
                      </span>
                    </span>
                  }
                >
                  <div className="flex w-full flex-col items-center justify-center gap-1 px-1" style={{ minWidth: COL_MIN }}>
                    {column.kind === 'staff' ? (
                      <Avatar name={column.staff.name} src={column.staff.avatarUrl} colorIndex={column.staff.colorIndex} size="xs" />
                    ) : null}
                    <span className="max-w-full truncate text-xs font-semibold text-fg">{name.short}</span>
                    <span className="flex w-full max-w-10 items-center gap-1">
                      <span aria-hidden className="relative h-1 flex-1 overflow-hidden rounded-full bg-surface-3">
                        <span
                          className={cn(
                            'absolute inset-y-0 left-0 rounded-full',
                            column.kind === 'staff' ? (STAFF_BAR[column.staff.colorIndex] ?? 'bg-primary') : 'bg-primary',
                          )}
                          style={{ width: `${Math.round(load.ratio * 100)}%` }}
                        />
                      </span>
                      <span
                        className={cn('text-[11px] tabular-nums', column.kind === 'staff' && column.off ? 'text-warning' : 'text-muted')}
                        aria-label={count}
                      >
                        {load.count}
                      </span>
                    </span>
                    {showMoney && (
                      <span
                        className={cn('max-w-full truncate text-[11px] leading-none font-semibold tabular-nums', revenue > 0 ? 'text-fg' : 'text-muted')}
                        aria-label={t('board.column.revenue', { sum: money })}
                      >
                        {money}
                      </span>
                    )}
                  </div>
                </Tooltip>
              );
            })}
          </div>

          <div className="relative flex" style={{ height: bodyH }}>
            <div className="sticky left-0 z-20 shrink-0 bg-surface" style={{ width: GUTTER }}>
              {ticks.slice(1, -1).map((m, i) =>
                (i + 1) % labelEvery === 0 ? (
                  <span key={m} style={{ top: y(m) }} className="absolute right-1.5 -translate-y-1/2 text-[10px] text-muted tabular-nums select-none">
                    <TimeText value={hourLabel(m)} suffixClassName="text-[10px]" hourOnly />
                  </span>
                ) : null,
              )}
              {showNow && (
                <span
                  style={{ top: y(nowMin) }}
                  className="absolute left-0.5 z-10 -translate-y-1/2 rounded bg-danger px-1 text-[10px] leading-4 font-bold text-primary-contrast tabular-nums"
                >
                  {format.time(`${date}T${fromMinutes(nowMin)}`)}
                </span>
              )}
            </div>

            {cols.map(({ column, bookings, bands }) => (
              <div
                key={column.id}
                className={cn('relative flex-1 border-l border-line', canCreate && 'cursor-cell')}
                style={{ minWidth: COL_MIN }}
                onClick={(e) => {
                  if (!canCreate) return;
                  const at = range.startMin + (e.clientY - e.currentTarget.getBoundingClientRect().top) / ppm;
                  onCreate(column.id, snapTime(at - 7, range.startMin, range.endMin - 15));
                }}
              >
                {bands.map((b) => (
                  <div key={`${b.from}-${b.to}`} style={{ top: y(b.from), height: (b.to - b.from) * ppm }} className="pointer-events-none absolute inset-x-0 bg-surface-2/60" />
                ))}
                {ticks.slice(1, -1).map((m) => (
                  <div key={m} style={{ top: y(m) }} className="pointer-events-none absolute inset-x-0 border-t border-line" />
                ))}
                {(slotGaps?.[column.id] ?? []).map((g) => {
                  const from = format.time(`${date}T${fromMinutes(g.from)}`);
                  const to = format.time(`${date}T${fromMinutes(g.to)}`);
                  return (
                    <button
                      key={`slot-${g.from}`}
                      type="button"
                      aria-label={t('board.findSlot.gap', { from, to })}
                      title={t('board.findSlot.gap', { from, to })}
                      style={{ top: y(g.from) + 1, height: (g.to - g.from) * ppm - 2 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        const at = g.from + (e.clientY - e.currentTarget.getBoundingClientRect().top) / ppm;
                        onPickSlot?.(column.id, snapTime(Math.floor(at / 15) * 15, g.from, g.to - slotDurationMin));
                      }}
                      className="absolute inset-x-0.5 z-[1] animate-fade-in rounded-md border-2 border-dashed border-primary/50 bg-primary-soft/70 transition-colors hover:border-primary hover:bg-primary-soft"
                    />
                  );
                })}
                {(groupEventsByColumn[column.id] ?? []).map((ev) => {
                  const service = services.find((s) => s.id === ev.serviceId);
                  const title = `${service ? pickText(service.name, locale) : t('board.layout.groupEvent')} · ${participantCountByEvent[ev.id] ?? 0}/${ev.capacity}`;
                  return (
                    <button
                      key={ev.id}
                      type="button"
                      title={title}
                      aria-label={title}
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenGroupEvent?.(ev.id);
                      }}
                      style={{ top: y(startMinutes(ev)), height: Math.max(4, ev.durationMin * ppm - 1) }}
                      className="absolute inset-x-0.5 z-[2] overflow-hidden rounded-[5px] border border-dashed border-border-strong bg-surface-2 px-1 pt-0.5 text-left text-[10px] leading-3 font-bold text-fg tabular-nums hover:bg-surface-3"
                    >
                      {ev.durationMin * ppm >= 18 ? `${participantCountByEvent[ev.id] ?? 0}/${ev.capacity}` : null}
                    </button>
                  );
                })}
                {bookings.map((b) => {
                  const from = startMinutes(b);
                  const h = b.durationMin * ppm - 1;
                  const tone = toneOf(b);
                  const client = b.clientId ? clientsById[b.clientId] : undefined;
                  const who = client ? shortClientName(client.name) : (b.visitorName ?? t('board.list.noClient'));
                  return (
                    <button
                      key={b.id}
                      type="button"
                      data-booking={b.id}
                      {...peek.bind(b)}
                      aria-label={`${format.time(b.start)} ${who}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        peek.hide();
                        onOpen(b.id);
                      }}
                      style={{ top: y(from), height: Math.max(4, h), background: tone.fill, color: tone.ink, boxShadow: `inset 0 3px 0 ${tone.drop}` }}
                      className={cn(
                        'absolute inset-x-0.5 z-[3] overflow-hidden rounded-[5px] px-1 pt-1 text-left text-[10px] leading-3 font-bold tabular-nums transition-[filter] hover:brightness-95 focus-visible:outline-2 focus-visible:outline-focus',
                        b.status === 'awaiting_confirmation' && 'outline-2 -outline-offset-2 outline-warning outline-dashed',
                        b.status === 'no_show' && 'opacity-60',
                      )}
                    >
                      {h >= 18 ? format.time(b.start) : null}
                    </button>
                  );
                })}
                {showNow && <div style={{ top: y(nowMin) }} className="pointer-events-none absolute inset-x-0 z-[4] h-0.5 -translate-y-1/2 bg-danger" />}
              </div>
            ))}
          </div>
        </div>
      </div>
      {peek.card}
    </div>
  );
}
