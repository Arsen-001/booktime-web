'use client';

/**
 * Перенос записи перетаскиванием — общий для «Колонок» (DayGrid, dnd-kit) и «Ленты» (DayTimeline, pointer events).
 * F-01-110/F-01-114.
 *
 * - placementIssue — чистая проверка места по УЖЕ загруженным записям дня (зовётся на каждую смену целевой клетки при
 *   перетаскивании, без запросов): занят ли мастер, свободен ли нужный ресурс, внутри ли рабочих часов.
 * - useMoveBooking — сам перенос: окончательная проверка через api (hasOverlap / hasResourceOverlap), updateBooking,
 *   тост «Запись перенесена» с «Отменить» на 5 секунд (F-00-061). Одна логика на оба вида — сообщения одинаковые.
 */
import { useMemo } from 'react';
import type { Booking, BookingStatus, Client, DayHours, Id, ISODate, Resource } from '@/domain/core';
import { updateBooking } from '@/api/core';
import { getJournalSettings, hasOverlap, hasResourceOverlap } from '@/api/journal';
import { ApiError, useApiQuery } from '@/api/request';
import { startMinutes } from '@/areas/journal/lib/board';
import { shortClientName } from '@/areas/journal/lib/clientName';
import { useJournalHourFormat } from '@/areas/journal/lib/useJournalHourFormat';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { fromMinutes, toMinutes } from '@/lib/date';
import { pickText } from '@/lib/text';
import { useLocale } from 'next-intl';
import { useToast } from '@/ui/Toast';

/** Куда кладём запись: мастер, ресурсы (экземпляры) и минуты начала */
export interface MovePlan {
  staffId: Id;
  resourceIds: Id[];
  startMin: number;
  /** Колонка-экземпляр ресурса (журнал по ресурсам): проверяется именно он, а не «любой свободный того же вида» */
  targetInstance?: { resourceId: Id; instanceId: Id };
}

/** Что мешает положить запись сюда: мастер занят, ресурс занят — нельзя; вне графика — можно, но предупреждаем */
export type PlacementIssue =
  | { kind: 'staff'; with: Booking }
  | { kind: 'resource'; resource: Resource; instanceName?: string }
  | { kind: 'hours' };

const INACTIVE: BookingStatus[] = ['cancelled_by_client', 'cancelled_by_master'];

/** Та же логика, что у api (isOverlapBlockingStatus): отменённые не мешают, «Не пришёл» — по настройке F-01-173 */
function blocks(b: Booking, allowOverNoShow: boolean): boolean {
  if (b.deletedAt || INACTIVE.includes(b.status)) return false;
  return !(b.status === 'no_show' && allowOverNoShow);
}

/** Все записи дня одним списком без повторов (одна запись может стоять в нескольких колонках ресурсов) */
export function flattenDay(bookingsByColumn: Record<Id, Booking[]>): Booking[] {
  const seen = new Map<Id, Booking>();
  for (const list of Object.values(bookingsByColumn)) for (const b of list) seen.set(b.id, b);
  return [...seen.values()];
}

export function placementIssue(
  booking: Booking,
  plan: MovePlan,
  dayBookings: Booking[],
  opts: { allowOverNoShow: boolean; hours?: DayHours; resources?: Resource[] },
): PlacementIssue | null {
  const from = plan.startMin;
  const to = from + booking.durationMin;
  const overlaps = (b: Booking) => from < startMinutes(b) + b.durationMin && to > startMinutes(b);
  const others = dayBookings.filter((b) => b.id !== booking.id && blocks(b, opts.allowOverNoShow) && overlaps(b));

  if (!plan.targetInstance) {
    const clash = others.find((b) => b.staffId === plan.staffId || b.services.some((s) => s.staffId === plan.staffId));
    if (clash) return { kind: 'staff', with: clash };
  }

  // Ресурсы: колонка-экземпляр — строго он; иначе ядро само берёт другой свободный экземпляр того же ресурса
  // (resolveBookingResources), поэтому «занято» — только когда заняты ВСЕ экземпляры
  const busyInstances = new Set(others.flatMap((b) => b.resourceIds));
  if (plan.targetInstance) {
    if (busyInstances.has(plan.targetInstance.instanceId)) {
      const resource = opts.resources?.find((r) => r.id === plan.targetInstance!.resourceId);
      if (resource) {
        const inst = resource.instances.find((i) => i.id === plan.targetInstance!.instanceId);
        return { kind: 'resource', resource, instanceName: resource.instances.length > 1 ? inst?.name : undefined };
      }
    }
  } else if (opts.resources?.length) {
    for (const instanceId of plan.resourceIds) {
      if (!busyInstances.has(instanceId)) continue;
      const resource = opts.resources.find((r) => r.instances.some((i) => i.id === instanceId));
      if (resource && resource.instances.every((i) => busyInstances.has(i.id))) return { kind: 'resource', resource };
    }
  }

  if (opts.hours && !plan.targetInstance) {
    const inside = opts.hours.some((h) => toMinutes(h.from) <= from && to <= toMinutes(h.to));
    if (!inside) return { kind: 'hours' };
  }
  return null;
}

