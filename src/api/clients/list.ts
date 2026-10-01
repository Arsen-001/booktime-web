'use client';

/** Список клиентов (arch-a1 №1): поиск, подборки, фильтры, сортировка, страница — одним запросом; колонки таблицы сотрудника. */
import type { ClientColumnId, ClientRow, ClientListPage, ClientListQuery, ColumnsPrefs, QuickPickId } from '@/domain/clients';
import {
  CLIENT_COLUMN_IDS,
  DEFAULT_CLIENTS_SORT,
  MAX_PINNED_COLUMNS,
  defaultColumnsPrefs,
  matchesFilters,
  matchesPick,
  matchesSearch,
  sortByDue,
  sortClientRows,
} from '@/domain/clients';
import type { Id } from '@/domain/core';
import * as C from '@/api/clients/clients.server';
import { isApiMode } from '@/api/http';
import { readArea, mutateArea } from '@/api/area';
import { ApiError, request } from '@/api/request';
import { businessIdsFor, rowsFor, filterContext, bizSettings } from '@/api/clients/shared';

const QUICK_PICKS: QuickPickId[] = ['due', 'new', 'repeat', 'lost', 'subscriptionEnding', 'noShow', 'chatLeads'];

/**
 * Список клиентов (F-04-001…035, F-04-157, F-04-199): поиск, подборка, конструктор фильтров, сортировка и страница —
 * здесь, одним запросом; экран получает готовую страницу и числа на чипах (arch-a1 №1).
 */
export function listClients(query: ClientListQuery): Promise<ClientListPage> {
  if (isApiMode()) return C.listClients(query);
  return request(() => {
    const businessIds = businessIdsFor(query.businessId, query.locationIds);
    const settings = bizSettings(query.businessId);
    const ctx = filterContext(businessIds, settings.lostAfterDays);
    let base = rowsFor(businessIds);
    // F-04-199: без права «все клиенты» мастер видит только тех, у кого был свой визит
    if (query.onlyStaffId) {
      const own = new Set(ctx.bookings.filter((b) => b.staffId === query.onlyStaffId).map((b) => b.clientId));
      base = base.filter((r) => own.has(r.id));
    }
    const pickCounts = Object.fromEntries(QUICK_PICKS.map((p) => [p, base.filter((r) => matchesPick(r, p, ctx)).length])) as Record<QuickPickId, number>;
    let found = base;
    if (query.search?.trim()) found = found.filter((r) => matchesSearch(r, query.search!));
    if (query.pick) found = found.filter((r) => matchesPick(r, query.pick!, ctx));
    if (query.filters) found = found.filter((r) => matchesFilters(r, query.filters!, ctx));
    // ⭐ «Пора записать» без выбранной колонки — самые просроченные первыми; выбрал колонку — как выбрал
    found = !query.sort && query.pick === 'due' ? sortByDue(found) : sortClientRows(found, query.sort ?? DEFAULT_CLIENTS_SORT);
    const pageSize = Math.max(1, query.pageSize);
    const lastPage = Math.max(1, Math.ceil(found.length / pageSize));
    const revealIndex = query.revealId ? found.findIndex((r) => r.id === query.revealId) : -1;
    const page = revealIndex >= 0 ? Math.floor(revealIndex / pageSize) + 1 : Math.min(Math.max(1, query.page), lastPage);
    return {
      rows: found.slice((page - 1) * pageSize, page * pageSize),
      total: found.length,
      baseTotal: base.length,
      ids: found.map((r) => r.id),
      pickCounts,
      page,
    };
  });
}

/** Все клиенты бизнеса строками (для окна записи, импорта, объединения — там, где нужен весь список) */
export function listClientRows(businessId: Id): Promise<ClientRow[]> {
  if (isApiMode()) return C.listClientRows(businessId);
  return request(() => rowsFor([businessId]));
}

/**
 * Сколько клиентов подойдёт под черновик фильтров (ux-r5 «Показать N клиентов») — синхронно, без
 * симулированной задержки `request()`, чтобы счётчик в кнопке «Показать» обновлялся на каждый чип/поле.
 */
export function countClientsMatching(query: { businessId: Id; locationIds?: Id[]; filters: ClientListQuery['filters'] }): number {
  const businessIds = businessIdsFor(query.businessId, query.locationIds);
  const settings = bizSettings(query.businessId);
  const ctx = filterContext(businessIds, settings.lostAfterDays);
  const base = rowsFor(businessIds);
  if (!query.filters) return base.length;
  return base.filter((r) => matchesFilters(r, query.filters!, ctx)).length;
}

// ─────────────────────────── Настройки таблицы (F-04-004, F-04-005) ───────────────────────────

/** Колонки таблицы — свои у каждого сотрудника бизнеса (arch-a1 №2) */
function columnsKey(businessId: Id, staffId: Id | undefined): string {
  return `${businessId}|${staffId ?? '-'}`;
}

function readColumns(businessId: Id, staffId: Id | undefined): ColumnsPrefs {
  return readArea('clients').columns[columnsKey(businessId, staffId)] ?? defaultColumnsPrefs();
}

export function getColumnsPrefs(businessId: Id, staffId?: Id): Promise<ColumnsPrefs> {
  if (isApiMode()) return C.getColumnsPrefs(businessId, staffId);
  return request(() => readColumns(businessId, staffId));
}

export function setVisibleColumns(input: { businessId: Id; staffId?: Id; visible: ClientColumnId[] }): Promise<ColumnsPrefs> {
  if (isApiMode()) return C.setVisibleColumns(input);
  return request(() => {
    const key = columnsKey(input.businessId, input.staffId);
    const current = readColumns(input.businessId, input.staffId);
    const visible = CLIENT_COLUMN_IDS.filter((id) => id === 'name' || input.visible.includes(id));
    const next: ColumnsPrefs = { visible, pinned: current.pinned.filter((id) => visible.includes(id)) };
    mutateArea('clients', (s) => {
      s.columns[key] = next;
    });
    return next;
  });
}

/** Закрепить/открепить колонку — не больше 5 (F-04-005) */
export function togglePinnedColumn(input: { businessId: Id; staffId?: Id; id: ClientColumnId }): Promise<ColumnsPrefs> {
  if (isApiMode()) return C.togglePinnedColumn(input);
  return request(() => {
    const key = columnsKey(input.businessId, input.staffId);
    const current = readColumns(input.businessId, input.staffId);
    if (!current.pinned.includes(input.id) && current.pinned.length >= MAX_PINNED_COLUMNS) {
      throw new ApiError('pin_limit', `Нельзя закрепить больше ${MAX_PINNED_COLUMNS} колонок`);
    }
    const pinned = current.pinned.includes(input.id) ? current.pinned.filter((x) => x !== input.id) : [...current.pinned, input.id];
    const next: ColumnsPrefs = { ...current, pinned };
    mutateArea('clients', (s) => {
      s.columns[key] = next;
    });
    return next;
  });
}
