/**
 * Режим данных: `api` — настоящий сервер, `mock` — моковая база в браузере (демо-сборка, PLAN.md Р15).
 * Без импортов: файл читает и src/proxy.ts (сервер Next), и браузер.
 */
export type DataMode = 'api' | 'mock';

/** Cookie переключателя режима при разработке (ставит src/proxy.ts по ?data=) */
export const DATA_COOKIE = 'bt_data';
/** Cookie сессии сервера (httpOnly — прочесть нельзя, но proxy.ts видит, есть ли она) */
/** Суффикс имён cookie сервера — как COOKIE_SUFFIX на сервере (staging: _stg), иначе cookie staging и production путаются на общем домене */
const COOKIE_SUFFIX = process.env.NEXT_PUBLIC_COOKIE_SUFFIX ?? '';
export const SESSION_COOKIE = `bt_session${COOKIE_SUFFIX}`;
export const PLATFORM_COOKIE = `bt_platform${COOKIE_SUFFIX}`;

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
