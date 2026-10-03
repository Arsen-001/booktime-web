import { NextResponse, type NextRequest } from 'next/server';
import { DATA_COOKIE, PLATFORM_COOKIE, SESSION_COOKIE, resolveDataMode } from '@/api/mode';
import { COOKIE_MAX_AGE, DEMO_COOKIES, DEMO_PARAMS, isValidDemoValue, type DemoSettings } from '@/demo/settings';
import { isLocale } from '@/i18n/config';
import { URL_LOCALE_HEADER, isLocalizablePath, localizedPath, splitLocalePrefix } from '@/i18n/localePath';

/**
 * Демо-параметры из адреса (?demo=owner&sphere=nails&lang=hy&theme=dark&font=large&api=error) —
 * это разовая команда: значения запоминаются в cookie, а браузер перенаправляется на тот же адрес
 * без этих параметров. Иначе параметр в адресе перебивал бы переключатель при каждом обновлении.
 */
export function proxy(request: NextRequest) {
  const url = request.nextUrl;

  // Диплинки приложений (booktime-mobile): /.well-known/apple-app-site-association и /.well-known/assetlinks.json
  // отдают маршруты src/app/well-known/* — папки с точкой в начале Next в маршруты не берёт
  if (url.pathname === '/.well-known/apple-app-site-association' || url.pathname === '/.well-known/assetlinks.json') {
    return NextResponse.rewrite(new URL(url.pathname.replace('/.well-known/', '/well-known/'), url));
  }

  // Разработка: ?data=api|mock — режим данных без пересборки (src/api/mode.ts)
  const dataParam = url.searchParams.get('data');
  if (process.env.NODE_ENV === 'development' && (dataParam === 'api' || dataParam === 'mock')) {
    const clean = url.clone();
    clean.searchParams.delete('data');
    const response = NextResponse.redirect(clean, 307);
    response.cookies.set(DATA_COOKIE, dataParam, { path: '/', maxAge: COOKIE_MAX_AGE, sameSite: 'lax' });
    return response;
  }

  // Язык в адресе (SEO, 03.10.2026, src/i18n/localePath.ts): /hy/…, /en/… — публичные страницы на этом языке
  const prefixed = splitLocalePrefix(url.pathname);
  const path = prefixed.pathname;

  // Живой сайт (PLAN.md §8.1–8.2): без сессии кабинет ведёт на вход, панель — на вход команды платформы.
  // Здесь видно только, есть ли cookie; истёкшую сессию ловит SessionBridge в браузере.
  if (resolveDataMode(request.cookies.get(DATA_COOKIE)?.value) === 'api') {
    if (path.startsWith('/biz') && !request.cookies.has(SESSION_COOKIE)) {
      const login = new URL('/login', url);
      login.searchParams.set('next', path + url.search);
      return NextResponse.redirect(login, 307);
    }
    if (path.startsWith('/platform') && path !== '/platform/login' && !request.cookies.has(PLATFORM_COOKIE)) {
      return NextResponse.redirect(new URL('/platform/login', url), 307);
    }
  }

  // На /search «sphere» — фильтр поиска (/search?sphere=nails с главной, адреса в sitemap — SEO 03.10.2026), а не
  // демо-сфера бизнеса: не забираем его в cookie и не перенаправляем (иначе страница сферы не индексируется)
  const keys = (Object.keys(DEMO_PARAMS) as (keyof DemoSettings)[]).filter((key) => !(key === 'sphere' && path === '/search'));
  if (!keys.some((key) => url.searchParams.has(DEMO_PARAMS[key]))) return prefixed.locale ? localeResponse(request, prefixed.locale, path) : NextResponse.next();

  const clean = url.clone();
  const updates: [string, string][] = [];
  keys.forEach((key) => {
    const value = url.searchParams.get(DEMO_PARAMS[key]);
    clean.searchParams.delete(DEMO_PARAMS[key]);
    if (value !== null && isValidDemoValue(key, value)) updates.push([DEMO_COOKIES[key], value]);
  });

  // ?lang= на странице с языком в адресе — сразу на адрес этого языка (иначе префикс перебил бы команду)
  const langParam = url.searchParams.get(DEMO_PARAMS.lang);
  if (prefixed.locale && isLocale(langParam)) clean.pathname = localizedPath(path, langParam);

  const response = NextResponse.redirect(clean, 307);
  updates.forEach(([name, value]) =>
    response.cookies.set(name, value, { path: '/', maxAge: COOKIE_MAX_AGE, sameSite: 'lax' }),
  );
  return response;
}

/**
 * /hy/<путь>, /en/<путь>: публичная страница — переписываем на /<путь> с языком в заголовке URL_LOCALE_HEADER
 * (сервер читает его раньше cookie) и запоминаем язык в cookie, чтобы дальше по приложению он сохранился.
 * Непубличная (/hy/biz, /hy/b/x/book) — перенаправляем на адрес без префикса, язык — тоже в cookie.
 */
function localeResponse(request: NextRequest, locale: string, path: string): NextResponse {
  const target = request.nextUrl.clone();
  target.pathname = path;
  let response: NextResponse;
  if (isLocalizablePath(path)) {
    const headers = new Headers(request.headers);
    headers.set(URL_LOCALE_HEADER, locale);
    response = NextResponse.rewrite(target, { request: { headers } });
  } else {
    response = NextResponse.redirect(target, 307);
  }
  if (request.cookies.get(DEMO_COOKIES.lang)?.value !== locale) {
    response.cookies.set(DEMO_COOKIES.lang, locale, { path: '/', maxAge: COOKIE_MAX_AGE, sameSite: 'lax' });
  }
  return response;
}

export const config = {
  // Не трогаем статику, служебные адреса Next и API замеров
  matcher: ['/((?!_next/|favicon.ico|dev/health|dev/routes|.*\\.(?:png|jpg|jpeg|svg|webp|ico|woff2?)$).*)'],
};
