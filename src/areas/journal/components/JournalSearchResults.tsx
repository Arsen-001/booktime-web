'use client';

/**
 * Поиск журнала (кнопка-лупа → «Клиенты и чат», ⭐ 29.09.2026): имя или часть номера — сразу записи этих клиентов,
 * сначала будущие (ближайшая первой), потом прошедшие (свежая первой), с датой, временем, мастером и статусом.
 * Клик — журнал переходит на день записи и открывает её окно. Совпавшие клиенты — строкой сверху (карточка клиента
 * с «Создать запись» и чатом, F-01-163). Ищем в уже загруженных клиентах и записях салона — без запроса на каждую букву;
 * поле само ждёт паузу в наборе (debounce в SearchInput).
 */
import { Fragment } from 'react';
import type { Booking, Client, Id } from '@/domain/core';
import { coreList, listBookings } from '@/api/core';
import { useApiQuery } from '@/api/request';
import { isBeyondHistoryLimit, maskPhone, useJournalBlockRights, useJournalStaffScope } from '@/areas/journal/lib/rights';
import { useJournalHourFormat } from '@/areas/journal/lib/useJournalHourFormat';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { nowDateTime, today } from '@/lib/date';
import { localDigits } from '@/lib/phone';
import { normalizeSearch } from '@/lib/text';
import { BookingStatusBadge } from '@/ui/BookingStatusBadge';
import { EmptyState } from '@/ui/EmptyState';
import { usePagedList } from '@/ui/Pagination';
import { Skeleton } from '@/ui/Skeleton';

/** Сколько совпавших клиентов показывать строками (записи — всех совпавших, по страницам) */
const CLIENTS_SHOWN = 4;

/** Запрос → что сравнивать: слова имени (без регистра и ё) и цифры номера (без кода страны) */
export function parseJournalSearch(query: string): { text: string; digits: string } {
  const raw = query.replace(/\D/g, '');
  const digits = raw.startsWith('374') && raw.length > 3 ? raw.slice(3) : raw.startsWith('0') && raw.length > 1 ? raw.slice(1) : raw;
  const text = /\p{L}/u.test(query) ? normalizeSearch(query) : '';
  return { text, digits: digits.length >= 2 ? digits : '' };
}

export function isJournalSearchActive(query: string): boolean {
  const { text, digits } = parseJournalSearch(query);
  return text.length >= 2 || digits.length >= 2;
}

function matchClient(c: Client, text: string, digits: string): boolean {
  if (digits && localDigits(c.phone).includes(digits)) return true;
  if (text.length < 2) return false;
  const name = normalizeSearch(c.name);
  // Каждое слово запроса — в имени: «арам кар» находит «Арам Карамян»
  return text.split(/\s+/).every((w) => name.includes(w));
}

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
  // Ключ клиентов — тот же, что у журнала: список уже в кэше, первый символ не ждёт «сервера»
  const clientsQuery = useApiQuery(['journal', 'clients', businessId], () => coreList('clients', { businessId }));
  const bookingsQuery = useApiQuery(['journal', 'search-bookings', businessId], () => listBookings({ businessId }));
  const staffQuery = useApiQuery(['journal', 'search-staff', businessId], () => coreList('staff', { businessId }));
  // Права (F-01-178/180, qa/full-test-0930/journal-perms.md): без «чужих записей» — только свои записи, окно истории
  // и маска телефона — те же правила, что у сетки журнала (JournalScreen), в mock и api режиме одинаково
  const { ownOnlyStaffId } = useJournalStaffScope();
  const journalRights = useJournalBlockRights();
  const showPhones = journalRights.showPhones;
  const todayIso = today();

  const { text, digits } = parseJournalSearch(query);
  // Сначала те, у кого слово имени начинается с запроса («Арам Есаян» раньше «Давид Карамян»)
  const rank = (c: Client) => (text && normalizeSearch(c.name).split(/\s+/).some((w) => w.startsWith(text.split(/\s+/)[0])) ? 0 : 1);
  const clients = (clientsQuery.data ?? []).filter((c) => matchClient(c, text, digits)).sort((a, b) => rank(a) - rank(b));
  const clientById = new Map(clients.map((c) => [c.id, c]));
  const staffName = new Map((staffQuery.data ?? []).map((s) => [s.id, s.name]));

  const now = nowDateTime();
  const found = (bookingsQuery.data ?? []).filter(
    (b) =>
      b.clientId &&
      clientById.has(b.clientId) &&
      !b.deletedAt &&
      !b.groupEventId &&
      (ownOnlyStaffId === undefined || b.staffId === ownOnlyStaffId) &&
      !isBeyondHistoryLimit(b.start.slice(0, 10), journalRights.historyLimit, todayIso),
  );
  // listBookings уже по возрастанию: будущие — как есть (ближайшая первой), прошедшие — с конца (свежая первой)
  const upcoming = found.filter((b) => b.start >= now);
  const recent = found.filter((b) => b.start < now).reverse();
  const ordered = [...upcoming, ...recent];
  const { pageItems, pager } = usePagedList(ordered, { resetKey: query });
  const firstRecentId = recent[0]?.id;

  if (clientsQuery.isLoading || bookingsQuery.isLoading || !journalRights.ready) return <Skeleton lines={4} />;
  if (clients.length === 0) return <EmptyState kind="search" compact />;

  const row = (b: Booking) => {
    const c = b.clientId ? clientById.get(b.clientId) : undefined;
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
            <span className="max-w-full truncate text-sm font-medium text-fg">{c?.name}</span>
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
    <div data-f="F-01-163" className="flex flex-col gap-4">
      <ul aria-label={t('rightPanel.search.clients')} className="flex flex-col gap-1">
        {clients.slice(0, CLIENTS_SHOWN).map((c) => (
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
        {clients.length > CLIENTS_SHOWN && (
          <li className="px-2 text-xs text-muted">{t('rightPanel.search.moreClients', { n: clients.length - CLIENTS_SHOWN })}</li>
        )}
      </ul>

      <section className="flex flex-col gap-1 border-t border-border pt-3">
        <h3 className="px-2 text-xs font-semibold text-muted">
          {t('rightPanel.search.bookings', { upcoming: upcoming.length, recent: recent.length })}
        </h3>
        {ordered.length === 0 ? (
          <EmptyState compact title={t('rightPanel.search.noBookings')} />
        ) : (
          <ul className="flex flex-col gap-0.5">
            {pageItems.map((b) => (
              <Fragment key={b.id}>
                {b.id === firstRecentId && upcoming.length > 0 && (
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
