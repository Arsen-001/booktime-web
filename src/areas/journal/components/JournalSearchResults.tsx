'use client';

/**
 * Поиск журнала (кнопка-лупа → «Клиенты и чат», ⭐ 29.09.2026): имя или часть номера — сразу записи этих клиентов,
 * сначала будущие (ближайшая первой), потом прошедшие (свежая первой), с датой, временем, мастером и статусом.
 * Клик — журнал переходит на день записи и открывает её окно. Совпавшие клиенты — строкой сверху (карточка клиента
 * с «Создать запись» и чатом, F-01-163). Ищет сервер (searchJournal: все клиенты бизнеса и их записи, скорость 17.11.2026 —
 * раньше браузер тянул все записи бизнеса, 350 КБ); поле само ждёт паузу в наборе (debounce в SearchInput), пока идёт
 * новый ответ — виден прежний.
 */
import { Fragment } from 'react';
import type { Id } from '@/domain/core';
import { coreList } from '@/api/core';
import { searchJournal } from '@/api/journal';
import { useApiQuery } from '@/api/request';
import { historyLimitDays, maskPhone, useJournalBlockRights, useJournalStaffScope } from '@/areas/journal/lib/rights';
import { useJournalHourFormat } from '@/areas/journal/lib/useJournalHourFormat';
import { isJournalSearchActive, parseJournalSearch, type JournalSearchBooking } from '@/domain/records';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { addDays, nowDateTime, today } from '@/lib/date';
import { BookingStatusBadge } from '@/ui/BookingStatusBadge';
import { EmptyState } from '@/ui/EmptyState';
import { usePagedList } from '@/ui/Pagination';
import { Skeleton } from '@/ui/Skeleton';

// Разбор запроса — в src/domain/records.ts (те же правила у мока и сервера); RightPanel берёт отсюда
export { isJournalSearchActive, parseJournalSearch };

/** Сколько совпавших клиентов показывать строками (записи — всех совпавших, по страницам) */
const CLIENTS_SHOWN = 4;

export function JournalSearchResults({
  businessId,
  query,
  onSelectClient,
  onOpenBooking,
}: {
  businessId: Id;
  query: string;
  onSelectClient: (c: { id: Id; name: string; phone: string }) => void;
  onOpenBooking: (query: Record<string, string>) => void;
}) {
  const t = useT('journal');
  const format = useFormat({ hourCycle: useJournalHourFormat() });
  // Права (F-01-178/180, qa/full-test-0930/journal-perms.md): без «чужих записей» — только свои записи, окно истории
  // и маска телефона — те же правила, что у сетки журнала (JournalScreen); свои записи и окно истории считает сервер
  const { ownOnlyStaffId } = useJournalStaffScope();
  const journalRights = useJournalBlockRights();
  const showPhones = journalRights.showPhones;
  const historyDays = historyLimitDays(journalRights.historyLimit);
  const q = { businessId, query, staffId: ownOnlyStaffId, from: historyDays === null ? undefined : addDays(today(), -historyDays), clientsLimit: CLIENTS_SHOWN };
  const searchQ = useApiQuery(['journal', 'search', q], () => searchJournal(q), { enabled: journalRights.ready });
  const staffQuery = useApiQuery(['journal', 'search-staff', businessId], () => coreList('staff', { businessId }));
  const staffName = new Map((staffQuery.data ?? []).map((s) => [s.id, s.name]));

  const clients = searchQ.data?.clients ?? [];
  const clientsTotal = searchQ.data?.clientsTotal ?? 0;
  const ordered = searchQ.data?.bookings ?? [];
  const now = nowDateTime();
  const { pageItems, pager } = usePagedList(ordered, { resetKey: query });
  const firstRecentId = ordered.find((b) => b.start < now)?.id;
  const upcomingCount = searchQ.data?.upcoming ?? 0;

  if (searchQ.isLoading || !journalRights.ready) return <Skeleton lines={4} />;
  if (clients.length === 0) return <EmptyState kind="search" compact />;

  const row = (b: JournalSearchBooking) => {
    const day = b.start.slice(0, 10);
    const past = b.start < now;
    return (
      <li>
        <button
          type="button"
          data-search-booking=""
          data-date={day}
          onClick={() => onOpenBooking({ booking: b.id, date: day })}
          className="flex min-h-14 w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-surface-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
        >
          <span className="flex w-24 shrink-0 flex-col tabular-nums">
            <b className={past ? 'text-sm font-semibold text-muted' : 'text-sm font-semibold text-fg'}>{format.relativeDay(day)}</b>
            <span className="text-xs text-muted">{format.time(b.start)}</span>
          </span>
          <span className="flex min-w-0 flex-1 flex-col items-start">
            <span className="max-w-full truncate text-sm font-medium text-fg">{b.clientName}</span>
            <span className="max-w-full truncate text-xs text-muted">{staffName.get(b.staffId) ?? ''}</span>
            {/* Узкая шторка телефона: статус — третьей строкой, иначе он съедает имя до «Арам …» */}
            <BookingStatusBadge status={b.status} size="sm" className="mt-1 sm:hidden" />
          </span>
          <BookingStatusBadge status={b.status} size="sm" className="hidden shrink-0 sm:inline-flex" />
        </button>
      </li>
    );
  };

  return (
    <div data-f="F-01-163" className={searchQ.isPlaceholderData ? 'flex flex-col gap-4 opacity-60 transition-opacity' : 'flex flex-col gap-4'}>
      <ul aria-label={t('rightPanel.search.clients')} className="flex flex-col gap-1">
        {clients.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => onSelectClient({ id: c.id, name: c.name, phone: c.phone })}
              className="flex min-h-10 w-full items-center justify-between gap-2 rounded-lg px-2 text-left text-sm hover:bg-surface-2"
            >
              <span className="truncate font-medium text-fg">{c.name}</span>
              <span className="shrink-0 text-muted tabular-nums">{showPhones ? format.phone(c.phone) : maskPhone(c.phone)}</span>
            </button>
          </li>
        ))}
        {clientsTotal > clients.length && (
          <li className="px-2 text-xs text-muted">{t('rightPanel.search.moreClients', { n: clientsTotal - clients.length })}</li>
        )}
      </ul>

      <section className="flex flex-col gap-1 border-t border-border pt-3">
        <h3 className="px-2 text-xs font-semibold text-muted">
          {t('rightPanel.search.bookings', { upcoming: upcomingCount, recent: searchQ.data?.recent ?? 0 })}
        </h3>
        {ordered.length === 0 ? (
          <EmptyState compact title={t('rightPanel.search.noBookings')} />
        ) : (
          <ul className="flex flex-col gap-0.5">
            {pageItems.map((b) => (
              <Fragment key={b.id}>
                {b.id === firstRecentId && upcomingCount > 0 && (
                  <li role="separator" className="mt-2 border-t border-line px-2 pt-2 text-xs font-semibold text-muted">
                    {t('rightPanel.search.recent')}
                  </li>
                )}
                {row(b)}
              </Fragment>
            ))}
          </ul>
        )}
        {pager}
      </section>
    </div>
  );
}
