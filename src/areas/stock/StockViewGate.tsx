'use client';

/**
 * Владелец 17.11.2026 (ответ 17): сотрудник с правом только «смотреть склад» (stock.view без stock.edit, обычно мастер)
 * видит только товары и остатки — без операций, отчётов склада, «Покупок клиентов», инвентаризаций и сумм салона.
 * Пункты меню скрыты в nav.ts; здесь закрыт и прямой адрес (тот же экран «Нет прав», что у форм склада).
 * Открыто всем со stock.view: «Товары» (/biz/stock), карточка товара и свои напоминания. Сервер закрывает те же данные
 * (booktime-backend stock.controller.ts / stock-ext.controller.ts).
 */
import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { StockAccessGate } from '@/areas/stock/StockAccessGate';

const VIEW_ONLY_PATHS = [/^\/biz\/stock\/?$/, /^\/biz\/stock\/goods\/(?!new)[^/]+\/?$/, /^\/biz\/stock\/reminders(\/|$)/];

export function StockViewGate({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? '';
  if (VIEW_ONLY_PATHS.some((re) => re.test(pathname))) return <>{children}</>;
  return <StockAccessGate need="stock.edit">{children}</StockAccessGate>;
}