export interface UseMoveBookingInput {
  date: ISODate;
  clientsById: Record<Id, Client>;
  resources?: Resource[];
}

export function useMoveBooking({ date, clientsById, resources }: UseMoveBookingInput) {
  const t = useT('journal');
  const tc = useT('common');
  const toast = useToast();
  const locale = useLocale();
  const format = useFormat({ hourCycle: useJournalHourFormat() });
  // Тот же ключ, что у экрана журнала, — настройки уже в кэше, отдельного запроса нет
  const settings = useApiQuery(['journal', 'settings-in-screen'], getJournalSettings);
  const allowOverNoShow = settings.data?.allowOverlapOverNoShow ?? true;

  return useMemo(() => {
    const check = (booking: Booking, plan: MovePlan, dayBookings: Booking[], hours?: DayHours) =>
      placementIssue(booking, plan, dayBookings, { allowOverNoShow, hours, resources });

    /** Короткая причина для подсказки у призрака: «Занято: 14:00 Гагик А.», «Занято: Кресло 2», «Вне графика» */
    const reason = (issue: PlacementIssue): string => {
      if (issue.kind === 'staff') {
        const c = issue.with.clientId ? clientsById[issue.with.clientId] : undefined;
        const who = c ? shortClientName(c.name) : (issue.with.visitorName ?? t('board.list.noClient'));
        return t('board.drag.busyStaff', { time: format.time(issue.with.start), name: who });
      }
      if (issue.kind === 'resource') {
        const name = pickText(issue.resource.name, locale);
        return t('board.drag.busyResource', { name: issue.instanceName ? `${name} ${issue.instanceName}` : name });
      }
      return t('board.drag.outsideHours');
    };

    /** Подпись свободного места: «14:15–15:00» */
    const range = (startMin: number, durationMin: number) =>
      `${format.time(`${date}T${fromMinutes(startMin)}`)}–${format.time(`${date}T${fromMinutes(startMin + durationMin)}`)}`;

    /** Перенос с окончательной проверкой через api. true — запись перенесена */
    const move = async (booking: Booking, plan: MovePlan): Promise<boolean> => {
      const start = `${date}T${fromMinutes(plan.startMin)}`;
      if (start === booking.start && plan.staffId === booking.staffId && plan.resourceIds.join() === booking.resourceIds.join()) return false;
      try {
        const overlap = plan.targetInstance
          ? await hasResourceOverlap(plan.targetInstance.resourceId, plan.targetInstance.instanceId, start, booking.durationMin, booking.id)
          : await hasOverlap(plan.staffId, start, booking.durationMin, booking.id);
        if (overlap) {
          toast.error(plan.targetInstance ? tc('bookingErrors.resource_unavailable') : t('block.resizeOverlap'));
          return false;
        }
        const prev = { staffId: booking.staffId, resourceIds: booking.resourceIds, start: booking.start };
        await updateBooking(booking.id, { staffId: plan.staffId, resourceIds: plan.resourceIds, start });
        toast.success(t('grid.moveToast'), {
          action: {
            label: t('window.deleteUndo'),
            onClick: () => {
              updateBooking(booking.id, prev).catch(() => toast.error(tc('states.actionFailed')));
            },
          },
          durationMs: 5000,
        });
        return true;
      } catch (e) {
        // Ядро само подбирает свободный экземпляр ресурса; не нашло — понятная причина, а не «что-то пошло не так»
        // F-00-047: домашнюю запись нельзя перенести на часы смены в салоне, где владелец это запретил
        const code = e instanceof ApiError ? e.code : undefined;
        toast.error(code === 'resource_unavailable' || code === 'home_during_shift' ? tc(`bookingErrors.${code}`) : tc('states.actionFailed'));
        return false;
      }
    };

    /** Отпустили на занятом месте: запись возвращается, причина — тостом (та же, что была у призрака) */
    const refuse = (issue: PlacementIssue) => toast.error(reason(issue));

    return { check, reason, range, move, refuse };
  }, [allowOverNoShow, resources, clientsById, t, tc, toast, locale, format, date]);
}

/** Синтетический click после отпускания открыл бы окно записи или создал запись под курсором — глушим ровно его */
export function swallowNextClick() {
  const swallow = (ev: MouseEvent) => {
    ev.stopPropagation();
    ev.preventDefault();
  };
  window.addEventListener('click', swallow, true);
  window.setTimeout(() => window.removeEventListener('click', swallow, true), 0);
}
