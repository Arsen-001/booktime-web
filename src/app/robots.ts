import type { MetadataRoute } from 'next';
import { PREFIXED_LOCALES } from '@/i18n/localePath';
import { absoluteUrl, isIndexable } from '@/lib/seo/site';

/** Те же правила для адресов с языком (/hy/…, /en/… — src/i18n/localePath.ts) */
const withPrefixes = (paths: string[]) => [...paths, ...PREFIXED_LOCALES.flatMap((l) => paths.map((p) => `/${l}${p}`))];

/**
 * robots.txt (SEO, 03.10.2026). Индексируется только booktime.am (сборка api + VERCEL_ENV=production):
 * главная, поиск, страницы салонов и мастеров. Кабинет, панель, вход, записи клиента, шаги записи, виджет и
 * короткие ссылки — закрыты. Любая другая сборка (demo — моковые данные, staging, превью) — Disallow: /.
 */
export default function robots(): MetadataRoute.Robots {
  if (!isIndexable()) {
    return { rules: { userAgent: '*', disallow: '/' } };
  }
  return {
    rules: {
      userAgent: '*',
      allow: withPrefixes(['/', '/search', '/b/', '/masters/']),
      disallow: [
        // кабинет бизнеса, наша панель, служебное
        '/biz',
        '/platform',
        '/dev',
        '/api/',
        '/s/',
        // личное клиента и вход
        '/login',
        '/profile',
        '/bookings',
        '/book',
        '/favorites',
        '/notifications',
        '/diary',
        '/certificates',
        '/memberships',
        '/loyalty-cards',
        '/claim/',
        '/stories/',
        '/places/*/cashback',
        // у публичных страниц есть адреса с языком (/hy/b/…) — те же правила и для них; остальное с префиксом proxy уводит на адрес без него
        ...withPrefixes([
          // шаги записи и личное внутри страницы салона; сама /b/<slug> и /b/<slug>/about открыты
          '/b/*/book',
          '/b/*/booking/',
          '/b/*/me',
          '/b/*/embed',
          '/b/*/f/',
          // поиск «свободно сегодня/завтра» и «фокус в поле» — меняется каждый день, остальное склеивает canonical
          '/search?*free=',
          '/search?*focus=',
        ]),
      ],
    },
    sitemap: absoluteUrl('/sitemap.xml'),
  };
}
