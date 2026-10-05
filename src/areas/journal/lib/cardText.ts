/**
 * Все подписи карточки записи считаются в сетке ОДИН раз на данные дня (useMemo), а не в каждой карточке: карточек на
 * экране десятки, и у каждой раньше были свои useT/useFormat/запрос настроек — это и было дорогим монтированием при
 * листании дней (DESIGN.md → Performance). Карточка получает готовые строки и только рисует.
 */
import type { Booking, BookingStatus, Client, Id, Service } from '@/domain/core';
import type { BookingCategoryDef, BookingExtras, FirstLineMode } from '@/domain/journal';
import type { useT } from '@/i18n/useT';
import type { Formatter } from '@/i18n/useFormat';
import { addMinutes } from '@/lib/date';
import { pickText } from '@/lib/text';
import { bookingCategoryLabel } from '@/areas/journal/lib/bookingCategoryLabel';
import { clientCategories } from '@/areas/journal/lib/categories';
import { shortClientName } from '@/areas/journal/lib/clientName';
import { maskPhone } from '@/areas/journal/lib/rights';
import { isOnlineSource } from '@/areas/journal/lib/status';

type JournalT = ReturnType<typeof useT<'journal'>>;

export interface CardText {
  time: string;
  primary: string;
  secondary: string;
  pill: string;
  aria: string;
  statusLabel: string;
  /** Метки клиента и свои категории записи (F-01-214, F-01-051) — на высоких карточках */
  chips: { key: string; label: string; colorIndex?: number }[];
  phone?: string;
  comment?: string;
  cross?: string;
  staffAssignment?: 'specific' | 'any';
  staffAssignmentLabel?: string;
  online: boolean;
  pending: boolean;
  dimmed: boolean;
  /** Статус, который стоит показать значком на невысокой карточке (без пилюли) */
  statusIcon: boolean;
  isNew: boolean;
  /** ⭐ Запись на сдачу (05.10.2026): «Приём заказа» мастерской — значок и «Сдача: что сдают» вместо услуги */
  dropOff: boolean;
}

/** Постоянные подписи карточек (одинаковые для всех) */
export interface CardLabels {
  newClient: string;
  online: string;
  statusCard: string;
  resizeHandle: string;
  breakTitle: string;
  breakDefault: string;
  breakDelete: string;
  breakSetTo: { m: number; label: string }[];
}

export const BREAK_DURATION_OPTIONS = [5, 10, 15, 20, 30, 45, 60];

export function cardLabels(t: JournalT, format: Formatter): CardLabels {
  return {
    newClient: t('board.card.newClient'),
    online: t('board.card.online'),
    statusCard: t('board.card.statusCard'),
    resizeHandle: t('block.resizeHandle'),
    breakTitle: t('block.breakTitle'),
    breakDefault: t('block.breakDefault'),
    breakDelete: t('block.breakDelete'),
    breakSetTo: BREAK_DURATION_OPTIONS.map((m) => ({ m, label: t('block.breakSetTo', { m: format.duration(m) }) })),
  };
}

export interface CardTextContext {
  t: JournalT;
  format: Formatter;
  statusLabel: (s: BookingStatus) => string;
  locale: string;
  firstLineMode: FirstLineMode;
  showPhones: boolean;
  servicesById: Map<Id, Service>;
  bookingCategories: BookingCategoryDef[];
}

export function cardText(
  booking: Booking,
  client: Client | undefined,
  extras: BookingExtras | undefined,
  ctx: CardTextContext,
  opts: { cross?: string; isNew: boolean; lacquerName?: string },
): CardText {
  const { t, format, statusLabel, locale, firstLineMode, showPhones, servicesById } = ctx;
  // F-01-026: в сетке — имя и первая буква фамилии; карточка статуса и окно записи показывают полное имя
  const clientName = (client?.name ? shortClientName(client.name) : undefined) || booking.visitorName;
  const phone = client?.phone ? (showPhones ? format.phone(client.phone) : maskPhone(client.phone)) : undefined;
  const services = booking.services.map((line) => servicesById.get(line.serviceId));
  const dropOff = services.some((s) => s?.kind === 'intake');
  const serviceNames = dropOff
    ? booking.comment
      ? t('board.card.dropOffWhat', { what: booking.comment })
      : t('board.card.dropOff')
    : services.length
      ? services.map((s) => (s ? pickText(s.name, locale as never) : t('block.service'))).join(' + ')
      : t('block.noService');
  const end = format.time(addMinutes(booking.start, booking.durationMin));
  const until = t('board.card.until', { time: end });
  const noClient = t('block.noClient');
  // F-01-171: жирная строка под временем — имя, услуга или телефон (настройка журнала)
  const primary =
    firstLineMode === 'phone'
      ? (phone ?? clientName ?? noClient)
      : firstLineMode === 'service'
        ? services[0]
          ? pickText(services[0].name, locale as never)
          : t('block.noService')
        : (clientName ?? noClient);
  const secondary =
    (firstLineMode === 'clientName' ? `${serviceNames} · ${until}` : `${clientName ?? noClient} · ${until}`) +
    (booking.visitorName && client?.name ? ` · ${booking.visitorName}` : '');
  const status = statusLabel(booking.status);
  const time = format.time(booking.start);
  const chips = [
    ...clientCategories(client?.tags).map((c) => ({ key: c.match, label: t(`categories.${c.labelKey}`) })),
    ...(extras?.categoryIds ?? [])
      .map((id) => ctx.bookingCategories.find((c) => c.id === id))
      .filter((c): c is BookingCategoryDef => Boolean(c))
      .map((c) => ({ key: c.id, label: bookingCategoryLabel(t, c), colorIndex: c.colorIndex })),
  ];
  return {
    time,
    primary,
    secondary,
    pill: [status, opts.lacquerName].filter(Boolean).join(' · '),
    aria: [`${time}–${end}`, clientName, serviceNames, status, opts.lacquerName].filter(Boolean).join(', '),
    statusLabel: status,
    chips,
    phone: firstLineMode !== 'phone' ? phone : undefined,
    comment: booking.comment || undefined,
    cross: opts.cross,
    staffAssignment: booking.staffAssignment,
    staffAssignmentLabel: booking.staffAssignment
      ? booking.staffAssignment === 'any'
        ? t('block.staffAssignment.any')
        : t('block.staffAssignment.specific')
      : undefined,
    online: isOnlineSource(booking.source),
    pending: booking.status === 'awaiting_confirmation',
    dimmed: booking.status === 'cancelled_by_client' || booking.status === 'cancelled_by_master' || booking.status === 'no_show',
    statusIcon: !['awaiting_confirmation', 'scheduled', 'client_confirmed'].includes(booking.status),
    isNew: opts.isNew,
    dropOff,
  };
}

/** Поверхностное сравнение для memo карточки: объекты текста/подписей — по полям, массивы — по элементам */
export function shallowEqualDeep1(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a as object);
  const kb = Object.keys(b as object);
  if (ka.length !== kb.length) return false;
  for (const k of ka) {
    const va = (a as Record<string, unknown>)[k];
    const vb = (b as Record<string, unknown>)[k];
    if (va === vb) continue;
    if (Array.isArray(va) && Array.isArray(vb)) {
      if (va.length !== vb.length) return false;
      for (let i = 0; i < va.length; i++) if (va[i] !== vb[i] && !shallowEqualDeep1(va[i], vb[i])) return false;
      continue;
    }
    if (va && vb && typeof va === 'object' && typeof vb === 'object' && shallowEqualDeep1(va, vb)) continue;
    return false;
  }
  return true;
}
