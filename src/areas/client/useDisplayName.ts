'use client';

/**
 * Имя мастера или бизнеса для показа клиенту.
 *  - Мастер (объект с `name` и `nameI18n`) — на языке страницы (владелец 17.11.2026): перевод из карточки мастера,
 *    нет его — перевод букв на лету («Ани Саргсян» → «Անի Սարգսյան» / «Ani Sargsyan»).
 *  - Строка (название бизнеса) — как раньше: в английском интерфейсе кириллица и армянский латиницей (01.10.2026).
 * Только показ — данные, поиск и ссылки не меняются.
 *   const nameOf = useDisplayName(); nameOf(staff) · nameOf(business.name)
 */
import { useLocale } from 'next-intl';
import { localizedName, translit, type NameLocale } from '@/lib/translit';

export type DisplayNamed = string | { name: string; nameI18n?: Partial<Record<NameLocale, string>> } | undefined | null;

export function useDisplayName() {
  const locale = useLocale();
  return (named: DisplayNamed): string => {
    if (!named) return '';
    if (typeof named === 'string') return locale === 'en' ? translit(named) : named;
    return localizedName(named.name, named.nameI18n, locale);
  };
}
