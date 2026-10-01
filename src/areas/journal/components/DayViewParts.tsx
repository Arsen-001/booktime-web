'use client';

/**
 * Общие части видов дня «Обзор» и «Лента» (⭐ наше, 29.09.2026): подпись колонки (мастер или экземпляр ресурса),
 * лёгкая карточка записи при наведении (без запросов — всё уже в данных дня) и полоса загрузки цвета мастера.
 * Тяжёлая карточка BookingHoverCard остаётся у «Колонок»: в плотных видах наведение скользит по десяткам полосок.
 */
import { useLocale } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import type { Booking, Client, GroupEvent, Id, ISODate, Resource, Service } from '@/domain/core';
import type { ColumnDef } from '@/areas/journal/components/DayGrid';
import type { BookingToneInfo } from '@/areas/journal/lib/board';
import { shortClientName } from '@/areas/journal/lib/clientName';
import { useJournalHourFormat } from '@/areas/journal/lib/useJournalHourFormat';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';
import { fromMinutes } from '@/lib/date';
import { pickText } from '@/lib/text';
import { BookingStatusBadge } from '@/ui/BookingStatusBadge';
import { Portal } from '@/ui/Portal';
import { useFloating } from '@/ui/hooks/useFloating';

/** Полоса загрузки — цвет мастера (Staff.colorIndex → chart-N), как в шапке «Колонок» */
export const STAFF_BAR: Record<number, string> = {
  1: 'bg-chart-1',
  2: 'bg-chart-2',
  3: 'bg-chart-3',
  4: 'bg-chart-4',
  5: 'bg-chart-5',
  6: 'bg-chart-6',
  7: 'bg-chart-7',
  8: 'bg-chart-8',
};

export interface DayViewProps {
  date: ISODate;
  columns: ColumnDef[];
  bookingsByColumn: Record<Id, Booking[]>;
  clientsById: Record<Id, Client>;
  services: Service[];
  toneOf: (b: Booking) => BookingToneInfo;
  showPhones: boolean;
  canCreate: boolean;
  onCreate: (columnId: Id, startTime: string) => void;
  onOpen: (bookingId: Id) => void;
  /** «Найти окно»: места под выбранную услугу, id колонки → промежутки (минуты) */
  slotGaps?: Record<Id, { from: number; to: number }[]>;
  slotDurationMin?: number;
  onPickSlot?: (columnId: Id, time: string) => void;
  /** Групповые занятия дня (F-01-035): id колонки мастера → занятия */
  groupEventsByColumn?: Record<Id, GroupEvent[]>;
  participantCountByEvent?: Record<Id, number>;
  onOpenGroupEvent?: (eventId: Id) => void;
  /** Перенос перетаскиванием (право «Перенос записи»; сейчас — «Лента») */
  canMove?: boolean;
  /** Ресурсы бизнеса — подсказка «Занято: Кресло» при переносе */
  allResources?: Resource[];
  className?: string;
}

export function useColumnLabel() {
  const locale = useLocale();
  return (column: ColumnDef): { name: string; short: string } => {
    if (column.kind === 'staff') return { name: column.staff.name, short: column.staff.name.split(' ')[0] };
    const resource = pickText(column.resource.name, locale);
    return { name: `${resource} · ${column.instanceName}`, short: column.instanceName || resource };
  };
}

/** Участники группового занятия не рисуются отдельными записями — их видно в самом занятии («5 из 8 мест») */
export function withoutParticipants(bookings: Booking[], events: GroupEvent[] | undefined): Booking[] {
  if (!events?.length) return bookings;
  const ids = new Set(events.map((e) => e.id));
  return bookings.filter((b) => !b.groupEventId || !ids.has(b.groupEventId));
}

/** Текущая минута дня (раз в минуту), только для сегодняшнего дня; иначе null */
export function useNowMinute(isToday: boolean): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (!isToday) return;
    const tick = () => {
      const d = new Date();
      setNow(d.getHours() * 60 + d.getMinutes());
    };
    const kickoff = setTimeout(tick, 0);
    const id = setInterval(tick, 60_000);
    return () => {
      clearTimeout(kickoff);
      clearInterval(id);
    };
  }, [isToday]);
  return isToday ? now : null;
}

/** Время из минут с шагом 15 мин в пределах [from, to − длительность] — клик по свободному месту или окну */
export function snapTime(minutes: number, min: number, max: number): string {
  const stepped = Math.round(minutes / 15) * 15;
  return fromMinutes(Math.max(min, Math.min(stepped, max)));
}

/** Карточка записи по наведению: время, клиент, услуги, статус, сумма. Одна на вид, а не у каждой полоски */
export function useBookingPeek(input: { date: ISODate; clientsById: Record<Id, Client>; services: Service[]; showPhones: boolean }) {
  const [peek, setPeek] = useState<{ booking: Booking; anchor: HTMLElement } | null>(null);
  // Пока запись тащат, карточка не появляется и не мигает на полосках под курсором
  const suspended = useRef(false);
  const bind = (booking: Booking) => ({
    onPointerEnter: (e: React.PointerEvent<HTMLElement>) => {
      if (e.pointerType === 'mouse' && !suspended.current) setPeek({ booking, anchor: e.currentTarget });
    },
    onPointerLeave: () => setPeek(null),
    onFocus: (e: React.FocusEvent<HTMLElement>) => setPeek({ booking, anchor: e.currentTarget }),
    onBlur: () => setPeek(null),
  });
  const card = peek ? <BookingPeekCard key={peek.booking.id} {...input} booking={peek.booking} anchor={peek.anchor} /> : null;
  const suspend = (on: boolean) => {
    suspended.current = on;
    if (on) setPeek(null);
  };
  return { bind, card, hide: () => setPeek(null), suspend };
}

