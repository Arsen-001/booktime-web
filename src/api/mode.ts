/**
 * Режим данных: `api` — настоящий сервер, `mock` — моковая база в браузере (демо-сборка, PLAN.md Р15).
 * Без импортов: файл читает и src/proxy.ts (сервер Next), и браузер.
 */
export type DataMode = 'api' | 'mock';

/** Cookie переключателя режима при разработке (ставит src/proxy.ts по ?data=) */
export const DATA_COOKIE = 'bt_data';
/** Cookie сессии сервера (httpOnly — прочесть нельзя, но proxy.ts видит, есть ли она) */
export const SESSION_COOKIE = 'bt_session';
export const PLATFORM_COOKIE = 'bt_platform';

function readCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const pair = document.cookie.split('; ').find((p) => p.startsWith(`${name}=`));
  return pair ? decodeURIComponent(pair.slice(name.length + 1)) : undefined;
}

/** Режим данных по env сборки и (при разработке) cookie — одна функция для браузера и proxy.ts */
export function resolveDataMode(cookieValue: string | undefined): DataMode {
  if (process.env.NEXT_PUBLIC_DATA === 'api') return 'api';
  if (process.env.NODE_ENV === 'development' && cookieValue === 'api') return 'api';
  return 'mock';
}

/** Текущий режим в браузере. На сервере Next — режим сборки. */
export function dataMode(): DataMode {
  return resolveDataMode(readCookie(DATA_COOKIE));
}
