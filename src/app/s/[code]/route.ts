import { NextResponse, type NextRequest } from 'next/server';
import { DATA_COOKIE, resolveDataMode } from '@/api/mode';

/**
 * Короткая ссылка из SMS `booktime.am/s/<code>` (28.09) — «сайт должен работать очень быстро»: в режиме api один
 * запрос к серверу (по первичному ключу code) и сразу 302 на полный путь, без страницы и без JS. Ответ кешируется
 * браузером на час — повторное открытие той же SMS не идёт на сервер. В режиме mock база живёт в браузере, поэтому
 * 302 ведёт на лёгкую страницу `/s/<code>/open`, которая читает её там же; туда же — «не найдено».
 */
const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4010').replace(/\/$/, '');
const CODE = /^[0-9A-Za-z]{4,12}$/;

function isSafeTarget(target: unknown): target is string {
  return typeof target === 'string' && target.startsWith('/') && !target.startsWith('//') && !target.startsWith('/\\');
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const fallback = new URL(`/s/${encodeURIComponent(code)}/open`, request.url);
  if (!CODE.test(code) || resolveDataMode(request.cookies.get(DATA_COOKIE)?.value) !== 'api') return NextResponse.redirect(fallback, 302);
  try {
    const res = await fetch(`${API_URL}/v1/public/s/${code}`, { cache: 'no-store', signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const { target } = (await res.json()) as { target?: unknown };
      if (isSafeTarget(target)) {
        const out = NextResponse.redirect(new URL(target, request.url), 302);
        out.headers.set('Cache-Control', 'private, max-age=3600');
        return out;
      }
    }
  } catch {
    // Сервер не ответил за 3 с — страница /open покажет ошибку с «Повторить», а не пустой экран
  }
  return NextResponse.redirect(fallback, 302);
}
