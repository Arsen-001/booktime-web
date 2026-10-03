import type { Metadata } from 'next';
import type { LocaleCode } from '@/domain/core';

/** og:locale по языку страницы */
const OG_LOCALE: Record<LocaleCode, string> = { ru: 'ru_RU', en: 'en_US', hy: 'hy_AM' };

export interface PageSeo {
  /** Заголовок без « | BookTime» — его добавляем здесь */
  title: string;
  description: string;
  /** Путь от корня: '/b/nuri' — canonical и og:url (metadataBase задан в корневом layout) */
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
 * и потомок его не должен перебить.
 */
export function pageMetadata({ title, description, path, locale, images, type = 'website', branded = false }: PageSeo): Metadata {
  const full = branded ? title : `${title} | BookTime`;
  return {
    title: { absolute: full },
    description,
    alternates: { canonical: path },
    openGraph: {
      type,
      siteName: 'BookTime',
      locale: OG_LOCALE[locale],
      url: path,
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
