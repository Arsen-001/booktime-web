import 'server-only';
import { cookies } from 'next/headers';
import { DEMO_COOKIES, readDemoSettings, type DemoSettings } from '@/demo/settings';
import { getUrlLocale } from '@/i18n/locale';

/** Демо-настройки текущего запроса (из cookie); язык в адресе (/hy/…, /en/…) важнее cookie `lang`. */
export async function getDemoSettings(): Promise<DemoSettings> {
  const [jar, urlLocale] = await Promise.all([cookies(), getUrlLocale()]);
  return readDemoSettings((key) => (key === 'lang' && urlLocale) || jar.get(DEMO_COOKIES[key])?.value);
}
