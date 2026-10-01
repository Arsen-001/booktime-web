import 'server-only';
import { cookies, headers } from 'next/headers';
import { DESKTOP_WIDTH, PHONE_WIDTH, VIEWPORT_COOKIE } from '@/ui/device/viewportHint';

/** Ширина экрана для первого кадра: из cookie браузера, иначе по заголовкам (телефон — 390, иначе — 1440). */
export async function getViewportHint(): Promise<number> {
  const fromCookie = Number((await cookies()).get(VIEWPORT_COOKIE)?.value);
  if (Number.isFinite(fromCookie) && fromCookie > 0) return fromCookie;
  const h = await headers();
  const mobile = h.get('sec-ch-ua-mobile') === '?1' || /Mobi|Android|iPhone|iPod/i.test(h.get('user-agent') ?? '');
  return mobile ? PHONE_WIDTH : DESKTOP_WIDTH;
}
