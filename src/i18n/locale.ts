import 'server-only';
import { cookies, headers } from 'next/headers';
import { DEFAULT_LOCALE, isLocale, type Locale } from '@/i18n/config';
import { URL_LOCALE_HEADER } from '@/i18n/localePath';
import { DEMO_COOKIES } from '@/demo/settings';

/** Язык из адреса (/hy/…, /en/…): proxy передаёт его заголовком при переписывании — src/i18n/localePath.ts */
export async function getUrlLocale(): Promise<Locale | undefined> {
  const value = (await headers()).get(URL_LOCALE_HEADER);
  return isLocale(value) ? value : undefined;
}

/** Язык текущего запроса: язык в адресе, иначе cookie `lang` (его ставят демо-переключатель и proxy по ?lang=). */
export async function getRequestLocale(): Promise<Locale> {
  const fromUrl = await getUrlLocale();
  if (fromUrl) return fromUrl;
  const value = (await cookies()).get(DEMO_COOKIES.lang)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}
