'use client';

/**
 * Имя мастера или бизнеса для показа клиенту: в английском интерфейсе кириллица и армянский — латиницей
 * (владелец, 01.10.2026). Только показ — данные, поиск и ссылки не меняются.
 *   const nameOf = useDisplayName(); nameOf(staff.name)
 */
import { useLocale } from 'next-intl';
import { translit } from '@/lib/translit';

export function useDisplayName() {
  const locale = useLocale();
  return (name: string | undefined | null): string => (name ? (locale === 'en' ? translit(name) : name) : '');
}
