import 'server-only';
import { cookies } from 'next/headers';
import { DATA_COOKIE, resolveDataMode } from '@/api/mode';
import type { PublicOrder } from '@/domain/orders';
import { normalizeEstimate, toLocalDateTime } from '@/areas/orders/lib/serverTime';

/**
 * Публичный статус заказа для первой отрисовки /o/<code> на сервере (только режим api: в моке данные живут в браузере).
 * Без кэша — статус меняется в любую минуту. Сервер недоступен или «нет такого» — undefined: экран дочитает сам.
 */
const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4010').replace(/\/$/, '');

async function requestIsApi(): Promise<boolean> {
  if (process.env.NEXT_PUBLIC_DATA === 'api') return true;
  if (process.env.NODE_ENV !== 'development') return false;
  return resolveDataMode((await cookies()).get(DATA_COOKIE)?.value) === 'api';
}

export async function fetchPublicOrder(code: string): Promise<PublicOrder | undefined> {
  if (!(await requestIsApi())) return undefined;
  try {
    // X-BT-SSR (как src/lib/seo/publicData.ts): все посетители приходят к API с адресов Vercel — без него первая
    // отрисовка /o/<code> у всех делила бы один лимит по IP (60 в минуту)
    const secret = process.env.SSR_SHARED_SECRET?.trim();
    const res = await fetch(`${API_URL}/v1/public/orders/${encodeURIComponent(code)}`, {
      headers: { Accept: 'application/json', ...(secret && { 'X-BT-SSR': secret }) },
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return undefined;
    const data = (await res.json()) as PublicOrder;
    return { ...data, dueDate: data.dueDate ? data.dueDate.slice(0, 10) : null, readyAt: toLocalDateTime(data.readyAt), estimate: normalizeEstimate(data.estimate ?? null) };
  } catch {
    return undefined;
  }
}
