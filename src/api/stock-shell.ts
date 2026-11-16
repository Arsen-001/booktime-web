'use client';

/**
 * Склад — лёгкий вход для каркаса кабинета (07.10.2026, скорость): «Заканчивается» и сроки годности в колокольчике
 * (⭐ F-00-137) есть на каждой странице /biz. В режиме api — запрос к серверу; в демо полный '@/api/stock'
 * догружается отдельным куском (viaMock). Без этого каждая страница кабинета тянула весь API склада и финансов.
 * Те же имена реэкспортирует '@/api/stock' — разделы импортируют оттуда, как раньше.
 */
import { isApiMode } from '@/api/http';
import { viaMock } from '@/api/request';
import type { Id } from '@/domain/core';
import type { StockReminder } from '@/domain/stock';

const stock = () => import('@/api/stock');

export interface StockBellAlert {
  /** Стабильный id группы + «отпечаток» товаров: новый товар ниже минимума делает строку снова непрочитанной */
  id: string;
  kind: 'lowStock' | 'expiring';
  count: number;
  names: string[];
  href: string;
  unread: boolean;
}

/** Прочитанные строки колокольчика (id с отпечатком) — в памяти вкладки; мок — ещё и в срезе */
const bellSeenMemory = new Set<string>();

export async function listStockBellAlerts(businessId: Id, locationId: Id): Promise<StockBellAlert[]> {
  const [reminders, stored] = isApiMode()
    ? [await import('@/api/stock.server').then((Server) => Server.listReminders(businessId, locationId)), [] as string[]]
    : await viaMock(stock, (m) => Promise.all([m.listReminders(businessId, locationId), m.listStockBellSeenMock(businessId)]));
  const seen = new Set<string>([...bellSeenMemory, ...stored]);
  const group = (kind: StockBellAlert['kind'], items: StockReminder[], href: string): StockBellAlert | undefined => {
    if (!items.length) return undefined;
    const id = `stock_${kind}_${locationId}:${items.map((r) => r.id).sort().join(',')}`;
    return { id, kind, count: items.length, names: items.map((r) => r.title), href, unread: !seen.has(id) };
  };
  return [
    group('lowStock', reminders.filter((r) => r.kind === 'lowStock'), '/biz/stock/order'),
    group('expiring', reminders.filter((r) => r.kind === 'expired' || r.kind === 'expiring'), '/biz/stock/reminders'),
  ].filter((a): a is StockBellAlert => Boolean(a));
}

export function markStockBellAlertsRead(businessId: Id, ids: string[]): Promise<void> {
  ids.forEach((id) => bellSeenMemory.add(id));
  if (isApiMode()) return Promise.resolve();
  return viaMock(stock, (m) => m.markStockBellSeenMock(businessId, ids));
}
