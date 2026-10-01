'use client';

/**
 * Вид дня «Лента» (⭐ наше, 29.09.2026 — у Altegio большой салон листается вбок по колонкам): мастера — строками, время —
 * по горизонтали. Строки и шкала подстраиваются под экран, поэтому 15–20 мастеров и весь рабочий день видны разом.
 * Клик по пустому месту строки — новая запись на это время, по записи — окно записи, наведение — карточка записи.
 * Раскладка считается одним useMemo на данные дня; размеры — один ResizeObserver на вид.
 *
 * Перенос (F-01-110/F-01-114, право «Перенос записи»): полосу тянут мышью — вбок меняется время (шаг 15 мин), вверх-вниз
 * — мастер. Полоса едет за курсором через style.transform без React; призрак места (зелёный — свободно, красный —
 * «Занято: 14:00 Гагик А.») перерисовывается только при смене клетки и считается по уже загруженным записям дня.
 * Проверки, перенос и тост с «Отменить» — общие с «Колонками» (lib/moveBooking). На касании лента листается, как раньше.
 */
import { TimeText } from '@/areas/journal/components/TimeText';
import { useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { Booking } from '@/domain/core';
import { isActiveBooking, startMinutes, staffLoad } from '@/areas/journal/lib/board';
import { flattenDay, swallowNextClick, useMoveBooking, type MovePlan, type PlacementIssue } from '@/areas/journal/lib/moveBooking';
import { shortClientName } from '@/areas/journal/lib/clientName';
import { computeDayRange, hourTicks, hoursToBands } from '@/areas/journal/lib/grid';
import { useJournalBlockRights } from '@/areas/journal/lib/rights';
import { useJournalHourFormat } from '@/areas/journal/lib/useJournalHourFormat';
import {
  DropGhostBox,
  STAFF_BAR,
  snapTime,
  useBookingPeek,
  useColumnLabel,
  useNowMinute,
  withoutParticipants,
  type DayViewProps,
  type DropGhost,
} from '@/areas/journal/components/DayViewParts';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';
import { fromMinutes, today } from '@/lib/date';
import { pickText } from '@/lib/text';
import { useLocale } from 'next-intl';
import { Avatar } from '@/ui/Avatar';

/** Колонка имён; на телефоне уже */
const NAME_W = 200;
const NAME_W_PHONE = 116;
const AXIS_H = 32;
/** Строка мастера: подстраивается под высоту экрана в этих пределах */
const ROW_MIN = 40;
const ROW_MAX = 64;
/** Минимум px на минуту — 13 часов ≈ 780px; уже экран — лента листается вбок */
const MIN_PPM = 1.0;
/** Шаг переноса, минуты */
const MOVE_STEP = 15;
/** Сдвиг мыши до начала переноса: меньше — это клик (открыть запись) */
const DRAG_THRESHOLD = 5;

export interface DayTimelineProps extends DayViewProps {
  isPhone?: boolean;
}

export function DayTimeline({
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
  isPhone = false,
  groupEventsByColumn = {},
  participantCountByEvent = {},
  onOpenGroupEvent,
  canMove = false,
  allResources,
  className,
}: DayTimelineProps) {
  const t = useT('journal');
  const locale = useLocale();
  const format = useFormat({ hourCycle: useJournalHourFormat() });
  // F-01-178 «Показывать статистику»: без права — без выручки мастера за день (journal-perms.md)
  const { showStatistics } = useJournalBlockRights();
  const label = useColumnLabel();
  const peek = useBookingPeek({ date, clientsById, services, showPhones });
  const nowMin = useNowMinute(date === today());
  const nameW = isPhone ? NAME_W_PHONE : NAME_W;
  const mover = useMoveBooking({ date, clientsById, resources: allResources });
  const [content, setContent] = useState<HTMLDivElement | null>(null);
  const ghostApi = useRef<((g: DropGhost | null) => void) | null>(null);
  // Полосы, оставленные на новом месте до прихода данных: как только записи дня обновились — снимаем сдвиг
  const movedEls = useRef<HTMLElement[]>([]);
  useLayoutEffect(() => {
    for (const el of movedEls.current) resetBar(el);
    movedEls.current = [];
  }, [bookingsByColumn]);
  const dayBookings = useMemo(() => flattenDay(bookingsByColumn), [bookingsByColumn]);

  const [scroller, setScroller] = useState<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
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
    const rows = columns.map((column) => {
      const bookings = withoutParticipants(bookingsByColumn[column.id] ?? [], groupEventsByColumn[column.id]).sort((a, b) => a.start.localeCompare(b.start));
      return {
        column,
        bookings,
        bands: column.kind === 'staff' ? hoursToBands(column.hours, range).filter((b) => !b.working) : [],
        load: column.kind === 'staff' ? staffLoad(column.hours, bookings) : { count: bookings.length, ratio: 0 },
        // Выручка мастера за день — как в итогах дня: все активные записи колонки (и участники занятий тоже)
        revenue: (bookingsByColumn[column.id] ?? []).filter(isActiveBooking).reduce((sum, b) => sum + b.total, 0),
      };
    });
    return { range, ticks: hourTicks(range), rows };
  }, [columns, bookingsByColumn, groupEventsByColumn]);

  const { range, ticks, rows } = layout;
  const spanMin = Math.max(60, range.endMin - range.startMin);
  const ppm = Math.max(MIN_PPM, (size.w - nameW) / spanMin);
  const trackW = spanMin * ppm;
  const rowH = Math.round(Math.min(ROW_MAX, Math.max(ROW_MIN, (size.h - AXIS_H) / Math.max(1, rows.length))));
  const x = (m: number) => (m - range.startMin) * ppm;
  const hourLabel = (m: number) => format.time(`${date}T${String(Math.floor(m / 60)).padStart(2, '0')}:00`);

  // Перенос мышью: слушатели на window на время одного перетаскивания; всё, что меняется на каждый кадр, — в замыкании
  const startDrag = (e: React.PointerEvent<HTMLButtonElement>, booking: Booking, rowIndex: number) => {
    if (!canMove || !content || e.button !== 0 || e.pointerType === 'touch') return;
    const el = e.currentTarget;
    const pointerId = e.pointerId;
    const x0 = e.clientX;
    const y0 = e.clientY;
    const from0 = startMinutes(booking);
    const maxStart = range.endMin - Math.min(booking.durationMin, range.endMin - range.startMin);
    let active = false;
    let key = '';
    let target: { plan: MovePlan; row: number; issue: PlacementIssue | null } | null = null;

    const planAt = (clientX: number, clientY: number) => {
      const rect = content.getBoundingClientRect();
      const row = Math.max(0, Math.min(rows.length - 1, Math.floor((clientY - rect.top - AXIS_H) / rowH)));
      const dxMin = (clientX - x0) / ppm;
      // Шаг 15 мин по сетке; дрожание руки на месте (меньше полшага) время не меняет
      const stepped = Math.abs(dxMin) < MOVE_STEP / 2 ? from0 : Math.round((from0 + dxMin) / MOVE_STEP) * MOVE_STEP;
      const startMin = Math.max(range.startMin, Math.min(stepped, maxStart));
      const column = rows[row].column;
      const plan: MovePlan =
        column.kind === 'staff'
          ? { staffId: column.staff.id, resourceIds: booking.resourceIds, startMin }
          : {
              staffId: booking.staffId,
              resourceIds: [column.instanceId],
              startMin,
              targetInstance: { resourceId: column.resource.id, instanceId: column.instanceId },
            };
      return { row, plan, column };
    };

    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      const dx = ev.clientX - x0;
      const dy = ev.clientY - y0;
      if (!active) {
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
        active = true;
        peek.suspend(true);
        el.style.transition = 'none';
        el.style.zIndex = '15';
        // Полупрозрачная, чтобы под ней была видна рамка места
        el.style.opacity = '0.85';
        el.style.willChange = 'transform';
        document.documentElement.style.cursor = 'grabbing';
      }
      el.style.transform = `translate(${dx}px, ${dy}px)`;
      const { row, plan, column } = planAt(ev.clientX, ev.clientY);
      const nextKey = `${row}:${plan.startMin}`;
      if (nextKey === key) return;
      key = nextKey;
      if (row === rowIndex && plan.startMin === from0) {
        target = null;
        ghostApi.current?.(null);
        return;
      }
      const issue = mover.check(booking, plan, dayBookings, column.kind === 'staff' ? column.hours : undefined);
      target = { plan, row, issue };
      const span = mover.range(plan.startMin, booking.durationMin);
      const who = row === rowIndex ? '' : ` · ${label(column).short}`;
      ghostApi.current?.({
        left: nameW + x(plan.startMin) + 1,
        top: AXIS_H + row * rowH + 4,
        width: Math.max(6, booking.durationMin * ppm - 2),
        height: rowH - 8,
        tone: !issue ? 'ok' : issue.kind === 'hours' ? 'warn' : 'bad',
        label: !issue ? `${span}${who}` : issue.kind === 'hours' ? `${span} · ${mover.reason(issue)}` : mover.reason(issue),
        labelBelow: row === 0,
      });
    };

    const finish = (commit: boolean) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('keydown', onKey, true);
      if (!active) return;
      swallowNextClick();
      peek.suspend(false);
      ghostApi.current?.(null);
      document.documentElement.style.cursor = '';
      el.style.willChange = '';
      const t = target;
      if (!commit || !t) return snapBack(el);
      if (t.issue && t.issue.kind !== 'hours') {
        mover.refuse(t.issue);
        return snapBack(el);
      }
      // Ставим полосу ровно в клетку и держим, пока не придут обновлённые записи дня
      el.style.transition = reducedMotion() ? 'none' : 'transform 120ms ease-out';
      el.style.transform = `translate(${(t.plan.startMin - from0) * ppm}px, ${(t.row - rowIndex) * rowH}px)`;
      movedEls.current.push(el);
      void mover.move(booking, t.plan).then((ok) => {
        if (!ok) snapBack(el);
      });
    };
    const onUp = (ev: PointerEvent) => ev.pointerId === pointerId && finish(true);
    const onCancel = (ev: PointerEvent) => ev.pointerId === pointerId && finish(false);
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key !== 'Escape' || !active) return;
      ev.stopPropagation();
      finish(false);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    window.addEventListener('keydown', onKey, true);
  };

  return (
    <div className={cn('relative flex min-h-0 flex-col', className)}>
      <div
        ref={setScroller}
        data-f="F-01-018 F-01-019 F-01-022 F-01-023"
        aria-label={t('board.layout.timeline')}
        className="scrollbar-thin min-h-0 flex-1 overflow-auto overscroll-contain rounded-2xl border border-border bg-surface pb-24 md:pb-0"
      >
        <div ref={setContent} className="relative" style={{ width: nameW + trackW }}>
          {/* Шкала времени — прилипает сверху */}
          <div className="sticky top-0 z-30 flex border-b border-border bg-surface" style={{ height: AXIS_H }}>
            <div className="sticky left-0 z-10 shrink-0 border-r border-line bg-surface" style={{ width: nameW }} />
            <div className="relative shrink-0" style={{ width: trackW }}>
              {ticks.slice(0, -1).map((m) => (
                <span key={m} style={{ left: x(m) + 6 }} className="absolute top-1/2 -translate-y-1/2 text-[11px] text-muted tabular-nums select-none">
                  <TimeText value={hourLabel(m)} suffixClassName="text-[10px]" hourOnly />
                </span>
              ))}
              {nowMin !== null && nowMin >= range.startMin && nowMin <= range.endMin && (
                <span
                  style={{ left: x(nowMin) }}
                  className="absolute top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-md bg-danger px-1.5 text-[11px] leading-5 font-bold text-primary-contrast tabular-nums"
                >
                  {format.time(`${date}T${fromMinutes(nowMin)}`)}
                </span>
              )}
            </div>
          </div>

          {rows.map(({ column, bookings, bands, load, revenue }, rowIndex) => {
            const name = label(column);
            const events = groupEventsByColumn[column.id] ?? [];
            const count =
              column.kind === 'staff' && column.off
                ? t('board.column.offBookings', { label: column.off.label, n: load.count })
                : t('board.column.bookings', { n: load.count });
            return (
              <div key={column.id} data-row={column.id} className="flex border-b border-line last:border-b-0" style={{ height: rowH }}>
                <div
                  className="sticky left-0 z-20 flex shrink-0 items-center gap-2 border-r border-line bg-surface px-3"
                  style={{ width: nameW }}
                >
                  {/* Аватар и под ним полоса загрузки цвета мастера — вторая строка справа свободна под «N записей · сумма» */}
                  {column.kind === 'staff' && !isPhone && (
                    <span className="flex shrink-0 flex-col items-center gap-1">
                      <Avatar name={column.staff.name} src={column.staff.avatarUrl} colorIndex={column.staff.colorIndex} size="xs" />
                      <span
                        aria-label={t('board.column.load', { pct: Math.round(load.ratio * 100) })}
                        className="relative h-1 w-6 overflow-hidden rounded-full bg-surface-3"
                      >
                        <span
                          className={cn('absolute inset-y-0 left-0 rounded-full', STAFF_BAR[column.staff.colorIndex] ?? 'bg-primary')}
                          style={{ width: `${Math.round(load.ratio * 100)}%` }}
                        />
                      </span>
                    </span>
                  )}
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-semibold text-fg" title={name.name}>
                      {isPhone ? name.short : name.name}
                    </span>
                    <span className="flex items-baseline justify-between gap-2 text-xs">
                      <span className={cn('truncate', column.kind === 'staff' && column.off ? 'text-warning' : 'text-muted')}>{count}</span>
                      {/* Выручка мастера за день; на телефоне колонка 116px — только число записей */}
                      {!isPhone && showStatistics && revenue > 0 && (
                        <span className="shrink-0 font-semibold text-fg tabular-nums" aria-label={t('board.column.revenue', { sum: format.money(revenue) })}>
                          {format.money(revenue)}
                        </span>
                      )}
                    </span>
                  </div>
                </div>

                <div
                  data-track
                  className={cn('relative shrink-0', canCreate && 'cursor-cell')}
                  style={{ width: trackW }}
                  onClick={(e) => {
                    if (!canCreate) return;
                    const at = range.startMin + (e.clientX - e.currentTarget.getBoundingClientRect().left) / ppm;
                    onCreate(column.id, snapTime(at - 7, range.startMin, range.endMin - 15));
                  }}
                >
                  {bands.map((b) => (
                    <div
                      key={`${b.from}-${b.to}`}
                      style={{ left: x(b.from), width: (b.to - b.from) * ppm }}
                      className="pointer-events-none absolute inset-y-0 bg-surface-2/60"
                    />
                  ))}
                  {ticks.slice(1, -1).map((m) => (
                    <div key={m} style={{ left: x(m) }} className="pointer-events-none absolute inset-y-0 border-l border-line" />
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
                        style={{ left: x(g.from) + 1, width: (g.to - g.from) * ppm - 2 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          const at = g.from + (e.clientX - e.currentTarget.getBoundingClientRect().left) / ppm;
                          onPickSlot?.(column.id, snapTime(Math.floor(at / 15) * 15, g.from, g.to - slotDurationMin));
                        }}
                        className="absolute inset-y-1 z-[1] animate-fade-in overflow-hidden rounded-md border-2 border-dashed border-primary/50 bg-primary-soft/70 px-1.5 text-left text-[11px] font-semibold whitespace-nowrap text-primary-text transition-colors hover:border-primary hover:bg-primary-soft"
                      >
                        {(g.to - g.from) * ppm > 72 ? from : null}
                      </button>
                    );
                  })}
                  {events.map((ev) => {
                    const from = startMinutes(ev);
                    const service = services.find((s) => s.id === ev.serviceId);
                    const seats = `${participantCountByEvent[ev.id] ?? 0}/${ev.capacity}`;
                    const title = `${service ? pickText(service.name, locale) : t('board.layout.groupEvent')} · ${seats}`;
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
                        style={{ left: x(from) + 1, width: ev.durationMin * ppm - 2 }}
                        className="absolute inset-y-1 z-[2] flex items-center overflow-hidden rounded-md border border-dashed border-border-strong bg-surface-2 px-1.5 text-left text-xs font-semibold whitespace-nowrap text-fg hover:bg-surface-3"
                      >
                        {/* Узкая полоса — только места «9/10», название — в подсказке */}
                        <span className="truncate">{ev.durationMin * ppm > 150 ? title : seats}</span>
                      </button>
                    );
                  })}
                  {bookings.map((b) => {
                    const from = startMinutes(b);
                    const w = b.durationMin * ppm - 2;
                    const tone = toneOf(b);
                    const client = b.clientId ? clientsById[b.clientId] : undefined;
                    const who = client ? shortClientName(client.name) : (b.visitorName ?? t('board.list.noClient'));
                    return (
                      <button
                        key={b.id}
                        type="button"
                        data-booking={b.id}
                        {...peek.bind(b)}
                        onPointerDown={(e) => startDrag(e, b, rowIndex)}
                        aria-label={`${format.time(b.start)} ${who}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          peek.hide();
                          onOpen(b.id);
                        }}
                        style={{ left: x(from) + 1, width: Math.max(6, w), background: tone.fill, color: tone.ink, boxShadow: `inset 3px 0 0 ${tone.drop}` }}
                        className={cn(
                          'absolute inset-y-1 z-[3] flex items-center gap-1.5 overflow-hidden rounded-md text-left whitespace-nowrap transition-[filter] select-none hover:brightness-95 focus-visible:outline-2 focus-visible:outline-focus',
                          canMove && 'cursor-grab',
                          b.status === 'awaiting_confirmation' && 'outline-2 -outline-offset-2 outline-warning outline-dashed',
                          b.status === 'no_show' && 'opacity-60',
                          // Узкая (30 мин) — время мельче и с меньшими полями, чтобы влезло целиком, а не «16:3…»
                          w < 48 ? 'pr-0.5 pl-1.5 text-[10px]' : 'pr-1 pl-2 text-[11px]',
                        )}
                      >
                        {w >= 34 && <b className="font-bold tabular-nums">{format.time(b.start)}</b>}
                        {w > 90 && <span className="truncate font-medium">{who}</span>}
                      </button>
                    );
                  })}
                  {nowMin !== null && nowMin >= range.startMin && nowMin <= range.endMin && (
                    <div style={{ left: x(nowMin) }} className="pointer-events-none absolute inset-y-0 z-[4] w-0.5 -translate-x-1/2 bg-danger" />
                  )}
                </div>
              </div>
            );
          })}
          {canMove && <GhostLayer apiRef={ghostApi} />}
        </div>
      </div>
      {peek.card}
    </div>
  );
}

/** Слой призрака: своё состояние, чтобы смена клетки перерисовывала только его, а не всю ленту */
function GhostLayer({ apiRef }: { apiRef: RefObject<((g: DropGhost | null) => void) | null> }) {
  const [ghost, setGhost] = useState<DropGhost | null>(null);
  useLayoutEffect(() => {
    apiRef.current = setGhost;
    return () => {
      apiRef.current = null;
    };
  }, [apiRef]);
  // Над соседними полосами (z-3) и линией «сейчас» (z-4), но под самой перетаскиваемой полосой (z-15)
  return ghost ? <DropGhostBox ghost={ghost} className="z-[5]" labelClassName="z-[16]" /> : null;
}

function reducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function resetBar(el: HTMLElement) {
  el.style.transition = '';
  el.style.transform = '';
  el.style.zIndex = '';
  el.style.opacity = '';
  el.style.willChange = '';
}

/** Не легло — полоса возвращается на место (transform, 150 мс; при «уменьшить движение» — сразу) */
function snapBack(el: HTMLElement) {
  el.style.willChange = '';
  if (reducedMotion()) return resetBar(el);
  el.style.transition = 'transform 150ms ease-out';
  el.style.transform = '';
  el.addEventListener('transitionend', () => resetBar(el), { once: true });
}
