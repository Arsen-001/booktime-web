import 'server-only';
import { cookies } from 'next/headers';
import { DEFAULT_LOCALE, isLocale, type Locale } from '@/i18n/config';
import { DEMO_COOKIES } from '@/demo/settings';

/** Язык текущего запроса: cookie `lang` (его ставят демо-переключатель и proxy по ?lang=). */
export async function getRequestLocale(): Promise<Locale> {
  const value = (await cookies()).get(DEMO_COOKIES.lang)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}
