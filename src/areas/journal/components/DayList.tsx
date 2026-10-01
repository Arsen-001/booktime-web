'use client';

/**
 * Вид дня «Список» (⭐ наше, 29.09.2026): все записи дня по времени одним списком — утром на ресепшене и на телефоне.
 * Сегодня по умолчанию «Впереди» (прошедшие убраны), переключатель — «Все»; между прошедшими и будущими — черта
 * «Сейчас». Длинный день — по страницам 10/20/50/100, как все длинные списки (DESIGN.md).
 * Прошедшие видны сразу (серый фон строки + «Прошла»), идущая сейчас — «Идёт»; в каждой строке — быстрые действия
 * «Пришёл» / «Оплатить» / «Позвонить» без окна записи (DayListActions).
 */
import { CheckCheck } from 'lucide-react';
import { useLocale } from 'next-intl';
import { useState } from 'react';
import type { Booking, GroupEvent, Id, Service } from '@/domain/core';
import type { ColumnDef } from '@/areas/journal/components/DayGrid';
import { DayListRowActions, LIST_EXTRAS_KEY, useDayListActions } from '@/areas/journal/components/DayListActions';
import { listBookingPaymentSummaries, type BookingPaymentBrief } from '@/api/finance';
import { useApiQuery } from '@/api/request';
import { startMinutes } from '@/areas/journal/lib/board';
import { useJournalHourFormat } from '@/areas/journal/lib/useJournalHourFormat';
import { useColumnLabel, useNowMinute, withoutParticipants, type DayViewProps } from '@/areas/journal/components/DayViewParts';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';
import { fromMinutes, today } from '@/lib/date';
import { pickText } from '@/lib/text';
import { Avatar } from '@/ui/Avatar';
import { Badge } from '@/ui/Badge';
import { BookingStatusBadge } from '@/ui/BookingStatusBadge';
import { EmptyState } from '@/ui/EmptyState';
import { usePagedList } from '@/ui/Pagination';
import { SegmentedControl } from '@/ui/SegmentedControl';

type ListFilter = 'upcoming' | 'all';

