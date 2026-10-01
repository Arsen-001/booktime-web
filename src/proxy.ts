import { NextResponse, type NextRequest } from 'next/server';
import { DATA_COOKIE, PLATFORM_COOKIE, SESSION_COOKIE, resolveDataMode } from '@/api/mode';
import { COOKIE_MAX_AGE, DEMO_COOKIES, DEMO_PARAMS, isValidDemoValue, type DemoSettings } from '@/demo/settings';

/**
 * Демо-параметры из адреса (?demo=owner&sphere=nails&lang=hy&theme=dark&font=large&api=error) —
 * это разовая команда: значения запоминаются в cookie, а браузер перенаправляется на тот же адрес
 * без этих параметров. Иначе параметр в адресе перебивал бы переключатель при каждом обновлении.
 */
export function proxy(request: NextRequest) {
  const url = request.nextUrl;

  // Разработка: ?data=api|mock — режим данных без пересборки (src/api/mode.ts)
  const dataParam = url.searchParams.get('data');
  if (process.env.NODE_ENV === 'development' && (dataParam === 'api' || dataParam === 'mock')) {
    const clean = url.clone();
    clean.searchParams.delete('data');
    const response = NextResponse.redirect(clean, 307);
    response.cookies.set(DATA_COOKIE, dataParam, { path: '/', maxAge: COOKIE_MAX_AGE, sameSite: 'lax' });
    return response;
  }

  // Живой сайт (PLAN.md §8.1–8.2): без сессии кабинет ведёт на вход, панель — на вход команды платформы.
  // Здесь видно только, есть ли cookie; истёкшую сессию ловит SessionBridge в браузере.
  if (resolveDataMode(request.cookies.get(DATA_COOKIE)?.value) === 'api') {
    const path = url.pathname;
    if (path.startsWith('/biz') && !request.cookies.has(SESSION_COOKIE)) {
      const login = new URL('/login', url);
      login.searchParams.set('next', path + url.search);
      return NextResponse.redirect(login, 307);
    }
    if (path.startsWith('/platform') && path !== '/platform/login' && !request.cookies.has(PLATFORM_COOKIE)) {
      return NextResponse.redirect(new URL('/platform/login', url), 307);
    }
  }

  const keys = Object.keys(DEMO_PARAMS) as (keyof DemoSettings)[];
  if (!keys.some((key) => url.searchParams.has(DEMO_PARAMS[key]))) return NextResponse.next();

  const clean = url.clone();
  const updates: [string, string][] = [];
  keys.forEach((key) => {
    const value = url.searchParams.get(DEMO_PARAMS[key]);
    clean.searchParams.delete(DEMO_PARAMS[key]);
    if (value !== null && isValidDemoValue(key, value)) updates.push([DEMO_COOKIES[key], value]);
  });

  const response = NextResponse.redirect(clean, 307);
  updates.forEach(([name, value]) =>
    response.cookies.set(name, value, { path: '/', maxAge: COOKIE_MAX_AGE, sameSite: 'lax' }),
  );
  return response;
}

export const config = {
  // Не трогаем статику, служебные адреса Next и API замеров
  matcher: ['/((?!_next/|favicon.ico|dev/health|dev/routes|.*\\.(?:png|jpg|jpeg|svg|webp|ico|woff2?)$).*)'],
};
