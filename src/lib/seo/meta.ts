import type { Metadata } from 'next';
import type { LocaleCode } from '@/domain/core';
import { localeAlternates, localizedPath } from '@/i18n/localePath';

/** og:locale по языку страницы */
const OG_LOCALE: Record<LocaleCode, string> = { ru: 'ru_RU', en: 'en_US', hy: 'hy_AM' };

export interface PageSeo {
  /** Заголовок без « | BookTime» — его добавляем здесь */
  title: string;
  description: string;
  /**
   * Путь от корня без языка: '/b/nuri' — canonical и og:url (metadataBase задан в корневом layout). Язык в адрес
   * добавляем здесь: canonical — адрес на языке страницы ('/hy/b/nuri'), hreflang — все три языка + x-default (ru).
   */
  path: string;
  locale: LocaleCode;
  /** Свои картинки; без них — opengraph-image сегмента (если есть) или ничего */
  images?: string[];
  type?: 'website' | 'profile';
  /** Заголовок уже с именем продукта (главная) — « | BookTime» не добавляем */
  branded?: boolean;
}

/**
 * Метаданные публичной страницы (SEO, 03.10.2026): title (абсолютный — шаблон «%s · BookTime» корня не нужен),
 * description, canonical, Open Graph, Twitter. openGraph у потомка заменяет родительский целиком — поэтому
 * siteName/locale повторяем. `robots` здесь НЕ ставим: noindex сборок demo/staging задаёт корневой layout,
 * и потомок его не должен перебить. Язык в адресе (03.10.2026): canonical — на языке страницы, alternates.languages —
 * hy/ru/en + x-default (src/i18n/localePath.ts).
 */
export function pageMetadata({ title, description, path, locale, images, type = 'website', branded = false }: PageSeo): Metadata {
  const full = branded ? title : `${title} | BookTime`;
  const canonical = localizedPath(path, locale);
  return {
    title: { absolute: full },
    description,
    alternates: { canonical, languages: localeAlternates(path) },
    openGraph: {
      type,
      siteName: 'BookTime',
      locale: OG_LOCALE[locale],
      url: canonical,
      title: full,
      description,
      ...(images && images.length > 0 && { images }),
    },
    twitter: { card: 'summary_large_image', title: full, description, ...(images && images.length > 0 && { images }) },
  };
}

/** Страница, которой нет: без индекса, с понятным заголовком */
export function notFoundMetadata(title: string): Metadata {
  return { title, robots: { index: false, follow: false } };
}