export function DayList({
  date,
  columns,
  bookingsByColumn,
  clientsById,
  services,
  toneOf,
  showPhones,
  onOpen,
  groupEventsByColumn = {},
  participantCountByEvent = {},
  onOpenGroupEvent,
  className,
}: Pick<
  DayViewProps,
  | 'date'
  | 'columns'
  | 'bookingsByColumn'
  | 'clientsById'
  | 'services'
  | 'toneOf'
  | 'showPhones'
  | 'onOpen'
  | 'groupEventsByColumn'
  | 'participantCountByEvent'
  | 'onOpenGroupEvent'
  | 'className'
>) {
  const t = useT('journal');
  const locale = useLocale();
  const format = useFormat({ hourCycle: useJournalHourFormat() });
  const label = useColumnLabel();
  const isToday = date === today();
  const nowMin = useNowMinute(isToday);
  const [filter, setFilter] = useState<ListFilter>('upcoming');

  // Ресурсный вид кладёт запись в каждую колонку её ресурсов — в списке она одна. Групповые занятия — строками среди записей
  type Row = { kind: 'booking'; item: Booking; column: ColumnDef } | { kind: 'event'; item: GroupEvent; column: ColumnDef };
  const seen = new Set<Id>();
  const all: Row[] = [];
  for (const column of columns) {
    for (const b of withoutParticipants(bookingsByColumn[column.id] ?? [], groupEventsByColumn[column.id])) {
      if (seen.has(b.id)) continue;
      seen.add(b.id);
      all.push({ kind: 'booking', item: b, column });
    }
    for (const ev of groupEventsByColumn[column.id] ?? []) all.push({ kind: 'event', item: ev, column });
  }
  const order = new Map(columns.map((c, i) => [c.id, i]));
  all.sort((a, b) => a.item.start.localeCompare(b.item.start) || (order.get(a.column.id) ?? 0) - (order.get(b.column.id) ?? 0));

  const isPast = (r: Row) => nowMin !== null && startMinutes(r.item) + r.item.durationMin <= nowMin;
  const pastCount = all.filter(isPast).length;
  const canFilter = isToday && pastCount > 0 && pastCount < all.length;
  const effectiveFilter: ListFilter = canFilter ? filter : 'all';
  const rows = effectiveFilter === 'upcoming' ? all.filter((b) => !isPast(b)) : all;
  const { pageItems, pager } = usePagedList(rows, { resetKey: `${date}:${effectiveFilter}` });
  // Черта «Сейчас» — перед первой записью, которая ещё не закончилась (только в «Все»)
  const firstUpcomingId = effectiveFilter === 'all' && isToday && pastCount > 0 ? all.find((r) => !isPast(r))?.item.id : undefined;

  const servicesById = new Map<Id, Service>(services.map((s) => [s.id, s]));

  // «Оплачено» по записям дня — одним запросом на весь день, из финансов (тот же источник, что окно оплаты и касса;
  // journal.md: раньше — extras журнала, второй источник). Оплачено = сумма записи − остаток к оплате
  const bookingRows = all.flatMap((r) => (r.kind === 'booking' ? [r.item] : []));
  const bookingIds = bookingRows.map((b) => b.id);
  const paymentsQuery = useApiQuery([...LIST_EXTRAS_KEY, date, bookingIds.join(',')], () => listDayPayments(bookingRows), {
    enabled: bookingIds.length > 0,
  });
  const paidOf = (b: Booking) => {
    const brief = paymentsQuery.data?.[b.id];
    return brief ? Math.max(0, b.total - brief.due) : 0;
  };
  const actions = useDayListActions();

  return (
    <div className={cn('flex min-h-0 flex-col', className)}>
      <div
        data-f="F-01-018 F-01-022"
        aria-label={t('board.layout.list')}
        className="scrollbar-thin min-h-0 flex-1 overflow-auto overscroll-contain rounded-2xl border border-border bg-surface pb-24 md:pb-0"
      >
        <div className="sticky top-0 z-10 flex min-h-14 flex-wrap items-center justify-between gap-2 border-b border-border bg-surface px-4 py-2">
          <p className="text-sm text-muted">
            <b className="font-bold text-fg tabular-nums">{format.number(rows.length)}</b> {t('board.totals.bookings', { n: rows.length })}
          </p>
          {canFilter && (
            <SegmentedControl
              size="sm"
              aria-label={t('board.list.filter')}
              value={effectiveFilter}
              onValueChange={(v) => setFilter(v as ListFilter)}
              options={[
                { value: 'upcoming', label: t('board.list.upcoming', { n: all.length - pastCount }) },
                { value: 'all', label: t('board.list.all', { n: all.length }) },
              ]}
            />
          )}
        </div>

        {rows.length === 0 ? (
          <EmptyState className="py-16" title={all.length === 0 ? t('board.list.empty') : t('board.list.emptyUpcoming')} />
        ) : (
          <ul className="flex flex-col">
            {pageItems.map((row) => {
              const b = row.item;
              const past = isPast(row);
              const ongoing = !past && nowMin !== null && startMinutes(b) <= nowMin;
              const staff = row.column.kind === 'staff' ? row.column.staff : undefined;
              const who = label(row.column).name;
              const end = fromMinutes(startMinutes(b) + b.durationMin);
              const lines = row.kind === 'booking' ? row.item.services.map((line) => line.serviceId) : [row.item.serviceId];
              const serviceNames = lines
                .map((id) => servicesById.get(id))
                .filter((s): s is Service => Boolean(s))
                .map((s) => pickText(s.name, locale))
                .join(', ');
              const client = row.kind === 'booking' && row.item.clientId ? clientsById[row.item.clientId] : undefined;
              const title =
                row.kind === 'event'
                  ? t('board.layout.groupEvent')
                  : (client?.name ?? row.item.visitorName ?? t('board.list.noClient'));
              const phone = showPhones ? client?.phone : undefined;
              const open = () => (row.kind === 'booking' ? onOpen(b.id) : onOpenGroupEvent?.(b.id));
              return (
                <li
                  key={b.id}
                  data-past={past || undefined}
                  className={cn('border-b border-line last:border-b-0', past && 'bg-surface-3/60')}
                >
                  {b.id === firstUpcomingId && (
                    <div role="separator" className="flex items-center gap-2 bg-surface px-4 pt-2 text-xs font-bold text-danger">
                      {t('board.list.now', { time: format.time(`${date}T${fromMinutes(nowMin ?? 0)}`) })}
                      <span aria-hidden className="h-0.5 flex-1 rounded-full bg-danger" />
                    </div>
                  )}
                  {/* Строка открывает окно записи «растянутой» кнопкой под содержимым: кнопки действий лежат рядом с ней,
                      а не внутри (кнопка в кнопке — недопустимый HTML, и клик по «Пришёл» открывал бы окно) */}
                  <div className="relative" data-booking={row.kind === 'booking' ? b.id : undefined}>
                    <button
                      type="button"
                      data-list-open=""
                      aria-label={t('board.list.openAria', { time: format.time(b.start), name: title })}
                      onClick={open}
                      className={cn(
                        'absolute inset-0 w-full transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus',
                        past ? 'hover:bg-surface-3' : 'hover:bg-surface-2',
                      )}
                    />
                    <div className="pointer-events-none relative grid grid-cols-[4.5rem_minmax(0,1fr)] items-start gap-x-3 gap-y-1.5 px-4 py-3 md:grid-cols-[5.5rem_minmax(0,1fr)_auto] xl:grid-cols-[5.5rem_minmax(0,1fr)_10rem_9.5rem_5.5rem_14rem] xl:items-center">
                      <span className="row-span-4 flex flex-col tabular-nums md:row-span-3 xl:row-span-1">
                        <b className={cn('text-base font-bold', past ? 'text-muted' : 'text-fg')}>{format.time(b.start)}</b>
                        <span className="text-xs text-muted">–{format.time(`${date}T${end}`)}</span>
                        {past ? (
                          <span className="mt-1 inline-flex items-center gap-1 self-start rounded-full bg-surface px-1.5 py-0.5 text-xs font-semibold text-muted ring-1 ring-border">
                            <CheckCheck aria-hidden className="size-3" />
                            {t('board.list.past')}
                          </span>
                        ) : ongoing ? (
                          <span className="mt-1 inline-flex items-center gap-1 self-start rounded-full bg-primary-soft px-1.5 py-0.5 text-xs font-semibold text-primary-text">
                            <span aria-hidden className="size-1.5 rounded-full bg-primary" />
                            {t('board.list.ongoing')}
                          </span>
                        ) : null}
                      </span>
                      <span className="flex min-w-0 items-start gap-2.5">
                        <span
                          aria-hidden
                          className={cn(
                            'mt-1 h-8 w-1 shrink-0 rounded-full',
                            row.kind === 'event' && 'border border-dashed border-border-strong',
                            past && 'opacity-40',
                          )}
                          style={row.kind === 'booking' ? { background: toneOf(row.item).drop } : undefined}
                        />
                        <span className="flex min-w-0 flex-col">
                          <span className={cn('truncate font-semibold', past ? 'text-muted' : 'text-fg')}>{title}</span>
                          <span className="truncate text-sm text-muted">
                            {phone && <span className="tabular-nums">{format.phone(phone)} · </span>}
                            {serviceNames}
                          </span>
                        </span>
                      </span>
                      <span className="col-start-2 flex min-w-0 items-center gap-2 xl:col-start-auto">
                        {staff && <Avatar name={staff.name} src={staff.avatarUrl} colorIndex={staff.colorIndex} size="xs" />}
                        <span className={cn('truncate text-sm', past ? 'text-muted' : 'text-fg')}>{who}</span>
                      </span>
                      <span className="col-start-2 flex items-center justify-between gap-2 md:justify-start md:gap-4 xl:col-start-auto xl:contents">
                        {row.kind === 'booking' ? (
                          <BookingStatusBadge status={row.item.status} size="sm" className="justify-self-start" />
                        ) : (
                          <Badge size="sm" className="justify-self-start">
                            {t('board.list.participants', { n: participantCountByEvent[b.id] ?? 0, cap: row.item.capacity })}
                          </Badge>
                        )}
                        <span className={cn('text-sm font-semibold tabular-nums xl:text-right', past ? 'text-muted' : 'text-fg')}>
                          {row.kind === 'booking' ? format.money(row.item.total) : null}
                        </span>
                      </span>
                      <span className="col-start-2 md:col-start-3 md:row-span-3 md:row-start-1 md:self-center xl:col-start-auto xl:row-span-1 xl:row-start-auto">
                        {row.kind === 'booking' && (
                          <DayListRowActions
                            booking={row.item}
                            name={title}
                            phone={phone}
                            paid={paidOf(row.item)}
                            canArrive={date <= today()}
                            api={actions}
                            onOpen={open}
                          />
                        )}
                      </span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <div className="px-4 pb-4">{pager}</div>
      </div>
    </div>
  );
}

/** Сводки оплат записей дня — по бизнесу записи (у сети в одном дне бывают записи разных филиалов) */
async function listDayPayments(bookings: Booking[]): Promise<Record<Id, BookingPaymentBrief>> {
  const byBusiness = new Map<Id, Id[]>();
  for (const b of bookings) byBusiness.set(b.businessId, [...(byBusiness.get(b.businessId) ?? []), b.id]);
  const parts = await Promise.all([...byBusiness].map(([businessId, ids]) => listBookingPaymentSummaries(businessId, ids)));
  return Object.assign({}, ...parts);
}
