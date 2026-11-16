/**
 * HTTP-клиент настоящего сервера (booktime-backend, docs/backend/PLAN.md §7). Фасады src/api/* зовут его
 * в режиме `api` и работают с моковой базой в режиме `mock` (демо-сборка, Р15) — экран видит тот же тип ответа.
 *
 *   NEXT_PUBLIC_DATA=api|mock      — режим сборки (по умолчанию mock)
 *   NEXT_PUBLIC_API_URL            — адрес сервера (по умолчанию http://localhost:4010)
 *   ?data=api / ?data=mock         — только при разработке: переключить режим без пересборки (cookie bt_data)
 *
 * Сессия — httpOnly cookie сервера (credentials: 'include'); ошибки — { code } → ApiError(code), как у мока.
 */
import { dataMode } from '@/api/mode';
import { ApiError } from '@/api/request';

export { dataMode };

export function isApiMode(): boolean {
  return dataMode() === 'api';
}

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4010').replace(/\/$/, '');

/** Ошибка сервера: code — как у мока; retryAfter — секунд до повтора (код, лимиты) */
export class HttpApiError extends ApiError {
  readonly status: number;
  readonly retryAfter?: number;
  readonly fields?: Record<string, string>;
  constructor(status: number, code: string, message?: string, retryAfter?: number, fields?: Record<string, string>) {
    super(code, message);
    this.status = status;
    this.retryAfter = retryAfter;
    this.fields = fields;
  }
}

export interface HttpOptions {
  /** Версия для оптимистичной блокировки (If-Match) */
  version?: number;
  /** Idempotency-Key — повтор с тем же ключом вернёт первый ответ */
  idempotencyKey?: string;
  query?: Record<string, string | number | boolean | undefined>;
}

interface RawResponse {
  status: number;
  ok: boolean;
  text: string;
}

/**
 * Одинаковые GET, идущие одновременно, — один запрос к серверу (только в браузере: на сервере Next ответы разных
 * людей делить нельзя). Экран журнала спрашивал настройки журнала 8 раз за одно открытие — разные блоки читают их
 * под своими ключами (проход кабинета 17.11.2026). Любая запись (не GET) начинает новое «поколение»: чтение после
 * правки не получит ответ, начатый до неё. Тело разбирается каждому заново — общий объект никто не испортит.
 */
const inflightGets = new Map<string, Promise<RawResponse>>();
let writeGeneration = 0;

async function send(url: URL, init: RequestInit): Promise<RawResponse> {
  const res = await fetch(url, init);
  return { status: res.status, ok: res.ok, text: res.status === 204 ? '' : await res.text() };
}

/** Вызов сервера: http('POST', '/v1/auth/code', { phone }) → тело ответа (204 → undefined) */
export async function http<T>(method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', path: string, body?: unknown, opts: HttpOptions = {}): Promise<T> {
  const url = new URL(API_URL + path);
  for (const [k, v] of Object.entries(opts.query ?? {})) if (v !== undefined) url.searchParams.set(k, String(v));
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (opts.version !== undefined) headers['If-Match'] = String(opts.version);
  if (opts.idempotencyKey) headers['Idempotency-Key'] = opts.idempotencyKey;
  const init: RequestInit = {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'include',
    cache: 'no-store',
  };
  let res: RawResponse;
  try {
    if (method !== 'GET') writeGeneration++;
    if (method === 'GET' && typeof window !== 'undefined') {
      const key = `${writeGeneration}|${url.toString()}`;
      let pending = inflightGets.get(key);
      if (!pending) {
        pending = send(url, init).finally(() => inflightGets.delete(key));
        inflightGets.set(key, pending);
      }
      res = await pending;
    } else {
      res = await send(url, init);
    }
  } catch {
    throw new HttpApiError(0, 'network', 'Server is unreachable');
  }
  if (res.status === 204) return undefined as T;
  const text = res.text;
  const data: unknown = text ? JSON.parse(text) : undefined;
  if (!res.ok) {
    const err = (data ?? {}) as { code?: string; message?: string; retryAfter?: number; fields?: Record<string, string> };
    throw new HttpApiError(res.status, err.code ?? 'internal', err.message, err.retryAfter, err.fields);
  }
  return data as T;
}