function BookingPeekCard({
  booking,
  anchor,
  clientsById,
  services,
  showPhones,
}: {
  booking: Booking;
  anchor: HTMLElement;
  clientsById: Record<Id, Client>;
  services: Service[];
  showPhones: boolean;
}) {
  const t = useT('journal');
  const locale = useLocale();
  const format = useFormat({ hourCycle: useJournalHourFormat() });
  const [floating, setFloating] = useState<HTMLDivElement | null>(null);
  useFloating({ open: true, anchor, floating, side: 'right', align: 'start', offset: 8 });
  const client = booking.clientId ? clientsById[booking.clientId] : undefined;
  const serviceNames = booking.services
    .map((line) => services.find((s) => s.id === line.serviceId))
    .filter((s): s is Service => Boolean(s))
    .map((s) => pickText(s.name, locale));
  const end = fromMinutes(Number(booking.start.slice(11, 13)) * 60 + Number(booking.start.slice(14, 16)) + booking.durationMin);
  return (
    <Portal>
      <div
        ref={setFloating}
        role="tooltip"
        style={{ position: 'fixed', top: 0, left: 0, visibility: 'hidden' }}
        className="pointer-events-none z-[60] flex w-64 animate-fade-in flex-col gap-1.5 rounded-xl border border-border bg-surface p-3 text-sm shadow-lg"
      >
        <p className="font-bold text-fg tabular-nums">
          {format.time(booking.start)}–{format.time(`${booking.start.slice(0, 10)}T${end}`)}
        </p>
        <p className="font-semibold text-fg">
          {client ? shortClientName(client.name) : (booking.visitorName ?? t('board.list.noClient'))}
          {showPhones && client?.phone && <span className="font-normal text-muted"> · {client.phone}</span>}
        </p>
        {serviceNames.length > 0 && <p className="text-muted">{serviceNames.join(', ')}</p>}
        <div className="flex items-center justify-between gap-2 pt-0.5">
          <BookingStatusBadge status={booking.status} size="sm" />
          <span className="font-semibold text-fg tabular-nums">{format.money(booking.total)}</span>
        </div>
      </div>
    </Portal>
  );
}

/** Место, куда ляжет запись при переносе: зелёное — свободно, жёлтое — вне графика, красное — занято (с причиной) */
export interface DropGhost {
  left: number;
  top: number;
  width: number;
  height: number;
  tone: 'ok' | 'warn' | 'bad';
  label: string;
  /** Подпись под местом, а не над ним — у самого верхнего ряда/края */
  labelBelow?: boolean;
}

const GHOST_TONE: Record<DropGhost['tone'], { box: string; pill: string }> = {
  // Подпись — светлая плашка с цветным текстом: читается в обеих темах (белый на светлом success тёмной темы — нет)
  ok: { box: 'border-success bg-success-soft/70', pill: 'border-success text-success' },
  warn: { box: 'border-warning bg-warning-soft/70', pill: 'border-warning text-warning' },
  bad: { box: 'border-danger bg-danger-soft/80', pill: 'border-danger text-danger' },
};

/**
 * Призрак места переноса. Двигается transform'ом (не left/top), перерисовывается только при смене клетки (шаг сетки),
 * а не на каждый pointermove — сама запись едет за курсором через transform без React. Рамка лежит ПОД перетаскиваемой
 * записью, а подпись — отдельным слоем НАД ней (labelClassName), чтобы причину «Занято: …» ничто не закрывало.
 */
export function DropGhostBox({
  ghost,
  className = 'z-[25]',
  labelClassName = 'z-[35]',
}: {
  ghost: DropGhost;
  className?: string;
  labelClassName?: string;
}) {
  const tone = GHOST_TONE[ghost.tone];
  const labelY = ghost.labelBelow ? ghost.top + ghost.height + 4 : ghost.top - 4;
  return (
    <>
      <div
        aria-hidden
        data-drop-ghost={ghost.tone}
        style={{ transform: `translate(${ghost.left}px, ${ghost.top}px)`, width: ghost.width, height: ghost.height }}
        className={cn('pointer-events-none absolute top-0 left-0 rounded-md border-2 border-dashed', tone.box, className)}
      />
      <span
        role="status"
        style={{ transform: `translate(${ghost.left}px, ${labelY}px)${ghost.labelBelow ? '' : ' translateY(-100%)'}` }}
        className={cn(
          'pointer-events-none absolute top-0 left-0 rounded-md border bg-surface px-1.5 text-xs leading-5 font-semibold whitespace-nowrap shadow-sm tabular-nums',
          tone.pill,
          labelClassName,
        )}
      >
        {ghost.label}
      </span>
    </>
  );
}
